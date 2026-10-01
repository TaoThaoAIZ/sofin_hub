# Admin console — Đợt 2 (Nội dung · Thanh toán · Khám phá)

Nối tiếp đợt 1 (`admin-batch1.md`), cùng khung `AdminLayout`, cùng bộ component dùng chung và cùng quy ước: giao diện tiếng Việt theo từ điển của bản thiết kế "SofinHub Admin", mọi số liệu/nút gọi API thật theo `backend/docs/api/admin-batch2.md`, thao tác ghi xong thì làm mới cache TanStack Query `['admin', ...]` và hiện toast thành công/lỗi (lỗi API hiện ngay trong modal). Chỉ Platform Admin vào được.

## Route (`/admin/*`, nằm trong `pages/admin/AdminRoutes.tsx` — tải lazy)
| Route | Màn |
|---|---|
| `/admin/content/posts` | Bài viết: KPI (Tổng/Hôm nay/Bị báo cáo/Đã gỡ), tab trạng thái có đếm, tìm kiếm, sắp xếp, chọn nhiều dòng + Ẩn/Gỡ/Khôi phục hàng loạt, menu hàng, modal Xem trước |
| `/admin/content/comments` | Bình luận (cùng mẫu Bài viết, cột Bài viết gốc) |
| `/admin/content/courses` | Khóa học: Xem trước (danh sách bài học), Xuất bản / Hủy xuất bản / Lưu trữ / Gỡ / Khôi phục |
| `/admin/content/lessons` | Bài học: tab loại (Video/Văn bản/Tệp), Ẩn / Gỡ / Khôi phục |
| `/admin/content/events` | Sự kiện: Xem (RSVP), Sửa, Hủy (thông báo người đăng ký), Gỡ, Khôi phục |
| `/admin/content/media` | Thư viện media: chuyển Lưới/Bảng, chip loại + trạng thái, Xem trước / Tải xuống (kèm Bearer) / Gắn cờ / Bỏ cờ / Gỡ / Khôi phục |
| `/admin/payments/tx`, `/tx/:id` | Giao dịch: KPI theo chip 7/30/90 ngày, lọc, Hoàn tiền (cả một phần); chi tiết: KPI, 3 thẻ KV, dòng thời gian, chi tiết cổng, hoàn tiền & tranh chấp liên quan, lịch sử; Thử lại khi thất bại |
| `/admin/payments/subs` | Gói đăng ký: KPI, tab, Tạm dừng / Tiếp tục / Hủy (có tùy chọn "hủy cuối kỳ"); "Xem" mở tab Lịch sử mua của người dùng |
| `/admin/payments/refunds`, `/refunds/:id` | Hoàn tiền (thay `RefundsTab` cũ): danh sách + màn chi tiết có Lịch sử thanh toán, Lịch sử khách hàng, bảng quyết định (Duyệt / Hoàn một phần / Từ chối) |
| `/admin/payments/chargebacks` | Tranh chấp: KPI, tab, Nộp bằng chứng / Chấp nhận / Thắng / Thua / Xem |
| `/admin/payments/creator`, `/creator/:userId` | Doanh thu creator: danh sách + chi tiết (KPI, biểu đồ gộp/thuần/hoàn tiền, cộng đồng, giao dịch, chi trả) |
| `/admin/payments/payouts` | Chi trả (thay `PayoutsTab` cũ): KPI, tab 7 trạng thái, hành động theo trạng thái (Duyệt, Đã chi trả, Tạm giữ, Giải ngân, Thử lại, Đánh dấu thất bại, Từ chối), modal Xem xét kèm số dư creator |
| `/admin/discovery/listed` | Cộng đồng hiển thị: tab, lọc danh mục, Đưa lên nổi bật / Bỏ nổi bật / Ẩn / Gỡ khỏi Khám phá / Hiển thị lại |
| `/admin/discovery/categories` | Danh mục: Thêm, Sửa, Chuyển lên/xuống, Bật/Tắt |
| `/admin/discovery/featured` | Nổi bật: 4 mục (2 mục/hàng), xếp hạng bằng mũi tên, ngày bắt đầu/kết thúc, gỡ, "Tìm & thêm cộng đồng" |
| `/admin/discovery/rankings` | Xếp hạng: thanh trọng số −/+ (bước 5), xem trước trực tiếp (gọi `POST /rankings/preview`), Áp dụng xếp hạng, Đặt lại |
| `/admin/discovery/seo` | Hiển thị tìm kiếm: KPI, tab, Cho phép / Giảm hiển thị / Ẩn khỏi tìm kiếm |

Đường dẫn menu giữ nguyên khóa của bản thiết kế (`payments/tx`, `payments/subs`, `payments/creator`, `discovery/seo`...); `nav.ts` đã đánh dấu `ready` cho toàn bộ mục của 3 nhóm nên các trang "Sắp có" của nhóm này không còn.

## Cấu trúc code
- `features/admin/types.batch2.ts` — kiểu theo hợp đồng + map nhãn/tone tiếng Việt (trạng thái nội dung, giao dịch, gói, hoàn tiền, tranh chấp, chi trả, khám phá...).
- `features/admin/queries.batch2.ts` — hook chung: `useAdminList(key, path, query)` (phân trang, giữ dữ liệu cũ khi đổi trang), `useAdminData(key, path, query)` (summary/chi tiết/cấu hình), `useAdminAction()` (POST/PATCH/PUT/DELETE bất kỳ; xong thì `invalidateQueries(['admin'])`). Không có lớp `api.ts` riêng cho đợt 2 vì endpoint đồng dạng — đường dẫn nằm ngay ở từng view.
- `features/admin/components/Batch2Parts.tsx` — mảnh dùng chung mới: `ActionDialog` (modal lý do + ghi chú + checkbox + gõ từ xác nhận, gọi API thật, hiện lỗi trong modal), `PreviewDialog/PreviewKv/PreviewSection/HistoryList` (xem nhanh), `MediaGrid`, `FactorsCard` (trọng số), `FeaturedCard`, `BarCell`, `DateInput`, `useDialogSlot`, `useTableState`.
- `DataTable` được mở rộng (không phá đợt 1): `select` + `bulkBar` (checkbox đầu dòng & thanh thao tác hàng loạt).
- `features/admin/pages/ContentViews.tsx`, `PaymentsViews.tsx`, `DiscoveryViews.tsx` — các view; `pages/admin/ContentPages.tsx|PaymentsPages.tsx|DiscoveryPages.tsx` — wrapper mỏng.
- `RefundsTab` / `PayoutsTab` / `useAdminRefunds` / `useResolveRefund`... trong `AdminTabs.tsx`/`queries.ts` không còn được route nào dùng (giữ lại vì `LockTab` cùng file vẫn dùng ở "Tạm ngưng"); logic hoàn tiền/chi trả giờ đi qua `/admin/payments/refunds|payouts/*` của đợt 2 (cùng service phía BE).

## API dùng
Xem `backend/docs/api/admin-batch2.md`: `/admin/content/{posts,comments,courses,lessons,events,media}` (summary, list, :id, hide|remove|restore|publish|unpublish|archive|cancel|flag|unflag, PATCH sự kiện, `posts/bulk`, `media/:key/download`), `/admin/payments/{transactions,subscriptions,refunds,chargebacks,creators,payouts}` (summary, list, :id, các hành động), `/admin/discovery/{communities,categories,featured,rankings,search-visibility}`.

## Ghi chú hành vi
- Lý do gửi lên BE là nhãn tiếng Việt (chuỗi tự do ≤ 500 ký tự), "Thông báo cho tác giả/người đăng ký/chủ tệp" ánh xạ `notifyAuthor|notifyAttendees|notifyOwner`.
- Chip 7/30/90 ngày của Giao dịch/Doanh thu creator gửi `from = yyyy-mm-dd` (hôm nay trừ n ngày) cho cả KPI lẫn bảng.
- Hoàn tiền một phần: số tiền nhập bằng USD, kiểm tra 0.01 ≤ số tiền ≤ phần còn lại ở FE, BE vẫn là nơi quyết định cuối cùng (409/400 hiện trong modal).
- Bảng "Xem trước xếp hạng" gọi `POST /discovery/rankings/preview` mỗi khi chỉnh trọng số (không lưu) cho tới khi bấm "Áp dụng xếp hạng" (`PUT /discovery/rankings`).
- Trong "Nổi bật", đổi ngày gọi `PATCH /discovery/featured/:entryId` ngay khi chọn xong ngày; xóa trắng ô ngày = bỏ giới hạn.

## Chưa làm / thiếu
Chi tiết ở `frontend/ADMIN_BACKEND_GAPS.md` (mục "Admin đợt 2"): Export CSV, tải biên nhận, bộ lọc Cộng đồng/Tác giả dạng dropdown, thao tác hàng loạt ngoài Bài viết, kéo-thả xếp hạng (chỉ có mũi tên), tên gói đăng ký, phản hồi creator trong hoàn tiền, nút tạo tranh chấp giả lập.
