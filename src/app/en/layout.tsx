import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import "../globals.css";

// Root layout of the English site (/en/...). The Bulgarian one is in (bg).
export const metadata: Metadata = {
  title: "ODFFiber",
  description: "Catalogue for businesses",
};

export default function EnglishRootLayout({ children }: LayoutProps<"/en">) {
  return <SiteShell lang="en">{children}</SiteShell>;
}
