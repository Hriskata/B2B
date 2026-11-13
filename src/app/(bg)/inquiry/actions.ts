"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current";
import { isValidSlug } from "@/lib/catalog";
import { failure, MESSAGES, type FormState } from "@/lib/form-state";
import { INQUIRY_LIMITS, submitInquiry } from "@/lib/inquiries";
import { field, firstErrors } from "@/lib/validation";

const itemsSchema = z
  .array(
    z.object({
      slug: z.string().refine(isValidSlug),
      quantity: z.number().int().min(1).max(INQUIRY_LIMITS.quantity),
    }),
  )
  .min(1)
  .max(INQUIRY_LIMITS.items);

const schema = z.object({
  contactName: z
    .string()
    .trim()
    .min(2, "Въведете име на контактното лице (поне 2 знака).")
    .max(INQUIRY_LIMITS.contactName, "Името е твърде дълго.")
    .refine((v) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(v), "Името съдържа невалидни знаци."),
  phone: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.phone, "Телефонът е твърде дълъг.")
    // Digits with the usual separators, optionally a leading +; at least 6 digits.
    .refine(
      (v) => /^\+?[\d\s()\-./]+$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 6,
      "Въведете телефон (цифри, по желание с + в началото).",
    ),
  message: z
    .string()
    .trim()
    .max(INQUIRY_LIMITS.message, "Съобщението е твърде дълго (до 2000 знака).")
    // Line breaks are fine; other control and format (e.g. bidi) characters
    // could hide or reverse text in the admin.
    .refine(
      (v) => !/[\p{Cf}\p{Zl}\p{Zp}]|[^\P{Cc}\n\r\t]/u.test(v),
      "Съобщението съдържа невалидни знаци.",
    ),
  clientKey: z.uuid(),
});

function parseItems(raw: string) {
  try {
    return itemsSchema.safeParse(JSON.parse(raw));
  } catch {
    return itemsSchema.safeParse(null);
  }
}

// Only a logged-in, active customer (checked here on the server). The answer
// is the same whatever the status of the company: the customer only learns
// that the inquiry was sent.
export async function submitInquiryAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const raw = {
    contactName: field(formData, "contactName"),
    phone: field(formData, "phone"),
    message: field(formData, "message"),
    clientKey: field(formData, "clientKey"),
  };
  const values = { contactName: raw.contactName, phone: raw.phone, message: raw.message };
  const parsed = schema.safeParse(raw);
  const items = parseItems(field(formData, "items"));
  const fieldErrors = parsed.success ? {} : firstErrors(parsed.error);
  if (!items.success) {
    fieldErrors.items = `Добавете поне един продукт, с количество от 1 до ${INQUIRY_LIMITS.quantity.toLocaleString("bg-BG")} бройки.`;
  }
  if (!parsed.success || !items.success) {
    // A broken form key is not the customer's fault: a new one is made on reload.
    if (fieldErrors.clientKey) return failure(prev, MESSAGES.generic, { values });
    return failure(prev, MESSAGES.invalidInput, { fieldErrors, values });
  }

  const result = await submitInquiry(user, {
    contactName: parsed.data.contactName,
    phone: parsed.data.phone,
    message: parsed.data.message === "" ? null : parsed.data.message,
    clientKey: parsed.data.clientKey,
    items: items.data,
  });
  if (result === "rate_limited") return failure(prev, MESSAGES.rateLimited, { values });
  if (result === "product_unavailable") {
    return failure(prev, "Някой от продуктите вече не е наличен. Махнете го от списъка и опитайте отново.", {
      values,
    });
  }
  redirect("/inquiry/sent");
}
