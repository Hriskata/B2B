import type { Lang } from "@/i18n";
import type { PublicProduct } from "./catalog";

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
  return `Optical distribution frame (ODF), ${p.rackUnits}U: ${p.ports} ${p.connector} ports${mpo} / ${p.fibers} fibers.`;
}

// Bulgarian: the stored description. English: the owner's English text if
// there is one, else the generated text, else the Bulgarian one.
export function productDescription(p: PublicProduct, lang: Lang): string {
  if (lang === "bg") return p.description;
  return p.descriptionEn ?? describeProductEn(p) ?? p.description;
}

// Page title of a product: "{SKU} – {ports} {connector} ports, {fibers} fibers,
// {RU}U | ODFFiber". Falls back to the model name when the numbers are missing.
export function productTitle(p: PublicProduct, lang: Lang): string {
  if (!p.sku || p.ports === null || p.fibers === null || p.rackUnits === null || !p.connector) {
    return p.name;
  }
  const nums =
    lang === "bg"
      ? `${p.ports} ${p.connector} порта, ${p.fibers} влакна, ${p.rackUnits}U`
      : `${p.ports} ${p.connector} ports, ${p.fibers} fibers, ${p.rackUnits}U`;
  return `${p.sku} – ${nums} | ODFFiber`;
}
