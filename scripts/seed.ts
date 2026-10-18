// Fills the TEST environment with sample catalog data (10 products with
// prices). Names and texts are placeholders, clearly marked as samples.
//
//   npm run db:seed
//
// Safe to run again: existing products are left as they are. It refuses to
// run unless APP_URL is localhost, so it cannot fill a real database.
import { createDb } from "../src/db/create";
import { productPrices, products } from "../src/db/schema";

const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

const SAMPLE_TEXT =
  "Примерно описание на продукта. Текстът е временен и ще бъде заменен с описанието от собственика на продукта.";

// Prices in euro cents, for ONE unit.
const SAMPLES = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return {
    slug: `primeren-produkt-${n}`,
    name: `Примерен продукт ${n}`,
    description: SAMPLE_TEXT,
    sortOrder: i + 1,
    amountCents: 1250 + i * 475,
  };
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use the .env file).");
    process.exit(1);
  }
  if (!LOCAL_URL.test(process.env.APP_URL ?? "")) {
    console.error("Refusing to seed: APP_URL is not http://localhost or http://127.0.0.1.");
    process.exit(1);
  }

  const { db, client } = createDb(url, { max: 1 });
  try {
    let created = 0;
    for (const sample of SAMPLES) {
      const [row] = await db
        .insert(products)
        .values({
          slug: sample.slug,
          name: sample.name,
          description: sample.description,
          sortOrder: sample.sortOrder,
        })
        .onConflictDoNothing({ target: products.slug })
        .returning({ id: products.id });
      if (row) {
        await db.insert(productPrices).values({ productId: row.id, amountCents: sample.amountCents });
        created++;
      }
    }
    console.log(`Sample products: ${created} created, ${SAMPLES.length - created} already existed.`);
  } finally {
    await client.end();
  }
}

void main();
