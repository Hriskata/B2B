import { connection } from "next/server";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { PricesProvider } from "@/components/prices";
import { listPublicProducts } from "@/lib/catalog";

// Template copy; the real texts come from the product owner (phase 6).
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <section className="mb-8 max-w-2xl sm:mb-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">Каталог за фирми</h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          Разгледайте продуктите ни. Цените се виждат след вход, а покупката става чрез запитване,
          при което цената се договаря. Минимална поръчка: 3 броя.
        </p>
      </section>
      <Suspense fallback={<GridSkeleton />}>
        <Catalog />
      </Suspense>
    </main>
  );
}

// Runs at request time (so the build needs no database); the product list
// itself is cached and shared, and carries no prices.
async function Catalog() {
  await connection();
  const products = await listPublicProducts();
  if (products.length === 0) {
    return <p>Все още няма добавени продукти.</p>;
  }
  return (
    <PricesProvider slugs={products.map((p) => p.slug)}>
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
