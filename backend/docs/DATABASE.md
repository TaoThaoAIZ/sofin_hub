# Cơ sở dữ liệu (PostgreSQL + Prisma)

Trạng thái: **giai đoạn 1 + 2A xong** — hạ tầng, schema, seed nền, hạ tầng test; **lõi đã chạy trên Postgres**: users/sessions/one-time tokens (auth),
courses, enrollments (+ban). Các module còn lại (communities, content, platform, payments...) vẫn `inMemory...`, agent 2B chuyển tiếp (xem "Quy ước repository Prisma").

### Lõi đã chuyển (2A) — điều agent sau cần biết

- `import { prisma } from '../../db/prisma.js'` trong repository. Repository: `userRepository` (`auth/auth.repository.ts`; `fileUserRepository` là alias deprecated), `courseRepository` (`inMemoryCourseRepository` là alias deprecated), `enrollmentRepository`.
- **Xác thực**: `authenticateAccessToken(token)` (`auth/tokens.ts`) -> `{ userId, sid } | null`, dùng cho mọi chỗ cần xác thực ngoài `requireAuth` (SSE...). `req.sessionId` có sau `requireAuth`. Đừng dùng `verifyAccessToken` (chỉ kiểm chữ ký).
- **Course**: `students` hiển thị = `Course.students` (số nền minh họa, CHỈ với khóa seed có `trendingRank`) + số thành viên thật (Enrollment không bị ban, `isDemo=false`); khóa người dùng tạo chỉ tính số thật. `courseService.update(id, { locked, lockReason })` ghi `Course.lockReason` (`lockReason: null` khi mở khóa), đọc bằng `courseService.getLockReason(id)`. `stats.admins/online` lấy từ Enrollment thật. Nội dung minh họa của trang chi tiết (highlights, gains, faqs, modules, reviews minh họa) vẫn được SINH khi đọc trong `course-detail.ts` (quyết định: chưa có hệ thống soạn nội dung khóa học riêng; chỉ course, review thật, stats lấy từ DB).
- **Ban**: `enrollmentService.setBanned(userId, courseId, true, { reason, bannedById })` ghi `CommunityBan` (tham số cuối tùy chọn).
- **Test**: DB thật là mặc định. `startTestServer()` nạp Course nền (21 khóa seed, KHÔNG có thành viên/bài viết demo); `resetDb()` xóa sạch rồi nạp lại Course nền; `(await useTestDb()).reset()` = trống hoàn toàn; `db.seedBase()`. Không còn `TEST_DB` / `USERS_FILE`.
- `data/users.json` **deprecated**: chỉ để nhập một lần bằng `npm run db:import-users`.

## Kiến trúc

| Thành phần | Vị trí |
| --- | --- |
| Postgres 16 (docker) | `docker-compose.yml` (gốc repo), cổng **5435** (đổi bằng `POSTGRES_PORT`), DB `sofinhub` + `sofinhub_test` (script `docker/postgres-init/`) |
| Schema Prisma | `backend/prisma/schema.prisma` |
| Migration | `backend/prisma/migrations/` (commit vào git) |
| Cấu hình Prisma 7 | `backend/prisma.config.ts` (URL DB, đường dẫn migration/seed) |
| Client sinh ra | `backend/src/generated/prisma/` (gitignore; sinh bởi `npm run db:generate`, tự chạy ở `postinstall`) |
| Singleton client | `backend/src/db/prisma.ts` → `import { prisma } from '../../db/prisma.js'` |
| Helper map enum/tiền | `backend/src/db/enums.ts` |
| Seed | `backend/prisma/seed.ts` (CLI) · `seed-base.ts` (lõi) · `seed-accounts.ts` · `seed/<module>.ts` |
| Hạ tầng test | `backend/tests/helpers.ts`, `backend/tests/db.test.ts` |

Prisma **7.10.0** (bản ổn định mới nhất; tag `latest` trên npm hiện là `8.0.0-rc` — chưa dùng). Prisma 7 bắt buộc: client sinh ra
trong repo (`generator prisma-client` + `output`), URL DB đặt trong `prisma.config.ts` (không còn trong schema), và **driver adapter**
(`@prisma/adapter-pg` + `pg`). Biến môi trường: `DATABASE_URL` (mặc định `postgresql://sofinhub:sofinhub@localhost:5435/sofinhub?schema=public`).

## Chạy

```bash
npm run db:up        # bật Postgres docker (chờ healthy). Ở gốc repo hoặc trong backend/ đều được
npm run db:migrate   # prisma migrate dev: áp migration (dev) / tạo migration mới khi sửa schema.prisma
npm run db:seed      # tạo khóa học + tài khoản test + ghi danh (idempotent, chạy lại không nhân đôi)
npm run db:reset     # XÓA SẠCH DB dev, áp lại migration, seed lại
npm run db:studio    # giao diện xem dữ liệu
npm run db:generate  # sinh lại client (sau khi đổi schema; migrate dev cũng tự sinh)
npm run db:down      # tắt container (dữ liệu giữ trong volume)
npm run db:deploy    # prisma migrate deploy (CI/production: chỉ áp migration có sẵn)
```

Lần đầu trên máy mới: `npm run install:all` → `npm run db:up` → `cd backend && npm run db:deploy && npm run db:seed`.
Nếu cổng 5435 bị chiếm: đặt `POSTGRES_PORT=xxxx` (file `.env` cạnh `docker-compose.yml`), sửa `DATABASE_URL` trong `backend/.env` và
`TEST_DATABASE_URL` khi chạy test. Sửa schema: sửa `schema.prisma` → `npm run db:migrate -- --name mo_ta` → commit cả thư mục migration.
Container tắt fsync (chỉ dev/test) nên không dùng cấu hình này cho production.

> Lưu ý CHECK constraint `Conversation_user_order_check` được thêm tay vào cuối migration `init` (Prisma không mô hình hóa CHECK).
> Khi tạo migration mới đừng sửa/xóa nó.

## Tài khoản test (seed)

Định nghĩa duy nhất ở `backend/prisma/seed-accounts.ts` (`SEED_ACCOUNTS`). Mật khẩu chung **`Passw0rd!x`**. Cần `PLATFORM_ADMIN_EMAILS=admin@sofinhub.test` trong `.env`.

| Email | Vai trò |
| --- | --- |
| admin@sofinhub.test | Platform Admin |
| owner@sofinhub.test | Owner của `photo`, `yt`, `fin` |
| cadmin@sofinhub.test | Admin cộng đồng `photo` |
| mod@sofinhub.test | Mod `photo` |
| member1@sofinhub.test | Member `photo`, `yt`, `fin` |
| member2@ / member3@sofinhub.test | Member `photo` |
| newbie@sofinhub.test | Chưa tham gia cộng đồng nào |
| banned@sofinhub.test | Có Enrollment ở `photo` nhưng bị `CommunityBan` (không còn là thành viên) |

Seed cũng ghi **21 Course thật** từ `courses.seed.ts` (kèm `trendingRank`, `priceCents`).

## Sơ đồ bảng

Nhóm bảng (37 bảng):

- **Auth**: `User`, `Session` (refresh token xoay vòng, id = `sid`), `OneTimeToken` (reset mật khẩu / xác thực email, chỉ lưu hash).
- **Cộng đồng**: `Course` (id = slug), `Enrollment` (PK ghép user+course, có `role`), `CommunityBan`, `JoinRequest`, `Invite`, `Review`.
- **Bảng tin**: `Post` (+ `poll` Json), `PostComment`, `PostLike`, `PostLikeNotice`, `PollVote`.
- **Sự kiện**: `CommunityEvent`, `EventRsvp` (có `remindedAt`).
- **Điểm**: `PointEvent` (sổ cái append-only; bảng xếp hạng = SUM).
- **Lớp học**: `ClassroomModule`, `ClassroomLesson`, `LessonProgress`, `ClassroomSettings`, `Certificate`.
- **Thông báo / nhắn tin**: `Notification`, `NotificationPreference`, `Conversation`, `Message`, `UserBlock`.
- **Kiểm duyệt**: `Report`.
- **Thanh toán**: `Payment` (= `PaymentIntent`), `Subscription`, `RefundRequest`, `Payout`, `InvoiceSequence`, `IdempotencyKey`, `WebhookEvent`.
- **Khác**: `Upload`, `NewsletterSubscriber`.

```mermaid
erDiagram
  User ||--o{ Session : has
  User ||--o{ OneTimeToken : has
  User ||--o{ Course : "owns (ownerId, SetNull)"
  User ||--o{ Enrollment : joins
  Course ||--o{ Enrollment : has
  Course ||--o{ CommunityBan : bans
  Course ||--o{ JoinRequest : receives
  Course ||--o{ Invite : has
  Course ||--o{ Review : has
  Course ||--o{ Post : has
  Post ||--o{ PostComment : has
  Post ||--o{ PostLike : has
  Post ||--o{ PollVote : has
  Course ||--o{ CommunityEvent : has
  CommunityEvent ||--o{ EventRsvp : has
  Course ||--o{ PointEvent : has
  User ||--o{ PointEvent : earns
  Course ||--o{ ClassroomModule : has
  ClassroomModule ||--o{ ClassroomLesson : has
  ClassroomLesson ||--o{ LessonProgress : tracked
  User ||--o{ LessonProgress : completes
  Course ||--o| ClassroomSettings : has
  Course ||--o{ Certificate : issues
  User ||--o{ Notification : receives
  User ||--o| NotificationPreference : has
  User ||--o{ Conversation : "userA / userB"
  Conversation ||--o{ Message : has
  User ||--o{ UserBlock : blocks
  Course ||--o{ Report : has
  User ||--o{ Payment : pays
  Course ||--o{ Payment : for
  Subscription ||--o{ Payment : "renewals"
  Payment ||--o{ RefundRequest : refunded
  Course ||--o{ Payout : pays_out
  User ||--o{ Upload : owns
```

### Quyết định thiết kế cần biết

- **Khóa chính**: `String @default(uuid())`; ngoại lệ: `Course.id` (slug, không default), `Invite.code`, `Certificate.code`, `Upload.key`,
  bảng liên kết dùng PK ghép (`Enrollment(userId,courseId)`, `PostLike(postId,userId)`, `EventRsvp`, `LessonProgress`, `UserBlock`, `CommunityBan`...).
  Truy cập PK ghép: `where: { userId_courseId: { userId, courseId } }`.
- **Tiền = Int cent** (`priceCents`, `amountCents`, `refundedCents`, `priceCents` của Subscription). Domain cũ có `priceUsd`/`amountUsd`:
  dùng `usdToCents` / `centsToUsd` (`src/db/enums.ts`). Không có cột Decimal/Float cho tiền. `Course.rating` là `Float` (điểm sao, không phải tiền).
- **Enum thật** cho mọi trạng thái. Trùng tên với domain nên gán thẳng, **trừ 2 enum**: `PostCategory` (DB lưu chuỗi tiếng Việt qua `@map`,
  code Prisma dùng `general|qa|case_study|announcement` → `postCategoryToDomain/FromDomain`) và `OneTimeTokenPurpose`
  (`reset_password|verify_email` ↔ domain `reset-password|verify-email`).
- **JSON**: `Post.poll` (PollDef), `ClassroomLesson.attachments`, `Message.attachments`, `NotificationPreference.types`. Ép kiểu khi đọc
  (`p.poll as unknown as PollDef | null`); ghi JSON `null` bằng `Prisma.JsonNull`/bỏ trống. `Post.tags` là `String[]` (mảng Postgres).
- **Thời gian**: `DateTime`; domain dùng ISO string → `.toISOString()` khi map ra, `new Date(iso)` khi ghi.
- **Xóa mềm**: chỉ `Course.deletedAt` (giống hiện tại). `Course.locked/lockReason` thay `setLockReason`. Tin nhắn thu hồi: `Message.deletedAt` + xóa nội dung.
- **Ban**: tồn tại dòng `CommunityBan(courseId,userId)` = đang bị cấm. `isBanned` = có dòng đó; `Enrollment` vẫn giữ (như in-memory hiện nay).
  `listMembers`/`listByUser`/`isEnrolled` phải loại người bị ban (join/`NOT EXISTS`).
- **Like**: `PostLike` (đang thích) tách khỏi `PostLikeNotice` (đã thông báo, giữ lại sau khi bỏ thích để không thông báo lặp).
  `Post.likesCount`/`commentsCount` là đếm phi chuẩn hóa — cập nhật trong **cùng transaction** với thêm/xóa like/comment.
- **Bình chọn**: mỗi đáp án 1 dòng `PollVote(postId,userId,optionId)`; `setVote` = xóa các dòng cũ của user rồi chèn mới, trong transaction.
- **Tin nhắn**: `Conversation.userAId < userBId` (có CHECK) ⇒ `findConversation(a,b)` = sắp xếp cặp rồi `findUnique({userAId_userBId})`.
  `readSeqA/B` ứng với A/B. `Message.seq` là `autoincrement` toàn cục (giống `seqCounter` cũ; khoảng trống seq là bình thường).
- **Session/token**: `Session.id` = `sid` trong JWT refresh; `refreshTokenHash` = sha256(jti hiện hành), `null` = vừa được dùng chờ cấp token kế
  (đúng ngữ nghĩa `jti = ''` cũ); `revokedAt` thay việc xóa khỏi Map. `User.tokenVersion` để vô hiệu access token cũ sau đổi mật khẩu/xóa tài khoản
  (JWT mang claim `tv`, `requireAuth` kiểm tra — đã làm ở 2A). `OneTimeToken` unique `(userId,purpose)` ⇒ cấp token mới = `upsert` (vô hiệu token cũ).
- **Thanh toán**: `Payment.invoiceNumber` unique; số hóa đơn cấp từ `InvoiceSequence` (`upsert` + `increment` trong transaction, trả về `lastNumber`).
  `transition(id, from[], patch)` = `updateMany({ where: { id, status: { in: from } }, data })` rồi đọc lại (count = 0 ⇒ `undefined`) — atomic, thay lock in-memory.
  `claimWebhookEvent` = `create` bắt `P2002` (trùng ⇒ `false`); `releaseWebhookEvent` = `deleteMany`. `IdempotencyKey` PK `(userId,key)`.
  **Đã chuyển (2B, payments-db)**: `payments.repository.ts` = `PaymentsOps` (thao tác từng bảng + `advisoryLock`/`lockCourse`/`lockNextDueSubscription` + aggregate SQL) và `repo.transaction(ops => ...)`; service chạy mọi thao tác nhiều bảng trong 1 transaction, thông báo phát sau commit. Payout tạo dưới `SELECT ... FOR UPDATE` Course; gia hạn dùng `FOR UPDATE SKIP LOCKED`; doanh thu/MRR/số dư là SQL SUM (làm tròn số nguyên basis point, khớp `Math.round` cũ). `pg_advisory_xact_lock(hashtext(...))` tuần tự hóa theo (user,course) khi cấp gói và theo payment khi hoàn tiền. Seed: `prisma/seed/payments.ts` (kịch bản trên `paid-demo`, id `seed-*`, hóa đơn cấp qua InvoiceSequence). Không thêm cột/migration.
  Payout lưu `bankName/accountHolder/accountLast4` (không có số tài khoản đầy đủ); `method.type` luôn `'bank'`.
- **onDelete**: xóa `User` ⇒ CASCADE nội dung/ghi danh/thanh toán của họ (chưa có luồng ẩn danh hóa — xem "Chưa làm"). Xóa `Course` chỉ có ý nghĩa
  với dữ liệu nội dung (CASCADE) còn `Payment/Subscription/RefundRequest/Payout` là `Restrict` (Course chỉ xóa mềm nên không gặp).
  Cột "người thực hiện" (`bannedById`, `decidedById`, `resolvedById`, `Course.ownerId`) là `SetNull`.
- **Seed vs người thật**: bài viết/sự kiện seed cũ có `seedAuthorName`/`seedHostName`; sau chuyển đổi tác giả là `User.isDemo=true` (xem dưới), nên
  các field này biến mất khỏi DB (view domain lấy tên từ User).
- **Các thứ KHÔNG lưu DB** (cố ý): outbox mail dev, vé SSE/stream, bộ đếm rate-limit, khóa/ nhớ lần gửi verify (`lastVerificationSent`), lock in-memory thanh toán.
  Reviews: điểm nền `Course.rating/ratingCount` + `Review` thật (tính lại atomically trong repository: nền = `courses.seed.ts`, không còn Map `baselines` trong bộ nhớ).

## Quy ước repository Prisma (cho agent giai đoạn sau)

1. Giữ **nguyên interface** `XRepository` và type domain; thêm `prisma<X>Repository` cạnh `inMemory...` trong `x.repository.ts` (hoặc file `x.repository.prisma.ts`),
   rồi service dùng bản Prisma. Đừng đổi chữ ký service/route. Hàm map `toDomain(row)` nằm cùng file repository (Date → ISO string, `null` → `undefined`
   khi domain dùng `?:`, cent → USD nếu domain còn `priceUsd`).
2. Import: `import { prisma, type Tx } from '../../db/prisma.js'`. Kiểu model/enum: `import type { Post } from '../../generated/prisma/client.js'`, enum từ `.../generated/prisma/enums.js`.
3. **Transaction**: `prisma.$transaction(async (tx) => { ... })` cho mọi thao tác nhiều bảng (like + đếm, comment + đếm, chuyển trạng thái payment + cấp hóa đơn...).
   Hàm nhận `tx: Tx` để tái dùng trong/ngoài transaction. Đừng dùng `prisma` bên ngoài trong callback.
4. **Race/atomic**: dùng ràng buộc unique + bắt `P2002`, hoặc `updateMany` có điều kiện (xem mục thanh toán). Mã lỗi hay gặp: `P2002` unique, `P2003` FK, `P2025` không tìm thấy khi `update`/`delete`.
5. **Không lộ Prisma ra ngoài repository**: service chỉ thấy type domain. `undefined` thay `null` cho "không tìm thấy" (giữ hợp đồng `Promise<X | undefined>`).
6. Interface hiện có là đồng bộ ở vài nơi (`NotificationsRepository`) → chuyển sang `Promise` cần sửa service tương ứng; làm đúng phạm vi module.
7. `$queryRaw` dùng tên bảng **không kèm schema** (search_path đã đặt); tên bảng/cột phân biệt hoa thường nên phải có dấu nháy kép: `"Post"`.
8. Sau khi chuyển repository: xóa state in-memory cũ, thêm test dùng DB thật (mục dưới) và cập nhật `docs/api/<nhóm>.md`.

## Viết test với DB thật

`tests/helpers.ts` (giữ nguyên chữ ký `startTestServer` / `makeClient`) luôn dùng DB thật: `startTestServer()` tạo **schema Postgres riêng**
`test_<ts>_<rand>` trong DB `sofinhub_test`, áp mọi `prisma/migrations/*/migration.sql` (~0,3–1s), đặt `DATABASE_URL` trước khi nạp app,
nạp **Course nền** (`prisma/seed-courses.ts`, createMany); `server.close()` **DROP schema**. Schema mồ côi (process bị kill) cũ hơn 30 phút tự được dọn ở lần chạy sau.

Cần `npm run db:up` trước. `TEST_DATABASE_URL` đổi DB gốc (mặc định `postgresql://sofinhub:sofinhub@localhost:5435/sofinhub_test`).
Mỗi file test là 1 process ⇒ 1 schema riêng ⇒ chạy song song an toàn.

Helper thêm: `useTestDb()` (→ `{ prisma, schema, url, reset(), seedBase(), drop() }`, dùng được độc lập, ví dụ `tests/db.test.ts`), `resetDb()`/`truncateAll()`
(TRUNCATE mọi bảng rồi nạp lại Course nền — gọi trong `beforeEach` để cô lập test).

```ts
import { makeClient, resetDb, startTestServer, useTestDb } from './helpers.js'; // helpers PHẢI là import đầu tiên
const db = await useTestDb();                 // hoặc startTestServer() (tự dùng DB thật)
beforeEach(() => resetDb());
const user = await db.prisma.user.create({ data: { ... } });
```

Quy tắc: import `helpers.js` **trước** mọi import từ `src/` (để `DATABASE_URL` được đặt trước khi `env.ts` nạp); import `src/db/prisma.js` động (`await import`) nếu file test cần.

`db.test.ts` luôn dùng DB thật và **fail** nếu Postgres chưa chạy.

### Nội dung: bài viết, sự kiện, kiểm duyệt (2B, content-db)

- **Bảng → module**: `Post/PostComment/PostLike/PostLikeNotice/PollVote` = `posts.repository.ts`; `CommunityEvent/EventRsvp` = `events.repository.ts`; `Report` = `moderation.repository.ts`.
  Không còn `ensureSeeded`, `posts.seed.ts`, `events.seed.ts`, `seedAuthorName/seedHostName` — tên tác giả/chủ trì lấy từ `User` (thành viên minh họa cũng là User `isDemo`).
- **Danh sách bài**: ghim lên đầu, sort `latest`/`popular`, lọc thể loại, lọc thẻ, ẩn bài `hidden` với member thường (tác giả + mod+ vẫn thấy), phân trang — tất cả là truy vấn DB
  (`ORDER BY pinned DESC, ...`, `LIMIT/OFFSET`, `count`). Lọc thẻ và `GET /courses/:id/tags` dùng SQL thô với `unnest(tags)` và chuẩn hóa `lower(regexp_replace(btrim(t), '^#', ''))`
  (giống `normTag`); thẻ phổ biến đếm mỗi bài 1 lần/thẻ, bỏ bài ẩn, top 20. Phụ thuộc collation UTF-8 của DB (`en_US.utf8`) để `lower()` đúng với tiếng Việt.
- **Đếm phi chuẩn hóa**: `likesCount` (like/unlike dưới `SELECT ... FOR UPDATE` hàng Post) và `commentsCount` (thêm/xóa bình luận) đổi trong cùng transaction; giảm bằng `GREATEST(x-1, 0)`.
- **Like → điểm**: `like_received` + thông báo chỉ ở lần like ĐẦU của mỗi (user, bài) (`PostLikeNotice` `createMany skipDuplicates`, count=1 mới cộng). Tác giả `isDemo` vẫn nhận like nhưng không điểm/thông báo.
- **Bình chọn**: 1 dòng `PollVote` cho mỗi đáp án; `setVote` xóa cũ rồi chèn mới trong transaction; danh sách bài nạp phiếu theo lô (không N+1).
- **RSVP sự kiện**: `toggleRsvp` trong transaction: `SELECT capacity FROM CommunityEvent WHERE id=... FOR UPDATE` -> xóa RSVP nếu có (hủy) -> đếm -> từ chối `full` nếu đủ -> tạo. Hai người tranh chỗ cuối luôn chỉ có một người vào (test chạy 8 người/3 chỗ).
- **Nhắc lịch**: `runEventRemindersOnce` chọn sự kiện có `startAt` trong (now, now+1h] bằng truy vấn, rồi `claimReminders` = `UPDATE "EventRsvp" SET remindedAt=... WHERE eventId=... AND remindedAt IS NULL RETURNING userId` (atomic) —
  nhiều instance/lần chạy song song không nhắc trùng. Đổi `startAt` -> `clearReminded` (đặt `remindedAt = NULL`) để nhắc lại.
- **Báo cáo**: migration `20260930140000_moderation_report_unique` thay index thường `(reporterId,targetType,targetId)` bằng UNIQUE (báo cáo trùng song song -> P2002 -> 409). Xử lý báo cáo chốt trạng thái bằng
  `updateMany ... WHERE status='open'` (người đến sau nhận 409). `ban_member` gọi `enrollmentService.setBanned(..., { reason: 'Bị báo cáo (<lý do>)', bannedById })`; thành viên `isDemo` không cấm được (400).
- **Xóa tài khoản = ẩn danh hóa** (migration `20260930140100_auth_user_deleted_at`, thêm `User.deletedAt`): `DELETE /auth/me` không xóa hàng User nữa. Đặt `email=deleted-<id>@deleted.invalid`, tên "Thành viên đã xóa",
  xóa bio/website/location/avatar, `passwordHash='!deleted'`, bump `tokenVersion`, thu hồi phiên, `deletedAt=now()`; xóa Enrollment, Notification, NotificationPreference, UserBlock, Conversation(+Message),
  EventRsvp, JoinRequest đang chờ, OneTimeToken. GIỮ bài viết, bình luận, like, phiếu, điểm (`PointEvent`), thanh toán, báo cáo. `userBriefView` -> "Thành viên đã xóa"; login/refresh -> 401; `GET /users/:id` -> 404.
  Email cũ đăng ký lại được (tài khoản mới). Vẫn 409 nếu còn là owner một cộng đồng.
- **Seed** (`prisma/seed/posts.ts`, `events.ts`; id xác định `seed-*`, idempotent qua `createMany skipDuplicates`; chạy sau `seedDemoMembers`):
  mọi cộng đồng có 4 bài của thành viên minh họa (1 ghim, like/bình luận là bản ghi thật; `likesCount/commentsCount` tính lại bằng SQL từ bản ghi) + 2 sự kiện (sắp tới 100 chỗ, đã qua) có RSVP minh họa.
  Kịch bản `photo` (tài khoản test): xem báo cáo cuối của đợt 2B/dưới đây — bài ảnh+thẻ của member1 (`seed-post-photo-m1-image`, member2 bình luận, member3 báo cáo đang chờ `seed-report-photo-open`),
  bài POLL đang mở (`seed-post-photo-m1-poll`, member2 vote đáp án 1), bài bị ẩn (`seed-post-photo-m1-hidden`, báo cáo đã xử lý `seed-report-photo-resolved` bởi mod), bài ghim của owner (`seed-post-photo-owner-pinned`),
  sự kiện `seed-event-photo-limited` (3 chỗ, member2 + 1 minh họa đã RSVP), `seed-event-photo-full` (đầy 2/2), `seed-event-photo-past` (đã qua, member1/member2 tham gia).

## Thành viên minh họa (`seed:` ids)

`community.seed.ts` / `posts.seed.ts` / `events.seed.ts` hiện sinh thành viên với id `seed:<courseId>:<i>`, không phải user thật. Trong DB họ là **user thật**:

- `User { isDemo: true, email: 'seed-<courseId>-<i>@demo.sofinhub.invalid', passwordHash: <chuỗi không phải hash bcrypt hợp lệ> }` ⇒ không thể đăng nhập
  (login đã `bcrypt.compare` nên luôn sai; thêm chặn `isDemo` ở login để chắc chắn).
- Có `Enrollment` role `member`/`admin` như `SeedMember`; điểm 7d/30d/all thành `PointEvent` có `createdAt` phù hợp; bài viết/bình luận/sự kiện seed
  trỏ `authorId/hostId` tới họ.
- Seed viết ở `prisma/seed/demo-members.ts` (+ `posts.ts`, `events.ts`, `points.ts`...) dùng `upsert` theo email để idempotent.
- Nơi cần loại họ ra: thống kê "online", số thành viên thật vs minh họa (dùng `isDemo`), gửi email/thông báo (bỏ qua `isDemo`), tìm kiếm người dùng.
- Sau khi chuyển xong, bỏ tiền tố `seed:` trong code và các hàm `ensureSeeded`.
- **Đã làm (communities-db)**: `prisma/seed/demo-members.ts` (User isDemo + Enrollment cho mọi Course, bulk createMany; `demoProfiles()` là hồ sơ xác định dùng chung), `prisma/seed/points.ts` (3 PointEvent/người ứng với cửa sổ ≤7d / 8–30d / >30d + điểm cho member1..3 ở photo), `prisma/seed/communities-scenarios.ts` (`private-demo`, `paid-demo`, yêu cầu tham gia, lời mời DEMO-*, review photo). Module: `communities.repository.ts` (JoinRequest/Invite/Review/ban đọc), `points.repository.ts` (SUM/GROUP BY theo cửa sổ trong DB), `community.repository.ts` (Enrollment JOIN User, phân bố cấp độ, hạng bằng SQL). `handle` không lưu DB: `community.handle.ts` tính khi đọc (nên tìm `q` theo handle lọc ở service). Bảng xếp hạng chỉ tính người đang là thành viên (có Enrollment, không bị cấm). Online = `Enrollment.lastActiveAt` trong 5 phút (thành viên minh họa online chỉ ~5 phút sau khi chạy seed).

## Nền tảng: thông báo, tin nhắn, upload, bản tin (2B platform-db)

- `notifications`: `prismaNotificationsRepository`; `notify()` vẫn đồng bộ (id/createdAt sinh ở app, createdAt tăng ngặt theo ms trong tiến trình), preference cache 5s, ghi DB nền tuần tự + `flushNotifications()` cho test; trần 200/user và dọn đã đọc >30 ngày bằng DELETE. `notificationStore.all()` là NHẬT KÝ đồng bộ trong tiến trình (test/chẩn đoán, gồm cả cái chưa ghi xong); dữ liệu thật: `notificationStore.allFromDb()` hoặc prisma. Vé/listener SSE ở bộ nhớ (nhiều instance cần Redis).
- `messages`: `prismaMessageRepository`; cặp userA/userB được sắp bằng CHÍNH so sánh của Postgres (`SELECT a::text < b::text`) vì CHECK dùng collation DB; `addMessage` = transaction (tạo Message + `GREATEST` readSeq người gửi + lastMessageAt); throttle message_received giữ bộ nhớ (chọn đơn giản: tệ nhất người nhận có thêm 1 thông báo sau restart).
- `uploads`: `prismaUploadRepository`; hạn mức = `aggregate SUM`; file trên đĩa (S3: chỉ thay `StorageProvider`, metadata giữ nguyên); nonce vé PUT ở bộ nhớ (xem docs/api/uploads.md).
- `support`: `prismaNewsletterRepository`; subscribe = `INSERT ... ON CONFLICT DO UPDATE ... WHERE unsubscribedAt IS NOT NULL RETURNING` (nguyên tử: chỉ lần đăng ký mới/đăng ký lại mới trả true => đúng 1 thư chào dù gọi song song).

### Seed thông báo & tin nhắn (`prisma/seed/messages-notifications.ts`, idempotent, id `seed-*`)

- member1: 7 thông báo (4 chưa đọc, 3 đã đọc; post_liked, post_commented, event_reminder, message_received, event_created, payment_succeeded, system; link tới `/courses/photo/community`, `/courses/photo/events`, `/courses/yt`, `/messages/seed-conv-member1-member2`, `/courses`). member1 giữ tùy chọn thông báo MẶC ĐỊNH (không có dòng NotificationPreference).
- member3: tùy chọn không mặc định (tắt post_liked + member_joined, bản tin tuần).
- Hội thoại member1↔member2 (id `seed-conv-member1-member2`): 8 tin, tin thứ 5 (member1) đã thu hồi, member2 còn 3 tin chưa đọc (tin 6-8), member1 đã đọc hết.
- UserBlock: member3 đã chặn member2 (cùng cộng đồng photo): member2 nhắn member3 => 403; member3 bỏ chặn => nhắn được.
- NewsletterSubscriber: subscriber1@, subscriber2@, member1@ (đang đăng ký) và unsubscribed@ (đã hủy) — đuôi `@sofinhub.test`.

## Chưa làm / cần quyết định

- Job dọn Session hết hạn/đã thu hồi (hiện chỉ lọc khi đọc).
- Ẩn danh hóa khi xóa tài khoản (hiện CASCADE xóa cả payment của user); ràng buộc "1 JoinRequest pending / (course,user)" mới ở mức service
  (Prisma không có partial unique index — có thể thêm bằng SQL tay trong migration mới).
- Tìm kiếm (`search`) vẫn quét bộ nhớ; chuyển sang `ILIKE`/`pg_trgm` hoặc full-text sau.
- `db:reset` chưa được kiểm chứng trong phiên dựng nền (Prisma chặn `migrate reset` khi chạy bởi AI agent nếu không có xác nhận của người dùng) — chạy thủ công một lần.
- Dockerfile đã thêm bước `prisma generate`; chưa có bước `migrate deploy` khi deploy (cần thêm vào quy trình DEPLOY.md khi có RDS).

## Lớp học (module `classroom`, đã chuyển Prisma)

- Bảng: `ClassroomModule`, `ClassroomLesson`, `LessonProgress`, `ClassroomSettings`, `Certificate`. Repo: `classroom.repository.ts` (`classroomRepository`).
- Nội dung minh họa là SEED (`prisma/seed/classroom.ts`, id xác định `mod-<courseId>-<n>`, `les-<courseId>-<n>-<m>`, thumbnail null); runtime KHÔNG còn sinh lười. Khóa đã có module thì seed bỏ qua.
- `index` do transaction đánh lại (khóa dòng Course/Module `FOR UPDATE` để tạo/xóa/sắp xếp đồng thời không trùng index); xóa module/bài cascade tiến độ.
- Điểm bài học chỉ cộng 1 lần: `LessonProgress` có dòng = đã từng hoàn thành; `toggleCompleted` chèn `ON CONFLICT DO NOTHING` — chỉ lời gọi chèn được dòng mới trả `firstTime=true`. Không thêm cột.
- Chứng nhận: mã 96-bit ngẫu nhiên (`randomBytes(12)` base64url), unique `(userId, courseId)`, `createMany skipDuplicates` nên cấp đồng thời chỉ 1 bản; xác minh công khai theo `code`.
- Truy vấn không N+1: `getModules` (2 truy vấn), `completedAtMap` (1), `getCourseLessons` (1).
- Kịch bản seed thủ công: photo (member1 xong module 1; member2 2 bài; member3 chưa học; certificatesEnabled), yt (module 2 requiredLevel=2; member1 xong module 1), fin (certificatesEnabled; member1 xong 100%, chứng nhận `FIN-DEMO-CERT-001`).
