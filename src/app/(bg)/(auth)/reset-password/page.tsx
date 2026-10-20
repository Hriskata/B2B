import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isEmailTokenUsable } from "@/lib/auth/tokens";
import { resetPasswordAction } from "./actions";
import { ResetPasswordForm } from "./reset-form";

// The link carries a secret token: keep it out of the Referer header.
export const metadata: Metadata = {
  title: "Нова парола",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Нова парола</h1>
      <Suspense>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: PageProps<"/reset-password">["searchParams"];
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  if (!(await isEmailTokenUsable(value, "reset_password", "user"))) {
    return (
      <p>
        Връзката е невалидна или е изтекла.{" "}
        <Link href="/forgot-password" className="underline">
          Поискайте нова
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm action={resetPasswordAction} token={value} />;
}
