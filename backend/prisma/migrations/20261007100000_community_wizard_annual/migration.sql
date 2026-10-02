-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "HostingPlanKey" AS ENUM ('start', 'pro');

-- CreateEnum
CREATE TYPE "HostingPlanStatus" AS ENUM ('trialing', 'active', 'canceled');

-- CreateEnum
CREATE TYPE "PayoutAccountStatus" AS ENUM ('connected', 'skipped');

-- AlterEnum
ALTER TYPE "CommunityModeration" ADD VALUE 'draft';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CourseCategory" ADD VALUE 'music';
ALTER TYPE "CourseCategory" ADD VALUE 'sports';
ALTER TYPE "CourseCategory" ADD VALUE 'spirituality';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "autoApprovePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "coverUrl" TEXT,
ADD COLUMN     "draftSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "introVideoUrl" TEXT,
ADD COLUMN     "joinQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "memberTrialEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priceAnnualCents" INTEGER,
ADD COLUMN     "promise" TEXT,
ADD COLUMN     "requireRulesAgreement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rules" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "JoinRequest" ADD COLUMN     "answers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "rulesAcceptedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "paymentCardId" TEXT;

-- AlterTable

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "paymentCardId" TEXT,
ADD COLUMN     "trialReminderSentAt" TIMESTAMP(3);

-- AlterTable

-- CreateTable
CREATE TABLE "PaymentCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gatewayToken" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HostingPlan" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "planKey" "HostingPlanKey" NOT NULL,
    "cycle" "BillingInterval" NOT NULL DEFAULT 'monthly',
    "priceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "HostingPlanStatus" NOT NULL,
    "trialStartedAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "paymentCardId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "PayoutAccountStatus" NOT NULL,
    "bankName" TEXT,
    "accountHolder" TEXT,
    "accountLast4" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentCard_userId_idx" ON "PaymentCard"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCard_userId_gatewayToken_key" ON "PaymentCard"("userId", "gatewayToken");

-- CreateIndex
CREATE UNIQUE INDEX "HostingPlan_courseId_key" ON "HostingPlan"("courseId");

-- CreateIndex
CREATE INDEX "HostingPlan_ownerId_idx" ON "HostingPlan"("ownerId");

-- CreateIndex
CREATE INDEX "HostingPlan_paymentCardId_idx" ON "HostingPlan"("paymentCardId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_courseId_key" ON "PayoutAccount"("courseId");

-- CreateIndex
CREATE INDEX "PayoutAccount_ownerId_idx" ON "PayoutAccount"("ownerId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentCardId_fkey" FOREIGN KEY ("paymentCardId") REFERENCES "PaymentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_paymentCardId_fkey" FOREIGN KEY ("paymentCardId") REFERENCES "PaymentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCard" ADD CONSTRAINT "PaymentCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingPlan" ADD CONSTRAINT "HostingPlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HostingPlan" ADD CONSTRAINT "HostingPlan_paymentCardId_fkey" FOREIGN KEY ("paymentCardId") REFERENCES "PaymentCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


