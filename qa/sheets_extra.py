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
    ("admin", "admin@sofinhub.test", "Platform Admin = Super Admin", "Super Admin (đội SofinHub, nguồn env). Từ đợt 3 có thêm các nhân viên Moderator/Support/Finance (mục A5). Không thuộc cộng đồng nào nhưng ghi đè quyền mọi cộng đồng. Cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test trong backend/.env.",
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

# Tài khoản seed của Admin đợt 1 (backend/prisma/seed/admin.ts): <key>@sofinhub.test, mật khẩu Passw0rd!x, id = seed-admin-user-<key>.
ADMIN_ACCOUNTS = [
    ("sarah / alex / daniel / liam / noah / emma / ava", "<tên>@sofinhub.test", "Người dùng thường (status active)", "Đối tượng bị hạn chế/tạm ngưng/cấm/cảnh cáo, người báo cáo, chủ cộng đồng chờ duyệt (noah: design-circle, emma: creator-academy, ava: no-code-nation + photo-walks, daniel: startup-grind + side-hustle-squad).", "Đăng ký rải 3-84 ngày trước; có phiên gần nhất (Chrome · macOS, IP 113.161.24.1x) để cột 'Hoạt động gần nhất' có giá trị."),
    ("maya", "maya@sofinhub.test", "RESTRICTED: không đăng bài, không bình luận (đến +7 ngày, lý do Spam)", "Case ACCOUNT_RESTRICTED (post/comment), trang Hạn chế / Tạm ngưng, case cảnh cáo Maya (vụ việc #11).", "Thành viên yt, mkt, creator-academy; đăng nhập được."),
    ("ethan", "ethan@sofinhub.test", "RESTRICTED: không nhắn tin, không tạo cộng đồng (đến +3 ngày, lý do Scam)", "Case ACCOUNT_RESTRICTED (dm/create_community), tự hết hạn khi sửa statusUntil, đối tượng vụ việc #8; chủ crypto-signals-pro (bị tạm ngưng).", "Đăng nhập được."),
    ("olivia", "olivia@sofinhub.test", "SUSPENDED đến +14 ngày (Harassment); phiên đã thu hồi", "Đăng nhập -> 403 ACCOUNT_SUSPENDED; đối tượng vụ việc #9 (hate_speech, critical); tự hết hạn khi sửa statusUntil.", "Mật khẩu đúng nhưng bị chặn; sai mật khẩu vẫn 401."),
    ("lucas", "lucas@sofinhub.test", "SUSPENDED vô thời hạn (Spam)", "Đối tượng bị báo cáo nhiều nhất (#1,#2,#3,#5), chủ quick-rich-club (rejected) và pixel-traders (đã xóa).", "Đăng nhập -> 403 ACCOUNT_SUSPENDED, until=null."),
    ("sophia", "sophia@sofinhub.test", "BANNED (Scam)", "Đăng nhập -> 403 ACCOUNT_BANNED; trang Người dùng bị cấm; đối tượng vụ việc #4, #10; audit seed user.ban.", "Không đăng nhập được."),
    ("john.carter / mia.lopez", "john.carter@ / mia.lopez@sofinhub.test", "Từ 2026-10-03 là NHÂN VIÊN vai trò Moderator (seed admin đợt 3 gán AdminAccount); trước đó chỉ là nhân sự hiển thị", "Cột 'Phụ trách' trong hàng đợi (john: #1,#2,#5,#9,#11; mia: #4,#7,#10,#12); đăng nhập vào /admin được với quyền Moderator (dashboard, cộng đồng, người dùng, kiểm duyệt, nội dung, khám phá, phân tích, danh mục) - KHÔNG có thanh toán/hỗ trợ/hệ thống; gán vụ việc cho họ qua assign vẫn 400 (không phải Super Admin).", "Dùng để test Moderator ở đợt 3 (mật khẩu Passw0rd!x, 2FA bật); xem mục A5."),
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
    ("Admin: cộng đồng chờ duyệt", "design-circle / creator-academy / no-code-nation", "pending_review, tạo ~6 / 15 / 27 giờ trước (chủ noah / emma / ava; giá $29 / $59 / $39). KPI 'Cộng đồng chờ duyệt' = 3, 'Lâu nhất đã chờ' ≈ 27 giờ.", "admin"),
    ("Admin: cộng đồng khác trạng thái", "startup-grind / quick-rich-club / crypto-signals-pro", "changes_requested (ghi chú 'Vui lòng làm rõ mô tả và bổ sung ảnh bìa.') / rejected ('Misleading claims') / suspended+locked ('Payment risk'). Cộng đồng seed-base ai/mkt/fit/des/biz được gán chủ alex/daniel/liam/sophia/ethan (dùng 'fit' để thử tạm ngưng, 'mkt' để thử xóa, 'des'/'biz' để thử khóa nhanh).", "admin"),
    ("Admin: thùng rác", "side-hustle-squad / photo-walks / keto-kitchen / pixel-traders", "Đã xóa mềm 3 / 7 / 11 / 15 ngày trước (còn ~27 / 23 / 19 / 15 ngày); side-hustle-squad & pixel-traders do chủ tự xóa, hai cái còn lại admin xóa (Fraud, Spam).", "admin"),
    ("Admin: vụ việc (Report)", "seed-admin-report-1..12 (#1..#12)", "#1,#2,#3 cùng báo cáo bài seed-admin-post-1 (lucas, photo; scam/scam/spam) -> hàng đợi gộp, reportCount=3, hiện #3; #4 bình luận sophia (harassment, under_review, mia); #5 bài post-2 (lucas, yt, copyright, john); #6 bình luận noah (low); #7 dismissed; #8 bài post-4 ethan (fin, scam, medium); #9 bình luận olivia (hate_speech, critical, john); #10 báo cáo thành viên sophia (under_review, mia); #11 resolved warn_user (maya); #12 resolved none. Mã hiển thị CASE-xxxxx theo caseNo trong DB.", "admin"),
    ("Admin: nội dung bị báo cáo", "seed-admin-post-1..5, seed-admin-cmt-1..4", "5 bài (post-1 lừa đảo cọc $49 của lucas, post-2 'Cracked AI tools pack', post-3 bình thường của sarah, post-4 'Guaranteed 10x returns' của ethan, post-5 Telegram referral của maya) và 4 bình luận (cmt-1 sophia, cmt-2 noah, cmt-3 olivia, cmt-4 liam).", "admin"),
    ("Admin: nhật ký audit seed", "seed-admin-audit-1..11", "11 dòng: user.ban (Sophia, 48h trước), user.suspend (Olivia), user.restrict (Maya), case.dismiss (#7), case.warn (Maya, #11), case.resolve (#12), case.remove_content (post-5), community.suspend (crypto-signals-pro), community.delete (photo-walks), community.reject (quick-rich-club), community.request_changes (startup-grind).", "admin"),
    ("Admin: thanh toán cũ trong khung mới", "seed-pay-pendref / payout requested", "/admin/payments/refunds có 1 yêu cầu hoàn tiền pending (demo-paid-demo-2, ngoài cửa sổ 7 ngày); /admin/payments/payouts có 1 payout requested của owner (xem phần Thanh toán ở trên).", "admin"),
    ("Admin đợt 2: nội dung", "POST-D186CDF7 / POST-6976F0F3 / POST-11AABCCE / POST-1926A141", "Bài ẩn (spam-hub, growth-lab) và đã gỡ (spam-hub, mindful-money); bài có báo cáo mở: POST-D70BB72C (2), POST-F687D03E (1), POST-129F0682 (1); bình luận ẩn CMT-88427752, gỡ CMT-2B7C14C7/CMT-B213F111, có báo cáo CMT-D923CB58. Tổng seed sạch: 163 bài (7 có báo cáo, 2 gỡ, 3 ẩn), 227 bình luận.", "admin"),
    ("Admin đợt 2: khóa học/bài học", "System Design Drafts / Budgeting 101 / Get Rich Quick Secrets; LSN-408423DE, LSN-303F7046, LSN-DA91F381", "Khóa draft/archived/removed; bài ẩn 2, gỡ 5 (gồm 4 bài của khóa bị gỡ). Tổng: 124 khóa, 473 bài.", "admin, daniel (thành viên growth-lab)"),
    ("Admin đợt 2: sự kiện & media", "Growth AMA / Hack night / Secret wealth webinar / Mobility workshop; notion-template.pdf / leaked-meal-plan.pdf / signals-pack.zip", "8 sự kiện đặc biệt (RSVP 2-5 người, 1 hủy, 1 gỡ, 1 'live now' chỉ 2 giờ); 12 tệp media metadata (2 gắn cờ, 1 gỡ; 1,4 GB).", "admin, emma, noah"),
    ("Admin đợt 2: thanh toán", "112 giao dịch, 35 gói, 11 hoàn tiền, 7 tranh chấp (mô phỏng), 12 payout", "Giao dịch lẻ đặc biệt: TXN-70F1FA03/E2DB5581 (chờ), TXN-5ECCCEFC/6134AE3A/EDCA0F1F (thất bại), TXN-BE8C2E88/E9A88057/EFAAEA9E (hoàn), TXN-763C9F36/F49368D6/A6B4BFE4/F699FA13 (có yêu cầu hoàn chờ), TXN-E8AF54EA/84E9A3BA (dùng thử hoàn trực tiếp/chargeback). KPI seed sạch: gộp $4.589,00; phí nền tảng $438,25; MRR $1.132,00.", "admin"),
    ("Admin đợt 2: khám phá", "photo/yt/growth-lab (featured), 8 danh mục, trọng số 25/25/20/15/10/5", "23 listed / 3 featured / 4 hidden / 5 unlisted; searchable 33 / reduced 1 (biz) / hidden 1 (spam-hub); /courses công khai = 29; mục new_noteworthy có 1 mục hết hạn (fit-forever).", "admin"),
    ("Admin đợt 2: nhật ký audit seed", "seed-admin2-audit-1..13", "13 dòng: post.hide, post.remove, course.remove, media.remove, event.remove, event.cancel, refund.approve, payout.hold, payout.mark_failed, discovery.status, discovery.search_visibility, discovery.feature, chargeback.create.", "admin"),
    ("Admin: lưu ý reset", "npm run db:reset", "Seed admin chỉ TẠO (id cố định, update:{}) nên npm run db:seed KHÔNG hoàn tác thao tác admin đã làm (đổi trạng thái người dùng/cộng đồng/vụ việc). Sau các case có ghi chú 'Case làm thay đổi dữ liệu seed' phải chạy npm run db:reset (xóa sạch + seed lại) trước khi test tiếp.", "admin"),
]


# Admin đợt 2 (backend/prisma/seed/admin-batch2.ts): id cố định dạng UUID suy từ md5('seed-admin2-<tên>') -> mã hiển thị cố định.
BATCH2_COMMUNITIES = [
    ("growth-lab (Growth Lab)", "sarah ($49/tháng)", "Khám phá: Nổi bật (featured #3, còn hạn) · Danh mục Kinh doanh", "alex, ava, daniel, emma, maya (restricted), sarah (owner); lucas/sophia không đăng nhập được", "Cộng đồng nhiều dữ liệu nhất: 9 gói đăng ký đủ trạng thái, 7 tranh chấp, sự kiện AMA + Retention teardown, 2 khóa seed + 2 mô-đun mặc định."),
    ("code-camp (Code Camp)", "alex ($29)", "Đang hiển thị · trending #2 · Công nghệ", "ava, daniel, noah, sarah; owner alex", "Khóa 'System Design Drafts' (draft), sự kiện 'Hack night' đã hủy, 'Live coding' có capacity 30, payout PO-12AA363D."),
    ("fit-forever (Fit Forever)", "noah ($79)", "Đang hiển thị · new_noteworthy #1 HẾT HẠN · Sức khỏe", "alex, emma, sarah; owner noah", "Sự kiện 'Mobility workshop (live now)' (chỉ 'Đang diễn ra' trong 2 giờ đầu), bài học ẩn LSN-408423DE, payout tạm giữ PO-50974388."),
    ("mindful-money (Mindful Money)", "liam ($19)", "Đang hiển thị · editors_picks #2 · Tài chính", "emma, noah, sarah; owner liam", "Khóa 'Budgeting 101' (archived), bài POST-1926A141 đã gỡ, ảnh budget-preview.png, payout đã chi/đã từ chối."),
    ("pixel-pro (Pixel Pro)", "emma ($99)", "Đang hiển thị · editors_picks #1 · Sáng tạo nội dung", "maya, ethan (restricted); owner emma; olivia/sophia không đăng nhập được", "Bài có báo cáo POST-D70BB72C, bình luận CMT-D923CB58, payout PO-4F3DDE23 ($250), PO-55B8FDCB (thất bại)."),
    ("spam-hub (Spam Hub)", "lucas (miễn phí)", "Gỡ khỏi khám phá (unlisted) · searchVisibility hidden · điểm chất lượng 35", "chỉ chủ lucas (bị tạm ngưng)", "Bài POST-D186CDF7 (ẩn), POST-6976F0F3 (gỡ), khóa 'Get Rich Quick Secrets' (gỡ), sự kiện 'Secret wealth webinar' (gỡ), tệp signals-pack.zip (gỡ)."),
    ("biz / fit (cộng đồng seed-base)", "ethan / liam", "biz: ẩn thật + reduced ('Under quality review'); fit: unlisted ('Owner request')", "-", "Dùng thử 'Hiển thị lại' (đưa về listed) và so sánh /search với /courses?q=."),
]

BATCH2_FIND = [
    ("Mã hiển thị", "Tiền tố + 8 ký tự đầu của uuid viết hoa: POST-, CMT-, LSN-, TXN-, SUB-, RF-, PO-; chargeback CB-000nn là số tự tăng (không cố định)", "POST-D186CDF7, TXN-5ECCCEFC, SUB-651D6D23, RF-1542230F, PO-60986918", "Ô tìm kiếm của mỗi trang nhận đúng các mã này (kể cả 4-8 ký tự đầu, không phân biệt hoa thường)."),
    ("Id đầy đủ", "uuid = md5('seed-admin2-<tên>'): <8hex>-<4hex>-4<3hex>-a<3hex>-<12hex>; tên: post-N, cmt-N, mod-N, lsn-N, event-N, pay-N, sub-N, refund-N, cb-N, payout-N, feat-<section>-N, audit-N; tệp media-N -> key = md5(id).<ext>", "post-8 -> POST-D186CDF7; payout-1 -> PO-60986918; media-4 -> 7e67c7a1b47e2661c431b37641431f15.pdf", "Lấy id đầy đủ cho API bằng GET danh sách (trường id) rồi lọc theo q."),
    ("Bài viết / bình luận", "Tìm theo nội dung đặc trưng ('MAKE $10,000', 'cheap-pills', 'Stop buying this course') hoặc tác giả", "q=MAKE $10,000 -> POST-D186CDF7", "Mỗi cộng đồng seed còn có bài/bình luận 'demo' do các seed khác tạo (mã POST-SEEDPOST...)."),
    ("Khóa học / bài học", "Tìm theo tên khóa ('System Design Drafts', 'Get Rich Quick Secrets') hoặc mã LSN-; mô-đun mặc định id dạng mod-<cộng đồng>", "q=Get Rich Quick -> 4 bài đã gỡ", "'Khóa học' = ClassroomModule; tab Nháp/Đã lưu trữ/Đã gỡ lọc nhanh 3 khóa đặc biệt."),
    ("Sự kiện / media", "Tìm theo tên sự kiện/tên tệp; tab Đã hủy cho Hack night; chip Bị gắn cờ/Đã gỡ cho media đặc biệt", "q=leaked -> leaked-meal-plan.pdf", "Giờ sự kiện tính từ lúc nạp seed; seed chỉ có metadata tệp (không có file thật)."),
    ("Giao dịch / gói / hoàn tiền / chi trả", "Lọc theo trạng thái rồi tìm theo tên khách; mã cố định (xem sheet ADM2 phần tiền điều kiện)", "Trạng thái Thất bại + Lần đầu -> TXN-5ECCCEFC, TXN-6134AE3A, TXN-EDCA0F1F", "Chip 7/30/90 ngày của Giao dịch/Creator lọc theo ngày: giao dịch seed cũ nhất ~95 ngày."),
    ("Khám phá", "id cộng đồng = slug (growth-lab, mkt, biz...); nổi bật theo mục; danh mục theo key", "q=spam-hub; tab Gỡ khỏi khám phá", "Reset sau khi test: npm run db:reset (db:seed không hoàn tác thao tác admin)."),
]

# Admin đợt 3 (backend/prisma/seed/admin-batch3.ts): nhân viên + dữ liệu Hỗ trợ / Hệ thống.
BATCH3_STAFF = [
    ("admin", "admin@sofinhub.test", "Super Admin (nguồn env PLATFORM_ADMIN_EMAILS)", "Luôn đủ 16 quyền; 2FA hiển thị tắt; khóa: không đổi vai trò/tạm ngưng/gỡ được từ giao diện", "Mọi route; Tài khoản quản trị, Vai trò & Quyền, Cài đặt chung, Feature flags, Audit."),
    ("moderator", "moderator@sofinhub.test", "Moderator (Moderator Test) - nhân viên", "2FA bật · đăng nhập gần nhất ~2 giờ trước", "7 quyền: dashboard.view, community.manage, report.resolve, user.ban, users.view, content.manage, analytics.view."),
    ("support", "support@sofinhub.test", "Support (Ryan Cho) - nhân viên", "2FA bật · ~1 giờ trước · phụ trách 9 ticket seed", "6 quyền: dashboard.view, report.resolve, payment.refund, users.view, payment.view, support.manage."),
    ("finance", "finance@sofinhub.test", "Finance (Grace Lee) - nhân viên", "2FA bật · ~6 giờ trước", "6 quyền: dashboard.view, payment.refund, payout.approve, payment.view, payment.manage, analytics.view."),
    ("tom", "tom@sofinhub.test", "Support (Tom Baker) - nhân viên, KHÔNG 2FA", "2FA tắt · ~30 giờ trước · phụ trách 6 ticket seed", "Cùng quyền Support; dùng test cột 2FA tắt, đổi vai trò/tạm ngưng/gỡ quyền."),
    ("nina", "nina@sofinhub.test", "Moderator (Nina Ross) - ĐANG TẠM KHÓA ('Nghỉ việc, chờ thu hồi')", "2FA bật · ~200 giờ trước", "Đăng nhập thường được; mọi /admin/* trả 403 'Tài khoản admin của bạn đã bị tạm khóa'; dùng test Kích hoạt lại."),
    ("john.carter / mia.lopez", "john.carter@ / mia.lopez@sofinhub.test", "Moderator - nhân viên (đợt 1 là nhân sự hiển thị, đợt 3 thành nhân viên)", "2FA bật", "Cùng quyền Moderator; dùng test lọc Vai trò = Moderator (tổng 4 Moderator gồm moderator@ và nina@)."),
    ("(vai trò tùy chỉnh)", "content_reviewer - 'Content Reviewer'", "Vai trò tùy chỉnh mẫu, CHƯA gán cho ai", "3 quyền: dashboard.view, users.view, content.manage", "Gán cho một user thường (vd member1@) bằng Tạo quản trị viên để test vai trò tùy chỉnh; sau test dùng db:reset."),
    ("member1 / owner / cadmin", "<tên>@sofinhub.test", "KHÔNG phải nhân viên", "-", "Mọi /admin/* trả 403 'Chỉ nhân viên admin mới có quyền này'. Chủ/quản trị cộng đồng KHÁC nhân viên nền tảng."),
]

BATCH3_DATA = [
    ("Ticket hỗ trợ", "T-2001..T-2022 (22 ticket)", "Mã T-<2000 + số tự tăng> theo thứ tự tạo trên DB sạch. Mới 5 / Đang mở 7 / Chờ phản hồi 4 / Đã xử lý 4 / Đã đóng 2; 'Đang mở' (mới+mở+chờ) = 16 (người dùng 6, creator 5, thanh toán 5); chưa giao 7; chuyển cấp 2 (T-2004, T-2014); ưu tiên Thấp 7 / TB 8 / Cao 5 / Khẩn cấp 2; Ryan Cho phụ trách 9, Tom Baker 6. Nhóm: người dùng T-2001..2007 + T-2021; creator T-2008..2013 + T-2022; thanh toán T-2014..2020.", "support@, tom@, admin@; người gửi: sarah, alex, daniel, maya, liam, ethan, noah, emma, olivia, ava"),
    ("Ticket hỗ trợ", "T-2001 / T-2004 / T-2007 / T-2005", "T-2001 (sarah, Đang mở, Cao, Ryan, có ghi chú nội bộ + 1 phản hồi nhân viên + 1 tin khách thêm: người dùng thấy 3 tin, admin 4); T-2004 (maya, Khẩn cấp, đã chuyển cấp, có tin 'Hệ thống'); T-2005 (liam, Đã xử lý, Tom); T-2007 (noah, Đã đóng, Ryan) - dùng test Mở lại / khóa ô trả lời.", "support@, sarah@, maya@"),
    ("Ticket hỗ trợ", "T-2002, T-2006, T-2010, T-2012, T-2015, T-2018, T-2020", "Ticket CHƯA GIAO (7) - dùng test 'Nhận xử lý', Giao, Chuyển cấp, trả lời lần đầu (firstResponseAt).", "support@"),
    ("Feature flags", "dm_v2 / premium_lock / ai_moderation / app_banner / native_live / leaderboard_v2", "dm_v2 Thử nghiệm BẬT 50%; premium_lock, ai_moderation, leaderboard_v2 Đang chạy BẬT 100%; app_banner Thử nghiệm TẮT; native_live Bản nháp TẮT 0%. GET /api/feature-flags (khách): premium_lock, ai_moderation, leaderboard_v2 = true, còn lại false.", "admin@"),
    ("Tích hợp", "stripe, paypal, momo, zoom, mailgun, cloudflare / google_analytics, slack", "6 đã kết nối (khóa che ••••9f2a, ••••77c1, ••••0b3d, ••••e5aa, ••••41d8, ••••b290), 2 chưa kết nối. Dữ liệu mô phỏng, không có khóa thật.", "admin@"),
    ("Mẫu email", "welcome, verify_email, reset_password, receipt, warning, payout_sent (Đang dùng) / suspended (Bản nháp)", "7 mẫu hệ thống đủ EN + VI. Chỉ verify_email và reset_password được dùng thật khi gửi email; đọc email ở GET /api/dev/outbox?to=<email>.", "admin@"),
    ("Lịch sử thông báo", "2 broadcast seed", "'Bảo trì hệ thống đêm Chủ nhật' (Mọi người dùng, 2.480 người nhận, ~9 ngày trước) và 'Chính sách phí mới cho Creator' (Creator, 12, ~3 ngày trước) - chỉ là dòng lịch sử, không phát lại thông báo.", "admin@"),
    ("Audit của nhân viên", "6 dòng seed có IP", "support.ticket.reply / support.ticket.escalate (Ryan Cho, 113.161.24.10), refund.approve (Grace Lee, 113.161.24.55), content.hide + user.warn (Moderator Test, 113.161.30.2), support.ticket.resolve (Tom Baker, 14.232.8.77). Nhãn đối tượng của dòng seed ghi T-2002/T-2004/T-2005 (dòng đầu lệch 1 so với mã ticket thật).", "admin@"),
    ("Analytics", "Thành viên demo (isDemo) rải ~150 ngày", "Seed rải lại ngày đăng ký và thêm phiên 'quay lại' ở tuần 1/2/4/8/12 (~62/48/38/30/24%) để cohort/retention có hình dạng. Số liệu đổi theo ngày chạy -> luôn đối chiếu bằng SQL/API cùng range.", "admin@, moderator@, finance@"),
    ("Cài đặt chung", "Mặc định lấy từ env", "commissionPct 10, gatewayFeePct 2.9, gatewayFeeFixedCents 30, refundWindowDays 7, payoutMinUsd 50, trialDays 7, subscriptionPeriodDays 30, currency USD, autoPayouts true, require2fa false, sessionTimeoutMin 30, maintenanceMode false, defaultLanguage vi. Ghi đè lưu ở PlatformSetting 'global.settings' (db:seed KHÔNG hoàn tác; dùng 'Khôi phục' hoặc db:reset).", "admin@"),
    ("Đợt 3: lưu ý reset", "npm run db:reset", "Case 'MUTATE' (tạo/sửa/xóa nhân viên, vai trò, cờ, mẫu email, cài đặt, ticket...) làm bẩn dữ liệu: chạy npm run db:reset sau đó. Đặc biệt nhớ tắt chế độ bảo trì (nếu quên, mọi API công khai trả 503).", "-"),
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
    ("14", "Môi trường kiểm thử audit: NODE_ENV BẮT BUỘC, outbox opt-in, secret production", "Từ 2026-10-04 app KHÔNG khởi động nếu thiếu NODE_ENV (npm run dev/test/db:* đã đặt sẵn bằng cross-env). GET /api/dev/outbox chỉ có khi ENABLE_DEV_OUTBOX=1 (backend/.env.example đã bật cho dev; production cấm). Test env: đặt DOTENV_CONFIG_PATH=khong-co.env để không đọc backend/.env (module SECX)."),
    ("15", "Redis (tùy chọn, module INFRA)", "docker compose up -d redis (cổng 6380); đặt REDIS_URL=redis://localhost:6380 trong backend/.env; bỏ trống = in-memory (đúng cho 1 instance). Test adapter: cd backend && REDIS_URL=redis://localhost:6380 npx cross-env NODE_ENV=test node --import tsx --test tests/shared-state.test.ts"),
    ("16", "Hai instance / worker (module INFRA)", "Terminal 1: $env:PORT=4000; npm run dev. Terminal 2: $env:PORT=4001; npm run dev (cùng DB, cùng REDIS_URL). Tách worker: RUN_SCHEDULERS=0 cho web + npm run dev:worker. Job nền chạy mỗi 5 phút (gia hạn, đối soát tiền) và 60 giây (nhắc lịch), lượt đầu sau 1 chu kỳ."),
    ("17", "Rate limit ở dev (module GAME)", "Mặc định BẬT khi NODE_ENV != test: toàn cục 1.200/phút/IP; đăng bài 10, bình luận 30, like 60, RSVP 30, bình chọn 60 mỗi phút/user; tìm kiếm 40/phút; tin nhắn 20/phút. Tắt: RATE_LIMIT_DISABLED=1 trong backend/.env rồi khởi động lại. Thử nhanh: RATE_LIMIT_GLOBAL_PER_MIN=5."),
    ("18", "SQL trực tiếp (module MONEY, PERF, SPLIT)", "docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub. Bảng Prisma Community = \"Course\", Course (khóa học) = \"LearningCourse\"; cột cộng đồng của mọi bảng tên \"courseId\"; ép gói đến hạn: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute' WHERE ...; lùi thanh toán qua holding: UPDATE \"Payment\" SET \"confirmedAt\"=now()-interval '60 days' WHERE ... . Đếm truy vấn: ALTER DATABASE sofinhub SET log_statement='all' rồi docker logs sofinhub-postgres (nhớ RESET)."),
    ("19", "Giá trị tiền TẠM dùng trong module MONEY", "Hoa hồng 10%, phí cổng 2,9% + 30¢, hoàn tiền 7 ngày, tranh chấp 7 ngày (holding 14 ngày), quỹ dự phòng 10%, rút tối thiểu $50 (đặt Admin > Hệ thống > Cài đặt chung: Rút tối thiểu = 10 USD để thử số nhỏ, rồi Reset). Số mẫu: $7 -> net 580¢, $10 -> 841¢, $19 -> 1625¢."),
    ("20", "Ký webhook thanh toán (module MONEY)", "Header x-sofin-signature: t=<unix giây>,v1=<hex HMAC-SHA256 của \"t.rawBody\">, khóa PAYMENT_WEBHOOK_SECRET (dev: dev-webhook-secret-change-me), gửi đúng raw body, lệch thời gian > 300s bị 400."),
    ("21", "Test tự động của BE sau đợt audit", "cd backend && npm test (tests/*.test.ts, NODE_ENV=test, DB thật); riêng: security-hardening, money-lifecycle, points-policy, shared-state, scheduler, lifecycle, notifications-durability, perf-sql, query-count, communities-courses, search. Đo số truy vấn: npx cross-env NODE_ENV=test node --import tsx --test tests/query-count.test.ts (QC_BASELINE=1 chỉ in số). Coverage: npm run test:coverage. CI: .github/workflows/ci.yml."),
]


# Audit backend 2026-10-01 (bước 1-8): dữ liệu seed đa khóa học + chứng nhận + giá cộng đồng dùng trong module SECX/MONEY/GAME/INFRA/PERF/SPLIT.
AUDIT_DATA = [
    ("Đa khóa học: photo", "course-photo-main / course-photo-editing", "'Nhiếp ảnh cơ bản' (mặc định, 2 module x 6 = 12 bài, id mod-photo-1/2, les-photo-<n>-<m>) + 'Chỉnh sửa ảnh nâng cao' (2 module x 4 = 8 bài: mod-photo-editing-1/2, les-photo-editing-<n>-<m>). Cài đặt chứng nhận cộng đồng: BẬT. lessons của GET /courses/photo = 20 (tính từ lớp học thật).", "member1 (50% main, 100% editing), member2 (2/12 main), owner (chủ)"),
    ("Đa khóa học: yt", "course-yt-main / course-yt-growth", "'YouTube từ con số 0' (24 bài: 4 module x 5 + 1 x 4; module 2 requiredLevel=2) + 'Tối ưu kênh & tăng trưởng' (2 module x 3 = 6 bài, certificatesEnabled=true GHI ĐÈ trong khi chứng nhận cộng đồng yt TẮT). lessons = 30.", "member1 (xong module 1 của main)"),
    ("Đa khóa học: fin", "course-fin-main / course-fin-invest / course-fin-risk", "'Tài chính cá nhân cơ bản' (16 bài = 5+5+6), 'Quản lý danh mục đầu tư' (2 x 3 = 6 bài), 'Quản trị rủi ro (bản nháp)' (DRAFT, 1 module x 2 bài, chỉ mod+/admin thấy). Chứng nhận cộng đồng fin: BẬT. lessons = 22 (không tính khóa nháp); coursesCount = 2 (chỉ khóa published).", "member1 (100% main, 3/6 invest), owner"),
    ("Khóa mặc định các cộng đồng khác", "course-<communityId>-main", "Mỗi cộng đồng còn lại (ai, biz, des, ... paid-demo, private-demo) có đúng 1 khóa tên = tên cộng đồng chứa toàn bộ module/bài cũ (id mod-<community>-<n>).", "-"),
    ("Chứng nhận cố định", "FIN-DEMO-CERT-001 / PHOTO-DEMO-CERT-002", "FIN-DEMO-CERT-001: member1, khóa 'Tài chính cá nhân cơ bản'. PHOTO-DEMO-CERT-002: member1, khóa 'Chỉnh sửa ảnh nâng cao' (khóa thứ hai của photo). Xác minh công khai: GET /api/certificates/<mã> (không cần đăng nhập) -> {valid, holderName:'Minh Member1', courseTitle, issuedAt}.", "member1"),
    ("Giá cộng đồng catalog (MONEY)", "ai $7, biz $9, des $10, write $12, mkt $15, yoga $8 (trial), cook $19 (trial), data $5, py $7, fit miễn phí, fin $5 (riêng tư), lead $10 (riêng tư), paid-demo $19", "ai/biz/des/write/mkt/py/data: công khai có phí, KHÔNG owner (Platform Admin ghi đè). paid-demo & photo/yt/fin: owner@. Muốn tính tiền sạch: dùng cộng đồng do user mới tạo bằng POST /api/communities {priceUsd:10,visibility:'public'} (xem module MONEY).", "owner, admin"),
    ("Điểm seed (GAME)", "PointEvent không có sourceType/sourceId", "Điểm seed của member1 (photo 110), member2 (30), member3 (6) là dòng LEGACY (sourceType NULL) nên xóa bài seed KHÔNG bù điểm; điểm sinh sau migration có khóa nghiệp vụ (user, reason, sourceType, sourceId).", "member1..3"),
    ("Dữ liệu tìm kiếm (PERF)", "Photo 'Nhiếp ảnh bằng điện thoại', mkt 'Marketing thực chiến', des 'Thiết kế với Figma'", "Dùng cho case bỏ dấu/tiền tố/gõ sai. Tạo thêm dữ liệu lớn bằng SQL generate_series (1.100 bài, 450 thành viên, 5.000 bình luận, 20.000 phiếu bầu) theo hướng dẫn trong từng case; nhớ db:reset sau đó.", "member1, owner"),
    ("Thông báo & tin nhắn (INFRA)", "seed-conv-member1-member2", "Cuộc trò chuyện seed giữa member1 và member2 (8 tin, 3 chưa đọc từ member2); dùng để thử thông báo message_received, ack 30 giây, gộp 5 phút, SSE giữa 2 instance.", "member1, member2"),
]

# Môi trường / cấu hình dùng cho các case audit.
AUDIT_ENV = [
    ("NODE_ENV / env guard (SECX)", "NODE_ENV bắt buộc; production cấm secret dev-*, bắt buộc DATABASE_URL, cấm ENABLE_DEV_OUTBOX", "Chạy lệnh nạp env.ts với DOTENV_CONFIG_PATH=khong-co.env; bộ biến production hợp lệ gồm 4 secret ngẫu nhiên không bắt đầu bằng dev-.", "Case SECX nhóm 1-4"),
    ("Hộp thư dev (SECX)", "ENABLE_DEV_OUTBOX=1", "Chỉ máy dev; kiểm tra tắt bằng cách xóa biến rồi restart (GET /api/dev/outbox -> 404).", "Case SECX nhóm 2"),
    ("Tệp upload (SECX)", "UPLOAD_DIR (data/uploads), UPLOAD_SIGNING_SECRET", "Tạo file thử: presign -> PUT -> /api/files/<key>. File riêng tư (message/lesson/post_file) cần Bearer hoặc URL ký 300s.", "Case SECX nhóm 7"),
    ("Redis (INFRA)", "docker compose up -d redis ; REDIS_URL=redis://localhost:6380 ; REDIS_KEY_PREFIX=sofinhub:", "Có Redis: vé SSE/nonce upload/rate limit/throttle dùng chung giữa instance; không Redis: in-memory.", "Case INFRA nhóm 4-5"),
    ("2 instance + worker (INFRA)", "PORT=4000/4001 ; RUN_SCHEDULERS=0 ; npm run dev:worker ; RUN_ROLE=worker (Docker)", "Leader election bằng Postgres advisory lock; chỉ 1 instance chạy mỗi job mỗi lượt.", "Case INFRA nhóm 3, 6"),
    ("Rate limit (GAME)", "RATE_LIMIT_DISABLED, RATE_LIMIT_GLOBAL_PER_MIN, RATE_LIMIT_WRITE_PER_MIN, MESSAGE_RATE_LIMIT_PER_MIN", "Mặc định bật ở dev (xem SETUP bước 17).", "Case GAME nhóm 7, INFRA"),
    ("Cổng thanh toán giả (MONEY)", "MockGateway luôn thành công; dedupe hoàn tiền theo idempotency key", "Không giả lập được thẻ bị từ chối qua UI/API: case liên quan chạy bằng test tích hợp (tests/money-lifecycle.test.ts).", "Case MONEY nhóm 2, 4, 8"),
    ("Postgres + pg_trgm (PERF)", "Migration search_fulltext cần extension pg_trgm; hàm SQL sf_fold()", "Kiểm tra: SELECT extname FROM pg_extension; SELECT sf_fold('Đường Việt').", "Case PERF nhóm 7"),
    ("Docker image production (SECX/INFRA)", "docker build -t sofinhub-api backend ; RUN_MIGRATIONS=1 ; RUN_ROLE=worker", "Image đặt NODE_ENV=production sẵn; HEALTHCHECK /health; entrypoint docker-entrypoint.sh.", "Case INFRA nhóm 2-3"),
]


# Wizard "Tạo cộng đồng" + gói năm (2026-10-07): dữ liệu seed và cấu hình dùng trong module WIZ, ANN.
WIZ_DATA = [
    ("Nháp wizard của owner", "draft-gom-cuoi-tuan / draft-chay-bo-5k / draft-viet-content",
     "3 nháp moderationStatus='draft' (id = slug). 'Lớp Gốm Cuối Tuần' (hobby, 1/4 bước, nextStep=plan); 'Chạy Bộ 5K Cho Người Mới' (sports, 3/4 bước basics+plan+identity, màu #16a34a, lời hứa 'Chạy trọn 5K đầu tiên sau 8 tuần', 2 lợi ích, nextStep=members); "
     "'Viết Content Ra Đơn' (content, 4/4 bước, RIÊNG TƯ, $7/tháng + $48/năm = tiết kiệm 43%, lời hứa 'Viết bài đầu tiên chốt được đơn trong 14 ngày', 2 lợi ích, 2 câu hỏi gia nhập 'Bạn đang bán sản phẩm gì?' / 'Bạn biết đến lớp từ đâu?', 2 nội quy 'Tôn trọng lẫn nhau' + 'Không spam', requireRulesAgreement=true, nextStep=launch). "
     "Create-only: db:seed không ghi đè nháp đã sửa; ẩn khỏi danh sách công khai/tìm kiếm/admin.", "owner@sofinhub.test (mật khẩu Passw0rd!x) - còn 2 suất nháp (giới hạn 5)"),
    ("Gói hosting + thẻ mô phỏng (nháp)", "HostingPlan(draft-chay-bo-5k) + PaymentCard token 'tok_mock_seed_owner'",
     "Gói Chuyên nghiệp theo THÁNG, status trialing 14 ngày từ lúc seed, 299.000 VND, thẻ visa •••• 4242 (hạn 12/(năm hiện tại + 3)); chỉ lưu brand/last4/hạn + token cổng giả lập (không PAN/CVC). Mô phỏng: hết thử KHÔNG trừ tiền.", "owner@"),
    ("Payout mô phỏng (nháp)", "PayoutAccount(draft-viet-content)", "status 'connected', Vietcombank, chủ OLIVIA OWNER, last4 8812 (hiển thị ****8812). Publish nháp này làm mục 'Kết nối tài khoản nhận tiền' của danh sách ra mắt hoàn thành; nháp khác publish không qua payout -> 'skipped' (chặn rút tiền).", "owner@"),
    ("Danh mục Khám phá mới", "music 'Âm nhạc', sports 'Thể thao', spirituality 'Tâm linh'",
     "Thêm sau 8 danh mục cũ (vị trí 9-11) vào DiscoveryCategory; GET /api/categories trả 11 sau seed (DB test chưa seed: 8). 'marketing' (Tiếp thị), 'design' (Thiết kế) có trong enum nhưng chưa bật (admin thêm ở Khám phá > Danh mục). Create-only: không bật lại mục admin đã tắt.", "admin@sofinhub.test (Admin > Khám phá > Danh mục)"),
    ("Cộng đồng gói năm", "annual-demo", "'Cộng đồng gói năm (demo)', công khai, owner làm chủ, $7/tháng + $48/năm (tiết kiệm 43%, perMonth $4), dùng thử thành viên 7 ngày, brandColor #2563eb, lời hứa 'Học đều mỗi tuần, tiết kiệm 43% khi trả theo năm', lợi ích 'Buổi học trực tiếp mỗi tuần' + 'Thư viện video đầy đủ', nội quy 'Tôn trọng lẫn nhau'. Dùng cho hộp thoại 'Chọn gói thành viên' (module ANN).", "newbie@, member2@, member3@ (chưa tham gia) để thử mua; owner@ là chủ"),
    ("Cộng đồng có phí chỉ gói tháng", "paid-demo $19 + catalogue ai $7, biz $9, des $10, write $12, mkt $15, py $7, data $5, yoga $8, cook $19", "Không có giá năm -> hộp thoại chỉ 1 thẻ 'Hàng tháng', không nhãn 'Tiết kiệm'. paid-demo có lời mời DEMO-PAID (nhận vẫn 402).", "newbie@"),
    ("Thẻ test nhập tay (FE)", "4242 4242 4242 4242 Visa · 5555 5555 5555 4444 Mastercard · 3782 822463 10005 Amex (CVC 4 số) · 6011 1111 1111 1117 Discover · 3530 1113 3330 0000 JCB; sai Luhn: 4242 4242 4242 4241",
     "Hạn: tháng/năm tương lai (vd. 12 / (năm+3)), CVC 123. FE tokenise phía client thành tok_mock_<24 hex ngẫu nhiên> (luôn thành công ở cổng giả lập); chỉ brand/last4/hạn/token được gửi.", "-"),
    ("Token cổng giả lập", "tok_mock_declined", "Chỉ gửi được bằng API (POST /communities/<id>/trial hoặc checkout với paymentMethod.token = 'tok_mock_declined'): cổng từ chối khi TRỪ TIỀN (cuối dùng thử -> gói 'expired' + Payment 'failed' lý do 'card_declined'). Giao diện không tạo được token này.", "-"),
    ("Global Settings mới", "owner.requirePlan=false, owner.trialDays=14, owner.currency=VND, owner.proMonthlyPrice=299000, owner.proAnnualPrice=2990000, owner.startFeePct=10, owner.proFeePct=2.9; payments.annualPeriodDays=365, payments.trialReminderDays=3 (payments.trialDays=7 vẫn là thử của THÀNH VIÊN)",
     "Chỉnh qua PATCH /api/admin/system/settings {\"owner\":{...}} / {\"payments\":{...}}; đặt lại POST /api/admin/system/settings/reset {keys:[...]} hoặc npm run db:reset. Giao diện Cài đặt chung CHƯA có ô owner.*, annualPeriodDays, trialReminderDays.", "admin@"),
    ("Job nền & mốc thời gian", "payments.subscriptions (5 phút), payments.trialReminders (15 phút)",
     "Ép thời gian bằng SQL: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute', \"trialEndsAt\"=now()-interval '1 minute' WHERE \"userId\"='<id>' (hết thử -> tự trừ); SET ... =now()+interval '2.5 days' (vào cửa sổ nhắc 3 ngày). Thư nhắc ở GET /api/dev/outbox?to=<email> (ENABLE_DEV_OUTBOX=1) + thông báo 'Dùng thử sắp kết thúc'.", "người dùng mới"),
    ("Người dùng mới cho case ghi dữ liệu", "Đăng ký /register hoặc POST /api/auth/register {firstName,lastName,email,password:'Passw0rd!x'}", "Dùng người dùng mới cho mỗi lần chạy case wizard/mua gói để không dính giới hạn 5 nháp và 1 gói sống/(người, cộng đồng). Case MUTATE: npm run db:reset sau khi chạy (db:seed không hoàn tác).", "-"),
]


# Luồng "Cài đặt hồ sơ" (2026-10-08): dữ liệu/ môi trường dùng trong module SETP, SETS, SETN, SETC, SETB, SETR.
SET_DATA = [
    ("Tài khoản dùng cho UI Cài đặt", "member1@ / owner@ / cadmin@ / mod@ / admin@ (mật khẩu Passw0rd!x)",
     "member1: thành viên photo/yt/fin + gói ở paid-demo (xem bảng B/C), email đã xác minh; owner: chủ nhiều cộng đồng + 3 nháp wizard (bị chặn xóa tài khoản vì là chủ cộng đồng); cadmin/mod: admin/mod của photo (nhãn 'Quản trị viên'/'Điều hành viên'); admin: Platform Admin (có mục 'Quản trị' ở menu avatar). Case ghi dữ liệu dùng NGƯỜI DÙNG MỚI (đăng ký ở /register) để tránh dính dữ liệu cũ.", "member1@, owner@, cadmin@, mod@, admin@"),
    ("Cổng & email dev", "GET /api/dev/outbox?to=<email> (ENABLE_DEV_OUTBOX=1)", "Đọc thư xác minh email, thư đổi email (gửi tới email MỚI), thư nhắc dùng thử, email thông báo 'Ngay lập tức', email tin nhắn chưa đọc. Không có SMTP thật.", "SETS, SETN, SETB"),
    ("Ứng dụng/công cụ TOTP", "Google Authenticator/Authy hoặc 'oathtool --totp -b <secret>'", "Secret base32 32 ký tự lấy từ modal 'Bật xác minh 2 bước' (khóa nhập tay) hoặc POST /auth/2fa/setup. Đồng hồ máy phải đúng; mã bước hiện tại đã dùng để bật 2FA KHÔNG dùng lại được (chống replay) - chờ sang bước 30 giây kế tiếp.", "SETS"),
    ("Thẻ test & token", "4242 4242 4242 4242 Visa · 5555 5555 5555 4444 Mastercard · 3782 822463 10005 Amex (CVC 4 số) · 6011 1111 1111 1117 Discover · 3530 1113 3330 0000 JCB; sai Luhn 4242 4242 4242 4241", "Hạn tương lai (vd. 12/29), CVC 123. FE tokenise phía client thành tok_mock_<hex>; chỉ token + brand + last4 + hạn gửi lên (STRICT, không PAN/CVC). Giới hạn 10 thẻ/người; CARD_EXISTS, CARD_IN_USE.", "SETB"),
    ("Cộng đồng có phí để mua gói", "paid-demo ($19/tháng), annual-demo ($7/tháng + $48/năm, thử 7 ngày), hoặc tạo bằng POST /communities {priceUsd, priceAnnualUsd}", "Mua ở /communities/<id>/checkout bằng thẻ test, confirm bằng POST /payments/<id>/confirm. Hoàn tiền tự duyệt trong cửa sổ 7 ngày (giá trị TẠM), ngoài cửa sổ chờ admin (ép lùi ngày bằng SQL).", "SETB, SETR"),
    ("Chương trình giới thiệu", "referral.creatorRateBps=3000, referral.memberRateBps=1000, referral.attributionDays=60, referral.payoutDay=5", "Giá trị TẠM từ mockup (OPEN_DECISIONS A17). Người giới thiệu R lấy mã ở /settings/gioi-thieu (hoặc GET /me/referral); người được giới thiệu F đăng ký qua /gioi-thieu/<mã> hoặc ?ref=<mã>. Hoa hồng member = 10% số tiền khách trả ($10 -> 100¢). Hoa hồng creator = 0 vì chưa có luồng trừ tiền gói hosting. Chỉnh bằng PATCH /api/admin/system/settings {\"referral\":{...}}, đặt lại bằng .../settings/reset hoặc npm run db:reset.", "SETR"),
    ("Giờ im lặng & thông báo", "User.timezone + notifications.quiet.ts (isQuietNow)", "Case runtime đặt khoảng im lặng chứa giờ hiện tại theo múi giờ của người nhận; case hàm thuần chạy bằng 'npx tsx -e' trong thư mục backend. Email digest daily/weekly chưa có job gửi.", "SETN"),
    ("Dữ liệu ép bằng SQL", "docker exec -it sofinhub-postgres psql ...", "bio dài 300 ký tự (case bio cũ), hạn thẻ quá khứ, trạng thái gói expired/past_due/paused, lùi ngày thanh toán >7 ngày (hoàn tiền chờ duyệt), hết hạn token verify-email, ReferralCommission tháng trước (delta %). Case MUTATE cần npm run db:reset sau khi chạy.", "SETP, SETS, SETB, SETR"),
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
    r = _h2(ws, r, "A2. Tài khoản seed của Admin đợt 1 (module ADM) - mật khẩu Passw0rd!x, id = seed-admin-user-<key>")
    r = _table(ws, r, ["Key", "Email", "Trạng thái / vai trò", "Dùng để test", "Ghi chú"], ADMIN_ACCOUNTS, code_cols=(1, 2))
    r = _h2(ws, r, "A3. Dữ liệu seed Admin đợt 2 (module ADM2): 6 cộng đồng mới có phí + người dùng đợt 1 làm chủ/thành viên")
    r = _table(ws, r, ["Cộng đồng (id)", "Chủ / giá", "Trạng thái Khám phá · danh mục", "Thành viên đăng nhập được (mật khẩu Passw0rd!x)", "Dữ liệu đặc biệt"], BATCH2_COMMUNITIES, code_cols=(1,))
    r = _h2(ws, r, "A4. Cách tìm bản ghi Admin đợt 2 (id suy từ md5('seed-admin2-<tên>') nên mã hiển thị cố định sau db:reset)")
    r = _table(ws, r, ["Loại", "Quy tắc / cách tìm", "Ví dụ", "Ghi chú"], BATCH2_FIND, code_cols=(2, 3))
    r = _h2(ws, r, "A5. Nhân viên admin & vai trò seed của Admin đợt 3 (module ADM3) - mật khẩu Passw0rd!x")
    r = _table(ws, r, ["Key", "Email", "Vai trò / nguồn", "Trạng thái / 2FA", "Quyền & dùng để test"], BATCH3_STAFF, code_cols=(1, 2))
    r = _h2(ws, r, "A6. Dữ liệu seed Admin đợt 3 (Hỗ trợ, Hệ thống, Phân tích, Audit)")
    r = _table(ws, r, ["Nhóm", "Mã / ID", "Mô tả & số liệu", "Tài khoản liên quan"], BATCH3_DATA, code_cols=(2,))
    r = _h2(ws, r, "A7. Dữ liệu seed đa khóa học, chứng nhận và giá cộng đồng (audit bước 2/3/6/8: module MONEY, GAME, PERF, SPLIT)")
    r = _table(ws, r, ["Nhóm", "Mã / ID", "Mô tả & số liệu", "Tài khoản liên quan"], AUDIT_DATA, code_cols=(2,))
    r = _h2(ws, r, "A8. Môi trường / cấu hình dùng cho case audit (Redis, 2 instance, worker, rate limit, SQL, env production)")
    r = _table(ws, r, ["Chủ đề", "Cấu hình / lệnh", "Cách dùng", "Dùng cho"], AUDIT_ENV, code_cols=(2,))
    r = _h2(ws, r, "A9. Dữ liệu seed wizard 'Tạo cộng đồng' + gói năm (module WIZ, ANN) - nháp của owner, annual-demo, danh mục mới, thẻ/token test, cài đặt owner.*")
    r = _table(ws, r, ["Nhóm", "Mã / ID", "Mô tả & số liệu", "Tài khoản liên quan"], WIZ_DATA, code_cols=(2,))
    r = _h2(ws, r, "A10. Dữ liệu / môi trường cho luồng 'Cài đặt hồ sơ' (module SETP, SETS, SETN, SETC, SETB, SETR) - tài khoản, email dev, TOTP, thẻ test, gói, giới thiệu, SQL ép dữ liệu")
    r = _table(ws, r, ["Nhóm", "Mã / ID", "Mô tả & số liệu", "Tài khoản / module liên quan"], SET_DATA, code_cols=(2,))
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
    stats = dict(stats)
    stats["adm_count"] = next((nw for (c, n, o, nw) in stats["by_module"] if c == "ADM"), 0)
    stats["adm2_count"] = next((nw for (c, n, o, nw) in stats["by_module"] if c == "ADM2"), 0)
    stats["adm3_count"] = next((nw for (c, n, o, nw) in stats["by_module"] if c == "ADM3"), 0)
    for _code in ("SECX", "MONEY", "GAME", "INFRA", "PERF", "SPLIT", "WIZ", "ANN", "SETP", "SETS", "SETN", "SETC", "SETB", "SETR"):
        stats[_code.lower() + "_count"] = next((nw for (c, n, o, nw) in stats["by_module"] if c == _code), 0)
    """stats: dict(old_total, new_total, by_module=[(code,name,old,new)], flipped=int, still_plan=int)"""
    ws = wb.create_sheet("Nhật ký thay đổi")
    _title(ws, "NHẬT KÝ THAY ĐỔI — 2026-09-30 (BACKEND + FRONTEND) · 2026-10-01 (ADMIN CONSOLE ĐỢT 1) · 2026-10-02 (ADMIN CONSOLE ĐỢT 2) · 2026-10-03 (ADMIN CONSOLE ĐỢT 3) · 2026-10-04..06 (AUDIT BACKEND HARDENING BƯỚC 1-8) · 2026-10-07 (WIZARD TẠO CỘNG ĐỒNG + GÓI NĂM) · 2026-10-08 (CÀI ĐẶT HỒ SƠ)", 5)
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
        ("8", "2026-10-14: thanh toán chuyển khoản VietQR + SePay, tiền VND", "Gói thành viên và mua lẻ module không còn thẻ/USD: checkout tạo phiên mã SFH...+QR, tiền vào qua webhook SePay / cron quét / admin duyệt tay (cùng một hàm cấp quyền), gia hạn bằng hóa đơn QR (ân hạn 2 ngày), dùng thử không thẻ, hoàn tiền ghi nhận (admin chuyển trả tay). Giá seed nhân 25.000đ/USD (paid-demo 475.000đ).", "backend/docs/api/payments.md, backend/tests/bank-transfer.test.ts", "Thêm module BANK (cases_bank_transfer.py); loại 149 case thẻ/HMAC/USD lỗi thời (qa/retired_part_6.py); nhiều case cũ còn trích số USD/cent seed cần đối chiếu lại bằng số VND mới."),
    ]
    r = _table(ws, r, ["#", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], log)

    r = _h2(ws, r, "A2. 2026-10-01 - Admin console đợt 1 (Tổng quan · Cộng đồng · Người dùng · Kiểm duyệt · Nhật ký hoạt động)")
    admin_log = [
        ("2026-10-01", "Backend /api/admin/* (đợt 1)", "Migration admin_batch1: trạng thái cộng đồng (Course.moderationStatus: pending_review|changes_requested|rejected|active|suspended|deleted; xóa mềm giữ 30 ngày), trạng thái tài khoản (User.status active|restricted|suspended|banned + statusUntil/restrictions), case kiểm duyệt (Report.caseNo/risk/assignee + ReportEvent), bảng AdminAuditLog. API: dashboard, communities (duyệt/yêu cầu chỉnh sửa/từ chối/tạm ngưng/khôi phục/xóa/undelete), users (restrict/suspend/ban/reinstate/warn, thu hồi phiên), moderation (assign/warn/remove-content/restrict/suspend/ban/dismiss/escalate/resolve, decisions), audit-logs. Route admin cũ (refunds/payouts/lock) nay cũng ghi audit. Chặn theo trạng thái ở đăng nhập/refresh (ACCOUNT_SUSPENDED/BANNED) và ở đăng bài/bình luận/tạo cộng đồng/nhắn tin/checkout (ACCOUNT_RESTRICTED). 15 test tích hợp mới ở tests/admin.test.ts.",
         "backend/docs/api/admin.md, backend/src/modules/admin/*, backend/tests/admin.test.ts", "Module mới ADM. Case cũ ADMIN/ROLE/SEC về Platform Admin không đổi kỳ vọng; cộng đồng chưa duyệt/tạm ngưng/đã xóa nay ẩn khỏi /courses và tìm kiếm."),
        ("2026-10-01", "Frontend /admin/* (khung admin mới)", "Thay AdminPage/AdminReportsPage bằng khung admin: sidebar 10 nhóm (đợt 1 có màn thật, còn lại 'Sắp có'), topbar (tìm kiếm Ctrl/⌘K, thao tác nhanh, menu tài khoản), drawer ở màn hẹp, guard Platform Admin (GET /admin/me). Trang: Bảng điều khiển; Cộng đồng (danh sách, chi tiết 6 tab, xét duyệt, tạm ngưng, xóa/khôi phục); Người dùng (danh sách, hạn chế/tạm ngưng, cấm, chi tiết 6 tab); Kiểm duyệt (hàng đợi, chi tiết vụ việc, cảnh cáo/gỡ nội dung/tạm ngưng/cấm); Nhật ký hoạt động; Hoàn tiền/Chi trả cũ đặt trong khung mới; /admin/reports chuyển hướng sang /admin/moderation. CHƯA chạy Playwright trên bản mới.",
         "docs/features/admin-batch1.md, frontend/ADMIN_BACKEND_GAPS.md", "UI của case ADM bám nhãn tiếng Việt thật trong frontend/src/features/admin/**; Test 1 (Playwright) chưa có kết quả."),
        ("2026-10-01", "Seed dữ liệu admin", "backend/prisma/seed/admin.ts (idempotent, id cố định seed-admin-*): 12 người dùng (maya/ethan restricted, olivia/lucas suspended, sophia banned) + 2 nhân sự, 10 cộng đồng (3 chờ duyệt, 1 yêu cầu chỉnh sửa, 1 từ chối, 1 tạm ngưng, 4 trong thùng rác), 5 bài + 4 bình luận bị báo cáo, 12 vụ việc, 11 dòng audit. Lưu ý: seed chỉ tạo, db:seed không hoàn tác thao tác admin -> dùng db:reset.",
         "backend/prisma/seed/admin.ts", "Tiền điều kiện của case ADM dùng đúng id/tên/email này (xem sheet 'Tài khoản & dữ liệu test' mục A2 và C)."),
        ("2026-10-01", "Bộ test QA: thêm module ADM", f"Thêm qa/cases_admin.py: {stats['adm_count']} testcase TC-ADM-001.. (module 'ADM - Admin Console (đợt 1)', sheet thứ 18) gồm quyền truy cập (guest/member/owner/cadmin/Platform Admin), khung admin & responsive, dashboard (KPI đối chiếu DB), cộng đồng (danh sách/chi tiết/xét duyệt/tạm ngưng/xóa-khôi phục), người dùng (danh sách/chi tiết/hạn chế-tạm ngưng-cấm-cảnh cáo + hiệu lực ACCOUNT_*), kiểm duyệt (hàng đợi, gộp báo cáo trùng, xử lý vụ việc, nhật ký quyết định), audit log, hồi quy hoàn tiền/chi trả/khóa cũ, phi chức năng, và các điểm chưa làm giữ 'Kế hoạch' (cộng đồng tự tạo chưa cần duyệt, chưa có job hết hạn/xóa vĩnh viễn, gói đăng ký không bị hủy khi đình chỉ, chưa có vai trò Moderator/Finance, export/bulk...). Tách thành 18 sheet; README thêm quy tắc: mỗi tính năng mới -> thêm cases_*.py + mục nhật ký + sinh lại.",
         "qa/cases_admin.py, qa/gen_testcases.py, qa/split_sheets.py, qa/sheets_extra.py, qa/README.md", "Kết quả Test 1/Test 2 đều 'Chưa test'. Case có ghi chú 'thay đổi dữ liệu seed' phải db:reset sau khi chạy. Case cũ không đổi mã/thứ tự; kết quả Pass/Fail cũ được khôi phục nguyên."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], admin_log)

    r = _h2(ws, r, "A3. 2026-10-02 - Admin console đợt 2 (Nội dung · Thanh toán · Khám phá)")
    admin2_log = [
        ("2026-10-02", "Backend /api/admin/{content,payments,discovery}/*", "Migration admin_batch2: cột kiểm duyệt cho Post/PostComment/ClassroomModule/ClassroomLesson/CommunityEvent/Upload (hidden/removedAt/modReason...), Course.discoveryStatus + searchVisibility, bảng Chargeback (mô phỏng), DiscoveryCategory, DiscoveryFeature, PlatformSetting (trọng số xếp hạng). "
         "Nội dung: bài viết/bình luận (+ bulk), khóa học (ClassroomModule), bài học, sự kiện (sửa/hủy/gỡ), media (gắn cờ/gỡ/tải); Thanh toán: giao dịch (hoàn tiền một phần/toàn phần, thử lại), gói đăng ký (tạm dừng/tiếp tục/hủy ngay hoặc cuối kỳ), hoàn tiền (duyệt một phần/từ chối), tranh chấp (mô phỏng), doanh thu creator, chi trả (7 trạng thái); Khám phá: cộng đồng hiển thị, danh mục, nổi bật 4 mục, xếp hạng (preview/publish/reset), hiển thị tìm kiếm. 24 test tích hợp.",
         "backend/docs/api/admin-batch2.md, backend/tests/admin-batch2.test.ts", "Module mới ADM2. Hành vi công khai đổi: /courses chỉ trả cộng đồng discoveryStatus=listed; /search & /courses?q= loại searchVisibility=hidden, reduced xếp sau; /categories ẩn danh mục tắt; bài/bình luận/bài học/sự kiện/tệp bị admin gỡ biến mất với người dùng; sự kiện hủy không RSVP được (409); thêm /courses/featured và /courses?sort=ranked."),
        ("2026-10-02", "Frontend /admin/{content,payments,discovery}/*", "17 trang mới (Bài viết, Bình luận, Khóa học, Bài học, Sự kiện, Media, Giao dịch + chi tiết, Gói đăng ký, Hoàn tiền + chi tiết, Tranh chấp, Doanh thu creator + chi tiết, Chi trả, Cộng đồng hiển thị, Danh mục, Nổi bật, Xếp hạng, Hiển thị tìm kiếm); thay RefundsTab/PayoutsTab cũ; ActionDialog dùng chung (lý do + ghi chú + thông báo), DataTable có chọn nhiều + thanh bulk. Chưa có: xuất CSV, tải biên nhận, dropdown Cộng đồng/Tác giả, bulk ngoài Bài viết, kéo-thả, tên gói.",
         "docs/features/admin-batch2.md, frontend/ADMIN_BACKEND_GAPS.md", "UI của case ADM2 bám nhãn tiếng Việt thật trong frontend/src/features/admin/pages/{Content,Payments,Discovery}Views.tsx; Test 1 (Playwright) chưa có kết quả."),
        ("2026-10-02", "Seed dữ liệu admin đợt 2", "backend/prisma/seed/admin-batch2.ts (idempotent, id suy từ md5 nên mã hiển thị cố định): 6 cộng đồng có phí (growth-lab, code-camp, fit-forever, mindful-money, pixel-pro, spam-hub) + gói đăng ký đủ trạng thái, 112 giao dịch, 11 yêu cầu hoàn tiền, 7 tranh chấp mô phỏng, 12 chi trả, 14 bài + 10 bình luận (ẩn/gỡ/bị báo cáo), 8 khóa + bài học, 8 sự kiện, 12 tệp media (chỉ metadata), mục nổi bật 4 section, trọng số xếp hạng, 13 dòng audit.",
         "backend/prisma/seed/admin-batch2.ts", "Tiền điều kiện của case ADM2 dùng đúng mã/tên này (xem sheet 'Tài khoản & dữ liệu test' mục A3, A4 và C). Thao tác admin không bị db:seed hoàn tác -> dùng npm run db:reset."),
        ("2026-10-02", "Bộ test QA: thêm module ADM2", f"Thêm qa/cases_admin2.py: {stats['adm2_count']} testcase TC-ADM2-001.. (module 'ADM2 - Admin Console (đợt 2)', sheet thứ 19) gồm quyền truy cập 3 nhóm, Nội dung (Bài viết/Bình luận/Khóa học/Bài học/Sự kiện/Media: UI + API + hiệu lực ở API công khai), Thanh toán (Giao dịch, Gói đăng ký, Hoàn tiền, Tranh chấp mô phỏng, Doanh thu creator, Chi trả + hồi quy /admin/refunds và /admin/payouts), Khám phá (Cộng đồng hiển thị, Danh mục, Nổi bật, Xếp hạng, Hiển thị tìm kiếm), tác động lên API công khai, audit/thông báo, validate/đồng thời, và các điểm chưa làm/mô phỏng giữ 'Kế hoạch'. Case làm thay đổi dữ liệu seed ghi rõ MUTATE (npm run db:reset); case phụ thuộc giá trị chưa chốt gắn [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT].",
         "qa/cases_admin2.py, qa/gen_testcases.py, qa/split_sheets.py, qa/sheets_extra.py, qa/README.md", "Kết quả Test 1/Test 2 đều 'Chưa test'. Phát hiện khi viết case (ghi 'HIỆN TẠI' trong kỳ vọng): tab 'Hoạt động' của Gói đăng ký đếm 30 nhưng liệt kê 35; sắp xếp 'Điểm chất lượng thấp nhất' trả cao nhất trước; 'Hiển thị lại' cộng đồng riêng tư/chờ duyệt báo 409; /courses vẫn liệt kê cộng đồng riêng tư; Nhật ký hoạt động chưa Việt hóa/lọc cho hành động đợt 2; với giao dịch seed hoàn toàn bộ/chargeback thua không hủy gói."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], admin2_log)

    r = _h2(ws, r, "A4. 2026-10-03 - Admin console đợt 3 (Phân tích · Hỗ trợ · Hệ thống + vai trò/quyền nhân viên)")
    admin3_log = [
        ("2026-10-03", "Backend /api/admin/{analytics,support,system}/* + phân quyền nhân viên", "Migration admin_batch3: AdminRole (4 vai trò hệ thống + tùy chỉnh), AdminAccount, SupportTicket + SupportTicketMessage, FeatureFlag, Integration, EmailTemplate, PlatformBroadcast, cột ip cho audit. "
         "Phân quyền TẬP TRUNG: middleware adminOnly suy quyền từ (method, path) trong admin-staff.permissions.ts (16 khóa), áp cho TOÀN BỘ /api/admin/* của đợt 1-2 và route cũ /admin/refunds, /admin/payouts; Super Admin = email trong PLATFORM_ADMIN_EMAILS hoặc vai trò super_admin; nhân viên tạm khóa -> 403; nhân viên không thể bị ban/suspend qua /admin/users. "
         "Phân tích 6 trang (users/communities/engagement/retention/revenue/conversion, range 7/30/90, tính trực tiếp bằng SQL); Hỗ trợ (ticket: gán/trả lời bằng email + thông báo/ghi chú nội bộ/chuyển cấp/giải quyết/đóng/mở lại, form liên hệ POST /api/contact tạo ticket, ticket người dùng /api/support/tickets); Hệ thống (Tài khoản quản trị, Vai trò & Quyền, Danh mục dùng chung Khám phá, Feature flags + GET /api/feature-flags công khai, Tích hợp mô phỏng, Thông báo + broadcast, Mẫu email có preview/test-send và dùng thật cho verify_email/reset_password, Audit export CSV, Cài đặt chung có hiệu lực thật lên thanh toán + chế độ bảo trì 503 MAINTENANCE).",
         "backend/docs/api/admin-batch3.md, backend/docs/API.md, backend/tests/admin-batch3.test.ts (39 test)", "Module mới ADM3. Hành vi công khai đổi: GET /api/feature-flags; POST /api/contact tạo ticket (202); khi bật bảo trì mọi API công khai trừ /admin, /auth, /feature-flags, /dev, /payments/webhook trả 503 MAINTENANCE; hoa hồng/phí cổng/cửa sổ hoàn tiền/rút tối thiểu/dùng thử/chu kỳ gói đọc từ Cài đặt chung (mặc định env). Đợt 1-2: /admin/* nay theo QUYỀN VAI TRÒ chứ không còn 'chỉ Platform Admin'; case ADM/ADM2 viết 'Platform Admin' hiểu là Super Admin (admin@)."),
        ("2026-10-03", "Frontend khung admin theo quyền + 19 trang đợt 3", "useCan()/visibleNav(can)/requiredPerm: sidebar ẩn nhóm/mục theo quyền, trang không đủ quyền hiện 'Không đủ quyền' trong khung; bỏ ComingSoon. Trang mới: 6 trang Phân tích, 4 trang Hỗ trợ (+ chi tiết ticket), Tài khoản quản trị, Vai trò & Quyền (ma trận bấm ô), Danh mục, Tính năng thử nghiệm, Tích hợp, Thông báo, Mẫu email (trình soạn + xem trước), Nhật ký (lọc, xuất CSV), Cài đặt chung.",
         "docs/features/admin-batch3.md, frontend/ADMIN_BACKEND_GAPS.md (mục Admin đợt 3)", "UI của case ADM3 bám nhãn tiếng Việt thật trong frontend/src/features/admin/pages/{Analytics,Support,SystemAccess,SystemConfig}Views.tsx, EmailTemplatesView.tsx, AuditView.tsx và nav.ts; Test 1 (Playwright) chưa có kết quả."),
        ("2026-10-03", "Seed dữ liệu admin đợt 3", "backend/prisma/seed/admin-batch3.ts (idempotent chỉ-tạo): nhân viên moderator@/support@/finance@/tom@/nina@(tạm khóa) + john.carter@/mia.lopez@ (Moderator), vai trò Content Reviewer, 22 ticket (đủ nhóm/trạng thái/ưu tiên/người xử lý), 6 feature flag, 8 tích hợp, 7 mẫu email, 2 broadcast, 6 dòng audit có IP, rải ngày đăng ký/phiên cho Phân tích.",
         "backend/prisma/seed/admin-batch3.ts", "Tiền điều kiện của case ADM3 dùng đúng mã/tên này (sheet 'Tài khoản & dữ liệu test' mục A5, A6). Mã ticket T-2001.. phụ thuộc số tự tăng nên chỉ cố định trên DB sạch."),
        ("2026-10-03", "Sheet 'Phân quyền' viết lại", "Thêm tầng quyền NHÂN VIÊN ADMIN (Super Admin/Moderator/Support/Finance/vai trò tùy chỉnh): ma trận route × vai trò, 16 khóa quyền × vai trò, sidebar theo vai trò, trạng thái nhân viên tạm khóa, quy tắc mới; bỏ ghi chú 'chưa có Moderator/Finance/Support' và 'john/mia không có quyền'.",
         "qa/sheets_extra.py (build_roles_sheet), backend/src/modules/admin/admin-staff.permissions.ts", "Đổi quyền ở admin-staff.permissions.ts thì sửa PERMS trong qa/cases_admin3.py (sheet Phân quyền và case ma trận sinh từ bảng này)."),
        ("2026-10-03", "Bộ test QA: thêm module ADM3", f"Thêm qa/cases_admin3.py: {stats['adm3_count']} testcase TC-ADM3-001.. (module 'ADM3 - Admin Console (đợt 3)', sheet thứ 20) gồm khung admin theo quyền (UI), MA TRẬN PHÂN QUYỀN (vai trò × route của đợt 1-3, route cũ refunds/payouts, nhân viên tạm khóa, nhân viên không bị ban qua /admin/users, vai trò tùy chỉnh, hiệu lực ngay), Phân tích (6 trang UI + API + đối chiếu SQL + xấp xỉ), Hỗ trợ (danh sách/tab/lọc/chi tiết/trả lời/ghi chú/giao/chuyển cấp/giải quyết/đóng/mở lại/tạo hộ khách + API admin + API người dùng + POST /api/contact), Hệ thống (Tài khoản quản trị, Vai trò & Quyền, Danh mục, Feature flags + public, Tích hợp, Thông báo/broadcast, Mẫu email + hiệu lực lên email thật, Audit + CSV, Cài đặt chung + hiệu lực thật + bảo trì), responsive/XSS và các điểm chưa làm/lệch (Kế hoạch). Nhiều case ma trận được SINH bằng vòng lặp từ bảng PERMS/ROUTES.",
         "qa/cases_admin3.py, qa/gen_testcases.py, qa/split_sheets.py, qa/sheets_extra.py, qa/README.md", "Kết quả Test 1/Test 2 đều 'Chưa test'. Phát hiện khi viết case (ghi 'HIỆN TẠI'/'KỲ VỌNG' trong case, trạng thái 'Kế hoạch'): (1) FE cho phép tạo ticket hộ khách không có email ('tùy chọn') nhưng BE bắt buộc requesterEmail (tài liệu ghi optional); (2) FE khóa cờ 'a-z0-9_' nhưng BE bắt buộc bắt đầu bằng chữ và dài 2-60; (3) FE biến mẫu cho phép dấu chấm, BE chỉ chữ-số-gạch dưới; (4) FE cho trialDays 0, BE min 1; chu kỳ gói/ mức rút/ phí cố định lệch khoảng FE-BE; (5) bộ lọc nhóm Audit 'Hệ thống'/'Nội dung'/'Thanh toán' theo tiền tố không khớp mã thật; mã support.ticket.* và vài mã khác hiện nguyên mã (chưa dịch); (6) tài liệu admin-batch3.md ghi route chi trả đợt 2 chỉ có GET nhưng có POST cần payout.approve; (7) giao diện ghi 'thành viên sẽ thấy trang bảo trì' nhưng FE người dùng chưa đọc cờ maintenance/feature flags; (8) nhãn vai trò FE 'Kiểm duyệt viên/Hỗ trợ/Tài chính' khác tên API; (9) dòng audit seed T-2002 lệch mã ticket thật T-2001; (10) tạm khóa nhân viên không thu hồi phiên đăng nhập thường (chỉ chặn /admin)."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], admin3_log)

    r = _h2(ws, r, "A5. 2026-10-04..06 - Audit backend hardening (AUDIT-BACKEND-2026-10-01.md, bước 1-8): bảo mật, tiền, điểm, dữ liệu giả, hạ tầng, tìm kiếm, tách Community/Course")
    audit_log = [
        ("2026-10-04", "Bước 1 - bịt 4 đường vào không cần mật khẩu (module SECX)", "NODE_ENV bắt buộc (hết default development, app thoát nếu thiếu/sai); /api/dev/outbox chỉ mount khi ENABLE_DEV_OUTBOX=1 (production cấm bật); production từ chối khởi động nếu bất kỳ secret nào còn dev-* hoặc thiếu DATABASE_URL (JWT x2, PAYMENT_WEBHOOK_SECRET, UPLOAD_SIGNING_SECRET); cookie refresh Secure trừ development; lỗi 500 chỉ lộ err.message ở development; SSE bỏ ?access_token= (chỉ Bearer + vé một lần 30s); morgan che access_token/token/ticket/sig ở URL và Referer; GET /api/files/:key tách ảnh công khai (avatar/cover/post_image, cache 1 năm) khỏi file riêng tư (message/lesson/post_file: đăng nhập + quyền theo cuộc trò chuyện / khóa học / cộng đồng chung, URL ký POST /files/:key/url hạn 300s, Cache-Control private no-store, 404 khi không có bản ghi Upload/chưa uploaded/đã gỡ); thu hồi tin nhắn xóa luôn file; FE mở file qua URL ký (frontend/src/lib/files.ts).",
         "AUDIT-BACKEND-2026-10-01.md mục 4.1-4.4, backend/docs/api/{uploads,notifications,identity,messages}.md, DEPLOY.md (1.2, 1.4, checklist), backend/tests/security-hardening.test.ts", f"Module mới SECX ({stats['secx_count']} case TC-SECX-001..): env/guard, outbox, secret, error handler + cookie, SSE, log, /files public vs private (có ma trận theo purpose), URL ký, vé upload, FE mở file. Kỳ vọng của một số case CŨ đã lỗi thời - xem dòng 'Case cũ cần rà lại' bên dưới."),
        ("2026-10-04", "Bước 2 - khóa chặt vòng đời tiền (module MONEY)", "Partial unique index 1 gói sống/(user, cộng đồng); checkout tái dùng intent pending <30 phút; settle phát hiện và void khoản trừ trùng; không gia hạn cho người bị kick/ban và cộng đồng xóa/khóa/đình chỉ (hook endMembership/stopRenewals/endAllForCommunity); rời cộng đồng hủy gói CUỐI KỲ và vào lại khi còn hạn không phải trả tiền; gỡ cấm trả quyền; hoàn tiền 2 pha có idempotency key = RefundRequest.id + reconcileMoney (hoàn kẹt, charge chưa settle, khoản trừ trùng, webhook kẹt); webhook lưu type/payload/status received|processing|done|failed + replay; thống nhất thứ tự khóa (hết deadlock settle-scheduler); số dư owner: holding 14 ngày (7+7), quỹ dự phòng 10%, sổ nợ OwnerBalanceLedger, chặn payout khi âm (PAYOUT_BLOCKED, PAYOUT_EXCEEDS_AVAILABLE); cộng đồng riêng tư cần được duyệt mới mua/dùng thử; duyệt join request của cộng đồng có phí không cấp quyền; UI: RevenuePage (Có thể rút/Đang giữ/Quỹ dự phòng/cảnh báo nợ), admin Doanh thu creator + Chi trả + Hoàn tiền 'Đang hoàn tiền', Billing 'Sẽ kết thúc vào <ngày>', xác nhận rời cộng đồng có phí.",
         "AUDIT-BACKEND-2026-10-01.md mục 3.1-3.5 + 6.1/6.2, backend/docs/api/payments.md (Vòng đời tiền), docs/features/money-ui-update.md, backend/tests/money-lifecycle.test.ts, migration 20261004100000_money_lifecycle_points", f"Module mới MONEY ({stats['money_count']} case TC-MONEY-001..) với số liệu cụ thể ($7 -> net 580¢; $10 -> 841¢; kịch bản nợ -3264¢) và giá trị TẠM (hoa hồng 10%, hoàn tiền 7 ngày, tranh chấp 7 ngày, dự phòng 10%, rút tối thiểu $50). Ca nhiều bước cần SQL/chờ job nền ghi rõ cách làm."),
        ("2026-10-04", "Bước 3 - điểm thưởng chống farm + chính sách ranh giới trạng thái (module GAME)", "PointEvent có khóa nghiệp vụ UNIQUE(userId, reason, sourceType, sourceId); xóa bài/sự kiện ghi điểm âm bù (reason 'revoked') cùng transaction; RSVP->hủy->RSVP chỉ +1 (không cần bảng EventRsvpNotice như audit gợi ý); tự like không điểm; policy.requireRole chặn owner/admin/mod khi cộng đồng bị khóa (chỉ Platform Admin vượt); ban() 404 cho người chưa là thành viên/uuid lạ (hết oracle), ghi lệnh cấm trước khi gỡ ghi danh; duyệt join request nguyên tử (chốt trạng thái + cấp quyền cùng transaction); moderation chốt ticket trước rồi thi hành + thông báo cho tác giả/người bị cấm; rate limit toàn cục (1.200/phút/IP) + theo nhóm ghi (posts 10, comments 30, likes 60, rsvp 30, votes 60 mỗi phút/user) trả 429 + Retry-After; trần ?page=1000 (400).",
         "AUDIT-BACKEND-2026-10-01.md mục 5.1, 5.2, 6.1, 6.2, backend/docs/api/{content,communities}.md, backend/tests/points-policy.test.ts, middlewares/rate-limit.ts", f"Module mới GAME ({stats['game_count']} case TC-GAME-001..): farm điểm, RSVP, ma trận locked (16 hành động), ban, join request, kiểm duyệt, rate limit, MAX_PAGE. Điểm seed là dòng legacy không có sourceType nên không bù được khi xóa nguồn."),
        ("2026-10-04", "Bước 4 - gỡ dữ liệu giả (nhóm con của module SPLIT)", "GET /courses/:id không còn review/module/highlights/gains/FAQ bịa (bỏ trường modules; reviews chỉ gồm review thật có rating; online không thổi phồng; priceNotes lấy 'Miễn phí dùng thử N ngày' từ Cài đặt chung); GET /api/stats tính từ DB (learners, courses, instructors, rating = null khi chưa có đánh giá); FE bỏ Stories + widget doanh thu '+$12,500', CTA 'Tạo cộng đồng ngay' là link thật, hết href=\"#\" (Header/Footer), FAQ viết lại đúng tính năng thật, perks của CourseDetailPage lấy từ API, Hero hiện '–' khi rating null.",
         "AUDIT-BACKEND-2026-10-01.md mục 2.2 + 8, PLAN.md (STEP 4), backend/src/modules/{catalog/community-detail.ts,meta/meta.routes.ts}, backend/tests/courses.test.ts", "Nhóm 'Gỡ dữ liệu giả' trong module SPLIT. Nhiều case cũ ở HOME/COMMVP kiểm 'đánh giá/module mẫu/FAQ' có thể lệch - xem 'Case cũ cần rà lại'."),
        ("2026-10-05", "Bước 5 + 7 - lưới an toàn + đưa state ra khỏi RAM (module INFRA)", "GitHub Actions ci.yml (typecheck + lint + test với Postgres 16 + Redis 7, test adapter Redis thật, build; frontend tsc -b + lint + build), ESLint flat (nợ cũ ở mức warn), npm run test:coverage (c8), viết lại DEPLOY.md Phần 1 (Postgres/Prisma, bảng env đầy đủ, db:deploy / RUN_MIGRATIONS=1, /health); adapter state chia sẻ kv/pubsub/rateLimiter (in-memory hoặc Redis qua REDIS_URL) cho SSE fan-out, vé stream, nonce vé upload, rate limit, throttle thông báo tin nhắn, vô hiệu cache preference; bỏ tín hiệu online push()===0 (luôn lưu thông báo, ack HTTP 30s, gộp 5 phút); job nền dưới leader election bằng Postgres advisory lock, RUN_SCHEDULERS=0 + worker riêng (npm run start:worker / RUN_ROLE=worker); tắt êm (đóng SSE, flush thông báo, thoát < ~1s); thông báo ghi nền có retry/thư chết/nhả cờ chống trùng, không thông báo ma.",
         "AUDIT-BACKEND-2026-10-01.md mục 5.3, 6.3, 6.5, 10 bước 5/7, DEPLOY.md (1.3-1.7, CI), PLAN.md (STEP 5/7), .github/workflows/ci.yml, backend/tests/{shared-state,scheduler,lifecycle,notifications-durability}.test.ts", f"Module mới INFRA ({stats['infra_count']} case TC-INFRA-001..). Phần lớn là test tích hợp/hạ tầng (Playwright 'Không'): cần Redis (docker compose up -d redis, cổng 6380), 2 instance (PORT 4000/4001), worker; hướng dẫn ở sheet 'Tài khoản & dữ liệu test' mục A8 và SETUP 15-16."),
        ("2026-10-05", "Bước 8 - Postgres full-text + hiệu năng SQL (module PERF)", "Cột searchVector GENERATED STORED + GIN (Course/Post/User), hàm sf_fold() gập dấu tiếng Việt, pg_trgm cho chuỗi con + gõ sai; /search lọc/xếp hạng ts_rank/phân trang trong SQL, /search/suggest là 3 truy vấn LIMIT 5; số truy vấn: search 125->7, suggest 125->5, conversations(20) 45->3, mở bài học 21->10, /me/enrollments(8) 44->6; 18 index FK + index Post (popular/category/tag); conversations keyset (limit/cursor), feed cursor keyset (+page cũ), bình luận limit/cursor (mặc định 100, tối đa 200), phiếu bầu GROUP BY, thông báo sự kiện theo lô 500 (hết cắt 200), GET /courses?q trong SQL.",
         "AUDIT-BACKEND-2026-10-01.md mục 6.4, backend/docs/api/search.md, backend/docs/DATABASE.md (Số truy vấn trước/sau), DEPLOY.md 1.3a (pg_trgm), backend/tests/{search,perf-sql,query-count}.test.ts, migrations 20261005100000/20261005100100", f"Module mới PERF ({stats['perf_count']} case TC-PERF-001..) gồm 5 case số truy vấn có ngưỡng và ngưỡng thời gian 'đề xuất QA' (chưa có trong tài liệu). Thay đổi hành vi so với tìm kiếm cũ được đánh dấu 'THAY ĐỔI SO VỚI BẢN CŨ' (tiền tố từng từ, ts_rank rồi mới nhất, typo không tô đậm, tác giả không thấy bài ẩn của mình trong tìm kiếm)."),
        ("2026-10-06", "Bước 6 - tách Community / Khóa học (module SPLIT)", "Prisma Course -> Community (bảng DB \"Course\" giữ nguyên) và thêm entity Course mới (bảng \"LearningCourse\"): 1 cộng đồng có NHIỀU khóa học, module/khóa tuần tự/tiến độ/chứng nhận theo khóa; khóa mặc định tự tạo (transaction cùng owner + settings, slug race tự thử -2,-3...); API cũ /courses/:id/* giữ nguyên + mirror /communities/:id/* + GET /communities; CRUD khóa /communities/:id/courses (member đọc, mod tạo/sửa/sắp xếp/lưu trữ, admin xóa + override certificatesEnabled, không xóa khóa cuối, nháp/lưu trữ 404 với thành viên); JSON thêm communityId/learningCourseId (giữ courseId); lessons tính từ lớp học thật; admin Nội dung > Khóa học trên entity mới; FE: redirect /courses/* -> /communities/*, ClassroomTab (chọn khóa ?khoa=), CourseManager, tab 'Khóa học' ở cài đặt, LessonPage theo khóa.",
         "AUDIT-BACKEND-2026-10-01.md mục 2.1 + 10 bước 6, backend/docs/api/communities-courses.md, docs/features/community-course-split.md, docs/OPEN_DECISIONS.md E1, backend/prisma/seed/classroom.ts, backend/tests/communities-courses.test.ts, migration 20261006100000_community_course_split", f"Module mới SPLIT ({stats['split_count']} case TC-SPLIT-001..) kể cả nhóm gỡ dữ liệu giả; seed đa khóa học (photo 2, yt 2 + override chứng nhận, fin 3 gồm 1 nháp; chứng nhận FIN-DEMO-CERT-001, PHOTO-DEMO-CERT-002) ở sheet 'Tài khoản & dữ liệu test' mục A7. Điểm chưa làm giữ trạng thái 'Kế hoạch' (chuyển module giữa khóa, GET /me/certificates, mở khóa liên khóa, trang marketplace theo khóa, kéo-thả, FE chưa dùng defaultCourseId/coursesCount)."),
        ("2026-10-06", "Bộ test QA: thêm 6 module SECX, MONEY, GAME, INFRA, PERF, SPLIT", f"Thêm qa/cases_audit_{{secx,money,game,infra,perf,split}}.py: SECX {stats['secx_count']}, MONEY {stats['money_count']}, GAME {stats['game_count']}, INFRA {stats['infra_count']}, PERF {stats['perf_count']}, SPLIT {stats['split_count']} case (tổng +{sum(stats[k + '_count'] for k in ('secx','money','game','infra','perf','split'))}). Workbook từ 20 lên 26 sheet module (đặt sau ADM3). Cột 'Phù hợp Playwright' đặt theo mô hình hai người test: API/hạ tầng/đồng thời mặc định 'Không' hoặc 'Một phần' kèm kịch bản thủ công, giao diện 'Có'. Test 1/Test 2 của case mới đều 'Chưa test'; Playwright KHÔNG tự chạy.",
         "qa/cases_audit_*.py, qa/gen_testcases.py, qa/split_sheets.py, qa/sheets_extra.py, qa/README.md", "Case nhiều bước dùng SQL/chờ job nền ghi rõ trong tiền điều kiện; case MUTATE cần npm run db:reset sau khi chạy. Sheet 'Phân quyền' thêm quy tắc cộng đồng bị khóa + nhóm quyền theo khóa học (nhân viên admin KHÔNG đổi)."),
        ("2026-10-06", "Rà soát & dọn testcase lỗi thời (432 case loại bỏ, ~150 case sửa tại chỗ, 13 case thay thế)", "5 reviewer rà toàn bộ case với code/doc/test hiện tại. LOẠI BỎ có lưu vết: mã TC của case bị loại vẫn được giữ chỗ (mã các case khác KHÔNG đổi, kết quả đã nhập khôi phục nguyên vẹn), danh sách + lý do + bằng chứng ở qa/retired_cases.py (+ retired_part_*.py), bản lưu ở qa/archive/retired_cases.csv, chi tiết từng quyết định ở qa/review_notes/part1..5.md. Lý do chính: (1) trùng case chi tiết hơn ở module mới (HOME/COMM/COMMVP/FEED/MEMBER/EVENT/PAY/ROLE/INTEG cũ ~186; ADM3 ma trận quyền sinh vòng lặp 2 chiều, smoke 'mở trang' lặp, SPLIT mirror/redirect lặp); (2) hành vi đã đổi có chủ đích (?access_token= SSE, RSVP +5 không dedupe, xóa bài không thu hồi điểm, online=push()===0, search quét 1000 bài, UI /admin 4 tab, MockGateway/idempotency cũ, cộng đồng khóa vẫn cho owner thao tác); (3) mục 'Kế hoạch'/'Sắp có' đã làm xong (Moderator/Finance/Support, nhóm admin đầy đủ); (4) tiêu đề chứa số cứng sai (66 thành viên -> 71...) thay bằng case mới ở cuối module. Case còn lại được SỬA kỳ vọng (communityId/ /communities canonical, số dư 'có thể rút', mã lỗi mới, nhãn UI...).",
         "qa/retired_cases.py, qa/retired_part_1..5.py, qa/archive/retired_cases.csv, qa/review_notes/part1..5.md, qa/cases_*.py, qa/gen_testcases.py", "9 case đã có kết quả Test 1 bị loại (HOME-008/022/026/027/028/029, AUTH-034, COURSE-001/005: tiêu đề không còn khớp hành vi) nên Pass 72->65, N/A 4->2. TC-AUTH-036 vẫn mang kết quả Fail của bản cũ dù lỗi đã sửa (JWT sid+tv) - cần chạy lại. Hoàn tác: xóa mã khỏi retired_*.py rồi sinh lại xlsx."),
        ("2026-10-06", "Lệch giữa tài liệu / code / test phát hiện khi viết case (ghi 'HIỆN TẠI' trong case, trạng thái 'Kế hoạch')", "(1) DEPLOY.md đoạn mở đầu (dòng 'Vì sao Backend không deploy lên Vercel') còn nói SSE/vé/rate limit nằm RAM và 'chạy đúng 1 instance', mâu thuẫn mục 1.7 (Redis). (2) backend/docs/api/content.md 'Giới hạn' còn ghi dữ liệu in-memory; classroom.md còn 'Chưa cập nhật frontend' và 'toggle'; admin-batch2.md refunds summary chưa có 'refunding'. (3) docs/OPEN_DECISIONS A8 ('gói không làm gì khi tạm ngưng/xóa') và A10 ('cấm không gỡ ghi danh') lệch code mới. (4) FAQ nói đăng ký xong hệ thống gửi email xác minh nhưng register không gửi mail. (5) FE gọi khóa mặc định là 'Khóa học chính' còn BE đặt tên = tên cộng đồng. (6) Audit gợi ý bảng EventRsvpNotice, code dùng khóa nghiệp vụ trên PointEvent. (7) env-guard chặn MỌI biến chuỗi bắt đầu dev- (kể cả REDIS_KEY_PREFIX) và không kiểm độ dài secret. (8) Tìm kiếm: tác giả không thấy bài ẩn của mình (feed thì thấy). (9) API.md ghi 244 test ở đầu file nhưng 224 ở mục trạng thái dữ liệu. (10) Chưa sửa: complete bài học là toggle, cấp 7-9 chưa có tên, owner tự đánh giá 5 sao, logout cần access token còn hạn, đổi mật khẩu không hủy token reset treo.",
         "backend/docs/**, DEPLOY.md, docs/OPEN_DECISIONS.md, frontend/src/pages/FaqPage.tsx, backend/src/config/env-guard.ts", "Mỗi điểm có case tương ứng trong SECX/MONEY/GAME/INFRA/PERF/SPLIT (tìm 'HIỆN TẠI' trong cột Tiêu đề/Kết quả mong đợi)."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], audit_log)

    r = _h2(ws, r, "A6. 2026-10-07 - Wizard 'Tạo cộng đồng' 5 bước + hộp thoại 'Chọn gói thành viên' (gói năm, dùng thử có thẻ, nhắc trước 3 ngày)")
    wiz_log = [
        ("2026-10-07", "Wizard 'Tạo cộng đồng' 5 bước (BE + FE) - module WIZ",
         "BE modules/community-wizard: bản nháp (Community.moderationStatus='draft', id=slug, tối đa 5 nháp/owner, đổi slug đổi id), kiểm tra slug (GET /communities/slug-available: định dạng, reserved, trùng, gợi ý), PATCH từng bước basics/plan/identity/members, publish transaction (draft->active + Enrollment owner + khóa học mặc định, bắt buộc acceptTerms), gói hosting owner MÔ PHỎNG (GET /owner-plans, PUT /communities/:id/hosting-plan: Khởi đầu 0đ / Chuyên nghiệp 299.000đ-2.990.000đ, dùng thử 14 ngày, nhắc 3 ngày, không trừ tiền thật), tài khoản nhận tiền MÔ PHỎNG (PUT/skip payout-account + guard PAYOUT_ACCOUNT_REQUIRED khi rút), câu hỏi gia nhập/nội quy/tự duyệt người trả phí (join request có answers/acceptRules), revenue-estimate, rules-template, launch-checklist + điều kiện Khám phá (chỉ hiển thị); Global Settings owner.*; POST /communities một phát giữ nguyên (thêm trường tùy chọn). "
         "FE: /communities/new (+ ?draft=) bọc RequireAuth, features/wizard (stepper, 5 bước, ImageSlot upload presign, thẻ mock lib/card.ts), /me/communities có mục 'Bản nháp cộng đồng' (Tiếp tục tạo/Xóa nháp); Header/Footer/Home trỏ /communities/new. Seed: 3 nháp của owner, 3 danh mục mới (Âm nhạc, Thể thao, Tâm linh).",
         "backend/docs/api/community-wizard.md (mục 10 'Sai khác'), docs/features/community-wizard.md, docs/OPEN_DECISIONS.md A16, backend/tests/community-wizard.test.ts, prisma/seed/community-wizard.ts, frontend/src/{pages/CreateCommunityPage,pages/MyCommunitiesPage,features/wizard/*,lib/card.ts}",
         f"Module mới WIZ ({stats['wiz_count']} case TC-WIZ-001..): khung/stepper, 5 bước (validation, preview, upload, giá, câu hỏi, nội quy, payout), tóm tắt/ra mắt/danh sách ra mắt, vòng đời nháp UI + API (401/404/400/409 từng endpoint), publish, tương thích POST /communities, payout, join request câu hỏi/nội quy/tự duyệt, Global Settings owner.*, bảo mật (không PAN/CVC, IDOR, mass assignment, XSS), seed. Case phụ thuộc A16 và giá trị tiền tạm gắn [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]; MUTATE ghi 'npm run db:reset'."),
        ("2026-10-07", "Hộp thoại 'Chọn gói thành viên' + gói năm + dùng thử có thẻ + nhắc trước 3 ngày - module ANN",
         "BE payments: giá năm (Community.priceAnnualCents, annualSavingsPct do server tính), GET /communities/:id/checkout-quote (plans[] tháng/năm, perMonth, savingsPct, firstChargeDate, remindAt, trialDays), checkout/trial nhận interval + paymentMethod (STRICT: chỉ token+brand/last4/hạn, không PAN/CVC), kỳ 30/365 ngày (payments.annualPeriodDays), gia hạn/hoàn tiền/rời cộng đồng theo kỳ năm, MRR năm = giá/12, tự trừ cuối dùng thử có thẻ qua MockGateway (tok_mock_declined -> expired), job payments.trialReminders (email + thông báo, idempotent), GET /me/payment-methods. "
         "FE: features/payments/components/JoinDialog.tsx (JoinDialog + JoinCheckout, dùng lại ở /communities/:id/checkout), components/ui/CardFields.tsx + lib/card.ts (định dạng, Luhn, hạn, CVC, tokenise mock). Seed: cộng đồng annual-demo $7/$48.",
         "backend/docs/api/community-wizard.md mục 4, backend/docs/api/payments.md, backend/tests/annual-subscription.test.ts, prisma/seed/communities-scenarios.ts, ảnh thiết kế images/3.png (XMAI - AI Heroes Club)",
         f"Module mới ANN ({stats['ann_count']} case TC-ANN-001..): mở/đóng hộp thoại + header + chip dữ liệu thật, hai thẻ gói, form thẻ (hãng, định dạng, Luhn/hạn/CVC), tóm tắt/CTA/ghi chú dùng thử, luồng tham gia, quote API, checkout tháng vs năm (số tiền server, idempotency, tái dùng intent, chống trừ trùng), trial API, job nền (tự trừ, nhắc 3 ngày, gia hạn, hủy, thẻ bị từ chối), hồi quy và điểm chưa làm."),
        ("2026-10-07", "Bộ test QA: thêm 2 module WIZ và ANN", f"Thêm qa/cases_wizard.py: WIZ {stats['wiz_count']} + ANN {stats['ann_count']} = {stats['wiz_count'] + stats['ann_count']} case. Workbook từ 26 lên 28 sheet module (WIZ, ANN đặt sau SPLIT). Cột 'Phù hợp Playwright' theo mô hình hai người test: giao diện 'Có', API/job nền/đồng thời 'Không' hoặc 'Một phần' kèm kịch bản thủ công. Test 1/Test 2 của case mới đều 'Chưa test'; Playwright KHÔNG tự chạy.",
         "qa/cases_wizard.py, qa/gen_testcases.py (CASE_MODULES), qa/split_sheets.py (SHORT_NAMES/ORDER), qa/sheets_extra.py, qa/README.md",
         "Mã TC các module cũ không đổi; kết quả Pass/Fail cũ giữ nguyên. Sheet 'Tài khoản & dữ liệu test' thêm mục A9; sheet 'Phân quyền' thêm hàng nháp wizard/payout/hosting/câu trả lời join request + quy tắc nháp chỉ chủ thấy."),
        ("2026-10-07", "Lệch mockup / tài liệu / code / giao diện phát hiện khi viết case (ghi 'HIỆN TẠI'/'KỲ VỌNG', trạng thái 'Kế hoạch')",
         "(1) Dùng thử OWNER 14 ngày KHỚP mockup ('Thử miễn phí 14 ngày'; 7 ngày chỉ là thử của THÀNH VIÊN; bản đầu hợp đồng BE từng ghi 7 và đã sửa) - không phải lệch so với mockup; (2) tên cộng đồng wizard tối đa 30 (mockup đếm /30) nhưng POST /communities một phát tới 80; (3) tiền tệ lẫn lộn: gói owner VND ('0 ₫', mockup '0đ') và gói thành viên USD ($7/$48 như ảnh 3.png) - A16 chưa chốt; "
         "(4) link chia sẻ: UI sao chép ${origin}/communities/<slug> (mockup 'sofinhub.com/<slug>', chưa có route rút gọn); (5) nhãn mockup 'Để sau' (payout) vs UI 'Bỏ qua, làm sau'; mockup 'Dùng mẫu' vs UI 'Viết bài'; (6) xem trước chỉ ở bước 1 và 3 (ghi chú/mockup nhắc cả 2, 4); (7) GET /categories: docs ghi 8, sau seed là 11, mockup/enum có thể kỳ vọng 13; "
         "(8) JoinRequestDialog (FE) chưa hiển thị câu hỏi/nội quy -> cộng đồng riêng tư có câu hỏi không gửi được yêu cầu bằng giao diện (400 JOIN_ANSWERS_REQUIRED) và giao diện admin chưa hiện câu trả lời; (9) /billing hiển thị gói năm '<giá>/tháng'; Admin > Gói đăng ký luôn 'Hàng tháng' (billingCycle cố định); (10) checkbox 'Cho thành viên mới dùng thử' phụ thuộc draft.members.trialDays (=0 khi giá 0/đã tắt) nên có thể không hiện ở lần đầu (cần xác minh khi chạy); "
         "(11) định dạng ngày wizard dd/M vs hộp thoại d/M; (12) requireRulesAgreement chỉ ép ở join-requests; (13) giá đổi khi hộp thoại đang mở không báo; (14) Idempotency-Key replay không xét interval (FE tách key theo kỳ hạn); (15) Cài đặt chung chưa có ô owner.*/annualPeriodDays/trialReminderDays (và ô dùng thử cho phép 0 trong khi BE min 1).",
         "docs/features/community-wizard.md, backend/docs/api/community-wizard.md, mockup template.html + images/3.png, frontend/src/{features/wizard,features/payments,pages/BillingPage,features/communities/components/JoinRequestDialog}, backend/src/modules/admin/admin-payments.service.ts",
         "Mỗi điểm có case tương ứng (WIZ nhóm 'Điểm chưa làm / lệch...', ANN nhóm 'Hồi quy, điểm chưa làm, lệch UI-docs-code') trạng thái 'Kế hoạch', ghi rõ hành vi HIỆN TẠI để tester không báo lỗi trùng."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], wiz_log)

    r = _h2(ws, r, "A7. 2026-10-08 - Luồng 'Cài đặt hồ sơ' (6 tab: Hồ sơ, Thông báo, Tài khoản & bảo mật, Thanh toán, Cộng đồng của tôi, Chương trình giới thiệu)")
    set_log = [
        ("2026-10-08", "Khung /settings + tab Hồ sơ và Tài khoản & bảo mật (BE + FE) - module SETP, SETS",
         "FE features/settings (SettingsLayout, topbar, sidebar 6 mục + thẻ quảng bá theo tab, lưới 3/2/1 cột), /billing -> /settings/thanh-toan, /me/communities -> /settings/cong-dong. Hồ sơ: ảnh đại diện upload thật, họ/tên, handle (kiểm tra trực tiếp), bio <= 150, Website/Instagram/YouTube/Thành phố, showOnMap, thẻ xem trước. "
         "Bảo mật: đổi email (link tới email MỚI, dùng lại token verify-email, pendingEmail), đổi mật khẩu (passwordChangedAt), 2FA TOTP (setup/enable/disable, vé đăng nhập bước 2, chống replay, 8 lần/5 phút), thiết bị (parse User-Agent, revoke-others), ngôn ngữ/múi giờ/giao diện (chỉ lưu), xóa tài khoản (điều kiện chặn ACCOUNT_DELETE_BLOCKED). "
         "BE: PATCH /auth/me mở rộng, GET /users/handle-available, GET /users/:idOrHandle, PATCH /auth/me/preferences, POST /auth/change-email, /auth/2fa/*, /auth/login/2fa, /auth/sessions/revoke-others, GET /auth/me/delete-blockers. Gỡ file cũ features/account/components/{ProfileForm,PasswordForm,SessionsPanel,DeleteAccountPanel,VerifyBanner}.",
         "docs/features/settings-profile-security.md, backend/docs/api/settings-account.md, backend/tests/account-settings.test.ts, mockup scratchpad/cdhs/template.html",
         f"Module SETP ({stats['setp_count']} case: khung/điều hướng, hồ sơ UI + API) và SETS ({stats['sets_count']} case: email, mật khẩu, 2FA, thiết bị, ngôn ngữ/giao diện, xóa tài khoản, bảo mật). Case 'HIỆN TẠI'/'KỲ VỌNG' trạng thái 'Kế hoạch' ghi lại: ngôn ngữ/giao diện chỉ lưu, không có theo dõi (ô giữa thẻ xem trước hiển thị điểm), không có ảnh bìa, không mã khôi phục 2FA, secret TOTP lưu thô, không hủy được email chờ, thiết bị chỉ có IP."),
        ("2026-10-08", "Tab Thông báo và Cộng đồng của tôi (BE + FE) - module SETN, SETC",
         "BE: GET/PUT /notifications/preferences mở rộng (emailDigest, quiet {enabled,from,to}, dmAllowed, emailUnreadDm, notifyFollowedPosts, communityPrefs 5 cột); thực thi: email instant, giờ im lặng theo múi giờ (lưu nhưng không SSE/email), dmAllowed=false -> 403 DM_DISABLED, email tin nhắn chưa đọc, tắt cột theo cộng đồng. Module my-communities: GET /me/communities, PATCH :id {sidebarVisible,pinned}, PUT /order, DELETE :id (rời), GET /me/join-requests. "
         "FE: NotifyTab (bảng theo cộng đồng), CommunitiesTab (kéo-thả, ghim, công tắc thanh bên, rời, Đang chờ, Bản nháp, Điểm của tôi chuyển từ trang cũ).",
         "docs/features/settings-notify-communities.md, backend/docs/api/settings-notify-communities.md, backend/tests/{notifications-settings,my-communities}.test.ts",
         f"Module SETN ({stats['setn_count']} case) và SETC ({stats['setc_count']} case). Gồm case giờ im lặng qua nửa đêm/múi giờ (chạy hàm isQuietNow bằng npx tsx), DM_DISABLED, mute theo cột, email instant. Kế hoạch: digest daily/weekly chưa có job gửi, cột 'Bài nổi bật' và 'theo dõi' chỉ lưu, sidebarVisible/pinned chỉ ảnh hưởng trang Cài đặt, lời mời (invites) luôn rỗng, ghim không giới hạn 1, nhãn 'Chủ sở hữu' khác 'Chủ cộng đồng'."),
        ("2026-10-08", "Tab Thanh toán và Chương trình giới thiệu (BE + FE) - module SETB, SETR",
         "BE: /me/payment-methods (thêm/sửa/mặc định/xóa, CARD_LIMIT/CARD_EXISTS/CARD_IN_USE, thẻ mặc định = createdAt mới nhất), GET /me/billing-summary (gói năm /12), refundStatus ở /me/payments; referrals (ReferralCode/Referral/ReferralCommission, GET /me/referral*, ghi nhận khi POST /auth/register {referralCode}, hoa hồng member 10% sau commit, void khi hoàn tiền, job referrals.reconcile, Global Settings referral.*). "
         "FE: BillingTab (thẻ, thẻ tối 'Lần trừ tiền tiếp theo', gói thành viên + Quản lý/hủy ngay/kích hoạt lại/hoàn tiền, lịch sử + hóa đơn + CSV), ReferralTab, /gioi-thieu/:code và ?ref=.",
         "docs/features/settings-billing-referral.md, backend/docs/api/{payments,referrals}.md, docs/OPEN_DECISIONS.md A16/A17, backend/tests/{payment-cards,referrals}.test.ts",
         f"Module SETB ({stats['setb_count']} case) và SETR ({stats['setr_count']} case). Số liệu chính xác: $7 + $48/12 = 1100¢, hoa hồng $10 -> 100¢ (memberRateBps 2500 -> 250¢), 30%/10%/60 ngày/ngày 5 là giá trị TẠM [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT] (A17). Kế hoạch: tiền tệ USD vs VND của mockup (A16), Luhn chỉ ở client, hoa hồng creator = 0 (hosting mô phỏng), không có job pending -> paid, modal hoàn tiền ghi cứng '7 ngày', CSV cắt 2.000 giao dịch, 'Cài đặt nhận tiền' chỉ mở tab thanh toán, mô tả 'bật chương trình giới thiệu thành viên' không có công tắc."),
        ("2026-10-08", "Bộ test QA: thêm 6 module SETP, SETS, SETN, SETC, SETB, SETR",
         f"Thêm qa/cases_settings.py: SETP {stats['setp_count']} + SETS {stats['sets_count']} + SETN {stats['setn_count']} + SETC {stats['setc_count']} + SETB {stats['setb_count']} + SETR {stats['setr_count']} = {stats['setp_count'] + stats['sets_count'] + stats['setn_count'] + stats['setc_count'] + stats['setb_count'] + stats['setr_count']} case. Workbook từ 28 lên 34 sheet module (đặt sau ANN). Cột 'Phù hợp Playwright' theo mô hình hai người test: giao diện 'Có'/'Một phần'; API, email thật, ứng dụng TOTP, ép thời gian/SQL, job nền = 'Không' (chỉ Test 2). Test 1/Test 2 của case mới đều 'Chưa test'; Playwright KHÔNG tự chạy.",
         "qa/cases_settings.py, qa/gen_testcases.py (CASE_MODULES), qa/split_sheets.py (SHORT_NAMES/ORDER), qa/sheets_extra.py (mục A10 + nhật ký A7), qa/README.md",
         "Mã TC các module cũ không đổi; kết quả Pass/Fail cũ giữ nguyên. Sheet 'Tài khoản & dữ liệu test' thêm mục A10; mục C 'Còn mô phỏng/ chưa làm' thêm dòng Cài đặt. Case cũ nhắc 'đổi email/ 2FA chưa làm' (AUTH/ADM3) có thể lỗi thời với tài khoản người dùng thường - xem module SETS."),
        ("2026-10-08", "Lệch tài liệu / code / giao diện phát hiện khi viết case (ghi 'HIỆN TẠI'/'KỲ VỌNG', trạng thái 'Kế hoạch')",
         "(1) FE ô Thành phố cho gõ 300 ký tự nhưng BE giới hạn location 120. (2) Modal hoàn tiền ghi cứng '7 ngày đầu' trong khi cửa sổ hoàn tiền cấu hình được. (3) Nhãn owner 'Chủ sở hữu' (tab Cộng đồng) và 'Chủ cộng đồng' (tab Thông báo). (4) Tab Thông báo không có thẻ quảng bá riêng (fallback 'Nâng cấp tài khoản'). (5) Mô tả tab giới thiệu thành viên 'cộng đồng có bật chương trình giới thiệu thành viên' nhưng không có công tắc nào. "
         "(6) Link 'Cài đặt nhận tiền' mở tab thanh toán thẻ, không phải cấu hình nhận hoa hồng. (7) Mod/Admin (không phải owner) nằm trong 'Tôi quản lý' nhưng chỉ có nút 'Mở'. (8) Bật 2FA xong không tắt ngay được bằng cùng mã (chống replay) - dễ gây khó hiểu. (9) docs/features/settings-profile-security.md ghi 'Chưa thêm test case vào xlsx' - nay đã có SETP/SETS. (10) Mockup thẻ xem trước có 'theo dõi', ảnh bìa đổi được, tên thiết bị/ thành phố cụ thể, ẩn 'Xóa thẻ' khi chỉ 1 thẻ, tiền VND - UI hiện khác (xem Kế hoạch).",
         "frontend/src/features/settings/**, backend/src/modules/auth/auth.schema.ts, docs/features/settings-*.md, mockup template.html",
         "Mỗi điểm có case 'Kế hoạch' tương ứng ở SETP/SETS/SETN/SETC/SETB/SETR để tester không báo lỗi trùng."),
    ]
    r = _table(ws, r, ["Ngày", "Hạng mục", "Nội dung đã làm", "Tài liệu / nguồn", "Ảnh hưởng tới test case"], set_log)

    r = _h2(ws, r, "B. Giá trị TẠM chưa chốt (đang dùng cấu hình mặc định, test theo hành vi thực tế)")
    pending = [
        ("Hoa hồng nền tảng", "10% (PLATFORM_COMMISSION_PCT) + phí cổng 2.9% + 30¢ (GATEWAY_FEE_PCT, GATEWAY_FEE_FIXED_CENTS)", "Chờ chốt mô hình doanh thu (PLAN câu hỏi #6)", "PAY: công thức doanh thu ròng/số dư owner"),
        ("Chính sách hoàn tiền", "Hoàn 100% trong 7 ngày đầu (REFUND_WINDOW_DAYS=7), ngoài cửa sổ Platform Admin duyệt", "Chờ chốt (#8)", "PAY: hoàn tiền tự duyệt vs cần duyệt"),
        ("Rút tiền tối thiểu", "$50 (PAYOUT_MIN_USD), duyệt thủ công bởi Platform Admin", "Chờ chốt (#9)", "PAY: rút tiền dưới ngưỡng bị từ chối"),
        ("Cổng thanh toán", "Chưa chọn (Stripe vs PayOS/VNPay/MoMo) - đang dùng MockGateway (payments.gateway.ts; luôn thành công trừ user trong failFor)", "Chờ chốt (#2)", "PAY/INTEG: case cổng thật (thẻ hết hạn, không đủ số dư, tự thử lại, đối soát) giữ 'Kế hoạch'"),
        ("Kick/ban thành viên trả phí", "Chưa quyết định có hoàn tiền hay không", "Chưa chốt", "COMM/PAY: ghi 'theo hành vi thực tế hiện tại' trong kết quả mong đợi"),
        ("Owner đổi giá khi có gói đang thuê", "Chưa quyết định ảnh hưởng gói hiện tại", "Chưa chốt", "COMM/PAY: case 'đổi giá' giữ 'Kế hoạch' hoặc ghi rõ chưa chốt"),
        ("Xác thực SSE (thông báo/tin nhắn)", "Từ 2026-10-04: CHỐT trong code - chỉ Bearer header hoặc vé một lần 30s (?ticket=), ĐÃ BỎ ?access_token=. Còn mở: chuyển sang cookie httpOnly hay giữ vé", "Một phần đã chốt (OPEN_DECISIONS A6)", "SECX nhóm SSE; NOTI/COMMS/AUTH cũ có case nhắc ?access_token cần rà lại"),
        ("/files cho tệp đính kèm tin nhắn", "Từ 2026-10-04: ĐÃ CHỐT trong code - ảnh avatar/cover/post_image công khai; message/lesson/post_file cần đăng nhập + quyền hoặc URL ký 300s (private, no-store); 404 khi không có bản ghi Upload", "Đã chốt trong code", "SECX nhóm /files; UPLOAD cũ cần rà lại"),
        ("Cửa sổ tranh chấp & quỹ dự phòng của payout", "Holding = hoàn tiền 7 ngày + tranh chấp 7 ngày = 14 ngày; quỹ dự phòng 10% (PAYOUT_DISPUTE_WINDOW_DAYS, PAYOUT_RESERVE_PCT, chỉnh ở Cài đặt chung)", "Chưa chốt (tạm, cần owner dự án)", "MONEY: nhóm Số dư owner, Revenue UI"),
        ("Kick/ban thành viên trả phí có HOÀN TIỀN không", "Hiện: kick kết thúc gói ngay, ban dừng gia hạn + gỡ quyền, KHÔNG hoàn tiền kỳ đã trả; gỡ cấm khi gói còn hạn trả lại quyền", "Hoàn tiền chưa chốt (A5); hủy/ngừng gia hạn đã làm", "MONEY nhóm kick/ban + GAME"),
        ("Chứng nhận khi mod thêm bài sau khi đã cấp", "Chưa quyết định xử lý", "Chưa chốt", "CERT"),
        ("Phí cổng trong doanh thu admin", "Phí cổng = 2,9% × số tiền + 30¢ tính trên số tiền gốc (không hoàn khi hoàn tiền) nên giao dịch hoàn đủ có 'Creator nhận' âm", "Chưa chốt (cùng #6)", "ADM2: Giao dịch, Doanh thu creator"),
        ("Trọng số xếp hạng mặc định & công thức", "25/25/20/15/10/5; revenue 100 điểm = MRR $450; reportPenalty = báo cáo 30 ngày × 10", "Chưa chốt", "ADM2: Xếp hạng, sort=ranked"),
        ("Quy tắc hiển thị Khám phá hidden/unlisted", "hidden (ẩn) vs unlisted (gỡ): cộng đồng riêng tư hiển thị 'Đã ẩn', chưa active hiển thị 'Gỡ khỏi khám phá', nhưng /courses chỉ lọc theo cột discoveryStatus", "Chưa chốt", "ADM2: Cộng đồng hiển thị"),
        ("Các giá trị tiền tạm ở trên (hoa hồng, phí cổng, cửa sổ hoàn tiền, rút tối thiểu, dùng thử, chu kỳ gói)", "Từ 2026-10-03 chỉnh được ở Admin > Hệ thống > Cài đặt chung (PATCH /api/admin/system/settings), mặc định vẫn lấy từ env và Khôi phục được", "Giá trị cuối cùng vẫn chưa chốt", "ADM3: nhóm case 'Cài đặt chung: hiệu lực thật lên thanh toán' + case Kế hoạch 'Giá trị nghiệp vụ tạm...'"),
        ("Công thức điểm chất lượng tìm kiếm", "40×rating/5 + 25×tương tác + 15 (mô tả ≥80 ký tự) + 10 (ảnh bìa) + 10 (bài 30 ngày) − 8×vi phạm", "Chưa chốt", "ADM2: Hiển thị tìm kiếm"),
        ("Gói hosting của owner (A16)", "Khởi đầu 0đ (phí 10%) vs Chuyên nghiệp 299.000đ/tháng - 2.990.000đ/năm (phí 2,9%), dùng thử 14 ngày, nhắc 3 ngày, tiền tệ VND (owner.*); không bắt buộc (owner.requirePlan=false); điều kiện Khám phá (10 thành viên, bài 7 ngày) chỉ hiển thị", "Chưa chốt (docs/OPEN_DECISIONS.md A16): MÔ PHỎNG, không trừ tiền khi hết thử", "WIZ: nhóm Bước 2, API gói owner, Global Settings owner.*, điểm chưa làm; ANN: tiền tệ lẫn lộn"),
        ("Chương trình giới thiệu (A17)", "Hoa hồng creator 30% (3000 bps), member 10% (1000 bps), cửa sổ ghi nhận 60 ngày kể từ lúc đăng ký, chi trả ngày 5 tháng sau, hoa hồng định kỳ (cửa sổ chỉ xét ở lần thanh toán đầu), tính trên số tiền khách trả, chỉ hủy hoa hồng pending khi hoàn tiền toàn bộ; chưa có job pending -> paid, hoa hồng creator chưa phát sinh", "Chưa chốt (A17)", "SETR: KPI, hoa hồng, Global Settings referral.* ([PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT])"),
        ("Đơn vị tiền ở Cài đặt > Thanh toán / Giới thiệu", "Gói thành viên USD ($7.00), gói hosting & hoa hồng creator VND; mockup hiển thị VND (149.000đ)", "Chưa chốt (A16/A17)", "SETB, SETR: case 'Kế hoạch' về tiền tệ"),
        ("Gói thành viên theo năm", "Kỳ năm 365 ngày (payments.annualPeriodDays), giá năm <= 12 x giá tháng, savings làm tròn, dùng thử thành viên 7 ngày + nhắc 3 ngày (payments.trialReminderDays), hoàn tiền gói năm trong cửa sổ 7 ngày, 'Phổ biến nhất' cố định ở gói tháng", "Chưa chốt (cùng nhóm giá trị tiền tạm)", "ANN: quote, checkout năm, gia hạn/hoàn tiền, nhắc dùng thử"),
    ]
    r = _table(ws, r, ["Hạng mục", "Giá trị tạm hiện tại", "Trạng thái", "Ảnh hưởng tới test"], pending)

    r = _h2(ws, r, "C. Còn mô phỏng / chưa làm (giữ 'Kế hoạch' trong test case)")
    todo = [
        ("Đăng nhập Google/Facebook", "Chưa làm (nút chỉ hiển thị hoặc không có). 2FA TOTP và đổi email của NGƯỜI DÙNG đã làm 2026-10-08 (module SETS); 2FA của nhân viên admin vẫn chỉ là cờ."),
        ("Cài đặt hồ sơ - chưa làm / mô phỏng", "i18n và dark mode (ngôn ngữ/giao diện chỉ lưu; múi giờ chỉ dùng cho giờ im lặng), theo dõi người dùng (notifyFollowedPosts, ô 'theo dõi' của thẻ xem trước), ảnh bìa hồ sơ, mã khôi phục 2FA + mã hóa secret, hủy email chờ xác nhận, geo-IP thiết bị, email tổng hợp daily/weekly + gửi bù email trong giờ im lặng, nguồn thông báo 'Bài nổi bật', lời mời theo người nhận, thanh bên cộng đồng toàn cục, hoa hồng creator (hosting mô phỏng), job chi trả pending -> paid, cột isDefault cho thẻ."),
        ("PDF chứng nhận", "Chưa làm (hiện chỉ trang chứng nhận + xác minh công khai)."),
        ("Tìm kiếm Postgres full-text", "ĐÃ LÀM 2026-10-05 (module PERF): tsvector + GIN + pg_trgm; còn thiếu tìm trong bình luận, sự kiện, bài học lớp học; chưa khớp chuỗi con giữa từ cho nội dung bài."),
        ("Email thật", "Chỉ ghi vào outbox dev (GET /api/dev/outbox), chưa nối SES/SMTP -> các case 'nhận email' giữ 'Kế hoạch'."),
        ("Upload S3/MinIO", "Đang lưu ổ đĩa cục bộ (StorageProvider đã tách sẵn)."),
        ("i18n VI/EN, SEO meta/OG, sitemap", "Chưa làm (nút 'VI' chỉ là hình)."),
        ("Nhiều instance BE", "ĐÃ LÀM 2026-10-05 (module INFRA): state chia sẻ qua Redis (REDIS_URL), job nền có leader election, worker riêng, tắt êm. Còn: rate limit express-rate-limit của auth theo từng instance, lastTs thông báo theo process, chưa có job dọn Session hết hạn."),
        ("Audit 2026-10-01: điểm chưa xử lý", "Email verification/digest/production mail (chưa gửi thật), drip content, lưu thẻ + dunning + chargeback thật, bình luận lồng/reply, @mention, sự kiện lặp/endAt, chuyển bài học giữa module/trạng thái nháp bài học, tên cấp 7-9, ban toàn nền tảng, 2FA/SSO, OpenAPI.", "Ngoài phạm vi 8 bước; giữ 'Kế hoạch' nếu có case"),
        ("Admin đợt 3 - chưa làm / mô phỏng", "2FA thật (chỉ cờ lưu trữ); require2fa/sessionTimeoutMin/currency/autoPayouts/timezone chỉ lưu cấu hình; job gửi cảnh báo/báo cáo admin chưa có; tích hợp là mô phỏng; cờ tính năng chưa được backend áp dụng và FE người dùng chưa đọc (kể cả maintenance); ticket chưa có SLA/đính kèm/nhận email trả lời; chỉ verify_email & reset_password đọc mẫu từ DB; chưa ẩn nút theo quyền; Phân tích chưa có CSV/khoảng ngày tùy ý/lượt truy cập/nguồn đăng ký; chưa có màn 'Ticket của tôi' cho người dùng."),
        ("Thiếu ở BE mà FE tạm xử lý", "Endpoint 'yêu cầu tham gia của tôi', 'yêu cầu hoàn tiền của tôi', cờ viewerBanned, cờ Platform Admin trong /auth/me, tìm người dùng để bắt đầu chat, Retry-After cho 429, postId trong báo cáo bình luận, trường tệp đính kèm cho bài viết."),
        ("Wizard 'Tạo cộng đồng' - chưa làm / mô phỏng", "Gói hosting owner không trừ tiền thật khi hết thử (mock:true, chưa có job/cổng/email nhắc cho gói owner); payout là mô phỏng (không KYC); chưa có job dọn nháp bỏ quên; chưa upload logo/ảnh bìa và chưa có giao diện sửa giá năm/câu hỏi/nội quy sau ra mắt; requireRulesAgreement chỉ ép ở join-requests (chưa ép ở checkout/trial/tham gia miễn phí); điều kiện Khám phá chỉ hiển thị; link chia sẻ sofinhub.com/<slug> chưa có route; 'Dùng mẫu' chỉ điều hướng; kéo-thả sắp xếp chỉ hình thức; xem trước chỉ bước 1 và 3; JoinRequestDialog chưa hiển thị câu hỏi/nội quy; admin chưa thấy câu trả lời."),
        ("Gói năm / dùng thử có thẻ - chưa làm", "Không đổi chu kỳ gói đang sống (tháng <-> năm), không proration; /billing và Admin > Gói đăng ký chưa hiện kỳ năm đúng; chưa có giao diện quản lý thẻ đã lưu; email nhắc chỉ vào outbox dev; trang chi tiết/thẻ Khám phá chưa hiện giá năm; cổng thanh toán thật (Stripe/PayOS) chưa nối - UI không giả lập được thẻ bị từ chối (tok_mock_declined chỉ qua API)."),
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
        ("1", "Kick/ban thành viên trả phí KHÔNG hủy gói (Subscription vẫn active, scheduler vẫn có thể thu phí)", "ĐÃ SỬA 2026-10-04 (module MONEY): kick kết thúc gói, ban dừng gia hạn; còn chốt hoàn tiền hay không."),
        ("2", "RSVP cộng +1 điểm mỗi lần (hủy rồi RSVP lại vẫn cộng, không thu hồi, không dedupe)", "ĐÃ SỬA 2026-10-04 (module GAME): khóa nghiệp vụ, +1 một lần, xóa sự kiện thu hồi điểm."),
        ("3", "Bài đã ẩn: PATCH/DELETE bởi người khác trả 403", "Cần chốt có cho mod thao tác trên bài ẩn không."),
        ("4", "Ban chưa có ở mức toàn nền tảng (chỉ ban theo cộng đồng)", "Case ban toàn nền tảng giữ 'Kế hoạch'."),
        ("5", "Platform Admin chưa cần emailVerified (chỉ so email trong PLATFORM_ADMIN_EMAILS -> rủi ro chiếm quyền nếu email chưa có tài khoản)", "Đề xuất bắt buộc xác thực email cho Platform Admin."),
        ("6", "Đăng bài/bình luận không giới hạn tốc độ và không có trần điểm/ngày", "ĐÃ SỬA một phần 2026-10-04 (module GAME): rate limit theo nhóm + toàn cục, điểm không farm được; chưa có trần điểm/ngày."),
        ("7", "/files/:key công khai (bảo mật bằng khóa ngẫu nhiên), chưa bắt đăng nhập", "ĐÃ SỬA 2026-10-04 (module SECX): chỉ ảnh công khai còn public; file riêng tư cần quyền/URL ký."),
        ("8", "Refresh token không thu hồi access token cũ cùng phiên (còn hiệu lực đến hết 15 phút)", "Ghi nhận để thống nhất, không phải lỗi."),
    ]
    r = _table(ws, r, ["#", "Điểm đã biết", "Ghi chú / cần quyết định"], known)

    for i, w in enumerate([24, 44, 80, 40, 50], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A4"
    return ws


# ---------------------------------------------------------------------------
# Sheet: Phân quyền (vai trò & ma trận quyền) - nguồn: backend/src/modules/permissions/policy.ts, backend/docs/API.md
# ---------------------------------------------------------------------------
ROLE_OVERVIEW = [
    ("Khách (guest)", "Chưa đăng nhập", "Người đứng ngoài cổng trường", "Xem trang chủ, trang giới thiệu khóa học công khai, form liên hệ POST /api/contact, GET /api/feature-flags. Mọi thao tác tương tác (đăng bài, bình luận, thích...) bị chuyển sang trang đăng nhập.", "Không có tài khoản"),
    ("Thành viên (member)", "Role cộng đồng, bậc 0", "Học sinh trong lớp", "Đọc bảng tin, đăng bài, bình luận, thích, đăng ký sự kiện, học bài, nhắn tin, xem xếp hạng; gửi/xem/trả lời ticket hỗ trợ của chính mình (/api/support/tickets). Chỉ sửa/xóa nội dung của chính mình.", "member1, member2, member3"),
    ("Điều hành viên (mod)", "Role cộng đồng, bậc 1", "Lớp phó / trực ban", "Mọi quyền của member + ghim/ẩn bài, xóa bình luận người khác, tạo/sửa/xóa sự kiện, quản lý nội dung lớp học, xử lý báo cáo trong cộng đồng.", "mod"),
    ("Quản trị cộng đồng (admin)", "Role cộng đồng, bậc 2", "Giáo viên chủ nhiệm", "Mọi quyền của mod + sửa thông tin cộng đồng, đặt/bỏ mod, kick/ban thành viên, duyệt yêu cầu tham gia, tạo lời mời, bật chứng nhận.", "cadmin"),
    ("Chủ cộng đồng (owner)", "Role cộng đồng, bậc 3", "Hiệu trưởng của lớp đó", "Mọi quyền của admin + cấp/thu hồi admin, đổi giá/chế độ riêng tư, xóa cộng đồng, chuyển quyền, xem doanh thu, yêu cầu rút tiền (chỉ đúng Owner).", "owner (photo, yt, fin, paid-demo, private-demo)"),
    ("Super Admin = Platform Admin (nền tảng)", "Role nền tảng, bậc 4 (cũng là 1 vai trò nhân viên)", "Đội vận hành SofinHub", "Toàn quyền: ghi đè Owner ở mọi cộng đồng; vào khu /admin với ĐỦ 16 khóa quyền. Xác định bằng email trong PLATFORM_ADMIN_EMAILS (nguồn 'env', không lưu trong DB, không sửa/xóa được từ giao diện) HOẶC vai trò nhân viên super_admin.", "admin (env)"),
]

# Vai trò NHÂN VIÊN ADMIN (từ đợt 3): (vai trò, làm được gì, khóa quyền, tài khoản test, ghi chú)
STAFF_ROLES = [
    ("Super Admin", "Mọi thứ trong /admin kể cả Tài khoản quản trị, Vai trò & Quyền, Cài đặt chung, Feature flags, Audit; ghi đè Owner ở cộng đồng (chỉ nguồn env).", "Đủ 16 khóa (cột khóa cố định, không sửa được)", "admin@sofinhub.test (env)", "Tự thân/Super Admin env bị khóa: không đổi vai trò/tạm ngưng/gỡ quyền được (409)."),
    ("Moderator ('Kiểm duyệt viên' trên giao diện)", "Cộng đồng (duyệt/đình chỉ/xóa/khóa), Khám phá + Danh mục hệ thống, Người dùng (xem + hạn chế/đình chỉ/cấm/cảnh cáo), Kiểm duyệt, Nội dung, Phân tích. KHÔNG: thanh toán, hỗ trợ, nhật ký, cờ, cài đặt, quản trị viên.", "dashboard.view, community.manage, report.resolve, user.ban, users.view, content.manage, analytics.view", "moderator@, john.carter@, mia.lopez@, nina@ (tạm khóa)", "Không ban/suspend được NHÂN VIÊN khác (403)."),
    ("Support ('Hỗ trợ')", "Hỗ trợ (ticket), Người dùng (chỉ xem), Kiểm duyệt (xử lý báo cáo), Thanh toán (xem) + duyệt/từ chối hoàn tiền. KHÔNG: ban người dùng, duyệt chi trả, payment.manage, phân tích, nội dung, cộng đồng.", "dashboard.view, report.resolve, payment.refund, users.view, payment.view, support.manage", "support@ (Ryan Cho), tom@ (không 2FA)", "Nút ghi vẫn hiện nhưng BE trả 403 khi thiếu quyền (chưa ẩn nút theo quyền)."),
    ("Finance ('Tài chính')", "Thanh toán (xem + thử lại/gói/tranh chấp), hoàn tiền, duyệt/giữ chi trả, Phân tích. KHÔNG: người dùng, kiểm duyệt, nội dung, hỗ trợ, hệ thống.", "dashboard.view, payment.refund, payout.approve, payment.view, payment.manage, analytics.view", "finance@ (Grace Lee)", "Không có users.view nên không mở được hồ sơ người dùng từ giao dịch."),
    ("Vai trò tùy chỉnh (do Super Admin tạo)", "Tập con quyền tự chọn ở Hệ thống > Vai trò & Quyền. Không được có admin.manage. Mẫu: Content Reviewer = dashboard.view + users.view + content.manage.", "Tùy chọn (tối đa 15 khóa, không gồm admin.manage)", "Chưa có tài khoản seed (gán cho user thường để test)", "Xóa chỉ khi không còn nhân viên dùng; sửa ô ma trận có hiệu lực ngay ở request kế tiếp."),
    ("Nhân viên bị tạm khóa (AdminAccount.status=suspended)", "Không dùng được /admin dù vai trò còn nguyên: mọi /admin/* (kể cả /admin/me) trả 403 'Tài khoản admin của bạn đã bị tạm khóa'. Tài khoản thường vẫn đăng nhập bình thường.", "(giữ vai trò nhưng vô hiệu)", "nina@ (Moderator, tạm khóa)", "Trục RIÊNG với trạng thái tài khoản người dùng; Kích hoạt lại ở Tài khoản quản trị."),
    ("Người dùng thường / chủ cộng đồng (không có AdminAccount)", "Không vào được /admin: 401 khi thiếu token, 403 'Chỉ nhân viên admin mới có quyền này'.", "-", "member1, owner, cadmin...", "Chủ/quản trị cộng đồng KHÁC nhân viên nền tảng."),
]

# Ma trận quyền CỘNG ĐỒNG: (nhóm, hành động, khách, member, mod, admin, owner, super_admin). Y = được, N = không.
MATRIX = [
    ("Xem", "Xem trang chủ, danh sách & giới thiệu khóa học công khai", "Y", "Y", "Y", "Y", "Y", "Y"),
    ("Xem", "Xem bảng tin, lớp học, lịch, thành viên, xếp hạng của cộng đồng đã tham gia", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Tương tác", "Đăng bài, bình luận, thích, vote khảo sát", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Tương tác", "Đăng ký sự kiện (RSVP), học bài, nhận chứng nhận, nhắn tin", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Tương tác", "Sửa/xóa bài & bình luận của CHÍNH MÌNH", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Hỗ trợ (người dùng)", "Gửi / xem / trả lời ticket của CHÍNH MÌNH (/api/support/tickets, đăng nhập)", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Hỗ trợ (người dùng)", "Gửi form liên hệ POST /api/contact (không cần đăng nhập)", "Y", "Y", "Y", "Y", "Y", "Y"),
    ("Nội dung", "Sửa/xóa bài & bình luận của NGƯỜI KHÁC", "N", "N", "Y", "Y", "Y", "Y"),
    ("Nội dung", "Ghim / ẩn bài viết", "N", "N", "Y", "Y", "Y", "Y"),
    ("Nội dung", "Tạo / sửa / xóa sự kiện", "N", "N", "Y", "Y", "Y", "Y"),
    ("Nội dung", "Quản lý nội dung lớp học (module, bài học)", "N", "N", "Y", "Y", "Y", "Y"),
    ("Kiểm duyệt", "Báo cáo bài / bình luận / thành viên vi phạm", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Kiểm duyệt", "Xem & xử lý hàng đợi báo cáo của cộng đồng", "N", "N", "Y", "Y", "Y", "Y"),
    ("Quản lý cộng đồng", "Sửa thông tin cộng đồng (tên, mô tả, cài đặt)", "N", "N", "N", "Y", "Y", "Y"),
    ("Quản lý cộng đồng", "Duyệt yêu cầu tham gia, tạo / thu hồi lời mời", "N", "N", "N", "Y", "Y", "Y"),
    ("Quản lý cộng đồng", "Bật / tắt chứng nhận", "N", "N", "N", "Y", "Y", "Y"),
    ("Quản lý thành viên", "Đặt / bỏ vai trò mod", "N", "N", "N", "Y", "Y", "Y"),
    ("Quản lý thành viên", "Kick / ban thành viên (chỉ người bậc THẤP HƠN mình, không bao giờ lên Owner)", "N", "N", "N", "Y", "Y", "Y"),
    ("Quản lý thành viên", "Cấp / thu hồi vai trò admin, chuyển quyền owner", "N", "N", "N", "N", "Y", "Y"),
    ("Chủ sở hữu", "Đổi giá, đổi chế độ công khai/riêng tư, xóa cộng đồng", "N", "N", "N", "N", "Y", "Y"),
    ("Chủ sở hữu", "Xem doanh thu cộng đồng", "N", "N", "N", "N", "Y", "Y"),
    ("Chủ sở hữu", "Yêu cầu rút tiền (CHỈ đúng Owner, kể cả Super Admin cũng không)", "N", "N", "N", "N", "Y", "N"),
    ("Cộng đồng bị khóa (audit bước 3)", "Cộng đồng ĐANG BỊ KHÓA/đình chỉ: sửa, xóa, mời, đổi vai trò, kick/ban/gỡ ban, chuyển quyền, quản lý lớp học, duyệt yêu cầu, xem doanh thu, rút tiền -> owner/admin/mod đều 403 (COMMUNITY_LOCKED); chỉ Super Admin (env) làm được", "N", "N", "N", "N", "N", "Y"),
    ("Khóa học (đa khóa, audit bước 6)", "Xem danh sách khóa PUBLISHED + module/bài/tiến độ/chứng nhận của khóa", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Khóa học (đa khóa, audit bước 6)", "Xem khóa NHÁP / LƯU TRỮ (thành viên thường nhận 404)", "N", "N", "Y", "Y", "Y", "Y"),
    ("Khóa học (đa khóa, audit bước 6)", "Tạo / sửa tên-mô tả-ảnh / sắp xếp / lưu trữ khóa học; quản lý module và bài trong khóa", "N", "N", "Y", "Y", "Y", "Y"),
    ("Khóa học (đa khóa, audit bước 6)", "Xóa khóa học (không xóa được khóa cuối) và đổi override chứng nhận của khóa (certificatesEnabled)", "N", "N", "N", "Y", "Y", "Y"),
    ("Nền tảng", "Nhân viên Moderator/Support/Finance KHÔNG có quyền ghi đè Owner trong cộng đồng (chỉ Super Admin nguồn env mới có)", "N", "N", "N", "N", "N", "Y"),
    ("Nền tảng", "Truy cập khu /admin: xem tầng NHÂN VIÊN (mục B2) - quyền theo vai trò nhân viên, không còn 'chỉ Platform Admin'", "N", "N", "N", "N", "N", "Y"),
    ("Wizard tạo cộng đồng", "Tạo / xem / sửa / xóa / ra mắt NHÁP của CHÍNH MÌNH (POST /communities/drafts, /me/community-drafts, /communities/:id/draft*, publish; mọi người dùng đăng nhập, tối đa 5 nháp)", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Wizard tạo cộng đồng", "Xem / sửa / xóa / ra mắt NHÁP của NGƯỜI KHÁC (kể cả Super Admin và nhân viên /admin: nháp không hiện ở danh sách admin; BE trả 404)", "N", "N", "N", "N", "N", "N"),
    ("Gói hosting & payout", "Xem/đặt gói hosting của owner và tài khoản nhận tiền (GET/PUT hosting-plan, payout-account, skip) của cộng đồng ĐÃ ra mắt (requireRole owner; nháp: chỉ chủ nháp)", "N", "N", "N", "N", "Y", "Y"),
    ("Gói hosting & payout", "Rút tiền POST /communities/:id/payouts khi payout 'skipped' -> 400 PAYOUT_ACCOUNT_REQUIRED (guard trên mọi vai trò; cộng đồng cũ không bản ghi giữ luồng cũ)", "N", "N", "N", "N", "Y", "Y"),
    ("Wizard tạo cộng đồng", "Xem danh sách ra mắt GET /communities/:id/launch-checklist (owner; người khác 403; nháp 409 NOT_PUBLISHED)", "N", "N", "N", "N", "Y", "Y"),
    ("Yêu cầu tham gia", "Xem CÂU TRẢ LỜI của người xin gia nhập (GET /communities/:id/join-requests -> answers) - admin+ như duyệt yêu cầu; member thường 403", "N", "N", "N", "Y", "Y", "Y"),
    ("Yêu cầu tham gia", "Gửi yêu cầu tham gia kèm answers/acceptRules (cộng đồng riêng tư có câu hỏi/nội quy bắt buộc); khách 401", "N", "Y", "Y", "Y", "Y", "Y"),
    ("Gói thành viên", "Mua/dùng thử gói tháng hoặc năm có thẻ (POST /checkout, /trial với interval + paymentMethod); cộng đồng riêng tư cần được duyệt trừ khi autoApprovePaid", "N", "Y", "Y", "Y", "N", "Y"),
]

# Ma trận NHÂN VIÊN ADMIN theo nhóm route: (nhóm, hành động / route, khóa quyền, non-staff, super, moderator, support, finance, content_reviewer)
# Sinh từ qa/cases_admin3.py (PERMS) để sheet này và các case ma trận luôn khớp.
STAFF_MATRIX_ROWS = [
    ("Chung", "Vào khu /admin, GET /admin/me (mọi nhân viên đang hoạt động)", None),
    ("Đợt 1", "Tổng quan (GET /admin/dashboard)", "dashboard.view"),
    ("Đợt 1", "Cộng đồng: danh sách, duyệt/yêu cầu sửa/từ chối/tạm ngưng/xóa/khôi phục (/admin/communities/**)", "community.manage"),
    ("Đợt 2", "Khám phá: cộng đồng hiển thị, danh mục, nổi bật, xếp hạng, hiển thị tìm kiếm (/admin/discovery/**) + Hệ thống > Danh mục (/admin/system/categories/**)", "community.manage"),
    ("Đợt 1", "Người dùng: XEM danh sách/chi tiết (GET /admin/users/**)", "users.view"),
    ("Đợt 1", "Người dùng: hạn chế / tạm ngưng / cấm / khôi phục / cảnh cáo / thu hồi phiên (POST|DELETE /admin/users/**)", "user.ban"),
    ("Đợt 1", "Kiểm duyệt: hàng đợi báo cáo, xử lý vụ việc (/admin/moderation/**, /admin/reports*)", "report.resolve"),
    ("Đợt 2", "Nội dung: bài viết, bình luận, khóa học, bài học, sự kiện, media (/admin/content/**)", "content.manage"),
    ("Đợt 2", "Thanh toán: XEM giao dịch, gói đăng ký, hoàn tiền, tranh chấp, doanh thu creator, chi trả (GET /admin/payments/**) + route cũ GET /admin/refunds, /admin/payouts", "payment.view"),
    ("Đợt 2", "Hoàn tiền: duyệt/từ chối, hoàn tiền trực tiếp giao dịch (POST payments/refunds/:id/approve|reject, payments/transactions/:id/refund) + route cũ PATCH /admin/refunds/:id", "payment.refund"),
    ("Đợt 2", "Thanh toán khác: thử lại thanh toán, tạm dừng/tiếp tục/hủy gói, tranh chấp (POST còn lại của /admin/payments/**)", "payment.manage"),
    ("Đợt 2", "Chi trả: giữ/giải ngân/đánh dấu thất bại (POST /admin/payments/payouts/**) + route cũ PATCH /admin/payouts/:id", "payout.approve"),
    ("Đợt 3", "Phân tích: 6 trang (GET /admin/analytics/**)", "analytics.view"),
    ("Đợt 3", "Hỗ trợ: ticket (xem, tạo hộ khách, giao, trả lời, ghi chú, chuyển cấp, giải quyết, đóng, mở lại) (/admin/support/**)", "support.manage"),
    ("Đợt 1/3", "Nhật ký hoạt động + xuất CSV (/admin/audit-logs*)", "audit.view"),
    ("Đợt 3", "Tính năng thử nghiệm (/admin/system/flags/**)", "system.flags"),
    ("Đợt 3", "Cài đặt chung, Tích hợp, Thông báo/broadcast, Mẫu email (/admin/system/{settings,integrations,notifications,email-templates}/**)", "system.settings"),
    ("Đợt 3", "Tài khoản quản trị + Vai trò & Quyền (/admin/system/{admins,roles}/**)", "admin.manage"),
    ("Khác", "Route /admin/* không có trong bảng luật (an toàn mặc định)", "super"),
]
PERM_LABEL = {
    "dashboard.view": ("View dashboard", "Xem bảng điều khiển", "GET /admin/dashboard; /admin/me không cần quyền"),
    "community.manage": ("Manage communities", "Quản lý cộng đồng", "/admin/communities/**, /admin/discovery/**, /admin/system/categories/**"),
    "content.manage": ("Manage content", "Quản lý nội dung", "/admin/content/**"),
    "report.resolve": ("Resolve reports", "Xử lý báo cáo", "/admin/moderation/**, /admin/reports*"),
    "user.ban": ("Ban users", "Cấm người dùng", "POST/DELETE /admin/users/**"),
    "users.view": ("View users", "Xem người dùng", "GET /admin/users/**"),
    "payment.view": ("View payments", "Xem thanh toán", "GET /admin/payments/**, GET /admin/refunds|payouts"),
    "payment.refund": ("Issue refunds", "Hoàn tiền", "payments/refunds/:id/approve|reject, payments/transactions/:id/refund, PATCH /admin/refunds/:id"),
    "payment.manage": ("Manage payments", "Quản lý thanh toán", "POST còn lại của /admin/payments/** (retry, subscriptions, chargebacks)"),
    "payout.approve": ("Approve payouts", "Duyệt chi trả", "POST /admin/payments/payouts/**, PATCH /admin/payouts/:id"),
    "analytics.view": ("View analytics", "Xem phân tích", "/admin/analytics/**"),
    "support.manage": ("Handle support tickets", "Xử lý ticket hỗ trợ", "/admin/support/**"),
    "audit.view": ("View audit logs", "Xem nhật ký hoạt động", "/admin/audit-logs*"),
    "system.flags": ("Edit feature flags", "Sửa tính năng thử nghiệm", "/admin/system/flags/**"),
    "system.settings": ("System settings", "Cài đặt hệ thống", "/admin/system/{settings,integrations,notifications,email-templates}/**"),
    "admin.manage": ("Manage admins", "Quản lý quản trị viên", "/admin/system/{admins,roles}/** - CHỈ Super Admin (không gán được cho vai trò khác)"),
}

ACCOUNT_STATUS = [
    ("Bình thường (active)", "Dùng đầy đủ theo vai trò của mình.", "Đăng nhập được", "member1, owner, sarah...", "-"),
    ("Hạn chế (restricted)", "Vẫn ĐỌC được nhưng bị chặn một số việc: đăng bài, bình luận, nhắn tin, tạo cộng đồng, checkout (403 ACCOUNT_RESTRICTED). Có thể có hạn (statusUntil), hết hạn tự gỡ.", "Đăng nhập được", "maya (chặn đăng bài + bình luận, còn 7 ngày), ethan (chặn nhắn tin + tạo cộng đồng, còn 3 ngày)", "Giống phạt cấm nói"),
    ("Tạm ngưng (suspended)", "Không đăng nhập được (403 ACCOUNT_SUSPENDED); mọi phiên đăng nhập bị thu hồi ngay. Có thể có hạn hoặc vô thời hạn.", "KHÔNG", "olivia (14 ngày), lucas (vô thời hạn)", "Giống đình chỉ học"),
    ("Cấm (banned)", "Không đăng nhập được vĩnh viễn (403 ACCOUNT_BANNED), phiên bị thu hồi.", "KHÔNG", "sophia", "Giống đuổi học"),
    ("Bị ban khỏi 1 cộng đồng", "Chỉ mất tư cách thành viên của cộng đồng đó (bản ghi CommunityBan), vẫn đăng nhập và dùng các phần khác bình thường.", "Đăng nhập được", "banned@sofinhub.test (bị ban khỏi photo)", "Khác hoàn toàn với 'Cấm' ở trên"),
    ("Nhân viên admin bị tạm khóa (AdminAccount suspended)", "Chỉ mất quyền /admin (403 'Tài khoản admin của bạn đã bị tạm khóa' ở mọi /admin/*, kể cả /admin/me); tài khoản thường và phiên đăng nhập KHÔNG bị ảnh hưởng. Quản lý ở Hệ thống > Tài khoản quản trị (Tạm ngưng / Kích hoạt lại).", "Đăng nhập thường được; /admin bị chặn", "nina@ (Moderator)", "Trục khác với 'Tạm ngưng' của người dùng; nhân viên không thể bị ban/suspend qua /admin/users (403)."),
]

RULES = [
    ("Cộng đồng bị khóa chặn cả vai trò quản trị (từ 2026-10-04)", "policy.requireRole kiểm cờ locked/đình chỉ: owner, admin, mod đều bị 403 ở mọi thao tác quản trị (sửa, xóa, mời, đổi vai trò, kick/ban, chuyển quyền, lớp học, doanh thu, payout); thành viên thường vẫn bị COMMUNITY_LOCKED khi đọc. Chỉ Super Admin (env) vượt được; nhân viên Moderator/Support/Finance KHÔNG đổi (không ghi đè Owner)."),
    ("Quyền khóa học = quyền cộng đồng (từ 2026-10-06)", "Không có vai trò riêng theo khóa học: member đọc khóa published; mod tạo/sửa/sắp xếp/lưu trữ khóa + quản lý module/bài; admin xóa khóa và đổi override chứng nhận (certificatesEnabled); khóa nháp/lưu trữ chỉ mod+ thấy; khóa bị admin console gỡ biến mất với mọi người."),
    ("ban() không lộ userId (từ 2026-10-04)", "Ban người chưa là thành viên hoặc uuid lạ trả 404 như nhau, không tạo CommunityBan, không gửi thông báo; chỉ tác động bậc thấp hơn."),
    ("Hai tầng quyền độc lập", "(1) Vai trò CỘNG ĐỒNG theo từng cộng đồng (member<mod<admin<owner); (2) Vai trò NHÂN VIÊN ADMIN toàn nền tảng (Super Admin/Moderator/Support/Finance/tùy chỉnh) quyết định ai gọi được /api/admin/*. Nhân viên Moderator/Support/Finance KHÔNG có quyền ghi đè Owner trong cộng đồng; chỉ Super Admin nguồn env mới có."),
    ("Vai trò gắn theo TỪNG cộng đồng", "Một người có thể là owner ở cộng đồng A và member ở cộng đồng B. Test phân quyền phải nêu rõ cộng đồng nào."),
    ("Quyền cộng dồn theo thứ bậc (cộng đồng)", "member < mod < admin < owner < super admin (env); bậc cao làm được mọi việc của bậc thấp."),
    ("Chỉ tác động lên người bậc thấp hơn", "Kick/ban/đổi vai trò trong cộng đồng chỉ áp lên người có bậc THẤP HƠN mình và không bao giờ lên Owner."),
    ("Quyền do server quyết định", "FE chỉ ẩn/hiện menu/trang cho gọn (nhóm/mục sidebar, 'Không đủ quyền'); nút thao tác vẫn hiện nên test bảo mật phải gọi thẳng API bằng token của vai trò thấp để xác nhận 403."),
    ("Guard TẬP TRUNG cho /api/admin/*", "Middleware adminOnly: 401 nếu thiếu token -> phải là nhân viên đang hoạt động (403 'Chỉ nhân viên admin mới có quyền này' / 'Tài khoản admin của bạn đã bị tạm khóa') -> có đúng khóa quyền suy ra từ (method, path) (403 'Vai trò X không có quyền \"khóa\"'). Quyền kiểm TRƯỚC khi validate body/tìm bản ghi nên id giả vẫn 403 với route không được phép. Route không có trong bảng luật: chỉ Super Admin."),
    ("Quyền đọc từ DB mỗi request", "Đổi ô ma trận / đổi vai trò / tạm khóa / gỡ nhân viên có hiệu lực ngay ở request kế tiếp (không cần đăng nhập lại, không cache theo token)."),
    ("Super Admin nguồn env", "Email trong PLATFORM_ADMIN_EMAILS: không lưu trong DB, không sửa/tạm ngưng/gỡ được (409); chính mình cũng không tự sửa được (409). owner/cadmin KHÔNG vào được /admin dù là chủ cộng đồng."),
    ("admin.manage không gán được", "Khóa 'Quản lý quản trị viên' chỉ thuộc Super Admin; gán cho vai trò khác (tạo/sửa vai trò, bật ô ma trận) bị 400. Giao diện chặn trước ở ô ma trận."),
    ("Nhân viên được bảo vệ khỏi /admin/users", "Không ai (kể cả Super Admin) ban/suspend/restrict/reinstate/warn một NHÂN VIÊN qua /admin/users/* (403); phải quản lý ở Tài khoản quản trị."),
    ("Route cũ đi qua cùng guard", "/admin/refunds (xem=payment.view, PATCH=payment.refund) và /admin/payouts (xem=payment.view, PATCH=payout.approve) không còn là 'chỉ Platform Admin'."),
    ("Trạng thái tài khoản là trục riêng", "Áp lên người dùng bất kể vai trò (Owner bị tạm ngưng vẫn không đăng nhập được); trạng thái nhân viên (active/suspended) là trục thứ ba, chỉ ảnh hưởng /admin."),
    ("Nội dung bị admin tác động (đợt 2)", "Bài viết/bình luận/bài học/sự kiện/tệp bị nhân viên có content.manage GỠ biến mất với mọi người kể cả mod, admin cộng đồng, owner và tác giả (chỉ nhân viên admin còn thấy); bị ẨN thì member thường không thấy nhưng tác giả và mod+ vẫn thấy. Khóa học bị hủy xuất bản/lưu trữ/gỡ cũng ẩn với mod cộng đồng."),
    ("Mod/admin cộng đồng không đảo ngược được thao tác của nhân viên admin", "Mod cộng đồng không khôi phục được nội dung do nhân viên admin gỡ; chỉ khôi phục ở /admin/content/*."),
    ("Nháp wizard chỉ chủ nháp thấy (từ 2026-10-07)", "Nháp (moderationStatus='draft') chỉ chủ nháp đọc/sửa/xóa/ra mắt được: người khác (kể cả Super Admin và nhân viên admin) nhận 404, không phân biệt với id không tồn tại. Nháp ẩn khỏi danh sách/tìm kiếm/chi tiết công khai và khỏi danh sách, bộ đếm, dashboard, Khám phá, Phân tích của admin. Slug của nháp vẫn bị chiếm với người khác. Mỗi người tối đa 5 nháp."),
    ("Guard rút tiền theo payout (từ 2026-10-07)", "Cộng đồng có PayoutAccount 'skipped' bị chặn rút (400 PAYOUT_ACCOUNT_REQUIRED) cho tới khi kết nối; 'connected' thì không cần gửi method; cộng đồng tạo kiểu cũ (không bản ghi) giữ luồng cũ. Ra mắt bằng wizard mà không qua bước payout mặc định 'skipped'."),
    ("Gói hosting của owner & payout là MÔ PHỎNG (A16)", "Chỉ owner (requireRole) đọc/sửa; không trừ tiền thật, không KYC. Cột 'Super Admin' đọc được vì thứ bậc platform_admin > owner."),
    ("Câu trả lời join request chỉ cho admin+ (từ 2026-10-07)", "Bản chụp [{question, answer}] nằm ở GET /communities/:id/join-requests (admin+, member 403); FE admin hiện chưa hiển thị. requireRulesAgreement chỉ ép ở join-requests (acceptRules)."),
    ("Cài đặt cá nhân chỉ tác động chủ tài khoản (từ 2026-10-08)", "Hồ sơ, tùy chọn, đổi email/mật khẩu, 2FA, phiên đăng nhập, thẻ thanh toán, tùy chọn thông báo, cộng đồng của tôi, mã giới thiệu đều lấy chủ thể từ access token (không có tham số userId). Thẻ/phiên/cộng đồng của người khác trả 404 (không lộ tồn tại); secret TOTP chỉ trả ở /auth/2fa/setup; server không bao giờ nhận số thẻ/CVC. Người được giới thiệu chỉ lộ tên/ảnh/cộng đồng/số tiền cho người giới thiệu (404 với người lạ)."),
]

NOT_BUILT = [
    ("Ghi danh/vai trò theo từng khóa học", "Enrollment, thanh toán, điểm vẫn theo CỘNG ĐỒNG; chưa có ghi danh hay vai trò riêng cho từng khóa học (case Kế hoạch ở SPLIT)."),
    ("2FA thật cho nhân viên admin", "Chỉ có cờ twoFactorEnabled (lưu + email khi 'Đặt lại 2FA'); security.require2fa chỉ lưu cấu hình, không bắt buộc (case Kế hoạch ở ADM3)."),
    ("Quyền ở mức NÚT bấm", "FE chỉ ẩn nhóm/mục menu và chặn trang; Support vẫn thấy nút 'Cảnh cáo/Tạm ngưng', Support/Finance thấy nút chi trả - bấm bị BE trả 403 + toast lỗi."),
    ("Thu hồi phiên đăng nhập khi tạm khóa/gỡ nhân viên", "Chỉ chặn /admin ở mỗi request; phiên thường vẫn còn (xem case Kế hoạch ADM3)."),
    ("Tách quyền 'xem' và 'ghi' ở mọi nhóm", "Chỉ Người dùng (users.view/user.ban) và Thanh toán (payment.view/refund/manage/payout.approve) được tách; Cộng đồng, Nội dung, Kiểm duyệt, Hỗ trợ dùng 1 khóa cho cả xem và ghi."),
    ("Ticket người dùng ở giao diện", "API /api/support/tickets đã có nhưng frontend người dùng chưa có màn 'Ticket của tôi'."),
    ("Quyền theo nháp wizard cho nhân viên admin", "Nhân viên /admin không xem/duyệt nháp (chỉ thấy cộng đồng sau khi ra mắt); chưa có luồng duyệt cộng đồng mới trước khi hiển thị (ra mắt = active ngay)."),
]


def _matrix(ws, r, hdr, rows, ncols, yes_fill, no_fill, text_cols=2, wrap_h=32):
    for i, h in enumerate(hdr, start=1):
        c = ws.cell(row=r, column=i, value=h)
        c.font, c.fill, c.border = HDR_FONT, HDR_FILL, BORDER
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[r].height = 32
    r += 1
    for g, action, *marks in rows:
        ws.cell(row=r, column=1, value=g).font = BOLD
        ws.cell(row=r, column=2, value=action).font = BASE
        for i, m in enumerate(marks, start=text_cols + 1):
            if m in ("Y", "N"):
                c = ws.cell(row=r, column=i, value="✔" if m == "Y" else "✖")
                c.fill = yes_fill if m == "Y" else no_fill
                c.font = Font(name=FONT, size=11, bold=True, color="006100" if m == "Y" else "9C0006")
                c.alignment = Alignment(horizontal="center", vertical="center")
            else:
                c = ws.cell(row=r, column=i, value=m)
                c.font = BASE
                c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        for i in (1, 2):
            ws.cell(row=r, column=i).alignment = WRAP
        for i in range(1, ncols + 1):
            ws.cell(row=r, column=i).border = BORDER
        ws.row_dimensions[r].height = max(20, 15 * (len(action) // 62 + 1) + 4)
        r += 1
    return r + 1


def build_roles_sheet(wb):
    """Sheet 'Phân quyền' (viết lại 2026-10-03): tầng cộng đồng + tầng NHÂN VIÊN ADMIN (16 khóa quyền). Ma trận nhân viên sinh từ PERMS của qa/cases_admin3.py."""
    from cases_admin3 import PERMS, ALL_PERMS, NAV, can, sidebar_for, ROLE_NAME  # cùng thư mục qa/
    ws = wb.create_sheet("Phân quyền")
    ncols = 8
    _title(ws, "PHÂN QUYỀN — VAI TRÒ CỘNG ĐỒNG & VAI TRÒ NHÂN VIÊN ADMIN SOFINHUB", ncols)
    ws.cell(row=2, column=1, value="Nguồn: backend/src/modules/permissions/policy.ts (cộng đồng), backend/src/modules/admin/admin-staff.permissions.ts + backend/docs/api/admin-batch3.md mục 0 (nhân viên admin, từ 2026-10-03). Đổi quyền thì sửa PERMS trong qa/cases_admin3.py (ma trận bên dưới và case ADM3 sinh từ đó) và các bảng trong qa/sheets_extra.py.").font = BOLD
    yes_fill, no_fill = PatternFill("solid", fgColor="C6EFCE"), PatternFill("solid", fgColor="FFC7CE")
    r = 4
    r = _h2(ws, r, "A. Vai trò CỘNG ĐỒNG và Super Admin (tầng 1: ai làm gì TRONG một cộng đồng)")
    r = _table(ws, r, ["Vai trò", "Làm được gì", "Loại / bậc", "Ví dụ đời thường", "Tài khoản test"], [(a, d, b, c, e) for (a, b, c, d, e) in ROLE_OVERVIEW])
    r = _h2(ws, r, "A2. Vai trò NHÂN VIÊN ADMIN (tầng 2: ai gọi được /api/admin/* và thấy mục nào ở /admin) - đã xây từ Admin đợt 3")
    r = _table(ws, r, ["Vai trò nhân viên", "Làm được gì", "Khóa quyền", "Tài khoản test", "Ghi chú"], STAFF_ROLES)
    r = _h2(ws, r, "B. Ma trận quyền CỘNG ĐỒNG (✔ = được, ✖ = bị chặn: server trả 403 hoặc chuyển sang đăng nhập)")
    r = _matrix(ws, r, ["Nhóm", "Hành động", "Khách", "Member", "Mod", "Admin", "Owner", "Super Admin (env)"], MATRIX, ncols, yes_fill, no_fill)
    r = _h2(ws, r, "B2. Ma trận NHÂN VIÊN ADMIN theo nhóm route (✔ = qua guard, ✖ = 403). Cột 'Content Reviewer' là vai trò tùy chỉnh mẫu")
    rows2 = []
    for g, action, perm in STAFF_MATRIX_ROWS:
        marks = ["Y" if perm is None and False else "N"]  # người dùng thường: không vào /admin
        for role in ("super_admin", "moderator", "support", "finance", "content_reviewer"):
            marks.append("Y" if can(role, perm) else "N")
        rows2.append((g, f"{action}  [quyền: {perm if perm else 'chỉ cần là nhân viên'}]", *marks))
    r = _matrix(ws, r, ["Đợt", "Nhóm route / hành động", "Người dùng thường / khách", "Super Admin", "Moderator", "Support", "Finance", "Content Reviewer (tùy chỉnh)"], rows2, ncols, yes_fill, no_fill)
    r = _h2(ws, r, "B3. 16 KHÓA QUYỀN × vai trò nhân viên (mặc định; sửa được ở Hệ thống > Vai trò & Quyền trừ cột Super Admin)")
    rows3 = []
    for k in ALL_PERMS:
        en, vi, routes = PERM_LABEL[k]
        marks = ["Y" if k in PERMS[role] else "N" for role in ("super_admin", "moderator", "support", "finance", "content_reviewer")]
        rows3.append((k, f"{vi} ({en}) - {routes}", *marks, "KHÔNG (chỉ Super Admin)" if k == "admin.manage" else "Có thể gán"))
    r = _matrix(ws, r, ["Khóa quyền", "Nhãn & route được phủ", "Super Admin", "Moderator", "Support", "Finance", "Content Reviewer", "Gán cho vai trò tùy chỉnh?"], rows3, ncols, yes_fill, no_fill)
    tot = ["Tổng số khóa", "Số quyền mỗi vai trò"] + [str(len(PERMS[role])) for role in ("super_admin", "moderator", "support", "finance", "content_reviewer")] + [""]
    for i, v in enumerate(tot, start=1):
        c = ws.cell(row=r - 1, column=i, value=v)
        c.font, c.border = BOLD, BORDER
        c.alignment = Alignment(horizontal="center" if i > 2 else "left", vertical="center")
    r += 1
    r = _h2(ws, r, "B4. Sidebar /admin hiển thị theo vai trò (nhóm ẩn hoàn toàn khi không có mục con truy cập được; trang không đủ quyền hiện 'Không đủ quyền')")
    side = []
    for role in ("super_admin", "moderator", "support", "finance", "content_reviewer"):
        shown, hidden = sidebar_for(role)
        side.append((ROLE_NAME[role], "; ".join(shown), ", ".join(hidden) if hidden else "(không)"))
    r = _table(ws, r, ["Vai trò", "Nhóm hiển thị", "Nhóm ẩn"], side)
    r = _h2(ws, r, "C. Trạng thái tài khoản (trục riêng, áp lên mọi vai trò) và trạng thái nhân viên")
    r = _table(ws, r, ["Trạng thái", "Ảnh hưởng", "Đăng nhập?", "Tài khoản seed", "Hình dung"], ACCOUNT_STATUS)
    r = _h2(ws, r, "D. Quy tắc cần nhớ khi test phân quyền")
    r = _table(ws, r, ["Quy tắc", "Giải thích"], RULES)
    r = _h2(ws, r, "E. Chưa có / lưu ý (không test như tính năng đã hoàn thiện)")
    r = _table(ws, r, ["Hạng mục", "Ghi chú"], NOT_BUILT)
    for i, w in enumerate([34, 66, 20, 30, 34, 16, 16, 22], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.sheet_properties.tabColor = "C00000"
    ws.freeze_panes = "A4"
    return ws
