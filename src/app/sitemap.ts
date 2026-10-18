import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listPublicProducts } from "@/lib/catalog";
import { getEnv } from "@/lib/env";

// Public pages only, and no prices: it is built from PublicProduct.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const root = getEnv().APP_URL.replace(/\/$/, "");
  const products = await listPublicProducts();
  return [{ url: `${root}/` }, ...products.map((p) => ({ url: `${root}/products/${p.slug}` }))];
}
