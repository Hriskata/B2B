"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Checkbox, Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState } from "@/lib/form-state";
import { saveProductAction } from "../manage-actions";

export type ProductFormValues = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: string;
  price: string;
  published: boolean;
};

// `canEdit` only changes what is shown: a viewer sees the values read-only and
// no save button. The server action refuses a viewer on its own.
export function ProductForm({ initial, canEdit }: { initial: ProductFormValues; canEdit: boolean }) {
  const [state, action] = useActionState(saveProductAction, initialFormState);
  const isNew = !initial.id;
  return (
    <form action={action} className="flex max-w-xl flex-col gap-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <FormMessage state={state} />
      <Field
        name="slug"
        label="Адрес на страницата"
        defaultValue={initial.slug}
        disabled={!isNew}
        hint={
          isNew
            ? "Малки латински букви, цифри и тирета, например: moy-produkt. След създаване не се променя."
            : "Адресът не се променя след създаване."
        }
        state={state}
        maxLength={80}
      />
      <Field name="name" label="Име" defaultValue={initial.name} disabled={!canEdit} state={state} maxLength={200} />
      <Field
        name="description"
        label="Описание"
        defaultValue={initial.description}
        disabled={!canEdit}
        multiline
        state={state}
        maxLength={5000}
      />
      <Field
        name="price"
        label="Цена за бройка (евро)"
        defaultValue={initial.price}
        disabled={!canEdit}
        inputMode="text"
        required={false}
        hint="Например 12,50. Оставете празно, ако още няма цена."
        state={state}
        maxLength={12}
      />
      <Field
        name="sortOrder"
        label="Ред в каталога"
        defaultValue={initial.sortOrder}
        disabled={!canEdit}
        inputMode="numeric"
        hint="По-малкото число е по-напред."
        state={state}
        maxLength={4}
      />
      <Checkbox name="published" label="Публикуван (виждат го посетителите)" defaultChecked={initial.published} disabled={!canEdit} state={state} />
      {canEdit ? <SubmitButton>Запази</SubmitButton> : <p className="text-sm">Имате право само на преглед.</p>}
      <Link href="/admin/products" className="text-sm underline">
        Назад към продуктите
      </Link>
    </form>
  );
}
