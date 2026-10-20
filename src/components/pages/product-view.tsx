import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Price, PricesProvider } from "@/components/prices";
import { ProductImage } from "@/components/product-image";
import { ProductSpecs } from "@/components/product-specs";
import { getDict, localePath, type Lang } from "@/i18n";
import { getPublicProduct } from "@/lib/catalog";
import { getEnv } from "@/lib/env";
import { alternatesFor, pageUrl } from "@/lib/page-meta";
import { productDescription } from "@/lib/product-text";
import { productJsonLd, serializeJsonLd } from "@/lib/seo";

type Params = Promise<{ slug: string }>;

export async function productMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return { title: getDict(lang).product.notFoundTitle };
  await connection();
  const path = `/products/${product.slug}`;
  const description = productDescription(product, lang).slice(0, 160);
  // No price in title, description or Open Graph data.
  return {
    title: product.name,
    description,
    alternates: alternatesFor(lang, path),
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url: pageUrl(lang, path),
      locale: getDict(lang).ogLocale,
    },
  };
}

export async function ProductView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();
  const t = getDict(lang);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <Link href={localePath(lang, "/products")} className="text-sm underline">
        {t.product.back}
      </Link>
      <article className="mt-6 grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductImage sku={product.sku} alt={product.name} priority className="rounded-lg" />
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {productDescription(product, lang)}
          </p>
          <ProductSpecs product={product} lang={lang} />
          <PricesProvider slugs={[product.slug]}>
            <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <Price slug={product.slug} lang={lang} className="text-lg" />
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t.price.note}</p>
            </div>
          </PricesProvider>
          {/* The form itself is phase 4; until then /inquiry is an empty placeholder (Bulgarian only). */}
          <Link
            href={`/inquiry?product=${encodeURIComponent(product.slug)}`}
            className="w-fit rounded bg-zinc-900 px-5 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t.product.inquiry}
          </Link>
        </div>
        {/* Serialised and escaped by serializeJsonLd; contains no price. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              productJsonLd(
                { slug: product.slug, name: product.name, description: productDescription(product, lang) },
                getEnv().APP_URL,
                lang,
              ),
            ),
          }}
        />
      </article>
    </main>
  );
}
