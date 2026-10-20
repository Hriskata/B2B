"""Extracts the product renders from the owner's PDF catalog into WebP files.

    python scripts/extract-product-images.py --pdf <catalog.pdf> [--out public/images/products]

Needs PyMuPDF and Pillow (pip install pymupdf pillow). The PDF is read from
the path you give and is never copied into the repository. Each model's page
is docs/products.json "catalog_page" (0-based index of the PDF page); the
largest picture on the page that is not part of the repeated header/footer is
the product render. Files are named by lower-case SKU, flattened on white,
at most 1200 px wide (never enlarged), WebP.
"""
import argparse
import io
import json
import os
import sys

import pymupdf
from PIL import Image

# Pictures repeated on every product page (banner, logos, icons).
REPEATED = {(2489, 241), (2490, 241), (2487, 241), (497, 158), (164, 130), (138, 89)}
MAX_WIDTH = 1200


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--products", default="docs/products.json")
    ap.add_argument("--out", default="public/images/products")
    args = ap.parse_args()

    doc = pymupdf.open(args.pdf)
    with open(args.products, encoding="utf-8") as f:
        products = json.load(f)["products"]
    os.makedirs(args.out, exist_ok=True)

    missing = 0
    for p in products:
        page = doc[p["catalog_page"]]
        candidates = [im for im in page.get_images(full=True) if (im[2], im[3]) not in REPEATED]
        if not candidates:
            print("NO IMAGE", p["sku"])
            missing += 1
            continue
        im = max(candidates, key=lambda i: i[2] * i[3])
        pix = pymupdf.Pixmap(doc, im[0])
        if im[1]:
            pix = pymupdf.Pixmap(pix, pymupdf.Pixmap(doc, im[1]))
        if pix.colorspace and pix.colorspace.n > 3:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGBA")
        flat = Image.new("RGBA", img.size, (255, 255, 255, 255))
        flat.alpha_composite(img)
        img = flat.convert("RGB")
        if img.width > MAX_WIDTH:
            img = img.resize((MAX_WIDTH, round(img.height * MAX_WIDTH / img.width)), Image.LANCZOS)
        path = os.path.join(args.out, p["sku"].lower() + ".webp")
        img.save(path, "WEBP", quality=82, method=6)
        print(f'{p["sku"]}: {img.width}x{img.height}, {os.path.getsize(path) // 1024} KB')
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
