import type { Metadata } from "next";
import { ProductView, productMetadata } from "@/components/pages/product-view";

// The product is looked up BEFORE anything streams, so an unknown or
// unpublished slug gets a real HTTP 404 (not a "soft 404" with status 200,
// which search engines handle badly). The slug is only known at request time,
// so this page is rendered per request; the product data itself is cached.
export const instant = false;

export function generateMetadata({
  params,
}: PageProps<"/en/products/[slug]">): Promise<Metadata> {
  return productMetadata("en", params);
}

export default function Page({ params }: PageProps<"/en/products/[slug]">) {
  return <ProductView lang="en" params={params} />;
}
