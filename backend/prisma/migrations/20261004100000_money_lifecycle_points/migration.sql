-- STEP 2/3 audit: khóa vòng đời tiền (gói duy nhất, hoàn tiền 2 pha, webhook có trạng thái, sổ nợ owner) + khóa nghiệp vụ điểm.
-- Không xóa dữ liệu; backfill an toàn.

-- Dọn gói trùng TRƯỚC khi tạo unique index: mỗi (user, course) chỉ giữ 1 gói trialing/active (ưu tiên active, rồi mới nhất);
-- các gói thừa chuyển sang canceled (không xóa để giữ lịch sử thanh toán).
UPDATE "Subscription" s SET "status" = 'canceled', "canceledAt" = COALESCE(s."canceledAt", now()), "cancelAtPeriodEnd" = false
WHERE s."status" IN ('trialing', 'active') AND EXISTS (
  SELECT 1 FROM "Subscription" k
  WHERE k."userId" = s."userId" AND k."courseId" = s."courseId" AND k."status" IN ('trialing', 'active') AND k."id" <> s."id"
    AND (CASE k."status" WHEN 'active' THEN 1 ELSE 0 END, k."createdAt", k."id") > (CASE s."status" WHEN 'active' THEN 1 ELSE 0 END, s."createdAt", s."id")
);

CREATE UNIQUE INDEX "Subscription_one_live_per_user_course" ON "Subscription"("userId", "courseId") WHERE "status" IN ('trialing', 'active');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('received', 'processing', 'done', 'failed');

-- CreateEnum
CREATE TYPE "OwnerLedgerKind" AS ENUM ('refund_after_payout', 'chargeback_after_payout', 'adjustment');

-- AlterEnum
ALTER TYPE "PointReason" ADD VALUE 'revoked';

-- AlterEnum
ALTER TYPE "RefundStatus" ADD VALUE 'refunding';

-- AlterTable
ALTER TABLE "PointEvent" ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- AlterTable
ALTER TABLE "RefundRequest" ADD COLUMN     "gatewayRefundId" TEXT,
ADD COLUMN     "refundingAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "processingAt" TIMESTAMP(3),
ADD COLUMN     "status" "WebhookStatus" NOT NULL DEFAULT 'done',
ADD COLUMN     "type" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "OwnerBalanceLedger" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ownerId" TEXT,
    "kind" "OwnerLedgerKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerBalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerBalanceLedger_courseId_createdAt_idx" ON "OwnerBalanceLedger"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "OwnerBalanceLedger_ownerId_idx" ON "OwnerBalanceLedger"("ownerId");

-- CreateIndex
CREATE INDEX "PointEvent_sourceType_sourceId_idx" ON "PointEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "PointEvent_userId_reason_sourceType_sourceId_key" ON "PointEvent"("userId", "reason", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_updatedAt_idx" ON "WebhookEvent"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "OwnerBalanceLedger" ADD CONSTRAINT "OwnerBalanceLedger_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Webhook cũ đều là đã claim (coi như done); từ giờ mặc định received.
UPDATE "WebhookEvent" SET "processedAt" = "receivedAt" WHERE "processedAt" IS NULL;
ALTER TABLE "WebhookEvent" ALTER COLUMN "status" SET DEFAULT 'received';
