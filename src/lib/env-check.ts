// Checks an environment file (.env.staging, .env.production) BEFORE it is used
// on a server: it must not carry test settings, and the secrets of the two
// servers must differ. Pure functions (no server-only), shared by
// scripts/check-env.ts and the tests. Messages name variables, never values.

export type EnvKind = "staging" | "production";
export type Vars = Record<string, string | undefined>;
export type Problem = { variable: string; message: string };

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;
// Cloudflare's public Turnstile TEST keys (always pass / always fail / block).
const TURNSTILE_TEST_KEY = /^[123]x0{10,}/;
const WEAK_PASSWORD = /^(change.?me|password|postgres|b2b|secret|admin|test)/i;

// Variables whose value must be different on staging and production.
export const SECRETS_THAT_MUST_DIFFER = [
  "POSTGRES_PASSWORD",
  "TOTP_ENCRYPTION_KEY",
  "TURNSTILE_SECRET_KEY",
  "TURNSTILE_SITE_KEY",
  "SMTP_PASS",
] as const;

function validBase64Key(value: string): boolean {
  return Buffer.from(value, "base64").length === 32;
}

export function checkEnvironment(kind: EnvKind, env: Vars, other?: Vars): Problem[] {
  const problems: Problem[] = [];
  const bad = (variable: string, message: string) => problems.push({ variable, message });
  const get = (name: string) => (env[name] ?? "").trim();

  for (const name of [
    "POSTGRES_PASSWORD",
    "APP_URL",
    "TOTP_ENCRYPTION_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "MAIL_FROM",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ]) {
    if (!get(name)) bad(name, "is not set");
  }

  const url = get("APP_URL");
  if (url) {
    if (LOCAL_URL.test(url)) bad("APP_URL", "points to localhost");
    else if (!url.startsWith("https://")) bad("APP_URL", "must be https (cookies are Secure only over https)");
  }

  if (get("ADMIN_2FA_DISABLED") === "true") bad("ADMIN_2FA_DISABLED", "must be false (2FA is mandatory)");

  const password = get("POSTGRES_PASSWORD");
  if (password && (password.length < 20 || WEAK_PASSWORD.test(password) || /^<.*>$/.test(password))) {
    bad("POSTGRES_PASSWORD", "must be a random value of at least 20 characters");
  }

  const key = get("TOTP_ENCRYPTION_KEY");
  if (key && !validBase64Key(key)) bad("TOTP_ENCRYPTION_KEY", "must be 32 random bytes, base64");

  for (const name of ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"]) {
    if (TURNSTILE_TEST_KEY.test(get(name))) bad(name, "is a Cloudflare TEST key; create real keys for this site");
  }

  const smtp = get("SMTP_HOST").toLowerCase();
  if (smtp && (smtp === "mailpit" || smtp === "localhost" || smtp.startsWith("127."))) {
    bad("SMTP_HOST", "is the test mail catcher; use a real mail provider");
  }
  if (/example\.(com|org|net|bg)\b|\.example\b|@b2b\.example/i.test(get("MAIL_FROM"))) {
    bad("MAIL_FROM", "uses a placeholder sender address");
  }

  const proxies = get("TRUSTED_PROXY_COUNT");
  if (proxies !== "" && (!/^\d+$/.test(proxies) || Number(proxies) < 1)) {
    bad("TRUSTED_PROXY_COUNT", "must be at least 1 behind a reverse proxy (the client IP is read from X-Forwarded-For)");
  }

  const ga = get("GA_MEASUREMENT_ID");
  if (ga && !/^G-[A-Z0-9]{4,20}$/.test(ga)) bad("GA_MEASUREMENT_ID", "has an invalid format");
  if (kind === "staging" && ga) bad("GA_MEASUREMENT_ID", "should be empty on staging (test visits must not reach the real statistics)");

  if (other) {
    for (const name of SECRETS_THAT_MUST_DIFFER) {
      const a = get(name);
      const b = (other[name] ?? "").trim();
      if (a && a === b) bad(name, "is the same as in the other environment; use a separate value");
    }
    const otherUrl = (other.APP_URL ?? "").trim();
    if (url && otherUrl && url === otherUrl) bad("APP_URL", "is the same as in the other environment");
  }

  return problems;
}
