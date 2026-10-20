"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { adminChangePasswordAction } from "../actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(adminChangePasswordAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="currentPassword" label="Текуща парола" type="password" autoComplete="current-password" state={state} maxLength={128} />
      <Field name="newPassword" label="Нова парола" type="password" autoComplete="new-password" state={state} maxLength={128} />
      <Field name="repeatPassword" label="Повторете новата парола" type="password" autoComplete="new-password" state={state} maxLength={128} />
      <SubmitButton>Смени паролата</SubmitButton>
    </form>
  );
}
