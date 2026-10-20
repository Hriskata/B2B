import type { Metadata } from "next";
import { SeriesView, seriesMetadata } from "@/components/pages/series-view";
import { SERIES_KEYS } from "@/lib/series";

// Only the four known series exist; any other key is a real 404.
export function generateStaticParams() {
  return SERIES_KEYS.map((key) => ({ key }));
}

export function generateMetadata({ params }: PageProps<"/series/[key]">): Promise<Metadata> {
  return seriesMetadata("bg", params);
}

export default function Page({ params }: PageProps<"/series/[key]">) {
  return <SeriesView lang="bg" params={params} />;
}
