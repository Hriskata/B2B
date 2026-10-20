"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState, type FormState } from "@/lib/form-state";
import { PASSWORD_RULES_TEXT } from "@/lib/password-policy";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// Shared by the customer and the admin "set new password" pages.
export function ResetPasswordForm({
  action,
  token,
}: {
  action: Action;
  token: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <Field
        name="password"
        label="Нова парола"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_RULES_TEXT}
        state={state}
        maxLength={128}
      />
      <Field
        name="confirm"
        label="Повторете паролата"
        type="password"
        autoComplete="new-password"
        state={state}
        maxLength={128}
      />
      <SubmitButton>Смени паролата</SubmitButton>
    </form>
  );
}
