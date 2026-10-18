import { getDb, tables } from "@/db";

export async function createProduct(
  overrides: Partial<{
    slug: string;
    name: string;
    description: string;
    published: boolean;
    sortOrder: number;
    amountCents: number | null;
    currency: string;
  }> = {},
) {
  const [product] = await getDb()
    .insert(tables.products)
    .values({
      slug: overrides.slug ?? "produkt-1",
      name: overrides.name ?? "Продукт 1",
      description: overrides.description ?? "Описание на продукта.",
      published: overrides.published ?? true,
      sortOrder: overrides.sortOrder ?? 0,
    })
    .returning();
  const amountCents = overrides.amountCents === undefined ? 1250 : overrides.amountCents;
  if (amountCents !== null) {
    await getDb()
      .insert(tables.productPrices)
      .values({ productId: product.id, amountCents, currency: overrides.currency ?? "EUR" });
  }
  return product;
}
