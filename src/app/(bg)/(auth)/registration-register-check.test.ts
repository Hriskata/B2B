import { describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { listPendingRegistrations } from "@/lib/admin/registrations";
import { initialFormState } from "@/lib/form-state";
import { companyRegister } from "@/test/company-register";
import { createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { sentMails, tokenFromMail } from "@/test/mail-capture";
import { redirectedTo } from "@/test/next-mocks";
import { registerAction } from "./register/actions";
import { verifyEmailAction } from "./verify-email/actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const register = (overrides: Record<string, string> = {}) =>
  registerAction(
    initialFormState,
    fd({
      fullName: "Иван Петров",
      email: "client@firma.bg",
      password: PASSWORD,
      passwordConfirm: PASSWORD,
      country: "BG",
      companyName: "Тест ЕООД",
      companyNumber: "123456789",
      "cf-turnstile-response": "ok",
      ...overrides,
    }),
  );

// Registers, opens the emailed link and returns the redirect and the profile.
async function registerAndConfirm(overrides: Record<string, string> = {}) {
  expect((await register(overrides)).status).toBe("success");
  const token = tokenFromMail(sentMails.find((m) => m.subject === "Потвърдете имейл адреса си")!);
  const to = await redirectedTo(() => verifyEmailAction(initialFormState, fd({ token })));
  const [user] = await getDb().select().from(tables.users);
  const [company] = await getDb().select().from(tables.companies);
  return { to, user, company };
}

describeDb("registration and the company register", () => {
  it("an active company is approved without a person", async () => {
    const { to, user, company } = await registerAndConfirm();

    expect(to).toBe("/login?notice=email-verified");
    expect(user).toMatchObject({ status: "active", needsReview: false });
    expect(company).toMatchObject({ registryState: "active", registryStatus: "ACTIVE" });
    expect(company.registryCheckedAt).not.toBeNull();
    expect(companyRegister.calls).toEqual(["123456789"]);
  });

  it("a company the register does not know gets a clear message, and nothing is created", async () => {
    companyRegister.answers.set("123456789", { found: false, certain: true });

    const state = await register();

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.companyNumber).toMatch(/Не намерихме фирма с този ЕИК/);
    expect(await getDb().select().from(tables.users)).toHaveLength(0);
    expect(await getDb().select().from(tables.companies)).toHaveLength(0);
    expect(sentMails).toHaveLength(0);
  });

  it("the not-found answer is the same for a registered and a new email", async () => {
    await createUser({ email: "client@firma.bg", companyNumber: "987654321" });
    companyRegister.answers.set("111111111", { found: false, certain: true });

    const known = await register({ companyNumber: "111111111" });
    const unknown = await register({ email: "new@firma.bg", companyNumber: "111111111" });

    expect(known).toMatchObject({ status: unknown.status, fieldErrors: unknown.fieldErrors });
    expect(sentMails).toHaveLength(0);
  });

  it("an inactive company registers without a review and is flagged for the admins", async () => {
    await createAdmin();
    companyRegister.answers.set("123456789", { found: true, status: "INACTIVE", name: "Тест ЕООД" });

    const { to, user, company } = await registerAndConfirm();

    expect(to).toBe("/login?notice=email-verified");
    expect(user).toMatchObject({ status: "active", needsReview: false });
    expect(company).toMatchObject({ registryState: "inactive", registryStatus: "INACTIVE" });
    expect(sentMails.map((m) => m.subject)).not.toContain("Нова регистрация чака преглед");
    const { listCustomers } = await import("@/lib/admin/accounts");
    expect((await listCustomers())[0].registryState).toBe("inactive");
  });

  it.each([
    ["an unknown status code", { found: true, status: "Z", name: "Тест ЕООД" } as const, "unknown"],
    ["a register that does not answer", "fail" as const, "unavailable"],
  ])("%s goes to manual review, and the admins are told", async (_name, answer, state) => {
    await createAdmin();
    companyRegister.answers.set("123456789", answer);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { to, user, company } = await registerAndConfirm();

    expect(to).toBe("/pending-approval");
    expect(user).toMatchObject({ status: "pending_review", needsReview: true });
    expect(company.registryState).toBe(state);
    expect(sentMails.map((m) => m.subject)).toContain("Нова регистрация чака преглед");
    const [pending] = await listPendingRegistrations();
    expect(pending.registryState).toBe(state);
  });

  it("without a register key every Bulgarian registration goes to manual review", async () => {
    companyRegister.configured = false;

    const { user, company } = await registerAndConfirm();

    expect(user.status).toBe("pending_review");
    expect(company.registryState).toBe("unavailable");
    expect(companyRegister.calls).toHaveLength(0);
  });

  it("a foreign company is not looked up in the Bulgarian register", async () => {
    const { user, company } = await registerAndConfirm({ country: "DE", companyNumber: "123456789" });

    expect(user.status).toBe("pending_review");
    expect(company.registryState).toBeNull();
    expect(companyRegister.calls).toHaveLength(0);
  });

  it("does not ask the register once the registration limit is reached", async () => {
    for (let i = 0; i < 3; i++) await register();
    const callsBefore = companyRegister.calls.length;

    expect((await register()).message).toMatch(/Твърде много опити/);
    expect(companyRegister.calls).toHaveLength(callsBefore);
  });

  it("a Bulgarian profile waiting for review stays waiting after a block and unblock", async () => {
    companyRegister.answers.set("123456789", "fail");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user } = await registerAndConfirm();
    const { setUserBlocked } = await import("@/lib/admin/accounts");
    const actor = { id: "00000000-0000-0000-0000-000000000000", email: "a@firma.bg" };
    const { admin } = await createAdmin();

    await setUserBlocked({ ...actor, id: admin.id }, user.id, true);
    await setUserBlocked({ ...actor, id: admin.id }, user.id, false);

    expect((await getDb().select().from(tables.users))[0].status).toBe("pending_review");
  });

  it("an unconfirmed not found (e.g. a 404 of unknown meaning) goes to review, not to a refusal", async () => {
    companyRegister.answers.set("123456789", { found: false, certain: false });

    const { to, user, company } = await registerAndConfirm();

    expect(to).toBe("/pending-approval");
    expect(user.status).toBe("pending_review");
    expect(company.registryState).toBe("not_confirmed");
  });

  it("registering again while unverified adds a review when the company is no longer confirmed", async () => {
    await register();
    companyRegister.answers.set("123456789", { found: true, status: "Z", name: "Тест ЕООД" });
    await getDb().delete(tables.companyCheckCache);
    await register();

    const token = tokenFromMail(sentMails[sentMails.length - 1]);
    const to = await redirectedTo(() => verifyEmailAction(initialFormState, fd({ token })));
    expect(to).toBe("/pending-approval");
    expect((await getDb().select().from(tables.users))[0]).toMatchObject({ needsReview: true, status: "pending_review" });
  });

  it("a register that does not answer does not wipe an earlier real answer on the company", async () => {
    await register();
    companyRegister.defaultAnswer = "fail";
    await getDb().delete(tables.companyCheckCache);
    vi.spyOn(console, "error").mockImplementation(() => {});
    await register({ email: "second@firma.bg" });

    const [company] = await getDb().select().from(tables.companies);
    expect(company).toMatchObject({ registryState: "active", registryStatus: "ACTIVE" });
    const second = (await getDb().select().from(tables.users)).find((u) => u.email === "second@firma.bg")!;
    expect(second.needsReview).toBe(true);
  });
});
