import { describe, expect, it } from "vitest";
import {
  companyNameSchema,
  emailSchema,
  fullNameSchema,
  normalizeEmail,
} from "./validation";

describe("fullNameSchema", () => {
  it("trims the name", () => {
    expect(fullNameSchema.parse("  Иван Петров ")).toBe("Иван Петров");
  });

  it.each(["", " ", "И", "Иван\nПетров", "x".repeat(121)])("rejects %j", (value) => {
    expect(fullNameSchema.safeParse(value).success).toBe(false);
  });
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
