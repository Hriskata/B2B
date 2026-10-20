import type { Metadata } from "next";
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
    openGraph: { type: "website", title, description, url: pageUrl(lang, path), locale: getDict(lang).ogLocale },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
