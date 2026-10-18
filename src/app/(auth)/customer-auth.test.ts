import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { getCurrentUser } from "@/lib/auth/current";
import { hashToken } from "@/lib/crypto";
import { initialFormState } from "@/lib/form-state";
import { cookieJar, redirectedTo, requestHeaders } from "@/test/next-mocks";
import { sentMails, tokenFromMail } from "@/test/mail-capture";
import { createUser, fd, PASSWORD } from "@/test/factories";
import { forgotPasswordAction } from "./forgot-password/actions";
import { loginAction, logoutAction } from "./login/actions";
import { registerAction } from "./register/actions";
import { resetPasswordAction } from "./reset-password/actions";
import { verifyEmailAction } from "./verify-email/actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const SESSION_COOKIE = "b2b_session";

function registration(overrides: Record<string, string> = {}) {
  return fd({
    companyName: "Тест ЕООД",
    eik: "123456789",
    email: "client@firma.bg",
    password: PASSWORD,
    "cf-turnstile-response": "ok",
    ...overrides,
  });
}

async function register(overrides: Record<string, string> = {}) {
  return registerAction(initialFormState, registration(overrides));
}

async function login(email: string, password: string) {
  let state;
  const to = await redirectedTo(async () => {
    state = await loginAction(initialFormState, fd({ email, password }));
  });
  return { to, state: state as unknown as Awaited<ReturnType<typeof loginAction>> | undefined };
}

describeDb("registration", () => {
  it("creates an unverified user and company, and sends one verification mail", async () => {
    const state = await register();

    expect(state.status).toBe("success");
    const users = await getDb().select().from(tables.users);
    const companies = await getDb().select().from(tables.companies);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: "client@firma.bg", status: "unverified" });
    expect(users[0].passwordHash).toMatch(/^\$argon2id\$/);
    expect(companies).toHaveLength(1);
    expect(companies[0]).toMatchObject({ eik: "123456789", name: "Тест ЕООД" });
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe("client@firma.bg");
  });

  it("stores only a hash of the verification token", async () => {
    await register();
    const token = tokenFromMail(sentMails[0]);

    const rows = await getDb().select().from(tables.emailTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toContain(token);
  });

  it("rejects a missing or wrong captcha and creates nothing", async () => {
    const state = await register({ "cf-turnstile-response": "bad" });

    expect(state.status).toBe("error");
    expect(await getDb().select().from(tables.users)).toHaveLength(0);
    expect(sentMails).toHaveLength(0);
  });

  it.each([
    ["short password", { password: "Aa1" }, "password"],
    ["password without digit", { password: "Abcdefghij" }, "password"],
    ["password without upper case", { password: "abcdefg1h" }, "password"],
    ["bad EIK", { eik: "12345" }, "eik"],
    ["bad email", { email: "nope" }, "email"],
    ["empty company name", { companyName: " " }, "companyName"],
  ])("validates on the server: %s", async (_name, overrides, fieldName) => {
    const state = await register(overrides);

    expect(state.status).toBe("error");
    expect(state.fieldErrors?.[fieldName]).toBeTruthy();
    expect(await getDb().select().from(tables.users)).toHaveLength(0);
  });

  it("never sends the password back to the form", async () => {
    const state = await register({ eik: "bad" });
    expect(JSON.stringify(state)).not.toContain(PASSWORD);
    expect(state.values).not.toHaveProperty("password");
  });

  it("gives the same answer for an email that is already registered", async () => {
    const fresh = await register();
    sentMails.length = 0;
    await getDb().update(tables.users).set({ status: "active" });
    const again = await register();

    expect({ status: again.status, message: again.message }).toEqual({
      status: fresh.status,
      message: fresh.message,
    });
    expect(await getDb().select().from(tables.users)).toHaveLength(1);
    // The real owner is told by mail, without any link to act on.
    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].text).not.toMatch(/token=/);
  });

  it("re-sends the verification link when registering again while unverified", async () => {
    await register();
    const first = tokenFromMail(sentMails[0]);
    await register();

    expect(sentMails).toHaveLength(2);
    expect(tokenFromMail(sentMails[1])).not.toBe(first);
    // Only the newest link works.
    expect(await getDb().select().from(tables.emailTokens)).toHaveLength(1);
  });

  it("adds a second profile to an existing company and keeps its name", async () => {
    await register();
    await register({ email: "second@firma.bg", companyName: "Друго име ООД" });

    expect(await getDb().select().from(tables.companies)).toHaveLength(1);
    expect(await getDb().select().from(tables.users)).toHaveLength(2);
    const [company] = await getDb().select().from(tables.companies);
    expect(company.name).toBe("Тест ЕООД");
  });

  it("limits registrations per email address", async () => {
    for (let i = 0; i < 3; i++) expect((await register()).status).toBe("success");
    const blocked = await register();

    expect(blocked.status).toBe("error");
    expect(blocked.message).toMatch(/Твърде много опити/);
  });

  it("limits registrations per IP address", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await register({ email: `u${i}@firma.bg` })).status).toBe("success");
    }
    const blocked = await register({ email: "u11@firma.bg" });

    expect(blocked.status).toBe("error");
    expect(await getDb().select().from(tables.users)).toHaveLength(10);
  });
});

describeDb("email verification", () => {
  async function registerAndGetToken() {
    await register();
    return tokenFromMail(sentMails[0]);
  }

  it("activates the account with the emailed token, once", async () => {
    const token = await registerAndGetToken();

    const to = await redirectedTo(() => verifyEmailAction(initialFormState, fd({ token })));
    expect(to).toBe("/login?notice=email-verified");
    const [user] = await getDb().select().from(tables.users);
    expect(user.status).toBe("active");
    expect(user.emailVerifiedAt).not.toBeNull();

    const reuse = await verifyEmailAction(initialFormState, fd({ token }));
    expect(reuse.status).toBe("error");
  });

  it("rejects an expired token", async () => {
    const token = await registerAndGetToken();
    await getDb()
      .update(tables.emailTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) });

    expect((await verifyEmailAction(initialFormState, fd({ token }))).status).toBe("error");
    const [user] = await getDb().select().from(tables.users);
    expect(user.status).toBe("unverified");
  });

  it("rejects random and empty tokens", async () => {
    await registerAndGetToken();
    expect((await verifyEmailAction(initialFormState, fd({ token: "x".repeat(43) }))).status).toBe("error");
    expect((await verifyEmailAction(initialFormState, fd({ token: "" }))).status).toBe("error");
  });

  it("does not activate a blocked account", async () => {
    const token = await registerAndGetToken();
    await getDb().update(tables.users).set({ status: "blocked" });

    await verifyEmailAction(initialFormState, fd({ token })).catch(() => {});
    const [user] = await getDb().select().from(tables.users);
    expect(user.status).toBe("blocked");
  });

  it("does not accept a password-reset token as an email token", async () => {
    await createUser();
    await forgotPasswordAction(
      initialFormState,
      fd({ email: "client@firma.bg", "cf-turnstile-response": "ok" }),
    );
    const resetToken = tokenFromMail(sentMails[0]);

    expect((await verifyEmailAction(initialFormState, fd({ token: resetToken }))).status).toBe("error");
  });
});

describeDb("customer login", () => {
  it("logs in an active customer and sets a hardened session cookie", async () => {
    await createUser();

    const { to } = await login("client@firma.bg", PASSWORD);

    expect(to).toBe("/");
    const cookie = cookieJar.get(SESSION_COOKIE);
    expect(cookie).toBeDefined();
    expect(cookie!.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(Number(cookie!.options?.maxAge)).toBe(7 * 24 * 60 * 60);
    expect((await getCurrentUser())?.email).toBe("client@firma.bg");
  });

  it("stores only a hash of the session id", async () => {
    await createUser();
    await login("client@firma.bg", PASSWORD);

    const [row] = await getDb().select().from(tables.sessions);
    const value = cookieJar.get(SESSION_COOKIE)!.value;
    expect(row.tokenHash).toBe(hashToken(value));
    expect(row.tokenHash).not.toBe(value);
  });

  it("normalizes the email (case, spaces)", async () => {
    await createUser();
    expect((await login("  CLIENT@Firma.BG ", PASSWORD)).to).toBe("/");
  });

  it("gives the same message for a wrong password and for an unknown email", async () => {
    await createUser();

    const wrong = (await login("client@firma.bg", "Wrong-pass1")).state;
    const unknown = (await login("nobody@firma.bg", "Wrong-pass1")).state;

    expect(wrong?.message).toBe(unknown?.message);
    expect(wrong?.status).toBe("error");
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });

  it("does not log in an unverified customer, even with the right password", async () => {
    await createUser({ status: "unverified" });

    const { to, state } = await login("client@firma.bg", PASSWORD);

    expect(to).toBeNull();
    expect(state?.message).toMatch(/не е потвърден/);
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });

  it("does not log in a blocked customer", async () => {
    await createUser({ status: "blocked" });

    const { to, state } = await login("client@firma.bg", PASSWORD);

    expect(to).toBeNull();
    expect(state?.message).toMatch(/блокиран/);
  });

  it("stops accepting a session once the account is blocked", async () => {
    const user = await createUser();
    await login("client@firma.bg", PASSWORD);
    expect(await getCurrentUser()).not.toBeNull();

    await getDb().update(tables.users).set({ status: "blocked" }).where(eq(tables.users.id, user.id));

    expect(await getCurrentUser()).toBeNull();
  });

  it("locks the account after 5 wrong passwords, even for the right one", async () => {
    await createUser();
    for (let i = 0; i < 5; i++) await login("client@firma.bg", "Wrong-pass1");

    const { to, state } = await login("client@firma.bg", PASSWORD);

    expect(to).toBeNull();
    expect(state?.message).toMatch(/Твърде много опити/);
  });

  it("locks an unknown email the same way (no way to tell it does not exist)", async () => {
    for (let i = 0; i < 5; i++) await login("ghost@firma.bg", "Wrong-pass1");

    const { state } = await login("ghost@firma.bg", "Wrong-pass1");

    expect(state?.message).toMatch(/Твърде много опити/);
  });

  it("does not let failures on one account lock another one", async () => {
    await createUser({ email: "a@firma.bg" });
    await createUser({ email: "b@firma.bg", eik: "123456789" });
    for (let i = 0; i < 5; i++) await login("a@firma.bg", "Wrong-pass1");

    expect((await login("b@firma.bg", PASSWORD)).to).toBe("/");
  });

  it("limits failed logins per IP across different accounts", async () => {
    for (let i = 0; i < 20; i++) await login(`ghost${i}@firma.bg`, "Wrong-pass1");
    await createUser();

    const { to, state } = await login("client@firma.bg", PASSWORD);

    expect(to).toBeNull();
    expect(state?.message).toMatch(/Твърде много опити/);
  });

  it("does not trust the leftmost, client-supplied X-Forwarded-For entry", async () => {
    await createUser();
    for (let i = 0; i < 20; i++) {
      // Attacker rotates a fake client IP; the proxy-added entry stays the same.
      requestHeaders.set("x-forwarded-for", `10.0.0.${i}, 203.0.113.10`);
      await login(`ghost${i}@firma.bg`, "Wrong-pass1");
    }
    requestHeaders.set("x-forwarded-for", "10.0.0.99, 203.0.113.10");

    expect((await login("client@firma.bg", PASSWORD)).to).toBeNull();
  });

  it("issues a new session id at login and drops the one the browser presented", async () => {
    await createUser();
    await login("client@firma.bg", PASSWORD);
    const first = cookieJar.get(SESSION_COOKIE)!.value;

    await login("client@firma.bg", PASSWORD);
    const second = cookieJar.get(SESSION_COOKIE)!.value;

    expect(second).not.toBe(first);
    const hashes = (await getDb().select().from(tables.sessions)).map((s) => s.tokenHash);
    expect(hashes).toEqual([hashToken(second)]);
  });

  it("rejects an expired session", async () => {
    await createUser();
    await login("client@firma.bg", PASSWORD);
    await getDb().update(tables.sessions).set({ expiresAt: new Date(Date.now() - 1000) });

    expect(await getCurrentUser()).toBeNull();
  });

  it("rejects a made-up session cookie", async () => {
    await createUser();
    cookieJar.set(SESSION_COOKIE, { value: "x".repeat(43) });

    expect(await getCurrentUser()).toBeNull();
  });

  it("logout deletes the session on the server", async () => {
    await createUser();
    await login("client@firma.bg", PASSWORD);
    const stolen = cookieJar.get(SESSION_COOKIE)!;

    await redirectedTo(() => logoutAction());

    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
    expect(await getDb().select().from(tables.sessions)).toHaveLength(0);
    // Replaying the old cookie value gets nothing.
    cookieJar.set(SESSION_COOKIE, stolen);
    expect(await getCurrentUser()).toBeNull();
  });
});

describeDb("customer password reset", () => {
  const ask = (email: string, captcha = "ok") =>
    forgotPasswordAction(initialFormState, fd({ email, "cf-turnstile-response": captcha }));

  it("answers the same for existing and unknown emails, and mails only the real one", async () => {
    await createUser();

    const real = await ask("client@firma.bg");
    expect(sentMails).toHaveLength(1);
    sentMails.length = 0;
    const unknown = await ask("nobody@firma.bg");

    expect({ status: unknown.status, message: unknown.message }).toEqual({
      status: real.status,
      message: real.message,
    });
    expect(sentMails).toHaveLength(0);
  });

  it("requires the captcha", async () => {
    await createUser();
    const state = await ask("client@firma.bg", "bad");

    expect(state.status).toBe("error");
    expect(sentMails).toHaveLength(0);
  });

  it("sends nothing to unverified or blocked accounts", async () => {
    await createUser({ email: "u@firma.bg", status: "unverified" });
    await createUser({ email: "b@firma.bg", status: "blocked" });
    await ask("u@firma.bg");
    await ask("b@firma.bg");

    expect(sentMails).toHaveLength(0);
  });

  it("uses a link that expires within the hour", async () => {
    await createUser();
    await ask("client@firma.bg");

    const [row] = await getDb().select().from(tables.emailTokens);
    const ms = row.expiresAt.getTime() - Date.now();
    expect(ms).toBeGreaterThan(50 * 60 * 1000);
    expect(ms).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it("silently stops sending after 3 requests per email, with the same answer", async () => {
    await createUser();
    const answers = [];
    for (let i = 0; i < 5; i++) answers.push(await ask("client@firma.bg"));

    expect(sentMails).toHaveLength(3);
    expect(new Set(answers.map((a) => a.message)).size).toBe(1);
  });

  async function requestToken() {
    await ask("client@firma.bg");
    return tokenFromMail(sentMails[sentMails.length - 1]);
  }

  it("sets the new password, ends all sessions and works only once", async () => {
    await createUser();
    await login("client@firma.bg", PASSWORD);
    const token = await requestToken();

    const to = await redirectedTo(() =>
      resetPasswordAction(
        initialFormState,
        fd({ token, password: "Nova-parola9", confirm: "Nova-parola9" }),
      ),
    );

    expect(to).toBe("/login?notice=password-reset");
    expect(await getDb().select().from(tables.sessions)).toHaveLength(0);
    expect((await login("client@firma.bg", PASSWORD)).to).toBeNull();
    expect((await login("client@firma.bg", "Nova-parola9")).to).toBe("/");

    const reuse = await resetPasswordAction(
      initialFormState,
      fd({ token, password: "Drugo-parola9", confirm: "Drugo-parola9" }),
    );
    expect(reuse.status).toBe("error");
  });

  it("does not use up the link when the new password is weak", async () => {
    await createUser();
    const token = await requestToken();

    const weak = await resetPasswordAction(
      initialFormState,
      fd({ token, password: "short", confirm: "short" }),
    );
    expect(weak.status).toBe("error");

    const to = await redirectedTo(() =>
      resetPasswordAction(
        initialFormState,
        fd({ token, password: "Nova-parola9", confirm: "Nova-parola9" }),
      ),
    );
    expect(to).toBe("/login?notice=password-reset");
  });

  it("rejects mismatching confirmation, expired and invented tokens", async () => {
    await createUser();
    const token = await requestToken();

    const mismatch = await resetPasswordAction(
      initialFormState,
      fd({ token, password: "Nova-parola9", confirm: "Nova-parola8" }),
    );
    expect(mismatch.fieldErrors?.confirm).toBeTruthy();

    const invented = await resetPasswordAction(
      initialFormState,
      fd({ token: "y".repeat(43), password: "Nova-parola9", confirm: "Nova-parola9" }),
    );
    expect(invented.status).toBe("error");

    await getDb().update(tables.emailTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    const expired = await resetPasswordAction(
      initialFormState,
      fd({ token, password: "Nova-parola9", confirm: "Nova-parola9" }),
    );
    expect(expired.status).toBe("error");
  });

  it("a new request replaces the earlier link", async () => {
    await createUser();
    const first = await requestToken();
    const second = await requestToken();

    const old = await resetPasswordAction(
      initialFormState,
      fd({ token: first, password: "Nova-parola9", confirm: "Nova-parola9" }),
    );
    expect(old.status).toBe("error");
    expect(
      await redirectedTo(() =>
        resetPasswordAction(
          initialFormState,
          fd({ token: second, password: "Nova-parola9", confirm: "Nova-parola9" }),
        ),
      ),
    ).toBe("/login?notice=password-reset");
  });
});
