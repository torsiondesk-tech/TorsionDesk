CREATE TABLE "sales_reps" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sales_reps_tenant_name_unique" UNIQUE("tenant_id","name"),
	CONSTRAINT "sales_reps_tenant_id_unique" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
ALTER TABLE "sales_reps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
UPDATE "estimates" SET "assigned_agent_id" = NULL;--> statement-breakpoint
UPDATE "jobs" SET "assigned_agent_id" = NULL;--> statement-breakpoint
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_tenant_id_assigned_agent_id_sales_reps_tenant_id_id_fk" FOREIGN KEY ("tenant_id","assigned_agent_id") REFERENCES "public"."sales_reps"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenant_id_assigned_agent_id_sales_reps_tenant_id_id_fk" FOREIGN KEY ("tenant_id","assigned_agent_id") REFERENCES "public"."sales_reps"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "sales_reps_tenant_isolation" ON "sales_reps" AS PERMISSIVE FOR ALL TO "authenticated" USING ("sales_reps"."tenant_id" = current_setting('app.current_tenant_id', true)) WITH CHECK ("sales_reps"."tenant_id" = current_setting('app.current_tenant_id', true));