"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { createAdminAction } from "../manage-actions";

// Adds an admin with the default password. The server action checks the
// "manage_admins" permission on its own; this form is only shown to roles
// that hold it.
export function AddAdminForm() {
  const [state, action] = useActionState(createAdminAction, initialFormState);
  return (
    <form action={action} className="flex max-w-md flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="email"
        label="Имейл на новия администратор"
        type="email"
        autoComplete="off"
        state={state}
        maxLength={254}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="f-role" className="font-medium">
          Роля
        </label>
        <select
          id="f-role"
          name="role"
          defaultValue={state.values?.role ?? "viewer"}
          aria-invalid={state.fieldErrors?.role ? true : undefined}
          className="rounded border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600"
        >
          <option value="viewer">Само преглед</option>
          <option value="editor">Преглед и редакция</option>
        </select>
        {state.fieldErrors?.role && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.fieldErrors.role}
          </p>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Новият админ получава временна парола (ще я видите след добавянето). При първия вход настройва
        2FA и е длъжен веднага да смени паролата. Ролята „Преглед и редакция“ може да променя продукти и
        цени, да блокира профили и да добавя други админи.
      </p>
      <SubmitButton>Добави администратор</SubmitButton>
    </form>
  );
}
