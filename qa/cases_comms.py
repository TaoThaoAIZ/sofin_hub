# -*- coding: utf-8 -*-
"""Testcase bổ sung: NOTI (thông báo, SSE, tin nhắn), SEARCH (tìm kiếm toàn cục), UPLOAD (upload tệp & ảnh).
Nguồn: backend/docs/api/{notifications,messages,search,uploads}.md, docs/features/platform.md,
prisma/seed/messages-notifications.ts, code backend/src/modules/{notifications,messages,search,uploads}."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Có"
PART = "Một phần"
NO = "Không"

PWD = "Passw0rd!x"
CONV = "seed-conv-member1-member2"
E401 = "401 UNAUTHORIZED, message \"Vui lòng đăng nhập để tiếp tục\""
E404N = "404 NOT_FOUND, message \"Không tìm thấy thông báo\""
E404C = "404 NOT_FOUND, message \"Không tìm thấy cuộc trò chuyện\""
VALERR = "400 VALIDATION_ERROR, message \"Tham số không hợp lệ\""
SEED_N = ("Vừa chạy db:seed, chưa thao tác gì (kịch bản seed member1: 7 thông báo, 4 chưa đọc: seed-notif-member1-1..4; "
          "3 đã đọc: -5..-7). Đăng nhập member1@sofinhub.test / " + PWD)
SEED_C = ("Vừa chạy db:seed. Hội thoại " + CONV + " (member1 <-> member2, cùng cộng đồng photo): 8 tin, seed-msg-5 của member1 đã thu hồi, "
          "member2 chưa đọc 3 tin (seed-msg-6,7,8), member1 đã đọc hết. member3 đã chặn member2. Mật khẩu " + PWD)


def load(add):
    # ------------------------------------------------------------------ NOTI
    M, MN = "NOTI", "Thông báo & Nhắn tin"

    def n(feature, title, tt, pri, pre, steps, data, exp, pw=PW, status=DONE):
        add(M, MN, feature, title, tt, pri, status, pre, steps, data, exp, pw=pw)

    F = "Danh sách thông báo (API)"
    n(F, "Seed member1: danh sách mặc định trả 7 thông báo, mới nhất trước", "Chức năng", "Cao", SEED_N,
      ["Đăng nhập lấy accessToken của member1", "Gọi GET /api/notifications không tham số"],
      "Không query",
      "200; data có 7 phần tử theo thứ tự seed-notif-member1-1 (10 phút trước) ... -7 (5 ngày trước); meta.page=1, limit=20 (mặc định), total=7; mọi phần tử userId=member1; 4 phần tử đầu readAt=null, 3 phần tử sau readAt khác null.")
    n(F, "Lọc unread=true chỉ trả 4 thông báo chưa đọc của seed", "Chức năng", "Cao", SEED_N,
      ["GET /api/notifications?unread=true"], "unread=true",
      "200; data gồm đúng seed-notif-member1-1, -2, -3, -4 (post_liked, post_commented, event_reminder, message_received), meta.total=4; không có thông báo đã đọc.")
    n(F, "unread=false không lọc (vẫn trả cả đã đọc lẫn chưa đọc)", "Chức năng", "Trung bình", SEED_N,
      ["GET /api/notifications?unread=false"], "unread=false",
      "200; total=7 (theo code, unread=false được đổi thành false = không áp dụng bộ lọc, KHÔNG phải \"chỉ đã đọc\"; hành vi cần chốt với FE).")
    n(F, "Phân trang limit=3: 3 trang có 3/3/1 phần tử", "Chức năng", "Cao", SEED_N,
      ["GET /api/notifications?limit=3&page=1", "GET ...?limit=3&page=2", "GET ...?limit=3&page=3", "GET ...?limit=3&page=4"],
      "limit=3, page=1..4",
      "Trang 1: -1,-2,-3; trang 2: -4,-5,-6; trang 3: chỉ -7; meta.totalPages=3, total=7; trang 4 trả 200 với data=[] (không lỗi), không phần tử nào lặp giữa các trang.")
    for lab, q in [("limit=51 vượt tối đa 50", "limit=51"), ("limit=0", "limit=0"), ("page=0", "page=0"),
                   ("limit=abc không phải số", "limit=abc"), ("unread=abc ngoài enum", "unread=abc")]:
        n(F, "Tham số không hợp lệ bị từ chối: " + lab, "Chức năng", "Trung bình", "Đăng nhập member1 (" + PWD + ")",
          ["GET /api/notifications?" + q], q, VALERR + "; details.fieldErrors chỉ ra tham số sai; không trả dữ liệu.")
    n(F, "limit=50 (biên tối đa) được chấp nhận", "Chức năng", "Thấp", SEED_N, ["GET /api/notifications?limit=50"], "limit=50",
      "200; meta.limit=50; data 7 phần tử.")
    n(F, "Không có token: mọi endpoint thông báo trả 401", "Bảo mật", "Cao", "Không đăng nhập",
      ["GET /api/notifications", "GET /api/notifications/unread-count", "POST /api/notifications/read-all", "GET /api/notifications/preferences",
       "PUT /api/notifications/preferences body {\"emailDigest\":\"daily\"}", "POST /api/notifications/stream-ticket",
       "DELETE /api/notifications/seed-notif-member1-1", "POST /api/notifications/seed-notif-member1-1/read"],
      "Không gửi Authorization", "Cả 8 request đều " + E401 + "; DB không đổi.")
    n(F, "Cô lập dữ liệu: member2 không thấy thông báo của member1", "Bảo mật", "Cao", SEED_N + "; đồng thời có member2@sofinhub.test",
      ["Đăng nhập member2, GET /api/notifications", "Đối chiếu id trả về với 7 id seed-notif-member1-*"], "member2",
      "200; không phần tử nào có id seed-notif-member1-*; mọi phần tử userId=member2; unread-count của member2 độc lập với member1 (4).")
    n(F, "Seed: 7 thông báo đúng loại + link vào trang FE", "Chức năng", "Trung bình", SEED_N,
      ["GET /api/notifications", "Đối chiếu từng phần tử với kịch bản seed"], "type/link/courseId của 7 thông báo",
      "-1 post_liked link /courses/photo/community courseId photo; -2 post_commented (cùng link); -3 event_reminder link /courses/photo/community/lich (đã sửa, trước đây /courses/photo/events không có route FE); "
      "-4 message_received link /messages/" + CONV + " (courseId null); -5 event_created link /courses/photo/community/lich courseId photo; -6 payment_succeeded link /courses/yt courseId yt; -7 system (chào mừng) link / (đã sửa, trước đây /courses). Mọi link đều dẫn tới route FE hợp lệ, không ra trang 404.")

    F = "Số chưa đọc & đánh dấu đã đọc"
    n(F, "unread-count của member1 sau seed = 4", "Chức năng", "Cao", SEED_N, ["GET /api/notifications/unread-count"], "-",
      "200 {data:{count:4}}.")
    n(F, "Đánh dấu đã đọc 1 thông báo: readAt được gán, count giảm 4 -> 3", "Chức năng", "Cao", SEED_N,
      ["POST /api/notifications/seed-notif-member1-1/read", "GET /api/notifications/unread-count", "GET /api/notifications?unread=true"],
      "id=seed-notif-member1-1",
      "200 data là Notification với readAt là chuỗi ISO (khác null); count=3; danh sách unread chỉ còn -2,-3,-4.")
    n(F, "Đánh dấu đã đọc là idempotent (gọi 2 lần không đổi readAt)", "Chức năng", "Trung bình", SEED_N,
      ["POST .../seed-notif-member1-2/read, ghi readAt = T1", "Chờ 2 giây, gọi lại đúng request đó"], "id=seed-notif-member1-2",
      "Cả hai lần 200; readAt lần 2 vẫn = T1 (không bị ghi đè); count chỉ giảm 1 lần (4 -> 3).")
    n(F, "Đánh dấu đã đọc thông báo đã đọc sẵn (seed -5) vẫn 200", "Chức năng", "Thấp", SEED_N,
      ["POST /api/notifications/seed-notif-member1-5/read", "GET /api/notifications/unread-count"], "id=seed-notif-member1-5",
      "200, readAt giữ nguyên giá trị seed; count vẫn 4.")
    n(F, "IDOR: member2 đánh dấu đã đọc thông báo của member1 -> 404", "Bảo mật", "Cao", SEED_N + "; member2 cũng đăng nhập",
      ["member2: POST /api/notifications/seed-notif-member1-1/read", "member1: GET /api/notifications/unread-count"], "id của member1",
      "member2 nhận " + E404N + " (không lộ tồn tại, không 403); member1 vẫn count=4, seed-notif-member1-1 vẫn readAt=null.")
    n(F, "Đánh dấu đã đọc id không tồn tại -> 404", "Chức năng", "Thấp", SEED_N,
      ["POST /api/notifications/khong-ton-tai/read"], "id=khong-ton-tai", E404N + ".")
    n(F, "Đọc tất cả: trả updated=4 rồi lần 2 trả updated=0", "Chức năng", "Cao", SEED_N,
      ["POST /api/notifications/read-all", "GET /api/notifications/unread-count", "POST /api/notifications/read-all lần nữa"], "-",
      "Lần 1: 200 {data:{updated:4}}; count=0; lần 2: 200 {updated:0}; 7 thông báo vẫn còn (không bị xóa).")
    n(F, "Đọc tất cả của member1 không ảnh hưởng thông báo của member2", "Bảo mật", "Trung bình", SEED_N + "; member2 có ít nhất 1 thông báo chưa đọc (tạo bằng cách member1 thích bài của member2)",
      ["member2: GET unread-count ghi lại", "member1: POST /api/notifications/read-all", "member2: GET unread-count"], "-",
      "Số chưa đọc của member2 giữ nguyên trước/sau khi member1 đọc tất cả.")

    F = "Xóa thông báo"
    n(F, "Xóa 1 thông báo của chính mình", "Chức năng", "Cao", SEED_N,
      ["DELETE /api/notifications/seed-notif-member1-7", "GET /api/notifications", "DELETE lại đúng id đó"], "id=seed-notif-member1-7",
      "Lần 1: 200 {data:{deleted:true}}; danh sách còn 6 (total=6); lần 2: " + E404N + ".")
    n(F, "Xóa thông báo CHƯA đọc làm giảm số chưa đọc", "Chức năng", "Trung bình", SEED_N,
      ["DELETE /api/notifications/seed-notif-member1-3", "GET /api/notifications/unread-count"], "id=seed-notif-member1-3 (event_reminder, chưa đọc)",
      "200 deleted:true; count từ 4 xuống 3.")
    n(F, "IDOR: member2 xóa thông báo của member1 -> 404 và dữ liệu còn nguyên", "Bảo mật", "Cao", SEED_N + "; member2 đăng nhập",
      ["member2: DELETE /api/notifications/seed-notif-member1-1", "member1: GET /api/notifications"], "id của member1",
      "member2 nhận " + E404N + "; member1 vẫn thấy đủ 7 thông báo.")

    F = "Tùy chọn thông báo (NotificationPreference)"
    n(F, "member1 (không có dòng tùy chọn) nhận mặc định: 12 loại bật, emailDigest=off", "Chức năng", "Cao", SEED_N + " (member1 không có dòng NotificationPreference)",
      ["GET /api/notifications/preferences"], "-",
      "200; data.types có đủ 12 khóa (post_liked, post_commented, event_created, event_reminder, member_joined, role_changed, removed_from_community, payment_succeeded, payment_failed, report_resolved, message_received, system) đều true; emailDigest=\"off\".")
    n(F, "member3 có tùy chọn KHÔNG mặc định: post_liked & member_joined tắt, emailDigest=weekly", "Chức năng", "Cao",
      "Vừa seed. Đăng nhập member3@sofinhub.test / " + PWD,
      ["GET /api/notifications/preferences"], "-",
      "200; types.post_liked=false, types.member_joined=false, 10 loại còn lại true; emailDigest=\"weekly\".")
    n(F, "Cập nhật từng phần: tắt post_commented không đổi các loại khác", "Chức năng", "Cao", SEED_N,
      ["PUT /api/notifications/preferences body {\"types\":{\"post_commented\":false}}", "GET /api/notifications/preferences"],
      "{\"types\":{\"post_commented\":false}}",
      "200; types.post_commented=false, 11 loại còn lại true, emailDigest vẫn \"off\".")
    n(F, "Đổi emailDigest sang daily/weekly/off được lưu bền", "Chức năng", "Trung bình", SEED_N,
      ["PUT {\"emailDigest\":\"daily\"}", "PUT {\"emailDigest\":\"weekly\"}", "PUT {\"emailDigest\":\"off\"}", "Sau mỗi lần GET /preferences"],
      "daily, weekly, off", "Mỗi lần 200 và GET trả đúng giá trị vừa đặt; types không thay đổi.")
    n(F, "emailDigest ngoài enum (monthly) bị từ chối", "Chức năng", "Trung bình", SEED_N,
      ["PUT /api/notifications/preferences body {\"emailDigest\":\"monthly\"}"], "monthly", VALERR + "; tùy chọn cũ không đổi.")
    n(F, "Khóa loại thông báo lạ bị từ chối", "Chức năng", "Trung bình", SEED_N,
      ["PUT body {\"types\":{\"khong_ton_tai\":true}}"], "khóa lạ", VALERR + "; không lưu.")
    n(F, "Giá trị loại không phải boolean bị từ chối", "Chức năng", "Thấp", SEED_N,
      ["PUT body {\"types\":{\"post_liked\":\"no\"}}"], "\"no\"", VALERR + ".")
    n(F, "Body rỗng {} hoặc thừa khóa bị từ chối", "Chức năng", "Trung bình", SEED_N,
      ["PUT body {}", "PUT body {\"foo\":1}", "PUT body {\"types\":{}}"], "3 body",
      "Cả ba " + VALERR + " (body {} -> \"Không có gì để cập nhật\"; khóa thừa bị strict từ chối); tùy chọn không đổi. (types:{} rỗng vẫn được chấp nhận vì types !== undefined: nếu thực tế trả 200 thì đó là hành vi hiện tại, chưa chốt).")
    for t, how in [("payment_succeeded", "thanh toán khóa paid-demo thành công"), ("payment_failed", "thanh toán thất bại"),
                   ("role_changed", "owner đổi vai trò của họ trong photo"), ("removed_from_community", "bị xóa khỏi cộng đồng"),
                   ("report_resolved", "báo cáo của họ được xử lý")]:
        n(F, "Không tắt được loại bắt buộc " + t, "Chức năng", "Cao", SEED_N + " (loại bắt buộc: luôn gửi khi " + how + ")",
          ["PUT /api/notifications/preferences body {\"types\":{\"" + t + "\":false}}", "GET /api/notifications/preferences"],
          "{\"types\":{\"" + t + "\":false}}",
          "400 BAD_REQUEST, message \"Không thể tắt thông báo quan trọng: " + t + "\"; GET vẫn types." + t + "=true.")
    n(F, "Bật lại loại đã tắt (post_liked của member3) có hiệu lực", "Chức năng", "Trung bình", "Vừa seed. member3 (post_liked đang false)",
      ["member3: PUT {\"types\":{\"post_liked\":true}}", "GET /preferences"], "post_liked=true", "200; types.post_liked=true; các khóa khác (member_joined=false, emailDigest=weekly) giữ nguyên.")
    n(F, "Tùy chọn được giữ sau khi đăng xuất/đăng nhập lại", "Chức năng", "Trung bình", SEED_N,
      ["PUT {\"types\":{\"event_created\":false}}", "POST /api/auth/logout rồi đăng nhập lại", "GET /preferences"], "event_created=false",
      "types.event_created vẫn false (lưu Postgres bảng NotificationPreference, không phụ thuộc phiên).")
    n(F, "Tắt post_liked: bị thích bài thì KHÔNG tạo thông báo", "Tích hợp", "Cao",
      "member1 đã tắt post_liked (PUT {\"types\":{\"post_liked\":false}}); có 1 bài viết của member1 ở cộng đồng photo; member2 đăng nhập",
      ["member1: GET unread-count ghi lại = X", "member2: thích bài viết của member1 (POST /api/courses/photo/posts/:postId/like)", "member1: GET /api/notifications và unread-count"],
      "Bài viết của member1 ở photo",
      "Số chưa đọc vẫn X, không có thông báo post_liked mới (loại bị tắt thì không lưu và không phát SSE).")
    n(F, "Tắt post_liked không chặn loại khác: bình luận vẫn tạo post_commented", "Tích hợp", "Trung bình",
      "member1 đã tắt post_liked, chưa tắt post_commented; member2 đăng nhập",
      ["member2: bình luận bài của member1 (\"Ảnh đẹp quá\")", "member1: GET /api/notifications"], "content=\"Ảnh đẹp quá\"",
      "member1 có thêm 1 thông báo type=post_commented title \"Bình luận mới\"; không có post_liked.")
    n(F, "member3 (post_liked đã tắt sẵn từ seed) không nhận thông báo khi bài được thích", "Tích hợp", "Cao",
      "Vừa seed; member3 có bài viết ở photo; đăng nhập member2",
      ["member3: ghi unread-count", "member2 thích bài của member3", "member3: GET /api/notifications"], "-",
      "Không có thông báo post_liked mới cho member3; unread-count giữ nguyên.")
    n(F, "Cache tùy chọn 5 giây: đổi tùy chọn có hiệu lực (giá trị tạm)", "Tích hợp", "Thấp",
      "member1 vừa bật/tắt post_liked; member2 sẵn sàng thích bài", ["member1 tắt post_liked", "Ngay lập tức member2 thích bài (< 5s)", "Chờ > 5s, thích lại sau khi bỏ thích rồi thích"],
      "Cache preference 5s", "Sau PUT, notify() dùng tùy chọn mới: cache 5s được vô hiệu qua pub/sub kênh notif:prefs (Redis khi có REDIS_URL, in-memory khi 1 instance) nên thường có hiệu lực ngay; chỉ khi pub/sub chậm/mất mới lệch tối đa 5s (backend/docs/api/notifications.md 'Giới hạn hiện tại'). Ghi nhận thực tế nếu lệch (giá trị tạm / chưa chốt).", pw=PART)

    F = "Chuông & trang /notifications (UI)"
    n(F, "Chuông member1: badge 4, dropdown tối đa 10, mục chưa đọc nền cam + chấm", "Giao diện", "Cao", SEED_N,
      ["Vào /courses/photo/community", "Quan sát chuông ở topbar", "Bấm chuông"], "-",
      "Badge hiện số 4; dropdown liệt kê 7 thông báo (tối đa 10) mới nhất trước; 4 mục chưa đọc có nền cam nhạt + chấm; có nút \"Đọc tất cả\" và \"Xem tất cả thông báo\".")
    n(F, "Bấm 1 thông báo: đánh dấu đã đọc, badge giảm, chuyển đến link", "Chức năng", "Cao", SEED_N,
      ["Bấm chuông, bấm thông báo \"Sự kiện sắp diễn ra\" (seed-notif-member1-3)"], "link=/courses/photo/community/lich",
      "Gọi POST /notifications/seed-notif-member1-3/read; badge 4 -> 3; chuyển sang /courses/photo/community/lich (tab Lịch sự kiện mở được, không 404); mục mất nền cam.")
    n(F, "Nút \"Đọc tất cả\" đưa badge về 0 và ẩn badge", "Chức năng", "Cao", SEED_N,
      ["Mở dropdown chuông", "Bấm \"Đọc tất cả\""], "-", "Gọi POST /notifications/read-all; badge biến mất; toàn bộ mục hết nền cam.")
    n(F, "Trang /notifications: lọc \"Chưa đọc\" và xóa bằng thùng rác", "Chức năng", "Trung bình", SEED_N,
      ["Mở /notifications", "Bấm lọc \"Chưa đọc\"", "Bấm thùng rác trên thông báo seed-notif-member1-2"], "-",
      "Lọc còn 4 mục chưa đọc (gọi ?unread=true); sau xóa còn 3, badge chuông giảm 1 (DELETE trả deleted:true).")
    n(F, "Trang /notifications phân trang 20/trang khi có > 20 thông báo", "Chức năng", "Trung bình",
      SEED_N + "; tạo thêm ≥ 15 thông báo (member2 bình luận bài của member1 15 lần) để tổng ≥ 22",
      ["Mở /notifications", "Kiểm tra số mục và điều khiển phân trang", "Sang trang 2"], "tổng ≥ 22",
      "Trang 1 có 20 mục, trang 2 có phần còn lại; không trùng lặp; thứ tự mới nhất trước.")
    n(F, "Khách vào /notifications bị yêu cầu đăng nhập", "Bảo mật", "Trung bình", "Chưa đăng nhập (xóa localStorage)",
      ["Mở trực tiếp /notifications"], "-", "Hiện yêu cầu đăng nhập/chuyển về trang đăng nhập, không lộ dữ liệu; không gọi API thành công.")
    n(F, "Trạng thái rỗng: tài khoản chưa có thông báo", "Giao diện", "Thấp", "Đăng nhập newbie@sofinhub.test / " + PWD + " (chưa có thông báo nào)",
      ["Mở /notifications", "Quan sát chuông"], "-", "Không có badge; danh sách hiển thị trạng thái rỗng, không lỗi; unread-count = 0.")
    n(F, "Thông báo có link lạ: chuyển 404 của app; link ngoại lai bị bỏ qua", "Bảo mật", "Trung bình",
      "member1 có 2 thông báo được gán link thủ công qua DB: \"/trang-khong-ton-tai\" và \"//evil.example.com\" (link không bắt đầu bằng / cũng thử)",
      ["Bấm thông báo link /trang-khong-ton-tai", "Bấm thông báo link //evil.example.com", "Bấm thông báo link \"javascript:alert(1)\""], "3 link",
      "Link 1: trang 404 của app (không trắng trang); link 2 và 3: KHÔNG điều hướng đi đâu, chỉ đánh dấu đã đọc (theo platform.md); không thực thi script.", pw=NO)
    n(F, "Chuông ẩn ở màn hình < 640px, vẫn vào được /notifications qua menu", "Giao diện", "Thấp", SEED_N,
      ["Thu cửa sổ về 375px", "Tìm chuông ở Header", "Mở menu -> Thông báo"], "viewport 375x800",
      "Chuông trong Header ẩn; vào /notifications qua menu hoạt động bình thường.")

    F = "Giới hạn lưu trữ thông báo"
    n(F, "Tối đa 200 thông báo/user: thêm thông báo mới thì cắt bớt cái cũ", "Hiệu năng", "Trung bình",
      "Tài khoản test nhận được > 200 thông báo (script tạo 210 bình luận/like)", ["Tạo 210 thông báo cho cùng 1 user", "GET /api/notifications?limit=50 các trang, cộng tổng"], "210 thông báo",
      "meta.total ≤ 200; các thông báo cũ nhất bị dọn (dọn khi ghi thông báo mới bằng DELETE).", pw=NO)
    n(F, "Thông báo đã đọc quá 30 ngày không được trả về", "Chức năng", "Thấp",
      "Sửa DB: đặt createdAt/readAt của seed-notif-member1-7 cách đây 31 ngày (đã đọc)", ["Gọi GET /api/notifications", "Tạo 1 thông báo mới (dọn khi ghi) rồi gọi lại"], "readAt > 30 ngày",
      "seed-notif-member1-7 không còn trong kết quả; các thông báo chưa đọc dù cũ vẫn giữ.", pw=NO)
    n(F, "Chốt: email tổng hợp (emailDigest) mới lưu tùy chọn, chưa gửi email", "Tích hợp", "Thấp",
      "Chưa làm: job gửi email tổng hợp theo emailDigest (daily/weekly) và gom nhóm thông báo (\"5 người đã thích bài của bạn\")",
      ["Đặt emailDigest=daily", "Chờ chu kỳ, đọc GET /api/dev/outbox?to=member1@sofinhub.test"], "daily",
      "(Kế hoạch) Sẽ có email tổng hợp trong outbox; hiện tại KHÔNG có email nào (chưa chốt).", pw=NO, status=PLAN)
    n(F, "Chốt cách xác thực SSE cuối cùng (ticket hay cookie) và bỏ ?access_token", "Bảo mật", "Trung bình",
      "Chưa chốt: docs/notifications ghi ?access_token= chỉ là fallback (token lọt vào access log/Referer); bản chốt dùng ticket hoặc cookie httpOnly",
      ["Sau khi chốt: gọi GET /api/notifications/stream?access_token=<token hợp lệ>"], "access_token trong URL",
      "(Kế hoạch) Sẽ trả 401 khi đã bỏ fallback; hiện tại vẫn 200 (giá trị tạm / chưa chốt).", pw=PW, status=PLAN)

    F = "Realtime SSE thông báo"
    n(F, "Cấp vé: POST /notifications/stream-ticket trả 201 với ticket + expiresInSec=30", "Chức năng", "Cao", SEED_N,
      ["POST /api/notifications/stream-ticket (Bearer)"], "-", "201 {data:{ticket:<chuỗi base64url>, expiresInSec:30}}.")
    n(F, "Kết nối SSE bằng ?ticket=: header text/event-stream và khung khởi đầu", "Tích hợp", "Cao", SEED_N,
      ["Xin vé", "GET /api/notifications/stream?ticket=<vé> (fetch stream/curl -N)"], "vé hợp lệ",
      "200; Content-Type text/event-stream; charset=utf-8; Cache-Control no-cache, no-transform; X-Accel-Buffering no; nội dung đầu \"retry: 5000\" và \": connected\".")
    n(F, "Vé chỉ dùng 1 lần: kết nối lần 2 với cùng vé -> 401", "Bảo mật", "Cao", SEED_N,
      ["Xin vé", "Mở stream với vé (thành công)", "Mở stream lần 2 với cùng vé"], "vé đã dùng", "Lần 2: " + E401 + "; kết nối đầu vẫn sống.")
    n(F, "Vé hết hạn sau 30 giây -> 401", "Bảo mật", "Cao", SEED_N,
      ["Xin vé", "Chờ 31 giây", "Mở stream với vé"], "vé quá 30s", E401 + ".")
    n(F, "Vé giả/chuỗi lạ hoặc thiếu vé -> 401", "Bảo mật", "Trung bình", "Không cần đăng nhập",
      ["GET /api/notifications/stream?ticket=abc123", "GET /api/notifications/stream (không tham số)", "GET ...?ticket= (rỗng)"], "3 request",
      "Request 1 và 2: " + E401 + "; request 3: " + VALERR + " (ticket rỗng vi phạm min(1))."  )
    n(F, "Fallback ?access_token= hợp lệ mở được stream; token sai -> 401", "Bảo mật", "Trung bình", SEED_N,
      ["GET /api/notifications/stream?access_token=<accessToken member1>", "GET ...?access_token=xyz"], "access_token",
      "Token đúng: 200 text/event-stream; token sai: " + E401 + ". (Ghi chú bảo mật: token nằm trong URL, chưa chốt bỏ.)")
    n(F, "Kết nối bằng Bearer header (fetch stream) hoạt động", "Tích hợp", "Thấp", SEED_N,
      ["fetch('/api/notifications/stream', {headers:{Authorization:'Bearer <token>'}})"], "Bearer", "200 text/event-stream.")
    n(F, "Nhận thông báo mới theo thời gian thực, không cần tải lại trang", "Tích hợp", "Cao",
      SEED_N + "; member2 đăng nhập ở trình duyệt/cửa sổ ẩn danh khác",
      ["member1 mở /courses/photo/community, để nguyên trang (badge 4)", "member2 thích một bài viết của member1", "Quan sát cửa sổ member1 trong 5 giây, KHÔNG F5"], "post_liked mặc định bật",
      "Đúng 1 sự kiện SSE \"event: notification\" có data JSON type=post_liked, userId=member1; badge 4 -> 5; toast nhỏ góc phải dưới; bấm toast mở link và đánh dấu đã đọc.", pw=PART)
    n(F, "Không nhận thông báo của người khác trên stream của mình", "Bảo mật", "Cao",
      "member1 và member3 đều đang mở stream (2 vé riêng); member2 đăng nhập",
      ["member2 bình luận bài của member3", "Quan sát cả hai stream"], "thông báo dành cho member3",
      "Chỉ stream của member3 nhận event notification; stream của member1 không nhận gì (chỉ heartbeat).", pw=PART)
    n(F, "Vé của A không mở được luồng của B (vé gắn với người xin)", "Bảo mật", "Cao", "member1 và member2",
      ["member1 xin vé, member2 dùng vé đó mở stream", "member1 thích/bị thích để tạo thông báo cho member1"], "vé của member1",
      "Stream mở bằng vé của member1 chỉ nhận thông báo của member1 (userId gắn trong vé); không có cách chọn userId khác.", pw=PART)
    n(F, "Heartbeat \": heartbeat\" mỗi 25 giây giữ kết nối", "Tích hợp", "Thấp", SEED_N,
      ["Mở stream", "Đọc dữ liệu trong 60 giây"], "-", "Có ít nhất 2 dòng \": heartbeat\" cách nhau ~25s; kết nối không bị đóng.")
    n(F, "Nhiều tab: cả hai tab cùng nhận thông báo", "Tích hợp", "Cao", SEED_N + "; member2 đăng nhập cửa sổ khác",
      ["member1 mở 2 tab /courses/photo/community", "member2 thích một bài của member1", "Quan sát cả 2 tab"], "2 kết nối SSE",
      "Cả 2 tab đều tăng badge 4 -> 5 và nhận toast; đóng 1 tab thì tab còn lại vẫn nhận thông báo tiếp.", pw=PART)
    n(F, "Đăng xuất đóng SSE ở FE, không còn request stream", "Bảo mật", "Cao", SEED_N,
      ["Đăng nhập member1, mở DevTools Network", "Xác nhận có request /notifications/stream", "Đăng xuất từ menu avatar", "Quan sát Network 30 giây"], "-",
      "Sau đăng xuất kết nối stream đóng và không tự nối lại (không request stream mới); localStorage không còn token.", pw=PART)
    n(F, "Token bị thu hồi (đăng xuất/đổi mật khẩu): dùng token cũ mở stream mới -> 401", "Bảo mật", "Cao", SEED_N,
      ["Lưu accessToken cũ của member1", "POST /api/auth/logout", "fetch GET /api/notifications/stream với header Authorization: Bearer <token cũ> (cách ?access_token= đã bỏ - luôn 401 kể cả token còn hạn)"], "token đã thu hồi",
      E401 + ". Ghi chú: server KHÔNG chủ động ngắt luồng SSE đang mở khi token bị thu hồi (listener chỉ gỡ khi client ngắt); FE phải tự đóng (chưa chốt).")
    n(F, "Không có replay: thông báo phát sinh lúc mất kết nối phải bù bằng GET", "Tích hợp", "Trung bình", SEED_N + "; member2 đăng nhập",
      ["member1 mở stream rồi ngắt (tắt mạng/đóng tab)", "member2 thích bài của member1 trong lúc đó", "member1 kết nối lại bằng vé mới"], "-",
      "Stream mới KHÔNG phát lại sự kiện đã bỏ lỡ; GET /api/notifications và unread-count có thông báo mới (FE tải lại danh sách sau khi nối lại).", pw=PART)
    n(F, "Tự nối lại sau khi backend khởi động lại (backoff 1s, 2s, 4s... tối đa 30s)", "Tích hợp", "Trung bình", SEED_N,
      ["Mở app member1", "Tắt backend ~10 giây rồi bật lại", "Quan sát Network"], "-",
      "FE thử lại theo backoff tăng dần đến 30s; sau khi nối lại danh sách/badge được tải lại; thông báo mới nhận được bình thường.", pw=NO)
    n(F, "Client ngắt: server dừng heartbeat và gỡ listener (không rò rỉ)", "Hiệu năng", "Thấp", SEED_N,
      ["Mở 50 stream rồi đóng hết", "Tạo thông báo cho member1", "Theo dõi log/bộ nhớ server"], "50 kết nối",
      "Không có lỗi ghi vào socket đã đóng; số listener về 0; bộ nhớ tiến trình ổn định.", pw=NO)

    # ---- Tin nhắn
    F = "Cuộc trò chuyện 1-1"
    n(F, "Danh sách hội thoại của member1 theo seed", "Chức năng", "Cao", SEED_C,
      ["Đăng nhập member1", "GET /api/conversations"], "-",
      "200; data có hội thoại id=\"" + CONV + "\", other.id=member2, lastMessage = nội dung seed-msg-8 \"Mình sẽ gửi danh sách địa điểm sau.\", unreadCount=0 (member1 đã đọc hết), blockedByMe=false; sắp theo lastMessageAt giảm dần.")
    n(F, "member2 thấy unreadCount=3 (tin 6,7,8), tin thu hồi không tính", "Chức năng", "Cao", SEED_C,
      ["Đăng nhập member2", "GET /api/conversations", "GET /api/messages/unread-count"], "-",
      "Hội thoại " + CONV + " có unreadCount=3; /messages/unread-count trả {data:{unreadCount:3}}; other là member1.")
    n(F, "Mở hội thoại đã có: POST /conversations trả 200 với cùng id (không tạo mới)", "Chức năng", "Cao", SEED_C,
      ["member1: POST /api/conversations body {\"userId\":\"<id member2>\"}"], "userId=member2",
      "200 (không phải 201); data.id=\"" + CONV + "\"; GET /conversations vẫn 1 hội thoại (không nhân đôi).")
    n(F, "Tạo hội thoại mới trả 201 (member1 -> member3, cùng cộng đồng photo)", "Chức năng", "Cao", SEED_C,
      ["member1: POST /api/conversations body {\"userId\":\"<id member3>\"}", "GET /api/conversations"], "userId=member3",
      "201; data {id, other:{id:member3,name}, lastMessage:null, unreadCount:0, blockedByMe:false}; danh sách có 2 hội thoại; gọi lại trả 200 cùng id.")
    n(F, "Không nhắn cho chính mình", "Chức năng", "Trung bình", SEED_C,
      ["member1: POST /api/conversations body {\"userId\":\"<id member1>\"}"], "userId=chính mình",
      "400 BAD_REQUEST, message \"Bạn không thể nhắn tin cho chính mình\".")
    n(F, "Mở hội thoại với user không tồn tại -> 404", "Chức năng", "Thấp", SEED_C,
      ["POST /api/conversations body {\"userId\":\"khong-ton-tai\"}"], "userId lạ", "404 NOT_FOUND, message \"Không tìm thấy người dùng\".")
    n(F, "userId rỗng/khoảng trắng bị từ chối", "Chức năng", "Thấp", SEED_C,
      ["POST /api/conversations body {\"userId\":\"   \"}", "POST body {}"], "userId=\"   \"", VALERR + " (message trường: \"Thiếu người nhận\").")
    n(F, "Không tạo được hội thoại với người không chung cộng đồng nào (newbie)", "Chức năng", "Cao", SEED_C + "; newbie chưa ở cộng đồng nào",
      ["member1: POST /api/conversations body {\"userId\":\"<id newbie>\"}", "newbie: POST body {\"userId\":\"<id member1>\"}"], "member1 <-> newbie",
      "Cả hai chiều 403 FORBIDDEN, message \"Chỉ nhắn tin được với thành viên chung cộng đồng với bạn\"; không tạo hội thoại.")
    n(F, "Hội thoại đã có vẫn mở lại được sau khi một người rời cộng đồng", "Chức năng", "Trung bình", SEED_C + "; member2 chỉ ở photo",
      ["member2 rời cộng đồng photo", "member1: POST /api/conversations {userId: member2}", "member1: gửi 1 tin vào " + CONV], "-",
      "Mở lại 200 và gửi tin 201 (cuộc đã có thì luôn mở lại được nếu không bị chặn). Nhưng tạo hội thoại MỚI với người khác không chung cộng đồng vẫn 403.")
    n(F, "Người bị ban (banned) không thể tạo hội thoại mới với thành viên photo", "Chức năng", "Trung bình", SEED_C + "; banned@sofinhub.test bị ban khỏi photo",
      ["banned: POST /api/conversations {userId: member2}"], "banned -> member2",
      "Nếu banned không còn ở cộng đồng nào chung: 403 \"Chỉ nhắn tin được với thành viên chung cộng đồng với bạn\" (theo enrollment; ghi nhận thực tế nếu banned còn enroll ở cộng đồng khác - chưa chốt).")

    F = "Tin nhắn: đọc lịch sử & phân trang"
    n(F, "Đọc lịch sử seed: 8 tin cũ -> mới, tin thu hồi hiển thị đúng", "Chức năng", "Cao", SEED_C,
      ["member1: GET /api/conversations/" + CONV + "/messages"], "mặc định limit=30",
      "200; data 8 phần tử theo thứ tự seed-msg-1..8; seed-msg-5 có deleted=true, content=\"Tin nhắn đã bị thu hồi\", attachments=[]; các tin khác deleted=false đúng nội dung seed; meta.hasMore=false.")
    n(F, "Phân trang cursor limit=3 với before=nextBefore", "Chức năng", "Cao", SEED_C,
      ["GET .../messages?limit=3", "Lấy meta.nextBefore, GET .../messages?limit=3&before=<nextBefore>", "Lặp tới hết"], "limit=3",
      "Lần 1: 3 tin mới nhất (seed-msg-6,7,8 theo thứ tự cũ->mới), hasMore=true; lần 2: seed-msg-3,4,5; lần 3: seed-msg-1,2, hasMore=false; không tin nào trùng.")
    n(F, "before không hợp lệ hoặc thuộc hội thoại khác bị từ chối", "Chức năng", "Trung bình", SEED_C + "; member1 có thêm hội thoại với member3 (đã tạo)",
      ["GET .../messages?before=khong-ton-tai", "Lấy id một tin của hội thoại member1-member3, dùng làm before cho " + CONV], "before lạ",
      "Cả hai 400 BAD_REQUEST, message \"Mốc phân trang không hợp lệ\".")
    n(F, "limit ngoài khoảng 1..100 bị từ chối, 100 được chấp nhận", "Chức năng", "Thấp", SEED_C,
      ["GET .../messages?limit=101", "GET ...?limit=0", "GET ...?limit=100"], "101, 0, 100", "limit=101 và 0: " + VALERR + "; limit=100: 200 với 8 tin.")
    n(F, "Hội thoại rỗng mới tạo trả data=[]", "Giao diện", "Thấp", SEED_C,
      ["member1 tạo hội thoại với member3", "GET .../messages"], "hội thoại mới", "200; data=[]; meta.hasMore=false; UI hiển thị khung chat trống.")

    F = "Gửi tin nhắn"
    n(F, "Gửi tin thành công: 201, cập nhật lastMessage và unread của người nhận", "Chức năng", "Cao", SEED_C,
      ["member1: POST /api/conversations/" + CONV + "/messages body {\"content\":\"Hẹn gặp cuối tuần nhé\"}", "member2: GET /api/conversations"], "content=\"Hẹn gặp cuối tuần nhé\"",
      "201 data {id, conversationId, senderId=member1, content, attachments:[], createdAt, deleted:false}; hội thoại của member2 có lastMessage mới và unreadCount = 4 (3 seed + 1).")
    n(F, "Nội dung được trim; chỉ khoảng trắng bị từ chối", "Chức năng", "Trung bình", SEED_C,
      ["POST content \"   xin chào   \"", "POST content \"     \"", "POST content \"\""], "3 payload",
      "Lần 1: 201 content=\"xin chào\" (đã trim); lần 2 và 3: " + VALERR + " (message trường \"Nội dung không được để trống\"); không tin nào được lưu.")
    n(F, "Biên độ dài: 2000 ký tự OK, 2001 ký tự bị từ chối", "Chức năng", "Cao", SEED_C,
      ["POST content = 2000 ký tự 'a'", "POST content = 2001 ký tự 'a'"], "2000 / 2001 ký tự",
      "2000: 201; 2001: " + VALERR + " (\"Nội dung tối đa 2000 ký tự\").")
    n(F, "Unicode, emoji, xuống dòng được lưu nguyên vẹn", "Chức năng", "Trung bình", SEED_C,
      ["POST content \"Chào 👋 Việt Nam\\nDòng 2 — ảnh đẹp 📷\"", "GET .../messages"], "tiếng Việt có dấu + emoji + \\n",
      "201; tin trả về đúng từng ký tự, giữ xuống dòng; UI hiển thị 2 dòng, không vỡ font.")
    n(F, "Nội dung có thẻ HTML bị từ chối (chống XSS lưu trữ)", "Bảo mật", "Cao", SEED_C,
      ["POST content \"<script>alert(1)</script>\"", "POST content \"<img src=x onerror=alert(1)>\"", "POST content \"<b>đậm</b>\""], "3 payload thẻ HTML",
      "Cả ba 400 BAD_REQUEST, message \"Tin nhắn không được chứa mã HTML\"; không tin nào được lưu.")
    n(F, "Dấu < > thông thường không phải thẻ vẫn được phép", "Chức năng", "Trung bình", SEED_C,
      ["POST content \"3 < 5 và 9 > 2\"", "POST content \"a<3 b\"", "Xem trên UI của người nhận"], "3 < 5 và 9 > 2",
      "201; hiển thị nguyên văn dạng văn bản, không được diễn giải thành HTML (FE vẫn phải escape).")
    n(F, "XSS qua UI: tin có ký tự đặc biệt hiển thị dạng chữ thô", "Bảo mật", "Cao", SEED_C + "; member1 và member2 mở 2 cửa sổ",
      ["member1 gửi \"&lt;script&gt;alert(1)&lt;/script&gt; và javascript:alert(1)\"", "member2 mở /messages/" + CONV], "chuỗi entity + javascript:",
      "Hiển thị đúng chữ thô; không có hộp thoại alert; liên kết javascript: không tự thành link chạy được.")
    n(F, "Gửi vào hội thoại không tồn tại/không có content bị từ chối", "Chức năng", "Thấp", SEED_C,
      ["POST /api/conversations/khong-ton-tai/messages body {\"content\":\"hi\"}", "POST .../" + CONV + "/messages body {}"], "2 request",
      "Request 1: " + E404C + "; request 2: " + VALERR + ".")
    n(F, "Chống spam: tin thứ 21 trong 1 phút -> 429", "Bảo mật", "Cao",
      SEED_C + "; môi trường NODE_ENV=development (MESSAGE_RATE_LIMIT_PER_MIN=20 mặc định; test env mặc định tắt rate limit)",
      ["member1 gửi liên tiếp 20 tin vào " + CONV + " trong < 60 giây (tin thứ 1..20)", "Gửi tin thứ 21", "Chờ > 60 giây rồi gửi lại"], "21 tin / phút",
      "20 tin đầu 201; tin thứ 21: 429 TOO_MANY_REQUESTS, message \"Bạn gửi tin nhắn quá nhanh, vui lòng thử lại sau\"; sau khi cửa sổ trượt 60s qua thì gửi lại được 201. Giá trị 20/phút là mặc định (tạm).", pw=PW)
    n(F, "Rate limit theo người gửi, không ảnh hưởng người khác", "Bảo mật", "Trung bình", SEED_C + "; đã làm member1 chạm 429 (case trên)",
      ["member2 gửi 1 tin vào " + CONV, "member1 gửi tin vào hội thoại khác (với member3)"], "member1 đang bị 429",
      "member2: 201 bình thường; member1 gửi sang hội thoại khác vẫn 429 (giới hạn theo user, không theo hội thoại).")
    n(F, "MESSAGE_RATE_LIMIT_PER_MIN=0 tắt giới hạn", "Chức năng", "Thấp", "Đặt env MESSAGE_RATE_LIMIT_PER_MIN=0 và khởi động lại BE; " + SEED_C,
      ["member1 gửi 30 tin liên tiếp"], "30 tin", "Cả 30 tin 201, không 429.", pw=NO)

    F = "Thu hồi tin nhắn"
    n(F, "Người gửi thu hồi tin: nội dung bị xóa, đánh dấu deleted", "Chức năng", "Cao", SEED_C,
      ["member1: DELETE /api/messages/seed-msg-8", "GET /api/conversations/" + CONV + "/messages"], "id=seed-msg-8",
      "200 data {id:seed-msg-8, content:\"Tin nhắn đã bị thu hồi\", attachments:[], deleted:true}; lịch sử cũng trả tin đó dạng đã thu hồi (DB: content='', deletedAt được gán).")
    n(F, "Thu hồi tin làm giảm chưa đọc của người nhận (3 -> 2)", "Chức năng", "Trung bình", SEED_C,
      ["member1 thu hồi seed-msg-8", "member2: GET /api/messages/unread-count"], "seed-msg-8", "unreadCount của member2 = 2 (tin thu hồi không tính chưa đọc).")
    n(F, "Người nhận không được thu hồi tin của người gửi -> 403", "Bảo mật", "Cao", SEED_C,
      ["member2: DELETE /api/messages/seed-msg-6"], "tin của member1", "403 FORBIDDEN, message \"Chỉ người gửi mới được thu hồi tin nhắn\"; tin còn nguyên.")
    n(F, "Người thứ ba thu hồi tin -> 404 (không lộ tồn tại)", "Bảo mật", "Cao", SEED_C + "; member3 không thuộc hội thoại",
      ["member3: DELETE /api/messages/seed-msg-6"], "tin của cuộc member1-member2", "404 NOT_FOUND, message \"Không tìm thấy tin nhắn\" (không phải 403).")
    n(F, "Thu hồi tin không tồn tại -> 404", "Chức năng", "Thấp", SEED_C, ["member1: DELETE /api/messages/khong-ton-tai"], "-", "404 \"Không tìm thấy tin nhắn\".")
    n(F, "Thu hồi lại tin đã thu hồi (seed-msg-5) là idempotent", "Chức năng", "Thấp", SEED_C,
      ["member1: DELETE /api/messages/seed-msg-5 (đã thu hồi từ seed)"], "seed-msg-5",
      "200 với MessageView deleted=true (theo code không kiểm tra trạng thái đã thu hồi; chưa chốt có nên trả lỗi).")
    n(F, "Thu hồi qua UI: rê chuột, bấm ↩, xác nhận, cả hai phía thấy \"Tin nhắn đã bị thu hồi\"", "Chức năng", "Cao", SEED_C + "; 2 cửa sổ member1/member2 cùng mở /messages/" + CONV,
      ["member1 rê chuột lên tin \"Mình sẽ gửi danh sách địa điểm sau.\"", "Bấm biểu tượng ↩ và xác nhận", "Quan sát cửa sổ member2 (không F5)"], "seed-msg-8",
      "Tin đổi thành \"Tin nhắn đã bị thu hồi\" ở cả hai cửa sổ (SSE message_deleted); badge chưa đọc của member2 giảm.", pw=PART)

    F = "Đánh dấu đã đọc"
    n(F, "member2 đánh dấu đã đọc: unreadCount về 0", "Chức năng", "Cao", SEED_C,
      ["member2: POST /api/conversations/" + CONV + "/read", "GET /api/messages/unread-count"], "-",
      "200 {data:{unreadCount:0}}; unread-count tổng = 0; gọi lần 2 vẫn 200 (idempotent).")
    n(F, "Gửi tin cũng coi là đã đọc tới tin đó", "Chức năng", "Trung bình", SEED_C,
      ["member2 (đang chưa đọc 3 tin) gửi 1 tin trả lời", "member2: GET /api/conversations"], "content=\"Có nhé!\"",
      "Sau khi gửi, unreadCount phía member2 = 0 (readSeq tiến tới tin vừa gửi); phía member1 unreadCount = 1.")
    n(F, "Người thứ ba không đánh dấu đọc được -> 404", "Bảo mật", "Trung bình", SEED_C, ["member3: POST /api/conversations/" + CONV + "/read"], "-", E404C + ".")
    n(F, "Mở cuộc trò chuyện trên UI gọi /read và đưa badge tin nhắn về 0", "Chức năng", "Trung bình", SEED_C,
      ["Đăng nhập member2, thấy badge tin nhắn = 3", "Mở /messages/" + CONV, "Quan sát badge và Network"], "-",
      "Có request POST /conversations/" + CONV + "/read; badge = 0; hội thoại mất chấm chưa đọc.")

    F = "Tệp đính kèm tin nhắn"
    a = "member1 đã upload xong 1 ảnh png (purpose=message_attachment) -> có fileUrl /api/files/<key>"
    n(F, "Gửi tin kèm ảnh: contentType và size lấy từ server", "Chức năng", "Cao", SEED_C + "; " + a,
      ["POST .../messages body {\"content\":\"Ảnh đây\",\"attachments\":[{\"url\":\"<fileUrl>\",\"name\":\"a.png\",\"contentType\":\"application/x-fake\",\"size\":1}]}"],
      "contentType/size khai gian", "201; attachments[0].contentType=\"image/png\" và size = dung lượng thật đã upload (không dùng giá trị client khai); url = fileUrl.")
    n(F, "Tối đa 5 tệp/tin: 5 được, 6 bị từ chối", "Chức năng", "Trung bình", SEED_C + "; member1 có 6 file đã upload",
      ["POST với 5 attachments", "POST với 6 attachments"], "5 / 6 tệp", "5 tệp: 201; 6 tệp: " + VALERR + " (\"Tối đa 5 tệp đính kèm\").")
    n(F, "URL đính kèm ngoài hệ thống bị từ chối", "Bảo mật", "Cao", SEED_C,
      ["POST attachments url \"https://evil.example.com/a.png\"", "POST attachments url \"/api/files/../../etc/passwd\""], "url ngoài / traversal",
      "Cả hai " + VALERR + " (message trường \"Tệp đính kèm không hợp lệ\"); tin không được tạo.")
    n(F, "Đính kèm file của người khác (hoặc chưa PUT xong) bị từ chối", "Bảo mật", "Cao", SEED_C + "; member2 đã upload 1 file; member1 chỉ presign 1 file nhưng chưa PUT",
      ["member1 gửi tin đính kèm url file của member2", "member1 gửi tin đính kèm url file chưa PUT"], "2 url",
      "Cả hai 400 BAD_REQUEST, message \"Tệp đính kèm không hợp lệ hoặc không thuộc về bạn\".")
    n(F, "Thu hồi tin có đính kèm xóa luôn tham chiếu đính kèm", "Chức năng", "Trung bình", SEED_C + "; đã gửi tin có 1 ảnh đính kèm",
      ["DELETE /api/messages/<id tin có ảnh>", "GET lịch sử"], "-", "Tin trả về attachments=[] và content \"Tin nhắn đã bị thu hồi\", deleted=true.")
    n(F, "UI: chỉ gửi tệp (không gõ chữ) thì nội dung tự là \"Đã gửi N tệp đính kèm\"", "Chức năng", "Trung bình", SEED_C,
      ["Mở /messages/" + CONV, "Bấm biểu tượng ghim, chọn 2 ảnh png", "Bấm gửi khi ô nhập trống"], "2 ảnh",
      "Tin hiển thị 2 thumbnail và nội dung \"Đã gửi 2 tệp đính kèm\" (BE bắt buộc content ≥ 1 ký tự); file khác (pdf/zip) hiển thị dạng link tải.")
    n(F, "UI: tệp sai loại hoặc quá lớn báo lỗi trước khi upload", "Chức năng", "Trung bình", SEED_C,
      ["Ghim và chọn file .exe", "Ghim và chọn file 30MB (zip)"], ".exe, zip 30MB", "FE báo lỗi tiếng Việt ngay, không gửi request PUT; tin không được gửi.", pw=PW)

    F = "Chặn / bỏ chặn người dùng"
    n(F, "member3 đã chặn member2 (seed): member2 mở hội thoại với member3 -> 403", "Chức năng", "Cao", SEED_C,
      ["member2: POST /api/conversations body {\"userId\":\"<id member3>\"}"], "member2 -> member3",
      "403 FORBIDDEN, message \"Bạn không thể nhắn tin cho người dùng này\".")
    n(F, "member3 bỏ chặn member2 thì member2 nhắn lại được", "Chức năng", "Cao", SEED_C,
      ["member3: DELETE /api/users/<id member2>/block", "member2: POST /api/conversations {userId: member3}"], "-",
      "Bước 1: 200 {data:{blocked:false}}; bước 2: 201 tạo hội thoại; member2 gửi tin 201.")
    n(F, "Chặn có hiệu lực hai chiều: cả người chặn và bị chặn đều không gửi được", "Chức năng", "Cao", SEED_C,
      ["member1: POST /api/users/<id member2>/block", "member2: POST .../" + CONV + "/messages", "member1: POST .../" + CONV + "/messages"], "-",
      "Bước 1: 200 {blocked:true}; bước 2 và 3 đều 403 \"Bạn không thể nhắn tin cho người dùng này\" (lỗi chung, không tiết lộ ai chặn ai).")
    n(F, "Người chặn vẫn đọc được lịch sử; hội thoại có blockedByMe=true", "Chức năng", "Trung bình", SEED_C,
      ["member1 chặn member2", "member1: GET .../messages", "member1: GET /api/conversations"], "-",
      "Lịch sử 8 tin vẫn trả 200; conversation của member1 có blockedByMe=true.")
    n(F, "Chặn là idempotent; GET /me/blocks liệt kê", "Chức năng", "Trung bình", SEED_C,
      ["member1: POST block member2 hai lần", "GET /api/me/blocks"], "-", "Cả hai lần 200 blocked:true; /me/blocks có đúng 1 phần tử {id:member2, name, blockedAt}, không trùng.")
    n(F, "Bỏ chặn người chưa chặn -> vẫn 200 (idempotent)", "Chức năng", "Thấp", SEED_C, ["member1: DELETE /api/users/<id member3>/block"], "-", "200 {data:{blocked:false}}.")
    n(F, "Không chặn được chính mình / user không tồn tại", "Chức năng", "Trung bình", SEED_C,
      ["member1: POST /api/users/<id member1>/block", "POST /api/users/khong-ton-tai/block"], "-",
      "Lần 1: 400 \"Bạn không thể chặn chính mình\"; lần 2: 404 \"Không tìm thấy người dùng\".")
    n(F, "UI: nút Chặn (xác nhận) thay ô nhập bằng dòng \"Bạn đã chặn…\" và bỏ chặn từ danh sách", "Giao diện", "Trung bình", SEED_C,
      ["member1 mở /messages/" + CONV, "Bấm \"Chặn\" và xác nhận", "Bấm biểu tượng khiên để mở \"Người dùng đã chặn\"", "Bấm \"Bỏ chặn\""], "-",
      "Sau chặn ô nhập bị thay bằng dòng \"Bạn đã chặn…\"; danh sách chặn có member2; bỏ chặn xong ô nhập trở lại và gửi được tin.")

    F = "Bảo mật tin nhắn (IDOR & xác thực)"
    n(F, "IDOR đọc: member3 đọc lịch sử hội thoại của member1-member2 -> 404", "Bảo mật", "Cao", SEED_C,
      ["member3: GET /api/conversations/" + CONV + "/messages"], "-", E404C + " (không phải 403); không rò nội dung.")
    n(F, "IDOR gửi: member3 gửi tin vào hội thoại của người khác -> 404", "Bảo mật", "Cao", SEED_C,
      ["member3: POST /api/conversations/" + CONV + "/messages body {\"content\":\"xen ngang\"}", "member1: GET lịch sử"], "-",
      E404C + "; lịch sử vẫn 8 tin (không có \"xen ngang\").")
    n(F, "IDOR danh sách: member3 không thấy hội thoại của người khác", "Bảo mật", "Trung bình", SEED_C,
      ["member3: GET /api/conversations"], "-", "Không có hội thoại " + CONV + " trong danh sách của member3.")
    n(F, "IDOR UI: member3 mở /messages/" + CONV + " -> \"Không tìm thấy cuộc trò chuyện\"", "Bảo mật", "Cao", SEED_C,
      ["Đăng nhập member3", "Mở trực tiếp /messages/" + CONV], "-", "Trang báo \"Không tìm thấy cuộc trò chuyện\"; không hiển thị tin nhắn.")
    n(F, "Mở /messages/id-sai -> \"Không tìm thấy cuộc trò chuyện\"", "Giao diện", "Thấp", SEED_C, ["member1 mở /messages/id-sai"], "-", "Thông báo không tìm thấy, không trắng trang.")
    n(F, "Không có token: mọi endpoint tin nhắn trả 401", "Bảo mật", "Cao", "Không đăng nhập",
      ["GET /api/conversations", "POST /api/conversations", "GET /api/conversations/" + CONV + "/messages", "POST .../messages", "DELETE /api/messages/seed-msg-1",
       "GET /api/messages/unread-count", "POST /api/users/x/block", "GET /api/me/blocks", "POST /api/messages/stream-ticket"], "-", "Cả 9 request " + E401 + ".")

    F = "Realtime SSE tin nhắn"
    n(F, "Vé tin nhắn: POST /messages/stream-ticket trả ticket + expiresAt, dùng 1 lần", "Chức năng", "Cao", SEED_C,
      ["member1: POST /api/messages/stream-ticket", "Mở GET /api/messages/stream?ticket=<vé>", "Mở lại với cùng vé"], "-",
      "Bước 1: 200 {data:{ticket, expiresAt(+30s)}} (lưu ý: code trả 200, khác endpoint thông báo trả 201); bước 2: 200 text/event-stream với event \"ready\"; bước 3: " + E401 + ".")
    n(F, "Vé tin nhắn hết hạn sau 30 giây / vé lạ -> 401", "Bảo mật", "Trung bình", SEED_C,
      ["Xin vé, chờ 31 giây, mở stream", "GET /api/messages/stream?ticket=abc", "GET /api/messages/stream"], "-", "Cả ba " + E401 + ". Stream tin nhắn KHÔNG hỗ trợ ?access_token= (chỉ Bearer hoặc ticket).")
    n(F, "Người nhận nhận event \"message\" theo thời gian thực", "Tích hợp", "Cao", SEED_C + "; 2 cửa sổ member1 / member2",
      ["member2 mở stream (hoặc mở app)", "member1 gửi \"Chào member2\" vào " + CONV, "Quan sát cửa sổ member2 không F5"], "content=\"Chào member2\"",
      "member2 nhận \"event: message\" với payload MessageView đúng; hội thoại nhảy lên đầu danh sách và badge tăng ngay.", pw=PART)
    n(F, "Các tab khác của người gửi cũng nhận event \"message\" (đồng bộ)", "Tích hợp", "Trung bình", SEED_C,
      ["member1 mở 2 tab cùng /messages/" + CONV, "Gửi tin ở tab 1"], "-", "Tab 2 hiển thị tin vừa gửi ngay, không nhân đôi trong tab 1.", pw=PART)
    n(F, "Thu hồi phát event \"message_deleted\" tới cả hai bên", "Tích hợp", "Cao", SEED_C,
      ["Cả hai mở stream", "member1 thu hồi seed-msg-8"], "-", "Cả member1 và member2 nhận \"event: message_deleted\" với MessageView deleted=true.", pw=PART)
    n(F, "Không nhận tin của hội thoại mà mình không tham gia", "Bảo mật", "Cao", SEED_C + "; member3 mở stream",
      ["member1 gửi tin cho member2", "Quan sát stream của member3"], "-", "Stream member3 không nhận event message (chỉ ping); event chỉ gửi tới người gửi và người nhận.", pw=PART)
    n(F, "Người nhận offline nhận thông báo message_received (gộp 1/5 phút)", "Tích hợp", "Cao", SEED_C + "; member2 KHÔNG mở tab nào (không kết nối SSE)",
      ["member1 gửi tin \"A\" vào " + CONV, "member1 gửi tiếp tin \"B\" ngay sau đó", "member2: GET /api/notifications"], "2 tin trong < 5 phút",
      "member2 có đúng 1 thông báo type=message_received, title \"<tên member1> đã gửi tin nhắn cho bạn\", body=nội dung tin \"A\" (cắt ~80 ký tự + \"...\"), link /messages/" + CONV + "; tin \"B\" không tạo thêm thông báo (gộp tối đa 1 thông báo/cuộc/người nhận/5 phút bằng khóa SET NX PX ở state chia sẻ - Redis hoặc in-memory). Thông báo luôn được lưu, không phụ thuộc online/offline (messages.md Thông báo).")
    n(F, "Người nhận đang online chỉ nhận realtime, không tạo thông báo", "Tích hợp", "Trung bình", SEED_C + "; member2 mở app (có SSE tin nhắn)",
      ["member2 ghi unread-count thông báo", "member1 gửi tin", "member2: GET /api/notifications/unread-count"], "-", "Số thông báo chưa đọc của member2 không đổi (không có message_received).", pw=PART)
    n(F, "Heartbeat \": ping\" mỗi 25 giây trên stream tin nhắn", "Tích hợp", "Thấp", SEED_C, ["Mở stream tin nhắn", "Đọc trong 60 giây"], "-", "Có ít nhất 2 dòng \": ping\"; kết nối không bị đóng.")

    F = "Tin nhắn qua UI"
    n(F, "Enter gửi, Shift+Enter xuống dòng", "Giao diện", "Trung bình", SEED_C, ["Mở /messages/" + CONV, "Gõ \"dòng 1\", nhấn Shift+Enter, gõ \"dòng 2\"", "Nhấn Enter"], "-",
      "Tin gửi đi có 2 dòng \"dòng 1\\ndòng 2\"; ô nhập được làm trống.")
    n(F, "Nút chat ở bảng Thành viên: mở /messages/<id>; khóa với chính mình và thành viên minh họa", "Chức năng", "Trung bình", SEED_C,
      ["member1 vào /courses/photo/community/thanh-vien", "Bấm nút chat cạnh member2", "Quay lại, quan sát nút ở dòng của mình và ở thành viên minh họa (demo-...)"], "-",
      "Bấm nút cạnh member2 chuyển tới /messages/" + CONV + "; nút ở dòng chính mình và thành viên minh họa bị khóa.")
    n(F, "Tải tin cũ hơn (>30 tin) không làm nhảy vị trí cuộn", "Giao diện", "Thấp", SEED_C + "; hội thoại có ≥ 40 tin (script gửi thêm)",
      ["Mở hội thoại, cuộn lên đầu", "Bấm \"Tải tin cũ hơn\""], "40 tin", "Nạp thêm ≤ 30 tin cũ; vị trí cuộn giữ nguyên tại tin đang xem.", pw=PART)
    n(F, "Chưa làm: sửa tin, trạng thái đang gõ, báo cáo tin nhắn, xóa cuộc trò chuyện", "Chức năng", "Thấp",
      "Chưa làm: sửa tin, đang gõ, \"đã xem\" cho người gửi, xóa cuộc trò chuyện, báo cáo tin, nhóm chat, tìm người để bắt đầu chat",
      ["Tìm trong UI các nút tương ứng"], "-", "(Kế hoạch) Hiện chưa có nút/endpoint tương ứng.", pw=NO, status=PLAN)

    # ------------------------------------------------------------------ SEARCH
    M, MN = "SEARCH", "Tìm kiếm toàn cục"

    def s(feature, title, tt, pri, pre, steps, data, exp, pw=PW, status=DONE):
        add(M, MN, feature, title, tt, pri, status, pre, steps, data, exp, pw=pw)

    S0 = "Đăng nhập member1@sofinhub.test / " + PWD + " (thành viên photo, yt, fin). Dữ liệu seed photo: khóa \"Nhiếp ảnh\", bài viết về ảnh chân dung"
    F = "Tìm kiếm API: cơ bản"
    s(F, "Tìm \"nhiếp ảnh\" trả kết quả nhóm khóa học, thành viên, bài viết + counts", "Chức năng", "Cao", S0,
      ["GET /api/search?q=nhiếp ảnh"], "q=nhiếp ảnh",
      "200; data xếp theo thứ tự khóa học -> thành viên -> bài viết (trong nhóm xếp theo độ liên quan ts_rank/điểm tên, rồi mới nhất - Postgres full-text, search.md); meta {page:1, limit:10, total, totalPages}; counts {courses, members, posts} đúng tổng theo loại; mỗi phần tử có trường type và link.")
    s(F, "type=courses chỉ trả khóa học công khai (title/description khớp)", "Chức năng", "Cao", S0,
      ["GET /api/search?q=nhiếp ảnh&type=courses"], "type=courses",
      "Mọi phần tử type=\"course\" có {id, title: Segment[], snippet: Segment[], link:\"/courses/<id>\"}; counts.members=0 và counts.posts=0.")
    s(F, "type=posts chỉ trả bài viết trong cộng đồng của user", "Chức năng", "Cao", S0,
      ["GET /api/search?q=chân dung&type=posts"], "q=chân dung",
      "Mọi phần tử type=\"post\" {id, courseId, courseTitle, author, snippet, createdAt, link:\"/courses/<cid>/community?post=<id>\"}; sắp theo độ liên quan (ts_rank) rồi mới nhất; snippet có ít nhất 1 segment match=true.")
    s(F, "type=members trả thành viên khớp tên/handle trong cộng đồng của user", "Chức năng", "Cao", S0,
      ["GET /api/search?q=member2&type=members"], "q=member2",
      "Phần tử type=\"member\" {id, courseId, courseTitle, name: Segment[], handle, role: admin|member, link}; chỉ thuộc cộng đồng member1 tham gia (photo); khớp theo họ tên ('Mai Member2', tiền tố từng từ); handle (slug-NNNN) chỉ khớp phần slug khi q có dấu '-' (vd q=mai-member2), không tra phần số đuôi.")
    s(F, "Không dấu / hoa thường: \"NHIEP ANH\" khớp \"Nhiếp ảnh\"", "Chức năng", "Cao", S0,
      ["GET /api/search?q=nhiep anh", "GET /api/search?q=NHIEP ANH", "GET /api/search?q=nhiếp ảnh"], "3 biến thể",
      "Ba request trả cùng tập kết quả/counts; segment match=true bọc đúng đoạn chữ gốc CÓ dấu (\"Nhiếp ảnh\").")
    s(F, "Chữ đ/Đ: q=\"dieu\" khớp \"điều\", q=\"ĐIỀU\" khớp \"điều\"", "Chức năng", "Trung bình", S0 + "; có bài/khóa chứa chữ \"điều\"",
      ["GET /api/search?q=dieu", "GET /api/search?q=ĐIỀU"], "đ -> d", "Cả hai request khớp; đ được chuẩn hóa thành d; segment tô đúng vị trí ký tự gốc.")
    s(F, "Khớp chuỗi con nguyên cụm (không tách từ)", "Chức năng", "Thấp", S0,
      ["GET /api/search?q=chân dung ánh", "GET /api/search?q=ánh dung chân"], "cụm liền vs đảo thứ tự",
      "Cụm liền khớp bài \"...chân dung ánh sáng...\"; cụm đảo thứ tự không khớp (chỉ khớp chuỗi con nguyên cụm, không xếp hạng - Postgres full-text chưa làm).")
    s(F, "Không có kết quả: data=[] và counts về 0", "Chức năng", "Trung bình", S0,
      ["GET /api/search?q=zzzxyz123"], "q không tồn tại", "200; data=[]; meta.total=0, totalPages=1; counts {0,0,0}; UI hiển thị \"Không có kết quả\".")

    F = "Tìm kiếm API: validate & giới hạn"
    for lab, q, why in [("q thiếu", "", "không truyền q"), ("q rỗng", "q=", "q rỗng"), ("q 1 ký tự", "q=a", "dưới 2 ký tự"),
                        ("q chỉ khoảng trắng", "q=%20%20%20", "trim ra rỗng")]:
        s(F, "Từ chối " + lab + " (" + why + ")", "Chức năng", "Cao", S0, ["GET /api/search" + ("?" + q if q else "")], q or "không có q",
          VALERR + " (details báo \"Từ khóa tối thiểu 2 ký tự\" hoặc thiếu q); không truy vấn dữ liệu.")
    s(F, "Biên độ dài q: 2 ký tự OK, 100 ký tự OK, 101 ký tự bị từ chối", "Chức năng", "Cao", S0,
      ["GET /api/search?q=an", "GET /api/search?q=<100 ký tự 'a'>", "GET /api/search?q=<101 ký tự 'a'>"], "2 / 100 / 101 ký tự",
      "2 và 100: 200; 101: " + VALERR + " (\"Từ khóa tối đa 100 ký tự\").")
    s(F, "q được trim khoảng trắng đầu/cuối", "Chức năng", "Thấp", S0, ["GET /api/search?q=%20%20nhiep%20anh%20%20"], "\"  nhiep anh  \"", "Kết quả giống q=nhiep anh.")
    s(F, "type ngoài enum bị từ chối", "Chức năng", "Trung bình", S0, ["GET /api/search?q=anh&type=events"], "type=events", VALERR + ".")
    s(F, "limit>50, limit=0, page=0 bị từ chối; limit=50 OK", "Chức năng", "Trung bình", S0,
      ["GET /api/search?q=anh&limit=51", "...&limit=0", "...&page=0", "...&limit=50"], "-", "Ba request đầu " + VALERR + "; limit=50: 200, meta.limit=50.")
    s(F, "Phân trang chung cho type=all: limit=2 chia trang đúng, không trùng", "Chức năng", "Cao", S0 + "; q có ≥ 5 kết quả (vd. q=anh)",
      ["GET /api/search?q=anh&limit=2&page=1", "...&page=2", "...&page=<totalPages>"], "limit=2",
      "Mỗi trang ≤ 2 phần tử, không trùng id giữa các trang; meta.total và counts không đổi; trang cuối có phần còn lại; page vượt quá totalPages trả data=[].")
    s(F, "Khách (không token) bị từ chối: search và suggest -> 401", "Bảo mật", "Cao", "Không đăng nhập",
      ["GET /api/search?q=anh", "GET /api/search/suggest?q=anh"], "-",
      "Cả hai " + E401 + " (tìm kiếm yêu cầu đăng nhập; khác với trang chủ /courses tìm khóa học công khai không cần đăng nhập).")
    s(F, "Rate limit 40 request/phút/user -> 429", "Bảo mật", "Cao", S0 + "; NODE_ENV=development (test env gần như vô hạn)",
      ["Gọi GET /api/search?q=anh 40 lần trong < 60s", "Gọi lần thứ 41", "Chờ 60s rồi gọi lại"], "41 request/phút",
      "40 request đầu 200; thứ 41: 429 TOO_MANY_REQUESTS, message \"Bạn tìm kiếm quá nhanh, vui lòng thử lại sau\"; sau 60s lại 200. suggest dùng chung bộ đếm 40/phút (tạm).")
    s(F, "Rate limit theo từng user (member2 không bị ảnh hưởng)", "Bảo mật", "Trung bình", S0 + "; member1 đã bị 429",
      ["member2: GET /api/search?q=anh"], "-", "member2 nhận 200 bình thường.")

    F = "Phạm vi & riêng tư kết quả"
    s(F, "Khóa học: chỉ khóa visibility=public, private-demo không xuất hiện", "Bảo mật", "Cao", S0 + "; cộng đồng private-demo (riêng tư, tự đặt tên chứa \"Demo\"); member1 có JoinRequest pending ở private-demo",
      ["GET /api/search?q=private-demo&type=courses", "GET /api/search?q=demo&type=courses"], "-",
      "Không có kết quả id=private-demo trong nhóm khóa học (khóa học chỉ tìm trong visibility=public); paid-demo (công khai) thì xuất hiện.")
    s(F, "Bài viết & thành viên chỉ trong cộng đồng đã tham gia", "Bảo mật", "Cao", "Đăng nhập newbie@sofinhub.test / " + PWD + " (chưa ở cộng đồng nào)",
      ["newbie: GET /api/search?q=chân dung", "newbie: GET /api/search?q=member2&type=members"], "-",
      "counts.posts=0 và counts.members=0 (chưa thuộc cộng đồng nào) dù photo có nội dung khớp; chỉ có thể còn kết quả khóa học công khai.")
    s(F, "member1 không thấy bài viết của cộng đồng mình không tham gia", "Bảo mật", "Cao", S0 + "; member2 chỉ ở photo, member1 ở photo+yt+fin; nội dung chỉ có ở cộng đồng mà member2 không tham gia",
      ["member2: GET /api/search?q=<từ chỉ có trong bài ở cộng đồng yt>&type=posts", "member1: cùng truy vấn"], "-",
      "member2: 0 bài; member1: có bài của yt.")
    s(F, "courseId hợp lệ + là thành viên: chỉ trả kết quả của cộng đồng đó", "Chức năng", "Trung bình", S0,
      ["GET /api/search?q=anh&courseId=photo"], "courseId=photo", "Mọi post/member có courseId=\"photo\"; không lẫn yt/fin.")
    s(F, "courseId mà không phải thành viên -> 403", "Bảo mật", "Cao", "Đăng nhập member2@sofinhub.test / " + PWD + " (chỉ ở photo)",
      ["GET /api/search?q=anh&courseId=yt"], "courseId=yt", "403 FORBIDDEN (không phải thành viên); không rò dữ liệu của yt.")
    s(F, "courseId không tồn tại -> 404", "Chức năng", "Thấp", S0, ["GET /api/search?q=anh&courseId=khong-co"], "courseId=khong-co", "404 NOT_FOUND.")
    s(F, "type=courses không cần là thành viên kể cả khi courseId là khóa chưa tham gia", "Chức năng", "Thấp", "Đăng nhập member2 (chỉ ở photo)",
      ["GET /api/search?q=<từ tiêu đề khóa yt>&type=courses&courseId=yt"], "-",
      "Theo code, type=courses không kiểm tra thành viên (khóa học công khai) -> 200 trả khóa yt nếu khớp; nhưng type=all/posts/members với cùng courseId -> 403 (ghi nhận, chưa chốt).")
    s(F, "Bài viết bị ẩn (hidden) chỉ mod trở lên thấy", "Bảo mật", "Cao", "Có 1 bài ở photo đã bị mod ẩn (nội dung chứa \"kín-ẩn-123\"); đăng nhập member1 rồi mod@sofinhub.test",
      ["member1: GET /api/search?q=kín-ẩn-123&type=posts", "mod: cùng truy vấn"], "-",
      "member1: 0 kết quả; mod: 1 kết quả. LƯU Ý: docs ghi Post chưa có trường hidden nên bước lọc chưa có tác dụng - nếu member1 vẫn thấy bài ẩn thì đây là lỗi/chưa hoàn thiện (chưa chốt); kiểm thêm bài bị mod xóa không xuất hiện.")
    s(F, "Thành viên banned không xuất hiện trong kết quả thành viên của photo", "Bảo mật", "Trung bình", S0 + "; banned@sofinhub.test bị ban khỏi photo",
      ["member1: GET /api/search?q=banned&type=members"], "q=banned", "Không có kết quả của tài khoản bị ban trong photo (kết quả lấy từ danh sách thành viên hiện tại của cộng đồng); ghi nhận nếu vẫn xuất hiện.")
    s(F, "Tài khoản đã xóa/ẩn danh hóa không lộ tên gốc trong kết quả", "Bảo mật", "Cao", "Một user test đã xóa tài khoản (ẩn danh hóa) trước đó, từng có bài ở photo",
      ["member1: GET /api/search?q=<tên cũ của user đã xóa>", "Xem tác giả bài cũ"], "tên cũ",
      "Không tìm ra theo tên gốc; nếu bài còn hiển thị thì author là tên ẩn danh hóa, không lộ email/tên thật.", pw=PART)
    s(F, "Thành viên minh họa (isDemo) có trong kết quả, link không dẫn tới hồ sơ đăng nhập", "Chức năng", "Thấp", S0 + "; thành viên minh họa id demo-<courseId>-<i>",
      ["GET /api/search?q=<tên một thành viên minh họa>&type=members"], "-",
      "Trả phần tử member (nếu listMembers gồm demo); link từ API là /courses/<cid>/community?tab=members (docs FE ghi /users/:id cho người thật, tab Thành viên ?q=handle cho minh họa: kiểm tra FE xử lý đúng).")

    F = "Gợi ý (suggest)"
    s(F, "Suggest trả tối đa 5 mục, xen kẽ khóa học/thành viên/bài viết", "Chức năng", "Cao", S0 + "; q có nhiều kết quả (vd. q=anh)",
      ["GET /api/search/suggest?q=anh"], "q=anh", "200 {data:[...]}, độ dài ≤ 5, không có meta/counts; thứ tự xen kẽ course, member, post, course, member...")
    s(F, "Suggest validate q giống search (rỗng/1 ký tự/101 ký tự)", "Chức năng", "Trung bình", S0,
      ["GET /api/search/suggest?q=a", "GET /api/search/suggest?q=", "GET /api/search/suggest?q=<101 ký tự>"], "-", "Cả ba " + VALERR + ".")
    s(F, "Suggest không dấu và tô đậm đoạn khớp", "Chức năng", "Trung bình", S0, ["GET /api/search/suggest?q=nhiep"], "q=nhiep",
      "Phần tử khóa học có title Segment[] với đoạn \"Nhiếp\" match=true; các đoạn còn lại match=false.")
    s(F, "UI topbar: gõ ≥ 2 ký tự sau ~250ms hiện dropdown ≤ 5 gợi ý; phím ↑ ↓ Enter Esc", "Chức năng", "Cao", S0,
      ["Vào /courses/photo/community", "Nhấn Ctrl+K để focus ô tìm kiếm", "Gõ \"nh\"", "Nhấn ↓ hai lần, Enter", "Mở lại, gõ \"nh\", nhấn Esc"], "q=nh",
      "Sau ~250ms dropdown ≤ 5 gợi ý, phần khớp được bôi đậm; Enter mở đúng mục đang chọn; Esc đóng; dòng cuối \"Xem tất cả kết quả\"; Enter khi không chọn mục nào -> /search?q=nh.")
    s(F, "UI topbar: gõ 1 ký tự không gọi suggest", "Giao diện", "Thấp", S0, ["Gõ \"n\" vào ô tìm kiếm", "Quan sát Network"], "1 ký tự", "Không có request /search/suggest; không hiện dropdown (hoặc gợi ý nhập ít nhất 2 ký tự).")

    F = "Trang /search (UI)"
    s(F, "Trang /search có tab Tất cả/Khóa học/Bài viết/Thành viên kèm số lượng", "Chức năng", "Cao", S0,
      ["Mở /search?q=nhiep anh", "Bấm từng tab"], "q=nhiep anh", "Số lượng trên tab bằng counts của API; đổi tab cập nhật type trên URL (type=posts...) và danh sách; phần khớp bọc <mark>.")
    s(F, "Bộ lọc \"Mọi cộng đồng\" theo cộng đồng của tôi (courseId)", "Chức năng", "Trung bình", S0, ["Mở /search?q=anh", "Chọn cộng đồng photo ở bộ lọc"], "courseId=photo", "URL thêm courseId=photo; kết quả chỉ của photo; chọn lại \"Mọi cộng đồng\" trả đủ.")
    s(F, "Bấm kết quả: bài viết -> ?post=, khóa học -> /courses/:id", "Chức năng", "Trung bình", S0,
      ["Bấm một kết quả bài viết", "Quay lại, bấm một kết quả khóa học"], "-", "Bài viết mở /courses/<cid>/community?post=<id>; khóa học mở /courses/<id>. (Cuộn tới bài ?post= phụ thuộc FE community.)")
    s(F, "Phân trang giữ nguyên q/type/courseId trên URL", "Chức năng", "Trung bình", S0 + "; q có > 10 kết quả",
      ["Mở /search?q=anh&type=posts", "Bấm trang 2", "Tải lại trang (F5)"], "page=2", "URL giữ q, type và thêm page=2; sau F5 vẫn ở trang 2 với cùng bộ lọc.")
    s(F, "UI lỗi: q < 2 ký tự -> \"Nhập ít nhất 2 ký tự\"; 429; courseId lạ -> 403", "Chức năng", "Trung bình", S0,
      ["Mở /search?q=a", "Mở /search?q=anh&courseId=yt bằng member2", "Vượt 40 lần/phút"], "-",
      "Trường hợp 1: \"Nhập ít nhất 2 ký tự\"; trường hợp 2: thông báo lỗi 403 dễ hiểu; trường hợp 3: thông báo thử lại sau (429); không màn hình trắng.")

    F = "Bảo mật nội dung kết quả"
    s(F, "XSS: tìm <script> / <b>x</b> hiển thị chữ thô, không render HTML", "Bảo mật", "Cao", S0 + "; có 1 bài ở photo chứa chuỗi \"<b>x</b>\" (nếu BE cho phép lưu thô)",
      ["Mở /search?q=<b>x</b>", "Mở /search?q=<script>alert(1)</script>"], "q chứa thẻ HTML",
      "Kết quả và tiêu đề trang hiển thị chữ thô; không có alert; API trả Segment[] {text, match} (không có HTML); FE dùng text node + <mark>.")
    s(F, "Snippet/highlight: nội dung bài chứa HTML không thực thi", "Bảo mật", "Cao", S0 + "; member1 đăng bài ở photo với nội dung \"khuyen mai <img src=x onerror=alert(1)> gia re\"",
      ["Tìm q=khuyen mai", "Xem snippet"], "content chứa thẻ img",
      "Snippet hiển thị dạng chữ (\"<img src=x ...>\" thấy nguyên văn hoặc bị lược theo quy tắc bài viết); không có request tới x; không alert.", pw=PART)
    s(F, "Ký tự regex/SQL trong q được coi là chuỗi thường", "Bảo mật", "Cao", S0,
      ["GET /api/search?q=(.*)", "GET /api/search?q=' OR '1'='1", "GET /api/search?q=%25%25"], "3 payload",
      "200 (không 500), không phải ký tự đặc biệt: %, _, \ được escape cho LIKE và q được làm sạch trước khi tạo tsquery (thường 0 kết quả); không lỗi cú pháp regex/SQL/tsquery.")
    s(F, "Tôn trọng riêng tư sau khi rời cộng đồng: hết thấy bài của cộng đồng đó", "Bảo mật", "Cao", "member3 đang ở photo và thấy bài ảnh chân dung qua tìm kiếm",
      ["member3: GET /api/search?q=chân dung&type=posts (ghi số bài)", "member3 rời cộng đồng photo", "Tìm lại cùng truy vấn"], "-", "Sau khi rời: posts=0 và members=0 cho photo (tìm kiếm chỉ trong cộng đồng đang là thành viên).")

    F = "Postgres full-text search (chưa làm)"
    s(F, "Chưa làm: tìm bằng tsvector/GIN, xếp hạng độ liên quan, sửa lỗi gõ", "Chức năng", "Trung bình",
      "Chưa làm: cột tsvector + GIN (unaccent, to_tsquery('simple')) hoặc pg_trgm; hiện lọc trong bộ nhớ, trần 20 trang x 50 mục/cộng đồng",
      ["Sau khi nâng cấp: tìm từ khóa 2 từ đảo thứ tự", "Tìm sai chính tả 1 ký tự"], "q=\"ánh dung chân\" / \"nhiep anhh\"",
      "(Kế hoạch) Khớp theo từ và xếp theo độ liên quan; hiện tại không khớp (chỉ khớp chuỗi con nguyên cụm).", status=PLAN)
    s(F, "Chưa làm: tìm trong bình luận, sự kiện, bài học, thẻ #tag, lịch sử tìm kiếm", "Chức năng", "Thấp",
      "Chưa làm: docs/search.md mục \"Chưa làm\"", ["Tìm nội dung chỉ nằm trong 1 bình luận", "Tìm tên một sự kiện"], "-",
      "(Kế hoạch) Hiện không có kết quả bình luận/sự kiện; sau khi làm sẽ có nhóm kết quả mới.", pw=NO, status=PLAN)
    s(F, "Hiệu năng: quét trong bộ nhớ, cộng đồng lớn có thể trần 1000 mục", "Hiệu năng", "Thấp",
      "Cộng đồng test có > 1000 bài (script sinh), member1 là thành viên", ["Tìm từ chỉ có ở bài cũ nhất (ngoài 1000 bài mới nhất)", "Đo thời gian phản hồi GET /search"], "1200 bài",
      "Có thể bỏ sót bài vượt trần 20 trang x 50 (giới hạn đã biết, cần đẩy xuống SQL); thời gian phản hồi ghi nhận; không 500.", pw=NO)

    # ------------------------------------------------------------------ UPLOAD
    M, MN = "UPLOAD", "Upload tệp & ảnh"

    def u(feature, title, tt, pri, pre, steps, data, exp, pw=PW, status=DONE):
        add(M, MN, feature, title, tt, pri, status, pre, steps, data, exp, pw=pw)

    U0 = "Đăng nhập member1@sofinhub.test / " + PWD + " (quota upload trống, chưa upload gì). BE dev :4000, thư mục data/uploads"
    BAD = "400 BAD_REQUEST, message \"Loại file này không được phép tải lên cho mục đích đã chọn\""

    F = "Presign: xin vé upload"
    u(F, "Presign ảnh PNG 1MB (post_image) thành công", "Chức năng", "Cao", U0,
      ["POST /api/uploads/presign (Bearer) body {\"filename\":\"anh.png\",\"contentType\":\"image/png\",\"size\":1048576,\"purpose\":\"post_image\"}"], "PNG 1MB",
      "201; data {uploadUrl:\"/api/uploads/<key>?token=...\", method:\"PUT\", headers:{\"Content-Type\":\"image/png\"}, fileUrl:\"/api/files/<key>\", key, expiresAt (~+600s)}; key khớp ^[a-f0-9]{32}\\.png$ (tên gốc anh.png KHÔNG nằm trong key).")
    u(F, "Presign thiếu token -> 401", "Bảo mật", "Cao", "Không đăng nhập", ["POST /api/uploads/presign body hợp lệ không có Authorization"], "-", E401 + ".")
    u(F, "Validate body: thiếu tên file, tên > 200 ký tự", "Chức năng", "Trung bình", U0,
      ["POST presign filename \"\"", "POST presign filename 201 ký tự 'a'"], "filename rỗng / 201 ký tự", "Cả hai " + VALERR + " (details: \"Thiếu tên file\" / \"Tên file quá dài\").")
    u(F, "Validate size: 0, âm, số thực", "Chức năng", "Trung bình", U0,
      ["POST presign size 0", "size -5", "size 1.5"], "0 / -5 / 1.5", "Cả ba " + VALERR + " (\"Dung lượng phải lớn hơn 0\" / \"Dung lượng không hợp lệ\").")
    u(F, "purpose ngoài danh sách bị từ chối", "Chức năng", "Trung bình", U0, ["POST presign purpose \"avatar2\""], "purpose=avatar2", VALERR + " (details: \"Mục đích upload không hợp lệ\").")
    u(F, "Tên file chứa ký tự nguy hiểm chỉ lưu metadata đã làm sạch, không thành đường dẫn", "Bảo mật", "Cao", U0,
      ["POST presign filename \"../../etc/passwd\\u0000.png\" (contentType image/png, size 1000)", "PUT nội dung PNG hợp lệ", "GET /api/me/uploads"], "filename có ../ và NUL",
      "201; key vẫn là 32 hex + .png ngẫu nhiên; /me/uploads.filename đã thay /, \\, ký tự điều khiển bằng \"_\"; file được ghi trong data/uploads/<key>, không ghi ra ngoài thư mục.")
    u(F, "Tên file tiếng Việt / khoảng trắng / emoji được chấp nhận làm metadata", "Chức năng", "Thấp", U0,
      ["Presign filename \"Ảnh chân dung 📷.png\" và PUT ảnh", "GET /api/me/uploads"], "Ảnh chân dung 📷.png", "201; /me/uploads.filename giữ nguyên tên; khi tải file khác ảnh thì Content-Disposition có filename*=UTF-8''<tên mã hóa>.")

    F = "Loại file cho phép / bị cấm"
    for ct, ext, pur in [("image/jpeg", "jpg", "post_image"), ("image/webp", "webp", "avatar"), ("image/gif", "gif", "cover")]:
        u(F, "Cho phép " + ct + " với purpose " + pur, "Chức năng", "Trung bình", U0, ["POST presign contentType " + ct + ", purpose " + pur + ", size 2048"], ct + "/" + pur,
          "201; key kết thúc .%s." % ext)
    u(F, "SVG bị cấm cho ảnh (chống XSS)", "Bảo mật", "Cao", U0, ["POST presign contentType \"image/svg+xml\" filename \"a.svg\" purpose post_image", "Thử tiếp purpose avatar và message_attachment"], "image/svg+xml",
      "Cả ba lần " + BAD + "; không tạo bản ghi upload.")
    u(F, "HTML/JS/exe bị cấm", "Bảo mật", "Cao", U0, ["Presign contentType text/html", "application/javascript", "application/x-msdownload (.exe)", "application/x-php"], "4 contentType",
      "Cả bốn " + BAD + ".")
    u(F, "video/mp4 chỉ cho post_file/lesson_attachment, cấm với message_attachment", "Chức năng", "Trung bình", U0,
      ["Presign video/mp4 purpose post_file, size 1000", "Presign video/mp4 purpose message_attachment"], "video/mp4",
      "post_file: 201 (.mp4); message_attachment: " + BAD + ".")
    u(F, "Ảnh không cho purpose file; PDF không cho purpose ảnh", "Chức năng", "Trung bình", U0,
      ["Presign image/png purpose post_file", "Presign application/pdf purpose avatar", "Presign application/pdf purpose post_image"], "3 cặp sai",
      "Cả ba " + BAD + ". Riêng message_attachment cho phép cả ảnh lẫn pdf/zip/docx/xlsx/pptx/txt.")
    u(F, "Đuôi giả: file .exe/.php đổi tên .jpg khai contentType image/jpeg -> PUT bị từ chối theo magic bytes", "Bảo mật", "Cao", U0,
      ["Presign filename \"shell.php.jpg\" contentType image/jpeg size 60 purpose post_image", "PUT uploadUrl với Content-Type image/jpeg, body là chuỗi \"<?php system($_GET['c']); ?>\" hoặc header MZ của .exe", "GET /api/me/uploads", "GET /api/files/<key>"], "body không phải JPEG (không bắt đầu FF D8 FF)",
      "PUT trả 400 BAD_REQUEST, message \"Nội dung file không khớp với loại file khai báo\"; yêu cầu upload bị hủy: /me/uploads không có key; GET /files/<key> -> 404; không có file trên đĩa.")
    u(F, "Magic bytes đúng theo từng loại: PNG/JPEG/GIF/WebP/PDF/ZIP/MP4 được chấp nhận", "Chức năng", "Trung bình", U0,
      ["Với mỗi loại, presign đúng contentType rồi PUT nội dung có chữ ký đầu file thật (PNG 89504E47, PDF %PDF, ZIP PK, MP4 có 'ftyp' ở offset 4...)"], "7 file mẫu",
      "Cả 7 PUT trả 200 {data:{key,fileUrl,size,contentType}}; size = số byte thật.")
    u(F, "text/plain chứa byte NUL bị từ chối", "Bảo mật", "Trung bình", U0, ["Presign text/plain purpose post_file", "PUT body chứa byte 0x00"], "body có NUL",
      "400 \"Nội dung file không khớp với loại file khai báo\".")
    u(F, "Content-Type khi PUT lệch với vé -> 400 và vé chưa bị tiêu", "Bảo mật", "Cao", U0,
      ["Presign image/png", "PUT với Content-Type image/jpeg", "PUT lại với Content-Type image/png, body PNG đúng"], "png vs jpeg",
      "Bước 2: 400 BAD_REQUEST \"Content-Type không khớp với vé upload\"; bước 3: 200 (vé chỉ bị tiêu khi mọi ràng buộc header đạt).")
    u(F, "PUT không gửi Content-Type -> 400", "Chức năng", "Thấp", U0, ["Presign image/png", "PUT không có header Content-Type"], "-", "400 \"Content-Type không khớp với vé upload\".")

    F = "Giới hạn dung lượng theo loại"
    for pur, lim, ct, lab in [("post_image", 5, "image/png", "ảnh bài viết 5MB"), ("avatar", 3, "image/png", "avatar 3MB"), ("cover", 8, "image/jpeg", "ảnh bìa 8MB"), ("post_file", 25, "application/pdf", "file tài liệu 25MB")]:
        u(F, "Biên " + lab + ": đúng " + str(lim) + "MB OK, +1 byte bị từ chối", "Chức năng", "Cao", U0,
          ["Presign purpose " + pur + " size = " + str(lim) + "*1048576", "Presign cùng purpose size = " + str(lim) + "*1048576 + 1"], "%dMB và %dMB+1 byte" % (lim, lim),
          "Đúng %dMB: 201; +1 byte: 400 BAD_REQUEST, message \"File quá lớn, tối đa %dMB cho mục đích này\" (chặn ngay tại presign; QUOTA_EXCEEDED chỉ khi vượt hạn mức tổng)." % (lim, lim))
    u(F, "PUT vượt dung lượng đã khai báo lúc presign -> 413 PAYLOAD_TOO_LARGE, không ghi file", "Bảo mật", "Cao", U0,
      ["Presign png size 1000", "PUT body PNG 5000 byte (Content-Length 5000)", "GET /api/me/uploads"], "khai 1000, gửi 5000",
      "413 với error.code=PAYLOAD_TOO_LARGE, message \"File vượt quá dung lượng đã khai báo\"; không file nào lưu (vé maxSize = size khai báo).")
    u(F, "PUT thân rỗng -> 400 \"File rỗng\"", "Chức năng", "Thấp", U0, ["Presign image/png size 1000", "PUT body rỗng"], "0 byte", "400 BAD_REQUEST \"File rỗng\"; yêu cầu upload bị hủy.")
    u(F, "PUT ít byte hơn khai báo được chấp nhận và size lưu là số byte thực", "Chức năng", "Thấp", U0,
      ["Presign png size 100000", "PUT PNG hợp lệ 2000 byte", "GET /api/me/uploads"], "khai 100000, gửi 2000", "200 size=2000; /me/uploads.size=2000 (size được thay bằng dung lượng thực).")

    F = "Vé PUT (HMAC, hết hạn, dùng lại)"
    u(F, "PUT không có token -> 401", "Bảo mật", "Cao", U0, ["PUT /api/uploads/<key hợp lệ> không có ?token"], "-", "401 UNAUTHORIZED, message \"Vé upload không hợp lệ\".")
    u(F, "Chữ ký sai: sửa 1 ký tự của token -> 401", "Bảo mật", "Cao", U0, ["Presign, lấy token", "Đổi ký tự cuối của chữ ký HMAC", "PUT với token đã sửa"], "token bị sửa", "401 \"Vé upload không hợp lệ\"; không ghi file.")
    u(F, "Sửa payload vé (tăng maxSize) làm chữ ký sai -> 401", "Bảo mật", "Cao", U0, ["Presign size 1000", "Giải base64url phần payload, sửa maxSize=99999999, mã hóa lại, giữ nguyên chữ ký", "PUT file 5000 byte"], "payload bị sửa", "401 \"Vé upload không hợp lệ\" (HMAC-SHA256 không khớp).")
    u(F, "Token do user A cấp không dùng cho key khác -> 403", "Bảo mật", "Cao", U0, ["Presign 2 lần: (key1, token1), (key2, token2)", "PUT /api/uploads/<key2>?token=<token1>"], "token1 + key2", "403 FORBIDDEN, message \"Vé upload không khớp với file\".")
    u(F, "Vé hết hạn (TTL 600s) -> 401", "Bảo mật", "Cao", U0 + "; đặt UPLOAD_TICKET_TTL_SEC=5 cho dễ test", ["Presign", "Chờ 6 giây", "PUT"], "TTL 5s", "401 \"Vé upload đã hết hạn\"; presign hết hạn không còn tính vào quota sau TTL.")
    u(F, "Nonce dùng 1 lần: PUT lại cùng vé sau khi thành công -> 401", "Bảo mật", "Cao", U0, ["Presign", "PUT lần 1 (200)", "PUT lần 2 cùng URL và cùng body"], "cùng token", "Lần 1: 200; lần 2: 401 \"Vé upload đã được sử dụng\"; file gốc không bị ghi đè.")
    u(F, "Không có Bearer vẫn PUT được với vé hợp lệ (vé thay xác thực)", "Chức năng", "Trung bình", U0, ["Presign bằng Bearer", "PUT uploadUrl KHÔNG gửi Authorization"], "-", "200; file thuộc về member1 (chủ theo vé); /me/uploads của member1 thấy file.")
    u(F, "Presign hết hạn nhưng chưa PUT vẫn chiếm chỗ quota đến hết TTL (mồ côi)", "Chức năng", "Thấp", U0, ["Presign 25MB (không PUT)", "Kiểm tra quota bằng cách presign tiếp cho tới sát 200MB"], "-", "25MB của presign còn hạn được tính vào hạn mức; sau TTL (600s) không còn tính. Chưa có job dọn file mồ côi (chưa làm).", pw=PART)

    F = "Hạn mức mỗi user (200MB)"
    u(F, "Vượt hạn mức 200MB -> 413 QUOTA_EXCEEDED", "Chức năng", "Cao", U0 + "; UPLOAD_USER_QUOTA_MB=200 mặc định",
      ["Presign 8 file zip 25MB (post_file) liên tiếp (tổng 200MB, chưa cần PUT vì presign còn hạn tính quota)", "Presign thêm 1 file txt 1 byte"], "8x25MB rồi +1 byte",
      "8 presign đầu 201 (đúng 200MB vẫn hợp lệ); presign thứ 9: 413 QUOTA_EXCEEDED, message \"Bạn đã vượt hạn mức lưu trữ 200MB, hãy xóa bớt file cũ\".")
    u(F, "Xóa file giải phóng hạn mức", "Chức năng", "Trung bình", U0 + "; đã ở sát 200MB (case trên) và có file đã upload",
      ["DELETE /api/uploads/<key 25MB>", "Presign lại file 25MB"], "-", "Xóa 200 {deleted:true}; presign sau đó 201 (quota tính lại bằng SUM(size))." , pw=PART)
    u(F, "Hạn mức tính riêng từng user", "Chức năng", "Trung bình", "member1 đã chạm quota; member2 đăng nhập", ["member2: presign 1MB"], "-", "member2 nhận 201; hạn mức không dùng chung.")
    u(F, "UI: vượt hạn mức hiện thông báo \"Bạn đã dùng hết dung lượng lưu trữ\"", "Giao diện", "Trung bình", "member1 sát quota", ["Mở /messages/" + CONV, "Đính kèm 1 file zip 1MB"], "-", "FE bắt 413 QUOTA_EXCEEDED, hiển thị \"Bạn đã dùng hết dung lượng lưu trữ\", không gửi tin.", pw=PART)

    F = "Phục vụ file /api/files/:key"
    u(F, "Phục vụ ảnh: Content-Type đúng + header bảo mật + cache", "Bảo mật", "Cao", U0 + "; đã upload 1 PNG (purpose post_image)",
      ["GET /api/files/<key>.png (không token)"], "png", "200; Content-Type image/png; X-Content-Type-Options: nosniff; Content-Security-Policy \"default-src 'none'; sandbox\"; Cross-Origin-Resource-Policy cross-origin; Cache-Control \"public, max-age=31536000, immutable\"; không có Content-Disposition attachment (hiển thị inline).")
    u(F, "Phục vụ file tài liệu: attachment + cache riêng tư", "Bảo mật", "Cao", U0 + "; đã upload 1 PDF (post_file) filename \"Giáo trình.pdf\"", ["GET /api/files/<key>.pdf KHÔNG token (ẩn danh)", "GET /api/files/<key>.pdf kèm Authorization: Bearer <token member1> (chủ file)", "POST /api/files/<key>/url (Bearer) rồi GET URL ký nhận được"], "pdf",
      "Bước 1: 401 \"Cần đăng nhập hoặc URL ký còn hạn để xem file này\" (post_file là file RIÊNG TƯ, chỉ ảnh avatar/cover/post_image công khai). Bước 2 và 3: 200; Content-Type application/pdf; Content-Disposition: attachment; filename=\"download\"; filename*=UTF-8''Gi%C3%A1o%20tr%C3%ACnh.pdf; Cache-Control \"private, no-store\" (không còn max-age=3600); nosniff; CSP default-src 'none'; sandbox. URL ký hạn 300s (uploads.routes.ts, uploads.md).")
    u(F, "Content-Type suy từ đuôi key, không tin metadata client", "Bảo mật", "Cao", U0, ["Presign image/png tên \"a.html\" rồi PUT PNG thật", "GET /api/files/<key>"], "filename a.html", "Content-Type image/png (theo đuôi .png), không phải text/html; nosniff.")
    u(F, "File không tồn tại hoặc key sai định dạng -> 404", "Chức năng", "Trung bình", "Không cần đăng nhập",
      ["GET /api/files/00000000000000000000000000000000.png", "GET /api/files/abc.png", "GET /api/files/<32 hex>.exe", "GET /api/files/<32 hex>.svg"], "4 key", "Cả bốn 404 NOT_FOUND, message \"Không tìm thấy file\".")
    u(F, "Path traversal trên /files/:key -> 404", "Bảo mật", "Cao", "Không cần đăng nhập",
      ["GET /api/files/..%2f..%2f.env", "GET /api/files/%2e%2e%2f%2e%2e%2fpackage.json", "GET /api/files/..\\..\\.env", "GET /api/files/....//....//etc/passwd", "GET /api/files/<key hợp lệ>%00.png"], "5 payload traversal",
      "Tất cả 404 (khóa phải khớp ^[a-f0-9]{32}\\.[a-z0-9]{2,5}$); tuyệt đối không trả nội dung .env/package.json.")
    u(F, "Path traversal trên PUT/DELETE /uploads/:key", "Bảo mật", "Cao", U0, ["PUT /api/uploads/..%2f..%2fx.png?token=<token hợp lệ của key khác>", "DELETE /api/uploads/..%2f..%2fpackage.json (Bearer)"], "-",
      "PUT: 403 \"Vé upload không khớp với file\"; DELETE: 404 \"Không tìm thấy file\"; không tác động file ngoài thư mục upload.")
    u(F, "/files công khai theo URL khóa 128-bit (chưa chốt)", "Bảo mật", "Trung bình", U0 + "; đã upload ảnh purpose message_attachment; Cần quyết định: /files có yêu cầu đăng nhập cho message_attachment hay không",
      ["Mở URL /api/files/<key> ở cửa sổ ẩn danh chưa đăng nhập"], "message_attachment",
      "Hiện tại 200 trả file cho bất kỳ ai có URL (kiểu \"unlisted link\") - giá trị tạm / chưa chốt; nếu chốt yêu cầu đăng nhập thì kỳ vọng đổi thành 401.")
    u(F, "Chưa hỗ trợ HTTP Range (video mp4 không tua được)", "Chức năng", "Thấp", "Chưa làm: HTTP Range cho mp4, quét virus, thumbnail/resize", ["GET /api/files/<key>.mp4 kèm header Range: bytes=0-99"], "Range", "(Kế hoạch) Sẽ trả 206; hiện tại trả 200 toàn bộ file.", pw=NO, status=PLAN)

    F = "Danh sách & xóa file của tôi"
    u(F, "GET /me/uploads chỉ liệt kê file đã upload xong của mình", "Chức năng", "Cao", U0 + "; member1 có 1 file đã upload xong + 1 presign chưa PUT",
      ["GET /api/me/uploads"], "-", "200; chỉ file status uploaded, mỗi phần tử {key,url,filename,contentType,size,purpose,createdAt}; presign chưa PUT không xuất hiện; không lẫn file của member2.")
    u(F, "Chủ sở hữu xóa file: 200, sau đó /files 404", "Chức năng", "Cao", U0 + "; đã upload 1 PNG", ["DELETE /api/uploads/<key>", "GET /api/files/<key>", "GET /api/me/uploads"], "-", "Xóa 200 {data:{deleted:true}}; /files 404; /me/uploads không còn.")
    u(F, "Người khác xóa file -> 403", "Bảo mật", "Cao", U0 + "; member1 có file; member2 đăng nhập", ["member2: DELETE /api/uploads/<key của member1>"], "-", "403 FORBIDDEN, message \"Bạn không có quyền xóa file này\"; file còn nguyên.")
    u(F, "Platform Admin xóa được file của người dùng", "Chức năng", "Trung bình", U0 + "; đăng nhập admin@sofinhub.test", ["admin: DELETE /api/uploads/<key của member1>"], "-", "200 deleted:true.")
    u(F, "Xóa key không tồn tại / key sai định dạng -> 404; không token -> 401", "Chức năng", "Thấp", U0, ["DELETE /api/uploads/00000000000000000000000000000000.png", "DELETE /api/uploads/abc", "DELETE không Bearer"], "-", "Hai đầu 404 \"Không tìm thấy file\"; không token " + E401 + ".")
    u(F, "Xóa file đã đính kèm vào tin nhắn: đường dẫn ảnh trong tin trả 404", "Chức năng", "Thấp", SEED_C + "; member1 đã gửi tin kèm ảnh", ["member1 xóa file bằng DELETE /api/uploads/<key>", "member2 mở tin nhắn đó trên UI"], "-", "Ảnh không tải được (404 /api/files/<key>), tin nhắn vẫn hiển thị (không lỗi trắng trang).", pw=PART)

    F = "Upload theo mục đích"
    u(F, "lesson_attachment có courseId: chỉ mod trở lên", "Bảo mật", "Cao", "Đăng nhập member1 (member thường của photo), sau đó mod@sofinhub.test",
      ["member1: presign purpose lesson_attachment courseId \"photo\" application/pdf", "mod: cùng payload"], "courseId=photo",
      "member1: 403 FORBIDDEN (không phải mod+); mod: 201.")
    u(F, "lesson_attachment courseId không tồn tại -> 404; không gửi courseId thì không kiểm vai trò", "Chức năng", "Trung bình", U0,
      ["Presign lesson_attachment courseId \"khong-co\"", "Presign lesson_attachment không courseId"], "-", "Lần 1: 404 NOT_FOUND; lần 2: 201 (theo thiết kế courseId tùy chọn; nêu rủi ro: member bất kỳ upload được lesson_attachment không courseId - chưa chốt).")
    u(F, "Đổi avatar bằng ảnh upload: ảnh hiển thị và ràng buộc 3MB", "Chức năng", "Cao", U0, ["Vào trang hồ sơ (menu avatar -> Hồ sơ)", "Chọn ảnh JPG 1MB làm avatar", "Thử ảnh 4MB"], "1MB và 4MB",
      "Ảnh 1MB: upload thành công, PATCH /auth/me {avatarUrl:'/api/files/<key>'} trả 200 (đã sửa, trước đây 400 dù upload xong), avatar đổi và hiển thị qua /api/files/<key>; ảnh 4MB bị chặn với thông báo \"File quá lớn, tối đa 3MB cho mục đích này\" (hoặc FE chặn trước).", pw=PART)
    u(F, "Ảnh trong bài viết: đính kèm ảnh, hiển thị trong feed", "Chức năng", "Cao", U0 + "; member1 thuộc photo", ["Vào /courses/photo/community", "Tạo bài, đính kèm 1 PNG 500KB", "Đăng"], "png 500KB", "Bài đăng chứa ảnh có URL /api/files/<key>; ảnh hiển thị trong bảng tin; tải lại vẫn thấy.", pw=PART)
    u(F, "Tệp tin nhắn: purpose message_attachment cho phép ảnh + pdf, tối đa 25MB", "Chức năng", "Trung bình", U0,
      ["Presign message_attachment application/pdf 25MB", "Presign message_attachment 25MB+1", "Presign message_attachment image/png 1MB"], "-", "Lần 1: 201; lần 2: 400 \"File quá lớn, tối đa 25MB cho mục đích này\"; lần 3: 201.")
    u(F, "Presign song song có thể vượt hạn mức đôi chút (giới hạn đã biết)", "Hiệu năng", "Thấp", U0 + "; đã dùng 190MB", ["Gửi đồng thời 5 presign 5MB"], "5 request song song", "Có thể cả 5 đều 201 (không khóa) làm tổng > 200MB; chỉ ghi nhận, chưa chốt (cần lock/Redis).", pw=NO)
    u(F, "Chưa làm: lưu S3/MinIO, rate-limit riêng cho presign", "Chức năng", "Thấp", "Chưa làm: S3Storage (hiện chỉ khung), POST /uploads/:key/complete, rate limit presign", ["Đặt provider S3 trong env", "Presign"], "-", "(Kế hoạch) Sau khi nối S3 uploadUrl là URL ký; hiện S3Storage ném lỗi \"chưa cấu hình\".", pw=NO, status=PLAN)
