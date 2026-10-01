-- CreateEnum
CREATE TYPE "ContentPublishStatus" AS ENUM ('published', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "DiscoveryStatus" AS ENUM ('listed', 'hidden', 'unlisted');

-- CreateEnum
CREATE TYPE "SearchVisibility" AS ENUM ('searchable', 'reduced', 'hidden');

-- CreateEnum
CREATE TYPE "ChargebackStatus" AS ENUM ('open', 'under_review', 'won', 'lost');

-- CreateEnum
CREATE TYPE "ChargebackReason" AS ENUM ('fraudulent', 'product_not_received', 'duplicate', 'subscription_cancelled', 'unrecognized', 'product_not_as_described');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CourseCategory" ADD VALUE 'marketing';
ALTER TYPE "CourseCategory" ADD VALUE 'design';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PayoutStatus" ADD VALUE 'failed';
ALTER TYPE "PayoutStatus" ADD VALUE 'on_hold';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SubscriptionStatus" ADD VALUE 'past_due';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'paused';

-- AlterTable
ALTER TABLE "ClassroomLesson" ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClassroomModule" ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "publishStatus" "ContentPublishStatus" NOT NULL DEFAULT 'published',
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CommunityEvent" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "discoveryReason" TEXT,
ADD COLUMN     "discoveryStatus" "DiscoveryStatus" NOT NULL DEFAULT 'listed',
ADD COLUMN     "discoveryUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "discoveryUpdatedById" TEXT,
ADD COLUMN     "searchVisibility" "SearchVisibility" NOT NULL DEFAULT 'searchable';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "failureReason" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "heldFromStatus" "PayoutStatus";

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PostComment" ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "flagReason" TEXT,
ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modAt" TIMESTAMP(3),
ADD COLUMN     "modById" TEXT,
ADD COLUMN     "modReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Chargeback" (
    "id" TEXT NOT NULL,
    "caseNo" SERIAL NOT NULL,
    "paymentId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" "ChargebackReason" NOT NULL,
    "status" "ChargebackStatus" NOT NULL DEFAULT 'open',
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "evidenceNote" TEXT,
    "evidenceUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceSubmittedAt" TIMESTAMP(3),
    "gatewayDisputeId" TEXT,
    "resolutionNote" TEXT,
    "resolvedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Chargeback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryCategory" (
    "key" "CourseCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCategory_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "DiscoveryFeature" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "DiscoveryFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chargeback_caseNo_key" ON "Chargeback"("caseNo");

-- CreateIndex
CREATE INDEX "Chargeback_status_deadlineAt_idx" ON "Chargeback"("status", "deadlineAt");

-- CreateIndex
CREATE INDEX "Chargeback_paymentId_idx" ON "Chargeback"("paymentId");

-- CreateIndex
CREATE INDEX "Chargeback_courseId_idx" ON "Chargeback"("courseId");

-- CreateIndex
CREATE INDEX "DiscoveryFeature_section_position_idx" ON "DiscoveryFeature"("section", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryFeature_section_courseId_key" ON "DiscoveryFeature"("section", "courseId");

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chargeback" ADD CONSTRAINT "Chargeback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryFeature" ADD CONSTRAINT "DiscoveryFeature_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Dữ liệu nền: 8 danh mục hiện có (khớp meta /categories cũ) để Discovery và /categories chạy ngay, kể cả DB test.
INSERT INTO "DiscoveryCategory" ("key", "name", "position", "updatedAt") VALUES
  ('business', 'Kinh doanh', 1, CURRENT_TIMESTAMP),
  ('content', 'Sáng tạo nội dung', 2, CURRENT_TIMESTAMP),
  ('tech', 'Công nghệ', 3, CURRENT_TIMESTAMP),
  ('finance', 'Tài chính', 4, CURRENT_TIMESTAMP),
  ('health', 'Sức khỏe', 5, CURRENT_TIMESTAMP),
  ('self', 'Phát triển bản thân', 6, CURRENT_TIMESTAMP),
  ('hobby', 'Sở thích', 7, CURRENT_TIMESTAMP),
  ('relationships', 'Mối quan hệ', 8, CURRENT_TIMESTAMP);
