import { describe, expect, it } from "vitest";
import type { PublicProduct } from "./catalog";
import { productOgImage, siteOgImage } from "./og-image";
import { productImageName, productImageSrc } from "./product-image-file";

const product: PublicProduct = {
  slug: "hds-odf-002-sc24",
  name: "High-Density Splice SC24",
  description: "Описание.",
  descriptionEn: null,
  sku: "HDS-ODF-002-SC24",
  series: "hds",
  connector: "SC",
  ports: 24,
  mpoPorts: null,
  fibers: 24,
  maxFibersVariant: 96,
  rackUnits: 1,
  fibersPerRu: 24,
  polish: ["SM/UPC"],
  splice: true,
  frontDoor: null,
};

const PNG = [0x89, 0x50, 0x4e, 0x47];

async function bytes(res: Response) {
  return new Uint8Array(await res.arrayBuffer());
}

describe("product render file", () => {
  it("finds a model's render by its SKU", () => {
    expect(productImageName("HDS-ODF-002-SC24")).toBe("hds-odf-002-sc24.webp");
  });

  it("never turns a SKU into a path, and has nothing for an unknown model", () => {
    for (const sku of ["../../etc/passwd", "a/b", "HDS ODF", "", null, "no-such-model"]) {
      expect(productImageName(sku)).toBeNull();
      expect(productImageSrc(sku)).toBeNull();
    }
  });

  it("gives the public address of a render", () => {
    expect(productImageSrc("HDS-ODF-002-SC24")).toBe("/images/products/hds-odf-002-sc24.webp");
  });
});

describe("shared-link pictures", () => {
  it("draws a product (with and without its render) and the site as PNG 1200x630", async () => {
    for (const res of [
      await productOgImage(product, "bg"),
      await productOgImage({ ...product, sku: "NO-SUCH-MODEL" }, "en"),
      await siteOgImage("bg"),
    ]) {
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
      const b = await bytes(res);
      expect([...b.slice(0, 4)]).toEqual(PNG);
      // Width and height from the PNG header.
      const view = new DataView(b.buffer);
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
    }
  }, 30_000);
});
