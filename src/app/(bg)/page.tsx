import type { Metadata } from "next";
import { HomeView } from "@/components/pages/home-view";
import { getDict } from "@/i18n";
import { buildMetadata } from "@/lib/page-meta";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDict("bg").home;
  return buildMetadata({ lang: "bg", path: "/", title: t.metaTitle, description: t.metaDescription });
}

export default function Page() {
  return <HomeView lang="bg" />;
}
