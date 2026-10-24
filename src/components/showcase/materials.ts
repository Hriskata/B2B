// Layout of the product showcase (the texts live in src/i18n, the numbers in
// the catalog). To change a hotspot, edit its x and y here.
//
// x and y are percentages of the picture (0-100, from the top left), so they
// stay right at every screen size. `label` says where the description sits
// around the picture on a wide screen. An item without x and y has no hotspot
// (a part inside the housing that the picture does not show).
//
// `mask` (optional) is an SVG path in the picture's own coordinates
// (PICTURE.width x PICTURE.height). When present it is drawn over the exact
// outline of the part while the item is active. No masks exist yet, so only a
// local glow around the hotspot is shown; see docs/PLAN.md.
export const SHOWCASE_SKU = "HDS-ODF-001-SC12";
export const PICTURE = { width: 1200, height: 460 } as const;

export type MaterialId =
  "housing" | "adapters" | "door" | "ear" | "pigtails" | "splice";

export type MaterialLayout = {
  id: MaterialId;
  x?: number;
  y?: number;
  label?: "top" | "bottom";
  mask?: string;
};

export const MATERIAL_LAYOUT: MaterialLayout[] = [
  { id: "housing", x: 33, y: 27, label: "top" },
  { id: "door", x: 95.5, y: 39, label: "top" },
  { id: "ear", x: 32.5, y: 71, label: "bottom" },
  { id: "adapters", x: 66.5, y: 48, label: "bottom" },
  { id: "pigtails" },
  { id: "splice" },
];
