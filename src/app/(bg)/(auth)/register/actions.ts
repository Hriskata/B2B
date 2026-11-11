"use server";

import { z } from "zod";
import { registerCustomer } from "@/lib/auth/customer";
import { verifyCaptchaFromForm } from "@/lib/captcha";
import { getClientIp } from "@/lib/client-ip";
import { isCountryCode, parseCompanyNumber } from "@/lib/company-number";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { validatePassword } from "@/lib/password";
import {
  companyNameSchema,
  emailSchema,
  field,
  firstErrors,
  fullNameSchema,
  passwordFieldSchema,
  type FieldErrors,
} from "@/lib/validation";

// Step 1 of the form: the person and the login. Step 2: the company.
const stepOneSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: passwordFieldSchema,
});

function readStepOne(formData: FormData) {
  return {
    fullName: field(formData, "fullName"),
    email: field(formData, "email"),
    password: field(formData, "password"),
    passwordConfirm: field(formData, "passwordConfirm"),
  };
}

// No database lookup here, so step 1 never reveals whether an email exists.
function checkStepOne(raw: ReturnType<typeof readStepOne>) {
  const parsed = stepOneSchema.safeParse(raw);
  const fieldErrors: FieldErrors = parsed.success ? {} : firstErrors(parsed.error);
  if (!fieldErrors.password) {
    const check = validatePassword(raw.password, { email: raw.email.trim().toLowerCase() });
    if (!check.ok) fieldErrors.password = check.message;
  }
  if (!fieldErrors.password && raw.passwordConfirm !== raw.password) {
    fieldErrors.passwordConfirm = "Паролите не съвпадат.";
  }
  return { parsed, fieldErrors };
}

export async function checkRegisterStepOneAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = readStepOne(formData);
  // Only non-secret values go back into the form.
  const values = { fullName: raw.fullName, email: raw.email };
  const { fieldErrors } = checkStepOne(raw);
  if (Object.keys(fieldErrors).length > 0) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors, values });
  }
  return success(prev, "");
}

export async function registerAction(prev: FormState, formData: FormData): Promise<FormState> {
  const stepOne = readStepOne(formData);
  const country = field(formData, "country");
  const companyName = field(formData, "companyName");
  const companyNumber = field(formData, "companyNumber");
  const values = {
    fullName: stepOne.fullName,
    email: stepOne.email,
    country,
    companyName,
    companyNumber,
  };

  // Everything is checked again: the browser's step 1 check is not trusted.
  const { parsed, fieldErrors } = checkStepOne(stepOne);
  const name = companyNameSchema.safeParse(companyName);
  if (!name.success) fieldErrors.companyName = name.error.issues[0].message;
  let storedNumber = "";
  if (!isCountryCode(country)) {
    fieldErrors.country = "Изберете държава.";
  } else {
    const number = parseCompanyNumber(country, companyNumber);
    if (number.ok) storedNumber = number.value;
    else fieldErrors.companyNumber = number.message;
  }
  if (!parsed.success || !name.success || Object.keys(fieldErrors).length > 0) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors, values });
  }

  const ip = await getClientIp();
  if (!(await verifyCaptchaFromForm(formData, ip))) {
    return failure(prev, MESSAGES.captcha, { values });
  }

  const result = await registerCustomer({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    password: parsed.data.password,
    country,
    companyName: name.data,
    companyNumber: storedNumber,
    ip,
  });
  if (result === "rate_limited") {
    return failure(prev, MESSAGES.rateLimited, { values });
  }

  // Same text whether the email was new, unverified or already registered.
  return success(
    prev,
    "Ако данните са верни, изпратихме имейл с връзка за потвърждение. Проверете пощата си.",
  );
}
