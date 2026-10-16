# -*- coding: utf-8 -*-
"""Module HOST - Thu phí gói hosting (Pro) + hoa hồng giới thiệu creator + Admin 'Giao dịch giới thiệu' + tìm 'Tiền vào ngân hàng' (10/2026).

Bám: backend/src/modules/payments/payments.service.ts (settleHosting, processHostingBilling), referrals.service.ts (onHostingCharge),
admin-referrals.service.ts, owner-plan.service.ts, test backend/tests/hosting-billing.test.ts; FE: HostingPlanTab.tsx (Cài đặt cộng đồng > Gói & thanh toán),
ReferralTxViews.tsx (Admin > Thanh toán > Giao dịch giới thiệu), BankViews.tsx.
Tiền VND nguyên. Giá Pro lấy từ Global Settings owner.proMonthlyPrice (mặc định 299.000đ/tháng), hoa hồng creator 30% (referral.creatorRateBps).
Job 'payments.hostingBilling' chạy mỗi 15 phút: phát hóa đơn khi còn <= payments.trialReminderDays ngày (mặc định 3) tới hết dùng thử/hết kỳ; quá hạn không trả => hạ về gói Khởi đầu.
Thêm case mới = thêm CUỐI file (giữ mã TC-HOST-nnn)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

ENV = ("Môi trường: backend + frontend chạy, BANK_* và SEPAY_WEBHOOK_KEY đã cấu hình như module BANK. Cần 2 tài khoản: A (người giới thiệu) và B (đăng ký bằng link của A, "
       "mở cộng đồng, chọn gói Chuyên nghiệp dùng thử). Muốn chạy job ngay: cd backend && npx tsx -e \"import('./src/modules/payments/payments.service.js').then(m=>m.paymentsService.processHostingBilling(new Date())).then(console.log)\".")
DATA = "Case làm thay đổi dữ liệu - dùng tài khoản/cộng đồng mới trước khi lặp lại."


def load(add):
    M, MN = "HOST", "Phí hosting & giao dịch giới thiệu"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ---------------------------------------------------------------- Hóa đơn hosting
    A("Hóa đơn hosting", "Chưa tới hạn dùng thử: KHÔNG phát hóa đơn", "Chức năng", "Cao", ENV + " B có gói Pro đang dùng thử, hết thử sau 30 ngày.",
      ["Chạy job processHostingBilling", "Đăng nhập B, vào Cài đặt cộng đồng > Gói & thanh toán"], "trialEndsAt = +30 ngày",
      "Không có Payment kind=hosting nào cho gói của B; tab chỉ hiện 'Gói Chuyên nghiệp', 'Dùng thử đến <ngày>', không có khung hóa đơn.")
    A("Hóa đơn hosting", "Còn <= 3 ngày hết dùng thử: phát ĐÚNG 1 hóa đơn chuyển khoản kèm QR (job chạy lại không tạo thêm)", "Chức năng", "Cao",
      ENV + " B có gói Pro, hết dùng thử sau 1 ngày.",
      ["Chạy job processHostingBilling hai lần", "Mở Cài đặt cộng đồng > Gói & thanh toán (đăng nhập B)", "Kiểm tra bảng Payment"], "trialEndsAt = +1 ngày",
      "DB có đúng 1 Payment kind=hosting, status=pending, amountCents=299000, có refCode; tab hiện khung 'Hóa đơn cần thanh toán: 299.000 ₫' + QR VietQR + số tài khoản, đếm ngược hạn trả; B nhận thông báo 'Đến hạn thanh toán gói Chuyên nghiệp'.")
    A("Hóa đơn hosting", "Chuyển khoản đúng mã: gói chuyển active, tab tự cập nhật, có số hóa đơn", "Chức năng", "Cao",
      ENV + " Đã có hóa đơn pending của B. " + DATA,
      ["Gửi webhook SePay với content=<refCode>, transferAmount=299000 (xem module BANK)", "Giữ nguyên trang Gói & thanh toán của B (tự làm mới ~4 giây)"], "refCode của hóa đơn",
      "Payment succeeded + invoiceNumber INV-...; HostingPlan.status=active, currentPeriodEnd ~ +30 ngày; panel hiện 'thành công'; B nhận thông báo 'Gói Chuyên nghiệp đã được thanh toán'; admin nhận chuông/Telegram 'Thanh toán mới'.")
    A("Hóa đơn hosting", "Gói đã trả còn <= 3 ngày hết kỳ: phát hóa đơn gia hạn nối tiếp kỳ cũ", "Chức năng", "Trung bình", ENV + " Gói của B đã trả 1 kỳ. " + DATA,
      ["Sửa HostingPlan.currentPeriodEnd = +2 ngày", "Chạy job processHostingBilling"], "currentPeriodEnd = +2 ngày",
      "Có thêm 1 Payment kind=hosting pending với periodStart = currentPeriodEnd cũ, periodEnd = +30 ngày sau đó (nối tiếp, không bỏ trống).")
    A("Hóa đơn hosting", "Không trả tới hết hạn: hóa đơn expired, cộng đồng bị hạ về gói Khởi đầu, không có hoa hồng", "Chức năng", "Cao", ENV + " " + DATA,
      ["Phát hóa đơn cho B rồi KHÔNG chuyển khoản", "Đặt trialEndsAt quá khứ 4 ngày, hóa đơn expiresAt quá khứ", "Chạy expireStaleSessions rồi processHostingBilling"], "-",
      "Payment chuyển failed/expired; HostingPlan.planKey=start, priceAmount=0, currentPeriodEnd=null; B nhận thông báo 'Gói Chuyên nghiệp đã hết hiệu lực'; A KHÔNG có hoa hồng.", pw="Một phần")
    A("Hóa đơn hosting", "Đổi gói/chu kỳ làm hủy hóa đơn đang chờ cũ", "Chức năng", "Trung bình", ENV + " Có hóa đơn pending. " + DATA,
      ["PUT /api/communities/<id>/hosting-plan đổi cycle (hoặc chọn gói start)", "Xem lại hóa đơn cũ"], "cycle=annual",
      "Hóa đơn pending cũ -> failed (failureReason=plan_changed); chọn gói start xóa currentPeriodEnd.", pw="Không")
    A("Hóa đơn hosting", "Hoàn tiền toàn bộ hóa đơn hosting hạ gói và hủy hoa hồng chưa chi trả", "Chức năng", "Trung bình", ENV + " Hóa đơn đã trả. " + DATA,
      ["Admin > Thanh toán > Giao dịch > chọn giao dịch hosting > Hoàn tiền toàn bộ"], "-",
      "Payment refunded; gói về Khởi đầu; hoa hồng pending của giao dịch này chuyển void.", pw="Một phần")
    A("Hóa đơn hosting", "Người không phải owner không xem/trả được hóa đơn; tab 'Gói & thanh toán' chỉ owner thấy", "Bảo mật", "Cao", ENV,
      ["Đăng nhập mod/thành viên của cộng đồng B", "Mở Cài đặt cộng đồng", "Gọi GET /api/communities/<id>/hosting-plan và GET /api/payments/<id hóa đơn>"], "-",
      "Không có tab 'Gói & thanh toán'; API hosting-plan trả 403/404; GET payment của hóa đơn người khác trả 403.")

    # ---------------------------------------------------------------- Hoa hồng creator
    A("Hoa hồng creator", "Hóa đơn hosting được trả: A nhận 30% (tab creator), tab member KHÔNG bị cộng", "Chức năng", "Cao", ENV + " Hóa đơn của B vừa được trả. " + DATA,
      ["Đăng nhập A, mở Cài đặt > Chương trình giới thiệu, tab 'Giới thiệu người tạo cộng đồng'", "Chuyển sang tab 'Giới thiệu thành viên'"], "299.000đ x 30%",
      "Tab creator: 'Hoa hồng tháng này' = 89.700đ, 'Đang trả phí' = 1, dòng B hiện cộng đồng + trạng thái 'Đang trả phí'; tab member: 0đ.")
    A("Hoa hồng creator", "Phí hosting KHÔNG vào số dư/doanh thu rút tiền của creator", "Chức năng", "Cao", ENV + " Hóa đơn của B đã trả. " + DATA,
      ["Đăng nhập B, mở doanh thu/số dư cộng đồng", "Admin > Thanh toán > Doanh thu creator"], "-",
      "Số dư và doanh thu của cộng đồng B không tăng 299.000đ; bảng Doanh thu creator không tính giao dịch hosting.", pw="Một phần")
    A("Hoa hồng creator", "Hoa hồng tính 1 lần cho mỗi hóa đơn (webhook gửi lại / job đối soát không nhân đôi)", "Chức năng", "Cao", ENV + " " + DATA,
      ["Gửi lại cùng webhook SePay (id trùng)", "Chạy referralsService.reconcileCommissions"], "-",
      "Chỉ có 1 ReferralCommission sourceRef=hosting:<paymentId>; số tiền không đổi. Nếu xóa tay dòng hoa hồng rồi chạy đối soát (<= 3 ngày) thì dòng được tạo lại.", pw="Không")

    # ---------------------------------------------------------------- Admin giao dịch giới thiệu
    A("Admin giao dịch giới thiệu", "Menu Admin > Thanh toán có mục 'Giao dịch giới thiệu' ngay dưới 'Giao dịch'", "Chức năng", "Cao", "Đăng nhập Super Admin.",
      ["Mở Admin > Thanh toán", "Bấm 'Giao dịch giới thiệu'"], "-",
      "Mục nằm giữa 'Giao dịch' và 'Gói đăng ký', mở /admin/payments/referrals; có 4 ô số liệu (Lượt giới thiệu, Khoản hoa hồng, Chờ chi trả, Đã chi trả) và 2 tab 'Hoa hồng' / 'Lượt giới thiệu'.")
    A("Admin giao dịch giới thiệu", "Tab 'Hoa hồng': mỗi khoản hiện người giới thiệu, người được giới thiệu, loại, cộng đồng, giao dịch gốc, tỷ lệ, hoa hồng, trạng thái", "Chức năng", "Cao",
      ENV + " Đã có hoa hồng từ hóa đơn hosting của B.", ["Mở tab 'Hoa hồng'"], "-",
      "Có dòng: người giới thiệu A, người được giới thiệu B, loại 'Người tạo cộng đồng', cộng đồng của B, giao dịch gốc 299.000đ, tỷ lệ 30%, hoa hồng 89.700đ, trạng thái 'Chờ chi trả', ngày chi trả mùng 5 tháng sau.")
    A("Admin giao dịch giới thiệu", "Tab 'Lượt giới thiệu': người mời chưa trả đồng nào vẫn hiện (hoa hồng 0), kèm hiệu lực 60 ngày", "Chức năng", "Cao",
      ENV + " A có thêm người C đăng ký bằng link nhưng chưa trả phí.", ["Mở tab 'Lượt giới thiệu'"], "-",
      "Có cả B (tổng hoa hồng 89.700đ, 1 khoản) và C (0đ, 0 khoản); cột Hiệu lực 'Còn đến <ngày>' cho cả hai; hết 60 ngày hiện 'Hết hạn'.")
    A("Admin giao dịch giới thiệu", "Tìm theo tên/email người giới thiệu hoặc được giới thiệu, lọc loại + trạng thái, phân trang", "Chức năng", "Trung bình", ENV,
      ["Gõ email của A vào ô tìm kiếm", "Lọc Loại = 'Thành viên'", "Lọc Trạng thái = 'Đã hủy'", "Bấm 'Xóa bộ lọc'"], "email A",
      "Chỉ hiện dòng liên quan A; lọc 'Thành viên' không còn dòng creator của B; 'Đã hủy' chỉ hiện hoa hồng void; xóa bộ lọc trả lại danh sách đầy đủ; phân trang 20 dòng.")
    A("Admin giao dịch giới thiệu", "Người thường không vào được API / trang admin giao dịch giới thiệu", "Bảo mật", "Cao", "Đăng nhập tài khoản thành viên thường.",
      ["Gọi GET /api/admin/payments/referrals và /api/admin/payments/referrals/summary", "Mở /admin/payments/referrals"], "-", "403 cho cả hai API; trang admin không truy cập được.", pw="Một phần")
    A("Admin giao dịch hosting", "Trang Giao dịch: lọc loại 'Phí hosting' hiện nhãn 'Hosting · Pro', nền tảng giữ 100%, creator nhận 0", "Chức năng", "Trung bình",
      ENV + " Đã có hóa đơn hosting trả thành công.", ["Admin > Thanh toán > Giao dịch", "Lọc 'Loại' = 'Phí hosting'"], "-",
      "Dòng hosting: Sản phẩm 'Hosting · Pro', Số tiền 299.000đ, Phí nền tảng 299.000đ, Creator nhận 0đ; ô 'Doanh thu thuần' của trang cộng đúng phí hosting.")

    # ---------------------------------------------------------------- Tiền vào ngân hàng
    A("Tiền vào ngân hàng", "Bảng hiện thêm cột 'Mã giao dịch' (mã SePay) và 'Số tài khoản'", "Chức năng", "Cao", "Đăng nhập Super Admin; đã có giao dịch tiền vào (webhook/quét).",
      ["Mở Admin > Thanh toán > Tiền vào ngân hàng"], "-",
      "Mỗi dòng có Mã giao dịch (vd TX1001), Số tài khoản nhận tiền, Nội dung, Mã tham chiếu, Ngân hàng, Trạng thái, Ghi chú; dòng chưa ghi có vẫn có nút 'Duyệt tay'.")
    A("Tiền vào ngân hàng", "Ô tìm kiếm theo mã giao dịch / số tài khoản / mã tham chiếu / nội dung (không phân biệt hoa thường)", "Chức năng", "Cao",
      "Đã có nhiều giao dịch tiền vào.", ["Gõ một phần mã giao dịch (chữ thường)", "Gõ mã SFH... của một phiên", "Gõ cụm từ không tồn tại", "Xóa ô tìm kiếm"], "TX1001, SFH...",
      "Danh sách lọc sau ~0,3 giây ở trang 1; tìm mã không tồn tại hiện 'Chưa có giao dịch…'; kết hợp được với tab 'Chưa ghi có' / 'Đã ghi có'; xóa ô trả về đầy đủ.")
