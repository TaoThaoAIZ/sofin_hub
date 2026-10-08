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

## Đợt 7 — FEED (Bảng tin)

| TC | Vấn đề (ghi chú tester) | Xử lý | Trạng thái |
|----|-------------------------|-------|-----------|
| FEED-003 | Tải video lên nhưng không phát được trên bảng tin (tệp chỉ được chèn dạng dòng chữ "Tệp đính kèm: tên — url" cuối nội dung) | `PostCard` tách các dòng đính kèm: mp4 → `<video controls>` (URL ký), tệp khác → nút tải; không còn hiện chuỗi URL thô | ✅ |
| FEED-003, 086 | Bình luận mới nhất phải hiện trên cùng | FE: ô nhập bình luận đặt trên đầu, danh sách đảo ngược (mới nhất trước). API vẫn trả tăng dần nên **TC-FEED-086 (thứ tự API) giữ nguyên**, chỉ thêm kiểm UI | ✅ |
| FEED-021 | Ảnh bài viết hiển thị nhỏ/bị cắt | Ảnh bài viết + xem trước trong ô soạn: `object-contain` (đủ khung hình, cao tối đa 560px) | ✅ |
| FEED-021 | "Chưa hiển thị lên trên cùng" | Chưa rõ: bài mới / toast? BE xếp ghim trước rồi mới nhất; cần tester nói rõ | ⏳ cần chi tiết |
| FEED-095, 096 | Like/unlike không đổi màu | Nút like: đã like = nền cam đặc + chữ/icon trắng, chưa like = nền xám (trước chỉ khác độ trong suốt 10% vs 20% nên không thấy) + `aria-pressed` | ✅ |
| FEED-093 | Không ghi chú. API: newbie PATCH và banned DELETE → 403 đúng; không token → 401 đúng; **Platform Admin (chưa ghi danh) DELETE → 200** (đúng thiết kế: Platform Admin được bỏ qua kiểm ghi danh, như COMM-074) | **Sửa test case**: bước 3 mong đợi 200 (admin nền tảng), không phải 403. Lưu ý case này xóa bình luận seed → chạy `db:seed` để khôi phục | ✅ (đổi test case) |
| FEED-115 | Không ghi chú. `GET /posts/seed-post-photo-3` OK; FE có khối "Bài viết được chia sẻ với bạn" khi bài ngoài trang đầu | Cần tester mô tả hiện tượng (cuộn/viền cam/khối chia sẻ) | ⏳ cần chi tiết |

## Đợt 8 — MEMBER / EVENT / NOTI + tách tin nhắn khỏi chuông

| TC | Vấn đề | Xử lý | Trạng thái |
|----|--------|-------|-----------|
| MEMBER-038 | Bảng xếp hạng 7 ngày rỗng: điểm seed gắn mốc thời gian lúc seed (1–5 ngày trước) và `skipDuplicates` không làm mới → vài ngày sau cửa sổ 7d hết dữ liệu | `seed/points.ts` xóa-rồi-tạo lại mỗi lần `db:seed` (mốc luôn tươi). Kiểm: 7d → hạng 1 = 35 điểm, các hạng sau 13… | ✅ (tester chạy `db:seed` trước khi test) |
| MEMBER-039 | 30d trả đúng: member1 65, member2 30. Hạng 3 là Trí Xuân/Tai Do (27) — test case ghi "Đoàn Thành" → sửa tên trong test case nếu cần | Không lỗi code | ✅ |
| EVENT-076 | Đổi nút "Thêm vào lịch (.ics)" thành "Tải lịch xuống (.ics)" | i18n vi/en. **Sửa tiêu đề test case theo nhãn mới** | ✅ |
| EVENT-087 | Không ghi chú. BE gắn link `/courses/<id>/community/lich` (FE chuyển hướng sang route chuẩn) | Cần tester mô tả nếu vẫn lỗi | ⏳ |
| NOTI-006 | Email xác nhận không tới Gmail | Chưa cấu hình SMTP trong `backend/.env` (xem đợt 2). Khi lên AWS dùng SES/SMTP | ⏳ chờ cấu hình |
| NOTI-036, 108, 115 | Ghi chú của tester chính là kết quả mong đợi. Kiểm API: 036 → 404 'Không tìm thấy thông báo'; 108 → 404 / 400; 115 → 404 'Không tìm thấy tin nhắn' — đúng | Không phải bug → Pass | ✅ |
| NOTI-101 + header | Tin nhắn báo vào chuông thông báo | Tách riêng: chuông (list/unread-count/đánh dấu đã đọc/SSE) bỏ loại `message_received`; icon Tin nhắn có bộ đếm riêng (`/messages/unread-count`). Email "tin nhắn chưa đọc" vẫn theo tùy chọn. Test `notifications-settings` cập nhật | ✅ |
| NOTI-156 | Đổi icon thu hồi; thêm icon xóa cuộc trò chuyện | Icon thu hồi `cancel_schedule_send`; nút thùng rác ở đầu khung chat → `DELETE /conversations/:id` (xóa phía mình: cột `clearedSeqA/B`, migration `20261011100000_conversation_clear`; người kia vẫn giữ, tin mới sau đó hiện lại) | ✅ |

## Đợt 9 — Form tạo module/bài học (wizard)
- Trường bắt buộc có dấu `*` đỏ (tên module, mô tả module, tên bài học, nội dung bài viết, tên khóa học); có dòng chú thích "* Trường bắt buộc".
- Nút "Tạo & thêm nội dung" / "Lưu & tiếp tục" chỉ bật khi đủ: tên + mô tả (+ giá > 0 nếu trả phí). Nút lưu bài học chỉ bật khi có tên, thời lượng hợp lệ và (bài viết) ≥ 30 ký tự — lỗi inline hiện ngay khi gõ chưa đủ.
- Quay lại: thanh bước (Thông tin / Nội dung / Xuất bản) bấm được để về bước đã qua; ở màn "Hoàn tất" có nút "← Quay lại chỉnh sửa"; bước Xuất bản vẫn có "← Quay lại".

## Đợt 10 — Avatar header + mất lịch sử chat
- Avatar trên header (và Cài đặt › Hồ sơ, xem trước hồ sơ, Giới thiệu) bị ảnh vỡ sau khi tải ảnh mới: `avatarUrl` lưu dạng `/api/files/<key>` (tương đối) nhưng `<img>` dùng thẳng → khi FE và API khác origin (`VITE_API_URL` tuyệt đối) trình duyệt tìm ảnh ở domain FE. Đã bọc `resolveApiPath()` ở 4 chỗ. ✅
- Mất chat hôm qua: DB local KHÔNG mất dữ liệu do mình (seed không xóa tin nhắn, test chạy ở schema riêng). Trong DB local chỉ có 9 tin, tin thật cuối cùng 30/09, không có user "Linh" → ảnh chụp đến từ môi trường khác. ⏳ cần biết môi trường (xem câu hỏi gửi user).

## Đợt 11 — SEARCH / SETS / SETC

**Kiểm tự động (backend)**: `search`, `perf-sql`, `account-settings`, `my-communities`, `auth-extra` → 74/74 pass sau khi sửa 2 test cũ (tìm khóa học giờ chỉ theo TIÊU ĐỀ — xem đợt 1; test cũ còn kỳ vọng khớp mô tả/tên giảng viên). Các case API chưa test của 3 sheet (SEARCH 001–018/026–027/033–034/044, SETS 051–086, SETC 031–043) được các test này phủ.

| TC | Kết quả kiểm | Xử lý |
|----|--------------|-------|
| SEARCH-022, 023, 024, 025 | Gọi API đúng như mong đợi: newbie → counts.posts/members = 0; member2 tìm bài yt → 0, member1 → 1 bài; courseId=photo chỉ trả photo; courseId=yt bằng member2 → 403 'Bạn cần tham gia cộng đồng này trước'. Ghi chú tester "vẫn thấy cộng đồng chưa tham gia" là **khóa học công khai** (loại `course`) — đúng thiết kế (case chỉ yêu cầu bài viết/thành viên bị giới hạn) | Không phải bug. Test case 022/023 nên ghi rõ "kết quả loại khóa học công khai vẫn hiện" |
| SEARCH-032 | Suggest trả 5 mục xen kẽ course, member, post, course, member — đúng. Ghi chú "trả kết quả title" chưa rõ | ⏳ cần tester mô tả |
| SETS-007/008/009 | Code khớp mong đợi (tiêu đề, mô tả, placeholder `ten@email.com`, CTA, Esc/Hủy/bấm nền, 3 thông báo lỗi client, không gọi API). Không ghi chú lỗi. Nghi tester đang test bản **deploy cũ** (link vercel trong SETC-025) hoặc môi trường chưa cấu hình SMTP (007 cần thư) | ⏳ cần build mới + mô tả lỗi |
| SETC-013, 014 | **Bug thật**: kéo một hàng XUỐNG 1 vị trí không đổi gì (chèn trước hàng đích). Sửa: kéo xuống → chèn sau hàng đích; kéo lên → chèn trước; tính trên toàn bộ danh sách khi đang lọc; ghim vẫn đứng đầu | ✅ |
| SETC-025 | Test case mô tả đúng hiện trạng: lời mời là mã/link chung (không có người nhận) nên hộp thư lời mời theo user chưa tồn tại → cần bảng mời theo user/email | ⏳ cần quyết định có làm không |
| SETS-042 | Test case lỗi thời: ngôn ngữ đã có i18n và đổi ngay; **giao diện Sáng/Tối chỉ lưu, chưa áp dụng** (chưa có dark mode) | Cập nhật test case; dark mode chưa làm |

## Đợt 12 — Khóa module
- Ổ khóa + lớp phủ tối chỉ còn ở module **premium** (lockReason `paid`); module khóa vì thứ tự/cấp độ/danh sách chọn hiện ảnh bình thường + nhãn chữ nhỏ ở góc (vd. "Cần đạt Cấp độ 3").
- Module khóa không còn vào được từ thẻ (trước đây `hasPreview` cho lọt): premium/cộng đồng có phí → nút dẫn tới thanh toán; loại khác → nút mũi tên bị vô hiệu. Trang chi tiết module khóa (mở bằng URL) chỉ hiện lý do + nút mua, không liệt kê bài. Mod trở lên không bị ảnh hưởng.
- Lưu ý: BE vẫn cho đọc **bài xem thử miễn phí** (isPreview) của module khóa nếu biết URL bài — đúng tính năng "xem thử"; muốn chặn hẳn cần quyết định riêng.

## Đợt 13 — SETP (Hồ sơ)
| TC | Kết quả kiểm | Xử lý |
|----|--------------|-------|
| SETP-005, 025 "chưa tải được ảnh" | Upload avatar chạy đúng ở local (presign → PUT → fileUrl 200). Lỗi nằm ở môi trường tester (server deploy: CORS_ORIGIN, ổ đĩa) hoặc bản deploy cũ. Đã sửa riêng lỗi ảnh vỡ ở đợt 10 | ⏳ kiểm môi trường |
| SETP-012 | Code hiện KHÔNG còn thẻ quảng bá ở tab Thông báo → tester đang xem bản cũ | Không cần sửa |
| SETP-017 | `/me/communities` → `/settings/cong-dong` (tab "Cộng đồng của tôi") đúng mong đợi; đây là tab trong Cài đặt, không phải "Cài đặt cộng đồng" | Không phải bug |
| SETP-024 | Avatar mặc định (chip chữ cái) nền xanh khác header (cam) | Đổi sang nền gradient cam như header (ProfileTab + ProfilePreview) ✅ |
| SETP-061 | Chưa có ảnh bìa hồ sơ | Thêm cột `User.coverUrl` (migration 20261012100000), PATCH /auth/me nhận `coverUrl` (URL http/https hoặc /api/files/…, chặn javascript:), nút "Đổi ảnh bìa / Xóa ảnh bìa" ở tab Hồ sơ, hiển thị ở thẻ xem trước và trang hồ sơ công khai ✅ |
| SETP-067 | Rời tab Hồ sơ khi còn thay đổi chưa lưu | Hỏi xác nhận khi bấm menu bên Cài đặt + cảnh báo khi tải lại/đóng tab ✅ (test case cần đổi: nay CÓ cảnh báo) |
| SETP-057 | Toast "Đường dẫn hồ sơ này đã có người dùng" khi lưu: BE chỉ trả lỗi này khi handle thật sự đã có người khác dùng; lưu lại handle của chính mình → 200. Cần tester cho biết handle nhập và thao tác | ⏳ cần chi tiết |
| SETP-070, 074, 043 | API đúng: handle → chữ thường, instagram bỏ '@', handle trùng (khác hoa/thường) → 409 tiếng Việt, handle '' → xóa | Không lỗi |
| SETP-003 | Chỉ có link ảnh chụp, không có mô tả | ⏳ cần mô tả |

## Đợt 14 — SETR (Giới thiệu)
Đã hoãn theo yêu cầu: SETP-003, SETP-005, SETP-025 → làm sau khi có server AWS/S3.

| TC | Kết quả kiểm | Xử lý |
|----|--------------|-------|
| SETR-006, 007, 011, 012… (chuỗi UI/đăng ký bằng link) | Gốc: "link giới thiệu chưa vào được / chưa đúng" — link do BE dựng từ `FRONTEND_URL`; môi trường chưa đặt đúng biến này thì link trỏ `localhost:5173`. Route `/gioi-thieu/:code` và `vercel.json` (SPA fallback) đều đúng | Link hiển thị/sao chép giờ dựng từ `window.location.origin` + mã → luôn mở được ở mọi môi trường ✅. Các case phụ thuộc (011–028, 044–055…) cần test lại sau khi link đúng |
| SETR-044…064 (API) | `backend/tests/referrals.test.ts`: 24/24 pass (gồm lỗi hook không làm hỏng thanh toán, reconcile, onHostingCharge idempotent, tỉ lệ chụp vào hoa hồng, idempotent webhook…). Nhiều case cần SQL/ép dữ liệu nên tester thủ công khó làm | Không lỗi code |
| SETR-059 | Admin › Hệ thống › Cài đặt chung thiếu nhóm referral | Thêm thẻ "Chương trình giới thiệu" (4 ô: tỉ lệ creator/member bps, cửa sổ ghi nhận ngày, ngày chi trả) có kiểm khoảng giá trị + nút khôi phục mặc định ✅ |
| SETR-031 | Mô tả tab thành viên nói có "công tắc chương trình giới thiệu theo cộng đồng" nhưng không có | Sửa câu chữ: "Áp dụng cho mọi thanh toán của người được bạn giới thiệu" ✅ |
| SETR-029, 030, 032 | Tính năng CHƯA làm, chờ quyết định (OPEN_DECISIONS A16/A17): hoa hồng creator từ phí hosting (chưa có luồng trừ tiền hosting), job chi trả pending→paid + ngưỡng tối thiểu, quy tắc chống gian lận nhiều tài khoản | ⏳ cần PO chốt |
