import "server-only";
import { createDb, type Db } from "./create";

// Reuse one pool across dev hot reloads instead of opening a new one per reload.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    globalForDb.db = createDb(url).db;
  }
  return globalForDb.db;
}

export * as tables from "./schema";
export type { Db };
