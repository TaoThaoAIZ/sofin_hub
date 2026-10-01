# Admin console — Đợt 1 (Tổng quan · Cộng đồng · Người dùng · Kiểm duyệt)

Giao diện bám bản thiết kế "SofinHub Admin" (tiếng Việt, theo từ điển của bản thiết kế). Mọi số liệu/nút đều gọi API thật theo `backend/docs/api/admin.md`; sau mỗi thao tác ghi, cache TanStack Query `['admin', ...]` được làm mới và có toast thành công/lỗi. Chỉ Platform Admin vào được (`GET /admin/me`; người khác thấy "Bạn không có quyền truy cập khu vực quản trị"). Màn đăng nhập vẫn là `/login` hiện có.

## Route (`/admin/*`, tải lazy bằng `pages/admin/AdminRoutes.tsx`)
| Route | Màn |
|---|---|
| `/admin` | Tổng quan (KPI, 4 biểu đồ, Cần xử lý, hoạt động gần đây, thao tác nhanh; chip 7/30/90 ngày) |
| `/admin/communities` | Danh sách cộng đồng (KPI từ `summary`, tìm/lọc/sắp xếp, phân trang, menu hàng) |
| `/admin/communities/review?id=` | Xét duyệt: hàng đợi + xem trước + checklist + Duyệt / Yêu cầu chỉnh sửa / Từ chối |
| `/admin/communities/suspended` | Tạm ngưng (tab Tạm ngưng / Hoạt động) + công cụ "Khóa nhanh theo mã/slug" (LockTab cũ) |
| `/admin/communities/trash` | Xóa / Khôi phục (30 ngày) |
| `/admin/communities/:id?tab=` | Chi tiết: Tổng quan · Thành viên · Bài viết & Bình luận · Doanh thu · Kiểm duyệt · Cài đặt (vùng nguy hiểm) |
| `/admin/users`, `/restricted`, `/banned` | Danh sách / Hạn chế-Tạm ngưng / Bị cấm |
| `/admin/users/:id?tab=` | Chi tiết: Tổng quan · Cộng đồng · Hoạt động · Lịch sử mua · Báo cáo/Vi phạm · Bảo mật (thu hồi phiên) |
| `/admin/moderation` | Hàng đợi báo cáo (KPI `summary`, tab trạng thái, lọc rủi ro/lý do/người phụ trách) |
| `/admin/moderation/cases/:id` | Chi tiết vụ việc + bảng quyết định |
| `/admin/moderation/warnings｜removals｜suspensions｜bans` | Nhật ký quyết định (`/moderation/decisions`) |
| `/admin/payments/refunds`, `/payments/payouts` | Dùng lại `RefundsTab` / `PayoutsTab` cũ trong khung admin |
| `/admin/system/audit` | Nhật ký hoạt động (`/admin/audit-logs`) — bonus vì BE đã có |
| `/admin/reports` | Chuyển hướng sang `/admin/moderation` |
| Các mục còn lại của menu | Trang "Sắp có" trong khung admin (Nội dung, Giao dịch/Gói/Tranh chấp/Doanh thu creator, Khám phá, Phân tích, Hỗ trợ, phần còn lại của Hệ thống) |

## Cấu trúc code
- `features/admin/api.ts`, `queries.ts`, `types.ts` — client typed theo hợp đồng (+ hook cũ refunds/payouts/lock giữ nguyên). `types.ts` còn chứa map nhãn tiếng Việt + tone của badge.
- `features/admin/nav.ts` — 10 nhóm menu + submenu; `ready` quyết định mục nào có màn thật.
- `features/admin/components/`
  - `AdminLayout` (sidebar, topbar, tìm kiếm chung Ctrl/⌘K, thao tác nhanh, chuông thông báo, trợ giúp, menu tài khoản, drawer ở màn hẹp, guard quyền), `PageHeader` (breadcrumb, tiêu đề, `DateRangeChips`).
  - `DataTable` (tab đếm, tìm có debounce, lọc dropdown, hàng có nút đầu + menu "…", cột thao tác sticky, phân trang số), `Segment`.
  - `Cards` (KpiGrid, ChartCard SVG, BreakdownCard, KvCard, TimelineCard, AttentionCard, QuickCard, RiskCard, ChecklistCard, DecisionPanel, ContentCard, DangerCard, EntityHeader, Row).
  - `overlay` (ToastProvider/useToast, `useMenu` popover, `ModalShell` + field: OptionChips/CheckField/TextAreaField/InputField/InfoGrid/WarnBox), `ui` (nút, StatusBadge, avatar, Card, Loading/Error/Empty).
  - `ActionModals` (tạm ngưng/xóa/khôi phục/duyệt/yêu cầu chỉnh sửa/từ chối cộng đồng; hạn chế/tạm ngưng/cấm/khôi phục/cảnh cáo người dùng — dùng được cả qua vụ việc; gỡ nội dung; `NoteModal`), `communityActions`, `userActions`, `caseActions` (menu hành động + modal dùng chung), `caseColumns`.
- `features/admin/pages/*` — các view; `pages/admin/*` — wrapper mỏng + `AdminRoutes`.

## API dùng
`/admin/me`, `/admin/dashboard`, `/admin/communities` (+ `summary`, `review-queue`, `trash`, `:id`, `:id/members`, `:id/reports`, `approve|request-changes|reject|suspend|restore|delete|undelete`), `/admin/users` (+ `summary`, `:id`, `communities|activity|purchases|reports`, `sessions/:sid`, `restrict|suspend|ban|reinstate|warn`), `/admin/moderation` (`summary`, `cases`, `cases/:id`, `assign|warn|remove-content|restrict-user|suspend-user|ban-user|dismiss|escalate|resolve`, `decisions`), `/admin/audit-logs`, cùng `/admin/refunds`, `/admin/payouts`, `/admin/courses/:id/lock|unlock` (cũ). Danh mục lấy từ `GET /categories`; nhắn tin chủ sở hữu/người dùng dùng `POST /conversations` có sẵn (BE có thể từ chối nếu không chung cộng đồng — lỗi hiển thị ngay).

## Ghi chú hành vi
- Lý do gửi lên BE là nhãn tiếng Việt (BE nhận chuỗi tự do). "Thời hạn" gửi `duration` (`24h|7d|30d|indefinite`).
- Checklist xét duyệt: các mục tự tính từ `signals` (ảnh bìa, độ dài mô tả, tuổi tài khoản chủ, vi phạm 90 ngày); hai mục "Chất lượng nội dung"/"Tuân thủ chính sách" do người duyệt tự tích (chỉ ở trình duyệt, không lưu BE).
- Hoạt động gần đây của Tổng quan: BE trả câu tiếng Anh ("created a community"…); FE dịch các câu đã biết, câu lạ giữ nguyên.
- Phản hồi thực tế khác hợp đồng ở 3 chỗ (FE theo thực tế): `relatedReports[].reporter` là `{id,name}`; `reportedContent.parentPost` là `{id,excerpt}`; `thread[].reported` (boolean).

## Chưa làm / thiếu (chi tiết ở `frontend/ADMIN_BACKEND_GAPS.md`)
Nút Export, Tạo cộng đồng hộ chủ sở hữu, thao tác hàng loạt (bulk), chip "Hôm nay"/"Tùy chọn" và "So sánh kỳ trước", tab Khóa học/Sự kiện/Bảng xếp hạng của cộng đồng, sửa thông tin cộng đồng từ admin, biểu đồ theo thời gian cho từng cộng đồng, trang "Review Content"/"Review User" riêng của Kiểm duyệt.
