# Cộng đồng: tạo, tham gia, quản trị, đánh giá (nhóm FE-community)

Kịch bản test thủ công. Dữ liệu nằm trong **Postgres thật** (không mất khi restart). Chuẩn bị: bật Docker, `cd backend && npm run db:up && npm run db:deploy && npm run db:seed`, rồi chạy BE/FE. Muốn về trạng thái sạch ban đầu: `npm run db:reset` (xóa toàn bộ và seed lại). Có sẵn dữ liệu test: tài khoản `@sofinhub.test` (mật khẩu `Passw0rd!x`), cộng đồng `private-demo` (riêng tư), `paid-demo` (có phí), mã mời `DEMO-*` — xem `SofinHub_HuongDan_TestThuCong.docx`.

## Chuẩn bị tài khoản
Đăng ký 4 tài khoản (đăng ký tại `/register`), ví dụ A, B, C, D. Dùng nhiều cửa sổ ẩn danh/trình duyệt để đăng nhập song song.
- A = **Owner**: tự tạo cộng đồng bằng tính năng "Tạo cộng đồng" (mục 1), người tạo tự thành Owner.
- B, C, D vào cộng đồng của A (mục 2/3), rồi A cấp vai trò: B = Admin, C = Mod, D = Member (mục 5).
- Platform Admin: đặt email tài khoản vào `PLATFORM_ADMIN_EMAILS` trong `backend/.env` rồi restart BE.
- Cộng đồng minh họa (seed) không có owner: chỉ Platform Admin quản trị được; thành viên minh họa (id `seed:...`) không quản trị được (báo lỗi êm).

## Ma trận vai trò (tóm tắt để đối chiếu)
| Hành động | Member | Mod | Admin | Owner | Platform Admin |
|---|---|---|---|---|---|
| Vào trang Cài đặt (`/courses/:id/community/cai-dat`) | Không | Không | Có | Có | Có |
| Sửa tên/mô tả/ảnh/danh mục/ngôn ngữ | - | - | Có | Có | Có |
| Đổi giá, chế độ riêng tư | - | - | Không (chỉ xem) | Có | Có |
| Duyệt/từ chối yêu cầu, tạo/thu hồi lời mời, xem & bỏ cấm | - | - | Có | Có | Có |
| Đặt Member/Mod cho người bậc thấp hơn | - | - | Có | Có | Có |
| Đặt/bỏ Admin | - | - | Không | Có | Có |
| Xóa khỏi cộng đồng (kick), cấm | - | - | Chỉ người bậc thấp hơn | Chỉ bậc thấp hơn | Có |
| Chuyển quyền chủ, xóa cộng đồng | - | - | - | Có | Có |
| Khóa/mở khóa cộng đồng | - | - | - | - | Có |
| Báo cáo thành viên | Có | Có | Có | Có | Có |
| Xóa đánh giá người khác | - | Có | Có | Có | Có |
| Viết/sửa/xóa đánh giá của mình | Có (chỉ thành viên) | Có | Có | Có | - |

## 1. Tạo cộng đồng
- Route: `/communities/new`. Vào từ nút **Tạo cộng đồng** trên Header hoặc nút **Bắt đầu** ở sidebar khu cộng đồng.
- Ai dùng: mọi tài khoản đã đăng nhập.
- Bước:
  1. Chưa đăng nhập, bấm nút → bị chuyển sang `/login`; đăng nhập xong quay lại trang tạo.
  2. Bước 1 "Thông tin": nhập tên (3-80 ký tự), mô tả, chọn danh mục, ngôn ngữ → Tiếp tục.
  3. Bước 2 "Loại & giá": chọn Công khai/Riêng tư; giá $/tháng (0 = miễn phí) → Tiếp tục.
  4. Bước 3: (tùy chọn) dán URL ảnh bìa, xem trước; xem tóm tắt → **Tạo cộng đồng**.
- Mong đợi: chuyển vào `/courses/<slug>/community`; ở trang cộng đồng, thẻ thông tin bên phải ghi "Vai trò của bạn: Chủ cộng đồng" và có nút **Cài đặt**. Cộng đồng xuất hiện ở trang chủ (sort "trending" sau các cộng đồng seed).
- Lỗi cần thử: tên < 3 ký tự, mô tả trống, chưa chọn danh mục, giá âm/chữ/> 10000 (chặn ở FE, có thông báo đỏ); URL ảnh sai (khung xem trước báo không tải được, vẫn tạo được, dùng ảnh lỗi); bấm Quay lại giữ nguyên dữ liệu đã nhập; để hết hạn phiên rồi tạo (tự refresh token).

## 2. Ba luồng tham gia (`/courses/:id`)
Tạo 3 cộng đồng bằng A: miễn phí-công khai (X), có phí-công khai (Y, ví dụ $10), riêng tư (Z). Dùng tài khoản D để thử.
- **Miễn phí (X)**: bấm **Tham gia ngay** → vào `/courses/X/community`, nút thành "Đã tham gia" (bấm lại là rời cộng đồng như cũ).
- **Có phí (Y)**: bấm **Tham gia ngay** → hộp thoại "Khóa học có phí" → **Đi tới thanh toán** → `/courses/Y/checkout` (luồng thanh toán sẵn có, không đổi).
- **Riêng tư (Z)**:
  1. Nút hiện **Gửi yêu cầu tham gia** + ghi chú "cần quản trị viên duyệt". Bấm → hộp thoại nhập lời nhắn (tối đa 500 ký tự) → **Gửi yêu cầu**.
  2. Nút đổi thành **Đã gửi yêu cầu – chờ duyệt** (khóa), có link **Hủy yêu cầu**. F5 trang vẫn thấy trạng thái chờ (id yêu cầu được nhớ ở trình duyệt).
  3. Bấm **Hủy yêu cầu** → trở lại nút "Gửi yêu cầu tham gia" (gửi lại được).
  4. Gửi lại rồi đăng nhập A → Cài đặt → Yêu cầu tham gia → **Duyệt** → D tải lại trang: nút "Đã tham gia", vào được cộng đồng. Thử **Từ chối** thay vì duyệt: D bấm "Hủy yêu cầu" sẽ báo đã xử lý và cho gửi lại.
- Trường hợp lỗi: khách chưa đăng nhập bấm tham gia → sang `/login`; người bị cấm (mục 5) bấm tham gia → thông báo đỏ dưới nút ("bị cấm khỏi cộng đồng"); cộng đồng bị khóa (mục 4e) → dải đỏ "đang bị khóa" và thông báo khi bấm tham gia; chủ cộng đồng bấm nút "Đã tham gia" (rời) → báo lỗi owner không rời được.
- Admin+ thấy thêm nút **Cài đặt cộng đồng** ở thẻ giá bên phải.

## 3. Trang lời mời `/invite/:code`
Tạo lời mời ở Cài đặt → Lời mời (mục 4c), sao chép link, mở bằng tài khoản D (cửa sổ ẩn danh).
- Xem trước (không cần đăng nhập): ảnh, tên, số thành viên, công khai/riêng tư, giá, lượt còn lại / hạn dùng.
- Chưa đăng nhập bấm **Đăng nhập để tham gia** → `/login`, sau đó quay lại đúng link.
- Đã đăng nhập bấm **Tham gia** → vào `/courses/:id/community` (lời mời bỏ qua bước duyệt của cộng đồng riêng tư).
- Lỗi cần thử: mã sai → "Không tìm thấy lời mời"; lời mời đã thu hồi / hết hạn / hết lượt → màn hình 410 tương ứng ("Lời mời đã bị thu hồi/hết hạn/hết lượt sử dụng"); cộng đồng có phí → bấm Tham gia hiện "Cộng đồng này có phí…" + link **Đi tới thanh toán**; đã là thành viên → tự chuyển thẳng vào cộng đồng; bị cấm → thông báo đỏ.

## 4. Khu quản trị `/courses/:id/community/cai-dat`
Vào từ nút **Cài đặt** ở thẻ thông tin (tab Thành viên/Giới thiệu) hoặc nút "Cài đặt cộng đồng" ở trang chi tiết. Ẩn với Member/Mod; truy cập thẳng URL bằng Member/Mod/khách → màn hình "Bạn không có quyền truy cập".

**a. Thông tin chung** — sửa tên/mô tả/ảnh/danh mục/ngôn ngữ → Lưu (chỉ gửi trường đã đổi). Owner thấy thêm chọn Công khai/Riêng tư và giá; Admin chỉ thấy chữ, không sửa. Thử: tên 2 ký tự, mô tả trống, không đổi gì rồi Lưu ("Chưa có thay đổi"), đổi giá thành chữ. Sau lưu, trang chi tiết/danh sách phản ánh ngay.

**b. Yêu cầu tham gia** — chip Đang chờ/Đã duyệt/Đã từ chối; mỗi yêu cầu hiện tên, thời gian, lời nhắn. **Duyệt** → người xin thành thành viên (danh sách chuyển sang Đã duyệt); **Từ chối**. Thử duyệt yêu cầu đã bị người xin hủy (danh sách tự làm mới).

**c. Lời mời** — nhập số lượt tối đa (tùy chọn) và hạn (tùy chọn) → **Tạo lời mời**. Danh sách hiện link, trạng thái (Đang hoạt động/Đã thu hồi/Đã hết hạn/Hết lượt), đã dùng x/y. **Sao chép link**, **Thu hồi** (có hỏi xác nhận). Thử: số lượt 0 hoặc 1.5, hạn trong quá khứ → báo lỗi; lời mời 1 lượt: người thứ 2 dùng → 410 hết lượt.

**d. Thành viên bị cấm** — danh sách (tên, lý do, thời điểm) + **Bỏ cấm**; sau bỏ cấm người đó tham gia lại được.

**e. Vùng nguy hiểm** (chỉ Owner/Platform Admin thấy tab)
- *Chuyển quyền chủ*: tìm và chọn thành viên thật (không hiện thành viên minh họa, bản thân) → xác nhận. Kết quả: A thành Admin, người nhận thành Owner (tab này biến mất với A).
- *Xóa cộng đồng*: phải gõ đúng tên cộng đồng mới bật nút; xóa xong về trang chủ, cộng đồng biến khỏi danh sách; thành viên nhận thông báo. Cộng đồng seed: chỉ Platform Admin, người khác nhận lỗi 409.
- *Khóa/Mở khóa* (Platform Admin): nhập lý do (bắt buộc) → Khóa. Cộng đồng ẩn khỏi danh sách, thành viên thường vào khu cộng đồng bị lỗi 403; chi tiết `/courses/:id` hiện dải "đang bị khóa". **Mở khóa cộng đồng** để hoàn tác.

## 5. Quản trị thành viên (tab Thành viên: `/courses/:id/community/thanh-vien`)
Nút "…" ở mỗi hàng mở menu. Cạnh tên có nhãn **Owner / Admin / Mod** (theo `roleDetail`).
- Mọi người: **Xem hồ sơ** (`/users/:id`), **Sao chép @handle**, **Báo cáo thành viên** (không hiện với chính mình) → chọn lý do (spam, quấy rối, không phù hợp, sai lệch, khác) + mô tả tùy chọn → Gửi. Báo cáo lần 2 cùng người → lỗi 409 hiển thị trong hộp thoại.
- Admin+ (chỉ trên người bậc thấp hơn mình; không hiện cho Owner, chính mình, người ngang/cao hơn):
  - **Đặt làm Điều hành viên / Thành viên**: Admin thấy hai lựa chọn này (không thấy "Quản trị viên"); Owner thấy thêm **Đặt làm Quản trị viên**. Đổi xong nhãn cạnh tên cập nhật, người được đổi nhận thông báo.
  - **Xóa khỏi cộng đồng** (xác nhận) và **Cấm thành viên** (nhập lý do, xác nhận) → người đó biến khỏi danh sách; người bị cấm xuất hiện ở Cài đặt → Thành viên bị cấm.
- Đối chiếu ma trận: đăng nhập từng vai trò (Owner A, Admin B, Mod C, Member D) và kiểm tra menu của từng hàng — Mod/Member chỉ có Xem hồ sơ/Sao chép/Báo cáo; Admin không có tùy chọn với Admin khác/Owner; Owner có đủ.
- Thành viên minh họa (id `seed:...`): mọi thao tác quản trị/báo cáo có thể trả 404 → hiện toast đỏ "Đây là thành viên minh họa…", không vỡ giao diện.

## 6. Đánh giá (phần "Đánh giá từ học viên", cuối `/courses/:id`)
- Dữ liệu thật từ `GET /courses/:id/reviews` (5 đánh giá/trang, nút Trước/Sau); điểm trung bình và số lượt lấy từ API (cộng đồng mới bắt đầu 0/0; cộng đồng seed cộng dồn điểm nền minh họa nên số lượt có thể lớn hơn số đánh giá liệt kê).
- Khách/người chưa tham gia: chỉ đọc, thấy dòng "Tham gia cộng đồng để viết đánh giá của bạn".
- Thành viên: chọn 1-5 sao (bắt buộc), nội dung tùy chọn (≤ 1000 ký tự) → **Gửi đánh giá**. Gửi lại = cập nhật (nút đổi thành "Cập nhật đánh giá"); **Xóa đánh giá** của mình có xác nhận. Sau mỗi thao tác điểm trung bình/số lượt cập nhật.
- Mod+ thấy icon thùng rác trên đánh giá người khác → xác nhận → xóa. Member không thấy icon này.
- Lỗi cần thử: gửi không chọn sao (báo "Vui lòng chọn số sao"); nội dung > 1000 (bị chặn ở ô nhập).

## 7. Vai trò của tôi & thẻ thông tin
Thẻ thông tin ở tab Thành viên/Giới thiệu hiện dòng "Vai trò của bạn" theo `viewerRole` của API, số thành viên/trực tuyến/quản trị viên lấy từ API. Nút **Cài đặt** chỉ hiện với Admin trở lên.

## Chưa làm / giới hạn / Thiếu ở BE
- **BE thiếu endpoint "yêu cầu tham gia của tôi"**: FE chỉ nhớ id yêu cầu đang chờ trong `localStorage` (theo trình duyệt). Mất khi xóa dữ liệu trình duyệt/đổi thiết bị; khi đó bấm gửi lại sẽ nhận 409 "đã có yêu cầu chờ duyệt" và không hủy được. Yêu cầu bị Từ chối cũng không được báo cho FE ngoài thông báo hệ thống — trạng thái chờ chỉ mất khi người dùng bấm Hủy (nhận 409) hoặc được duyệt.
- BE không trả `viewerBanned` trong chi tiết cộng đồng nên người bị cấm chỉ biết khi bấm tham gia (403 thông báo).
- BE không trả lý do khóa (`lockReason`) trong chi tiết cộng đồng; thành viên chỉ thấy "đang bị khóa" chung chung.
- Không có `GET` đánh giá của tôi: form đánh giá chỉ tự điền khi đánh giá của mình nằm trong trang đang xem của danh sách.
- `stats.admins` của BE luôn là 1 (cứng); không dùng để đếm quản trị thật.
- Ảnh bìa hiện chỉ nhập URL (upload do nhóm khác).
- Trang `/users/:id` do nhóm khác dựng; nếu chưa có thì link "Xem hồ sơ" sẽ tới trang 404.
- Trang Cài đặt là trang riêng (không nằm trong khung sidebar cộng đồng) để Platform Admin chưa tham gia vẫn vào được.
- Tab "Đánh giá" của trang chi tiết vẫn cuộn xuống phần đánh giá cuối trang như trước (không đổi cấu trúc trang).
