import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb, tables } from "@/db";
import { formatMoney } from "./money";

// PUBLIC catalog data. These functions are cached and shared by every visitor,
// so they must never read prices: they select explicit columns of `products`
// only (prices are a separate table, see getPricesForSlugs).

export type PublicProduct = { slug: string; name: string; description: string };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= MAX_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

export async function listPublicProducts(): Promise<PublicProduct[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  return getDb()
    .select({
      slug: tables.products.slug,
      name: tables.products.name,
      description: tables.products.description,
    })
    .from(tables.products)
    .where(eq(tables.products.published, true))
    .orderBy(asc(tables.products.sortOrder), asc(tables.products.name));
}

export async function getPublicProduct(slug: string): Promise<PublicProduct | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("products");
  if (!isValidSlug(slug)) return null;
  const rows = await getDb()
    .select({
      slug: tables.products.slug,
      name: tables.products.name,
      description: tables.products.description,
    })
    .from(tables.products)
    .where(and(eq(tables.products.slug, slug), eq(tables.products.published, true)));
  return rows[0] ?? null;
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
