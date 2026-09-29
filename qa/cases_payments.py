# -*- coding: utf-8 -*-
"""Bổ sung testcase module PAY (Thanh toán & Gói thành viên) - số liệu bám seed/payments.ts, cộng đồng paid-demo ($19/tháng = 1900 cent)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
SEED_NOTE = ("Seed đã chạy (npm run db:seed) trên DB sạch; paid-demo = cộng đồng công khai $19/tháng (1900 cent), Owner: owner@sofinhub.test. "
             "Mật khẩu chung Passw0rd!x. Thành viên minh họa isDemo = demo-paid-demo-<i>, không đăng nhập được.")
SIGN = ("Ký webhook: header x-sofin-signature = t=<unix giây hiện tại>,v1=<hex HMAC-SHA256 của chuỗi \"<t>.<rawBody>\">, "
        "secret = PAYMENT_WEBHOOK_SECRET (mặc định dev: dev-webhook-secret-change-me), rawBody là đúng chuỗi JSON gửi đi (không khoảng trắng thừa).")
MUTATE = "Case làm thay đổi dữ liệu seed - chạy lại npm run db:seed (hoặc dùng tài khoản/gói mới) trước khi lặp lại."


def load(add):
    M, MN = "PAY", "Thanh toán & Gói thành viên"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. CHECKOUT
    A("Checkout", "Tạo giao dịch checkout khóa có phí: giá lấy từ server, trạng thái pending",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie@sofinhub.test (chưa ở cộng đồng nào).",
      ["Đăng nhập newbie, lấy access token", "Gọi POST /api/courses/paid-demo/checkout với body {\"method\":\"stripe\"}",
       "Đọc response"],
      "method=stripe; không gửi Idempotency-Key",
      "201 {data}: PaymentIntent có courseId=paid-demo, userId=newbie, amountCents=1900 (amountUsd=19), status=pending, kind=initial, trialDays=7, chưa có invoiceNumber. "
      "newbie vẫn CHƯA ở cộng đồng (GET /api/courses/paid-demo/subscription -> enrolled=false).")
    A("Checkout", "Không tin số tiền client: amountUsd/amountCents trong body bị bỏ qua",
      "Bảo mật", "Cao", SEED_NOTE + " Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout với body {\"method\":\"stripe\",\"amountCents\":1,\"amountUsd\":0.01}", "Đọc response"],
      "amountCents=1, amountUsd=0.01",
      "201; amountCents trong response vẫn = 1900 (lấy từ course.priceUsd ở server), không có 400 vì field thừa.")
    for m in ("stripe", "vnpay", "momo"):
        A("Checkout", f"Checkout với phương thức hợp lệ '{m}'",
          "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập newbie.",
          [f"POST /api/courses/paid-demo/checkout body {{\"method\":\"{m}\"}}"],
          f"method={m}", f"201, PaymentIntent.method={m}, status=pending, amountCents=1900.")
    for bad, why in (("paypal", "phương thức ngoài danh sách"), ("", "chuỗi rỗng"), (None, "thiếu field method")):
        body = "{}" if bad is None else "{\"method\":\"%s\"}" % bad
        A("Checkout", f"Checkout body sai: {why}",
          "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập newbie.",
          [f"POST /api/courses/paid-demo/checkout body {body}"], f"body={body}",
          "400, error.code=VALIDATION_ERROR, message 'Tham số không hợp lệ' (details chỉ ra field method). Không tạo giao dịch nào (GET /api/me/payments không có dòng mới).")
    A("Checkout", "Checkout khóa miễn phí bị từ chối 400",
      "Chức năng", "Cao", "Đăng nhập newbie. Cộng đồng photo là miễn phí.",
      ["POST /api/courses/photo/checkout body {\"method\":\"stripe\"}"], "courseId=photo",
      "400, error.code=BAD_REQUEST, message 'Khóa học này miễn phí, không cần thanh toán'. Kiểm tra miễn phí đi trước kiểm tra đã-tham-gia.")
    A("Checkout", "Checkout khóa học không tồn tại trả 404",
      "Chức năng", "Trung bình", "Đăng nhập newbie.",
      ["POST /api/courses/khong-ton-tai-xyz/checkout body {\"method\":\"stripe\"}"], "courseId=khong-ton-tai-xyz",
      "404, error.code=NOT_FOUND.")
    A("Checkout", "Checkout không có token trả 401",
      "Bảo mật", "Cao", "Không đăng nhập (guest).",
      ["POST /api/courses/paid-demo/checkout body {\"method\":\"stripe\"} không gửi Authorization"], "-",
      "401, error.code=UNAUTHORIZED, message 'Vui lòng đăng nhập để tiếp tục'.")
    A("Checkout", "Đã là thành viên trả phí (member1) checkout lại bị 409",
      "Chức năng", "Cao", SEED_NOTE + " member1@sofinhub.test có gói active ở paid-demo (seed-sub-member1) và đã được ghi danh.",
      ["Đăng nhập member1", "POST /api/courses/paid-demo/checkout body {\"method\":\"stripe\"}"], "-",
      "409, error.code=CONFLICT, message 'Bạn đã tham gia khóa học này rồi'. Không tạo giao dịch pending mới.")
    A("Checkout", "Owner checkout khóa của chính mình bị 409",
      "Chức năng", "Thấp", SEED_NOTE + " owner đã ghi danh với vai trò owner ở paid-demo.",
      ["Đăng nhập owner", "POST /api/courses/paid-demo/checkout body {\"method\":\"stripe\"}"], "-",
      "409 'Bạn đã tham gia khóa học này rồi'.")
    A("Checkout", "Thành viên đang dùng thử (member3) vẫn checkout được để nâng lên gói trả phí",
      "Chức năng", "Cao", SEED_NOTE + " member3@sofinhub.test đang trialing (seed-sub-member3, còn ~4 ngày), đã được ghi danh.",
      ["Đăng nhập member3", "POST /api/courses/paid-demo/checkout body {\"method\":\"stripe\"}"], "-",
      "201, giao dịch pending amountCents=1900 (khác member1: KHÔNG bị 409 vì gói đang trialing).")
    A("Checkout", "Giao diện trang /courses/paid-demo/checkout hiển thị giá và 3 phương thức",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập newbie.",
      ["Mở /courses/paid-demo/checkout", "Quan sát tiêu đề, danh sách phương thức, nút thanh toán"], "-",
      "Tiêu đề 'Xác nhận thanh toán'; 3 lựa chọn VNPay (mặc định chọn), MoMo, Stripe; nút 'Thanh toán $19/tháng'; có khung 'Bắt đầu dùng thử' 7 ngày.")
    A("Checkout", "Bấm Thanh toán trên UI: gửi Idempotency-Key, chuyển vào cộng đồng",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie. " + MUTATE,
      ["Mở /courses/paid-demo/checkout, chọn Stripe", "Bấm 'Thanh toán $19/tháng' (xem tab Network)"], "method=stripe",
      "Nút chuyển 'Đang xử lý…' và bị vô hiệu hóa; POST checkout có header Idempotency-Key (uuid) -> 201, POST /payments/:id/confirm -> 200 succeeded; "
      "trình duyệt chuyển tới /courses/paid-demo/community; newbie có thông báo 'Thanh toán thành công' (body 'Bạn đã thanh toán 19.00 USD. Hóa đơn INV-…').")

    # ============================================================ 2. CONFIRM & IDEMPOTENT
    A("Confirm", "Confirm thanh toán thành công: cấp quyền, hóa đơn, gói active 30 ngày",
      "Chức năng", "Cao", SEED_NOTE + " newbie đã có 1 giao dịch pending từ checkout paid-demo. " + MUTATE,
      ["POST /api/payments/<paymentId>/confirm bằng token newbie", "GET /api/courses/paid-demo/subscription", "GET /api/courses/paid-demo/members hoặc mở /courses/paid-demo/community"],
      "paymentId từ bước checkout",
      "200: status=succeeded, confirmedAt có giá trị, invoiceNumber dạng INV-2026-nnnnnn (kế tiếp số hóa đơn lớn nhất đang có), gatewayChargeId bắt đầu 'mock_ch_', periodEnd = periodStart + 30 ngày. "
      "Subscription status=active, priceCents=1900, cancelAtPeriodEnd=false; enrolled=true; newbie vào được cộng đồng.")
    A("Confirm", "Confirm lần 2 cùng giao dịch: idempotent, không thu tiền/hóa đơn trùng",
      "Chức năng", "Cao", SEED_NOTE + " newbie đã confirm thành công 1 giao dịch (xem case trước).",
      ["Ghi lại invoiceNumber và số dòng GET /api/me/payments", "POST /api/payments/<cùng paymentId>/confirm lần 2"], "-",
      "200, trả đúng bản ghi đã succeeded (cùng invoiceNumber, cùng gatewayChargeId); GET /api/me/payments không thêm dòng; số hóa đơn kế tiếp của hệ thống không nhảy.")
    A("Confirm", "Người khác confirm giao dịch của mình bị 403 (IDOR)",
      "Bảo mật", "Cao", SEED_NOTE + " newbie có giao dịch pending P; member2 đăng nhập.",
      ["Đăng nhập member2", "POST /api/payments/<P>/confirm bằng token member2"], "paymentId của newbie",
      "403, error.code=FORBIDDEN, message 'Bạn không có quyền thực hiện thao tác này'. Giao dịch P vẫn pending.")
    A("Confirm", "Confirm giao dịch không tồn tại trả 404",
      "Chức năng", "Trung bình", "Đăng nhập newbie.",
      ["POST /api/payments/khong-co-giao-dich/confirm"], "paymentId=khong-co-giao-dich",
      "404, error.code=NOT_FOUND, message 'Không tìm thấy giao dịch'.")
    A("Confirm", "Confirm không token trả 401",
      "Bảo mật", "Trung bình", "Guest.", ["POST /api/payments/seed-pay-member1-a/confirm không gửi token"], "-", "401 UNAUTHORIZED.")
    A("Confirm", "Confirm giao dịch đã succeeded của seed (member1) trả lại bản ghi, không đổi dữ liệu",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập member1; seed-pay-member1-a status succeeded.",
      ["POST /api/payments/seed-pay-member1-a/confirm bằng token member1"], "paymentId=seed-pay-member1-a",
      "200, trả nguyên bản ghi succeeded (invoiceNumber, gatewayChargeId='seed_ch_seed-pay-member1-a'), không tạo giao dịch mới.")
    A("Confirm", "Confirm giao dịch đã failed trả 409, phải tạo giao dịch mới",
      "Chức năng", "Trung bình",
      SEED_NOTE + " Cần giao dịch failed: tạo bằng cách checkout (newbie) rồi gửi webhook payment.failed {paymentId}. " + SIGN,
      ["Checkout paid-demo bằng newbie lấy paymentId", "Gửi webhook payment.failed {paymentId} hợp lệ", "POST /api/payments/<paymentId>/confirm bằng newbie"],
      "event {\"id\":\"evt-fail-1\",\"type\":\"payment.failed\",\"data\":{\"paymentId\":\"<id>\",\"reason\":\"card_declined\"}}",
      "Webhook 200 {received:true}; confirm trả 409 CONFLICT 'Giao dịch đã thất bại, vui lòng tạo giao dịch mới'; newbie có thông báo 'Thanh toán thất bại'; không được cấp quyền.")
    A("Confirm", "Cổng từ chối thẻ khi confirm: 402 PAYMENT_FAILED, không cấp quyền",
      "Chức năng", "Cao", "Chỉ kiểm được bằng test tích hợp BE (payments.test.ts dùng mockGateway.failFor(userId)); MockGateway của dev luôn thành công nên không giả lập được qua UI.",
      ["Trong test BE: mockGateway.failFor(<userId>)", "Checkout rồi confirm"], "-",
      "402, error.code=PAYMENT_FAILED, message 'Thanh toán không thành công, vui lòng thử lại hoặc dùng phương thức khác'; giao dịch chuyển failed; người dùng không được ghi danh; có thông báo payment_failed.",
      pw="Không")
    A("Confirm", "Sau khi bị cấm khỏi paid-demo, confirm bị 403 và không cấp quyền",
      "Bảo mật", "Cao", SEED_NOTE + " newbie có giao dịch pending P ở paid-demo. Owner đã cấm newbie: POST /api/courses/paid-demo/members/<newbieId>/ban body {\"reason\":\"test\"}. " + MUTATE,
      ["Đăng nhập newbie", "POST /api/payments/<P>/confirm"], "-",
      "403, message 'Bạn đã bị cấm khỏi cộng đồng này'; không có Subscription mới; newbie vẫn không vào được cộng đồng.")
    A("Idempotency", "Cùng Idempotency-Key checkout 2 lần trả cùng một giao dịch",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie.",
      ["POST /api/courses/paid-demo/checkout header Idempotency-Key: qa-key-001 body {\"method\":\"stripe\"}", "Lặp lại đúng request lần 2", "GET /api/me/payments"],
      "Idempotency-Key=qa-key-001",
      "Cả hai đều 201 với cùng payment.id; /me/payments chỉ có 1 dòng pending mới.")
    A("Idempotency", "Idempotency-Key khác nhau tạo hai giao dịch pending khác nhau",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập newbie.",
      ["POST checkout key qa-key-A", "POST checkout key qa-key-B"], "2 key khác nhau",
      "Hai response 201 có payment.id khác nhau, cùng amountCents=1900.")
    A("Idempotency", "Idempotency-Key dùng cho khóa học khác trả 409",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập member1 (paid-demo và yt đều có phí). Nếu yt miễn phí thì tạo giao dịch bằng cộng đồng có phí khác.",
      ["Tạo một giao dịch checkout ở khóa có phí X với key qa-key-X (dùng tài khoản chưa tham gia X)", "Gọi checkout khóa có phí Y khác cùng tài khoản, cùng key qa-key-X"], "key dùng lại cho khóa khác",
      "409, error.code=CONFLICT, message 'Idempotency-Key này đã được dùng cho giao dịch khác'.")
    A("Idempotency", "Idempotency-Key của người khác không bị lộ giao dịch (key tách theo userId)",
      "Bảo mật", "Trung bình", SEED_NOTE + " newbie đã checkout với key qa-key-001.",
      ["Đăng ký tài khoản mới B (chưa ở paid-demo) và đăng nhập", "POST checkout paid-demo cùng header Idempotency-Key: qa-key-001"], "cùng key khác user",
      "Người dùng B nhận giao dịch MỚI của chính B (payment.id khác, userId=B), không nhận giao dịch của newbie (key map theo (userId,key)).")
    A("Idempotency", "Double submit nút Thanh toán: chỉ 1 giao dịch, 1 hóa đơn",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie. " + MUTATE,
      ["Mở /courses/paid-demo/checkout", "Bấm rất nhanh 'Thanh toán $19/tháng' nhiều lần (hoặc Enter lặp)", "Mở /billing xem Lịch sử thanh toán"], "-",
      "Nút disabled ngay sau lần bấm đầu; chỉ 1 dòng giao dịch succeeded, 1 số hóa đơn, 1 gói active.",
      pw="Một phần")
    A("Idempotency", "Hai confirm song song cùng giao dịch: cổng chỉ trừ 1 lần, 1 hóa đơn",
      "Chức năng", "Cao", SEED_NOTE + " newbie có giao dịch pending P. " + MUTATE,
      ["Gửi đồng thời 5 request POST /api/payments/<P>/confirm (Promise.all trong Playwright request context)", "GET /api/me/payments"], "5 request song song",
      "Tất cả 200 (hoặc trả bản ghi đã xử lý); chỉ 1 giao dịch succeeded, 1 invoiceNumber, 1 Subscription; không có 500.", pw="Một phần")

    # ============================================================ 3. DÙNG THỬ
    A("Dùng thử miễn phí", "Bắt đầu dùng thử 7 ngày: cấp quyền ngay, không thu tiền",
      "Chức năng", "Cao", SEED_NOTE + " newbie chưa từng dùng thử. " + MUTATE,
      ["Đăng nhập newbie", "POST /api/courses/paid-demo/trial", "GET /api/me/payments", "GET /api/me/subscriptions"], "TRIAL_DAYS=7 (giá trị tạm)",
      "201 Subscription status=trialing, trialEndsAt = currentPeriodEnd = hiện tại + 7 ngày, priceCents=1900; newbie đã ghi danh, vào được /courses/paid-demo/community; /me/payments KHÔNG có giao dịch; có thông báo 'Bắt đầu dùng thử'.")
    A("Dùng thử miễn phí", "Nút 'Bắt đầu dùng thử' trên trang checkout",
      "Giao diện", "Cao", SEED_NOTE + " Đăng nhập newbie (chưa dùng thử). " + MUTATE,
      ["Mở /courses/paid-demo/checkout", "Bấm 'Bắt đầu dùng thử'"], "-",
      "Chuyển tới /courses/paid-demo/community; /billing hiển thị gói 'Đang dùng thử' với ngày truy cập đến = hôm nay + 7.")
    A("Dùng thử miễn phí", "Không dùng thử lần 2 sau khi đã hủy gói dùng thử",
      "Chức năng", "Cao", SEED_NOTE + " newbie vừa dùng thử và đã hủy ngay: POST /api/courses/paid-demo/subscription/cancel body {\"atPeriodEnd\":false}. " + MUTATE,
      ["POST /api/courses/paid-demo/trial lần nữa bằng newbie"], "-",
      "409 CONFLICT, message 'Bạn đã dùng thử cộng đồng này rồi'; không có Subscription mới; newbie chưa ở cộng đồng.")
    A("Dùng thử miễn phí", "Đang dùng thử (member3) gọi trial lại bị 409 'đã tham gia'",
      "Chức năng", "Trung bình", SEED_NOTE + " member3 đang trialing.",
      ["Đăng nhập member3", "POST /api/courses/paid-demo/trial"], "-",
      "409, message 'Bạn đã tham gia cộng đồng này rồi' (kiểm tra ghi danh đi trước kiểm tra đã dùng thử).")
    A("Dùng thử miễn phí", "Thành viên trả phí (member1) không dùng thử được",
      "Chức năng", "Trung bình", SEED_NOTE, ["Đăng nhập member1", "POST /api/courses/paid-demo/trial"], "-", "409 'Bạn đã tham gia cộng đồng này rồi'.")
    A("Dùng thử miễn phí", "Dùng thử khóa miễn phí trả 400",
      "Chức năng", "Trung bình", "Đăng nhập newbie; photo miễn phí.", ["POST /api/courses/photo/trial"], "-",
      "400 BAD_REQUEST, message 'Cộng đồng miễn phí không có dùng thử'.")
    A("Dùng thử miễn phí", "Bị cấm khỏi paid-demo thì không dùng thử được, rollback gói",
      "Bảo mật", "Cao", SEED_NOTE + " Owner đã cấm newbie khỏi paid-demo (POST /api/courses/paid-demo/members/<id>/ban). " + MUTATE,
      ["Đăng nhập newbie", "POST /api/courses/paid-demo/trial", "GET /api/me/subscriptions"], "-",
      "403 FORBIDDEN; không có Subscription trialing nào được tạo (rollback); newbie vẫn không ghi danh.")
    A("Dùng thử miễn phí", "Dùng thử không token trả 401 và khóa không tồn tại trả 404",
      "Chức năng", "Thấp", "-", ["POST /api/courses/paid-demo/trial không token", "POST /api/courses/khong-co/trial có token newbie"], "-", "Lần 1: 401 UNAUTHORIZED. Lần 2: 404 NOT_FOUND.")
    A("Dùng thử miễn phí", "Đang dùng thử rồi thanh toán: chuyển thành gói active, kỳ mới từ lúc trả tiền",
      "Chức năng", "Cao", SEED_NOTE + " member3 đang trialing (seed-sub-member3). " + MUTATE,
      ["Đăng nhập member3", "Checkout paid-demo rồi confirm", "GET /api/courses/paid-demo/subscription"], "-",
      "Confirm 200 succeeded có invoiceNumber; subscription cùng id seed-sub-member3 chuyển status=active, currentPeriodStart = thời điểm trả tiền, currentPeriodEnd = +30 ngày, cancelAtPeriodEnd=false; không tạo gói thứ hai.")
    A("Dùng thử miễn phí", "Hết hạn dùng thử: scheduler chuyển expired và thu hồi quyền",
      "Tích hợp", "Cao",
      SEED_NOTE + " member3 trialing. Quyền DB: sửa Subscription seed-sub-member3 đặt currentPeriodEnd về quá khứ (vd. now - 1 giờ). Scheduler chạy mỗi 5 phút (tắt khi NODE_ENV=test). " + MUTATE,
      ["Sửa currentPeriodEnd bằng SQL", "Chờ tối đa 5 phút (hoặc restart BE) cho processDueSubscriptions", "Đăng nhập member3, mở /courses/paid-demo/community", "GET /api/notifications"], "-",
      "Subscription.status=expired; enrollment của member3 bị xóa (vào cộng đồng bị chặn); thông báo system 'Gói thành viên đã kết thúc' body 'Thời gian dùng thử đã kết thúc. Hãy đăng ký gói để tiếp tục truy cập.'; không phát sinh giao dịch.",
      pw="Không")

    # ============================================================ 4. HỦY / TIẾP TỤC
    A("Hủy & tiếp tục gói", "member2 (đã hủy cuối kỳ) vẫn còn truy cập, trạng thái 'Đã hủy'",
      "Chức năng", "Cao", SEED_NOTE + " member2 có seed-sub-member2: active, cancelAtPeriodEnd=true, còn ~15 ngày.",
      ["Đăng nhập member2", "GET /api/courses/paid-demo/subscription", "Mở /billing"], "-",
      "enrolled=true; subscription.cancelAtPeriodEnd=true, status=active, accessUntil = currentPeriodEnd (~ +15 ngày); /billing hiện nhãn 'Đã hủy' kèm nút 'Tiếp tục gói'.")
    A("Hủy & tiếp tục gói", "member2 bấm 'Tiếp tục gói' (resume)",
      "Chức năng", "Cao", SEED_NOTE + " member2 gói hủy cuối kỳ. " + MUTATE,
      ["Đăng nhập member2", "Mở /billing, bấm 'Tiếp tục gói' (hoặc POST /api/courses/paid-demo/subscription/resume)"], "-",
      "200 Subscription cancelAtPeriodEnd=false, canceledAt=null, status vẫn active, currentPeriodEnd không đổi; UI trở lại 'Đang hoạt động' và hiện nút 'Hủy gói'; MRR của owner tăng 1900.")
    A("Hủy & tiếp tục gói", "Resume khi chưa hủy trả 409",
      "Chức năng", "Trung bình", SEED_NOTE + " member1 gói active bình thường.",
      ["Đăng nhập member1", "POST /api/courses/paid-demo/subscription/resume"], "-", "409, message 'Gói này không ở trạng thái hủy cuối kỳ'.")
    A("Hủy & tiếp tục gói", "Resume khi không có gói trả 404",
      "Chức năng", "Trung bình", SEED_NOTE, ["Đăng nhập newbie", "POST /api/courses/paid-demo/subscription/resume"], "-",
      "404, message 'Bạn không có gói thành viên đang hoạt động ở cộng đồng này'.")
    A("Hủy & tiếp tục gói", "Resume khi gói đã hết kỳ trả 409",
      "Chức năng", "Trung bình", SEED_NOTE + " Sửa DB seed-sub-member2: currentPeriodEnd về quá khứ nhưng scheduler chưa chạy (làm trong vòng dưới 5 phút). " + MUTATE,
      ["Sửa currentPeriodEnd = now - 1 phút", "Ngay lập tức member2 POST /api/courses/paid-demo/subscription/resume"], "-",
      "409, message 'Gói đã hết kỳ, không thể tiếp tục'.", pw="Không")
    A("Hủy & tiếp tục gói", "member1 hủy cuối kỳ (mặc định atPeriodEnd=true): còn truy cập tới hết kỳ",
      "Chức năng", "Cao", SEED_NOTE + " member1 gói active (seed-sub-member1, còn ~20 ngày). " + MUTATE,
      ["Đăng nhập member1", "POST /api/courses/paid-demo/subscription/cancel không body"], "body rỗng",
      "200 Subscription cancelAtPeriodEnd=true, canceledAt có giá trị, status=active; member1 vẫn vào /courses/paid-demo/community; không có hoàn tiền/không tạo giao dịch.")
    A("Hủy & tiếp tục gói", "Hủy ngay (atPeriodEnd=false): mất quyền tức thì",
      "Chức năng", "Cao", SEED_NOTE + " Dùng newbie đã trả phí/dùng thử để không hỏng seed. " + MUTATE,
      ["POST /api/courses/paid-demo/subscription/cancel body {\"atPeriodEnd\":false}", "Mở /courses/paid-demo/community"], "atPeriodEnd=false",
      "200 Subscription status=canceled, canceledAt có giá trị; enrolled=false; vào cộng đồng bị chặn; thông báo 'Gói thành viên đã kết thúc' body 'Gói thành viên của bạn đã được hủy và quyền truy cập đã bị thu hồi.'.")
    A("Hủy & tiếp tục gói", "Hủy khi không có gói trả 404; body sai kiểu trả 400",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie chưa có gói.",
      ["POST /api/courses/paid-demo/subscription/cancel body {} bằng newbie", "POST cùng endpoint bằng member1 body {\"atPeriodEnd\":\"khong\"}"], "-",
      "Lần 1: 404 'Bạn không có gói thành viên đang hoạt động ở cộng đồng này'. Lần 2: 400 VALIDATION_ERROR.")
    A("Hủy & tiếp tục gói", "Hủy gói không token trả 401",
      "Bảo mật", "Thấp", "-", ["POST /api/courses/paid-demo/subscription/cancel không token"], "-", "401 UNAUTHORIZED.")
    A("Hủy & tiếp tục gói", "Hộp thoại 'Hủy gói thành viên' trên /billing có 2 lựa chọn",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập member1.",
      ["Mở /billing", "Bấm 'Hủy gói'"], "-",
      "Modal 'Hủy gói thành viên' có 'Hủy vào cuối kỳ' (mô tả 'Vẫn truy cập đến <ngày>, sau đó không gia hạn.') và 'Hủy ngay' ('Mất quyền truy cập cộng đồng ngay lập tức.'); nút 'Xác nhận hủy' hiện 'Đang hủy…' khi gửi.")
    A("Hủy & tiếp tục gói", "Hủy trong thời gian dùng thử (member3 trialing) không phát sinh phí",
      "Chức năng", "Cao", SEED_NOTE + " member3 trialing (seed-sub-member3). " + MUTATE,
      ["Đăng nhập member3", "POST /api/courses/paid-demo/subscription/cancel body {\"atPeriodEnd\":true}", "GET /api/me/payments"], "-",
      "200 cancelAtPeriodEnd=true, status vẫn trialing; /me/payments không có giao dịch nào; đến hết kỳ dùng thử gói chuyển 'canceled' (scheduler), không thu tiền.")
    A("Hủy & tiếp tục gói", "Hủy ngay khi đang dùng thử: mất quyền, không thể dùng thử lại",
      "Chức năng", "Trung bình", SEED_NOTE + " member3 trialing. " + MUTATE,
      ["member3 POST cancel body {\"atPeriodEnd\":false}", "Sau đó POST /api/courses/paid-demo/trial"], "-",
      "Cancel: 200 status=canceled, quyền bị thu hồi. Trial lại: 409 'Bạn đã dùng thử cộng đồng này rồi'.")
    A("Hủy & tiếp tục gói", "Đến hạn hủy-cuối-kỳ: scheduler chuyển canceled và thu hồi quyền (member2)",
      "Tích hợp", "Cao", SEED_NOTE + " member2 hủy cuối kỳ. Sửa DB seed-sub-member2.currentPeriodEnd = now - 1 giờ. " + MUTATE,
      ["Chờ tối đa 5 phút cho scheduler", "Đăng nhập member2, mở /billing và /courses/paid-demo/community", "GET /api/me/payments"], "-",
      "Gói status=canceled, enrollment member2 bị xóa; thông báo 'Gói thành viên của bạn đã hết hạn theo yêu cầu hủy.'; KHÔNG có giao dịch gia hạn mới (chỉ còn seed-pay-member2-a).",
      pw="Không")

    # ============================================================ 5. GIA HẠN & THẤT BẠI
    A("Gia hạn tự động", "Scheduler gia hạn gói active đến hạn: tạo giao dịch renewal + hóa đơn",
      "Tích hợp", "Cao", SEED_NOTE + " member1 gói active. Sửa DB seed-sub-member1.currentPeriodEnd = now - 1 giờ. " + MUTATE,
      ["Chờ tối đa 5 phút (processDueSubscriptions)", "Đăng nhập member1, GET /api/me/payments", "GET /api/courses/paid-demo/subscription"], "kỳ gói 30 ngày (SUBSCRIPTION_PERIOD_DAYS)",
      "Có giao dịch kind=renewal status=succeeded amountCents=1900 mới với invoiceNumber; periodStart = currentPeriodEnd cũ, periodEnd = +30 ngày; gói vẫn active, quyền không gián đoạn; thông báo 'Gia hạn gói thành công' body 'Gói của bạn được gia hạn đến <yyyy-mm-dd>. Hóa đơn INV-…'.",
      pw="Không")
    A("Gia hạn tự động", "Mỗi lần chạy scheduler chỉ tiến 1 kỳ",
      "Tích hợp", "Trung bình", SEED_NOTE + " Sửa DB seed-sub-member1.currentPeriodEnd = now - 70 ngày. " + MUTATE,
      ["Chờ 1 lượt scheduler", "GET /api/me/payments bằng member1"], "-",
      "Sau 1 lượt chỉ thêm 1 renewal (kỳ mới bắt đầu từ currentPeriodEnd cũ); các kỳ trễ còn lại được xử lý ở lượt sau (mỗi lượt 1 kỳ) - ghi nhận hành vi thực tế của code.",
      pw="Không")
    A("Gia hạn tự động", "Gia hạn thất bại (thẻ từ chối): gói expired, thu hồi quyền, thông báo",
      "Tích hợp", "Cao", "Chỉ kiểm được bằng test tích hợp BE (mockGateway.failFor). Chưa làm: dunning/thử lại nhiều lần - hiện hết hạn ngay khi lần thu đầu thất bại.",
      ["Test BE: failFor(userId) rồi gọi processDueSubscriptions(now) với gói đến hạn"], "-",
      "Tạo giao dịch kind=renewal status=failed (không hóa đơn); gói status=expired; enrollment bị xóa; thông báo payment_failed 'Gia hạn thất bại' body 'Không thể trừ tiền gia hạn nên gói đã hết hiệu lực. Vui lòng đăng ký lại.'; kết quả renewalFailed=1.",
      pw="Không")
    A("Gia hạn tự động", "Thử lại thanh toán nhiều lần (dunning) khi gia hạn thất bại",
      "Chức năng", "Cao", "Chưa làm: retry nhiều lần / email nhắc cập nhật thẻ (docs/api/payments.md mục 'Chưa làm'). Hiện hết hạn ngay.",
      ["Để gia hạn thất bại lần đầu", "Quan sát trong các ngày kế tiếp"], "-",
      "Khi làm xong: hệ thống thử lại theo lịch cấu hình, chỉ khóa quyền sau X lần thất bại liên tiếp; hiện tại (chưa làm) gói expired ngay lần đầu.", pw="Không", st=PLAN)
    A("Gia hạn tự động", "Nhắc trước khi gia hạn (email/thông báo)",
      "Tích hợp", "Thấp", "Chưa làm: thông báo nhắc trước hạn và email giao dịch (hiện chỉ thông báo trong app khi gia hạn xong).",
      ["Để gói còn 3 ngày đến hạn"], "-", "Khi làm xong: nhận nhắc đúng thời điểm.", pw="Không", st=PLAN)
    A("Gia hạn tự động", "Không gia hạn gói đã hủy/expired/canceled (không thu tiền nhầm)",
      "Chức năng", "Cao", SEED_NOTE + " Gói seed-sub-refunded (thành viên minh họa #1) status=canceled, end = +10 ngày.",
      ["Chờ vài lượt scheduler", "Đếm số giao dịch của seed-sub-refunded"], "-",
      "Không phát sinh giao dịch nào cho gói canceled (scheduler chỉ chọn gói đến hạn còn active/trialing).", pw="Không")
    A("Gia hạn tự động", "Webhook subscription.renewed ghi nhận gia hạn từ cổng",
      "Tích hợp", "Trung bình", SEED_NOTE + " " + SIGN + " " + MUTATE,
      ["Gửi webhook subscription.renewed {subscriptionId:'seed-sub-member1'} đã ký", "GET /api/me/payments bằng member1"], "{\"id\":\"evt-renew-1\",\"type\":\"subscription.renewed\",\"data\":{\"subscriptionId\":\"seed-sub-member1\",\"chargeId\":\"ch_qa_1\"}}",
      "200 {received:true}; có thêm giao dịch renewal succeeded amountCents=1900, gatewayChargeId=ch_qa_1, periodStart = currentPeriodEnd cũ, có invoiceNumber; gói active.")

    # ============================================================ 6. HOÀN TIỀN
    A("Hoàn tiền", "newbie hoàn tiền trong 7 ngày: tự duyệt, giao dịch refunded, thu hồi quyền",
      "Chức năng", "Cao", SEED_NOTE + " newbie vừa checkout+confirm paid-demo (gói mới, trong cửa sổ 7 ngày). " + MUTATE,
      ["Đăng nhập newbie", "POST /api/payments/<paymentId>/refund-request body {\"reason\":\"Không phù hợp\"}", "GET /api/me/payments", "GET /api/courses/paid-demo/subscription"],
      "REFUND_WINDOW_DAYS=7, hoàn 100% (giá trị tạm)",
      "201 RefundRequest status=approved, auto=true, amountCents=1900; giao dịch status=refunded refundedCents=1900; gói status=canceled; enrolled=false; thông báo 'Hoàn tiền thành công' body 'Đã hoàn 19.00 USD cho giao dịch của bạn.'.")
    A("Hoàn tiền", "Yêu cầu hoàn tiền lần 2 cho cùng giao dịch trả 409",
      "Chức năng", "Cao", SEED_NOTE + " Giao dịch của newbie đã hoàn tiền (case trước).",
      ["POST refund-request lần 2 cho cùng paymentId"], "reason='Thử lần hai'",
      "409, message 'Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền' (giao dịch đã refunded).")
    A("Hoàn tiền", "Hoàn tiền giao dịch seed đã refunded (demo #1) trả 409",
      "Chức năng", "Thấp", SEED_NOTE + " seed-pay-refunded thuộc thành viên minh họa #1 (không đăng nhập được) - chỉ kiểm được vai trò khác.",
      ["Đăng nhập member1", "POST /api/payments/seed-pay-refunded/refund-request body {\"reason\":\"abc\"}"], "-",
      "403 FORBIDDEN vì không phải chủ giao dịch (kiểm tra chủ đi trước trạng thái).")
    A("Hoàn tiền", "Ngoài cửa sổ 7 ngày: member1 yêu cầu hoàn -> pending, chờ Platform Admin",
      "Chức năng", "Cao", SEED_NOTE + " seed-pay-member1-b (renewal 10 ngày trước) thuộc gói có lần thanh toán đầu 40 ngày trước. " + MUTATE,
      ["Đăng nhập member1", "POST /api/payments/seed-pay-member1-b/refund-request body {\"reason\":\"Xin hoàn tiền kỳ gia hạn\"}", "GET /api/me/payments"], "reason 22 ký tự",
      "201 RefundRequest status=pending, auto=false, amountCents=1900; giao dịch vẫn succeeded, gói vẫn active, member1 còn quyền truy cập (mốc cửa sổ tính từ LẦN THANH TOÁN ĐẦU của gói, không phải kỳ gia hạn).")
    A("Hoàn tiền", "member2 (thanh toán 15 ngày trước) yêu cầu hoàn -> pending",
      "Chức năng", "Trung bình", SEED_NOTE + " seed-pay-member2-a confirmedAt = 15 ngày trước. " + MUTATE,
      ["Đăng nhập member2", "POST /api/payments/seed-pay-member2-a/refund-request body {\"reason\":\"Hết nhu cầu\"}"], "-",
      "201 status=pending, auto=false (quá 7 ngày).")
    A("Hoàn tiền", "Validate lý do hoàn tiền: dưới 3 ký tự và quá 500 ký tự bị 400",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie có giao dịch succeeded chưa hoàn.",
      ["POST refund-request body {\"reason\":\"ab\"}", "POST refund-request body {\"reason\":\"<501 ký tự 'a'>\"}", "POST body {\"reason\":\"   \"}", "POST body {}"], "reason='ab' / 501 ký tự / khoảng trắng / thiếu",
      "Cả 4 lần: 400 VALIDATION_ERROR; lần đầu có thông điệp 'Vui lòng nhập lý do (tối thiểu 3 ký tự)'; giao dịch không đổi.")
    A("Hoàn tiền", "Lý do hoàn tiền đúng biên 3 ký tự và 500 ký tự được chấp nhận",
      "Chức năng", "Thấp", SEED_NOTE + " Hai giao dịch succeeded khác nhau trong cửa sổ (tài khoản mới đăng ký).",
      ["Yêu cầu hoàn giao dịch 1 với reason 'abc'", "Yêu cầu hoàn giao dịch 2 với reason 500 ký tự (kể cả tiếng Việt có dấu)"], "3 ký tự; 500 ký tự",
      "Cả hai 201 (trong cửa sổ -> approved auto).")
    A("Hoàn tiền", "Hoàn tiền giao dịch của người khác bị 403 (IDOR)",
      "Bảo mật", "Cao", SEED_NOTE + " member1 sở hữu seed-pay-member1-a.",
      ["Đăng nhập member2", "POST /api/payments/seed-pay-member1-a/refund-request body {\"reason\":\"thử IDOR\"}"], "-",
      "403 FORBIDDEN; không tạo RefundRequest.")
    A("Hoàn tiền", "Hoàn tiền giao dịch chưa thanh toán (pending) bị 409",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie có giao dịch pending (chưa confirm).",
      ["POST /api/payments/<pendingId>/refund-request body {\"reason\":\"thử\"}"], "-",
      "409, message 'Chỉ giao dịch đã thanh toán thành công mới được hoàn tiền'.")
    A("Hoàn tiền", "Hai yêu cầu hoàn tiền song song chỉ tạo một",
      "Chức năng", "Trung bình", SEED_NOTE + " Giao dịch ngoài cửa sổ (seed-pay-member1-b) để yêu cầu thành pending. " + MUTATE,
      ["Member1 gửi đồng thời 2 POST refund-request cho seed-pay-member1-b"], "2 request song song",
      "Một request 201, request còn lại 409 'Giao dịch này đã có yêu cầu hoàn tiền'; /admin/refunds chỉ có 1 yêu cầu mới.", pw="Một phần")
    A("Hoàn tiền", "Danh sách /admin/refunds?status=pending chứa yêu cầu seed của demo #2",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập admin@sofinhub.test (Platform Admin).",
      ["GET /api/admin/refunds?status=pending"], "-",
      "200 {data,meta}: có seed-refund-pending (paymentId=seed-pay-pendref, userId=demo-paid-demo-2, amountCents=1900, reason 'Xin hoàn tiền sau 12 ngày — ngoài cửa sổ 7 ngày (seed)', auto=false).")
    A("Hoàn tiền", "Danh sách /admin/refunds?status=approved chứa bản ghi tự duyệt demo #1",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập admin.",
      ["GET /api/admin/refunds?status=approved"], "-",
      "Có seed-refund-approved (paymentId=seed-pay-refunded, auto=true, amountCents=1900, reason 'Không phù hợp nhu cầu (seed)').")
    A("Hoàn tiền", "Platform Admin duyệt yêu cầu pending của demo #2",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập admin. " + MUTATE,
      ["PATCH /api/admin/refunds/seed-refund-pending body {\"action\":\"approve\",\"note\":\"OK\"}", "GET /api/courses/paid-demo/revenue bằng owner"], "note='OK'",
      "200 RefundRequest status=approved, resolvedBy=id admin, note='OK'; seed-pay-pendref thành refunded (refundedCents=1900); seed-sub-pendref chuyển canceled (kỳ hiện tại); doanh thu owner: refundsCents +1900, hoa hồng của giao dịch đó về 0 (xem case doanh thu).")
    A("Hoàn tiền", "Platform Admin từ chối yêu cầu hoàn tiền kèm ghi chú",
      "Chức năng", "Cao", SEED_NOTE + " seed-refund-pending còn pending (DB sạch). " + MUTATE,
      ["PATCH /api/admin/refunds/seed-refund-pending body {\"action\":\"reject\",\"note\":\"Quá thời hạn\"}", "GET /api/admin/refunds?status=rejected"], "note='Quá thời hạn'",
      "200 status=rejected, resolvedBy=admin; giao dịch seed-pay-pendref vẫn succeeded, gói vẫn active; người mua nhận thông báo 'Yêu cầu hoàn tiền bị từ chối' body 'Lý do: Quá thời hạn'.")
    A("Hoàn tiền", "Xử lý lại yêu cầu đã xử lý trả 409",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập admin.",
      ["PATCH /api/admin/refunds/seed-refund-approved body {\"action\":\"approve\"}"], "-", "409 CONFLICT, message 'Yêu cầu này đã được xử lý'.")
    A("Hoàn tiền", "PATCH refund với action sai hoặc id không tồn tại",
      "Chức năng", "Thấp", SEED_NOTE + " Đăng nhập admin.",
      ["PATCH /api/admin/refunds/seed-refund-pending body {\"action\":\"xoa\"}", "PATCH /api/admin/refunds/khong-co body {\"action\":\"approve\"}"], "-",
      "Lần 1: 400 VALIDATION_ERROR. Lần 2: 404 'Không tìm thấy yêu cầu hoàn tiền'.")
    for who, mail in (("owner", "owner@sofinhub.test"), ("cadmin", "cadmin@sofinhub.test"), ("member1", "member1@sofinhub.test")):
        A("Hoàn tiền", f"{who} (không phải Platform Admin) gọi các API /admin/refunds bị 403",
          "Bảo mật", "Cao", SEED_NOTE + f" Đăng nhập {mail}.",
          ["GET /api/admin/refunds", "PATCH /api/admin/refunds/seed-refund-pending body {\"action\":\"approve\"}"], "-",
          "Cả hai 403 FORBIDDEN; seed-refund-pending vẫn pending. (Owner cộng đồng KHÔNG có quyền duyệt hoàn tiền - chỉ Platform Admin.)")
    A("Hoàn tiền", "Guest gọi /admin/refunds trả 401",
      "Bảo mật", "Trung bình", "Guest.", ["GET /api/admin/refunds không token"], "-", "401 UNAUTHORIZED.")
    A("Hoàn tiền", "Lọc và phân trang /admin/refunds: status sai và limit vượt 100",
      "Chức năng", "Thấp", SEED_NOTE + " Đăng nhập admin.",
      ["GET /api/admin/refunds?status=abc", "GET /api/admin/refunds?limit=101", "GET /api/admin/refunds?page=0", "GET /api/admin/refunds?page=1&limit=1"], "-",
      "3 lần đầu 400 VALIDATION_ERROR; lần 4 200 với meta {page:1,limit:1,total>=2,totalPages>=2}.")
    A("Hoàn tiền", "Hoàn tiền một phần (partial refund)",
      "Chức năng", "Trung bình", "Chưa làm: chỉ hoàn 100% (docs/api/payments.md 'Giới hạn hiện tại').", ["Yêu cầu hoàn một phần số tiền"], "-",
      "Khi làm xong: cho nhập số tiền hoàn <= số đã trả; hiện tại luôn hoàn đủ 1900.", pw="Không", st=PLAN)
    A("Hoàn tiền", "Trang Quản trị -> tab Hoàn tiền: lọc, duyệt, từ chối trên UI",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập admin. " + MUTATE,
      ["Mở /admin, tab Hoàn tiền", "Lọc 'Chờ duyệt'", "Bấm 'Duyệt hoàn tiền' trên yêu cầu của demo #2 (nhập ghi chú tùy chọn)", "Bấm lần nữa/tải lại và thử xử lý lại"], "-",
      "Bộ lọc Chờ duyệt/Đã duyệt/Từ chối/Tất cả; sau duyệt yêu cầu biến khỏi 'Chờ duyệt'; thử xử lý lại hiển thị lỗi 409 'Yêu cầu này đã được xử lý' trong hộp thoại.")
    A("Hoàn tiền", "Tài khoản thường mở /admin thấy thông báo không có quyền",
      "Bảo mật", "Trung bình", SEED_NOTE + " Đăng nhập member1.",
      ["Mở /admin"], "-", "Hiển thị 'Bạn không có quyền truy cập khu vực quản trị.'; menu avatar không có mục Quản trị.")

    # ============================================================ 7. HÓA ĐƠN & LỊCH SỬ
    A("Hóa đơn", "Số hóa đơn có định dạng INV-YYYY-nnnnnn và duy nhất",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập admin (cần xem hóa đơn mọi giao dịch) hoặc owner.",
      ["Lấy invoice của seed-pay-member1-a, seed-pay-member1-b, seed-pay-member2-a: GET /api/payments/<id>/invoice", "So sánh invoiceNumber"], "3 giao dịch seed",
      "Mỗi invoiceNumber khớp /^INV-\\d{4}-\\d{6}$/ (năm = năm của confirmedAt), đôi một khác nhau; số cấp tuần tự theo thứ tự thời gian confirmedAt (seed cấp cho giao dịch cũ nhất số nhỏ nhất).")
    A("Hóa đơn", "member1 xem hóa đơn của chính mình: đúng nội dung",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập member1.",
      ["GET /api/payments/seed-pay-member1-a/invoice"], "-",
      "200: invoiceNumber, issuedAt = confirmedAt (40 ngày trước), status=succeeded, buyer.email=member1@sofinhub.test, community {id:paid-demo, title:'Cộng đồng có phí (demo)'}, items 1 dòng (quantity 1, unitCents=1900, amountCents=1900, mô tả 'Gói thành viên \"…\" (yyyy-mm-dd – yyyy-mm-dd)'), subtotalCents=1900, refundedCents=0, totalCents=1900.")
    A("Hóa đơn", "Hóa đơn giao dịch đã hoàn tiền thể hiện refundedCents",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập owner (chủ cộng đồng được xem).",
      ["GET /api/payments/seed-pay-refunded/invoice"], "-",
      "200 status=refunded, refundedCents=1900, subtotalCents=1900, totalCents=1900 (code giữ total = số đã tính, không trừ hoàn tiền - ghi nhận hành vi thực tế; chưa chốt).")
    A("Hóa đơn", "Owner cộng đồng và Platform Admin xem được hóa đơn của thành viên",
      "Chức năng", "Cao", SEED_NOTE, ["Đăng nhập owner, GET /api/payments/seed-pay-member1-a/invoice", "Đăng nhập admin, gọi lại"], "-", "Cả hai 200 cùng nội dung hóa đơn.")
    A("Hóa đơn", "IDOR: member2 xem hóa đơn của member1 bị 403",
      "Bảo mật", "Cao", SEED_NOTE + " Đăng nhập member2.", ["GET /api/payments/seed-pay-member1-a/invoice"], "-", "403 FORBIDDEN, không lộ nội dung hóa đơn.")
    A("Hóa đơn", "cadmin/mod không phải Owner không xem được hóa đơn người khác",
      "Bảo mật", "Trung bình", SEED_NOTE + " Đăng nhập cadmin (admin photo) rồi mod.", ["GET /api/payments/seed-pay-member1-a/invoice"], "-", "403 cho cả hai (chỉ chủ giao dịch, Owner cộng đồng đó, Platform Admin).")
    A("Hóa đơn", "Hóa đơn: guest 401, giao dịch không tồn tại 404, giao dịch pending 409",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie có giao dịch pending P.",
      ["GET /api/payments/seed-pay-member1-a/invoice không token", "GET /api/payments/khong-co/invoice bằng member1", "GET /api/payments/<P>/invoice bằng newbie"], "-",
      "401 UNAUTHORIZED; 404 'Không tìm thấy giao dịch'; 409 'Giao dịch này chưa có hóa đơn'.")
    A("Hóa đơn", "Lịch sử /me/payments của member1 có 2 giao dịch seed, sắp xếp mới nhất trước",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập member1 (chưa thực hiện giao dịch mới).",
      ["GET /api/me/payments"], "-",
      "200 {data,meta}: meta.total=2; gồm seed-pay-member1-b (renewal, 10 ngày trước) rồi seed-pay-member1-a (initial, 40 ngày trước); mỗi dòng có courseTitle='Cộng đồng có phí (demo)', amountCents=1900, invoiceNumber.")
    A("Hóa đơn", "Phân trang /me/payments: limit, page và tham số sai",
      "Chức năng", "Thấp", SEED_NOTE + " Đăng nhập member1.",
      ["GET /api/me/payments?page=1&limit=1", "GET /api/me/payments?page=2&limit=1", "GET /api/me/payments?limit=101", "GET /api/me/payments?page=0"], "-",
      "Lần 1: 1 dòng, meta.totalPages=2. Lần 2: dòng thứ hai. Lần 3 và 4: 400 VALIDATION_ERROR.")
    A("Hóa đơn", "Lịch sử của tài khoản không có giao dịch: rỗng",
      "Chức năng", "Thấp", SEED_NOTE + " Đăng nhập banned hoặc tài khoản mới đăng ký.",
      ["GET /api/me/payments"], "-", "200 data=[] và meta.total=0, totalPages=1. UI /billing hiển thị 'Chưa có giao dịch nào.'.")
    A("Hóa đơn", "Trang /billing: Gói của tôi và Lịch sử thanh toán của member1",
      "Giao diện", "Cao", SEED_NOTE + " Đăng nhập member1.",
      ["Mở /billing (menu avatar -> 'Gói & thanh toán')"], "-",
      "Có gói paid-demo trạng thái 'Đang hoạt động', ngày truy cập đến ~ +20 ngày; bảng lịch sử 2 dòng (phân trang 10 dòng/trang), mỗi dòng có nút 'Hóa đơn' và 'Hoàn tiền'; số tiền hiển thị $19.00.")
    A("Hóa đơn", "Hộp thoại hóa đơn và nút 'In hóa đơn'",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập member1.",
      ["Mở /billing, bấm 'Hóa đơn' ở seed-pay-member1-a", "Bấm 'In hóa đơn' (Ctrl+P xem trước)"], "-",
      "Hộp thoại hiện số INV-…, người mua, mục hàng, tổng $19.00; bản in chỉ có phần hóa đơn (ẩn header/menu). Giao dịch chưa có hóa đơn (pending) không có nút 'Hóa đơn'. PDF hóa đơn chưa làm.",
      pw="Một phần")
    A("Hóa đơn", "Xuất PDF hóa đơn / thuế VAT / thông tin pháp lý người bán",
      "Chức năng", "Thấp", "Chưa làm: PDF hóa đơn, VAT, thông tin pháp lý (docs/api/payments.md 'Chưa làm').", ["Mở hóa đơn, tìm nút tải PDF"], "-",
      "Khi làm xong: tải được PDF đúng số hóa đơn, có dòng thuế/thông tin người bán.", pw="Không", st=PLAN)
    A("Hóa đơn", "Email hóa đơn gửi cho thành viên sau khi thanh toán",
      "Tích hợp", "Trung bình", "Chưa làm: email giao dịch thật (hiện chỉ thông báo trong app 'Thanh toán thành công').", ["Thanh toán thành công", "Kiểm tra hộp thư"], "-",
      "Khi làm xong: nhận email có số hóa đơn và số tiền.", pw="Không", st=PLAN)

    # ============================================================ 8. WEBHOOK
    A("Webhook", "Webhook payment.succeeded hợp lệ khi chưa redirect: cấp quyền, hóa đơn",
      "Tích hợp", "Cao", SEED_NOTE + " newbie có giao dịch pending P (đã checkout, CHƯA confirm - mô phỏng webhook đến trước redirect). " + SIGN + " " + MUTATE,
      ["POST /api/payments/webhook (không token) với event ký hợp lệ", "GET /api/courses/paid-demo/subscription bằng newbie"], "{\"id\":\"evt-qa-1\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"<P>\",\"chargeId\":\"ch_qa_1\"}}",
      "200 {received:true}; giao dịch succeeded (gatewayChargeId=ch_qa_1, có invoiceNumber), gói active, newbie enrolled=true. Sau đó newbie mở lại confirm -> 200 trả bản ghi cũ, không tạo hóa đơn thứ hai.")
    A("Webhook", "Webhook trùng event id: 200 duplicate, không tác dụng phụ",
      "Bảo mật", "Cao", SEED_NOTE + " Đã gửi thành công event evt-qa-1 (case trước). " + SIGN,
      ["Gửi lại đúng body/event id evt-qa-1 (ký lại với timestamp mới)", "Đếm giao dịch/hóa đơn của newbie"], "id=evt-qa-1",
      "200 {received:true, duplicate:true}; không thêm giao dịch/hóa đơn/thông báo.")
    A("Webhook", "Webhook không có header chữ ký bị 400",
      "Bảo mật", "Cao", SEED_NOTE, ["POST /api/payments/webhook body JSON hợp lệ, không gửi x-sofin-signature"], "{\"id\":\"evt-x\",\"type\":\"payment.succeeded\",\"data\":{}}",
      "400 BAD_REQUEST, message 'Yêu cầu không hợp lệ' (không nêu chi tiết). Không đổi dữ liệu.")
    A("Webhook", "Webhook chữ ký sai (secret khác) bị 400",
      "Bảo mật", "Cao", SEED_NOTE + " newbie có giao dịch pending P.", ["Ký payload bằng secret 'sai-secret' rồi POST /api/payments/webhook"], "payment.succeeded {paymentId:<P>}",
      "400 'Yêu cầu không hợp lệ'; P vẫn pending, không cấp quyền.")
    A("Webhook", "Sửa body sau khi ký bị 400",
      "Bảo mật", "Cao", SEED_NOTE + " " + SIGN, ["Ký body có paymentId=<P>", "Đổi paymentId khác trong body nhưng giữ nguyên header"], "-", "400 'Yêu cầu không hợp lệ' (HMAC tính trên raw body).")
    A("Webhook", "Chống replay: timestamp cũ hơn 300 giây bị 400",
      "Bảo mật", "Cao", SEED_NOTE + " " + SIGN, ["Ký payload đúng secret nhưng t = hiện tại - 301 giây", "POST webhook"], "t lệch -301s",
      "400 'Yêu cầu không hợp lệ'.")
    A("Webhook", "Timestamp ở tương lai quá 300 giây cũng bị 400; biên 299 giây được chấp nhận",
      "Bảo mật", "Trung bình", SEED_NOTE + " " + SIGN, ["Gửi event với t = hiện tại + 301 giây", "Gửi event khác với t = hiện tại - 299 giây (đúng secret)"], "-",
      "Lần 1: 400. Lần 2: 200 {received:true,...}.")
    A("Webhook", "Header chữ ký sai định dạng (thiếu v1, v1 không hex, t không phải số)",
      "Bảo mật", "Trung bình", SEED_NOTE, ["Gửi header 't=123'", "Gửi header 't=<now>,v1=zzzz'", "Gửi header 't=abc,v1=abcd'", "Gửi header chuỗi rỗng"], "-", "Cả 4 lần: 400 'Yêu cầu không hợp lệ', không lỗi 500.")
    A("Webhook", "Chữ ký hợp lệ nhưng body không phải JSON hoặc thiếu id",
      "Chức năng", "Trung bình", SEED_NOTE + " " + SIGN, ["Ký và gửi body 'khong-phai-json' với Content-Type application/json", "Ký và gửi body {\"type\":\"payment.succeeded\"} (thiếu id)"], "-",
      "Lần 1: 400 (BAD_REQUEST 'Nội dung gửi lên không phải JSON hợp lệ' nếu bị express.json chặn ở tầng parse, hoặc 'Yêu cầu không hợp lệ'; không còn 500). Lần 2: 400 VALIDATION_ERROR.")
    A("Webhook", "Loại sự kiện lạ hoặc đối tượng không tồn tại: 200 ignored",
      "Chức năng", "Trung bình", SEED_NOTE + " " + SIGN, ["Gửi event type 'invoice.finalized'", "Gửi payment.succeeded với paymentId 'khong-co'"], "-",
      "Cả hai 200 {received:true, ignored:true} (để cổng khỏi retry vô hạn); không đổi dữ liệu.")
    A("Webhook", "Webhook payment.failed rồi payment.succeeded cho giao dịch đã failed",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie có giao dịch pending P. " + SIGN,
      ["Gửi payment.failed {paymentId:<P>, reason:'card_declined'}", "Gửi payment.succeeded {paymentId:<P>} (event id khác)"], "-",
      "Event 1: P -> failed + thông báo 'Thanh toán thất bại'. Event 2: 200 nhưng P vẫn failed, không cấp quyền (chỉ giao dịch pending mới được settle) - hành vi thực tế.")
    A("Webhook", "Webhook payment.refunded cho giao dịch succeeded: hoàn tiền tự động, không gọi lại cổng",
      "Chức năng", "Trung bình", SEED_NOTE + " newbie có giao dịch succeeded. " + SIGN + " " + MUTATE,
      ["Gửi payment.refunded {paymentId:<id>}", "GET /api/me/payments bằng newbie"], "-",
      "200; giao dịch refunded refundedCents=1900; có RefundRequest reason 'Hoàn tiền từ cổng thanh toán' auto=true status=approved; gói canceled, quyền bị thu hồi.")
    A("Webhook", "Webhook subscription.canceled kết thúc gói active",
      "Chức năng", "Trung bình", SEED_NOTE + " " + SIGN + " " + MUTATE, ["Gửi subscription.canceled {subscriptionId:'seed-sub-member1'}"], "-",
      "200; gói status=canceled, quyền member1 bị thu hồi; thông báo 'Gói thành viên của bạn đã bị hủy bởi cổng thanh toán.'.")
    A("Webhook", "Hai webhook cùng event id gửi song song: đúng một bên xử lý",
      "Bảo mật", "Cao", SEED_NOTE + " newbie có giao dịch pending P. " + SIGN, ["Gửi đồng thời 5 request webhook cùng event id evt-par-1"], "-",
      "Có đúng một response {received:true}, các response còn lại {received:true,duplicate:true}; chỉ 1 hóa đơn.", pw="Một phần")
    A("Webhook", "Webhook nhận không cần đăng nhập nhưng không bị giới hạn bởi CSRF/token người dùng",
      "Bảo mật", "Thấp", SEED_NOTE, ["Gửi webhook hợp lệ không kèm Authorization", "Gửi kèm token member1 nhưng chữ ký sai"], "-",
      "Lần 1: 200 (không yêu cầu 401). Lần 2: vẫn 400 - token người dùng không thay thế được chữ ký.")
    A("Webhook", "Cổng thanh toán thật (Stripe/PayOS/VNPay/MoMo): xác thực chữ ký và map sự kiện",
      "Tích hợp", "Cao", "Chưa làm: chỉ có MockGateway; StripeGateway/PayOSGateway chưa hiện thực (docs/api/payments.md 'Viết StripeGateway').", ["Cấu hình cổng thật (sandbox)", "Thanh toán thẻ test", "Quan sát webhook thật"], "Thẻ test của cổng",
      "Khi làm xong: chữ ký cổng thật được xác thực, sự kiện map sang 5 loại nội bộ, quyền cấp qua webhook.", pw="Không", st=PLAN)

    # ============================================================ 9. GÓI CỦA TÔI
    A("Gói của tôi", "GET /me/subscriptions của member1: 1 gói active có courseTitle và accessUntil",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập member1.", ["GET /api/me/subscriptions"], "-",
      "200 data gồm seed-sub-member1: status=active, priceCents=1900, courseTitle='Cộng đồng có phí (demo)', accessUntil = currentPeriodEnd (~ +20 ngày).")
    A("Gói của tôi", "member3: gói trialing có accessUntil ~ +4 ngày",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập member3.", ["GET /api/me/subscriptions"], "-", "seed-sub-member3 status=trialing, trialEndsAt ~ +4 ngày, accessUntil = currentPeriodEnd.")
    A("Gói của tôi", "Gói đã hủy/hết hạn có accessUntil = null",
      "Chức năng", "Trung bình", SEED_NOTE + " Sau khi member3 hủy ngay hoặc hết dùng thử.", ["GET /api/me/subscriptions"], "-",
      "Gói status=canceled/expired có accessUntil=null (chỉ active/trialing có ngày truy cập).", pw="Một phần")
    A("Gói của tôi", "Tài khoản không có gói trả mảng rỗng; guest 401",
      "Chức năng", "Thấp", "-", ["GET /api/me/subscriptions bằng banned@sofinhub.test", "GET /api/me/subscriptions không token"], "-", "200 data=[]; 401 UNAUTHORIZED. UI /billing hiện trạng thái rỗng cho phần Gói của tôi.")
    A("Gói của tôi", "GET /courses/paid-demo/subscription trả cấu trúc enrolled/latestPayment/subscription",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập member1 rồi newbie.", ["GET /api/courses/paid-demo/subscription"], "-",
      "member1: enrolled=true, latestPayment = seed-pay-member1-b, subscription seed-sub-member1. newbie: enrolled=false, latestPayment=null, subscription=null.")
    A("Gói của tôi", "Nhãn trạng thái gói trên /billing khớp từng loại",
      "Giao diện", "Trung bình", SEED_NOTE + " Lần lượt đăng nhập member1, member2, member3.", ["Mở /billing với từng tài khoản"], "-",
      "member1 'Đang hoạt động'; member2 'Đã hủy' (còn truy cập đến hết kỳ) + nút 'Tiếp tục gói'; member3 'Đang dùng thử'. Gói expired hiện 'Đã hết hạn'.")
    A("Gói của tôi", "Thành viên tham gia nhiều cộng đồng trả phí: mỗi gói độc lập",
      "Chức năng", "Trung bình", "Cần thêm ít nhất 1 cộng đồng có phí thứ hai (paid-demo là cộng đồng có phí duy nhất của seed; yt/fin/photo chưa chắc có phí) - Owner tạo cộng đồng có phí mới.",
      ["Mua paid-demo và cộng đồng có phí thứ hai bằng cùng tài khoản", "GET /api/me/subscriptions"], "-", "Hai gói riêng biệt, giá và kỳ độc lập; hủy gói này không ảnh hưởng gói kia.", pw="Một phần")

    # ============================================================ 10. DOANH THU (SEED)
    REV = ("Số liệu seed (DB sạch, giá 1900): 29 giao dịch succeeded/refunded = member1 2 + member2 1 + demo#1 refunded 1 + demo#2 1 + lịch sử demo#3..#10 (2,2,3,3,3,3,4,4 = 24 giao dịch); "
           "2 payout: seed-payout-paid 5000 (paid) + seed-payout-pending 5000 (requested). Công thức: hoa hồng = round((amount-refunded)x10%); phí cổng = round(amount x 2.9%)+30 = 55+30 = 85 cent/giao dịch (1900x2.9%=55.1 làm tròn 55).")
    A("Doanh thu Owner", "Owner xem doanh thu toàn thời gian: tổng thu (gross)",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Đăng nhập owner, không truyền from/to.", ["GET /api/courses/paid-demo/revenue"], "-",
      "200 data.grossCents = 55100 (29 x 1900), refundsCents = 1900 (chỉ seed-pay-refunded). currency='usd'.")
    A("Doanh thu Owner", "Hoa hồng nền tảng 10% tính trên phần giữ lại",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Đăng nhập owner.", ["GET /api/courses/paid-demo/revenue"], "PLATFORM_COMMISSION_PCT=10 (giá trị tạm)",
      "platformCommissionCents = 5320 (28 giao dịch x 190; giao dịch đã hoàn 1900 có phần giữ lại = 0 nên hoa hồng 0). assumptions.platformCommissionPct=10.")
    A("Doanh thu Owner", "Phí cổng thanh toán 2.9% + 30 cent không được hoàn khi hoàn tiền",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Đăng nhập owner.", ["GET /api/courses/paid-demo/revenue"], "GATEWAY_FEE_PCT=2.9, GATEWAY_FEE_FIXED_CENTS=30 (mô phỏng, tạm)",
      "gatewayFeeCents = 2465 (29 giao dịch x 85, gồm cả giao dịch đã hoàn). assumptions.gatewayFeePct=2.9, gatewayFeeFixedCents=30.")
    A("Doanh thu Owner", "Net = gross - hoàn - hoa hồng - phí cổng",
      "Chức năng", "Cao", SEED_NOTE + " " + REV, ["Đăng nhập owner, GET /api/courses/paid-demo/revenue", "Tự tính: 55100 - 1900 - 5320 - 2465"], "-",
      "netCents = 45415 (= $454.15). Kiểm tra đẳng thức net = gross - refunds - commission - fee trên chính response.")
    A("Doanh thu Owner", "Số dư khả dụng và số tiền đã yêu cầu rút",
      "Chức năng", "Cao", SEED_NOTE + " " + REV, ["Đăng nhập owner, GET /api/courses/paid-demo/revenue"], "-",
      "payoutRequestedCents = 10000 (payout paid 5000 + requested 5000; rejected không tính); availableBalanceCents = 45415 - 10000 = 35415 (= $354.15).")
    A("Doanh thu Owner", "MRR, thành viên trả phí và dùng thử",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Gói active: member1, member2, demo#2, demo#3..#10 (11 gói); gói cancelAtPeriodEnd: member2 và demo#10; member3 trialing; demo#1 canceled.", ["GET /api/courses/paid-demo/revenue bằng owner"], "-",
      "activePaidMembers = 11; trialingMembers = 1; mrrCents = 17100 (9 gói active không hủy-cuối-kỳ x 1900 = $171.00).")
    A("Doanh thu Owner", "recentTransactions: tối đa 20 dòng mới nhất, đúng trường",
      "Chức năng", "Trung bình", SEED_NOTE + " " + REV, ["GET /api/courses/paid-demo/revenue bằng owner", "Đếm phần tử recentTransactions"], "-",
      "recentTransactions.length = 20 (tổng 29 giao dịch); sắp xếp mới nhất trước; mỗi dòng có id, userId, kind, status, amountCents, refundedCents, invoiceNumber, confirmedAt.")
    A("Doanh thu Owner", "Lọc from/to: khoảng tương lai cho số 0 nhưng số dư vẫn toàn thời gian",
      "Chức năng", "Trung bình", SEED_NOTE + " " + REV, ["GET /api/courses/paid-demo/revenue?from=2099-01-01&to=2099-12-31 bằng owner"], "from/to tương lai",
      "grossCents=0, refundsCents=0, commission=0, fee=0, netCents=0; availableBalanceCents vẫn = 35415 và mrrCents vẫn = 17100 (không phụ thuộc bộ lọc); range.from/to phản ánh giá trị truyền vào.")
    A("Doanh thu Owner", "Lọc from/to theo ngày: to tính hết ngày (YYYY-MM-DD)",
      "Chức năng", "Trung bình", SEED_NOTE + " Giao dịch seed-pay-member1-b confirmedAt = 10 ngày trước.", ["Tính ngày D = ngày của 10 ngày trước (UTC)", "GET /api/courses/paid-demo/revenue?from=D&to=D bằng owner"], "from=to=D",
      "grossCents chỉ gồm các giao dịch trong ngày D (ít nhất seed-pay-member1-b: >= 1900); to=D bao gồm cả các giao dịch cuối ngày (23:59:59.999) nhờ cộng hết ngày.", pw="Một phần")
    A("Doanh thu Owner", "Tham số from/to sai định dạng bị 400",
      "Chức năng", "Thấp", SEED_NOTE, ["GET /api/courses/paid-demo/revenue?from=hom-qua bằng owner", "GET ...?to=2026-13-45"], "-", "Cả hai 400 VALIDATION_ERROR.")
    A("Doanh thu Owner", "Hoàn tiền của demo #2 làm giảm doanh thu đúng công thức",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Admin duyệt seed-refund-pending. " + MUTATE,
      ["Admin PATCH /api/admin/refunds/seed-refund-pending {action:'approve'}", "Owner GET /api/courses/paid-demo/revenue"], "-",
      "refundsCents 1900 -> 3800; platformCommissionCents 5320 -> 5130 (-190); gatewayFeeCents vẫn 2465; netCents 45415 -> 43705 (= 55100 - 3800 - 5130 - 2465); activePaidMembers 11 -> 10; mrrCents 17100 -> 15200.")
    A("Doanh thu Owner", "Doanh thu tăng khi có thanh toán mới (newbie)",
      "Chức năng", "Trung bình", SEED_NOTE + " " + REV + " " + MUTATE, ["Newbie checkout + confirm paid-demo", "Owner GET /api/courses/paid-demo/revenue"], "-",
      "grossCents 55100 -> 57000; commission +190; fee +85; net +1625 (1900-190-85); mrrCents +1900; activePaidMembers +1; recentTransactions[0] là giao dịch mới.")
    A("Doanh thu Owner", "Dashboard /courses/paid-demo/revenue-dashboard hiển thị thẻ số liệu khớp API",
      "Giao diện", "Cao", SEED_NOTE + " " + REV + " Đăng nhập owner.", ["Mở /courses/paid-demo/revenue-dashboard (hoặc menu avatar trong cộng đồng -> 'Doanh thu & rút tiền')"], "-",
      "Thẻ: Tổng thu (gross) $551.00, hoàn tiền $19.00, Hoa hồng nền tảng* $53.20 (tạm tính 10%), Phí cổng thanh toán* $24.65 (2.9% + $0.30), Net $454.15, Số dư khả dụng $354.15 (toàn thời gian), MRR $171.00 (11 thành viên trả phí · 1 dùng thử); ghi chú giá trị tạm; bảng 20 giao dịch.")
    A("Doanh thu Owner", "Bộ lọc Từ ngày/Đến ngày trên dashboard",
      "Giao diện", "Thấp", SEED_NOTE + " Đăng nhập owner.", ["Mở dashboard, chọn Từ ngày = ngày mai, Đến ngày = 1 năm sau"], "-",
      "Các thẻ gross/net về $0.00, thẻ 'Số dư khả dụng' và 'MRR' không đổi; bảng giao dịch vẫn hiển thị 20 dòng gần nhất (không phụ thuộc bộ lọc) - hành vi thực tế của code, kiểm tra kỹ.", pw="Một phần")
    A("Doanh thu Owner", "Cộng đồng chưa có doanh thu: tất cả số liệu 0, bảng rỗng",
      "Giao diện", "Trung bình", SEED_NOTE + " Owner mở dashboard của photo (miễn phí, không giao dịch).", ["GET /api/courses/photo/revenue bằng owner", "Mở /courses/photo/revenue-dashboard"], "-",
      "API 200: mọi *Cents=0, activePaidMembers=0, recentTransactions=[]. UI: 'Chưa có giao dịch.' và 'Chưa có lệnh rút tiền nào.'.")
    A("Doanh thu Owner", "Trang doanh thu không thuộc Owner hiển thị thông báo 403",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập member1.", ["Mở /courses/paid-demo/revenue-dashboard"], "-",
      "Hiển thị 'Chỉ chủ cộng đồng (hoặc quản trị viên nền tảng) mới xem được doanh thu.' (không rò số liệu).")
    A("Doanh thu Owner", "Doanh thu hiển thị bằng USD, định dạng $x,xxx.xx",
      "Giao diện", "Thấp", SEED_NOTE + " Đăng nhập owner.", ["Mở dashboard doanh thu", "Xem các thẻ và bảng giao dịch"], "-",
      "Mọi số tiền dạng $551.00 (ký hiệu $, 2 chữ số thập phân, dấu phẩy nghìn); nút thanh toán 'Thanh toán $19/tháng'. Không có VNĐ (đa tiền tệ VNĐ/USD theo cổng chưa làm).", pw="Một phần")
    A("Doanh thu Owner", "Đa tiền tệ VNĐ theo cổng nội địa",
      "Giao diện", "Thấp", "Chưa làm: mọi giá và giao dịch hiện chỉ USD (currency='usd'), kể cả khi chọn VNPay/MoMo.", ["Chọn VNPay ở checkout"], "-",
      "Khi làm xong: hiển thị VNĐ cho cổng nội địa, USD cho Stripe.", pw="Không", st=PLAN)

    # ============================================================ 11. RÚT TIỀN
    BANK = "{\"type\":\"bank\",\"bankName\":\"Vietcombank\",\"accountNumber\":\"0123456789\",\"accountHolder\":\"OLIVIA OWNER\"}"
    A("Rút tiền", "Owner yêu cầu rút tiền hợp lệ: số TK bị che ****6789",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Số dư khả dụng 35415. " + MUTATE,
      ["Đăng nhập owner", "POST /api/courses/paid-demo/payouts với body {amountCents:10000, method:<BANK>}"], "amountCents=10000 ($100); method=" + BANK,
      "201 Payout status=requested, amountCents=10000, method {type:'bank',bankName:'Vietcombank',accountHolder:'OLIVIA OWNER',accountMasked:'****6789'} (không lộ số đầy đủ); revenue: availableBalanceCents 35415 -> 25415, payoutRequestedCents 10000 -> 20000.")
    A("Rút tiền", "Biên tối thiểu: đúng $50 (5000 cent) được chấp nhận",
      "Chức năng", "Cao", SEED_NOTE + " " + MUTATE, ["Owner POST payouts amountCents=5000"], "amountCents=5000; PAYOUT_MIN_USD=50 (tạm)", "201 status=requested (điều kiện chặn là amountCents < 5000 nên 5000 hợp lệ).")
    A("Rút tiền", "Dưới ngưỡng tối thiểu: 4999 cent bị 400",
      "Chức năng", "Cao", SEED_NOTE, ["Owner POST payouts amountCents=4999"], "amountCents=4999",
      "400 BAD_REQUEST, message 'Số tiền rút tối thiểu là 50.00 USD'; không tạo payout, số dư không đổi.")
    A("Rút tiền", "Vượt số dư khả dụng bị 400",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Số dư khả dụng 35415.", ["Owner POST payouts amountCents=35416"], "35416 > 35415",
      "400 BAD_REQUEST, message 'Số tiền rút vượt quá số dư khả dụng'. Cùng request với amountCents=35415 (rút hết) thì 201 và số dư về 0.")
    A("Rút tiền", "Rút hết số dư khả dụng đúng bằng số dư",
      "Chức năng", "Trung bình", SEED_NOTE + " " + REV + " " + MUTATE, ["Owner POST payouts amountCents=35415", "GET revenue"], "35415",
      "201; availableBalanceCents = 0. Lệnh rút tiếp theo (5000) bị 400 'Số tiền rút vượt quá số dư khả dụng'.")
    for amt, why in ((0, "bằng 0"), (-5000, "số âm"), (5000.5, "không phải số nguyên"), ("5000", "kiểu chuỗi")):
        A("Rút tiền", f"Validate amountCents: {why}",
          "Chức năng", "Trung bình", SEED_NOTE, [f"Owner POST payouts với amountCents={amt!r}"], f"amountCents={amt!r}",
          "400 VALIDATION_ERROR (amountCents phải là số nguyên dương: 'Số tiền phải lớn hơn 0' / 'Số tiền phải là số nguyên (cent)'); không tạo payout.")
    for num, why in (("12345", "5 chữ số"), ("123456789012345678901", "21 chữ số"), ("12ab5678", "có chữ cái")):
        A("Rút tiền", f"Validate số tài khoản: {why}",
          "Chức năng", "Trung bình", SEED_NOTE, [f"Owner POST payouts amountCents=5000, accountNumber='{num}'"], f"accountNumber={num}",
          "400 VALIDATION_ERROR với thông điệp 'Số tài khoản phải gồm 6–20 chữ số'.")
    A("Rút tiền", "Số tài khoản biên 6 và 20 chữ số hợp lệ",
      "Chức năng", "Thấp", SEED_NOTE + " " + MUTATE, ["Owner POST payouts accountNumber='123456'", "Owner POST payouts accountNumber='12345678901234567890'"], "6 và 20 chữ số",
      "Cả hai 201; accountMasked lần lượt '****3456' và '****7890'.")
    A("Rút tiền", "Thiếu tên ngân hàng / chủ tài khoản rỗng bị 400",
      "Chức năng", "Trung bình", SEED_NOTE, ["Owner POST payouts với bankName='' ", "Owner POST payouts với accountHolder='   '", "method.type='paypal'"], "-",
      "Cả ba 400 VALIDATION_ERROR (trim rồi min 1 ký tự; type phải là 'bank').")
    A("Rút tiền", "Platform Admin không được tạo lệnh rút thay Owner",
      "Bảo mật", "Cao", SEED_NOTE + " Đăng nhập admin (Platform Admin ghi đè xem, nhưng không được rút).", ["POST /api/courses/paid-demo/payouts amountCents=5000 bằng admin"], "-",
      "403 FORBIDDEN, message 'Chỉ chủ cộng đồng mới được yêu cầu rút tiền'.")
    for who, mail in (("cadmin", "cadmin@sofinhub.test"), ("mod", "mod@sofinhub.test"), ("member1", "member1@sofinhub.test"), ("newbie", "newbie@sofinhub.test")):
        A("Rút tiền", f"{who} tạo lệnh rút tiền bị 403",
          "Bảo mật", "Cao", SEED_NOTE + f" Đăng nhập {mail}.", ["POST /api/courses/paid-demo/payouts amountCents=5000"], "-",
          "403 FORBIDDEN 'Chỉ chủ cộng đồng mới được yêu cầu rút tiền'; không tạo payout.")
    A("Rút tiền", "Guest tạo lệnh rút bị 401",
      "Bảo mật", "Trung bình", "Guest.", ["POST /api/courses/paid-demo/payouts không token"], "-", "401 UNAUTHORIZED.")
    A("Rút tiền", "Danh sách payout của Owner có 2 lệnh seed, số TK che",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập owner (DB sạch).", ["GET /api/courses/paid-demo/payouts"], "-",
      "200 {data,meta}: meta.total=2; seed-payout-pending (requested, 5000) và seed-payout-paid (paid, 5000, note 'Đã chuyển khoản (seed)'); method.bankName='Vietcombank', accountHolder='OLIVIA OWNER', accountMasked='****6789'; không có trường accountLast4 lộ ra.")
    A("Rút tiền", "GET payouts: member1 403, guest 401, Platform Admin xem được",
      "Bảo mật", "Trung bình", SEED_NOTE, ["GET /api/courses/paid-demo/payouts bằng member1", "Không token", "Bằng admin"], "-", "403; 401; 200 (Platform Admin xem được, chỉ không rút được).")
    A("Rút tiền", "Form rút tiền trên dashboard: rút thành công hiện trong 'Lệnh rút tiền'",
      "Giao diện", "Cao", SEED_NOTE + " Đăng nhập owner. " + MUTATE,
      ["Mở /courses/paid-demo/revenue-dashboard", "Nhập số tiền 60 (USD), ngân hàng Vietcombank, số TK 0123456789, chủ TK OLIVIA OWNER", "Gửi"], "60 USD",
      "Lệnh mới xuất hiện với trạng thái 'Đã yêu cầu' và số TK ****6789; Số dư khả dụng giảm $60.00.")
    A("Rút tiền", "Form rút tiền hiển thị lỗi BE khi dưới $50 hoặc vượt số dư",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập owner.", ["Nhập số tiền 10 rồi gửi", "Nhập số tiền 99999 rồi gửi"], "10 USD; 99999 USD",
      "Khung lỗi (role=alert) hiển thị 'Số tiền rút tối thiểu là 50.00 USD' và 'Số tiền rút vượt quá số dư khả dụng'; không có lệnh mới.")
    A("Rút tiền", "Hai lệnh rút song song không vượt tổng số dư",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " Số dư 35415. " + MUTATE, ["Owner gửi đồng thời 2 POST payouts amountCents=20000"], "2 x 20000 > 35415",
      "Đúng một request 201, request còn lại 400 'Số tiền rút vượt quá số dư khả dụng' (khóa Course FOR UPDATE).", pw="Một phần")
    A("Rút tiền", "Admin: danh sách /admin/payouts?status=requested có payout seed",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập admin.", ["GET /api/admin/payouts?status=requested"], "-",
      "200 có seed-payout-pending (courseId=paid-demo, ownerId=id owner, amountCents=5000, accountMasked '****6789'); không có seed-payout-paid.")
    A("Rút tiền", "Admin duyệt payout: requested -> approved, Owner nhận thông báo",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập admin. " + MUTATE, ["PATCH /api/admin/payouts/seed-payout-pending body {\"action\":\"approve\"}", "Owner GET /api/notifications"], "-",
      "200 status=approved; Owner có thông báo 'Yêu cầu rút tiền đã được duyệt' body 'Yêu cầu rút 50.00 USD đã được duyệt và sẽ được chuyển khoản.'; availableBalanceCents không đổi (payout approved vẫn bị trừ).")
    A("Rút tiền", "Admin mark_paid: approved -> paid",
      "Chức năng", "Cao", SEED_NOTE + " seed-payout-pending đã approved. " + MUTATE, ["PATCH /api/admin/payouts/seed-payout-pending body {\"action\":\"mark_paid\",\"note\":\"CK xong\"}"], "note='CK xong'",
      "200 status=paid, note='CK xong'; thông báo 'Đã chuyển tiền' body '50.00 USD đã được chuyển vào tài khoản ****6789.'.")
    A("Rút tiền", "Admin từ chối payout: số dư được hoàn lại",
      "Chức năng", "Cao", SEED_NOTE + " " + REV + " " + MUTATE, ["Owner GET revenue (ghi availableBalance 35415)", "Admin PATCH seed-payout-pending {\"action\":\"reject\",\"note\":\"Sai thông tin\"}", "Owner GET revenue"], "note='Sai thông tin'",
      "Payout status=rejected; payoutRequestedCents 10000 -> 5000; availableBalanceCents 35415 -> 40415; thông báo 'Yêu cầu rút tiền bị từ chối' body 'Lý do: Sai thông tin'.")
    A("Rút tiền", "Chuyển trạng thái payout không hợp lệ trả 409",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập admin.",
      ["PATCH seed-payout-paid {\"action\":\"approve\"}", "PATCH seed-payout-paid {\"action\":\"mark_paid\"}", "PATCH seed-payout-paid {\"action\":\"reject\"}"], "-",
      "409 CONFLICT lần lượt: 'Chỉ duyệt được yêu cầu đang chờ'; 'Yêu cầu không ở trạng thái có thể đánh dấu đã chi'; 'Yêu cầu đã được xử lý xong'.")
    A("Rút tiền", "PATCH payout không tồn tại trả 404, action sai trả 400",
      "Chức năng", "Thấp", SEED_NOTE + " Đăng nhập admin.", ["PATCH /api/admin/payouts/khong-co {\"action\":\"approve\"}", "PATCH seed-payout-pending {\"action\":\"pay\"}"], "-",
      "404 'Không tìm thấy yêu cầu rút tiền'; 400 VALIDATION_ERROR.")
    A("Rút tiền", "Owner/thành viên gọi /admin/payouts bị 403",
      "Bảo mật", "Cao", SEED_NOTE, ["Owner GET /api/admin/payouts", "Owner PATCH /api/admin/payouts/seed-payout-pending {\"action\":\"approve\"}", "member1 GET /api/admin/payouts"], "-",
      "Tất cả 403; Owner không tự duyệt lệnh rút của mình. Guest: 401.")
    A("Rút tiền", "Tab Rút tiền ở /admin: lọc trạng thái và thao tác Duyệt/Đã chi trả/Từ chối",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập admin. " + MUTATE, ["Mở /admin, tab Rút tiền", "Lọc 'Đã yêu cầu'", "Duyệt rồi chọn 'Đã chi trả'"], "-",
      "Lệnh chuyển trạng thái tương ứng, biến khỏi bộ lọc 'Đã yêu cầu'; xử lý lại báo lỗi 409 trong hộp thoại.", pw="Một phần")
    A("Rút tiền", "Số dư có thể âm khi hoàn tiền sau khi đã rút (ghi nhận, chưa xử lý)",
      "Chức năng", "Thấp", SEED_NOTE + " Owner rút hết số dư 35415, sau đó Admin duyệt seed-refund-pending. " + MUTATE, ["Rút hết số dư", "Duyệt hoàn tiền demo #2", "GET revenue"], "-",
      "availableBalanceCents âm (35415 - 35415 - phần hoàn) - hành vi hiện tại được docs ghi nhận (giới hạn); chưa có cơ chế giữ/độ trễ giải ngân (chưa chốt).", pw="Không")

    # ============================================================ 12. PHÂN QUYỀN DOANH THU
    A("Quyền doanh thu", "Guest gọi revenue bị 401; cộng đồng lạ bị 404",
      "Bảo mật", "Cao", SEED_NOTE + " Owner đăng nhập cho ý 2.", ["GET /api/courses/paid-demo/revenue không token", "GET /api/courses/khong-co/revenue bằng owner"], "-", "401 UNAUTHORIZED; 404 NOT_FOUND.")
    for who, mail, desc in (("member1", "member1@sofinhub.test", "thành viên thường"), ("newbie", "newbie@sofinhub.test", "người chưa vào cộng đồng"),
                            ("cadmin", "cadmin@sofinhub.test", "Admin cộng đồng photo, không thuộc paid-demo"), ("mod", "mod@sofinhub.test", "Mod cộng đồng photo")):
        A("Quyền doanh thu", f"{who} ({desc}) xem doanh thu paid-demo bị 403",
          "Bảo mật", "Cao", SEED_NOTE + f" Đăng nhập {mail}.", ["GET /api/courses/paid-demo/revenue"], "-", "403 FORBIDDEN, không có số liệu nào trong response.")
    A("Quyền doanh thu", "Admin/Mod của chính cộng đồng có phí cũng không xem được doanh thu (mặc định Owner-only)",
      "Bảo mật", "Cao", SEED_NOTE + " Owner bổ nhiệm newbie (đã là thành viên paid-demo) làm Admin cộng đồng qua UI thành viên; " + MUTATE,
      ["Owner đổi vai trò một thành viên paid-demo thành Admin", "Thành viên đó GET /api/courses/paid-demo/revenue và GET .../payouts"], "-",
      "Cả hai 403 (requireRole owner; Admin/Mod cộng đồng không có quyền doanh thu - docs/api/payments.md).", pw="Một phần")
    A("Quyền doanh thu", "Owner của cộng đồng khác không xem được doanh thu paid-demo (IDOR)",
      "Bảo mật", "Cao", SEED_NOTE + " owner@sofinhub.test sở hữu MỌI cộng đồng seed nên dùng tài khoản mới U đăng ký và tự tạo một cộng đồng riêng (Owner của cộng đồng đó).",
      ["Đăng nhập U", "GET /api/courses/paid-demo/revenue", "GET /api/courses/paid-demo/payouts", "POST /api/courses/paid-demo/payouts amountCents=5000"], "-",
      "Cả ba 403: quyền Owner chỉ theo từng cộng đồng.")
    A("Quyền doanh thu", "Platform Admin xem doanh thu paid-demo được (chỉ đọc)",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập admin@sofinhub.test.", ["GET /api/courses/paid-demo/revenue"], "-", "200 cùng số liệu như Owner (grossCents 55100...).")
    A("Quyền doanh thu", "banned@ (bị ban khỏi photo) không có quyền doanh thu paid-demo",
      "Bảo mật", "Trung bình", SEED_NOTE + " Đăng nhập banned@sofinhub.test.", ["GET /api/courses/paid-demo/revenue"], "-", "403 FORBIDDEN.")
    A("Quyền doanh thu", "Token bị thu hồi/hết hạn không xem được doanh thu",
      "Bảo mật", "Trung bình", SEED_NOTE + " Owner đăng nhập, sau đó đăng xuất (vô hiệu hóa phiên).", ["Dùng lại access token cũ gọi GET /api/courses/paid-demo/revenue"], "-", "401 UNAUTHORIZED.")
    A("Quyền doanh thu", "Menu 'Doanh thu & rút tiền' chỉ hiện với Owner/Platform Admin",
      "Giao diện", "Trung bình", SEED_NOTE + " Đăng nhập owner rồi member1.", ["Mở /courses/paid-demo/community, mở menu avatar trên topbar cộng đồng"], "-",
      "Owner thấy 'Doanh thu & rút tiền'; member1 và cadmin không thấy mục này.")

    # ============================================================ 13. NGHIỆP VỤ CHÉO
    A("Nghiệp vụ chéo", "Lời mời DEMO-PAID vẫn trả 402 dù có link mời",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie.", ["POST /api/invites/DEMO-PAID/accept (hoặc mở /invite/DEMO-PAID và bấm tham gia)"], "code=DEMO-PAID",
      "402, error.code=PAYMENT_REQUIRED, message 'Cộng đồng có phí: vui lòng thanh toán để tham gia' (details.courseId=paid-demo); newbie chưa được ghi danh; UI dẫn tới trang thanh toán.")
    A("Nghiệp vụ chéo", "Tham gia trực tiếp (enroll) cộng đồng có phí không qua thanh toán bị 402",
      "Chức năng", "Cao", SEED_NOTE + " Đăng nhập newbie.", ["POST /api/courses/paid-demo/enroll"], "-",
      "402 PAYMENT_REQUIRED 'Cộng đồng có phí: vui lòng thanh toán để tham gia'; newbie chưa ghi danh.")
    A("Nghiệp vụ chéo", "Kick thành viên trả phí: quyền bị xóa nhưng gói/hoàn tiền chưa chốt",
      "Chức năng", "Trung bình", SEED_NOTE + " member1 gói active. Owner kick member1: DELETE /api/courses/paid-demo/members/<member1Id>. " + MUTATE,
      ["Owner DELETE /api/courses/paid-demo/members/<member1Id>", "member1 GET /api/courses/paid-demo/subscription", "member1 GET /api/me/payments"], "-",
      "200 {removed:true}; enrolled=false. Theo code hiện tại Subscription VẪN active và KHÔNG có hoàn tiền/hủy gói (kick chỉ xóa ghi danh) -> scheduler vẫn có thể thu phí kỳ sau khi đến hạn dù không còn quyền (giá trị/chính sách chưa chốt, cần BA quyết định hoàn tiền hoặc hủy gói).", pw="Một phần")
    A("Nghiệp vụ chéo", "Ban thành viên trả phí: chặn checkout/confirm/trial, chưa xử lý gói đang chạy",
      "Bảo mật", "Trung bình", SEED_NOTE + " Owner ban member2: POST /api/courses/paid-demo/members/<member2Id>/ban body {\"reason\":\"vi phạm\"}. " + MUTATE,
      ["member2 GET /api/courses/paid-demo/subscription", "member2 POST /api/courses/paid-demo/checkout", "member2 POST resume"], "-",
      "Ghi danh bị xóa (enrolled=false); Subscription không tự hủy (chưa chốt). Checkout: không bị 409 'đã tham gia' nhưng confirm sẽ 403 'Bạn đã bị cấm khỏi cộng đồng này'.", pw="Một phần")
    A("Nghiệp vụ chéo", "Đổi giá cộng đồng không ảnh hưởng gói đang thuê (giữ priceCents lúc đăng ký)",
      "Chức năng", "Cao", SEED_NOTE + " Owner đổi giá paid-demo từ $19 lên $29 (Cài đặt cộng đồng). Phải khôi phục về $19 sau test. " + MUTATE,
      ["Owner đổi giá paid-demo = 29", "member1 GET /api/me/subscriptions", "Sửa DB member1 hết hạn để scheduler gia hạn (hoặc chờ)", "newbie checkout paid-demo"], "giá mới 2900",
      "Gói member1 vẫn priceCents=1900 và gia hạn thu 1900 (chưa chốt chính sách: giữ giá cũ hay áp giá mới kỳ sau); newbie checkout amountCents=2900. Doanh thu owner tính giao dịch cũ theo 1900.", pw="Một phần")
    A("Nghiệp vụ chéo", "Xóa cộng đồng có gói đang chạy (chưa chốt xử lý gói/hoàn tiền)",
      "Chức năng", "Thấp", "Chưa chốt: khi Owner xóa cộng đồng có thành viên đang trả phí, code chỉ đánh dấu deletedAt và thông báo, không hủy Subscription hay hoàn tiền (chưa thấy xử lý trong payments).", ["Xác định chính sách với BA"], "-",
      "Khi chốt: gói bị hủy/hoàn tiền tương ứng, scheduler không thu phí cộng đồng đã xóa.", pw="Không", st=PLAN)
    A("Nghiệp vụ chéo", "Thông báo thanh toán thành công/thất bại là loại bắt buộc",
      "Chức năng", "Trung bình", SEED_NOTE + " Đăng nhập newbie. " + MUTATE, ["Vào /notifications, tùy chọn: thấy 'Thanh toán thành công' & 'Thanh toán thất bại' nhãn 'Bắt buộc'", "Thực hiện thanh toán thành công", "Mở chuông thông báo"], "-",
      "Công tắc bị khóa; có thông báo 'Thanh toán thành công' với link /courses/paid-demo/community.", pw="Một phần")
    A("Nghiệp vụ chéo", "Chuyển hướng đúng khi người đã tham gia mở trang checkout",
      "Giao diện", "Thấp", SEED_NOTE + " Đăng nhập member1.", ["Mở /courses/paid-demo/checkout rồi bấm Thanh toán"], "-",
      "Checkout trả 409 và UI hiển thị lỗi 'Bạn đã tham gia khóa học này rồi' (không tạo giao dịch).")
    A("Nghiệp vụ chéo", "Trang thanh toán khi API lỗi/khóa không tồn tại",
      "Giao diện", "Thấp", SEED_NOTE + " Đăng nhập newbie.", ["Mở /courses/khong-co/checkout"], "-", "Trạng thái 'Đang tải…' rồi không hiện form thanh toán (trang rỗng do không có dữ liệu khóa học) - không có crash.", pw="Một phần")
    A("Nghiệp vụ chéo", "Lỗi thanh toán hiển thị thông báo trên trang checkout, nút bật lại",
      "Giao diện", "Trung bình", SEED_NOTE + " newbie đã bị cấm khỏi paid-demo (ban). " + MUTATE, ["Mở /courses/paid-demo/checkout", "Bấm 'Thanh toán $19/tháng'"], "-",
      "Hiển thị message lỗi từ BE ('Bạn đã bị cấm khỏi cộng đồng này'), nút Thanh toán bật lại (không kẹt 'Đang xử lý…').", pw="Một phần")
    A("Nghiệp vụ chéo", "Thanh toán bằng cổng thật (Stripe) & giữ tiền: không mô phỏng",
      "Tích hợp", "Cao", "Chưa làm: MockGateway luôn thành công, không có tiền thật; chưa chốt cổng (PLAN câu hỏi #2).", ["Chọn Stripe -> thanh toán bằng thẻ test 4242 4242 4242 4242"], "Thẻ test Stripe",
      "Khi làm xong: chuyển hướng/confirm qua Stripe, quyền cấp qua webhook, hoàn tiền qua Stripe API.", pw="Không", st=PLAN)
