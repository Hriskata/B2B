import "server-only";
import { getEnv } from "./env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Cloudflare Turnstile. Fails closed: any problem counts as "not human".
export async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({
      secret: getEnv().TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

export const CAPTCHA_FIELD = "cf-turnstile-response";

export function getCaptchaSiteKey(): string {
  return getEnv().TURNSTILE_SITE_KEY;
}

export async function verifyCaptchaFromForm(formData: FormData, ip: string): Promise<boolean> {
  const token = formData.get(CAPTCHA_FIELD);
  return verifyCaptcha(typeof token === "string" ? token : "", ip);
}
