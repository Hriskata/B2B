// Finds database migrations that would break the previous version of the
// code (docs/ENVIRONMENTS.md, "Migrations"). After the first production
// launch a migration may only add things; renaming, dropping or tightening is
// done in separate releases (expand / contract) and each such statement must
// have a "-- contract: <reason>" comment line right before it.

// The last migration applied before the first production launch. Set it at
// launch (launch checklist). Until then (null) every finding is only a
// warning, because there is no old version to go back to.
export const LAST_PRELAUNCH_MIGRATION: string | null = null;

export type Finding = {
  migration: string;
  line: number;
  rule: string;
  statement: string;
  // A "-- contract: <reason>" line stands right before this statement.
  contract: boolean;
};

// Marks a $$ ... $$ block in the masked code (see maskSql).
const CODE_BLOCK = "\u0000";

// A table name, plain or "quoted", with an optional schema.
const NAME = String.raw`(?:"[^"]*"|\w+)(?:\.(?:"[^"]*"|\w+))?`;

// Rules see a statement in upper case, with comments, string literals and
// the contents of quoted identifiers blanked out (see maskSql), so text inside
// them can neither trigger nor hide a rule. createdHere: tables created by an
// earlier statement of the same migration. named: the same statement with the
// quoted names written out again (only to read table names, never keywords).
type Rule = {
  name: string;
  test: (sql: string, named: string, createdHere: Set<string>) => boolean;
};

// Clauses of one ALTER TABLE ("ADD COLUMN a ..., ADD COLUMN b ...").
function clauses(statement: string): string[] {
  return statement.split(/,(?=\s*(?:ADD|ALTER|DROP|RENAME)\b)/);
}

// A NOT NULL column that fills itself: default, serial or identity/generated.
function fillsItself(clause: string): boolean {
  return /\b(DEFAULT|SMALLSERIAL|BIGSERIAL|SERIAL|GENERATED)\b/.test(clause);
}

const RULES: Rule[] = [
  { name: "renames a table or column", test: (s) => /\bRENAME\b/.test(s) },
  {
    name: "drops something (DROP NOT NULL is allowed)",
    test: (s) => /\bDROP\b/.test(s.replace(/\bDROP\s+NOT\s+NULL\b/g, "")),
  },
  {
    name: "changes the type of a column",
    // ALTER [COLUMN] <name> [SET DATA] TYPE; a column named "type" is fine.
    test: (s) => /\bALTER\s+(COLUMN\s+)?("[^"]+"|\w+)\s+(SET\s+DATA\s+)?TYPE\b/.test(s),
  },
  { name: "makes a column required (SET NOT NULL)", test: (s) => /\bSET\s+NOT\s+NULL\b/.test(s) },
  {
    name: "adds a required column without a default",
    test: (s) =>
      /^ALTER\s+TABLE\b/.test(s) &&
      clauses(s).some(
        (c) => /\bADD\s+COLUMN\b/.test(c) && /\bNOT\s+NULL\b/.test(c) && !fillsItself(c),
      ),
  },
  { name: "deletes data", test: (s) => /\b(TRUNCATE|DELETE\s+FROM)\b/.test(s) },
  { name: "moves an object to another schema", test: (s) => /\bSET\s+SCHEMA\b/.test(s) },
  {
    // Existing rows may fail it (the migration then stops the start) and the
    // old code may break it. Fine on a table created in the same migration.
    name: "adds a constraint or unique index to an existing table",
    test: (s, named, createdHere) => {
      if (/^CREATE\s+UNIQUE\s+INDEX\b/.test(s)) {
        const table = new RegExp(String.raw`\bON\s+(?:ONLY\s+)?(${NAME})`).exec(named)?.[1];
        return !table || !createdHere.has(table);
      }
      const table = new RegExp(
        String.raw`^ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?(${NAME})`,
      ).exec(named)?.[1];
      if (table === undefined || createdHere.has(table)) return false;
      if (/\bADD\s+(CONSTRAINT\b|UNIQUE\b|CHECK\b|EXCLUDE\b|FOREIGN\s+KEY\b|PRIMARY\s+KEY\b)/.test(s)) {
        return true;
      }
      // Also written inside the new column (PRIMARY KEY there is only possible
      // on a column that fills itself, see the required-column rule).
      return clauses(s).some(
        (c) => /\bADD\s+COLUMN\b/.test(c) && /\b(UNIQUE|CHECK|REFERENCES)\b/.test(c),
      );
    },
  },
  {
    name: "contains a code block ($$ ... $$) the check cannot read",
    test: (s) => s.includes(CODE_BLOCK),
  },
];

// The reason must be on the same line as the marker.
const CONTRACT_NOTE = /^[ \t]*--[ \t]*contract:[ \t]*\S/im;

// One pass over the SQL. Returns two texts of the same length as the input
// (line breaks kept, so offsets and line numbers match):
// - code: comments and the contents of strings, quoted identifiers and
//   $$ blocks are blanked (a $$ block is marked with CODE_BLOCK);
// - comments: everything EXCEPT comments is blanked (where notes are read).
// Handles '...' with '' and E'...' with backslash escapes, "...", nested
// /* */ comments, -- comments and $tag$ ... $tag$ bodies.
export function maskSql(sql: string): { code: string; comments: string } {
  const code: string[] = [];
  const comments: string[] = [];
  // A character of code (kept in `code`) or of a comment (kept in `comments`).
  const keep = (ch: string, inComment: boolean) => {
    if (ch === "\n") {
      code.push("\n");
      comments.push("\n");
    } else {
      code.push(inComment ? " " : ch);
      comments.push(inComment ? ch : " ");
    }
  };
  // A character inside a string, a quoted name or a $$ block.
  const blank = (ch: string) => {
    code.push(ch === "\n" ? "\n" : " ");
    comments.push(ch === "\n" ? "\n" : " ");
  };

  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") keep(sql[i++], true);
    } else if (ch === "/" && next === "*") {
      let depth = 0;
      while (i < sql.length) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
          depth++;
          keep(sql[i++], true);
          keep(sql[i++], true);
        } else if (sql[i] === "*" && sql[i + 1] === "/") {
          depth--;
          keep(sql[i++], true);
          keep(sql[i++], true);
          if (depth === 0) break;
        } else {
          keep(sql[i++], true);
        }
      }
    } else if (ch === "'") {
      // E'...' allows backslash escapes; a plain '...' only doubles quotes.
      const escapes = /[Ee]/.test(sql[i - 1] ?? "") && !/\w/.test(sql[i - 2] ?? "");
      keep(sql[i++], false);
      while (i < sql.length) {
        if (escapes && sql[i] === "\\") {
          blank(sql[i++]);
          if (i < sql.length) blank(sql[i++]);
        } else if (sql[i] === "'" && sql[i + 1] === "'") {
          blank(sql[i++]);
          blank(sql[i++]);
        } else if (sql[i] === "'") {
          keep(sql[i++], false);
          break;
        } else {
          blank(sql[i++]);
        }
      }
    } else if (ch === '"') {
      keep(sql[i++], false);
      while (i < sql.length) {
        if (sql[i] === '"' && sql[i + 1] === '"') {
          blank(sql[i++]);
          blank(sql[i++]);
        } else if (sql[i] === '"') {
          keep(sql[i++], false);
          break;
        } else {
          blank(sql[i++]);
        }
      }
    } else if (
      ch === "$" &&
      // Not inside a name like x$y (PostgreSQL does not start a $$ there).
      !/[\w$]/.test(sql[i - 1] ?? "") &&
      /^\$(?:[A-Za-z_]\w*)?\$/.test(sql.slice(i))
    ) {
      const tag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(sql.slice(i))![0];
      const close = sql.indexOf(tag, i + tag.length);
      const stop = close === -1 ? sql.length : close + tag.length;
      code.push(CODE_BLOCK);
      comments.push(" ");
      i++;
      while (i < stop) blank(sql[i++]);
    } else {
      keep(sql[i++], false);
    }
  }
  return { code: code.join(""), comments: comments.join("") };
}

export function hasContractNote(sql: string): boolean {
  return CONTRACT_NOTE.test(maskSql(sql).comments);
}

export function findUnsafeStatements(migration: string, sql: string): Finding[] {
  const { code, comments } = maskSql(sql);
  const findings: Finding[] = [];
  const createdHere = new Set<string>();
  let offset = 0;
  // Statements end with ";" outside strings and comments (drizzle also adds
  // "--> statement-breakpoint", which is a comment and already blanked).
  for (const part of code.split(";")) {
    const statement = part.trim();
    if (statement) {
      const start = offset + part.indexOf(statement);
      const line = code.slice(0, start).split("\n").length;
      // A contract note covers only the statement right after it: the
      // comment lines between the previous statement and this one.
      // The window starts on the next line: a note at the end of the previous
      // statement's line belongs to that statement, not to this one.
      // (The first statement has no previous one: its window is the start.)
      const lineAfter = comments.indexOf("\n", offset);
      const from =
        offset === 0 ? 0 : lineAfter === -1 || lineAfter > start ? start : lineAfter + 1;
      const contract = CONTRACT_NOTE.test(comments.slice(from, start));
      // Tested masked, shown as written (strings and names included).
      const original = sql.slice(start, start + statement.length).replace(/\s+/g, " ");
      const upper = statement.toUpperCase();
      // The same, with the quoted names written out again (blank in `code`).
      const named = code
        .slice(start, start + statement.length)
        .replace(/"\s*"/g, (m, at: number) => sql.slice(start + at, start + at + m.length))
        .toUpperCase();
      for (const rule of RULES) {
        if (rule.test(upper, named, createdHere)) {
          findings.push({ migration, line, rule: rule.name, statement: original, contract });
        }
      }
      const created = new RegExp(
        String.raw`^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(${NAME})`,
      ).exec(named);
      if (created) createdHere.add(created[1]);
    }
    offset += part.length + 1;
  }
  return findings;
}

export type MigrationFile = { tag: string; sql: string; when?: number };

export type CheckResult = {
  // Findings that fail the check.
  errors: Finding[];
  // Findings that are allowed: before the launch, or marked as a contract step.
  warnings: Finding[];
};

// `migrations` in journal order.
export function checkMigrations(
  migrations: MigrationFile[],
  lastPrelaunch: string | null = LAST_PRELAUNCH_MIGRATION,
): CheckResult {
  const result: CheckResult = { errors: [], warnings: [] };
  const launchIndex = lastPrelaunch === null ? -1 : migrations.findIndex((m) => m.tag === lastPrelaunch);
  if (lastPrelaunch !== null && launchIndex === -1) {
    throw new Error(`LAST_PRELAUNCH_MIGRATION "${lastPrelaunch}" is not in the journal`);
  }
  let newest: number | undefined;
  migrations.forEach((m, i) => {
    // drizzle applies a migration only if it is newer than the last applied
    // one: an older date (e.g. from a long-lived branch) would be skipped
    // silently on a database that already has the later ones. Compared with
    // the newest so far, so every late migration is named.
    if (m.when !== undefined && newest !== undefined && m.when <= newest) {
      result.errors.push({
        migration: m.tag,
        line: 1,
        rule: "is not newer than the migration before it in the journal (drizzle would skip it)",
        statement: "",
        contract: false,
      });
    }
    if (m.when !== undefined) newest = Math.max(newest ?? m.when, m.when);
    if (lastPrelaunch !== null && i <= launchIndex) return;
    for (const finding of findUnsafeStatements(m.tag, m.sql)) {
      const allowed = lastPrelaunch === null || finding.contract;
      (allowed ? result.warnings : result.errors).push(finding);
    }
  });
  return result;
}
