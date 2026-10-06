-- CreateEnum
CREATE TYPE "ModuleAccessMode" AS ENUM ('all', 'level', 'paid', 'selected');

-- CreateEnum
CREATE TYPE "ModuleAccessSource" AS ENUM ('selected', 'purchase');

-- AlterTable
ALTER TABLE "ClassroomModule" ADD COLUMN "accessMode" "ModuleAccessMode" NOT NULL DEFAULT 'all',
ADD COLUMN "priceCents" INTEGER,
ADD COLUMN "sequential" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ClassroomLesson" ADD COLUMN "isPreview" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: module đang yêu cầu cấp độ -> accessMode = level
UPDATE "ClassroomModule" SET "accessMode" = 'level' WHERE "requiredLevel" IS NOT NULL;

-- CreateTable
CREATE TABLE "ModuleAccess" (
    "moduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ModuleAccessSource" NOT NULL DEFAULT 'selected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModuleAccess_pkey" PRIMARY KEY ("moduleId","userId")
);

-- CreateIndex
CREATE INDEX "ModuleAccess_userId_idx" ON "ModuleAccess"("userId");

-- AddForeignKey
ALTER TABLE "ModuleAccess" ADD CONSTRAINT "ModuleAccess_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ClassroomModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleAccess" ADD CONSTRAINT "ModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
