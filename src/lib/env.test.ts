import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  process.env = { ...original, ...overrides } as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries(overrides)) if (v === undefined) delete process.env[k];
  return (await import("./env")).getEnv();
}

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("ADMIN_2FA_DISABLED", () => {
  it("is off by default, so 2FA stays mandatory", async () => {
    const env = await loadEnv({ ADMIN_2FA_DISABLED: undefined });
    expect(env.ADMIN_2FA_DISABLED).toBe(false);
  });

  it.each(["http://localhost:3200", "http://127.0.0.1:3200", "http://localhost"])(
    "can be turned on for %s",
    async (url) => {
      const env = await loadEnv({ ADMIN_2FA_DISABLED: "true", APP_URL: url });
      expect(env.ADMIN_2FA_DISABLED).toBe(true);
    },
  );

  it.each([
    "https://shop.example.bg",
    "http://shop.example.bg",
    "https://localhost.evil.example",
    "http://localhost.evil.example",
    "http://127.0.0.1.evil.example",
  ])("refuses to start with it on for %s", async (url) => {
    await expect(loadEnv({ ADMIN_2FA_DISABLED: "true", APP_URL: url })).rejects.toThrow(
      /ADMIN_2FA_DISABLED/,
    );
  });

  it("is harmless when off, for any URL", async () => {
    const env = await loadEnv({ ADMIN_2FA_DISABLED: "false", APP_URL: "https://shop.example.bg" });
    expect(env.ADMIN_2FA_DISABLED).toBe(false);
  });
});
