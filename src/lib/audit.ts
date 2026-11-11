import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, tables, type Db } from "@/db";
import { getEnv } from "./env";
import { isLocalAppUrl } from "./local-url";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AuditAction =
  | "product.create"
  | "product.update"
  | "price.change"
  | "user.block"
  | "user.unblock"
  | "company.block"
  | "company.unblock"
  | "admin.2fa_reset"
  | "admin.create"
  | "admin.invite_resend"
  | "admin.password_change"
  | "registration.approve"
  | "registration.reject";

type Details = Record<string, string | number | boolean | null>;

export type Actor = { id: string; email: string };

const MAX_TEXT = 300;

// Details hold ids, names and numbers only. Passwords, tokens, codes and
// secrets must never be passed in. Long text is cut so one entry stays small.
function clean(details: Details): Details {
  return Object.fromEntries(
    Object.entries(details).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, MAX_TEXT) : v]),
  );
}

// Call it inside the same transaction as the change it describes, so a change
// can never exist without its journal entry. The part of the journal (source)
// comes from the actor's account, read in the same statement: a test account
// (admins.is_test) writes "dev", everyone else "portal". Only while the app
// itself runs locally: on a server everything is "portal", so even a test
// account that got into a real database can never hide an action.
export async function writeAudit(
  db: Db | Tx,
  actor: Actor,
  entry: { action: AuditAction; targetType: string; targetId?: string; details?: Details },
): Promise<void> {
  await db.insert(tables.auditLog).values({
    actorAdminId: actor.id,
    actorEmail: actor.email,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    details: clean(entry.details ?? {}),
    source: !isLocalAppUrl(getEnv().APP_URL)
      ? "portal"
      : sql`coalesce((select case when ${tables.admins.isTest} then 'dev' end from ${tables.admins} where ${tables.admins.id} = ${actor.id}), 'portal')`,
  });
}

export type AuditSource = "portal" | "dev";

export async function listAudit(source: AuditSource, limit = 200) {
  return getDb()
    .select()
    .from(tables.auditLog)
    .where(eq(tables.auditLog.source, source))
    .orderBy(desc(tables.auditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
