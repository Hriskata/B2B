import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { connection } from "next/server";
import { getDict, localePath, type Lang } from "@/i18n";
import { getEnv } from "./env";

// Absolute URL of a page in a language.
export function pageUrl(lang: Lang, path: string): string {
  return `${getEnv().APP_URL.replace(/\/$/, "")}${localePath(lang, path)}`;
}

// hreflang pairs (bg, en and x-default = Bulgarian) and the canonical URL.
export function alternatesFor(lang: Lang, path: string): NonNullable<Metadata["alternates"]> {
  return {
    canonical: pageUrl(lang, path),
    languages: { bg: pageUrl("bg", path), en: pageUrl("en", path), "x-default": pageUrl("bg", path) },
  };
}

// The site's shared-link picture (src/app/(bg)/og.png and src/app/en/og.png),
// for pages without one of their own. A page that sets openGraph replaces the
// layout's whole openGraph object, so it must list the picture again.
export function siteOgImages(lang: Lang) {
  const t = getDict(lang).og;
  return [{ url: pageUrl(lang, "/og.png"), width: 1200, height: 630, alt: t.siteAlt, type: "image/png" }];
}

// Defaults of a language's root layout: the absolute base for metadata URLs
// (file-based images included), the shared-link picture and a large card on X.
export async function rootMetadata(lang: Lang, title: string, description: string): Promise<Metadata> {
  await connection();
  return {
    title,
    description,
    metadataBase: new URL(getEnv().APP_URL),
    openGraph: { type: "website", siteName: SITE.name, title, locale: getDict(lang).ogLocale, images: siteOgImages(lang) },
    twitter: { card: "summary_large_image" },
  };
}

// Metadata of a page that exists in both languages. APP_URL is runtime
// configuration, so it is read only after connection() (not at build time).
export async function buildMetadata(opts: {
  lang: Lang;
  path: string;
  title: string;
  description?: string;
  noindex?: boolean;
}): Promise<Metadata> {
  await connection();
  const { lang, path, title, description, noindex } = opts;
  return {
    title,
    description,
    alternates: alternatesFor(lang, path),
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title,
      description,
      url: pageUrl(lang, path),
      locale: getDict(lang).ogLocale,
      images: siteOgImages(lang),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
