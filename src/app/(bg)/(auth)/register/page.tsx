import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCaptchaSiteKey } from "@/lib/captcha";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Регистрация на фирма</h1>
      <Suspense>
        <Form />
      </Suspense>
    </main>
  );
}

// Read at request time, so the captcha key comes from the runtime
// environment and is not baked into the build.
async function Form() {
  await connection();
  return <RegisterForm siteKey={getCaptchaSiteKey()} />;
}
