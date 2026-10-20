import type { PublicProduct } from "@/lib/catalog";
import { seriesName } from "@/lib/series";

const nf = new Intl.NumberFormat("bg-BG");

export function specSummary(p: PublicProduct): string | null {
  const parts = [
    p.ports !== null ? `${nf.format(p.ports)} порта` : null,
    p.fibers !== null ? `${nf.format(p.fibers)} влакна` : null,
    p.rackUnits !== null ? `${p.rackUnits}RU` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

// Key numbers and the full table. A value that is not known is not shown
// (nothing is invented); technical data the catalog does not have is listed
// as "по запитване".
export function ProductSpecs({ product: p }: { product: PublicProduct }) {
  const tiles = [
    ["Портове", p.ports !== null ? nf.format(p.ports) : null],
    ["Влакна", p.fibers !== null ? nf.format(p.fibers) : null],
    ["Височина", p.rackUnits !== null ? `${p.rackUnits}RU` : null],
    ["Конектор", p.connector],
  ].filter((t): t is [string, string] => t[1] !== null);

  const rows: [string, string][] = [];
  const add = (label: string, value: string | null) => {
    if (value) rows.push([label, value]);
  };
  add("Модел (SKU)", p.sku);
  add("Серия", seriesName(p.series));
  add("Конектор", p.connector);
  add("Портове", p.ports !== null ? nf.format(p.ports) : null);
  add("MPO портове", p.mpoPorts !== null ? nf.format(p.mpoPorts) : null);
  add("Влакна (стандартна конфигурация)", p.fibers !== null ? nf.format(p.fibers) : null);
  add("Варианти до (влакна)", p.maxFibersVariant !== null ? nf.format(p.maxFibersVariant) : null);
  add("Височина", p.rackUnits !== null ? `${p.rackUnits}RU` : null);
  add("Влакна на RU", p.fibersPerRu !== null ? nf.format(p.fibersPerRu) : null);
  add("Сплайс", p.splice === null ? null : p.splice ? "Да" : "Не");
  // Shown only when the front door exists; "unknown" and "no" show nothing.
  add("Предна врата", p.frontDoor === true ? "Да" : null);

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
        <ul className="flex flex-wrap gap-2" aria-label="Варианти на полиране и влакно">
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
            <caption className="sr-only">Спецификации</caption>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {label}
                  </th>
                  <td className="py-2">{value}</td>
                </tr>
              ))}
              {["Материал и цвят", "Размери и тегло", "Загуби (IL/RL)"].map((label) => (
                <tr key={label} className="border-b border-zinc-200 dark:border-zinc-800">
                  <th scope="row" className="py-2 pr-4 font-medium">
                    {label}
                  </th>
                  <td className="py-2 text-zinc-500">По запитване</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
