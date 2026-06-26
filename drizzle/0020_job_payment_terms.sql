-- Add default payment terms to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "default_payment_terms_days" integer DEFAULT 0;

-- Add payment fields to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "payment_terms_days" integer;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "job_payment_method" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "check_ref_no" text;
