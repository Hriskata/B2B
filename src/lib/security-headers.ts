// Response headers sent on every page (checklist E). Kept in one module so
// next.config.ts and the test use the same list.
//
// Not included on purpose:
// - Strict-Transport-Security: only meaningful over https; it is set by the
//   hosting or the reverse proxy once the domain exists (phase 7).
// - A script-src Content-Security-Policy: Next.js inline scripts need a
//   per-request nonce, which is a separate task. The directives below do not
//   restrict scripts, so they cannot break the site.
export const SECURITY_HEADERS: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nobody may put the site or the admin portal in a frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];
