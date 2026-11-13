import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { loginAction } from "@/app/(bg)/(auth)/login/actions";
import { initialFormState } from "@/lib/form-state";
import { mergeItems } from "@/lib/inquiries";
import { createProduct } from "@/test/catalog-factories";
import { companyRegister } from "@/test/company-register";
import { createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { sentMails } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { submitInquiryAction } from "./actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

async function loginCustomer(overrides: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(overrides);
  cookieJar.clear();
  await redirectedTo(() =>
    loginAction(initialFormState, fd({ email: user.email, password: PASSWORD })),
  );
  return user;
}

const form = (overrides: Record<string, string> = {}, items: unknown = [{ slug: "produkt-1", quantity: 2 }]) =>
  fd({
    contactName: "Иван Петров",
    phone: "+359 888 123 456",
    message: "",
    clientKey: randomUUID(),
    items: JSON.stringify(items),
    ...overrides,
  });

const send = (data: FormData) => redirectedTo(() => submitInquiryAction(initialFormState, data));
const inquiryRows = () => getDb().select().from(tables.inquiries);
const itemRows = () => getDb().select().from(tables.inquiryItems);
const inquiryMails = () => sentMails.filter((m) => m.subject.startsWith("Ново запитване"));

describe("mergeItems", () => {
  it("joins the same product into one line with the sum", () => {
    expect(
      mergeItems([
        { slug: "a", quantity: 1 },
        { slug: "b", quantity: 3 },
        { slug: "a", quantity: 4 },
      ]),
    ).toEqual([
      { slug: "a", quantity: 5 },
      { slug: "b", quantity: 3 },
    ]);
  });
});

describeDb("sending an inquiry", () => {
  it("a guest is sent to the login and nothing is saved", async () => {
    await createProduct();
    cookieJar.clear();
    expect(await send(form())).toBe("/login");
    expect(await inquiryRows()).toHaveLength(0);
  });

  it("saves the inquiry with several products and any quantity from 1, then mails the owners only", async () => {
    await createAdmin({ email: "owner@firma.bg", withTotp: false }).then(({ admin }) =>
      getDb().update(tables.admins).set({ kind: "owner" }).where(eq(tables.admins.id, admin.id)),
    );
    await createAdmin({ email: "support@firma.bg", withTotp: false });
    await createProduct({ slug: "produkt-1", name: "Продукт 1" });
    await createProduct({ slug: "produkt-2", name: "Продукт 2" });
    const user = await loginCustomer();

    const to = await send(
      form({ message: "Срок до края на месеца." }, [
        { slug: "produkt-1", quantity: 1 },
        { slug: "produkt-2", quantity: 250 },
        { slug: "produkt-1", quantity: 2 },
      ]),
    );

    expect(to).toBe("/inquiry/sent");
    const [inquiry] = await inquiryRows();
    expect(inquiry).toMatchObject({
      userId: user.id,
      companyId: user.companyId,
      contactName: "Иван Петров",
      phone: "+359 888 123 456",
      message: "Срок до края на месеца.",
      companyInactive: false,
      decision: null,
    });
    const items = (await itemRows()).sort((a, b) => a.productName.localeCompare(b.productName));
    expect(items.map((i) => [i.productName, i.quantity])).toEqual([
      ["Продукт 1", 3],
      ["Продукт 2", 250],
    ]);
    await vi.waitFor(() => expect(inquiryMails()).toHaveLength(1));
    const [mail] = inquiryMails();
    expect(mail.to).toBe("owner@firma.bg");
    expect(mail.text).toContain("Продукт 2: 250 бр.");
    // Typed by the customer: never in our mail.
    expect(mail.text).not.toContain("Срок до края");
    expect(mail.text).not.toContain("Тест ЕООД");
  });

  it("without an active owner every active admin gets the mail", async () => {
    await createAdmin({ email: "a@firma.bg", withTotp: false });
    await createAdmin({ email: "b@firma.bg", withTotp: false });
    const { admin: blockedOwner } = await createAdmin({ email: "c@firma.bg", withTotp: false, status: "blocked" });
    await getDb().update(tables.admins).set({ kind: "owner" }).where(eq(tables.admins.id, blockedOwner.id));
    await createProduct();
    await loginCustomer();

    await send(form());

    await vi.waitFor(() => expect(inquiryMails()).toHaveLength(2));
    expect(inquiryMails().map((m) => m.to).sort()).toEqual(["a@firma.bg", "b@firma.bg"]);
  });

  it("a second submit of the same form creates nothing new and sends no second mail", async () => {
    await createAdmin({ withTotp: false });
    await createProduct();
    await loginCustomer();
    const clientKey = randomUUID();

    expect(await send(form({ clientKey }))).toBe("/inquiry/sent");
    expect(await send(form({ clientKey }))).toBe("/inquiry/sent");
    // Parallel double click.
    const key2 = randomUUID();
    await Promise.all([send(form({ clientKey: key2 })), send(form({ clientKey: key2 }))]);

    expect(await inquiryRows()).toHaveLength(2);
    await vi.waitFor(() => expect(inquiryMails()).toHaveLength(2));
  });

  it("refuses no product, a quantity under 1 or not whole, and a missing name or phone", async () => {
    await createProduct();
    await loginCustomer();

    for (const items of [[], [{ slug: "produkt-1", quantity: 0 }], [{ slug: "produkt-1", quantity: 1.5 }], "x"]) {
      const state = await submitInquiryAction(initialFormState, form({}, items));
      expect(state.fieldErrors?.items).toBeTruthy();
    }
    const noName = await submitInquiryAction(initialFormState, form({ contactName: " " }));
    expect(noName.fieldErrors?.contactName).toBeTruthy();
    for (const phone of ["", "12345", "phone 123456", "<b>0888123456</b>"]) {
      const state = await submitInquiryAction(initialFormState, form({ phone }));
      expect(state.fieldErrors?.phone).toBeTruthy();
    }
    expect(await inquiryRows()).toHaveLength(0);
  });

  it("refuses a hidden or unknown product and saves nothing", async () => {
    await createProduct({ slug: "skrit", published: false });
    await createProduct({ slug: "produkt-1" });
    await loginCustomer();

    for (const slug of ["skrit", "nyama-takav"]) {
      const state = await submitInquiryAction(
        initialFormState,
        form({}, [
          { slug: "produkt-1", quantity: 1 },
          { slug, quantity: 1 },
        ]),
      );
      expect(state.status).toBe("error");
      expect(state.message).toMatch(/вече не е наличен/);
    }
    expect(await inquiryRows()).toHaveLength(0);
  });

  it("HTML in the fields is kept as plain text (never run)", async () => {
    await createProduct();
    await loginCustomer();
    await send(form({ contactName: "<script>x</script>", message: "<img src=x onerror=alert(1)>" }));
    const [inquiry] = await inquiryRows();
    expect(inquiry.contactName).toBe("<script>x</script>");
    expect(inquiry.message).toBe("<img src=x onerror=alert(1)>");
  });

  it("a company inactive in the register: same answer for the customer, a flag for the admins", async () => {
    await createAdmin({ withTotp: false });
    await createProduct();
    companyRegister.answers.set("123456789", { found: true, status: "INACTIVE", name: "Тест ЕООД" });
    await loginCustomer();

    expect(await send(form())).toBe("/inquiry/sent");

    const [inquiry] = await inquiryRows();
    expect(inquiry).toMatchObject({ companyInactive: true, registryStatus: "INACTIVE" });
    const [company] = await getDb().select().from(tables.companies);
    expect(company.registryState).toBe("inactive");
    await vi.waitFor(() => expect(inquiryMails()).toHaveLength(1));
    expect(inquiryMails()[0].subject).toBe("Ново запитване (неактивна фирма)");
  });

  it("a company the register no longer knows (deleted) is flagged too", async () => {
    await createProduct();
    // The fake register's "not found" counts as confirmed only when NOT_FOUND_CONFIRMED
    // is on; here the stored answer of an earlier check is "not_found".
    const user = await loginCustomer();
    await getDb()
      .update(tables.companies)
      .set({ registryState: "not_found" })
      .where(eq(tables.companies.id, user.companyId));
    companyRegister.answers.set("123456789", "fail");

    expect(await send(form())).toBe("/inquiry/sent");
    expect((await inquiryRows())[0]).toMatchObject({ companyInactive: true, registryStatus: "не е намерена" });
  });

  it("refuses hidden or reversing characters in the name and message; line breaks in the message are fine", async () => {
    await createProduct();
    await loginCustomer();
    const name = await submitInquiryAction(initialFormState, form({ contactName: "Иван \u202EПетров" }));
    expect(name.fieldErrors?.contactName).toBeTruthy();
    const msg = await submitInquiryAction(initialFormState, form({ message: "срок \u202E0888" }));
    expect(msg.fieldErrors?.message).toBeTruthy();
    expect(await inquiryRows()).toHaveLength(0);
    expect(await send(form({ message: "ред 1\r\nред 2" }))).toBe("/inquiry/sent");
    expect((await inquiryRows())[0].message).toBe("ред 1\r\nред 2");
  });

  it("a register that does not answer keeps the last real answer", async () => {
    await createProduct();
    const user = await loginCustomer();
    await getDb()
      .update(tables.companies)
      .set({ registryState: "inactive", registryStatus: "INACTIVE" })
      .where(eq(tables.companies.id, user.companyId));
    companyRegister.answers.set("123456789", "fail");

    await send(form());

    expect((await inquiryRows())[0].companyInactive).toBe(true);
    expect((await getDb().select().from(tables.companies))[0].registryState).toBe("inactive");
  });

  it("a foreign company is not checked in the register", async () => {
    await createProduct();
    await loginCustomer({ country: "DE", companyNumber: "DE123456789", status: "active" });
    await send(form());
    expect(companyRegister.calls).toHaveLength(0);
    expect((await inquiryRows())[0].companyInactive).toBe(false);
  });

  it("a blocked customer cannot send (the session no longer counts)", async () => {
    await createProduct();
    const user = await loginCustomer();
    await getDb().update(tables.users).set({ status: "blocked" }).where(eq(tables.users.id, user.id));
    expect(await send(form())).toBe("/login");
    expect(await inquiryRows()).toHaveLength(0);
  });

  it("is limited per customer", async () => {
    await createProduct();
    await loginCustomer();
    // A refused inquiry (unknown product) does not use up the allowance.
    await submitInquiryAction(initialFormState, form({}, [{ slug: "nyama-takav", quantity: 1 }]));
    for (let i = 0; i < 10; i++) expect(await send(form())).toBe("/inquiry/sent");
    const state = await submitInquiryAction(initialFormState, form());
    expect(state.message).toMatch(/Твърде много опити/);
    expect(await inquiryRows()).toHaveLength(10);
  });
});
