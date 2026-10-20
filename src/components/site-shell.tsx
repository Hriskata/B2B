import { Suspense } from "react";
import { getDict, type Lang } from "@/i18n";
import { Analytics } from "./analytics";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

// The <html> element and the shared frame of a language's root layout.
export function SiteShell({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <html lang={getDict(lang).htmlLang} className="h-full antialiased">
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
