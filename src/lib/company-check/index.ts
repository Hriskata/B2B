import "server-only";
import { eq } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { getCompanyVerifier } from "./provider";
import { classifyStatus } from "./status";
import { RegisterHttpError, type CompanyCheck, type CompanyVerifier, type RegistryAnswer } from "./types";

export type { CompanyCheck } from "./types";

// Up to 3 attempts in all, each with a time limit and a short pause between
// them (CLAUDE.md). At most about 3 x 3 s + 2 x 0.5 s = 10 s for the customer.
export const CHECK_LIMITS = { attempts: 3, timeoutMs: 3000, pauseMs: 500 };

// How long a register answer is reused (proposal): a found company for a day,
// "no such company" for an hour, so a corrected registration is not stuck.
// Old rows are removed by the cleanup (src/lib/cleanup.ts).
export const CACHE_TTL_MS = { found: 24 * 60 * 60 * 1000, notFound: 60 * 60 * 1000 };

function toCheck(provider: string, answer: RegistryAnswer): CompanyCheck {
  if (!answer.found) return { kind: answer.certain ? "not_found" : "not_confirmed" };
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
  return row.found
    ? { found: true, status: row.status, name: row.name }
    : { found: false, certain: true };
}

// Only definite answers are kept: an unconfirmed "not found" is asked again.
async function writeCache(eik: string, provider: string, answer: RegistryAnswer): Promise<void> {
  if (!answer.found && !answer.certain) return;
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

// A client error (wrong or revoked key, daily limit used up) will not get
// better within seconds: retrying would only use more of the limit.
function worthRetrying(error: unknown): boolean {
  return !(
    error instanceof RegisterHttpError &&
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408
  );
}

// What is logged about a failed attempt: the HTTP status or the error kind,
// never the EIK, the URL, the headers or the body.
function failureKind(error: unknown): string {
  if (error instanceof RegisterHttpError) return `HTTP ${error.status}`;
  return error instanceof Error ? error.name : "unknown error";
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Checks a Bulgarian EIK: does the company exist, and is it active. Does not
// throw: a register that does not answer gives "unavailable" (manual review),
// and a broken cache only means the register is asked.
export async function checkCompany(
  eik: string,
  verifier: CompanyVerifier | null = getCompanyVerifier(),
  limits = CHECK_LIMITS,
): Promise<CompanyCheck> {
  if (!verifier) return { kind: "unavailable" };

  const cached = await readCache(eik, verifier.provider).catch(() => null);
  if (cached) return toCheck(verifier.provider, cached);

  for (let attempt = 1; attempt <= limits.attempts; attempt++) {
    let answer: RegistryAnswer;
    try {
      answer = await verifier.lookup(eik, AbortSignal.timeout(limits.timeoutMs));
    } catch (error) {
      console.error(
        `Company register: attempt ${attempt} of ${limits.attempts} failed (${failureKind(error)})`,
      );
      if (!worthRetrying(error)) break;
      if (attempt < limits.attempts) await pause(limits.pauseMs);
      continue;
    }
    // A good answer is used even if it cannot be kept in the cache.
    await writeCache(eik, verifier.provider, answer).catch(() =>
      console.error("Company register: the answer could not be cached"),
    );
    return toCheck(verifier.provider, answer);
  }
  return { kind: "unavailable" };
}
