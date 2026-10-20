import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentAdmin } from "@/lib/auth/current";
import { beginTotpSetup } from "@/lib/auth/totp";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Настройка на 2FA" };

export default function AdminTwoFactorSetupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Настройка на двуфакторна автентикация</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const admin = await getCurrentAdmin("mfa_setup");
  if (!admin) {
    // Right after a successful setup the action upgrades the session and Next
    // re-renders this page. Keep the client component (which holds the
    // one-time recovery codes) mounted instead of redirecting away.
    if (await getCurrentAdmin("full")) return <SetupForm qrDataUrl="" secret="" finished />;
    redirect("/admin/login");
  }
  const setup = await beginTotpSetup(admin.id);
  if (!setup) redirect("/admin/login");
  return <SetupForm qrDataUrl={setup.qrDataUrl} secret={setup.secret} />;
}
