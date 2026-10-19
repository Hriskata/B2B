import "server-only";
import { asc, eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";

export type ProductInput = {
  slug: string;
  name: string;
  description: string;
  published: boolean;
  sortOrder: number;
  // Price of one unit in euro cents, or null for "no price yet".
  priceCents: number | null;
};

export type AdminProduct = ProductInput & { id: string };

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === PG_UNIQUE_VIOLATION || e?.cause?.code === PG_UNIQUE_VIOLATION;
}

const selection = {
  id: tables.products.id,
  slug: tables.products.slug,
  name: tables.products.name,
  description: tables.products.description,
  published: tables.products.published,
  sortOrder: tables.products.sortOrder,
  priceCents: tables.productPrices.amountCents,
};

// Admin view: includes unpublished products and prices.
export async function listAdminProducts(): Promise<AdminProduct[]> {
  return getDb()
    .select(selection)
    .from(tables.products)
    .leftJoin(tables.productPrices, eq(tables.productPrices.productId, tables.products.id))
    .orderBy(asc(tables.products.sortOrder), asc(tables.products.name));
}

export async function getAdminProduct(id: string): Promise<AdminProduct | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await getDb()
    .select(selection)
    .from(tables.products)
    .leftJoin(tables.productPrices, eq(tables.productPrices.productId, tables.products.id))
    .where(eq(tables.products.id, id));
  return rows[0] ?? null;
}

export async function createProduct(
  actor: Actor,
  input: ProductInput,
): Promise<{ ok: true; id: string } | { ok: false; error: "slug_taken" }> {
  try {
    const id = await getDb().transaction(async (tx) => {
      const [row] = await tx
        .insert(tables.products)
        .values({
          slug: input.slug,
          name: input.name,
          description: input.description,
          published: input.published,
          sortOrder: input.sortOrder,
        })
        .returning({ id: tables.products.id });
      if (input.priceCents !== null) {
        await tx
          .insert(tables.productPrices)
          .values({ productId: row.id, amountCents: input.priceCents });
      }
      await writeAudit(tx, actor, {
        action: "product.create",
        targetType: "product",
        targetId: row.id,
        details: {
          slug: input.slug,
          published: input.published,
          priceCents: input.priceCents,
        },
      });
      return row.id;
    });
    updateTag("products");
    return { ok: true, id };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: "slug_taken" };
    throw error;
  }
}

// The slug is not editable: it is the public URL of the product.
export async function updateProduct(
  actor: Actor,
  id: string,
  input: Omit<ProductInput, "slug">,
): Promise<"ok" | "not_found"> {
  const result = await getDb().transaction(async (tx) => {
    const current = (
      await tx
        .select(selection)
        .from(tables.products)
        .leftJoin(tables.productPrices, eq(tables.productPrices.productId, tables.products.id))
        .where(eq(tables.products.id, id))
        .for("update", { of: tables.products })
    )[0];
    if (!current) return "not_found" as const;

    const changed = (
      ["name", "description", "published", "sortOrder"] as const
    ).filter((field) => current[field] !== input[field]);

    if (changed.length > 0) {
      await tx
        .update(tables.products)
        .set({
          name: input.name,
          description: input.description,
          published: input.published,
          sortOrder: input.sortOrder,
          updatedAt: new Date(),
        })
        .where(eq(tables.products.id, id));
      await writeAudit(tx, actor, {
        action: "product.update",
        targetType: "product",
        targetId: id,
        details: { slug: current.slug, fields: changed.join(",") },
      });
    }

    if (current.priceCents !== input.priceCents) {
      if (input.priceCents === null) {
        await tx.delete(tables.productPrices).where(eq(tables.productPrices.productId, id));
      } else {
        await tx
          .insert(tables.productPrices)
          .values({ productId: id, amountCents: input.priceCents })
          .onConflictDoUpdate({
            target: tables.productPrices.productId,
            set: { amountCents: input.priceCents, updatedAt: new Date() },
          });
      }
      await writeAudit(tx, actor, {
        action: "price.change",
        targetType: "product",
        targetId: id,
        details: {
          slug: current.slug,
          fromCents: current.priceCents,
          toCents: input.priceCents,
          currency: "EUR",
        },
      });
    }
    return "ok" as const;
  });
  if (result === "ok") updateTag("products");
  return result;
}
