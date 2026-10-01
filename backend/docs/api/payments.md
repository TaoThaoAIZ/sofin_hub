# API Thanh toán, gói thành viên, hoàn tiền, doanh thu (Phase 8)

Code: `src/modules/payments/*`. Test: `tests/payments.test.ts`, `tests/revenue.test.ts`, **`tests/money-lifecycle.test.ts`** (5 kịch bản tiền của audit §3 + P1 — xem mục "Vòng đời tiền" cuối file). Dữ liệu lưu **Postgres (Prisma)** qua
`PaymentsRepository` (bảng Payment, Subscription, RefundRequest, Payout, InvoiceSequence, IdempotencyKey, WebhookEvent, OwnerBalanceLedger). Mọi số tiền là **số nguyên cent** (`*Cents`); `amountUsd` chỉ giữ để tương thích FE cũ.
Response thành công `{ data }` (danh sách: `{ data, meta }`). Lỗi tiếng Việt `{ error... }` theo error-handler chung.

## Endpoint

| Method | Path | Auth / Role | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | `/courses/:id/checkout` | đăng nhập | `{method}`; header tùy chọn `Idempotency-Key` | 201 `PaymentIntent` (cũ + `amountCents, kind, invoiceNumber?...`) | 400 miễn phí/body sai, 403 `COMMUNITY_LOCKED` (cộng đồng bị khóa) / `JOIN_REQUEST_REQUIRED` (riêng tư chưa được duyệt), 404, 409 đã tham gia / gói còn hiệu lực / key dùng cho khóa khác. **Tái dùng intent `pending` chưa quá 30 phút** của cùng (user, cộng đồng) |
| GET | `/courses/:id/subscription` | đăng nhập | | `{enrolled, latestPayment, subscription}` (2 field đầu là cũ) | 404 |
| POST | `/payments/:id/confirm` | chủ giao dịch | | `PaymentIntent` | 402 cổng từ chối, 403 (kể cả cộng đồng bị khóa), 404, 409 (đã có gói — khoản trừ trùng được hoàn tự động) |
| POST | `/courses/:id/subscription/cancel` | thành viên có gói | `{atPeriodEnd=true}` | `Subscription` | 400, 404 chưa có gói |
| POST | `/courses/:id/subscription/resume` | thành viên có gói | | `Subscription` | 404, 409 chưa hủy / đã hết kỳ |
| GET | `/me/subscriptions` | đăng nhập | | `Subscription[]` (+ `courseTitle, accessUntil`) | |
| POST | `/courses/:id/trial` | đăng nhập | | 201 `Subscription` (`trialing`) | 400 khóa miễn phí, 403 bị cấm / cộng đồng khóa / riêng tư chưa được duyệt, 404, 409 đã tham gia / có gói / đã dùng thử |
| GET | `/me/payments` | đăng nhập | `page, limit(<=100)` | `{data, meta}` | 400 |
| GET | `/payments/:id/invoice` | chủ giao dịch, Owner cộng đồng đó, Platform Admin | | hóa đơn JSON: `invoiceNumber (INV-2026-000123), issuedAt, status, buyer, community, items[], subtotalCents, refundedCents, totalCents` | 403, 404, 409 chưa có hóa đơn |
| POST | `/payments/:id/refund-request` | chủ giao dịch | `{reason}` | 201 `RefundRequest` (`approved` nếu trong cửa sổ, ngược lại `pending`) | 400, 403, 404, 409 |
| GET | `/admin/refunds` | Platform Admin | `status?, page, limit` | `{data, meta}` | 401, 403 |
| PATCH | `/admin/refunds/:id` | Platform Admin | `{action:'approve'\|'reject', note?}` | `RefundRequest` | 403, 404, 409 đã xử lý |
| POST | `/payments/webhook` | không đăng nhập; chữ ký HMAC | JSON `{id, type, data}` + header `x-sofin-signature` | 200 `{received:true[, duplicate\|ignored]}` | 400 chữ ký sai/hết hạn/thiếu (không nêu chi tiết) |
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
- **Dùng thử**: `TRIAL_DAYS` (mặc định 7), 1 lần/user/cộng đồng, cấp quyền ngay, không thu tiền. Đang dùng thử vẫn `checkout` + `confirm` được → chuyển thành `active` (kỳ mới từ lúc trả tiền).
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
- Dùng thử theo cộng đồng có thể cấu hình riêng (`pricing: 'trial'` trong seed chưa được dùng để giới hạn).
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
- `checkout`/`confirm`/`startTrial`/`adminRetryPayment`/`requestPayout` → 403 `COMMUNITY_LOCKED`; cộng đồng **riêng tư** chỉ cho mua/dùng thử khi đã có join request `approved` (lời mời cộng đồng riêng tư có phí ghi sẵn 1 request approved) hoặc đang là thành viên.
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
