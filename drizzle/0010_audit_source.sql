ALTER TABLE "admins" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "source" text DEFAULT 'portal' NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_source_created_at_idx" ON "audit_log" USING btree ("source","created_at");