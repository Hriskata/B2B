import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { describeProduct, parseProductsFile, renderTodoData } from "./product-import";

const real = JSON.parse(readFileSync("docs/products.json", "utf8"));

function one(overrides: Record<string, unknown> = {}) {
  return {
    products: [
      {
        sku: "HDS-ODF-001-SC12",
        catalog_sku: "HDS-ODF-001-SC12",
        series: "hds",
        name: "High-Density Splice SC12",
        connector: "SC",
        ports: 12,
        mpo_ports: null,
        fibers: 12,
        max_fibers_variant: 48,
        rack_units: 1,
        fibers_per_ru: 12,
        polish: ["SM/UPC"],
        splice: true,
        front_door: true,
        catalog_page: 7,
        issues: ["note"],
        ...overrides,
      },
    ],
  };
}

describe("parseProductsFile", () => {
  it("imports the 25 real models with unique slugs and SKUs", () => {
    const { products } = parseProductsFile(real);
    expect(products).toHaveLength(25);
    expect(new Set(products.map((p) => p.sku)).size).toBe(25);
    expect(new Set(products.map((p) => p.slug)).size).toBe(25);
    for (const p of products) {
      expect(p.slug).toBe(p.sku.toLowerCase());
      expect(p.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("keeps a missing front door as unknown, not false", () => {
    const { products } = parseProductsFile(real);
    expect(products.find((p) => p.sku === "UDS-ODF-001-LC144")?.frontDoor).toBeNull();
    expect(products.find((p) => p.sku === "HDS-ODF-001-SC12")?.frontDoor).toBe(true);
  });

  it("does not carry the owner notes into the product data or text", () => {
    const { products, issues } = parseProductsFile(real);
    expect(issues.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(JSON.stringify(p)).not.toMatch(/issues|TODO|потвърди/i);
    }
  });

  it("rejects a duplicate SKU", () => {
    const file = one();
    file.products.push({ ...file.products[0] });
    expect(() => parseProductsFile(file)).toThrow(/Duplicate SKU/);
  });

  it("rejects a wrong fibers_per_ru", () => {
    expect(() => parseProductsFile(one({ fibers_per_ru: 13 }))).toThrow(/fibers_per_ru/);
  });

  it("rejects a maximum below the standard fibers", () => {
    expect(() => parseProductsFile(one({ max_fibers_variant: 6 }))).toThrow(/max_fibers_variant/);
  });

  it("rejects an unknown series and a non-integer number", () => {
    expect(() => parseProductsFile(one({ series: "other" }))).toThrow();
    expect(() => parseProductsFile(one({ ports: 1.5 }))).toThrow();
  });
});

describe("texts", () => {
  it("describes a model only with numbers from the data", () => {
    expect(describeProduct({ connector: "LC/MPO", ports: 12, mpoPorts: 2, fibers: 24, rackUnits: 1 })).toBe(
      "Оптичен панел (ODF), 1RU: 12 LC/MPO порта, 2 MPO порта / 24 влакна.",
    );
  });

  it("renders the owner notes into TODO-DATA", () => {
    const { issues } = parseProductsFile(one());
    const md = renderTodoData(issues, "2026-10-19");
    expect(md).toContain("## HDS-ODF-001-SC12");
    expect(md).toContain("- [ ] note");
    expect(md).toContain("Материал");
  });
});
