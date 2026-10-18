import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Price, PricesProvider } from "@/components/prices";
import { ProductImage } from "@/components/product-image";
import { getPublicProduct } from "@/lib/catalog";
import { getEnv } from "@/lib/env";
import { productJsonLd, serializeJsonLd } from "@/lib/seo";

// The product is looked up BEFORE anything streams, so an unknown or
// unpublished slug gets a real HTTP 404 (not a "soft 404" with status 200,
// which search engines handle badly). The slug is only known at request time,
// so this page is rendered per request; the product data itself is cached.
export const instant = false;

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) return { title: "Продуктът не е намерен" };
  const url = `${getEnv().APP_URL.replace(/\/$/, "")}/products/${product.slug}`;
  const description = product.description.slice(0, 160);
  // No price in title, description or Open Graph data.
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title: product.name, description, url, locale: "bg_BG" },
  };
}

export default async function ProductPage({ params }: PageProps<"/products/[slug]">) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <Link href="/" className="text-sm underline">
        ← Към каталога
      </Link>
      <article className="mt-6 grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductImage className="rounded-lg" />
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{product.description}</p>
          <PricesProvider slugs={[product.slug]}>
            <div className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <Price slug={product.slug} className="text-lg" />
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Цената е за единична бройка и се договаря при запитване. Минимална поръчка: 3 броя.
              </p>
            </div>
          </PricesProvider>
        </div>
        {/* Serialised and escaped by serializeJsonLd; contains no price. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(productJsonLd(product, getEnv().APP_URL)),
          }}
        />
      </article>
    </main>
  );
}
