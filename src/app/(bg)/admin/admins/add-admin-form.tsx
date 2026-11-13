"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { createAdminAction } from "../manage-actions";

// Adds an admin who gets an emailed invite link. The server action checks the
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
          className="input"
        >
          <option value="viewer">Само преглед</option>
          <option value="editor">Преглед и редакция</option>
        </select>
        {state.fieldErrors?.role && (
          <p role="alert" className="text-sm text-ember-300">
            {state.fieldErrors.role}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="f-kind" className="font-medium">
          Тип
        </label>
        <select
          id="f-kind"
          name="kind"
          defaultValue={state.values?.kind ?? "support"}
          aria-invalid={state.fieldErrors?.kind ? true : undefined}
          aria-describedby="f-kind-hint"
          className="input"
        >
          <option value="support">Поддръжка на сайта</option>
          <option value="owner">Собственик</option>
        </select>
        <p id="f-kind-hint" className="text-sm text-secondary">
          Двата типа имат еднакви права. Само собствениците получават имейл при ново запитване.
        </p>
        {state.fieldErrors?.kind && (
          <p role="alert" className="text-sm text-ember-300">
            {state.fieldErrors.kind}
          </p>
        )}
      </div>
      {/* The server asks for these again: an open session alone is not enough. */}
      <Field
        name="password"
        label="Вашата парола"
        type="password"
        autoComplete="current-password"
        state={state}
        maxLength={128}
      />
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
      <p className="text-sm text-secondary">
        Новият админ получава имейл с връзка за задаване на парола (важи 72
        часа). След това влиза и настройва 2FA. Ролята
        „Преглед и редакция“ може да променя продукти и цени, да блокира профили
        и да добавя други админи.
      </p>
      <SubmitButton>Добави администратор</SubmitButton>
    </form>
  );
}
