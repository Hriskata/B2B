import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { sendMail } from "../mail/send";
import { alreadyRegisteredMail, resetPasswordMail, verifyEmailMail } from "../mail/templates";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";
import { createSession, revokeAllSessions } from "./session";
import { consumeEmailToken, createEmailToken, TOKEN_TTL_SECONDS } from "./tokens";

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === PG_UNIQUE_VIOLATION || e?.cause?.code === PG_UNIQUE_VIOLATION;
}

export type RegisterInput = {
  companyName: string;
  eik: string;
  email: string;
  password: string;
  ip: string;
};

// Phase 1 only: no company check yet. Phase 2 inserts the CompanyVerifier
// step BEFORE the verification email, as CLAUDE.md requires.
//
// The caller shows the same message whatever happens here, so that the
// response never reveals whether an email is already registered.
export async function registerCustomer(input: RegisterInput): Promise<"ok" | "rate_limited"> {
  const rateOk =
    (await hit(`register:email:${input.email}`, LIMITS.registerPerEmail)) &&
    (await hit(`register:ip:${input.ip}`, LIMITS.registerPerIp));
  if (!rateOk) return "rate_limited";

  // Hash even when the email exists, so timing does not give it away.
  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  const existing = (
    await db.select().from(tables.users).where(eq(tables.users.email, input.email))
  )[0];

  if (existing) {
    if (existing.status === "unverified") {
      const token = await createEmailToken("verify_email", "user", existing.id);
      await sendMail(
        verifyEmailMail(input.email, token, TOKEN_TTL_SECONDS.verify_email / 3600),
      );
    } else if (existing.status === "active") {
      await sendMail(alreadyRegisteredMail(input.email));
    }
    return "ok";
  }

  try {
    const token = await db.transaction(async (tx) => {
      await tx
        .insert(tables.companies)
        .values({ eik: input.eik, name: input.companyName })
        .onConflictDoNothing({ target: tables.companies.eik });
      const company = (
        await tx.select().from(tables.companies).where(eq(tables.companies.eik, input.eik))
      )[0];
      // A second profile for an existing company keeps the stored company
      // name. Whether the first owner must approve it is an open question.
      const [user] = await tx
        .insert(tables.users)
        .values({ companyId: company.id, email: input.email, passwordHash })
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

export async function verifyCustomerEmail(token: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const userId = await consumeEmailToken(token, "verify_email", "user", tx);
    if (!userId) return false;
    await tx
      .update(tables.users)
      .set({ status: "active", emailVerifiedAt: new Date() })
      // Only unverified accounts change; a blocked account stays blocked.
      .where(and(eq(tables.users.id, userId), eq(tables.users.status, "unverified")));
    return true;
  });
}

export type LoginResult = "ok" | "invalid" | "unverified" | "blocked" | "rate_limited";

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
  if (!user || user.status !== "active") return;

  const token = await createEmailToken("reset_password", "user", user.id);
  await sendMail(
    resetPasswordMail(email, token, TOKEN_TTL_SECONDS.reset_password / 60, "user"),
  );
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
