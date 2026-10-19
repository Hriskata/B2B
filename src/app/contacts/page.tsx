import type { Metadata } from "next";
import { PENDING, SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Контакти" };

const ROWS: [string, string | null][] = [
  ["Фирма", SITE.operator.legalName],
  ["ЕИК", SITE.operator.eik],
  ["Адрес", SITE.operator.address],
  ["Имейл", SITE.operator.email],
  ["Телефон", SITE.operator.phone],
];

// Values come from src/lib/site.ts and stay "ЧАКА ДАННИ" until the owner
// provides them. Nothing is made up here.
export default function ContactsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Контакти</h1>
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
        {ROWS.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium">{label}</dt>
            <dd className={value ? "" : "font-semibold text-amber-700 dark:text-amber-400"}>
              {value ?? PENDING}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-zinc-700 dark:text-zinc-300">
        За цена и поръчка изпратете запитване от страницата на продукта (след вход).
      </p>
    </main>
  );
}
