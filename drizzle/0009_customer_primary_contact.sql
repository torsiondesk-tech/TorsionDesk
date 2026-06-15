ALTER TABLE "customers" ADD COLUMN "primary_contact_id" text;

-- Backfill: set each customer's first (or only) contact as primary
UPDATE "customers" c
SET "primary_contact_id" = (
  SELECT co.id FROM "contacts" co
  WHERE co.customer_id = c.id
  ORDER BY co.created_at ASC
  LIMIT 1
)
WHERE c."primary_contact_id" IS NULL
  AND EXISTS (SELECT 1 FROM "contacts" co WHERE co.customer_id = c.id);
