# Wizard "Tạo cộng đồng" + dialog "Chọn gói thành viên" (HỢP ĐỒNG API)

> Trạng thái: **ĐÃ HIỆN THỰC (sự thật cuối)** — test: `tests/community-wizard.test.ts`, `tests/annual-subscription.test.ts`. Xem mục "Sai khác so với bản đầu" ở cuối file.
> Mọi path dưới đây là path chuẩn `/communities/*` (tiền tố `/api`). Alias cũ `/courses/:id/*` vẫn chạy. Response thành công `{ data }`, lỗi `{ error: { code, message, details? } }`.
> Lỗi validate Zod: 400 `VALIDATION_ERROR`, `error.details.fieldErrors = { <field>: [thông báo tiếng Việt] }` (hiển thị theo field được).
> Tiền cộng đồng/thành viên: **USD** (`priceUsd`, số thực, 2 chữ số). Gói hosting của owner: tiền tệ riêng trong catalogue (`currency`, mặc định `VND`, số nguyên).

## 0. Mô hình
- Bản nháp = 1 dòng `Community` có `moderationStatus = 'draft'`, `id = slug`. Nháp **không** hiện ở danh sách/tìm kiếm/Khám phá/chi tiết công khai (404), không có Enrollment/khóa học tới khi publish. Chỉ chủ nháp (`ownerId`) thấy/sửa được; người khác nhận 404.
- Mỗi owner tối đa **5 nháp** (409 `DRAFT_LIMIT`).
- Đổi `slug` ở bước 1 khi còn nháp = đổi `id` (response trả `id` mới — FE phải dùng id mới cho các call sau).
- Publish: `draft → active` (một transaction: tạo Enrollment owner + khóa học mặc định, cùng logic `POST /communities`).
- `POST /communities` (tạo một phát) **giữ nguyên** và vẫn chạy; chỉ thêm các trường tùy chọn mới.

Tên bước (`:step`): `basics` (1) · `plan` (2) · `identity` (3) · `members` (4). Bước 5 (Ra mắt) = `publish` + `launch-checklist`.

## 1. Slug
`GET /communities/slug-available?slug=<slug>` (không bắt buộc đăng nhập; nếu đăng nhập, slug của CHÍNH nháp mình tính là còn trống)
→ `{ data: { slug, available: boolean, reason: null | 'invalid_format' | 'too_short' | 'too_long' | 'reserved' | 'taken', message: string, suggestion?: string } }`
- Định dạng: `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–40 ký tự. Reserved: `admin, sofinhub, api, communities, courses, drafts, me, login, ...` (xem `RESERVED_SLUGS`). Trùng cả với cộng đồng đã xóa mềm và nháp người khác.
- `suggestion` = slug gần nhất còn trống (`ten-2`) khi `taken`. FE tự `slugify` từ tên (bỏ dấu, `đ→d`) như mockup rồi gọi endpoint này (debounce 300ms).

## 2. Nháp
| Method · Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|
| `POST /communities/drafts` | login | bước `basics` (bên dưới) | 201 `DraftView` | 400 `VALIDATION_ERROR`, 400 `SLUG_INVALID`/`SLUG_RESERVED`, 409 `SLUG_TAKEN`, 409 `DRAFT_LIMIT`, 403 (user bị khóa) |
| `GET /me/community-drafts` | login | — | `{ data: DraftView[] }` (mới sửa nhất trước) | 401 |
| `GET /communities/:id/draft` | owner | — | `DraftView` | 404 |
| `PATCH /communities/:id/draft/steps/:step` | owner | body theo bước | `DraftView` (đã gộp, có `readiness`) | 400, 404, 409 `NOT_A_DRAFT`, 409 `SLUG_TAKEN` |
| `DELETE /communities/:id/draft` | owner | — | `{ deleted: true }` | 404, 409 `NOT_A_DRAFT` |
| `POST /communities/:id/publish` | owner | `{ acceptTerms: true }` | 201 như `POST /communities` (`CommunityDetail + defaultCourseId + viewerRole:'owner'`) | 400 `TERMS_NOT_ACCEPTED`, 400 `DRAFT_INCOMPLETE` (`details.missing[]`), 400 `PLAN_REQUIRED`, 409 `NOT_A_DRAFT` |

**Body từng bước** (PATCH là cập nhật một phần — chỉ gửi field đổi; `basics` khi tạo thì bắt buộc đủ `title, description, category`):

- `basics`: `{ title: 3–30 ký tự, slug?: string (mặc định slugify(title)), description: 1–150 ký tự ("Mô tả ngắn"), category: 'business'|'content'|'tech'|'finance'|'health'|'self'|'hobby'|'relationships'|'marketing'|'design'|'music'|'sports'|'spirituality' }`. Mapping nhãn mockup: Sở thích=hobby, Âm nhạc=music, Tài chính=finance, Công nghệ=tech, Sức khỏe=health, Thể thao=sports, Phát triển bản thân=self, Tâm linh=spirituality, Mối quan hệ=relationships. (`marketing`/`design`/`business`/`content` có thể chưa được admin bật ở Khám phá.)
- `plan` (gói hosting của owner — **MÔ PHỎNG, chưa trừ tiền thật**, xem §6): `{ planKey: 'start'|'pro', cycle?: 'monthly'|'annual' (mặc định monthly; 'start' bỏ qua), paymentMethod?: PaymentMethodInput }`. `pro` BẮT BUỘC `paymentMethod`; `start` không cần. Trả `draft.plan`.
- `identity` (cả bước bỏ qua được — FE không cần gọi gì khi bấm "Bỏ qua, làm sau"): `{ logoUrl?: string|null, coverUrl?: string|null, brandColor?: '#rrggbb'|null, promise?: ≤100|null, benefits?: string[] (tối đa 6, mỗi ≤100, mục rỗng bị bỏ), introVideoUrl?: string|null (YouTube/Vimeo — link khác 400; server lưu URL nhúng chuẩn hóa) }`. `logoUrl/coverUrl` = `fileUrl` của upload (`POST /uploads/presign` với `purpose:'avatar'` cho logo, `'cover'` cho ảnh bìa → PUT → dùng `fileUrl` trả về; dạng `/api/files/<key>`), hoặc `null` để xóa. Server kiểm file thuộc chính user và đúng purpose.
- `members`: `{ visibility?: 'public'|'private', priceUsd?: number (0 = miễn phí; tối đa 10000), priceAnnualUsd?: number|null (tùy chọn; >0; ≤ 12×priceUsd; chỉ khi priceUsd>0), memberTrialEnabled?: boolean (ĐÃ BỎ 2026-10-14: schema vẫn nhận nhưng bị bỏ qua, API luôn trả false), joinQuestions?: string[] (tối đa 3, mỗi 3–200 ký tự), rules?: { title: 1–80, body?: ≤500 }[] (tối đa 20, có thứ tự), requireRulesAgreement?: boolean, autoApprovePaid?: boolean }`. Mockup: toggle "Yêu cầu đồng ý nội quy" = `requireRulesAgreement`, "Tự duyệt người trả phí" = `autoApprovePaid`.
  Bộ nội quy mẫu ("Sửa nội quy mẫu") lấy ở `GET /communities/rules-template` → `{ data: { rules: {title, body}[] } }`.

**`DraftView`**
```
{ id, slug, status: 'draft', createdAt, updatedAt,
  completedSteps: ('basics'|'plan'|'identity'|'members')[],   // bước đã lưu ít nhất 1 lần
  nextStep: 'basics'|'plan'|'identity'|'members'|'launch',     // để mở lại đúng bước
  basics:   { title, slug, description, category },
  plan:     HostingPlanView | null,
  identity: { logoUrl, coverUrl, brandColor, promise, benefits: string[], introVideoUrl },
  members:  { visibility, priceUsd, priceAnnualUsd, annualSavingsPct, memberTrialEnabled, trialDays,
              joinQuestions: string[], rules: {title,body}[], requireRulesAgreement, autoApprovePaid },
  payout:   PayoutAccountView | null,
  readiness: { canPublish: boolean, missing: { step, field, message }[] } }
```
"Lưu nháp & thoát" = mỗi `PATCH` đã lưu rồi → FE chỉ cần điều hướng. "Lưu nháp" khi đang đứng giữa bước = gọi PATCH bước đó rồi thoát.

**Publish yêu cầu**: bước `basics` + `members` đã lưu; `acceptTerms === true`; giá hợp lệ (`priceAnnualUsd` ≤ 12×`priceUsd`); `plan` chỉ bắt buộc khi Global Setting `owner.requirePlan = true` (mặc định false). `identity`, `payout`, `plan` **bỏ qua được**. Nếu payout chưa kết nối khi publish → trạng thái `skipped` (xem §5).

## 3. Giá & ước tính doanh thu
- Giá tháng `priceUsd` (có sẵn), giá năm mới `priceAnnualUsd` (nullable). Server tính `annualSavingsPct = round((1 − annual/(12·monthly))·100)` (vd. $7 & $48 → 43). Các field này có trong `CommunityDetail`, list item và `PATCH /communities/:id` (sửa sau khi publish; chỉ owner).
- `GET /communities/revenue-estimate?price=<usd>&interval=monthly|annual&members=<n=1>` (public) → `{ data: { interval, priceUsd, members, grossCents, platformFeeCents, gatewayFeeCents, netCents, netPerMemberCents, commissionPct, gatewayFeePct, gatewayFeeFixedCents, note } }` ("Bạn nhận về khoảng X"). Dùng đúng công thức báo cáo doanh thu thật (hoa hồng + phí cổng từ Global Settings). FE chỉ cần hiển thị `netPerMemberCents/100`.

## 4. Hộp thoại tham gia / thanh toán (trang chi tiết cộng đồng)
### `GET /communities/:id/checkout-quote?interval=monthly|annual` (không bắt buộc đăng nhập)
```
{ data: {
  communityId, currency: 'USD', paid: true,
  plans: [ { interval:'monthly', label:'Hàng tháng', priceUsd:7, billedUsd:7, perMonthUsd:7, savingsPct:0, popular:true,  periodDays:30 },
           { interval:'annual',  label:'Hàng năm',  priceUsd:48, billedUsd:48, perMonthUsd:4, savingsPct:43, popular:false, periodDays:365 } ],   // chỉ có 'annual' nếu cộng đồng đặt priceAnnualUsd
  selected: 'monthly'|'annual',          // = interval yêu cầu (mặc định monthly; annual không tồn tại → 400 INTERVAL_UNAVAILABLE)
  trialDays: 0,                           // luôn 0 (đã bỏ dùng thử thành viên 2026-10-14)
  trialEligible: false,                   // luôn false
  startsAt: ISO, firstChargeDate: ISO,    // = startsAt (không có thời gian thử)
  firstChargeAmountUsd: 48, firstChargeAmountCents: 4800,
  dueTodayUsd: 0|48,                      // "Hôm nay thanh toán"
  remindDaysBefore: 3, remindAt: ISO|null,
  cancelAnytime: true, provider: 'stripe'
} }
```
Lỗi: 404 (không có/nháp/đã xóa), 400 `COMMUNITY_FREE` (cộng đồng miễn phí), 400 `INTERVAL_UNAVAILABLE`.
FE dựng câu chữ: "`$perMonth/tháng · thanh toán $billed mỗi năm`", "Lần thanh toán đầu tiên vào ngày `firstChargeDate` (định dạng d/M) với giá `$firstChargeAmountUsd`. Chúng tôi sẽ gửi email nhắc trước `remindDaysBefore` ngày."

### Bắt đầu
Không còn dùng thử miễn phí cho thành viên (đã bỏ 2026-10-14): `POST /communities/:id/trial` trả 404; `quote.trialDays` luôn 0 / `trialEligible` false. Chỉ còn đường trả tiền.

**Trả tiền** — `POST /communities/:id/checkout` body `{ method?: 'stripe'|'vnpay'|'momo' (mặc định 'stripe'), interval?: 'monthly'|'annual', paymentMethod?: PaymentMethodInput }` (+ header `Idempotency-Key` như cũ) → 201 `PaymentIntent` (thêm `interval`, `paymentMethod?`) → `POST /payments/:id/confirm` như cũ. Số tiền do **server** quyết định theo `interval`; client KHÔNG gửi số tiền. Cùng user gọi lại cùng `interval` ⇒ tái dùng intent pending; đổi `interval` ⇒ intent mới.
- Lỗi mới: 400 `INTERVAL_UNAVAILABLE`.

**`PaymentMethodInput`** (FE tokenize phía client — hiện là MOCK; sau này thay bằng Stripe Elements/PaymentMethod id): 
`{ type: 'card', token: 'tok_mock_<…>' (regex ^(tok|pm)_[A-Za-z0-9_]{4,100}$), brand: 'visa'|'mastercard'|'amex'|'discover'|'jcb'|'unionpay'|'diners'|'unknown', last4: '\d{4}', expMonth: 1–12, expYear: 4 chữ số, chưa hết hạn }`.
- Object STRICT: bất kỳ field lạ (`number`, `cvc`, `pan`…) ⇒ 400 `VALIDATION_ERROR`. Server **không bao giờ** nhận/lưu số thẻ đầy đủ hay CVC; chỉ lưu `brand/last4/exp` + token cổng. FE phải Luhn + kiểm hạn dùng + CVC ở client rồi mới tạo token.
- Token đặc biệt để test cổng giả lập: `tok_mock_declined` ⇒ cổng từ chối khi trừ tiền.
- `GET /me/payment-methods` → `{ data: { id, brand, last4, expMonth, expYear, createdAt }[] }`.

### Join request có câu hỏi
`POST /communities/:id/join-requests` body `{ message?: string, answers?: string[], acceptRules?: boolean }`.
- Cộng đồng có `joinQuestions` (chỉ cộng đồng `private` dùng join request): `answers` BẮT BUỘC, đúng số câu, mỗi câu 1–500 ký tự ⇒ nếu thiếu 400 `JOIN_ANSWERS_REQUIRED`. Server lưu **bản chụp** `[{question, answer}]` trên yêu cầu.
- Cộng đồng `requireRulesAgreement` và có `rules` ⇒ `acceptRules: true` bắt buộc (400 `RULES_NOT_ACCEPTED`).
- `GET /communities/:id/join-requests` (admin+) trả thêm `answers: [{question, answer}]` cho mỗi yêu cầu (`[]` nếu không có câu hỏi). Không có câu hỏi ⇒ luồng cũ y nguyên.
- `CommunityDetail` có thêm `joinQuestions`, `rules`, `requireRulesAgreement` để FE dựng form.

## 5. Tài khoản nhận tiền (payout) — MÔ PHỎNG
| Method · Path | Auth | Body | Response |
|---|---|---|---|
| `GET /communities/:id/payout-account` | owner (kể cả nháp) | — | `{ data: PayoutAccountView \| null }` |
| `PUT /communities/:id/payout-account` | owner | `{ bankName: 1–100, accountHolder: 1–100, accountNumber: 6–20 chữ số }` | `PayoutAccountView` (`status:'connected'`) |
| `POST /communities/:id/payout-account/skip` | owner | — | `PayoutAccountView` (`status:'skipped'`) |

`PayoutAccountView = { status: 'connected'|'skipped', bankName?, accountHolder?, accountMasked?: '****1234', connectedAt?, note }`. Số tài khoản đầy đủ KHÔNG lưu (chỉ 4 số cuối). Không có xác minh danh tính thật ("xét duyệt 3–5 ngày" chỉ là chữ trong UI).
**Guard rút tiền**: `POST /communities/:id/payouts` — cộng đồng có bản ghi `skipped` ⇒ 400 `PAYOUT_ACCOUNT_REQUIRED`; đã `connected` ⇒ `method` trong body trở nên tùy chọn (dùng tài khoản đã kết nối). Cộng đồng cũ không có bản ghi ⇒ như trước (bắt buộc `method`).

## 6. Gói hosting của owner (khái niệm MỚI, chưa được chủ sở hữu chốt — xem OPEN_DECISIONS A16)
`GET /owner-plans` (public) →
```
{ data: { currency:'VND', trialDays:14, remindDaysBefore:3, required:boolean,
  cycles:[{key:'monthly',label:'Theo tháng',savingsPct:0},{key:'annual',label:'Theo năm - tặng 2 tháng',savingsPct:17}],
  plans:[ {key:'start',name:'Khởi đầu',tagline:'Dành cho cộng đồng mới',priceMonthly:0,priceAnnual:0,transactionFeePct:10,features:[…],fit:'…',popular:false},
          {key:'pro',name:'Chuyên nghiệp',tagline:'Dành cho cộng đồng phát triển',priceMonthly:299000,priceAnnual:2990000,transactionFeePct:2.9,features:[…],fit:'…',popular:true} ] } }
```
Giá/ngày thử/`required` đến từ Global Settings (`owner.*`). **`transactionFeePct` chỉ là thông tin hiển thị cho phép FE làm máy tính "Gói nào lợi hơn?" như mockup — kế toán thật vẫn dùng `payments.commissionPct`.**
- `GET /communities/:id/hosting-plan` (owner) → `HostingPlanView | null`; `PUT /communities/:id/hosting-plan` body như bước `plan`.
- `HostingPlanView = { planKey, cycle, priceAmount, currency, status: 'trialing'|'active'|'canceled', trialStartedAt, trialEndsAt, firstChargeDate, firstChargeAmount, todayDue: 0, paymentMethod:{brand,last4,expMonth,expYear}|null, mock: true }`. `start` ⇒ `active`, không có trial; `pro` ⇒ `trialing` tới `trialEndsAt` ("Hôm nay: 0đ").
- **KHÔNG có trừ tiền thật khi hết thử và chưa có job** (đánh dấu `mock:true`); khi chốt mô hình sẽ thêm job + cổng.

## 7. Danh sách ra mắt & điều kiện Khám phá (bước 5)
`GET /communities/:id/launch-checklist` (owner, cộng đồng đã publish) →
```
{ data: { slug, doneCount, total: 6,
  items: [ {key:'created',done:true}, {key:'identity',done}, {key:'payout',done}, {key:'first_lesson',done}, {key:'welcome_post',done}, {key:'invite_members',done,current,required:10} ],
  discovery: { eligible: boolean, conditions: [ {key:'has_description_and_promise',met}, {key:'has_cover',met}, {key:'min_members',met,current,required:10}, {key:'recent_post',met} ] } } }
```
Tất cả tính từ dữ liệu thật (bài học, bài viết ≤7 ngày, số thành viên, ảnh bìa, payout). `discovery.eligible` hiện **chỉ để hiển thị** (cộng đồng đã publish vẫn lên Khám phá theo luồng cũ). Link mời: dùng slug (`/communities/<slug>`) hoặc `POST /communities/:id/invites` đã có.

## 8. Global Settings mới
`owner.requirePlan` (bool, false), `owner.trialDays` (14), `owner.currency` ('VND'), `owner.proMonthlyPrice` (299000), `owner.proAnnualPrice` (2990000), `owner.startFeePct` (10), `owner.proFeePct` (2.9), `payments.annualPeriodDays` (365), `payments.trialReminderDays` (3). `payments.trialDays` (7) vẫn là số ngày dùng thử của thành viên.

## 9. Việc FE cần nhớ
- Đổi slug ở nháp ⇒ dùng `data.id` mới.
- Mọi bước chỉ gửi field thuộc bước đó; field lạ ⇒ 400.
- Dùng `error.details.fieldErrors` để hiện lỗi từng ô (thông báo đã là tiếng Việt).
- Không tính tiền/ngày ở client: dùng `checkout-quote`, `revenue-estimate`, `owner-plans`.


## 10. Sai khác so với bản đầu (sự thật cuối)
- Ngày dùng thử của OWNER (gói hosting) = **14** (theo mockup "Dùng thử 14 ngày"); `owner.trialDays` chỉnh được. Dùng thử của THÀNH VIÊN (`payments.trialDays`, 7 ngày) đã bị BỎ 2026-10-14.
- `title` của wizard tối đa **30** ký tự (mockup đếm /30); `POST /communities` một phát vẫn cho tới 80.
- `PaymentIntent` trả `interval` + `paymentCardId` (id nội bộ của thẻ đã lưu) chứ không nhúng object `paymentMethod`; xem thẻ ở `GET /me/payment-methods` hoặc `paymentMethod` trong `SubscriptionView`/`GET /communities/:id/subscription`.
- (Hosting owner) Hủy-cuối-kỳ khi đang dùng thử rồi đến hạn ⇒ gói chuyển `expired` (hành vi sẵn có của nhánh dùng thử), không phải `canceled`; không bị trừ tiền.
- `GET /communities/:id/launch-checklist` với cộng đồng còn là nháp ⇒ 409 `NOT_PUBLISHED`; người không phải owner ⇒ 403 (qua policy).
- Publish tự tạo `PayoutAccount{status:'skipped'}` nếu chưa chọn bước payout ⇒ cộng đồng wizard chưa kết nối tài khoản sẽ bị chặn rút (`PAYOUT_ACCOUNT_REQUIRED`); cộng đồng tạo kiểu cũ không có bản ghi nên giữ luồng cũ.
- `PATCH /communities/:id` (sau khi publish) cũng nhận: `priceAnnualUsd, joinQuestions, rules, requireRulesAgreement, autoApprovePaid, brandColor, promise, benefits, introVideoUrl` (không có upload logo/cover sau publish — chưa làm).
- Điều kiện Khám phá (`discovery.eligible`) chỉ để hiển thị, không lọc danh sách công khai.
- `requireRulesAgreement` chỉ được ÉP ở `POST /communities/:id/join-requests` (`acceptRules`); checkout/enroll miễn phí chưa ép.
- `npm test` chạy với `--test-concurrency=16` (xem cuối `docs/api/payments.md`).
