CREATE TYPE "public"."estimate_status" AS ENUM('estimate_requested', 'estimate_provided', 'estimate_accepted', 'estimate_won', 'estimate_lost');--> statement-breakpoint
CREATE TABLE "estimate_assignees" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text NOT NULL,
	"user_id" text NOT NULL,
	"notify" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_assignees_tenant_estimate_user_unique" UNIQUE("tenant_id","estimate_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "estimate_assignees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_line_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text NOT NULL,
	"group_id" text,
	"type" "line_item_type",
	"ref_id" text,
	"title" text,
	"description" text,
	"qty" numeric,
	"rate" numeric,
	"cost" numeric,
	"tax_item_id" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_line_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_reminders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text NOT NULL,
	"remind_at" timestamp,
	"note" text,
	"done" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_reminders_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_tags" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_tags_tenant_estimate_tag_unique" UNIQUE("tenant_id","estimate_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "estimate_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text NOT NULL,
	"label" text,
	"done" boolean DEFAULT false,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_tasks_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_template_line_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"type" "line_item_type",
	"ref_id" text,
	"title" text,
	"description" text,
	"qty" numeric,
	"rate" numeric,
	"cost" numeric,
	"tax_item_id" text,
	"group_name" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_template_line_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_template_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_template_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"label" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_template_tasks_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_template_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_templates_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_no" integer NOT NULL,
	"customer_id" text NOT NULL,
	"contact_id" text,
	"service_location_id" text,
	"category_id" text,
	"status" "estimate_status" DEFAULT 'estimate_requested' NOT NULL,
	"description" text,
	"po_number" text,
	"opportunity_rating" integer,
	"referral_source_id" text,
	"expiry_date" date,
	"follow_up_date" date,
	"on_site_date" timestamp,
	"arrival_window_start" timestamp,
	"arrival_window_end" timestamp,
	"notes_for_techs" text,
	"notes" text,
	"internal_notes" text,
	"assigned_agent_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimates_tenant_estimate_no_unique" UNIQUE("tenant_id","estimate_no"),
	CONSTRAINT "estimates_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_signatures" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"signature_type" text,
	"signed_by" text,
	"captured_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_signatures_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_signatures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "line_item_groups" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"estimate_id" text,
	"job_id" text,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "line_item_groups_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "line_item_groups_owner_check" CHECK ((estimate_id IS NOT NULL)::int + (job_id IS NOT NULL)::int = 1)
);
--> statement-breakpoint
ALTER TABLE "line_item_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "status_colors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"status" "job_status" NOT NULL,
	"bg_color" text DEFAULT '#f8fafc' NOT NULL,
	"text_color" text DEFAULT '#1e293b' NOT NULL,
	"border_color" text DEFAULT '#e2e8f0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "status_colors_tenant_status_unique" UNIQUE("tenant_id","status"),
	CONSTRAINT "status_colors_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "status_colors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "team_profiles" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"date_of_birth" date,
	"role" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "team_profiles_tenant_user_unique" UNIQUE("tenant_id","user_id"),
	CONSTRAINT "team_profiles_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "team_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "service_locations" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "first_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "primary_location_id" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "primary_contact_id" text;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "job_template_line_items" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "estimate_assignees" ADD CONSTRAINT "estimate_assignees_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_assignees" ADD CONSTRAINT "estimate_assignees_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_tax_item_id_tax_items_id_fk" FOREIGN KEY ("tax_item_id") REFERENCES "public"."tax_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_tenant_id_group_id_line_item_groups_tenant_id_id_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."line_item_groups"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_tenant_id_tax_item_id_tax_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tax_item_id") REFERENCES "public"."tax_items"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_reminders" ADD CONSTRAINT "estimate_reminders_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_reminders" ADD CONSTRAINT "estimate_reminders_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tags" ADD CONSTRAINT "estimate_tags_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tags" ADD CONSTRAINT "estimate_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tags" ADD CONSTRAINT "estimate_tags_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tags" ADD CONSTRAINT "estimate_tags_tenant_id_tag_id_tags_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tasks" ADD CONSTRAINT "estimate_tasks_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_tasks" ADD CONSTRAINT "estimate_tasks_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_line_items" ADD CONSTRAINT "estimate_template_line_items_template_id_estimate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_line_items" ADD CONSTRAINT "estimate_template_line_items_tax_item_id_tax_items_id_fk" FOREIGN KEY ("tax_item_id") REFERENCES "public"."tax_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_line_items" ADD CONSTRAINT "estimate_template_line_items_tenant_id_template_id_estimate_templates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."estimate_templates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_line_items" ADD CONSTRAINT "estimate_template_line_items_tenant_id_tax_item_id_tax_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tax_item_id") REFERENCES "public"."tax_items"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_tasks" ADD CONSTRAINT "estimate_template_tasks_template_id_estimate_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."estimate_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimate_template_tasks" ADD CONSTRAINT "estimate_template_tasks_tenant_id_template_id_estimate_templates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."estimate_templates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_service_location_id_service_locations_id_fk" FOREIGN KEY ("service_location_id") REFERENCES "public"."service_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_category_id_job_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."job_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_customer_id_customers_tenant_id_id_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_contact_id_contacts_tenant_id_id_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."contacts"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_service_location_id_service_locations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","service_location_id") REFERENCES "public"."service_locations"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_category_id_job_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."job_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_referral_source_id_referral_sources_tenant_id_id_fk" FOREIGN KEY ("tenant_id","referral_source_id") REFERENCES "public"."referral_sources"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_signatures" ADD CONSTRAINT "job_signatures_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_signatures" ADD CONSTRAINT "job_signatures_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_groups" ADD CONSTRAINT "line_item_groups_tenant_id_estimate_id_estimates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","estimate_id") REFERENCES "public"."estimates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_item_groups" ADD CONSTRAINT "line_item_groups_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "estimates_status_idx" ON "estimates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "estimates_customer_id_idx" ON "estimates" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "team_profiles_user_idx" ON "team_profiles" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_tenant_id_group_id_line_item_groups_tenant_id_id_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."line_item_groups"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "estimate_assignees_tenant_isolation" ON "estimate_assignees" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_assignees"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_assignees"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_line_items_tenant_isolation" ON "estimate_line_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_line_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_line_items"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_reminders_tenant_isolation" ON "estimate_reminders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_reminders"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_reminders"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_tags_tenant_isolation" ON "estimate_tags" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_tags"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_tags"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_tasks_tenant_isolation" ON "estimate_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_tasks"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_tasks"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_template_line_items_tenant_isolation" ON "estimate_template_line_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_template_line_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_template_line_items"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_template_tasks_tenant_isolation" ON "estimate_template_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_template_tasks"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_template_tasks"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_templates_tenant_isolation" ON "estimate_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_templates"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_templates"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimates_tenant_isolation" ON "estimates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimates"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimates"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_signatures_tenant_isolation" ON "job_signatures" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_signatures"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_signatures"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "line_item_groups_tenant_isolation" ON "line_item_groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ("line_item_groups"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("line_item_groups"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "status_colors_tenant_isolation" ON "status_colors" AS PERMISSIVE FOR ALL TO "authenticated" USING ("status_colors"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("status_colors"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "team_profiles_tenant_isolation" ON "team_profiles" AS PERMISSIVE FOR ALL TO "authenticated" USING ("team_profiles"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("team_profiles"."tenant_id" = current_setting('app.current_tenant_id', true));