import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "vite";

// Creates the test database if needed and applies migrations. Refuses to run
// against a database whose name does not end with "_test", because the tests
// wipe every table.
export default async function setup() {
  // test.env in the Vitest config only reaches the workers, not this process.
  const url = process.env.TEST_DATABASE_URL ?? loadEnv("test", process.cwd(), "").TEST_DATABASE_URL;
  if (!url) return;

  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  if (!dbName.endsWith("_test")) {
    throw new Error(`Refusing to run tests: database "${dbName}" does not end with _test`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const admin = postgres(maintenance.toString(), { max: 1 });
  try {
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) {
      await admin.unsafe(`create database "${dbName.replace(/"/g, "")}"`);
    }
  } finally {
    await admin.end();
  }

  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}
