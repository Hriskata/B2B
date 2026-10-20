import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { forgotPasswordAction } from "./actions";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Забравена парола" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Забравена парола</h1>
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
      action={forgotPasswordAction}
      siteKey={getCaptchaSiteKey()}
      backHref="/login"
    />
  );
}
