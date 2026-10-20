import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlaceholderPage } from "@/components/placeholder-page";
import { getCurrentUser } from "@/lib/auth/current";

export const metadata: Metadata = {
  title: "Запитване",
  robots: { index: false, follow: false },
};

// Phase 4: the inquiry form. Only a logged-in, active customer may open it
// (the check is on the server). The form itself waits for decisions.
export default function InquiryPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <>
        <h1>Запитване</h1>
        <p className="mt-4">
          За да изпратите запитване, първо{" "}
          <Link href="/login" className="underline">
            влезте
          </Link>{" "}
          в профила си.
        </p>
      </>
    );
  }
  return (
    <PlaceholderPage
      title="Запитване"
      phase="фаза 4"
      waitingFor={[
        "минимумът от 3 броя: общо за запитването или на продукт",
        "може ли едно запитване да съдържа няколко продукта",
        "получатели на запитването: всички админи или по продукт",
        "какво е „бройка“ и каква цена се показва",
      ]}
    />
  );
}
