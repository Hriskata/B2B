import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current";
import { getEnv } from "@/lib/env";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Администрация" };

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-6">Администрация</h1>
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
        <p
          role="alert"
          className="rounded-sm border border-line-ember bg-ember-900 px-3 py-2 text-ember-300"
        >
          Внимание: двуфакторната автентикация е изключена (само за локално
          тестване).
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
              className="card card-pad card-interactive block font-medium text-primary"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
