// What each register status code means. Filled ONLY from a test with real
// companies (active, in liquidation, deleted, insolvent; docs/PLAN.md phase 0):
// the meaning of the CompanyBook codes is not documented clearly enough to
// guess. Until then every found company is "unknown" and goes to manual
// review, so nobody is approved or refused because of a guess.
const STATUS_MEANING = new Map<string, ReadonlyMap<string, "active" | "inactive">>([
  ["companybook", new Map()],
  // The fake register of the tests (src/test/company-register.ts).
  [
    "test",
    new Map([
      ["ACTIVE", "active"],
      ["INACTIVE", "inactive"],
    ]),
  ],
]);

export function classifyStatus(
  provider: string,
  status: string | null,
): "active" | "inactive" | "unknown" {
  if (status === null) return "unknown";
  return STATUS_MEANING.get(provider)?.get(status) ?? "unknown";
}
