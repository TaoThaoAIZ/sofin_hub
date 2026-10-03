# API Thông báo

Module: `src/modules/notifications/`. Các module khác chỉ gọi `notify({...})` (chữ ký không đổi); `notificationStore.all()/onNew()` vẫn giữ.
Response: `{ data }`; danh sách: `{ data, meta }`. Mọi route cần `Authorization: Bearer` (trừ khi ghi khác).

| Method | Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| GET | `/notifications` | Bearer | `unread=true\|false`, `page`, `limit` (<=50, mặc định 20) | `{data: Notification[], meta}` mới nhất trước, chỉ của mình | 400, 401 |
| GET | `/notifications/unread-count` | Bearer | - | `{data: {count}}` | 401 |
| POST | `/notifications/:id/read` | Bearer | - | `{data: Notification}` (idempotent) | 401, 404 |
| POST | `/notifications/read-all` | Bearer | - | `{data: {updated}}` | 401 |
| DELETE | `/notifications/:id` | Bearer (chủ sở hữu) | - | `{data: {deleted: true}}` | 401, 404 |
| GET | `/notifications/preferences` | Bearer | - | `{data: {types, emailDigest, quiet, dmAllowed, emailUnreadDm, notifyFollowedPosts, communityPrefs, communities[]}}` (chi tiết: `settings-notify-communities.md`) | 401 |
| PUT | `/notifications/preferences` | Bearer | `{types?: {post_liked?: boolean,...}, emailDigest?: 'off'\|'instant'\|'daily'\|'weekly', quiet?, dmAllowed?, emailUnreadDm?, notifyFollowedPosts?, communityPrefs?}` (cập nhật từng phần) | preferences mới | 400 (khóa lạ, tắt loại bắt buộc, body rỗng), 401 |
| POST | `/notifications/stream-ticket` | Bearer | - | 201 `{data: {ticket, expiresInSec: 30}}` | 401 |
| GET | `/notifications/stream` | Bearer header, hoặc `?ticket=` (KHÔNG nhận `?access_token=`) | - | SSE `text/event-stream` | 401 |

## Realtime SSE
- Sự kiện: `event: notification` + `data: <JSON Notification>`; comment `: heartbeat` mỗi 25s; `retry: 5000`.
- Header: `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` (nginx không đệm). Khi client ngắt: dừng heartbeat và gỡ listener.
- `EventSource` không đặt được header nên có 2 cách xác thực (chỉ route này): Bearer header (dùng `fetch` stream) hoặc `?ticket=` (một lần, TTL 30s; khuyến nghị cho `EventSource`).
- **Khuyến nghị**: FE gọi `POST /notifications/stream-ticket` (có Bearer) rồi mở `new EventSource('/api/notifications/stream?ticket=...')`. Vé dùng 1 lần, sống 30s, nên URL bị lộ vào log cũng vô hại.
- **Đã bỏ `?access_token=`** (audit 2026-10-01 mục 4.4): token nằm trong URL sẽ lọt vào access log/Referer. Request mang `?access_token=` bị 401. Ngoài ra morgan che `access_token|refresh_token|token|ticket|sig` trong URL và Referer (`middlewares/request-logger.ts`). Test: `tests/security-hardening.test.ts`.
- Không có replay: mất kết nối thì FE gọi lại `GET /notifications` để bù.

## Quyết định thiết kế
- `notify()` tôn trọng preference: loại bị tắt thì không lưu và không phát. Mặc định bật hết. Loại bắt buộc (luôn gửi, không tắt được): `payment_succeeded`, `payment_failed`, `role_changed`, `removed_from_community`, `report_resolved` (`MANDATORY_TYPES`).
- Thông báo của người khác trả 404 (không lộ tồn tại).
- Postgres (bảng `Notification`, `NotificationPreference`): tối đa 200 thông báo/user và dọn đã đọc >30 ngày bằng truy vấn DELETE mỗi khi ghi thông báo mới; `GET /notifications` không trả cái đã đọc quá hạn.
- `notify()` vẫn đồng bộ (trả ngay object, id/createdAt sinh tại app); kiểm tra preference (cache 5s) rồi phát SSE ngay, ghi DB chạy nền tuần tự, lỗi ghi được bắt + log. Các endpoint đọc/ghi tự chờ ghi nền của tiến trình nên nhất quán ngay sau `notify()`. Test dùng `flushNotifications()`.
- Đường dẫn cố định (`/preferences`, `/unread-count`, `/stream`) khai báo trước `/:id`.

## Giới hạn hiện tại
- Dữ liệu thông báo/preference bền vững (Postgres). Vé SSE (30s, 1 lần, `GETDEL` atomic), fan-out SSE (pub/sub `notif:new`) và vô hiệu cache preference (`notif:prefs`) nằm ở state chia sẻ: Redis khi đặt `REDIS_URL` (mint ở instance A redeem được ở B), nếu không thì in-memory (đúng cho 1 instance). Ghi DB nền có retry+backoff (`notificationWriteRetry`); thất bại hẳn => log + thư chết (`deadLetters()`) + `notify(..., { onWriteFailed })` để nhả cờ chống-trùng (nhắc lịch sự kiện, `PostLikeNotice`). SSE chỉ phát SAU khi hàng đã commit (không có thông báo ma). Test: `tests/notifications-durability.test.ts`.
- Thông báo đang ghi nền mà tiến trình chết đúng lúc đó thì mất (chấp nhận: thông báo không phải dữ liệu tiền tệ).
- Dọn thông báo cũ theo kiểu khi-ghi, không có job nền.

## Chưa làm / cần quyết định
- `emailDigest`: `instant` gửi email thật khi có thông báo; `daily`/`weekly` mới chỉ lưu tùy chọn, chưa có job gom email (xem `settings-notify-communities.md`).
- Chốt có chuyển SSE sang cookie httpOnly hay giữ ticket.
- Gom nhóm thông báo (vd. "5 người đã thích bài của bạn") chưa có.
