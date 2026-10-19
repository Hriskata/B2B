import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { listAdminProducts } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/current";
import { formatMoney } from "@/lib/money";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Продукти (админ)" };

export default function AdminProductsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const admin = await requireAdmin();
  const products = await listAdminProducts();
  const editor = can(admin.role, "edit_catalog");
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Продукти и цени</h1>
        {editor && (
          <Link href="/admin/products/new" className="rounded bg-foreground px-4 py-2 font-medium text-background">
            Нов продукт
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-400">
              <th className="py-2 pr-3">Име</th>
              <th className="py-2 pr-3">Адрес</th>
              <th className="py-2 pr-3">Цена за бройка</th>
              <th className="py-2 pr-3">Статус</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="py-2 pr-3">{p.name}</td>
                <td className="py-2 pr-3 font-mono">{p.slug}</td>
                <td className="py-2 pr-3">{p.priceCents === null ? "-" : formatMoney(p.priceCents, "EUR")}</td>
                <td className="py-2 pr-3">{p.published ? "Публикуван" : "Скрит"}</td>
                <td className="py-2 text-right">
                  <Link href={`/admin/products/${p.id}`} className="underline">
                    {editor ? "Редакция" : "Преглед"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p className="py-4">Няма продукти.</p>}
      </div>
    </>
  );
}
