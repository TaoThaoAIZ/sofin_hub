-- Bỏ "dùng thử miễn phí" cho thành viên: cộng đồng chỉ có 2 loại — miễn phí hoặc trả phí.
-- Gói đang `trialing` (nếu còn) tự hết quyền khi đến hạn (job payments.subscriptions); không tạo gói dùng thử mới nữa.
UPDATE "Course" SET "memberTrialEnabled" = false WHERE "memberTrialEnabled" = true;
UPDATE "Course" SET "pricing" = 'paid' WHERE "pricing" = 'trial';
ALTER TABLE "Course" ALTER COLUMN "memberTrialEnabled" SET DEFAULT false;
