import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb, tables } from "@/db";
import { isValidSlug } from "@/lib/catalog";
import { seriesName } from "@/lib/series";

// Runs before a product page renders. The page is streamed behind a static
// shell that is sent with status 200, so a missing product cannot become a
// real 404 from inside the page. Here the request is still unanswered, so an
// unknown or unpublished product is sent to a path that does not exist and
// gets a genuine HTTP 404 (instead of a "soft 404").
//
// It is only a status-code check, not access control: the page itself still
// returns nothing for a product that is missing. If the database cannot be
// reached the request is passed on and the page decides.
export async function proxy(request: NextRequest) {
  // Series: a fixed list, so no database is needed to answer 404.
  if (request.nextUrl.pathname.startsWith("/series/")) {
    let key = "";
    try {
      key = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
    } catch {
      // Broken %-sequence: not a series.
    }
    return seriesName(key)
      ? NextResponse.next()
      : NextResponse.rewrite(new URL("/not-found-product", request.url));
  }

  let slug = "";
  try {
    slug = decodeURIComponent(request.nextUrl.pathname.split("/")[2] ?? "");
  } catch {
    // Broken %-sequence in the URL: not a product, answer 404 below.
  }

  let exists = false;
  if (isValidSlug(slug)) {
    try {
      const rows = await getDb()
        .select({ id: tables.products.id })
        .from(tables.products)
        .where(and(eq(tables.products.slug, slug), eq(tables.products.published, true)))
        .limit(1);
      exists = rows.length === 1;
    } catch {
      return NextResponse.next();
    }
  }

  if (!exists) {
    return NextResponse.rewrite(new URL("/not-found-product", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/products/:slug", "/series/:key"],
};
