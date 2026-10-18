import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current";
import { adminLogoutAction } from "./actions";

export const metadata: Metadata = { title: "Администрация" };

const ROLE_LABEL = { viewer: "Само преглед", editor: "Преглед и редакция" } as const;

export default function AdminHomePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Администрация</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

// Placeholder: products, inquiries and approvals come in phases 3-5.
async function Content() {
  const admin = await requireAdmin();
  return (
    <div className="flex flex-col gap-4">
      <p>
        Вписани сте като <strong>{admin.email}</strong> ({ROLE_LABEL[admin.role]}).
      </p>
      <form action={adminLogoutAction}>
        <button type="submit" className="underline">
          Изход
        </button>
      </form>
    </div>
  );
}
