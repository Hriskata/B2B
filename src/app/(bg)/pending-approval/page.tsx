import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Профилът ви чака одобрение",
  robots: { index: false, follow: false },
};

// Shown after the email link to a customer whose registration waits for
// manual review. DRAFT text, for the owner's approval.
export default function PendingApprovalPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6">Профилът ви чака одобрение</h1>
      <div className="flex flex-col gap-4">
        <p>Благодарим ви! Имейлът ви е потвърден.</p>
        <p className="text-secondary">
          Данните на фирмата ще бъдат прегледани от нашия екип. Ще получите
          имейл, когато прегледът приключи. След одобрението ще можете да
          влезете и да виждате цените.
        </p>
        <p>
          <Link href="/" className="underline">
            Към началната страница
          </Link>
        </p>
      </div>
    </main>
  );
}
