# Lời chào thành viên mới & thông báo popup

Module: `backend/src/modules/community-greetings/` · Bảng: `CommunityWelcome`, `CommunityWelcomeSeen`, `CommunityAnnouncement`, `CommunityAnnouncementSeen` (migration `20261021100000_community_greetings`).
Đường dẫn chuẩn `/api/communities/:id/greetings/*` (alias của `/api/courses/:id/greetings/*`). Tất cả cần đăng nhập.

## Quy tắc
- **Lời chào**: hiện cho thành viên (vai trò `member`) tham gia **từ lúc chủ bật** (`enabledSince`; tắt rồi bật lại => tính lại mốc). Mỗi người mỗi cộng đồng **đúng 1 lần**: `CommunityWelcomeSeen` không gắn với `Enrollment`, nên rời rồi tham gia lại cũng không hiện nữa. Người gửi = chủ cộng đồng. Biến `{ten}` (tên thành viên), `{cong_dong}` (tên cộng đồng).
- **Thông báo**: chỉ bản `active` mới nhất; đăng bản mới => các bản cũ `active=false`. Mỗi thành viên thấy 1 lần (kể cả người tham gia sau khi đăng); người đăng không thấy popup của chính mình. Chỉ trả về ở trang của cộng đồng đó.
- Cộng đồng bị khóa / người ngoài / bị cấm => `pending` trả `{ welcome: null, announcement: null }`.
- Frontend đánh dấu đã xem **ngay khi popup hiện** (tải lại trang không hiện lại). Lời chào hiện trước, đóng xong mới tới thông báo.

## Thành viên
| Method | Path | Mô tả |
|---|---|---|
| GET | `/greetings/pending` | `{ welcome: { message, sender } \| null, announcement: { id, title, body, link, createdAt, sender } \| null }`; `sender = { id, name, avatarUrl, role }` |
| POST | `/greetings/welcome/seen` | Đánh dấu đã xem lời chào. 403 `NOT_MEMBER` |
| POST | `/greetings/announcements/:aid/seen` | Đánh dấu đã xem thông báo. 403 `NOT_MEMBER`, 404 nếu thông báo không thuộc cộng đồng |

## Quản lý (admin cộng đồng trở lên; cộng đồng bị khóa: chỉ Platform Admin)
| Method | Path | Body | Mô tả |
|---|---|---|---|
| GET | `/greetings/settings` | — | `{ welcome: { enabled, message, enabledSince }, announcements: [{ id, title, body, link, createdAt, active, author, seenCount }] (20 gần nhất), members }` |
| PUT | `/greetings/welcome` | `{ enabled, message (≤2000) }` | 400 nếu bật mà nội dung rỗng |
| POST | `/greetings/announcements` | `{ title (≤120), body (≤2000), link? }` | 201; `link` bắt đầu bằng `/` hoặc `https://` (khác => 400) |
| PATCH | `/greetings/announcements/:aid` | `{ active }` | Gỡ / hiện lại (hiện lại => các bản khác thôi hiện; ai đã xem rồi không thấy lại) |

Nội dung hiển thị bằng `RichText` của widget chat: xuống dòng, `- ` gạch đầu dòng, `1. ` bước, `**in đậm**`, link `/trang` hoặc `https://`. Không render HTML.
