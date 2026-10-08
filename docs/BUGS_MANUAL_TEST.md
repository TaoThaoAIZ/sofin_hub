# Bug từ test thủ công (đợt 1) — nguồn: SofinHub_TestCases.xlsx

Trạng thái: ✅ đã sửa code (chờ tester xác nhận lại) · ⏳ chưa sửa

| # | TC | Vấn đề | Cách sửa | Trạng thái |
|---|----|--------|----------|-----------|
| 1 | TC-HOME-023 | Tìm khóa học chỉ được theo title | `courseTextMatch` (search.repository.ts) chỉ khớp tiêu đề (LIKE không hoa/thường/dấu + gõ sai), bỏ mô tả & tên giảng viên | ✅ |
| 2 | HOME | Điểm đánh giá TB luôn 4/5 | `/meta/stats` tính trung bình có trọng số `Community.rating × ratingCount`; Hero hiển thị 1 số thập phân (4.8/5) | ✅ |
| 3 | HOME | Đổi badge | "Bán chạy"→"Được yêu thích", "Hot"→"Nổi bật" (vi + en) | ✅ |
| 4 | TC-AUTH-030 | Nhiều thiết bị đăng nhập bị "sai quá nhiều lần" | `loginLimiter` đếm theo IP + email (chỉ lần thất bại) thay vì chỉ IP | ✅ |
| 5 | TC-AUTH-041 | Tên >80 ký tự vẫn nhập được | FE `maxLength=80` + BE thông báo max 80 | ✅ |
| 6 | TC-AUTH-042 | Email >180 / mật khẩu >200 vẫn nhập được | FE `maxLength` 180/200 (đăng ký + đăng nhập), BE có message max | ✅ |
| 7 | TC-AUTH-045 | Mật khẩu 'abc' chưa đủ 3 lỗi | BE vốn đã trả đủ 3 (đã kiểm với zod); FE trước chỉ hiện lỗi đầu → nay hiện đủ 3 | ✅ |

Lưu ý: #7 nếu tester gọi thẳng API mà vẫn thiếu thì gửi lại request/response để kiểm.

## Đợt 2 — Quên mật khẩu / Xác thực email / Xóa tài khoản

| TC | Nguyên nhân | Cách sửa | Trạng thái |
|----|-------------|----------|-----------|
| AUTH-102..105, 121..129 | `.env` chưa cấu hình SMTP/Brevo → thư chỉ nằm trong outbox RAM (`GET /api/dev/outbox`), không tới Gmail. Logic BE (cooldown 60s, TTL 30'/24h, token không lộ, trim+lowercase, 409/401/400) đã đúng. | Thêm hướng dẫn SMTP Gmail (App Password)/Brevo vào `backend/.env.example`. **Cần bạn điền SMTP_* vào `backend/.env` rồi restart BE**; khi bật SMTP thì outbox sẽ trống (thư đã gửi thật). | ⏳ chờ cấu hình env + test lại |
| AUTH-130 | Chưa chặn user chưa xác thực email | Middleware `requireVerifiedEmail` (403 `EMAIL_NOT_VERIFIED`) cho: đăng bài, bình luận, checkout, dùng thử | ✅ |
| AUTH-143 | Thiếu hướng dẫn chuyển quyền | 409 message đúng mẫu + đường dẫn; FE thêm `BlockersGuide` (các bước + link tới Cài đặt cộng đồng › Vùng nguy hiểm `?tab=danger`, link Thanh toán) ở thẻ Xóa tài khoản và modal xóa | ✅ |

## Đợt 3 — sheet COMM (Cộng đồng)

| TC | Nguyên nhân / phát hiện | Cách sửa | Trạng thái |
|----|-------------------------|----------|-----------|
| COMM-044 | Wizard tạo cộng đồng không có ô chọn ngôn ngữ (chỉ có riêng tư/công khai) | Thêm chọn ngôn ngữ (vi/en) ở bước Thành viên của wizard: `wizard.schema` (members.language), `wizard.service` (đọc/ghi), FE form/mapping/StepMembers + i18n | ✅ |
| COMM-062 | Cài đặt cộng đồng chỉ có ô nhập URL ảnh bìa, không có nút tải ảnh | `GeneralTab` dùng `CoverField` (bấm để upload `purpose: cover` hoặc dán URL) | ✅ |
| COMM-036, 038 | Test case viết cho `POST /api/communities` (tên ≤80, slug ≤50) nhưng tester làm qua UI wizard, nơi tên bị giới hạn 30 ký tự & slug ≤40 (đúng thiết kế mockup, đã ghi ở mục 29 báo cáo). API một phát vẫn nhận 80/81 đúng. | Đã nâng giới hạn tên wizard lên 80 (BE schema, FE maxLength/bộ đếm/validate, i18n, test); slug wizard vẫn ≤40 nên thỏa yêu cầu ≤50 | ✅ |
| COMM-061, 064, 069–076, 078, 081, 101–117…, 118–161, 163–232 | Là case ở mức API (PATCH/DELETE/lock/invite/role…). Đã đối chiếu code: endpoint, mã lỗi và thông điệp (COMMUNITY_LOCKED, INVITE_EXHAUSTED, 'Cộng đồng đã bị xóa', 'Cộng đồng bị khóa'…) đều có. Chưa chạy được (DB/Docker local đang tắt). | Cần ghi chú lỗi thực tế của tester (request/response) cho từng case để sửa đúng chỗ | ⏳ chờ chi tiết |

## Đợt 4 — COMM theo ghi chú tester

| TC | Vấn đề | Xử lý | Trạng thái |
|----|--------|-------|-----------|
| COMM-062 | Không có nút tải ảnh | Đã có từ đợt 3 (`CoverField` ở Cài đặt cộng đồng › Chung) | ✅ |
| COMM-078 | Thiếu nút rời cộng đồng (nút Tham gia ẩn khi đã tham gia nên không toggle được) | Thêm nút "Rời khỏi cộng đồng" ở trang chi tiết (ẩn với chủ cộng đồng), toast sau khi rời; có xác nhận nếu cộng đồng có phí | ✅ |
| COMM-081 | Gửi yêu cầu tham gia không có toast | Toast "Đã gửi yêu cầu tham gia thành công…" | ✅ |
| COMM-127 | UI cho đổi vai trò thành viên minh họa (BE trả 404) | Ẩn menu quản trị với thành viên id `demo-*` | ✅ |
| COMM-101 | "Lời mời đang lỗi" — API tạo/liệt kê/xem trước/nhận lời mời đều chạy đúng khi thử trực tiếp | Chỉ sửa thông báo lỗi `maxUses` sang tiếng Việt; cần mô tả lỗi cụ thể | ⏳ chờ chi tiết |
| COMM-163, 170, 171 | Ghi chú mô tả đúng hành vi mong đợi (403/401/403). Đã kiểm bằng API: 163→403 'Bạn cần tham gia cộng đồng này trước'; 170→401; 171→403 | Không phải bug — đánh dấu Pass | ✅ (không cần sửa) |

## Đợt 5 — COURSE (Lớp học)

| TC | Vấn đề | Xử lý | Trạng thái |
|----|--------|-------|-----------|
| COURSE-021, 066 | Module/bài đang khóa chỉ hiện ổ khóa | Cộng đồng có phí (hoặc module bán riêng): overlay + nút "Mua để mở khóa" và nút ở thẻ/ổ khóa bài học dẫn tới `/communities/:id/checkout`. Mod trở lên không bị ảnh hưởng | ✅ |
| COURSE-030 | Phân trang 10 module/trang | 9 module/trang, lưới 3 cột (3 hàng) rồi phân trang. **Test case cũ ghi 10/trang → cần cập nhật** | ✅ |
| COURSE-034 | Bấm nút mũi tên module, chi tiết hiện ở cuối trang | Bấm nút mũi tên → sang trang chi tiết module `/communities/:id/community/lop-hoc/module/:moduleId` (thông tin, tiến độ, danh sách bài); bấm từng bài mới vào trang học. Module khóa không có quyền xem thử thì nút bị vô hiệu | ✅ |
| COURSE-040, 041 | Chưa tải video từ máy | Soạn bài: nút "Tải video từ máy lên (mp4, ≤25MB)" (purpose lesson_attachment). BE nhận `/api/files/<key>.mp4` (không có embedUrl); trang học phát bằng `<video>` qua URL ký. Link YouTube/Vimeo giữ nguyên. Lưu ý: chưa hỗ trợ Range nên tua có thể bị hạn chế | ✅ |
| COURSE-043 | Chưa có tải tệp đính kèm | Tải tệp đính kèm giờ có ở MỌI loại bài (trước chỉ loại "Tài liệu") | ✅ |

## Đợt 6 — COURSE (tạo khóa/module/bài, xóa, rời cộng đồng)

| TC | Nguyên nhân / xử lý | Trạng thái |
|----|---------------------|-----------|
| Bug chặn (ảnh 1+2): đã nhập nội dung vẫn "Chưa có nội dung", không xuất bản được | `lessonHasContent` bắt bài viết ≥ 30 ký tự (FE). Đổi thành có nội dung (khác rỗng); bỏ chữ "tối thiểu 30 ký tự" ở placeholder. Gỡ chặn tạo module/bài → mở được các case 071, 073, 079, 081, 082, 083, 102, 103, 104 (đây là các case tạo/sửa module-bài, đã có validate ở BE: requiredLevel 1–9, tối đa 20 tệp, chặn javascript:/data:, body ≤ 50000) — cần chạy lại | ✅ (chờ test lại) |
| COURSE-094 | Trang chi tiết module (mod+): thêm nút xóa từng bài + nút "Xóa module", đều có hộp xác nhận nêu hậu quả và toast. (Trước đó chỉ có ở chế độ chỉnh sửa lớp học và dấu ✕ trong trình tạo) | ✅ |
| COURSE-099 | Kiểm bằng API: member2 vào `/courses/yt/modules`, `/lessons/les-yt-1-1`, `/progress` đều 403 'Bạn cần tham gia cộng đồng này trước' (đúng mong đợi). Nếu tester vẫn xem được: kiểm member2 có đã tham gia yt chưa, gửi URL + response | ⏳ cần chi tiết |
| COURSE-100 | Tester: case nên là "bài/module bắt buộc trả phí (premium) mới xem được" chứ không phải khóa cộng đồng. Hành vi này đã có: module bán riêng/cộng đồng có phí bị khóa, hiện nút "Mua để mở khóa" → checkout (đợt 5). **Cần viết lại test case** | ✅ (đổi test case) |
| COURSE-109 | Nút "Rời khỏi cộng đồng" đã thêm ở đợt 4 (trang chi tiết cộng đồng, ẩn với owner) | ✅ |

### Đợt 6b — chỉnh lại
- Bài viết < 30 ký tự: KHÔNG cho lưu, hiện lỗi inline dưới ô nhập (viền đỏ, "cần tối thiểu 30 ký tự, hiện có N") + bộ đếm; điều kiện xuất bản vẫn ≥ 30 (khôi phục). Sửa ở `LessonEditor.tsx`.
- COURSE-094: nút xóa chỉ hiện với mod trở lên; BE chốt quyền ở `manage()` (mod+) nên member gọi API xóa bài/module nhận 403.
