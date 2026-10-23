-- Chủ cộng đồng tự chi trả hoa hồng giới thiệu (chuyển khoản ngoài hệ thống rồi ghi nhận). Additive.
CREATE TABLE "CommunityCommissionPayout" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "paidById" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "commissionCount" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityCommissionPayout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CommunityCommissionPayout_courseId_createdAt_idx" ON "CommunityCommissionPayout"("courseId", "createdAt");
CREATE INDEX "CommunityCommissionPayout_referrerId_idx" ON "CommunityCommissionPayout"("referrerId");
ALTER TABLE "CommunityCommissionPayout" ADD CONSTRAINT "CommunityCommissionPayout_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityCommissionPayout" ADD CONSTRAINT "CommunityCommissionPayout_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityCommissionPayout" ADD CONSTRAINT "CommunityCommissionPayout_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" ADD COLUMN "payoutId" TEXT;
CREATE INDEX "ReferralCommission_payoutId_idx" ON "ReferralCommission"("payoutId");
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CommunityCommissionPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
