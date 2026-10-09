# Wizard "Tạo cộng đồng" + hộp thoại "Chọn gói thành viên"

Hợp đồng API: `backend/docs/api/community-wizard.md` (nguồn sự thật). Tài liệu này mô tả phần frontend.

## Route
| Route | Trang | Ghi chú |
|---|---|---|
| `/communities/new` | `pages/CreateCommunityPage.tsx` → `features/wizard/CreateWizard.tsx` | Bọc `RequireAuth`: khách bị chuyển `/login` rồi quay lại đúng URL (kể cả `?draft=`). |
| `/communities/new?draft=<id>` | như trên | Mở lại bản nháp, nhảy tới `nextStep` của BE. |
| `/courses/new` (cũ) | không có route riêng; `/courses/:id` vẫn qua `LegacyCourseRedirect` | Link tạo cộng đồng ở Header/Footer/Home đều trỏ `/communities/new`. |
| `/me/communities` | `MyCommunitiesPage` | Thêm mục "Bản nháp cộng đồng" (Tiếp tục tạo / Xóa nháp) + nút "Tạo cộng đồng" khi trống. |
| `/communities/:id/checkout` | `CheckoutPage` | Nay hiển thị cùng `JoinCheckout` như hộp thoại (dạng trang). |

## Wizard 5 bước (`features/wizard/`)
| File | Vai trò |
|---|---|
| `CreateWizard.tsx` | Khung: stepper, thanh tiến độ, footer Quay lại/Bỏ qua/Tiếp tục, "Lưu nháp & thoát", toast; điều phối lưu từng bước + publish. |
| `form.ts` | Kiểu `WizardForm`, giá trị mặc định, `validateStep` (lỗi theo từng ô), `slugify`. |
| `mapping.ts` | Draft ↔ form, body từng bước, đọc `error.details.fieldErrors` của BE ra lỗi theo ô. |
| `api.ts` / `queries.ts` / `types.ts` | Gọi API theo hợp đồng + React Query. |
| `StepBasics.tsx` | Bước 1: tên (≤30), đường dẫn `sofinhub.com/…` + kiểm tra còn trống (debounce 300ms), mô tả (≤150), danh mục; xem trước "Trên Khám phá". |
| `StepHostPlan.tsx` | Bước 2: gói chủ cộng đồng (theo tháng/năm, "Tiết kiệm X%"), máy tính "Gói nào lợi hơn?", form thẻ, "Hôm nay: 0đ…". |
| `StepBrand.tsx` | Bước 3: logo/ảnh bìa (upload presign `avatar`/`cover`), màu chủ đạo, lời hứa, lợi ích (≤6), video YouTube/Vimeo; xem trước trang giới thiệu. Có "Bỏ qua, làm sau". |
| `StepMembers.tsx` | Bước 4: quyền riêng tư, giá (miễn phí/tháng/năm, thử miễn phí, "Bạn nhận về khoảng"), câu hỏi gia nhập (≤3), nội quy + "Sửa nội quy mẫu", kết nối tài khoản nhận tiền / "Bỏ qua, làm sau". |
| `StepLaunch.tsx` | Bước 5: tóm tắt + "Sửa", điều khoản; sau publish: "Cộng đồng đã sẵn sàng!", danh sách ra mắt, "Sao chép link mời", "Vào cộng đồng", điều kiện "Lên trang Khám phá". |
| `ImageSlot.tsx`, `ui.tsx` | Ô tải ảnh, primitive UI. |

### API dùng
`GET /communities/slug-available` · `POST /communities/drafts` · `GET /me/community-drafts` · `GET|DELETE /communities/:id/draft` · `PATCH /communities/:id/draft/steps/{basics|plan|identity|members}` · `POST /communities/:id/publish {acceptTerms:true}` · `GET /owner-plans` · `GET /communities/revenue-estimate` · `GET /communities/rules-template` · `PUT /communities/:id/payout-account` · `POST /communities/:id/payout-account/skip` · `GET /communities/:id/launch-checklist` · `POST /uploads/presign` (+ PUT).

### Luồng lưu
Bước 1 "Tiếp tục" tạo nháp (hoặc PATCH nếu đã có); mỗi bước sau PATCH đúng field của bước đó. Đổi slug làm đổi `id` → FE dùng `id` trả về. "Lưu nháp & thoát" = lưu bước hiện tại rồi sang `/me/communities`. Bước 3 "Bỏ qua" không gọi API.

### Quy tắc kiểm tra (client; BE kiểm tra lại, lỗi theo ô hiển thị viền đỏ + dòng báo dưới ô, xoá khi sửa)
- Tên 3–30; đường dẫn 3–40, `^[a-z0-9]+(-[a-z0-9]+)*$`, phải "Còn trống" (BE); mô tả bắt buộc ≤150; danh mục bắt buộc.
- Gói Chuyên nghiệp: thẻ hợp lệ (Luhn, hạn chưa qua, CVC 3/4 số) hoặc đã có thẻ lưu ở nháp cùng chu kỳ.
- Lời hứa ≤100; video phải là link http(s) (BE chỉ nhận YouTube/Vimeo).
- Có phí: giá tháng >0 và ≤10.000 USD; gói năm: giá năm >0 và ≤ 12× giá tháng; câu hỏi 3–200 ký tự, tối đa 3.
- Ra mắt: bắt buộc tick điều khoản; thiếu bước thì BE trả `DRAFT_INCOMPLETE` và danh sách thiếu được hiện ở bước 5.

### Bảo mật thẻ
`lib/card.ts`: định dạng khi gõ, Luhn, kiểm tra hạn/CVC, `tokenizeCard` (token giả `tok_mock_<hex ngẫu nhiên>` + brand/last4/hạn). Chỉ `PaymentMethodInput` (token/brand/last4/expMonth/expYear) được gửi; số thẻ/CVC thô nằm trong state của form và bị xoá ngay sau khi tokenise, không ghi log, không vào localStorage (wizard không dùng localStorage — nháp lưu ở BE).

## Hộp thoại "Chọn gói thành viên"
`features/payments/components/JoinDialog.tsx` (`JoinDialog` = modal, `JoinCheckout` = nội dung, dùng lại ở `/communities/:id/checkout`).
- Mở từ `CourseDetailPage` khi cộng đồng có phí (nhánh `PAYMENT_REQUIRED` / bấm "Tham gia ngay"). Giữ nguyên: tham gia miễn phí, yêu cầu tham gia cộng đồng riêng tư (`JoinRequestDialog`; BE trả `JOIN_REQUEST_REQUIRED` trong dialog thì đóng dialog và mở form yêu cầu), đã tham gia, rời cộng đồng (nguyên văn hộp xác nhận cũ), `COMMUNITY_LOCKED`.
- Mọi con số lấy từ `GET /communities/:id/checkout-quote?interval=`: gói (tháng/năm), giá/tháng, tổng, % tiết kiệm, "Phổ biến nhất", ngày thanh toán đầu (`d/M`, = hôm nay), số tiền (không còn dùng thử miễn phí). Mặc định chọn gói năm nếu có.
- CTA: luôn "Thanh toán" (không còn "Bắt đầu dùng thử miễn phí"; `POST /communities/:id/trial` đã bỏ, 404) (`POST /checkout {method:'stripe', interval, paymentMethod}` + `Idempotency-Key` theo (cộng đồng, kỳ hạn) → `POST /payments/:id/confirm`). Miễn phí không qua dialog (nút "Tham gia" cũ).
- Chip đầu dialog: thành viên (`stats.members`), số bài học (nếu >0), đánh giá hoặc đang trực tuyến — lấy từ dữ liệu chi tiết cộng đồng, không có chuỗi marketing cứng.

## Gaps / lưu ý
- Link mời hiển thị và sao chép là URL thật `${origin}/communities/<slug>`; "sofinhub.com/" chỉ là tiền tố trong ô nhập slug theo thiết kế (chưa có domain/route rút gọn `/<slug>`).
- Ngày kết thúc dùng thử của gói chủ cộng đồng ở bước 2 là ước tính (hôm nay + `trialDays` từ `/owner-plans`) cho tới khi lưu; sau khi lưu dùng `trialEndsAt` của BE. Gói chủ cộng đồng chưa trừ tiền thật (BE đánh dấu `mock:true`).
- `GET /categories` hiện trả 8 danh mục; các danh mục mới (`music`, `sports`, `spirituality`…) chỉ hiện khi BE bật chúng ở endpoint này.
- Chip thứ 2/3 trong ảnh thiết kế ("Nội dung chất lượng", "Học hỏi & phát triển") là chữ marketing nên được thay bằng dữ liệu thật (xem trên).
- Nút trên danh sách ra mắt: "Kết nối" tài khoản nhận tiền sau khi publish, "Dùng mẫu" bài chào mừng chỉ điều hướng tới Cài đặt/Lớp học/Bảng tin (chưa có form nhanh/mẫu bài viết).
- Kéo thả sắp xếp (icon drag) cho lợi ích/câu hỏi chỉ là hình thức; thứ tự = thứ tự nhập.
- Không có e2e/page test mới; test cũ chỉ phụ thuộc nhãn nút "Tham gia ngay" ở sidebar (giữ nguyên).
