// The settings a customer may choose for a model when adding it to an
// inquiry, taken only from the catalog row (nothing is invented):
// - polish / fiber type: one of the variants the catalog lists;
// - fibers: from the standard configuration up to the largest variant, when
//   the catalog gives a larger one.
// Ports have no variants in the catalog data, so they are not a choice.
// Pure functions: used by the product page, the inquiry form and the server.

export type FiberRange = { min: number; max: number };

export type ProductOptions = {
  polish: string[];
  fibers: FiberRange | null;
};

export type OptionSource = {
  polish: string[] | null;
  fibers: number | null;
  maxFibersVariant: number | null;
};

export function fiberRange(p: Pick<OptionSource, "fibers" | "maxFibersVariant">): FiberRange | null {
  if (p.fibers === null || p.maxFibersVariant === null || p.maxFibersVariant <= p.fibers) return null;
  return { min: p.fibers, max: p.maxFibersVariant };
}

export function productOptions(p: OptionSource): ProductOptions {
  return { polish: p.polish ?? [], fibers: fiberRange(p) };
}

// "24–96" when there are variants, else the one number; null when unknown.
export function formatFibers(
  p: Pick<OptionSource, "fibers" | "maxFibersVariant">,
  nf: Intl.NumberFormat,
): string | null {
  if (p.fibers === null) return null;
  const range = fiberRange(p);
  return range ? `${nf.format(range.min)}–${nf.format(range.max)}` : nf.format(p.fibers);
}

export type ChosenOptions = { polish: string | null; fibers: number | null };

// For the admin portal and the admin email (Bulgarian): "SM/APC, 48 влакна".
export function choiceText(c: ChosenOptions): string {
  return [c.polish, c.fibers !== null ? `${c.fibers} влакна` : null].filter(Boolean).join(", ");
}

// Checks a choice against the catalog. A model with one polish variant gets
// it without asking; a model without a fiber range stores no fiber number.
// Returns null when the choice is missing or not offered.
export function resolveOptions(
  options: ProductOptions,
  chosen: { polish?: string | null; fibers?: number | null },
): ChosenOptions | null {
  let polish: string | null = null;
  if (options.polish.length === 1) {
    polish = options.polish[0];
    if (chosen.polish != null && chosen.polish !== polish) return null;
  } else if (options.polish.length > 1) {
    if (chosen.polish == null || !options.polish.includes(chosen.polish)) return null;
    polish = chosen.polish;
  } else if (chosen.polish != null) {
    return null;
  }

  let fibers: number | null = null;
  if (options.fibers) {
    const n = chosen.fibers;
    if (n == null || !Number.isInteger(n) || n < options.fibers.min || n > options.fibers.max) return null;
    fibers = n;
  } else if (chosen.fibers != null) {
    return null;
  }
  return { polish, fibers };
}
