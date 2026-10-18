"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { adminVerifyAction } from "../actions";

export function VerifyForm() {
  const [state, action] = useActionState(adminVerifyAction, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="code"
        label="Код от приложението или код за възстановяване"
        autoComplete="one-time-code"
        hint="6 цифри от приложението за автентикация. Ако нямате достъп до него, въведете един от кодовете за възстановяване."
        state={state}
        maxLength={64}
      />
      <SubmitButton>Вход</SubmitButton>
    </form>
  );
}
