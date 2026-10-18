import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, tables } from "@/db";
import { hashToken, randomToken } from "../crypto";
import { isSecureOrigin } from "../env";

export type SessionKind = "user" | "admin";
export type SessionStage = "full" | "mfa_verify" | "mfa_setup";

// Lifetimes are proposals: customers 7 days, admins 8 hours (shorter, as the
// checklist asks), and 10 minutes for the step between password and 2FA.
const TTL_SECONDS = {
  user: 7 * 24 * 60 * 60,
  adminFull: 8 * 60 * 60,
  adminMfa: 10 * 60,
} as const;

const BASE_NAME: Record<SessionKind, string> = {
  user: "b2b_session",
  admin: "b2b_admin_session",
};

// The __Host- prefix makes browsers reject cookies that are not Secure,
// path "/" and host-only. It needs HTTPS, so it is used when APP_URL is https.
function cookieName(kind: SessionKind): string {
  return isSecureOrigin() ? `__Host-${BASE_NAME[kind]}` : BASE_NAME[kind];
}

function ttlFor(kind: SessionKind, stage: SessionStage): number {
  if (kind === "user") return TTL_SECONDS.user;
  return stage === "full" ? TTL_SECONDS.adminFull : TTL_SECONDS.adminMfa;
}

export type ActiveSession = {
  tokenHash: string;
  subjectId: string;
  stage: SessionStage;
};

export async function readSession(kind: SessionKind): Promise<ActiveSession | null> {
  const value = (await cookies()).get(cookieName(kind))?.value;
  if (!value) return null;
  const tokenHash = hashToken(value);
  const rows = await getDb()
    .select({
      tokenHash: tables.sessions.tokenHash,
      subjectId: tables.sessions.subjectId,
      stage: tables.sessions.stage,
    })
    .from(tables.sessions)
    .where(
      and(
        eq(tables.sessions.tokenHash, tokenHash),
        eq(tables.sessions.subjectType, kind),
        // Database clock: pages call this while rendering, where JS time is not allowed.
        gt(tables.sessions.expiresAt, sql`now()`),
      ),
    );
  return rows[0] ?? null;
}

// Always issues a fresh random value (the session id changes at every login
// and at every stage change) and drops the session the browser presented.
export async function createSession(
  kind: SessionKind,
  subjectId: string,
  stage: SessionStage = "full",
): Promise<void> {
  const jar = await cookies();
  const name = cookieName(kind);
  const previous = jar.get(name)?.value;
  if (previous) {
    await getDb()
      .delete(tables.sessions)
      .where(eq(tables.sessions.tokenHash, hashToken(previous)));
  }

  const ttl = ttlFor(kind, stage);
  const token = randomToken();
  await getDb()
    .insert(tables.sessions)
    .values({
      tokenHash: hashToken(token),
      subjectType: kind,
      subjectId,
      stage,
      expiresAt: new Date(Date.now() + ttl * 1000),
    });

  jar.set(name, token, {
    httpOnly: true,
    secure: isSecureOrigin(),
    sameSite: kind === "admin" ? "strict" : "lax",
    path: "/",
    maxAge: ttl,
  });
}

export async function destroySession(kind: SessionKind): Promise<void> {
  const jar = await cookies();
  const name = cookieName(kind);
  const value = jar.get(name)?.value;
  if (value) {
    await getDb()
      .delete(tables.sessions)
      .where(eq(tables.sessions.tokenHash, hashToken(value)));
  }
  jar.delete(name);
}

// Used on password change/reset, 2FA reset and blocking (checklist B).
export async function revokeAllSessions(kind: SessionKind, subjectId: string): Promise<void> {
  await getDb()
    .delete(tables.sessions)
    .where(and(eq(tables.sessions.subjectType, kind), eq(tables.sessions.subjectId, subjectId)));
}
