import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { firstInquiryYear, inquiryStats, type StatsPeriod } from "@/lib/admin/inquiries";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Статистика (админ)" };

// Inquiries per product (decided 13.11.2026): for a month, a year or all the
// time. Its own page in the menu: it is about inquiries, not about editing
// the catalog, and both roles may see it.

const MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];

function today(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month") };
}

// Anything odd in the address falls back to the current month.
function readPeriod(params: Record<string, string | string[] | undefined>): StatsPeriod {
  const now = today();
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const kind = one(params.period);
  if (kind === "all") return { kind: "all" };
  if (kind === "year") {
    const year = Number(one(params.year));
    return Number.isInteger(year) && year >= 2000 && year <= now.year ? { kind: "year", year } : { kind: "year", year: now.year };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(one(params.month));
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year >= 2000 && year <= now.year && month >= 1 && month <= 12) return { kind: "month", year, month };
  }
  return { kind: "month", year: now.year, month: now.month };
}

function title(period: StatsPeriod): string {
  if (period.kind === "all") return "за целия период";
  if (period.kind === "year") return `за ${period.year} г.`;
  return `за ${MONTHS[period.month - 1]} ${period.year} г.`;
}

export default function AdminStatisticsPage({ searchParams }: PageProps<"/admin/statistics">) {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-2">Статистика</h1>
      <p className="mb-6 text-sm text-secondary">
        Колко запитвания има за всеки продукт и колко бройки са поискани. Продукт се брои веднъж
        за всяко запитване, в което е поискан. Отказаните запитвания също се броят.
      </p>
      <Suspense>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/statistics">["searchParams"] }) {
  await requireAdmin();
  const period = readPeriod(await searchParams);
  const now = today();
  const [stats, firstYear] = await Promise.all([inquiryStats(period), firstInquiryYear()]);
  const years: number[] = [];
  for (let y = now.year; y >= Math.min(firstYear ?? now.year, now.year); y--) years.push(y);
  const monthValue =
    period.kind === "month"
      ? `${period.year}-${String(period.month).padStart(2, "0")}`
      : `${now.year}-${String(now.month).padStart(2, "0")}`;
  const tabs = [
    { kind: "month", label: "Месец", href: "/admin/statistics?period=month" },
    { kind: "year", label: "Година", href: "/admin/statistics?period=year" },
    { kind: "all", label: "Общо", href: "/admin/statistics?period=all" },
  ] as const;

  return (
    <>
      <nav aria-label="Период" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.kind}
            href={t.href}
            aria-current={period.kind === t.kind ? "page" : undefined}
            className={`btn ${period.kind === t.kind ? "btn-primary" : "btn-secondary"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {period.kind === "month" && (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="month" />
          <div className="flex flex-col gap-1">
            <label htmlFor="f-month" className="text-sm font-medium">
              Месец
            </label>
            <input id="f-month" type="month" name="month" defaultValue={monthValue} className="input" />
          </div>
          <button type="submit" className="btn btn-secondary">
            Покажи
          </button>
        </form>
      )}
      {period.kind === "year" && (
        <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
          <input type="hidden" name="period" value="year" />
          <div className="flex flex-col gap-1">
            <label htmlFor="f-year" className="text-sm font-medium">
              Година
            </label>
            <select id="f-year" name="year" defaultValue={String(period.year)} className="input">
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-secondary">
            Покажи
          </button>
        </form>
      )}

      <h2 className="mb-1 text-xl">Запитвания {title(period)}</h2>
      <p className="mb-4 text-secondary">
        Общо запитвания: <strong className="text-primary">{stats.totalInquiries.toLocaleString("bg-BG")}</strong>
      </p>

      {stats.products.length === 0 ? (
        <p>Няма продукти.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Продукт</th>
                <th className="py-2 pr-3 text-right">Запитвания</th>
                <th className="py-2 text-right">Поискани бройки</th>
              </tr>
            </thead>
            <tbody>
              {stats.products.map((p) => (
                <tr key={p.productId} className="border-b border-line">
                  <td className="py-2 pr-3">
                    {p.name}
                    {!p.published && <span className="ml-2 text-secondary">(скрит)</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.inquiries.toLocaleString("bg-BG")}</td>
                  <td className="py-2 text-right tabular-nums">{p.units.toLocaleString("bg-BG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
