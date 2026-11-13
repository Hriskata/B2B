import type { CompanyCheck } from "./types";

// What a register answer writes into the company row.
export function registryFields(check: CompanyCheck) {
  const found = check.kind === "active" || check.kind === "inactive" || check.kind === "unknown";
  return {
    registryState: check.kind,
    registryStatus: found ? check.status : null,
    registryName: found ? check.name : null,
    registryCheckedAt: new Date(),
  };
}

// A register that did not answer (or an unconfirmed "not found") must not
// wipe an earlier real answer that admins may still be looking at.
export function isRealAnswer(check: CompanyCheck): boolean {
  return check.kind !== "unavailable" && check.kind !== "not_confirmed";
}
