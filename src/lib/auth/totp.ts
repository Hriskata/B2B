import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { NobleCryptoPlugin, ScureBase32Plugin, TOTP, generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import { getDb, tables } from "@/db";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCode,
  hashRecoveryCode,
} from "../crypto";
import { hit, isLimited, LIMITS, reset } from "../rate-limit";

const ISSUER = "ODFFiber";
const RECOVERY_CODE_COUNT = 10;
// Accept the previous/next 30-second step to tolerate small clock drift.
const TIME_TOLERANCE_SECONDS = 30;

// The TOTP class has no default plugins (only the functional API does), so the
// audited ones are passed explicitly.
const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

// Wraps otplib so callers get the time step of an accepted code.
async function checkCode(
  secret: string,
  token: string,
  afterTimeStep?: number,
): Promise<{ valid: false } | { valid: true; timeStep: number }> {
  const result = await totp.verify(token, {
    secret,
    epochTolerance: TIME_TOLERANCE_SECONDS,
    ...(afterTimeStep === undefined ? {} : { afterTimeStep }),
  });
  return result.valid ? { valid: true, timeStep: result.timeStep } : { valid: false };
}

const mfaKey = (adminId: string) => `mfa:admin:${adminId}`;

async function getAdmin(adminId: string) {
  return (await getDb().select().from(tables.admins).where(eq(tables.admins.id, adminId)))[0];
}

// Creates (once) and returns the secret to show as QR code and text. The
// secret is stored encrypted; 2FA is not active until a code is confirmed.
export async function beginTotpSetup(
  adminId: string,
): Promise<{ secret: string; qrDataUrl: string } | null> {
  const admin = await getAdmin(adminId);
  if (!admin || admin.totpEnabledAt) return null;

  if (!admin.totpSecretEnc) {
    await getDb()
      .update(tables.admins)
      .set({ totpSecretEnc: encryptSecret(generateSecret()) })
      .where(and(eq(tables.admins.id, adminId), isNull(tables.admins.totpSecretEnc)));
  }
  const fresh = await getAdmin(adminId);
  if (!fresh?.totpSecretEnc) return null;

  const secret = decryptSecret(fresh.totpSecretEnc);
  const uri = generateURI({ issuer: ISSUER, label: admin.email, secret });
  return { secret, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

export type SetupResult =
  | { status: "ok"; recoveryCodes: string[] }
  | { status: "invalid" | "rate_limited" };

export async function completeTotpSetup(adminId: string, code: string): Promise<SetupResult> {
  const key = mfaKey(adminId);
  if (await isLimited(key, LIMITS.mfaFailuresPerAdmin.limit)) return { status: "rate_limited" };

  const admin = await getAdmin(adminId);
  if (!admin?.totpSecretEnc || admin.totpEnabledAt) return { status: "invalid" };

  const result = await checkCode(decryptSecret(admin.totpSecretEnc), code.replace(/\s/g, ""));
  if (!result.valid) {
    await hit(key, LIMITS.mfaFailuresPerAdmin);
    return { status: "invalid" };
  }

  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  await getDb().transaction(async (tx) => {
    await tx
      .update(tables.admins)
      .set({ totpEnabledAt: new Date(), totpLastStep: result.timeStep })
      .where(and(eq(tables.admins.id, adminId), isNull(tables.admins.totpEnabledAt)));
    await tx
      .delete(tables.adminRecoveryCodes)
      .where(eq(tables.adminRecoveryCodes.adminId, adminId));
    await tx
      .insert(tables.adminRecoveryCodes)
      .values(codes.map((c) => ({ adminId, codeHash: hashRecoveryCode(c) })));
  });
  await reset(key);
  return { status: "ok", recoveryCodes: codes };
}

export type SecondFactorResult = "ok" | "invalid" | "rate_limited";

// Accepts a 6-digit authenticator code or a one-time recovery code.
export async function verifySecondFactor(
  adminId: string,
  input: string,
): Promise<SecondFactorResult> {
  const key = mfaKey(adminId);
  if (await isLimited(key, LIMITS.mfaFailuresPerAdmin.limit)) return "rate_limited";

  const admin = await getAdmin(adminId);
  const code = input.trim();
  let ok = false;

  if (admin?.totpSecretEnc && admin.totpEnabledAt && code.length > 0 && code.length <= 64) {
    if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
      const result = await checkCode(
        decryptSecret(admin.totpSecretEnc),
        code.replace(/\s/g, ""),
        admin.totpLastStep ?? undefined,
      );
      if (result.valid) {
        // Conditional update: a code (time step) can be accepted only once,
        // even if two requests race.
        const claimed = await getDb()
          .update(tables.admins)
          .set({ totpLastStep: result.timeStep })
          .where(
            and(
              eq(tables.admins.id, adminId),
              or(isNull(tables.admins.totpLastStep), lt(tables.admins.totpLastStep, result.timeStep)),
            ),
          )
          .returning({ id: tables.admins.id });
        ok = claimed.length === 1;
      }
    } else {
      const used = await getDb()
        .update(tables.adminRecoveryCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(tables.adminRecoveryCodes.adminId, adminId),
            eq(tables.adminRecoveryCodes.codeHash, hashRecoveryCode(code)),
            isNull(tables.adminRecoveryCodes.usedAt),
          ),
        )
        .returning({ id: tables.adminRecoveryCodes.id });
      ok = used.length === 1;
    }
  }

  if (!ok) {
    await hit(key, LIMITS.mfaFailuresPerAdmin);
    return "invalid";
  }
  await reset(key);
  return "ok";
}
