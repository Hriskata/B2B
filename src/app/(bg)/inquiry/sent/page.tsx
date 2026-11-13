import type { Metadata } from "next";
import Link from "next/link";
import { ClearInquiryList } from "./clear-list";

export const metadata: Metadata = {
  title: "Запитването е изпратено",
  robots: { index: false, follow: false },
};

// Confirmation after an inquiry. The customer learns only that it was sent,
// never the status of their company (decided). DRAFT wording, for approval.
export default function InquirySentPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <ClearInquiryList />
      <h1>Запитването е изпратено</h1>
      <p className="mt-4">Благодарим ви. Получихме запитването ви и ще се свържем с вас.</p>
      <p className="mt-6">
        <Link href="/products" className="btn btn-secondary">
          Към продуктите
        </Link>
      </p>
    </main>
  );
}
