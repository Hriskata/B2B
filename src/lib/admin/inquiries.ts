import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, tables } from "@/db";
import { writeAudit, type Actor } from "../audit";

// Admin side of the inquiries: the list, the decision on an inquiry of an
// inactive company, and the statistics per product.

export async function listInquiries(limit = 200) {
  const db = getDb();
  const rows = await db
    .select({
      id: tables.inquiries.id,
      createdAt: tables.inquiries.createdAt,
      contactName: tables.inquiries.contactName,
      phone: tables.inquiries.phone,
      message: tables.inquiries.message,
      companyInactive: tables.inquiries.companyInactive,
      registryStatus: tables.inquiries.registryStatus,
      decision: tables.inquiries.decision,
      decidedAt: tables.inquiries.decidedAt,
      decidedBy: tables.admins.email,
      email: tables.users.email,
      companyName: tables.companies.name,
      country: tables.companies.country,
      companyNumber: tables.companies.companyNumber,
    })
    .from(tables.inquiries)
    .innerJoin(tables.users, eq(tables.users.id, tables.inquiries.userId))
    .innerJoin(tables.companies, eq(tables.companies.id, tables.inquiries.companyId))
    .leftJoin(tables.admins, eq(tables.admins.id, tables.inquiries.decidedByAdminId))
    .orderBy(desc(tables.inquiries.createdAt))
    .limit(Math.min(Math.max(limit, 1), 500));
  if (rows.length === 0) return [];
  const items = await db
    .select({
      id: tables.inquiryItems.id,
      inquiryId: tables.inquiryItems.inquiryId,
      productName: tables.inquiryItems.productName,
      quantity: tables.inquiryItems.quantity,
      polish: tables.inquiryItems.polish,
      fibers: tables.inquiryItems.fibers,
    })
    .from(tables.inquiryItems)
    .where(
      inArray(
        tables.inquiryItems.inquiryId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(tables.inquiryItems.productName, tables.inquiryItems.polish, tables.inquiryItems.fibers);
  const byInquiry = Map.groupBy(items, (i) => i.inquiryId);
  return rows.map((r) => ({ ...r, items: byInquiry.get(r.id) ?? [] }));
}

// Take or decline an inquiry of an inactive company (decided 11.11.2026).
// Once only: the first decision stands. The customer is not told anything.
export async function decideInquiry(
  actor: Actor,
  inquiryId: string,
  decision: "accepted" | "declined",
): Promise<"ok" | "not_found"> {
  if (!/^[0-9a-f-]{36}$/i.test(inquiryId)) return "not_found";
  return getDb().transaction(async (tx) => {
    const [row] = await tx
      .update(tables.inquiries)
      .set({ decision, decidedByAdminId: actor.id, decidedAt: new Date() })
      .where(
        and(
          eq(tables.inquiries.id, inquiryId),
          eq(tables.inquiries.companyInactive, true),
          isNull(tables.inquiries.decision),
        ),
      )
      .returning({ id: tables.inquiries.id });
    if (!row) return "not_found";
    await writeAudit(tx, actor, {
      action: decision === "accepted" ? "inquiry.accept" : "inquiry.decline",
      targetType: "inquiry",
      targetId: inquiryId,
    });
    return "ok";
  });
}

// Statistics period (decided 13.11.2026): a month, a year, or all the time.
// Months and years follow the calendar in Sofia.
export type StatsPeriod =
  | { kind: "month"; year: number; month: number }
  | { kind: "year"; year: number }
  | { kind: "all" };

const TZ = "Europe/Sofia";

function rangeFilter(period: StatsPeriod) {
  const created = tables.inquiries.createdAt;
  if (period.kind === "all") return sql`true`;
  const month = period.kind === "month" ? period.month : 1;
  const from = sql`make_timestamptz(${period.year}::int, ${month}::int, 1, 0, 0, 0, ${TZ})`;
  const to =
    period.kind === "month"
      ? sql`(${from} at time zone ${TZ} + interval '1 month') at time zone ${TZ}`
      : sql`(${from} at time zone ${TZ} + interval '1 year') at time zone ${TZ}`;
  return sql`${created} >= ${from} and ${created} < ${to}`;
}

export type ProductStat = {
  productId: string;
  name: string;
  slug: string;
  published: boolean;
  inquiries: number;
  units: number;
};

// Per product: in how many inquiries it was asked for, and how many units in
// all. A product is counted once per inquiry. Every published product is
// listed (0 when nobody asked); a hidden one only if it was asked for.
// Declined inquiries count too: they still show demand.
export async function inquiryStats(period: StatsPeriod): Promise<{
  totalInquiries: number;
  products: ProductStat[];
}> {
  const db = getDb();
  const range = rangeFilter(period);
  const counts = db
    .select({
      productId: tables.inquiryItems.productId,
      // Distinct: one inquiry may ask for a model in several settings.
      inquiries: sql<number>`count(distinct ${tables.inquiryItems.inquiryId})::int`.as("inquiries"),
      units: sql<string>`sum(${tables.inquiryItems.quantity})::bigint`.as("units"),
    })
    .from(tables.inquiryItems)
    .innerJoin(tables.inquiries, eq(tables.inquiries.id, tables.inquiryItems.inquiryId))
    .where(range)
    .groupBy(tables.inquiryItems.productId)
    .as("counts");
  const products = await db
    .select({
      productId: tables.products.id,
      name: tables.products.name,
      slug: tables.products.slug,
      published: tables.products.published,
      inquiries: sql<number>`coalesce(${counts.inquiries}, 0)::int`,
      units: sql<string>`coalesce(${counts.units}, 0)::bigint`,
    })
    .from(tables.products)
    .leftJoin(counts, eq(counts.productId, tables.products.id))
    .where(sql`${tables.products.published} or ${counts.inquiries} is not null`)
    .orderBy(
      sql`coalesce(${counts.inquiries}, 0) desc`,
      sql`coalesce(${counts.units}, 0) desc`,
      tables.products.sortOrder,
      tables.products.name,
    );
  const [total] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(tables.inquiries)
    .where(range);
  return {
    totalInquiries: total?.n ?? 0,
    products: products.map((p) => ({ ...p, units: Number(p.units) })),
  };
}

// The first year with an inquiry, for the year picker (this year if none).
export async function firstInquiryYear(): Promise<number | null> {
  const [row] = await getDb()
    .select({
      year: sql<number | null>`extract(year from min(${tables.inquiries.createdAt}) at time zone ${TZ})::int`,
    })
    .from(tables.inquiries);
  return row?.year ?? null;
}
