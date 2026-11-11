import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditEntries, AuditTabs } from "./audit-view";

export const metadata: Metadata = { title: "Журнал: ръчни промени (админ)" };

export default function AdminAuditPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-6">Журнал на промените</h1>
      <AuditTabs current="portal" />
      <Suspense>
        <AuditEntries source="portal" />
      </Suspense>
    </main>
  );
}
