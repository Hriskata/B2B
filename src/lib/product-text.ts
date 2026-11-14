import type { Lang } from "@/i18n";
import type { PublicProduct } from "./catalog";
import { formatFibers } from "./product-options";

// Plain digits in titles (no thousands space): "1152", "24–96".
const TITLE_NUMBERS = new Intl.NumberFormat("en", { useGrouping: false });

// Short factual English text built only from the numbers in the data (the
// Bulgarian one is made the same way at import).
export function describeProductEn(p: {
  connector: string | null;
  ports: number | null;
  mpoPorts: number | null;
  fibers: number | null;
  rackUnits: number | null;
}): string | null {
  if (p.connector === null || p.ports === null || p.fibers === null || p.rackUnits === null) return null;
  const mpo = p.mpoPorts ? `, ${p.mpoPorts} MPO ports` : "";
  return `Optical distribution frame (ODF), ${p.rackUnits}RU: ${p.ports} ${p.connector} ports${mpo} / ${p.fibers} fibers.`;
}

// Bulgarian: the stored description. English: the owner's English text if
// there is one, else the generated text, else the Bulgarian one.
export function productDescription(p: PublicProduct, lang: Lang): string {
  if (lang === "bg") return p.description;
  return p.descriptionEn ?? describeProductEn(p) ?? p.description;
}

// Page title of a product: "{SKU} – {ports} {connector} ports, {fibers} fibers,
// {RU}RU | ODFFiber" (RU everywhere, as in the owner's PDF catalog; decided 14.11.2026). Fibers are the range up to the largest variant when the
// catalog has one ("24–96", decided 14.11.2026), as on the product page.
// Falls back to the model name when the numbers are missing.
export function productTitle(p: PublicProduct, lang: Lang): string {
  if (!p.sku || p.ports === null || p.fibers === null || p.rackUnits === null || !p.connector) {
    return p.name;
  }
  // Not null: p.fibers is checked above.
  const fibers = formatFibers(p, TITLE_NUMBERS) ?? String(p.fibers);
  const nums =
    lang === "bg"
      ? `${p.ports} ${p.connector} порта, ${fibers} влакна, ${p.rackUnits}RU`
      : `${p.ports} ${p.connector} ports, ${fibers} fibers, ${p.rackUnits}RU`;
  return `${p.sku} – ${nums} | ODFFiber`;
}

// Text alternative of the product render on the product page and in the home
// showcase (DRAFT wording), from catalog data only, e.g. "High-Density Splice
// SC24 (HDS-ODF-002-SC24) – оптичен панел (ODF), 1RU, 24 SC порта". It is
// longer than the name for image search; the name and some numbers are also
// in the heading next to it, an accepted repetition for screen readers.
// Catalog cards keep the bare name (several cards in a row would repeat a lot).
// Height is "RU" in both languages, as on the page.
export function productImageAlt(p: PublicProduct, lang: Lang): string {
  const name = p.sku ? `${p.name} (${p.sku})` : p.name;
  if (p.ports === null || p.rackUnits === null || !p.connector) return name;
  // An LC/MPO panel has LC ports plus a number of MPO ports.
  const mixed = p.connector === "LC/MPO" && p.mpoPorts ? p.mpoPorts : null;
  const connector = mixed ? "LC" : p.connector;
  return lang === "bg"
    ? `${name} – оптичен панел (ODF), ${p.rackUnits}RU, ${p.ports} ${connector} порта${mixed ? `, ${mixed} MPO порта` : ""}`
    : `${name} – optical distribution frame (ODF), ${p.rackUnits}RU, ${p.ports} ${connector} ports${mixed ? `, ${mixed} MPO ports` : ""}`;
}
