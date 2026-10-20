import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { ForgotPasswordForm } from "../../(auth)/forgot-password/forgot-form";
import { adminForgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Забравена парола (админ)" };

export default function AdminForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Забравена парола</h1>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}

async function Form() {
  await connection();
  return (
    <ForgotPasswordForm
      action={adminForgotPasswordAction}
      siteKey={getCaptchaSiteKey()}
      backHref="/admin/login"
    />
  );
}
