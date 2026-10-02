# API: Cộng đồng (tạo/quản trị, luồng tham gia, vai trò, lời mời, đánh giá)

Code: `src/modules/communities/*` (mới), `courses/*` (repository cho phép tạo/sửa/xóa mềm), `enrollments/*` (mở rộng `toggle`, `requireMembership`).
Vai trò: member < mod < admin < owner < platform_admin (qua `permissions/policy.ts`). Mọi lỗi có `{ error: { code, message } }`.

## Endpoint

| Method | Path | Auth/Role | Body/Query | Response | Lỗi |
|---|---|---|---|---|---|
| POST | /communities | đăng nhập | `title, description, category, priceUsd>=0, visibility, language?, thumbnail?` | 201 course detail + `viewerRole:'owner'` | 400, 401 |
| PATCH | /courses/:id | admin+ (đổi `priceUsd`/`visibility`: chỉ owner/platform admin) | một phần của `title, description, thumbnail, category, language, priceUsd, visibility` | course detail | 400, 401, 403, 404 |
| DELETE | /courses/:id | owner / platform admin | - | `{deleted:true}`; xóa mềm, thành viên nhận notify `system` | 401, 403, 404, 409 (cộng đồng seed, người không phải platform admin) |
| POST | /admin/courses/:id/lock | platform admin | `{reason}` | `{id, locked:true, reason}` | 400, 401, 403, 404 |
| POST | /admin/courses/:id/unlock | platform admin | - | `{id, locked:false}` | 401, 403, 404 |
| POST | /courses/:id/enroll | đăng nhập | - | `{enrolled}` (toggle; **rời = hủy gói cuối kỳ; vào lại khi gói còn hiệu lực không phải trả tiền**) | 402 `PAYMENT_REQUIRED` (có phí, gói không còn hiệu lực), 403 `JOIN_REQUEST_REQUIRED` (riêng tư), 403 `COMMUNITY_LOCKED`, 403 bị cấm, 409 owner không rời được. Rời cộng đồng luôn được |
| POST | /courses/:id/join-requests | đăng nhập | `{message?}` | 201 yêu cầu | 409 (công khai / đã là thành viên / đã có yêu cầu chờ), 403 (bị cấm/khóa) |
| GET | /courses/:id/join-requests | admin+ | `?status=pending\|approved\|rejected` | `[{..., user}]` | 401, 403, 404 |
| POST | /join-requests/:id/approve, /reject | admin+ của cộng đồng đó | - | yêu cầu đã cập nhật; notify người xin. **Duyệt = chốt quyết định + cấp quyền trong 1 transaction; cộng đồng CÓ PHÍ chỉ cho phép thanh toán (không enroll)** | 403, 404, 409 (đã xử lý) |
| DELETE | /join-requests/:id | chính người xin | - | `{cancelled:true}` | 404, 409 |
| POST | /courses/:id/invites | admin+ | `{maxUses?, expiresAt?}` | 201 `{code,...}` (72 bit ngẫu nhiên) | 400, 403 |
| GET | /courses/:id/invites | admin+ | - | danh sách (kèm `usedCount`, `revokedAt`) | 403 |
| DELETE | /invites/:code | admin+ | - | `{revoked:true}` | 403, 404 |
| GET | /invites/:code | công khai | - | `{code, course:{id,title,thumbnail,members,visibility,priceUsd}, expiresAt, remainingUses}` | 404, 410 `INVITE_REVOKED/EXPIRED/EXHAUSTED` |
| POST | /invites/:code/accept | đăng nhập | - | `{courseId, joined:true}`; tăng `usedCount` | 402 `PAYMENT_REQUIRED`, 403 (bị cấm/khóa), 404, 409 (đã là thành viên), 410 |
| GET | /courses/:id/members/:userId | thành viên | - | `{id,name,handle,role,roleDetail,enrolledAt,lastActiveAt,online}` | 401, 403, 404 |
| PATCH | /courses/:id/members/:userId/role | admin+ (đặt/bỏ admin: chỉ owner) | `{role: member\|mod\|admin}` | `{userId, role}`; notify `role_changed` | 400 (tự đổi), 403, 404 |
| DELETE | /courses/:id/members/:userId | admin+, chỉ bậc thấp hơn | - | `{removed:true}`; notify `removed_from_community` | 400, 403, 404 |
| POST / DELETE | /courses/:id/members/:userId/ban | admin+, chỉ bậc thấp hơn | POST: `{reason?}` | `{banned}` | 400, 403, 404 (POST: người **chưa là thành viên**/uuid lạ → 404, không tạo bản ghi cấm, không gửi thông báo). DELETE trả lại quyền nếu gói còn hiệu lực |
| GET | /courses/:id/bans | admin+ | - | `[{userId, reason, bannedBy, bannedAt, user}]` | 403 |
| POST | /courses/:id/transfer-ownership | owner | `{userId}` | `{ownerId}`; chủ cũ thành admin | 400 (không phải thành viên/chính mình), 403 |
| GET | /courses/:id/reviews | công khai | `?page&limit` | `{data, meta, summary:{rating,ratingCount}}` | 404, 400 |
| POST | /courses/:id/reviews | thành viên | `{rating 1-5, text<=1000}` | 201 (mới) / 200 (cập nhật) | 400, 401, 403, 404 |
| DELETE | /courses/:id/reviews/mine | thành viên | - | `{deleted:true}` | 404 |
| DELETE | /reviews/:id | tác giả, mod+ hoặc platform admin | - | `{deleted:true}` | 401, 403, 404 |

`GET /courses/:id/members` (module community) có thêm trường `roleDetail` (`member|mod|admin|owner`); `role` cũ (`admin|member`) giữ nguyên cho FE.

## Quyết định thiết kế
- Cộng đồng tạo mới là một `Course` (thêm field tùy chọn `ownerId`, `locked`, `deletedAt`); xếp sau seed ở sort `trending`. `students` = số thành viên thật, chỉ đồng bộ cho cộng đồng có `ownerId` (seed giữ số minh họa).
- Xóa mềm bằng `deletedAt` (không thêm giá trị vào enum `status` để không phá filter FE). Cộng đồng bị khóa/xóa ẩn khỏi danh sách; khóa vẫn xem được trang chi tiết nhưng `requireMembership` trả 403 `COMMUNITY_LOCKED` (trừ platform admin).
- Bậc thấp hơn: kick/ban/đổi vai trò so sánh `roleRank` (policy.ts); platform admin cao nhất; không bao giờ tác động lên owner.
- Duyệt yêu cầu tham gia: cộng đồng **miễn phí** → cấp quyền ngay (cùng transaction với chốt `approved`; 2 admin approve ∥ reject chỉ 1 bên thắng và Enrollment luôn khớp trạng thái). Cộng đồng **có phí** (kể cả riêng tư) → duyệt KHÔNG cấp quyền, chỉ cho phép thanh toán/dùng thử (`payments` đòi join request `approved` với cộng đồng riêng tư). Lời mời cộng đồng riêng tư có phí: 402 nhưng ghi 1 yêu cầu `approved` (và dùng 1 lượt) để người nhận được phép thanh toán. Kick/ban thu hồi các yêu cầu `approved` cũ.
- **Cộng đồng bị khóa** (`Course.locked`, gồm đình chỉ kiểm duyệt): `policy.requireRole` chặn owner/admin/mod ở mọi thao tác quản trị (sửa, xóa, chuyển quyền, mời, kick/ban, lớp học, doanh thu, payout) — chỉ Platform Admin / nhân viên admin vượt được.
- `kick` → kết thúc gói ngay; `ban` → ghi lệnh cấm TRƯỚC rồi gỡ ghi danh, dừng gia hạn gói; `remove` (xóa cộng đồng) → kết thúc mọi gói ngay; `lock` / admin suspend → hủy cuối kỳ mọi gói (chi tiết ở `payments.md`, mục Vòng đời tiền).
- Điểm đánh giá: Course.rating/ratingCount = điểm nền của seed (catalog.seed.ts; cộng đồng do người dùng tạo = 0/0) + review thật, TÍNH LẠI từ bảng Review trong cùng transaction (khóa hàng Course) mỗi lần thêm/sửa/xóa (cộng đồng mới nền 0/0 nên bằng trung bình thật). `GET /courses/:id` trả `reviews` CHỈ gồm review thật (có thêm `rating`; mảng rỗng nếu chưa có), không còn review minh họa.
- Đã thêm: `HttpError.coded`, `roleRank` (policy.ts), route đăng ký trong `routes.ts`.

## Giới hạn / Chưa làm
- Dữ liệu ở Postgres (JoinRequest, Invite, Review, CommunityBan, Course.locked/lockReason). 1 yêu cầu pending / (course,user) do service enforce trong transaction (khóa cố vấn); lượt dùng lời mời được giữ atomically.
- Cộng đồng seed không có owner nên chỉ platform admin quản trị được; xóa mềm cộng đồng = Course.deletedAt.
- Ban không xóa bài viết/bình luận cũ của người bị cấm; xóa cộng đồng không dọn dữ liệu bài viết/sự kiện liên quan.
- Thành viên minh họa (User.isDemo) không kick/ban/đổi vai trò được (404), không nhận thông báo; vẫn xem được chi tiết.
- Thông báo mới cho quản trị khi có yêu cầu tham gia/thành viên mới dùng type `system`.
- Chưa có giới hạn số cộng đồng mỗi user, rate limit tạo lời mời, hay kiểm duyệt nội dung tên/mô tả.
- Cần quyết định: người dùng đã trả phí bị kick có được hoàn tiền không; owner đổi giá có ảnh hưởng thuê bao hiện có không.

## Wizard tạo cộng đồng, nháp, nhận diện, câu hỏi gia nhập (2026-10-07)
Hợp đồng đầy đủ + ví dụ: `docs/api/community-wizard.md`. Tóm tắt:
- **Nháp** = `Community.moderationStatus = 'draft'` (id = slug), chỉ chủ thấy; ẩn khỏi danh sách/tìm kiếm/Khám phá/chi tiết công khai/admin. `POST /communities/drafts`, `GET /me/community-drafts`, `GET|DELETE /communities/:id/draft`, `PATCH /communities/:id/draft/steps/:step` (`basics|plan|identity|members`), `POST /communities/:id/publish`, `GET /communities/slug-available`, `GET /communities/rules-template`, `GET /communities/:id/launch-checklist`. Tối đa 5 nháp/owner. Publish = 1 transaction: draft→active, Enrollment owner, khóa học mặc định, `PayoutAccount` mặc định `skipped`.
- **Trường mới của cộng đồng** (có trong chi tiết/danh sách, sửa được qua `PATCH /communities/:id` sau khi ra mắt): `priceAnnualUsd` + `annualSavingsPct` (server tính, giá năm ≤ 12× giá tháng), `memberTrialEnabled` (số ngày = Global Setting `payments.trialDays`), `logoUrl`, `coverUrl` (từ upload purpose `avatar`/`cover` của chính chủ), `brandColor`, `promise`, `benefits` (≤6), `introVideoUrl` (YouTube/Vimeo → URL nhúng), `rules` (có thứ tự), `joinQuestions` (≤3), `requireRulesAgreement`, `autoApprovePaid`. `POST /communities` một phát vẫn chạy y như cũ (các trường mới tùy chọn).
- **Câu hỏi gia nhập**: `POST /communities/:id/join-requests` nhận thêm `answers[]` (đủ số câu, bắt buộc khi cộng đồng có câu hỏi: 400 `JOIN_ANSWERS_REQUIRED`) và `acceptRules` (400 `RULES_NOT_ACCEPTED` khi `requireRulesAgreement` + có nội quy). Server lưu BẢN CHỤP `[{question, answer}]` trên `JoinRequest.answers`; `GET /communities/:id/join-requests` (admin+) trả `answers`. Không có câu hỏi ⇒ luồng cũ.
- **`autoApprovePaid`** (private): người đã thanh toán/dùng thử không cần được duyệt trước (bỏ qua `JOIN_REQUEST_REQUIRED`).
- Danh mục mới: `music`, `sports`, `spirituality` (enum `CourseCategory`; seed thêm vào `DiscoveryCategory`).
- Alias: route cố định `/communities/{slug-available,revenue-estimate,rules-template,drafts}` không bị `community-alias.ts` viết lại; các route `:id` khai báo ở `/courses/:id/*` (và có sẵn `/communities/:id/*`).
- **Chưa làm / cần quyết định**: nháp bỏ quên giữ slug mãi (chưa có job dọn); upload logo/cover sau khi ra mắt; điều kiện Khám phá chỉ hiển thị; `requireRulesAgreement` mới ép ở join-request; xem A16 ở `docs/OPEN_DECISIONS.md`.
