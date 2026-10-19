// Amounts are stored as integer cents of a currency (EUR by default). The
// shown format (with or without VAT, wording) is an open decision.

export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(amountCents / 100);
}

export const MAX_PRICE_CENTS = 999_999_999; // 9 999 999,99

// Parses what an admin types ("12,50", "12.5", "12", "") into integer cents.
// Empty means "no price". Returns "invalid" for anything else, and for zero.
export function parsePriceToCents(input: string): number | null | "invalid" {
  const text = input.trim().replace(/\s/g, "");
  if (text === "") return null;
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match) return "invalid";
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return cents > 0 && cents <= MAX_PRICE_CENTS ? cents : "invalid";
}

// For form fields: 1250 -> "12,50".
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
