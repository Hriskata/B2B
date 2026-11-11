CREATE TABLE "company_check_cache" (
	"eik" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"found" boolean NOT NULL,
	"status" text,
	"name" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registry_state" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registry_status" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registry_name" text;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "registry_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Existing foreign profiles needed review before (it was derived from the country).
UPDATE "users" SET "needs_review" = true FROM "companies" WHERE "users"."company_id" = "companies"."id" AND "companies"."country" <> 'BG';
