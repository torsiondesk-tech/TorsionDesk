ALTER TABLE "customers" ADD COLUMN "primary_location_id" text;

-- Backfill: set each customer's first (or only) location as primary
UPDATE "customers" c
SET "primary_location_id" = (
  SELECT l.id FROM "service_locations" l
  WHERE l.customer_id = c.id
  ORDER BY l.created_at ASC
  LIMIT 1
)
WHERE c."primary_location_id" IS NULL
  AND EXISTS (SELECT 1 FROM "service_locations" l WHERE l.customer_id = c.id);