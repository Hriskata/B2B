"use server";

import { redirect } from "next/navigation";
import { verifyCustomerEmail } from "@/lib/auth/customer";
import { failure, type FormState } from "@/lib/form-state";
import { field } from "@/lib/validation";

export async function verifyEmailAction(prev: FormState, formData: FormData): Promise<FormState> {
  const result = await verifyCustomerEmail(field(formData, "token"));
  if (result === "invalid") {
    return failure(prev, "Връзката е невалидна или е изтекла.");
  }
  if (result === "pending_review") redirect("/pending-approval");
  // A blocked or rejected account is not told anything new here.
  redirect(result === "active" ? "/login?notice=email-verified" : "/login");
}
