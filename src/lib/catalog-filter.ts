import type { PublicProduct } from "./catalog";
import { SERIES_KEYS } from "./series";

// Filtering and sorting of the public catalog. Pure and driven only by URL
// query parameters, so a filtered view can be shared as a link. Unknown or
// malformed values are ignored (never an error, never reflected into HTML).

export const CONNECTORS = ["SC", "LC", "MPO"] as const;
export const RACK_UNITS = [1, 2, 3, 4, 6] as const;
export const SORTS = ["default", "fibers-asc", "fibers-desc", "density-asc", "density-desc"] as const;
export type Sort = (typeof SORTS)[number];

export type CatalogFilters = {
  series: string | null;
  connector: string | null;
  rackUnits: number | null;
  fibersMin: number | null;
  fibersMax: number | null;
  splice: boolean | null;
  sort: Sort;
};

type Query = Record<string, string | string[] | undefined>;

function first(query: Query, key: string): string | undefined {
  const v = query[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return allowed.find((a) => a === value) ?? null;
}

function posInt(value: string | undefined): number | null {
  if (!value || !/^\d{1,5}$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}

export function parseFilters(query: Query): CatalogFilters {
  const ru = posInt(first(query, "ru"));
  const splice = first(query, "splice");
  return {
    series: oneOf(first(query, "series"), SERIES_KEYS),
    connector: oneOf(first(query, "connector"), CONNECTORS),
    rackUnits: ru !== null && (RACK_UNITS as readonly number[]).includes(ru) ? ru : null,
    fibersMin: posInt(first(query, "fmin")),
    fibersMax: posInt(first(query, "fmax")),
    splice: splice === "1" ? true : splice === "0" ? false : null,
    sort: oneOf(first(query, "sort"), SORTS) ?? "default",
  };
}

export function hasActiveFilters(f: CatalogFilters): boolean {
  return (
    f.series !== null || f.connector !== null || f.rackUnits !== null || f.fibersMin !== null ||
    f.fibersMax !== null || f.splice !== null || f.sort !== "default"
  );
}

// "LC/MPO" panels match both LC and MPO.
function hasConnector(connector: string | null, wanted: string): boolean {
  return connector !== null && connector.split("/").includes(wanted);
}

export function applyFilters(products: PublicProduct[], f: CatalogFilters): PublicProduct[] {
  const result = products.filter(
    (p) =>
      (f.series === null || p.series === f.series) &&
      (f.connector === null || hasConnector(p.connector, f.connector)) &&
      (f.rackUnits === null || p.rackUnits === f.rackUnits) &&
      (f.fibersMin === null || (p.fibers !== null && p.fibers >= f.fibersMin)) &&
      (f.fibersMax === null || (p.fibers !== null && p.fibers <= f.fibersMax)) &&
      (f.splice === null || p.splice === f.splice),
  );
  const key = f.sort.startsWith("fibers") ? "fibers" : f.sort.startsWith("density") ? "fibersPerRu" : null;
  if (key) {
    const dir = f.sort.endsWith("desc") ? -1 : 1;
    // Stable sort; products without a value go last in both directions.
    result.sort((a, b) => {
      const x = a[key];
      const y = b[key];
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return (x - y) * dir;
    });
  }
  return result;
}
