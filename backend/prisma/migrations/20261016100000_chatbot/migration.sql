-- Chatbot hỗ trợ (chatbot.md): kho câu hỏi mẫu, tài liệu tri thức, hội thoại.
-- searchVector là cột GENERATED dùng sf_fold()/sf_tags() của migration 20261005100000_search_fulltext.
-- CreateEnum
CREATE TYPE "ChatbotQaStatus" AS ENUM ('active', 'candidate', 'rejected', 'archived', 'stale');

-- CreateEnum
CREATE TYPE "ChatbotQaSource" AS ENUM ('admin', 'learned', 'import');

-- CreateEnum
CREATE TYPE "ChatbotDocStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "ChatbotConversationStatus" AS ENUM ('open', 'handed_off', 'closed');

-- CreateEnum
CREATE TYPE "ChatbotRole" AS ENUM ('user', 'assistant');

-- CreateEnum
CREATE TYPE "ChatbotAnswerSource" AS ENUM ('qa_direct', 'agent', 'refusal', 'handoff', 'error');

-- CreateTable
CREATE TABLE "ChatbotQA" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "answer" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ChatbotQaStatus" NOT NULL DEFAULT 'active',
    "source" "ChatbotQaSource" NOT NULL DEFAULT 'admin',
    "confidence" DOUBLE PRECISION,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "sourceConversationId" TEXT,
    "documentId" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotQA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "status" "ChatbotDocStatus" NOT NULL DEFAULT 'active',
    "contentHash" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotDocChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "ChatbotDocChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ChatbotConversationStatus" NOT NULL DEFAULT 'open',
    "ticketId" TEXT,
    "ticketCode" TEXT,
    "learnedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ChatbotRole" NOT NULL,
    "content" TEXT NOT NULL,
    "answerSource" "ChatbotAnswerSource",
    "matchedQaId" TEXT,
    "toolCalls" JSONB,
    "feedback" INTEGER NOT NULL DEFAULT 0,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatbotMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatbotQA_status_updatedAt_idx" ON "ChatbotQA"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatbotQA_documentId_idx" ON "ChatbotQA"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotDocument_slug_key" ON "ChatbotDocument"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotDocChunk_documentId_position_key" ON "ChatbotDocChunk"("documentId", "position");

-- CreateIndex
CREATE INDEX "ChatbotConversation_userId_lastMessageAt_idx" ON "ChatbotConversation"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatbotConversation_learnedAt_lastMessageAt_idx" ON "ChatbotConversation"("learnedAt", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatbotConversation_status_lastMessageAt_idx" ON "ChatbotConversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatbotMessage_conversationId_createdAt_idx" ON "ChatbotMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatbotQA" ADD CONSTRAINT "ChatbotQA_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ChatbotDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotDocChunk" ADD CONSTRAINT "ChatbotDocChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ChatbotDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotConversation" ADD CONSTRAINT "ChatbotConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatbotMessage" ADD CONSTRAINT "ChatbotMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ChatbotConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Cột tsvector generated (Postgres tự tính, Prisma/seed không ghi).
ALTER TABLE "ChatbotQA" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("question")), 'A') || setweight(to_tsvector('simple', sf_tags("variants")), 'A')
  || setweight(to_tsvector('simple', sf_fold("answer")), 'C')
) STORED;
ALTER TABLE "ChatbotDocChunk" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', sf_fold("heading")), 'A') || setweight(to_tsvector('simple', sf_fold("content")), 'B')
) STORED;

CREATE INDEX "ChatbotQA_searchVector_idx" ON "ChatbotQA" USING GIN ("searchVector");
CREATE INDEX "ChatbotDocChunk_searchVector_idx" ON "ChatbotDocChunk" USING GIN ("searchVector");
