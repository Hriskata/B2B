import type { Metadata } from "next";
import { PendingLegal } from "@/components/pending-legal";

export const metadata: Metadata = {
  title: "Политика за поверителност",
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return <PendingLegal title="Политика за поверителност" />;
}
