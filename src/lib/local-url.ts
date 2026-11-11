// The one test for "this app runs on the developer's own computer". Pure (no
// server-only), so the scripts can use it too. A security boundary: local-only
// switches (2FA off, seed data, test accounts, the dev journal) all use it.
const LOCAL_URL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;

export function isLocalAppUrl(url: string | undefined): boolean {
  return LOCAL_URL.test(url ?? "");
}
