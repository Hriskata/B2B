import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Placeholder site name until branding is provided.
export const metadata: Metadata = {
  title: "B2B каталог",
  description: "Каталог за фирми",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
