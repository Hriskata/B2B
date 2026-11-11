import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { notifyAdminsOfPendingRegistration } from "../admin/registrations";
import { checkCompany, type CompanyCheck } from "../company-check";
import { sendMail } from "../mail/send";
import { alreadyRegisteredMail, resetPasswordMail, verifyEmailMail } from "../mail/templates";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";
import { createSession, revokeAllSessions } from "./session";
import {
  consumeEmailToken,
  createEmailToken,
  TOKEN_TTL_SECONDS,
  usableTokenSubject,
} from "./tokens";

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === PG_UNIQUE_VIOLATION || e?.cause?.code === PG_UNIQUE_VIOLATION;
}

export type RegisterInput = {
  fullName: string;
  country: string;
  companyName: string;
  // Already in the stored form (parseCompanyNumber).
  companyNumber: string;
  email: string;
  password: string;
  ip: string;
};

// Status once the email is confirmed (also restored by unblocking). A
// profile is approved without a person only when the register confirmed an
// active Bulgarian company; all others (foreign companies, decided
// 10.11.2026, and Bulgarian ones the register did not confirm) wait for an
// admin. The fact is stored on the profile (needsReview), not derived.
export function statusAfterEmailConfirmed(review: {
  needsReview: boolean;
  approvedAt: Date | null;
  rejectedAt: Date | null;
}): "active" | "pending_review" | "rejected" {
  if (review.rejectedAt) return "rejected";
  if (review.approvedAt || !review.needsReview) return "active";
  return "pending_review";
}

// What is stored on the company from a register answer.
function registryFields(check: CompanyCheck) {
  const found = check.kind === "active" || check.kind === "inactive" || check.kind === "unknown";
  return {
    registryState: check.kind,
    registryStatus: found ? check.status : null,
    registryName: found ? check.name : null,
    registryCheckedAt: new Date(),
  };
}

// A register that did not answer (or an unconfirmed "not found") must not
// wipe an earlier real answer that admins may still be looking at.
function isRealAnswer(check: CompanyCheck): boolean {
  return check.kind !== "unavailable" && check.kind !== "not_confirmed";
}

// Order as in CLAUDE.md: the form, then the company check, and only then the
// verification email. A company the register does not know is refused with a
// clear message; every other answer than "active" (inactive, unknown status,
// register not answering) sends the profile to manual review.
//
// Apart from "company_not_found" (which depends only on the company number)
// the caller shows the same message whatever happens here, so that the
// response never reveals whether an email is already registered.
export async function registerCustomer(
  input: RegisterInput,
): Promise<"ok" | "rate_limited" | "company_not_found"> {
  const rateOk =
    (await hit(`register:email:${input.email}`, LIMITS.registerPerEmail)) &&
    (await hit(`register:ip:${input.ip}`, LIMITS.registerPerIp));
  if (!rateOk) return "rate_limited";

  // Asked for every Bulgarian registration, before the email is looked up,
  // so neither the answer nor its timing depends on the email. Rate limited
  // above, which also protects the register's daily request limit.
  const check = input.country === "BG" ? await checkCompany(input.companyNumber) : null;
  if (check?.kind === "not_found") return "company_not_found";
  const needsReview = check?.kind !== "active";

  // Hash even when the email exists, so timing does not give it away.
  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  const existing = (
    await db.select().from(tables.users).where(eq(tables.users.email, input.email))
  )[0];

  if (existing) {
    if (existing.status === "unverified") {
      // A fresh answer can only add the need for a review, never remove it:
      // a company struck off since the first registration is not approved
      // by an old "active".
      if (needsReview && !existing.needsReview) {
        await db.update(tables.users).set({ needsReview: true }).where(eq(tables.users.id, existing.id));
      }
      const token = await createEmailToken("verify_email", "user", existing.id);
      await sendMail(
        verifyEmailMail(input.email, token, TOKEN_TTL_SECONDS.verify_email / 3600),
      );
    } else if (existing.status === "active" || existing.status === "pending_review") {
      await sendMail(alreadyRegisteredMail(input.email));
    }
    // Blocked and rejected accounts get no mail (assumption, see docs/PLAN.md 2А).
    return "ok";
  }

  try {
    const token = await db.transaction(async (tx) => {
      await tx
        .insert(tables.companies)
        .values({
          country: input.country,
          companyNumber: input.companyNumber,
          name: input.companyName,
        })
        .onConflictDoNothing({
          target: [tables.companies.country, tables.companies.companyNumber],
        });
      const company = (
        await tx
          .select()
          .from(tables.companies)
          .where(
            and(
              eq(tables.companies.country, input.country),
              eq(tables.companies.companyNumber, input.companyNumber),
            ),
          )
      )[0];
      // The latest register answer, also for a company that already exists.
      if (check && (isRealAnswer(check) || company.registryState === null)) {
        await tx
          .update(tables.companies)
          .set(registryFields(check))
          .where(eq(tables.companies.id, company.id));
      }
      // A second profile for an existing company keeps the stored company
      // name. Whether the first owner must approve it is an open question.
      const [user] = await tx
        .insert(tables.users)
        .values({
          companyId: company.id,
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          needsReview,
        })
        .returning({ id: tables.users.id });
      return createEmailToken("verify_email", "user", user.id, tx);
    });
    await sendMail(verifyEmailMail(input.email, token, TOKEN_TTL_SECONDS.verify_email / 3600));
  } catch (error) {
    // Lost a race with a parallel registration of the same email: same outcome.
    if (!isUniqueViolation(error)) throw error;
  }
  return "ok";
}

// For a valid link: the account's status after it ("active",
// "pending_review", or unchanged, e.g. "blocked"). "invalid" otherwise.
export async function verifyCustomerEmail(
  token: string,
): Promise<(typeof tables.users.$inferSelect)["status"] | "invalid"> {
  const result = await getDb().transaction(async (tx) => {
    const userId = await consumeEmailToken(token, "verify_email", "user", tx);
    if (!userId) return null;
    const user = (await tx.select().from(tables.users).where(eq(tables.users.id, userId)))[0];
    const status = statusAfterEmailConfirmed(user);
    const changed = await tx
      .update(tables.users)
      .set({ status, emailVerifiedAt: new Date() })
      // Only unverified accounts change; a blocked account stays blocked.
      .where(and(eq(tables.users.id, userId), eq(tables.users.status, "unverified")))
      .returning({ id: tables.users.id });
    return { userId, status: changed.length > 0 ? status : user.status, changed: changed.length > 0 };
  });
  if (!result) return "invalid";
  // Told once, when the registration starts waiting.
  if (result.changed && result.status === "pending_review") {
    await notifyAdminsOfPendingRegistration(result.userId);
  }
  return result.status;
}

export type LoginResult =
  | "ok"
  | "invalid"
  | "unverified"
  | "pending_review"
  | "rejected"
  | "blocked"
  | "rate_limited";

export async function loginCustomer(
  email: string,
  password: string,
  ip: string,
): Promise<LoginResult> {
  const accountKey = `login:user:${email}`;
  const ipKey = `login:ip:${ip}`;
  if (
    (await isLimited(accountKey, LIMITS.loginFailuresPerAccount.limit)) ||
    (await isLimited(ipKey, LIMITS.loginFailuresPerIp.limit))
  ) {
    return "rate_limited";
  }

  const found = (
    await getDb()
      .select({ user: tables.users, companyBlockedAt: tables.companies.blockedAt })
      .from(tables.users)
      .innerJoin(tables.companies, eq(tables.companies.id, tables.users.companyId))
      .where(eq(tables.users.email, email))
  )[0];
  const user = found?.user;
  let passwordOk = false;
  if (user) {
    passwordOk = await verifyPassword(user.passwordHash, password);
  } else {
    await verifyAgainstDummy(password);
  }

  if (!user || !passwordOk) {
    await hit(accountKey, LIMITS.loginFailuresPerAccount);
    await hit(ipKey, LIMITS.loginFailuresPerIp);
    return "invalid";
  }

  await reset(accountKey);
  // Only someone who knows the password learns these two states.
  if (user.status === "blocked" || found.companyBlockedAt) return "blocked";
  if (user.status === "pending_review") return "pending_review";
  if (user.status === "rejected") return "rejected";
  if (user.status !== "active") return "unverified";

  await createSession("user", user.id);
  return "ok";
}

// Always behaves the same from the outside: the caller shows one message.
export async function requestCustomerPasswordReset(email: string, ip: string): Promise<void> {
  const allowed =
    (await hit(`reset:email:${email}`, LIMITS.resetRequestPerEmail)) &&
    (await hit(`reset:ip:${ip}`, LIMITS.resetRequestPerIp));
  if (!allowed) return;

  const user = (await getDb().select().from(tables.users).where(eq(tables.users.email, email)))[0];
  // An account waiting for review may reset its password too (the status
  // does not change).
  if (!user || (user.status !== "active" && user.status !== "pending_review")) return;

  const token = await createEmailToken("reset_password", "user", user.id);
  await sendMail(
    resetPasswordMail(email, token, TOKEN_TTL_SECONDS.reset_password / 60, "user"),
  );
}

// Email of the account a reset link belongs to, so the new password can be
// checked against it (it must not contain the email). Does not use the link.
export async function emailForCustomerResetToken(token: string): Promise<string | null> {
  const userId = await usableTokenSubject(token, "reset_password", "user");
  if (!userId) return null;
  const user = (await getDb().select().from(tables.users).where(eq(tables.users.id, userId)))[0];
  return user?.email ?? null;
}

// The password is validated by the caller before this runs, so a weak
// password does not burn the token.
export async function resetCustomerPassword(token: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return getDb().transaction(async (tx) => {
    const userId = await consumeEmailToken(token, "reset_password", "user", tx);
    if (!userId) return false;
    await tx.update(tables.users).set({ passwordHash }).where(eq(tables.users.id, userId));
    await revokeAllSessions("user", userId);
    return true;
  });
}
