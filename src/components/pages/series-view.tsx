import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PricesProvider } from "@/components/prices";
import { ProductCard } from "@/components/product-card";
import { getDict, localePath, type Lang } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import { alternatesFor, pageUrl } from "@/lib/page-meta";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/seo";
import { seriesName } from "@/lib/series";

type Params = Promise<{ key: string }>;

export async function seriesMetadata(
  lang: Lang,
  params: Params,
): Promise<Metadata> {
  const { key } = await params;
  const t = getDict(lang);
  const name = seriesName(key, lang);
  if (!name) return { title: t.seriesPage.notFoundTitle };
  // APP_URL is runtime configuration: not read while the build prerenders.
  await connection();
  const path = `/series/${key}`;
  const description = t.seriesPage.metaDescription(name);
  return {
    title: name,
    description,
    alternates: alternatesFor(lang, path),
    openGraph: {
      type: "website",
      title: name,
      description,
      url: pageUrl(lang, path),
      locale: t.ogLocale,
    },
  };
}

export async function SeriesView({
  lang,
  params,
}: {
  lang: Lang;
  params: Params;
}) {
  const { key } = await params;
  const t = getDict(lang).seriesPage;
  const name = seriesName(key, lang);
  if (!name) notFound();

  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 sm:py-12">
      <Link href={localePath(lang, "/products")} className="text-sm underline">
        {t.back}
      </Link>
      <h1 className="mt-6">{name}</h1>
      <Suspense>
        <Breadcrumbs lang={lang} seriesKey={key} name={name} />
      </Suspense>
      <Suspense fallback={<p className="mt-6">{t.loading}</p>}>
        <Models seriesKey={key} lang={lang} />
      </Suspense>
      <section className="mt-10">
        <h2 className="mb-3">{t.commonTitle}</h2>
        <ul className="list-disc pl-5 text-secondary">
          {t.common.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-secondary">{t.commonNote}</p>
      </section>
    </main>
  );
}

async function Models({ seriesKey, lang }: { seriesKey: string; lang: Lang }) {
  await connection();
  const t = getDict(lang).seriesPage;
  const products = (await listPublicProducts()).filter(
    (p) => p.series === seriesKey,
  );
  if (products.length === 0) return <p className="mt-6">{t.empty}</p>;

  const fibers = products.flatMap((p) => (p.fibers === null ? [] : [p.fibers]));
  const units = [
    ...new Set(
      products.flatMap((p) => (p.rackUnits === null ? [] : [p.rackUnits])),
    ),
  ].sort((a, b) => a - b);
  return (
    <>
      {/* Built only from the numbers of the models listed below. */}
      <p className="mt-3 max-w-2xl text-secondary">
        {t.summary(
          products.length,
          Math.min(...fibers),
          Math.max(...fibers),
          units.map((u) => `${u}RU`).join(", "),
        )}
      </p>
      <PricesProvider slugs={products.map((p) => p.slug)}>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} lang={lang} />
          ))}
        </ul>
      </PricesProvider>
    </>
  );
}

// Structured data only (no visible output). Reads APP_URL, so it runs at request time.
async function Breadcrumbs({
  lang,
  seriesKey,
  name,
}: {
  lang: Lang;
  seriesKey: string;
  name: string;
}) {
  await connection();
  const t = getDict(lang);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(
          breadcrumbJsonLd([
            { name: t.header.products, url: pageUrl(lang, "/products") },
            { name, url: pageUrl(lang, `/series/${seriesKey}`) },
          ]),
        ),
      }}
    />
  );
}
