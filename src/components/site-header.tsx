import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/(auth)/login/actions";
import { getCurrentUser } from "@/lib/auth/current";

// Minimal navigation for phase 1. The real site header comes with the
// catalog (phase 3).
export function SiteHeader() {
  return (
    <header className="border-b border-zinc-300 dark:border-zinc-700">
      <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          B2B каталог
        </Link>
        {/* Reads the session cookie, so it streams in behind Suspense and the rest of the page stays static. */}
        <Suspense fallback={<span className="h-6 w-32" aria-hidden />}>
          <AuthLinks />
        </Suspense>
      </nav>
    </header>
  );
}

async function AuthLinks() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex gap-4 text-sm">
        <Link href="/login" className="underline">
          Вход
        </Link>
        <Link href="/register" className="underline">
          Регистрация
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
        Изход
      </button>
    </form>
  );
}
