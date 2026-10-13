-- Thư viện ảnh/video giới thiệu cộng đồng + mục đích upload mới.
ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'community_media';
ALTER TABLE "Course" ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]';
