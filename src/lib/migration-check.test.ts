import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkMigrations, findUnsafeStatements, hasContractNote } from "./migration-check";

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
    // Before the launch: the rename of eik in 0006 is the only known change
    // that would not be allowed after it (also catches a broken rule).
    expect(result.warnings.map((f) => `${f.migration}:${f.line}`)).toEqual([
      "0006_company_country_and_review:2",
      "0006_company_country_and_review:3",
    ]);
  });
});
