import { describe, expect, it } from "vitest";
import { describeProductEn, productDescription, productTitle } from "@/lib/product-text";
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

  it("falls back to the model name when numbers are missing", () => {
    expect(productTitle({ ...p, fibers: null }, "bg")).toBe("High-Density Splice SC12");
    expect(productTitle({ ...p, sku: null }, "en")).toBe("High-Density Splice SC12");
  });
});
