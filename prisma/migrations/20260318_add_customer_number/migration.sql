ALTER TABLE "customers" ADD COLUMN "customerNumber" TEXT;
UPDATE "customers" SET "customerNumber" = 'C-' || LPAD(ROW_NUMBER::text, 4, '0') FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") FROM "customers") AS sub WHERE "customers".id = sub.id;
ALTER TABLE "customers" ALTER COLUMN "customerNumber" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_customerNumber_key" UNIQUE ("customerNumber");
