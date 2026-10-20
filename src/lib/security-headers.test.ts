import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { SECURITY_HEADERS } from "./security-headers";

describe("security headers", () => {
  it("are configured for every path", async () => {
    const rules = await nextConfig.headers!();

    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    expect(rules[0].headers).toEqual(SECURITY_HEADERS);
  });

  it("forbid framing, sniffing and form posts to other sites", () => {
    const get = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value ?? "";

    expect(get("X-Frame-Options")).toBe("DENY");
    expect(get("X-Content-Type-Options")).toBe("nosniff");
    expect(get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(get("Content-Security-Policy")).toContain("form-action 'self'");
    expect(get("Permissions-Policy")).toContain("camera=()");
  });

  it("do not restrict scripts (a half-done script-src would break the site)", () => {
    const csp = SECURITY_HEADERS.find((h) => h.key === "Content-Security-Policy")!.value;

    expect(csp).not.toMatch(/script-src|default-src/);
  });
});
