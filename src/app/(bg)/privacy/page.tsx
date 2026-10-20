import type { Metadata } from "next";
import { PrivacyView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("bg");
  return buildMetadata({
    lang: "bg",
    path: "/privacy",
    title: t.legal.privacy,
    description: undefined,
    noindex: true,
  });
}

export default function Page() {
  return <PrivacyView lang="bg" />;
}
