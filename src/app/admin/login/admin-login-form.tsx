"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { adminLoginAction } from "../actions";

export function AdminLoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(adminLoginAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {notice && state.status === "idle" && (
        <p role="status" className="rounded border border-green-700 px-3 py-2 text-green-800 dark:text-green-400">
          {notice}
        </p>
      )}
      <FormMessage state={state} />
      <Field name="email" label="Имейл" type="email" autoComplete="username" state={state} maxLength={254} />
      <Field name="password" label="Парола" type="password" autoComplete="current-password" state={state} maxLength={128} />
      <SubmitButton>Продължи</SubmitButton>
    </form>
  );
}
