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
| GET | `/notifications/preferences` | Bearer | - | `{data: {types: {<type>: boolean}, emailDigest}}` | 401 |
| PUT | `/notifications/preferences` | Bearer | `{types?: {post_liked?: boolean,...}, emailDigest?: 'off'\|'daily'\|'weekly'}` (cập nhật từng phần) | preferences mới | 400 (khóa lạ, tắt loại bắt buộc, body rỗng), 401 |
| POST | `/notifications/stream-ticket` | Bearer | - | 201 `{data: {ticket, expiresInSec: 30}}` | 401 |
| GET | `/notifications/stream` | Bearer header, hoặc `?ticket=`, hoặc `?access_token=` | - | SSE `text/event-stream` | 401 |

## Realtime SSE
- Sự kiện: `event: notification` + `data: <JSON Notification>`; comment `: heartbeat` mỗi 25s; `retry: 5000`.
- Header: `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no` (nginx không đệm). Khi client ngắt: dừng heartbeat và gỡ listener.
- `EventSource` không đặt được header nên có 3 cách xác thực (chỉ route này): Bearer header (dùng `fetch` stream), `?ticket=` (khuyến nghị), `?access_token=` (fallback).
- **Khuyến nghị**: FE gọi `POST /notifications/stream-ticket` (có Bearer) rồi mở `new EventSource('/api/notifications/stream?ticket=...')`. Vé dùng 1 lần, sống 30s, nên URL bị lộ vào log cũng vô hại.
- **Trade-off bảo mật `?access_token=`**: token nằm trong URL nên có thể lọt vào access log của proxy/nginx, lịch sử trình duyệt, header Referer. Chỉ giữ làm fallback; bản chốt nên dùng ticket hoặc cookie httpOnly (SameSite) và có thể bỏ fallback.
- Không có replay: mất kết nối thì FE gọi lại `GET /notifications` để bù.

## Quyết định thiết kế
- `notify()` tôn trọng preference: loại bị tắt thì không lưu và không phát. Mặc định bật hết. Loại bắt buộc (luôn gửi, không tắt được): `payment_succeeded`, `payment_failed`, `role_changed`, `removed_from_community`, `report_resolved` (`MANDATORY_TYPES`).
- Thông báo của người khác trả 404 (không lộ tồn tại).
- Postgres (bảng `Notification`, `NotificationPreference`): tối đa 200 thông báo/user và dọn đã đọc >30 ngày bằng truy vấn DELETE mỗi khi ghi thông báo mới; `GET /notifications` không trả cái đã đọc quá hạn.
- `notify()` vẫn đồng bộ (trả ngay object, id/createdAt sinh tại app); kiểm tra preference (cache 5s) rồi phát SSE ngay, ghi DB chạy nền tuần tự, lỗi ghi được bắt + log. Các endpoint đọc/ghi tự chờ ghi nền của tiến trình nên nhất quán ngay sau `notify()`. Test dùng `flushNotifications()`.
- Đường dẫn cố định (`/preferences`, `/unread-count`, `/stream`) khai báo trước `/:id`.

## Giới hạn hiện tại
- Dữ liệu thông báo/preference bền vững (Postgres). Cố ý còn trong bộ nhớ tiến trình: vé SSE (30s, 1 lần) và danh sách listener SSE => chỉ chạy đúng với 1 instance; nhiều instance cần Redis (pub/sub + vé). Cache preference 5s có thể lệch giữa các instance tối đa bằng TTL đó.
- Thông báo đang ghi nền mà tiến trình chết đúng lúc đó thì mất (chấp nhận: thông báo không phải dữ liệu tiền tệ).
- Dọn thông báo cũ theo kiểu khi-ghi, không có job nền.

## Chưa làm / cần quyết định
- `emailDigest` mới chỉ lưu tùy chọn; chưa có job gửi email tổng hợp.
- Chốt cách xác thực SSE cuối cùng (ticket hay cookie) và có bỏ `?access_token=` không.
- Gom nhóm thông báo (vd. "5 người đã thích bài của bạn") chưa có.
