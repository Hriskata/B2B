import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current";
import { listAudit, type AuditAction } from "@/lib/audit";

export const metadata: Metadata = { title: "Журнал (админ)" };

const LABEL: Record<AuditAction, string> = {
  "product.create": "Нов продукт",
  "product.update": "Промяна на продукт",
  "price.change": "Промяна на цена",
  "user.block": "Блокиран профил",
  "user.unblock": "Отблокиран профил",
  "company.block": "Блокирана фирма",
  "company.unblock": "Отблокирана фирма",
  "admin.2fa_reset": "Нулирана 2FA на админ",
};

const when = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Sofia",
});

export default function AdminAuditPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Журнал на промените</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

function describe(details: Record<string, string | number | boolean | null>): string {
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v === null ? "-" : String(v)}`)
    .join(", ");
}

// Plain text rendering only: React escapes every value.
async function Content() {
  await requireAdmin();
  const entries = await listAudit(200);
  if (entries.length === 0) return <p>Все още няма записи.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-400">
            <th className="py-2 pr-3">Кога</th>
            <th className="py-2 pr-3">Кой</th>
            <th className="py-2 pr-3">Какво</th>
            <th className="py-2">Подробности</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
              <td className="py-2 pr-3 whitespace-nowrap">{when.format(e.createdAt)}</td>
              <td className="py-2 pr-3">{e.actorEmail}</td>
              <td className="py-2 pr-3">{LABEL[e.action as AuditAction] ?? e.action}</td>
              <td className="py-2 break-words text-zinc-700 dark:text-zinc-300">{describe(e.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
