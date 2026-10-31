-- Theo dõi "đã xem hết" theo từng video của bài (video chính = 'main', video bổ sung = mã băm URL). Dòng cũ giữ nguyên là video chính.
ALTER TABLE "LessonVideoWatch" ADD COLUMN "videoKey" TEXT NOT NULL DEFAULT 'main';
ALTER TABLE "LessonVideoWatch" DROP CONSTRAINT "LessonVideoWatch_pkey";
ALTER TABLE "LessonVideoWatch" ADD CONSTRAINT "LessonVideoWatch_pkey" PRIMARY KEY ("userId","lessonId","videoKey");
