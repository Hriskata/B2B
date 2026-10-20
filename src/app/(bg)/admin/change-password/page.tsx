import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdminSession } from "@/lib/auth/current";
import { PASSWORD_RULES_TEXT } from "@/lib/password-policy";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Смяна на парола (админ)" };

export default function AdminChangePasswordPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Смяна на парола</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

// Open to a complete session even with the default password (the only page
// such an admin can reach).
async function Content() {
  const admin = await requireAdminSession();
  return (
    <>
      {admin.mustChangePassword && (
        <p
          role="alert"
          className="mb-4 rounded-sm border border-line-ember bg-ember-900 px-3 py-2 text-sm text-ember-300"
        >
          Влизате с временна парола. Преди да продължите, трябва да зададете
          своя парола.
        </p>
      )}
      <ChangePasswordForm />
      <p className="mt-4 text-sm text-secondary">
        {PASSWORD_RULES_TEXT} След смяната останалите ви сесии се прекратяват.
      </p>
    </>
  );
}
