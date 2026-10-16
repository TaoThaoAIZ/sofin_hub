-- Tiến độ onboarding của thành viên trong cộng đồng (xem video giới thiệu, tải app) — additive.
CREATE TABLE "CommunityOnboarding" (
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "videoAt" TIMESTAMP(3),
    "appAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommunityOnboarding_pkey" PRIMARY KEY ("userId","courseId")
);

CREATE INDEX "CommunityOnboarding_courseId_idx" ON "CommunityOnboarding"("courseId");

ALTER TABLE "CommunityOnboarding" ADD CONSTRAINT "CommunityOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityOnboarding" ADD CONSTRAINT "CommunityOnboarding_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
