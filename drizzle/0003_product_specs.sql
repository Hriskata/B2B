CREATE TYPE "public"."product_series" AS ENUM('hds', 'uds', 'quick-fit', 'mpo');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "series" "product_series";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "connector" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ports" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "mpo_ports" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fibers" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "max_fibers_variant" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rack_units" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "polish" text[];--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "splice" boolean;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "front_door" boolean;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "catalog_page" integer;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sku_unique" UNIQUE("sku");