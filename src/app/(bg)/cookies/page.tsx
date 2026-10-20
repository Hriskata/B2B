import type { Metadata } from "next";
import { CookiesView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("bg");
  return buildMetadata({
    lang: "bg",
    path: "/cookies",
    title: t.legal.cookies,
    description: undefined,
    noindex: true,
  });
}

export default function Page() {
  return <CookiesView lang="bg" />;
}
