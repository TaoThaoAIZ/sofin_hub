# -*- coding: utf-8 -*-
"""Hai sheet phụ của SofinHub_TestCases.xlsx: 'Tài khoản & dữ liệu test' và 'Nhật ký thay đổi'.
Nội dung lấy từ backend/prisma/seed-accounts.ts + backend/prisma/seed/*.ts + backend/docs/API.md + PLAN.md (đợt 2026-09-30).
Sửa dữ liệu seed ở BE thì cập nhật lại các bảng dưới đây cho khớp."""
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

FONT = "Arial"
HDR_FILL = PatternFill("solid", fgColor="1F4E78")
HDR_FONT = Font(name=FONT, size=10, bold=True, color="FFFFFF")
H2 = Font(name=FONT, size=12, bold=True, color="1F4E78")
BASE = Font(name=FONT, size=10)
BOLD = Font(name=FONT, size=10, bold=True)
CODE = Font(name="Consolas", size=10)
THIN = Side(style="thin", color="B7B7B7")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(vertical="top", wrap_text=True)


def _title(ws, text, ncols):
    ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=ncols)
    c = ws.cell(row=1, column=1, value=text)
    c.font = Font(name=FONT, size=16, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1F4E78")
    c.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30


def _h2(ws, r, text):
    ws.cell(row=r, column=1, value=text).font = H2
    return r + 1


def _table(ws, r, headers, data, code_cols=()):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row=r, column=i, value=h)
        c.font, c.fill, c.border = HDR_FONT, HDR_FILL, BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    r += 1
    for row in data:
        longest = 1
        for i, v in enumerate(row, start=1):
            c = ws.cell(row=r, column=i, value=v)
            c.font = CODE if i in code_cols else BASE
            c.border, c.alignment = BORDER, WRAP
            longest = max(longest, str(v).count("\n") + 1 + len(str(v)) // 55)
        ws.row_dimensions[r].height = min(max(15 * longest, 18), 300)
        r += 1
    return r + 1


# ---------------------------------------------------------------------------
# Sheet: Tài khoản & dữ liệu test
# ---------------------------------------------------------------------------
ACCOUNTS = [
    ("admin", "admin@sofinhub.test", "Platform Admin", "Platform Admin (đội SofinHub). Không thuộc cộng đồng nào nhưng ghi đè quyền mọi cộng đồng. Cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test trong backend/.env.",
     "/admin/refunds?status=pending có 1 yêu cầu hoàn tiền NGOÀI cửa sổ 7 ngày (người yêu cầu: thành viên minh họa demo-paid-demo-2); /admin/payouts?status=requested có 1 payout chờ duyệt (của owner); khóa/mở khóa cộng đồng; xem/xử lý báo cáo mọi cộng đồng.",
     "Khu quản trị nền tảng, khóa cộng đồng (COMMUNITY_LOCKED), duyệt hoàn tiền/rút tiền, ma trận quyền Platform Admin, ban tài khoản."),
    ("owner", "owner@sofinhub.test", "Olivia Owner", "Owner của photo, yt, fin, private-demo, paid-demo (Course.ownerId).",
     "paid-demo ($19/tháng): /courses/paid-demo/revenue có giao dịch ~90 ngày, MRR, số dư khả dụng, 1 payout đang 'requested' + 1 payout 'paid'. private-demo: 2 JoinRequest pending (newbie, member1) + 5 mã mời DEMO-*. photo: bài ghim nội quy seed-post-photo-owner-pinned; host sự kiện seed-event-photo-full & seed-event-photo-past. fin: certificatesEnabled.",
     "Quyền Owner-only (đổi giá/riêng tư, xóa cộng đồng, cấp admin, chuyển quyền, doanh thu, rút tiền), duyệt yêu cầu tham gia, tạo/thu hồi lời mời."),
    ("cadmin", "cadmin@sofinhub.test", "Adam CommunityAdmin", "Admin cộng đồng photo (trên mod, dưới owner).",
     "Không có dữ liệu riêng; dùng để kiểm tra ranh giới admin: kick/ban/đặt mod/duyệt yêu cầu/tạo lời mời/bật chứng nhận ĐƯỢC; đổi giá, xóa cộng đồng, cấp admin, xem doanh thu, rút tiền KHÔNG.",
     "Ma trận quyền mức admin; cadmin không tác động được lên owner/admin cùng bậc."),
    ("mod", "mod@sofinhub.test", "Mia Moderator", "Mod của cộng đồng photo.",
     "Host sự kiện seed-event-photo-limited (Workshop chụp chân dung, capacity 3); báo cáo đang chờ seed-report-photo-open (member3 báo bài ảnh seed-post-photo-m1-image, lý do inappropriate) để mod xử lý; đã xử lý seed-report-photo-resolved (ẩn bài quảng cáo).",
     "Ghim/ẩn bài, xóa bình luận, tạo/sửa/xóa sự kiện, quản lý lớp học, xử lý báo cáo; KHÔNG kick/ban, không bật chứng nhận."),
    ("member1", "member1@sofinhub.test", "Minh Member1", "Thành viên photo, yt, fin.",
     "photo: bài có ảnh+thẻ seed-post-photo-m1-image (2 bình luận, 5 like), poll seed-post-photo-m1-poll (3 lựa chọn, đang mở), bài bị ẩn seed-post-photo-m1-hidden; xong TOÀN BỘ module 1 (module 2 mở khóa); điểm photo 110 (7d=35, 30d=65, all=110); đánh giá 5 sao; RSVP sự kiện quá khứ. yt: xong module 1, module 2 khóa theo cấp độ (requiredLevel=2, cần >= 20 điểm ở yt). fin: 100% bài + chứng nhận FIN-DEMO-CERT-001. paid-demo: gói ACTIVE (2 giao dịch succeeded có hóa đơn INV, còn ~20 ngày). 7 thông báo (4 chưa đọc); hội thoại seed-conv-member1-member2 (8 tin, 3 tin chưa đọc từ member2). JoinRequest pending ở private-demo.",
     "Người dùng chính cho hầu hết kịch bản: tiến độ/khóa module, chứng nhận, gói đang hoạt động, hóa đơn, thông báo, chat."),
    ("member2", "member2@sofinhub.test", "Mai Member2", "Thành viên photo.",
     "photo: xong 2 bài đầu; RSVP seed-event-photo-limited (còn đúng 1 chỗ: 2/3) và sự kiện quá khứ; đã vote poll (đáp án Phố cổ Hà Nội); bình luận bài ảnh của member1; điểm photo 30 (7d=12); đánh giá 4 sao. paid-demo: gói ACTIVE đã 'hủy cuối kỳ' (cancelAtPeriodEnd, còn truy cập ~15 ngày, có thể Tiếp tục gói). Chat với member1.",
     "RSVP chỗ cuối (race với member3), hủy/tiếp tục gói, người báo cáo bài quảng cáo (report resolved)."),
    ("member3", "member3@sofinhub.test", "Manh Member3", "Thành viên photo.",
     "photo: chưa học bài nào; điểm photo 6; đánh giá 3 sao; người báo cáo seed-report-photo-open. paid-demo: đang DÙNG THỬ (trialing, còn ~4 ngày, chưa có thanh toán). NotificationPreference không mặc định: tắt post_liked & member_joined, emailDigest = weekly.",
     "Hủy trong dùng thử, tùy chọn thông báo, RSVP chỗ cuối (đua với member2/cadmin), tiến độ 0%."),
    ("newbie", "newbie@sofinhub.test", "Nam Newbie", "Chưa thuộc cộng đồng nào.",
     "JoinRequest pending ở private-demo (ghi chú 'Chào admin, em muốn tham gia để học hỏi ạ.'). Dùng để thử: tham gia cộng đồng miễn phí (vd yt/fin công khai), mã mời DEMO-VALID, checkout paid-demo -> confirm -> hoàn tiền tự duyệt trong 7 ngày, nhận 402/403 khi chưa đủ điều kiện.",
     "Luồng tham gia/thanh toán từ đầu; kiểm tra quyền của người không phải thành viên."),
    ("banned", "banned@sofinhub.test", "Bao Banned", "Bị cấm khỏi photo (có CommunityBan, vẫn còn dòng Enrollment nhưng không được coi là thành viên).",
     "Chỉ ảnh hưởng photo; các cộng đồng khác không bị chặn.",
     "Mọi hành động ở photo bị từ chối; không tham gia lại được; không hiện trong danh sách thành viên/xếp hạng."),
]

SPECIAL = [
    ("Cộng đồng", "photo / yt / fin", "Cộng đồng có kịch bản đầy đủ (bài viết, sự kiện, lớp học, điểm). photo: 12 bài học = 2 module x 6, bật chứng nhận. yt: 24 bài (4x5+4), module 2 khóa cấp độ 2. fin: 16 bài (5+5+6), bật chứng nhận. Owner cả ba: owner@.", "owner, member1..3, cadmin, mod, banned"),
    ("Cộng đồng", "private-demo", "Riêng tư, miễn phí. Yêu cầu tham gia pending: seed-jr-private-demo-newbie, seed-jr-private-demo-member1. Người ngoài nhận 403 JOIN_REQUEST_REQUIRED khi tham gia thẳng.", "owner, newbie, member1"),
    ("Cộng đồng", "paid-demo", "Công khai, có phí $19/tháng (priceCents=1900). Nơi có toàn bộ dữ liệu thanh toán/doanh thu/gói.", "owner, member1..3, newbie, admin"),
    ("Cộng đồng", "~23 cộng đồng khác + ~1.5K user minh họa", "Cộng đồng do thành viên minh họa isDemo làm chủ (id demo-<courseId>-<i>, email seed-<courseId>-<i>@demo.sofinhub.invalid, KHÔNG đăng nhập được). Mỗi cộng đồng có 4 bài, 1 sự kiện sắp tới (Zoom Q&A, capacity 100) + 1 sự kiện đã qua, module/bài học, sổ điểm.", "khách, mọi tài khoản"),
    ("Mã mời", "DEMO-VALID", "private-demo, tối đa 5 lượt, còn hạn ~30 ngày -> tham gia được.", "newbie"),
    ("Mã mời", "DEMO-EXPIRED", "private-demo, đã hết hạn 2 ngày trước -> 410 INVITE_EXPIRED.", "bất kỳ"),
    ("Mã mời", "DEMO-REVOKED", "private-demo, đã thu hồi -> 410 INVITE_REVOKED.", "bất kỳ"),
    ("Mã mời", "DEMO-USED", "private-demo, maxUses=1 usedCount=1 -> 410 INVITE_EXHAUSTED.", "bất kỳ"),
    ("Mã mời", "DEMO-PAID", "paid-demo, không giới hạn -> nhận lời mời vẫn 402 PAYMENT_REQUIRED (lời mời không miễn phí).", "newbie"),
    ("Chứng nhận", "FIN-DEMO-CERT-001", "Chứng nhận của member1 ở fin; xác minh công khai không cần đăng nhập (GET /api/certificates/:code -> {valid, holderName, courseTitle, issuedAt}; trang FE xác minh).", "member1, khách"),
    ("Bài viết (photo)", "seed-post-photo-m1-image", "Bài của member1 có ảnh + thẻ #HoàngHôn #Portrait #ChiaSẻ, 5 like, 2 bình luận (member2, demo #3); có báo cáo đang chờ.", "member1, member2, member3, mod"),
    ("Bài viết (photo)", "seed-post-photo-m1-poll", "Poll 'Địa điểm chụp cuối tuần?' 3 lựa chọn (o1 Phố cổ Hà Nội, o2 Bãi biển Mỹ Khê, o3 Đồi chè Mộc Châu), không multi, hết hạn sau ~30 ngày. Phiếu: member2 -> o1, demo#1 -> o1, demo#2 -> o2 (tổng 3).", "member1, member2"),
    ("Bài viết (photo)", "seed-post-photo-m1-hidden", "Bài quảng cáo của member1 đã bị mod ẩn; member thường không thấy, GET trả 404; tác giả & mod+ vẫn thấy kèm hidden=true.", "member1, mod"),
    ("Bài viết (photo)", "seed-post-photo-owner-pinned", "Bài ghim 'Nội quy cộng đồng Nhiếp ảnh' của owner (announcement).", "owner, mod"),
    ("Báo cáo (photo)", "seed-report-photo-open / seed-report-photo-resolved", "open: member3 báo bài ảnh của member1 (inappropriate). resolved: member2 báo bài quảng cáo (spam), mod đã hide_content.", "mod, cadmin, owner, admin"),
    ("Sự kiện (photo)", "seed-event-photo-limited", "Workshop chụp chân dung ngoài trời, capacity 3, đã có member2 + demo#1 (2/3) -> còn 1 chỗ cuối, host mod, sắp tới +7 ngày.", "member1, member3, cadmin (đua chỗ cuối)"),
    ("Sự kiện (photo)", "seed-event-photo-full", "Photowalk phố cổ, capacity 2, đầy 2/2 (demo#1, demo#2) -> RSVP trả 409, +3 ngày, host owner.", "member1..3"),
    ("Sự kiện (photo)", "seed-event-photo-past", "Livestream chấm ảnh, đã qua ~7 ngày; RSVP -> lỗi 'Sự kiện đã diễn ra'; member1, member2, demo#3 đã tham gia.", "member1, member2"),
    ("Thanh toán (paid-demo)", "seed-sub-member1 / seed-pay-member1-a,b", "Gói active; 2 giao dịch succeeded (initial 40 ngày trước, renewal 10 ngày trước), mỗi giao dịch có hóa đơn INV-YYYY-nnnnnn.", "member1"),
    ("Thanh toán (paid-demo)", "seed-sub-member2", "Gói active + cancelAtPeriodEnd (hủy 2 ngày trước), còn 15 ngày -> nút 'Tiếp tục gói'.", "member2"),
    ("Thanh toán (paid-demo)", "seed-sub-member3", "Gói trialing còn ~4 ngày, chưa có giao dịch -> hủy trong dùng thử không mất phí.", "member3"),
    ("Thanh toán (paid-demo)", "seed-pay-refunded / seed-pay-pendref", "Giao dịch đã hoàn tiền (demo#1, RefundRequest approved) và yêu cầu hoàn tiền pending ngoài cửa sổ (demo#2) -> admin duyệt/từ chối.", "admin, owner"),
    ("Thanh toán (paid-demo)", "seed-sub-hist-3..10", "Lịch sử thanh toán hàng tháng của demo#3..#10 (demo#10 hủy cuối kỳ) tạo số liệu doanh thu ~90 ngày cho owner.", "owner"),
    ("Thông báo", "seed-notif-member1-1..7", "7 thông báo của member1 (4 chưa đọc: post_liked, post_commented, event_reminder, message_received; 3 đã đọc: event_created, payment_succeeded, system).", "member1"),
    ("Tin nhắn", "seed-conv-member1-member2", "Hội thoại 8 tin giữa member1 và member2, 1 tin đã thu hồi, 3 tin member2 gửi chưa đọc (phía member1).", "member1, member2, member3 (IDOR)"),
    ("Điểm & cấp độ", "SeedPoints photo", "member1=110, member2=30, member3=6 điểm ở photo; các thành viên minh họa có 3 mốc thời gian (<=7d, 8-30d, >30d) đủ Cấp 1..6.", "member1..3"),
]

SETUP = [
    ("1", "Cài đặt phụ thuộc (lần đầu)", "npm run install:all && npm install   (ở thư mục gốc sofin_hub)"),
    ("2", "Tạo file môi trường", "cd backend && cp .env.example .env   -> đảm bảo có PLATFORM_ADMIN_EMAILS=admin@sofinhub.test"),
    ("3", "Bật Docker Desktop rồi chạy Postgres 16 (cổng 5435)", "cd backend && npm run db:up      (hoặc ở gốc: npm run db:up) - docker compose up -d --wait"),
    ("4", "Áp migration (37 bảng)", "cd backend && npm run db:deploy"),
    ("5", "Nạp dữ liệu test (idempotent, chạy lại không nhân đôi)", "cd backend && npm run db:seed      -> in 'Seed xong ... Mật khẩu test: Passw0rd!x'"),
    ("6", "Chạy backend :4000 + frontend :5173", "Ở gốc: npm run dev     (hoặc riêng: cd backend && npm run dev ; cd frontend && npm run dev). Mở http://localhost:5173 (Vite proxy /api sang :4000)."),
    ("7", "Đưa DB về trạng thái sạch (khi dữ liệu bị test làm bẩn)", "cd backend && npm run db:reset      (migrate reset --force + seed). Lưu ý: xóa toàn bộ dữ liệu."),
    ("8", "Xem dữ liệu trực tiếp", "cd backend && npm run db:studio   (Prisma Studio)"),
    ("9", "Chạy test tự động của BE (224 test, DB thật, mỗi file một schema tạm)", "cd backend && npm test ; npm run typecheck"),
    ("10", "Chạy Playwright (người test tự chạy)", "cd e2e && npx playwright test ; sau đó cd .. && python qa/apply_playwright_results.py && python qa/embed_evidence_images.py (xem qa/README.md)"),
    ("11", "Lấy token quên mật khẩu / xác thực email (email chưa gửi thật)", "GET http://localhost:4000/api/dev/outbox?to=<email> (chỉ có khi NODE_ENV != production) -> trả các thư trong outbox bộ nhớ; lấy link/token trong nội dung thư (đặt lại mật khẩu: {FRONTEND_URL}/reset-password?token=..., xác thực email: {FRONTEND_URL}/verify-email?token=...; hoặc gọi POST /api/auth/reset-password / /api/auth/verify-email với token đó). Outbox nằm trong bộ nhớ tiến trình, mất khi restart BE."),
    ("12", "Đăng nhập nhanh bằng API", "POST http://localhost:4000/api/auth/login  body {\"email\":\"member1@sofinhub.test\",\"password\":\"Passw0rd!x\"} -> lấy data.accessToken, gửi header Authorization: Bearer <token>."),
    ("13", "Lưu ý khi test song song", "Nhiều case làm thay đổi dữ liệu seed (RSVP, hoàn tiền, đổi mật khẩu, kick...). Chạy db:reset giữa các đợt hoặc dùng tài khoản riêng đăng ký mới để tránh ảnh hưởng nhau. Tài khoản seed dùng chung nên KHÔNG đổi mật khẩu/xóa tài khoản seed trừ khi case yêu cầu và phải reset lại sau đó."),
]


def build_accounts_sheet(wb):
    ws = wb.create_sheet("Tài khoản & dữ liệu test")
    _title(ws, "TÀI KHOẢN & DỮ LIỆU TEST — SOFINHUB", 6)
    ws.cell(row=2, column=1, value="Nguồn: backend/prisma/seed-accounts.ts + backend/prisma/seed/*.ts (chạy npm run db:seed). Mật khẩu chung mọi tài khoản seed: Passw0rd!x").font = BOLD
    r = 4
    r = _h2(ws, r, "A. Tài khoản seed cố định (@sofinhub.test)")
    # Cột: Key | Email | Mật khẩu | Vai trò (tên + mô tả) | Dữ liệu đặc biệt gắn với tài khoản | Dùng để test
    table = [(a[0], a[1], "Passw0rd!x", f"{a[2]} — {a[3]}", a[4], a[5]) for a in ACCOUNTS]
    r = _table(ws, r, ["Key", "Email", "Mật khẩu", "Tên & vai trò", "Dữ liệu đặc biệt gắn với tài khoản", "Dùng để test"], table, code_cols=(1, 2, 3))
    r = _h2(ws, r, "B. Ma trận thành viên cộng đồng (Enrollment seed)")
    matrix = [
        ("photo", "owner", "cadmin (admin), mod (mod)", "member1, member2, member3", "banned (CommunityBan)", "Chưa: newbie"),
        ("yt", "owner", "-", "member1", "-", "Chưa: member2, member3, newbie"),
        ("fin", "owner", "-", "member1", "-", "Chưa: member2, member3, newbie"),
        ("private-demo", "owner", "-", "-", "-", "Pending: newbie, member1"),
        ("paid-demo", "owner", "-", "member1, member2, member3 (theo gói/dùng thử)", "-", "newbie chưa mua"),
    ]
    r = _table(ws, r, ["Cộng đồng", "Owner", "Admin/Mod", "Member", "Bị ban", "Ghi chú"], matrix)
    r = _h2(ws, r, "C. Dữ liệu đặc biệt (id/mã cố định trong seed)")
    r = _table(ws, r, ["Nhóm", "Mã / ID", "Mô tả & số liệu", "Tài khoản liên quan"], SPECIAL, code_cols=(2,))
    r = _h2(ws, r, "D. Khởi tạo môi trường test")
    r = _table(ws, r, ["Bước", "Việc cần làm", "Lệnh / cách thực hiện"], SETUP, code_cols=(3,))
    for i, w in enumerate([16, 30, 46, 46, 70, 44], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A4"
    return ws


# ---------------------------------------------------------------------------
# Sheet: Nhật ký thay đổi
# ---------------------------------------------------------------------------
def build_changelog_sheet(wb, stats):
    """stats: dict(old_total, new_total, by_module=[(code,name,old,new)], flipped=int, still_plan=int)"""
    ws = wb.create_sheet("Nhật ký thay đổi")
    _title(ws, "NHẬT KÝ THAY ĐỔI — ĐỢT HOÀN THIỆN BACKEND + TÍCH HỢP FRONTEND (2026-09-30)", 5)
    ws.cell(row=2, column=1, value="Ghi lại theo thứ tự thực hiện những gì đã làm và tác động tới bộ test case.").font = BOLD
    r = 4
    r = _h2(ws, r, "A. Những gì đã làm (theo thứ tự)")
    log = [
        ("1", "Sửa lỗi phân quyền (bảo mật)", "Trước đây MỌI thành viên đều ghim được bài và tạo được sự kiện. Nay chỉ mod trở lên (requireRole/policy). Thêm vai trò thật member|mod|admin|owner + Platform Admin qua env PLATFORM_ADMIN_EMAILS. FE ẩn nút theo viewerRole (trả trong GET /courses/:id).",
         "backend/docs/API.md (bảng phân quyền)", "Thay đổi kỳ vọng case cũ COMMVP 'Ghim / bỏ ghim bài viết' (nay chỉ mod+). Thêm case ma trận quyền ghim/tạo sự kiện ở FEED, EVENT, ROLE."),
        ("2", "Bổ sung ~120 API mới (tổng ~150 route) theo 7 nhóm", "(1) Danh tính: auth, hồ sơ, quên/đặt lại/đổi mật khẩu, xác thực email, phiên đăng nhập, xóa tài khoản, newsletter, liên hệ. (2) Cộng đồng: tạo/sửa/xóa/khóa, 3 luồng tham gia, yêu cầu tham gia, lời mời, đổi vai trò, kick/ban, chuyển quyền, đánh giá. (3) Nội dung: bài viết (sửa/xóa/ẩn/chia sẻ/poll/thẻ), bình luận, sự kiện (CRUD, RSVP, .ics, nhắc lịch). (4) Kiểm duyệt: báo cáo, xử lý báo cáo, admin nền tảng. (5) Lớp học: CRUD module/bài học, player, tiến độ, khóa theo module/cấp độ, chứng nhận + xác minh công khai. (6) Tìm kiếm + thông báo (SSE) + tin nhắn (chat 1-1, chặn, SSE) + upload (presign/PUT ký). (7) Thanh toán: checkout, dùng thử, hủy/tiếp tục gói, hoàn tiền, hóa đơn, webhook, doanh thu, rút tiền.",
         "backend/docs/API.md, backend/docs/api/*.md", "Các module AUTH, COMM, FEED, EVENT, COURSE, CERT, NOTI, SEARCH, UPLOAD, PAY, ADMIN, ROLE nâng trạng thái 'Kế hoạch' -> 'Đã hoàn thiện' và bổ sung testcase mới."),
        ("3", "Migrate toàn bộ sang Postgres 16 + Prisma 7", "37 bảng, migration trong backend/prisma/migrations, toàn bộ 14 repository chuyển từ bộ nhớ sang Prisma, docker-compose (cổng 5435), seed idempotent (npm run db:up | db:deploy | db:seed | db:reset), tài khoản test cố định + dữ liệu kịch bản (photo/paid-demo/private-demo, DEMO-*, FIN-DEMO-CERT-001), hạ tầng test tích hợp chạy trên DB thật (mỗi file test một schema Postgres tạm).",
         "backend/docs/DATABASE.md, backend/docs/DB-MIGRATION-2B.md, backend/prisma/seed*", "Tiền điều kiện của case mới dựa vào dữ liệu seed thật (xem sheet 'Tài khoản & dữ liệu test'). Dữ liệu không còn mất khi restart BE."),
        ("4", "Thu hồi access token tức thì", "JWT mang sid (phiên) + tv (User.tokenVersion); requireAuth/optionalAuth kiểm tra phiên và tokenVersion trong DB mỗi request. Đổi/đặt lại mật khẩu, xóa tài khoản, logout, logout-all, thu hồi phiên -> token cũ 401 ngay, không chờ hết 15 phút. Xóa tài khoản = ẩn danh hóa (giữ bài viết/bình luận/điểm/thanh toán, tên hiện 'Thành viên đã xóa').",
         "backend/docs/api/identity.md, backend/tests/token-revocation.test.ts", "Case cũ 'Access token hết hiệu lực sau 15 phút' vẫn đúng; thêm nhóm case thu hồi token tức thì ở SEC/AUTH."),
        ("5", "Tích hợp frontend cho 4 nhóm", "(a) Tài khoản/hồ sơ/quên mật khẩu/phiên; (b) Quản trị cộng đồng (tạo, 3 luồng tham gia, lời mời, yêu cầu tham gia, quản trị thành viên, cài đặt, đánh giá); (c) Bảng tin/lịch/lớp học/kiểm duyệt; (d) Thông báo/chat/tìm kiếm/thanh toán/quản trị nền tảng. Kịch bản thao tác ở docs/features/*.md. tsc -b + npm run build sạch; CHƯA chạy Playwright/duyệt trình duyệt trên bản mới (chờ người test).",
         "docs/features/{account,community-admin,content,platform}.md", "Bước UI của case mới bám tên nút/đường dẫn ở docs/features; phần UI thật cần Test 1 (Playwright) + Test 2 (thủ công) xác nhận."),
        ("6", "Số liệu test tự động hiện tại (BE)", "224 test tích hợp xanh trên Postgres thật (cd backend && npm test), typecheck và build sạch. Test Playwright hiện có trong e2e/tests: 00-home, 01-auth, 02-course, 03-security, 99-auth-ratelimit (77 case cũ có kết quả).",
         "backend/docs/API.md, e2e/", "Kết quả Playwright cũ giữ nguyên nhờ gen_testcases.py khôi phục + apply_playwright_results.py."),
        ("7", "Cập nhật bộ test QA này", f"Tổng testcase: {stats['old_total']} -> {stats['new_total']} (+{stats['new_total'] - stats['old_total']}). Chuyển {stats['flipped']} testcase cũ từ 'Kế hoạch' sang 'Đã hoàn thiện' (những mục còn 'Kế hoạch': {stats['still_plan']} case cũ + case mới đánh dấu chưa làm). Thêm module SEARCH, UPLOAD, CERT; thêm sheet 'Tài khoản & dữ liệu test' và 'Nhật ký thay đổi'. TÁCH testcase thành 17 sheet theo module (HOME, AUTH, COMM, COMMVP, COURSE, CERT, FEED, MEMBER, EVENT, NOTI, SEARCH, UPLOAD, PAY, ADMIN, ROLE, SEC, INTEG) thay cho 1 sheet 'Test Cases' 1.712 dòng; sheet Tổng quan có liên kết nhảy tới từng sheet và cột tiến độ Pass/Fail. Mỗi case mới đã phân loại 'Phù hợp Playwright' để chia Test 1 (tự động + bằng chứng) / Test 2 (thủ công).",
         "qa/gen_testcases.py, qa/cases_*.py", "Chạy lại: xem qa/README.md."),
    ]
    r = _table(ws, r, ["#", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], log)

    r = _h2(ws, r, "B. Giá trị TẠM chưa chốt (đang dùng cấu hình mặc định, test theo hành vi thực tế)")
    pending = [
        ("Hoa hồng nền tảng", "10% (PLATFORM_COMMISSION_PCT) + phí cổng 2.9% + 30¢ (GATEWAY_FEE_PCT, GATEWAY_FEE_FIXED_CENTS)", "Chờ chốt mô hình doanh thu (PLAN câu hỏi #6)", "PAY: công thức doanh thu ròng/số dư owner"),
        ("Chính sách hoàn tiền", "Hoàn 100% trong 7 ngày đầu (REFUND_WINDOW_DAYS=7), ngoài cửa sổ Platform Admin duyệt", "Chờ chốt (#8)", "PAY: hoàn tiền tự duyệt vs cần duyệt"),
        ("Rút tiền tối thiểu", "$50 (PAYOUT_MIN_USD), duyệt thủ công bởi Platform Admin", "Chờ chốt (#9)", "PAY: rút tiền dưới ngưỡng bị từ chối"),
        ("Cổng thanh toán", "Chưa chọn (Stripe vs PayOS/VNPay/MoMo) - đang dùng MockGateway (payments.gateway.ts; luôn thành công trừ user trong failFor)", "Chờ chốt (#2)", "PAY/INTEG: case cổng thật (thẻ hết hạn, không đủ số dư, tự thử lại, đối soát) giữ 'Kế hoạch'"),
        ("Kick/ban thành viên trả phí", "Chưa quyết định có hoàn tiền hay không", "Chưa chốt", "COMM/PAY: ghi 'theo hành vi thực tế hiện tại' trong kết quả mong đợi"),
        ("Owner đổi giá khi có gói đang thuê", "Chưa quyết định ảnh hưởng gói hiện tại", "Chưa chốt", "COMM/PAY: case 'đổi giá' giữ 'Kế hoạch' hoặc ghi rõ chưa chốt"),
        ("Xác thực SSE (thông báo/tin nhắn)", "Vé ngắn hạn vs cookie; còn hỗ trợ ?access_token= hay bỏ", "Chưa chốt", "NOTI/SEC: case SSE ghi rõ cơ chế đang dùng"),
        ("/files cho tệp đính kèm tin nhắn", "Hiện /files/:key công khai (bảo mật bằng khóa ngẫu nhiên); chưa chốt có bắt đăng nhập", "Chưa chốt", "UPLOAD: case truy cập file"),
        ("Chứng nhận khi mod thêm bài sau khi đã cấp", "Chưa quyết định xử lý", "Chưa chốt", "CERT"),
    ]
    r = _table(ws, r, ["Hạng mục", "Giá trị tạm hiện tại", "Trạng thái", "Ảnh hưởng tới test"], pending)

    r = _h2(ws, r, "C. Còn mô phỏng / chưa làm (giữ 'Kế hoạch' trong test case)")
    todo = [
        ("Đăng nhập Google/Facebook, 2FA, đổi email", "Chưa làm (nút chỉ hiển thị hoặc không có)."),
        ("PDF chứng nhận", "Chưa làm (hiện chỉ trang chứng nhận + xác minh công khai)."),
        ("Tìm kiếm Postgres full-text", "Chưa làm - tìm kiếm hiện lọc trong bộ nhớ trên tập lấy từ DB."),
        ("Email thật", "Chỉ ghi vào outbox dev (GET /api/dev/outbox), chưa nối SES/SMTP -> các case 'nhận email' giữ 'Kế hoạch'."),
        ("Upload S3/MinIO", "Đang lưu ổ đĩa cục bộ (StorageProvider đã tách sẵn)."),
        ("i18n VI/EN, SEO meta/OG, sitemap", "Chưa làm (nút 'VI' chỉ là hình)."),
        ("Nhiều instance BE", "Vé/kết nối SSE, rate limit, nonce vé upload nằm trong bộ nhớ tiến trình -> cần Redis khi scale; chưa có job dọn Session hết hạn."),
        ("Thiếu ở BE mà FE tạm xử lý", "Endpoint 'yêu cầu tham gia của tôi', 'yêu cầu hoàn tiền của tôi', cờ viewerBanned, cờ Platform Admin trong /auth/me, tìm người dùng để bắt đầu chat, Retry-After cho 429, postId trong báo cáo bình luận, trường tệp đính kèm cho bài viết."),
    ]
    r = _table(ws, r, ["Hạng mục", "Ghi chú"], todo)

    r = _h2(ws, r, "D. Thống kê số testcase trước / sau theo module")
    tbl = [(c, n, o, nw, nw - o) for (c, n, o, nw) in stats["by_module"]]
    tbl.append(("", "TỔNG", stats["old_total"], stats["new_total"], stats["new_total"] - stats["old_total"]))
    r = _table(ws, r, ["Mã", "Module", "Trước", "Sau", "Thêm mới"], tbl)

    r = _h2(ws, r, "E. Rà soát QA -> sửa lỗi (9 lỗi thật đã sửa ở backend; testcase đã cập nhật kỳ vọng theo hành vi MỚI)")
    fixed = [
        ("1", "Avatar upload", "Upload ảnh avatar xong rồi PATCH /auth/me {avatarUrl:'/api/files/<key>'} bị 400. Nay được nhận (200); vẫn chặn '..' và javascript:.", "Case AUTH 'Đường dẫn ảnh upload /api/files/<key>', UPLOAD 'Đổi avatar bằng ảnh upload'."),
        ("2", "imageUrl bài viết / meetingLink sự kiện nhận javascript:, data:", "Trước đây trả 201. Nay chỉ nhận http/https, ngoài ra 400 VALIDATION_ERROR.", "Case FEED 'imageUrl dạng javascript:/data:', EVENT 'meetingLink', SEC 'URL độc hại trong imageUrl...'."),
        ("3", "Link thông báo sai route FE", "Sự kiện -> /courses/<id>/community/lich; cấp chứng nhận -> /courses/<id>/community/lop-hoc (trước đây /calendar, /classroom -> 404 ở FE). Seed thông báo member1: event_reminder & event_created -> /courses/photo/community/lich, system chào mừng -> /.", "Case NOTI (seed 7 thông báo, bấm thông báo), EVENT (tạo/hủy/nhắc/SSE), CERT (thông báo cấp chứng nhận)."),
        ("4", "JSON sai cú pháp / body > 1MB trả 500", "Nay JSON sai -> 400 BAD_REQUEST 'Nội dung gửi lên không phải JSON hợp lệ'; body > 1MB -> 413 PAYLOAD_TOO_LARGE (error-handler.ts).", "Case SEC 'Định dạng lỗi' (JSON cụt, payload > 1MB), EVENT tạo sự kiện, PAY webhook."),
        ("5", "Platform Admin bị chặn bởi requireMembership", "Nay requireMembership cho qua Platform Admin dù chưa ghi danh (đọc bảng tin/lịch/lớp học/thành viên, ghim/ẩn bài, RSVP, đánh giá...). Vẫn 403 với newbie/banned.", "Ma trận ROLE (ô 'admin nền tảng'), case ADMIN, FEED, EVENT, COURSE, COMM."),
        ("6", "loginLimiter đếm cả lần đăng nhập thành công", "Nay skipSuccessfulRequests: chỉ đếm đăng nhập THẤT BẠI (10 lần/15 phút/IP); đăng nhập đúng liên tiếp không bị 429, lần sai thứ 11 mới 429.", "Case AUTH 'Rate limit', ROLE (bỏ cảnh báo Playwright đăng nhập nhiều lần dính 429), SEC 'Giới hạn đăng nhập'."),
        ("7", "GET /health không kiểm DB", "Nay chạy SELECT 1: 200 {status:'ok'} khi DB sống, 503 {status:'db_unavailable'} khi DB chết (trước đây luôn 200).", "Case INTEG 'Health & vận hành', 'Mất kết nối Postgres'."),
        ("8", "Xóa tài khoản = ẩn danh hóa", "Xóa tài khoản giữ bài viết/bình luận/điểm/thanh toán, tên hiện 'Thành viên đã xóa' (migration auth_user_deleted_at).", "Nhóm case AUTH 'Xóa tài khoản'."),
        ("9", "Thu hồi access token tức thì", "JWT mang sid + tv; requireAuth kiểm phiên và tokenVersion mỗi request: đổi/đặt lại mật khẩu, xóa tài khoản, logout, thu hồi phiên -> token cũ 401 ngay.", "Nhóm case AUTH/SEC thu hồi token."),
    ]
    r = _table(ws, r, ["#", "Lỗi đã sửa", "Hành vi mới", "Case đã cập nhật"], fixed)

    r = _h2(ws, r, "F. 8 điểm đã biết CHƯA sửa / chưa chốt (case giữ nguyên, ghi rõ là hành vi hiện tại, cần người dùng quyết định)")
    known = [
        ("1", "Kick/ban thành viên trả phí KHÔNG hủy gói (Subscription vẫn active, scheduler vẫn có thể thu phí)", "Cần chốt hoàn tiền/hủy gói."),
        ("2", "RSVP cộng +1 điểm mỗi lần (hủy rồi RSVP lại vẫn cộng, không thu hồi, không dedupe)", "Cần chốt trần điểm / chống farm."),
        ("3", "Bài đã ẩn: PATCH/DELETE bởi người khác trả 403", "Cần chốt có cho mod thao tác trên bài ẩn không."),
        ("4", "Ban chưa có ở mức toàn nền tảng (chỉ ban theo cộng đồng)", "Case ban toàn nền tảng giữ 'Kế hoạch'."),
        ("5", "Platform Admin chưa cần emailVerified (chỉ so email trong PLATFORM_ADMIN_EMAILS -> rủi ro chiếm quyền nếu email chưa có tài khoản)", "Đề xuất bắt buộc xác thực email cho Platform Admin."),
        ("6", "Đăng bài/bình luận không giới hạn tốc độ và không có trần điểm/ngày", "Rủi ro farm điểm, chưa chốt."),
        ("7", "/files/:key công khai (bảo mật bằng khóa ngẫu nhiên), chưa bắt đăng nhập", "Chưa chốt (đã ghi ở mục B)."),
        ("8", "Refresh token không thu hồi access token cũ cùng phiên (còn hiệu lực đến hết 15 phút)", "Ghi nhận để thống nhất, không phải lỗi."),
    ]
    r = _table(ws, r, ["#", "Điểm đã biết", "Ghi chú / cần quyết định"], known)

    for i, w in enumerate([24, 44, 80, 40, 50], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A4"
    return ws
