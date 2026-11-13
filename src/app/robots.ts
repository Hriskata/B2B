import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getEnv } from "@/lib/env";

// One rule for every crawler, AI ones included: search bots (OAI-SearchBot,
// PerplexityBot, Claude-SearchBot...) and training bots (GPTBot, ClaudeBot,
// Google-Extended...) are welcome (decided 14.11.2026). Prices are never in
// public pages, so they cannot reach any of them.
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const root = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/inquiry", "/pending-approval"] },
    sitemap: `${root}/sitemap.xml`,
  };
}
