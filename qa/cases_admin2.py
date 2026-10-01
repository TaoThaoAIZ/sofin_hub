# -*- coding: utf-8 -*-
"""Testcase module ADM2 (Admin Console - đợt 2, 2026-10-02): Nội dung · Thanh toán · Khám phá.
Nguồn sự thật: backend/docs/api/admin-batch2.md (hợp đồng cuối + mục "Khác biệt"), docs/features/admin-batch2.md, frontend/ADMIN_BACKEND_GAPS.md (mục Admin đợt 2),
backend/src/modules/admin/admin-{content,payments,discovery}.service.ts + admin-b2.routes.ts, backend/src/modules/discovery/*, backend/tests/admin-batch2.test.ts,
backend/prisma/seed/admin-batch2.ts, frontend/src/features/admin/pages/{Content,Payments,Discovery}Views.tsx.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-ADM2-nnn không đổi).

Cách tìm bản ghi seed: id seed = UUID suy từ md5('seed-admin2-<tên>') nên MÃ HIỂN THỊ (POST-D186CDF7, TXN-5ECCCEFC, PO-60986918...) cố định sau mỗi lần db:reset;
giao diện không hiện id đầy đủ nên tester tìm bằng ô tìm kiếm (mã, tên khách, nội dung bài, tên tệp...) hoặc lọc theo trạng thái. Mã chargeback CB-000nn là số tự tăng
(KHÔNG cố định) nên tìm theo khách + lý do + trạng thái."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
SEED2 = ("Seed Admin đợt 2 (backend/prisma/seed/admin-batch2.ts, chạy sau seed admin đợt 1; idempotent chỉ-tạo): 6 cộng đồng mới do người dùng seed đợt 1 làm chủ - "
         "growth-lab 'Growth Lab' (chủ sarah, $49), code-camp 'Code Camp' (alex, $29), fit-forever 'Fit Forever' (noah, $79), mindful-money 'Mindful Money' (liam, $19), "
         "pixel-pro 'Pixel Pro' (emma, $99), spam-hub 'Spam Hub' (lucas, miễn phí, discoveryStatus=unlisted, searchVisibility=hidden, mô tả 'Kiếm tiền nhanh.'); "
         "ai/mkt/fit/biz có trạng thái Khám phá riêng: biz = hidden + reduced ('Under quality review'), fit = unlisted ('Owner request'). Mật khẩu mọi tài khoản seed: Passw0rd!x.")
SEED_POST = ("Bài viết seed: POST-5C0A7BA8 (growth-lab, Sarah, 'Welcome to Growth Lab!...'), POST-2467DDA0 (growth-lab, Alex, 'Case study: how we doubled activation...'), "
             "POST-1415C1D0 (code-camp, Noah, 'Weekly challenge: build a rate limiter...'), POST-3B032FD4 (mindful-money, Liam, 'Budget template v2 is out...' + có ảnh), "
             "POST-D186CDF7 (spam-hub, Lucas, 'MAKE $10,000 A DAY!!!...', ĐÃ ẨN lý do Spam), POST-6976F0F3 (spam-hub, Lucas, 'Free crypto giveaway...', ĐÃ GỠ lý do Scam), "
             "POST-11AABCCE (growth-lab, Maya, 'Join my Telegram for referral bonuses!!!...', ĐÃ ẨN lý do Self-promotion), POST-1926A141 (mindful-money, Ethan, 'Guaranteed 20% monthly returns...', ĐÃ GỠ lý do Financial scam), "
             "đang có báo cáo mở: POST-D70BB72C (pixel-pro, Sophia, 'Stop buying this course...', 2 báo cáo harassment), POST-F687D03E (fit-forever, Olivia, 'Here is the leaked paid meal plan PDF...', 1 báo cáo copyright), "
             "POST-129F0682 (code-camp, Ava, 'Looking for a study partner...', 1 báo cáo spam).")
SEED_CMT = ("Bình luận seed: CMT-2B7C14C7 (Maya, 'DM me for a better growth hack...', ĐÃ GỠ Spam, dưới POST-2467DDA0), CMT-B213F111 (Ava, 'Check out my new site: cheap-pills.example...', ĐÃ GỠ Spam, dưới POST-B0D6AD49), "
            "CMT-88427752 (Sophia, 'You are a fraud and this community is a scam.', ĐÃ ẨN Harassment, pixel-pro), CMT-D923CB58 (Noah, 'This is false, the instructor replied...', 1 báo cáo harassment mở), "
            "CMT-A3B80A38 (Liam, 'Great write-up, did you A/B test...', bình thường, growth-lab), CMT-B610023F (Ava, 'Token bucket in 38 lines...', bình thường, code-camp).")
SEED_CRS = ("'Khóa học' của admin = ClassroomModule: Growth Foundations & Experimentation Playbook (growth-lab, published, mỗi khóa 4 bài), Node.js from Zero (code-camp, published), "
            "System Design Drafts (code-camp, DRAFT), 12-Week Strength Program (fit-forever, published), Budgeting 101 (old edition) (mindful-money, ARCHIVED), Typography Masterclass (pixel-pro, published), "
            "Get Rich Quick Secrets (spam-hub, ĐÃ GỠ 'Misleading claims'); mỗi cộng đồng còn có thêm 2 mô-đun mặc định 'Chào mừng & Lộ trình' / 'Tư duy & Nền tảng' (mỗi mô-đun 1 bài). Tổng seed sạch: 124 khóa (121 published, 1 draft, 1 archived, 1 removed).")
SEED_LSN = ("Bài học seed: ĐÃ ẨN LSN-408423DE ('Templates & checklists 3', video 14 phút, mô-đun 12-Week Strength Program, lý do 'Outdated content') và LSN-303F7046 ('Templates & checklists 3', video 30 phút, mô-đun Experimentation Playbook); "
            "ĐÃ GỠ LSN-DA91F381 ('Templates & checklists 4', mô-đun Node.js from Zero, 'Policy violation') và cả 4 bài của 'Get Rich Quick Secrets' (LSN-09BE0A86, LSN-188D10D6, LSN-6AF36F53, LSN-BE2E4E81). "
            "Tổng seed sạch: 473 bài (466 published, 2 hidden, 5 removed). Bài bình thường dùng được: LSN-39855DC0 (growth-lab, 'Case study walkthrough 4', video 12 phút, Experimentation Playbook), LSN-6CFA84D6 ('Setting up your workspace 2', text 23 phút).")
SEED_EVT = ("Sự kiện seed (giờ tính từ lúc nạp seed): 'Growth AMA with the founders' (growth-lab, host Sarah, +3 ngày, RSVP alex/daniel/liam/ava, có link họp), 'Live coding: build a CLI in Node' (code-camp, Alex, +7 ngày, capacity 30, RSVP noah/emma/ava), "
            "'Portfolio review night' (pixel-pro, Emma, +1,5 ngày, RSVP sophia/liam), 'Mobility workshop (live now)' (fit-forever, Noah, bắt đầu 30 phút trước lúc seed -> 'Đang diễn ra' CHỈ trong 2 giờ đầu, sau đó thành 'Hoàn tất'; RSVP sarah/olivia/daniel), "
            "'Quarterly budget reset' (mindful-money, Liam, 6 ngày trước, 5 RSVP, Hoàn tất), 'Retention teardown session' (growth-lab, Sarah, 15 ngày trước, Hoàn tất), "
            "'Hack night (cancelled: host unavailable)' (code-camp, Alex, +5 ngày, ĐÃ HỦY lý do 'Host unavailable', RSVP daniel/ethan), 'Secret wealth webinar' (spam-hub, Lucas, ĐÃ GỠ 'Misleading promotion', RSVP ava). Ngoài ra mỗi cộng đồng có 'Zoom Q&A cùng <chủ>' (host Tom Be, capacity 100, 12 RSVP) và 'Buổi thực hành nhóm nhỏ' (đã qua).")
SEED_MED = ("Media seed (12 tệp, CHỈ metadata - KHÔNG có tệp thật trong storage nên /api/files/<key> và nút Tải xuống đều 404): budget-preview.png (Liam, mindful-money, 1,2 MB), cover-growth-lab.webp (Sarah), lesson-01-welcome.mp4 (Alex, 248 MB), "
            "notion-template.pdf (Sarah, growth-lab, ĐÃ GẮN CỜ 'Possible copyrighted material'), workshop-recording.mp4 (Noah, 1,1 GB), checklist.docx (Emma), leaked-meal-plan.pdf (Olivia, fit-forever, ĐÃ GẮN CỜ 'Reported as leaked paid content'), "
            "avatar-sophia.jpg (Sophia, không có cộng đồng), banner-q4.jpg (Emma), signals-pack.zip (Lucas, spam-hub, ĐÃ GỠ 'Malware risk'), notes.txt (Daniel, 4 KB), typography-sheet.png (Emma, 3,3 MB). "
            "Tổng: 12 tệp, 1,4 GB, 2 gắn cờ, 1 đã gỡ; theo loại: 5 hình ảnh, 2 video, 5 tài liệu, 0 âm thanh.")
SEED_TX = ("Giao dịch seed (mã TXN-8 ký tự cố định): đang chờ TXN-70F1FA03 (Ava, growth-lab, $49, MoMo) và TXN-E2DB5581 (Lucas, mindful-money, $19, VNPay); THẤT BẠI lần đầu TXN-5ECCCEFC (Maya, code-camp, $29, Stripe, processing_error), "
           "TXN-6134AE3A (Sophia, pixel-pro, $99, MoMo, card_declined), TXN-EDCA0F1F (Ethan, fit-forever, $79, VNPay, expired_card); ĐÃ HOÀN TXN-BE8C2E88 (Olivia, pixel-pro, $99 hoàn đủ), TXN-E9A88057 (Daniel, fit-forever, $79, hoàn một phần $39,50), "
           "TXN-EFAAEA9E (Noah, growth-lab, $49 hoàn đủ); THÀNH CÔNG lẻ có yêu cầu hoàn tiền chờ: TXN-763C9F36 (Ava, pixel-pro, $99), TXN-F49368D6 (Emma, code-camp, $29), TXN-A6B4BFE4 (Sarah, fit-forever, $79), TXN-F699FA13 (Liam, pixel-pro, $99); "
           "THÀNH CÔNG lẻ KHÔNG dính hoàn tiền (dùng thử hoàn trực tiếp/chargeback): TXN-E8AF54EA (Ethan, pixel-pro, $99), TXN-84E9A3BA (Ava, code-camp, $29). Còn lại là giao dịch của các gói đăng ký (lần đầu + gia hạn). Tổng seed sạch: 112 giao dịch.")
SEED_SUB = ("Gói đăng ký seed theo cộng đồng (mã SUB-8 ký tự): growth-lab: Sophia dùng thử (SUB-41FC386C), Alex/Ava/Daniel/Emma/Lucas đang hoạt động (SUB-19663020, SUB-A9B9B1B1, SUB-5BC76879, SUB-C7FF8343, SUB-B2BD1B76), Olivia ĐÃ HỦY (SUB-38AA4938), "
            "Ethan HẾT HẠN (SUB-3DFC5C1A), Maya QUÁ HẠN (SUB-651D6D23, gia hạn thất bại insufficient_funds); TẠM DỪNG: Maya/code-camp (SUB-91A2D0F6), Ava/fit-forever (SUB-5C3EDFCA), Alex/mindful-money (SUB-772ABC69), Lucas/mindful-money (SUB-8FEA7CEB). "
            "Tổng seed sạch (gồm gói cũ paid-demo): hoạt động 30 (+5 dùng thử), quá hạn 6, tạm dừng 4, đã hủy 7, hết hạn 4; MRR $1.132,00; 'Hủy cuối kỳ' chỉ có ở gói cũ của member2 trong paid-demo.")
SEED_RF = ("Hoàn tiền seed: ĐANG CHỜ (5): RF-1542230F (Ava, pixel-pro, $99, 'Cancelled but charged'), RF-6FF01B95 (Emma, code-camp, $29, 'Technical issue'), RF-71FACC96 (Sarah, fit-forever, $79, 'Changed mind'), RF-AEB9A758 (Liam, pixel-pro, $99, 'Duplicate account'), "
           "và 1 yêu cầu cũ của Tran Trong (paid-demo, $19, ngoài cửa sổ 7 ngày); HOÀN TẤT (4): RF-31968828 (Olivia $99), RF-E3DF8C52 (Daniel, yêu cầu $39,50 trên giao dịch $79 - một phần), RF-F7E223A6 (Noah $49, auto), 1 yêu cầu cũ (Michial Kekv, auto); "
           "ĐÃ TỪ CHỐI (2): RF-65A6E89A (Maya $49, 'Outside refund window; content was accessed'), RF-33F561D9 (Sophia $19, 'Usage exceeds policy limits'). KPI seed sạch: chờ 5 ($325,00), hoàn tất 4 ($206,50), từ chối 2.")
SEED_CB = ("Tranh chấp seed (MÔ PHỎNG; mã CB-000nn là số tự tăng, tìm theo khách+lý do): ĐANG MỞ: Alex 'Gian lận' $49 (còn ~4 ngày), Daniel 'Trùng lặp' $49 (còn ~2 ngày), Daniel 'Đã hủy gói' $49 (còn ~5 ngày); "
           "ĐANG XEM XÉT: Alex 'Chưa nhận sản phẩm' $49 (đã nộp bằng chứng, còn ~3 ngày); THẮNG: Maya 'Không nhận ra giao dịch', Olivia 'Sản phẩm không như mô tả'; THUA: Noah 'Gian lận' (trên TXN-EFAAEA9E đã hoàn). Tất cả thuộc growth-lab, $49. KPI seed sạch: mở 3, thắng 2, thua 1, số tiền tranh chấp $196,00 (3 mở + 1 đang xem xét).")
SEED_PO = ("Chi trả seed: ĐANG CHỜ: PO-60986918 (Sarah, growth-lab, $180, Chase ••1203), PO-12AA363D (Alex, code-camp, $120, Vietcombank ••8812) + 1 payout cũ của Olivia Owner (paid-demo, $50); ĐANG XỬ LÝ: PO-4F3DDE23 (Emma, pixel-pro, $250), PO-102DFB01 (Noah, fit-forever, $99); "
           "THẤT BẠI: PO-55B8FDCB (Emma, $75, 'Bank account closed'); TẠM GIỮ: PO-50974388 (Noah, $52, giữ từ 'requested', ghi chú 'Held pending identity re-verification'); ĐÃ CHI: PO-2CFB97FB (Liam $61), PO-E76F07C4 (Sarah $210), PO-4AC539AB (Alex $88) + 1 cũ của Olivia $50; "
           "TỪ CHỐI: PO-91AEB74D (Liam, $50, 'Account holder name mismatch'). KPI seed sạch: chờ $350,00, xử lý $349,00, đã chi $409,00, tạm giữ $52,00, thất bại $75,00; số lượng 3/2/4/1/1/1.")
SEED_CRV = ("Doanh thu creator seed (toàn thời gian, 7 creator): Emma Garcia (2 cộng đồng) gộp $1.584,00 · hoàn $99,00 · phí nền tảng $148,50 · phí cổng $50,72 · thuần $1.285,78 · số dư chờ $960,78; Noah Williams gộp $1.027,00 · hoàn $39,50 · phí $98,75 · thuần $855,08 · chờ $704,08; "
            "Sarah Kim (growth-lab) gộp $784,00 · hoàn $49,00 · phí $73,50 · thuần $633,98 · chờ $243,98 · đã chi $210,00; Olivia Owner (5 cộng đồng) gộp $551,00; Alex Rivera gộp $406,00 · thuần $349,44 · đã chi $88,00; Liam Nguyen gộp $228,00 · thuần $195,00 · đã chi $61,00; Ethan Brooks gộp $9,00. "
            "Tổng: gộp $4.589,00, hoàn $206,50, phí nền tảng $438,25, phí cổng $163,28, thuần $3.780,97, chờ $2.545,97. Số trên là TOÀN THỜI GIAN (gọi API không tham số from). Chip 90 ngày gần bằng nhưng bỏ 2 giao dịch cũ >90 ngày (seed ngày 01/10: 110 giao dịch, gộp $4.551,00); chip 30 ngày cho số nhỏ hơn rất nhiều - đối chiếu bằng API với cùng from.")
SEED_DISC = ("Khám phá seed (35 cộng đồng chưa xóa): listed 23, featured 3 (photo, yt, growth-lab), hidden 4 (biz = ẩn thật; fin, lead, private-demo = riêng tư), unlisted 5 (crypto-signals-pro bị đình chỉ, design-circle chờ duyệt, quick-rich-club bị từ chối, fit 'Owner request', spam-hub 'Low quality / spam signals'). "
             "Danh mục: 8 khóa active (business 5, content 4, tech 6, finance 2, health 2, self 2, hobby 4, relationships 1 cộng đồng); marketing/design chưa có (phải 'Thêm'). "
             "Nổi bật: featured = photo, yt, growth-lab (còn hạn); trending = ai, code-camp (không hạn); editors_picks = pixel-pro, mindful-money; new_noteworthy = fit-forever (HẾT HẠN 3 ngày trước, hiển thị 'Ngoài thời hạn') + des. "
             "Xếp hạng đã publish: 25/25/20/15/10/5 (mặc định), xem trước 26 cộng đồng (listed+public+active), top lúc seed: ai, yoga, py. Hiển thị tìm kiếm: searchable 33, reduced 1 (biz), hidden 1 (spam-hub); điểm chất lượng thấp nhất spam-hub 35, cao nhất ~84.")
SEED_AUD = ("Nhật ký audit seed đợt 2 (13 dòng, id seed-admin2-audit-*): post.hide (MAKE $10,000...), post.remove (Free crypto giveaway), course.remove (Get Rich Quick Secrets), media.remove (signals-pack.zip), event.remove (Secret wealth webinar), "
            "event.cancel (Hack night), refund.approve, payout.hold (Noah), payout.mark_failed (Emma), discovery.status (Spam Hub unlisted), discovery.search_visibility (Spam Hub hidden), discovery.feature (Growth Lab), chargeback.create.")
LOGIN = "Đăng nhập admin@sofinhub.test / Passw0rd!x (Platform Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
TOKEN = "Lấy accessToken bằng POST /api/auth/login {\"email\":\"admin@sofinhub.test\",\"password\":\"Passw0rd!x\"}, gửi header Authorization: Bearer <token>."
MUTATE = "Case làm thay đổi dữ liệu seed (MUTATE) - khôi phục bằng npm run db:reset (db:seed là idempotent chỉ-tạo nên KHÔNG hoàn tác thao tác admin đã làm); hoặc chạy trên bản ghi khác chưa bị đụng tới."
BASE2 = "DB sạch sau npm run db:reset (có seed/admin-batch2.ts; mã POST-/CMT-/TXN-/SUB-/RF-/PO- cố định, xem sheet 'Tài khoản & dữ liệu test' mục A3)."
BASE_UI = BASE2 + " " + LOGIN + " Frontend :5173, backend :4000."
BASE_API = BASE2 + " " + TOKEN
PENDING_DECISION = "[PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]"


def load(add):
    M, MN = "ADM2", "Admin Console (đợt 2: Nội dung, Thanh toán, Khám phá)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    UI = BASE_UI
    API = BASE_API
    UIM = BASE_UI + " " + MUTATE
    APIM = BASE_API + " " + MUTATE

    # ============================================================ 1. QUYỀN TRUY CẬP & KHUNG ĐIỀU HƯỚNG
    F = "Phân quyền & điều hướng đợt 2"
    A(F, "Sidebar có 3 nhóm đợt 2 với đủ mục và không còn nhãn 'Sắp có'", "Giao diện", "Cao", UI,
      ["Mở /admin", "Mở nhóm 'Nội dung', 'Thanh toán', 'Khám phá' trên sidebar"], "-",
      "Nội dung: Bài viết, Bình luận, Khóa học, Bài học, Sự kiện, Media. Thanh toán: Giao dịch, Gói đăng ký, Hoàn tiền, Tranh chấp thanh toán, Doanh thu creator, Chi trả. "
      "Khám phá: Cộng đồng hiển thị, Danh mục, Nổi bật, Xếp hạng, Hiển thị tìm kiếm. Mọi mục bấm được, không hiện nhãn 'Sắp có'.")
    routes = [("/admin/content/posts", "Bài viết"), ("/admin/content/comments", "Bình luận"), ("/admin/content/courses", "Khóa học"), ("/admin/content/lessons", "Bài học"),
              ("/admin/content/events", "Sự kiện"), ("/admin/content/media", "Media"), ("/admin/payments/tx", "Giao dịch"), ("/admin/payments/subs", "Gói đăng ký"),
              ("/admin/payments/refunds", "Hoàn tiền"), ("/admin/payments/chargebacks", "Tranh chấp thanh toán"), ("/admin/payments/creator", "Doanh thu creator"),
              ("/admin/payments/payouts", "Chi trả"), ("/admin/discovery/listed", "Cộng đồng hiển thị"), ("/admin/discovery/categories", "Danh mục"),
              ("/admin/discovery/featured", "Nổi bật"), ("/admin/discovery/rankings", "Xếp hạng"), ("/admin/discovery/seo", "Hiển thị tìm kiếm")]
    for path, title in routes:
        A(F, f"Mở trực tiếp {path} hiển thị trang '{title}' (tải lazy, không lỗi)", "Chức năng", "Cao", UI,
          [f"Gõ thẳng http://localhost:5173{path} vào thanh địa chỉ", "Chờ trang tải (route admin tải lazy)"], path,
          f"Hiện khung admin với tiêu đề trang '{title}', mục sidebar tương ứng được tô sáng, breadcrumb đúng; không có màn trắng hay lỗi console.")
    A(F, "Guest mở /admin/payments/tx bị chuyển về /login", "Bảo mật", "Cao", "Chưa đăng nhập (xóa localStorage/cookie).",
      ["Mở http://localhost:5173/admin/payments/tx"], "-", "Chuyển tới /login (hoặc hiện yêu cầu đăng nhập); không thấy dữ liệu giao dịch.")
    for who, why in (("member1", "member thường"), ("owner", "chủ cộng đồng (Olivia Owner)"), ("cadmin", "admin cộng đồng photo"), ("mod", "mod cộng đồng photo")):
        A(F, f"{who}@sofinhub.test ({why}) vào /admin/content/posts bị chặn ở guard", "Bảo mật", "Cao", BASE2 + f" Đăng nhập {who}@sofinhub.test / {PW}.",
          ["Mở http://localhost:5173/admin/content/posts", "Thử tiếp /admin/payments/payouts và /admin/discovery/rankings"], f"{who}@sofinhub.test",
          "Guard Platform Admin (GET /admin/me -> 403) chặn: không thấy bảng dữ liệu/khung admin của 3 trang; không có yêu cầu API nào của /admin/content|payments|discovery trả dữ liệu. 'Admin cộng đồng'/'chủ cộng đồng' KHÁC Platform Admin.")
    A(F, "Cờ Platform Admin: mọi route đợt 2 trả 401 khi thiếu token và 403 với người dùng thường (46 route)", "Bảo mật", "Cao", BASE2 + " Đăng nhập member1@sofinhub.test lấy token.",
      ["Với từng route trong danh sách gọi KHÔNG token rồi gọi với token member1: GET /admin/content/posts/summary, /content/posts, /content/posts/x, POST /content/posts/x/hide, POST /content/posts/bulk, "
       "GET /content/comments, POST /content/comments/x/remove, GET /content/courses, POST /content/courses/x/publish, GET /content/lessons, POST /content/lessons/x/hide, GET /content/events, PATCH /content/events/x, POST /content/events/x/cancel, "
       "GET /content/media, GET /content/media/x/download, POST /content/media/x/remove, GET /payments/transactions(/summary), POST /payments/transactions/x/refund|retry, GET /payments/subscriptions, POST /payments/subscriptions/x/pause, "
       "GET /payments/refunds, POST /payments/refunds/x/approve, GET /payments/chargebacks, POST /payments/chargebacks, POST /payments/chargebacks/x/accept, GET /payments/creators, GET /payments/creators/x, GET /payments/payouts, POST /payments/payouts/x/hold, "
       "GET /discovery/communities, POST /discovery/communities/x/status, GET /discovery/categories, POST /discovery/categories, GET /discovery/featured, POST /discovery/featured, GET /discovery/rankings, PUT /discovery/rankings, GET /discovery/search-visibility, POST /discovery/communities/x/search-visibility"],
      "member1 + không token", "Mọi route: không token -> 401 UNAUTHORIZED; token member1 -> 403 FORBIDDEN (kiểm tra quyền chạy TRƯỚC khi validate body/tìm bản ghi nên id 'x' cũng 403, không 404/400).")
    A(F, "owner/cadmin/mod (không phải Platform Admin) gọi GET /admin/payments/payouts và /admin/discovery/rankings bị 403", "Bảo mật", "Cao", BASE2 + f" Đăng nhập owner@/cadmin@/mod@sofinhub.test / {PW}.",
      ["Lấy token của từng tài khoản", "GET /api/admin/payments/payouts, GET /api/admin/payments/creators, GET /api/admin/discovery/rankings, GET /api/admin/content/media"], "owner, cadmin, mod",
      "Cả 3 tài khoản nhận 403 FORBIDDEN ở mọi route; chủ cộng đồng chỉ xem được doanh thu/rút tiền của CHÍNH cộng đồng mình qua API công khai /courses/:id/revenue, không qua /admin.")
    A(F, "Breadcrumb và tiêu đề của 3 trang chi tiết (giao dịch, hoàn tiền, creator) dẫn về trang danh sách", "Giao diện", "Thấp", UI,
      ["Mở /admin/payments/tx rồi bấm 'Xem' ở một dòng", "Bấm 'Giao dịch' trong breadcrumb", "Lặp lại với /admin/payments/refunds/<id> (breadcrumb 'Hoàn tiền') và /admin/payments/creator/<userId> (breadcrumb 'Doanh thu creator')"], "-",
      "Breadcrumb 'Giao dịch > TXN-xxxxxxxx', 'Hoàn tiền > RF-xxxxxxxx', 'Doanh thu creator > <tên>' và bấm nhãn đầu quay về danh sách tương ứng.")
    A(F, "Đổi trang/tab/lọc trong bảng KHÔNG lưu vào URL (trạng thái chỉ nằm trong bộ nhớ trang)", "Chức năng", "Thấp", UI,
      ["Mở /admin/content/posts, chọn tab 'Đã ẩn', gõ tìm kiếm, F5"], "-",
      "Sau F5 trang trở lại tab 'Tất cả', ô tìm kiếm rỗng (khác trang Người dùng đợt 1 có ?tab=). Riêng ?courseId=<id cộng đồng> trên URL VẪN được đọc cho Bài viết/Bình luận/Khóa học/Bài học/Sự kiện/Media.", pw="Một phần")
    A(F, "?courseId=growth-lab trên URL lọc Bài viết theo cộng đồng", "Chức năng", "Trung bình", UI,
      ["Mở http://localhost:5173/admin/content/posts?courseId=growth-lab"], "courseId=growth-lab",
      "Chỉ hiện bài của Growth Lab (POST-5C0A7BA8, POST-2467DDA0, POST-11AABCCE + bài demo của cộng đồng này); KPI phía trên vẫn là số toàn nền tảng (summary không lọc).")
    A(F, "Token admin hết hạn khi đang xem Giao dịch: tự refresh hoặc chuyển về đăng nhập", "Bảo mật", "Trung bình", UI,
      ["Ở /admin/payments/tx xóa access token trong storage (hoặc chờ 15 phút)", "Bấm sang trang 2 của bảng"], "-",
      "Hệ thống refresh tự động và tải tiếp; nếu refresh thất bại thì chuyển /login, không để màn trắng.", pw="Một phần")

    # ============================================================ 2. NỘI DUNG - BÀI VIẾT
    F = "Nội dung · Bài viết (UI)"
    A(F, "Trang Bài viết: tiêu đề, 4 KPI (Tổng/Hôm nay/Bị báo cáo/Đã gỡ) khớp DB", "Giao diện", "Cao", UI + " " + SEED_POST,
      ["Mở /admin/content/posts", "Đọc 4 thẻ KPI", "Đối chiếu: SELECT COUNT(*) FROM \"Post\" (Tổng); createdAt >= 0h UTC hôm nay (Hôm nay); số targetId khác nhau trong Report type=post status open/under_review (Bị báo cáo); removedAt IS NOT NULL (Đã gỡ)"], "-",
      "Tiêu đề 'Bài viết', phụ đề 'Quản lý nội dung trên toàn bộ cộng đồng.'. Thẻ: 'Tổng' (seed sạch ≈163), 'Hôm nay', 'Bị báo cáo' (≈7, màu đỏ), 'Đã gỡ' (≈2) đúng bằng truy vấn DB. Bấm 'Bị báo cáo' chuyển /admin/moderation.")
    A(F, "Bảng Bài viết: cột và định dạng dữ liệu một dòng", "Giao diện", "Trung bình", UI + " " + SEED_POST,
      ["Ô tìm kiếm gõ 'POST-D186CDF7'", "Đọc dòng kết quả"], "POST-D186CDF7",
      "Đúng 1 dòng: cột 'Bài viết' = excerpt 'MAKE $10,000 A DAY!!!...' (<=80 ký tự, kết thúc …) + mã POST-D186CDF7; Tác giả 'Lucas Silva'; Cộng đồng 'Spam Hub'; Tương tác 2 (like+bình luận); Báo cáo 0 (chữ xám); Trạng thái 'Đã ẩn'; 'Tạo lúc' dạng tương đối (vd '1 ngày trước').")
    A(F, "Tab trạng thái và số đếm: Tất cả / Đã xuất bản / Đang xem xét / Đã ẩn / Đã gỡ", "Chức năng", "Cao", UI + " " + SEED_POST,
      ["Mở /admin/content/posts, ghi số đếm trên 5 tab", "Lần lượt bấm từng tab, đếm tổng ở góc bảng"], "-",
      "Đếm tab: Tất cả = Tổng; Đã xuất bản = Tổng − Đã ẩn − Đã gỡ; Đang xem xét = số bài đang có báo cáo mở (≈7); Đã ẩn ≈3; Đã gỡ ≈2. Bảng mỗi tab chỉ chứa đúng trạng thái đó; tab 'Đang xem xét' hiện cả bài published có báo cáo (badge 'Đang xem xét').")
    A(F, "Tab 'Đang xem xét' liệt kê đúng bài có báo cáo mở và cột Báo cáo > 0", "Chức năng", "Cao", UI + " " + SEED_POST,
      ["Bấm tab 'Đang xem xét'", "Tìm POST-D70BB72C, POST-F687D03E, POST-129F0682"], "-",
      "3 bài này có mặt: POST-D70BB72C cột Báo cáo = 2 (số đỏ), hai bài kia = 1; badge 'Đang xem xét' (cam). Sắp xếp 'Nhiều báo cáo nhất' đặt POST-D70BB72C lên trước.")
    A(F, "Tìm kiếm Bài viết theo nội dung, tên tác giả và mã POST-xxxxxxxx", "Chức năng", "Cao", UI + " " + SEED_POST,
      ["Gõ 'MAKE $10,000' vào ô 'Tìm bài viết, tác giả, mã bài viết...'", "Xóa, gõ 'Lucas'", "Xóa, gõ 'POST-D70BB72C'", "Xóa, gõ 'd70b' (4 ký tự đầu mã)"], "MAKE $10,000 | Lucas | POST-D70BB72C | d70b",
      "Lần 1: chỉ POST-D186CDF7. Lần 2: các bài của Lucas Silva (POST-D186CDF7, POST-6976F0F3 + bài khác nếu có). Lần 3 và 4: đúng POST-D70BB72C. Tìm không phân biệt hoa thường; bảng về trang 1 mỗi lần đổi từ khóa; có debounce.")
    A(F, "Tìm kiếm không có kết quả hiện trạng thái rỗng và nút 'Xóa bộ lọc'", "Giao diện", "Trung bình", UI,
      ["Gõ 'zzzkhongcoketqua123' vào ô tìm kiếm"], "zzzkhongcoketqua123", "Bảng hiện 'Không có kết quả phù hợp.' không có dòng nào; KPI/tab đếm không đổi; bấm 'Xóa bộ lọc' (khi đã chọn bộ lọc Sắp xếp) khôi phục danh sách.")
    A(F, "Sắp xếp Bài viết: mặc định mới nhất, Cũ nhất, Tương tác cao nhất, Nhiều báo cáo nhất", "Chức năng", "Trung bình", UI + " " + SEED_POST,
      ["Mở trang (mặc định)", "Bộ lọc 'Sắp xếp' chọn 'Cũ nhất'", "Chọn 'Tương tác cao nhất'", "Chọn 'Nhiều báo cáo nhất'", "Bấm 'Xóa bộ lọc'"], "-",
      "Mặc định giảm dần 'Tạo lúc'; 'Cũ nhất' tăng dần; 'Tương tác cao nhất' sắp theo lượt thích giảm dần rồi số bình luận (KHÔNG theo tổng cột Tương tác): POST-2467DDA0 (31 like) đứng trước POST-5C0A7BA8 (24) và POST-3B032FD4 (22); 'Nhiều báo cáo nhất' POST-D70BB72C (2) đứng đầu; 'Xóa bộ lọc' về mặc định, trang 1.")
    A(F, "Phân trang Bài viết: 20 dòng/trang, nút Trang trước/Trang sau và tổng số", "Chức năng", "Trung bình", UI,
      ["Mở /admin/content/posts (tổng > 20)", "Bấm 'Trang sau' tới trang 2", "Bấm 'Trang trước'"], "-",
      "Trang 1 có 20 dòng, 'Trang trước' bị vô hiệu; sang trang 2 dòng khác trang 1, hiển thị đúng 'trang/tổng trang' và tổng bản ghi theo meta; ở trang cuối 'Trang sau' bị vô hiệu. Giữ dữ liệu cũ mờ trong lúc tải trang mới.")
    A(F, "Trạng thái tải và lỗi của bảng Bài viết (loading, API lỗi, Thử lại)", "Giao diện", "Trung bình", UI,
      ["Mở DevTools > Network, chặn (block) /api/admin/content/posts", "F5 trang Bài viết", "Bỏ chặn, bấm 'Thử lại'"], "-",
      "Khi đang tải hiện 'Đang tải…'; khi API lỗi hiện khối lỗi (role=alert) với thông điệp lỗi + nút 'Thử lại'; bấm Thử lại sau khi bỏ chặn tải lại dữ liệu bình thường.", pw="Một phần")
    A(F, "Menu thao tác theo trạng thái của dòng (Xem trước / Ẩn / Gỡ / Khôi phục / Xem tác giả)", "Chức năng", "Cao", UI + " " + SEED_POST,
      ["Bấm biểu tượng 'Thêm thao tác' ở POST-2467DDA0 (published)", "Lặp lại ở POST-D186CDF7 (hidden)", "Lặp lại ở POST-6976F0F3 (removed)"], "-",
      "published: Xem trước, Ẩn, Gỡ, Xem tác giả (không có Khôi phục). hidden: Xem trước, Gỡ, Khôi phục, Xem tác giả (không có Ẩn). removed: Xem trước, Khôi phục, Xem tác giả (không có Ẩn/Gỡ).")
    A(F, "Xem trước bài viết (modal) hiển thị nội dung, bình luận gần đây, báo cáo, lịch sử", "Chức năng", "Cao", UI + " " + SEED_POST + " " + SEED_AUD,
      ["Bấm dòng POST-D186CDF7 (hoặc menu > Xem trước)", "Đọc modal 'Xem trước bài viết'"], "POST-D186CDF7",
      "Tiêu đề phụ = POST-D186CDF7. Thông tin: Tác giả Lucas Silva, Cộng đồng Spam Hub, Trạng thái 'Đã ẩn', Báo cáo 0, Đăng lúc <ngày giờ>, 'Lý do kiểm duyệt' = Spam. Mục 'Nội dung' có toàn văn; 'Bình luận gần đây' (nếu có); 'Báo cáo' hiện 'Không có báo cáo.'; "
      "'Lịch sử quản trị' có dòng post.hide (lý do Spam) do Platform Admin. Nút 'Xem tác giả' chuyển /admin/users/<id>.")
    A(F, "Xem trước bài có báo cáo hiển thị danh sách CASE và người báo cáo", "Chức năng", "Trung bình", UI + " " + SEED_POST,
      ["Mở Xem trước POST-D70BB72C"], "POST-D70BB72C", "Mục 'Báo cáo' liệt kê 2 dòng dạng 'CASE-xxxxx · harassment · Emma Garcia/Noah Williams · <thời gian>'; KPI 'Báo cáo' trong modal = 2; bình luận gần đây gồm CMT của Noah và Emma.")
    A(F, "Modal Ẩn bài viết: nút xác nhận bị khóa tới khi chọn lý do, có ghi chú và tùy chọn thông báo tác giả", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Menu dòng POST-2467DDA0 > 'Ẩn'", "Quan sát nút 'Ẩn' khi chưa chọn lý do", "Chọn chip lý do 'Spam'", "Quan sát ô 'Ghi chú nội bộ' và checkbox 'Thông báo cho tác giả'"], "POST-2467DDA0",
      "Tiêu đề 'Ẩn bài viết?'; mô tả '<mã>. Nội dung sẽ không còn hiển thị với thành viên thường.'; nút 'Ẩn' bị vô hiệu cho tới khi chọn 1 trong 7 lý do (Spam, Quấy rối, Ngôn từ thù ghét, Lừa đảo, Bản quyền, Nội dung nhạy cảm, Khác); checkbox mặc định BẬT.")
    A(F, "Ẩn bài viết thành công: toast, badge, KPI/tab đổi, ghi audit và thông báo tác giả", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Ẩn POST-2467DDA0 với lý do 'Spam', ghi chú 'Kiểm thử QA', giữ checkbox thông báo", "Quan sát toast, dòng và các số đếm", "Mở /admin/system/audit tìm 'post.hide'", "Đăng nhập alex@sofinhub.test mở thông báo"], "POST-2467DDA0 / Spam",
      "Toast 'Đã ẩn bài viết'; dòng chuyển 'Đã ẩn'; tab 'Đã ẩn' +1, 'Đã xuất bản' −1; 'Lịch sử quản trị' có post.hide; audit-logs có action=post.hide, targetType=post, reason=Spam, ghi chú; Alex nhận thông báo 'Bài viết của bạn đã bị ẩn' có trích 60 ký tự đầu + 'Lý do: Spam'.")
    A(F, "Ẩn bài viết với bỏ chọn 'Thông báo cho tác giả' thì tác giả KHÔNG nhận thông báo", "Chức năng", "Trung bình", UIM + " " + SEED_POST,
      ["Ẩn POST-1415C1D0 (Noah, code-camp) với lý do 'Quấy rối', bỏ tích 'Thông báo cho tác giả'", "Đăng nhập noah@sofinhub.test xem thông báo"], "POST-1415C1D0",
      "Bài chuyển 'Đã ẩn', có audit post.hide; Noah KHÔNG có thông báo 'Bài viết của bạn đã bị ẩn' mới (notifyAuthor=false).")
    A(F, "Gỡ bài viết (modal danger): tiêu đề, nút 'Gỡ nội dung', toast và trạng thái 'Đã gỡ'", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Menu dòng POST-129F0682 > 'Gỡ'", "Chọn lý do 'Lừa đảo', ghi chú 'QA', bấm 'Gỡ nội dung'"], "POST-129F0682",
      "Tiêu đề 'Gỡ bài viết', mô tả 'Nội dung bị gỡ khỏi API công khai; chỉ quản trị viên còn thấy.'; toast 'Đã gỡ bài viết'; dòng 'Đã gỡ'; KPI 'Đã gỡ' +1; báo cáo mở của bài vẫn còn trong hàng đợi kiểm duyệt (không tự đóng).")
    A(F, "Khôi phục bài viết đã gỡ/đã ẩn: modal, toast, trạng thái về 'Đã xuất bản'", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Menu dòng POST-6976F0F3 (removed) > 'Khôi phục'", "Điền ghi chú (tùy chọn) và bấm 'Khôi phục'", "Làm tương tự với POST-D186CDF7 (hidden)"], "POST-6976F0F3, POST-D186CDF7",
      "Modal 'Khôi phục bài viết?'; toast 'Đã khôi phục bài viết'; hai dòng thành 'Đã xuất bản', lý do kiểm duyệt bị xóa; audit post.restore (metadata.from = removed/hidden); không gửi thông báo cho tác giả khi khôi phục.")
    A(F, "Lỗi từ API hiện ngay trong modal thao tác (không đóng modal)", "Chức năng", "Trung bình", UIM + " " + SEED_POST,
      ["Mở trang Bài viết ở 2 tab trình duyệt", "Tab 1: Ẩn POST-1415C1D0 thành công", "Tab 2 (chưa tải lại): menu dòng đó > 'Ẩn' > chọn lý do > bấm 'Ẩn'"], "POST-1415C1D0",
      "Tab 2 nhận 409 và hiện thông điệp 'bài viết đang bị ẩn hoặc đã bị gỡ' ngay trong modal (nút quay về trạng thái bấm được), không hiện toast thành công, dữ liệu không đổi.", pw="Một phần")
    A(F, "Chọn nhiều dòng: hiện thanh thao tác hàng loạt (Đã chọn N, Ẩn, Gỡ, Khôi phục, Bỏ chọn)", "Giao diện", "Trung bình", UI,
      ["Tích checkbox 'Chọn dòng' của 3 dòng", "Tích 'Chọn tất cả'", "Bấm 'Bỏ chọn'"], "-",
      "Thanh hiện 'Đã chọn 3' rồi 'Đã chọn <20>' (chọn tất cả chỉ chọn các dòng của TRANG hiện tại); 'Bỏ chọn' về 0 và ẩn thanh; đổi tab thì vùng chọn bị xóa.")
    A(F, "Ẩn hàng loạt 3 bài từ giao diện", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Tích POST-2467DDA0, POST-1415C1D0, POST-B0D6AD49", "Thanh bulk > 'Ẩn'", "Dialog 'Ẩn 3 bài viết?': chọn lý do 'Spam' và xác nhận"], "3 bài published",
      "Toast 'Đã xử lý 3 bài viết'; cả 3 dòng 'Đã ẩn'; vùng chọn xóa; mỗi bài có 1 dòng audit post.hide; tác giả mỗi bài được thông báo.")
    A(F, "Gỡ/khôi phục hàng loạt: bài không hợp lệ bị bỏ qua và báo 'Bỏ qua N bài'", "Chức năng", "Cao", UIM + " " + SEED_POST,
      ["Tích POST-D186CDF7 (đã ẩn) và POST-5C0A7BA8 (published)", "Thanh bulk > 'Ẩn' (chọn lý do)", "Quan sát toast"], "POST-D186CDF7 + POST-5C0A7BA8",
      "POST-5C0A7BA8 chuyển 'Đã ẩn'; POST-D186CDF7 bị bỏ qua vì đã ẩn -> toast lỗi 'Bỏ qua 1 bài: bài viết đang bị ẩn hoặc đã bị gỡ'; toast tổng 'Đã xử lý 2 bài viết' vẫn hiện (UI không trừ số bỏ qua).")
    A(F, "Hàng loạt 'Khôi phục' không đòi lý do; 'Ẩn'/'Gỡ' đòi lý do", "Chức năng", "Trung bình", UIM + " " + SEED_POST,
      ["Tích 2 bài đang ẩn/gỡ", "Bulk > 'Khôi phục': xem dialog", "Bulk > 'Gỡ': xem dialog"], "-",
      "Dialog 'Khôi phục 2 bài viết?' không có chip lý do và nút bấm được ngay; dialog 'Gỡ 2 bài viết?' có chip lý do và nút khóa tới khi chọn.")

    F = "Nội dung · Bài viết (API)"
    A(F, "GET /admin/content/posts/summary trả total/today/reported/removed/hidden", "Chức năng", "Cao", API,
      ["GET /api/admin/content/posts/summary", "Đối chiếu bằng SQL: COUNT Post; createdAt >= đầu ngày UTC; DISTINCT targetId của Report(post, open|under_review); removedAt not null; hidden=true AND removedAt null"], "-",
      "200 {data:{total,today,reported,removed,hidden}} đều là số nguyên >= 0 và khớp SQL (seed sạch: reported≈7, removed 2, hidden≈3).")
    A(F, "GET /admin/content/posts lọc status/courseId/q, trả meta phân trang, 400 giá trị lạ", "Chức năng", "Cao", API + " " + SEED_POST,
      ["GET /content/posts?courseId=spam-hub&status=hidden", "GET /content/posts?courseId=spam-hub&status=hidden,removed", "GET /content/posts?status=under_review", "GET /content/posts?q=POST-D186CDF7", "GET /content/posts?limit=2&page=2&courseId=growth-lab",
       "GET /content/posts?status=bogus", "GET /content/posts?sort=bogus", "GET /content/posts?limit=101", "GET /content/posts?page=0"], "spam-hub, growth-lab",
      "Lần 1: [POST-D186CDF7]. Lần 2: 2 bài (hidden+removed). Lần 3: bài published có báo cáo mở (underReview=true, reports>0). Lần 4: đúng POST-D186CDF7. Lần 5: data<=2, meta {page:2,limit:2,total,totalPages}. Lần 6-9: 400 VALIDATION_ERROR.")
    A(F, "GET /admin/content/posts/:id trả chi tiết có thread, reportList, history", "Chức năng", "Cao", API + " " + SEED_POST,
      ["Lấy id của POST-D70BB72C từ danh sách (field id)", "GET /api/admin/content/posts/<id>"], "POST-D70BB72C",
      "200; có content (toàn văn), tags, thread (<=20 bình luận gồm CMT của Noah, Emma), reportList 2 phần tử với caseCode dạng CASE-\\d{5}, reason=harassment, reporter, history <=10; code=POST-D70BB72C, reports=2, underReview=true.")
    A(F, "GET /admin/content/posts/:id không tồn tại trả 404", "Chức năng", "Trung bình", API, ["GET /api/admin/content/posts/khong-ton-tai"], "khong-ton-tai", "404 NOT_FOUND, message 'Không tìm thấy bài viết'.")
    A(F, "POST hide: thiếu lý do 400; ẩn thành công 200 status=hidden; ẩn lần 2 trả 409", "Chức năng", "Cao", APIM + " " + SEED_POST,
      ["POST /content/posts/<id POST-2467DDA0>/hide {} ", "POST .../hide {\"reason\":\"Spam\"}", "Lặp lại lần 2 với {\"reason\":\"x\"}", "POST /content/posts/nope/hide {\"reason\":\"x\"}"], "POST-2467DDA0",
      "Lần 1: 400 (thiếu lý do). Lần 2: 200 data.status='hidden', moderationReason='Spam', moderatedBy = Platform Admin. Lần 3: 409 CONFLICT 'bài viết đang bị ẩn hoặc đã bị gỡ'. Lần 4: 404.")
    A(F, "POST remove/restore: chuyển trạng thái đúng bảng, sai trạng thái trả 409", "Chức năng", "Cao", APIM + " " + SEED_POST,
      ["remove POST-1415C1D0 {\"reason\":\"Scam\",\"notifyAuthor\":false}", "remove lần 2", "restore", "restore lần 2", "hide POST-D186CDF7 (đang hidden)", "remove POST-D186CDF7 (hidden -> removed)"], "POST-1415C1D0, POST-D186CDF7",
      "remove published->removed 200; remove lại 409 'bài viết đã bị gỡ'; restore removed->published 200; restore lại 409 'bài viết đang hiển thị bình thường'; hide trên bài đã ẩn 409; remove bài đã ẩn 200 (hidden|published -> removed).")
    A(F, "Hide/remove/restore ghi audit đúng action và đủ trường (targetType=post, reason, metadata.from)", "Chức năng", "Cao", APIM + " " + SEED_POST,
      ["Thực hiện hide -> remove -> restore trên POST-B0D6AD49", "GET /api/admin/audit-logs?targetId=<id>&limit=100"], "POST-B0D6AD49",
      "3 dòng: post.hide, post.remove, post.restore; actor = Platform Admin; targetType=post; targetLabel = excerpt 80 ký tự; reason khớp; metadata.community='fit-forever' và metadata.from lần lượt published/hidden/removed.")
    A(F, "POST /content/posts/bulk: 200 {updated, skipped[]} và lỗi validate", "Chức năng", "Cao", APIM + " " + SEED_POST,
      ["bulk {action:'hide',ids:[<2 bài published>,<1 bài đã hidden>,'missing']} thiếu reason", "Lặp lại với reason:'Spam'", "bulk {action:'restore',ids:[...]} không reason", "bulk ids rỗng", "bulk ids 101 phần tử", "bulk action:'pin'"], "-",
      "Thiếu reason với hide/remove -> 400. Có reason: 200 data.updated=2, skipped=[{id:<đã ẩn>,reason:'bài viết đang bị ẩn hoặc đã bị gỡ'},{id:'missing',reason:'Không tìm thấy bài viết'}] (một id lỗi không dừng cả lô). restore không cần reason. ids rỗng/>100/action lạ -> 400.")
    A(F, "Bulk loại id trùng và vẫn tính tối đa 100 phần tử", "Chức năng", "Thấp", APIM + " " + SEED_POST,
      ["bulk hide với ids = [A, A, A] cùng một bài published, reason 'Spam'"], "ids trùng", "200 updated=1 (id trùng chỉ xử lý 1 lần), skipped=[]; chỉ 1 dòng audit.")

    # ============================================================ 3. NỘI DUNG - BÌNH LUẬN
    F = "Nội dung · Bình luận"
    A(F, "Trang Bình luận: KPI, tab (Tất cả/Đã xuất bản/Đã ẩn/Đã gỡ), bảng có cột Bài viết gốc", "Giao diện", "Cao", UI + " " + SEED_CMT,
      ["Mở /admin/content/comments", "Đọc KPI và số đếm tab", "Bấm lần lượt các tab"], "-",
      "Tiêu đề 'Bình luận', phụ đề 'Mọi bình luận trên toàn bộ cộng đồng.'; KPI Tổng (≈227)/Hôm nay/Bị báo cáo (≈4)/Đã gỡ (≈2) khớp DB; tab 'Đã ẩn' ≈1 (CMT-88427752), 'Đã gỡ' ≈2 (CMT-2B7C14C7, CMT-B213F111); cột: Bình luận, Tác giả, Bài viết gốc, Cộng đồng, Báo cáo, Trạng thái, Tạo lúc.")
    A(F, "Tìm Bình luận theo nội dung, tác giả, mã CMT-xxxxxxxx", "Chức năng", "Trung bình", UI + " " + SEED_CMT,
      ["Gõ 'cheap-pills'", "Gõ 'Sophia'", "Gõ 'CMT-D923CB58'"], "cheap-pills | Sophia | CMT-D923CB58",
      "Lần 1: CMT-B213F111 (Ava, 'Đã gỡ'); lần 2: các bình luận của Sophia Patel (có CMT-88427752 'Đã ẩn'); lần 3: đúng CMT-D923CB58 với Báo cáo = 1 (đỏ).")
    A(F, "Sắp xếp Bình luận: Cũ nhất / Tương tác cao nhất / Nhiều báo cáo nhất", "Chức năng", "Thấp", UI,
      ["Chọn lần lượt 3 mục 'Sắp xếp'"], "-", "'Nhiều báo cáo nhất' đặt CMT-D923CB58 (1 báo cáo) lên đầu; 'Cũ nhất' tăng dần theo thời gian tạo. Các mục khác không báo lỗi.")
    A(F, "Menu thao tác Bình luận theo trạng thái và 'Xem tác giả'", "Chức năng", "Trung bình", UI + " " + SEED_CMT,
      ["Menu dòng CMT-A3B80A38 (published)", "Menu CMT-88427752 (hidden)", "Menu CMT-2B7C14C7 (removed)", "Chọn 'Xem tác giả'"], "-",
      "published: Xem trước/Ẩn/Gỡ/Xem tác giả; hidden: Xem trước/Gỡ/Khôi phục/Xem tác giả; removed: Xem trước/Khôi phục/Xem tác giả. 'Xem tác giả' chuyển /admin/users/<id tác giả>.")
    A(F, "Xem trước bình luận: nội dung, bài gốc, báo cáo và lịch sử", "Chức năng", "Trung bình", UI + " " + SEED_CMT,
      ["Mở Xem trước CMT-D923CB58"], "CMT-D923CB58", "Modal 'Xem trước bình luận' mã CMT-D923CB58: Tác giả Noah Williams, Cộng đồng Pixel Pro, Báo cáo 1; Nội dung 'This is false, the instructor replied...'; Báo cáo liệt kê 1 CASE (harassment, Sophia Patel); không có mục 'Bình luận gần đây' (chỉ bài viết có).")
    A(F, "Ẩn bình luận: toast 'Đã ẩn bình luận', badge, audit comment.hide, thông báo tác giả", "Chức năng", "Cao", UIM + " " + SEED_CMT,
      ["Ẩn CMT-A3B80A38 (Liam) với lý do 'Quấy rối', giữ thông báo", "Đăng nhập liam@sofinhub.test xem thông báo", "Tra audit comment.hide"], "CMT-A3B80A38",
      "Toast 'Đã ẩn bình luận'; dòng 'Đã ẩn'; audit comment.hide (targetType=comment); Liam nhận thông báo 'Bình luận của bạn đã bị ẩn' có trích 60 ký tự đầu + 'Lý do: Quấy rối'.")
    A(F, "Gỡ bình luận làm giảm commentsCount của bài, khôi phục tăng lại", "Chức năng", "Cao", APIM + " " + SEED_CMT,
      ["Ghi commentsCount của POST-2467DDA0 (growth-lab) trong DB", "POST /admin/content/comments/<id CMT-A3B80A38>/remove {\"reason\":\"Spam\"}", "Kiểm tra lại commentsCount", "POST .../restore {}", "Kiểm tra lại"], "CMT-A3B80A38",
      "Sau remove: status=removed và commentsCount của bài −1; sau restore: status=published, commentsCount +1 (về giá trị ban đầu). Ẩn (hide) không đổi commentsCount của bài.")
    A(F, "API bình luận: list lọc postId/status, 400/404/409 và bulk", "Chức năng", "Cao", APIM + " " + SEED_CMT,
      ["GET /content/comments?status=hidden", "GET /content/comments?postId=<id POST-2467DDA0>", "GET /content/comments/<id CMT-D923CB58>", "GET /content/comments?status=bogus", "GET /content/comments/nope",
       "hide cùng bình luận 2 lần", "POST /content/comments/bulk {action:'remove',ids:[<id>],reason:'x'}"], "-",
      "Lọc đúng; chi tiết có post {id,title}, reportList, history; status bogus 400; id lạ 404; hide lần 2 409; bulk 200 {updated:1,skipped:[]}. Summary /content/comments/summary có total/today/reported/removed/hidden.")
    A(F, "Bình luận bị gỡ/ẩn biến mất khỏi API công khai /posts/:id/comments", "Chức năng", "Cao", UIM + " " + SEED_CMT + " Đăng nhập daniel@sofinhub.test (thành viên growth-lab).",
      ["Admin gỡ CMT-A3B80A38 (dưới POST-2467DDA0)", "Daniel: GET /api/posts/<id POST-2467DDA0>/comments", "Admin khôi phục", "Daniel gọi lại"], "CMT-A3B80A38",
      "Sau khi gỡ: danh sách bình luận công khai KHÔNG còn bình luận đó (kể cả với chính tác giả Liam); sau khi khôi phục: xuất hiện lại. Bình luận chỉ 'ẩn': thành viên thường không thấy, tác giả/mod vẫn thấy (như mod hide).")

    # ============================================================ 4. NỘI DUNG - KHÓA HỌC (ClassroomModule)
    F = "Nội dung · Khóa học"
    A(F, "Trang Khóa học: tab trạng thái có đếm, cột và dữ liệu seed", "Giao diện", "Cao", UI + " " + SEED_CRS,
      ["Mở /admin/content/courses", "Đọc số đếm 5 tab: Tất cả, Đã xuất bản, Nháp, Đã lưu trữ, Đã gỡ", "Tìm 'System Design Drafts'"], "System Design Drafts",
      "Tiêu đề 'Khóa học' (phụ đề 'Khóa học do creator xuất bản trên nền tảng.'); đếm khớp /content/courses/summary (seed sạch: 124/121/1/1/1); dòng 'System Design Drafts': mã rút gọn 8 ký tự id, Giảng viên 'Alex Rivera', Cộng đồng 'Code Camp', "
      "Học viên = số thành viên cộng đồng (≈68), Bài học 4, Hoàn thành thanh ≈5%, Báo cáo 0, Trạng thái 'Nháp'. Không có thẻ KPI trên đầu trang này.")
    A(F, "Tìm Khóa học theo tên khóa, tên cộng đồng, tên chủ cộng đồng", "Chức năng", "Trung bình", UI + " " + SEED_CRS,
      ["Gõ 'Typography'", "Gõ 'Code Camp'", "Gõ 'Sarah'"], "Typography | Code Camp | Sarah",
      "Lần 1: Typography Masterclass. Lần 2: 4 mô-đun của Code Camp (Node.js from Zero, System Design Drafts + 2 mô-đun mặc định). Lần 3: mô-đun của cộng đồng do Sarah Kim làm chủ (Growth Lab).")
    A(F, "Lọc theo tab Nháp / Đã lưu trữ / Đã gỡ trả đúng khóa seed", "Chức năng", "Cao", UI + " " + SEED_CRS,
      ["Bấm tab 'Nháp'", "Bấm tab 'Đã lưu trữ'", "Bấm tab 'Đã gỡ'"], "-",
      "Nháp: System Design Drafts. Đã lưu trữ: Budgeting 101 (old edition). Đã gỡ: Get Rich Quick Secrets (badge 'Đã gỡ' đỏ, preview hiện 'Lý do kiểm duyệt' = Misleading claims). Mỗi tab 1 dòng.")
    A(F, "Sắp xếp Khóa học: Cũ nhất, Nhiều học viên, Nhiều bài học, Tên A–Z", "Chức năng", "Thấp", UI,
      ["Chọn lần lượt 4 mục 'Sắp xếp'", "Bấm 'Xóa bộ lọc'"], "-", "'Tên A–Z' tăng dần theo tiêu đề; 'Nhiều học viên' giảm dần theo số học viên; 'Nhiều bài học' giảm dần theo số bài; không lỗi; 'Xóa bộ lọc' về mặc định (mới nhất).")
    A(F, "Menu thao tác Khóa học theo trạng thái (Xuất bản/Hủy xuất bản/Lưu trữ/Gỡ/Khôi phục/Mở cộng đồng)", "Chức năng", "Cao", UI + " " + SEED_CRS,
      ["Menu dòng Node.js from Zero (published)", "Menu System Design Drafts (draft)", "Menu Budgeting 101 (archived)", "Menu Get Rich Quick Secrets (removed)"], "-",
      "published: Xem trước, Hủy xuất bản, Lưu trữ, Gỡ, Mở cộng đồng. draft: Xem trước, Xuất bản, Lưu trữ, Gỡ, Mở cộng đồng. archived: Xem trước, Xuất bản, Gỡ, Mở cộng đồng. removed: Xem trước, Khôi phục, Mở cộng đồng. 'Mở cộng đồng' chuyển /admin/communities/<id cộng đồng>.")
    A(F, "Xem trước Khóa học: giảng viên, học viên, danh sách bài học kèm trạng thái, lịch sử", "Chức năng", "Cao", UI + " " + SEED_CRS + " " + SEED_LSN,
      ["Mở Xem trước 'Experimentation Playbook'"], "Experimentation Playbook",
      "Tiêu đề = tên khóa, phụ đề 'Growth Lab'. Thông tin: Giảng viên Sarah Kim, Học viên (≈68), Số bài học 4, Tỷ lệ hoàn thành (≈5%), Trạng thái 'Đã xuất bản', Báo cáo 0. Mục 'Bài học (4)' liệt kê 4 bài kèm icon loại, '<n> phút' và badge; bài LSN-303F7046 có badge 'Đã ẩn'. 'Lịch sử quản trị' trống nếu chưa thao tác.")
    A(F, "Hủy xuất bản khóa học: modal, toast, trạng thái Nháp, thông báo giảng viên, audit", "Chức năng", "Cao", UIM + " " + SEED_CRS,
      ["Menu 'Node.js from Zero' > 'Hủy xuất bản'", "Chọn lý do 'Nội dung nhạy cảm', ghi chú 'QA', giữ 'Thông báo cho giảng viên'", "Xác nhận", "Đăng nhập alex@sofinhub.test xem thông báo; tra audit 'course.unpublish'"], "Node.js from Zero",
      "Modal 'Hủy xuất bản khóa học?' nội dung '...Thành viên thường sẽ không còn thấy khóa học này.'; toast 'Đã hủy xuất bản khóa học'; trạng thái 'Nháp', tab Nháp +1; Alex nhận thông báo 'Khóa học đã bị hủy xuất bản' kèm 'Lý do'; audit course.unpublish (targetType=course, metadata.community='code-camp').")
    A(F, "Xuất bản lại khóa học (Nháp/Đã lưu trữ -> Đã xuất bản)", "Chức năng", "Cao", UIM + " " + SEED_CRS,
      ["Menu 'System Design Drafts' > 'Xuất bản' > xác nhận", "Menu 'Budgeting 101 (old edition)' > 'Xuất bản' > xác nhận"], "System Design Drafts, Budgeting 101",
      "Cả hai: toast 'Đã xuất bản khóa học', trạng thái 'Đã xuất bản', lý do kiểm duyệt bị xóa; audit course.publish; KHÔNG gửi thông báo cho giảng viên khi xuất bản.")
    A(F, "Lưu trữ khóa học (Đã xuất bản/Nháp -> Đã lưu trữ) với lý do tùy chọn", "Chức năng", "Trung bình", UIM + " " + SEED_CRS,
      ["Menu '12-Week Strength Program' > 'Lưu trữ'", "Xác nhận không chọn lý do"], "12-Week Strength Program",
      "Toast 'Đã lưu trữ khóa học'; trạng thái 'Đã lưu trữ'; audit course.archive; nút xác nhận không bị khóa vì lý do không bắt buộc ở archive.")
    A(F, "Gỡ khóa học rồi khôi phục: giữ nguyên trạng thái xuất bản trước đó", "Chức năng", "Cao", UIM + " " + SEED_CRS,
      ["Menu 'Budgeting 101 (old edition)' (archived) > 'Gỡ' lý do 'Khác'", "Quan sát badge 'Đã gỡ'", "Menu > 'Khôi phục' > xác nhận"], "Budgeting 101",
      "Sau Gỡ: 'Đã gỡ' (tab Đã lưu trữ -1, Đã gỡ +1); sau Khôi phục: quay lại 'Đã lưu trữ' (KHÔNG thành published) vì removedAt độc lập với trạng thái xuất bản; toast 'Đã gỡ khóa học' / 'Đã khôi phục khóa học'.")
    A(F, "API Khóa học: list/summary/detail, lọc status/courseId, sort, 400", "Chức năng", "Cao", API + " " + SEED_CRS,
      ["GET /content/courses/summary", "GET /content/courses?courseId=code-camp&status=draft", "GET /content/courses?sort=students&limit=5", "GET /content/courses/<id Node.js from Zero = 8da8a3b9-...>", "GET /content/courses?status=nope", "GET /content/courses?sort=nope", "GET /content/courses/nope"], "code-camp",
      "summary {total,published,draft,archived,removed}; lọc ra đúng 1 dòng 'System Design Drafts' (lessons=4, creator=Alex Rivera); detail có description và lessonList (4 phần tử {id,title,type,durationMin,status}) + history; nope 404 'Không tìm thấy khóa học'; status/sort lạ 400. thumbnail luôn null, reports luôn 0.")
    A(F, "API Khóa học: bảng chuyển trạng thái publish/unpublish/archive/remove/restore và mã 400/409", "Chức năng", "Cao", APIM + " " + SEED_CRS,
      ["publish trên khóa published -> 409", "unpublish không reason -> 400", "unpublish {reason:'Quality'} -> draft", "unpublish lần 2 -> 409", "publish -> published", "archive -> archived", "remove {reason:'Policy'} -> removed", "remove lần 2 -> 409", "restore -> archived", "restore lần 2 -> 409", "publish id 'nope' -> 404"], "Experimentation Playbook",
      "409 'Chỉ xuất bản được khóa học đang ở trạng thái nháp hoặc lưu trữ'; 400 thiếu lý do; unpublish ra status='draft'; sau remove status='removed'; restore trả 'archived' (giữ trạng thái xuất bản trước đó); id lạ 404.")
    A(F, "Khóa học draft/archived/removed biến mất khỏi API lớp học của thành viên thường", "Chức năng", "Cao", UIM + " " + SEED_CRS + " Đăng nhập daniel@sofinhub.test (thành viên growth-lab).",
      ["Daniel: GET /api/courses/growth-lab/modules (ghi nhận 'Experimentation Playbook')", "Admin hủy xuất bản 'Experimentation Playbook'", "Daniel gọi lại", "Admin xuất bản lại, rồi lưu trữ", "Daniel gọi lại", "Admin gỡ, Daniel gọi lại"], "growth-lab / Experimentation Playbook",
      "Chỉ trạng thái published và chưa gỡ mới hiện trong /courses/growth-lab/modules; draft, archived, removed đều ẩn với thành viên thường; xuất bản lại thì hiện lại.")
    A(F, "Mô-đun draft do admin hủy xuất bản cũng ẩn với mod cộng đồng", "Bảo mật", "Trung bình", BASE2 + " Admin hủy xuất bản một mô-đun của cộng đồng photo (mod photo: mod@sofinhub.test). " + MUTATE,
      ["Admin: GET /content/courses?courseId=photo rồi POST .../unpublish {reason:'QA'} cho 1 mô-đun", "mod@sofinhub.test: GET /api/courses/photo/modules"], "photo",
      "Mod cộng đồng KHÔNG còn thấy mô-đun đó (khác hành vi cũ: mod thấy cả khóa draft do chính mình tạo) - đúng mục 10 'Khác biệt' của admin-batch2.md.", pw="Một phần")
    A(F, "Khóa học: reports luôn 0 và thumbnail luôn null (ClassroomModule không có cờ báo cáo)", "Chức năng", "Thấp", API,
      ["GET /api/admin/content/courses?limit=100", "Đối chiếu trường reports, thumbnail của từng phần tử"], "-",
      "Mọi phần tử: reports=0, thumbnail=null (giao diện hiển thị avatar chữ cái thay ảnh bìa). Hành vi hiện tại, xem case Kế hoạch 'Khóa học/Bài học/Sự kiện chưa có báo cáo'.")

    # ============================================================ 5. NỘI DUNG - BÀI HỌC
    F = "Nội dung · Bài học"
    A(F, "Trang Bài học: tab loại (Tất cả/Video/Văn bản/Tệp), lọc Trạng thái, cột 'Lượt hoàn thành'", "Giao diện", "Cao", UI + " " + SEED_LSN,
      ["Mở /admin/content/lessons", "Bấm tab 'Video', 'Văn bản', 'Tệp'", "Lọc 'Trạng thái' = 'Đã ẩn'", "Lọc 'Trạng thái' = 'Đã gỡ'"], "-",
      "Tiêu đề 'Bài học' (phụ đề 'Từng bài học trong các khóa học.'); chỉ tab 'Tất cả' có số đếm (≈473); tab loại chỉ hiện đúng loại; 'Đã ẩn' ra 2 dòng (LSN-408423DE, LSN-303F7046); 'Đã gỡ' ra 5 dòng; cột: Bài học (tiêu đề+mã LSN), Mô-đun, Cộng đồng, Loại, Lượt hoàn thành, Báo cáo, Trạng thái.")
    A(F, "Tìm Bài học theo tiêu đề, tên mô-đun, cộng đồng, mã LSN", "Chức năng", "Trung bình", UI + " " + SEED_LSN,
      ["Gõ 'Get Rich Quick'", "Gõ 'LSN-408423DE'", "Gõ 'Case study walkthrough 4'"], "Get Rich Quick | LSN-408423DE | Case study walkthrough 4",
      "Lần 1: 4 bài (tất cả 'Đã gỡ') thuộc mô-đun Get Rich Quick Secrets; lần 2: đúng 'Templates & checklists 3' (Đã ẩn) của 12-Week Strength Program; lần 3: các bài có tiêu đề này, gồm LSN-39855DC0 (Experimentation Playbook).")
    A(F, "Sắp xếp Bài học: Nhiều lượt hoàn thành, Tên A–Z", "Chức năng", "Thấp", UI,
      ["Chọn 'Nhiều lượt hoàn thành'", "Chọn 'Tên A–Z'"], "-", "Lần 1: cột 'Lượt hoàn thành' giảm dần; lần 2: tiêu đề tăng dần A→Z.")
    A(F, "Menu thao tác Bài học (Xem trước/Ẩn/Gỡ/Khôi phục), không có 'Xem tác giả'", "Chức năng", "Trung bình", UI + " " + SEED_LSN,
      ["Mở menu dòng LSN-39855DC0 (published)", "Menu LSN-408423DE (hidden)", "Menu LSN-DA91F381 (removed)"], "-",
      "published: Xem trước, Ẩn, Gỡ. hidden: Xem trước, Gỡ, Khôi phục. removed: Xem trước, Khôi phục. Không có thao tác 'Xem tác giả'.")
    A(F, "Xem trước Bài học: mô-đun, loại, thời lượng, nội dung, lý do kiểm duyệt", "Chức năng", "Trung bình", UI + " " + SEED_LSN,
      ["Mở Xem trước LSN-408423DE"], "LSN-408423DE",
      "Tiêu đề = tên bài, phụ đề LSN-408423DE; Mô-đun '12-Week Strength Program', Cộng đồng 'Fit Forever', Loại 'Video', Thời lượng '14 phút', Hoàn thành ≈4, Trạng thái 'Đã ẩn', Báo cáo 0, 'Lý do kiểm duyệt' 'Outdated content'; mục 'Nội dung' 'Nội dung bài học minh họa.'.")
    A(F, "Ẩn bài học: toast 'Đã ẩn bài học', trạng thái, thông báo chủ cộng đồng, audit lesson.hide", "Chức năng", "Cao", UIM + " " + SEED_LSN,
      ["Menu LSN-39855DC0 > 'Ẩn' (lý do 'Khác', giữ thông báo)", "Đăng nhập sarah@sofinhub.test xem thông báo", "Tra audit 'lesson.hide'"], "LSN-39855DC0",
      "Toast 'Đã ẩn bài học'; badge 'Đã ẩn'; Sarah (chủ Growth Lab) nhận thông báo 'Bài học đã bị ẩn' có tiêu đề bài + 'Lý do: Khác'; audit lesson.hide với metadata {community:'growth-lab', moduleId}.")
    A(F, "Gỡ rồi khôi phục bài học: toast và trạng thái", "Chức năng", "Trung bình", UIM + " " + SEED_LSN,
      ["Menu LSN-6CFA84D6 > 'Gỡ' (lý do bắt buộc) > xác nhận", "Menu > 'Khôi phục' > xác nhận"], "LSN-6CFA84D6",
      "'Đã gỡ bài học' rồi 'Đã khôi phục bài học'; trạng thái 'Đã gỡ' rồi 'Đã xuất bản'; audit lesson.remove và lesson.restore; lúc khôi phục không thông báo.")
    A(F, "API Bài học: list lọc type/moduleId/status, detail có body, 400/404", "Chức năng", "Cao", API + " " + SEED_LSN,
      ["GET /content/lessons/summary", "GET /content/lessons?type=video&status=hidden", "GET /content/lessons?type=link", "GET /content/lessons/<id LSN-408423DE>", "GET /content/lessons/nope", "GET /content/lessons?sort=nope"], "-",
      "summary {total,published,hidden,removed}; type=video+hidden ra các bài video đang ẩn; type=link -> 400 (chỉ video|text|file); detail có code LSN-..., body, videoUrl, embedUrl, attachments, history; nope 404; sort lạ 400.")
    A(F, "API Bài học: ẩn/gỡ/khôi phục và 409 khi sai trạng thái", "Chức năng", "Cao", APIM + " " + SEED_LSN,
      ["hide LSN-39855DC0 {reason:'Outdated'}", "hide lần 2 -> 409", "remove {reason:'Policy'}", "restore", "restore lần 2 -> 409", "hide thiếu reason -> 400"], "LSN-39855DC0",
      "hide->hidden 200; hide lần 2 409 'bài học đang bị ẩn hoặc đã bị gỡ'; remove->removed; restore->published; restore lần 2 409 'bài học đang hiển thị bình thường'; thiếu lý do 400.")
    A(F, "Bài học bị ẩn/gỡ biến mất khỏi danh sách và chi tiết của thành viên; khôi phục hiện lại", "Chức năng", "Cao", UIM + " " + SEED_LSN + " Đăng nhập daniel@sofinhub.test (thành viên growth-lab).",
      ["Daniel: GET /api/courses/growth-lab/modules/<id Experimentation Playbook = 010dd5d0-...>/lessons (3 bài: bài LSN-303F7046 đã ẩn từ seed)", "Admin ẩn LSN-39855DC0", "Daniel gọi lại danh sách và GET /api/courses/growth-lab/lessons/<id bài đó>", "Admin gỡ rồi khôi phục", "Daniel kiểm tra lại"], "LSN-39855DC0",
      "Sau khi ẩn hoặc gỡ: danh sách còn 2 bài và chi tiết bài đó trả 404; sau khi khôi phục: danh sách 3 bài và mở được chi tiết.")

    # ============================================================ 6. NỘI DUNG - SỰ KIỆN
    F = "Nội dung · Sự kiện"
    A(F, "Trang Sự kiện: tab Tất cả/Sắp diễn ra/Đang diễn ra/Hoàn tất/Đã hủy, cột và trạng thái seed", "Giao diện", "Cao", UI + " " + SEED_EVT,
      ["Mở /admin/content/events", "Đọc số đếm các tab", "Bấm tab 'Đã hủy' và 'Đang diễn ra'"], "-",
      "Tiêu đề 'Sự kiện' (phụ đề 'Sự kiện được lên lịch ở mọi cộng đồng.'); không có thẻ KPI; số đếm khớp /content/events/summary (seed sạch: Tất cả 80, Sắp 40, Đang 1, Hoàn tất 38, Đã hủy 1 - 'Đang diễn ra' chỉ còn 1 trong 2 giờ đầu sau khi seed); "
      "'Đã hủy' = 'Hack night (cancelled: host unavailable)'; cột: Sự kiện, Cộng đồng, Người tổ chức, Tham dự ('3/30' khi có capacity), Ngày, Trạng thái, Báo cáo.")
    A(F, "Sự kiện 'live' chỉ trong 2 giờ sau giờ bắt đầu rồi chuyển 'Hoàn tất'", "Chức năng", "Trung bình", UI + " " + SEED_EVT + " Cần sửa startAt trong DB (npm run db:studio): đặt startAt của 'Mobility workshop (live now)' = bây giờ − 30 phút rồi − 3 giờ. " + MUTATE,
      ["Đặt startAt = 30 phút trước, tải lại trang Sự kiện", "Đặt startAt = 3 giờ trước, tải lại"], "Mobility workshop (live now)",
      "Lần 1: 'Đang diễn ra' (xuất hiện ở tab Đang diễn ra). Lần 2: 'Hoàn tất'. Quy tắc: startAt ≤ now và > now − 2 giờ = live; cancelled/removed thắng mọi trạng thái.", pw="Không")
    A(F, "Tab 'Tất cả' có cả sự kiện đã gỡ nhưng KHÔNG có tab 'Đã gỡ'; số đếm 'Tất cả' không tính sự kiện đã gỡ", "Chức năng", "Trung bình", UI + " " + SEED_EVT,
      ["Bấm tab 'Tất cả', tìm 'Secret wealth webinar'", "So số đếm 'Tất cả' với tổng số dòng", "Kiểm tra các tab còn lại"], "Secret wealth webinar",
      "Sự kiện đã gỡ hiện trong 'Tất cả' với badge 'Đã gỡ'; không có tab riêng 'Đã gỡ'; số đếm 'Tất cả' (summary.total) loại sự kiện đã gỡ nên nhỏ hơn số dòng 1 đơn vị (hành vi hiện tại).")
    A(F, "Tìm và sắp xếp Sự kiện (Mới tạo nhất / Theo ngày diễn ra)", "Chức năng", "Trung bình", UI + " " + SEED_EVT,
      ["Gõ 'Growth AMA'", "Gõ 'Sarah'", "Gõ 'Code Camp'", "Chọn sắp xếp 'Mới tạo nhất' rồi 'Theo ngày diễn ra'"], "Growth AMA | Sarah | Code Camp",
      "Lần 1: 'Growth AMA with the founders'; lần 2: sự kiện host Sarah Kim (AMA, Retention teardown); lần 3: các sự kiện của Code Camp; 'Theo ngày diễn ra' = ngày bắt đầu giảm dần (mặc định); 'Mới tạo nhất' theo createdAt giảm dần.")
    A(F, "Menu thao tác Sự kiện theo trạng thái (Xem/Sửa/Hủy/Gỡ/Khôi phục)", "Chức năng", "Cao", UI + " " + SEED_EVT,
      ["Menu 'Growth AMA with the founders' (sắp diễn ra)", "Menu 'Quarterly budget reset' (hoàn tất)", "Menu 'Hack night' (đã hủy)", "Menu 'Secret wealth webinar' (đã gỡ)"], "-",
      "Sắp/đang: Xem, Sửa, Hủy, Gỡ. Hoàn tất: Xem, Gỡ (KHÔNG có Sửa/Hủy). Đã hủy: Xem, Gỡ, Khôi phục. Đã gỡ: Xem, Khôi phục.")
    A(F, "Xem sự kiện (modal): người tổ chức, thời gian + múi giờ, link họp, danh sách RSVP, lịch sử", "Chức năng", "Cao", UI + " " + SEED_EVT,
      ["Mở 'Xem' ở 'Live coding: build a CLI in Node'"], "Live coding: build a CLI in Node",
      "Người tổ chức Alex Rivera; Thời gian '<ngày giờ> (Asia/Ho_Chi_Minh)'; Địa điểm/Link họp = https://meet.example.com/<id>; Người tham dự '3 / 30'; Trạng thái 'Sắp diễn ra'; mô tả 'Sự kiện minh họa cho trang admin.'; 'Người đã đăng ký (3)' gồm Noah Williams, Emma Garcia, Ava Johnson.")
    A(F, "Xem sự kiện đã hủy hiển thị 'Lý do hủy'", "Chức năng", "Thấp", UI + " " + SEED_EVT,
      ["Mở 'Xem' ở 'Hack night (cancelled: host unavailable)'"], "Hack night",
      "Có dòng 'Lý do hủy' = Host unavailable; Trạng thái 'Đã hủy'; 'Người đã đăng ký (2)' Daniel Park, Ethan Brooks; lịch sử có event.cancel (từ seed audit).")
    A(F, "Sửa sự kiện: đổi tên, giờ, link họp, sức chứa thành công", "Chức năng", "Cao", UIM + " " + SEED_EVT,
      ["Menu 'Growth AMA with the founders' > 'Sửa'", "Đổi tên thành 'Growth AMA (đã sửa)', sức chứa 10, link https://meet.example.com/qa, đổi giờ sang 2 ngày sau", "Bấm 'Lưu thay đổi'"], "Growth AMA",
      "Modal 'Sửa sự kiện' (cộng đồng Growth Lab) nạp sẵn giá trị; toast 'Đã cập nhật sự kiện'; dòng hiện tên mới, 'Tham dự 4/10', ngày mới; audit event.update với metadata.changes; đổi giờ thì nhắc lịch của người RSVP được đặt lại (remindedAt=null).")
    A(F, "Sửa sự kiện: kiểm tra dữ liệu ở form (tên rỗng, sức chứa không phải số nguyên >= 1)", "Chức năng", "Trung bình", UI + " " + SEED_EVT,
      ["Mở 'Sửa' ở 'Live coding: build a CLI in Node'", "Xóa trắng tên", "Nhập tên lại; sức chứa 'abc'; sức chứa '0'; sức chứa '2.5'; xóa trắng sức chứa"], "-",
      "Nút 'Lưu thay đổi' bị khóa khi tên rỗng, sức chứa 'abc'/'0'/'2.5'; để trống sức chứa = không giới hạn (hợp lệ, gửi capacity=null).")
    A(F, "Sửa sự kiện: sức chứa nhỏ hơn số người đã RSVP hiện lỗi 409 trong modal", "Chức năng", "Trung bình", UIM + " " + SEED_EVT,
      ["'Sửa' 'Growth AMA with the founders' (4 RSVP)", "Nhập sức chứa 2 và lưu"], "capacity=2",
      "Modal không đóng, hiện 'Sức chứa không được nhỏ hơn số người đã đăng ký'; dữ liệu không đổi.")
    A(F, "Hủy sự kiện: modal, thông báo cho người RSVP, toast, trạng thái 'Đã hủy', audit", "Chức năng", "Cao", UIM + " " + SEED_EVT,
      ["Menu 'Growth AMA with the founders' > 'Hủy'", "Đọc nội dung: '... 4 người đã đăng ký sẽ được thông báo.'", "Chọn lý do 'Trùng lịch', giữ checkbox 'Thông báo cho người đã đăng ký', xác nhận", "Đăng nhập alex@ và emma@ xem thông báo"], "Growth AMA",
      "Toast 'Đã hủy sự kiện'; trạng thái 'Đã hủy', 'Lý do hủy' = Trùng lịch; Alex/Daniel/Liam/Ava nhận thông báo 'Sự kiện đã bị hủy' ('...đã bị quản trị viên hủy (Trùng lịch).'); Emma (không RSVP) KHÔNG nhận; audit event.cancel.")
    A(F, "Hủy sự kiện bỏ chọn 'Thông báo' thì không ai nhận thông báo", "Chức năng", "Trung bình", UIM + " " + SEED_EVT,
      ["Hủy 'Portfolio review night' với lý do 'Khác', bỏ tích thông báo", "Đăng nhập liam@ kiểm tra thông báo"], "Portfolio review night",
      "Sự kiện 'Đã hủy' nhưng Liam/Sophia không có thông báo mới 'Sự kiện đã bị hủy' (notifyAttendees=false).")
    A(F, "Gỡ sự kiện: toast, trạng thái 'Đã gỡ', biến mất khỏi API công khai; khôi phục", "Chức năng", "Cao", UIM + " " + SEED_EVT + " Đăng nhập noah@sofinhub.test (thành viên mindful-money).",
      ["Menu 'Quarterly budget reset' (mindful-money) > 'Gỡ' lý do 'Spam' > xác nhận", "noah@: GET /api/courses/mindful-money/events và GET /api/events/<id>", "Admin 'Khôi phục'"], "Quarterly budget reset",
      "Toast 'Đã gỡ sự kiện'; 'Đã gỡ'; danh sách công khai không còn sự kiện và GET /events/:id = 404; sau 'Khôi phục' (toast 'Đã khôi phục sự kiện') hiện lại với trạng thái theo giờ (Hoàn tất).")
    A(F, "Sự kiện bị hủy: người chưa RSVP đăng ký nhận 409; API công khai trả cancelledAt", "Chức năng", "Cao", UIM + " " + SEED_EVT + " Đăng nhập emma@sofinhub.test (thành viên growth-lab, chưa RSVP).",
      ["Admin hủy 'Growth AMA with the founders'", "emma@: POST /api/events/<id>/rsvp", "emma@: GET /api/courses/growth-lab/events"], "Growth AMA",
      "POST rsvp trả 409 CONFLICT (sự kiện đã hủy); danh sách sự kiện công khai vẫn có sự kiện kèm trường cancelledAt (có giá trị) để FE hiển thị 'đã hủy'.")
    A(F, "Khôi phục sự kiện bị hủy: trở về trạng thái theo giờ", "Chức năng", "Trung bình", UIM + " " + SEED_EVT,
      ["Menu 'Hack night' > 'Khôi phục' > xác nhận"], "Hack night", "Toast 'Đã khôi phục sự kiện'; trạng thái 'Sắp diễn ra' (startAt +5 ngày); xóa cancelReason/cancelledAt/removedAt; audit event.restore; người RSVP không bị gửi thông báo.")
    A(F, "API Sự kiện: list lọc status/courseId/sort, detail có rsvps (<=50), 400/404", "Chức năng", "Cao", API + " " + SEED_EVT,
      ["GET /content/events/summary", "GET /content/events?status=cancelled", "GET /content/events?courseId=code-camp&status=upcoming,live&sort=newest", "GET /content/events/<id Growth AMA = 143cebc4-...>", "GET /content/events?status=removed", "GET /content/events?status=nope", "GET /content/events/nope"], "-",
      "summary {total,upcoming,live,completed,cancelled}; cancelled ra Hack night; chi tiết có description, rsvps (4 Person), history; status=removed và status=nope -> 400 (chỉ upcoming|live|completed|cancelled); nope 404.")
    A(F, "API Sự kiện: PATCH (400 không có gì để cập nhật/URL sai) và cancel/remove/restore với 409", "Chức năng", "Cao", APIM + " " + SEED_EVT,
      ["PATCH /content/events/<id> {} -> 400", "PATCH {meetingLink:'abc'} -> 400", "PATCH {capacity:0} -> 400", "PATCH {capacity:1} khi có RSVP>1 -> 409", "PATCH {title:'Tên mới',capacity:null,meetingLink:null} -> 200",
       "cancel thiếu reason -> 400", "cancel {reason:'x'} -> 200", "cancel lần 2 -> 409", "cancel sự kiện đã hoàn tất -> 409", "remove -> 200, remove lần 2 -> 409", "restore -> 200, restore lần 2 -> 409"], "Growth AMA, Quarterly budget reset",
      "Đúng các mã: 400/400/400/409/200; cancel: 400 -> 200 (status 'cancelled', cancelReason) -> 409 'Chỉ hủy được sự kiện sắp/đang diễn ra và chưa bị hủy'; hoàn tất 409; remove 200/409 'Sự kiện đã bị gỡ'; restore 200/409 'Sự kiện không ở trạng thái hủy/gỡ'.")
    A(F, "Sức chứa đặt bằng đúng số RSVP: PATCH hợp lệ và RSVP công khai tiếp theo nhận 409", "Chức năng", "Thấp", APIM + " " + SEED_EVT + " Đăng nhập emma@sofinhub.test.",
      ["PATCH capacity=4 cho 'Growth AMA with the founders' (đã 4 RSVP)", "emma@: POST /api/events/<id>/rsvp"], "capacity=4",
      "PATCH 200 (4 không nhỏ hơn 4 RSVP); RSVP của emma trả 409 (đã đầy chỗ).")

    # ============================================================ 7. NỘI DUNG - MEDIA
    F = "Nội dung · Media"
    A(F, "Trang Media: 4 KPI và chế độ Lưới mặc định", "Giao diện", "Cao", UI + " " + SEED_MED,
      ["Mở /admin/content/media", "Đọc KPI 'Tổng tệp', 'Dung lượng', 'Bị gắn cờ', 'Đã gỡ'", "Đọc tiêu đề thẻ lưới"], "-",
      "Tiêu đề 'Media' (phụ đề 'Thư viện media của toàn nền tảng.'); KPI: 12, '1.4 GB', 2 (đỏ), 1; mặc định 'Lưới' với thẻ có thumbnail/biểu tượng loại, tên tệp, dòng '<dung lượng> · <chủ tệp> · <thời gian>'; tiêu đề 'Thư viện media' + '12 tệp'.")
    A(F, "Chip loại tệp: Tất cả / Hình ảnh / Video / Tài liệu / Âm thanh", "Chức năng", "Cao", UI + " " + SEED_MED,
      ["Bấm lần lượt từng chip loại", "Ghi số tệp ở dòng phụ"], "-",
      "Hình ảnh 5 tệp, Video 2, Tài liệu 5 (pdf, docx, zip, txt), Âm thanh 0 -> hiện 'Không có tệp nào.'; khớp summary.byKind.")
    A(F, "Chip trạng thái: Mọi trạng thái / Hoạt động / Bị gắn cờ / Đã gỡ", "Chức năng", "Cao", UI + " " + SEED_MED,
      ["Bấm lần lượt từng chip trạng thái"], "-",
      "Hoạt động 9 tệp; Bị gắn cờ 2 (notion-template.pdf, leaked-meal-plan.pdf, mỗi thẻ có nhãn '1 báo cáo' đỏ); Đã gỡ 1 (signals-pack.zip, KHÔNG có nút Xem trước); kết hợp chip loại + trạng thái cho ra giao của hai bộ lọc.")
    A(F, "Tìm Media theo tên tệp, tên chủ tệp, tên cộng đồng", "Chức năng", "Trung bình", UI + " " + SEED_MED,
      ["Gõ 'leaked'", "Gõ 'Emma'", "Gõ 'Pixel Pro'"], "leaked | Emma | Pixel Pro",
      "Lần 1: leaked-meal-plan.pdf; lần 2: 3 tệp của Emma Garcia (checklist.docx, banner-q4.jpg, typography-sheet.png); lần 3: các tệp thuộc cộng đồng Pixel Pro (3 tệp).")
    A(F, "Chuyển Lưới/Bảng: bảng có cột Tên tệp, Chủ tệp, Cộng đồng, Dung lượng, Báo cáo, Trạng thái, Tải lên", "Giao diện", "Trung bình", UI + " " + SEED_MED,
      ["Bấm 'Bảng' ở 'Chế độ xem'", "Bấm 'Lưới' quay lại"], "-",
      "Bảng hiện đủ 7 cột; 'Dung lượng' dạng '1.1 GB', '4 KB', '248.0 MB'; 'avatar-sophia.jpg' có Cộng đồng '—'; 'Báo cáo' = 1 cho tệp gắn cờ; menu thao tác ở chế độ Bảng có thêm Gắn cờ/Bỏ gắn cờ; chế độ Lưới chỉ có Xem trước/Tải xuống/Gỡ(Khôi phục).")
    A(F, "Phân trang Media 24 tệp/trang (khi > 24)", "Chức năng", "Thấp", UI + " Cần > 24 tệp: tải thêm 13 tệp bằng /api/uploads (presign + PUT) với tài khoản member.",
      ["Tải lên thêm 13 tệp", "Mở /admin/content/media"], "13 tệp thêm",
      "Có bộ phân trang ở dưới lưới (24/trang), trang 2 hiện các tệp còn lại; đổi bộ lọc thì về trang 1.", pw="Không")
    A(F, "Media: trạng thái tải, lỗi và Thử lại", "Giao diện", "Trung bình", UI,
      ["Chặn /api/admin/content/media trong DevTools", "F5 trang Media", "Bỏ chặn, bấm 'Thử lại'"], "-", "Hiện 'Đang tải…' rồi khối lỗi có nút 'Thử lại'; sau Thử lại hiện lưới bình thường.", pw="Một phần")
    A(F, "Gắn cờ tệp (chế độ Bảng): lý do bắt buộc, toast, KPI và nhãn báo cáo", "Chức năng", "Cao", UIM + " " + SEED_MED,
      ["Chuyển 'Bảng'", "Menu 'budget-preview.png' > 'Gắn cờ'", "Chọn lý do 'Bản quyền' > xác nhận"], "budget-preview.png",
      "Modal 'Gắn cờ tệp?'; nút khóa tới khi chọn lý do; toast 'Đã gắn cờ tệp'; trạng thái 'Bị gắn cờ', Báo cáo = 1, KPI 'Bị gắn cờ' +1; audit media.flag (targetId = key tệp). Không gửi thông báo cho chủ tệp.")
    A(F, "Bỏ gắn cờ tệp: modal có ghi chú tùy chọn, trạng thái về Hoạt động", "Chức năng", "Trung bình", UIM + " " + SEED_MED,
      ["Menu 'notion-template.pdf' (đã cờ) > 'Bỏ gắn cờ' > xác nhận"], "notion-template.pdf", "Toast 'Đã bỏ gắn cờ'; trạng thái 'Hoạt động', Báo cáo 0; KPI 'Bị gắn cờ' −1; audit media.unflag.")
    A(F, "Gỡ tệp: modal có 'Thông báo cho chủ tệp', toast, trạng thái 'Đã gỡ'", "Chức năng", "Cao", UIM + " " + SEED_MED,
      ["Menu 'checklist.docx' > 'Gỡ' (lý do 'Khác', giữ thông báo)", "Đăng nhập emma@ xem thông báo"], "checklist.docx",
      "Modal 'Gỡ tệp' '... Tệp sẽ không còn truy cập được công khai.'; toast 'Đã gỡ tệp'; 'Đã gỡ' (KPI +1); mất nút 'Xem trước'; Emma nhận thông báo 'File của bạn đã bị gỡ' có tên tệp + 'Lý do: Khác'; audit media.remove.")
    A(F, "Khôi phục tệp đã gỡ", "Chức năng", "Trung bình", UIM + " " + SEED_MED,
      ["Thẻ 'signals-pack.zip' > nút 'Khôi phục' > xác nhận"], "signals-pack.zip", "Toast 'Đã khôi phục tệp'; trạng thái 'Hoạt động'; KPI 'Đã gỡ' −1; hiện lại nút 'Xem trước'; audit media.restore.")
    A(F, "Nút 'Xem trước' mở tệp ở tab mới; tệp seed (chỉ metadata) trả 404", "Chức năng", "Thấp", UI + " " + SEED_MED,
      ["Thẻ 'budget-preview.png' > 'Xem trước'"], "budget-preview.png",
      "Tab mới mở /api/files/50871a26495c5339209f99291851d627.png; vì seed chỉ có metadata nên trả 404 (với tệp thật upload qua /uploads thì xem được). Tệp 'Đã gỡ' không có nút Xem trước.", pw="Một phần")
    A(F, "Nút 'Tải xuống' (kèm Bearer): tệp thật tải được, tệp seed hiện toast lỗi", "Chức năng", "Trung bình", UI + " " + SEED_MED + " Để có tệp thật: member1 POST /api/uploads/presign {filename:'a.png',contentType:'image/png',size:40,purpose:'post_image'} rồi PUT tới uploadUrl với 40 byte PNG.",
      ["Bấm 'Tải xuống' ở 'budget-preview.png' (seed)", "Bấm 'Tải xuống' ở tệp 'a.png' vừa upload"], "a.png",
      "Tệp seed: toast lỗi 'File không còn trong storage' (404); tệp thật: trình duyệt tải file tên a.png đúng dung lượng, header attachment + nosniff; tải được cả tệp đã gỡ.", pw="Một phần")
    A(F, "API Media: list lọc kind/status/q và summary", "Chức năng", "Cao", API + " " + SEED_MED,
      ["GET /content/media/summary", "GET /content/media?kind=image", "GET /content/media?status=flagged", "GET /content/media?status=flagged,removed&sort=size", "GET /content/media?q=emma", "GET /content/media?kind=bogus", "GET /content/media?sort=bogus"], "-",
      "summary {total:12,totalSizeBytes:1378918387,flagged:2,removed:1,byKind:{image:5,video:2,document:5,audio:0}}; kind=image ra 5; flagged ra 2; flagged+removed ra 3, sort=size giảm dần; kind/sort lạ 400. Mỗi phần tử có key, filename, kind, contentType, size, purpose, owner, community, url (null nếu removed), status, flagged, flagReason, reports, uploadedAt.")
    A(F, "API Media: chi tiết theo key và 404", "Chức năng", "Trung bình", API + " " + SEED_MED,
      ["GET /content/media/7e67c7a1b47e2661c431b37641431f15.pdf (notion-template.pdf)", "GET /content/media/ffffffffffffffffffffffffffffffff.png"], "key notion-template.pdf",
      "Lần 1: 200 status 'flagged', flagReason 'Possible copyrighted material', reports 1, url '/api/files/<key>', history[]; lần 2: 404 'Không tìm thấy file'.")
    A(F, "API Media: flag/unflag/remove/restore và các 409", "Chức năng", "Cao", APIM + " " + SEED_MED,
      ["unflag tệp đang active -> 409", "flag {reason:'Inappropriate'} -> 200 (reports=1)", "flag lần 2 -> 409", "unflag -> 200", "remove {reason:'Malware'} -> 200 (url=null)", "remove lần 2 -> 409", "flag tệp đã gỡ -> 409", "restore -> 200", "flag thiếu reason -> 400"], "budget-preview.png (key 50871a26495c5339209f99291851d627.png)",
      "Đúng mã/trạng thái từng bước; remove -> status 'removed', url=null; restore -> 'active'; audit đủ media.flag/unflag/remove/restore (targetType=media, targetId=key).")
    A(F, "Tệp bị gỡ: /api/files/<key> 404, biến mất khỏi /me/uploads, admin vẫn tải được; khôi phục phục vụ lại", "Chức năng", "Cao", BASE2 + " " + LOGIN + " Cần tệp THẬT: member1@sofinhub.test upload (presign + PUT 40 byte PNG, purpose post_image) rồi lấy key. " + MUTATE,
      ["GET /api/files/<key> (200)", "Admin POST /content/media/<key>/remove {reason:'Malware'}", "GET /api/files/<key>", "member1: GET /api/me/uploads", "Admin GET /api/admin/content/media/<key>/download với Bearer admin", "Admin restore, GET /api/files/<key>"], "tệp upload mới",
      "Sau remove: /api/files/<key> = 404; /me/uploads KHÔNG liệt kê tệp; download admin = 200 đúng dung lượng (kể cả tệp đã gỡ); download không token = 401; sau restore /api/files/<key> = 200 trở lại; chủ tệp có thông báo 'File của bạn đã bị gỡ'.", pw="Một phần")
    A(F, "API Media: download trả 404 'File không còn trong storage' cho tệp seed và 401/403 theo quyền", "Bảo mật", "Trung bình", API + " " + SEED_MED,
      ["GET /api/admin/content/media/7e67c7a1b47e2661c431b37641431f15.pdf/download (Bearer admin)", "Cùng URL không token", "Cùng URL với token member1"], "-",
      "Admin: 404 NOT_FOUND 'File không còn trong storage' (seed không có tệp vật lý); không token 401; member1 403.")

    # ============================================================ 8. THANH TOÁN - GIAO DỊCH
    FEE = ("Công thức phí (PLATFORM_COMMISSION_PCT=10, GATEWAY_FEE_PCT=2.9, GATEWAY_FEE_FIXED_CENTS=30): phí nền tảng = 10% × (số tiền − đã hoàn); phí cổng = 2,9% × số tiền + 30¢ (làm tròn như SQL); creator nhận = số tiền − đã hoàn − phí nền tảng − phí cổng; giao dịch chưa thành công = 0. "
           "Ví dụ: $49 -> phí NT $4,90, phí cổng $1,72, creator $42,38; $99 -> $9,90 / $3,17 / $85,93; $29 -> $2,90 / $1,14 / $24,96; $79 -> $7,90 / $2,59 / $68,51; $19 -> $1,90 / $0,85 / $16,25. " + PENDING_DECISION + " hoa hồng/phí cổng chưa chốt (PLAN câu hỏi #6).")
    F = "Thanh toán · Giao dịch (UI)"
    A(F, "Trang Giao dịch: tiêu đề, chip 7/30/90 ngày (mặc định 30) và 5 KPI", "Giao diện", "Cao", UI + " " + SEED_TX,
      ["Mở /admin/payments/tx", "Quan sát nhóm chip khoảng thời gian và 5 thẻ KPI", "Đối chiếu GET /api/admin/payments/transactions/summary?from=<hôm nay − 30 ngày>"], "-",
      "Tiêu đề 'Giao dịch' (phụ đề 'Mọi giao dịch được xử lý trên nền tảng.'); chip '7 ngày/30 ngày/90 ngày' chọn sẵn 30; KPI: 'Tổng giá trị giao dịch', 'Doanh thu thuần' (= tổng phí nền tảng), 'Giao dịch', 'Thất bại' (hiển thị '<n>%' + ghi chú '<k> giao dịch', màu đỏ), 'Hoàn tiền' (màu đỏ); giá trị khớp API summary theo cùng from.")
    A(F, "Đổi chip 7/30/90 ngày cập nhật cả KPI và bảng theo cùng from", "Chức năng", "Cao", UI + " " + SEED_TX,
      ["Bấm chip '7 ngày', ghi KPI 'Giao dịch' và số dòng tổng của bảng", "Bấm '90 ngày' và ghi lại"], "-",
      "Chip gửi from = yyyy-mm-dd (hôm nay trừ n ngày) cho cả summary lẫn danh sách: 7 ngày chỉ còn giao dịch gần (≈20 giao dịch, 9 thất bại -> '45%'); 90 ngày nhiều hơn 30 ngày; KPI 'Giao dịch' luôn bằng tổng bản ghi của bảng; bảng về trang 1.")
    A(F, "Bảng Giao dịch: cột và định dạng tiền/ngày/phương thức", "Giao diện", "Trung bình", UI + " " + SEED_TX + " " + FEE,
      ["Chip '90 ngày', ô tìm kiếm gõ 'TXN-F699FA13'"], "TXN-F699FA13",
      "1 dòng: Mã (font mono) TXN-F699FA13; Khách hàng 'Liam Nguyen' + email; Cộng đồng 'Pixel Pro'; Sản phẩm 'Membership · Monthly'; Số tiền $99.00; Phí nền tảng $9.90; Creator nhận $85.93; Phương thức 'VNPay'; Trạng thái 'Thành công' (xanh); Ngày dạng '<ngày giờ>'.")
    A(F, "Dòng giao dịch gia hạn hiển thị 'Membership · Renewal'", "Giao diện", "Thấp", UI + " " + SEED_TX,
      ["Lọc 'Loại' = 'Gia hạn'"], "kind=renewal", "Chỉ còn giao dịch gia hạn; cột Sản phẩm = 'Membership · Renewal'.")
    A(F, "Tìm kiếm Giao dịch theo mã TXN, mã hóa đơn INV, email/tên khách, cộng đồng, mã cổng", "Chức năng", "Cao", UI + " " + SEED_TX,
      ["Chip '90 ngày'. Gõ 'TXN-763C9F36'", "Gõ 'INV-2026-900064'", "Gõ 'maya'", "Gõ 'Pixel'", "Gõ 'mock_ch_seed_1'"], "TXN-763C9F36 | INV-2026-900064 | maya | Pixel | mock_ch_seed_1",
      "Lần 1 và 2: đúng TXN-763C9F36 (Ava, pixel-pro, $99); lần 3: các giao dịch của Maya Chen (6); lần 4: các giao dịch của cộng đồng Pixel Pro (17 khi bỏ giới hạn chip); lần 5: giao dịch có gatewayChargeId 'mock_ch_seed_1'. Bảng về trang 1 sau mỗi lần gõ.")
    A(F, "Lọc theo Trạng thái: Thành công / Thất bại / Đang chờ / Đã hoàn tiền", "Chức năng", "Cao", UI + " " + SEED_TX,
      ["Chip '90 ngày'. Lọc 'Trạng thái' lần lượt 4 giá trị", "Lọc kết hợp 'Thất bại' + 'Loại' = 'Lần đầu'"], "-",
      "'Đang chờ': 2 dòng (TXN-70F1FA03, TXN-E2DB5581); 'Thất bại': 9 dòng; 'Đã hoàn tiền': 3 dòng (TXN-BE8C2E88, TXN-E9A88057, TXN-EFAAEA9E); kết hợp thất bại + lần đầu: 3 dòng (TXN-5ECCCEFC, TXN-6134AE3A, TXN-EDCA0F1F).")
    A(F, "Lọc theo Phương thức thanh toán (Stripe/VNPay/MoMo)", "Chức năng", "Trung bình", UI + " " + SEED_TX,
      ["Lọc lần lượt 'Stripe', 'VNPay', 'MoMo'"], "-", "Mỗi lần cột 'Phương thức' chỉ có đúng nhãn đã chọn; ví dụ MoMo chứa TXN-70F1FA03, TXN-6134AE3A, TXN-BE8C2E88.")
    A(F, "Sắp xếp Giao dịch: mới nhất (mặc định), Cũ nhất, Số tiền cao nhất", "Chức năng", "Trung bình", UI + " " + SEED_TX,
      ["Chip '90 ngày'", "Chọn 'Cũ nhất'", "Chọn 'Số tiền cao nhất'", "'Xóa bộ lọc'"], "-",
      "Cũ nhất: ngày tăng dần; Số tiền cao nhất: các giao dịch $99 lên đầu rồi $79, $49...; 'Xóa bộ lọc' về mới nhất.")
    A(F, "Phân trang Giao dịch 20 dòng/trang và sang trang 2, trang cuối", "Chức năng", "Trung bình", UI + " " + SEED_TX,
      ["Chip '90 ngày' (≈110 dòng)", "Bấm 'Trang sau' liên tục tới trang cuối"], "-", "Trang 1 có 20 dòng; trang cuối có số dòng còn lại (≈10); 'Trang sau' bị vô hiệu ở trang cuối; tổng trang = ceil(tổng/20).")
    A(F, "Trạng thái rỗng / tải / lỗi của bảng Giao dịch", "Giao diện", "Trung bình", UI,
      ["Gõ 'zzzkhongco' vào ô tìm", "Chặn /api/admin/payments/transactions rồi F5, bỏ chặn, bấm 'Thử lại'"], "-", "Rỗng: 'Không có kết quả phù hợp.'; đang tải: 'Đang tải…'; lỗi: khối lỗi + nút 'Thử lại' tải lại được.", pw="Một phần")
    A(F, "Menu dòng Giao dịch: 'Xem' luôn có; 'Hoàn tiền' chỉ khi Thành công", "Chức năng", "Cao", UI + " " + SEED_TX,
      ["Menu dòng TXN-763C9F36 (Thành công)", "Menu TXN-5ECCCEFC (Thất bại)", "Menu TXN-BE8C2E88 (Đã hoàn)", "Menu TXN-70F1FA03 (Đang chờ)"], "-",
      "Thành công: Xem, Hoàn tiền; Thất bại/Đã hoàn/Đang chờ: chỉ 'Xem'. Bấm cả dòng mở /admin/payments/tx/<id>.")
    A(F, "Chi tiết giao dịch thành công: KPI, 3 thẻ thông tin, chi tiết thanh toán, dòng thời gian", "Giao diện", "Cao", UI + " " + SEED_TX,
      ["Mở chi tiết TXN-763C9F36"], "TXN-763C9F36",
      "Tiêu đề TXN-763C9F36, phụ đề 'Membership · Monthly · Pixel Pro', breadcrumb 'Giao dịch'. KPI: Số tiền $99.00, Phí nền tảng $9.90, Creator nhận $85.93, Phương thức 'Stripe'. Thẻ 'Thông tin giao dịch' (Mã, Trạng thái 'Thành công', Ngày, Sản phẩm, Cộng đồng, Tiền tệ USD); "
      "'Khách hàng' (Ava Johnson, email, Mã người dùng 8 ký tự, Tham gia, Trạng thái tài khoản 'active'; link 'Mở hồ sơ' -> /admin/users/<id>?tab=purchases); 'Creator' (Chủ sở hữu Emma Garcia; link 'Mở cộng đồng'); 'Chi tiết thanh toán' (Cổng 'Stripe (mock)', Mã tham chiếu mock_ch_seed_..., Hóa đơn INV-2026-900064, Phí cổng $3.17, Đã hoàn $0.00); "
      "'Dòng thời gian thanh toán' có 'Bắt đầu thanh toán' và 'Đã thu tiền'; có thẻ 'Hoàn tiền & tranh chấp' với RF-1542230F trạng thái 'Yêu cầu mới' (link 'Xem'); có nút 'Hoàn tiền' (đỏ).")
    A(F, "Chi tiết giao dịch thất bại: lý do, nút 'Thử lại', timeline 'Thanh toán thất bại', creator nhận $0", "Giao diện", "Cao", UI + " " + SEED_TX,
      ["Mở chi tiết TXN-5ECCCEFC"], "TXN-5ECCCEFC",
      "Trạng thái 'Thất bại'; 'Lý do thất bại' = processing_error trong 'Chi tiết thanh toán'; Hóa đơn '—'; Phí nền tảng $0.00, Creator nhận $0.00; timeline có 'Thanh toán thất bại'; có nút 'Thử lại' (xanh) và KHÔNG có 'Hoàn tiền'.")
    A(F, "Chi tiết giao dịch đã hoàn một phần/toàn phần: số liệu phí sau hoàn tiền", "Chức năng", "Cao", UI + " " + SEED_TX + " " + FEE,
      ["Mở chi tiết TXN-E9A88057 (hoàn một phần)", "Mở TXN-BE8C2E88 (hoàn đủ)"], "TXN-E9A88057, TXN-BE8C2E88",
      "TXN-E9A88057 ($79, đã hoàn $39.50): Phí nền tảng $3.95 (10% của $39.50), phí cổng $2.59, Creator nhận $32.96; có 'Đã hoàn tiền' trong timeline và RF-E3DF8C52 'Hoàn tất'. TXN-BE8C2E88 ($99 hoàn đủ): Phí nền tảng $0.00, Creator nhận −$3.17 (âm = đúng phí cổng không được hoàn - hành vi theo công thức hiện tại), "
      "không còn nút 'Hoàn tiền'. " + PENDING_DECISION + " cách tính phí cổng khi hoàn tiền chưa chốt.")
    A(F, "Chi tiết giao dịch có tranh chấp liệt kê CB và nhãn lý do", "Chức năng", "Trung bình", UI + " " + SEED_TX + " " + SEED_CB,
      ["Mở chi tiết TXN-EFAAEA9E (đã hoàn, có tranh chấp Noah 'Gian lận' đã thua)"], "TXN-EFAAEA9E",
      "Thẻ 'Hoàn tiền & tranh chấp' có RF-F7E223A6 ('Hoàn tất') và 1 tranh chấp 'CB-000nn · $49.00 · Gian lận' trạng thái 'Thua'; timeline có 'Tranh chấp thanh toán' và 'Đã hoàn tiền'.")
    A(F, "Chi tiết giao dịch: mã không tồn tại hiện khối lỗi", "Giao diện", "Thấp", UI, ["Mở http://localhost:5173/admin/payments/tx/khong-ton-tai"], "khong-ton-tai", "Khối lỗi 'Không tìm thấy giao dịch' (404) + nút 'Thử lại'; không màn trắng.")
    A(F, "Hoàn tiền từ bảng: modal có số tiền mặc định bằng phần còn lại, 8 lý do, validate số tiền", "Chức năng", "Cao", UIM + " " + SEED_TX,
      ["Chip '90 ngày', menu dòng TXN-E8AF54EA ($99) > 'Hoàn tiền'", "Quan sát ô 'Số tiền hoàn (USD)'", "Nhập 0, 99.01, abc, 12.345, 50", "Xem danh sách lý do"], "TXN-E8AF54EA",
      "Tiêu đề 'Hoàn tiền TXN-E8AF54EA?'; 'Còn có thể hoàn tối đa $99.00. Thao tác được ghi vào nhật ký.'; số tiền mặc định 99.00; 0, 99.01, 'abc', '12.345' -> thông báo đỏ 'Nhập số tiền từ $0.01 đến $99.00.' và nút khóa; 50 hợp lệ; 8 lý do: Bị trừ tiền 2 lần, Không sử dụng sản phẩm, Nội dung không như mô tả, Mua nhầm, Đã hủy nhưng vẫn bị trừ tiền, Lỗi kỹ thuật, Đổi ý, Trùng tài khoản; lý do bắt buộc.")
    A(F, "Hoàn tiền một phần từ bảng: trạng thái, KPI và thông báo khách", "Chức năng", "Cao", UIM + " " + SEED_TX,
      ["Hoàn TXN-E8AF54EA số tiền 40.00, lý do 'Đổi ý', ghi chú 'QA một phần'", "Quan sát toast, dòng và KPI 'Hoàn tiền'", "Mở chi tiết giao dịch", "Đăng nhập ethan@ xem thông báo"], "40.00 USD",
      "Toast 'Đã hoàn tiền giao dịch'; dòng 'Đã hoàn tiền' (partial vẫn mang trạng thái refunded); KPI 'Hoàn tiền' +$40.00; chi tiết: 'Đã hoàn $40.00', Phí nền tảng 10% × $59 = $5.90; có RF mới 'Hoàn tất' số tiền $40.00; audit payment.refund (amountCents=4000, paymentAmountCents=9900); Ethan nhận thông báo 'Hoàn tiền thành công' ($40.00); nút 'Hoàn tiền' biến mất (không hoàn tiếp phần còn lại - hành vi hiện tại).")
    A(F, "Hoàn tiền toàn phần giao dịch lẻ: trạng thái và KHÔNG thu hồi quyền vì không có gói", "Chức năng", "Trung bình", UIM + " " + SEED_TX,
      ["Hoàn TXN-84E9A3BA ($29, Ava, code-camp) toàn bộ, lý do 'Mua nhầm'", "Đăng nhập ava@ kiểm tra GET /api/courses/code-camp/posts"], "TXN-84E9A3BA",
      "Dòng 'Đã hoàn tiền', Đã hoàn $29.00, Creator nhận −$1.14; vì giao dịch lẻ (không gắn gói) nên Ava vẫn là thành viên code-camp (thu hồi quyền chỉ xảy ra khi giao dịch là kỳ hiện tại của một gói).")
    A(F, "Giao dịch có yêu cầu hoàn tiền đang chờ: Hoàn tiền trực tiếp báo 409 trong modal", "Chức năng", "Trung bình", UIM + " " + SEED_TX,
      ["Menu TXN-763C9F36 (có RF-1542230F đang chờ) > 'Hoàn tiền' > chọn lý do > xác nhận"], "TXN-763C9F36",
      "Modal không đóng, hiện 'Giao dịch này đang có yêu cầu hoàn tiền chờ xử lý — hãy duyệt ở mục Refunds' (409); không đổi dữ liệu.")
    A(F, "Thử lại thanh toán thất bại lần đầu: thành công kích hoạt gói + cấp hóa đơn", "Chức năng", "Cao", UIM + " " + SEED_TX,
      ["Mở chi tiết TXN-EDCA0F1F (Ethan, fit-forever, $79, expired_card)", "Bấm 'Thử lại' > ghi chú 'Khách đổi thẻ' > 'Thử lại'", "Quan sát toast và trạng thái", "Mở /admin/payments/subs tìm 'Ethan'"], "TXN-EDCA0F1F",
      "Modal 'Thử lại thanh toán?' ('Cổng thanh toán sẽ được gọi lại.'); toast 'Đã gửi yêu cầu thử lại'; mock gateway luôn thành công -> trạng thái 'Thành công', có hóa đơn INV-..., Ethan được cấp quyền fit-forever và có gói 'Hoạt động' mới; audit payment.retry (metadata.result=succeeded); nút 'Thử lại' biến mất, xuất hiện 'Hoàn tiền'. [GATEWAY MOCK - chưa tích hợp cổng thật]")
    A(F, "Thử lại giao dịch gia hạn thất bại báo 409 (gia hạn do hệ thống tự chạy)", "Chức năng", "Trung bình", API + " " + SEED_TX,
      ["GET /payments/transactions?status=failed&kind=renewal (ví dụ TXN-39DFEEE3 Maya)", "POST /payments/transactions/<id>/retry {}"], "TXN-39DFEEE3",
      "409 'Chỉ thử lại được giao dịch thanh toán lần đầu; gia hạn do hệ thống tự chạy'; trong UI chi tiết TXN-39DFEEE3 KHÔNG hiển thị nút 'Thử lại' (chỉ khi kind=initial).")

    F = "Thanh toán · Giao dịch (API)"
    A(F, "GET /payments/transactions/summary: số liệu và from/to; from tương lai cho 0", "Chức năng", "Cao", API + " " + SEED_TX,
      ["GET /payments/transactions/summary", "GET /payments/transactions/summary?from=2999-01-01", "GET .../summary?from=not-a-date", "GET .../summary?from=2026-10-01&to=2026-09-01"], "-",
      "Lần 1 (seed sạch): {grossVolumeCents:458900, netRevenueCents:43825, transactions:112, failed:9, failedRatePct:8, refundsCents:20650}; lần 2: transactions=0, failedRatePct=0; lần 3: 400; lần 4: 400 ('`from` phải trước `to`'). Ngày dạng YYYY-MM-DD cho `to` tính hết ngày đó.")
    A(F, "GET /payments/transactions: lọc status/method/kind/courseId/userId/ownerId, q, sort, 400", "Chức năng", "Cao", API + " " + SEED_TX,
      ["GET /payments/transactions?courseId=pixel-pro&status=succeeded&method=stripe", "GET ...?ownerId=<id Emma>&status=failed", "GET ...?q=TXN-763C9F36", "GET ...?q=INV-2026-900064", "GET ...?sort=amount&limit=3",
       "GET ...?status=bogus", "GET ...?method=paypal", "GET ...?kind=other", "GET ...?from=not-a-date", "GET ...?sort=bogus"], "-",
      "Lọc ra đúng tập con; sort=amount ra $99 trước; q theo mã/hóa đơn ra TXN-763C9F36; status/method/kind/from/sort sai -> 400. Phần tử có code TXN-[0-9A-F]{8}, product.label, amountCents, refundedCents, platformFeeCents, gatewayFeeCents, creatorEarningsCents, customer, community{id,name,ownerName}.")
    A(F, "Công thức phí trên API khớp bảng ví dụ (theo env PLATFORM_COMMISSION_PCT, GATEWAY_FEE_*)", "Chức năng", "Cao", API + " " + SEED_TX + " " + FEE,
      ["GET /payments/transactions?q=TXN-F699FA13", "GET ...?q=TXN-E9A88057", "GET ...?q=TXN-5ECCCEFC", "Đổi PLATFORM_COMMISSION_PCT=15 trong backend/.env, restart BE, gọi lại lần 1"], "TXN-F699FA13, TXN-E9A88057, TXN-5ECCCEFC",
      "F699FA13: amount 9900, platformFee 990, gatewayFee 317, creatorEarnings 8593. E9A88057 (refunded 3950): platformFee 395, gatewayFee 259, creatorEarnings 3296. 5ECCCEFC (failed): cả 3 = 0. Với PCT=15: platformFee 1485, creatorEarnings 8098 (chứng minh phí đọc từ env). " + PENDING_DECISION, pw="Một phần")
    A(F, "GET /payments/transactions/:id: chi tiết, timeline, gateway, 404", "Chức năng", "Cao", API + " " + SEED_TX,
      ["Lấy id của TXN-763C9F36 từ danh sách", "GET /payments/transactions/<id>", "GET /payments/transactions/nope"], "TXN-763C9F36",
      "200: gateway 'Stripe (mock)', gatewayChargeId 'mock_ch_seed_...', customerInfo {joinedAt,status}, creator = Emma Garcia, subscription=null (giao dịch lẻ), refunds[1] (RF-1542230F pending), chargebacks[], timeline có checkout + payment_captured, history; nope: 404 'Không tìm thấy giao dịch'.")
    A(F, "POST /payments/transactions/:id/refund: validate, 409, hoàn một phần/toàn phần, audit", "Chức năng", "Cao", APIM + " " + SEED_TX,
      ["POST .../refund {} -> 400", "{reason:'x', amountCents:999999} -> 400", "{reason:'Goodwill', amountCents:1000} trên TXN-E8AF54EA -> 200", "lần 2 trên giao dịch đó -> 409", "refund giao dịch đã hoàn/đang chờ/thất bại -> 409", "refund id 'nope' -> 404"], "TXN-E8AF54EA",
      "200 {transaction:{status:'refunded',refundedCents:1000}, refund:{status:'approved',amountCents:1000,code:'RF-...'}}; lần 2 409 'Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền'; giao dịch có RF đang chờ 409; nope 404; audit payment.refund (reason, metadata.amountCents). Bỏ qua cửa sổ hoàn tiền REFUND_WINDOW_DAYS. " + PENDING_DECISION + " cửa sổ hoàn tiền (7 ngày) chưa chốt.")
    A(F, "Hoàn tiền toàn phần giao dịch kỳ hiện tại của gói thật: hủy gói và thu hồi quyền", "Chức năng", "Cao", BASE2 + " " + LOGIN + " Tạo giao dịch thật: newbie@sofinhub.test POST /api/courses/growth-lab/checkout {\"method\":\"stripe\"} -> 201 {id}; POST /api/payments/<id>/confirm -> 200. " + MUTATE,
      ["Admin POST /payments/transactions/<id>/refund {reason:'Duplicate charge'} (hoàn đủ)", "newbie@: GET /api/courses/growth-lab/posts", "Admin: GET /payments/subscriptions?q=Nam"], "giao dịch newbie growth-lab $49",
      "Giao dịch 'refunded' refundedCents=4900; gói của newbie chuyển 'canceled' và enrollment bị xóa (GET posts -> 403); newbie nhận thông báo 'Hoàn tiền thành công'. LƯU Ý: với giao dịch SEED việc hoàn toàn bộ chỉ đánh dấu Payment=refunded, KHÔNG hủy gói (mốc kỳ lệch mili-giây hoặc giao dịch không gắn gói) - dùng giao dịch checkout thật để kiểm tra thu hồi quyền.", pw="Một phần")
    A(F, "POST /payments/transactions/:id/retry: thành công kích hoạt gói; 409 khi không phải failed", "Chức năng", "Cao", APIM + " " + SEED_TX,
      ["POST .../TXN-6134AE3A(id)/retry {note:'QA'} -> 200", "lần 2 -> 409", "retry giao dịch 'Thành công' -> 409", "retry id 'nope' -> 404"], "TXN-6134AE3A",
      "Lần 1: 200 status 'succeeded' (mock gateway luôn thành công), invoiceNumber được cấp; lần 2 và giao dịch succeeded: 409 'Chỉ giao dịch thất bại mới thử lại được'; nope 404; audit payment.retry metadata.result='succeeded'. Mô phỏng cổng từ chối lần 2 chưa test được từ giao diện/seed (cần failFor trong test tự động).", pw="Một phần")

    # ============================================================ 9. THANH TOÁN - GÓI ĐĂNG KÝ
    F = "Thanh toán · Gói đăng ký"
    A(F, "Trang Gói đăng ký: 5 KPI (Hoạt động, Mới, MRR, Tỷ lệ rời bỏ, Quá hạn) và tab có đếm", "Giao diện", "Cao", UI + " " + SEED_SUB,
      ["Mở /admin/payments/subs", "Đọc KPI và 5 tab", "Đối chiếu /payments/subscriptions/summary"], "-",
      "Tiêu đề 'Gói đăng ký' (phụ đề 'Gói thành viên định kỳ trên mọi cộng đồng.'); KPI 'Hoạt động' 30, 'Mới' 14 (ghi chú '30 ngày qua'), 'MRR' $1,132.00, 'Tỷ lệ rời bỏ' 26.8%, 'Quá hạn' 6 (đỏ); tab: Tất cả, Hoạt động (30), Quá hạn (6), Tạm dừng (4), Đã hủy. MRR = tổng giá gói 'active' không đặt hủy cuối kỳ; churn = (đã hủy+hết hạn 30 ngày)/(đang hoạt động + đó).")
    A(F, "Tab 'Hoạt động' đếm 30 (chỉ active) nhưng bảng liệt kê cả gói dùng thử (35 dòng)", "Chức năng", "Thấp", UI + " " + SEED_SUB,
      ["Bấm tab 'Hoạt động' (key active,trialing)", "So số đếm trên tab với tổng số dòng"], "-",
      "KỲ VỌNG SAU KHI SỬA: số đếm trên tab bằng số dòng. HIỆN TẠI: tab hiển thị 30 (summary.active) nhưng bảng gồm active + trialing = 35 dòng. Ghi nhận như điểm lệch nhỏ giữa nhãn đếm và danh sách.", st=PLAN)
    A(F, "Bảng Gói đăng ký: cột, nhãn trạng thái và 'Hủy cuối kỳ'", "Giao diện", "Trung bình", UI + " " + SEED_SUB,
      ["Gõ 'SUB-651D6D23' (Maya, quá hạn)", "Gõ 'Mai' rồi tìm gói paid-demo 'Hủy cuối kỳ' (gói cũ của member2)"], "SUB-651D6D23",
      "SUB-651D6D23: Người dùng 'Maya Chen', Cộng đồng 'Growth Lab', Gói 'Trả phí', Số tiền $49.00, Chu kỳ 'Hàng tháng', Kỳ tới '—' hoặc ngày, Trạng thái 'Quá hạn' (cam). Gói đang hoạt động đã đặt hủy cuối kỳ có dòng phụ 'Hủy cuối kỳ' dưới badge 'Hoạt động'. Trạng thái khác: 'Dùng thử', 'Tạm dừng', 'Đã hủy', 'Hết hạn'.")
    A(F, "Tìm Gói đăng ký theo mã SUB, tên/email người dùng, tên cộng đồng", "Chức năng", "Trung bình", UI + " " + SEED_SUB,
      ["Gõ 'SUB-41FC386C'", "Gõ 'sophia'", "Gõ 'Mindful'"], "SUB-41FC386C | sophia | Mindful", "Lần 1: gói dùng thử của Sophia ở growth-lab; lần 2: các gói của Sophia Patel (4+); lần 3: các gói Mindful Money.")
    A(F, "Tab 'Quá hạn', 'Tạm dừng', 'Đã hủy' trả đúng gói seed", "Chức năng", "Cao", UI + " " + SEED_SUB,
      ["Bấm tab 'Quá hạn'", "Bấm tab 'Tạm dừng'", "Bấm tab 'Đã hủy' (canceled,expired)"], "-",
      "Quá hạn: 6 gói (gồm Maya/growth-lab); Tạm dừng: 4 gói (Maya/code-camp, Ava/fit-forever, Alex+Lucas/mindful-money); Đã hủy: 11 gói (7 đã hủy + 4 hết hạn).")
    A(F, "Sắp xếp Gói đăng ký: Số tiền cao nhất, Kỳ thanh toán gần nhất", "Chức năng", "Thấp", UI,
      ["Chọn 'Số tiền cao nhất'", "Chọn 'Kỳ thanh toán gần nhất'"], "-", "Số tiền: $99 (Pixel Pro) trước; 'Kỳ thanh toán gần nhất' sắp currentPeriodEnd tăng dần.")
    A(F, "Menu dòng Gói: Xem/Tạm dừng/Tiếp tục/Hủy theo trạng thái", "Chức năng", "Cao", UI + " " + SEED_SUB,
      ["Menu SUB-19663020 (active)", "SUB-651D6D23 (past_due)", "SUB-91A2D0F6 (paused)", "SUB-38AA4938 (canceled)", "SUB-41FC386C (trialing)"], "-",
      "active: Xem, Tạm dừng, Hủy. past_due: Xem, Tạm dừng, Tiếp tục, Hủy. paused: Xem, Tiếp tục, Hủy. canceled/expired: chỉ Xem. trialing: Xem, Tạm dừng, Hủy. 'Xem' mở /admin/users/<id người dùng>?tab=purchases.")
    A(F, "Tạm dừng gói: modal, toast, trạng thái, thu hồi quyền, thông báo, audit", "Chức năng", "Cao", UIM + " " + SEED_SUB + " Đăng nhập daniel@sofinhub.test (thành viên growth-lab).",
      ["Menu SUB-5BC76879 (Daniel, growth-lab) > 'Tạm dừng'", "Chọn lý do 'Rủi ro thanh toán', ghi chú 'QA' > 'Tạm dừng'", "daniel@: GET /api/courses/growth-lab/posts và GET /api/me/subscriptions", "Admin tra audit 'subscription.pause'"], "SUB-5BC76879",
      "Modal 'Tạm dừng gói đăng ký?'; toast 'Đã tạm dừng gói đăng ký'; badge 'Tạm dừng', 'Kỳ thanh toán tới' '—' (không gia hạn), KPI 'Hoạt động' −1, tab 'Tạm dừng' +1; Daniel mất quyền (GET posts -> 403), /me/subscriptions báo 'paused'; thông báo 'Gói thành viên bị tạm dừng' kèm lý do; audit subscription.pause (metadata from=active,to=paused,community).")
    A(F, "Tiếp tục gói: cấp lại quyền, mở kỳ mới nếu kỳ cũ đã hết", "Chức năng", "Cao", UIM + " " + SEED_SUB,
      ["Menu SUB-91A2D0F6 (Maya, code-camp, paused, kỳ cũ đã hết) > 'Tiếp tục' > xác nhận", "maya@: GET /api/courses/code-camp/posts"], "SUB-91A2D0F6",
      "Toast 'Đã tiếp tục gói đăng ký'; trạng thái 'Hoạt động', currentPeriodStart=bây giờ, currentPeriodEnd = +SUBSCRIPTION_PERIOD_DAYS (30) ngày; Maya được cấp lại quyền; thông báo 'Gói thành viên đã hoạt động lại'; audit subscription.resume.")
    A(F, "Tiếp tục gói quá hạn (past_due) -> active", "Chức năng", "Trung bình", UIM + " " + SEED_SUB,
      ["Menu SUB-651D6D23 (Maya, growth-lab, past_due) > 'Tiếp tục' > xác nhận"], "SUB-651D6D23", "Trạng thái 'Hoạt động'; KPI 'Quá hạn' −1, 'Hoạt động' +1; Maya có quyền growth-lab.")
    A(F, "Hủy gói TỨC THÌ (không tích 'cuối kỳ'): trạng thái Đã hủy, thu hồi quyền, thông báo", "Chức năng", "Cao", UIM + " " + SEED_SUB,
      ["Menu SUB-A9B9B1B1 (Ava, growth-lab) > 'Hủy'", "Giữ nguyên checkbox 'Chỉ hủy vào cuối kỳ...' BỎ TÍCH (mặc định)", "Chọn lý do 'Gian lận' > 'Hủy gói'", "ava@ kiểm tra thông báo + quyền"], "SUB-A9B9B1B1",
      "Modal 'Hủy gói đăng ký?' ('Người dùng sẽ được thông báo.'); toast 'Đã hủy gói đăng ký'; trạng thái 'Đã hủy' (tab 'Hoạt động' −1, 'Đã hủy' +1); Ava mất quyền growth-lab; thông báo 'Gói thành viên của bạn ... đã bị hủy bởi quản trị viên'; audit subscription.cancel.")
    A(F, "Hủy gói CUỐI KỲ: vẫn Hoạt động, nhãn 'Hủy cuối kỳ', giữ quyền, ngừng gia hạn", "Chức năng", "Cao", UIM + " " + SEED_SUB,
      ["Menu SUB-B2BD1B76 (Lucas, growth-lab) > 'Hủy'", "TÍCH 'Chỉ hủy vào cuối kỳ hiện tại (giữ quyền truy cập đến hết kỳ)'", "Chọn lý do 'Theo yêu cầu thành viên' > xác nhận", "Quan sát dòng; thử 'Hủy' lần 2 trên dòng đó"], "SUB-B2BD1B76",
      "Trạng thái vẫn 'Hoạt động' nhưng có dòng phụ 'Hủy cuối kỳ'; 'Kỳ thanh toán tới' '—'; KPI MRR giảm $49 (gói đặt hủy cuối kỳ không tính MRR); quyền truy cập giữ nguyên; audit subscription.cancel_at_period_end; thông báo 'Gói thành viên sẽ kết thúc cuối kỳ'; lần hủy cuối kỳ thứ 2 -> 409 'Gói đã được đặt hủy cuối kỳ' hiện trong modal.")
    A(F, "Tab 'Hủy' trên gói đã canceled/expired không còn nút; cancel API trả 409 'Gói đã kết thúc'", "Chức năng", "Thấp", API + " " + SEED_SUB, ["POST /payments/subscriptions/<id SUB-38AA4938>/cancel {reason:'x'}", "POST .../SUB-3DFC5C1A/pause {reason:'x'}"], "SUB-38AA4938, SUB-3DFC5C1A",
      "Cancel gói đã hủy: 409 'Gói đã kết thúc'; pause gói hết hạn: 409 'Chỉ tạm dừng được gói đang hoạt động'.")
    A(F, "API Gói đăng ký: list/summary/detail (payments[]), lọc status, sort, 400/404", "Chức năng", "Cao", API + " " + SEED_SUB,
      ["GET /payments/subscriptions/summary", "GET /payments/subscriptions?status=past_due,paused", "GET /payments/subscriptions?courseId=growth-lab&sort=amount", "GET /payments/subscriptions/<id SUB-19663020>", "GET ...?status=bogus", "GET ...?sort=bogus", "GET /payments/subscriptions/nope"], "-",
      "summary có active,new30d,mrrCents,churnPct,pastDue,paused; lọc past_due,paused ra 10 gói; chi tiết có payments (<=10, ở đây 2: initial + renewal) + history, nextBillingAt, plan 'paid'; status/sort lạ 400; nope 404 'Không tìm thấy gói thành viên'.")
    A(F, "API pause/resume/cancel: 400 thiếu lý do, 409 sai trạng thái, 404, cancelAtPeriodEnd", "Chức năng", "Cao", APIM + " " + SEED_SUB,
      ["pause {} -> 400", "pause {reason:'Payment risk'} -> 200 status 'paused', nextBillingAt=null", "pause lần 2 -> 409", "resume -> 200 'active'", "resume lần 2 -> 409", "cancel {reason:'Customer asked',atPeriodEnd:true} -> 200 active + cancelAtPeriodEnd=true", "cancel cuối kỳ lần 2 -> 409", "cancel {reason:'Fraud'} -> 'canceled'", "cancel lần 2 -> 409", "cancel id nope -> 404"], "SUB-5BC76879",
      "Đúng từng mã/trạng thái; sau cancel cuối kỳ nextBillingAt=null; audit đủ: subscription.pause, .resume, .cancel_at_period_end, .cancel; resume bị 409 nếu người dùng đang bị cấm khỏi cộng đồng ('Người dùng đang bị cấm khỏi cộng đồng này').")

    # ============================================================ 10. THANH TOÁN - HOÀN TIỀN
    F = "Thanh toán · Hoàn tiền (UI)"
    A(F, "Trang Hoàn tiền: tab mặc định 'Yêu cầu mới' và số đếm 3 tab", "Giao diện", "Cao", UI + " " + SEED_RF,
      ["Mở /admin/payments/refunds", "Đọc số đếm tab 'Yêu cầu mới', 'Hoàn tất', 'Đã từ chối'", "Bấm 'Tất cả'"], "-",
      "Tiêu đề 'Hoàn tiền' (phụ đề 'Yêu cầu hoàn tiền từ thành viên.'); mở sẵn tab 'Yêu cầu mới' (5 dòng); số đếm 5 / 4 / 2; 'Tất cả' không có số đếm và hiện 11 dòng; cột: Mã hoàn tiền, Giao dịch, Khách hàng, Creator, Số tiền, Lý do, Trạng thái, Ngày yêu cầu.")
    A(F, "Bảng Hoàn tiền: dữ liệu một dòng, hoàn một phần hiển thị số tiền yêu cầu", "Giao diện", "Trung bình", UI + " " + SEED_RF,
      ["Tab 'Hoàn tất', gõ 'RF-E3DF8C52'"], "RF-E3DF8C52", "Dòng: Mã RF-E3DF8C52, Giao dịch TXN-E9A88057, Khách 'Daniel Park', Creator 'Noah Williams', Số tiền $39.50 (một phần của giao dịch $79), Lý do 'Content not as described', Trạng thái 'Hoàn tất'.")
    A(F, "Tìm Hoàn tiền theo mã RF, mã TXN, khách, chủ cộng đồng, lý do", "Chức năng", "Trung bình", UI + " " + SEED_RF,
      ["Tab 'Tất cả'. Gõ 'RF-1542230F'", "Gõ 'TXN-763C9F36'", "Gõ 'Emma'", "Gõ 'Technical issue'"], "RF-1542230F | TXN-763C9F36 | Emma | Technical issue",
      "Lần 1 và 2: RF-1542230F (Ava); lần 3: yêu cầu của khách Emma Garcia (RF-6FF01B95) và yêu cầu có creator Emma (RF-1542230F, RF-AEB9A758, RF-31968828...); lần 4: RF-6FF01B95.")
    A(F, "Menu dòng Hoàn tiền: pending có Xem xét/Duyệt/Từ chối; còn lại chỉ 'Xem xét'", "Chức năng", "Cao", UI + " " + SEED_RF,
      ["Tab 'Yêu cầu mới', menu RF-1542230F", "Tab 'Hoàn tất', menu RF-31968828"], "-", "pending: Xem xét, Duyệt hoàn tiền, Từ chối (đỏ); approved/rejected: chỉ Xem xét. Bấm dòng/Xem xét mở /admin/payments/refunds/<id>.")
    A(F, "Duyệt hoàn tiền từ bảng (đủ số tiền): modal, toast, trạng thái, thông báo khách", "Chức năng", "Cao", UIM + " " + SEED_RF,
      ["Menu RF-6FF01B95 (Emma, $29) > 'Duyệt hoàn tiền'", "Giữ số tiền 29.00, ghi chú 'QA duyệt' > 'Duyệt hoàn tiền'", "Đăng nhập emma@ xem thông báo", "Mở giao dịch TXN-F49368D6"], "RF-6FF01B95",
      "Modal 'Duyệt hoàn tiền RF-6FF01B95?' ('Yêu cầu $29.00. Tiền được hoàn qua cổng thanh toán và khách hàng được thông báo.'); toast 'Đã duyệt hoàn tiền'; dòng rời tab 'Yêu cầu mới' sang 'Hoàn tất' (đếm 4/5); TXN-F49368D6 thành 'Đã hoàn tiền' với Đã hoàn $29.00; Emma nhận thông báo 'Hoàn tiền thành công' ($29.00); audit refund.approve (metadata requestedCents/refundedCents/partial=false).")
    A(F, "Hoàn một phần từ bảng/chi tiết: số tiền mặc định bằng một nửa và validate", "Chức năng", "Cao", UIM + " " + SEED_RF,
      ["Mở chi tiết RF-71FACC96 (Sarah, $79)", "Bấm 'Hoàn một phần'", "Quan sát số tiền mặc định, nhập 0 / 79.01 / 30", "Xác nhận với 30.00"], "RF-71FACC96",
      "Tiêu đề 'Hoàn tiền một phần RF-71FACC96', mặc định 39.50; 0 và 79.01 -> 'Nhập số tiền từ $0.01 đến $79.00.'; 30.00 hợp lệ -> toast 'Đã duyệt hoàn tiền'; RF 'Hoàn tất' với số tiền $30.00 (không phải $79.00); giao dịch refundedCents=3000 'Đã hoàn tiền'; audit partial=true.")
    A(F, "Từ chối hoàn tiền: bắt buộc lý do (5 lựa chọn), toast, thông báo khách", "Chức năng", "Cao", UIM + " " + SEED_RF,
      ["Menu RF-AEB9A758 (Liam, $99) > 'Từ chối'", "Quan sát nút khi chưa chọn lý do", "Chọn 'Yêu cầu trùng lặp', ghi chú 'QA' > 'Từ chối'", "liam@ xem thông báo"], "RF-AEB9A758",
      "Lý do: Ngoài thời hạn hoàn tiền, Đã sử dụng sản phẩm, Không đủ điều kiện, Yêu cầu trùng lặp, Khác; nút 'Từ chối' khóa tới khi chọn; toast 'Đã từ chối yêu cầu hoàn tiền'; trạng thái 'Đã từ chối' (tab 'Đã từ chối' +1); giao dịch TXN-F699FA13 vẫn 'Thành công'; Liam nhận thông báo 'Yêu cầu hoàn tiền bị từ chối' kèm lý do + ghi chú; audit refund.reject.")
    A(F, "Chi tiết Hoàn tiền: các thẻ Yêu cầu, Lịch sử thanh toán, Lịch sử khách hàng, Quyết định", "Giao diện", "Cao", UI + " " + SEED_RF,
      ["Mở chi tiết RF-1542230F (Ava)"], "RF-1542230F",
      "Tiêu đề 'Hoàn tiền RF-1542230F', phụ đề 'Ava Johnson · Pixel Pro', nút 'Mở giao dịch' (-> /admin/payments/tx/<id>). Thẻ 'Yêu cầu hoàn tiền': Mã, Giao dịch TXN-763C9F36, Số tiền $99.00, Lý do 'Cancelled but charged', Ngày yêu cầu, Trạng thái 'Yêu cầu mới'; "
      "bảng 'Lịch sử thanh toán' (các giao dịch của Ava ở Pixel Pro); 'Lịch sử khách hàng' ('thành viên từ <ngày>', các yêu cầu hoàn tiền trước, 'N báo cáo trên tài khoản này'); khối 'Quyết định của quản trị' có ô ghi chú 'Ghi chú quyết định gửi bộ phận tài chính...' và 3 nút Duyệt hoàn tiền/Hoàn một phần/Từ chối; KHÔNG có thẻ 'Phản hồi của creator' (creatorResponse=null).")
    A(F, "Chi tiết Hoàn tiền đã xử lý: nút bị khóa và hiện 'Trạng thái cuối cùng'", "Giao diện", "Trung bình", UI + " " + SEED_RF,
      ["Mở chi tiết RF-31968828 (Hoàn tất)", "Mở chi tiết RF-65A6E89A (Đã từ chối)"], "RF-31968828, RF-65A6E89A",
      "Cả 3 nút bị vô hiệu, ô ghi chú ẩn, hiển thị 'Trạng thái cuối cùng: Hoàn tất' / 'Trạng thái cuối cùng: Đã từ chối'; thẻ yêu cầu có 'Xử lý bởi' Platform Admin và 'Ghi chú' (Approved: billing error / Outside refund window; content was accessed).")
    A(F, "Ghi chú nhập ở khối Quyết định được chuyển vào modal xác nhận", "Chức năng", "Thấp", UIM + " " + SEED_RF,
      ["Mở chi tiết RF-6FF01B95, gõ ghi chú 'Đã kiểm tra log' ở khối Quyết định", "Bấm 'Duyệt hoàn tiền'"], "Đã kiểm tra log", "Modal mở với 'Ghi chú quyết định' đã điền sẵn 'Đã kiểm tra log'; sau khi duyệt, chi tiết hiển thị 'Ghi chú: Đã kiểm tra log'.")
    A(F, "Duyệt/Từ chối yêu cầu đã xử lý ở tab khác báo 409 trong modal", "Chức năng", "Trung bình", UIM + " " + SEED_RF,
      ["Mở 2 tab, cùng tab 'Yêu cầu mới'", "Tab 1 duyệt RF-AEB9A758", "Tab 2 (chưa tải lại) bấm 'Từ chối' cùng dòng > chọn lý do > xác nhận"], "RF-AEB9A758", "Tab 2 hiện lỗi 'Yêu cầu này đã được xử lý' trong modal, không đổi dữ liệu.", pw="Một phần")

    F = "Thanh toán · Hoàn tiền (API)"
    A(F, "GET /payments/refunds: list/summary, lọc status/courseId, q, sort, 400", "Chức năng", "Cao", API + " " + SEED_RF,
      ["GET /payments/refunds/summary", "GET /payments/refunds?status=pending&courseId=pixel-pro", "GET /payments/refunds?q=RF-1542230F", "GET /payments/refunds?sort=amount&limit=3", "GET /payments/refunds?status=bogus", "GET /payments/refunds?sort=bogus"], "-",
      "summary {pending:5,approved:4,rejected:2,pendingAmountCents:32500,refundedAmountCents:20650}; pending+pixel-pro ra RF-1542230F, RF-AEB9A758; q ra đúng RF; sort=amount $99 trước; sai giá trị 400. Phần tử: code RF-..., transactionCode, customer, creator, community, amountCents, paymentAmountCents, status, auto, note, requestedAt, resolvedAt, resolvedBy.")
    A(F, "GET /payments/refunds/:id: payment, paymentHistory, customerHistory, creatorResponse=null", "Chức năng", "Cao", API + " " + SEED_RF,
      ["Lấy id RF-1542230F", "GET /payments/refunds/<id>", "GET /payments/refunds/nope"], "RF-1542230F",
      "200: payment (AdminTransaction TXN-763C9F36), paymentHistory (giao dịch của khách ở cộng đồng, <=10), customerHistory {memberSince, previousRefunds[<=5], reportsReceived}, creatorResponse=null, history; nope 404.")
    A(F, "POST approve (đủ/một phần), reject, 400/409/404 và audit", "Chức năng", "Cao", APIM + " " + SEED_RF,
      ["approve RF-71FACC96 {amountCents:999999} -> 400", "approve {amountCents:3000,note:'Partial'} -> 200 (amountCents=3000)", "approve lần 2 -> 409", "reject RF-AEB9A758 {} -> 400", "reject {reason:'Outside window',note:'Đã dùng nhiều'} -> 200", "reject đã xử lý -> 409", "approve nope -> 404"], "RF-71FACC96, RF-AEB9A758",
      "Đúng mã; sau approve một phần: Payment.refundedCents=3000, enrollment người mua giữ nguyên; thông báo khách 'Hoàn tiền thành công' / 'Yêu cầu hoàn tiền bị từ chối'; audit refund.approve và refund.reject.")
    A(F, "Endpoint cũ GET/PATCH /api/admin/refunds vẫn hoạt động (hồi quy)", "Chức năng", "Cao", APIM + " " + SEED_RF,
      ["GET /api/admin/refunds?status=pending", "PATCH /api/admin/refunds/<id RF-6FF01B95> {\"action\":\"approve\"}", "PATCH /api/admin/refunds/<id khác> {\"action\":\"reject\",\"note\":\"x\"}", "PATCH {\"action\":\"hold\"}"], "-",
      "GET 200 (5 yêu cầu pending); PATCH approve 200 -> refund 'approved' và giao dịch hoàn tiền; reject 200; action lạ 400; audit payment.refund_resolve; kết quả khớp trang mới /admin/payments/refunds.")
    A(F, "Yêu cầu hoàn tiền của khách trong cửa sổ 7 ngày tự duyệt, ngoài cửa sổ chờ admin", "Chức năng", "Cao", BASE2 + " Đăng nhập newbie@sofinhub.test; có giao dịch thành công của newbie (checkout + confirm growth-lab). " + MUTATE,
      ["newbie@: POST /api/payments/<id>/refund-request {reason:'Đổi ý'} (trong 7 ngày)", "Admin xem /admin/payments/refunds"], "newbie growth-lab",
      "Trong cửa sổ REFUND_WINDOW_DAYS=7: yêu cầu tự duyệt (auto=true, 'Hoàn tất'); ngoài cửa sổ (đặt createdAt/confirmedAt cũ 10 ngày) thì ở 'Yêu cầu mới' chờ admin. " + PENDING_DECISION + " chính sách hoàn tiền 7 ngày chưa chốt.", pw="Không")

    # ============================================================ 11. THANH TOÁN - TRANH CHẤP (MÔ PHỎNG)
    F = "Thanh toán · Tranh chấp (mô phỏng)"
    A(F, "Trang Tranh chấp: 4 KPI và tab có đếm", "Giao diện", "Cao", UI + " " + SEED_CB,
      ["Mở /admin/payments/chargebacks", "Đọc KPI 'Đang mở', 'Thắng', 'Thua', 'Số tiền tranh chấp'", "Đọc số đếm tab"], "-",
      "Tiêu đề 'Tranh chấp thanh toán' (phụ đề 'Tranh chấp do ngân hàng phát hành thẻ mở.'); KPI: Đang mở 3 (đỏ), Thắng 2, Thua 1 (đỏ), Số tiền tranh chấp $196.00 (đỏ, = mở + đang xem xét); tab: Tất cả, Mở (3), Đang xem xét (1), Thắng (2), Thua (1). Dữ liệu là MÔ PHỎNG (chưa tích hợp cổng).")
    A(F, "Bảng Tranh chấp: cột, sắp theo hạn chót, nhãn lý do/bằng chứng", "Giao diện", "Trung bình", UI + " " + SEED_CB,
      ["Mở trang, quan sát thứ tự dòng", "Tab 'Mở'"], "-",
      "Cột: Vụ việc (CB-000nn), Người dùng, Creator, Số tiền, Lý do (Gian lận/Chưa nhận sản phẩm/Trùng lặp/Đã hủy gói/Không nhận ra giao dịch/Sản phẩm không như mô tả), Hạn chót ('Còn 2 ngày'... hoặc '—' khi đã đóng), Bằng chứng ('Đã nộp'/'Còn thiếu'), Trạng thái. Sắp theo hạn chót gần nhất trước (Daniel 'Trùng lặp' còn ~2 ngày đứng đầu). Tab 'Mở' có 3 dòng đều 'Còn thiếu'.")
    A(F, "Tìm Tranh chấp theo mã CB, mã TXN, tên khách", "Chức năng", "Trung bình", UI + " " + SEED_CB, ["Gõ 'Daniel'", "Gõ 'Noah'", "Gõ mã CB của một dòng bất kỳ"], "Daniel | Noah | CB-000nn", "Lần 1: 2 tranh chấp mở của Daniel; lần 2: 1 tranh chấp 'Thua' của Noah; lần 3: đúng dòng đó.")
    A(F, "Menu dòng Tranh chấp theo trạng thái", "Chức năng", "Cao", UI + " " + SEED_CB,
      ["Menu dòng 'Mở'", "Menu dòng 'Đang xem xét'", "Menu dòng 'Thắng'/'Thua'"], "-",
      "Mở: Nộp bằng chứng, Chấp nhận (đỏ), Xem. Đang xem xét: Đánh dấu thắng, Đánh dấu thua (đỏ), Chấp nhận (đỏ), Xem. Thắng/Thua: chỉ Xem.")
    A(F, "Xem chi tiết tranh chấp (modal) hiển thị lý do, hạn chót, bằng chứng, mã cổng, lịch sử", "Chức năng", "Trung bình", UI + " " + SEED_CB,
      ["Bấm dòng tranh chấp 'Đang xem xét' của Alex ('Chưa nhận sản phẩm')"], "Alex / product_not_received",
      "Modal 'Tranh chấp CB-000nn' (phụ đề TXN-...): Khách hàng Alex Rivera, Creator Sarah Kim, Cộng đồng Growth Lab, Số tiền $49.00, Lý do 'Chưa nhận sản phẩm', Trạng thái 'Đang xem xét', Hạn chót, Bằng chứng 'Đã nộp', Mã tranh chấp cổng mock_dp_seed_2; mục 'Nội dung bằng chứng' ('Access logs, lesson completion history and signed ToS acceptance attached.') + link https://example.com/evidence/logs.pdf.")
    A(F, "Nộp bằng chứng: bắt buộc nội dung, kiểm tra URL, chuyển 'Đang xem xét'", "Chức năng", "Cao", UIM + " " + SEED_CB,
      ["Menu tranh chấp Alex 'Gian lận' (mở) > 'Nộp bằng chứng'", "Quan sát nút khi chưa nhập nội dung", "Nhập nội dung 'Nhật ký truy cập', liên kết 'abc' rồi sửa thành 'https://x.test/e.pdf'", "Xác nhận"], "Alex / fraudulent",
      "Tiêu đề 'Nộp bằng chứng CB-000nn', 'Hạn chót <ngày> (còn N ngày)'; nút khóa khi nội dung rỗng; liên kết không bắt đầu http(s):// -> 'Mỗi liên kết phải bắt đầu bằng http:// hoặc https://' và nút khóa; thành công: toast 'Đã nộp bằng chứng', trạng thái 'Đang xem xét', Bằng chứng 'Đã nộp', tab Mở −1/Đang xem xét +1; audit chargeback.submit_evidence.")
    A(F, "Đánh dấu THẮNG tranh chấp đang xem xét: giữ nguyên giao dịch, thông báo creator", "Chức năng", "Cao", UIM + " " + SEED_CB,
      ["Menu tranh chấp Alex 'Chưa nhận sản phẩm' (đang xem xét) > 'Đánh dấu thắng' > xác nhận", "Kiểm tra giao dịch liên quan", "sarah@ xem thông báo"], "Alex / product_not_received",
      "Toast 'Đã đánh dấu thắng'; trạng thái 'Thắng', Hạn chót '—'; KPI Thắng +1, 'Số tiền tranh chấp' −$49; giao dịch vẫn 'Thành công'; Sarah (creator) nhận thông báo 'Chargeback thắng' ('CB-000nn ($49.00 USD) đã được chốt: thắng.'); audit chargeback.mark_won.")
    A(F, "Đánh dấu THUA: hoàn tiền giao dịch (đánh dấu refunded) và thu hồi quyền khi là kỳ hiện tại", "Chức năng", "Cao", UIM + " " + SEED_CB,
      ["Nộp bằng chứng cho tranh chấp Daniel 'Trùng lặp' rồi 'Đánh dấu thua' > xác nhận", "Mở giao dịch liên quan"], "Daniel / duplicate",
      "Toast 'Đã đánh dấu thua'; trạng thái 'Thua'; giao dịch liên quan thành 'Đã hoàn tiền' (refundedCents = số tiền, KHÔNG gọi cổng) và có RF lý do 'Chargeback'; thông báo creator 'Chargeback thua'. Với dữ liệu seed gói không bị hủy (mốc kỳ lệch mili-giây); dùng giao dịch checkout thật để kiểm tra thu hồi quyền.")
    A(F, "Chấp nhận tranh chấp (từ Mở): Thua + hoàn tiền; tranh chấp đã hoàn thì không hoàn lần 2", "Chức năng", "Cao", UIM + " " + SEED_CB,
      ["Menu tranh chấp Daniel 'Đã hủy gói' (mở) > 'Chấp nhận' > xác nhận"], "Daniel / subscription_cancelled",
      "Nội dung 'Giao dịch được hoàn tiền $49.00 và thu hồi quyền truy cập. Tranh chấp tính là THUA.'; toast 'Đã chấp nhận tranh chấp'; trạng thái 'Thua'; giao dịch 'Đã hoàn tiền'; audit chargeback.accept.")
    A(F, "Tranh chấp đã Thắng/Thua không còn thao tác chốt (chỉ 'Xem')", "Chức năng", "Thấp", UI + " " + SEED_CB, ["Mở menu dòng 'Thắng' của Maya và 'Thua' của Noah"], "-", "Chỉ có 'Xem'; xem chi tiết có 'Hạn chót' đã qua, thông tin chốt (Accepted: customer proved fraud / Evidence accepted by issuer) nằm trong dữ liệu.")
    A(F, "Tranh chấp rỗng hiển thị 'Chưa có tranh chấp nào.'", "Giao diện", "Thấp", UI, ["Tìm 'zzzkhongco' ở trang Tranh chấp"], "zzzkhongco", "Hiện 'Chưa có tranh chấp nào.'; KPI giữ nguyên.")

    F = "Thanh toán · Tranh chấp (API)"
    A(F, "GET /payments/chargebacks: list/summary/detail, lọc status/reason/courseId, sort deadline", "Chức năng", "Cao", API + " " + SEED_CB,
      ["GET /payments/chargebacks/summary", "GET /payments/chargebacks?courseId=growth-lab&status=won,lost", "GET /payments/chargebacks?reason=fraudulent", "GET /payments/chargebacks?q=<mã CB>", "GET /payments/chargebacks (sort mặc định deadline)", "GET ...?status=bogus", "GET ...?reason=bogus", "GET /payments/chargebacks/<id>", "GET /payments/chargebacks/nope"], "-",
      "summary {open:3,underReview:1,won:2,lost:1,disputedAmountCents:19600}; won,lost ra 3; reason=fraudulent ra 2 (open + lost); q ra đúng; mặc định sắp hạn chót tăng dần (đang mở trước); bogus 400; chi tiết có payment (AdminTransaction), history, gatewayDisputeId 'mock_dp_seed_N', evidence/evidenceUrls, daysLeft (null khi đã đóng); nope 404.")
    A(F, "POST /payments/chargebacks (giả lập): validate, tạo 201, 409 trùng/giao dịch không hợp lệ", "Chức năng", "Cao", APIM + " " + SEED_TX,
      ["POST {} -> 400", "{paymentId:'nope',reason:'fraudulent'} -> 404", "{paymentId:<TXN-E8AF54EA>,reason:'bogus'} -> 400", "{...,reason:'fraudulent',amountCents:999999} -> 400", "{...,reason:'fraudulent',deadlineDays:5} -> 201", "lặp lại khi chargeback đang mở -> 409", "tạo trên giao dịch Thất bại (TXN-5ECCCEFC) -> 409", "deadlineDays 31 -> 400"], "TXN-E8AF54EA",
      "201 {code 'CB-\\d{5}', status 'open', evidence 'missing', amountCents 9900, daysLeft 4-5, gatewayDisputeId 'mock_dp_...'}; 409 'Giao dịch này đã có chargeback đang xử lý' / 'Chỉ giao dịch đã thanh toán thành công mới có chargeback'; chủ cộng đồng (Emma) nhận thông báo 'Có tranh chấp thanh toán mới'; audit chargeback.create. Nút tạo tranh chấp KHÔNG có trên giao diện.")
    A(F, "Máy trạng thái chargeback: submit-evidence/mark-won/mark-lost/accept và các 409", "Chức năng", "Cao", APIM + " " + SEED_CB,
      ["mark-won khi đang 'open' -> 409", "submit-evidence {} -> 400", "submit-evidence {note,evidenceUrls:['https://x.test/e.pdf']} -> 200 under_review/evidence submitted", "mark-won -> 200 won, daysLeft=null", "accept sau khi đã won -> 409", "submit-evidence khi đã chốt -> 409", "mark-lost từ under_review -> 200 lost", "accept từ open -> 200 lost"], "tranh chấp seed",
      "Chỉ chốt thắng/thua khi đang xem xét ('Chỉ chốt thắng/thua được chargeback đang xem xét (đã nộp bằng chứng)'); đã chốt 'Chargeback đã được chốt' 409; thua -> Payment 'refunded', refundedCents = số tiền, enrollment bị thu hồi nếu là kỳ hiện tại; audit chargeback.* đúng action (mark_won, mark_lost...).")

    # ============================================================ 12. THANH TOÁN - DOANH THU CREATOR
    F = "Thanh toán · Doanh thu creator"
    A(F, "Trang Doanh thu creator: chip ngày, 5 KPI và bảng creator", "Giao diện", "Cao", UI + " " + SEED_CRV,
      ["Mở /admin/payments/creator", "Chọn chip '90 ngày'", "Đối chiếu /payments/creators/summary?from=<hôm nay − 90 ngày>"], "-",
      "Tiêu đề 'Doanh thu creator' (phụ đề 'Thu nhập của chủ cộng đồng sau phí và hoàn tiền.'); KPI: 'Creator' (7), 'Doanh thu gộp', 'Phí nền tảng', 'Thu nhập thuần', 'Số dư chờ'; bảng: Creator (tên+email), Cộng đồng, Doanh thu gộp, Hoàn tiền, Phí nền tảng, Thu nhập thuần, Số dư chờ; mặc định sắp theo Thu nhập thuần giảm dần (Emma Garcia đầu). 'Số dư chờ' luôn toàn thời gian, các cột kia theo chip.")
    A(F, "Số liệu creator Emma Garcia khớp công thức (toàn thời gian qua API)", "Chức năng", "Cao", API + " " + SEED_CRV + " " + FEE,
      ["GET /payments/creators?q=emma&limit=5 (không from)", "Đối chiếu với SQL tổng Payment theo cộng đồng pixel-pro và creator-academy"], "Emma Garcia",
      "{communities:2, grossCents:158400, refundsCents:9900, platformFeeCents:14850, gatewayFeeCents:5072, netCents:128578, pendingBalanceCents:96078, paidOutCents:0}: phí NT = 10% × (158400−9900); net = 158400−9900−14850−5072; chờ = net − (25000 payout xử lý + 7500 thất bại) = 96078. " + PENDING_DECISION + " hoa hồng/phí cổng.")
    A(F, "Số liệu creator Sarah Kim và 'đã chi' (paidOutCents)", "Chức năng", "Cao", API + " " + SEED_CRV,
      ["GET /payments/creators?q=sarah (không from)"], "Sarah Kim", "{communities:1, grossCents:78400, refundsCents:4900, platformFeeCents:7350, gatewayFeeCents:2752, netCents:63398, pendingBalanceCents:24398, paidOutCents:21000}: chờ = 63398 − (18000 + 21000) = 24398 (payout đã chi 21000 vẫn trừ vào số dư, payout bị từ chối thì không).")
    A(F, "Tìm và sắp xếp Creator (Doanh thu gộp, Số dư chờ, Tên A–Z)", "Chức năng", "Trung bình", UI + " " + SEED_CRV,
      ["Gõ 'noah'", "Xóa, chọn 'Doanh thu gộp'", "Chọn 'Số dư chờ'", "Chọn 'Tên A–Z'"], "noah",
      "Lần 1: Noah Williams (tìm theo tên/email/tên cộng đồng); gộp: Emma, Noah, Sarah, Olivia...; số dư chờ: Emma ($960.78) đứng đầu rồi Noah ($704.08); Tên A–Z theo tên tăng dần.")
    A(F, "Đổi chip 7/30/90 ngày làm KPI và cột theo kỳ đổi nhưng 'Số dư chờ' không đổi", "Chức năng", "Cao", UI + " " + SEED_CRV,
      ["Chọn '90 ngày' rồi '7 ngày'", "So sánh cột 'Số dư chờ' của Emma"], "-", "Doanh thu gộp/Hoàn tiền/Phí/Thu nhập thuần giảm khi thu hẹp kỳ; 'Số dư chờ' của mỗi creator không đổi (toàn thời gian); KPI tổng 'Số dư chờ' cũng không đổi.")
    A(F, "Chi tiết creator: KPI, biểu đồ Gộp/Thuần/Hoàn tiền, bảng Cộng đồng/Giao dịch/Chi trả", "Giao diện", "Cao", UI + " " + SEED_CRV + " " + SEED_PO,
      ["Bấm dòng 'Emma Garcia'", "Chọn chip '90 ngày'"], "Emma Garcia",
      "Tiêu đề 'Emma Garcia', phụ đề 'Doanh thu creator · emma@sofinhub.test', breadcrumb 'Doanh thu creator'; 5 KPI; biểu đồ 'Doanh thu · Emma Garcia' với 3 chuỗi (Gộp, Thuần, Hoàn tiền màu đỏ), mỗi ngày trong kỳ có điểm; bảng 'Cộng đồng' (Creator Academy, Pixel Pro: gộp, thuần, số dư chờ); "
      "'Lịch sử giao dịch' ('20 giao dịch gần nhất'); 'Chi trả' ('10 khoản gần nhất') gồm PO-4F3DDE23 ($250 'Đang xử lý') và PO-55B8FDCB ($75 'Thất bại'). Bấm dòng cộng đồng -> /admin/communities/<id>; bấm giao dịch -> /admin/payments/tx/<id>.")
    A(F, "Chi tiết creator không có cộng đồng/giao dịch/chi trả hiện thông báo rỗng đúng", "Giao diện", "Thấp", UI,
      ["Mở /admin/payments/creator/<id Olivia Owner> (có cộng đồng, chi trả)", "Mở /admin/payments/creator/<id người dùng không sở hữu cộng đồng, ví dụ maya>"], "maya (seed-admin-user-maya)",
      "Maya không sở hữu cộng đồng nào -> khối lỗi 'Người dùng này không sở hữu cộng đồng nào' (404) và không màn trắng. Creator có cộng đồng nhưng chưa có dữ liệu hiện 'Creator chưa có cộng đồng nào.'/'Chưa có giao dịch nào.'/'Chưa có khoản chi trả nào.' tương ứng.")
    A(F, "API Creator: list (q, sort, from/to), summary và 400", "Chức năng", "Cao", API + " " + SEED_CRV,
      ["GET /payments/creators/summary", "GET /payments/creators?limit=100", "GET /payments/creators?sort=gross&limit=3", "GET /payments/creators?sort=bogus", "GET /payments/creators?from=2026-09-24&to=2026-10-01", "GET ...?from=2026-10-01&to=2026-09-01"], "-",
      "summary {creators:7,grossCents:458900,refundsCents:20650,platformFeeCents:43825,gatewayFeeCents:16328,netCents:378097,pendingBalanceCents:254597}; list 7 creator; sort=gross Emma đầu; sort lạ 400; from>to 400; khoảng from/to áp cho gross/refunds/fees/net (lọc theo COALESCE(confirmedAt, createdAt)), pendingBalance/paidOut luôn toàn thời gian.")
    A(F, "API chi tiết creator: kpis, series theo ngày, communities, transactions<=20, payouts<=10, 404", "Chức năng", "Cao", API + " " + SEED_CRV,
      ["GET /payments/creators/<id Emma>", "GET /payments/creators/<id Emma>?from=2020-01-01&to=2020-01-05", "GET /payments/creators/nope", "GET /payments/creators/<id maya>"], "Emma Garcia",
      "Lần 1: series dài 30 ngày (mặc định 30 ngày gần nhất) với tổng grossCents trong series = kpis.grossCents của kỳ; communities[2] có pendingBalanceCents; Lần 2: series 5 phần tử, kpis.grossCents=0 nhưng pendingBalanceCents giữ nguyên; nope 404 'Không tìm thấy chủ cộng đồng'; maya 404 'Người dùng này không sở hữu cộng đồng nào'.")
    A(F, "Số liệu creator khớp doanh thu của chính chủ cộng đồng (/courses/:id/revenue)", "Chức năng", "Cao", API + " " + SEED_CRV + " Đăng nhập sarah@sofinhub.test (chủ growth-lab).",
      ["sarah@: GET /api/courses/growth-lab/revenue", "Admin: GET /payments/creators?q=sarah"], "growth-lab",
      "netCents của admin = netCents của /courses/growth-lab/revenue; pendingBalanceCents = availableBalanceCents của chủ cộng đồng (cùng công thức phí và cùng cách trừ payout chưa bị từ chối).")

    # ============================================================ 13. THANH TOÁN - CHI TRẢ
    F = "Thanh toán · Chi trả (UI)"
    A(F, "Trang Chi trả: 5 KPI và 7 tab có đếm", "Giao diện", "Cao", UI + " " + SEED_PO,
      ["Mở /admin/payments/payouts", "Đọc KPI và số đếm tab"], "-",
      "Tiêu đề 'Chi trả' (phụ đề 'Chuyển tiền cho creator vào ngày 1 và 16 hàng tháng.'); KPI: Đang chờ $350.00, Đang xử lý $349.00, Đã chi trả $409.00, Tạm giữ $52.00, Thất bại $75.00 (đỏ); tab: Tất cả, Đang chờ (3), Đang xử lý (2), Đã chi trả (4), Thất bại (1), Tạm giữ (1), Đã từ chối (1).")
    A(F, "Bảng Chi trả: cột và định dạng phương thức/lịch", "Giao diện", "Trung bình", UI + " " + SEED_PO,
      ["Gõ 'PO-60986918'"], "PO-60986918",
      "Dòng: Mã PO-60986918, Creator 'Sarah Kim' + email, Số tiền $180.00, Phương thức 'Bank · Chase •• 1203', Lịch chi trả = ngày 1 hoặc 16 kế tiếp kể từ lúc tạo (vd 01/10/2026), Đã chi '—', Trạng thái 'Đang chờ'. Đã chi trả: cột 'Đã chi' = ngày cập nhật.")
    A(F, "Tìm và sắp xếp Chi trả (Số tiền cao nhất, Theo lịch chi trả)", "Chức năng", "Trung bình", UI + " " + SEED_PO,
      ["Gõ 'Emma'", "Gõ 'Techcombank'", "Gõ 'Growth'", "Chọn 'Số tiền cao nhất'", "Chọn 'Theo lịch chi trả'"], "Emma | Techcombank | Growth",
      "Lần 1: 2 khoản của Emma (PO-4F3DDE23, PO-55B8FDCB); lần 2: khoản Techcombank ••7731 (PO-102DFB01, PO-50974388); lần 3: khoản cộng đồng Growth Lab (PO-60986918, PO-E76F07C4); sắp số tiền: $250 đầu.")
    A(F, "Tab Thất bại / Tạm giữ / Đã từ chối / Đang xử lý liệt kê đúng khoản seed", "Chức năng", "Cao", UI + " " + SEED_PO,
      ["Bấm lần lượt các tab"], "-", "Thất bại: PO-55B8FDCB; Tạm giữ: PO-50974388; Đã từ chối: PO-91AEB74D; Đang xử lý: PO-4F3DDE23, PO-102DFB01; mỗi tab khớp số đếm.")
    A(F, "Menu thao tác theo trạng thái payout (7 trạng thái)", "Chức năng", "Cao", UI + " " + SEED_PO,
      ["Menu PO-60986918 (Đang chờ)", "PO-4F3DDE23 (Đang xử lý)", "PO-55B8FDCB (Thất bại)", "PO-50974388 (Tạm giữ)", "PO-2CFB97FB (Đã chi)", "PO-91AEB74D (Đã từ chối)"], "-",
      "Đang chờ: Xem xét, Duyệt, Đã chi trả, Tạm giữ, Từ chối. Đang xử lý: Xem xét, Đã chi trả, Đánh dấu thất bại, Tạm giữ, Từ chối. Thất bại: Thử lại, Xem xét, Tạm giữ, Từ chối. Tạm giữ: Giải ngân, Xem xét, Từ chối. Đã chi/Đã từ chối: chỉ Xem xét.")
    A(F, "Xem xét chi trả (modal): thông tin, số dư creator, lịch sử", "Chức năng", "Cao", UI + " " + SEED_PO + " " + SEED_AUD,
      ["Bấm 'Xem xét' ở PO-50974388 (Noah, tạm giữ)"], "PO-50974388",
      "Modal 'Chi trả PO-50974388' (phụ đề 'Noah Williams'): Creator 'Noah Williams (noah@sofinhub.test)', Cộng đồng 'Fit Forever', Số tiền $52.00, Phương thức 'Bank · Techcombank •• 7731', Trạng thái 'Tạm giữ', Lịch chi trả, Đã chi trả '—', Ghi chú 'Held pending identity re-verification'; "
      "'Số dư creator': Thu nhập thuần, Đã yêu cầu rút (tổng payout chưa bị từ chối của cộng đồng), Có thể rút = thuần − đã yêu cầu; 'Lịch sử quản trị' có payout.hold (lý do Identity re-verification).")
    A(F, "Duyệt chi trả (requested -> approved): toast, trạng thái, thông báo owner, audit", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Menu PO-60986918 > 'Duyệt' > xác nhận (ghi chú tùy chọn)", "sarah@ xem thông báo"], "PO-60986918",
      "Modal 'Duyệt chi trả?'; toast 'Đã duyệt chi trả (đang xử lý)'; trạng thái 'Đang xử lý'; tab 'Đang chờ' −1 / 'Đang xử lý' +1; KPI chuyển $180 từ 'Đang chờ' sang 'Đang xử lý'; Sarah nhận 'Yêu cầu rút tiền đã được duyệt'; audit payout.approve (metadata from=requested,to=approved).")
    A(F, "Đánh dấu đã chi trả từ Đang chờ hoặc Đang xử lý", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Menu PO-12AA363D (requested) > 'Đã chi trả' > xác nhận", "Menu PO-102DFB01 (approved) > 'Đã chi trả' > xác nhận"], "PO-12AA363D, PO-102DFB01",
      "Toast 'Đã đánh dấu đã chi trả'; trạng thái 'Đã chi trả', cột 'Đã chi' có ngày; KPI 'Đã chi trả' tăng $120 + $99; owner nhận 'Đã chuyển tiền' ('120.00 USD đã được chuyển vào tài khoản ****8812'); audit payout.mark_paid.")
    A(F, "Đánh dấu thất bại (approved -> failed) bắt buộc lý do; hiển thị 'Lý do thất bại'", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Menu PO-4F3DDE23 (Emma, đang xử lý) > 'Đánh dấu thất bại'", "Chọn 'Tài khoản ngân hàng bị từ chối' > xác nhận", "Mở 'Xem xét' dòng đó"], "PO-4F3DDE23",
      "Lý do: Tài khoản ngân hàng bị từ chối, Lỗi cổng thanh toán, Khác; nút khóa tới khi chọn; toast 'Đã đánh dấu thất bại'; trạng thái 'Thất bại'; modal Xem xét có 'Lý do thất bại'; Emma nhận 'Chuyển tiền thất bại'; audit payout.mark_failed.")
    A(F, "Thử lại chi trả thất bại (failed -> approved) xóa lý do thất bại", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Menu PO-55B8FDCB (Emma, thất bại) > 'Thử lại' > xác nhận"], "PO-55B8FDCB", "Toast 'Đã đưa chi trả về hàng xử lý'; trạng thái 'Đang xử lý'; failureReason bị xóa; Emma nhận 'Đang thử chuyển tiền lại'; audit payout.retry.")
    A(F, "Tạm giữ (hold) từ Đang chờ/Đang xử lý/Thất bại và giải ngân quay về trạng thái trước", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Menu PO-102DFB01 (Đang xử lý) > 'Tạm giữ' > chọn lý do 'Nghi ngờ gian lận' > xác nhận", "Menu dòng đó (Tạm giữ) > 'Giải ngân' > xác nhận", "Làm tương tự với PO-50974388 (giữ từ 'requested')"], "PO-102DFB01, PO-50974388",
      "Hold: toast 'Đã tạm giữ chi trả', trạng thái 'Tạm giữ', ghi chú 'Nghi ngờ gian lận'; Giải ngân: toast 'Đã giải ngân' và trở về ĐÚNG trạng thái trước khi giữ (PO-102DFB01 -> 'Đang xử lý'; PO-50974388 -> 'Đang chờ'); owner nhận 'Yêu cầu rút tiền đang được giữ' rồi '...đã được tiếp tục'.")
    A(F, "Từ chối chi trả hoàn số dư cho creator", "Chức năng", "Cao", UIM + " " + SEED_PO,
      ["Mở 'Xem xét' PO-12AA363D ghi 'Đã yêu cầu rút' & 'Có thể rút' của creator Alex", "Menu PO-12AA363D > 'Từ chối' > chọn 'Thông tin tài khoản không hợp lệ' > xác nhận", "Mở lại Xem xét dòng khác của Alex"], "PO-12AA363D",
      "Lý do: Thông tin tài khoản không hợp lệ, Gian lận, Vi phạm chính sách, Khác; toast 'Đã từ chối chi trả (hoàn số dư)'; trạng thái 'Đã từ chối'; 'Đã yêu cầu rút' của creator giảm $120 và 'Có thể rút' tăng $120; Alex nhận 'Yêu cầu rút tiền bị từ chối' kèm lý do; audit payout.reject.")
    A(F, "Lỗi chuyển trạng thái đồng thời hiển thị 409 trong modal", "Chức năng", "Trung bình", UIM + " " + SEED_PO,
      ["Mở 2 tab; tab 1 'Duyệt' PO-60986918; tab 2 (chưa tải lại) bấm 'Duyệt' dòng đó"], "PO-60986918", "Tab 2 hiện 'Chỉ duyệt được yêu cầu đang chờ' trong modal; dữ liệu không đổi.", pw="Một phần")

    F = "Thanh toán · Chi trả (API)"
    A(F, "GET /payments/payouts: list/summary/detail, lọc status/ownerId/courseId, sort, 400/404", "Chức năng", "Cao", API + " " + SEED_PO,
      ["GET /payments/payouts/summary", "GET /payments/payouts?status=paid,rejected", "GET /payments/payouts?courseId=fit-forever", "GET /payments/payouts?sort=amount&limit=3", "GET /payments/payouts/<id PO-50974388>", "GET ...?status=bogus", "GET ...?sort=bogus", "GET /payments/payouts/nope"], "-",
      "summary {pendingCents:35000,processingCents:34900,paidCents:40900,failedCents:7500,onHoldCents:5200,counts:{requested:3,approved:2,paid:4,failed:1,on_hold:1,rejected:1}}; paid,rejected ra 5; chi tiết có method {type:'bank',bankName,accountMasked:'****7731',label}, heldFromStatus='requested', creatorBalance {netCents,requestedCents,availableCents}, history; bogus 400; nope 404.")
    A(F, "Chuỗi trạng thái payout đầy đủ: approve -> mark-failed -> retry -> hold -> release -> mark-paid", "Chức năng", "Cao", APIM + " " + SEED_PO,
      ["approve PO-60986918 -> approved", "approve lần 2 -> 409", "mark-failed {} -> 400; mark-failed {reason:'Bank account closed'} -> failed", "retry -> approved (failureReason=null)", "hold {reason:'KYC review'} -> on_hold, heldFromStatus='approved'", "hold lần 2 -> 409; approve khi on_hold -> 409", "release -> approved", "mark-paid {note:'Ref 123'} -> paid, paidAt có giá trị", "reject sau paid -> 409"], "PO-60986918",
      "Đúng từng bước; owner nhận thông báo mỗi bước (Yêu cầu rút tiền đã được duyệt / Chuyển tiền thất bại / Đang thử chuyển tiền lại / ...giữ / ...tiếp tục / Đã chuyển tiền); audit: payout.approve, payout.mark_failed, payout.retry, payout.hold, payout.release, payout.mark_paid (tên action dùng gạch dưới).")
    A(F, "Bảng quy tắc chuyển trạng thái payout: các hành động sai trạng thái đều 409", "Chức năng", "Cao", APIM + " " + SEED_PO,
      ["mark-failed trên 'requested' -> 409", "retry trên 'requested' -> 409", "release trên 'requested' -> 409", "hold trên 'paid' -> 409", "hold trên 'rejected' -> 409", "reject trên 'paid' -> 409", "approve trên 'on_hold' -> 409", "mark-paid trên 'failed' -> 409"], "PO-12AA363D, PO-2CFB97FB, PO-91AEB74D",
      "Mọi lệnh trên 409 CONFLICT với thông điệp theo quy tắc ('Chỉ duyệt được yêu cầu đang chờ', 'Chỉ đánh dấu thất bại được yêu cầu đang xử lý', 'Chỉ thử lại được yêu cầu thất bại', 'Không thể giữ yêu cầu ở trạng thái này', 'Yêu cầu không đang bị giữ', 'Yêu cầu đã được xử lý xong', 'Yêu cầu không ở trạng thái có thể đánh dấu đã chi'); payout không đổi.")
    A(F, "reject/hold/mark-failed bắt buộc reason (400), payout bị từ chối được hoàn số dư", "Chức năng", "Cao", APIM + " " + SEED_PO,
      ["reject {} -> 400", "reject {reason:'Name mismatch'} -> 200 rejected", "GET payout detail lấy creatorBalance.requestedCents trước/sau"], "PO-12AA363D",
      "Thiếu reason 400; reject 200 status 'rejected', note 'Name mismatch'; requestedCents của creator giảm đúng amount payout bị từ chối (hoàn số dư).")
    A(F, "Endpoint cũ GET/PATCH /api/admin/payouts vẫn hoạt động với payout mới (hồi quyền)", "Chức năng", "Cao", APIM + " " + SEED_PO,
      ["GET /api/admin/payouts?status=requested", "PATCH /api/admin/payouts/<id PO-12AA363D> {\"action\":\"approve\"}", "GET /api/admin/payments/payouts/<id>", "PATCH {\"action\":\"mark_paid\"} và {\"action\":\"reject\",\"note\":\"x\"}", "PATCH {\"action\":\"hold\"}", "GET /api/admin/payouts?status=on_hold"], "PO-12AA363D",
      "Endpoint cũ nhận status đơn lẻ (kể cả failed|on_hold); PATCH approve 200 -> trang mới thấy 'approved'; action cũ dùng 'mark_paid' (gạch dưới) và chỉ approve|mark_paid|reject (hold -> 400); reject cũ chỉ từ requested/approved ('Yêu cầu đã được xử lý xong' với failed/on_hold). Audit payment.payout_resolve.")
    A(F, "Số tiền chi trả tối thiểu PAYOUT_MIN_USD không bị admin kiểm lại; kiểm ở bước creator yêu cầu", "Chức năng", "Thấp", BASE2 + " " + LOGIN + " Đăng nhập owner@sofinhub.test (chủ paid-demo). " + MUTATE,
      ["owner@: POST /api/courses/paid-demo/payouts {amountCents:3000, method:{type:'bank',bankName:'Chase',accountNumber:'123456789',accountHolder:'Olivia Owner'}} (< $50)", "Admin xem /admin/payments/payouts"], "amountCents=3000",
      "API của creator trả 400 'Số tiền rút tối thiểu là 50.00 USD' (PAYOUT_MIN_USD=50); không phát sinh payout; admin chỉ thấy các payout đã hợp lệ (đường admin /admin/payments/payouts/* không kiểm lại ngưỡng). " + PENDING_DECISION + " ngưỡng $50 (PAYOUT_MIN_USD) chưa chốt.", pw="Không")

    # ============================================================ 14. KHÁM PHÁ - CỘNG ĐỒNG HIỂN THỊ
    F = "Khám phá · Cộng đồng hiển thị (UI)"
    A(F, "Trang Cộng đồng hiển thị: 5 tab có đếm khớp seed", "Giao diện", "Cao", UI + " " + SEED_DISC,
      ["Mở /admin/discovery/listed", "Đọc số đếm 5 tab", "Đối chiếu /discovery/communities/summary"], "-",
      "Tiêu đề 'Cộng đồng hiển thị' (phụ đề 'Cộng đồng hiển thị trong trang Khám phá.'), không có thẻ KPI; tab: Tất cả (35), Đang hiển thị (23), Nổi bật (3), Đã ẩn (4), Gỡ khỏi khám phá (5); 35 = 23+3+4+5.")
    A(F, "Bảng Cộng đồng hiển thị: cột và dữ liệu một dòng", "Giao diện", "Trung bình", UI + " " + SEED_DISC,
      ["Gõ 'Growth Lab' vào ô 'Tìm cộng đồng đang hiển thị...'"], "Growth Lab",
      "Dòng: tên 'Growth Lab' + '/growth-lab' (ảnh bìa/avatar chữ), Danh mục 'Kinh doanh', Thành viên (≈68), Tăng trưởng '+9.7%' (xanh; số âm sẽ đỏ), Tương tác thanh ≈100%, Đánh giá '—' (chưa có đánh giá), Trạng thái khám phá 'Nổi bật' (cam).")
    A(F, "Tab Nổi bật / Đã ẩn / Gỡ khỏi khám phá liệt kê đúng cộng đồng seed", "Chức năng", "Cao", UI + " " + SEED_DISC,
      ["Bấm tab 'Nổi bật'", "Bấm tab 'Đã ẩn'", "Bấm tab 'Gỡ khỏi khám phá'"], "-",
      "Nổi bật: photo, yt, growth-lab. Đã ẩn: biz (ẩn thật), fin, lead, private-demo (cộng đồng riêng tư luôn hiển thị là 'Đã ẩn'). Gỡ khỏi khám phá: crypto-signals-pro (đình chỉ), design-circle (chờ duyệt), quick-rich-club (bị từ chối), fit ('Owner request'), spam-hub.")
    A(F, "Tìm cộng đồng theo tên, id (slug) và tên chủ", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Gõ 'spam'", "Gõ 'pixel-pro'", "Gõ 'Emma'"], "spam | pixel-pro | Emma", "Lần 1: Spam Hub; lần 2: Pixel Pro; lần 3: cộng đồng do Emma Garcia làm chủ (Pixel Pro, Creator Academy). Không phân biệt hoa thường.")
    A(F, "Lọc theo Danh mục (nạp từ danh sách danh mục) và 'Xóa bộ lọc'", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Mở bộ lọc 'Danh mục', xem các lựa chọn", "Chọn 'Công nghệ'", "Kết hợp tab 'Đang hiển thị'", "'Xóa bộ lọc'"], "Công nghệ",
      "Lựa chọn lấy từ /discovery/categories (8 danh mục; cả danh mục đã tắt cũng có mặt); 'Công nghệ' ra các cộng đồng tech (code-camp, des, no-code-nation, py, data, ux...); kết hợp với tab là phép giao; 'Xóa bộ lọc' bỏ lọc danh mục/sắp xếp (giữ tab).")
    A(F, "Sắp xếp: mặc định thành viên giảm dần, Tăng trưởng, Tương tác, Đánh giá, Mới nhất, Tên A–Z", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Mở trang (mặc định)", "Chọn lần lượt 5 mục 'Sắp xếp'"], "-",
      "Mặc định: cột 'Thành viên' giảm dần (photo ≈72 đầu); 'Đánh giá' giảm dần (ecom có 390 lượt...); 'Mới nhất' theo ngày tạo giảm dần; 'Tên A–Z' theo tên tăng dần.")
    A(F, "Phân trang Cộng đồng hiển thị 20/trang (35 -> 2 trang)", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Mở tab 'Tất cả'", "Sang trang 2"], "-", "Trang 1: 20 dòng; trang 2: 15 dòng; tổng 35. Sắp xếp/phân trang thực hiện trong bộ nhớ ở BE (xem mục 'Khác biệt' 4).")
    A(F, "Menu dòng theo trạng thái khám phá (Đưa lên nổi bật/Bỏ nổi bật/Ẩn/Gỡ/Hiển thị lại/Xem chi tiết)", "Chức năng", "Cao", UI + " " + SEED_DISC,
      ["Menu Code Camp (Đang hiển thị)", "Menu Growth Lab (Nổi bật)", "Menu Business 'biz' (Đã ẩn)", "Menu Spam Hub (Gỡ khỏi khám phá)"], "-",
      "Đang hiển thị: Đưa lên nổi bật, Ẩn, Gỡ khỏi Khám phá, Xem chi tiết. Nổi bật: Bỏ nổi bật, Ẩn, Gỡ khỏi Khám phá, Xem chi tiết. Đã ẩn: Hiển thị lại, Gỡ khỏi Khám phá, Xem chi tiết. Gỡ khỏi khám phá: Hiển thị lại, Xem chi tiết. 'Xem chi tiết' và bấm cả dòng mở /admin/communities/<id>.")
    A(F, "Đưa lên nổi bật: toast, trạng thái 'Nổi bật', xuất hiện ở /courses/featured", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Marketing thực chiến' (id mkt) > 'Đưa lên nổi bật'", "Xác nhận", "Mở /admin/discovery/featured", "GET /api/courses/featured?section=featured"], "mkt",
      "Modal 'Đưa lên nổi bật?' ('...sẽ được thêm vào mục \"Cộng đồng nổi bật\"...'); toast 'Đã đưa lên nổi bật'; trạng thái 'Nổi bật', tab Nổi bật 3→4 và 'Đang hiển thị' 23→22; thẻ 'Cộng đồng nổi bật' ở trang Nổi bật có mkt ở cuối (#4); API công khai trả mkt sau growth-lab; audit discovery.feature.")
    A(F, "Bỏ nổi bật: gỡ khỏi MỌI mục ghim, trạng thái về 'Đang hiển thị'", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Growth Lab' > 'Bỏ nổi bật' > xác nhận", "Kiểm tra /admin/discovery/featured"], "growth-lab", "Toast 'Đã bỏ nổi bật'; trạng thái 'Đang hiển thị'; growth-lab biến khỏi thẻ 'Cộng đồng nổi bật'; audit discovery.unfeature (metadata.sections).")
    A(F, "Ẩn khỏi Khám phá: lý do KHÔNG bắt buộc, ghi 'lý do — ghi chú', thông báo chủ, biến mất khỏi /courses", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Marketing thực chiến' (mkt, chủ Daniel) > 'Ẩn'", "Không chọn lý do (nút vẫn bấm được); thử lại với lý do 'Chất lượng thấp' + ghi chú 'QA'", "daniel@ xem thông báo", "GET /api/courses?limit=50 (token bất kỳ)"], "mkt",
      "Modal 'Ẩn khỏi Khám phá?' ('Vẫn truy cập được bằng liên kết trực tiếp.'); toast 'Đã ẩn khỏi Khám phá'; trạng thái 'Đã ẩn'; discoveryReason = 'Chất lượng thấp — QA'; Daniel nhận 'Cộng đồng đã bị gỡ khỏi Discovery'; /courses không còn mkt; GET /api/courses/mkt vẫn 200; audit discovery.status (from listed to hidden).")
    A(F, "Gỡ khỏi Khám phá (unlisted) cộng đồng đang Nổi bật: biến mất khỏi mục ghim công khai", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Growth Lab' (Nổi bật) > 'Gỡ khỏi Khám phá' > lý do 'Vi phạm chính sách' > xác nhận", "GET /api/courses/featured?section=featured"], "growth-lab",
      "Toast 'Đã gỡ khỏi Khám phá'; trạng thái 'Gỡ khỏi khám phá'; API công khai KHÔNG còn growth-lab (mục ghim vẫn tồn tại trong admin nhưng bị lọc vì không còn listed); /courses cũng không còn; Sarah nhận thông báo.")
    A(F, "Hiển thị lại cộng đồng bị ẩn/gỡ (raw hidden hoặc unlisted) -> Đang hiển thị", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'biz' (Đã ẩn) > 'Hiển thị lại' > xác nhận", "Menu 'fit' (Gỡ khỏi khám phá, Owner request) > 'Hiển thị lại'", "GET /api/courses?q=Xây dựng"], "biz, fit",
      "Toast 'Đã hiển thị lại'; cả hai thành 'Đang hiển thị' (discoveryReason bị xóa); biz và fit xuất hiện lại ở /courses; tab Đã ẩn −1, Gỡ khỏi khám phá −1, Đang hiển thị +2; KHÔNG gửi thông báo cho chủ khi hiển thị lại.")
    A(F, "'Hiển thị lại' trên cộng đồng riêng tư/chờ duyệt/đình chỉ báo 409 'đã ở trạng thái listed' (hành vi hiện tại)", "Chức năng", "Trung bình", UIM + " " + SEED_DISC + " " + PENDING_DECISION + " quy tắc hiển thị hidden/unlisted chưa chốt.",
      ["Menu 'fin' (riêng tư, hiển thị 'Đã ẩn') > 'Hiển thị lại' > xác nhận", "Menu 'design-circle' (chờ duyệt, 'Gỡ khỏi khám phá') > 'Hiển thị lại' > xác nhận"], "fin, design-circle",
      "Modal hiện lỗi 'Cộng đồng đã ở trạng thái listed' (409): cột Discovery thô của các cộng đồng này vốn là 'listed' - trạng thái 'Đã ẩn'/'Gỡ khỏi khám phá' hiển thị chỉ do private/moderationStatus; quy tắc này khớp bản đợt 1 nhưng nút 'Hiển thị lại' gây hiểu nhầm.")
    A(F, "Cộng đồng riêng tư hiển thị 'Đã ẩn' ở admin nhưng VẪN nằm trong /courses công khai", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Admin: tab 'Đã ẩn' thấy fin, lead, private-demo", "GET /api/courses?limit=50 (token bất kỳ)", "So sánh"], "fin, lead, private-demo",
      "KỲ VỌNG SAU KHI CHỐT: nhãn Khám phá của cộng đồng riêng tư phản ánh đúng việc có/không xuất hiện ở trang Khám phá công khai. HIỆN TẠI: 3 cộng đồng riêng tư có trong /courses (danh sách 29 gồm fin, lead, private-demo) vì /courses chỉ lọc theo cột discoveryStatus=listed + trạng thái hoạt động, không loại private.", st=PLAN, pw="Không")
    A(F, "Lỗi/tải/rỗng của trang Cộng đồng hiển thị", "Giao diện", "Thấp", UI, ["Tìm 'zzzkhongco'", "Chặn /api/admin/discovery/communities rồi F5, bỏ chặn, bấm 'Thử lại'"], "-", "Rỗng: 'Không có kết quả phù hợp.'; lỗi: khối lỗi + 'Thử lại'; đang tải: 'Đang tải…'.", pw="Một phần")

    F = "Khám phá · Cộng đồng hiển thị (API)"
    A(F, "GET /discovery/communities: lọc status/category/q, sort, phân trang, 400", "Chức năng", "Cao", API + " " + SEED_DISC,
      ["GET /discovery/communities/summary", "GET /discovery/communities?status=hidden", "GET /discovery/communities?status=featured,listed&category=tech", "GET ...?q=spam", "GET ...?sort=name&limit=5&page=2", "GET ...?status=bogus", "GET ...?category=bogus", "GET ...?sort=bogus"], "-",
      "summary {total:35,listed:23,featured:3,hidden:4,unlisted:5} và total = tổng 4 trạng thái; hidden ra 4; kết hợp ra phép giao; sort=name theo tên; status/category/sort lạ 400. Phần tử: id, name, slug, thumbnail, category, categoryLabel, owner, members, growthPct, engagementPct, rating, ratingCount, discoveryStatus (listed|featured|hidden|unlisted), listedStatus (giá trị thô), searchVisibility, featuredSections, visibility, moderationStatus, discoveryReason, createdAt.")
    A(F, "Quy tắc trạng thái hiển thị (effective discovery): chưa active/khóa/xóa = unlisted; private = hidden; featured khi đang có mục 'featured'", "Chức năng", "Cao", API + " " + SEED_DISC,
      ["GET /discovery/communities?q=design-circle", "?q=crypto-signals-pro", "?q=fin&status=hidden", "?q=growth-lab"], "-",
      "design-circle (pending_review) -> unlisted; crypto-signals-pro (suspended) -> unlisted; fin (private) -> hidden với listedStatus='listed'; growth-lab -> featured với featuredSections=['featured']. " + PENDING_DECISION + " quy tắc hidden/unlisted.")
    A(F, "POST /discovery/communities/:id/status: 400/404/409, ghi lý do, audit, thông báo chủ", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["status {status:'bogus'} -> 400", "status {status:'listed'} trên cộng đồng đang listed -> 409", "mkt {status:'unlisted',reason:'Low quality'} -> 200", "mkt {status:'hidden'} -> 200", "mkt {status:'listed'} -> 200 (discoveryReason=null)", "id 'nope' -> 404"], "mkt",
      "200 trả AdminListedCommunity với discoveryStatus/discoveryReason đúng; 409 'Cộng đồng đã ở trạng thái listed'; chủ (Daniel) nhận thông báo CHỈ khi status != listed; audit discovery.status ×3 (metadata from/to); GET /admin/communities/mkt (đợt 1) phản ánh discovery mới.")
    A(F, "POST feature/unfeature: 200, 409 trùng/không ghim, 400 khi cộng đồng không đủ điều kiện", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["feature mkt {} -> 200 (discoveryStatus 'featured')", "feature lần 2 -> 409 'Cộng đồng đã có trong mục này'", "feature design-circle (chờ duyệt) -> 400", "feature fin (riêng tư) -> 400", "feature spam-hub (unlisted) -> 400", "unfeature mkt {section:'featured'} -> 200 'listed'", "unfeature lần 2 -> 409 'Cộng đồng này không nằm trong mục ghim nào'", "feature id nope -> 404"], "mkt",
      "Đúng mã; 400 'Chỉ ghim được cộng đồng đang hoạt động, công khai và ở trạng thái listed'; unfeature không truyền section thì gỡ khỏi mọi mục; audit discovery.feature / discovery.unfeature.")

    # ============================================================ 15. KHÁM PHÁ - DANH MỤC
    F = "Khám phá · Danh mục"
    A(F, "Trang Danh mục: 8 danh mục seed theo thứ tự, cột và số cộng đồng", "Giao diện", "Cao", UI + " " + SEED_DISC,
      ["Mở /admin/discovery/categories"], "-",
      "Tiêu đề 'Danh mục' (phụ đề 'Danh mục dùng để sắp xếp cộng đồng trong Khám phá.'), nút 'Thêm'; bảng 8 dòng theo cột 'Thứ tự' 1..8: Kinh doanh (/business, 5 cộng đồng), Sáng tạo nội dung (/content, 4), Công nghệ (/tech, 6), Tài chính (/finance, 2), Sức khỏe (/health, 2), Phát triển bản thân (/self, 2), Sở thích (/hobby, 4), Mối quan hệ (/relationships, 1); trạng thái 'Hoạt động'; mô tả mặc định 'Hiển thị trong Khám phá'. Nút 'Chuyển lên' dòng đầu và 'Chuyển xuống' dòng cuối bị vô hiệu.")
    A(F, "Thêm danh mục 'marketing' (phải bấm Thêm): chip khóa, tên gợi ý, toast, vị trí 9", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Bấm 'Thêm'", "Quan sát chip khóa (chỉ còn marketing, design)", "Chọn 'marketing' -> tên tự điền 'Marketing'", "Mô tả 'Danh mục QA' > 'Thêm danh mục'", "GET /api/categories"], "marketing",
      "Modal 'Thêm danh mục'; nút 'Thêm danh mục' bị khóa tới khi chọn khóa + có tên; toast 'Đã thêm danh mục'; dòng mới '/marketing' thứ tự 9, 0 cộng đồng, 'Hoạt động'; GET /api/categories có thêm marketing; lọc /courses?category=marketing dùng được. design: tên gợi ý 'Thiết kế'.")
    A(F, "Thêm danh mục khi đã dùng hết khóa: hiện thông báo 'Đã dùng hết các khóa...'", "Chức năng", "Thấp", UIM + " " + SEED_DISC,
      ["Thêm marketing và design", "Bấm 'Thêm' lần nữa"], "-", "Modal hiện 'Đã dùng hết các khóa danh mục có thể thêm.' và nút 'Thêm danh mục' bị khóa.")
    A(F, "Sửa danh mục: đổi tên/mô tả, hiển thị ở /categories công khai", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Tài chính' > 'Sửa'", "Đổi tên 'Tài chính & Đầu tư', mô tả 'Mô tả QA' > 'Lưu'", "GET /api/categories (không token)"], "finance",
      "Modal 'Sửa danh mục · Tài chính'; nút 'Lưu' khóa khi tên rỗng; toast 'Đã cập nhật danh mục'; bảng hiện tên mới và mô tả mới; /api/categories trả name mới cho id 'finance'; audit category.update.")
    A(F, "Tắt danh mục: biến mất khỏi /api/categories công khai, cộng đồng hiện có không đổi", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Tài chính' > 'Tắt' > xác nhận modal 'Tắt danh mục?'", "GET /api/categories", "GET /api/courses?category=finance", "Mở /admin/discovery/listed lọc 'Tài chính'"], "finance",
      "Toast 'Đã tắt danh mục'; badge 'Đã tắt'; /api/categories chỉ còn 7 danh mục (không có finance); GET /courses?category=finance VẪN trả các cộng đồng finance (fin, mindful-money, crypto) vì danh mục chỉ bị ẩn khỏi bộ lọc; trang admin vẫn lọc được.")
    A(F, "Bật lại danh mục: toast ngay (không modal) và xuất hiện lại ở /api/categories", "Chức năng", "Trung bình", UIM + " " + SEED_DISC,
      ["Tắt 'Tài chính' rồi menu > 'Bật'"], "finance", "Toast 'Đã bật danh mục' ngay lập tức; badge 'Hoạt động'; /api/categories có lại finance đúng thứ tự cũ.")
    A(F, "Chuyển lên/xuống đổi 'Thứ tự' và thứ tự ở /api/categories", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Công nghệ' (thứ 3) > 'Chuyển lên'", "Menu dòng đó > 'Chuyển xuống' hai lần", "GET /api/categories"], "tech",
      "Toast 'Đã cập nhật thứ tự' mỗi lần; cột 'Thứ tự' cập nhật; /api/categories theo thứ tự mới; dòng đầu 'Chuyển lên' và dòng cuối 'Chuyển xuống' bị vô hiệu; audit category.move/reorder.")
    A(F, "API Danh mục: list, thêm 201/409/400, patch 400/404, reorder 400, move 409/400", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["GET /discovery/categories", "POST {key:'finance',name:'Dup'} -> 409", "POST {key:'bogus',name:'x'} -> 400", "POST {key:'marketing',name:'Marketing'} -> 201 (position 9)", "PATCH /finance {} -> 400", "PATCH /nope {name:'x'} -> 404", "PATCH /finance {status:'disabled'} rồi {status:'active',name:'..',description:'..'}",
       "POST /reorder {keys: thiếu 1 khóa} -> 400", "{keys: có khóa lạ} -> 400", "{keys: đảo ngược đủ} -> 200", "POST /<khóa đầu>/move {direction:'up'} -> 409", "POST /finance/move {direction:'sideways'} -> 400"], "-",
      "Phần tử AdminCategory {key,slug=key,name,description,status,position,communities,createdAt}; thông điệp 409 'Danh mục này đã tồn tại' / 'Danh mục đã ở đầu danh sách'; reorder 400 '`keys` phải là hoán vị đủ của các danh mục hiện có'; audit category.create/update/disable/reorder/move.")

    # ============================================================ 16. KHÁM PHÁ - NỔI BẬT
    F = "Khám phá · Nổi bật"
    A(F, "Trang Nổi bật: 4 thẻ mục xếp 2×2 với nhãn tiếng Việt và dữ liệu seed", "Giao diện", "Cao", UI + " " + SEED_DISC,
      ["Mở /admin/discovery/featured"], "-",
      "Tiêu đề 'Nổi bật' (phụ đề 'Chọn những gì thành viên thấy đầu tiên ở trang Khám phá.'); 4 thẻ: 'Cộng đồng nổi bật' (3 mục: #1 Nhiếp ảnh bằng điện thoại, #2 Kiếm tiền với YouTube, #3 Growth Lab), 'Đang thịnh hành' (AI Video Mastery, Code Camp), 'Biên tập viên chọn' (Pixel Pro, Mindful Money), 'Mới & Đáng chú ý' (Fit Forever, Thiết kế với Figma). "
      "Mỗi thẻ có phụ đề '<n> cộng đồng · dùng mũi tên để xếp hạng', mỗi dòng có '#<hạng>', tên, '<Danh mục> · <N> thành viên', 2 ô ngày Bắt đầu/Kết thúc, nút Chuyển lên/xuống/Gỡ và nút 'Tìm & thêm cộng đồng'. KHÔNG có kéo-thả (chỉ mũi tên).")
    A(F, "Mục hết hạn hiển thị 'Ngoài thời hạn' (Fit Forever trong 'Mới & Đáng chú ý')", "Giao diện", "Trung bình", UI + " " + SEED_DISC,
      ["Quan sát dòng Fit Forever ở thẻ 'Mới & Đáng chú ý'"], "Fit Forever", "Dòng meta 'Sức khỏe · 66 thành viên · Ngoài thời hạn'; ô ngày Kết thúc = ngày đã qua 3 ngày trước; mục này KHÔNG xuất hiện ở /api/courses/featured?section=new_noteworthy (chỉ có 'des').")
    A(F, "Sắp xếp lại bằng mũi tên: hạng đổi, toast, thứ tự công khai đổi theo", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Ở thẻ 'Cộng đồng nổi bật' bấm 'Chuyển xuống' ở mục #1", "Quan sát toast và thứ tự", "GET /api/courses/featured?section=featured"], "featured",
      "Toast 'Đã cập nhật thứ hạng'; thứ tự mới #1 Kiếm tiền với YouTube, #2 Nhiếp ảnh...; nút 'Chuyển lên' của mục đầu và 'Chuyển xuống' của mục cuối bị vô hiệu; API công khai trả cùng thứ tự mới (yt, photo, growth-lab); audit discovery.reorder.")
    A(F, "Gỡ khỏi mục: nút X, toast, cộng đồng biến mất khỏi API công khai", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Ở thẻ 'Đang thịnh hành' bấm nút 'Gỡ khỏi danh sách' ở Code Camp", "GET /api/courses/featured?section=trending"], "code-camp", "Toast 'Đã gỡ khỏi Đang thịnh hành'; chỉ còn AI Video Mastery; thứ hạng các mục sau tự dồn lại (position liên tục từ 1); audit discovery.unfeature.")
    A(F, "Thêm cộng đồng vào mục bằng 'Tìm & thêm cộng đồng' (menu ứng viên)", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Ở thẻ 'Biên tập viên chọn' bấm 'Tìm & thêm cộng đồng'", "Xem tiêu đề menu và danh sách", "Chọn 'Marketing thực chiến'"], "mkt",
      "Menu có tiêu đề 'THÊM VÀO BIÊN TẬP VIÊN CHỌN'; chỉ liệt kê cộng đồng 'Đang hiển thị/Nổi bật' (listed+featured, active+public) CHƯA có trong mục này (không có Pixel Pro, Mindful Money, cộng đồng ẩn/riêng tư/chờ duyệt) kèm nhãn danh mục; chọn -> toast 'Đã thêm vào Biên tập viên chọn', mục mới ở cuối (#3); API công khai editors_picks có mkt.")
    A(F, "Thêm khi không còn cộng đồng đủ điều kiện: toast lỗi", "Chức năng", "Thấp", UIM + " " + SEED_DISC + " Cần thêm hết cộng đồng ứng viên vào một mục (hoặc dùng DB nhỏ).",
      ["Thêm lần lượt mọi ứng viên vào một mục", "Bấm 'Tìm & thêm cộng đồng' lần nữa"], "-", "Toast lỗi 'Không còn cộng đồng nào đủ điều kiện để thêm.'; không mở menu.", pw="Không")
    A(F, "Đổi ngày bắt đầu/kết thúc: lưu ngay khi chọn, ô kết thúc không cho chọn trước ngày bắt đầu", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Ở thẻ 'Cộng đồng nổi bật' đổi 'Kết thúc Growth Lab' sang 5 ngày sau", "Thử chọn ngày kết thúc trước ngày bắt đầu", "Xóa trắng ô ngày kết thúc"], "growth-lab",
      "Mỗi lần chọn xong gọi PATCH ngay, toast 'Đã cập nhật thời hạn'; ngày lưu theo UTC (đầu ngày 00:00:00 / cuối ngày 23:59:59) nên hiển thị lại đúng ngày đã chọn; ô Kết thúc có thuộc tính min = ngày bắt đầu; xóa trắng = bỏ giới hạn (endsAt=null) và mục 'active' mãi; đặt kết thúc trong quá khứ -> dòng 'Ngoài thời hạn' và mất khỏi API công khai.")
    A(F, "Mục có thời hạn tương lai (bắt đầu sau hôm nay) chưa hiện ở API công khai", "Chức năng", "Trung bình", UIM + " " + SEED_DISC,
      ["Ở thẻ 'Đang thịnh hành' đặt 'Bắt đầu AI Video Mastery' = 7 ngày sau", "GET /api/courses/featured?section=trending"], "ai", "Dòng hiển thị 'Ngoài thời hạn' (chưa tới ngày); API công khai không còn ai trong trending (chỉ code-camp); tới ngày bắt đầu thì xuất hiện lại.")
    A(F, "Thẻ rỗng hiện 'Chưa có cộng đồng nào trong mục này.'", "Giao diện", "Thấp", UIM + " " + SEED_DISC, ["Gỡ hết mục của 'Đang thịnh hành'"], "trending", "Thẻ hiện 'Chưa có cộng đồng nào trong mục này.' và vẫn còn nút 'Tìm & thêm cộng đồng'; /api/courses/featured?section=trending trả data=[].")
    A(F, "API Nổi bật: GET luôn đủ 4 section; thêm 201/409/400/404; patch/xóa/reorder", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["GET /discovery/featured", "POST {section:'editors_picks',courseId:'mkt'} -> 201 (position 3)", "lặp lại -> 409", "POST {section:'bogus',courseId:'mkt'} -> 400", "POST {section:'featured',courseId:'nope'} -> 404", "POST {section:'featured',courseId:'fin'} -> 400",
       "POST với startsAt 2030-01-02, endsAt 2030-01-01 -> 400", "PATCH /featured/<entryId> {endsAt:null} -> 200", "PATCH {startsAt:2030-01-02,endsAt:2030-01-01} -> 400", "reorder /editors_picks với entryIds thiếu 1 phần tử -> 400", "reorder đảo ngược đủ -> 200", "reorder /nope -> 404", "DELETE /featured/<entryId> -> {removed:true}", "DELETE lần 2 -> 404"], "mkt",
      "GET trả sections [featured, trending, editors_picks, new_noteworthy] với label tiếng Anh ('Featured Communities', 'Trending', \"Editor's Picks\", 'New & Noteworthy') và items {id(entryId),position,startsAt,endsAt,active,community}; POST 201 trả {section,id,position,...,community}; 409 'Cộng đồng đã có trong mục này'; reorder 400 '`entryIds` phải là hoán vị đủ của các mục trong section'; audit discovery.feature/feature_update/reorder/unfeature.")
    A(F, "GET /api/courses/featured (công khai): section mặc định 'featured', limit, thứ tự theo position, 400 section lạ", "Chức năng", "Cao", BASE2 + " Không cần đăng nhập (kiểm tra cả khi có token).",
      ["GET /api/courses/featured", "GET /api/courses/featured?section=trending&limit=1", "GET /api/courses/featured?section=editors_picks", "GET /api/courses/featured?section=new_noteworthy", "GET /api/courses/featured?section=bogus"], "-",
      "Mặc định = featured: [photo, yt, growth-lab]; trending limit=1: [ai]; editors_picks: [pixel-pro, mindful-money]; new_noteworthy: [des] (Fit Forever hết hạn bị loại); section lạ 400. Chỉ trả cộng đồng còn hiệu lực, active, public, chưa xóa/khóa, discoveryStatus=listed.")

    # ============================================================ 17. KHÁM PHÁ - XẾP HẠNG
    F = "Khám phá · Xếp hạng"
    A(F, "Trang Xếp hạng: 6 yếu tố, tổng trọng số, thời điểm cập nhật và bảng xem trước", "Giao diện", "Cao", UI + " " + SEED_DISC,
      ["Mở /admin/discovery/rankings"], "-",
      "Tiêu đề 'Xếp hạng' (phụ đề 'Cấu hình cách thuật toán xếp hạng cộng đồng trong Khám phá.'); thẻ 'Yếu tố xếp hạng' phụ đề 'Trọng số · tổng 100% · cập nhật <ngày giờ> bởi Platform Admin'; 6 dòng: Tăng trưởng thành viên 25%, Tương tác 25%, Giữ chân 20%, Đánh giá 15%, Doanh thu 10%, Trừ điểm báo cáo 5% (thanh đỏ); "
      "bảng 'Xem trước xếp hạng' (sub 'Kết quả theo trọng số đã áp dụng') cột Hạng/Cộng đồng/Điểm/Danh mục, 26 cộng đồng (listed+public+active), top lúc seed ai (68.0), yoga (66.0), py (65.2). Nút 'Áp dụng xếp hạng' bị vô hiệu, 'Đặt lại trọng số' bấm được. " + PENDING_DECISION + " trọng số mặc định chưa chốt.")
    A(F, "Nút −/+ đổi trọng số theo bước 5, chặn ở 0 và 60", "Chức năng", "Cao", UI,
      ["Bấm '+' ở 'Đánh giá' 3 lần", "Bấm '−' ở 'Trừ điểm báo cáo' 2 lần", "Bấm '−' ở 'Doanh thu' đến 0", "Bấm '+' ở 'Đánh giá' đến khi dừng"], "-",
      "Đánh giá 15→30; Trừ điểm báo cáo 5→0 (nút '−' bị vô hiệu ở 0); Doanh thu 10→0 sau 2 lần; 'Tăng Đánh giá' bị vô hiệu ở 60% (giới hạn UI 60 dù API cho tới 100); tổng cập nhật ('tổng N%'), phụ đề thêm '· chưa áp dụng', thanh trọng số đổi độ dài.")
    A(F, "Xem trước trực tiếp khi chỉnh trọng số (không lưu) và hiển thị 'Đang tính…'", "Chức năng", "Cao", UI,
      ["Chỉnh nhiều lần, quan sát phụ đề bảng", "F5 trang"], "-",
      "Mỗi lần chỉnh gọi POST /discovery/rankings/preview; phụ đề 'Đang tính theo trọng số mới…' rồi 'Kết quả theo trọng số đang chỉnh (chưa áp dụng)'; thứ hạng/điểm thay đổi theo trọng số; F5 -> trọng số quay lại đã publish (preview không lưu).")
    A(F, "Chỉ chấm điểm theo Đánh giá: cộng đồng đánh giá cao xếp trước, điểm = rating% × trọng số", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Đặt trọng số: Tăng trưởng 0, Tương tác 0, Giữ chân 0, Đánh giá 60, Doanh thu 0, Trừ điểm báo cáo 0 (dùng −/+)", "Quan sát bảng xem trước"], "rating 60 / còn lại 0",
      "Cộng đồng có rating 4.9 (ai, py, data, music, eng, yoga, fin) điểm 58.8 (=98×60/100) xếp đầu; cộng đồng chưa có đánh giá (growth-lab, code-camp...) điểm 0.0 xếp cuối; công thức score = Σ(5 tín hiệu × trọng số)/100 − reportPenalty×wPenalty/100.")
    A(F, "Trừ điểm báo cáo: cộng đồng có báo cáo 30 ngày (yt) bị trừ điểm", "Chức năng", "Trung bình", UIM + " " + SEED_DISC,
      ["Tăng 'Trừ điểm báo cáo' lên 40", "Tìm 'yt' (Kiếm tiền với YouTube) trong bảng xem trước, so hạng với trước khi chỉnh"], "yt",
      "yt có tín hiệu reportPenalty=20 (2 báo cáo/30 ngày × 10): điểm giảm = 20 × (40−5)/100 = 7.0 và hạng của yt tụt xuống rõ rệt; cộng đồng không có báo cáo giữ nguyên điểm phần này.")
    A(F, "Áp dụng xếp hạng: modal, toast, trọng số lưu, người cập nhật, thứ tự công khai sort=ranked", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Chỉnh trọng số (Đánh giá 60, các mục khác 0 theo thứ tự cho phép)", "Bấm 'Áp dụng xếp hạng' > ghi chú 'QA' > xác nhận", "F5", "GET /api/courses?sort=ranked&limit=10"], "rating 60",
      "Modal 'Áp dụng xếp hạng?' ('Trọng số mới được lưu và dùng ngay...'); toast 'Đã áp dụng xếp hạng'; nút 'Áp dụng xếp hạng' vô hiệu lại; F5 vẫn giữ trọng số mới, 'cập nhật <giờ hiện tại> bởi Platform Admin'; GET /courses?sort=ranked trả cộng đồng rating cao trước (ai, py, ...); audit discovery.ranking_publish (metadata before/weights, note 'QA').")
    A(F, "Đặt lại trọng số về mặc định 25/25/20/15/10/5 và áp dụng ngay", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Sau khi đã áp dụng trọng số khác, bấm 'Đặt lại trọng số' > xác nhận"], "-", "Modal 'Đặt lại trọng số?' ('quay về mặc định và được áp dụng ngay'); toast 'Đã đặt lại trọng số'; 6 yếu tố về 25/25/20/15/10/5; sort=ranked theo mặc định; audit discovery.ranking_reset. " + PENDING_DECISION + " trọng số mặc định.")
    A(F, "Bảng xem trước giới hạn 50 dòng và ghi chú 'Hiển thị 50 / N'", "Giao diện", "Thấp", UI + " Cần > 50 cộng đồng listed+public (tạo thêm bằng đăng ký/duyệt hoặc dữ liệu lớn).", ["Mở /admin/discovery/rankings với > 50 cộng đồng"], "-", "Bảng chỉ hiện 50 dòng đầu và chân bảng 'Hiển thị 50 / <N> cộng đồng'.", pw="Không")
    A(F, "API Xếp hạng: GET, preview không lưu, validate trọng số 0–100 và đủ 6 khóa", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["GET /discovery/rankings", "POST /rankings/preview {weights:{rating:10}} -> 400", "POST /rankings/preview {weights:{memberGrowth:0,engagement:0,retention:0,rating:101,revenue:0,reportPenalty:0}} -> 400", "POST /rankings/preview {weights:{...rating:100, còn lại 0}} -> 200", "GET /discovery/rankings lại"], "rating 100",
      "GET: {weights,defaults(25/25/20/15/10/5),updatedAt,updatedBy,preview[] với rank liên tục 1..n và signals{memberGrowth,engagement,retention,rating,revenue,reportPenalty}}; preview 200 có score = 98.0 cho cộng đồng rating 4.9 và 100 cho rating 5; GET lại vẫn trọng số cũ (preview không lưu).")
    A(F, "API publish/reset: PUT lưu + sort=ranked công khai dùng ngay; reset về mặc định; audit", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["PUT /discovery/rankings {weights:{rating:100, còn lại 0}, note:'Rating only'} -> 200", "GET /api/courses?sort=ranked&limit=50 (token bất kỳ)", "POST /discovery/rankings/reset -> 200 weights mặc định", "GET /api/courses?sort=bogus -> 400", "GET /admin/audit-logs?targetId=rankings"], "rating 100",
      "PUT trả đúng dạng GET (kèm preview) với updatedBy = Platform Admin; sort=ranked đặt cộng đồng rating cao trước cộng đồng rating thấp; reset trả defaults; sort=bogus 400; audit có discovery.ranking_publish và discovery.ranking_reset.")
    A(F, "Công thức tín hiệu: growth/engagement/retention/rating/revenue/reportPenalty chuẩn hóa 0–100", "Chức năng", "Trung bình", API + " " + SEED_DISC,
      ["GET /discovery/rankings, lấy signals của growth-lab và ai", "Đối chiếu SQL: số thành viên mới 30 ngày, % hoạt động 30 ngày, % thành viên ≥14 ngày còn hoạt động, MRR (Subscription active) / $450, số Report 30 ngày × 10"], "growth-lab, ai",
      "ai: memberGrowth 33 (growthPct 32.7 làm tròn), engagement 100, retention 100, rating 98, revenue 0, reportPenalty 0; growth-lab: revenue>0 (MRR gói active / 45000 cent, cắt 100), reportPenalty=0; score làm tròn 1 chữ số. " + PENDING_DECISION + " công thức/ngưỡng (MRR $450) chưa chốt.", pw="Một phần")

    # ============================================================ 18. KHÁM PHÁ - HIỂN THỊ TÌM KIẾM
    F = "Khám phá · Hiển thị tìm kiếm"
    A(F, "Trang Hiển thị tìm kiếm: 4 KPI và 4 tab có đếm", "Giao diện", "Cao", UI + " " + SEED_DISC,
      ["Mở /admin/discovery/seo"], "-",
      "Tiêu đề 'Hiển thị tìm kiếm' (phụ đề 'Điều chỉnh cách cộng đồng hiển thị trong tìm kiếm.'); KPI 'Tổng cộng đồng' 35, 'Cho phép tìm kiếm' 33, 'Giảm hiển thị' 1 (đỏ), 'Đã ẩn' 1 (đỏ); tab: Tất cả (35), Cho phép tìm kiếm (33), Giảm hiển thị (1: Xây dựng doanh nghiệp Online), Đã ẩn (1: Spam Hub).")
    A(F, "Bảng Hiển thị tìm kiếm: cột, điểm chất lượng và số vi phạm", "Giao diện", "Trung bình", UI + " " + SEED_DISC,
      ["Gõ 'spam-hub'", "Gõ 'photo'"], "spam-hub | photo",
      "spam-hub: Trạng thái tìm kiếm 'Đã ẩn', Trạng thái khám phá 'Gỡ khỏi khám phá', Điểm chất lượng 35 (thanh đỏ), Vi phạm 0, Thành viên ≈61. photo: 'Cho phép tìm kiếm', 'Nổi bật', điểm 75, Vi phạm 1 (báo cáo đã xử lý bằng hành động thực sự).")
    A(F, "Công thức điểm chất lượng: 40×rating/5 + 25×tương tác + 15 (mô tả ≥80 ký tự) + 10 (có ảnh bìa) + 10 (có bài 30 ngày) − 8×vi phạm", "Chức năng", "Trung bình", UI + " " + SEED_DISC + " " + PENDING_DECISION + " công thức chưa chốt.",
      ["Tìm growth-lab, paid-demo, spam-hub và đối chiếu thành phần với DB (rating, % hoạt động, độ dài mô tả, thumbnail, số bài 30 ngày, báo cáo đã xử lý)"], "growth-lab, spam-hub",
      "growth-lab = 0 + 25 (tương tác 100%) + 15 + 10 + 10 = 60; spam-hub (mô tả 'Kiếm tiền nhanh.', thumbnail rỗng) = 25 + 0 + 0 + 10 = 35; paid-demo/private-demo = 45; điểm bị cắt trong 0–100.", pw="Một phần")
    A(F, "Tab và tìm kiếm: lọc 'Giảm hiển thị', 'Đã ẩn' và tìm theo tên/id", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Bấm tab 'Giảm hiển thị'", "Bấm tab 'Đã ẩn'", "Tab 'Tất cả' gõ 'biz'"], "biz", "Giảm hiển thị: biz; Đã ẩn: spam-hub; tìm 'biz' ra dòng id biz (cả tên chứa 'biz' nếu có).")
    A(F, "Sắp xếp: nhãn 'Điểm chất lượng thấp nhất' đang trả điểm CAO nhất trước", "Chức năng", "Trung bình", UI + " " + SEED_DISC,
      ["Chọn 'Sắp xếp' = 'Điểm chất lượng thấp nhất'", "So thứ tự với 'Tên A–Z' và 'Nhiều vi phạm nhất'"], "sort=quality",
      "KỲ VỌNG SAU KHI SỬA: thấp nhất trước (spam-hub 35, paid-demo 45...). HIỆN TẠI: option 'quality' trả quality GIẢM dần (cộng đồng 84 điểm đứng đầu, spam-hub gần cuối) - nhãn trái với dữ liệu; 'Nhiều vi phạm nhất' đặt photo/yt (1 vi phạm) lên đầu.", st=PLAN)
    A(F, "Menu thao tác theo trạng thái tìm kiếm (Cho phép/Giảm hiển thị/Ẩn/Xem chi tiết)", "Chức năng", "Cao", UI + " " + SEED_DISC,
      ["Menu 'Growth Lab' (searchable)", "Menu 'biz' (reduced)", "Menu 'Spam Hub' (hidden)"], "-",
      "searchable: Giảm hiển thị, Ẩn khỏi tìm kiếm (đỏ), Xem chi tiết. reduced: Cho phép tìm kiếm, Ẩn khỏi tìm kiếm, Xem chi tiết. hidden: Cho phép tìm kiếm, Giảm hiển thị, Xem chi tiết. Bấm cả dòng/Xem chi tiết mở /admin/communities/<id>.")
    A(F, "Ẩn khỏi tìm kiếm: lý do tùy chọn, toast, cộng đồng biến mất khỏi /search và /courses?q=", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Growth Lab' > 'Ẩn khỏi tìm kiếm' > lý do 'Spam' > xác nhận", "GET /api/search?q=Growth&type=courses (token member)", "GET /api/courses?q=Growth", "GET /api/courses?limit=50"], "growth-lab",
      "Modal 'Ẩn khỏi tìm kiếm?' ('Cộng đồng bị loại khỏi kết quả tìm kiếm trên nền tảng.'); toast 'Đã ẩn khỏi tìm kiếm'; badge 'Đã ẩn', KPI Đã ẩn 1→2; /search và /courses?q=Growth KHÔNG còn growth-lab; /courses không từ khóa VẪN có growth-lab (chỉ ảnh hưởng tìm kiếm); audit discovery.search_visibility.")
    A(F, "Giảm hiển thị: cộng đồng xếp SAU kết quả bình thường trong /search và /courses?q=", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Pixel Pro' > 'Giảm hiển thị' > xác nhận", "GET /api/search?q=Pro&type=courses (và q chung khớp nhiều cộng đồng, ví dụ q=a)", "GET /api/courses?q=a"], "pixel-pro",
      "Toast 'Đã giảm hiển thị'; trong mọi kết quả chứa pixel-pro, nó đứng SAU tất cả cộng đồng 'searchable' (kể cả khi theo mặc định đứng trước); biz (đã reduced từ seed) cũng ở cuối nhóm.")
    A(F, "Cho phép tìm kiếm lại: spam-hub, nhưng muốn hiện ở /courses cần Hiển thị lại ở Khám phá", "Chức năng", "Cao", UIM + " " + SEED_DISC,
      ["Menu 'Spam Hub' (searchVisibility hidden) > 'Cho phép tìm kiếm' > xác nhận", "GET /api/search?q=Spam&type=courses", "GET /api/courses?q=Spam"], "spam-hub",
      "Toast 'Đã cho phép tìm kiếm'; /search?q=Spam trả spam-hub (search không lọc discoveryStatus, chỉ searchVisibility); /courses?q=Spam KHÔNG trả vì spam-hub vẫn 'unlisted' (cần 'Hiển thị lại' ở Cộng đồng hiển thị).")
    A(F, "Khác biệt /search và /courses?q=: discoveryStatus hidden/unlisted vẫn nằm trong /search nếu searchable", "Chức năng", "Trung bình", API + " " + SEED_DISC,
      ["GET /api/search?q=Sống&type=courses (token member)", "GET /api/courses?q=Sống"], "Sống",
      "/search trả eng và fit (fit là unlisted nhưng searchVisibility=searchable); /courses?q chỉ trả eng (loại fit vì không listed). Đúng mục 7 và 8 'Khác biệt' của admin-batch2.md.")
    A(F, "API Hiển thị tìm kiếm: list/summary lọc searchStatus/discoveryStatus, sort, 400, set 409", "Chức năng", "Cao", APIM + " " + SEED_DISC,
      ["GET /discovery/search-visibility/summary", "GET ...?searchStatus=hidden", "GET ...?searchStatus=reduced,hidden&discoveryStatus=unlisted", "GET ...?sort=violations&limit=3", "GET ...?searchStatus=bogus", "POST /discovery/communities/mkt/search-visibility {visibility:'bogus'} -> 400", "{visibility:'searchable'} trên mkt (đã searchable) -> 409", "{visibility:'reduced',reason:'Low quality'} -> 200 (qualityScore 0-100)", "id nope -> 404"], "mkt",
      "summary {total:35,searchable:33,reduced:1,hidden:1}; searchStatus=hidden ra spam-hub; sort=violations đặt photo/yt (1 vi phạm) trước; item {id,name,thumbnail,category,searchVisibility,discoveryStatus,qualityScore,violations,members}; 409 'Cộng đồng đã ở trạng thái searchable'; audit discovery.search_visibility (metadata from/to).")

    # ============================================================ 19. TÁC ĐỘNG LÊN API/GIAO DIỆN CÔNG KHAI
    F = "Tác động lên API / giao diện công khai"
    A(F, "Bài viết bị admin GỠ biến mất với MỌI người (kể cả tác giả và mod); bài bị ẨN vẫn thấy với tác giả/mod", "Chức năng", "Cao", UIM + " Dùng cộng đồng photo: member1@ (tác giả bài), member2@ (thành viên), mod@ (mod photo), cadmin@/owner@. Admin lấy id một bài của member1 ở photo bằng GET /admin/content/posts?courseId=photo&q=member1.",
      ["Mỗi tài khoản: GET /api/courses/photo/posts?limit=50 và GET /api/posts/<id>", "Admin ẨN bài, lặp lại kiểm tra cho từng tài khoản", "Admin GỠ bài, lặp lại", "Admin KHÔI PHỤC, lặp lại"], "bài của member1 ở photo",
      "Sau ẨN: member2 không thấy (list + GET 404); member1 (tác giả) và mod/cadmin/owner vẫn thấy kèm hidden=true. Sau GỠ: không ai thấy kể cả tác giả/mod (list không có, GET /posts/:id = 404; chỉ admin còn thấy). Sau KHÔI PHỤC: mọi người thấy lại.")
    A(F, "Bình luận bị gỡ không còn ở bài, số bình luận (commentsCount) giảm trên bảng tin", "Chức năng", "Trung bình", UIM + " " + SEED_CMT + " Đăng nhập daniel@sofinhub.test.",
      ["Admin gỡ CMT-A3B80A38 (growth-lab)", "daniel@: GET /api/courses/growth-lab/posts và xem commentsCount của POST-2467DDA0", "Mở trang bảng tin growth-lab trên FE và bài đó"], "CMT-A3B80A38", "Bài POST-2467DDA0 giảm 1 bình luận (API và FE), bình luận không còn trong danh sách; khôi phục thì tăng lại 1.", pw="Một phần")
    A(F, "/courses (danh sách công khai) chỉ trả cộng đồng discoveryStatus=listed (seed: 29)", "Chức năng", "Cao", BASE2 + " Không cần token (hoặc token member bất kỳ).",
      ["GET /api/courses?limit=50", "Đếm meta.total và so với danh sách cộng đồng seed"], "-",
      "total=29; KHÔNG chứa: biz (hidden), fit, spam-hub, design-circle, crypto-signals-pro, quick-rich-club (unlisted/chưa duyệt/đình chỉ); CÓ chứa fin, lead, private-demo (riêng tư vẫn listed ở cột thô). Trang chủ FE (http://localhost:5173/) hiển thị cùng tập này.")
    A(F, "Cộng đồng hidden/unlisted vẫn mở bằng link trực tiếp và tham gia được", "Chức năng", "Cao", UIM + " Admin ẩn 'mkt' khỏi Khám phá. Đăng nhập newbie@sofinhub.test.",
      ["newbie@: GET /api/courses/mkt", "Mở http://localhost:5173/courses/mkt", "newbie@: POST /api/courses/mkt/join (nếu miễn phí/cho phép)"], "mkt",
      "GET /courses/mkt = 200; trang giới thiệu hiển thị bình thường; tham gia thực hiện được theo luồng thường (hidden/unlisted chỉ ẩn khỏi danh sách/tìm kiếm).", pw="Một phần")
    A(F, "Danh mục: /api/categories chỉ trả danh mục 'active' theo thứ tự admin đặt", "Chức năng", "Cao", BASE2 + " Không cần token.",
      ["GET /api/categories", "Admin tắt 'Công nghệ' rồi gọi lại", "Admin thêm 'marketing' rồi gọi lại"], "-",
      "Seed: 8 phần tử {id,name} theo thứ tự business, content, tech, finance, health, self, hobby, relationships; sau khi tắt tech: 7 phần tử không còn tech; sau khi thêm marketing: có marketing ở cuối (và FE chip bộ lọc ở trang chủ phản ánh).")
    A(F, "Trường mới của API công khai: Course.searchVisibility, Event.cancelledAt, trạng thái gói past_due|paused, payout failed|on_hold, danh mục marketing|design", "Chức năng", "Trung bình", API + " Đăng nhập daniel@/maya@ và owner@ khi cần.",
      ["GET /api/courses/<id cộng đồng reduced = biz> -> trường searchVisibility", "GET /api/courses/growth-lab -> không có searchVisibility (chỉ khi khác 'searchable')", "maya@: GET /api/me/subscriptions (có past_due, paused)", "owner hoặc chủ có payout failed/on_hold: GET /api/courses/<id>/payouts", "GET /api/courses?category=marketing sau khi thêm danh mục"], "-",
      "biz có searchVisibility='reduced'; growth-lab không có trường; /me/subscriptions trả status 'past_due'/'paused' đúng; payout hiển thị 'failed'/'on_hold' cho chủ cộng đồng; category=marketing hợp lệ (không 400).", pw="Một phần")
    A(F, "Tạm dừng gói tước quyền truy cập cộng đồng (API công khai 403) và Tiếp tục cấp lại", "Chức năng", "Cao", UIM + " " + SEED_SUB + " Đăng nhập daniel@sofinhub.test.",
      ["daniel@: GET /api/courses/growth-lab/posts (200)", "Admin tạm dừng SUB-5BC76879", "daniel@ gọi lại", "Admin tiếp tục", "daniel@ gọi lại"], "SUB-5BC76879", "Sau tạm dừng: 403 (không còn là thành viên, enrollment bị xóa); sau tiếp tục: 200 trở lại (enrollment cấp lại, trừ khi bị cấm khỏi cộng đồng).")
    A(F, "Sự kiện bị hủy: hiển thị 'đã hủy' trên FE công khai và không RSVP được", "Chức năng", "Trung bình", UIM + " " + SEED_EVT + " Đăng nhập emma@sofinhub.test (thành viên growth-lab).",
      ["Admin hủy 'Growth AMA with the founders'", "emma@ mở http://localhost:5173/courses/growth-lab/community/lich", "Thử bấm tham gia"], "Growth AMA", "Lịch hiển thị sự kiện kèm trạng thái đã hủy; bấm tham gia báo lỗi (API 409); người đã RSVP trước đó thấy thông báo hủy.", pw="Một phần")
    A(F, "Mọi thao tác ghi đợt 2 để lại 1 dòng audit mà không sửa dữ liệu ngoài phạm vi", "Chức năng", "Cao", APIM,
      ["Thực hiện 1 thao tác mỗi nhóm: post.hide, comment.remove, course.unpublish, lesson.hide, event.cancel, media.flag, payment.refund, subscription.pause, refund.reject, chargeback.create, payout.hold, discovery.status, category.disable, discovery.ranking_publish",
       "GET /admin/audit-logs?limit=30"], "-", "Mỗi thao tác đúng 1 dòng audit (actor = Platform Admin, targetType/targetId/targetLabel/reason đúng); thao tác thất bại (400/404/409) KHÔNG để lại dòng audit.")

    # ============================================================ 20. AUDIT LOG & THÔNG BÁO
    F = "Nhật ký audit & thông báo đợt 2"
    A(F, "Nhật ký audit seed đợt 2 hiện trong /admin/system/audit", "Chức năng", "Trung bình", UI + " " + SEED_AUD,
      ["Mở /admin/system/audit", "Gõ 'Spam' vào ô 'Tìm trong nhật ký...'", "Lọc 'Loại hành động' = 'Thanh toán'"], "Spam",
      "Có 13 dòng seed đợt 2 (cùng seed đợt 1); tìm 'Spam' ra các dòng liên quan (post.hide, discovery.status/search_visibility của Spam Hub); bộ lọc 'Thanh toán' chỉ khớp tiền tố 'payment.' nên KHÔNG chứa refund.approve, payout.*, subscription.*, chargeback.* (hành vi hiện tại).")
    A(F, "Nhật ký hoạt động hiển thị nhãn thô cho hành động/đối tượng đợt 2 (chưa Việt hóa)", "Giao diện", "Thấp", UI + " " + SEED_AUD,
      ["Mở /admin/system/audit, đọc cột 'Hành động' và 'Đối tượng' của dòng post.hide, payout.hold, discovery.status"], "post.hide",
      "KỲ VỌNG SAU KHI LÀM: nhãn tiếng Việt (vd 'Ẩn bài viết', 'Tạm giữ chi trả'), nhóm lọc cho Nội dung/Khám phá/Chi trả. HIỆN TẠI: cột Hành động hiện đúng chuỗi mã (post.hide, payout.hold, discovery.status...), cột Đối tượng hiện '<nhãn> (<targetType thô>)' vì bảng AUDIT_ACTION/TARGET của FE chỉ có nhãn cho nhóm đợt 1.", st=PLAN)
    A(F, "API audit-logs lọc theo targetType/targetId/action/q cho đối tượng đợt 2", "Chức năng", "Cao", API + " " + SEED_AUD,
      ["GET /admin/audit-logs?targetType=payout&limit=10", "GET /admin/audit-logs?targetType=post", "GET /admin/audit-logs?targetId=rankings", "GET /admin/audit-logs?action=discovery.status", "GET /admin/audit-logs?q=Spam"], "-",
      "payout: 2 dòng seed (payout.hold, payout.mark_failed); post: 2 dòng (post.hide, post.remove); targetId=rankings: trống khi chưa publish; action=discovery.status: 1 dòng Spam Hub; mỗi dòng có actor {name:'Platform Admin'}, targetLabel, reason, metadata; mới nhất trước.")
    A(F, "'Lịch sử quản trị' trong modal xem trước/chi tiết khớp audit-logs (tối đa 10 dòng mới nhất)", "Chức năng", "Trung bình", UIM + " " + SEED_POST,
      ["Ẩn rồi gỡ rồi khôi phục POST-3B032FD4", "Mở Xem trước bài đó", "So với GET /admin/audit-logs?targetId=<id>"], "POST-3B032FD4", "'Lịch sử quản trị' liệt kê post.restore, post.remove, post.hide theo thứ tự mới nhất trước, đúng bằng audit-logs; mỗi dòng hiện hành động, người thực hiện, lý do, thời gian.")
    A(F, "Thông báo của người dùng khi bị admin tác động (type system, có link về cộng đồng)", "Chức năng", "Trung bình", UIM + " " + SEED_POST,
      ["Ẩn POST-2467DDA0, hủy xuất bản một khóa, đánh dấu payout thất bại, gỡ khỏi Discovery", "Đăng nhập chủ/tác giả tương ứng, GET /api/notifications"], "-",
      "Mỗi tác động tạo thông báo type='system' với title/body đúng mẫu (Bài viết của bạn đã bị ẩn / Khóa học đã bị hủy xuất bản / Chuyển tiền thất bại / Cộng đồng đã bị gỡ khỏi Discovery), courseId của cộng đồng; unread-count tăng 1.")
    A(F, "Thông báo không gửi khi bỏ chọn tùy chọn thông báo hoặc khi khôi phục", "Chức năng", "Trung bình", APIM + " " + SEED_POST,
      ["hide POST-1415C1D0 {reason:'Spam',notifyAuthor:false}", "restore", "cancel sự kiện {reason:'x',notifyAttendees:false}", "remove media {reason:'x',notifyOwner:false}", "GET /api/notifications của các bên liên quan"], "-", "Không có thông báo mới cho tác giả/người RSVP/chủ tệp; restore (post, event, media) không bao giờ gửi thông báo.")

    # ============================================================ 21. API: VALIDATE CHUNG
    F = "API đợt 2 · Validate & tính ổn định"
    for res, path in (("content/posts", "/content/posts"), ("payments/transactions", "/payments/transactions"), ("discovery/communities", "/discovery/communities")):
        A(F, f"Phân trang {path}: limit/page hợp lệ và không hợp lệ", "Chức năng", "Trung bình", API,
          [f"GET /admin{path}?limit=0", f"GET /admin{path}?limit=101", f"GET /admin{path}?page=0", f"GET /admin{path}?page=abc", f"GET /admin{path}?limit=100&page=1", f"GET /admin{path}?page=9999"], "-",
          "limit=0, 101, page=0, page=abc -> 400 VALIDATION_ERROR; limit=100 -> 200 với meta.limit=100; page quá lớn -> 200 data=[] (meta.totalPages giữ nguyên, không lỗi 500).")
    A(F, "Chuỗi tìm kiếm q > 100 ký tự và ký tự đặc biệt không gây lỗi 500", "Bảo mật", "Trung bình", API,
      ["GET /admin/content/posts?q=<101 ký tự a>", "GET /admin/content/posts?q=%27%20OR%201%3D1--", "GET /admin/payments/transactions?q=%25%25", "GET /admin/content/media?q=<script>alert(1)</script>"], "-", "q > 100 -> 400; các chuỗi còn lại -> 200 với danh sách rỗng hoặc khớp theo nghĩa đen (tham số hóa, không SQL injection; ký tự % và _ tìm theo nghĩa đen/không crash).")
    A(F, "Nội dung bài/bình luận chứa HTML/script được hiển thị dạng văn bản (không thực thi) trong trang admin", "Bảo mật", "Cao", UIM + " Cần bài có nội dung '<img src=x onerror=alert(1)>' (member đăng bài ở một cộng đồng).",
      ["Member đăng bài với nội dung chứa thẻ HTML/script", "Admin mở /admin/content/posts, tìm bài, mở 'Xem trước'"], "<img src=x onerror=alert(1)>", "Cả bảng và modal hiển thị đúng chuỗi ký tự (đã escape), không có hộp thoại alert, không chèn phần tử DOM.")
    A(F, "reason > 500 ký tự hoặc note > 2000 ký tự bị từ chối 400; reason chỉ khoảng trắng 400", "Chức năng", "Trung bình", APIM + " " + SEED_POST,
      ["POST /content/posts/<id>/hide {reason:'<501 ký tự>'}", "{reason:'   '}", "{reason:'Spam',note:'<2001 ký tự>'}", "payouts/<id>/hold {reason:'<501>'}"], "-", "Tất cả 400 VALIDATION_ERROR (details nêu trường reason/note); dữ liệu không đổi.")
    A(F, "Body JSON sai cú pháp hoặc thiếu body trả 400 (không 500)", "Chức năng", "Thấp", APIM,
      ["POST /admin/content/posts/<id>/hide với body '{reason' (cụt)", "POST không gửi body tới /payments/payouts/<id>/approve (không bắt buộc)", "POST /payments/transactions/<id>/refund không gửi body"], "-", "Body cụt: 400 BAD_REQUEST; approve không body: 200 (chỉ có note tùy chọn); refund không body: 400 (thiếu reason). Không bao giờ 500.")
    A(F, "Hai admin cùng ẩn một bài đồng thời: một thành công, một 409 (chuyển trạng thái nguyên tử)", "Chức năng", "Trung bình", APIM + " " + SEED_POST,
      ["Gửi song song 2 request POST /content/posts/<id>/hide {reason:'Spam'} (Promise.all/2 terminal)"], "POST-1415C1D0", "Một request 200, request kia 409; chỉ MỘT dòng audit post.hide và chỉ một thông báo cho tác giả.", pw="Một phần")
    A(F, "Hai admin cùng duyệt một payout hoặc hoàn tiền một giao dịch đồng thời: chỉ một bên thắng", "Chức năng", "Trung bình", APIM + " " + SEED_PO,
      ["Song song 2 request POST /payments/payouts/<id PO-60986918>/approve", "Song song 2 request POST /payments/transactions/<id TXN-E8AF54EA>/refund {reason:'x'}"], "PO-60986918, TXN-E8AF54EA", "Mỗi cặp: 1 request 200, 1 request 409; không có hoàn tiền kép (refundedCents đúng bằng 1 lần hoàn); 1 dòng audit mỗi thao tác.", pw="Một phần")
    A(F, "Hiệu năng danh sách: các trang admin đợt 2 phản hồi dưới 1 giây trên seed", "Hiệu năng", "Thấp", API,
      ["Đo thời gian GET /admin/content/posts?limit=100, /payments/transactions?limit=100, /discovery/communities?limit=100, /discovery/rankings, /payments/creators"], "-", "Mỗi request < 1 giây trên DB seed (≈1.5K người dùng, 35 cộng đồng); BE tính discovery/search-visibility/creators trong bộ nhớ nên cần theo dõi khi số cộng đồng/creator tăng lên hàng nghìn.", pw="Không")
    A(F, "Responsive: bảng và modal đợt 2 dùng được ở màn 390px (cuộn ngang, modal không tràn)", "Giao diện", "Trung bình", UI,
      ["Thu cửa sổ 390×844", "Mở /admin/payments/tx, /admin/content/media, /admin/discovery/featured, mở một modal Hoàn tiền"], "390x844", "Bảng cuộn ngang trong khung, không vỡ bố cục trang; lưới Media xuống 1-2 cột; thẻ Nổi bật xếp 1 cột; modal vừa màn hình, nút xác nhận nhìn thấy được; sidebar thành drawer.", pw="Một phần")
    A(F, "Truy cập bàn phím: modal thao tác có focus, Esc đóng, Enter xác nhận; nút icon có aria-label", "Giao diện", "Thấp", UI,
      ["Mở modal 'Ẩn bài viết?' bằng bàn phím", "Nhấn Esc", "Kiểm tra aria-label của nút '+/−' ở Xếp hạng, 'Chuyển lên/xuống/Gỡ khỏi danh sách' ở Nổi bật, 'Chọn dòng', 'Trang trước/sau'"], "-", "Esc đóng modal không gửi request; các nút icon có aria-label đúng như liệt kê; chip lý do chọn được bằng bàn phím.", pw="Một phần")

    # ============================================================ 22. ĐIỂM CHƯA LÀM / MÔ PHỎNG (KẾ HOẠCH)
    F = "Điểm chưa làm / mô phỏng đợt 2"
    A(F, "Cổng thanh toán thật (Stripe/MoMo/VNPay): hoàn tiền, retry, chargeback hiện chạy trên MockGateway", "Tích hợp", "Cao", "Gateway mô phỏng (payments.gateway.ts): luôn thành công trừ user trong failFor; chargeback là bản ghi phía admin (bảng Chargeback), không nhận webhook từ cổng. " + PENDING_DECISION + " cổng thanh toán chưa chọn (PLAN câu hỏi #2).",
      ["Hoàn tiền một giao dịch và kiểm tra bên cổng", "Mở chargeback và đối chiếu với dashboard cổng"], "-",
      "KỲ VỌNG SAU KHI TÍCH HỢP: hoàn tiền/retry gọi cổng thật, lỗi cổng (502 GATEWAY_ERROR, thẻ hết hạn, không đủ số dư) hiển thị rõ, chargeback đồng bộ từ webhook, đối soát. HIỆN TẠI: mã tham chiếu 'mock_ch_*', 'mock_dp_*'; giao diện ghi 'Stripe (mock)'.", st=PLAN, pw="Không")
    A(F, "Xuất CSV (Giao dịch, Bài viết, Doanh thu creator...) và nút 'Xuất' ", "Chức năng", "Thấp", "Thiếu ở BE (export CSV) - frontend/ADMIN_BACKEND_GAPS.md.", ["Tìm nút 'Xuất' ở /admin/content/posts, /admin/payments/tx, /admin/payments/creator"], "-",
      "KỲ VỌNG SAU KHI LÀM: nút tải file CSV theo bộ lọc hiện tại. HIỆN TẠI: nút bị ẩn, không có endpoint export.", st=PLAN, pw="Không")
    A(F, "Tải biên nhận/hóa đơn PDF từ chi tiết giao dịch", "Chức năng", "Thấp", "Chỉ có invoiceNumber (INV-...), chưa có file PDF.", ["Mở chi tiết TXN-763C9F36, tìm nút 'Tải biên nhận'"], "TXN-763C9F36", "KỲ VỌNG SAU KHI LÀM: tải PDF biên nhận. HIỆN TẠI: chỉ hiển thị số hóa đơn trong khối 'Chi tiết thanh toán'; không có nút tải.", st=PLAN, pw="Không")
    A(F, "Phản hồi của creator trong yêu cầu hoàn tiền (creatorResponse)", "Chức năng", "Trung bình", "creatorResponse luôn null vì chưa có tính năng chủ cộng đồng phản hồi hoàn tiền.", ["Mở chi tiết RF-1542230F", "GET /admin/payments/refunds/<id>"], "RF-1542230F", "KỲ VỌNG SAU KHI LÀM: creator phản hồi và admin thấy thẻ 'Phản hồi của creator'. HIỆN TẠI: API trả creatorResponse=null và giao diện ẩn thẻ.", st=PLAN, pw="Không")
    A(F, "Trạng thái hoàn tiền 'Đang xử lý' (processing)", "Chức năng", "Thấp", "Duyệt hoàn tiền thực hiện ngay nên chỉ có pending/approved/rejected.", ["Duyệt một yêu cầu hoàn tiền và quan sát trạng thái trung gian"], "-", "KỲ VỌNG SAU KHI TÍCH HỢP CỔNG THẬT: có 'Đang xử lý' khi chờ cổng. HIỆN TẠI: chuyển thẳng 'Hoàn tất'.", st=PLAN, pw="Không")
    A(F, "Cột 'Báo cáo' của Khóa học/Bài học/Sự kiện luôn 0 (chưa có cơ chế báo cáo)", "Chức năng", "Trung bình", "ClassroomModule/ClassroomLesson/CommunityEvent không có đối tượng báo cáo; chỉ Bài viết/Bình luận có Report; Media.reports = 1 khi bị gắn cờ.", ["Báo cáo một khóa học/bài học/sự kiện từ phía thành viên", "Xem cột 'Báo cáo' ở admin"], "-", "KỲ VỌNG SAU KHI LÀM: thành viên báo cáo được các đối tượng này và cột/KPI 'Bị báo cáo' tăng. HIỆN TẠI: luôn 0.", st=PLAN, pw="Không")
    A(F, "Thao tác hàng loạt cho Bình luận/Khóa học/Bài học/Sự kiện/Media (chỉ Bài viết có)", "Chức năng", "Trung bình", "BE chỉ có POST /content/posts/bulk (comments/bulk có API nhưng FE chưa dùng).", ["Mở từng trang, tìm checkbox chọn nhiều dòng"], "-", "KỲ VỌNG SAU KHI LÀM: checkbox + thanh bulk ở các trang còn lại. HIỆN TẠI: chỉ trang Bài viết có checkbox; API /content/comments/bulk dùng được trực tiếp.", st=PLAN, pw="Không")
    A(F, "Bộ lọc Cộng đồng/Tác giả dạng dropdown ở trang Nội dung (chỉ qua ?courseId= trên URL)", "Chức năng", "Thấp", "Thiếu endpoint autocomplete (GET /admin/communities?fields=id,name).", ["Tìm dropdown 'Cộng đồng'/'Tác giả' ở trang Bài viết"], "-", "KỲ VỌNG SAU KHI LÀM: dropdown lọc. HIỆN TẠI: không có; chỉ đọc ?courseId= từ URL (BE nhận courseId/authorId).", st=PLAN, pw="Không")
    A(F, "Ghim bài viết (pinned) từ admin và ảnh/poll trong Xem trước bài viết", "Chức năng", "Thấp", "BE chưa có ghim bài từ admin; modal xem trước chưa vẽ imageUrl/hasPoll.", ["Mở Xem trước POST-3B032FD4 (có ảnh), tìm nút 'Ghim'"], "POST-3B032FD4", "KỲ VỌNG SAU KHI LÀM: nút ghim/bỏ ghim; xem trước hiện ảnh/poll. HIỆN TẠI: không có nút ghim; modal chỉ có văn bản.", st=PLAN, pw="Không")
    A(F, "Tên gói đăng ký (Pro/Basic) và tên khóa học trong Bài học", "Chức năng", "Thấp", "BE chỉ có plan 'paid|trial'; Bài học chỉ trả module (không có tên khóa).", ["Mở /admin/payments/subs và /admin/content/lessons"], "-", "KỲ VỌNG SAU KHI LÀM: cột Gói hiện tên gói; cột 'Khóa học' cho Bài học. HIỆN TẠI: 'Trả phí/Dùng thử' và cột 'Mô-đun'.", st=PLAN, pw="Không")
    A(F, "Nút 'Tạo tranh chấp giả lập' trên giao diện (chỉ có API POST /payments/chargebacks)", "Chức năng", "Thấp", "Thiết kế không có nút; chỉ tester dùng API.", ["Mở /admin/payments/chargebacks, tìm nút tạo"], "-", "KỲ VỌNG SAU KHI LÀM (nếu cần cho QA): nút tạo tranh chấp mô phỏng. HIỆN TẠI: không có nút; tạo bằng API.", st=PLAN, pw="Không")
    A(F, "Kéo-thả xếp hạng ở trang Nổi bật; xóa/sửa khóa danh mục; ghim/boost thủ công trong Xếp hạng", "Chức năng", "Thấp", "FE chỉ có mũi tên; BE không có xóa danh mục, đổi key/slug, pin/boost.", ["Thử kéo-thả một mục Nổi bật", "Tìm nút xóa danh mục", "Tìm ô boost trong Xếp hạng"], "-", "KỲ VỌNG SAU KHI LÀM: kéo-thả, xóa danh mục, boost. HIỆN TẠI: chỉ mũi tên; danh mục chỉ Thêm/Sửa tên-mô tả/Lên-xuống/Bật-Tắt; không boost.", st=PLAN, pw="Không")
    A(F, "Danh mục marketing/design không tự có: phải bấm 'Thêm'", "Chức năng", "Thấp", "Enum CourseCategory có 10 giá trị nhưng seed chỉ tạo 8 dòng DiscoveryCategory.", ["Mở /admin/discovery/categories", "Tìm marketing/design"], "-", "KỲ VỌNG (nếu chốt): đủ 10 danh mục mặc định. HIỆN TẠI: chỉ 8 danh mục; marketing/design chỉ xuất hiện sau khi admin 'Thêm' (xem case Thêm danh mục).", st=PLAN, pw="Không")
    A(F, "Tổng hợp trong bộ nhớ (Cộng đồng hiển thị, Hiển thị tìm kiếm, Doanh thu creator) có giới hạn quy mô", "Hiệu năng", "Thấp", "BE sắp xếp/phân trang trong bộ nhớ sau khi tính tín hiệu của mọi cộng đồng/creator (mục 4 'Khác biệt').", ["Nạp hàng nghìn cộng đồng và creator", "Đo thời gian /discovery/communities và /payments/creators"], "-", "KỲ VỌNG SAU KHI TỐI ƯU: tính ở SQL/phân trang thật, thời gian ổn định. HIỆN TẠI: ổn với vài nghìn bản ghi; chưa tối ưu cho quy mô lớn.", st=PLAN, pw="Không")
    A(F, "Hoa hồng, phí cổng, cửa sổ hoàn tiền, ngưỡng rút tối thiểu và trọng số xếp hạng mặc định đang là giá trị tạm", "Chức năng", "Cao", "Giá trị tạm trong env: PLATFORM_COMMISSION_PCT=10, GATEWAY_FEE_PCT=2.9, GATEWAY_FEE_FIXED_CENTS=30, REFUND_WINDOW_DAYS=7, PAYOUT_MIN_USD=50; trọng số mặc định 25/25/20/15/10/5; MRR 100 điểm = $450; qualityScore theo công thức tạm; quy tắc hidden/unlisted. " + PENDING_DECISION,
      ["Đổi từng giá trị env, restart BE, kiểm tra Giao dịch/Doanh thu creator/Chi trả/Hoàn tiền/Xếp hạng"], "-", "KỲ VỌNG SAU KHI CHỐT: cập nhật các case có tag [PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT] theo giá trị cuối. HIỆN TẠI: số liệu đổi theo env, case ghi theo giá trị tạm.", st=PLAN, pw="Không")
    A(F, "Kick/ban thành viên trả phí không tự hủy gói; admin phải tự Tạm dừng/Hủy gói (đợt 1 điểm đã biết)", "Chức năng", "Trung bình", "Đã ghi ở mục F #1 của 'Nhật ký thay đổi': chưa chốt hoàn tiền/hủy gói khi kick/ban.", ["Ban một thành viên trả phí khỏi cộng đồng", "Mở /admin/payments/subs tìm gói của người đó"], "-", "KỲ VỌNG SAU KHI CHỐT: gói tự dừng/hoàn tiền theo chính sách. HIỆN TẠI: gói vẫn 'Hoạt động'; admin có thể dùng 'Tạm dừng'/'Hủy' ở trang Gói đăng ký; 'Tiếp tục' bị 409 nếu người dùng đang bị cấm khỏi cộng đồng.", st=PLAN, pw="Không")
