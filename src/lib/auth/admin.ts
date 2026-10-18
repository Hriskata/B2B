import "server-only";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { sendMail } from "../mail/send";
import { resetPasswordMail } from "../mail/templates";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";
import { createSession, revokeAllSessions } from "./session";
import { consumeEmailToken, createEmailToken, TOKEN_TTL_SECONDS } from "./tokens";

export type AdminLoginResult =
  | { status: "next"; step: "mfa_verify" | "mfa_setup" }
  | { status: "invalid" | "rate_limited" };

// Step 1 of admin login. Success here does NOT give access: it only issues a
// short-lived session that is limited to the second-factor pages.
export async function loginAdmin(
  email: string,
  password: string,
  ip: string,
): Promise<AdminLoginResult> {
  const accountKey = `login:admin:${email}`;
  const ipKey = `login:ip:${ip}`;
  if (
    (await isLimited(accountKey, LIMITS.loginFailuresPerAccount.limit)) ||
    (await isLimited(ipKey, LIMITS.loginFailuresPerIp.limit))
  ) {
    return { status: "rate_limited" };
  }

  const admin = (
    await getDb().select().from(tables.admins).where(eq(tables.admins.email, email))
  )[0];
  let passwordOk = false;
  if (admin) {
    passwordOk = await verifyPassword(admin.passwordHash, password);
  } else {
    await verifyAgainstDummy(password);
  }

  // A blocked admin gets the same answer as a wrong password.
  if (!admin || !passwordOk || admin.status !== "active") {
    await hit(accountKey, LIMITS.loginFailuresPerAccount);
    await hit(ipKey, LIMITS.loginFailuresPerIp);
    return { status: "invalid" };
  }

  await reset(accountKey);
  const step = admin.totpEnabledAt ? "mfa_verify" : "mfa_setup";
  await createSession("admin", admin.id, step);
  return { status: "next", step };
}

export async function requestAdminPasswordReset(email: string, ip: string): Promise<void> {
  const allowed =
    (await hit(`reset:email:${email}`, LIMITS.resetRequestPerEmail)) &&
    (await hit(`reset:ip:${ip}`, LIMITS.resetRequestPerIp));
  if (!allowed) return;

  const admin = (
    await getDb().select().from(tables.admins).where(eq(tables.admins.email, email))
  )[0];
  if (!admin || admin.status !== "active") return;

  const token = await createEmailToken("reset_password", "admin", admin.id);
  await sendMail(
    resetPasswordMail(email, token, TOKEN_TTL_SECONDS.reset_password / 60, "admin"),
  );
}

// Changes only the password. 2FA stays as it is, so a reset never lets
// someone in without the second factor (checklist B). Every session of the
// admin is ended.
export async function resetAdminPassword(token: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return getDb().transaction(async (tx) => {
    const adminId = await consumeEmailToken(token, "reset_password", "admin", tx);
    if (!adminId) return false;
    await tx.update(tables.admins).set({ passwordHash }).where(eq(tables.admins.id, adminId));
    await revokeAllSessions("admin", adminId);
    return true;
  });
}
