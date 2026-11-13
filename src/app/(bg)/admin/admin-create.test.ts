import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { getCurrentAdmin } from "@/lib/auth/current";
import { initialFormState } from "@/lib/form-state";
import { verifyPassword } from "@/lib/password";
import { codeFor, createAdmin, fd, PASSWORD } from "@/test/factories";
import { mailControl, sentMails, tokenFromMail } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import {
  adminAcceptInviteAction,
  adminChangePasswordAction,
  adminForgotPasswordAction,
  adminResetPasswordAction,
  adminLoginAction,
  adminVerifyAction,
} from "./actions";
import { createAdminAction, resendAdminInviteAction, saveProductAction } from "./manage-actions";

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

// Moves the clock one 30-second step ahead, so a fresh code can be used
// after the one spent at login (a used code cannot be replayed).
async function freshCode(secret: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + 60_000);
  return codeFor(secret, Math.floor(Date.now() / 1000));
}

// Admins created before the invite link (decided 11.11.2026) got this
// temporary password and still have to change it at the first login.
const LEGACY_PASSWORD = "Password123";

const adminsInDb = () => getDb().select().from(tables.admins);
const auditRows = () => getDb().select().from(tables.auditLog);
const productForm = () =>
  fd({ slug: "novo", name: "Ново", description: "Описание.", sortOrder: "1", price: "", published: "on" });

describeDb("adding an admin from the portal", () => {
  it("an editor adds an admin: an invite link by mail, no password anywhere, a journal entry", async () => {
    const { admin, secret } = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });

    const state = await createAdminAction(
      initialFormState,
      fd({ email: "New.Admin@Firma.bg", role: "viewer", kind: "support", password: PASSWORD, code: await freshCode(secret) }),
    );

    expect(state.status).toBe("success");
    expect(state.message).toMatch(/връзка за задаване на парола/);
    expect(state.message).not.toMatch(/Password123|Временна парола/);
    const created = (await adminsInDb()).find((a) => a.email === "new.admin@firma.bg")!;
    expect(created).toMatchObject({ role: "viewer", status: "active", passwordMustChange: true, totpEnabledAt: null });
    // The old temporary password does not open the account.
    expect(await verifyPassword(created.passwordHash, LEGACY_PASSWORD)).toBe(false);
    const entry = (await auditRows()).find((r) => r.action === "admin.create")!;
    expect(entry).toMatchObject({ actorAdminId: admin.id, targetId: created.id });
    expect(entry.details).toMatchObject({ targetEmail: "new.admin@firma.bg", role: "viewer" });
    const mail = sentMails.find((m) => m.to === "new.admin@firma.bg")!;
    expect(mail.subject).toBe("Покана за администратор");
    expect(mail.text).toMatch(/\/admin\/invite\?token=/);
    expect(mail.text).toContain("72 часа");
  });

  it("needs the editor's own password and a current 2FA code (an open session is not enough)", async () => {
    const { secret } = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });

    const none = await createAdminAction(initialFormState, fd({ email: "x@firma.bg", role: "viewer", kind: "support" }));
    const wrongPassword = await createAdminAction(
      initialFormState,
      fd({ email: "x@firma.bg", role: "viewer", kind: "support", password: "Wrong-pass9", code: await freshCode(secret) }),
    );
    const wrongCode = await createAdminAction(
      initialFormState,
      fd({ email: "x@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code: "000000" }),
    );

    for (const state of [none, wrongPassword, wrongCode]) {
      expect(state.status).toBe("error");
      expect(state.message).toMatch(/Невалидна парола или код/);
    }
    expect(await adminsInDb()).toHaveLength(1);
    expect(sentMails.filter((m) => m.to === "x@firma.bg")).toHaveLength(0);
  });

  it("a viewer cannot add an admin (server refuses, nothing is stored)", async () => {
    await loginAs("viewer@firma.bg", PASSWORD, { role: "viewer" });

    const state = await createAdminAction(initialFormState, fd({ email: "x@firma.bg", role: "editor", kind: "support" }));

    expect(state.status).toBe("error");
    expect(await adminsInDb()).toHaveLength(1);
  });

  it("refuses an existing email, a bad email and an unknown role", async () => {
    const { secret } = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });

    const dup = await createAdminAction(
      initialFormState,
      fd({ email: "EDITOR@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code: await freshCode(secret) }),
    );
    const bad = await createAdminAction(initialFormState, fd({ email: "not-an-email", role: "viewer", kind: "support" }));
    const role = await createAdminAction(initialFormState, fd({ email: "a@firma.bg", role: "root", kind: "support" }));

    expect(dup.fieldErrors?.email).toBeTruthy();
    expect(bad.fieldErrors?.email).toBeTruthy();
    expect(role.fieldErrors?.role).toBeTruthy();
    expect(await adminsInDb()).toHaveLength(1);
  });

  it("a taken email is refused before the 2FA code is spent", async () => {
    const { secret } = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });
    const code = await freshCode(secret);

    const dup = await createAdminAction(
      initialFormState,
      fd({ email: "editor@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code }),
    );
    expect(dup.fieldErrors?.email).toBeTruthy();

    // The same code still works for the corrected form.
    const ok = await createAdminAction(
      initialFormState,
      fd({ email: "new@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code }),
    );
    expect(ok.status).toBe("success");
  });

  it("wrong codes here are limited on their own and do not lock the admin's login", async () => {
    const made = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });
    const attempt = () =>
      createAdminAction(
        initialFormState,
        fd({ email: "x@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code: "000000" }),
      );
    for (let i = 0; i < 5; i++) expect((await attempt()).message).toMatch(/Невалидна парола или код/);
    expect((await attempt()).message).toMatch(/Твърде много опити/);

    // The login with a valid code still works.
    vi.useRealTimers();
    cookieJar.clear();
    await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "editor@firma.bg", password: PASSWORD })),
    );
    await redirectedTo(async () =>
      adminVerifyAction(initialFormState, fd({ code: await freshCode(made.secret) })),
    );
    expect(await getCurrentAdmin("full")).not.toBeNull();
  });
});

describeDb("forced change of the default password", () => {
  const login = () =>
    loginAs("temp@firma.bg", LEGACY_PASSWORD, { role: "editor", passwordMustChange: true });

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

    const same = await change(LEGACY_PASSWORD, LEGACY_PASSWORD);
    const mismatch = await change(LEGACY_PASSWORD, "Nova-parola-9", "Other-parola-9");
    const weak = await change(LEGACY_PASSWORD, "short");
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
        fd({ currentPassword: LEGACY_PASSWORD, newPassword: "Nova-parola-9", repeatPassword: "Nova-parola-9" }),
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

describeDb("invite link for a new admin", () => {
  async function invite(email = "new@firma.bg") {
    const editor = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });
    await createAdminAction(
      initialFormState,
      fd({ email, role: "viewer", kind: "support", password: PASSWORD, code: await freshCode(editor.secret) }),
    );
    vi.useRealTimers();
    const mail = sentMails.filter((m) => m.to === email).at(-1)!;
    return { editor, token: tokenFromMail(mail) };
  }
  const accept = (token: string, password: string, confirm = password) =>
    adminAcceptInviteAction(initialFormState, fd({ token, password, confirm }));

  it("cannot log in before the password is set", async () => {
    await invite();
    cookieJar.clear();
    const state = await adminLoginAction(
      initialFormState,
      fd({ email: "new@firma.bg", password: LEGACY_PASSWORD }),
    );
    expect(state.status).toBe("error");
    expect(await getCurrentAdmin("mfa_setup")).toBeNull();
  });

  it("sets the password once, clears the flag, journals it without the password, then login asks for 2FA setup", async () => {
    const { token } = await invite();

    const to = await redirectedTo(() => accept(token, "Nova-parola-9"));
    expect(to).toBe("/admin/login?notice=invite-accepted");
    const created = (await adminsInDb()).find((a) => a.email === "new@firma.bg")!;
    expect(created.passwordMustChange).toBe(false);
    expect(await verifyPassword(created.passwordHash, "Nova-parola-9")).toBe(true);
    const entry = (await auditRows()).find(
      (r) => r.action === "admin.password_change" && r.targetId === created.id,
    )!;
    expect(entry.details).toMatchObject({ reason: "invite" });
    expect(JSON.stringify(entry)).not.toContain("Nova-parola-9");

    expect((await accept(token, "Drugo-parola-9")).status).toBe("error"); // used once

    cookieJar.clear();
    const login = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "new@firma.bg", password: "Nova-parola-9" })),
    );
    expect(login).toBe("/admin/2fa/setup");
  });

  it("refuses a weak password or one with the email, without using up the link", async () => {
    const { token } = await invite("nadia@firma.bg");
    expect((await accept(token, "short")).fieldErrors?.password).toBeTruthy();
    expect((await accept(token, "Nadia-parola-1")).fieldErrors?.password).toBeTruthy();
    expect((await accept(token, "Nova-parola-9", "Other-parola-9")).fieldErrors?.confirm).toBeTruthy();
    expect(await redirectedTo(() => accept(token, "Nova-parola-9"))).toBe(
      "/admin/login?notice=invite-accepted",
    );
  });

  it("refuses an expired link, and a reset link is not an invite link", async () => {
    const { token } = await invite();
    await getDb().update(tables.emailTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await accept(token, "Nova-parola-9")).status).toBe("error");
    expect((await accept("x".repeat(43), "Nova-parola-9")).status).toBe("error");
  });

  it("an editor can send a new invite; only the newest link works; a viewer cannot", async () => {
    const { token: first } = await invite();
    const created = (await adminsInDb()).find((a) => a.email === "new@firma.bg")!;

    await resendAdminInviteAction(fd({ adminId: created.id }));
    const second = tokenFromMail(sentMails.filter((m) => m.to === "new@firma.bg").at(-1)!);
    expect(second).not.toBe(first);
    expect((await accept(first, "Nova-parola-9")).status).toBe("error");
    expect((await auditRows()).some((r) => r.action === "admin.invite_resend")).toBe(true);

    await loginAs("viewer@firma.bg", PASSWORD, { role: "viewer" });
    const before = sentMails.length;
    await resendAdminInviteAction(fd({ adminId: created.id }));
    expect(sentMails).toHaveLength(before);
  });

  it("no new invite for an admin who already set a password", async () => {
    const { editor } = await invite();
    const before = sentMails.length;
    await resendAdminInviteAction(fd({ adminId: editor.admin.id }));
    expect(sentMails).toHaveLength(before);
  });

  it("an invite link stops working once the admin set a password through forgot-password", async () => {
    const { token } = await invite("nadia@firma.bg");
    await adminForgotPasswordAction(
      initialFormState,
      fd({ email: "nadia@firma.bg", "cf-turnstile-response": "ok" }),
    );
    const resetToken = tokenFromMail(sentMails.at(-1)!);
    await redirectedTo(() =>
      adminResetPasswordAction(
        initialFormState,
        fd({ token: resetToken, password: "Moya-parola-7", confirm: "Moya-parola-7" }),
      ),
    );

    expect((await accept(token, "Chuzhda-parola-7")).status).toBe("error");
    const row = (await adminsInDb()).find((a) => a.email === "nadia@firma.bg")!;
    expect(await verifyPassword(row.passwordHash, "Moya-parola-7")).toBe(true);
  });

  it("an invite cannot replace a chosen password or be used by a blocked admin (and the link is kept)", async () => {
    const { token } = await invite("nadia@firma.bg");
    await getDb().update(tables.admins).set({ status: "blocked" });

    expect((await accept(token, "Nova-parola-9")).status).toBe("error");
    // Not used up: it works once the admin is active again.
    await getDb().update(tables.admins).set({ status: "active" });
    expect(await redirectedTo(() => accept(token, "Nova-parola-9"))).toBe(
      "/admin/login?notice=invite-accepted",
    );
  });

  it("a reset link is not an invite link, and an invite link is not a reset link", async () => {
    const { token: inviteToken } = await invite("nadia@firma.bg");
    await adminForgotPasswordAction(
      initialFormState,
      fd({ email: "editor@firma.bg", "cf-turnstile-response": "ok" }),
    );
    const resetToken = tokenFromMail(sentMails.at(-1)!);

    expect((await accept(resetToken, "Nova-parola-9")).status).toBe("error");
    const asReset = await adminResetPasswordAction(
      initialFormState,
      fd({ token: inviteToken, password: "Nova-parola-9", confirm: "Nova-parola-9" }),
    );
    expect(asReset.status).toBe("error");
  });

  it("new invites for one admin are limited per hour", async () => {
    await invite();
    const created = (await adminsInDb()).find((a) => a.email === "new@firma.bg")!;
    const before = sentMails.length;
    for (let i = 0; i < 7; i++) await resendAdminInviteAction(fd({ adminId: created.id }));
    expect(sentMails.length - before).toBe(5);
  });

  it("tells the editor when the invite mail did not go out", async () => {
    const editor = await loginAs("editor@firma.bg", PASSWORD, { role: "editor" });
    mailControl.fail = true;
    const state = await createAdminAction(
      initialFormState,
      fd({ email: "new@firma.bg", role: "viewer", kind: "support", password: PASSWORD, code: await freshCode(editor.secret) }),
    );
    expect(state.message).toMatch(/НЕ беше изпратен/);
  });
});
