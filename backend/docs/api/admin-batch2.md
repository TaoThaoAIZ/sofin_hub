# API Admin (đợt 2): Content · Payments · Discovery

> Trạng thái: **ĐÃ TRIỂN KHAI** (24 test tích hợp ở `tests/admin-batch2.test.ts`). Khác biệt so với bản công bố đầu nằm ở mục cuối file; nội dung các bảng bên dưới đã được cập nhật đúng thực tế.
> Quy ước chung giống `docs/api/admin.md`: mọi route yêu cầu `Authorization: Bearer <token>` của Platform Admin (401 / 403), `{ data }` hoặc `{ data, meta:{page,limit,total,totalPages} }`,
> tiền = **cent** (`*Cents`, Int), thời điểm ISO UTC, lỗi `{ error:{ code, message, details? } }` (400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 409 `CONFLICT`).
> Tài khoản thử: `admin@sofinhub.test` / `Passw0rd!x`. Mọi thao tác ghi (POST/PATCH/DELETE) ghi 1 dòng `AdminAuditLog` (xem `GET /admin/audit-logs?targetType=...`).
> Query chung: `q` (tìm), `page` (>=1), `limit` (1..100, mặc định 20), `sort`. Tham số lọc dạng danh sách dùng dấu phẩy: `status=hidden,removed`. Giá trị lạ -> 400.
> `reason` = chuỗi bắt buộc (1..500) với hành động "tiêu cực" (hide/remove/cancel/reject/hold/...). `note` tuỳ chọn (<=2000).

Cấu trúc nhỏ dùng lại:
```json
Person  = { "id": "uuid", "name": "Sarah Kim", "email": "sarah@x.com", "avatarUrl": null }
Ref     = { "id": "photo", "name": "Nhiếp ảnh" }          // cộng đồng
```

---------------------------------------------------------------------------------------------------
# A. CONTENT — `/api/admin/content/*`
Trạng thái nội dung (`status`): `published | hidden | removed`. `hidden` = bị ẩn khỏi thành viên thường (mod cộng đồng vẫn thấy), `removed` = gỡ hẳn khỏi API công khai (chỉ admin thấy). Hành động hợp lệ:
`hide: published→hidden` · `remove: published|hidden→removed` · `restore: hidden|removed→published`; sai trạng thái -> 409. Tác giả được thông báo (`notify`) khi hide/remove (tắt bằng `notifyAuthor:false`).

## A1. Posts
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/content/posts/summary` | — | `{ data: { total, today, reported, removed, hidden } }` (`reported` = bài có báo cáo đang mở) |
| GET | `/admin/content/posts` | `q` (nội dung/tác giả/mã POST-xxxx), `status` (csv `published,hidden,removed,under_review`; `under_review` = published + có báo cáo mở), `courseId`, `authorId`, `sort` (`newest|oldest|engagement|reports`, mặc định newest), `page`, `limit` | `{ data: AdminPost[], meta }` |
| GET | `/admin/content/posts/:id` | — | `{ data: AdminPostDetail }` |
| POST | `/admin/content/posts/:id/hide` | `{ reason, note?, notifyAuthor? }` | `AdminPost` |
| POST | `/admin/content/posts/:id/remove` | `{ reason, note?, notifyAuthor? }` | `AdminPost` |
| POST | `/admin/content/posts/:id/restore` | `{ note? }` | `AdminPost` |
| POST | `/admin/content/posts/bulk` | `{ action: "hide"\|"remove"\|"restore", ids: string[] (1..100), reason? (bắt buộc với hide/remove) }` | `{ data: { updated: 3, skipped: [{ id, reason }] } }` |

```json
AdminPost = { "id": "uuid", "code": "POST-3FA2B1C4", "title": "excerpt 80 ký tự…", "excerpt": "…", "category": "general",
  "author": Person, "community": Ref, "likes": 3, "comments": 5, "engagement": 8, "reports": 2, "underReview": true,
  "status": "published", "pinned": false, "imageUrl": null, "hasPoll": false,
  "moderationReason": null, "moderatedAt": null, "moderatedBy": null, "createdAt": "…" }
AdminPostDetail = { ...AdminPost, "content": "toàn văn", "tags": [], "thread": [ { "id","author": Person,"text","status","createdAt" } ] /* tối đa 20 */,
  "reportList": [ { "id","caseCode":"CASE-00012","reason","status","reporter": Person,"createdAt" } ], "history": [ AdminAuditLogItem ×10 ] }
```
(`reports` = số báo cáo đang `open|under_review` về bài này.)

## A2. Comments
Giống Posts, đường dẫn `/admin/content/comments[...]` (summary, list, :id, hide, remove, restore, bulk).
`AdminComment = { id, code: "CMT-xxxxxxxx", title (excerpt), excerpt, author: Person, post: { id, title }, community: Ref, reports, underReview, status, moderationReason, moderatedAt, moderatedBy, createdAt }`.
List query thêm `postId`. Detail thêm `content`, `reportList`, `history`.

## A3. Courses (khóa học = entity `Course`, bảng `LearningCourse`; trước STEP 6 là `ClassroomModule`)

> Đổi nguồn dữ liệu sang entity Khóa học mới (xem [communities-courses.md](./communities-courses.md) §5). `id` = id khóa học; `courseId=` (legacy) = id **cộng đồng**, thêm `communityId=`; `AdminCourse` thêm `modules`; detail thêm `moduleList`; `/admin/content/lessons` thêm lọc `learningCourseId`. Hành động publish/unpublish/archive/remove/restore + audit `course.*` giữ nguyên, nhưng tác động lên khóa học (gỡ khóa ⇒ thành viên không thấy khóa và module bên trong).
Trạng thái: `published | draft | archived | removed` (`removed` độc lập với xuất bản; restore bỏ cờ gỡ và giữ nguyên published/draft/archived trước đó).
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/content/courses/summary` | — | `{ data: { total, published, draft, archived, removed } }` |
| GET | `/admin/content/courses` | `q`, `status` (csv), `courseId` (cộng đồng), `sort` (`newest|oldest|students|lessons|title`), page, limit | `{ data: AdminCourse[], meta }` |
| GET | `/admin/content/courses/:id` | — | `{ data: AdminCourse & { description, lessonList: [{ id, title, type, durationMin, status }], history } }` |
| POST | `/admin/content/courses/:id/publish` | `{ note? }` | `draft|archived → published` |
| POST | `/admin/content/courses/:id/unpublish` | `{ reason, note?, notifyAuthor? }` | `published → draft` (thành viên thường không còn thấy) |
| POST | `/admin/content/courses/:id/archive` | `{ reason?, note? }` | `published|draft → archived` |
| POST | `/admin/content/courses/:id/remove` | `{ reason, note?, notifyAuthor? }` | gỡ (mọi trạng thái trừ đã removed) |
| POST | `/admin/content/courses/:id/restore` | `{ note? }` | bỏ cờ removed |
```json
AdminCourse = { "id","title","thumbnail","community": Ref,"creator": Person|null,"students": 120,"lessons": 8,"completionPct": 42,
  "reports": 0,"status":"published","moderationReason":null,"moderatedAt":null,"createdAt":"…" }
```

## A4. Lessons (`ClassroomLesson`)
Trạng thái: `published | hidden | removed`.
| GET | `/admin/content/lessons/summary` | — | `{ total, published, hidden, removed }` |
|---|---|---|---|
| GET | `/admin/content/lessons` | `q`, `status`, `type` (`video|text|file`), `courseId` (cộng đồng), `moduleId`, `sort` (`newest|views|title`) | `{ data: AdminLesson[], meta }` |
| GET | `/admin/content/lessons/:id` | — | `AdminLesson & { body, videoUrl, embedUrl, attachments, history }` |
| POST | `/admin/content/lessons/:id/hide` · `/remove` · `/restore` | như Posts | `AdminLesson` |
```json
AdminLesson = { "id","code":"LSN-xxxxxxxx","title","type":"video","durationMin":12,"module": { "id","title" },"community": Ref,
  "views": 340 /* số học viên đã hoàn thành */,"reports": 0,"status":"published","moderationReason":null,"moderatedAt":null,"createdAt":"…" }
```

## A5. Events (`CommunityEvent`)
Trạng thái: `upcoming | live | completed | cancelled | removed` (`live` = đã bắt đầu trong 2 giờ gần nhất; `cancelled`/`removed` thắng).
| GET | `/admin/content/events/summary` | — | `{ total, upcoming, live, completed, cancelled }` |
|---|---|---|---|
| GET | `/admin/content/events` | `q`, `status` (csv), `courseId`, `sort` (`startAt|newest`), page, limit | `{ data: AdminEvent[], meta }` |
| GET | `/admin/content/events/:id` | — | `AdminEvent & { description, rsvps: [Person ×50], history }` |
| PATCH | `/admin/content/events/:id` | `{ title?, description?, startAt?, meetingLink?|null, capacity?|null, note? }` | `AdminEvent` (409 nếu `capacity` < số RSVP) |
| POST | `/admin/content/events/:id/cancel` | `{ reason, notifyAttendees? = true }` | `upcoming|live → cancelled`; thông báo toàn bộ người đã RSVP; không RSVP thêm được |
| POST | `/admin/content/events/:id/remove` | `{ reason, notifyAttendees? }` | gỡ khỏi API công khai |
| POST | `/admin/content/events/:id/restore` | `{ note? }` | `cancelled|removed → trạng thái theo giờ` |
```json
AdminEvent = { "id","title","community": Ref,"host": Person,"attendees": 12,"capacity": null,"startAt":"…","timezone":"Asia/Ho_Chi_Minh",
  "meetingLink": null,"location":"Online","status":"upcoming","cancelReason":null,"reports":0,"createdAt":"…" }
```

## A6. Media (`Upload` đã tải xong)
Trạng thái: `active | flagged | removed`. `kind`: `image | video | document | audio` (suy từ contentType; hiện chưa có audio thật).
| GET | `/admin/content/media/summary` | — | `{ total, totalSizeBytes, flagged, removed, byKind: { image, video, document, audio } }` |
|---|---|---|---|
| GET | `/admin/content/media` | `q` (tên file/chủ), `kind`, `status`, `purpose`, `courseId`, `ownerId`, `sort` (`newest|size|name`) | `{ data: AdminMedia[], meta }` |
| GET | `/admin/content/media/:key` | — | `{ data: AdminMedia & { history } }` |
| GET | `/admin/content/media/:key/download` | — | stream file gốc (kể cả file đã removed); 404 nếu file không còn trong storage |
| POST | `/admin/content/media/:key/flag` | `{ reason }` | `active → flagged` |
| POST | `/admin/content/media/:key/unflag` | `{ note? }` | `flagged → active` |
| POST | `/admin/content/media/:key/remove` | `{ reason, notifyOwner? }` | `/api/files/:key` trả 404 từ lúc này |
| POST | `/admin/content/media/:key/restore` | `{ note? }` | `removed → active` |
```json
AdminMedia = { "key":"abc…jpg","filename":"cover.png","kind":"image","contentType":"image/png","size":1258291,"purpose":"post_image",
  "owner": Person,"community": Ref|null,"url":"/api/files/abc…jpg" /* null khi removed */,"status":"active","flagged":false,"flagReason":null,
  "reports": 0 /* = 1 nếu flagged */,"moderatedAt":null,"uploadedAt":"…" }
```

---------------------------------------------------------------------------------------------------
# B. PAYMENTS — `/api/admin/payments/*`
Mã hiển thị: tiền tố + 8 ký tự đầu của uuid viết hoa (`TXN-3FA2B1C4`, `SUB-…`, `RF-…`, `PO-…`, `POST-…`, `CMT-…`, `LSN-…`); chargeback dùng số tăng dần `CB-00771`. Ô `q` của các danh sách nhận chính mã này. `platformFeeCents` = hoa hồng nền tảng (`PLATFORM_COMMISSION_PCT`, hiện 10% trên phần chưa hoàn); `gatewayFeeCents` = phí cổng (`GATEWAY_FEE_PCT` + cố định); `creatorEarningsCents = amount − refunded − platformFee − gatewayFee` (0 nếu giao dịch chưa thành công).
Giá trị mock/tạm: hoa hồng, phí cổng, cửa sổ hoàn tiền (xem PLAN.md câu hỏi chưa quyết).

## B1. Transactions (`Payment`)
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/payments/transactions/summary` | `from?`, `to?` (ISO/ngày) | `{ data: { grossVolumeCents, netRevenueCents /* tổng hoa hồng nền tảng */, transactions, failed, failedRatePct, refundsCents } }` |
| GET | `/admin/payments/transactions` | `q` (mã TXN, INV, email/tên khách, cộng đồng, gatewayChargeId), `status` (csv `succeeded,failed,pending,refunded`), `method` (`stripe|vnpay|momo`), `courseId`, `userId`, `ownerId`, `kind` (`initial|renewal`), `from`, `to`, `sort` (`newest|oldest|amount`), page, limit | `{ data: AdminTransaction[], meta }` |
| GET | `/admin/payments/transactions/:id` | — | `{ data: AdminTransactionDetail }` |
| POST | `/admin/payments/transactions/:id/refund` | `{ reason, amountCents? (mặc định phần còn lại; <= còn lại), note? }` | `{ data: { transaction: AdminTransaction, refund: AdminRefund } }` — chỉ `succeeded` (409 nếu khác); hoàn qua cổng (mock), thu hồi quyền truy cập nếu hoàn toàn bộ kỳ hiện tại |
| POST | `/admin/payments/transactions/:id/retry` | `{ note? }` | `AdminTransaction` — chỉ `failed` + `kind=initial`; chạy lại cổng (mock): thành công → `succeeded` (kích hoạt gói), thất bại → vẫn `failed` |
```json
AdminTransaction = { "id","code":"TXN-3FA2B1C4","invoiceNumber":"INV-2026-000012"|null,"customer": Person,"community": { "id","name","ownerName" },
  "product": { "type":"membership","label":"Membership · Monthly" /* | "Membership · Renewal" */ },
  "kind":"initial","method":"stripe","paymentMethodLabel":"Stripe","currency":"usd",
  "amountCents":4900,"refundedCents":0,"platformFeeCents":490,"gatewayFeeCents":172,"creatorEarningsCents":4238,
  "status":"succeeded","failureReason":null,"subscriptionId":null,"createdAt":"…","confirmedAt":"…" }
AdminTransactionDetail = { ...AdminTransaction, "gatewayChargeId": "mock_ch_…", "gateway": "Stripe (mock)",
  "customerInfo": { ...Person, "joinedAt","status" }, "creator": Person|null,
  "subscription": { "id","status","currentPeriodEnd" }|null,
  "refunds": [ AdminRefund ], "chargebacks": [ AdminChargeback ],
  "timeline": [ { "type":"payment_captured|payment_failed|refunded|chargeback|checkout","title","detail","at" } ],
  "history": [ AdminAuditLogItem ] }
```

## B2. Subscriptions
Trạng thái: `trialing | active | past_due | paused | canceled | expired`; thêm cờ `cancelAtPeriodEnd` (active nhưng sẽ không gia hạn).
| GET | `/admin/payments/subscriptions/summary` | — | `{ data: { active, new30d, mrrCents, churnPct /* canceled+expired 30d / (active+đó) */, pastDue, paused } }` |
|---|---|---|---|
| GET | `/admin/payments/subscriptions` | `q` (mã SUB, user, cộng đồng), `status` (csv), `courseId`, `userId`, `sort` (`newest|amount|nextBilling`), page, limit | `{ data: AdminSubscription[], meta }` |
| GET | `/admin/payments/subscriptions/:id` | — | `AdminSubscription & { payments: [AdminTransaction ×10], history }` |
| POST | `/admin/payments/subscriptions/:id/pause` | `{ reason, note? }` | `trialing|active|past_due → paused`: thu hồi quyền truy cập, không gia hạn |
| POST | `/admin/payments/subscriptions/:id/resume` | `{ note? }` | `paused|past_due → active`: cấp lại quyền, mở kỳ mới nếu kỳ cũ đã hết |
| POST | `/admin/payments/subscriptions/:id/cancel` | `{ reason, atPeriodEnd? = false, note? }` | `atPeriodEnd=false`: `→ canceled` + thu hồi quyền; `true`: giữ `active`, `cancelAtPeriodEnd=true` |
```json
AdminSubscription = { "id","code":"SUB-3FA2B1C4","user": Person,"community": Ref,"plan":"paid|trial","amountCents":4900,"billingCycle":"monthly",
  "status":"active","cancelAtPeriodEnd":false,"currentPeriodStart","currentPeriodEnd","nextBillingAt":"…"|null,"trialEndsAt":null,"canceledAt":null,"createdAt":"…" }
```
Người dùng được thông báo khi pause/resume/cancel.

## B3. Refunds (giữ nguyên `GET /admin/refunds`, `PATCH /admin/refunds/:id`; thêm bản giàu dữ liệu)
Trạng thái: `pending` (mockup "Requests") · `approved` ("Completed") · `rejected`. (Không có "Processing": duyệt là hoàn ngay.)
| GET | `/admin/payments/refunds/summary` | — | `{ data: { pending, approved, rejected, pendingAmountCents, refundedAmountCents } }` |
|---|---|---|---|
| GET | `/admin/payments/refunds` | `q` (mã RF/TXN, khách, chủ), `status` (csv), `courseId`, `sort` (`newest|amount`), page, limit | `{ data: AdminRefund[], meta }` |
| GET | `/admin/payments/refunds/:id` | — | `AdminRefund & { payment: AdminTransaction, paymentHistory: [{ id, code, amountCents, status, createdAt }], customerHistory: { memberSince, previousRefunds: [{ id, amountCents, status, requestedAt }], reportsReceived }, creatorResponse: null, history }` (`creatorResponse` luôn null: chưa có tính năng chủ cộng đồng phản hồi) |
| POST | `/admin/payments/refunds/:id/approve` | `{ note?, amountCents? }` (hoàn một phần nếu < số tiền yêu cầu) | `AdminRefund` — `pending → approved`, hoàn qua cổng mock, thông báo khách |
| POST | `/admin/payments/refunds/:id/reject` | `{ reason, note? }` | `pending → rejected`, thông báo khách |
```json
AdminRefund = { "id","code":"RF-3FA2B1C4","paymentId","transactionCode":"TXN-…","customer": Person,"creator": Person|null,"community": Ref,
  "amountCents":4900,"paymentAmountCents":4900,"reason":"Charged twice","status":"pending","auto":false,"note":null,
  "requestedAt","resolvedAt":null,"resolvedBy": Person|null }
```

## B4. Chargebacks (**MÔ PHỎNG** — không tích hợp cổng; là bản ghi phía admin; bảng `Chargeback`)
Trạng thái: `open | under_review | won | lost`. Lý do: `fraudulent | product_not_received | duplicate | subscription_cancelled | unrecognized | product_not_as_described`.
| GET | `/admin/payments/chargebacks/summary` | — | `{ data: { open, underReview, won, lost, disputedAmountCents /* open+under_review */ } }` |
|---|---|---|---|
| GET | `/admin/payments/chargebacks` | `q` (mã CB, TXN, khách), `status` (csv), `reason`, `courseId`, `sort` (`deadline|newest|amount`), page, limit | `{ data: AdminChargeback[], meta }` |
| GET | `/admin/payments/chargebacks/:id` | — | `AdminChargeback & { payment: AdminTransaction, history }` |
| POST | `/admin/payments/chargebacks` | `{ paymentId, reason, amountCents?, deadlineDays? (1..30, mặc định 7) }` → 201 | giả lập "cổng báo có tranh chấp": chỉ giao dịch `succeeded`, tối đa 1 chargeback đang mở / giao dịch (409) |
| POST | `/admin/payments/chargebacks/:id/submit-evidence` | `{ note, evidenceUrls?: string[] }` | `open → under_review`, `evidence = "submitted"` |
| POST | `/admin/payments/chargebacks/:id/accept` | `{ note? }` | `open|under_review → lost` + hoàn tiền giao dịch (đánh dấu `refunded`, thu hồi quyền), không gọi cổng |
| POST | `/admin/payments/chargebacks/:id/mark-won` | `{ note? }` | `under_review → won` |
| POST | `/admin/payments/chargebacks/:id/mark-lost` | `{ note? }` | `under_review → lost` (+ hoàn tiền như accept) |
```json
AdminChargeback = { "id","code":"CB-00771","paymentId","transactionCode","customer": Person,"creator": Person|null,"community": Ref,
  "amountCents":9900,"reason":"fraudulent","status":"open","deadlineAt":"…","daysLeft": 4 /* null khi đã đóng */,
  "evidence":"missing|submitted","evidenceNote":null,"evidenceUrls":[],"gatewayDisputeId":"mock_dp_…","openedAt","resolvedAt":null }
```

## B5. Creator Revenue (tổng hợp theo chủ cộng đồng từ `Payment`; công thức như `/courses/:id/revenue`)
| GET | `/admin/payments/creators/summary` | `from?`, `to?` | `{ data: { creators, grossCents, refundsCents, platformFeeCents, gatewayFeeCents, netCents, pendingBalanceCents } }` |
|---|---|---|---|
| GET | `/admin/payments/creators` | `q` (tên/email/cộng đồng), `sort` (`net|gross|pending|name`), `from`, `to`, page, limit | `{ data: AdminCreatorRevenue[], meta }` |
| GET | `/admin/payments/creators/:userId` | `from?`, `to?` | `{ data: { creator: Person, kpis: {grossCents,refundsCents,platformFeeCents,gatewayFeeCents,netCents,pendingBalanceCents,paidOutCents}, series: [{ date, grossCents, netCents, refundsCents }] /* theo ngày, mặc định 30 ngày gần nhất hoặc theo from/to */, communities: [{ id,name,grossCents,netCents,pendingBalanceCents }], transactions: [AdminTransaction ×20], payouts: [AdminPayout ×10] } }` |
```json
AdminCreatorRevenue = { "creator": Person,"communities":2,"grossCents","refundsCents","platformFeeCents","gatewayFeeCents","netCents",
  "pendingBalanceCents" /* net toàn thời gian − payout chưa bị từ chối */,"paidOutCents" }
```
Khoảng `from/to` áp cho gross/refunds/fees/net; `pendingBalanceCents`/`paidOutCents` luôn là toàn thời gian.

## B6. Payouts (`Payout`; giữ nguyên `GET /admin/payouts`, `PATCH /admin/payouts/:id`)
Trạng thái: `requested` (mockup "Pending") · `approved` ("Processing") · `paid` · `failed` · `on_hold` · `rejected`.
Chuyển trạng thái: `approve: requested→approved` · `mark-paid: requested|approved→paid` · `mark-failed: approved→failed` · `retry: failed→approved` · `hold: requested|approved|failed→on_hold` · `release: on_hold→trạng thái trước khi giữ` · `reject: requested|approved|failed|on_hold→rejected` (hoàn lại số dư). Sai -> 409. Chủ cộng đồng được thông báo.
| GET | `/admin/payments/payouts/summary` | — | `{ data: { pendingCents, processingCents, paidCents, failedCents, onHoldCents, counts: { requested, approved, paid, failed, on_hold, rejected } } }` |
|---|---|---|---|
| GET | `/admin/payments/payouts` | `q` (mã PO, chủ, cộng đồng), `status` (csv), `courseId`, `ownerId`, `sort` (`newest|amount|scheduled`), page, limit | `{ data: AdminPayout[], meta }` |
| GET | `/admin/payments/payouts/:id` | — | `AdminPayout & { creatorBalance: { netCents, requestedCents, availableCents }, history }` |
| POST | `/admin/payments/payouts/:id/approve` · `/mark-paid` · `/release` · `/retry` | `{ note? }` | `AdminPayout` |
| POST | `/admin/payments/payouts/:id/reject` · `/hold` · `/mark-failed` | `{ reason, note? }` | `AdminPayout` |
```json
AdminPayout = { "id","code":"PO-3FA2B1C4","creator": Person,"community": Ref,"amountCents":5000,
  "method": { "type":"bank","bankName":"Chase","accountMasked":"****1203","label":"Bank · Chase •• 1203" },
  "status":"requested","scheduledFor":"2026-10-16T00:00:00.000Z" /* ngày 1 hoặc 16 kế tiếp kể từ lúc tạo */,"paidAt": null /* = updatedAt khi paid */,
  "failureReason": null,"heldFromStatus": null,"note": null,"createdAt","updatedAt" }
```

---------------------------------------------------------------------------------------------------
# C. DISCOVERY — `/api/admin/discovery/*`
Thêm vào bảng `Course`: `discoveryStatus` (`listed|hidden|unlisted`, mặc định listed) và `searchVisibility` (`searchable|reduced|hidden`, mặc định searchable).
**Tác động công khai (có test):** `GET /api/courses` (danh sách) chỉ trả cộng đồng `listed`; `hidden/unlisted` vẫn mở bằng link trực tiếp và vẫn tham gia được. `GET /api/search` và `/api/courses?q=`: `searchVisibility=hidden` bị loại khỏi kết quả, `reduced` xếp SAU các kết quả `searchable`. Danh mục tắt (`disabled`) biến mất khỏi `GET /api/categories`. `GET /api/courses/featured` trả cộng đồng đang được ghim. `GET /api/courses?sort=ranked` dùng trọng số xếp hạng đã publish.
`discoveryStatus` hiển thị cho FE: `listed | featured | hidden | unlisted` (`featured` = listed + đang nằm trong section `featured`, còn hạn). Cộng đồng không `active` (đang chờ duyệt, bị đình chỉ, đã xóa...) luôn hiển thị `unlisted`.

## C1. Listed communities
| GET | `/admin/discovery/communities/summary` | — | `{ data: { total, listed, featured, hidden, unlisted } }` |
|---|---|---|---|
| GET | `/admin/discovery/communities` | `q`, `status` (csv `listed,featured,hidden,unlisted`), `category`, `sort` (`members|growth|engagement|rating|newest|name`, mặc định members), page, limit | `{ data: AdminListedCommunity[], meta }` |
| POST | `/admin/discovery/communities/:id/status` | `{ status: "listed"\|"hidden"\|"unlisted", reason? }` | `AdminListedCommunity` ("Hide" / "Remove from Discovery" / "List again") |
| POST | `/admin/discovery/communities/:id/feature` | `{ section? = "featured", startsAt?, endsAt? }` | `AdminListedCommunity` (tắt tay = thêm vào section; 409 nếu đã có / community không `active`+`public`+`listed`) |
| POST | `/admin/discovery/communities/:id/unfeature` | `{ section? }` (bỏ trống = gỡ khỏi mọi section) | `AdminListedCommunity` |
```json
AdminListedCommunity = { "id":"photo","name","slug","thumbnail","category":"hobby","categoryLabel":"Sở thích","owner": Person|null,
  "members":120,"growthPct":24.5 /* thành viên mới 30 ngày / thành viên trước đó */,"engagementPct":71 /* % thành viên hoạt động 30 ngày */,
  "rating":4.8,"ratingCount":42,"discoveryStatus":"featured","listedStatus":"listed" /* giá trị thô của DB */,"searchVisibility":"searchable",
  "featuredSections":["featured"],"visibility":"public","moderationStatus":"active","discoveryReason":null,"createdAt":"…" }
```

## C2. Categories (danh mục hiển thị ở Discovery; mỗi dòng ứng với 1 giá trị enum `CourseCategory` nên các khóa học hiện có không bị ảnh hưởng)
Khóa (`key`): `business|content|tech|finance|health|self|hobby|relationships|marketing|design` (2 giá trị cuối chỉ dùng được sau khi admin "Add").
| GET | `/admin/discovery/categories` | — | `{ data: AdminCategory[] }` (đã sắp theo `position`) |
|---|---|---|---|
| POST | `/admin/discovery/categories` | `{ key, name, description? }` → 201 | thêm danh mục từ khóa chưa có (409 nếu đã có) |
| PATCH | `/admin/discovery/categories/:key` | `{ name?, description?, status?: "active"\|"disabled" }` | `AdminCategory` |
| POST | `/admin/discovery/categories/reorder` | `{ keys: string[] }` (đủ & đúng tập khóa hiện có) | `{ data: AdminCategory[] }` |
| POST | `/admin/discovery/categories/:key/move` | `{ direction: "up"\|"down" }` | `{ data: AdminCategory[] }` |
```json
AdminCategory = { "key":"business","slug":"business","name":"Kinh doanh","description":null,"status":"active","position":1,"communities":14 /* cộng đồng active+public+listed */,"createdAt":"…" }
```

## C3. Featured (curation theo section)
Section: `featured` ("Featured Communities") · `trending` ("Trending") · `editors_picks` ("Editor's Picks") · `new_noteworthy` ("New & Noteworthy"). Mỗi mục có `position` (1..n) và khoảng hiệu lực `startsAt/endsAt` (null = mở).
| GET | `/admin/discovery/featured` | — | `{ data: { sections: [ { key, label, items: [ { id /* entryId */, position, startsAt, endsAt, active, community: { id, name, thumbnail, category, categoryLabel, members } } ] } ] } }` (luôn đủ 4 section) |
|---|---|---|---|
| POST | `/admin/discovery/featured` | `{ section, courseId, startsAt?, endsAt? }` → 201 | thêm vào cuối section (409 trùng; 400 nếu community không `active` công khai) |
| PATCH | `/admin/discovery/featured/:entryId` | `{ startsAt?\|null, endsAt?\|null }` | entry |
| DELETE | `/admin/discovery/featured/:entryId` | — | `{ data: { removed: true } }` |
| POST | `/admin/discovery/featured/:section/reorder` | `{ entryIds: string[] }` (hoán vị đủ của section) | section |
Công khai: `GET /api/courses/featured?section=featured&limit=` → `{ data: Course[] }` theo `position`, chỉ mục còn hiệu lực + cộng đồng còn `active`, `public`, chưa xóa/khóa, `listed`.

## C4. Rankings
Trọng số (tổng không bắt buộc 100): `memberGrowth, engagement, retention, rating, revenue, reportPenalty`; mặc định `25,25,20,15,10,5`. Mỗi tín hiệu chuẩn hóa 0–100: growth = growthPct (cắt 100), engagement = engagementPct, retention = % thành viên đã tham gia >=14 ngày còn hoạt động 30 ngày, rating = rating/5×100, revenue = MRR/$450×100 (cắt 100), reportPenalty = min(100, số báo cáo 30 ngày × 10). `score = Σ(5 tín hiệu × trọng số)/100 − reportPenalty × wPenalty/100`.
| GET | `/admin/discovery/rankings` | — | `{ data: { weights, defaults, updatedAt, updatedBy: Person\|null, preview: RankingRow[] } }` (preview theo trọng số đã publish) |
|---|---|---|---|
| POST | `/admin/discovery/rankings/preview` | `{ weights }` | `{ data: { weights, preview: RankingRow[] } }` (không lưu) |
| PUT | `/admin/discovery/rankings` | `{ weights, note? }` | "Publish ranking": lưu + audit; `GET /api/courses?sort=ranked` dùng ngay |
| POST | `/admin/discovery/rankings/reset` | — | về mặc định (lưu + audit) |
```json
RankingRow = { "rank":1,"id","name","thumbnail","category","categoryLabel","score":71.4,"signals":{ "memberGrowth":24,"engagement":71,"retention":60,"rating":96,"revenue":10,"reportPenalty":0 } }
```
Không có pin/boost thủ công (mockup không có).

## C5. Search visibility
| GET | `/admin/discovery/search-visibility/summary` | — | `{ data: { total, searchable, reduced, hidden } }` |
|---|---|---|---|
| GET | `/admin/discovery/search-visibility` | `q`, `searchStatus` (csv `searchable,reduced,hidden`), `discoveryStatus`, `sort` (`quality|violations|name`), page, limit | `{ data: AdminSearchVisibility[], meta }` |
| POST | `/admin/discovery/communities/:id/search-visibility` | `{ visibility: "searchable"\|"reduced"\|"hidden", reason? }` | `AdminSearchVisibility` |
```json
AdminSearchVisibility = { "id","name","thumbnail","category","searchVisibility":"searchable","discoveryStatus":"listed","qualityScore":92,"violations":0,"members":120 }
```
`qualityScore` (0–100) = 40×rating/5 + 25×engagement + 15 (mô tả >= 80 ký tự) + 10 (có ảnh bìa) + 10 (có bài đăng 30 ngày) − 8×violations; `violations` = báo cáo của cộng đồng đã xử lý bằng hành động thực sự (không tính `dismiss`/`none`).

---------------------------------------------------------------------------------------------------
## Khác biệt so với bản công bố đầu
1. `product.label` chỉ có `Membership · Monthly` / `Membership · Renewal` (không có `Trial`: mọi giao dịch đầu đều mang `trialDays` mặc định nên không phân biệt được).
2. Mã `RF-`/`PO-` dài 8 ký tự (như `TXN-`), không phải 6.
3. Trả về của một số POST là bản "đầy đủ" thay vì item rút gọn: `PATCH /content/events/:id` trả `AdminEvent` + `description, rsvps, history` (cùng dạng detail); `POST /discovery/featured` (201) trả `{ section, id, position, startsAt, endsAt, active, community }`; `POST /discovery/featured/:section/reorder` trả `{ key, label, items }` của section; `PUT /discovery/rankings` và `POST /rankings/reset` trả đúng dạng `GET /discovery/rankings` (kèm `preview`).
4. `GET /admin/discovery/communities` và search-visibility sắp xếp/phân trang **trong bộ nhớ** (cần tín hiệu thật của mọi cộng đồng) — ổn với vài nghìn cộng đồng; trang Creator Revenue cũng tính trong bộ nhớ trên danh sách chủ có giao dịch.
5. Khoảng `from/to` ở `transactions` lọc theo `createdAt`; ở `creators` lọc theo `COALESCE(confirmedAt, createdAt)` (đúng công thức `/courses/:id/revenue`).
6. `discoveryStatus` hiển thị: không `active`/bị khóa/đã xóa => `unlisted`; **cộng đồng `private` => `hidden`** (khớp bản đợt 1); còn lại theo cột `Course.discoveryStatus` (+ `featured` nếu đang nằm section `featured`).
7. `GET /api/courses?q=` loại `searchVisibility=hidden`, nhưng danh sách không có từ khóa vẫn hiện cộng đồng đó (chỉ ảnh hưởng tìm kiếm). `GET /api/search` (type courses) loại `hidden` và xếp `reduced` sau cùng; tìm bài viết/thành viên (phạm vi cộng đồng của tôi) không đổi.
8. `GET /api/courses` mặc định chỉ trả `discoveryStatus=listed` — kể cả không có từ khóa (đây là thay đổi hành vi công khai có chủ đích).
9. Bài viết bị `removed` biến mất với MỌI người (kể cả tác giả/mod cộng đồng); `hidden` giữ hành vi cũ (tác giả và mod vẫn thấy).
10. Khóa học nháp/lưu trữ/bị gỡ cũng ẩn với mod cộng đồng khi họ gọi API lớp học (mod không thấy khóa `draft` do admin hủy xuất bản).
11. `ClassroomModule` không có trường "reports" nên `reports` của Courses/Lessons/Events luôn `0`; `Media.reports` = 1 nếu đang gắn cờ.
12. Public API có thêm trường/giá trị mới (FE chung cần biết): `Course.searchVisibility` (chỉ khi khác `searchable`), sự kiện `cancelledAt`, `PaymentIntent.failureReason`, trạng thái gói `past_due|paused` (ở `GET /me/subscriptions`), trạng thái payout `failed|on_hold`, danh mục `marketing|design`, `GET /api/courses?sort=ranked`, `GET /api/courses/featured`.
13. Chưa làm: ghim bài viết, export CSV (nút Export/Download receipt), boost xếp hạng thủ công, `creatorResponse` của hoàn tiền (luôn `null`).
