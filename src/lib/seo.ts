import { localePath, type Lang } from "@/i18n";
import type { PublicProduct } from "./catalog";

// Structured data for search engines. It is built from PublicProduct, which
// has no price field, and it deliberately has no `offers` (checklist A: a
// guest must not get a price in JSON-LD).
export function productJsonLd(product: Pick<PublicProduct, "slug" | "name" | "description">, baseUrl: string, lang: Lang = "bg") {
  const root = baseUrl.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: `${root}${localePath(lang, `/products/${product.slug}`)}`,
  };
}

export function organizationJsonLd(name: string, baseUrl: string) {
  return { "@context": "https://schema.org", "@type": "Organization", name, url: baseUrl.replace(/\/$/, "") };
}

// Serialises JSON-LD for a <script type="application/ld+json"> tag. Characters
// that could close the tag or break out of the script are escaped, so catalog
// text can never inject markup.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replaceAll(String.fromCharCode(0x2028), "\\u2028")
    .replaceAll(String.fromCharCode(0x2029), "\\u2029");
}
