import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductShowcase } from "@/components/showcase/product-showcase";
import { getDict, localePath, type Lang } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import { getEnv } from "@/lib/env";
import { organizationJsonLd, serializeJsonLd } from "@/lib/seo";
import { SERIES_KEYS, seriesName } from "@/lib/series";
import { SITE } from "@/lib/site";

// Draft copy: every number comes from the catalog data (see Numbers), and the
// wording is a proposal for the owner to approve. Nothing here shows a price.
// Sign-in and registration exist only in Bulgarian for now, so those links
// are not prefixed with /en.
export function HomeView({ lang }: { lang: Lang }) {
  const t = getDict(lang).home;
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8 sm:py-12">
      {/* Hero: a panel with the ember glow along its bottom edge. */}
      <section className="panel panel-glow px-6 pb-40 pt-16 text-center sm:px-12 sm:pb-52 sm:pt-24">
        <h1 className="t-display-xl mx-auto max-w-3xl text-primary">
          {SITE.name}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary">
          {t.lead}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={localePath(lang, "/products")}
            className="btn btn-primary"
          >
            {t.browse}
          </Link>
          <Link href="/inquiry" className="btn btn-secondary">
            {t.quote}
          </Link>
        </div>
        <p className="mx-auto mt-4 max-w-xl text-sm text-secondary">{t.note}</p>
      </section>

      <Suspense fallback={<div className="mt-8 h-24" aria-hidden />}>
        <Numbers lang={lang} />
      </Suspense>

      <section className="mt-16 sm:mt-24">
        <h2 className="t-display-l mb-8 text-center text-primary">
          {t.featuresTitle}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {t.features.map(([title, text]) => (
            <li key={title} className="card card-pad">
              <h3 className="text-primary">{title}</h3>
              <p className="mt-1 text-sm text-secondary">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <Suspense>
        <ProductShowcase lang={lang} />
      </Suspense>

      <section className="mt-16 sm:mt-24">
        <h2 className="t-display-l mb-8 text-center text-primary">
          {t.seriesTitle}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SERIES_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={localePath(lang, `/series/${key}`)}
                className="card card-pad card-interactive block font-medium text-primary"
              >
                {seriesName(key, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 sm:mt-24">
        <h2 className="t-display-l mb-8 text-center text-primary">
          {t.applicationsTitle}
        </h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.applications.map(([abbr, text]) => (
            <li key={abbr} className="card card-pad">
              <div className="t-card-title text-primary">{abbr}</div>
              <div className="text-sm text-secondary">{text}</div>
            </li>
          ))}
        </ul>
      </section>

      {/* Closing call to action: a panel with the ember glow. */}
      <section className="panel panel-glow mt-16 px-6 pb-36 pt-16 text-center sm:mt-24 sm:px-12 sm:pb-44">
        <h2 className="t-display-l mx-auto max-w-2xl text-primary">
          {t.ctaTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-secondary">{t.ctaText}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/register" className="btn btn-primary">
            {t.ctaRegister}
          </Link>
          <Link href="/login" className="btn btn-secondary">
            {t.ctaLogin}
          </Link>
        </div>
      </section>

      <Suspense>
        <OrganizationData />
      </Suspense>
    </main>
  );
}

// Numbers are computed from the published models, never typed by hand, so the
// page cannot claim more than the catalog says.
async function Numbers({ lang }: { lang: Lang }) {
  await connection();
  const dict = getDict(lang);
  const products = await listPublicProducts();
  const fibers = products.flatMap((p) => (p.fibers === null ? [] : [p.fibers]));
  const density = products.flatMap((p) =>
    p.fibersPerRu === null ? [] : [p.fibersPerRu],
  );
  if (products.length === 0 || fibers.length === 0) return null;
  const nf = new Intl.NumberFormat(dict.localeTag, { useGrouping: false });
  const items: [string, string][] = [
    [String(products.length), dict.home.stats.models],
    [nf.format(Math.max(...density)), dict.home.stats.density],
    [nf.format(Math.max(...fibers)), dict.home.stats.panel],
  ];
  return (
    <ul className="mt-10 grid gap-4 sm:grid-cols-3">
      {items.map(([value, label]) => (
        <li key={label} className="card card-pad text-center">
          <div className="t-price">{value}</div>
          <div className="mt-1 text-sm text-secondary">{label}</div>
        </li>
      ))}
    </ul>
  );
}

async function OrganizationData() {
  await connection();
  return (
    // Serialised and escaped by serializeJsonLd; name and URL only.
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(
          organizationJsonLd(SITE.name, getEnv().APP_URL),
        ),
      }}
    />
  );
}
