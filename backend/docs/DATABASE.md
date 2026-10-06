# Cơ sở dữ liệu (PostgreSQL + Prisma)

Trạng thái: **giai đoạn 1 + 2A xong** — hạ tầng, schema, seed nền, hạ tầng test; **lõi đã chạy trên Postgres**: users/sessions/one-time tokens (auth),
courses, enrollments (+ban). Các module còn lại (communities, content, platform, payments...) vẫn `inMemory...`, agent 2B chuyển tiếp (xem "Quy ước repository Prisma").

### Lõi đã chuyển (2A) — điều agent sau cần biết

- `import { prisma } from '../../db/prisma.js'` trong repository. Repository: `userRepository` (`auth/auth.repository.ts`; `fileUserRepository` là alias deprecated), `courseRepository` (`inMemoryCourseRepository` là alias deprecated), `enrollmentRepository`.
- **Xác thực**: `authenticateAccessToken(token)` (`auth/tokens.ts`) -> `{ userId, sid } | null`, dùng cho mọi chỗ cần xác thực ngoài `requireAuth` (SSE...). `req.sessionId` có sau `requireAuth`. Đừng dùng `verifyAccessToken` (chỉ kiểm chữ ký).
- **Course**: `students` hiển thị = `Course.students` (số nền minh họa, CHỈ với khóa seed có `trendingRank`) + số thành viên thật (Enrollment không bị ban, `isDemo=false`); khóa người dùng tạo chỉ tính số thật. `catalogService.update(id, { locked, lockReason })` ghi `Course.lockReason` (`lockReason: null` khi mở khóa), đọc bằng `catalogService.getLockReason(id)`. `stats.admins/online` lấy từ Enrollment thật. Nội dung minh họa của trang chi tiết (highlights, gains, faqs, modules, reviews minh họa) vẫn được SINH khi đọc trong `course-detail.ts` (quyết định: chưa có hệ thống soạn nội dung khóa học riêng; chỉ course, review thật, stats lấy từ DB).
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

Seed cũng ghi **21 Course thật** từ `catalog.seed.ts` (kèm `trendingRank`, `priceCents`).

## Sơ đồ bảng

Nhóm bảng (38 bảng):

- **Auth**: `User`, `Session` (refresh token xoay vòng, id = `sid`), `OneTimeToken` (reset mật khẩu / xác thực email, chỉ lưu hash).
- **Cộng đồng**: Prisma `Community` (bảng `"Course"`, id = slug), `Enrollment` (PK ghép user+community, có `role`), `CommunityBan`, `JoinRequest`, `Invite`, `Review`. Xem "Tách Community / Khóa học" bên dưới.
- **Bảng tin**: `Post` (+ `poll` Json), `PostComment`, `PostLike`, `PostLikeNotice`, `PollVote`.
- **Sự kiện**: `CommunityEvent`, `EventRsvp` (có `remindedAt`).
- **Điểm**: `PointEvent` (sổ cái append-only; bảng xếp hạng = SUM).
- **Lớp học**: Prisma `Course` (bảng `"LearningCourse"` = khóa học), `ClassroomModule`, `ClassroomLesson`, `LessonProgress`, `ClassroomSettings`, `Certificate`.
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
  Reviews: điểm nền `Course.rating/ratingCount` + `Review` thật (tính lại atomically trong repository: nền = `catalog.seed.ts`, không còn Map `baselines` trong bộ nhớ).

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

## Admin đợt 1 (migration `20261001100000_admin_batch1`)

Chi tiết nghiệp vụ: [api/admin.md](./api/admin.md). Thay đổi schema:

- **User**: `status` (enum `UserStatus`: active/restricted/suspended/banned), `statusReason`, `statusUntil`, `statusRestrictions String[]` (post|comment|dm|create_community|purchase), `statusChangedAt`, `statusChangedById`, `lastLoginAt`; index `status`.
- **Course**: `moderationStatus` (enum `CommunityModeration`: pending_review/changes_requested/rejected/active/suspended/deleted, mặc định `active` nên dữ liệu cũ không đổi), `moderationReason/Note/Until/UpdatedAt`, `moderatedById`, `preDeleteStatus`, `deleteReason`, `deletedById` (xóa mềm vẫn dùng `deletedAt`; suspend dùng lại `locked`/`lockReason`); index `moderationStatus`.
- **Report**: `caseNo` (serial, mã `CASE-00012`), `risk` (enum `ReportRisk`), `assignedToId`, `escalatedAt`; enum `ReportStatus += under_review`, `ReportAction += warn_user/remove_content/restrict_user/suspend_user/ban_user/none`, `ReportReason += hate_speech/scam/copyright/nsfw`; thêm index `(status,risk,createdAt)`, `targetUserId`, `(targetType,targetId)`.
- **ReportEvent** (mới): lịch sử xử lý case (append-only).
- **AdminAuditLog** (mới): nhật ký hành động admin (`actorId` SetNull + `actorName` ảnh chụp, `action`, `targetType/Id/Label`, `reason/note/evidence`, `caseId`, `metadata Json`); index theo thời gian / actor / target / action.
- **Seed** (`prisma/seed/admin.ts`, chạy cuối `runSeed`, idempotent, id `seed-admin-*`): 12 người dùng thật `<tên>@sofinhub.test` (sarah, alex, daniel, maya=restricted, liam, olivia=suspended, ethan=restricted, sophia=banned, noah, emma, lucas=suspended, ava) + 2 staff (john.carter@, mia.lopez@) làm assignee; 10 cộng đồng (3 pending_review, 1 changes_requested, 1 rejected, 1 suspended, 4 trong thùng rác); 12 báo cáo đủ risk/status/assignee, ReportEvent và 11 dòng audit. Ghi chú: `seedDemoMembers` gắn thành viên minh họa cho cộng đồng mới ở lần chạy seed thứ 2 (sau đó ổn định).

## Chưa làm / cần quyết định

- Job dọn Session hết hạn/đã thu hồi (hiện chỉ lọc khi đọc).
- Ẩn danh hóa khi xóa tài khoản (hiện CASCADE xóa cả payment của user); ràng buộc "1 JoinRequest pending / (course,user)" mới ở mức service
  (Prisma không có partial unique index — có thể thêm bằng SQL tay trong migration mới).
- Tìm kiếm (`search`) vẫn quét bộ nhớ; chuyển sang `ILIKE`/`pg_trgm` hoặc full-text sau.
- `db:reset` chưa được kiểm chứng trong phiên dựng nền (Prisma chặn `migrate reset` khi chạy bởi AI agent nếu không có xác nhận của người dùng) — chạy thủ công một lần.
- Dockerfile đã thêm bước `prisma generate`; chưa có bước `migrate deploy` khi deploy (cần thêm vào quy trình DEPLOY.md khi có RDS).

## Tách Community / Khóa học (STEP 6 audit §2.1; migration `20261006100000_community_course_split`)

BRD §5.2/§6: một cộng đồng có NHIỀU khóa học. Trước đây Prisma `Course` đóng cả hai vai nên mỗi cộng đồng chỉ có một danh sách module phẳng.

**Cách làm (đổi tên + entity mới, không di chuyển dữ liệu cộng đồng):**
1. *Phase 1 — đổi tên domain, DB không đổi.* Model Prisma `Course` → `Community` (`@@map("Course")`); mọi FK `courseId` → field `communityId` (`@map("courseId")`) trên 19 bảng. `prisma migrate diff` cho kết quả rỗng (tên bảng/cột/chỉ mục/ràng buộc giữ nguyên, raw SQL cũ vẫn chạy).
2. *Phase 2 — migration `20261006100000_community_course_split`.* Thêm bảng `"LearningCourse"` (Prisma model `Course`), `ClassroomModule.learningCourseId` + `Certificate.learningCourseId` (Prisma field `learningCourseId`), backfill 1 khóa mặc định / cộng đồng (tên = tên cộng đồng) chứa toàn bộ module/chứng nhận cũ, đổi unique chứng nhận thành `(userId, learningCourseId)`.
   Lệch với kế hoạch expand→migrate→contract của audit: gộp 1 migration vì backfill xác định và không đụng cột cũ (cột `courseId` = id cộng đồng giữ nguyên; rollback chỉ cần DROP phần mới).

**Bảng đổi tên (tên Prisma ↔ tên bảng/cột DB):**

| Prisma (sau) | Bảng / cột DB | Ghi chú |
|---|---|---|
| `Community` | `"Course"` | cộng đồng (id = slug); giữ cột marketplace `rating/ratingCount/instructorName/instructorRole/durationMinutes/tag/students`; `lessons` là cột seed cũ KHÔNG còn dùng — API tính `lessons` từ lớp học |
| `Course` | `"LearningCourse"` | khóa học: `id uuid, communityId, title, description, thumbnailUrl, position, publishStatus, certificatesEnabled?, removedAt/modReason/modAt/modById, createdAt/updatedAt` |
| `<bảng>.communityId` (19 bảng) | `<bảng>."courseId"` | Enrollment, CommunityBan, JoinRequest, Invite, Review, Post, CommunityEvent, PointEvent, ClassroomModule, ClassroomLesson, ClassroomSettings, Certificate, Notification, Report, Payment, Subscription, RefundRequest, Payout, Chargeback, OwnerBalanceLedger, Upload, DiscoveryFeature |
| `ClassroomModule.learningCourseId`, `Certificate.learningCourseId` | `"learningCourseId"` | FK → `"LearningCourse"` (CASCADE) |
| `User.ownedCommunities` | — | trước là `ownedCourses` |

> Prisma không cho một field mang tên trùng với cột DB của field khác (`courseId` đã là cột của `communityId`) nên FK mới tên `learningCourseId` ở cả Prisma lẫn DB.

**ERD (phần thay đổi):**

```mermaid
erDiagram
  Community ||--o{ Course : "has many (LearningCourse)"
  Course ||--o{ ClassroomModule : contains
  Community ||--o{ ClassroomModule : "communityId (phi chuẩn hóa)"
  ClassroomModule ||--o{ ClassroomLesson : has
  Community ||--|| ClassroomSettings : "mặc định certificatesEnabled"
  Course ||--o{ Certificate : "1 / (user, khóa)"
  Community ||--o{ Certificate : communityId
```

- Khóa **mặc định** = `published` đầu tiên theo `(position, createdAt)` (không có thì khóa chưa gỡ đầu tiên). Route cũ `/courses/:id/modules|progress|certificate` thao tác trên khóa này.
- Tạo cộng đồng = 1 transaction: `Community` + `Enrollment(owner)` + `Course` mặc định (+ thử slug kế tiếp khi đua unique). Cộng đồng tạo thẳng bằng DB (test/seed cũ) được `ensureDefault` tạo khóa khi cần (thêm module qua route cũ).
- Thứ tự/khóa tuần tự của module và `requiredLevel` tính TRONG từng khóa (khóa dòng `"LearningCourse"` khi đổi `index`); điểm/level vẫn theo cộng đồng.
- `ClassroomSettings.certificatesEnabled` = mặc định của cộng đồng; `Course.certificatesEnabled` (nullable) ghi đè: `certificatesEffective = course ?? settings`.
- Seed (`prisma/seed/courses.ts`, `classroom.ts`): khóa mặc định id `course-<community>-main`; photo (2 khóa), yt (2, khóa 2 ghi đè chứng nhận), fin (3, 1 nháp); chứng nhận cố định `FIN-DEMO-CERT-001` (khóa mặc định fin) + `PHOTO-DEMO-CERT-002` (khóa "Chỉnh sửa ảnh nâng cao"). Admin Content "khóa học" (`prisma/seed/admin-batch2.ts`) = các khóa id `seed-b2-course-*`.

## Lớp học (module `classroom`, đã chuyển Prisma)

> Cập nhật tách Community/Khóa học: khóa học → module → bài; xem mục "Tách Community / Khóa học" ở trên. Repo: `classroom.repository.ts` (module/bài/tiến độ/chứng nhận), `learning-catalog.repository.ts` (khóa học).


- Bảng: `ClassroomModule`, `ClassroomLesson`, `LessonProgress`, `ClassroomSettings`, `Certificate`. Repo: `classroom.repository.ts` (`classroomRepository`).
- Nội dung minh họa là SEED (`prisma/seed/classroom.ts`, id xác định `mod-<communityId>-<n>`, `les-<communityId>-<n>-<m>`, thumbnail null); runtime KHÔNG còn sinh lười. Khóa đã có module thì seed bỏ qua.
- `index` do transaction đánh lại (khóa dòng Course/Module `FOR UPDATE` để tạo/xóa/sắp xếp đồng thời không trùng index); xóa module/bài cascade tiến độ.
- Điểm bài học chỉ cộng 1 lần: `LessonProgress` có dòng = đã từng hoàn thành; `toggleCompleted` chèn `ON CONFLICT DO NOTHING` — chỉ lời gọi chèn được dòng mới trả `firstTime=true`. Không thêm cột.
- Chứng nhận: mã 96-bit ngẫu nhiên (`randomBytes(12)` base64url), unique `(userId, learningCourseId)` (1 chứng nhận / user / KHÓA HỌC), `createMany skipDuplicates` nên cấp đồng thời chỉ 1 bản; xác minh công khai theo `code`.
- Truy vấn không N+1: `getModules` (2 truy vấn), `completedAtMap` (1), `findLesson` (1 JOIN bài+module+khóa).
- Kịch bản seed thủ công: photo (member1 xong module 1; member2 2 bài; member3 chưa học; certificatesEnabled), yt (module 2 requiredLevel=2; member1 xong module 1), fin (certificatesEnabled; member1 xong 100%, chứng nhận `FIN-DEMO-CERT-001`).

## Admin đợt 2 (migration `20261002100000_admin_batch2`)
Chi tiết nghiệp vụ: [api/admin-batch2.md](./api/admin-batch2.md). Thay đổi schema:
- **Enum mở rộng**: `CourseCategory` + `marketing`, `design` (chỉ dùng được sau khi admin thêm vào `DiscoveryCategory`); `SubscriptionStatus` + `past_due`, `paused`; `PayoutStatus` + `failed`, `on_hold`. Enum mới: `ContentPublishStatus`, `DiscoveryStatus`, `SearchVisibility`, `ChargebackStatus`, `ChargebackReason`.
- **Gỡ/ẩn nội dung** (cùng bộ cột `modReason/modAt/modById`): `Post`/`PostComment` + `removedAt` (removed = `hidden=true` + `removedAt`; mọi truy vấn công khai bỏ qua bản ghi `removedAt`); `ClassroomLesson` + `hidden`, `removedAt`; `ClassroomModule` + `publishStatus`, `removedAt` (thành viên chỉ thấy module `published` chưa gỡ); `CommunityEvent` + `cancelledAt`, `cancelReason`, `removedAt`; `Upload` + `flagged`, `flagReason`, `removedAt` (`/api/files/:key` trả 404 khi đã gỡ).
- **Thanh toán**: `Payment.failureReason`; `Payout.failureReason`, `heldFromStatus`; bảng **Chargeback** (MÔ PHỎNG, `caseNo` tự tăng -> `CB-00771`, liên kết Payment/Course/User, bằng chứng, hạn trả lời, `gatewayDisputeId` giả).
- **Discovery**: `Course.discoveryStatus` (listed|hidden|unlisted), `searchVisibility` (searchable|reduced|hidden), `discoveryReason/UpdatedAt/UpdatedById`; bảng **DiscoveryCategory** (khóa = giá trị enum `CourseCategory`, tên/mô tả/status/position; migration nạp sẵn 8 danh mục cũ), **DiscoveryFeature** (ghim theo `section`, `position`, `startsAt/endsAt`, unique (section, courseId)), **PlatformSetting** (key-value Json; hiện có `discovery.rankingWeights`).
- **Seed** (`prisma/seed/admin-batch2.ts`, chạy ngay sau seed đợt 1, idempotent, id UUID tất định suy từ tên `seed-admin2-*`): 6 cộng đồng mới (5 có phí + `spam-hub` unlisted/hidden-from-search), ~110 giao dịch đủ trạng thái (succeeded/failed/pending/refunded một phần và toàn phần), gói (active/past_due/paused/canceled/expired/trialing), 8 hoàn tiền (pending/approved/rejected), 7 chargeback mô phỏng (open/under_review/won/lost), 10 payout (requested/approved/paid/failed/on_hold/rejected), 14 bài + 10 bình luận (hidden/removed) + 5 báo cáo mở, 8 khóa + 32 bài học (draft/archived/removed/hidden), 8 sự kiện (upcoming/live/completed/cancelled/removed), 12 media (flagged/removed; chỉ metadata — không có file thật), mục ghim cho 4 section, trọng số xếp hạng mặc định, 13 dòng audit. Ghi chú: giống đợt 1, `seedDemoMembers` gắn thành viên minh họa cho 6 cộng đồng mới ở lần seed thứ 2 rồi ổn định.

## Admin đợt 3 (migration `20261003100000_admin_batch3`)
Chi tiết nghiệp vụ: [api/admin-batch3.md](./api/admin-batch3.md). Thay đổi schema (chỉ thêm bảng/enum, bảng cũ chỉ thêm quan hệ ngược trên `User`):
- **Hỗ trợ**: enum `SupportCategory` (user|creator|payment), `SupportPriority`, `SupportTicketStatus` (new|open|awaiting_reply|resolved|closed), `SupportMessageKind` (customer|staff|internal_note|system); bảng **SupportTicket** (`number` tự tăng -> mã `T-${2000+number}`, requester có thể null = khách chỉ có email, `assigneeId`, `escalated`, `firstResponseAt/resolvedAt/closedAt/lastActivityAt`, `source` contact_form|user|admin) và **SupportTicketMessage** (cascade theo ticket).
- **Nhân viên**: **AdminRole** (khóa chuỗi, `permissions String[]`, `isSystem`; migration NẠP SẴN 4 vai trò hệ thống super_admin/moderator/support/finance để schema test không cần seed) và **AdminAccount** (PK = `userId`, `roleKey`, `status` active|suspended, `twoFactorEnabled` chỉ là cờ, `invitedById`). Email trong `PLATFORM_ADMIN_EMAILS` không có hàng ở đây (luôn Super Admin).
- **Hệ thống**: **FeatureFlag** (`stage` draft|beta|active, `enabled`, `rolloutPercent`), **Integration** (cấu hình không nhạy cảm + `secretMask` 4 ký tự cuối; KHÔNG lưu khóa thật), **EmailTemplate** (`subject`/`body` Json `{en,vi}`, `variables`, `status` active|draft|disabled, `isSystem`), **PlatformBroadcast** (lịch sử thông báo hệ thống). Cấu hình nền tảng dùng lại **PlatformSetting**: khóa `global.settings` (chỉ lưu các khóa bị ghi đè; mặc định ở env) và `admin.alerts` (cài đặt cảnh báo cho đội admin).
- **Seed** (`prisma/seed/admin-batch3.ts`, chạy cuối `runSeed`, idempotent, id `seed-admin3-*`/UUID suy từ tên): vai trò tuỳ chỉnh `content_reviewer`; nhân viên `moderator@`, `support@`, `finance@`, `tom@`, `nina@` (suspended) + `john.carter@`, `mia.lopez@` làm Moderator; 22 ticket (3 nhóm x đủ 5 trạng thái, 4 mức ưu tiên, 2 đã escalate, có tin nhắn/ghi chú nội bộ); 6 feature flag, 8 tích hợp, 7 mẫu email (en+vi; `verify_email`/`reset_password` đang `active` nên được dùng thật), 2 broadcast, 6 dòng audit của nhân viên (có IP). Để Analytics có hình dạng: rải lại `User.createdAt` của thành viên demo trong 150 ngày (chỉ khi vừa seed trong 3 ngày gần nhất), dời `Enrollment.enrolledAt` tương ứng và thêm Session đã thu hồi mô phỏng "quay lại" ở các tuần 1/2/4/8/12. Lưu ý: số liệu "New users" của Dashboard đợt 1 trên DB dev vì vậy phân bố theo 150 ngày thay vì dồn vào ngày seed.

## Vòng đời tiền + điểm (migration `20261004100000_money_lifecycle_points`)
- **Subscription**: partial unique index `Subscription_one_live_per_user_course` = `UNIQUE(userId, courseId) WHERE status IN ('trialing','active')` (Prisma không khai báo được — chỉ có trong SQL migration; `prisma migrate diff` sẽ báo lệch, bỏ qua). Migration tự dọn gói trùng (giữ gói `active`/mới nhất, còn lại `canceled`).
- **RefundRequest**: enum `RefundStatus` + `refunding`; cột `gatewayRefundId`, `refundingAt` (khóa idempotency gửi cổng = `id`).
- **WebhookEvent**: enum `WebhookStatus` (`received|processing|done|failed`); cột `type`, `payload` (Json), `status`, `attempts`, `lastError`, `processingAt`, `processedAt`, `updatedAt`; index `(status, updatedAt)`. Dòng cũ backfill `done`.
- **OwnerBalanceLedger** (mới): `courseId, ownerId?, kind (refund_after_payout|chargeback_after_payout|adjustment), amountCents (<0 = nợ), paymentId?, refundId?, note?` — append-only, ghi khi hoàn tiền/chargeback làm số dư ròng của owner âm.
- **PointEvent**: enum `PointReason` + `revoked`; cột `sourceType`, `sourceId`; `UNIQUE(userId, reason, sourceType, sourceId)` (NULL không đụng nhau nên dòng cũ vẫn hợp lệ), index `(sourceType, sourceId)`.
- Thứ tự khóa trong các transaction tiền: advisory `sub:<user>:<course>` → hàng Subscription (`FOR UPDATE`) → Payment → … → `InvoiceSequence` (cuối cùng). Cổng thanh toán KHÔNG được gọi trong transaction (hoàn tiền 2 pha, xem `docs/api/payments.md`).

## Tìm kiếm toàn văn + index FK (STEP 8; migration `20261005100000_search_fulltext`, `20261005100100_fk_indexes`)
Chi tiết hành vi: [api/search.md](./api/search.md).
- **Extension `pg_trgm`** (cài vào schema `public` nếu chưa có). Hàm SQL IMMUTABLE `sf_fold(text)` (gập dấu + hạ chữ thường), `sf_tags(text[])`, `sf_tagnorm(text[])` (chuẩn hóa thẻ: trim, bỏ `#`, chữ thường). Hàm nằm trong schema của app (`search_path`), nên mỗi schema test có bản riêng; riêng `pg_trgm` dùng chung ở `public` (migration chịu được nhiều process cùng tạo; opclass/toán tử được tra schema động).
- **Cột sinh sẵn `searchVector tsvector GENERATED ALWAYS AS (...) STORED`** trên `Course`, `Post`, `User` + GIN (`Course_searchVector_idx`, `Post_searchVector_idx`, `User_searchVector_idx`). Prisma khai báo `Unsupported("tsvector")?` (không ghi được, seed/`create` bỏ qua; đọc bằng `$queryRaw`). Trigram GIN dạng expression: `Course_title_trgm_idx` (`sf_fold(title)`), `User_name_trgm_idx` (`sf_fold(firstName || ' ' || lastName)`) — không khai báo được trong Prisma nên `migrate diff` bỏ qua.
- **Lệch `migrate diff` cần biết**: 3 dòng `ALTER COLUMN "searchVector" DROP DEFAULT` (Course/Post/User) xuất hiện vì Prisma không biết cột generated — KHÔNG đưa vào migration mới (sẽ lỗi). Cùng loại với partial unique index của Subscription.
- **Index FK đã thêm (18)**: Certificate.courseId, CommunityBan.userId + bannedById, CommunityEvent.hostId, Invite.createdById, JoinRequest.decidedById, Notification.courseId, PollVote.userId, PostLikeNotice.userId, RefundRequest.userId + resolvedById, Report.resolvedById (+ assignedToId, thêm bởi đợt sau; `targetUserId` đã có), Review.userId, Upload.courseId, ReportEvent.actorId, Chargeback.userId, DiscoveryFeature.courseId. Test `tests/perf-sql.test.ts` kiểm bằng `pg_constraint` ⋈ `pg_index` rằng không còn FK nào thiếu index dẫn đầu.
- **Index `Post`**: `(courseId, pinned, likesCount, createdAt)` cho `sort=popular` (quét ngược), `(courseId, category, createdAt)` cho lọc category, GIN `Post_tagsnorm_gin_idx` trên `sf_tagnorm(tags)` cho lọc thẻ (truy vấn dùng `sf_tagnorm(tags) @> ARRAY[tag]`).
- Lưu ý vận hành: `ADD COLUMN ... GENERATED STORED` viết lại bảng (khóa ACCESS EXCLUSIVE) — chạy migration lúc ít tải nếu `Post` lớn.

### Số truy vấn trước/sau (đo bằng `tests/query-count.test.ts`)
Đếm câu SQL thật gửi Postgres (patch `pg.Client.query`, bỏ BEGIN/COMMIT). Các lần gọi qua HTTP đã gồm ~2 truy vấn của middleware xác thực. Test giữ làm hàng rào chống tái phát (ngưỡng ở cuối cột "sau").

| Điểm nóng | Dữ liệu đo | Trước | Sau |
|---|---|---|---|
| `GET /search` (type=all) | 3 cộng đồng x 20 thành viên x 120 bài (gọi service) | 125 (tăng tuyến tính theo số bài/thành viên, ~55 truy vấn/trang x tối đa 20 trang x mỗi cộng đồng: ~11.000 ở quy mô audit) | 7 (cố định: phạm vi + 3 đếm + <=3 trang) |
| `GET /search/suggest` | như trên | 125 (chạy cả phép quét rồi cắt 5) | 5 (3 truy vấn `LIMIT 5`) |
| `GET /conversations` | 20 hội thoại | 45 (~2/hội thoại + cố định; audit: 4/hội thoại) | 3 (1 truy vấn + auth), bất kể số hội thoại |
| `GET /courses/:id/lessons/:lessonId` | khóa 4 module x 12 bài, thân bài 5KB | 21, gồm 1 truy vấn nạp thân bài của MỌI bài trong khóa (~20MB ở quy mô audit) | 10, không nạp thân bài nào ngoài bài đang mở |
| `GET /me/enrollments` | 8 cộng đồng, mỗi khóa 4 module | 44 (~5/cộng đồng, tuần tự) | 6 (ghi danh 2 + thông tin khóa 1 + tiến độ gộp 1 + auth 2), bất kể số cộng đồng |

Thay đổi khác cùng đợt (không đo bằng số): mọi route lớp học/bảng tin bỏ tải `Course` thừa (`requireMembership` dùng `lockState` 1 truy vấn nhẹ + `touchIfMember` 1 câu `UPDATE ... RETURNING`; `policy.getRole` còn 1 truy vấn thay vì 2); thông báo "xin vào"/xóa/khóa cộng đồng và sự kiện mới không còn nạp toàn bộ thành viên (lọc/duyệt theo lô trong SQL; sự kiện mới rải cho MỌI thành viên, lô đầu 500 trong request, các lô sau chạy nền — hết cắt cứng 200); `pollTallies` gộp phiếu bầu bằng `GROUP BY` (poll 20.000 phiếu ⇒ vài dòng); `GET /courses?q=` chọn id bằng SQL thay vì đọc cả bảng; feed có `cursor` keyset (+ `hasMore`/`nextCursor`), bình luận có `limit`/`cursor` (mặc định 100).

## Wizard tạo cộng đồng + gói năm + thẻ (migration `20261007100000_community_wizard_annual`, `20261007100100_wizard_card_indexes`)
- Enum mới: `BillingInterval(monthly|annual)`, `HostingPlanKey(start|pro)`, `HostingPlanStatus(trialing|active|canceled)`, `PayoutAccountStatus(connected|skipped)`; `CommunityModeration` thêm `draft`; `CourseCategory` thêm `music`, `sports`, `spirituality`.
- `Course` (bảng cộng đồng) thêm: `priceAnnualCents`, `logoUrl`, `coverUrl`, `brandColor`, `promise`, `benefits text[]`, `introVideoUrl`, `rules jsonb [{title,body}]`, `joinQuestions text[]`, `memberTrialEnabled` (mặc định true), `requireRulesAgreement`, `autoApprovePaid`, `draftSteps text[]`. Bản nháp = `moderationStatus='draft'` (không có Enrollment/khóa học; mọi bộ lọc công khai đã lọc `active` nên tự ẩn; admin/seed lọc thêm `draft`).
- `JoinRequest` thêm `answers jsonb [{question,answer}]` (bản chụp), `rulesAcceptedAt`.
- `Payment` / `Subscription` thêm `interval` (mặc định monthly) + `paymentCardId` (FK `PaymentCard`, SET NULL); `Subscription.trialReminderSentAt` (claim nhắc idempotent).
- Bảng mới: `PaymentCard` (userId, gatewayToken, brand, last4, expMonth, expYear; unique(userId, gatewayToken) — KHÔNG PAN/CVC), `HostingPlan` (1/cộng đồng, MÔ PHỎNG), `PayoutAccount` (1/cộng đồng, chỉ 4 số cuối, MÔ PHỎNG).
- Seed (`prisma/seed/community-wizard.ts`, chạy cuối `runSeed`): 3 nháp của owner test (`draft-gom-cuoi-tuan`, `draft-chay-bo-5k` có gói hosting dùng thử + thẻ mô phỏng, `draft-viet-content` sẵn sàng publish + payout mô phỏng), 3 danh mục Discovery mới, cộng đồng `annual-demo` ($7/tháng, $48/năm) trong `communities-scenarios.ts`. Các seed khác lọc `draft` nên không sinh thành viên/bài viết cho nháp; chạy 2 lần cho số liệu giống nhau.

## Migration `20261009100000_classroom_module_access`
- Enum `ModuleAccessMode` (all/level/paid/selected), `ModuleAccessSource` (selected/purchase). `ClassroomModule` + `accessMode` (mặc định `all`; backfill `level` nếu `requiredLevel IS NOT NULL`), `priceCents`, `sequential`. `ClassroomLesson.isPreview`. Bảng `ModuleAccess(moduleId,userId,source,createdAt)` PK (moduleId,userId), cascade theo module/user.
