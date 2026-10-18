import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/db", () => ({ getDb: () => ({ execute }) }));

const { GET } = await import("./route");

describe("GET /api/health", () => {
  beforeEach(() => {
    execute.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns ok when the database answers", async () => {
    execute.mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("returns 503 without leaking error details when the database fails", async () => {
    execute.mockRejectedValue(new Error('connect ECONNREFUSED db:5432 password "secret"'));

    const res = await GET();
    const body = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ status: "error" });
    expect(body).not.toContain("ECONNREFUSED");
    expect(body).not.toContain("secret");
  });
});
