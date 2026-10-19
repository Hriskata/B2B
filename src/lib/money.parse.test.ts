import { describe, expect, it } from "vitest";
import { centsToInput, parsePriceToCents } from "./money";

describe("parsePriceToCents", () => {
  it.each([
    ["12,50", 1250],
    ["12.50", 1250],
    ["12", 1200],
    ["12,5", 1250],
    ["0,01", 1],
    [" 1 250,00 ", 125000],
    ["9999999,99", 999999999],
  ])("parses %j as %i cents", (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it("treats an empty field as 'no price'", () => {
    expect(parsePriceToCents("")).toBeNull();
    expect(parsePriceToCents("   ")).toBeNull();
  });

  it.each(["0", "0,00", "-5", "abc", "12,345", "12,", ",50", "1e3", "10000000", "12 лв", "12;5", "1.234,56"])(
    "rejects %j",
    (input) => {
      expect(parsePriceToCents(input)).toBe("invalid");
    },
  );

  it("round-trips through centsToInput", () => {
    expect(centsToInput(1250)).toBe("12,50");
    expect(parsePriceToCents(centsToInput(98765))).toBe(98765);
  });
});
