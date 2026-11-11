import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

async function startWith(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...original, ...overrides } as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k];
  return (await import("./instrumentation")).register();
}

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("server start (instrumentation)", () => {
  it("refuses to start with a bad configuration, naming only the variable", async () => {
    await expect(
      startWith({
        NEXT_RUNTIME: "nodejs",
        NEXT_PHASE: undefined,
        APP_URL: "https://shop.example",
        ADMIN_2FA_DISABLED: "true",
      }),
    ).rejects.toThrow(/^Invalid environment configuration: ADMIN_2FA_DISABLED$/);
  });

  it("does not check during `next build` (the build has no secrets)", async () => {
    await expect(
      startWith({
        NEXT_RUNTIME: "nodejs",
        NEXT_PHASE: "phase-production-build",
        DATABASE_URL: undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not check on the edge runtime", async () => {
    await expect(startWith({ NEXT_RUNTIME: "edge", DATABASE_URL: undefined })).resolves.toBeUndefined();
  });

  it("starts with a proper configuration", async () => {
    await expect(startWith({ NEXT_RUNTIME: "nodejs", NEXT_PHASE: undefined })).resolves.toBeUndefined();
  });
});
