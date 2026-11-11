import "server-only";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { getCompanyVerifier } from "./provider";
import { classifyStatus } from "./status";
import type { CompanyCheck, CompanyVerifier, RegistryAnswer } from "./types";

export type { CompanyCheck } from "./types";

// Up to 3 attempts in all, each with a time limit and a short pause between
// them (CLAUDE.md). At most about 3 x 3 s + 2 x 0.5 s = 10 s for the customer.
export const CHECK_LIMITS = { attempts: 3, timeoutMs: 3000, pauseMs: 500 };

// How long a register answer is reused (proposal): a found company for a day,
// "no such company" for an hour, so a corrected registration is not stuck.
const CACHE_TTL_MS = { found: 24 * 60 * 60 * 1000, notFound: 60 * 60 * 1000 };

function toCheck(provider: string, answer: RegistryAnswer): CompanyCheck {
  if (!answer.found) return { kind: "not_found" };
  return {
    kind: classifyStatus(provider, answer.status),
    status: answer.status,
    name: answer.name,
  };
}

async function readCache(eik: string, provider: string): Promise<RegistryAnswer | null> {
  const row = (
    await getDb().select().from(tables.companyCheckCache).where(eq(tables.companyCheckCache.eik, eik))
  )[0];
  if (!row || row.provider !== provider) return null;
  const ttl = row.found ? CACHE_TTL_MS.found : CACHE_TTL_MS.notFound;
  if (Date.now() - row.checkedAt.getTime() > ttl) return null;
  return row.found ? { found: true, status: row.status, name: row.name } : { found: false };
}

async function writeCache(eik: string, provider: string, answer: RegistryAnswer): Promise<void> {
  const values = {
    provider,
    found: answer.found,
    status: answer.found ? answer.status : null,
    name: answer.found ? answer.name : null,
    checkedAt: new Date(),
  };
  await getDb()
    .insert(tables.companyCheckCache)
    .values({ eik, ...values })
    .onConflictDoUpdate({ target: tables.companyCheckCache.eik, set: values });
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Checks a Bulgarian EIK: does the company exist, and is it active. Never
// throws: a register that does not answer gives "unavailable", and the
// registration then goes to manual review.
export async function checkCompany(
  eik: string,
  verifier: CompanyVerifier | null = getCompanyVerifier(),
  limits = CHECK_LIMITS,
): Promise<CompanyCheck> {
  if (!verifier) return { kind: "unavailable" };

  const cached = await readCache(eik, verifier.provider);
  if (cached) return toCheck(verifier.provider, cached);

  for (let attempt = 1; attempt <= limits.attempts; attempt++) {
    try {
      const answer = await verifier.lookup(eik, AbortSignal.timeout(limits.timeoutMs));
      await writeCache(eik, verifier.provider, answer);
      return toCheck(verifier.provider, answer);
    } catch {
      // No details: they may contain the request. Only the fact is logged.
      console.error(`Company register: attempt ${attempt} of ${limits.attempts} failed`);
      if (attempt < limits.attempts) await pause(limits.pauseMs);
    }
  }
  return { kind: "unavailable" };
}
