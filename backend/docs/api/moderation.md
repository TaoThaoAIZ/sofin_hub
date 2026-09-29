# API Kiểm duyệt (`src/modules/moderation`)

Tất cả route cần Bearer token (401). Response `{ data }`, danh sách có `meta` phân trang.

| Method | Path | Quyền | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | `/posts/:id/report` | member cộng đồng | `{reason, detail?}` | 201 `ReportView` | 400 (reason sai / báo cáo bài của mình), 403, 404, 409 (đã báo cáo) |
| POST | `/comments/:id/report` | member | như trên | 201 | như trên |
| POST | `/courses/:id/members/:userId/report` | member | như trên | 201 | 400 (tự báo cáo), 404 (người đó không ở cộng đồng), 409 |
| GET | `/courses/:id/reports` | mod+ (hoặc Platform Admin) | `?status=open\|resolved\|dismissed&page&limit` | `ReportView[]` + meta | 403, 404, 400 |
| GET | `/admin/reports` | Platform Admin | như trên (mọi cộng đồng) | `ReportView[]` + meta | 403 |
| PATCH | `/reports/:id` | mod+ của cộng đồng đó hoặc Platform Admin | `{action: dismiss\|hide_content\|ban_member, note?}` | `ReportView` | 400, 403, 404, 409 (đã xử lý) |

`reason`: `spam | harassment | inappropriate | misinformation | other`. `ReportView` có `status`, `targetType` (`post|comment|member`), `targetId`, `targetExcerpt` (ảnh chụp nội dung lúc báo cáo), `reporterName`, `targetUserName`, `action`, `note`, `resolvedBy`, `resolvedAt`.

## Quy tắc xử lý
- `dismiss` -> status `dismissed`. `hide_content` -> `postsService.setHidden` / `setCommentHidden` (400 với báo cáo thành viên), status `resolved`. `ban_member` -> `enrollmentService.setBanned(userId, courseId, true)` rồi `remove`, status `resolved`.
- Ban bị chặn (403, báo cáo giữ nguyên trạng thái mở) khi mục tiêu là owner, Platform Admin, hoặc có vai trò >= vai trò người xử lý (mod không ban mod/admin; admin ban được mod nhưng không ban admin khác). Thành viên minh họa (`User.isDemo`) không ban được (400). Báo cáo trùng (cùng người báo cáo + đối tượng) bị unique ở DB chặn (409, kể cả song song); xử lý song song cùng báo cáo chỉ một người thành công (người sau 409). Ban ghi `reason` = "Bị báo cáo (<lý do>)" và `bannedById` = người xử lý.
- Sau khi xử lý gửi `report_resolved` cho người báo cáo.
- Ban thành viên chỉ đi qua báo cáo ở module này; API ban trực tiếp do nhóm khác làm.

## Giới hạn / Chưa làm
- In-memory, mất khi restart. Chưa gộp nhiều báo cáo cùng đối tượng: xử lý 1 báo cáo không tự đóng các báo cáo khác của cùng nội dung.
- Chưa có kháng nghị, gỡ ban, hay thông báo cho người bị ẩn nội dung/bị ban.
- Chưa giới hạn tần suất báo cáo (rate limit) ngoài quy tắc 1 lần / đối tượng.
