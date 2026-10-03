# API Cài đặt: Thông báo & Cộng đồng của tôi

Module: `src/modules/notifications/` (mở rộng) và `src/modules/my-communities/` (mới). Response `{ data }`. Mọi route cần Bearer.

## Thông báo (mở rộng `/notifications/preferences`)

| Method | Path | Body | Response | Lỗi |
|---|---|---|---|---|
| GET | `/notifications/preferences` | - | `{types, emailDigest, quiet:{enabled,from,to}, dmAllowed, emailUnreadDm, notifyFollowedPosts, communityPrefs, communities:[{id,title,logoUrl,role,prefs:{admin,event,featured,comment,joinRequest},applicable:{...}}]}` | 401 |
| PUT | `/notifications/preferences` | cập nhật từng phần: `types?`, `emailDigest? (off\|instant\|daily\|weekly)`, `quiet? {enabled?,from?,to?}` (HH:mm), `dmAllowed?`, `emailUnreadDm?`, `notifyFollowedPosts?`, `communityPrefs?` | như GET | 400 (khóa lạ, giờ sai, `from == to` khi bật, tắt loại bắt buộc, body rỗng), 401 |

- `communityPrefs` THAY THẾ cả bảng (`{}` = đặt lại mặc định); thiếu cộng đồng/cột = bật; id cộng đồng user không còn là thành viên bị bỏ.
- `communities` lấy từ ghi danh thật (loại bị cấm/đã xóa/bản nháp). `applicable.joinRequest = false` cho thành viên thường (FE vẽ "–"); các cột khác luôn áp dụng.
- Ánh xạ cột -> thông báo (áp dụng lúc `notify()` có `communityId`): `event` = `event_created`, `event_reminder`, hủy sự kiện; `comment` = `post_commented`; `joinRequest` = báo cho owner/admin có yêu cầu gia nhập mới / thành viên mới; `admin` = kết quả duyệt yêu cầu gia nhập (nhãn `category: 'admin'`). Loại khác (like, thanh toán, hệ thống...) không bị cột nào chặn; loại bắt buộc luôn đến. `notify()` nhận thêm trường `category` (không lưu DB) để gắn nhãn cột cho thông báo `system`.
- Cột `featured` ("Bài nổi bật"): LƯU nhưng chưa có nơi nào phát thông báo bài nổi bật (ghim bài không báo ai) nên chưa có tác dụng.
- Tắt cột => thông báo đó KHÔNG được lưu (giống tắt loại).

### Thực thi (không chỉ lưu)
- **Email ngay (`instant`)**: sau khi thông báo đã commit DB, `notifications.service.ts` gửi 1 email (`mailService`; tiêu đề = title, nội dung + link `FRONTEND_URL` + link). `off`/`daily`/`weekly`: không gửi. Trước đây KHÔNG có job/gửi mail nào cho digest; `daily`/`weekly` vẫn chưa có job gom (cần cột "lần gửi cuối" + job trong `jobs.ts`).
- **Giờ im lặng**: `notifications.quiet.ts` (`isQuietNow`, hàm thuần, theo `User.timezone`, khoảng [from,to), qua nửa đêm 22:00-07:00 hợp lệ, `from == to` = rỗng, múi giờ lạ => `Asia/Ho_Chi_Minh`). Trong giờ im lặng: thông báo VẪN lưu (hiện trong chuông) nhưng không phát SSE/toast và không gửi email. Email bị chặn không được gửi bù sau giờ im lặng. SSE của `/messages/stream` (kênh chat) không bị ảnh hưởng.
- **`dmAllowed=false`**: `POST /conversations` (mở/bắt đầu) và `POST /conversations/:id/messages` (gửi thêm) trả 403 `DM_DISABLED` "Người dùng này đã tắt nhận tin nhắn riêng". FE chat hiển thị đúng thông báo 403 này. Người tắt vẫn nhắn đi được cho người khác.
- **`emailUnreadDm`**: khi có thông báo `message_received` (đã gộp tối đa 1 / hội thoại / 5 phút, chỉ khi người nhận không đang xem hội thoại) và `emailUnreadDm = true` thì gửi email (tôn trọng giờ im lặng). Mặc định bật. Với `message_received`, email chỉ theo `emailUnreadDm` (không theo `emailDigest`).
- **`notifyFollowedPosts`**: chỉ lưu. Codebase chưa có tính năng "theo dõi" nên không nơi nào dùng cờ này.

## Cộng đồng của tôi

| Method | Path | Body | Response | Lỗi |
|---|---|---|---|---|
| GET | `/me/communities` | - | mảng đã sắp xếp (ghim trước, rồi `sortOrder`, rồi ngày tham gia): `{id,title,logoUrl,thumbnail,visibility,free,role,enrolledAt,memberCount,points,level,sidebarVisible,pinned,sortOrder,subscription\|null,hosting\|null}` | 401 |
| PATCH | `/me/communities/:id` | `{sidebarVisible?, pinned?}` | `{id,...}` | 400, 401, 404 (chưa tham gia / bị cấm) |
| PUT | `/me/communities/order` | `{ids:[...]}` (không rỗng, không trùng, đều là cộng đồng đang tham gia) | `{ids}` thứ tự đầy đủ đã lưu (id không gửi được xếp sau, giữ thứ tự cũ) | 400, 401 |
| DELETE | `/me/communities/:id` | - | `{left:true}` | 401, 404 (chưa tham gia), 409 (owner không rời được) |
| GET | `/me/join-requests` | - | `{requests:[{id,communityId,title,logoUrl,thumbnail,createdAt}], invites:[]}` | 401 |

- `DELETE /me/communities/:id` dùng lại `enrollmentService.toggle` (gói trả phí hủy cuối kỳ qua `paymentsService.onMemberLeft`), nhưng không bao giờ "tham gia" nhầm như `POST /courses/:id/enroll`.
- Hủy yêu cầu gia nhập: dùng `DELETE /join-requests/:id` có sẵn.
- `invites` luôn rỗng: `Invite` là mã/link chung (không có người nhận) nên không có hộp thư lời mời theo user.
- Ghim cho phép nhiều cộng đồng; kéo thả không bỏ ghim (ghim luôn đứng đầu).
- Chưa có thanh bên liệt kê cộng đồng của user trong app (`CommunitySidebar` là menu của 1 cộng đồng) nên `sidebarVisible/pinned/sortOrder` mới chỉ được lưu + dùng cho thứ tự ở trang Cài đặt.

## Tests
`tests/notifications-settings.test.ts` (hàm giờ im lặng, preferences, mute theo cộng đồng, email instant, giờ im lặng, DM), `tests/my-communities.test.ts`.

## Chưa làm / cần quyết định
- Email `daily`/`weekly` (cần job + cột lần gửi cuối); email bị chặn bởi giờ im lặng có gửi bù hay bỏ.
- Nguồn thông báo "Bài nổi bật" và "Theo dõi" (cột/cờ đang chỉ lưu).
- Lời mời theo người nhận (cần bảng mời theo user/email).
