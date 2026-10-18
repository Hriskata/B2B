"use server";

import { redirect } from "next/navigation";
import { loginCustomer } from "@/lib/auth/customer";
import { destroySession } from "@/lib/auth/session";
import { getClientIp } from "@/lib/client-ip";
import { failure, MESSAGES, type FormState } from "@/lib/form-state";
import { emailSchema, field } from "@/lib/validation";

const LOGIN_FAILED = "Невалиден имейл или парола.";

export async function loginAction(prev: FormState, formData: FormData): Promise<FormState> {
  const rawEmail = field(formData, "email");
  const password = field(formData, "password");
  const values = { email: rawEmail };

  const email = emailSchema.safeParse(rawEmail);
  if (!email.success || password.length === 0 || password.length > 128) {
    return failure(prev, LOGIN_FAILED, { values });
  }

  const result = await loginCustomer(email.data, password, await getClientIp());
  switch (result) {
    case "ok":
      redirect("/");
    case "unverified":
      return failure(
        prev,
        "Профилът ви още не е потвърден. Отворете връзката от имейла за потвърждение.",
        { values },
      );
    case "blocked":
      return failure(prev, "Профилът е блокиран. Свържете се с нас.", { values });
    case "rate_limited":
      return failure(prev, MESSAGES.rateLimited, { values });
    default:
      return failure(prev, LOGIN_FAILED, { values });
  }
}

export async function logoutAction(): Promise<void> {
  await destroySession("user");
  redirect("/");
}
