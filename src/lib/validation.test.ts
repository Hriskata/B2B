import { describe, expect, it } from "vitest";
import { companyNameSchema, eikSchema, emailSchema, normalizeEmail } from "./validation";

describe("eikSchema", () => {
  it("accepts 9 and 13 digit values", () => {
    expect(eikSchema.parse("123456789")).toBe("123456789");
    expect(eikSchema.parse("1234567890123")).toBe("1234567890123");
  });

  it("removes spaces", () => {
    expect(eikSchema.parse(" 123 456 789 ")).toBe("123456789");
  });

  it.each(["", "12345678", "1234567890", "12345678901234", "12345678a", "BG123456789", "1234567.9"])(
    "rejects %j",
    (value) => {
      expect(eikSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("emailSchema", () => {
  it("trims and lower-cases", () => {
    expect(emailSchema.parse("  Ivan@Firma.BG ")).toBe("ivan@firma.bg");
    expect(normalizeEmail(" A@B.bg ")).toBe("a@b.bg");
  });

  it.each(["", "no-at-sign", "a@", "@b.bg", "a b@c.bg", `${"a".repeat(250)}@b.bg`])(
    "rejects %j",
    (value) => {
      expect(emailSchema.safeParse(value).success).toBe(false);
    },
  );

  it("rejects line breaks (mail header injection)", () => {
    expect(emailSchema.safeParse("a@b.bg\r\nBcc: x@y.bg").success).toBe(false);
  });
});

describe("companyNameSchema", () => {
  it("accepts a normal name and trims it", () => {
    expect(companyNameSchema.parse("  Фирма ЕООД ")).toBe("Фирма ЕООД");
  });

  it("rejects empty, too long and control characters", () => {
    expect(companyNameSchema.safeParse(" ").success).toBe(false);
    expect(companyNameSchema.safeParse("x".repeat(201)).success).toBe(false);
    expect(companyNameSchema.safeParse("Фирма\nЕООД").success).toBe(false);
  });
});
