-- ── Create status_colors table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "status_colors" (
  "id"            text PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"     text NOT NULL,
  "status"        "job_status" NOT NULL,
  "bg_color"      text NOT NULL DEFAULT '#f8fafc',
  "text_color"    text NOT NULL DEFAULT '#1e293b',
  "border_color"  text NOT NULL DEFAULT '#e2e8f0',
  "created_at"    timestamptz DEFAULT now(),
  "updated_at"    timestamptz DEFAULT now(),

  CONSTRAINT "status_colors_tenant_status_unique"
    UNIQUE ("tenant_id", "status"),

  CONSTRAINT "status_colors_tenant_id_unique"
    UNIQUE ("tenant_id", "id")
);

-- Composite FK: make sure each status_color row belongs to a valid tenant
ALTER TABLE "status_colors"
  ADD CONSTRAINT "fk_status_colors_tenant"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE;

-- RLS policies for tenant isolation
ALTER TABLE "status_colors" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_colors_tenant_isolation_select"
  ON "status_colors"
  FOR SELECT
  TO authenticated
  USING ("tenant_id" = current_setting('app.current_tenant_id', true));

CREATE POLICY "status_colors_tenant_isolation_insert"
  ON "status_colors"
  FOR INSERT
  TO authenticated
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

CREATE POLICY "status_colors_tenant_isolation_update"
  ON "status_colors"
  FOR UPDATE
  TO authenticated
  USING ("tenant_id" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true));

CREATE POLICY "status_colors_tenant_isolation_delete"
  ON "status_colors"
  FOR DELETE
  TO authenticated
  USING ("tenant_id" = current_setting('app.current_tenant_id', true));
