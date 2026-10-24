import { describe, expect, it } from "vitest";
import { checkEnvironment, type Vars } from "./env-check";

// A valid production file (all values made up for the test).
const good: Vars = {
  POSTGRES_PASSWORD: "k3J9xQ7mWp2LsVn8RtYb4Zc6",
  APP_URL: "https://odffiber.example-shop.bg",
  TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  SMTP_HOST: "smtp.mail-provider.eu",
  SMTP_PORT: "587",
  MAIL_FROM: "ODFFiber <no-reply@odffiber.bg>",
  TURNSTILE_SITE_KEY: "0x4AAAAAAAreal-site-key",
  TURNSTILE_SECRET_KEY: "0x4AAAAAAAreal-secret-key",
  TRUSTED_PROXY_COUNT: "1",
  ADMIN_2FA_DISABLED: "false",
  GA_MEASUREMENT_ID: "G-ABCD1234",
};

const names = (env: Vars, kind: "staging" | "production" = "production", other?: Vars) =>
  checkEnvironment(kind, env, other).map((p) => p.variable);

describe("checkEnvironment", () => {
  it("accepts a proper production file", () => {
    expect(checkEnvironment("production", good)).toEqual([]);
  });

  it("flags every missing required variable", () => {
    expect(names({})).toEqual(
      expect.arrayContaining(["POSTGRES_PASSWORD", "APP_URL", "TOTP_ENCRYPTION_KEY", "SMTP_HOST", "MAIL_FROM", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]),
    );
  });

  it("refuses localhost and plain http", () => {
    expect(names({ ...good, APP_URL: "http://localhost:3200" })).toContain("APP_URL");
    expect(names({ ...good, APP_URL: "http://odffiber.bg" })).toContain("APP_URL");
  });

  it("refuses 2FA switched off", () => {
    expect(names({ ...good, ADMIN_2FA_DISABLED: "true" })).toEqual(["ADMIN_2FA_DISABLED"]);
  });

  it("refuses Cloudflare test keys", () => {
    const test = { ...good, TURNSTILE_SITE_KEY: "1x00000000000000000000AA", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA" };
    expect(names(test)).toEqual(["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]);
  });

  it("refuses the test mail catcher and a placeholder sender", () => {
    expect(names({ ...good, SMTP_HOST: "mailpit" })).toEqual(["SMTP_HOST"]);
    expect(names({ ...good, MAIL_FROM: "B2B <noreply@b2b.example>" })).toEqual(["MAIL_FROM"]);
  });

  it("refuses weak database passwords and bad encryption keys", () => {
    expect(names({ ...good, POSTGRES_PASSWORD: "changeme" })).toEqual(["POSTGRES_PASSWORD"]);
    expect(names({ ...good, POSTGRES_PASSWORD: "short" })).toEqual(["POSTGRES_PASSWORD"]);
    expect(names({ ...good, TOTP_ENCRYPTION_KEY: "not-a-key" })).toEqual(["TOTP_ENCRYPTION_KEY"]);
  });

  it("needs at least one trusted proxy", () => {
    expect(names({ ...good, TRUSTED_PROXY_COUNT: "0" })).toEqual(["TRUSTED_PROXY_COUNT"]);
  });

  it("keeps Google Analytics off staging", () => {
    expect(names(good, "staging")).toEqual(["GA_MEASUREMENT_ID"]);
    expect(names({ ...good, GA_MEASUREMENT_ID: "" }, "staging")).toEqual([]);
    expect(names({ ...good, GA_MEASUREMENT_ID: "bad" })).toEqual(["GA_MEASUREMENT_ID"]);
  });

  it("refuses a secret shared with the other environment, and says only the name", () => {
    const staging: Vars = { ...good, APP_URL: "https://test.odffiber.bg", GA_MEASUREMENT_ID: "", TOTP_ENCRYPTION_KEY: good.TOTP_ENCRYPTION_KEY };
    const problems = checkEnvironment("production", good, staging);

    expect(problems.map((p) => p.variable)).toEqual(expect.arrayContaining(["TOTP_ENCRYPTION_KEY", "POSTGRES_PASSWORD"]));
    expect(JSON.stringify(problems)).not.toContain(good.POSTGRES_PASSWORD);
    expect(JSON.stringify(problems)).not.toContain(good.TOTP_ENCRYPTION_KEY);
  });

  it("passes when both environments have their own secrets and addresses", () => {
    const staging: Vars = {
      ...good,
      APP_URL: "https://test.odffiber.bg",
      GA_MEASUREMENT_ID: "",
      POSTGRES_PASSWORD: "Qw8Zr5Tn1Vb3Km9Ly7Hd2Xs4",
      TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
      TURNSTILE_SITE_KEY: "0x4AAAAAAAstaging-site",
      TURNSTILE_SECRET_KEY: "0x4AAAAAAAstaging-secret",
      SMTP_PASS: "staging-pass",
    };

    expect(checkEnvironment("production", good, staging)).toEqual([]);
    expect(checkEnvironment("staging", staging, good)).toEqual([]);
  });
});
