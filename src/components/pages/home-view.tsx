import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold sm:text-5xl">{SITE.name}</h1>
        <p className="mt-3 text-xl text-zinc-700 dark:text-zinc-300">{t.lead}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={localePath(lang, "/products")}
            className="rounded bg-zinc-900 px-5 py-3 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {t.browse}
          </Link>
          <Link href="/inquiry" className="rounded border border-zinc-500 px-5 py-3 font-medium">
            {t.quote}
          </Link>
        </div>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{t.note}</p>
      </section>

      <Suspense fallback={<div className="mt-10 h-24" aria-hidden />}>
        <Numbers lang={lang} />
      </Suspense>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">{t.featuresTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-3">
          {t.features.map(([title, text]) => (
            <li key={title} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">{t.seriesTitle}</h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SERIES_KEYS.map((key) => (
            <li key={key}>
              <Link
                href={localePath(lang, `/series/${key}`)}
                className="block rounded-lg border border-zinc-300 p-4 font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                {seriesName(key, lang)}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">{t.applicationsTitle}</h2>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {t.applications.map(([abbr, text]) => (
            <li key={abbr} className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
              <div className="text-xl font-semibold">{abbr}</div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">{text}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-lg border border-zinc-300 p-6 dark:border-zinc-700">
        <h2 className="text-xl font-semibold">{t.ctaTitle}</h2>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">{t.ctaText}</p>
        <div className="mt-4 flex gap-4">
          <Link href="/register" className="underline">
            {t.ctaRegister}
          </Link>
          <Link href="/login" className="underline">
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
  const density = products.flatMap((p) => (p.fibersPerRu === null ? [] : [p.fibersPerRu]));
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
        <li key={label} className="rounded-lg border border-zinc-300 p-4 text-center dark:border-zinc-700">
          <div className="text-4xl font-semibold">{value}</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{label}</div>
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
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd(SITE.name, getEnv().APP_URL)) }}
    />
  );
}
