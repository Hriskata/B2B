import { and, isNotNull, lt, or, sql } from "drizzle-orm";
import { companyCheckCache, rateLimits, emailTokens, sessions } from "@/db/schema";
import type { Db } from "@/db/create";

// Removes rows that can no longer matter: expired sessions, rate-limit
// windows that have ended, and email tokens that were used or expired more
// than a week ago (kept briefly so a user who clicks a stale link is not
// confused by the cleanup), and company register answers older than a day
// (no longer used; they may hold a sole trader's name). Nothing else is touched: customers, admins,
// products and the journal are never deleted here.
//
// No `server-only` import: the script scripts/cleanup.ts runs it with tsx.
// To be run regularly (for example daily) once there is a host (phase 7).
export const TOKEN_GRACE = "7 days";

export type CleanupResult = {
  sessions: number;
  rateLimits: number;
  emailTokens: number;
  companyChecks: number;
};

export async function cleanupExpired(db: Db): Promise<CleanupResult> {
  const grace = sql.raw(`interval '${TOKEN_GRACE}'`);
  const oldSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, sql`now()`))
    .returning({ id: sessions.tokenHash });
  const oldWindows = await db
    .delete(rateLimits)
    .where(lt(rateLimits.resetAt, sql`now()`))
    .returning({ key: rateLimits.key });
  const oldTokens = await db
    .delete(emailTokens)
    .where(
      or(
        lt(emailTokens.expiresAt, sql`now() - ${grace}`),
        and(isNotNull(emailTokens.usedAt), lt(emailTokens.usedAt, sql`now() - ${grace}`)),
      ),
    )
    .returning({ id: emailTokens.tokenHash });
  // Longest reuse time of an answer: 24 hours (src/lib/company-check).
  const oldChecks = await db
    .delete(companyCheckCache)
    .where(lt(companyCheckCache.checkedAt, sql`now() - interval '24 hours'`))
    .returning({ eik: companyCheckCache.eik });
  return {
    sessions: oldSessions.length,
    rateLimits: oldWindows.length,
    emailTokens: oldTokens.length,
    companyChecks: oldChecks.length,
  };
}
