import { describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/lib/catalog";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const base = {
  name: "Модел", description: "", descriptionEn: null, series: "hds", connector: "SC", ports: 24,
  mpoPorts: null, fibers: 24, maxFibersVariant: 96, rackUnits: 1, fibersPerRu: 24, polish: [], splice: true,
  frontDoor: null,
} satisfies Omit<PublicProduct, "slug" | "sku">;

vi.mock("@/lib/catalog", () => ({
  listPublicProducts: vi.fn(async () => [
    { ...base, slug: "hds-odf-002-sc24", sku: "HDS-ODF-002-SC24" },
    // No render on disk: the page is listed without a picture.
    { ...base, slug: "bez-snimka", sku: "NO-SUCH-MODEL" },
  ]),
}));

const { default: sitemap } = await import("./sitemap");

describe("sitemap", () => {
  it("lists each product's picture with its page, in both languages, and no price", async () => {
    const entries = await sitemap();
    const byUrl = new Map(entries.map((e) => [e.url, e]));

    for (const url of ["http://localhost:3200/products/hds-odf-002-sc24", "http://localhost:3200/en/products/hds-odf-002-sc24"]) {
      expect(byUrl.get(url)?.images).toEqual(["http://localhost:3200/images/products/hds-odf-002-sc24.webp"]);
    }
    expect(byUrl.get("http://localhost:3200/products/bez-snimka")).not.toHaveProperty("images");
    // Pages that are not products have no picture entry.
    expect(byUrl.get("http://localhost:3200/")).not.toHaveProperty("images");
    expect(byUrl.get("http://localhost:3200/en/series/hds")).not.toHaveProperty("images");
    expect(JSON.stringify(entries)).not.toMatch(/price|offers|EUR|€/i);
  });
});
