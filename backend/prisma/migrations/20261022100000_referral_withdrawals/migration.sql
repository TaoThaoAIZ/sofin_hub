-- Rút hoa hồng giới thiệu (cơ chế giống nạp: mã tham chiếu + SePay đối soát tiền ra).

-- CreateEnum
CREATE TYPE "ReferralWithdrawalStatus" AS ENUM ('requested', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "ReferralPayoutAccount" (
    "userId" TEXT NOT NULL,
    "bankBin" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumberEnc" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralPayoutAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ReferralWithdrawal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "refCode" TEXT NOT NULL,
    "status" "ReferralWithdrawalStatus" NOT NULL DEFAULT 'requested',
    "bankBin" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumberEnc" TEXT NOT NULL,
    "accountLast4" TEXT NOT NULL,
    "note" TEXT,
    "bankTxExternalId" TEXT,
    "resolvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralWithdrawal_refCode_key" ON "ReferralWithdrawal"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralWithdrawal_bankTxExternalId_key" ON "ReferralWithdrawal"("bankTxExternalId");

-- CreateIndex
CREATE INDEX "ReferralWithdrawal_userId_createdAt_idx" ON "ReferralWithdrawal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralWithdrawal_status_createdAt_idx" ON "ReferralWithdrawal"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ReferralPayoutAccount" ADD CONSTRAINT "ReferralPayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralWithdrawal" ADD CONSTRAINT "ReferralWithdrawal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
