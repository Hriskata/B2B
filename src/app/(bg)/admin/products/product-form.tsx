"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Checkbox, Field, FormMessage, SubmitButton } from "@/components/form-parts";
import { initialFormState, type FormState } from "@/lib/form-state";
import { SERIES_KEYS, seriesName } from "@/lib/series";
import { saveProductAction } from "../manage-actions";

export type ProductFormValues = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  descriptionEn: string;
  sortOrder: string;
  price: string;
  published: boolean;
  series: string;
  connector: string;
  ports: string;
  mpoPorts: string;
  fibers: string;
  maxFibersVariant: string;
  rackUnits: string;
  polish: string;
  splice: string; // "" unknown, "1" yes, "0" no
  frontDoor: string;
};

export const EMPTY_SPECS = {
  series: "", connector: "", ports: "", mpoPorts: "", fibers: "", maxFibersVariant: "",
  rackUnits: "", polish: "", splice: "", frontDoor: "",
};

function SelectField({
  name, label, options, initial, state, disabled,
}: {
  name: string;
  label: string;
  options: [string, string][];
  initial: string;
  state: FormState;
  disabled: boolean;
}) {
  const error = state.fieldErrors?.[name];
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`f-${name}`} className="font-medium">
        {label}
      </label>
      <select
        id={`f-${name}`}
        name={name}
        defaultValue={state.values?.[name] ?? initial}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        className="rounded border border-zinc-400 bg-transparent px-3 py-2 dark:border-zinc-600"
      >
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

const YES_NO_UNKNOWN: [string, string][] = [["", "Не е известно"], ["1", "Да"], ["0", "Не"]];

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
        name="descriptionEn"
        label="Описание на английски (по желание)"
        defaultValue={initial.descriptionEn}
        disabled={!canEdit}
        multiline
        required={false}
        hint="Ако е празно, на английската версия се показва кратък текст от техническите данни."
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
      <fieldset className="flex flex-col gap-4 rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <legend className="px-1 font-medium">Технически данни (по желание)</legend>
        <SelectField
          name="series"
          label="Серия"
          initial={initial.series}
          state={state}
          disabled={!canEdit}
          options={[["", "Без серия"], ...SERIES_KEYS.map((k): [string, string] => [k, seriesName(k) ?? k])]}
        />
        <Field name="connector" label="Конектор" defaultValue={initial.connector} disabled={!canEdit} required={false} hint="Например: LC, SC, MPO, LC/MPO." state={state} maxLength={20} />
        <div className="grid grid-cols-2 gap-4">
          <Field name="ports" label="Портове" defaultValue={initial.ports} disabled={!canEdit} required={false} inputMode="numeric" state={state} maxLength={5} />
          <Field name="mpoPorts" label="MPO портове" defaultValue={initial.mpoPorts} disabled={!canEdit} required={false} inputMode="numeric" state={state} maxLength={5} />
          <Field name="fibers" label="Влакна" defaultValue={initial.fibers} disabled={!canEdit} required={false} inputMode="numeric" state={state} maxLength={5} />
          <Field name="maxFibersVariant" label="Варианти до (влакна)" defaultValue={initial.maxFibersVariant} disabled={!canEdit} required={false} inputMode="numeric" state={state} maxLength={5} />
          <Field name="rackUnits" label="Височина (RU)" defaultValue={initial.rackUnits} disabled={!canEdit} required={false} inputMode="numeric" state={state} maxLength={5} />
        </div>
        <Field name="polish" label="Полиране / влакно" defaultValue={initial.polish} disabled={!canEdit} required={false} hint="Разделени със запетая, например: SM/UPC, SM/APC, MM/UPC." state={state} maxLength={200} />
        <SelectField name="splice" label="Сплайс" initial={initial.splice} state={state} disabled={!canEdit} options={YES_NO_UNKNOWN} />
        <SelectField name="frontDoor" label="Предна врата" initial={initial.frontDoor} state={state} disabled={!canEdit} options={YES_NO_UNKNOWN} />
      </fieldset>
      <Checkbox name="published" label="Публикуван (виждат го посетителите)" defaultChecked={initial.published} disabled={!canEdit} state={state} />
      {canEdit ? <SubmitButton>Запази</SubmitButton> : <p className="text-sm">Имате право само на преглед.</p>}
      <Link href="/admin/products" className="text-sm underline">
        Назад към продуктите
      </Link>
    </form>
  );
}
