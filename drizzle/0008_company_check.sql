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
ALTER TABLE "users" ADD COLUMN "needs_review" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Bulgarian profiles that already confirmed their email were approved without
-- a person before (no register check existed); they keep that. Everyone else
-- (foreign, or not yet confirmed) waits for an admin.
UPDATE "users" SET "needs_review" = false FROM "companies" WHERE "users"."company_id" = "companies"."id" AND "companies"."country" = 'BG' AND "users"."email_verified_at" IS NOT NULL;

