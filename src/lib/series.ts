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
