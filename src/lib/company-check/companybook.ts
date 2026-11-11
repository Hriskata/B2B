import { z } from "zod";
import type { CompanyVerifier, RegistryAnswer } from "./types";

// COMPANYBOOK.BG, from its public documentation (docs/Bulstat.txt):
// GET https://api.companybook.bg/api/companies/:uic, key in X-API-Key, answer
// with uic, name, legalForm, status. NOT tried with a real key yet: what a
// missing company returns (taken as 404 here) and what the status codes mean
// must be confirmed with real companies before the key goes live.

const BASE_URL = "https://api.companybook.bg";

const answerSchema = z.object({
  name: z.string().nullish(),
  status: z.union([z.string(), z.number()]).nullish(),
});

export function createCompanyBookVerifier(apiKey: string, baseUrl = BASE_URL): CompanyVerifier {
  return {
    provider: "companybook",
    async lookup(eik: string, signal: AbortSignal): Promise<RegistryAnswer> {
      const res = await fetch(`${baseUrl}/api/companies/${encodeURIComponent(eik)}`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
        signal,
        cache: "no-store",
      });
      if (res.status === 404) return { found: false };
      // The key and the body are never put into the error (it may be logged).
      if (!res.ok) throw new Error(`Company register answered ${res.status}`);
      const parsed = answerSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Company register gave an unexpected answer");
      const { name, status } = parsed.data;
      return {
        found: true,
        name: name ?? null,
        status: status === null || status === undefined ? null : String(status),
      };
    },
  };
}
