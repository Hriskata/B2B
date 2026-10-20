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
    <footer className="mx-auto mt-16 w-full max-w-[1120px] px-4 pb-6 sm:mt-24">
      <div className="panel panel-glow flex flex-wrap gap-x-6 gap-y-3 px-6 pb-24 pt-8 text-sm sm:px-8">
        {links.map(([path, label]) => (
          <Link key={path} href={localePath(lang, path)}>
            {label}
          </Link>
        ))}
        <CookieSettingsButton label={t.cookieSettings} />
      </div>
    </footer>
  );
}
