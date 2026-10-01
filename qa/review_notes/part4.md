# Rà soát testcase - phần 4 (qa/cases_payments.py, cases_comms.py, cases_platform.py)

Nguồn: backend/docs/api/{payments,notifications,messages,search,uploads}.md, backend/src/modules/{payments,notifications,messages,search,uploads,admin}, backend/src/middlewares/rate-limit.ts, frontend/src (App.tsx, RevenuePage.tsx, AdminLayout.tsx). Chưa case nào có kết quả Test 1/Test 2 (không có case retire kèm kết quả). Bảng "Sửa" liệt kê các case đã sửa nội dung (tiêu đề giữ nguyên).

## Tổng kết

| Module | Tổng case thuộc 3 file | Giữ | Sửa | Loại |
|---|---|---|---|---|
| PAY | 196 | 177 | 12 | 7 |
| NOTI | 144 | 138 | 3 | 3 |
| SEARCH | 48 | 40 | 4 | 4 |
| UPLOAD | 59 | 57 | 1 | 1 |
| ADMIN | 66 | 53 | 7 | 6 |
| ROLE | 75 | 72 | 3 | 0 |
| INTEG | 37 | 18 | 2 | 17 |
| SEC | 41 | 37 | 3 | 1 |

## Loại (RETIRE)

| TC | Tiêu đề | Lý do / bằng chứng |
|---|---|---|
| TC-PAY-053 | Idempotency-Key khác nhau tạo hai giao dịch pending khác nhau | Hành vi đổi có chủ đích: checkout nay TÁI DÙNG intent pending <30 phút của cùng (user, cộng đồng) kể cả Idempotency-Key khác (payments.service.ts checkout/findReusablePending; payments.md 3.1). Đã có MONEY 'Checkout lần 2 khi còn intent pending tái dùng...'. |
| TC-PAY-110 | Trang Quản trị -> tab Hoàn tiền: lọc, duyệt, từ chối trên UI | UI /admin 4 tab (Hoàn tiền/Rút tiền/Báo cáo/Khóa) đã bị thay bằng Admin Console (frontend/src/App.tsx /admin/* -> AdminRoutes); trùng ADM2 mục Thanh toán > Hoàn tiền. |
| TC-PAY-199 | Tab Rút tiền ở /admin: lọc trạng thái và thao tác Duyệt/Đã chi trả/Từ chối | UI tab Rút tiền ở /admin cũ đã bỏ (Admin Console thay thế); trùng ADM2 mục Chi trả. API đã có PAY-192..198. |
| TC-PAY-200 | Số dư có thể âm khi hoàn tiền sau khi đã rút (ghi nhận, chưa xử lý) | Kỳ vọng lỗi thời: nay hoàn tiền sau payout ghi sổ nợ OwnerBalanceLedger và chặn payout PAYOUT_BLOCKED (payments.md 3.5); trùng MONEY 'Kịch bản nợ S1/S2'. |
| TC-PAY-214 | Kick thành viên trả phí: quyền bị xóa nhưng gói/hoàn tiền chưa chốt | Kỳ vọng sai: kick nay kết thúc gói NGAY + thông báo 'không bị tính phí thêm' (endMembership, payments.md 3.2); MONEY đã có case kick. |
| TC-PAY-215 | Ban thành viên trả phí: chặn checkout/confirm/trial, chưa xử lý gói đang chạy | Kỳ vọng sai: ban nay dừng gia hạn (cancelAtPeriodEnd) + gỡ quyền, gỡ ban trả quyền (stopRenewals, payments.md 3.2/3.3); MONEY/GAME đã có. |
| TC-PAY-217 | Xóa cộng đồng có gói đang chạy (chưa chốt xử lý gói/hoàn tiền) | Đã làm: xóa cộng đồng gọi endAllForCommunity kết thúc gói, scheduler không thu phí (payments.md 3.2); MONEY đã có case xóa/khóa cộng đồng. |
| TC-NOTI-068 | Chốt cách xác thực SSE cuối cùng (ticket hay cookie) và bỏ ?access_token | Đã chốt trong code: ?access_token= bị bỏ, chỉ Bearer/ticket (notifications.routes.ts streamAuth, notifications.md); SECX có case SSE. Phần còn mở (cookie vs ticket) không phải test case. |
| TC-NOTI-074 | Fallback ?access_token= hợp lệ mở được stream; token sai -> 401 | Tính năng bị gỡ: ?access_token= nay luôn 401 (notifications.routes.ts:25-33, notifications.md 'Đã bỏ'); SECX nhóm SSE đã kiểm. |
| TC-NOTI-151 | Người nhận đang online chỉ nhận realtime, không tạo thông báo | Cơ chế online-signal (push()===0) đã gỡ: luôn lưu thông báo, chỉ bỏ khi chính người nhận vừa xem cuộc trò chuyện <30s (messages.md 'Thông báo'); INFRA mục 5 đã có 'SSE mở nhưng không xem vẫn có Notification' và 'đang xem ack 30s'. |
| TC-SEARCH-007 | Khớp chuỗi con nguyên cụm (không tách từ) | Ngữ nghĩa cũ (chỉ khớp chuỗi con nguyên cụm) đã đổi: nay khớp theo từ, tiền tố từng từ, không cần đúng thứ tự (search.md 'Cách hoạt động'); PERF-007/012 đã có. |
| TC-SEARCH-028 | Bài viết bị ẩn (hidden) chỉ mod trở lên thấy | Ghi chú 'Post chưa có hidden' sai; hidden đã lọc trong SQL, tác giả thường KHÔNG tự thấy bài ẩn của mình (search.md Quy tắc hiển thị); trùng PERF-030. |
| TC-SEARCH-046 | Chưa làm: tìm bằng tsvector/GIN, xếp hạng độ liên quan, sửa lỗi gõ | Đã làm: tsvector/GIN, ts_rank, pg_trgm chịu gõ sai (search.md; migration 20261005100000); PERF-012/014/022/023 đã phủ. |
| TC-SEARCH-048 | Hiệu năng: quét trong bộ nhớ, cộng đồng lớn có thể trần 1000 mục | Đã đẩy xuống SQL, hết trần 1000 mục; trùng PERF-024 (bài cũ vẫn tìm được) và PERF-047. |
| TC-UPLOAD-045 | /files công khai theo URL khóa 128-bit (chưa chốt) | Kỳ vọng ngược chiều đã chốt: message_attachment là file riêng tư, ẩn danh nhận 401, cần Bearer/URL ký (uploads.routes.ts GET /files/:key; uploads.md). SECX có ma trận /files theo purpose. |
| TC-ADMIN-055 | Platform Admin thấy mục "Quản trị" trong menu avatar và trang /admin có 4 tab | UI /admin 4 tab ('Quản trị nền tảng') đã được thay bằng Admin Console (App.tsx /admin/*); trùng ADM (khung admin). |
| TC-ADMIN-057 | FE xác định admin bằng GET /api/admin/refunds?page=1&limit=1: 200 với admin, 403 với người khác | FE không còn xác định admin bằng GET /admin/refunds mà bằng GET /admin/me (frontend/src/features/admin/queries.ts:10); ADM đã có case /admin/me. |
| TC-ADMIN-063 | UI tab "Khóa cộng đồng": nhập id/slug + lý do rồi Khóa, sau đó Mở khóa | Tab 'Khóa cộng đồng' của /admin cũ đã bỏ; khóa/mở khóa nay trong Admin Console (ADM Cộng đồng). API lock vẫn được ADMIN-058..062 phủ. |
| TC-ADMIN-074 | Tổng quan số liệu toàn nền tảng (người dùng, cộng đồng, giao dịch, báo cáo) trên /admin | Đã làm: Admin Console có Dashboard tổng quan (ADM). |
| TC-ADMIN-075 | Danh sách và tìm kiếm người dùng/cộng đồng toàn nền tảng cho Platform Admin | Đã làm: Admin Console có danh sách/tìm kiếm Người dùng và Cộng đồng (ADM). |
| TC-ADMIN-076 | Ban tài khoản trên toàn nền tảng (khác với ban trong một cộng đồng) | Đã làm: admin suspend/ban tài khoản toàn nền tảng (admin-users.service.ts suspend/ban; ADM Người dùng). |
| TC-INTEG-018 | Xác nhận thanh toán (confirm) 2 lần song song: chỉ tính tiền và xuất hóa đơn một lần | Trùng PAY-057 (confirm song song) và MONEY. |
| TC-INTEG-019 | Idempotency-Key: gửi checkout 2 lần với cùng key trả về cùng một giao dịch | Trùng PAY-052 (Idempotency-Key cùng key). |
| TC-INTEG-020 | Idempotency-Key dùng lại cho khóa học khác bị 409 | Trùng PAY-054. |
| TC-INTEG-023 | Hai lệnh rút tiền song song không vượt số dư (khóa hàng Course) | Trùng PAY-191 (rút tiền song song, đã cập nhật theo số có thể rút). |
| TC-INTEG-024 | Hoàn tiền: hai admin duyệt song song cùng yêu cầu chỉ hoàn một lần | Trùng MONEY 'hai request PATCH approve cùng lúc' và PAY-097/102. |
| TC-INTEG-031 | Webhook chữ ký hợp lệ payment.succeeded: giao dịch pending chuyển succeeded, cấp quyền, phát hành hóa đơn | Trùng PAY-126 (webhook payment.succeeded). |
| TC-INTEG-032 | Webhook trùng event id: trả 200 duplicate, không xử lý lần hai | Trùng PAY-127 (webhook trùng event id); ngữ nghĩa duplicate mới (done/processing) thuộc MONEY. |
| TC-INTEG-033 | Webhook chữ ký sai, thiếu header hoặc timestamp lệch > 300 giây bị từ chối 400 chung chung | Trùng PAY-128..133. |
| TC-INTEG-034 | Chữ ký tính trên raw body: đổi khoảng trắng/thứ tự khóa JSON sau khi ký làm chữ ký sai | Trùng PAY-130 (sửa body sau khi ký). |
| TC-INTEG-035 | Webhook loại sự kiện lạ hoặc payment không tồn tại trả 200 ignored (cổng không retry vô hạn) | Trùng PAY-135 (ignored). |
| TC-INTEG-036 | Webhook payment.refunded tạo yêu cầu hoàn tiền chờ duyệt cho admin | Kỳ vọng sai: webhook payment.refunded nay áp dụng ngay (RefundRequest auto, status approved, cổng không gọi lại) - payments.service.ts case 'payment.refunded'; PAY-137 đã đúng. |
| TC-INTEG-037 | Vé SSE dùng một lần và hết hạn sau 30 giây; thiếu xác thực trả 401 | Trùng NOTI-069..073 (vé SSE). |
| TC-INTEG-038 | SSE thông báo: hành động của người khác đẩy thông báo tới tab đang mở, không cần tải lại | Trùng NOTI-076 (SSE realtime). |
| TC-INTEG-040 | SSE tin nhắn: hai tab của người nhận đều nhận tin, người gửi cũng thấy ở tab khác | Trùng NOTI-147/080 (SSE tin nhắn nhiều tab). |
| TC-INTEG-041 | Fallback ?access_token= cho SSE thông báo còn hoạt động (rủi ro lộ token trong URL/log) | ?access_token= đã bỏ (luôn 401); xem NOTI-074, SECX. |
| TC-INTEG-049 | GET /api/dev/outbox chỉ có ngoài production và trả thư đặt lại/xác thực mật khẩu | Trùng SECX: /api/dev/outbox nay chỉ mount khi ENABLE_DEV_OUTBOX=1, không còn theo NODE_ENV (cases_audit_secx.py dòng 69-77). |
| TC-INTEG-050 | Production từ chối khởi động nếu JWT secret còn giá trị mặc định dev-* | Trùng SECX (guard secret dev-* khi production, env-guard.ts). |
| TC-SEC-057 | Không có rate limit toàn cục cho API: 100 request liên tiếp vào /api/courses vẫn 200 | Lỗi thời: nay có rate limit toàn cục 1200/phút/IP + nhóm ghi (middlewares/rate-limit.ts); GAME đã có case rate limit. |

## Sửa tại chỗ (UPDATE)

| TC | Tiêu đề | Lý do / bằng chứng |
|---|---|---|
| TC-PAY-153 | Số dư khả dụng và số tiền đã yêu cầu rút | availableBalanceCents nay = số CÓ THỂ RÚT (holding 14 ngày, reserve 10%), total=35415 là totalBalanceCents (balanceView, payments.service.ts:56-74). |
| TC-PAY-156 | Lọc from/to: khoảng tương lai cho số 0 nhưng số dư vẫn toàn thời gian | Số 35415 nay là totalBalanceCents; available/held/reserve giống lần không lọc. |
| TC-PAY-161 | Dashboard /courses/paid-demo/revenue-dashboard hiển thị thẻ số liệu khớp API | Nhãn thẻ FE: 'Có thể rút ngay', 'Đang giữ', 'Quỹ dự phòng' (RevenuePage.tsx:154-156) thay 'Số dư khả dụng $354.15'. |
| TC-PAY-162 | Bộ lọc Từ ngày/Đến ngày trên dashboard | Tên thẻ FE đổi như PAY-161. |
| TC-PAY-167 | Owner yêu cầu rút tiền hợp lệ: số TK bị che ****6789 | Số dư trước/sau tính theo W (có thể rút); totalBalance 35415->25415. |
| TC-PAY-170 | Vượt số dư khả dụng bị 400 | Lỗi nay PAYOUT_EXCEEDS_AVAILABLE 'vượt quá số dư có thể rút' (payments.service.ts requestPayout); biên theo W chứ không phải 35415. |
| TC-PAY-171 | Rút hết số dư khả dụng đúng bằng số dư | Rút hết = W (số có thể rút), không phải net - requested. |
| TC-PAY-189 | Form rút tiền trên dashboard: rút thành công hiện trong 'Lệnh rút tiền' | Thẻ 'Có thể rút ngay' giảm $60; cần W>=60. |
| TC-PAY-190 | Form rút tiền hiển thị lỗi BE khi dưới $50 hoặc vượt số dư | Thông báo lỗi BE mới 'Số tiền rút vượt quá số dư có thể rút (...)'. |
| TC-PAY-191 | Hai lệnh rút song song không vượt tổng số dư | Số tiền mỗi lệnh theo W, không còn 2x20000 vs 35415. |
| TC-PAY-195 | Admin từ chối payout: số dư được hoàn lại | Reject payout: totalBalance +5000, available tăng tối đa 5000 (công thức withdrawable). |
| TC-PAY-109 | Hoàn tiền một phần (partial refund) | Admin duyệt hoàn một phần đã có (admin-payments.service.ts approveRefund amountCents); phía người mua vẫn chưa. |
| TC-NOTI-055 | Cache tùy chọn 5 giây: đổi tùy chọn có hiệu lực (giá trị tạm) | Cache prefs 5s nay có vô hiệu qua pub/sub notif:prefs (notifications.md). |
| TC-NOTI-082 | Token bị thu hồi (đăng xuất/đổi mật khẩu): dùng token cũ mở stream mới -> 401 | Bước 3 dùng Bearer vì ?access_token= đã bỏ (luôn 401). |
| TC-NOTI-150 | Người nhận offline nhận thông báo message_received (gộp 1/5 phút) | Gộp 1/5 phút bằng SET NX PX ở state chia sẻ, thông báo luôn lưu (messages.md). |
| TC-SEARCH-001 | Tìm "nhiếp ảnh" trả kết quả nhóm khóa học, thành viên, bài viết + counts | Thứ tự trong nhóm: ts_rank/điểm tên rồi mới nhất (search.md Xếp hạng). |
| TC-SEARCH-003 | type=posts chỉ trả bài viết trong cộng đồng của user | Bài viết xếp ts_rank rồi mới nhất. |
| TC-SEARCH-004 | type=members trả thành viên khớp tên/handle trong cộng đồng của user | Handle chỉ khớp phần slug khi q có '-'; khớp theo họ tên 'Mai Member2'. |
| TC-SEARCH-044 | Ký tự regex/SQL trong q được coi là chuỗi thường | Cơ chế: escape LIKE + to_tsquery làm sạch, không còn 'chuỗi con nguyên văn'. |
| TC-UPLOAD-040 | Phục vụ file tài liệu: attachment + cache riêng tư | post_file là file riêng tư: GET ẩn danh 401; Bearer/URL ký 200; Cache-Control private, no-store (uploads.routes.ts:69). |
| TC-ROLE-051 | Hoàn tiền/rút tiền phía admin (GET /api/admin/refunds, GET /api/admin/payouts) | 403 cho người không phải nhân viên nay là 'Chỉ nhân viên admin mới có quyền này' (adminOnly + assertAllowed, admin-staff.service.ts:53) thay vì 'Chỉ Platform Admin'; thêm E403S. |
| TC-ROLE-050 | Yêu cầu rút tiền paid-demo: chỉ đúng Owner (Platform Admin cũng bị chặn) | Số 'có thể rút' thay vì 'khả dụng', lỗi PAYOUT_EXCEEDS_AVAILABLE. |
| TC-ADMIN-064 | Admin lọc và xem yêu cầu hoàn tiền: pending/approved/rejected khớp seed | Bỏ bước UI tab Hoàn tiền (UI cũ); trỏ ADM2. |
| TC-ADMIN-067 | Xử lý lại yêu cầu hoàn tiền đã xử lý → 409; id sai → 404; action sai → 400; owner → 403 | Owner nhận 'Chỉ nhân viên admin' (adminOnly). |
| TC-ADMIN-068 | Admin duyệt yêu cầu rút tiền: requested → approved → paid, owner nhận thông báo mỗi bước | Bỏ bước UI tab Rút tiền. |
| TC-ADMIN-069 | Admin từ chối payout: số dư khả dụng của owner được hoàn lại | Reject payout: available tăng tối đa 5000, total +5000. |
| TC-ADMIN-070 | Chuyển trạng thái payout sai thứ tự bị 409; owner/khách bị chặn | Owner 403 'Chỉ nhân viên admin mới có quyền này'. |
| TC-ADMIN-072 | PLATFORM_ADMIN_EMAILS rỗng: không ai là Platform Admin kể cả admin@sofinhub.test | Message 403 khác nhau: refunds -> nhân viên admin; lock -> Platform Admin. |
| TC-ADMIN-073 | Rủi ro chiếm quyền: email trong PLATFORM_ADMIN_EMAILS chưa có tài khoản — ai đăng ký trước sẽ thành Platform Admin | GET /api/dev/outbox cần ENABLE_DEV_OUTBOX=1. |
| TC-SEC-052 | Cookie refresh_token có HttpOnly, Path=/api/auth, SameSite=Lax (dev), Secure/None chỉ khi production | Cờ Secure đặt mọi môi trường trừ development (auth.routes.ts:30-39). |
| TC-SEC-074 | Khu quản trị /admin và kiểm duyệt trên mobile và tablet | UI /admin nay là Admin Console (sidebar + nút Mở menu), không còn 4 tab. |
| TC-SEC-075 | Trạng thái loading: trang Quản trị và Kiểm duyệt hiện chữ đang tải khi API chậm | Loading /admin chờ GET /api/admin/me (AdminLayout.tsx:364). |
| TC-INTEG-045 | Chạy `npm run db:seed` hai lần liên tiếp không nhân đôi dữ liệu | Số tài khoản seed >= 9 (thêm nhân viên admin đợt 3). |
| TC-INTEG-047 | db:reset đưa dữ liệu về trạng thái ban đầu: báo cáo seed lại ở trạng thái open | Như INTEG-045. |
| TC-ROLE-079 | Mass assignment: PATCH /api/auth/me không cho tự sửa role, emailVerified, isDemo, tokenVersion, email | 403 cho /api/admin/refunds nay là message nhân viên admin (E403S). |
