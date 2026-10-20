"use server";

import { requestCustomerPasswordReset } from "@/lib/auth/customer";
import { verifyCaptchaFromForm } from "@/lib/captcha";
import { getClientIp } from "@/lib/client-ip";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { emailSchema, field } from "@/lib/validation";

export async function forgotPasswordAction(
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

  await requestCustomerPasswordReset(email.data, ip);

  // Identical whether or not the email belongs to an account (or was rate limited).
  return success(
    prev,
    "Ако за този имейл има профил, изпратихме връзка за смяна на паролата. Проверете пощата си.",
  );
}
