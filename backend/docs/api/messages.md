# API Tin nhắn trực tiếp 1-1

Module: `src/modules/messages/`. Đường dẫn dưới tiền tố `/api`. Tất cả endpoint cần Bearer (trừ `GET /messages/stream` nhận Bearer hoặc vé). Test: `tests/messages.test.ts`.

## Endpoint

| Method | Path | Body / Query | Response | Lỗi |
|---|---|---|---|---|
| POST | `/conversations` | `{userId}` | 201 (mới) hoặc 200 (đã có): `{data:{id, other:{id,name}, lastMessage, unreadCount, lastMessageAt, blockedByMe}}` | 400 (nhắn chính mình), 401, 403 (bị chặn / không chung cộng đồng), 404 (user) |
| GET | `/conversations` | - | `{data:[...cùng dạng trên]}` sắp theo `lastMessageAt` giảm dần | 401 |
| GET | `/conversations/:id/messages` | `?before=<messageId>&limit=1..100 (mặc định 30)` | `{data:[MessageView cũ->mới], meta:{hasMore, nextBefore}}` | 400 (before sai), 401, 404 (không phải người tham gia) |
| POST | `/conversations/:id/messages` | `{content 1..2000, attachments?: [{url,name,contentType,size}] (tối đa 5)}` | 201 `{data: MessageView}` | 400, 401, 403 (chặn), 404, 429 |
| POST | `/conversations/:id/read` | - | `{data:{unreadCount:0}}` | 401, 404 |
| DELETE | `/messages/:id` | - | `{data: MessageView (đã thu hồi)}` | 401, 403 (không phải người gửi), 404 |
| GET | `/messages/unread-count` | - | `{data:{unreadCount}}` | 401 |
| POST | `/messages/stream-ticket` | - | `{data:{ticket, expiresAt}}` (TTL 30s, dùng 1 lần) | 401 |
| GET | `/messages/stream` | `?ticket=` hoặc header Bearer | SSE | 401 |
| POST | `/users/:id/block` | - | `{data:{blocked:true}}` (idempotent) | 400 (chặn chính mình), 401, 404 |
| DELETE | `/users/:id/block` | - | `{data:{blocked:false}}` | 401 |
| GET | `/me/blocks` | - | `{data:[{id,name,blockedAt}]}` | 401 |

`MessageView`: `{id, conversationId, senderId, content, attachments, createdAt, deleted}`. Tin đã thu hồi có `content = "Tin nhắn đã bị thu hồi"`, `attachments = []`, `deleted = true`.

## SSE

- Event `ready` khi kết nối xong; `message` (payload là `MessageView`) gửi tới người nhận và các tab khác của người gửi; `message_deleted` khi thu hồi; comment `: ping` mỗi 25s làm heartbeat. Dọn kết nối khi client ngắt.
- EventSource không đặt được header nên: `POST /messages/stream-ticket` (Bearer) rồi `new EventSource('/api/messages/stream?ticket=...')`. Vé hết hạn sau 30s hoặc sau lần dùng đầu (kết nối lại phải xin vé mới).
- Mỗi tab là một kết nối; user coi là "online" nếu còn ít nhất một kết nối.

## Quyết định thiết kế

- **Điều kiện nhắn**: hai người phải cùng là thành viên ít nhất một cộng đồng (`enrollmentService.listByUser` giao nhau) mới TẠO được cuộc trò chuyện; cuộc đã có thì luôn mở lại được (kể cả sau khi một người rời cộng đồng), trừ khi bị chặn. Không nhắn cho chính mình.
- **Chặn**: hai chiều. Bị chặn thì cả mở cuộc trò chuyện lẫn gửi tin đều 403. Người chặn vẫn đọc được lịch sử. Không cho người bị chặn biết mình bị chặn ngoài lỗi 403 chung.
- **Người thứ ba**: mọi endpoint theo `:id` trả 404 (không phải 403) để không lộ sự tồn tại.
- **Văn bản thuần**: từ chối (400) nội dung có thẻ HTML (`<tag ...>`); dấu `<` `>` bình thường vẫn được. FE vẫn phải escape khi hiển thị.
- **Đính kèm**: chỉ nhận URL dạng `/api/files/<key>` và key phải là file đã upload xong của CHÍNH người gửi; `contentType` và `size` lấy từ server, không tin client. Nên upload với `purpose: 'message_attachment'`.
- **Thu hồi**: xóa mềm, xóa nội dung + file đính kèm khỏi DB (`content=''`, `attachments=[]`, `deletedAt`); tin thu hồi không tính chưa đọc.
- **Chưa đọc**: theo `readSeq` từng người trong cuộc trò chuyện; gửi tin cũng coi là đã đọc tới tin đó.
- **Thông báo**: nếu người nhận không có kết nối SSE thì gọi `notify({type:'message_received', link:'/messages/<conversationId>'})`, gộp tối đa 1 thông báo / cuộc trò chuyện / người nhận / 5 phút (bộ nhớ). Người online chỉ nhận realtime, không tạo thông báo.
- **Chống spam**: tối đa `MESSAGE_RATE_LIMIT_PER_MIN` (mặc định 20) tin / user / phút -> 429; `0` là tắt; khi `NODE_ENV=test` mặc định tắt (test gán `messageRateLimit.max`).

## Giới hạn hiện tại / Chưa làm

- Cuộc trò chuyện, tin, chặn nằm trong Postgres (`Conversation` cặp userAId < userBId, `Message.seq` autoincrement toàn cục nên gửi song song không trùng seq, `UserBlock`); chưa đọc = truy vấn đếm theo `readSeqA/B`; phân trang cursor theo seq. Cố ý còn trong bộ nhớ: throttle thông báo `message_received` (5 phút), rate limit gửi, vé SSE và kết nối SSE => nhiều instance cần Redis pub/sub.
- Chưa có: sửa tin, trạng thái đang gõ, "đã xem" hiển thị cho người gửi, tìm kiếm tin nhắn, xóa cuộc trò chuyện, báo cáo tin nhắn vi phạm, nhóm chat.
- Chưa có endpoint tìm người dùng để bắt đầu trò chuyện (FE lấy `userId` từ danh sách thành viên cộng đồng).
- Đường dẫn FE trong thông báo (`/messages/<id>`) là giả định, cần thống nhất với FE.
- Rate limit theo bộ nhớ từng tiến trình.
