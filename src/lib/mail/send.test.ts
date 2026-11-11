import { describe, expect, it } from "vitest";
import { smtpOptions } from "./send";

const env = (host: string, secure: boolean) => ({
  SMTP_HOST: host,
  SMTP_PORT: secure ? 465 : 587,
  SMTP_SECURE: secure,
  SMTP_USER: "user",
  SMTP_PASS: "not-a-real-secret",
});

describe("smtpOptions", () => {
  it("requires STARTTLS on port 587 for a real mail server", () => {
    expect(smtpOptions(env("smtp.provider.example", false)).requireTLS).toBe(true);
  });

  it("does not need STARTTLS on top of an encrypted connection (port 465)", () => {
    expect(smtpOptions(env("smtp.provider.example", true))).toMatchObject({
      secure: true,
      requireTLS: false,
    });
  });

  it.each(["mailpit", "localhost", "127.0.0.1", "MailPit"])(
    "leaves the local test mail catcher %s on plain SMTP",
    (host) => {
      expect(smtpOptions(env(host, false)).requireTLS).toBe(false);
    },
  );
});
