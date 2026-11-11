// What each register status code means. Filled ONLY from a test with real
// companies (active, in liquidation, deleted, insolvent; docs/PLAN.md phase 0):
// the meaning of the CompanyBook codes is not documented clearly enough to
// guess. Until then every found company is "unknown" and goes to manual
// review, so nobody is approved or refused because of a guess.
const STATUS_MEANING: Record<string, Record<string, "active" | "inactive">> = {
  companybook: {},
  // The fake register of the tests (src/test/company-register.ts).
  test: { ACTIVE: "active", INACTIVE: "inactive" },
};

export function classifyStatus(
  provider: string,
  status: string | null,
): "active" | "inactive" | "unknown" {
  if (status === null) return "unknown";
  const table = STATUS_MEANING[provider];
  return (table && Object.hasOwn(table, status) ? table[status] : undefined) ?? "unknown";
}
