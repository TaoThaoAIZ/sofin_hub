-- Ẩn danh hóa tài khoản đã xóa: giữ hàng User (bài viết, điểm, thanh toán vẫn còn), đánh dấu thời điểm xóa.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
