# -*- coding: utf-8 -*-
"""Phần 2 rà soát testcase lỗi thời: cases_auth.py (AUTH mới, SEC) và cases_community.py (COMM, MEMBER).
Không case nào bị loại có kết quả Test 1/Test 2 (workbook hiện tại: toàn bộ 'Chưa test'). Chi tiết: qa/review_notes/part2.md"""
RETIRED = {
    # ---------------------------------------------------------------- AUTH / SEC
    "TC-AUTH-062": "Trùng với TC-MEMBER-060 (cùng POST /auth/login bằng seed-photo-0@demo.sofinhub.invalid, 401); MEMBER-060 đầy đủ hơn (thêm mật khẩu rỗng/'!demo-account-cannot-login' và đăng ký lại 409). Code: auth.service.ts:72 chặn isDemo.",
    "TC-AUTH-090": "Trùng TC-MEMBER-036 (hồ sơ người bị cấm không liệt kê photo; MEMBER-036 còn kiểm totalPoints=0). Code: users.service.ts publicProfile + enrollment listByUser loại người bị cấm.",
    "TC-AUTH-095": "Tiêu đề ghi cứng '3 cộng đồng' nhưng seed payments ghi danh member1 thêm paid-demo => 4 (DB: photo, yt, fin, paid-demo; prisma/seed/payments.ts:62). Thay bằng case cuối nhóm AUTH 'GET /me/enrollments của member1: các cộng đồng đã tham gia (kể cả riêng tư)...'.",
    "TC-AUTH-161": "Trùng case ADM3 'POST /api/contact validate và giới hạn tốc độ 5 lần/khoảng' (cases_admin3.py:654, limiter(5) ở support.routes.ts:12-23); giữ AUTH-157..160, 162 (biên độ từng trường, CRLF, UI).",
    "TC-SEC-037": "Lỗi thời + trùng: kỳ vọng '?access_token mở được stream' đã bị bỏ (notifications.routes.ts:19-32, messages.routes.ts:48-55 chỉ nhận Bearer hoặc ?ticket=). Phần còn lại đã có ở SECX (stream-ticket dùng 1 lần, ?access_token -> 401, cases_audit_secx.py:157-174) và COMMS (token thu hồi -> stream 401, cases_comms.py:236).",
    # ---------------------------------------------------------------- COMM
    "TC-COMM-057": "Trùng ma trận TC-COMM-171/172/173 (+177): PATCH title photo bởi newbie/Member/Mod đều 403 'Bạn không có quyền...'. Code: communities.service.ts update() requireRole('admin').",
    "TC-COMM-066": "Trùng ma trận TC-COMM-206..210: DELETE cộng đồng bởi newbie/Member/Mod/Admin/người bị cấm đều 403 (requireRole('owner'), communities.service.ts remove()).",
    "TC-COMM-071": "Trùng ma trận TC-COMM-199..203 (khóa cộng đồng bởi newbie/Member/Mod/Admin/Owner đều 403 'Chỉ Platform Admin mới có quyền này'; requirePlatformAdmin, policy.ts).",
    "TC-COMM-077": "Hành vi đã đổi có chủ đích: cộng đồng bị khóa chặn cả Owner/Admin/Mod ở mọi thao tác quản trị, kể cả PATCH (policy.ts requireRole + COMMUNITY_LOCKED; docs/api/communities.md mục 'Cộng đồng bị khóa'). Thay bằng case cuối nhóm COMM 'Cộng đồng bị khóa: Owner/Admin/Mod bị chặn thao tác quản trị...'.",
    "TC-COMM-099": "Không thể dựng bằng API nữa: ban() chỉ chấp nhận người ĐANG là thành viên (404 nếu chưa; communities.service.ts ban()), còn người có yêu cầu pending thì chưa là thành viên và admit() tự chuyển pending -> approved. Nhánh 409 trong decideJoinRequest chỉ còn là chốt chặn đua/DB.",
    "TC-COMM-135": "Hành vi đã đổi: 'cấm phòng ngừa' người chưa là thành viên không còn; nay 404, không tạo CommunityBan, không gửi thông báo (docs/api/communities.md dòng POST ban; communities.service.ts ban()). Thay bằng case cuối nhóm COMM 'Cấm người chưa là thành viên bị từ chối 404...'.",
    "TC-COMM-156": "Trùng ma trận TC-COMM-218 (newbie) và TC-COMM-224 (người bị cấm): POST reviews photo -> 403 'Bạn cần tham gia cộng đồng này trước' (reviews.service.ts upsert requireMembership); khách 401 là kiểm tra chung.",
    "TC-COMM-228": "Trùng TC-COMM-149 (Owner POST /enroll ở photo -> 409 'Chủ cộng đồng không thể rời cộng đồng của mình'; enrollments.service.ts toggle); COMM-149 còn có bước UI.",
    # ---------------------------------------------------------------- MEMBER
    "TC-MEMBER-013": "Tiêu đề ghi cứng 'tổng 66 thành viên, 7 trang': seed admin đợt 1 thêm 5 persona (sarah/alex/daniel/liam/emma) vào photo => 71 (prisma/seed/admin.ts memberOf; xác minh SQL: 71 ghi danh không bị cấm + test@gmail.com tự tạo). Thay bằng case cuối nhóm MEMBER (tổng khớp SQL).",
    "TC-MEMBER-014": "Tiêu đề ghi cứng 'page=7 chỉ còn 6 dòng' - với 71 thành viên trang cuối là page=8 (1 dòng). Thay bằng case cuối nhóm MEMBER 'Trang cuối chỉ còn phần dư...'.",
    "TC-MEMBER-034": "Trùng TC-AUTH-091 bước 1 (GET /users/:id không token -> 401; users.routes.ts requireAuth).",
    "TC-MEMBER-035": "Trùng TC-AUTH-091 bước 2 (id lạ -> 404 'Không tìm thấy người dùng') và TC-AUTH-146 (user đã xóa -> 404).",
    "TC-MEMBER-062": "Gói lại ba case đã có: đổi vai trò demo 404 (TC-COMM-127), kick demo 404 (TC-COMM-132), ban demo 404 (TC-COMM-141) và thông báo xóa cộng đồng bỏ qua demo (TC-COMM-064).",
}
