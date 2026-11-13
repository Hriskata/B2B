import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import { getDb, tables } from "@/db";
import { checkCompany } from "./company-check";
import { isRealAnswer, registryFields } from "./company-check/registry-fields";
import { sendMail } from "./mail/send";
import { productOptions, resolveOptions } from "./product-options";
import { inquiryAdminMail } from "./mail/templates";
import { hit, LIMITS } from "./rate-limit";

// Phase 4: a logged-in, active customer sends one inquiry for one or more
// products. There is no minimum quantity (decided 11.11.2026). The inquiry is
// saved BEFORE any email, and the customer learns only that it was sent:
// never the status of their company.

export const INQUIRY_LIMITS = {
  items: 50,
  quantity: 100_000,
  contactName: 120, // as the name at registration
  phone: 30,
  message: 2000,
} as const;

export type InquiryInput = {
  contactName: string;
  phone: string;
  message: string | null;
  // Made once by the form; the same value again creates nothing new.
  clientKey: string;
  // polish and fibers: the chosen settings (product-options.ts); missing for
  // a model without that choice.
  items: { slug: string; quantity: number; polish?: string | null; fibers?: number | null }[];
};

export type SubmitResult = "ok" | "rate_limited" | "product_unavailable" | "invalid_options" | "quantity_too_large";

type Line = { slug: string; quantity: number; polish: string | null; fibers: number | null };

// The same product in the same settings twice becomes one line with the sum;
// other settings stay separate lines.
export function mergeItems(items: Line[]): Line[] {
  const byKey = new Map<string, Line>();
  for (const item of items) {
    const key = JSON.stringify([item.slug, item.polish, item.fibers]);
    const seen = byKey.get(key);
    if (seen) seen.quantity += item.quantity;
    else byKey.set(key, { ...item });
  }
  return [...byKey.values()];
}

export async function submitInquiry(
  user: { id: string; companyId: string },
  input: InquiryInput,
): Promise<SubmitResult> {
  const db = getDb();

  // A second submit of the same form (double click, a retry after a slow
  // answer) is already saved: same answer, no second email, not counted.
  const existing = await db
    .select({ id: tables.inquiries.id })
    .from(tables.inquiries)
    .where(and(eq(tables.inquiries.userId, user.id), eq(tables.inquiries.clientKey, input.clientKey)));
  if (existing.length > 0) return "ok";

  const slugs = [...new Set(input.items.map((i) => i.slug))];
  const products = await db
    .select({
      id: tables.products.id,
      slug: tables.products.slug,
      name: tables.products.name,
      polish: tables.products.polish,
      fibers: tables.products.fibers,
      maxFibersVariant: tables.products.maxFibersVariant,
    })
    .from(tables.products)
    .where(and(inArray(tables.products.slug, slugs), eq(tables.products.published, true)));
  if (products.length !== slugs.length) return "product_unavailable";
  const productBySlug = new Map(products.map((p) => [p.slug, p]));

  // Every chosen setting must be one the catalog offers for that model.
  const resolved: Line[] = [];
  for (const item of input.items) {
    const chosen = resolveOptions(productOptions(productBySlug.get(item.slug)!), item);
    if (!chosen) return "invalid_options";
    resolved.push({ slug: item.slug, quantity: item.quantity, ...chosen });
  }
  const items = mergeItems(resolved);
  // Lines joined into one must still keep the limit per line.
  if (items.some((i) => i.quantity > INQUIRY_LIMITS.quantity)) return "quantity_too_large";
  // Counted only for an inquiry that can be saved.
  if (!(await hit(`inquiry:user:${user.id}`, LIMITS.inquiryPerUser))) return "rate_limited";

  const company = (
    await db.select().from(tables.companies).where(eq(tables.companies.id, user.companyId))
  )[0];
  if (!company) return "product_unavailable"; // cannot happen: the user has a company

  // The company is checked again (the cache answers most of the time): a
  // company active at registration may have been deleted since. A register
  // that does not answer keeps the last real answer.
  let registryState = company.registryState;
  let registryStatus = company.registryStatus;
  if (company.country === "BG") {
    const check = await checkCompany(company.companyNumber);
    if (isRealAnswer(check)) {
      const fields = registryFields(check);
      registryState = fields.registryState;
      registryStatus = fields.registryStatus;
      // Only a note for the admins: failing to store it must not lose the inquiry.
      await db
        .update(tables.companies)
        .set(fields)
        .where(eq(tables.companies.id, company.id))
        .catch(() => console.error("Inquiry: the register answer could not be stored on the company"));
    }
  }
  // Inactive or deleted (the register no longer knows it): the admins see a
  // flag and decide. Note: while the CompanyBook codes are not mapped
  // (status.ts) a real company is "unknown" and gets no flag.
  const companyInactive = registryState === "inactive" || registryState === "not_found";

  const inquiryId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(tables.inquiries)
      .values({
        userId: user.id,
        companyId: company.id,
        contactName: input.contactName,
        phone: input.phone,
        message: input.message,
        clientKey: input.clientKey,
        companyInactive,
        registryStatus: companyInactive ? (registryState === "not_found" ? "не е намерена" : registryStatus) : null,
      })
      .onConflictDoNothing({ target: [tables.inquiries.userId, tables.inquiries.clientKey] })
      .returning({ id: tables.inquiries.id });
    if (!row) return null; // a parallel submit of the same form won
    await tx.insert(tables.inquiryItems).values(
      items.map((item) => {
        const product = productBySlug.get(item.slug)!;
        return {
          inquiryId: row.id,
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          polish: item.polish,
          fibers: item.fibers,
        };
      }),
    );
    return row.id;
  });
  if (inquiryId) after(() => notifyInquiryRecipients(inquiryId));
  return "ok";
}

// Who gets the email about a new inquiry: the active owners (decided
// 13.11.2026). If there is no active owner, every active admin, so an
// inquiry is never told to nobody.
export async function inquiryRecipients(): Promise<string[]> {
  const admins = await getDb()
    .select({ email: tables.admins.email, kind: tables.admins.kind })
    .from(tables.admins)
    // Not an admin whose invite still waits (the address may be mistyped).
    .where(and(eq(tables.admins.status, "active"), eq(tables.admins.passwordMustChange, false)));
  const owners = admins.filter((a) => a.kind === "owner");
  return (owners.length > 0 ? owners : admins).map((a) => a.email);
}

export async function notifyInquiryRecipients(inquiryId: string): Promise<void> {
  const db = getDb();
  const inquiry = (
    await db
      .select({ companyInactive: tables.inquiries.companyInactive })
      .from(tables.inquiries)
      .where(eq(tables.inquiries.id, inquiryId))
  )[0];
  if (!inquiry) return;
  const items = await db
    .select({
      name: tables.inquiryItems.productName,
      quantity: tables.inquiryItems.quantity,
      polish: tables.inquiryItems.polish,
      fibers: tables.inquiryItems.fibers,
    })
    .from(tables.inquiryItems)
    .where(eq(tables.inquiryItems.inquiryId, inquiryId))
    .orderBy(tables.inquiryItems.productName, tables.inquiryItems.polish, tables.inquiryItems.fibers);
  const recipients = await inquiryRecipients();
  // In parallel; a lost mail is logged without any address (the inquiry is
  // saved and visible in the portal anyway).
  const sent = await Promise.all(
    recipients.map((to) => sendMail(inquiryAdminMail(to, items, inquiry.companyInactive))),
  );
  const failed = sent.filter((ok) => !ok).length;
  if (failed > 0) console.error(`Inquiry notice not sent to ${failed} admin(s) for inquiry ${inquiryId}`);
}
