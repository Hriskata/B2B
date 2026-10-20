"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { loginAction } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(loginAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {notice && state.status === "idle" && (
        <p
          role="status"
          className="rounded-sm border border-line bg-card px-3 py-2"
        >
          {notice}
        </p>
      )}
      <FormMessage state={state} />
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
        autoComplete="current-password"
        state={state}
        maxLength={128}
      />
      <SubmitButton>Вход</SubmitButton>
      <p className="flex flex-col gap-1 text-sm">
        <Link href="/forgot-password" className="underline">
          Забравена парола
        </Link>
        <Link href="/register" className="underline">
          Нямате профил? Регистрация
        </Link>
      </p>
    </form>
  );
}
