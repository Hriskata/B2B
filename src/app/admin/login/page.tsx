import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Вход за администратори" };

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Вход за администратори</h1>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
      <p className="mt-4 text-sm">
        <Link href="/admin/forgot-password" className="underline">
          Забравена парола
        </Link>
      </p>
    </main>
  );
}

async function Form({
  searchParams,
}: {
  searchParams: PageProps<"/admin/login">["searchParams"];
}) {
  const { notice } = await searchParams;
  return (
    <AdminLoginForm
      notice={notice === "password-reset" ? "Паролата е сменена. Влезте с новата парола." : undefined}
    />
  );
}
