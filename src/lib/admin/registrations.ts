import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";
import { countryName } from "../company-number";
import { sendMail } from "../mail/send";
import {
  registrationApprovedMail,
  registrationPendingAdminMail,
  registrationRejectedMail,
} from "../mail/templates";

// Manual review of registrations: every foreign company for now (decided
// 10.11.2026); in phase 2 also Bulgarian ones whose company check failed.

export type PendingRegistration = {
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  companyName: string;
  country: string;
  companyNumber: string;
};

export async function listPendingRegistrations(): Promise<PendingRegistration[]> {
  return getDb()
    .select({
      userId: tables.users.id,
      email: tables.users.email,
      fullName: tables.users.fullName,
      createdAt: tables.users.createdAt,
      emailVerifiedAt: tables.users.emailVerifiedAt,
      companyName: tables.companies.name,
      country: tables.companies.country,
      companyNumber: tables.companies.companyNumber,
    })
    .from(tables.users)
    .innerJoin(tables.companies, eq(tables.companies.id, tables.users.companyId))
    .where(eq(tables.users.status, "pending_review"))
    .orderBy(asc(tables.users.createdAt));
}

// One mail per active admin. Who gets the inquiries is still open; for
// registrations CLAUDE.md says the admins are told by email.
export async function notifyAdminsOfPendingRegistration(userId: string): Promise<void> {
  const db = getDb();
  const registration = (
    await db
      .select({ country: tables.companies.country })
      .from(tables.users)
      .innerJoin(tables.companies, eq(tables.companies.id, tables.users.companyId))
      .where(eq(tables.users.id, userId))
  )[0];
  if (!registration) return;
  const admins = await db
    .select({ email: tables.admins.email })
    .from(tables.admins)
    .where(eq(tables.admins.status, "active"));
  for (const admin of admins) {
    await sendMail(
      registrationPendingAdminMail(admin.email, countryName(registration.country)),
    );
  }
}

const UUID = /^[0-9a-f-]{36}$/i;

// Only a registration that still waits can be decided, once. The customer is
// told by email after the change is saved.
export async function reviewRegistration(
  actor: Actor,
  userId: string,
  decision: "approve" | "reject",
): Promise<"ok" | "not_found"> {
  if (!UUID.test(userId)) return "not_found";
  const approve = decision === "approve";
  const now = new Date();
  const reviewed = await getDb().transaction(async (tx) => {
    const [user] = await tx
      .update(tables.users)
      .set(
        approve
          ? { status: "active", approvedAt: now }
          : { status: "rejected", rejectedAt: now },
      )
      .where(and(eq(tables.users.id, userId), eq(tables.users.status, "pending_review")))
      .returning({ email: tables.users.email, companyId: tables.users.companyId });
    if (!user) return null;
    const company = (
      await tx.select().from(tables.companies).where(eq(tables.companies.id, user.companyId))
    )[0];
    await writeAudit(tx, actor, {
      action: approve ? "registration.approve" : "registration.reject",
      targetType: "user",
      targetId: userId,
      details: {
        email: user.email,
        company: company.name,
        country: company.country,
        companyNumber: company.companyNumber,
      },
    });
    return user;
  });
  if (!reviewed) return "not_found";
  await sendMail(
    approve ? registrationApprovedMail(reviewed.email) : registrationRejectedMail(reviewed.email),
  );
  return "ok";
}
