-- Rút hoa hồng theo từng cộng đồng: yêu cầu rút gắn với cộng đồng (NULL = rút từ ví chung, dữ liệu cũ).
ALTER TABLE "ReferralWithdrawal" ADD COLUMN "communityId" TEXT;
CREATE INDEX "ReferralWithdrawal_communityId_userId_idx" ON "ReferralWithdrawal"("communityId", "userId");
