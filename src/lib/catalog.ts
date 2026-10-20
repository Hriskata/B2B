import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb, tables } from "@/db";
import { formatMoney } from "./money";

// PUBLIC catalog data. These functions are cached and shared by every visitor,
// so they must never read prices: they select explicit columns of `products`
// only (prices are a separate table, see getPricesForSlugs).

export type ProductSpecs = {
  sku: string | null;
  series: "hds" | "uds" | "quick-fit" | "mpo" | null;
  connector: string | null;
  ports: number | null;
  mpoPorts: number | null;
  fibers: number | null;
  maxFibersVariant: number | null;
  rackUnits: number | null;
  // Computed from fibers and rackUnits, never stored.
  fibersPerRu: number | null;
  polish: string[];
  splice: boolean | null;
  // null = not known yet.
  frontDoor: boolean | null;
};

export type PublicProduct = {
  slug: string;
  name: string;
  description: string;
  descriptionEn: string | null;
} & ProductSpecs;

// Explicit columns only: never `select()` of the whole table, and never prices.
const publicColumns = {
  slug: tables.products.slug,
  name: tables.products.name,
  description: tables.products.description,
  descriptionEn: tables.products.descriptionEn,
  sku: tables.products.sku,
  series: tables.products.series,
  connector: tables.products.connector,
  ports: tables.products.ports,
  mpoPorts: tables.products.mpoPorts,
  fibers: tables.products.fibers,
  maxFibersVariant: tables.products.maxFibersVariant,
  rackUnits: tables.products.rackUnits,
  polish: tables.products.polish,
  splice: tables.products.splice,
  frontDoor: tables.products.frontDoor,
};

function toPublic(row: {
  fibers: number | null;
  rackUnits: number | null;
  polish: string[] | null;
} & Omit<PublicProduct, "fibersPerRu" | "polish" | "fibers" | "rackUnits">): PublicProduct {
  return {
    ...row,
    fibersPerRu: row.fibers !== null && row.rackUnits ? row.fibers / row.rackUnits : null,
    polish: row.polish ?? [],
  } as PublicProduct;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

export async function listPublicProducts(): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  const rows = await getDb()
    .select(publicColumns)
    .from(tables.products)
    .where(eq(tables.products.published, true))
    .orderBy(asc(tables.products.sortOrder), asc(tables.products.name));
  return rows.map(toPublic);
}

export async function getPublicProduct(slug: string): Promise<PublicProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  if (!isValidSlug(slug)) return null;
  const rows = await getDb()
    .select(publicColumns)
    .from(tables.products)
    .where(and(eq(tables.products.slug, slug), eq(tables.products.published, true)));
  return rows[0] ? toPublic(rows[0]) : null;
}

export type PriceInfo = { amountCents: number; currency: string; formatted: string };

// NOT cached and NOT for public pages: called only for a logged-in customer,
// from the no-store price endpoint.
export async function getPricesForSlugs(slugs: string[]): Promise<Record<string, PriceInfo>> {
  if (slugs.length === 0) return {};
  const rows = await getDb()
    .select({
      slug: tables.products.slug,
      amountCents: tables.productPrices.amountCents,
      currency: tables.productPrices.currency,
    })
    .from(tables.products)
    .innerJoin(tables.productPrices, eq(tables.productPrices.productId, tables.products.id))
    .where(and(inArray(tables.products.slug, slugs), eq(tables.products.published, true)));
  return Object.fromEntries(
    rows.map((r) => [
      r.slug,
      {
        amountCents: r.amountCents,
        currency: r.currency,
        formatted: formatMoney(r.amountCents, r.currency),
      },
    ]),
  );
}
