// Finds database migrations that would break the previous version of the
// code (docs/ENVIRONMENTS.md, "Migrations"). After the first production
// launch a migration may only add things; renaming, dropping or tightening is
// done in separate releases (expand / contract) and must be marked with a
// "-- contract: <reason>" comment in the migration.

// The last migration applied before the first production launch. Set it at
// launch (launch checklist). Until then (null) every finding is only a
// warning, because there is no old version to go back to.
export const LAST_PRELAUNCH_MIGRATION: string | null = null;

export type Finding = {
  migration: string;
  line: number;
  rule: string;
  statement: string;
};

type Rule = { name: string; test: (sql: string) => boolean };

const RULES: Rule[] = [
  { name: "renames a table or column", test: (s) => /\bRENAME\b/.test(s) },
  {
    name: "drops something (DROP NOT NULL is allowed)",
    test: (s) => /\bDROP\b/.test(s.replace(/\bDROP\s+NOT\s+NULL\b/g, "")),
  },
  {
    name: "changes the type of a column",
    test: (s) => /\bALTER\s+COLUMN\b[\s\S]*\b(SET\s+DATA\s+)?TYPE\b/.test(s),
  },
  { name: "makes a column required (SET NOT NULL)", test: (s) => /\bSET\s+NOT\s+NULL\b/.test(s) },
  {
    name: "adds a required column without a default",
    test: (s) =>
      /\bALTER\s+TABLE\b[\s\S]*\bADD\s+COLUMN\b/.test(s) &&
      /\bNOT\s+NULL\b/.test(s) &&
      !/\bDEFAULT\b/.test(s),
  },
  { name: "deletes data", test: (s) => /\b(TRUNCATE|DELETE\s+FROM)\b/.test(s) },
];

// The reason must be on the same line as the marker.
const CONTRACT_NOTE = /^[ \t]*--[ \t]*contract:[ \t]*\S/im;

// SQL comments are ignored, so a note cannot trigger or hide a rule. Line
// breaks are kept, so line numbers stay right.
function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/--[^\n]*/g, "");
}

export function hasContractNote(sql: string): boolean {
  return CONTRACT_NOTE.test(sql);
}

export function findUnsafeStatements(migration: string, sql: string): Finding[] {
  const code = stripComments(sql);
  const findings: Finding[] = [];
  let offset = 0;
  // Statements end with ";" (drizzle also adds "--> statement-breakpoint",
  // which is a comment and already gone).
  for (const part of code.split(";")) {
    const statement = part.trim();
    if (statement) {
      const line = code.slice(0, offset + part.indexOf(statement)).split("\n").length;
      const upper = statement.toUpperCase();
      for (const rule of RULES) {
        if (rule.test(upper)) {
          findings.push({ migration, line, rule: rule.name, statement: statement.replace(/\s+/g, " ") });
        }
      }
    }
    offset += part.length + 1;
  }
  return findings;
}

export type MigrationFile = { tag: string; sql: string };

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
  migrations.forEach((m, i) => {
    if (lastPrelaunch !== null && i <= launchIndex) return;
    const findings = findUnsafeStatements(m.tag, m.sql);
    const allowed = lastPrelaunch === null || hasContractNote(m.sql);
    (allowed ? result.warnings : result.errors).push(...findings);
  });
  return result;
}
