import type { Metadata } from "next";
import { AboutView } from "@/components/pages/info-views";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("bg");
  return buildMetadata({
    lang: "bg",
    path: "/about",
    title: t.about.title,
    description: t.about.metaDescription(SITE.name),
  });
}

export default function Page() {
  return <AboutView lang="bg" />;
}
