// Crawls a running site AS A GUEST (no cookies) and fails if any response
// contains something that looks like a price (checklist A).
//
//   npm run check:guest-prices                      (default http://localhost:3200)
//   BASE_URL=https://staging.example.bg npm run check:guest-prices
//
// It also fails if it finds no products at all, so an empty catalog cannot
// make the check pass by accident.

const BASE = (process.env.BASE_URL ?? "http://localhost:3200").replace(/\/$/, "");

// An amount next to a currency, or a price-like key in JSON.
const PRICE_PATTERNS: [string, RegExp][] = [
  ["amount followed by currency", /\d[\d\s .,]*\s?(€|EUR|лв\.?|BGN)/i],
  ["currency followed by amount", /(€|EUR|лв\.?|BGN)\s?\d/i],
  ["price key in data", /["'](amount|amountCents|price|priceCents|offers?|lowPrice|highPrice)["']\s*:/i],
  ["schema.org offer", /schema\.org\/(Offer|AggregateOffer)/i],
  ["og/meta price tag", /(product:price|og:price)/i],
];

type Finding = { url: string; pattern: string; sample: string };
const findings: Finding[] = [];
const checked: string[] = [];

async function get(path: string, init?: RequestInit) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: "manual", cache: "no-store", ...init });
  return { url, res, body: await res.text() };
}

function scan(url: string, body: string) {
  checked.push(url);
  for (const [name, pattern] of PRICE_PATTERNS) {
    const match = pattern.exec(body);
    if (match) {
      const start = Math.max(0, match.index - 30);
      findings.push({ url, pattern: name, sample: body.slice(start, match.index + 60).replace(/\s+/g, " ") });
    }
  }
}

async function main() {
  const home = await get("/");
  if (home.res.status !== 200) throw new Error(`GET / returned ${home.res.status}`);
  scan(home.url, home.body);

  const links = [...new Set([...home.body.matchAll(/href="(\/products\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
  if (links.length === 0) throw new Error("No product links found on the home page.");

  for (const link of links) {
    const page = await get(link);
    if (page.res.status !== 200) throw new Error(`GET ${link} returned ${page.res.status}`);
    scan(page.url, page.body);
  }

  for (const path of ["/sitemap.xml", "/robots.txt"]) {
    const doc = await get(path);
    if (doc.res.status !== 200) throw new Error(`GET ${path} returned ${doc.res.status}`);
    scan(doc.url, doc.body);
  }
  const sitemap = await get("/sitemap.xml");
  const listed = (sitemap.body.match(/\/products\//g) ?? []).length;
  if (listed !== links.length) {
    throw new Error(`Sitemap lists ${listed} products, the home page shows ${links.length}.`);
  }

  // The price endpoint must refuse a guest with no price data.
  const slugs = links.map((l) => `slug=${l.split("/").pop()}`).join("&");
  const api = await get(`/api/prices?${slugs}`);
  scan(api.url, api.body);
  if (api.res.status !== 401) {
    findings.push({ url: api.url, pattern: `expected 401 for a guest, got ${api.res.status}`, sample: api.body.slice(0, 80) });
  }
  const cacheControl = api.res.headers.get("cache-control") ?? "";
  if (!/no-store/.test(cacheControl) || !/private/.test(cacheControl)) {
    findings.push({ url: api.url, pattern: "price endpoint is cacheable", sample: `Cache-Control: ${cacheControl}` });
  }

  console.log(`Checked ${checked.length} responses, ${links.length} products, as a guest at ${BASE}.`);
  if (findings.length > 0) {
    console.error(`FAIL: ${findings.length} finding(s):`);
    for (const f of findings) console.error(`- ${f.url} [${f.pattern}] ...${f.sample}...`);
    process.exit(1);
  }
  console.log("OK: no price data found in guest responses.");
}

main().catch((error: unknown) => {
  console.error("Check could not run:", error instanceof Error ? error.message : error);
  process.exit(2);
});
