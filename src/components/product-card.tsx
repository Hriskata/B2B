import Link from "next/link";
import type { PublicProduct } from "@/lib/catalog";
import { localePath, type Lang } from "@/i18n";
import { productDescription } from "@/lib/product-text";
import { Price } from "./prices";
import { ProductImage } from "./product-image";
import { specSummary } from "./product-specs";

export function ProductCard({ product, lang }: { product: PublicProduct; lang: Lang }) {
  const href = localePath(lang, `/products/${product.slug}`);
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-zinc-300 dark:border-zinc-700">
      <Link href={href} className="block" aria-label={product.name}>
        <ProductImage />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-lg font-semibold">
          <Link href={href} className="hover:underline">
            {product.name}
          </Link>
        </h2>
        {product.sku && <p className="text-xs text-zinc-500">{product.sku}</p>}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {specSummary(product, lang) ?? productDescription(product, lang)}
        </p>
        <Price slug={product.slug} lang={lang} className="mt-auto pt-2 text-sm" />
      </div>
    </li>
  );
}
