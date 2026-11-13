import Image from "next/image";
import { productImageName } from "@/lib/product-image-file";

// A model without a render keeps the grey placeholder, so the layout is the same.
function imageSrc(sku: string | null): string | null {
  const name = productImageName(sku);
  return name ? `/images/products/${name}` : null;
}

// Card width by default; the product page passes its own, wider value so the
// browser does not fetch a picture smaller than the slot.
const CARD_SIZES = "(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw";

export function ProductImage({
  sku = null,
  alt = "",
  priority = false,
  className = "",
  sizes = CARD_SIZES,
  placeholder,
}: {
  sku?: string | null;
  alt?: string;
  priority?: boolean;
  className?: string;
  sizes?: string;
  // Text of the grey tile when there is no picture, in the page language.
  placeholder: string;
}) {
  const src = imageSrc(sku);
  const frame = `relative aspect-[4/3] w-full overflow-hidden ${className}`;
  if (!src) {
    return (
      <div
        aria-hidden
        className={`${frame} flex items-center justify-center bg-raised text-sm text-muted`}
      >
        <span>{placeholder}</span>
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
        sizes={sizes}
        className="object-contain p-2"
      />
    </div>
  );
}
