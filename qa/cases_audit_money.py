# -*- coding: utf-8 -*-
"""Testcase module MONEY (Vòng đời tiền - audit backend 2026-10-01, BƯỚC 2, 04/10/2026).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 3.1-3.5 + 6.1 (P1 tiền), backend/docs/api/payments.md (mục "Vòng đời tiền"), backend/docs/api/communities.md,
backend/docs/API.md (mục "Vòng đời tiền & điểm", "Quyết định nghiệp vụ CHƯA CHỐT"), docs/features/money-ui-update.md, backend/src/modules/payments/{payments.service,payments.repository,payments.gateway}.ts,
backend/prisma/migrations/20261004100000_money_lifecycle_points, frontend/src/pages/{RevenuePage,BillingPage,CourseDetailPage}.tsx, frontend/src/features/admin/pages/PaymentsViews.tsx,
backend/tests/money-lifecycle.test.ts (mỗi kịch bản audit 3.x được viết thành test TRƯỚC khi sửa).
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-MONEY-nnn không đổi).

SỐ LIỆU DÙNG TRONG CASE (giá trị TẠM chờ chủ dự án chốt - xem docs/OPEN_DECISIONS.md A1-A5): hoa hồng 10%, phí cổng 2,9% + 30 cent, cửa sổ hoàn tiền 7 ngày, cửa sổ tranh chấp 7 ngày (=> holding 14 ngày),
quỹ dự phòng 10%, rút tối thiểu $50. Công thức mỗi giao dịch succeeded|refunded:
  hoa hồng = round((amount - refunded) x 10%); phí cổng = round(amount x 2,9%) + 30 (cổng KHÔNG hoàn phí khi hoàn tiền); net = amount - refunded - hoa hồng - phí cổng.
  Gói $7 (700¢): hoa hồng 70, phí cổng round(20,3)+30 = 50, net 580.   Gói $10 (1000¢): hoa hồng 100, phí cổng 29+30 = 59, net 841.   Gói $19 (1900¢): hoa hồng 190, phí cổng 55+30 = 85, net 1625.
  Số dư: total = net - payout đã yêu cầu (có thể ÂM); eligible = net của giao dịch đã qua holding (+ mọi net âm); held = net - eligible; reserve = floor(eligible x 10%);
  withdrawable = max(0, min(eligible - reserve - requested, total)); debt = max(0, -total). Mô tả thang nợ: audit 3.5 cũ: 10 người mua $7, rút 5800¢ rồi 10/10 hoàn tiền -> -6300¢.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
PENDING = "[PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev, cổng thanh toán là MockGateway luôn thành công), frontend :5173; "
        "cộng đồng catalog dùng trong case: ai ($7), biz ($9), des ($10), write ($12), mkt ($15), yoga ($8, trial), cook ($19, trial), data ($5), py ($7), fin ($5, riêng tư), lead ($10, riêng tư), fit (miễn phí), paid-demo ($19, owner@).")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset; hoặc chỉ dùng tài khoản/cộng đồng do chính case tạo ra."
SQLH = ("Chạy SQL bằng: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (bảng Prisma: \"Payment\", \"Subscription\", \"Enrollment\", \"CommunityBan\", \"RefundRequest\", \"WebhookEvent\", \"OwnerBalanceLedger\"; "
        "cột cộng đồng của mọi bảng tên \"courseId\" - Prisma field communityId được @map về cột cũ).")
JOB = ("Job nền (payments.subscriptions + payments.reconcile) chạy mỗi 5 phút dưới advisory lock, lượt ĐẦU sau 5 phút kể từ lúc backend khởi động (không chạy ngay): sau khi chỉnh SQL cho đến hạn, đợi tối đa ~5-10 phút "
       "(RUN_SCHEDULERS phải khác 0). Mỗi lượt chỉ tiến 1 kỳ gia hạn.")
USER = "Người dùng thử = tài khoản MỚI đăng ký bằng POST /api/auth/register {email,password:Passw0rd!x,firstName,lastName} (tránh làm bẩn tài khoản seed)."
PAYFLOW = ("Mua gói: POST /api/courses/<id>/checkout {\"method\":\"stripe\"} (Bearer) -> 201 PaymentIntent (id); POST /api/payments/<id>/confirm -> 200 (MockGateway). "
           "Kết quả: Payment succeeded + invoiceNumber INV-<năm>-<6 số>, Subscription active (kỳ 30 ngày), Enrollment.")
C10 = ("Cộng đồng $10 sạch để tính tiền: user Owner mới gọi POST /api/communities {\"title\":\"Tiền $10 <hậu tố>\",\"description\":\"mô tả thử\",\"category\":\"tech\",\"priceUsd\":10,\"visibility\":\"public\"} -> id (slug); "
       "4 người mua mới lần lượt checkout+confirm -> 4 giao dịch $10. Đặt Admin > Hệ thống > Cài đặt chung: Rút tối thiểu = 10 USD để rút được số nhỏ (nhớ Reset sau case).")
ADMIN = "Token admin: POST /api/auth/login admin@sofinhub.test / Passw0rd!x (Platform Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
BANK = "{\"type\":\"bank\",\"bankName\":\"Vietcombank\",\"accountNumber\":\"0123456789\",\"accountHolder\":\"NGUYEN VAN A\"}"


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}}."


def load(add):
    M, MN = "MONEY", "Vòng đời tiền (audit bước 2)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. DOUBLE-CHARGE (audit 3.1)
    F = "Double-charge (audit 3.1)"
    A(F, "Checkout lần 2 khi còn intent pending tái dùng đúng intent cũ (không tạo intent mới)", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["Người dùng mới U: POST /api/courses/ai/checkout {\"method\":\"stripe\"} -> 201, ghi payment.id = P1", "Gọi lại đúng yêu cầu đó lần 2 -> ghi id = P2", "SQL: SELECT count(*) FROM \"Payment\" WHERE \"userId\"='<U.id>'"], "ai $7",
      "Cả hai 201; P1 = P2; đếm Payment = 1 (checkout tái dùng intent pending chưa quá 30 phút của cùng user+cộng đồng).", pw="Có")
    A(F, "Hai checkout song song (double-click / 2 tab) cùng trả về MỘT intent", "Chức năng", "Cao", BASE + " " + USER,
      ["Bắn 2 POST /api/courses/data/checkout cùng lúc (2 cửa sổ curl hoặc Promise.all)", "So sánh id hai phản hồi", "Đếm Payment của user"], "data $5",
      "Cả hai 201 cùng id; chỉ 1 dòng Payment (khóa cố vấn checkout:<user>:<course> tuần tự hóa).", pw="Có")
    A(F, "Intent pending quá 30 phút không được tái dùng: checkout tạo intent mới", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH,
      ["checkout -> P1", "SQL: UPDATE \"Payment\" SET \"createdAt\" = now() - interval '31 minutes' WHERE id='<P1>'", "checkout lại"], "PENDING_INTENT_TTL_MS = 30 phút",
      "Lần 2 trả id KHÁC P1 (intent mới, 201). Intent cũ vẫn pending (không bị xóa).", pw="Không")
    A(F, "Confirm 2 lần song song trên cùng intent: cả hai 200 nhưng chỉ 1 lần trừ tiền, 1 hóa đơn, 1 gói", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["checkout 'ai' -> P", "Bắn 2 POST /api/payments/<P>/confirm cùng lúc", "SQL: đếm Payment succeeded, Subscription, invoiceNumber của user"], "ai $7",
      "Cả hai 200 (dùng chung 1 promise trong tiến trình); Payment succeeded = 1 (700¢); Subscription = 1; đúng 1 invoiceNumber.", pw="Một phần")
    A(F, "Hai intent pending KHÁC NHAU của cùng user confirm song song: chỉ 1 thành công, khoản thừa được hoàn, khách chỉ mất 700¢", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["SQL: chèn 2 Payment pending cho U ở 'ai': INSERT INTO \"Payment\"(id,\"courseId\",\"userId\",method,\"amountCents\",\"trialDays\",status,kind,\"updatedAt\") VALUES (gen_random_uuid(),'ai','<U.id>','stripe',700,7,'pending','initial',now()) (chạy 2 lần) -> A, B",
       "Bắn song song POST /api/payments/<A>/confirm và POST /api/payments/<B>/confirm", "SQL: SELECT id,status,\"failureReason\",\"refundedCents\",\"gatewayChargeId\" FROM \"Payment\" WHERE \"userId\"='<U.id>'", "Đếm Subscription active/trialing của U"], "2 intent 700¢",
      "Một yêu cầu 200, yêu cầu còn lại 409 (hoặc cả hai 200 nếu trùng promise). SQL: đúng 1 Payment succeeded; Payment kia failed + failureReason='duplicate_charge', refundedCents=700 (khoản trừ trùng bị void qua gateway.refund key 'void:<paymentId>'); chỉ 1 Subscription sống. Tổng khách thực mất = 700¢.", pw="Không")
    A(F, "DB chặn cứng 2 gói sống: UNIQUE(userId, courseId) WHERE status IN ('trialing','active')", "Bảo mật", "Cao", BASE + " " + USER + " " + SQLH,
      ["Mua 'ai' thành công (gói active)", "SQL: INSERT thêm 1 Subscription status 'trialing' cùng userId + courseId (copy các cột bắt buộc: id, userId, \"courseId\", status, \"priceCents\", \"currentPeriodStart\", \"currentPeriodEnd\", \"updatedAt\")", "INSERT thêm 1 Subscription status 'canceled' cùng cặp"], "index Subscription_one_live_per_user_course",
      "INSERT 'trialing'/'active' thứ hai lỗi 23505 (unique violation, tên index Subscription_one_live_per_user_course). INSERT 'canceled' thành công (gói đã kết thúc được phép nhiều).", pw="Không")
    A(F, "Migration money_lifecycle dọn gói trùng sẵn có: giữ gói active/mới nhất, hủy phần thừa", "Tích hợp", "Trung bình", "DB mô phỏng dữ liệu cũ: schema trước migration 20261004100000 có sẵn 2 gói trialing/active cùng (user, course); có quyền chạy npx prisma migrate deploy.",
      ["Tạo 2 gói sống trùng cặp trên DB trước migration", "Chạy npx prisma migrate deploy (migration 20261004100000_money_lifecycle_points)", "Kiểm tra Subscription của cặp đó"], "dữ liệu cũ có trùng",
      "Migration không lỗi; còn đúng 1 gói sống (ưu tiên 'active', rồi mới nhất); bản thừa chuyển 'canceled'; unique index tạo thành công.", pw="Không")
    A(F, "Checkout khi gói còn hiệu lực (active, kể cả đang hủy cuối kỳ) -> 409, không trừ tiền lần hai", "Chức năng", "Cao", BASE + " " + USER,
      ["Mua 'biz' thành công", "POST /api/courses/biz/checkout lần nữa", "Đếm Payment"], "đã có gói active", "409 CONFLICT (đã tham gia / gói còn hiệu lực); Payment vẫn 1.", pw="Có")
    A(F, "Checkout khi đã là thành viên (không có gói) -> 409; cộng đồng miễn phí -> 400", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U POST /api/courses/fit/checkout (miễn phí)", "Cấp Enrollment cho U ở 'ai' bằng SQL rồi checkout 'ai'"], "fit / ai", "Miễn phí: 400 (cộng đồng miễn phí không cần thanh toán). Đã là thành viên: 409.", pw="Một phần")
    A(F, "Idempotency-Key: cùng key trả đúng giao dịch cũ (201); key dùng cho cộng đồng khác -> 409", "Chức năng", "Trung bình", BASE + " " + USER,
      ["checkout 'ai' với header Idempotency-Key: k-001 -> P1", "Lặp lại cùng key -> ?", "checkout 'biz' với Idempotency-Key: k-001"], "Idempotency-Key",
      "Lần 2: 201 cùng id P1. Key dùng cho 'biz': 409 CONFLICT.", pw="Có")
    A(F, "Giá luôn lấy từ server: body amountUsd/amountCents bị bỏ qua", "Bảo mật", "Cao", BASE + " " + USER,
      ["POST /api/courses/mkt/checkout {\"method\":\"stripe\",\"amountCents\":1,\"amountUsd\":0.01}", "Đọc amountCents trong phản hồi"], "mkt $15",
      "201 với amountCents = 1500 (giá $15 của cộng đồng), không phải 1.", pw="Có")
    A(F, "Trial rồi trả phí: gói trialing chuyển 'active', kỳ mới tính từ lúc trả, không có gói thứ hai", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["POST /api/courses/yoga/trial -> 201 Subscription trialing", "checkout + confirm 'yoga' ($8)", "SQL: SELECT status,\"currentPeriodStart\",\"currentPeriodEnd\" FROM \"Subscription\" WHERE \"userId\"='<U.id>'"], "yoga $8, trial 7 ngày",
      "Còn 1 gói, status 'active', currentPeriodStart ≈ lúc confirm, currentPeriodEnd = +30 ngày; 1 Payment succeeded 800¢ kind initial.", pw="Có")
    A(F, "Hóa đơn gap-free và không trùng sau nhiều confirm song song của nhiều user", "Chức năng", "Cao", BASE + " " + SQLH,
      ["Tạo 6 người dùng mới, mỗi người checkout 'data' ($5)", "Confirm cả 6 cùng lúc", "SQL: SELECT \"invoiceNumber\" FROM \"Payment\" WHERE \"invoiceNumber\" IS NOT NULL ORDER BY \"invoiceNumber\" DESC LIMIT 6"], "6 confirm song song",
      "6 invoiceNumber liên tiếp INV-<năm>-nnnnnn, không trùng, không hở (số được cấp cuối transaction, rollback trả lại số).", pw="Không")
    A(F, "Webhook payment.succeeded cho intent trùng/đã void không ném lỗi và không tạo gói thứ hai", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " Webhook ký bằng PAYMENT_WEBHOOK_SECRET trong backend/.env (xem nhóm Webhook).",
      ["Tạo tình huống 2 intent như case trước để có 1 Payment failed duplicate_charge (B)", "Gửi webhook {id:'evt_dup_1',type:'payment.succeeded',data:{paymentId:'<B>'}} ký hợp lệ"], "intent đã void",
      "200 {received:true} (không 500); Payment B vẫn failed; không có Subscription/Enrollment/hóa đơn mới.", pw="Không")
    A(F, "FE: bấm 'Thanh toán' nhiều lần/2 tab chỉ trừ một lần", "Giao diện", "Cao", BASE + " Đăng nhập một user mới trên FE (2 cửa sổ cùng phiên).",
      ["Mở /communities/ai/checkout ở 2 tab", "Chọn phương thức, bấm 'Thanh toán' ở tab 1 và ngay lập tức tab 2 (hoặc double-click nút)", "Vào /billing xem lịch sử"], "ai $7",
      "Chỉ 1 giao dịch 'Thành công' $7.00 trong lịch sử; tab còn lại hiện lỗi 409/đã tham gia hoặc chuyển trang thành công, KHÔNG có giao dịch thứ hai; nút thanh toán bị vô hiệu khi đang gửi.", pw="Có")
    A(F, "FE: trang Gói & thanh toán sau mua liệt kê 1 gói + 1 hóa đơn", "Giao diện", "Trung bình", BASE + " " + USER + " Đã mua 'ai' bằng user đó, đăng nhập FE.",
      ["Mở /billing", "Đọc danh sách gói và lịch sử thanh toán"], "ai", "Một gói 'Đang hoạt động' của 'AI Video Mastery' và một giao dịch 'Thành công' $7.00 có số hóa đơn INV-...; không có dòng trùng.", pw="Có")

    # ============================================================ 2. KICK/BAN/XÓA/KHÓA KHÔNG BỊ TRỪ TIỀN (audit 3.2)
    F = "Không trừ tiền kick/ban/xóa/khóa (audit 3.2)"
    A(F, "Ban thành viên trả phí rồi chạy gia hạn: không có giao dịch renewal, gói không còn active", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB + " Owner của 'des': tạo bằng SQL/grant hoặc dùng admin@ (Platform Admin ghi đè Owner).",
      ["U mua 'des' ($10) thành công", "admin@ (hoặc owner) POST /api/courses/des/members/<U.id>/ban {\"reason\":\"spam\"}", "SQL: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute' WHERE \"userId\"='<U.id>'", "Đợi job gia hạn (~5 phút)", "SQL: SELECT count(*) FROM \"Payment\" WHERE \"userId\"='<U.id>' AND kind='renewal'; SELECT status FROM \"Subscription\" WHERE \"userId\"='<U.id>'"], "ban sau khi mua",
      "Sau ban: Subscription.cancelAtPeriodEnd=true (stopRenewals, thông báo 'sẽ không được gia hạn'), Enrollment bị xóa, ghi CommunityBan. Sau job: renewal = 0; Subscription = 'canceled'. User không bị trừ tiền.", pw="Không")
    A(F, "Kick thành viên trả phí: gói kết thúc NGAY + thông báo 'không bị tính phí thêm'; user vẫn tự checkout lại được", "Chức năng", "Cao", BASE + " " + USER + " Đăng nhập admin@ để kick.",
      ["U mua 'biz'", "admin@ DELETE /api/courses/biz/members/<U.id>", "SQL: trạng thái Subscription của U", "GET /api/notifications của U", "U POST /api/courses/biz/checkout (kick không phải ban)"], "kick",
      "Subscription.status='canceled' ngay; Enrollment mất; thông báo 'Gói thành viên đã kết thúc… không bị tính phí thêm' (type removed_from_community); checkout lại 201 (không bị chặn) và confirm 200 trả tiền kỳ mới.", pw="Một phần")
    A(F, "Xóa mềm cộng đồng: mọi gói kết thúc ngay (thông báo), gia hạn không trừ tiền", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB + " " + ADMIN,
      ["U mua 'write' ($12)", "admin@ DELETE /api/courses/write -> 200/204", "SQL: SELECT status FROM \"Subscription\" WHERE \"userId\"='<U.id>'", "Ép đến hạn: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute' ... rồi chờ job", "GET /api/notifications của U"], "xóa cộng đồng",
      "Subscription='canceled' ngay sau xóa; thông báo nhắc gói đã kết thúc/cộng đồng bị xóa; sau job vẫn 0 Payment kind='renewal'. (Khôi phục: db:reset.)", pw="Không")
    A(F, "Cộng đồng bị khóa: checkout, dùng thử, confirm intent cũ đều 403 COMMUNITY_LOCKED, không trừ tiền", "Chức năng", "Cao", BASE + " " + USER + " " + ADMIN + " " + SQLH,
      ["U1 (đã checkout 'mkt' nhưng CHƯA confirm) -> P", "admin@ POST /api/admin/courses/mkt/lock {\"reason\":\"lừa đảo\"}", "U2 mới: POST /api/courses/mkt/checkout -> ?", "U2 POST /api/courses/mkt/trial -> ?", "U1 POST /api/payments/<P>/confirm -> ?"], "mkt bị khóa",
      "U2 checkout: 403 COMMUNITY_LOCKED; trial: 403; U1 confirm: 403 (không có charge, Payment vẫn pending, 0 succeeded). Mở khóa bằng POST /api/admin/courses/mkt/unlock {} rồi checkout lại 201.", pw="Một phần")
    A(F, "Cộng đồng bị khóa: gói đang có chuyển 'hủy cuối kỳ' + thông báo, không gia hạn", "Chức năng", "Cao", BASE + " " + USER + " " + ADMIN + " " + SQLH + " " + JOB,
      ["U mua 'cook' ($19)", "admin@ lock 'cook'", "SQL: Subscription của U: cancelAtPeriodEnd", "Ép đến hạn rồi chờ job", "Kiểm tra Payment renewal và thông báo"], "lock cook",
      "cancelAtPeriodEnd=true (hủy cuối kỳ, không bị cắt quyền tức thì ngoài việc COMMUNITY_LOCKED chặn truy cập); thông báo 'sẽ không được gia hạn'; sau job không có renewal, gói 'canceled'.", pw="Không")
    A(F, "Admin console đình chỉ (suspend) hoặc xóa cộng đồng cũng dừng/kết thúc gói (endAllForCommunity)", "Chức năng", "Cao", BASE + " " + USER + " Admin console đợt 1: Cộng đồng > chọn cộng đồng có gói > Tạm ngưng / Xóa.",
      ["U mua 'py'", "Admin > Cộng đồng > 'py' > Tạm ngưng (lý do bất kỳ)", "SQL: Subscription U", "Khôi phục rồi lặp với Xóa"], "suspend/delete từ admin console",
      "Tạm ngưng: gói cancelAtPeriodEnd=true (mode stop). Xóa: gói 'canceled' ngay. Thông báo tương ứng tới U.", pw="Một phần")
    A(F, "Người đã bị cấm/không còn là thành viên: scheduler hủy gói không trừ tiền", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'data'", "SQL: DELETE FROM \"Enrollment\" WHERE \"userId\"='<U.id>' AND \"courseId\"='data' (mô phỏng mất quyền)", "Ép currentPeriodEnd về quá khứ, chờ job"], "mất enrollment",
      "Job: Subscription -> 'canceled', KHÔNG tạo Payment renewal.", pw="Không")
    A(F, "Gia hạn bình thường: đến hạn -> 1 giao dịch renewal, kỳ tiến đúng 1 chu kỳ, có hóa đơn", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'ai' ($7)", "SQL ghi currentPeriodEnd hiện tại: SELECT \"currentPeriodEnd\"; rồi UPDATE ... SET \"currentPeriodEnd\"=now()-interval '1 minute'", "Chờ job", "SQL: Payment kind='renewal' + Subscription"], "renewal",
      "Có 1 Payment kind='renewal' 700¢ succeeded + invoiceNumber mới; currentPeriodEnd tiến +30 ngày kể từ mốc cũ (không tiến nhiều kỳ trong 1 lượt); thông báo 'Gia hạn gói thành công'; user vẫn là thành viên.", pw="Không")
    A(F, "Hết dùng thử không trả tiền: gói 'expired' và thu hồi quyền; Owner không bao giờ bị thu hồi", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U POST /api/courses/cook/trial", "SQL: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute' WHERE \"userId\"='<U.id>'", "Chờ job", "GET /api/courses/cook/posts bằng U"], "hết trial",
      "Subscription='expired'; Enrollment bị xóa; GET posts 403 (không còn là thành viên). Với owner: revokeAccess bỏ qua vai trò owner.", pw="Không")
    A(F, "Gói hủy-cuối-kỳ đến hạn: 'canceled' + thu hồi quyền, không trừ tiền", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'biz'; POST /api/courses/biz/subscription/cancel {\"atPeriodEnd\":true}", "Ép currentPeriodEnd về quá khứ, chờ job"], "cancel at period end",
      "Subscription='canceled', Enrollment mất, 0 renewal.", pw="Không")
    A(F, "Thẻ bị từ chối khi gia hạn: gói 'expired' + thu hồi + thông báo (unit test, không thể giả lập qua UI)", "Chức năng", "Trung bình", "Cài backend; Postgres local; tests/payments.test.ts có mock gateway failFor.",
      ["Chạy npx cross-env NODE_ENV=test node --import tsx --test tests/payments.test.ts", "Đọc các test về gia hạn/charge.ok=false"], "MockGateway.failFor(userId)",
      "Test pass: charge.ok=false khi gia hạn -> Subscription expired, quyền thu hồi, notify payment_failed. (Chưa có dunning/past_due - xem case Kế hoạch.)", pw="Không")
    A(F, "HIỆN TẠI: chưa có dunning (retry, past_due, grace period) - 1 lần thẻ fail là cắt quyền ngay", "Chức năng", "Trung bình", BASE,
      ["Đọc payments.service.ts processDueSubscriptions và enum SubscriptionStatus"], "audit 6.3", "HIỆN TẠI: không có trạng thái past_due, không retry, không email đổi thẻ. KỲ VỌNG (Kế hoạch): thử lại nhiều lần + grace period. Chưa nằm trong bước 2.", pw="Không", st=PLAN)
    A(F, "HIỆN TẠI: chưa có chargeback/dispute thật (charge.dispute.*) - chargeback chỉ là mô phỏng ở admin", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["Gửi webhook type 'charge.dispute.created' (ký hợp lệ)", "Xem Admin > Thanh toán > Tranh chấp thanh toán"], "charge.dispute.created",
      "HIỆN TẠI: webhook trả 200 {received:true, ignored:true} (loại lạ); Payment vẫn succeeded và vẫn tính vào số dư owner. Chargeback ở admin là mô phỏng (tạo tay). Ghi nhận (payments.md 'Giới hạn').", pw="Không", st=PLAN)
    A(F, "Thông báo vòng đời gói hiển thị đúng ở chuông thông báo (FE)", "Giao diện", "Trung bình", BASE + " " + USER + " Đăng nhập U trên FE sau một trong các case kick/lock/delete.",
      ["Thực hiện kick hoặc lock cộng đồng của gói U", "Mở chuông thông báo của U"], "kick/lock",
      "Có thông báo tiếng Việt về việc gói đã kết thúc/sẽ không được gia hạn, kèm đường dẫn; hiện realtime (SSE) hoặc sau F5.", pw="Có")
    A(F, "Checkout/trial với cộng đồng đã xóa -> 404; với người đã bị cấm -> 403", "Bảo mật", "Trung bình", BASE + " " + USER + " " + ADMIN,
      ["admin@ DELETE /api/courses/<cộng đồng tự tạo>", "U checkout/trial cộng đồng đó", "Ban U ở một cộng đồng khác rồi U checkout cộng đồng đó"], "đã xóa / bị cấm",
      "Cộng đồng đã xóa: 404. Bị cấm: 403 (không được mua lại khi còn lệnh cấm).", pw="Có")

    # ============================================================ 3. RỜI CỘNG ĐỒNG / GỠ CẤM (audit 3.3)
    F = "Rời cộng đồng / gỡ cấm (audit 3.3)"
    A(F, "Rời cộng đồng trả phí: mất truy cập ngay, gói chuyển 'hủy cuối kỳ'", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["U mua 'biz' ($9)", "POST /api/courses/biz/enroll (toggle rời)", "GET /api/courses/biz/posts bằng U", "SQL: cancelAtPeriodEnd và currentPeriodEnd của Subscription"], "rời",
      "enroll 200 {enrolled:false}; GET posts 403; Subscription.status='active' nhưng cancelAtPeriodEnd=true (không bị trừ kỳ sau).", pw="Có")
    A(F, "Vào lại khi gói còn hiệu lực: 200 {enrolled:true}, KHÔNG 402, không trả tiền, không đổi kỳ", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["Sau case rời: ghi currentPeriodEnd (T0)", "POST /api/courses/biz/enroll lần nữa", "SQL: count Payment; currentPeriodEnd"], "vào lại",
      "200 enrolled:true; Payment vẫn 1; currentPeriodEnd = T0 (không reset kỳ); cancelAtPeriodEnd vẫn true (muốn gia hạn tiếp phải gọi /subscription/resume).", pw="Có")
    A(F, "Sau khi rời, checkout bị chặn 409 (không thu tiền lần hai trong kỳ đã trả)", "Chức năng", "Cao", BASE + " " + USER,
      ["U mua 'biz', rời (enroll toggle)", "POST /api/courses/biz/checkout"], "gói còn hiệu lực", "409 CONFLICT; không tạo Payment mới; gói không bị reset kỳ.", pw="Có")
    A(F, "Rời xong đến hết kỳ: scheduler không gia hạn, gói 'canceled'", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'biz', rời", "Ép currentPeriodEnd về quá khứ, chờ job"], "rời rồi hết kỳ", "0 Payment renewal; Subscription='canceled'.", pw="Không")
    A(F, "Hết kỳ đã trả rồi mới vào lại: 402 PAYMENT_REQUIRED", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["Sau case trên (gói canceled)", "POST /api/courses/biz/enroll"], "sau hết kỳ", "402 PAYMENT_REQUIRED (gói không còn hiệu lực).", pw="Một phần")
    A(F, "Resume sau khi rời: bỏ cờ hủy, gia hạn tiếp tục; resume khi gói đã hết kỳ -> 409", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U mua 'biz', rời, vào lại", "POST /api/courses/biz/subscription/resume -> ?", "Lặp lại resume khi chưa hủy -> ?"], "resume",
      "Lần 1: 200 Subscription cancelAtPeriodEnd=false. Resume khi chưa hủy: 409; khi gói đã hết kỳ: 409.", pw="Có")
    A(F, "GET /courses/:id/subscription sau khi rời: {enrolled:false, subscription:active+cancelAtPeriodEnd} - mô tả trạng thái rõ ràng", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U mua 'biz', rời", "GET /api/courses/biz/subscription"], "statusFor", "200 {enrolled:false, latestPayment:{...}, subscription:{status:'active', cancelAtPeriodEnd:true, ...}} (không còn trạng thái mâu thuẫn 'rời nhưng vẫn sẽ bị trừ').", pw="Có")
    A(F, "Owner không rời được cộng đồng (409), chuyển quyền trước", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["POST /api/courses/paid-demo/enroll bằng owner@"], "owner rời", "409 CONFLICT (owner không rời được).", pw="Có")
    A(F, "Cộng đồng riêng tư có phí: rời rồi vào lại trong kỳ đã trả không cần xin duyệt, không trả tiền", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH,
      ["Cho U một join request approved ở 'lead' (POST join-requests + admin approve, hoặc SQL), checkout + confirm 'lead' ($10)", "POST /api/courses/lead/enroll (rời)", "POST /api/courses/lead/enroll (vào lại)"], "lead $10 riêng tư",
      "Vào lại 200 enrolled:true (không 403 JOIN_REQUEST_REQUIRED, không 402); Payment vẫn 1.", pw="Không")
    A(F, "Gỡ cấm khi gói còn hạn: trả lại quyền, không trừ lần hai, không reset kỳ", "Chức năng", "Cao", BASE + " " + USER + " " + ADMIN + " " + SQLH,
      ["U mua 'biz', ghi currentPeriodEnd T0", "admin@ POST /api/courses/biz/members/<U.id>/ban {\"reason\":\"nhầm\"}", "admin@ DELETE /api/courses/biz/members/<U.id>/ban", "GET /api/courses/biz/posts bằng U; SQL count Payment, currentPeriodEnd"], "ban rồi gỡ ban",
      "Sau gỡ: U là thành viên lại (GET posts 200); Payment vẫn 1; currentPeriodEnd = T0. (Trước đây: 402 + checkout trừ thêm $29/reset kỳ.)", pw="Một phần")
    A(F, "Gỡ cấm khi gói đã hết hạn: KHÔNG tự cấp quyền (phải trả tiền)", "Chức năng", "Trung bình", BASE + " " + USER + " " + ADMIN + " " + SQLH,
      ["U mua 'biz', ban, ép Subscription sang 'canceled' hoặc currentPeriodEnd quá khứ", "Gỡ cấm", "GET posts bằng U"], "ban rồi hết hạn", "Gỡ cấm 200 nhưng U không có Enrollment (403 khi GET posts); vào lại phải 402 -> checkout.", pw="Không")
    A(F, "Kick xong user vẫn checkout lại được (kick không phải ban)", "Chức năng", "Trung bình", BASE + " " + USER + " " + ADMIN,
      ["U mua 'biz', admin@ kick U", "U checkout + confirm 'biz'"], "kick -> mua lại", "Mua lại 201/200; U là thành viên lại; có Payment thứ hai 900¢ (kỳ mới).", pw="Một phần")
    A(F, "recordRenewal (webhook subscription.renewed) cấp lại quyền cho người đã mất Enrollment", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " Webhook ký như nhóm Webhook.",
      ["U mua 'biz'; SQL DELETE Enrollment của U", "Gửi webhook {id:'evt_rg_1',type:'subscription.renewed',data:{subscriptionId:'<sub.id>',chargeId:'ch_rg'}}", "GET posts bằng U"], "subscription.renewed", "Webhook 200; U lại là thành viên (grantAccess trừ người bị cấm).", pw="Không")
    A(F, "FE: nút 'Đã tham gia' của cộng đồng có phí hỏi xác nhận đúng nội dung (rời = hủy cuối kỳ, không hoàn kỳ đã trả)", "Giao diện", "Cao", BASE + " Đăng nhập user đã mua 'biz'.",
      ["Mở /communities/biz", "Bấm nút 'Đã tham gia'", "Đọc hộp xác nhận (native confirm)", "Bấm Cancel; sau đó lặp lại và bấm OK"], "confirm dialog",
      "Hộp thoại: 'Rời cộng đồng có phí này? Bạn sẽ mất quyền truy cập ngay, gói thành viên sẽ bị hủy vào cuối kỳ hiện tại (không bị tính phí kỳ sau) và khoản đã thanh toán cho kỳ này không được hoàn lại. Bạn có thể vào lại miễn phí trong kỳ đã trả.' Cancel: không đổi; OK: rời thành công, nút trở lại 'Tham gia'.", pw="Có")
    A(F, "FE: rời cộng đồng MIỄN PHÍ không có hộp xác nhận", "Giao diện", "Thấp", BASE + " Đăng nhập user đã tham gia 'fit'.",
      ["Mở /communities/fit", "Bấm 'Đã tham gia'"], "fit miễn phí", "Rời ngay, không có confirm.", pw="Có")
    A(F, "FE: Gói & thanh toán hiện 'Sẽ kết thúc vào <ngày>' khi cancelAtPeriodEnd (member2@ seed)", "Giao diện", "Cao", BASE + " Đăng nhập member2@sofinhub.test (gói paid-demo đã 'hủy cuối kỳ', còn ~15 ngày).",
      ["Mở /billing", "Đọc nhãn trạng thái của gói paid-demo", "Bấm 'Tiếp tục gói' (nếu có)"], "member2 / paid-demo",
      "Nhãn vàng 'Sẽ kết thúc vào <ngày hết kỳ, định dạng ngày FE>' (dùng accessUntil, không phải 'Đang hoạt động'). Sau 'Tiếp tục gói' nhãn thành 'Đang hoạt động'.", pw="Có")
    A(F, "FE: Gói & thanh toán sau khi rời cộng đồng có phí hiện 'Sẽ kết thúc vào <ngày>'", "Giao diện", "Cao", BASE + " " + USER + " Đăng nhập U (đã mua 'biz' rồi rời).",
      ["Mở /billing"], "rời xong", "Gói 'biz' hiện 'Sẽ kết thúc vào <ngày currentPeriodEnd>' (không 'Đang hoạt động').", pw="Có")
    A(F, "FE: gói đang dùng thử bị hủy hiện cũng 'Sẽ kết thúc vào <ngày>'; gói thường 'Đang dùng thử'/'Đang hoạt động'", "Giao diện", "Thấp", BASE + " Đăng nhập member3@sofinhub.test (paid-demo đang dùng thử còn ~4 ngày).",
      ["Mở /billing", "Hủy gói trong dùng thử", "Đọc nhãn"], "member3 trialing", "Trước hủy: 'Đang dùng thử'. Sau hủy: 'Sẽ kết thúc vào <ngày>'.", pw="Có")

    # ============================================================ 4. HOÀN TIỀN 2 PHA (audit 3.4)
    F = "Hoàn tiền: idempotency + 2 pha + đối soát (audit 3.4)"
    A(F, "Hoàn tiền trong cửa sổ 7 ngày: tự duyệt, Payment 'refunded', gói hủy + thu hồi quyền, có gatewayRefundId", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + PENDING + " cửa sổ hoàn tiền 7 ngày.",
      ["U mua 'ai' ($7)", "POST /api/payments/<P>/refund-request {\"reason\":\"mua nhầm\"}", "SQL: SELECT status,auto,\"gatewayRefundId\",\"amountCents\" FROM \"RefundRequest\" WHERE \"paymentId\"='<P>'; SELECT status,\"refundedCents\" FROM \"Payment\" WHERE id='<P>'", "GET /api/courses/ai/posts bằng U"], "ai $7",
      "201 RefundRequest status 'approved' (auto=true); RefundRequest.gatewayRefundId có giá trị (cổng xác nhận); Payment status 'refunded' refundedCents=700; Subscription 'canceled'; Enrollment mất (GET posts 403); thông báo hoàn tiền tới U.", pw="Có")
    A(F, "Yêu cầu hoàn tiền lần hai cho cùng giao dịch -> 409 (cổng chỉ hoàn 700¢ một lần)", "Chức năng", "Cao", BASE + " " + USER,
      ["Sau case trên: POST /api/payments/<P>/refund-request lần nữa"], "hoàn lần hai", "409 CONFLICT (giao dịch không còn ở trạng thái có thể hoàn tiền / đã có yêu cầu). Tổng cổng hoàn = 700¢.", pw="Có")
    A(F, "Hai yêu cầu hoàn tiền song song: chỉ 1 bên thắng 'pending->refunding', bên kia 409, cổng hoàn 1 lần", "Chức năng", "Cao", BASE + " " + USER,
      ["U mua 'data'", "Bắn 2 POST /api/payments/<P>/refund-request cùng lúc", "SQL: đếm RefundRequest của payment; Payment.refundedCents"], "song song",
      "Một yêu cầu 201, một yêu cầu 409; RefundRequest = 1; refundedCents = 500 ($5.00) đúng một lần.", pw="Một phần")
    A(F, "Cổng hoàn thành công nhưng giao dịch chốt lỗi: không hoàn lần hai (key = refund.id); đối soát chốt 'refunded' (unit test)", "Tích hợp", "Cao", "Cài backend; Postgres local.",
      ["Chạy npx cross-env NODE_ENV=test node --import tsx --test tests/money-lifecycle.test.ts --test-name-pattern=\"tx chốt thất bại\"", "Đọc kết quả"], "mô phỏng timeout sau khi cổng đã hoàn",
      "Test pass: spy gateway chỉ hoàn đúng 700¢ dù user bấm lại + reconcileStuckRefunds; Payment 'refunded' refundedCents 700; RefundRequest = 1.", pw="Không")
    A(F, "Cổng từ chối hoàn: yêu cầu tự tạo biến mất, giao dịch giữ 'succeeded', quyền còn (502) (unit test)", "Tích hợp", "Trung bình", "Cài backend; Postgres local.",
      ["Chạy test 'cổng từ chối hoàn' trong tests/money-lifecycle.test.ts"], "gateway.refund ok=false", "Test pass: requestRefund ném HttpError 502; Payment succeeded; user vẫn là thành viên.", pw="Không")
    A(F, "MockGateway dedupe theo idempotency key: cùng key = cùng khoản hoàn; key khác cộng dồn (unit test)", "Tích hợp", "Trung bình", "Cài backend.",
      ["Chạy test 'MockGateway dedupe theo idempotency key'"], "refund(ch_dedupe,700,'key-1') x2 + 100/'key-2'", "refundId hai lần giống nhau, refundedTotal = 700; thêm key-2 100¢ -> 800.", pw="Không")
    A(F, "Hoàn tiền ngoài cửa sổ 7 ngày: yêu cầu 'pending' chờ Platform Admin duyệt/từ chối", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + ADMIN + " " + PENDING,
      ["U mua 'ai', SQL: UPDATE \"Payment\" SET \"confirmedAt\"=now()-interval '10 days', \"createdAt\"=now()-interval '10 days' WHERE id='<P>' (và Subscription.currentPeriodStart nếu cần)", "U POST /api/payments/<P>/refund-request", "admin@ GET /api/admin/refunds?status=pending", "admin@ PATCH /api/admin/refunds/<id> {\"action\":\"approve\"}"], "ngoài cửa sổ",
      "Yêu cầu 201 status 'pending' (không tự duyệt); admin thấy trong hàng chờ; approve -> 200 RefundRequest 'approved' kèm gatewayRefundId, Payment 'refunded'. Reject -> 'rejected', Payment giữ 'succeeded'.", pw="Một phần")
    A(F, "Duyệt đồng thời một yêu cầu bởi 2 admin: một bên 200, một bên 409 'đã được xử lý'", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["Có 1 RefundRequest pending (seed-pay-pendref hoặc tạo như case trên)", "Hai request PATCH /api/admin/refunds/<id> {action:'approve'} cùng lúc"], "approve x2", "Một 200, một 409; cổng chỉ hoàn một lần; Payment 'refunded' một lần.", pw="Không")
    A(F, "Admin hoàn một phần: Payment 'refunded' với refundedCents < amount, GIỮ quyền truy cập", "Chức năng", "Trung bình", BASE + " " + USER + " " + ADMIN,
      ["U mua 'mkt' ($15)", "POST /api/admin/payments/transactions/<P>/refund {\"reason\":\"thiện chí\",\"amountCents\":500} (hoặc UI Giao dịch > Hoàn tiền một phần)", "Kiểm tra Payment và quyền"], "hoàn 5$ của 15$",
      "Payment refundedCents=500 (trạng thái 'refunded'); U vẫn là thành viên (chỉ hoàn toàn bộ mới thu hồi quyền).", pw="Một phần")
    A(F, "Hoàn tiền giao dịch gia hạn (kỳ hiện tại): hủy gói + thu hồi quyền", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'ai', ép gia hạn bằng job để có Payment kind='renewal'", "U POST /api/payments/<renewal>/refund-request", "Kiểm tra Subscription"], "refund renewal", "Renewal 'refunded'; vì là kỳ hiện tại của gói, gói 'canceled' và quyền bị thu hồi.", pw="Không")
    A(F, "reconcileStuckRefunds: yêu cầu kẹt 'refunding' được chốt bằng gọi lại cổng cùng key (không hoàn thêm)", "Tích hợp", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'ai'; tạo RefundRequest pending bằng refund-request ngoài cửa sổ (hoặc chèn SQL)", "SQL: UPDATE \"RefundRequest\" SET status='refunding', \"refundingAt\"=now()-interval '30 minutes' WHERE id='<R>'", "Chờ job payments.reconcile (≤5-10 phút)", "SQL: trạng thái RefundRequest + Payment"], "kẹt refunding",
      "RefundRequest -> 'approved' (gatewayRefundId được điền), Payment -> 'refunded'; không có thêm khoản hoàn (cổng dedupe theo key = RefundRequest.id).", pw="Không")
    A(F, "Hoàn tiền sau payout ghi sổ nợ OwnerBalanceLedger (refund_after_payout, amountCents < 0)", "Chức năng", "Cao", "Xem nhóm 'Số dư owner' (kịch bản cộng đồng $10). " + SQLH,
      ["Làm theo kịch bản S1 tới bước hoàn tiền sau payout", "SQL: SELECT kind,\"amountCents\",\"paymentId\" FROM \"OwnerBalanceLedger\" WHERE \"courseId\"='<id>' ORDER BY \"createdAt\""], "ledger",
      "Có các dòng kind='refund_after_payout' amountCents âm (S1: -564, -900, -900, -900; tổng -3264). Append-only.", pw="Không")
    A(F, "Người không phải chủ giao dịch không xin hoàn được (403/404); giao dịch pending/failed -> 409", "Bảo mật", "Trung bình", BASE + " " + USER,
      ["U2 POST /api/payments/<P của U1>/refund-request", "U1 POST refund-request cho Payment status 'pending'"], "IDOR hoàn tiền", "U2: 403 hoặc 404 (không lộ tồn tại); pending/failed: 409.", pw="Có")
    A(F, "Chỉ Platform Admin / nhân viên có payment.refund được approve/reject; owner cộng đồng 403", "Bảo mật", "Cao", BASE + " " + tok("owner@sofinhub.test"),
      ["owner@ PATCH /api/admin/refunds/<id> {\"action\":\"approve\"}", "owner@ POST /api/admin/payments/refunds/<id>/approve"], "owner không phải admin", "403 FORBIDDEN (không phải nhân viên admin).", pw="Có")
    A(F, "Admin console: tab 'Đang hoàn tiền' và nhãn trạng thái 'Đang hoàn tiền (chờ cổng)'", "Giao diện", "Cao", BASE + " " + ADMIN + " " + SQLH,
      ["Đặt 1 RefundRequest sang 'refunding' bằng SQL (như case đối soát, đừng chờ job)", "Mở /admin/payments/refunds", "Xem các tab và chip trạng thái của dòng đó"], "refunding",
      "Có tab 'Đang hoàn tiền' với số đếm = số yêu cầu refunding; dòng hiện chip 'Đang hoàn tiền (chờ cổng)'; tab: Yêu cầu mới | Đang hoàn tiền | Hoàn tất | Đã từ chối | Tất cả.", pw="Có")
    A(F, "API tổng hợp hoàn tiền có thêm trường refunding", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["GET /api/admin/payments/refunds/summary (Bearer admin)"], "summary", "200 {data:{pending, refunding, approved, rejected,...}} - trường 'refunding' (additive) đếm đúng.", pw="Có")
    A(F, "HIỆN TẠI: FE người dùng vẫn nhớ trạng thái hoàn tiền trong localStorage (chưa có GET /me/refunds)", "Chức năng", "Thấp", BASE + " Đăng nhập user có giao dịch.",
      ["Mở /billing, gửi yêu cầu hoàn tiền", "DevTools > Application > Local Storage: khóa sofin:refund:<paymentId>", "Đăng nhập cùng tài khoản ở trình duyệt khác"], "localStorage",
      "HIỆN TẠI: trạng thái nằm ở localStorage nên máy khác không thấy nhãn 'Yêu cầu hoàn tiền: ...'. Chưa có GET /me/refunds (money-ui-update.md). Điểm chưa làm.", pw="Có", st=PLAN)

    # ============================================================ 5. SỐ DƯ OWNER (audit 3.5)
    F = "Số dư owner: holding, reserve, nợ (audit 3.5)"
    A(F, "GET /courses/:id/revenue trả đủ trường mới và payoutPolicy {holdDays:14, refundWindowDays:7, disputeWindowDays:7, reservePct:10}", "Chức năng", "Cao", BASE + " " + tok("owner@sofinhub.test") + " " + PENDING + " 7+7 ngày, 10%.",
      ["GET /api/courses/paid-demo/revenue (Bearer owner@)", "Đọc các trường"], "paid-demo",
      "200 có grossCents, refundsCents, platformCommissionCents, gatewayFeeCents, netCents, availableBalanceCents (số CÓ THỂ RÚT NGAY), payoutRequestedCents, totalBalanceCents (net - đã yêu cầu, có thể âm), heldCents, reserveCents, debtCents, payoutPolicy{holdDays:14, refundWindowDays:7, disputeWindowDays:7, reservePct:10}, activePaidMembers, trialingMembers, mrrCents, recentTransactions(<=20), assumptions.", pw="Có")
    A(F, "Tiền mới thu chưa rút được: availableBalanceCents = 0, heldCents > 0, rút bị 400", "Chức năng", "Cao", BASE + " " + C10 + " " + PENDING,
      ["Owner mới tạo cộng đồng $10, 4 người mua (4 x 1000¢)", "GET /api/courses/<id>/revenue (Bearer Owner)", "POST /api/courses/<id>/payouts {\"amountCents\":1000,\"method\":" + BANK + "}"], "4 giao dịch $10 vừa mua",
      "availableBalanceCents=0; heldCents = 3364 (4 x net 841); totalBalanceCents=3364; reserveCents=0 (chưa có tiền eligible); payout 400 PAYOUT_EXCEEDS_AVAILABLE (tiền mới chỉ rút được sau 14 ngày).", pw="Một phần")
    A(F, "Sau holding (60 ngày): total 3364, reserve 336, withdrawable 3028", "Chức năng", "Cao", BASE + " " + C10 + " " + SQLH + " " + PENDING,
      ["Sau case trên: SQL UPDATE \"Payment\" SET \"confirmedAt\"=now()-interval '60 days' WHERE \"courseId\"='<id>'", "GET /api/courses/<id>/revenue"], "4 x net 841 đã qua 14 ngày",
      "totalBalanceCents=3364; reserveCents=336 (floor(3364 x 10%)); availableBalanceCents=3028 (3364 - 336); heldCents=0; debtCents=0.", pw="Không")
    A(F, "Payout vượt số có thể rút bị 400 PAYOUT_EXCEEDS_AVAILABLE; đúng bằng số có thể rút được 201", "Chức năng", "Cao", BASE + " " + C10 + " " + SQLH,
      ["Sau case 'sau holding'", "POST payouts amountCents=3029 (vượt 1)", "POST payouts amountCents=3028", "GET /api/courses/<id>/payouts"], "3029 / 3028",
      "3029: 400 PAYOUT_EXCEEDS_AVAILABLE (thông báo nêu 'Tiền mới chỉ rút được sau 14 ngày và luôn giữ lại 10% làm dự phòng'). 3028: 201 Payout status 'requested', số TK dạng ****6789. Sau đó availableBalanceCents=0, payoutRequestedCents=3028.", pw="Một phần")
    A(F, "Rút dưới ngưỡng tối thiểu $50 bị 400 (kiểm trước số dư)", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test") + " " + PENDING + " $50.",
      ["POST /api/courses/paid-demo/payouts {\"amountCents\":4999,\"method\":" + BANK + "}"], "49,99$ < 50$", "400 'Số tiền rút tối thiểu là 50.00 USD' (nếu Cài đặt chung chưa đổi).", pw="Có")
    A(F, "Kịch bản nợ S1: hoàn cả 4 giao dịch SAU khi payout đã chi -> debt 3264, withdrawable 0", "Chức năng", "Cao", BASE + " " + C10 + " " + SQLH + " " + ADMIN,
      ["Sau payout 3028 được tạo: admin@ PATCH /api/admin/payouts/<id> {\"action\":\"mark_paid\"} -> 200", "Với từng Payment: POST /api/admin/payments/transactions/<paymentId>/refund {\"reason\":\"khiếu nại\"}", "Sau mỗi lần: GET revenue (Owner) và SELECT từ OwnerBalanceLedger"], "S1: 4 giao dịch $10, payout 3028",
      "Mỗi giao dịch hoàn đủ có net = 1000-1000-0-59 = -59. Net tổng lần lượt 2464 -> 1564 -> 664 -> -236; total = net - 3028: -564, -1464, -2364, -3264. debtCents cuối = 3264; availableBalanceCents=0; ledger: -564, -900, -900, -900.", pw="Không")
    A(F, "Còn nợ thì payout MỚI bị chặn 400 PAYOUT_BLOCKED dù có doanh thu mới đã qua holding", "Chức năng", "Cao", BASE + " " + C10 + " " + SQLH,
      ["Sau S1 (debt 3264): 1 người mua mới trả $10, SQL lùi confirmedAt 60 ngày", "POST payouts amountCents=1000"], "nợ + doanh thu mới",
      "400 code PAYOUT_BLOCKED ('Số dư ròng đang âm (còn nợ 32.64 USD ...) — chưa thể rút thêm' hoặc số nợ mới: -3264+841=-2423 => 24.23 USD). Doanh thu mới chỉ bù nợ, không rút được cho tới khi total >= 0.", pw="Không")
    A(F, "Kịch bản audit 3.5 gốc (10 người mua $7, rút hết, 10/10 hoàn): mô hình cũ -6300¢, mô hình mới không rút được trước 14 ngày", "Chức năng", "Cao", BASE + " " + SQLH + " " + PENDING,
      ["Cộng đồng $7 do Owner mới tạo, 10 người mua (10 x net 580 = 5800)", "Ngay lập tức: Owner POST payouts 5800 -> ?", "SQL lùi 60 ngày: withdrawable = 5800 - 580(reserve) = 5220; rút 5220 rồi mark_paid", "Hoàn cả 10 giao dịch: mỗi net = -50 => net -500, total = -500 - 5220 = -5720"], "S2: 10 x $7",
      "Bước 2: 400 (held). Sau holding: rút được 5220, KHÔNG phải 5800. Sau 10 hoàn: debtCents = 5720 (= 5220 đã chi + 500 phí cổng không hoàn); so với cũ -6300. Nền tảng không còn mất 'lỗ 128$' ngầm vì reserve + holding giữ lại 580¢ + khoản chưa rút.", pw="Không")
    A(F, "Số dư hiển thị nhất quán: availableBalanceCents = max(0, min(eligible - reserve - requested, total))", "Chức năng", "Trung bình", BASE + " " + C10 + " " + SQLH,
      ["Tạo 2 giao dịch cũ (60 ngày) + 2 giao dịch mới ($10)", "GET revenue", "Tính tay: eligible=2x841=1682; reserve=168; requested=0; total=3364"], "eligible 1682, held 1682",
      "heldCents=1682; reserveCents=168 (floor); availableBalanceCents=1514 (1682-168); totalBalanceCents=3364.", pw="Không")
    A(F, "Hai lệnh rút song song không vượt số dư (khóa hàng cộng đồng FOR UPDATE)", "Chức năng", "Cao", BASE + " " + C10 + " " + SQLH,
      ["Sau holding (withdrawable 3028): bắn 2 POST payouts amountCents=2000 cùng lúc"], "2 x 2000 / 3028", "Một 201, một 400 PAYOUT_EXCEEDS_AVAILABLE; tổng payoutRequestedCents = 2000.", pw="Không")
    A(F, "Payout bị admin từ chối hoàn lại số dư", "Chức năng", "Trung bình", BASE + " " + C10 + " " + SQLH + " " + ADMIN,
      ["Có payout 'requested' (3028)", "admin@ PATCH /api/admin/payouts/<id> {\"action\":\"reject\",\"note\":\"sai TK\"}", "GET revenue"], "reject payout", "Payout 'rejected'; availableBalanceCents trở lại 3028; Owner nhận thông báo.", pw="Một phần")
    A(F, "Chỉ đúng Owner rút được: Platform Admin và admin/mod cộng đồng bị 403", "Bảo mật", "Cao", BASE + " " + ADMIN,
      ["POST /api/courses/paid-demo/payouts bằng admin@", "Bằng cadmin@ (admin cộng đồng)", "GET /api/courses/paid-demo/revenue bằng cadmin@"], "paid-demo",
      "admin@ payout: 403 (isCourseOwner); cadmin@: 403; cadmin@ revenue: 403. admin@ GET revenue: 200 (Platform Admin được xem).", pw="Có")
    A(F, "Rút tiền khi cộng đồng bị khóa -> 403 COMMUNITY_LOCKED", "Bảo mật", "Cao", BASE + " " + C10 + " " + ADMIN,
      ["admin@ lock cộng đồng $10", "Owner POST payouts / GET revenue / GET payouts"], "owner bị khóa", "Cả ba 403 (requireRole chặn owner khi cộng đồng bị khóa; payout trả COMMUNITY_LOCKED). Platform Admin vẫn xem được.", pw="Có")
    A(F, "Trường tương thích: availableBalanceCents đổi nghĩa thành 'có thể rút ngay'; net - requested nằm ở totalBalanceCents", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["GET /api/courses/paid-demo/revenue", "So sánh availableBalanceCents với totalBalanceCents và heldCents"], "paid-demo seed (giao dịch ~90 ngày)",
      "availableBalanceCents <= totalBalanceCents; với seed giao dịch cũ (>14 ngày) phần lớn là eligible. Admin Payout detail giữ availableCents = net - requested (nghĩa cũ) và thêm withdrawableCents.", pw="Có")
    A(F, "Revenue lọc theo from/to không ảnh hưởng số dư có thể rút", "Chức năng", "Thấp", BASE + " " + tok("owner@sofinhub.test"),
      ["GET revenue?from=2026-09-01&to=2026-09-10", "GET revenue (không lọc)"], "range", "grossCents/netCents theo khoảng; availableBalanceCents/heldCents/reserveCents/debtCents giống nhau (toàn thời gian). FE ghi chú 'Số dư có thể rút không phụ thuộc bộ lọc ngày'.", pw="Có")
    A(F, "Hoa hồng/phí cổng tính bằng basis point nguyên, không float (công thức)", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test") + " " + PENDING + " 10% + 2,9% + 30¢.",
      ["Lấy 1 giao dịch $7 trong recentTransactions", "Tính tay: hoa hồng=round(700x10%)=70, phí cổng=round(700x2,9%)+30=20+30=50, net=580", "Đối chiếu tổng platformCommissionCents/gatewayFeeCents/netCents của đúng 1 giao dịch (cộng đồng chỉ có 1 giao dịch)"], "$7 / $10 / $19",
      "Khớp: $7 -> 70/50/580; $10 -> 100/59/841; $19 -> 190/85/1625. Mọi số là số nguyên cent; assumptions.platformCommissionPct=10, gatewayFeePct=2.9, gatewayFeeFixedCents=30.", pw="Một phần")
    A(F, "Đổi hoa hồng/dispute/reserve ở Cài đặt chung có hiệu lực ngay lên số dư", "Tích hợp", "Trung bình", BASE + " " + ADMIN + " " + PENDING + " (chỉnh được ở Admin > Hệ thống > Cài đặt chung: payments.disputeWindowDays, payments.payoutReservePct).",
      ["Ở S1 sau holding: đổi reservePct=20 và disputeWindowDays=0", "GET revenue"], "reserve 20%, hold 7 ngày", "holdDays=7; reserveCents=floor(eligible x 20%)=672; availableBalanceCents=2692 (3364-672). Reset về mặc định thì trở lại 336/3028.", pw="Một phần")

    # ============================================================ 6. CỘNG ĐỒNG RIÊNG TƯ CÓ PHÍ (audit 6.2)
    F = "Cộng đồng riêng tư có phí (audit 6.2)"
    A(F, "Checkout cộng đồng riêng tư chưa được duyệt -> 403 JOIN_REQUEST_REQUIRED", "Bảo mật", "Cao", BASE + " " + USER,
      ["U (người ngoài, chưa có join request) POST /api/courses/lead/checkout {\"method\":\"stripe\"} ('lead' riêng tư $10)", "Lặp với 'fin' (riêng tư $5)"], "lead / fin",
      "403 với error.code='JOIN_REQUEST_REQUIRED'; không có Payment nào được tạo.", pw="Có")
    A(F, "Dùng thử cộng đồng riêng tư chưa được duyệt -> 403 (đóng lỗ vào free)", "Bảo mật", "Cao", BASE + " " + USER,
      ["U POST /api/courses/fin/trial", "GET /api/courses/fin/posts bằng U"], "fin riêng tư $5", "trial 403; GET posts 403 (không có Enrollment, không đọc được bài/lớp/thành viên).", pw="Có")
    A(F, "Duyệt join request của cộng đồng riêng tư CÓ PHÍ: chỉ cho phép thanh toán, KHÔNG cấp quyền", "Bảo mật", "Cao", BASE + " " + USER + " " + tok("owner@sofinhub.test") + " Cần owner/admin của cộng đồng riêng tư có phí: tạo mới bằng POST /api/communities {priceUsd:5, visibility:'private'} (user owner mới) hoặc dùng 'lead'/'fin' với admin@.",
      ["U POST /api/courses/<id>/join-requests {} -> 201", "Owner/admin POST /api/join-requests/<rid>/approve -> 200", "GET /api/courses/<id>/posts bằng U", "U checkout + confirm"], "private + $5",
      "approve 200 (yêu cầu 'approved') nhưng U CHƯA là thành viên (posts 403). Sau checkout 201 + confirm 200 mới là thành viên. Không còn đường vào miễn phí bằng cách phê duyệt.", pw="Một phần")
    A(F, "Duyệt join request cộng đồng riêng tư MIỄN PHÍ: cấp quyền ngay trong cùng transaction", "Chức năng", "Cao", BASE + " " + USER + " Owner mới tạo cộng đồng private miễn phí (priceUsd:0, visibility:'private').",
      ["U gửi join request", "Owner approve", "GET posts bằng U"], "private miễn phí", "approve 200; U là thành viên (Enrollment tạo đồng thời với trạng thái 'approved').", pw="Có")
    A(F, "Approve ∥ reject song song: Enrollment tồn tại khi và chỉ khi yêu cầu được chốt 'approved'", "Chức năng", "Cao", BASE + " Owner + 1 admin cộng đồng của cộng đồng private miễn phí tự tạo. " + SQLH,
      ["Lặp 6 lần: user mới gửi join request", "Owner POST /api/join-requests/<rid>/approve và admin POST /api/join-requests/<rid>/reject CÙNG LÚC", "SQL: so sánh JoinRequest.status với sự tồn tại Enrollment của user"], "6 vòng",
      "Mỗi vòng: một bên 200, bên kia 409; có Enrollment <=> status='approved' (không còn trạng thái 'rejected' mà vẫn là thành viên).", pw="Không")
    A(F, "Lời mời vào cộng đồng riêng tư có phí: 402 PAYMENT_REQUIRED nhưng được phép thanh toán", "Chức năng", "Cao", BASE + " " + USER + " Mã mời tạo bằng POST /api/courses/<id>/invites {} (owner/admin cộng đồng riêng tư có phí).",
      ["U POST /api/courses/<id>/checkout trước khi dùng mã -> ?", "U POST /api/invites/<code>/accept -> ?", "U checkout lại", "SQL: JoinRequest của U và Invite.usedCount"], "lời mời private có phí",
      "Trước accept: checkout 403 JOIN_REQUEST_REQUIRED. accept: 402 PAYMENT_REQUIRED, vẫn CHƯA là thành viên; hệ thống ghi 1 JoinRequest 'approved' và dùng 1 lượt (usedCount+1). Sau đó checkout 201 và confirm vào được.", pw="Một phần")
    A(F, "Kick/ban thu hồi các join request 'approved' cũ: mua lại lại bị 403", "Bảo mật", "Trung bình", BASE + " " + USER + " " + SQLH,
      ["U đã được duyệt + mua cộng đồng riêng tư có phí", "Owner kick U (DELETE /api/courses/<id>/members/<U.id>)", "U checkout lại"], "kick",
      "Checkout 403 JOIN_REQUEST_REQUIRED (request approved bị thu hồi khi kick/ban).", pw="Một phần")
    A(F, "Cộng đồng CÔNG KHAI có phí: checkout/trial không cần join request", "Chức năng", "Cao", BASE + " " + USER,
      ["U POST /api/courses/yoga/trial", "U POST /api/courses/ai/checkout"], "public paid", "trial 201; checkout 201 (không bị 403 JOIN_REQUEST_REQUIRED).", pw="Có")
    A(F, "Dùng thử sau khi được duyệt (cộng đồng riêng tư có phí): trialing + Enrollment", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U có join request approved ở 'fin' (admin@ duyệt)", "U POST /api/courses/fin/trial"], "approved -> trial", "201 Subscription 'trialing' (TRIAL_DAYS=7); U là thành viên.", pw="Một phần")
    A(F, "Admin (không phải owner) duyệt yêu cầu cộng đồng riêng tư có phí cũng không phát quyền miễn phí", "Bảo mật", "Cao", BASE + " " + USER + " " + tok("cadmin@sofinhub.test"),
      ["cadmin@ (admin cộng đồng) duyệt join request ở cộng đồng riêng tư có phí mà cadmin là admin", "GET posts bằng người xin"], "admin duyệt", "Người xin KHÔNG vào được cho tới khi trả tiền; không có dòng doanh thu bị 'bỏ qua'.", pw="Một phần")
    A(F, "FE: cộng đồng riêng tư có phí - luồng gửi yêu cầu -> được duyệt -> thanh toán", "Giao diện", "Trung bình", BASE + " " + USER + " Đăng nhập U trên FE; owner duyệt ở Cài đặt > Yêu cầu tham gia.",
      ["Mở /communities/lead, bấm 'Tham gia' -> hộp thoại xin vào, gửi", "Owner duyệt yêu cầu", "U tải lại trang, bấm tham gia/thanh toán", "Hoàn tất thanh toán"], "lead $10",
      "Sau khi được duyệt U thấy đường tới thanh toán (dialog gói trả phí/checkout); sau thanh toán nút thành 'Đã tham gia' và vào được /communities/lead/community.", pw="Một phần")

    # ============================================================ 7. WEBHOOK STATE MACHINE (audit 6.1)
    F = "Webhook: máy trạng thái received|processing|done|failed (audit 6.1)"
    WH = ("Ký webhook: PAYMENT_WEBHOOK_SECRET (dev: dev-webhook-secret-change-me). Header x-sofin-signature: t=<unix giây>,v1=<hex HMAC-SHA256 của \"t.rawBody\">; gửi đúng raw body (không thêm/bớt khoảng trắng). "
          "Mẫu Node: const t=Math.floor(Date.now()/1000);const v1=crypto.createHmac('sha256',secret).update(`${t}.${raw}`).digest('hex'). Tạo intent pending bằng POST /api/courses/<id>/checkout (không confirm).")
    A(F, "Webhook payment.succeeded hợp lệ: 200, WebhookEvent lưu type + payload + status 'done' + attempts 1", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + WH,
      ["U checkout 'ux' hoặc 'ai' -> P (pending)", "POST /api/payments/webhook {\"id\":\"evt_status_1\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"<P>\",\"chargeId\":\"ch_status_1\"}}", "SQL: SELECT status,type,attempts,payload->'data'->>'paymentId' FROM \"WebhookEvent\" WHERE \"eventId\"='evt_status_1'"], "evt_status_1",
      "200 {received:true}; WebhookEvent: status='done', type='payment.succeeded', attempts=1, payload chứa paymentId; Payment succeeded + hóa đơn; user là thành viên.", pw="Không")
    A(F, "Gửi lại cùng event id khi đã 'done' -> 200 {duplicate:true}, không xử lý lần hai", "Chức năng", "Cao", BASE + " " + WH,
      ["Gửi lại đúng event 'evt_status_1' (ký lại timestamp mới)"], "duplicate", "200 {received:true, duplicate:true}; hóa đơn/gói không đổi; attempts vẫn 1.", pw="Không")
    A(F, "Chữ ký sai/thiếu/header rỗng -> 400 (không nêu chi tiết)", "Bảo mật", "Cao", BASE + " " + WH,
      ["POST webhook với v1 sai", "POST không có header x-sofin-signature", "POST với t cách hiện tại > 300 giây (cả quá khứ lẫn tương lai)", "POST với body bị sửa 1 ký tự sau khi ký"], "chữ ký lỗi",
      "Cả 4: 400 với thông báo chung (không tiết lộ lý do chính xác); không tạo WebhookEvent hoặc không xử lý.", pw="Một phần")
    A(F, "Chữ ký tính trên RAW bytes: JSON được định dạng lại (thêm khoảng trắng) -> 400", "Bảo mật", "Trung bình", BASE + " " + WH,
      ["Ký body '{\"id\":\"e1\",...}' rồi gửi body có thêm khoảng trắng/xuống dòng nhưng cùng header"], "re-serialized", "400 (rawBody chỉ bắt cho path /api/payments/webhook; thiếu rawBody -> fail-closed 400).", pw="Không")
    A(F, "Event đang 'processing' còn mới (<2 phút) -> duplicate:true (bên kia đang xử lý)", "Chức năng", "Trung bình", BASE + " " + SQLH + " " + WH,
      ["SQL: INSERT INTO \"WebhookEvent\"(\"eventId\",type,payload,status,attempts,\"processingAt\") VALUES ('evt_fresh_1','payment.succeeded','{\"id\":\"evt_fresh_1\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"khong-ton-tai\"}}'::jsonb,'processing',1,now())", "Gửi webhook evt_fresh_1"], "processing mới",
      "200 {duplicate:true}; không đổi gì.", pw="Không")
    A(F, "Event 'processing' quá hạn (process chết sau claim) -> được xử lý lại, attempts=2, 'done'", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + WH,
      ["U checkout 'ux' -> P; SQL chèn WebhookEvent 'evt_crash_1' status 'processing' attempts 1, \"processingAt\"=now()-interval '10 minutes', \"updatedAt\"=now()-interval '10 minutes', payload chứa paymentId=P", "Gửi lại webhook evt_crash_1"], "evt_crash_1",
      "200 KHÔNG có duplicate; Payment succeeded, U là thành viên; WebhookEvent status 'done' attempts=2. (Trước đây: duplicate vĩnh viễn - khách trả tiền mà không có quyền.)", pw="Không")
    A(F, "Event 'failed' được gửi lại thì xử lý lại (không bị coi là duplicate)", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + WH,
      ["Tạo WebhookEvent status 'failed', lastError 'boom', attempts 1 cho một intent pending", "Gửi lại cùng event"], "failed -> resend", "200; xử lý thành công; status 'done'; attempts tăng.", pw="Không")
    A(F, "Lỗi trong handler: event chuyển 'failed' + lastError (không xóa, không duplicate mãi mãi) (unit test)", "Chức năng", "Cao", "Cài backend; Postgres local.",
      ["Chạy test 'webhook lỗi xử lý => failed + lastError' trong tests/money-lifecycle.test.ts"], "findById ném 'db down'", "Test pass: status 'failed', lastError khớp /db down/; gửi lại không phải duplicate.", pw="Không")
    A(F, "reapStaleWebhooks: job replay event failed/processing quá hạn từ payload", "Tích hợp", "Cao", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U checkout 'ux' -> P; chèn WebhookEvent 'failed' (attempts 1, updatedAt cách đây 1 phút) với payload payment.succeeded cho P", "Chờ job payments.reconcile"], "failed event",
      "Sau job: event 'done'; Payment succeeded; U là thành viên (replay từ payload, không cần cổng gửi lại).", pw="Không")
    A(F, "Replay tối đa 8 lần: event vượt giới hạn không bị replay vô hạn", "Chức năng", "Thấp", BASE + " " + SQLH + " " + JOB,
      ["Chèn WebhookEvent 'failed' attempts=8", "Chờ 2 lượt job", "SELECT status,attempts"], "attempts=8", "Event vẫn 'failed', attempts không tăng (đã hết lượt replay) - cần điều tra thủ công qua lastError/payload.", pw="Không")
    A(F, "Loại lạ hoặc đối tượng không tồn tại -> 200 {ignored:true} (cổng khỏi retry vô hạn)", "Chức năng", "Trung bình", BASE + " " + WH,
      ["Gửi type 'foo.bar'", "Gửi payment.succeeded với paymentId không có"], "ignored", "Cả hai 200 {received:true, ignored:true}.", pw="Không")
    A(F, "payment.succeeded cho giao dịch đã succeeded: idempotent, không cấp hóa đơn/gói hai lần", "Chức năng", "Cao", BASE + " " + USER + " " + WH,
      ["U mua 'ai' bằng confirm", "Gửi webhook payment.succeeded cho chính payment đó (event id mới)"], "đã succeeded", "200; không thêm Payment/hóa đơn/Subscription; không lỗi.", pw="Không")
    A(F, "Các loại sự kiện: payment.failed, payment.refunded, subscription.renewed, subscription.canceled", "Chức năng", "Trung bình", BASE + " " + USER + " " + WH,
      ["Với các Payment/Subscription tương ứng, gửi từng loại với data.paymentId / data.subscriptionId", "Kiểm tra trạng thái sau mỗi event"], "5 loại event",
      "payment.failed: Payment 'failed'. payment.refunded: Payment 'refunded' (quyền theo luật hoàn). subscription.renewed: kỳ tiến + cấp lại quyền. subscription.canceled: gói hủy. Mỗi event lưu WebhookEvent 'done'.", pw="Không")
    A(F, "Webhook không chịu global rate limit (nguồn tin cậy chữ ký riêng)", "Chức năng", "Thấp", BASE + " " + WH,
      ["Gửi 30 webhook liên tiếp trong 1 phút (event id khác nhau)"], "30 request", "Không có 429 (globalRateLimit bỏ qua /payments/webhook).", pw="Không")

    # ============================================================ 8. ĐỐI SOÁT + KHÓA (audit 6.1)
    F = "Đối soát & thứ tự khóa (audit 6.1)"
    A(F, "Charge thành công nhưng settle lỗi: gatewayChargeId lưu trước; reconcileUnsettledCharges hoàn tất (unit test)", "Tích hợp", "Cao", "Cài backend; Postgres local.",
      ["Chạy test 'cổng đã trừ tiền nhưng settle lỗi' trong tests/money-lifecycle.test.ts"], "settle ném lỗi lần đầu",
      "Test pass: Payment 'pending' nhưng có gatewayChargeId (truy vết được); chargedTotal=700; sau reconcileUnsettledCharges({olderThanMs:0}) -> settled=1, Payment succeeded + invoice, user là thành viên, KHÔNG trừ thêm.", pw="Không")
    A(F, "Job reconcileMoney gom 4 việc: hoàn tiền kẹt, charge chưa settle, khoản trừ trùng chưa hoàn, webhook kẹt", "Tích hợp", "Cao", BASE + " " + SQLH + " " + JOB,
      ["Tạo lần lượt: RefundRequest refunding cũ; Payment pending có gatewayChargeId cũ; Payment failed duplicate_charge refundedCents=0 có gatewayChargeId; WebhookEvent failed", "Chờ 1-2 lượt job payments.reconcile", "Kiểm tra từng dòng"], "4 trạng thái kẹt",
      "Cả 4 được chốt: RefundRequest approved; Payment succeeded; khoản trừ trùng được hoàn (refundedCents=amount); WebhookEvent done. Log scheduler không lỗi.", pw="Không")
    A(F, "Stress: confirm (trial->trả phí) song song processDueSubscriptions trên cùng gói - không deadlock 40P01 (unit test)", "Hiệu năng", "Cao", "Cài backend; Postgres local.",
      ["Chạy test 'stress: confirm (dùng thử -> trả phí) song song với processDueSubscriptions' trong tests/money-lifecycle.test.ts", "Đọc log: không có '40P01' hay 'deadlock'"], "6 user x confirm + 2 job",
      "Test pass: không lỗi 500; mỗi user <=1 gói sống và <=1 giao dịch initial succeeded; số hóa đơn không trùng. Lỗi cho phép duy nhất là 409/403.", pw="Không")
    A(F, "Thứ tự khóa thống nhất: advisory -> Subscription -> Payment -> Subscription/Enrollment -> InvoiceSequence (cuối)", "Tích hợp", "Trung bình", "Đọc backend/docs/api/payments.md mục P1 và payments.service.ts settle/recordRenewal.",
      ["So sánh thứ tự khóa trong settle() và recordRenewal()", "Kiểm tra scheduler dùng FOR UPDATE SKIP LOCKED"], "code review", "Cả hai đường lấy khóa theo cùng thứ tự, cấp số hóa đơn ngay trước COMMIT; scheduler SKIP LOCKED nên không chờ settle. Không còn chu trình chờ ngược chiều.", pw="Không")
    A(F, "Hóa đơn gap-free: rollback trả lại số (không nhảy số)", "Chức năng", "Trung bình", "Cài backend; tests/payments.test.ts.",
      ["Chạy test về InvoiceSequence rollback (payments.test.ts, mục hóa đơn gap-free)"], "rollback", "Pass: số hóa đơn liên tiếp, giao dịch rollback không để lại hở.", pw="Không")
    A(F, "Thông báo giao dịch chỉ phát SAU commit (rollback không có thông báo ma)", "Chức năng", "Trung bình", BASE + " " + USER,
      ["Mua gói thành công, quan sát thứ tự: thông báo xuất hiện sau khi Payment 'succeeded' đã nhìn thấy trong DB", "Đọc payments.service.ts later()/inTx"], "after-commit", "Thông báo 'Thanh toán thành công' chỉ tạo khi transaction đã commit; tx lỗi thì không có thông báo.", pw="Không")
    A(F, "HIỆN TẠI: gia hạn vẫn gọi cổng bên TRONG transaction của từng gói (giữ khóa hàng trong lúc gọi cổng)", "Hiệu năng", "Thấp", "Đọc payments.md mục 'Giới hạn hiện tại'.",
      ["Đọc dòng 'Scheduler chỉ tiến 1 kỳ mỗi lần chạy...'"], "renewal", "HIỆN TẠI: lời gọi cổng của gia hạn nằm trong transaction (timeout 15s) - khác luồng hoàn tiền đã tách ngoài transaction. Rủi ro khi cổng thật chậm; ghi nhận để bước cổng thật xử lý.", pw="Không", st=PLAN)

    # ============================================================ 9. GIAO DIỆN TIỀN (money-ui-update)
    F = "Giao diện: Doanh thu & rút tiền (RevenuePage)"
    SQL10 = "Đã dựng kịch bản S1 (cộng đồng $10, 4 giao dịch, lùi 60 ngày). Đăng nhập FE bằng Owner của cộng đồng đó; trang /communities/<id>/revenue-dashboard."
    A(F, "Các thẻ số liệu: Có thể rút ngay / Đang giữ / Quỹ dự phòng / MRR / Đang chờ rút xuất hiện đúng nhãn và số", "Giao diện", "Cao", BASE + " " + C10 + " " + SQL10,
      ["Mở trang doanh thu", "Đọc từng thẻ", "Đối chiếu với GET /api/courses/<id>/revenue"], "S1 sau holding",
      "Thẻ 'Có thể rút ngay' = 3028¢ (gợi ý 'toàn thời gian'); 'Quỹ dự phòng' = 336¢ (gợi ý 'giữ lại 10%'); 'Đang giữ (chờ hoàn tiền/tranh chấp)' = 0¢ (gợi ý 'rút được sau 14 ngày'); 'Tổng thu (gross)' 4000¢; 'Thực nhận (net)' 3364¢; có MRR và 'Đang chờ rút'.", pw="Có")
    A(F, "Thẻ 'Đang giữ' hiển thị tiền mới thu (chưa qua 14 ngày)", "Giao diện", "Cao", BASE + " " + C10,
      ["Chỉ có 4 giao dịch vừa mua (chưa lùi ngày)", "Mở trang doanh thu Owner"], "4 x $10 mới", "'Có thể rút ngay' = 0; 'Đang giữ' = 3364¢; 'Quỹ dự phòng' = 0; nút gửi yêu cầu rút bị vô hiệu (available <= 0).", pw="Có")
    A(F, "Đoạn chính sách rút tiền lấy từ payoutPolicy", "Giao diện", "Cao", BASE + " " + tok("owner@sofinhub.test"),
      ["Mở /communities/paid-demo/revenue-dashboard (owner@)", "Đọc đoạn nền xám phía dưới thẻ số"], "payoutPolicy",
      "Văn bản: 'Chính sách rút tiền: tiền mới thu chỉ rút được sau 14 ngày (cửa sổ hoàn tiền 7 ngày + tranh chấp 7 ngày), và luôn giữ lại 10% làm quỹ dự phòng.' (số lấy từ API, đổi theo Cài đặt chung).", pw="Có")
    A(F, "Ghi chú giá trị TẠM: hoa hồng 10%, phí cổng 2,9% + 30¢ hiển thị kèm chú thích", "Giao diện", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["Mở trang doanh thu", "Đọc thẻ 'Hoa hồng nền tảng*', 'Phí cổng thanh toán*' và dải chú thích vàng"], "assumptions",
      "Thẻ ghi 'tạm tính 10%' và '2.9% + $0.30'; dải vàng bắt đầu bằng '* ' và nêu 'giá trị TẠM/mô phỏng', 'Số dư có thể rút không phụ thuộc bộ lọc ngày'.", pw="Có")
    A(F, "Cảnh báo nợ: khối đỏ role=alert + khóa form rút khi debtCents > 0", "Giao diện", "Cao", BASE + " " + C10 + " Đã dựng S1 tới sau hoàn tiền (debt 3264).",
      ["Mở trang doanh thu Owner", "Đọc khối cảnh báo", "Thử gõ vào ô số tiền và bấm gửi"], "debt 3264",
      "Hiện khối đỏ 'Bạn đang còn nợ $32.64 do hoàn tiền/chargeback sau khi đã rút. Tính năng rút tiền tạm khóa cho đến khi doanh thu mới bù trừ khoản nợ này.'; ô 'Số tiền' bị disabled; nút 'Gửi yêu cầu rút tiền' disabled; nếu cố submit: 'Số dư ròng đang âm do hoàn tiền sau khi đã rút — chưa thể rút thêm cho đến khi nợ được bù trừ.'", pw="Có")
    A(F, "Validate phía client: số tiền > có thể rút và số tài khoản không 6-20 chữ số", "Giao diện", "Trung bình", BASE + " " + C10 + " " + SQL10,
      ["Nhập số tiền 31 (> $30.28) + TK 0123456789 + ngân hàng + chủ TK, gửi", "Nhập số tiền 10 + TK 12ab, gửi"], "validate",
      "Lần 1: 'Số tiền vượt quá số dư có thể rút ($30.28).'; Lần 2: 'Số tài khoản phải gồm 6–20 chữ số.' Không có request tới BE.", pw="Có")
    A(F, "Gửi yêu cầu rút hợp lệ: thông báo thành công, lệnh xuất hiện 'Đã yêu cầu', số 'Có thể rút ngay' giảm", "Giao diện", "Cao", BASE + " " + C10 + " " + SQL10,
      ["Nhập 20 USD, Vietcombank, 0123456789, NGUYEN VAN A, gửi", "Quan sát thông báo, bảng 'Lệnh rút tiền', thẻ số"], "20$ trong 30,28$",
      "Hiện 'Đã gửi yêu cầu rút tiền, chờ quản trị viên nền tảng duyệt.'; bảng có dòng $20.00 'Đã yêu cầu' tài khoản 'Vietcombank · ****6789'; 'Có thể rút ngay' còn $10.28; 'Đang chờ rút' $20.00.", pw="Có")
    A(F, "Map mã lỗi server: PAYOUT_BLOCKED và COMMUNITY_LOCKED có thông điệp tiếng Việt riêng", "Giao diện", "Trung bình", BASE + " " + C10,
      ["Khi cộng đồng bị khóa (admin lock) mở trang doanh thu Owner/gửi yêu cầu rút", "Khi còn nợ gửi yêu cầu (bỏ disabled bằng DevTools)"], "COMMUNITY_LOCKED / PAYOUT_BLOCKED",
      "COMMUNITY_LOCKED: 'Cộng đồng đang bị khóa nên không thể rút tiền.'; PAYOUT_BLOCKED: 'Số dư ròng đang âm do hoàn tiền sau khi đã rút — chưa thể rút thêm cho đến khi nợ được bù trừ.'", pw="Một phần")
    A(F, "Nhãn trạng thái lệnh rút: Đã yêu cầu/Đã duyệt/Đã chi trả/Bị từ chối/Thất bại/Tạm giữ", "Giao diện", "Thấp", BASE + " " + tok("owner@sofinhub.test") + " Seed paid-demo có payout 'requested' và 'paid'.",
      ["Mở trang doanh thu paid-demo, đọc bảng 'Lệnh rút tiền'", "Admin đổi 1 lệnh sang approve/reject/mark_paid rồi tải lại"], "PAYOUT_LABEL", "Nhãn đúng: requested='Đã yêu cầu', approved='Đã duyệt', paid='Đã chi trả', rejected='Bị từ chối', failed='Thất bại', on_hold='Tạm giữ'; ghi chú admin hiện dưới dạng 'Ghi chú: ...'.", pw="Có")
    A(F, "Người không phải Owner mở trang doanh thu: thông báo 403 thân thiện", "Giao diện", "Trung bình", BASE + " " + tok("cadmin@sofinhub.test"),
      ["Đăng nhập cadmin@ (admin cộng đồng) trên FE", "Mở /communities/paid-demo/revenue-dashboard"], "403", "Hiện 'Chỉ chủ cộng đồng (hoặc quản trị viên nền tảng) mới xem được doanh thu.'; không có số liệu.", pw="Có")
    A(F, "Lọc theo ngày không đổi 'Có thể rút ngay'; Xóa lọc đưa về toàn thời gian", "Giao diện", "Thấp", BASE + " " + tok("owner@sofinhub.test"),
      ["Chọn Từ ngày - Đến ngày hẹp", "Quan sát các thẻ", "Bấm 'Xóa lọc'"], "range", "Tổng thu/net đổi theo khoảng; 'Có thể rút ngay', 'Đang giữ', 'Quỹ dự phòng' giữ nguyên; 'Xóa lọc' trả lại số toàn thời gian.", pw="Có")

    F = "Giao diện: Admin Thanh toán (số dư creator)"
    A(F, "Admin > Thanh toán > Doanh thu creator: KPI và cột 'Có thể rút / Đang giữ / Dự phòng / Nợ'", "Giao diện", "Cao", BASE + " " + ADMIN + " Đăng nhập FE bằng admin@.",
      ["Mở /admin/payments/creator", "Đọc dải KPI và các cột bảng", "Đối chiếu với GET /api/admin/payments/creators"], "creator revenue",
      "KPI: Creator, Doanh thu gộp, Phí nền tảng, Thu nhập thuần, Số dư chờ, Có thể rút, Đang giữ (holding), Quỹ dự phòng, Nợ creator (đỏ khi > 0). Bảng có cột: Creator, Cộng đồng, Doanh thu gộp, Hoàn tiền, Phí nền tảng, Thu nhập thuần, Số dư chờ, Có thể rút, Đang giữ, Dự phòng, Nợ (đỏ khi > 0).", pw="Có")
    A(F, "Trang chi tiết creator có KPI số dư + bảng cộng đồng với cột số dư mới", "Giao diện", "Trung bình", BASE + " " + ADMIN,
      ["Từ danh sách creator mở chi tiết owner@", "Đọc KPI và bảng cộng đồng"], "creator detail", "KPI thêm 'Có thể rút', 'Đang giữ (holding)', 'Quỹ dự phòng', 'Nợ creator'; bảng cộng đồng có 'Có thể rút', 'Đang giữ', 'Dự phòng', 'Nợ'.", pw="Có")
    A(F, "Chi trả > chi tiết lệnh rút: khối 'Số dư creator' tách net-đã yêu cầu và số có thể rút", "Giao diện", "Cao", BASE + " " + ADMIN + " Seed có payout 'requested' của owner@.",
      ["Mở /admin/payments/payouts, mở chi tiết payout đang chờ", "Đọc khối 'Số dư creator'"], "payout detail",
      "Có dòng: Thu nhập thuần; Đã yêu cầu rút; 'Net − đã yêu cầu' (availableCents nghĩa cũ); 'Có thể rút ngay'; 'Đang giữ (14 ngày)'; 'Quỹ dự phòng'; 'Nợ (hoàn tiền sau khi rút)'.", pw="Có")
    A(F, "Admin duyệt payout vẫn qua legacy PATCH /admin/payouts/:id (approve/mark_paid/reject)", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["PATCH /api/admin/payouts/<id> {\"action\":\"approve\"}", "mark_paid", "reject một lệnh khác"], "legacy payouts", "Mỗi lần 200 và Owner nhận thông báo (type system); trạng thái đổi đúng; mark_paid chỉ đổi trạng thái DB (không chuyển tiền thật).", pw="Có")
    A(F, "Tài liệu: payments.md/API.md nêu rõ 'Có thể rút' = trừ reserve + holding và các biến tạm", "Giao diện", "Thấp", "Mở backend/docs/api/payments.md mục 'Vòng đời tiền' và backend/docs/API.md mục 'Quyết định nghiệp vụ CHƯA CHỐT'.",
      ["Đối chiếu công thức withdrawable với code balanceView", "Đối chiếu danh sách 5 giá trị tạm"], "tài liệu", "Khớp code: eligible/reserve/withdrawable/debt; liệt kê giá trị tạm 7 ngày + 7 ngày + 10% + $50 + hoa hồng 10%. Lưu ý lệch nhỏ: admin-batch2.md mô tả refunds summary chưa nhắc 'refunding'.", pw="Không")
    A(F, "Quyết định chưa chốt ảnh hưởng tiền (nhắc chủ dự án): hoa hồng, cửa sổ hoàn tiền, ngưỡng rút, cổng, kick/ban có hoàn tiền không", "Chức năng", "Thấp", "Mở docs/OPEN_DECISIONS.md mục A.", ["Đọc A1-A5, A8-A10"], "OPEN_DECISIONS",
      PENDING + " Tất cả số dùng ở nhóm này là giá trị tạm. Lệch tài liệu cần lưu ý: A8 ghi 'khi cộng đồng bị tạm ngưng/xóa: gói không làm gì' nhưng bước 2 đã hủy/ngừng gia hạn; A10 ghi 'cấm không gỡ ghi danh' nhưng code ban() gỡ Enrollment (gỡ cấm trả quyền nếu gói còn hạn). Cần cập nhật OPEN_DECISIONS.", pw="Không", st=PLAN)

    # ============================================================ 10. MA TRẬN ENDPOINT x TRẠNG THÁI CỘNG ĐỒNG (sinh bằng vòng lặp)
    F = "Ma trận endpoint tiền x trạng thái cộng đồng/người dùng"
    STATES = [
        ("cộng đồng bị khóa (locked)", "POST /api/admin/courses/<id>/lock {reason}",
         [("checkout", "403 COMMUNITY_LOCKED"), ("trial", "403 COMMUNITY_LOCKED"), ("confirm intent pending cũ", "403 COMMUNITY_LOCKED"), ("admin retry thanh toán (adminRetryPayment)", "403 COMMUNITY_LOCKED"),
          ("GET revenue (Owner)", "403"), ("POST payouts (Owner)", "403 COMMUNITY_LOCKED"), ("thành viên đọc bài viết/lớp học", "403 COMMUNITY_LOCKED"), ("gia hạn bởi scheduler", "bỏ qua (không trừ tiền); gói được đặt hủy cuối kỳ khi bị khóa")]),
        ("cộng đồng tạm ngưng (moderationStatus=suspended, Admin console)", "Admin > Cộng đồng > Tạm ngưng",
         [("checkout", "403 COMMUNITY_LOCKED (đình chỉ kiểm duyệt được tính như khóa)"), ("gia hạn bởi scheduler", "bỏ qua, gói được đặt hủy cuối kỳ (endAllForCommunity mode stop)")]),
        ("cộng đồng đã xóa mềm (deletedAt)", "DELETE /api/courses/<id> (Owner/Platform Admin)",
         [("checkout / trial", "404"), ("gia hạn bởi scheduler", "lấy ra để KẾT THÚC gói (canceled), không trừ tiền")]),
        ("cộng đồng riêng tư, chưa có join request approved", "người dùng mới chưa xin vào",
         [("checkout", "403 JOIN_REQUEST_REQUIRED"), ("trial", "403 JOIN_REQUEST_REQUIRED"), ("accept invite (có phí)", "402 PAYMENT_REQUIRED + ghi join request approved"), ("enroll toggle", "403 JOIN_REQUEST_REQUIRED")]),
        ("người dùng bị cấm (CommunityBan)", "POST /api/courses/<id>/members/<uid>/ban",
         [("checkout", "403"), ("trial", "403"), ("enroll toggle", "403 (bị cấm)"), ("gia hạn bởi scheduler", "gói canceled, không trừ tiền")]),
    ]
    for label, how, rows_ in STATES:
        A(F, f"Ma trận hành vi tiền khi {label}", "Chức năng", "Cao", BASE + " " + USER + " " + ADMIN + " Thiết lập trạng thái bằng: " + how + ".",
          [f"Đưa cộng đồng/người dùng vào trạng thái '{label}'"] + [f"Gọi/Quan sát: {ep}" for ep, _ in rows_] + ["Ghi mã trạng thái + error.code từng bước"], label,
          "Kết quả theo thao tác: " + "; ".join(f"{ep} -> {ex}" for ep, ex in rows_) + ". Không có khoản trừ tiền nào phát sinh trong trạng thái này.", pw="Không")

    # ============================================================ 11. THÊM: ĐUA, HỦY, DÙNG THỬ, GIÁ
    F = "Đua nhau & vòng đời gói bổ sung"
    A(F, "Confirm và webhook payment.succeeded cùng lúc cho 1 intent: một hóa đơn, một gói", "Chức năng", "Cao", BASE + " " + USER + " " + WH,
      ["U checkout 'ai' -> P", "Cùng lúc: POST /api/payments/<P>/confirm và POST /api/payments/webhook payment.succeeded (paymentId=P)", "SQL: đếm Payment succeeded, Subscription, hóa đơn"], "confirm ∥ webhook",
      "Payment succeeded = 1; invoiceNumber 1; Subscription 1. Một trong hai có thể thấy 'đã xử lý' (409 hoặc duplicate) nhưng KHÔNG ném 500.", pw="Không")
    A(F, "Idempotency-Key gửi song song: bên thua (P2002) rollback rồi trả giao dịch của bên thắng", "Chức năng", "Trung bình", BASE + " " + USER,
      ["Bắn 2 checkout 'ai' song song với cùng header Idempotency-Key: kdup-1", "So sánh id"], "idempotency race", "Cả hai 201 cùng payment id; chỉ 1 dòng Payment và 1 dòng IdempotencyKey.", pw="Không")
    A(F, "Confirm sau khi người dùng bị cấm: 403, không trừ tiền", "Bảo mật", "Cao", BASE + " " + USER + " " + ADMIN,
      ["U checkout 'biz' (chưa confirm)", "admin@ ban U ở 'biz'", "U POST /api/payments/<P>/confirm"], "ban giữa chừng", "403 (bị cấm); Payment vẫn pending, không có charge.", pw="Một phần")
    A(F, "Hủy gói ngay (atPeriodEnd=false): gói 'canceled' và thu hồi quyền tức thì; atPeriodEnd=true: giữ quyền tới hết kỳ", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH,
      ["U mua 'data'; POST /api/courses/data/subscription/cancel {\"atPeriodEnd\":true} -> kiểm tra", "Resume", "POST cancel {\"atPeriodEnd\":false} -> kiểm tra quyền"], "cancel 2 kiểu",
      "atPeriodEnd=true: cancelAtPeriodEnd=true, vẫn là thành viên tới hết kỳ. atPeriodEnd=false: status 'canceled' ngay, mất quyền (GET posts 403).", pw="Có")
    A(F, "Dùng thử chỉ 1 lần/user/cộng đồng; trial lần hai -> 409; user đã có gói -> 409", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U POST /api/courses/yoga/trial -> 201", "U hủy gói rồi POST trial lần nữa", "U khác đã mua gói gọi trial"], "trial", "Lần hai 409 (đã dùng thử); người đã có gói/đã tham gia 409; cộng đồng miễn phí 400.", pw="Có")
    A(F, "Đổi giá cộng đồng không ảnh hưởng gói đang chạy (gói giữ priceCents lúc đăng ký)", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " " + JOB + " Owner mới của cộng đồng tự tạo $10.",
      ["U mua cộng đồng $10", "Owner PATCH /api/courses/<id> {\"priceUsd\":20}", "Ép đến hạn gia hạn, chờ job", "SQL: Payment renewal.amountCents"], "đổi giá 10 -> 20",
      "Renewal vẫn 1000¢ (priceCents của Subscription); người mua mới trả 2000¢. (Quyết định A: 'đổi giá có ảnh hưởng thuê bao hiện có không' vẫn mở.)", pw="Không")
    A(F, "GET /me/subscriptions có courseTitle + accessUntil; GET /me/payments phân trang <= 100", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/me/subscriptions", "GET /api/me/payments?page=1&limit=100", "GET /api/me/payments?limit=101"], "seed member1", "Subscription[] có courseTitle, accessUntil; payments {data,meta}; limit 101 -> 400.", pw="Có")
    A(F, "Hóa đơn: chủ giao dịch/Owner/Platform Admin xem được, người khác 403, chưa có hóa đơn 409", "Bảo mật", "Trung bình", BASE + " " + USER,
      ["U mua 'ai' -> P", "GET /api/payments/<P>/invoice bằng U, bằng người lạ, và với Payment pending"], "invoice", "U: 200 {invoiceNumber, items[], subtotalCents:700, refundedCents:0, totalCents:700}; người lạ: 403; pending: 409.", pw="Có")
    A(F, "Nhật ký admin ghi hành động hoàn tiền/chi trả (Audit log)", "Chức năng", "Thấp", BASE + " " + ADMIN,
      ["Thực hiện 1 hoàn tiền và 1 mark_paid ở case trước", "Mở /admin/system/audit (hoặc /admin/audit-logs) lọc theo hành động"], "audit", "Có dòng refund.approve / payout.* kèm actor admin và IP; hiển thị theo bản dịch nhãn (một số mã chưa dịch - OPEN_DECISIONS B14).", pw="Một phần")
    A(F, "Số dư owner tính bằng aggregate SQL, không tải giao dịch vào RAM (cộng đồng nhiều giao dịch)", "Hiệu năng", "Thấp", BASE + " " + SQLH + " Cộng đồng $10 với 2.000 Payment chèn bằng SQL (generate_series).",
      ["GET /api/courses/<id>/revenue, đo thời gian", "Theo dõi bộ nhớ process backend"], "2.000 giao dịch", "Phản hồi < ~1s, bộ nhớ không tăng theo số giao dịch (SUM/COUNT FILTER trong SQL); recentTransactions chỉ 20 dòng.", pw="Không")
    A(F, "Chu kỳ gói cấu hình được (SUBSCRIPTION_PERIOD_DAYS=30 mặc định) và dùng thử TRIAL_DAYS=7", "Chức năng", "Thấp", BASE + " " + ADMIN + " " + PENDING + " (Cài đặt chung).",
      ["Mua gói, đọc currentPeriodEnd - currentPeriodStart", "Đổi subscriptionPeriodDays=10 ở Cài đặt chung, mua gói mới"], "kỳ gói", "Mặc định 30 ngày; sau đổi: gói mới 10 ngày (gói cũ giữ nguyên).", pw="Một phần")
    A(F, "Thành viên minh họa (isDemo) không ảnh hưởng số dư thật khi lọc owner seed", "Chức năng", "Thấp", BASE + " " + tok("owner@sofinhub.test"),
      ["GET /api/courses/paid-demo/revenue", "So activePaidMembers với số Subscription active thật bằng SQL"], "paid-demo seed", "activePaidMembers = số gói 'active' không hủy-cuối-kỳ (seed: member1 + demo#3..#9 ...); trialingMembers = gói trialing; mrrCents = tổng priceCents của active không hủy.", pw="Không")
    A(F, "Quy trình reset dữ liệu tiền sau khi test (nhắc)", "Chức năng", "Thấp", "Sau khi chạy các case MUTATE của nhóm MONEY.",
      ["Đặt lại Cài đặt chung (Reset)", "Chạy npm run db:reset", "Khởi động lại backend (xóa cache cấu hình, hàng đợi thông báo)"], "dọn dẹp", "DB trở lại seed; Cài đặt chung về mặc định env (7 ngày, 7 ngày, 10%, $50).", pw="Không")

    # ============================================================ 12. BỔ SUNG: CỬA SỔ HOÀN TIỀN, PAYOUT, KỊCH BẢN SỐ DƯ
    F = "Bổ sung: cửa sổ hoàn tiền, payout, số dư"
    A(F, "Biên cửa sổ hoàn tiền 7 ngày: 6 ngày 23 giờ tự duyệt, 7 ngày 1 giờ phải chờ admin", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + PENDING + " cửa sổ 7 ngày.",
      ["U1 mua 'ai', SQL lùi Payment.createdAt/confirmedAt 6 ngày 23 giờ", "U1 refund-request", "U2 mua 'ai', lùi 7 ngày 1 giờ", "U2 refund-request"], "biên 7 ngày", "U1: 201 status 'approved' (auto=true); U2: 201 status 'pending' (auto=false) chờ Platform Admin.", pw="Không")
    A(F, "Cửa sổ hoàn tiền tính từ LẦN THANH TOÁN ĐẦU của gói, không phải kỳ gia hạn", "Chức năng", "Trung bình", BASE + " " + USER + " " + SQLH + " " + JOB,
      ["U mua 'ai' (initial), lùi initial 20 ngày, ép gia hạn để có renewal mới", "U refund-request cho renewal"], "renewal ngoài cửa sổ", "Yêu cầu hoàn tiền cho giao dịch renewal là 'pending' (mốc tính từ lần thanh toán đầu của gói, đã quá 7 ngày).", pw="Không")
    A(F, "Payout validate: thiếu/sai định dạng tài khoản ngân hàng -> 400; số tài khoản lưu dạng ****1234", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["POST /api/courses/paid-demo/payouts với method thiếu bankName", "accountNumber 'abc'", "amountCents âm/0/số thực", "Gửi hợp lệ (sau khi có số dư) rồi GET /api/courses/paid-demo/payouts"], "validate payout",
      "Các lỗi: 400 VALIDATION_ERROR; payout hợp lệ trả 201 với method.accountMasked '****<4 số cuối>' (không lưu số đầy đủ), status 'requested'.", pw="Có")
    A(F, "Owner nhận thông báo (type system) mỗi lần admin đổi trạng thái payout", "Chức năng", "Thấp", BASE + " " + ADMIN + " Có payout 'requested' của owner@ (seed).",
      ["admin@ PATCH /api/admin/payouts/<id> {action:'approve'} rồi 'mark_paid'", "GET /api/notifications của owner@"], "payout notify", "2 thông báo type system tương ứng (đã duyệt, đã chi trả); trạng thái payout trên /revenue-dashboard cập nhật 'Đã duyệt' -> 'Đã chi trả'.", pw="Có")
    A(F, "Nợ được bù hết nhưng vẫn chưa rút được vì reserve + payout đã yêu cầu (kịch bản S1 tiếp)", "Chức năng", "Trung bình", BASE + " " + C10 + " " + SQLH + " Sau S1 (debt 3264; payout 3028 đã chi).",
      ["4 người mua mới trả $10 và lùi 60 ngày (thêm 4 x 841 = 3364)", "GET revenue", "POST payouts amountCents=1000"], "bù nợ", "net = 3364 - 236 = 3128; total = 3128 - 3028 = 100 (debt 0 -> hết PAYOUT_BLOCKED); eligible=3128, reserve=312, withdrawable = max(0, min(3128-312-3028, 100)) = 0 => payout 1000: 400 PAYOUT_EXCEEDS_AVAILABLE (không còn PAYOUT_BLOCKED).", pw="Không")
    A(F, "Net âm của giao dịch hoàn luôn tính vào eligible ngay (kể cả khi tiền mới còn trong holding)", "Chức năng", "Thấp", BASE + " " + C10 + " " + SQLH,
      ["Có 2 giao dịch cũ (60 ngày) + payout; 1 giao dịch mới (chưa qua holding)", "Hoàn giao dịch cũ", "GET revenue"], "net âm", "Net âm (-59) cộng vào eligible ngay nên làm giảm withdrawable; tiền mới (841) vẫn 'Đang giữ' (heldCents=841) cho tới hết 14 ngày.", pw="Không")
    A(F, "Reserve làm tròn xuống: eligible 1682 -> reserve 168; eligible 3364 -> 336; eligible 841 -> 84", "Chức năng", "Thấp", BASE + " " + C10 + " " + SQLH,
      ["Tạo 1, 2, 4 giao dịch $10 đã qua holding lần lượt (eligible 841, 1682, 3364)", "GET revenue mỗi lần"], "floor(eligible x 10%)", "reserveCents lần lượt 84, 168, 336 (floor); availableBalanceCents = 757, 1514, 3028.", pw="Không")
    A(F, "Seed paid-demo sau migration: số dư owner hợp lý (giao dịch ~90 ngày đã qua holding, 1 payout requested + 1 paid)", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["GET /api/courses/paid-demo/revenue", "GET /api/courses/paid-demo/payouts"], "seed", "heldCents nhỏ (chỉ giao dịch < 14 ngày), reserveCents = floor(10% eligible), debtCents=0; 2 payout (requested + paid) trong danh sách; availableBalanceCents <= totalBalanceCents.", pw="Có")
    A(F, "Admin Chi trả: duyệt payout khi owner đang nợ vẫn hiển thị nợ ở chi tiết (không tự chặn mark_paid)", "Chức năng", "Thấp", BASE + " " + ADMIN,
      ["Dùng payout đã tạo trước khi nợ phát sinh (S1)", "Mở /admin/payments/payouts, chi tiết payout", "Đọc 'Nợ (hoàn tiền sau khi rút)'"], "payout + nợ", "Chi tiết hiện nợ > 0 để admin cân nhắc; hệ thống không tự đòi nợ (chỉ chặn payout mới) - 'Chưa có đòi nợ tự động' (payments.md).", pw="Có", st=PLAN)
    A(F, "Số tiền trong Admin Giao dịch: Creator nhận = amount - refunded - hoa hồng - phí cổng (hoàn đủ có thể âm)", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["Xem 1 giao dịch $7 thành công và 1 giao dịch hoàn đủ trong /admin/payments/tx", "Đối chiếu với công thức"], "creatorEarnings", "$7: 700-0-70-50 = 580; hoàn đủ: 700-700-0-50 = -50 (âm bằng -phí cổng) - đã biết (OPEN_DECISIONS B5), không phải lỗi mới.", pw="Có")
    A(F, "Quản lý gói trong Admin (Gói đăng ký): hủy/pause/resume không tạo gói trùng", "Chức năng", "Thấp", BASE + " " + ADMIN + " " + MUTATE,
      ["Admin > Thanh toán > Gói đăng ký: Hủy 1 gói, sau đó người dùng mua lại", "POST /admin/payments/subscriptions/<id>/resume cho gói đã hủy khi user đã có gói sống khác"], "subscription admin", "Mua lại tạo gói mới (gói cũ canceled); resume gói cũ khi đã có gói sống khác bị từ chối (unique index) thay vì tạo 2 gói sống.", pw="Một phần")
    A(F, "Thanh toán lỗi do cổng từ chối (MockGateway failFor) -> 402, Payment 'failed' (unit test)", "Tích hợp", "Trung bình", "Cài backend; tests/payments.test.ts.",
      ["Chạy test về thẻ bị từ chối (failFor) trong tests/payments.test.ts"], "failFor", "Pass: confirm trả 402; Payment failed + failureReason; không có Subscription/Enrollment.", pw="Không")
    A(F, "Tổng kiểm: chạy toàn bộ tests/money-lifecycle.test.ts", "Chức năng", "Cao", "Cài backend; Postgres local.",
      ["cd backend", "npx cross-env NODE_ENV=test node --import tsx --test tests/money-lifecycle.test.ts", "Đọc số test pass"], "money-lifecycle", "Toàn bộ test pass (3.1-3.5 và P1: charge-settle, webhook, deadlock). Mỗi kịch bản đã từng FAIL trên code cũ (11/14 test đầu).", pw="Không")

    # @@END@@
