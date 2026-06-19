ALTER TABLE job_signatures
  ADD COLUMN IF NOT EXISTS signature_type text;
