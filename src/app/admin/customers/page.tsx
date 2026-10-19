import type { Metadata } from "next";
import { Suspense } from "react";
import { listCustomers } from "@/lib/admin/accounts";
import { requireAdmin } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { setCompanyBlockedAction, setUserBlockedAction } from "../manage-actions";

export const metadata: Metadata = { title: "Клиенти (админ)" };

const STATUS_LABEL = {
  unverified: "Непотвърден имейл",
  active: "Активен",
  blocked: "Блокиран",
} as const;

export default function AdminCustomersPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Клиенти и фирми</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

function BlockButton({ blocked, label, unlabel }: { blocked: boolean; label: string; unlabel: string }) {
  return (
    <>
      <input type="hidden" name="blocked" value={blocked ? "false" : "true"} />
      <button type="submit" className="underline">
        {blocked ? unlabel : label}
      </button>
    </>
  );
}

async function Content() {
  const admin = await requireAdmin();
  const companies = await listCustomers();
  const canBlock = can(admin.role, "block_accounts");
  if (companies.length === 0) return <p>Все още няма регистрирани фирми.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {companies.map((c) => (
        <li key={c.id} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">{c.name}</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                ЕИК {c.eik}
                {c.blockedAt && <strong className="ml-2 text-red-700 dark:text-red-400">Фирмата е блокирана</strong>}
              </p>
            </div>
            {canBlock && (
              <form action={setCompanyBlockedAction} className="text-sm">
                <input type="hidden" name="companyId" value={c.id} />
                <BlockButton blocked={!!c.blockedAt} label="Блокирай фирмата" unlabel="Отблокирай фирмата" />
              </form>
            )}
          </div>
          <ul className="mt-3 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {c.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {u.email} <span className="text-zinc-600 dark:text-zinc-400">- {STATUS_LABEL[u.status]}</span>
                </span>
                {canBlock && (
                  <form action={setUserBlockedAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <BlockButton blocked={u.status === "blocked"} label="Блокирай профила" unlabel="Отблокирай профила" />
                  </form>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
