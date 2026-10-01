-- STEP 6 audit §2.1: tách Community / Course ("Khóa học").
--
-- Phase 1 (đổi tên domain): model Prisma `Course` -> `Community` với @@map("Course"), mọi FK `courseId` -> `communityId` với
--   @map("courseId") => KHÔNG có thay đổi DB ở phase này (đã kiểm bằng `prisma migrate diff`: empty migration).
-- Phase 2 (migration này): thêm bảng "LearningCourse" (Prisma model `Course` = khóa học), ClassroomModule/Certificate gắn vào khóa học.
--   Deviation so với expand->migrate->contract của audit: gộp 1 migration vì backfill xác định (1 khóa mặc định / cộng đồng) và
--   không đụng cột cũ — cột "courseId" (id cộng đồng) giữ nguyên nên rollback chỉ cần DROP phần mới.

-- CreateTable
CREATE TABLE "LearningCourse" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "position" INTEGER NOT NULL,
    "publishStatus" "ContentPublishStatus" NOT NULL DEFAULT 'published',
    "certificatesEnabled" BOOLEAN,
    "removedAt" TIMESTAMP(3),
    "modReason" TEXT,
    "modAt" TIMESTAMP(3),
    "modById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCourse_pkey" PRIMARY KEY ("id")
);

-- Expand: cột mới cho phép NULL để backfill.
ALTER TABLE "ClassroomModule" ADD COLUMN "learningCourseId" TEXT;
ALTER TABLE "Certificate" ADD COLUMN "learningCourseId" TEXT;

-- Backfill: mỗi cộng đồng hiện có 1 khóa học mặc định (tên = tên cộng đồng) chứa toàn bộ module cũ.
INSERT INTO "LearningCourse" ("id", "communityId", "title", "description", "thumbnailUrl", "position", "publishStatus", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, c."id", c."title", c."description", c."thumbnail", 1, 'published', c."createdAt", CURRENT_TIMESTAMP
FROM "Course" c;

UPDATE "ClassroomModule" m SET "learningCourseId" = lc."id" FROM "LearningCourse" lc WHERE lc."communityId" = m."courseId";
UPDATE "Certificate" ct SET "learningCourseId" = lc."id" FROM "LearningCourse" lc WHERE lc."communityId" = ct."courseId";

-- Contract: bắt buộc có khóa học.
ALTER TABLE "ClassroomModule" ALTER COLUMN "learningCourseId" SET NOT NULL;
ALTER TABLE "Certificate" ALTER COLUMN "learningCourseId" SET NOT NULL;

-- Chứng nhận: 1 / (user, khóa học) thay cho 1 / (user, cộng đồng).
DROP INDEX "Certificate_userId_courseId_key";
CREATE UNIQUE INDEX "Certificate_userId_learningCourseId_key" ON "Certificate"("userId", "learningCourseId");

-- CreateIndex
CREATE INDEX "LearningCourse_communityId_position_idx" ON "LearningCourse"("communityId", "position");
CREATE INDEX "ClassroomModule_learningCourseId_index_idx" ON "ClassroomModule"("learningCourseId", "index");
CREATE INDEX "Certificate_learningCourseId_idx" ON "Certificate"("learningCourseId");

-- AddForeignKey
ALTER TABLE "LearningCourse" ADD CONSTRAINT "LearningCourse_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomModule" ADD CONSTRAINT "ClassroomModule_learningCourseId_fkey" FOREIGN KEY ("learningCourseId") REFERENCES "LearningCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_learningCourseId_fkey" FOREIGN KEY ("learningCourseId") REFERENCES "LearningCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
