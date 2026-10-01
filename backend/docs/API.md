# SofinHub — Tổng quan API backend

> Cập nhật: 2026-09-30 (đã chuyển Postgres thật + tích hợp frontend). Toàn bộ API base URL là `/api` (trừ `/health`). Phản hồi thành công `{ data }`, lỗi `{ error: { code, message, details? } }`.
> Quy ước viết code: [CONVENTIONS.md](./CONVENTIONS.md). Chi tiết từng endpoint (body, response, lỗi) ở các file trong [api/](./api/).
> Tổng cộng ~150 route, **244 test tích hợp (chạy trên Postgres thật)** (`cd backend && npm test`), typecheck (`npm run typecheck`) và build sạch.

## Bản đồ tài liệu theo nhóm

| Nhóm | Tài liệu chi tiết | Nội dung chính |
|---|---|---|
| Auth, hồ sơ, email | [identity.md](./api/identity.md) | đăng ký/đăng nhập, quên & đặt lại & đổi mật khẩu, sửa hồ sơ, xác thực email, phiên đăng nhập, xóa tài khoản, hồ sơ công khai, "cộng đồng/điểm của tôi", newsletter, liên hệ |
| Cộng đồng & thành viên | [communities.md](./api/communities.md) | tạo/sửa/xóa/khóa cộng đồng, 3 luồng tham gia, yêu cầu tham gia, lời mời, đổi vai trò, kick/ban, chuyển quyền, đánh giá |
| Bài viết & sự kiện | [content.md](./api/content.md) | sửa/xóa/ẩn/chia sẻ bài, bình luận, poll, thẻ; sửa/xóa sự kiện, `.ics`, nhắc lịch |
| Kiểm duyệt | [moderation.md](./api/moderation.md) | báo cáo bài/bình luận/thành viên, xử lý báo cáo, admin nền tảng |
| Lớp học | [classroom.md](./api/classroom.md) | CRUD module & bài học, player, tiến độ, khóa theo module/cấp độ, chứng nhận |
| Tìm kiếm | [search.md](./api/search.md) | tìm toàn cục (khóa học, bài viết, thành viên), gợi ý |
| Thông báo | [notifications.md](./api/notifications.md) | danh sách, chưa đọc, tuỳ chọn, realtime SSE |
| Tin nhắn | [messages.md](./api/messages.md) | chat 1-1, chặn người dùng, realtime SSE |
| Upload | [uploads.md](./api/uploads.md) | presign + PUT có chữ ký, phục vụ file, hạn mức |
| Thanh toán | [payments.md](./api/payments.md) | checkout/gói/dùng thử, hủy & tiếp tục, hoàn tiền, hóa đơn, webhook, doanh thu, rút tiền |
| Admin đợt 3 | [admin-batch3.md](./api/admin-batch3.md) | Analytics (users/communities/engagement/retention/revenue/conversion), Support (ticket hỗ trợ: gán/trả lời qua email + thông báo/escalate/giải quyết; form liên hệ và "ticket của tôi"), System (Admin Accounts, Roles & Permissions, Categories, Feature Flags + `GET /api/feature-flags`, Integrations, Notifications/broadcast, Email Templates, Global Settings, Audit export) — `/api/admin/{analytics,support,system}/*`; **phân quyền nhân viên theo vai trò áp cho toàn bộ `/api/admin/*`** |
| Admin đợt 2 | [admin-batch2.md](./api/admin-batch2.md) | Content (posts/comments/courses/lessons/events/media), Payments (transactions/subscriptions/refunds/chargebacks mô phỏng/creator revenue/payouts), Discovery (listed/categories/featured/rankings/search visibility) — `/api/admin/content|payments|discovery/*`; công khai thêm `GET /api/courses/featured`, `GET /api/courses?sort=ranked` |
| Admin đợt 1 | [admin.md](./api/admin.md) | dashboard, quản lý cộng đồng (duyệt/đình chỉ/xóa-khôi phục), người dùng (hạn chế/đình chỉ/cấm), hàng đợi kiểm duyệt, audit log — `/api/admin/*`, nhân viên admin (xem ma trận quyền bên dưới) |
| Đã có từ trước | README.md (mục "API hiện có") | khóa học, danh mục, thống kê, bảng tin cơ bản, lớp học cơ bản, lịch, thành viên, xếp hạng, cấp độ |

## Phân quyền (tập trung tại `src/modules/permissions/policy.ts`)

Thứ bậc: `member < mod < admin < owner < platform_admin`. Platform Admin = email trong biến `PLATFORM_ADMIN_EMAILS` (đội SofinHub, ghi đè Owner).

| Hành động | Vai trò tối thiểu |
|---|---|
| Đọc, đăng bài, bình luận, like, RSVP, học bài | member |
| Ghim/ẩn bài, xóa bình luận người khác, tạo/sửa/xóa sự kiện, quản lý nội dung lớp học, xử lý báo cáo | mod |
| Sửa thông tin cộng đồng, đặt/bỏ mod, kick/ban, duyệt yêu cầu tham gia, tạo lời mời, bật chứng nhận | admin |
| Cấp/thu hồi admin, đổi giá/chế độ riêng tư, xóa cộng đồng, chuyển quyền, xem doanh thu, yêu cầu rút tiền | owner (rút tiền: đúng Owner, không tính Platform Admin) |
| Khóa/mở khóa cộng đồng, duyệt hoàn tiền/rút tiền, xem báo cáo toàn nền tảng | platform_admin |

Kick/ban/đổi vai trò chỉ tác động lên người có bậc **thấp hơn** mình và không bao giờ lên Owner.

### Quyền nhân viên admin (`/api/admin/*`, Admin đợt 3)
Tách biệt với thứ bậc cộng đồng ở trên (nhân viên Moderator/Support/Finance KHÔNG có quyền ghi đè Owner trong cộng đồng; chỉ email trong `PLATFORM_ADMIN_EMAILS` mới có). Mọi route `/api/admin/*` đi qua middleware tập trung `adminOnly` (`src/modules/admin/admin.common.ts`): đăng nhập (401) -> là nhân viên đang hoạt động -> có đúng quyền suy ra từ (method, path) trong `src/modules/admin/admin-staff.permissions.ts` (403). Route không có trong bảng luật chỉ Super Admin được vào.

| Vai trò | Quyền (permission keys) |
|---|---|
| Super Admin (env `PLATFORM_ADMIN_EMAILS` hoặc vai trò `super_admin`) | tất cả 16 khoá |
| Moderator | dashboard.view, community.manage, report.resolve, user.ban, users.view, content.manage, analytics.view |
| Support | dashboard.view, report.resolve, payment.refund, users.view, payment.view, support.manage |
| Finance | dashboard.view, payment.refund, payout.approve, payment.view, payment.manage, analytics.view |
| Vai trò tuỳ chỉnh | tập con do Super Admin chọn ở System > Roles & Permissions (không được có `admin.manage`) |

Route -> quyền: `communities|discovery|system/categories` = community.manage · `content` = content.manage · `moderation` = report.resolve · `users` GET = users.view, ghi = user.ban · `payments` GET = payment.view, duyệt/từ chối hoàn tiền + hoàn tiền giao dịch = payment.refund, còn lại = payment.manage · `analytics` = analytics.view · `support` = support.manage · `audit-logs` = audit.view · `system/flags` = system.flags · `system/{admins,roles}` = admin.manage · `system/{settings,integrations,notifications,email-templates}` = system.settings. Bảng đầy đủ + ví dụ: [api/admin-batch3.md](./api/admin-batch3.md) mục 0. Tài khoản test: `moderator@`, `support@`, `finance@sofinhub.test` (mật khẩu `Passw0rd!x`); `tom@` (Support, không 2FA), `nina@` (Moderator, đã tạm khóa), `john.carter@`/`mia.lopez@` (Moderator).

Giá trị nghiệp vụ "tạm" (hoa hồng, phí cổng, cửa sổ hoàn tiền, ngưỡng rút, ngày dùng thử, chu kỳ gói) nay chỉnh được ở **Admin > System > Global Settings** (`PATCH /api/admin/system/settings`), mặc định lấy từ env (`PLATFORM_COMMISSION_PCT`, `GATEWAY_FEE_PCT`, `GATEWAY_FEE_FIXED_CENTS`, `REFUND_WINDOW_DAYS`, `PAYOUT_MIN_USD`, `TRIAL_DAYS`, `SUBSCRIPTION_PERIOD_DAYS`) và `reset` được về env.

## Mã lỗi nghiệp vụ đáng chú ý
`PAYMENT_REQUIRED` (402) · `JOIN_REQUEST_REQUIRED` (403) · `COMMUNITY_LOCKED` (403) · `MODULE_LOCKED` (403) · `QUOTA_EXCEEDED` (413) ·
`INVITE_REVOKED|INVITE_EXPIRED|INVITE_EXHAUSTED` (410) · `VALIDATION_ERROR` (400) · `UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `CONFLICT` · `TOO_MANY_REQUESTS`.

## Biến môi trường mới (xem `backend/.env.example`)
`PLATFORM_ADMIN_EMAILS`, `FRONTEND_URL`, `SUPPORT_EMAIL`, `UPLOAD_*` (thư mục, bí mật ký, TTL, giới hạn MB, hạn mức mỗi user), `MESSAGE_RATE_LIMIT_PER_MIN`,
`PAYMENT_WEBHOOK_SECRET`, `TRIAL_DAYS`, `SUBSCRIPTION_PERIOD_DAYS`, `REFUND_WINDOW_DAYS`, `PLATFORM_COMMISSION_PCT`, `GATEWAY_FEE_PCT`, `GATEWAY_FEE_FIXED_CENTS`, `PAYOUT_MIN_USD`.
**Production bắt buộc đặt riêng**: `JWT_*_SECRET`, `UPLOAD_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET`.

## Trạng thái dữ liệu & những phần còn MÔ PHỎNG (cập nhật 2026-09-30, sau khi chuyển sang Postgres)
- **Database thật: Postgres 16 + Prisma 7** (`docker compose up -d`, cổng **5435**). 37 bảng, migration trong `backend/prisma/migrations`, dữ liệu test nạp bằng `npm run db:seed` (idempotent). Chi tiết: [DATABASE.md](./DATABASE.md). Test tích hợp chạy trên DB thật (mỗi file test một schema Postgres tạm) — **224 test xanh**.
- **Thu hồi access token tức thì** (đã sửa đúng): JWT mang `sid` + `tv`; `requireAuth`/`optionalAuth` kiểm tra phiên và `User.tokenVersion` trong DB mỗi request. Reset mật khẩu, xóa tài khoản, logout, logout-all, thu hồi phiên, đổi mật khẩu (các phiên khác) làm token cũ 401 ngay. Chi tiết: `docs/api/identity.md`, test `tests/token-revocation.test.ts`.
- **Xóa tài khoản = ẩn danh hóa** (giữ bài viết/bình luận/điểm/thanh toán, tên hiện "Thành viên đã xóa").
- **Thành viên minh họa** là User thật `isDemo=true` (id `demo-<courseId>-<i>`, không đăng nhập được); bài viết/sự kiện/lớp học/điểm/thanh toán minh họa nằm trong DB qua seed, không còn sinh lười khi chạy.
- **Còn mô phỏng / cần làm trước khi lên production:**
  - **Cổng thanh toán chưa chọn**: đang là `MockGateway` (`payments.gateway.ts`). Chờ chốt Stripe hay PayOS/VNPay.
  - **Email chưa gửi thật**: chỉ ghi vào outbox dev (`GET /dev/outbox`). Cần nối AWS SES/SMTP (`setMailProvider()` trong `mail.service.ts`).
  - **Upload lưu ổ đĩa cục bộ**: `StorageProvider` đã tách sẵn, cần hiện thực S3/MinIO; `/files/:key` hiện công khai (bảo mật bằng khóa ngẫu nhiên).
  - **Nhiều instance**: vé & kết nối SSE (thông báo, tin nhắn), rate limit, giãn cách thông báo tin nhắn, nonce vé upload nằm trong bộ nhớ tiến trình; scheduler nhắc lịch/gia hạn gói đã chống trùng bằng DB nhưng cần một chỗ chạy job rõ ràng → cần Redis / hàng đợi job khi chạy >1 instance.
  - Chưa có job dọn Session hết hạn; chưa có `migrate deploy` trong quy trình deploy; tìm kiếm toàn cục lọc trong bộ nhớ trên tập đã lấy từ DB (nâng cấp Postgres full-text sau).

## Quyết định nghiệp vụ CHƯA CHỐT (đang dùng giá trị tạm, cấu hình bằng env)
1. Cổng thanh toán (PLAN câu hỏi #2).
2. Mô hình doanh thu & hoa hồng nền tảng — tạm 10% + phí cổng 2.9% + 30¢ (#6).
3. Chính sách hoàn tiền — tạm hoàn 100% trong 7 ngày đầu, ngoài đó Platform Admin duyệt (#8).
4. Payout — tạm ngưỡng tối thiểu $50, duyệt thủ công (#9).
5. Kick/ban thành viên trả phí có hoàn tiền không; owner đổi giá có ảnh hưởng gói đang thuê không.
6. `/files` cho tệp đính kèm tin nhắn có cần đăng nhập không; xác thực SSE cuối cùng (vé ngắn hạn hay cookie, có bỏ `?access_token=` không).
7. Chứng nhận: mod thêm bài mới sau khi đã cấp thì xử lý thế nào.

## Tích hợp frontend (đã nối 2026-09-30)
Toàn bộ nhóm API đã có giao diện: tài khoản/hồ sơ/quên mật khẩu/phiên đăng nhập; tạo cộng đồng, 3 luồng tham gia, lời mời, yêu cầu tham gia, quản trị thành viên & khu cài đặt cộng đồng, đánh giá; bảng tin đầy đủ (ảnh/thẻ/poll/sửa/xóa/ẩn/báo cáo/chia sẻ), lịch (CRUD, .ics), lớp học (player, tiến độ, trình soạn, chứng nhận), kiểm duyệt; thông báo (SSE), tin nhắn, tìm kiếm, upload; thanh toán/gói/hoàn tiền/hóa đơn, doanh thu & rút tiền, khu quản trị nền tảng. Kịch bản thao tác: `docs/features/*.md` (gốc repo); hướng dẫn test thủ công tổng hợp: `SofinHub_HuongDan_TestThuCong.docx`.
Thiếu ở BE mà FE phải tạm xử lý (việc tiếp theo): endpoint "yêu cầu tham gia của tôi" và "yêu cầu hoàn tiền của tôi", cờ `viewerBanned` trong chi tiết cộng đồng, cờ Platform Admin trong `/auth/me`, tìm người dùng để bắt đầu chat, mã lỗi phân biệt cho 400 đổi/đặt lại mật khẩu, `Retry-After` cho 429, `postId` trong báo cáo bình luận, trường tệp đính kèm cho bài viết (hiện chỉ có `imageUrl`), `stats.admins` chưa đếm thật ở cộng đồng seed.
