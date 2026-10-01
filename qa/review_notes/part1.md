# Rà soát case cũ trong gen_testcases.py (Part 1: HOME, AUTH cũ, COMM, COMMVP, COURSE, FEED, MEMBER, EVENT, NOTI, PAY cũ, ADMIN cũ, SEC, ROLE, INTEG)

Nguồn so sánh: code `backend/src`, `frontend/src`, `backend/docs/**`, `docs/OPEN_DECISIONS.md`, `e2e/parsed_results.json`. Case bị loại nằm trong `qa/retired_part_1.py` (giữ số thứ tự, lưu vào `qa/archive/retired_cases.csv`). Case thay thế được thêm CUỐI module trong khối `# ---- Case THAY THẾ` của `gen_testcases.py` (sau khi nạp `cases_*.py`).

## Tổng kết theo module

| Module | Tổng case cũ | Giữ nguyên | Sửa | Loại |
|---|---|---|---|---|
| HOME | 32 | 22 | 4 | 6 |
| AUTH | 36 | 26 | 6 | 4 |
| COMM | 32 | 0 | 3 | 29 |
| COMMVP | 27 | 0 | 3 | 24 |
| COURSE | 20 | 4 | 2 | 14 |
| FEED | 18 | 0 | 2 | 16 |
| MEMBER | 12 | 0 | 0 | 12 |
| EVENT | 12 | 0 | 1 | 11 |
| NOTI | 12 | 0 | 3 | 9 |
| PAY | 26 | 0 | 2 | 24 |
| ADMIN | 12 | 0 | 2 | 10 |
| SEC | 11 | 7 | 2 | 2 |
| ROLE | 18 | 1 | 0 | 17 |
| INTEG | 13 | 2 | 3 | 8 |
| **Tổng** | 281 | 62 | 33 | 186 |

Case thay thế thêm cuối module: HOME +4, AUTH +1, COURSE +2 (7 case, không có kết quả).

## Chi tiết SỬA tại chỗ (UPDATE)

| TC | Tiêu đề (giữ nguyên) | Quyết định | Lý do / bằng chứng |
|---|---|---|---|
| TC-ADMIN-006 | Chuyển đổi giao diện giữa Tiếng Việt và Tiếng Anh | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): chưa có công tắc ngôn ngữ giao diện; topbar cộng đồng chỉ có nhãn tĩnh 'VI' (xem TC-ADMIN-077) |
| TC-ADMIN-012 | Ngôn ngữ đã chọn được ghi nhớ giữa các lần truy cập | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): phụ thuộc tính năng đổi ngôn ngữ giao diện (xem TC-ADMIN-006) |
| TC-AUTH-015 | Giới hạn số lần đăng nhập sai liên tiếp (chống dò mật khẩu) | SỬA (tiền điều kiện,bước,dữ liệu,kết quả mong đợi); Test1=Pass | Từ lần SAI thứ 11 trong cửa sổ 15 phút (sớm hơn nếu IP đã có lần sai trước đó) API trả 429 TOO_MANY_REQUESTS 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút' và FE hiển thị lỗi; chỉ đếm lần đăng nhập THẤT BẠI (loginLimiter trong auth.routes.ts) |
| TC-AUTH-019 | Đăng nhập bằng Google | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): nút Google ở /login chỉ hiện 'Tính năng sắp ra mắt' và chưa gọi API (xem TC-AUTH-069) |
| TC-AUTH-020 | Đăng nhập bằng Facebook | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): nút Facebook ở /login chỉ hiện 'Tính năng sắp ra mắt' và chưa gọi API (xem TC-AUTH-069) |
| TC-AUTH-024 | Bật 2FA cho tài khoản Owner/Admin | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): chưa có 2FA cho người dùng/Owner; 2FA của nhân viên admin chỉ lưu cấu hình, chưa thực thi (docs/OPEN_DECISIONS A14; xem TC-AUTH-071) |
| TC-AUTH-029 | Tài khoản bị tạm khóa do đăng nhập sai nhiều lần vẫn từ chối dù nhập đúng mật khẩu | SỬA (tiền điều kiện,bước,kết quả mong đợi); Test1=Pass | Vẫn 429 (bị chặn dù mật khẩu đúng) cho tới khi hết cửa sổ 15 phút. Lưu ý đây là rate limit theo IP chứ không phải khóa tài khoản (xem case 'Giới hạn đăng nhập sai tính theo IP...' cuối module) |
| TC-AUTH-036 | API từ chối request dùng access token cũ ngay sau khi đăng xuất | SỬA (kết quả mong đợi); Test1=Fail | API từ chối ngay bằng 401, không chờ access token hết hạn. LỖI CŨ ĐÃ SỬA: access token mang sid + tv, requireAuth/optionalAuth tra phiên và User.tokenVersion trong DB mỗi request (backend/docs/api/identity.md 'Thu hồi access token có hiệu lực NGAY'; tests/token-revocation.test.ts). Kết quả Fail trước đây là của bản cũ - CẦN CHẠY LẠI Test 1 |
| TC-COMM-010 | Tab Giới thiệu hiển thị đúng thông tin cộng đồng | SỬA (bước,kết quả mong đợi); Test1=Chưa test | Hiển thị thông tin chung (công khai/riêng tư, số thành viên, giá), mô tả, khối nội dung/lớp học và thông tin chủ cộng đồng đúng như đã cấu hình (dữ liệu thật từ API, không còn mẫu) |
| TC-COMM-026 | Thành viên từng bị loại khỏi cộng đồng riêng tư gửi lại yêu cầu tham gia | SỬA (kết quả mong đợi); Test1=Chưa test | Yêu cầu mới được tạo bình thường (201, chờ duyệt): kick KHÔNG phải cấm - kick xóa ghi danh và thu hồi các yêu cầu 'approved' cũ (communities.service.kick). Nếu người đó bị CẤM (ban) thì 403 'Bạn đã bị cấm khỏi cộng đồng này' (xem TC-COMM-090) |
| TC-COMM-031 | Cộng đồng riêng tư không hiển thị đầy đủ trên trang khám phá công khai | SỬA (kết quả mong đợi); Test1=Chưa test | Cộng đồng riêng tư vẫn xuất hiện trong danh sách Khám phá (có thể lọc 'Loại: Riêng tư' - quyết định A12 trong docs/OPEN_DECISIONS.md chưa chốt) nhưng người chưa được duyệt chỉ thấy trang giới thiệu /communities/:id với nút 'Gửi yêu cầu tham gia'; nội dung các tab bị chặn (API 403, FE chuyển về trang giới thiệu). [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT] |
| TC-COMMVP-022 | Chặn truy cập nội dung cộng đồng trước khi xác nhận thanh toán | SỬA (tiền điều kiện,bước,kết quả mong đợi); Test1=Chưa test | API 403 (requireMembership), FE chuyển về /communities/:id; intent pending KHÔNG cấp quyền - chỉ sau confirm thành công (hoặc bắt đầu dùng thử) mới vào được (xem TC-PAY-043) |
| TC-COMMVP-026 | Vào thẳng URL /courses/:id/community khi chưa tham gia sẽ bị chuyển hướng | SỬA (bước,kết quả mong đợi); Test1=Chưa test | FE (CommunityPage) <Navigate> về /communities/:id (URL cũ /courses/:id/* qua LegacyCourseRedirect rồi cũng bị chuyển); quyền thật vẫn do từng API con tự kiểm ở server (403), không tin riêng cờ viewerEnrolled ở FE |
| TC-COMMVP-027 | Bấm 'Tham gia ngay' trên khóa có phí hiện dialog xác nhận trước khi sang trang thanh toán | SỬA (kết quả mong đợi); Test1=Chưa test | Hiện hộp thoại 'Khóa học có phí' nêu giá ($x/tháng) + ghi chú dùng thử (nếu có), nút 'Đi tới thanh toán' -> /communities/:id/checkout và nút 'Để sau' đóng hộp thoại. Cộng đồng miễn phí bỏ qua hộp thoại, vào thẳng /communities/:id/community; cộng đồng riêng tư dùng luồng 'Gửi yêu cầu tham gia' |
| TC-COURSE-016 | Giao diện khác nhau giữa người đã tham gia và chưa tham gia khóa học | SỬA (kết quả mong đợi); Test1=Pass | Tài khoản đã tham gia thấy nút xanh 'Đã tham gia' (bấm lại sẽ rời cộng đồng) và vào được /communities/:id/community; tài khoản chưa tham gia thấy 'Tham gia ngay' (riêng tư: 'Gửi yêu cầu tham gia'; đã gửi: 'Đã gửi yêu cầu - chờ duyệt'), không lẫn lộn |
| TC-COURSE-017 | Khóa học chưa có đánh giá nào vẫn hiển thị đúng, không lỗi | SỬA (tiền điều kiện,kết quả mong đợi); Test1=N/A | Khu vực 'Đánh giá' hiển thị trạng thái rỗng (reviews = []), điểm trung bình không hiện NaN, thành viên có thể là người đánh giá đầu tiên |
| TC-EVENT-005 | Thêm sự kiện vào Google Calendar | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): chỉ có tải .ics (một sự kiện hoặc cả cộng đồng, nhập được vào Google/Apple/Outlook); chưa có nút 'Thêm vào Google Calendar' |
| TC-FEED-003 | Đăng bài viết kèm video | SỬA (tiền điều kiện); Test1=Chưa test | Là thành viên của cộng đồng. CHƯA LÀM (Kế hoạch): bài viết chỉ hỗ trợ 1 ảnh (imageUrl) + poll, chưa có video/tệp đính kèm (backend/docs/API.md 'Thiếu ở BE') |
| TC-FEED-011 | Tự động tải thêm bài viết khi cuộn xuống cuối trang | SỬA (tiền điều kiện); Test1=Chưa test | Cộng đồng có nhiều bài (> 10). HIỆN TẠI là nút 'Tải thêm bài viết (đã hiện/tổng)' (FeedTab.tsx, phân trang cursor keyset) - CHƯA có tự tải khi cuộn (nút hiện có được kiểm ở TC-FEED-132) |
| TC-HOME-009 | Lọc theo khoảng giá | SỬA (tiền điều kiện,bước,dữ liệu,kết quả mong đợi); Test1=Pass | Mỗi lựa chọn chỉ hiển thị cộng đồng đúng loại giá (Có phí: giá > 0; Miễn phí: giá = 0; Dùng thử: có dùng thử miễn phí); số 'Tìm thấy N khóa học' khớp; chọn lại mục đang chọn sẽ bỏ lọc |
| TC-HOME-013 | Kết hợp nhiều bộ lọc cùng lúc (danh mục + giá + loại) | SỬA (bước,dữ liệu,kết quả mong đợi); Test1=Pass | Kết quả thỏa mãn đồng thời tất cả điều kiện lọc (logic AND giữa các nhóm filter), số 'Tìm thấy N' cập nhật, về trang 1 |
| TC-HOME-021 | Kiểm tra số liệu tổng học viên/khóa học/đánh giá hiển thị đúng | SỬA (tiền điều kiện,bước,kết quả mong đợi); Test1=Pass | Số liệu khớp GET /api/stats (tính từ DB: người dùng thật, cộng đồng đang liệt kê, chủ cộng đồng, trung bình review thật); khi chưa có đánh giá thật hiển thị '–' (rating = null), không còn số bịa |
| TC-HOME-025 | Tìm kiếm không dấu vẫn ra kết quả có dấu tiếng Việt | SỬA (bước,dữ liệu,kết quả mong đợi); Test1=Pass | Trả về đúng cộng đồng có dấu tương ứng: tìm không dấu ĐÃ được hỗ trợ (Postgres full-text gập dấu bằng sf_fold(), đ -> d; GET /courses?q dùng cùng bộ khớp - backend/docs/api/search.md) |
| TC-INTEG-007 | Cổng thanh toán gián đoạn — người dùng nhận lỗi rõ ràng, không bị trừ tiền mà không rõ trạng thái | SỬA (tiền điều kiện); Test1=Chưa test | Giả lập cổng thanh toán trả lỗi/timeout. MockGateway chỉ có failFor(userId) để giả lập TỪ CHỐI (xem TC-PAY-050); timeout/gián đoạn thật chỉ kiểm được với cổng thật hoặc stub riêng; charge xong settle lỗi đã có TC-MONEY-109 |
| TC-INTEG-008 | Dịch vụ gửi email lỗi không làm gián đoạn luồng nghiệp vụ chính | SỬA (tiền điều kiện); Test1=Chưa test | Giả lập dịch vụ email tạm thời lỗi. HIỆN TẠI lỗi gửi mail chỉ bị nuốt + log (mail.service), CHƯA có hàng đợi thử gửi lại (backend/docs/api/identity.md) |
| TC-INTEG-013 | Số liệu doanh thu Owner khớp với tổng giao dịch thực tế ghi nhận ở cổng thanh toán | SỬA (tiền điều kiện); Test1=Chưa test | Có nhiều giao dịch đã phát sinh trong kỳ. Chỉ kiểm được khi có cổng thật (hiện là MockGateway) |
| TC-NOTI-003 | Nhận thông báo khi được mời vào cộng đồng | SỬA (tiền điều kiện); Test1=Chưa test | Chưa thiết kế (Kế hoạch): lời mời hiện là LIÊN KẾT/mã mời (POST /courses/:id/invites, /invite/:code) do Owner/Admin chia sẻ, không có lời mời gửi trực tiếp tới 1 user nên không có loại thông báo 'lời mời' (notifications.types.ts). Cần quyết định nghiệp vụ |
| TC-NOTI-006 | Gửi email xác nhận khi đăng ký tài khoản/tham gia thành công | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): POST /auth/register không gửi email xác nhận; thư xác thực chỉ gửi khi người dùng bấm gửi, vào outbox dev, chưa có SES/SMTP (backend/docs/api/identity.md) |
| TC-NOTI-012 | Email giao dịch gửi đúng ngôn ngữ theo cài đặt tài khoản | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): chưa có cài đặt ngôn ngữ tài khoản/giao diện English và chưa có nhà cung cấp email thật |
| TC-PAY-013 | Đổi phương thức thanh toán | SỬA (tiền điều kiện); Test1=Chưa test | Chưa làm (Kế hoạch): chưa có trang/endpoint đổi phương thức thanh toán (MockGateway); đang có gói active |
| TC-PAY-019 | Owner đổi giá cộng đồng — thành viên hiện tại được xử lý đúng theo chính sách đã chốt | SỬA (tiền điều kiện); Test1=Chưa test | Chưa chốt chính sách (Kế hoạch). HIỆN TẠI đổi giá KHÔNG ảnh hưởng gói đang chạy (gói giữ priceCents lúc đăng ký - payments.md; xem TC-PAY-216 và TC-COMM-059) |
| TC-SEC-005 | Một khóa học luôn thuộc đúng một cộng đồng | SỬA (tiền điều kiện,bước,kết quả mong đợi); Test1=Chưa test | Không có cách tạo/gán khóa học không thuộc cộng đồng nào (404 với cộng đồng lạ; communityId bắt buộc); mỗi khóa học thuộc đúng 1 cộng đồng, còn 1 cộng đồng có NHIỀU khóa học (backend/docs/api/communities-courses.md) |
| TC-SEC-007 | Toàn bộ kết nối sử dụng HTTPS | SỬA (tiền điều kiện,kết quả mong đợi); Test1=Chưa test | Kết nối bắt buộc qua HTTPS, HTTP tự chuyển hướng sang HTTPS, chứng chỉ hợp lệ; cookie refresh_token có cờ Secure + SameSite=None ở production |

## Chi tiết LOẠI (RETIRE)

| TC | Tiêu đề | Test 1 cũ | Quyết định | Lý do / bằng chứng |
|---|---|---|---|---|
| TC-ADMIN-001 | Thành viên báo cáo bài viết vi phạm | Chưa test | LOẠI | Trùng TC-ADMIN-013 (báo cáo bài viết) |
| TC-ADMIN-002 | Platform Admin ẩn/xóa nội dung vi phạm | Chưa test | LOẠI | Trùng TC-ADMIN-039 (mod ẩn bài) và nhóm TC-ADM2 Nội dung (admin gỡ nội dung) |
| TC-ADMIN-003 | Platform Admin cấm (ban) một thành viên vi phạm | Chưa test | LOẠI | Trùng nhóm TC-ADM (Người dùng: tạm ngưng/cấm toàn nền tảng, thu hồi phiên - cũng thay TC-ADMIN-076) |
| TC-ADMIN-004 | Platform Admin khóa/gỡ cộng đồng vi phạm, không phụ thuộc quyết định của Owner | Chưa test | LOẠI | Trùng TC-ADMIN-058 + nhóm TC-ADM (Cộng đồng: tạm ngưng/xóa/khôi phục) |
| TC-ADMIN-005 | Tìm kiếm đồng thời khóa học, cộng đồng, bài viết trong 1 ô tìm kiếm | Chưa test | LOẠI | Trùng nhóm TC-SEARCH (tìm toàn cục: khóa học, thành viên, bài viết) |
| TC-ADMIN-007 | Platform Admin theo dõi tổng quan hoạt động toàn nền tảng | Chưa test | LOẠI | Trùng TC-ADM-038..057 (Bảng điều khiển) và TC-ADMIN-074 |
| TC-ADMIN-008 | Khôi phục lại nội dung đã ẩn/xóa nhầm (nếu có tính năng) | Chưa test | LOẠI | Trùng TC-ADMIN-052 (bỏ ẩn bài) và TC-ADM2 (khôi phục nội dung gỡ) |
| TC-ADMIN-009 | Ghi log đầy đủ hành động kiểm duyệt (audit trail) | Chưa test | LOẠI | Trùng nhóm TC-ADM Audit log (/admin/audit-logs đã làm, ghi người/hành động/đối tượng) |
| TC-ADMIN-010 | Kết quả tìm kiếm tôn trọng quyền riêng tư của cộng đồng riêng tư | Chưa test | LOẠI | Trùng TC-SEARCH-028/045 (tìm kiếm tôn trọng quyền riêng tư) |
| TC-ADMIN-011 | Chỉ Platform Admin mới truy cập được trang quản trị nội bộ | Chưa test | LOẠI | Trùng TC-ADMIN-056 và TC-ADM-008 (chỉ nhân viên admin vào /admin) |
| TC-AUTH-021 | Gửi yêu cầu khôi phục mật khẩu qua email | Chưa test | LOẠI | Tính năng đã làm; trùng TC-AUTH-102 (thư reset trong outbox, link 30 phút) và TC-AUTH-115 (UI /forgot-password) - backend/docs/api/identity.md |
| TC-AUTH-022 | Đặt lại mật khẩu mới qua liên kết trong email | Chưa test | LOẠI | Tính năng đã làm; trùng TC-AUTH-108/109/113/114 (đặt lại mật khẩu, token một lần, hết hạn 30 phút, UI /reset-password) |
| TC-AUTH-023 | Xem và cập nhật hồ sơ cá nhân (ảnh đại diện, tiểu sử) | Chưa test | LOẠI | Tính năng đã làm; trùng TC-AUTH-076 (UI /settings tab Hồ sơ) và TC-AUTH-082 (avatar /files) |
| TC-AUTH-034 | Giới hạn đăng nhập sai được tính theo tài khoản, không chặn nhầm người dùng khác cùng IP | Pass | LOẠI | Tiêu đề khẳng định giới hạn 'tính theo tài khoản, không chặn nhầm người khác cùng IP' nhưng hành vi hiện tại là giới hạn THEO IP (auth.routes.ts loginLimiter, không có keyGenerator; xem TC-SEC-039/055); Playwright đã Pass bằng cách khẳng định 429 (ngược tiêu đề). Thay bằng case 'Giới hạn đăng nhập sai tính theo IP...' cuối module |
| TC-COMM-001 | Thành viên tạo cộng đồng mới thành công | Chưa test | LOẠI | Trùng TC-COMM-047 (người tạo thành Owner) và TC-COMM-050/052 (tạo cộng đồng UI) |
| TC-COMM-002 | Không cho tạo cộng đồng khi để trống tên | Chưa test | LOẠI | Trùng TC-COMM-037/038/039 (validate tên cộng đồng) |
| TC-COMM-003 | Tạo cộng đồng ở chế độ Công khai + Miễn phí | Chưa test | LOẠI | Trùng TC-COMM-046 (pricing free) / TC-COMM-052 / TC-COMM-078 (tham gia công khai miễn phí) |
| TC-COMM-004 | Tạo cộng đồng ở chế độ Công khai + Có phí theo tháng | Chưa test | LOẠI | Trùng TC-COMM-046 (pricing paid) / TC-COMM-079 (402 PAYMENT_REQUIRED) |
| TC-COMM-005 | Tạo cộng đồng ở chế độ Riêng tư | Chưa test | LOẠI | Trùng TC-COMM-060 (công khai -> riêng tư) / TC-COMM-081 (riêng tư: JOIN_REQUEST_REQUIRED) |
| TC-COMM-006 | Tab Bảng tin hiển thị đúng nội dung | Chưa test | LOẠI | Trùng TC-FEED-119 (bảng tin theo thời gian, ghim trước) và các case FEED UI |
| TC-COMM-007 | Tab Khóa học hiển thị đúng danh sách khóa học của cộng đồng | Chưa test | LOẠI | Tên tab nay là 'Lớp học' (không còn tab 'Khóa học' ở khu cộng đồng; sidebar: Cộng đồng/Lớp học/Lịch sự kiện/Thành viên/Bảng xếp hạng/Giới thiệu - CommunitySidebar.tsx); trùng TC-COURSE-027 và nhóm TC-SPLIT (chọn khóa ?khoa=) |
| TC-COMM-008 | Tab Lịch hiển thị sự kiện sắp diễn ra | Chưa test | LOẠI | Trùng TC-EVENT-030/034 (tab Lịch sự kiện) |
| TC-COMM-009 | Tab Thành viên hiển thị danh sách thành viên | Chưa test | LOẠI | Trùng TC-MEMBER-013/028 (tab Thành viên) |
| TC-COMM-011 | Tham gia cộng đồng Công khai + Miễn phí | Chưa test | LOẠI | Trùng TC-COMM-078 (POST /enroll vào cộng đồng công khai miễn phí) |
| TC-COMM-012 | Tham gia cộng đồng Công khai + Có phí | Chưa test | LOẠI | Trùng TC-COMM-079 (402 PAYMENT_REQUIRED) và TC-PAY-027..043 (luồng checkout) |
| TC-COMM-013 | Gửi yêu cầu tham gia cộng đồng Riêng tư | Chưa test | LOẠI | Trùng TC-COMM-085 (gửi yêu cầu tham gia cộng đồng riêng tư) |
| TC-COMM-014 | Owner duyệt yêu cầu tham gia cộng đồng riêng tư | Chưa test | LOẠI | Trùng TC-COMM-094 (Owner duyệt yêu cầu) |
| TC-COMM-015 | Owner từ chối yêu cầu tham gia | Chưa test | LOẠI | Trùng TC-COMM-095 (Owner từ chối yêu cầu) |
| TC-COMM-016 | Tham gia qua liên kết mời trực tiếp | Chưa test | LOẠI | Trùng TC-COMM-109 (nhận lời mời DEMO-VALID) |
| TC-COMM-017 | Thành viên tự rời cộng đồng | Chưa test | LOẠI | Trùng TC-COMM-147 (thành viên tự rời cộng đồng) |
| TC-COMM-018 | Owner/Admin loại bỏ thành viên vi phạm | Chưa test | LOẠI | Trùng TC-COMM-129/130 (kick thành viên theo bậc) |
| TC-COMM-019 | Owner cấp quyền Admin cho một thành viên | Chưa test | LOẠI | Trùng TC-COMM-121 (Owner cấp quyền Admin) |
| TC-COMM-020 | Owner thu hồi quyền Admin | Chưa test | LOẠI | Trùng TC-COMM-119/122 (bỏ Mod/Admin về Member) |
| TC-COMM-021 | Admin mặc định không xem được doanh thu khi chưa được cấp thêm quyền | Chưa test | LOẠI | Trùng TC-PAY-206 (Admin/Mod của chính cộng đồng không xem được doanh thu) và TC-ROLE-049 |
| TC-COMM-022 | Danh sách cộng đồng hiển thị đúng, hỗ trợ tìm kiếm/lọc | Chưa test | LOẠI | Trùng TC-HOME-001..017 (tìm kiếm/lọc Khám phá) và nhóm TC-SEARCH |
| TC-COMM-023 | Owner chỉnh sửa thông tin cộng đồng (tên, mô tả, ảnh bìa) | Chưa test | LOẠI | Trùng TC-COMM-053/062 (admin sửa tên/mô tả/ảnh bìa) |
| TC-COMM-024 | Owner đổi mức giá cộng đồng từ Miễn phí sang Có phí | Chưa test | LOẠI | Trùng TC-PAY-019 (cùng câu hỏi chính sách đổi giá, chưa chốt) và TC-COMM-059/TC-PAY-216 (hành vi hiện tại: không ảnh hưởng gói đang thuê) |
| TC-COMM-025 | Owner xóa cộng đồng | Chưa test | LOẠI | Trùng TC-COMM-063/065 (xóa mềm cộng đồng + gõ lại tên) |
| TC-COMM-027 | Owner chuyển giao quyền sở hữu (Owner) cộng đồng cho thành viên khác | Chưa test | LOẠI | Trùng TC-COMM-142 (chuyển quyền Owner) |
| TC-COMM-028 | Người chưa tham gia cộng đồng riêng tư không xem được nội dung các tab | Chưa test | LOẠI | Trùng TC-FEED-140 (người chưa tham gia 403) và TC-COMMVP-026 (FE chuyển về trang giới thiệu) |
| TC-COMM-029 | Liên kết mời hết hạn không sử dụng được | Chưa test | LOẠI | Trùng TC-COMM-105 (DEMO-EXPIRED: 410 INVITE_EXPIRED) |
| TC-COMM-030 | Liên kết mời dùng được đúng số lần theo cấu hình | Chưa test | LOẠI | Trùng TC-COMM-107/113 (lời mời hết lượt: 410 INVITE_EXHAUSTED) |
| TC-COMM-032 | Owner không thể tự rời cộng đồng khi chưa chuyển giao quyền sở hữu | Chưa test | LOẠI | Trùng TC-COMM-149 (Owner không rời được: 409) |
| TC-COMMVP-001 | Đăng bài trong cộng đồng của khóa học đã tham gia | Chưa test | LOẠI | Trùng TC-FEED-019/021 (đăng bài) |
| TC-COMMVP-002 | Không đăng bài được khi chưa tham gia khóa học (chặn ở server) | Chưa test | LOẠI | Trùng TC-FEED-140 (người chưa tham gia 403) |
| TC-COMMVP-003 | Thích bài viết — không tự cộng điểm khi tự thích bài của chính mình | Chưa test | LOẠI | Trùng TC-FEED-097 (tự like không điểm) |
| TC-COMMVP-004 | Bình luận bài viết | Chưa test | LOẠI | Trùng TC-FEED-083 (bình luận) |
| TC-COMMVP-005 | Ghim / bỏ ghim bài viết (chỉ mod trở lên) | Chưa test | LOẠI | Trùng TC-FEED-077/078 (ghim chỉ mod+) |
| TC-COMMVP-006 | Lọc bài viết theo danh mục & sắp xếp Mới nhất/Phổ biến | Chưa test | LOẠI | Trùng TC-FEED-119..128 (lọc/sắp xếp bài) |
| TC-COMMVP-007 | Xem danh sách module với % tiến độ thật theo từng người | Chưa test | LOẠI | Trùng TC-COURSE-021..026 (module/tiến độ; mô tả cũ 'module tự sinh từ course.lessons' đã lỗi thời - nay là nội dung lớp học thật trong DB) |
| TC-COMMVP-008 | Module tự động khóa tới khi hoàn thành 100% module trước | Chưa test | LOẠI | Trùng TC-COURSE-052/053 (khóa module tuần tự) |
| TC-COMMVP-009 | Chặn ở server khi cố mở bài học của module đang khóa | Chưa test | LOẠI | Trùng TC-COURSE-057 (MODULE_LOCKED) |
| TC-COMMVP-010 | Đánh dấu hoàn thành bài học, % tiến độ cập nhật ngay | Chưa test | LOẠI | Trùng TC-COURSE-047 (hoàn thành bài) |
| TC-COMMVP-011 | Hoàn thành bài học được cộng điểm (+3) | Chưa test | LOẠI | Trùng TC-COURSE-049 (+3 điểm lesson_complete) |
| TC-COMMVP-012 | Tạo sự kiện mới (tên, thời gian, link họp, giới hạn số lượng) | Chưa test | LOẠI | Trùng TC-EVENT-013 (tạo sự kiện) |
| TC-COMMVP-013 | Đăng ký / hủy đăng ký (RSVP) tham dự | Chưa test | LOẠI | Trùng TC-EVENT-050/051 (RSVP/hủy) |
| TC-COMMVP-014 | Từ chối RSVP khi sự kiện đã đủ số lượng giới hạn (capacity) | Chưa test | LOẠI | Trùng TC-EVENT-053/054 (đủ sức chứa 409) |
| TC-COMMVP-015 | Không cho RSVP sự kiện đã diễn ra trong quá khứ | Chưa test | LOẠI | Trùng TC-EVENT-058 (sự kiện đã qua 400) |
| TC-COMMVP-016 | Danh sách thành viên tìm kiếm theo tên | Chưa test | LOẠI | Trùng TC-MEMBER-016 (tìm thành viên theo tên) |
| TC-COMMVP-017 | Trạng thái 'Đang trực tuyến' dựa trên hoạt động gần nhất (lastActiveAt) | Chưa test | LOẠI | Trùng TC-MEMBER-021/032 (online 5 phút) |
| TC-COMMVP-018 | Tính điểm đúng theo cửa sổ thời gian 7 ngày / 30 ngày / mọi thời điểm | Chưa test | LOẠI | Trùng TC-MEMBER-038..040 (bảng xếp hạng 7/30/all) |
| TC-COMMVP-019 | Cộng điểm đúng cho từng loại hoạt động (đăng bài +5, nhận thích +2, RSVP +1) | Chưa test | LOẠI | Trùng TC-MEMBER-056 (giá trị điểm); lưu ý RSVP chỉ +1 một lần (points-policy) |
| TC-COMMVP-020 | Tạo giao dịch (checkout) cho khóa học có phí | Chưa test | LOẠI | Trùng TC-PAY-027 (checkout) |
| TC-COMMVP-021 | Không cho checkout khóa học miễn phí | Chưa test | LOẠI | Trùng TC-PAY-035 (checkout khóa miễn phí 400) |
| TC-COMMVP-023 | Xác nhận thanh toán cấp quyền truy cập thật ngay lập tức | Chưa test | LOẠI | Trùng TC-PAY-043 (confirm cấp quyền) |
| TC-COMMVP-024 | Xác nhận lại giao dịch đã thành công không xử lý trùng (idempotent) | Chưa test | LOẠI | Trùng TC-PAY-044 (confirm idempotent) |
| TC-COMMVP-025 | Không cho checkout lại khi đã tham gia khóa học rồi | Chưa test | LOẠI | Trùng TC-PAY-038 (đã tham gia checkout lại 409) |
| TC-COURSE-001 | Hiển thị đầy đủ thông tin khóa học (mô tả, giảng viên, đánh giá, nội dung, giá, FAQ) | Pass | LOẠI | Kỳ vọng lỗi thời: trang chi tiết nay hiện dữ liệu thật; review/module/highlights/gains/FAQ minh họa đã gỡ (audit bước 4: community-detail.ts trả highlights=[], gains=[], faqs=[], reviews chỉ review thật; tab FAQ chỉ hiện khi có dữ liệu). Thay bằng case 'Trang chi tiết cộng đồng hiển thị dữ liệu thật...' cuối module |
| TC-COURSE-005 | Tham gia lại khóa học đã tham gia trước đó (idempotent) | Pass | LOẠI | Kỳ vọng sai với thiết kế: nút 'Đã tham gia' là TOGGLE rời cộng đồng (POST /enroll), không phải 'idempotent join' (Playwright đã ghi LƯU Ý THIẾT KẾ); cộng đồng có phí còn có hộp xác nhận rời. Thay bằng case 'Bấm lại nút Đã tham gia là rời cộng đồng...' cuối module |
| TC-COURSE-006 | Owner tạo Module mới trong khóa học | Chưa test | LOẠI | Trùng TC-COURSE-067 (mod tạo module) |
| TC-COURSE-007 | Owner thêm bài học dạng video vào module | Chưa test | LOẠI | Trùng TC-COURSE-079/040 (thêm bài học video, embed) |
| TC-COURSE-008 | Owner thêm bài học dạng văn bản/tệp đính kèm | Chưa test | LOẠI | Trùng TC-COURSE-079/081 (bài văn bản/tệp đính kèm) |
| TC-COURSE-009 | Sắp xếp lại thứ tự module/bài học | Chưa test | LOẠI | Trùng TC-COURSE-077/085 (sắp xếp module/bài) |
| TC-COURSE-010 | Đánh dấu hoàn thành một bài học | Chưa test | LOẠI | Trùng TC-COURSE-047 (hoàn thành bài) |
| TC-COURSE-011 | Hiển thị đúng % tiến độ tổng khóa học | Chưa test | LOẠI | Trùng TC-COURSE-024/047 (% tiến độ) |
| TC-COURSE-012 | Người chưa trả phí không xem được nội dung bài học đã khóa | Chưa test | LOẠI | Trùng TC-COURSE-097 và TC-COMMVP-022 (người chưa tham gia/chưa trả phí bị 403) |
| TC-COURSE-013 | Quyền truy cập nội dung được xác thực ở server (không chỉ chặn ở giao diện) | Chưa test | LOẠI | Trùng TC-COURSE-097/087 (kiểm quyền ở server) |
| TC-COURSE-014 | Nhúng và phát video từ YouTube | Chưa test | LOẠI | Trùng TC-COURSE-040 (embed YouTube) |
| TC-COURSE-015 | Nhúng và phát video từ Vimeo | Chưa test | LOẠI | Trùng TC-COURSE-041 (embed Vimeo trong matrix link) |
| TC-COURSE-019 | Owner xem trước được toàn bộ nội dung khóa học của chính mình dù chưa trả phí | Chưa test | LOẠI | Trùng TC-COURSE-064 (mod/owner không bao giờ bị khóa module) |
| TC-COURSE-020 | Không cho phép Member thường truy cập trang soạn thảo khóa học | Chưa test | LOẠI | Trùng TC-COURSE-087/091 (member không soạn thảo được) |
| TC-EVENT-001 | Owner/Admin tạo sự kiện mới đầy đủ thông tin | Chưa test | LOẠI | Trùng TC-EVENT-013/027 (mod+ tạo sự kiện) |
| TC-EVENT-002 | Giới hạn số lượng người tham dự khi tạo sự kiện | Chưa test | LOẠI | Trùng TC-EVENT-020/053 (sức chứa) |
| TC-EVENT-003 | Đăng ký tham dự sự kiện | Chưa test | LOẠI | Trùng TC-EVENT-050/063 (RSVP) |
| TC-EVENT-004 | Hủy đăng ký tham dự sự kiện | Chưa test | LOẠI | Trùng TC-EVENT-051/052 (hủy RSVP) |
| TC-EVENT-006 | Xuất file .ics của sự kiện | Chưa test | LOẠI | Trùng TC-EVENT-065/076 (tải .ics) |
| TC-EVENT-007 | Nhận thông báo/email nhắc trước giờ sự kiện diễn ra | Chưa test | LOẠI | Trùng TC-EVENT-077/084 (nhắc lịch event_reminder trong app; nhắc qua email là TC-EVENT-085) |
| TC-EVENT-008 | Owner chỉnh sửa thông tin sự kiện đã tạo | Chưa test | LOẠI | Trùng TC-EVENT-038 (sửa sự kiện) |
| TC-EVENT-009 | Owner hủy sự kiện, thông báo tới người đã đăng ký | Chưa test | LOẠI | Trùng TC-EVENT-047 (xóa sự kiện: người RSVP nhận thông báo 'Sự kiện đã bị hủy'; không có trạng thái 'Đã hủy') |
| TC-EVENT-010 | Không thể đăng ký tham dự sự kiện đã diễn ra trong quá khứ | Chưa test | LOẠI | Trùng TC-EVENT-058 (sự kiện đã qua) |
| TC-EVENT-011 | Hiển thị đúng giờ sự kiện theo múi giờ của từng người xem khác nhau | Chưa test | LOẠI | Trùng TC-EVENT-089 (múi giờ người xem) |
| TC-EVENT-012 | Đăng ký tham dự khi sự kiện đã đủ số lượng tối đa | Chưa test | LOẠI | Trùng TC-EVENT-053/054/064 (đủ chỗ: 409, không có danh sách chờ) |
| TC-FEED-001 | Đăng bài viết dạng văn bản | Chưa test | LOẠI | Trùng TC-FEED-019 (đăng bài chữ) |
| TC-FEED-002 | Đăng bài viết kèm ảnh | Chưa test | LOẠI | Trùng TC-FEED-020/031 (đăng bài kèm ảnh) |
| TC-FEED-004 | Gắn danh mục cho bài viết | Chưa test | LOẠI | Trùng TC-FEED-020/027/121 (category) |
| TC-FEED-005 | Bình luận vào một bài viết | Chưa test | LOẠI | Trùng TC-FEED-083 (bình luận) |
| TC-FEED-006 | Trả lời (reply) một bình luận — lồng 1 cấp | Chưa test | LOẠI | Trùng TC-FEED-087/088 (trả lời lồng - hiện chưa hỗ trợ parentId, PostComment không có cột parent) |
| TC-FEED-007 | Thích một bài viết | Chưa test | LOẠI | Trùng TC-FEED-095 (like lần đầu) |
| TC-FEED-008 | Bỏ thích một bài viết đã thích | Chưa test | LOẠI | Trùng TC-FEED-096 (unlike/like lại) |
| TC-FEED-009 | Owner/Admin ghim bài viết thông báo quan trọng | Chưa test | LOẠI | Trùng TC-FEED-077 (mod ghim; quyền là mod+ chứ không riêng Owner/Admin) |
| TC-FEED-010 | Bỏ ghim bài viết | Chưa test | LOẠI | Trùng TC-FEED-077 (ghim là toggle) |
| TC-FEED-012 | Chỉnh sửa bài viết đã đăng | Chưa test | LOẠI | Trùng TC-FEED-055 (sửa bài, editedAt) |
| TC-FEED-013 | Xóa bài viết của chính mình | Chưa test | LOẠI | Trùng TC-FEED-064 (xóa bài của mình) |
| TC-FEED-014 | Thành viên không thể chỉnh sửa/xóa bài viết của người khác | Chưa test | LOẠI | Trùng TC-FEED-058/065 (sửa/xóa bài người khác 403) |
| TC-FEED-015 | Giới hạn độ dài nội dung bài viết | Chưa test | LOẠI | Trùng TC-FEED-024 (giới hạn 4000 ký tự) |
| TC-FEED-016 | Thành viên báo cáo bình luận vi phạm (không chỉ bài viết) | Chưa test | LOẠI | Trùng TC-FEED-108 (báo cáo bình luận) |
| TC-FEED-017 | Xóa bình luận của chính mình | Chưa test | LOẠI | Trùng TC-FEED-090 (xóa bình luận của mình) |
| TC-FEED-018 | Thành viên thường không thấy nút Ghim bài viết | Chưa test | LOẠI | Trùng TC-FEED-078/081 (member không ghim được) |
| TC-HOME-008 | Lọc theo nhiều danh mục cùng lúc | Pass | LOẠI | Danh mục là tab chọn MỘT (CategoryTabs.active: CategoryId/undefined, frontend/src/features/courses/components/CategoryTabs.tsx) - không chọn nhiều danh mục cùng lúc; thay bằng case 'Chọn lần lượt các danh mục...' cuối module |
| TC-HOME-022 | Hiển thị đánh giá/phản hồi nổi bật trên trang chủ | Pass | LOẠI | Khối 'Câu chuyện cộng đồng/Stories' đã bị gỡ khỏi trang chủ (audit bước 4; pages/HomePage.tsx chỉ còn Hero/CategoryTabs/FilterBar/CommunityCta) |
| TC-HOME-026 | Lọc theo giá với giá trị Min > Max | N/A | LOẠI | UI không có ô nhập khoảng giá min/max (FILTER_DROPDOWNS.pricing chỉ có free/paid/trial - features/courses/constants.ts); Playwright đã skip. Bộ lọc giá hợp lệ nằm ở TC-HOME-009 |
| TC-HOME-027 | Lọc theo giá với giá trị âm | N/A | LOẠI | UI không có ô nhập giá (xem TC-HOME-026); Playwright đã skip |
| TC-HOME-028 | Truy cập trực tiếp URL với số trang vượt quá tổng số trang | Pass | LOẠI | Phân trang là state cục bộ (useCourseFilters dùng useState, không đồng bộ URL) nên không có '?page=999' trên FE; thay bằng case nút 'Trang sau' ở trang cuối + case API tham số page cuối module (catalog.schema.ts: page min 1, max MAX_PAGE=1000) |
| TC-HOME-029 | Truy cập URL với số trang = 0 hoặc số âm | Pass | LOẠI | Như TC-HOME-028: không có ?page=0/-1 trên FE; thay bằng case nút 'Trang trước' ở trang 1 + case API tham số page |
| TC-INTEG-001 | 2 người thanh toán cùng lúc cho suất cuối cùng của sự kiện giới hạn số lượng | Chưa test | LOẠI | Trùng TC-INTEG-014 + TC-EVENT-055/056 (race chỗ cuối) |
| TC-INTEG-003 | Webhook thanh toán đến trước khi trình duyệt người dùng redirect quay lại | Chưa test | LOẠI | Trùng TC-PAY-126 (webhook đến trước redirect) |
| TC-INTEG-004 | Cổng thanh toán retry webhook do không nhận được phản hồi 200 kịp thời | Chưa test | LOẠI | Trùng TC-INTEG-032 + TC-PAY-127 (retry webhook idempotent) |
| TC-INTEG-005 | Thanh toán thành công nhưng cấp quyền truy cập thất bại — hệ thống xử lý nhất quán | Chưa test | LOẠI | Trùng TC-MONEY-109/110 (charge xong settle lỗi: reconcileUnsettledCharges) - tính năng đã làm nên không còn là 'Kế hoạch' |
| TC-INTEG-009 | Tin nhắn/thông báo real-time tự kết nối lại sau khi mất mạng tạm thời | Chưa test | LOẠI | Trùng TC-INTEG-039 + TC-NOTI-084 (SSE tự kết nối lại) |
| TC-INTEG-010 | Phân trang không trùng/thiếu dữ liệu khi có bản ghi mới thêm liên tục khi đang cuộn | Chưa test | LOẠI | Trùng TC-FEED-131 (phân trang cursor không trùng/sót) |
| TC-INTEG-011 | Nhiều request song song cùng dùng 1 refresh token không tạo lỗi/session thừa | Chưa test | LOẠI | Trùng TC-INTEG-030 + TC-SEC-026 (refresh song song chỉ 1 thắng) |
| TC-INTEG-012 | Hệ thống ổn định khi nhiều người dùng tìm kiếm/khám phá đồng thời (load test cơ bản) | Chưa test | LOẠI | Trùng TC-PERF-090 (50 người dùng đồng thời) và TC-PERF-055 (ngưỡng thời gian) |
| TC-MEMBER-001 | Tìm kiếm thành viên theo tên trong cộng đồng | Chưa test | LOẠI | Trùng TC-MEMBER-016 (tìm theo tên) |
| TC-MEMBER-002 | Lọc danh sách thành viên theo vai trò (Owner/Admin/Member) | Chưa test | LOẠI | Trùng TC-MEMBER-020 (lọc theo vai trò admin) |
| TC-MEMBER-003 | Cộng điểm khi thành viên đăng bài | Chưa test | LOẠI | Trùng TC-MEMBER-056 + TC-FEED-019 (+5 điểm đăng bài) |
| TC-MEMBER-004 | Cộng điểm khi bài viết/bình luận của thành viên được thích | Chưa test | LOẠI | Trùng TC-FEED-095/TC-MEMBER-056 (+2 điểm nhận like; chỉ BÀI VIẾT, bình luận không có like/điểm) |
| TC-MEMBER-005 | Cộng điểm khi hoàn thành bài học | Chưa test | LOẠI | Trùng TC-COURSE-049 (+3 điểm hoàn thành bài) |
| TC-MEMBER-006 | Xem bảng xếp hạng theo 7 ngày | Chưa test | LOẠI | Trùng TC-MEMBER-038 |
| TC-MEMBER-007 | Xem bảng xếp hạng theo 30 ngày | Chưa test | LOẠI | Trùng TC-MEMBER-039 |
| TC-MEMBER-008 | Xem bảng xếp hạng mọi thời điểm | Chưa test | LOẠI | Trùng TC-MEMBER-040 |
| TC-MEMBER-009 | Điểm không bị trừ khi bỏ thích (unlike) sau khi đã thích | Chưa test | LOẠI | Trùng TC-FEED-096 (điểm chỉ tính lần like đầu, unlike không trừ) |
| TC-MEMBER-010 | Xử lý đồng điểm (tie-break) trên bảng xếp hạng | Chưa test | LOẠI | Trùng TC-MEMBER-045 (đồng điểm xếp theo userId tăng dần) |
| TC-MEMBER-011 | Thành viên bị cấm không hiển thị trong danh sách thành viên/bảng xếp hạng | Chưa test | LOẠI | Trùng TC-MEMBER-025/043 (người bị cấm không hiện trong danh sách/xếp hạng) |
| TC-MEMBER-012 | Xem hồ sơ công khai của thành viên khác | Chưa test | LOẠI | Trùng TC-MEMBER-033..037 (hồ sơ công khai) |
| TC-NOTI-001 | Nhận thông báo khi có người bình luận bài viết của mình | Chưa test | LOẠI | Trùng TC-FEED-083 (bình luận -> post_commented) |
| TC-NOTI-002 | Nhận thông báo khi bài viết/bình luận được thích | Chưa test | LOẠI | Trùng TC-FEED-095 (like -> post_liked) |
| TC-NOTI-004 | Gửi tin nhắn 1-1 tới thành viên khác | Chưa test | LOẠI | Trùng TC-NOTI-101/154 (gửi tin 1-1, nút chat ở tab Thành viên) |
| TC-NOTI-005 | Nhận tin nhắn trực tiếp theo thời gian thực | Chưa test | LOẠI | Trùng TC-NOTI-146 (realtime SSE tin nhắn) |
| TC-NOTI-007 | Gửi email hóa đơn sau khi thanh toán thành công | Chưa test | LOẠI | Trùng TC-PAY-125 (email hóa đơn - cùng tính năng chưa làm) |
| TC-NOTI-008 | Gửi email nhắc gia hạn trước ngày thu phí chu kỳ mới | Chưa test | LOẠI | Trùng TC-PAY-085 (nhắc trước gia hạn - cùng tính năng chưa làm) |
| TC-NOTI-009 | Đánh dấu đã đọc một thông báo | Chưa test | LOẠI | Trùng TC-NOTI-027/057 (đánh dấu đã đọc) |
| TC-NOTI-010 | Đánh dấu tất cả thông báo đã đọc | Chưa test | LOẠI | Trùng TC-NOTI-032/058 (đọc tất cả) |
| TC-NOTI-011 | Không thể nhắn tin cho người không cùng cộng đồng nào | Chưa test | LOẠI | Trùng TC-NOTI-093 (không chung cộng đồng 403) |
| TC-PAY-001 | Thanh toán thành công qua cổng nội địa (PayOS/VNPay/MoMo) | Chưa test | LOẠI | Trùng TC-PAY-141/222 (cổng thật - cùng tính năng chưa làm) |
| TC-PAY-002 | Thanh toán thành công qua Stripe (thẻ quốc tế) | Chưa test | LOẠI | Trùng TC-PAY-141/222 (Stripe thật) |
| TC-PAY-003 | Thanh toán thất bại do thẻ hết hạn | Chưa test | LOẠI | Trùng TC-PAY-050 (cổng từ chối thẻ: 402 PAYMENT_FAILED); lý do cụ thể 'thẻ hết hạn' chỉ có với cổng thật (TC-PAY-141) |
| TC-PAY-004 | Thanh toán thất bại do không đủ số dư | Chưa test | LOẠI | Trùng TC-PAY-050 (cổng từ chối); lý do 'không đủ số dư' chỉ có với cổng thật |
| TC-PAY-005 | Hệ thống tự động thử lại khi thanh toán định kỳ thất bại | Chưa test | LOẠI | Trùng TC-PAY-083/084 (gia hạn thất bại hiện hết hạn ngay, dunning chưa làm) |
| TC-PAY-006 | Tạm khóa quyền truy cập sau X lần thanh toán thất bại liên tiếp | Chưa test | LOẠI | Trùng TC-PAY-083/084 (cùng chính sách dunning chưa làm) |
| TC-PAY-007 | Kích hoạt đúng số ngày dùng thử miễn phí (VD 7 ngày) | Chưa test | LOẠI | Trùng TC-PAY-058 (dùng thử 7 ngày) |
| TC-PAY-008 | Hủy trong thời gian dùng thử không mất phí | Chưa test | LOẠI | Trùng TC-PAY-078 (hủy trong dùng thử) |
| TC-PAY-009 | Hủy gói sau khi đã thanh toán vẫn còn quyền truy cập tới hết chu kỳ | Chưa test | LOẠI | Trùng TC-PAY-073 (hủy cuối kỳ vẫn còn quyền) |
| TC-PAY-010 | Gia hạn tự động thu phí đúng vào ngày tới hạn | Chưa test | LOẠI | Trùng TC-PAY-081 (scheduler gia hạn) |
| TC-PAY-011 | Gửi thông báo nhắc trước khi thu phí chu kỳ mới | Chưa test | LOẠI | Trùng TC-PAY-085 (nhắc trước gia hạn) |
| TC-PAY-012 | Xem thông tin gói hiện tại (giá, chu kỳ, ngày gia hạn) | Chưa test | LOẠI | Trùng TC-PAY-122/142 (Gói của tôi) |
| TC-PAY-014 | Trang 'Doanh thu của tôi' hiển thị đúng số dư, lịch sử giao dịch | Chưa test | LOẠI | Trùng TC-PAY-161 (dashboard doanh thu) |
| TC-PAY-015 | Rút tiền thành công khi đủ ngưỡng tối thiểu | Chưa test | LOẠI | Trùng TC-PAY-167 (rút tiền hợp lệ) |
| TC-PAY-016 | Không cho rút tiền khi chưa đủ ngưỡng tối thiểu | Chưa test | LOẠI | Trùng TC-PAY-169 (dưới ngưỡng $50) |
| TC-PAY-017 | Xử lý webhook idempotent — không cấp quyền/tính phí 2 lần khi webhook gửi trùng | Chưa test | LOẠI | Trùng TC-PAY-127 (webhook trùng event id) |
| TC-PAY-018 | Từ chối webhook có chữ ký không hợp lệ | Chưa test | LOẠI | Trùng TC-PAY-129 (webhook chữ ký sai) |
| TC-PAY-020 | Platform Admin thực hiện hoàn tiền cho trường hợp đặc biệt | Chưa test | LOẠI | Trùng TC-PAY-088 (hoàn tiền tự duyệt) và TC-PAY-100 (admin duyệt) |
| TC-PAY-021 | Hiển thị đúng đơn vị tiền tệ theo thị trường (VNĐ nội địa, USD Stripe) | Chưa test | LOẠI | Trùng TC-PAY-165 (hiển thị USD) và TC-PAY-166 (đa tiền tệ - chưa làm) |
| TC-PAY-022 | Thành viên tham gia trả phí nhiều cộng đồng cùng lúc, mỗi gói tính phí độc lập | Chưa test | LOẠI | Trùng TC-PAY-148 (nhiều gói độc lập) |
| TC-PAY-023 | Chặn thanh toán trùng khi bấm nút 'Thanh toán' nhiều lần liên tiếp | Chưa test | LOẠI | Trùng TC-PAY-056 (double submit) |
| TC-PAY-024 | Không cho dùng thử miễn phí lần 2 cho cùng 1 tài khoản trên cùng 1 gói | Chưa test | LOẠI | Trùng TC-PAY-060 (không dùng thử lần 2) |
| TC-PAY-025 | Owner chỉ xem được doanh thu của cộng đồng mình sở hữu | Chưa test | LOẠI | Trùng TC-PAY-207 (Owner cộng đồng khác 403) |
| TC-PAY-026 | Không cho rút tiền vượt quá số dư khả dụng hiện tại | Chưa test | LOẠI | Trùng TC-PAY-170 (vượt số dư khả dụng 400) |
| TC-ROLE-001 | Guest không thể đăng bài/bình luận/thích — bị chuyển hướng đăng nhập | Chưa test | LOẠI | Trùng TC-ROLE-053/093 (khách bị 401/chuyển đăng nhập) |
| TC-ROLE-002 | Member không truy cập được trang Cài đặt cộng đồng khi chỉ là thành viên thường | Chưa test | LOẠI | Trùng TC-ROLE-090 (trang Cài đặt cộng đồng chặn member) |
| TC-ROLE-003 | Admin không có quyền xem/đổi giá cộng đồng khi chưa được Owner cấp quyền | Chưa test | LOẠI | Trùng TC-ROLE-038 + TC-COMM-058 (admin không đổi giá) |
| TC-ROLE-004 | Admin không thể xóa cộng đồng (quyền Owner-only) | Chưa test | LOẠI | Trùng TC-ROLE-046 + TC-COMM-066 (chỉ Owner/Platform Admin xóa) |
| TC-ROLE-005 | Owner cộng đồng A không thể kiểm duyệt/quản lý cộng đồng B | Chưa test | LOẠI | Trùng TC-ROLE-057 (Owner cộng đồng A không quản trị cộng đồng B) |
| TC-ROLE-006 | Platform Admin truy cập được dữ liệu quản trị của mọi cộng đồng bất kể có phải thành viên | Chưa test | LOẠI | Trùng TC-ROLE-056 (Platform Admin qua requireMembership) |
| TC-ROLE-007 | Người dùng A không xem được thông tin thanh toán/gói của người dùng B qua sửa ID trên URL | Chưa test | LOẠI | Trùng TC-ROLE-061 (hóa đơn/giao dịch người khác 403) |
| TC-ROLE-009 | Không xem được tin nhắn trực tiếp giữa 2 người khác qua sửa ID cuộc trò chuyện | Chưa test | LOẠI | Trùng TC-ROLE-063 (hội thoại người khác 404) |
| TC-ROLE-010 | Member không gọi được trực tiếp API dành riêng cho Admin/Owner | Chưa test | LOẠI | Trùng TC-COURSE-087 và các case ma trận TC-ROLE-032..046 (member gọi API quản trị bị 403) |
| TC-ROLE-011 | Sửa đổi claim vai trò (role) trong token không nâng được quyền thực tế | Chưa test | LOẠI | Trùng TC-ROLE-082/083 + TC-SEC-020/023 (sửa claim role, quyền lấy từ DB) |
| TC-ROLE-012 | Các API thay đổi trạng thái (POST/PUT/DELETE) được bảo vệ chống CSRF | Chưa test | LOẠI | Trùng TC-ROLE-086 (CSRF: API dùng Bearer, không dựa cookie) |
| TC-ROLE-013 | Giới hạn tần suất gọi API tìm kiếm/đăng ký để chống lạm dụng | Chưa test | LOẠI | Trùng TC-SEARCH-019 (40 req/phút), TC-GAME-066..069 (nhóm ghi) và TC-SEC-055/056 (đăng nhập/quên mật khẩu) |
| TC-ROLE-014 | Từ chối upload file thực thi/nguy hiểm giả dạng ảnh (VD .exe/.php đổi tên .jpg) | Chưa test | LOẠI | Trùng TC-UPLOAD-012/015 (chặn .exe/.php, magic bytes) |
| TC-ROLE-015 | Giới hạn dung lượng file upload tối đa | Chưa test | LOẠI | Trùng TC-UPLOAD-024 (413 vượt dung lượng) |
| TC-ROLE-016 | Ma trận tổng hợp: mỗi vai trò chỉ thấy đúng menu/chức năng được phép trên giao diện | Chưa test | LOẠI | Trùng TC-ROLE-089/092 (ẩn/hiện menu theo vai trò) |
| TC-ROLE-017 | API danh sách thành viên không trả về các trường nhạy cảm ra ngoài | Chưa test | LOẠI | Trùng TC-SEC-032/067 và TC-MEMBER-027/029 (không lộ trường nhạy cảm) |
| TC-ROLE-018 | Back trình duyệt trên thiết bị dùng chung không để lộ lại dữ liệu qua cache | Chưa test | LOẠI | Trùng TC-AUTH-018 (back sau đăng xuất) |
| TC-SEC-001 | Mật khẩu được mã hóa (hash), không ai xem được mật khẩu gốc kể cả Platform Admin | Chưa test | LOẠI | Trùng TC-SEC-035 (bcrypt cost 10, không lưu mật khẩu thô) và TC-SEC-032/067 |
| TC-SEC-006 | Một người là Owner ở cộng đồng A nhưng chỉ là Thành viên ở cộng đồng B | Chưa test | LOẠI | Trùng TC-ROLE-057 (vai trò theo từng cộng đồng, Owner A không có quyền ở cộng đồng khác) và TC-ROLE-058 |

## Ghi chú
- Case có kết quả Test 1 bị loại: xem cột 'Test 1 cũ' khác 'Chưa test' (HOME-008/022/026/027/028/029, AUTH-034, COURSE-001/005, SEC không có, ROLE/INTEG không có).
- AUTH-036: giữ case, kết quả Fail cũ là của bản trước khi sửa thu hồi access token - cần chạy lại.
- STILL_PLAN_OLD đã dọn: bỏ các mục chỉ khớp case đã loại; thêm NOTI 'Nhận thông báo khi được mời vào cộng đồng' (lời mời hiện là liên kết).
