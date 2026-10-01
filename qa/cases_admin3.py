# -*- coding: utf-8 -*-
"""Testcase module ADM3 (Admin Console - đợt 3, 2026-10-03): Phân tích · Hỗ trợ · Hệ thống + vai trò/quyền nhân viên + API công khai (feature-flags, bảo trì, ticket người dùng, form liên hệ).
Nguồn sự thật: backend/docs/api/admin-batch3.md (hợp đồng cuối + "Khác biệt" + "Chưa làm" + ghi chú tính toán Analytics), backend/docs/API.md (mục "Quyền nhân viên admin"),
docs/features/admin-batch3.md, frontend/ADMIN_BACKEND_GAPS.md (mục Admin đợt 3), backend/src/modules/admin/{admin-staff.permissions,admin-staff.service,admin-analytics.service,
admin-support.service,admin-system.service,admin-system-access.service,admin-audit.service,admin-b3.routes}.ts, backend/src/modules/{support,settings,platform,mail}/*,
backend/tests/admin-batch3.test.ts, backend/prisma/seed/admin-batch3.ts, frontend/src/features/admin/{nav.ts,components/AdminLayout.tsx,pages/{Analytics,Support,SystemAccess,SystemConfig}Views.tsx,
pages/{EmailTemplatesView,AuditView}.tsx}.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-ADM3-nnn không đổi). Nhiều case MA TRẬN QUYỀN được SINH bằng vòng lặp từ bảng PERMS/ROUTES dưới đây
(đổi ma trận ở admin-staff.permissions.ts thì sửa PERMS rồi sinh lại, đừng sửa tay từng case).

Cách tìm bản ghi seed đợt 3: ticket hiển thị mã T-<2000 + số tự tăng>; seed tạo 22 ticket theo thứ tự nên trên DB SẠCH mã là T-2001..T-2022 (theo thứ tự trong bảng SEED_TICKET);
sau khi có ticket khác (form liên hệ, ticket test) mã MỚI tiếp nối. Thời gian của ticket/audit seed tính lùi từ lúc nạp seed nên 'Mới hôm nay', 'hôm nay', '9 ngày trước' đổi theo ngày chạy -> đối chiếu bằng SQL/API."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
PENDING_DECISION = "[PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]"
NOW_ADJUSTABLE = "(giá trị tạm, nay chỉnh được ở Admin > Hệ thống > Cài đặt chung và reset về env)"

SEED_STAFF = ("Nhân viên seed (seed/admin-batch3.ts, mật khẩu Passw0rd!x): moderator@sofinhub.test (Moderator Test, vai trò Moderator, 2FA bật), support@ (Ryan Cho, Support, 2FA bật), "
              "finance@ (Grace Lee, Finance, 2FA bật), tom@ (Tom Baker, Support, KHÔNG 2FA, đăng nhập lần cuối ~30 giờ trước), nina@ (Nina Ross, Moderator, ĐANG TẠM KHÓA, lý do 'Nghỉ việc, chờ thu hồi'), "
              "john.carter@ và mia.lopez@ (vai trò Moderator, 2FA bật). admin@sofinhub.test = Super Admin do biến môi trường PLATFORM_ADMIN_EMAILS (nguồn 'env', luôn bị khóa sửa). "
              "Vai trò hệ thống: Super Admin, Moderator, Support, Finance + vai trò tùy chỉnh mẫu 'Content Reviewer' (key content_reviewer: dashboard.view, users.view, content.manage; chưa gán cho ai). "
              "Tổng ở Tài khoản quản trị: 8 dòng (1 env + 7 nhân viên).")
SEED_TICKET = ("Ticket seed (22 ticket, người gửi là người dùng seed đợt 1; mã T-2001..T-2022 theo thứ tự tạo trên DB sạch): "
               "NGƯỜI DÙNG: T-2001 'Cannot log in after password reset' (sarah, Đang mở, Cao, Ryan Cho, nguồn contact_form), T-2002 'Verification email not received' (alex, Mới, Trung bình, chưa giao), "
               "T-2003 'Want to change account email' (daniel, Chờ phản hồi, Thấp, Tom Baker), T-2004 'Account locked by mistake' (maya, Đang mở, Khẩn cấp, Ryan Cho, ĐÃ CHUYỂN CẤP), T-2005 'Cannot upload my avatar' (liam, Đã xử lý, Thấp, Tom), "
               "T-2006 'Delete my account and data' (ethan, Mới, Trung bình, chưa giao), T-2007 'Notifications keep repeating' (noah, Đã đóng, Thấp, Ryan), T-2021 'Two-factor code not working' (ava, Chờ phản hồi, Trung bình, Tom). "
               "CREATOR: T-2008 'Video upload stuck at 99%' (emma, Đang mở, Cao, Ryan), T-2009 'How to change community URL' (sarah, Chờ phản hồi, Thấp, Tom), T-2010 'Members cannot see my course' (alex, Đang mở, Cao, chưa giao), "
               "T-2011 'Question about platform fees' (liam, Đã xử lý, Trung bình, Ryan), T-2012 'Request a featured spot in Discovery' (olivia, Mới, Thấp, chưa giao), T-2013 'Event reminders are not sent' (noah, Đang mở, Trung bình, Tom), "
               "T-2022 'Bulk invite members by CSV' (emma, Đã xử lý, Thấp, Ryan). THANH TOÁN: T-2014 'Charged twice this month' (sarah, Đang mở, Khẩn cấp, Ryan, ĐÃ CHUYỂN CẤP), T-2015 'Card declined at checkout' (daniel, Mới, Cao, chưa giao), "
               "T-2016 'Payout has not arrived' (emma, Chờ phản hồi, Cao, Ryan), T-2017 'Need an invoice for my company' (liam, Đã xử lý, Trung bình, Tom), T-2018 'Refund for accidental purchase' (alex, Đang mở, Trung bình, chưa giao), "
               "T-2019 'Trial converted without warning' (maya, Đã đóng, Trung bình, Ryan), T-2020 'Wrong currency on receipt' (ava, Mới, Thấp, chưa giao). "
               "Tổng: Mới 5, Đang mở 7, Chờ phản hồi 4, Đã xử lý 4, Đã đóng 2; 'Đang mở' (mới+mở+chờ) = 16 (người dùng 6, creator 5, thanh toán 5); chưa giao (trong 16) = 7; chuyển cấp = 2; "
               "ưu tiên Thấp 7 / Trung bình 8 / Cao 5 / Khẩn cấp 2. Ryan Cho phụ trách 9, Tom Baker 6. Ticket có phản hồi nhân viên (T-2001, T-2003, T-2004...) còn có ghi chú nội bộ 'Checked the account logs: nothing abnormal on our side.' ở các chỉ số chia hết cho 3 (T-2001, T-2004, T-2007...).")
SEED_FLAG = ("Feature flag seed (6): dm_v2 'Direct messages v2' (Thử nghiệm, BẬT, rollout 50%), premium_lock 'Premium course locks' (Đang chạy, BẬT, 100%), ai_moderation 'AI moderation' (Đang chạy, BẬT, 100%), "
             "app_banner 'Mobile app banner' (Thử nghiệm, TẮT, 100%), native_live 'Native livestream' (Bản nháp, TẮT, 0%), leaderboard_v2 'Leaderboard v2' (Đang chạy, BẬT, 100%). "
             "GET /api/feature-flags khi chưa đăng nhập: premium_lock, ai_moderation, leaderboard_v2 = true; dm_v2 = false (khách chỉ nhận cờ 100%); app_banner, native_live = false.")
SEED_INTEG = ("Tích hợp seed (8): ĐÃ KẾT NỐI: Stripe (Thanh toán, khóa ••••9f2a), PayPal (••••77c1), MoMo (••••0b3d), Zoom (Video, ••••e5aa), Mailgun (Email, ••••41d8), Cloudflare (CDN, ••••b290); "
              "CHƯA KẾT NỐI: Google Analytics (Phân tích), Slack (Chat). Khóa thật không được lưu, chỉ mask 4 ký tự cuối.")
SEED_TPL = ("Mẫu email seed (7, đều isSystem=true): welcome 'Welcome member' (Đang dùng; biến name, community), verify_email 'Verify email' (Đang dùng; name, link), reset_password 'Reset password' (Đang dùng; name, link), "
            "receipt 'Payment receipt' (Đang dùng; name, id, amount), warning 'Violation warning' (Đang dùng; name, reason), payout_sent 'Payout sent' (Đang dùng; name, amount), suspended 'Account suspended' (BẢN NHÁP; name, reason). Đủ tiếng Anh + tiếng Việt.")
SEED_BC = ("Lịch sử thông báo seed (2): 'Bảo trì hệ thống đêm Chủ nhật' (đối tượng Mọi người dùng, 2.480 người nhận, 0 email, ~9 ngày trước) và 'Chính sách phí mới cho Creator' (Creator, 12 người nhận, ~3 ngày trước), người gửi 'Platform Admin'. "
           "Đây chỉ là dòng lịch sử, KHÔNG tạo thông báo thật cho người dùng.")
SEED_AUD3 = ("Nhật ký audit seed của nhân viên (6, có IP): Ryan Cho support.ticket.reply (113.161.24.10), Ryan Cho support.ticket.escalate (lý do 'Needs review by the trust team', 113.161.24.10), Grace Lee refund.approve (113.161.24.55), "
             "Moderator Test content.hide (lý do Spam, 113.161.30.2), Tom Baker support.ticket.resolve (14.232.8.77), Moderator Test user.warn (lý do 'Repeated spam', 113.161.30.2).")
SEED_ANALYTICS = ("Dữ liệu Phân tích: seed rải lại ngày đăng ký của thành viên demo (isDemo) trong ~150 ngày và thêm phiên 'quay lại' ở giữa tuần 1/2/4/8/12 sau đăng ký (tỉ lệ ~62/48/38/30/24%) để cohort có hình dạng. "
                  "Mọi con số là của DB sạch tại thời điểm chạy và đổi theo ngày -> đối chiếu bằng SQL/API cùng range, KHÔNG so với số cố định.")
LOGIN_SA = "Đăng nhập admin@sofinhub.test / Passw0rd!x (Super Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
TOKEN_SA = "Lấy accessToken bằng POST /api/auth/login {\"email\":\"admin@sofinhub.test\",\"password\":\"Passw0rd!x\"}, gửi header Authorization: Bearer <token>."
MUTATE = "Case làm thay đổi dữ liệu seed (MUTATE) - khôi phục bằng npm run db:reset (db:seed là idempotent chỉ-tạo nên KHÔNG hoàn tác thao tác admin); hoặc chạy trên bản ghi do chính case tạo ra."
BASE3 = "DB sạch sau npm run db:reset (có seed/admin-batch3.ts, chạy sau seed admin đợt 1-2; mật khẩu mọi tài khoản seed Passw0rd!x; xem sheet 'Tài khoản & dữ liệu test' mục A5-A6)."
BASE_UI = BASE3 + " " + LOGIN_SA + " Frontend :5173, backend :4000."
BASE_API = BASE3 + " " + TOKEN_SA

# ---------------------------------------------------------------- ma trận quyền (khớp admin-staff.permissions.ts)
ALL_PERMS = ["dashboard.view", "community.manage", "content.manage", "report.resolve", "user.ban", "users.view", "payment.view", "payment.refund", "payment.manage",
             "payout.approve", "analytics.view", "support.manage", "audit.view", "system.flags", "system.settings", "admin.manage"]
PERMS = {
    "super_admin": list(ALL_PERMS),
    "moderator": ["dashboard.view", "community.manage", "report.resolve", "user.ban", "users.view", "content.manage", "analytics.view"],
    "support": ["dashboard.view", "report.resolve", "payment.refund", "users.view", "payment.view", "support.manage"],
    "finance": ["dashboard.view", "payment.refund", "payout.approve", "payment.view", "payment.manage", "analytics.view"],
    "content_reviewer": ["dashboard.view", "users.view", "content.manage"],
}
ROLE_NAME = {"super_admin": "Super Admin", "moderator": "Moderator", "support": "Support", "finance": "Finance", "content_reviewer": "Content Reviewer"}
ROLE_ACCOUNT = {"super_admin": "admin@sofinhub.test", "moderator": "moderator@sofinhub.test", "support": "support@sofinhub.test", "finance": "finance@sofinhub.test",
                "content_reviewer": "tài khoản được gán vai trò Content Reviewer (xem tiền điều kiện)"}
ROLE_UI_LABEL = {"super_admin": "Super Admin", "moderator": "Kiểm duyệt viên", "support": "Hỗ trợ", "finance": "Tài chính", "content_reviewer": "Content Reviewer"}

# (nhãn, method, đường dẫn sau /api, quyền cần). perm None = chỉ cần là nhân viên; 'super' = chỉ Super Admin (route không có trong bảng luật).
ROUTES_B1 = [
    ("Hồ sơ nhân viên", "GET", "/admin/me", None),
    ("Dashboard", "GET", "/admin/dashboard", "dashboard.view"),
    ("Danh sách cộng đồng", "GET", "/admin/communities", "community.manage"),
    ("Duyệt cộng đồng", "POST", "/admin/communities/khong-ton-tai/approve", "community.manage"),
    ("Danh sách người dùng", "GET", "/admin/users", "users.view"),
    ("Cảnh cáo người dùng", "POST", "/admin/users/khong-ton-tai/warn", "user.ban"),
    ("Hàng đợi kiểm duyệt", "GET", "/admin/moderation/cases", "report.resolve"),
    ("Xử lý vụ việc (bỏ qua)", "POST", "/admin/moderation/cases/khong-ton-tai/dismiss", "report.resolve"),
    ("Nhật ký audit", "GET", "/admin/audit-logs", "audit.view"),
]
ROUTES_B2 = [
    ("Bài viết (xem)", "GET", "/admin/content/posts", "content.manage"),
    ("Ẩn bài viết", "POST", "/admin/content/posts/khong-ton-tai/hide", "content.manage"),
    ("Giao dịch (xem)", "GET", "/admin/payments/transactions", "payment.view"),
    ("Gói đăng ký (xem)", "GET", "/admin/payments/subscriptions", "payment.view"),
    ("Doanh thu creator (xem)", "GET", "/admin/payments/creators", "payment.view"),
    ("Chi trả (xem)", "GET", "/admin/payments/payouts", "payment.view"),
    ("Duyệt hoàn tiền", "POST", "/admin/payments/refunds/khong-ton-tai/approve", "payment.refund"),
    ("Hoàn tiền trực tiếp giao dịch", "POST", "/admin/payments/transactions/khong-ton-tai/refund", "payment.refund"),
    ("Thử lại thanh toán", "POST", "/admin/payments/transactions/khong-ton-tai/retry", "payment.manage"),
    ("Tạm dừng gói đăng ký", "POST", "/admin/payments/subscriptions/khong-ton-tai/pause", "payment.manage"),
    ("Tạo tranh chấp (mô phỏng)", "POST", "/admin/payments/chargebacks", "payment.manage"),
    ("Giữ chi trả", "POST", "/admin/payments/payouts/khong-ton-tai/hold", "payout.approve"),
    ("Cộng đồng hiển thị (Khám phá)", "GET", "/admin/discovery/communities", "community.manage"),
    ("Xếp hạng (Khám phá)", "GET", "/admin/discovery/rankings", "community.manage"),
    ("Route cũ: danh sách hoàn tiền", "GET", "/admin/refunds", "payment.view"),
    ("Route cũ: duyệt/từ chối hoàn tiền", "PATCH", "/admin/refunds/khong-ton-tai", "payment.refund"),
    ("Route cũ: danh sách rút tiền", "GET", "/admin/payouts", "payment.view"),
    ("Route cũ: duyệt rút tiền", "PATCH", "/admin/payouts/khong-ton-tai", "payout.approve"),
]
ROUTES_B3 = [
    ("Phân tích: Người dùng", "GET", "/admin/analytics/users", "analytics.view"),
    ("Phân tích: Doanh thu", "GET", "/admin/analytics/revenue", "analytics.view"),
    ("Hỗ trợ: danh sách ticket", "GET", "/admin/support/tickets", "support.manage"),
    ("Hỗ trợ: trả lời ticket", "POST", "/admin/support/tickets/khong-ton-tai/reply", "support.manage"),
    ("Hệ thống: danh mục", "GET", "/admin/system/categories", "community.manage"),
    ("Hệ thống: feature flags", "GET", "/admin/system/flags", "system.flags"),
    ("Hệ thống: tài khoản quản trị", "GET", "/admin/system/admins", "admin.manage"),
    ("Hệ thống: vai trò & quyền", "GET", "/admin/system/roles", "admin.manage"),
    ("Hệ thống: tích hợp", "GET", "/admin/system/integrations", "system.settings"),
    ("Hệ thống: thông báo (cấu hình)", "GET", "/admin/system/notifications/settings", "system.settings"),
    ("Hệ thống: mẫu email", "GET", "/admin/system/email-templates", "system.settings"),
    ("Hệ thống: cài đặt chung", "GET", "/admin/system/settings", "system.settings"),
    ("Hệ thống: xuất CSV nhật ký", "GET", "/admin/audit-logs/export", "audit.view"),
    ("Route lạ (không có trong bảng luật)", "GET", "/admin/system/khong-co-route", "super"),
]
# Sidebar: (nhóm, quyền nhóm, [(mục con, quyền riêng hoặc None)]) - khớp frontend/src/features/admin/nav.ts
NAV = [
    ("Tổng quan", "dashboard.view", []),
    ("Cộng đồng", "community.manage", ["Danh sách cộng đồng", "Xét duyệt", "Tạm ngưng", "Xóa / Khôi phục"]),
    ("Người dùng", "users.view", ["Tất cả người dùng", "Hạn chế / Tạm ngưng", "Cấm"]),
    ("Nội dung", "content.manage", ["Bài viết", "Bình luận", "Khóa học", "Bài học", "Sự kiện", "Media"]),
    ("Kiểm duyệt", "report.resolve", ["Hàng đợi báo cáo", "Cảnh cáo", "Gỡ nội dung", "Tạm ngưng", "Cấm"]),
    ("Thanh toán", "payment.view", ["Giao dịch", "Gói đăng ký", "Hoàn tiền", "Tranh chấp thanh toán", "Doanh thu creator", "Chi trả"]),
    ("Khám phá", "community.manage", ["Cộng đồng hiển thị", "Danh mục", "Nổi bật", "Xếp hạng", "Hiển thị tìm kiếm"]),
    ("Phân tích", "analytics.view", ["Người dùng", "Cộng đồng", "Tương tác", "Giữ chân", "Doanh thu", "Chuyển đổi"]),
    ("Hỗ trợ", "support.manage", ["Ticket hỗ trợ", "Vấn đề người dùng", "Vấn đề creator", "Vấn đề thanh toán"]),
    ("Hệ thống", None, [("Tài khoản quản trị", "admin.manage"), ("Vai trò & Quyền", "admin.manage"), ("Danh mục", "community.manage"), ("Tính năng thử nghiệm", "system.flags"),
                        ("Tích hợp", "system.settings"), ("Thông báo", "system.settings"), ("Mẫu email", "system.settings"), ("Nhật ký hoạt động", "audit.view"), ("Cài đặt chung", "system.settings")]),
]


def can(role, perm):
    if perm is None:
        return True
    if perm == "super":
        return role == "super_admin"
    return perm in PERMS[role]


def sidebar_for(role):
    """Trả (mô tả nhóm hiển thị, mô tả nhóm bị ẩn) theo logic visibleNav của nav.ts."""
    shown, hidden = [], []
    for g, perm, kids in NAV:
        if g == "Hệ thống":
            ks = [k for k, p in kids if can(role, p)]
            if ks:
                shown.append(f"Hệ thống ({', '.join(ks)})")
            else:
                hidden.append("Hệ thống")
            continue
        (shown if can(role, perm) else hidden).append(g)
    return shown, hidden


def verdict(role, method, perm):
    """Kỳ vọng HTTP của 1 route với 1 vai trò (token của nhân viên đang hoạt động)."""
    if can(role, perm):
        if perm == "super":
            return "qua guard (route không tồn tại -> 404 NOT_FOUND, KHÔNG 403)"
        return "200" if method == "GET" else "qua guard (id/body giả -> 404/400, KHÔNG 403)"
    if perm == "super":
        return "403 FORBIDDEN 'Chỉ Super Admin mới có quyền này'"
    return f"403 FORBIDDEN 'Vai trò {ROLE_NAME[role]} không có quyền \"{perm}\"'"


def load(add):
    M, MN = "ADM3", "Admin Console (đợt 3: Phân tích, Hỗ trợ, Hệ thống)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    UI = BASE_UI
    API = BASE_API
    UIM = BASE_UI + " " + MUTATE
    APIM = BASE_API + " " + MUTATE

    def login_of(email):
        return f"Đăng nhập {email} / {PW}."

    # ============================================================ 1. KHUNG ADMIN THEO QUYỀN (UI)
    F = "Khung admin theo quyền (UI)"
    for role in ("super_admin", "moderator", "support", "finance", "content_reviewer"):
        shown, hidden = sidebar_for(role)
        acct = ROLE_ACCOUNT[role]
        pre = BASE3 + " " + (login_of(acct) if "@" in acct and role != "content_reviewer" else
                             "Đăng nhập Super Admin, ở Hệ thống > Tài khoản quản trị bấm 'Tạo quản trị viên' với email member1@sofinhub.test, vai trò Content Reviewer, rồi đăng nhập member1@sofinhub.test / " + PW + ". " + MUTATE)
        A(F, f"Sidebar của vai trò {ROLE_NAME[role]} chỉ hiện đúng các nhóm có quyền", "Giao diện", "Cao", pre,
          ["Mở http://localhost:5173/admin", "Đọc các nhóm trên sidebar và các mục con của nhóm 'Hệ thống' (nếu có)", "Kiểm tra góc phải Topbar (tên vai trò) và so với ma trận ở sheet 'Phân quyền'"], ROLE_ACCOUNT[role],
          f"Hiện: {'; '.join(shown)}. ẨN hoàn toàn: {', '.join(hidden) if hidden else '(không nhóm nào)'}. Nhóm không còn mục con truy cập được thì ẩn cả nhóm. Topbar ghi vai trò '{ROLE_UI_LABEL[role]}'.")
    for role in ("moderator", "support", "finance", "content_reviewer"):
        shown, hidden = sidebar_for(role)
        acct = ROLE_ACCOUNT[role]
        pre = BASE3 + " " + (login_of(acct) if role != "content_reviewer" else "Đăng nhập tài khoản đã gán vai trò Content Reviewer (xem case Sidebar Content Reviewer). " + MUTATE)
        blocked = [(g, p) for g, p, kids in NAV if g != "Hệ thống" and not can(role, p)]
        g, p = blocked[0]
        path = {"Cộng đồng": "/admin/communities", "Nội dung": "/admin/content/posts", "Thanh toán": "/admin/payments/tx", "Khám phá": "/admin/discovery/listed",
                "Phân tích": "/admin/analytics/users", "Hỗ trợ": "/admin/support/tickets", "Kiểm duyệt": "/admin/moderation", "Người dùng": "/admin/users"}.get(g, "/admin/system/admins")
        A(F, f"{ROLE_NAME[role]} gõ thẳng URL trang không có quyền hiển thị 'Không đủ quyền' trong khung admin", "Bảo mật", "Cao", pre,
          [f"Gõ thẳng http://localhost:5173{path} (nhóm '{g}', cần quyền {p})", "Đọc nội dung trang", "Bấm 'Về tổng quan'", "Gõ thẳng http://localhost:5173/admin/system/admins"], path,
          f"Khung admin (sidebar + topbar) vẫn hiện; vùng nội dung có biểu tượng khóa, tiêu đề 'Không đủ quyền', mô tả 'Vai trò {ROLE_UI_LABEL[role]} của bạn chưa được cấp quyền truy cập mục này. Liên hệ Super Admin nếu bạn cần thêm quyền.'; "
          "KHÔNG có yêu cầu API dữ liệu nào của trang đó được gửi (hoặc nếu gửi thì 403, không lộ dữ liệu); 'Về tổng quan' quay /admin; /admin/system/admins cũng 'Không đủ quyền' vì cần admin.manage.", pw="Có")
    A(F, "Thao tác nhanh và ô tìm kiếm chung ở Tổng quan chỉ hiện mục mà vai trò có quyền", "Giao diện", "Trung bình", BASE3 + " " + login_of("finance@sofinhub.test"),
      ["Mở /admin", "Xem khối 'Thao tác nhanh'", "Gõ từ khóa vào ô tìm kiếm chung trên Topbar (vd 'sarah')", "Mở Network, đối chiếu các yêu cầu /api/admin/* được gửi"], "finance@sofinhub.test",
      "Chỉ hiện lối tắt thuộc nhóm có quyền (Thanh toán, Phân tích); tìm kiếm không gọi API cộng đồng/người dùng/kiểm duyệt (finance không có community.manage/users.view/report.resolve) nên không có 403 đỏ trong Network; không toast lỗi.", pw="Một phần")
    A(F, "Topbar hiển thị tên vai trò theo adminRole từ GET /admin/me", "Giao diện", "Thấp", BASE3 + " " + login_of("support@sofinhub.test"),
      ["Mở /admin", "Bấm vào khu vực tài khoản ở Topbar", "Mở Network xem GET /api/admin/me"], "support@sofinhub.test",
      "Topbar hiện tên 'Ryan Cho' kèm vai trò 'Hỗ trợ' (nhãn FE; BE trả tên 'Support'). /admin/me: role='platform_admin', adminRole={key:'support',name:'Support'}, permissions gồm support.manage và KHÔNG có system.flags, source='staff'.")
    A(F, "GET /admin/me: Super Admin env có đủ 16 khóa quyền và source=env", "Chức năng", "Cao", API,
      ["GET /api/admin/me bằng token admin@"], "admin@sofinhub.test",
      "200 {role:'platform_admin', adminRole:{key:'super_admin',name:'Super Admin'}, permissions gồm đủ 16 khóa (dashboard.view, community.manage, content.manage, report.resolve, user.ban, users.view, payment.view, payment.refund, payment.manage, payout.approve, analytics.view, support.manage, audit.view, system.flags, system.settings, admin.manage), source:'env'}.")
    for role in ("moderator", "support", "finance"):
        A(F, f"GET /admin/me của {ROLE_NAME[role]} trả đúng tập quyền theo ma trận", "Chức năng", "Cao", BASE3 + f" Lấy token bằng POST /api/auth/login của {ROLE_ACCOUNT[role]} / {PW}.",
          ["GET /api/admin/me"], ROLE_ACCOUNT[role],
          f"200 adminRole.key='{role}', source='staff', permissions = đúng {len(PERMS[role])} khóa: {', '.join(PERMS[role])}; role luôn là 'platform_admin' (tương thích FE cũ).")
    A(F, "Nhân viên bị tạm khóa (nina@) đăng nhập được vào trang web nhưng /admin trả 403 'đã bị tạm khóa'", "Bảo mật", "Cao", BASE3 + " " + SEED_STAFF,
      ["Đăng nhập nina@sofinhub.test / Passw0rd!x ở trang chủ", "Mở http://localhost:5173/admin", "GET /api/admin/me bằng token của nina@"], "nina@sofinhub.test",
      "Đăng nhập thường thành công (tạm khóa admin KHÔNG khóa tài khoản người dùng). GET /admin/me và mọi /admin/* trả 403 FORBIDDEN 'Tài khoản admin của bạn đã bị tạm khóa'; giao diện không hiện khung admin có dữ liệu (không có quyền, không gọi được).", pw="Một phần")
    A(F, "Người dùng thường (member1@) và chủ cộng đồng bị chặn khỏi /admin", "Bảo mật", "Cao", BASE3 + " " + login_of("member1@sofinhub.test"),
      ["Mở http://localhost:5173/admin", "Mở /admin/system/flags", "Lặp lại với owner@sofinhub.test và cadmin@sofinhub.test"], "member1 / owner / cadmin",
      "Guard chặn: GET /admin/me -> 403 FORBIDDEN 'Chỉ nhân viên admin mới có quyền này'; không thấy khung hay dữ liệu admin. Chủ/quản trị cộng đồng KHÁC nhân viên nền tảng.")
    A(F, "Khách chưa đăng nhập mở /admin/analytics/users bị chuyển về /login", "Bảo mật", "Cao", "Chưa đăng nhập (xóa localStorage/cookie).",
      ["Mở http://localhost:5173/admin/analytics/users"], "-", "Chuyển tới /login (hoặc yêu cầu đăng nhập); không thấy số liệu; GET /api/admin/analytics/users không token -> 401 UNAUTHORIZED.")
    A(F, "Không còn nhãn 'Sắp có': đường dẫn admin lạ quay về /admin", "Giao diện", "Thấp", UI,
      ["Gõ http://localhost:5173/admin/khong-co-trang", "Quan sát sidebar toàn bộ"], "/admin/khong-co-trang",
      "Chuyển về /admin (Tổng quan); sidebar không có mục nào ghi 'Sắp có'; mọi mục sidebar bấm được.")
    batch3_routes = [("/admin/analytics/users", "Phân tích · Người dùng"), ("/admin/analytics/communities", "Phân tích · Cộng đồng"), ("/admin/analytics/engagement", "Phân tích · Tương tác"),
                     ("/admin/analytics/retention", "Phân tích · Giữ chân"), ("/admin/analytics/revenue", "Phân tích · Doanh thu"), ("/admin/analytics/conversion", "Phân tích · Chuyển đổi"),
                     ("/admin/support/tickets", "Ticket hỗ trợ"), ("/admin/support/user", "Vấn đề người dùng"), ("/admin/support/creator", "Vấn đề creator"), ("/admin/support/payment", "Vấn đề thanh toán"),
                     ("/admin/system/admins", "Tài khoản quản trị"), ("/admin/system/roles", "Vai trò & Quyền"), ("/admin/system/categories", "Danh mục"), ("/admin/system/flags", "Tính năng thử nghiệm"),
                     ("/admin/system/integrations", "Tích hợp"), ("/admin/system/notifications", "Thông báo"), ("/admin/system/email", "Mẫu email"), ("/admin/system/audit", "Nhật ký hoạt động"),
                     ("/admin/system/settings", "Cài đặt chung")]
    for path, title in batch3_routes:
        A(F, f"Mở trực tiếp {path} hiển thị trang '{title}' (tải lazy, mục sidebar được tô sáng)", "Chức năng", "Cao", UI,
          [f"Gõ thẳng http://localhost:5173{path}", "Chờ trang tải (route admin tải lazy)", "Mở DevTools > Console"], path,
          f"Hiện khung admin với tiêu đề chứa '{title}', mục sidebar tương ứng được tô sáng, breadcrumb đúng; không màn trắng, không lỗi console; có trạng thái 'Đang tải…' rồi dữ liệu (hoặc 'Không có ... ' nếu rỗng).")

    # ============================================================ 2. MA TRẬN PHÂN QUYỀN (API) - SINH TỪ BẢNG
    F = "Ma trận phân quyền nhân viên (API)"
    pre_tok = lambda role: BASE3 + (f" Lấy token bằng POST /api/auth/login của {ROLE_ACCOUNT[role]} / {PW}." if role != "content_reviewer" else
                                   " Super Admin tạo nhân viên Content Reviewer (POST /admin/system/admins {email:'member1@sofinhub.test', roleKey:'content_reviewer'}) rồi lấy token member1@ / " + PW + ". " + MUTATE)
    for role in ("super_admin", "moderator", "support", "finance", "content_reviewer"):
        for bname, routes in (("đợt 1 (tổng quan, cộng đồng, người dùng, kiểm duyệt, nhật ký)", ROUTES_B1), ("đợt 2 (nội dung, thanh toán, khám phá, route cũ refunds/payouts)", ROUTES_B2),
                              ("đợt 3 (phân tích, hỗ trợ, hệ thống)", ROUTES_B3)):
            steps = [f"{m} /api{p}  (cần quyền: {perm if perm else 'chỉ cần là nhân viên'})" for _, m, p, perm in routes]
            exp_lines = [f"{m} {p} -> {verdict(role, m, perm)}" for _, m, p, perm in routes]
            allowed_n = sum(1 for _, m, p, perm in routes if can(role, perm))
            A(F, f"Vai trò {ROLE_NAME[role]} gọi các route {bname}: đúng route được phép (200) và 403 ngoài ra", "Bảo mật", "Cao", pre_tok(role),
              steps + ["Ghi mã trạng thái từng yêu cầu (POST gửi body {} và id giả 'khong-ton-tai')"], ROLE_ACCOUNT[role],
              f"{allowed_n}/{len(routes)} route qua guard; còn lại 403. Chi tiết: " + " | ".join(exp_lines) + ". Quyền kiểm tra TRƯỚC khi validate body/tìm bản ghi nên id giả vẫn ra 403 với route không được phép; không route nào trả 401 (token hợp lệ).")
    # từng route: ai được phép
    for label, m, p, perm in ROUTES_B1 + ROUTES_B2 + ROUTES_B3:
        who = [ROLE_NAME[r] for r in PERMS if can(r, perm)]
        no = [ROLE_NAME[r] for r in PERMS if not can(r, perm)]
        A(F, f"Route '{label}' ({m} {p}): chỉ {'/'.join(who)} qua guard", "Bảo mật", "Trung bình", API + " " + SEED_STAFF,
          [f"Gọi {m} /api{p} lần lượt bằng token admin@, moderator@, support@, finance@, member1@ (người dùng thường) và không token"], f"quyền cần: {perm if perm else 'nhân viên bất kỳ'}",
          f"Qua guard: {', '.join(who)}. 403: {', '.join(no) if no else '(không vai trò nào)'} và member1@ ('Chỉ nhân viên admin mới có quyền này'). Không token -> 401 UNAUTHORIZED.", pw="Có")
    A(F, "Nhân viên bị tạm khóa (nina@) bị 403 ở mọi route, kể cả /admin/me", "Bảo mật", "Cao", BASE3 + " " + SEED_STAFF + f" Lấy token POST /api/auth/login nina@sofinhub.test / {PW}.",
      ["GET /api/admin/me", "GET /api/admin/dashboard", "GET /api/admin/users", "GET /api/admin/moderation/cases"], "nina@sofinhub.test (Moderator, suspended)",
      "Cả 4 route trả 403 FORBIDDEN 'Tài khoản admin của bạn đã bị tạm khóa' dù vai trò Moderator vốn có các quyền đó; login thường vẫn 200.")
    A(F, "Người dùng thường và không token: 401 khi thiếu token, 403 khi không phải nhân viên ở 7 nhóm route", "Bảo mật", "Cao", BASE3 + f" Token member1@sofinhub.test.",
      ["Với từng path /admin/me, /admin/dashboard, /admin/analytics/users, /admin/support/tickets, /admin/system/flags, /admin/system/admins, /admin/users: gọi KHÔNG token", "Gọi lại với token member1@"], "member1@sofinhub.test",
      "Không token: 401 UNAUTHORIZED ở cả 7. Token member1@: 403 FORBIDDEN ở cả 7 (không 404/400/200).")
    A(F, "Mọi route /admin/* của đợt 3 (≈70 route) đều 401 khi thiếu token và 403 với member1@", "Bảo mật", "Cao", BASE3 + " Token member1@.",
      ["Với từng route: GET /admin/analytics/{users,communities,engagement,retention,revenue,conversion}; GET/POST /admin/support/{summary,assignees,tickets,tickets/x,tickets/x/assign|reply|note|escalate|resolve|close|reopen}; "
       "GET/POST/PATCH/DELETE /admin/system/{admins,roles,categories,flags,integrations,notifications/{settings,preview,broadcast,broadcasts},email-templates,settings,settings/reset}; GET /admin/audit-logs/{filters,export}",
       "Gọi không token, rồi với token member1@"], "member1@",
      "Không token -> 401; member1@ -> 403 FORBIDDEN, kể cả với id/key giả 'x' (quyền chạy trước validate/tìm bản ghi).")
    # đổi ma trận có hiệu lực ngay
    A(F, "Đổi ô ma trận có hiệu lực ngay: bật users.view cho Finance rồi tắt", "Chức năng", "Cao", APIM + " Token finance@ và admin@.",
      ["GET /admin/users bằng token finance@ -> ghi mã", "PATCH /admin/system/roles/finance {permission:'users.view', granted:true} bằng token admin@", "GET /admin/users bằng token finance@ (KHÔNG đăng nhập lại)", "PATCH {permission:'users.view', granted:false}", "GET /admin/users lần nữa"], "finance, users.view",
      "Lần 1: 403. Sau bật: PATCH 200 (role.permissions có users.view) và GET /admin/users bằng CÙNG token finance -> 200 (quyền đọc từ DB mỗi request, không cache token). Sau tắt: 403 lại.")
    A(F, "Gỡ quyền khỏi vai trò: nhân viên đang đăng nhập bị chặn ngay ở request kế tiếp", "Bảo mật", "Cao", UIM + " Hai trình duyệt: A = admin@, B = support@ đang mở /admin/support/tickets.",
      ["A: Hệ thống > Vai trò & Quyền, tắt ô 'Xử lý ticket hỗ trợ' của cột Hỗ trợ", "B: bấm sang trang 2 của bảng ticket (không tải lại trang)", "B: F5 trang", "A: bật lại ô"], "support, support.manage",
      "B: lần tải kế tiếp GET /admin/support/tickets -> 403 (toast/khối lỗi 'Vai trò Support không có quyền \"support.manage\"'); sau F5 sidebar mất nhóm 'Hỗ trợ' và /admin/support/tickets hiện 'Không đủ quyền'. Bật lại -> khôi phục.", pw="Một phần")
    A(F, "Nhân viên bị tạm khóa giữa chừng: token cũ bị chặn ở mọi /admin/* nhưng KHÔNG bị thu hồi phiên đăng nhập", "Bảo mật", "Cao", APIM + " " + SEED_STAFF + " Token tom@.",
      ["GET /admin/support/tickets bằng token tom@ -> 200", "Super Admin POST /admin/system/admins/<id tom>/suspend {reason:'QA'}", "GET /admin/support/tickets lại bằng CÙNG token tom@", "GET /api/auth/me (hoặc /api/me/subscriptions) bằng token tom@", "POST .../enable rồi gọi lại"], "tom@",
      "Sau suspend: /admin/* -> 403 'Tài khoản admin của bạn đã bị tạm khóa'; các API thường của tom@ VẪN 200 (suspend chỉ khóa quyền admin, không revoke Session/tokenVersion). Sau enable: /admin/* 200 lại với token cũ.")
    A(F, "Xóa quyền nhân viên (DELETE admins/:id): token cũ mất quyền /admin ngay, tài khoản người dùng còn nguyên", "Bảo mật", "Cao", APIM + " " + SEED_STAFF + " Token mia.lopez@.",
      ["GET /admin/dashboard bằng token mia.lopez@ -> 200", "Super Admin DELETE /admin/system/admins/<id mia>", "GET /admin/dashboard lại", "Đăng nhập thường mia.lopez@"], "mia.lopez@",
      "Sau DELETE: 403 FORBIDDEN 'Chỉ nhân viên admin mới có quyền này'; đăng nhập trang thường vẫn thành công; Tài khoản quản trị không còn dòng mia.")
    A(F, "Nhân viên không thể bị ban/suspend/restrict/reinstate qua /admin/users/*", "Bảo mật", "Cao", APIM + " " + SEED_STAFF + " Token moderator@ (có user.ban) và admin@.",
      ["Moderator: POST /admin/users/<id support@>/suspend {reason:'x',duration:'24h'}", "Moderator: POST /admin/users/<id finance@>/ban {reason:'x'}", "Moderator: POST /admin/users/<id tom@>/restrict {restrictions:['post'],reason:'x'}", "Super Admin: POST /admin/users/<id support@>/ban {reason:'x'}", "Super Admin: POST /admin/users/<id nina@>/warn {reason:'x',message:'y'}"], "support@, finance@, tom@, nina@",
      "Cả 5 -> 403 FORBIDDEN 'Không thể tác động lên tài khoản admin (quản lý ở System > Admin Accounts)' (nhân viên mọi vai trò, kể cả đang tạm khóa, được bảo vệ, kể cả với Super Admin; quản lý ở Hệ thống > Tài khoản quản trị). Người dùng thường vẫn ban được bình thường (đối chứng với maya@).")
    A(F, "Support xem được Người dùng nhưng không có nút/route ghi (user.ban): API trả 403, UI vẫn hiện nút", "Chức năng", "Cao", UIM + " " + login_of("support@sofinhub.test"),
      ["Mở /admin/users, mở menu thao tác một người dùng thường (vd sarah)", "Thử 'Cảnh cáo' hoặc 'Tạm ngưng'", "Đối chiếu Network"], "support@sofinhub.test",
      "HIỆN TẠI: FE chỉ ẩn nhóm/mục menu và chặn trang, KHÔNG ẩn nút theo quyền -> nút 'Cảnh cáo/Tạm ngưng' vẫn hiện; bấm -> POST trả 403 'Vai trò Support không có quyền \"user.ban\"' và toast lỗi; dữ liệu không đổi. (Quyền mức nút là khoảng trống đã biết - xem case Kế hoạch.)", pw="Một phần")
    A(F, "Finance xem Thanh toán nhưng không duyệt chi trả/không có payout.approve ở Support: nút vẫn hiện, API chặn", "Chức năng", "Trung bình", UIM + " " + login_of("support@sofinhub.test"),
      ["Mở /admin/payments/payouts", "Mở menu một chi trả (vd PO-60986918) và chọn 'Giữ'/'Duyệt'", "Đối chiếu Network"], "PO-60986918",
      "Support có payment.view nên xem được danh sách; thao tác POST /admin/payments/payouts/<id>/hold trả 403 'Vai trò Support không có quyền \"payout.approve\"'; toast lỗi, trạng thái không đổi. Finance làm được thao tác này.", pw="Một phần")
    A(F, "Route cũ /admin/refunds và /admin/payouts đi qua guard theo quyền: Moderator 403, Finance/Support qua (refunds)", "Bảo mật", "Cao", APIM + " Token moderator@, support@, finance@.",
      ["PATCH /admin/refunds/khong-ton-tai {action:'reject'} lần lượt bằng moderator@, support@, finance@", "PATCH /admin/payouts/khong-ton-tai {action:'reject'} bằng support@ và finance@", "GET /admin/refunds và GET /admin/payouts bằng moderator@ và support@"], "route cũ",
      "refunds PATCH: moderator 403 (thiếu payment.refund); support và finance qua guard (404 'Không tìm thấy' vì id giả). payouts PATCH: support 403 (thiếu payout.approve), finance qua guard. GET refunds/payouts: moderator 403 (thiếu payment.view), support 200.")
    A(F, "Support duyệt hoàn tiền thật (RF-AEB9A758) bằng route đợt 2: được vì có payment.refund", "Chức năng", "Trung bình", APIM + " Token support@ (Ryan Cho). Yêu cầu hoàn tiền đang chờ RF-AEB9A758 (Liam, pixel-pro, $99).",
      ["POST /admin/payments/refunds/<id RF-AEB9A758>/approve {} bằng token support@", "GET /admin/audit-logs?action=refund.approve bằng token admin@"], "RF-AEB9A758",
      "200 refund status approved/hoàn tất; audit refund.approve có actor 'Ryan Cho' kèm vai trò Support và IP của request. Moderator làm cùng thao tác bị 403.")
    A(F, "Moderator có analytics.view nhưng không có payment.view: xem /analytics/revenue được, /payments/transactions bị 403", "Bảo mật", "Trung bình", BASE3 + " Token moderator@.",
      ["GET /admin/analytics/revenue", "GET /admin/payments/transactions"], "moderator@",
      "Phân tích doanh thu 200 (quyền analytics.view); Giao dịch 403 'Vai trò Moderator không có quyền \"payment.view\"' - hai quyền tách nhau, số liệu gộp trong Phân tích không đồng nghĩa xem được chi tiết giao dịch.")
    A(F, "Quyền 'super' cho route không có trong bảng luật: chỉ Super Admin", "Bảo mật", "Thấp", API + " Token moderator@.",
      ["GET /admin/system/khong-co-route bằng admin@", "GET /admin/system/khong-co-route bằng moderator@ và finance@", "GET /admin/khac-hoan-toan bằng moderator@"], "route lạ",
      "admin@: qua guard -> 404 NOT_FOUND. moderator@/finance@: 403 'Chỉ Super Admin mới có quyền này' (an toàn-mặc-định: route mới quên khai báo quyền sẽ không lộ cho vai trò thấp).")
    A(F, "Super Admin là vai trò (không phải env) cũng bị chặn tự sửa/xóa/suspend chính mình", "Bảo mật", "Trung bình", APIM + " Tạo thêm một nhân viên vai trò super_admin (POST /admin/system/admins {email:'owner@sofinhub.test', roleKey:'super_admin'}); đăng nhập owner@.",
      ["Bằng token owner@: PATCH /admin/system/admins/<id owner> {roleKey:'finance'}", "POST .../suspend", "DELETE .../admins/<id owner>", "GET /admin/system/admins xem cờ locked của dòng chính mình"], "owner@ là super_admin",
      "Cả 3 thao tác -> 409 CONFLICT 'Bạn không thể tự thay đổi tài khoản admin của chính mình'; trong danh sách dòng của mình có locked=true.")
    A(F, "Gán quyền admin.manage cho vai trò khác Super Admin bị từ chối (chống leo thang đặc quyền)", "Bảo mật", "Cao", APIM + " Token admin@.",
      ["PATCH /admin/system/roles/finance {permission:'admin.manage', granted:true}", "POST /admin/system/roles {name:'Hack', permissions:['admin.manage']}", "PATCH /admin/system/roles/moderator {permissions:['dashboard.view','admin.manage']}"], "admin.manage",
      "Cả 3 -> 400 VALIDATION_ERROR 'Quyền \"admin.manage\" chỉ dành riêng cho Super Admin'; vai trò không bị thay đổi.")
    A(F, "Vai trò tùy chỉnh Content Reviewer: chỉ dashboard, người dùng (xem) và nội dung", "Bảo mật", "Cao", BASE3 + " Nhân viên Content Reviewer đã tạo (xem case Tài khoản quản trị).",
      ["Bằng token Content Reviewer: GET /admin/dashboard, GET /admin/users, GET /admin/content/posts, POST /admin/content/posts/khong-ton-tai/hide", "GET /admin/users/<id>/... ghi (POST /admin/users/x/warn)", "GET /admin/moderation/cases, GET /admin/payments/transactions, GET /admin/analytics/users, GET /admin/support/tickets, GET /admin/system/flags"], "content_reviewer",
      "200/qua guard: dashboard, users (GET), content (GET/POST). 403: users POST (thiếu user.ban), moderation (thiếu report.resolve), payments, analytics, support, system/flags. Khớp ma trận PERMS.")
    A(F, "Quyền chung của mọi vai trò: dashboard.view có ở cả 4 vai trò hệ thống và /admin/me không cần quyền", "Chức năng", "Thấp", API + " " + SEED_STAFF,
      ["GET /admin/me và GET /admin/dashboard bằng token của admin@, moderator@, support@, finance@"], "-",
      "Cả 4: /admin/me 200 (route chỉ cần là nhân viên) và /admin/dashboard 200. Nhân viên có vai trò tùy chỉnh KHÔNG có dashboard.view thì /admin/dashboard 403 nhưng /admin/me vẫn 200.")
    A(F, "Audit ghi đúng actor/vai trò/IP cho thao tác của nhân viên (không chỉ Super Admin)", "Chức năng", "Trung bình", APIM + " Token support@.",
      ["Bằng token support@: POST /admin/support/tickets/T-2002/note {body:'QA note'}", "GET /admin/audit-logs?action=support.ticket.note bằng token admin@"], "T-2002",
      "Dòng audit mới: actor 'Ryan Cho', actor.role={key:'support',name:'Support'}, ip = IP của request (vd ::1/127.0.0.1 khi chạy local), targetType=ticket, targetLabel bắt đầu 'T-2002 ·'.", pw="Một phần")

    # ============================================================ 3. PHÂN TÍCH (ANALYTICS)
    AN = SEED_ANALYTICS
    pages = [
        ("users", "Người dùng", "/admin/analytics/users", ["Tổng người dùng", "DAU (hoạt động/ngày)", "WAU (hoạt động/tuần)", "MAU (hoạt động/tháng)", "Người dùng mới"]),
        ("communities", "Cộng đồng", "/admin/analytics/communities", ["Cộng đồng", "Tạo mới trong kỳ", "Trả phí", "TB thành viên", "Tạm ngưng"]),
        ("engagement", "Tương tác", "/admin/analytics/engagement", ["Bài viết", "Bình luận", "Lượt thích", "Bài học hoàn thành", "Hoàn thành khóa học", "Tham gia sự kiện"]),
        ("retention", "Giữ chân", "/admin/analytics/retention", ["Giữ chân ngày 7", "Giữ chân ngày 30", "Tỷ lệ rời bỏ", "Tỷ lệ gia hạn"]),
        ("revenue", "Doanh thu", "/admin/analytics/revenue", ["MRR", "Doanh thu gộp", "Phí nền tảng", "ARPU", "Hoàn tiền"]),
        ("conversion", "Chuyển đổi", "/admin/analytics/conversion", ["Đăng ký → Tham gia", "Đăng ký → Trả phí", "Dùng thử → Trả phí", "Doanh thu / lượt đăng ký"]),
    ]
    F = "Phân tích · khung chung và chip khoảng thời gian"
    for key, title, path, kpis in pages:
        A(F, f"Trang Phân tích · {title}: tiêu đề, phụ đề, chip 7/30/90 ngày mặc định 30", "Giao diện", "Cao", UI + " " + AN,
          [f"Mở {path}", "Đọc tiêu đề, phụ đề và nhóm chip bên phải", "Mở Network xem GET /api/admin/analytics/" + key], path,
          f"Tiêu đề 'Phân tích · {title}', phụ đề 'Chỉ số tăng trưởng và hiệu suất của nền tảng.'; nhóm 3 chip '7 ngày' / '30 ngày' / '90 ngày' với '30 ngày' đang chọn (aria-selected); yêu cầu GET /api/admin/analytics/{key}?range=30 trả 200; hiện 'Đang tải…' rồi dữ liệu.")
        A(F, f"Phân tích · {title}: đổi chip 7 -> 90 ngày tải lại số liệu và trục thời gian", "Chức năng", "Cao", UI + " " + AN,
          [f"Mở {path}", "Bấm chip '7 ngày', ghi các giá trị thẻ KPI và số điểm trên biểu đồ (nếu có)", "Bấm '90 ngày', ghi lại", "Bấm '30 ngày' trở về"], "range 7 / 90 / 30",
          f"Mỗi lần bấm gửi GET ...analytics/{key}?range=<7|90|30>; chip được chọn đổi màu; thẻ KPI cập nhật (kỳ dài hơn thì số đếm tích lũy lớn hơn hoặc bằng); biểu đồ theo ngày có đúng 7 / 90 / 30 điểm; không nhấp nháy lỗi.")
        A(F, f"Phân tích · {title}: các thẻ KPI đúng nhãn tiếng Việt và hiện mức thay đổi so với kỳ trước", "Giao diện", "Cao", UI + " " + AN,
          [f"Mở {path}", "Đọc nhãn từng thẻ KPI và dòng phần trăm nhỏ ở góc (nếu có)"], path,
          f"Các thẻ theo thứ tự: {' · '.join(kpis)}. Mỗi thẻ có giá trị và (nếu kỳ trước khác 0) mức '+x%'/'-x%' so với kỳ trước ngay liền trước cùng độ dài; thẻ có ý nghĩa xấu (nếu có) tô màu cảnh báo khi tăng; kỳ trước = 0 thì không hiện %.", pw="Có")
        A(F, f"Phân tích · {title}: API lỗi hiện khối lỗi có nút Thử lại; Network chậm hiện Đang tải", "Giao diện", "Thấp", UI,
          [f"DevTools chặn /api/admin/analytics/{key}", f"F5 {path}", "Bỏ chặn, bấm 'Thử lại'"], path,
          "Khi tải: 'Đang tải…'; khi lỗi: khối lỗi (role=alert) với thông điệp + nút 'Thử lại'; bấm Thử lại sau khi bỏ chặn tải dữ liệu bình thường; không màn trắng.", pw="Một phần")

    F = "Phân tích · Người dùng (UI)"
    A(F, "Phân tích Người dùng: biểu đồ 'Tăng trưởng người dùng' và 'Người dùng hoạt động'", "Giao diện", "Cao", UI + " " + AN,
      ["Mở /admin/analytics/users (30 ngày)", "Đọc 2 biểu đồ, rê chuột vào một điểm", "So tổng 'Người dùng mới' cộng dồn series.newUsers với thẻ 'Người dùng mới'"], "range=30",
      "Biểu đồ 1 (series 'Người dùng mới') và biểu đồ 2 (series 'Hoạt động trong ngày', màu xanh) đều có 30 điểm (nhãn dd/mm), ngày không có sự kiện = 0; tổng series.newUsers = giá trị thẻ 'Người dùng mới'; tooltip hiện đúng giá trị ngày.")
    A(F, "Phân tích Người dùng: thẻ 'Phân khúc người dùng' 4 phân khúc, tổng phần trăm 100%", "Giao diện", "Cao", UI + " " + AN + " " + SEED_STAFF,
      ["Đọc thẻ 'Phân khúc người dùng'", "Cộng 4 dòng"], "-",
      "4 dòng: Thành viên miễn phí, Thành viên trả phí, Creator, Quản trị & kiểm duyệt; mỗi dòng dạng 'x% · N'; tổng N = 'Tổng người dùng'; 'Quản trị & kiểm duyệt' ≥ 8 (1 env + 7 nhân viên seed) và tổng phần trăm ≈ 100% (làm tròn 1 chữ số).")
    A(F, "Phân tích Người dùng: thẻ 'Phân bố địa lý' theo vị trí tự khai, ẩn khi rỗng", "Giao diện", "Trung bình", UI + " " + AN,
      ["Mở /admin/analytics/users", "Tìm thẻ 'Phân bố địa lý'", "Nếu có: đọc phụ đề", "Đối chiếu SQL SELECT btrim(location), count(*) FROM \"User\" WHERE \"deletedAt\" IS NULL AND location IS NOT NULL AND btrim(location) <> '' GROUP BY 1 ORDER BY 2 DESC LIMIT 5"], "-",
      "Nếu có người dùng có trường location: thẻ hiện tối đa 5 dòng với phụ đề 'Theo vị trí người dùng tự khai', khớp SQL (cùng thứ tự, số lượng, % trên tổng 5 dòng). Nếu không ai khai: thẻ KHÔNG hiện (lưới còn 1 cột). Lưu ý đây là dữ liệu tự khai, không phải địa lý thật (xấp xỉ).", pw="Một phần")
    A(F, "Phân tích Người dùng KHÔNG có thẻ 'Nguồn đăng ký' và 'Lượt truy cập' (không có dữ liệu)", "Giao diện", "Thấp", UI,
      ["Mở /admin/analytics/users", "Tìm thẻ 'Nguồn đăng ký' / 'Lượt truy cập'"], "-",
      "Không có thẻ nào như vậy; biểu đồ hoạt động chỉ 1 đường 'Hoạt động trong ngày' (không phải DAU/WAU/MAU theo ngày). Đây là khoảng trống đã biết (xem case Kế hoạch).", pw="Một phần")
    F = "Phân tích · Cộng đồng (UI)"
    A(F, "Phân tích Cộng đồng: biểu đồ 3 đường và thẻ 'Theo danh mục'", "Giao diện", "Trung bình", UI + " " + AN,
      ["Mở /admin/analytics/communities", "Đọc biểu đồ 'Tăng trưởng cộng đồng' và thẻ 'Theo danh mục'"], "-",
      "Biểu đồ có 3 series 'Tạo mới', 'Đang hoạt động', 'Trả phí mới' (mỗi ngày 1 điểm); 'Theo danh mục' liệt kê các danh mục với 'x% · N' (nhãn danh mục lấy từ danh mục Khám phá), tổng N = số cộng đồng.")
    A(F, "Phân tích Cộng đồng: bảng 'Cộng đồng hàng đầu' có 10 dòng và cột đúng", "Giao diện", "Cao", UI + " " + AN,
      ["Mở /admin/analytics/communities", "Đọc tiêu đề bảng, phụ đề và các cột", "So với SQL: 10 cộng đồng nhiều Enrollment nhất"], "-",
      "Bảng 'Cộng đồng hàng đầu' (phụ đề 'Theo số thành viên'), tối đa 10 dòng sắp theo Thành viên giảm dần; cột: Cộng đồng (tên + danh mục), Thành viên, Thành viên mới, Tăng trưởng (badge xanh '+x%' hoặc đỏ '-x%', '—' khi không có), MRR (định dạng $). Khớp SQL.", pw="Một phần")
    A(F, "Phân tích Cộng đồng: bấm một dòng của bảng mở chi tiết cộng đồng", "Chức năng", "Trung bình", UI + " " + AN,
      ["Bấm dòng đầu tiên của 'Cộng đồng hàng đầu'"], "-", "Chuyển tới /admin/communities/<id cộng đồng> đúng cộng đồng đã bấm.")
    A(F, "Phân tích Cộng đồng: thẻ 'Tạm ngưng' tô cảnh báo và không có kỳ trước", "Giao diện", "Thấp", UI + " " + AN,
      ["Đọc thẻ 'Tạm ngưng'"], "-", "Giá trị = số cộng đồng đang bị tạm ngưng HIỆN TẠI (seed: crypto-signals-pro ≥ 1); không hiện % so với kỳ trước (BE trả previous=null vì không có lịch sử trạng thái).")
    F = "Phân tích · Tương tác (UI)"
    A(F, "Phân tích Tương tác: biểu đồ 5 đường và thẻ 'Cơ cấu tương tác'", "Giao diện", "Trung bình", UI + " " + AN,
      ["Mở /admin/analytics/engagement", "Đọc biểu đồ 'Tương tác' và 'Cơ cấu tương tác'"], "-",
      "Biểu đồ 5 series: Bài viết, Bình luận, Lượt thích, Bài học hoàn thành, Tham gia sự kiện; 'Cơ cấu tương tác' với nhãn tiếng Việt (Lượt thích, Bình luận, Bài viết, Hoàn thành bài học, Tham gia sự kiện) và 'x% · N', tổng 100%.")
    A(F, "Phân tích Tương tác: thẻ 'Hoàn thành khóa học' hiển thị phần trăm 1 chữ số thập phân", "Giao diện", "Thấp", UI + " " + AN,
      ["Đọc thẻ 'Hoàn thành khóa học'"], "-", "Giá trị dạng 'x%' hoặc 'x.y%' (bỏ '.0'), nằm trong 0-100; = chứng nhận đã cấp / số cặp (user, cộng đồng) từng hoàn thành ≥ 1 bài, tính lũy kế đến cuối kỳ.")
    F = "Phân tích · Giữ chân (UI)"
    A(F, "Phân tích Giữ chân: bản đồ nhiệt cohort 6 nhóm tháng, cột Tuần 1/2/4/8/12", "Giao diện", "Cao", UI + " " + AN,
      ["Mở /admin/analytics/retention", "Đọc thẻ 'Giữ chân theo nhóm' và tiêu đề cột", "Rê qua từng ô"], "-",
      "Thẻ 'Giữ chân theo nhóm' (phụ đề 'Tỷ lệ mỗi nhóm đăng ký (theo tháng) còn hoạt động sau N tuần. Ô trống = chưa đủ thời gian.'); cột Nhóm, Người dùng, Tuần 1, Tuần 2, Tuần 4, Tuần 8, Tuần 12; tối đa 6 hàng (6 tháng gần nhất, nhãn kiểu 'Sep 2026' + 'Nhóm đăng ký'); ô có số dạng 'N%' tô cam đậm dần theo giá trị; ô chưa đủ thời gian hiện '—' nền xám.")
    A(F, "Phân tích Giữ chân: cohort tháng hiện tại có tuần xa hiện '—'", "Giao diện", "Trung bình", UI + " " + AN,
      ["Xem hàng cohort tháng mới nhất (tháng hiện tại)", "Đọc các ô Tuần 4, Tuần 8, Tuần 12"], "-", "Các tuần chưa đủ thời gian kể từ ngày đăng ký (vd Tuần 12 của cohort tháng hiện tại) = '—' (BE trả null), KHÔNG hiện 0%.")
    A(F, "Phân tích Giữ chân: biểu đồ cột 'Người dùng quay lại' 2 loạt", "Giao diện", "Trung bình", UI + " " + AN,
      ["Đọc biểu đồ 'Người dùng quay lại'"], "-", "Biểu đồ cột, mỗi ngày 1 nhóm cột: 'Quay lại' (đã đăng ký từ trước vẫn hoạt động trong ngày) và 'Mới hoạt động' (xanh dương); phụ đề mô tả đúng; số ngày = range.")
    A(F, "Phân tích Giữ chân: thẻ 'Tỷ lệ rời bỏ' tô màu xấu", "Giao diện", "Thấp", UI + " " + AN,
      ["Đọc thẻ 'Tỷ lệ rời bỏ'"], "-", "Thẻ có biểu tượng/màu cảnh báo (bad); giá trị % = người dùng hoạt động ở kỳ trước nhưng không hoạt động ở kỳ hiện tại.")
    F = "Phân tích · Doanh thu (UI)"
    A(F, "Phân tích Doanh thu: biểu đồ 3 đường định dạng tiền và thẻ 'Theo loại thanh toán'", "Giao diện", "Cao", UI + " " + AN,
      ["Mở /admin/analytics/revenue", "Rê chuột vào một điểm của biểu đồ 'Doanh thu'", "Đọc 'Theo loại thanh toán' và 'Theo cộng đồng'"], "-",
      "Biểu đồ 3 series: 'Doanh thu gộp', 'Doanh thu ròng' (xanh lá), 'Hoàn tiền' (đỏ); tooltip dạng '$x' hoặc '$x.xK'; 'Theo loại thanh toán' nhãn 'Đăng ký mới' / 'Gia hạn' (khóa new_subscription / renewal); 'Theo cộng đồng' (phụ đề 'Doanh thu gộp trong kỳ') liệt kê tên cộng đồng + '% · $'.")
    A(F, "Phân tích Doanh thu: thẻ tiền dùng định dạng $ và 'Hoàn tiền' tô cảnh báo", "Giao diện", "Thấp", UI + " " + AN,
      ["Đọc 5 thẻ KPI"], "-", "MRR, Doanh thu gộp, Phí nền tảng, ARPU, Hoàn tiền hiển thị dạng '$1,234.56' (formatCents); 'Hoàn tiền' tô màu xấu khi tăng.")
    F = "Phân tích · Chuyển đổi (UI)"
    A(F, "Phân tích Chuyển đổi: phễu 4 bước bắt đầu từ 'Tạo tài khoản' (không có bước truy cập)", "Giao diện", "Cao", UI + " " + AN,
      ["Mở /admin/analytics/conversion", "Đọc thẻ 'Phễu chuyển đổi' và các thanh", "Đối chiếu số trong 4 bước với count trong API"], "-",
      "Thẻ 'Phễu chuyển đổi' (phụ đề 'Người đăng ký trong kỳ đi tiếp qua từng bước') 4 bước theo thứ tự: Tạo tài khoản, Tham gia cộng đồng, Bắt đầu dùng thử, Trở thành trả phí; bước đầu 100%, các bước sau hiện '% so với bước đầu' cạnh nhãn; thanh nhạt dần; KHÔNG có bước 'Xem trang cộng đồng/Truy cập'. 4 thẻ KPI: Đăng ký → Tham gia, Đăng ký → Trả phí, Dùng thử → Trả phí, Doanh thu / lượt đăng ký.")
    A(F, "Phân tích Chuyển đổi: biểu đồ cột 'Chuyển đổi theo ngày' 3 loạt", "Giao diện", "Trung bình", UI + " " + AN,
      ["Đọc biểu đồ 'Chuyển đổi theo ngày'"], "-", "3 loạt: 'Đăng ký mới', 'Bắt đầu dùng thử' (xanh dương), 'Chuyển sang trả phí' (xanh lá); mỗi ngày 1 nhóm cột.")
    A(F, "Phân tích Chuyển đổi: kỳ không có đăng ký thì phễu hiện số 0, không chia cho 0", "Chức năng", "Thấp", UI + " Chỉ làm được khi 7 ngày gần nhất không có đăng ký mới: nếu có, dùng DB rỗng/bỏ qua.",
      ["Mở /admin/analytics/conversion chip 7 ngày khi 7 ngày qua chưa có User mới"], "-", "Phễu hiện 0 ở các bước, các tỉ lệ = 0% (không NaN/Infinity/'null%'); thẻ 'Doanh thu / lượt đăng ký' = $0; không lỗi console.", pw="Một phần")

    # ---- API analytics
    F = "Phân tích · API và cách tính"
    A(F, "Cả 6 endpoint /admin/analytics/* trả khung {range, from, to, kpis, series...} và Kpi {value, previous, changePct}", "Chức năng", "Cao", API + " " + AN,
      ["GET /api/admin/analytics/users, /communities, /engagement, /retention, /revenue, /conversion (không tham số)", "Kiểm tra từng response"], "range mặc định",
      "Cả 6 trả 200 {data:{range:30, from, to, kpis:{...}}}; mọi KPI có dạng {value, previous, changePct}; from/to là ISO UTC, to = cuối ngày hôm nay (23:59:59.999Z) và from = to - 30 ngày + 1 ms (30 ngày UTC tính cả hôm nay).")
    A(F, "series[] có đúng 1 phần tử mỗi ngày (điền 0 cho ngày trống) và date dạng YYYY-MM-DD tăng dần", "Chức năng", "Cao", API,
      ["GET /analytics/users?range=7, ?range=30, ?range=90", "Đếm series.length, kiểm tra date đầu/cuối và thứ tự", "Lặp cho /engagement, /conversion và /revenue"], "range 7/30/90",
      "series.length = 7 / 30 / 90; date liên tiếp từng ngày UTC không thiếu/trùng, phần tử cuối là hôm nay (UTC); ngày không có sự kiện = 0 (không bỏ trống/null).")
    A(F, "range không hợp lệ (15, 0, abc, 7.5, rỗng) trả 400; range thiếu mặc định 30", "Chức năng", "Cao", API,
      ["GET /analytics/users?range=15", "?range=0", "?range=abc", "?range=7.5", "?range=", "không có range"], "-",
      "5 lần đầu: 400 VALIDATION_ERROR (chỉ nhận 7|30|90); lần cuối 200 range=30.")
    A(F, "changePct = null khi kỳ trước bằng 0; làm tròn 1 chữ số thập phân khi có", "Chức năng", "Trung bình", API,
      ["GET /analytics/users?range=7 và đọc kpis.newUsers", "Tìm KPI có previous=0 (vd conversion hoặc KPI mới)", "Tự tính (value-previous)/previous*100 làm tròn 1 chữ số"], "-",
      "previous=0 -> changePct=null (FE ẩn %); còn lại changePct khớp công thức, 1 chữ số thập phân. Riêng communities.kpis.suspended có previous=null.", pw="Một phần")
    A(F, "Số quá lớn khi kỳ trước gần 0: FE rút gọn dạng 25.3K%", "Giao diện", "Thấp", UI + " " + AN,
      ["Tìm một KPI có changePct ≥ 1000 (vd tạo dữ liệu mới khi kỳ trước gần 0) trên Phân tích", "Đọc nhãn %"], "-",
      "FE hiện '+25.3K%' (≥1000 -> K, ≥100 làm tròn số nguyên, còn lại 1 chữ số), không tràn thẻ. Khoảng trống BE: chưa có cờ baselineTooSmall (xem case Kế hoạch).", pw="Một phần")
    A(F, "Quyền analytics.view: Moderator và Finance xem được, Support và Content Reviewer bị 403", "Bảo mật", "Cao", BASE3 + " Token moderator@, finance@, support@.",
      ["GET /admin/analytics/users bằng token moderator@, finance@, support@"], "-", "moderator@ và finance@ 200; support@ 403 'Vai trò Support không có quyền \"analytics.view\"'.")
    A(F, "Analytics users đối chiếu SQL: totalUsers, newUsers, DAU/WAU/MAU, segments", "Chức năng", "Cao", API + " " + AN + " Có quyền chạy SQL trên DB test.",
      ["GET /analytics/users?range=30, ghi from/to", "SQL totalUsers: SELECT count(*) FROM \"User\" WHERE \"deletedAt\" IS NULL AND \"createdAt\" < <to>", "SQL newUsers: ... AND \"createdAt\" >= <from> AND \"createdAt\" < <to>", "SQL kỳ trước: lùi from/to 30 ngày",
       "SQL DAU: count(DISTINCT uid) từ UNION của Post/PostComment/PostLike/Message/LessonProgress/EventRsvp/PointEvent/Payment/Session(createdAt, lastUsedAt) với ts trong 24 giờ trước <to>; WAU 7 ngày; MAU 30 ngày",
       "SQL segments: ưu tiên staff (AdminAccount hoặc email trong PLATFORM_ADMIN_EMAILS) > creators (có Course.ownerId) > paid_members (Subscription active|trialing|past_due) > free_members"], "range=30",
      "Mọi số khớp SQL (kpis.*.value, *.previous, segments[].count); tổng segments = totalUsers; pct = count/tổng (làm tròn). Xấp xỉ đã biết: lastUsedAt chỉ giữ lần dùng gần nhất nên ngày cũ có thể thiếu hoạt động đăng nhập.", pw="Một phần")
    A(F, "Analytics users phản ánh dữ liệu mới: tạo user mới làm newUsers/totalUsers tăng 1", "Chức năng", "Cao", APIM + " Token admin@.",
      ["GET /analytics/users?range=7 ghi totalUsers.value và newUsers.value", "POST /api/auth/register tạo user mới (email duy nhất)", "GET /analytics/users?range=7 lại"], "user mới",
      "totalUsers.value +1, newUsers.value +1, series ngày hôm nay (cuối mảng) newUsers +1; mọi KPI không liên quan không đổi nhiều.")
    A(F, "Analytics communities đối chiếu SQL: total, created, paid, avgMembers, top 10", "Chức năng", "Cao", API + " " + AN,
      ["GET /analytics/communities?range=30", "SQL total: Course chưa xóa; created: createdAt trong kỳ; paid: pricing='paid' AND priceCents>0", "avgMembers = số Enrollment / số cộng đồng", "SQL top: 10 cộng đồng nhiều Enrollment; newMembers = Enrollment trong kỳ; growthPct = new / thành viên trước kỳ; mrrCents = SUM(Subscription.priceCents) status active|past_due"], "range=30",
      "kpis và top[] khớp SQL; top có tối đa 10 phần tử giảm dần theo members; suspended = số cộng đồng đang suspended (previous=null); byCategory tổng = total.", pw="Một phần")
    A(F, "Analytics engagement đối chiếu SQL: posts, comments, likes, lessonCompletions, eventParticipation", "Chức năng", "Cao", API + " " + AN,
      ["GET /analytics/engagement?range=30", "SQL: Post/PostComment/PostLike/EventRsvp theo createdAt trong kỳ; LessonProgress theo completedAt", "So series[].posts... với SQL theo ngày UTC"], "range=30",
      "kpis.*.value = tổng series tương ứng = SQL; kpis.*.previous = SQL kỳ trước; mix[] gồm posts/comments/likes/completions/rsvps với pct theo tổng.", pw="Một phần")
    A(F, "Analytics retention: 6 cohort, tuần chưa đủ thời gian = null, user mới nằm trong cohort tháng hiện tại", "Chức năng", "Cao", APIM + " " + AN,
      ["GET /analytics/retention?range=30", "Đếm cohorts (6 phần tử), kiểm tra weeks.wN null ở cohort mới", "Đăng ký user mới rồi gọi lại, xem users của cohort tháng hiện tại"], "-",
      "cohorts.length = 6 theo tháng đăng ký (nhãn kiểu 'Oct 2026'); cohort mới có w8/w12 = null; users cohort tháng hiện tại +1 sau khi đăng ký; wN là % (0-100). Seed đã rải đăng ký/phiên quay lại nên các cohort cũ có số lẻ khác 0.", pw="Một phần")
    A(F, "Analytics retention day7/day30/churn/renewalRate theo định nghĩa", "Chức năng", "Trung bình", API + " " + AN,
      ["GET /analytics/retention?range=90", "Tự tính day7 = % user đăng ký sao cho cửa sổ [N,N+7) bắt đầu từ ngày N sau đăng ký kết thúc trong kỳ và có hoạt động trong cửa sổ", "churn = % user active ở kỳ trước nhưng không active ở kỳ hiện tại", "renewalRate = gia hạn thành công / (gia hạn + gói hết hạn/hủy trong kỳ)"], "range=90",
      "Số khớp tính tay trong sai số làm tròn; mọi tỷ lệ trong 0-100; kpis.*.previous hợp lý. Đây là xấp xỉ theo bảng sự kiện hiện có (không có log phiên lịch sử).", pw="Không")
    A(F, "Analytics revenue đối chiếu SQL: gross, refunds, mrr, arpu, byCommunity, byPlan", "Chức năng", "Cao", API + " " + AN,
      ["GET /analytics/revenue?range=90", "SQL gross: SUM(amountCents) Payment status succeeded|refunded theo COALESCE(confirmedAt, createdAt) trong kỳ", "SQL refunds: SUM RefundRequest approved theo resolvedAt", "SQL mrr: SUM(Subscription.priceCents) active|past_due", "arpu = gross / số người trả tiền", "byPlan theo Payment.kind (new_subscription/renewal)"], "range=90",
      "Mọi số khớp SQL; series[].netCents = gross - refunds; byCommunity.pct tổng ≤ 100%; byPlan chỉ có new_subscription/renewal (hệ thống chỉ có 1 gói theo cộng đồng, không có monthly/annual).", pw="Một phần")
    A(F, "Phí nền tảng (platformFeesCents) là xấp xỉ = gross × hoa hồng HIỆN TẠI, đổi theo Cài đặt chung", "Chức năng", "Cao", APIM + " " + PENDING_DECISION + " hoa hồng 10% " + NOW_ADJUSTABLE + ". Token admin@.",
      ["GET /analytics/revenue?range=90 ghi platformFeesCents và grossCents", "PATCH /admin/system/settings {payments:{commissionPct:20}}", "GET /analytics/revenue?range=90 lại", "POST /admin/system/settings/reset {keys:['payments.commissionPct']}"], "commissionPct 10 -> 20",
      "Trước: platformFeesCents ≈ gross × 10%; sau: ≈ gross × 20% (gấp đôi) cho TOÀN BỘ kỳ - không phải số đã chốt theo từng giao dịch (so với /admin/payments/creators dùng tỷ lệ hiện hành cũng đổi); sau reset về ≈10%.")
    A(F, "Analytics conversion: phễu signup -> joined -> trial -> paid tính trên nhóm đăng ký trong kỳ", "Chức năng", "Cao", API + " " + AN,
      ["GET /analytics/conversion?range=90", "SQL signup: User tạo trong kỳ; joined: trong nhóm đó có Enrollment; trial: có Subscription.trialEndsAt; paid: có Payment > 0 thành công (bất kể thời điểm)", "pctOfFirst = count/signup"], "range=90",
      "funnel có đúng 4 key signup/joined/trial/paid, pctOfFirst của signup = 100; không có bước 'visit'; signupToJoinPct = joined/signup...; KPI khớp SQL.", pw="Một phần")
    A(F, "Analytics revenue/conversion phản ánh giao dịch mới: thanh toán thành công làm gross tăng", "Chức năng", "Cao", APIM + " Token admin@, tài khoản newbie@ (chưa mua).",
      ["GET /analytics/revenue?range=7 ghi grossCents", "newbie@: POST /api/courses/paid-demo/checkout rồi POST /api/payments/<intent>/confirm", "GET /analytics/revenue?range=7 và /conversion lại"], "newbie@, paid-demo $19",
      "grossCents tăng $19 (1900 cent) ở ngày hôm nay, byPlan.new_subscription tăng; conversion: paid/signupToPaidPct có thể tăng nếu newbie thuộc nhóm đăng ký trong kỳ.", pw="Một phần")
    A(F, "Không có CSV/Xuất cho Phân tích (nút bị ẩn, không có endpoint)", "Chức năng", "Thấp", UI,
      ["Mở từng trang Phân tích, tìm nút 'Xuất' / Download CSV", "GET /api/admin/analytics/users/export"], "-",
      "HIỆN TẠI: không có nút Xuất ở 6 trang và endpoint export không tồn tại (khoảng trống đã biết - xem case Kế hoạch).", pw="Một phần")
    A(F, "Hiệu năng Phân tích: 6 endpoint tính trực tiếp bằng SQL phản hồi dưới 3 giây trên seed", "Hiệu năng", "Trung bình", API + " " + AN,
      ["Đo thời gian GET /analytics/{users,communities,engagement,retention,revenue,conversion}?range=90 (mỗi cái 3 lần)"], "range=90",
      "Mỗi request < 3 giây trên DB seed (≈1,5K người dùng); không có bảng tổng hợp/cache nên chi phí tăng theo dữ liệu - theo dõi khi số bản ghi hoạt động lên hàng triệu.", pw="Không")

    # ============================================================ 4. HỖ TRỢ (SUPPORT) - ADMIN UI
    SUPPORT_LOGIN = " Đăng nhập support@sofinhub.test / Passw0rd!x (Ryan Cho, vai trò Support) hoặc admin@."
    SP = BASE3 + " " + SEED_TICKET
    SP_UI = SP + SUPPORT_LOGIN + " Frontend :5173."
    SP_UIM = SP_UI + " " + MUTATE
    F = "Hỗ trợ · danh sách ticket (UI)"
    A(F, "Trang 'Ticket hỗ trợ': tiêu đề, nút 'Tạo ticket', 4 thẻ KPI đúng số seed", "Giao diện", "Cao", SP_UI,
      ["Mở /admin/support/tickets", "Đọc 4 thẻ KPI", "Đối chiếu GET /api/admin/support/summary"], "-",
      "Tiêu đề 'Ticket hỗ trợ', phụ đề 'Yêu cầu hỗ trợ từ thành viên và creator.', nút chính 'Tạo ticket'. Thẻ: 'Đang mở' = 16 (mới+đang mở+chờ phản hồi trên DB sạch), 'Mới hôm nay' (số ticket tạo từ 0h UTC), 'Phản hồi đầu TB' (số phút làm tròn + ' phút' kèm % so tuần trước, hoặc '—'), 'Đã xử lý (7 ngày)'. Khớp /support/summary.")
    A(F, "Trang 'Ticket hỗ trợ': các cột bảng và định dạng một dòng (T-2004)", "Giao diện", "Cao", SP_UI,
      ["Ô tìm kiếm gõ 'T-2004'", "Đọc dòng kết quả"], "T-2004",
      "Đúng 1 dòng: cột 'Ticket' = 'Account locked by mistake' + '#T-2004 · đã chuyển cấp' (biểu tượng nhóm Người dùng); 'Người gửi' = Maya Chen; 'Nhóm' = Người dùng; 'Ưu tiên' badge 'Khẩn cấp' (đỏ); 'Phụ trách' = Ryan Cho; 'Cập nhật' dạng tương đối; 'Trạng thái' badge 'Đang mở'.")
    A(F, "Tab trạng thái: Tất cả / Mới / Đang mở / Chờ phản hồi / Đã xử lý (không có tab 'Đã đóng', không hiện số đếm)", "Giao diện", "Cao", SP_UI,
      ["Mở /admin/support/tickets", "Bấm lần lượt 5 tab, đếm tổng ở chân bảng", "Tìm T-2007 (Đã đóng) trong từng tab"], "-",
      "Tổng theo tab trên DB sạch: Tất cả 22, Mới 5, Đang mở 7, Chờ phản hồi 4, Đã xử lý 4. Tab KHÔNG hiện số đếm (khoảng trống đã biết: BE chưa trả byStatus). Ticket đã đóng (T-2007, T-2019) chỉ thấy ở tab 'Tất cả' vì không có tab 'Đã đóng'.")
    A(F, "Trang 'Vấn đề người dùng/creator/thanh toán' lọc đúng nhóm và ẩn cột 'Nhóm'", "Chức năng", "Cao", SP_UI,
      ["Mở /admin/support/user, đọc tổng và các cột", "Mở /admin/support/creator", "Mở /admin/support/payment", "Đọc tiêu đề và thẻ 'Đang mở (…)'"], "-",
      "Tiêu đề lần lượt 'Vấn đề người dùng' (tổng 8: T-2001..T-2007 + T-2021), 'Vấn đề creator' (7), 'Vấn đề thanh toán' (7); cột 'Nhóm' bị ẩn; thẻ đầu 'Đang mở (Người dùng)' = 6, '(Creator)' = 5, '(Thanh toán)' = 5 (số mở theo nhóm trong /support/summary.byCategory).")
    A(F, "Tìm ticket theo chủ đề, tên/email người gửi và mã T-xxxx", "Chức năng", "Cao", SP_UI,
      ["Gõ 'avatar' vào ô 'Tìm ticket...'", "Xóa, gõ 'daniel'", "Xóa, gõ 'sarah@sofinhub.test'", "Xóa, gõ 't-2014' (chữ thường)"], "avatar | daniel | sarah@sofinhub.test | t-2014",
      "Lần 1: T-2005 'Cannot upload my avatar'; lần 2: các ticket của Daniel (T-2003, T-2015); lần 3: các ticket của Sarah (T-2001, T-2009, T-2014); lần 4: đúng T-2014 'Charged twice this month'. Không phân biệt hoa/thường; về trang 1 mỗi lần đổi từ khóa; có debounce.")
    A(F, "Tìm ticket không có kết quả: 'Không có ticket nào.' và bộ lọc 'Xóa bộ lọc'", "Giao diện", "Thấp", SP_UI,
      ["Gõ 'zzzkhongcoketqua123'", "Chọn lọc Ưu tiên 'Khẩn cấp' rồi bấm 'Xóa bộ lọc'"], "zzzkhongcoketqua123", "Bảng hiện 'Không có ticket nào.'; KPI không đổi; 'Xóa bộ lọc' đưa bộ lọc ưu tiên/phụ trách về rỗng và về trang 1.")
    A(F, "Lọc theo Ưu tiên (Thấp/Trung bình/Cao/Khẩn cấp) và theo Phụ trách (Của tôi/Chưa giao/tên)", "Chức năng", "Cao", SP_UI,
      ["Lọc Ưu tiên = 'Khẩn cấp'", "Xóa, lọc Phụ trách = 'Chưa giao'", "Phụ trách = 'Của tôi' (đăng nhập support@)", "Phụ trách = 'Tom Baker'"], "-",
      "Khẩn cấp: T-2004 và T-2014 (2 dòng). Chưa giao: 7 ticket mở chưa giao (mọi ticket đã xử lý/đóng đều có người phụ trách) (T-2002, T-2006, T-2010, T-2012, T-2015, T-2018, T-2020). Của tôi (Ryan Cho): 9 ticket (T-2001, T-2004, T-2007, T-2008, T-2011, T-2014, T-2016, T-2019, T-2022). Tom Baker: 6 ticket (T-2003, T-2005, T-2009, T-2013, T-2017, T-2021). Danh sách người trong dropdown lấy từ GET /support/assignees (nhân viên active có support.manage + Super Admin env).")
    A(F, "Sắp xếp mặc định theo hoạt động gần nhất và phân trang 15 dòng/trang", "Chức năng", "Trung bình", SP_UI,
      ["Mở /admin/support/tickets, đọc dòng đầu", "Bấm 'Trang sau'", "Bấm 'Trang trước'"], "-",
      "Dòng đầu là ticket cập nhật gần nhất (lastActivityAt giảm dần); trang 1 có 15 dòng, trang 2 có 7 dòng (tổng 22); 'Trang trước' bị vô hiệu ở trang 1, 'Trang sau' bị vô hiệu ở trang cuối; hiển thị đúng tổng bản ghi.")
    A(F, "Menu thao tác dòng theo trạng thái: mở -> Trả lời/Nhận xử lý/Giao cho…/Đã xử lý/Chuyển cấp trên; đã xử lý/đóng -> Xem/Mở lại", "Chức năng", "Cao", SP_UI,
      ["Mở menu dòng T-2002 (Mới, chưa giao)", "Mở menu T-2001 (Đang mở, có người phụ trách)", "Mở menu T-2004 (đã chuyển cấp)", "Mở menu T-2005 (Đã xử lý)", "Mở menu T-2007 (Đã đóng)"], "-",
      "T-2002: Trả lời, Nhận xử lý, Giao cho…, Đã xử lý, Chuyển cấp trên, Xem người dùng. T-2001: Trả lời, Giao cho…, Đã xử lý, Chuyển cấp trên, Xem người dùng (không có 'Nhận xử lý'). T-2004: không có 'Chuyển cấp trên'. T-2005 và T-2007: Xem, Mở lại, Xem người dùng (không có Đã xử lý/Giao/Chuyển cấp). Dòng không gắn tài khoản (nếu có) không có 'Xem người dùng'.")
    A(F, "Nhận xử lý ticket chưa giao: toast, cột Phụ trách đổi, trạng thái Mới -> Đang mở", "Chức năng", "Cao", SP_UIM + " Đăng nhập support@.",
      ["Menu dòng T-2002 (Mới, chưa giao) > 'Nhận xử lý'", "Quan sát toast và dòng", "Mở chi tiết T-2002 xem hội thoại"], "T-2002",
      "Toast 'Bạn đã nhận xử lý T-2002'; cột Phụ trách = Ryan Cho; trạng thái 'Đang mở'; hội thoại có dòng hệ thống 'Đã giao cho Ryan Cho'; audit support.ticket.assign.")
    A(F, "Giao ticket cho người khác và bỏ giao qua dialog 'Giao ticket · T-xxxx'", "Chức năng", "Cao", SP_UIM,
      ["Menu dòng T-2001 > 'Giao cho…'", "Chọn chip 'Tom Baker' > 'Lưu'", "Mở lại dialog, chọn 'Bỏ gán' > 'Lưu'", "Quan sát nút 'Lưu' khi chưa chọn gì (ticket chưa giao)"], "T-2001",
      "Dialog 'Giao ticket · T-2001' có chip 'Bỏ gán' + tên các nhân viên support.manage; nút 'Lưu' khóa tới khi chọn; toast 'Đã cập nhật người phụ trách'; Phụ trách đổi sang Tom Baker rồi 'Chưa giao'; hội thoại có 'Đã giao cho Tom Baker' và 'Đã bỏ giao việc'.")
    A(F, "Dialog 'Giao ticket' chỉ liệt kê nhân viên có quyền support.manage (không có Moderator/Finance)", "Chức năng", "Trung bình", SP_UI,
      ["Mở dialog Giao cho… ở bất kỳ ticket mở", "Đọc danh sách chip"], "-",
      "Chip gồm: Bỏ gán, Ryan Cho (Support), Tom Baker (Support), Platform Admin (Super Admin env). KHÔNG có moderator@, finance@, nina@ (suspended), john, mia.")
    A(F, "Đánh dấu đã xử lý từ dialog: tiêu đề, ghi chú tùy chọn, toast, trạng thái", "Chức năng", "Cao", SP_UIM,
      ["Menu dòng T-2008 > 'Đã xử lý'", "Nhập ghi chú 'Đã kiểm tra, upload ổn' và bấm 'Đã xử lý'", "Mở chi tiết T-2008"], "T-2008",
      "Dialog 'Đánh dấu đã xử lý · T-2008' (mô tả 'Ticket chuyển sang Đã xử lý. Người gửi vẫn có thể trả lời để mở lại.'); toast 'Đã xử lý T-2008'; badge 'Đã xử lý'; KPI 'Đã xử lý (7 ngày)' +1; hội thoại thêm dòng hệ thống 'Đã giải quyết ticket: Đã kiểm tra, upload ổn'.")
    A(F, "Chuyển cấp trên: bắt buộc lý do, toast, nâng ưu tiên lên Khẩn cấp, nhãn 'đã chuyển cấp'", "Chức năng", "Cao", SP_UIM,
      ["Menu dòng T-2010 (Cao, chưa giao) > 'Chuyển cấp trên'", "Quan sát nút 'Chuyển cấp trên' khi ô lý do trống", "Nhập 'Cần engineering xem' và xác nhận"], "T-2010",
      "Dialog 'Chuyển cấp trên · T-2010' (nút xác nhận khóa tới khi nhập 'Lý do chuyển cấp'); toast 'Đã chuyển cấp T-2010'; cột Ticket ghi '#T-2010 · đã chuyển cấp'; ưu tiên thành 'Khẩn cấp'; hội thoại thêm 'Escalated (urgent): Cần engineering xem'; menu dòng không còn 'Chuyển cấp trên'; KPI không hiện 'chuyển cấp' (chỉ API summary.escalated +1).")
    A(F, "Mở lại ticket đã xử lý/đã đóng từ menu dòng", "Chức năng", "Cao", SP_UIM,
      ["Menu dòng T-2005 (Đã xử lý) > 'Mở lại'", "Menu dòng T-2007 (Đã đóng) > 'Mở lại'"], "T-2005, T-2007",
      "Toast 'Đã mở lại T-2005' / 'Đã mở lại T-2007'; trạng thái 'Đang mở'; resolvedAt/closedAt bị xóa; hội thoại thêm 'Đã mở lại ticket'; audit support.ticket.reopen.")
    A(F, "Tạo ticket hộ khách: dialog, trường bắt buộc, liên kết tài khoản theo email", "Chức năng", "Cao", SP_UIM,
      ["Bấm 'Tạo ticket'", "Nhập Chủ đề 'QA: khách gọi điện', Nội dung 'Khách hỏi về hoàn tiền', chọn Nhóm 'Thanh toán', Ưu tiên 'Cao'", "Nhập Email khách 'daniel@sofinhub.test' và Tên khách để trống", "Bấm 'Tạo ticket'"], "daniel@sofinhub.test",
      "Dialog 'Tạo ticket hộ khách' (mô tả liên kết tài khoản nếu email trùng); nút 'Tạo ticket' khóa khi thiếu Chủ đề/Nội dung; toast 'Đã tạo ticket'; ticket mới nguồn 'admin', Người gửi 'Daniel ...' (lấy tên từ tài khoản), nhóm Thanh toán, ưu tiên Cao, trạng thái Mới, 'Xem người dùng' dẫn tới hồ sơ Daniel; mã T- tiếp nối số cuối.")
    A(F, "Tạo ticket hộ khách khi để trống 'Email khách (tùy chọn)': giao diện nói tùy chọn nhưng API yêu cầu email", "Chức năng", "Cao", SP_UIM,
      ["Bấm 'Tạo ticket'", "Nhập Chủ đề và Nội dung, KHÔNG nhập email", "Bấm 'Tạo ticket'"], "email trống",
      "KỲ VỌNG THEO HỢP ĐỒNG/GIAO DIỆN: tạo được ticket với email trống (nhãn '(tùy chọn)', hợp đồng admin-batch3.md ghi requesterEmail?). HIỆN TẠI: BE bắt requesterEmail bắt buộc (createTicketBody) -> FE gửi thiếu trường -> 400 VALIDATION_ERROR hiện trong dialog; không tạo ticket. LỆCH giữa tài liệu/giao diện và code.", st=PLAN, pw="Một phần")
    A(F, "Tạo ticket hộ khách với email chưa có tài khoản: Người gửi = tên đã nhập hoặc chính email", "Chức năng", "Trung bình", SP_UIM,
      ["Bấm 'Tạo ticket', nhập email 'khach.moi@example.com', Tên khách 'Khách Mới', Chủ đề/Nội dung", "Lặp lại với Tên khách để trống"], "khach.moi@example.com",
      "Ticket 1: Người gửi 'Khách Mới', KHÔNG có nút 'Xem người dùng' (requester.id=null); ticket 2: Người gửi hiển thị chính email. Cả hai nguồn 'admin'.")
    A(F, "Mở chi tiết ticket (T-2001): đầu trang, nút, hội thoại 4 kiểu tin, lịch sử", "Giao diện", "Cao", SP_UI + " " + SEED_AUD3,
      ["Bấm dòng T-2001", "Đọc tiêu đề dialog, badge, các nút, mục 'Hội thoại (N)', 'Trả lời', 'Lịch sử thao tác'"], "T-2001",
      "Tiêu đề 'T-2001 · Cannot log in after password reset'; badge 'Đang mở', 'Cao', 'Người dùng · Sarah Kim (sarah@sofinhub.test) · tạo ...'; nút: 'Phụ trách: Ryan Cho', 'Đã xử lý', 'Chuyển cấp trên', 'Đóng', 'Sửa', 'Xem người dùng'; 'Hội thoại (4)': Khách (câu hỏi), Nhân viên (Ryan Cho: 'Thanks for reaching out. We are looking into this and will get back to you shortly.'), Ghi chú nội bộ ('Checked the account logs: nothing abnormal on our side.', nền vàng), Khách (follow-up 'Thank you, that works now.'); 'Lịch sử thao tác' có support.ticket.reply của Ryan Cho.")
    A(F, "Chi tiết ticket đã chuyển cấp (T-2004): có tin 'Hệ thống' và không còn nút 'Chuyển cấp trên'", "Giao diện", "Trung bình", SP_UI,
      ["Mở chi tiết T-2004", "Đọc badge và hội thoại"], "T-2004",
      "Badge 'Đã chuyển cấp' (đỏ) + 'Khẩn cấp'; hội thoại có tin kiểu 'Hệ thống' 'Escalated (urgent): needs review by the payments/trust team.'; các nút: Phụ trách, Đã xử lý, Đóng, Sửa, Xem người dùng (không có 'Chuyển cấp trên').")
    A(F, "Chi tiết ticket đã xử lý/đóng: nút Mở lại, ẩn Đã xử lý/Chuyển cấp; đóng thì khóa ô trả lời", "Giao diện", "Cao", SP_UI,
      ["Mở chi tiết T-2005 (Đã xử lý)", "Đọc nút và ô 'Trả lời'", "Mở chi tiết T-2007 (Đã đóng)", "Đọc nút và vùng 'Trả lời'"], "T-2005, T-2007",
      "T-2005: có 'Mở lại' và 'Đóng', KHÔNG có 'Đã xử lý'/'Chuyển cấp trên'; ô trả lời vẫn dùng được. T-2007: có 'Mở lại', KHÔNG có 'Đóng'; vùng 'Trả lời' thay bằng 'Ticket đã đóng. Mở lại để tiếp tục phản hồi.'.")
    A(F, "Gửi phản hồi cho khách: trạng thái sau gửi, toast, email và thông báo trong app", "Chức năng", "Cao", SP_UIM,
      ["Mở chi tiết T-2002 (Mới, của alex)", "Giữ chip 'Trả lời khách' và 'Chờ phản hồi', nhập 'Chào Alex, vui lòng kiểm tra mục spam nhé' và bấm 'Gửi phản hồi'", "GET /api/dev/outbox?to=alex@sofinhub.test", "Đăng nhập alex@ xem chuông thông báo"], "T-2002, alex@",
      "Toast 'Đã gửi phản hồi tới người gửi'; hội thoại thêm tin 'Nhân viên'; trạng thái 'Chờ phản hồi'; người trả lời tự thành Phụ trách nếu chưa giao; outbox có thư tiêu đề 'Re: [T-2002] Verification email not received' nội dung có chữ ký '— <tên>, SofinHub Support' và 'Mã ticket: T-2002'; alex nhận thông báo 'Phản hồi cho yêu cầu T-2002'.", pw="Một phần")
    A(F, "Gửi phản hồi và chọn 'Đã xử lý' / 'Giữ đang mở' sau khi gửi", "Chức năng", "Cao", SP_UIM,
      ["Mở T-2010 (Đang mở), trả lời với chip 'Đã xử lý'", "Mở T-2012 (Mới), trả lời với chip 'Giữ đang mở'"], "T-2010, T-2012",
      "T-2010 -> 'Đã xử lý' (resolvedAt có giá trị); T-2012 -> 'Đang mở' (không đổi thành 'Chờ phản hồi'); cả hai ghi firstResponseAt lần đầu và audit support.ticket.reply metadata.status.")
    A(F, "Ghi chú nội bộ: chuyển chip 'Ghi chú nội bộ', nút 'Lưu ghi chú', không gửi email", "Chức năng", "Cao", SP_UIM,
      ["Mở T-2013, chọn chip 'Ghi chú nội bộ'", "Quan sát ô nhập và các chip trạng thái", "Nhập 'Đã gọi khách, hẹn 15h' > 'Lưu ghi chú'", "GET /api/dev/outbox?to=noah@sofinhub.test"], "T-2013",
      "Khi chọn ghi chú: placeholder 'Chỉ nhân viên xem được...', ẩn nhóm chip trạng thái, nút 'Lưu ghi chú'; toast 'Đã thêm ghi chú nội bộ'; hội thoại thêm tin 'Ghi chú nội bộ' nền vàng; trạng thái ticket KHÔNG đổi; không có email/thông báo cho Noah.", pw="Một phần")
    A(F, "Nút gửi bị khóa khi nội dung rỗng/chỉ khoảng trắng và hiện 'Đang gửi…' khi đang gửi", "Giao diện", "Thấp", SP_UI,
      ["Mở chi tiết một ticket mở", "Để trống ô trả lời, quan sát nút", "Gõ vài dấu cách", "Gõ nội dung và bấm gửi, quan sát nhãn nút"], "-",
      "Nút 'Gửi phản hồi' vô hiệu khi trống/khoảng trắng; khi gửi nhãn thành 'Đang gửi…' rồi trở lại; ô nhập được xóa sau khi gửi thành công; tối đa 5000 ký tự (maxLength).")
    A(F, "Sửa ticket (chủ đề, ưu tiên, nhóm) qua dialog 'Sửa ticket · T-xxxx'", "Chức năng", "Trung bình", SP_UIM,
      ["Mở chi tiết T-2012 > 'Sửa'", "Đổi Chủ đề thành 'Đề xuất nổi bật (đã sửa)', Ưu tiên 'Trung bình', Nhóm 'Người dùng'", "Bấm 'Lưu'", "Xóa trắng Chủ đề và quan sát nút Lưu"], "T-2012",
      "Toast 'Đã cập nhật ticket'; chi tiết/danh sách phản ánh chủ đề, ưu tiên, nhóm mới (ticket chuyển sang trang 'Vấn đề người dùng'); nút 'Lưu' khóa khi Chủ đề rỗng; audit support.ticket.update metadata.changes.")
    A(F, "Đóng ticket từ chi tiết: dialog 'Đóng ticket · T-xxxx' và hiệu lực", "Chức năng", "Cao", SP_UIM,
      ["Mở chi tiết T-2016 (Chờ phản hồi) > 'Đóng'", "Nhập ghi chú và bấm 'Đóng ticket'", "Thử gửi phản hồi vào ticket vừa đóng"], "T-2016",
      "Dialog 'Đóng ticket · T-2016' (mô tả 'Ticket đóng sẽ không nhận thêm phản hồi (có thể mở lại).'); toast 'Đã đóng T-2016'; badge 'Đã đóng'; vùng 'Trả lời' đổi thành thông báo đã đóng; API reply trả 409.")
    A(F, "'Xem người dùng' từ ticket dẫn tới hồ sơ admin của người gửi", "Chức năng", "Thấp", SP_UI + " Support có users.view nên mở được; Finance thì không.",
      ["Menu dòng T-2001 > 'Xem người dùng'", "Hoặc mở chi tiết và bấm 'Xem người dùng'"], "T-2001",
      "Chuyển tới /admin/users/<id Sarah Kim> hiển thị hồ sơ đúng người. Với vai trò không có users.view (vd Finance không có support.manage nên không vào được Hỗ trợ) trang đích hiện 'Không đủ quyền'.")
    A(F, "Cập nhật tức thì: thao tác ở ticket làm KPI và bảng làm mới (invalidate)", "Chức năng", "Trung bình", SP_UIM,
      ["Ghi 'Đang mở' và 'Đã xử lý (7 ngày)'", "Đánh dấu đã xử lý T-2013", "Quan sát KPI và dòng"], "T-2013",
      "Không cần F5: 'Đang mở' -1, 'Đã xử lý (7 ngày)' +1, dòng chuyển 'Đã xử lý' hoặc rời tab đang lọc.")
    A(F, "Trạng thái tải/lỗi/rỗng của bảng và dialog chi tiết (Thử lại)", "Giao diện", "Thấp", SP_UI,
      ["Chặn /api/admin/support/tickets rồi F5", "Chặn /api/admin/support/tickets/<id> rồi mở một dòng", "Bỏ chặn, bấm 'Thử lại'"], "-",
      "Bảng: 'Đang tải…' / khối lỗi + 'Thử lại'; dialog chi tiết: LoadingBlock rồi ErrorBlock + Thử lại; sau khi bỏ chặn dữ liệu hiện bình thường.", pw="Một phần")
    A(F, "Support được vào trang Hỗ trợ; Finance và Content Reviewer thấy 'Không đủ quyền'", "Bảo mật", "Cao", BASE3 + " Đăng nhập lần lượt support@ và finance@.",
      ["support@: mở /admin/support/tickets", "finance@: gõ thẳng /admin/support/tickets"], "-",
      "support@ thấy danh sách; finance@ thấy trang 'Không đủ quyền' và sidebar không có nhóm 'Hỗ trợ'.")

    # ============================================================ 5. HỖ TRỢ - API ADMIN
    F = "Hỗ trợ · API admin"
    SPA = BASE_API + " " + SEED_TICKET
    SPAM = SPA + " " + MUTATE
    A(F, "GET /admin/support/summary trả đủ trường và khớp seed", "Chức năng", "Cao", SPA,
      ["GET /api/admin/support/summary", "Đối chiếu SQL theo status/assigneeId/escalated/category"], "-",
      "200 {data:{open:16, newToday, unassigned:7, escalated:2, avgFirstResponseMin, avgFirstResponseMinChangePct, resolved7d, resolved7dChangePct, byCategory:{user:6,creator:5,payment:5}}} (open = new+open+awaiting_reply; resolved7d đếm resolvedAt trong 7 ngày).", pw="Một phần")
    A(F, "GET /admin/support/assignees trả nhân viên có support.manage đang hoạt động", "Chức năng", "Trung bình", SPA,
      ["GET /api/admin/support/assignees"], "-", "200 data gồm Ryan Cho (Support), Tom Baker (Support) và Super Admin env (role 'Super Admin'), sắp theo tên; KHÔNG có moderator/finance/nina (suspended)/john/mia; mỗi phần tử {id,name,email,role}.")
    A(F, "GET /admin/support/tickets lọc category/status/priority nhận csv, giá trị lạ trả 400", "Chức năng", "Cao", SPA,
      ["GET /support/tickets?category=payment&status=new,open", "GET /support/tickets?priority=urgent,high", "GET /support/tickets?status=bogus", "GET /support/tickets?category=xyz", "GET /support/tickets?priority=highest", "GET /support/tickets?escalated=true", "GET /support/tickets?escalated=maybe"], "-",
      "Lần 1: ticket thanh toán trạng thái new/open (T-2014, T-2015, T-2018, T-2020); lần 2: 7 ticket (2 urgent + 5 high); lần 3-5 và 7: 400 VALIDATION_ERROR (vd 'Giá trị \"bogus\" không hợp lệ cho status'); lần 6: T-2004 và T-2014.")
    A(F, "GET /admin/support/tickets lọc assignee=me|unassigned|<userId>", "Chức năng", "Cao", SPA + " Token support@ (Ryan Cho).",
      ["GET /support/tickets?assignee=me", "GET /support/tickets?assignee=unassigned", "GET /support/tickets?assignee=<id Tom Baker>", "GET /support/tickets?assignee=khong-co"], "-",
      "me: 9 ticket của Ryan; unassigned: 7 ticket; Tom: 6 ticket; id lạ: data rỗng, 200 (không lỗi).")
    A(F, "GET /admin/support/tickets: q tìm theo chủ đề/tên/email/mã T-xxxx; sort newest/oldest/updated/priority; phân trang", "Chức năng", "Cao", SPA,
      ["GET ?q=card declined", "GET ?q=T-2005", "GET ?q=t-2005", "GET ?q=sarah@sofinhub", "GET ?sort=oldest&limit=3", "GET ?sort=priority&limit=5", "GET ?sort=bogus", "GET ?limit=101", "GET ?page=0"], "-",
      "q khớp không phân biệt hoa/thường (mã nhận cả 't-2005'); sort=oldest đầu là ticket cũ nhất; sort=priority đặt urgent trước (priority giảm dần theo enum, tie-break hoạt động gần nhất); sort=bogus, limit=101, page=0 -> 400; meta {page,limit,total,totalPages}.")
    A(F, "GET /admin/support/tickets/:id nhận cả uuid lẫn mã T-xxxx và trả messages + history + related", "Chức năng", "Cao", SPA + " " + SEED_AUD3,
      ["GET /support/tickets/T-2001", "GET /support/tickets/<uuid của T-2001>", "GET /support/tickets/t-2001", "GET /support/tickets/T-9999", "GET /support/tickets/abc"], "T-2001",
      "3 lần đầu 200 cùng một ticket {code:'T-2001', messages (4 phần tử kiểu customer/staff/internal_note/customer), history (<=10 dòng audit gồm support.ticket.reply), related:{userId:<Sarah>}}; T-9999 và 'abc' -> 404 NOT_FOUND 'Không tìm thấy ticket'.")
    A(F, "POST /admin/support/tickets tạo hộ khách: 201, source=admin, liên kết user theo email; thiếu trường 400", "Chức năng", "Cao", SPAM,
      ["POST /support/tickets {subject:'QA', message:'Nội dung', category:'payment', requesterEmail:'daniel@sofinhub.test'}", "POST không có requesterEmail", "POST không có category", "POST category:'other'", "POST subject rỗng", "POST message 5001 ký tự", "POST priority:'critical'"], "daniel@sofinhub.test",
      "Lần 1: 201 data (source:'admin', priority 'medium' mặc định, requester.id = Daniel, requester.name = tên tài khoản). Lần 2: 400 (requesterEmail bắt buộc - lệch hợp đồng ghi optional); lần 3: 400 (category bắt buộc, không có mặc định); 4-7: 400 VALIDATION_ERROR.")
    A(F, "PATCH /admin/support/tickets/:id đổi priority/category/subject; body rỗng 400", "Chức năng", "Trung bình", SPAM,
      ["PATCH /support/tickets/T-2012 {priority:'high'}", "PATCH {category:'user', subject:'Đã sửa'}", "PATCH {}", "PATCH {priority:'x'}", "PATCH /support/tickets/T-9999 {priority:'low'}"], "T-2012",
      "200 phản ánh thay đổi (updatedAt/lastActivityAt mới, audit support.ticket.update); {} -> 400 'Không có gì để cập nhật'; priority lạ -> 400; ticket lạ -> 404.")
    A(F, "POST assign: về mình ('me'), người khác, bỏ gán (null); new -> open; người nhận không có quyền -> 400", "Chức năng", "Cao", SPAM + " Token support@.",
      ["POST /support/tickets/T-2002/assign {assigneeId:'me'}", "POST .../assign {assigneeId:<id Tom>}", "POST .../assign {assigneeId:null}", "POST .../assign {assigneeId:<id moderator@>}", "POST .../assign {assigneeId:<id member1@>}", "POST .../assign {} "], "T-2002",
      "Lần 1: assignee Ryan, status new -> open, thêm tin hệ thống 'Đã giao cho Ryan Cho'; lần 2: Tom; lần 3: assignee null + tin 'Đã bỏ giao việc' (status giữ nguyên open); lần 4-5: 400 'Người nhận phải là nhân viên có quyền xử lý hỗ trợ'; lần 6: 400 (thiếu assigneeId).")
    A(F, "POST assign trên ticket đã đóng trả 409", "Chức năng", "Thấp", SPAM,
      ["POST /support/tickets/T-2007/assign {assigneeId:'me'} (T-2007 đã đóng)"], "T-2007", "409 CONFLICT 'Ticket đã đóng'.")
    A(F, "POST reply: mặc định awaiting_reply, ghi firstResponseAt lần đầu, tự gán người trả lời, gửi email + thông báo", "Chức năng", "Cao", SPAM + " Token support@.",
      ["POST /support/tickets/T-2006/reply {body:'Chúng tôi sẽ xử lý yêu cầu xóa dữ liệu.'}", "GET /api/dev/outbox?to=ethan@sofinhub.test", "Đăng nhập ethan@ xem thông báo", "SQL firstResponseAt, assigneeId của T-2006"], "T-2006 (ethan, Mới, chưa giao)",
      "200 status 'awaiting_reply', messages có tin 'staff'; firstResponseAt ≈ now (chỉ lần đầu), assignee = Ryan Cho; outbox có thư 'Re: [T-2006] Delete my account and data'; Ethan có thông báo 'Phản hồi cho yêu cầu T-2006' (trích 140 ký tự); audit support.ticket.reply metadata.status.", pw="Một phần")
    A(F, "POST reply với status resolved/open và status không hợp lệ", "Chức năng", "Cao", SPAM,
      ["POST /support/tickets/T-2020/reply {body:'Đã sửa biên lai', status:'resolved'}", "POST /support/tickets/T-2015/reply {body:'Đang kiểm tra', status:'open'}", "POST .../reply {body:'x', status:'closed'}", "POST .../reply {body:'x', status:'new'}"], "T-2020, T-2015",
      "Lần 1: status resolved + resolvedAt; lần 2: status open; lần 3-4: 400 VALIDATION_ERROR (chỉ nhận awaiting_reply|resolved|open; muốn đóng dùng /close).")
    A(F, "POST reply validate: body rỗng, quá 5000 ký tự; ticket đã đóng trả 409", "Chức năng", "Cao", SPAM,
      ["POST /support/tickets/T-2012/reply {body:''}", "POST {body:'<5001 ký tự>'}", "POST /support/tickets/T-2007/reply {body:'x'} (đã đóng)", "POST /support/tickets/T-9999/reply {body:'x'}"], "-",
      "Lần 1: 400 'Vui lòng nhập nội dung'; lần 2: 400 'Nội dung tối đa 5000 ký tự'; lần 3: 409 'Ticket đã đóng, hãy mở lại trước khi trả lời'; lần 4: 404.")
    A(F, "Reply vào ticket đã resolved làm resolvedAt bị xóa (mở lại ngầm) khi dùng trạng thái mặc định", "Chức năng", "Thấp", SPAM,
      ["POST /support/tickets/T-2005/reply {body:'Cần thêm thông tin'} (T-2005 đã xử lý)", "GET /support/tickets/T-2005"], "T-2005",
      "status chuyển 'awaiting_reply' và resolvedAt = null (không cần gọi /reopen). Ghi nhận hành vi: trả lời mặc định sẽ mở lại ticket đã xử lý.")
    A(F, "POST note: thêm ghi chú nội bộ (≤2000 ký tự), khách không thấy, không đổi trạng thái", "Chức năng", "Cao", SPAM,
      ["POST /support/tickets/T-2009/note {body:'Hẹn gọi lại'}", "POST {body:''}", "POST {body:'<2001 ký tự>'}", "GET ticket bằng token sarah@ (người gửi) qua /api/support/tickets/T-2009"], "T-2009",
      "Lần 1: 200 messages có kind='internal_note'; lần 2: 400 'Vui lòng nhập ghi chú'; lần 3: 400; Sarah KHÔNG thấy ghi chú trong /api/support/tickets/T-2009 và messageCount không tính ghi chú.")
    A(F, "POST escalate: nâng ưu tiên, escalated=true, tin hệ thống; lần 2 trả 409; ticket đã giải quyết trả 409", "Chức năng", "Cao", SPAM,
      ["POST /support/tickets/T-2012/escalate {reason:'VIP'} (Mới)", "POST lại cùng ticket", "POST /support/tickets/T-2005/escalate {reason:'x'} (đã xử lý)", "POST /support/tickets/T-2013/escalate {reason:'x', priority:'high'}", "POST /support/tickets/T-2018/escalate {} ", "POST .../escalate {reason:'x', priority:'extreme'}"], "T-2012, T-2013",
      "Lần 1: escalated=true, priority 'urgent' (mặc định), status new -> open, tin hệ thống 'Escalated (urgent): VIP'; lần 2: 409 'Ticket đã được escalate'; lần 3: 409 'Không thể escalate ticket đã giải quyết/đóng'; lần 4: priority 'high' (đặt theo giá trị gửi); lần 5: 400 'Vui lòng nhập lý do'; lần 6: 400.")
    A(F, "POST resolve/close/reopen đúng luồng trạng thái và 409 sai trạng thái", "Chức năng", "Cao", SPAM,
      ["resolve T-2013 {note:'Xong'}", "resolve T-2013 lần 2", "close T-2013", "close T-2013 lần 2", "resolve T-2013 (đã đóng)", "reopen T-2013", "reopen T-2013 lần 2", "resolve T-2012 (Mới) rồi close"], "T-2013",
      "resolve 200 (resolvedAt có); resolve lần 2: 409 'Ticket đã được giải quyết'; close từ resolved 200 (closedAt có, giữ resolvedAt); close lần 2: 409 'Ticket đã đóng'; resolve khi đã đóng: 409 'Ticket đã đóng'; reopen từ closed: 200 status open, resolvedAt/closedAt = null; reopen lần 2: 409 'Ticket đang mở'; resolve và close từ trạng thái mở được. Mỗi bước thêm tin hệ thống 'Đã giải quyết ticket: Xong'/'Đã đóng ticket'/'Đã mở lại ticket'.")
    A(F, "Mỗi thao tác ghi của Hỗ trợ tạo 1 dòng audit đúng mã action", "Chức năng", "Trung bình", SPAM,
      ["Thực hiện create, update, assign, reply, note, escalate, resolve, close, reopen trên một ticket QA", "GET /admin/audit-logs?targetType=ticket&limit=50"], "-",
      "9 dòng với action: support.ticket.create/update/assign/reply/note/escalate/resolve/close/reopen; targetType=ticket; targetLabel dạng 'T-xxxx · <80 ký tự đầu chủ đề>'; escalate có reason; resolve/close/reopen có note; có ip.")
    A(F, "Quyền support.manage: Moderator/Finance 403 ở mọi route Hỗ trợ, Support và Super Admin qua", "Bảo mật", "Cao", BASE_API + " Token moderator@, finance@, support@.",
      ["GET /admin/support/summary và POST /admin/support/tickets bằng 3 token"], "-", "support@ qua; moderator@ và finance@ 403 'Vai trò ... không có quyền \"support.manage\"'.")
    A(F, "Race: 2 nhân viên cùng giao/đóng một ticket đồng thời không làm hỏng dữ liệu", "Chức năng", "Thấp", SPAM,
      ["Song song: POST /support/tickets/T-2018/assign {assigneeId:'me'} bằng support@ và assign cho Tom bằng admin@", "Song song 2 request close cùng ticket"], "T-2018",
      "Kết quả cuối nhất quán (1 người phụ trách); 2 lệnh close: 1 request 200, 1 request 409 'Ticket đã đóng'; không có tin trùng/ghi nửa chừng.", pw="Không")

    # ============================================================ 6. PHÍA NGƯỜI DÙNG: /api/support/tickets, /api/contact
    F = "Hỗ trợ · API phía người dùng và form liên hệ"
    UT = BASE3 + " Đăng nhập sarah@sofinhub.test / Passw0rd!x lấy token (người gửi T-2001, T-2009, T-2014). " + SEED_TICKET
    UTM = UT + " " + MUTATE
    A(F, "POST /api/support/tickets tạo ticket của tôi: 201, nguồn 'user', không lộ trường nội bộ", "Chức năng", "Cao", UTM,
      ["POST /api/support/tickets {subject:'Không vào được lớp học', message:'Tôi bấm vào bài học nhưng bị khóa', category:'creator'} bằng token sarah@", "Đọc response", "Mở /admin/support/tickets bằng admin@ tìm ticket mới"], "category creator",
      "201 {data:{code:'T-20xx', subject, category:'creator', priority:'medium', status:'new', requester:{...Sarah Kim}, messageCount:1, lastMessagePreview, createdAt...}} KHÔNG có assignee/escalated/source/firstResponseAt; admin thấy ticket nguồn 'user' (cột Nhóm Creator, Mới, Chưa giao), người gửi = Sarah Kim, email = email tài khoản.")
    A(F, "POST /api/support/tickets: category mặc định 'user'; validate subject/message/category; 401 khi chưa đăng nhập", "Chức năng", "Cao", UTM,
      ["POST {subject:'A', message:'B'} (không category)", "POST {subject:'', message:'B'}", "POST {subject:'A', message:''}", "POST {subject:'A', message:'<5001 ký tự>'}", "POST {subject:'<201 ký tự>', message:'B'}", "POST {subject:'A', message:'B', category:'other'}", "POST không token"], "-",
      "Lần 1: 201 category 'user'. Lần 2: 400 'Vui lòng nhập tiêu đề'; lần 3: 400 'Vui lòng nhập nội dung'; lần 4: 400 'Nội dung tối đa 5000 ký tự'; lần 5-6: 400; lần 7: 401 UNAUTHORIZED.")
    A(F, "GET /api/support/tickets chỉ trả ticket của chính tôi, phân trang, mới cập nhật trước", "Chức năng", "Cao", UT,
      ["GET /api/support/tickets bằng token sarah@", "GET ?limit=1&page=2", "GET ?limit=51", "GET bằng token member1@ (chưa có ticket)", "GET không token"], "sarah@",
      "Sarah: 3 ticket (T-2001, T-2009, T-2014) sắp theo hoạt động gần nhất, meta {page,limit,total:3,totalPages}; limit=1&page=2 -> 1 phần tử, totalPages 3; limit=51 -> 400; member1@: data rỗng total 0; không token 401. Không có assignee/escalated/source trong từng phần tử.")
    A(F, "GET /api/support/tickets/:id: người gửi thấy hội thoại, KHÔNG thấy ghi chú nội bộ và tin hệ thống", "Bảo mật", "Cao", UT,
      ["GET /api/support/tickets/T-2001 bằng token sarah@", "GET /api/support/tickets/<uuid> cùng ticket", "Đối chiếu với GET /api/admin/support/tickets/T-2001"], "T-2001",
      "Người dùng thấy messages gồm 3 tin (customer, staff, customer) và messageCount=3; admin thấy 4 tin (thêm internal_note 'Checked the account logs: nothing abnormal on our side.'). Với T-2004 (maya@): người dùng thấy 2 tin, tin hệ thống 'Escalated (urgent)...' và ghi chú nội bộ KHÔNG lộ; lastMessagePreview không lấy từ ghi chú.")
    A(F, "Người dùng không xem/trả lời được ticket của người khác (404, không lộ tồn tại)", "Bảo mật", "Cao", UT,
      ["Bằng token member1@: GET /api/support/tickets/T-2001", "POST /api/support/tickets/T-2001/reply {body:'x'}", "GET /api/support/tickets/T-9999", "Bằng token sarah@: GET /api/support/tickets/T-2002 (của alex)"], "member1@, sarah@",
      "Mọi lệnh 404 NOT_FOUND 'Không tìm thấy ticket' (cùng thông điệp cho ticket không tồn tại và ticket của người khác); không 403 để tránh lộ.")
    A(F, "POST /api/support/tickets/:id/reply: thêm tin khách, mở lại ticket đang chờ/đã xử lý", "Chức năng", "Cao", UTM,
      ["Bằng token daniel@: POST /api/support/tickets/T-2003/reply {body:'Email cũ của tôi: abc@x.com'} (T-2003 Chờ phản hồi)", "GET ticket bằng admin@", "Bằng token liam@: reply T-2005 (Đã xử lý)", "Bằng token alex@: reply T-2002 (Mới)"], "T-2003, T-2005, T-2002",
      "T-2003: tin 'customer' mới, status -> 'open'; T-2005 (resolved) -> 'open' và resolvedAt = null; T-2002 (Mới) giữ 'new'. lastActivityAt mới nên ticket nổi lên đầu danh sách admin.")
    A(F, "Người dùng trả lời ticket đã đóng nhận 409 'Yêu cầu đã đóng'; body rỗng/quá dài 400", "Chức năng", "Trung bình", UT,
      ["Bằng token noah@: POST /api/support/tickets/T-2007/reply {body:'x'} (đã đóng)", "POST ... {body:''}", "POST ... {body:'<5001 ký tự>'} trên ticket mở của noah (T-2013)"], "T-2007, T-2013",
      "Lần 1: 409 CONFLICT 'Yêu cầu đã đóng'; lần 2: 400 'Vui lòng nhập nội dung'; lần 3: 400 'Nội dung tối đa 5000 ký tự'.")
    A(F, "Phản hồi của nhân viên hiện cho người dùng, email trả lời nằm trong outbox", "Chức năng", "Cao", UTM + " Hai tab: admin@ và sarah@.",
      ["admin@ trả lời T-2001 'Đã áp dụng bản sửa, bạn thử lại nhé' (chờ phản hồi)", "sarah@ GET /api/support/tickets/T-2001", "GET /api/dev/outbox?to=sarah@sofinhub.test"], "T-2001",
      "Sarah thấy tin 'staff' mới (tên người gửi 'Platform Admin' hoặc tên admin) trong hội thoại; outbox có 'Re: [T-2001] Cannot log in after password reset'; Sarah có thông báo hệ thống 'Phản hồi cho yêu cầu T-2001'. Không có kênh trả lời bằng email (chưa nhận mail về).", pw="Một phần")
    A(F, "POST /api/contact (khách chưa đăng nhập): 202 và tạo ticket nguồn contact_form", "Chức năng", "Cao", BASE3 + " Chưa đăng nhập. " + MUTATE,
      ["POST /api/contact {name:'Khách QA', email:'khach.qa@example.com', subject:'Hỏi về gói', message:'Tôi muốn hỏi giá', category:'payment'} KHÔNG token", "Mở /admin/support/payment bằng admin@", "GET /api/dev/outbox?to=<supportEmail>"], "khach.qa@example.com",
      "202 {data:{message:'Chúng tôi đã nhận được tin nhắn và sẽ phản hồi sớm.'}}; ticket mới nguồn 'contact_form', nhóm Thanh toán, Người gửi 'Khách QA' (không gắn tài khoản: requester.id=null, không có 'Xem người dùng'); outbox có thư '[Liên hệ] Hỏi về gói' gửi tới email hỗ trợ (mặc định support@sofinhub.com hoặc giá trị Cài đặt chung) với nội dung 'Từ: Khách QA <khach.qa@example.com>'.", pw="Một phần")
    A(F, "POST /api/contact liên kết tài khoản khi email khớp người dùng", "Chức năng", "Trung bình", BASE3 + " " + MUTATE,
      ["POST /api/contact {name:'Alex', email:'ALEX@SOFINHUB.TEST', subject:'Liên hệ', message:'Hi'} (email viết hoa)", "Mở ticket mới ở /admin/support/tickets"], "ALEX@SOFINHUB.TEST",
      "Email được chuẩn hóa chữ thường; ticket gắn requester = Alex Rivera (có nút 'Xem người dùng'); category mặc định 'user'.")
    A(F, "POST /api/contact validate và giới hạn tốc độ 5 lần/khoảng", "Bảo mật", "Trung bình", BASE3 + " Chờ hết cửa sổ rate-limit trước khi chạy (restart BE).",
      ["POST /api/contact thiếu name", "email sai định dạng", "subject rỗng", "message 5001 ký tự", "category:'x'", "Gửi liên tiếp 6 yêu cầu hợp lệ"], "-",
      "400 với thông điệp 'Vui lòng nhập họ tên' / 'Email không hợp lệ' / 'Vui lòng nhập tiêu đề' / 'Nội dung tối đa 5000 ký tự' / lỗi enum category; sau 5 yêu cầu trong cửa sổ, yêu cầu thứ 6 -> 429 TOO_MANY_REQUESTS (limiter(5)).", pw="Một phần")
    A(F, "Email '[Liên hệ]' gửi tới email hỗ trợ lấy từ Cài đặt chung (đổi được không cần restart)", "Chức năng", "Trung bình", APIM + " " + PENDING_DECISION + " email hỗ trợ cấu hình.",
      ["PATCH /admin/system/settings {platform:{supportEmail:'ho-tro-qa@example.com'}}", "POST /api/contact hợp lệ", "GET /api/dev/outbox?to=ho-tro-qa@example.com", "POST /admin/system/settings/reset {keys:['platform.supportEmail']}"], "ho-tro-qa@example.com",
      "Thư '[Liên hệ] ...' nằm ở outbox của ho-tro-qa@example.com (cache cấu hình cập nhật ngay trong cùng tiến trình; nhiều instance lệch tối đa 10 giây); sau reset quay về email mặc định.", pw="Một phần")
    A(F, "Trang web người dùng hiện chưa có form liên hệ/ticket nối với /api/contact và /api/support/tickets", "Chức năng", "Trung bình", "Frontend người dùng (không phải /admin).",
      ["Mở trang chủ, footer, tìm liên kết 'Liên hệ'/'Hỗ trợ'/'Ticket của tôi'", "Đăng nhập member1@ tìm mục 'Ticket của tôi' trong menu hồ sơ"], "-",
      "KỲ VỌNG SAU KHI LÀM: form liên hệ và màn 'Ticket của tôi' (danh sách, chi tiết, trả lời). HIỆN TẠI: chưa có màn 'Ticket của tôi' (ngoài phạm vi khu Admin); chỉ API đã sẵn - xem frontend/ADMIN_BACKEND_GAPS.md.", st=PLAN, pw="Không")

    # ============================================================ 7. HỆ THỐNG - TÀI KHOẢN QUẢN TRỊ
    SYS_UI = BASE_UI + " " + SEED_STAFF
    SYS_UIM = SYS_UI + " " + MUTATE
    SYS_API = BASE_API + " " + SEED_STAFF
    SYS_APIM = SYS_API + " " + MUTATE
    F = "Hệ thống · Tài khoản quản trị (UI)"
    A(F, "Trang 'Tài khoản quản trị': tiêu đề, nút, cột và 8 dòng seed", "Giao diện", "Cao", SYS_UI,
      ["Mở /admin/system/admins", "Đọc tiêu đề, nút, tiêu đề cột và danh sách"], "-",
      "Tiêu đề 'Tài khoản quản trị', phụ đề 'Những người có quyền truy cập trang quản trị.', nút 'Tạo quản trị viên'; cột Quản trị viên (tên + email), Vai trò, 2FA, Đăng nhập gần nhất, Trạng thái; 8 dòng: Platform Admin (env, đứng đầu), Grace Lee (Tài chính), Moderator Test, Nina Ross (Tạm ngưng), Ryan Cho, Tom Baker (2FA tắt), John Carter, Mia Lopez (sắp tên trong nhóm nhân viên).")
    A(F, "Dòng Super Admin env: vai trò, 2FA tắt, mọi hành động khóa", "Giao diện", "Cao", SYS_UI,
      ["Tìm dòng admin@sofinhub.test", "Mở menu thao tác của dòng", "Bấm vào dòng mở chi tiết"], "admin@sofinhub.test",
      "Badge vai trò 'Super Admin' (cam); 2FA = biểu tượng xám (luôn false cho tài khoản env); menu: 'Đổi vai trò', 'Tạm ngưng', 'Gỡ quyền quản trị' bị vô hiệu (disabled); 'Đặt lại 2FA' vẫn bấm được nhưng khi xác nhận API trả 409 hiện trong dialog; chi tiết ghi 'Nguồn: Cấu hình hệ thống (Super Admin gốc)' và dòng chú thích 'Tài khoản này được khóa...'.")
    A(F, "Dòng của chính mình (đăng nhập bằng nhân viên có admin.manage) cũng bị khóa", "Giao diện", "Trung bình", SYS_UIM + " Super Admin vai trò (không phải env): tạo bằng 'Tạo quản trị viên' cho owner@sofinhub.test vai trò Super Admin rồi đăng nhập owner@.",
      ["Mở /admin/system/admins", "Mở menu dòng của chính owner@", "Mở menu dòng của Tom Baker"], "owner@",
      "Dòng của owner@: 'Đổi vai trò', 'Tạm ngưng', 'Gỡ quyền quản trị' bị vô hiệu (locked=true); dòng Tom Baker các hành động dùng được.")
    A(F, "Badge vai trò dùng nhãn tiếng Việt: Kiểm duyệt viên / Hỗ trợ / Tài chính", "Giao diện", "Thấp", SYS_UI,
      ["Đọc cột Vai trò của 8 dòng"], "-",
      "Moderator -> 'Kiểm duyệt viên', Support -> 'Hỗ trợ', Finance -> 'Tài chính', Super Admin -> 'Super Admin'; vai trò tùy chỉnh dùng đúng tên BE (vd 'Content Reviewer'). Lưu ý: tên API là Moderator/Support/Finance (khác nhãn giao diện).")
    A(F, "Lọc theo Vai trò và Trạng thái, tìm theo tên/email", "Chức năng", "Cao", SYS_UI,
      ["Lọc Vai trò = 'Kiểm duyệt viên'", "Xóa, lọc Trạng thái = 'Tạm ngưng'", "Xóa, gõ 'tom' vào 'Tìm quản trị viên...'", "Gõ 'sofinhub.test' rồi 'ryan'"], "-",
      "Moderator: 4 dòng (Moderator Test, Nina Ross, John Carter, Mia Lopez); Tạm ngưng: chỉ Nina Ross; 'tom': Tom Baker; 'ryan': Ryan Cho; mỗi lần đổi bộ lọc về trang 1.")
    A(F, "Chi tiết một quản trị viên (bấm dòng): Vai trò, Nguồn, 2FA, Đăng nhập gần nhất, Tham gia, Trạng thái", "Giao diện", "Trung bình", SYS_UI,
      ["Bấm dòng Tom Baker", "Đọc các cặp khóa-giá trị", "Đóng và bấm dòng Nina Ross"], "Tom Baker, Nina Ross",
      "Tom: Vai trò 'Hỗ trợ', Nguồn 'Nhân viên được cấp quyền', 2FA 'Chưa bật', Đăng nhập gần nhất ~30 giờ trước (ngày giờ), Trạng thái 'Hoạt động'. Nina: Trạng thái 'Tạm ngưng', không có chú thích khóa.")
    A(F, "Tạo quản trị viên từ tài khoản có sẵn: cấp vai trò, toast, xuất hiện trong danh sách", "Chức năng", "Cao", SYS_UIM,
      ["Bấm 'Tạo quản trị viên'", "Nhập email 'member2@sofinhub.test', chọn vai trò 'Hỗ trợ', giữ tích 2FA", "Bấm 'Gửi lời mời'", "Đăng nhập member2@ mở /admin"], "member2@sofinhub.test",
      "Dialog có Email công việc, Tên/Họ, chip vai trò (mặc định Kiểm duyệt viên), tích 'Bắt buộc 2FA ở lần đầu đăng nhập'; nút khóa tới khi email hợp lệ; toast 'Đã gửi lời mời quản trị viên'; dòng mới 'Mai Member2' vai trò Hỗ trợ 2FA bật 'Chưa đăng nhập'(hoặc thời gian); member2@ vào được /admin với sidebar của Support. KHÔNG có email mời (tài khoản đã tồn tại, chỉ cấp vai trò).")
    A(F, "Tạo quản trị viên mới từ email chưa có tài khoản: tạo user + gửi email đặt mật khẩu", "Chức năng", "Cao", SYS_UIM,
      ["Bấm 'Tạo quản trị viên'", "Email 'nhan.vien.moi@example.com', Tên 'Nhân', Họ 'Viên', vai trò 'Tài chính'", "Bấm 'Gửi lời mời'", "GET /api/dev/outbox?to=nhan.vien.moi@example.com", "Mở link đặt lại mật khẩu trong thư, đặt mật khẩu, đăng nhập, mở /admin"], "nhan.vien.moi@example.com",
      "Toast thành công, dòng 'Nhân Viên' vai trò Tài chính; outbox có thư đặt lại mật khẩu (dùng mẫu reset_password nếu đang 'Đang dùng'); sau khi đặt mật khẩu đăng nhập được và thấy sidebar của Finance (Tổng quan, Thanh toán, Phân tích). Mật khẩu ban đầu là chuỗi ngẫu nhiên không ai biết.", pw="Một phần")
    A(F, "Tạo quản trị viên email chưa có tài khoản mà thiếu Tên: API 400, giao diện hiện lỗi trong dialog", "Chức năng", "Trung bình", SYS_UI,
      ["Bấm 'Tạo quản trị viên'", "Email 'khong.ten@example.com', để trống Tên, chọn vai trò, bấm 'Gửi lời mời'"], "khong.ten@example.com",
      "Dialog không đóng; hiện lỗi 'Email chưa có tài khoản: vui lòng nhập tên (firstName) để tạo tài khoản mời'; không tạo user.")
    A(F, "Tạo quản trị viên trùng: email đã là nhân viên hoặc là Super Admin env trả lỗi 409", "Chức năng", "Trung bình", SYS_UI,
      ["Bấm 'Tạo quản trị viên', email 'support@sofinhub.test' > 'Gửi lời mời'", "Lặp lại với 'admin@sofinhub.test'"], "support@, admin@",
      "Cả hai: dialog hiện lỗi 'Người này đã là nhân viên admin' (409), không đổi dữ liệu.")
    A(F, "Dialog Tạo quản trị viên: kiểm tra email sai định dạng", "Giao diện", "Thấp", SYS_UI,
      ["Bấm 'Tạo quản trị viên'", "Nhập 'abc' / 'abc@' / 'a@b' rồi 'a@b.co'", "Quan sát nút 'Gửi lời mời'"], "abc / a@b.co", "Nút khóa với 3 giá trị đầu, mở với 'a@b.co' (regex \\S+@\\S+\\.\\S+).")
    A(F, "Đổi vai trò nhân viên: dialog, nút 'Lưu vai trò' khóa khi chưa đổi, hiệu lực ngay", "Chức năng", "Cao", SYS_UIM,
      ["Menu dòng Tom Baker > 'Đổi vai trò'", "Quan sát nút 'Lưu vai trò' khi vai trò còn là Hỗ trợ", "Chọn 'Tài chính' > 'Lưu vai trò'", "Trình duyệt khác: tom@ đang mở /admin, F5"], "tom@",
      "Toast 'Đã cập nhật vai trò · Tom Baker'; dòng đổi sang 'Tài chính'; sau F5, tom@ mất nhóm Hỗ trợ và có nhóm Thanh toán/Phân tích; audit admin.update (metadata.from='support', changes.roleKey='finance').", pw="Một phần")
    A(F, "Đặt lại 2FA: dialog, tắt cờ 2FA, gửi email thông báo (2FA là cờ lưu trữ)", "Chức năng", "Trung bình", SYS_UIM,
      ["Menu dòng Ryan Cho > 'Đặt lại 2FA'", "Bấm 'Đặt lại 2FA'", "GET /api/dev/outbox?to=support@sofinhub.test"], "support@",
      "Toast 'Đã đặt lại 2FA · Ryan Cho'; cột 2FA đổi sang biểu tượng xám; outbox có thư 'Xác thực 2 bước của bạn đã được đặt lại'; audit admin.reset_2fa. Ghi nhận: chưa có 2FA thật nên không có hiệu lực đăng nhập.", pw="Một phần")
    A(F, "Tạm ngưng nhân viên: dialog có lý do tùy chọn, trạng thái đổi, người đó bị chặn /admin", "Chức năng", "Cao", SYS_UIM,
      ["Menu dòng Moderator Test > 'Tạm ngưng'", "Nhập lý do 'QA' > 'Tạm ngưng'", "Trình duyệt khác: moderator@ F5 /admin"], "moderator@",
      "Toast 'Đã tạm ngưng Moderator Test'; badge 'Tạm ngưng' (đỏ); menu dòng đổi 'Tạm ngưng' thành 'Kích hoạt lại'; moderator@ nhận 403 'Tài khoản admin của bạn đã bị tạm khóa'; audit admin.suspend có reason 'QA'.", pw="Một phần")
    A(F, "Kích hoạt lại nhân viên đã tạm ngưng (Nina Ross)", "Chức năng", "Cao", SYS_UIM,
      ["Menu dòng Nina Ross > 'Kích hoạt lại'", "Đăng nhập nina@ mở /admin"], "nina@",
      "Toast 'Đã kích hoạt lại Nina Ross' (không cần dialog); badge 'Hoạt động'; nina@ vào được /admin với sidebar của Moderator; audit admin.enable.")
    A(F, "Gỡ quyền quản trị: dialog, người dùng vẫn còn tài khoản thành viên", "Chức năng", "Cao", SYS_UIM,
      ["Menu dòng Mia Lopez > 'Gỡ quyền quản trị'", "Bấm 'Gỡ quyền'", "Đăng nhập mia.lopez@ ở trang thường và thử /admin"], "mia.lopez@",
      "Dialog 'Gỡ quyền quản trị · Mia Lopez' (mô tả 'Người này vẫn giữ tài khoản thành viên...'); toast 'Đã gỡ quyền của Mia Lopez'; dòng biến mất; mia vẫn đăng nhập thường nhưng /admin trả 403 'Chỉ nhân viên admin mới có quyền này'; số thành viên vai trò Moderator -1; audit admin.remove.")
    A(F, "Lỗi từ API hiện trong dialog khi thao tác dòng đã đổi ở tab khác (409)", "Chức năng", "Thấp", SYS_UIM,
      ["Mở trang ở 2 tab; tab 1 tạm ngưng Tom Baker", "Tab 2 (chưa tải lại): menu Tom > 'Tạm ngưng' > xác nhận"], "tom@", "Tab 2 hiện lỗi 'Tài khoản đã bị tạm khóa' (409) trong dialog, dữ liệu không đổi, không toast thành công.", pw="Một phần")

    F = "Hệ thống · Tài khoản quản trị (API)"
    A(F, "GET /admin/system/admins: danh sách có Super Admin env (locked), lọc role/status/q, phân trang", "Chức năng", "Cao", SYS_API,
      ["GET /system/admins", "GET ?role=moderator", "GET ?status=suspended", "GET ?q=tom", "GET ?limit=3&page=2", "GET ?status=bogus", "GET ?limit=101"], "-",
      "Lần 1: 8 phần tử, phần tử đầu source='env', locked=true, role {key:'super_admin'}, twoFactorEnabled=false; mỗi AdminAccount có {id,userId,name,email,avatarUrl,role,twoFactorEnabled,lastLoginAt,status,source,locked,createdAt}; moderator: 4; suspended: Nina; q=tom: Tom Baker; phân trang đúng meta; status=bogus và limit=101 -> 400.")
    A(F, "POST /admin/system/admins từ tài khoản có sẵn: 201, 409 đã là nhân viên, 400 vai trò lạ/body sai", "Chức năng", "Cao", SYS_APIM,
      ["POST /system/admins {email:'member3@sofinhub.test', roleKey:'support', twoFactorEnabled:true}", "Lặp lại cùng email", "POST {email:'member1@sofinhub.test', roleKey:'khong_co'}", "POST {email:'khong-phai-email', roleKey:'support'}", "POST {email:'member1@sofinhub.test'} (thiếu roleKey)", "POST {email:'member1@sofinhub.test', roleKey:'SUPPORT!'}"], "member3@",
      "Lần 1: 201 (role {key:'support',name:'Support'}, twoFactorEnabled true, locked false, source 'staff'); lần 2: 409 'Người này đã là nhân viên admin'; lần 3: 400 'Vai trò \"khong_co\" không tồn tại'; 4-6: 400 VALIDATION_ERROR (email không hợp lệ / thiếu roleKey / khóa vai trò sai định dạng); audit admin.create metadata {roleKey, invited:false}.")
    A(F, "POST /admin/system/admins email mới: cần firstName, tạo user, gửi email đặt mật khẩu; user đã xóa 400", "Chức năng", "Cao", SYS_APIM,
      ["POST /system/admins {email:'moi1@example.com', roleKey:'moderator'} (thiếu firstName)", "POST {email:'moi1@example.com', roleKey:'moderator', firstName:'Moi'}", "GET /api/dev/outbox?to=moi1@example.com", "POST với email của tài khoản đã xóa (deletedAt)"], "moi1@example.com",
      "Lần 1: 400 'Email chưa có tài khoản: vui lòng nhập tên (firstName) để tạo tài khoản mời'; lần 2: 201, audit metadata.invited=true, user mới có mật khẩu ngẫu nhiên; outbox có thư đặt lại mật khẩu; lần 4: 400 'Tài khoản này đã bị xóa'.", pw="Một phần")
    A(F, "POST /admin/system/admins có thể gán vai trò super_admin (không bị chặn như admin.manage ở vai trò khác)", "Bảo mật", "Trung bình", SYS_APIM,
      ["POST /system/admins {email:'member2@sofinhub.test', roleKey:'super_admin'}", "GET /admin/me bằng token member2@"], "member2@",
      "201 và member2@ có đủ 16 quyền (source 'staff'). Ghi nhận: Super Admin tạo được Super Admin khác; kiểm soát chỉ ở quyền admin.manage.")
    A(F, "PATCH /admin/system/admins/:id đổi roleKey/twoFactorEnabled; body rỗng, vai trò lạ, id lạ", "Chức năng", "Cao", SYS_APIM,
      ["PATCH /system/admins/<id tom> {roleKey:'finance'}", "PATCH {twoFactorEnabled:true}", "PATCH {}", "PATCH {roleKey:'khong_co'}", "PATCH /system/admins/khong-co {roleKey:'finance'}", "PATCH /system/admins/<id member1 (không phải nhân viên)> {roleKey:'finance'}"], "tom@",
      "Lần 1: 200 role Finance; lần 2: 200 twoFactorEnabled true; lần 3: 400 'Không có gì để cập nhật'; lần 4: 400 'Vai trò \"khong_co\" không tồn tại'; lần 5-6: 404 'Không tìm thấy tài khoản admin'. Audit admin.update.")
    A(F, "PATCH/suspend/reset-2fa/DELETE trên Super Admin env và trên chính mình trả 409", "Bảo mật", "Cao", SYS_APIM,
      ["Bằng token admin@: PATCH /system/admins/<id admin> {roleKey:'finance'}", "POST .../suspend", "POST .../reset-2fa", "DELETE .../<id admin>", "Với Super Admin vai trò (owner@) tự gọi trên chính mình"], "admin@, owner@ (super_admin)",
      "Với tài khoản env: 409 'Tài khoản Super Admin cấu hình qua môi trường (PLATFORM_ADMIN_EMAILS) không thể thay đổi'; với tự thân (không phải env): 409 'Bạn không thể tự thay đổi tài khoản admin của chính mình'; dữ liệu không đổi.")
    A(F, "POST suspend/enable: lý do ≤500 ký tự, 409 khi đã ở trạng thái đó", "Chức năng", "Trung bình", SYS_APIM,
      ["POST /system/admins/<id tom>/suspend {reason:'QA'}", "POST suspend lần 2", "POST enable", "POST enable lần 2", "POST suspend {reason:'<501 ký tự>'}", "POST /system/admins/<id nina>/enable"], "tom@, nina@",
      "suspend 200 status 'suspended'; lần 2: 409 'Tài khoản đã bị tạm khóa'; enable 200; lần 2: 409 'Tài khoản đang hoạt động'; reason 501 ký tự -> 400; enable Nina 200. Mỗi lần 1 dòng audit admin.suspend/admin.enable (reason lưu).")
    A(F, "POST reset-2fa: tắt cờ, gửi email; DELETE gỡ quyền: {removed:true}", "Chức năng", "Trung bình", SYS_APIM + " Token admin@.",
      ["POST /system/admins/<id ryan>/reset-2fa", "GET /api/dev/outbox?to=support@sofinhub.test", "DELETE /system/admins/<id john>", "DELETE lần 2"], "support@, john.carter@",
      "reset-2fa 200 twoFactorEnabled=false; outbox có thư tiêu đề 'Xác thực 2 bước của bạn đã được đặt lại'; DELETE 200 {removed:true}; lần 2: 404 'Không tìm thấy tài khoản admin'; không xóa user.", pw="Một phần")
    A(F, "Quyền admin.manage: chỉ Super Admin gọi được mọi route /system/admins và /system/roles", "Bảo mật", "Cao", SYS_API,
      ["Bằng token moderator@, support@, finance@: GET /system/admins, POST /system/admins, GET /system/roles, POST /system/roles"], "-", "Cả 3 vai trò: 403 'Vai trò ... không có quyền \"admin.manage\"' ở 4 route.")

    # ============================================================ 8. HỆ THỐNG - VAI TRÒ & QUYỀN
    F = "Hệ thống · Vai trò & Quyền (UI)"
    A(F, "Trang 'Vai trò & Quyền': ma trận 16 quyền × 5 vai trò khớp mặc định", "Giao diện", "Cao", SYS_UI,
      ["Mở /admin/system/roles", "Đọc tiêu đề cột và 16 hàng quyền", "Đối chiếu từng ô với bảng PERMS (sheet 'Phân quyền')"], "-",
      "Tiêu đề 'Vai trò & Quyền', phụ đề 'Bấm vào ô để cấp hoặc thu hồi quyền.', nút 'Tạo vai trò'; cột: Super Admin, Kiểm duyệt viên, Hỗ trợ, Tài chính, Content Reviewer; 16 hàng (nhãn Việt + khóa mono): Super Admin có đủ 16, Kiểm duyệt viên 7, Hỗ trợ 6, Tài chính 6, Content Reviewer 3 đúng ma trận; ô được cấp tô cam có dấu tích.")
    A(F, "Cột Super Admin bị khóa: ô không bấm được", "Giao diện", "Cao", SYS_UI,
      ["Bấm một ô của cột Super Admin (vd 'Xem phân tích')", "Quan sát con trỏ/disabled"], "-", "Ô bị vô hiệu (disabled, mờ), không có yêu cầu API nào được gửi; vai trò Super Admin luôn đủ quyền.")
    A(F, "Cấp/thu hồi một ô: toast, hiệu lực ngay, ghi audit role.update", "Chức năng", "Cao", SYS_UIM,
      ["Bấm ô 'Xem phân tích' của cột Hỗ trợ (đang trống)", "Quan sát toast và spinner ô", "Trình duyệt khác: support@ mở /admin/analytics/users", "Bấm lại ô để thu hồi"], "support, analytics.view",
      "Toast 'Đã cấp \"Xem phân tích\" cho Hỗ trợ'; ô có spinner trong lúc gửi rồi chuyển cam; support@ vào được trang Phân tích (sidebar thêm nhóm Phân tích); thu hồi -> toast 'Đã thu hồi \"Xem phân tích\" cho Hỗ trợ' và trang 'Không đủ quyền'; mỗi lần 1 dòng audit role.update (metadata.before/after).", pw="Một phần")
    A(F, "Cấp admin.manage cho vai trò không phải Super Admin: giao diện chặn trước, API cũng chặn", "Bảo mật", "Cao", SYS_UIM,
      ["Bấm ô 'Quản lý quản trị viên' của cột Tài chính", "Quan sát toast và Network"], "finance, admin.manage",
      "Toast lỗi 'Quyền quản lý quản trị viên chỉ dành cho Super Admin.' và KHÔNG có request PATCH nào; (đối chứng API: PATCH role finance {permission:'admin.manage',granted:true} -> 400).")
    A(F, "Thẻ vai trò: tên, nhãn Hệ thống/Tùy chọn, mô tả, số thành viên và số quyền", "Giao diện", "Trung bình", SYS_UI,
      ["Cuộn xuống khối 'Vai trò'", "Đọc 5 thẻ"], "-",
      "5 thẻ: Super Admin (ổ khóa, 'Hệ thống', 1 thành viên · 16 quyền), Kiểm duyệt viên (Hệ thống, 4 thành viên · 7 quyền), Hỗ trợ (2 · 6), Tài chính (1 · 6), Content Reviewer ('Tùy chọn', 0 thành viên · 3 quyền, mô tả 'Chỉ xem người dùng và duyệt nội dung (vai trò tùy chỉnh mẫu).'). Super Admin không có nút Sửa/Xóa.")
    A(F, "Tạo vai trò tùy chỉnh: dialog, chip quyền (không có admin.manage), mặc định dashboard.view", "Chức năng", "Cao", SYS_UIM,
      ["Bấm 'Tạo vai trò'", "Nhập Tên 'QA Auditor', Mô tả 'Chỉ xem nhật ký'", "Bỏ chọn tất cả quyền, quan sát nút", "Chọn 'Xem bảng điều khiển' và 'Xem nhật ký hoạt động' > 'Tạo vai trò'"], "QA Auditor",
      "Dialog liệt kê 15 chip quyền (KHÔNG có 'Quản lý quản trị viên'); mặc định chọn 'Xem bảng điều khiển'; nút khóa khi tên rỗng hoặc không chọn quyền; toast 'Đã tạo vai trò'; xuất hiện cột 'QA Auditor' trong ma trận (key qa_auditor) và thẻ 'Tùy chọn' 0 thành viên · 2 quyền.")
    A(F, "Sửa tên/mô tả vai trò (kể cả vai trò hệ thống) qua nút 'Sửa'", "Chức năng", "Trung bình", SYS_UIM,
      ["Thẻ 'Content Reviewer' > 'Sửa'", "Đổi tên thành 'Content Reviewer VN' và mô tả > 'Lưu'", "Thẻ 'Hỗ trợ' > 'Sửa' đổi mô tả"], "content_reviewer",
      "Toast 'Đã cập nhật vai trò'; tên mới hiện ở ma trận và thẻ; key không đổi; nút 'Lưu' khóa khi tên rỗng; vai trò hệ thống cũng sửa được tên/mô tả (không xóa được).")
    A(F, "Xóa vai trò tùy chỉnh: chỉ khi 0 thành viên; vai trò hệ thống không có nút Xóa", "Chức năng", "Cao", SYS_UIM,
      ["Thẻ 'Content Reviewer' (0 thành viên) > 'Xóa' > xác nhận", "Tạo nhân viên gán vai trò tùy chỉnh khác rồi xem nút Xóa của vai trò đó", "Xem thẻ Hỗ trợ"], "content_reviewer",
      "Dialog 'Xóa vai trò · Content Reviewer' (cảnh báo vĩnh viễn) rồi toast 'Đã xóa vai trò'; vai trò có thành viên: nút 'Xóa' bị vô hiệu (tooltip 'Vai trò đang được dùng'); thẻ vai trò hệ thống không có nút 'Xóa'.")

    F = "Hệ thống · Vai trò & Quyền (API)"
    A(F, "GET /admin/system/roles: 16 quyền (key,label,group) và 5 vai trò với memberCount/locked/isSystem", "Chức năng", "Cao", SYS_API,
      ["GET /system/roles"], "-",
      "data.permissions 16 phần tử {key,label,group} (group General/Communities/Moderation/Users/Payments/Analytics/Support/System); data.roles thứ tự super_admin, moderator, support, finance rồi vai trò tùy chỉnh; super_admin: locked=true, memberCount=1 (env), permissions đủ 16; moderator memberCount 4; permissions xếp theo thứ tự danh mục.")
    A(F, "POST /system/roles tạo vai trò: key từ tên (bỏ dấu), 201, trùng 409, quyền lạ 400", "Chức năng", "Cao", SYS_APIM,
      ["POST /system/roles {name:'Kiểm toán nội bộ', permissions:['dashboard.view','audit.view']}", "POST lại cùng tên", "POST {name:'X1', key:'qa_x1', permissions:['khong.co']}", "POST {name:'A', permissions:[]}", "POST {name:'Tên hợp lệ', key:'Sai Khoa', permissions:[]}", "POST {name:'Rỗng quyền', permissions:[]}"], "Kiểm toán nội bộ",
      "Lần 1: 201 key 'kiem_toan_noi_bo', isSystem=false, permissions ['dashboard.view','audit.view']; lần 2: 409 'Khóa vai trò đã tồn tại'; lần 3: 400 'Khóa quyền \"khong.co\" không hợp lệ'; lần 4: 400 'Tên vai trò tối thiểu 2 ký tự'; lần 5: 400 (khóa sai định dạng); lần 6: 201 với 0 quyền (API cho phép, giao diện thì bắt buộc ≥ 1) -> nhân viên gán vai trò này chỉ gọi được /admin/me.")
    A(F, "PATCH /system/roles/:key: đổi tên/mô tả, thay cả tập quyền, bật/tắt một ô; ràng buộc cặp permission/granted", "Chức năng", "Cao", SYS_APIM,
      ["PATCH /system/roles/content_reviewer {name:'CR', description:'mô tả'}", "PATCH {permissions:['dashboard.view']}", "PATCH {permission:'users.view', granted:true}", "PATCH {permission:'users.view'}", "PATCH {granted:true}", "PATCH {}", "PATCH {permission:'khong.co', granted:true}", "PATCH /system/roles/khong-co {name:'ABC'}"], "content_reviewer",
      "Lần 1: 200 đổi tên/mô tả; lần 2: thay cả tập (chỉ còn dashboard.view); lần 3: thêm users.view (giữ thứ tự danh mục); lần 4-5: 400 '`permission` và `granted` phải đi cùng nhau'; lần 6: 400 'Không có gì để cập nhật'; lần 7: 400 'Khóa quyền \"khong.co\" không hợp lệ'; lần 8: 404 'Không tìm thấy vai trò'. Audit role.update {before, after}.")
    A(F, "Không sửa được super_admin; không gán admin.manage cho vai trò khác (3 cách)", "Bảo mật", "Cao", SYS_APIM,
      ["PATCH /system/roles/super_admin {permission:'users.view', granted:false}", "PATCH /system/roles/super_admin {name:'X'}", "PATCH /system/roles/moderator {permissions:['admin.manage']}", "POST /system/roles {name:'Leo thang', permissions:['admin.manage']}"], "super_admin",
      "Lần 1-2: 409 'Vai trò Super Admin luôn đủ quyền và không thể chỉnh sửa'; lần 3-4: 400 'Quyền \"admin.manage\" chỉ dành riêng cho Super Admin'.")
    A(F, "DELETE /system/roles/:key: vai trò hệ thống 409, đang dùng 409, tùy chỉnh không dùng 200", "Chức năng", "Cao", SYS_APIM,
      ["DELETE /system/roles/moderator", "Tạo vai trò QA, gán cho member1@ (POST /system/admins), DELETE vai trò QA", "Đổi vai trò member1@ sang support rồi DELETE vai trò QA", "DELETE lần 2", "DELETE /system/roles/khong-co"], "qa role",
      "Lần 1: 409 'Không thể xóa vai trò hệ thống'; lần 2: 409 'Vai trò đang được gán cho nhân viên, hãy đổi vai trò của họ trước'; lần 3: 200 {deleted:true}; lần 4 và 5: 404 'Không tìm thấy vai trò'; audit role.delete.")
    A(F, "Vai trò tùy chỉnh gán cho nhân viên: ma trận quyền mới có hiệu lực ngay trên /admin/*", "Chức năng", "Cao", SYS_APIM,
      ["Tạo vai trò 'QA Auditor' {permissions:['dashboard.view','audit.view']}", "Gán cho member1@ (POST /system/admins)", "Bằng token member1@: GET /admin/audit-logs, GET /admin/users, GET /admin/dashboard", "PATCH vai trò thêm users.view, gọi lại GET /admin/users"], "qa_auditor",
      "audit-logs 200, dashboard 200, users 403; sau khi thêm users.view -> 200 ngay (không đăng nhập lại).")
    A(F, "Vai trò không có dashboard.view: /admin hiện 'Không đủ quyền' và sidebar rỗng nhóm", "Giao diện", "Thấp", SYS_UIM + " Vai trò tùy chỉnh chỉ có users.view (tạo ở case trước), gán cho member1@, đăng nhập member1@.",
      ["Mở /admin", "Mở /admin/users"], "-", "Tại /admin (cần dashboard.view): 'Không đủ quyền'; sidebar chỉ có nhóm 'Người dùng'; /admin/users hiển thị bình thường.", pw="Một phần")

    # ============================================================ 9. HỆ THỐNG - DANH MỤC (parity Discovery)
    F = "Hệ thống · Danh mục (dùng chung với Khám phá)"
    A(F, "Trang Hệ thống > Danh mục hiển thị cùng dữ liệu với Khám phá > Danh mục", "Chức năng", "Cao", UI + " Danh mục seed: 8 khóa active; marketing/design chưa có (phải 'Thêm').",
      ["Mở /admin/system/categories, ghi danh sách + số cộng đồng", "Mở /admin/discovery/categories, so sánh"], "-",
      "Hai trang cùng danh sách, thứ tự, trạng thái bật/tắt và số cộng đồng (cùng bảng DiscoveryCategory); trang Hệ thống dùng editor của Khám phá (prop base='/system/categories').")
    A(F, "Sửa/di chuyển/sắp xếp danh mục ở trang Hệ thống phản ánh sang Khám phá và /categories công khai", "Chức năng", "Cao", UIM,
      ["Ở /admin/system/categories tắt danh mục 'Health' (hoặc đổi nhãn)", "Dùng mũi tên lên/xuống đổi thứ tự một danh mục", "Mở /admin/discovery/categories", "GET /api/categories khi chưa đăng nhập"], "health",
      "Khám phá thấy cùng thay đổi; /api/categories ẩn danh mục đã tắt và theo thứ tự mới; audit category.* tương ứng.")
    A(F, "API /admin/system/categories* = bí danh của /admin/discovery/categories* (list/create/patch/reorder/move) kèm communities và slug", "Chức năng", "Cao", APIM,
      ["GET /system/categories và GET /discovery/categories, so sánh", "POST /system/categories {key:'marketing', label:'Marketing'}", "PATCH /system/categories/marketing {label:'Tiếp thị'}", "POST /system/categories/reorder {keys:[...]}", "POST /system/categories/marketing/move {direction:'up'}", "GET lại cả 2 đường dẫn"], "marketing",
      "Hai GET giống nhau; mỗi mục có communities (số cộng đồng) và slug; POST 201; PATCH/reorder/move 200; kết quả giống nhau ở cả 2 đường dẫn (cùng dữ liệu).")
    A(F, "Quyền community.manage cho Danh mục: Moderator được, Support/Finance 403", "Bảo mật", "Trung bình", BASE3 + " Token moderator@, support@, finance@.",
      ["GET /admin/system/categories bằng 3 token"], "-", "moderator@ 200; support@ và finance@ 403 'không có quyền \"community.manage\"'. Sidebar Moderator có nhóm 'Hệ thống' chỉ chứa mục 'Danh mục'.")

    # ============================================================ 10. HỆ THỐNG - FEATURE FLAGS
    F = "Hệ thống · Tính năng thử nghiệm (UI)"
    SYS_FUI = SYS_UI + " " + SEED_FLAG
    A(F, "Trang 'Tính năng thử nghiệm': 6 cờ seed với giai đoạn, % và công tắc", "Giao diện", "Cao", SYS_FUI,
      ["Mở /admin/system/flags", "Đọc 6 dòng và các cột"], "-",
      "Tiêu đề 'Tính năng thử nghiệm', phụ đề 'Bật hoặc tắt tính năng trên toàn nền tảng.', nút 'Thêm tính năng'; cột Tính năng (tên + khóa), Mô tả, Triển khai, Cập nhật, Bật. dm_v2 'Direct messages v2': badge 'Thử nghiệm' + '50%', BẬT; premium_lock/ai_moderation/leaderboard_v2 'Đang chạy' BẬT (không hiện %); app_banner 'Thử nghiệm' TẮT; native_live 'Bản nháp' + '0%' TẮT.")
    A(F, "Tìm cờ theo tên/khóa và lọc theo Giai đoạn", "Chức năng", "Trung bình", SYS_FUI,
      ["Gõ 'dm' vào 'Tìm tính năng...'", "Xóa, lọc Giai đoạn = 'Đang chạy'", "Lọc 'Bản nháp'"], "dm / Đang chạy / Bản nháp",
      "'dm': dm_v2; Đang chạy: 3 cờ (premium_lock, ai_moderation, leaderboard_v2); Bản nháp: native_live; 'Xóa bộ lọc' khôi phục 6 dòng.")
    A(F, "Bật/tắt cờ bằng công tắc: toast, giữ trạng thái khi đang gửi, hiệu lực ở /api/feature-flags", "Chức năng", "Cao", SYS_FUI + " " + MUTATE,
      ["Bật công tắc 'Bật/tắt Mobile app banner'", "Quan sát toast và công tắc (disabled khi đang gửi)", "GET /api/feature-flags", "Tắt lại"], "app_banner",
      "Toast 'Đã bật \"Mobile app banner\"'; sau đó GET /api/feature-flags có app_banner:true (rollout 100); tắt -> toast 'Đã tắt ...' và false; audit flag.enable / flag.disable.")
    A(F, "Thêm cờ mới: khóa tự đổi chữ thường, mặc định TẮT, validate tên/khóa/%", "Chức năng", "Cao", SYS_FUI + " " + MUTATE,
      ["Bấm 'Thêm tính năng'", "Gõ khóa 'QA_Flag_1' (quan sát tự chuyển chữ thường)", "Tên 'QA flag', Giai đoạn 'Thử nghiệm', Tỷ lệ '25'", "Thử gõ chữ vào ô Tỷ lệ", "Bấm 'Thêm tính năng'"], "qa_flag_1",
      "Dialog 'Thêm tính năng thử nghiệm' ('Tính năng mới mặc định đang tắt...'); khóa thành 'qa_flag_1'; ô Tỷ lệ chỉ nhận chữ số (tối đa 3); toast 'Đã thêm tính năng'; dòng mới 'Thử nghiệm' + '25%' công tắc TẮT. Nút khóa khi tên rỗng, khóa chứa ký tự ngoài a-z0-9_, hoặc tỷ lệ >100.")
    A(F, "Thêm cờ với khóa bắt đầu bằng số/1 ký tự: giao diện cho phép nhưng API trả 400", "Chức năng", "Trung bình", SYS_FUI + " " + MUTATE,
      ["Bấm 'Thêm tính năng'", "Khóa '1abc' (hoặc 'a'), Tên 'X'", "Bấm 'Thêm tính năng'"], "1abc / a",
      "KỲ VỌNG THEO GIAO DIỆN: khóa 'a-z, 0-9, _' hợp lệ. HIỆN TẠI: BE yêu cầu bắt đầu bằng chữ và dài 2-60 ký tự -> 400 'Khóa chỉ gồm a-z, 0-9, _ (2-60 ký tự, bắt đầu bằng chữ)' hiện trong dialog; giao diện chưa chặn trước (lệch kiểm tra giữa FE và BE).", st=PLAN, pw="Một phần")
    A(F, "Thêm cờ trùng khóa: lỗi 409 hiện trong dialog", "Chức năng", "Trung bình", SYS_FUI,
      ["Bấm 'Thêm tính năng', khóa 'dm_v2', tên 'Trùng' > 'Thêm tính năng'"], "dm_v2", "Dialog hiện 'Feature flag đã tồn tại'; không tạo thêm dòng.")
    A(F, "Sửa cờ: dialog 'Sửa tính năng · tên', khóa không đổi được, đổi %, giai đoạn", "Chức năng", "Cao", SYS_FUI + " " + MUTATE,
      ["Menu dòng dm_v2 > 'Sửa'", "Đổi Tỷ lệ 50 -> 80, Giai đoạn 'Đang chạy', Mô tả mới > 'Lưu'", "Xóa trắng tên và xem nút Lưu"], "dm_v2",
      "Không có ô Khóa; toast 'Đã cập nhật tính năng'; dòng đổi 'Đang chạy' kèm '80%' (phần trăm hiện khi < 100); nút Lưu khóa khi tên rỗng; audit flag.update.")
    A(F, "Xóa cờ: dialog xác nhận, cờ biến mất khỏi /api/feature-flags", "Chức năng", "Cao", SYS_FUI + " " + MUTATE,
      ["Menu dòng native_live > 'Xóa'", "Đọc nội dung cảnh báo > 'Xóa'", "GET /api/feature-flags"], "native_live",
      "Dialog 'Xóa tính năng · Native livestream' ('...mã nguồn đang đọc cờ sẽ coi như tắt'); toast 'Đã xóa tính năng'; dòng mất; khóa native_live không còn trong data.flags; audit flag.delete.")
    F = "Hệ thống · Tính năng thử nghiệm (API và công khai)"
    A(F, "CRUD /admin/system/flags: tạo 201, trùng 409, 404, validate, toggle, xóa, audit", "Chức năng", "Cao", SYS_APIM + " " + SEED_FLAG,
      ["POST /system/flags {key:'qa_api_flag', name:'QA API'} -> ghi stage/enabled/rolloutPercent mặc định", "POST lại cùng key", "POST {key:'Bad Key', name:'x'}", "POST {key:'a', name:'x'}", "POST {key:'qa_ok2', name:'x', rolloutPercent:101}", "POST {key:'qa_ok3', name:'x', rolloutPercent:50.5}",
       "PATCH /system/flags/qa_api_flag {enabled:true, rolloutPercent:30, stage:'beta'}", "PATCH {}", "POST /system/flags/qa_api_flag/toggle {} (đảo)", "POST .../toggle {enabled:true}", "GET /system/flags/khong_co (PATCH/toggle/DELETE cũng 404)", "DELETE /system/flags/qa_api_flag"], "qa_api_flag",
      "Tạo: stage 'draft', enabled false, rolloutPercent 100, updatedBy = admin; trùng 409 'Feature flag đã tồn tại'; key sai/1 ký tự/rollout 101/50.5 -> 400; PATCH 200; {} -> 400 'Không có gì để cập nhật'; toggle đảo/đặt đúng giá trị; 404 'Không tìm thấy feature flag'; DELETE 200 {deleted:true}; audit flag.create / flag.enable / flag.disable / flag.update / flag.delete với metadata.")
    A(F, "GET /admin/system/flags lọc q, stage, enabled; giá trị lạ trả 400", "Chức năng", "Trung bình", SYS_API + " " + SEED_FLAG,
      ["GET /system/flags?q=layout", "GET ?q=dm", "GET ?stage=active", "GET ?enabled=false", "GET ?enabled=maybe", "GET ?stage=prod"], "-",
      "q khớp key/tên không phân biệt hoa/thường; stage=active 3 cờ; enabled=false: app_banner, native_live; enabled=maybe và stage=prod -> 400.")
    A(F, "GET /api/feature-flags công khai (không cần đăng nhập): cờ bật, maintenance, platform, no-store", "Chức năng", "Cao", BASE3 + " Chưa đăng nhập. " + SEED_FLAG,
      ["GET /api/feature-flags không token", "Xem header Cache-Control", "So với GET /api/admin/system/flags"], "-",
      "200 {data:{flags:{ai_moderation:true, app_banner:false, dm_v2:false, leaderboard_v2:true, native_live:false, premium_lock:true}, maintenance:false, platform:{name:'SofinHub', supportEmail:<email hỗ trợ>, defaultLanguage:'vi'}}}; Cache-Control: no-store (đổi cờ có hiệu lực ngay); khách chỉ nhận cờ rollout 100% nên dm_v2=false dù đang bật 50%.")
    A(F, "Rollout theo %: cùng một user luôn vào/ra nhóm theo băm ổn định sha256(flag:userId)", "Chức năng", "Cao", SYS_API + " " + SEED_FLAG + " Có token ít nhất 6 người dùng khác nhau (member1..3, alex, sarah, daniel).",
      ["Với mỗi token: GET /api/feature-flags 3 lần, ghi dm_v2", "Tự tính bucket = parseInt(sha256('dm_v2:'+userId).hex.slice(0,8),16) % 100 và so với 50", "Admin PATCH rolloutPercent 50 -> 80, gọi lại", "PATCH 80 -> 30, gọi lại"], "dm_v2 rollout 50",
      "Mỗi user nhận cùng kết quả cả 3 lần; dm_v2=true đúng khi bucket < 50 (khoảng một nửa người dùng); khi tăng lên 80 thì mọi user đã bật vẫn bật (tập con tăng dần); khi giảm xuống 30 chỉ giữ user bucket < 30.", pw="Một phần")
    A(F, "Rollout 0%/100%, enabled=false, stage không ảnh hưởng kết quả công khai", "Chức năng", "Trung bình", SYS_APIM + " " + SEED_FLAG,
      ["PATCH dm_v2 {rolloutPercent:0}", "GET /api/feature-flags bằng token member1@", "PATCH {rolloutPercent:100, enabled:false}", "GET lại", "PATCH native_live {enabled:true, rolloutPercent:100} (stage draft)", "GET lại (khách)"], "dm_v2, native_live",
      "0%: dm_v2 false cho mọi user (kể cả đã đăng nhập); 100% nhưng enabled=false: false; native_live (stage 'draft') bật + 100%: true cho cả khách (giai đoạn chỉ là nhãn, không ảnh hưởng).")
    A(F, "Cờ vừa tạo/xóa/đổi phản ánh ngay ở /api/feature-flags", "Chức năng", "Trung bình", SYS_APIM,
      ["POST /system/flags {key:'qa_live', name:'QA', enabled:true, rolloutPercent:100}", "GET /api/feature-flags", "DELETE /system/flags/qa_live", "GET /api/feature-flags"], "qa_live", "Sau tạo: flags.qa_live=true; sau xóa: khóa qa_live KHÔNG còn trong map (không phải false).")
    A(F, "Quyền system.flags: chỉ Super Admin (mặc định) sửa cờ; Moderator/Support/Finance 403", "Bảo mật", "Cao", SYS_API,
      ["GET /system/flags và POST /system/flags bằng token moderator@, support@, finance@", "Bật system.flags cho Moderator ở ma trận rồi gọi lại"], "-", "3 vai trò 403 'không có quyền \"system.flags\"'; sau khi bật ô, Moderator qua guard; GET /api/feature-flags công khai không cần quyền.")

    # ============================================================ 11. HỆ THỐNG - TÍCH HỢP
    F = "Hệ thống · Tích hợp (UI)"
    SYS_IUI = SYS_UI + " " + SEED_INTEG
    A(F, "Trang 'Tích hợp': 8 thẻ dịch vụ với trạng thái, nhóm, mô tả tiếng Việt và khóa che", "Giao diện", "Cao", SYS_IUI,
      ["Mở /admin/system/integrations", "Đọc 8 thẻ"], "-",
      "Tiêu đề 'Tích hợp', phụ đề 'Dịch vụ bên thứ ba kết nối với SofinHub.', khối 'Dịch vụ đã kết nối'; 6 thẻ 'Đã kết nối' (xanh) có dòng 'Khóa ••••xxxx · kết nối ... trước' (Stripe ••••9f2a...), 2 thẻ 'Chưa kết nối' (Google Analytics, Slack); nhãn nhóm Thanh toán/Video/Email/CDN/Phân tích/Chat; mô tả tiếng Việt (vd Stripe 'Thanh toán thẻ và gói đăng ký.'); nút: thẻ đã kết nối 'Ngắt kết nối' + 'Kiểm tra', thẻ chưa kết nối 'Kết nối'. Không bao giờ thấy khóa đầy đủ.")
    A(F, "Kết nối dịch vụ chưa kết nối (Slack) với khóa API: chỉ lưu mask 4 ký tự cuối", "Chức năng", "Cao", SYS_IUI + " " + MUTATE,
      ["Thẻ Slack > 'Kết nối'", "Đọc nội dung dialog 'Kết nối Slack'", "Nhập 'xoxb-TEST-SECRET-9876' > 'Kết nối'", "Quan sát thẻ", "Kiểm tra DB bảng Integration cột secretMask/config"], "xoxb-TEST-SECRET-9876",
      "Dialog nói rõ 'Khóa bí mật thật vẫn nằm ở biến môi trường...; chỉ lưu 4 ký tự cuối'; toast 'Đã kết nối Slack'; thẻ 'Đã kết nối', 'Khóa ••••9876 · kết nối vừa xong'; DB chỉ có secretMask '••••9876' (KHÔNG có chuỗi khóa đầy đủ ở bất kỳ cột nào, kể cả audit).", pw="Một phần")
    A(F, "Kết nối không nhập khóa API (tùy chọn): kết nối được, không có dòng 'Khóa'", "Chức năng", "Trung bình", SYS_IUI + " " + MUTATE,
      ["Thẻ Google Analytics > 'Kết nối' > để trống > 'Kết nối'"], "-", "Toast 'Đã kết nối Google Analytics'; thẻ 'Đã kết nối' nhưng không có 'Khóa ••••' (secretMask null).")
    A(F, "Ngắt kết nối: dialog cảnh báo, xóa mask và thời điểm kết nối", "Chức năng", "Cao", SYS_IUI + " " + MUTATE,
      ["Thẻ Zoom > 'Ngắt kết nối'", "Đọc dialog 'Ngắt kết nối Zoom?' > xác nhận", "Kết nối lại không nhập khóa"], "zoom",
      "Dialog 'Ngắt kết nối Zoom?' ('Các tính năng phụ thuộc dịch vụ này có thể ngừng hoạt động.'); toast 'Đã ngắt kết nối Zoom'; thẻ 'Chưa kết nối', mask bị xóa (••••e5aa mất); kết nối lại không khóa thì vẫn không có mask.")
    A(F, "Nút 'Kiểm tra' (mô phỏng): toast thành công kèm độ trễ ổn định theo khóa dịch vụ", "Chức năng", "Trung bình", SYS_IUI,
      ["Thẻ Stripe > 'Kiểm tra' (hai lần)", "Thẻ Mailgun > 'Kiểm tra'"], "stripe, mailgun",
      "Nút hiện 'Đang thử…' rồi toast 'Stripe: kết nối ổn (N ms)' với N trong 40-159 và GIỐNG nhau giữa 2 lần (tính theo md5 của khóa, không ngẫu nhiên); Mailgun có N khác. Đây là mô phỏng, không gọi dịch vụ thật.")
    A(F, "Thẻ chưa kết nối không có nút 'Kiểm tra'; kiểm tra bằng API trả ok=false", "Chức năng", "Thấp", SYS_IUI,
      ["Xác nhận thẻ Slack không có nút 'Kiểm tra'", "POST /api/admin/system/integrations/slack/test"], "slack", "Giao diện không có nút; API 200 {ok:false, message:'Slack chưa được kết nối', latencyMs:0}.")
    F = "Hệ thống · Tích hợp (API)"
    A(F, "GET /admin/system/integrations (lọc category) và GET /:key; 404", "Chức năng", "Cao", SYS_API + " " + SEED_INTEG,
      ["GET /system/integrations", "GET ?category=payments", "GET ?category=chat", "GET /system/integrations/stripe", "GET /system/integrations/khong-co"], "-",
      "Lần 1: 8 phần tử {key,name,initials,color,description,category,connected,config,secretMask,connectedAt,updatedAt}; payments: stripe, paypal, momo; chat: slack; stripe: connected true, secretMask '••••9f2a', config {accountId:'acct_demo_1A2b3C', mode:'test'}; khóa lạ: 404 'Không tìm thấy tích hợp'. Response không bao giờ có apiKey.")
    A(F, "POST connect/disconnect: 409 khi đã ở trạng thái đó; apiKey -> mask; config nhận chuỗi/số/bool", "Chức năng", "Cao", SYS_APIM + " " + SEED_INTEG,
      ["POST /system/integrations/stripe/connect {} (đã kết nối)", "POST /system/integrations/slack/connect {apiKey:'sk_live_ABCD1234', config:{channel:'#mod', retries:3, enabled:true}}", "POST slack/connect lần 2", "POST /system/integrations/google_analytics/disconnect", "POST slack/disconnect", "POST slack/disconnect lần 2", "POST /system/integrations/khong-co/connect"], "slack",
      "Lần 1: 409 'Tích hợp đã được kết nối'; lần 2: 200 connected true, secretMask '••••1234', config như gửi, connectedAt mới; lần 3: 409; lần 4: 409 'Tích hợp chưa được kết nối'; lần 5: 200 connected false, secretMask null, connectedAt null; lần 6: 409; lần 7: 404. Audit integration.connect/disconnect.")
    A(F, "PATCH /system/integrations/:key cập nhật config/apiKey; audit chỉ ghi tên trường, không ghi khóa", "Bảo mật", "Cao", SYS_APIM,
      ["PATCH /system/integrations/stripe {apiKey:'sk_live_NEWKEY5555'}", "PATCH {config:{mode:'live'}}", "PATCH {}", "PATCH {config:{nested:{a:1}}}", "PATCH {apiKey:'   '}", "PATCH {apiKey:'<501 ký tự>'}", "GET /admin/audit-logs?action=integration.update"], "stripe",
      "Lần 1: secretMask '••••5555'; lần 2: config mới; lần 3: 400 'Không có gì để cập nhật'; lần 4-6: 400 (giá trị lồng/khóa rỗng/quá 500 ký tự); audit integration.update có metadata.fields=['apiKey'] (KHÔNG chứa giá trị khóa) và không có khóa ở bất kỳ cột nào.")
    A(F, "POST test: connected -> ok:true (mô phỏng), chưa kết nối -> ok:false; 404", "Chức năng", "Trung bình", SYS_API + " " + SEED_INTEG,
      ["POST /system/integrations/stripe/test", "POST /system/integrations/slack/test", "POST /system/integrations/khong-co/test"], "-",
      "stripe: {ok:true, message:'Kết nối tới Stripe hoạt động bình thường (mô phỏng)', latencyMs:40..159}; slack: {ok:false, message:'Slack chưa được kết nối', latencyMs:0}; khóa lạ 404. Không có audit (test không ghi).")
    A(F, "Quyền system.settings cho Tích hợp: Moderator/Support/Finance 403", "Bảo mật", "Trung bình", SYS_API, ["GET /system/integrations bằng moderator@, support@, finance@"], "-", "403 'không có quyền \"system.settings\"' ở cả 3.")

    # ============================================================ 12. HỆ THỐNG - THÔNG BÁO
    F = "Hệ thống · Thông báo (UI)"
    SYS_NUI = SYS_UI + " " + SEED_BC
    A(F, "Trang 'Thông báo': 3 form cảnh báo với giá trị mặc định và ghi chú 'chỉ lưu cấu hình'", "Giao diện", "Cao", SYS_NUI,
      ["Mở /admin/system/notifications", "Đọc các công tắc và email nhận báo cáo", "Đọc dòng chú thích cuối khối cảnh báo"], "-",
      "Tiêu đề 'Thông báo', phụ đề 'Cảnh báo gửi cho các nhóm quản trị và thông báo tới người dùng.'; 'Cảnh báo kiểm duyệt': 'Báo cáo nghiêm trọng' (gợi ý 'Email + thông báo đẩy') BẬT, 'Cộng đồng chờ duyệt' BẬT, 'Nội dung bị AI gắn cờ' TẮT; 'Cảnh báo thanh toán': 'Tranh chấp mới', 'Chi trả thất bại', 'Hoàn tiền trên $500' đều BẬT; 'Báo cáo': 'Tổng kết hằng tuần' BẬT, 'Báo cáo hằng tháng' TẮT, 'Gửi đến' = ops@sofinhub.com; dòng 'Hiện hệ thống chỉ lưu cấu hình; chưa có tác vụ tự động gửi các cảnh báo/báo cáo định kỳ này.' Nút 'Lưu thay đổi' bị khóa khi chưa đổi.")
    A(F, "Đổi công tắc cảnh báo rồi 'Lưu thay đổi' / 'Hoàn tác'", "Chức năng", "Cao", SYS_NUI + " " + MUTATE,
      ["Bật 'Nội dung bị AI gắn cờ', tắt 'Tranh chấp mới'", "Quan sát nút 'Hoàn tác' và 'Lưu thay đổi'", "Bấm 'Hoàn tác'", "Đổi lại và bấm 'Lưu thay đổi'", "F5"], "aiFlagged, newChargeback",
      "Khi có thay đổi xuất hiện 'Hoàn tác' và 'Lưu thay đổi' bật; 'Hoàn tác' trả về giá trị đã lưu; Lưu -> toast 'Đã lưu cấu hình thông báo'; sau F5 giá trị giữ nguyên; audit notification.settings_update.")
    A(F, "Email nhận báo cáo ('Gửi đến'): hợp lệ lưu được, sai định dạng bị API từ chối", "Chức năng", "Trung bình", SYS_NUI + " " + MUTATE,
      ["Đổi 'Gửi đến' thành 'ban-giam-doc@example.com' > Lưu", "Đổi thành 'khong-phai-email' > Lưu", "Xóa trắng > Lưu"], "ban-giam-doc@example.com / khong-phai-email / rỗng",
      "Lần 1: lưu thành công; lần 2: toast lỗi từ API (400 email không hợp lệ), giá trị không đổi; lần 3: lưu được chuỗi rỗng (sendTo '' hợp lệ).")
    A(F, "Gửi thông báo tới người dùng: nút 'Gửi thông báo' khóa tới khi đủ Tiêu đề + Nội dung", "Giao diện", "Cao", SYS_NUI,
      ["Cuộn tới thẻ 'Thông báo tới người dùng'", "Quan sát nút 'Gửi thông báo' khi trống", "Nhập Tiêu đề và Nội dung", "Chọn đối tượng 'Một cộng đồng' và quan sát"], "-",
      "Thẻ có Tiêu đề (≤120), Nội dung (≤1000), 'Liên kết (tùy chọn)' (gợi ý '/communities/…'), chip đối tượng 'Mọi người dùng / Creator / Thành viên trả phí / Một cộng đồng', công tắc 'Gửi kèm email'; nút gửi khóa tới khi có tiêu đề + nội dung (+ mã cộng đồng khi chọn 'Một cộng đồng'); khi chọn 'Một cộng đồng' xuất hiện ô 'Mã cộng đồng' (vd photo).")
    A(F, "'Xem số người nhận' hiện toast số lượng theo từng đối tượng", "Chức năng", "Cao", SYS_NUI,
      ["Chọn lần lượt 'Mọi người dùng', 'Creator', 'Thành viên trả phí', 'Một cộng đồng' (photo) và bấm 'Xem số người nhận'", "Đối chiếu bằng SQL"], "photo",
      "Toast 'Thông báo sẽ tới N người' (định dạng vi-VN); N: Mọi người dùng = user thật chưa xóa, chưa bị cấm, KHÔNG gồm thành viên demo (isDemo); Creator = người sở hữu ≥1 cộng đồng; Trả phí = có gói active/trialing/past_due; Một cộng đồng = thành viên của cộng đồng đó (gồm cả thành viên demo). Mã cộng đồng sai -> toast lỗi 'Không tìm thấy cộng đồng'.", pw="Một phần")
    A(F, "Gửi thông báo cho một cộng đồng nhỏ: dialog xác nhận, toast, người nhận thấy thông báo", "Chức năng", "Cao", SYS_NUI + " " + MUTATE,
      ["Nhập Tiêu đề 'QA thông báo', Nội dung 'Kiểm thử gửi', Liên kết '/communities/photo', đối tượng 'Một cộng đồng' mã 'photo'", "Bấm 'Gửi thông báo' -> đọc dialog -> 'Gửi thông báo'", "Đăng nhập member1@ xem chuông thông báo", "Xem 'Lịch sử thông báo đã gửi'"], "photo",
      "Dialog 'Gửi thông báo hệ thống?' (nội dung 'Gửi \"QA thông báo\" tới một cộng đồng. Thao tác này không thu hồi được.'); toast 'Đã gửi thông báo'; ô tiêu đề/nội dung/liên kết được xóa; member1@ có thông báo loại hệ thống 'QA thông báo' (bấm dẫn /communities/photo); lịch sử thêm dòng đầu: đối tượng 'Một cộng đồng', số người nhận = số thành viên photo, Email 0, Người gửi = tên admin.")
    A(F, "Gửi thông báo kèm email (≤500 người nhận): emailCount = số người nhận, thư nằm trong outbox", "Chức năng", "Cao", SYS_NUI + " " + MUTATE,
      ["Gửi tới 'Một cộng đồng' photo với công tắc 'Gửi kèm email' bật, Liên kết '/communities/photo'", "GET /api/dev/outbox?to=member1@sofinhub.test", "Xem cột Email ở lịch sử"], "photo + email",
      "Mỗi người nhận có 1 thư tiêu đề = tiêu đề thông báo, nội dung = nội dung + dòng '<FRONTEND_URL>/communities/photo'; cột Email = số thư đã gửi = số người nhận.", pw="Một phần")
    A(F, "Lịch sử thông báo: 2 dòng seed, phân trang 10/dòng, cột đúng", "Giao diện", "Trung bình", SYS_NUI,
      ["Cuộn xuống 'Lịch sử thông báo đã gửi'", "Đọc các cột và 2 dòng seed"], "-",
      "Cột Thông báo (tiêu đề + nội dung rút gọn), Đối tượng, Người nhận, Email, Người gửi, Thời gian; 'Bảo trì hệ thống đêm Chủ nhật' (Mọi người dùng, 2.480, 0, Platform Admin) và 'Chính sách phí mới cho Creator' (Creator, 12, 0); mới nhất trên cùng; rỗng thì 'Chưa gửi thông báo nào.'")
    A(F, "Giao diện chưa có đối tượng 'users' (danh sách id) dù API hỗ trợ", "Chức năng", "Thấp", SYS_NUI,
      ["Đếm các chip 'Đối tượng nhận' trong thẻ gửi thông báo"], "-", "Chỉ có 4 đối tượng; đối tượng {type:'users', userIds[]} chỉ dùng được bằng API (khoảng trống đã biết trong ADMIN_BACKEND_GAPS).", pw="Một phần")
    F = "Hệ thống · Thông báo (API)"
    A(F, "GET/PUT /admin/system/notifications/settings: mặc định, PUT từng phần, validate", "Chức năng", "Cao", SYS_APIM,
      ["GET /system/notifications/settings", "PUT {moderation:{aiFlagged:true}}", "GET lại", "PUT {payments:{refundOver500:false}, reports:{sendTo:'a@b.co'}}", "PUT {reports:{sendTo:'xx'}}", "PUT {moderation:{khongCo:true}}", "PUT {khongCoNhom:{}}", "PUT {moderation:{aiFlagged:'yes'}}", "PUT {}"], "-",
      "Lần 1: mặc định (moderation {criticalReports:true,pendingCommunities:true,aiFlagged:false}, payments tất cả true, reports {weeklySummary:true,monthlyBoardReport:false,sendTo:'ops@sofinhub.com'}); PUT từng phần chỉ ghi đè trường gửi, các trường khác giữ nguyên; email sai/trường lạ/nhóm lạ/kiểu sai -> 400 (schema strict); PUT {} -> 200 trả giá trị hiện tại. Audit notification.settings_update.")
    A(F, "POST /admin/system/notifications/preview: đếm người nhận theo từng audience, loại user bị cấm/đã xóa/demo", "Chức năng", "Cao", SYS_API + " " + SEED_BC,
      ["POST preview {audience:{type:'all'}}", "{type:'creators'}", "{type:'paid_members'}", "{type:'community', courseId:'photo'}", "{type:'community', courseId:'khong-co'}", "{type:'users', userIds:['<id member1>','<id sophia (banned)>','khong-co']}", "{type:'users', userIds:[]}", "{type:'users', userIds:[<501 id>]}", "{audience:{type:'xyz'}}"], "-",
      "all = user thật (isDemo=false) chưa xóa/cấm; creators = có Course sở hữu; paid_members = có Subscription active|trialing|past_due; community photo = thành viên photo; courseId lạ 404 'Không tìm thấy cộng đồng'; users: chỉ đếm id tồn tại và chưa bị cấm (member1 = 1; sophia bị cấm và id lạ không tính => recipientCount 1); userIds rỗng hoặc >500 -> 400; type lạ -> 400.")
    A(F, "POST /admin/system/notifications/broadcast: 201, tạo thông báo loại 'system' cho người nhận, ghi lịch sử + audit", "Chức năng", "Cao", SYS_APIM,
      ["POST broadcast {title:'API QA', body:'Nội dung', link:'/communities/photo', audience:{type:'users', userIds:['<id member1>','<id member2>']}}", "Đăng nhập member1@ xem thông báo", "GET /system/notifications/broadcasts", "GET /admin/audit-logs?action=notification.broadcast"], "2 người nhận",
      "201 Broadcast {id,title,body,link,audience,recipientCount:2,emailCount:0,sentBy:{id,name},createdAt}; member1@ và member2@ có thông báo type 'system' đúng title/body/link; lịch sử có dòng mới; audit metadata {audience, recipientCount:2, emailCount:0}.")
    A(F, "POST broadcast validate: tiêu đề/nội dung/liên kết/audience; 0 người nhận 400; courseId lạ 404", "Chức năng", "Cao", SYS_APIM,
      ["title rỗng", "title 121 ký tự", "body rỗng", "body 1001 ký tự", "link:'https://x.com' (không bắt đầu bằng /)", "link '/ok' hợp lệ", "audience {type:'users', userIds:['khong-co']} (0 người nhận)", "audience {type:'community', courseId:'khong-co'}", "thiếu audience"], "-",
      "title/body rỗng: 400 'Vui lòng nhập tiêu đề' / 'Vui lòng nhập nội dung'; quá dài 400; link ngoài 400 'Liên kết phải là đường dẫn nội bộ bắt đầu bằng /'; 0 người nhận: 400 'Không có người nhận phù hợp với đối tượng đã chọn' (không tạo lịch sử); courseId lạ 404; thiếu audience 400.")
    A(F, "Broadcast kèm email: sendEmail=true gửi thư cho từng người; emailCount ghi lịch sử; >500 người nhận bị 400", "Chức năng", "Cao", SYS_APIM,
      ["POST broadcast {..., audience:{type:'users', userIds:[3 id]}, sendEmail:true}", "GET /api/dev/outbox?to=<email từng người>", "Chọn audience có >500 người nhận (cộng đồng lớn/dữ liệu nạp thêm), sendEmail:true"], "sendEmail",
      "Lần 1: emailCount=3, mỗi người có thư (tiêu đề = title; nội dung kèm '<FRONTEND_URL><link>' nếu có link); >500 + sendEmail -> 400 'Chỉ gửi kèm email khi có tối đa 500 người nhận' và KHÔNG tạo thông báo/lịch sử nào.", pw="Một phần")
    A(F, "Broadcast >500 người nhận (không email): ghi hàng loạt theo lô, KHÔNG đẩy realtime SSE", "Chức năng", "Trung bình", SYS_APIM + " Cần audience có >500 người nhận: tạo bằng script ≥ 600 user thật hoặc cộng đồng đủ lớn (kiểm tra bằng /preview).",
      ["POST preview rồi POST broadcast {audience có >500 người nhận, sendEmail:false}", "Người nhận đang mở sẵn trang (SSE): quan sát chuông thông báo", "Người nhận F5/tải lại", "Đếm Notification mới trong DB"], ">500 người nhận",
      "Broadcast 201 recipientCount > 500; DB có đúng recipientCount dòng Notification loại system (ghi theo lô 1000); người đang mở trang KHÔNG thấy cập nhật tức thì (không SSE), chỉ thấy sau khi tải lại; với ≤500 người nhận thì thấy realtime.", pw="Không")
    A(F, "GET /admin/system/notifications/broadcasts: phân trang, mới nhất trước, 2 dòng seed", "Chức năng", "Trung bình", SYS_API + " " + SEED_BC,
      ["GET /system/notifications/broadcasts", "GET ?limit=1&page=2", "GET ?limit=101"], "-", "2 dòng seed (mới nhất 'Chính sách phí mới cho Creator' trước); meta đúng; limit=101 -> 400.")
    A(F, "Quyền system.settings cho Thông báo: Moderator/Support/Finance 403", "Bảo mật", "Trung bình", SYS_API,
      ["GET /system/notifications/settings và POST /system/notifications/broadcast bằng moderator@, support@, finance@"], "-", "403 'không có quyền \"system.settings\"'.")

    # ============================================================ 13. HỆ THỐNG - MẪU EMAIL
    F = "Hệ thống · Mẫu email (UI)"
    SYS_TUI = SYS_UI + " " + SEED_TPL
    A(F, "Trang 'Mẫu email': 7 mẫu hệ thống với trạng thái, ngôn ngữ và tiêu đề", "Giao diện", "Cao", SYS_TUI,
      ["Mở /admin/system/email", "Đọc cột và 7 dòng"], "-",
      "Tiêu đề 'Mẫu email', phụ đề 'Email hệ thống gửi cho thành viên và creator.', nút 'Tạo mẫu'; cột Mẫu email (tên + khóa), Tiêu đề (ưu tiên tiếng Việt, VD 'Chào mừng bạn đến với {{community}}'), Ngôn ngữ 'EN · VI', Cập nhật, Trạng thái; 6 mẫu 'Đang dùng' và 'suspended' = 'Bản nháp'.")
    A(F, "Lọc theo trạng thái và tìm mẫu theo tên/khóa", "Chức năng", "Trung bình", SYS_TUI,
      ["Lọc Trạng thái = 'Bản nháp'", "Xóa, gõ 'reset'", "Gõ 'receipt'"], "-", "Bản nháp: chỉ 'Account suspended'; 'reset': reset_password; 'receipt': Payment receipt.")
    A(F, "Bật/Tắt mẫu từ menu dòng: toast và đổi trạng thái (Đang dùng <-> Đã tắt)", "Chức năng", "Cao", SYS_TUI + " " + MUTATE,
      ["Menu dòng 'Welcome member' > 'Tắt'", "Menu dòng 'Account suspended' > 'Bật'"], "welcome, suspended",
      "Toast 'Đã tắt \"Welcome member\"' -> trạng thái 'Đã tắt' (đỏ); toast 'Đã bật \"Account suspended\"' -> 'Đang dùng'; audit email_template.disable / email_template.enable.")
    A(F, "Mẫu hệ thống không có 'Xóa' trong menu; mẫu tự tạo có", "Giao diện", "Trung bình", SYS_TUI,
      ["Mở menu dòng một mẫu hệ thống", "Tạo mẫu mới (xem case sau) rồi mở menu dòng của nó"], "-", "Mẫu hệ thống: Sửa + Bật/Tắt (không 'Xóa'); mẫu tự tạo: Sửa + Bật/Tắt + 'Xóa' (đỏ).")
    A(F, "Trình soạn: mở 'Welcome member' hiển thị trường, ngôn ngữ, chip biến và xem trước", "Giao diện", "Cao", SYS_TUI,
      ["Bấm dòng 'Welcome member'", "Đọc Nội dung (Tiếng Anh), đổi Segment sang Tiếng Việt", "Đọc khối 'Xem trước' và 'Dữ liệu mẫu'"], "welcome",
      "Tiêu đề 'Sửa mẫu · Welcome member', breadcrumb 'Mẫu email > Welcome member', nút 'Quay lại' + 'Lưu mẫu'; Tên/Mô tả/Trạng thái; tiêu đề EN 'Welcome to {{community}}', VI 'Chào mừng bạn đến với {{community}}'; chip biến {{name}} {{community}}; xem trước thay biến bằng dữ liệu mẫu ('Growth Hackers VN', 'Nguyễn Văn A') ngay khi gõ; khối 'Dữ liệu mẫu' có ô cho từng biến đã khai báo.")
    A(F, "Chèn biến vào ô tiêu đề/nội dung đang focus bằng chip", "Chức năng", "Trung bình", SYS_TUI,
      ["Trong trình soạn, click vào ô Tiêu đề", "Bấm chip {{name}}", "Click vào ô Nội dung (đặt con trỏ giữa câu)", "Bấm chip {{community}}"], "-", "Biến chèn đúng tại vị trí con trỏ của ô đang focus (tiêu đề rồi nội dung); xem trước cập nhật.")
    A(F, "Khai báo thêm/bỏ biến; cảnh báo 'Biến chưa khai báo'", "Chức năng", "Trung bình", SYS_TUI + " " + MUTATE,
      ["Trong nội dung gõ thêm '{{coupon}}' (chưa khai báo)", "Quan sát cảnh báo vàng", "Gõ 'coupon' vào ô 'Thêm biến' > 'Thêm biến'", "Thử thêm biến '1abc' và '  '", "Bấm × ở biến vừa thêm"], "coupon",
      "Cảnh báo 'Biến chưa khai báo: {{coupon}}' biến mất sau khi thêm; '1abc' -> toast 'Tên biến chỉ gồm chữ, số, gạch dưới (bắt đầu bằng chữ).'; nút 'Thêm biến' khóa khi ô trống; × bỏ biến khỏi danh sách và 'Dữ liệu mẫu'.")
    A(F, "Lưu mẫu hệ thống đã sửa: toast, quay lại danh sách, nội dung lưu, biến tự suy khi không khai báo", "Chức năng", "Cao", SYS_TUI + " " + MUTATE,
      ["Mở 'Payment receipt', sửa Tiêu đề EN thành 'Receipt #{{id}} for {{name}}'", "Bấm 'Lưu mẫu'", "Mở lại mẫu và đọc nội dung"], "receipt",
      "Toast 'Đã lưu mẫu email' và quay lại danh sách; mở lại thấy tiêu đề mới; cột 'Cập nhật' mới; audit email_template.update metadata.fields.")
    A(F, "Tạo mẫu mới: khóa a-z0-9_, EN bắt buộc, VI tùy chọn, trạng thái mặc định Bản nháp", "Chức năng", "Cao", SYS_TUI + " " + MUTATE,
      ["Bấm 'Tạo mẫu'", "Nhập Khóa 'course_invite', Tên 'Mời vào khóa học', Tiêu đề EN 'Join {{community}}', Nội dung EN 'Hi {{name}}, join {{community}}.'", "Khai báo biến name, community", "Để VI trống, trạng thái 'Bản nháp' > 'Lưu mẫu'"], "course_invite",
      "Nút 'Lưu mẫu' khóa tới khi có khóa hợp lệ + tên + tiêu đề EN + nội dung EN; toast 'Đã tạo mẫu email'; dòng mới 'Bản nháp', ngôn ngữ 'EN' (không có VI), isSystem=false; nút 'Xem bản từ máy chủ'/'Gửi thử' CHỈ có khi sửa mẫu đã lưu (không có ở màn tạo mới).")
    A(F, "'Xem bản từ máy chủ' dựng bằng dữ liệu mẫu và báo biến thiếu", "Chức năng", "Cao", SYS_TUI,
      ["Mở mẫu 'Reset password'", "Xóa giá trị mẫu của biến {{link}} trong 'Dữ liệu mẫu'", "Bấm 'Xem bản từ máy chủ'"], "reset_password",
      "Xuất hiện khối 'Bản dựng từ máy chủ' với tiêu đề/nội dung đã thay biến (biến còn thiếu giữ nguyên '{{link}}'); toast 'Còn thiếu biến: link'; lời nhắc 'dùng nội dung đã lưu - hãy lưu trước khi kiểm tra'.", pw="Một phần")
    A(F, "'Gửi thử cho tôi': thư [TEST] vào outbox của admin đang đăng nhập", "Chức năng", "Cao", SYS_TUI + " " + MUTATE,
      ["Mở mẫu 'Welcome member', ngôn ngữ Tiếng Việt", "Bấm 'Gửi thử cho tôi'", "GET /api/dev/outbox?to=admin@sofinhub.test"], "welcome (vi)",
      "Toast 'Đã gửi thử tới admin@sofinhub.test'; outbox có thư tiêu đề '[TEST] Chào mừng bạn đến với Growth Hackers VN' (dùng dữ liệu mẫu); audit email_template.test_send metadata.to.", pw="Một phần")
    A(F, "Xóa mẫu tự tạo từ menu: dialog và toast", "Chức năng", "Trung bình", SYS_TUI + " " + MUTATE + " Đã tạo mẫu course_invite.",
      ["Menu dòng 'Mời vào khóa học' > 'Xóa' > xác nhận"], "course_invite", "Dialog 'Xóa mẫu · Mời vào khóa học'; toast 'Đã xóa mẫu email'; dòng biến mất; audit email_template.delete.")
    A(F, "Khai báo biến có dấu chấm (user.name): giao diện cho phép nhưng API 400 và bộ dựng không thay thế", "Chức năng", "Trung bình", SYS_TUI + " " + MUTATE,
      ["Mở mẫu bất kỳ, thêm biến 'user.name' và gõ '{{user.name}}' vào nội dung", "Bấm 'Lưu mẫu'"], "user.name",
      "KỲ VỌNG THEO GIAO DIỆN: biến dạng 'a.b' hợp lệ (regex FE ^[A-Za-z][\\w.]*$). HIỆN TẠI: BE chỉ nhận biến ^[a-zA-Z0-9_]{1,40}$ -> 400 khi lưu danh sách biến, và bộ dựng chỉ thay {{ten_bien}} gồm chữ-số-gạch dưới; lệch kiểm tra giữa FE và BE.", st=PLAN, pw="Một phần")
    F = "Hệ thống · Mẫu email (API) và hiệu lực lên email thật"
    A(F, "GET /admin/system/email-templates (lọc q/status) và GET /:key có body", "Chức năng", "Cao", SYS_API + " " + SEED_TPL,
      ["GET /system/email-templates", "GET ?status=draft", "GET ?q=reset", "GET ?status=bogus", "GET /system/email-templates/welcome", "GET /system/email-templates/khong-co"], "-",
      "Danh sách 7 mẫu (isSystem trước), mỗi mẫu {key,name,description,status,isSystem,variables,languages,subject,updatedAt,updatedBy} KHÔNG có body; chi tiết có thêm body {en,vi}; status=bogus 400; khóa lạ 404 'Không tìm thấy mẫu email'.")
    A(F, "POST tạo mẫu: 201, biến tự suy từ nội dung nếu không gửi, trùng 409, validate", "Chức năng", "Cao", SYS_APIM,
      ["POST /system/email-templates {key:'qa_tpl', name:'QA', subject:{en:'Hi {{name}}'}, body:{en:'Code {{code}} for {{name}}'}}", "POST lại cùng key", "POST {key:'Bad Key',...}", "POST thiếu subject.en", "POST subject.vi rỗng chuỗi", "POST variables:['bad-var']", "POST status:'bogus'"], "qa_tpl",
      "Lần 1: 201 status 'draft', isSystem=false, variables tự suy ['name','code'] (theo thứ tự xuất hiện trong tiêu đề rồi nội dung); lần 2: 409 'Khóa mẫu email đã tồn tại'; 3-7: 400 VALIDATION_ERROR; audit email_template.create.")
    A(F, "PATCH mẫu: sửa từng ngôn ngữ (hợp nhất với bản cũ), tự suy lại biến, đổi trạng thái; body rỗng 400", "Chức năng", "Cao", SYS_APIM + " " + SEED_TPL,
      ["PATCH /system/email-templates/welcome {subject:{vi:'Chào {{name}}'}}", "GET xem subject.en còn nguyên", "PATCH {body:{en:'Hi {{name}} {{extra}}'}} (không gửi variables)", "PATCH {status:'disabled'}", "PATCH {status:'active'}", "PATCH {}", "PATCH /system/email-templates/khong-co {name:'x'}"], "welcome",
      "subject.vi đổi, subject.en giữ nguyên (hợp nhất); lần 3 biến tự suy lại gồm 'extra'; audit action email_template.update / disable / enable; {} -> 400 'Không có gì để cập nhật'; khóa lạ 404.")
    A(F, "DELETE: mẫu hệ thống 409, mẫu tự tạo 200, lần 2 404", "Chức năng", "Cao", SYS_APIM,
      ["DELETE /system/email-templates/welcome", "DELETE /system/email-templates/qa_tpl", "DELETE lần 2"], "welcome, qa_tpl", "Lần 1: 409 'Không thể xóa mẫu email hệ thống (hãy đặt trạng thái disabled)'; lần 2: 200 {deleted:true}; lần 3: 404.")
    A(F, "POST preview: thay biến, báo missingVariables, fallback ngôn ngữ, HTML thoát ký tự và tự gắn liên kết", "Chức năng", "Cao", SYS_API + " " + SEED_TPL,
      ["POST /system/email-templates/reset_password/preview {language:'vi', variables:{name:'An', link:'https://sofinhub.com/reset?t=1'}}", "Lặp lại không gửi variables", "language:'en'", "language:'fr'", "Với mẫu chỉ có EN (qa_tpl) gọi language 'vi'", "variables name = '<b>x</b>&\"'"], "reset_password",
      "Lần 1: {subject:'Đặt lại mật khẩu SofinHub', text (đã thay), html chứa <a href=\"https://sofinhub.com/reset?t=1\">...</a> và đoạn văn <p>/<br>, missingVariables:[]}; lần 2: missingVariables ['name','link'] và text còn '{{name}}'; en dùng bản tiếng Anh; language 'fr' -> 400; mẫu chỉ có EN + 'vi' -> dùng bản EN; HTML escape: '<b>x</b>&\"' hiển thị &lt;b&gt;x&lt;/b&gt;&amp;&quot; (không chèn thẻ).")
    A(F, "POST test-send: gửi tới email admin hoặc 'to' chỉ định, tiêu đề [TEST], audit, validate to", "Chức năng", "Cao", SYS_APIM,
      ["POST /system/email-templates/receipt/test-send {variables:{name:'A',id:'1',amount:'$1'}}", "POST .../test-send {to:'khac@example.com', language:'vi'}", "POST {to:'khong-phai-email'}", "GET /api/dev/outbox?to=admin@sofinhub.test và ?to=khac@example.com"], "receipt",
      "Lần 1: 200 {sent:true, to:'admin@sofinhub.test'}; lần 2: to khác; lần 3: 400; outbox có thư '[TEST] Your receipt #1' / '[TEST] Biên lai #1 của bạn'; audit email_template.test_send metadata.to.", pw="Một phần")
    A(F, "Mẫu verify_email 'Đang dùng' được dùng thật khi đăng ký (ghi đè nội dung mặc định)", "Tích hợp", "Cao", SYS_APIM + " Dùng email chưa tồn tại.",
      ["PATCH /system/email-templates/verify_email {subject:{vi:'[QA] Xác thực {{name}}'}, body:{vi:'QA verify {{link}}'}}", "POST /api/auth/register với email mới 'qa.verify@example.com'", "GET /api/dev/outbox?to=qa.verify@example.com"], "verify_email",
      "Thư xác thực có tiêu đề '[QA] Xác thực <tên>' và nội dung 'QA verify <link thật có token>' (ngôn ngữ = Cài đặt chung > Ngôn ngữ mặc định, mặc định 'vi'); link trong thư dùng được để xác thực email.", pw="Một phần")
    A(F, "Mẫu reset_password: 'Đang dùng' -> email quên mật khẩu dùng mẫu; 'Đã tắt'/'Bản nháp' -> dùng nội dung mặc định trong code", "Tích hợp", "Cao", SYS_APIM,
      ["PATCH reset_password {subject:{vi:'[QA] Đặt lại cho {{name}}'}}", "POST /api/auth/forgot-password {email:'member1@sofinhub.test'}", "GET /api/dev/outbox?to=member1@sofinhub.test (thư mới nhất)", "PATCH reset_password {status:'disabled'}", "POST forgot-password lại", "Đọc thư mới nhất", "PATCH {status:'draft'} và lặp lại"], "reset_password",
      "Khi 'Đang dùng': thư mới có tiêu đề '[QA] Đặt lại cho Minh' và link đặt lại hoạt động; khi 'Đã tắt' hoặc 'Bản nháp': thư dùng tiêu đề/nội dung mặc định cố định trong code (không còn '[QA]'); lỗi đọc mẫu không chặn việc gửi thư.", pw="Một phần")
    A(F, "Ngôn ngữ mặc định nền tảng quyết định bản dịch của mẫu khi gửi email thật; thiếu bản dịch dùng bản kia", "Tích hợp", "Trung bình", SYS_APIM,
      ["PATCH /system/settings {platform:{defaultLanguage:'en'}}", "POST /api/auth/forgot-password {email:'member1@sofinhub.test'}", "Đọc thư mới nhất (tiếng Anh: 'Reset your SofinHub password')", "PATCH defaultLanguage:'vi' rồi lặp lại", "Xóa bản vi của mẫu (nếu có) và gửi lại"], "defaultLanguage en/vi",
      "en -> thư dùng tiêu đề/nội dung EN; vi -> bản VI; mẫu thiếu ngôn ngữ đang chọn thì dùng ngôn ngữ còn lại. Mặc định hệ thống là 'vi' (khác tài liệu mockup 'en') để giữ email tiếng Việt như trước.", pw="Một phần")
    A(F, "Quyền system.settings cho Mẫu email: Moderator/Support/Finance 403", "Bảo mật", "Trung bình", SYS_API, ["GET /system/email-templates và POST .../welcome/test-send bằng moderator@, support@, finance@"], "-", "403 'không có quyền \"system.settings\"'.")

    # ============================================================ 14. NHẬT KÝ HOẠT ĐỘNG (AUDIT)
    F = "Hệ thống · Nhật ký hoạt động (UI)"
    SYS_AUI = SYS_UI + " " + SEED_AUD3
    A(F, "Trang 'Nhật ký hoạt động': cột Thời gian, Quản trị viên (+vai trò), Hành động, Đối tượng, Vụ việc, IP", "Giao diện", "Cao", SYS_AUI,
      ["Mở /admin/system/audit", "Đọc tiêu đề, nút 'Xuất CSV' và dòng của Ryan Cho"], "-",
      "Tiêu đề 'Nhật ký hoạt động', phụ đề 'Mọi thao tác quản trị đều được ghi lại: ai làm, làm gì, trên đối tượng nào và vì sao.', nút 'Xuất CSV'; cột Thời gian (dd/mm hh:mm), Quản trị viên (tên + vai trò: 'Hỗ trợ'/'Kiểm duyệt viên'/'Tài chính'/'Super Admin'), Hành động, Đối tượng 'label (Loại)', Vụ việc (8 ký tự đầu hoặc '—'), IP (mono hoặc '—'); dòng seed của nhân viên có IP 113.161.24.10..., phân trang 30 dòng.")
    A(F, "Lọc theo Quản trị viên, Nhóm hành động, Hành động và khoảng ngày; 'Xóa bộ lọc'", "Chức năng", "Cao", SYS_AUI,
      ["Lọc 'Quản trị viên' = Ryan Cho", "Xóa, lọc 'Nhóm hành động' = 'Hỗ trợ'", "Xóa, lọc 'Hành động' = một mã cụ thể", "Chọn Từ ngày/Đến ngày ôm 1 ngày có dữ liệu", "Bấm 'Xóa bộ lọc'"], "-",
      "Ryan Cho: các dòng support.ticket.* của Ryan; Hỗ trợ (tiền tố 'support.'): các dòng support.ticket.*; Hành động: đúng mã đó; khoảng ngày: chỉ dòng trong ngày (từ 00:00:00.000Z đến 23:59:59.999Z UTC); 'Xóa bộ lọc' xóa cả 2 ô ngày; mỗi lần đổi về trang 1; 'Đến ngày' không chọn được nhỏ hơn 'Từ ngày'.")
    A(F, "Tìm kiếm audit theo tên admin, hành động, đối tượng, lý do, mã vụ việc", "Chức năng", "Trung bình", SYS_AUI,
      ["Gõ 'Grace'", "Gõ 'refund'", "Gõ 'Repeated spam'", "Gõ 'Account locked'"], "-", "'Grace': dòng refund.approve của Grace Lee; 'refund': các mã chứa refund; 'Repeated spam': dòng user.warn của Moderator Test; 'Account locked': dòng ticket T-2004 (theo nhãn đối tượng). Không phân biệt hoa/thường.")
    A(F, "Chi tiết dòng audit: Quản trị viên (email · vai trò), Hành động mã, Đối tượng, IP, lý do, dữ liệu kèm theo", "Giao diện", "Trung bình", SYS_AUI,
      ["Bấm dòng 'support.ticket.escalate' của Ryan Cho", "Đọc các cặp khóa-giá trị và khối 'Dữ liệu kèm theo'"], "support.ticket.escalate",
      "Dialog: Quản trị viên 'Ryan Cho (support@sofinhub.test) · Hỗ trợ', Hành động (mono) 'support.ticket.escalate', Đối tượng 'T-2004 · Account locked by mistake (Ticket)', Địa chỉ IP '113.161.24.10', Mã đối tượng (uuid ticket), Lý do 'Needs review by the trust team'; khối JSON chỉ hiện khi có metadata.")
    A(F, "Nhãn hành động tiếng Việt: một số mã hiện nguyên mã (support.ticket.*, discovery.search_visibility, notification.settings_update, audit.export, flag.disable)", "Giao diện", "Thấp", SYS_AUI + " " + MUTATE,
      ["Tạo vài hành động (trả lời ticket, tắt cờ, lưu cấu hình thông báo, xuất CSV)", "Mở bảng audit và đọc cột 'Hành động'"], "-",
      "KỲ VỌNG: mọi mã đều có nhãn tiếng Việt. HIỆN TẠI: bảng dịch FE xử lý dạng '<đối tượng>.<động từ>' nên mã 3 phần 'support.ticket.reply' và các mã có động từ ghép/không có trong từ điển ('flag.disable', 'notification.settings_update', 'discovery.search_visibility', 'audit.export') hiển thị NGUYÊN MÃ; các mã khác có nhãn (vd 'refund.approve' -> 'Duyệt hoàn tiền', 'settings.update' -> 'Cập nhật cài đặt chung', 'flag.enable' -> 'Kích hoạt tính năng thử nghiệm', 'admin.reset_2fa' -> 'Đặt lại 2FA quản trị viên').", st=PLAN, pw="Một phần")
    A(F, "Bộ lọc 'Nhóm hành động' = 'Hệ thống' không trả dòng nào vì không có mã nào bắt đầu bằng 'system.'", "Chức năng", "Trung bình", SYS_AUI + " " + MUTATE,
      ["Tạo vài thao tác hệ thống (tắt cờ, đổi cài đặt chung, gỡ quyền nhân viên)", "Lọc 'Nhóm hành động' = 'Hệ thống'", "Lọc 'Nội dung' và 'Thanh toán'"], "system. / content. / payment.",
      "KỲ VỌNG: nhóm 'Hệ thống' liệt kê các thao tác của mục Hệ thống. HIỆN TẠI: nhóm lọc theo tiền tố 'system.' nhưng mã thật là admin./role./flag./settings./integration./email_template./notification. -> 'Hệ thống' luôn rỗng; 'Nội dung' (tiền tố 'content.') chỉ khớp content.* (không khớp post./comment./course./...); 'Thanh toán' chỉ khớp payment.* (không khớp refund./payout./chargeback.). Dùng ô 'Hành động' để lọc chính xác.", st=PLAN, pw="Một phần")
    A(F, "Xuất CSV từ giao diện: tải file theo bộ lọc hiện tại, toast, tối đa 5.000 dòng", "Chức năng", "Cao", SYS_AUI + " " + MUTATE,
      ["Lọc 'Quản trị viên' = Ryan Cho", "Bấm 'Xuất CSV'", "Mở file tải về trong Excel/Notepad"], "-",
      "Nút đổi 'Đang xuất…' rồi toast 'Đã xuất nhật ký (tối đa 5.000 dòng)'; file 'nhat-ky-hoat-dong-YYYY-MM-DD.csv' chỉ chứa dòng của Ryan (cùng bộ lọc); tiếng Việt không vỡ phông (có BOM UTF-8); tạo thêm 1 dòng audit 'audit.export'.", pw="Một phần")
    F = "Hệ thống · Nhật ký hoạt động (API)"
    A(F, "GET /admin/audit-logs có ip + actor.role; lọc actor/action (tiền tố khi kết thúc bằng '.')/targetType/targetId/q/from/to", "Chức năng", "Cao", SYS_API + " " + SEED_AUD3,
      ["GET /admin/audit-logs?limit=5", "GET ?actor=<id Ryan>", "GET ?action=support.ticket.reply", "GET ?action=support.", "GET ?targetType=ticket", "GET ?q=Repeated", "GET ?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z", "GET ?from=khong-phai-ngay"], "-",
      "Mỗi item có ip (string|null) và actor.role ({key,name}|null: Ryan -> support, Grace -> finance, admin env -> super_admin); lọc action chính xác hoặc tiền tố khi giá trị kết thúc bằng '.'; khoảng 2020 rỗng; from sai định dạng -> 400.")
    A(F, "GET /admin/audit-logs/filters trả actors, actions, targetTypes cho dropdown", "Chức năng", "Trung bình", SYS_API + " " + SEED_AUD3,
      ["GET /admin/audit-logs/filters"], "-", "{data:{actors:[{id,name}...] sắp theo tên (gồm Ryan Cho, Grace Lee, Moderator Test, Tom Baker, Platform Admin...), actions:[mã không trùng, sắp A-Z], targetTypes:[...]}}.")
    A(F, "GET /admin/audit-logs/export trả CSV UTF-8 có BOM, đúng cột, CRLF, Content-Disposition attachment", "Chức năng", "Cao", SYS_API + " " + SEED_AUD3,
      ["GET /admin/audit-logs/export?actor=<id Ryan>", "Đọc header Content-Type và Content-Disposition", "Đọc byte đầu của body", "Đếm dòng so với danh sách"], "-",
      "200 Content-Type 'text/csv; charset=utf-8', Content-Disposition 'attachment; filename=\"audit-logs-YYYY-MM-DD.csv\"'; body bắt đầu U+FEFF (BOM); dòng đầu 'time,admin,action,targetType,targetId,target,case,reason,ip'; các dòng ngăn bằng \\r\\n; số dòng dữ liệu = số bản ghi khớp bộ lọc (≤5000); cell chứa dấu phẩy/ngoặc kép/xuống dòng được bọc \"...\" với \"\" thoát.")
    A(F, "CSV chống formula injection: ô bắt đầu bằng = + - @ tab CR được thêm dấu nháy đơn", "Bảo mật", "Cao", SYS_APIM,
      ["Tạo audit có reason/targetLabel dạng '=HYPERLINK(\"http://x\",\"a\")', '+1+1', '-2', '@SUM(A1)' (vd bằng PATCH ticket subject '=cmd|...' rồi hành động có targetLabel)", "GET /admin/audit-logs/export", "Mở file bằng Excel"], "=HYPERLINK(...)",
      "Các ô độc hại xuất hiện dạng '=HYPERLINK(...) (có ký tự ' đứng trước) nên Excel hiển thị như văn bản, không thực thi công thức; giá trị hợp lệ khác không bị đổi.", pw="Một phần")
    A(F, "Xuất CSV cũng được ghi audit (audit.export) và cần quyền audit.view", "Bảo mật", "Trung bình", SYS_API,
      ["GET /admin/audit-logs/export bằng admin@", "GET /admin/audit-logs?action=audit.export", "GET /admin/audit-logs/export bằng moderator@/support@/finance@"], "-", "Admin: 200 và có dòng audit.export (targetType 'audit', targetLabel 'Audit log CSV'); 3 vai trò khác: 403 'không có quyền \"audit.view\"'.")
    A(F, "Quyền audit.view: chỉ Super Admin mặc định xem Nhật ký; bật cho Moderator thì xem được", "Bảo mật", "Cao", SYS_APIM,
      ["GET /admin/audit-logs bằng moderator@ -> 403", "Bật audit.view cho Moderator ở ma trận", "GET lại; thấy sidebar mục 'Nhật ký hoạt động'", "Tắt lại"], "audit.view", "403 -> sau khi bật: 200 và mục 'Nhật ký hoạt động' xuất hiện trong nhóm Hệ thống của Moderator; tắt lại: 403.", pw="Một phần")
    A(F, "Mọi thao tác ghi của đợt 3 đều tạo đúng 1 dòng audit với mã action tương ứng", "Chức năng", "Cao", SYS_APIM,
      ["Thực hiện 1 thao tác của mỗi nhóm: admin.create/update/suspend/enable/reset_2fa/remove, role.create/update/delete, category.*, flag.create/enable/disable/update/delete, integration.connect/disconnect/update, notification.settings_update/broadcast, email_template.create/update/enable/disable/delete/test_send, settings.update/reset, support.ticket.*",
       "GET /admin/audit-logs?limit=100 sau mỗi thao tác"], "-", "Mỗi thao tác đúng 1 dòng (không trùng, không thiếu) với actor, targetType (admin/role/category/flag/integration/notification/broadcast/email_template/settings/ticket), targetId/targetLabel, ip; thao tác lỗi (4xx) không ghi audit; thao tác chỉ-đọc (GET, test tích hợp, preview) không ghi (trừ audit.export).", pw="Một phần")

    # ============================================================ 15. CÀI ĐẶT CHUNG
    F = "Hệ thống · Cài đặt chung (UI)"
    SET_UI = SYS_UI + " Giá trị mặc định lấy từ env: " + PENDING_DECISION + " hoa hồng 10%, phí cổng 2,9% + 30 cent, cửa sổ hoàn tiền 7 ngày, rút tối thiểu $50, dùng thử 7 ngày, chu kỳ gói 30 ngày " + NOW_ADJUSTABLE + "."
    SET_UIM = SET_UI + " " + MUTATE
    A(F, "Trang 'Cài đặt chung': 3 khối (Nền tảng, Bảo mật, Thanh toán) với giá trị mặc định và nhãn 'Chỉ lưu cấu hình'", "Giao diện", "Cao", SET_UI,
      ["Mở /admin/system/settings", "Đọc từng hàng và gợi ý bên dưới nhãn"], "-",
      "Tiêu đề 'Cài đặt chung', phụ đề 'Cấu hình toàn nền tảng.'; 'Nền tảng': Tên 'SofinHub', Email hỗ trợ (env SUPPORT_EMAIL), Ngôn ngữ mặc định 'Tiếng Việt', Múi giờ 'GMT+7 · Ho Chi Minh City' (gợi ý 'Chỉ lưu cấu hình'); 'Bảo mật': 'Bắt buộc 2FA cho quản trị viên' (Chỉ lưu cấu hình), 'Tự đăng xuất sau' 15/30/120 (30 phút, Chỉ lưu cấu hình), 'Chế độ bảo trì' (TẮT); 'Thanh toán': Hoa hồng 10 %, Phí cổng 2.9 %, Phí cổng cố định 30 cent, Thời hạn hoàn tiền 7 ngày, Mức rút tối thiểu 50 USD, Số ngày dùng thử 7 ngày, Chu kỳ gói đăng ký 30 ngày (các hàng này ghi 'Áp dụng ngay'), Tiền tệ USD và Chi trả tự động BẬT (Chỉ lưu cấu hình). Nút 'Lưu thay đổi' khóa khi chưa đổi.")
    A(F, "Sửa số: chỉ gửi các trường đã đổi; 'Lưu thay đổi'/'Hoàn tác'; 'Cập nhật lần cuối'", "Chức năng", "Cao", SET_UIM,
      ["Đổi Hoa hồng nền tảng 10 -> 12", "Quan sát nút 'Hoàn tác' và 'Lưu thay đổi'", "Bấm 'Hoàn tác'", "Đổi lại 12 và bấm 'Lưu thay đổi'", "Mở Network xem PATCH /api/admin/system/settings", "F5"], "commissionPct 12",
      "Chỉ có trường thay đổi trong body: {payments:{commissionPct:12}}; toast 'Đã lưu cài đặt chung'; hàng Hoa hồng hiện 'Mặc định: 10 · Khôi phục'; dưới trang 'Cập nhật lần cuối <thời gian>.'; F5 vẫn 12; audit settings.update metadata.changes.payments.commissionPct {from:10,to:12}.")
    A(F, "Kiểm tra khoảng giá trị ở giao diện trước khi lưu (7 trường số, tên, email)", "Chức năng", "Cao", SET_UI,
      ["Lần lượt nhập: Hoa hồng 101 / -1 / 'abc'; Phí cổng 100.5; Thời hạn hoàn tiền 366; Mức rút tối thiểu 100001; Số ngày dùng thử 366; Chu kỳ gói 0 và 366; Phí cố định 100001", "Xóa trắng Tên nền tảng; nhập Email hỗ trợ 'abc'", "Quan sát thông báo đỏ và nút 'Lưu thay đổi'"], "-",
      "Thông báo đỏ (role=alert) tương ứng: 'Hoa hồng nền tảng (0–100%) không hợp lệ.', 'Phí cổng thanh toán (0–100%) không hợp lệ.', 'Thời hạn hoàn tiền (0–365 ngày) không hợp lệ.', 'Mức rút tối thiểu không hợp lệ.', 'Số ngày dùng thử (0–365) không hợp lệ.', 'Chu kỳ gói đăng ký (1–365 ngày) không hợp lệ.', 'Phí cố định cổng thanh toán không hợp lệ.', 'Tên nền tảng không được để trống.', 'Email hỗ trợ không hợp lệ.'; nút 'Lưu thay đổi' khóa khi còn lỗi.")
    A(F, "Số ngày dùng thử = 0 và các khoảng FE khác BE: giao diện cho phép, API trả 400", "Chức năng", "Trung bình", SET_UIM,
      ["Đặt 'Số ngày dùng thử' = 0 > 'Lưu thay đổi'", "Đặt 'Phí cổng cố định' = 12.5 > Lưu", "Đặt 'Chu kỳ gói đăng ký' = 366 > Lưu"], "trialDays 0, fixed 12.5, period 366",
      "KỲ VỌNG THEO GIAO DIỆN/TÀI LIỆU: trialDays 0-365. HIỆN TẠI: BE trialDays min 1 -> 400 (toast lỗi); phí cố định phải là số nguyên (12.5 -> 400); chu kỳ gói BE nhận 1-366 trong khi FE chặn >365; mức rút tối thiểu BE nhận tới 1.000.000 còn FE chặn >100.000. Lệch kiểm tra FE/BE (nên thống nhất).", st=PLAN, pw="Một phần")
    A(F, "Khôi phục từng giá trị về mặc định env bằng liên kết 'Mặc định: X · Khôi phục'", "Chức năng", "Cao", SET_UIM,
      ["Đặt Hoa hồng 15 và Mức rút tối thiểu 80 rồi Lưu", "Bấm 'Mặc định: 10 · Khôi phục' ở hàng Hoa hồng", "Đọc dialog > 'Khôi phục'"], "commissionPct",
      "Dialog 'Khôi phục mặc định · commissionPct' ('Giá trị sẽ quay về mặc định của máy chủ (biến môi trường).'); toast 'Đã khôi phục giá trị mặc định'; Hoa hồng về 10 và mất liên kết; Mức rút 80 vẫn còn ghi đè; audit settings.reset metadata.keys.")
    A(F, "'Khôi phục toàn bộ về mặc định' xóa mọi ghi đè", "Chức năng", "Cao", SET_UIM,
      ["Đổi 3 giá trị khác nhau (một ở mỗi khối) và Lưu", "Bấm 'Khôi phục toàn bộ về mặc định' > 'Khôi phục'"], "-", "Dialog 'Khôi phục mặc định · toàn bộ cài đặt'; toast 'Đã khôi phục giá trị mặc định'; mọi giá trị về mặc định env (kể cả chế độ bảo trì tắt); không còn liên kết 'Mặc định: ...'; GET /system/settings.overrides rỗng.")
    A(F, "Bật chế độ bảo trì: dialog xác nhận, chỉ có hiệu lực sau khi bấm 'Lưu thay đổi'", "Chức năng", "Cao", SET_UIM,
      ["Bật công tắc 'Chế độ bảo trì'", "Đọc dialog 'Bật chế độ bảo trì?' > 'Bật khi lưu'", "Kiểm tra GET /api/feature-flags (maintenance)", "Bấm 'Lưu thay đổi'", "Kiểm tra lại"], "maintenanceMode",
      "Dialog danger nói rõ API công khai sẽ trả 503 và Admin/đăng nhập vẫn hoạt động; toast 'Đã đặt chế độ bảo trì (nhớ bấm Lưu thay đổi)'; trước khi Lưu maintenance vẫn false; sau Lưu: GET /api/feature-flags {maintenance:true}. Tắt công tắc không cần xác nhận (chỉ đổi nháp) rồi Lưu.")
    A(F, "Đổi Ngôn ngữ mặc định (Tiếng Anh/Tiếng Việt), Tiền tệ, Tự đăng xuất, Múi giờ: lưu được nhưng chỉ là cấu hình", "Chức năng", "Trung bình", SET_UIM,
      ["Đổi Ngôn ngữ mặc định sang Tiếng Anh, Tiền tệ sang VND, Tự đăng xuất 2 giờ, Múi giờ 'GMT+0', tắt 'Chi trả tự động'", "Lưu", "F5", "GET /api/feature-flags"], "-",
      "Lưu thành công và giữ sau F5; /api/feature-flags.platform.defaultLanguage='en'; Tiền tệ/Tự đăng xuất/Múi giờ/Chi trả tự động chỉ được lưu (xem case Kế hoạch: chưa có cơ chế thực thi).")
    A(F, "Trạng thái tải/lỗi của trang Cài đặt chung", "Giao diện", "Thấp", SET_UI,
      ["Chặn GET /api/admin/system/settings rồi F5", "Bỏ chặn bấm 'Thử lại'"], "-", "'Đang tải…' -> khối lỗi + 'Thử lại' -> dữ liệu hiện bình thường.", pw="Một phần")
    F = "Hệ thống · Cài đặt chung (API)"
    A(F, "GET /admin/system/settings: cấu trúc 3 nhóm, overrides, updatedAt; giá trị mặc định lấy từ env", "Chức năng", "Cao", SYS_API + " " + PENDING_DECISION,
      ["GET /system/settings trên DB sạch", "So với env (PLATFORM_COMMISSION_PCT, GATEWAY_FEE_PCT, GATEWAY_FEE_FIXED_CENTS, REFUND_WINDOW_DAYS, PAYOUT_MIN_USD, TRIAL_DAYS, SUBSCRIPTION_PERIOD_DAYS, SUPPORT_EMAIL)"], "-",
      "data.platform {name:'SofinHub', supportEmail, defaultLanguage:'vi', timezone:'GMT+7 · Ho Chi Minh City'}, data.payments {commissionPct:10, gatewayFeePct:2.9, gatewayFeeFixedCents:30, refundWindowDays:7, payoutMinUsd:50, trialDays:7, subscriptionPeriodDays:30, currency:'USD', autoPayouts:true}, data.security {require2fa:false, sessionTimeoutMin:30, maintenanceMode:false}, overrides {} và updatedAt null (chưa ai sửa). Lưu ý: mặc định require2fa là false (tài liệu ví dụ ghi true).")
    A(F, "PATCH /admin/system/settings: ghi đè từng phần có hiệu lực ngay, overrides/updatedAt, audit changes {from,to}", "Chức năng", "Cao", SYS_APIM,
      ["PATCH {payments:{commissionPct:12}}", "GET /system/settings", "PATCH {platform:{name:'SofinHub QA'}, payments:{refundWindowDays:14}}", "GET /admin/audit-logs?action=settings.update"], "commissionPct 12",
      "Lần 1: 200 trả toàn bộ cấu hình mới, overrides {'payments.commissionPct':{default:10,overridden:true}}, updatedAt có giá trị; lần 3 thêm ghi đè; audit settings.update metadata.changes {'payments.commissionPct':{from:10,to:12}} (mỗi lần PATCH 1 dòng).")
    A(F, "PATCH settings validate: ngoài khoảng, sai kiểu, khóa lạ, nhóm lạ, rỗng -> 400", "Chức năng", "Cao", SYS_APIM,
      ["{payments:{commissionPct:101}}", "{payments:{commissionPct:-1}}", "{payments:{commissionPct:'12'}}", "{payments:{refundWindowDays:1.5}}", "{payments:{trialDays:0}}", "{payments:{subscriptionPeriodDays:367}}", "{payments:{gatewayFeeFixedCents:100001}}", "{security:{sessionTimeoutMin:45}}", "{platform:{defaultLanguage:'fr'}}", "{payments:{currency:'JPY'}}", "{platform:{supportEmail:'abc'}}", "{payments:{khongCo:1}}", "{khongCoNhom:{a:1}}", "{}", "{payments:{}}"], "-",
      "Cả 15 -> 400 VALIDATION_ERROR (khoảng/kiểu/enum/schema strict/'Không có gì để cập nhật'); cấu hình hiện tại không đổi. Hợp lệ: commissionPct 0 và 100; refundWindowDays 0 và 365; trialDays 1..365; subscriptionPeriodDays 1..366; sessionTimeoutMin 15|30|120; supportEmail được chuyển chữ thường.")
    A(F, "POST /admin/system/settings/reset: theo khóa, toàn bộ (rỗng), khóa lạ 400", "Chức năng", "Cao", SYS_APIM,
      ["Ghi đè commissionPct và refundWindowDays", "POST reset {keys:['payments.commissionPct']}", "GET xem overrides", "POST reset {} (hoặc không body)", "POST reset {keys:['payments.khong_co']}", "POST reset {keys:['payments.commissionPct']} khi chưa ghi đè"], "-",
      "Lần 1: chỉ commissionPct về mặc định; overrides còn refundWindowDays; reset {} xóa hết; khóa lạ -> 400 'Khóa cấu hình \"payments.khong_co\" không hợp lệ'; reset khóa chưa ghi đè -> 200 không đổi gì. Audit settings.reset metadata.keys.")
    A(F, "Cache cấu hình: ghi trong cùng tiến trình có hiệu lực ngay; nhiều instance lệch tối đa 10 giây", "Chức năng", "Thấp", SYS_APIM,
      ["PATCH payments.commissionPct = 20", "Ngay lập tức GET /api/courses/paid-demo/revenue bằng owner@ (cùng tiến trình)", "(Nếu chạy 2 instance) gọi qua instance còn lại ngay và sau >10 giây"], "-",
      "Cùng tiến trình: đọc thấy 20 ngay; instance khác có thể còn giá trị cũ tối đa 10 giây (TTL) rồi cập nhật.", pw="Không")
    A(F, "Quyền system.settings cho Cài đặt chung: Moderator/Support/Finance 403 (kể cả khi chỉ đọc)", "Bảo mật", "Cao", SYS_API,
      ["GET /system/settings, PATCH /system/settings, POST /system/settings/reset bằng moderator@, support@, finance@"], "-", "Cả 9 yêu cầu 403 'không có quyền \"system.settings\"'; Super Admin 200.")
    A(F, "Hai admin sửa Cài đặt chung đồng thời: lần ghi sau thắng, không hỏng dữ liệu", "Chức năng", "Thấp", SYS_APIM,
      ["Song song: PATCH commissionPct=11 và PATCH refundWindowDays=9", "GET /system/settings"], "-", "Kết quả: cả hai trường có thể mất một (PATCH đọc-ghi trọn bộ ghi đè) - ghi nhận hành vi: không có khóa lạc quan/ETag; cấu hình cuối luôn hợp lệ theo schema.", pw="Không")
    F = "Hệ thống · Cài đặt chung: hiệu lực thật lên thanh toán"
    SET_APIM = SYS_APIM + " " + PENDING_DECISION + " các giá trị tiền " + NOW_ADJUSTABLE + "."
    A(F, "Hoa hồng nền tảng đổi -> doanh thu chủ cộng đồng và Doanh thu creator của admin đổi theo", "Chức năng", "Cao", SET_APIM + " Token owner@ (chủ paid-demo).",
      ["GET /api/courses/paid-demo/revenue bằng owner@ ghi assumptions.platformCommissionPct và platformCommissionCents", "PATCH {payments:{commissionPct:20}}", "GET revenue lại", "GET /admin/payments/creators/<id owner>", "reset commissionPct"], "10 -> 20",
      "assumptions.platformCommissionPct 10 -> 20; platformCommissionCents ≈ gộp × 20% (gấp đôi), netCents giảm tương ứng; trang Doanh thu creator của admin dùng cùng tỷ lệ; sau reset trở lại 10. Số đã chi trả trước đó không đổi (chỉ tính lại theo tỷ lệ hiện hành - xấp xỉ).")
    A(F, "Phí cổng (% và cố định) đổi -> assumptions và số ròng đổi", "Chức năng", "Cao", SET_APIM + " Token owner@.",
      ["GET revenue ghi gatewayFeePct=2.9, gatewayFeeFixedCents=30, gatewayFeeCents", "PATCH {payments:{gatewayFeePct:5, gatewayFeeFixedCents:100}}", "GET revenue lại"], "5% + 100 cent",
      "assumptions.gatewayFeePct=5, gatewayFeeFixedCents=100; gatewayFeeCents tăng theo (5% × số tiền + 100 cent mỗi giao dịch); netCents giảm; reset trở lại.", pw="Một phần")
    A(F, "Thời hạn hoàn tiền = 0 ngày: yêu cầu hoàn tiền ngay sau khi mua KHÔNG còn tự duyệt", "Chức năng", "Cao", SET_APIM + " Token newbie@ (chưa mua paid-demo) và admin@.",
      ["Mặc định 7 ngày: newbie@ mua paid-demo (checkout + confirm), POST /api/payments/<paymentId>/refund-request {reason:'QA'} -> ghi kết quả", "Admin PATCH refundWindowDays=0", "Dùng tài khoản/ giao dịch khác (sau db:reset): mua rồi gửi refund-request ngay"], "refundWindowDays 7 vs 0",
      "7 ngày: yêu cầu tự duyệt (auto=true, hoàn tiền thực hiện ngay, status approved). 0 ngày: yêu cầu ở trạng thái 'pending' (auto=false) chờ admin duyệt ở Hoàn tiền; tăng lên 365: các giao dịch cũ hơn 7 ngày (vd member1) cũng tự duyệt.", pw="Một phần")
    A(F, "Mức rút tối thiểu đổi -> kiểm tra yêu cầu rút của chủ cộng đồng theo giá trị mới", "Chức năng", "Cao", SET_APIM + " Token owner@ (chủ paid-demo).",
      ["POST /api/courses/paid-demo/payouts {amountCents:3000, method:{type:'bank', bankName:'VCB', accountNumber:'123', accountHolder:'Olivia Owner'}} (mặc định $50)", "Admin PATCH payoutMinUsd=20", "Lặp lại yêu cầu", "PATCH payoutMinUsd=1000 rồi POST amountCents:50000"], "payoutMinUsd 50 -> 20 -> 1000",
      "Mặc định: 400 'Số tiền rút tối thiểu là 50.00 USD'; sau khi hạ còn 20: qua kiểm tra tối thiểu (kết quả tiếp theo phụ thuộc số dư: 201 hoặc 400 'Số tiền rút vượt quá số dư khả dụng', KHÔNG còn lỗi tối thiểu); đặt 1000: 400 'Số tiền rút tối thiểu là 1000.00 USD'.", pw="Một phần")
    A(F, "Số ngày dùng thử đổi -> trialEndsAt của gói dùng thử mới", "Chức năng", "Cao", SET_APIM + " Token newbie@.",
      ["Mặc định 7 ngày: POST /api/courses/paid-demo/trial -> ghi trialEndsAt (≈ now + 7 ngày)", "Sau db:reset: Admin PATCH trialDays=14", "POST trial lại bằng newbie@", "GET /api/courses/paid-demo/subscription"], "trialDays 7 -> 14",
      "trialEndsAt = thời điểm bắt đầu + 14 ngày (so với 7 ngày trước đó); gói dùng thử đã tạo trước đó KHÔNG đổi; Phân tích Chuyển đổi nhận bước 'Bắt đầu dùng thử'.", pw="Một phần")
    A(F, "Chu kỳ gói đăng ký đổi -> currentPeriodEnd của gói mới/gia hạn", "Chức năng", "Cao", SET_APIM + " Token newbie@.",
      ["Admin PATCH subscriptionPeriodDays=60", "newbie@: checkout + confirm paid-demo", "GET /api/courses/paid-demo/subscription"], "subscriptionPeriodDays 60",
      "currentPeriodEnd = currentPeriodStart + 60 ngày (thay vì 30); gói đã có từ trước không bị đổi.", pw="Một phần")
    A(F, "Chế độ bảo trì: API công khai trả 503 MAINTENANCE, danh sách ngoại lệ vẫn hoạt động", "Chức năng", "Cao", SET_APIM + " Token member1@ lấy TRƯỚC khi bật bảo trì.",
      ["Admin PATCH {security:{maintenanceMode:true}}", "Bằng token member1@: GET /api/courses, GET /api/me/subscriptions, GET /api/notifications, POST /api/contact, GET /api/support/tickets, POST /api/courses/paid-demo/checkout", "Không token: GET /api/courses", "GET /api/feature-flags", "POST /api/auth/login (admin@ và member1@), POST /api/auth/refresh", "GET /api/admin/dashboard bằng admin@", "GET /api/dev/outbox", "POST /api/payments/webhook (chữ ký hợp lệ)", "Admin PATCH maintenanceMode:false", "GET /api/courses"], "maintenanceMode true/false",
      "Khi bật: các API công khai (courses, notifications, contact, support, checkout...) -> 503 {error:{code:'MAINTENANCE', message:'Hệ thống đang bảo trì, vui lòng quay lại sau.'}} cho cả khách và người đã đăng nhập; vẫn hoạt động: /api/feature-flags (maintenance:true), /api/auth/* (login/refresh), /api/admin/*, /api/dev/*, /api/payments/webhook; tắt bảo trì -> mọi API trở lại bình thường ngay.")
    A(F, "Bảo trì: admin vẫn đăng nhập và tắt được bảo trì từ giao diện; thành viên chưa có trang bảo trì riêng", "Chức năng", "Cao", SET_UIM,
      ["Bật bảo trì và Lưu", "Cửa sổ ẩn danh: mở http://localhost:5173/ và /communities", "Cửa sổ admin: tiếp tục dùng /admin, đăng xuất rồi đăng nhập lại admin@", "Tắt bảo trì ở Cài đặt chung > Lưu"], "-",
      "Admin vẫn đăng nhập và dùng /admin bình thường, tắt được bảo trì. Phía người dùng: các lời gọi API 503 (danh sách rỗng/lỗi tải); HIỆN TẠI giao diện người dùng CHƯA đọc cờ 'maintenance' để hiện trang bảo trì thân thiện (lệch với mô tả 'Thành viên sẽ thấy trang bảo trì' - xem case Kế hoạch).", pw="Một phần")
    A(F, "Bật bảo trì rồi reset toàn bộ cài đặt cũng tắt bảo trì", "Chức năng", "Thấp", SET_APIM,
      ["PATCH maintenanceMode:true", "POST /system/settings/reset {}", "GET /api/courses"], "-", "Sau reset: maintenance=false, API công khai 200 trở lại.")

    # ============================================================ 16. CÁC VẤN ĐỀ CHUNG: UI, BẢO MẬT, HIỆU NĂNG
    F = "Đợt 3 · giao diện, bảo mật và hiệu năng chung"
    A(F, "Responsive: Phân tích, Hỗ trợ, ma trận quyền và Cài đặt dùng được ở màn 390px", "Giao diện", "Trung bình", UI,
      ["Thu cửa sổ 390x844", "Mở /admin/analytics/retention, /admin/support/tickets, /admin/system/roles, /admin/system/settings, /admin/system/email (trình soạn)", "Mở modal chi tiết ticket"], "390x844",
      "Bảng/ma trận/bản đồ nhiệt cuộn ngang trong khung, không vỡ bố cục trang; lưới KPI xuống 1-2 cột; trình soạn mẫu email xếp 1 cột (xem trước dưới nội dung); modal vừa màn hình, nút xác nhận thấy được; sidebar thành drawer.", pw="Một phần")
    A(F, "Truy cập bàn phím: ô ma trận là checkbox có aria-label, modal đóng bằng Esc, công tắc có nhãn", "Giao diện", "Thấp", UI,
      ["Ở /admin/system/roles: Tab tới một ô ma trận, đọc role/aria-checked/aria-label, nhấn Space", "Ở /admin/system/flags: Tab tới công tắc 'Bật/tắt <tên>'", "Mở dialog thao tác ticket và nhấn Esc"], "-",
      "Ô ma trận role=checkbox, aria-checked đúng, aria-label dạng '<Vai trò>: <Quyền>' (Space bật/tắt, bị khóa thì không đổi); công tắc có aria-label 'Bật/tắt <tên cờ>'; Esc đóng dialog không gửi request; chip khoảng thời gian 7/30/90 là role=tab với aria-selected.", pw="Một phần")
    A(F, "XSS: nội dung ticket/thông báo/mẫu email/tên cờ chứa HTML hiển thị dạng văn bản, không thực thi", "Bảo mật", "Cao", SYS_APIM,
      ["Người dùng tạo ticket với subject/message '<img src=x onerror=alert(1)>'", "Admin mở danh sách + chi tiết ticket", "Admin gửi thông báo với tiêu đề '<script>alert(1)</script>' tới 1 người dùng, người đó mở chuông thông báo", "Admin tạo mẫu email với nội dung '<script>x</script>' rồi 'Xem bản từ máy chủ' (html)", "Tạo cờ có tên '<b>x</b>'"], "<img onerror>, <script>",
      "Mọi nơi hiển thị chuỗi nguyên văn (React thoát ký tự), không có hộp thoại alert/thực thi; HTML dựng từ mẫu email đã escape (&lt;script&gt;) trước khi gắn <p>/<br>/<a>.", pw="Một phần")
    A(F, "Chèn SQL/ký tự đặc biệt vào ô tìm kiếm Hỗ trợ/Tài khoản quản trị/Cờ/Mẫu/Audit", "Bảo mật", "Trung bình", SYS_UI,
      ["Gõ \"' OR 1=1 --\" và '%' vào từng ô tìm kiếm", "Gõ chuỗi 500 ký tự (kiểm tra giới hạn)"], "' OR 1=1 --",
      "Không lỗi 500, không lộ thêm dữ liệu (truy vấn tham số hóa); '%' được coi là ký tự thường; q quá dài > 100 ký tự (ticket/admins/audit) -> 400 hoặc bị cắt theo schema, không crash.", pw="Một phần")
    A(F, "Mọi lỗi API đợt 3 theo dạng {error:{code,message}} và mã trạng thái đúng (401/403/404/400/409)", "Chức năng", "Trung bình", SYS_APIM,
      ["Gọi một số route với sai quyền, sai id, sai body, trùng trạng thái (xem các case API)", "Kiểm tra cấu trúc lỗi và code"], "-", "Luôn {error:{code:'UNAUTHORIZED|FORBIDDEN|NOT_FOUND|VALIDATION_ERROR|CONFLICT', message, details?}}; thông điệp tiếng Việt; không rò rỉ stack trace.")
    A(F, "Hiệu năng: danh sách Hỗ trợ/Audit/Admin phản hồi dưới 1 giây; Audit export 5.000 dòng dưới 5 giây", "Hiệu năng", "Thấp", SYS_API,
      ["Đo GET /admin/support/tickets?limit=100, /admin/audit-logs?limit=100, /admin/system/admins", "Nạp ≥5.000 dòng audit rồi GET /admin/audit-logs/export"], "-", "Danh sách < 1 giây; export 5.000 dòng < 5 giây và đúng 5.000 dòng (giới hạn cứng, dòng mới nhất trước).", pw="Không")

    # ============================================================ 17. ĐIỂM CHƯA LÀM / MÔ PHỎNG / LỆCH (KẾ HOẠCH)
    F = "Điểm chưa làm / mô phỏng / lệch đợt 3"
    P = dict(st=PLAN, pw="Không")
    A(F, "2FA thật cho quản trị viên: hiện chỉ là cờ lưu trữ twoFactorEnabled", "Bảo mật", "Cao", "twoFactorEnabled lưu ở AdminAccount; reset-2fa chỉ tắt cờ + gửi email; không có mã TOTP/SMS.",
      ["Tạo quản trị viên với 'Bắt buộc 2FA ở lần đăng nhập đầu' bật", "Đăng nhập bằng tài khoản đó", "Thử bỏ qua bước 2FA"], "-",
      "KỲ VỌNG SAU KHI LÀM: yêu cầu mã 2FA khi đăng nhập admin, 'Đặt lại 2FA' thật sự buộc thiết lập lại. HIỆN TẠI: đăng nhập không hỏi 2FA; cờ chỉ hiển thị ở cột 2FA; tài khoản env luôn hiển thị 2FA tắt.", **P)
    A(F, "Cài đặt 'Bắt buộc 2FA cho quản trị viên' (require2fa) chỉ lưu, không thực thi", "Bảo mật", "Cao", "security.require2fa lưu ở PlatformSetting.",
      ["Bật 'Bắt buộc 2FA' ở Cài đặt chung > Lưu", "Đăng nhập tom@ (2FA tắt) và vào /admin"], "require2fa=true",
      "KỲ VỌNG SAU KHI LÀM: nhân viên chưa bật 2FA bị buộc thiết lập hoặc bị chặn. HIỆN TẠI: không có tác dụng (giao diện ghi 'Chỉ lưu cấu hình').", **P)
    A(F, "'Tự đăng xuất sau' (sessionTimeoutMin 15/30/120) chỉ lưu, chưa có cơ chế hết phiên admin", "Bảo mật", "Trung bình", "Chỉ lưu cấu hình; access token vẫn theo TTL JWT cố định (15 phút) và refresh.",
      ["Đặt 15 phút > Lưu", "Để admin không thao tác 20 phút rồi gọi API"], "sessionTimeoutMin=15", "KỲ VỌNG SAU KHI LÀM: phiên admin tự hết hạn theo cấu hình. HIỆN TẠI: không thay đổi hành vi phiên.", **P)
    A(F, "Tiền tệ (currency USD/VND/EUR) chỉ lưu: giao dịch/biên lai vẫn USD", "Chức năng", "Trung bình", "payments.currency lưu ở PlatformSetting; mọi số tiền là cent USD.",
      ["Đặt Tiền tệ = VND > Lưu", "Mua gói ở paid-demo và xem biên lai/Giao dịch admin"], "VND", "KỲ VỌNG SAU KHI LÀM: giá/biên lai theo tiền tệ đã chọn + tỷ giá. HIỆN TẠI: không đổi, vẫn '$'.", **P)
    A(F, "Chi trả tự động (autoPayouts, ngày 1 và 16) chỉ lưu: chưa có job chi trả", "Chức năng", "Trung bình", "Không có scheduler chi trả tự động.",
      ["Bật 'Chi trả tự động' > Lưu", "Chờ tới ngày 1/16 (hoặc đổi giờ máy chủ) và xem Chi trả"], "autoPayouts", "KỲ VỌNG SAU KHI LÀM: tự tạo/duyệt chi trả theo lịch. HIỆN TẠI: không có job; vẫn do creator yêu cầu và admin duyệt thủ công.", **P)
    A(F, "Múi giờ nền tảng (timezone) chỉ lưu: thời gian giao diện/Phân tích vẫn theo múi giờ trình duyệt/UTC", "Chức năng", "Thấp", "platform.timezone là chuỗi tự do.",
      ["Đổi Múi giờ 'GMT-5' > Lưu", "Xem thời gian ở Nhật ký/Ticket và ranh giới ngày của Phân tích"], "GMT-5", "KỲ VỌNG SAU KHI LÀM: dùng múi giờ đã chọn. HIỆN TẠI: không đổi; Phân tích tính theo ngày UTC.", **P)
    A(F, "Cảnh báo admin (kiểm duyệt/thanh toán/báo cáo định kỳ) chưa có job gửi tự động", "Tích hợp", "Cao", "Chỉ lưu 9 công tắc + email nhận báo cáo ở PlatformSetting 'admin.alerts'.",
      ["Bật 'Tranh chấp mới' + 'Báo cáo nghiêm trọng' > Lưu", "Tạo tranh chấp (API) và một báo cáo mức critical", "Kiểm tra outbox/Slack"], "alerts", "KỲ VỌNG SAU KHI LÀM: gửi email/thông báo cho nhóm kiểm duyệt/tài chính; gửi 'Tổng kết hằng tuần'. HIỆN TẠI: không có email/job nào; giao diện ghi rõ 'chỉ lưu cấu hình'.", **P)
    A(F, "Tích hợp là mô phỏng: không gọi dịch vụ thật, không lưu khóa thật, 'Kiểm tra' chỉ trả ok khi đã kết nối", "Tích hợp", "Trung bình", SEED_INTEG,
      ["Kết nối Stripe với khóa API thật", "Bấm 'Kiểm tra'", "Dùng tính năng thanh toán"], "-", "KỲ VỌNG SAU KHI LÀM: xác thực khóa với nhà cung cấp, lưu khóa trong secret manager, trường config riêng từng dịch vụ. HIỆN TẠI: dữ liệu giả; thanh toán vẫn qua MockGateway; thẻ chỉ có Kết nối (khóa tùy chọn)/Ngắt/Kiểm tra.", **P)
    A(F, "Cờ tính năng chưa được backend áp dụng: tắt dm_v2/premium_lock không chặn tính năng", "Chức năng", "Cao", SEED_FLAG + " " + MUTATE,
      ["Admin tắt dm_v2 và premium_lock", "member1@ gọi API nhắn tin trực tiếp và mở module bị khóa theo cấp độ"], "dm_v2, premium_lock", "KỲ VỌNG SAU KHI LÀM: máy chủ từ chối/ẩn tính năng theo cờ. HIỆN TẠI: cờ chỉ đọc qua GET /api/feature-flags; backend không tự chặn (FE quyết định).", **P)
    A(F, "Frontend người dùng chưa đọc GET /api/feature-flags (cờ, rollout, maintenance, platform.name)", "Chức năng", "Cao", "Frontend :5173 (không phải /admin).",
      ["Bật app_banner ở admin", "Mở trang chủ người dùng và tìm banner ứng dụng", "Bật bảo trì và tải lại trang người dùng"], "app_banner, maintenance", "KỲ VỌNG SAU KHI LÀM: giao diện hiển thị/ẩn tính năng theo cờ và hiện trang bảo trì. HIỆN TẠI: chưa nối; chỉ quản lý cờ ở Admin (ADMIN_BACKEND_GAPS).", **P)
    A(F, "Ticket: chưa có SLA/tự đóng, gộp ticket, mẫu trả lời nhanh, đính kèm tệp", "Chức năng", "Trung bình", "Ticket chỉ có văn bản; không có thời hạn phản hồi.",
      ["Mở chi tiết ticket, tìm nút đính kèm/SLA/gộp/mẫu trả lời nhanh", "Để ticket 'Chờ phản hồi' 30 ngày"], "-", "KỲ VỌNG SAU KHI LÀM: đính kèm, đồng hồ SLA, tự đóng ticket chờ quá hạn, gộp, trả lời nhanh. HIỆN TẠI: không có.", **P)
    A(F, "Trả lời ticket qua email của khách chưa được nhận về hệ thống", "Tích hợp", "Trung bình", "Chỉ gửi email ra; không có webhook/inbound parse.",
      ["Admin trả lời ticket (email vào outbox)", "Trả lời email đó từ hộp thư khách"], "-", "KỲ VỌNG SAU KHI LÀM: thư trả lời trở thành tin 'Khách' trong ticket. HIỆN TẠI: không nhận email; khách phải trả lời qua API/giao diện (chưa có màn).", **P)
    A(F, "Chỉ email xác thực và quên mật khẩu dùng mẫu DB; welcome/receipt/warning/payout_sent/suspended chưa đọc từ mẫu", "Tích hợp", "Trung bình", SEED_TPL,
      ["Sửa mẫu 'Payment receipt' và 'Violation warning' (Đang dùng)", "Mua gói (biên lai) và cảnh cáo một người dùng", "Đọc thư trong outbox"], "receipt, warning", "KỲ VỌNG SAU KHI LÀM: mọi email hệ thống dùng mẫu 'Đang dùng'. HIỆN TẠI: chỉ verify_email và reset_password; các email khác vẫn dùng nội dung cố định trong code.", **P)
    A(F, "Quyền ở mức nút: giao diện chưa ẩn nút theo quyền (Support thấy nút Cảnh cáo, Finance thấy nút chưa có quyền)", "Chức năng", "Trung bình", "FE chỉ ẩn nhóm/mục menu và chặn trang theo quyền.",
      ["Support: mở /admin/users và menu một người dùng", "Support: mở /admin/payments/payouts tìm nút Giữ/Duyệt"], "-", "KỲ VỌNG SAU KHI LÀM: nút thao tác bị ẩn/vô hiệu khi thiếu user.ban/payout.approve. HIỆN TẠI: nút vẫn hiện, BE trả 403 -> toast lỗi.", **P)
    A(F, "Phân tích: chưa có xuất CSV và chọn khoảng ngày tùy ý (from/to)", "Chức năng", "Thấp", "Chỉ chip 7/30/90 ngày; endpoint không nhận from/to.",
      ["Tìm nút Xuất/bộ chọn ngày ở 6 trang Phân tích", "GET /analytics/users?from=...&to=..."], "-", "KỲ VỌNG SAU KHI LÀM: xuất CSV và khoảng ngày tùy chọn. HIỆN TẠI: không có; tham số lạ bị bỏ qua (range vẫn 30).", **P)
    A(F, "Phân tích: chưa có 'Lượt truy cập' (visit) và 'Nguồn đăng ký'; phễu bắt đầu từ Tạo tài khoản", "Chức năng", "Trung bình", "Không thu thập dữ liệu khách chưa đăng nhập và nguồn đăng ký.",
      ["Mở Phân tích > Chuyển đổi và Người dùng, tìm 'Truy cập → Đăng ký', 'Nguồn đăng ký'"], "-", "KỲ VỌNG SAU KHI LÀM: bước 'Xem trang cộng đồng', KPI 'Truy cập → Đăng ký', thẻ nguồn đăng ký (Organic/Creator referral/Social/Direct/Paid). HIỆN TẠI: ẩn các thẻ đó.", **P)
    A(F, "Phân tích: DAU/WAU/MAU theo ngày, địa lý tự khai, phí nền tảng xấp xỉ, lịch sử hoạt động đăng nhập thiếu", "Chức năng", "Trung bình", "Các giới hạn của phép tính SQL trực tiếp (ghi chú tính toán trong admin-batch3.md).",
      ["Đọc biểu đồ 'Người dùng hoạt động' và thẻ 'Phân bố địa lý'", "So Phí nền tảng với tổng phí theo từng giao dịch", "So hoạt động đăng nhập ngày xa với bảng Session"], "-",
      "KỲ VỌNG SAU KHI LÀM: chuỗi DAU/WAU/MAU theo ngày, địa lý từ IP/hồ sơ chuẩn, phí đã chốt theo giao dịch, lịch sử phiên. HIỆN TẠI: chỉ 'hoạt động trong ngày'; địa lý = trường location tự khai; platformFeesCents = gộp × hoa hồng HIỆN TẠI; Session.lastUsedAt chỉ giữ lần dùng gần nhất nên ngày xa thiếu hoạt động đăng nhập.", **P)
    A(F, "changePct rất lớn khi kỳ trước gần 0: BE chưa có cờ baselineTooSmall", "Chức năng", "Thấp", "FE tự rút gọn (25.3K%).",
      ["Tạo dữ liệu mới khi kỳ trước gần 0 và đọc KPI"], "-", "KỲ VỌNG SAU KHI LÀM: BE trả cờ/ null để FE không hiển thị phần trăm vô nghĩa. HIỆN TẠI: BE trả số rất lớn, FE rút gọn.", **P)
    A(F, "Hỗ trợ: tab trạng thái chưa có số đếm và chưa có tab 'Đã đóng' (BE chưa trả byStatus)", "Giao diện", "Thấp", SEED_TICKET,
      ["Mở /admin/support/tickets và đọc các tab"], "-", "KỲ VỌNG SAU KHI LÀM: mỗi tab có số đếm (Mới 5, Đang mở 7, Chờ phản hồi 4, Đã xử lý 4) và tab 'Đã đóng'. HIỆN TẠI: tab không có số; ticket đã đóng chỉ thấy ở 'Tất cả'.", **P)
    A(F, "Tài khoản quản trị: chưa có 'Gửi lại lời mời', lịch sử đăng nhập; vai trò: ma trận chưa nhóm theo group, chưa xem thành viên của vai trò", "Chức năng", "Thấp", "Khoảng trống đã ghi ở ADMIN_BACKEND_GAPS.",
      ["Mở Tài khoản quản trị và Vai trò & Quyền, tìm các tính năng trên"], "-", "KỲ VỌNG SAU KHI LÀM: gửi lại lời mời, lịch sử đăng nhập, phân nhóm quyền theo group, danh sách thành viên theo vai trò. HIỆN TẠI: không có; thẻ vai trò chỉ hiện số thành viên; ma trận phẳng.", **P)
    A(F, "Tạm khóa/gỡ nhân viên không thu hồi phiên đăng nhập thường (chỉ chặn /admin ở mỗi request)", "Bảo mật", "Trung bình", "resolveStaff kiểm tra trạng thái nhân viên mỗi request /admin; Session/tokenVersion không bị động tới.",
      ["Tạm khóa tom@ ở Tài khoản quản trị", "Kiểm tra phiên đăng nhập thường của tom@ (Phiên đăng nhập, API thường)"], "tom@", "GHI NHẬN: phiên thường vẫn hoạt động (chủ ý: chỉ khóa quyền admin). Nếu muốn buộc đăng nhập lại cần thêm bước thu hồi phiên - chưa chốt.", **P)
    A(F, "Lệch tài liệu: admin-batch3.md ghi route chi trả của đợt 2 chỉ có GET (payment.view), thực tế có POST hold/approve/... cần payout.approve", "Chức năng", "Thấp", "So docs/api/admin-batch3.md (mục Khác biệt) với admin-b2.routes.ts và requiredPermission.",
      ["Gọi POST /admin/payments/payouts/x/hold bằng support@ (có payment.view, không có payout.approve)"], "support@", "KỲ VỌNG THEO TÀI LIỆU: ... payment.view. THỰC TẾ (code): POST dưới /admin/payments/payouts cần payout.approve -> 403 cho Support. Cần sửa tài liệu cho khớp code.", **P)
    A(F, "Lệch nhãn: giao diện dùng 'Kiểm duyệt viên/Hỗ trợ/Tài chính' còn API trả Moderator/Support/Finance; audit seed ghi T-2002 cho ticket đầu tiên (thực tế T-2001)", "Giao diện", "Thấp", SYS_UI + " " + SEED_AUD3,
      ["Đối chiếu nhãn vai trò ở sidebar/Tài khoản quản trị với GET /admin/me", "Mở dòng audit support.ticket.reply của Ryan Cho và so mã ticket với danh sách"], "-", "GHI NHẬN: nhãn vai trò khác nhau giữa FE và API; nhãn mục tiêu 'T-2002 · Cannot log in...' của dòng audit seed lệch 1 so với mã thật T-2001 (mã tính theo số tự tăng).", **P)
    A(F, "Giá trị nghiệp vụ tạm (hoa hồng 10%, phí cổng, cửa sổ hoàn tiền 7 ngày, rút tối thiểu $50, cổng thanh toán, kick/ban hoàn tiền, xác thực SSE) vẫn chưa chốt dù đã chỉnh được ở Cài đặt chung", "Chức năng", "Cao", PENDING_DECISION + " Mặc định env; nay đổi được ở Admin > Hệ thống > Cài đặt chung và 'Khôi phục'.",
      ["Đổi từng giá trị ở Cài đặt chung và kiểm tra Doanh thu/Hoàn tiền/Chi trả/Dùng thử (xem các case 'hiệu lực thật')", "Ghi lại giá trị chính thức khi người dùng chốt"], "-",
      "KỲ VỌNG SAU KHI CHỐT: đặt giá trị mặc định (env) đúng quyết định và cập nhật các case gắn thẻ [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]. HIỆN TẠI: giá trị tạm; cổng thanh toán vẫn MockGateway, kick/ban không hoàn tiền, xác thực SSE chưa chốt (tài liệu PLAN.md).", **P)
