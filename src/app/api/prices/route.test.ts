import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { getDb, tables } from "@/db";
import { loginCustomer } from "@/lib/auth/customer";
import { hashToken, randomToken } from "@/lib/crypto";
import { createProduct } from "@/test/catalog-factories";
import { codeFor, createAdmin, createUser, fd, PASSWORD } from "@/test/factories";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminLoginAction, adminVerifyAction } from "@/app/(bg)/admin/actions";
import { getCurrentAdmin } from "@/lib/auth/current";
import { initialFormState } from "@/lib/form-state";
import { GET } from "./route";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

function request(query: string) {
  return GET(new NextRequest(`http://localhost:3200/api/prices${query}`));
}

async function seed() {
  await createProduct({ slug: "a", amountCents: 1250 });
  await createProduct({ slug: "b", amountCents: 4999 });
}

describeDb("GET /api/prices", () => {
  it("gives a guest a 401 and no price", async () => {
    await seed();

    const res = await request("?slug=a&slug=b");
    const body = await res.text();

    expect(res.status).toBe(401);
    expect(body).toBe('{"error":"unauthorized"}');
    expect(body).not.toMatch(/\d/);
  });

  it("is private and never cached, for guests and for customers", async () => {
    await seed();
    const guest = await request("?slug=a");
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");
    const customer = await request("?slug=a");

    for (const res of [guest, customer]) {
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("Vary")).toMatch(/Cookie/i);
    }
  });

  it("gives an active customer the prices", async () => {
    await seed();
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");

    const res = await request("?slug=a&slug=b");
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.prices.a.formatted).toMatch(/12,50/);
    expect(data.prices.b.amountCents).toBe(4999);
  });

  it("gives nothing to an unverified customer, even with a forged session row", async () => {
    await seed();
    const user = await createUser({ status: "unverified" });
    const token = randomToken();
    await getDb()
      .insert(tables.sessions)
      .values({
        tokenHash: hashToken(token),
        subjectType: "user",
        subjectId: user.id,
        expiresAt: new Date(Date.now() + 60_000),
      });
    cookieJar.set("b2b_session", { value: token });

    expect((await request("?slug=a")).status).toBe(401);
  });

  it("gives nothing to a blocked customer who still has a session", async () => {
    await seed();
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");
    expect((await request("?slug=a")).status).toBe(200);

    await getDb().update(tables.users).set({ status: "blocked" });

    expect((await request("?slug=a")).status).toBe(401);
  });

  it("is for customers only: an admin session does not get prices", async () => {
    await seed();
    const { secret } = await createAdmin();
    await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "admin@firma.bg", password: PASSWORD })),
    );
    const code = await codeFor(secret);
    await redirectedTo(() => adminVerifyAction(initialFormState, fd({ code })));
    expect(await getCurrentAdmin("full")).not.toBeNull();

    expect((await request("?slug=a")).status).toBe(401);
  });

  it("does not reveal whether a hidden or unknown product exists", async () => {
    await createProduct({ slug: "hidden", published: false, amountCents: 100 });
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");

    const hidden = await (await request("?slug=hidden")).json();
    const unknown = await (await request("?slug=unknown")).json();

    expect(hidden).toEqual({ prices: {} });
    expect(unknown).toEqual({ prices: {} });
  });

  it.each([
    ["no slug", ""],
    ["a malformed slug", "?slug=../etc/passwd"],
    ["an upper case slug", "?slug=ABC"],
    ["an empty slug", "?slug="],
  ])("rejects %s with 400 for a customer", async (_name, query) => {
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");

    expect((await request(query)).status).toBe(400);
  });

  it("rejects more than 50 slugs", async () => {
    await createUser();
    await loginCustomer("client@firma.bg", PASSWORD, "203.0.113.10");
    const many = Array.from({ length: 51 }, (_, i) => `slug=p-${i}`).join("&");

    expect((await request(`?${many}`)).status).toBe(400);
  });

  it("checks the session before looking at the query", async () => {
    // A guest sending a bad query still gets 401, not a hint about validation.
    expect((await request("?slug=../x")).status).toBe(401);
  });
});
