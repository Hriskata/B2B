import { describe, expect, it } from "vitest";
import { choiceText, fiberRange, formatFibers, productOptions, resolveOptions } from "./product-options";

const nf = new Intl.NumberFormat("bg-BG");

describe("fibers on one line", () => {
  it("shows the standard configuration up to the largest variant", () => {
    expect(formatFibers({ fibers: 24, maxFibersVariant: 96 }, nf)).toBe("24–96");
  });

  it("shows one number when there is no larger variant or it is not known", () => {
    expect(formatFibers({ fibers: 144, maxFibersVariant: 144 }, nf)).toBe("144");
    expect(formatFibers({ fibers: 48, maxFibersVariant: null }, nf)).toBe("48");
    expect(formatFibers({ fibers: null, maxFibersVariant: 96 }, nf)).toBeNull();
    // A largest variant below the standard one is not a range.
    expect(fiberRange({ fibers: 96, maxFibersVariant: 48 })).toBeNull();
  });
});

describe("checking the chosen settings against the catalog", () => {
  const several = productOptions({ polish: ["SM/UPC", "SM/APC"], fibers: 12, maxFibersVariant: 48 });

  it("accepts a polish the model has and a fiber count in the range", () => {
    expect(resolveOptions(several, { polish: "SM/APC", fibers: 12 })).toEqual({ polish: "SM/APC", fibers: 12 });
    expect(resolveOptions(several, { polish: "SM/UPC", fibers: 48 })).toEqual({ polish: "SM/UPC", fibers: 48 });
  });

  it("refuses a missing or unknown polish and a fiber count outside the range or not whole", () => {
    for (const chosen of [
      { polish: null, fibers: 12 },
      { polish: "MM/UPC", fibers: 12 },
      { polish: "SM/APC", fibers: 11 },
      { polish: "SM/APC", fibers: 49 },
      { polish: "SM/APC", fibers: 12.5 },
      { polish: "SM/APC", fibers: null },
    ]) {
      expect(resolveOptions(several, chosen)).toBeNull();
    }
  });

  it("gives the only polish without asking; a model without choices takes none", () => {
    const one = productOptions({ polish: ["MPO/MTP SM"], fibers: 576, maxFibersVariant: 576 });
    expect(resolveOptions(one, {})).toEqual({ polish: "MPO/MTP SM", fibers: null });
    expect(resolveOptions(one, { polish: "MPO/MTP MM" })).toBeNull();
    expect(resolveOptions(one, { fibers: 576 })).toBeNull();

    const none = productOptions({ polish: null, fibers: null, maxFibersVariant: null });
    expect(resolveOptions(none, {})).toEqual({ polish: null, fibers: null });
    expect(resolveOptions(none, { polish: "SM/UPC" })).toBeNull();
  });

  it("describes a choice for the admins", () => {
    expect(choiceText({ polish: "SM/APC", fibers: 48 })).toBe("SM/APC, 48 влакна");
    expect(choiceText({ polish: null, fibers: null })).toBe("");
  });
});
