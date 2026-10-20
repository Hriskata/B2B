import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { DEFAULT_ADMIN_PASSWORD } from "@/lib/admin/admins";
import { getCurrentAdmin } from "@/lib/auth/current";
import { initialFormState } from "@/lib/form-state";
import { verifyPassword } from "@/lib/password";
import { codeFor, createAdmin, fd, PASSWORD } from "@/test/factories";
import { sentMails } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminChangePasswordAction, adminLoginAction, adminVerifyAction } from "./actions";
import { createAdminAction, saveProductAction } from "./manage-actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

afterEach(() => vi.useRealTimers());

async function loginAs(
  email: string,
  password: string,
  overrides: Parameters<typeof createAdmin>[0] = {},
) {
  const made = await createAdmin({ email, password, ...overrides });
  cookieJar.clear();
  await redirectedTo(() => adminLoginAction(initialFormState, fd({ email, password })));
  const code = await codeFor(made.secret);
  await redirectedTo(() => adminVerifyAction(initialFormState, fd({ code })));
  expect(await getCurrentAdmin("full")).not.toBeNull();
  return made;
}

const adminsInDb = () => getDb().select().from(tables.admins);
const auditRows = () => getDb().select().from(tables.auditLog);
const productForm = () =>
  fd({ slug: "novo", name: "Ново", description: "Описание.", sortOrder: "1", price: "", published: "on" });

describeDb("adding an admin from the portal", () => {
  it("an editor adds an admin with the default password, a forced change, a journal entry and a mail without the password", async () => {
    const { admin } = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });

    const state = await createAdminAction(initialFormState, fd({ email: "New.Admin@Firma.bg", role: "viewer" }));

    expect(state.status).toBe("success");
    expect(state.message).toContain(DEFAULT_ADMIN_PASSWORD);
    const created = (await adminsInDb()).find((a) => a.email === "new.admin@firma.bg")!;
    expect(created).toMatchObject({ role: "viewer", status: "active", passwordMustChange: true, totpEnabledAt: null });
    expect(await verifyPassword(created.passwordHash, DEFAULT_ADMIN_PASSWORD)).toBe(true);
    const entry = (await auditRows()).find((r) => r.action === "admin.create")!;
    expect(entry).toMatchObject({ actorAdminId: admin.id, targetId: created.id });
    expect(entry.details).toMatchObject({ targetEmail: "new.admin@firma.bg", role: "viewer" });
    expect(JSON.stringify(entry)).not.toContain(DEFAULT_ADMIN_PASSWORD);
    const mail = sentMails.find((m) => m.to === "new.admin@firma.bg")!;
    expect(mail).toBeTruthy();
    expect(mail.text).not.toContain(DEFAULT_ADMIN_PASSWORD);
  });

  it("a viewer cannot add an admin (server refuses, nothing is stored)", async () => {
    await loginAs("viewer@firma.bg", PASSWORD, { role: "viewer" });

    const state = await createAdminAction(initialFormState, fd({ email: "x@firma.bg", role: "editor" }));

    expect(state.status).toBe("error");
    expect(await adminsInDb()).toHaveLength(1);
  });

  it("refuses an existing email, a bad email and an unknown role", async () => {
    await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });

    const dup = await createAdminAction(initialFormState, fd({ email: "EDITOR@firma.bg", role: "viewer" }));
    const bad = await createAdminAction(initialFormState, fd({ email: "not-an-email", role: "viewer" }));
    const role = await createAdminAction(initialFormState, fd({ email: "a@firma.bg", role: "root" }));

    expect(dup.fieldErrors?.email).toBeTruthy();
    expect(bad.fieldErrors?.email).toBeTruthy();
    expect(role.fieldErrors?.role).toBeTruthy();
    expect(await adminsInDb()).toHaveLength(1);
  });
});

describeDb("forced change of the default password", () => {
  const login = () =>
    loginAs("temp@firma.bg", DEFAULT_ADMIN_PASSWORD, { role: "editor", passwordMustChange: true });

  it("an admin with the default password can do nothing but change it", async () => {
    await login();

    const to = await redirectedTo(() => saveProductAction(initialFormState, productForm()));

    expect(to).toBe("/admin/change-password");
    expect(await getDb().select().from(tables.products)).toHaveLength(0);
  });

  it("refuses a bad change: same password, mismatch, weak, wrong current", async () => {
    await login();
    const change = (currentPassword: string, newPassword: string, repeatPassword = newPassword) =>
      adminChangePasswordAction(initialFormState, fd({ currentPassword, newPassword, repeatPassword }));

    const same = await change(DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_PASSWORD);
    const mismatch = await change(DEFAULT_ADMIN_PASSWORD, "Nova-parola-9", "Other-parola-9");
    const weak = await change(DEFAULT_ADMIN_PASSWORD, "short");
    const wrong = await change("Wrong-pass-1", "Nova-parola-9");

    expect(same.fieldErrors?.newPassword).toBeTruthy();
    expect(mismatch.fieldErrors?.repeatPassword).toBeTruthy();
    expect(weak.fieldErrors?.newPassword).toBeTruthy();
    expect(wrong.fieldErrors?.currentPassword).toBeTruthy();
    expect((await adminsInDb())[0].passwordMustChange).toBe(true);
  });

  it("changing the password clears the flag, journals it, ends other sessions and keeps this one", async () => {
    const made = await login();
    await getDb().insert(tables.sessions).values({
      tokenHash: "other-session",
      subjectType: "admin",
      subjectId: made.admin.id,
      stage: "full",
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    const to = await redirectedTo(() =>
      adminChangePasswordAction(
        initialFormState,
        fd({ currentPassword: DEFAULT_ADMIN_PASSWORD, newPassword: "Nova-parola-9", repeatPassword: "Nova-parola-9" }),
      ),
    );

    expect(to).toBe("/admin");
    const [row] = await adminsInDb();
    expect(row.passwordMustChange).toBe(false);
    expect(await verifyPassword(row.passwordHash, "Nova-parola-9")).toBe(true);
    const entry = (await auditRows()).find((r) => r.action === "admin.password_change")!;
    expect(JSON.stringify(entry)).not.toContain("Nova-parola-9");
    const sessions = await getDb().select().from(tables.sessions);
    expect(sessions.some((s) => s.tokenHash === "other-session")).toBe(false);
    expect(await getCurrentAdmin("full")).not.toBeNull();
    // From now on the admin works normally.
    expect(await redirectedTo(() => saveProductAction(initialFormState, productForm()))).toBe("/admin/products");
  });
});
