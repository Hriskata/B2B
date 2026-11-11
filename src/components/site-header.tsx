import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/(bg)/(auth)/login/actions";
import { getCurrentUser } from "@/lib/auth/current";
import { getDict, localePath, type Lang } from "@/i18n";
import { LanguageSwitch } from "./language-switch";

// Sign-in, registration and the forms behind them exist only in Bulgarian for
// now, so those links are not prefixed with /en.
export function SiteHeader({ lang }: { lang: Lang }) {
  const t = getDict(lang).header;
  return (
    <header className="border-b border-line bg-base">
      {/* Smaller gaps under 640 px, so the header fits a 320 px phone. */}
      <nav className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-2 px-4 py-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href={localePath(lang, "/")}
            className="t-card-title text-primary hover:text-primary"
          >
            ODFFiber
          </Link>
          <Link href={localePath(lang, "/products")} className="t-small">
            {t.products}
          </Link>
          <Link
            href={localePath(lang, "/about")}
            className="t-small hidden sm:inline"
          >
            {t.about}
          </Link>
          <Link
            href={localePath(lang, "/contacts")}
            className="t-small hidden sm:inline"
          >
            {t.contacts}
          </Link>
          <Link
            href={localePath(lang, "/faq")}
            className="t-small hidden sm:inline"
          >
            {t.faq}
          </Link>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Suspense fallback={null}>
            <LanguageSwitch lang={lang} />
          </Suspense>
          {/* Reads the session cookie, so it streams in behind Suspense and the rest of the page stays static. */}
          {/* The placeholder is not wider than the guest buttons (only "Вход" on a
              phone), so the page does not grow sideways while it loads. */}
          <Suspense fallback={<span className="inline-block h-10 w-16 sm:w-48" aria-hidden />}>
            <AuthLinks lang={lang} />
          </Suspense>
        </div>
      </nav>
    </header>
  );
}

async function AuthLinks({ lang }: { lang: Lang }) {
  const t = getDict(lang).header;
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="btn btn-secondary">
          {t.login}
        </Link>
        <Link
          href="/register"
          className="btn btn-primary hidden sm:inline-flex"
        >
          {t.register}
        </Link>
      </div>
    );
  }
  return (
    <form action={logoutAction} className="flex min-w-0 items-center gap-3 text-sm">
      <span className="hidden max-w-[14rem] truncate sm:inline" title={user.companyName}>
        {user.email}
      </span>
      <button type="submit" className="btn btn-secondary">
        {t.logout}
      </button>
    </form>
  );
}
