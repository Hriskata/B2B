import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isEmailTokenUsable } from "@/lib/auth/tokens";
import { ResetPasswordForm } from "../../(auth)/reset-password/reset-form";
import { adminResetPasswordAction } from "../actions";

export const metadata: Metadata = {
  title: "Нова парола (админ)",
  referrer: "no-referrer",
};

export default function AdminResetPasswordPage({
  searchParams,
}: PageProps<"/admin/reset-password">) {
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
  searchParams: PageProps<"/admin/reset-password">["searchParams"];
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  if (!(await isEmailTokenUsable(value, "reset_password", "admin"))) {
    return (
      <p>
        Връзката е невалидна или е изтекла.{" "}
        <Link href="/admin/forgot-password" className="underline">
          Поискайте нова
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm action={adminResetPasswordAction} token={value} />;
}
