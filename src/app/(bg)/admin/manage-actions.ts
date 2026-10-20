"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resetAdminTwoFactor } from "@/lib/admin/admins";
import { setCompanyBlocked, setUserBlocked } from "@/lib/admin/accounts";
import { createProduct, updateProduct } from "@/lib/admin/products";
import { authorize } from "@/lib/auth/current";
import { isValidSlug } from "@/lib/catalog";
import { failure, MESSAGES, success, type FormState } from "@/lib/form-state";
import { parsePriceToCents } from "@/lib/money";
import { SERIES_KEYS } from "@/lib/series";
import { field, firstErrors } from "@/lib/validation";

// Every action here asks the SERVER whether the logged-in admin holds the
// needed permission, and changes nothing when they do not. Hiding buttons in
// the UI is only a convenience.

const NO_PERMISSION = "Нямате право на тази промяна.";

const productFields = z.object({
  name: z.string().trim().min(2, "Въведете име (поне 2 знака).").max(200, "Името е твърде дълго."),
  description: z
    .string()
    .trim()
    .min(1, "Въведете описание.")
    .max(5000, "Описанието е твърде дълго (до 5000 знака)."),
  descriptionEn: z.string().trim().max(5000, "Описанието е твърде дълго (до 5000 знака).").optional(),
  sortOrder: z.coerce
    .number({ error: "Въведете число." })
    .int("Въведете цяло число.")
    .min(0, "От 0 до 9999.")
    .max(9999, "От 0 до 9999."),
});

const slugField = z
  .string()
  .refine(isValidSlug, "Само малки латински букви, цифри и тирета (например: moy-produkt).");

const SPEC_NUMBER_FIELDS = [
  ["ports", "Портове"],
  ["mpoPorts", "MPO портове"],
  ["fibers", "Влакна"],
  ["maxFibersVariant", "Варианти до (влакна)"],
  ["rackUnits", "Височина (RU)"],
] as const;

// Empty = unknown (null). Anything else must be a whole number from 1 to 99999.
function optionalCount(value: string): number | null | "invalid" {
  if (value === "") return null;
  if (!/^\d{1,5}$/.test(value)) return "invalid";
  const n = Number(value);
  return n >= 1 ? n : "invalid";
}

function triState(value: string): boolean | null | "invalid" {
  if (value === "") return null;
  return value === "1" ? true : value === "0" ? false : "invalid";
}

export async function saveProductAction(prev: FormState, formData: FormData): Promise<FormState> {
  const auth = await authorize("edit_catalog");
  if (!auth.ok) return failure(prev, NO_PERMISSION);

  const id = field(formData, "id");
  const values = {
    slug: field(formData, "slug"),
    name: field(formData, "name"),
    description: field(formData, "description"),
    descriptionEn: field(formData, "descriptionEn"),
    sortOrder: field(formData, "sortOrder"),
    price: field(formData, "price"),
    published: formData.get("published") === "on" ? "on" : "",
    series: field(formData, "series"),
    connector: field(formData, "connector"),
    ports: field(formData, "ports"),
    mpoPorts: field(formData, "mpoPorts"),
    fibers: field(formData, "fibers"),
    maxFibersVariant: field(formData, "maxFibersVariant"),
    rackUnits: field(formData, "rackUnits"),
    polish: field(formData, "polish"),
    splice: field(formData, "splice"),
    frontDoor: field(formData, "frontDoor"),
  };

  const parsed = productFields.safeParse(values);
  const fieldErrors = parsed.success ? {} : firstErrors(parsed.error);
  if (!id) {
    const slug = slugField.safeParse(values.slug);
    if (!slug.success) fieldErrors.slug = slug.error.issues[0].message;
  }
  const priceCents = parsePriceToCents(values.price);
  if (priceCents === "invalid") {
    fieldErrors.price = "Въведете сума като 12,50 (над 0) или оставете празно.";
  }

  // Technical data (all optional).
  const counts: Record<string, number | null> = {};
  for (const [key, label] of SPEC_NUMBER_FIELDS) {
    const n = optionalCount(values[key]);
    if (n === "invalid") fieldErrors[key] = `${label}: цяло число от 1 до 99999 или празно.`;
    else counts[key] = n;
  }
  const series = values.series === "" ? null : (SERIES_KEYS.find((k) => k === values.series) ?? "invalid");
  if (series === "invalid") fieldErrors.series = "Изберете серия от списъка.";
  const splice = triState(values.splice);
  const frontDoor = triState(values.frontDoor);
  if (splice === "invalid") fieldErrors.splice = "Изберете от списъка.";
  if (frontDoor === "invalid") fieldErrors.frontDoor = "Изберете от списъка.";
  if (values.connector.length > 20) fieldErrors.connector = "Твърде дълго (до 20 знака).";
  const polish = values.polish
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (polish.length > 10 || polish.some((v) => v.length > 30)) {
    fieldErrors.polish = "До 10 варианта, разделени със запетая (всеки до 30 знака).";
  }

  if (
    !parsed.success || priceCents === "invalid" || series === "invalid" || splice === "invalid" ||
    frontDoor === "invalid" || Object.keys(fieldErrors).length > 0) {
    return failure(prev, MESSAGES.invalidInput, { fieldErrors, values });
  }

  const actor = { id: auth.admin.id, email: auth.admin.email };
  const common = {
    name: parsed.data.name,
    description: parsed.data.description,
    descriptionEn: parsed.data.descriptionEn || null,
    sortOrder: parsed.data.sortOrder,
    published: values.published === "on",
    priceCents,
    series,
    connector: values.connector || null,
    ports: counts.ports,
    mpoPorts: counts.mpoPorts,
    fibers: counts.fibers,
    maxFibersVariant: counts.maxFibersVariant,
    rackUnits: counts.rackUnits,
    polish,
    splice,
    frontDoor,
  };

  if (!id) {
    const result = await createProduct(actor, { ...common, slug: values.slug });
    if (!result.ok) {
      return failure(prev, MESSAGES.invalidInput, {
        fieldErrors: { slug: "Вече има продукт с този адрес." },
        values,
      });
    }
    redirect("/admin/products");
  }

  const result = await updateProduct(actor, id, common);
  if (result === "not_found") return failure(prev, "Продуктът не е намерен.");
  refresh();
  return success(prev, "Промените са запазени.");
}

// Plain form actions (no state): used by buttons in the customers list.
export async function setUserBlockedAction(formData: FormData): Promise<void> {
  const auth = await authorize("block_accounts");
  if (!auth.ok) return;
  await setUserBlocked(
    { id: auth.admin.id, email: auth.admin.email },
    field(formData, "userId"),
    formData.get("blocked") === "true",
  );
  refresh(); // show the new state in the list
}

export async function setCompanyBlockedAction(formData: FormData): Promise<void> {
  const auth = await authorize("block_accounts");
  if (!auth.ok) return;
  await setCompanyBlocked(
    { id: auth.admin.id, email: auth.admin.email },
    field(formData, "companyId"),
    formData.get("blocked") === "true",
  );
  refresh();
}

export async function resetAdminTwoFactorAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const auth = await authorize("reset_admin_2fa");
  if (!auth.ok) return failure(prev, NO_PERMISSION);

  const result = await resetAdminTwoFactor(
    { id: auth.admin.id, email: auth.admin.email },
    field(formData, "targetId"),
    field(formData, "password"),
    field(formData, "code"),
  );
  switch (result) {
    case "ok":
      refresh(); // the admins list shows the new 2FA state
      return success(prev, "2FA е нулирана. Засегнатият админ е уведомен по имейл.");
    case "rate_limited":
      return failure(prev, MESSAGES.rateLimited);
    case "self":
      return failure(prev, "Не можете да нулирате собствената си 2FA.");
    case "not_found":
      return failure(prev, "Админът не е намерен.");
    default:
      return failure(prev, "Невалидна парола или код.");
  }
}
