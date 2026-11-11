import { afterEach, describe, expect, it, vi } from "vitest";
import { getDb, tables } from "@/db";
import { companyRegister, fakeVerifier } from "@/test/company-register";
import { createCompanyBookVerifier } from "./companybook";
import { checkCompany } from "./index";
import { classifyStatus } from "./status";
import type { CompanyVerifier } from "./types";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);
const FAST = { attempts: 3, timeoutMs: 50, pauseMs: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("classifyStatus", () => {
  it("knows no CompanyBook code until the test with real companies", () => {
    expect(classifyStatus("companybook", "N")).toBe("unknown");
    expect(classifyStatus("companybook", null)).toBe("unknown");
  });

  it("ignores object keys that are not real entries", () => {
    expect(classifyStatus("test", "constructor")).toBe("unknown");
    expect(classifyStatus("constructor", "ACTIVE")).toBe("unknown");
    expect(classifyStatus("test", "ACTIVE")).toBe("active");
  });
});

describeDb("checkCompany", () => {
  it("returns the register answer and reuses it from the cache", async () => {
    expect(await checkCompany("123456789", fakeVerifier, FAST)).toMatchObject({
      kind: "active",
      status: "ACTIVE",
    });
    expect(await checkCompany("123456789", fakeVerifier, FAST)).toMatchObject({ kind: "active" });
    expect(companyRegister.calls).toEqual(["123456789"]);
  });

  it("tells inactive, unknown status and not found apart", async () => {
    companyRegister.answers.set("111111111", { found: true, status: "INACTIVE", name: "А" });
    companyRegister.answers.set("222222222", { found: true, status: "Z", name: "Б" });
    companyRegister.answers.set("333333333", { found: false, certain: true });

    expect((await checkCompany("111111111", fakeVerifier, FAST)).kind).toBe("inactive");
    expect((await checkCompany("222222222", fakeVerifier, FAST)).kind).toBe("unknown");
    expect((await checkCompany("333333333", fakeVerifier, FAST)).kind).toBe("not_found");
  });

  it("asks again after the cache time (a day for a company, an hour for not found)", async () => {
    companyRegister.answers.set("333333333", { found: false, certain: true });
    await checkCompany("123456789", fakeVerifier, FAST);
    await checkCompany("333333333", fakeVerifier, FAST);
    await getDb()
      .update(tables.companyCheckCache)
      .set({ checkedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) });

    await checkCompany("123456789", fakeVerifier, FAST); // 2 h old: still cached
    await checkCompany("333333333", fakeVerifier, FAST); // 2 h old: asked again
    expect(companyRegister.calls).toEqual(["123456789", "333333333", "333333333"]);
  });

  it("retries a failing register and succeeds on the third attempt", async () => {
    let failures = 2;
    const flaky: CompanyVerifier = {
      provider: "test",
      async lookup(eik, signal) {
        if (failures-- > 0) throw new Error("down");
        return fakeVerifier.lookup(eik, signal);
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await checkCompany("123456789", flaky, FAST)).kind).toBe("active");
  });

  it("gives up after 3 attempts, caches nothing and logs no details", async () => {
    companyRegister.defaultAnswer = "fail";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await checkCompany("123456789", fakeVerifier, FAST)).toEqual({ kind: "unavailable" });
    expect(companyRegister.calls).toHaveLength(3);
    expect(await getDb().select().from(tables.companyCheckCache)).toHaveLength(0);
    expect(log.mock.calls.flat().join(" ")).not.toContain("123456789");
  });

  it("stops an attempt that takes too long", async () => {
    const slow: CompanyVerifier = {
      provider: "test",
      lookup: (_eik, signal) =>
        new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const started = Date.now();

    expect(await checkCompany("123456789", slow, FAST)).toEqual({ kind: "unavailable" });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("without a register (no key) every check is unavailable, nothing is asked", async () => {
    expect(await checkCompany("123456789", null, FAST)).toEqual({ kind: "unavailable" });
    expect(companyRegister.calls).toHaveLength(0);
  });

  it("does not reuse an answer of another register", async () => {
    await checkCompany("123456789", fakeVerifier, FAST);
    const other: CompanyVerifier = { provider: "other", lookup: async () => ({ found: false, certain: true }) };
    expect((await checkCompany("123456789", other, FAST)).kind).toBe("not_found");
  });
});

describe("CompanyBook verifier", () => {
  const signal = new AbortController().signal;

  function stubFetch(status: number, body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("asks by EIK with the key in the X-API-Key header", async () => {
    const fetchMock = stubFetch(200, { uic: "123456789", name: "Тест ЕООД", status: "N" });
    const answer = await createCompanyBookVerifier("secret-key", "https://register.test").lookup(
      "123456789",
      signal,
    );

    expect(answer).toEqual({ found: true, name: "Тест ЕООД", status: "N" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://register.test/api/companies/123456789");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("secret-key");
    // A redirect must not carry the key to another host.
    expect(init.redirect).toBe("error");
  });

  it("reads 404 as an UNCONFIRMED not found (manual review) and a number status as text", async () => {
    stubFetch(404, {});
    expect(await createCompanyBookVerifier("k").lookup("1", signal)).toEqual({
      found: false,
      certain: false,
    });
    stubFetch(200, { name: null, status: 1 });
    expect(await createCompanyBookVerifier("k").lookup("1", signal)).toEqual({
      found: true,
      name: null,
      status: "1",
    });
  });

  it("throws on a server error or an unexpected answer, without the key in the message", async () => {
    stubFetch(500, {});
    await expect(createCompanyBookVerifier("secret-key").lookup("1", signal)).rejects.toThrow(
      /^Company register answered 500$/,
    );
    stubFetch(200, { status: { nested: true } });
    const error = await createCompanyBookVerifier("secret-key")
      .lookup("1", signal)
      .catch((e: Error) => e);
    expect(String(error)).not.toContain("secret-key");
  });

  it("does not take an answer for another number, or an empty answer, as found", async () => {
    stubFetch(200, { uic: "999999999", name: "Друга", status: "N" });
    await expect(createCompanyBookVerifier("k").lookup("123456789", signal)).rejects.toThrow();
    stubFetch(200, {});
    await expect(createCompanyBookVerifier("k").lookup("123456789", signal)).rejects.toThrow();
    stubFetch(200, { uic: "BG123456789", name: "Тест", status: null });
    expect((await createCompanyBookVerifier("k").lookup("123456789", signal)).found).toBe(true);
  });
});

describeDb("checkCompany: errors and cache", () => {
  it("an unconfirmed not found is reported as such and not cached", async () => {
    companyRegister.answers.set("123456789", { found: false, certain: false });
    expect((await checkCompany("123456789", fakeVerifier, FAST)).kind).toBe("not_confirmed");
    await checkCompany("123456789", fakeVerifier, FAST);
    expect(companyRegister.calls).toHaveLength(2);
  });

  it.each([401, 403, 429])("does not retry an HTTP %i (it will not get better in seconds)", async (status) => {
    const { RegisterHttpError } = await import("./types");
    let calls = 0;
    const refusing: CompanyVerifier = {
      provider: "test",
      async lookup() {
        calls++;
        throw new RegisterHttpError(status);
      },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await checkCompany("123456789", refusing, FAST)).toEqual({ kind: "unavailable" });
    expect(calls).toBe(1);
    expect(log.mock.calls.flat().join(" ")).toContain(`HTTP ${status}`);
  });

  it("uses a good answer even when it cannot be cached", async () => {
    const { getDb: db } = await import("@/db");
    const insert = vi.spyOn(db(), "insert").mockImplementation(() => {
      throw new Error("database down");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await checkCompany("123456789", fakeVerifier, FAST)).kind).toBe("active");
    expect(companyRegister.calls).toHaveLength(1);
    insert.mockRestore();
  });
});
