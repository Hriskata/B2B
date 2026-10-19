import { sql } from "drizzle-orm";
import { afterAll, beforeEach, vi } from "vitest";
import {
  cookiesMock,
  headersMock,
  redirectMock,
  resetRequest,
} from "./next-mocks";
import { resetSentMails } from "./mail-capture";

vi.mock("next/headers", () => ({ cookies: cookiesMock, headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: () => {},
  revalidateTag: () => {},
  updateTag: () => {},
  refresh: () => {},
}));

// Mail is captured instead of sent.
vi.mock("@/lib/mail/send", async () => {
  const { captureMail } = await import("./mail-capture");
  return { sendMail: captureMail };
});

// The captcha token "ok" passes, anything else fails.
vi.mock("@/lib/captcha", () => ({
  CAPTCHA_FIELD: "cf-turnstile-response",
  getCaptchaSiteKey: () => "test-site-key",
  verifyCaptcha: async (token: string) => token === "ok",
  verifyCaptchaFromForm: async (formData: FormData) => formData.get("cf-turnstile-response") === "ok",
}));

const hasDb = !!process.env.TEST_DATABASE_URL;

beforeEach(async () => {
  resetRequest();
  resetSentMails();
  if (hasDb) {
    const { getDb } = await import("@/db");
    await getDb().execute(
      sql`truncate table audit_log, product_prices, products, rate_limits, email_tokens, sessions, admin_recovery_codes, admins, users, companies restart identity cascade`,
    );
  }
});

afterAll(async () => {
  if (hasDb) {
    // Close the pool so the worker can exit.
    const g = globalThis as unknown as { db?: { $client?: { end: () => Promise<void> } } };
    await g.db?.$client?.end();
  }
});
