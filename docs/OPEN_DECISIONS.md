# Câu hỏi cần chốt (tổng hợp 2026-10-03)

Danh sách này gom từ cả ba đợt Admin và các đợt trước. Mỗi mục ghi giá trị đang dùng tạm. Chốt xong thì cập nhật bảng này, `backend/docs/API.md` ("Quyết định nghiệp vụ CHƯA CHỐT") và `PLAN.md`.

## A. Quyết định kinh doanh / sản phẩm (chỉ chủ dự án chốt được)

| # | Câu hỏi | Đang dùng tạm | Chỉnh ở đâu |
|---|---|---|---|
| A1 | % hoa hồng nền tảng | 10% | Admin → Hệ thống → Cài đặt chung (mặc định `PLATFORM_COMMISSION_PCT`) |
| A2 | Thời hạn hoàn tiền 100% | 7 ngày | Cài đặt chung (`REFUND_WINDOW_DAYS`) |
| A3 | Mức rút tiền tối thiểu | $50 | Cài đặt chung (`PAYOUT_MIN_USD`) |
| A4 | Cổng thanh toán: Stripe hay PayOS/VNPay/MoMo | `MockGateway` (giả lập) | code, `payments.gateway.ts` |
| A5 | Kick/ban thành viên đã trả tiền có hoàn tiền không | chưa quy định | code |
| A6 | Xác thực realtime (SSE): vé một lần ngắn hạn hay cookie | đã bỏ `?access_token=`; còn Bearer + vé một lần | code |
| A7 | Cộng đồng user mới tạo có phải qua admin duyệt trước khi hiển thị không | tạo xong là `active` ngay (hàng chờ duyệt chỉ có dữ liệu seed) | code, PLAN câu #7 |
| A8 | Khi cộng đồng bị tạm ngưng hoặc xóa: gói đăng ký đang chạy xử lý thế nào (hủy, hoàn tiền, giữ) | không làm gì | code |
| A9 | Tạm ngưng cộng đồng có tự hết hạn không; xóa mềm 30 ngày có xóa vĩnh viễn tự động không | chưa có job nào | code |
| A10 | Cấm user có gỡ ghi danh khỏi mọi cộng đồng không (mockup nói có) | không gỡ, gỡ cấm thì khôi phục nguyên trạng | code |
| A11 | Trọng số xếp hạng mặc định | giá trị tạm của backend | Admin → Khám phá → Xếp hạng |
| A12 | Quy tắc "ẩn" và "gỡ khỏi Khám phá" (hidden/unlisted), cộng đồng riêng tư có hiện ở `/courses` không | riêng tư hiện "Đã ẩn" ở admin nhưng vẫn có trong `/courses` | code |
| A13 | Công thức điểm chất lượng (qualityScore) | công thức tạm | code |
| A14 | Làm 2FA thật cho admin ở MVP không; có bắt buộc 2FA, hạn phiên, tiền tệ, tự động chi trả, múi giờ | chỉ lưu cấu hình, chưa thực thi | code |
| A15 | Backend có tự chặn tính năng theo feature flag không; frontend người dùng có đọc cờ bảo trì không | chưa | code + FE |

## B. Lỗi / điểm lệch cần sửa (không cần quyết định, chờ làm)

Phát hiện khi viết test case ADM2 và ADM3.

**Đợt 2**
1. Tab "Hoạt động" của Gói đăng ký đếm 30 nhưng liệt kê 35 (gồm dùng thử).
2. Sắp xếp "Điểm chất lượng thấp nhất" (Hiển thị tìm kiếm) thực tế trả điểm cao nhất trước.
3. "Hiển thị lại" trên cộng đồng riêng tư hoặc chờ duyệt báo 409 "đã ở trạng thái listed".
4. Hoàn toàn bộ hoặc chấp nhận chargeback chỉ đánh dấu Payment = refunded, không hủy gói đăng ký.
5. Giao dịch hoàn đủ có "Creator nhận" âm (bằng −phí cổng).
6. Chip 90 ngày không bằng toàn thời gian (110 so với 112 giao dịch).
7. Tab "Tất cả" của Sự kiện chứa sự kiện đã gỡ nhưng số đếm không tính.
8. UI giới hạn trọng số xếp hạng 60%, API cho tới 100%.
9. Media seed chỉ có metadata nên tải xuống và `/api/files/<key>` trả 404.

**Đợt 3**
10. Tạo ticket hộ khách: UI ghi email tùy chọn, backend bắt buộc `requesterEmail` và `category` (để trống thì 400).
11. Khóa feature flag: UI cho `a-z0-9_`, backend yêu cầu bắt đầu bằng chữ và dài 2–60 ký tự.
12. Biến mẫu email: UI cho dấu chấm (`user.name`), backend chỉ nhận chữ, số, gạch dưới.
13. Cài đặt chung lệch khoảng giá trị: `trialDays` (UI cho 0, BE tối thiểu 1), `subscriptionPeriodDays` (UI 365, BE 366), `payoutMinUsd` (UI 100000, BE 1.000.000), phí cố định (BE bắt số nguyên, UI không chặn).
14. Nhật ký hoạt động: nhóm lọc "Hệ thống" luôn rỗng (tìm tiền tố `system.` nhưng không mã nào bắt đầu như vậy); "Nội dung" và "Thanh toán" chỉ khớp một phần; nhiều mã audit hiện nguyên mã vì chưa có bản dịch (`support.ticket.*`, `flag.disable`, `notification.settings_update`, `discovery.search_visibility`, `audit.export`).
15. `admin-batch3.md` ghi route chi trả chỉ có GET (`payment.view`), nhưng code có POST `/admin/payments/payouts/*` cần `payout.approve`.
16. UI cài đặt ghi "thành viên sẽ thấy trang bảo trì" nhưng frontend người dùng chưa đọc `GET /api/feature-flags`.
17. Nhãn vai trò UI (Kiểm duyệt viên / Hỗ trợ / Tài chính) khác API (Moderator / Support / Finance).
18. Tài liệu: dòng audit seed ghi ticket T-2002 (thực tế T-2001), ví dụ `require2fa:true` (mặc định thật là false), `ADMIN_BACKEND_GAPS` ghi `ticket.reply` (thực tế `support.ticket.reply`).
19. Tạm khóa hoặc gỡ nhân viên chỉ chặn `/admin`, không thu hồi phiên đăng nhập thường. Super Admin vẫn gán được `super_admin` cho người khác. Trả lời ticket với trạng thái mặc định sẽ mở lại ticket đã Resolved.
20. Tab ticket không có số đếm và không có tab "Đã đóng".
21. Chưa ẩn nút theo quyền (Support vẫn thấy nút Cấm người dùng; backend trả 403).

## C. Chưa làm (đã biết, chờ ưu tiên)

- Export CSV (Analytics, Nội dung, Thanh toán), tải biên nhận, thao tác hàng loạt ngoài Bài viết, kéo-thả xếp hạng nổi bật, ghim bài viết, boost xếp hạng thủ công.
- Tab Khóa học / Sự kiện / Xếp hạng trong chi tiết cộng đồng; trang "Review Content" / "Review User" riêng.
- Màn "Ticket của tôi" cho người dùng; SLA, đính kèm, nhận trả lời qua email cho ticket.
- Job gửi cảnh báo admin tự động; mẫu email DB ngoài `verify_email`/`reset_password`.
- Tích hợp thật (hiện mô phỏng); chargeback, retry, payout là giả lập.
- Màn hình Login của admin (mockup chưa xong).

## D. Việc không phải code

- Xem giao diện admin trên trình duyệt và gửi ảnh chỗ lệch mockup (chưa ai xem).
- Dữ liệu thử còn sót trong DB dev: ticket T-2001 (đóng rồi, không xóa được). `npm run db:reset` dọn sạch.

## E. Đã chốt (không cần hỏi lại)

| # | Nội dung | Kết quả |
|---|---|---|
| E1 | **Tách Community / Course** (audit §2.1, bước 6) | ✅ Đã làm theo hướng **đổi tên + entity Khóa học**: Prisma `Course`→`Community` (bảng `Course` giữ nguyên) và thêm entity `Course` mới (bảng `LearningCourse`) — một cộng đồng có nhiều khóa học, module/chứng nhận gắn theo khóa. API cũ `/courses/:id/*` giữ nguyên + route chuẩn `/communities/:id/*`. `SofinHub-BRD.docx` mục 5.2/6 đã ghi "một cộng đồng có nhiều khóa học" — nay đúng với code. Chi tiết: `backend/docs/api/communities-courses.md`, `backend/docs/DATABASE.md`. Việc còn lại: FE chuyển dần sang `/communities` + `communityId`; bỏ alias `courseId` khi FE đã đổi. |
