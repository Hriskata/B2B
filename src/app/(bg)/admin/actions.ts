"use server";

import { redirect } from "next/navigation";
import {
  loginAdmin,
  requestAdminPasswordReset,
  emailForAdminResetToken,
  resetAdminPassword,
} from "@/lib/auth/admin";
import { acceptAdminInvite, changeAdminPassword, emailForAdminInviteToken } from "@/lib/admin/admins";
import { getCurrentAdmin, requireAdminSession } from "@/lib/auth/current";
import { createSession, destroySession } from "@/lib/auth/session";
import { completeTotpSetup, verifySecondFactor } from "@/lib/auth/totp";
import { verifyCaptchaFromForm } from "@/lib/captcha";
import { getClientIp } from "@/lib/client-ip";
import { hit, LIMITS } from "@/lib/rate-limit";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { validatePassword } from "@/lib/password";
import { PASSWORD_RULES_TEXT } from "@/lib/password-policy";
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
  redirect(
    result.step === "full" ? "/admin" : result.step === "mfa_verify" ? "/admin/2fa" : "/admin/2fa/setup",
  );
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

// The admin changes their own password. Open to a session that still has the
// default password (that is the whole point), so it does not use authorize().
export async function adminChangePasswordAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdminSession();
  const next = field(formData, "newPassword");
  if (next !== field(formData, "repeatPassword")) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors: { repeatPassword: "Паролите не съвпадат." } });
  }
  const result = await changeAdminPassword(
    { id: admin.id, email: admin.email },
    field(formData, "currentPassword"),
    next,
  );
  switch (result) {
    case "ok":
      redirect("/admin");
    case "rate_limited":
      return failure(prev, MESSAGES.rateLimited);
    case "wrong_password":
      return failure(prev, MESSAGES.invalidInput, { fieldErrors: { currentPassword: "Невалидна текуща парола." } });
    case "same":
      return failure(prev, MESSAGES.invalidInput, { fieldErrors: { newPassword: "Новата парола трябва да е различна от текущата." } });
    default:
      return failure(prev, MESSAGES.invalidInput, { fieldErrors: { newPassword: PASSWORD_RULES_TEXT } });
  }
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
  if (!(await hit(`reset-submit:admin:ip:${await getClientIp()}`, LIMITS.resetSubmitPerIp))) {
    return failure(prev, MESSAGES.rateLimited);
  }
  const password = field(formData, "password");
  const email = await emailForAdminResetToken(field(formData, "token"));
  const check = validatePassword(password, email ? { email } : undefined);
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

// A new admin sets their own password from the invite link. Same checks as
// the reset; then the admin logs in and sets up 2FA.
export async function adminAcceptInviteAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await hit(`reset-submit:admin:ip:${await getClientIp()}`, LIMITS.resetSubmitPerIp))) {
    return failure(prev, MESSAGES.rateLimited);
  }
  const token = field(formData, "token");
  const password = field(formData, "password");
  const email = await emailForAdminInviteToken(token);
  const check = validatePassword(password, email ? { email } : undefined);
  if (!check.ok) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors: { password: check.message } });
  }
  if (password !== field(formData, "confirm")) {
    return failure(prev, MESSAGES.invalidInput, {
      fieldErrors: { confirm: "Паролите не съвпадат." },
    });
  }
  if (!(await acceptAdminInvite(token, password))) {
    return failure(prev, "Връзката е невалидна или е изтекла. Помолете друг администратор за нова покана.");
  }
  redirect("/admin/login?notice=invite-accepted");
}
