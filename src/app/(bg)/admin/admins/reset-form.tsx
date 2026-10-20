"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { resetAdminTwoFactorAction } from "../manage-actions";

// Asks the acting admin to prove themselves again: their own password and a
// current 2FA code.
export function ResetTwoFactorForm({ targetId, targetEmail }: { targetId: string; targetEmail: string }) {
  const [state, action] = useActionState(resetAdminTwoFactorAction, initialFormState);
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm underline">Нулирай 2FA на този админ</summary>
      <form action={action} className="mt-3 flex max-w-sm flex-col gap-3" noValidate>
        <input type="hidden" name="targetId" value={targetId} />
        <p className="text-sm">
          {targetEmail} ще загуби всички сесии, ще получи имейл и ще трябва да настрои 2FA отново.
          Потвърдете, че сте вие:
        </p>
        <FormMessage state={state} />
        <Field name="password" label="Вашата парола" type="password" autoComplete="current-password" state={state} maxLength={128} />
        <Field
          name="code"
          label="Вашият код за 2FA"
          autoComplete="one-time-code"
          inputMode="numeric"
          required={false}
          hint="6 цифри от приложението. (При изключена 2FA за тестване може да е празно.)"
          state={state}
          maxLength={64}
        />
        <SubmitButton>Нулирай 2FA</SubmitButton>
      </form>
    </details>
  );
}
