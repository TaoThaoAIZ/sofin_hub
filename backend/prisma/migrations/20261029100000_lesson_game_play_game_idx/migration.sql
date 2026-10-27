-- Index dẫn đầu bằng cột FK gameId (khóa chính (userId, gameId) không phục vụ được tra cứu theo gameId).
CREATE INDEX "LessonGamePlay_gameId_idx" ON "LessonGamePlay"("gameId");
