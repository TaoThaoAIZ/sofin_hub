-- Ảnh khách gửi cho chatbot Tào.
ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'chatbot_image';
ALTER TABLE "ChatbotMessage" ADD COLUMN "attachments" JSONB;
