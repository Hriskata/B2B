import type { Metadata } from "next";
import { CatalogView } from "@/components/pages/catalog-view";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("en").catalog;
  return buildMetadata({
    lang: "en",
    path: "/products",
    title: t.title,
    description: t.metaDescription,
  });
}

export default function Page({ searchParams }: PageProps<"/en/products">) {
  return <CatalogView lang="en" searchParams={searchParams} />;
}
