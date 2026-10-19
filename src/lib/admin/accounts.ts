import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";
import { revokeAllSessions } from "../auth/session";

export type CustomerUser = {
  id: string;
  email: string;
  status: "unverified" | "active" | "blocked";
  createdAt: Date;
};

export type CustomerCompany = {
  id: string;
  eik: string;
  name: string;
  blockedAt: Date | null;
  users: CustomerUser[];
};

export async function listCustomers(): Promise<CustomerCompany[]> {
  const db = getDb();
  const companies = await db.select().from(tables.companies).orderBy(asc(tables.companies.name));
  const users = await db.select().from(tables.users).orderBy(asc(tables.users.email));
  return companies.map((c) => ({
    id: c.id,
    eik: c.eik,
    name: c.name,
    blockedAt: c.blockedAt,
    users: users
      .filter((u) => u.companyId === c.id)
      .map((u) => ({ id: u.id, email: u.email, status: u.status, createdAt: u.createdAt })),
  }));
}

const UUID = /^[0-9a-f-]{36}$/i;

// Blocking ends every session of the person at once; unblocking restores the
// state they had (active if their email was verified, otherwise unverified).
export async function setUserBlocked(
  actor: Actor,
  userId: string,
  blocked: boolean,
): Promise<"ok" | "not_found"> {
  if (!UUID.test(userId)) return "not_found";
  const result = await getDb().transaction(async (tx) => {
    const user = (await tx.select().from(tables.users).where(eq(tables.users.id, userId)))[0];
    if (!user) return "not_found" as const;
    await tx
      .update(tables.users)
      .set({ status: blocked ? "blocked" : user.emailVerifiedAt ? "active" : "unverified" })
      .where(eq(tables.users.id, userId));
    await writeAudit(tx, actor, {
      action: blocked ? "user.block" : "user.unblock",
      targetType: "user",
      targetId: userId,
      details: { email: user.email },
    });
    return "ok" as const;
  });
  if (result === "ok" && blocked) await revokeAllSessions("user", userId);
  return result;
}

// Blocking a company blocks all its users, including ones added later.
export async function setCompanyBlocked(
  actor: Actor,
  companyId: string,
  blocked: boolean,
): Promise<"ok" | "not_found"> {
  if (!UUID.test(companyId)) return "not_found";
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const company = (
      await tx.select().from(tables.companies).where(eq(tables.companies.id, companyId))
    )[0];
    if (!company) return "not_found" as const;
    await tx
      .update(tables.companies)
      .set({ blockedAt: blocked ? new Date() : null })
      .where(eq(tables.companies.id, companyId));
    await writeAudit(tx, actor, {
      action: blocked ? "company.block" : "company.unblock",
      targetType: "company",
      targetId: companyId,
      details: { eik: company.eik, name: company.name },
    });
    return "ok" as const;
  });
  if (result === "ok" && blocked) {
    const members = await db
      .select({ id: tables.users.id })
      .from(tables.users)
      .where(eq(tables.users.companyId, companyId));
    if (members.length > 0) {
      await db
        .delete(tables.sessions)
        .where(
          // All sessions of this company's users.
          inArray(
            tables.sessions.subjectId,
            members.map((m) => m.id),
          ),
        );
    }
  }
  return result;
}
