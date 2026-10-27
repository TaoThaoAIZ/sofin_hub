-- Nhiều trò chơi mỗi bài (lật thẻ / nối cặp / đúng-sai / xếp từ). Trò chơi lật thẻ cũ giữ nguyên thành kind = 'memory'.
DROP INDEX "LessonGame_lessonId_key";
ALTER TABLE "LessonGame" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'memory';
ALTER TABLE "LessonGame" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "LessonGame_lessonId_position_idx" ON "LessonGame"("lessonId", "position");

-- Kết quả theo từng trò chơi: gắn kết quả cũ vào trò chơi duy nhất của bài.
ALTER TABLE "LessonGamePlay" ADD COLUMN "gameId" TEXT;
UPDATE "LessonGamePlay" p SET "gameId" = g."id" FROM "LessonGame" g WHERE g."lessonId" = p."lessonId";
DELETE FROM "LessonGamePlay" WHERE "gameId" IS NULL;
ALTER TABLE "LessonGamePlay" ALTER COLUMN "gameId" SET NOT NULL;
ALTER TABLE "LessonGamePlay" DROP CONSTRAINT "LessonGamePlay_pkey";
ALTER TABLE "LessonGamePlay" ADD CONSTRAINT "LessonGamePlay_pkey" PRIMARY KEY ("userId", "gameId");
ALTER TABLE "LessonGamePlay" ADD CONSTRAINT "LessonGamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "LessonGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
