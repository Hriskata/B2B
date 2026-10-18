// Amounts are stored as integer cents of a currency (EUR by default). The
// shown format (with or without VAT, wording) is an open decision.

export function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("bg-BG", { style: "currency", currency }).format(amountCents / 100);
}
