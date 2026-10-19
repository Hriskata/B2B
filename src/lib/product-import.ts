import { z } from "zod";

// Parsing and checking of the ODFFiber catalog file (docs/products.json).
// Pure functions (no database, no server-only), so the import script and the
// tests share them. The file's `issues` are notes for the owner and are never
// part of the imported data: they only go to docs/TODO-DATA.md.

export const SERIES_KEYS = ["hds", "uds", "quick-fit", "mpo"] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];

const intOrNull = z.number().int().positive().nullable();

const fileProductSchema = z.object({
  sku: z.string().regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
  catalog_sku: z.string().min(1),
  series: z.enum(SERIES_KEYS),
  name: z.string().min(1).max(120),
  connector: z.string().min(1),
  ports: z.number().int().positive(),
  mpo_ports: intOrNull,
  fibers: z.number().int().positive(),
  max_fibers_variant: intOrNull,
  rack_units: z.number().int().positive(),
  fibers_per_ru: z.number().positive(),
  polish: z.array(z.string().min(1)).min(1),
  splice: z.boolean(),
  front_door: z.boolean().nullable(),
  catalog_page: z.number().int().positive().nullable(),
  issues: z.array(z.string()),
});

const fileSchema = z.object({ products: z.array(fileProductSchema).min(1) });

export type ImportProduct = {
  sku: string;
  slug: string;
  name: string;
  description: string;
  series: SeriesKey;
  connector: string;
  ports: number;
  mpoPorts: number | null;
  fibers: number;
  maxFibersVariant: number | null;
  rackUnits: number;
  polish: string[];
  splice: boolean;
  frontDoor: boolean | null;
  catalogPage: number | null;
  sortOrder: number;
};

export type ImportIssue = { sku: string; catalogSku: string; issues: string[] };

// Short factual text built only from the numbers in the file. The owner's
// real descriptions replace it later.
export function describeProduct(p: {
  connector: string;
  ports: number;
  mpoPorts: number | null;
  fibers: number;
  rackUnits: number;
}): string {
  const mpo = p.mpoPorts ? `, ${p.mpoPorts} MPO порта` : "";
  return `Оптичен панел (ODF), ${p.rackUnits}RU: ${p.ports} ${p.connector} порта${mpo} / ${p.fibers} влакна.`;
}

export function fibersPerRackUnit(fibers: number, rackUnits: number): number {
  return fibers / rackUnits;
}

export function parseProductsFile(raw: unknown): { products: ImportProduct[]; issues: ImportIssue[] } {
  const file = fileSchema.parse(raw);
  const seen = new Set<string>();
  const products: ImportProduct[] = [];
  const issues: ImportIssue[] = [];

  file.products.forEach((p, index) => {
    if (seen.has(p.sku)) throw new Error(`Duplicate SKU: ${p.sku}`);
    seen.add(p.sku);
    const expected = fibersPerRackUnit(p.fibers, p.rack_units);
    if (Math.abs(expected - p.fibers_per_ru) > 1e-9) {
      throw new Error(`${p.sku}: fibers_per_ru is ${p.fibers_per_ru}, expected ${expected}`);
    }
    if (p.max_fibers_variant !== null && p.max_fibers_variant < p.fibers) {
      throw new Error(`${p.sku}: max_fibers_variant is below fibers`);
    }
    products.push({
      sku: p.sku,
      slug: p.sku.toLowerCase(),
      name: p.name,
      description: describeProduct({
        connector: p.connector,
        ports: p.ports,
        mpoPorts: p.mpo_ports,
        fibers: p.fibers,
        rackUnits: p.rack_units,
      }),
      series: p.series,
      connector: p.connector,
      ports: p.ports,
      mpoPorts: p.mpo_ports,
      fibers: p.fibers,
      maxFibersVariant: p.max_fibers_variant,
      rackUnits: p.rack_units,
      polish: p.polish,
      splice: p.splice,
      frontDoor: p.front_door,
      catalogPage: p.catalog_page,
      sortOrder: (index + 1) * 10,
    });
    if (p.issues.length > 0) issues.push({ sku: p.sku, catalogSku: p.catalog_sku, issues: p.issues });
  });
  return { products, issues };
}

// Markdown for docs/TODO-DATA.md, generated from the file's `issues`.
export function renderTodoData(issues: ImportIssue[], date: string): string {
  const lines = [
    "# TODO-DATA: какво трябва да потвърди собственикът",
    "",
    `Генерирано от docs/products.json (${date}). Не се показва на сайта. Когато нещо се реши, отбележете го с [x].`,
    "",
  ];
  for (const item of issues) {
    lines.push(`## ${item.sku}${item.catalogSku !== item.sku ? ` (в каталога: ${item.catalogSku})` : ""}`);
    for (const text of item.issues) lines.push(`- [ ] ${text}`);
    lines.push("");
  }
  lines.push(
    "## Общи липсващи данни",
    "- [ ] Материал: алуминий или стомана / алуминий",
    "- [ ] Цвят: черен или сив (рендерите са сиви)",
    "- [ ] IL/RL, размери, тегло, клас на влакното (G.652D / G.657A1), MPO полярност и тип",
    "- [ ] Гаранция и сертификати",
    "- [ ] Фирмени контакти",
    "- [ ] Обобщената таблица в каталога изброява само 1/2/3RU, а има модели с 4RU и 6RU",
    "",
  );
  return lines.join("\n");
}
