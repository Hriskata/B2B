import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { forgotPasswordAction } from "@/app/(bg)/(auth)/forgot-password/actions";
import { loginAction } from "@/app/(bg)/(auth)/login/actions";
import { registerAction } from "@/app/(bg)/(auth)/register/actions";
import { verifyEmailAction } from "@/app/(bg)/(auth)/verify-email/actions";
import { getCurrentAdmin, getCurrentUser } from "@/lib/auth/current";
import { initialFormState } from "@/lib/form-state";
import { codeFor, createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { sentMails, tokenFromMail } from "@/test/mail-capture";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminLoginAction, adminVerifyAction } from "./actions";
import { reviewRegistrationAction, setUserBlockedAction } from "./manage-actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

async function loginAdminAs(email: string, role: "viewer" | "editor") {
  const made = await createAdmin({ email, role });
  cookieJar.clear();
  await redirectedTo(() => adminLoginAction(initialFormState, fd({ email, password: PASSWORD })));
  await redirectedTo(async () =>
    adminVerifyAction(initialFormState, fd({ code: await codeFor(made.secret) })),
  );
  expect(await getCurrentAdmin("full")).not.toBeNull();
}

const pendingUser = () =>
  createUser({ status: "pending_review", country: "DE", companyNumber: "DE123456789" });

const userRow = async () => (await getDb().select().from(tables.users))[0];
const auditRows = () => getDb().select().from(tables.auditLog);
const review = (userId: string, decision: string) =>
  reviewRegistrationAction(fd({ userId, decision }));

async function customerLogin() {
  cookieJar.clear();
  let message = "";
  const to = await redirectedTo(async () => {
    message =
      (await loginAction(initialFormState, fd({ email: "client@firma.bg", password: PASSWORD })))
        .message ?? "";
  });
  return { to, message };
}

describeDb("registration waiting for review", () => {
  it("tells every active admin by email once the customer confirms the email", async () => {
    await createAdmin({ email: "a1@firma.bg" });
    await createAdmin({ email: "a2@firma.bg" });
    await createAdmin({ email: "blocked@firma.bg", status: "blocked" });
    await registerAction(
      initialFormState,
      fd({
        fullName: "Hans Muster",
        email: "client@firma.de",
        password: PASSWORD,
        passwordConfirm: PASSWORD,
        country: "DE",
        companyName: "Muster GmbH",
        companyNumber: "123456789",
        "cf-turnstile-response": "ok",
      }),
    );
    const token = tokenFromMail(sentMails[0]);
    sentMails.length = 0;

    await redirectedTo(() => verifyEmailAction(initialFormState, fd({ token })));

    expect(sentMails.map((m) => m.to).sort()).toEqual(["a1@firma.bg", "a2@firma.bg"]);
    expect(sentMails[0].subject).toBe("Нова регистрация чака преглед");
    expect(sentMails[0].text).toContain("Германия");
    // Text typed by the customer stays out of mail from our own sender.
    expect(sentMails[0].text).not.toContain("Muster GmbH");
    expect(sentMails[0].text).not.toContain("client@firma.de");
    expect(sentMails[0].text).toContain("/admin/registrations");
  });

  it("a Bulgarian registration does not go to review and nobody is told", async () => {
    await createAdmin();
    await registerAction(
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
      }),
    );
    const token = tokenFromMail(sentMails[0]);
    sentMails.length = 0;

    await redirectedTo(() => verifyEmailAction(initialFormState, fd({ token })));

    expect((await userRow()).status).toBe("active");
    expect(sentMails).toHaveLength(0);
  });

  it("can reset the password while waiting, and stays waiting", async () => {
    await pendingUser();
    await forgotPasswordAction(
      initialFormState,
      fd({ email: "client@firma.bg", "cf-turnstile-response": "ok" }),
    );

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].text).toMatch(/reset-password\?token=/);
    expect((await userRow()).status).toBe("pending_review");
  });
});

describeDb("manual review: who may decide", () => {
  it("a viewer cannot approve or reject (nothing changes, nobody is told)", async () => {
    const user = await pendingUser();
    await loginAdminAs("viewer@firma.bg", "viewer");
    sentMails.length = 0;

    await review(user.id, "approve");
    await review(user.id, "reject");

    expect((await userRow()).status).toBe("pending_review");
    expect(sentMails).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it("a customer session cannot use the action", async () => {
    const user = await pendingUser();
    await createUser({ email: "other@firma.bg", companyNumber: "987654321" });
    cookieJar.clear();
    await redirectedTo(() =>
      loginAction(initialFormState, fd({ email: "other@firma.bg", password: PASSWORD })),
    );

    await redirectedTo(() => review(user.id, "approve"));

    expect((await userRow()).status).toBe("pending_review");
  });
});

describeDb("manual review: decisions", () => {
  it("approving gives access, tells the customer and writes the journal", async () => {
    const user = await pendingUser();
    await loginAdminAs("editor@firma.bg", "editor");
    sentMails.length = 0;

    await review(user.id, "approve");

    const row = await userRow();
    expect(row.status).toBe("active");
    expect(row.approvedAt).not.toBeNull();
    expect(sentMails.map((m) => [m.to, m.subject])).toEqual([
      ["client@firma.bg", "Регистрацията ви е одобрена"],
    ]);
    const [entry] = await auditRows();
    expect(entry).toMatchObject({ action: "registration.approve", targetId: user.id });
    expect(entry.details).toMatchObject({ email: "client@firma.bg", companyNumber: "DE123456789" });

    const { to } = await customerLogin();
    expect(to).toBe("/");
    expect((await getCurrentUser())?.email).toBe("client@firma.bg");
  });

  it("rejecting keeps the customer out, tells them and writes the journal", async () => {
    const user = await pendingUser();
    await loginAdminAs("editor@firma.bg", "editor");
    sentMails.length = 0;

    await review(user.id, "reject");

    const row = await userRow();
    expect(row.status).toBe("rejected");
    expect(row.rejectedAt).not.toBeNull();
    expect(sentMails.map((m) => [m.to, m.subject])).toEqual([
      ["client@firma.bg", "Регистрацията ви не е одобрена"],
    ]);
    expect((await auditRows())[0].action).toBe("registration.reject");

    const { to, message } = await customerLogin();
    expect(to).toBeNull();
    expect(message).toMatch(/не е одобрена/);
    expect(cookieJar.has("b2b_session")).toBe(false);
  });

  it("decides only once, and only for a registration that waits", async () => {
    const user = await pendingUser();
    const active = await createUser({ email: "active@firma.bg", companyNumber: "987654321" });
    await loginAdminAs("editor@firma.bg", "editor");
    await review(user.id, "approve");
    sentMails.length = 0;

    await review(user.id, "reject"); // already decided
    await review(active.id, "reject"); // never waited
    await review("not-a-uuid", "approve");
    await review(user.id, "maybe");

    expect((await userRow()).status).toBe("active");
    const activeRow = (
      await getDb().select().from(tables.users).where(eq(tables.users.id, active.id))
    )[0];
    expect(activeRow.status).toBe("active");
    expect(sentMails).toHaveLength(0);
    expect(await auditRows()).toHaveLength(1);
  });

  it("unblocking returns to the reviewed state, not back to waiting", async () => {
    const user = await pendingUser();
    await loginAdminAs("editor@firma.bg", "editor");
    await review(user.id, "approve");
    await setUserBlockedAction(fd({ userId: user.id, blocked: "true" }));
    await setUserBlockedAction(fd({ userId: user.id, blocked: "false" }));
    expect((await userRow()).status).toBe("active");

    await getDb().update(tables.users).set({ status: "rejected", approvedAt: null, rejectedAt: new Date() });
    await setUserBlockedAction(fd({ userId: user.id, blocked: "true" }));
    await setUserBlockedAction(fd({ userId: user.id, blocked: "false" }));
    expect((await userRow()).status).toBe("rejected");
  });

  it("a rejected customer who registers again gets the same answer and no mail", async () => {
    await createUser({ status: "rejected", country: "DE", companyNumber: "DE123456789" });
    const state = await registerAction(
      initialFormState,
      fd({
        fullName: "Hans Muster",
        email: "client@firma.bg",
        password: PASSWORD,
        passwordConfirm: PASSWORD,
        country: "DE",
        companyName: "Muster GmbH",
        companyNumber: "123456789",
        "cf-turnstile-response": "ok",
      }),
    );
    expect(state.status).toBe("success");
    expect(sentMails).toHaveLength(0);
  });
});
