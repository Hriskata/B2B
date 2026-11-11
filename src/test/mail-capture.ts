import type { Mail } from "@/lib/mail/send";

export const sentMails: Mail[] = [];

// Set by a test to make sending fail (sendMail then returns false).
export const mailControl = { fail: false };

export async function captureMail(mail: Mail): Promise<boolean> {
  if (mailControl.fail) return false;
  sentMails.push(mail);
  return true;
}

export function resetSentMails() {
  sentMails.length = 0;
  mailControl.fail = false;
}

// The one-time token in the first link of a captured mail.
export function tokenFromMail(mail: Mail): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(mail.text);
  if (!match) throw new Error("No token link in mail");
  return match[1];
}
