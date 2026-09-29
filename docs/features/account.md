# Tài khoản, hồ sơ và hỗ trợ (nhóm FE-account) - kịch bản test thủ công

## Chuẩn bị chung
- Chạy backend (`localhost:4000`) và frontend (Vite). Cần ít nhất 2 tài khoản (đăng ký qua `/register`), ví dụ A và B.
- **Email thật không được gửi.** Ở môi trường dev, mọi email (đặt lại mật khẩu, xác thực email) nằm trong hộp thư giả: mở `http://localhost:4000/api/dev/outbox?to=<email>` trên trình duyệt, lấy liên kết trong trường `text` (dạng `http://.../reset-password?token=...` hoặc `.../verify-email?token=...`). Chỉ có khi `NODE_ENV` khác `production`.
- Phiên, token một lần và cooldown gửi lại email xác thực nằm trong DB (Postgres); rate limit nằm trong bộ nhớ BE nên restart BE là reset.
- Vai trò: các trang dưới đây đều dùng được cho mọi người dùng đã đăng nhập, trừ quên/đặt lại mật khẩu, xác thực email, liên hệ, bản tin (công khai).

## 1. Quên mật khẩu (`/forgot-password`)
Vào: trang `/login` -> bấm "Quên mật khẩu?".
1. Bỏ trống email, bấm gửi -> báo "Vui lòng nhập email". Nhập "abc" -> "Email không hợp lệ".
2. Nhập email A hợp lệ -> hiện thông điệp thành công (BE luôn trả cùng một thông điệp). Nhập email không tồn tại cũng cho thông điệp y hệt (không lộ tài khoản).
3. Lấy liên kết trong dev outbox của A (xem "Chuẩn bị chung").
4. Lỗi cần thử: gửi liên tục hơn 5 lần trong 15 phút -> báo lỗi giới hạn tốc độ (429) bằng thông điệp từ BE.

## 2. Đặt lại mật khẩu (`/reset-password?token=...`)
1. Mở liên kết lấy từ outbox. Nhập mật khẩu yếu (ngắn, không hoa, không ký tự đặc biệt) -> báo lỗi tại ô. Nhập lại không khớp -> báo lỗi.
2. Nhập mật khẩu mạnh (vd `Matkhau@123`) -> "Đã đặt lại mật khẩu", nút Đăng nhập. Đăng nhập được bằng mật khẩu mới; mật khẩu cũ không còn dùng được; mọi thiết bị khác bị đăng xuất.
3. Mở lại chính liên kết đó, đặt lần nữa -> trang "Liên kết không hợp lệ" (token đã dùng) kèm nút "Yêu cầu liên kết mới".
4. Mở `/reset-password` không có token, hoặc token bậy -> "Liên kết không hợp lệ". Token hết hạn sau 30 phút cũng ra trang này.

## 3. Xác thực email
- Tài khoản mới có `emailVerified=false`. Vào `/settings`: có banner vàng "Email chưa xác thực".
1. Bấm "Gửi email xác thực" -> báo đã gửi, nút chuyển thành "Gửi lại sau 60s" đếm ngược. Lấy liên kết trong outbox.
2. Mở `/verify-email?token=...` -> "Email của bạn đã được xác thực". Quay lại `/settings` -> banner biến mất (nếu đang đăng nhập cùng tài khoản; nếu chưa thấy hãy F5).
3. Mở lại chính liên kết -> báo lỗi (token đã dùng) + nút mở Cài đặt. `/verify-email` không token -> báo thiếu mã.
4. Bấm gửi lại khi cooldown đang chạy trên BE (vd tải lại trang rồi bấm ngay) -> báo "vui lòng đợi", đếm ngược 60s. Khi đã xác thực, banner không hiện.
5. Mở liên kết xác thực của A khi đang đăng nhập B: trang báo thành công nhưng thông tin B không bị đổi.

## 4. Cài đặt tài khoản (`/settings`)
Chưa đăng nhập -> tự chuyển về `/login`; sau đăng nhập quay lại `/settings`. Mở từ menu avatar ở Header -> "Cài đặt tài khoản". Có 4 tab.

**Hồ sơ**
1. Sửa Họ, Tên, Giới thiệu (tối đa 500), Vị trí, Website, URL ảnh đại diện -> "Lưu thay đổi" -> "Đã lưu hồ sơ". Tên ở Header cập nhật ngay; F5 vẫn giữ.
2. Xóa trống Họ/Tên -> báo lỗi tại ô. Website `abc` -> "phải bắt đầu bằng http://". Avatar không phải http(s) hay `/files/...` -> báo lỗi.
3. Xóa trống bio/website -> lưu -> trường bị xóa ở hồ sơ công khai.

**Mật khẩu**
1. Sai mật khẩu hiện tại -> lỗi hiện ngay dưới ô "Mật khẩu hiện tại" (không bị đăng xuất). Mật khẩu mới yếu/không khớp/trùng cũ -> báo lỗi tại ô.
2. Đúng -> "Đã đổi mật khẩu"; thiết bị/phiên khác bị đăng xuất, phiên hiện tại giữ nguyên.

**Phiên đăng nhập**
1. Đăng nhập cùng tài khoản trên 2 trình duyệt. Danh sách hiện thiết bị (trình duyệt/OS), IP, giờ đăng nhập, hoạt động gần nhất; phiên hiện tại có nhãn xanh và không có nút thu hồi.
2. "Thu hồi" phiên kia -> biến mất khỏi danh sách; trình duyệt kia bị đăng xuất khi access token hết hạn (tối đa ~15 phút) hoặc khi refresh.
3. "Đăng xuất mọi thiết bị" -> hỏi xác nhận -> về `/login`; mọi trình duyệt bị đăng xuất.

**Xóa tài khoản**
1. Bỏ trống mật khẩu -> báo lỗi. Sai mật khẩu -> lỗi tại ô mật khẩu.
2. Tài khoản đang là chủ (owner) cộng đồng -> lỗi 409 kèm hướng dẫn chuyển quyền owner trước (link tới Cộng đồng của tôi). (Tính năng chuyển quyền thuộc nhóm community.)
3. Tài khoản không phải owner, đúng mật khẩu, xác nhận hộp thoại -> về trang chủ ở trạng thái khách; đăng nhập lại bằng tài khoản này thất bại.

## 5. Hồ sơ công khai (`/users/:id`)
Vào từ menu avatar -> "Hồ sơ của tôi", hoặc link "Xem hồ sơ công khai" trong Cài đặt. Cần đăng nhập (BE yêu cầu).
1. Hiện avatar (hoặc chữ cái), tên, bio, vị trí, website (mở tab mới, `rel=noopener`), ngày tham gia, tổng điểm, danh sách cộng đồng công khai đã tham gia kèm vai trò (bấm vào -> trang cộng đồng). Không hiện email. Cộng đồng riêng tư không xuất hiện.
2. Hồ sơ của chính mình có nút "Chỉnh sửa hồ sơ" -> `/settings`; hồ sơ người khác không có nút.
3. `/users/khong-ton-tai` -> trang 404 thân thiện với nút về trang chủ.
4. Chưa đăng nhập -> chuyển về `/login`.

## 6. Cộng đồng của tôi (`/me/communities`)
Vào từ menu avatar. Cần đăng nhập.
1. Lưới thẻ cộng đồng đã tham gia: ảnh, tên, vai trò của tôi, ngày tham gia, thanh % tiến độ (bài hoàn thành/tổng bài), nút "Vào cộng đồng".
2. Tài khoản chưa tham gia gì -> trạng thái rỗng + nút "Khám phá cộng đồng" (về trang chủ).
3. Khối "Điểm của tôi": tổng điểm, điểm theo từng cộng đồng, 20 hoạt động điểm gần nhất (đăng bài +5, được thích +2, hoàn thành bài học +3, đăng ký sự kiện +1). Làm các hành động đó trong cộng đồng rồi tải lại để thấy điểm tăng.

## 7. Bản tin và Liên hệ
**Bản tin (Footer, ô "Nhận bản tin")**: nhập email hợp lệ -> "Cảm ơn bạn đã đăng ký!" (gửi lại cùng email vẫn thành công - idempotent). Email sai định dạng -> báo lỗi của BE/trình duyệt. Gửi liên tục nhiều lần -> báo thao tác quá nhanh (429). Nút khóa khi đang gửi.

**Liên hệ (`/contact`, link "Liên hệ" ở Footer)**
1. Bỏ trống từng ô -> báo lỗi tại ô. Nội dung tối đa 5000 ký tự.
2. Điền đủ -> gửi -> thông báo thành công (BE trả 202), form được làm trống.
3. Gửi hơn 5 lần trong 15 phút -> báo "quá nhiều yêu cầu" (429).

## 8. Yêu cầu đăng nhập
Khi chưa đăng nhập, `/settings`, `/me/communities`, `/users/:id` chuyển về `/login` (kèm `state.from`), đăng nhập xong quay lại đúng trang. Khi phiên hết hạn giữa chừng, thao tác bị 401 -> FE tự refresh; nếu refresh thất bại thì thành khách và các trang trên chuyển về `/login`.

## 9. Menu avatar ở Header
Bấm avatar: Hồ sơ của tôi, Cộng đồng của tôi, Cài đặt tài khoản, Đăng xuất. Mỗi mục đóng menu và chuyển trang đúng.

## Chưa làm / giới hạn / Thiếu ở BE
- Ảnh đại diện chỉ nhập URL (chưa có upload).
- Header vẫn hiện chữ cái đầu thay vì ảnh đại diện; menu avatar trong khu cộng đồng (CommunityTopbar) chưa có các mục mới (thuộc nhóm khác).
- BE trả chung 400 cho "sai mật khẩu hiện tại / trùng mật khẩu cũ" của đổi mật khẩu và chung 400 cho mọi lỗi token của reset; FE suy luận (mật khẩu mới đã kiểm tra ở FE). Không có `Retry-After` cho 429 nên đếm ngược cooldown xác thực email là 60s cố định.
- Không có endpoint chuyển quyền owner để gỡ lỗi 409 khi xóa tài khoản (nhóm community).
- Hồ sơ công khai yêu cầu đăng nhập (BE dùng Bearer).
- `/me/points` chỉ trả `courseId` ở `recent`; FE ghép tên cộng đồng từ danh sách tham gia/`byCourse`, có thể hiện "Cộng đồng" nếu không khớp.
- Phiên, token, newsletter nằm trong DB; rate limit (đăng nhập, quên mật khẩu, liên hệ) nằm trong bộ nhớ BE.
- Chưa làm các link Footer khác (Trung tâm trợ giúp, Về chúng tôi...) và trang hủy bản tin.
