"use server";

import { redirect } from "next/navigation";
import {
  loginAdmin,
  requestAdminPasswordReset,
  resetAdminPassword,
} from "@/lib/auth/admin";
import { getCurrentAdmin } from "@/lib/auth/current";
import { createSession, destroySession } from "@/lib/auth/session";
import { completeTotpSetup, verifySecondFactor } from "@/lib/auth/totp";
import { verifyCaptchaFromForm } from "@/lib/captcha";
import { getClientIp } from "@/lib/client-ip";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { validatePassword } from "@/lib/password";
import { emailSchema, field } from "@/lib/validation";

const LOGIN_FAILED = "Невалиден имейл или парола.";

export async function adminLoginAction(prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = field(formData, "email");
  const password = field(formData, "password");
  const values = { email: rawEmail };

  const email = emailSchema.safeParse(rawEmail);
  if (!email.success || password.length === 0 || password.length > 128) {
    return failure(prev, LOGIN_FAILED, { values });
  }

  const result = await loginAdmin(email.data, password, await getClientIp());
  if (result.status !== "next") {
    return failure(prev, result.status === "rate_limited" ? MESSAGES.rateLimited : LOGIN_FAILED, {
      values,
    });
  }
  redirect(result.step === "mfa_verify" ? "/admin/2fa" : "/admin/2fa/setup");
}

// Step 2 for admins who already have 2FA: authenticator code or recovery code.
export async function adminVerifyAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await getCurrentAdmin("mfa_verify");
  if (!admin) redirect("/admin/login");

  const result = await verifySecondFactor(admin.id, field(formData, "code"));
  if (result === "rate_limited") return failure(prev, MESSAGES.rateLimited);
  if (result === "invalid") return failure(prev, "Невалиден или вече използван код.");

  // New session id for the full-access session.
  await createSession("admin", admin.id, "full");
  redirect("/admin");
}

// First login: confirm the authenticator app, then show recovery codes once.
export async function adminSetupAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await getCurrentAdmin("mfa_setup");
  if (!admin) redirect("/admin/login");

  const result = await completeTotpSetup(admin.id, field(formData, "code"));
  if (result.status !== "ok") {
    return failure(
      prev,
      result.status === "rate_limited"
        ? MESSAGES.rateLimited
        : "Невалиден код. Опитайте с текущия код от приложението.",
    );
  }

  await createSession("admin", admin.id, "full");
  return { ...success(prev, "Двуфакторната автентикация е включена."), recoveryCodes: result.recoveryCodes };
}

export async function adminLogoutAction(): Promise<void> {
  await destroySession("admin");
  redirect("/admin/login");
}

export async function adminForgotPasswordAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const rawEmail = field(formData, "email");
  const values = { email: rawEmail };

  const email = emailSchema.safeParse(rawEmail);
  if (!email.success) {
    return failure(prev, MESSAGES.invalidInput, {
      fieldErrors: { email: "Невалиден имейл адрес." },
      values,
    });
  }
  const ip = await getClientIp();
  if (!(await verifyCaptchaFromForm(formData, ip))) {
    return failure(prev, MESSAGES.captcha, { values });
  }

  await requestAdminPasswordReset(email.data, ip);
  return success(
    prev,
    "Ако за този имейл има админ профил, изпратихме връзка за смяна на паролата.",
  );
}

export async function adminResetPasswordAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const password = field(formData, "password");
  const check = validatePassword(password);
  if (!check.ok) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors: { password: check.message } });
  }
  if (password !== field(formData, "confirm")) {
    return failure(prev, MESSAGES.invalidInput, {
      fieldErrors: { confirm: "Паролите не съвпадат." },
    });
  }
  if (!(await resetAdminPassword(field(formData, "token"), password))) {
    return failure(prev, "Връзката е невалидна или е изтекла. Поискайте нова.");
  }
  // Login still requires the second factor.
  redirect("/admin/login?notice=password-reset");
}
