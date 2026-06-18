CREATE TABLE IF NOT EXISTS job_signatures (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_id text NOT NULL,
  storage_path text NOT NULL,
  signed_by text,
  captured_by text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_signatures_tenant_id_unique
  ON job_signatures (tenant_id, id);

CREATE INDEX IF NOT EXISTS job_signatures_job_id_idx
  ON job_signatures (tenant_id, job_id);

ALTER TABLE job_signatures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'job_signatures_tenant_isolation'
    AND polrelid = 'job_signatures'::regclass
  ) THEN
    CREATE POLICY job_signatures_tenant_isolation
      ON job_signatures
      FOR ALL
      TO authenticated
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END
$$;

ALTER TABLE job_signatures
  ADD CONSTRAINT job_signatures_tenant_job_fk
  FOREIGN KEY (tenant_id, job_id)
  REFERENCES jobs (tenant_id, id)
  ON DELETE CASCADE;
