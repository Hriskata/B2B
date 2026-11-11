// Checks the database migrations in drizzle/ for changes that would break the
// previous version of the code (docs/ENVIRONMENTS.md, "Migrations").
//
//   npm run check:migrations
//
// Fails (exit 1) on a migration after the first production launch that
// renames, drops or tightens something without a "-- contract: <reason>"
// note. Before the launch the same findings are printed as warnings.
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkMigrations, LAST_PRELAUNCH_MIGRATION, type Finding } from "../src/lib/migration-check";

const dir = path.join(process.cwd(), "drizzle");
const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string; when: number }[];
};
const migrations = journal.entries.map(({ tag, when }) => ({
  tag,
  when,
  sql: readFileSync(path.join(dir, `${tag}.sql`), "utf8"),
}));

const { errors, warnings } = checkMigrations(migrations);
const show = (f: Finding) => `- ${f.migration}.sql:${f.line}: ${f.rule}: ${f.statement}`;

if (warnings.length > 0) {
  console.log(
    LAST_PRELAUNCH_MIGRATION === null
      ? `Note: ${warnings.length} change(s) that will not be allowed after the first launch (allowed now):`
      : `Note: ${warnings.length} change(s) allowed by a "-- contract:" note:`,
  );
  for (const f of warnings) console.log(show(f));
}
if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} unsafe change(s). Split them into expand / contract releases, or mark a contract step with "-- contract: <reason>":`);
  for (const f of errors) console.error(show(f));
  process.exit(1);
}
console.log(`OK: ${migrations.length} migration(s) checked.`);
