# -*- coding: utf-8 -*-
"""Testcase module GAME (Điểm thưởng & chính sách ranh giới trạng thái - audit backend 2026-10-01, BƯỚC 3, 04/10/2026).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 5.1, 5.2, 6.1, 6.2 + backend/docs/api/{content,communities,moderation}.md, backend/docs/API.md ("Vòng đời tiền & điểm"),
backend/src/middlewares/rate-limit.ts, backend/src/modules/{points,posts,events,communities,moderation,permissions}/*, backend/prisma/migrations/20261004100000_money_lifecycle_points,
backend/tests/points-policy.test.ts (kịch bản được viết thành test TRƯỚC khi sửa).
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-GAME-nnn không đổi).

SỐ LIỆU ĐIỂM (đều TẠM, xem points.types/points.levels): đăng bài +5; like NHẬN được +2 (chỉ lần like đầu của mỗi cặp user-bài, không tự like, không từ thành viên minh họa); RSVP sự kiện +1; hoàn thành bài học +3 (1 lần/bài);
ngưỡng cấp độ [0,20,60,120,200,300,450,650,900] (cấp 1..9). Điểm âm bù (reason 'revoked') ghi trong CÙNG transaction với việc xóa bài/sự kiện.
Cách xem điểm: GET /api/me/points -> {total, byCourse:[{course,points,communityId}], recent:[PointEvent x20]}; hoặc GET /api/courses/<id>/leaderboard?window=all; hoặc SQL: SELECT sum(points) FROM "PointEvent" WHERE "userId"=... AND "courseId"='photo'.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev), frontend :5173. "
        "LƯU Ý: ở dev rate limit đang BẬT (đăng bài 10/phút/user, bình luận 30, like 60, RSVP 30, bình chọn 60; toàn cục 1200/phút/IP) - đặt RATE_LIMIT_DISABLED=1 trong backend/.env khi cần chạy vòng lặp nhiều lần và khởi động lại backend.")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset; hoặc chỉ dùng tài khoản/cộng đồng do chính case tạo ra."
USER = "Người dùng thử = tài khoản MỚI đăng ký bằng POST /api/auth/register rồi POST /api/courses/photo/enroll (photo miễn phí, công khai)."
ADMIN = "Token admin: POST /api/auth/login admin@sofinhub.test / Passw0rd!x (Platform Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (cột cộng đồng của mọi bảng tên \"courseId\")."
LOCKSET = ("Cộng đồng thử: Owner mới tạo bằng POST /api/communities {\"title\":\"Nhóm sẽ bị khóa\",\"description\":\"mô tả\",\"category\":\"tech\",\"priceUsd\":5,\"visibility\":\"public\"} -> id; "
           "thêm mod (SQL/UI đặt vai trò) và 1 thành viên; admin@ khóa: POST /api/admin/courses/<id>/lock {\"reason\":\"lừa đảo\"}.")


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}}."


def load(add):
    M, MN = "GAME", "Điểm thưởng & chính sách (audit bước 3)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. FARM ĐIỂM: ĐĂNG BÀI + XÓA (5.1)
    F = "Farm điểm: đăng bài rồi xóa (audit 5.1)"
    A(F, "Đăng bài + xóa lặp 5 lần: điểm ròng = 0 (điểm âm bù cùng transaction)", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["U POST /api/courses/photo/posts {\"content\":\"bài thử điểm\",\"category\":\"Thảo luận chung\",\"tags\":[]} -> id; GET /api/me/points (+5)", "U DELETE /api/posts/<id> -> 200; GET /api/me/points (về 0)", "Lặp thêm 4 lần (tổng 5 vòng; chú ý rate limit 10 bài/phút)", "SQL: SELECT sum(points) FROM \"PointEvent\" WHERE \"userId\"='<U.id>'"], "5 vòng",
      "Mỗi vòng: sau đăng total=5 (byCourse photo=5), sau xóa total=0. Tổng PointEvent = 0 (5 dòng post +5 và 5 dòng revoked -5 theo từng sourceId).", pw="Có")
    A(F, "Biến thể cộng tác: A đăng (+5), B like (+2 cho A), A xóa bài -> vòng lặp net 0 (không còn 7 điểm/vòng)", "Chức năng", "Cao", BASE + " " + USER + " Hai user A, B cùng tham gia photo.",
      ["A đăng bài; B POST /api/posts/<id>/like", "GET /api/me/points của A -> 7", "A xóa bài; GET lại -> 0", "Lặp 4 vòng"], "A đăng, B like, A xóa",
      "Mỗi vòng: A = 7 trước khi xóa, 0 sau khi xóa. Trước đây: PostLikeNotice cascade xóa khiến vòng sau cộng tiếp 7 điểm/vòng vô hạn.", pw="Có")
    A(F, "Xóa bài nhiều like: bù đủ điểm đăng bài + MỌI điểm like_received của bài đó, không đụng bài khác", "Chức năng", "Cao", BASE + " " + USER + " 3 người like (L1,L2,L3) cùng tham gia photo.",
      ["A đăng 2 bài: keep và drop (A=10)", "L1,L2,L3 đều like cả keep lẫn drop (A = 10 + 6 + 6 = 22)", "A xóa bài drop", "GET /api/me/points của A"], "2 bài x 3 like",
      "Trước xóa: 22. Sau xóa bài drop: 11 (5 điểm đăng keep + 6 like keep); bài keep còn nguyên điểm.", pw="Có")
    A(F, "Khóa nghiệp vụ: like/unlike/like cùng bài chỉ cộng 2 điểm MỘT lần; tự like không có điểm", "Chức năng", "Cao", BASE + " " + USER,
      ["A đăng bài (A=5)", "B like, unlike, like (3 lần POST /api/posts/<id>/like)", "A tự like bài của mình", "GET điểm A và SQL đếm PointEvent reason='like_received'"], "like lặp + tự like",
      "A = 7 (5 + 2) sau mọi thao tác; tự like không đổi điểm; đếm like_received = 1.", pw="Có")
    A(F, "DB chặn cứng PointEvent trùng khóa (user, reason, sourceType, sourceId): unique violation", "Bảo mật", "Cao", BASE + " " + USER + " " + SQLH,
      ["A đăng bài P (có PointEvent post sourceId=P)", "SQL: INSERT INTO \"PointEvent\"(id,\"userId\",\"courseId\",points,reason,\"sourceType\",\"sourceId\") VALUES (gen_random_uuid(),'<A.id>','photo',5,'post','post','<P>')"], "chèn trùng",
      "Lỗi 23505 duplicate key (UNIQUE userId,reason,sourceType,sourceId); pointsService.award với cùng nguồn trả undefined (idempotent).", pw="Không")
    A(F, "Điểm đăng bài chỉ cộng 1 lần cho mỗi bài (sửa bài không cộng thêm)", "Chức năng", "Trung bình", BASE + " " + USER,
      ["A đăng bài (5)", "A PATCH /api/posts/<id> {\"content\":\"đã sửa\"} 3 lần"], "sửa bài", "Điểm vẫn 5; PostView có editedAt.", pw="Có")
    A(F, "Xóa bài của người khác (mod xóa) cũng bù điểm của tác giả", "Chức năng", "Trung bình", BASE + " " + USER + " " + tok("owner@sofinhub.test"),
      ["A đăng bài (A=5)", "owner@ (mod+ ở photo) DELETE /api/posts/<id>", "GET điểm A"], "mod xóa", "A về 0 (điểm âm bù theo sourceType/sourceId, không phụ thuộc ai xóa).", pw="Có")
    A(F, "Điểm like KHÔNG bị cộng khi tác giả là thành viên minh họa (isDemo)", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test") + " " + SQLH,
      ["Chọn 1 bài do thành viên minh họa (SELECT p.id FROM \"Post\" p JOIN \"User\" u ON u.id=p.\"authorId\" WHERE u.\"isDemo\" LIMIT 1)", "member1 like bài đó", "SQL: PointEvent của tác giả minh họa"], "bài của demo",
      "Like thành công (likesCount +1) nhưng không phát sinh PointEvent like_received và không có thông báo cho tác giả minh họa.", pw="Không")
    A(F, "Điểm hoàn thành bài học chỉ 1 lần cho mỗi (user, bài) dù bật/tắt hoàn thành nhiều lần", "Chức năng", "Trung bình", BASE + " " + USER + " Photo có lớp học (2 module x 6 bài).",
      ["U POST /api/courses/photo/lessons/les-photo-1-1/complete (+3)", "POST lại (bỏ hoàn thành) rồi POST lần 3 (hoàn thành lại)", "GET điểm"], "complete toggle",
      "Tổng chỉ +3 (PointEvent lesson_complete với sourceType 'lesson', sourceId = lessonId). Lưu ý: endpoint là toggle - xem case Kế hoạch.", pw="Có")
    A(F, "HIỆN TẠI: POST /lessons/:id/complete là toggle, không idempotent (retry làm bài đang xong thành chưa xong)", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U POST complete lần 1 -> completed:true", "POST lần 2 (mô phỏng client retry mạng chập)"], "audit 6.6",
      "HIỆN TẠI: lần 2 trả completed:false (bỏ đánh dấu) - classroom.md vẫn ghi 'toggle như cũ'. KỲ VỌNG: PUT/DELETE tách rời hoặc body {completed}. Ngoài phạm vi bước 3 (điểm thì vẫn chống farm).", pw="Có", st=PLAN)
    A(F, "Điểm cũ (không có sourceType) KHÔNG bù được khi xóa nguồn: dữ liệu seed/legacy giữ nguyên điểm", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test") + " " + SQLH + " " + MUTATE,
      ["SQL: SELECT count(*) FROM \"PointEvent\" WHERE \"sourceType\" IS NULL (seed: toàn bộ điểm seed)", "member1 (hoặc admin) xóa bài seed seed-post-photo-m1-image", "Xem điểm member1 ở photo (seed 110)"], "điểm legacy",
      "Điểm seed của member1 không đổi (110): các dòng NULL sourceType không có khóa nguồn nên không bù được (ghi chú trong content.md). Điểm sinh sau migration thì bù đúng.", pw="Không")
    A(F, "Điểm không âm bất thường: tổng điểm user không xuống dưới 0 do bù trừ lặp", "Chức năng", "Thấp", BASE + " " + USER,
      ["A đăng bài rồi xóa", "Gọi DELETE /api/posts/<id> lần 2", "GET điểm"], "xóa 2 lần", "Lần 2: 404 (bài đã xóa); điểm giữ 0 (không có dòng revoked thứ hai nhờ khóa nghiệp vụ).", pw="Có")

    # ============================================================ 2. FARM ĐIỂM: RSVP (5.2)
    F = "Farm điểm: RSVP -> hủy -> RSVP (audit 5.2)"
    EV = "Sự kiện thử: mod (owner@) POST /api/courses/photo/events {\"title\":\"Workshop\",\"startAt\":\"<ISO +5 ngày>\"} -> eventId."
    A(F, "RSVP/hủy/RSVP lại nhiều lần chỉ +1 điểm", "Chức năng", "Cao", BASE + " " + USER + " " + EV,
      ["U POST /api/events/<id>/rsvp -> rsvped:true (+1)", "U DELETE /api/events/<id>/rsvp -> rsvped:false", "Lặp 4 vòng (đủ rate limit 30/phút), kết thúc bằng RSVP", "GET điểm; SQL đếm PointEvent reason='event_rsvp'"], "4 vòng",
      "Tổng điểm của U = 1; đếm event_rsvp = 1 (khóa ('event', eventId)).", pw="Có")
    A(F, "Xóa sự kiện thu hồi điểm RSVP của mọi người đã RSVP", "Chức năng", "Cao", BASE + " " + USER + " " + EV + " " + tok("owner@sofinhub.test"),
      ["U RSVP (U=1)", "owner@ DELETE /api/events/<id>", "GET điểm U và thông báo của U"], "xóa sự kiện",
      "U về 0 (dòng revoked -1 sourceType 'event'); U nhận thông báo (type system) về sự kiện bị xóa.", pw="Có")
    A(F, "RSVP sự kiện đã diễn ra -> 400; đủ chỗ -> 409; RSVP hai lần liên tiếp là toggle (giữ nguyên hành vi)", "Chức năng", "Trung bình", BASE + " " + tok("member3@sofinhub.test"),
      ["member3 RSVP seed-event-photo-past", "member3 RSVP seed-event-photo-limited (còn đúng 1 chỗ, đã 2/3 - member2 giữ chỗ)", "RSVP hai lần liên tiếp cùng sự kiện"], "seed",
      "Sự kiện quá khứ: 400; limited: 200 rồi đủ chỗ cho người kế -> 409; hai lần liên tiếp: lần 2 hủy (toggle) nhưng KHÔNG cộng thêm điểm.", pw="Một phần")
    A(F, "DELETE /events/:id/rsvp idempotent: hủy khi chưa RSVP vẫn 200 rsvped:false", "Chức năng", "Thấp", BASE + " " + USER + " " + EV,
      ["U DELETE rsvp khi chưa RSVP", "U RSVP rồi DELETE hai lần"], "cancel", "Mọi lần: 200 {rsvped:false, rsvpCount} (idempotent, kể cả khi chưa RSVP); 404 chỉ khi sự kiện không tồn tại.", pw="Có")
    A(F, "Bài đăng bị rate limit không sinh điểm (429 trước khi tạo)", "Chức năng", "Thấp", BASE + " " + USER,
      ["U đăng 10 bài trong 1 phút (đủ hạn mức)", "Đăng bài thứ 11", "GET điểm"], "11 bài", "Bài 11: 429 và KHÔNG có điểm cộng; tổng = 50 (10 bài x 5).", pw="Có")
    A(F, "Cấp độ không thể 'farm' bằng vòng lặp: 10 vòng đăng+xóa không nâng cấp, module requiredLevel vẫn khóa", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test") + " member1 là thành viên yt, đã xong module 1, module 2 có requiredLevel=2 (cần >= 20 điểm ở yt) nên đang khóa. " + MUTATE,
      ["Ghi điểm yt hiện tại: GET /api/me/points (byCourse yt) và GET /api/courses/yt/modules (module 2 locked)", "member1 đăng + xóa bài ở yt 10 vòng (POST /api/courses/yt/posts, DELETE /api/posts/<id>)", "GET lại /api/me/points, /api/courses/yt/levels, /api/courses/yt/modules"], "10 vòng ở yt",
      "Điểm yt của member1 không đổi so với trước (net 0); module 2 vẫn khóa theo cấp độ (lockReason 'level'); không có bước nhảy cấp.", pw="Một phần")
    A(F, "Điểm thật vẫn lên cấp: 4 bài giữ lại (20 điểm) -> Cấp 2", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U đăng 4 bài (mỗi bài +5), không xóa", "GET /api/courses/photo/levels"], "20 điểm", "Tổng 20 điểm => levelFor(20) = Cấp 2 'Creator' (ngưỡng 20); GET /courses/photo/levels đánh dấu cấp hiện tại.", pw="Có")
    A(F, "HIỆN TẠI: GET /courses/:id/levels - cấp 7, 8, 9 chưa có tên (name rỗng)", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/levels", "Đọc cấp 7-9"], "audit 6.6", "HIỆN TẠI: LEVELS[6..8].name = '' (NAMED có 6 tên cho 9 cấp); FE hiển thị ô trống. Chưa sửa trong bước 3.", pw="Có", st=PLAN)

    # ============================================================ 3. requireRole + LOCKED (6.2) - MA TRẬN
    F = "Cộng đồng bị khóa: requireRole chặn owner/admin/mod (audit 6.2)"
    ACTIONS = [
        ("Sửa thông tin cộng đồng", "PATCH /api/courses/<id> {\"description\":\"xóa dấu vết\"}", "admin+"),
        ("Xóa cộng đồng", "DELETE /api/courses/<id>", "owner"),
        ("Tạo lời mời", "POST /api/courses/<id>/invites {}", "admin+"),
        ("Đổi vai trò thành viên", "PATCH /api/courses/<id>/members/<uid>/role {\"role\":\"mod\"}", "admin+"),
        ("Kick thành viên", "DELETE /api/courses/<id>/members/<uid>", "admin+"),
        ("Ban thành viên", "POST /api/courses/<id>/members/<uid>/ban {\"reason\":\"x\"}", "admin+"),
        ("Gỡ ban", "DELETE /api/courses/<id>/members/<uid>/ban", "admin+"),
        ("Chuyển quyền sở hữu", "POST /api/courses/<id>/transfer-ownership {\"userId\":\"<uid>\"}", "owner"),
        ("Tạo module lớp học", "POST /api/courses/<id>/modules {\"title\":\"Module\",\"description\":\"\"}", "mod+"),
        ("Tạo bài học", "POST /api/courses/<id>/modules/<moduleId>/lessons {title,type:'text',durationMin:1,body}", "mod+"),
        ("Đổi cài đặt chứng nhận", "PATCH /api/courses/<id>/classroom-settings {\"certificatesEnabled\":true}", "admin+"),
        ("Xem doanh thu", "GET /api/courses/<id>/revenue", "owner"),
        ("Xem/tạo lệnh rút tiền", "GET/POST /api/courses/<id>/payouts", "owner"),
        ("Duyệt/từ chối yêu cầu tham gia", "POST /api/join-requests/<rid>/approve|reject", "admin+"),
        ("Tạo/sửa/xóa sự kiện", "POST /api/courses/<id>/events (mod+)", "mod+"),
        ("Ẩn/ghim bài viết", "POST /api/posts/<pid>/hide|pin", "mod+"),
    ]
    for name, call, minrole in ACTIONS:
        A(F, f"Locked: '{name}' bị 403 với owner/admin/mod; Platform Admin vẫn làm được", "Bảo mật", "Cao", BASE + " " + LOCKSET + " " + ADMIN,
          [f"Trước khi khóa: thực hiện {call} bằng vai trò đủ quyền ({minrole}) -> thành công (nếu áp dụng)", "admin@ khóa cộng đồng", f"Thực hiện {call} lần lượt bằng Owner, Admin cộng đồng, Mod", "Thực hiện lại bằng admin@ (Platform Admin)", "admin@ unlock rồi Owner thử lại"], name,
          "Khi bị khóa: Owner, Admin cộng đồng, Mod đều 403 (COMMUNITY_LOCKED / FORBIDDEN) và dữ liệu không đổi; Platform Admin thực hiện được (200/201). Sau unlock: vai trò đủ quyền làm lại được 200.", pw="Một phần")
    A(F, "Locked: owner KHÔNG xóa được cộng đồng/đổi mô tả để xóa dấu vết (kịch bản lừa đảo của audit)", "Bảo mật", "Cao", BASE + " " + LOCKSET,
      ["Owner thử DELETE /api/courses/<id> và PATCH đổi tên/mô tả", "SQL: SELECT \"deletedAt\",title FROM \"Course\" WHERE id='<id>'"], "owner bị khóa", "Cả hai 403; deletedAt vẫn NULL; tên/mô tả giữ nguyên.", pw="Một phần")
    A(F, "Locked: owner KHÔNG chuyển quyền sang tài khoản phụ và KHÔNG rút tiền", "Bảo mật", "Cao", BASE + " " + LOCKSET,
      ["Owner POST transfer-ownership {userId: tài khoản phụ}", "Owner POST /api/courses/<id>/payouts {amountCents:1000, method:{type:'bank',...}}"], "chuyển quyền + payout", "Cả hai 403; Course.ownerId không đổi; không có Payout mới.", pw="Một phần")
    A(F, "Locked: thành viên thường vẫn bị COMMUNITY_LOCKED khi đọc bài/lớp học (hành vi cũ)", "Bảo mật", "Trung bình", BASE + " " + LOCKSET,
      ["Thành viên GET /api/courses/<id>/posts", "GET /api/courses/<id>/modules"], "member bị khóa", "403 COMMUNITY_LOCKED (trang chi tiết công khai vẫn xem được, locked=true).", pw="Có")
    A(F, "Locked: nhân viên admin Moderator/Support/Finance KHÔNG có quyền ghi đè Owner ở cộng đồng (chỉ Platform Admin env)", "Bảo mật", "Trung bình", BASE + " " + LOCKSET + " " + tok("moderator@sofinhub.test"),
      ["moderator@ PATCH /api/courses/<id> {description}", "finance@ GET /api/courses/<id>/revenue"], "staff", "403 FORBIDDEN (nhân viên Moderator/Support/Finance chỉ có quyền /api/admin/*, không ghi đè vai trò cộng đồng); khác với admin@ (PLATFORM_ADMIN_EMAILS).", pw="Có")
    A(F, "Unlock trả lại quyền: owner PATCH được ngay", "Chức năng", "Trung bình", BASE + " " + LOCKSET,
      ["admin@ POST /api/admin/courses/<id>/unlock", "Owner PATCH /api/courses/<id> {\"description\":\"đã mở khóa\"}"], "unlock", "200; mô tả cập nhật.", pw="Có")
    A(F, "FE: owner của cộng đồng bị khóa mở Cài đặt cộng đồng - thao tác lỗi hiển thị thông điệp, không crash", "Giao diện", "Trung bình", BASE + " " + LOCKSET + " Đăng nhập Owner trên FE.",
      ["Mở /communities/<id>/community/cai-dat", "Bấm Lưu thay đổi ở tab thông tin", "Thử chuyển quyền/tạo mã mời"], "FE locked", "Trang hiển thị; mọi thao tác ghi báo lỗi 403 bằng thông điệp từ server (không màn trắng); dữ liệu không đổi.", pw="Một phần")

    # ============================================================ 4. ban() (6.1)
    F = "ban(): không còn là oracle dò userId (audit 6.1)"
    A(F, "Ban uuid lạ -> 404, không tạo CommunityBan, không thông báo", "Bảo mật", "Cao", BASE + " " + tok("owner@sofinhub.test") + " " + SQLH,
      ["POST /api/courses/photo/members/00000000-0000-4000-8000-000000000000/ban {\"reason\":\"dò\"}", "SQL: SELECT count(*) FROM \"CommunityBan\" WHERE \"userId\"='00000000-0000-4000-8000-000000000000'"], "uuid không tồn tại",
      "404; CommunityBan = 0.", pw="Có")
    A(F, "Ban tài khoản có thật nhưng CHƯA là thành viên -> 404 (không phân biệt được với uuid lạ), không thông báo", "Bảo mật", "Cao", BASE + " " + tok("owner@sofinhub.test") + " Người ngoài = user mới đăng ký (không thuộc photo). " + SQLH,
      ["owner@ POST /api/courses/photo/members/<outsider.id>/ban {\"reason\":\"dò\"}", "Đợi 1 giây; GET /api/notifications bằng outsider", "SQL: CommunityBan và Notification của outsider"], "tài khoản thật chưa là thành viên",
      "404 giống hệt trường hợp uuid lạ (không oracle liệt kê userId). Outsider KHÔNG nhận thông báo 'Bạn bị cấm khỏi ...'; không có hàng CommunityBan rác chặn họ tham gia sau này.", pw="Có")
    A(F, "Ban thành viên thật: 200, ghi CommunityBan, gỡ Enrollment, đúng 1 thông báo removed_from_community", "Chức năng", "Cao", BASE + " " + USER + " " + tok("owner@sofinhub.test") + " " + SQLH,
      ["owner@ POST /api/courses/photo/members/<U.id>/ban {\"reason\":\"spam\"}", "SQL: CommunityBan, Enrollment của U", "GET /api/notifications của U (đợi vài giây)"], "ban hợp lệ",
      "200 {banned:true}; CommunityBan = 1; Enrollment = 0; U có đúng 1 thông báo type removed_from_community ('Bạn bị cấm khỏi ...').", pw="Có")
    A(F, "Thứ tự an toàn: ghi lệnh cấm TRƯỚC khi gỡ ghi danh -> gỡ cấm không làm 'hồi sinh' Enrollment ma", "Bảo mật", "Cao", BASE + " " + USER + " " + tok("owner@sofinhub.test") + " " + SQLH,
      ["Ban U (photo miễn phí, không có gói)", "owner@ DELETE /api/courses/photo/members/<U.id>/ban", "SQL: SELECT count(*) FROM \"Enrollment\" WHERE \"userId\"='<U.id>' AND \"courseId\"='photo'"], "ban -> unban",
      "Sau gỡ cấm: Enrollment = 0 (không có hàng ma hồi sinh); U phải tham gia lại bằng POST /enroll. (Với cộng đồng trả phí và gói còn hạn thì gỡ cấm trả quyền - nhóm MONEY.)", pw="Một phần")
    A(F, "Ban bị chặn theo bậc: mod không ban được admin/owner; không ban chính mình (400)", "Bảo mật", "Cao", BASE + " " + tok("mod@sofinhub.test"),
      ["mod@ ban cadmin@ (admin) ở cộng đồng chung", "mod@ ban owner@", "owner@ ban chính mình"], "rank", "403 (chỉ tác động lên bậc thấp hơn, không bao giờ lên Owner); tự ban: 400.", pw="Có")
    A(F, "Ban thành viên minh họa (isDemo) -> 404", "Chức năng", "Thấp", BASE + " " + tok("owner@sofinhub.test") + " " + SQLH,
      ["Lấy id demo: SELECT id FROM \"User\" WHERE \"isDemo\" LIMIT 1", "owner@ ban id đó ở photo"], "demo", "404 (thành viên minh họa không kick/ban/đổi vai trò được).", pw="Có")
    A(F, "Người bị cấm không tham gia lại được: enroll 403, join-request 403, nhận lời mời 403", "Bảo mật", "Cao", BASE + " " + USER + " " + tok("owner@sofinhub.test"),
      ["Ban U", "U POST /api/courses/photo/enroll", "U POST /api/courses/photo/join-requests {}", "U POST /api/invites/DEMO-VALID/accept (nếu cộng đồng khớp)"], "banned user", "Cả ba 403 (bị cấm); GET /api/courses/photo/bans (admin+) liệt kê U kèm lý do.", pw="Có")
    A(F, "Gỡ cấm cho phép tham gia lại (cộng đồng miễn phí)", "Chức năng", "Trung bình", BASE + " " + USER + " " + tok("owner@sofinhub.test"),
      ["Ban rồi DELETE ban", "U POST /api/courses/photo/enroll"], "unban -> join", "Enroll 200 enrolled:true; GET bans không còn U.", pw="Có")
    A(F, "Kiểm thử đã có: seed banned@sofinhub.test không vào được cộng đồng bị cấm", "Chức năng", "Thấp", BASE + " " + tok("banned@sofinhub.test"),
      ["GET /api/courses/photo/bans (admin) tìm banned@", "banned@ POST /api/courses/photo/enroll"], "seed banned", "enroll 403; GET posts 403.", pw="Có")

    # ============================================================ 5. JOIN REQUEST NGUYÊN TỬ (6.1)
    F = "Duyệt yêu cầu tham gia nguyên tử (audit 6.1)"
    PRIV = "Cộng đồng private miễn phí: Owner mới POST /api/communities {title,description,category:'tech',priceUsd:0,visibility:'private'}; admin2 = user mới được đặt vai trò admin."
    A(F, "Approve ∥ reject song song 6 vòng: Enrollment tồn tại khi và chỉ khi trạng thái 'approved'", "Chức năng", "Cao", BASE + " " + PRIV + " " + SQLH,
      ["Mỗi vòng: user mới POST /api/courses/<id>/join-requests {} -> rid", "Owner POST /api/join-requests/<rid>/approve và admin2 POST /api/join-requests/<rid>/reject CÙNG LÚC", "SQL so khớp JoinRequest.status với Enrollment"], "6 vòng",
      "Mỗi vòng đúng 1 bên 200, bên còn lại 409; Enrollment có <=> status='approved'. Không còn 'bị từ chối nhưng đã là thành viên'.", pw="Không")
    A(F, "Approve ∥ approve: chỉ 1 Enrollment, 1 thông báo cho người xin", "Chức năng", "Trung bình", BASE + " " + PRIV,
      ["Gửi join request", "2 admin approve cùng lúc", "SQL đếm Enrollment và Notification"], "approve x2", "Một 200, một 409; Enrollment = 1; thông báo duyệt = 1.", pw="Không")
    A(F, "Duyệt đã xử lý -> 409; người xin hủy yêu cầu đang chờ; hủy yêu cầu đã duyệt -> 409", "Chức năng", "Trung bình", BASE + " " + PRIV,
      ["Approve 1 yêu cầu, approve lần 2", "User khác gửi yêu cầu rồi DELETE /api/join-requests/<rid>", "DELETE yêu cầu đã approved"], "trạng thái", "Approve lại 409; hủy chờ 200 {cancelled:true}; hủy đã duyệt 409.", pw="Có")
    A(F, "Chỉ một yêu cầu pending cho mỗi (cộng đồng, user): gửi lại 409; gửi song song vẫn 1 dòng", "Chức năng", "Trung bình", BASE + " " + PRIV + " " + SQLH,
      ["User mới gửi 2 join request song song", "SQL: đếm JoinRequest pending của user"], "2 request", "Một 201, một 409; đếm pending = 1 (khóa cố vấn). Cộng đồng công khai: 409 'công khai'.", pw="Không")
    A(F, "Thông báo quyết định tới người xin (approved/rejected) và thông báo xin vào chỉ tới owner/admin THẬT", "Chức năng", "Trung bình", BASE + " " + PRIV,
      ["User gửi yêu cầu; kiểm tra thông báo của owner, admin, mod và admin minh họa", "Owner approve; kiểm tra thông báo của người xin"], "thông báo xin vào", "Chỉ owner và admin thật nhận 'có yêu cầu tham gia' (mod, thành viên, admin demo thì không); người xin nhận thông báo khi approve/reject.", pw="Một phần")
    A(F, "FE: quản lý yêu cầu tham gia (Cài đặt cộng đồng > Yêu cầu) duyệt/từ chối cập nhật danh sách", "Giao diện", "Trung bình", BASE + " Đăng nhập owner@ (private-demo có 2 yêu cầu pending: newbie, member1).",
      ["Mở /communities/private-demo/community/cai-dat > tab yêu cầu tham gia", "Duyệt 1, từ chối 1", "Tải lại"], "private-demo seed", "Hai yêu cầu chuyển sang approved/rejected đúng; người được duyệt thấy mình là thành viên (private-demo miễn phí); không còn nút duyệt cho yêu cầu đã xử lý.", pw="Có")

    # ============================================================ 6. KIỂM DUYỆT CHỐT TICKET TRƯỚC (6.1)
    F = "Kiểm duyệt: chốt ticket trước, rồi mới thi hành (audit 6.1)"
    A(F, "dismiss ∥ hide_content song song: bài chỉ bị ẩn khi và chỉ khi hồ sơ ghi hide_content", "Chức năng", "Cao", BASE + " Hai mod M1, M2 ở photo (SQL/UI), tác giả A, người báo cáo R.",
      ["Lặp 6 vòng: A đăng bài; R POST /api/posts/<pid>/report {\"reason\":\"spam\"} -> rid", "M1 PATCH /api/reports/<rid> {\"action\":\"dismiss\"} và M2 PATCH {\"action\":\"hide_content\"} CÙNG LÚC", "So sánh Post.hidden với Report.action"], "6 vòng",
      "Mỗi vòng trạng thái là [200, 409]; Post.hidden = (Report.action = 'hide_content'). Không còn cảnh 'dismiss' mà bài vẫn bị ẩn.", pw="Không")
    A(F, "hide_content báo cho tác giả 'Nội dung của bạn đã bị ẩn' (đúng 1 thông báo)", "Chức năng", "Cao", BASE + " Mod M, tác giả A, người báo cáo R trong photo.",
      ["R báo cáo bài của A", "M PATCH /api/reports/<rid> {\"action\":\"hide_content\"} -> 200", "GET /api/notifications của A"], "hide_content",
      "A có đúng 1 thông báo tiêu đề 'Nội dung của bạn đã bị ẩn'; bài hiện hidden cho thành viên thường (404/ẩn khỏi feed), tác giả và mod vẫn thấy kèm hidden:true.", pw="Có")
    A(F, "ban_member qua báo cáo thành viên: CommunityBan + gỡ Enrollment + thông báo cho người bị cấm + dừng gia hạn gói", "Chức năng", "Cao", BASE + " Mod M, người bị báo cáo B, người báo cáo R trong photo. " + SQLH,
      ["R POST /api/courses/photo/members/<B.id>/report {\"reason\":\"harassment\"} -> rid", "M PATCH /api/reports/<rid> {\"action\":\"ban_member\"} -> 200", "SQL: CommunityBan/Enrollment; thông báo của B"], "ban_member",
      "200; CommunityBan=1; Enrollment=0; B có đúng 1 thông báo removed_from_community; nếu B có gói trả phí thì cancelAtPeriodEnd=true.", pw="Một phần")
    A(F, "hide_content trên báo cáo THÀNH VIÊN -> 400 và ticket vẫn mở (kiểm hợp lệ trước tác dụng phụ)", "Chức năng", "Trung bình", BASE + " Mod M, báo cáo thành viên rid.",
      ["M PATCH /api/reports/<rid> {\"action\":\"hide_content\"}", "SQL: SELECT status FROM \"Report\" WHERE id='<rid>'"], "hành động sai", "400; Report.status vẫn 'open' (không bị chốt vì hành động không hợp lệ).", pw="Có")
    A(F, "Xử lý cùng một báo cáo hai lần -> 409; người không phải mod -> 403", "Bảo mật", "Trung bình", BASE + " Mod M, thành viên thường T, báo cáo rid.",
      ["T PATCH /api/reports/<rid>", "M xử lý lần 1 rồi lần 2"], "resolve", "T: 403. M lần 1: 200; lần 2: 409.", pw="Có")
    A(F, "Lỗi khi thi hành hành động sau khi chốt ticket -> ticket được mở lại", "Chức năng", "Thấp", "Đọc backend/src/modules/moderation/moderation.service.ts resolve().",
      ["Xem nhánh catch sau khi repo.resolve thành công", "Mô phỏng hành động lỗi (vd. sửa tạm để ném lỗi)"], "thi hành lỗi", "Ticket trở lại 'open' (không để báo cáo 'resolved' mà nội dung chưa bị xử lý). (docs/content.md: 'thi hành lỗi → mở lại ticket').", pw="Không")
    A(F, "FE: panel Kiểm duyệt trong cộng đồng xử lý báo cáo và tác giả thấy thông báo", "Giao diện", "Trung bình", BASE + " Đăng nhập mod@ (mod photo) ở cửa sổ 1 và tác giả ở cửa sổ 2. Có báo cáo seed seed-report-photo-open.",
      ["mod@ mở /communities/photo/community/kiem-duyet", "Xử lý báo cáo seed 'ẩn nội dung'", "Tác giả mở chuông thông báo"], "kiem-duyet",
      "Báo cáo chuyển sang đã xử lý; tác giả nhận thông báo ẩn nội dung; bài biến khỏi feed người thường.", pw="Có")
    A(F, "HIỆN TẠI: chưa có luồng khiếu nại/kháng nghị cho nội dung bị ẩn hoặc bị cấm", "Chức năng", "Thấp", BASE,
      ["Tìm trong BE/FE từ khóa appeal/khiếu nại"], "audit 6.3", "HIỆN TẠI: không có (grep appeal|khiếu nại|kháng nghị -> 0). Tác giả chỉ được báo, không có nút phản hồi. Kế hoạch.", pw="Không", st=PLAN)

    # ============================================================ 7. RATE LIMIT + MAX_PAGE
    F = "Rate limit toàn cục / nhóm ghi (audit 5.1)"
    for bucket, n, route, body in (
        ("posts", 10, "POST /api/courses/photo/posts", "{\"content\":\"rl <i>\",\"category\":\"Thảo luận chung\",\"tags\":[]}"),
        ("comments", 30, "POST /api/posts/<pid>/comments", "{\"content\":\"bl <i>\"}"),
        ("likes", 60, "POST /api/posts/<pid>/like", "(không body)"),
        ("rsvp", 30, "POST /api/events/<eid>/rsvp", "(không body)"),
        ("votes", 60, "POST /api/posts/<pid>/poll/vote", "{\"optionIds\":[\"<optionId>\"]}"),
    ):
        A(F, f"Nhóm '{bucket}': vượt {n} lần/phút/user -> 429 kèm Retry-After; GET không bị ảnh hưởng", "Bảo mật", "Cao", BASE + " " + USER + " Rate limit bật (mặc định ở dev). Dùng vòng lặp curl/PowerShell.",
          [f"Với 1 user: gọi {route} {body} liên tiếp {n + 1} lần trong < 60 giây", "Ghi mã trạng thái từng lần và header Retry-After của lần bị chặn", "Ngay sau đó GET /api/courses/photo/posts", "Đợi hết Retry-After rồi gọi lại"], f"{n} lần/phút/{bucket}",
          f"Lần 1..{n}: thành công (2xx; riêng toggle like/rsvp có thể 200); lần {n + 1}: 429 TOO_MANY_REQUESTS 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' + header Retry-After (giây, >= 1). GET danh sách vẫn 200 (nhóm khác không ảnh hưởng). Sau Retry-After gọi lại được.", pw="Một phần")
    A(F, "Hạn mức tính theo USER cho endpoint ghi: hai user cùng IP không chia sẻ hạn mức", "Bảo mật", "Trung bình", BASE + " " + USER + " Hai user U1, U2 cùng máy.",
      ["U1 đăng 10 bài rồi bài thứ 11 -> 429", "U2 đăng bài ngay sau đó"], "cùng IP khác user", "U1 429; U2 201 (khóa w:posts:<userId>).", pw="Một phần")
    A(F, "Giới hạn TOÀN CỤC theo IP (mặc định 1200/phút): 429 + Retry-After", "Bảo mật", "Cao", BASE + " Đặt RATE_LIMIT_GLOBAL_PER_MIN=5 trong backend/.env rồi restart (để thử nhanh).",
      ["GET /api/courses liên tiếp 7 lần", "Đọc mã và Retry-After", "Đợi qua 1 phút rồi gọi lại"], "RATE_LIMIT_GLOBAL_PER_MIN=5", "Lần 1..5: 200; lần 6+: 429 TOO_MANY_REQUESTS + Retry-After; sau cửa sổ 60 giây mở lại. Khôi phục biến sau test.", pw="Một phần")
    A(F, "Global limiter bỏ qua /api/files/* và /api/payments/webhook", "Chức năng", "Thấp", BASE + " RATE_LIMIT_GLOBAL_PER_MIN=5 như case trên.",
      ["Gọi GET /api/files/<key ảnh công khai> 10 lần", "POST webhook hợp lệ 10 lần (event id khác nhau)"], "đường dẫn miễn trừ", "Không có 429 ở các đường này (nguồn tin cậy / tải ảnh trang).", pw="Một phần")
    A(F, "RATE_LIMIT_DISABLED=1 tắt hoàn toàn; NODE_ENV=test tắt mặc định", "Chức năng", "Thấp", BASE + " Đặt RATE_LIMIT_DISABLED=1, restart.",
      ["Đăng 15 bài liên tiếp", "Chạy npm test (NODE_ENV=test) - không bị 429"], "RATE_LIMIT_DISABLED", "Không có 429; test tích hợp không bị giới hạn (rateLimitSettings.enabled=false).", pw="Không")
    A(F, "FE: đăng bài quá nhanh hiện thông điệp lỗi 429 (không treo nút Đăng)", "Giao diện", "Trung bình", BASE + " " + USER + " Đăng nhập trên FE; cần đăng >10 bài/phút (dán nhanh).",
      ["Mở /communities/photo/community", "Đăng liên tiếp 11 bài ngắn trong 1 phút", "Quan sát lỗi ở composer"], "11 bài", "Bài thứ 11 báo 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút' (hoặc lỗi tương đương); nút Đăng dùng lại được sau khi hết hạn; bài đã đăng không bị trùng.", pw="Có")
    A(F, "Rate limit auth cũ (express-rate-limit) vẫn theo từng instance: đăng nhập sai nhiều lần", "Bảo mật", "Thấp", BASE,
      ["POST /api/auth/forgot-password 6 lần cùng IP trong 15 phút"], "5/15 phút", "Lần 6 429. HIỆN TẠI: bộ đếm nằm trong bộ nhớ từng instance (chưa dùng state chia sẻ) - PLAN STEP 7 ghi 'còn lại'.", pw="Có")
    F = "Trần số trang MAX_PAGE=1000"
    for path, ok in (("/api/courses/photo/posts?page=%d", "bài viết"), ("/api/courses?page=%d", "danh sách cộng đồng"), ("/api/search?q=anh&page=%d", "tìm kiếm")):
        A(F, f"?page vượt 1000 -> 400, trong trần -> 200 ({ok})", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
          [f"GET {path % 1000} -> ?", f"GET {path % 1001} -> ?", f"GET {path % 1000000} -> ?"], "page=1000 / 1001 / 1000000",
          "page=1000: 200 (có thể rỗng); page=1001 và 1000000: 400 VALIDATION_ERROR (không quét DB offset khổng lồ).", pw="Có")
    A(F, "page=0 / âm / không phải số -> 400; limit vượt trần -> 400", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses?page=0", "GET /api/courses?page=-1", "GET /api/courses?page=abc", "GET /api/courses?limit=1000"], "tham số lạ", "Tất cả 400 VALIDATION_ERROR (hoặc limit được kẹp theo schema).", pw="Có")

    # ============================================================ 8. KHÁC (6.3, 6.6)
    F = "Điểm/chính sách khác"
    A(F, "HIỆN TẠI: owner tự đánh giá 5 sao cộng đồng của mình vẫn được chấp nhận", "Chức năng", "Thấp", BASE + " " + tok("owner@sofinhub.test"),
      ["owner@ POST /api/courses/photo/reviews {\"rating\":5,\"text\":\"tuyệt\"}"], "audit 6.6", "HIỆN TẠI: 201/200 (không chặn tự đánh giá; test hiện còn chấp nhận). KỲ VỌNG: owner không được tự chấm. Chưa sửa.", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: tự like bài của mình được chấp nhận (nhưng không có điểm)", "Chức năng", "Thấp", BASE + " " + USER,
      ["A đăng bài, A POST like chính bài đó", "GET điểm"], "tự like", "like thành công (likesCount +1) nhưng không +2 điểm và không thông báo. (Audit gợi ý bỏ hẳn tự like; hiện chỉ chặn điểm.)", pw="Có")
    A(F, "Bình luận không cộng điểm: xóa bình luận không cần bù", "Chức năng", "Thấp", BASE + " " + USER,
      ["A bình luận 3 bài, xóa bình luận", "GET điểm"], "comment", "Điểm không đổi (không có điểm cho bình luận); commentsCount giảm đúng.", pw="Có")
    A(F, "Bảng xếp hạng (leaderboard) phản ánh đúng sau khi bù điểm", "Chức năng", "Trung bình", BASE + " " + USER,
      ["GET /api/courses/photo/leaderboard?window=all (ghi vị trí)", "U đăng 3 bài (+15) rồi xóa cả 3", "GET leaderboard lại"], "leaderboard", "Sau khi xóa: điểm của U trở lại như trước, vị trí/số điểm trên bảng không còn phần farm.", pw="Có")
    A(F, "FE: trang Hồ sơ/Thành viên cập nhật điểm sau khi xóa bài", "Giao diện", "Trung bình", BASE + " " + USER + " Đăng nhập U trên FE.",
      ["Đăng 1 bài, mở hồ sơ (ô tổng điểm)", "Xóa bài, tải lại hồ sơ"], "profile points", "Tổng điểm +5 sau đăng, về như cũ sau xóa (không cần chờ).", pw="Có")
    A(F, "Điểm 7 ngày/30 ngày của leaderboard tính bằng tổng điểm gồm cả dòng âm bù", "Chức năng", "Thấp", BASE + " " + USER + " " + SQLH,
      ["U đăng bài rồi xóa trong ngày", "GET leaderboard?window=7d và 30d"], "window", "Điểm U cho các cửa sổ = 0 (dòng +5 và -5 cùng nằm trong cửa sổ).", pw="Có")

    # ============================================================ 9. BỔ SUNG
    F = "Bổ sung: điểm, chính sách và giới hạn"
    A(F, "Trần ?page=1000 cũng áp cho danh sách thành viên/xếp hạng/thông báo (offset)", "Bảo mật", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/members?page=1001", "GET /api/notifications?page=1001", "GET /api/me/payments?page=1001"], "page cap khác", "400 VALIDATION_ERROR cho page > 1000 (MAX_PAGE chung cho phân trang offset); page=1000 trả 200.", pw="Có")
    A(F, "Like bài đã xóa -> 404, không điểm; bài đã xóa không còn trong feed/tìm kiếm", "Chức năng", "Thấp", BASE + " " + USER,
      ["A đăng bài, B like, A xóa", "B POST /api/posts/<id>/like", "GET feed và /search"], "like sau xóa", "like 404; feed/tìm kiếm không còn bài; điểm của A = 0.", pw="Có")
    A(F, "Ẩn bài (hide) không bù điểm; xóa bài thì bù (ẩn chỉ đổi hiển thị)", "Chức năng", "Thấp", BASE + " " + USER + " " + tok("owner@sofinhub.test"),
      ["A đăng bài (+5), mod ẩn bài", "GET điểm A", "Mod bỏ ẩn; sau đó A xóa bài; GET điểm"], "hide vs delete", "Sau ẩn: A vẫn 5 (không bù); sau xóa: A = 0.", pw="Có")
    A(F, "Điểm like chỉ cho người ĐƯỢC like: người like không nhận điểm", "Chức năng", "Thấp", BASE + " " + USER,
      ["A đăng, B like", "GET điểm của B"], "người like", "B không có điểm từ hành động like (Skool-like: chỉ like nhận được); A +2.", pw="Có")
    A(F, "Locked: owner vẫn ĐỌC được trang chi tiết công khai (locked=true) nhưng không vào bài/lớp (member bị COMMUNITY_LOCKED)", "Chức năng", "Thấp", BASE + " " + LOCKSET,
      ["Owner GET /api/courses/<id>", "Owner GET /api/courses/<id>/posts"], "owner bị khóa", "detail 200 (locked:true); posts 403 COMMUNITY_LOCKED (chỉ Platform Admin vượt).", pw="Có")
    A(F, "Bộ test tự động: chạy tests/points-policy.test.ts", "Chức năng", "Cao", "Cài backend; Postgres local.",
      ["cd backend", "npx cross-env NODE_ENV=test node --import tsx --test tests/points-policy.test.ts"], "points-policy", "Toàn bộ pass: farm đăng+xóa, cộng tác, khóa nghiệp vụ, RSVP, locked, ban, join request, moderation, rate limit, page cap.", pw="Không")

    # @@END@@
