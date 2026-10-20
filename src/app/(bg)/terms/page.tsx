import type { Metadata } from "next";
import { PendingLegal } from "@/components/pending-legal";

// Not indexed until the real text exists.
export const metadata: Metadata = { title: "Общи условия", robots: { index: false, follow: true } };

export default function TermsPage() {
  return <PendingLegal title="Общи условия" />;
}
