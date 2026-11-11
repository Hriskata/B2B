import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const emailSchema = z
  .string()
  .trim()
  .max(254, "Невалиден имейл адрес.")
  .pipe(z.email("Невалиден имейл адрес."))
  .transform(normalizeEmail);

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Въведете име и фамилия.")
  .max(120, "Името е твърде дълго.")
  // No control, format (e.g. bidi overrides) or line/paragraph separator
  // characters: they could break lines or hide text in mail and in the admin.
  .refine((v) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(v), "Името съдържа невалидни знаци.");

export const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Въведете името на фирмата.")
  .max(200, "Името на фирмата е твърде дълго.")
  // No control, format (e.g. bidi overrides) or line/paragraph separator
  // characters: they could break lines or hide text in mail and in the admin.
  .refine((v) => !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(v), "Името съдържа невалидни знаци.");

export const passwordFieldSchema = z.string().max(128, "Паролата е твърде дълга.");

// Reads a string field from FormData; anything else becomes "".
export function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

export type FieldErrors = Record<string, string>;

export function firstErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
