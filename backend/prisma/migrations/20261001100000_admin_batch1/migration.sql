-- CreateEnum
CREATE TYPE "ReportRisk" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'restricted', 'suspended', 'banned');

-- CreateEnum
CREATE TYPE "CommunityModeration" AS ENUM ('pending_review', 'changes_requested', 'rejected', 'active', 'suspended', 'deleted');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportAction" ADD VALUE 'warn_user';
ALTER TYPE "ReportAction" ADD VALUE 'remove_content';
ALTER TYPE "ReportAction" ADD VALUE 'restrict_user';
ALTER TYPE "ReportAction" ADD VALUE 'suspend_user';
ALTER TYPE "ReportAction" ADD VALUE 'ban_user';
ALTER TYPE "ReportAction" ADD VALUE 'none';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportReason" ADD VALUE 'hate_speech';
ALTER TYPE "ReportReason" ADD VALUE 'scam';
ALTER TYPE "ReportReason" ADD VALUE 'copyright';
ALTER TYPE "ReportReason" ADD VALUE 'nsfw';

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'under_review';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "deleteReason" TEXT,
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "moderatedById" TEXT,
ADD COLUMN     "moderationNote" TEXT,
ADD COLUMN     "moderationReason" TEXT,
ADD COLUMN     "moderationStatus" "CommunityModeration" NOT NULL DEFAULT 'active',
ADD COLUMN     "moderationUntil" TIMESTAMP(3),
ADD COLUMN     "moderationUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "preDeleteStatus" "CommunityModeration";

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "caseNo" SERIAL NOT NULL,
ADD COLUMN     "escalatedAt" TIMESTAMP(3),
ADD COLUMN     "risk" "ReportRisk" NOT NULL DEFAULT 'low';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active',
ADD COLUMN     "statusChangedAt" TIMESTAMP(3),
ADD COLUMN     "statusChangedById" TEXT,
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "statusRestrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "statusUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ReportEvent" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL DEFAULT '',
    "reason" TEXT,
    "note" TEXT,
    "evidence" TEXT,
    "caseId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportEvent_reportId_createdAt_idx" ON "ReportEvent"("reportId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorId_createdAt_idx" ON "AdminAuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_createdAt_idx" ON "AdminAuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_action_createdAt_idx" ON "AdminAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Course_moderationStatus_idx" ON "Course"("moderationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Report_caseNo_key" ON "Report"("caseNo");

-- CreateIndex
CREATE INDEX "Report_status_risk_createdAt_idx" ON "Report"("status", "risk", "createdAt");

-- CreateIndex
CREATE INDEX "Report_targetUserId_idx" ON "Report"("targetUserId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvent" ADD CONSTRAINT "ReportEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportEvent" ADD CONSTRAINT "ReportEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

