-- Xóa cuộc trò chuyện phía mình: lưu mốc seq đã xóa của từng phía.
ALTER TABLE "Conversation" ADD COLUMN "clearedSeqA" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Conversation" ADD COLUMN "clearedSeqB" INTEGER NOT NULL DEFAULT 0;
