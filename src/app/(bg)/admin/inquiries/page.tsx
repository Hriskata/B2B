import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Запитвания (админ)" };

// Phase 4/5: list of inquiries, with the admin-only flag for an inactive or
// deleted company. Empty until the inquiry form exists.
export default function AdminInquiriesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await requireAdmin();
  return (
    <PlaceholderPage
      wide
      title="Запитвания"
      phase="фаза 4"
      waitingFor={[
        "решенията за запитването (минимум, няколко продукта, получатели)",
        "решение какво става с неактивна фирма (за флага към админите)",
      ]}
    />
  );
}
