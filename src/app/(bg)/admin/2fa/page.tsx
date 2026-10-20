import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/current";
import { VerifyForm } from "./verify-form";

export const metadata: Metadata = { title: "Втори фактор" };

export default function AdminTwoFactorPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Двуфакторна автентикация</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  // Only a session that passed the password step may see this page.
  if (!(await getCurrentAdmin("mfa_verify"))) redirect("/admin/login");
  return <VerifyForm />;
}
