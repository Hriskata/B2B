import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { createAdmin } from "@/test/factories";
import { listAudit, writeAudit } from "./audit";

// Lets one test run as if the app were on a server (non-local APP_URL).
const appUrl = vi.hoisted(() => ({ override: undefined as string | undefined }));
vi.mock("./env", async (importOriginal) => {
  const real = await importOriginal<typeof import("./env")>();
  return {
    ...real,
    getEnv: () => {
      const env = real.getEnv();
      return appUrl.override ? { ...env, APP_URL: appUrl.override } : env;
    },
  };
});
afterEach(() => {
  appUrl.override = undefined;
});

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const entry = { action: "user.block" as const, targetType: "user", targetId: "x" };

describeDb("journal parts: by hand and from development", () => {
  it("an entry of a normal admin goes to the portal part, of a test account to the dev part", async () => {
    const { admin: person } = await createAdmin({ email: "person@firma.bg" });
    const { admin: bot } = await createAdmin({ email: "bot@example.com", isTest: true });

    await writeAudit(getDb(), person, entry);
    await writeAudit(getDb(), bot, entry);

    const portal = await listAudit("portal");
    const dev = await listAudit("dev");
    expect(portal.map((e) => e.actorEmail)).toEqual(["person@firma.bg"]);
    expect(dev.map((e) => e.actorEmail)).toEqual(["bot@example.com"]);
  });

  it("the part is fixed when written: deleting the test account later does not move its entries", async () => {
    const { admin: bot } = await createAdmin({ email: "bot@example.com", isTest: true });
    await writeAudit(getDb(), bot, entry);
    await getDb().delete(tables.admins).where(eq(tables.admins.id, bot.id));

    expect(await listAudit("portal")).toHaveLength(0);
    const [row] = await listAudit("dev");
    expect(row.actorAdminId).toBeNull();
    expect(row.actorEmail).toBe("bot@example.com");
  });

  it("on a server (non-local APP_URL) even a test account writes to the portal part", async () => {
    const { admin: bot } = await createAdmin({ email: "bot@example.com", isTest: true });
    appUrl.override = "https://staging.example.com";
    await writeAudit(getDb(), bot, entry);
    expect(await listAudit("dev")).toHaveLength(0);
    expect((await listAudit("portal")).map((e) => e.actorEmail)).toEqual(["bot@example.com"]);
  });
});
