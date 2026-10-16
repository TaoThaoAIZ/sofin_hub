-- Chương trình giới thiệu theo từng cộng đồng (chủ cộng đồng đặt %) — additive.
ALTER TYPE "ReferralKind" ADD VALUE IF NOT EXISTS 'community';
ALTER TABLE "Course" ADD COLUMN "referralRateBps" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CommunityReferral" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunityReferral_courseId_referredUserId_key" ON "CommunityReferral"("courseId", "referredUserId");
CREATE INDEX "CommunityReferral_courseId_referrerId_idx" ON "CommunityReferral"("courseId", "referrerId");
CREATE INDEX "CommunityReferral_referredUserId_idx" ON "CommunityReferral"("referredUserId");

ALTER TABLE "CommunityReferral" ADD CONSTRAINT "CommunityReferral_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReferral" ADD CONSTRAINT "CommunityReferral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityReferral" ADD CONSTRAINT "CommunityReferral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
