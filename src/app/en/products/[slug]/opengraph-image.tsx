import { connection } from "next/server";
import { getDict } from "@/i18n";
import { OG_CONTENT_TYPE, OG_SIZE, productOgResponse } from "@/lib/og-image";

// The picture shown when this product page is shared. No price in it.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = getDict("en").og.productAlt;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  // The catalog is in the database, which is not there at build time.
  await connection();
  return productOgResponse((await params).slug, "en");
}
