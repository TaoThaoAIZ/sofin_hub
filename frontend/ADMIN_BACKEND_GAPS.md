# Admin đợt 1 — phần FE cần thêm từ backend (đã ẩn/giảm cấp, không bịa dữ liệu)

| Màn | Thứ cần | Hiện FE xử lý |
|---|---|---|
| Tổng quan | `range=1` (Hôm nay) và khoảng tuỳ chọn `from/to`; `compare=1` (so kỳ trước, vẽ đường nét đứt) | Chỉ có chip 7/30/90 ngày; KPI đã có `deltaPct` từ BE; bỏ nút "So sánh kỳ trước" |
| Tổng quan | Câu mô tả `recentActivity.text` đang tiếng Anh ("created a community", "signed up"...) — cần mã hành động (`code`) hoặc bản tiếng Việt | FE có bảng dịch cho các câu đã biết; câu lạ hiện nguyên văn |
| Tổng quan | Series "Người dùng quay lại" (Returning Users); Failed payouts / Chargebacks / Critical tickets; `openSupportTickets` (null) | Biểu đồ 2 đường thay vì 3; thẻ "Cần xử lý" dùng pendingPayouts/pendingRefunds theo hợp đồng; KPI Ticket thay bằng "Cộng đồng chờ duyệt" |
| Tổng quan, Cộng đồng, Người dùng | Export CSV (dashboard/communities/users) | Ẩn nút Xuất dữ liệu |
| Cộng đồng (danh sách) | Tạo cộng đồng hộ chủ sở hữu (`POST /admin/communities` {name, ownerEmail, category, access, price}); bulk approve/suspend/export; filter `discovery`, `createdFrom/To`, `membersMin/Max`, `revenueMin/Max` | Ẩn nút "Tạo cộng đồng" và thanh bulk; bộ lọc: Trạng thái, Miễn phí/Trả phí, Danh mục, Hiển thị, Sắp xếp |
| Cộng đồng (chi tiết) | Tab Khóa học / Sự kiện / Bảng xếp hạng (list + thao tác admin); danh sách bài viết/bình luận của cộng đồng kèm Hide/Remove/Restore; chuỗi thời gian thành viên & tương tác & doanh thu; danh sách giao dịch theo cộng đồng; sửa thông tin cộng đồng (tên, slug, mô tả, giá, ảnh) | Bỏ các tab đó; tab "Bài viết & Bình luận" chỉ hiện số liệu tổng; tab Doanh thu chỉ KPI; tab Cài đặt chỉ đọc + vùng nguy hiểm |
| Cộng đồng (suspend/delete) | Cờ `notifyOwner` | Bỏ checkbox "Thông báo cho chủ sở hữu" (BE tự quyết) |
| Người dùng | Quốc gia, điện thoại, vai trò (đổi role), 2FA, `lastActiveAt` có giá trị; filter `country`, `signupFrom/To`, `lastActive`; export; bulk suspend | Ẩn các cột/bộ lọc đó |
| Kiểm duyệt (hàng đợi) | Bulk (Approve all/Resolve/Export) | Ẩn thanh bulk |
| Kiểm duyệt (chi tiết) | Tệp bằng chứng (ảnh chụp/link) đính kèm vụ việc; trang riêng "Review Content" (`rcontent`) và "Review User" (`ruser`) | Khối "Bằng chứng" thay bằng "Báo cáo liên quan" + "Vụ việc tương tự"; hành động xử lý nằm ở trang vụ việc |
| Kiểm duyệt (nhật ký) | Lọc theo quản trị viên/lý do; hành động Revoke warning / Unban / Undo removal | Chỉ xem + tìm kiếm; gỡ cấm thực hiện ở Người dùng → Khôi phục |
| Hợp đồng vs thực tế | `relatedReports[].reporter` là object; `reportedContent.parentPost` là object `{id,excerpt}`; `thread[].reported` | FE theo phản hồi thực tế — nên cập nhật `admin.md` |
| Review cộng đồng | Lưu checklist thủ công (Chất lượng nội dung, Tuân thủ chính sách) cùng quyết định | Tích tại trình duyệt, không lưu |
| Hệ thống | Create Admin, Tài khoản quản trị, Vai trò & quyền... | Mục "Sắp có" |

---

# Admin đợt 2 (Nội dung · Thanh toán · Khám phá) — phần FE cần thêm từ backend (đã ẩn/giảm cấp, không bịa dữ liệu)

| Màn | Thứ cần | Hiện FE xử lý |
|---|---|---|
| Bài viết / Bình luận / Khóa học / Bài học / Sự kiện / Media | Danh sách lựa chọn cho bộ lọc "Cộng đồng" và "Tác giả" (vd. `GET /admin/communities?fields=id,name` rút gọn hoặc endpoint autocomplete); BE đã nhận `courseId`/`authorId` | Bỏ dropdown Cộng đồng/Tác giả; thay bằng bộ lọc "Sắp xếp"; trang vẫn đọc `?courseId=` trên URL nên có thể liên kết từ trang cộng đồng |
| Bài viết | Export CSV | Ẩn nút Xuất |
| Bình luận / Khóa học / Bài học / Sự kiện / Media | Thao tác hàng loạt (`/bulk`) — BE chỉ có cho Posts | Chỉ Bài viết có checkbox + thanh Ẩn/Gỡ/Khôi phục |
| Bài học | Tên khóa học (hiện BE chỉ trả `module`); loại "Liên kết" (BE chỉ `video|text|file`) | Cột "Mô-đun" thay "Khóa học"; tab Video/Văn bản/Tệp |
| Bài viết (xem trước) | Ảnh/poll đính kèm (`imageUrl`, `hasPoll` có ở danh sách nhưng chưa vẽ trong modal xem trước) | Modal chỉ hiện văn bản + bình luận + báo cáo + lịch sử |
| Media | Âm thanh thật (BE: `audio` hiện chưa có dữ liệu); Xem trước tệp đã bị gỡ (`url=null`) | Chip Âm thanh vẫn lọc nhưng thường rỗng; nút Xem trước ẩn khi tệp đã gỡ |
| Giao dịch | Export CSV; "Tải biên nhận" (chỉ có `invoiceNumber`, chưa có file PDF); bộ lọc theo Cộng đồng; IP/thiết bị/điểm rủi ro của thanh toán | Ẩn nút Xuất & Tải biên nhận; bộ lọc Trạng thái / Phương thức / Loại (lần đầu-gia hạn) / Sắp xếp; khối "Chi tiết thanh toán" chỉ có cổng, mã tham chiếu, phí, lý do thất bại |
| Gói đăng ký | Tên gói (Pro/Basic…) — BE chỉ có `plan: paid|trial` | Cột "Gói" hiện Trả phí / Dùng thử |
| Hoàn tiền | Trạng thái "Đang xử lý" (BE: duyệt = hoàn ngay); phản hồi của creator (`creatorResponse` luôn null) | Tab: Yêu cầu mới / Hoàn tất / Đã từ chối / Tất cả; khối "Phản hồi của creator" ẩn khi null |
| Tranh chấp | Tích hợp cổng thật (hiện mô phỏng); nút "Tạo tranh chấp giả lập" (`POST /payments/chargebacks`) không có trong thiết kế nên chưa đưa vào UI | Chỉ xử lý các bản ghi sẵn có: Nộp bằng chứng / Chấp nhận / Thắng / Thua |
| Doanh thu creator | Export; so sánh kỳ trước | Chỉ chip 7/30/90 ngày (khoảng `from` tính từ hôm nay) |
| Chi trả | Phương thức: BE trả nhãn (`method.label`); thời điểm "Đã chi" = `updatedAt` khi paid | Hiển thị đúng như BE |
| Khám phá — Nổi bật | Kéo-thả để xếp hạng (thiết kế có biểu tượng kéo) | Chỉ có mũi tên lên/xuống (gọi `reorder`) |
| Khám phá — Xếp hạng | Ghim/đẩy thủ công (thiết kế không có) | Không có |
| Khám phá — Danh mục | Xóa danh mục; sửa `key`/`slug` | Chỉ Thêm (10 khóa cho sẵn) / Sửa tên-mô tả / Lên-xuống / Bật-Tắt |
| Giao dịch (chi tiết) | Tiêu đề/mô tả dòng thời gian đang tiếng Anh ("Payment captured", "9.00 USD via Stripe") — cần mã (`type` đã có) hoặc bản tiếng Việt | FE dịch tiêu đề theo `type`; phần mô tả giữ nguyên văn BE |
| Khám phá — Nổi bật | Nhãn mục `label` tiếng Anh ("Featured Communities"…) | FE dùng nhãn tiếng Việt theo `key` |
| Hợp đồng vs thực tế | "Khóa học" của admin thực chất là `ClassroomModule` (id dạng `mod-…`, `thumbnail` luôn null) | FE hiển thị đúng như BE (avatar chữ cái thay ảnh bìa) |


---

# Admin đợt 3 (Phân tích · Hỗ trợ · Hệ thống) — phần FE cần thêm từ backend (đã ẩn/giảm cấp, không bịa dữ liệu)

| Màn | Thứ cần | Hiện FE xử lý |
|---|---|---|
| Phân tích (tất cả) | Export CSV; khoảng ngày tùy chọn (`from/to`) | Ẩn nút Xuất; chỉ chip 7/30/90 ngày |
| Phân tích → Người dùng | "Nguồn đăng ký" (Organic/Creator referral/Social/Direct/Paid); chuỗi DAU/WAU/MAU theo ngày (BE chỉ trả `activeUsers` mỗi ngày) | Ẩn thẻ "Nguồn đăng ký"; biểu đồ "Người dùng hoạt động" một đường; thẻ "Phân bố địa lý" ẩn khi `geography` rỗng |
| Phân tích → Chuyển đổi | Lượt truy cập (Visit) → bước đầu phễu "Xem trang cộng đồng" và KPI "Truy cập → Đăng ký", "Doanh thu / lượt truy cập" | Phễu bắt đầu từ "Tạo tài khoản"; KPI thay bằng "Đăng ký → Tham gia" và "Doanh thu / lượt đăng ký" |
| Phân tích | `changePct` rất lớn khi kỳ trước gần 0 (vd. +25310%) — cần cờ `baselineTooSmall` hoặc trả null | FE rút gọn (25.3K%) |
| Phân tích → Tương tác / Doanh thu / Người dùng | Nhãn `mix[].label`, `byPlan[].label`, `segments[].label` đang tiếng Anh | FE dịch theo `key` đã biết (likes, comments, completions, posts, new_subscription, renewal...); khóa lạ giữ nhãn BE |
| Hỗ trợ → Ticket | Số lượng theo trạng thái cho các tab (`byStatus`) — summary chỉ có `open`, `unassigned`, `escalated`, `byCategory` | Tab không hiện số đếm |
| Hỗ trợ → Ticket | Tệp đính kèm trong hội thoại; SLA/thời hạn phản hồi; gộp ticket; mẫu trả lời nhanh | Không có |
| Hỗ trợ (phía người dùng) | Màn "Ticket của tôi" cho người dùng (BE đã có `/api/support/tickets`) | Chưa làm — ngoài phạm vi khu Admin |
| Hệ thống → Tài khoản quản trị | 2FA thật (hiện chỉ là cờ lưu trữ); gửi lại lời mời; lịch sử đăng nhập | Hiển thị cờ 2FA đúng như BE; không có "Gửi lại lời mời" |
| Hệ thống → Vai trò & Quyền | Phân nhóm quyền theo `group` trong ma trận; xem danh sách thành viên của vai trò | Ma trận phẳng; thẻ vai trò chỉ hiện số thành viên |
| Hệ thống → Tính năng thử nghiệm | FE công khai chưa đọc `GET /api/feature-flags` (các màn người dùng chưa kiểm tra cờ, kể cả `maintenance`) | Chỉ quản lý cờ ở Admin; cần nối vào FE người dùng ở đợt sau |
| Hệ thống → Tích hợp | Khóa bí mật thật (BE chỉ lưu mask 4 ký tự); trường `config` riêng từng dịch vụ (accountId, webhook...) | Chỉ có Kết nối (khóa API tùy chọn) / Ngắt / Kiểm tra (mô phỏng) |
| Hệ thống → Thông báo | Job gửi cảnh báo/báo cáo định kỳ (BE chỉ lưu cấu hình); đối tượng `users` (danh sách id) cho broadcast | Ghi chú rõ "chỉ lưu cấu hình"; broadcast chỉ có Tất cả/Creator/Trả phí/Một cộng đồng |
| Hệ thống → Mẫu email | Nội dung HTML (BE: văn bản thuần) | Soạn văn bản thuần EN/VI + chip biến theo `variables` của BE |
| Hệ thống → Cài đặt chung | Thực thi `require2fa`, `sessionTimeoutMin`, `currency`, `autoPayouts`, `timezone` (hiện chỉ lưu) | Gắn nhãn "Chỉ lưu cấu hình" cạnh từng mục |
| Nhật ký hoạt động | Nhãn tiếng Việt cho mã hành động (BE trả mã như `ticket.reply`) — thêm trường `actionLabel` hoặc danh sách mã đầy đủ | FE có bảng dịch + quy tắc `<đối tượng>.<động từ>`; mã lạ hiện nguyên mã |
| Phân quyền (toàn khu admin) | Quyền ở mức nút (vd. Support xem Người dùng nhưng không có `user.ban`; Finance xem Thanh toán nhưng không có `payout.approve`) | FE chỉ ẩn nhóm/mục menu và chặn trang theo quyền; nút thao tác vẫn hiện, BE trả 403 -> toast lỗi |
