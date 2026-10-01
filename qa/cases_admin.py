# -*- coding: utf-8 -*-
"""Testcase module ADM (Admin Console - đợt 1, 2026-10-01): Tổng quan · Cộng đồng · Người dùng · Kiểm duyệt · Nhật ký hoạt động.
Nguồn sự thật: backend/docs/api/admin.md, backend/src/modules/admin/*, backend/prisma/seed/admin.ts, docs/features/admin-batch1.md, frontend/ADMIN_BACKEND_GAPS.md.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-ADM-nnn không đổi)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
SEED = ("Seed đã chạy (npm run db:seed) trên DB sạch, gồm seed/admin.ts: 12 người dùng sarah, alex, daniel, maya (restricted: không đăng bài/bình luận, +7 ngày, lý do Spam), "
        "liam, olivia (suspended +14 ngày, Harassment), ethan (restricted: không nhắn tin/tạo cộng đồng, +3 ngày, Scam), sophia (banned, Scam), noah, emma, "
        "lucas (suspended vô thời hạn, Spam), ava - email <tên>@sofinhub.test, mật khẩu chung Passw0rd!x; 2 nhân sự john.carter@ / mia.lopez@sofinhub.test (người phụ trách case; từ đợt 3 là nhân viên admin vai trò Moderator - có quyền report.resolve nên giao được case, nhưng KHÔNG phải Super Admin/PLATFORM_ADMIN_EMAILS).")
SEED_COM = ("Cộng đồng seed admin: design-circle (Design Circle, chủ noah, pending_review, ~6 giờ trước), creator-academy (chủ emma, pending_review ~15 giờ), no-code-nation (chủ ava, pending_review ~27 giờ), "
            "startup-grind (chủ daniel, changes_requested, ghi chú 'Vui lòng làm rõ mô tả và bổ sung ảnh bìa.'), quick-rich-club (chủ lucas, rejected, 'Misleading claims'), "
            "crypto-signals-pro (chủ ethan, suspended/locked, 'Payment risk'), thùng rác: side-hustle-squad (chủ tự xóa 3 ngày trước), photo-walks (admin xóa 7 ngày trước, Fraud), "
            "keto-kitchen (admin xóa 11 ngày trước, Spam), pixel-traders (chủ tự xóa 15 ngày trước). Cộng đồng seed-base ai/mkt/fit/des/biz được gán chủ alex/daniel/liam/sophia/ethan nếu trước đó chưa có chủ.")
SEED_CASE = ("Case (Report) seed: seed-admin-report-1..12 (gọi tắt #1..#12; mã hiển thị CASE-xxxxx theo cột caseNo trong DB, trên DB sạch tương ứng thứ tự tạo). "
             "#1,#2,#3 cùng báo cáo bài seed-admin-post-1 (lucas, photo; reporter sarah/alex/liam; scam/scam/spam; open; #1,#2 giao john, #3 chưa giao) -> hàng đợi mặc định gộp thành 1 dòng reportCount=3 (hiện báo cáo CŨ NHẤT là #3). "
             "#4 bình luận seed-admin-cmt-1 (sophia, harassment, high, under_review, mia). #5 bài post-2 trên yt (lucas, copyright, high, open, john). #6 bình luận cmt-2 (noah, harassment, low, open). "
             "#7 dismissed (post-3 của sarah). #8 bài post-4 trên fin (ethan, scam, medium, open). #9 bình luận cmt-3 (olivia, hate_speech, critical, open, john). "
             "#10 báo cáo thành viên sophia (harassment, high, under_review, mia). #11 resolved warn_user (maya). #12 resolved action none (liam). 11 dòng nhật ký audit seed-admin-audit-1..11.")
LOGIN = "Đăng nhập admin@sofinhub.test / Passw0rd!x (Platform Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
TOKEN = "Lấy accessToken bằng POST /api/auth/login {\"email\":\"admin@sofinhub.test\",\"password\":\"Passw0rd!x\"}, gửi header Authorization: Bearer <token>."
MUTATE = "Case làm thay đổi dữ liệu seed - khôi phục bằng npm run db:reset (db:seed là idempotent chỉ-tạo nên KHÔNG ghi đè thao tác admin đã làm); hoặc dùng bản ghi khác chưa bị đụng tới."
DBEDIT = "Cần sửa trực tiếp DB (Prisma Studio: npm run db:studio) để giả lập thời gian/trạng thái; " + MUTATE
BASE_UI = SEED + " " + LOGIN + " Frontend :5173, backend :4000."
BASE_API = SEED + " " + TOKEN


def load(add):
    M, MN = "ADM", "Admin Console (đợt 1)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. QUYỀN TRUY CẬP
    F = "Phân quyền truy cập"
    A(F, "GET /admin/me với Platform Admin trả 200 và role platform_admin", "Chức năng", "Cao", BASE_API,
      ["Đăng nhập admin lấy accessToken", "GET /api/admin/me"], "admin@sofinhub.test",
      "200 {data:{id, name, email:'admin@sofinhub.test', role:'platform_admin'}}.")
    A(F, "GET /admin/me không token trả 401", "Bảo mật", "Cao", "Guest (không đăng nhập).",
      ["GET /api/admin/me không gửi Authorization"], "-", "401, error.code=UNAUTHORIZED.")
    for who in ("member1@sofinhub.test", "owner@sofinhub.test", "cadmin@sofinhub.test"):
        A(F, f"GET /admin/me với {who.split('@')[0]} (không phải Platform Admin) trả 403", "Bảo mật", "Cao", SEED + f" Đăng nhập {who} / {PW}.",
          ["Đăng nhập lấy accessToken", "GET /api/admin/me"], who,
          "403, error.code=FORBIDDEN. owner (chủ cộng đồng) và cadmin (admin cộng đồng photo) cũng KHÔNG có quyền nền tảng - 'admin cộng đồng' khác 'Platform Admin'.")
    A(F, "Mọi endpoint đọc /admin/* trả 401 khi không có token", "Bảo mật", "Cao", "Guest.",
      ["Gọi lần lượt không token: GET /api/admin/dashboard, /admin/communities, /admin/communities/summary, /admin/users, /admin/users/summary, /admin/moderation/cases, /admin/moderation/summary, /admin/moderation/decisions, /admin/audit-logs"],
      "9 endpoint", "Cả 9 đều 401 UNAUTHORIZED; không rò rỉ dữ liệu.")
    A(F, "Mọi endpoint đọc /admin/* trả 403 với member thường", "Bảo mật", "Cao", SEED + " Đăng nhập member1@sofinhub.test.",
      ["Với token member1 gọi 9 endpoint như case trước", "Gọi thêm GET /api/admin/users/<id bất kỳ> và GET /api/admin/communities/photo"], "member1",
      "Tất cả 403 FORBIDDEN, body không chứa dữ liệu người dùng/cộng đồng.")
    A(F, "Mọi endpoint ghi /admin/* (POST/DELETE) trả 403 với member thường và không ghi audit", "Bảo mật", "Cao",
      BASE_API + " Ghi lại số dòng GET /api/admin/audit-logs?limit=1 (meta.total) = N trước khi test. Token member1 dùng cho các lệnh gọi.",
      ["Bằng token member1: POST /api/admin/users/<sarah>/ban {reason:'x'}", "POST /api/admin/communities/design-circle/approve {}", "POST /api/admin/moderation/cases/<id #8>/dismiss {}", "DELETE /api/admin/users/<sarah>/sessions/seed-admin-sess-sarah", "Bằng token admin đọc lại audit-logs"],
      "member1 + id từ GET /admin/users?q=sarah", "Cả 4 lệnh 403; trạng thái sarah/design-circle/case #8 không đổi; audit-logs meta.total vẫn = N.")
    A(F, "Tài khoản Platform Admin có quyền dù chưa thuộc cộng đồng nào", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities/photo (admin không có Enrollment ở photo)"], "photo", "200 trả chi tiết cộng đồng; không bị 403 vì thiếu ghi danh.")
    A(F, "Giao diện: guest vào /admin bị chuyển về /login", "Chức năng", "Cao", "Chưa đăng nhập (xóa localStorage/cookie).",
      ["Mở http://localhost:5173/admin"], "-", "Trình duyệt chuyển tới /login (hoặc hiện yêu cầu đăng nhập), không thấy khung admin/dữ liệu.")
    for who, nm in (("member1@sofinhub.test", "member1"), ("owner@sofinhub.test", "owner"), ("cadmin@sofinhub.test", "cadmin")):
        A(F, f"Giao diện: {nm} vào /admin thấy thông báo không có quyền", "Chức năng", "Cao", SEED + f" Đăng nhập {who} / {PW}.",
          ["Mở http://localhost:5173/admin", "Thử tiếp /admin/users và /admin/moderation"], who,
          "Mọi trang /admin/* hiện 'Bạn không có quyền truy cập khu vực quản trị.' (khung có thông báo, không có sidebar admin, không có số liệu).")
    A(F, "Giao diện: admin vào /admin hiển thị khung quản trị đầy đủ", "Chức năng", "Cao", BASE_UI,
      ["Mở /admin"], "-", "Hiện sidebar + topbar + trang 'Bảng điều khiển'; tên 'Platform Admin' ở menu tài khoản góc phải.")
    A(F, "/admin/reports (đường dẫn cũ) chuyển hướng sang /admin/moderation", "Chức năng", "Trung bình", BASE_UI,
      ["Mở http://localhost:5173/admin/reports"], "-", "Địa chỉ đổi thành /admin/moderation, hiện 'Hàng đợi báo cáo'.")
    A(F, "Đường dẫn /admin/khong-ton-tai chuyển về /admin", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin/khong-ton-tai-xyz"], "-", "Chuyển về /admin (Bảng điều khiển), không trắng trang/không lỗi.")
    A(F, "Token admin bị thu hồi (logout) thì /admin/me trả 401 ngay", "Bảo mật", "Trung bình", BASE_API,
      ["POST /api/auth/logout (hoặc logout-all) bằng token admin", "GET /api/admin/me với token cũ"], "-", "401 UNAUTHORIZED ngay (cơ chế sid/tokenVersion), không chờ hết 15 phút.", pw="Một phần")

    # ============================================================ 2. KHUNG ADMIN (SIDEBAR/TOPBAR)
    F = "Khung admin: Sidebar & Topbar"
    A(F, "Sidebar hiển thị đúng 10 nhóm menu theo thứ tự", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin ở màn hình ≥1024px", "Đọc danh sách nhóm ở sidebar"], "-",
      "10 nhóm theo thứ tự: Tổng quan, Cộng đồng, Người dùng, Nội dung, Kiểm duyệt, Thanh toán, Khám phá, Phân tích, Hỗ trợ, Hệ thống; mỗi nhóm có icon; nhãn 100% tiếng Việt.")
    for grp, kids in (("Cộng đồng", "Danh sách cộng đồng, Xét duyệt, Tạm ngưng, Xóa / Khôi phục"), ("Người dùng", "Tất cả người dùng, Hạn chế / Tạm ngưng, Cấm"),
                      ("Kiểm duyệt", "Hàng đợi báo cáo, Cảnh cáo, Gỡ nội dung, Tạm ngưng, Cấm"), ("Thanh toán", "Giao dịch, Gói đăng ký, Hoàn tiền, Tranh chấp thanh toán, Doanh thu creator, Chi trả"),
                      ("Hệ thống", "Tài khoản quản trị, Vai trò & Quyền, Danh mục, Tính năng thử nghiệm, Tích hợp, Thông báo, Mẫu email, Nhật ký hoạt động, Cài đặt chung")):
        A(F, f"Nhóm '{grp}' mở ra đúng các mục con", "Giao diện", "Trung bình", BASE_UI,
          [f"Mở /admin, bấm nhóm '{grp}' ở sidebar"], grp, f"Nhóm mở/đóng; các mục con: {kids}.")
    A(F, "Mục đang xem được tô sáng và nhóm tương ứng tự mở", "Giao diện", "Trung bình", BASE_UI,
      ["Mở /admin/users/banned", "Quan sát sidebar", "Mở /admin/moderation/cases/<id bất kỳ> rồi quan sát"], "-",
      "Với /admin/users/banned: nhóm 'Người dùng' mở, mục 'Cấm' được tô sáng. Với trang chi tiết vụ việc: nhóm 'Kiểm duyệt' mở, mục con đầu (Hàng đợi báo cáo) sáng; breadcrumb đúng.")
    for path, label in (("content/posts", "Nội dung › Bài viết"), ("payments/tx", "Thanh toán › Giao dịch"), ("discovery/listed", "Khám phá › Cộng đồng hiển thị"),
                        ("analytics/users", "Phân tích › Người dùng"), ("support/tickets", "Hỗ trợ › Ticket hỗ trợ"), ("system/admins", "Hệ thống › Tài khoản quản trị")):
        A(F, f"Mục chưa làm /admin/{path} hiện trang 'Sắp có' trong khung admin", "Giao diện", "Thấp", BASE_UI,
          [f"Mở /admin/{path} (hoặc bấm trong sidebar)"], path,
          f"Tiêu đề trang theo mục ({label.split('› ')[1]}), dòng phụ 'Mục {label.split(' ›')[0]} › {label.split('› ')[1]} sẽ có trong đợt phát triển sau.', khối 'Sắp có', nút 'Về tổng quan' -> /admin. Sidebar/topbar vẫn hiển thị.")
    A(F, "Ô tìm kiếm chung (Ctrl/⌘K): focus và gợi ý người dùng, cộng đồng, vụ việc", "Chức năng", "Trung bình", BASE_UI,
      ["Ở bất kỳ trang /admin bấm Ctrl+K (hoặc ⌘K)", "Gõ 'sarah'", "Gõ 'design'", "Gõ 'CASE-00007'"], "sarah / design / CASE-00007",
      "Ô 'Tìm người dùng, cộng đồng, vụ việc...' được focus; kết quả gọi API danh sách admin thật: 'sarah' ra Sarah Kim (người dùng); 'design' ra Design Circle (cộng đồng); 'CASE-00007' ra vụ việc tương ứng; bấm kết quả điều hướng đúng trang chi tiết.")
    A(F, "Ô tìm kiếm chung: từ khóa không có kết quả", "Chức năng", "Thấp", BASE_UI,
      ["Ctrl+K, gõ 'zzzxyz123'"], "zzzxyz123", "Không có gợi ý; hiển thị trạng thái không có kết quả, không lỗi.")
    A(F, "Menu 'Thao tác nhanh' và chuông/trợ giúp trên topbar", "Giao diện", "Thấp", BASE_UI,
      ["Bấm 'Thao tác nhanh'", "Bấm biểu tượng Trợ giúp", "Bấm chuông thông báo"], "-", "Mỗi nút mở menu/popover không lỗi; mục trong 'Thao tác nhanh' điều hướng được; đóng khi bấm ra ngoài hoặc Esc.", pw="Một phần")
    A(F, "Menu tài khoản: Đăng xuất", "Chức năng", "Trung bình", BASE_UI,
      ["Bấm menu tài khoản góc phải", "Chọn 'Đăng xuất'"], "-", "Phiên đăng xuất, chuyển /login; vào lại /admin phải đăng nhập lại; token cũ 401.")
    A(F, "Responsive: màn hẹp (<1024px) sidebar thu thành drawer mở bằng nút 'Mở menu'", "Giao diện", "Cao", BASE_UI,
      ["Thu cửa sổ về 390x844 (hoặc 768px)", "Quan sát topbar", "Bấm nút 'Mở menu' (hamburger)", "Chọn 'Người dùng' > 'Tất cả người dùng'"], "viewport 390x844",
      "Sidebar cố định biến mất; có nút hamburger; bấm mở drawer phủ bên trái + lớp nền mờ; chọn mục thì điều hướng và drawer đóng; bấm nền mờ cũng đóng drawer.")
    A(F, "Responsive: màn rộng (≥1024px) sidebar cố định, nút hamburger ẩn", "Giao diện", "Trung bình", BASE_UI,
      ["Mở /admin ở 1440x900"], "viewport 1440x900", "Sidebar luôn hiển thị (sticky, cao full màn hình), không có hamburger, nội dung chính cuộn độc lập; ô ⌘K hiện.")
    A(F, "Responsive: bảng dữ liệu cuộn ngang, không vỡ layout ở màn hẹp", "Giao diện", "Trung bình", BASE_UI,
      ["Ở 390px mở /admin/users", "Cuộn ngang bảng", "Kiểm tra cột 'Thao tác' (nút đầu + menu …)"], "viewport 390px",
      "Trang không có thanh cuộn ngang toàn trang; bảng cuộn ngang trong khung; cột thao tác sticky vẫn bấm được; KPI xếp thành 1-2 cột.", pw="Một phần")

    # ============================================================ 3. TỔNG QUAN (DASHBOARD)
    F = "Tổng quan (Dashboard)"
    A(F, "Trang Tổng quan: tiêu đề, 6 thẻ KPI, 4 biểu đồ và 3 khối phụ", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin"], "-",
      "Tiêu đề 'Bảng điều khiển', mô tả 'Theo dõi hiệu suất nền tảng, hoạt động cộng đồng và vận hành.'. 6 KPI: Tổng người dùng, Người dùng hoạt động, Cộng đồng, Doanh thu định kỳ (MRR), Báo cáo chờ xử lý (kèm 'N nghiêm trọng'), Cộng đồng chờ duyệt. "
      "4 biểu đồ: Tăng trưởng người dùng, Tăng trưởng cộng đồng, Doanh thu, Tương tác. 3 khối: Cần xử lý, Hoạt động gần đây, Thao tác nhanh.")
    A(F, "Chip khoảng thời gian 7/30/90 ngày: mặc định 30, đổi thì tải lại số liệu", "Chức năng", "Cao", BASE_UI,
      ["Mở /admin (mặc định chip 30 ngày được chọn)", "Bấm chip 7 ngày, quan sát Network", "Bấm chip 90 ngày"], "range 7 / 30 / 90",
      "Chip đang chọn được tô nổi; mỗi lần đổi gọi GET /api/admin/dashboard?range=<n>; trục biểu đồ có đúng 7/30/90 điểm; KPI 'Người dùng hoạt động' ghi chú 'n ngày qua' khi không có deltaPct.")
    A(F, "API dashboard: range mặc định 30, mỗi series đúng range điểm theo ngày UTC", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/dashboard (không range)", "GET /api/admin/dashboard?range=7", "GET /api/admin/dashboard?range=90"], "range ∈ {-,7,90}",
      "200; data.range = 30/7/90; mỗi mảng userGrowth/communityGrowth/revenue/engagement có đúng range phần tử, date tăng dần (cũ -> mới), ngày không dữ liệu = 0.")
    A(F, "API dashboard: range không hợp lệ trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/dashboard?range=15", "GET /api/admin/dashboard?range=abc"], "range=15 / abc", "400 VALIDATION_ERROR cho cả hai (chỉ nhận 7|30|90).")
    A(F, "KPI 'Tổng người dùng' khớp DB (không tính tài khoản minh họa và đã xóa)", "Chức năng", "Cao",
      BASE_API + " Có thể truy vấn DB (Prisma Studio).",
      ["GET /api/admin/dashboard -> kpis.totalUsers.value", "Đếm bảng User với isDemo=false AND deletedAt IS NULL", "So sánh với GET /api/admin/users/summary -> total"], "-",
      "Ba số bằng nhau (loại ~1.5K user minh họa isDemo); deltaPct = % so với kỳ trước, null nếu kỳ trước = 0.")
    A(F, "KPI 'Cộng đồng' chỉ đếm cộng đồng active, chưa khóa, chưa xóa", "Chức năng", "Cao", BASE_API + " Có thể truy vấn DB.",
      ["Đọc kpis.communities.value", "Đếm Course với deletedAt IS NULL AND moderationStatus='active' AND locked=false"], "-",
      "Số bằng nhau; không tính pending_review/changes_requested/rejected/suspended/deleted (6 cộng đồng seed admin ở trạng thái đó + 4 trong thùng rác).")
    A(F, "KPI 'Cộng đồng chờ duyệt' = số cộng đồng pending_review và khớp trang Xét duyệt", "Chức năng", "Cao", BASE_API,
      ["Đọc kpis.pendingReviewCommunities.value và needsAttention.pendingReviewCommunities", "GET /api/admin/communities/summary -> pendingReview", "Mở /admin: bấm thẻ 'Cộng đồng chờ duyệt'"], "-",
      "Dashboard = summary.pendingReview = 3 trên DB seed (design-circle, creator-academy, no-code-nation; changes_requested của startup-grind KHÔNG tính vào KPI này). Bấm thẻ chuyển tới /admin/communities/review.")
    A(F, "'Cần xử lý': Cộng đồng chờ duyệt hiện thời gian chờ lâu nhất", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/dashboard", "Đọc needsAttention.pendingReviewCommunities.oldestWaitingHours", "Mở /admin xem dòng 'Cộng đồng chờ duyệt'"], "-",
      "oldestWaitingHours ≈ 27 (no-code-nation tạo ~27 giờ trước, làm tròn xuống); UI ghi 'Lâu nhất đã chờ 27 giờ' (± 1). Khi không còn cộng đồng chờ: 'Không có cộng đồng nào đang chờ' và 0 giờ.")
    A(F, "KPI 'Báo cáo chờ xử lý' và số nghiêm trọng khớp hàng đợi kiểm duyệt", "Chức năng", "Cao", BASE_API,
      ["Đọc kpis.pendingReports.value / .critical", "GET /api/admin/moderation/summary -> open, critical", "Đếm Report status in (open) và risk=critical trong DB"], "-",
      "Dashboard = moderation summary (so cùng định nghĩa mở); seed có critical gồm #1,#2,#3 (cùng bài) và #9. Thẻ UI hiển thị 'N nghiêm trọng'.")
    A(F, "'Cần xử lý': Chi trả/Hoàn tiền chờ duyệt lấy số liệu thật", "Chức năng", "Trung bình", BASE_API,
      ["Đọc needsAttention.pendingPayouts và pendingRefunds", "So với GET /api/admin/payouts?status=requested và /api/admin/refunds?status=pending"], "-",
      "pendingPayouts.count = 1 (payout requested của owner), pendingRefunds.count = 1 (yêu cầu hoàn tiền của demo-paid-demo-2); amountCents bằng tổng amount các dòng; UI hiển thị tiền định dạng USD ('$xx.xx đang chờ').")
    A(F, "'Cần xử lý': Tài khoản đáng ngờ khớp sắp xếp 'Nhiều báo cáo nhất'", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin, ghi số ở dòng 'Tài khoản đáng ngờ'", "Bấm dòng đó"], "-", "Chuyển tới /admin/users?sort=reports, danh sách sắp theo số báo cáo giảm dần (lucas đứng đầu trong seed). Số ở dashboard khớp BE tính (người bị báo cáo nhiều lần).", pw="Một phần")
    for label, to in (("Cộng đồng chờ duyệt", "/admin/communities/review"), ("Báo cáo nội dung", "/admin/moderation"), ("Chi trả chờ duyệt", "/admin/payments/payouts"), ("Hoàn tiền chờ duyệt", "/admin/payments/refunds")):
        A(F, f"Bấm dòng '{label}' ở 'Cần xử lý' điều hướng đúng", "Chức năng", "Trung bình", BASE_UI,
          ["Mở /admin", f"Bấm dòng '{label}'"], label, f"Chuyển tới {to}.")
    A(F, "'Thao tác nhanh' có đủ 6 lối tắt và điều hướng đúng", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin, đọc khối 'Thao tác nhanh'", "Bấm lần lượt từng mục"], "-",
      "6 mục: Duyệt báo cáo (/admin/moderation), Tìm người dùng (/admin/users), Tìm cộng đồng (/admin/communities), Duyệt hoàn tiền (/admin/payments/refunds), Xét duyệt cộng đồng (/admin/communities/review), Xem nhật ký (/admin/system/audit).")
    A(F, "'Hoạt động gần đây': câu mô tả được dịch tiếng Việt, câu lạ giữ nguyên", "Giao diện", "Trung bình", BASE_UI + " Sau khi admin thực hiện vài thao tác (vd. tạm ngưng một người dùng).",
      ["Mở /admin, đọc khối 'Hoạt động gần đây'", "Bấm liên kết 'Nhật ký hoạt động'"], "-",
      "Dòng dạng '<tên người> đã tạm ngưng người dùng · <đối tượng>' / 'đã đăng ký tài khoản' / 'đã tạo một cộng đồng' kèm thời gian tương đối (vd. '5 phút trước'); liên kết đưa tới /admin/system/audit.")
    A(F, "KPI 'Doanh thu định kỳ (MRR)' định dạng tiền USD và khớp tổng gói active", "Chức năng", "Trung bình", BASE_API + " Có thể truy vấn DB.",
      ["Đọc kpis.mrrCents.value", "Tính tổng priceCents các Subscription status=active (không tính trialing)", "So với thẻ MRR ở UI"], "-",
      "mrrCents = tổng price gói active (trừ dùng thử; seed paid-demo: member1 active, member2 active hủy cuối kỳ vẫn tính tới hết kỳ, member3 trialing KHÔNG tính + gói lịch sử demo#3..#10); UI hiển thị '$' đúng cent.", pw="Một phần")
    A(F, "Số liệu dashboard cập nhật sau thao tác quản trị", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ghi lại KPI 'Cộng đồng' và 'Cộng đồng chờ duyệt' ở /admin", "Duyệt design-circle ở /admin/communities/review", "Quay lại /admin (hoặc tải lại)"], "design-circle",
      "'Cộng đồng chờ duyệt' giảm 1 (3 -> 2), 'Cộng đồng' tăng 1; 'Hoạt động gần đây' thêm dòng 'đã duyệt cộng đồng · Design Circle'; không cần reset cache thủ công.")
    A(F, "Trạng thái đang tải: Tổng quan hiển thị khối loading", "Giao diện", "Thấp", BASE_UI,
      ["Throttle mạng 'Slow 3G' trong DevTools", "Mở /admin"], "-", "Trong lúc chờ hiển thị khối đang tải (không trang trắng, không số 0 giả); xong thì thay bằng dữ liệu.", pw="Một phần")
    A(F, "Trạng thái lỗi: BE lỗi thì hiện khối lỗi và nút thử lại", "Giao diện", "Trung bình", BASE_UI,
      ["Dừng backend (hoặc chặn /api/admin/dashboard offline) rồi mở /admin", "Bật lại BE, bấm 'Thử lại'"], "-", "Hiện khối lỗi có thông điệp tiếng Việt và nút thử lại; bấm thử lại tải được dữ liệu, không cần reload trang.", pw="Một phần")
    A(F, "openSupportTickets = null và không có thẻ Ticket/Chargeback giả", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/dashboard", "Đọc kpis.openSupportTickets"], "-", "kpis.openSupportTickets.value = null (module Support thuộc đợt sau); UI không hiển thị thẻ Ticket/Chargeback/Failed payouts bịa.")
    A(F, "Hiệu năng: dashboard range=90 trả trong thời gian chấp nhận được", "Hiệu năng", "Trung bình", BASE_API + " DB có ~1.5K user minh họa.",
      ["Đo thời gian GET /api/admin/dashboard?range=90 (3 lần, bỏ lần đầu)"], "range=90", "Phản hồi 200 trong ≤ 2 giây ở máy dev (ghi lại số đo thực tế vào cột Ghi chú).", pw="Một phần")

    # ============================================================ 4. CỘNG ĐỒNG - DANH SÁCH
    F = "Cộng đồng: Danh sách"
    A(F, "Trang /admin/communities: tiêu đề, 6 thẻ KPI và bảng", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/communities"], "-",
      "Tiêu đề 'Cộng đồng', mô tả 'Quản lý toàn bộ cộng đồng trên nền tảng.'. KPI: Tổng cộng đồng, Hoạt động, Chờ duyệt, Trả phí, Tạm ngưng, Đã xóa. Cột bảng: Cộng đồng (tên + /slug), Mã, Chủ sở hữu, Danh mục, Thành viên, Giá, MRR, Trạng thái, Tạo lúc; phân trang 20/dòng.")
    A(F, "KPI cộng đồng khớp GET /admin/communities/summary và dữ liệu seed", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/communities/summary", "Đối chiếu với thẻ KPI ở /admin/communities"], "-",
      "summary.pendingReview = 3, changesRequested = 1, rejected = 1, suspended ≥ 1 (crypto-signals-pro), deleted = 4 (side-hustle-squad, photo-walks, keto-kitchen, pixel-traders); thẻ 'Chờ duyệt' = pendingReview + changesRequested = 4; tổng khớp số dòng khi lọc từng trạng thái.")
    A(F, "Danh sách mặc định: mọi trạng thái trừ 'Đã xóa', mới nhất trước", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/communities", "Kiểm tra các status trong data và thứ tự createdAt"], "-",
      "Không có dòng status=deleted; có đủ pending_review/changes_requested/rejected/suspended/active; createdAt giảm dần; meta {page:1, limit:20, total, totalPages}.")
    for q, exp in (("Design", "Design Circle (theo tên)"), ("noah", "các cộng đồng do Noah Williams sở hữu (Design Circle, Keto Kitchen KHÔNG hiện vì đã xóa) - theo tên chủ"), ("crypto-signals-pro", "Crypto Signals Pro (theo id/slug)")):
        A(F, f"Tìm kiếm cộng đồng với từ khóa '{q}'", "Chức năng", "Cao", BASE_UI,
          ["Mở /admin/communities", f"Gõ '{q}' vào ô 'Tìm theo tên cộng đồng, chủ sở hữu, mã...' (chờ debounce)"], f"q={q}",
          f"Bảng chỉ còn {exp}; trang về 1; Network gọi GET /api/admin/communities?q={q}.")
    A(F, "Tìm kiếm không có kết quả hiện trạng thái rỗng", "Giao diện", "Trung bình", BASE_UI,
      ["Gõ 'zzzxyz123' vào ô tìm kiếm"], "zzzxyz123", "Bảng hiện trạng thái rỗng (không có dòng), phân trang ẩn/0 kết quả, có thể xóa bộ lọc.")
    for st, ex in (("pending_review", "design-circle, creator-academy, no-code-nation"), ("changes_requested", "startup-grind"), ("rejected", "quick-rich-club"), ("suspended", "crypto-signals-pro")):
        A(F, f"Lọc theo trạng thái '{st}' (API)", "Chức năng", "Trung bình", BASE_API,
          [f"GET /api/admin/communities?status={st}"], f"status={st}", f"Chỉ trả cộng đồng ở trạng thái {st} (seed: {ex}); meta.total khớp.")
    A(F, "Lọc nhiều trạng thái cùng lúc (phân cách dấu phẩy) và lọc 'deleted'", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities?status=pending_review,changes_requested", "GET /api/admin/communities?status=deleted"], "-",
      "Lệnh 1 trả 4 dòng (3 pending + startup-grind). Lệnh 2 trả 4 cộng đồng đã xóa (mặc định bị loại nhưng lọc tường minh thì thấy).")
    A(F, "Giá trị status/sort/pricing không hợp lệ trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities?status=banana", "GET /api/admin/communities?sort=abc", "GET /api/admin/communities?pricing=vip"], "-", "Cả ba 400 VALIDATION_ERROR (message nêu giá trị không hợp lệ).")
    A(F, "Lọc Miễn phí / Trả phí / Dùng thử và Danh mục, Hiển thị", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/communities", "Chọn bộ lọc 'Miễn phí / Trả phí' = Trả phí", "Đổi sang Miễn phí", "Chọn 'Danh mục' = một danh mục (vd. Kinh doanh)", "Chọn 'Hiển thị' = Riêng tư"], "-",
      "Mỗi lần chọn gọi lại API với pricing/category/visibility; Trả phí chỉ có cộng đồng giá > 0 (cột Giá hiển thị '$xx'), Miễn phí hiển thị 'Miễn phí'; Riêng tư chỉ có private-demo; trang luôn quay về 1.")
    for srt, exp in (("oldest", "createdAt tăng dần"), ("members", "số thành viên giảm dần"), ("mrr", "MRR giảm dần (paid-demo đầu bảng)"), ("name", "tên A-Z")):
        A(F, f"Sắp xếp cộng đồng theo '{srt}'", "Chức năng", "Trung bình", BASE_API,
          [f"GET /api/admin/communities?sort={srt}&limit=20"], f"sort={srt}", f"200; thứ tự: {exp}.")
    A(F, "Phân trang: limit/page hợp lệ và giới hạn biên", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities?limit=2&page=1", "GET ...?limit=2&page=2", "GET ...?limit=100", "GET ...?limit=101", "GET ...?page=0"], "limit 2/100/101, page 0",
      "limit=2 trả 2 dòng, trang 2 khác trang 1, meta.totalPages = ceil(total/2); limit=100 hợp lệ; limit=101 và page=0 trả 400 VALIDATION_ERROR.")
    A(F, "Phân trang trên giao diện và nút 'Xóa bộ lọc'", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/communities, bấm sang trang 2 (nếu > 20 cộng đồng)", "Chọn một bộ lọc rồi bấm xóa bộ lọc"], "-", "Phân trang số hoạt động, hiển thị tổng; chọn lọc tự về trang 1; xóa bộ lọc trả về danh sách đầy đủ.")
    A(F, "Bấm vào dòng mở trang chi tiết cộng đồng", "Chức năng", "Trung bình", BASE_UI,
      ["Bấm dòng 'Design Circle'"], "design-circle", "Chuyển /admin/communities/design-circle, hiện trang chi tiết.")
    A(F, "Menu '…' của dòng thay đổi theo trạng thái cộng đồng", "Chức năng", "Cao", BASE_UI,
      ["Mở menu … của lần lượt: Design Circle (pending_review), một cộng đồng active (vd. Nhiếp ảnh - photo), Crypto Signals Pro (suspended)", "Lọc status=deleted rồi mở menu của một dòng (nếu hiển thị)"], "-",
      "pending: Xem, Mở cộng đồng, Xét duyệt, Xóa (không có Tạm ngưng). active: Xem, Mở cộng đồng, Tạm ngưng, Xóa. suspended: Xem, Mở cộng đồng, Khôi phục, Xóa. deleted: Xem, Khôi phục (không Mở cộng đồng/Xóa).")
    A(F, "'Mở cộng đồng' mở trang công khai trong tab mới", "Chức năng", "Thấp", BASE_UI,
      ["Menu … của photo > 'Mở cộng đồng'"], "photo", "Mở tab mới /courses/photo/community (noopener); trang admin giữ nguyên.")
    A(F, "Cột Chủ sở hữu/Thành viên/MRR của cộng đồng seed", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/communities?q=paid-demo"], "paid-demo", "Dòng paid-demo: owner = Olivia Owner (owner@sofinhub.test), pricing=paid, priceUsd=19, mrrCents > 0 khớp gói active, members đếm mọi ghi danh không bị ban.")

    # ============================================================ 5. CỘNG ĐỒNG - CHI TIẾT
    F = "Cộng đồng: Chi tiết"
    A(F, "GET /admin/communities/:id trả đủ trường chi tiết", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/communities/design-circle"], "design-circle",
      "200: id/slug design-circle, status=pending_review, owner {id,name:'Noah Williams',email:'noah@sofinhub.test',status:'active',accountAgeDays≈22,communitiesOwned}, description, language=vi, stats (members, posts, comments, hiddenPosts, events, mrrCents, totalRevenueCents, refundsCents, activeSubscriptions, reports30d, openReports), recentReports (≤5), history (≤10).")
    A(F, "GET /admin/communities/:id không tồn tại trả 404", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities/khong-ton-tai-xyz"], "-", "404 NOT_FOUND 'Không tìm thấy cộng đồng'.")
    A(F, "Chi tiết cộng đồng đã xóa hiển thị lý do, người xóa và hạn xóa vĩnh viễn", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities/photo-walks"], "photo-walks", "200: status=deleted, deleteReason='Fraud', deletedBy = Platform Admin, purgeAt = deletedAt + 30 ngày (còn khoảng 23 ngày).")
    A(F, "Trang chi tiết có 6 tab và breadcrumb", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/communities/design-circle", "Bấm lần lượt từng tab"], "design-circle",
      "6 tab: Tổng quan, Thành viên, Bài viết & Bình luận, Doanh thu, Kiểm duyệt, Cài đặt; tab đang chọn lưu trong ?tab=; breadcrumb 'Design Circle' (tab khác tổng quan thì 'Design Circle › <tên tab>' và bấm được).")
    A(F, "Tab Tổng quan: KPI thành viên/bài viết/doanh thu, Thông tin cộng đồng, Sức khỏe / Rủi ro", "Giao diện", "Trung bình", BASE_UI,
      ["Mở /admin/communities/photo (tab Tổng quan)"], "photo",
      "KPI: Tổng thành viên, Thành viên hoạt động (30 ngày), Thành viên mới (30 ngày), Bài viết, Bình luận, Doanh thu tháng; khối 'Thông tin cộng đồng', 'Hoạt động gần đây', 'Sức khỏe / Rủi ro' (Báo cáo (30 ngày), Báo cáo đang mở, Bài viết bị ẩn, Thành viên bị cấm). Số khớp GET /admin/communities/photo -> stats.")
    A(F, "Tab Thành viên: danh sách, tìm kiếm, lọc vai trò, xem người dùng", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/communities/photo?tab=members", "Gõ 'sarah' vào ô tìm", "Lọc 'Vai trò' = Chủ sở hữu", "Menu … > 'Xem người dùng'"], "photo",
      "Cột: Thành viên (tên+email), Vai trò, Tham gia, Hoạt động gần nhất, Bài viết, Trạng thái. Tìm 'sarah' ra Sarah Kim; lọc Chủ sở hữu ra Olivia Owner; 'Xem người dùng' chuyển /admin/users/<id>.")
    A(F, "API thành viên cộng đồng: lọc role và phân trang, role sai trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/communities/photo/members?role=owner", "GET .../members?role=mod", "GET .../members?role=banana", "GET .../members?q=sarah&limit=5"], "photo",
      "role=owner trả owner@; role=mod trả mod@ (Mia Moderator); role=banana 400; q lọc theo tên/email; mỗi dòng có userId,name,email,role,joinedAt,lastActiveAt,posts,userStatus,banned (banned@sofinhub.test có banned=true ở photo).")
    A(F, "Tab Kiểm duyệt: danh sách vụ việc của cộng đồng", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/communities/photo?tab=moderation", "Menu … > 'Duyệt' ở một dòng"], "photo",
      "Bảng 'Báo cáo của cộng đồng' liệt kê các vụ việc photo (#1..#4, #6, #7, #9, #10, #12 + case seed cũ); 'Duyệt' chuyển /admin/moderation/cases/<id>; cộng đồng chưa có báo cáo hiện 'Cộng đồng này chưa có báo cáo nào.'.")
    A(F, "Tab Doanh thu và Cài đặt (vùng nguy hiểm)", "Giao diện", "Thấp", BASE_UI,
      ["Mở /admin/communities/paid-demo?tab=revenue", "Mở ?tab=settings"], "paid-demo",
      "Tab Doanh thu: Tổng doanh thu, MRR, Gói đang hoạt động, ARPU (khi có gói), Hoàn tiền (USD). Tab Cài đặt: 'Thông tin cộng đồng' chỉ đọc + 'Vùng nguy hiểm' có hành động Tạm ngưng/Xóa.")
    A(F, "Nút hành động đầu trang chi tiết thay đổi theo trạng thái", "Chức năng", "Trung bình", BASE_UI,
      ["Mở chi tiết design-circle (pending), photo (active), crypto-signals-pro (suspended), photo-walks (deleted)"], "-",
      "pending: Duyệt / Yêu cầu chỉnh sửa / Từ chối; active: Tạm ngưng, Xóa; suspended: Khôi phục, Xóa; deleted: Khôi phục.")
    A(F, "Chi tiết cộng đồng không tồn tại hiển thị lỗi thân thiện", "Giao diện", "Thấp", BASE_UI,
      ["Mở /admin/communities/khong-ton-tai-xyz"], "-", "Hiện khối lỗi/không tìm thấy bằng tiếng Việt (404), có đường quay lại danh sách; không trắng trang.")
    A(F, "Liên hệ chủ sở hữu từ trang chi tiết (tin nhắn)", "Chức năng", "Thấp", BASE_UI,
      ["Ở chi tiết design-circle bấm 'Nhắn chủ sở hữu' (nếu có)"], "-", "Dùng POST /api/conversations có sẵn; nếu hai bên không chung cộng đồng BE từ chối thì lỗi hiển thị ngay dạng toast, không treo.", pw="Một phần")

    # ============================================================ 6. CỘNG ĐỒNG - XÉT DUYỆT
    F = "Cộng đồng: Xét duyệt"
    A(F, "Trang /admin/communities/review: hàng đợi, xem trước, checklist, quyết định", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/communities/review"], "-",
      "Tiêu đề 'Xét duyệt cộng đồng'; thẻ 'Hàng đợi xét duyệt' (cột Cộng đồng+chủ, Gửi lúc, Trạng thái) có 4 dòng: no-code-nation, creator-academy, design-circle (cũ nhất trước), startup-grind (Đã yêu cầu chỉnh sửa); cột phải: 'Xem trước cộng đồng', 'Danh sách kiểm tra', 'Quyết định' (Duyệt / Yêu cầu chỉnh sửa / Từ chối).")
    A(F, "API review-queue: thứ tự cũ nhất trước, kèm signals và waitingHours", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/communities/review-queue"], "-",
      "200 gồm status pending_review + changes_requested, createdAt tăng dần; mỗi dòng có description, submittedAt, waitingHours (no-code-nation ≈ 27), signals {ownerAccountAgeDays, ownerCommunities, ownerViolations90d, hasThumbnail:true, descriptionLength > 0}.")
    A(F, "Chọn cộng đồng bằng ?id= mở sẵn bản xem trước", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin/communities/review?id=creator-academy"], "creator-academy", "Dòng Creator Academy được chọn, khối xem trước hiển thị tên, chủ (Emma Garcia), giá $59, mô tả.")
    A(F, "Checklist: các mục tự tính từ signals, hai mục thủ công chỉ lưu tạm trên trình duyệt", "Chức năng", "Trung bình", BASE_UI,
      ["Chọn Design Circle", "Quan sát checklist: Hồ sơ cộng đồng, Mô tả, Lịch sử chủ sở hữu, Vi phạm trước đây", "Tích 'Chất lượng nội dung' và 'Tuân thủ chính sách'", "Tải lại trang (F5)"], "-",
      "Hồ sơ cộng đồng tick (có ảnh bìa); Mô tả tick nếu ≥ 50 ký tự; hai mục thủ công tích được; sau F5 hai mục này trở lại chưa tích (không lưu BE - ghi nhận ở ADMIN_BACKEND_GAPS).")
    A(F, "Duyệt cộng đồng pending_review (UI): thành active, toast và biến mất khỏi hàng đợi", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở /admin/communities/review, chọn Design Circle", "Nhập ghi chú 'OK nội dung' ở ô ghi chú", "Bấm 'Duyệt', xác nhận ở hộp thoại 'Duyệt Design Circle?'"], "design-circle, note='OK nội dung'",
      "Toast 'Đã duyệt · Design Circle'; hàng đợi còn 3 dòng; /admin/communities?q=design-circle cho trạng thái 'Hoạt động'; KPI 'Chờ duyệt' giảm 1; chủ noah nhận thông báo (nếu BE gửi).")
    A(F, "POST approve: pending_review -> active, ghi audit community.approve", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/creator-academy/approve {\"note\":\"ok\"}", "GET /api/admin/communities/creator-academy", "GET /api/admin/audit-logs?action=community.approve"], "creator-academy",
      "200 AdminCommunity.status=active; audit có dòng community.approve targetId=creator-academy, targetLabel 'Creator Academy', actor Platform Admin, note 'ok', metadata from/to.")
    A(F, "Duyệt cộng đồng changes_requested -> active", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/startup-grind/approve {}"], "startup-grind", "200, status=active.")
    A(F, "Duyệt cộng đồng đã active/rejected/suspended trả 409", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/communities/photo/approve {}", "POST /api/admin/communities/quick-rich-club/approve {}", "POST /api/admin/communities/crypto-signals-pro/approve {}"], "photo, quick-rich-club, crypto-signals-pro",
      "Cả ba 409 CONFLICT (chỉ pending_review|changes_requested mới duyệt được); trạng thái không đổi; không có dòng audit mới.")
    A(F, "Duyệt cộng đồng không tồn tại trả 404 và cộng đồng đã xóa trả 409", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/communities/khong-ton-tai/approve {}", "POST /api/admin/communities/photo-walks/approve {}"], "-", "Lệnh 1: 404; lệnh 2: 409 'Cộng đồng đã bị xóa — hãy khôi phục trước'.")
    A(F, "Yêu cầu chỉnh sửa (UI): chọn chủ đề + tin nhắn, chuyển 'Đã yêu cầu chỉnh sửa'", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Chọn Creator Academy ở trang xét duyệt", "Bấm 'Yêu cầu chỉnh sửa'", "Chọn chip 'Mô tả' và 'Giá'", "Nhập 'Vui lòng bổ sung mô tả chi tiết hơn' ở 'Tin nhắn gửi chủ sở hữu'", "Xác nhận"], "creator-academy",
      "Toast 'Đã yêu cầu chỉnh sửa · Creator Academy'; trạng thái thành 'Đã yêu cầu chỉnh sửa'; ghi chú gửi BE gồm 'Cần chỉnh sửa: Mô tả, Giá.' + nội dung tin nhắn; chủ emma nhận thông báo.")
    A(F, "POST request-changes bắt buộc note (400 khi thiếu/rỗng)", "Chức năng", "Cao", BASE_API,
      ["POST /api/admin/communities/no-code-nation/request-changes {}", "POST ... {\"note\":\"\"}", "POST ... {\"note\":\"Cần ảnh bìa\"}"], "no-code-nation " + MUTATE,
      "Lệnh 1 và 2: 400 VALIDATION_ERROR; lệnh 3: 200 status=changes_requested; audit community.request_changes có note 'Cần ảnh bìa'.")
    A(F, "request-changes trên cộng đồng đang changes_requested hoặc active trả 409", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/communities/startup-grind/request-changes {\"note\":\"x\"}", "POST /api/admin/communities/photo/request-changes {\"note\":\"x\"}"], "-", "Cả hai 409 CONFLICT (chỉ pending_review mới yêu cầu chỉnh sửa); nút UI 'Yêu cầu chỉnh sửa' bị vô hiệu ở startup-grind.")
    A(F, "Từ chối cộng đồng (UI): chọn lý do, ghi chú, trạng thái 'Đã từ chối'", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Chọn No-Code Nation", "Bấm 'Từ chối'", "Chọn lý do 'Nội dung không phù hợp'", "Nhập ghi chú, xác nhận"], "no-code-nation",
      "Toast 'Đã từ chối · No-Code Nation'; trạng thái 'Đã từ chối'; cộng đồng ra khỏi hàng đợi; chủ ava nhận thông báo; nhật ký có community.reject với reason 'Nội dung không phù hợp'.")
    A(F, "POST reject: validate lý do và chuyển trạng thái", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/design-circle/reject {}", "POST ... {\"reason\":\"Trùng lặp\"}", "POST /api/admin/communities/photo/reject {\"reason\":\"x\"}"], "design-circle, photo",
      "Lệnh 1: 400 (thiếu reason); lệnh 2: 200 status=rejected, statusReason='Trùng lặp'; lệnh 3: 409 (cộng đồng active không từ chối được).")
    A(F, "Từ chối cộng đồng changes_requested", "Chức năng", "Thấp", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/startup-grind/reject {\"reason\":\"Khác\"}"], "startup-grind", "200 status=rejected.")
    A(F, "Cộng đồng chưa duyệt không hiện ở /courses, tìm kiếm và danh mục", "Chức năng", "Cao", BASE_UI + " Không cần đăng nhập để kiểm tra trang công khai.",
      ["Mở trang chủ http://localhost:5173/ (khối khám phá cộng đồng) và tìm 'Design Circle', 'Creator Academy', 'Quick Rich Club', 'Crypto Signals Pro'", "GET /api/communities?limit=100 (bí danh của /api/courses) và /api/search?q=Design", "Mở /communities/design-circle (URL cũ /courses/design-circle chỉ chuyển hướng sang đây)"], "-",
      "Cả 4 KHÔNG xuất hiện trong danh sách/tìm kiếm/đếm danh mục (chỉ active, chưa khóa, chưa xóa mới hiện); cộng đồng photo vẫn hiện bình thường.", pw="Một phần")
    A(F, "Cộng đồng vừa duyệt xuất hiện ở /courses", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Duyệt design-circle (UI hoặc API)", "Mở trang chủ / hoặc GET /api/communities, tìm 'Design Circle'"], "design-circle", "Cộng đồng hiển thị ở danh sách và tìm kiếm công khai sau khi duyệt, không cần reset cache.", pw="Một phần")
    A(F, "Hàng đợi xét duyệt rỗng hiển thị thông báo", "Giao diện", "Thấp", BASE_UI + " Đã xử lý (duyệt/từ chối) hết 4 cộng đồng chờ. " + MUTATE,
      ["Mở /admin/communities/review"], "-", "Bảng hiện 'Không có cộng đồng nào đang chờ xét duyệt.'; cột phải không lỗi.")
    A(F, "Quyết định xét duyệt ghi ghi chú tối đa 500 ký tự", "Chức năng", "Thấp", BASE_API,
      ["POST /api/admin/communities/design-circle/approve {\"note\": <chuỗi 501 ký tự>}"], "note 501 ký tự", "400 VALIDATION_ERROR; trạng thái không đổi.")

    # ============================================================ 7. CỘNG ĐỒNG - TẠM NGƯNG / KHÔI PHỤC
    F = "Cộng đồng: Tạm ngưng / Khôi phục"
    A(F, "Trang /admin/communities/suspended: tab Tạm ngưng / Hoạt động và cột", "Giao diện", "Trung bình", BASE_UI,
      ["Mở /admin/communities/suspended", "Chuyển tab 'Hoạt động'"], "-",
      "Tiêu đề 'Tạm ngưng cộng đồng' (mô tả 'Cộng đồng bị tạm ngưng sẽ bị ẩn và tạm dừng thanh toán.'); tab 'Tạm ngưng' có Crypto Signals Pro, cột Lý do 'Payment risk', Đến khi 'Vô thời hạn'; tab 'Hoạt động' liệt kê cộng đồng active; trạng thái rỗng 'Không có cộng đồng nào đang bị tạm ngưng.' khi không còn.")
    A(F, "Tạm ngưng cộng đồng (UI): lý do + thời hạn + ghi chú", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở /admin/communities, menu … của cộng đồng 'fit' > 'Tạm ngưng'", "Chọn lý do 'Vi phạm chính sách', thời hạn '7 ngày'", "Nhập ghi chú nội bộ 'Nhiều báo cáo'", "Xác nhận"], "fit",
      "Hộp thoại 'Tạm ngưng <tên>?' có nhóm chip Lý do (Vi phạm chính sách, Gian lận, Spam, Bản quyền, Rủi ro thanh toán, Khác), Thời hạn (24 giờ, 7 ngày, 30 ngày, Vô thời hạn), ô 'Ghi chú nội bộ'; sau xác nhận toast 'Đã tạm ngưng · <tên>', trạng thái 'Tạm ngưng'.")
    A(F, "POST suspend: active -> suspended, ẩn khỏi công khai, khóa như locked", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/fit/suspend {\"reason\":\"Spam\",\"duration\":\"7d\"}", "GET /api/admin/communities/fit", "GET /api/courses?limit=100", "Đăng nhập thành viên fit, POST bài mới vào /api/courses/fit/posts"], "fit, duration=7d",
      "200 status=suspended, statusReason='Spam', statusUntil ≈ now+7 ngày (ISO); cộng đồng biến mất khỏi /api/courses; thao tác trong cộng đồng trả 403 COMMUNITY_LOCKED; audit community.suspend.")
    A(F, "suspend: until thắng duration; until quá khứ trả 400; duration sai trả 400", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST .../fit/suspend {\"reason\":\"x\",\"duration\":\"24h\",\"until\":\"<ISO +10 ngày>\"}", "POST ... {\"reason\":\"x\",\"until\":\"2020-01-01T00:00:00Z\"}", "POST ... {\"reason\":\"x\",\"duration\":\"1y\"}", "POST ... {}"], "fit",
      "Lệnh 1: 200, statusUntil = until (+10 ngày, không phải +24h); lệnh 2: 400 'Thời hạn phải ở tương lai'; lệnh 3: 400; lệnh 4: 400 (thiếu reason).")
    A(F, "suspend 'indefinite' hoặc bỏ trống = vô thời hạn", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/des/suspend {\"reason\":\"Gian lận\",\"duration\":\"indefinite\"}"], "des", "200, statusUntil=null; tab Tạm ngưng hiển thị 'Vô thời hạn'.")
    A(F, "Tạm ngưng cộng đồng không phải active trả 409", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/communities/design-circle/suspend {\"reason\":\"x\"}", "POST /api/admin/communities/crypto-signals-pro/suspend {\"reason\":\"x\"}"], "-", "Cả hai 409 CONFLICT (chỉ active mới tạm ngưng); không có dòng audit mới.")
    A(F, "Khôi phục cộng đồng bị tạm ngưng (UI)", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ở /admin/communities/suspended menu … của Crypto Signals Pro > 'Khôi phục'", "Hộp thoại 'Khôi phục Crypto Signals Pro?' nhập ghi chú, xác nhận"], "crypto-signals-pro",
      "Toast 'Đã khôi phục · Crypto Signals Pro'; chuyển sang tab Hoạt động; cộng đồng hiện lại ở /courses; thành viên đăng bài được (hết COMMUNITY_LOCKED).")
    A(F, "POST restore: suspended -> active, ghi audit community.restore; restore active trả 409", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/crypto-signals-pro/restore {\"note\":\"đã xác minh\"}", "POST /api/admin/communities/photo/restore {}"], "crypto-signals-pro, photo",
      "Lệnh 1: 200 status=active, lockReason xóa; lệnh 2: 409. Audit community.restore ghi note.")
    A(F, "Cộng đồng tạm ngưng: Owner/thành viên bị khóa mọi luồng cũ", "Bảo mật", "Trung bình", BASE_API + " " + MUTATE,
      ["Admin suspend cộng đồng 'fit'", "Đăng nhập owner của fit (liam@sofinhub.test / Passw0rd!x) POST bài, tạo sự kiện, checkout"], "fit", "Các thao tác trả 403 COMMUNITY_LOCKED như cơ chế lock hiện có.", pw="Một phần")
    A(F, "Công cụ 'Khóa nhanh theo mã / slug' vẫn dùng được (LockTab cũ)", "Chức năng", "Trung bình", BASE_UI + " " + MUTATE,
      ["Ở /admin/communities/suspended bấm 'Mở công cụ' trong thẻ 'Khóa nhanh theo mã / slug'", "Nhập 'biz' và lý do, bấm Khóa", "Mở lại danh sách cộng đồng"], "biz",
      "Khóa thành công (POST /admin/courses/biz/lock); biz hiện 'Tạm ngưng' trong danh sách và có audit community.lock; nút mở khóa đưa moderationStatus về active (community.unlock).")
    A(F, "Suspend có hạn (statusUntil) CHƯA tự hết hạn - hành vi hiện tại", "Chức năng", "Trung bình", "Cần sửa DB (Prisma Studio) cho 1 cộng đồng suspended: statusUntil = 1 phút trước. " + MUTATE,
      ["Chờ qua mốc statusUntil", "GET /api/admin/communities/<id>", "GET /api/courses"], "-",
      "Hiện tại cộng đồng VẪN suspended/vẫn bị ẩn sau khi quá hạn (BE chỉ lưu `until`, chưa có job tự gỡ - xem admin.md mục 'Chưa làm'). Case giữ làm hồi quy; khi có job thì sửa kỳ vọng thành tự về active.", pw="Không", st=PLAN)

    # ============================================================ 8. CỘNG ĐỒNG - XÓA / KHÔI PHỤC
    F = "Cộng đồng: Xóa / Khôi phục"
    A(F, "Trang /admin/communities/trash: 4 cộng đồng seed, cột và thời hạn lưu", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/communities/trash"], "-",
      "Tiêu đề 'Xóa / Khôi phục' (mô tả 'Cộng đồng đã xóa được giữ 30 ngày trước khi xóa vĩnh viễn.'); 4 dòng: Side Hustle Squad (Xóa bởi 'Chủ sở hữu', lý do Owner request, còn ~27 ngày), Photo Walks (Platform Admin, Fraud, ~23 ngày), Keto Kitchen (Spam, ~19 ngày), Pixel Traders (Chủ sở hữu, ~15 ngày); badge 'Đã xóa'; menu '…' có 'Khôi phục cộng đồng'.")
    A(F, "API trash: daysLeft/purgeAt tính 30 ngày từ deletedAt, deletedByOwner đúng", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/communities/trash"], "-", "4 dòng; daysLeft = 30 - số ngày từ deletedAt (27/23/19/15); purgeAt = deletedAt + 30 ngày; deletedByOwner=true cho side-hustle-squad & pixel-traders (deletedBy=null), false cho photo-walks & keto-kitchen (deletedBy = Platform Admin).")
    A(F, "Tìm kiếm trong thùng rác theo tên", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/communities/trash?q=keto", "GET /api/admin/communities/trash?q=khongco"], "q=keto", "Lệnh 1 trả Keto Kitchen; lệnh 2 trả mảng rỗng meta.total=0; UI hiển thị 'Chưa có cộng đồng nào bị xóa.' khi rỗng.")
    A(F, "Xóa cộng đồng (UI) bắt buộc gõ DELETE để xác nhận", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Menu … của cộng đồng 'mkt' > 'Xóa'", "Hộp thoại 'Xóa cộng đồng': chọn lý do 'Spam'", "Để ô 'Gõ DELETE để xác nhận' trống -> quan sát nút xác nhận", "Gõ 'DELETE' rồi xác nhận"], "mkt",
      "Nút xác nhận bị vô hiệu cho tới khi gõ đúng DELETE; sau đó toast 'Đã xóa · <tên>', cộng đồng biến khỏi danh sách mặc định và xuất hiện ở trang thùng rác với 'Xóa bởi' = Platform Admin, daysLeft 30.")
    A(F, "POST delete: xóa mềm, ẩn khỏi công khai, ghi audit community.delete", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/mkt/delete {\"reason\":\"Spam\"}", "GET /api/admin/communities/mkt", "GET /api/courses?limit=100", "POST ... /mkt/delete lần 2"], "mkt",
      "Lệnh 1: 200 status=deleted; chi tiết có deleteReason='Spam', deletedBy, purgeAt (+30 ngày); không còn trong /api/courses; lệnh 2: 409 'Cộng đồng đã bị xóa'; audit community.delete (1 dòng, không nhân đôi).")
    A(F, "POST delete: thiếu reason trả 400, cộng đồng không tồn tại trả 404", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/communities/mkt/delete {}", "POST /api/admin/communities/khong-ton-tai/delete {\"reason\":\"x\"}"], "-", "400 VALIDATION_ERROR; 404 NOT_FOUND.")
    A(F, "Có thể xóa cộng đồng ở mọi trạng thái (pending/rejected/suspended)", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/quick-rich-club/delete {\"reason\":\"Spam\"}", "POST /api/admin/communities/crypto-signals-pro/delete {\"reason\":\"Gian lận\"}"], "-", "Cả hai 200; preDeleteStatus lưu trạng thái cũ (rejected / suspended).")
    A(F, "Khôi phục cộng đồng đã xóa (UI) về đúng trạng thái trước khi xóa", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ở trang thùng rác menu … của Photo Walks > 'Khôi phục cộng đồng'", "Xác nhận hộp thoại 'Khôi phục Photo Walks?'"], "photo-walks",
      "Toast 'Đã khôi phục · Photo Walks'; biến khỏi thùng rác; ở danh sách thấy trạng thái 'Hoạt động' (preDeleteStatus=active); hiện lại ở /courses.")
    A(F, "POST undelete: khôi phục / không phải đã xóa trả 409", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/communities/keto-kitchen/undelete {\"note\":\"nhầm\"}", "POST /api/admin/communities/photo/undelete {}"], "keto-kitchen, photo",
      "Lệnh 1: 200, status trở về active, ghi audit community.undelete; lệnh 2: 409 'Cộng đồng chưa bị xóa'.")
    A(F, "Undelete quá 30 ngày trả 409", "Chức năng", "Trung bình", "Cần sửa DB: đặt deletedAt của pixel-traders lùi về 31 ngày trước. " + MUTATE,
      ["POST /api/admin/communities/pixel-traders/undelete {}"], "pixel-traders", "409 CONFLICT (quá hạn lưu 30 ngày); daysLeft trên UI hiển thị 'Sắp xóa vĩnh viễn'.", pw="Một phần")
    A(F, "Cộng đồng do chủ tự xóa (DELETE /courses/:id) cũng vào thùng rác với deletedByOwner=true", "Tích hợp", "Trung bình", BASE_API + " Đăng nhập chủ một cộng đồng test (tạo mới bằng POST /api/communities). " + MUTATE,
      ["Chủ cộng đồng tạo cộng đồng (POST /api/communities) và DELETE /api/communities/<id> (bí danh của DELETE /api/courses/<id>)", "Admin GET /api/admin/communities/trash"], "cộng đồng tự tạo", "Dòng mới xuất hiện ở thùng rác với deletedByOwner=true, deletedBy=null, daysLeft=30.", pw="Một phần")
    A(F, "Xóa cộng đồng CHƯA tự hủy gói đăng ký đang chạy - hành vi hiện tại", "Chức năng", "Trung bình", "Có cộng đồng trả phí có gói active (paid-demo seed). " + MUTATE,
      ["Admin xóa hoặc tạm ngưng paid-demo", "Kiểm tra bảng Subscription của member1 (status, cancelAtPeriodEnd)"], "paid-demo",
      "Hiện tại Subscription VẪN active (BE chưa hủy gói khi xóa/đình chỉ - chờ chốt chính sách tiền). Case hồi quy, ghi rõ chưa chốt; cập nhật khi có quyết định hoàn tiền/hủy gói.", pw="Không", st=PLAN)
    A(F, "Job xóa vĩnh viễn sau 30 ngày CHƯA có", "Chức năng", "Thấp", "Cần sửa DB đặt deletedAt cũ hơn 30 ngày cho một cộng đồng.",
      ["Chờ/chạy job dọn dẹp (chưa tồn tại)", "Kiểm tra thùng rác"], "-", "Hiện tại bản ghi vẫn nằm trong thùng rác (daysLeft ≤ 0, 'Sắp xóa vĩnh viễn'); kỳ vọng sau này: bị xóa vĩnh viễn kèm audit.", pw="Không", st=PLAN)

    # ============================================================ 9. NGƯỜI DÙNG - DANH SÁCH
    F = "Người dùng: Danh sách"
    A(F, "Trang /admin/users: tiêu đề, 7 thẻ KPI và bảng", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/users"], "-",
      "Tiêu đề 'Người dùng' (mô tả 'Tìm kiếm, xem xét và quản lý mọi tài khoản trên nền tảng.'). KPI: Tổng người dùng, Hoạt động, Mới (30 ngày qua), Trả phí, Bị hạn chế, Tạm ngưng, Bị cấm. Cột: Người dùng (tên + 'Thành viên/Creator · 8 ký tự đầu id'), Email, Cộng đồng, Gói đăng ký, Doanh thu, Báo cáo, Trạng thái, Tham gia.")
    A(F, "KPI người dùng khớp GET /admin/users/summary và seed", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/users/summary"], "-",
      "restricted = 2 (maya, ethan), suspended = 2 (olivia, lucas), banned = 1 (sophia) trên DB seed (nếu chưa ai thao tác); total khớp dashboard kpis.totalUsers; new30d đếm tài khoản tạo trong 30 ngày; paid = số người có gói active.")
    A(F, "Danh sách không gồm thành viên minh họa (isDemo) và tài khoản đã xóa", "Chức năng", "Cao", BASE_API + " Có thể truy vấn DB.",
      ["GET /api/admin/users?limit=100", "Kiểm tra không có email dạng seed-<courseId>-<i>@demo.sofinhub.invalid", "Xóa mềm một tài khoản test rồi gọi lại"], "-",
      "Không có tài khoản isDemo; tài khoản đã xóa (deletedAt) cũng không có; meta.total = số user thật.")
    for q, ex in (("sarah", "Sarah Kim"), ("maya@sofinhub.test", "Maya Chen (theo email)"), ("Nguyen", "Liam Nguyen (theo tên)")):
        A(F, f"Tìm kiếm người dùng '{q}'", "Chức năng", "Cao", BASE_UI,
          ["Mở /admin/users", f"Gõ '{q}' vào ô 'Tìm tên, email, mã người dùng...'"], f"q={q}", f"Bảng chỉ còn {ex}; gọi GET /api/admin/users?q={q}; về trang 1.")
    A(F, "Tìm kiếm người dùng theo mã id (uuid)", "Chức năng", "Thấp", BASE_API,
      ["Lấy id của sarah từ danh sách", "GET /api/admin/users?q=<id đầy đủ>"], "id sarah", "Trả đúng 1 người dùng.")
    for st, ex in (("restricted", "maya, ethan"), ("suspended", "olivia, lucas"), ("banned", "sophia"), ("restricted,suspended", "maya, ethan, olivia, lucas")):
        A(F, f"Lọc người dùng theo status={st} (API)", "Chức năng", "Trung bình", BASE_API,
          [f"GET /api/admin/users?status={st}"], f"status={st}", f"Chỉ trả người dùng ở trạng thái đó (seed: {ex}); statusReason/statusUntil/restrictions đúng seed (vd. maya: restrictions [post, comment], reason 'Spam').")
    A(F, "Lọc vai trò (member/creator) và gói (free/paid)", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/users?role=creator", "GET /api/admin/users?role=member", "GET /api/admin/users?plan=paid", "GET /api/admin/users?plan=free"], "-",
      "creator = người sở hữu ≥ 1 cộng đồng (owner@, alex, daniel, ...); paid = có subscription active (member1, member2 theo seed); creator và member không giao nhau.")
    A(F, "Giá trị lọc không hợp lệ trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/users?status=vip", "GET /api/admin/users?role=boss", "GET /api/admin/users?plan=gold", "GET /api/admin/users?sort=x"], "-", "Cả bốn 400 VALIDATION_ERROR.")
    for srt, ex in (("oldest", "joinedAt tăng dần"), ("name", "tên A-Z"), ("revenue", "doanh thu giảm dần (member1 cao)"), ("reports", "số báo cáo nhận giảm dần (lucas đầu)")):
        A(F, f"Sắp xếp người dùng theo '{srt}'", "Chức năng", "Trung bình", BASE_API,
          [f"GET /api/admin/users?sort={srt}&limit=20"], f"sort={srt}", f"200; thứ tự {ex}.")
    A(F, "Phân trang người dùng: limit/page và biên", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/users?limit=5&page=2", "GET /api/admin/users?limit=101", "GET /api/admin/users?page=0"], "-", "Trang 2 có 5 dòng khác trang 1; limit=101 và page=0 trả 400; meta.totalPages đúng.")
    A(F, "Bộ lọc giao diện (Trạng thái, Vai trò, Gói, Sắp xếp) và xóa bộ lọc", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/users", "Chọn 'Trạng thái' = Bị cấm", "Chọn 'Sắp xếp' = Nhiều báo cáo nhất", "Bấm xóa bộ lọc"], "-", "Mỗi chọn tải lại danh sách (về trang 1); 'Bị cấm' chỉ hiện Sophia Patel; xóa bộ lọc về mặc định (mới nhất trước).")
    A(F, "Bấm KPI 'Bị hạn chế'/'Tạm ngưng'/'Bị cấm' chuyển đúng trang", "Chức năng", "Thấp", BASE_UI,
      ["Bấm thẻ 'Bị hạn chế'", "Quay lại, bấm 'Bị cấm'"], "-", "'Bị hạn chế' và 'Tạm ngưng' -> /admin/users/restricted; 'Bị cấm' -> /admin/users/banned.")
    A(F, "Menu '…' của dòng người dùng thay đổi theo trạng thái", "Chức năng", "Cao", BASE_UI,
      ["Mở menu … của sarah (active), maya (restricted), olivia (suspended), sophia (banned)"], "-",
      "active: Xem, Hạn chế, Tạm ngưng, Cấm, Cảnh cáo. restricted: Xem, Tạm ngưng, Cấm, Khôi phục, Cảnh cáo (không còn Hạn chế). suspended: Xem, Cấm, Khôi phục, Cảnh cáo. banned: Xem, Khôi phục, Cảnh cáo (không còn Cấm).")
    A(F, "Trang /admin/users/restricted: cột Hạn chế/Thời hạn/Lý do/Thực hiện bởi", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/users/restricted"], "-",
      "Tiêu đề 'Hạn chế / Tạm ngưng' (mô tả 'Người dùng bị giới hạn quyền trên nền tảng.'): maya 'Không được đăng bài, Không được bình luận' đến ngày +7, lý do Spam; ethan 'Không được nhắn tin, Không được tạo cộng đồng' +3 ngày; olivia/lucas cột Hạn chế = 'Không thể đăng nhập', lucas 'Vô thời hạn'; cột 'Thực hiện bởi' = Platform Admin; menu có 'Khôi phục' đứng đầu.")
    A(F, "Trang /admin/users/restricted: lọc trạng thái, tìm kiếm và trạng thái rỗng", "Chức năng", "Thấp", BASE_UI,
      ["Lọc 'Trạng thái' = Tạm ngưng", "Gõ 'zzz' vào ô tìm"], "-", "Lọc Tạm ngưng chỉ còn olivia, lucas; tìm 'zzz' hiện 'Không có người dùng nào đang bị hạn chế hoặc tạm ngưng.'.")
    A(F, "Trang /admin/users/banned: danh sách người bị cấm và menu chỉ có Xem/Khôi phục", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/users/banned", "Mở menu … của Sophia Patel"], "-",
      "Tiêu đề 'Người dùng bị cấm' (mô tả 'Tài khoản bị cấm vĩnh viễn. Mọi lệnh cấm đều được ghi vào nhật ký.'); 1 dòng Sophia Patel, lý do Scam, 'Cấm bởi' Platform Admin; menu chỉ có 'Xem' và 'Khôi phục'. Khi không còn ai: 'Chưa có người dùng nào bị cấm.'.")

    # ============================================================ 10. NGƯỜI DÙNG - CHI TIẾT
    F = "Người dùng: Chi tiết"
    A(F, "GET /admin/users/:id trả hồ sơ, thống kê, hoạt động gần đây và bảo mật", "Chức năng", "Cao", BASE_API,
      ["Lấy id Sarah Kim từ GET /admin/users?q=sarah", "GET /api/admin/users/<id>"], "sarah",
      "200: id, name 'Sarah Kim', status active, bio/location/website, emailVerified=true, lastLoginAt, isPlatformAdmin=false, stats {communities, owned, posts, comments, purchases, lifetimeSpendCents, activeSubscriptions, refundsCents, reportsReceived, confirmedViolations, warnings, suspensions}, recentActivity (≤5), security {emailVerified, activeSessions [seed-admin-sess-sarah ip 113.161.24.10]}.")
    A(F, "GET /admin/users/:id: không tồn tại 404; chi tiết admin có isPlatformAdmin=true", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/users/khong-ton-tai-uuid", "GET /api/admin/users/<id của admin@sofinhub.test>"], "-", "Lệnh 1: 404 'Không tìm thấy người dùng'; lệnh 2: 200 isPlatformAdmin=true.")
    A(F, "Trang chi tiết người dùng: 6 tab, tiêu đề và breadcrumb", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/users/<id sarah>", "Bấm lần lượt các tab"], "sarah",
      "6 tab: Tổng quan, Cộng đồng đã tham gia, Hoạt động, Lịch sử mua, Báo cáo / Vi phạm, Bảo mật (?tab= đổi theo tab); tiêu đề 'Sarah Kim'; breadcrumb 'Sarah Kim › <tên tab>'.")
    A(F, "Tab Tổng quan: KPI, Hồ sơ, Hoạt động gần đây, Tình trạng tài khoản", "Giao diện", "Trung bình", BASE_UI,
      ["Mở tab Tổng quan của Sarah Kim và của Maya Chen"], "sarah, maya",
      "KPI: Cộng đồng, Bài viết, Bình luận, Lượt mua, Báo cáo ('Hồ sơ sạch' khi 0, 'Đã nhận' khi > 0); khối 'Hồ sơ', 'Hoạt động gần đây', 'Tình trạng tài khoản' (Maya: Bị hạn chế, lý do Spam, hạn chế đăng bài/bình luận, đến ngày +7).")
    A(F, "Tab Cộng đồng đã tham gia: vai trò, gói thành viên, trạng thái", "Chức năng", "Trung bình", BASE_UI,
      ["Mở tab 'Cộng đồng đã tham gia' của member1 (tìm bằng member1@sofinhub.test)", "Menu … > 'Mở cộng đồng'"], "member1",
      "Hàng photo, yt, fin (Thành viên, Miễn phí) và paid-demo (Trả phí · $19/tháng); cột Tham gia, Hoạt động gần nhất, Trạng thái; 'Mở cộng đồng' -> /admin/communities/<id>. Người chưa tham gia nơi nào: 'Người dùng này chưa tham gia cộng đồng nào.'")
    A(F, "API /users/:id/communities, /activity, /purchases, /reports trả cấu trúc và phân trang", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/users/<member1>/communities", "GET .../activity?type=payment&limit=5", "GET .../purchases", "GET .../reports"], "member1",
      "communities: [{id,name,role,membership,priceUsd,joinedAt,lastActiveAt,status}]; activity chỉ gồm type=payment khi lọc; purchases kèm summary {lifetimeSpendCents,activeSubscriptions,refundsCents}; reports kèm meta.summary {received, confirmed, warnings, suspensions}; tất cả có meta phân trang.")
    A(F, "activity?type không hợp lệ trả 400; các giá trị hợp lệ lọc đúng", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/users/<id>/activity?type=login", "…type=community", "…type=content", "…type=moderation", "…type=banana"], "sarah", "4 loại hợp lệ trả 200 chỉ gồm loại đó; banana 400 VALIDATION_ERROR.")
    A(F, "Tab Hoạt động: bộ lọc loại (Tất cả/Đăng nhập/Cộng đồng/Nội dung/Thanh toán/Kiểm duyệt)", "Chức năng", "Trung bình", BASE_UI,
      ["Mở tab Hoạt động của Sarah Kim", "Chọn lần lượt từng loại"], "sarah", "Dòng thời gian cập nhật theo loại; mỗi mục có icon, tiêu đề, chi tiết, thời gian; loại không có dữ liệu hiện trạng thái rỗng, không lỗi.")
    A(F, "Tab Lịch sử mua: KPI và bảng giao dịch của member1", "Chức năng", "Trung bình", BASE_UI,
      ["Mở tab 'Lịch sử mua' của member1"], "member1",
      "KPI: Tổng chi tiêu, Gói đang hoạt động, Hoàn tiền; bảng Giao dịch (số hóa đơn INV-...), Cộng đồng 'paid-demo', Số tiền $19.00, Đã hoàn, Phương thức, Trạng thái 'Thành công', Ngày; 2 giao dịch seed-pay-member1-a/b. Người chưa mua: 'Người dùng này chưa có giao dịch nào.'")
    A(F, "Tab Báo cáo / Vi phạm của người bị báo cáo (lucas)", "Chức năng", "Trung bình", BASE_UI,
      ["Mở tab 'Báo cáo / Vi phạm' của Lucas Silva"], "lucas",
      "KPI: Báo cáo nhận được (≥ 4: #1,#2,#3,#5), Vi phạm đã xác nhận, Cảnh cáo, Lần tạm ngưng; bảng vụ việc, menu '… > Duyệt' -> trang vụ việc. Người sạch (sarah): 'Người dùng này chưa bị báo cáo.'")
    A(F, "Tab Bảo mật: danh sách phiên và thu hồi phiên (UI)", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở tab 'Bảo mật' của Sarah Kim", "Quan sát bảng 'Phiên đang hoạt động'", "Menu … > 'Thu hồi' ở phiên seed-admin-sess-sarah"], "sarah",
      "Cột Thiết bị ('Chrome · macOS'), IP (113.161.24.10), Tạo lúc, Hoạt động gần nhất, Trạng thái 'Hoạt động'; sau thu hồi: toast 'Đã thu hồi phiên', phiên biến khỏi bảng, hiện 'Không có phiên đang hoạt động.'; audit user.revoke_session.")
    A(F, "DELETE /admin/users/:id/sessions/:sid: thu hồi, 404 và hiệu lực token", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["Đăng nhập sarah@sofinhub.test lấy token T; lấy sid từ GET /admin/users/<sarah> -> security.activeSessions", "DELETE /api/admin/users/<sarah>/sessions/<sid>", "GET /api/auth/me bằng T", "DELETE lại cùng sid", "DELETE .../sessions/khong-co"], "sarah",
      "Lệnh 1: 200 {data:{revoked:true}}; token T bị 401 ngay; lệnh lặp và sid lạ: 404 'Không tìm thấy phiên đăng nhập'; audit user.revoke_session.", pw="Một phần")

    # ============================================================ 11. NGƯỜI DÙNG - THAO TÁC & HIỆU LỰC
    F = "Người dùng: Hạn chế / Tạm ngưng / Cấm / Cảnh cáo"
    A(F, "Hạn chế người dùng (UI): chọn hạn chế, thời hạn, lý do", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ở /admin/users menu … của Sarah Kim > 'Hạn chế'", "Hộp thoại 'Hạn chế Sarah Kim': chip 'Không được đăng bài' và 'Không được mua'", "Thời hạn '7 ngày', Lý do 'Spam'", "Xác nhận"], "sarah",
      "Nhóm chip Chọn hạn chế (Không được đăng bài / bình luận / nhắn tin / tạo cộng đồng / mua), Thời hạn (24 giờ, 7 ngày, 30 ngày, Vô thời hạn), Lý do (Spam, Quấy rối, Ngôn từ thù ghét, Lừa đảo, Bản quyền, Nội dung nhạy cảm, Khác); toast 'Đã hạn chế · Sarah Kim'; trạng thái 'Bị hạn chế'; xuất hiện ở /admin/users/restricted.")
    A(F, "POST restrict: mặc định post, comment, create_community; tùy chỉnh và thời hạn", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/users/<alex>/restrict {\"reason\":\"Spam\"}", "GET /api/admin/users/<alex>", "POST /api/admin/users/<liam>/restrict {\"reason\":\"Quấy rối\",\"restrictions\":[\"dm\",\"purchase\"],\"duration\":\"30d\"}"], "alex, liam",
      "alex: 200 status=restricted, restrictions=['post','comment','create_community'], statusUntil=null (vô thời hạn); liam: restrictions=['dm','purchase'], statusUntil ≈ +30 ngày; statusChangedBy = Platform Admin; audit user.restrict kèm metadata from/to.")
    A(F, "restrict: validate (thiếu reason, restriction sai, until quá khứ) và trạng thái không hợp lệ", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/users/<noah>/restrict {}", "POST ... {\"reason\":\"x\",\"restrictions\":[\"fly\"]}", "POST ... {\"reason\":\"x\",\"until\":\"2020-01-01T00:00:00Z\"}", "POST /api/admin/users/<olivia>/restrict {\"reason\":\"x\"}", "POST /api/admin/users/<sophia>/restrict {\"reason\":\"x\"}"], "-",
      "3 lệnh đầu 400 VALIDATION_ERROR; lệnh với olivia (suspended) và sophia (banned): 409 'Hãy gỡ trạng thái hiện tại của tài khoản trước khi...'.")
    A(F, "Người bị hạn chế 'post' không đăng bài được: 403 ACCOUNT_RESTRICTED", "Bảo mật", "Cao", SEED + " Đăng nhập maya@sofinhub.test / Passw0rd!x (restricted: post, comment; maya là thành viên yt, mkt).",
      ["Đăng nhập maya lấy token", "POST /api/courses/yt/posts {\"content\":\"hello\"} (hoặc đăng bài trên UI /courses/yt/community)"], "maya",
      "403, error.code=ACCOUNT_RESTRICTED, message 'Tài khoản của bạn đang bị hạn chế, không thể đăng bài.', details {reason:'Spam', until: ISO +7 ngày}; UI hiển thị lỗi, không tạo bài.")
    A(F, "Người bị hạn chế 'comment' không bình luận được nhưng vẫn đọc/like được", "Bảo mật", "Cao", SEED + " Đăng nhập maya@sofinhub.test (restricted: post, comment).",
      ["POST bình luận vào một bài ở yt (POST /api/posts/<postId>/comments {\"content\":\"hi\"})", "GET bảng tin yt", "Like một bài"], "maya",
      "Bình luận: 403 ACCOUNT_RESTRICTED 'không thể bình luận'; đọc bảng tin 200; like vẫn 200 (chỉ chặn đúng quyền bị hạn chế).")
    A(F, "Người bị hạn chế 'create_community' và 'dm' bị chặn đúng quyền", "Bảo mật", "Cao", SEED + " Đăng nhập ethan@sofinhub.test (restricted: dm, create_community).",
      ["POST /api/communities (tạo cộng đồng mới, body hợp lệ; POST /api/courses không còn là route tạo)", "Gửi tin nhắn tới member bất kỳ chung cộng đồng (POST /api/conversations/<id>/messages hoặc từ UI chat)", "Đăng bài ở cộng đồng ethan là thành viên (không bị chặn)"], "ethan",
      "Tạo cộng đồng: 403 ACCOUNT_RESTRICTED 'không thể tạo cộng đồng'; nhắn tin: 403 ACCOUNT_RESTRICTED 'không thể nhắn tin'; đăng bài vẫn 201 (ethan không bị hạn chế post).")
    A(F, "Người bị hạn chế 'purchase' không checkout được", "Bảo mật", "Cao", BASE_API + " " + MUTATE,
      ["Admin POST /api/admin/users/<newbie>/restrict {\"reason\":\"Lừa đảo\",\"restrictions\":[\"purchase\"]}", "Đăng nhập newbie@sofinhub.test, POST /api/courses/paid-demo/checkout {\"method\":\"stripe\"}"], "newbie",
      "403 ACCOUNT_RESTRICTED 'Tài khoản của bạn đang bị hạn chế, không thể mua hàng.'; không tạo giao dịch pending.")
    A(F, "Hạn chế hết hạn (statusUntil) tự gỡ khi được kiểm tra", "Chức năng", "Cao", "Cần sửa DB: đặt statusUntil của ethan = 1 phút trước (status vẫn restricted). " + MUTATE,
      ["Đăng nhập ethan@sofinhub.test và POST /api/communities (tạo cộng đồng)", "Mở /admin/users?q=ethan"], "ethan",
      "Lệnh tạo cộng đồng KHÔNG còn bị chặn (hệ thống tự gỡ về active khi đọc), trạng thái hiển thị 'Hoạt động', statusReason/restrictions xóa; ethan biến khỏi trang Hạn chế / Tạm ngưng.", pw="Một phần")
    A(F, "Tạm ngưng người dùng (UI): thời hạn + lý do + ghi chú", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Menu … của Alex Rivera > 'Tạm ngưng'", "Hộp thoại 'Tạm ngưng Alex Rivera?': thời hạn '24 giờ', lý do 'Quấy rối', ghi chú 'Bằng chứng ở vụ việc #4'", "Xác nhận"], "alex",
      "Toast 'Đã tạm ngưng · Alex Rivera'; trạng thái 'Tạm ngưng'; xuất hiện ở /admin/users/restricted với 'Không thể đăng nhập' và hạn +24 giờ.")
    A(F, "POST suspend: active/restricted -> suspended, thu hồi toàn bộ phiên", "Bảo mật", "Cao", BASE_API + " " + MUTATE,
      ["Đăng nhập daniel@sofinhub.test lấy token T và refresh cookie", "Admin POST /api/admin/users/<daniel>/suspend {\"reason\":\"Spam\",\"duration\":\"7d\"}", "GET /api/auth/me bằng T", "POST /api/auth/refresh với cookie cũ"], "daniel",
      "Suspend 200 status=suspended, statusUntil ≈ +7 ngày; token T 401 ngay; refresh 401/403 (phiên đã thu hồi); audit user.suspend (metadata from/to).", pw="Một phần")
    A(F, "Đăng nhập bị chặn với tài khoản tạm ngưng: 403 ACCOUNT_SUSPENDED kèm lý do và hạn", "Bảo mật", "Cao", SEED + " Dùng olivia@sofinhub.test (suspended, Harassment, +14 ngày).",
      ["POST /api/auth/login {\"email\":\"olivia@sofinhub.test\",\"password\":\"Passw0rd!x\"}", "Đăng nhập trên UI /login bằng tài khoản này"], "olivia",
      "403, error.code=ACCOUNT_SUSPENDED, message 'Tài khoản của bạn đang bị đình chỉ đến <ISO>.', details {reason:'Harassment', until:<ISO>}; UI hiển thị lỗi, không vào được. Với lucas (vô thời hạn): message 'Tài khoản của bạn đang bị đình chỉ.', until=null.")
    A(F, "Sai mật khẩu trên tài khoản tạm ngưng vẫn trả 401 (không lộ trạng thái)", "Bảo mật", "Trung bình", SEED,
      ["POST /api/auth/login {\"email\":\"olivia@sofinhub.test\",\"password\":\"sai-mat-khau\"}"], "olivia", "401 sai thông tin đăng nhập (trạng thái chỉ kiểm sau khi mật khẩu đúng).")
    A(F, "Tạm ngưng có hạn tự hết hiệu lực khi đăng nhập sau statusUntil", "Chức năng", "Cao", "Cần sửa DB: đặt statusUntil của olivia = 1 phút trước (status vẫn suspended). " + MUTATE,
      ["POST /api/auth/login olivia@sofinhub.test / Passw0rd!x", "Mở /admin/users?q=olivia"], "olivia", "Đăng nhập 200 thành công; trạng thái olivia trở thành 'Hoạt động' (statusReason/Until xóa); biến khỏi /admin/users/restricted.", pw="Một phần")
    A(F, "suspend: validate và trạng thái không hợp lệ", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/users/<noah>/suspend {}", "POST /api/admin/users/<olivia>/suspend {\"reason\":\"x\"}", "POST /api/admin/users/<sophia>/suspend {\"reason\":\"x\"}"], "-", "Lệnh 1: 400; lệnh 2 và 3: 409 (phải gỡ trạng thái hiện tại trước).")
    A(F, "Cấm người dùng (UI) bắt buộc gõ BAN", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Menu … của Daniel Park > 'Cấm'", "Hộp thoại 'Cấm vĩnh viễn Daniel Park?': lý do 'Lừa đảo', bằng chứng 'link vụ việc'", "Để ô 'Gõ BAN để xác nhận' trống -> quan sát nút", "Gõ 'BAN' và xác nhận"], "daniel",
      "Nút xác nhận vô hiệu cho tới khi gõ đúng 'BAN'; toast 'Đã cấm · Daniel Park'; trạng thái 'Bị cấm'; xuất hiện ở /admin/users/banned.")
    A(F, "POST ban: mọi trạng thái trừ banned; thu hồi phiên; chặn đăng nhập ACCOUNT_BANNED", "Bảo mật", "Cao", BASE_API + " " + MUTATE,
      ["Đăng nhập emma@sofinhub.test lấy token T", "Admin POST /api/admin/users/<emma>/ban {\"reason\":\"Lừa đảo\",\"evidence\":\"11 báo cáo\"}", "GET /api/auth/me bằng T", "POST /api/auth/login emma", "POST ban lần 2"], "emma",
      "Ban 200 status=banned; T 401 ngay; đăng nhập 403 ACCOUNT_BANNED 'Tài khoản của bạn đã bị cấm vĩnh viễn khỏi SofinHub.' (details.reason='Lừa đảo'); ban lần 2: 409 'Tài khoản đã bị cấm'; audit user.ban có evidence.", pw="Một phần")
    A(F, "Đăng nhập tài khoản bị cấm sẵn trong seed (sophia) trả 403 ACCOUNT_BANNED", "Bảo mật", "Cao", SEED,
      ["POST /api/auth/login {\"email\":\"sophia@sofinhub.test\",\"password\":\"Passw0rd!x\"}"], "sophia", "403 ACCOUNT_BANNED, details.reason='Scam'.")
    A(F, "Ban không gỡ ghi danh cộng đồng; khôi phục trả nguyên trạng", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["Admin ban noah (thành viên/chủ cộng đồng)", "GET /api/admin/users/<noah>/communities", "POST /api/admin/users/<noah>/reinstate {}", "Đăng nhập noah"], "noah",
      "Sau ban danh sách cộng đồng của noah vẫn còn nguyên (không gỡ Enrollment); sau reinstate status=active, đăng nhập lại được, cộng đồng/vai trò nguyên vẹn.")
    A(F, "Khôi phục người dùng (UI): restricted/suspended/banned về Hoạt động", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ở /admin/users/restricted menu … của Olivia Tran > 'Khôi phục'", "Hộp thoại 'Khôi phục Olivia Tran?' nhập ghi chú, xác nhận", "Ở /admin/users/banned khôi phục Sophia Patel"], "olivia, sophia",
      "Toast 'Đã khôi phục · <tên>'; trạng thái 'Hoạt động'; biến khỏi hai trang danh sách đặc biệt; olivia/sophia đăng nhập lại được.")
    A(F, "POST reinstate: chỉ khi restricted/suspended/banned (active trả 409)", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/users/<maya>/reinstate {\"note\":\"hết hạn\"}", "POST /api/admin/users/<ava>/reinstate {}"], "maya, ava",
      "Lệnh 1: 200 status=active, restrictions=[]; lệnh 2: 409 'Tài khoản đang hoạt động bình thường'; audit user.reinstate (lệnh 1).")
    A(F, "Cảnh cáo người dùng (UI): không đổi trạng thái, gửi thông báo", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Menu … của Liam Nguyen > 'Cảnh cáo'", "Hộp thoại 'Gửi cảnh cáo': Vi phạm 'Spam', Tin nhắn 'Vui lòng ngừng đăng liên kết giới thiệu'", "Xác nhận", "Đăng nhập liam@sofinhub.test xem chuông thông báo"], "liam",
      "Toast 'Đã gửi cảnh cáo · Liam Nguyen'; trạng thái liam vẫn 'Hoạt động'; liam nhận 1 thông báo loại system có nội dung cảnh cáo; /admin/moderation/warnings có dòng mới (không có mã vụ việc: '—').")
    A(F, "POST warn: thông báo + audit user.warn; thiếu message trả 400", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/users/<liam>/warn {\"reason\":\"Spam\"}", "POST ... {\"reason\":\"Spam\",\"message\":\"Vui lòng ngừng spam\"}", "GET /api/notifications bằng token liam"], "liam",
      "Lệnh 1: 400; lệnh 2: 200; thông báo type=system tới liam; audit user.warn với evidence = nội dung cảnh cáo; stats.warnings của liam tăng 1.")
    A(F, "Không thể tác động lên chính mình, Platform Admin, tài khoản minh họa", "Bảo mật", "Cao", BASE_API,
      ["POST /api/admin/users/<id admin>/suspend {\"reason\":\"x\"}", "POST /api/admin/users/<id admin>/ban {\"reason\":\"x\"}", "POST /api/admin/users/<id một user isDemo, vd. demo-photo-1>/warn {\"reason\":\"x\",\"message\":\"y\"}"], "admin, demo user",
      "Lệnh admin: 403 'Bạn không thể tự áp dụng hình phạt lên chính mình'; lệnh demo: 400 'Không thể tác động lên thành viên minh họa'; không có audit mới. (Platform Admin khác cũng 403 'Không thể tác động lên Platform Admin'.)")
    A(F, "Thao tác lên người dùng không tồn tại/đã xóa trả 404", "Chức năng", "Trung bình", BASE_API,
      ["POST /api/admin/users/khong-ton-tai/ban {\"reason\":\"x\"}", "POST /api/admin/users/<id tài khoản đã xóa>/restrict {\"reason\":\"x\"}"], "-", "Cả hai 404 'Không tìm thấy người dùng'.")
    A(F, "Lý do/ghi chú quá 500 ký tự bị từ chối", "Chức năng", "Thấp", BASE_API,
      ["POST /api/admin/users/<noah>/warn {\"reason\":\"<501 ký tự>\",\"message\":\"y\"}"], "reason 501 ký tự", "400 VALIDATION_ERROR.")
    A(F, "XSS: lý do/ghi chú chứa HTML hiển thị dạng text, không thực thi", "Bảo mật", "Cao", BASE_UI + " " + MUTATE,
      ["Cảnh cáo Ava Johnson với tin nhắn '<img src=x onerror=alert(1)>'", "Mở /admin/system/audit và /admin/moderation/warnings xem dòng vừa tạo"], "<img src=x onerror=alert(1)>",
      "Hiển thị nguyên văn như chữ, không có hộp thoại alert, không có phần tử img được chèn vào DOM.")
    A(F, "Tiêm SQL/ký tự đặc biệt ở tham số tìm kiếm không gây lỗi", "Bảo mật", "Cao", BASE_API,
      ["GET /api/admin/users?q=' OR 1=1 --", "GET /api/admin/communities?q=%27%3B%20DROP%20TABLE%20%22User%22%3B--", "GET /api/admin/moderation/cases?q=<script>"], "-", "200 với danh sách rỗng/không khớp; không 500; dữ liệu không đổi (truy vấn tham số hóa).")

    # ============================================================ 12. KIỂM DUYỆT - HÀNG ĐỢI
    F = "Kiểm duyệt: Hàng đợi báo cáo"
    A(F, "Trang /admin/moderation: tiêu đề, 4 KPI, tab, bảng", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/moderation"], "-",
      "Tiêu đề 'Hàng đợi báo cáo' (mô tả 'Phân loại nội dung và người dùng bị báo cáo theo mức rủi ro.'). KPI: Báo cáo mở, Nghiêm trọng, Đang xem xét, Xử lý hôm nay. Tab: Tất cả, Mở (kèm số), Đang xem xét (kèm số), Đã xử lý; mặc định tab 'Mở'. Phân trang 20 dòng.")
    A(F, "GET /admin/moderation/summary khớp dữ liệu seed", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/moderation/summary", "Đếm trực tiếp bảng Report theo status/risk"], "-",
      "open, critical (≥ 4: #1,#2,#3,#9), underReview = 2 (#4,#10), resolvedToday, warnings, removedContent, suspendedUsers: mỗi số bằng đếm trực tiếp trong DB theo cùng định nghĩa và khớp KPI trên UI.")
    A(F, "Hàng đợi mặc định (tab Mở) gộp báo cáo trùng: bài post-1 chỉ hiện 1 dòng, reportCount=3", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/moderation/cases?status=open", "Tìm dòng của bài seed-admin-post-1"], "post-1",
      "Chỉ có 1 dòng cho bài post-1: là báo cáo cũ nhất (#3), reportCount=3, risk critical; #1 và #2 không xuất hiện trong danh sách mặc định.")
    A(F, "includeDuplicates=true hiện đủ các báo cáo trùng", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/moderation/cases?status=open&includeDuplicates=true", "So số dòng với lệnh mặc định"], "-", "Nhiều hơn mặc định đúng 2 dòng (#1, #2); mỗi dòng của post-1 đều reportCount=3.")
    A(F, "Tab 'Đang xem xét' và 'Đã xử lý' trên giao diện", "Chức năng", "Trung bình", BASE_UI,
      ["Mở /admin/moderation", "Bấm tab 'Đang xem xét'", "Bấm tab 'Đã xử lý'", "Bấm tab 'Tất cả'"], "-",
      "'Đang xem xét' hiện #4 (bình luận sophia) và #10 (thành viên sophia); 'Đã xử lý' hiện #7 (Bỏ qua), #11, #12 (Đã xử lý); 'Tất cả' hiện mọi trạng thái; số đếm trên tab khớp KPI; đổi tab về trang 1.")
    A(F, "Lọc theo Rủi ro, Lý do, Người phụ trách", "Chức năng", "Cao", BASE_UI,
      ["Mở /admin/moderation tab 'Tất cả'", "Lọc 'Rủi ro' = Nghiêm trọng", "Đổi 'Lý do' = Lừa đảo", "Lọc 'Người phụ trách' = Chưa phân công", "Đổi thành 'Tôi'"], "-",
      "Mỗi bộ lọc gọi lại API; Nghiêm trọng ra #3 (gộp #1,#2) và #9; Lừa đảo (scam) ra #3 (gộp) và #8; 'Chưa phân công' có #3, #6, #8; 'Tôi' rỗng nếu admin chưa nhận vụ nào (hiện trạng thái rỗng).")
    A(F, "API lọc cases: risk/reason/assignee/targetType/courseId và giá trị sai trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/moderation/cases?risk=critical", "…?reason=hate_speech", "…?assignee=unassigned", "…?assignee=<id john>", "…?targetType=comment&status=all", "…?courseId=yt", "…?risk=extreme", "…?status=banana"], "-",
      "Các lệnh hợp lệ 200 và đúng tập (hate_speech = #9; targetType=comment = #4,#6,#9,#12; courseId=yt = #5,#11); risk=extreme và status=banana 400 VALIDATION_ERROR.")
    A(F, "Sắp xếp theo rủi ro", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/moderation/cases?status=open&sort=risk"], "sort=risk", "Thứ tự critical > high > medium > low; cùng mức thì mới nhất trước.")
    for q, ex in (("CASE-00007", "vụ việc #7 (theo mã, bỏ qua số 0 đứng đầu)"), ("Telegram", "vụ việc #11 (theo nội dung)"), ("Lucas", "các vụ việc có người bị báo cáo Lucas Silva"), ("Sarah", "vụ việc có người báo cáo Sarah Kim")):
        A(F, f"Tìm kiếm hàng đợi với '{q}'", "Chức năng", "Trung bình", BASE_UI,
          ["Mở /admin/moderation tab 'Tất cả'", f"Gõ '{q}' vào 'Tìm mã vụ việc, nội dung, người dùng...'"], f"q={q}", f"Bảng chỉ còn {ex}; gọi GET /api/admin/moderation/cases?q={q}.")
    A(F, "API cases: phân trang và biên", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/moderation/cases?status=all&limit=3&page=2", "GET ...?limit=101", "GET ...?page=0"], "-", "Trang 2 gồm 3 dòng; limit=101/page=0 trả 400.")
    A(F, "Menu '…' của dòng vụ việc theo trạng thái và loại đối tượng", "Chức năng", "Cao", BASE_UI,
      ["Tab 'Tất cả', mở menu … của #9 (bình luận, open), #10 (thành viên, under_review), #12 (đã xử lý)"], "-",
      "Vụ việc mở/đang xem xét: Duyệt, Nhận xử lý (nếu chưa nhận), Bỏ qua, Gỡ nội dung (CHỈ khi đối tượng là bài/bình luận - #10 kiểu 'Thành viên' không có), Cảnh cáo, Tạm ngưng người dùng; vụ việc đã xử lý: chỉ 'Duyệt' (xem).")
    A(F, "'Nhận xử lý' từ hàng đợi: gán cho tôi, chuyển Đang xem xét", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Ở tab 'Mở' menu … của #6 > 'Nhận xử lý'"], "#6",
      "Toast 'Đã nhận xử lý · CASE-0000x'; dòng có Phụ trách = Platform Admin, trạng thái 'Đang xem xét'; chuyển sang tab 'Đang xem xét'; audit case.assign.")
    A(F, "GET /admin/moderation/assignees chỉ gồm Platform Admin và người đang được giao", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/moderation/assignees"], "-", "200 danh sách {id,name,email,canBeAssigned}: gồm Platform Admin, John Carter, Mia Lopez (đang có case được giao) và mọi nhân viên admin đang hoạt động có quyền report.resolve (Moderator, Support); canBeAssigned=true với Platform Admin (env) và với nhân viên có report.resolve (john/mia là Moderator nên được giao; admin-moderation.service.ts assignees()).")
    A(F, "Trạng thái rỗng khi không còn báo cáo mở", "Giao diện", "Thấp", BASE_UI + " Đã xử lý hết mọi vụ việc mở. " + MUTATE,
      ["Mở /admin/moderation tab 'Mở'"], "-", "Hiện 'Không có báo cáo nào đang chờ xử lý.'; KPI 'Báo cáo mở' = 0.", pw="Một phần")
    A(F, "Bấm dòng mở trang chi tiết vụ việc", "Chức năng", "Trung bình", BASE_UI,
      ["Bấm dòng #9"], "#9", "Chuyển /admin/moderation/cases/<id> hiển thị 'Báo cáo CASE-0000x'.")

    # ============================================================ 13. KIỂM DUYỆT - CHI TIẾT & XỬ LÝ
    F = "Kiểm duyệt: Chi tiết & Xử lý vụ việc"
    A(F, "Trang chi tiết vụ việc: tiêu đề, nội dung bị báo cáo, thông tin báo cáo, rủi ro người dùng", "Giao diện", "Cao", BASE_UI,
      ["Mở vụ việc #9 từ hàng đợi"], "#9 (bình luận của olivia, hate_speech, critical)",
      "Breadcrumb 'Hàng đợi báo cáo › Chi tiết báo cáo'; tiêu đề 'Báo cáo CASE-0000x', phụ đề 'Ngôn từ thù ghét · bị báo cáo 1 lần · <thời gian>'; khối 'Nội dung bị báo cáo' (bình luận 'Nobody here wants your garbage, go away.' + bối cảnh bài), 'Thông tin báo cáo' (Lý do, Gửi lúc, Phụ trách John Carter, Rủi ro 'Nghiêm trọng', Trạng thái 'Mở'), 'Rủi ro người dùng' (Cảnh cáo, Lần tạm ngưng), 'Báo cáo liên quan', 'Vụ việc tương tự', 'Quyết định', 'Lịch sử vụ việc'.")
    A(F, "GET /admin/moderation/cases/:id trả đủ cấu trúc chi tiết", "Chức năng", "Cao", BASE_API,
      ["Lấy id của seed-admin-report-3", "GET /api/admin/moderation/cases/<id>"], "#3",
      "200: caseCode, targetType=post, content, reportedUser (Lucas Silva), reporter, reason=spam, reportCount=3, risk=critical, status=open, reportedContent {type, id, excerpt, exists:true, body, author, hidden:false, likes, comments, parentPost:null, thread}, reporterInfo, reportedUserInfo {status:'suspended', accountAgeDays≈9, previousReports, warnings, suspensions, communities}, relatedReports (2 báo cáo còn lại, reporter dạng {id,name}), similarCases (≤5), history.")
    A(F, "Chi tiết vụ việc không tồn tại trả 404", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/moderation/cases/khong-ton-tai"], "-", "404 NOT_FOUND 'Không tìm thấy báo cáo'; UI /admin/moderation/cases/khong-ton-tai hiện khối lỗi tiếng Việt.")
    A(F, "Vụ việc đã đóng: các nút quyết định bị vô hiệu", "Chức năng", "Trung bình", BASE_UI,
      ["Mở vụ việc #12 (Đã xử lý)", "Quan sát khối 'Quyết định'"], "#12", "Các nút 'Không vi phạm', 'Cảnh cáo', 'Hạn chế', 'Tạm ngưng', 'Cấm' ở trạng thái disabled; lịch sử hiển thị 'đã đóng vụ việc' của Mia Lopez.")
    A(F, "Vụ việc kiểu 'Thành viên' không có hành động Gỡ nội dung", "Chức năng", "Trung bình", BASE_UI,
      ["Mở vụ việc #10 (báo cáo thành viên sophia)", "Quan sát nút trong 'Quyết định' và menu hàng đợi"], "#10", "Không có 'Gỡ nội dung'; khối 'Nội dung bị báo cáo' mô tả thành viên bị báo cáo.")
    A(F, "Assign: nhận xử lý (open -> under_review) và bỏ gán", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#8>/assign {}", "GET chi tiết #8", "POST .../assign {\"adminId\":null}", "POST .../assign {\"adminId\":\"<id member1>\"}"], "#8",
      "Lệnh 1: 200 status=under_review, assignee = Platform Admin, history thêm 'đã nhận xử lý vụ việc'; lệnh 3: assignee=null; lệnh 4: 400 'Chỉ giao được cho thành viên đội admin'; audit case.assign cho lệnh 1.")
    A(F, "Cảnh cáo qua vụ việc: gửi thông báo, đóng vụ việc (resolved, action warn_user)", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở vụ việc #6 (bình luận của noah)", "Bấm 'Cảnh cáo' > nhập Tin nhắn 'Vui lòng giữ thái độ văn minh', xác nhận", "Đăng nhập noah@sofinhub.test xem thông báo"], "#6, noah",
      "Toast 'Đã gửi cảnh cáo · Noah Williams'; vụ việc 'Đã xử lý'; lịch sử có 'đã cảnh cáo người dùng'; noah có thông báo mới; ở /admin/moderation/warnings có dòng với mã vụ việc.")
    A(F, "POST case warn: closeCase=false giữ under_review; thiếu message trả 400", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#6>/warn {}", "POST ... {\"message\":\"Cảnh cáo lần 1\",\"closeCase\":false}", "GET chi tiết #6", "POST ... {\"message\":\"Cảnh cáo lần 2\"}"], "#6",
      "Lệnh 1: 400; lệnh 2: 200 status=under_review (chưa đóng); lệnh 4: 200 status=resolved action=warn_user; lịch sử có 2 sự kiện warn; audit case.warn x2.")
    A(F, "Gỡ nội dung (bài viết): ẩn bài, thông báo tác giả, đóng vụ việc", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở vụ việc #5 (bài seed-admin-post-2 của lucas ở yt)", "Bấm 'Gỡ nội dung' (menu hàng đợi hoặc nút trong trang)", "Hộp thoại 'Gỡ nội dung': Vi phạm 'Bản quyền', để tích 'thông báo tác giả'", "Xác nhận", "Mở /courses/yt/community bằng member thường"], "#5, seed-admin-post-2",
      "Toast 'Đã gỡ nội dung'; vụ việc 'Đã xử lý'; bài post-2 bị ẩn (hidden=true) - member thường không còn thấy và GET bài trả 404; /admin/moderation/removals có dòng 'Đã gỡ nội dung'; audit case.remove_content.")
    A(F, "POST remove-content: bình luận, closeCase=false, vụ việc kiểu member trả 400", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#9>/remove-content {\"reason\":\"Ngôn từ thù ghét\",\"closeCase\":false}", "POST .../<#10>/remove-content {\"reason\":\"x\"}", "POST .../<#9>/remove-content {}"], "#9, #10",
      "Lệnh 1: 200, bình luận seed-admin-cmt-3 ẩn, vụ việc vẫn under_review; lệnh 2: 400 'Chỉ gỡ được bài viết hoặc bình luận'; lệnh 3: 400 (thiếu reason).")
    A(F, "Hạn chế người dùng qua vụ việc (restrict-user)", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#6>/restrict-user {\"reason\":\"Quấy rối\",\"restrictions\":[\"comment\"],\"duration\":\"7d\"}", "GET /api/admin/users/<noah>"], "#6 -> noah",
      "200; noah status=restricted, restrictions ['comment'], hạn +7 ngày; lịch sử 'đã hạn chế người dùng'; audit case.restrict_user.")
    A(F, "Tạm ngưng người dùng qua vụ việc (suspend-user)", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở vụ việc #8 (ethan, đang restricted) -> bấm 'Tạm ngưng'", "Chọn thời hạn '30 ngày', lý do 'Lừa đảo', xác nhận", "Thử với #5 (lucas đã suspended sẵn)"], "#8 -> ethan; #5 -> lucas",
      "#8: toast 'Đã tạm ngưng · Ethan Brooks', ethan chuyển 'Tạm ngưng', phiên bị thu hồi, lịch sử 'đã tạm ngưng người dùng', audit case.suspend_user. #5: 409 'Hãy gỡ trạng thái hiện tại của tài khoản trước khi...' (lucas đã tạm ngưng).")
    A(F, "Cấm người dùng qua vụ việc (ban-user)", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#8>/ban-user {\"reason\":\"Lừa đảo\",\"evidence\":\"link\"}", "POST .../<#10>/ban-user {\"reason\":\"x\"}"], "#8 -> ethan; #10 -> sophia",
      "Lệnh 1: 200 ethan status=banned, audit case.ban_user có evidence; lệnh 2: 409 'Tài khoản đã bị cấm' (sophia đã banned sẵn).")
    A(F, "Dismiss (Không vi phạm): đóng vụ việc status=dismissed", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở vụ việc #8", "Bấm 'Không vi phạm'", "Hộp thoại 'Bỏ qua CASE-0000x?' nhập ghi chú, xác nhận"], "#8",
      "Trạng thái 'Bỏ qua'; lịch sử 'đã đóng vụ việc (không vi phạm)'; chuyển sang tab 'Đã xử lý'; audit case.dismiss; không có hình phạt nào áp lên ethan.")
    A(F, "Escalate nâng rủi ro một bậc, đưa về Đang xem xét; critical không tăng thêm", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#6>/escalate {}", "GET chi tiết #6", "POST .../<#9>/escalate {}"], "#6 (low), #9 (critical)",
      "#6: risk low -> medium, status=under_review, audit case.escalate, lịch sử 'đã nâng mức rủi ro'; #9: vẫn critical (không vượt trần).")
    A(F, "Resolve đóng vụ việc không kèm hành động (action none)", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#4>/resolve {\"note\":\"Đã nhắc nhở ngoài hệ thống\"}"], "#4", "200 status=resolved, action=none, note lưu; audit case.resolve.")
    A(F, "Đóng một vụ việc thì đóng luôn các báo cáo trùng đang mở và báo tin cho người báo cáo", "Chức năng", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/moderation/cases/<#3>/resolve {}", "GET /api/admin/moderation/cases?status=open&includeDuplicates=true (tìm #1, #2)", "Đăng nhập sarah / alex xem thông báo"], "#3 (đại diện của #1,#2,#3)",
      "Cả #1, #2, #3 đều resolved cùng kết quả; không còn dòng nào của post-1 ở tab Mở; người báo cáo (sarah, alex) nhận thông báo vụ việc đã được xử lý.", pw="Một phần")
    A(F, "Hành động trên vụ việc đã đóng trả 409", "Chức năng", "Cao", BASE_API,
      ["POST /api/admin/moderation/cases/<#7>/dismiss {}", "POST .../<#11>/warn {\"message\":\"x\"}", "POST .../<#12>/resolve {}", "POST .../<#7>/escalate {}"], "#7 dismissed, #11/#12 resolved",
      "Cả bốn 409 CONFLICT 'Báo cáo này đã được xử lý'; trạng thái và lịch sử không đổi; không có audit mới.")
    A(F, "Hành động trên vụ việc không tồn tại trả 404; note > 500 ký tự trả 400", "Chức năng", "Thấp", BASE_API,
      ["POST /api/admin/moderation/cases/khong-co/dismiss {}", "POST .../<#8>/dismiss {\"note\":\"<501 ký tự>\"}"], "-", "404 NOT_FOUND; 400 VALIDATION_ERROR.")
    A(F, "Rủi ro tự tính: lý do nặng và số báo cáo, không bao giờ tự hạ", "Chức năng", "Trung bình", BASE_API + " " + MUTATE,
      ["Tạo báo cáo mới bằng member: POST /api/posts/<postId>/report {\"reason\":\"inappropriate\"} (nhiều tài khoản khác nhau)", "Tạo 3 báo cáo cùng 1 bài từ 3 tài khoản khác nhau", "GET chi tiết các case"], "-",
      "hate_speech/scam -> risk high; harassment/copyright/nsfw -> medium; 3 báo cáo cùng đối tượng -> ≥ medium, 5 -> ≥ high, 10 -> critical; risk đã nâng (escalate) không bị hạ khi thêm báo cáo.", pw="Một phần")
    A(F, "API báo cáo cũ vẫn hoạt động: GET /admin/reports và PATCH /reports/:id", "Tích hợp", "Trung bình", BASE_API + " " + MUTATE,
      ["GET /api/admin/reports?status=open", "PATCH /api/reports/<id seed-report-photo-open> {\"status\":\"resolved\",\"action\":\"dismiss\"} bằng token admin", "GET /api/admin/audit-logs?action=report.resolve"], "seed-report-photo-open",
      "GET 200 danh sách báo cáo; PATCH 200; audit có report.resolve do Platform Admin; case hiện trong hàng đợi mới như một vụ việc bình thường.")

    # ============================================================ 14. NHẬT KÝ QUYẾT ĐỊNH
    F = "Kiểm duyệt: Nhật ký quyết định"
    for path, title, sub in (("warnings", "Cảnh cáo", "Chưa có cảnh cáo nào."), ("removals", "Nội dung đã gỡ", "Chưa có nội dung nào bị gỡ."), ("suspensions", "Tạm ngưng", "Chưa có quyết định nào."), ("bans", "Lệnh cấm", "Chưa có lệnh cấm nào.")):
        seed_ex = {"warnings": "Seed: Maya Chen (case.warn, vụ việc #11, bằng chứng 'Warned about referral spam.').", "removals": "Seed: nội dung 'Join my Telegram for referral bonuses!!!' (vụ việc #11, lý do Spam).",
                   "suspensions": "Có 2 tab 'Tạm ngưng' (seed: Olivia Tran, lý do Harassment) và 'Hạn chế' (seed: Maya Chen, Spam).", "bans": "Seed: Sophia Patel, lý do Scam, bằng chứng 'Payment link, 11 reports'."}[path]
        A(F, f"Trang /admin/moderation/{path}: tiêu đề, cột và dữ liệu seed", "Giao diện", "Trung bình", BASE_UI,
          [f"Mở /admin/moderation/{path}"], path,
          f"Tiêu đề '{title}', mô tả 'Mọi quyết định được lưu theo: Vụ việc → Quyết định → Quản trị viên → Lý do → Bằng chứng.'; cột: Mã vụ việc, đối tượng (Người dùng/Nội dung), Quyết định, Quản trị viên, Lý do, Bằng chứng, Ngày; khi rỗng '{sub}'. {seed_ex}")
    A(F, "GET /admin/moderation/decisions: lọc type và q, type sai trả 400", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/moderation/decisions?type=ban", "…?type=warning", "…?type=removal", "…?type=restriction", "…?type=suspension&q=olivia", "…?type=banana"], "-",
      "Mỗi type trả đúng loại quyết định từ audit log với {id, case|null, target{type,id,name}, decision, admin, reason, evidence, createdAt}; q lọc theo tên/mã vụ việc; type=banana 400.")
    A(F, "Bấm dòng nhật ký quyết định mở vụ việc tương ứng", "Chức năng", "Thấp", BASE_UI,
      ["Ở /admin/moderation/warnings bấm dòng Maya Chen (có mã vụ việc)", "Bấm dòng không có mã vụ việc (nếu có)"], "-", "Dòng có vụ việc -> /admin/moderation/cases/<id>; dòng không có vụ việc không điều hướng, không lỗi.")
    A(F, "Quyết định mới xuất hiện ngay trong nhật ký sau khi xử lý", "Chức năng", "Trung bình", BASE_UI + " " + MUTATE,
      ["Cấm một người dùng qua vụ việc hoặc trang Người dùng", "Mở /admin/moderation/bans"], "-", "Dòng mới ở đầu danh sách, quản trị viên = Platform Admin, lý do/bằng chứng đúng nội dung đã nhập.")

    # ============================================================ 15. NHẬT KÝ HOẠT ĐỘNG (AUDIT LOG)
    F = "Nhật ký hoạt động (Audit log)"
    A(F, "Trang /admin/system/audit: cột, 11 dòng seed, thứ tự mới nhất trước", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/system/audit"], "-",
      "Tiêu đề 'Nhật ký hoạt động' (mô tả 'Mọi thao tác quản trị đều được ghi lại: ai làm, làm gì, trên đối tượng nào và vì sao.'); cột Thời gian, Quản trị viên, Hành động (nhãn tiếng Việt, vd. 'Cấm người dùng'), Đối tượng ('Sophia Patel (Người dùng)'), Lý do, Ghi chú; ≥ 11 dòng seed, mới nhất đứng đầu; phân trang 30/dòng.")
    A(F, "Lọc theo nhóm hành động và tìm kiếm trong nhật ký", "Chức năng", "Trung bình", BASE_UI,
      ["Chọn 'Loại hành động' = Người dùng", "Chọn 'Cộng đồng'", "Chọn 'Vụ việc kiểm duyệt'", "Gõ 'Sophia' vào ô tìm"], "-",
      "Lọc theo tiền tố action (user. / community. / case.): Người dùng gồm user.ban/suspend/restrict seed; Cộng đồng gồm suspend, delete, reject, request_changes seed; Vụ việc gồm case.dismiss/resolve/warn/remove_content seed; tìm 'Sophia' ra dòng cấm Sophia Patel; không khớp: 'Chưa có thao tác nào được ghi lại.'.")
    A(F, "API audit-logs: lọc action (tiền tố và đầy đủ), targetType, targetId, q", "Chức năng", "Cao", BASE_API,
      ["GET /api/admin/audit-logs?action=user.", "…?action=user.ban", "…?targetType=community", "…?targetId=photo-walks", "…?q=Sophia"], "-",
      "action=user. trả mọi hành động bắt đầu bằng user.; action=user.ban chỉ trả dòng cấm (Sophia Patel, reason 'Scam', evidence 'Payment link, 11 reports', metadata {from:'active',to:'banned'}); targetType/targetId/q lọc đúng.")
    A(F, "API audit-logs: lọc actor và khoảng thời gian from/to", "Chức năng", "Trung bình", BASE_API,
      ["GET /api/admin/audit-logs?actor=<id admin>", "…?from=<ISO 3 ngày trước>&to=<ISO hiện tại>", "…?from=<ISO ngày mai>"], "-", "actor lọc theo người thực hiện; from/to chỉ trả dòng trong khoảng (seed cũ nhất 96 giờ trước bị loại khi from = 3 ngày); from ở tương lai trả rỗng.")
    A(F, "audit-logs: phân trang và tham số sai", "Chức năng", "Thấp", BASE_API,
      ["GET /api/admin/audit-logs?limit=5&page=2", "GET …?limit=101", "GET …?from=khong-phai-ngay"], "-", "Trang 2 có 5 dòng; limit=101 và from sai định dạng trả 400 VALIDATION_ERROR.")
    for fam, act, step in (("Cộng đồng", "community.approve", "Duyệt creator-academy"), ("Người dùng", "user.restrict", "Hạn chế sarah"), ("Vụ việc", "case.dismiss", "Bỏ qua vụ việc #8"), ("Cảnh cáo", "user.warn", "Cảnh cáo liam")):
        A(F, f"Mỗi thao tác ghi tạo đúng 1 dòng audit ({act})", "Chức năng", "Cao", BASE_API + " " + MUTATE,
          ["Ghi lại meta.total của GET /api/admin/audit-logs", f"Thực hiện: {step}", "GET /api/admin/audit-logs?limit=1"], act,
          f"meta.total tăng đúng 1; dòng mới nhất có action={act}, actor = Platform Admin (id + tên + email), targetType/targetId/targetLabel đúng đối tượng, reason/note/evidence đúng dữ liệu gửi, createdAt ≈ hiện tại.")
    A(F, "Thao tác thất bại (409/400/403) KHÔNG ghi audit", "Chức năng", "Cao", BASE_API,
      ["Ghi lại meta.total", "POST approve cộng đồng photo (409), POST ban sophia (409), POST warn thiếu message (400), POST ban chính admin (403)", "So lại meta.total"], "-", "meta.total không đổi sau 4 lệnh thất bại.")
    A(F, "Nhật ký append-only: không có endpoint sửa/xóa", "Bảo mật", "Trung bình", BASE_API,
      ["DELETE /api/admin/audit-logs/<id>", "PATCH /api/admin/audit-logs/<id> {\"reason\":\"x\"}", "POST /api/admin/audit-logs {}"], "-", "Cả ba 404 (không có route) hoặc 405; dòng không thể bị thay đổi qua API.")
    A(F, "Route admin cũ cũng ghi audit (refund_resolve, payout_resolve, lock/unlock)", "Tích hợp", "Cao", BASE_API + " " + MUTATE,
      ["PATCH /api/admin/refunds/<id yêu cầu hoàn tiền pending> {\"status\":\"approved\"}", "PATCH /api/admin/payouts/<id payout requested> {\"status\":\"paid\"}", "POST /api/admin/courses/des/lock {\"reason\":\"x\"} rồi /unlock", "GET /api/admin/audit-logs?action=payment."], "refund/payout/des",
      "Có các dòng payment.refund_resolve, payment.payout_resolve, community.lock, community.unlock với actor Platform Admin; targetType refund/payout/community.", pw="Một phần")
    A(F, "Hiệu năng: audit-logs với vài nghìn dòng vẫn phân trang nhanh", "Hiệu năng", "Thấp", BASE_API + " Đã tạo nhiều dòng audit (script gọi API).",
      ["Đo GET /api/admin/audit-logs?limit=100", "Lọc action=user."], "-", "Phản hồi ≤ 1 giây; số trang đúng.", pw="Không")

    # ============================================================ 16. HỒI QUY: HOÀN TIỀN / CHI TRẢ / KHÓA CŨ
    F = "Hồi quy: Hoàn tiền / Chi trả / Khóa (trong khung mới)"
    A(F, "/admin/payments/refunds hiển thị trong khung admin mới, mục 'Hoàn tiền' được tô sáng", "Giao diện", "Cao", BASE_UI,
      ["Mở /admin/payments/refunds"], "-", "Hiển thị RefundsTab cũ (danh sách yêu cầu hoàn tiền, bộ lọc trạng thái) bên trong sidebar/topbar mới; nhóm 'Thanh toán' mở, mục 'Hoàn tiền' sáng.")
    A(F, "Hoàn tiền: duyệt yêu cầu pending ngoài cửa sổ 7 ngày (demo-paid-demo-2) + audit", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở /admin/payments/refunds, lọc 'pending'", "Bấm duyệt dòng của demo-paid-demo-2, nhập ghi chú, xác nhận", "Mở /admin/system/audit"], "seed-pay-pendref",
      "Yêu cầu chuyển 'approved', giao dịch ghi hoàn tiền; thẻ 'Hoàn tiền chờ duyệt' ở /admin giảm 1; có dòng audit 'Xử lý hoàn tiền' (payment.refund_resolve).")
    A(F, "Hoàn tiền: từ chối yêu cầu có ghi chú", "Chức năng", "Trung bình", BASE_UI + " " + MUTATE,
      ["Ở /admin/payments/refunds chọn một yêu cầu pending", "Bấm 'Từ chối', nhập ghi chú, xác nhận"], "-", "Yêu cầu 'rejected'; không hoàn tiền; audit payment.refund_resolve ghi note.")
    A(F, "/admin/payments/payouts: duyệt/từ chối payout requested của owner + audit", "Chức năng", "Cao", BASE_UI + " " + MUTATE,
      ["Mở /admin/payments/payouts", "Duyệt payout 'requested' của owner (đánh dấu đã chi)", "Mở /admin/system/audit"], "payout seed của owner",
      "Payout chuyển trạng thái đúng như trước đợt này; 'Chi trả chờ duyệt' ở /admin giảm 1; audit payment.payout_resolve.")
    A(F, "Quyền: member truy cập /admin/payments/refunds bị chặn", "Bảo mật", "Cao", SEED + " Đăng nhập member1.",
      ["Mở /admin/payments/refunds", "GET /api/admin/refunds bằng token member1"], "member1", "UI: 'Bạn không có quyền truy cập khu vực quản trị.'; API: 403 FORBIDDEN.")
    A(F, "Khóa/mở khóa cộng đồng (route cũ) vẫn trả COMMUNITY_LOCKED và đồng bộ trạng thái mới", "Tích hợp", "Cao", BASE_API + " " + MUTATE,
      ["POST /api/admin/courses/des/lock {\"reason\":\"Vi phạm\"}", "GET /api/admin/communities/des", "Thành viên des POST bài -> 403 COMMUNITY_LOCKED", "POST /api/admin/courses/des/unlock", "GET /api/admin/communities/des"], "des",
      "Sau lock: admin communities hiển thị status=suspended (locked=true được hiểu là suspended); sau unlock: moderationStatus=active, status=active; thao tác thành viên hoạt động lại.")
    A(F, "Trang quản trị cũ (AdminPage/AdminReportsPage) không còn; /admin/reports điều hướng", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin (không còn trang cũ nhiều tab)", "Mở /admin/reports"], "-", "/admin là Bảng điều khiển mới; /admin/reports chuyển /admin/moderation; không có route lỗi 404/trắng.")

    # ============================================================ 17. PHI CHỨC NĂNG
    F = "Phi chức năng: Ngôn ngữ / Ổn định / Bảo mật"
    A(F, "Toàn bộ nhãn giao diện admin bằng tiếng Việt (trừ tên riêng và câu hoạt động lạ)", "Giao diện", "Trung bình", BASE_UI,
      ["Duyệt qua mọi trang: Tổng quan, Cộng đồng (5 trang), Người dùng (3 trang + chi tiết), Kiểm duyệt (6 trang + chi tiết), Nhật ký", "Mở mọi hộp thoại hành động và toast"], "-",
      "Không còn nhãn tiếng Anh sót (Approve, Suspend, Reports...); badge dùng nhãn Việt (Hoạt động, Bị hạn chế, Tạm ngưng, Bị cấm, Chờ duyệt, Đã từ chối, Đã xóa, Mở, Đang xem xét, Đã xử lý, Bỏ qua); ngoại lệ đã biết: 'Creator', 'MRR'. Nội dung do người dùng/BE tạo (excerpt, câu hoạt động lạ) có thể là tiếng Anh.", pw="Không")
    A(F, "Định dạng ngày giờ và tiền tệ nhất quán", "Giao diện", "Thấp", BASE_UI,
      ["Quan sát cột ngày, 'x phút trước', số tiền ở Người dùng/Cộng đồng/Doanh thu"], "-", "Ngày theo định dạng Việt, thời gian tương đối bằng tiếng Việt, tiền hiển thị USD đúng cent ($19.00), số lớn có phân tách hàng nghìn.", pw="Không")
    A(F, "Toast thành công/lỗi hiển thị cho mọi hành động và tự ẩn", "Giao diện", "Trung bình", BASE_UI + " " + MUTATE,
      ["Thực hiện một hành động thành công (vd. Cảnh cáo)", "Gây lỗi (vd. mở 2 tab, tạm ngưng cùng một cộng đồng ở cả hai)"], "-", "Thành công: toast 'Đã ...'; lỗi: toast hiển thị message từ BE (vd. 409); toast tự ẩn sau vài giây; hộp thoại đóng khi thành công, giữ mở khi lỗi.", pw="Một phần")
    A(F, "Hộp thoại hành động: Esc/Hủy đóng, nút xác nhận chặn bấm đúp", "Giao diện", "Thấp", BASE_UI + " " + MUTATE,
      ["Mở hộp thoại 'Tạm ngưng' rồi bấm 'Hủy' / Esc / nền mờ", "Mở lại, xác nhận và bấm đúp nhanh nút xác nhận"], "-", "Hủy/Esc/nền mờ đóng không gọi API; xác nhận chỉ gửi 1 request (nút disabled khi đang xử lý), audit chỉ có 1 dòng.", pw="Một phần")
    A(F, "Tải lại trang giữ nguyên tab/mục chọn qua URL (?tab=, ?id=, ?sort=)", "Chức năng", "Thấp", BASE_UI,
      ["Mở /admin/users/<id>?tab=security và F5", "Mở /admin/communities/review?id=creator-academy và F5", "Mở /admin/users?sort=reports"], "-", "Sau F5 vẫn ở đúng tab/mục chọn; sort=reports áp dụng sẵn ở bộ lọc 'Sắp xếp'.")
    A(F, "Token hết hạn khi đang dùng admin: tự refresh hoặc chuyển về đăng nhập", "Bảo mật", "Trung bình", BASE_UI,
      ["Đang ở /admin, xóa access token (hoặc chờ 15 phút)", "Bấm một bộ lọc để gọi API"], "-", "Hệ thống refresh token tự động và tiếp tục; nếu refresh thất bại thì chuyển /login; không treo loading vô hạn.", pw="Một phần")
    A(F, "Gỡ quyền Platform Admin (bỏ email khỏi PLATFORM_ADMIN_EMAILS) mất truy cập ngay", "Bảo mật", "Trung bình", BASE_API + " Cần sửa env backend và restart.",
      ["Bỏ admin@sofinhub.test khỏi PLATFORM_ADMIN_EMAILS, khởi động lại BE", "Gọi GET /api/admin/me bằng token cũ", "Khôi phục env"], "-", "403 FORBIDDEN (quyền kiểm theo email mỗi request); UI /admin hiện 'Bạn không có quyền truy cập khu vực quản trị.'.", pw="Không")

    # ============================================================ 18. ĐIỂM CHƯA LÀM / CHƯA CHỐT (KẾ HOẠCH)
    F = "Điểm chưa làm / chưa chốt"
    A(F, "Cộng đồng do người dùng tạo mới phải chờ duyệt (pending_review)", "Chức năng", "Cao", "Chính sách chưa chốt (PLAN câu hỏi #7). Hiện BE tạo cộng đồng mới ở trạng thái active ngay.",
      ["Đăng nhập newbie@sofinhub.test, tạo cộng đồng mới (POST /api/communities)", "Admin mở /admin/communities/review", "Tìm cộng đồng mới ở trang chủ / GET /api/communities"], "-",
      "KỲ VỌNG SAU KHI CHỐT: cộng đồng mới ở trạng thái pending_review, xuất hiện ở hàng đợi xét duyệt, chưa hiện ở danh sách công khai (GET /api/communities) cho tới khi admin duyệt. HIỆN TẠI: active ngay (muốn bật chỉ cần đặt moderationStatus='pending_review' ở communitiesService.create).", pw="Không", st=PLAN)
    A(F, "Suspend/xóa cộng đồng tự hủy hoặc đóng băng gói đăng ký và hoàn tiền theo chính sách", "Chức năng", "Cao", "Chưa chốt chính sách tiền khi cộng đồng bị đình chỉ/xóa.",
      ["Tạm ngưng paid-demo", "Kiểm tra Subscription, scheduler thu phí kỳ tiếp theo"], "paid-demo", "KỲ VỌNG SAU KHI CHỐT: dừng thu phí/hủy gói/hoàn tiền theo quy định. HIỆN TẠI: gói vẫn active.", pw="Không", st=PLAN)
    A(F, "Phân quyền admin chi tiết: vai trò Moderator / Finance / Support", "Bảo mật", "Cao", "Hiện mọi Platform Admin (email trong PLATFORM_ADMIN_EMAILS) có quyền như nhau; 'Tài khoản quản trị', 'Vai trò & Quyền' đang là trang 'Sắp có'.",
      ["Tạo tài khoản Moderator chỉ được xử lý vụ việc", "Thử truy cập hoàn tiền/chi trả"], "-", "KỲ VỌNG SAU KHI LÀM: Moderator không vào được Thanh toán; Finance không ban người dùng; mỗi thao tác ghi audit theo vai trò.", pw="Không", st=PLAN)
    A(F, "Platform Admin bắt buộc xác thực email/2FA", "Bảo mật", "Cao", "Rủi ro đã ghi nhận: chỉ so email trong PLATFORM_ADMIN_EMAILS, chưa bắt emailVerified; chưa có 2FA.",
      ["Đăng ký tài khoản mới bằng email nằm trong PLATFORM_ADMIN_EMAILS nhưng chưa xác thực email", "Gọi GET /api/admin/me"], "-", "KỲ VỌNG SAU KHI LÀM: 403 cho tới khi xác thực email (và 2FA). HIỆN TẠI: được vào.", pw="Không", st=PLAN)
    A(F, "Tổng quan: chip 'Hôm nay', khoảng tùy chọn và 'So sánh kỳ trước'", "Chức năng", "Thấp", "Thiếu ở BE (range=1, from/to, compare) - frontend/ADMIN_BACKEND_GAPS.md.",
      ["Mở /admin", "Tìm chip 'Hôm nay'/'Tùy chọn' và nút so sánh kỳ trước"], "-", "KỲ VỌNG SAU KHI LÀM: có chip và đường nét đứt kỳ trước. HIỆN TẠI: chỉ có chip 7/30/90 ngày, không có nút so sánh.", pw="Không", st=PLAN)
    A(F, "Xuất dữ liệu CSV (Tổng quan, Cộng đồng, Người dùng)", "Chức năng", "Thấp", "Thiếu ở BE (export CSV).", ["Tìm nút 'Xuất dữ liệu' ở 3 trang"], "-", "KỲ VỌNG SAU KHI LÀM: tải được CSV đúng bộ lọc. HIỆN TẠI: nút bị ẩn.", pw="Không", st=PLAN)
    A(F, "Thao tác hàng loạt (bulk approve/suspend/resolve) ở Cộng đồng, Người dùng, Kiểm duyệt", "Chức năng", "Trung bình", "Thiếu ở BE.", ["Tìm checkbox chọn nhiều và thanh bulk"], "-", "KỲ VỌNG SAU KHI LÀM: chọn nhiều dòng và áp dụng một hành động, mỗi dòng 1 audit. HIỆN TẠI: ẩn.", pw="Không", st=PLAN)
    A(F, "Tạo cộng đồng hộ chủ sở hữu từ admin", "Chức năng", "Thấp", "Thiếu POST /admin/communities.", ["Tìm nút 'Tạo cộng đồng' ở /admin/communities"], "-", "KỲ VỌNG SAU KHI LÀM: tạo cộng đồng theo email chủ. HIỆN TẠI: nút bị ẩn.", pw="Không", st=PLAN)
    A(F, "Chi tiết cộng đồng: tab Khóa học/Sự kiện/Bảng xếp hạng, danh sách bài viết kèm Hide/Remove/Restore, sửa thông tin", "Chức năng", "Trung bình", "Thiếu ở BE.", ["Mở /admin/communities/photo, đếm tab và tìm hành động sửa/ẩn bài"], "-", "KỲ VỌNG SAU KHI LÀM: đủ các tab và hành động. HIỆN TẠI: chỉ 6 tab; 'Bài viết & Bình luận' chỉ có số liệu; Cài đặt chỉ đọc.", pw="Không", st=PLAN)
    A(F, "Người dùng: quốc gia, điện thoại, đổi vai trò, 2FA, lọc quốc gia/ngày đăng ký/hoạt động gần nhất, bulk suspend", "Chức năng", "Thấp", "Thiếu ở BE.", ["Xem cột và bộ lọc của /admin/users"], "-", "KỲ VỌNG SAU KHI LÀM: có các cột/bộ lọc đó. HIỆN TẠI: ẩn; chỉ có Trạng thái, Vai trò, Gói, Sắp xếp.", pw="Không", st=PLAN)
    A(F, "Vụ việc: đính kèm tệp bằng chứng, trang 'Review Content'/'Review User', hoàn tác (Revoke warning/Unban/Undo removal)", "Chức năng", "Trung bình", "Thiếu ở BE.", ["Mở chi tiết vụ việc, tìm khối 'Bằng chứng' tệp đính kèm và nút hoàn tác"], "-", "KỲ VỌNG SAU KHI LÀM: đính kèm/hoàn tác được và ghi audit. HIỆN TẠI: 'Báo cáo liên quan' + 'Vụ việc tương tự' thay cho bằng chứng; gỡ cấm làm ở Người dùng > Khôi phục.", pw="Không", st=PLAN)
    A(F, "Nhật ký: lọc theo quản trị viên/lý do trên giao diện", "Chức năng", "Thấp", "Thiếu ở FE (API đã có actor).", ["Mở /admin/system/audit, tìm bộ lọc quản trị viên/lý do"], "-", "KỲ VỌNG SAU KHI LÀM: lọc theo actor và reason trên UI. HIỆN TẠI: chỉ lọc theo loại hành động + tìm kiếm.", pw="Không", st=PLAN)
    A(F, "Lưu checklist xét duyệt thủ công (Chất lượng nội dung, Tuân thủ chính sách) cùng quyết định", "Chức năng", "Thấp", "Chưa có ở BE.", ["Tích 2 mục, duyệt cộng đồng, xem lại lịch sử"], "-", "KỲ VỌNG SAU KHI LÀM: checklist lưu cùng quyết định. HIỆN TẠI: chỉ ở trình duyệt, không lưu.", pw="Không", st=PLAN)
    A(F, "Gộp báo cáo trùng thành 'case' thật (bảng riêng)", "Chức năng", "Thấp", "Hiện chỉ gộp ở mức hiển thị.", ["Tạo 10 báo cáo cùng một bài"], "-", "KỲ VỌNG SAU KHI LÀM: một case duy nhất đại diện. HIỆN TẠI: nhiều dòng Report, hàng đợi ẩn bản trùng.", pw="Không", st=PLAN)
    A(F, "Các nhóm Nội dung / Thanh toán (Giao dịch, Gói, Tranh chấp, Doanh thu creator) / Khám phá / Phân tích / Hỗ trợ / Hệ thống đầy đủ", "Chức năng", "Thấp", "Đợt sau; hiện là trang 'Sắp có'.", ["Mở từng mục chưa làm trong sidebar"], "-", "KỲ VỌNG SAU KHI LÀM: màn thật theo từng mục. HIỆN TẠI: trang 'Sắp có' (đã có case kiểm tra ở nhóm Khung admin).", pw="Không", st=PLAN)
