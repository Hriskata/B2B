import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const { buildMetadata, rootMetadata, siteOgImages } = await import("./page-meta");

describe("shared-link picture and metadata base", () => {
  it("gives the root layouts an absolute base, the site picture and a large card", async () => {
    const bg = await rootMetadata("bg", "ODFFiber", "Каталог за фирми");
    expect(bg.metadataBase?.toString()).toBe("http://localhost:3200/");
    expect(bg.openGraph?.images).toEqual(siteOgImages("bg"));
    expect(bg.twitter).toEqual({ card: "summary_large_image" });
  });

  it("points each language at its own picture", () => {
    expect(siteOgImages("bg")[0]).toMatchObject({ url: "http://localhost:3200/og.png", width: 1200, height: 630 });
    expect(siteOgImages("en")[0].url).toBe("http://localhost:3200/en/og.png");
  });

  it("keeps the picture on a page that sets its own Open Graph data", async () => {
    // A page's openGraph replaces the layout's whole object, so it must list the picture again.
    const meta = await buildMetadata({ lang: "en", path: "/products", title: "Catalogue", description: "d" });
    expect(meta.openGraph?.images).toEqual(siteOgImages("en"));
    expect(meta.robots).toBeUndefined();
    const hidden = await buildMetadata({ lang: "bg", path: "/terms", title: "Условия", noindex: true });
    expect(hidden.robots).toEqual({ index: false, follow: true });
  });
});
