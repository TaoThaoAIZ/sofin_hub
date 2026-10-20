-- Đã xem hết video bài học (FE báo khi video kết thúc) — điều kiện để làm trắc nghiệm. Additive.
CREATE TABLE "LessonVideoWatch" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonVideoWatch_pkey" PRIMARY KEY ("userId","lessonId")
);

CREATE INDEX "LessonVideoWatch_lessonId_idx" ON "LessonVideoWatch"("lessonId");

ALTER TABLE "LessonVideoWatch" ADD CONSTRAINT "LessonVideoWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonVideoWatch" ADD CONSTRAINT "LessonVideoWatch_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ClassroomLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
