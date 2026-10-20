// Product series of the ODFFiber catalog (names from the owner's catalog).
export const SERIES = [
  { key: "hds", name: "HDS – High-Density Splice" },
  { key: "uds", name: "UDS – Ultra-Density Splice" },
  { key: "quick-fit", name: "Quick-Fit (QFF / QFS)" },
  { key: "mpo", name: "MPO решения" },
] as const;

export type SeriesKey = (typeof SERIES)[number]["key"];

export function seriesName(key: string | null): string | null {
  return SERIES.find((s) => s.key === key)?.name ?? null;
}

// Features the catalog states for every model (docs/products.json "common").
// Shown once on the series pages, not repeated on each product. Material and
// colour are NOT here: they are unconfirmed.
export const SERIES_COMMON = [
  "Shuttered адаптери (със защитен затвор)",
  "Пред-оборудвани и пред-маршрутизирани пигтейли",
  "Съответствие: RoHS, REACH",
  "Работна температура: от −20 до +60 °C",
  "Прахово покритие",
  "Приложения: DCI, BEF, ENI, MDA",
] as const;
