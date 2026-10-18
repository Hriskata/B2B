import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";
import { productJsonLd, serializeJsonLd } from "./seo";

const product = { slug: "produkt-1", name: "Продукт 1", description: "Описание." };

describe("productJsonLd", () => {
  it("describes the product with an absolute URL and has no offer or price", () => {
    const data = productJsonLd(product, "https://shop.example.bg/");

    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Продукт 1",
      description: "Описание.",
      url: "https://shop.example.bg/products/produkt-1",
    });
    expect(JSON.stringify(data)).not.toMatch(/offers|price|EUR|Offer/i);
  });
});

describe("serializeJsonLd", () => {
  it("round-trips ordinary data", () => {
    const data = { a: "б", n: 1, nested: { ok: true } };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it("cannot close the script tag or inject markup", () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script><img src=x onerror="y">&' });

    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("&");
    // Still decodes to the original text.
    expect(JSON.parse(out).name).toContain("</script>");
  });

  it("escapes the JS line separators", () => {
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = serializeJsonLd({ text });

    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).text).toBe(text);
  });
});

describe("formatMoney", () => {
  it("formats euro cents in Bulgarian style", () => {
    expect(formatMoney(1250, "EUR")).toMatch(/^12,50\s€$/);
    expect(formatMoney(5, "EUR")).toMatch(/^0,05\s€$/);
    expect(formatMoney(123456, "EUR")).toMatch(/1\s?234,56\s€/);
  });
});
