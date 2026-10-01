# API nhóm Identity: tài khoản, hồ sơ, email

Tất cả path dưới đây nằm sau tiền tố `/api`. Thành công: `{ data: ... }`. Lỗi: xem `HttpError`.

## Endpoint

| Method | Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | /auth/forgot-password | - (rate limit IP: 5/15 phút) | `{email}` | 200 `{message}` (luôn giống nhau) | 400, 429 |
| POST | /auth/reset-password | - | `{token, password}` | 200 `{message}` | 400 (token sai/hết hạn/đã dùng, mật khẩu yếu) |
| POST | /auth/change-password | Bearer | `{currentPassword, newPassword}` | 200 `{message}` | 400 (sai mật khẩu hiện tại, trùng cũ, mật khẩu yếu), 401 |
| GET | /auth/me | Bearer | - | `AuthUser` (+ bio, location, website, avatarUrl, emailVerified) | 401 |
| PATCH | /auth/me | Bearer | `firstName, lastName, bio(<=500), location, website(http/https), avatarUrl(http/https hoặc /files/...)`; `""`/`null` = xóa trường | `AuthUser` | 400, 401 |
| DELETE | /auth/me | Bearer | `{password}` | 204 | 400 (thiếu/sai mật khẩu), 401, 409 (đang là owner cộng đồng) |
| POST | /auth/send-verification | Bearer | - | 202 `{message}` | 401, 409 (đã xác thực), 429 (1 lần/60s/user) |
| POST | /auth/verify-email | - | `{token}` | 200 `AuthUser` | 400 |
| GET | /auth/sessions | Bearer | - | `[{id, createdAt, lastUsedAt, ip, userAgent, current}]` | 401 |
| DELETE | /auth/sessions/:id | Bearer | - | 204 | 401, 404 |
| POST | /auth/logout-all | Bearer | - | 204 | 401 |
| GET | /users/:id | Bearer | - | `{id, name, bio, location, website, avatarUrl, joinedAt, communities:[{course, role, joinedAt}], totalPoints}` (không có email; chỉ cộng đồng public) | 401, 404 |
| GET | /me/enrollments | Bearer | - | `[{course, role, enrolledAt, progressPct}]` | 401 |
| GET | /me/points | Bearer | - | `{total, byCourse:[{course, points}], recent:[PointEvent x20]}` | 401 |
| POST | /newsletter | - (rate limit IP) | `{email}` | 200 `{subscribed:true}` (idempotent) | 400, 429 |
| POST | /newsletter/unsubscribe | - | `{email}` | 200 `{unsubscribed:true}` | 400, 429 |
| POST | /contact | - (rate limit IP: 5/15 phút) | `{name, email, subject, message<=5000}` | 202 `{message}` | 400, 429 |
| GET | /dev/outbox?to= | - | chỉ mount khi `ENABLE_DEV_OUTBOX=1` (độc lập NODE_ENV; production cấm bật, app không khởi động) | `[{id,to,subject,text,html,sentAt}]` | - |

## Quyết định thiết kế

- **Token một lần** (`auth/one-time-tokens.ts`, bảng `OneTimeToken`, unique `(userId, purpose)` nên phát hành mới = upsert đè token cũ): 32 byte ngẫu nhiên (base64url), chỉ lưu sha256; reset TTL 30 phút, verify TTL 24 giờ; dùng xong hoặc phát hành token mới cùng mục đích thì token cũ vô hiệu. Token không bao giờ nằm trong response API, chỉ trong email (dev: `/dev/outbox`).
- **Link email**: `{FRONTEND_URL}/reset-password?token=...`, `{FRONTEND_URL}/verify-email?token=...`. Env mới: `FRONTEND_URL`, `SUPPORT_EMAIL`.
- **Mail** (`modules/mail`): interface `MailProvider`; dev/test dùng outbox trong bộ nhớ (tối đa 200 thư); production chưa cấu hình thì chỉ log (không lưu nội dung vì chứa token). Nối AWS SES: xem ghi chú trong `mail.service.ts`, gọi `setMailProvider()`. Lỗi gửi mail bị nuốt và log, không làm hỏng request.
- **Sai mật khẩu hiện tại trả 400** (không 401) để FE không hiểu nhầm là hết phiên rồi tự đăng xuất.
- **Phiên đăng nhập** (bảng `Session`): id = `sid`. Refresh token JWT mang `sid` + `jti`; DB lưu sha256(jti) hiện hành (`null` = vừa dùng, chờ cấp token kế). Xoay token bằng `updateMany` có điều kiện (atomic, dùng lại token cũ -> 401). Có `ip`, `userAgent`, `lastUsedAt`, `revokedAt`, `expiresAt`. Phiên **bền qua restart server**.
- **Thu hồi access token có hiệu lực NGAY**: access token JWT mang `sid` (phiên) và `tv` (`User.tokenVersion`). `requireAuth`/`optionalAuth` (async) gọi `authenticateAccessToken` (`auth/tokens.ts`): verify chữ ký+hạn rồi 1 truy vấn theo PK: phiên tồn tại, đúng chủ, chưa `revokedAt`, chưa hết hạn, và `user.tokenVersion === tv`; sai -> 401. Không cache (mỗi request 1 query PK). Token kiểu cũ (không có `sid`/`tv`) bị từ chối — FE tự `refresh` bằng cookie. SSE (`/notifications/stream`, `/messages/stream`) dùng chung hàm này; vé (ticket) vẫn dùng 1 lần như cũ.
  - **Đổi mật khẩu** (`change-password`): thu hồi mọi phiên KHÁC (token của chúng chết ngay), **giữ phiên hiện tại** (phiên của access token đang gọi; cookie chỉ là dự phòng). Không tăng `tokenVersion` vì sẽ giết luôn token phiên hiện tại mà response không đổi hình dạng nên không thể cấp lại token.
  - **Reset mật khẩu**: tăng `tokenVersion` + thu hồi mọi phiên -> mọi access/refresh token cũ chết ngay.
  - **Logout** thu hồi mọi phiên (hành vi vốn có); **logout-all** như logout + tăng `tokenVersion`. **Thu hồi 1 phiên** (`DELETE /auth/sessions/:id`): chỉ token của phiên đó chết ngay. **Xóa tài khoản**: tăng `tokenVersion`, thu hồi phiên, ẩn danh hóa user (giữ hàng User) -> token chết ngay.
  - "Phiên hiện tại" (`current` trong `GET /auth/sessions`) = `sid` của access token; nếu không có access token hợp lệ thì dự phòng bằng cookie refresh (path `/api/auth`).
- `POST /auth/logout` vốn đã thu hồi mọi phiên của user (hành vi cũ, giữ nguyên); `logout-all` là bí danh rõ nghĩa.
- **Xóa tài khoản = ẩn danh hóa** (không xóa hàng User; `User.deletedAt`): email đổi thành `deleted-<id>@deleted.invalid`, tên "Thành viên đã xóa", xóa hồ sơ, mật khẩu vô hiệu; xóa ghi danh/thông báo/chặn/hội thoại/RSVP; GIỮ bài viết, bình luận, điểm, thanh toán. `userBriefView` trả "Thành viên đã xóa"; login/refresh 401; `GET /users/:id` 404; email cũ đăng ký lại được. Owner phải chuyển quyền trước (409).
- **Người dùng** ở bảng `User` (Prisma, `auth.repository.ts` -> `userRepository`; `fileUserRepository` chỉ còn là alias deprecated). `tokenVersion` và `isDemo` không bao giờ nằm trong response. Thành viên minh họa (`isDemo`) không đăng nhập được. `emailVerified` mặc định `false`.
- **Nhập user cũ**: `npm run db:import-users [file]` nhập `backend/data/users.json` (deprecated, app không còn đọc) giữ nguyên id/passwordHash/createdAt; idempotent (trùng id/email bị bỏ qua).
- **Cooldown gửi verify** (60s) dùng `createdAt` của token verify hiện hành trong `OneTimeToken` (bền vững, không còn Map trong bộ nhớ).
- **Hồ sơ công khai** chỉ liệt kê cộng đồng `visibility=public`; `progressPct` = bài hoàn thành / tổng bài trong classroom.
- Hàm thêm vào file dùng chung: `pointsService.summaryForUser`, `PointsRepository.listByUser` (module points); `UserRepository.update/delete`; env `FRONTEND_URL`, `SUPPORT_EMAIL`.

## Giới hạn hiện tại (mô phỏng / in-memory)

- Danh sách newsletter vẫn nằm trong bộ nhớ (module khác). Phiên, token một lần, cooldown verify đã ở Postgres.
- Rate limit dùng bộ nhớ của express-rate-limit (theo instance); nhiều instance cần store chung (Redis). Rate limit bị nới rất lớn khi `NODE_ENV=test`.
- Chưa có nhà cung cấp email thật (SES/SMTP); production hiện chỉ log cảnh báo.
- Mỗi request có xác thực tốn 1 truy vấn PK vào `Session` (kèm `User.tokenVersion`); chưa cache. Phiên hết hạn/đã thu hồi chưa có job dọn dẹp định kỳ (chỉ lọc khi đọc).
- Xóa tài khoản không xóa điểm, bài viết, thông báo của user (giữ có chủ đích).
- Nếu user bị ban khỏi cộng đồng, bản ghi ban không được dọn khi xóa tài khoản.

## Chưa làm / cần quyết định

- Link hủy newsletter có token ký trong email (hiện ai biết email cũng hủy được).
- Đổi email (cần xác thực lại email mới).
- Bắt buộc `emailVerified` cho một số thao tác (thanh toán, đăng bài?) là quyết định sản phẩm.
- Chuyển quyền owner cộng đồng (thuộc nhóm community), để người dùng gỡ được điều kiện 409.
