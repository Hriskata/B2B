import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { createAdmin, createUser } from "@/test/factories";
import { cleanupExpired } from "./cleanup";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const ago = (ms: number) => new Date(Date.now() - ms);
const DAY = 86_400_000;

describeDb("cleanupExpired", () => {
  it("removes only expired sessions, ended rate-limit windows and old tokens", async () => {
    const db = getDb();
    const { admin } = await createAdmin();
    const user = await createUser();
    await db.insert(tables.sessions).values([
      { tokenHash: "live", subjectType: "admin", subjectId: admin.id, stage: "full", expiresAt: new Date(Date.now() + DAY) },
      { tokenHash: "dead", subjectType: "admin", subjectId: admin.id, stage: "full", expiresAt: ago(1000) },
    ]);
    await db.insert(tables.rateLimits).values([
      { key: "live", count: 1, resetAt: new Date(Date.now() + DAY) },
      { key: "dead", count: 1, resetAt: ago(1000) },
    ]);
    const token = (tokenHash: string, expiresAt: Date, usedAt: Date | null) => ({
      tokenHash, purpose: "reset_password" as const, subjectType: "user" as const, subjectId: user.id, expiresAt, usedAt,
    });
    await db.insert(tables.emailTokens).values([
      token("valid", new Date(Date.now() + DAY), null),
      token("expired-today", ago(DAY), null), // within the grace period: kept
      token("expired-old", ago(10 * DAY), null),
      token("used-today", new Date(Date.now() + DAY), ago(1000)), // kept
      token("used-old", new Date(Date.now() + DAY), ago(10 * DAY)),
    ]);

    const result = await cleanupExpired(db);

    expect(result).toEqual({ sessions: 1, rateLimits: 1, emailTokens: 2 });
    expect((await db.select().from(tables.sessions)).map((s) => s.tokenHash)).toEqual(["live"]);
    expect((await db.select().from(tables.rateLimits)).map((r) => r.key)).toEqual(["live"]);
    expect((await db.select().from(tables.emailTokens)).map((t) => t.tokenHash).sort()).toEqual([
      "expired-today",
      "used-today",
      "valid",
    ]);
  });

  it("never deletes accounts or the journal", async () => {
    const db = getDb();
    const { admin } = await createAdmin();
    await createUser();
    await db.insert(tables.auditLog).values({ actorAdminId: admin.id, actorEmail: admin.email, action: "x", targetType: "t" });

    await cleanupExpired(db);

    expect(await db.select().from(tables.admins)).toHaveLength(1);
    expect(await db.select().from(tables.users)).toHaveLength(1);
    expect(await db.select().from(tables.auditLog)).toHaveLength(1);
  });

  it("does nothing on an empty database", async () => {
    expect(await cleanupExpired(getDb())).toEqual({ sessions: 0, rateLimits: 0, emailTokens: 0 });
  });
});
