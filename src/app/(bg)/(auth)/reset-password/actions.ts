"use server";

import { redirect } from "next/navigation";
import { emailForCustomerResetToken, resetCustomerPassword } from "@/lib/auth/customer";
import { failure, MESSAGES, type FormState } from "@/lib/form-state";
import { validatePassword } from "@/lib/password";
import { getClientIp } from "@/lib/client-ip";
import { hit, LIMITS } from "@/lib/rate-limit";
import { field } from "@/lib/validation";

export async function resetPasswordAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");

  if (!(await hit(`reset-submit:ip:${await getClientIp()}`, LIMITS.resetSubmitPerIp))) {
    return failure(prev, MESSAGES.rateLimited);
  }

  // Check the password first: a weak one must not use up the one-time link.
  const email = await emailForCustomerResetToken(token);
  const check = validatePassword(password, email ? { email } : undefined);
  if (!check.ok) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors: { password: check.message } });
  }
  if (password !== confirm) {
    return failure(prev, MESSAGES.invalidInput, {
      fieldErrors: { confirm: "Паролите не съвпадат." },
    });
  }

  if (!(await resetCustomerPassword(token, password))) {
    return failure(prev, "Връзката е невалидна или е изтекла. Поискайте нова.");
  }
  redirect("/login?notice=password-reset");
}
