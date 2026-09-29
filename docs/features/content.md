# Nội dung cộng đồng: Bảng tin, Lịch, Lớp học, Kiểm duyệt (nhóm FE-content)

Kịch bản test thủ công. Mọi đường dẫn nằm dưới `/courses/:id/community` (`:id` = id khóa học/cộng đồng).

## Điều kiện tiên quyết chung

Cần ít nhất 3 tài khoản để test đủ phân quyền, cùng tham gia MỘT cộng đồng:

| Ký hiệu | Vai trò trong cộng đồng | Cách có |
|---|---|---|
| **Owner** | owner | Tạo cộng đồng bằng "Tạo cộng đồng" (`/communities/new`) — người tạo là Owner. (Tài khoản seed: xem docs nhóm khác, sẽ cập nhật sau.) |
| **Mod** | mod | Owner/Admin đặt vai trò "mod" cho một thành viên (Thành viên / Cài đặt cộng đồng). |
| **Member A / Member B** | member | Tham gia cộng đồng bình thường. Member A là tác giả các bài test; Member B là người khác. |
| **Platform Admin** | platform_admin | Email nằm trong `PLATFORM_ADMIN_EMAILS` của backend. |

Lưu ý: Dữ liệu nằm trong **Postgres thật** (không mất khi restart). Chuẩn bị: bật Docker, `cd backend && npm run db:up && npm run db:deploy && npm run db:seed`, rồi chạy BE/FE. Muốn về trạng thái sạch ban đầu: `npm run db:reset` (xóa toàn bộ và seed lại). Cộng đồng seed có bài/sự kiện/module do THÀNH VIÊN MINH HỌA (`isDemo`) viết — không đăng nhập được nên không sửa/xóa theo quyền tác giả và không báo cáo/cấm được họ; muốn thử sửa/xóa bài dùng bài của member1 ở `photo` (`seed-post-photo-m1-*`).

Mọi thao tác thành công đều có toast (dưới màn hình), lỗi hiện chữ đỏ ngay trong hộp thoại/khối.

---

## A. Bảng tin (`/courses/:id/community`)

### A1. Đăng bài chữ
- Ai: mọi thành viên. Các bước: gõ nội dung → chọn chuyên mục ở ô select → "Đăng bài".
- Mong đợi: bài xuất hiện đầu bảng tin, toast "Đã đăng bài viết", ô soạn được xóa.
- Lỗi: để trống → nút "Đăng bài" bị khóa; quá 4000 ký tự → báo đỏ "Nội dung quá dài" và khóa nút.

### A2. Gắn thẻ
- Bấm "Gắn thẻ" → gõ thẻ + Enter (bỏ `#` tự động, tối đa 5 thẻ, 30 ký tự). Dưới ô có "Gợi ý" lấy từ `GET /courses/:id/tags` (bấm để thêm).
- Sau khi đăng: bài hiện các chip `#thẻ`. Bấm chip → URL thêm `?tag=...`, bảng tin chỉ hiện bài có thẻ đó, có chip "Đang lọc theo thẻ #x" — bấm ✕ để bỏ lọc.
- Lỗi thử: thêm thẻ thứ 6 → báo "Tối đa 5 thẻ".

### A3. Ảnh
- Bấm "Ảnh" → chọn JPG/PNG/WEBP/GIF ≤ 5MB → thấy xem trước, nút ✕ để bỏ → đăng → bài hiện ảnh.
- Lỗi thử: chọn file PDF hoặc ảnh > 5MB → báo lỗi tiếng Việt (do `useUpload`), không đăng ảnh.

### A4. File đính kèm
- Bấm "File đính kèm" → chọn PDF/ZIP/DOCX/XLSX/PPTX/TXT/MP4 ≤ 25MB → hiện trong danh sách, ✕ để bỏ.
- Giới hạn: API bài viết KHÔNG có trường tệp riêng, nên FE chèn dòng `Tệp đính kèm: tên — URL` vào cuối nội dung (tính vào giới hạn 4000 ký tự). Link tải được khi bấm ra tab mới.

### A5. Poll / Bình chọn
- Bấm "Poll/Bình chọn" → (tùy chọn) câu hỏi, 2–6 lựa chọn ("Thêm lựa chọn", thùng rác để xóa), tích "Cho chọn nhiều", chọn "Đóng lúc".
- Đăng: bài hiện các thanh lựa chọn. Chọn 1 (hoặc nhiều nếu cho phép) → "Bình chọn" → thanh % và số phiếu cập nhật; nút đổi thành "Đổi lựa chọn" (bình chọn lại ghi đè phiếu cũ đến khi đóng).
- Poll đã đóng (quá hạn `closesAt`): nhãn "Đã đóng", các lựa chọn không bấm được, không có nút bình chọn.
- Lỗi thử: chỉ điền 1 lựa chọn → nút Đăng khóa + ghi chú; đặt "Đóng lúc" ở quá khứ → báo "Hạn đóng bình chọn phải ở tương lai"; poll đóng nhưng cố bình chọn (đợi hết hạn rồi bấm khi chưa reload) → API 409 hiện lỗi.

### A6. Thẻ bài viết
- Tên tác giả là link tới `/users/:id`. Ngày giờ, chuyên mục, nhãn "Đã ghim" (nếu ghim).
- Sau khi sửa bài: hiện "(đã chỉnh sửa)" cạnh ngày.
- Like, đếm bình luận như cũ.

### A7. Chia sẻ
- Bấm "Chia sẻ" → toast "Đã sao chép liên kết bài viết". Dán ra tab khác: dạng `http://.../courses/:id/community?post=:postId`.
- Mở link đó (đã đăng nhập, là thành viên): trang cuộn tới bài và làm nổi viền cam. Nếu bài không nằm trong trang đầu, hiện khối "Bài viết được chia sẻ với bạn" ở đầu (tải bằng `GET /posts/:id`), nút "Đóng" bỏ tham số. Bài đã xóa/ẩn (với người thường) → báo "Không mở được bài viết này…".

### A8. Menu "…" trên bài
| Mục | Ai thấy | Hành vi |
|---|---|---|
| Sửa bài viết | tác giả, mod+ | Sửa tại chỗ nội dung, chuyên mục, thẻ (cách nhau dấu phẩy) → Lưu → "(đã chỉnh sửa)". Ảnh/poll không sửa được (BE không hỗ trợ). |
| Ghim / Bỏ ghim | mod+ | Toggle, nhãn "Đã ghim". |
| Ẩn / Hiện bài viết | mod+ | Bài ẩn: mod và tác giả vẫn thấy với nhãn "Đã ẩn" (mờ), Member B KHÔNG còn thấy trong danh sách. |
| Xóa bài viết | tác giả, mod+ | Hộp thoại xác nhận → xóa cả bình luận/like/phiếu. |
| Báo cáo | mọi người TRỪ tác giả | Hộp thoại chọn lý do (spam / quấy rối / không phù hợp / sai lệch / khác) + chi tiết → toast. Báo cáo lần 2 cùng bài → lỗi 409 "đã báo cáo". |

Kiểm tra phân quyền: đăng nhập Member B → menu KHÔNG có Sửa/Xóa/Ghim/Ẩn trên bài của A, có Báo cáo. Đăng nhập A → trên bài của mình có Sửa/Xóa nhưng KHÔNG có Báo cáo/Ghim/Ẩn. Mod/Owner thấy tất cả (kể cả Báo cáo trên bài của người khác).

### A9. Bình luận
- Bấm biểu tượng bình luận để mở. Mỗi bình luận: "Sửa" (chỉ của mình; hiện "(đã chỉnh sửa)"), "Xóa" (của mình, hoặc mod+ xóa của người khác; có xác nhận), "Báo cáo" (bình luận của người khác).
- Lỗi thử: bình luận trống → nút Gửi khóa; Member B không thấy "Sửa"/"Xóa" trên bình luận của A.

### A10. Tải thêm
- Mỗi lần tải 10 bài. Nút "Tải thêm bài viết (đã hiện/tổng)" ở cuối; hết trang thì nút biến mất. Đổi bộ lọc chuyên mục/thịnh hành sẽ tải lại từ trang 1.
- "Tìm bài viết yêu thích" (banner chào) vẫn chuyển sang sắp xếp phổ biến.

---

## B. Lịch sự kiện (`/lich`)

- Xem lịch tháng/tuần/ngày như cũ; sự kiện đã qua hiển thị mờ.
- **Đăng ký lịch cả cộng đồng** (mọi thành viên): nút trên thanh công cụ → tải `lich-cong-dong-<id>.ics` (kèm token, không mở tab mới). Nhập vào Google/Apple Calendar để kiểm tra.
- **Tạo sự kiện** (mod+ — Member không thấy nút): tên, thời gian, link họp, sức chứa (để trống = không giới hạn), mô tả → "Tạo sự kiện". Lỗi: link họp không phải URL → lỗi từ API; sức chứa 0/âm → chặn.
- **Hộp thoại chi tiết** (bấm sự kiện):
  - Đăng ký tham gia → nút đổi "Đã đăng ký — bấm để hủy"; bấm lần nữa hủy (dùng `DELETE /events/:id/rsvp`).
  - Đủ chỗ (rsvp = sức chứa) và bạn chưa đăng ký → nhãn đỏ "Đã đầy chỗ" và nút khóa. Nếu bị đầy giữa chừng, lỗi 409 hiện đỏ dưới nút.
  - Sự kiện đã qua: nhãn "Đã diễn ra", không đăng ký được.
  - "Thêm vào lịch (.ics)": tải file 1 sự kiện.
  - mod+ có thêm "Sửa" (form: tên, thời gian, link — để trống là xóa, sức chứa — để trống là bỏ giới hạn, mô tả) và "Xóa" (xác nhận; người đã đăng ký được báo). Lỗi thử: đặt sức chứa nhỏ hơn số người đã đăng ký → 409 hiện trong form.
  - Member không thấy Sửa/Xóa.

---

## C. Lớp học (`/lop-hoc`)

### C1. Đầu trang: tiến độ, Tiếp tục học, Chứng nhận
- Thanh "Tiến độ khóa học" (`GET /courses/:id/progress`): % , số bài, số module.
- "Tiếp tục học" (khi còn bài chưa xong, đi tới `nextLesson`).
- "Nhận chứng nhận": chỉ hiện khi tiến độ 100% VÀ cộng đồng bật chứng nhận; chưa bật thì có ghi chú "Cộng đồng chưa bật chứng nhận". Bấm → thẻ chứng nhận (tên, khóa học, ngày cấp, mã) + "Sao chép link xác minh" + "In".
- Lỗi thử: học chưa đủ 100% → không thấy nút. (Nếu mod thêm bài mới sau khi được cấp, API trả 403 tới khi học lại — toast lỗi.)

### C2. Thẻ module
- Ảnh bìa là `thumbnail` của module nếu có, không thì ảnh mặc định theo thứ tự.
- Module khóa: lớp phủ ghi "Hoàn thành module trước" (khóa theo module trước) hoặc "Cần đạt Cấp độ N" (khóa theo cấp độ); nút mở bị khóa. Mod+ không bao giờ bị khóa.
- Mở module (mũi tên) → danh sách bài: dấu tích tròn để đánh dấu hoàn thành/bỏ; bấm tên bài hoặc nút play để vào trang học.

### C3. Trang học `/lop-hoc/:lessonId`
- Video: iframe YouTube/Vimeo (chỉ host được BE cho phép, `sandbox` + `referrerpolicy`). Bài văn bản: hiện nội dung. Tệp đính kèm: danh sách link tải.
- "Hoàn thành / Bỏ hoàn thành", "Bài trước / Bài sau" (có thể sang module khác), thanh tiến độ khóa, danh sách bài của module ở cột phải.
- Lỗi thử: dán URL của một bài thuộc module đang khóa (bằng tài khoản Member) → màn "Module này đang bị khóa" (403 `MODULE_LOCKED`); id bài không tồn tại → "Không mở được bài học".

### C4. Xác minh chứng nhận công khai `/certificates/:code`
- Không cần đăng nhập (mở bằng cửa sổ ẩn danh): hợp lệ → thẻ chứng nhận + "Chứng nhận hợp lệ"; mã sai → "Không tìm thấy chứng nhận".

### C5. Chế độ "Chỉnh sửa lớp học" (mod+; Member không thấy nút)
- **Module**: Thêm/Sửa (tên, mô tả, ảnh bìa URL hoặc "Tải ảnh", cấp độ yêu cầu 1–9 hoặc không), Xóa (xác nhận — xóa luôn bài học & tiến độ), lên/xuống để đổi thứ tự.
- **Bài học** (mở module bằng mũi tên trong trình soạn): Thêm/Sửa (tiêu đề, loại video/bài đọc/tệp, thời lượng 0–1000, nội dung, link YouTube/Vimeo, tệp đính kèm bằng upload hoặc URL+tên, tối đa 20), Xóa, lên/xuống.
- **Bật/tắt chứng nhận**: hộp tích "Cấp chứng nhận khi hoàn thành 100%" — CHỈ admin/owner/platform admin thấy.
- Lỗi thử: link video không phải YouTube/Vimeo → lỗi từ API; thumbnail không phải http(s) → lỗi; Mod thử bật chứng nhận → không thấy điều khiển (nếu gọi thẳng API thì 403).

---

## D. Kiểm duyệt

### D1. Cộng đồng `/kiem-duyet` (mod+)
- Mục "Kiểm duyệt" trong sidebar chỉ hiện với mod trở lên. Member gõ tay URL → thông báo "Chỉ dành cho quản trị viên".
- Chuẩn bị: Member B báo cáo một bài, một bình luận của A (mục A8/A9).
- Hàng đợi có tab Đang chờ / Đã xử lý / Đã bỏ qua / Tất cả, phân trang. Mỗi báo cáo: loại, lý do, nội dung ảnh chụp lúc báo cáo, đối tượng, người báo cáo, link "Xem bài viết" (mở `?post=`).
- Xử lý (ghi chú tùy chọn): **Bỏ qua** → chuyển "Đã bỏ qua"; **Ẩn nội dung** → bài/bình luận ẩn (kiểm tra bên Member B thấy biến mất), chuyển "Đã xử lý"; **Cấm thành viên** → hộp xác nhận → thành viên bị xóa khỏi cộng đồng.
- Người báo cáo nhận thông báo `report_resolved`.
- Lỗi thử: Mod cấm Mod khác/Admin/Owner → 403 (báo cáo giữ nguyên "Đang chờ"); cấm tác giả nội dung seed → 400; xử lý báo cáo đã xử lý (mở 2 tab) → 409; "Ẩn nội dung" trên báo cáo thành viên → nút không có.

### D2. Nền tảng `/admin/reports` (Platform Admin)
- Cùng giao diện hàng đợi nhưng gồm báo cáo của mọi cộng đồng (hiện tên cộng đồng). Người không phải Platform Admin thấy lỗi 403 "không có quyền". Chưa có mục điều hướng — nhóm FE-platform sẽ gom vào menu admin; hiện vào bằng URL.

---

## Chưa làm / giới hạn / Thiếu ở BE

- **Tệp đính kèm bài viết**: BE chỉ có `imageUrl` (1 ảnh), không có trường tệp → FE chèn liên kết vào nội dung. Ảnh không sửa/thay được sau khi đăng; poll không sửa được.
- **Video trong bài viết** ("Ảnh/Video" trong thiết kế): chỉ ảnh, vì `imageUrl` là ảnh.
- **URL tuyệt đối**: BE yêu cầu `imageUrl`, `thumbnail`, `attachments[].url` là URL http(s) đầy đủ; `useUpload` trả đường dẫn tương đối `/api/files/...` nên FE ghép `window.location.origin`/origin API (`absoluteUrl`). Nếu FE và API khác domain khi lên production cần đảm bảo `VITE_API_URL` tuyệt đối.
- **Báo cáo thành viên** (`POST /courses/:id/members/:userId/report`) chưa có nút trên UI (thuộc tab Thành viên, nhóm khác).
- **Báo cáo bình luận** không có link tới bài chứa bình luận (báo cáo không trả `postId`).
- Danh sách báo cáo không trả id bài của bình luận, nên "Xem bài viết" chỉ có cho báo cáo bài.
- Xóa sự kiện không gửi `METHOD:CANCEL` cho lịch iCal đã nhập; `.ics` không có giờ kết thúc (mặc định +1 giờ); múi giờ sự kiện đang cố định `Asia/Ho_Chi_Minh` khi tạo.
- Chứng nhận chỉ là bản ghi (thẻ hiển thị trong app + trang xác minh), chưa xuất PDF/ảnh — nút "In" dùng in của trình duyệt.
- Sắp xếp lại module/bài học bằng nút lên/xuống (không kéo-thả).
- Người dùng chưa có điều hướng tới `/admin/reports` từ menu.
