import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkMigrations, findUnsafeStatements, hasContractNote, maskSql } from "./migration-check";

const rules = (sql: string) => findUnsafeStatements("m", sql).map((f) => f.rule);

describe("findUnsafeStatements", () => {
  it.each([
    ['ALTER TABLE "companies" RENAME COLUMN "eik" TO "company_number";', "renames"],
    ['ALTER TABLE "a" RENAME TO "b";', "renames"],
    ['DROP TABLE "old";', "drops"],
    ['ALTER TABLE "a" DROP COLUMN "b";', "drops"],
    ['ALTER TABLE "a" DROP CONSTRAINT "a_b_unique";', "drops"],
    ['ALTER TABLE "a" ALTER COLUMN "b" DROP DEFAULT;', "drops"],
    ['ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE integer;', "changes the type"],
    ['ALTER TABLE "a" ALTER COLUMN "b" TYPE bigint USING b::bigint;', "changes the type"],
    ['ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;', "makes a column required"],
    ['ALTER TABLE "a" ADD COLUMN "b" text NOT NULL;', "adds a required column"],
    ['TRUNCATE "a";', "deletes data"],
    ['DELETE FROM "a" WHERE true;', "deletes data"],
    ['alter table "a" rename column "b" to "c";', "renames"],
    ['ALTER TABLE "a" ALTER "b" TYPE bigint;', "changes the type"],
    ['ALTER TABLE "a" ALTER COLUMN "type" SET DATA TYPE text;', "changes the type"],
  ])("flags %s", (sql, rule) => {
    expect(rules(sql).some((r) => r.startsWith(rule))).toBe(true);
  });

  it.each([
    'CREATE TABLE "a" ("id" uuid PRIMARY KEY, "b" text NOT NULL);',
    'ALTER TABLE "a" ADD COLUMN "b" text;',
    `ALTER TABLE "a" ADD COLUMN "b" text DEFAULT 'BG' NOT NULL;`,
    'ALTER TABLE "a" ALTER COLUMN "b" DROP NOT NULL;',
    `ALTER TYPE "public"."user_status" ADD VALUE 'pending_review';`,
    'CREATE INDEX "a_b_idx" ON "a" ("b");',
    `UPDATE "a" SET "c" = "b";`,
    '-- DROP TABLE "a" is only a comment\nSELECT 1;',
    '/* RENAME in a block comment */ SELECT 1;',
    'ALTER TABLE "products" ALTER COLUMN "type" DROP NOT NULL;',
    `ALTER TABLE "products" ALTER COLUMN "type" SET DEFAULT 'x';`,
  ])("allows %s", (sql) => {
    expect(rules(sql)).toEqual([]);
  });

  it("gives the line of the statement, also after drizzle's breakpoints", () => {
    const sql = [
      'ALTER TABLE "a" ADD COLUMN "b" text;--> statement-breakpoint',
      'ALTER TABLE "a" RENAME COLUMN "c" TO "d";',
    ].join("\n");
    const [finding] = findUnsafeStatements("0007_x", sql);
    expect(finding).toMatchObject({ migration: "0007_x", line: 2 });
    expect(finding.statement).toBe('ALTER TABLE "a" RENAME COLUMN "c" TO "d"');
  });
});

describe("hasContractNote", () => {
  it("needs a reason after the marker", () => {
    expect(hasContractNote("-- contract: eik replaced by company_number in 0007\nDROP ...")).toBe(true);
    expect(hasContractNote("-- contract:\nDROP ...")).toBe(false);
    expect(hasContractNote("SELECT 1; -- not a contract note")).toBe(false);
  });
});

describe("checkMigrations", () => {
  const migrations = [
    { tag: "0006_before", sql: 'ALTER TABLE "a" RENAME COLUMN "b" TO "c";' },
    { tag: "0007_expand", sql: 'ALTER TABLE "a" ADD COLUMN "d" text;' },
    { tag: "0008_unsafe", sql: 'ALTER TABLE "a" DROP COLUMN "c";' },
    { tag: "0009_contract", sql: '-- contract: c unused since 0007\nALTER TABLE "a" DROP COLUMN "c";' },
  ];

  it("only warns before the first launch", () => {
    const result = checkMigrations(migrations, null);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((f) => f.migration)).toEqual(["0006_before", "0008_unsafe", "0009_contract"]);
  });

  it("after the launch fails on unmarked changes and skips older migrations", () => {
    const result = checkMigrations(migrations, "0006_before");
    expect(result.errors.map((f) => f.migration)).toEqual(["0008_unsafe"]);
    expect(result.warnings.map((f) => f.migration)).toEqual(["0009_contract"]);
  });

  it("lets a contract note cover only the statement right after it", () => {
    const sql = [
      "-- contract: eik replaced by company_number in 0007",
      'ALTER TABLE "x" DROP COLUMN "eik";--> statement-breakpoint',
      'ALTER TABLE "y" RENAME COLUMN "p" TO "q";',
    ].join("\n");
    const result = checkMigrations([...migrations, { tag: "0010_mixed", sql }], "0009_contract");
    expect(result.warnings.map((f) => f.statement)).toEqual(['ALTER TABLE "x" DROP COLUMN "eik"']);
    expect(result.errors.map((f) => f.statement)).toEqual(['ALTER TABLE "y" RENAME COLUMN "p" TO "q"']);
  });

  it("does not take a note after the statement or in the middle of the file for the next one", () => {
    const sql = [
      'ALTER TABLE "x" DROP COLUMN "a"; -- contract: too late, after the statement',
      'ALTER TABLE "x" ADD COLUMN "b" text;--> statement-breakpoint',
      'ALTER TABLE "x" DROP COLUMN "c";',
    ].join("\n");
    const found = findUnsafeStatements("m", sql);
    expect(found.map((f) => [f.line, f.contract])).toEqual([
      [1, false],
      [3, false],
    ]);
  });

  it("refuses a launch marker that is not in the journal", () => {
    expect(() => checkMigrations(migrations, "0005_missing")).toThrow(/not in the journal/);
  });

  it("passes on the migrations of this project", () => {
    const dir = path.join(process.cwd(), "drizzle");
    const journal = JSON.parse(readFileSync(path.join(dir, "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    const all = journal.entries.map(({ tag }) => ({
      tag,
      sql: readFileSync(path.join(dir, `${tag}.sql`), "utf8"),
    }));
    const result = checkMigrations(all);
    expect(result.errors).toEqual([]);
    // Before the launch: the known changes that would need a contract note
    // after it (also catches a broken rule): a unique sku in 0003, the eik
    // changes in 0006.
    expect(result.warnings.map((f) => `${f.migration}:${f.line}`)).toEqual([
      "0003_product_specs:14",
      "0006_company_country_and_review:2",
      "0006_company_country_and_review:3",
      "0006_company_country_and_review:5",
    ]);
  });
});

describe("strings, names, comments and code blocks", () => {
  it.each([
    [
      "a -- inside a string does not hide the next statement",
      `UPDATE "a" SET "n" = '--'; DROP TABLE "b";`,
      "drops",
    ],
    [
      "a ; inside a string does not split the statement",
      `ALTER TABLE "a" ADD COLUMN "b" text CHECK (b <> ';') NOT NULL;`,
      "adds a required column",
    ],
    [
      "a /* inside a string does not blank the rest",
      `UPDATE "a" SET "n" = '/*'; DROP TABLE "b"; -- */`,
      "drops",
    ],
    [
      "an escaped quote in E'...' does not end the string",
      String.raw`UPDATE a SET n = E'it\'s; DROP'; DROP TABLE b;`,
      "drops",
    ],
    ["nested block comments end at the right place", "/* a /* b */ still */ DROP TABLE x;", "drops"],
    ["a statement with a $$ block is reported", "DO $$ BEGIN DELETE FROM a; END $$;", "contains a code block"],
    [
      "a tagged $fn$ block is reported",
      "CREATE FUNCTION f() RETURNS void AS $fn$ SELECT 1; $fn$ LANGUAGE sql;",
      "contains a code block",
    ],
  ])("%s", (_name, sql, rule) => {
    expect(rules(sql).some((r) => r.startsWith(rule))).toBe(true);
  });

  it.each([
    ["a column named drop", `ALTER TABLE "a" ADD COLUMN "drop" text;`],
    ["a string with DROP TABLE in it", `UPDATE "a" SET "note" = 'DROP TABLE x';`],
    ["a doubled quote inside a string", `UPDATE "a" SET "n" = 'it''s; DROP TABLE x';`],
  ])("does not flag %s", (_name, sql) => {
    expect(rules(sql)).toEqual([]);
  });

  it("a $$ block is one statement, even with ; inside", () => {
    expect(findUnsafeStatements("m", "DO $$ BEGIN PERFORM 1; PERFORM 2; END $$;")).toHaveLength(1);
  });

  it("keeps the length and the line breaks of the original", () => {
    const sql = `SELECT 'a\nb' -- c\n/* d */ "e"`;
    const { code, comments } = maskSql(sql);
    expect(code).toHaveLength(sql.length);
    expect(comments).toHaveLength(sql.length);
    expect(code.split("\n")).toHaveLength(sql.split("\n").length);
  });

  it("reads a contract note only from a real comment", () => {
    expect(hasContractNote("/*\n-- contract: inside a block comment\n*/")).toBe(true);
    expect(hasContractNote("SELECT '\n-- contract: inside a string\n';")).toBe(false);
  });
});

describe("more unsafe changes", () => {
  it.each([
    [`ALTER TABLE "a" SET SCHEMA "other";`, "moves an object"],
    [`ALTER TYPE "public"."t" SET SCHEMA "other";`, "moves an object"],
    [`ALTER TABLE "a" ADD COLUMN "b" text NOT NULL, ADD COLUMN "c" text DEFAULT 'x';`, "adds a required column"],
    [`ALTER TABLE "a" ADD CONSTRAINT "a_b_unique" UNIQUE("b");`, "adds a constraint"],
    [`ALTER TABLE "a" ADD CONSTRAINT "a_b_fk" FOREIGN KEY ("b") REFERENCES "c"("id");`, "adds a constraint"],
    [`CREATE UNIQUE INDEX "a_b_idx" ON "a" USING btree ("b");`, "adds a constraint"],
  ])("flags %s", (sql, rule) => {
    expect(rules(sql).some((r) => r.startsWith(rule))).toBe(true);
  });

  it.each([
    `ALTER TABLE "a" ADD COLUMN "id" serial PRIMARY KEY NOT NULL;`,
    `ALTER TABLE "a" ADD COLUMN "n" integer NOT NULL GENERATED ALWAYS AS IDENTITY;`,
    `CREATE INDEX "a_b_idx" ON "a" ("b");`,
  ])("allows %s", (sql) => {
    expect(rules(sql)).toEqual([]);
  });

  it("allows constraints and unique indexes on a table created in the same migration", () => {
    const sql = [
      `CREATE TABLE "new" ("id" uuid PRIMARY KEY, "b" text);`,
      "--> statement-breakpoint",
      `ALTER TABLE "new" ADD CONSTRAINT "new_b_fk" FOREIGN KEY ("b") REFERENCES "c"("id");`,
      `CREATE UNIQUE INDEX "new_b_idx" ON "new" ("b");`,
    ].join("\n");
    expect(rules(sql)).toEqual([]);
  });
});

describe("journal order", () => {
  it("fails when a migration is not newer than the one before it", () => {
    const result = checkMigrations(
      [
        { tag: "0001_a", sql: "SELECT 1;", when: 200 },
        { tag: "0002_b", sql: "SELECT 1;", when: 100 },
      ],
      null,
    );
    expect(result.errors.map((f) => f.migration)).toEqual(["0002_b"]);
  });

  it("names every late migration, also when it is equal or newer than the one just before", () => {
    const result = checkMigrations(
      [
        { tag: "0001_a", sql: "SELECT 1;", when: 500 },
        { tag: "0002_b", sql: "SELECT 1;", when: 100 },
        { tag: "0003_c", sql: "SELECT 1;", when: 300 },
        { tag: "0004_d", sql: "SELECT 1;", when: 500 },
      ],
      null,
    );
    expect(result.errors.map((f) => f.migration)).toEqual(["0002_b", "0003_c", "0004_d"]);
  });
});

describe("findings from the review of the scanner", () => {
  it("a note at the end of one statement's line does not cover the next statement", () => {
    const sql = [
      "-- contract: drop x",
      `ALTER TABLE "a" DROP COLUMN "x"; -- contract: same reason`,
      `ALTER TABLE "a" DROP COLUMN "y";`,
    ].join("\n");
    expect(findUnsafeStatements("m", sql).map((f) => f.contract)).toEqual([true, false]);
  });

  it.each([
    `ALTER TABLE "a" ADD COLUMN "b" text UNIQUE;`,
    `ALTER TABLE "a" ADD COLUMN "b" uuid REFERENCES "c"("id");`,
    `ALTER TABLE "a" ADD COLUMN "b" int DEFAULT 0 CHECK ("b" > 0);`,
    `ALTER TABLE "a" ADD EXCLUDE USING gist ("b" WITH &&);`,
  ])("flags a constraint written inside the change: %s", (sql) => {
    expect(rules(sql).some((r) => r.startsWith("adds a constraint"))).toBe(true);
  });

  it("does not read x$y$ in a name as the start of a $$ block", () => {
    expect(rules("ALTER TABLE x$y$ ADD COLUMN z int; DROP TABLE b;")).toEqual([
      "drops something (DROP NOT NULL is allowed)",
    ]);
  });
});
