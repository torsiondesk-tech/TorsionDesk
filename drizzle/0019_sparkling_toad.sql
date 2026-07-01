CREATE TYPE "public"."trigger_type" AS ENUM('job_confirmation', 'tech_notify', 'estimate_send', 'invoice_send', 'payment_receipt', 'on_the_way', 'appointment_reminder');--> statement-breakpoint
CREATE TABLE "communication_logs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"customer_id" text,
	"ref_kind" text,
	"ref_id" text,
	"trigger_type" "trigger_type",
	"channel" text NOT NULL,
	"to_address" text,
	"status" text NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp DEFAULT now(),
	"delivered_at" timestamp,
	"opened_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "communication_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "communication_settings" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"email_sender_name" text,
	"sms_phone_number" text,
	CONSTRAINT "comm_settings_tenant_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "communication_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"subject" text,
	"body" text,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "communication_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "communication_triggers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"trigger_type" "trigger_type" NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"subject" text,
	"footer_text" text,
	CONSTRAINT "comm_triggers_unique" UNIQUE("tenant_id","trigger_type","channel")
);
--> statement-breakpoint
ALTER TABLE "communication_triggers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "estimate_status_colors" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"status" "estimate_status" NOT NULL,
	"bg_color" text DEFAULT '#f8fafc' NOT NULL,
	"text_color" text DEFAULT '#1e293b' NOT NULL,
	"border_color" text DEFAULT '#e2e8f0' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "estimate_status_colors_tenant_status_unique" UNIQUE("tenant_id","status"),
	CONSTRAINT "estimate_status_colors_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "estimate_status_colors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"type" "line_item_type",
	"ref_id" text,
	"title" text,
	"description" text,
	"qty" numeric,
	"rate" numeric,
	"cost" numeric,
	"tax_item_id" text,
	"sort_order" integer,
	"group_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoice_line_items_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"invoice_no" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"job_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"contact_id" text,
	"service_location_id" text,
	"billing_location_id" text,
	"invoice_date" date DEFAULT CURRENT_DATE NOT NULL,
	"due_date" date,
	"payment_terms_days" integer DEFAULT 30,
	"notes" text,
	"internal_notes" text,
	"payment_link_url" text,
	"sent_by" text,
	"sent_on" timestamp,
	"email_opened_at" timestamp,
	"total" numeric NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_tenant_invoice_no_unique" UNIQUE("tenant_id","invoice_no"),
	CONSTRAINT "invoices_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"invoice_id" text NOT NULL,
	"amount_applied" numeric NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_allocations_tenant_payment_invoice_unique" UNIQUE("tenant_id","payment_id","invoice_id"),
	CONSTRAINT "payment_allocations_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payment_methods_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "payment_methods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"payment_no" integer NOT NULL,
	"job_id" text,
	"customer_id" text NOT NULL,
	"method" text NOT NULL,
	"check_ref_no" text,
	"received_by" text,
	"received_on" date,
	"memo" text,
	"amount" numeric NOT NULL,
	"stripe_event_id" text,
	"last4" text,
	"expiry" text,
	"transaction_token" text,
	"auth_code" text,
	"billing_address" text,
	"square_payment_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"entered_at" timestamp DEFAULT now(),
	"entered_by_user_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "payments_tenant_payment_no_unique" UNIQUE("tenant_id","payment_no"),
	CONSTRAINT "payments_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "payments_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "scheduled_sms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"job_id" text NOT NULL,
	"contact_id" text,
	"phone" text NOT NULL,
	"message_body" text NOT NULL,
	"fire_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"cancelled_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
ALTER TABLE "scheduled_sms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "sms_consent" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "contact_phones" ADD COLUMN "ext" text;--> statement-breakpoint
ALTER TABLE "estimates" ADD COLUMN "requested_on" date;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "payment_terms_days" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "job_payment_method" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "check_ref_no" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "default_payment_terms_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tax_item_id_tax_items_id_fk" FOREIGN KEY ("tax_item_id") REFERENCES "public"."tax_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tenant_id_invoice_id_invoices_tenant_id_id_fk" FOREIGN KEY ("tenant_id","invoice_id") REFERENCES "public"."invoices"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tenant_id_tax_item_id_tax_items_tenant_id_id_fk" FOREIGN KEY ("tenant_id","tax_item_id") REFERENCES "public"."tax_items"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tenant_id_group_id_line_item_groups_tenant_id_id_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."line_item_groups"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_customer_id_customers_tenant_id_id_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_contact_id_contacts_tenant_id_id_fk" FOREIGN KEY ("tenant_id","contact_id") REFERENCES "public"."contacts"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_service_location_id_service_locations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","service_location_id") REFERENCES "public"."service_locations"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_billing_location_id_service_locations_tenant_id_id_fk" FOREIGN KEY ("tenant_id","billing_location_id") REFERENCES "public"."service_locations"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_payment_id_payments_tenant_id_id_fk" FOREIGN KEY ("tenant_id","payment_id") REFERENCES "public"."payments"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_tenant_id_invoice_id_invoices_tenant_id_id_fk" FOREIGN KEY ("tenant_id","invoice_id") REFERENCES "public"."invoices"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_job_id_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","job_id") REFERENCES "public"."jobs"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_customer_id_customers_tenant_id_id_fk" FOREIGN KEY ("tenant_id","customer_id") REFERENCES "public"."customers"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comm_logs_provider_msg_idx" ON "communication_logs" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "comm_logs_ref_idx" ON "communication_logs" USING btree ("ref_kind","ref_id");--> statement-breakpoint
CREATE INDEX "comm_templates_tenant_idx" ON "communication_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_job_id_idx" ON "invoices" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "invoices_customer_id_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_payment_id_idx" ON "payment_allocations" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "payment_allocations_invoice_id_idx" ON "payment_allocations" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_job_id_idx" ON "payments" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "payments_customer_id_idx" ON "payments" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "scheduled_sms_due_idx" ON "scheduled_sms" USING btree ("fire_at");--> statement-breakpoint
CREATE INDEX "scheduled_sms_job_idx" ON "scheduled_sms" USING btree ("job_id");--> statement-breakpoint
CREATE POLICY "communication_logs_tenant_isolation" ON "communication_logs" AS PERMISSIVE FOR ALL TO "authenticated" USING ("communication_logs"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("communication_logs"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "communication_settings_tenant_isolation" ON "communication_settings" AS PERMISSIVE FOR ALL TO "authenticated" USING ("communication_settings"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("communication_settings"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "communication_templates_tenant_isolation" ON "communication_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ("communication_templates"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("communication_templates"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "communication_triggers_tenant_isolation" ON "communication_triggers" AS PERMISSIVE FOR ALL TO "authenticated" USING ("communication_triggers"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("communication_triggers"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "estimate_status_colors_tenant_isolation" ON "estimate_status_colors" AS PERMISSIVE FOR ALL TO "authenticated" USING ("estimate_status_colors"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("estimate_status_colors"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "invoice_line_items_tenant_isolation" ON "invoice_line_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ("invoice_line_items"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("invoice_line_items"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "invoices_tenant_isolation" ON "invoices" AS PERMISSIVE FOR ALL TO "authenticated" USING ("invoices"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("invoices"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "payment_allocations_tenant_isolation" ON "payment_allocations" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payment_allocations"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("payment_allocations"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "payment_methods_tenant_isolation" ON "payment_methods" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payment_methods"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("payment_methods"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "payments_tenant_isolation" ON "payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ("payments"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("payments"."tenant_id" = current_setting('app.current_tenant_id', true));--> statement-breakpoint
CREATE POLICY "scheduled_sms_tenant_isolation" ON "scheduled_sms" AS PERMISSIVE FOR ALL TO "authenticated" USING ("scheduled_sms"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("scheduled_sms"."tenant_id" = current_setting('app.current_tenant_id', true));