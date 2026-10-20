import type { Metadata } from "next";
import { TermsView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("en");
  return buildMetadata({
    lang: "en",
    path: "/terms",
    title: t.legal.terms,
    description: undefined,
    noindex: true,
  });
}

export default function Page() {
  return <TermsView lang="en" />;
}
