import { getDict, type Lang } from "@/i18n";

// Product series of the ODFFiber catalog. Display names and the features
// common to all series are in the language dictionaries (src/i18n).
export const SERIES_KEYS = ["hds", "uds", "quick-fit", "mpo"] as const;

export type SeriesKey = (typeof SERIES_KEYS)[number];

export function isSeriesKey(key: string | null): key is SeriesKey {
  return SERIES_KEYS.some((k) => k === key);
}

export function seriesName(key: string | null, lang: Lang = "bg"): string | null {
  return isSeriesKey(key) ? getDict(lang).series[key] : null;
}
