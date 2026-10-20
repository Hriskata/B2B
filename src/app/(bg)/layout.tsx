import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import "../globals.css";

export const metadata: Metadata = {
  title: "ODFFiber",
  description: "Каталог за фирми",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <SiteShell lang="bg">{children}</SiteShell>;
}
