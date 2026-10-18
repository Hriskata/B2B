import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getEnv } from "@/lib/env";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const root = getEnv().APP_URL.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${root}/sitemap.xml`,
  };
}
