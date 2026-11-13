import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { rootMetadata } from "@/lib/page-meta";
import "../globals.css";

// Root layout of the English site (/en/...). The Bulgarian one is in (bg).
export function generateMetadata(): Promise<Metadata> {
  return rootMetadata("en", "ODFFiber", "Catalogue for businesses");
}

export default function EnglishRootLayout({ children }: LayoutProps<"/en">) {
  return <SiteShell lang="en">{children}</SiteShell>;
}
