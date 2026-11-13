import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { inquiryStats } from "@/lib/admin/inquiries";
import { initialFormState } from "@/lib/form-state";
import { inquiryRecipients } from "@/lib/inquiries";
import { createProduct } from "@/test/catalog-factories";
import { codeFor, createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminLoginAction, adminVerifyAction } from "./actions";
import { decideInquiryAction, setAdminKindAction } from "./manage-actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

async function loginAdminAs(email: string, role: "viewer" | "editor") {
  const made = await createAdmin({ email, role });
  cookieJar.clear();
  await redirectedTo(() => adminLoginAction(initialFormState, fd({ email, password: PASSWORD })));
  await redirectedTo(async () => adminVerifyAction(initialFormState, fd({ code: await codeFor(made.secret) })));
  return made;
}

// An inquiry written straight to the database, at a chosen moment.
async function makeInquiry(
  user: { id: string; companyId: string },
  items: { productId: string; name: string; quantity: number }[],
  options: { createdAt?: Date; companyInactive?: boolean } = {},
) {
  const [row] = await getDb()
    .insert(tables.inquiries)
    .values({
      userId: user.id,
      companyId: user.companyId,
      contactName: "Иван Петров",
      phone: "0888123456",
      clientKey: randomUUID(),
      companyInactive: options.companyInactive ?? false,
      createdAt: options.createdAt ?? new Date(),
    })
    .returning();
  await getDb()
    .insert(tables.inquiryItems)
    .values(items.map((i) => ({ inquiryId: row.id, productId: i.productId, productName: i.name, quantity: i.quantity })));
  return row;
}

const audit = () => getDb().select().from(tables.auditLog);

describeDb("deciding on an inquiry of an inactive company", () => {
  it("an editor takes or declines it once; the first decision stands and goes to the journal", async () => {
    const p = await createProduct();
    const user = await createUser();
    const a = await makeInquiry(user, [{ productId: p.id, name: p.name, quantity: 1 }], { companyInactive: true });
    const b = await makeInquiry(user, [{ productId: p.id, name: p.name, quantity: 1 }], { companyInactive: true });
    const { admin } = await loginAdminAs("editor@firma.bg", "editor");

    await decideInquiryAction(fd({ inquiryId: a.id, decision: "accepted" }));
    await decideInquiryAction(fd({ inquiryId: a.id, decision: "declined" }));
    await decideInquiryAction(fd({ inquiryId: b.id, decision: "declined" }));

    const rows = await getDb().select().from(tables.inquiries);
    expect(rows.find((r) => r.id === a.id)).toMatchObject({ decision: "accepted", decidedByAdminId: admin.id });
    expect(rows.find((r) => r.id === b.id)?.decision).toBe("declined");
    expect((await audit()).map((e) => e.action).sort()).toEqual(["inquiry.accept", "inquiry.decline"]);
  });

  it("a viewer cannot decide, and an inquiry of an active company has nothing to decide", async () => {
    const p = await createProduct();
    const user = await createUser();
    const flagged = await makeInquiry(user, [{ productId: p.id, name: p.name, quantity: 1 }], { companyInactive: true });
    const normal = await makeInquiry(user, [{ productId: p.id, name: p.name, quantity: 1 }]);

    await loginAdminAs("viewer@firma.bg", "viewer");
    await decideInquiryAction(fd({ inquiryId: flagged.id, decision: "accepted" }));
    await loginAdminAs("editor@firma.bg", "editor");
    await decideInquiryAction(fd({ inquiryId: normal.id, decision: "declined" }));
    await decideInquiryAction(fd({ inquiryId: flagged.id, decision: "maybe" }));

    const rows = await getDb().select().from(tables.inquiries);
    expect(rows.every((r) => r.decision === null)).toBe(true);
    expect(await audit()).toHaveLength(0);
  });
});

describeDb("admin kind: support or owner", () => {
  it("only an editor changes it; the journal records it; rights stay the same", async () => {
    const { admin: target } = await createAdmin({ email: "target@firma.bg", role: "viewer" });

    await loginAdminAs("viewer@firma.bg", "viewer");
    await setAdminKindAction(fd({ adminId: target.id, kind: "owner" }));
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, target.id)))[0].kind).toBe("support");

    await loginAdminAs("editor@firma.bg", "editor");
    await setAdminKindAction(fd({ adminId: target.id, kind: "owner" }));
    const [row] = await getDb().select().from(tables.admins).where(eq(tables.admins.id, target.id));
    expect(row).toMatchObject({ kind: "owner", role: "viewer" });
    const [entry] = await audit();
    expect(entry).toMatchObject({ action: "admin.kind_change", targetId: target.id });
    expect(entry.details).toMatchObject({ kind: "owner" });

    await setAdminKindAction(fd({ adminId: target.id, kind: "root" }));
    // The same kind again (a double click) changes nothing and is not journaled.
    await setAdminKindAction(fd({ adminId: target.id, kind: "owner" }));
    expect((await audit()).length).toBe(1);
  });

  it("inquiry mails go to the active owners, else to every active admin", async () => {
    await createAdmin({ email: "support@firma.bg" });
    expect(await inquiryRecipients()).toEqual(["support@firma.bg"]);
    const { admin: owner } = await createAdmin({ email: "owner@firma.bg" });
    await getDb().update(tables.admins).set({ kind: "owner" }).where(eq(tables.admins.id, owner.id));
    expect(await inquiryRecipients()).toEqual(["owner@firma.bg"]);
    // An owner whose invite still waits gets nothing yet.
    const { admin: invited } = await createAdmin({ email: "invited@firma.bg", passwordMustChange: true });
    await getDb().update(tables.admins).set({ kind: "owner" }).where(eq(tables.admins.id, invited.id));
    expect(await inquiryRecipients()).toEqual(["owner@firma.bg"]);
  });
});

describeDb("statistics per product", () => {
  async function setup() {
    const p1 = await createProduct({ slug: "p1", name: "Продукт 1", sortOrder: 1 });
    const p2 = await createProduct({ slug: "p2", name: "Продукт 2", sortOrder: 2 });
    const p3 = await createProduct({ slug: "p3", name: "Продукт 3", sortOrder: 3 });
    const hidden = await createProduct({ slug: "p4", name: "Скрит", published: false });
    const user = await createUser();
    return { p1, p2, p3, hidden, user };
  }
  const by = (rows: { name: string; inquiries: number; units: number }[]) =>
    Object.fromEntries(rows.map((r) => [r.name, [r.inquiries, r.units]]));

  it("counts a product once per inquiry and sums the units; month and year follow the Sofia calendar", async () => {
    const { p1, p2, user } = await setup();
    // 31.10.2026 23:30 in Sofia is 21:30 UTC (winter time from 25.10): October.
    await makeInquiry(user, [{ productId: p1.id, name: p1.name, quantity: 5 }], {
      createdAt: new Date("2026-10-31T21:30:00Z"),
    });
    // 01.11.2026 00:30 in Sofia is 31.10 22:30 UTC: November.
    await makeInquiry(
      user,
      [
        { productId: p1.id, name: p1.name, quantity: 2 },
        { productId: p2.id, name: p2.name, quantity: 7 },
      ],
      { createdAt: new Date("2026-10-31T22:30:00Z") },
    );
    await makeInquiry(user, [{ productId: p2.id, name: p2.name, quantity: 1 }], {
      createdAt: new Date("2025-06-15T10:00:00Z"),
    });

    const october = await inquiryStats({ kind: "month", year: 2026, month: 10 });
    expect(october.totalInquiries).toBe(1);
    expect(by(october.products)).toMatchObject({ "Продукт 1": [1, 5], "Продукт 2": [0, 0] });

    const november = await inquiryStats({ kind: "month", year: 2026, month: 11 });
    expect(november.totalInquiries).toBe(1);
    expect(by(november.products)).toMatchObject({ "Продукт 1": [1, 2], "Продукт 2": [1, 7] });

    const year = await inquiryStats({ kind: "year", year: 2026 });
    expect(year.totalInquiries).toBe(2);
    expect(by(year.products)).toMatchObject({ "Продукт 1": [2, 7], "Продукт 2": [1, 7] });

    const all = await inquiryStats({ kind: "all" });
    expect(all.totalInquiries).toBe(3);
    expect(by(all.products)).toMatchObject({ "Продукт 1": [2, 7], "Продукт 2": [2, 8] });
    // Most asked first.
    expect(all.products.slice(0, 2).map((p) => p.name)).toEqual(["Продукт 2", "Продукт 1"]);
  });

  it("an empty period lists every published product with 0; a hidden one only when asked for", async () => {
    const { hidden, user } = await setup();
    const empty = await inquiryStats({ kind: "month", year: 2026, month: 1 });
    expect(empty.totalInquiries).toBe(0);
    expect(empty.products.map((p) => p.name)).toEqual(["Продукт 1", "Продукт 2", "Продукт 3"]);

    await makeInquiry(user, [{ productId: hidden.id, name: hidden.name, quantity: 3 }]);
    const all = await inquiryStats({ kind: "all" });
    expect(all.products[0]).toMatchObject({ name: "Скрит", published: false, inquiries: 1, units: 3 });
  });
});
