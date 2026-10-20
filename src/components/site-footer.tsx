import Link from "next/link";
import { getDict, localePath, type Lang } from "@/i18n";
import { CookieSettingsButton } from "./consent-manager";

export function SiteFooter({ lang }: { lang: Lang }) {
  const t = getDict(lang).footer;
  const links: [string, string][] = [
    ["/about", t.about],
    ["/contacts", t.contacts],
    ["/faq", t.faq],
    ["/terms", t.terms],
    ["/privacy", t.privacy],
    ["/cookies", t.cookies],
  ];
  return (
    <footer className="mt-12 border-t border-zinc-300 dark:border-zinc-700">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm">
        {links.map(([path, label]) => (
          <Link key={path} href={localePath(lang, path)} className="underline">
            {label}
          </Link>
        ))}
        <CookieSettingsButton label={t.cookieSettings} />
      </div>
    </footer>
  );
}
