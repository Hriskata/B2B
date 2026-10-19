// Imports the ODFFiber models from docs/products.json into the database.
//
//   npm run db:import-products [-- --file path] [--remove-samples] [--write-todo]
//
// Safe to run again: models are matched by SKU and updated. Names and short
// texts of existing models are NOT overwritten (an admin may have edited
// them); only the technical data is refreshed. Prices are never touched.
// --remove-samples deletes the 10 sample products from `npm run db:seed`
// (local only). --write-todo writes docs/TODO-DATA.md from the file's issues.
import { readFileSync, writeFileSync } from "node:fs";
import { inArray, like } from "drizzle-orm";
import { createDb } from "../src/db/create";
import { products } from "../src/db/schema";
import { parseProductsFile, renderTodoData } from "../src/lib/product-import";

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : (process.argv[i + 1] ?? "");
}
const has = (name: string) => process.argv.includes(name);

async function main() {
  const file = arg("--file") || "docs/products.json";
  const parsed = parseProductsFile(JSON.parse(readFileSync(file, "utf8")));

  if (has("--write-todo")) {
    writeFileSync("docs/TODO-DATA.md", renderTodoData(parsed.issues, new Date().toISOString().slice(0, 10)));
    console.log(`docs/TODO-DATA.md written (${parsed.issues.length} models with notes).`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use the .env file).");
    process.exit(1);
  }
  const { db, client } = createDb(url, { max: 1 });
  try {
    if (has("--remove-samples")) {
      if (!LOCAL_URL.test(process.env.APP_URL ?? "")) {
        console.error("Refusing to remove samples: APP_URL is not http://localhost or http://127.0.0.1.");
        process.exit(1);
      }
      const removed = await db
        .delete(products)
        .where(like(products.slug, "primeren-produkt-%"))
        .returning({ id: products.id });
      console.log(`Sample products removed: ${removed.length}.`);
    }

    const existing = await db
      .select({ sku: products.sku })
      .from(products)
      .where(
        inArray(
          products.sku,
          parsed.products.map((p) => p.sku),
        ),
      );
    const known = new Set(existing.map((r) => r.sku));

    for (const p of parsed.products) {
      const specs = {
        series: p.series,
        connector: p.connector,
        ports: p.ports,
        mpoPorts: p.mpoPorts,
        fibers: p.fibers,
        maxFibersVariant: p.maxFibersVariant,
        rackUnits: p.rackUnits,
        polish: p.polish,
        splice: p.splice,
        frontDoor: p.frontDoor,
        catalogPage: p.catalogPage,
        updatedAt: new Date(),
      };
      await db
        .insert(products)
        .values({
          sku: p.sku,
          slug: p.slug,
          name: p.name,
          description: p.description,
          sortOrder: p.sortOrder,
          ...specs,
        })
        .onConflictDoUpdate({ target: products.sku, set: specs });
    }
    console.log(`Models: ${parsed.products.length - known.size} created, ${known.size} updated.`);
    console.log("Restart the app (or wait for the cache) to see the changes.");
  } finally {
    await client.end();
  }
}

void main();
