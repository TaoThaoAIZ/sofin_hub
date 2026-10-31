-- Khóa ngoại paidById của CommunityCommissionPayout cần index dẫn đầu (xem tests/perf-sql.test.ts). Additive.
CREATE INDEX "CommunityCommissionPayout_paidById_idx" ON "CommunityCommissionPayout"("paidById");
