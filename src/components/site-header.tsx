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
    <header className="border-b border-zinc-300 dark:border-zinc-700">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-5">
          <Link href={localePath(lang, "/")} className="font-semibold">
            ODFFiber
          </Link>
          <Link href={localePath(lang, "/products")} className="text-sm underline">
            {t.products}
          </Link>
          <Link href={localePath(lang, "/about")} className="hidden text-sm underline sm:inline">
            {t.about}
          </Link>
          <Link href={localePath(lang, "/contacts")} className="hidden text-sm underline sm:inline">
            {t.contacts}
          </Link>
          <Link href={localePath(lang, "/faq")} className="hidden text-sm underline sm:inline">
            {t.faq}
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Suspense fallback={null}>
            <LanguageSwitch lang={lang} />
          </Suspense>
          {/* Reads the session cookie, so it streams in behind Suspense and the rest of the page stays static. */}
          <Suspense fallback={<span className="h-6 w-32" aria-hidden />}>
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
      <div className="flex gap-4 text-sm">
        <Link href="/login" className="underline">
          {t.login}
        </Link>
        <Link href="/register" className="underline">
          {t.register}
        </Link>
      </div>
    );
  }
  return (
    <form action={logoutAction} className="flex items-center gap-3 text-sm">
      <span className="truncate" title={user.companyName}>
        {user.email}
      </span>
      <button type="submit" className="underline">
        {t.logout}
      </button>
    </form>
  );
}
