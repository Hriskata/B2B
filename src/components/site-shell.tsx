import { Inter } from "next/font/google";
import { Suspense } from "react";
import { getDict, type Lang } from "@/i18n";
import { Analytics } from "./analytics";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// Inter, downloaded at build time and served from our own host (no request
// to Google when a visitor opens the site). Cyrillic is needed for Bulgarian.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

// The <html> element and the shared frame of a language's root layout.
export function SiteShell({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) {
  return (
    <html
      lang={getDict(lang).htmlLang}
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader lang={lang} />
        {children}
        <SiteFooter lang={lang} />
        <Suspense fallback={null}>
          <Analytics lang={lang} />
        </Suspense>
      </body>
    </html>
  );
}
