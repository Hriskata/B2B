import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { specSummary } from "@/components/product-specs";
import { getDict, type Lang } from "@/i18n";
import { listPublicProducts, type PublicProduct } from "./catalog";
import { productImageName, productImagePath } from "./product-image-file";
import { seriesName } from "./series";
import { SITE } from "./site";

// Pictures shown when a page is shared (Open Graph: LinkedIn, Facebook,
// Viber, Slack...). Built from the public catalog row only: never a price.
// Colours are the Ember Glow tokens (src/app/globals.css); an image renderer
// cannot read CSS variables, so the values are repeated here.
const C = {
  base: "#0a0604",
  card: "#1a110c",
  line: "rgba(255, 255, 255, 0.08)",
  ember: "#d7000f",
  ember300: "#ff5c66",
  primary: "#f6f1ec",
  secondary: "#a39a93",
  light: "#ffffff",
};

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
// Making a picture costs CPU, and link previews ask for it often. One hour,
// like the catalog cache; there is never a price or anything private in it.
const OG_HEADERS = { "Cache-Control": "public, max-age=3600" };

// Inter (OFL, assets/fonts/LICENSE-Inter.txt), Latin and Cyrillic, the two
// weights the site uses. Read once per server process.
const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
type Fonts = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;
let fonts: Promise<Fonts> | null = null;

function loadFonts(): Promise<Fonts> {
  fonts ??= Promise.all(
    (["latin", "cyrillic"] as const).flatMap((subset) =>
      ([400, 500] as const).map(async (weight) => ({
        name: "Inter",
        data: await readFile(path.join(FONT_DIR, `inter-${subset}-${weight}-normal.woff`)),
        weight,
        style: "normal" as const,
      })),
    ),
  );
  // A failed read (a passing file-system error) is not kept: the next
  // request tries again instead of failing until the server restarts.
  fonts.catch(() => {
    fonts = null;
  });
  return fonts;
}

// The renderer does not read WebP, so the render is converted to PNG and
// embedded. Missing or broken file: no picture, the text stays.
async function productPicture(sku: string | null): Promise<string | null> {
  const name = productImageName(sku);
  if (!name) return null;
  try {
    const png = await sharp(productImagePath(name))
      .resize({ width: 920, height: 690, fit: "inside" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: C.base,
        backgroundImage: `radial-gradient(circle at 0% 100%, rgba(215, 0, 15, 0.35), rgba(215, 0, 15, 0) 55%)`,
        color: C.primary,
        fontFamily: "Inter",
        padding: 64,
      }}
    >
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 500 }}>
      <div style={{ width: 14, height: 14, borderRadius: 999, background: C.ember, boxShadow: `0 0 24px ${C.ember}` }} />
      {SITE.name}
    </div>
  );
}

export async function productOgImage(p: PublicProduct, lang: Lang): Promise<ImageResponse> {
  const t = getDict(lang);
  const [picture, fontList] = await Promise.all([productPicture(p.sku), loadFonts()]);
  const summary = specSummary(p, lang);
  const series = seriesName(p.series, lang);
  const facts = [p.connector, p.sku].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingRight: picture ? 48 : 0 }}>
          <Brand />
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {series ? (
              <div style={{ fontSize: 26, color: C.ember300, letterSpacing: 2, textTransform: "uppercase" }}>{series}</div>
            ) : null}
            <div style={{ fontSize: p.name.length > 28 ? 56 : 68, fontWeight: 500, lineHeight: 1.05, letterSpacing: -1.5 }}>
              {p.name}
            </div>
            {summary ? <div style={{ fontSize: 34, color: C.primary }}>{summary}</div> : null}
            {facts ? <div style={{ fontSize: 26, color: C.secondary }}>{facts}</div> : null}
          </div>
          <div style={{ fontSize: 24, color: C.secondary }}>{t.og.forBusinesses}</div>
        </div>
        {picture ? (
          <div
            style={{
              width: 460,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: C.light,
              borderRadius: 28,
              padding: 24,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not a page */}
            <img src={picture} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          </div>
        ) : null}
      </Frame>
    ),
    { ...OG_SIZE, fonts: await fontList, headers: OG_HEADERS },
  );
}

export async function siteOgImage(lang: Lang): Promise<ImageResponse> {
  const t = getDict(lang);
  return new ImageResponse(
    (
      <Frame>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <Brand />
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ fontSize: 64, fontWeight: 500, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 980 }}>
              {t.home.lead}
            </div>
          </div>
          <div style={{ fontSize: 26, color: C.secondary }}>{t.og.forBusinesses}</div>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await loadFonts(), headers: OG_HEADERS },
  );
}

// Making a picture takes CPU (image decoding and drawing), so the finished PNG
// is kept in the Next.js cache: one entry per published product and language,
// renewed when the catalog changes (tag "products", like the catalog itself).
async function productOgPng(slug: string, lang: Lang): Promise<Uint8Array | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const product = (await listPublicProducts()).find((p) => p.slug === slug);
  if (!product) return null;
  return new Uint8Array(await (await productOgImage(product, lang)).arrayBuffer());
}

async function siteOgPng(lang: Lang): Promise<Uint8Array> {
  "use cache";
  cacheLife("days");
  return new Uint8Array(await (await siteOgImage(lang)).arrayBuffer());
}

function pngResponse(png: Uint8Array): Response {
  return new Response(png as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": OG_CONTENT_TYPE, ...OG_HEADERS } });
}

// The response of a product's picture route. Only published products get a
// picture; any other address is answered from the cached product list, so a
// made-up slug costs neither a database query nor a cache entry.
export async function productOgResponse(slug: string, lang: Lang): Promise<Response> {
  const published = (await listPublicProducts()).some((p) => p.slug === slug);
  const png = published ? await productOgPng(slug, lang) : null;
  return png ? pngResponse(png) : new Response(null, { status: 404 });
}

export async function siteOgResponse(lang: Lang): Promise<Response> {
  return pngResponse(await siteOgPng(lang));
}
