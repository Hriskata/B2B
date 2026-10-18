import "server-only";
import { z } from "zod";

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

const schema = z
  .object({
  DATABASE_URL: z.string().min(1),
  // Public base URL, used in email links and to decide if cookies are Secure.
  APP_URL: z.url(),
  // 32 random bytes, base64. Encrypts admin TOTP secrets in the database.
  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(3),
  TURNSTILE_SITE_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // How many reverse proxies append to X-Forwarded-For in front of the app.
  TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).default(1),
  // Local testing only: admins log in with the password alone. Refused unless
  // APP_URL is localhost, so it cannot be left on in a real deployment.
  ADMIN_2FA_DISABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  })
  .refine((env) => !env.ADMIN_2FA_DISABLED || LOCAL_URL.test(env.APP_URL), {
    path: ["ADMIN_2FA_DISABLED"],
    message: "can only be enabled when APP_URL is http://localhost or http://127.0.0.1",
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      // Names of the bad variables only, never their values.
      const names = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))];
      throw new Error(`Invalid environment configuration: ${names.join(", ")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function isSecureOrigin(): boolean {
  return getEnv().APP_URL.startsWith("https://");
}
