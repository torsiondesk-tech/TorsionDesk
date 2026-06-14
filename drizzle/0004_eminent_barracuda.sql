CREATE TYPE "public"."billing_type" AS ENUM('single_invoice', 'progress_billing', 'no_charge');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('unscheduled', 'scheduled', 'dispatched', 'cancelled', 'delayed', 'on_the_way', 'on_site', 'started', 'paused', 'resumed', 'partially_completed', 'completed', 'invoiced', 'paid_in_full', 'job_closed');--> statement-breakpoint
CREATE TYPE "public"."line_item_type" AS ENUM('product', 'service', 'discount', 'expense');--> statement-breakpoint
CREATE TABLE "job_assignees" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"user_id" text NOT NULL,
	"notify" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_assignees_tenant_job_user_unique" UNIQUE("tenant_id","job_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "job_assignees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_line_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"type" "line_item_type",
	"ref_id" text,
	"description" text,
	"qty" numeric,
	"rate" numeric,
	"cost" numeric,
	"tax_item_id" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_line_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_photos" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"label" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_photos_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_reminders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"remind_at" timestamp,
	"note" text,
	"done" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_reminders_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_site_visits" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"status" "job_status",
	"visit_date" timestamp,
	"arrival_window_start" timestamp,
	"arrival_window_end" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_site_visits_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_site_visits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_status_history" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"from_status" "job_status",
	"to_status" "job_status" NOT NULL,
	"changed_by" text,
	"changed_at" timestamp DEFAULT now(),
	CONSTRAINT "job_status_history_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_tags" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"tag_id" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "job_tags_tenant_job_tag_unique" UNIQUE("tenant_id","job_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "job_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"label" text,
	"done" boolean DEFAULT false,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_tasks_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_template_line_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"type" "line_item_type",
	"ref_id" text,
	"description" text,
	"qty" numeric,
	"rate" numeric,
	"cost" numeric,
	"tax_item_id" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_template_line_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_template_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_template_tasks" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template_id" text NOT NULL,
	"label" text,
	"sort_order" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_template_tasks_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_template_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "job_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"category_id" text,
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "job_templates_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "job_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_no" integer NOT NULL,
	"customer_id" text NOT NULL,
	"contact_id" text,
	"service_location_id" text,
	"category_id" text,
	"status" "job_status" DEFAULT 'unscheduled' NOT NULL,
	"billing_type" "billing_type" DEFAULT 'single_invoice' NOT NULL,
	"description" text,
	"po_number" text,
	"job_source_id" text,
	"assigned_agent_id" text,
	"priority" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"arrival_window_start" timestamp,
	"arrival_window_end" timestamp,
	"estimated_duration" integer,
	"multi_day" boolean DEFAULT false,
	"notes_for_techs" text,
	"completion_notes" text,
	"requires_follow_up" boolean DEFAULT false,
	"is_repeating" boolean DEFAULT false,
	"repeat_frequency" text,
	"repeat_end_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "jobs_tenant_job_no_unique" UNIQUE("tenant_id","job_no"),
	CONSTRAINT "jobs_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_assignees" ADD CONSTRAINT "job_assignees_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_assignees" ADD CONSTRAINT "job_assignees_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_tax_item_id_tax_items_id_fk" FOREIGN KEY ("tax_item_id") REFERENCES "public"."tax_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_line_items" ADD CONSTRAINT "job_line_items_tenant_id_tax_item_id_tax_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tax_item_id") REFERENCES "public"."tax_items"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_reminders" ADD CONSTRAINT "job_reminders_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_site_visits" ADD CONSTRAINT "job_site_visits_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_status_history" ADD CONSTRAINT "job_status_history_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tags" ADD CONSTRAINT "job_tags_tenant_id_tag_id_tags_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tag_id") REFERENCES "public"."tags"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_line_items" ADD CONSTRAINT "job_template_line_items_template_id_job_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."job_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_line_items" ADD CONSTRAINT "job_template_line_items_tax_item_id_tax_items_id_fk" FOREIGN KEY ("tax_item_id") REFERENCES "public"."tax_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_line_items" ADD CONSTRAINT "job_template_line_items_tenant_id_template_id_job_templates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."job_templates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_line_items" ADD CONSTRAINT "job_template_line_items_tenant_id_tax_item_id_tax_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tax_item_id") REFERENCES "public"."tax_items"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_tasks" ADD CONSTRAINT "job_template_tasks_template_id_job_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."job_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_template_tasks" ADD CONSTRAINT "job_template_tasks_tenant_id_template_id_job_templates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","template_id") REFERENCES "public"."job_templates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_category_id_job_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."job_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_templates" ADD CONSTRAINT "job_templates_tenant_id_category_id_job_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."job_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_service_location_id_service_locations_id_fk" FOREIGN KEY ("service_location_id") REFERENCES "public"."service_locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_job_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."job_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_source_id_job_sources_id_fk" FOREIGN KEY ("job_source_id") REFERENCES "public"."job_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_customer_id_customers_tenant_id_id_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_contact_id_contacts_tenant_id_id_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."contacts"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_service_location_id_service_locations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","service_location_id") REFERENCES "public"."service_locations"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_category_id_job_categories_tenant_id_id_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."job_categories"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_job_source_id_job_sources_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_source_id") REFERENCES "public"."job_sources"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_status_history_job_id_idx" ON "job_status_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_customer_id_idx" ON "jobs" USING btree ("customer_id");--> statement-breakpoint
CREATE POLICY "job_assignees_tenant_isolation" ON "job_assignees" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_assignees"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_assignees"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_line_items_tenant_isolation" ON "job_line_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_line_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_line_items"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_photos_tenant_isolation" ON "job_photos" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_photos"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_photos"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_reminders_tenant_isolation" ON "job_reminders" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_reminders"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_reminders"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_site_visits_tenant_isolation" ON "job_site_visits" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_site_visits"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_site_visits"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_status_history_tenant_isolation" ON "job_status_history" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_status_history"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_status_history"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_tags_tenant_isolation" ON "job_tags" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_tags"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_tags"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_tasks_tenant_isolation" ON "job_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_tasks"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_tasks"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_template_line_items_tenant_isolation" ON "job_template_line_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_template_line_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_template_line_items"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_template_tasks_tenant_isolation" ON "job_template_tasks" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_template_tasks"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_template_tasks"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "job_templates_tenant_isolation" ON "job_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("job_templates"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("job_templates"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "jobs_tenant_isolation" ON "jobs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("jobs"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("jobs"."tenant_id" = current_setting('app.current_tenant_id', true));