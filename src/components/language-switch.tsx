"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDict, otherLang, switchHref, type Lang } from "@/i18n";

// Link to the same page in the other language.
export function LanguageSwitch({ lang }: { lang: Lang }) {
  const pathname = usePathname() ?? "/";
  const target = otherLang(lang);
  const t = getDict(lang).switchTo;
  return (
    <Link
      href={switchHref(lang, pathname)}
      lang={target}
      hrefLang={target}
      // The visible code (BG/EN) is part of the name, for voice control.
      aria-label={`${t.ariaLabel} (${t.short})`}
      className="t-small"
    >
      {/* The language code on a phone, where the header has little room. */}
      <span className="sm:hidden">{t.short}</span>
      <span className="hidden sm:inline">{t.label}</span>
    </Link>
  );
}
