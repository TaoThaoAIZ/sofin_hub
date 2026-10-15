-- Mọi khóa ngoại phải có index dẫn đầu bằng cột FK (tests/perf-sql.test.ts): referrerId chỉ nằm sau communityId ở index ghép.
CREATE INDEX "CommunityReferral_referrerId_idx" ON "CommunityReferral"("referrerId");
