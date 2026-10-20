import type { Metadata } from "next";
import { Suspense } from "react";
import { listAdmins } from "@/lib/admin/admins";
import { requireAdmin } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { ResetTwoFactorForm } from "./reset-form";

export const metadata: Metadata = { title: "Админи" };

const ROLE_LABEL = { viewer: "Само преглед", editor: "Преглед и редакция" } as const;

export default function AdminAdminsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Администратори</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

// Adding new admins is an open decision (for now: the admin:create script).
async function Content() {
  const me = await requireAdmin();
  const admins = await listAdmins();
  const canReset = can(me.role, "reset_admin_2fa");
  return (
    <ul className="flex flex-col gap-4">
      {admins.map((a) => (
        <li key={a.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <p className="font-semibold">
            {a.email}
            {a.id === me.id && <span className="ml-2 text-sm font-normal">(вие)</span>}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {ROLE_LABEL[a.role]} · {a.status === "active" ? "Активен" : "Блокиран"} · 2FA:{" "}
            {a.totpEnabledAt ? "включена" : "не е настроена"}
          </p>
          {canReset && a.id !== me.id && <ResetTwoFactorForm targetId={a.id} targetEmail={a.email} />}
        </li>
      ))}
    </ul>
  );
}
