import type { Metadata } from "next";
import { PrivacyView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("en");
  return buildMetadata({
    lang: "en",
    path: "/privacy",
    title: t.legal.privacy,
    description: undefined,
    noindex: true,
  });
}

export default function Page() {
  return <PrivacyView lang="en" />;
}
