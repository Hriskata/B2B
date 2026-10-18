import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";

const noStore = { "Cache-Control": "no-store" };

// Liveness + database check for the container healthcheck.
// The response never carries error details.
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" }, { headers: noStore });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ status: "error" }, { status: 503, headers: noStore });
  }
}
