import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { loginAction } from "@/app/(auth)/login/actions";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/current";
import { listPublicProducts } from "@/lib/catalog";
import { initialFormState } from "@/lib/form-state";
import { createProduct as makeProduct } from "@/test/catalog-factories";
import { codeFor, createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { sentMails } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminLoginAction, adminVerifyAction } from "./actions";
import {
  resetAdminTwoFactorAction,
  saveProductAction,
  setCompanyBlockedAction,
  setUserBlockedAction,
} from "./manage-actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

afterEach(() => vi.useRealTimers());

type Jar = Map<string, { value: string; options?: Record<string, unknown> }>;

// Creates an admin and logs them in completely (password + 2FA code).
async function loginAdminAs(email: string, role: "viewer" | "editor") {
  const made = await createAdmin({ email, role });
  cookieJar.clear();
  await redirectedTo(() => adminLoginAction(initialFormState, fd({ email, password: PASSWORD })));
  const code = await codeFor(made.secret);
  await redirectedTo(() => adminVerifyAction(initialFormState, fd({ code })));
  expect(await getCurrentAdmin("full")).not.toBeNull();
  return { ...made, jar: new Map(cookieJar) as Jar };
}

function useJar(jar: Jar) {
  cookieJar.clear();
  for (const [k, v] of jar) cookieJar.set(k, v);
}

const productForm = (overrides: Record<string, string> = {}) =>
  fd({
    slug: "novo-izdelie",
    name: "Ново изделие",
    description: "Описание на изделието.",
    sortOrder: "5",
    price: "12,50",
    published: "on",
    ...overrides,
  });

const productsInDb = () => getDb().select().from(tables.products);
const auditRows = () => getDb().select().from(tables.auditLog);

describeDb("catalog editing: who may do it", () => {
  it("a viewer cannot create a product (server refuses, nothing is stored)", async () => {
    await loginAdminAs("viewer@firma.bg", "viewer");

    const state = await saveProductAction(initialFormState, productForm());

    expect(state.status).toBe("error");
    expect(state.message).toMatch(/Нямате право/);
    expect(await productsInDb()).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it("a viewer cannot change a price (nothing changes)", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    await loginAdminAs("viewer@firma.bg", "viewer");

    const state = await saveProductAction(
      initialFormState,
      productForm({ id: product.id, price: "99,00", name: "Hacked" }),
    );

    expect(state.status).toBe("error");
    const [row] = await getDb().select().from(tables.productPrices);
    expect(row.amountCents).toBe(1000);
    expect((await productsInDb())[0].name).toBe("Продукт 1");
  });

  it("an editor changes a price", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    await loginAdminAs("editor@firma.bg", "editor");

    const state = await saveProductAction(
      initialFormState,
      productForm({ id: product.id, name: "Продукт 1", description: "Описание на продукта.", sortOrder: "0", price: "15,75" }),
    );

    expect(state.status).toBe("success");
    const [row] = await getDb().select().from(tables.productPrices);
    expect(row.amountCents).toBe(1575);
  });

  it("a guest cannot reach any management action", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });

    const to = await redirectedTo(() =>
      saveProductAction(initialFormState, productForm({ id: product.id, price: "1" })),
    );

    expect(to).toBe("/admin/login");
    const [row] = await getDb().select().from(tables.productPrices);
    expect(row.amountCents).toBe(1000);
  });

  it("a customer session cannot reach any management action", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    await createUser();
    await redirectedTo(() =>
      loginAction(initialFormState, fd({ email: "client@firma.bg", password: PASSWORD })),
    );

    const to = await redirectedTo(() =>
      saveProductAction(initialFormState, productForm({ id: product.id, price: "1" })),
    );

    expect(to).toBe("/admin/login");
    expect((await getDb().select().from(tables.productPrices))[0].amountCents).toBe(1000);
  });

  it("an admin who only passed the password step has no access", async () => {
    await createAdmin({ email: "editor@firma.bg", role: "editor" });
    await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "editor@firma.bg", password: PASSWORD })),
    );

    const to = await redirectedTo(() => saveProductAction(initialFormState, productForm()));

    expect(to).toBe("/admin/login");
    expect(await productsInDb()).toHaveLength(0);
  });
});

describeDb("catalog editing: behavior and journal", () => {
  it("creates a product with a price and journals it", async () => {
    const { admin } = await loginAdminAs("editor@firma.bg", "editor");

    const to = await redirectedTo(() => saveProductAction(initialFormState, productForm()));

    expect(to).toBe("/admin/products");
    const [product] = await productsInDb();
    expect(product).toMatchObject({ slug: "novo-izdelie", name: "Ново изделие", published: true, sortOrder: 5 });
    expect((await getDb().select().from(tables.productPrices))[0].amountCents).toBe(1250);
    const [entry] = await auditRows();
    expect(entry).toMatchObject({
      action: "product.create",
      actorAdminId: admin.id,
      actorEmail: "editor@firma.bg",
      targetId: product.id,
    });
  });

  it("creates a product without a price when the field is empty", async () => {
    await loginAdminAs("editor@firma.bg", "editor");

    await redirectedTo(() => saveProductAction(initialFormState, productForm({ price: "" })));

    expect(await productsInDb()).toHaveLength(1);
    expect(await getDb().select().from(tables.productPrices)).toHaveLength(0);
  });

  it.each(["abc", "0", "-5", "12,345", "1e3"])("rejects the price %j", async (price) => {
    await loginAdminAs("editor@firma.bg", "editor");

    const state = await saveProductAction(initialFormState, productForm({ price }));

    expect(state.fieldErrors?.price).toBeTruthy();
    expect(await productsInDb()).toHaveLength(0);
  });

  it.each(["Bad Slug", "UPPER", "../x", "a--b", ""])("rejects the slug %j", async (slug) => {
    await loginAdminAs("editor@firma.bg", "editor");

    const state = await saveProductAction(initialFormState, productForm({ slug }));

    expect(state.fieldErrors?.slug).toBeTruthy();
    expect(await productsInDb()).toHaveLength(0);
  });

  it("rejects a slug that is already used", async () => {
    await makeProduct({ slug: "novo-izdelie" });
    await loginAdminAs("editor@firma.bg", "editor");

    const state = await saveProductAction(initialFormState, productForm());

    expect(state.fieldErrors?.slug).toMatch(/Вече има/);
    expect(await productsInDb()).toHaveLength(1);
  });

  it("journals a price change with the old and the new value", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    const { admin } = await loginAdminAs("editor@firma.bg", "editor");

    await saveProductAction(
      initialFormState,
      productForm({ id: product.id, name: "Продукт 1", description: "Описание на продукта.", sortOrder: "0", price: "12,00" }),
    );

    const entries = await auditRows();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "price.change", actorAdminId: admin.id });
    expect(entries[0].details).toMatchObject({ slug: "p", fromCents: 1000, toCents: 1200, currency: "EUR" });
  });

  it("writes no journal entry when nothing changed", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    await loginAdminAs("editor@firma.bg", "editor");

    await saveProductAction(
      initialFormState,
      productForm({ id: product.id, name: "Продукт 1", description: "Описание на продукта.", sortOrder: "0", price: "10,00" }),
    );

    expect(await auditRows()).toHaveLength(0);
  });

  it("journals removing a price, and a text change separately", async () => {
    const product = await makeProduct({ slug: "p", amountCents: 1000 });
    await loginAdminAs("editor@firma.bg", "editor");

    await saveProductAction(
      initialFormState,
      productForm({ id: product.id, name: "Ново име", description: "Описание на продукта.", sortOrder: "0", price: "" }),
    );

    const actions = (await auditRows()).map((r) => r.action).sort();
    expect(actions).toEqual(["price.change", "product.update"]);
    expect(await getDb().select().from(tables.productPrices)).toHaveLength(0);
    const update = (await auditRows()).find((r) => r.action === "product.update")!;
    expect(update.details).toMatchObject({ fields: "name" });
  });

  it("unpublishing hides the product from the public catalog", async () => {
    const product = await makeProduct({ slug: "p" });
    await loginAdminAs("editor@firma.bg", "editor");
    expect(await listPublicProducts()).toHaveLength(1);

    await saveProductAction(
      initialFormState,
      productForm({ id: product.id, name: "Продукт 1", description: "Описание на продукта.", sortOrder: "0", price: "12,50", published: "" }),
    );

    expect(await listPublicProducts()).toHaveLength(0);
  });

  it("does not let the slug be changed when editing", async () => {
    const product = await makeProduct({ slug: "p" });
    await loginAdminAs("editor@firma.bg", "editor");

    await saveProductAction(initialFormState, productForm({ id: product.id, slug: "drugo" }));

    expect((await productsInDb())[0].slug).toBe("p");
  });
});

describeDb("blocking accounts", () => {
  async function customerSession(email = "client@firma.bg", eik = "123456789") {
    await createUser({ email, eik });
    cookieJar.clear();
    await redirectedTo(() => loginAction(initialFormState, fd({ email, password: PASSWORD })));
    return new Map(cookieJar) as Jar;
  }

  it("a viewer cannot block anyone", async () => {
    const user = await createUser();
    await loginAdminAs("viewer@firma.bg", "viewer");

    await setUserBlockedAction(fd({ userId: user.id, blocked: "true" }));

    expect((await getDb().select().from(tables.users))[0].status).toBe("active");
    expect(await auditRows()).toHaveLength(0);
  });

  it("a viewer cannot block a company either", async () => {
    await createUser();
    const [company] = await getDb().select().from(tables.companies);
    await loginAdminAs("viewer@firma.bg", "viewer");

    await setCompanyBlockedAction(fd({ companyId: company.id, blocked: "true" }));

    expect((await getDb().select().from(tables.companies))[0].blockedAt).toBeNull();
  });

  it("blocking a customer ends their session at once and refuses a new login", async () => {
    const customer = await customerSession();
    const user = (await getDb().select().from(tables.users))[0];
    useJar(customer);
    expect(await getCurrentUser()).not.toBeNull();
    await loginAdminAs("editor@firma.bg", "editor");

    await setUserBlockedAction(fd({ userId: user.id, blocked: "true" }));

    useJar(customer);
    expect(await getCurrentUser()).toBeNull();
    expect(await getDb().select().from(tables.sessions).where(eq(tables.sessions.subjectType, "user"))).toHaveLength(0);
    cookieJar.clear();
    let message = "";
    await redirectedTo(async () => {
      message = (await loginAction(initialFormState, fd({ email: "client@firma.bg", password: PASSWORD }))).message ?? "";
    });
    expect(message).toMatch(/блокиран/);
    const entry = (await auditRows()).find((r) => r.action === "user.block")!;
    expect(entry.details).toMatchObject({ email: "client@firma.bg" });
  });

  it("unblocking restores access", async () => {
    const user = await createUser({ status: "blocked" });
    await loginAdminAs("editor@firma.bg", "editor");

    await setUserBlockedAction(fd({ userId: user.id, blocked: "false" }));

    expect((await getDb().select().from(tables.users))[0].status).toBe("active");
    expect((await auditRows())[0].action).toBe("user.unblock");
  });

  it("unblocking a never-verified account does not make it active", async () => {
    const user = await createUser({ status: "unverified" });
    await loginAdminAs("editor@firma.bg", "editor");
    await setUserBlockedAction(fd({ userId: user.id, blocked: "true" }));

    await setUserBlockedAction(fd({ userId: user.id, blocked: "false" }));

    expect((await getDb().select().from(tables.users))[0].status).toBe("unverified");
  });

  it("blocking a company ends the sessions of all its people", async () => {
    const a = await customerSession("a@firma.bg", "123456789");
    const b = await customerSession("b@firma.bg", "123456789");
    const other = await customerSession("c@drugafirma.bg", "987654321");
    const company = (await getDb().select().from(tables.companies).where(eq(tables.companies.eik, "123456789")))[0];
    await loginAdminAs("editor@firma.bg", "editor");

    await setCompanyBlockedAction(fd({ companyId: company.id, blocked: "true" }));

    useJar(a);
    expect(await getCurrentUser()).toBeNull();
    useJar(b);
    expect(await getCurrentUser()).toBeNull();
    useJar(other);
    expect((await getCurrentUser())?.email).toBe("c@drugafirma.bg");
    const entry = (await auditRows()).find((r) => r.action === "company.block")!;
    expect(entry.details).toMatchObject({ eik: "123456789" });
  });

  it("a blocked company's people cannot log in again, and a cookie alone gives nothing", async () => {
    const a = await customerSession("a@firma.bg");
    const company = (await getDb().select().from(tables.companies))[0];
    await getDb().update(tables.companies).set({ blockedAt: new Date() }).where(eq(tables.companies.id, company.id));

    useJar(a);
    expect(await getCurrentUser()).toBeNull();
    cookieJar.clear();
    let message = "";
    await redirectedTo(async () => {
      message = (await loginAction(initialFormState, fd({ email: "a@firma.bg", password: PASSWORD }))).message ?? "";
    });
    expect(message).toMatch(/блокиран/);
  });

  it("unblocking the company lets people in again", async () => {
    await createUser({ email: "a@firma.bg" });
    const company = (await getDb().select().from(tables.companies))[0];
    await getDb().update(tables.companies).set({ blockedAt: new Date() });
    await loginAdminAs("editor@firma.bg", "editor");

    await setCompanyBlockedAction(fd({ companyId: company.id, blocked: "false" }));

    cookieJar.clear();
    const to = await redirectedTo(() =>
      loginAction(initialFormState, fd({ email: "a@firma.bg", password: PASSWORD })),
    );
    expect(to).toBe("/");
  });

  it("ignores malformed ids", async () => {
    await loginAdminAs("editor@firma.bg", "editor");

    await setUserBlockedAction(fd({ userId: "not-a-uuid", blocked: "true" }));
    await setCompanyBlockedAction(fd({ companyId: "'; drop table users; --", blocked: "true" }));

    expect(await auditRows()).toHaveLength(0);
  });
});

describeDb("resetting another admin's 2FA", () => {
  const reset = (targetId: string, password: string, code: string) =>
    resetAdminTwoFactorAction(initialFormState, fd({ targetId, password, code }));

  // Moves the clock one 30-second step ahead, so a fresh code can be used
  // after the one spent at login (a used code cannot be replayed).
  async function freshCode(secret: string) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);
    return codeFor(secret, Math.floor(Date.now() / 1000));
  }

  it("a viewer cannot reset 2FA", async () => {
    const viewer = await loginAdminAs("viewer@firma.bg", "viewer");
    const target = await createAdmin({ email: "a@firma.bg" });

    const state = await reset(target.admin.id, PASSWORD, await freshCode(viewer.secret));

    expect(state.message).toMatch(/Нямате право/);
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, target.admin.id)))[0].totpEnabledAt).not.toBeNull();
  });

  it("B resets A: needs B's password and code, ends A's sessions, mails A, journals it", async () => {
    const a = await loginAdminAs("a@firma.bg", "editor");
    const b = await loginAdminAs("b@firma.bg", "editor");
    useJar(b.jar);

    const state = await reset(a.admin.id, PASSWORD, await freshCode(b.secret));

    expect(state.status).toBe("success");
    const [row] = await getDb().select().from(tables.admins).where(eq(tables.admins.id, a.admin.id));
    expect(row).toMatchObject({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null });
    expect(await getDb().select().from(tables.adminRecoveryCodes).where(eq(tables.adminRecoveryCodes.adminId, a.admin.id))).toHaveLength(0);
    // A's own session is gone.
    vi.useRealTimers();
    useJar(a.jar);
    expect(await getCurrentAdmin("full")).toBeNull();
    // A is told by mail.
    const mail = sentMails.find((m) => m.to === "a@firma.bg")!;
    expect(mail.text).toContain("b@firma.bg");
    // The journal names who did it, and holds no secrets.
    const entry = (await auditRows()).find((r) => r.action === "admin.2fa_reset")!;
    expect(entry).toMatchObject({ actorAdminId: b.admin.id, actorEmail: "b@firma.bg", targetId: a.admin.id });
    const dump = JSON.stringify(await auditRows());
    expect(dump).not.toContain(PASSWORD);
    // B's own 2FA is untouched.
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, b.admin.id)))[0].totpEnabledAt).not.toBeNull();
  });

  it("A must set 2FA up again at the next login, and the old codes are dead", async () => {
    const a = await loginAdminAs("a@firma.bg", "editor");
    const b = await loginAdminAs("b@firma.bg", "editor");
    useJar(b.jar);
    await reset(a.admin.id, PASSWORD, await freshCode(b.secret));
    vi.useRealTimers();

    cookieJar.clear();
    const to = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "a@firma.bg", password: PASSWORD })),
    );

    expect(to).toBe("/admin/2fa/setup");
    expect(await getCurrentAdmin("full")).toBeNull();
    // An old recovery code or old TOTP code no longer works.
    expect((await getCurrentAdmin("mfa_verify"))).toBeNull();
  });

  it("refuses a wrong password, even with a valid code", async () => {
    const b = await loginAdminAs("b@firma.bg", "editor");
    const a = await createAdmin({ email: "a@firma.bg" });

    const state = await reset(a.admin.id, "Wrong-pass1", await freshCode(b.secret));

    expect(state.message).toMatch(/Невалидна парола или код/);
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, a.admin.id)))[0].totpEnabledAt).not.toBeNull();
  });

  it("refuses the password alone (a wrong or missing 2FA code)", async () => {
    await loginAdminAs("b@firma.bg", "editor");
    const a = await createAdmin({ email: "a@firma.bg" });

    for (const code of ["000000", ""]) {
      const state = await reset(a.admin.id, PASSWORD, code);
      expect(state.status).toBe("error");
    }
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, a.admin.id)))[0].totpEnabledAt).not.toBeNull();
    expect(sentMails.filter((m) => m.to === "a@firma.bg")).toHaveLength(0);
  });

  it("does not accept the code that was just used to log in (no replay)", async () => {
    const a = await createAdmin({ email: "a@firma.bg" });
    cookieJar.clear();
    const b = await createAdmin({ email: "b@firma.bg" });
    await redirectedTo(() => adminLoginAction(initialFormState, fd({ email: "b@firma.bg", password: PASSWORD })));
    const code = await codeFor(b.secret);
    await redirectedTo(() => adminVerifyAction(initialFormState, fd({ code })));

    const state = await reset(a.admin.id, PASSWORD, code);

    expect(state.status).toBe("error");
  });

  it("locks re-authentication after 5 failures", async () => {
    const b = await loginAdminAs("b@firma.bg", "editor");
    const a = await createAdmin({ email: "a@firma.bg" });
    for (let i = 0; i < 5; i++) await reset(a.admin.id, "Wrong-pass1", "000000");

    const state = await reset(a.admin.id, PASSWORD, await freshCode(b.secret));

    expect(state.message).toMatch(/Твърде много опити/);
  });

  it("cannot reset one's own 2FA", async () => {
    const b = await loginAdminAs("b@firma.bg", "editor");

    const state = await reset(b.admin.id, PASSWORD, await freshCode(b.secret));

    expect(state.message).toMatch(/собствената/);
    expect((await getDb().select().from(tables.admins).where(eq(tables.admins.id, b.admin.id)))[0].totpEnabledAt).not.toBeNull();
  });

  it("reports an unknown admin without changing anything", async () => {
    const b = await loginAdminAs("b@firma.bg", "editor");

    const state = await reset("00000000-0000-0000-0000-000000000000", PASSWORD, await freshCode(b.secret));

    expect(state.message).toMatch(/не е намерен/);
    expect(await auditRows()).toHaveLength(0);
  });

  it("only audit entries of this action exist after a failed attempt", async () => {
    await loginAdminAs("b@firma.bg", "editor");
    const a = await createAdmin({ email: "a@firma.bg" });
    await reset(a.admin.id, "Wrong-pass1", "000000");

    expect(await getDb().select().from(tables.auditLog).where(and(eq(tables.auditLog.action, "admin.2fa_reset")))).toHaveLength(0);
  });
});

describeDb("catalog editing: technical data", () => {
  const specs = {
    series: "hds", connector: "LC", ports: "12", mpoPorts: "", fibers: "24",
    maxFibersVariant: "48", rackUnits: "1", polish: "SM/UPC, SM/APC", splice: "1", frontDoor: "",
  };

  it("saves technical data; an empty field is unknown, not zero or false", async () => {
    await loginAdminAs("editor@firma.bg", "editor");

    await redirectedTo(() => saveProductAction(initialFormState, productForm(specs)));

    const [p] = await productsInDb();
    expect(p).toMatchObject({
      series: "hds", connector: "LC", ports: 12, mpoPorts: null, fibers: 24, maxFibersVariant: 48,
      rackUnits: 1, polish: ["SM/UPC", "SM/APC"], splice: true, frontDoor: null,
    });
    const [pub] = await listPublicProducts();
    expect(pub.fibersPerRu).toBe(24);
  });

  it("journals a change of technical data with the changed field names only", async () => {
    await loginAdminAs("editor@firma.bg", "editor");
    await redirectedTo(() => saveProductAction(initialFormState, productForm(specs)));
    const [p] = await productsInDb();

    await saveProductAction(
      initialFormState,
      productForm({ ...specs, id: p.id, fibers: "48", frontDoor: "1" }),
    );

    const update = (await auditRows()).find((r) => r.action === "product.update");
    expect(update?.details).toMatchObject({ fields: "fibers,frontDoor" });
    expect(JSON.stringify(update)).not.toContain("SM/UPC");
  });

  it.each([
    ["ports", "0"], ["ports", "-3"], ["fibers", "1.5"], ["rackUnits", "abc"],
    ["series", "other"], ["splice", "maybe"], ["frontDoor", "2"],
  ])("rejects an invalid %s (%s) and stores nothing", async (name, value) => {
    await loginAdminAs("editor@firma.bg", "editor");

    const state = await saveProductAction(initialFormState, productForm({ ...specs, [name]: value }));

    expect(state.fieldErrors?.[name]).toBeTruthy();
    expect(await productsInDb()).toHaveLength(0);
  });

  it("a viewer cannot change technical data", async () => {
    const { jar } = await loginAdminAs("viewer@firma.bg", "viewer");
    const product = await makeProduct({ slug: "x" });
    useJar(jar);

    await saveProductAction(initialFormState, productForm({ ...specs, id: product.id }));

    expect((await productsInDb())[0].series).toBeNull();
  });
});
