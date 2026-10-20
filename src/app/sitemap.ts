import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listPublicProducts } from "@/lib/catalog";
import { getEnv } from "@/lib/env";
import { SERIES } from "@/lib/series";

// Public pages only, and no prices: it is built from PublicProduct. The legal
// pages are left out until their real text exists.
const STATIC_PATHS = ["/", "/products", "/about", "/contacts", "/faq"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const root = getEnv().APP_URL.replace(/\/$/, "");
  const products = await listPublicProducts();
  return [
    ...STATIC_PATHS.map((path) => ({ url: `${root}${path}` })),
    ...SERIES.map((s) => ({ url: `${root}/series/${s.key}` })),
    ...products.map((p) => ({ url: `${root}/products/${p.slug}` })),
  ];
}
