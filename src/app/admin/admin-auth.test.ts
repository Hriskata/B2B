import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { getCurrentAdmin, getCurrentUser, requireAdmin } from "@/lib/auth/current";
import { decryptSecret } from "@/lib/crypto";
import { initialFormState } from "@/lib/form-state";
import { loginAction } from "@/app/(auth)/login/actions";
import { codeFor, createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { sentMails, tokenFromMail } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import {
  adminForgotPasswordAction,
  adminLoginAction,
  adminLogoutAction,
  adminResetPasswordAction,
  adminSetupAction,
  adminVerifyAction,
} from "./actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const ADMIN_COOKIE = "b2b_admin_session";

async function passwordStep(email = "admin@firma.bg", password = PASSWORD) {
  let state;
  const to = await redirectedTo(async () => {
    state = await adminLoginAction(initialFormState, fd({ email, password }));
  });
  return { to, state: state as Awaited<ReturnType<typeof adminLoginAction>> | undefined };
}

async function secondStep(code: string) {
  let state;
  const to = await redirectedTo(async () => {
    state = await adminVerifyAction(initialFormState, fd({ code }));
  });
  return { to, state: state as Awaited<ReturnType<typeof adminVerifyAction>> | undefined };
}

describeDb("admin login: 2FA is mandatory", () => {
  it("the password alone does not give access to the admin area", async () => {
    await createAdmin();

    const { to } = await passwordStep();

    expect(to).toBe("/admin/2fa");
    expect(await getCurrentAdmin("full")).toBeNull();
    expect(await redirectedTo(() => requireAdmin())).toBe("/admin/login");
  });

  it("the password step cookie is strict, short-lived and HttpOnly", async () => {
    await createAdmin();
    await passwordStep();

    const options = cookieJar.get(ADMIN_COOKIE)!.options;
    expect(options).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" });
    expect(Number(options?.maxAge)).toBe(10 * 60);
  });

  it("a valid authenticator code completes the login with an 8 hour session", async () => {
    const { secret } = await createAdmin();
    await passwordStep();
    const beforeId = cookieJar.get(ADMIN_COOKIE)!.value;

    const { to } = await secondStep(await codeFor(secret));

    expect(to).toBe("/admin");
    expect((await getCurrentAdmin("full"))?.email).toBe("admin@firma.bg");
    expect(Number(cookieJar.get(ADMIN_COOKIE)!.options?.maxAge)).toBe(8 * 60 * 60);
    // New session id after the second factor; the old one is gone.
    expect(cookieJar.get(ADMIN_COOKIE)!.value).not.toBe(beforeId);
    expect(await getDb().select().from(tables.sessions)).toHaveLength(1);
  });

  it("a wrong code does not give access", async () => {
    await createAdmin();
    await passwordStep();

    const { to, state } = await secondStep("000000");

    expect(to).toBeNull();
    expect(state?.status).toBe("error");
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("an already used code cannot be replayed in a new login", async () => {
    const { secret } = await createAdmin();
    const code = await codeFor(secret);
    await passwordStep();
    expect((await secondStep(code)).to).toBe("/admin");

    cookieJar.clear();
    await passwordStep();
    const replay = await secondStep(code);

    expect(replay.to).toBeNull();
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("locks the second factor after 5 wrong codes, even for the right one", async () => {
    const { secret } = await createAdmin();
    await passwordStep();
    for (let i = 0; i < 5; i++) await secondStep("000000");

    const { to, state } = await secondStep(await codeFor(secret));

    expect(to).toBeNull();
    expect(state?.message).toMatch(/Твърде много опити/);
  });

  it("a recovery code works once, in any letter case", async () => {
    const { recoveryCodes } = await createAdmin();
    await passwordStep();

    expect((await secondStep(recoveryCodes[0].toUpperCase())).to).toBe("/admin");

    cookieJar.clear();
    await passwordStep();
    expect((await secondStep(recoveryCodes[0])).to).toBeNull();
    // Another unused code still works.
    expect((await secondStep(recoveryCodes[1])).to).toBe("/admin");
  });

  it("stores recovery codes and the TOTP secret only in protected form", async () => {
    const { secret, recoveryCodes } = await createAdmin();
    const [admin] = await getDb().select().from(tables.admins);
    const codes = await getDb().select().from(tables.adminRecoveryCodes);

    expect(admin.totpSecretEnc).not.toContain(secret);
    expect(decryptSecret(admin.totpSecretEnc!)).toBe(secret);
    for (const c of recoveryCodes) {
      expect(codes.some((row) => row.codeHash === c || row.codeHash.includes(c))).toBe(false);
    }
  });

  it("gives the same message for a wrong password and an unknown admin", async () => {
    await createAdmin();

    const wrong = (await passwordStep("admin@firma.bg", "Wrong-pass1")).state;
    const unknown = (await passwordStep("ghost@firma.bg", "Wrong-pass1")).state;

    expect(wrong?.message).toBe(unknown?.message);
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(false);
  });

  it("treats a blocked admin like a wrong password", async () => {
    await createAdmin({ status: "blocked" });

    const { to, state } = await passwordStep();

    expect(to).toBeNull();
    expect(state?.message).toBe("Невалиден имейл или парола.");
  });

  it("locks the password step after 5 failures", async () => {
    await createAdmin();
    for (let i = 0; i < 5; i++) await passwordStep("admin@firma.bg", "Wrong-pass1");

    const { to, state } = await passwordStep();

    expect(to).toBeNull();
    expect(state?.message).toMatch(/Твърде много опити/);
  });

  it("ends the session when the admin is blocked afterwards", async () => {
    const { admin, secret } = await createAdmin();
    await passwordStep();
    await secondStep(await codeFor(secret));
    expect(await getCurrentAdmin("full")).not.toBeNull();

    await getDb().update(tables.admins).set({ status: "blocked" }).where(eq(tables.admins.id, admin.id));

    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("logout removes the session on the server", async () => {
    const { secret } = await createAdmin();
    await passwordStep();
    await secondStep(await codeFor(secret));

    await redirectedTo(() => adminLogoutAction());

    expect(await getDb().select().from(tables.sessions)).toHaveLength(0);
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(false);
  });
});

describeDb("admin 2FA setup at first login", () => {
  it("sends an admin without 2FA to the setup page, still without access", async () => {
    await createAdmin({ withTotp: false });

    const { to } = await passwordStep();

    expect(to).toBe("/admin/2fa/setup");
    expect(await getCurrentAdmin("full")).toBeNull();
    expect((await getCurrentAdmin("mfa_setup"))?.email).toBe("admin@firma.bg");
  });

  it("enables 2FA with a correct code and shows 10 recovery codes once", async () => {
    await createAdmin({ withTotp: false });
    await passwordStep();
    const { beginTotpSetup } = await import("@/lib/auth/totp");
    const admin = (await getCurrentAdmin("mfa_setup"))!;
    const setup = (await beginTotpSetup(admin.id))!;

    expect(setup.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const state = await adminSetupAction(initialFormState, fd({ code: await codeFor(setup.secret) }));

    expect(state.status).toBe("success");
    expect(state.recoveryCodes).toHaveLength(10);
    expect((await getCurrentAdmin("full"))?.totpEnabled).toBe(true);
    const stored = await getDb().select().from(tables.adminRecoveryCodes);
    expect(stored).toHaveLength(10);
    for (const code of state.recoveryCodes!) {
      expect(stored.some((row) => row.codeHash.includes(code))).toBe(false);
    }
  });

  it("keeps the same secret on page reload until it is confirmed", async () => {
    await createAdmin({ withTotp: false });
    await passwordStep();
    const { beginTotpSetup } = await import("@/lib/auth/totp");
    const admin = (await getCurrentAdmin("mfa_setup"))!;

    const a = await beginTotpSetup(admin.id);
    const b = await beginTotpSetup(admin.id);

    expect(a?.secret).toBe(b?.secret);
  });

  it("does not enable 2FA with a wrong code", async () => {
    await createAdmin({ withTotp: false });
    await passwordStep();
    const { beginTotpSetup } = await import("@/lib/auth/totp");
    await beginTotpSetup((await getCurrentAdmin("mfa_setup"))!.id);

    const state = await adminSetupAction(initialFormState, fd({ code: "123456" }));

    expect(state.status).toBe("error");
    expect(await getCurrentAdmin("full")).toBeNull();
    const [row] = await getDb().select().from(tables.admins);
    expect(row.totpEnabledAt).toBeNull();
  });

  it("limits wrong codes during setup too", async () => {
    await createAdmin({ withTotp: false });
    await passwordStep();
    const { beginTotpSetup } = await import("@/lib/auth/totp");
    const setup = (await beginTotpSetup((await getCurrentAdmin("mfa_setup"))!.id))!;
    for (let i = 0; i < 5; i++) await adminSetupAction(initialFormState, fd({ code: "000000" }));

    const state = await adminSetupAction(initialFormState, fd({ code: await codeFor(setup.secret) }));

    expect(state.message).toMatch(/Твърде много опити/);
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("a session from the 2FA step cannot run the setup action (no way to replace 2FA)", async () => {
    const { secret } = await createAdmin();
    await passwordStep(); // stage mfa_verify, 2FA already enabled

    const to = await redirectedTo(() =>
      adminSetupAction(initialFormState, fd({ code: "123456" })),
    );

    expect(to).toBe("/admin/login");
    // The existing secret was not touched.
    const [row] = await getDb().select().from(tables.admins);
    expect(decryptSecret(row.totpSecretEnc!)).toBe(secret);
  });
});

describeDb("admin and customer areas are separate", () => {
  it("a customer session gives no admin access", async () => {
    await createUser();
    await redirectedTo(() =>
      loginAction(initialFormState, fd({ email: "client@firma.bg", password: PASSWORD })),
    );
    expect(await getCurrentUser()).not.toBeNull();

    expect(await getCurrentAdmin("full")).toBeNull();
    expect(await redirectedTo(() => requireAdmin())).toBe("/admin/login");
  });

  it("an admin session gives no customer access", async () => {
    const { secret } = await createAdmin();
    await passwordStep();
    await secondStep(await codeFor(secret));

    expect(await getCurrentAdmin("full")).not.toBeNull();
    expect(await getCurrentUser()).toBeNull();
  });

  it("an admin account cannot log in through the customer form", async () => {
    await createAdmin();
    let state;
    const to = await redirectedTo(async () => {
      state = await loginAction(
        initialFormState,
        fd({ email: "admin@firma.bg", password: PASSWORD }),
      );
    });

    expect(to).toBeNull();
    expect((state as unknown as { status: string }).status).toBe("error");
    expect(cookieJar.has("b2b_session")).toBe(false);
  });

  it("a customer cannot log in through the admin form", async () => {
    await createUser();

    const { to } = await passwordStep("client@firma.bg");

    expect(to).toBeNull();
    expect(cookieJar.has(ADMIN_COOKIE)).toBe(false);
  });

  it("a customer cookie value placed in the admin cookie is useless", async () => {
    await createUser();
    await redirectedTo(() =>
      loginAction(initialFormState, fd({ email: "client@firma.bg", password: PASSWORD })),
    );
    cookieJar.set(ADMIN_COOKIE, { value: cookieJar.get("b2b_session")!.value });

    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("carries the role from the database, so permissions can be checked later", async () => {
    const { secret } = await createAdmin({ role: "viewer" });
    await passwordStep();
    await secondStep(await codeFor(secret));

    expect((await getCurrentAdmin("full"))?.role).toBe("viewer");
  });
});

describeDb("admin password reset", () => {
  const ask = (email: string) =>
    adminForgotPasswordAction(initialFormState, fd({ email, "cf-turnstile-response": "ok" }));

  it("mails a link only to an existing active admin, with the same answer for others", async () => {
    await createAdmin();
    await createUser({ email: "client@firma.bg" });

    const real = await ask("admin@firma.bg");
    const mailsAfterReal = sentMails.length;
    const unknown = await ask("ghost@firma.bg");
    const customer = await ask("client@firma.bg");

    expect(mailsAfterReal).toBe(1);
    expect(sentMails).toHaveLength(1);
    expect(unknown.message).toBe(real.message);
    expect(customer.message).toBe(real.message);
    expect(sentMails[0].text).toContain("/admin/reset-password?token=");
  });

  it("sets the password and ends all sessions, but login still needs the second factor", async () => {
    const { secret } = await createAdmin();
    await passwordStep();
    await secondStep(await codeFor(secret));
    await ask("admin@firma.bg");
    const token = tokenFromMail(sentMails[0]);

    const to = await redirectedTo(() =>
      adminResetPasswordAction(
        initialFormState,
        fd({ token, password: "Nova-parola9", confirm: "Nova-parola9" }),
      ),
    );

    expect(to).toBe("/admin/login?notice=password-reset");
    expect(await getDb().select().from(tables.sessions)).toHaveLength(0);
    expect(await getCurrentAdmin("full")).toBeNull();

    // The new password gets only to the 2FA step, never straight in.
    const step = await passwordStep("admin@firma.bg", "Nova-parola9");
    expect(step.to).toBe("/admin/2fa");
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("a customer reset token does not work on the admin reset", async () => {
    await createUser();
    await createAdmin();
    const { forgotPasswordAction } = await import("@/app/(auth)/forgot-password/actions");
    await forgotPasswordAction(
      initialFormState,
      fd({ email: "client@firma.bg", "cf-turnstile-response": "ok" }),
    );
    const customerToken = tokenFromMail(sentMails[0]);

    const state = await adminResetPasswordAction(
      initialFormState,
      fd({ token: customerToken, password: "Nova-parola9", confirm: "Nova-parola9" }),
    );

    expect(state.status).toBe("error");
    const [admin] = await getDb().select().from(tables.admins);
    const { verifyPassword } = await import("@/lib/password");
    expect(await verifyPassword(admin.passwordHash, PASSWORD)).toBe(true);
  });

  it("does not change 2FA", async () => {
    const { secret } = await createAdmin();
    await ask("admin@firma.bg");
    await adminResetPasswordAction(
      initialFormState,
      fd({
        token: tokenFromMail(sentMails[0]),
        password: "Nova-parola9",
        confirm: "Nova-parola9",
      }),
    ).catch(() => {});

    const [row] = await getDb().select().from(tables.admins);
    expect(decryptSecret(row.totpSecretEnc!)).toBe(secret);
    expect(row.totpEnabledAt).not.toBeNull();
  });
});
