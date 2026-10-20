import type { Metadata } from "next";
import { FaqView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("en");
  return buildMetadata({
    lang: "en",
    path: "/faq",
    title: t.faq.title,
    description: t.faq.metaDescription,
  });
}

export default function Page() {
  return <FaqView lang="en" />;
}
