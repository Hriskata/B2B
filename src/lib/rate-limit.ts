import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";

// Fixed-window counters kept in PostgreSQL, so limits hold across restarts and
// across several app instances without extra infrastructure.

export type Limit = { limit: number; windowSeconds: number };

// Counts one event for `key` and says whether it is still within the limit.
export async function hit(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const rows = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, reset_at)
    values (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    on conflict (key) do update set
      count = case when rate_limits.reset_at <= now() then 1 else rate_limits.count + 1 end,
      reset_at = case when rate_limits.reset_at <= now()
                      then now() + make_interval(secs => ${windowSeconds})
                      else rate_limits.reset_at end
    returning count
  `);
  return Number(rows[0]?.count ?? 0) <= limit;
}

// True when `key` has already used up its allowance (does not count an event).
export async function isLimited(key: string, limit: number): Promise<boolean> {
  const rows = await getDb()
    .select({ count: tables.rateLimits.count, resetAt: tables.rateLimits.resetAt })
    .from(tables.rateLimits)
    .where(eq(tables.rateLimits.key, key));
  const row = rows[0];
  return !!row && row.resetAt.getTime() > Date.now() && row.count >= limit;
}

export async function reset(key: string): Promise<void> {
  await getDb().delete(tables.rateLimits).where(eq(tables.rateLimits.key, key));
}

// Limits used by the auth flows. Numbers are proposals, to be confirmed.
export const LIMITS = {
  loginFailuresPerAccount: { limit: 5, windowSeconds: 15 * 60 },
  loginFailuresPerIp: { limit: 20, windowSeconds: 15 * 60 },
  mfaFailuresPerAdmin: { limit: 5, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 10, windowSeconds: 60 * 60 },
  registerPerEmail: { limit: 3, windowSeconds: 60 * 60 },
  resetRequestPerIp: { limit: 10, windowSeconds: 60 * 60 },
  resetRequestPerEmail: { limit: 3, windowSeconds: 60 * 60 },
} as const;
