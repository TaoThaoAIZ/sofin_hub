# API Admin (đợt 3): Analytics · Support · System

> Trạng thái: **ĐÃ TRIỂN KHAI** (39 test tích hợp ở `tests/admin-batch3.test.ts`). Nội dung các bảng đã cập nhật đúng thực tế; khác biệt so với bản công bố đầu nằm ở mục cuối file.
> Quy ước chung giống `admin.md` / `admin-batch2.md`: `Authorization: Bearer <token>`; `{ data }` hoặc `{ data, meta:{page,limit,total,totalPages} }`;
> tiền = **cent** (`*Cents`, Int); thời điểm ISO UTC; lỗi `{ error:{ code, message, details? } }` (401, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 400 `VALIDATION_ERROR`, 409 `CONFLICT`).
> Mọi thao tác ghi (POST/PATCH/PUT/DELETE) ghi 1 dòng `AdminAuditLog`.
> Phân quyền: xem mục 0. `admin@sofinhub.test` (email trong `PLATFORM_ADMIN_EMAILS`) = Super Admin, mọi thứ như cũ.

---------------------------------------------------------------------------------------------------
# 0. Vai trò nhân viên & ma trận quyền (áp dụng cho MỌI `/api/admin/*`)

Vai trò hệ thống: `super_admin`, `moderator`, `support`, `finance` (+ vai trò tuỳ chỉnh do Super Admin tạo). Email trong env `PLATFORM_ADMIN_EMAILS` luôn là Super Admin (không sửa/xoá được từ UI).
Người dùng thường mà không có bản ghi nhân viên -> 403 ở mọi `/admin/*`. Nhân viên bị `suspended` -> 403.

Khoá quyền (permission keys) — 8 khoá đầu đúng như mockup, các khoá sau để phủ hết route:
| key | Nhãn | Super Admin | Moderator | Support | Finance | Route được phủ |
|---|---|---|---|---|---|---|
| `dashboard.view` | View dashboard | ✔ | ✔ | ✔ | ✔ | `GET /admin/me`, `/admin/dashboard` (mọi nhân viên đều gọi được `/admin/me`) |
| `community.manage` | Manage communities | ✔ | ✔ | | | `/admin/communities/**`, `/admin/discovery/**`, `/admin/system/categories/**` |
| `report.resolve` | Resolve reports | ✔ | ✔ | ✔ | | `/admin/moderation/**`, `/admin/reports*` cũ |
| `user.ban` | Ban users | ✔ | ✔ | | | POST/DELETE `/admin/users/**` (restrict/suspend/ban/reinstate/warn/revoke session) |
| `payment.refund` | Issue refunds | ✔ | | ✔ | ✔ | POST `/admin/payments/refunds/:id/(approve\|reject)`, `/admin/payments/transactions/:id/refund` |
| `payout.approve` | Approve payouts | ✔ | | | ✔ | (dành riêng cho thao tác payout) |
| `system.flags` | Edit feature flags | ✔ | | | | `/admin/system/flags/**` |
| `admin.manage` | Manage admins | ✔ | | | | `/admin/system/admins/**`, `/admin/system/roles/**` |
| `users.view` | View users | ✔ | ✔ | ✔ | | GET `/admin/users/**` |
| `content.manage` | Manage content | ✔ | ✔ | | | `/admin/content/**` |
| `payment.view` | View payments | ✔ | | ✔ | ✔ | GET `/admin/payments/**` |
| `payment.manage` | Manage payments | ✔ | | | ✔ | POST/DELETE còn lại của `/admin/payments/**` (retry, subscriptions, chargebacks) |
| `analytics.view` | View analytics | ✔ | ✔ | | ✔ | `/admin/analytics/**` |
| `support.manage` | Handle support tickets | ✔ | | ✔ | | `/admin/support/**` |
| `audit.view` | View audit logs | ✔ | | | | `/admin/audit-logs*` |
| `system.settings` | System settings | ✔ | | | | `/admin/system/{settings,integrations,notifications,email-templates}/**` |

`admin.manage` chỉ có thể thuộc vai trò `super_admin` (không cho gán cho vai trò khác, tránh leo thang đặc quyền). Route không có trong bảng -> chỉ Super Admin.

## 0.1 `GET /admin/me` (đã có, bổ sung)
```json
{ "data": { "id": "uuid", "name": "Admin", "email": "admin@sofinhub.test", "role": "platform_admin",
  "adminRole": { "key": "super_admin", "name": "Super Admin" }, "permissions": ["dashboard.view", "community.manage", "..."], "source": "env" } }
```
`role` luôn là `"platform_admin"` cho mọi nhân viên (giữ tương thích FE cũ); FE dùng `permissions` để ẩn/hiện menu. `source`: `env` | `staff`. Super Admin: `permissions` = toàn bộ khoá.

---------------------------------------------------------------------------------------------------
# A. ANALYTICS — `/api/admin/analytics/*`  (quyền `analytics.view`)
Query chung: `range=7|30|90` (mặc định 30). Kỳ hiện tại = `range` ngày kết thúc hôm nay (UTC, gồm hôm nay); kỳ trước = `range` ngày liền trước (để so sánh).
Mọi KPI có dạng `Kpi = { "value": 18204, "previous": 16610, "changePct": 9.6 }` (`changePct` = null nếu `previous`=0). Tiền ở dạng cent. `series[]` có 1 phần tử mỗi ngày (điền 0 cho ngày trống), `date` = `YYYY-MM-DD`.
Mọi response có `range`, `from`, `to` (ISO) ở `data`. "Hoạt động" (active) của 1 user trong ngày = có ít nhất 1 sự kiện: đăng bài / bình luận / like / tin nhắn / hoàn thành bài học / RSVP / điểm thưởng / thanh toán / phiên đăng nhập (tạo hoặc `lastUsedAt`).
Hạn chế: không có dữ liệu "lượt truy cập chưa đăng nhập", "nguồn đăng ký" -> các thẻ đó **không** có trong response (FE nên ẩn).

| Method | Path | Response `data` |
|---|---|---|
| GET | `/admin/analytics/users` | `{ range, from, to, kpis:{ totalUsers:Kpi, dau:Kpi, wau:Kpi, mau:Kpi, newUsers:Kpi }, series:[{ date, newUsers, activeUsers }], segments:[{ key:"free_members"\|"paid_members"\|"creators"\|"staff", label, count, pct }], geography:[{ label, count, pct }] }` (`geography` = top 5 theo `User.location` tự khai, có thể rỗng) |
| GET | `/admin/analytics/communities` | `{ ..., kpis:{ total:Kpi, created:Kpi, paid:Kpi, avgMembers:Kpi, suspended:Kpi }, series:[{ date, created, active, paidCreated }], byCategory:[{ key, label, count, pct }], top:[{ id, name, category, members, newMembers, growthPct, mrrCents }] }` (`top` 10 cộng đồng nhiều thành viên nhất) |
| GET | `/admin/analytics/engagement` | `{ ..., kpis:{ posts:Kpi, comments:Kpi, likes:Kpi, lessonCompletions:Kpi, eventParticipation:Kpi, courseCompletionPct:Kpi }, series:[{ date, posts, comments, likes, completions, rsvps }], mix:[{ key, label, count, pct }] }` (mix gồm likes, comments, completions, posts, rsvps = "Tham gia sự kiện"; bucket ngày luôn theo UTC) |
| GET | `/admin/analytics/retention` | `{ ..., kpis:{ day7:Kpi, day30:Kpi, churn:Kpi, renewalRate:Kpi }, cohorts:[{ cohort:"2026-09", label:"Sep 2026", users:120, weeks:{ w1:74.2, w2:63, w4:52, w8:45, w12:null } }], returning:[{ date, returning, newActive }] }` — `cohorts`: 6 tháng gần nhất theo tháng đăng ký, `wN` = % user của cohort có hoạt động trong tuần thứ N sau ngày đăng ký (null nếu chưa đủ thời gian) |
| GET | `/admin/analytics/revenue` | `{ ..., kpis:{ mrrCents:Kpi, grossCents:Kpi, platformFeesCents:Kpi, arpuCents:Kpi, refundsCents:Kpi }, series:[{ date, grossCents, refundsCents, netCents }], byCommunity:[{ id, name, grossCents, pct }], byPlan:[{ key:"subscription"\|"one_time"\|"trial"..., label, grossCents, pct }] }` |
| GET | `/admin/analytics/conversion` | `{ ..., kpis:{ signupToJoinPct:Kpi, signupToPaidPct:Kpi, trialToPaidPct:Kpi, revenuePerSignupCents:Kpi }, funnel:[{ key:"signup"\|"joined"\|"trial"\|"paid", label, count, pctOfFirst }], series:[{ date, signups, trialsStarted, paidConversions }] }` — bước "visit" bỏ vì không có dữ liệu |

400 nếu `range` không thuộc 7/30/90. Chi tiết cách tính ở mục cuối.

---------------------------------------------------------------------------------------------------
# B. SUPPORT — `/api/admin/support/*`  (quyền `support.manage`)

Trạng thái ticket: `new | open | awaiting_reply | resolved | closed` (mockup: New/Open/Awaiting reply/Resolved + Closed). Ưu tiên: `low | medium | high | urgent`. Nhóm: `user | creator | payment`.
Mã hiển thị `T-2048` (`code`); chỗ nào có `:id` đều nhận cả uuid lẫn `T-2048`.
```json
Ticket = { "id": "uuid", "code": "T-2048", "subject": "Charged twice this month", "category": "payment", "priority": "high", "status": "open",
  "requester": { "id": "uuid|null", "name": "Sarah Kim", "email": "sarah@x.com", "avatarUrl": null },
  "assignee": { "id": "uuid", "name": "Ryan Cho" } | null, "escalated": false, "source": "contact_form|user|admin",
  "messageCount": 3, "lastMessagePreview": "…", "firstResponseAt": "…|null", "resolvedAt": null, "createdAt": "…", "updatedAt": "…" }
TicketMessage = { "id", "kind": "customer|staff|internal_note|system", "author": { "id|null", "name" }, "body": "…", "createdAt": "…" }
```
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/support/summary` | — | `{ data: { open: Kpi-like number, newToday, avgFirstResponseMin, resolved7d, unassigned, escalated, byCategory:{ user, creator, payment }, avgFirstResponseMinChangePct, resolved7dChangePct } }` (`open` = new+open+awaiting_reply) |
| GET | `/admin/support/assignees` | — | `{ data: [{ id, name, email, role }] }` (nhân viên có quyền `support.manage`) |
| GET | `/admin/support/tickets` | `q` (chủ đề/mã/email/tên), `category` (csv), `status` (csv), `priority` (csv), `assignee` (`me`\|`unassigned`\|userId), `escalated` (`true`), `sort` (`newest`\|`oldest`\|`updated` mặc định `updated`\|`priority`), page, limit | `{ data: Ticket[], meta }` |
| POST | `/admin/support/tickets` | `{ subject, message, category, priority?="medium", requesterEmail?, requesterName? }` → 201 | tạo hộ khách (liên kết user nếu email trùng); `Ticket` |
| GET | `/admin/support/tickets/:id` | — | `{ data: Ticket & { messages: TicketMessage[], history: AuditItem[], related: { userId\|null } } }` |
| PATCH | `/admin/support/tickets/:id` | `{ priority?, category?, subject? }` | `Ticket` |
| POST | `/admin/support/tickets/:id/assign` | `{ assigneeId: uuid\|"me"\|null }` (null = bỏ gán; người nhận phải có quyền `support.manage` -> 400) | `Ticket` (`new` -> `open`) |
| POST | `/admin/support/tickets/:id/reply` | `{ body (1..5000), status?: "awaiting_reply"\|"resolved"\|"open" }` | gửi email tới requester (mail module / dev outbox) + thông báo trong app nếu requester là user; thêm message `staff`; mặc định -> `awaiting_reply`; ghi `firstResponseAt` lần đầu; trả `Ticket & { messages }`; 409 nếu `closed` |
| POST | `/admin/support/tickets/:id/note` | `{ body }` | thêm ghi chú nội bộ (`internal_note`, khách không thấy); `Ticket` |
| POST | `/admin/support/tickets/:id/escalate` | `{ reason, priority?="urgent" }` | `escalated=true`, ưu tiên nâng, thêm message `system`; 409 nếu đã escalate hoặc đã resolved/closed |
| POST | `/admin/support/tickets/:id/resolve` | `{ note? }` | `new\|open\|awaiting_reply -> resolved` (409 nếu đã resolved/closed) |
| POST | `/admin/support/tickets/:id/close` | `{ note? }` | `-> closed` (409 nếu đã closed) |
| POST | `/admin/support/tickets/:id/reopen` | `{ note? }` | `resolved\|closed -> open` (409 nếu đang mở) |

Trang `User Issues` / `Creator Issues` / `Payment Issues` = `GET /admin/support/tickets?category=user|creator|payment`; tab `All/New/Open/Awaiting reply/Resolved` = `status`.

**Phía người dùng (nhỏ, cần đăng nhập, không phải admin):**
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/support/tickets` | `{ subject, message, category?="user" }` → 201 | `{ data: UserTicket }` |
| GET | `/api/support/tickets` | `page, limit` | ticket của tôi `{ data: UserTicket[], meta }` |
| GET | `/api/support/tickets/:id` | — | `UserTicket & { messages }` (không có `internal_note`/`system`); 404 nếu không phải của tôi |
| POST | `/api/support/tickets/:id/reply` | `{ body }` | thêm message `customer`; `awaiting_reply\|resolved -> open`; 409 nếu `closed` |

`POST /api/contact` (form liên hệ công khai, đã có; đường dẫn thật là `/api/contact`) nay **tạo ticket** (`source=contact_form`, liên kết user nếu email khớp tài khoản, nhận thêm field tuỳ chọn `category`) và vẫn gửi mail tới `SUPPORT_EMAIL`.

---------------------------------------------------------------------------------------------------
# C. SYSTEM — `/api/admin/system/*`

## C1. Admin Accounts (`admin.manage`)
```json
AdminAccount = { "id": "userId", "userId": "uuid", "name": "Ryan Cho", "email": "support@sofinhub.test", "avatarUrl": null,
  "role": { "key": "support", "name": "Support" }, "twoFactorEnabled": true, "lastLoginAt": "…|null", "status": "active|suspended",
  "source": "env|staff", "locked": false, "createdAt": "…" }
```
`locked=true` (tài khoản env) và tài khoản của chính mình: không đổi vai trò / suspend / xoá được (409).
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/system/admins` | `q`, `role` (key), `status`, page, limit | `{ data: AdminAccount[], meta }` (env admin cũng có mặt, `source:"env"`) |
| POST | `/admin/system/admins` | `{ email, roleKey, firstName?, lastName?, twoFactorEnabled?=false }` → 201 | "Create Admin": nếu email đã có tài khoản thì cấp vai trò; chưa có thì tạo tài khoản mời (mật khẩu ngẫu nhiên + gửi email đặt lại mật khẩu; cần `firstName`). 409 nếu đã là nhân viên |
| PATCH | `/admin/system/admins/:id` | `{ roleKey?, twoFactorEnabled? }` | `AdminAccount` |
| POST | `/admin/system/admins/:id/suspend` | `{ reason? }` | `status=suspended` (token cũ của người đó bị chặn ở mọi `/admin/*`) |
| POST | `/admin/system/admins/:id/enable` | — | `status=active` |
| POST | `/admin/system/admins/:id/reset-2fa` | — | đặt `twoFactorEnabled=false` + gửi email thông báo (cờ lưu trữ, **chưa có 2FA thật**) |
| DELETE | `/admin/system/admins/:id` | — | gỡ quyền nhân viên (không xoá user); `{ data: { removed: true } }` |

## C2. Roles & Permissions (`admin.manage`)
```json
GET /admin/system/roles -> { "data": {
  "permissions": [ { "key": "dashboard.view", "label": "View dashboard", "group": "General" } ],
  "roles": [ { "key": "moderator", "name": "Moderator", "description": "…", "isSystem": true, "locked": false, "memberCount": 2, "permissions": ["dashboard.view","…"] } ] } }
```
`locked=true` cho `super_admin` (luôn đủ quyền, không sửa được).
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/system/roles` | — | như trên |
| POST | `/admin/system/roles` | `{ name, key?, description?, permissions: string[] }` → 201 | tạo vai trò tuỳ chỉnh (`key` mặc định = slug của name; 409 nếu trùng) |
| PATCH | `/admin/system/roles/:key` | `{ name?, description?, permissions? (thay cả tập) }` hoặc `{ permission: "user.ban", granted: true }` (bật/tắt 1 ô của ma trận) | `Role` |
| DELETE | `/admin/system/roles/:key` | — | chỉ vai trò tuỳ chỉnh và không còn ai dùng (409 nếu hệ thống/đang dùng) |
400 nếu khoá quyền lạ hoặc gán `admin.manage` cho vai trò khác `super_admin`; sửa `super_admin` -> 409.

## C3. Categories (`community.manage`) — dùng lại `DiscoveryCategory` của đợt 2
Cùng body/response như `/admin/discovery/categories*` (xem `admin-batch2.md` mục C):
`GET /admin/system/categories`, `POST /admin/system/categories` (201), `PATCH /admin/system/categories/:key`, `POST /admin/system/categories/reorder`, `POST /admin/system/categories/:key/move`.
`AdminCategory` có thêm `communities` (số cộng đồng thuộc danh mục) và `slug` nếu chưa có.

## C4. Feature Flags (`system.flags`)
```json
FeatureFlag = { "key": "dm_v2", "name": "Direct messages v2", "description": "1:1 chat between members", "stage": "draft|beta|active",
  "enabled": true, "rolloutPercent": 100, "updatedAt": "…", "updatedBy": { "id", "name" } | null }
```
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/system/flags` | `q`, `stage`, `enabled` | `{ data: FeatureFlag[] }` |
| POST | `/admin/system/flags` | `{ key (a-z0-9_), name, description?, stage?="draft", enabled?=false, rolloutPercent?=100 }` → 201 (409 trùng key) | `FeatureFlag` |
| PATCH | `/admin/system/flags/:key` | `{ name?, description?, stage?, enabled?, rolloutPercent? (0..100) }` | `FeatureFlag` |
| POST | `/admin/system/flags/:key/toggle` | `{ enabled?: boolean }` (không gửi = đảo) | `FeatureFlag` |
| DELETE | `/admin/system/flags/:key` | — | `{ data: { deleted: true } }` |

**Public**: `GET /api/feature-flags` (đăng nhập tuỳ chọn, không cần quyền) ->
`{ "data": { "flags": { "dm_v2": true, "native_live": false }, "maintenance": false, "platform": { "name": "SofinHub", "supportEmail": "...", "defaultLanguage": "en" } } }`.
Cờ bật khi `enabled` và (`rolloutPercent`=100 hoặc băm ổn định `userId` < `rolloutPercent`; khách ẩn danh chỉ nhận cờ 100%).

## C5. Integrations (`system.settings`)
```json
Integration = { "key": "stripe", "name": "Stripe", "initials": "ST", "color": "#635bff", "description": "Card payments and subscriptions.",
  "category": "payments|email|storage|analytics|video|chat|cdn", "connected": true, "config": { "accountId": "acct_…" },
  "secretMask": "••••a1b2" | null, "connectedAt": "…|null", "updatedAt": "…" }
```
Bí mật thật **không được lưu** (vẫn là biến môi trường / secret manager): khi gửi `apiKey` ta chỉ giữ 4 ký tự cuối dạng mask để hiển thị.
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/system/integrations` | `category?` | `{ data: Integration[] }` |
| GET | `/admin/system/integrations/:key` | — | `Integration` |
| POST | `/admin/system/integrations/:key/connect` | `{ config?: object, apiKey? }` | `Integration` (`connected=true`) |
| POST | `/admin/system/integrations/:key/disconnect` | — | `Integration` |
| PATCH | `/admin/system/integrations/:key` | `{ config?, apiKey? }` | `Integration` |
| POST | `/admin/system/integrations/:key/test` | — | `{ data: { ok: boolean, message, latencyMs } }` (mô phỏng: ok nếu đã connected) |

## C6. Notifications (`system.settings`)
(a) Cảnh báo cho đội admin (3 form của mockup), lưu ở `PlatformSetting`:
| GET | `/admin/system/notifications/settings` | — | `{ data: { moderation:{ criticalReports, pendingCommunities, aiFlagged }, payments:{ newChargeback, failedPayout, refundOver500 }, reports:{ weeklySummary, monthlyBoardReport, sendTo } } }` |
|---|---|---|---|
| PUT | `/admin/system/notifications/settings` | cùng shape, từng nhóm/trường tuỳ chọn (partial) | cùng shape (đã lưu; chỉ lưu cấu hình, chưa có job gửi tự động) |

(b) Thông báo hệ thống tới người dùng:
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/admin/system/notifications/preview` | `{ audience }` | `{ data: { recipientCount } }` |
| POST | `/admin/system/notifications/broadcast` | `{ title (1..120), body (1..1000), link?, audience, sendEmail?=false }` → 201 | `Broadcast` |
| GET | `/admin/system/notifications/broadcasts` | page, limit | `{ data: Broadcast[], meta }` |
`audience` = `{ type: "all" }` \| `{ type: "creators" }` \| `{ type: "paid_members" }` \| `{ type: "community", courseId }` \| `{ type: "users", userIds: string[] (1..500) }` (chỉ user chưa xoá/ban; `all` = mọi user thật, bỏ demo).
`Broadcast = { id, title, body, link, audience, recipientCount, emailCount, sentBy:{id,name}, createdAt }`. Người nhận nhận `Notification` loại `system`.

## C7. Email Templates (`system.settings`)
```json
EmailTemplate = { "key": "welcome", "name": "Welcome member", "description": "…", "status": "active|draft|disabled", "isSystem": true,
  "variables": ["community", "name"], "languages": ["en","vi"], "subject": { "en": "Welcome to {{community}}", "vi": "…" }, "updatedAt": "…", "updatedBy": {…}|null }
EmailTemplateDetail = { ...EmailTemplate, "body": { "en": "Hi {{name}}, …", "vi": "…" } }   // body = văn bản thuần, hỗ trợ xuống dòng
```
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/system/email-templates` | `q`, `status` | `{ data: EmailTemplate[] }` |
| GET | `/admin/system/email-templates/:key` | — | `EmailTemplateDetail` |
| POST | `/admin/system/email-templates` | `{ key (a-z0-9_), name, description?, variables?: string[], subject:{en,vi?}, body:{en,vi?}, status?="draft" }` → 201 | `EmailTemplateDetail` |
| PATCH | `/admin/system/email-templates/:key` | `{ name?, description?, variables?, subject?, body?, status? }` | `EmailTemplateDetail` |
| DELETE | `/admin/system/email-templates/:key` | — | chỉ mẫu không phải hệ thống |
| POST | `/admin/system/email-templates/:key/preview` | `{ language?="en", variables?: Record<string,string> }` | `{ data: { subject, text, html, missingVariables: string[] } }` |
| POST | `/admin/system/email-templates/:key/test-send` | `{ to?, language?, variables? }` (mặc định gửi về email của admin) | `{ data: { sent: true, to } }` — vào dev outbox (`GET /dev/outbox`) |
Biến cú pháp `{{ten}}`. Các mẫu `verify_email`, `reset_password` đang `active` được dùng thật khi hệ thống gửi email xác thực / đặt lại mật khẩu (override; không có mẫu thì dùng nội dung mặc định trong code).

## C8. Audit Logs (`audit.view`) — endpoint cũ `GET /admin/audit-logs` bổ sung
- Item thêm: `ip` (string|null), `actor.role` (`{key,name}`|null).
- `GET /admin/audit-logs/filters` -> `{ data: { actors:[{id,name}], actions:[string], targetTypes:[string] } }` (cho dropdown Admin / Action).
- `GET /admin/audit-logs/export` — cùng query lọc như danh sách (bỏ page/limit; tối đa 5000 dòng) -> `text/csv; charset=utf-8` (`time,admin,action,targetType,targetId,target,case,reason,ip`), `Content-Disposition: attachment`.

## C9. Global Settings (`system.settings`)
```json
GET /admin/system/settings -> { "data": {
  "platform": { "name": "SofinHub", "supportEmail": "support@sofinhub.com", "defaultLanguage": "en|vi", "timezone": "GMT+7 · Ho Chi Minh City" },
  "payments": { "commissionPct": 10, "gatewayFeePct": 2.9, "gatewayFeeFixedCents": 30, "refundWindowDays": 7, "payoutMinUsd": 50, "trialDays": 7,
                "subscriptionPeriodDays": 30, "currency": "USD|VND|EUR", "autoPayouts": true },
  "security": { "require2fa": true, "sessionTimeoutMin": 15|30|120, "maintenanceMode": false },
  "overrides": { "payments.commissionPct": { "default": 10, "overridden": true } },   // chỉ các khoá đã bị ghi đè
  "updatedAt": "…|null" } }
```
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/admin/system/settings` | — | như trên |
| PATCH | `/admin/system/settings` | partial lồng nhau, vd. `{ "payments": { "commissionPct": 12 } }` (400 nếu ngoài khoảng) | như GET |
| POST | `/admin/system/settings/reset` | `{ keys: ["payments.commissionPct"] }` (rỗng/không gửi = tất cả) | như GET (về giá trị env mặc định) |
Giá trị thanh toán (`commissionPct`, `gatewayFeePct`, `gatewayFeeFixedCents`, `refundWindowDays`, `payoutMinUsd`, `trialDays`, `subscriptionPeriodDays`) **có hiệu lực thật** cho thanh toán/hoàn tiền/rút tiền mới (mặc định lấy từ env `PLATFORM_COMMISSION_PCT`, `REFUND_WINDOW_DAYS`, `PAYOUT_MIN_USD`, `TRIAL_DAYS`, ...). `maintenanceMode=true` -> mọi API công khai (trừ `/api/admin/*`, `/api/auth/*`, `/api/feature-flags`, `/dev/*`) trả 503 `MAINTENANCE`. `require2fa`, `sessionTimeoutMin`, `currency`, `autoPayouts`, `timezone` hiện chỉ **lưu cấu hình** (chưa có cơ chế thực thi).

---------------------------------------------------------------------------------------------------
# Ghi chú tính toán Analytics (xấp xỉ)

Kỳ hiện tại = `range` ngày UTC kết thúc hết hôm nay; kỳ trước = `range` ngày liền trước. Tất cả tính trực tiếp từ bảng thật bằng SQL (không có bảng tổng hợp / cache).
- **Active user** của 1 ngày = có >= 1 sự kiện trong: `Post`, `PostComment`, `PostLike`, `Message` (gửi), `LessonProgress`, `EventRsvp`, `PointEvent`, `Payment`, `Session.createdAt`, `Session.lastUsedAt`. Vì `lastUsedAt` chỉ giữ lần dùng gần nhất, các ngày xa trong quá khứ có thể thiếu hoạt động đăng nhập (xấp xỉ).
- **users**: `totalUsers` = user chưa xoá tạo trước cuối kỳ; `dau/wau/mau` = số user active trong 1/7/30 ngày kết thúc cuối kỳ (kỳ trước: kết thúc đầu kỳ); `segments` phân loại theo ưu tiên staff > creators (là owner cộng đồng) > paid_members (có gói active/trialing/past_due) > free_members; `geography` = top 5 `User.location` tự khai. Không có "nguồn đăng ký" (không thu thập) nên bỏ.
- **communities**: `paid` = cộng đồng `pricing=paid` và `priceCents>0`; `avgMembers` = số ghi danh / số cộng đồng; `suspended` là trạng thái hiện tại (không có kỳ trước -> `previous:null`); `active` mỗi ngày = cộng đồng có bài viết mới hoặc thành viên mới trong ngày; `top[].growthPct` = thành viên mới trong kỳ / thành viên trước kỳ; `mrrCents` = tổng `Subscription.priceCents` đang `active|past_due`.
- **engagement**: đếm theo `createdAt` (bài/bình luận/like/RSVP) và `completedAt` (bài học); `courseCompletionPct` = số chứng nhận đã cấp / số cặp (user, cộng đồng) từng hoàn thành >= 1 bài, tính luỹ kế đến cuối kỳ.
- **retention**: `day7`/`day30` = % user đăng ký sao cho cửa sổ 7 ngày bắt đầu từ ngày N sau đăng ký ([N, N+7)) kết thúc trong kỳ và có hoạt động trong cửa sổ đó; `churn` = % user active ở kỳ trước nhưng không active ở kỳ hiện tại; `renewalRate` = gia hạn thành công / (gia hạn + gói hết hạn/huỷ trong kỳ); `cohorts[].weeks.wN` = % user đã đủ N tuần có hoạt động trong khoảng ngày ((N-1)*7 [+1 với N=1], N*7) sau đăng ký (ngày đầu bị loại để phiên đăng ký không tính là "quay lại").
- **revenue**: `grossCents` = tổng `Payment` `succeeded|refunded` theo `confirmedAt` (hoặc `createdAt`); `refundsCents` = `RefundRequest` `approved` theo `resolvedAt`; `platformFeesCents` = gross x hoa hồng HIỆN TẠI (Global Settings) — xấp xỉ, không phải số đã chốt từng giao dịch; `mrrCents` = tổng giá gói đang `active|past_due` (kỳ trước: xấp xỉ theo `createdAt/trialEndsAt/canceledAt`); `arpuCents` = gross / số người trả tiền; `byPlan` theo `Payment.kind` (new_subscription / renewal) vì hệ thống chỉ có 1 gói theo cộng đồng (không có monthly/annual).
- **conversion**: phễu của nhóm user đăng ký trong kỳ: signup -> joined (có `Enrollment`) -> trial (có `Subscription.trialEndsAt`) -> paid (có `Payment` > 0 thành công, bất kể thời điểm). Không có bước "visit" (không đo lượt truy cập). `trialToPaidPct` = trial bắt đầu trong kỳ có thanh toán > 0 trên chính gói đó.

---------------------------------------------------------------------------------------------------
# Khác biệt so với contract đầu
- Form liên hệ công khai là `POST /api/contact` (không phải `/api/support/contact`).
- `GET /admin/me` có thêm `adminRole`, `permissions`, `source`; `role` vẫn là `"platform_admin"` cho mọi nhân viên.
- Super Admin do vai trò (không phải env) cũng bị chặn tự sửa/xoá chính mình (409); `locked` = tài khoản env hoặc chính mình.
- `AdminAccount.twoFactorEnabled` của tài khoản env luôn `false` (env admin không có bản ghi để lưu cờ).
- Nhân viên (mọi vai trò) không thể bị ban/suspend/... qua `/admin/users/*` (403) — dùng Admin Accounts. Trước đây chỉ chặn email trong env.
- `/admin/refunds`, `/admin/payouts` (route cũ) nay qua cùng guard theo quyền (`payment.refund` / `payout.approve`) thay vì chỉ Platform Admin; service tương ứng kiểm tra "là nhân viên" (`requireStaff`).
- Bổ sung so với bản đầu: `GET /admin/system/integrations/:key`, `GET /admin/system/email-templates/:key` (có `body`), `GET /admin/audit-logs/filters`, `GET /admin/audit-logs/export`.
- `payout.approve` chỉ được dùng ở route cũ `PATCH /admin/payouts/:id`; các route payout của đợt 2 chỉ có GET nên thuộc `payment.view`.
- `/admin/audit-logs*` cần quyền `audit.view` (chỉ Super Admin mặc định).
- Ngôn ngữ mặc định nền tảng (`platform.defaultLanguage`) là `vi` (không phải `en`) để email hệ thống giữ tiếng Việt như trước.

# Chưa làm / cần quyết định
- **2FA thật**: chỉ lưu cờ `twoFactorEnabled` + email thông báo khi reset; `security.require2fa` chỉ là cấu hình lưu.
- **Session timeout** (`security.sessionTimeoutMin`), `payments.currency`, `payments.autoPayouts`, `platform.timezone`: chỉ lưu, chưa có cơ chế thực thi.
- **Cảnh báo admin** (Notifications > Moderation/Payment alerts/Reports): chỉ lưu cấu hình; chưa có job gửi email/summary tự động.
- **Tích hợp**: mô phỏng; khóa API thật không bao giờ được lưu (vẫn ở env/secret manager); `test` chỉ trả ok khi đang connected.
- **Broadcast > 500 người nhận**: ghi thẳng DB theo lô, không đẩy realtime SSE, không cho `sendEmail`.
- **Feature flag** chỉ đọc qua `GET /api/feature-flags`; backend chưa tự chặn tính năng theo cờ (FE quyết định).
- **Cache cấu hình** (Global Settings) nạp lại tối đa mỗi 10 giây giữa các instance (ghi trong cùng tiến trình có hiệu lực ngay).
- Ticket: chưa có SLA/tự đóng, chưa nhận trả lời qua email (chỉ UI/API), chưa đính kèm file.
- Email quên mật khẩu/xác thực dùng mẫu DB khi `active`; các email khác (receipt, welcome...) vẫn chưa đọc mẫu từ DB.
- Analytics: `geography` dựa trên trường vị trí tự khai; `platformFeesCents` là xấp xỉ theo hoa hồng hiện tại; retention/DAU dựa trên sự kiện hoạt động đã liệt kê (phiên đăng nhập cũ không còn lịch sử).
