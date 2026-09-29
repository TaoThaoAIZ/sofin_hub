# Nhóm FE-platform — kịch bản test thủ công

Gồm: thông báo, tin nhắn, tìm kiếm, thanh toán/gói/hoàn tiền/rút tiền, quản trị nền tảng, hook upload dùng chung.
Chuẩn bị chung: Dữ liệu nằm trong **Postgres thật** (không mất khi restart). Chuẩn bị: bật Docker, `cd backend && npm run db:up && npm run db:deploy && npm run db:seed`, rồi chạy BE/FE. Muốn về trạng thái sạch ban đầu: `npm run db:reset` (xóa toàn bộ và seed lại). Chạy backend (`cd backend && npm run dev`) và frontend (`cd frontend && npm run dev`). Dùng tài khoản seed (member1, member2, admin...) hoặc tự đăng ký. Platform Admin = email trong `PLATFORM_ADMIN_EMAILS` ở `backend/.env` (đã đặt `admin@sofinhub.test`).

Các vai trò: Thành viên (đăng nhập), Owner (chủ cộng đồng), Platform Admin.

---

## 1. Thông báo
Vị trí: chuông ở topbar cộng đồng (`/courses/:id/community`) và ở Header các trang ngoài (từ màn hình ≥ 640px); trang đầy đủ `/notifications`.

1. Đăng nhập A, mở cộng đồng. Chuông không có badge khi chưa có thông báo. Đăng nhập B ở cửa sổ ẩn danh, B thích/bình luận bài của A (hoặc B nhắn tin cho A khi A đang offline) — chuông của A hiện badge số chưa đọc và một toast nhỏ góc phải dưới trong vài giây (không cần F5). Bấm toast: mở link của thông báo và đánh dấu đã đọc.
2. Bấm chuông: dropdown tối đa 10 thông báo mới nhất, mục chưa đọc có nền cam nhạt + chấm. Bấm 1 thông báo: đánh dấu đã đọc, badge giảm, chuyển tới `link`. "Đọc tất cả": badge về 0. "Xem tất cả thông báo" mở `/notifications`.
3. `/notifications`: danh sách phân trang (20/trang); nút "Chưa đọc" lọc chỉ chưa đọc; nút thùng rác xóa từng cái; "Đọc tất cả".
4. Link lạ: thông báo có `link` tới trang FE chưa tồn tại sẽ hiện trang 404 của app (không lỗi trắng). Link không bắt đầu bằng `/` hoặc dạng `//host` bị bỏ qua (chỉ đánh dấu đã đọc).
5. Tuỳ chọn (cuối trang `/notifications`): công tắc bật/tắt từng loại; 5 loại bắt buộc (thanh toán thành công/thất bại, đổi vai trò, bị xóa khỏi cộng đồng, báo cáo được xử lý) hiện nhãn "Bắt buộc" và công tắc bị khóa. Tắt "Thích bài viết" rồi cho B thích bài của A: A không nhận thông báo. "Email tổng hợp" chỉ lưu tuỳ chọn (BE chưa gửi email).
6. Realtime/kết nối lại: tắt backend vài giây rồi bật lại — app tự nối lại (backoff 1s, 2s, 4s… tối đa 30s), sau khi nối lại danh sách/badge được tải lại. Đăng xuất: kết nối SSE đóng (tab Network không còn request `stream`).
Lỗi cần thử: chưa đăng nhập vào `/notifications` -> hiện yêu cầu đăng nhập; thông báo bị xóa ở tab khác -> thao tác xóa/đọc báo lỗi.

## 2. Tin nhắn
Vị trí: icon tin nhắn ở topbar/Header (badge chưa đọc), trang `/messages` và `/messages/:conversationId`; nút chat trong bảng Thành viên (`/courses/:id/community/thanh-vien`).

Điều kiện: A và B cùng là thành viên của ít nhất 1 cộng đồng.
1. A vào tab Thành viên, bấm nút chat cạnh B -> chuyển tới `/messages/<id>` với khung chat trống. Nút bị khóa ở dòng của chính mình và thành viên minh họa (id `seed:`).
2. A gửi "xin chào" (Enter gửi, Shift+Enter xuống dòng). B (cửa sổ khác) thấy badge tin nhắn tăng và cuộc trò chuyện xuất hiện/nhảy lên đầu ngay không cần F5; mở cuộc trò chuyện -> badge về 0 (đã gọi `POST /conversations/:id/read`).
3. Đính kèm: bấm ghim, chọn ảnh (≤25MB, jpeg/png/webp/gif) và/hoặc pdf/zip/docx/xlsx/pptx/txt. Tối đa 5 tệp/tin. Ảnh hiển thị thumbnail, tệp khác là link tải. Nếu chỉ gửi tệp (không gõ chữ) nội dung tự là "Đã gửi N tệp đính kèm" (BE bắt buộc content ≥1 ký tự).
4. Thu hồi: rê chuột lên tin của mình, bấm biểu tượng ↩ -> xác nhận -> tin đổi thành "Tin nhắn đã bị thu hồi" ở cả hai phía (SSE `message_deleted`).
5. Tải tin cũ: gửi >30 tin, mở lại cuộc trò chuyện -> nút "Tải tin cũ hơn" nạp thêm mà vị trí cuộn không nhảy.
6. Chặn: trong khung chat bấm "Chặn" (có xác nhận) -> ô nhập bị thay bằng dòng "Bạn đã chặn…"; B gửi tin cho A bị báo lỗi 403. Biểu tượng khiên ở đầu danh sách mở "Người dùng đã chặn" để bỏ chặn. Bấm "Bỏ chặn" trong khung chat cũng được.
7. Thông báo `message_received`: khi A offline (không có tab nào mở), B nhắn -> lần sau A mở app thấy thông báo "tin nhắn mới", bấm vào mở `/messages/<conversationId>`.
Lỗi cần thử: nhắn người không chung cộng đồng (chỉ thử được bằng cách rời cộng đồng rồi tạo cuộc trò chuyện mới) -> báo "Chỉ nhắn tin được với thành viên chung cộng đồng"; gửi >20 tin/phút -> 429 báo "gửi quá nhanh"; mở `/messages/id-sai` -> "Không tìm thấy cuộc trò chuyện"; tệp sai loại/quá dung lượng -> báo lỗi trước khi upload; vượt hạn mức 200MB -> "Bạn đã dùng hết dung lượng lưu trữ".

## 3. Tìm kiếm
Vị trí: ô tìm kiếm trên topbar cộng đồng (⌘K/Ctrl+K focus); icon kính lúp ở Header (mở `/search`); trang `/search?q=&type=&courseId=&page=`. Cần đăng nhập.

1. Gõ ≥2 ký tự vào ô topbar: sau ~250ms hiện dropdown ≤5 gợi ý (khóa học/thành viên/bài viết) với phần khớp được bôi đậm. ↑/↓ chọn, Enter mở mục đang chọn, Esc đóng. Dòng cuối "Xem tất cả kết quả" hoặc Enter khi không chọn mục nào -> `/search?q=…`.
2. Tìm không phân biệt dấu/hoa thường (gõ "nhiep anh" khớp "Nhiếp ảnh").
3. Trang `/search`: tab Tất cả / Khóa học / Bài viết / Thành viên (kèm số lượng), lọc "Mọi cộng đồng" theo cộng đồng của tôi, phân trang. Bấm kết quả: bài viết -> `/courses/:cid/community?post=:id`; thành viên -> `/users/:id` (thành viên minh họa `seed:` -> tab Thành viên với `?q=handle`); khóa học -> `/courses/:id`. (Cuộn tới bài `?post=` phụ thuộc nhóm FE-community.)
4. Lỗi: <2 ký tự -> "Nhập ít nhất 2 ký tự"; >40 lần/phút -> 429 báo thử lại sau; chọn cộng đồng không phải thành viên (sửa URL `courseId`) -> 403 thông báo dễ hiểu; không kết quả -> "Không có kết quả".
Kiểm tra bảo mật: tìm chuỗi `<b>x</b>`/`<script>` — kết quả hiển thị chữ thô, không render HTML.

## 4. Thanh toán, gói, hoàn tiền, doanh thu
### 4.1 Checkout & dùng thử (`/courses/:id/checkout`, cộng đồng có phí)
1. Mở trang thanh toán bằng tài khoản chưa tham gia, chọn phương thức, bấm Thanh toán -> gửi header `Idempotency-Key` (uuid mới mỗi lần mở trang; xem tab Network). Thành công -> chuyển vào cộng đồng.
2. Nút "Bắt đầu dùng thử" (trong khung xanh): tạo gói `trialing` (`POST /courses/:id/trial`) và vào cộng đồng ngay. Lỗi: dùng thử lần 2 -> 409 báo lỗi; đã tham gia -> 409; khóa miễn phí -> 400.
### 4.2 Gói & thanh toán `/billing` (menu avatar -> "Gói & thanh toán")
1. "Gói của tôi": trạng thái (Đang dùng thử / Đang hoạt động / Đã hủy — còn truy cập đến hết kỳ / Đã hết hạn), kỳ hiện tại, ngày truy cập đến.
2. "Hủy gói" -> hộp thoại chọn "Hủy vào cuối kỳ" hoặc "Hủy ngay" -> xác nhận. Sau khi hủy cuối kỳ, nút đổi thành "Tiếp tục gói" (`resume`); thử "Tiếp tục" khi hết kỳ -> báo lỗi 409.
3. "Lịch sử thanh toán": bảng phân trang 10/dòng (ngày, cộng đồng, loại, số tiền, trạng thái). "Hóa đơn" mở hộp thoại hóa đơn (số INV-…, người mua, mục, tổng) có nút "In hóa đơn" (chỉ in phần hóa đơn). Giao dịch chưa có hóa đơn -> không có nút.
4. "Hoàn tiền" (chỉ giao dịch thành công chưa hoàn): nhập lý do (≥3 ký tự) -> gửi. Trong 7 ngày đầu kể từ lần thanh toán đầu của gói: "đã duyệt tự động", giao dịch chuyển "Đã hoàn tiền" và gói bị hủy; quá 7 ngày: "đang chờ quản trị viên duyệt". Gửi lần 2 cho cùng giao dịch -> 409. Trạng thái yêu cầu vừa gửi được ghi nhớ trong localStorage của trình duyệt (BE chưa có API liệt kê yêu cầu hoàn tiền của tôi).
### 4.3 Doanh thu & rút tiền `/courses/:id/revenue-dashboard` (Owner, hoặc Platform Admin chỉ xem)
Truy cập: menu avatar ở topbar cộng đồng -> "Doanh thu & rút tiền" (chỉ hiện khi bạn là Owner/Platform Admin của cộng đồng đó).
1. Thẻ số liệu: tổng thu, hoàn tiền, hoa hồng, phí cổng, net (theo bộ lọc Từ/Đến ngày), số dư khả dụng (toàn thời gian), MRR, đang chờ rút; dưới có ghi chú "hoa hồng là giá trị tạm chờ chốt". Bảng 20 giao dịch gần nhất.
2. Form rút tiền: số tiền (USD), ngân hàng, số TK (6–20 chữ số), chủ TK. Tối thiểu $50 (BE báo lỗi nếu thấp hơn), vượt số dư -> báo lỗi. Thành công -> lệnh hiện trong "Lệnh rút tiền" với số TK dạng `****1234`, trạng thái "Đã yêu cầu".
3. Lỗi cần thử: tài khoản Admin/Mod của cộng đồng (không phải Owner) mở URL -> "Chỉ chủ cộng đồng… mới xem được doanh thu" (403); Platform Admin xem được nhưng bấm rút -> 403 (chỉ Owner được rút).

## 5. Quản trị nền tảng `/admin` (Platform Admin)
Mục "Quản trị" chỉ hiện trong menu avatar khi FE xác định là admin (xem "Cách xác định admin" bên dưới). Tài khoản thường mở `/admin` -> "Bạn không có quyền truy cập khu vực quản trị."
1. Tab Hoàn tiền: lọc Chờ duyệt/Đã duyệt/Từ chối/Tất cả; "Duyệt hoàn tiền" hoặc "Từ chối" kèm ghi chú tùy chọn. Duyệt: giao dịch thành "Đã hoàn tiền" cho người mua (kiểm ở `/billing`) và người mua nhận thông báo. Xử lý lại yêu cầu đã xử lý -> 409 hiển thị trong hộp thoại.
2. Tab Rút tiền: lọc theo trạng thái; Đã yêu cầu -> "Duyệt" -> "Đã chi trả", hoặc "Từ chối" (số dư trả lại cho Owner). Owner nhận thông báo `system` mỗi lần đổi trạng thái.
3. Tab Báo cáo vi phạm: nhúng `ReportQueue` (báo cáo mọi cộng đồng) do nhóm FE-content dựng; cũng còn route riêng `/admin/reports`.
4. Tab Khóa cộng đồng: nhập id/slug cộng đồng + lý do (≥3 ký tự) -> "Khóa cộng đồng"; "Mở khóa" không cần lý do. Khi bị khóa, người dùng thường vào/tham gia cộng đồng sẽ nhận lỗi `COMMUNITY_LOCKED`. Id sai -> 404.

## 6. Hook upload dùng chung `features/uploads/useUpload.ts`
`const { upload, uploading, error } = useUpload(); const f = await upload(file, { purpose, courseId? })` -> `{ url, key, name, contentType, size }` (`url` là đường dẫn BE trả, dạng `/api/files/<key>`; lưu nguyên vào DB/bài viết/tin nhắn; để hiển thị dùng `resolveApiPath(url)` trong `lib/api.ts` — khi `VITE_API_URL` là URL tuyệt đối). Kiểm loại/dung lượng ở FE trước (bảng theo purpose ở `backend/docs/api/uploads.md`), xử lý 413 `QUOTA_EXCEEDED`. Hàm `upload` ném `Error` với message tiếng Việt và đồng thời đặt `error`. Test nhanh qua đính kèm tin nhắn (mục 2).

---

## Cách xác định Platform Admin ở FE
`AuthUser` không có cờ admin. FE gọi `GET /admin/refunds?page=1&limit=1` một lần (hook `useIsPlatformAdmin`, cache 10 phút): 200 = admin, 403 = không phải admin; lỗi khác = coi như không phải (không hiện menu). Quyền thật luôn do BE kiểm tra ở từng endpoint.

## Chưa làm / giới hạn / Thiếu ở BE
- BE chưa có: API liệt kê yêu cầu hoàn tiền của người dùng (FE tạm nhớ trong localStorage); endpoint "tôi có phải admin không" / cờ admin trong `/auth/me`; endpoint tìm người dùng để bắt đầu chat (chỉ chat qua bảng Thành viên); cập nhật `unreadCount` theo từng cuộc trò chuyện qua SSE (FE tải lại danh sách khi có sự kiện).
- Thông báo/tin nhắn/thanh toán nằm trong Postgres; chỉ vé và kết nối SSE (realtime) nằm trong bộ nhớ tiến trình nên chỉ đúng với 1 instance BE.
- Tin nhắn chỉ có nội dung + tối đa 5 tệp; chưa có sửa tin, "đang gõ", "đã xem", xóa cuộc trò chuyện, báo cáo tin nhắn.
- Email tổng hợp thông báo chỉ lưu tuỳ chọn. Hoàn tiền một phần chưa hỗ trợ (BE). Cổng thanh toán là mô phỏng.
- Nút "Dùng thử" nằm ở trang Checkout (không thêm vào CourseDetailPage để tránh xung đột với nhóm FE-community); banner "7 ngày" là chữ cố định theo `TRIAL_DAYS` mặc định của BE.
- Link "Doanh thu" trong CommunitySettings do nhóm khác sở hữu file, chưa thêm; hiện vào qua menu avatar của topbar cộng đồng.
- Thông báo ở Header ẩn trên màn hình <640px (chật); dùng trang `/notifications` `/messages` qua menu.
- `apiDelete` trong `lib/api.ts` có chữ ký `(path, body?, opts?)` (do nhóm khác thêm); code của nhóm này chỉ gọi `apiDelete(path)`.
