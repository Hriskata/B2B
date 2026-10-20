import type { PublicProduct } from "@/lib/catalog";
import { getDict, type Lang } from "@/i18n";
import { seriesName } from "@/lib/series";

export function specSummary(p: PublicProduct, lang: Lang): string | null {
  const t = getDict(lang).specs;
  const nf = new Intl.NumberFormat(getDict(lang).localeTag);
  const parts = [
    p.ports !== null ? `${nf.format(p.ports)} ${t.portsUnit}` : null,
    p.fibers !== null ? `${nf.format(p.fibers)} ${t.fibersUnit}` : null,
    p.rackUnits !== null ? `${p.rackUnits}RU` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// Key numbers and the full table. A value that is not known is not shown
// (nothing is invented); technical data the catalog does not have is listed
// as "on request".
export function ProductSpecs({ product: p, lang }: { product: PublicProduct; lang: Lang }) {
  const dict = getDict(lang);
  const t = dict.specs;
  const nf = new Intl.NumberFormat(dict.localeTag);
  const tiles = [
    [t.ports, p.ports !== null ? nf.format(p.ports) : null],
    [t.fibers, p.fibers !== null ? nf.format(p.fibers) : null],
    [t.height, p.rackUnits !== null ? `${p.rackUnits}RU` : null],
    [t.connector, p.connector],
  ].filter((x): x is [string, string] => x[1] !== null);

  const rows: [string, string][] = [];
  const add = (label: string, value: string | null) => {
    if (value) rows.push([label, value]);
  };
  add(t.sku, p.sku);
  add(t.series, seriesName(p.series, lang));
  add(t.connector, p.connector);
  add(t.ports, p.ports !== null ? nf.format(p.ports) : null);
  add(t.mpoPorts, p.mpoPorts !== null ? nf.format(p.mpoPorts) : null);
  add(t.fibersStandard, p.fibers !== null ? nf.format(p.fibers) : null);
  add(t.fibersUpTo, p.maxFibersVariant !== null ? nf.format(p.maxFibersVariant) : null);
  add(t.height, p.rackUnits !== null ? `${p.rackUnits}RU` : null);
  add(t.fibersPerRu, p.fibersPerRu !== null ? nf.format(p.fibersPerRu) : null);
  add(t.splice, p.splice === null ? null : p.splice ? t.yes : t.no);
  // Shown only when the front door exists; "unknown" and "no" show nothing.
  add(t.frontDoor, p.frontDoor === true ? t.yes : null);

  return (
    <>
      {tiles.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map(([label, value]) => (
            <li key={label} className="rounded-lg border border-zinc-300 p-3 text-center dark:border-zinc-700">
              <div className="text-2xl font-semibold">{value}</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
            </li>
          ))}
        </ul>
      )}
      {p.polish.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t.polishLabel}>
          {p.polish.map((v) => (
            <li key={v} className="rounded-full border border-zinc-400 px-3 py-1 text-sm dark:border-zinc-600">
              {v}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t.caption}</caption>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {label}
                  </th>
                  <td className="py-2">{value}</td>
                </tr>
              ))}
              {t.onRequestRows.map((label) => (
                <tr key={label} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {label}
                  </th>
                  <td className="py-2 text-zinc-500">{t.onRequest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
