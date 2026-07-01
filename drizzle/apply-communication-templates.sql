-- Apply this in the Supabase SQL editor to add the communication_templates table.
-- Generated 2026-07-01 as part of the Email Invoice Dialog feature.

CREATE TABLE IF NOT EXISTS "communication_templates" (
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

ALTER TABLE "communication_templates" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "comm_templates_tenant_idx"
  ON "communication_templates" USING btree ("tenant_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'communication_templates'
      AND policyname = 'communication_templates_tenant_isolation'
  ) THEN
    CREATE POLICY "communication_templates_tenant_isolation"
      ON "communication_templates" AS PERMISSIVE FOR ALL TO "authenticated"
      USING ("communication_templates"."tenant_id" = current_setting('app.current_tenant_id', true))
      WITH CHECK ("communication_templates"."tenant_id" = current_setting('app.current_tenant_id', true));
  END IF;
END $$;
