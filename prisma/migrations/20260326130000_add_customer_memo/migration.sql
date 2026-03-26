-- CreateTable
CREATE TABLE "customer_memos" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_memos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_memos_organizationId_customerId_createdAt_idx" ON "customer_memos"("organizationId", "customerId", "createdAt");

-- AddForeignKey
ALTER TABLE "customer_memos" ADD CONSTRAINT "customer_memos_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
