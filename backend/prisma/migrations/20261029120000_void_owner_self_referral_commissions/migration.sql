-- Chủ cộng đồng không nhận hoa hồng giới thiệu từ chính doanh thu cộng đồng của mình (xem community-referral.service.ts).
-- Hủy các khoản đã phát sinh trước khi có quy tắc này mà chưa được chi trả / chưa nằm trong đợt chi trả nào.
UPDATE "ReferralCommission" rc
SET "status" = 'void'
WHERE rc."kind" = 'community'
  AND rc."status" = 'pending'
  AND rc."payoutId" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Enrollment" e
    WHERE e."courseId" = rc."communityId" AND e."userId" = rc."referrerId" AND e."role" = 'owner'
  );
