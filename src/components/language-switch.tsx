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
      aria-label={t.ariaLabel}
      className="t-small"
    >
      {t.label}
    </Link>
  );
}
