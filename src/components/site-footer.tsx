import Link from "next/link";
import { CookieSettingsButton } from "./consent-manager";

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-zinc-300 dark:border-zinc-700">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm">
        <Link href="/about" className="underline">
          За нас
        </Link>
        <Link href="/contacts" className="underline">
          Контакти
        </Link>
        <Link href="/faq" className="underline">
          Въпроси и отговори
        </Link>
        <Link href="/terms" className="underline">
          Общи условия
        </Link>
        <Link href="/privacy" className="underline">
          Политика за поверителност
        </Link>
        <Link href="/cookies" className="underline">
          Политика за бисквитки
        </Link>
        <CookieSettingsButton />
      </div>
    </footer>
  );
}
