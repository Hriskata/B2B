"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { Turnstile } from "@/components/turnstile";
import { initialFormState, type FormState } from "@/lib/form-state";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// Shared by the customer and the admin "forgot password" pages.
export function ForgotPasswordForm({
  action,
  siteKey,
  backHref,
}: {
  action: Action;
  siteKey: string;
  backHref: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field name="email" label="Имейл" type="email" autoComplete="email" state={state} maxLength={254} />
      <Turnstile siteKey={siteKey} resetKey={state.nonce} />
      <SubmitButton>Изпрати връзка</SubmitButton>
      <p className="text-sm">
        <Link href={backHref} className="underline">
          Назад към входа
        </Link>
      </p>
    </form>
  );
}
