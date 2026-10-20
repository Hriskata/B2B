import type { Metadata } from "next";
import { Suspense } from "react";
import { isEmailTokenUsable } from "@/lib/auth/tokens";
import { VerifyEmailForm } from "./verify-form";

export const metadata: Metadata = {
  title: "Потвърждаване на имейл",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Потвърждаване на имейл</h1>
      <Suspense>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/verify-email">["searchParams"];
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  if (!(await isEmailTokenUsable(value, "verify_email", "user"))) {
    return <p>Връзката е невалидна или е изтекла.</p>;
  }
  return <VerifyEmailForm token={value} />;
}
