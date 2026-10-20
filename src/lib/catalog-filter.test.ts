import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PublicProduct } from "./catalog";
import { applyFilters, hasActiveFilters, parseFilters } from "./catalog-filter";
import { parseProductsFile } from "./product-import";

// The real 25 models, shaped like the public catalog rows.
const all: PublicProduct[] = parseProductsFile(JSON.parse(readFileSync("docs/products.json", "utf8"))).products.map(
  (p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    descriptionEn: null,
    sku: p.sku,
    series: p.series,
    connector: p.connector,
    ports: p.ports,
    mpoPorts: p.mpoPorts,
    fibers: p.fibers,
    maxFibersVariant: p.maxFibersVariant,
    rackUnits: p.rackUnits,
    fibersPerRu: p.fibers / p.rackUnits,
    polish: p.polish,
    splice: p.splice,
    frontDoor: p.frontDoor,
  }),
);

const run = (query: Record<string, string | string[] | undefined>) => applyFilters(all, parseFilters(query));

describe("parseFilters", () => {
  it("ignores unknown and malformed values", () => {
    const f = parseFilters({ series: "<script>", connector: "XX", ru: "5", fmin: "-1", fmax: "abc", splice: "x", sort: "evil" });
    expect(f).toEqual({
      series: null, connector: null, rackUnits: null, fibersMin: null, fibersMax: null, splice: null, sort: "default",
    });
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseFilters({ series: ["hds", "uds"] }).series).toBe("hds");
  });
});

describe("applyFilters", () => {
  it("returns all 25 without filters", () => {
    expect(run({})).toHaveLength(25);
  });

  it("filters by series", () => {
    const r = run({ series: "hds" });
    expect(r).toHaveLength(7);
    expect(r.every((p) => p.series === "hds")).toBe(true);
  });

  it("matches LC/MPO panels for both LC and MPO", () => {
    expect(run({ connector: "MPO" }).some((p) => p.connector === "LC/MPO")).toBe(true);
    expect(run({ connector: "LC" }).some((p) => p.connector === "LC/MPO")).toBe(true);
    expect(run({ connector: "SC" }).every((p) => p.connector === "SC")).toBe(true);
  });

  it("filters by rack units, fiber range and splice, combined", () => {
    expect(run({ ru: "6" }).map((p) => p.sku).sort()).toEqual(["UDS-ODF-004-LC576", "UDS-ODF-004-LC576-MPO"]);
    const r = run({ fmin: "100", fmax: "300", splice: "0", ru: "1" });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.fibers! >= 100 && p.fibers! <= 300 && p.splice === false && p.rackUnits === 1)).toBe(true);
  });

  it("sorts by fibers and by fibers per RU in both directions", () => {
    const asc = run({ sort: "fibers-asc" }).map((p) => p.fibers!);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = run({ sort: "density-desc" }).map((p) => p.fibersPerRu!);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
    expect(desc[0]).toBe(576);
  });

  it("puts products without a value last", () => {
    const withGap = [{ ...all[0], fibers: null }, all[1]];
    const r = applyFilters(withGap, parseFilters({ sort: "fibers-desc" }));
    expect(r[1].fibers).toBeNull();
  });
});
