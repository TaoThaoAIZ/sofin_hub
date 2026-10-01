# API Nội dung: Bài viết + Sự kiện

Tất cả route cần `Authorization: Bearer <token>` (401 nếu thiếu) và người gọi phải là thành viên cộng đồng (403 nếu chưa tham gia).
Response thành công dạng `{ data }`; danh sách phân trang có `meta`. Lỗi tiếng Việt: `{ error: { code, message } }`.

## Bài viết (`src/modules/posts`)

| Method | Path | Quyền | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| GET | `/courses/:id/posts` | member | `?category&tag&sort=latest\|popular&page&limit&cursor` | `PostView[]` + meta (`page,limit,total,totalPages` + `hasMore, nextCursor`). `cursor` (= `meta.nextCursor`) là phân trang keyset: bỏ qua `page`, không lặp/sót khi có bài mới; cursor gắn với `sort` (sai sort -> 400). `page` vẫn dùng được | 401, 403, 404, 400 |
| POST | `/courses/:id/posts` | member | `{content, category?, tags?, imageUrl?, poll?}` | 201 `PostView` (+5 điểm, 1 lần cho bài này) | 400, 429 (rate limit, nhóm `posts`) |
| GET | `/posts/:id` | member | | `PostView` (có `shareUrl`) | 403, 404 (kể cả bài ẩn với người không có quyền thấy) |
| GET | `/posts/:id/share` | member | | `{url, title, excerpt}` | 403, 404 |
| PATCH | `/posts/:id` | tác giả hoặc mod+ | `{content?, category?, tags?}` (ít nhất 1 trường) | `PostView` (có `editedAt`) | 400, 403, 404 |
| DELETE | `/posts/:id` | tác giả hoặc mod+ | | `{deleted:true}`; xóa cả bình luận, like, phiếu bình chọn; **điểm đăng bài + điểm like nhận được của bài bị bù âm trong cùng transaction** | 403, 404 |
| POST | `/posts/:id/like` | member | | `{liked, likesCount}` (toggle) | 404 |
| POST | `/posts/:id/pin` | mod+ | | `{pinned}` (toggle) | 403, 404 |
| POST | `/posts/:id/hide`, `/posts/:id/unhide` | mod+ | | `{hidden}` | 403, 404 |
| POST | `/posts/:id/poll/vote` | member | `{optionIds: string[]}` | `PostView` (poll cập nhật) | 400 (option sai / nhiều lựa chọn khi `multiple=false` / bài không có poll), 409 (đã đóng) |
| GET | `/posts/:id/comments` | member | `?limit=1..200 (mặc định 100)&cursor` | `{data: CommentView[] cũ->mới, meta:{limit, hasMore, nextCursor}}`; bình luận ẩn lọc trong SQL (mod+ thấy hết, người khác chỉ thấy của mình) | 400 (cursor/limit sai), 404 |
| POST | `/posts/:id/comments` | member | `{content}` | 201 `CommentView` | 400, 404 |
| PATCH | `/comments/:id` | tác giả hoặc mod+ | `{content}` | `CommentView` (có `editedAt`) | 400, 403, 404 |
| DELETE | `/comments/:id` | tác giả hoặc mod+ | | `{deleted:true}`; `commentsCount` giảm | 403, 404 |
| GET | `/courses/:id/tags` | member | | `[{tag, count}]` top 20 | 401, 403, 404 |

Poll khi tạo: `poll: {question?, options: 2..6 chuỗi, multiple?: boolean (mặc định false), closesAt?: ISO (phải ở tương lai)}`.
`PostView.poll` = `{question, multiple, closesAt, isClosed, totalVoters, viewerVotes: string[], options:[{id,text,count}]}`.
`PostView` thêm: `shareUrl` (`/courses/:courseId/community?post=:id`), `hidden?`, `editedAt?`.

### Điểm thưởng chống farm (audit §5.1/5.2, test `tests/points-policy.test.ts`)
- `PointEvent` có khóa nghiệp vụ `UNIQUE(userId, reason, sourceType, sourceId)`: post → `('post', postId)` · like nhận → `('post_like', '<postId>:<likerId>')` · hoàn thành bài học → `('lesson', lessonId)` · RSVP → `('event', eventId)`. `pointsService.award(..., source)` idempotent (trùng khóa trả `undefined`). Dòng cũ trước migration có `sourceType/sourceId = NULL` (không bù được khi xóa nguồn).
- Xóa bài / xóa sự kiện ghi điểm âm bù (`reason='revoked'`, một dòng/(user, nguồn)) **trong cùng transaction** với việc xóa: vòng lặp đăng→xóa hoặc đăng→like→xóa có net 0. Không có điểm cho bình luận nên không cần bù khi xóa bình luận.
- RSVP→hủy→RSVP chỉ +1 nhờ khóa nghiệp vụ trên `PointEvent` (thay cho bảng `EventRsvpNotice` audit gợi ý — cùng hiệu quả, không thêm bảng). Tự like bài của mình không có điểm.
- Giới hạn tốc độ: `middlewares/rate-limit.ts` — giới hạn toàn cục theo IP (`RATE_LIMIT_GLOBAL_PER_MIN`, mặc định 1200) và theo nhóm ghi/user/phút (posts 10, comments 30, likes 60, rsvp 30, votes 60; `RATE_LIMIT_DISABLED=1` tắt; test tắt sẵn, bật bằng `rateLimitSettings`). Vượt → 429 + `Retry-After`. Mọi `?page=` phân trang offset có trần `MAX_PAGE=1000` (400 nếu vượt).

### Quyết định thiết kế
- Bài/bình luận ẩn: member thường không thấy trong danh sách, `GET /posts/:id` trả 404 và không like/bình luận được; tác giả và mod+ vẫn thấy (kèm `hidden: true`).
- Poll chỉ lưu (user -> danh sách option), API không bao giờ trả ai chọn gì; chỉ `viewerVotes` của chính người xem. Bình chọn lại = ghi đè lựa chọn cũ cho tới `closesAt`.
- Thẻ so khớp không phân biệt hoa thường và bỏ `#` (`?tag=Rieng1` khớp `#rieng1`); bài ẩn không tính vào thẻ phổ biến.
- Like: điểm `like_received` và thông báo `post_liked` chỉ ở lần like ĐẦU của mỗi cặp (user, bài) (đổi so với trước: trước đây điểm cộng mỗi lần like lại), nên like/unlike liên tục không spam/farm điểm; không cộng khi tự like hoặc khi tác giả là thành viên minh họa (`User.isDemo`). `post_commented` gửi cho tác giả trừ khi tự bình luận; tác giả minh họa không có thông báo.
- Báo cáo (`moderation`): `resolve` **chốt ticket trước** (atomic) rồi mới ẩn/cấm — chỉ bên thắng thi hành; kiểm hợp lệ không tác dụng phụ chạy trước (hide trên báo cáo thành viên → 400, ticket vẫn mở); thi hành lỗi → mở lại ticket. Ẩn nội dung báo cho tác giả ("Nội dung của bạn đã bị ẩn"); cấm qua báo cáo báo cho người bị cấm và dừng gia hạn gói.
- Hàm cho module khác: `postsService.setHidden(postId, hidden)`, `postsService.setCommentHidden(commentId, hidden)`, `postsService.getCommentOrThrow`, `postsService.getVisibleOrThrow`. Không kiểm quyền, caller tự kiểm.
- Platform Admin không ghi danh vẫn bị `requireMembership` chặn ở route bài viết (chỉ xử lý nội dung qua module kiểm duyệt).

## Sự kiện (`src/modules/events`)

| Method | Path | Quyền | Body | Response | Lỗi |
|---|---|---|---|---|---|
| GET | `/courses/:id/events` | member | | `CommunityEventView[]` | 403, 404 |
| POST | `/courses/:id/events` | mod+ | `{title, startAt, description?, timezone?, meetingLink?, capacity?}` | 201 event; thông báo `event_created` cho thành viên (tối đa 200, trừ người tạo) | 400, 403 |
| GET | `/events/:id` | member | | `CommunityEventView` | 403, 404 |
| PATCH | `/events/:id` | mod+ | trường tùy chọn, `meetingLink`/`capacity` nhận `null` để xóa | event | 400, 403, 404, 409 (capacity < số đã RSVP) |
| DELETE | `/events/:id` | mod+ | | `{deleted:true}`; thông báo (`system`) cho người đã RSVP; điểm RSVP của sự kiện bị bù âm | 403, 404 |
| POST | `/events/:id/rsvp` | member | | `{rsvped, rsvpCount}` (toggle, giữ nguyên; +1 điểm **một lần** cho mỗi (user, sự kiện) dù RSVP/hủy nhiều lần) | 400 (đã diễn ra), 409 (đủ chỗ), 429 |
| DELETE | `/events/:id/rsvp` | member | | `{rsvped:false, rsvpCount}`; idempotent | 404 |
| GET | `/events/:id/ics` | member | | `text/calendar; charset=utf-8` | 401, 403, 404 |
| GET | `/courses/:id/events.ics` | member | | `text/calendar; charset=utf-8` (mọi sự kiện của cộng đồng) | 401, 403, 404 |

### Quyết định thiết kế
- iCalendar (`events.ics.ts`): CRLF, escape `\ ; ,` và xuống dòng, `UID:<eventId>@sofinhub` ổn định, `DTSTAMP`/`DTSTART`/`DTEND` giờ UTC (không cần VTIMEZONE), gập dòng > 75 octet không cắt ngang ký tự UTF-8. Chưa có giờ kết thúc nên `DTEND` = bắt đầu + 1 giờ; múi giờ gốc ghi trong DESCRIPTION.
- Nhắc lịch (`events.reminders.ts`): `startEventReminders()` chạy mỗi 60 giây (`unref`, bỏ qua khi `NODE_ENV=test`), gọi trong `src/index.ts`. Gửi `event_reminder` cho người đã RSVP khi còn <= 60 phút tới giờ bắt đầu, mỗi (sự kiện, user) một lần; đổi `startAt` thì xóa dấu đã nhắc. `runEventRemindersOnce(now)` dùng cho test.

## Giới hạn / Chưa làm
- Toàn bộ dữ liệu in-memory (mất khi restart), kể cả dấu đã nhắc và phiếu bình chọn; bộ nhắc lịch chạy trong process nên nhiều instance sẽ nhắc trùng (cần khóa/DB khi scale).
- Chưa có ảnh nhiều tệp, chưa tìm kiếm bài theo từ khóa trong module này (module search làm riêng).
- Chưa có sự kiện lặp lại, giờ kết thúc riêng, hay `VTIMEZONE`.
- Xóa sự kiện không phát sự kiện `METHOD:CANCEL` cho lịch đã đăng ký iCal.
- Cần quyết định: có cộng điểm cho người bình chọn poll không; có cho mod sửa nội dung bài của người khác hay chỉ ẩn/xóa (hiện mod+ được sửa).
