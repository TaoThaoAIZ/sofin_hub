-- Lời chào thành viên mới + thông báo popup của chủ cộng đồng (docs/features/community-greetings.md).

-- CreateTable
CREATE TABLE "CommunityWelcome" (
    "courseId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "message" TEXT NOT NULL DEFAULT '',
    "enabledSince" TIMESTAMP(3),
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityWelcome_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "CommunityWelcomeSeen" (
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityWelcomeSeen_pkey" PRIMARY KEY ("userId","courseId")
);

-- CreateTable
CREATE TABLE "CommunityAnnouncement" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityAnnouncementSeen" (
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityAnnouncementSeen_pkey" PRIMARY KEY ("announcementId","userId")
);

-- CreateIndex
CREATE INDEX "CommunityAnnouncement_courseId_active_createdAt_idx" ON "CommunityAnnouncement"("courseId", "active", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityWelcomeSeen_courseId_idx" ON "CommunityWelcomeSeen"("courseId");

-- CreateIndex
CREATE INDEX "CommunityAnnouncement_authorId_idx" ON "CommunityAnnouncement"("authorId");

-- CreateIndex
CREATE INDEX "CommunityAnnouncementSeen_userId_idx" ON "CommunityAnnouncementSeen"("userId");

-- AddForeignKey
ALTER TABLE "CommunityWelcome" ADD CONSTRAINT "CommunityWelcome_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityWelcomeSeen" ADD CONSTRAINT "CommunityWelcomeSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityWelcomeSeen" ADD CONSTRAINT "CommunityWelcomeSeen_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncement" ADD CONSTRAINT "CommunityAnnouncement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncement" ADD CONSTRAINT "CommunityAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncementSeen" ADD CONSTRAINT "CommunityAnnouncementSeen_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "CommunityAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityAnnouncementSeen" ADD CONSTRAINT "CommunityAnnouncementSeen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

