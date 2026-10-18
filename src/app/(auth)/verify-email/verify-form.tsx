"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { verifyEmailAction } from "./actions";

// Verification happens on a button press (POST), not when the page opens:
// mail scanners that open links must not use up the one-time token.
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action] = useActionState(verifyEmailAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <p>Натиснете бутона, за да потвърдите имейл адреса си.</p>
      <SubmitButton>Потвърди имейла</SubmitButton>
    </form>
  );
}
