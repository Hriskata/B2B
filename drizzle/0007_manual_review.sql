ALTER TYPE "public"."user_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_at" timestamp with time zone;