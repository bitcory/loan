-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerType" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "residentNumber" TEXT,
    "businessNumber" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collaterals" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "collateralType" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "detailAddress" TEXT,
    "area" DECIMAL(10,2) NOT NULL,
    "appraisalValue" DECIMAL(15,0) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collaterals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mortgages" (
    "id" TEXT NOT NULL,
    "collateralId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "mortgageType" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "maxClaimAmount" DECIMAL(15,0) NOT NULL,
    "loanAmount" DECIMAL(15,0),
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortgages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "collateralId" TEXT,
    "loanAmount" DECIMAL(15,0) NOT NULL,
    "balance" DECIMAL(15,0) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL,
    "repaymentType" TEXT NOT NULL,
    "loanTermMonths" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "overdueStage" TEXT NOT NULL DEFAULT 'NORMAL',
    "overdueDays" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedules" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalAmount" DECIMAL(15,0) NOT NULL,
    "interestAmount" DECIMAL(15,0) NOT NULL,
    "totalAmount" DECIMAL(15,0) NOT NULL,
    "remainingBalance" DECIMAL(15,0) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "paidAmount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "paidDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "principalAmount" DECIMAL(15,0) NOT NULL,
    "interestAmount" DECIMAL(15,0) NOT NULL,
    "overdueAmount" DECIMAL(15,0) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(15,0) NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loans_loanNumber_key" ON "loans"("loanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "collaterals" ADD CONSTRAINT "collaterals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mortgages" ADD CONSTRAINT "mortgages_collateralId_fkey" FOREIGN KEY ("collateralId") REFERENCES "collaterals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_collateralId_fkey" FOREIGN KEY ("collateralId") REFERENCES "collaterals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
