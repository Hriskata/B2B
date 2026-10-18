import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { getEnv } from "./env";

// Random value for cookies and email links: 256 bits, URL-safe.
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// Tokens are high-entropy random values, so a fast hash is enough to keep
// the database from holding anything that could be replayed.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Recovery codes: 16 chars from a 32-letter alphabet (80 bits), shown as
// xxxx-xxxx-xxxx-xxxx.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRecoveryCode(): string {
  const chars = Array.from({ length: 16 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]);
  return [0, 4, 8, 12].map((i) => chars.slice(i, i + 4).join("")).join("-");
}

export function normalizeRecoveryCode(input: string): string {
  return input.toLowerCase().replace(/[\s-]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return hashToken(normalizeRecoveryCode(code));
}

// AES-256-GCM from node:crypto (a vetted primitive, not hand-rolled crypto).
// Layout: base64(iv[12] | authTag[16] | ciphertext).
function key(): Buffer {
  return Buffer.from(getEnv().TOTP_ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const raw = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
