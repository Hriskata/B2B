import { connection } from "next/server";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { PricesProvider } from "@/components/prices";
import Link from "next/link";
import { CatalogFiltersForm } from "@/components/catalog-filters";
import { listPublicProducts } from "@/lib/catalog";
import { applyFilters, parseFilters } from "@/lib/catalog-filter";
import { SERIES } from "@/lib/series";

// Template copy; the real texts come from the product owner (phase 6).
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <section className="mb-8 max-w-2xl sm:mb-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Каталог за фирми</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          Разгледайте продуктите ни. Цените се виждат след вход, а покупката става чрез запитване,
          при което цената се договаря. Минимална поръчка: 3 броя.
        </p>
        <nav aria-label="Серии" className="mt-4 flex flex-wrap gap-2">
          {SERIES.map((s) => (
            <Link
              key={s.key}
              href={`/series/${s.key}`}
              className="rounded-full border border-zinc-400 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              {s.name}
            </Link>
          ))}
        </nav>
      </section>
      <Suspense fallback={<GridSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Runs at request time (so the build needs no database); the product list
// itself is cached and shared, and carries no prices.
async function Catalog({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const all = await listPublicProducts();
  if (all.length === 0) {
    return <p>Все още няма добавени продукти.</p>;
  }
  const filters = parseFilters(await searchParams);
  const products = applyFilters(all, filters);
  return (
    <PricesProvider slugs={products.map((p) => p.slug)}>
      <CatalogFiltersForm filters={filters} />
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
        Показани модели: {products.length} от {all.length}
      </p>
      {products.length === 0 && <p>Няма модели с избраните филтри.</p>}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </ul>
    </PricesProvider>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="h-72 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </ul>
  );
}
