import { describe, expect, it } from "vitest";
import { validatePassword } from "./password-policy";

describe("validatePassword", () => {
  it("accepts 8+ chars with upper case, lower case and a digit", () => {
    expect(validatePassword("Zdravej7x").ok).toBe(true);
    expect(validatePassword("Aa1xxxxx").ok).toBe(true);
  });

  it("accepts Cyrillic letters as upper/lower case", () => {
    expect(validatePassword("Парола-1Ж").ok).toBe(true);
  });

  it.each([
    ["too short", "Aa1xxxx"],
    ["no digit", "Abcdefghi"],
    ["no upper case", "abcdefg1h"],
    ["no lower case", "ABCDEFG1H"],
    ["empty", ""],
  ])("rejects a password that is %s", (_name, password) => {
    expect(validatePassword(password).ok).toBe(false);
  });

  it("rejects passwords longer than 128 characters", () => {
    expect(validatePassword("Aa1" + "x".repeat(126)).ok).toBe(false);
    expect(validatePassword("Aa1" + "x".repeat(125)).ok).toBe(true);
  });

  it("rejects common passwords that meet the character rules", () => {
    expect(validatePassword("Password1").ok).toBe(false);
    expect(validatePassword("QWERTY123").ok).toBe(false);
  });

  it("rejects a password containing the local part of the email", () => {
    expect(validatePassword("Ivanov2024x", { email: "ivanov@firma.bg" }).ok).toBe(false);
    expect(validatePassword("Ivanov2024x", { email: "other@firma.bg" }).ok).toBe(true);
  });
});
