import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход" };

const NOTICES: Record<string, string> = {
  "password-reset": "Паролата е сменена. Влезте с новата парола.",
  "email-verified": "Имейлът е потвърден. Можете да влезете.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Вход</h1>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { notice } = await searchParams;
  const text = typeof notice === "string" ? NOTICES[notice] : undefined;
  return <LoginForm notice={text} />;
}
