ALTER TABLE "customers" ADD COLUMN "customerNumber" TEXT;
UPDATE "customers" SET "customerNumber" = 'C-' || LPAD(sub.row_num::text, 4, '0') FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS row_num FROM "customers") AS sub WHERE "customers".id = sub.id;
ALTER TABLE "customers" ALTER COLUMN "customerNumber" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_customerNumber_key" UNIQUE ("customerNumber");
