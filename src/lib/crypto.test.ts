import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCode,
  hashRecoveryCode,
  hashToken,
  normalizeRecoveryCode,
  randomToken,
  safeEqual,
} from "./crypto";

describe("tokens", () => {
  it("are long, URL-safe and different every time", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it("hash deterministically and never equal the token", () => {
    const t = randomToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("safeEqual compares values of any length", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("secret encryption", () => {
  it("round-trips and does not store the plain text", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("uses a fresh IV each time", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("rejects tampered data", () => {
    const raw = Buffer.from(encryptSecret("secret-value"), "base64");
    raw[raw.length - 1] ^= 1;
    expect(() => decryptSecret(raw.toString("base64"))).toThrow();
  });
});

describe("recovery codes", () => {
  it("look like xxxx-xxxx-xxxx-xxxx and are unique", () => {
    const codes = new Set(Array.from({ length: 200 }, generateRecoveryCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);
  });

  it("ignore case, spaces and dashes when hashed", () => {
    expect(normalizeRecoveryCode("ABCD-efgh 2345-JKMN")).toBe("abcdefgh2345jkmn");
    expect(hashRecoveryCode("ABCD-efgh-2345-jkmn")).toBe(hashRecoveryCode("abcdefgh2345jkmn"));
  });
});
