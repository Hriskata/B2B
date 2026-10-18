import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, tables } from "@/db";
import { readSession, type SessionStage } from "./session";

// These are the only ways server code learns who is logged in. Every page and
// action that needs a user calls one of them; nothing relies on the UI.

export async function getCurrentUser() {
  const session = await readSession("user");
  if (!session || session.stage !== "full") return null;
  const rows = await getDb()
    .select({
      id: tables.users.id,
      email: tables.users.email,
      status: tables.users.status,
      companyId: tables.users.companyId,
      companyName: tables.companies.name,
    })
    .from(tables.users)
    .innerJoin(tables.companies, eq(tables.companies.id, tables.users.companyId))
    .where(eq(tables.users.id, session.subjectId));
  const user = rows[0];
  // Blocked or unverified accounts have no access even with a valid cookie.
  return user && user.status === "active" ? user : null;
}

export async function getCurrentAdmin(stage: SessionStage = "full") {
  const session = await readSession("admin");
  if (!session || session.stage !== stage) return null;
  const admin = (
    await getDb().select().from(tables.admins).where(eq(tables.admins.id, session.subjectId))
  )[0];
  if (!admin || admin.status !== "active") return null;
  return { id: admin.id, email: admin.email, role: admin.role, totpEnabled: !!admin.totpEnabledAt };
}

export async function requireAdmin() {
  const admin = await getCurrentAdmin("full");
  if (!admin) redirect("/admin/login");
  return admin;
}
