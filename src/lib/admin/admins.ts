import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";
import { revokeAllSessions, revokeOtherSessions } from "../auth/session";
import { verifySecondFactor } from "../auth/totp";
import { getEnv } from "../env";
import { sendMail } from "../mail/send";
import { adminAddedMail, twoFactorResetMail } from "../mail/templates";
import { hashPassword, validatePassword, verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";

// SECURITY NOTE: a password that everybody who reads this file knows. It is
// accepted only for a new admin and only until their first login: the account
// is created with passwordMustChange, every admin page then redirects to the
// password change, and the default is rejected as a new password (it is on the
// common-passwords list). Until that first login whoever knows the email and
// this password could sign in first, so the window should be short: tell the
// new admin right away, and prefer a one-time link (open decision).
export const DEFAULT_ADMIN_PASSWORD = "Password123";

export async function listAdmins() {
  return getDb()
    .select({
      id: tables.admins.id,
      email: tables.admins.email,
      role: tables.admins.role,
      status: tables.admins.status,
      passwordMustChange: tables.admins.passwordMustChange,
      totpEnabledAt: tables.admins.totpEnabledAt,
      createdAt: tables.admins.createdAt,
    })
    .from(tables.admins)
    .orderBy(asc(tables.admins.email));
}

export type ResetResult = "ok" | "invalid_credentials" | "rate_limited" | "not_found" | "self";

// Admin B resets the 2FA of admin A. B must prove who they are again with
// their own password AND a current 2FA code (the password alone is not
// enough; the local test switch ADMIN_2FA_DISABLED waives only the code).
// Then, in one transaction: A's secret and recovery codes are removed (A must
// set 2FA up again at the next login) and the action is journaled. After
// commit all of A's sessions end and A gets an email.
export async function resetAdminTwoFactor(
  actor: Actor,
  targetId: string,
  password: string,
  code: string,
): Promise<ResetResult> {
  if (targetId === actor.id) return "self";

  const key = `reauth:admin:${actor.id}`;
  if (await isLimited(key, LIMITS.mfaFailuresPerAdmin.limit)) return "rate_limited";

  const db = getDb();
  const me = (await db.select().from(tables.admins).where(eq(tables.admins.id, actor.id)))[0];
  const passwordOk = !!me && (await verifyPassword(me.passwordHash, password));
  const codeOk =
    passwordOk &&
    (getEnv().ADMIN_2FA_DISABLED || (await verifySecondFactor(actor.id, code)) === "ok");
  if (!passwordOk || !codeOk) {
    await hit(key, LIMITS.mfaFailuresPerAdmin);
    return "invalid_credentials";
  }
  await reset(key);

  if (!/^[0-9a-f-]{36}$/i.test(targetId)) return "not_found";
  const target = (await db.select().from(tables.admins).where(eq(tables.admins.id, targetId)))[0];
  if (!target) return "not_found";

  await db.transaction(async (tx) => {
    await tx
      .update(tables.admins)
      .set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null })
      .where(eq(tables.admins.id, targetId));
    await tx
      .delete(tables.adminRecoveryCodes)
      .where(eq(tables.adminRecoveryCodes.adminId, targetId));
    await writeAudit(tx, actor, {
      action: "admin.2fa_reset",
      targetType: "admin",
      targetId,
      details: { targetEmail: target.email },
    });
  });
  await revokeAllSessions("admin", targetId);
  await sendMail(twoFactorResetMail(target.email, actor.email));
  return "ok";
}

export type CreateAdminResult = { ok: true; id: string } | { ok: false; error: "exists" };

// Adds an admin with the default password and the chosen role. The password is
// never put in the journal or in the email. Journaled in the same transaction.
export async function createAdminAccount(
  actor: Actor,
  email: string,
  role: "viewer" | "editor",
): Promise<CreateAdminResult> {
  const passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD);
  const created = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(tables.admins)
      .values({ email, passwordHash, role, passwordMustChange: true })
      .onConflictDoNothing({ target: tables.admins.email })
      .returning({ id: tables.admins.id });
    if (!row) return null;
    await writeAudit(tx, actor, {
      action: "admin.create",
      targetType: "admin",
      targetId: row.id,
      details: { targetEmail: email, role },
    });
    return row.id;
  });
  if (!created) return { ok: false, error: "exists" };
  await sendMail(adminAddedMail(email, actor.email));
  return { ok: true, id: created };
}

export type ChangePasswordResult = "ok" | "wrong_password" | "weak" | "same" | "rate_limited";

// The logged-in admin changes their own password: they must give the current
// one again. Clears the "must change" flag, ends all their OTHER sessions and
// is journaled (no password in the entry).
export async function changeAdminPassword(
  actor: Actor,
  current: string,
  next: string,
): Promise<ChangePasswordResult> {
  const key = `pwchange:admin:${actor.id}`;
  if (await isLimited(key, LIMITS.mfaFailuresPerAdmin.limit)) return "rate_limited";

  const db = getDb();
  const me = (await db.select().from(tables.admins).where(eq(tables.admins.id, actor.id)))[0];
  if (!me || !(await verifyPassword(me.passwordHash, current))) {
    await hit(key, LIMITS.mfaFailuresPerAdmin);
    return "wrong_password";
  }
  await reset(key);
  if (!validatePassword(next, { email: actor.email }).ok) return "weak";
  if (next === current) return "same";

  const passwordHash = await hashPassword(next);
  await db.transaction(async (tx) => {
    await tx
      .update(tables.admins)
      .set({ passwordHash, passwordMustChange: false })
      .where(eq(tables.admins.id, actor.id));
    await writeAudit(tx, actor, { action: "admin.password_change", targetType: "admin", targetId: actor.id });
  });
  await revokeOtherSessions("admin", actor.id);
  return "ok";
}
