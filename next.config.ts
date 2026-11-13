import type { NextConfig } from "next";
// Next.js's list of bots that need metadata in <head> (internal module, read at build time).
import { HTML_LIMITED_BOT_UA_RE_STRING } from "next/dist/shared/lib/router/utils/is-bot";
import { SECURITY_HEADERS } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  poweredByHeader: false,
  cacheComponents: true,
  // 404 for URLs that match no route; needed because the site has two root layouts (bg, en).
  experimental: { globalNotFound: true },
  partialPrefetching: true,
  // Bots that get title, description and Open Graph in <head> (blocking
  // metadata). Next.js's own list plus link-preview fetchers it lacks (Viber,
  // Telegram, Pinterest). Setting this replaces the built-in list, so it is
  // extended here, not rewritten. Do NOT use /.*/: for a matching user agent
  // Next.js skips the prerendered page shell and renders the whole page.
  htmlLimitedBots: new RegExp(`${HTML_LIMITED_BOT_UA_RE_STRING}|Viber|TelegramBot|Pinterest`, "i"),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
