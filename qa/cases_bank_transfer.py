# -*- coding: utf-8 -*-
"""Module BANK - Thanh toán CHUYỂN KHOẢN VietQR + SePay (10/2026), thay hoàn toàn luồng thẻ mock/USD cho gói thành viên & mua lẻ module.

Bám: backend/src/modules/payments/payments.bank.ts, payments.service.ts, backend/docs/api/payments.md, test backend/tests/bank-transfer.test.ts.
Tiền là VND nguyên (1 đơn vị = 1đ). Giá seed: paid-demo 475.000đ/tháng; annual-demo 175.000đ/tháng, 1.200.000đ/năm; ai 175.000đ.
Gọi webhook bằng Postman/curl: POST {API}/api/payments/webhook, header Authorization: Apikey <SEPAY_WEBHOOK_KEY>, body JSON dạng SePay.
Thêm case mới = thêm CUỐI file (giữ mã TC-BANK-nnn)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

ENV = ("Môi trường: backend/.env đặt BANK_ACCOUNT, BANK_ACCOUNT_NAME, BANK_BIN=970422, SEPAY_WEBHOOK_KEY (tự đặt, vd test-sepay-key), PAY_REF_PREFIX=SFH; "
       "SEPAY_API_TOKEN để TRỐNG khi không có tài khoản SePay thật. Đã chạy npm run db:seed. Mật khẩu chung Passw0rd!x.")
WH = ("Payload webhook SePay mẫu: {\"id\":\"TX1001\",\"gateway\":\"MBBank\",\"transactionDate\":\"2026-10-09 10:30:00\",\"accountNumber\":\"<BANK_ACCOUNT>\","
      "\"code\":null,\"content\":\"<refCode> chuyen tien\",\"transferType\":\"in\",\"transferAmount\":<số tiền>,\"referenceCode\":\"FT1001\"}. "
      "Mỗi lần test dùng id GIAO DỊCH MỚI (id trùng = webhook gửi lại).")
MUTATE = "Case làm thay đổi dữ liệu - chạy lại npm run db:reset (hoặc dùng tài khoản/gói mới) trước khi lặp lại."


def load(add):
    M, MN = "BANK", "Thanh toán chuyển khoản (VietQR + SePay)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. TẠO PHIÊN
    A("Tạo phiên", "Checkout khóa có phí tạo phiên chuyển khoản: mã tham chiếu + QR VietQR, trạng thái pending", "Chức năng", "Cao",
      ENV + " Đăng nhập newbie@sofinhub.test (chưa ở cộng đồng nào).",
      ["Gọi POST /api/courses/paid-demo/checkout body {\"interval\":\"monthly\"}", "Đọc response"],
      "interval=monthly",
      "201 {data}: status=pending, method=bank_transfer, amountCents=475000, refCode dạng SFH + 8 ký tự (A-Z không O/I, 2-9), expiresAt = ~15 phút nữa, "
      "transfer{qrUrl bắt đầu https://img.vietqr.io/image/970422-<BANK_ACCOUNT>-compact2.png, có amount=475000 và addInfo=<refCode>, bankAccount, accountName, transferContent=refCode}. "
      "newbie CHƯA ở cộng đồng (GET /api/courses/paid-demo/subscription -> enrolled=false).")
    A("Tạo phiên", "Giá do server quyết định: amountCents/amountUsd client gửi bị bỏ qua", "Bảo mật", "Cao", ENV + " Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout body {\"amountCents\":1,\"amountUsd\":0.01}"], "amountCents=1",
      "201; amountCents trong response vẫn = 475000 và QR có amount=475000.")
    A("Tạo phiên", "Checkout lần 2 trong 15 phút tái dùng ĐÚNG phiên cũ (cùng QR, cùng refCode)", "Chức năng", "Cao", ENV + " Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout hai lần liên tiếp (kể cả bắn song song)", "So sánh id/refCode"], "-",
      "Hai response cùng id và refCode; DB chỉ có 1 dòng Payment pending của newbie cho paid-demo (không có 2 QR cùng lúc).")
    A("Tạo phiên", "Đổi chu kỳ (monthly -> annual) tạo phiên khác, giá theo chu kỳ", "Chức năng", "Trung bình", ENV + " Đăng nhập user mới; cộng đồng annual-demo bán gói năm.",
      ["POST /api/communities/annual-demo/checkout {\"interval\":\"annual\"}", "POST lại với {\"interval\":\"monthly\"}"], "annual-demo",
      "annual: amountCents=1200000; monthly: amountCents=175000; hai phiên có refCode khác nhau.")
    A("Tạo phiên", "Cộng đồng không bán gói năm: interval=annual bị 400 INTERVAL_UNAVAILABLE", "Chức năng", "Trung bình", ENV + " Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout {\"interval\":\"annual\"}"], "paid-demo",
      "400, error.code=INTERVAL_UNAVAILABLE.")
    A("Tạo phiên", "Khóa miễn phí / không tồn tại / chưa đăng nhập", "Chức năng", "Trung bình", ENV,
      ["Đăng nhập newbie: POST /api/courses/photo/checkout", "POST /api/courses/khong-ton-tai/checkout", "Không token: POST /api/courses/paid-demo/checkout"], "-",
      "400 'Khóa học này miễn phí, không cần thanh toán'; 404; 401.")
    A("Tạo phiên", "Đã có gói active / đã là thành viên checkout lại bị 409", "Chức năng", "Cao", ENV + " member1@sofinhub.test có gói active ở paid-demo.",
      ["Đăng nhập member1", "POST /api/courses/paid-demo/checkout"], "-", "409 CONFLICT, không tạo phiên pending mới.")
    A("Tạo phiên", "Idempotency-Key: cùng key trả cùng phiên; cùng key khác cộng đồng 409", "Chức năng", "Trung bình", ENV + " Đăng nhập user mới.",
      ["POST /api/courses/ai/checkout header Idempotency-Key: k1 (2 lần)", "POST /api/courses/biz/checkout cùng key k1"], "k1",
      "Hai lần đầu cùng id; lần với biz -> 409 'Idempotency-Key này đã được dùng cho giao dịch khác'.")
    A("Tạo phiên", "Chưa cấu hình BANK_ACCOUNT: checkout trả 503 BANK_NOT_CONFIGURED", "Chức năng", "Cao",
      "Tạm xóa BANK_ACCOUNT trong backend/.env rồi khởi động lại BE. Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout"], "BANK_ACCOUNT rỗng",
      "503, error.code=BANK_NOT_CONFIGURED, không tạo Payment. Khôi phục .env sau khi test.", pw="Không")
    A("Tạo phiên", "GET /payments/:id trả trạng thái + QR cho chủ phiên; người khác 403; id lạ 404", "Bảo mật", "Cao", ENV + " Có một phiên pending của newbie.",
      ["GET /api/payments/<id> bằng token newbie", "GET bằng token member1", "GET /api/payments/khong-co"], "-",
      "200 kèm transfer; 403; 404.")
    A("Tạo phiên", "POST /payments/:id/confirm (nút 'Tôi đã chuyển') KHÔNG cấp quyền, chỉ đọc lại trạng thái", "Bảo mật", "Cao", ENV + " Phiên pending, chưa có tiền về.",
      ["POST /api/payments/<id>/confirm bằng token chủ phiên"], "-",
      "200, status vẫn pending; newbie CHƯA enrolled. Quyền chỉ được cấp khi tiền về (webhook/quét/duyệt tay).")

    # ============================================================ 2. WEBHOOK
    A("Webhook SePay", "Thiếu/sai key bị 401; đúng key (Apikey hoặc Bearer) được nhận", "Bảo mật", "Cao", ENV + " " + WH,
      ["POST /api/payments/webhook không header Authorization", "Authorization: Apikey sai-key", "Authorization: Bearer <SEPAY_WEBHOOK_KEY> với payload hợp lệ"], "-",
      "Hai lần đầu 401 và KHÔNG cấp quyền; lần ba 200.")
    A("Webhook SePay", "SEPAY_WEBHOOK_KEY chưa đặt: TỪ CHỐI mọi webhook", "Bảo mật", "Cao",
      "Xóa SEPAY_WEBHOOK_KEY trong backend/.env, khởi động lại BE.", ["POST /api/payments/webhook với bất kỳ Authorization nào"], "-",
      "401 cho mọi request (không bao giờ mở toang webhook cộng tiền). Khôi phục .env sau test.", pw="Không")
    A("Webhook SePay", "Tiền đủ: cấp quyền, xuất hóa đơn INV-yyyy-nnnnnn, ghi BankTransaction credited", "Chức năng", "Cao", ENV + " " + WH + " Có phiên pending của newbie (paid-demo).",
      ["POST webhook với content chứa refCode, transferAmount=475000", "GET /api/payments/<id> (token newbie)", "GET /api/courses/paid-demo/subscription"], "transferAmount=475000",
      "Webhook 200 message=credited; payment status=succeeded, invoiceNumber dạng INV-2026-000001; newbie enrolled=true; Admin > bank/transactions có dòng credited=true gắn đúng payment.")
    A("Webhook SePay", "Webhook gửi lại cùng id giao dịch (kể cả 3 request song song) chỉ cộng 1 lần", "Chức năng", "Cao", ENV + " " + WH + " Phiên pending mới.",
      ["Gửi cùng payload (cùng id) 3 lần song song"], "-",
      "Cả 3 trả 200; chỉ 1 Payment succeeded, 1 Subscription, 1 hóa đơn, đúng 1 dòng BankTransaction cho externalId đó.")
    A("Webhook SePay", "Nội dung CK viết thường / chèn dấu cách vẫn khớp mã", "Chức năng", "Trung bình", ENV + " " + WH,
      ["Gửi content: 'ck sfh7k2 p9q4a tks' (chữ thường, có dấu cách giữa mã)"], "-", "Khớp đúng phiên và cấp quyền (message=credited).")
    A("Webhook SePay", "Giao dịch tiền RA (transferType=out) bị bỏ qua", "Chức năng", "Trung bình", ENV + " " + WH,
      ["Gửi payload transferType=out"], "-", "200 message='bỏ qua (không phải tiền vào)'; không có dòng BankTransaction mới.")
    A("Webhook SePay", "Thiếu tiền: không cấp, ghi chú 'thiếu tiền'; chuyển bù đủ thì cấp", "Chức năng", "Cao", ENV + " " + WH + " Phiên pending 475.000đ.",
      ["Gửi webhook transferAmount=474000", "Kiểm tra payment + Admin bank/transactions", "Gửi webhook thứ hai id mới transferAmount=475000"], "-",
      "Lần 1: message=underpaid, payment vẫn pending, BankTransaction credited=false note chứa 'thiếu tiền: cần 475000, nhận 474000'. Lần 2: credited, quyền được cấp.")
    A("Webhook SePay", "Chuyển dư: vẫn cấp, ghi chú phần dư để admin hoàn", "Chức năng", "Trung bình", ENV + " " + WH,
      ["Gửi transferAmount = giá + 50.000"], "-", "Cấp quyền; BankTransaction.note chứa 'chuyển dư 50000đ — cần hoàn phần dư'; log có [ALERT].")
    A("Webhook SePay", "Mã lạ / không có mã / vượt trần 50 triệu: lưu để admin soi, không cấp", "Chức năng", "Cao", ENV + " " + WH,
      ["Gửi content có mã SFHZZZZZZZZ (không tồn tại)", "Gửi content không có mã", "Gửi transferAmount=50000001"], "-",
      "message lần lượt unmatched / no_ref / unmatched; mỗi giao dịch có 1 dòng BankTransaction credited=false kèm note lý do; không ai được cấp quyền.")
    A("Webhook SePay", "Chuyển trùng cho phiên đã thanh toán: không cấp lần 2, ghi chú cần hoàn", "Chức năng", "Cao", ENV + " " + WH + " Phiên đã succeeded.",
      ["Gửi webhook mới (id khác) cùng refCode đã thanh toán"], "-",
      "message=duplicate; vẫn đúng 1 Payment succeeded; BankTransaction credited=false note 'chuyển trùng, cần hoàn'.")
    A("Webhook SePay", "Phiên hết hạn: tiền về muộn không tự cấp, admin duyệt tay mới cấp", "Chức năng", "Cao", ENV + " " + WH + MUTATE,
      ["Tạo phiên pending; dùng SQL đặt \"Payment\".\"expiresAt\" về quá khứ", "Gửi webhook đủ tiền", "Admin: POST /api/admin/bank/payments/<refCode>/approve {\"bankTransactionId\":\"<id dòng BankTransaction>\"}"], "-",
      "Bước 2: message=expired, payment chuyển failed (failureReason=expired), chưa cấp quyền. Bước 3: 200, payment succeeded, user enrolled, BankTransaction credited=true note 'Admin duyệt tay'.", pw="Một phần")

    # ============================================================ 3. QUÉT
    A("Cron quét SePay", "Quét kéo giao dịch từ SePay, khớp mã và cấp quyền đúng 1 lần dù webhook cũng tới", "Tích hợp", "Cao",
      ENV + " Cần SEPAY_API_TOKEN thật (hoặc chạy bằng test bank-transfer.test.ts với fetch giả).",
      ["Tạo phiên pending", "Chuyển khoản thật có nội dung = refCode", "Chờ ≤ 1 phút (job payments.bankScan) HOẶC Admin POST /api/admin/bank/scan"], "-",
      "payment succeeded; quét lần sau trả already (không cộng thêm); nếu webhook cũng tới thì vẫn đúng 1 hóa đơn.", pw="Không")
    A("Cron quét SePay", "Không có SEPAY_API_TOKEN: quét bỏ qua êm; token sai: báo lỗi nhưng không sập", "Chức năng", "Trung bình", ENV,
      ["Admin POST /api/admin/bank/scan khi SEPAY_API_TOKEN rỗng", "Đặt token sai rồi quét lại"], "-",
      "Lần 1: {skipped:true}. Lần 2: errors=1, log 'SEPAY_API_TOKEN sai hoặc đã bị thu hồi (401)'; API vẫn 200.", pw="Không")
    A("Cron quét SePay", "Webhook và quét chạy đồng thời trên cùng giao dịch: đúng 1 lần cấp", "Chức năng", "Cao", ENV + " Xem backend/tests/bank-transfer.test.ts.",
      ["Chạy: cd backend && npx cross-env NODE_ENV=test node --import tsx --test tests/bank-transfer.test.ts"], "-",
      "Test '(B) cron quét SePay' pass: 1 Payment succeeded, 1 Subscription, 1 BankTransaction.", pw="Không")
    A("Cron quét SePay", "Job nền được đăng ký: payments.bankScan (60s), payments.renewalInvoices (15 phút)", "Tích hợp", "Trung bình", ENV,
      ["Chạy test scheduler: npx cross-env NODE_ENV=test node --import tsx --test tests/scheduler.test.ts"], "-", "allJobs() chứa payments.bankScan và payments.renewalInvoices, tên duy nhất.", pw="Không")

    # ============================================================ 4. ADMIN
    A("Admin duyệt tay", "Admin duyệt tay phiên pending không cần giao dịch ngân hàng", "Chức năng", "Cao", ENV + " Có phiên pending của một user. Đăng nhập admin@sofinhub.test.",
      ["POST /api/admin/bank/payments/<refCode>/approve body {}"], "-",
      "200 payment succeeded, gatewayChargeId dạng manual:<adminId>:<paymentId>; user được cấp quyền; Audit log có 'payment.manual_approve'. Duyệt lần 2 -> 409 'đã được thanh toán'.")
    A("Admin duyệt tay", "Gán giao dịch ngân hàng thiếu tiền vào phiên bị từ chối 400; mã lạ 404; user thường 403", "Bảo mật", "Cao", ENV + " Có giao dịch BankTransaction 1.000đ chưa khớp.",
      ["Admin approve với bankTransactionId của giao dịch 1.000đ", "Admin approve /SFHKHONGCO", "User thường gọi approve / GET /api/admin/bank/transactions"], "-",
      "400 'không đủ'; 404; 403.")
    A("Admin duyệt tay", "Danh sách giao dịch ngân hàng lọc chưa khớp + trạng thái cấu hình", "Chức năng", "Trung bình", ENV + " Đã có vài giao dịch unmatched.",
      ["GET /api/admin/bank/transactions?credited=false&limit=100", "GET /api/admin/bank/status"], "-",
      "data chỉ gồm credited=false, có note lý do; status.configured=true khi có BANK_ACCOUNT.")
    A("Admin duyệt tay", "Admin mở lại phiên đã hết hạn (retry): cùng mã, hạn mới; giao dịch void do trùng không mở lại được", "Chức năng", "Trung bình", ENV + MUTATE,
      ["Cho phiên hết hạn (expireStaleSessions) -> failed/expired", "Admin: POST /api/admin/payments/transactions/<id>/retry (hoặc nút Retry)", "Thử với payment failed lý do duplicate_charge"], "-",
      "Bước 2: status=pending, cùng refCode, expiresAt mới (+15 phút). Bước 3: 409 'không mở lại được'.", pw="Một phần")
    A("Admin duyệt tay", "Giao diện Admin: màn 'Tiền vào ngân hàng' + Duyệt tay + Quét ngay", "Giao diện", "Cao", ENV + " Đăng nhập admin. Có giao dịch chưa khớp.",
      ["Vào Admin > Thanh toán > Tiền vào ngân hàng", "Bấm 'Duyệt tay' ở một dòng, nhập refCode, xác nhận", "Bấm 'Quét ngay'"], "-",
      "Bảng hiển thị giao dịch chưa khớp kèm ghi chú; duyệt tay thành công thì dòng chuyển credited; quét ngay hiện kết quả; có banner khi chưa cấu hình ngân hàng.")

    # ============================================================ 5. GIA HẠN & DÙNG THỬ
    A("Gia hạn", "Gói sắp hết kỳ: phát ĐÚNG 1 hóa đơn gia hạn (QR) kèm thông báo; chạy lặp không phát trùng", "Chức năng", "Cao",
      ENV + " Gói active còn ≤ 3 ngày (đặt SQL \"Subscription\".\"currentPeriodEnd\" = now()+2 ngày)." + MUTATE,
      ["Chờ job payments.renewalInvoices (15 phút) hoặc gọi paymentsService.issueRenewalInvoices()", "Chạy lần 2", "GET /api/me/payments và /api/notifications"], "-",
      "Có đúng 1 Payment kind=renewal pending (refCode, expiresAt = hết kỳ + 2 ngày, periodStart = currentPeriodEnd); lần 2 không phát thêm; user nhận thông báo 'Đến hạn gia hạn gói thành viên'.", pw="Không")
    A("Gia hạn", "Trả hóa đơn gia hạn: nối kỳ mới 30/365 ngày, hóa đơn mới, vẫn 1 gói", "Chức năng", "Cao", ENV + " " + WH + " Đã có hóa đơn gia hạn pending.",
      ["Gửi webhook đủ tiền với refCode của hóa đơn gia hạn (kể cả gửi 2 lần song song)"], "-",
      "Subscription: status=active, currentPeriodStart = currentPeriodEnd cũ, currentPeriodEnd = +30 ngày (gói năm +365); Payment succeeded có invoiceNumber; user chỉ có 1 Subscription.")
    A("Gia hạn", "Hết kỳ mà chưa trả: trong ân hạn 2 ngày vẫn giữ quyền; hết ân hạn -> expired, mất quyền", "Chức năng", "Cao", ENV + MUTATE,
      ["Ép gói quá hạn 1 ngày chưa có hóa đơn; chạy processDueSubscriptions (job 5 phút)", "Lượt chạy tiếp theo", "Ép hóa đơn hết hạn, chạy expireStaleSessions rồi processDueSubscriptions"], "-",
      "Lượt 1: phát hóa đơn ân hạn, gói vẫn active, còn quyền. Lượt 2: vẫn active. Sau khi hết ân hạn: Subscription=expired, enrollment bị thu hồi, user nhận 'Gói thành viên đã hết hạn'.", pw="Không")
    A("Gia hạn", "Trả muộn sau khi gói expired: admin duyệt tay -> gói sống lại, kỳ mới tính từ bây giờ", "Chức năng", "Trung bình", ENV + " " + WH + MUTATE,
      ["Gửi webhook cho hóa đơn đã failed/expired", "Admin approve refCode"], "-",
      "Bước 1: message=expired (ghi nhận tiền, chưa cấp). Bước 2: Subscription active, currentPeriodEnd > now + 29 ngày, user lại enrolled.", pw="Không")
    A("Gia hạn", "Gói đã đặt hủy cuối kỳ không được phát hóa đơn gia hạn", "Chức năng", "Trung bình", ENV + " Gói active sắp hết kỳ, cancelAtPeriodEnd=true.",
      ["Chạy issueRenewalInvoices"], "-", "Không có Payment kind=renewal mới cho gói đó.", pw="Không")
    A("Dùng thử", "Dùng thử KHÔNG cần thẻ; thanh toán trong lúc thử chuyển sang gói trả phí", "Chức năng", "Cao", ENV + " " + WH + " Cộng đồng bật memberTrialEnabled (vd des).",
      ["POST /api/courses/des/trial body {}", "POST /api/courses/des/checkout rồi gửi webhook đủ tiền"], "-",
      "Bước 1: 201 status=trialing, paymentMethod=null. Bước 2: Subscription chuyển active (không tạo gói thứ hai).")
    A("Dùng thử", "Hết dùng thử mà không thanh toán: expired, mất quyền (không có trừ thẻ tự động)", "Chức năng", "Cao", ENV + MUTATE,
      ["Bắt đầu thử; SQL ép currentPeriodEnd về quá khứ", "Chạy processDueSubscriptions"], "-",
      "Subscription=expired, user không còn enrolled, thông báo 'Thời gian dùng thử đã kết thúc'.", pw="Không")

    # ============================================================ 6. MODULE & VND
    A("Mua module", "Mua lẻ module: POST purchase trả phiên pending + QR; tiền về mới mở khóa", "Chức năng", "Cao", ENV + " " + WH + " Module accessMode=paid có giá; user đã tham gia cộng đồng.",
      ["POST /api/communities/<id>/modules/<moduleId>/purchase body {}", "Kiểm tra module còn khóa", "Gửi webhook đủ tiền với refCode"], "-",
      "Bước 1: 201 status=pending kèm transfer. Bước 2: ModuleAccess chưa có. Bước 3: payment succeeded, ModuleAccess(purchase) được tạo, module mở khóa.")
    A("Tiền VND", "Giá/báo giá hiển thị VND nguyên, không chia 100, không còn ký hiệu $", "Giao diện", "Cao", ENV,
      ["GET /api/courses/ai/checkout-quote", "Mở trang chi tiết cộng đồng 'ai' và hộp thoại Tham gia"], "-",
      "currency=VND, provider=bank_transfer, plans[0].priceUsd=175000 (tên field cũ, đơn vị đồng); UI hiện 175.000 ₫ ở mọi nơi.")
    A("Tiền VND", "Mã tham chiếu luôn tự trích lại được từ nội dung CK", "Chức năng", "Trung bình", "Chạy unit test.",
      ["Chạy test 'extractRef/makeRefCode' trong bank-transfer.test.ts"], "200 mã ngẫu nhiên", "Mọi mã sinh ra đều được extractRef nhận lại đúng; chuỗi không có mã -> ''.", pw="Không")

    # ============================================================ 7. GIAO DIỆN
    A("Giao diện", "Hộp thoại Tham gia: bỏ ô nhập thẻ, CTA tạo mã chuyển khoản, hiện QR + đếm ngược 15 phút", "Giao diện", "Cao", ENV + " Đăng nhập newbie.",
      ["Vào paid-demo, bấm Tham gia", "Chọn gói, bấm tạo mã chuyển khoản"], "-",
      "Không còn form thẻ; hiển thị QR, số tài khoản, tên chủ TK, số tiền, nội dung CK (nút copy) và đồng hồ đếm ngược tới expiresAt.")
    A("Giao diện", "FE poll trạng thái ~4s: tiền về thì tự báo thành công và vào được cộng đồng", "Giao diện", "Cao", ENV + " " + WH,
      ["Mở QR của phiên pending", "Gửi webhook đủ tiền", "Quan sát hộp thoại không reload"], "-",
      "Trong ≤ ~5s hộp thoại chuyển 'Thanh toán thành công', trang cộng đồng mở khóa mà không cần F5.")
    A("Giao diện", "Phiên hết hạn: hộp thoại báo hết hạn và cho tạo mã mới", "Giao diện", "Trung bình", ENV + " Đặt expiresAt của phiên về quá khứ bằng SQL.",
      ["Để hộp thoại mở / bấm 'Tôi đã chuyển khoản'"], "-", "Hiện 'Phiên đã hết hạn' + nút tạo phiên mới; nếu đã lỡ chuyển tiền, hướng dẫn liên hệ admin (tiền được ghi nhận chờ duyệt tay).", pw="Một phần")
    A("Giao diện", "Cài đặt > Thanh toán: bỏ quản lý thẻ, có 'Thanh toán ngay' cho hóa đơn gia hạn đang chờ", "Giao diện", "Trung bình", ENV + " Có hóa đơn gia hạn pending.",
      ["Vào /settings/billing"], "-", "Không còn danh sách/nút thêm thẻ cho gói thành viên; hóa đơn pending có nút 'Thanh toán ngay' mở QR; lịch sử hiện đúng VND.")

    # ============================================================ 8. ĐIỂM CHƯA LÀM
    A("Chưa làm / quyết định", "HIỆN TẠI: hoàn tiền chỉ GHI NHẬN, admin phải chuyển khoản trả khách ngoài hệ thống", "Chức năng", "Cao",
      "Có yêu cầu hoàn tiền được duyệt.", ["Admin duyệt yêu cầu hoàn tiền", "Kiểm tra gatewayRefundId"], "-",
      "KỲ VỌNG sau khi chốt: có hàng đợi/trạng thái 'đã chuyển trả' để theo dõi. HIỆN TẠI: refund approved ngay, gatewayRefundId=manual:<id>, quyền đã thu hồi, không có API ngân hàng nào được gọi.", pw="Không", st=PLAN)
    A("Chưa làm / quyết định", "HIỆN TẠI: alert tiền lạ chỉ ghi log [ALERT][payments], chưa bắn Telegram/email cho admin", "Chức năng", "Trung bình", ENV,
      ["Gửi webhook chuyển dư / phiên hết hạn / chuyển trùng"], "-", "KỲ VỌNG: thông báo cho admin. HIỆN TẠI: chỉ console.error và note trong BankTransaction.", pw="Không", st=PLAN)
    A("Chưa làm / quyết định", "HIỆN TẠI: chưa tự đối chiếu tài khoản nhận (accountNumber) trong webhook với BANK_ACCOUNT", "Bảo mật", "Trung bình", ENV + " " + WH,
      ["Gửi webhook accountNumber khác BANK_ACCOUNT nhưng content đúng refCode + đủ tiền"], "-",
      "HIỆN TẠI: vẫn cấp (khóa bảo vệ duy nhất là SEPAY_WEBHOOK_KEY). KỲ VỌNG: quyết định có lọc theo tài khoản nhận hay không.", pw="Không", st=PLAN)
    A("Dùng thử", "Nhắc thanh toán trước khi hết dùng thử (3 ngày): email + thông báo hướng dẫn chuyển khoản", "Chức năng", "Trung bình", ENV + MUTATE,
      ["Bắt đầu dùng thử; SQL ép currentPeriodEnd = now()+2 ngày", "Chờ job payments.trialReminders (15 phút) hoặc gọi sendTrialReminders()", "Xem GET /api/dev/outbox và /api/notifications"], "-",
      "Đúng 1 email + 1 thông báo/gói: nêu ngày kết thúc, số tiền VND, hướng dẫn thanh toán bằng chuyển khoản QR (không nhắc thẻ). Chạy lại không nhắc lần 2; gói đã hủy không nhận nhắc.", pw="Không")

    # ============================================================ 9. BỎ DÙNG THỬ MIỄN PHÍ (14/10/2026)
    A("Bỏ dùng thử", "Không còn dùng thử miễn phí: gọi POST /api/courses/<id>/trial trả 404; checkout-quote trialDays=0, trialEligible=false; wizard không còn công tắc dùng thử", "Chức năng", "Cao",
      ENV + " Đăng nhập newbie@sofinhub.test. Đã chạy migration 20261014110000_remove_member_trial.",
      ["POST /api/courses/paid-demo/trial (có token) và POST /api/communities/paid-demo/trial", "GET /api/communities/annual-demo/checkout-quote?interval=annual",
       "POST /api/communities với body có \"memberTrialEnabled\": true rồi GET /api/communities/<id>",
       "Mở /create (wizard) bước 4 'Thành viên & giá' chọn Có phí", "Mở hộp thoại Tham gia ở annual-demo"], "-",
      "Bước 1: cả hai đường đều 404 NOT_FOUND, không tạo Subscription. Bước 2: trialDays=0, trialEligible=false, firstChargeDate=startsAt, dueTodayUsd=giá kỳ, remindAt=null. "
      "Bước 3: 201 nhưng memberTrialEnabled=false trong response (field bị bỏ qua). Bước 4: KHÔNG có checkbox 'Cho thành viên mới dùng thử 7 ngày' (dùng thử 14 ngày ở bước 2 là của GÓI HOSTING owner, vẫn còn). "
      "Bước 5: CTA là 'Thanh toán', không có 'Bắt đầu dùng thử miễn phí' hay ghi chú dùng thử.")
    A("Bỏ dùng thử", "Cộng đồng chỉ có 2 loại: miễn phí hoặc trả phí (bộ lọc giá không còn mục Dùng thử; thẻ cộng đồng không còn nhãn dùng thử)", "Giao diện", "Trung bình",
      ENV + " Đã chạy npm run db:reset sau migration remove_member_trial (dữ liệu pricing 'trial' đã chuyển 'paid').",
      ["Mở trang khám phá khóa học, đọc bộ lọc giá", "GET /api/courses?pricing=trial và GET /api/courses?pricing=paid", "Mở thẻ cộng đồng có phí và trang chi tiết (ghi chú giá)"], "-",
      "Bộ lọc chỉ có Tất cả / Có phí / Miễn phí (không có 'Dùng thử miễn phí'); không cộng đồng nào có pricing 'trial' (đã thành 'paid'); thẻ cộng đồng và ghi chú giá chỉ hiện 'Hủy bất kỳ lúc nào', không có nhãn/ghi chú dùng thử. "
      "Gói trialing CŨ còn trong dữ liệu (seed member3) vẫn hết hạn/được nhắc bình thường.", pw="Có")
