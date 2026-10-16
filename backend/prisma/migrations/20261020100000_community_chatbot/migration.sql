-- Chatbot riêng cho từng cộng đồng (chatbot.md): kho Q&A / tài liệu / hội thoại có communityId (cột "courseId" theo quy ước bảng
-- "Course"); NULL = bot hỗ trợ nền tảng "Tào" (dữ liệu cũ giữ nguyên NULL). Cấu hình bot + nhân cách thành viên chọn.
-- Tìm kiếm toàn văn cho bài học & sự kiện (dùng lại sf_fold từ 20261005100000_search_fulltext).

-- AlterTable
ALTER TABLE "ChatbotQA" ADD COLUMN "courseId" TEXT;
ALTER TABLE "ChatbotDocument" ADD COLUMN "courseId" TEXT;
ALTER TABLE "ChatbotConversation" ADD COLUMN "courseId" TEXT;

-- CreateTable
CREATE TABLE "CommunityBot" (
    "courseId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "botName" TEXT NOT NULL DEFAULT 'Trợ lý',
    "welcomeText" TEXT NOT NULL DEFAULT '',
    "personaKey" TEXT NOT NULL DEFAULT 'mentor',
    "customPersona" JSONB,
    "memberPersonaKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "extraInstructions" TEXT NOT NULL DEFAULT '',
    "freeDailyMessages" INTEGER NOT NULL DEFAULT 10,
    "vipDailyMessages" INTEGER NOT NULL DEFAULT 100,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityBot_pkey" PRIMARY KEY ("courseId")
);

-- CreateTable
CREATE TABLE "CommunityBotMemberPref" (
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "personaKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityBotMemberPref_pkey" PRIMARY KEY ("courseId","userId")
);

-- CreateIndex
CREATE INDEX "ChatbotQA_courseId_status_idx" ON "ChatbotQA"("courseId", "status");
CREATE INDEX "ChatbotDocument_courseId_status_idx" ON "ChatbotDocument"("courseId", "status");
CREATE INDEX "ChatbotConversation_courseId_userId_lastMessageAt_idx" ON "ChatbotConversation"("courseId", "userId", "lastMessageAt");
CREATE INDEX "CommunityBotMemberPref_userId_idx" ON "CommunityBotMemberPref"("userId");

-- AddForeignKey
ALTER TABLE "ChatbotQA" ADD CONSTRAINT "ChatbotQA_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatbotDocument" ADD CONSTRAINT "ChatbotDocument_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatbotConversation" ADD CONSTRAINT "ChatbotConversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBot" ADD CONSTRAINT "CommunityBot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBotMemberPref" ADD CONSTRAINT "CommunityBotMemberPref_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommunityBotMemberPref" ADD CONSTRAINT "CommunityBotMemberPref_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tìm kiếm toàn văn bài học / sự kiện (cột generated: seed/Prisma không ghi).
ALTER TABLE "ClassroomLesson" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("title")), 'A') || setweight(to_tsvector('simple', sf_fold("body")), 'B')
) STORED;
ALTER TABLE "CommunityEvent" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("title")), 'A') || setweight(to_tsvector('simple', sf_fold("description")), 'B')
) STORED;
CREATE INDEX "ClassroomLesson_searchVector_idx" ON "ClassroomLesson" USING GIN ("searchVector");
CREATE INDEX "CommunityEvent_searchVector_idx" ON "CommunityEvent" USING GIN ("searchVector");
