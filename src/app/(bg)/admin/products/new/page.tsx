import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/current";
import { can } from "@/lib/permissions";
import { EMPTY_SPECS, ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Нов продукт (админ)" };

export default function NewProductPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 py-8">
      <h1 className="mb-6">Нов продукт</h1>
      <Suspense>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const admin = await requireAdmin();
  if (!can(admin.role, "edit_catalog")) {
    return <p>Нямате право да добавяте продукти.</p>;
  }
  return (
    <ProductForm
      canEdit
      initial={{
        slug: "",
        name: "",
        description: "",
        descriptionEn: "",
        sortOrder: "0",
        price: "",
        published: true,
        ...EMPTY_SPECS,
      }}
    />
  );
}
