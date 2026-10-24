// Checks a server environment file before it is used.
//
//   npm run check:env -- --kind production --file .env.production [--other .env.staging]
//
// Fails (exit 1) when the file carries test settings (localhost, Mailpit,
// Cloudflare test keys, 2FA switched off, weak or missing secrets), or when a
// secret is the same as in the other environment. Prints variable names only,
// never values.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { checkEnvironment, type EnvKind } from "../src/lib/env-check";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const kind = arg("kind");
const file = arg("file");
const otherFile = arg("other");
if ((kind !== "staging" && kind !== "production") || !file) {
  console.error("Usage: npm run check:env -- --kind <staging|production> --file <path> [--other <path>]");
  process.exit(2);
}

const env = parseEnv(readFileSync(file, "utf8"));
const other = otherFile ? parseEnv(readFileSync(otherFile, "utf8")) : undefined;
const problems = checkEnvironment(kind as EnvKind, env, other);

if (problems.length === 0) {
  console.log(`OK: ${file} looks like a ${kind} environment${other ? " and shares no secret with the other one" : ""}.`);
} else {
  console.error(`FAIL: ${problems.length} problem(s) in ${file}:`);
  for (const p of problems) console.error(`- ${p.variable}: ${p.message}`);
  process.exit(1);
}
