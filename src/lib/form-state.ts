// Shared shape of the state returned by form Server Actions. Plain module
// (no "use server"), so it can be imported by both actions and components.

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  // Non-secret values to put back in the form after an error. Passwords and
  // codes are never sent back.
  values?: Record<string, string>;
  // One-time display of admin recovery codes after 2FA setup.
  recoveryCodes?: string[];
  // Grows with every submit; used to reset the captcha widget.
  nonce: number;
};

export const initialFormState: FormState = { status: "idle", nonce: 0 };

export function failure(
  prev: FormState,
  message: string,
  extra: Partial<Pick<FormState, "fieldErrors" | "values">> = {},
): FormState {
  return { status: "error", message, nonce: prev.nonce + 1, ...extra };
}

export function success(prev: FormState, message: string): FormState {
  return { status: "success", message, nonce: prev.nonce + 1 };
}

export const MESSAGES = {
  rateLimited: "Твърде много опити. Моля, опитайте отново по-късно.",
  captcha: "Не успяхме да потвърдим, че не сте робот. Опитайте отново.",
  invalidInput: "Моля, проверете въведените данни.",
  generic: "Възникна грешка. Моля, опитайте отново.",
} as const;
