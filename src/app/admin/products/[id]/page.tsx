import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAdminProduct } from "@/lib/admin/products";
import { requireAdmin } from "@/lib/auth/current";
import { centsToInput } from "@/lib/money";
import { can } from "@/lib/permissions";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Продукт (админ)" };

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/admin/products/[id]">["params"] }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">{product.name}</h1>
      <ProductForm
        canEdit={can(admin.role, "edit_catalog")}
        initial={{
          id: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          sortOrder: String(product.sortOrder),
          price: product.priceCents === null ? "" : centsToInput(product.priceCents),
          published: product.published,
        }}
      />
    </>
  );
}
