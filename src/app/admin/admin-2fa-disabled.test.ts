import { describe, expect, it, vi } from "vitest";
import { getCurrentAdmin } from "@/lib/auth/current";
import { initialFormState } from "@/lib/form-state";
import { createAdmin, fd, PASSWORD } from "@/test/factories";
import { cookieJar, redirectedTo } from "@/test/next-mocks";
import { adminLoginAction } from "./actions";

const describeDb = describe.skipIf(!process.env.TEST_DATABASE_URL);

// The switch is read through getEnv(); this file turns it on.
vi.mock("@/lib/env", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/env")>();
  return { ...real, getEnv: () => ({ ...real.getEnv(), ADMIN_2FA_DISABLED: true }) };
});

describeDb("admin login with the local 2FA switch ON", () => {
  it("opens the admin area with the password alone", async () => {
    await createAdmin();

    const to = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "admin@firma.bg", password: PASSWORD })),
    );

    expect(to).toBe("/admin");
    expect((await getCurrentAdmin("full"))?.email).toBe("admin@firma.bg");
    expect(Number(cookieJar.get("b2b_admin_session")!.options?.maxAge)).toBe(8 * 60 * 60);
  });

  it("still needs the right password", async () => {
    await createAdmin();

    const to = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "admin@firma.bg", password: "Wrong-pass1" })),
    );

    expect(to).toBeNull();
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("does not let a blocked admin in", async () => {
    await createAdmin({ status: "blocked" });

    const to = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "admin@firma.bg", password: PASSWORD })),
    );

    expect(to).toBeNull();
    expect(await getCurrentAdmin("full")).toBeNull();
  });

  it("works for an admin who never set up 2FA", async () => {
    await createAdmin({ withTotp: false });

    const to = await redirectedTo(() =>
      adminLoginAction(initialFormState, fd({ email: "admin@firma.bg", password: PASSWORD })),
    );

    expect(to).toBe("/admin");
  });
});
