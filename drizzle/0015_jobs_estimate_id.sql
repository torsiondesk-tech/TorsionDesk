ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "estimate_id" text;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_estimate_id_estimates_id_fk'
  ) THEN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_estimate_id_estimates_id_fk" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "jobs_estimate_id_idx" ON "jobs" USING btree ("estimate_id");
