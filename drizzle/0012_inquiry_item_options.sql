ALTER TABLE "inquiry_items" DROP CONSTRAINT "inquiry_items_inquiry_product_unique";--> statement-breakpoint
ALTER TABLE "inquiry_items" ADD COLUMN "polish" text;--> statement-breakpoint
ALTER TABLE "inquiry_items" ADD COLUMN "fibers" integer;--> statement-breakpoint
ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_line_unique" UNIQUE NULLS NOT DISTINCT("inquiry_id","product_id","polish","fibers");