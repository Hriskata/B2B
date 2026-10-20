import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { localePath, LANGS } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
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
  const paths = [
    ...STATIC_PATHS,
    ...SERIES_KEYS.map((key) => `/series/${key}`),
    ...products.map((p) => `/products/${p.slug}`),
  ];
  return paths.flatMap((path) =>
    LANGS.map((lang) => ({
      url: `${root}${localePath(lang, path)}`,
      alternates: {
        languages: { bg: `${root}${localePath("bg", path)}`, en: `${root}${localePath("en", path)}` },
      },
    })),
  );
}
