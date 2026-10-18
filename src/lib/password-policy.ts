// Pure rules, no server-only import so the same function can be tested and
// reused for client-side hints. The server always re-checks.

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULES_TEXT =
  "Паролата трябва да е поне 8 знака, с главни и малки букви и поне една цифра.";

// Passwords that satisfy the length/class rules but are among the most
// common ones. Compared case-insensitively.
const COMMON_PASSWORDS = new Set([
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "qwerty123",
  "qwerty1234",
  "qwertyui1",
  "admin123",
  "admin1234",
  "welcome1",
  "welcome123",
  "abc12345",
  "abcd1234",
  "iloveyou1",
  "letmein123",
  "changeme1",
  "parola123",
  "parola1234",
  "bulgaria1",
  "sofia1234",
  "12345678a",
  "a1234567",
  "a12345678",
]);

export type PasswordCheck = { ok: true } | { ok: false; message: string };

export function validatePassword(password: string, context: { email?: string } = {}): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: PASSWORD_RULES_TEXT };
  }
  if (!/\p{Ll}/u.test(password) || !/\p{Lu}/u.test(password) || !/\d/.test(password)) {
    return { ok: false, message: PASSWORD_RULES_TEXT };
  }
  const lower = password.toLowerCase();
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || (local && local.length >= 4 && lower.includes(local))) {
    return { ok: false, message: "Тази парола е твърде лесна за налучкване. Изберете друга." };
  }
  return { ok: true };
}
