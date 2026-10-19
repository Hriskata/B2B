import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";
import { revokeAllSessions } from "../auth/session";
import { verifySecondFactor } from "../auth/totp";
import { getEnv } from "../env";
import { sendMail } from "../mail/send";
import { twoFactorResetMail } from "../mail/templates";
import { verifyPassword } from "../password";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";

export async function listAdmins() {
  return getDb()
    .select({
      id: tables.admins.id,
      email: tables.admins.email,
      role: tables.admins.role,
      status: tables.admins.status,
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
