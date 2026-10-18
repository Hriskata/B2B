import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb, tables, type Db } from "@/db";
import { hashToken, randomToken } from "../crypto";

export type TokenPurpose = "verify_email" | "reset_password";
export type TokenSubject = "user" | "admin";

export const TOKEN_TTL_SECONDS: Record<TokenPurpose, number> = {
  verify_email: 24 * 60 * 60,
  reset_password: 60 * 60, // proposal in the checklist: up to 60 minutes
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Replaces any earlier unused token of the same kind for this account, so
// only the newest link works. Returns the raw token (sent by email, never
// stored).
export async function createEmailToken(
  purpose: TokenPurpose,
  subjectType: TokenSubject,
  subjectId: string,
  db: Db | Tx = getDb(),
): Promise<string> {
  await db
    .delete(tables.emailTokens)
    .where(
      and(
        eq(tables.emailTokens.purpose, purpose),
        eq(tables.emailTokens.subjectType, subjectType),
        eq(tables.emailTokens.subjectId, subjectId),
        isNull(tables.emailTokens.usedAt),
      ),
    );
  const token = randomToken();
  await db.insert(tables.emailTokens).values({
    tokenHash: hashToken(token),
    purpose,
    subjectType,
    subjectId,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS[purpose] * 1000),
  });
  return token;
}

// Expiry is compared with the database clock (sql now()): this check runs while
// a page renders, and Next.js does not allow reading JS time there.
// Read-only check, used to decide whether to show the form. Opening a link
// must not use it up (mail scanners open links), so consuming is separate.
export async function isEmailTokenUsable(
  token: string,
  purpose: TokenPurpose,
  subjectType: TokenSubject,
): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const rows = await getDb()
    .select({ tokenHash: tables.emailTokens.tokenHash })
    .from(tables.emailTokens)
    .where(
      and(
        eq(tables.emailTokens.tokenHash, hashToken(token)),
        eq(tables.emailTokens.purpose, purpose),
        eq(tables.emailTokens.subjectType, subjectType),
        isNull(tables.emailTokens.usedAt),
        gt(tables.emailTokens.expiresAt, sql`now()`),
      ),
    );
  return rows.length === 1;
}

// Single atomic UPDATE: of two concurrent requests only one gets the row.
export async function consumeEmailToken(
  token: string,
  purpose: TokenPurpose,
  subjectType: TokenSubject,
  db: Db | Tx = getDb(),
): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const rows = await db
    .update(tables.emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(tables.emailTokens.tokenHash, hashToken(token)),
        eq(tables.emailTokens.purpose, purpose),
        eq(tables.emailTokens.subjectType, subjectType),
        isNull(tables.emailTokens.usedAt),
        gt(tables.emailTokens.expiresAt, sql`now()`),
      ),
    )
    .returning({ subjectId: tables.emailTokens.subjectId });
  return rows[0]?.subjectId ?? null;
}
