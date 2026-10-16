-- Upload video dài + slide cho bài học (additive).
ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'lesson_video';
ALTER TYPE "UploadPurpose" ADD VALUE IF NOT EXISTS 'lesson_slide';
