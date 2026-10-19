import "server-only";
import { getEnv } from "../env";
import type { Mail } from "./send";

// DRAFT texts for the customer and admin emails of phase 1. They are not
// final: the plan asks for all email texts to be approved in one place.

function link(path: string, token: string): string {
  return `${getEnv().APP_URL.replace(/\/$/, "")}${path}?token=${encodeURIComponent(token)}`;
}

export function verifyEmailMail(to: string, token: string, hours: number): Mail {
  return {
    to,
    subject: "Потвърдете имейл адреса си",
    text: [
      "Здравейте,",
      "",
      "Получихме заявка за регистрация с този имейл адрес. За да я завършите, отворете връзката:",
      link("/verify-email", token),
      "",
      `Връзката важи ${hours} часа и може да се ползва само веднъж.`,
      "Ако не сте подавали заявка, просто игнорирайте това съобщение.",
    ].join("\n"),
  };
}

export function alreadyRegisteredMail(to: string): Mail {
  return {
    to,
    subject: "Опит за регистрация с вашия имейл",
    text: [
      "Здравейте,",
      "",
      "Някой опита да се регистрира с този имейл адрес, но за него вече има профил.",
      `Можете да влезете от ${getEnv().APP_URL.replace(/\/$/, "")}/login или да възстановите паролата си от страницата за вход.`,
      "",
      "Ако не сте вие, не е нужно да правите нищо.",
    ].join("\n"),
  };
}

export function resetPasswordMail(
  to: string,
  token: string,
  minutes: number,
  area: "user" | "admin",
): Mail {
  return {
    to,
    subject: "Възстановяване на парола",
    text: [
      "Здравейте,",
      "",
      "Получихме заявка за нова парола. За да зададете такава, отворете връзката:",
      link(area === "admin" ? "/admin/reset-password" : "/reset-password", token),
      "",
      `Връзката важи ${minutes} минути и може да се ползва само веднъж.`,
      "Ако не сте подавали заявка, игнорирайте съобщението - паролата ви остава непроменена.",
    ].join("\n"),
  };
}

export function twoFactorResetMail(to: string, resetBy: string): Mail {
  return {
    to,
    subject: "Двуфакторната ви автентикация беше нулирана",
    text: [
      "Здравейте,",
      "",
      `Двуфакторната автентикация на вашия админ профил беше нулирана от ${resetBy}.`,
      "Всички ваши активни сесии са прекратени. При следващия вход ще трябва да настроите 2FA отново.",
      `Вход: ${getEnv().APP_URL.replace(/\/$/, "")}/admin/login`,
      "",
      "Ако не очаквате това, свържете се веднага с останалите администратори.",
    ].join("\n"),
  };
}
