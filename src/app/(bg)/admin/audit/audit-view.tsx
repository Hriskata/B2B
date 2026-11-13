import Link from "next/link";
import { requireAdmin } from "@/lib/auth/current";
import { listAudit, type AuditAction, type AuditSource } from "@/lib/audit";

// The journal has two parts (decided 11.11.2026): changes people make by hand
// in the admin portal, and entries from test accounts during development
// (admins.is_test), so the checks do not mix with real work.

const LABEL: Record<AuditAction, string> = {
  "product.create": "Нов продукт",
  "product.update": "Промяна на продукт",
  "price.change": "Промяна на цена",
  "user.block": "Блокиран профил",
  "user.unblock": "Отблокиран профил",
  "company.block": "Блокирана фирма",
  "company.unblock": "Отблокирана фирма",
  "admin.2fa_reset": "Нулирана 2FA на админ",
  "admin.create": "Добавен администратор",
  "admin.invite_resend": "Нова покана за администратор",
  "admin.password_change": "Смяна на парола на админ",
  "admin.kind_change": "Смяна на типа на админ (поддръжка / собственик)",
  "inquiry.accept": "Поето запитване (неактивна фирма)",
  "inquiry.decline": "Отказано запитване (неактивна фирма)",
  "registration.approve": "Одобрена регистрация",
  "registration.reject": "Отхвърлена регистрация",
};

const TABS: { source: AuditSource; href: string; label: string }[] = [
  { source: "portal", href: "/admin/audit", label: "Ръчни промени" },
  { source: "dev", href: "/admin/audit/dev", label: "От разработка" },
];

const INTRO: Record<AuditSource, string> = {
  portal: "Промени, направени от администратори през админ портала.",
  dev: "Записи от тестови акаунти по време на разработката (автоматични проверки). Не са действия на хора.",
};

const when = new Intl.DateTimeFormat("bg-BG", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Sofia",
});

function describe(details: Record<string, string | number | boolean | null>): string {
  return Object.entries(details)
    .map(([k, v]) => `${k}: ${v === null ? "-" : String(v)}`)
    .join(", ");
}

export function AuditTabs({ current }: { current: AuditSource }) {
  return (
    <nav aria-label="Части на журнала" className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.source}
          href={t.href}
          aria-current={t.source === current ? "page" : undefined}
          className={`btn ${t.source === current ? "btn-primary" : "btn-secondary"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

// Plain text rendering only: React escapes every value.
export async function AuditEntries({ source }: { source: AuditSource }) {
  await requireAdmin();
  const entries = await listAudit(source, 200);
  return (
    <>
      <p className="mb-4 text-sm text-secondary">{INTRO[source]}</p>
      {entries.length === 0 ? (
        <p>Все още няма записи.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Кога</th>
                <th className="py-2 pr-3">Кой</th>
                <th className="py-2 pr-3">Какво</th>
                <th className="py-2">Подробности</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-line align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{when.format(e.createdAt)}</td>
                  <td className="py-2 pr-3">{e.actorEmail}</td>
                  <td className="py-2 pr-3">{LABEL[e.action as AuditAction] ?? e.action}</td>
                  <td className="py-2 break-words text-secondary">{describe(e.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
