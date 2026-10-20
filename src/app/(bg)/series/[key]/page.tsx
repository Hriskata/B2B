import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductCard } from "@/components/product-card";
import { PricesProvider } from "@/components/prices";
import { listPublicProducts } from "@/lib/catalog";
import { getEnv } from "@/lib/env";
import { SERIES, seriesName, SERIES_COMMON } from "@/lib/series";

// Only the four known series exist; any other key is a real 404.
export function generateStaticParams() {
  return SERIES.map((s) => ({ key: s.key }));
}

export async function generateMetadata({ params }: PageProps<"/series/[key]">): Promise<Metadata> {
  const { key } = await params;
  const name = seriesName(key);
  if (!name) return { title: "Серията не е намерена" };
  // APP_URL is runtime configuration: not read while the build prerenders.
  await connection();
  const url = `${getEnv().APP_URL.replace(/\/$/, "")}/series/${key}`;
  const description = `Модели от серия ${name}: параметри, влакна и височина.`;
  return {
    title: name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: name, description, url, locale: "bg_BG" },
  };
}

export default async function SeriesPage({ params }: PageProps<"/series/[key]">) {
  const { key } = await params;
  const name = seriesName(key);
  if (!name) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <Link href="/products" className="text-sm underline">
        ← Към каталога
      </Link>
      <h1 className="mt-6 text-3xl font-semibold">{name}</h1>
      <Suspense fallback={<p className="mt-6">Зареждане…</p>}>
        <Models seriesKey={key} />
      </Suspense>
      <section className="mt-10">
        <h2 className="mb-3 text-xl font-semibold">Общи характеристики на всички серии</h2>
        <ul className="list-disc pl-5 text-zinc-700 dark:text-zinc-300">
          {SERIES_COMMON.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Данните са от каталога на производителя. Материал, цвят, размери, тегло и загуби са по запитване.
        </p>
      </section>
    </main>
  );
}

async function Models({ seriesKey }: { seriesKey: string }) {
  await connection();
  const products = (await listPublicProducts()).filter((p) => p.series === seriesKey);
  if (products.length === 0) return <p className="mt-6">Няма публикувани модели в тази серия.</p>;

  const fibers = products.flatMap((p) => (p.fibers === null ? [] : [p.fibers]));
  const units = [...new Set(products.flatMap((p) => (p.rackUnits === null ? [] : [p.rackUnits])))].sort(
    (a, b) => a - b,
  );
  return (
    <>
      {/* Built only from the numbers of the models listed below. */}
      <p className="mt-3 max-w-2xl text-zinc-700 dark:text-zinc-300">
        {products.length} модела, от {Math.min(...fibers)} до {Math.max(...fibers)} влакна
        {units.length > 0 && `, височина ${units.map((u) => `${u}RU`).join(", ")}`}.
      </p>
      <PricesProvider slugs={products.map((p) => p.slug)}>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </ul>
      </PricesProvider>
    </>
  );
}
