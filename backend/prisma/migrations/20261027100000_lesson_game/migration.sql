-- Trò chơi lật thẻ cuối bài học. Additive.
ALTER TYPE "PointReason" ADD VALUE IF NOT EXISTS 'game_play';

CREATE TABLE "LessonGame" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "pairs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonGame_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LessonGame_lessonId_key" ON "LessonGame"("lessonId");
ALTER TABLE "LessonGame" ADD CONSTRAINT "LessonGame_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ClassroomLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LessonGamePlay" (
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "moves" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "plays" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LessonGamePlay_pkey" PRIMARY KEY ("userId","lessonId")
);
CREATE INDEX "LessonGamePlay_lessonId_idx" ON "LessonGamePlay"("lessonId");
ALTER TABLE "LessonGamePlay" ADD CONSTRAINT "LessonGamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonGamePlay" ADD CONSTRAINT "LessonGamePlay_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "ClassroomLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
