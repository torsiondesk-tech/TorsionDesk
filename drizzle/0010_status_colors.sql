CREATE TABLE IF NOT EXISTS "status_colors" (
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

ALTER TABLE "status_colors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_colors_tenant_isolation" ON "status_colors" AS PERMISSIVE FOR ALL TO authenticated
	USING ("tenant_id" = current_setting('app.current_tenant_id', true))
	WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));
