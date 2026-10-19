import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = {
  title: "Запитването е изпратено",
  robots: { index: false, follow: false },
};

// Phase 4: confirmation after sending an inquiry. The customer learns only
// that it was sent, never the status of their company (decided). The wording
// is not decided.
export default function InquirySentPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <PlaceholderPage
        title="Запитването е изпратено"
        phase="фаза 4"
        waitingFor={["текстът на потвърждението след запитване (вие го одобрявате)"]}
      />
    </main>
  );
}
