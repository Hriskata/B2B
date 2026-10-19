import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Профилът ви чака одобрение",
  robots: { index: false, follow: false },
};

// Phase 2: shown to a customer whose registration waits for manual review
// (company check unavailable). The behavior and the wording are not decided.
export default function PendingApprovalPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <PlaceholderPage
        title="Профилът ви чака одобрение"
        phase="фаза 2"
        waitingFor={[
          "текстът на съобщението към клиента (вие го одобрявате)",
          "ключът за CompanyBook и логиката за ръчен преглед (фаза 2)",
        ]}
      />
    </main>
  );
}
