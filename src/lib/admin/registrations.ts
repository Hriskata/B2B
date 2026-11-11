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

// Manual review of registrations: every foreign company (decided 10.11.2026)
// and every Bulgarian one the register did not confirm as active.

export type PendingRegistration = {
  userId: string;
  email: string;
  fullName: string | null;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  companyName: string;
  country: string;
  companyNumber: string;
  companyBlockedAt: Date | null;
  registryState: string | null;
  registryStatus: string | null;
  registryName: string | null;
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
      companyBlockedAt: tables.companies.blockedAt,
      registryState: tables.companies.registryState,
      registryStatus: tables.companies.registryStatus,
      registryName: tables.companies.registryName,
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
  // In parallel, so a slow mail server does not keep the customer waiting
  // once per admin. A lost notice is logged without any address.
  const sent = await Promise.all(
    admins.map((admin) =>
      sendMail(registrationPendingAdminMail(admin.email, countryName(registration.country))),
    ),
  );
  const failed = sent.filter((ok) => !ok).length;
  if (failed > 0) {
    console.error(`Review notice not sent to ${failed} admin(s) for registration ${userId}`);
  }
}

const UUID = /^[0-9a-f-]{36}$/i;

// Short-lived cookie with the outcome of the last decision, shown once on the
// review page (set by the action, never taken from the address).
export const REVIEW_NOTICE_COOKIE = "b2b_review_notice";

// Only a registration that still waits can be decided, once. The customer is
// told by email after the change is saved.
export async function reviewRegistration(
  actor: Actor,
  userId: string,
  decision: "approve" | "reject",
): Promise<"ok" | "mail_failed" | "not_found"> {
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
        // What the register said when the admin decided.
        registryState: company.registryState,
        registryStatus: company.registryStatus,
      },
    });
    return user;
  });
  if (!reviewed) return "not_found";
  // The decision stands either way; the admin is told if the mail did not go.
  const sent = await sendMail(
    approve ? registrationApprovedMail(reviewed.email) : registrationRejectedMail(reviewed.email),
  );
  return sent ? "ok" : "mail_failed";
}
