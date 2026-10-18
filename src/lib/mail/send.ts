import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getEnv } from "../env";

export type Mail = { to: string; subject: string; text: string };

let transport: Transporter | undefined;

function getTransport() {
  if (!transport) {
    const env = getEnv();
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return transport;
}

// Subject and recipient must never contain user-controlled line breaks
// (header injection). Subjects are fixed strings; the recipient is checked.
const SAFE_ADDRESS = /^[^\s<>",;\r\n]+@[^\s<>",;\r\n]+$/;

// Returns false instead of throwing: callers must not change their response
// to the user depending on whether mail went out.
export async function sendMail(mail: Mail): Promise<boolean> {
  if (!SAFE_ADDRESS.test(mail.to) || /[\r\n]/.test(mail.subject)) {
    console.error("Mail rejected: unsafe address or subject");
    return false;
  }
  try {
    await getTransport().sendMail({
      from: getEnv().MAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    return true;
  } catch (error) {
    console.error("Mail send failed:", error instanceof Error ? error.message : "unknown error");
    return false;
  }
}
