import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { localePath, LANGS } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import { productImageSrc } from "@/lib/product-image-file";
import { getEnv } from "@/lib/env";
import { SERIES_KEYS } from "@/lib/series";

// Public pages only, and no prices: it is built from PublicProduct. The legal
// pages are left out until their real text exists. Every page is listed in
// both languages, each entry pointing at the other one (hreflang).
const STATIC_PATHS = ["/", "/products", "/about", "/contacts", "/faq"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const root = getEnv().APP_URL.replace(/\/$/, "");
  const products = await listPublicProducts();
  // Each product page lists its render (image sitemap), so search engines
  // find the pictures and know which page they belong to.
  const pages: { path: string; image?: string | null }[] = [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...SERIES_KEYS.map((key) => ({ path: `/series/${key}` })),
    ...products.map((p) => ({ path: `/products/${p.slug}`, image: productImageSrc(p.sku) })),
  ];
  return pages.flatMap(({ path, image }) =>
    LANGS.map((lang) => ({
      url: `${root}${localePath(lang, path)}`,
      alternates: {
        languages: { bg: `${root}${localePath("bg", path)}`, en: `${root}${localePath("en", path)}` },
      },
      ...(image ? { images: [`${root}${image}`] } : {}),
    })),
  );
}
