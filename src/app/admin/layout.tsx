import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/current";
import { adminLogoutAction } from "./actions";

// The admin area must not be indexed (checklist I).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      {/* Reads the session, so it streams in behind Suspense. */}
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      {children}
    </>
  );
}

const ROLE_LABEL = { viewer: "само преглед", editor: "преглед и редакция" } as const;

// Shown only with a complete session (after 2FA), so the login and 2FA
// pages stay clean.
async function AdminNav() {
  const admin = await getCurrentAdmin("full");
  if (!admin) return null;
  return (
    <div className="border-b border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <nav
        aria-label="Администрация"
        className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 text-sm"
      >
        <Link href="/admin" className="font-semibold">
          Администрация
        </Link>
        <Link href="/admin/products" className="underline">
          Продукти
        </Link>
        <Link href="/admin/customers" className="underline">
          Клиенти
        </Link>
        <Link href="/admin/admins" className="underline">
          Админи
        </Link>
        <Link href="/admin/audit" className="underline">
          Журнал
        </Link>
        <span className="ml-auto text-zinc-600 dark:text-zinc-400">
          {admin.email} ({ROLE_LABEL[admin.role]})
        </span>
        <form action={adminLogoutAction}>
          <button type="submit" className="underline">
            Изход
          </button>
        </form>
      </nav>
    </div>
  );
}
