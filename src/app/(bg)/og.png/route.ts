import { siteOgResponse } from "@/lib/og-image";

// The shared-link picture of the site (product pages have their own). A
// fixed address, so every page can point at it. No database and no price.
export async function GET() {
  return siteOgResponse("bg");
}
