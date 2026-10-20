import { NobleCryptoPlugin, ScureBase32Plugin, TOTP, generateSecret } from "otplib";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { encryptSecret, generateRecoveryCode, hashRecoveryCode } from "@/lib/crypto";
import { hashPassword } from "@/lib/password";
import { cookieJar } from "./next-mocks";

export const PASSWORD = "Zdravej7x";

export function fd(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

export async function createUser(
  overrides: Partial<{
    email: string;
    password: string;
    status: "unverified" | "active" | "blocked";
    eik: string;
    companyName: string;
  }> = {},
) {
  const db = getDb();
  const eik = overrides.eik ?? "123456789";
  await db
    .insert(tables.companies)
    .values({ eik, name: overrides.companyName ?? "Тест ЕООД" })
    .onConflictDoNothing();
  const company = (await db.select().from(tables.companies).where(eq(tables.companies.eik, eik)))[0];
  const email = overrides.email ?? "client@firma.bg";
  const status = overrides.status ?? "active";
  const [user] = await db
    .insert(tables.users)
    .values({
      companyId: company.id,
      email,
      passwordHash: await hashPassword(overrides.password ?? PASSWORD),
      status,
      emailVerifiedAt: status === "unverified" ? null : new Date(),
    })
    .returning();
  return user;
}

const totp = new TOTP({ crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() });

export async function codeFor(secret: string, epoch?: number): Promise<string> {
  return totp.generate({ secret, ...(epoch === undefined ? {} : { epoch }) });
}

export async function createAdmin(
  overrides: Partial<{
    email: string;
    password: string;
    role: "viewer" | "editor";
    status: "active" | "blocked";
    withTotp: boolean;
    passwordMustChange: boolean;
  }> = {},
) {
  const secret = generateSecret();
  const withTotp = overrides.withTotp ?? true;
  const recoveryCodes = Array.from({ length: 3 }, generateRecoveryCode);
  const [admin] = await getDb()
    .insert(tables.admins)
    .values({
      email: overrides.email ?? "admin@firma.bg",
      passwordHash: await hashPassword(overrides.password ?? PASSWORD),
      role: overrides.role ?? "editor",
      status: overrides.status ?? "active",
      totpSecretEnc: withTotp ? encryptSecret(secret) : null,
      totpEnabledAt: withTotp ? new Date() : null,
      passwordMustChange: overrides.passwordMustChange ?? false,
    })
    .returning();
  if (withTotp) {
    await getDb()
      .insert(tables.adminRecoveryCodes)
      .values(recoveryCodes.map((c) => ({ adminId: admin.id, codeHash: hashRecoveryCode(c) })));
  }
  return { admin, secret, recoveryCodes };
}

// A different browser: no cookies. Returns the old jar so it can be restored.
export function switchBrowser(): Map<string, { value: string; options?: Record<string, unknown> }> {
  const saved = new Map(cookieJar);
  cookieJar.clear();
  return saved;
}

export function restoreBrowser(
  saved: Map<string, { value: string; options?: Record<string, unknown> }>,
) {
  cookieJar.clear();
  for (const [k, v] of saved) cookieJar.set(k, v);
}
