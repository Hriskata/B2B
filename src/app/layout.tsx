import type { Metadata } from "next";
import "./globals.css";

// Placeholder site name until branding is provided.
export const metadata: Metadata = {
  title: "B2B каталог",
  description: "Каталог за фирми",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bg" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
