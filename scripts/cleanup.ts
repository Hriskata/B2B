// Deletes expired sessions, finished rate-limit windows and old email tokens.
//
//   npm run db:cleanup
//
// Safe to run any time and as often as you like. It never touches customers,
// admins, products or the audit journal.
import { createDb } from "../src/db/create";
import { cleanupExpired } from "../src/lib/cleanup";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (use the .env file).");
    process.exit(1);
  }
  const { db, client } = createDb(url, { max: 1 });
  try {
    const result = await cleanupExpired(db);
    console.log(
      `Removed: ${result.sessions} sessions, ${result.rateLimits} rate-limit windows, ${result.emailTokens} email tokens.`,
    );
  } finally {
    await client.end();
  }
}

void main();
