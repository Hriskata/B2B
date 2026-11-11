import "server-only";
import { and, asc, eq, TransactionRollbackError } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";
import { revokeAllSessions, revokeOtherSessions } from "../auth/session";
import {
  consumeEmailToken,
  createEmailToken,
  deleteUnusedTokens,
  TOKEN_TTL_SECONDS,
  usableTokenSubject,
} from "../auth/tokens";
import { randomToken } from "../crypto";
import { verifySecondFactor } from "../auth/totp";
import { getEnv } from "../env";
import { sendMail } from "../mail/send";
import { adminInviteMail, twoFactorResetMail } from "../mail/templates";
import { hashPassword, validatePassword, verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";

// A new admin from the portal gets an emailed one-time link to set their own
// password (decided 11.11.2026; the temporary password is gone). Until then
// the account has an unknown random password, so nobody can log in to it, and
// passwordMustChange marks "has not set a password yet" (an invite waits).

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

// The logged-in admin proves who they are again, before a sensitive change:
// their own password AND a current 2FA code (the local test switch
// ADMIN_2FA_DISABLED waives only the code). Failures are limited per admin.
export async function reauthenticateAdmin(
  adminId: string,
  password: string,
  code: string,
): Promise<"ok" | "invalid_credentials" | "rate_limited"> {
  const key = `reauth:admin:${adminId}`;
  if (await isLimited(key, LIMITS.mfaFailuresPerAdmin.limit)) return "rate_limited";
  const me = (await getDb().select().from(tables.admins).where(eq(tables.admins.id, adminId)))[0];
  const passwordOk = !!me && (await verifyPassword(me.passwordHash, password));
  const codeOk =
    passwordOk &&
    // Its own key, so mistakes here do not lock the login. Trade-off (accepted,
    // docs/UNVERIFIED.md): login and re-checks together allow 2 x 5 wrong codes
    // per 15 minutes; a re-check also needs a session and the password, and
    // the reauth key above (5 failures) always stops it first.
    (getEnv().ADMIN_2FA_DISABLED || (await verifySecondFactor(adminId, code, `${key}:2fa`)) === "ok");
  if (!passwordOk || !codeOk) {
    await hit(key, LIMITS.mfaFailuresPerAdmin);
    return "invalid_credentials";
  }
  await reset(key);
  return "ok";
}

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

  const reauth = await reauthenticateAdmin(actor.id, password, code);
  if (reauth !== "ok") return reauth;

  const db = getDb();

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

export type CreateAdminResult =
  | { ok: true; id: string; mailed: boolean }
  | { ok: false; error: "exists" | "invalid_credentials" | "rate_limited" };

// Adds an admin with the chosen role and mails them a one-time link to set
// their own password. No password is ever shown, mailed or journaled.
// Journaled in the same transaction.
export async function createAdminAccount(
  actor: Actor,
  email: string,
  role: "viewer" | "editor",
  // The creating admin's own password and 2FA code: an open session alone
  // (e.g. an unattended laptop) must not be enough to add a lasting account.
  password: string,
  code: string,
): Promise<CreateAdminResult> {
  // A taken email is told before the re-check, so the code is not spent on a
  // form that cannot succeed. The unique email in the insert stays the guard.
  const taken = await getDb().select({ id: tables.admins.id }).from(tables.admins).where(eq(tables.admins.email, email));
  if (taken.length > 0) return { ok: false, error: "exists" };
  const reauth = await reauthenticateAdmin(actor.id, password, code);
  if (reauth !== "ok") return { ok: false, error: reauth };
  // A random password nobody knows: the account cannot be used until the
  // new admin sets their own through the invite link.
  const passwordHash = await hashPassword(randomToken());
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
    const token = await createEmailToken("admin_invite", "admin", row.id, tx);
    return { id: row.id, token };
  });
  if (!created) return { ok: false, error: "exists" };
  const mailed = await sendMail(
    adminInviteMail(email, actor.email, created.token, TOKEN_TTL_SECONDS.admin_invite / 3600),
  );
  return { ok: true, id: created.id, mailed };
}

// A new invite link for an admin who has not set a password yet (the first
// one expired or got lost). Only the newest link works. Journaled.
export async function resendAdminInvite(
  actor: Actor,
  adminId: string,
): Promise<"ok" | "not_found" | "not_waiting" | "rate_limited"> {
  if (!/^[0-9a-f-]{36}$/i.test(adminId)) return "not_found";
  // A few per hour for one admin: enough for a lost mail, not a mail flood.
  if (!(await hit(`invite-resend:admin:${adminId}`, LIMITS.inviteResendPerAdmin))) return "rate_limited";
  const admin = (await getDb().select().from(tables.admins).where(eq(tables.admins.id, adminId)))[0];
  if (!admin) return "not_found";
  if (!admin.passwordMustChange || admin.status !== "active") return "not_waiting";
  const token = await getDb().transaction(async (tx) => {
    await writeAudit(tx, actor, {
      action: "admin.invite_resend",
      targetType: "admin",
      targetId: adminId,
      details: { targetEmail: admin.email },
    });
    return createEmailToken("admin_invite", "admin", adminId, tx);
  });
  await sendMail(
    adminInviteMail(admin.email, actor.email, token, TOKEN_TTL_SECONDS.admin_invite / 3600),
  );
  return "ok";
}

// Email of the admin an invite link belongs to (to check the new password
// against it). Does not use the link.
export async function emailForAdminInviteToken(token: string): Promise<string | null> {
  const adminId = await usableTokenSubject(token, "admin_invite", "admin");
  if (!adminId) return null;
  const admin = (await getDb().select().from(tables.admins).where(eq(tables.admins.id, adminId)))[0];
  return admin?.email ?? null;
}

// The new admin sets their own password with the invite link (once). The
// account then works with that password and the 2FA set up at first login.
// Only while the admin has no own password yet and is active: an invite link
// can never replace a password the admin chose. If that does not hold, the
// transaction is rolled back (the link is not used up) and nothing changes.
export async function acceptAdminInvite(token: string, password: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  let adminId: string | null = null;
  try {
    await getDb().transaction(async (tx) => {
      adminId = await consumeEmailToken(token, "admin_invite", "admin", tx);
      if (!adminId) return tx.rollback();
      const [admin] = await tx
        .update(tables.admins)
        .set({ passwordHash, passwordMustChange: false })
        .where(
          and(
            eq(tables.admins.id, adminId),
            eq(tables.admins.passwordMustChange, true),
            eq(tables.admins.status, "active"),
          ),
        )
        .returning({ email: tables.admins.email });
      if (!admin) return tx.rollback();
      // The password itself never goes into the journal.
      await writeAudit(tx, { id: adminId, email: admin.email }, {
        action: "admin.password_change",
        targetType: "admin",
        targetId: adminId,
        details: { reason: "invite" },
      });
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) return false;
    throw error;
  }
  // Like a reset: no session from before the new password stays.
  if (adminId) await revokeAllSessions("admin", adminId);
  return true;
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
    // An invite link still waiting must not set another password later.
    await deleteUnusedTokens("admin_invite", "admin", actor.id, tx);
    await writeAudit(tx, actor, { action: "admin.password_change", targetType: "admin", targetId: actor.id });
  });
  await revokeOtherSessions("admin", actor.id);
  return "ok";
}
