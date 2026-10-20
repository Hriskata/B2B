import type { Metadata } from "next";
import { Suspense } from "react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { requireAdmin } from "@/lib/auth/current";

export const metadata: Metadata = { title: "Регистрации (админ)" };

// Phase 2/5: registrations waiting for manual review, with "Одобри" and
// "Отхвърли" (editor only). Empty until the company check exists.
export default function AdminRegistrationsPage() {
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
      title="Чакащи регистрации"
      phase="фаза 2"
      waitingFor={[
        "ключ за CompanyBook и тест с реални фирми",
        "решение какво става с неактивна фирма",
        "решение за правомощията и за несъвпадащо име на фирма",
        "одобрение на текстовете към клиента при одобрение и отхвърляне",
      ]}
    />
  );
}
