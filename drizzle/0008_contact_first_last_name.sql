ALTER TABLE "contacts" ADD COLUMN "first_name" text;
ALTER TABLE "contacts" ADD COLUMN "last_name" text;

-- Migrate: split existing name into first_name and last_name
UPDATE "contacts" SET "first_name" = split_part("name", ' ', 1),
                      "last_name"  = nullif(trim(substring("name" from position(' ' in "name") + 1)), '');

-- Make first_name not null after migration
ALTER TABLE "contacts" ALTER COLUMN "first_name" SET NOT NULL;

-- Drop old name column
ALTER TABLE "contacts" DROP COLUMN "name";
