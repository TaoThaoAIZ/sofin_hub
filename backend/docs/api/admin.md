# API Admin (đợt 1): Dashboard · Communities · Users · Moderation · Audit log

> Trạng thái: **ĐÃ TRIỂN KHAI** (đúng contract đã công bố; thay đổi so với bản đầu được liệt kê ở mục "Khác biệt so với bản công bố đầu" cuối file). 15 test tích hợp ở `tests/admin.test.ts`. Mọi route dưới `/api/admin/*` yêu cầu `Authorization: Bearer <accessToken>` của **Platform Admin**
> (email trong env `PLATFORM_ADMIN_EMAILS`; tài khoản seed: `admin@sofinhub.test` / `Passw0rd!x`). Chưa đăng nhập → 401, không phải admin → 403 `FORBIDDEN`.
> Các route cũ `/admin/refunds`, `/admin/payouts`, `/admin/reports`, `/admin/courses/:id/lock|unlock` giữ nguyên (và nay cũng ghi audit log).

## Quy ước chung
- Thành công: `{ "data": ... }`; danh sách phân trang: `{ "data": [...], "meta": { "page", "limit", "total", "totalPages" } }`. Query chung: `page` (>=1, mặc định 1), `limit` (1..100, mặc định 20).
- Lỗi: `{ "error": { "code", "message", "details"? } }` (như các module khác). Validate sai → 400 `VALIDATION_ERROR`. Chuyển trạng thái không hợp lệ → 409 `CONFLICT`. Không thấy → 404 `NOT_FOUND`.
- Thời điểm: ISO 8601 UTC. Tiền: **cent** (`*Cents`, Int) hoặc USD ở trường `priceUsd`.
- Mã trạng thái là chuỗi thường (FE tự map nhãn hiển thị):
  - `UserStatus`: `active | restricted | suspended | banned`
  - `CommunityStatus`: `pending_review | changes_requested | rejected | active | suspended | deleted`
  - `CaseStatus`: `open | under_review | resolved | dismissed`; `CaseRisk`: `low | medium | high | critical`
  - `CaseReason`: `spam | harassment | inappropriate | misinformation | other` (mở rộng thêm: `hate_speech | scam | copyright | nsfw`)
- Mọi thao tác ghi (POST/DELETE) đều ghi 1 dòng `AdminAuditLog` (xem mục Audit). Lý do (`reason`) là chuỗi tự do (FE gửi nhãn như "Spam", "Fraud"...), tối đa 500 ký tự.
- Thời hạn (restrict/suspend community/user): gửi `duration` ∈ `"24h" | "7d" | "30d" | "indefinite"` **hoặc** `until` (ISO). Cả hai bỏ trống = vô thời hạn. `until` thắng `duration`.
- Id: user = uuid; community = slug (vd. `photo`); case = uuid, kèm `caseCode` hiển thị `CASE-00012`.

## 0. Phiên admin
| Method | Path | Mô tả |
|---|---|---|
| GET | `/admin/me` | `{ data: { id, name, email, role: "platform_admin" } }` — FE dùng để bảo vệ route `/admin` (403 nếu không phải admin). |

## 1. Dashboard
`GET /admin/dashboard?range=7|30|90` (mặc định 30)
```json
{ "data": {
  "range": 30,
  "kpis": {
    "totalUsers":              { "value": 120, "deltaPct": 12.4 },
    "activeUsers":             { "value": 80,  "deltaPct": 8.2 },
    "communities":             { "value": 14,  "deltaPct": 4.8 },
    "mrrCents":                { "value": 28743, "deltaPct": 18.2 },
    "pendingReports":          { "value": 12, "critical": 3 },
    "pendingReviewCommunities":{ "value": 3 },
    "openSupportTickets":      { "value": null }
  },
  "series": {
    "userGrowth":      [ { "date": "2026-09-01", "newUsers": 3, "activeUsers": 20 } ],
    "communityGrowth": [ { "date": "2026-09-01", "created": 1, "active": 12, "paid": 5, "suspended": 0 } ],
    "revenue":         [ { "date": "2026-09-01", "mrrCents": 20000, "revenueCents": 1900, "refundsCents": 0 } ],
    "engagement":      [ { "date": "2026-09-01", "posts": 4, "comments": 11, "lessonsCompleted": 3, "eventRsvps": 2 } ]
  },
  "needsAttention": {
    "pendingReviewCommunities": { "count": 3, "oldestWaitingHours": 18 },
    "openReports":              { "count": 12, "critical": 3 },
    "suspiciousUsers":          { "count": 2 },
    "pendingPayouts":           { "count": 1, "amountCents": 5000 },
    "pendingRefunds":           { "count": 2, "amountCents": 3800 }
  },
  "recentActivity": [
    { "type": "audit|signup|community_created", "icon": "history|person_add|add_business", "actor": { "id": "…", "name": "Admin" } , "text": "suspended user", "target": "Sarah Kim", "createdAt": "…" }
  ]
} }
```
Mỗi mảng `series` có đúng `range` điểm (mỗi ngày UTC, cũ → mới, ngày không có dữ liệu = 0). `deltaPct` = % so với kỳ trước (null nếu kỳ trước = 0). `openSupportTickets.value` = null (module Support thuộc đợt sau).
Những thẻ mockup chưa có dữ liệu thật (Failed payouts, Chargebacks, Critical support tickets) được thay bằng `pendingPayouts` / `pendingRefunds`; không có chargeback.

## 2. Communities
Item rút gọn (`AdminCommunity`):
```json
{ "id": "photo", "name": "Nhiếp ảnh", "slug": "photo", "category": "hobby", "pricing": "free|paid|trial", "priceUsd": 49, "visibility": "public|private",
  "status": "active", "statusReason": null, "statusNote": null, "statusUntil": null,
  "owner": { "id": "…", "name": "Olivia Owner", "email": "…" } , "members": 120, "mrrCents": 4900, "discovery": "listed|hidden|unlisted",
  "thumbnail": "/images/…", "createdAt": "…", "deletedAt": null }
```
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/communities/summary` | — | `{ data: { total, active, pendingReview, changesRequested, rejected, paid, suspended, deleted } }` |
| GET | `/admin/communities` | `q` (tên/id/chủ), `status` (một hoặc nhiều, phân cách `,`; mặc định mọi trạng thái trừ `deleted`), `category`, `pricing` (`free|paid|trial`), `visibility`, `sort` (`newest|oldest|members|mrr|name`, mặc định newest), `page`, `limit` | `{ data: AdminCommunity[], meta }` |
| GET | `/admin/communities/review-queue` | `page`, `limit` | Danh sách `status ∈ pending_review, changes_requested` (cũ nhất trước): `AdminCommunity` + `{ description, submittedAt, waitingHours, signals: { ownerAccountAgeDays, ownerCommunities, ownerViolations90d, hasThumbnail, descriptionLength } }` |
| GET | `/admin/communities/trash` | `q`, `page`, `limit` | `{ data: [{ id, name, owner:{id,name}, category, deletedAt, deletedBy: {id,name}\|null, deletedByOwner: bool, reason, purgeAt, daysLeft }], meta }` (lưu 30 ngày) |
| GET | `/admin/communities/:id` | — | Chi tiết (bên dưới) |
| GET | `/admin/communities/:id/members` | `q`, `role` (`member|mod|admin|owner`), `page`, `limit` | `{ data: [{ userId, name, email, role, joinedAt, lastActiveAt, posts, userStatus, banned }], meta }` |
| GET | `/admin/communities/:id/reports` | `page`, `limit` | danh sách case (`AdminCase`, xem mục 4) của cộng đồng |
| POST | `/admin/communities/:id/approve` | `{ note? }` | `AdminCommunity` — `pending_review|changes_requested → active` |
| POST | `/admin/communities/:id/request-changes` | `{ note }` (bắt buộc) | `pending_review → changes_requested`, thông báo chủ cộng đồng |
| POST | `/admin/communities/:id/reject` | `{ reason, note? }` | `pending_review|changes_requested → rejected`, thông báo |
| POST | `/admin/communities/:id/suspend` | `{ reason, duration?, until?, note? }` | `active → suspended` (ẩn khỏi danh sách công khai, khóa như `locked`) |
| POST | `/admin/communities/:id/restore` | `{ note? }` | `suspended → active` |
| POST | `/admin/communities/:id/delete` | `{ reason, note? }` | xóa mềm (mọi trạng thái trừ đã xóa) → `deleted`, giữ 30 ngày |
| POST | `/admin/communities/:id/undelete` | `{ note? }` | khôi phục về trạng thái trước khi xóa; 409 nếu quá 30 ngày |

`GET /admin/communities/:id`:
```json
{ "data": { "...AdminCommunity", "description": "…", "language": "vi", "lessons": 12, "deleteReason": null, "deletedBy": null, "purgeAt": null,
  "owner": { "id":"…","name":"…","email":"…","status":"active","accountAgeDays": 400,"communitiesOwned": 3 },
  "stats": { "members": 120, "activeMembers30d": 45, "newMembers30d": 8, "bannedMembers": 1, "posts": 300, "comments": 900, "hiddenPosts": 4, "events": 6,
             "mrrCents": 4900, "totalRevenueCents": 98000, "refundsCents": 1900, "activeSubscriptions": 20, "reports30d": 5, "openReports": 2 },
  "recentReports": [ "AdminCase (tối đa 5)" ],
  "history": [ "AdminAuditLogItem về cộng đồng này (tối đa 10, mới nhất trước)" ] } }
```

## 3. Users
`AdminUser` (item list):
```json
{ "id":"…","name":"Sarah Kim","firstName":"Sarah","lastName":"Kim","email":"…","avatarUrl":null,
  "status":"active|restricted|suspended|banned","statusReason":null,"statusUntil":null,"restrictions":[],"statusChangedAt":null,"statusChangedBy":null,
  "role":"creator|member","communities":3,"plan":"free|paid","revenueCents":12400,"reports":2,"joinedAt":"…","lastActiveAt":"…" }
```
`role = creator` nếu sở hữu ≥ 1 cộng đồng; `plan = paid` nếu có subscription `active`; `revenueCents` = tổng thanh toán thành công trừ hoàn tiền; `reports` = số báo cáo nhận được. Danh sách **không** gồm thành viên minh họa (`isDemo`) và tài khoản đã xóa.
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/users/summary` | — | `{ data: { total, active, new30d, paid, restricted, suspended, banned } }` |
| GET | `/admin/users` | `q` (tên/email/id), `status` (nhiều giá trị `,`), `role` (`member|creator`), `plan` (`free|paid`), `sort` (`newest|oldest|name|revenue|reports`), `page`, `limit` | `{ data: AdminUser[], meta }` — trang "Restrict/Suspend" = `?status=restricted,suspended`; trang "Banned" = `?status=banned` |
| GET | `/admin/users/:id` | — | `{ data: { ...AdminUser, bio, location, website, emailVerified, lastLoginAt, isPlatformAdmin, stats: { communities, owned, posts, comments, purchases, lifetimeSpendCents, activeSubscriptions, refundsCents, reportsReceived, confirmedViolations, warnings, suspensions }, recentActivity: [ActivityItem ×5], security: { emailVerified, activeSessions: [{ id, device, ip, createdAt, lastUsedAt }] } } }` |
| GET | `/admin/users/:id/communities` | `page`, `limit` | `[{ id, name, role, membership: "free\|paid", priceUsd, joinedAt, lastActiveAt, status }]` |
| GET | `/admin/users/:id/activity` | `type` (`login|community|content|payment|moderation`), `page`, `limit` | `[{ type, icon, title, detail, createdAt }]` (gộp post/comment/enrollment/payment/report/audit) |
| GET | `/admin/users/:id/purchases` | `page`, `limit` | `{ data: [{ id, invoiceNumber, courseId, courseName, amountCents, refundedCents, status, method, createdAt }], meta, summary: { lifetimeSpendCents, activeSubscriptions, refundsCents } }` |
| GET | `/admin/users/:id/reports` | `page`, `limit` | case về user này (`AdminCase`) + `meta.summary { received, confirmed, warnings, suspensions }` |
| DELETE | `/admin/users/:id/sessions/:sid` | — | thu hồi 1 phiên: `{ data: { revoked: true } }` |
| POST | `/admin/users/:id/restrict` | `{ reason, restrictions?: ("post"\|"comment"\|"dm"\|"create_community"\|"purchase")[] (mặc định post,comment,create_community), duration?, until?, note? }` | `AdminUser` — `active|restricted → restricted`. Bị hạn chế vẫn đọc được; đăng bài/bình luận/tạo cộng đồng/nhắn tin/mua hàng bị chặn tương ứng (403 `ACCOUNT_RESTRICTED`) |
| POST | `/admin/users/:id/suspend` | `{ reason, duration?, until?, note?, notify? }` | `active|restricted → suspended`: thu hồi mọi phiên, không đăng nhập được (403 `ACCOUNT_SUSPENDED`) tới `statusUntil` |
| POST | `/admin/users/:id/ban` | `{ reason, evidence?, note? }` | mọi trạng thái trừ `banned` → `banned`: thu hồi phiên, không đăng nhập (403 `ACCOUNT_BANNED`). Giữ nguyên ghi danh (gỡ ban là khôi phục) |
| POST | `/admin/users/:id/reinstate` | `{ note? }` | `restricted|suspended|banned → active` |
| POST | `/admin/users/:id/warn` | `{ reason, message }` | không đổi trạng thái; gửi thông báo cho user và ghi audit |

Không được tác động lên chính mình, Platform Admin, tài khoản demo/đã xóa (400/403). Đăng nhập/refresh khi bị chặn trả 403: `{ error: { code: "ACCOUNT_SUSPENDED"|"ACCOUNT_BANNED", message, details: { reason, until } } }`. Suspend có hạn tự hết hiệu lực khi quá `statusUntil` (kiểm tra lúc đăng nhập).

## 4. Moderation (xây trên bảng `Report` hiện có; 1 báo cáo = 1 case)
`AdminCase`:
```json
{ "id":"uuid","caseCode":"CASE-00012","targetType":"post|comment|member",
  "content": { "type":"post","id":"…","title":"excerpt…","community": { "id":"photo","name":"…" } },
  "reportedUser": { "id":"…","name":"…" }, "reporter": { "id":"…","name":"…" },
  "reason":"spam","detail":null,"reportCount":3,"risk":"low|medium|high|critical",
  "assignee": { "id":"…","name":"…" } , "status":"open","action":null,"note":null,"createdAt":"…","resolvedAt":null }
```
| Method | Path | Query / Body | Response |
|---|---|---|---|
| GET | `/admin/moderation/summary` | — | `{ data: { open, critical, underReview, resolvedToday, warnings, removedContent, suspendedUsers } }` |
| GET | `/admin/moderation/assignees` | — | `{ data: [{ id, name, email, canBeAssigned }] }` — danh sách để chọn "Assigned admin" (Platform Admin + người đang được giao case) |
| GET | `/admin/moderation/cases` | `status` (nhiều giá trị `,`; `all`), `risk`, `reason`, `assignee` (userId \| `me` \| `unassigned`), `targetType`, `courseId`, `q` (CASE-xxx/nội dung/user/reporter), `sort` (`newest|risk`), `includeDuplicates` (`true` để hiện cả báo cáo trùng, mặc định ẩn), `page`, `limit` | `{ data: AdminCase[], meta }` |
| GET | `/admin/moderation/cases/:id` | — | `{ data: { ...AdminCase, reportedContent: { type, id, excerpt, exists, body, author, createdAt, likes, comments, hidden, imageUrl, parentPost, thread: [{author, text}] }, reporterInfo: { id,name,email }, reportedUserInfo: { id,name,email,status,accountAgeDays,previousReports,warnings,suspensions,communities }, relatedReports: [{ id, reporter, reason, detail, createdAt }], similarCases: [AdminCase ×5], history: [{ id, type, actor:{id,name}, note, createdAt, meta }] } }` |
| POST | `/admin/moderation/cases/:id/assign` | `{ adminId? }` (bỏ trống = tôi; `null` = bỏ gán) | `AdminCase`; `open → under_review` |
| POST | `/admin/moderation/cases/:id/warn` | `{ message, reason?, closeCase? = true }` | gửi Notification cho user bị báo cáo; case `resolved` (action `warn_user`) |
| POST | `/admin/moderation/cases/:id/remove-content` | `{ reason, notifyAuthor? = true, closeCase? = true }` | ẩn bài/bình luận (post.hidden); 400 nếu case là `member` |
| POST | `/admin/moderation/cases/:id/restrict-user` | như `/admin/users/:id/restrict` | áp dụng cho `targetUserId` |
| POST | `/admin/moderation/cases/:id/suspend-user` | như `/admin/users/:id/suspend` | idem |
| POST | `/admin/moderation/cases/:id/ban-user` | như `/admin/users/:id/ban` | idem |
| POST | `/admin/moderation/cases/:id/dismiss` | `{ note? }` | `dismissed` (No violation) |
| POST | `/admin/moderation/cases/:id/escalate` | `{ note? }` | tăng `risk` một bậc, `under_review` |
| POST | `/admin/moderation/cases/:id/resolve` | `{ note? }` | đóng case không kèm hành động (`resolved`, action `none`) |
| GET | `/admin/moderation/decisions` | `type` (`warning|removal|restriction|suspension|ban`), `q`, `page`, `limit` | trang Warnings/Removed/Suspensions/Bans: `[{ id, case: { id, caseCode }\|null, target: { type, id, name }, decision, admin: {id,name}, reason, evidence, createdAt }]` (nguồn: audit log) |

Khi nhiều người báo cáo cùng 1 đối tượng, hàng đợi mặc định chỉ hiện báo cáo đầu tiên (đang mở) với `reportCount` = số báo cáo; xử lý 1 case (đóng) sẽ đóng luôn các báo cáo trùng đang mở cùng kết quả và báo tin cho người báo cáo. Mức `risk` tự tính: lý do nặng (`hate_speech`, `scam` = high; `harassment`, `copyright`, `nsfw` = medium) hoặc số báo cáo (>=3 medium, >=5 high, >=10 critical), không bao giờ tự hạ.

Hành động quyết định chỉ áp dụng khi case `open|under_review` (409 nếu đã `resolved|dismissed`); `closeCase=false` giữ case ở `under_review` để làm tiếp hành động khác. Mọi hành động ghi 1 dòng lịch sử case (`history`) và 1 dòng audit log. Endpoint cũ `PATCH /reports/:id` và `GET /admin/reports` vẫn hoạt động (nay hiểu thêm trạng thái `under_review`).

## 5. Audit log
`GET /admin/audit-logs?actor=<userId>&action=<chuỗi, khớp tiền tố vd "user." hoặc đầy đủ "user.ban">&targetType=&targetId=&q=&from=&to=&page=&limit=`
```json
{ "data": [ { "id":"uuid","actor":{ "id":"…","name":"Platform Admin","email":"…" },"action":"user.ban","targetType":"user","targetId":"…","targetLabel":"Sarah Kim",
  "reason":"Scam","note":null,"evidence":null,"caseId":null,"metadata":{ "from":"active","to":"banned" },"createdAt":"…" } ], "meta": { … } }
```
Danh sách `action`: `community.approve|request_changes|reject|suspend|restore|delete|undelete|lock|unlock`, `user.restrict|suspend|ban|reinstate|warn|revoke_session`, `case.assign|warn|remove_content|restrict_user|suspend_user|ban_user|dismiss|escalate|resolve`, `payment.refund_resolve|payout_resolve`, `report.resolve`. (`targetType`: `community|user|case|content|payment|refund|payout|report`.)

## Lỗi thường gặp
401 chưa đăng nhập · 403 không phải Platform Admin (hoặc tác động lên admin/chính mình) · 404 không thấy · 409 chuyển trạng thái không hợp lệ · 400 validate.

## Quyết định thiết kế
- **Trạng thái cộng đồng**: thêm cột `Course.moderationStatus` (tách khỏi `Course.status` open/soon/completed). Hiển thị: `deletedAt` -> `deleted`; `locked=true` (khóa kiểu cũ) cũng hiện là `suspended`; còn lại là `moderationStatus`. Cộng đồng hiện có = `active`. **Luồng tạo cộng đồng của người dùng không đổi** (vẫn `active` ngay); hàng chờ duyệt chạy trên các Course có `moderationStatus=pending_review` (seed có sẵn). Chỉ `active` (và chưa khóa/xóa) mới hiện ở `/courses`, tìm kiếm, danh mục.
- **Suspend cộng đồng** dùng lại cờ `locked`/`lockReason` (403 `COMMUNITY_LOCKED` ở mọi luồng sẵn có). `/admin/courses/:id/unlock` (cũ) cũng đưa `moderationStatus` về `active`. Suspend có `until` chỉ **lưu** (không tự gỡ khi hết hạn — chưa có job).
- **Xóa mềm**: `deletedAt` + `deletedById` + `deleteReason` + `preDeleteStatus`; thùng rác tính 30 ngày từ `deletedAt` (hằng `RETENTION_DAYS`); chưa có job xóa vĩnh viễn. Cộng đồng do chủ tự xóa (`DELETE /courses/:id`) cũng nằm trong thùng rác (`deletedByOwner=true`). Xóa không tự hủy subscription đang chạy.
- **Trạng thái tài khoản**: cột `User.status/statusReason/statusUntil/statusRestrictions/statusChangedAt/statusChangedById` + `lastLoginAt`. Suspend/ban: tăng `tokenVersion` + thu hồi mọi `Session` (access token chết ngay, refresh 401), đăng nhập/refresh trả 403 `ACCOUNT_SUSPENDED|ACCOUNT_BANNED` (kiểm sau khi mật khẩu đúng). `statusUntil` quá hạn tự gỡ khi được đọc (đăng nhập hoặc kiểm tra quyền). Restricted: chặn theo từng quyền ở `postsService.create/addComment`, `communitiesService.create`, `messagesService.send`, `paymentsService.checkout` (helper `assertUserCan` ở `modules/auth/user-status.ts`). Ban **không** gỡ ghi danh cộng đồng (gỡ ban là khôi phục nguyên trạng).
- **Danh sách người dùng** bỏ tài khoản minh họa (`isDemo`) và đã xóa; `members` của cộng đồng đếm mọi ghi danh không bị ban (gồm thành viên minh họa).
- **Case** = 1 dòng `Report` (+ cột `caseNo` -> `CASE-00012`, `risk`, `assignedToId`, `escalatedAt`) và bảng `ReportEvent` (lịch sử: assign/warn/remove_content/restrict_user/suspend_user/ban_user/dismiss/escalate/resolve). Enum mở rộng: `ReportStatus += under_review`, `ReportAction += warn_user|remove_content|restrict_user|suspend_user|ban_user|none`, `ReportReason += hate_speech|scam|copyright|nsfw`. API cũ (`POST /posts/:id/report`, `PATCH /reports/:id`, `GET /admin/reports`) giữ nguyên hình dạng.
- **Gỡ nội dung** = `Post.hidden`/`PostComment.hidden` (không có xóa cứng); không có cờ riêng "Removed" vs "Hidden".
- **Warn** gửi `Notification` loại `system` (không thêm loại mới để không ảnh hưởng FE thông báo); nội dung cảnh cáo lưu ở `evidence` của audit log.
- **Audit log**: `AdminAuditLog` append-only, ghi **sau** khi thao tác thành công (không cùng transaction). Các route admin cũ cũng ghi: `/admin/refunds/:id` (`payment.refund_resolve`), `/admin/payouts/:id` (`payment.payout_resolve`), `/admin/courses/:id/lock|unlock` (`community.lock|unlock`), `PATCH /reports/:id` khi người gọi là Platform Admin (`report.resolve`).
- Code: `src/modules/admin/*` (service dùng Prisma/SQL trực tiếp cho các truy vấn đọc tổng hợp; hành động ghi gom ở service tương ứng). Dashboard: chuỗi theo ngày UTC từ bảng thật; `activeUsers` dựa trên `Session.lastUsedAt` (xấp xỉ, mỗi phiên chỉ nhớ lần dùng cuối); `mrrCents` theo ngày dựng lại từ vòng đời Subscription (trừ dùng thử).

## Khác biệt so với bản công bố đầu
- Thêm `GET /admin/moderation/assignees` và query `includeDuplicates` cho danh sách case; hành vi đóng-báo-cáo-trùng ở trên.
- `reportedContent.parentPost`/`thread` chỉ là ảnh chụp ngắn (3 bình luận gần nhất / 1 bình luận trước-sau).
- Mục `needsAttention` đúng như contract (không có chargeback/failed payouts).

## Chưa làm / cần quyết định
- Hết hạn tự động của suspend cộng đồng, job xóa vĩnh viễn sau 30 ngày, hủy subscription khi xóa/đình chỉ cộng đồng (cần quyết định chính sách tiền).
- Cộng đồng người dùng tạo mới vẫn `active` ngay (chưa bắt duyệt trước — câu hỏi #7 trong PLAN.md); muốn bật chỉ cần đặt `moderationStatus: 'pending_review'` ở `communitiesService.create`.
- Gộp các báo cáo trùng ở mức hiển thị là mặc định; chưa có "case" gộp thật (bảng riêng).
- Quản lý đội admin (Create Admin, vai trò Moderator/Finance/Support), 2FA, Content/Payments/Discovery/Analytics/Support/System: các đợt sau. Hiện "Platform Admin" = email trong `PLATFORM_ADMIN_EMAILS`; mọi admin có quyền như nhau.
- Quốc gia, thiết bị nhận dạng, tín hiệu rủi ro liên kết (shared payment/device) trong mockup chưa có dữ liệu thật nên không trả về.
