# Admin đợt 3 — Phân tích · Hỗ trợ · Hệ thống (+ khung admin theo quyền)

Hợp đồng backend: `backend/docs/api/admin-batch3.md`. Phần chưa có ở BE: `frontend/ADMIN_BACKEND_GAPS.md` (mục "Admin đợt 3").
Bám bản thiết kế `admin/template.html` + `7d49dc6a-*.javasc` (P.analytics / P.support / P.system), nhãn tiếng Việt theo từ điển `36181b3d-*.javasc`.

## Khung admin theo quyền
- `GET /admin/me` trả `adminRole` + `permissions[]` (16 khóa). `types.ts › AdminMe` có các trường này (thiếu `permissions` = đủ quyền, tương thích BE cũ).
- `queries.ts › useCan()` -> `can('analytics.view')`.
- `nav.ts`: mỗi nhóm/mục con có `perm`; `visibleNav(can)` ẩn mục không có quyền và ẩn cả nhóm khi không còn mục nào; `requiredPerm(pathname)` cho biết quyền cần của trang.
- `AdminLayout.tsx`: Sidebar dùng `visibleNav`; `GuardedOutlet` hiện "Không đủ quyền" ngay trong khung admin khi đường dẫn cần quyền mà vai trò không có; Thao tác nhanh + tìm kiếm chung chỉ gọi API/hiện mục mà vai trò có quyền; Topbar hiện tên vai trò.
- Bản đồ quyền: Tổng quan→`dashboard.view`; Cộng đồng / Khám phá / Hệ thống›Danh mục→`community.manage`; Người dùng→`users.view`; Nội dung→`content.manage`; Kiểm duyệt→`report.resolve`; Thanh toán→`payment.view`; Phân tích→`analytics.view`; Hỗ trợ→`support.manage`; Tài khoản quản trị & Vai trò→`admin.manage`; Tính năng thử nghiệm→`system.flags`; Tích hợp / Thông báo / Mẫu email / Cài đặt chung→`system.settings`; Nhật ký→`audit.view`.
- Không còn "Sắp có": đã xóa `ComingSoon`/`ComingSoonPage`; `AdminRoutes` không còn route giữ chỗ (đường dẫn lạ -> về `/admin`).

## Routes (đều nằm trong `AdminRoutes`, tải lazy)
| Đường dẫn | Component | API |
|---|---|---|
| `/admin/analytics/users` | `AnalyticsUsersView` | `GET /admin/analytics/users?range` |
| `/admin/analytics/communities` | `AnalyticsCommunitiesView` | `.../communities` |
| `/admin/analytics/engagement` | `AnalyticsEngagementView` | `.../engagement` |
| `/admin/analytics/retention` | `AnalyticsRetentionView` (bản đồ nhiệt cohort + cột "quay lại") | `.../retention` |
| `/admin/analytics/revenue` | `AnalyticsRevenueView` | `.../revenue` |
| `/admin/analytics/conversion` | `AnalyticsConversionView` (phễu + cột) | `.../conversion` |
| `/admin/support/tickets` · `user` · `creator` · `payment` | `SupportView({category})` | `GET /admin/support/summary`, `/assignees`, `/tickets`, `/tickets/:id`; `POST` create / assign / reply / note / escalate / resolve / close / reopen; `PATCH` ticket |
| `/admin/system/admins` | `AdminAccountsView` | `/system/admins` (+ suspend/enable/reset-2fa/DELETE/PATCH), `/system/roles` cho danh sách vai trò |
| `/admin/system/roles` | `RolesView` (`PermissionMatrix`) | `GET/POST /system/roles`, `PATCH /system/roles/:key {permission, granted}`, `DELETE` |
| `/admin/system/categories` | `CategoriesView base="/system/categories"` (dùng lại editor của Khám phá) | `/system/categories*` |
| `/admin/system/flags` | `FlagsView` | `/system/flags` (+ `/toggle`, PATCH, DELETE) |
| `/admin/system/integrations` | `IntegrationsView` | `/system/integrations` (+ connect/disconnect/test) |
| `/admin/system/notifications` | `NotificationsView` (3 form cảnh báo + gửi thông báo + lịch sử) | `GET/PUT /system/notifications/settings`, `POST /preview`, `POST /broadcast`, `GET /broadcasts` |
| `/admin/system/email` | `EmailTemplatesView` + `TemplateEditor` (chip biến, xem trước tại chỗ, bản từ máy chủ, gửi thử) | `/system/email-templates` (+ preview, test-send) |
| `/admin/system/audit` | `AuditView` (Thời gian · Quản trị viên (+vai trò) · Hành động · Đối tượng · Vụ việc · IP; lọc Admin/Nhóm/Hành động/khoảng ngày; chi tiết; Xuất CSV) | `/audit-logs`, `/audit-logs/filters`, `/audit-logs/export` |
| `/admin/system/settings` | `SettingsView` | `GET/PATCH /system/settings`, `POST /system/settings/reset` |

## Thành phần mới / dùng lại
- Mới: `components/Batch3Parts.tsx` — `Toggle`, `BarChartCard`, `FunnelCard`, `CohortHeatmap`, `PermissionMatrix`, `VariableChips` / `useInsertable` / `EmailPreview` / `renderTemplate`, `SettingRow` / `SettingInput`.
- Mới: `types.batch3.ts` (kiểu + nhãn tiếng Việt: trạng thái ticket, ưu tiên, nhãn quyền/vai trò, `auditLabel`), `pages/{AnalyticsViews,SupportViews,SystemAccessViews,SystemConfigViews,EmailTemplatesView}.tsx`, `pages/admin/{AnalyticsPages,SupportPages}.tsx`.
- Dùng lại từ đợt 1–2: `KpiGrid`, `ChartCard`, `BreakdownCard`, `Row`, `DataTable`, `DateRangeChips`, `ActionDialog`, `PreviewDialog`, `HistoryList`, `useAdminData/useAdminList/useAdminAction` (`queries.batch2.ts`), `CategoriesView` (thêm prop `base`).
- Quy ước giữ nguyên: mọi thao tác ghi gọi API thật qua `useAdminAction` -> invalidate `['admin']`, toast thành công/lỗi (`useToast`), lỗi hiện trong modal; mọi danh sách có trạng thái tải/lỗi/rỗng.

## Hành vi đáng chú ý
- Ma trận quyền: bấm ô -> `PATCH {permission, granted}`; cột Super Admin khóa; `admin.manage` chỉ cho Super Admin (FE chặn trước + BE 400/409).
- Cài đặt chung: chỉ gửi các trường đã đổi; kiểm tra khoảng giá trị trước khi lưu; bật Bảo trì cần xác nhận; mục "Chỉ lưu cấu hình" ghi rõ; mục bị ghi đè hiện "Mặc định: X · Khôi phục".
- Ticket: bấm dòng mở chi tiết (hội thoại, ghi chú nội bộ, trả lời + chọn trạng thái sau khi gửi, lịch sử); hành động trong dòng theo trạng thái (đã xử lý/đóng -> chỉ "Xem/Mở lại").
- Mẫu email: soạn tiếng Anh (bắt buộc) + tiếng Việt, chèn biến vào ô đang focus, cảnh báo biến chưa khai báo, xem trước ngay bằng dữ liệu mẫu chỉnh được.

## Khoảng trống đã biết
Xem `frontend/ADMIN_BACKEND_GAPS.md` mục "Admin đợt 3".
