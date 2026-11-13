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

// Invite of a new admin (decided 11.11.2026): a one-time link to set their
// own password; no password is ever sent or shown.
export function adminInviteMail(to: string, addedBy: string, token: string, hours: number): Mail {
  return {
    to,
    subject: "Покана за администратор",
    text: [
      "Здравейте,",
      "",
      `${addedBy} ви добави като администратор. За да зададете парола, отворете връзката:`,
      link("/admin/invite", token),
      "",
      `Връзката важи ${hours} часа и може да се ползва само веднъж.`,
      "След това влезте и настройте двуфакторна автентикация.",
      "",
      "Ако не очаквате това, свържете се с останалите администратори.",
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

// Manual review (phase 2). DRAFT texts, like the rest of this file.

// Only the country (from our own list) is in the mail. The company name and
// email are typed by the customer and could carry a link or fake text inside
// a mail from our own sender; the admin sees them in the portal.
export function registrationPendingAdminMail(to: string, country: string): Mail {
  return {
    to,
    subject: "Нова регистрация чака преглед",
    text: [
      "Здравейте,",
      "",
      `Нова регистрация на фирма от държава ${country} чака ръчен преглед.`,
      "",
      `Преглед: ${getEnv().APP_URL.replace(/\/$/, "")}/admin/registrations`,
    ].join("\n"),
  };
}

export function registrationApprovedMail(to: string): Mail {
  return {
    to,
    subject: "Регистрацията ви е одобрена",
    text: [
      "Здравейте,",
      "",
      "Регистрацията на вашата фирма е одобрена. Вече можете да влезете и да виждате цените:",
      `${getEnv().APP_URL.replace(/\/$/, "")}/login`,
    ].join("\n"),
  };
}

export function registrationRejectedMail(to: string): Mail {
  return {
    to,
    subject: "Регистрацията ви не е одобрена",
    text: [
      "Здравейте,",
      "",
      "За съжаление не можем да одобрим регистрацията на вашата фирма.",
      "Ако смятате, че това е грешка, свържете се с нас.",
    ].join("\n"),
  };
}

// New inquiry (phase 4), to the owners. DRAFT text. Only product names from
// our own catalog and the quantities are in the mail: the company name,
// contact and message are typed by the customer and are read in the portal.
export function inquiryAdminMail(
  to: string,
  items: { name: string; quantity: number }[],
  companyInactive: boolean,
): Mail {
  return {
    to,
    subject: companyInactive ? "Ново запитване (неактивна фирма)" : "Ново запитване",
    text: [
      "Здравейте,",
      "",
      "Получено е ново запитване за:",
      ...items.map((i) => `- ${i.name}: ${i.quantity} бр.`),
      "",
      ...(companyInactive
        ? ["Фирмата е неактивна в регистъра. Решете в портала дали да поемете запитването.", ""]
        : []),
      `Подробности: ${getEnv().APP_URL.replace(/\/$/, "")}/admin/inquiries`,
    ].join("\n"),
  };
}
