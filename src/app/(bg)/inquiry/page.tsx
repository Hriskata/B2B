import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current";
import { listPublicProducts } from "@/lib/catalog";
import { productOptions } from "@/lib/product-options";
import { InquiryForm } from "./inquiry-form";

export const metadata: Metadata = {
  title: "Запитване",
  robots: { index: false, follow: false },
};

// Phase 4: the inquiry form. Only a logged-in, active customer may open it
// (the check is on the server, again in the action). ?product=<slug> from the
// product page adds that product to the list.
export default function InquiryPage({ searchParams }: PageProps<"/inquiry">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/inquiry">["searchParams"] }) {
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
  const products = (await listPublicProducts()).map((p) => ({
    slug: p.slug,
    name: p.name,
    options: productOptions(p),
  }));
  const { product } = await searchParams;
  return (
    <>
      <h1>Запитване</h1>
      <p className="mt-3 mb-8 text-secondary">
        Изберете продуктите, настройките им и бройките. Цената се договаря след запитването.
      </p>
      <InquiryForm
        products={products}
        initialSlug={typeof product === "string" ? product : null}
        defaultName={user.fullName ?? ""}
      />
    </>
  );
}
