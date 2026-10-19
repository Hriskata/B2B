import "server-only";
import { desc } from "drizzle-orm";
import { getDb, tables, type Db } from "@/db";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type AuditAction =
  | "product.create"
  | "product.update"
  | "price.change"
  | "user.block"
  | "user.unblock"
  | "company.block"
  | "company.unblock"
  | "admin.2fa_reset";

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
// can never exist without its journal entry.
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
  });
}

export async function listAudit(limit = 200) {
  return getDb()
    .select()
    .from(tables.auditLog)
    .orderBy(desc(tables.auditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
}
