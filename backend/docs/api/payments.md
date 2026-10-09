# API Thanh toán, gói thành viên, hoàn tiền, doanh thu (Phase 8)

> **2026-10-14 — THAY LUỒNG THANH TOÁN: chuyển khoản VietQR + SePay, tiền VND.** Gói thành viên và mua lẻ module không còn trừ thẻ/gateway mock/USD.
> Đọc mục **"Chuyển khoản VietQR + SePay"** ngay dưới trước; các mục phía dưới viết cho luồng thẻ cũ — phần nào nhắc `createCharge`, `MockGateway`, chữ ký HMAC `x-sofin-signature`,
> `PAYMENT_WEBHOOK_SECRET`, `WebhookEvent`, `reapStaleWebhooks`, `reconcileUnsettledCharges`, `recordRenewal`, tự trừ thẻ khi hết thử/gia hạn, `$`/USD/cent đã **lỗi thời**
> (số dư owner, hoàn tiền 2 pha, hóa đơn, idempotency, vòng đời kick/ban/rời, quyền Owner/Admin **vẫn đúng** vì dùng chung `settle`).

## Bỏ dùng thử miễn phí (2026-10-14)
Dùng thử miễn phí của THÀNH VIÊN đã bị **bỏ hoàn toàn**: cộng đồng chỉ là miễn phí hoặc trả phí.
- Đã xóa `POST /courses/:id/trial`, `POST /communities/:id/trial` (nay 404), `paymentsService.startTrial`, `startTrialBody`, mã lỗi `TRIAL_NOT_AVAILABLE`.
- `GET /communities/:id/checkout-quote` luôn trả `trialDays: 0`, `trialEligible: false`, `firstChargeDate = startsAt`, `dueTodayUsd = giá kỳ`, `remindAt: null`.
- `Community.memberTrialEnabled` luôn `false` trong API; schema vẫn nhận field nhưng bỏ qua (tạo/sửa/wizard). Wizard `members.trialDays` luôn 0. Enum `pricing: 'trial'` còn trong enum nhưng dữ liệu đã chuyển sang `paid` (migration `20261014110000_remove_member_trial`), seed không dùng nữa.
- Dữ liệu CŨ vẫn chạy đúng: gói `trialing` còn sót hết hạn thì `processDueSubscriptions` đặt `expired` + thu hồi quyền; trả tiền khi còn gói `trialing` ⇒ `settle` chuyển thành `active`; `sendTrialReminders` / job `payments.trialReminders` vẫn nhắc gói `trialing` cũ.
- KHÔNG đổi: dùng thử gói HOSTING của owner (`owner.trialDays`, bước `plan` của wizard) — tính năng mô phỏng khác.
- Các mục "dùng thử" của thành viên bên dưới được đánh dấu **LỖI THỜI**; chỉ phần mô tả hành vi gói `trialing` cũ còn hiệu lực.

## Chuyển khoản VietQR + SePay (2026-10-14)
Port từ `payment-engine` (Python/FastAPI) và `sofin/apps/lms/src/payment` (NestJS) sang SofinHub. Code: `payments.bank.ts` (khớp tiền), `payments.service.ts` (`checkout`, `confirm`, `settle*`, gia hạn),
`payments.gateway.ts` (chỉ còn `refund`). Test: **`tests/bank-transfer.test.ts`**. Migration `20261014100000_bank_transfer_vnd`.

### Luồng tiền vào
```
POST /courses/:id/checkout            -> Payment pending: refCode (SFH + 8 ký tự), expiresAt = +15 phút, transfer{qrUrl, bankAccount, ...}
Khách quét QR / chuyển khoản, nội dung CK = refCode
   |- (A) webhook SePay   POST /payments/webhook          (realtime, Authorization: Apikey <SEPAY_WEBHOOK_KEY>)
   |- (B) cron quét       job payments.bankScan, 60 giây  (kéo GET {SEPAY_API_BASE}/transactions/list, không cần webhook tới được server)
   `- (C) admin duyệt tay POST /admin/bank/payments/:refCode/approve
        => CÙNG MỘT hàm settleAndVoid() -> settle()/settleModule()/settleRenewal() (cấp quyền, hóa đơn INV-..., hoa hồng giới thiệu, thông báo)
```
Ba đường, một công thức cấp quyền; đường nào tới trước thì cấp, đường sau thấy Payment không còn `pending` nên lùi (compare-and-set `transition(['pending'])` + advisory lock). Webhook và quét chạy
song song cho cùng một giao dịch vẫn chỉ cấp **một lần**. FE poll `GET /payments/:id` mỗi ~4 giây tới khi `succeeded`.

### Endpoint
| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| POST | `/courses/:id/checkout` (= `/communities/:id/checkout`) | login | Body `{interval?}` (`method`/`paymentMethod` cũ bị bỏ qua). 201 Payment `pending` + `transfer`. **Tái dùng** phiên pending còn hạn cùng chu kỳ+số tiền (cùng QR). 503 `BANK_NOT_CONFIGURED` nếu thiếu `BANK_ACCOUNT` |
| GET | `/payments/:id` | chủ phiên | Trạng thái + `transfer` (khi còn pending). Pending quá hạn ⇒ tự chuyển `failed/expired` |
| POST | `/payments/:id/confirm` | chủ phiên | Giống GET, thêm quét SePay theo yêu cầu (giãn cách ≥ 10s toàn hệ thống). **Không cấp quyền** |
| POST | `/communities/:id/modules/:moduleId/purchase` | login | 201 Payment `kind=module` **pending** + `transfer`; module mở khóa khi tiền về |
| ~~POST~~ | ~~`/communities/:id/trial`~~ | | **[LỖI THỜI — đã bỏ 2026-10-14]** Đã xóa, trả 404. Gói `trialing` cũ: hết thử không trả ⇒ `expired` |
| POST | `/payments/webhook` | key tĩnh | `Authorization: Apikey <key>` hoặc `Bearer <key>`, so sánh timing-safe. **Chưa đặt `SEPAY_WEBHOOK_KEY` ⇒ 401 mọi request**. Nhận payload webhook (camelCase) lẫn dòng `transactions/list` (snake_case) |
| GET | `/admin/bank/status` | Platform Admin | `{configured}` |
| GET | `/admin/bank/transactions` | Platform Admin | `credited?, page, limit` — tiền vào chưa khớp (kèm `note` lý do) |
| POST | `/admin/bank/payments/:refCode/approve` | Platform Admin | `{bankTransactionId?, note?}` — duyệt tay; gán giao dịch ngân hàng phải đủ tiền. Cho phép khi Payment `pending` hoặc `failed` lý do `expired`/`cancelled`. Ghi audit `payment.manual_approve` |
| POST | `/admin/bank/scan` | Platform Admin | Quét ngay → `{scanned, credited, already, unmatched, underpaid, errors, skipped}` |

`transfer` = `{refCode, amount, transferContent, qrUrl (img.vietqr.io/image/<BIN>-<TK>-compact2.png?amount&addInfo&accountName), bankAccount, bankBin, bankName, accountName, expiresAt}`.

### Kết quả khớp một giao dịch tiền vào (`BankOutcome`)
`credited` (cấp quyền) · `already` (cùng giao dịch đã xử lý) · `no_ref` (không thấy mã) · `unmatched` (mã lạ / vượt trần 50 triệu) · `underpaid` (thiếu tiền, không cấp) · `expired` (phiên hết hạn/đóng: ghi nhận, chờ duyệt tay) ·
`duplicate` (phiên đã trả bằng giao dịch khác ⇒ chuyển trùng, admin hoàn tay) · `error` (đã nhận tiền nhưng chưa cấp được, vd. cộng đồng bị xóa: Payment giữ `pending`, admin duyệt tay).
Mọi giao dịch đều lưu `BankTransaction` (`externalId` UNIQUE ⇒ quét lại không sinh dòng trùng). Chuyển **dư** vẫn cấp, phần dư ghi trong `note`. Mỗi tình huống cần người xử lý gọi `alert()` (hiện: `console.error('[ALERT][payments] …')`).

### Gia hạn gói (không tự trừ)
- `issueRenewalInvoices()` (job `payments.renewalInvoices`, 15 phút): gói `active` không hủy-cuối-kỳ còn ≤ `trialReminderDays` (3) ngày ⇒ **một** Payment `kind=renewal` pending (refCode, `periodStart = currentPeriodEnd`, `expiresAt = hết kỳ + 2 ngày ân hạn`) + thông báo.
- Trả hóa đơn ⇒ `settleRenewal`: gói còn active nối kỳ từ `currentPeriodEnd` (gói đã `expired` thì tính từ bây giờ), `priceCents` cập nhật theo hóa đơn.
- `processDueSubscriptions()` (5 phút) trả `{invoiced, renewalFailed, trialsExpired, ended}`: hết kỳ mà chưa có hóa đơn ⇒ phát hóa đơn ân hạn; còn trong ân hạn ⇒ giữ quyền; hết ân hạn ⇒ `expired` + thu hồi quyền.
- `expireStaleSessions()` (trong `reconcileMoney`): mọi Payment `bank_transfer` pending quá `expiresAt` ⇒ `failed`/`expired`. Tiền về muộn vẫn được ghi (`BankTransaction`) và duyệt tay được (`adminRetryPayment` mở lại phiên với hạn mới, cùng mã).

### Hoàn tiền
`BankTransferGateway.refund` **ghi nhận** khoản phải trả lại (idempotent theo `RefundRequest.id`, `refundId = manual:<id>`); admin **chuyển khoản trả khách ngoài hệ thống**. Hệ thống thu hồi quyền và trừ doanh thu owner như cũ.
Chưa có trạng thái "đã chuyển trả" để theo dõi — xem "Chưa làm".

### Tiền VND
Toàn hệ thống là VND nguyên, 1 đơn vị = 1đ. Tên field cũ (`priceUsd`, `amountUsd`, `*Cents`, `payoutMinUsd`) **giữ nguyên để không phá API** nhưng không còn nhân/chia 100 (`usdToCents`/`centsToUsd` là hàm đồng nhất). Migration nhân dữ liệu cũ ×250 (1 USD = 25.000đ = 100 cent).
Giới hạn giá 50.000.000đ/lần (= `MAX_SINGLE_AMOUNT` của khớp tiền). Phí cổng mặc định 0 (`GATEWAY_FEE_PCT=0`, `GATEWAY_FEE_FIXED_CENTS=0`); rút tối thiểu mặc định 1.000.000đ (`PAYOUT_MIN_USD`).

### Biến môi trường
`BANK_ACCOUNT`, `BANK_ACCOUNT_NAME`, `BANK_BIN` (MB Bank = 970422), `BANK_NAME`, `SEPAY_WEBHOOK_KEY`, `SEPAY_API_TOKEN`, `SEPAY_API_BASE` (https://my.sepay.vn/userapi), `PAY_REF_PREFIX` (SFH). Thiếu mỗi biến ở production ⇒ cảnh báo khi khởi động (`productionEnvWarnings`).
**Bỏ** `PAYMENT_WEBHOOK_SECRET`. Cấu hình webhook trên SePay: URL `https://<api>/api/payments/webhook`, kiểu xác thực API Key = `SEPAY_WEBHOOK_KEY`.

### Chưa làm / cần quyết định (chuyển khoản)
- Hoàn tiền: chưa có hàng đợi/trạng thái "admin đã chuyển trả"; chuyển dư/chuyển trùng cũng hoàn tay.
- `alert()` mới chỉ log; chưa bắn Telegram/email cho admin.
- Chưa đối chiếu `accountNumber` của webhook với `BANK_ACCOUNT` (chỉ dựa vào `SEPAY_WEBHOOK_KEY`).
- Admin chưa chọn tài khoản nhận từ danh sách SePay ở runtime (cấu hình bằng env); chưa có `/bankaccounts/list`.
- Tên field `*Usd`/`*Cents` gây hiểu nhầm (nay là đồng) — đổi tên là thay đổi phá API, để dành đợt riêng.
- Gói hosting owner vẫn mô phỏng (không trừ tiền); referral member tính trên VND.

Code: `src/modules/payments/*`. Test: `tests/payments.test.ts`, `tests/revenue.test.ts`, **`tests/money-lifecycle.test.ts`** (5 kịch bản tiền của audit §3 + P1 — xem mục "Vòng đời tiền" cuối file). Dữ liệu lưu **Postgres (Prisma)** qua
`PaymentsRepository` (bảng Payment, Subscription, RefundRequest, Payout, InvoiceSequence, IdempotencyKey, WebhookEvent, OwnerBalanceLedger). Mọi số tiền là **số nguyên cent** (`*Cents`); `amountUsd` chỉ giữ để tương thích FE cũ.
Response thành công `{ data }` (danh sách: `{ data, meta }`). Lỗi tiếng Việt `{ error... }` theo error-handler chung.

## Endpoint

| Method | Path | Auth / Role | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | `/courses/:id/checkout` | đăng nhập | `{method}`; header tùy chọn `Idempotency-Key` | 201 `PaymentIntent` (cũ + `amountCents, kind, invoiceNumber?...`) | 400 miễn phí/body sai, 403 `COMMUNITY_LOCKED` (cộng đồng bị khóa) / `JOIN_REQUEST_REQUIRED` (riêng tư chưa được duyệt), 404, 409 đã tham gia / gói còn hiệu lực / key dùng cho khóa khác. **Tái dùng intent `pending` chưa quá 30 phút** của cùng (user, cộng đồng) |
| GET | `/courses/:id/subscription` | đăng nhập | | `{enrolled, latestPayment, subscription}` (2 field đầu là cũ) | 404 |
| POST | `/payments/:id/confirm` | chủ giao dịch | | `PaymentIntent` | 403, 404 (chỉ đọc trạng thái — không cấp quyền) |
| POST | `/courses/:id/subscription/cancel` | thành viên có gói | `{atPeriodEnd=true}` | `Subscription` | 400, 404 chưa có gói |
| POST | `/courses/:id/subscription/resume` | thành viên có gói | | `Subscription` | 404, 409 chưa hủy / đã hết kỳ |
| GET | `/me/subscriptions` | đăng nhập | | `Subscription[]` (+ `courseTitle, accessUntil`) | |
| ~~POST~~ | ~~`/courses/:id/trial`~~ (LỖI THỜI — đã xóa, nay 404) | đăng nhập | | 201 `Subscription` (`trialing`) | 400 khóa miễn phí, 403 bị cấm / cộng đồng khóa / riêng tư chưa được duyệt, 404, 409 đã tham gia / có gói / đã dùng thử |
| GET | `/me/payments` | đăng nhập | `page, limit(<=100)` | `{data, meta}` | 400 |
| GET | `/payments/:id/invoice` | chủ giao dịch, Owner cộng đồng đó, Platform Admin | | hóa đơn JSON: `invoiceNumber (INV-2026-000123), issuedAt, status, buyer, community, items[], subtotalCents, refundedCents, totalCents` | 403, 404, 409 chưa có hóa đơn |
| POST | `/payments/:id/refund-request` | chủ giao dịch | `{reason}` | 201 `RefundRequest` (`approved` nếu trong cửa sổ, ngược lại `pending`) | 400, 403, 404, 409 |
| GET | `/admin/refunds` | Platform Admin | `status?, page, limit` | `{data, meta}` | 401, 403 |
| PATCH | `/admin/refunds/:id` | Platform Admin | `{action:'approve'\|'reject', note?}` | `RefundRequest` | 403, 404, 409 đã xử lý |
| POST | `/payments/webhook` | key tĩnh SePay (xem mục mới) | payload SePay | 200 `{success, message}` | 401 sai/thiếu key |
| GET | `/courses/:id/revenue` | **Owner** hoặc Platform Admin (Admin/Mod cộng đồng: 403) | `from?, to?` (ISO hoặc `YYYY-MM-DD`) | xem dưới | 400, 403, 404 |
| POST | `/courses/:id/payouts` | **Owner** (Platform Admin cũng 403) | `{amountCents, method:{type:'bank', bankName, accountNumber, accountHolder}}` | 201 `Payout` (số TK dạng `****1234`) | 400 dưới ngưỡng / vượt số dư **có thể rút** (`PAYOUT_EXCEEDS_AVAILABLE`) / còn nợ (`PAYOUT_BLOCKED`) / sai định dạng, 403 (kể cả cộng đồng bị khóa) |
| GET | `/courses/:id/payouts` | Owner hoặc Platform Admin | `page, limit` | `{data, meta}` | 403 |
| GET | `/admin/payouts` | Platform Admin | `status?, page, limit` | `{data, meta}` | 403 |
| PATCH | `/admin/payouts/:id` | Platform Admin | `{action:'approve'\|'mark_paid'\|'reject', note?}` | `Payout` | 403, 404, 409 |

`GET /courses/:id/revenue` trả: `grossCents, refundsCents, platformCommissionCents, gatewayFeeCents, netCents` (trong khoảng from/to),
`availableBalanceCents` (**số có thể rút ngay**, toàn thời gian — xem "Số dư owner"), `payoutRequestedCents`, và các trường THÊM MỚI `totalBalanceCents` (net − payout đã yêu cầu, có thể âm), `heldCents` (còn trong holding period), `reserveCents`, `debtCents`, `payoutPolicy {holdDays, refundWindowDays, disputeWindowDays, reservePct}`, `activePaidMembers`,
`trialingMembers`, `mrrCents` (gói `active` không ở trạng thái hủy-cuối-kỳ), `recentTransactions` (20 mới nhất), `assumptions`.

## Mô hình dữ liệu
- **PaymentIntent** (giao dịch): `pending → succeeded | failed`, `succeeded → refunded`. `failed` + `failureReason='duplicate_charge'` = khoản trừ trùng đã bị void (kèm `refundedCents` khi cổng đã hoàn). `kind: initial | renewal`. Có `invoiceNumber` khi thành công.
- **Subscription**: `trialing | active | canceled | expired`. `active + cancelAtPeriodEnd=true` = đã hủy, còn truy cập tới `currentPeriodEnd`.
- **RefundRequest**: `pending → refunding → approved | rejected` (`refunding` = đã khóa + đang gọi cổng; có `gatewayRefundId`, `refundingAt`). **Payout**: xem `payments.types.ts`. **OwnerBalanceLedger**: sổ nợ append-only (`kind`, `amountCents < 0`). Payout chỉ lưu 4 số cuối tài khoản.

## Quyết định thiết kế
- **Gateway abstraction** (`payments.gateway.ts`): `PaymentGateway { createCharge, refund, verifyWebhookSignature }`. `MockGateway` (dev/test) luôn
  thành công, có `failFor(userId)` để giả lập thẻ bị từ chối. Đổi cổng chỉ sửa dòng `paymentGateway` cuối file.
- **Không tin client**: giá luôn lấy từ `course.priceUsd` ở server (`toCents`); body có `amountUsd/amountCents` bị bỏ qua.
- **Idempotency-Key** (checkout): map `(userId, key) → paymentId`; cùng key trả đúng giao dịch cũ (vẫn 201), key dùng cho khóa khác → 409.
- **Chống double-confirm**: `repo.transition` là compare-and-set theo trạng thái; hai `confirm` song song dùng chung 1 promise nên cổng chỉ bị trừ 1 lần
  và chỉ có 1 hóa đơn. Hóa đơn tuần tự theo năm: `INV-<năm>-<6 số>`.
- **Webhook**: `app.ts` giữ `rawBody` (qua `verify` của `express.json`) CHỈ cho path `/api/payments/webhook`. Chữ ký kiểu Stripe:
  `x-sofin-signature: t=<unix giây>,v1=<hex HMAC-SHA256 của "t.rawBody">`, secret `PAYMENT_WEBHOOK_SECRET`, so sánh `timingSafeEqual`, lệch
  timestamp > 300s (cả quá khứ lẫn tương lai) bị từ chối. Idempotent theo `event.id` (đã xử lý → 200 `duplicate`; lỗi giữa chừng → nhả event id để cổng gửi lại).
  Loại: `payment.succeeded|failed|refunded {paymentId}`, `subscription.renewed|canceled {subscriptionId}`. Đối tượng không tồn tại / loại lạ → 200 `ignored` để cổng khỏi retry vô hạn.
- **Gia hạn**: `processDueSubscriptions(now)` (scheduler mỗi 5 phút, `unref`, tắt khi `NODE_ENV=test`, gọi từ `src/index.ts`): hết dùng thử → `expired` + thu hồi quyền;
  hủy-cuối-kỳ đến hạn → `canceled` + thu hồi; còn lại tính tiền qua gateway, tạo giao dịch `renewal` mới (mỗi lần chạy chỉ tiến 1 kỳ); trừ tiền lỗi → `expired` + thu hồi + notify.
  Owner không bao giờ bị thu hồi quyền (`revokeAccess` bỏ qua vai trò owner).
- **[LỖI THỜI — đã bỏ 2026-10-14]** **Dùng thử** (chỉ còn đúng với gói `trialing` cũ): `TRIAL_DAYS` (mặc định 7), 1 lần/user/cộng đồng, cấp quyền ngay, không thu tiền. Đang dùng thử vẫn `checkout` + `confirm` được → chuyển thành `active` (kỳ mới từ lúc trả tiền).
- **Hoàn tiền (đề xuất chờ xác nhận)**: trong `REFUND_WINDOW_DAYS` (mặc định 7) kể từ **lần thanh toán đầu của gói** → tự duyệt, hoàn 100%; ngoài cửa sổ → `pending`,
  Platform Admin duyệt/từ chối. Hoàn xong: giao dịch `refunded`, nếu là kỳ hiện tại của gói thì gói `canceled` + thu hồi quyền, notify.
- **Doanh thu** (`lineEconomics`): mỗi giao dịch `succeeded|refunded`: hoa hồng = `round((amount - refunded) * PLATFORM_COMMISSION_PCT)`; phí cổng =
  `round(amount * GATEWAY_FEE_PCT) + GATEWAY_FEE_FIXED_CENTS` (cổng không hoàn phí khi hoàn tiền); `net = amount - refunded - hoa hồng - phí cổng`. Tính bằng basis point nguyên.
- **Phân quyền** chỉ qua `policy.ts`: `requireRole(...,'owner')` (Platform Admin ghi đè, Admin/Mod → 403), `requirePlatformAdmin`, `getRole/atLeast` (hóa đơn),
  và hàm MỚI thêm `isCourseOwner` (chỉ đúng Owner, dùng cho lệnh rút tiền để Platform Admin không rút thay).
- **Payout**: tạo lệnh trong 1 transaction có `SELECT ... FOR UPDATE` dòng Course (số dư tính bằng SQL SUM trong transaction) nên hai lệnh song song không vượt số dư; lệnh `rejected` được hoàn lại số dư. Notify Owner (type `system`) mỗi lần đổi trạng thái.

## Biến môi trường (đều TẠM, chờ chốt)
`PAYMENT_WEBHOOK_SECRET` (dev-webhook-secret-change-me — đổi khi production), `TRIAL_DAYS=7`, `SUBSCRIPTION_PERIOD_DAYS=30`, `REFUND_WINDOW_DAYS=7`,
`PLATFORM_COMMISSION_PCT=10` (**giá trị tạm chờ chốt mô hình doanh thu, PLAN câu hỏi #6**), `GATEWAY_FEE_PCT=2.9`, `GATEWAY_FEE_FIXED_CENTS=30` (mô phỏng), `PAYOUT_MIN_USD=50`,
`PAYOUT_DISPUTE_WINDOW_DAYS=7` (**tạm**, cộng vào `REFUND_WINDOW_DAYS` thành holding period), `PAYOUT_RESERVE_PCT=10` (**tạm**, rolling reserve). Hai biến mới đọc trực tiếp từ `process.env` làm mặc định của Global Settings (`payments.disputeWindowDays`, `payments.payoutReservePct`) — chỉnh được ở Admin > System > Global Settings, không hardcode.

## Viết StripeGateway / PayOSGateway
Hiện thực interface `PaymentGateway` trong file mới (vd. `payments.stripe-gateway.ts`) rồi đổi `paymentGateway` ở `payments.gateway.ts` (hoặc chọn theo env `PAYMENT_GATEWAY`):
1. `createCharge`: Stripe → `paymentIntents.create({amount, currency, customer, confirm:true, off_session:true}, {idempotencyKey})`; trả `{ok, chargeId: pi.id, failureReason}`.
   PayOS/VNPay không trừ tiền off-session: dùng luồng "tạo link thanh toán" → `checkout` trả `paymentUrl`, `createCharge` chỉ dùng cho gia hạn nếu cổng hỗ trợ token thẻ; nếu không, gia hạn = gửi link thanh toán và chờ webhook `payment.succeeded`.
2. `refund(chargeId, amountCents, idempotencyKey)`: Stripe `refunds.create({payment_intent, amount}, {idempotencyKey})` (key = `RefundRequest.id`, hoặc `void:<paymentId>` cho khoản trừ trùng); PayOS/VNPay gọi API hoàn tiền tương ứng.
3. `verifyWebhookSignature(rawBody, header)`: Stripe dùng `stripe.webhooks.constructEvent(rawBody, header, secret)`; PayOS/VNPay dùng thuật toán ký riêng (HMAC-SHA256/SHA512 trên tham số đã sắp xếp). Luôn dùng RAW body và so sánh timing-safe.
4. Thêm bộ map sự kiện của cổng sang 5 loại sự kiện nội bộ ở đầu `handleWebhook` (vd. `charge.succeeded → payment.succeeded`).

## Tính đúng đắn dưới đồng thời (DB)
- **Idempotency-Key**: `IdempotencyKey(userId,key)` unique; giao dịch + khóa commit cùng transaction, bên thua (P2002) rollback rồi trả giao dịch của bên thắng (key dùng cho khóa khác → 409).
- **Confirm/webhook**: `transition` = `updateMany where status in (...)`; hóa đơn (`InvoiceSequence` upsert-increment, reset theo năm, giữ khóa hàng đến hết transaction ⇒ không trùng/không hở), gói và quyền truy cập cùng 1 transaction.
- **Webhook**: `WebhookEvent` lưu `type`, `payload`, `status` (`received|processing|done|failed`), `attempts`, `lastError` — xem "Vòng đời tiền".
- **Hoàn tiền (2 pha, cổng gọi NGOÀI transaction)**: xem "Vòng đời tiền" §3.4.
- **Gia hạn**: `processDueSubscriptions` mỗi gói một transaction, chọn bằng `FOR UPDATE SKIP LOCKED` ⇒ nhiều instance không xử lý trùng.
- **Doanh thu/MRR/số dư**: aggregate SQL (SUM/COUNT FILTER, làm tròn bằng số nguyên basis point), không load giao dịch vào bộ nhớ.
- Thông báo (`notify`) chỉ phát sau khi transaction commit.

## Giới hạn hiện tại
- `MockGateway` là cổng giả (không có tiền thật; idempotent theo `idempotencyKey` như cổng thật).
- Số dư có thể rút = tiền đã qua holding period (`REFUND_WINDOW_DAYS` + dispute window) trừ rolling reserve và payout đã yêu cầu; hoàn tiền SAU payout ghi nợ (`OwnerBalanceLedger`) và chặn payout tới khi doanh thu mới bù. Chưa có đòi nợ tự động từ payout kế tiếp (chỉ chặn) và chưa có webhook dispute thật (`charge.dispute.*`).
- Scheduler chỉ tiến 1 kỳ mỗi lần chạy; nhiều instance an toàn nhờ `SKIP LOCKED` (nhưng lời gọi cổng nằm trong transaction của từng gói nên giữ khóa hàng trong thời gian gọi cổng).
- `POST /payments/:id/confirm` vẫn là "tự coi cổng đã xác nhận" cho FE hiện tại (MockGateway); với cổng thật, xác nhận đến từ webhook.
- Đổi giá cộng đồng chưa ảnh hưởng gói đang chạy (gói giữ `priceCents` lúc đăng ký). Hoàn tiền một phần chỉ qua Admin (batch 2).

## Chưa làm / cần quyết định
- Chốt cổng thanh toán (Stripe quốc tế hay PayOS/VNPay/MoMo) — PLAN câu hỏi #2.
- Mô hình doanh thu & tỉ lệ hoa hồng (#6), chính sách hoàn tiền (#8: cửa sổ 7 ngày là đề xuất), chu kỳ/ngưỡng payout (#9: hiện rút theo yêu cầu, tối thiểu $50).
- Thuế/VAT trên hóa đơn, PDF hóa đơn, thông tin pháp lý người bán.
- Email giao dịch (hiện chỉ thông báo trong app), retry gia hạn nhiều lần (dunning) thay vì hết hạn ngay.
- **[LỖI THỜI — đã bỏ 2026-10-14]** Dùng thử theo cộng đồng có thể cấu hình riêng (`pricing: 'trial'` trong seed chưa được dùng để giới hạn).
- FE: trang quản lý gói, lịch sử/hóa đơn, doanh thu — chưa làm (không thuộc phạm vi backend).

## Vòng đời tiền (audit STEP 2 — đã khóa bằng test `tests/money-lifecycle.test.ts`)
Mỗi kịch bản 3.x được viết thành test **trước khi sửa** và đã chạy thấy FAIL trên code cũ (11/14 test đầu fail), rồi mới sửa.

### 3.1 Double-charge (2 intent song song)
- `UNIQUE(userId, courseId) WHERE status IN ('trialing','active')` trên `Subscription` (index riêng trong migration `20261004100000_money_lifecycle_points`; migration dọn gói trùng sẵn có: giữ gói `active`/mới nhất, hủy phần thừa).
- `checkout` dùng khóa cố vấn `checkout:<user>:<course>` và **tái dùng intent `pending` chưa quá 30 phút** (`PENDING_INTENT_TTL_MS`); user có gói `active` còn hiệu lực → 409 (không trừ lần hai).
- `settle` chạy dưới khóa cố vấn `sub:<user>:<course>`, kiểm lại **trong transaction** (gói active / đã là thành viên không phải dùng thử). Trùng → giao dịch `failed` + `duplicate_charge`, caller gọi `gateway.refund(chargeId, amount, "void:<paymentId>")` ngoài transaction; bên thua `confirm` nhận 409, webhook/job không ném lỗi.
### 3.2 Không trừ tiền người bị kick/ban, cộng đồng xóa/khóa
- `lockNextDueSubscription` JOIN `Course`: bỏ qua cộng đồng `locked`/`moderationStatus=suspended`; cộng đồng đã xóa được trả về để **kết thúc gói** (không trừ). `processDueSubscriptions` thêm: bị cấm / không còn là thành viên → `canceled` không trừ tiền.
- Hook vòng đời (`paymentsService`): `endMembership` (kick, xóa cộng đồng → gói `canceled` ngay, thông báo "Gói thành viên đã kết thúc… không bị tính phí thêm"), `stopRenewals` (ban, khóa/đình chỉ → `cancelAtPeriodEnd`, thông báo "sẽ không được gia hạn"), `endAllForCommunity(courseId, mode)` (gọi từ `communities.service` remove/lock và `admin-communities` suspend/delete).
- `checkout`/`confirm`/`adminRetryPayment`/`requestPayout` → 403 `COMMUNITY_LOCKED`; cộng đồng **riêng tư** chỉ cho mua khi đã có join request `approved` (lời mời cộng đồng riêng tư có phí ghi sẵn 1 request approved) hoặc đang là thành viên.
### 3.3 "Rời cộng đồng"
- **Quyết định**: rời = xóa Enrollment ngay (mất truy cập ngay như cũ) **và** hủy gói **cuối kỳ** (`cancelAtPeriodEnd`) — không bị trừ kỳ sau, nhưng tiền kỳ đã trả không bị mất: `POST /courses/:id/enroll` khi gói còn hiệu lực cho **vào lại không 402, không trả tiền, không đổi kỳ** (kể cả riêng tư/có phí). Không tự bỏ `cancelAtPeriodEnd` khi vào lại (muốn tiếp tục gia hạn gọi `/subscription/resume`).
- Ban = dừng gia hạn + gỡ quyền; **gỡ cấm khi gói còn hạn trả lại quyền** (không trừ lần hai, không reset kỳ). Kick/xóa cộng đồng = kết thúc gói ngay (kick xong user vẫn tự `checkout` lại được — kick không phải ban).
- `recordRenewal` cấp lại quyền (`grantAccess` trừ người bị cấm).
### 3.4 Hoàn tiền 2 pha + đối soát
- `PaymentGateway.refund(chargeId, amountCents, idempotencyKey)`; `MockGateway` dedupe theo key (+ `refundedTotal(chargeId)` cho test). Key = `RefundRequest.id`.
- tx1: yêu cầu `pending → refunding` (khóa độc quyền, bên thua 409) · gọi cổng **ngoài transaction** · tx2: Payment `succeeded → refunded`, yêu cầu `→ approved` (+`gatewayRefundId`), thu hồi quyền, ghi nợ owner nếu cần. Cổng từ chối → xóa yêu cầu tự tạo / về `pending` (502). Lỗi giữa chừng → giữ `refunding`.
- `reconcileStuckRefunds({olderThanMs})`: gọi lại cổng cùng key rồi chốt. `reconcileMoney()` (scheduler gọi mỗi 5 phút sau `processDueSubscriptions`) gom: hoàn tiền kẹt, charge chưa settle (`reconcileUnsettledCharges`), khoản trừ trùng chưa hoàn (`reconcileVoidedCharges`), webhook kẹt (`reapStaleWebhooks`).
### 3.5 Số dư owner
- Có thể rút = `max(0, min(eligible − reserve − requested, total))` với `eligible` = net của giao dịch đã qua `refundWindowDays + disputeWindowDays` (+ mọi net âm), `reserve = floor(eligible × payoutReservePct)`, `total = net − payout đã yêu cầu`. `total < 0` ⇒ `debtCents` và **chặn payout** (400 `PAYOUT_BLOCKED`). Hoàn tiền / chargeback thua xảy ra làm nợ tăng → ghi `OwnerBalanceLedger` (`refund_after_payout` | `chargeback_after_payout`, `amountCents < 0`). Giá trị 7 ngày + 7 ngày + 10% + $50 là **tạm, chờ owner chốt**; đều cấu hình được.
- Admin (additive): Creator Revenue có thêm `withdrawableCents, heldCents, reserveCents, debtCents` (list, summary, detail, communities[]); Payout detail `creatorBalance` có thêm `withdrawableCents, heldCents, reserveCents, debtCents, holdDays` (`availableCents` giữ nghĩa cũ net−requested); Refunds summary có `refunding`.
### P1 (§6.1)
- **Deadlock settle ↔ scheduler**: thứ tự khóa thống nhất *advisory → Subscription → Payment → (Subscription/Enrollment) → số hóa đơn (InvoiceSequence) cuối cùng*; scheduler dùng `SKIP LOCKED` nên không chờ settle.
- **Charge xong settle lỗi**: `gatewayChargeId` được ghi vào Payment ngay sau khi cổng trừ tiền (trước `settle`); `reconcileUnsettledCharges` hoàn tất giao dịch `pending` có `gatewayChargeId`.
- **Webhook**: `claimWebhookEvent` atomic (`INSERT` hoặc `UPDATE ... WHERE status IN (failed,received) OR processing quá 2 phút`). `duplicate:true` chỉ khi `done` hoặc đang `processing` còn mới; lỗi xử lý → `failed` + `lastError` (không còn xóa/nuốt); `reapStaleWebhooks` replay từ `payload` (tối đa 8 lần).

## Gói năm, báo giá, (dùng thử có thẻ — ĐÃ BỎ 2026-10-14), gói hosting owner, payout account (2026-10-07)
Hợp đồng chi tiết: `docs/api/community-wizard.md` (mục 3–6). Test: `tests/annual-subscription.test.ts`, `tests/community-wizard.test.ts`.

| Method · Path | Auth | Body / Query | Ghi chú |
|---|---|---|---|
| `GET /communities/:id/checkout-quote?interval=` | tùy chọn | `interval=monthly\|annual` | Mọi số/ngày do server tính: `plans[]`, `trialDays`, `firstChargeDate/Amount`, `remindAt`, `dueTodayUsd`. 400 `COMMUNITY_FREE`/`INTERVAL_UNAVAILABLE` |
| `POST /communities/:id/checkout` | login | `{ method?='stripe', interval?='monthly', paymentMethod? }` + `Idempotency-Key` | Số tiền theo `interval` do server quyết; intent pending chỉ được tái dùng khi CÙNG `interval` + số tiền |
| ~~`POST /communities/:id/trial`~~ | | **[LỖI THỜI — đã bỏ 2026-10-14]** Đã xóa (404). Cũ: `{ interval?, paymentMethod? }` | Có thẻ ⇒ hết thử tự trừ (cổng giả lập) rồi `active`; 400 `TRIAL_NOT_AVAILABLE` nếu cộng đồng tắt thử |
| `GET /me/payment-methods` | login | | Chỉ `brand/last4/expMonth/expYear` |
| `GET /owner-plans`, `GET\|PUT /communities/:id/hosting-plan` | — / owner | `{ planKey, cycle?, paymentMethod? }` | **MÔ PHỎNG** (A16) |
| `GET\|PUT /communities/:id/payout-account`, `POST …/payout-account/skip` | owner | `{ bankName, accountHolder, accountNumber }` | **MÔ PHỎNG**; chỉ lưu 4 số cuối |

Quyết định thiết kế:
- `Subscription.interval` + `Payment.interval`: `monthly` = `payments.subscriptionPeriodDays` (30), `annual` = `payments.annualPeriodDays` (365). `priceCents` của gói = số tiền MỖI KỲ (gói năm = giá cả năm). Mọi luồng giữ nguyên: unique index "1 gói sống/user/cộng đồng", advisory lock + thứ tự khóa Subscription→Payment→số hóa đơn, chống trừ trùng (void + hoàn), rời cộng đồng = hủy cuối kỳ (vào lại được tới hết năm), hoàn tiền trong cửa sổ (kể cả toàn bộ giá năm) thu hồi quyền. MRR của gói năm = `priceCents / 12`. Hệ thống không có proration (hoàn tiền là cả khoản hoặc admin duyệt một phần) nên chu kỳ không ảnh hưởng tới hoàn tiền.
- **Thẻ**: client tokenize (mock `tok_mock_*`; sau này Stripe Elements → PaymentMethod id). Body `paymentMethod` là object STRICT (field lạ như `number`/`cvc` ⇒ 400), kiểm brand/last4/hạn dùng. DB chỉ có `PaymentCard{brand,last4,expMonth,expYear,gatewayToken}`; token cổng không ra API. Cổng giả lập: token `tok_mock_declined` luôn bị từ chối (để test).
- **[LỖI THỜI — đã bỏ 2026-10-14]** **Dùng thử có thẻ** (`processDueSubscriptions`): hết kỳ thử + có `paymentCardId` + chưa hủy + còn là thành viên ⇒ `createCharge` (idempotencyKey `<subId>:trial-end`) → ghi Payment `initial` + hóa đơn, gói `active` (kỳ theo `interval`, tính từ cuối thử); thẻ bị từ chối ⇒ Payment `failed` + gói `expired` + thu hồi quyền + thông báo. Kết quả job có thêm `trialsConverted`.
- **Email nhắc trước ngày trừ tiền đầu** (chỉ còn áp dụng cho gói `trialing` cũ; `payments.trialReminderDays`=3): job `payments.trialReminders` (15 phút) → `sendTrialReminders`; claim nguyên tử `UPDATE … trialReminderSentAt IS NULL … FOR UPDATE SKIP LOCKED` TRƯỚC khi gửi ⇒ đúng 1 lần/gói dù chạy lặp/song song (mail lỗi thì không gửi lại). Gửi qua `mailService` (dev: `GET /dev/outbox`) + thông báo trong app. Không nhắc gói đã hủy hoặc không có thẻ.
- **Payout**: `PayoutAccount.status='skipped'` ⇒ `POST /communities/:id/payouts` trả 400 `PAYOUT_ACCOUNT_REQUIRED`; `connected` ⇒ `method` trong body tùy chọn. Cộng đồng không có bản ghi (tạo kiểu cũ) giữ luồng cũ.
- **Gói hosting owner**: giá/ngày thử/phí hiển thị ở Global Settings `owner.*`; `HostingPlan` lưu giá chụp + mốc dùng thử (một lần/cộng đồng). **Không có job/cổng trừ tiền khi hết thử** (`mock:true`). `owner.requirePlan` (mặc định false) bắt buộc chọn gói mới publish được.
- Tiền gói thành viên USD, gói hosting owner theo `owner.currency` (mặc định VND, số nguyên) — chưa thống nhất 1 đơn vị tiền (xem A16).

Chạy test: `npm test` dùng `--test-concurrency=16` vì Postgres local `max_connections=100` — ~38 file test chạy hết song song, mỗi file một pool kết nối, sẽ gặp "too many clients".

Chưa làm / cần quyết định: trừ tiền thật gói owner; đổi chu kỳ (tháng↔năm) của gói đang sống; nâng/hạ cấp có proration; thẻ hết hạn trước ngày gia hạn (chỉ biết khi cổng từ chối); xóa thẻ đã lưu.

## Mua lẻ module trả phí (2026-10-13)
Một cộng đồng có thể MIỄN PHÍ nhưng có module `accessMode='paid'` + `priceCents`. Mua module = thanh toán MỘT LẦN cho riêng module đó (không tạo `Subscription`, không đổi `Enrollment`). Tái dùng nguyên hạ tầng thanh toán: thẻ tokenise mock, `Payment`/idempotency, cổng, hóa đơn `INV-…`, hoàn tiền, doanh thu owner (hoa hồng + phí cổng + holding/reserve tính từ bảng `Payment` nên giao dịch module tự được tính). Test: `tests/module-purchase.test.ts`. Migration `20261013100000_module_purchase` (chỉ thêm: `PaymentKind.module`, `Payment.moduleId` + FK `SET NULL` + index).

| Method · Path | Auth | Body / Query | Ghi chú |
|---|---|---|---|
| `GET /communities/:id/modules/:moduleId/purchase-quote` | login | — | `{communityId, moduleId, title, currency:'USD', priceCents, priceUsd, oneTime:true, provider, canPurchase, blocked, owned}`. Lỗi điều kiện mua KHÔNG ném mà trả `blocked` (`JOIN_REQUIRED` \| `ALREADY_OWNED` \| `STAFF_EXEMPT` \| `FORBIDDEN` = bị cấm). 400 `MODULE_NOT_PAID`, 403 `COMMUNITY_LOCKED`, 404 |
| `POST /communities/:id/modules/:moduleId/purchase` | login + email đã xác thực | `{ paymentMethod?, idempotencyKey? }` (hoặc header `Idempotency-Key`; body ưu tiên) | Tạo intent `kind='module'` (giá do server lấy từ module) → trừ tiền → cấp `ModuleAccess(source='purchase')` + hóa đơn + thông báo "Bạn đã mở khóa module". 201 `Payment` (`status:'succeeded'`, `moduleId`, `invoiceNumber`) |

Lỗi của `POST`: 400 `MODULE_NOT_PAID` (module không `paid`/giá ≤ 0); 402 `PAYMENT_FAILED` (thẻ bị từ chối — không cấp quyền, giao dịch `failed`); 403 `JOIN_REQUIRED` (chưa là thành viên: cộng đồng miễn phí cũng phải tham gia trước, không tự ghi danh), 403 (bị cấm), 403 `COMMUNITY_LOCKED`; 404 (module không có/không thuộc cộng đồng/chưa xuất bản); 409 `ALREADY_OWNED` (đã có quyền — kể cả owner cấp tay); 409 `STAFF_EXEMPT` (owner/admin/mod/platform admin không cần mua).

Quyết định thiết kế:
- Idempotency: cùng key ⇒ trả lại đúng giao dịch (không trừ lần 2; key đã fail ⇒ 402; key dùng cho module khác ⇒ 409). Không key: advisory lock `module:<user>:<module>` ⇒ 2 request song song dùng chung 1 intent pending; cổng nhận `idempotencyKey = payment.id`. `POST /payments/:id/confirm` cũng chốt được intent module (dùng chung nhánh).
- `settle` rẽ nhánh `settleModule`: pending→succeeded → `ModuleAccess` (idempotent) → số hóa đơn (cuối cùng). Đã sở hữu lúc chốt (đua) ⇒ void `duplicate_charge` + hoàn tiền cổng + 409 `ALREADY_OWNED`. Bị cấm giữa chừng: ghi nhận thanh toán nhưng không cấp quyền (như gói thành viên).
- Hoàn tiền (khách trong cửa sổ, admin duyệt/hoàn trực tiếp, chargeback thua): hoàn TOÀN BỘ ⇒ xóa `ModuleAccess` có `source='purchase'` (quyền owner cấp tay `selected` giữ nguyên); hoàn một phần giữ quyền. Không đụng `Subscription`/`Enrollment`. `PUT …/access` của owner không còn xóa dòng `purchase`.
- Liệt kê: `GET /me/payments` thêm `moduleTitle` cho giao dịch module; hóa đơn có dòng `Module "<tên>" — <cộng đồng>`; `latestPayment` của `/subscription` bỏ qua giao dịch module; Admin payments: `kind` lọc thêm `module`, `product = {type:'module', label:'Module · <tên>'}`; analytics `byPlan` thêm `module`.
- Chưa làm: email biên nhận (luồng hiện tại cũng không gửi email biên nhận khi thanh toán); thông báo riêng cho owner khi có người mua; chọn lại thẻ đã lưu (checkout hiện chỉ nhận thẻ mới tokenise).

## Quản lý thẻ & tổng quan thanh toán (Cài đặt > Thanh toán, 2026-10-08)
Code: `src/modules/payments/payments.cards.ts`, route trong `payments.routes.ts`. Test: `tests/payment-cards.test.ts`. Body thẻ = `paymentMethodInput` (STRICT, token + brand/last4/hạn — không có số thẻ/CVC; **Luhn chỉ kiểm được ở client** vì server không bao giờ thấy PAN, server kiểm định dạng token/brand/last4 và hạn dùng).

| Method · Path | Body | Response | Lỗi |
|---|---|---|---|
| `GET /me/payment-methods` | | `SavedCard[]` = `{ id, brand, last4, expMonth, expYear, createdAt, isDefault }` (mặc định đứng đầu) | |
| `POST /me/payment-methods` | `PaymentMethodInput` | 201 `SavedCard` (thẻ đầu tiên là mặc định; thẻ sau không đổi mặc định) | 400 thẻ hết hạn/trường lạ/token sai, 400 `CARD_LIMIT` (tối đa 10), 409 `CARD_EXISTS` (trùng token hoặc trùng brand+4 số+hạn) |
| `PUT /me/payment-methods/:id` | `PaymentMethodInput` | `SavedCard` — thay thông tin của đúng thẻ này ("Cập nhật thẻ"), giữ id/vị trí mặc định/gói đang gắn | 404, 409 `CARD_EXISTS`, 400 |
| `PATCH /me/payment-methods/:id/default` | | `SavedCard[]` đã sắp xếp; gói đang sống chưa hủy chuyển sang thẻ này để gia hạn | 404 |
| `DELETE /me/payment-methods/:id` | | `SavedCard[]` còn lại | 404, 409 `CARD_IN_USE` |
| `GET /me/billing-summary` | | `{ currency:'USD', next: { amountCents, date, communityId, communityTitle, trialing } \| null, monthlyTotalCents, activeCount }` | |

- **Thẻ mặc định** = thẻ có `createdAt` **mới nhất** (bảng `PaymentCard` chưa có cột `isDefault`, schema đã đóng băng). "Đặt làm mặc định" nâng `createdAt` lên hiện tại; thẻ thêm sau ở Cài đặt được lùi `createdAt` để không chiếm mặc định; thẻ vừa nhập ở thanh toán/dùng thử (`upsertCard`) tự thành mặc định. Nếu cần ngữ nghĩa sạch hơn: thêm cột `isDefault` (cần migration).
- **Xóa thẻ**: gói đang sống **và chưa đặt hủy cuối kỳ** (`trialing|active`) cùng gói hosting `pro` đang chạy được coi là "đang dùng thẻ". Còn thẻ khác → chuyển các gói đó sang thẻ mặc định còn lại rồi xóa; thẻ cuối cùng mà gói còn cần → 409 `CARD_IN_USE` (thêm thẻ khác hoặc hủy gói trước). Gói đã hủy cuối kỳ không cần thẻ. Giao dịch cũ chỉ mất liên kết thẻ (FK SetNull), lịch sử/hóa đơn giữ nguyên.
- `GET /me/billing-summary`: chỉ tính gói `trialing|active` chưa hủy cuối kỳ. `next` = gói có `currentPeriodEnd` sớm nhất (gói dùng thử: lần trừ đầu là lúc hết dùng thử, `trialing:true`). `monthlyTotalCents` quy gói năm về /12 (`round(priceCents/12)`).
- `GET /me/payments` thêm `refundStatus` (`pending|refunding|approved|rejected|null`) — trạng thái yêu cầu hoàn tiền mới nhất của giao dịch (thay cho việc FE nhớ bằng localStorage).
- Hook hoa hồng giới thiệu chạy sau commit của `settle`/`recordRenewal`/`applyRefund` — xem `docs/api/referrals.md`. `inTx` giờ `await` các callback sau commit.
