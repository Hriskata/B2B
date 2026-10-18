"use server";

import { redirect } from "next/navigation";
import { verifyCustomerEmail } from "@/lib/auth/customer";
import { failure, type FormState } from "@/lib/form-state";
import { field } from "@/lib/validation";

export async function verifyEmailAction(prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await verifyCustomerEmail(field(formData, "token")))) {
    return failure(prev, "Връзката е невалидна или е изтекла.");
  }
  redirect("/login?notice=email-verified");
}
