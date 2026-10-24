import Link from "next/link";
import { connection } from "next/server";
import { getDict, localePath, type Lang } from "@/i18n";
import { listPublicProducts } from "@/lib/catalog";
import { HotspotViewer, type ShowcaseItem } from "./hotspot-viewer";
import { MATERIAL_LAYOUT, SHOWCASE_SKU } from "./materials";

// The first catalog model with its parts. Every number comes from the catalog
// row; a part the row does not support is left out, nothing is invented.
export async function ProductShowcase({ lang }: { lang: Lang }) {
  await connection();
  const products = await listPublicProducts();
  const p = products.find((x) => x.sku === SHOWCASE_SKU);
  if (!p || p.ports === null || p.fibers === null) return null;

  const dict = getDict(lang);
  const t = dict.home.showcase;
  const text = t.items;
  const nf = new Intl.NumberFormat(dict.localeTag, { useGrouping: false });
  const pending = t.pending;

  const texts: Record<
    string,
    Omit<ShowcaseItem, "id" | "x" | "y" | "label" | "mask">
  > = {
    housing: { ...text.housing, pending },
    adapters: {
      name: text.adapters.name,
      short: text.adapters.short(p.ports),
      more: p.polish.length ? text.adapters.more(p.polish.join(", ")) : "",
    },
    ear: { ...text.ear, pending },
    pigtails: {
      name: text.pigtails.name,
      short: text.pigtails.short(p.fibers),
      more:
        p.maxFibersVariant !== null
          ? text.pigtails.more(p.maxFibersVariant)
          : "",
    },
    splice: { ...text.splice },
    door: { ...text.door },
  };
  // Parts the model does not have in the catalog are not shown.
  const hidden = new Set<string>();
  if (p.frontDoor !== true) hidden.add("door");
  if (p.splice !== true) hidden.add("splice");

  const items: ShowcaseItem[] = MATERIAL_LAYOUT.filter(
    (m) => !hidden.has(m.id),
  ).map((m) => ({ ...m, ...texts[m.id] }));

  const facts = [
    [dict.specs.ports, nf.format(p.ports)],
    [dict.specs.fibers, nf.format(p.fibers)],
    p.rackUnits !== null ? [dict.specs.height, `${p.rackUnits}RU`] : null,
    p.maxFibersVariant !== null
      ? [dict.specs.fibersUpTo, nf.format(p.maxFibersVariant)]
      : null,
  ].filter((x): x is string[] => x !== null);

  return (
    <section className="mt-16 sm:mt-24" aria-labelledby="showcase-title">
      <p className="t-label mb-3 text-center text-ember-300">{t.eyebrow}</p>
      <h2 id="showcase-title" className="t-display-l text-center text-primary">
        {p.name}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-secondary">
        {t.lead}
      </p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {facts.map(([label, value]) => (
          <li key={label} className="pill">
            <span className="mr-2 text-primary">{value}</span>
            {label}
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <HotspotViewer
          items={items}
          src={`/images/products/${SHOWCASE_SKU.toLowerCase()}.webp`}
          alt={p.name}
          labels={{
            list: t.listLabel,
            inside: t.insideTitle,
            pending: t.pending,
            failed: t.imageFailed,
          }}
        />
      </div>
      <p className="mt-6 text-center">
        <Link
          href={localePath(lang, `/products/${p.slug}`)}
          className="btn btn-secondary"
        >
          {t.open}
        </Link>
      </p>
    </section>
  );
}
