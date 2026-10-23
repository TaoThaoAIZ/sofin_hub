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

    # ---------------------------------------------------------------- Link giới thiệu & trạng thái người được giới thiệu (fix 2026-10-23)
    RPRE = "Môi trường: backend + frontend chạy. A = người giới thiệu (Cài đặt > Giới thiệu & hoa hồng, copy link dạng /gioi-thieu/<mã>); B = người nhận link. "
    A("Link giới thiệu", "Link copy trong trang Giới thiệu & hoa hồng của cộng đồng có kèm id cộng đồng", "Chức năng", "Cao", RPRE + "A là thành viên cộng đồng X.",
      ["A vào /communities/<X>/chuong-trinh-gioi-thieu", "Bấm sao chép link (hoặc xem ô link, nút Facebook/Telegram/X)"], "-",
      "Link có dạng <origin>/gioi-thieu/<mã>?c=<id cộng đồng X> (cả ô hiển thị lẫn nội dung được copy/chia sẻ). Link cũ không có ?c vẫn mở được nhưng không biết cộng đồng nào (người đã đăng nhập về trang chủ).")
    A("Link giới thiệu", "Mở link khi ĐÃ đăng nhập: vào đúng cộng đồng của người giới thiệu, không sang đăng ký", "Chức năng", "Cao", RPRE + "B đã đăng nhập sẵn trên trình duyệt; link của A lấy từ trang Giới thiệu & hoa hồng của cộng đồng X.",
      ["Dán link /gioi-thieu/<mã>?c=<X> vào tab mới của trình duyệt đang đăng nhập B", "Quan sát trang đích và thanh địa chỉ"], "Link của A có ?c",
      "Thoáng hiện 'Đang chuyển hướng' rồi vào TRANG CỘNG ĐỒNG X (/communities/<X>?cref=<mã>), vẫn đăng nhập; KHÔNG vào /register và KHÔNG về trang chủ. B bấm Tham gia/thanh toán thì chương trình giới thiệu của cộng đồng ghi nhận A (nếu cộng đồng bật hoa hồng và A còn là thành viên).")
    A("Link giới thiệu", "Link có id cộng đồng sai định dạng/không tồn tại: không điều hướng bậy", "Chức năng", "Trung bình", RPRE + "B đã đăng nhập.",
      ["Mở /gioi-thieu/<mã>?c=../admin", "Mở /gioi-thieu/<mã>?c=khong-ton-tai"], "?c lạ",
      "?c chứa ký tự lạ ('/', '.'...) bị bỏ qua, về trang chủ; ?c hợp lệ nhưng cộng đồng không tồn tại: vào /communities/<id> và hiện trang 'không tìm thấy' như bình thường (không treo).")
    A("Link giới thiệu", "Mở link khi CHƯA đăng nhập: lưu mã rồi sang đăng ký; đăng ký xong được ghi nhận", "Chức năng", "Cao", RPRE + "Cửa sổ ẩn danh, chưa đăng nhập.",
      ["Mở link của A", "Đăng ký tài khoản mới + xác thực OTP", "A mở Giới thiệu & hoa hồng, xem bảng 'Người bạn đã giới thiệu'"], "Link của A",
      "Tự chuyển sang /register; xác thực OTP xong B được đưa thẳng vào CỘNG ĐỒNG trên link (nếu link có ?c) thay vì trang chủ; bảng của A có thêm dòng của B với trạng thái 'Chưa tham gia', hoa hồng '—'; KPI 'Người đã đăng ký' tăng 1. Đăng ký bằng Google/Facebook cũng vào đúng cộng đồng.")
    A("Link giới thiệu", "Mở link khi đang chờ xác định phiên đăng nhập (F5 trên link)", "Chức năng", "Trung bình", RPRE + "B đã đăng nhập.",
      ["Mở link rồi bấm F5 ngay trên trang chuyển hướng"], "Link của A",
      "Không nháy sang /register: trang đợi biết phiên đăng nhập xong mới chuyển (đã đăng nhập -> vào cộng đồng của link, không có ?c thì trang chủ).", pw="Không")
    A("Trạng thái người được giới thiệu", "B (đăng ký bằng link của A) tham gia cộng đồng miễn phí: trạng thái đổi thành 'Đã tham gia'", "Chức năng", "Cao", RPRE + "B đã đăng ký bằng link của A; có một cộng đồng miễn phí công khai.",
      ["Đăng nhập lại B, vào cộng đồng miễn phí và bấm Tham gia", "A tải lại Cài đặt > Giới thiệu & hoa hồng"], "Cộng đồng miễn phí",
      "Dòng của B đổi từ 'Chưa tham gia' sang nhãn xanh dương 'Đã tham gia' và cột Cộng đồng hiện tên cộng đồng vừa vào. Hoa hồng vẫn '—' vì chưa có giao dịch; KPI 'Đang trả phí' không tăng.")
    A("Trạng thái người được giới thiệu", "B thanh toán gói cộng đồng trả phí: trạng thái lên 'Đang trả phí' và A được cộng hoa hồng", "Chức năng", "Cao", RPRE + "B đã đăng ký bằng link của A; có cộng đồng trả phí 250.000đ; hoa hồng thành viên mặc định 10%.",
      ["Đăng nhập B, thanh toán gói cộng đồng trả phí (chuyển khoản, ghi có)", "A tải lại Giới thiệu & hoa hồng", "Bấm '...' ở dòng B > Chi tiết hoa hồng"], "Gói 250.000đ",
      "Dòng B: 'Đang trả phí', cộng đồng đúng, hoa hồng 25.000đ (pending); KPI 'Đang trả phí' +1, 'Hoa hồng tháng này' 25.000đ. Gói trả phí được ưu tiên hơn 'Đã tham gia' khi B ở cả cộng đồng miễn phí lẫn trả phí.")
    A("Trạng thái người được giới thiệu", "Cộng đồng do chính B tạo không làm trạng thái 'member' thành 'Đã tham gia'", "Chức năng", "Trung bình", RPRE + "B đã đăng ký bằng link của A, chưa vào cộng đồng nào.",
      ["B tạo cộng đồng riêng của mình", "A xem tab 'Hoa hồng thành viên' và tab 'Hoa hồng người tạo'"], "-",
      "Tab thành viên: dòng B vẫn 'Chưa tham gia' (chủ cộng đồng không tính là đã tham gia); tab người tạo hiện cộng đồng của B với trạng thái gói hosting.")
    A("Trạng thái người được giới thiệu", "Người ĐÃ có tài khoản tham gia cộng đồng qua link: hiện trong bảng 'Người bạn đã giới thiệu' của trang trong cộng đồng", "Chức năng", "Cao",
      RPRE + "Chủ cộng đồng X đã BẬT % hoa hồng ở thẻ 'Chương trình giới thiệu của cộng đồng này' (mặc định 0% = tắt); A là thành viên X; B có tài khoản từ trước, chưa là thành viên X.",
      ["A copy link ở /communities/<X>/chuong-trinh-gioi-thieu và gửi B", "B (đã đăng nhập) mở link, bấm Tham gia (hoặc Gửi yêu cầu tham gia nếu cộng đồng riêng tư)", "A tải lại trang Giới thiệu & hoa hồng"], "Link có ?c",
      "Bảng của A có dòng B (tên, ngày) với cột Cộng đồng = X; sau khi B vào X trạng thái là 'Đã tham gia'; nếu B trả phí thì 'Đang trả phí' và cột Hoa hồng cộng cả hoa hồng chương trình cộng đồng. Mở '...' > Chi tiết hoa hồng không báo lỗi 'không tìm thấy'. Trang Cài đặt chung (ngoài cộng đồng) vẫn chỉ liệt kê người đăng ký tài khoản qua link.")
    A("Trạng thái người được giới thiệu", "Chủ cộng đồng để hoa hồng cộng đồng = 0% (tắt): tham gia qua link KHÔNG được ghi nhận người mời", "Chức năng", "Trung bình",
      RPRE + "Cộng đồng X có hoa hồng cộng đồng = 0% (mặc định).",
      ["B có tài khoản từ trước mở link của A rồi tham gia X", "A xem bảng 'Người bạn đã giới thiệu'"], "% = 0",
      "Chương trình tắt nên không ghi nhận người mời (hành vi hiện tại): dòng của B KHÔNG xuất hiện ở bảng của A; bật % rồi người KHÁC tham gia thì mới được ghi nhận.")
    A("Trạng thái người được giới thiệu", "Gói cũ đã hủy nhưng người đó vẫn là thành viên: hiện 'Đã tham gia', không phải 'Đã hủy'", "Chức năng", "Cao", RPRE + "B đăng ký bằng link của A; B từng có gói trả phí ở cộng đồng X (đã hủy/hết hạn) nhưng hiện vẫn là thành viên X.",
      ["A mở Giới thiệu & hoa hồng, xem dòng của B", "Cho B rời cộng đồng X rồi A tải lại"], "Gói canceled + enrollment còn",
      "Khi B còn là thành viên: nhãn 'Đã tham gia' (xanh dương) kèm tên cộng đồng X. Sau khi B rời X (không còn thành viên): nhãn 'Đã hủy' (xám). Người có gói đang trả phí/dùng thử luôn ưu tiên hơn.")
    A("Trạng thái người được giới thiệu", "B vào cộng đồng từ trang khác (không qua link) vẫn đổi trạng thái; yêu cầu tham gia chờ duyệt hiện 'Chờ duyệt'", "Chức năng", "Cao", RPRE + "B đăng ký bằng link của A lúc trước; có 1 cộng đồng miễn phí công khai và 1 cộng đồng riêng tư cần duyệt.",
      ["B vào cộng đồng miễn phí từ trang Khám phá (không dùng link) và bấm Tham gia", "A tải lại bảng", "B gửi yêu cầu tham gia cộng đồng riêng tư", "A tải lại bảng", "Chủ cộng đồng riêng tư duyệt yêu cầu, A tải lại"], "-",
      "Sau bước 1: 'Đã tham gia' (cộng đồng miễn phí). Sau bước 3 khi chưa có cộng đồng nào khác: 'Chờ duyệt' (vàng) kèm tên cộng đồng riêng tư; sau khi duyệt: 'Đã tham gia'. Nhãn 'Chưa tham gia' chỉ còn khi B chưa vào/xin vào cộng đồng nào.")
    A("Trang Giới thiệu & hoa hồng của cộng đồng", "Khung đặt % hoa hồng nằm TRÊN CÙNG trang (chủ cộng đồng)", "Giao diện", "Cao", RPRE + "Đăng nhập chủ cộng đồng X.",
      ["Vào /communities/<X>/chuong-trinh-gioi-thieu", "Quan sát thứ tự các khối từ trên xuống"], "-",
      "Chủ cộng đồng: (1) khung 'Hoa hồng giới thiệu (dành cho chủ cộng đồng)' có ô % + Lưu (+ Tắt chương trình khi đang bật), (2) hero + link, (3) khối 'Chi trả hoa hồng cho cộng tác viên'. Thành viên thường: không có khung %; thứ tự hero + link, 4 chỉ số, bảng 'Người bạn đã giới thiệu' + Rút tiền, Quy trình rút tiền.", pw="Không")
    A("Trang Giới thiệu & hoa hồng của cộng đồng", "Chủ cộng đồng chưa đặt % (0): KHÔNG hiện link và KHÔNG hiện '10%' của nền tảng", "Chức năng", "Cao", RPRE + "Cộng đồng X có hoa hồng cộng đồng = 0% (mặc định).",
      ["Chủ cộng đồng mở trang Giới thiệu & hoa hồng", "Một thành viên thường của X mở cùng trang"], "% = 0",
      "Hero hiện 'Chương trình giới thiệu chưa được bật' kèm hướng dẫn (chủ: 'Hãy đặt % ở khung phía trên'; thành viên: 'Chủ cộng đồng chưa bật hoa hồng giới thiệu'); KHÔNG có ô link, nút Sao chép/chia sẻ và KHÔNG có chữ 'Nhận 10%'. Các chỉ số hiện 0.")
    A("Trang Giới thiệu & hoa hồng của cộng đồng", "Chủ đặt % thì hero và link hiện ngay với đúng % của cộng đồng", "Chức năng", "Cao", RPRE + "Cộng đồng X đang 0%.",
      ["Chủ cộng đồng nhập 15 vào ô % và bấm Lưu", "Quan sát hero/link không cần tải lại trang", "Thành viên thường tải lại trang"], "15%",
      "Hero đổi thành 'Nhận 15% ...' và hiện ô link + nút chia sẻ ngay (không cần F5); thành viên thường thấy cùng nội dung. Bấm 'Tắt' thì quay về trạng thái chưa bật.")
    A("Trang Giới thiệu & hoa hồng của cộng đồng", "Số liệu 4 ô tính theo CỘNG ĐỒNG và khớp bảng người giới thiệu", "Chức năng", "Cao", RPRE + "X đã bật 15%. B (tài khoản cũ) tham gia X qua link của A và trả phí 250.000đ; C đăng ký tài khoản mới qua link của A nhưng chưa vào X.",
      ["A mở trang Giới thiệu & hoa hồng của X", "So 4 ô chỉ số với bảng 'Người bạn đã giới thiệu'"], "B trả phí, C chưa tham gia",
      "'Người đã đăng ký' = 2 (B, C; bằng tổng số dòng bảng); 'Đang trả phí' = 1 (B); 'Hoa hồng tháng này' = 37.500đ (15% x 250.000đ); 'Chờ chi trả' = 37.500đ kèm ngày chi trả. Hoa hồng phát sinh ở cộng đồng KHÁC không lẫn vào. Dòng B: 'Đang trả phí' + cột Hoa hồng 37.500đ; dòng C: 'Chưa tham gia'; cột Cộng đồng/trạng thái tính theo X.")
    PRE_OWN = RPRE + "X đã bật 20%. A và A2 là thành viên X; A mời B và C (đã trả phí 250.000đ mỗi người), A2 mời D (đã trả phí). Đăng nhập CHỦ cộng đồng X. "
    A("Chi trả hoa hồng cho cộng tác viên", "Trang của chủ cộng đồng đúng thiết kế: tiêu đề, khung %, hero + link, rồi khối chi trả", "Giao diện", "Cao", PRE_OWN,
      ["Mở /communities/<X>/chuong-trinh-gioi-thieu", "Quan sát thứ tự các khối từ trên xuống"], "-",
      "Thứ tự: tiêu đề 'Giới thiệu & Hoa hồng' > khung 'Hoa hồng giới thiệu (dành cho chủ cộng đồng)' (ô % có hậu tố %, nút Lưu có icon, nút 'Tắt chương trình') > hero 'Nhận 20% ...' + link + Sao chép + chia sẻ > khối 'Chi trả hoa hồng cho cộng tác viên' (chọn khoảng ngày, 4 thẻ số liệu màu xanh dương/xanh lá/cam/tím, bảng + cột phải 'Thanh toán hoa hồng' và 'Lịch sử chi trả gần đây'). Chủ không còn thấy bảng 'Người bạn đã giới thiệu'/Rút tiền cá nhân ở trang này.", pw="Không")
    A("Chi trả hoa hồng cho cộng tác viên", "4 thẻ số liệu và bảng cộng tác viên đúng dữ liệu theo khoảng ngày", "Chức năng", "Cao", PRE_OWN,
      ["Chọn khoảng ngày chứa các giao dịch", "Đọc 4 thẻ số liệu", "Đọc dòng của A và A2 trong bảng", "Đổi sang khoảng ngày không có giao dịch"], "Khoảng ngày 01/10-31/12",
      "Cộng tác viên 2, Người được giới thiệu 3, Hoa hồng cần chi trả 150.000đ, Đã chi trả 0đ. Dòng A: Người được giới thiệu 2, Tỷ lệ 20%, Tổng hoa hồng 100.000đ, Cần chi trả 100.000đ, trạng thái 'Chờ chi trả'. Khoảng ngày không có giao dịch: Cần chi trả 0đ, trạng thái 'Chưa phát sinh'. Ngày bắt đầu sau ngày kết thúc: báo lỗi, không gọi API.")
    A("Chi trả hoa hồng cho cộng tác viên", "Tìm kiếm, lọc trạng thái và phân trang bảng (6 dòng/trang)", "Chức năng", "Trung bình", PRE_OWN + "Có > 6 cộng tác viên.",
      ["Gõ một phần tên/email của A vào ô tìm kiếm", "Chọn lọc 'Đã chi trả' rồi 'Chờ chi trả'", "Bấm sang trang 2, trang cuối, trang trước"], "-",
      "Tìm theo tên/email (không phân biệt hoa thường) lọc đúng; lọc trạng thái đúng; dòng 'Hiển thị 7-12 trong tổng N cộng tác viên' đúng; đổi trang/bộ lọc thì bỏ các ô đã chọn.")
    A("Chi trả hoa hồng cho cộng tác viên", "Chi trả một cộng tác viên: xác nhận rồi đánh dấu đã chi + ghi lịch sử", "Chức năng", "Cao", PRE_OWN,
      ["Chuyển khoản thật (ngoài hệ thống) cho A", "Ở dòng A bấm 'Chi trả'", "Bấm 'Đã chuyển, xác nhận'"], "A cần chi 100.000đ",
      "Hiện hộp 'Xác nhận đã chuyển khoản' nêu đúng số tiền và tên A. Sau xác nhận: toast 'Đã ghi nhận chi trả 100.000đ cho 1 cộng tác viên'; dòng A thành 'Đã chi trả', Cần chi trả '—'; thẻ 'Đã chi trả' tăng 100.000đ, 'Cần chi trả' giảm; Lịch sử chi trả gần đây có dòng A (100.000đ, 'Đã chuyển'); A nhận thông báo 'Chủ cộng đồng đã chi trả hoa hồng giới thiệu'. Bấm lại thì nút 'Chi trả' bị vô hiệu.")
    A("Chi trả hoa hồng cho cộng tác viên", "Chi trả hàng loạt các cộng tác viên đã chọn", "Chức năng", "Cao", PRE_OWN,
      ["Tick ô chọn của A và A2 (hoặc ô chọn tất cả ở tiêu đề bảng)", "Quan sát nút 'Chi trả hàng loạt (2)'", "Bấm và xác nhận"], "A, A2",
      "Nút hiện số người đã chọn; hộp xác nhận nêu tổng tiền và số người; sau xác nhận cả hai thành 'Đã chi trả', lịch sử có 2 dòng. Chỉ chọn được người còn khoản cần chi (ô chọn mờ với người đã chi).")
    A("Chi trả hoa hồng cho cộng tác viên", "Sau khi chủ chi trả: doanh thu của chủ không còn bị trừ và cộng tác viên không rút lại khoản đó", "Chức năng", "Cao", PRE_OWN,
      ["Ghi lại doanh thu thực nhận của chủ ở Doanh thu & rút tiền", "Chi trả cho A (100.000đ)", "Xem lại doanh thu của chủ", "Đăng nhập A, xem số dư 'Rút tiền hoa hồng'"], "-",
      "Doanh thu thực nhận của chủ tăng đúng 100.000đ (khoản hoa hồng đó không còn bị trừ); số dư rút được của A không còn khoản 100.000đ đó (không thể rút trùng).")
    A("Chi trả hoa hồng cho cộng tác viên", "Cộng tác viên đã rút một phần qua nền tảng: chỉ ghi nhận phần còn lại, không chi hai lần", "Chức năng", "Cao", PRE_OWN + "A đã thêm tài khoản nhận tiền và đã bấm Rút tiền 50.000đ trước đó (nền tảng đang xử lý).",
      ["Chủ bấm Chi trả cho A (A còn 100.000đ cần chi, đã rút 50.000đ)"], "A có yêu cầu rút 50.000đ",
      "Chỉ ghi nhận chi trả 50.000đ (phần A còn rút được), phần còn lại giữ 'Chờ chi trả' và có toast 'đã rút một phần hoa hồng qua nền tảng nên chỉ ghi nhận phần còn lại'. Số dư rút được của A không âm.")
    A("Chi trả hoa hồng cho cộng tác viên", "Xuất danh sách thanh toán (CSV)", "Chức năng", "Trung bình", PRE_OWN,
      ["Bấm 'Xuất danh sách thanh toán' khi chưa chọn ai", "Tick A rồi bấm lại", "Mở file bằng Excel"], "-",
      "Tải file thanh-toan-hoa-hong-<từ>_<đến>.csv đọc đúng tiếng Việt: chưa chọn = mọi người còn khoản cần chi; đã chọn = chỉ người đã chọn. Cột: tên, email, số người giới thiệu, tỷ lệ, số khoản, cần chi trả, ngân hàng, chủ tài khoản, 4 số cuối tài khoản (số tài khoản đầy đủ không lộ cho chủ).")
    A("Chi trả hoa hồng cho cộng tác viên", "Menu '⋮': xem người được mời của từng cộng tác viên", "Chức năng", "Trung bình", PRE_OWN,
      ["Bấm '⋮' ở dòng A > 'Xem người được mời'"], "A mời B, C",
      "Hiện hộp 'Người được A mời' liệt kê B, C với ngày tham gia, trạng thái (Đang trả phí/Đã tham gia/Chưa tham gia) và hoa hồng của từng người.")
    A("Chi trả hoa hồng cho cộng tác viên", "Chỉ chủ cộng đồng chi trả/xem/xuất; thành viên thường bị chặn", "Bảo mật", "Cao", RPRE + "A là thành viên thường của X.",
      ["A mở trang Giới thiệu & hoa hồng của X", "A gọi GET/POST /api/communities/<X>/referral-program/payouts và GET .../payouts/export.csv"], "-",
      "Trang của A không có khung % và không có khối chi trả; mọi API trên trả 403. Gửi referrerIds rỗng hoặc id không phải cộng tác viên: 400 / bị bỏ qua, không đổi dữ liệu.")
