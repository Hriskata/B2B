import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current";
import { getEnv } from "@/lib/env";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Администрация" };

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Администрация</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

// Registrations and inquiries are empty placeholders until phases 2 and 4.
async function Content() {
  const admin = await requireAdmin();
  const editor = can(admin.role, "edit_catalog");
  return (
    <div className="flex flex-col gap-4">
      {getEnv().ADMIN_2FA_DISABLED && (
        <p role="alert" className="rounded border border-red-700 px-3 py-2 text-red-700 dark:text-red-400">
          Внимание: двуфакторната автентикация е изключена (само за локално тестване).
        </p>
      )}
      <p>
        {editor
          ? "Можете да преглеждате и да променяте продукти, цени и профили."
          : "Имате право само на преглед. Промените са недостъпни."}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[
          ["/admin/products", "Продукти и цени"],
          ["/admin/registrations", "Чакащи регистрации"],
          ["/admin/inquiries", "Запитвания"],
          ["/admin/customers", "Клиенти и фирми"],
          ["/admin/admins", "Администратори"],
          ["/admin/audit", "Журнал на промените"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-zinc-300 p-4 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
