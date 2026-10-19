import { describe, expect, it } from "vitest";
import { can, type Permission } from "./permissions";

const ALL: Permission[] = ["view", "edit_catalog", "block_accounts", "reset_admin_2fa"];

describe("permission matrix", () => {
  it("a viewer can only view", () => {
    expect(ALL.filter((p) => can("viewer", p))).toEqual(["view"]);
  });

  it("an editor can do everything", () => {
    expect(ALL.filter((p) => can("editor", p))).toEqual(ALL);
  });

  it("an unknown role can do nothing", () => {
    for (const p of ALL) expect(can("root" as never, p)).toBe(false);
    for (const p of ALL) expect(can(undefined as never, p)).toBe(false);
  });
});
