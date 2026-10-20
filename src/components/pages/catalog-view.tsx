import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogFiltersForm } from "@/components/catalog-filters";
import { PricesProvider } from "@/components/prices";
import { ProductCard } from "@/components/product-card";
import { getDict, localePath, type Lang } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import { applyFilters, parseFilters } from "@/lib/catalog-filter";
import { SERIES_KEYS, seriesName } from "@/lib/series";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function CatalogView({ lang, searchParams }: { lang: Lang; searchParams: SearchParams }) {
  const t = getDict(lang).catalog;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <section className="mb-8 max-w-2xl sm:mb-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">{t.title}</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">{t.intro}</p>
        <nav aria-label={t.seriesNav} className="mt-4 flex flex-wrap gap-2">
          {SERIES_KEYS.map((key) => (
            <Link
              key={key}
              href={localePath(lang, `/series/${key}`)}
              className="rounded-full border border-zinc-400 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-900"
            >
              {seriesName(key, lang)}
            </Link>
          ))}
        </nav>
      </section>
      <Suspense fallback={<GridSkeleton />}>
        <Catalog lang={lang} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Runs at request time (so the build needs no database); the product list
// itself is cached and shared, and carries no prices.
async function Catalog({ lang, searchParams }: { lang: Lang; searchParams: SearchParams }) {
  await connection();
  const t = getDict(lang).catalog;
  const all = await listPublicProducts();
  if (all.length === 0) {
    return <p>{t.empty}</p>;
  }
  const filters = parseFilters(await searchParams);
  const products = applyFilters(all, filters);
  return (
    <PricesProvider slugs={products.map((p) => p.slug)}>
      <CatalogFiltersForm filters={filters} lang={lang} />
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
        {t.shown(products.length, all.length)}
      </p>
      {products.length === 0 && <p>{t.noMatches}</p>}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} lang={lang} />
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
