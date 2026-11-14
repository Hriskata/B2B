import { describe, expect, it } from "vitest";
import { describeProductEn, productDescription, productImageAlt, productTitle } from "@/lib/product-text";
import type { PublicProduct } from "@/lib/catalog";
import { getDict, localePath, SHARED_PATHS, switchHref } from "./index";

// Collects the shape of an object (keys; functions and arrays by kind and length).
function shape(value: unknown, path = ""): string[] {
  if (typeof value === "function") return [`${path}:fn(${(value as (...a: never[]) => unknown).length})`];
  if (Array.isArray(value)) return [`${path}:array(${value.length})`, ...value.flatMap((v, i) => (typeof v === "object" ? shape(v, `${path}[${i}]`) : []))];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => shape(v, `${path}.${k}`));
  }
  return [`${path}:string`];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("dictionaries", () => {
  const bg = getDict("bg");
  const en = getDict("en");

  it("have exactly the same keys (no untranslated or extra keys)", () => {
    expect(shape(en).sort()).toEqual(shape(bg).sort());
  });

  it("have no empty texts", () => {
    for (const d of [bg, en]) for (const s of strings(d)) expect(s.trim()).not.toBe("");
  });

  it("English texts contain no Cyrillic letters (except the switch back to Bulgarian)", () => {
    const { switchTo, ...rest } = en;
    void switchTo;
    for (const s of strings(rest)) expect(s).not.toMatch(/[\u0400-\u04FF]/);
  });

  it("set the document language", () => {
    expect(bg.htmlLang).toBe("bg");
    expect(en.htmlLang).toBe("en");
  });
});

describe("localePath", () => {
  it("leaves Bulgarian unprefixed and puts English under /en", () => {
    expect(localePath("bg", "/")).toBe("/");
    expect(localePath("bg", "/products")).toBe("/products");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/products/a")).toBe("/en/products/a");
  });
});

describe("switchHref", () => {
  it.each([
    ["bg", "/", "/en"],
    ["bg", "/products", "/en/products"],
    ["bg", "/products/uds-odf-001-lc144", "/en/products/uds-odf-001-lc144"],
    ["bg", "/series/hds", "/en/series/hds"],
    ["en", "/en", "/"],
    ["en", "/en/products", "/products"],
    ["en", "/en/series/mpo", "/series/mpo"],
    ["bg", "/login", "/en"],
    ["bg", "/admin/products", "/en"],
  ] as const)("%s %s -> %s", (lang, path, expected) => {
    expect(switchHref(lang, path)).toBe(expected);
  });

  it("every shared path has a counterpart in the other language", () => {
    for (const path of SHARED_PATHS) {
      expect(switchHref("en", localePath("en", path))).toBe(path);
      expect(switchHref("bg", path)).toBe(localePath("en", path));
    }
  });
});

describe("product text", () => {
  const base = {
    slug: "x", name: "X", description: "Български текст.", descriptionEn: null, sku: null, series: null,
    connector: "LC", ports: 12, mpoPorts: null, fibers: 24, maxFibersVariant: null, rackUnits: 1,
    fibersPerRu: 24, polish: [], splice: null, frontDoor: null,
  } satisfies PublicProduct;

  it("Bulgarian always shows the stored text", () => {
    expect(productDescription(base, "bg")).toBe("Български текст.");
  });

  it("English prefers the owner's text, then the generated one, then Bulgarian", () => {
    expect(productDescription({ ...base, descriptionEn: "Owner text." }, "en")).toBe("Owner text.");
    expect(productDescription(base, "en")).toBe("Optical distribution frame (ODF), 1U: 12 LC ports / 24 fibers.");
    expect(productDescription({ ...base, ports: null }, "en")).toBe("Български текст.");
  });

  it("describes MPO ports only when there are some", () => {
    expect(describeProductEn({ ...base, mpoPorts: 2 })).toContain(", 2 MPO ports");
    expect(describeProductEn(base)).not.toContain("MPO");
  });
});

describe("productTitle", () => {
  const p = {
    slug: "x", name: "High-Density Splice SC12", description: "", descriptionEn: null, sku: "HDS-ODF-001-SC12",
    series: "hds", connector: "SC", ports: 12, mpoPorts: null, fibers: 12, maxFibersVariant: null,
    rackUnits: 1, fibersPerRu: 12, polish: [], splice: true, frontDoor: true,
  } satisfies PublicProduct;

  it("follows the plan template in both languages", () => {
    expect(productTitle(p, "bg")).toBe("HDS-ODF-001-SC12 – 12 SC порта, 12 влакна, 1U | ODFFiber");
    expect(productTitle(p, "en")).toBe("HDS-ODF-001-SC12 – 12 SC ports, 12 fibers, 1U | ODFFiber");
  });

  it("shows the fiber range when the model has larger variants", () => {
    const ranged = { ...p, fibers: 24, maxFibersVariant: 96 };
    expect(productTitle(ranged, "bg")).toBe("HDS-ODF-001-SC12 – 12 SC порта, 24–96 влакна, 1U | ODFFiber");
    expect(productTitle(ranged, "en")).toBe("HDS-ODF-001-SC12 – 12 SC ports, 24–96 fibers, 1U | ODFFiber");
    // Large numbers stay plain digits.
    expect(productTitle({ ...p, fibers: 1152, maxFibersVariant: 1152 }, "bg")).toContain("1152 влакна");
  });

  it("falls back to the model name when numbers are missing", () => {
    expect(productTitle({ ...p, fibers: null }, "bg")).toBe("High-Density Splice SC12");
    expect(productTitle({ ...p, sku: null }, "en")).toBe("High-Density Splice SC12");
  });
});

describe("productImageAlt", () => {
  const p = {
    slug: "x", name: "High-Density Splice SC24", description: "", descriptionEn: null, sku: "HDS-ODF-002-SC24",
    series: "hds", connector: "SC", ports: 24, mpoPorts: null, fibers: 24, maxFibersVariant: 96,
    rackUnits: 1, fibersPerRu: 24, polish: [], splice: true, frontDoor: null,
  } satisfies PublicProduct;

  it("says what the picture shows, in each language", () => {
    expect(productImageAlt(p, "bg")).toBe("High-Density Splice SC24 (HDS-ODF-002-SC24) – оптичен панел (ODF), 1RU, 24 SC порта");
    expect(productImageAlt(p, "en")).toBe(
      "High-Density Splice SC24 (HDS-ODF-002-SC24) – optical distribution frame (ODF), 1RU, 24 SC ports",
    );
  });

  it("names the LC and the MPO ports of an LC/MPO panel; an MPO panel has one kind", () => {
    const lcMpo = { ...p, name: "HD LC12 MPO", sku: "HD-ODF-001-LC12-MPO", connector: "LC/MPO", ports: 12, mpoPorts: 2 };
    expect(productImageAlt(lcMpo, "bg")).toBe("HD LC12 MPO (HD-ODF-001-LC12-MPO) – оптичен панел (ODF), 1RU, 12 LC порта, 2 MPO порта");
    expect(productImageAlt(lcMpo, "en")).toMatch(/12 LC ports, 2 MPO ports$/);
    const mpo = { ...p, name: "HD MPO12", sku: "HD-ODF-006-MPO12", connector: "MPO", ports: 12, mpoPorts: 12 };
    expect(productImageAlt(mpo, "bg")).toMatch(/, 12 MPO порта$/);
  });

  it("keeps to the known data", () => {
    expect(productImageAlt({ ...p, ports: null }, "bg")).toBe("High-Density Splice SC24 (HDS-ODF-002-SC24)");
    expect(productImageAlt({ ...p, sku: null, connector: null }, "en")).toBe("High-Density Splice SC24");
  });
});

describe("series summary", () => {
  it("leaves out the fiber range when no model has a fiber count (no Infinity)", () => {
    expect(getDict("bg").seriesPage.summary(1, null, "")).toBe("1 модел.");
    expect(getDict("en").seriesPage.summary(1, null, "")).toBe("1 model.");
    expect(getDict("en").seriesPage.summary(2, { min: 12, max: 48 }, "1RU")).toBe(
      "2 models, from 12 to 48 fibers, height 1RU.",
    );
    expect(getDict("en").seriesPage.summary(1, null, "")).not.toMatch(/Infinity/);
  });
});

describe("decided texts", () => {
  it("no page promises a minimum order (decided 11.11.2026: there is none)", () => {
    const all = JSON.stringify([getDict("bg"), getDict("en")]);
    expect(all).not.toMatch(/3 бро|3 бр\.|3 units|Минимална поръчка|Minimum order/i);
  });
});
