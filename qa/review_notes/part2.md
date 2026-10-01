# Rà soát testcase lỗi thời - phần 2 (cases_auth.py, cases_community.py)

Phạm vi: module AUTH (TC-AUTH-037..162), SEC (TC-SEC-012..040 thuộc cases_auth), COMM (TC-COMM-033..237), MEMBER (TC-MEMBER-013..065). Không đụng gen_testcases.py và các file khác. Workbook hiện tại chưa có kết quả nào (toàn 'Chưa test'), nên không case bị loại nào mang kết quả Test 1/Test 2.

Nguyên tắc: tiêu đề giữ nguyên nếu còn đúng; tiêu đề sai -> loại + thêm case thay thế ở CUỐI nhóm; mã TC cũ không dịch chuyển (đã đối chiếu thứ tự tiêu đề trước/sau bằng script). Đường dẫn API đổi sang chuẩn `/api/communities/...` (alias `/courses/*` vẫn chạy, middlewares/community-alias.ts) và FE sang `/communities/...` (LegacyCourseRedirect); `/api/admin/courses/:id/lock|unlock` giữ nguyên (docs/api/communities-courses.md). Tiêu đề ma trận 'Xóa cộng đồng photo (DELETE /api/courses/photo)' giữ nguyên để không đổi tiêu đề.

## Tổng kết

| Module | Gốc | Giữ | Sửa nội dung | Loại | Thêm thay thế |
|---|---|---|---|---|---|
| AUTH (037..162) | 126 | 101 | 21 | 4 | 1 |
| SEC (012..040, trong cases_auth) | 29 | 24 | 4 | 1 | 0 |
| COMM (033..237) | 205 | 178 | 19 | 8 | 2 |
| MEMBER (013..065) | 53 | 43 | 5 | 5 | 2 |
| Tổng | 413 | 346 | 49 | 18 | 5 |

'Giữ' gồm cả case chỉ đổi cơ học đường dẫn (/courses -> /communities) hoặc làm mới số đếm ở tiền điều kiện (xem mục cuối).

## Loại (RETIRE) - qa/retired_part_2.py

| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-AUTH-062 | LOẠI | Trùng với TC-MEMBER-060 (cùng POST /auth/login bằng seed-photo-0@demo.sofinhub.invalid, 401); MEMBER-060 đầy đủ hơn (thêm mật khẩu rỗng/'!demo-account-cannot-login' và đăng ký lại 409). Code: auth.service.ts:72 chặn isDemo. |
| TC-AUTH-090 | LOẠI | Trùng TC-MEMBER-036 (hồ sơ người bị cấm không liệt kê photo; MEMBER-036 còn kiểm totalPoints=0). Code: users.service.ts publicProfile + enrollment listByUser loại người bị cấm. |
| TC-AUTH-095 | LOẠI | Tiêu đề ghi cứng '3 cộng đồng' nhưng seed payments ghi danh member1 thêm paid-demo => 4 (DB: photo, yt, fin, paid-demo; prisma/seed/payments.ts:62). Thay bằng case cuối nhóm AUTH 'GET /me/enrollments của member1: các cộng đồng đã tham gia (kể cả riêng tư)...'. |
| TC-AUTH-161 | LOẠI | Trùng case ADM3 'POST /api/contact validate và giới hạn tốc độ 5 lần/khoảng' (cases_admin3.py:654, limiter(5) ở support.routes.ts:12-23); giữ AUTH-157..160, 162 (biên độ từng trường, CRLF, UI). |
| TC-SEC-037 | LOẠI | Lỗi thời + trùng: kỳ vọng '?access_token mở được stream' đã bị bỏ (notifications.routes.ts:19-32, messages.routes.ts:48-55 chỉ nhận Bearer hoặc ?ticket=). Phần còn lại đã có ở SECX (stream-ticket dùng 1 lần, ?access_token -> 401, cases_audit_secx.py:157-174) và COMMS (token thu hồi -> stream 401, cases_comms.py:236). |
| TC-COMM-057 | LOẠI | Trùng ma trận TC-COMM-171/172/173 (+177): PATCH title photo bởi newbie/Member/Mod đều 403 'Bạn không có quyền...'. Code: communities.service.ts update() requireRole('admin'). |
| TC-COMM-066 | LOẠI | Trùng ma trận TC-COMM-206..210: DELETE cộng đồng bởi newbie/Member/Mod/Admin/người bị cấm đều 403 (requireRole('owner'), communities.service.ts remove()). |
| TC-COMM-071 | LOẠI | Trùng ma trận TC-COMM-199..203 (khóa cộng đồng bởi newbie/Member/Mod/Admin/Owner đều 403 'Chỉ Platform Admin mới có quyền này'; requirePlatformAdmin, policy.ts). |
| TC-COMM-077 | LOẠI | Hành vi đã đổi có chủ đích: cộng đồng bị khóa chặn cả Owner/Admin/Mod ở mọi thao tác quản trị, kể cả PATCH (policy.ts requireRole + COMMUNITY_LOCKED; docs/api/communities.md mục 'Cộng đồng bị khóa'). Thay bằng case cuối nhóm COMM 'Cộng đồng bị khóa: Owner/Admin/Mod bị chặn thao tác quản trị...'. |
| TC-COMM-099 | LOẠI | Không thể dựng bằng API nữa: ban() chỉ chấp nhận người ĐANG là thành viên (404 nếu chưa; communities.service.ts ban()), còn người có yêu cầu pending thì chưa là thành viên và admit() tự chuyển pending -> approved. Nhánh 409 trong decideJoinRequest chỉ còn là chốt chặn đua/DB. |
| TC-COMM-135 | LOẠI | Hành vi đã đổi: 'cấm phòng ngừa' người chưa là thành viên không còn; nay 404, không tạo CommunityBan, không gửi thông báo (docs/api/communities.md dòng POST ban; communities.service.ts ban()). Thay bằng case cuối nhóm COMM 'Cấm người chưa là thành viên bị từ chối 404...'. |
| TC-COMM-156 | LOẠI | Trùng ma trận TC-COMM-218 (newbie) và TC-COMM-224 (người bị cấm): POST reviews photo -> 403 'Bạn cần tham gia cộng đồng này trước' (reviews.service.ts upsert requireMembership); khách 401 là kiểm tra chung. |
| TC-COMM-228 | LOẠI | Trùng TC-COMM-149 (Owner POST /enroll ở photo -> 409 'Chủ cộng đồng không thể rời cộng đồng của mình'; enrollments.service.ts toggle); COMM-149 còn có bước UI. |
| TC-MEMBER-013 | LOẠI | Tiêu đề ghi cứng 'tổng 66 thành viên, 7 trang': seed admin đợt 1 thêm 5 persona (sarah/alex/daniel/liam/emma) vào photo => 71 (prisma/seed/admin.ts memberOf; xác minh SQL: 71 ghi danh không bị cấm + test@gmail.com tự tạo). Thay bằng case cuối nhóm MEMBER (tổng khớp SQL). |
| TC-MEMBER-014 | LOẠI | Tiêu đề ghi cứng 'page=7 chỉ còn 6 dòng' - với 71 thành viên trang cuối là page=8 (1 dòng). Thay bằng case cuối nhóm MEMBER 'Trang cuối chỉ còn phần dư...'. |
| TC-MEMBER-034 | LOẠI | Trùng TC-AUTH-091 bước 1 (GET /users/:id không token -> 401; users.routes.ts requireAuth). |
| TC-MEMBER-035 | LOẠI | Trùng TC-AUTH-091 bước 2 (id lạ -> 404 'Không tìm thấy người dùng') và TC-AUTH-146 (user đã xóa -> 404). |
| TC-MEMBER-062 | LOẠI | Gói lại ba case đã có: đổi vai trò demo 404 (TC-COMM-127), kick demo 404 (TC-COMM-132), ban demo 404 (TC-COMM-141) và thông báo xóa cộng đồng bỏ qua demo (TC-COMM-064). |

## Sửa nội dung (UPDATE)

| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-AUTH-037 | SỬA | Cookie refresh phụ thuộc môi trường: Secure khi NODE_ENV!=development, SameSite=None khi production (auth.routes.ts:30-39). |
| TC-AUTH-054 | SỬA | member1 nay ở 4 cộng đồng: thêm paid-demo từ seed payments (prisma/seed/payments.ts:62-68; xác minh SQL). |
| TC-AUTH-055 | SỬA | member2 nay ở photo + paid-demo (2 mục), không còn 'đúng 1 mục' (seed payments.ts:62-68). |
| TC-AUTH-056 | SỬA | member3 nay ở photo + paid-demo (dùng thử) (seed payments.ts:62-68). |
| TC-AUTH-089 | SỬA | Sai dữ liệu: fin là cộng đồng RIÊNG TƯ ($5) nên bị ẩn khỏi hồ sơ công khai; chỉ photo, yt, paid-demo (users.service.ts publicProfile lọc visibility='public'; SQL fin=private). |
| TC-AUTH-097 | SỬA | Thẻ /me/communities của member1: 4 thẻ (thêm paid-demo); me/enrollments liệt kê cả cộng đồng riêng tư. |
| TC-AUTH-143 | SỬA | Đã có POST /communities/:id/transfer-ownership (communities.routes.ts:126) nên bỏ câu 'chưa có API chuyển quyền'. |
| TC-AUTH-157 | SỬA | Email nhận nay lấy từ Cài đặt chung platform.supportEmail (support.service.ts contact(), settings.service.ts:21); contact còn tạo ticket (ADM3). |
| TC-SEC-024 | SỬA | ?access_token đã bị bỏ ở cả SSE (notifications.routes.ts:19-32); không còn 'chỉ dành cho SSE'. |
| TC-SEC-029 | SỬA | NODE_ENV bắt buộc; cookie: secure = NODE_ENV!=development, sameSite = production?none:lax (auth.routes.ts:30-39). |
| TC-COMM-068 | SỬA | 'ai' nay có chủ (alex, seed admin.ts extraOwners); đổi sang cộng đồng seed vẫn không chủ ('eng'; SQL ownerId null). |
| TC-COMM-072 | SỬA | Bị khóa còn chặn cả Owner/Admin/Mod ở thao tác quản trị (policy.ts requireRole); ghi chú trỏ tới case thay thế (thay COMM-077). |
| TC-COMM-079 | SỬA | Lỗi 402 nay có details {communityId, courseId} (enrollments.service.ts toggle). |
| TC-COMM-094 | SỬA | Duyệt yêu cầu: chỉ cộng đồng MIỄN PHÍ mới cấp quyền; có phí chỉ cho phép thanh toán (communities.service.ts decideJoinRequest); link thông báo BE vẫn /courses/... (FE redirect). |
| TC-COMM-100 | SỬA | acceptInvite trả {communityId, courseId, joined} (communities.service.ts). |
| TC-COMM-109 | SỬA | Như COMM-100: phản hồi có communityId + courseId. |
| TC-COMM-111 | SỬA | 402 của accept lời mời có details {communityId, courseId}. |
| TC-COMM-129 | SỬA | Kick còn kết thúc gói trả phí ngay (paymentsService.endMembership) - ghi chú tới MONEY. |
| TC-COMM-136 | SỬA | Bước 3 không thể 'cấm banned@ khỏi private-demo' khi chưa là thành viên (ban => 404): thêm bước vào private-demo bằng DEMO-VALID trước. |
| TC-COMM-140 | SỬA | Fixture 'newbie@ bị cấm' không dựng được khi newbie chưa là thành viên: phải tham gia X trước rồi bị cấm. |
| TC-COMM-162 | SỬA | Số thành viên photo 66 -> 71 (5 persona seed admin đợt 1) ở tiền điều kiện. |
| TC-COMM-163 | SỬA | Như COMM-162 (tiền điều kiện). |
| TC-COMM-164 | SỬA | meta.total 66 -> 71. |
| TC-COMM-165 | SỬA | meta.total 66 -> 71. |
| TC-COMM-166 | SỬA | meta.total 66 -> 71. |
| TC-COMM-167 | SỬA | meta.total 66 -> 71. |
| TC-COMM-168 | SỬA | meta.total 66 -> 71. |
| TC-COMM-169 | SỬA | Như COMM-162 (tiền điều kiện). |
| TC-COMM-233 | SỬA | details 402 nay {communityId, courseId}. |
| TC-MEMBER-018 | SỬA | counts.all không còn 66 (71). |
| TC-MEMBER-028 | SỬA | Thẻ thông tin hiển thị 71 thành viên. |
| TC-MEMBER-033 | SỬA | Hồ sơ công khai member1: photo, yt, paid-demo (thêm paid-demo; fin riêng tư bị ẩn). |
| TC-MEMBER-054 | SỬA | memberPct tính lại với 71 thành viên (cấp1 30/71=42, cấp2 31, cấp3 13, cấp4 6, cấp5 7, cấp6 1; SQL). |
| TC-MEMBER-065 | SỬA | Điểm trừ khi xóa bài/sự kiện đã làm (PointEvent reason 'revoked', points.repository.ts revokePointsInTx); còn thiếu huy hiệu/thông báo lên cấp. |
| TC-AUTH-102 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-103 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-105 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-106 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-112 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-114 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-121 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-122 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-129 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-150 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-151 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-158 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-AUTH-160 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-SEC-014 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |
| TC-SEC-034 | SỬA | Hộp thư dev /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (mail.routes.ts:7-9, env.ts:27); nội dung thư lấy từ mẫu email active (mail-templates.service.ts:60-70): thêm tiền điều kiện. |

## Sửa cơ học (tính là Giữ)

- Đổi đường dẫn sang chuẩn `/api/communities/...` và FE `/communities/...`: TC-AUTH-058, 087, 101; TC-SEC-030, 033, 038; hầu hết TC-COMM-033..237 và TC-MEMBER-013..061 (cột steps).
- Làm mới tiền điều kiện/ghi chú số thành viên photo (71 thay vì 66) ở TC-MEMBER-015..063: hằng `LB` và `SEED` trong cases_community.py.

## Mới thêm (thay thế case đã loại)

| TC (dự kiến) | Thay cho | Nội dung |
|---|---|---|
| TC-AUTH-163 | TC-AUTH-095 | GET /me/enrollments của member1 (4 cộng đồng, kể cả riêng tư) |
| TC-COMM-238 | TC-COMM-077 | Cộng đồng bị khóa chặn Owner/Admin/Mod (COMMUNITY_LOCKED), Platform Admin vẫn quản trị |
| TC-COMM-239 | TC-COMM-135 | Cấm người chưa là thành viên -> 404, không tạo bản ghi cấm/thông báo |
| TC-MEMBER-066 | TC-MEMBER-013 | Danh sách thành viên mặc định photo, tổng khớp SQL |
| TC-MEMBER-067 | TC-MEMBER-014 | Trang cuối/vượt trang (N=71) |

Số TC dự kiến tính theo thứ tự sinh; lead đối chiếu lại sau khi sinh xlsx.

## Lệch phát hiện khi rà soát (BUG/tài liệu, KHÔNG loại case)

- `catalog.service.ts:20,29,46` trả 'Không tìm thấy khóa học' cho cộng đồng không tồn tại (thuật ngữ cũ sau khi tách Community/Course) - case COMM giữ nguyên thông điệp thật.
- `communities.service.ts:21 linkOf()` và thông báo duyệt yêu cầu vẫn phát link `/courses/...` (không phải `/communities/...`); chạy được nhờ LegacyCourseRedirect.
- `transferOwnership` không kiểm `isDemo` (TC-COMM-146 đã ghi nhận): có thể chuyển quyền chủ cho thành viên minh họa không đăng nhập được.
- `backend/docs/api/communities.md` ('Cộng đồng seed không có owner...') và `backend/docs/api/identity.md` ('Chuyển quyền owner ... chưa làm') đã lỗi thời: seed admin đợt 1 gán chủ cho ai/mkt/fit/des/biz; API transfer-ownership đã có.
