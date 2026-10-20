import Link from "next/link";
import type { PublicProduct } from "@/lib/catalog";
import { localePath, type Lang } from "@/i18n";
import { productDescription } from "@/lib/product-text";
import { Price } from "./prices";
import { ProductImage } from "./product-image";
import { specSummary } from "./product-specs";

export function ProductCard({
  product,
  lang,
}: {
  product: PublicProduct;
  lang: Lang;
}) {
  const href = localePath(lang, `/products/${product.slug}`);
  return (
    <li className="card card-interactive flex flex-col overflow-hidden p-3">
      <Link href={href} className="block" aria-label={product.name}>
        <ProductImage sku={product.sku} alt={product.name} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2 pt-4">
        <h2 className="t-card-title">
          <Link href={href} className="text-primary hover:text-ember-300">
            {product.name}
          </Link>
        </h2>
        {product.sku && <p className="t-small text-secondary">{product.sku}</p>}
        <p className="text-sm text-secondary">
          {specSummary(product, lang) ?? productDescription(product, lang)}
        </p>
        <Price
          slug={product.slug}
          lang={lang}
          className="mt-auto pt-2 text-sm"
        />
      </div>
    </li>
  );
}
