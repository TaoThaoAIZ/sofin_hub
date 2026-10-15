# Lời chào thành viên mới & thông báo popup

Module: `backend/src/modules/community-greetings/` · Bảng: `CommunityWelcome`, `CommunityWelcomeSeen`, `CommunityAnnouncement`, `CommunityAnnouncementSeen` (migration `20261021100000_community_greetings`).
Đường dẫn chuẩn `/api/communities/:id/greetings/*` (alias của `/api/courses/:id/greetings/*`). Tất cả cần đăng nhập.

## Quy tắc
- **Lời chào**: hiện cho thành viên (vai trò `member`) tham gia **từ lúc chủ bật** (`enabledSince`; tắt rồi bật lại => tính lại mốc). Mỗi người mỗi cộng đồng **đúng 1 lần**: `CommunityWelcomeSeen` không gắn với `Enrollment`, nên rời rồi tham gia lại cũng không hiện nữa. Người gửi = chủ cộng đồng. Biến `{ten}` (tên thành viên), `{cong_dong}` (tên cộng đồng).
- **Thông báo = bài mục "Thông báo" đang ghim** (`CommunityAnnouncement.postId`, xóa bài => xóa thông báo). Đăng ở Cài đặt = đăng bài + ghim; ghim bài "Thông báo" ngay trên Bảng tin cũng tạo thông báo (`announcement-sync.ts`, gọi từ `postsService.togglePin` / `update`); bỏ ghim / bài bị ẩn, gỡ => thôi hiện.
- Mỗi thành viên mỗi thông báo 1 lần; **chỉ thông báo đăng/ghim SAU khi người đó tham gia** (người mới chỉ thấy lời chào, không bị dồn thông báo cũ); người đăng không thấy popup của chính mình; chỉ ở trang của cộng đồng đó.
- Nhiều thông báo chưa xem => `announcements` cũ -> mới (tối đa 10 mới nhất), FE hiện dạng slide. Slide nào hiện là đánh dấu đã xem; bấm X giữa chừng thì slide chưa lật tới còn lại cho lần sau.
- Cộng đồng bị khóa / người ngoài / bị cấm => `pending` trả `{ welcome: null, announcement: null }`.
- Frontend đánh dấu đã xem **ngay khi popup / slide hiện** và xóa khỏi cache react-query (ra trang khác rồi quay lại không hiện lại). Lời chào là slide đầu, sau đó tới thông báo.

## Thành viên
| Method | Path | Mô tả |
|---|---|---|
| GET | `/greetings/pending` | `{ welcome: { message, sender } \| null, announcements: [{ id, title, body, link, postLink, createdAt, sender }] }` (cũ -> mới); `link` = link riêng hoặc bài trên Bảng tin; `sender = { id, name, avatarUrl, role }` |
| POST | `/greetings/welcome/seen` | Đánh dấu đã xem lời chào. 403 `NOT_MEMBER` |
| POST | `/greetings/announcements/:aid/seen` | Đánh dấu đã xem thông báo. 403 `NOT_MEMBER`, 404 nếu thông báo không thuộc cộng đồng |

## Quản lý (admin cộng đồng trở lên; cộng đồng bị khóa: chỉ Platform Admin)
| Method | Path | Body | Mô tả |
|---|---|---|---|
| GET | `/greetings/settings` | — | `{ welcome: { enabled, message, enabledSince }, announcements: [{ id, title, body, link, postLink, createdAt, active (= bài đang ghim), author, seenCount }] (20 gần nhất), members }` |
| PUT | `/greetings/welcome` | `{ enabled, message (≤2000) }` | 400 nếu bật mà nội dung rỗng |
| POST | `/greetings/announcements` | `{ title (≤120), body (≤2000), link? }` | 201; đăng bài "Thông báo" + ghim; thông báo đang ghim khác giữ nguyên. `link` bắt đầu bằng `/` hoặc `https://` (khác => 400) |
| PATCH | `/greetings/announcements/:aid` | `{ active }` | Bỏ ghim / ghim lại bài trên Bảng tin (ai đã xem rồi không thấy lại) |

Nội dung hiển thị bằng `RichText` của widget chat: xuống dòng, `- ` gạch đầu dòng, `1. ` bước, `**in đậm**`, link `/trang` hoặc `https://`. Không render HTML.
