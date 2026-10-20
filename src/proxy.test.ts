import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { createProduct } from "@/test/catalog-factories";
import { proxy } from "./proxy";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

const run = (path: string) => proxy(new NextRequest(`http://localhost:3200${path}`));
const rewrittenTo = (res: Response) => res.headers.get("x-middleware-rewrite");
const passedOn = (res: Response) => res.headers.get("x-middleware-next") === "1";

describeDb("product proxy (real 404 status)", () => {
  it("passes a published product through", async () => {
    await createProduct({ slug: "produkt-1" });

    expect(passedOn(await run("/products/produkt-1"))).toBe(true);
  });

  it("sends an unknown product to a non-existent path (real 404)", async () => {
    const res = await run("/products/nyama");

    expect(rewrittenTo(res)).toBe("http://localhost:3200/not-found-product");
  });

  it("treats an unpublished product like an unknown one", async () => {
    await createProduct({ slug: "hidden", published: false });

    expect(rewrittenTo(await run("/products/hidden"))).toMatch(/not-found-product/);
  });

  it.each(["/products/UPPER", "/products/a%20b", "/products/..%2Fetc", "/products/%E0%A4%A"])(
    "treats a malformed slug as not found without touching the database: %s",
    async (path) => {
      const res = await run(path);

      expect(passedOn(res)).toBe(false);
      expect(rewrittenTo(res)).toMatch(/not-found-product/);
    },
  );
});

describe("series proxy (real 404 status)", () => {
  it.each(["/series/hds", "/series/uds", "/series/quick-fit", "/series/mpo"])("passes a known series: %s", async (path) => {
    expect(passedOn(await run(path))).toBe(true);
  });

  it.each(["/series/nope", "/series/HDS", "/series/%E0%A4%A", "/series/hds%2Fx"])(
    "answers 404 for an unknown series: %s",
    async (path) => {
      const res = await run(path);

      expect(passedOn(res)).toBe(false);
      expect(rewrittenTo(res)).toMatch(/not-found-product/);
    },
  );
});
