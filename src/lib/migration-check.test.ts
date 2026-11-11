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
    expect(checkMigrations(all).errors).toEqual([]);
  });
});
