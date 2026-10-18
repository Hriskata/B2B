import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Format only: 9 digits (EIK) or 13 digits (EIK of a branch). Whether the
// company exists and is active is checked by the CompanyVerifier in phase 2.
const EIK_PATTERN = /^(\d{9}|\d{13})$/;

export function normalizeEik(eik: string): string {
  return eik.replace(/\s+/g, "");
}

export const emailSchema = z
  .string()
  .trim()
  .max(254, "Невалиден имейл адрес.")
  .pipe(z.email("Невалиден имейл адрес."))
  .transform(normalizeEmail);

export const eikSchema = z
  .string()
  .transform(normalizeEik)
  .pipe(z.string().regex(EIK_PATTERN, "ЕИК трябва да е 9 или 13 цифри."));

export const companyNameSchema = z
  .string()
  .trim()
  .min(2, "Въведете името на фирмата.")
  .max(200, "Името на фирмата е твърде дълго.")
  // No control characters (also blocks line breaks that could end up in mail).
  .refine((v) => !/[\p{Cc}]/u.test(v), "Името съдържа невалидни знаци.");

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
