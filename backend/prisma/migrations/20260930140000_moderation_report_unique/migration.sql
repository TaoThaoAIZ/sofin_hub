-- Chống báo cáo trùng: mỗi (người báo cáo, loại đối tượng, đối tượng) chỉ một báo cáo. Thay index thường cùng cột.
DROP INDEX "Report_reporterId_targetType_targetId_idx";
CREATE UNIQUE INDEX "Report_reporterId_targetType_targetId_key" ON "Report"("reporterId", "targetType", "targetId");
