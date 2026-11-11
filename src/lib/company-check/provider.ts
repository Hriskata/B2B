import "server-only";
import { getEnv } from "../env";
import { createCompanyBookVerifier } from "./companybook";
import type { CompanyVerifier } from "./types";

// The one place that picks the register. Null when no key is configured.
export function getCompanyVerifier(): CompanyVerifier | null {
  const key = getEnv().COMPANYBOOK_API_KEY;
  return key ? createCompanyBookVerifier(key) : null;
}
