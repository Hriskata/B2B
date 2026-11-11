import { z } from "zod";
import { RegisterHttpError, type CompanyVerifier, type RegistryAnswer } from "./types";

// COMPANYBOOK.BG, from its public documentation (docs/Bulstat.txt):
// GET https://api.companybook.bg/api/companies/:uic, key in X-API-Key, answer
// with uic, name, legalForm, status. NOT tried with a real key yet.

const BASE_URL = "https://api.companybook.bg";

// Whether a 404 really means "no such company" is not confirmed yet: a wrong
// address or a register that lacks some numbers (branches, BULSTAT-only
// entities, a company registered today) would answer the same. Until the test
// with real companies confirms it, a 404 sends the registration to manual
// review instead of refusing the customer. Set to true only after that test.
export const NOT_FOUND_CONFIRMED = false;

const answerSchema = z.object({
  uic: z.union([z.string(), z.number()]).nullish(),
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
        // A redirect would carry the X-API-Key header to another host.
        redirect: "error",
      });
      if (res.status === 404) return { found: false, certain: NOT_FOUND_CONFIRMED };
      if (!res.ok) throw new RegisterHttpError(res.status);
      const parsed = answerSchema.safeParse(await res.json());
      if (!parsed.success) throw new Error("Company register gave an unexpected answer");
      const { uic, name, status } = parsed.data;
      // An answer for another number, or with neither a name nor a status,
      // is not a usable "found".
      const sameNumber = uic === null || uic === undefined || String(uic).replace(/^BG/i, "") === eik;
      if (!sameNumber || (!name && (status === null || status === undefined))) {
        throw new Error("Company register gave an unexpected answer");
      }
      return {
        found: true,
        name: name ?? null,
        status: status === null || status === undefined ? null : String(status),
      };
    },
  };
}
