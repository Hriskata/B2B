import { bg, type Dict } from "./bg";
import { en } from "./en";

export type Lang = "bg" | "en";
export const LANGS: readonly Lang[] = ["bg", "en"];

const dictionaries: Record<Lang, Dict> = { bg, en };

export function getDict(lang: Lang): Dict {
  return dictionaries[lang];
}

// Public path of a page in a language: Bulgarian has no prefix, English is
// under /en. `path` starts with "/" ("/" is the home page).
export function localePath(lang: Lang, path: string): string {
  if (lang === "bg") return path;
  return path === "/" ? "/en" : `/en${path}`;
}

// The same page in the other language (for the language switch and hreflang).
export function otherLang(lang: Lang): Lang {
  return lang === "bg" ? "en" : "bg";
}

// Pages that exist in both languages: the paths a visitor can switch between.
export const SHARED_PATHS = ["/", "/products", "/about", "/contacts", "/faq", "/terms", "/privacy", "/cookies"] as const;

// First path segments of pages that exist in both languages (besides "/").
const SHARED_FIRST_SEGMENTS = new Set(["products", "series", "about", "contacts", "faq", "terms", "privacy", "cookies"]);

// Address of the current page in the other language. Pages that exist only in
// Bulgarian (sign-in, forms, admin) lead to the other language's home page.
export function switchHref(lang: Lang, pathname: string): string {
  const barePath = lang === "en" ? pathname.replace(/^\/en(?=\/|$)/, "") || "/" : pathname;
  const first = barePath.split("/")[1] ?? "";
  const shared = barePath === "/" || SHARED_FIRST_SEGMENTS.has(first);
  return localePath(otherLang(lang), shared ? barePath : "/");
}
