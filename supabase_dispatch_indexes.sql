-- Phase 4: Dispatch Board — Performance Indexes
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

CREATE INDEX IF NOT EXISTS jobs_tenant_start_date_idx
ON jobs (tenant_id, start_date);

CREATE INDEX IF NOT EXISTS jobs_tenant_status_created_at_idx
ON jobs (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS job_assignees_job_id_idx
ON job_assignees (job_id);
