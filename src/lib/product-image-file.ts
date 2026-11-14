import { existsSync } from "node:fs";
import path from "node:path";

// Product renders live in public/images/products/<sku in lower case>.webp
// (made by scripts/extract-product-images.py from the owner's catalog).
const IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");
const SAFE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// The file name of a model's render, or null when there is none. Only plain
// names: the SKU comes from the database, but it must never reach the file
// system as a path.
export function productImageName(sku: string | null): string | null {
  if (!sku) return null;
  const name = sku.toLowerCase();
  if (!SAFE_NAME.test(name)) return null;
  return existsSync(path.join(IMAGE_DIR, `${name}.webp`)) ? `${name}.webp` : null;
}

export function productImagePath(name: string): string {
  return path.join(IMAGE_DIR, name);
}

// Public address of a model's render ("/images/products/<name>.webp"), or null.
export function productImageSrc(sku: string | null): string | null {
  const name = productImageName(sku);
  return name ? `/images/products/${name}` : null;
}
