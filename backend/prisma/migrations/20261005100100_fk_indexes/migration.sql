-- STEP 8 audit §6.4: index cho các cột khóa ngoại còn thiếu (Postgres không tự tạo; mỗi DELETE User/Course phải seq-scan để cascade)
-- + index cho feed sort=popular, lọc category/tag.

CREATE INDEX "Certificate_courseId_idx" ON "Certificate"("courseId");
CREATE INDEX "CommunityBan_userId_idx" ON "CommunityBan"("userId");
CREATE INDEX "CommunityBan_bannedById_idx" ON "CommunityBan"("bannedById");
CREATE INDEX "CommunityEvent_hostId_idx" ON "CommunityEvent"("hostId");
CREATE INDEX "Invite_createdById_idx" ON "Invite"("createdById");
CREATE INDEX "JoinRequest_decidedById_idx" ON "JoinRequest"("decidedById");
CREATE INDEX "Notification_courseId_idx" ON "Notification"("courseId");
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");
CREATE INDEX "PostLikeNotice_userId_idx" ON "PostLikeNotice"("userId");
CREATE INDEX "RefundRequest_userId_idx" ON "RefundRequest"("userId");
CREATE INDEX "RefundRequest_resolvedById_idx" ON "RefundRequest"("resolvedById");
CREATE INDEX "Report_resolvedById_idx" ON "Report"("resolvedById");
CREATE INDEX "Review_userId_idx" ON "Review"("userId");
CREATE INDEX "Upload_courseId_idx" ON "Upload"("courseId");
-- Thêm bởi các đợt sau (đã kiểm bằng pg_constraint ⋈ pg_index):
CREATE INDEX "Report_assignedToId_idx" ON "Report"("assignedToId");
CREATE INDEX "ReportEvent_actorId_idx" ON "ReportEvent"("actorId");
CREATE INDEX "Chargeback_userId_idx" ON "Chargeback"("userId");
CREATE INDEX "DiscoveryFeature_courseId_idx" ON "DiscoveryFeature"("courseId");

-- Feed: sort=popular (pinned DESC, likesCount DESC, createdAt DESC => quét ngược index này), lọc category.
CREATE INDEX "Post_courseId_pinned_likesCount_createdAt_idx" ON "Post"("courseId", "pinned", "likesCount", "createdAt");
CREATE INDEX "Post_courseId_category_createdAt_idx" ON "Post"("courseId", "category", "createdAt");

-- Lọc theo thẻ: chuẩn hóa thẻ (trim, bỏ '#', chữ thường) thành hàm IMMUTABLE để dựng GIN index trên mảng đã chuẩn hóa.
CREATE OR REPLACE FUNCTION sf_tagnorm(t text[]) RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
$fn$ SELECT COALESCE(array_agg(lower(regexp_replace(btrim(x), '^#', ''))), '{}'::text[]) FROM unnest(t) AS x $fn$;
CREATE INDEX "Post_tagsnorm_gin_idx" ON "Post" USING GIN ((sf_tagnorm("tags")));
