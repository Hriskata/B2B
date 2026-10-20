import { describe, expect, it } from "vitest";
import { createProduct } from "@/test/catalog-factories";
import { getPricesForSlugs, getPublicProduct, isValidSlug, listPublicProducts } from "./catalog";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

describe("isValidSlug", () => {
  it.each(["a", "produkt-1", "a-b-c", "x".repeat(80)])("accepts %s", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(["", "UPPER", "a b", "a_b", "-a", "a-", "a--b", "../etc/passwd", "a;drop", "x".repeat(81), "продукт"])(
    "rejects %j",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});

describeDb("public catalog data", () => {
  it("lists only published products, in sort order", async () => {
    await createProduct({ slug: "b", name: "B", sortOrder: 2 });
    await createProduct({ slug: "a", name: "A", sortOrder: 1 });
    await createProduct({ slug: "hidden", name: "Hidden", published: false });

    const list = await listPublicProducts();

    expect(list.map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("never carries any price data", async () => {
    await createProduct({ slug: "a", amountCents: 98765 });

    const list = await listPublicProducts();
    const one = await getPublicProduct("a");

    // An explicit allow-list: a new column (or a price) must be added here on purpose.
    const allowed = [
      "connector", "description", "descriptionEn", "fibers", "fibersPerRu", "frontDoor", "maxFibersVariant", "mpoPorts",
      "name", "polish", "ports", "rackUnits", "series", "sku", "slug", "splice",
    ];
    expect(Object.keys(list[0]).sort()).toEqual(allowed);
    expect(Object.keys(one!).sort()).toEqual(allowed);
    expect(JSON.stringify(list)).not.toMatch(/price|amount|cents/i);
    expect(JSON.stringify([list, one])).not.toMatch(/987|amount|price|EUR/i);
  });

  it("returns null for unpublished, unknown and malformed slugs", async () => {
    await createProduct({ slug: "hidden", published: false });

    expect(await getPublicProduct("hidden")).toBeNull();
    expect(await getPublicProduct("nope")).toBeNull();
    expect(await getPublicProduct("../etc/passwd")).toBeNull();
  });
});

describeDb("price lookup", () => {
  it("returns prices for published products only", async () => {
    await createProduct({ slug: "a", amountCents: 1250 });
    await createProduct({ slug: "hidden", published: false, amountCents: 999 });

    const prices = await getPricesForSlugs(["a", "hidden", "missing"]);

    expect(Object.keys(prices)).toEqual(["a"]);
    expect(prices.a).toMatchObject({ amountCents: 1250, currency: "EUR" });
    expect(prices.a.formatted).toMatch(/12,50/);
  });

  it("skips products that have no price yet", async () => {
    await createProduct({ slug: "a", amountCents: null });

    expect(await getPricesForSlugs(["a"])).toEqual({});
  });

  it("rejects non-positive prices in the database", async () => {
    await expect(createProduct({ slug: "a", amountCents: 0 })).rejects.toThrow();
  });
});
