"use server";

import { z } from "zod";
import { registerCustomer } from "@/lib/auth/customer";
import { verifyCaptchaFromForm } from "@/lib/captcha";
import { getClientIp } from "@/lib/client-ip";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { validatePassword } from "@/lib/password";
import {
  companyNameSchema,
  eikSchema,
  emailSchema,
  field,
  firstErrors,
  passwordFieldSchema,
} from "@/lib/validation";

const schema = z.object({
  companyName: companyNameSchema,
  eik: eikSchema,
  email: emailSchema,
  password: passwordFieldSchema,
});

export async function registerAction(prev: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    companyName: field(formData, "companyName"),
    eik: field(formData, "eik"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  };
  // Only non-secret values go back into the form.
  const values = { companyName: raw.companyName, eik: raw.eik, email: raw.email };

  const parsed = schema.safeParse(raw);
  const fieldErrors = parsed.success ? {} : firstErrors(parsed.error);
  if (!fieldErrors.password) {
    const check = validatePassword(raw.password, { email: raw.email.trim().toLowerCase() });
    if (!check.ok) fieldErrors.password = check.message;
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors, values });
  }

  const ip = await getClientIp();
  if (!(await verifyCaptchaFromForm(formData, ip))) {
    return failure(prev, MESSAGES.captcha, { values });
  }

  const result = await registerCustomer({ ...parsed.data, ip });
  if (result === "rate_limited") {
    return failure(prev, MESSAGES.rateLimited, { values });
  }

  // Same text whether the email was new, unverified or already registered.
  return success(
    prev,
    "Ако данните са верни, изпратихме имейл с връзка за потвърждение. Проверете пощата си.",
  );
}
