CREATE TYPE "public"."admin_kind" AS ENUM('support', 'owner');--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"phone" text NOT NULL,
	"message" text,
	"client_key" uuid NOT NULL,
	"company_inactive" boolean DEFAULT false NOT NULL,
	"registry_status" text,
	"decision" text,
	"decided_by_admin_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_user_client_key_unique" UNIQUE("user_id","client_key"),
	CONSTRAINT "inquiries_decision_known" CHECK ("inquiries"."decision" is null or "inquiries"."decision" in ('accepted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "inquiry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "inquiry_items_inquiry_product_unique" UNIQUE("inquiry_id","product_id"),
	CONSTRAINT "inquiry_items_quantity_positive" CHECK ("inquiry_items"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "kind" "admin_kind" DEFAULT 'support' NOT NULL;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_decided_by_admin_id_admins_id_fk" FOREIGN KEY ("decided_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_items" ADD CONSTRAINT "inquiry_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_created_at_idx" ON "inquiries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inquiry_items_product_id_idx" ON "inquiry_items" USING btree ("product_id");