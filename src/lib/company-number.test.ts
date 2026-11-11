import { describe, expect, it } from "vitest";
import {
  COUNTRY_CODES,
  countryOptions,
  formatCompanyNumber,
  isCountryCode,
  parseCompanyNumber,
  ruleFor,
} from "./company-number";

function ok(country: string, input: string) {
  const result = parseCompanyNumber(country, input);
  if (!result.ok) throw new Error(`${country} ${input}: ${result.message}`);
  return result.value;
}

function rejected(country: string, input: string) {
  return !parseCompanyNumber(country, input).ok;
}

describe("country list", () => {
  it("has unique two-letter codes, each with a Bulgarian name", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    const names = new Intl.DisplayNames(["bg"], { type: "region", fallback: "none" });
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(names.of(code), code).toBeTruthy();
    }
  });

  it("is sorted by name and includes Bulgaria, Germany and the US", () => {
    const options = countryOptions();
    expect(options.find((o) => o.code === "BG")?.name).toBe("България");
    const sorted = [...options].sort((a, b) => a.name.localeCompare(b.name, "bg"));
    expect(options).toEqual(sorted);
    expect(isCountryCode("US")).toBe(true);
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("bg")).toBe(false);
  });
});

describe("Bulgaria: EIK", () => {
  it("accepts 9 and 13 digits, with spaces or a BG prefix", () => {
    expect(ok("BG", "123456789")).toBe("123456789");
    expect(ok("BG", "1234567890123")).toBe("1234567890123");
    expect(ok("BG", " 123 456 789 ")).toBe("123456789");
    expect(ok("BG", "BG123456789")).toBe("123456789");
  });

  it.each(["", "12345678", "1234567890", "12345678901234", "12345678a"])("rejects %j", (v) => {
    expect(rejected("BG", v)).toBe(true);
  });
});

describe("EU: VAT numbers (VIES formats)", () => {
  it.each([
    ["AT", "U12345678", "ATU12345678"],
    ["BE", "0123456789", "BE0123456789"],
    ["BE", "1123456789", "BE1123456789"],
    ["CY", "12345678X", "CY12345678X"],
    ["CZ", "12345678", "CZ12345678"],
    ["CZ", "1234567890", "CZ1234567890"],
    ["DE", "123456789", "DE123456789"],
    ["DK", "12 34 56 78", "DK12345678"],
    ["EE", "123456789", "EE123456789"],
    ["GR", "123456789", "EL123456789"],
    ["ES", "A1234567B", "ESA1234567B"],
    ["ES", "12345678Z", "ES12345678Z"],
    ["ES", "X1234567T", "ESX1234567T"],
    ["FI", "12345678", "FI12345678"],
    ["FR", "AB 123456789", "FRAB123456789"],
    ["FR", "12345678901", "FR12345678901"],
    ["HR", "12345678901", "HR12345678901"],
    ["HU", "12345678", "HU12345678"],
    ["IE", "1234567T", "IE1234567T"],
    ["IE", "1234567WA", "IE1234567WA"],
    ["IE", "1A23456B", "IE1A23456B"],
    ["IT", "12345678901", "IT12345678901"],
    ["LT", "123456789", "LT123456789"],
    ["LT", "123456789012", "LT123456789012"],
    ["LU", "12345678", "LU12345678"],
    ["LV", "12345678901", "LV12345678901"],
    ["MT", "12345678", "MT12345678"],
    ["NL", "123456789B01", "NL123456789B01"],
    ["PL", "1234567890", "PL1234567890"],
    ["PT", "123456789", "PT123456789"],
    ["RO", "12", "RO12"],
    ["RO", "1234567890", "RO1234567890"],
    ["SE", "123456789012", "SE123456789012"],
    ["SI", "12345678", "SI12345678"],
    ["SK", "1234567890", "SK1234567890"],
  ])("%s %j is stored as %s", (country, input, stored) => {
    expect(ok(country, input)).toBe(stored);
    // The same number typed with its prefix gives the same result.
    expect(ok(country, stored)).toBe(stored);
  });

  it.each([
    ["AT", "12345678"], // the U is required
    ["BE", "2123456789"], // starts with 0 or 1
    ["CY", "123456789"], // ends with a letter
    ["CZ", "1234567"],
    ["DE", "12345678"],
    ["DE", "1234567890"],
    ["GR", "GR123456789"], // Greece uses EL, not GR
    ["ES", "123456789"], // first and last may not both be digits
    ["FR", "1234567890"],
    ["IE", "12345678"],
    ["NL", "123456789A01"], // the 10th character is B
    ["RO", "1"],
    ["RO", "12345678901"],
    ["SE", "12345678901"],
    ["DE", "DE12345678$"],
  ])("%s rejects %j", (country, input) => {
    expect(rejected(country, input)).toBe(true);
  });
});

describe("US: EIN", () => {
  it("accepts nine digits with or without the dash and shows them as XX-XXXXXXX", () => {
    expect(ok("US", "12-3456789")).toBe("123456789");
    expect(ok("US", "123456789")).toBe("123456789");
    expect(formatCompanyNumber("US", "123456789")).toBe("12-3456789");
  });

  it.each(["", "12-345678", "1234567890", "12-34567AB", "123-45-6789X"])("rejects %j", (v) => {
    expect(rejected("US", v)).toBe(true);
  });
});

describe("other countries: register number", () => {
  it("accepts letters and digits, without separators, in upper case", () => {
    expect(ruleFor("CH").kind).toBe("registration");
    expect(ok("CH", "che-123.456.789")).toBe("CHE123456789");
    expect(ok("JP", "12")).toBe("12");
  });

  it.each(["", "1", "x".repeat(31), "ABC_123", "Фирма123"])("rejects %j", (v) => {
    expect(rejected("CH", v)).toBe(true);
  });
});

describe("rules", () => {
  it("picks the field by country", () => {
    expect(ruleFor("BG")).toMatchObject({ kind: "eik", label: "ЕИК" });
    expect(ruleFor("DE")).toMatchObject({ kind: "vat", label: "ДДС номер" });
    expect(ruleFor("US").kind).toBe("ein");
    expect(ruleFor("GB").kind).toBe("registration");
  });

  it("explains the expected format in the error message", () => {
    const result = parseCompanyNumber("DE", "123");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("DE и 9 цифри");
  });
});
