import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import { rootMetadata } from "@/lib/page-meta";
import "../globals.css";

export function generateMetadata(): Promise<Metadata> {
  return rootMetadata("bg", "ODFFiber", "Каталог за фирми");
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <SiteShell lang="bg">{children}</SiteShell>;
}
