"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { Turnstile } from "@/components/turnstile";
import { initialFormState } from "@/lib/form-state";
import { PASSWORD_RULES_TEXT } from "@/lib/password-policy";
import { registerAction } from "./actions";

export function RegisterForm({ siteKey }: { siteKey: string }) {
  const [state, action] = useActionState(registerAction, initialFormState);

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="companyName"
        label="Име на фирмата"
        autoComplete="organization"
        state={state}
        maxLength={200}
      />
      <Field
        name="eik"
        label="ЕИК"
        inputMode="numeric"
        hint="9 или 13 цифри."
        state={state}
        maxLength={13}
      />
      <Field
        name="email"
        label="Имейл"
        type="email"
        autoComplete="email"
        state={state}
        maxLength={254}
      />
      <Field
        name="password"
        label="Парола"
        type="password"
        autoComplete="new-password"
        hint={PASSWORD_RULES_TEXT}
        state={state}
        maxLength={128}
      />
      <Turnstile siteKey={siteKey} resetKey={state.nonce} />
      <SubmitButton>Регистрация</SubmitButton>
      <p className="text-sm">
        Вече имате профил?{" "}
        <Link href="/login" className="underline">
          Вход
        </Link>
      </p>
    </form>
  );
}
