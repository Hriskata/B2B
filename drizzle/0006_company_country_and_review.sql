ALTER TYPE "public"."user_status" ADD VALUE 'pending_review';--> statement-breakpoint
ALTER TABLE "companies" RENAME COLUMN "eik" TO "company_number";--> statement-breakpoint
ALTER TABLE "companies" DROP CONSTRAINT "companies_eik_unique";--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "country" text DEFAULT 'BG' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_country_number_unique" UNIQUE("country","company_number");--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "full_name" text;
