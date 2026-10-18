import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current";
import { getPricesForSlugs, isValidSlug } from "@/lib/catalog";

const MAX_SLUGS = 50;

// Prices are served ONLY here, never inside a page. The response is private
// and never cached, and only a logged-in, active customer gets it. Guests,
// unverified and blocked accounts all get the same 401 with no price data.
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const slugs = [...new Set(request.nextUrl.searchParams.getAll("slug"))];
  if (slugs.length === 0 || slugs.length > MAX_SLUGS || !slugs.every(isValidSlug)) {
    return Response.json({ error: "bad_request" }, { status: 400, headers });
  }

  return Response.json({ prices: await getPricesForSlugs(slugs) }, { headers });
}
