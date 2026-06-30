-- Add billing_location_id to invoices so billing address and service location are independent.
-- Existing rows get NULL (no billing location set), which falls back to service_location_id
-- in the UI until explicitly changed.
ALTER TABLE "invoices"
  ADD COLUMN "billing_location_id" text;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_tenant_id_billing_location_id_service_locations_tenant_id_id_fk"
  FOREIGN KEY ("tenant_id", "billing_location_id")
  REFERENCES "service_locations"("tenant_id", "id")
  ON DELETE SET NULL;
