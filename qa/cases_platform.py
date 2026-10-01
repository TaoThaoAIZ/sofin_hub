# -*- coding: utf-8 -*-
"""Testcase bổ sung: ADMIN, ROLE, INTEG, SEC (nhóm nền tảng). Nạp bằng load(add) từ gen_testcases.py."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
RESET = "Đã chạy `npm run db:reset` (Postgres :5435 + seed), BE :4000, FE :5173. "
LOGIN_LIM = " (loginLimiter chỉ đếm đăng nhập SAI: 10 lần sai / 15 phút / IP; đăng nhập đúng nhiều lần không bị 429 — chỉ tránh đăng nhập sai liên tiếp)"

E401 = "401 UNAUTHORIZED (\"Vui lòng đăng nhập để tiếp tục\")"
E403M = "403 FORBIDDEN (\"Bạn cần tham gia cộng đồng này trước\")"
E403R = "403 FORBIDDEN (\"Bạn không có quyền thực hiện thao tác này trong cộng đồng\")"
E403P = "403 FORBIDDEN (\"Chỉ Platform Admin mới có quyền này\")"
E403S = "403 FORBIDDEN (\"Chỉ nhân viên admin mới có quyền này\")"  # adminOnly (admin.common.ts + assertAllowed): refunds/payouts/dashboard... không phải nhân viên

ROLES8 = [
    ("Khách", "không gửi Authorization"),
    ("newbie", "newbie@sofinhub.test"),
    ("member1", "member1@sofinhub.test"),
    ("mod", "mod@sofinhub.test"),
    ("cadmin", "cadmin@sofinhub.test"),
    ("owner", "owner@sofinhub.test"),
    ("admin nền tảng", "admin@sofinhub.test"),
    ("banned", "banned@sofinhub.test"),
]
RANK = {"member1": 0, "mod": 1, "cadmin": 2, "owner": 3}


def matrix(kind, min_role, ok, deny_member=None, overrides=None):
    """Sinh chuỗi kết quả mong đợi cho 8 vai trò theo đúng policy.ts.
    kind='mem': route đi qua requireMembership (newbie/banned -> 403 'cần tham gia'; admin nền tảng được cho qua dù chưa ghi danh).
    kind='rr' : route chỉ dùng requireRole (admin nền tảng luôn qua; newbie/banned -> 403 'không có quyền').
    kind='pa' : chỉ Platform Admin.
    """
    overrides = overrides or {}
    parts = []
    for name, _ in ROLES8:
        if name in overrides:
            parts.append(f"{name}: {overrides[name]}")
            continue
        if name == "Khách":
            parts.append(f"Khách: {E401}")
        elif kind == "pa":
            parts.append(f"{name}: {ok}" if name == "admin nền tảng" else f"{name}: {E403P}")
        elif name in ("newbie", "banned"):
            parts.append(f"{name}: {E403M if kind == 'mem' else E403R}")
        elif name == "admin nền tảng":
            if kind == "mem":
                parts.append(f"admin nền tảng: {ok} (đã sửa: requireMembership cho qua Platform Admin dù chưa ghi danh, khớp policy 'ghi đè mọi cộng đồng'; trước đây 403)")
            else:
                parts.append(f"admin nền tảng: {ok}")
        else:
            if RANK[name] >= RANK[min_role]:
                parts.append(f"{name}: {ok}")
            else:
                parts.append(f"{name}: {deny_member or E403R}")
    return "; ".join(parts)


def load(add):
    _admin(add)
    _role(add)
    _integ(add)
    _sec(add)


# =============================================================================================
# ADMIN — Kiểm duyệt & Khu quản trị nền tảng
# =============================================================================================
def _admin(add):
    M, MN = "ADMIN", "Quản trị & Vận hành hệ thống"

    def a(feat, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feat, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    SEEDPOST = "seed-post-photo-m1-image"
    # ------------------------------------------------------------------ Báo cáo vi phạm
    a("Báo cáo vi phạm", "Member báo cáo bài viết: 201, báo cáo ở trạng thái open kèm ảnh chụp nội dung",
      "Chức năng", "Cao",
      RESET + "Đăng nhập member2@sofinhub.test / " + PW + " (thành viên photo). Bài `" + SEEDPOST + "` (tác giả member1) — member2 chưa báo cáo bài này (seed chỉ có member3 báo cáo).",
      ["POST /api/posts/" + SEEDPOST + "/report với Bearer của member2", "Đọc response", "Đăng nhập mod, GET /api/courses/photo/reports?status=open"],
      'Body {"reason":"spam","detail":"Quảng cáo trá hình"}',
      "201; data.status=\"open\", targetType=\"post\", targetId=\"" + SEEDPOST + "\", reason=\"spam\", reporterName=\"Mai Member2\", targetUserName=\"Minh Member1\"; "
      "targetExcerpt bắt đầu bằng \"Mình vừa chụp bộ ảnh hoàng hôn ở Đà Nẵng\" (ảnh chụp nội dung lúc báo cáo). Báo cáo xuất hiện trong hàng đợi của mod cùng báo cáo seed-report-photo-open (tổng open >= 2).")
    a("Báo cáo vi phạm", "Member báo cáo bình luận của người khác: 201, targetType=comment",
      "Chức năng", "Cao",
      RESET + "member3@sofinhub.test đăng nhập. Bình luận `seed-comment-photo-m2-on-m1-image` do member2 viết trên bài của member1.",
      ["POST /api/comments/seed-comment-photo-m2-on-m1-image/report", "Kiểm tra response"],
      'Body {"reason":"harassment"}',
      "201; data.targetType=\"comment\", targetId=\"seed-comment-photo-m2-on-m1-image\", targetUserName=\"Mai Member2\", reason=\"harassment\", status=\"open\", targetExcerpt = \"Bố cục đẹp quá, màu trời rất có hồn!\".")
    a("Báo cáo vi phạm", "Member báo cáo thành viên khác cùng cộng đồng photo: 201, targetType=member",
      "Chức năng", "Cao",
      RESET + "member2 đăng nhập; lấy id member3 từ GET /api/courses/photo/members.",
      ["POST /api/courses/photo/members/<id member3>/report", "Kiểm tra response và không có targetExcerpt"],
      'Body {"reason":"inappropriate","detail":"Nhắn tin làm phiền"}',
      "201; data.targetType=\"member\", targetId = id member3, targetUserName=\"Manh Member3\", status=\"open\"; targetExcerpt không có (báo cáo thành viên không có nội dung để chụp).")
    a("Báo cáo vi phạm", "Báo cáo trùng cùng người báo cáo + cùng đối tượng bị chặn 409",
      "Chức năng", "Cao",
      RESET + "member3 đã báo cáo `" + SEEDPOST + "` (seed-report-photo-open).",
      ["Đăng nhập member3", "POST /api/posts/" + SEEDPOST + "/report lần nữa với reason khác"],
      'Body {"reason":"other"}',
      "409 CONFLICT, message \"Bạn đã báo cáo mục này rồi\"; hàng đợi vẫn chỉ có 1 báo cáo của member3 cho bài này. Một người khác (member2) vẫn báo cáo được cùng bài (không bị coi là trùng).")
    a("Báo cáo vi phạm", "Không báo cáo được bài viết của chính mình",
      "Chức năng", "Trung bình",
      RESET + "member1 đăng nhập (tác giả bài `" + SEEDPOST + "`).",
      ["POST /api/posts/" + SEEDPOST + "/report"], 'Body {"reason":"spam"}',
      "400 BAD_REQUEST, message \"Bạn không thể báo cáo chính mình hoặc nội dung của mình\"; không tạo báo cáo.")
    a("Báo cáo vi phạm", "Không báo cáo được bình luận của chính mình",
      "Chức năng", "Trung bình",
      RESET + "member2 đăng nhập (tác giả bình luận `seed-comment-photo-m2-on-m1-image`).",
      ["POST /api/comments/seed-comment-photo-m2-on-m1-image/report"], 'Body {"reason":"spam"}',
      "400 BAD_REQUEST, message \"Bạn không thể báo cáo chính mình hoặc nội dung của mình\".")
    a("Báo cáo vi phạm", "Không tự báo cáo chính mình ở vai trò thành viên",
      "Chức năng", "Thấp",
      RESET + "member2 đăng nhập; id của chính mình lấy từ GET /api/auth/me.",
      ["POST /api/courses/photo/members/<id member2>/report"], 'Body {"reason":"spam"}',
      "400 BAD_REQUEST, message \"Bạn không thể báo cáo chính mình hoặc nội dung của mình\". Trên UI (tab Thành viên) menu \"…\" của chính mình không có mục \"Báo cáo thành viên\".")
    a("Báo cáo vi phạm", "Validate lý do báo cáo: giá trị ngoài danh sách hoặc thiếu reason bị 400",
      "Chức năng", "Trung bình",
      RESET + "member2 đăng nhập.",
      ["POST /api/posts/" + SEEDPOST + "/report với reason=\"abc\"", "Gửi body rỗng {}", "Gửi reason=\"SPAM\" (sai hoa/thường)"],
      'reason ∈ {"abc", thiếu, "SPAM"}',
      "Cả 3 lần: 400 VALIDATION_ERROR, message \"Tham số không hợp lệ\", details.fieldErrors.reason chứa \"Lý do báo cáo không hợp lệ\"; không tạo báo cáo.")
    a("Báo cáo vi phạm", "Biên độ dài chi tiết báo cáo: 1000 ký tự hợp lệ, 1001 ký tự bị từ chối",
      "Chức năng", "Thấp",
      RESET + "member2 đăng nhập; dùng bài `seed-post-photo-owner-pinned` (chưa ai báo cáo).",
      ["POST /api/posts/seed-post-photo-owner-pinned/report với detail dài 1001 ký tự", "Lặp lại với detail dài đúng 1000 ký tự"],
      "detail = 'a' × 1001 rồi 'a' × 1000; reason=\"misinformation\"",
      "Lần 1: 400 VALIDATION_ERROR (detail vượt max 1000). Lần 2: 201. Detail chỉ khoảng trắng sau trim được coi là rỗng/hợp lệ (không lỗi).")
    a("Báo cáo vi phạm", "Đủ 5 lý do báo cáo hợp lệ: spam, harassment, inappropriate, misinformation, other",
      "Chức năng", "Trung bình",
      RESET + "Đăng ký 5 user mới rồi cho tham gia photo (POST /api/courses/photo/enroll) để mỗi user báo cáo 1 lần (mỗi người chỉ báo cáo được 1 lần / đối tượng).",
      ["Với mỗi user i, POST /api/posts/seed-post-photo-owner-pinned/report với reason thứ i", "Tab UI Báo cáo bài viết: kiểm nhãn lý do trong hộp thoại"],
      "reason lần lượt: spam, harassment, inappropriate, misinformation, other",
      "5 lần đều 201; hộp thoại báo cáo trên UI hiện 5 nhãn tiếng Việt (spam, quấy rối, không phù hợp, sai lệch, khác); hàng đợi hiển thị đúng nhãn từng lý do.")
    a("Báo cáo vi phạm", "Phân quyền tạo báo cáo: khách 401, người ngoài cộng đồng 403, người bị ban 403",
      "Bảo mật", "Cao",
      RESET + "Tài khoản newbie (chưa ở photo), banned (bị ban photo).",
      ["POST /api/posts/" + SEEDPOST + "/report không token", "Lặp lại với token newbie", "Lặp lại với token banned"], 'Body {"reason":"spam"}',
      "Khách: " + E401 + ". newbie: " + E403M + ". banned: " + E403M + " (bị ban thì không còn được coi là thành viên). Không có báo cáo mới nào được tạo.")
    a("Báo cáo vi phạm", "Báo cáo bài viết không tồn tại hoặc bài đã bị ẩn (người không có quyền thấy) trả 404",
      "Chức năng", "Trung bình",
      RESET + "member3 đăng nhập. Bài `seed-post-photo-m1-hidden` đang hidden (tác giả member1).",
      ["POST /api/posts/khong-ton-tai/report", "POST /api/posts/seed-post-photo-m1-hidden/report"], 'Body {"reason":"spam"}',
      "Cả hai: 404 NOT_FOUND, message \"Không tìm thấy bài viết\" (bài ẩn coi như không tồn tại với member thường). Thử lại bằng token mod: báo cáo bài ẩn được chấp nhận 201.")
    a("Báo cáo vi phạm", "Báo cáo thành viên không thuộc cộng đồng trả 404",
      "Chức năng", "Trung bình",
      RESET + "member2 đăng nhập; id newbie lấy từ đăng nhập newbie → GET /api/auth/me (newbie không ở photo).",
      ["POST /api/courses/photo/members/<id newbie>/report", "POST /api/courses/photo/members/id-linh-tinh/report"], 'Body {"reason":"spam"}',
      "Cả hai: 404 NOT_FOUND, message \"Không tìm thấy thành viên\".")
    a("Báo cáo vi phạm", "Ảnh chụp nội dung (targetExcerpt) được rút gọn tối đa 120 ký tự và kết thúc bằng dấu …",
      "Chức năng", "Thấp",
      RESET + "member1 tạo bài 300 ký tự ('x' lặp) ở photo; member2 báo cáo bài đó.",
      ["member1: POST /api/courses/photo/posts với content dài 300 ký tự", "member2: POST /api/posts/<id>/report", "Đọc targetExcerpt"],
      "content = 'Lorem ' × 50", "targetExcerpt dài đúng 120 ký tự, ký tự cuối là \"…\" (cắt 119 ký tự rồi trimEnd + …).")
    a("Báo cáo vi phạm", "Ảnh chụp nội dung không đổi khi tác giả sửa bài sau khi bị báo cáo",
      "Chức năng", "Trung bình",
      RESET + "member1 tạo bài mới 'Nội dung gốc'; member2 báo cáo; sau đó member1 sửa bài.",
      ["member1: PATCH /api/posts/<id> {content:'Đã sửa hoàn toàn'}", "mod: GET /api/courses/photo/reports?status=open, tìm báo cáo của bài"], "content gốc 'Nội dung gốc', content sửa 'Đã sửa hoàn toàn'",
      "targetExcerpt của báo cáo vẫn là \"Nội dung gốc\" (ảnh chụp lúc báo cáo), mod thấy được bằng chứng ban đầu dù bài đã bị sửa.")
    a("Báo cáo vi phạm", "Hai request báo cáo song song cùng người/cùng đối tượng: chỉ 1 cái được tạo",
      "Tích hợp", "Cao",
      RESET + "member2 đăng nhập, bài `seed-post-photo-owner-pinned` chưa được member2 báo cáo.",
      ["Gửi đồng thời 2 request POST /api/posts/seed-post-photo-owner-pinned/report (Promise.all)", "GET hàng đợi mod đếm số báo cáo của member2 với bài này"], 'Body {"reason":"spam"}',
      "Một request 201, một request 409 CONFLICT \"Bạn đã báo cáo mục này rồi\" (unique index ở DB, kể cả song song); hàng đợi có đúng 1 báo cáo; không có lỗi 500.")

    # ------------------------------------------------------------------ Hàng đợi báo cáo
    a("Hàng đợi báo cáo", "Mod xem hàng đợi báo cáo photo: có đủ 2 báo cáo seed (1 open, 1 resolved)",
      "Chức năng", "Cao",
      RESET + "mod@sofinhub.test đăng nhập. Seed photo: seed-report-photo-open (member3 → bài ảnh của member1, lý do inappropriate) và seed-report-photo-resolved (member2 → bài quảng cáo ẩn, hide_content).",
      ["GET /api/courses/photo/reports", "Đọc data và meta"], "-",
      "200; meta.total >= 2, meta.page=1, meta.limit=20; data chứa seed-report-photo-open (status open) và seed-report-photo-resolved (status resolved, action hide_content); sắp xếp mới nhất trước.")
    a("Hàng đợi báo cáo", "Lọc theo trạng thái: báo cáo đã xử lý seed có ghi chú và người xử lý là mod",
      "Chức năng", "Trung bình",
      RESET + "mod đăng nhập.",
      ["GET /api/courses/photo/reports?status=resolved", "Tìm seed-report-photo-resolved"], "status=resolved",
      "Chỉ báo cáo status=resolved; báo cáo seed có action=\"hide_content\", note=\"Đã ẩn bài quảng cáo.\", resolvedBy=id mod, resolvedAt có giá trị, targetExcerpt bắt đầu \"Mua ngay khóa học chụp ảnh giá rẻ\".")
    a("Hàng đợi báo cáo", "Tham số truy vấn không hợp lệ bị 400: status lạ, limit > 50, page = 0",
      "Chức năng", "Thấp",
      RESET + "mod đăng nhập.",
      ["GET .../reports?status=abc", "GET .../reports?limit=51", "GET .../reports?page=0", "GET .../reports?limit=50 (biên hợp lệ)"], "status=abc; limit=51; page=0; limit=50",
      "Ba lần đầu: 400 VALIDATION_ERROR \"Tham số không hợp lệ\"; limit=50 → 200 với meta.limit=50.")
    a("Hàng đợi báo cáo", "Chỉ mod trở lên xem được hàng đợi của cộng đồng: member 403, cadmin/owner 200",
      "Bảo mật", "Cao",
      RESET + "Tài khoản member1, mod, cadmin, owner.",
      ["GET /api/courses/photo/reports lần lượt với 4 token", "Gọi thêm không token"], "-",
      "member1: " + E403R + "; mod, cadmin, owner: 200 cùng dữ liệu; khách: " + E401 + ".")
    a("Hàng đợi báo cáo", "Platform Admin xem được hàng đợi photo dù không phải thành viên (requireRole cho qua)",
      "Bảo mật", "Trung bình",
      RESET + "admin@sofinhub.test không ghi danh cộng đồng nào.",
      ["GET /api/courses/photo/reports với token admin", "GET /api/courses/khong-ton-tai/reports"], "-",
      "Lần 1: 200 (getRole trả platform_admin). Lần 2: 404 NOT_FOUND (cộng đồng không tồn tại, kiểm trước khi kiểm quyền).")
    a("Hàng đợi báo cáo", "GET /api/admin/reports gom báo cáo mọi cộng đồng — chỉ Platform Admin",
      "Bảo mật", "Cao",
      RESET + "admin, owner, mod đăng nhập.",
      ["GET /api/admin/reports với token admin", "Lặp lại với owner, mod", "Không token"], "status=open rồi status=resolved",
      "admin: 200, meta.total >= 2 (photo có 1 open + 1 resolved từ seed, cộng đồng khác chưa có); lọc status=open trả seed-report-photo-open. owner và mod: " + E403P + "; khách: " + E401 + ".")
    a("Hàng đợi báo cáo", "Phân trang hàng đợi không chồng lấn: mới nhất trước, total/totalPages đúng",
      "Chức năng", "Thấp",
      RESET + "Tạo thêm >= 3 báo cáo mới bằng các user đã đăng ký thêm; mod đăng nhập.",
      ["GET .../reports?limit=2&page=1", "GET .../reports?limit=2&page=2", "So sánh id các trang"], "limit=2",
      "Không id nào xuất hiện ở cả 2 trang; meta.totalPages = ceil(total/2); trang 1 có báo cáo tạo sau cùng ở đầu.")
    a("Hàng đợi báo cáo", "UI /courses/photo/community/kiem-duyet: mod thấy mục sidebar \"Kiểm duyệt\" và 4 tab trạng thái",
      "Giao diện", "Cao",
      RESET + "Đăng nhập mod@sofinhub.test.",
      ["Mở /courses/photo/community", "Bấm mục \"Kiểm duyệt\" ở sidebar trái", "Lần lượt bấm tab Đang chờ, Đã xử lý, Đã bỏ qua, Tất cả"], "-",
      "Trang có banner \"Kiểm duyệt\"; 4 tab: \"Đang chờ\", \"Đã xử lý\", \"Đã bỏ qua\", \"Tất cả\"; tab \"Đang chờ\" hiện báo cáo seed của member3 với các nút \"Bỏ qua\", \"Ẩn nội dung\", \"Cấm thành viên\" và ô ghi chú \"Ghi chú xử lý (không bắt buộc)\"; trong lúc tải hiện \"Đang tải báo cáo…\".")
    a("Hàng đợi báo cáo", "UI: member thường không thấy mục Kiểm duyệt và vào thẳng URL bị chặn",
      "Bảo mật", "Cao",
      RESET + "Đăng nhập member1@sofinhub.test.",
      ["Mở /courses/photo/community, kiểm sidebar", "Mở thẳng /courses/photo/community/kiem-duyet"], "-",
      "Sidebar không có \"Kiểm duyệt\"; trang trực tiếp hiển thị \"Chỉ dành cho quản trị viên\" (không gọi/không lộ dữ liệu báo cáo; API cũng trả 403 nếu gọi tay).")

    # ------------------------------------------------------------------ Xử lý báo cáo
    NEWRPT = RESET + "Chuẩn bị: member2 tạo báo cáo mới (spam) cho một bài của member1 để không dùng lại báo cáo seed; mod đăng nhập. "
    a("Xử lý báo cáo", "Mod chọn Bỏ qua: báo cáo thành dismissed, nội dung giữ nguyên, người báo cáo nhận thông báo",
      "Chức năng", "Cao", NEWRPT,
      ["PATCH /api/reports/<id> {action:'dismiss', note:'Không vi phạm'}", "member2: GET /api/notifications", "member2/member1: GET /api/posts/<id>"],
      'Body {"action":"dismiss","note":"Không vi phạm"}',
      "200; data.status=\"dismissed\", action=\"dismiss\", note=\"Không vi phạm\", resolvedBy=id mod, resolvedAt có giá trị. Bài viết vẫn hiển thị bình thường. member2 nhận thông báo loại report_resolved, tiêu đề \"Báo cáo của bạn đã được xử lý\", nội dung \"Báo cáo của bạn được xác định là không vi phạm và đã được bỏ qua.\"")
    a("Xử lý báo cáo", "Mod ẩn bài bị báo cáo (hide_content): bài biến mất với member, tác giả và mod vẫn thấy",
      "Chức năng", "Cao", NEWRPT,
      ["PATCH /api/reports/<id> {action:'hide_content'}", "member3: GET /api/posts/<id>; GET /api/courses/photo/posts", "member1 (tác giả) và mod: GET /api/posts/<id>"],
      'Body {"action":"hide_content"}',
      "200; status=\"resolved\", action=\"hide_content\". member3: GET bài → 404 NOT_FOUND \"Không tìm thấy bài viết\" và bài không có trong bảng tin; member1 và mod vẫn xem được (hidden=true). Người báo cáo nhận thông báo \"...vi phạm, nội dung đã bị ẩn.\"")
    a("Xử lý báo cáo", "Mod ẩn bình luận bị báo cáo: member thường không còn thấy trong danh sách bình luận",
      "Chức năng", "Trung bình",
      RESET + "member3 báo cáo bình luận `seed-comment-photo-m2-on-m1-image` (lưu id báo cáo); mod đăng nhập.",
      ["PATCH /api/reports/<id> {action:'hide_content'}", "member1: GET /api/posts/seed-post-photo-m1-image/comments", "mod: GET cùng endpoint"], 'Body {"action":"hide_content"}',
      "200 resolved; member1 không thấy bình luận đó; mod và tác giả bình luận (member2) vẫn thấy.")
    a("Xử lý báo cáo", "Ẩn nội dung với báo cáo thành viên bị từ chối 400",
      "Chức năng", "Trung bình",
      RESET + "member2 báo cáo member3 (targetType=member); mod đăng nhập.",
      ["PATCH /api/reports/<id> {action:'hide_content'}", "GET lại báo cáo qua hàng đợi"], 'Body {"action":"hide_content"}',
      "400 BAD_REQUEST, message \"Chỉ ẩn được bài viết hoặc bình luận\"; báo cáo vẫn status=\"open\" (không bị chốt).")
    a("Xử lý báo cáo", "Ban qua báo cáo (ban_member): người bị báo cáo bị cấm và bị xóa khỏi cộng đồng, ghi lý do + người cấm",
      "Chức năng", "Cao",
      RESET + "Đăng ký user X mới (vd. victim1@sofinhub.test), POST /api/courses/photo/enroll; member2 báo cáo bài của X (reason spam); mod đăng nhập.",
      ["PATCH /api/reports/<id> {action:'ban_member', note:'Spam lặp lại'}", "X: GET /api/courses/photo/posts", "owner: GET /api/courses/photo/bans"],
      'Body {"action":"ban_member","note":"Spam lặp lại"}',
      "200 resolved/ban_member. X: " + E403M + " và không còn trong danh sách thành viên. GET /bans hiện X với reason=\"Bị báo cáo (spam)\", bannedBy = tên mod. member2 nhận thông báo \"...vi phạm, thành viên đã bị cấm.\"")
    a("Xử lý báo cáo", "Mod không cấm được mod khác hay admin: 403 và báo cáo giữ nguyên trạng thái open",
      "Bảo mật", "Cao",
      RESET + "Cần 2 báo cáo: (1) về bài/thành viên là mod@ — dùng báo cáo thành viên của member2 với id mod; (2) về cadmin. Mod đăng nhập. (Mod không phải chủ của bài nên báo cáo thành viên là cách tạo.)",
      ["PATCH /api/reports/<báo cáo về mod> {action:'ban_member'}", "PATCH /api/reports/<báo cáo về cadmin> {action:'ban_member'}", "GET hàng đợi status=open"],
      'Body {"action":"ban_member"}',
      "Cả hai: 403 FORBIDDEN, message \"Bạn không thể cấm người có vai trò ngang hoặc cao hơn mình\"; cả hai báo cáo vẫn open; không có CommunityBan mới.")
    a("Xử lý báo cáo", "Admin cộng đồng (cadmin) cấm được mod nhưng không cấm được owner",
      "Bảo mật", "Cao",
      RESET + "member2 báo cáo thành viên mod (báo cáo A) và thành viên owner (báo cáo B). cadmin@sofinhub.test đăng nhập. Sau test cần db:reset để khôi phục.",
      ["PATCH /api/reports/<A> {action:'ban_member'}", "PATCH /api/reports/<B> {action:'ban_member'}"],
      'Body {"action":"ban_member"}',
      "A: 200 resolved (admin có bậc cao hơn mod; mod bị cấm khỏi photo). B: 403 FORBIDDEN \"Không thể cấm chủ cộng đồng\"; báo cáo B vẫn open.")
    a("Xử lý báo cáo", "Không cấm thành viên minh họa (isDemo) qua báo cáo",
      "Chức năng", "Thấp",
      RESET + "Lấy id thành viên minh họa `demo-photo-1` từ GET /api/courses/photo/members; member2 báo cáo thành viên đó (201); mod đăng nhập.",
      ["PATCH /api/reports/<id> {action:'ban_member'}"], 'Body {"action":"ban_member"}',
      "400 BAD_REQUEST, message \"Không thể cấm nội dung minh họa\"; báo cáo vẫn open. Với action=dismiss báo cáo này xử lý bình thường 200.")
    a("Xử lý báo cáo", "Xử lý lại báo cáo đã xử lý bị chặn 409",
      "Chức năng", "Cao",
      RESET + "Báo cáo seed-report-photo-resolved (đã resolved). mod đăng nhập.",
      ["PATCH /api/reports/seed-report-photo-resolved {action:'dismiss'}"], 'Body {"action":"dismiss"}',
      "409 CONFLICT, message \"Báo cáo này đã được xử lý\"; trạng thái resolved/hide_content ban đầu không đổi.")
    a("Xử lý báo cáo", "Validate xử lý: action lạ, note dài 501 ký tự, báo cáo không tồn tại",
      "Chức năng", "Trung bình",
      NEWRPT,
      ["PATCH {action:'delete'}", "PATCH {action:'dismiss', note: 501 ký tự}", "PATCH {action:'dismiss', note: 500 ký tự}", "PATCH /api/reports/khong-co {action:'dismiss'}"],
      "action=delete; note 'a'×501; note 'a'×500",
      "Lần 1: 400 VALIDATION_ERROR (\"Hành động không hợp lệ\"). Lần 2: 400 VALIDATION_ERROR. Lần 3: 200 (biên hợp lệ). Lần 4: 404 NOT_FOUND \"Không tìm thấy báo cáo\".")
    a("Xử lý báo cáo", "Member thường và khách không xử lý được báo cáo",
      "Bảo mật", "Cao",
      NEWRPT,
      ["PATCH /api/reports/<id> {action:'dismiss'} bằng token member1", "Bằng token member2 (chính người báo cáo)", "Không token"], 'Body {"action":"dismiss"}',
      "member1 và member2: " + E403R + "; khách: " + E401 + "; báo cáo vẫn open.")
    a("Xử lý báo cáo", "Mod/admin của cộng đồng khác không xử lý được báo cáo của photo",
      "Bảo mật", "Cao",
      NEWRPT + "Đăng ký user Z, Z tạo cộng đồng riêng qua POST /api/communities (Z là owner cộng đồng Z, không thuộc photo).",
      ["Z: PATCH /api/reports/<id báo cáo photo> {action:'dismiss'}", "Z: GET /api/courses/photo/reports"], 'Body {"action":"dismiss"}',
      "Cả hai: " + E403R + " (quyền tính theo cộng đồng của báo cáo, owner cộng đồng khác không có quyền); báo cáo vẫn open.")
    a("Xử lý báo cáo", "Platform Admin xử lý báo cáo của cộng đồng mình không tham gia",
      "Chức năng", "Trung bình",
      NEWRPT.replace("mod đăng nhập", "admin@sofinhub.test đăng nhập"),
      ["GET /api/admin/reports?status=open, tìm báo cáo", "PATCH /api/reports/<id> {action:'hide_content'}"], 'Body {"action":"hide_content"}',
      "200; status=resolved, resolvedBy = id admin nền tảng; người báo cáo nhận thông báo report_resolved.")
    a("Xử lý báo cáo", "Hai mod xử lý song song cùng một báo cáo: chỉ một người thành công",
      "Tích hợp", "Cao",
      NEWRPT + "mod và cadmin đều đăng nhập.",
      ["Gửi đồng thời PATCH /api/reports/<id> với token mod {action:'dismiss'} và token cadmin {action:'hide_content'}", "GET báo cáo", "Đếm thông báo report_resolved của người báo cáo"], "2 request song song",
      "Một request 200, một request 409 \"Báo cáo này đã được xử lý\"; trạng thái cuối trùng đúng với request thắng; người báo cáo chỉ nhận đúng 1 thông báo report_resolved.")
    a("Xử lý báo cáo", "Sau khi ẩn nội dung, mod bỏ ẩn bằng /unhide: bài hiện lại, báo cáo vẫn ở trạng thái resolved",
      "Chức năng", "Thấp",
      RESET + "Bài `seed-post-photo-m1-hidden` (ẩn bởi báo cáo seed-report-photo-resolved). mod đăng nhập.",
      ["POST /api/posts/seed-post-photo-m1-hidden/unhide", "member3: GET /api/posts/seed-post-photo-m1-hidden", "GET reports?status=resolved"], "-",
      "200 {hidden:false}; member3 xem được bài; báo cáo seed vẫn resolved/hide_content (chưa có cơ chế hoàn tác báo cáo — mô tả docs 'Chưa làm').")
    a("Xử lý báo cáo", "Người bị ban qua báo cáo không tham gia lại được; sau khi cadmin bỏ ban thì tham gia lại được",
      "Chức năng", "Cao",
      RESET + "User X đã bị ban khỏi photo qua báo cáo (case ban_member). cadmin đăng nhập.",
      ["X: POST /api/courses/photo/enroll", "cadmin: DELETE /api/courses/photo/members/<X>/ban", "X: POST /api/courses/photo/enroll"], "-",
      "Lần 1: 403 FORBIDDEN \"Bạn đã bị cấm khỏi cộng đồng này\". Bỏ ban: 200 {banned:false}. Lần 3: 200 {enrolled:true}.")
    a("Xử lý báo cáo", "UI: mod bấm Cấm thành viên phải xác nhận trong hộp thoại \"Cấm thành viên?\"",
      "Giao diện", "Trung bình",
      RESET + "Đăng nhập cadmin; có báo cáo open về user X (thành viên thường).",
      ["Mở /courses/photo/community/kiem-duyet, tab Đang chờ", "Bấm \"Cấm thành viên\"", "Bấm hủy rồi lặp lại và xác nhận"], "-",
      "Hộp thoại xác nhận tiêu đề \"Cấm thành viên?\" nút \"Cấm thành viên\"; bấm hủy → báo cáo vẫn Đang chờ; xác nhận → báo cáo chuyển sang tab \"Đã xử lý\" với nhãn \"Đã cấm thành viên\".")

    # ------------------------------------------------------------------ Khu quản trị nền tảng
    a("Khu quản trị nền tảng", "Platform Admin thấy mục \"Quản trị\" trong menu avatar và trang /admin có 4 tab",
      "Giao diện", "Cao",
      RESET + "Đăng nhập admin@sofinhub.test / " + PW + " (PLATFORM_ADMIN_EMAILS chứa email này).",
      ["Bấm avatar ở Header", "Chọn \"Quản trị\"", "Kiểm các tab"], "-",
      "Menu có \"Quản trị\" → /admin, tiêu đề \"Quản trị nền tảng\", 4 tab: \"Hoàn tiền\", \"Rút tiền\", \"Báo cáo vi phạm\", \"Khóa cộng đồng\" (mặc định Hoàn tiền). Trong lúc kiểm quyền hiện \"Đang kiểm tra quyền…\".")
    a("Khu quản trị nền tảng", "Owner/member mở /admin thấy thông báo không có quyền và không có mục \"Quản trị\" trong menu",
      "Bảo mật", "Cao",
      RESET + "Lần lượt đăng nhập owner@ và member1@.",
      ["Bấm avatar, kiểm menu", "Mở thẳng /admin"], "-",
      "Không có mục \"Quản trị\"; /admin hiển thị \"Bạn không có quyền truy cập khu vực quản trị.\" và không hiện tab nào. Chưa đăng nhập → màn hình yêu cầu đăng nhập (RequireLogin).")
    a("Khu quản trị nền tảng", "FE xác định admin bằng GET /api/admin/refunds?page=1&limit=1: 200 với admin, 403 với người khác",
      "Bảo mật", "Trung bình",
      RESET + "Token admin, owner, khách.",
      ["GET /api/admin/refunds?page=1&limit=1 với từng token"], "-",
      "admin: 200 {data,meta}; owner: " + E403P + "; khách: " + E401 + ". (Chưa có cờ admin trong /auth/me — ghi chú BE thiếu.)")
    a("Khu quản trị nền tảng", "Platform Admin khóa cộng đồng: 200, owner nhận thông báo kèm lý do",
      "Chức năng", "Cao",
      RESET + "admin đăng nhập. Nên khóa cộng đồng thử do user Z tạo (POST /api/communities) để không ảnh hưởng seed; nếu khóa photo thì phải mở khóa sau test.",
      ["POST /api/admin/courses/<id>/lock", "Owner Z: GET /api/notifications"], 'Body {"reason":"Vi phạm chính sách nền tảng"}',
      "200 {data:{id, locked:true, reason:\"Vi phạm chính sách nền tảng\"}}; owner nhận thông báo system \"Cộng đồng bị khóa\", nội dung có \"Lý do: Vi phạm chính sách nền tảng\".")
    a("Khu quản trị nền tảng", "Cộng đồng bị khóa: member vào bị COMMUNITY_LOCKED, bị ẩn khỏi danh sách, chi tiết vẫn xem được",
      "Chức năng", "Cao",
      RESET + "Cộng đồng thử C (do Z tạo, Z là owner, thêm member M) đã bị admin khóa.",
      ["M: GET /api/courses/C/posts", "M: POST /api/courses/C/enroll (toggle)", "Z (owner): GET /api/courses/C/posts", "Khách: GET /api/courses (danh sách) và GET /api/courses/C"], "-",
      "M và Z: 403 code COMMUNITY_LOCKED, message \"Cộng đồng này đang bị khóa\" (owner không phải Platform Admin nên cũng bị chặn); enroll mới cũng 403 COMMUNITY_LOCKED; C không xuất hiện trong danh sách; GET /api/courses/C vẫn 200; FE hiển thị dải \"đang bị khóa\".")
    a("Khu quản trị nền tảng", "Validate lý do khóa: rỗng/khoảng trắng và > 500 ký tự bị 400; id sai 404",
      "Chức năng", "Trung bình",
      RESET + "admin đăng nhập.",
      ["POST lock với reason=\"\"", "reason=\"   \"", "reason dài 501 ký tự", "POST /api/admin/courses/khong-co/lock {reason:'x'}"], "reason ∈ {'', '   ', 'a'×501}",
      "Ba lần đầu: 400 VALIDATION_ERROR (\"Vui lòng nhập lý do\" / max 500); lần cuối: 404 NOT_FOUND. Không cộng đồng nào bị khóa. Ghi chú: BE min 1 ký tự nhưng UI yêu cầu >= 3 ký tự.")
    a("Khu quản trị nền tảng", "Mở khóa cộng đồng: hoạt động trở lại, không cần lý do, gọi lại khi chưa khóa vẫn 200",
      "Chức năng", "Trung bình",
      RESET + "Cộng đồng C đang bị khóa; admin đăng nhập.",
      ["POST /api/admin/courses/C/unlock", "M: GET /api/courses/C/posts", "POST unlock lần 2"], "-",
      "200 {id, locked:false}; M vào bình thường (200); owner nhận thông báo \"Cộng đồng đã được mở khóa\"; unlock lần 2 vẫn 200 (idempotent).")
    a("Khu quản trị nền tảng", "Chỉ Platform Admin khóa/mở khóa: owner của chính cộng đồng cũng bị 403",
      "Bảo mật", "Cao",
      RESET + "owner@ (owner photo), cadmin, khách.",
      ["POST /api/admin/courses/photo/lock {reason:'x'} bằng owner", "Bằng cadmin", "POST /api/admin/courses/photo/unlock bằng owner", "Không token"], 'Body {"reason":"thử"}',
      "owner, cadmin: " + E403P + "; khách: " + E401 + "; photo không bị khóa (GET /api/courses/photo/posts vẫn 200 với member1).")
    a("Khu quản trị nền tảng", "UI tab \"Khóa cộng đồng\": nhập id/slug + lý do rồi Khóa, sau đó Mở khóa",
      "Giao diện", "Trung bình",
      RESET + "admin đăng nhập; cộng đồng thử C tồn tại.",
      ["Vào /admin → tab \"Khóa cộng đồng\"", "Nhập id C và lý do 2 ký tự → thử Khóa", "Nhập lý do >= 3 ký tự → Khóa cộng đồng", "Nhập id sai → Khóa", "Bấm Mở khóa"], "lý do 'ab' rồi 'Vi phạm nội quy'; id sai 'xyz-khong-co'",
      "Lý do quá ngắn bị chặn ở FE; khóa hợp lệ hiện thông báo thành công; id sai → hiện lỗi 404 (\"Không tìm thấy...\"); Mở khóa không đòi lý do.")
    a("Khu quản trị nền tảng", "Admin lọc và xem yêu cầu hoàn tiền: pending/approved/rejected khớp seed",
      "Chức năng", "Trung bình",
      RESET + "admin đăng nhập. Seed paid-demo: seed-refund-pending (chờ duyệt, member minh họa #2) và seed-refund-approved (đã duyệt).",
      ["GET /api/admin/refunds?status=pending", "GET /api/admin/refunds?status=approved", "GET /api/admin/refunds?status=xyz"], "-",
      "pending chứa seed-refund-pending; approved chứa seed-refund-approved; status=xyz → 400 VALIDATION_ERROR. (Phần UI: trang /admin 4 tab cũ đã được thay bằng Admin Console - xem ADM2 mục Thanh toán > Hoàn tiền.)")
    a("Khu quản trị nền tảng", "Admin duyệt hoàn tiền yêu cầu chờ: giao dịch thành Đã hoàn tiền, gói bị hủy, người mua nhận thông báo",
      "Chức năng", "Cao",
      RESET + "admin đăng nhập; yêu cầu seed-refund-pending thuộc giao dịch seed-pay-pendref (cổng MockGateway luôn chấp nhận).",
      ["PATCH /api/admin/refunds/seed-refund-pending {action:'approve', note:'Đồng ý'}", "GET /api/admin/refunds?status=approved"], 'Body {"action":"approve","note":"Đồng ý"}',
      "200; refund.status=\"approved\", note=\"Đồng ý\", resolvedBy = id admin; giao dịch seed-pay-pendref chuyển \"refunded\" (hoàn 100% — giá trị tạm chờ chốt); gói của người mua chuyển canceled và thu hồi quyền truy cập paid-demo (nếu đó là kỳ hiện tại). Người mua ở seed là thành viên minh họa (isDemo) nên không kiểm được thông báo; để kiểm thông báo hãy dùng yêu cầu hoàn tiền của member1 (case từ chối/duyệt với tài khoản thật).")
    a("Khu quản trị nền tảng", "Admin từ chối hoàn tiền kèm ghi chú: giao dịch giữ nguyên, người mua nhận lý do",
      "Chức năng", "Trung bình",
      RESET + "Tạo yêu cầu hoàn tiền mới: member1 POST /api/payments/seed-pay-member1-b/refund-request {reason:'Không hài lòng'} (giao dịch gia hạn 10 ngày trước → ngoài cửa sổ 7 ngày nên pending — giá trị tạm). admin đăng nhập.",
      ["PATCH /api/admin/refunds/<id> {action:'reject', note:'Quá hạn'}", "member1: GET /api/notifications"], 'Body {"action":"reject","note":"Quá hạn"}',
      "200; status=\"rejected\"; giao dịch vẫn succeeded; member1 nhận thông báo system \"Yêu cầu hoàn tiền bị từ chối\", nội dung \"Lý do: Quá hạn\".")
    a("Khu quản trị nền tảng", "Xử lý lại yêu cầu hoàn tiền đã xử lý → 409; id sai → 404; action sai → 400; owner → 403",
      "Chức năng", "Trung bình",
      RESET + "Yêu cầu seed-refund-approved (đã duyệt). admin và owner đăng nhập.",
      ["admin: PATCH /api/admin/refunds/seed-refund-approved {action:'approve'}", "admin: PATCH /api/admin/refunds/khong-co {action:'approve'}", "admin: PATCH ... {action:'xoa'}", "owner: PATCH /api/admin/refunds/seed-refund-pending {action:'approve'}"], "-",
      "409 CONFLICT \"Yêu cầu này đã được xử lý\"; 404 \"Không tìm thấy yêu cầu hoàn tiền\"; 400 VALIDATION_ERROR; owner: " + E403S + " (route adminOnly).")
    a("Khu quản trị nền tảng", "Admin duyệt yêu cầu rút tiền: requested → approved → paid, owner nhận thông báo mỗi bước",
      "Chức năng", "Cao",
      RESET + "Payout seed-payout-pending ($50.00, requested, owner paid-demo, số TK ****4 số cuối). admin và owner đăng nhập.",
      ["admin: PATCH /api/admin/payouts/seed-payout-pending {action:'approve'}", "PATCH ... {action:'mark_paid', note:'Đã chuyển khoản'}", "owner: GET /api/notifications"], "-",
      "Bước 1: status=\"approved\", owner nhận \"Yêu cầu rút tiền đã được duyệt\". Bước 2: status=\"paid\", owner nhận \"Đã chuyển tiền\" với ****<4 số cuối>. (UI: /admin 4 tab cũ đã thay bằng Admin Console - xem ADM2 mục Chi trả.)")
    a("Khu quản trị nền tảng", "Admin từ chối payout: số dư khả dụng của owner được hoàn lại",
      "Chức năng", "Trung bình",
      RESET + "Ghi lại availableBalanceCents từ GET /api/courses/paid-demo/revenue (owner). Payout seed-payout-pending đang requested ($50).",
      ["admin: PATCH /api/admin/payouts/seed-payout-pending {action:'reject', note:'Sai thông tin TK'}", "owner: GET /api/courses/paid-demo/revenue"], 'Body {"action":"reject","note":"Sai thông tin TK"}',
      "status=\"rejected\"; payoutRequestedCents giảm 5000 và totalBalanceCents tăng đúng 5000 cent so với trước; availableBalanceCents (số CÓ THỂ RÚT = min(eligible - reserve - requested, total)) tăng tối đa 5000 (đối chiếu công thức, không còn là net - requested); owner nhận thông báo \"Yêu cầu rút tiền bị từ chối\" với \"Lý do: Sai thông tin TK\".")
    a("Khu quản trị nền tảng", "Chuyển trạng thái payout sai thứ tự bị 409; owner/khách bị chặn",
      "Bảo mật", "Trung bình",
      RESET + "Payout seed-payout-paid (đã paid). admin, owner đăng nhập.",
      ["admin: PATCH /api/admin/payouts/seed-payout-paid {action:'approve'}", "admin: {action:'reject'}", "admin: PATCH /api/admin/payouts/khong-co {action:'approve'}", "owner: PATCH /api/admin/payouts/seed-payout-pending {action:'approve'}", "owner: GET /api/admin/payouts"], "-",
      "approve → 409 \"Chỉ duyệt được yêu cầu đang chờ\"; reject → 409 \"Yêu cầu đã được xử lý xong\"; id lạ → 404 \"Không tìm thấy yêu cầu rút tiền\"; owner: " + E403S + " (route adminOnly).")
    a("Khu quản trị nền tảng", "PLATFORM_ADMIN_EMAILS: thêm owner@ vào biến môi trường và restart thì owner có quyền admin nền tảng",
      "Bảo mật", "Cao",
      "Có quyền sửa `backend/.env`. Ban đầu PLATFORM_ADMIN_EMAILS=admin@sofinhub.test.",
      ["Sửa PLATFORM_ADMIN_EMAILS=admin@sofinhub.test,owner@sofinhub.test rồi restart BE", "owner: GET /api/admin/refunds", "Ghi chú: thử biến viết hoa 'Admin@SofinHub.test' và có khoảng trắng quanh dấu phẩy", "Khôi phục .env"], "Danh sách email phân cách bằng dấu phẩy",
      "owner: 200 và thấy mục \"Quản trị\"; chuẩn hóa lowercase + trim nên email viết hoa/khoảng trắng vẫn khớp; sau khi khôi phục và restart, owner lại 403.",
      pw="Không")
    a("Khu quản trị nền tảng", "PLATFORM_ADMIN_EMAILS rỗng: không ai là Platform Admin kể cả admin@sofinhub.test",
      "Bảo mật", "Trung bình",
      "Có quyền sửa backend/.env.",
      ["Đặt PLATFORM_ADMIN_EMAILS= (rỗng) và restart", "admin: GET /api/admin/refunds", "admin: POST /api/admin/courses/photo/lock"], "-",
      "GET /api/admin/refunds: " + E403S + " (admin@ không còn là nhân viên - trừ khi seed gán AdminAccount); POST /api/admin/courses/photo/lock: " + E403P + "; /admin hiện \"Bạn không có quyền truy cập khu vực quản trị.\"; token cũ vẫn hợp lệ nhưng không còn đặc quyền (quyền tính từ env mỗi request).",
      pw="Không")
    a("Khu quản trị nền tảng", "Rủi ro chiếm quyền: email trong PLATFORM_ADMIN_EMAILS chưa có tài khoản — ai đăng ký trước sẽ thành Platform Admin",
      "Bảo mật", "Cao",
      "Môi trường thử: đặt PLATFORM_ADMIN_EMAILS=chiemquyen@sofinhub.test (chưa có tài khoản) rồi restart BE.",
      ["POST /api/auth/register với email chiemquyen@sofinhub.test, mật khẩu hợp lệ", "GET /api/admin/refunds với access token vừa nhận", "GET /api/dev/outbox?to=... chưa xác thực email (chỉ mount khi ENABLE_DEV_OUTBOX=1 và NODE_ENV != production; ngược lại 404)"], 'Body {"firstName":"Kẻ","lastName":"Lạ","email":"chiemquyen@sofinhub.test","password":"Passw0rd!x"}',
      "HÀNH VI THỰC TẾ của code: isPlatformAdmin chỉ so email (không đòi emailVerified) nên đăng ký xong là 200 — ghi nhận là rủi ro bảo mật (giá trị tạm / chưa chốt), đề xuất bắt buộc xác thực email cho Platform Admin.",
      pw="Có")
    a("Khu quản trị nền tảng", "Tổng quan số liệu toàn nền tảng (người dùng, cộng đồng, giao dịch, báo cáo) trên /admin",
      "Chức năng", "Trung bình",
      "Chưa làm: /admin hiện chỉ có 4 tab (Hoàn tiền, Rút tiền, Báo cáo vi phạm, Khóa cộng đồng); chưa có endpoint thống kê tổng quan.",
      ["Đăng nhập admin, mở /admin", "Tìm thẻ thống kê tổng quan"], "-",
      "Khi làm xong: hiển thị tổng người dùng, cộng đồng, giao dịch, báo cáo đang chờ, khớp COUNT trong DB.", pw="Có", st=PLAN)
    a("Khu quản trị nền tảng", "Danh sách và tìm kiếm người dùng/cộng đồng toàn nền tảng cho Platform Admin",
      "Chức năng", "Trung bình",
      "Chưa làm: không có endpoint admin liệt kê người dùng/cộng đồng (chỉ lock/unlock theo id và hàng đợi báo cáo/hoàn tiền/rút tiền).",
      ["Đăng nhập admin", "Vào tab Người dùng / Cộng đồng, tìm theo tên, email, id"], "-",
      "Khi làm xong: danh sách phân trang, tìm được theo email, hiển thị trạng thái khóa; chỉ Platform Admin gọi được (403 với người khác).", pw="Có", st=PLAN)
    a("Khu quản trị nền tảng", "Ban tài khoản trên toàn nền tảng (khác với ban trong một cộng đồng)",
      "Bảo mật", "Cao",
      "Chưa làm: chỉ có ban theo cộng đồng (CommunityBan). Chưa có cờ ban toàn cục nên tài khoản vi phạm nặng vẫn đăng nhập được.",
      ["Admin ban user X toàn nền tảng", "X đăng nhập; X dùng access token cũ"], "-",
      "Khi làm xong: đăng nhập bị từ chối với thông báo rõ ràng; access token/refresh token đang có bị thu hồi ngay (401); X không tham gia lại được cộng đồng nào.", pw="Có", st=PLAN)
    a("Đa ngôn ngữ", "Nút ngôn ngữ trên topbar cộng đồng hiện là nhãn tĩnh \"VI\", chưa chuyển được ngôn ngữ",
      "Giao diện", "Thấp",
      "Chưa làm: FE chưa có thư viện i18n; CommunityTopbar chỉ hiển thị biểu tượng ngôn ngữ và chữ \"VI\" (ẩn dưới màn hình md). index.html lang=\"vi\".",
      ["Mở /courses/photo/community bằng màn hình >= 768px", "Bấm vào cụm biểu tượng ngôn ngữ \"VI\""], "-",
      "Hiện tại: bấm không có tác dụng, không có menu chọn ngôn ngữ. Khi làm xong: đổi toàn bộ giao diện sang English, lưu lựa chọn (localStorage/tài khoản) và giữ sau khi đăng xuất/đăng nhập lại.", st=PLAN)
    a("Đa ngôn ngữ", "Ngôn ngữ cộng đồng (language vi/en của cộng đồng) khác với ngôn ngữ giao diện",
      "Chức năng", "Thấp",
      RESET + "owner đăng nhập; cộng đồng có trường language (LANGUAGES).",
      ["PATCH /api/courses/photo {language:'en'} (bằng owner) rồi GET /api/courses/photo", "Mở giao diện /courses/photo/community", "Trả language về giá trị cũ"], 'Body {"language":"en"}',
      "API lưu language của cộng đồng (200, detail.language=\"en\"); giao diện SofinHub vẫn tiếng Việt (language cộng đồng chỉ là metadata). Giá trị ngoài danh sách LANGUAGES → 400 VALIDATION_ERROR.")


# =============================================================================================
# ROLE — Ma trận phân quyền & Bảo mật nâng cao
# =============================================================================================
def _role(add):
    M, MN = "ROLE", "Ma trận phân quyền & Bảo mật nâng cao"

    def a(feat, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feat, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    PRE = (RESET + "8 vai trò: khách (không token), newbie, member1 (member), mod, cadmin (admin photo), owner (owner photo/yt/fin), admin (Platform Admin), banned (bị ban photo); mật khẩu " + PW
           + ". Lấy token bằng POST /api/auth/login" + LOGIN_LIM + ". ")

    def mx(feat, title, request, data, kind, min_role, ok, extra="", deny_member=None, overrides=None, prio="Cao", pw="Có"):
        steps = ["Với từng vai trò trong danh sách 8 vai trò, gọi: " + request + " (khách: không gửi header Authorization)",
                 "Ghi lại mã HTTP, error.code và message của từng lần gọi"]
        if extra:
            steps.append(extra)
        a(feat, title, "Bảo mật", prio, PRE, steps, data,
          matrix(kind, min_role, ok, deny_member, overrides), pw=pw)

    # ------------------------------------------------------------------ Bảng tin & tương tác (member trở lên)
    mx("Ma trận: bảng tin", "Đọc bảng tin cộng đồng photo theo 8 vai trò",
       "GET /api/courses/photo/posts", "-", "mem", "member1", "200 {data,meta}")
    mx("Ma trận: bảng tin", "Đăng bài mới vào photo theo 8 vai trò",
       "POST /api/courses/photo/posts", 'Body {"content":"Bài thử ma trận quyền"}', "mem", "member1", "201 (tác giả = chính người gọi)")
    mx("Ma trận: bảng tin", "Thích bài viết (toggle like) theo 8 vai trò",
       "POST /api/posts/seed-post-photo-owner-pinned/like", "-", "mem", "member1", "200 {liked,likesCount}",
       extra="Gọi lần hai bằng cùng token để trả like về trạng thái cũ")
    mx("Ma trận: bảng tin", "Ghim bài viết (pin) chỉ dành cho mod trở lên",
       "POST /api/posts/seed-post-photo-m1-image/pin", "-", "mem", "mod", "200 {pinned}", extra="Gọi lần hai để bỏ ghim",
       deny_member=E403R + " — member đã qua requireMembership nhưng không đạt bậc mod")
    mx("Ma trận: bảng tin", "Ẩn bài viết (hide) chỉ dành cho mod trở lên",
       "POST /api/posts/seed-post-photo-m1-image/hide", "-", "mem", "mod", "200 {hidden:true}",
       extra="Bỏ ẩn bằng POST /api/posts/seed-post-photo-m1-image/unhide", deny_member=E403R)
    mx("Ma trận: bảng tin", "Sửa bài của người khác (bài của member1) theo 8 vai trò",
       "PATCH /api/posts/seed-post-photo-m1-image", 'Body {"content":"Nội dung sửa thử"}', "mem", "mod", "200 (mod trở lên được sửa nội dung người khác)",
       deny_member="403 FORBIDDEN (\"Bạn chỉ được sửa bài viết của mình\")",
       overrides={"member1": "200 (tác giả sửa bài của mình)"},
       extra="Thêm: member2 gọi cùng lệnh → 403 \"Bạn chỉ được sửa bài viết của mình\"; khôi phục nội dung gốc sau khi thử")
    mx("Ma trận: bảng tin", "Xóa bình luận của người khác (bình luận của member2) theo 8 vai trò",
       "DELETE /api/comments/seed-comment-photo-m2-on-m1-image", "-", "mem", "mod", "200 {deleted:true} (mod+ được xóa bình luận người khác)",
       deny_member="403 FORBIDDEN (\"Bạn chỉ được xóa bình luận của mình\")",
       extra="Xóa thành công chỉ chạy được 1 lần mỗi lần seed: thử tuần tự từ vai trò thấp đến cao, dừng khi có 200 (các lần sau gặp 404 NOT_FOUND \"Không tìm thấy bình luận\"); db:reset để lặp lại")
    mx("Ma trận: bảng tin", "Bỏ phiếu poll theo 8 vai trò",
       "POST /api/posts/seed-post-photo-m1-poll/poll/vote", 'Body {"optionIds":["seed-photo-poll-o2"]}', "mem", "member1", "200 (ghi/đổi phiếu)", prio="Trung bình")

    # ------------------------------------------------------------------ Lịch & sự kiện
    mx("Ma trận: lịch", "Tạo sự kiện photo chỉ dành cho mod trở lên",
       "POST /api/courses/photo/events", 'Body {"title":"Sự kiện thử","startAt":"<ISO 7 ngày sau>"}', "mem", "mod", "201", deny_member=E403R)
    mx("Ma trận: lịch", "Sửa sự kiện seed-event-photo-limited chỉ dành cho mod trở lên",
       "PATCH /api/events/seed-event-photo-limited", 'Body {"description":"Cập nhật thử"}', "mem", "mod", "200", deny_member=E403R)
    mx("Ma trận: lịch", "Xóa sự kiện chỉ dành cho mod trở lên (dùng sự kiện tự tạo, không xóa seed)",
       "DELETE /api/events/<id sự kiện do mod tạo riêng cho mỗi vai trò>", "-", "mem", "mod", "200 {deleted:true}", deny_member=E403R,
       extra="Mỗi lần thử cần 1 sự kiện mới (tạo bằng mod) vì xóa thành công là mất sự kiện")
    mx("Ma trận: lịch", "RSVP sự kiện theo 8 vai trò",
       "POST /api/events/seed-event-photo-limited/rsvp", "-", "mem", "member1", "200 {rsvped,rsvpCount}",
       extra="Sự kiện giới hạn 3 chỗ, đã có 2 (member2 + 1 minh họa): chỉ 1 vai trò đầu tiên nhận 200, các vai trò sau nhận 409 CONFLICT \"Sự kiện đã đủ số lượng đăng ký\"; gọi lần 2 cùng token để hủy chỗ",
       prio="Trung bình")

    # ------------------------------------------------------------------ Lớp học
    mx("Ma trận: lớp học", "Xem danh sách module lớp học theo 8 vai trò",
       "GET /api/courses/photo/modules", "-", "mem", "member1", "200 (mảng module; owner/mod/admin không bị khóa module)", prio="Trung bình")
    mx("Ma trận: lớp học", "Tạo module lớp học chỉ dành cho mod trở lên",
       "POST /api/courses/photo/modules", 'Body {"title":"Module thử ma trận","description":"Mô tả"}', "rr", "mod", "201",
       extra="Route chỉ dùng requireRole nên admin nền tảng qua được dù chưa ghi danh")
    mx("Ma trận: lớp học", "Bật/tắt chứng nhận (classroom-settings) chỉ dành cho admin trở lên",
       "PATCH /api/courses/photo/classroom-settings", 'Body {"certificatesEnabled":true}', "rr", "cadmin", "200 {certificatesEnabled}",
       extra="Trả lại giá trị cũ sau khi thử", overrides={"mod": E403R + " (mod chưa đủ bậc admin)"})

    # ------------------------------------------------------------------ Kiểm duyệt
    mx("Ma trận: kiểm duyệt", "Xem hàng đợi báo cáo của photo chỉ dành cho mod trở lên",
       "GET /api/courses/photo/reports", "-", "rr", "mod", "200")
    mx("Ma trận: kiểm duyệt", "Xử lý báo cáo (PATCH /api/reports/:id) chỉ dành cho mod trở lên",
       "PATCH /api/reports/<id báo cáo open riêng cho mỗi lần thử>", 'Body {"action":"dismiss"}', "rr", "mod", "200 (status dismissed)",
       extra="Cần một báo cáo open mới cho mỗi vai trò được phép (báo cáo đã xử lý sẽ trả 409)")
    mx("Ma trận: kiểm duyệt", "Hàng đợi báo cáo toàn nền tảng GET /api/admin/reports",
       "GET /api/admin/reports", "-", "pa", "admin nền tảng", "200 {data,meta}")

    # ------------------------------------------------------------------ Quản trị cộng đồng
    mx("Ma trận: quản trị cộng đồng", "Sửa thông tin cộng đồng (mô tả) chỉ dành cho admin trở lên",
       "PATCH /api/courses/photo", 'Body {"description":"Mô tả thử ma trận"}', "rr", "cadmin", "200 (course detail)",
       extra="Khôi phục mô tả cũ sau khi thử", overrides={"mod": E403R + " (mod dưới bậc admin)"})
    mx("Ma trận: quản trị cộng đồng", "Đổi giá/chế độ riêng tư chỉ dành cho owner (admin cộng đồng bị chặn)",
       "PATCH /api/courses/photo", 'Body {"visibility":"<đúng giá trị hiện tại>"}', "rr", "owner", "200",
       extra="Gửi lại đúng giá trị hiện tại để không đổi dữ liệu thật; requireRole owner chạy SAU requireRole admin",
       overrides={"mod": E403R, "cadmin": E403R + " (cadmin có quyền admin nhưng không có quyền đổi giá/riêng tư)"})
    mx("Ma trận: quản trị cộng đồng", "Tạo lời mời cộng đồng chỉ dành cho admin trở lên",
       "POST /api/courses/photo/invites", 'Body {"maxUses":5}', "rr", "cadmin", "201 {code,...} (mã 12 ký tự base64url)", overrides={"mod": E403R})
    mx("Ma trận: quản trị cộng đồng", "Xem danh sách thành viên bị cấm chỉ dành cho admin trở lên",
       "GET /api/courses/photo/bans", "-", "rr", "cadmin", "200 (banned@sofinhub.test nằm trong danh sách)", overrides={"mod": E403R})
    mx("Ma trận: quản trị cộng đồng", "Đặt vai trò mod cho member3 (PATCH .../members/:userId/role) chỉ dành cho admin trở lên",
       "PATCH /api/courses/photo/members/<id member3>/role", 'Body {"role":"mod"}', "rr", "cadmin", "200 {userId,role:\"mod\"} + thông báo role_changed",
       extra="Trả member3 về member sau mỗi lần", overrides={"mod": E403R})
    mx("Ma trận: quản trị cộng đồng", "Đặt vai trò admin chỉ dành cho owner (cadmin bị chặn)",
       "PATCH /api/courses/photo/members/<id member3>/role", 'Body {"role":"admin"}', "rr", "owner", "200 {role:\"admin\"}",
       extra="Trả member3 về member sau khi thử",
       overrides={"mod": E403R, "cadmin": "403 FORBIDDEN (\"Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên\")"})
    mx("Ma trận: quản trị cộng đồng", "Kick thành viên (DELETE .../members/:userId) chỉ admin trở lên và chỉ bậc thấp hơn",
       "DELETE /api/courses/photo/members/<id member3>", "-", "rr", "cadmin", "200 {removed:true} + thông báo removed_from_community",
       extra="Thêm lại member3 bằng POST /api/courses/photo/enroll sau khi thử (photo công khai, miễn phí)", overrides={"mod": E403R})
    mx("Ma trận: quản trị cộng đồng", "Ban thành viên (POST .../members/:userId/ban) chỉ admin trở lên",
       "POST /api/courses/photo/members/<id member3>/ban", 'Body {"reason":"Thử ma trận"}', "rr", "cadmin", "200 {banned:true}",
       extra="Bỏ ban bằng DELETE .../ban rồi cho member3 tham gia lại", overrides={"mod": E403R})
    mx("Ma trận: quản trị cộng đồng", "Chuyển quyền chủ cộng đồng chỉ dành cho owner",
       "POST /api/courses/<id cộng đồng thử>/transfer-ownership", 'Body {"userId":"<id một thành viên>"}', "rr", "owner", "200 {ownerId}",
       extra="Dùng cộng đồng thử do owner tạo (POST /api/communities) có thêm 1 admin và 1 member; không thử trên photo",
       overrides={"member1": E403R, "mod": E403R, "cadmin": E403R})
    mx("Ma trận: quản trị cộng đồng", "Xóa cộng đồng (DELETE /api/courses/:id) chỉ dành cho owner hoặc Platform Admin",
       "DELETE /api/courses/<id cộng đồng thử>", "-", "rr", "owner", "200 {deleted:true} (xóa mềm, thành viên nhận thông báo)",
       extra="Dùng cộng đồng thử (không xóa photo); sau mỗi lần xóa thành công phải tạo cộng đồng khác (lần gọi sau trả 404 NOT_FOUND)",
       overrides={"member1": E403R, "mod": E403R, "cadmin": E403R})
    mx("Ma trận: quản trị cộng đồng", "Xem chi tiết một thành viên (GET .../members/:userId) theo 8 vai trò",
       "GET /api/courses/photo/members/<id member2>", "-", "mem", "member1", "200 {id,name,handle,role,roleDetail,...}", prio="Trung bình")
    mx("Ma trận: quản trị cộng đồng", "Duyệt yêu cầu tham gia cộng đồng riêng tư private-demo: chỉ admin của CHÍNH cộng đồng đó",
       "POST /api/join-requests/<id yêu cầu của newbie>/approve (id lấy từ GET /api/courses/private-demo/join-requests?status=pending bằng owner)", "-", "rr", "owner",
       "200 (newbie trở thành member private-demo)",
       extra="Nhớ: cadmin/mod chỉ có quyền ở photo, KHÔNG có quyền ở private-demo; owner là owner private-demo",
       overrides={"member1": E403R + " (member1 là người xin, chưa là thành viên private-demo)", "mod": E403R, "cadmin": E403R + " (admin photo không có quyền ở private-demo)"})

    # ------------------------------------------------------------------ Thanh toán & nền tảng
    mx("Ma trận: thanh toán", "Xem doanh thu cộng đồng có phí paid-demo: chỉ owner hoặc Platform Admin",
       "GET /api/courses/paid-demo/revenue", "-", "rr", "owner", "200 {grossCents,netCents,availableBalanceCents,mrrCents,...}",
       extra="member1/member2/member3 là thành viên thường của paid-demo; cadmin, mod chỉ ở photo",
       overrides={"member1": E403R, "mod": E403R, "cadmin": E403R})
    P403 = "403 FORBIDDEN (\"Chỉ chủ cộng đồng mới được yêu cầu rút tiền\")"
    mx("Ma trận: thanh toán", "Yêu cầu rút tiền paid-demo: chỉ đúng Owner (Platform Admin cũng bị chặn)",
       "POST /api/courses/paid-demo/payouts", 'Body {"amountCents":5000,"method":{"type":"bank","bankName":"VCB","accountNumber":"0123456789","accountHolder":"NGUYEN VAN A"}}', "rr", "owner",
       "201 (số TK ****6789) khi số CÓ THỂ RÚT (availableBalanceCents) >= $50",
       extra="Nếu số có thể rút không đủ (tiền mới còn trong holding 14 ngày, trừ quỹ dự phòng 10%), owner nhận 400 PAYOUT_EXCEEDS_AVAILABLE \"Số tiền rút vượt quá số dư có thể rút (...)\" thay vì 201",
       overrides={"newbie": P403, "member1": P403, "mod": P403, "cadmin": P403, "banned": P403,
                  "admin nền tảng": P403 + " — dùng isCourseOwner, không tính Platform Admin"})
    mx("Ma trận: nền tảng", "Hoàn tiền/rút tiền phía admin (GET /api/admin/refunds, GET /api/admin/payouts)",
       "GET /api/admin/refunds và GET /api/admin/payouts", "-", "pa", "admin nền tảng", "200 {data,meta} cho cả hai",
       extra="HIỆN TẠI: 2 route này đi qua adminOnly (nhân viên admin + quyền payment.view): người không phải nhân viên nhận message 'Chỉ nhân viên admin mới có quyền này' (khác 'Chỉ Platform Admin' của /admin/reports và lock); nhân viên có vai trò (Finance, Super Admin) được vào theo ma trận quyền ở ADM3",
       overrides={n: E403S for n in ("newbie", "member1", "mod", "cadmin", "owner", "banned")})
    mx("Ma trận: nền tảng", "Khóa cộng đồng (POST /api/admin/courses/:id/lock) chỉ dành cho Platform Admin",
       "POST /api/admin/courses/<id cộng đồng thử>/lock", 'Body {"reason":"Thử ma trận"}', "pa", "admin nền tảng", "200 {locked:true}",
       extra="Mở khóa bằng POST .../unlock sau khi thử")

    # ------------------------------------------------------------------ Nhóm vai trò đặc biệt
    a("Ma trận: nhóm khách", "Khách (chưa đăng nhập): route cần xác thực trả 401 UNAUTHORIZED, route công khai vẫn 200",
      "Bảo mật", "Cao", RESET + "Không có token.",
      ["Gọi không header Authorization: GET /api/auth/me, GET /api/courses/photo/posts, POST /api/courses/photo/enroll, GET /api/notifications, GET /api/conversations, GET /api/me/payments, PATCH /api/reports/x",
       "Gọi các route công khai: GET /api/courses, GET /api/courses/photo, GET /api/invites/DEMO-VALID, GET /api/certificates/FIN-DEMO-CERT-001, GET /api/courses/photo/reviews, GET /health"], "-",
      "Nhóm 1: đều 401 UNAUTHORIZED \"Vui lòng đăng nhập để tiếp tục\". Nhóm 2: đều 200 (GET /api/courses/photo có viewerRole=null; invite DEMO-VALID trả code, course private-demo, remainingUses=5).")
    a("Ma trận: nhóm banned", "Người bị ban khỏi photo (banned@) mất quyền thành viên nhưng vẫn dùng được cộng đồng khác và nền tảng",
      "Bảo mật", "Cao", RESET + "banned@sofinhub.test đăng nhập (chỉ ở photo, có CommunityBan).",
      ["GET /api/courses/photo/posts", "POST /api/courses/photo/enroll", "GET /api/courses/photo (chi tiết công khai)", "GET /api/auth/me", "GET /api/courses/yt (chi tiết công khai)"], "-",
      "posts: " + E403M + "; enroll: 403 FORBIDDEN \"Bạn đã bị cấm khỏi cộng đồng này\"; chi tiết photo và yt: 200; /auth/me: 200 (chưa có ban toàn nền tảng).")
    a("Ma trận: nhóm banned", "Người bị ban không gọi được các route quản trị của photo",
      "Bảo mật", "Trung bình", RESET + "banned đăng nhập.",
      ["GET /api/courses/photo/reports", "POST /api/courses/photo/invites", "PATCH /api/courses/photo/members/<id member3>/role {role:'mod'}", "GET /api/courses/photo/bans"], "-",
      "Cả 4: " + E403R + " (getRole = null vì bị coi là chưa ghi danh); không có tác dụng phụ.")
    a("Ma trận: admin nền tảng", "Platform Admin trên các route đi qua requireMembership (bảng tin, lịch, lớp học): 200 dù chưa ghi danh",
      "Bảo mật", "Cao", RESET + "admin@sofinhub.test (không ghi danh cộng đồng nào).",
      ["GET /api/courses/photo/posts", "GET /api/courses/photo/events", "GET /api/courses/photo/modules", "POST /api/posts/seed-post-photo-m1-image/hide",
       "So sánh với route chỉ requireRole: GET /api/courses/photo/reports, PATCH /api/courses/photo {description}, GET /api/courses/photo/bans"], "-",
      "4 route đầu: 200 (requireMembership cho qua Platform Admin; đã sửa, trước đây 403 \"Bạn cần tham gia cộng đồng này trước\" lệch policy.ts/API.md 'ghi đè mọi cộng đồng'; admin không bị thêm vào danh sách thành viên). 3 route sau: 200. Cộng đồng đang bị khóa: Platform Admin vẫn vào được, người khác 403 COMMUNITY_LOCKED.")
    a("Ma trận: owner", "Owner của photo không có quyền quản trị trong cộng đồng do người khác tạo",
      "Bảo mật", "Cao", RESET + "Đăng ký user Z, Z tạo cộng đồng ZC (POST /api/communities). owner@ không ở ZC.",
      ["owner: GET /api/courses/ZC/reports", "owner: PATCH /api/courses/ZC {description:'x'}", "owner: GET /api/courses/ZC/join-requests", "owner: DELETE /api/courses/ZC"], "-",
      "Cả 4: " + E403R + "; ZC không thay đổi (quyền tính theo từng cộng đồng, không theo tài khoản).")

    # ------------------------------------------------------------------ IDOR
    a("IDOR", "Đọc/tương tác bài viết của photo bằng id khi chỉ là thành viên cộng đồng khác",
      "Bảo mật", "Cao", RESET + "Đăng ký user Y, Y tạo cộng đồng riêng YC (Y không ở photo). Id bài `seed-post-photo-m1-image`.",
      ["Y: GET /api/posts/seed-post-photo-m1-image", "Y: GET /api/posts/seed-post-photo-m1-image/comments", "Y: POST /api/posts/seed-post-photo-m1-image/like", "Y: POST /api/posts/seed-post-photo-m1-image/comments {content:'x'}"], "-",
      "Cả 4: " + E403M + " (quyền tính theo cộng đồng chứa bài, không theo cộng đồng của Y); likesCount/số bình luận của bài không đổi.")
    a("IDOR", "Sửa/xóa bình luận của người khác qua id: thành viên thường 403, người ngoài cộng đồng 403",
      "Bảo mật", "Cao", RESET + "member3 (thành viên photo), newbie. Bình luận `seed-comment-photo-m2-on-m1-image` (tác giả member2).",
      ["member3: PATCH /api/comments/seed-comment-photo-m2-on-m1-image {content:'Sửa lén'}", "member3: DELETE cùng id", "newbie: DELETE cùng id"], "-",
      "member3: 403 FORBIDDEN \"Bạn chỉ được sửa bình luận của mình\" / \"Bạn chỉ được xóa bình luận của mình\"; newbie: " + E403M + "; bình luận còn nguyên \"Bố cục đẹp quá, màu trời rất có hồn!\".")
    a("IDOR", "Truy cập sự kiện photo bằng id khi không phải thành viên (xem, RSVP, .ics)",
      "Bảo mật", "Cao", RESET + "newbie đăng nhập (chưa ở photo). Sự kiện `seed-event-photo-limited`.",
      ["GET /api/events/seed-event-photo-limited", "POST /api/events/seed-event-photo-limited/rsvp", "GET /api/events/seed-event-photo-limited/ics", "GET /api/courses/photo/events.ics", "GET /api/events/khong-co"], "-",
      "4 lần đầu: " + E403M + "; rsvpCount vẫn 2/3; id sự kiện lạ: 404 NOT_FOUND \"Không tìm thấy sự kiện\".")
    a("IDOR", "Xem hóa đơn của giao dịch người khác: 403; chủ giao dịch, owner cộng đồng, Platform Admin xem được",
      "Bảo mật", "Cao", RESET + "Giao dịch seed-pay-member1-a (của member1, paid-demo, có số hóa đơn INV-...). Tài khoản member2, member1, owner, admin.",
      ["member2: GET /api/payments/seed-pay-member1-a/invoice", "member1: GET cùng endpoint", "owner: GET", "admin: GET", "member2: GET /api/payments/khong-co/invoice"], "-",
      "member2: 403 FORBIDDEN (\"Bạn không có quyền thực hiện thao tác này\"); member1, owner, admin: 200 với invoiceNumber dạng INV-<năm>-<6 số>; id lạ: 404 NOT_FOUND \"Không tìm thấy giao dịch\".")
    a("IDOR", "Không xác nhận thanh toán / xin hoàn tiền thay người khác bằng id giao dịch",
      "Bảo mật", "Cao", RESET + "member2 đăng nhập; giao dịch seed-pay-member1-b thuộc member1.",
      ["member2: POST /api/payments/seed-pay-member1-b/confirm", "member2: POST /api/payments/seed-pay-member1-b/refund-request {reason:'Xin hộ'}"], "-",
      "Cả hai: 403 FORBIDDEN (\"Bạn không có quyền thực hiện thao tác này\"); giao dịch và hoàn tiền không đổi.")
    a("IDOR", "Đọc/gửi tin trong hội thoại của hai người khác trả 404 (không lộ tồn tại)",
      "Bảo mật", "Cao", RESET + "Hội thoại seed-conv-member1-member2. member3 đăng nhập.",
      ["member3: GET /api/conversations/seed-conv-member1-member2/messages", "member3: POST /api/conversations/seed-conv-member1-member2/messages {content:'chen ngang'}", "member3: POST .../read", "member3: DELETE /api/messages/seed-msg-2"], "-",
      "GET/POST/read: 404 NOT_FOUND \"Không tìm thấy cuộc trò chuyện\"; DELETE tin: 404 \"Không tìm thấy tin nhắn\" (không phải 403). GET /api/conversations của member3 không chứa hội thoại này.")
    a("IDOR", "Thu hồi tin nhắn của người khác trong CÙNG hội thoại bị 403",
      "Bảo mật", "Cao", RESET + "member2 đăng nhập; tin seed-msg-2 do member1 gửi trong seed-conv-member1-member2.",
      ["member2: DELETE /api/messages/seed-msg-2"], "-",
      "403 FORBIDDEN, message \"Chỉ người gửi mới được thu hồi tin nhắn\"; tin nhắn vẫn nguyên vẹn.")
    a("IDOR", "Đọc/xóa thông báo của người khác trả 404",
      "Bảo mật", "Cao", RESET + "member2 đăng nhập; thông báo seed-notif-member1-1 thuộc member1.",
      ["member2: POST /api/notifications/seed-notif-member1-1/read", "member2: DELETE /api/notifications/seed-notif-member1-1", "member1: GET /api/notifications, xác nhận thông báo còn nguyên"], "-",
      "Hai lần đầu: 404 NOT_FOUND \"Không tìm thấy thông báo\"; thông báo của member1 không bị đổi trạng thái/xóa.")
    a("IDOR", "Thu hồi phiên đăng nhập của người khác qua id phiên: 404",
      "Bảo mật", "Cao", RESET + "member1 và member2 đã đăng nhập; lấy sid của member1 từ GET /api/auth/sessions (token member1).",
      ["member2: DELETE /api/auth/sessions/<sid của member1>", "member1: GET /api/auth/sessions kiểm phiên còn"], "-",
      "member2 nhận 404 NOT_FOUND \"Không tìm thấy phiên đăng nhập\"; phiên và token của member1 vẫn dùng được.")
    a("IDOR", "Hủy yêu cầu tham gia của người khác qua id: 404",
      "Bảo mật", "Cao", RESET + "Yêu cầu pending của newbie ở private-demo (id từ GET /api/courses/private-demo/join-requests bằng owner). member2 đăng nhập.",
      ["member2: DELETE /api/join-requests/<id của newbie>", "owner: GET danh sách yêu cầu pending"], "-",
      "member2: 404 NOT_FOUND \"Không tìm thấy yêu cầu tham gia\"; yêu cầu của newbie vẫn pending.")
    a("IDOR", "Thu hồi/liệt kê lời mời của cộng đồng khác: admin photo không đụng được lời mời của private-demo",
      "Bảo mật", "Cao", RESET + "cadmin (admin photo) và owner (owner private-demo). Lời mời DEMO-VALID thuộc private-demo.",
      ["cadmin: DELETE /api/invites/DEMO-VALID", "cadmin: GET /api/courses/private-demo/invites", "owner: GET /api/courses/private-demo/invites"], "-",
      "cadmin ở cả hai route: " + E403R + "; owner: 200, DEMO-VALID vẫn chưa bị thu hồi (revokedAt null).")
    a("IDOR", "Xóa đánh giá của người khác: thành viên thường 403, mod+ được xóa",
      "Bảo mật", "Trung bình", RESET + "member1 đã viết đánh giá cho photo (POST /api/courses/photo/reviews {rating:5,text:'Tốt'}); member2, mod đăng nhập.",
      ["member2: DELETE /api/reviews/<id đánh giá của member1>", "mod: DELETE cùng id"], "-",
      "member2: 403 FORBIDDEN; mod: 200 {deleted:true}; điểm/số lượt đánh giá được tính lại.")
    a("IDOR", "Xóa tệp upload của người khác: 403; chủ sở hữu hoặc Platform Admin xóa được",
      "Bảo mật", "Trung bình", RESET + "member1 đã upload 1 ảnh (POST /api/uploads/presign rồi PUT), lưu key; member2, admin đăng nhập.",
      ["member2: DELETE /api/uploads/<key>", "admin: DELETE /api/uploads/<key>"], "-",
      "member2: 403 FORBIDDEN; admin: 200 {deleted:true}; sau đó GET /api/files/<key> → 404.")
    a("IDOR", "Danh sách rút tiền của cộng đồng khác: owner cộng đồng A không xem được của B",
      "Bảo mật", "Cao", RESET + "owner (owner paid-demo). Đăng ký user Z, Z tạo cộng đồng ZC.",
      ["Z: GET /api/courses/paid-demo/payouts", "owner: GET /api/courses/ZC/payouts", "owner: GET /api/courses/paid-demo/payouts"], "-",
      "Z: " + E403R + "; owner tại ZC: " + E403R + "; owner tại paid-demo: 200 với seed-payout-paid và seed-payout-pending, số TK dạng ****<4 số cuối>.")

    # ------------------------------------------------------------------ Nâng quyền
    a("Nâng quyền", "Tự đổi vai trò của chính mình bị chặn 400",
      "Bảo mật", "Cao", RESET + "cadmin đăng nhập; id của cadmin từ GET /api/auth/me.",
      ["PATCH /api/courses/photo/members/<id cadmin>/role {role:'member'}", "Thử cả role:'admin'"], "-",
      "400 BAD_REQUEST, message \"Bạn không thể tự đổi vai trò của mình\"; vai trò không đổi.")
    a("Nâng quyền", "Member/mod không tự nâng mình thành admin qua API vai trò",
      "Bảo mật", "Cao", RESET + "member1 và mod đăng nhập.",
      ["member1: PATCH /api/courses/photo/members/<id member1>/role {role:'admin'}", "mod: PATCH .../members/<id mod>/role {role:'admin'}"], "-",
      "member1 và mod: " + E403R + " (kiểm quyền admin chạy trước kiểm 'tự đổi'); vai trò không đổi.")
    a("Nâng quyền", "Body có role='owner' hoặc giá trị lạ bị từ chối: không thể tạo owner thứ hai",
      "Bảo mật", "Cao", RESET + "owner đăng nhập.",
      ["PATCH /api/courses/photo/members/<id member2>/role {role:'owner'}", "{role:'platform_admin'}", "{role:'root'}"], "-",
      "Cả 3: 400 VALIDATION_ERROR (role chỉ nhận member|mod|admin); member2 vẫn là member; chỉ POST transfer-ownership mới đổi chủ.")
    a("Nâng quyền", "Không đổi vai trò/kick/ban được Owner: cả cadmin lẫn Platform Admin đều 403",
      "Bảo mật", "Cao", RESET + "cadmin và admin@ đăng nhập; id owner từ GET /api/courses/photo/members.",
      ["cadmin: PATCH .../members/<id owner>/role {role:'member'}", "cadmin: DELETE .../members/<id owner>", "cadmin: POST .../members/<id owner>/ban", "admin: DELETE .../members/<id owner>", "admin: POST .../members/<id owner>/ban"], "-",
      "PATCH: 403 \"Không thể đổi vai trò của chủ cộng đồng\"; kick/ban: 403 FORBIDDEN \"Không thể tác động lên chủ cộng đồng\" (kể cả admin nền tảng — quy tắc 'không bao giờ lên Owner'); owner vẫn là owner và vẫn trong danh sách thành viên.")
    a("Nâng quyền", "Admin cộng đồng không kick/ban/hạ vai trò được admin ngang cấp",
      "Bảo mật", "Cao", RESET + "owner đặt member3 làm admin (PATCH role admin). cadmin đăng nhập.",
      ["cadmin: DELETE /api/courses/photo/members/<id member3>", "cadmin: POST .../members/<id member3>/ban", "cadmin: PATCH .../members/<id member3>/role {role:'member'}"], "-",
      "Kick/ban: 403 FORBIDDEN \"Bạn chỉ có thể tác động lên thành viên có vai trò thấp hơn mình\"; hạ vai trò admin: 403 \"Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên\". Trả member3 về member sau test.")
    a("Nâng quyền", "Mod không kick được thành viên (không đủ bậc admin)",
      "Bảo mật", "Cao", RESET + "mod đăng nhập.",
      ["mod: DELETE /api/courses/photo/members/<id member3>", "mod: DELETE /api/courses/photo/members/<id cadmin>"], "-",
      "Cả hai: " + E403R + "; member3 và cadmin vẫn trong danh sách thành viên.")
    a("Nâng quyền", "Chuyển quyền chủ: chỉ owner, chỉ sang thành viên thật, không tự chuyển cho chính mình",
      "Bảo mật", "Cao", RESET + "Cộng đồng thử ZC của Z (owner) có thành viên M (member) và admin ZA; newbie ngoài cộng đồng.",
      ["ZA: POST /api/courses/ZC/transfer-ownership {userId: id ZA}", "Z: POST ... {userId: id Z}", "Z: POST ... {userId: id newbie}", "Z: POST ... {userId: id M}", "Z: GET /api/courses/ZC/members"], "-",
      "ZA: " + E403R + "; chuyển cho chính mình: 400 \"Bạn đã là chủ cộng đồng\"; người ngoài cộng đồng: 400 \"Người nhận phải là thành viên của cộng đồng\"; chuyển cho M: 200 {ownerId: M}, Z trở thành admin, M là owner.")
    a("Nâng quyền", "Mass assignment: PATCH /api/auth/me không cho tự sửa role, emailVerified, isDemo, tokenVersion, email",
      "Bảo mật", "Cao", RESET + "member1 đăng nhập.",
      ["PATCH /api/auth/me {firstName:'Minh', role:'admin', emailVerified:true, isDemo:false, tokenVersion:99, email:'hacker@x.test'}", "GET /api/auth/me", "GET /api/admin/refunds"], "-",
      "PATCH 200 nhưng các trường lạ bị zod bỏ (không lưu); /auth/me giữ email member1@sofinhub.test và emailVerified như cũ; /api/admin/refunds vẫn " + E403S + ".")
    a("Nâng quyền", "Tạo cộng đồng với ownerId/locked giả trong body: bị bỏ qua, chủ luôn là người gọi",
      "Bảo mật", "Trung bình", RESET + "newbie đăng nhập.",
      ["POST /api/communities {title:'Cộng đồng thử', description:'m', category:<id danh mục hợp lệ>, priceUsd:0, visibility:'public', ownerId:'<id owner khác>', locked:true}", "GET chi tiết cộng đồng vừa tạo"], "-",
      "201; ownerId là newbie (lấy từ token), không bị khóa, viewerRole=\"owner\" cho newbie; trường lạ bị bỏ.")
    a("Nâng quyền", "Thành viên không tự duyệt yêu cầu của mình hay vào private-demo bằng lối tắt",
      "Bảo mật", "Cao", RESET + "member1 (đang có yêu cầu pending ở private-demo, đã là thành viên paid-demo).",
      ["member1: GET /api/courses/private-demo/join-requests", "member1: POST /api/join-requests/<id của mình>/approve", "member1: POST /api/courses/private-demo/enroll", "member1: POST /api/invites/DEMO-PAID/accept"], "-",
      "join-requests và approve: " + E403R + "; enroll private-demo: 403 JOIN_REQUEST_REQUIRED \"Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời\"; DEMO-PAID: 409 CONFLICT (\"Bạn đã là thành viên của cộng đồng này\") vì đã ở paid-demo — với người chưa tham gia là 402 PAYMENT_REQUIRED, không lối tắt bỏ qua thanh toán.")

    # ------------------------------------------------------------------ JWT / CSRF / CORS
    a("JWT", "Token giả: đổi payload sub sang user khác giữ nguyên chữ ký cũ bị 401",
      "Bảo mật", "Cao", RESET + "Access token hợp lệ của member1 (payload chỉ gồm sub, sid, tv — KHÔNG có claim role).",
      ["Giải base64url phần payload, đổi sub thành id owner, ghép lại với chữ ký cũ", "GET /api/auth/me với token đã sửa", "Lặp lại với payload thêm claim role:'platform_admin'"], "-",
      "Cả hai: 401 UNAUTHORIZED \"Vui lòng đăng nhập để tiếp tục\" (chữ ký HS256 không khớp). Quyền luôn tính lại ở server từ DB + PLATFORM_ADMIN_EMAILS, không đọc từ token.")
    a("JWT", "Token alg=none hoặc ký bằng secret khác bị từ chối",
      "Bảo mật", "Cao", RESET + "Có công cụ tự tạo JWT.",
      ["Tạo JWT header {alg:'none'} payload {sub:<id admin>,sid:'x',tv:0} không chữ ký", "Tạo JWT HS256 ký bằng secret 'sai-secret' cùng payload", "GET /api/admin/refunds với từng token"], "-",
      "Cả hai: 401 UNAUTHORIZED; không route nào chấp nhận token không ký hoặc ký sai.")
    a("JWT", "Refresh token không dùng làm Bearer và access token không dùng làm cookie refresh",
      "Bảo mật", "Trung bình", RESET + "Đăng nhập lấy access token và cookie refresh_token (HttpOnly).",
      ["Lấy giá trị refresh_token từ Set-Cookie (bằng request context)", "GET /api/auth/me với Authorization: Bearer <refresh token>", "POST /api/auth/refresh với cookie refresh_token=<access token>"], "-",
      "Bước 2: 401 UNAUTHORIZED (khác secret JWT_REFRESH_SECRET vs JWT_ACCESS_SECRET). Bước 3: 401 \"Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại\".")
    a("JWT", "Access token hết hạn bị từ chối kể cả với Platform Admin; refresh cấp token mới hoạt động lại",
      "Bảo mật", "Trung bình", "Môi trường thử: đặt ACCESS_TOKEN_TTL_MIN=1 trong backend/.env và restart BE (mặc định 15).",
      ["Đăng nhập admin, chờ > 1 phút", "GET /api/admin/refunds bằng access token cũ", "POST /api/auth/refresh (cookie) rồi gọi lại với accessToken mới"], "ACCESS_TOKEN_TTL_MIN=1",
      "Bước 2: 401 UNAUTHORIZED. Bước 3: token mới dùng được, GET /api/admin/refunds 200. (Thu hồi tức thì khi logout/đổi mật khẩu do module khác kiểm.)", pw="Một phần")
    a("CSRF", "CSRF: API dùng Bearer (không dựa vào cookie) nên form từ trang ngoài không thực hiện được thao tác thay đổi",
      "Bảo mật", "Cao", RESET + "member1 đã đăng nhập trên tab A (cookie refresh_token có Path=/api/auth, SameSite=Lax trong dev). Trang ngoài origin http://localhost:9999 (server tĩnh).",
      ["Trang ngoài chứa form POST tự submit tới http://localhost:4000/api/courses/photo/posts và fetch PATCH tới /api/auth/me", "Mở trang khi tab A còn đăng nhập", "Kiểm tra request ở tab Network và dữ liệu bài viết"], "form POST content=CSRF thử",
      "Request thiếu header Authorization: 401 UNAUTHORIZED, không tạo bài. Cookie refresh_token chỉ gửi kèm tới /api/auth/*; fetch cross-origin có credentials bị CORS chặn phản hồi (origin không nằm trong CORS_ORIGIN).", pw="Một phần")
    a("CSRF", "POST /api/auth/refresh từ origin lạ: không có header CORS nên script trang lạ không đọc được accessToken",
      "Bảo mật", "Trung bình", RESET + "Đã đăng nhập (có cookie refresh_token). Origin lạ http://evil.example (giả lập bằng header Origin).",
      ["POST /api/auth/refresh với Origin: http://evil.example và cookie hợp lệ", "Kiểm header phản hồi Access-Control-Allow-Origin"], "-",
      "Phản hồi không có Access-Control-Allow-Origin cho origin lạ → trình duyệt chặn script trang lạ đọc body. (Ghi chú: production dùng SameSite=None; Secure nên an toàn dựa vào whitelist CORS_ORIGIN — cần kiểm cấu hình thật.)", pw="Một phần")
    a("CORS", "CORS chỉ cho origin trong CORS_ORIGIN, kèm credentials; preflight hợp lệ trả 204",
      "Bảo mật", "Cao", RESET + "CORS_ORIGIN mặc định http://localhost:5173.",
      ["GET /api/courses với Origin: http://localhost:5173", "GET /api/courses với Origin: http://evil.example", "OPTIONS /api/courses/photo/posts với Origin 5173, Access-Control-Request-Method: POST, Access-Control-Request-Headers: authorization,content-type"], "-",
      "Origin hợp lệ: Access-Control-Allow-Origin: http://localhost:5173 và Access-Control-Allow-Credentials: true; origin lạ: không có Access-Control-Allow-Origin; preflight hợp lệ: 204 với Access-Control-Allow-Methods gồm POST và Allow-Headers gồm authorization.")
    # ------------------------------------------------------------------ UI theo vai trò
    a("Ẩn menu theo vai trò", "Ẩn/hiện mục điều hướng và nút quản trị theo vai trò ở khu cộng đồng photo",
      "Giao diện", "Cao", PRE,
      ["Lần lượt đăng nhập member1, mod, cadmin, owner, admin: mở /courses/photo/community, kiểm sidebar và thẻ thông tin bên phải", "Kiểm mục \"Kiểm duyệt\" ở sidebar", "Kiểm nút \"Cài đặt\" ở thẻ thông tin", "Kiểm mục \"Quản trị\" trong menu avatar"], "-",
      "member1: không có \"Kiểm duyệt\", \"Cài đặt\", \"Quản trị\". mod: có \"Kiểm duyệt\", không có \"Cài đặt\". cadmin: có \"Kiểm duyệt\" và \"Cài đặt\". owner: như cadmin + tab Vùng nguy hiểm trong Cài đặt. admin nền tảng: có \"Quản trị\" trong menu avatar. Dòng \"Vai trò của bạn\" đúng theo viewerRole.", pw="Có")
    a("Ẩn menu theo vai trò", "Trang Cài đặt (/courses/photo/community/cai-dat): member/mod/khách bị chặn, cadmin không sửa được giá",
      "Giao diện", "Cao", PRE,
      ["Mở thẳng /courses/photo/community/cai-dat với member1, mod, khách", "Mở với cadmin: kiểm tab Thông tin chung", "Mở với owner"], "-",
      "member1/mod: \"Bạn không có quyền truy cập\" (khách: yêu cầu đăng nhập); cadmin: sửa được tên/mô tả/ảnh/danh mục/ngôn ngữ nhưng giá và chế độ riêng tư chỉ hiển thị dạng chữ; owner: sửa được giá + riêng tư và có tab chuyển quyền/xóa cộng đồng; admin nền tảng thêm mục Khóa/Mở khóa.")
    a("Ẩn menu theo vai trò", "Menu \"…\" mỗi hàng ở tab Thành viên chỉ hiện hành động vai trò hiện tại được phép",
      "Giao diện", "Cao", PRE,
      ["Mở /courses/photo/community/thanh-vien với member1, mod, cadmin, owner", "Mở menu \"…\" trên hàng member3, hàng mod, hàng cadmin, hàng owner"], "-",
      "member1/mod: chỉ Xem hồ sơ, Sao chép @handle, Báo cáo thành viên (không có \"Báo cáo\" với chính mình). cadmin: thêm \"Đặt làm Điều hành viên/Thành viên\", \"Xóa khỏi cộng đồng\", \"Cấm thành viên\" chỉ trên hàng bậc thấp hơn (không có với cadmin khác/owner; không có \"Đặt làm Quản trị viên\"). owner: thêm \"Đặt làm Quản trị viên\"; hàng owner không có hành động quản trị.")
    a("Ẩn menu theo vai trò", "Doanh thu & rút tiền chỉ hiện với Owner/Platform Admin; member vào URL trực tiếp bị 403",
      "Giao diện", "Trung bình", RESET + "Tài khoản owner, member1 (paid-demo), admin.",
      ["owner: menu avatar ở topbar cộng đồng paid-demo → \"Doanh thu & rút tiền\"", "member1: kiểm menu", "member1: mở thẳng /courses/paid-demo/revenue-dashboard", "admin: mở cùng URL và thử gửi form rút tiền"], "-",
      "owner thấy mục và số liệu; member1 không thấy mục, vào URL trực tiếp nhận \"Chỉ chủ cộng đồng… mới xem được doanh thu\" (API 403); admin xem được số liệu, bấm rút tiền → API 403 \"Chỉ chủ cộng đồng mới được yêu cầu rút tiền\".")
    a("Ẩn menu theo vai trò", "Khách không dùng được thao tác cộng đồng: bị chuyển hướng đăng nhập, không gọi API thay đổi dữ liệu",
      "Giao diện", "Trung bình", RESET + "Chưa đăng nhập.",
      ["Mở /courses/photo (trang chi tiết công khai)", "Bấm \"Tham gia ngay\"", "Mở thẳng /courses/photo/community", "Mở /billing, /notifications, /messages"], "-",
      "Tham gia → chuyển /login; /courses/photo/community và các trang cá nhân → yêu cầu đăng nhập (không lộ dữ liệu cộng đồng); mọi request /api/* cần xác thực trả 401 nếu gọi tay.")


# =============================================================================================
# INTEG — API / Tích hợp & Concurrency
# =============================================================================================
def _integ(add):
    M, MN = "INTEG", "API / Tích hợp & Concurrency"

    def a(feat, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feat, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    SIG = ("Chữ ký: header x-sofin-signature = `t=<unix giây>,v1=<hex HMAC-SHA256 của \"<t>.<rawBody>\">` với secret PAYMENT_WEBHOOK_SECRET "
           "(mặc định dev-webhook-secret-change-me). Trong Playwright dùng node:crypto createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex'); gửi đúng chuỗi raw đã ký.")

    # ------------------------------------------------------------------ Concurrency: sự kiện
    a("Concurrency: RSVP", "Hai member RSVP song song vào chỗ cuối (seed-event-photo-limited): chỉ một người được giữ chỗ",
      "Tích hợp", "Cao",
      RESET + "Sự kiện seed-event-photo-limited: sức chứa 3, đã có 2 người (member2 + demo-photo-1) → còn đúng 1 chỗ. member1 và member3 đều chưa RSVP.",
      ["Lấy token member1 và member3", "Gửi đồng thời (Promise.all) POST /api/events/seed-event-photo-limited/rsvp bằng cả hai token", "GET /api/events/seed-event-photo-limited bằng owner"],
      "2 request song song",
      "Đúng một request 200 {rsvped:true, rsvpCount:3}; request còn lại 409 CONFLICT \"Sự kiện đã đủ số lượng đăng ký\"; rsvpCount cuối = 3 (không vượt sức chứa, kiểm sức chứa trong transaction khóa hàng sự kiện); không có lỗi 500.")
    a("Concurrency: RSVP", "Sự kiện đã đầy (seed-event-photo-full 2/2) và sự kiện đã qua (seed-event-photo-past) từ chối RSVP",
      "Chức năng", "Trung bình",
      RESET + "member1 đăng nhập.",
      ["POST /api/events/seed-event-photo-full/rsvp", "POST /api/events/seed-event-photo-past/rsvp"], "-",
      "Sự kiện đầy: 409 CONFLICT \"Sự kiện đã đủ số lượng đăng ký\"; sự kiện đã qua: 400 BAD_REQUEST \"Sự kiện đã diễn ra, không thể đăng ký\"; rsvpCount không đổi.")
    a("Concurrency: RSVP", "Cùng một user bấm RSVP 2 lần song song: không tạo bản ghi trùng, không 500",
      "Tích hợp", "Trung bình",
      RESET + "member1 đăng nhập; sự kiện seed-event-photo-limited còn chỗ (ghi lại rsvpCount ban đầu N).",
      ["Gửi đồng thời 2 POST /api/events/seed-event-photo-limited/rsvp bằng token member1", "GET lại sự kiện, đọc rsvpCount và danh sách RSVP của member1"], "-",
      "Không lỗi 500; rsvpCount cuối ∈ {N, N+1} (toggle: hai lệnh có thể triệt tiêu nhau) và member1 xuất hiện tối đa 1 lần trong danh sách RSVP (khóa unique). Điểm event_rsvp được cộng tối đa 1 lần.")
    a("Concurrency: RSVP", "Hủy RSVP tường minh (DELETE) idempotent khi gọi lặp",
      "Chức năng", "Thấp",
      RESET + "member2 đã RSVP seed-event-photo-limited.",
      ["DELETE /api/events/seed-event-photo-limited/rsvp", "DELETE lần 2"], "-",
      "Cả hai 200 {rsvped:false, rsvpCount}; lần 1 giảm rsvpCount 1 đơn vị, lần 2 giữ nguyên (chưa đăng ký vẫn 200).")

    # ------------------------------------------------------------------ Concurrency: thanh toán
    a("Concurrency: thanh toán", "Xác nhận thanh toán (confirm) 2 lần song song: chỉ tính tiền và xuất hóa đơn một lần",
      "Tích hợp", "Cao",
      RESET + "newbie đăng nhập; paid-demo giá $19. Tạo giao dịch: POST /api/courses/paid-demo/checkout {method:'stripe'} → lấy payment id (status pending).",
      ["Gửi đồng thời 2 POST /api/payments/<id>/confirm bằng token newbie", "GET /api/me/payments", "GET /api/payments/<id>/invoice"], "method=stripe",
      "Cổng chỉ bị trừ 1 lần (MockGateway chỉ ghi 1 charge); giao dịch status=succeeded, chỉ có 1 invoiceNumber dạng INV-<năm>-<6 số> (không trùng/không hở dãy); newbie trở thành member paid-demo đúng một lần, có duy nhất 1 Subscription; không có 500.")
    a("Concurrency: thanh toán", "Idempotency-Key: gửi checkout 2 lần với cùng key trả về cùng một giao dịch",
      "Tích hợp", "Cao",
      RESET + "newbie đăng nhập.",
      ["POST /api/courses/paid-demo/checkout {method:'stripe'} với header Idempotency-Key: key-abc-1", "Lặp lại đúng request", "GET /api/me/payments"], "Idempotency-Key: key-abc-1",
      "Cả hai 201 với cùng payment.id; danh sách giao dịch của newbie chỉ có 1 dòng pending cho lần checkout này; giá lấy từ server ($19 = 1900 cent) dù body có gửi amountCents khác.")
    a("Concurrency: thanh toán", "Idempotency-Key dùng lại cho khóa học khác bị 409",
      "Chức năng", "Trung bình",
      RESET + "newbie đã checkout paid-demo với key-abc-1 (case trước).",
      ["POST /api/courses/yt/checkout {method:'stripe'} với Idempotency-Key: key-abc-1"], "yt là cộng đồng có phí",
      "409 CONFLICT, message \"Idempotency-Key này đã được dùng cho giao dịch khác\"; không tạo giao dịch mới cho yt.")
    a("Concurrency: thanh toán", "Hai checkout song song cùng Idempotency-Key: DB chỉ giữ một giao dịch",
      "Tích hợp", "Cao",
      RESET + "member ngoài paid-demo (đăng ký user mới).",
      ["Gửi đồng thời 2 POST /api/courses/paid-demo/checkout cùng header Idempotency-Key: race-1", "So sánh payment.id hai response", "GET /api/me/payments"], "-",
      "Cả hai 201 và cùng payment.id (bên thua unique (userId,key) rollback rồi trả giao dịch của bên thắng); chỉ 1 giao dịch pending trong DB.")
    a("Concurrency: thanh toán", "Dùng thử (trial) 2 lần song song: chỉ một lần thành công",
      "Tích hợp", "Trung bình",
      RESET + "user mới chưa từng dùng thử paid-demo.",
      ["Gửi đồng thời 2 POST /api/courses/paid-demo/trial", "GET /api/me/subscriptions"], "TRIAL_DAYS=7 (giá trị tạm)",
      "Một request 201 (Subscription trialing, currentPeriodEnd = now + 7 ngày), một request 409 CONFLICT \"Bạn đã dùng thử cộng đồng này rồi\" hoặc \"Bạn đã tham gia cộng đồng này rồi\"; chỉ 1 subscription.")
    a("Concurrency: thanh toán", "Hai lệnh rút tiền song song không vượt số dư (khóa hàng Course)",
      "Tích hợp", "Cao",
      RESET + "owner đăng nhập. Đọc availableBalanceCents = B từ GET /api/courses/paid-demo/revenue; chọn số tiền X sao cho 5000 <= X <= B nhưng 2X > B (điều chỉnh theo B thực tế, ngưỡng tối thiểu $50 là giá trị tạm).",
      ["Gửi đồng thời 2 POST /api/courses/paid-demo/payouts với amountCents = X", "GET /api/courses/paid-demo/revenue"], "amountCents = X; method bank VCB/0123456789",
      "Một request 201 (status requested, số TK ****6789), một request 400 BAD_REQUEST \"Số tiền rút vượt quá số dư khả dụng\"; availableBalanceCents cuối = B - X (không âm).")
    a("Concurrency: thanh toán", "Hoàn tiền: hai admin duyệt song song cùng yêu cầu chỉ hoàn một lần",
      "Tích hợp", "Cao",
      RESET + "Yêu cầu seed-refund-pending. Hai phiên đăng nhập admin@ (hai token khác nhau).",
      ["Gửi đồng thời 2 PATCH /api/admin/refunds/seed-refund-pending {action:'approve'}", "GET /api/admin/refunds?status=approved"], "-",
      "Một 200 (approved), một 409 \"Yêu cầu này đã được xử lý\"; giao dịch chỉ ở trạng thái refunded một lần với refundedCents = giá gói; số tiền không bị hoàn 2 lần.")

    # ------------------------------------------------------------------ Concurrency: cộng đồng
    a("Concurrency: cộng đồng", "Hai admin duyệt/từ chối cùng một yêu cầu tham gia song song: chỉ một quyết định có hiệu lực",
      "Tích hợp", "Cao",
      RESET + "Yêu cầu pending của newbie ở private-demo (id từ GET /api/courses/private-demo/join-requests?status=pending bằng owner). owner và admin@ đăng nhập.",
      ["Đồng thời: owner POST /api/join-requests/<id>/approve và admin POST /api/join-requests/<id>/reject", "GET lại yêu cầu và danh sách thành viên private-demo"], "-",
      "Một request 200, request kia 409 CONFLICT \"Yêu cầu này đã được xử lý\"; trạng thái cuối khớp request thắng (approved → newbie có đúng 1 Enrollment; rejected → newbie không có); newbie chỉ nhận 1 thông báo kết quả.")
    a("Concurrency: cộng đồng", "Lời mời 1 lượt: hai người nhận song song, chỉ một người vào được",
      "Tích hợp", "Cao",
      RESET + "owner tạo lời mời cho private-demo: POST /api/courses/private-demo/invites {maxUses:1} → code C. Hai user mới U1, U2 đăng nhập.",
      ["Đồng thời U1, U2 POST /api/invites/C/accept", "GET /api/courses/private-demo/invites bằng owner"], "maxUses=1",
      "Một request 200 {courseId:\"private-demo\", joined:true}, request kia 410 với error.code=INVITE_EXHAUSTED \"Lời mời đã hết lượt sử dụng\"; usedCount=1 (không vượt maxUses); cộng đồng chỉ có thêm 1 thành viên.")
    a("Concurrency: cộng đồng", "Cùng một user nhận cùng lời mời 2 lần song song (double-click): usedCount chỉ tăng 1",
      "Tích hợp", "Trung bình",
      RESET + "Lời mời DEMO-VALID (private-demo, tối đa 5 lượt, usedCount=0); user mới U3 đăng nhập.",
      ["Đồng thời 2 POST /api/invites/DEMO-VALID/accept bằng token U3", "GET /api/courses/private-demo/invites bằng owner"], "-",
      "Một request 200 joined:true, request kia 409 CONFLICT \"Bạn đã là thành viên của cộng đồng này\" (hoặc lượt dùng bị hoàn lại nếu xử lý thất bại); usedCount của DEMO-VALID = 1, không phải 2.")
    a("Concurrency: cộng đồng", "Hai user đăng ký cùng một email song song: một thành công, một 409",
      "Tích hợp", "Trung bình",
      RESET + "Chưa có tài khoản với email race@sofinhub.test.",
      ["Đồng thời 2 POST /api/auth/register cùng email race@sofinhub.test, mật khẩu Passw0rd!x", "Đăng nhập bằng email đó"], "email=race@sofinhub.test",
      "Một request 200 (có accessToken), request kia 409 CONFLICT \"Email này đã được đăng ký\" (unique ở DB, P2002 được map); DB chỉ có 1 user.")
    a("Concurrency: cộng đồng", "Tin nhắn gửi liên tiếp song song giữ thứ tự và id không trùng (Message.seq)",
      "Tích hợp", "Trung bình",
      RESET + "member1 đăng nhập; hội thoại seed-conv-member1-member2; NODE_ENV≠test nên rate limit 20 tin/phút áp dụng — gửi <= 10 tin.",
      ["Gửi đồng thời 10 POST /api/conversations/seed-conv-member1-member2/messages với content 'm1'..'m10'", "GET /api/conversations/seed-conv-member1-member2/messages?limit=30"], "10 tin song song",
      "Cả 10 request 201 với id khác nhau; GET trả 10 tin mới sắp xếp cũ→mới theo seq không thiếu/không trùng; unreadCount phía member2 tăng đúng 10.")

    # ------------------------------------------------------------------ Phiên
    a("Concurrency: phiên đăng nhập", "Ba request refresh song song cùng một refresh token: chỉ một thành công, không sinh phiên thừa",
      "Bảo mật", "Cao",
      RESET + "Đăng nhập member1 trong một BrowserContext để có cookie refresh_token; GET /api/auth/sessions ghi lại số phiên S.",
      ["Gửi đồng thời 3 POST /api/auth/refresh với cùng cookie", "GET /api/auth/sessions bằng access token của request thành công"], "3 request song song",
      "Đúng một request 200 với accessToken mới; hai request còn lại 401 \"Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại\" (xoay token bằng updateMany có điều kiện); số phiên vẫn là S (cùng sid, không tạo phiên mới).")

    # ------------------------------------------------------------------ Webhook
    a("Webhook thanh toán", "Webhook chữ ký hợp lệ payment.succeeded: giao dịch pending chuyển succeeded, cấp quyền, phát hành hóa đơn",
      "Tích hợp", "Cao",
      RESET + "newbie đăng nhập, tạo giao dịch pending: POST /api/courses/paid-demo/checkout {method:'stripe'} → paymentId. " + SIG,
      ["Dựng raw `{\"id\":\"evt_1\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"<id>\"}}` và ký", "POST /api/payments/webhook (không Bearer) với header x-sofin-signature và đúng raw body", "newbie: GET /api/courses/paid-demo/subscription"],
      "event id evt_1",
      "200 {data:{received:true}} (hoặc {received:true}); giao dịch succeeded, newbie enrolled=true, có invoiceNumber INV-<năm>-<6 số>. Gọi confirm sau đó không tạo hóa đơn thứ hai (webhook đến trước khi trình duyệt quay lại vẫn đúng trạng thái).", pw="Một phần")
    a("Webhook thanh toán", "Webhook trùng event id: trả 200 duplicate, không xử lý lần hai",
      "Tích hợp", "Cao",
      "Đã gửi webhook evt_1 thành công ở case trước. " + SIG,
      ["Gửi lại đúng raw body evt_1 (ký lại với t mới)", "GET /api/me/payments của newbie"], "event id evt_1",
      "200 {received:true, duplicate:true}; không có giao dịch/hóa đơn/subscription mới (WebhookEvent.eventId là PK).", pw="Một phần")
    a("Webhook thanh toán", "Webhook chữ ký sai, thiếu header hoặc timestamp lệch > 300 giây bị từ chối 400 chung chung",
      "Bảo mật", "Cao",
      "Có raw body hợp lệ. " + SIG,
      ["POST /api/payments/webhook với v1 sai (đổi 1 ký tự)", "POST không có header x-sofin-signature", "POST với t = hiện tại - 400s (ký đúng)", "POST với t = hiện tại + 400s (ký đúng)"], "-",
      "Cả 4: 400 BAD_REQUEST, message \"Yêu cầu không hợp lệ\" (không nêu lý do cụ thể để không lộ chi tiết); không có thay đổi dữ liệu.", pw="Một phần")
    a("Webhook thanh toán", "Chữ ký tính trên raw body: đổi khoảng trắng/thứ tự khóa JSON sau khi ký làm chữ ký sai",
      "Bảo mật", "Trung bình",
      SIG,
      ["Ký raw A = `{\"id\":\"evt_2\",\"type\":\"payment.succeeded\",\"data\":{}}`", "Gửi body B = cùng nội dung nhưng thêm một khoảng trắng sau dấu phẩy với chữ ký của A"], "-",
      "400 BAD_REQUEST \"Yêu cầu không hợp lệ\" (app giữ rawBody CHỈ cho /api/payments/webhook và HMAC tính trên bytes gốc); gửi đúng raw A thì 200.", pw="Một phần")
    a("Webhook thanh toán", "Webhook loại sự kiện lạ hoặc payment không tồn tại trả 200 ignored (cổng không retry vô hạn)",
      "Tích hợp", "Trung bình",
      SIG,
      ["Ký và gửi {\"id\":\"evt_3\",\"type\":\"charge.unknown\",\"data\":{}}", "Ký và gửi {\"id\":\"evt_4\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"khong-co\"}}"], "-",
      "Cả hai 200 {received:true, ignored:true}; không thay đổi dữ liệu; body không phải JSON (dù ký đúng) → 400 \"Yêu cầu không hợp lệ\".", pw="Một phần")
    a("Webhook thanh toán", "Webhook payment.refunded tạo yêu cầu hoàn tiền chờ duyệt cho admin",
      "Tích hợp", "Trung bình",
      "Giao dịch succeeded của member1: seed-pay-member1-b. " + SIG,
      ["Ký và gửi {\"id\":\"evt_5\",\"type\":\"payment.refunded\",\"data\":{\"paymentId\":\"seed-pay-member1-b\"}}", "admin: GET /api/admin/refunds?status=pending"], "-",
      "200 {received:true}; có RefundRequest mới cho seed-pay-member1-b, lý do \"Hoàn tiền từ cổng thanh toán\", status pending (chờ Platform Admin); gửi lại evt_5 → duplicate.", pw="Một phần")

    # ------------------------------------------------------------------ SSE
    a("Realtime: SSE", "Vé SSE dùng một lần và hết hạn sau 30 giây; thiếu xác thực trả 401",
      "Bảo mật", "Cao",
      RESET + "member1 đăng nhập.",
      ["POST /api/notifications/stream-ticket → ticket T", "Mở GET /api/notifications/stream?ticket=T (kết nối 1)", "Mở lại GET ...stream?ticket=T lần 2", "GET /api/notifications/stream không token/ticket", "Xin ticket mới, chờ > 30 giây rồi dùng"], "-",
      "Xin vé: 201 {ticket, expiresInSec:30}; kết nối 1: 200 Content-Type text/event-stream, có `retry: 5000`, sau đó heartbeat `: heartbeat` mỗi 25 giây; kết nối 2 dùng lại vé, không token, vé quá 30s: 401 UNAUTHORIZED.", pw="Một phần")
    a("Realtime: SSE", "SSE thông báo: hành động của người khác đẩy thông báo tới tab đang mở, không cần tải lại",
      "Tích hợp", "Cao",
      RESET + "Hai context: member1 mở /courses/photo/community (chuông thông báo), member2 đăng nhập cửa sổ khác.",
      ["member1 tạo bài mới (POST /api/courses/photo/posts), member2 thích bài đó (POST /api/posts/<id>/like)", "Quan sát chuông của member1", "Bấm toast"], "-",
      "Trong vài giây badge chuông tăng và hiện toast \"... đã thích bài viết của bạn\" (event: notification); bấm toast mở link bài và đánh dấu đã đọc; không cần F5.", pw="Một phần")
    a("Realtime: SSE", "SSE tự kết nối lại sau khi BE khởi động lại và bù dữ liệu",
      "Tích hợp", "Trung bình",
      RESET + "member1 đang mở /courses/photo/community; có thể dừng/khởi động BE (`npm run dev`).",
      ["Tắt BE khoảng 10 giây", "Trong lúc đó member2 tạo thông báo (chờ BE bật lại rồi thao tác)", "Bật BE lại, quan sát Network"], "-",
      "FE nối lại với backoff 1s, 2s, 4s… tối đa 30s; mỗi lần nối lại xin vé mới (POST stream-ticket); sau khi nối lại danh sách/badge được tải lại từ GET /api/notifications (không có replay sự kiện bị lỡ); không lỗi trắng.", pw="Một phần")
    a("Realtime: SSE", "SSE tin nhắn: hai tab của người nhận đều nhận tin, người gửi cũng thấy ở tab khác",
      "Tích hợp", "Trung bình",
      RESET + "member1 mở 2 tab /messages/seed-conv-member1-member2; member2 mở 1 tab cùng hội thoại.",
      ["member2 gửi \"Xin chào SSE\"", "Quan sát 2 tab của member1", "member1 gửi từ tab 1, quan sát tab 2"], "-",
      "Cả hai tab member1 nhận tin ngay (event: message); tin của member1 gửi ở tab 1 xuất hiện ở tab 2; badge chưa đọc của member1 giảm khi mở hội thoại (POST .../read); đóng tab thì kết nối SSE được dọn.", pw="Một phần")
    a("Realtime: SSE", "Fallback ?access_token= cho SSE thông báo còn hoạt động (rủi ro lộ token trong URL/log)",
      "Bảo mật", "Trung bình",
      RESET + "Access token hợp lệ của member1. Trạng thái: docs ghi 'chưa chốt có bỏ ?access_token= hay không'.",
      ["GET /api/notifications/stream?access_token=<token>", "Đăng xuất (thu hồi) rồi gọi lại với token cũ"], "-",
      "Lần 1: 200 event-stream (hành vi hiện tại, giá trị tạm / chưa chốt); sau khi phiên bị thu hồi: 401 UNAUTHORIZED. Ghi nhận rủi ro token nằm trong URL — bản chốt nên dùng ticket.", pw="Một phần")

    # ------------------------------------------------------------------ Postgres / rollback
    a("Postgres: nhất quán", "Báo cáo ban_member thất bại (đích là owner) không làm đổi trạng thái báo cáo hay tạo CommunityBan",
      "Tích hợp", "Cao",
      RESET + "member2 báo cáo thành viên owner (báo cáo R). mod đăng nhập.",
      ["PATCH /api/reports/R {action:'ban_member'}", "GET /api/courses/photo/reports?status=open", "cadmin: GET /api/courses/photo/bans"], 'Body {"action":"ban_member"}',
      "403 \"Không thể cấm chủ cộng đồng\"; báo cáo R vẫn open (không resolved), resolvedBy/resolvedAt rỗng; danh sách ban không có owner; owner vẫn trong danh sách thành viên.")
    a("Postgres: nhất quán", "Mất kết nối Postgres giữa request: API trả 500 gọn, không lộ chi tiết, hồi phục sau khi DB lên lại",
      "Tích hợp", "Trung bình",
      "Có quyền chạy `docker compose stop` cho container Postgres (cổng 5435) trong môi trường dev.",
      ["Đăng nhập member1 rồi dừng container Postgres", "GET /api/courses/photo/posts", "GET /health", "Bật lại Postgres, gọi lại GET /api/courses/photo/posts"], "-",
      "Khi DB chết: 500 INTERNAL_ERROR (dev: message lỗi Prisma; production: \"Lỗi hệ thống\"), không stack trace trong body; GET /health trả 503 {status:'db_unavailable'} (health nay kiểm DB; trước đây luôn 200); sau khi DB lên lại /health trả 200 {status:'ok'}; sau khi DB lên lại request thành công 200 mà không cần restart BE.", pw="Không")
    a("Postgres: nhất quán", "Giao dịch thanh toán + hóa đơn + cấp quyền cùng transaction: không có giao dịch succeeded thiếu hóa đơn",
      "Tích hợp", "Cao",
      "Sau khi chạy nhiều lần confirm/webhook song song ở các case trước; có quyền truy vấn DB (docker exec psql hoặc prisma studio).",
      ["SELECT count(*) FROM \"Payment\" WHERE status IN ('succeeded','refunded') AND \"invoiceNumber\" IS NULL", "SELECT \"invoiceNumber\", count(*) FROM \"Payment\" GROUP BY 1 HAVING count(*) > 1 AND \"invoiceNumber\" IS NOT NULL", "Kiểm InvoiceSequence.lastNumber khớp số hóa đơn lớn nhất của năm"], "-",
      "Truy vấn 1 trả 0; truy vấn 2 không có dòng nào (hóa đơn không trùng); dãy hóa đơn liên tục không hở. Mọi giao dịch succeeded đều có Enrollment tương ứng.", pw="Không")

    # ------------------------------------------------------------------ Migration / seed / health
    a("Migration & seed", "Chạy `npm run db:seed` hai lần liên tiếp không nhân đôi dữ liệu",
      "Tích hợp", "Cao",
      "Postgres đã migrate. Chạy `npm run db:reset` một lần; có psql/prisma studio để đếm bản ghi.",
      ["Đếm: SELECT count(*) FROM \"User\", \"Course\", \"Post\", \"Comment\", \"Event\", \"Report\", \"Invite\", \"JoinRequest\", \"Enrollment\", \"Payment\"", "Chạy `cd backend && npm run db:seed` thêm lần 2 (không reset)", "Đếm lại và so sánh", "Đăng nhập lại member1 bằng " + PW],
      "-",
      "Số bản ghi mỗi bảng không đổi giữa hai lần đếm (createMany skipDuplicates/upsert); seed-report-photo-open vẫn đúng 1 bản ghi; mã mời DEMO-VALID vẫn 1; đăng nhập các tài khoản seed chính (>= 9; db:seed nay còn thêm nhân viên admin đợt 3) vẫn được; không lỗi unique violation.", pw="Không")
    a("Migration & seed", "Chạy `npm run db:deploy` khi không còn migration mới là no-op, không lỗi",
      "Tích hợp", "Trung bình",
      "DB đã áp mọi migration.",
      ["Chạy `cd backend && npm run db:deploy` hai lần"], "-",
      "Cả hai lần thoát mã 0 với thông báo không còn migration cần áp dụng (No pending migrations); schema và dữ liệu không đổi; BE vẫn khởi động bình thường.", pw="Không")
    a("Migration & seed", "db:reset đưa dữ liệu về trạng thái ban đầu: báo cáo seed lại ở trạng thái open",
      "Tích hợp", "Trung bình",
      "Đã xử lý báo cáo seed-report-photo-open (dismiss) ở case ADMIN trước đó.",
      ["Chạy `cd backend && npm run db:reset`", "mod: GET /api/courses/photo/reports?status=open"], "-",
      "seed-report-photo-open trở lại status=open, note/resolvedBy rỗng; tài khoản test tự tạo bị xóa; các tài khoản seed chính (>= 9; db:seed nay còn thêm nhân viên admin đợt 3) đăng nhập được với " + PW + ". (Lưu ý: db:seed thường KHÔNG khôi phục dữ liệu đã bị đổi trạng thái — chỉ db:reset.)", pw="Không")
    a("Health & vận hành", "GET /health công khai trả status ok và uptime khi DB sống (không nằm dưới /api)",
      "Tích hợp", "Trung bình",
      "BE chạy :4000, Postgres sống (health nay chạy SELECT 1; DB chết -> 503 {status:'db_unavailable'}, xem case Postgres mất kết nối).",
      ["GET http://localhost:4000/health không token", "GET http://localhost:4000/api/health"], "-",
      "/health: 200 {status:\"ok\", uptime:<số giây>} kèm header helmet; /api/health: 404 NOT_FOUND \"Không tìm thấy GET /api/health\". Dockerfile có HEALTHCHECK dùng endpoint này (30s/3s).")
    a("Health & vận hành", "GET /api/dev/outbox chỉ có ngoài production và trả thư đặt lại/xác thực mật khẩu",
      "Bảo mật", "Cao",
      "NODE_ENV=development. Có thể chạy thêm BE với NODE_ENV=production (cần JWT_*_SECRET không bắt đầu bằng 'dev-').",
      ["POST /api/auth/forgot-password {email:'member2@sofinhub.test'}", "GET /api/dev/outbox?to=member2@sofinhub.test", "Chạy BE production rồi GET /api/dev/outbox"], "-",
      "Dev: 200 mảng thư có subject, text/html chứa link {FRONTEND_URL}/reset-password?token=... (token không bao giờ nằm trong response forgot-password). Production: route không tồn tại → 404 NOT_FOUND (theo docs identity.md). Ghi nhận: chỉ đúng khi cấu hình production thật.", pw="Không")
    a("Health & vận hành", "Production từ chối khởi động nếu JWT secret còn giá trị mặc định dev-*",
      "Bảo mật", "Cao",
      "Có thể chạy BE với NODE_ENV=production.",
      ["Đặt NODE_ENV=production giữ JWT_ACCESS_SECRET mặc định 'dev-access-secret-change-me'", "Chạy `npm run build` rồi `node dist/index.js`", "Đặt secret riêng và chạy lại"], "-",
      "Lần 1: tiến trình thoát mã 1 và in \"JWT_ACCESS_SECRET/JWT_REFRESH_SECRET phải được đặt riêng khi NODE_ENV=production\"; lần 2 khởi động bình thường.", pw="Không")


# =============================================================================================
# SEC — Bảo mật & Yêu cầu phi chức năng
# =============================================================================================
def _sec(add):
    M, MN = "SEC", "Bảo mật & Yêu cầu phi chức năng"

    def a(feat, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feat, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    XSS = "<img src=x onerror=alert('xss')>"
    NOTE_XSS = ("Playwright: đăng ký page.on('dialog', ...) để bắt mọi alert/confirm — test đạt khi KHÔNG có dialog nào bật lên. "
                "Ghi chú kiến trúc: BE lưu chuỗi nguyên bản (chỉ tin nhắn từ chối thẻ HTML), FE render bằng text node của React nên không chạy script. ")

    # ------------------------------------------------------------------ XSS nhiều điểm
    a("XSS", "Tên hồ sơ chứa thẻ HTML: lưu nguyên văn, hiển thị dạng chữ ở mọi nơi, không chạy script",
      "Bảo mật", "Cao", RESET + NOTE_XSS + "Đăng nhập member2@sofinhub.test.",
      ["PATCH /api/auth/me {firstName:\"" + XSS + "\"}", "Mở /users/<id member2>, tab Thành viên của photo, bảng xếp hạng, chuông thông báo của member1 sau khi member2 thích bài", "Trả tên về 'Mai'"], "firstName = " + XSS,
      "PATCH 200 (tên lưu nguyên văn, giới hạn 80 ký tự); mọi nơi hiển thị tên thấy đúng chuỗi ký tự `<img src=x ...>` dạng chữ, không có thẻ img thật trong DOM, không có dialog alert.")
    a("XSS", "Nội dung bài viết chứa <script> và HTML: hiển thị chữ thô, không render thẻ",
      "Bảo mật", "Cao", RESET + NOTE_XSS + "Đăng nhập member1.",
      ["POST /api/courses/photo/posts {content:\"<script>alert(1)</script><b>đậm</b><a href='javascript:alert(2)'>bấm</a>\"}", "Mở /courses/photo/community, xem bài mới ở bảng tin và ở trang chi tiết bài", "Chia sẻ bài (GET /api/posts/<id>/share)"], "content có script/b/a",
      "201, content được lưu nguyên văn; bảng tin hiển thị đúng chuỗi thô, không có phần tử <script>, <b>, <a> trong DOM từ nội dung; không có dialog; excerpt của share cũng là chữ thô.")
    a("XSS", "Bình luận chứa HTML/JS: không thực thi ở danh sách bình luận và thông báo",
      "Bảo mật", "Cao", RESET + NOTE_XSS + "member2 đăng nhập; bài seed-post-photo-m1-image.",
      ["POST /api/posts/seed-post-photo-m1-image/comments {content:\"" + XSS + "\"}", "member1: mở chuông thông báo (body \"...đã bình luận: <img ...\") và trang bài", "mod: mở hàng đợi kiểm duyệt sau khi member3 báo cáo bình luận này"], "content = " + XSS,
      "201; chỗ nào hiển thị bình luận (danh sách, thông báo post_commented, targetExcerpt trong hàng đợi kiểm duyệt) đều là chữ thô; không dialog alert; không có thẻ img thật.")
    a("XSS", "Tin nhắn trực tiếp: BE từ chối thẻ HTML (400) nhưng cho phép dấu < > thông thường",
      "Bảo mật", "Cao", RESET + "member1 đăng nhập; hội thoại seed-conv-member1-member2.",
      ["POST /api/conversations/seed-conv-member1-member2/messages {content:\"<script>alert(1)</script>\"}", "{content:\"<b>x</b>\"}", "{content:\"1 < 2 > 0\"}", "{content:\"<3 nhớ bạn\"}"], "-",
      "Hai lần đầu: 400 BAD_REQUEST \"Tin nhắn không được chứa mã HTML\"; hai lần sau: 201 (regex chỉ bắt thẻ `<tên ...>`); tin 201 hiển thị dạng chữ.")
    a("XSS", "Tên cộng đồng chứa HTML: hiển thị chữ thô ở danh sách, tiêu đề, hộp thoại xác nhận xóa và thông báo",
      "Bảo mật", "Cao", RESET + NOTE_XSS + "newbie đăng nhập.",
      ["POST /api/communities {title:\"<svg onload=alert(1)>\", description:\"m\", category:<id hợp lệ>, priceUsd:0, visibility:\"public\"}", "Mở trang chủ (thẻ cộng đồng), /courses/<slug>, topbar cộng đồng", "Cài đặt → Vùng nguy hiểm → hộp thoại Xóa (gõ tên)"], "title = <svg onload=alert(1)>",
      "201; slug tạo từ tên đã bỏ ký tự đặc biệt (dạng svg-onload-alert-1); mọi nơi hiển thị tên là chữ thô; hộp thoại xóa yêu cầu gõ đúng chuỗi ký tự; không dialog alert.")
    a("XSS", "Snippet tìm kiếm: server trả Segment {text, match}, FE render text node — chuỗi <script> không chạy",
      "Bảo mật", "Cao", RESET + NOTE_XSS + "member1 đăng nhập; đã có bài chứa chuỗi `<b>x</b>` (POST bài mới).",
      ["GET /api/search?q=<b>x</b>", "Mở /search?q=%3Cb%3Ex%3C%2Fb%3E và ô tìm kiếm topbar (gợi ý)", "Tìm q=<script>"], "q = <b>x</b>",
      "200; data[].snippet là mảng Segment {text, match} (không có HTML trong JSON); giao diện hiển thị chữ thô với đoạn khớp bôi đậm bằng <mark> do FE tạo; không có dialog; q < 2 ký tự → 400 VALIDATION_ERROR.")
    a("XSS", "Thẻ (tag) và lựa chọn poll chứa HTML: hiển thị chữ thô",
      "Bảo mật", "Trung bình", RESET + NOTE_XSS + "member1 đăng nhập.",
      ["POST /api/courses/photo/posts {content:'poll xss', tags:[\"#<img src=x onerror=alert(1)>\"], poll:{options:[\"" + XSS + "\",\"B\"]}}", "Xem bài ở bảng tin, lọc theo thẻ, bình chọn"], "tag ≤ 30 ký tự",
      "201; thẻ và lựa chọn poll là chữ thô; bộ lọc thẻ (`tag` query) hoạt động; không dialog. Thẻ > 30 ký tự → 400 VALIDATION_ERROR.")
    a("XSS", "URL độc hại trong imageUrl của bài viết / avatar / website: schema từ chối với 400",
      "Bảo mật", "Cao", RESET + "member1 đăng nhập.",
      ["POST /api/courses/photo/posts {content:'x', imageUrl:'javascript:alert(1)'}", "PATCH /api/auth/me {avatarUrl:'javascript:alert(1)'}", "PATCH /api/auth/me {website:'javascript:alert(1)'}", "PATCH /api/auth/me {avatarUrl:'/files/../etc/passwd'}"], "URL javascript:",
      "avatarUrl javascript: → 400 \"Ảnh đại diện phải là URL http/https hoặc đường dẫn /files/...\"; website javascript: → 400 \"Website phải là URL http/https hợp lệ\"; avatarUrl có `..` → 400. imageUrl của bài javascript: → 400 VALIDATION_ERROR (đã sửa: schema thêm refine chỉ nhận http/https, message 'Liên kết ảnh phải là http/https'; trước đây 201). Không có bài nào được tạo; không có dialog hay thẻ nguy hiểm trong DOM.")
    a("XSS", "Email hệ thống: tên người dùng được escape HTML trong thư đặt lại mật khẩu/xác thực email",
      "Bảo mật", "Trung bình", RESET + "Đăng ký user tên `<b>Evil</b>`, email xss1@sofinhub.test.",
      ["POST /api/auth/register {firstName:'<b>Evil</b>', lastName:'X', email:'xss1@sofinhub.test', password:'Passw0rd!x'}", "POST /api/auth/send-verification (Bearer) và POST /api/auth/forgot-password", "GET /api/dev/outbox?to=xss1@sofinhub.test"], "firstName = <b>Evil</b>",
      "Trường html của thư chứa `&lt;b&gt;Evil&lt;/b&gt;` (đã escape), không chứa thẻ <b> thật; link có dạng {FRONTEND_URL}/verify-email?token=... hoặc /reset-password?token=...")

    # ------------------------------------------------------------------ Header, CORS
    a("Header bảo mật", "Phản hồi API có header helmet và không lộ X-Powered-By",
      "Bảo mật", "Cao", "BE chạy :4000.",
      ["GET http://localhost:4000/api/courses", "Đọc toàn bộ response headers", "GET /health và GET /api/khong-co (404) cũng kiểm tra"], "-",
      "Có X-Content-Type-Options: nosniff, Strict-Transport-Security, X-Frame-Options: SAMEORIGIN, Content-Security-Policy (mặc định helmet), Cross-Origin-Opener-Policy, Referrer-Policy: no-referrer; KHÔNG có X-Powered-By; header này có cả ở phản hồi lỗi 404.")
    a("Header bảo mật", "Phản hồi nén (compression) không làm mất header bảo mật; JSON có Content-Type chuẩn",
      "Bảo mật", "Thấp", "BE chạy :4000.",
      ["GET /api/courses với Accept-Encoding: gzip", "Kiểm Content-Encoding và Content-Type"], "-",
      "Content-Type: application/json; charset=utf-8; body gzip khi đủ lớn; các header helmet vẫn có.")
    a("Header bảo mật", "Cookie refresh_token có HttpOnly, Path=/api/auth, SameSite=Lax (dev), Secure/None chỉ khi production",
      "Bảo mật", "Cao", RESET + "Đăng nhập member1 bằng request context để đọc Set-Cookie.",
      ["POST /api/auth/login, đọc header Set-Cookie", "Trong trình duyệt: page.evaluate(() => document.cookie)", "POST /api/auth/logout rồi xem cookie bị xóa"], "-",
      "Set-Cookie: refresh_token=...; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=30 ngày (2592000). document.cookie không chứa refresh_token. Cờ Secure đặt ở MỌI môi trường trừ NODE_ENV=development (nên không có Secure trên localhost dev); production: SameSite=None; Secure (auth.routes.ts setRefreshCookie). Logout xóa cookie (clearCookie cùng path).", pw="Một phần")
    a("Header bảo mật", "CORS: chỉ origin được cấu hình nhận header Access-Control-Allow-Origin",
      "Bảo mật", "Cao", "CORS_ORIGIN mặc định http://localhost:5173.",
      ["GET /api/courses với Origin: http://localhost:5173", "GET /api/courses với Origin: http://evil.example", "OPTIONS /api/auth/login với Origin evil + Access-Control-Request-Method: POST"], "-",
      "Origin 5173: có Access-Control-Allow-Origin: http://localhost:5173 và Allow-Credentials: true, Vary: Origin; origin lạ: không có Allow-Origin (trình duyệt chặn đọc); preflight từ origin lạ không có Allow-Origin.")
    a("Header bảo mật", "CORS_ORIGIN nhiều giá trị ngăn cách bằng dấu phẩy, chuẩn hóa khoảng trắng",
      "Bảo mật", "Trung bình", "Có quyền sửa backend/.env.",
      ["Đặt CORS_ORIGIN=http://localhost:5173, https://app.sofinhub.test rồi restart", "GET /api/courses với từng Origin trong danh sách và một origin ngoài"], "-",
      "Cả hai origin trong danh sách nhận Allow-Origin đúng bằng origin gửi lên (có khoảng trắng sau dấu phẩy vẫn khớp nhờ trim); origin ngoài danh sách không nhận.", pw="Không")

    # ------------------------------------------------------------------ Rate limit
    a("Rate limit", "Giới hạn đăng nhập: từ lần đăng nhập SAI thứ 11 trong 15 phút từ một IP trả 429 TOO_MANY_REQUESTS",
      "Bảo mật", "Cao", "BE chạy dev; cửa sổ 15 phút, tối đa 10 lần đăng nhập THẤT BẠI / IP (loginLimiter dùng skipSuccessfulRequests: lần đăng nhập đúng không bị đếm, nên đăng nhập đúng liên tiếp không dính 429). Nên chạy case này CUỐI phiên test hoặc restart BE để reset bộ đếm.",
      ["Gửi 10 POST /api/auth/login với mật khẩu sai cho member1@sofinhub.test", "Gửi lượt sai thứ 11 (và thử 1 lần đúng mật khẩu khi IP đã bị chặn)", "Đọc header RateLimit-*"], "email member1@sofinhub.test, password sai 'Sai!Mat1'",
      "10 lượt đầu: 401 UNAUTHORIZED \"Email hoặc mật khẩu không đúng\"; lượt 11: 429 TOO_MANY_REQUESTS \"Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút\"; có header RateLimit-Limit/Remaining/Reset (standardHeaders), không có X-RateLimit-* cũ. Bộ đếm theo bộ nhớ từng instance (restart BE là reset). Lưu ý cho tester: chỉ đăng nhập SAI liên tiếp từ cùng máy mới chạm ngưỡng này; đăng nhập đúng nhiều lần (Playwright) không bị 429.")
    a("Rate limit", "Giới hạn quên mật khẩu: lượt thứ 6 trong 15 phút bị 429, phản hồi không lộ email có tồn tại hay không",
      "Bảo mật", "Cao", "BE chạy dev (ngưỡng 5 lượt / 15 phút / IP).",
      ["POST /api/auth/forgot-password với email tồn tại (member2@sofinhub.test)", "POST với email không tồn tại (khong-co@sofinhub.test)", "Gửi thêm cho đủ 6 lượt"], "-",
      "Lượt 1-2 trả cùng một thông điệp chung (không phân biệt email có hay không); lượt 6: 429 TOO_MANY_REQUESTS \"Bạn yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút\".")
    a("Rate limit", "Không có rate limit toàn cục cho API: 100 request liên tiếp vào /api/courses vẫn 200",
      "Hiệu năng", "Trung bình", "Chưa làm: rate limit toàn cục / theo IP cho mọi route (chỉ có limiter riêng cho login, forgot-password, contact, newsletter, tìm kiếm, tin nhắn).",
      ["Gửi 100 GET /api/courses trong 10 giây từ một IP", "Đếm số phản hồi 429"], "-",
      "Hiện tại: 0 phản hồi 429 (chưa có giới hạn toàn cục). Khi làm xong: vượt ngưỡng cấu hình trả 429 TOO_MANY_REQUESTS kèm header Retry-After/RateLimit-*; API.md đã ghi thiếu 'Retry-After cho 429'.", st=PLAN)

    # ------------------------------------------------------------------ Lỗi & định dạng
    a("Định dạng lỗi", "Mọi lỗi có dạng {error:{code,message}}: 400, 401, 403, 404, 409 không thiếu trường",
      "Chức năng", "Cao", RESET + "member1 đăng nhập.",
      ["400: POST /api/auth/login {} ", "401: GET /api/auth/me không token", "403: GET /api/courses/photo/reports (member1)", "404: GET /api/posts/khong-co", "409: POST /api/auth/register với email đã có"], "-",
      "Mỗi phản hồi: JSON {error:{code,message[,details]}} với code lần lượt VALIDATION_ERROR (details là flatten của zod), UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT; message tiếng Việt; không có trường stack/trace/path hay tên file.")
    a("Định dạng lỗi", "Route lạ trả 404 NOT_FOUND kèm method và đường dẫn",
      "Chức năng", "Trung bình", "BE chạy.",
      ["GET /api/khong-ton-tai", "POST /khong-ton-tai (ngoài /api)", "DELETE /api/courses (method không có)", "GET /api/courses/photo/khong-co"], "-",
      "Cả 4: 404 với {error:{code:\"NOT_FOUND\", message:\"Không tìm thấy <METHOD> <path>\"}} (vd. \"Không tìm thấy GET /api/khong-ton-tai\"); không trả HTML mặc định của Express.")
    a("Định dạng lỗi", "JSON sai cú pháp trong body trả 400 BAD_REQUEST (đã sửa, trước đây 500)",
      "Bảo mật", "Cao", "BE chạy dev. errorHandler nay map lỗi parse của express.json (SyntaxError) thành 400 BAD_REQUEST.",
      ["POST /api/auth/login với Content-Type: application/json, body `{\"email\": \"a@b.c\", `", "Kiểm status, error.code, error.message, có lộ đường dẫn file/stack không"], "body JSON cụt",
      "400 với {error:{code:\"BAD_REQUEST\", message:\"Nội dung gửi lên không phải JSON hợp lệ\"}} (không còn 500 INTERNAL_ERROR; lỗi này đã được sửa). Body không chứa stack trace hay đường dẫn file.")
    a("Định dạng lỗi", "Payload lớn hơn 1MB trả 413 PAYLOAD_TOO_LARGE (đã sửa, trước đây 500)",
      "Bảo mật", "Cao", "express.json({limit:'1mb'}); errorHandler nay map PayloadTooLargeError thành 413.",
      ["POST /api/courses/photo/posts (member1) với body JSON dài ~1.2MB (content 'a' × 1.2 triệu)", "Kiểm status và body", "Sau đó gọi GET /health để chắc BE còn sống"], "content 1.2MB",
      "413 với {error:{code:\"PAYLOAD_TOO_LARGE\", message}} (không còn 500 INTERNAL_ERROR; lỗi này đã được sửa); BE không sập, /health vẫn 200; bài không được tạo. Giới hạn nghiệp vụ 4000 ký tự của bài viết vẫn cho 400 VALIDATION_ERROR với body nhỏ.")
    a("Định dạng lỗi", "Content-Type không phải JSON hoặc body rỗng: validate trả 400 VALIDATION_ERROR",
      "Chức năng", "Trung bình", "BE chạy.",
      ["POST /api/auth/register với Content-Type: text/plain, body `firstName=A`", "POST /api/auth/register không body", "POST /api/auth/register body `[]`"], "-",
      "Cả 3: 400 VALIDATION_ERROR \"Tham số không hợp lệ\" (req.body không phải object hợp lệ); không 500, không tạo user.")
    a("Định dạng lỗi", "Lỗi 500 không lộ stack trace hay chi tiết nội bộ ở production",
      "Bảo mật", "Cao", "Chạy BE với NODE_ENV=production (JWT secret riêng) và tạo lỗi nội bộ (vd. dừng Postgres rồi gọi API).",
      ["GET /api/courses/photo khi Postgres dừng", "Đọc body và header phản hồi", "Đối chiếu log console phía server"], "-",
      "Body đúng {error:{code:\"INTERNAL_ERROR\", message:\"Lỗi hệ thống\"}}; không có stack, tên bảng, chuỗi kết nối hay mật khẩu DB; chi tiết lỗi chỉ ở log server. (Ở dev message là thông điệp lỗi thật.)", pw="Không")

    # ------------------------------------------------------------------ SQL injection / tham số
    a("SQL injection", "Chuỗi SQL injection trong tham số truy vấn và path không gây lỗi hay lộ dữ liệu (Prisma tham số hóa)",
      "Bảo mật", "Cao", RESET + "member1 đăng nhập.",
      ["GET /api/search?q=' OR 1=1 --", "GET /api/courses/photo'%20OR%20'1'='1", "GET /api/courses/photo/posts?tag='; DROP TABLE \"User\";--", "GET /api/courses?q=' UNION SELECT * FROM \"User\" --", "Sau đó đăng nhập lại member1 và GET /api/courses"], "các payload SQLi kinh điển",
      "Không lỗi 500: search 200 với danh sách rỗng/khớp chuỗi thô; id lạ 404 NOT_FOUND; tag hợp lệ 200 rỗng; bảng User còn nguyên (đăng nhập lại thành công); không có dữ liệu người dùng trong kết quả.")
    a("SQL injection", "SQL injection qua body đăng nhập/đăng ký bị chặn ở validate hoặc so khớp tham số hóa",
      "Bảo mật", "Cao", RESET + "Không cần token.",
      ["POST /api/auth/login {email:\"member1@sofinhub.test' OR '1'='1\", password:\"x\"}", "POST /api/auth/login {email:\"member1@sofinhub.test\", password:\"' OR '1'='1\"}", "POST /api/auth/register {firstName:\"Robert'); DROP TABLE \\\"User\\\";--\", lastName:\"T\", email:\"sqli@sofinhub.test\", password:\"Passw0rd!x\"}"], "-",
      "Lần 1: 400 VALIDATION_ERROR (\"Email không hợp lệ\"); lần 2: 401 UNAUTHORIZED \"Email hoặc mật khẩu không đúng\" (không đăng nhập được); lần 3: 200 và tên lưu nguyên văn; bảng User vẫn còn.")
    a("SQL injection", "Tham số phân trang/lọc sai kiểu bị 400 thay vì lỗi DB",
      "Bảo mật", "Trung bình", RESET + "member1 đăng nhập.",
      ["GET /api/courses/photo/posts?page=abc", "GET /api/courses/photo/posts?limit=-1", "GET /api/courses/photo/posts?limit=1;DROP", "GET /api/courses/photo/posts?sort=latest'--", "GET /api/notifications?page=0"], "-",
      "Cả 5: 400 VALIDATION_ERROR \"Tham số không hợp lệ\" với details chỉ rõ trường; không 500.")

    # ------------------------------------------------------------------ Dữ liệu nhạy cảm
    a("Dữ liệu nhạy cảm", "Response người dùng không chứa passwordHash, tokenVersion, isDemo, email của người khác",
      "Bảo mật", "Cao", RESET + "member1 đăng nhập.",
      ["GET /api/auth/me", "GET /api/users/<id member2>", "GET /api/courses/photo/members", "GET /api/courses/photo/members/<id member2>", "Tìm chuỗi passwordHash|tokenVersion|isDemo|email trong từng body"], "-",
      "/auth/me có email của CHÍNH member1 nhưng không có passwordHash/tokenVersion/isDemo; hồ sơ công khai và danh sách thành viên KHÔNG có email hay trường nội bộ; không lộ mã phiên của người khác.")
    a("Dữ liệu nhạy cảm", "Mật khẩu và token không xuất hiện trong URL, log phản hồi hay thông báo lỗi",
      "Bảo mật", "Trung bình", RESET,
      ["Đăng nhập trên UI /login, kiểm tab Network: URL và query", "POST /api/auth/login sai mật khẩu, đọc message lỗi", "POST /api/auth/forgot-password và đọc response"], "-",
      "Request đăng nhập là POST body JSON (không có mật khẩu trong URL); lỗi sai mật khẩu dùng thông điệp chung \"Email hoặc mật khẩu không đúng\" (không nói sai email hay mật khẩu); response forgot-password không chứa token (token chỉ trong thư dev outbox).")

    # ------------------------------------------------------------------ Responsive trang mới
    RSP = "Viewport 375x812 (mobile) và 768x1024 (tablet); đăng nhập tài khoản phù hợp; bật cuộn dọc kiểm tra. "
    a("Responsive", "Khu cộng đồng /courses/photo/community trên mobile 375px và tablet 768px",
      "Giao diện", "Trung bình", RESET + RSP + "member1.",
      ["Mở /courses/photo/community ở 375px", "Kiểm topbar (logo, ô tìm kiếm, menu avatar), sidebar, bảng tin, nút đăng bài", "Lặp lại ở 768px", "Cuộn ngang thử"], "-",
      "Không có thanh cuộn ngang toàn trang; nội dung không bị cắt/chồng; chuông thông báo và nút tin nhắn ẩn dưới màn md (theo thiết kế) nhưng vẫn vào được qua menu; nút đăng bài và thẻ bài đọc được; mục tiêu chạm >= 40px.", pw="Một phần")
    a("Responsive", "Lớp học /courses/photo/community/lop-hoc trên mobile và tablet",
      "Giao diện", "Trung bình", RESET + RSP + "member1.",
      ["Mở tab Lớp học ở 375px", "Mở một bài học (LessonPage) và bấm Bài trước/Bài sau", "Lặp lại ở 768px"], "-",
      "Danh sách module và thanh tiến độ vừa màn hình; trình phát/nội dung bài không tràn ngang; nút điều hướng bài học bấm được; mod thấy nút chỉnh sửa nhưng không vỡ layout.", pw="Một phần")
    a("Responsive", "Lịch & sự kiện /courses/photo/community/lich trên mobile và tablet",
      "Giao diện", "Trung bình", RESET + RSP + "member1; sự kiện seed-event-photo-limited (3 chỗ).",
      ["Mở tab Lịch ở 375px", "Mở chi tiết sự kiện, bấm RSVP", "Mod: mở form tạo sự kiện", "Lặp lại ở 768px"], "-",
      "Lưới lịch/danh sách sự kiện không tràn ngang; hộp thoại chi tiết và form tạo sự kiện nằm trong viewport, cuộn được; nút RSVP/.ics đọc được.", pw="Một phần")
    a("Responsive", "Tin nhắn /messages trên mobile và tablet",
      "Giao diện", "Trung bình", RESET + RSP + "member1, hội thoại seed-conv-member1-member2.",
      ["Mở /messages ở 375px", "Mở hội thoại, gõ tin, Enter/Shift+Enter", "Quay lại danh sách", "Lặp lại ở 768px"], "-",
      "Ở mobile danh sách và khung chat không chen nhau tràn ngang (chuyển qua lại được); ô nhập luôn thấy khi bàn phím ảo mở; tin dài tự xuống dòng; nút thu hồi/tải tin cũ vẫn dùng được.", pw="Một phần")
    a("Responsive", "Thanh toán /courses/paid-demo/checkout và /billing trên mobile và tablet",
      "Giao diện", "Trung bình", RESET + RSP + "newbie (checkout) và member1 (billing).",
      ["Mở /courses/paid-demo/checkout ở 375px, chọn phương thức", "Mở /billing: bảng lịch sử thanh toán, hộp thoại hóa đơn, hộp thoại hủy gói", "Lặp lại ở 768px"], "-",
      "Form thanh toán và nút \"Bắt đầu dùng thử\" không tràn; bảng lịch sử cuộn ngang trong khung hoặc chuyển dạng thẻ (không làm rộng cả trang); hộp thoại hóa đơn cuộn được.", pw="Một phần")
    a("Responsive", "Khu quản trị /admin và kiểm duyệt trên mobile và tablet",
      "Giao diện", "Thấp", RESET + RSP + "admin@sofinhub.test; mod cho trang kiểm duyệt.",
      ["Mở /admin (Admin Console) ở 375px: bấm nút \"Mở menu\" (ẩn từ lg) để mở sidebar", "Mở vài trang (Dashboard, Thanh toán > Hoàn tiền, Kiểm duyệt)", "Mở /courses/photo/community/kiem-duyet với mod", "Lặp lại ở 768px"], "-",
      "Trang /admin 4 tab cũ đã được thay bằng Admin Console: sidebar thu gọn vào nút menu, bảng không tràn ngang trang; trang kiểm duyệt cộng đồng: các nút hành động (Bỏ qua, Ẩn nội dung, Cấm thành viên) không bị che, hộp thoại xác nhận nằm giữa màn hình.", pw="Một phần")

    # ------------------------------------------------------------------ Trạng thái UI & a11y
    a("Trạng thái giao diện", "Trạng thái loading: trang Quản trị và Kiểm duyệt hiện chữ đang tải khi API chậm",
      "Giao diện", "Thấp", RESET + "Throttle mạng chậm (Playwright route.fulfill trễ 3s cho /api/admin/me và /api/courses/photo/reports).",
      ["admin: mở /admin", "mod: mở /courses/photo/community/kiem-duyet"], "-",
      "/admin hiện \"Đang kiểm tra quyền…\" (AdminLayout, chờ GET /api/admin/me) rồi mới hiện khung admin; kiểm duyệt hiện \"Đang tải báo cáo…\"; không nhấp nháy nội dung sai (ví dụ không hiện \"Bạn không có quyền\" khi đang tải).", pw="Một phần")
    a("Trạng thái giao diện", "Trạng thái rỗng: danh sách rỗng hiển thị thông điệp thân thiện thay vì bảng trống",
      "Giao diện", "Thấp", RESET + "Tài khoản newbie (chưa có thông báo, hội thoại, giao dịch).",
      ["Mở /notifications", "Mở /messages", "Mở /billing", "Mở /me/communities", "mod: kiểm duyệt tab \"Đã bỏ qua\" khi chưa có báo cáo dismiss"], "-",
      "Mỗi trang hiện thông điệp rỗng tiếng Việt rõ ràng (không lỗi, không spinner vô hạn, không bảng trống); nút hành động chính (vd. khám phá cộng đồng) nếu có vẫn hoạt động.", pw="Một phần")
    a("Trạng thái giao diện", "Lỗi mạng/BE tắt: giao diện hiện thông báo lỗi, không trắng trang",
      "Giao diện", "Trung bình", RESET + "member1 đã đăng nhập; chặn /api/** bằng page.route(abort) hoặc tắt BE.",
      ["Mở /courses/photo/community rồi chặn API và tải lại", "Thử đăng bài khi mạng lỗi", "Mở /billing, /notifications, /admin (admin)"], "-",
      "Mỗi màn hình hiện lỗi/thông báo tiếng Việt (toast hoặc khung lỗi), có thể thử lại; không màn hình trắng, không lặp vô hạn; thao tác thất bại không làm mất nội dung đã nhập; console không có lỗi chưa bắt gây vỡ React.", pw="Một phần")
    a("Trạng thái giao diện", "Trang 404 của FE cho URL lạ và cho id sai",
      "Giao diện", "Thấp", RESET,
      ["Mở /khong-co-trang-nay", "Mở /courses/id-khong-ton-tai", "Mở /users/id-khong-ton-tai (đã đăng nhập)", "Mở /invite/MA-SAI"], "-",
      "URL lạ hiện NotFoundPage; /courses/id-sai và /users/id-sai và /invite/MA-SAI hiện thông báo không tìm thấy (\"Không tìm thấy lời mời\") tương ứng với API 404, không trắng trang.", pw="Có")
    a("Truy cập (a11y)", "Bàn phím: Tab đi qua form đăng nhập, focus nhìn thấy được, Enter gửi form, Esc đóng hộp thoại",
      "Giao diện", "Trung bình", RESET + "Chưa đăng nhập.",
      ["Mở /login, bấm Tab tuần tự qua email, mật khẩu, nút đăng nhập, liên kết", "Nhấn Enter khi con trỏ ở ô mật khẩu", "Đăng nhập owner, mở hộp thoại xác nhận (vd. Xóa cộng đồng ở Cài đặt) rồi nhấn Esc"], "-",
      "Thứ tự focus hợp lý, mỗi phần tử có viền focus nhìn thấy; Enter gửi form; hộp thoại đóng bằng Esc và focus quay về nút gọi (nếu chưa hỗ trợ, ghi nhận là lỗi a11y).", pw="Một phần")
    a("Truy cập (a11y)", "Nhãn truy cập: nút chỉ có biểu tượng có aria-label, ngôn ngữ trang là vi",
      "Giao diện", "Thấp", RESET + "member1 đăng nhập.",
      ["Mở /courses/photo/community, kiểm bằng cây accessibility (page.accessibility.snapshot hoặc getByRole)", "Kiểm nút menu avatar (aria-label \"Tài khoản\"), ô ghi chú xử lý (aria-label \"Ghi chú xử lý\") ở trang kiểm duyệt", "Kiểm thuộc tính lang của thẻ html"], "-",
      "Nút avatar truy cập được theo tên \"Tài khoản\"; ô ghi chú kiểm duyệt có nhãn; <html lang=\"vi\">; ảnh có alt (logo alt=\"SofinHub\"); không có nút chỉ biểu tượng mà thiếu tên truy cập (liệt kê các nút thiếu nếu có).", pw="Một phần")
    a("Truy cập (a11y)", "Tương phản màu và cỡ chữ tối thiểu ở trang chính (kiểm bằng công cụ)",
      "Giao diện", "Thấp", "Cài đặt tiện ích kiểm tương phản (axe DevTools / Lighthouse).",
      ["Chạy Lighthouse Accessibility trên /, /courses/photo, /login, /courses/photo/community", "Ghi điểm và các lỗi contrast/aria"], "-",
      "Điểm Accessibility >= 90 mục tiêu (giá trị tạm, chưa chốt); danh sách lỗi contrast/aria được ghi lại để sửa.", pw="Không", st=PLAN)
