/*
  Warnings:

  - Made the column `organizationId` on table `collaterals` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `customers` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `loan_schedules` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `loans` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `mortgages` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `payments` required. This step will fail if there are existing NULL values in that column.
  - Made the column `organizationId` on table `settings` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "collaterals" DROP CONSTRAINT "collaterals_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "loan_schedules" DROP CONSTRAINT "loan_schedules_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "loans" DROP CONSTRAINT "loans_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "mortgages" DROP CONSTRAINT "mortgages_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "settings" DROP CONSTRAINT "settings_organizationId_fkey";

-- DropIndex
DROP INDEX "loans_loanNumber_key";

-- DropIndex
DROP INDEX "settings_key_key";

-- AlterTable
ALTER TABLE "collaterals" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "detailAddress" TEXT,
ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "loan_schedules" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "loans" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "mortgages" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "organizationId" SET NOT NULL;

-- AlterTable
ALTER TABLE "settings" ALTER COLUMN "organizationId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
