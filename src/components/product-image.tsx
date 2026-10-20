import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

// Product renders live in public/images/products/<sku in lower case>.webp
// (made by scripts/extract-product-images.py from the owner's catalog).
// A model without a file keeps the grey placeholder, so the layout is the same.
const IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function imageSrc(sku: string | null): string | null {
  if (!sku) return null;
  const name = sku.toLowerCase();
  // Only plain names: the SKU comes from the database, but it must never
  // reach the file system as a path.
  if (!SAFE_NAME.test(name)) return null;
  return existsSync(path.join(IMAGE_DIR, `${name}.webp`))
    ? `/images/products/${name}.webp`
    : null;
}

export function ProductImage({
  sku = null,
  alt = "",
  priority = false,
  className = "",
}: {
  sku?: string | null;
  alt?: string;
  priority?: boolean;
  className?: string;
}) {
  const src = imageSrc(sku);
  const frame = `relative aspect-[4/3] w-full overflow-hidden ${className}`;
  if (!src) {
    return (
      <div
        aria-hidden
        className={`${frame} flex items-center justify-center bg-raised text-sm text-muted`}
      >
        <span>Снимка</span>
      </div>
    );
  }
  // The renders are opaque on a white background, so they sit in a light, rounded tile.
  return (
    <div className={`${frame} image-tile`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
        className="object-contain p-2"
      />
    </div>
  );
}
