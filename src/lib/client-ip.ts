import "server-only";
import { headers } from "next/headers";
import { getEnv } from "./env";

// Next.js only fills X-Forwarded-For when the client did not send it, so the
// header is trusted only by position: the entry added by our own reverse
// proxy(ies), counted from the right. Behind no proxy a client can fake its
// IP; per-account limits are the protection that does not depend on this.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const parts = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "unknown";
  const hops = Math.max(1, getEnv().TRUSTED_PROXY_COUNT);
  return parts[Math.max(0, parts.length - hops)];
}
