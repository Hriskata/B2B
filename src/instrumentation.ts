// Runs once when the server starts, before it takes requests. Checks the
// environment here, so a bad configuration (for example ADMIN_2FA_DISABLED
// outside localhost) stops the start instead of failing on the first request.
export async function register() {
  // Not during `next build` (the build has no secrets) and not on the edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { getEnv } = await import("./lib/env");
  getEnv();
}
