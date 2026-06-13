CREATE TABLE "job_categories" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_categories_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_sources_tenant_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "job_sources_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_categories_tenant_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "product_categories_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"model" text,
	"sku" text,
	"upc" text,
	"part_no" text,
	"type" text,
	"unit_price" numeric,
	"unit_cost" numeric,
	"active" boolean DEFAULT true,
	"inventory_item" boolean DEFAULT false,
	"sales_description" text,
	"purchase_description" text,
	"vendor1_name" text,
	"vendor1_price" numeric,
	"vendor2_name" text,
	"vendor2_price" numeric,
	"vendor3_name" text,
	"vendor3_price" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "products_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"category_id" text,
	"name" text NOT NULL,
	"unit_price" numeric,
	"unit_cost" numeric,
	"description" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "services_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tax_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"rate" numeric,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "tax_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "tax_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_categories" ADD CONSTRAINT "job_categories_tenant_id_parent_id_job_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","parent_id") REFERENCES "public"."job_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_category_id_product_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_category_id_product_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."product_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "job_categories_tenant_isolation" ON "job_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_categories"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_categories"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_sources_tenant_isolation" ON "job_sources" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_sources"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_sources"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "product_categories_tenant_isolation" ON "product_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ("product_categories"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("product_categories"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "products_tenant_isolation" ON "products" AS PERMISSIVE FOR ALL TO "authenticated" USING ("products"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("products"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "services_tenant_isolation" ON "services" AS PERMISSIVE FOR ALL TO "authenticated" USING ("services"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("services"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "tax_items_tenant_isolation" ON "tax_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("tax_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tax_items"."tenant_id" = current_setting('app.current_tenant_id', true));