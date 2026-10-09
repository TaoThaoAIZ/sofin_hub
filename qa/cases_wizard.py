# -*- coding: utf-8 -*-
"""Testcase 2 module mới (07/10/2026): WIZ (wizard 'Tạo cộng đồng' 5 bước) và ANN (gói năm + hộp thoại 'Chọn gói thành viên').
Nguồn sự thật: backend/docs/api/community-wizard.md (HỢP ĐỒNG CUỐI + mục 10 'Sai khác'), docs/features/community-wizard.md (route/component/gaps),
backend/docs/api/{communities,payments}.md, docs/OPEN_DECISIONS.md (A16), backend/tests/{community-wizard,annual-subscription}.test.ts (hành vi + số liệu chính xác),
backend/src/modules/{community-wizard,payments}/*, backend/prisma/seed/community-wizard.ts + communities-scenarios.ts (3 nháp của owner, 'annual-demo' $7/tháng $48/năm, danh mục mới),
frontend/src/{pages/CreateCommunityPage,pages/MyCommunitiesPage,pages/CheckoutPage,features/wizard/*,features/payments/components/JoinDialog,components/ui/CardFields,lib/card}.ts(x).
Thiết kế: mockup wizard (scratchpad create/template.html) + ảnh hộp thoại (images/3.png: XMAI - AI Heroes Club, $7/tháng, $48/năm, 'Tiết kiệm đến 43%', ngày 8/10, giá $48).
Thêm case mới = thêm `A(...)` CUỐI mỗi hàm load_* (giữ thứ tự để mã TC-WIZ-nnn / TC-ANN-nnn không đổi).

SỐ LIỆU CHÍNH XÁC (từ test BE):
- Slug: ^[a-z0-9]+(-[a-z0-9]+)*$, 3-40 ký tự; reserved gồm admin, sofinhub, drafts, me, login...; 'photo' đã có -> taken, suggestion photo-2 (hoặc photo-<n>).
- Tiêu đề wizard 3-30 ký tự (POST /communities một phát vẫn tới 80); mô tả 1-150; lời hứa <=100; lợi ích tối đa 6 mục x <=100; câu hỏi tối đa 3 x 3-200; nội quy tối đa 20 (tiêu đề 1-80, nội dung <=500).
- Giá thành viên USD: priceUsd 0..10000; priceAnnualUsd > 0 và <= 12 x giá tháng; savings = round((1 - năm/(12 x tháng)) x 100): $7/$48 -> 43%; $5/$50 -> 17%.
- Gói hosting owner (VND, MÔ PHỎNG): Khởi đầu 0đ phí giao dịch 10%; Chuyên nghiệp 299.000đ/tháng hoặc 2.990.000đ/năm (tiết kiệm 17%) phí 2,9%; dùng thử 14 ngày; nhắc trước 3 ngày. 'Hôm nay: 0đ'.
- Ước tính doanh thu (hoa hồng 10% + phí cổng 2,9% + 30¢ - GIÁ TRỊ TẠM): $7 -> net 580¢; $10 -> 841¢; $48 -> 4151¢ ($41,51); $100 x 10 thành viên -> gross 100.000¢, platform 10.000¢, gateway 3.200¢, net 86.800¢ (8.680¢/thành viên).
- Gói thành viên tháng 30 ngày / năm 365 ngày (payments.annualPeriodDays); dùng thử thành viên 7 ngày (payments.trialDays); nhắc 3 ngày (payments.trialReminderDays); MRR gói năm = giá/12 ($48 -> 400¢; $7 -> 700¢; cộng 1.100¢).
- Thẻ test: 4242 4242 4242 4242 (Visa), 5555 5555 5555 4444 (Mastercard), 3782 822463 10005 (Amex 15 số, CVC 4 số), 6011 1111 1111 1117 (Discover), 3530 1113 3330 0000 (JCB). Token cổng giả lập tok_mock_declined chỉ gửi được bằng API (FE luôn tạo tok_mock_<hex ngẫu nhiên>).
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"
DEC = "[PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev), frontend :5173; "
        "xem sheet 'Tài khoản & dữ liệu test' mục A9 (dữ liệu seed wizard + gói năm).")
MUTATE = ("Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset (db:seed là create-only, KHÔNG hoàn tác); "
          "hoặc chỉ dùng người dùng/cộng đồng do chính case tạo ra.")
GSRESET = "Đặt lại cấu hình: POST /api/admin/system/settings/reset {\"keys\":[<khóa đã đổi>]} bằng token admin, hoặc npm run db:reset."
NEWU = ("Người dùng MỚI (đăng ký ở /register hoặc POST /api/auth/register {firstName,lastName,email,password:'Passw0rd!x'}) - nên dùng tài khoản mới mỗi lần chạy "
        "vì mỗi owner chỉ được 5 bản nháp (409 DRAFT_LIMIT).")
OWNER_UI = ("Đăng nhập UI owner@sofinhub.test / Passw0rd!x - owner có sẵn 3 bản nháp seed: 'Lớp Gốm Cuối Tuần' (id draft-gom-cuoi-tuan, 1/4 bước, nextStep=plan), "
            "'Chạy Bộ 5K Cho Người Mới' (draft-chay-bo-5k, 3/4 bước, gói Chuyên nghiệp dùng thử + thẻ visa 4242, nextStep=members), "
            "'Viết Content Ra Đơn' (draft-viet-content, 4/4 bước, riêng tư $7/tháng + $48/năm, 2 câu hỏi, 2 nội quy, payout Vietcombank ****8812, nextStep=launch).")


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}} -> data.accessToken, gửi header Authorization: Bearer <token>."


def load(add):
    load_wiz(add)
    load_wiz_more(add)
    load_ann(add)
    load_ann_more(add)


# ====================================================================================================================
#                                                  MODULE WIZ
# ====================================================================================================================
def load_wiz(add):
    M, MN = "WIZ", "Tạo cộng đồng (wizard 5 bước)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    UI = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó."
    UIM = UI + " " + MUTATE
    API = BASE + " " + NEWU + " " + "Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE

    # ------------------------------------------------------------------------------------------------ 1. TRUY CẬP & KHUNG
    F = "Truy cập & khung wizard"
    A(F, "Khách mở /communities/new bị chuyển tới /login và sau khi đăng nhập quay lại đúng /communities/new", "Chức năng", "Cao", BASE + " Chưa đăng nhập.",
      ["Mở http://localhost:5173/communities/new khi chưa đăng nhập", "Quan sát URL", "Đăng nhập member1@sofinhub.test / " + PW], "/communities/new",
      "Trang bọc RequireAuth: chuyển sang /login (không lộ form wizard); đăng nhập xong quay lại đúng /communities/new và hiện bước 1 'Cộng đồng của bạn tên là gì?'.")
    A(F, "Khách mở /communities/new?draft=<id> bị chuyển /login và quay lại giữ nguyên ?draft=<id>", "Chức năng", "Trung bình", BASE + " Chưa đăng nhập. " + OWNER_UI,
      ["Mở /communities/new?draft=draft-gom-cuoi-tuan khi chưa đăng nhập", "Đăng nhập owner@sofinhub.test"], "?draft=draft-gom-cuoi-tuan",
      "Sau đăng nhập URL vẫn là /communities/new?draft=draft-gom-cuoi-tuan (docs/features/community-wizard.md: kể cả ?draft=) và wizard mở lại đúng bản nháp, nhảy tới bước 2 (nextStep=plan).")
    A(F, "Link 'Tạo cộng đồng' ở Header, Footer và trang chủ đều trỏ /communities/new", "Giao diện", "Thấp", BASE + " Đăng nhập member1@sofinhub.test.",
      ["Ở trang chủ bấm 'Tạo cộng đồng' trên Header", "Quay lại, bấm link cùng tên ở Footer và ở khu vực trang chủ (nếu có)", "Quan sát URL"], "-",
      "Cả ba vị trí đều dẫn tới /communities/new (không còn trang tạo cũ).")
    A(F, "Khung wizard: sidebar 'Tạo cộng đồng' + 5 bước đúng nhãn, 'Bước n / 5' và thanh tiến độ 20%/40%/60%/80%/100%", "Giao diện", "Cao", UI,
      ["Mở /communities/new", "Lần lượt đi qua các bước (điền dữ liệu hợp lệ) và ghi lại nhãn bước đang chọn + dòng 'Bước n / 5' + độ rộng thanh"], "Nhãn: Thông tin cơ bản / Chọn gói & dùng thử / Nhận diện & giới thiệu / Thành viên & giá / Ra mắt",
      "Stepper dọc có 5 nhãn đúng như trên, bước hiện tại tô nền cam (aria-current=step), bước đã qua hiện dấu ✓. Dòng 'Bước n / 5' đúng; thanh tiến độ rộng 20% rồi 40%, 60%, 80%, 100%.")
    A(F, "Tiêu đề lớn và câu dẫn đổi theo từng bước (5 tiêu đề)", "Giao diện", "Thấp", UI,
      ["Đi qua 5 bước và đọc tiêu đề h1 + dòng dẫn"], "-",
      "B1 'Cộng đồng của bạn tên là gì?'; B2 'Dùng thử 14 ngày, chưa trừ đồng nào' (số ngày lấy từ /owner-plans); B3 'Để người lạ hiểu ngay vì sao nên tham gia'; B4 'Ai được vào, và vào với giá bao nhiêu?'; B5 'Sẵn sàng ra mắt!'. Phần nhấn màu cam đúng cụm.")
    A(F, "Hộp mẹo bên trái đổi theo bước (Khoảng 10 phút / Đổi gói bất cứ lúc nào / Trang giới thiệu = trang bán hàng / Mẹo đặt giá / Sắp xong rồi)", "Giao diện", "Thấp", UI,
      ["Đi qua 5 bước, đọc hộp mẹo ở sidebar", "Thu hẹp cửa sổ < 1024px"], "-",
      "Hộp mẹo hiện đúng tiêu đề theo bước: B1 'Khoảng 10 phút', B2 'Đổi gói bất cứ lúc nào', B3 'Trang giới thiệu = trang bán hàng', B4 'Mẹo đặt giá', B5 'Sắp xong rồi'. Dưới lg hộp mẹo bị ẩn, stepper chuyển thành hàng ngang cuộn được.")
    A(F, "Stepper: bấm bước đã đi qua để quay lại, bước chưa tới bị vô hiệu hóa", "Chức năng", "Trung bình", UI,
      ["Hoàn tất bước 1 -> sang bước 2", "Bấm 'Thông tin cơ bản' ở stepper", "Thử bấm 'Ra mắt' khi mới ở bước 1-2"], "-",
      "Bước đã tới (<= furthest) bấm được và hiện lại dữ liệu đã nhập; bước chưa tới là nút disabled (không bấm nhảy cóc được).")
    A(F, "Nút 'Hủy' ở bước 1 về trang chủ; 'Quay lại' ở các bước sau giữ nguyên dữ liệu đã nhập", "Chức năng", "Trung bình", UI,
      ["Ở bước 1 điền tên rồi bấm 'Hủy'", "Mở lại, đi tới bước 3, nhập lời hứa, bấm 'Quay lại' rồi 'Tiếp tục'"], "-",
      "'Hủy' điều hướng '/' (không tạo nháp nếu chưa bấm Tiếp tục). 'Quay lại' từ bước 2 trở đi chỉ đổi bước, giá trị các ô được giữ.")
    A(F, "Màn hình hẹp (375px): stepper cuộn ngang, footer nút không tràn, không cuộn ngang trang", "Giao diện", "Thấp", UI,
      ["Đặt viewport 375x812", "Đi qua 5 bước"], "375x812", "Không có thanh cuộn ngang toàn trang; tiền tố 'sofinhub.com/' thu nhỏ; các nút Quay lại/Bỏ qua/Tiếp tục xuống dòng gọn, bấm được.")
    A(F, "/courses/new (đường dẫn cũ) chuyển tới wizard /communities/new", "Chức năng", "Thấp", BASE + " Đăng nhập member1@sofinhub.test.",
      ["Mở /courses/new"], "/courses/new",
      "LegacyCourseRedirect đổi /courses/ -> /communities/ nên URL thành /communities/new và mở wizard (docs ghi 'không có route riêng'; hành vi này suy ra từ code redirect).")
    for nm, did, idx, label in [("Lớp Gốm Cuối Tuần", "draft-gom-cuoi-tuan", 2, "B2 'Chọn gói & dùng thử'"), ("Chạy Bộ 5K Cho Người Mới", "draft-chay-bo-5k", 4, "B4 'Thành viên & giá'"),
                                ("Viết Content Ra Đơn", "draft-viet-content", 5, "B5 'Ra mắt' (màn tóm tắt)")]:
        A(F, f"Mở lại nháp seed '{nm}' (?draft=) nhảy đúng tới {label} và nạp dữ liệu đã lưu", "Chức năng", "Cao", BASE + " " + OWNER_UI,
          [f"Ở /me/communities bấm 'Tiếp tục tạo' của '{nm}' (hoặc mở /communities/new?draft={did})", "Quan sát bước hiện tại, các ô đã điền, stepper"], did,
          f"Wizard hiện 'Đang tải bản nháp…' rồi nhảy tới {label} theo nextStep của BE; các bước trước là ✓ và bấm quay lại được; dữ liệu các bước đã lưu được nạp lại đúng (tên, mô tả, danh mục, giá, câu hỏi, nội quy... theo seed).")
    A(F, "Mở ?draft= không tồn tại / của người khác / đã ra mắt hiện 'Không tìm thấy bản nháp' + link tạo mới", "Chức năng", "Trung bình", BASE + " Đăng nhập member1@sofinhub.test.",
      ["Mở /communities/new?draft=draft-gom-cuoi-tuan (nháp của owner, member1 không phải chủ)", "Mở /communities/new?draft=khong-co", "Bấm 'Tạo cộng đồng mới'"], "draft của người khác / không có",
      "Hiện 'Không tìm thấy bản nháp' + 'Bản nháp có thể đã được ra mắt hoặc đã bị xóa.'; không lộ dữ liệu nháp người khác (BE trả 404); link 'Tạo cộng đồng mới' -> /communities/new.")

    # ------------------------------------------------------------------------------------------------ 2. BƯỚC 1 - THÔNG TIN CƠ BẢN
    F = "Bước 1 - Thông tin cơ bản"
    A(F, "Bước 1 hiển thị đủ: Tên cộng đồng (n/30), Đường dẫn sofinhub.com/, Mô tả ngắn (n/150), Danh mục + xem trước 'Trên Khám phá'", "Giao diện", "Cao", UI,
      ["Mở /communities/new", "Đối chiếu từng ô với mockup (template.html)"], "-",
      "Có các ô: 'Tên cộng đồng' (placeholder 'Ví dụ: Lớp Gốm Cuối Tuần', hint 'Ví dụ hay: “Viết Content Ra Đơn”, “Chạy Bộ 5K Cho Người Mới”', bộ đếm 0/30), 'Đường dẫn' (tiền tố sofinhub.com/, placeholder ten-cong-dong, hint 'Đổi đường dẫn sau này sẽ làm hỏng các link cũ – nên chốt ngay từ đầu.'), 'Mô tả ngắn' (hint 'Hiện trên thẻ cộng đồng ở trang Khám phá', 0/150), 'Danh mục'. Cột phải 'Xem trước trên Khám phá'.")
    A(F, "Tên cộng đồng: bộ đếm n/30 và không gõ quá 30 ký tự (maxLength)", "Giao diện", "Cao", UI,
      ["Gõ 'Lớp Gốm Cuối Tuần' và quan sát bộ đếm", "Dán chuỗi 40 ký tự vào ô tên"], "40 ký tự",
      "Bộ đếm hiện '19/30' cho chuỗi 19 ký tự; ô chỉ giữ tối đa 30 ký tự (BE cũng từ chối 31: wizard giới hạn 30 trong khi POST /communities một phát tới 80).")
    A(F, "Tên cộng đồng để trống hoặc < 3 ký tự: viền đỏ + 'Tên cộng đồng tối thiểu 3 ký tự', không gọi API", "Chức năng", "Cao", UI,
      ["Để trống ô tên rồi bấm 'Tiếp tục'", "Gõ 'ab' rồi 'Tiếp tục'", "Mở tab Network"], "'' và 'ab'",
      "Hiện lỗi dưới ô 'Tên cộng đồng tối thiểu 3 ký tự', ô viền đỏ (aria-invalid), footer có 'Vui lòng kiểm tra các ô được đánh dấu đỏ.'; KHÔNG có POST /communities/drafts. Sửa ô thì lỗi tự xóa.")
    A(F, "Tên chỉ gồm khoảng trắng bị coi là trống (trim)", "Chức năng", "Thấp", UI, ["Gõ '     ' (5 dấu cách) vào ô tên", "Bấm 'Tiếp tục'"], "5 dấu cách", "Báo 'Tên cộng đồng tối thiểu 3 ký tự' (client trim trước khi kiểm tra); không tạo nháp.")
    A(F, "Đường dẫn tự sinh từ tên: bỏ dấu, đ->d, ký tự lạ thành '-' (Gốm Đẹp Cuối Tuần -> gom-dep-cuoi-tuan)", "Chức năng", "Cao", UI,
      ["Gõ tên 'Gốm Đẹp Cuối Tuần'", "Quan sát ô đường dẫn", "Gõ 'Đàn Ghi-ta & Piano!'"], "Gốm Đẹp Cuối Tuần",
      "Ô đường dẫn tự điền gom-dep-cuoi-tuan; tên thứ hai cho dan-ghi-ta-piano (không '-' đầu/cuối, cắt tối đa 40 ký tự). Mỗi lần đổi tên slug cập nhật theo.")
    A(F, "Sau khi tự sửa đường dẫn thì đổi tên KHÔNG ghi đè đường dẫn nữa (slugTouched)", "Chức năng", "Trung bình", UI,
      ["Gõ tên 'Lớp Gốm' -> slug lop-gom", "Sửa ô đường dẫn thành 'gom-vui'", "Đổi tên thành 'Lớp Gốm Mới'"], "-", "Đường dẫn giữ 'gom-vui' (không bị tên ghi đè).")
    A(F, "Ô đường dẫn tự chuẩn hóa khi gõ: chữ hoa -> thường, dấu cách -> '-', bỏ ký tự lạ, gộp '--', tối đa 40", "Chức năng", "Trung bình", UI,
      ["Gõ vào ô đường dẫn: 'Gốm  Đẹp_2026!'", "Gõ 'a--b'", "Dán chuỗi 60 ký tự"], "Gốm  Đẹp_2026!",
      "Chữ có dấu/ký tự ngoài a-z0-9- bị bỏ, khoảng trắng thành '-', '--' gộp thành '-', tối đa 40 ký tự; không bao giờ giữ chữ hoa.")
    A(F, "Kiểm tra đường dẫn trực tiếp (debounce 300ms): 'Đang kiểm tra' -> 'Còn trống' (xanh)", "Chức năng", "Cao", UI,
      ["Gõ slug mới chưa ai dùng (vd. gom-test-<số ngẫu nhiên>)", "Quan sát badge cuối ô và tab Network"], "slug mới",
      "Ngay khi gõ hiện 'Đang kiểm tra' (spinner); dừng gõ ~300ms mới gọi GET /api/communities/slug-available?slug=...; kết quả available=true -> badge xanh '✓ Còn trống'.", pw="Có")
    A(F, "Debounce slug: gõ liên tục 8 ký tự chỉ gửi 1 request cuối", "Hiệu năng", "Thấp", UI,
      ["Mở Network, lọc 'slug-available'", "Gõ nhanh 8 ký tự liên tiếp (<300ms mỗi phím)"], "8 ký tự", "Chỉ có 1 (tối đa 2) request slug-available cho giá trị cuối cùng, không gửi từng phím; slug < 3 ký tự không gọi API.")
    A(F, "Đường dẫn đã có người dùng (photo): badge 'Đã có người dùng' + lỗi kèm gợi ý", "Chức năng", "Cao", UI,
      ["Gõ đường dẫn 'photo'", "Chờ kiểm tra xong"], "photo",
      "Badge đỏ '✗ Đã có người dùng' và dòng lỗi 'Đường dẫn đã có người dùng Gợi ý: photo-2' (message BE + ' Gợi ý: <slug>', không có dấu chấm giữa hai câu); bấm Tiếp tục bị chặn bằng 'Đường dẫn này đã có người dùng'.")
    A(F, "Đường dẫn dành riêng (admin, sofinhub, drafts, me, login...) báo 'Không hợp lệ' với thông báo của BE", "Chức năng", "Trung bình", UI,
      ["Gõ lần lượt 'admin', 'sofinhub', 'drafts', 'login'"], "4 slug reserved", "Mỗi slug: badge '✗ Không hợp lệ' + dòng lỗi 'Đường dẫn này được hệ thống giữ lại, hãy chọn tên khác' (message BE, reason 'reserved'); không cho Tiếp tục.")
    A(F, "Đường dẫn < 3 ký tự: lỗi 'Đường dẫn tối thiểu 3 ký tự' ngay ở client, không gọi API", "Chức năng", "Trung bình", UI,
      ["Xóa ô đường dẫn, gõ 'ab'", "Bấm 'Tiếp tục'"], "ab", "Badge 'Không hợp lệ' với dòng 'Đường dẫn tối thiểu 3 ký tự'; Tiếp tục báo cùng lỗi; Network không có slug-available. Để trống: 'Vui lòng nhập đường dẫn'.")
    A(F, "Bấm 'Tiếp tục' khi đang kiểm tra slug: báo 'Đang kiểm tra đường dẫn, vui lòng đợi giây lát'", "Chức năng", "Thấp", UI,
      ["Throttle mạng chậm (Slow 3G)", "Gõ slug hợp lệ rồi bấm 'Tiếp tục' ngay"], "mạng chậm", "Hiện lỗi 'Đang kiểm tra đường dẫn, vui lòng đợi giây lát' dưới ô; không tạo nháp; sau khi kiểm tra xong bấm lại thì đi tiếp.", pw="Một phần")
    A(F, "Mô tả ngắn: bộ đếm n/150, giới hạn 150, bắt buộc 'Vui lòng nhập mô tả ngắn'", "Chức năng", "Cao", UI,
      ["Gõ mô tả 40 ký tự -> '40/150'", "Dán 200 ký tự", "Xóa trắng rồi 'Tiếp tục'"], "-", "Đếm đúng, ô giữ tối đa 150; để trống/dấu cách: lỗi 'Vui lòng nhập mô tả ngắn' (ô viền đỏ).")
    A(F, "Danh mục: radio một lựa chọn, chip đang chọn nền gradient + biểu tượng trắng; bắt buộc 'Vui lòng chọn danh mục'", "Chức năng", "Cao", UI,
      ["Không chọn danh mục, bấm 'Tiếp tục'", "Chọn 'Công nghệ' rồi chọn 'Sở thích'"], "-",
      "Chưa chọn: lỗi 'Vui lòng chọn danh mục'. Mỗi lúc chỉ MỘT chip được chọn (role=radio, aria-checked); chọn chip mới thì chip cũ bỏ chọn; lỗi tự xóa khi chọn.")
    A(F, "Danh sách danh mục lấy từ GET /categories: sau seed có 11 mục (8 cũ + Âm nhạc, Thể thao, Tâm linh)", "Chức năng", "Cao", UI + " Đã chạy npm run db:reset (seed community-wizard thêm 3 danh mục).",
      ["Ở bước 1 liệt kê các chip danh mục", "So với GET /api/categories và Admin > Khám phá > Danh mục"], "11 mục",
      "11 chip: Kinh doanh, Sáng tạo nội dung, Công nghệ, Tài chính, Sức khỏe, Phát triển bản thân, Sở thích, Mối quan hệ, Âm nhạc, Thể thao, Tâm linh. 'Tiếp thị' và 'Thiết kế' (marketing/design, enum có sẵn) chỉ hiện khi admin thêm. Lưu ý: docs/features ghi 'trả 8 danh mục' (đúng với DB test chưa seed) và mockup có thể kỳ vọng 13 -> xem case Kế hoạch về lệch 8/11/13.")
    A(F, "Xem trước 'Trên Khám phá' cập nhật trực tiếp: tên, mô tả, 'Giá đặt ở bước 4', '1 thành viên', chữ viết tắt logo", "Giao diện", "Trung bình", UI,
      ["Gõ tên 'Lớp Gốm', mô tả bất kỳ", "Quan sát khung 'Xem trước trên Khám phá'"], "Lớp Gốm",
      "Xem trước hiện tên, mô tả, '1 thành viên', nhãn giá 'Giá đặt ở bước 4' (chưa qua bước 4), chip 'Ảnh bìa ở bước 3', logo chữ cái 'LG'; trống thì hiện placeholder 'Tên cộng đồng' / 'Mô tả ngắn sẽ hiện ở đây.'")
    A(F, "Bấm 'Tiếp tục' bước 1 tạo bản nháp (POST /communities/drafts 201) và sang bước 2", "Tích hợp", "Cao", UI,
      ["Điền tên 'Lớp Gốm Cuối Tuần', slug mới, mô tả, danh mục 'Sở thích'", "Bấm 'Tiếp tục' (mở Network)"], "-",
      "Nút đổi 'Đang lưu…' rồi sang bước 2; Network có POST /api/communities/drafts body {title,description,category,slug} -> 201 DraftView (status 'draft', completedSteps ['basics'], nextStep 'plan'). Quay lại bước 1 sửa và Tiếp tục: dùng PATCH /communities/<id>/draft/steps/basics, KHÔNG tạo nháp thứ hai.")
    A(F, "Đổi slug ở nháp đã tạo: id đổi theo, các lần lưu sau dùng id mới và nháp cũ biến mất", "Tích hợp", "Cao", UIM,
      ["Tạo nháp ở bước 1 với slug 'gom-a-<số>'", "Quay lại bước 1, đổi slug thành 'gom-b-<số>', Tiếp tục", "Mở /me/communities"], "gom-a -> gom-b",
      "PATCH basics trả id mới 'gom-b-...'; các PATCH bước sau gọi /communities/gom-b-.../draft/steps/...; GET /communities/gom-a-.../draft = 404; /me/communities chỉ có MỘT nháp (gom-b).")
    A(F, "BE từ chối bước 1: lỗi theo ô được gắn đúng ô (title -> Tên, slug -> Đường dẫn) và wizard quay về bước chứa lỗi", "Chức năng", "Trung bình", UI,
      ["Gõ slug hợp lệ nhưng bị người khác chiếm trong lúc đang nhập (hoặc tạo nháp trùng từ tab khác)", "Bấm Tiếp tục"], "SLUG_TAKEN",
      "Hiện 'Đường dẫn này đã có người dùng' ở ô đường dẫn (map từ code SLUG_TAKEN); không chuyển bước; nếu lỗi ở bước khác (title/description) thì wizard tự nhảy về bước 1.", pw="Một phần")

    # ------------------------------------------------------------------------------------------------ 3. SLUG API
    F = "API kiểm tra đường dẫn (slug-available)"
    pre = API
    A(F, "GET /communities/slug-available: slug mới hợp lệ -> available=true, reason=null, message 'Còn trống'", "Tích hợp", "Cao", pre,
      ["GET /api/communities/slug-available?slug=gom-vui-<số ngẫu nhiên> (không cần token)"], "slug mới", "200 { data: { slug, available:true, reason:null, message:'Còn trống' } }, không có suggestion.", pw="Một phần")
    for slug, reason in [("ab", "too_short"), ("x" * 41, "too_long"), ("Có Dấu", "invalid_format"), ("-abc", "invalid_format"), ("a--b", "invalid_format"), ("abc-", "invalid_format")]:
        shown = slug if len(slug) < 20 else f"'x' x {len(slug)}"
        A(F, f"Slug '{shown}' -> reason '{reason}'", "Chức năng", "Trung bình", pre,
          [f"GET /api/communities/slug-available?slug={slug if len(slug) < 20 else 'x' * 41}"], shown,
          f"200 {{ available:false, reason:'{reason}', message tiếng Việt }}; không có suggestion. Định dạng ^[a-z0-9]+(-[a-z0-9]+)*$, 3-40 ký tự (kiểm tra độ dài trước định dạng).", pw="Không")
    A(F, "Slug dành riêng trả reason 'reserved' (admin, sofinhub, drafts, me, login, new, search, health...)", "Chức năng", "Trung bình", pre,
      ["Gọi lần lượt slug-available với admin, sofinhub, drafts, me, login, new, categories, owner-plans"], "8 slug reserved",
      "Mỗi slug trả available=false, reason='reserved' (danh sách RESERVED_SLUGS trong wizard.service.ts); slug hợp lệ gần giống như 'admin-vui' thì còn trống.", pw="Không")
    A(F, "Slug trùng cộng đồng có sẵn (photo) -> reason 'taken' + suggestion dạng photo-<n>", "Chức năng", "Cao", pre,
      ["GET /api/communities/slug-available?slug=photo"], "photo", "available=false, reason='taken', suggestion khớp /^photo-\\d+$/ (slug gần nhất còn trống, vd. photo-2).", pw="Không")
    A(F, "Slug của cộng đồng đã xóa mềm vẫn 'taken' (không dùng lại)", "Chức năng", "Thấp", pre + " Admin xóa mềm một cộng đồng (Admin > Cộng đồng > Xóa) - " + MUTATE,
      ["Xóa mềm một cộng đồng seed (vd. cộng đồng thử do bạn tạo)", "Gọi slug-available với slug đó"], "slug đã xóa mềm", "reason='taken' (tài liệu: trùng cả với cộng đồng đã xóa mềm).", pw="Không")
    A(F, "Nháp của người khác chiếm slug: người khác và khách thấy 'taken'; chính chủ nháp thấy 'còn trống'", "Bảo mật", "Cao", pre + " Hai người dùng A, B.",
      ["A tạo nháp slug S (POST /communities/drafts)", "GET slug-available?slug=S với token B, không token, và token A"], "slug của nháp",
      "B và khách: available=false reason='taken'; A: available=true (slug của chính nháp mình tính là còn trống). B tạo nháp cùng slug S -> 409 SLUG_TAKEN.", pw="Không")
    A(F, "slug-available thiếu tham số slug trả too_short (không 400)", "Chức năng", "Thấp", pre, ["GET /api/communities/slug-available (không query)"], "-", "200 với reason='too_short' (schema mặc định slug='').", pw="Không")
    A(F, "slug-available chuẩn hóa chữ hoa/khoảng trắng đầu cuối trước khi kiểm tra", "Chức năng", "Thấp", pre,
      ["GET slug-available?slug=%20GOM-VUI-9%20"], "' GOM-VUI-9 '", "Trả slug='gom-vui-9' (trim + lowercase), available theo slug đã chuẩn hóa.", pw="Không")

    # ------------------------------------------------------------------------------------------------ 4. BƯỚC 2 - GÓI HOSTING
    F = "Bước 2 - Gói chủ cộng đồng & dùng thử"
    A(F, "Bước 2 hiển thị 2 gói từ GET /owner-plans: Khởi đầu 0 ₫/tháng và Chuyên nghiệp 299.000 ₫/tháng, 'Phổ biến nhất' ở Chuyên nghiệp", "Giao diện", "Cao", UI,
      ["Hoàn tất bước 1, sang bước 2", "Đối chiếu với response /api/owner-plans"], "-",
      "Hai thẻ: 'Khởi đầu' (tagline 'Dành cho cộng đồng mới', 0 ₫ / tháng, 3 tính năng, nút 'Đã chọn' vì mặc định) và 'Chuyên nghiệp' (299.000 ₫ / tháng, huy hiệu 'Phổ biến nhất', nút 'Chọn gói này'). Cột thứ ba 'Gói nào lợi hơn?'. Tiền tệ gói owner là VND (khác USD của gói thành viên).")
    A(F, "Chuyển 'Theo năm': giá Chuyên nghiệp 2.990.000 ₫ / năm, huy hiệu xanh 'Tiết kiệm 17%'; Khởi đầu vẫn 0", "Giao diện", "Cao", UI,
      ["Ở bước 2 bấm tab 'Theo năm'", "Bấm lại 'Theo tháng'"], "17%",
      "Huy hiệu 'Tiết kiệm 17%' = savingsPct của chu kỳ annual từ BE (1 - 2.990.000/(12 x 299.000) làm tròn 17); giá đổi 2.990.000 ₫ / năm và về 299.000 ₫ / tháng khi quay lại. (Mockup ghi 'Theo năm - tặng 2 tháng' ở BE, FE chỉ hiện 'Theo năm'.)")
    A(F, "Chọn 'Chuyên nghiệp' hiện form thẻ + khối xanh 'Hôm nay: 0 ₫. Thử miễn phí 14 ngày tới <dd/M>. Hủy trước ngày đó, bạn không mất phí.'", "Giao diện", "Cao", UI,
      ["Bấm 'Chọn gói này' ở Chuyên nghiệp", "Đọc khối xanh dưới form thẻ"], "owner.trialDays = 14",
      "Form thẻ (Số thẻ, MM / YY, CVC) hiện ra; khối xanh có biểu tượng khiên: 'Hôm nay: 0 ₫.' (đúng tiền tệ VND từ BE; mockup viết '0đ') + 'Thử miễn phí 14 ngày tới <ngày hôm nay + 14, định dạng dd/M>'; nút dưới cùng đổi 'Bắt đầu dùng thử'. Chọn lại 'Khởi đầu' thì khối thẻ ẩn và nút về 'Tiếp tục'.")
    A(F, "Ngày dùng thử của OWNER là 14 ngày (không phải 7 của thành viên); chữ 14 lấy từ owner.trialDays", "Chức năng", "Cao", UI + " " + DEC,
      ["Đọc tiêu đề bước 2 và khối xanh", "GET /api/owner-plans -> trialDays", "So với dùng thử thành viên 7 ngày ở bước 4 (checkbox)"], "14 vs 7",
      "Tiêu đề 'Dùng thử 14 ngày, chưa trừ đồng nào' và khối xanh đều nói 14 ngày; owner-plans.trialDays = 14. Mockup template.html cũng ghi 'Thử miễn phí 14 ngày' cho gói owner và 'dùng thử 7 ngày' cho thành viên; bản hợp đồng đầu của BE từng ghi 7 và đã sửa thành 14 (community-wizard.md mục 10). A16 chưa chốt: chỉ kiểm hành vi hiện tại.")
    A(F, "Máy tính 'Gói nào lợi hơn?': doanh thu 10.000.000 ₫/tháng theo tháng -> Khởi đầu 1.000.000 ₫, Chuyên nghiệp 589.000 ₫, tiết kiệm 411.000 ₫", "Chức năng", "Cao", UI + " " + DEC,
      ["Ở bước 2 (tab Theo tháng) nhập vào ô 'Doanh thu thành viên dự kiến mỗi tháng' số 10000000", "Đọc 2 dòng 'Tổng phí' và dòng gợi ý"], "10.000.000",
      "Ô tự định dạng '10.000.000'; 'Khởi đầu - Phí giao dịch 10%' Tổng phí 1.000.000 ₫; 'Chuyên nghiệp - Phí gói + 2,9% giao dịch' Tổng phí 589.000 ₫ (= 299.000 + 2,9% x 10.000.000); gợi ý 'Chuyên nghiệp có lợi hơn khi doanh thu vượt 4.211.268 ₫/tháng. Với doanh thu này bạn tiết kiệm 411.000 ₫/tháng.' Phí hiển thị lấy từ owner.startFeePct/proFeePct, KHÔNG phải hoa hồng kế toán thật.")
    A(F, "Máy tính ở chu kỳ 'Theo năm': phí Chuyên nghiệp dùng giá năm chia 12 (249.167 ₫/tháng)", "Chức năng", "Trung bình", UI + " " + DEC,
      ["Chọn 'Theo năm'", "Nhập doanh thu 10000000"], "10.000.000",
      "Chuyên nghiệp Tổng phí 539.167 ₫ (= 249.167 + 290.000), breakeven 3.509.390 ₫/tháng, tiết kiệm 460.833 ₫/tháng; Khởi đầu vẫn 1.000.000 ₫.")
    A(F, "Máy tính: doanh thu 0 hoặc nhỏ hơn mốc hòa vốn thì Khởi đầu lợi hơn (không câu 'Với doanh thu này bạn tiết kiệm')", "Chức năng", "Thấp", UI,
      ["Để doanh thu trống (0)", "Nhập 1000000", "Nhập chữ 'abc'"], "0 / 1.000.000 / abc",
      "Doanh thu 0: Khởi đầu 0 ₫ (xanh), Chuyên nghiệp 299.000 ₫. 1.000.000: Khởi đầu 100.000 ₫ < Chuyên nghiệp 328.000 ₫, không hiện 'tiết kiệm'. Ký tự không phải số bị loại (ô chỉ nhận chữ số).")
    A(F, "Form thẻ gói Chuyên nghiệp: để trống bấm 'Bắt đầu dùng thử' hiện lỗi từng ô (Vui lòng nhập số thẻ / Nhập ngày hết hạn / Nhập mã CVC)", "Chức năng", "Cao", UI,
      ["Chọn Chuyên nghiệp", "Không nhập thẻ, bấm 'Bắt đầu dùng thử'"], "-",
      "Không gọi API; 3 ô thẻ báo lần lượt 'Vui lòng nhập số thẻ', 'Nhập ngày hết hạn', 'Nhập mã CVC' (aria-invalid); footer có 'Vui lòng kiểm tra các ô được đánh dấu đỏ.'.")
    A(F, "Thẻ không hợp lệ Luhn/hết hạn bị chặn ở client trước khi lưu gói", "Bảo mật", "Cao", UI,
      ["Chọn Chuyên nghiệp, nhập 4242 4242 4242 4241, 12 / 30, CVC 123 -> Bắt đầu dùng thử", "Sửa số đúng 4242 4242 4242 4242, hạn 01 / 20 -> bấm lại"], "-",
      "Lỗi 'Số thẻ không hợp lệ' rồi 'Thẻ đã hết hạn'; không có PATCH /plan trong Network.")
    A(F, "Nhập thẻ hợp lệ và 'Bắt đầu dùng thử' lưu gói qua PATCH plan KHÔNG chứa số thẻ/CVC", "Bảo mật", "Cao", UI,
      ["Chọn Chuyên nghiệp (Theo tháng), nhập 4242 4242 4242 4242, 12 / (năm hiện tại + 3), CVC 123", "Bấm 'Bắt đầu dùng thử' (mở Network, xem body)"], "Visa 4242",
      "PATCH /api/communities/<id>/draft/steps/plan body = {planKey:'pro', cycle:'monthly', paymentMethod:{type:'card', token:'tok_mock_<hex>', brand:'visa', last4:'4242', expMonth, expYear}} - TUYỆT ĐỐI không có number/cvc/pan; response plan.status='trialing', todayDue 0, mock true. Sang bước 3. Số thẻ/CVC bị xóa khỏi ô sau khi tokenise.")
    A(F, "Chọn Khởi đầu và Tiếp tục lưu planKey 'start' (active, không thẻ)", "Tích hợp", "Cao", UI,
      ["Giữ 'Khởi đầu', bấm 'Tiếp tục' (xem Network)"], "-", "PATCH plan {planKey:'start'} -> 200, plan.status='active', priceAmount 0; không yêu cầu thẻ; sang bước 3.")
    A(F, "Quay lại bước 2 sau khi đã lưu Chuyên nghiệp: hiện 'Thẻ visa •••• 4242 đã được lưu' + 'Dùng thẻ khác', không buộc nhập lại thẻ", "Chức năng", "Trung bình", BASE + " " + OWNER_UI,
      ["Mở nháp 'Chạy Bộ 5K Cho Người Mới' (?draft=draft-chay-bo-5k) rồi bấm stepper về bước 2", "Bấm 'Dùng thẻ khác'"], "seed visa 4242",
      "Khung thẻ thay bằng 'Thẻ visa •••• 4242 đã được lưu' và nút 'Dùng thẻ khác' (xóa thẻ lưu ở form, hiện lại ô nhập). Bấm Tiếp tục khi đã có thẻ lưu cùng chu kỳ: không bắt nhập, không gọi lại PATCH plan.")
    A(F, "Đổi chu kỳ (Theo tháng -> Theo năm) khi thẻ lưu thuộc chu kỳ cũ: phải nhập/lưu lại thẻ cho chu kỳ mới", "Chức năng", "Trung bình", BASE + " " + OWNER_UI,
      ["Mở nháp draft-chay-bo-5k, tới bước 2 (đang Theo tháng + thẻ đã lưu)", "Bấm tab 'Theo năm'", "Bấm 'Tiếp tục'"], "monthly -> annual",
      "Vì savedCardReady chỉ đúng khi cycle trùng, form thẻ hiện lại và 'Tiếp tục' báo lỗi ô thẻ nếu chưa nhập; sau khi nhập PATCH plan cycle:'annual' -> priceAmount 2.990.000. (Hành vi suy ra từ code CreateWizard.)")
    A(F, "'Lưu nháp & thoát' ở bước 2 khi chọn Chuyên nghiệp nhưng chưa nhập thẻ: lưu phần còn lại, bỏ qua gói", "Chức năng", "Trung bình", UIM,
      ["Tới bước 2, chọn Chuyên nghiệp, KHÔNG nhập thẻ", "Bấm 'Lưu nháp & thoát' ở sidebar"], "-",
      "Toast 'Đã lưu nháp' và chuyển /me/communities; nháp không có gói (GET /communities/<id>/hosting-plan = null) và không báo lỗi thẻ.")
    A(F, "Gói owner KHÔNG bắt buộc: bỏ qua bước 2 vẫn ra mắt được khi owner.requirePlan=false (mặc định)", "Chức năng", "Cao", API + " " + MUTATE + " " + DEC,
      ["Tạo nháp, lưu members, KHÔNG gọi plan", "POST publish {acceptTerms:true}"], "owner.requirePlan=false", "201; hosting-plan = null (vẫn publish). Hợp đồng: plan chỉ bắt buộc khi owner.requirePlan=true.", pw="Không")
    A(F, "owner.requirePlan=true: GET /owner-plans trả required=true và publish bị chặn PLAN_REQUIRED tới khi chọn gói", "Chức năng", "Cao", APIM + " " + GSRESET + " " + DEC,
      ["admin PATCH /api/admin/system/settings {\"owner\":{\"requirePlan\":true}}", "GET /api/owner-plans", "GET /communities/<id>/draft -> readiness", "POST publish", "PATCH plan {planKey:'start'} rồi publish lại"], "requirePlan=true",
      "required=true; readiness.canPublish=false; publish 400 PLAN_REQUIRED; sau khi chọn gói start publish 201. Đặt lại setting sau khi test.", pw="Không")
    A(F, "Số ngày dùng thử owner đổi được: owner.trialDays=30 làm tiêu đề, khối xanh và trialEndsAt thành 30 ngày", "Chức năng", "Trung bình", UIM + " " + GSRESET + " " + DEC,
      ["admin PATCH /api/admin/system/settings {\"owner\":{\"trialDays\":30}} (không có ô trên giao diện Cài đặt chung)", "Mở bước 2 và chọn Chuyên nghiệp, lưu thẻ"], "owner.trialDays=30",
      "Tiêu đề 'Dùng thử 30 ngày, chưa trừ đồng nào', khối xanh 'Thử miễn phí 30 ngày tới <ngày>', response plan.trialEndsAt - trialStartedAt = 30 ngày.", pw="Một phần")
    A(F, "Lỗi tải gói: 'Không tải được danh sách gói, vui lòng thử lại' khi /owner-plans lỗi", "Chức năng", "Thấp", UI,
      ["Chặn request /api/owner-plans (DevTools block hoặc tắt backend)", "Vào bước 2"], "owner-plans lỗi", "Hiện thông báo đỏ role=alert 'Không tải được danh sách gói, vui lòng thử lại'; không có thẻ gói; vẫn bấm 'Tiếp tục' được (lưu start).", pw="Một phần")
    A(F, "Khối xanh dùng định dạng ngày dd/M (ngày 2 chữ số, tháng không đệm 0) - lệch định dạng d/M của hộp thoại tham gia", "Giao diện", "Thấp", UI,
      ["Chọn Chuyên nghiệp vào ngày có ngày < 10 hoặc tháng < 10 (hoặc đổi giờ máy)", "So với ngày ở hộp thoại 'Chọn gói thành viên' (d/M)"], "ví dụ 08/9 và 8/9",
      "HIỆN TẠI: wizard hiện '08/9' (formatDay: ngày có đệm 0, tháng không), hộp thoại gói thành viên hiện '8/9' (dayMonth: không đệm). KỲ VỌNG: thống nhất một định dạng (mockup dùng d/M như ảnh hộp thoại '8/10'). Ghi lại như lệch UI nhỏ.", pw="Một phần", st=PLAN)
    A(F, "Tiền tệ lẫn lộn: gói chủ cộng đồng tính VND (0 ₫, 299.000 ₫) trong khi giá thành viên và toàn hệ thống là USD", "Chức năng", "Trung bình", UI + " " + DEC,
      ["Đọc giá ở bước 2 (VND) rồi giá ở bước 4 (USD)", "GET /api/owner-plans -> currency", "Admin > Hệ thống > Cài đặt chung: tiền tệ"], "VND vs USD",
      "owner.currency mặc định VND (mockup dùng đồng) còn payments.currency/giá cộng đồng là USD; hai tiền tệ cùng xuất hiện trong một wizard. Cần chủ sở hữu chốt (A16: 'đơn vị tiền gói có khác tiền gói thành viên không'). Case chỉ ghi nhận hiện trạng.", st=PLAN, pw="Một phần")
    A(F, "Cuối dùng thử 14 ngày hệ thống CHƯA tự trừ gói Chuyên nghiệp (mô phỏng, mock:true)", "Chức năng", "Cao", API + " " + DEC,
      ["Lưu gói pro (PATCH plan có thẻ), ghi plan.mock", "Dùng SQL đẩy trialEndsAt về quá khứ: UPDATE \"HostingPlan\" SET \"trialEndsAt\"=now()-interval '1 day' WHERE \"communityId\"='<id>'", "Chờ các job nền (payments.*) chạy hoặc khởi động lại backend", "Kiểm tra bảng Payment và HostingPlan"], "HostingPlan hết thử",
      "KỲ VỌNG nghiệp vụ (A16): hết thử thì trừ 299.000 ₫ và chuyển active. HIỆN TẠI: không có job/cổng cho gói owner, status vẫn 'trialing', không có Payment nào; response luôn có mock:true và 'KHÔNG có trừ tiền thật' theo hợp đồng mục 6. Chưa làm -> Kế hoạch.", pw="Không", st=PLAN)

    # ------------------------------------------------------------------------------------------------ 5. API GÓI OWNER
    F = "API gói hosting của owner"
    A(F, "GET /owner-plans (công khai): catalogue từ Global Settings - VND, trialDays 14, remindDaysBefore 3, 2 plan, 2 cycle", "Tích hợp", "Cao", API + " " + DEC,
      ["GET /api/owner-plans (không token)"], "-",
      "currency 'VND', trialDays 14, remindDaysBefore 3, required false; cycles [monthly 'Theo tháng' 0%, annual 'Theo năm - tặng 2 tháng' 17%]; plans [start: priceMonthly/Annual 0, transactionFeePct 10, popular false; pro: 299000 / 2990000, transactionFeePct 2.9, popular true]; mỗi plan có features[] và fit.", pw="Không")
    A(F, "Giá/ngày thử/phí hiển thị của gói owner đổi theo Global Settings owner.* (proMonthlyPrice, startFeePct...)", "Tích hợp", "Trung bình", APIM + " " + GSRESET + " " + DEC,
      ["admin PATCH settings {\"owner\":{\"proMonthlyPrice\":399000,\"proAnnualPrice\":3990000,\"proFeePct\":3.5,\"startFeePct\":12}}", "GET /api/owner-plans và mở bước 2 + máy tính"], "399000/3990000",
      "owner-plans phản ánh giá/phí mới, FE bước 2 hiện 399.000 ₫ và máy tính dùng 12% và 3,5%; kế toán thật vẫn dùng payments.commissionPct (không đổi).", pw="Một phần")
    A(F, "PATCH plan {planKey:'start'} -> status 'active', priceAmount 0, không trialStartedAt, không thẻ", "Tích hợp", "Cao", API,
      ["Tạo nháp (POST /communities/drafts)", "PATCH /communities/<id>/draft/steps/plan {planKey:'start'}"], "start", "200 DraftView; data.plan = {planKey:'start', status:'active', priceAmount:0, todayDue:0, paymentMethod:null, mock:true}; completedSteps gồm 'plan'.", pw="Không")
    A(F, "PATCH plan {planKey:'pro'} thiếu paymentMethod -> 400 PAYMENT_METHOD_REQUIRED", "Chức năng", "Cao", API,
      ["PATCH plan {planKey:'pro'} (không paymentMethod)"], "pro không thẻ", "400, error.code='PAYMENT_METHOD_REQUIRED'; hosting-plan vẫn null.", pw="Không")
    A(F, "PATCH plan pro + paymentMethod STRICT: field lạ number/cvc/pan -> 400 VALIDATION_ERROR", "Bảo mật", "Cao", API,
      ["PATCH plan {planKey:'pro', paymentMethod:{type:'card',token:'tok_mock_abcdef12',brand:'visa',last4:'4242',expMonth:12,expYear:<năm+3>,number:'4242424242424242',cvc:'123'}}"], "thêm number + cvc",
      "400 VALIDATION_ERROR; không có dòng PaymentCard mới. Server không bao giờ nhận số thẻ đầy đủ hay CVC.", pw="Không")
    A(F, "paymentMethod sai: hết hạn, last4 '42', expMonth 13, token '4242424242424242', brand 'bitcoin' đều 400", "Bảo mật", "Cao", API,
      ["Gọi PATCH plan pro lần lượt với: expYear năm ngoái; last4 '42'; expMonth 13; token là số thẻ; brand 'bitcoin'"], "5 biến thể", "Cả 5 trả 400 VALIDATION_ERROR (token phải khớp ^(tok|pm)_[A-Za-z0-9_]{4,100}$, brand thuộc danh sách cho phép, thẻ chưa hết hạn).", pw="Không")
    A(F, "PATCH plan planKey lạ ('gold') -> 400", "Chức năng", "Thấp", API, ["PATCH plan {planKey:'gold'}"], "gold", "400 VALIDATION_ERROR.", pw="Không")
    A(F, "Gói pro hợp lệ: trialing, giá 2.990.000 (annual), todayDue 0, mock true, trialEnds = started + 14 ngày, firstChargeDate = trialEndsAt", "Tích hợp", "Cao", API + " " + DEC,
      ["PATCH plan {planKey:'pro', cycle:'annual', paymentMethod:{...thẻ hợp lệ}}"], "pro annual",
      "plan.status='trialing', priceAmount 2990000, currency 'VND', todayDue 0, mock true, trialEndsAt - trialStartedAt = 14 ngày, firstChargeDate = trialEndsAt, firstChargeAmount 2990000; paymentMethod {brand,last4,expMonth,expYear}; JSON KHÔNG chứa chuỗi 'tok_'.", pw="Không")
    A(F, "Đổi về start rồi quay lại pro KHÔNG khởi động lại đồng hồ dùng thử", "Chức năng", "Trung bình", API,
      ["Lưu pro (ghi trialStartedAt/trialEndsAt)", "PATCH plan start (-> active, thẻ bỏ)", "PUT /communities/<id>/hosting-plan {planKey:'pro', paymentMethod}"], "-", "Sau khi quay lại pro, trialStartedAt/trialEndsAt giữ nguyên giá trị cũ (chống lách bằng cách đổi gói lặp lại).", pw="Không")
    A(F, "GET/PUT /communities/:id/hosting-plan: owner đọc được (null khi chưa chọn); người khác 404", "Bảo mật", "Trung bình", API + " Người dùng B khác.",
      ["Owner GET hosting-plan của nháp mới -> data null", "B GET cùng URL"], "-", "Owner: 200 { data:null }; B: 404 (không lộ tồn tại nháp). PUT cùng body như bước plan.", pw="Không")
    A(F, "Lưu gói owner không tạo giao dịch tiền nào (Payment không có dòng của owner)", "Bảo mật", "Cao", API + " Cần SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub.",
      ["Lưu gói pro có thẻ", "SELECT count(*) FROM \"Payment\" WHERE \"userId\"='<id owner>'", "SELECT * FROM \"PaymentCard\" WHERE \"userId\"='<id owner>'"], "-",
      "Payment = 0 (mô phỏng, không trừ tiền); PaymentCard 1 dòng chỉ có các cột brand, createdAt, expMonth, expYear, gatewayToken, id, last4, userId; không có chuỗi 13-19 chữ số trong dòng nào.", pw="Không")
    A(F, "GET /me/payment-methods sau khi lưu thẻ gói owner chỉ trả brand/last4/hạn (không token)", "Bảo mật", "Trung bình", API,
      ["Lưu gói pro với thẻ mastercard 4444", "GET /api/me/payment-methods"], "-", "Mảng 1 phần tử có đúng khóa brand, createdAt, expMonth, expYear, id, last4 (không gatewayToken); chưa token: 401.", pw="Không")

    # ------------------------------------------------------------------------------------------------ 6. BƯỚC 3 - NHẬN DIỆN
    F = "Bước 3 - Nhận diện & giới thiệu"
    A(F, "Bước 3 hiển thị: Logo (Vuông 1:1), Ảnh bìa, Màu chủ đạo, Lời hứa n/100, '3 điều thành viên nhận được', Video giới thiệu (không bắt buộc) + 'Xem trước trang giới thiệu'", "Giao diện", "Cao", UI,
      ["Tới bước 3", "Đối chiếu mockup"], "-",
      "Hai ô tải ảnh nét đứt với placeholder 'Tải lên logo (Vuông 1:1)' và 'Kéo thả ảnh vào đây · 16:9 · tối thiểu 1280×720'; 6 màu + 'Tùy chọn' (ô chọn màu); 'Lời hứa (dòng đầu tiên)' 0/100 placeholder 'Thành viên sẽ đạt được gì?'; mục '3 điều thành viên nhận được' (3 ô trống 'Thêm một kết quả cụ thể...' mỗi ô n/100); nút '+ Thêm lợi ích khác'; 'Video giới thiệu' placeholder 'Dán link YouTube, Vimeo...'; cột phải xem trước 'Tham gia'. Nút 'Bỏ qua, làm sau' bên cạnh 'Tiếp tục'.")
    A(F, "Tải logo: chọn ảnh PNG -> luồng presign (purpose avatar) -> PUT -> hiện ảnh xem trước", "Tích hợp", "Cao", UI + " File test: ảnh logo.png vuông < 3MB.",
      ["Bấm ô logo, chọn logo.png (mở Network)", "Chờ xong"], "logo.png",
      "Overlay 'Đang tải lên…'; POST /api/uploads/presign {purpose:'avatar', ...} -> PUT tệp -> ô hiện ảnh (URL dạng /api/files/<key>) và xem trước trang giới thiệu cũng hiện logo; có nút 'Gỡ ảnh' (x).")
    A(F, "Tải ảnh bìa: purpose 'cover', hiện ở ô bìa và xem trước 'Trên Khám phá'/'trang giới thiệu'", "Tích hợp", "Cao", UI + " File test: cover.jpg 16:9 < 8MB.",
      ["Bấm ô Ảnh bìa, chọn cover.jpg", "Quan sát ô và khung xem trước"], "cover.jpg", "presign purpose 'cover'; ảnh hiện trong ô và trong khung xem trước (CoverBox); 'Gỡ ảnh' xóa về placeholder.")
    A(F, "Tải ảnh bằng kéo-thả tệp vào ô (drag & drop file)", "Chức năng", "Thấp", UI + " File ảnh hợp lệ.",
      ["Kéo một tệp ảnh từ máy thả lên ô logo"], "-", "Khi kéo ngang qua ô viền/nền đổi (hover), thả ra thì tải lên như chọn tệp. (Khác với biểu tượng kéo-thả sắp xếp lợi ích/câu hỏi chỉ là hình thức.)", pw="Một phần")
    A(F, "Chọn tệp không phải ảnh (PDF/ZIP) hoặc quá lớn bị từ chối với thông báo lỗi dưới ô", "Chức năng", "Cao", UI + " Tệp thử: bai.pdf, anh-12MB.png.",
      ["Chọn bai.pdf cho logo", "Chọn anh-12MB.png cho logo (giới hạn avatar 3MB)", "Chọn ảnh 9MB cho ảnh bìa (giới hạn 8MB)"], "pdf / 12MB / 9MB",
      "Ô chỉ nhận jpeg/png/webp/gif (input accept); tệp sai loại/quá cỡ bị presign từ chối và hiện lỗi đỏ role=alert dưới ô; không có ảnh nào được gán, form không bị hỏng. Giới hạn theo UPLOAD_MAX_AVATAR_MB=3, UPLOAD_MAX_COVER_MB=8, UPLOAD_MAX_IMAGE_MB=5.", pw="Một phần")
    A(F, "Màu chủ đạo: 6 màu sẵn (radio) + chọn màu tùy ý; mặc định #f26a1b; màu áp lên nút 'Tham gia' xem trước", "Chức năng", "Trung bình", UI,
      ["Bấm lần lượt các màu mẫu", "Dùng ô 'Chọn màu tùy ý' chọn #123456", "Quan sát nút 'Tham gia' và icon ✓ ở xem trước"], "#16a34a, #123456",
      "Màu được chọn có viền tương ứng (aria-checked); nút 'Tham gia' và dấu ✓ lợi ích đổi sang màu đó. Mặc định #f26a1b.")
    A(F, "Lời hứa: bộ đếm n/100, không gõ quá 100 ký tự, hiện trong xem trước", "Chức năng", "Trung bình", UI,
      ["Gõ lời hứa 30 ký tự -> '30/100'", "Dán 150 ký tự"], "-", "Đếm đúng; ô giữ 100 ký tự; khung xem trước hiện lời hứa (rỗng thì 'Lời hứa của cộng đồng sẽ hiện ở đây').")
    A(F, "Lợi ích: mặc định 3 dòng, thêm tới tối đa 6 (nút '+ Thêm lợi ích khác' biến mất ở 6), mỗi dòng n/100", "Chức năng", "Cao", UI,
      ["Bấm '+ Thêm lợi ích khác' 3 lần", "Quan sát tiêu đề mục và nút"], "6 dòng", "Tiêu đề đổi '4/5/6 điều thành viên nhận được'; ở 6 dòng nút thêm ẩn; mỗi ô maxLength 100 với bộ đếm.")
    A(F, "Xóa lợi ích: nút thùng rác xóa dòng; khi chỉ còn 1 dòng thì xóa = làm trống dòng đó", "Chức năng", "Thấp", UI,
      ["Xóa lần lượt các dòng lợi ích đến khi còn 1", "Bấm xóa dòng cuối"], "-", "Số dòng giảm dần; dòng cuối không biến mất mà bị làm trống; 'Lợi ích' ở xem trước đổi 'Lợi ích thành viên nhận được' khi không có dòng nào có chữ.")
    A(F, "Dòng lợi ích trống bị bỏ khi lưu; thứ tự = thứ tự nhập (biểu tượng kéo thả chỉ hình thức)", "Chức năng", "Trung bình", UIM,
      ["Nhập lợi ích: 'Buổi học trực tiếp', (bỏ trống), 'Thư viện video'", "Bấm Tiếp tục, xem body PATCH identity", "Thử kéo biểu tượng drag_indicator"], "-",
      "benefits gửi ['Buổi học trực tiếp','Thư viện video'] (dòng trống bị lọc); kéo biểu tượng không đổi thứ tự (decorative - xem case Kế hoạch).")
    A(F, "Video giới thiệu: link YouTube/Vimeo hợp lệ hiện nút play trên ảnh bìa xem trước; để trống được", "Chức năng", "Trung bình", UI,
      ["Dán https://youtu.be/dQw4w9WgXcQ", "Xóa ô"], "youtu.be", "Có link: nút play tròn màu chủ đạo trên khung bìa xem trước; xóa trống: không nút play, không lỗi.")
    A(F, "Video giới thiệu không phải URL: 'Đường dẫn video không hợp lệ (dán link YouTube hoặc Vimeo)'", "Chức năng", "Trung bình", UI,
      ["Gõ 'abc' vào ô video", "Bấm Tiếp tục"], "abc", "Lỗi dưới ô 'Đường dẫn video không hợp lệ (dán link YouTube hoặc Vimeo)', viền đỏ; không gọi API.")
    A(F, "Video là URL http(s) nhưng không phải YouTube/Vimeo: client cho qua, BE từ chối và lỗi hiện ở ô video", "Chức năng", "Trung bình", UI,
      ["Gõ https://evil.example.com/v", "Bấm Tiếp tục"], "evil.example.com", "PATCH identity trả 400; lỗi (fieldErrors.introVideoUrl) hiện ở ô 'Video giới thiệu', wizard ở lại bước 3. (Client chỉ kiểm tra http/https.)", pw="Một phần")
    A(F, "'Bỏ qua, làm sau' ở bước 3 sang bước 4 KHÔNG gọi API, bước identity không được đánh dấu hoàn tất", "Chức năng", "Cao", UI,
      ["Tới bước 3, không nhập gì, bấm 'Bỏ qua, làm sau' (mở Network)", "Mở /me/communities và đọc 'Đã hoàn thành n/4 bước'"], "-",
      "Chuyển bước 4, không có request PATCH identity; nháp hiển thị tiến độ không tính bước 3 (vd. 2/4 sau khi lưu bước 4 -> 3/4 gồm basics, plan, members).")
    A(F, "Xem trước trang giới thiệu: tên, 'Riêng tư/Công khai • 1 thành viên', lời hứa, lợi ích, nút 'Tham gia' theo màu", "Giao diện", "Trung bình", UI,
      ["Điền các ô ở bước 3", "Đối chiếu khung 'Xem trước trang giới thiệu'"], "-", "Khung xem trước hiện đúng dữ liệu đang gõ; trạng thái 'Công khai' (mặc định) vì quyền riêng tư đặt ở bước 4.")
    A(F, "Bước 3 lưu qua PATCH identity: brandColor chuẩn hóa chữ thường, logo/cover là fileUrl của upload, null khi để trống", "Tích hợp", "Cao", UIM,
      ["Điền đủ bước 3 (màu #F26A1B qua ô tùy chọn), bấm Tiếp tục (xem Network)"], "-", "Body {logoUrl, coverUrl, brandColor, promise, benefits[], introVideoUrl} - ô trống gửi null; response identity.brandColor '#f26a1b' (chữ thường); introVideoUrl chuẩn hóa dạng nhúng https://www.youtube.com/embed/<id>.")
    A(F, "Identity API: màu 'red' / lời hứa 101 ký tự / 7 lợi ích / video ngoài YouTube-Vimeo -> 400; lợi ích trống bị bỏ", "Chức năng", "Cao", API,
      ["PATCH identity {brandColor:'red'}", "{promise:'x'*101}", "{benefits:[7 mục]}", "{introVideoUrl:'https://evil.example.com/v'}", "{benefits:['Buổi học','','Thư viện']}"], "-",
      "Bốn lệnh đầu 400 VALIDATION_ERROR; lệnh cuối 200 benefits ['Buổi học','Thư viện']; brandColor '#F26A1B' lưu '#f26a1b'; youtu.be/<id> lưu thành https://www.youtube.com/embed/<id>; introVideoUrl:null xóa video.", pw="Không")
    A(F, "Identity API: logoUrl/coverUrl phải là upload của CHÍNH MÌNH, đúng purpose, đã hoàn tất (UPLOAD_INVALID)", "Bảo mật", "Cao", API + " Hai người dùng A, B; mỗi người đã tạo upload qua POST /uploads/presign + PUT.",
      ["A PATCH identity {logoUrl:<fileUrl cover của A>} (sai purpose)", "{logoUrl:<fileUrl avatar của B>} (của người khác)", "{logoUrl:<upload chưa PUT xong>}", "{coverUrl:'https://example.com/a.png'}", "{logoUrl:<fileUrl avatar của A>}", "{logoUrl:null}"], "-",
      "Bốn lệnh đầu 400 error.code='UPLOAD_INVALID'; lệnh 5 thành công (identity.logoUrl = fileUrl); lệnh 6 xóa logo (null).", pw="Không")
    A(F, "Sau khi ra mắt logo/ảnh bìa wizard hiện ở hộp thoại tham gia và trang chi tiết cộng đồng", "Chức năng", "Trung bình", UIM,
      ["Tạo cộng đồng có phí kèm logo (bước 3) rồi ra mắt", "Đăng nhập tài khoản khác, mở trang chi tiết và bấm 'Tham gia ngay'"], "-", "Header hộp thoại 'Chọn gói thành viên' hiện ảnh logo (nếu không có logo thì khối 'Logo' chữ cái đầu); trang chi tiết dùng ảnh bìa/màu đã đặt.", pw="Một phần")

    # ------------------------------------------------------------------------------------------------ 7. BƯỚC 4 - THÀNH VIÊN & GIÁ
    F = "Bước 4 - Thành viên & giá"
    A(F, "Bước 4 hiển thị: Quyền riêng tư, Giá thành viên, Câu hỏi khi xin gia nhập, Kết nối tài khoản nhận tiền, Nội quy cộng đồng", "Giao diện", "Cao", UI,
      ["Tới bước 4", "Đối chiếu mockup"], "-", "5 khối: 'Quyền riêng tư' (Riêng tư/Công khai), 'Giá thành viên' (Miễn phí/Hàng tháng/Hàng năm), 'Câu hỏi khi xin gia nhập' (0 / 3 câu + '+ Thêm câu hỏi'), 'Kết nối tài khoản nhận tiền' (gradient cam), 'Nội quy cộng đồng' (2 checkbox + 'Sửa nội quy mẫu'). Nút chính 'Tạo cộng đồng'.")
    A(F, "Quyền riêng tư: mặc định 'Công khai'; chọn 'Riêng tư' đổi radio; mô tả đúng từng lựa chọn", "Chức năng", "Cao", UI,
      ["Quan sát lựa chọn mặc định", "Chọn 'Riêng tư' rồi 'Công khai'"], "-", "Riêng tư: 'Chỉ thành viên thấy nội dung. Trang giới thiệu vẫn công khai.'; Công khai: 'Ai cũng xem được bài đăng, chỉ thành viên mới đăng bài.' Mặc định chọn Công khai; radio đổi biểu tượng ◉/○; xem trước ở bước 3 đổi 'Riêng tư • 1 thành viên'.")
    A(F, "Giá: tab Miễn phí/Hàng tháng/Hàng năm; Miễn phí ẩn ô giá, trial và ước tính", "Chức năng", "Cao", UI,
      ["Chọn 'Miễn phí', rồi 'Hàng tháng', rồi 'Hàng năm'"], "-", "Miễn phí: không có ô giá/checkbox dùng thử/dòng 'Bạn nhận về'. Hàng tháng: ô 'Giá hàng tháng' ($ ... / tháng). Hàng năm: thêm ô 'Giá hàng năm' ($ ... / năm). Mặc định của FE là Miễn phí.")
    A(F, "Ô giá chỉ nhận chữ số và dấu chấm/phẩy; nút ▲▼ tăng giảm (tháng +-1, năm +-10), không xuống dưới 0", "Chức năng", "Trung bình", UI,
      ["Hàng năm: gõ 'abc7,5' vào giá tháng", "Bấm ▲ 3 lần ở giá tháng, ▼ nhiều lần", "Bấm ▲ ở giá năm"], "7,5",
      "Chữ cái bị bỏ, '7,5' chấp nhận (coi là 7.5); ▲ tháng +1/lần, ▲ năm +10/lần; ▼ dừng ở 0.")
    A(F, "Giá tháng bắt buộc > 0 khi chọn có phí: 'Nhập giá thành viên hàng tháng lớn hơn 0'", "Chức năng", "Cao", UI,
      ["Chọn 'Hàng tháng', để trống hoặc 0", "Bấm 'Tạo cộng đồng'"], "0", "Lỗi dưới ô giá, không gọi PATCH members.")
    A(F, "Giá tháng tối đa 10.000 USD: 'Giá tối đa 10,000 USD'", "Chức năng", "Trung bình", UI, ["Nhập 10001 vào giá tháng", "Bấm 'Tạo cộng đồng'"], "10001", "Lỗi 'Giá tối đa 10,000 USD'; nhập 10000 thì hợp lệ.")
    A(F, "Gói năm: giá năm bắt buộc > 0 và không vượt 12 x giá tháng ('Giá năm không được cao hơn 12 tháng cộng lại')", "Chức năng", "Cao", UI,
      ["Chọn 'Hàng năm', giá tháng 7, giá năm 0", "Đổi giá năm 100", "Đổi giá năm 84", "Đổi giá năm 48"], "7 / 0, 100, 84, 48",
      "0: 'Nhập giá thành viên hàng năm lớn hơn 0'; 100: 'Giá năm không được cao hơn 12 tháng cộng lại'; 84 (= 12 x 7) hợp lệ nhưng không có % tiết kiệm; 48 hợp lệ.")
    A(F, "Huy hiệu 'Tiết kiệm X%' ở tab 'Hàng năm' và dòng 'Giá năm tiết kiệm X% so với trả theo tháng.' tính live ($7/$48 -> 43%)", "Chức năng", "Cao", UI + " " + DEC,
      ["Chọn 'Hàng năm', giá tháng 7, giá năm 48", "Đổi giá năm 84", "Đổi giá tháng 5, năm 50"], "7/48, 7/84, 5/50",
      "7/48: badge 'Tiết kiệm 43%' + dòng 'Giá năm tiết kiệm 43% so với trả theo tháng.'; 7/84: không badge, không dòng (savings 0); 5/50: 17%. Công thức round((1 - năm/(12 x tháng)) x 100) trùng BE (annualSavingsPct).")
    A(F, "Checkbox 'Cho thành viên mới dùng thử 7 ngày' hiện khi nháp ĐÃ lưu giá có phí + bật dùng thử; mặc định tích", "Chức năng", "Trung bình", BASE + " " + OWNER_UI,
      ["Mở nháp 'Viết Content Ra Đơn' (draft-viet-content) tới bước 4 (đã lưu $7/$48, thử mặc định bật)", "Bỏ tích rồi Tiếp tục, quay lại bước 4"], "7 ngày",
      "Hiện checkbox 'Cho thành viên mới dùng thử 7 ngày' (số ngày = payments.trialDays) đã tích; bỏ tích lưu memberTrialEnabled=false -> checkbox biến mất khi quay lại (xem case lệch bên dưới).")
    A(F, "NGHI VẤN: lần đầu vào bước 4 chọn có phí, checkbox 'Cho thành viên mới dùng thử' không hiện (số ngày lấy từ nháp đang là giá 0)", "Giao diện", "Trung bình", UI,
      ["Tạo nháp mới tới bước 4", "Chọn 'Hàng tháng' giá 7 (chưa lưu bước 4 lần nào)", "Quan sát khối giá"], "nháp mới",
      "HIỆN TẠI (suy ra từ code, cần xác minh khi chạy): checkbox hiển thị theo draft.members.trialDays, mà BE trả 0 khi priceCents=0 hoặc memberTrialEnabled=false nên checkbox không hiện ở lần đầu và không bật lại được sau khi từng tắt/lưu miễn phí. KỲ VỌNG: có checkbox (mockup luôn có 'Cho thành viên mới dùng thử 7 ngày' khi chọn có phí). Ghi lại như lệch UI.", pw="Một phần", st=PLAN)
    A(F, "'Bạn nhận về khoảng $X mỗi thành viên sau phí giao dịch.' lấy từ GET /communities/revenue-estimate (debounce 400ms)", "Tích hợp", "Cao", UI + " " + DEC,
      ["Chọn 'Hàng tháng', giá 7", "Chờ ~0,5 giây, đọc dòng 'Bạn nhận về' và tooltip biểu tượng (i)", "Đổi giá 10, rồi 'Hàng năm' giá năm 48"], "$7, $10, $48 năm",
      "Giá 7 -> 'Bạn nhận về khoảng $5.80' (net 580¢); giá 10 -> $8.41; hàng năm giá năm 48 -> $41.51 (4151¢). Tooltip 'Hoa hồng nền tảng 10% + phí cổng thanh toán 2.9%'. Network: GET /api/communities/revenue-estimate?price=7&interval=monthly&members=1. Hoa hồng/phí cổng là GIÁ TRỊ TẠM (Admin > Cài đặt chung).")
    A(F, "Câu hỏi gia nhập: thêm tới 3 (nút ẩn ở 3), xóa, đếm 'n / 3 câu', maxLength 200", "Chức năng", "Cao", UI,
      ["Bấm '+ Thêm câu hỏi' 3 lần", "Gõ vào từng ô", "Xóa câu giữa"], "3 câu", "Bộ đếm '1 / 3 câu' .. '3 / 3 câu'; ở 3 câu nút '+ Thêm câu hỏi' biến mất; xóa giảm đếm; ô giữ tối đa 200 ký tự.")
    A(F, "Câu hỏi rỗng/ngắn: 'Câu hỏi tối thiểu 3 ký tự (hoặc xóa câu hỏi này)' và chặn Tạo cộng đồng", "Chức năng", "Cao", UI,
      ["Thêm 1 câu hỏi để trống, bấm 'Tạo cộng đồng'", "Gõ 'ab'", "Gõ câu hợp lệ 'Bạn biết đến lớp từ đâu?'"], "'' / ab / hợp lệ", "Hai trường hợp đầu: lỗi dưới ô tương ứng, không gọi API; câu hợp lệ qua. Câu rỗng không bị tự lọc ở client (phải xóa hoặc nhập).")
    A(F, "Khối 'Kết nối tài khoản nhận tiền' mặc định: nút 'Kết nối ngay' + 'Bỏ qua, làm sau' (mockup: 'Để sau')", "Giao diện", "Trung bình", UI,
      ["Quan sát khối khi chưa kết nối"], "-", "Văn bản 'Làm ngay hôm nay: lần chi trả đầu tiên cần xét duyệt danh tính và có thể mất vài ngày làm việc.' (chỉ là chữ, không có xét duyệt thật), nút 'Kết nối ngay', liên kết gạch chân 'Bỏ qua, làm sau' (mockup dùng 'Để sau').")
    A(F, "Hộp thoại 'Kết nối tài khoản nhận tiền': kiểm tra Ngân hàng / Chủ tài khoản / Số tài khoản 6-20 chữ số", "Chức năng", "Cao", UI,
      ["Bấm 'Kết nối ngay'", "Bấm 'Kết nối' khi để trống", "Nhập số tài khoản '12ab' rồi '12345'", "Nhập chữ vào ô số tài khoản"], "-",
      "Lỗi 'Nhập tên ngân hàng', 'Nhập tên chủ tài khoản', 'Số tài khoản gồm 6–20 chữ số'; ô số tài khoản chỉ nhận chữ số (chữ bị bỏ), tối đa 20; ghi chú 'Chúng tôi chỉ lưu 4 số cuối của số tài khoản.'")
    A(F, "Kết nối tài khoản thành công: PUT payout-account, toast 'Đã kết nối tài khoản nhận tiền', khối đổi 'Đã kết nối tài khoản nhận tiền <Ngân hàng>' và ẩn nút", "Chức năng", "Cao", UIM,
      ["Nhập Vietcombank / NGUYEN VAN A / 0123456788812 -> 'Kết nối'", "Quan sát toast, khối, Network"], "0123456788812",
      "PUT /api/communities/<id>/payout-account -> 200 {status:'connected', accountMasked:'****8812'}; toast xuất hiện ~2,4 giây; khối hiện biểu tượng ✓ + 'Đã kết nối tài khoản nhận tiền Vietcombank' và không còn nút Kết nối/Bỏ qua. Số đầy đủ không xuất hiện trong response.")
    A(F, "Bỏ qua kết nối: POST payout-account/skip -> trạng thái 'skipped', chữ gợi ý kết nối sau, vẫn còn nút 'Kết nối ngay'", "Chức năng", "Trung bình", UIM,
      ["Bấm 'Bỏ qua, làm sau'", "Sau đó bấm 'Kết nối ngay' và kết nối"], "-", "Sau skip: 'Bạn có thể kết nối sau trong Cài đặt cộng đồng. Cộng đồng trả phí cần tài khoản nhận tiền để rút doanh thu.' và nút 'Bỏ qua' biến mất nhưng 'Kết nối ngay' còn; có thể kết nối sau đó (status connected).")
    A(F, "Lỗi từ BE khi kết nối (ví dụ mạng) hiện trong hộp thoại và nút trở lại 'Kết nối'", "Chức năng", "Thấp", UI, ["Ngắt mạng/tắt backend rồi bấm 'Kết nối' với dữ liệu hợp lệ"], "-", "Hiện ErrorLine đỏ trong hộp thoại; hộp thoại không đóng; nút hết 'Đang kết nối…'.", pw="Một phần")
    A(F, "Nội quy: 2 checkbox 'Yêu cầu đồng ý nội quy' và 'Tự duyệt người trả phí' (mặc định cả hai đã tích ở FE)", "Chức năng", "Trung bình", UI,
      ["Quan sát mặc định", "Bỏ/tích từng ô, bấm Tạo cộng đồng, xem body PATCH members"], "-", "Mặc định requireRulesAgreement=true, autoApprovePaid=true; body members phản ánh đúng lựa chọn. (Lưu ý mặc định BE của POST /communities một phát là tắt - lệch mặc định FE/BE chỉ ảnh hưởng wizard.)")
    A(F, "'Sửa nội quy mẫu' mở hộp thoại nạp sẵn nội quy mẫu từ GET /communities/rules-template (4 điều)", "Chức năng", "Cao", UI,
      ["Bấm 'Sửa nội quy mẫu'"], "-", "Hộp thoại 'Sửa nội quy mẫu' liệt kê 4 điều (Tôn trọng lẫn nhau; Không spam, không quảng cáo; Đăng đúng chủ đề; Bảo vệ thông tin riêng tư), mỗi điều có tiêu đề + mô tả, nút xóa, '+ Thêm điều', 'Lưu nội quy'. (Nút 'Dùng mẫu' của mockup không có - xem Kế hoạch.)")
    A(F, "Sửa nội quy: thêm/xóa/sửa, tối đa 20 điều (maxLength 80/500), 'Lưu nội quy' bỏ điều không có tiêu đề, 'Hủy' không đổi gì", "Chức năng", "Trung bình", UI,
      ["Thêm điều mới 'Giữ bí mật' + mô tả", "Xóa điều 2", "Để trống tiêu đề một điều rồi 'Lưu nội quy'", "Mở lại, sửa rồi bấm 'Hủy'"], "-", "Điều không tiêu đề bị loại khi lưu; '+ Thêm điều' ẩn khi đủ 20; Hủy không thay đổi danh sách; body members.rules chỉ có điều hợp lệ (body rỗng thì chỉ gửi title).")
    A(F, "Nội quy được lưu thành thứ tự đã nhập và hiển thị lại khi mở nháp (viet-content: 2 nội quy)", "Chức năng", "Trung bình", BASE + " " + OWNER_UI,
      ["Mở nháp draft-viet-content, bước 4, bấm 'Sửa nội quy mẫu'"], "seed", "Có 2 điều 'Tôn trọng lẫn nhau' (mô tả 'Góp ý văn minh.') và 'Không spam' (mô tả trống) đúng thứ tự seed; checkbox 'Yêu cầu đồng ý nội quy' đã tích (seed requireRulesAgreement=true).")
    A(F, "Bước 4 'Tạo cộng đồng' lưu PATCH members đúng body và chuyển sang bước 5 tóm tắt", "Tích hợp", "Cao", UIM,
      ["Chọn Riêng tư, Hàng năm giá 7/48, tích dùng thử, 2 câu hỏi", "Bấm 'Tạo cộng đồng' (Network)"], "7/48 private",
      "PATCH /communities/<id>/draft/steps/members {visibility:'private', priceUsd:7, priceAnnualUsd:48, memberTrialEnabled:true, joinQuestions:[2], rules:[...], requireRulesAgreement, autoApprovePaid} -> 200 (members.annualSavingsPct 43, trialDays 7); wizard sang bước 5 (chưa ra mắt).")
    A(F, "Miễn phí: body members gửi priceUsd 0, priceAnnualUsd null, memberTrialEnabled false", "Tích hợp", "Trung bình", UIM,
      ["Chọn 'Miễn phí' ở bước 4 và Tiếp tục (Network)"], "free", "priceUsd:0, priceAnnualUsd:null, memberTrialEnabled:false; response annualSavingsPct null, trialDays 0.")
    A(F, "BE từ chối bước 4: lỗi giá năm vượt 12 lần hiển thị ở ô 'Giá hàng năm' và quay về bước 4", "Chức năng", "Trung bình", UI, ["Tạo điều kiện BE từ chối (vd. sửa giá bằng API song song) rồi bấm Tạo cộng đồng"], "priceAnnualUsd", "Lỗi fieldErrors.priceAnnualUsd (có cụm '12 lần') gắn vào ô 'Giá hàng năm'.", pw="Một phần")

    # ------------------------------------------------------------------------------------------------ 8. API BƯỚC MEMBERS + ESTIMATE
    F = "API bước members, nội quy mẫu, ước tính doanh thu"
    A(F, "PATCH members hợp lệ: giá, savings 43%, trialDays 7, nội quy giữ thứ tự (body trống thành '')", "Tích hợp", "Cao", API + " " + DEC,
      ["PATCH /communities/<id>/draft/steps/members {visibility:'private', priceUsd:7, priceAnnualUsd:48, memberTrialEnabled:true, joinQuestions:['Bạn đã từng làm gốm chưa?','Bạn biết đến lớp từ đâu?'], rules:[{title:'Tôn trọng nhau',body:'Góp ý văn minh'},{title:'Không spam'}], requireRulesAgreement:true, autoApprovePaid:false}"], "7/48",
      "200; members: priceUsd 7, priceAnnualUsd 48, annualSavingsPct 43, trialDays 7, rules.length 2 và rules[1].body '', completedSteps ['basics','members'].", pw="Không")
    A(F, "Giá năm vượt 12 lần giá tháng bị 400 với thông báo chứa '12 lần'; hạ giá tháng làm giá năm cũ vượt cũng 400", "Chức năng", "Cao", API,
      ["Lưu members 7/48", "PATCH {priceAnnualUsd:85}", "PATCH {priceUsd:3} (giữ năm 48 > 36)", "PATCH {priceAnnualUsd:0}"], "-", "Cả ba trả 400 VALIDATION_ERROR; lỗi đầu có error.details.fieldErrors.priceAnnualUsd[0] chứa '12 lần'.", pw="Không")
    A(F, "Members: giá âm / > 10000 / visibility 'secret' / 4 câu hỏi / câu hỏi 'ab' đều 400", "Chức năng", "Trung bình", API,
      ["PATCH {priceUsd:-1}", "{priceUsd:10001}", "{visibility:'secret'}", "{joinQuestions:['aaa','bbb','ccc','ddd']}", "{joinQuestions:['ab']}"], "-", "Mọi lệnh 400 VALIDATION_ERROR (giá 0..10000; câu hỏi tối đa 3, mỗi câu 3-200 ký tự).", pw="Không")
    A(F, "Members: nội quy > 20 điều, tiêu đề 81 ký tự, nội dung 501 ký tự -> 400", "Chức năng", "Thấp", API,
      ["PATCH {rules: 21 điều}", "{rules:[{title:'x'*81}]}", "{rules:[{title:'ok',body:'y'*501}]}"], "-", "Cả ba 400; 20 điều/80/500 ký tự chấp nhận.", pw="Không")
    A(F, "Tắt dùng thử -> trialDays 0; về miễn phí bỏ giá năm; free + giá năm 10 -> 400", "Chức năng", "Trung bình", API,
      ["PATCH {memberTrialEnabled:false}", "PATCH {priceUsd:0}", "PATCH {priceUsd:0, priceAnnualUsd:10}"], "-", "trialDays 0 (cả khi giá 0); priceUsd 0 làm priceAnnualUsd=null; lệnh cuối 400.", pw="Không")
    A(F, "PATCH members body rỗng {} hoặc field lạ -> 400; bước lạ ('nope') -> 400", "Chức năng", "Trung bình", API,
      ["PATCH .../steps/members {}", "PATCH .../steps/basics {foo:1}", "PATCH .../steps/nope {x:1}"], "-", "Cả ba 400 (body strict, mỗi bước chỉ nhận field của bước đó; tên bước thuộc basics|plan|identity|members).", pw="Không")
    A(F, "GET /communities/rules-template (công khai): >= 3 điều mẫu, mỗi điều có title + body", "Chức năng", "Thấp", API, ["GET /api/communities/rules-template"], "-", "200 { data: { rules: [4 điều] } } gồm 'Tôn trọng lẫn nhau', 'Không spam, không quảng cáo', 'Đăng đúng chủ đề', 'Bảo vệ thông tin riêng tư'.", pw="Không")
    A(F, "revenue-estimate price=100&members=10: gross 100.000¢, hoa hồng 10.000¢, phí cổng 3.200¢, net 86.800¢ (8.680¢/thành viên)", "Chức năng", "Cao", API + " " + DEC,
      ["GET /api/communities/revenue-estimate?price=100&members=10 (không token)"], "$100 x 10",
      "200: grossCents 100000, platformFeeCents 10000 (10%), gatewayFeeCents 3200 (2,9% + 30¢ mỗi giao dịch x10), netCents 86800, netPerMemberCents 8680, commissionPct 10, gatewayFeePct 2.9, gatewayFeeFixedCents 30, interval 'monthly', có note. platform + gateway + net = gross. Dùng đúng công thức báo cáo doanh thu thật (Global Settings).", pw="Không")
    A(F, "revenue-estimate các mốc: $7 -> net 580¢; $10 -> 841¢; $48 (annual) -> 4151¢; price=0 -> net 0", "Chức năng", "Cao", API + " " + DEC,
      ["Gọi price=7, price=10, price=48&interval=annual, price=0"], "-", "netCents lần lượt 580, 841, 4151 (platform 480¢ + gateway 169¢), 0 (không cộng phí cố định khi giá 0). Làm tròn nửa lên theo công thức (priceCents x bp + 5000) / 10000.", pw="Không")
    A(F, "revenue-estimate validate: price=abc / thiếu price / price > 100000 / members=0 / interval lạ -> 400", "Chức năng", "Thấp", API,
      ["price=abc", "(không tham số)", "price=100001", "price=7&members=0", "price=7&interval=weekly"], "-", "Mỗi lệnh 400 VALIDATION_ERROR (price 0..100000, members 1..1.000.000, interval monthly|annual).", pw="Không")
    A(F, "Ước tính theo hoa hồng/phí cổng Global Settings: đổi commissionPct=20 làm net giảm tương ứng", "Chức năng", "Trung bình", APIM + " " + GSRESET + " " + DEC,
      ["admin PATCH /api/admin/system/settings {\"payments\":{\"commissionPct\":20}}", "GET revenue-estimate?price=7", "Reset"], "20%", "platformFeeCents 140 (20% của 700) và netCents 510; commissionPct trả về 20; Reset trả 10%.", pw="Không")

    # ------------------------------------------------------------------------------------------------ 9. BƯỚC 5 + RA MẮT
    F = "Bước 5 - Tóm tắt, điều khoản, ra mắt"
    A(F, "Bước 5 (trước ra mắt) hiển thị tóm tắt 8 dòng + nút 'Sửa' dẫn về đúng bước", "Giao diện", "Cao", UIM,
      ["Điền đủ 4 bước (riêng tư, 7/48, 1 câu hỏi) và tới bước 5", "Bấm 'Sửa' ở từng dòng"], "-",
      "Các dòng: Tên cộng đồng, Đường dẫn (sofinhub.com/<slug>), Danh mục (tên), Gói (vd. 'Khởi đầu · miễn phí' hoặc 'Chuyên nghiệp · theo tháng · dùng thử 14 ngày'), Lời hứa ('Chưa có' nếu trống), Lợi ích ('n điều thành viên nhận được'), Quyền truy cập ('Riêng tư · 1 câu hỏi gia nhập'), Giá ('$7/tháng · $48/năm · dùng thử 7 ngày'). 'Sửa' nhảy về bước tương ứng (tên/đường dẫn/danh mục -> 1, gói -> 2, lời hứa/lợi ích -> 3, quyền/giá -> 4).")
    A(F, "Điều khoản: bắt buộc tích 'Tôi đồng ý với Điều khoản dành cho chủ cộng đồng'; thiếu thì báo lỗi, không gọi publish", "Chức năng", "Cao", UI,
      ["Ở bước 5 bấm 'Ra mắt cộng đồng' khi chưa tích", "Tích rồi bấm lại"], "-", "Lỗi 'Bạn cần đồng ý với Điều khoản dành cho chủ cộng đồng' (không có POST publish); tích rồi ra mắt được.")
    A(F, "Liên kết 'Xem điều khoản' mở /terms ở tab mới", "Giao diện", "Thấp", UI, ["Bấm 'Xem điều khoản'"], "-", "Mở tab mới /terms (target=_blank) trang điều khoản; wizard không mất dữ liệu.")
    A(F, "Ra mắt thành công: POST /communities/<id>/publish {acceptTerms:true} 201 và chuyển sang màn 'đã sẵn sàng!'", "Tích hợp", "Cao", UIM,
      ["Ở bước 5 tích điều khoản, bấm 'Ra mắt cộng đồng' (Network)"], "-",
      "201 CommunityDetail (viewerRole 'owner', defaultCourseId có, priceAnnualUsd/annualSavingsPct đúng); stepper tất cả ✓; thanh dưới (Quay lại/Tiếp tục) và 'Lưu nháp & thoát' biến mất; chip xanh 'Đã tạo cộng đồng', tiêu đề '<Tên> đã sẵn sàng!' và nút 'Vào cộng đồng'.")
    A(F, "Màn 'đã sẵn sàng!': 'Danh sách ra mắt' 6 mục từ launch-checklist, tiến độ 'x / 6 xong' + thanh tiến độ", "Giao diện", "Cao", UIM,
      ["Ra mắt cộng đồng mới (không logo/ảnh bìa, chưa payout)", "Đọc danh sách"], "-",
      "6 mục: 'Tạo cộng đồng & chọn gói' (xong), 'Logo, ảnh bìa & trang giới thiệu' (nút 'Cập nhật'), 'Kết nối tài khoản nhận tiền' (nút 'Kết nối'), 'Thêm bài học đầu tiên' (nút 'Mở Lớp học'), 'Viết bài chào mừng & ghim lên đầu' (nút 'Viết bài'), 'Mời 10 thành viên đầu tiên' (hiện '· 0/10', nút 'Mời'). Tiêu đề '1 / 6 xong' (hoặc 2/6 nếu đã có identity) khớp doneCount; mục xong gạch ngang, ✓ xanh.")
    A(F, "Nút của từng mục ra mắt điều hướng đúng: Cập nhật/Kết nối -> .../community/cai-dat, Mở Lớp học -> .../lop-hoc, Viết bài -> .../community", "Chức năng", "Trung bình", UIM,
      ["Ở màn 'đã sẵn sàng!' bấm lần lượt từng nút"], "-", "Đúng route: /communities/<id>/community/cai-dat (Cập nhật, Kết nối), /communities/<id>/community/lop-hoc, /communities/<id>/community; riêng 'Mời' sao chép link mời (không điều hướng).")
    A(F, "Link mời: hiển thị bỏ giao thức, 'Sao chép link mời' ghi clipboard http://localhost:5173/communities/<slug> và toast 'Đã sao chép link mời'", "Chức năng", "Cao", UIM + " Cho phép quyền clipboard của trình duyệt.",
      ["Bấm 'Sao chép link mời' (và 'Mời' ở mục 6)", "Dán vào thanh địa chỉ"], "-", "Toast 'Đã sao chép link mời'; clipboard = `${origin}/communities/<slug>` (URL thật mở được trang chi tiết). Khi trình duyệt chặn clipboard: toast 'Không sao chép được, hãy chép link thủ công'. (Mockup hiển thị sofinhub.com/<slug>: xem Kế hoạch.)", pw="Một phần")
    A(F, "Khối 'Lên trang Khám phá': 4 điều kiện (mô tả & giới thiệu, ảnh bìa, >= 10 thành viên, bài đăng 7 ngày) chỉ hiển thị", "Giao diện", "Trung bình", UIM,
      ["Ra mắt cộng đồng mới", "Đọc khối 'Lên trang Khám phá'"], "-",
      "Các dòng 'Có mô tả & trang giới thiệu', 'Có ảnh bìa', 'Ít nhất 10 thành viên 1/10' (hoặc 0/10 tùy cách đếm owner), 'Có bài đăng trong 7 ngày qua' với ✓ xanh khi đạt; chữ cuối 'Hoàn thành các điều kiện còn lại để tăng cơ hội được đề xuất.' hoặc 'Cộng đồng của bạn đã đủ điều kiện để được đề xuất.'")
    A(F, "'Vào cộng đồng' mở /communities/<slug>/community; cộng đồng đã xuất hiện trên Khám phá", "Chức năng", "Cao", UIM,
      ["Bấm 'Vào cộng đồng'", "Mở trang chủ/Khám phá, tìm tên cộng đồng"], "-", "Vào trang bảng tin cộng đồng với vai trò owner; cộng đồng công khai xuất hiện ở /?sort=newest và /api/communities ngay sau publish (chưa lọc theo điều kiện Khám phá).")
    A(F, "Ra mắt bị chặn khi thiếu bước: DRAFT_INCOMPLETE hiển thị danh sách thiếu ở bước 5 (khung đỏ)", "Chức năng", "Trung bình", UI,
      ["Tạo nháp chỉ xong bước 1 (bỏ qua bước 4) rồi vào bước 5 bằng URL/stepper (hoặc dùng API tạo nháp thiếu members rồi mở ?draft=)", "Tích điều khoản, bấm 'Ra mắt cộng đồng'"], "-",
      "400 DRAFT_INCOMPLETE với details.missing[]; khung đỏ liệt kê message từng mục thiếu (vd. của bước members); không chuyển sang màn thành công.", pw="Một phần")
    A(F, "Nhấn 'Ra mắt cộng đồng' hai lần liên tiếp chỉ tạo một cộng đồng (nút khóa 'Đang lưu…'; lần hai 409 NOT_A_DRAFT)", "Chức năng", "Cao", UIM,
      ["Ở bước 5 bấm 'Ra mắt cộng đồng' hai lần thật nhanh (double click)"], "-", "Chỉ có 1 cộng đồng; nút bị vô hiệu khi busy; nếu request thứ hai tới BE thì 409 NOT_A_DRAFT, giao diện vẫn ở màn thành công, không hiện lỗi sai.", pw="Một phần")
    A(F, "Sau khi ra mắt làm mới trang /communities/new?draft=<id> báo không tìm thấy nháp; /me/communities không còn nháp đó", "Chức năng", "Trung bình", UIM,
      ["Ra mắt xong, mở lại /communities/new?draft=<id cũ>", "Mở /me/communities"], "-", "'Không tìm thấy bản nháp' (BE 409 NOT_A_DRAFT/404); mục 'Bản nháp cộng đồng' không còn nháp đã ra mắt; cộng đồng nằm trong 'Cộng đồng của tôi' với vai trò Owner.")

    # ------------------------------------------------------------------------------------------------ 10. VÒNG ĐỜI NHÁP (UI)
    F = "Vòng đời nháp (giao diện /me/communities)"
    A(F, "Mục 'Bản nháp cộng đồng' hiển thị 3 nháp seed của owner: tên, 'Đã hoàn thành n/4 bước · sửa lần cuối <ngày>'", "Giao diện", "Cao", BASE + " " + OWNER_UI,
      ["Đăng nhập owner@sofinhub.test, mở /me/communities", "Đọc mục 'Bản nháp cộng đồng'"], "3 nháp seed",
      "Có 3 dòng: 'Lớp Gốm Cuối Tuần' (1/4), 'Chạy Bộ 5K Cho Người Mới' (3/4), 'Viết Content Ra Đơn' (4/4) - thứ tự mới sửa nhất trước (theo updatedAt giảm dần); mỗi dòng có 'Tiếp tục tạo' và 'Xóa nháp'.")
    A(F, "Người dùng không có nháp: không hiện mục 'Bản nháp cộng đồng'; chưa tham gia cộng đồng nào hiện nút 'Tạo cộng đồng'", "Giao diện", "Thấp", UI,
      ["Mở /me/communities với người dùng mới"], "user mới", "Không có mục nháp; thẻ trống 'Bạn chưa tham gia cộng đồng nào.' có hai nút 'Khám phá cộng đồng' và 'Tạo cộng đồng' (-> /communities/new).")
    A(F, "'Tiếp tục tạo' mở /communities/new?draft=<id> và nháp chưa đặt tên hiển thị 'Chưa đặt tên'", "Chức năng", "Trung bình", BASE + " " + OWNER_UI,
      ["Bấm 'Tiếp tục tạo' ở một nháp", "Quan sát URL"], "-", "Điều hướng /communities/new?draft=<id> (id được encodeURIComponent); nháp không có tiêu đề (trường hợp dữ liệu cũ) hiển thị 'Chưa đặt tên'.")
    A(F, "'Xóa nháp': hộp xác nhận 'Xóa bản nháp này? Hành động này không thể hoàn tác.'; Hủy giữ nháp, OK xóa", "Chức năng", "Cao", BASE + " " + OWNER_UI + " " + MUTATE,
      ["Bấm 'Xóa nháp' ở 'Lớp Gốm Cuối Tuần' rồi Hủy hộp xác nhận", "Bấm lại và OK"], "draft-gom-cuoi-tuan",
      "Hủy: nháp còn; OK: DELETE /communities/draft-gom-cuoi-tuan/draft -> 200 {deleted:true}, dòng biến mất; slug 'draft-gom-cuoi-tuan' lại 'còn trống'. Lỗi xóa hiện role=alert.")
    A(F, "'Lưu nháp & thoát' ở bước hợp lệ lưu bước hiện tại, toast 'Đã lưu nháp', về /me/communities", "Chức năng", "Cao", UIM,
      ["Ở bước 1 điền hợp lệ (chưa Tiếp tục), bấm 'Lưu nháp & thoát' ở sidebar", "Quan sát toast, URL, mục nháp"], "-", "POST drafts rồi toast 'Đã lưu nháp' ~2,4 giây và chuyển /me/communities; nháp mới xuất hiện 'Đã hoàn thành 1/4 bước'.")
    A(F, "'Lưu nháp & thoát' khi bước đang lỗi (tên < 3 ký tự) chặn thoát và báo lỗi, không tạo nháp", "Chức năng", "Trung bình", UI,
      ["Ở bước 1 gõ tên 'ab' rồi bấm 'Lưu nháp & thoát'"], "ab", "Hiện lỗi 'Tên cộng đồng tối thiểu 3 ký tự', ở lại wizard, không có request; riêng bước 5 bỏ qua lỗi điều khoản khi thoát.")
    A(F, "Giới hạn 5 nháp: nháp thứ 6 báo lỗi, xóa bớt thì tạo lại được", "Chức năng", "Cao", BASE + " " + OWNER_UI + " " + MUTATE,
      ["owner tạo thêm 2 nháp qua wizard (bước 1) để đủ 5", "Tạo nháp thứ 6 (bước 1 -> Tiếp tục)", "Xóa một nháp rồi thử lại"], "5 nháp",
      "Nháp thứ 6: POST drafts 409 DRAFT_LIMIT, wizard hiện thông báo lỗi chung (role=alert) ở thanh dưới; sau khi xóa một nháp thì tạo được.")
    A(F, "Nháp không hiện ở bất kỳ danh sách công khai: Khám phá, tìm kiếm, chi tiết (/communities/<id> 404), thông tin người khác", "Bảo mật", "Cao", BASE + " " + OWNER_UI,
      ["Khách/member1 mở /communities/draft-gom-cuoi-tuan", "Tìm 'Gốm' ở ô tìm kiếm Header và trang Khám phá", "GET /api/communities?limit=50 và /api/search?q=Gốm"], "draft-gom-cuoi-tuan",
      "Trang chi tiết 404/không tìm thấy; nháp không có trong danh sách và tìm kiếm; sitemap/featured cũng không.")

    # ------------------------------------------------------------------------------------------------ 11. API NHÁP
    F = "API nháp (drafts)"
    eps = [("POST /communities/drafts", "POST", "/api/communities/drafts", {"title": "Gốm Vui", "description": "d", "category": "hobby"}),
           ("GET /me/community-drafts", "GET", "/api/me/community-drafts", None),
           ("GET /communities/:id/draft", "GET", "/api/communities/<id>/draft", None),
           ("PATCH /communities/:id/draft/steps/:step", "PATCH", "/api/communities/<id>/draft/steps/basics", {"title": "Mới"}),
           ("DELETE /communities/:id/draft", "DELETE", "/api/communities/<id>/draft", None),
           ("POST /communities/:id/publish", "POST", "/api/communities/<id>/publish", {"acceptTerms": True}),
           ("GET /communities/:id/hosting-plan", "GET", "/api/communities/<id>/hosting-plan", None),
           ("PUT /communities/:id/hosting-plan", "PUT", "/api/communities/<id>/hosting-plan", {"planKey": "start"}),
           ("GET /communities/:id/payout-account", "GET", "/api/communities/<id>/payout-account", None),
           ("PUT /communities/:id/payout-account", "PUT", "/api/communities/<id>/payout-account", {"bankName": "VCB", "accountHolder": "A", "accountNumber": "123456789"}),
           ("POST /communities/:id/payout-account/skip", "POST", "/api/communities/<id>/payout-account/skip", None),
           ("GET /communities/:id/launch-checklist", "GET", "/api/communities/<id>/launch-checklist", None)]
    for name, method, path, body in eps:
        A(F, f"{name} không có token -> 401", "Bảo mật", "Cao", API, [f"{method} {path} (không header Authorization)"], "không token", "401 { error: { code } } (UNAUTHORIZED); không lộ dữ liệu.", pw="Không")
    for name, method, path, body in eps[2:11]:
        A(F, f"{name} bởi người dùng KHÁC (không phải chủ nháp) -> 404 (không lộ nháp tồn tại)", "Bảo mật", "Cao", API + " A tạo nháp, B là người khác.",
          [f"A tạo nháp lấy <id>", f"B gọi {method} {path.replace('<id>', '<id của A>')}" + (f" với body {body}" if body else "")], "token B",
          "404 NOT_FOUND (cùng như id không tồn tại: không phân biệt để tránh lộ). Dữ liệu nháp của A không đổi.", pw="Không")
    A(F, "GET /communities/:id/launch-checklist: người không phải owner -> 403; nháp chưa ra mắt -> 409 NOT_PUBLISHED", "Bảo mật", "Trung bình", API + " A tạo + ra mắt cộng đồng; B khác.",
      ["A GET checklist của nháp chưa publish", "B GET checklist của cộng đồng đã publish của A"], "-", "Lệnh 1: 409 NOT_PUBLISHED; lệnh 2: 403 (qua policy).", pw="Không")
    A(F, "Tạo nháp tối thiểu: slug mặc định = slugify(title); status 'draft', completedSteps ['basics'], nextStep 'plan'", "Tích hợp", "Cao", API,
      ["POST /api/communities/drafts {title:'Gốm Đẹp <số>', description:'d', category:'hobby'} (không slug)"], "Gốm Đẹp",
      "201 DraftView: id=slug='gom-dep-<số>', status 'draft', completedSteps ['basics'], nextStep 'plan', basics đủ, plan null, payout null, readiness.canPublish=false (thiếu members), members mặc định (visibility 'public', priceUsd 0, trialDays 0...).", pw="Không")
    A(F, "Tạo nháp: validate Zod trả fieldErrors tiếng Việt (title < 3 ký tự, description rỗng, category lạ)", "Chức năng", "Cao", API,
      ["POST drafts {title:'ab', description:'', category:'nope'}"], "-", "400 VALIDATION_ERROR; error.details.fieldErrors.title[0] chứa '3 ký tự'; description, category cũng có lỗi.", pw="Không")
    A(F, "Tạo nháp: tiêu đề 31 ký tự / mô tả 151 ký tự -> 400 (khác POST /communities một phát cho tới 80)", "Chức năng", "Trung bình", API,
      ["POST drafts với title 31 ký tự", "POST drafts với description 151 ký tự", "POST /api/communities (một phát) với title 31 ký tự"], "31/151", "Hai lệnh đầu 400; lệnh thứ ba (một phát) vẫn 201 (giới hạn 80).", pw="Không")
    A(F, "Tạo nháp: slug 'admin' -> 400 SLUG_RESERVED; 'Bad Slug' -> 400 SLUG_INVALID; 'photo' -> 409 SLUG_TAKEN", "Chức năng", "Cao", API,
      ["POST drafts với slug 'admin'", "slug 'Bad Slug'", "slug 'photo'"], "-", "Mã lỗi lần lượt SLUG_RESERVED, SLUG_INVALID (400) và SLUG_TAKEN (409).", pw="Không")
    A(F, "Tối đa 5 nháp mỗi owner: nháp thứ 6 -> 409 DRAFT_LIMIT; xóa một nháp thì tạo lại được", "Chức năng", "Cao", APIM,
      ["Tạo 5 nháp", "Tạo nháp thứ 6", "DELETE một nháp", "Tạo lại"], "5 nháp", "Lệnh 2: 409 DRAFT_LIMIT; sau xóa: 201.", pw="Không")
    A(F, "PATCH basics đổi slug: trả id mới, giữ dữ liệu; id cũ 404; slug trùng -> 409 SLUG_TAKEN", "Chức năng", "Cao", API,
      ["PATCH .../steps/basics {slug:'<mới>', title:'Tên Mới'}", "GET /communities/<id cũ>/draft", "PATCH {slug:'photo'}"], "-", "Lệnh 1: 200 id=slug mới, basics.title 'Tên Mới', dữ liệu bước khác giữ nguyên; lệnh 2: 404; lệnh 3: 409 SLUG_TAKEN.", pw="Không")
    A(F, "Sau khi ra mắt, mọi thao tác nháp -> 409 NOT_A_DRAFT (GET draft, PATCH step, DELETE)", "Chức năng", "Cao", API,
      ["Publish cộng đồng", "GET /communities/<id>/draft", "PATCH steps/basics {title:'Sau'}", "DELETE .../draft"], "-", "Cả ba 409 error.code='NOT_A_DRAFT'; dữ liệu cộng đồng không đổi.", pw="Không")
    A(F, "GET /me/community-drafts: chỉ nháp của mình, mới sửa nhất trước, không có nháp đã ra mắt", "Chức năng", "Trung bình", API + " A, B.",
      ["A tạo 2 nháp (sửa nháp 1 sau cùng)", "GET /me/community-drafts của A và của B", "A ra mắt nháp 2 rồi GET lại"], "-", "A: 2 nháp, nháp mới sửa đứng đầu; B: mảng rỗng; sau publish nháp 2 biến mất khỏi danh sách.", pw="Không")
    A(F, "Nháp ẩn khỏi danh sách/tìm kiếm/chi tiết công khai và khỏi admin", "Bảo mật", "Cao", API + " Cần token admin: " + tok("admin@sofinhub.test"),
      ["A tạo nháp 'Gốm Đẹp <số>'", "Khách GET /api/communities/<id> (404), GET /api/communities?limit=50&q=gom, GET /api/search?q=Gốm Đẹp", "admin GET /api/admin/communities (danh sách + bộ đếm trạng thái), /api/admin/discovery/communities"], "-",
      "Chi tiết 404; không có nháp trong danh sách/tìm kiếm; admin không thấy nháp (loại moderationStatus='draft' ở danh sách, bộ đếm, dashboard, Khám phá, Phân tích). Nháp không có Enrollment hay khóa học cho tới khi publish.", pw="Không")
    A(F, "Alias cũ: GET /courses/:id/draft (đường dẫn /courses/*) cũng hoạt động; route cố định /communities/slug-available không bị alias nuốt", "Tích hợp", "Thấp", API,
      ["A tạo nháp", "GET /api/courses/<id>/draft với token A", "GET /api/communities/slug-available?slug=zzz-free-slug"], "-", "Cả hai 200 (middleware community-alias để nguyên route cố định, viết lại route theo :id).", pw="Không")
    A(F, "Nháp chưa có Enrollment và khóa học (SQL) cho tới khi publish", "Tích hợp", "Trung bình", API + " SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub.",
      ["Tạo nháp, SELECT * FROM \"Enrollment\" WHERE \"courseId\"='<id>'; SELECT * FROM \"LearningCourse\" WHERE \"courseId\"='<id>'", "Publish, truy vấn lại"], "-", "Trước publish: 0 dòng cả hai; sau publish: 1 Enrollment role 'owner' và 1 khóa học mặc định (defaultCourseId).", pw="Không")

    # ------------------------------------------------------------------------------------------------ 12. PUBLISH API
    F = "API publish"
    A(F, "Publish nháp đủ điều kiện: 201, active, owner, khóa mặc định, hiện công khai; publish lần 2 -> 409", "Tích hợp", "Cao", API + " " + DEC,
      ["Tạo nháp, lưu members {priceUsd:5, priceAnnualUsd:50}", "POST publish {acceptTerms:true}", "GET /communities/<id>", "POST publish lần 2"], "5/50",
      "201: id không đổi, viewerRole 'owner', defaultCourseId có, priceAnnualUsd 50, annualSavingsPct 17, pricing 'paid'. Chi tiết công khai 200 và có trong /communities?sort=newest; /me/community-drafts không còn nó; lần 2: 409.", pw="Không")
    A(F, "Publish: thiếu body / acceptTerms:false -> 400 (TERMS_NOT_ACCEPTED); không token 401; người khác/id lạ 404", "Chức năng", "Cao", API,
      ["POST publish {} ", "{acceptTerms:false}", "Không token", "Token người khác", "id không tồn tại"], "-", "400 (body thiếu), 400 TERMS_NOT_ACCEPTED, 401, 404, 404.", pw="Không")
    A(F, "Publish nháp thiếu bước members -> 400 DRAFT_INCOMPLETE với details.missing[0].step='members'; readiness.canPublish=false", "Chức năng", "Cao", API,
      ["Tạo nháp chỉ có basics", "GET draft -> readiness", "POST publish {acceptTerms:true}", "PATCH members {priceUsd:0}", "GET draft -> readiness"], "-", "readiness.canPublish false -> publish 400 DRAFT_INCOMPLETE (missing có step 'members'); sau khi lưu members canPublish true. Bắt buộc: basics + members; identity/plan/payout bỏ qua được.", pw="Không")
    A(F, "Publish tạo transaction: Enrollment owner + khóa học mặc định + trạng thái 'active' (SQL)", "Tích hợp", "Trung bình", API + " SQL psql.",
      ["Publish nháp", "SELECT \"moderationStatus\",\"ownerId\" FROM \"Course\" WHERE id='<id>'", "SELECT role FROM \"Enrollment\" WHERE \"courseId\"='<id>'", "SELECT id,title FROM \"LearningCourse\" WHERE \"courseId\"='<id>'"], "-", "moderationStatus 'active' (không qua duyệt - chưa có luồng duyệt cộng đồng mới), ownerId đúng, Enrollment role 'owner', 1 khóa học mặc định.", pw="Không")
    A(F, "Publish hai request đồng thời: chỉ một 201, request còn lại 409 (không tạo trùng owner/khóa học)", "Hiệu năng", "Trung bình", APIM,
      ["Gửi 2 POST publish cùng lúc (Promise.all / 2 terminal)"], "song song", "Một 201, một 409; DB chỉ có 1 Enrollment owner và 1 khóa mặc định.", pw="Không")
    A(F, "Publish cộng đồng riêng tư có giá: pricing 'paid', visibility 'private', joinQuestions + rules xuất hiện ở GET /communities/:id", "Tích hợp", "Trung bình", API,
      ["Lưu members private 7/48 + 2 câu hỏi + 2 nội quy + requireRulesAgreement", "Publish", "GET /api/communities/<id>"], "-", "CommunityDetail có joinQuestions (2), rules (2), requireRulesAgreement true, priceUsd 7, priceAnnualUsd 48, annualSavingsPct 43, memberTrialEnabled true.", pw="Không")
    A(F, "Publish không qua bước payout: tự tạo PayoutAccount status 'skipped'", "Chức năng", "Cao", API,
      ["Publish cộng đồng chưa bao giờ gọi payout-account", "GET /communities/<id>/payout-account (owner)"], "-", "data.status='skipped' (cộng đồng wizard chưa kết nối sẽ bị chặn rút tiền - xem nhóm payout).", pw="Không")

    # ------------------------------------------------------------------------------------------------ 13. TƯƠNG THÍCH POST /communities
    F = "Tương thích POST /communities (một phát) + sửa sau ra mắt"
    A(F, "POST /communities (một phát) không gửi trường mới: giá năm null, memberTrialEnabled true, joinQuestions []", "Tích hợp", "Cao", API,
      ["POST /api/communities {title:'Một Phát', description:'d', category:'tech', priceUsd:0, visibility:'public'}"], "-", "201 như cũ; priceAnnualUsd null, memberTrialEnabled true, joinQuestions [], không có bản ghi payout (GET payout-account null). Route cũ vẫn chạy, không đòi acceptTerms.", pw="Không")
    A(F, "POST /communities với priceAnnualUsd hợp lệ lưu; vượt 12 lần -> 400", "Chức năng", "Cao", API,
      ["POST {priceUsd:7, priceAnnualUsd:48,...}", "POST {priceUsd:7, priceAnnualUsd:99,...}"], "7/48, 7/99", "Lệnh 1: 201 annualSavingsPct 43; lệnh 2: 400 VALIDATION_ERROR.", pw="Không")
    A(F, "PATCH /communities/:id sau ra mắt nhận các trường mới (priceAnnualUsd, promise, brandColor, joinQuestions...)", "Chức năng", "Cao", API,
      ["Owner PATCH {priceAnnualUsd:60, promise:'Lời hứa', brandColor:'#112233', joinQuestions:['Bạn là ai vậy?']}", "PATCH {priceAnnualUsd:100}", "PATCH {priceUsd:0}"], "-", "Lệnh 1: 200 các trường được lưu; lệnh 2: 400 (> 12 x 7 = 84... theo giá hiện tại); lệnh 3: 200 và priceAnnualUsd tự về null.", pw="Không")
    A(F, "Cộng đồng tạo kiểu cũ giữ luồng rút tiền cũ: không có bản ghi payout, rút phải kèm method", "Chức năng", "Cao", API,
      ["Tạo cộng đồng một phát", "GET payout-account -> null", "POST /communities/<id>/payouts {amountCents:5000, method:{type:'bank',bankName:'VCB',accountNumber:'123456789',accountHolder:'A'}}", "POST payouts {amountCents:5000} (không method)"], "-", "Lệnh 3: 400 PAYOUT_EXCEEDS_AVAILABLE (chưa có doanh thu, nhưng qua guard); lệnh 4: 400 PAYOUT_ACCOUNT_REQUIRED (thiếu method như trước).", pw="Không")
    A(F, "Sau ra mắt chưa có giao diện upload logo/ảnh bìa trong Cài đặt cộng đồng", "Chức năng", "Thấp", UI,
      ["Ra mắt cộng đồng", "Vào /communities/<id>/community/cai-dat tìm mục logo/ảnh bìa"], "-", "HIỆN TẠI: PATCH /communities/:id nhận brandColor/promise/benefits/introVideoUrl nhưng KHÔNG có upload logo/cover sau ra mắt (docs mục 10) và nút 'Cập nhật' trong danh sách ra mắt chỉ dẫn tới Cài đặt chung. KỲ VỌNG: sửa được logo/ảnh bìa sau ra mắt. Kế hoạch.", pw="Một phần", st=PLAN)

    # ------------------------------------------------------------------------------------------------ 14. PAYOUT
    F = "Tài khoản nhận tiền (payout, mô phỏng)"
    A(F, "GET payout-account: chưa chọn -> null; owner kể cả trên nháp; PUT validate (12ab, 5 chữ số, 21 chữ số, thiếu tên) -> 400", "Chức năng", "Cao", API,
      ["GET payout-account -> data null", "PUT {bankName:'VCB',accountHolder:'A',accountNumber:'12ab'}", "'12345'", "'1'*21", "{accountHolder:'', ...}"], "-", "GET 200 null; các PUT sai 400 VALIDATION_ERROR (accountNumber 6-20 chữ số, bankName/accountHolder 1-100). Body strict.", pw="Không")
    A(F, "PUT payout hợp lệ: status 'connected', accountMasked '****8812', response không chứa số đầy đủ", "Bảo mật", "Cao", API,
      ["PUT {bankName:'Vietcombank', accountHolder:'NGUYEN VAN A', accountNumber:'0123456788812'}", "SELECT * FROM \"PayoutAccount\" WHERE \"communityId\"='<id>' (psql)"], "0123456788812", "200 {status:'connected', bankName, accountHolder, accountMasked:'****8812', connectedAt, note}; JSON và bảng DB chỉ giữ 4 số cuối (accountLast4=8812), không có chuỗi số đầy đủ.", pw="Không")
    A(F, "POST payout-account/skip -> 'skipped'; skip không ghi đè tài khoản đã kết nối", "Chức năng", "Trung bình", API,
      ["POST skip", "PUT payout hợp lệ", "POST skip lần nữa"], "-", "Lệnh 1 status 'skipped'; lệnh 2 'connected'; lệnh 3 vẫn 'connected'.", pw="Không")
    A(F, "Guard rút tiền: skipped + POST /payouts -> 400 PAYOUT_ACCOUNT_REQUIRED (kể cả khi gửi method trong body)", "Chức năng", "Cao", API,
      ["Ra mắt nháp với payout 'skipped'", "POST /communities/<id>/payouts {amountCents:5000}", "POST payouts {amountCents:5000, method:{type:'bank',...}}"], "skipped", "Cả hai 400 error.code='PAYOUT_ACCOUNT_REQUIRED'.", pw="Không")
    A(F, "Sau khi kết nối payout: method trong body là tùy chọn, qua guard (400 PAYOUT_EXCEEDS_AVAILABLE vì chưa có doanh thu)", "Chức năng", "Cao", API,
      ["PUT payout hợp lệ", "POST payouts {amountCents:5000} (không method)"], "connected", "400 PAYOUT_EXCEEDS_AVAILABLE (không còn ACCOUNT_REQUIRED) - chứng tỏ dùng tài khoản đã kết nối. Cộng đồng cũ (không bản ghi) giữ luồng cũ.", pw="Không")
    A(F, "Nháp seed 'Viết Content Ra Đơn': payout đã kết nối (Vietcombank ****8812) -> mục 'Kết nối' ở danh sách ra mắt hoàn thành sau publish", "Chức năng", "Trung bình", BASE + " " + OWNER_UI + " " + MUTATE,
      ["owner publish draft-viet-content (bước 5, tích điều khoản)", "Mở danh sách ra mắt"], "draft-viet-content", "Mục 'Kết nối tài khoản nhận tiền' ✓ xong; GET payout-account status 'connected', accountMasked '****8812'.", pw="Một phần")
    A(F, "Xét duyệt danh tính 3-5 ngày chỉ là chữ trong UI - không có KYC thật (mô phỏng)", "Chức năng", "Thấp", UI + " " + DEC,
      ["Kết nối tài khoản nhận tiền ở bước 4", "Kiểm tra có trạng thái 'đang xét duyệt' hay bước xác minh nào không"], "-", "HIỆN TẠI: kết nối là ngay lập tức (status 'connected'), không xác minh danh tính, không chuyển khoản thử; chữ 'có thể mất vài ngày làm việc' chỉ là mô tả. Chờ quyết định cổng chi trả thật. Kế hoạch.", pw="Không", st=PLAN)

    # ------------------------------------------------------------------------------------------------ 15. JOIN-REQUEST + CÂU HỎI
    F = "Câu hỏi gia nhập, nội quy, tự duyệt (join request)"
    PRIV = API + " Owner A tạo + ra mắt cộng đồng RIÊNG TƯ có joinQuestions ['Bạn đã làm gốm chưa?','Biết đến lớp từ đâu?']; người xin gia nhập M."
    A(F, "GET /communities/:id (công khai) trả joinQuestions, rules, requireRulesAgreement để dựng form", "Chức năng", "Cao", PRIV, ["GET /api/communities/<id>"], "-", "Có joinQuestions (2 chuỗi), rules[], requireRulesAgreement (bool).", pw="Không")
    A(F, "POST join-requests thiếu câu trả lời -> 400 JOIN_ANSWERS_REQUIRED (không body, 1/2 câu, câu toàn dấu cách)", "Chức năng", "Cao", PRIV,
      ["M POST /communities/<id>/join-requests {message:'Cho em vào'}", "{answers:['Chưa']}", "{answers:['Chưa','  ']}"], "-", "Cả ba 400 error.code='JOIN_ANSWERS_REQUIRED'; không tạo yêu cầu.", pw="Không")
    A(F, "POST join-requests đủ câu trả lời: 201 và lưu BẢN CHỤP [{question, answer}]", "Chức năng", "Cao", PRIV,
      ["M POST join-requests {message:'Cho em vào', answers:['Chưa từng','Qua Facebook']}"], "-", "201; data.answers = [{question:'Bạn đã làm gốm chưa?', answer:'Chưa từng'}, {question:'Biết đến lớp từ đâu?', answer:'Qua Facebook'}]. Mỗi câu trả lời 1-500 ký tự (501 -> 400).", pw="Không")
    A(F, "Đổi câu hỏi sau đó: yêu cầu cũ giữ nguyên bản chụp; admin+ xem được answers, member thường 403", "Chức năng", "Cao", PRIV,
      ["M gửi yêu cầu có answers", "Owner PATCH /communities/<id> {joinQuestions:['Câu hỏi mới?']}", "Owner GET /communities/<id>/join-requests?status=pending", "M GET join-requests"], "-",
      "Owner thấy answers[0].question vẫn 'Bạn đã làm gốm chưa?' và answers[1].answer 'Qua Facebook'; M nhận 403 (chỉ admin+).", pw="Không")
    A(F, "Cộng đồng riêng tư KHÔNG có câu hỏi: luồng cũ, answers [] trong response", "Chức năng", "Trung bình", API + " Cộng đồng riêng tư không câu hỏi (private-demo seed hoặc tự tạo).",
      ["POST join-requests {message:'hi'} bởi newbie@"], "private-demo", "201 answers: [] ; admin vẫn thấy yêu cầu như trước.", pw="Không")
    A(F, "requireRulesAgreement + có nội quy: không gửi acceptRules -> 400 RULES_NOT_ACCEPTED; có acceptRules:true -> 201 rulesAcceptedAt", "Chức năng", "Cao", API + " Cộng đồng riêng tư requireRulesAgreement=true, rules [{title:'Tôn trọng'}], không câu hỏi.",
      ["POST join-requests {message:'x'}", "POST {acceptRules:true}"], "-", "Lệnh 1: 400 RULES_NOT_ACCEPTED; lệnh 2: 201 và rulesAcceptedAt có giá trị.", pw="Không")
    A(F, "requireRulesAgreement bật nhưng cộng đồng không có nội quy nào: không bắt acceptRules", "Chức năng", "Thấp", API, ["Cộng đồng private requireRulesAgreement=true, rules []", "POST join-requests {}"], "-", "201 (chỉ ép khi có nội quy).", pw="Không")
    A(F, "Cộng đồng CÔNG KHAI có joinQuestions: tham gia thẳng (enroll/checkout) không cần trả lời (câu hỏi chỉ dùng cho yêu cầu tham gia riêng tư)", "Chức năng", "Trung bình", API, ["Tạo cộng đồng công khai miễn phí có joinQuestions", "member1 POST /communities/<id>/enroll"], "-", "200 enrolled:true, không yêu cầu answers.", pw="Không")
    A(F, "NGHI VẤN UI: hộp thoại 'Cộng đồng riêng tư' (JoinRequestDialog) chưa hiển thị câu hỏi/nội quy -> gửi yêu cầu bị JOIN_ANSWERS_REQUIRED", "Chức năng", "Cao", UI + " Cộng đồng riêng tư có câu hỏi: ra mắt nháp wizard bước 4 'Riêng tư' + 2 câu hỏi (hoặc seed draft-viet-content) rồi đăng nhập user khác.",
      ["Mở trang chi tiết cộng đồng riêng tư có câu hỏi", "Bấm 'Gửi yêu cầu tham gia' -> hộp thoại -> 'Gửi yêu cầu' (chỉ có ô 'Lời nhắn')"], "2 câu hỏi",
      "HIỆN TẠI (qua đọc code: JoinRequestDialog chỉ có ô Lời nhắn, không gửi answers/acceptRules): BE trả 400 JOIN_ANSWERS_REQUIRED và hộp thoại hiện lỗi, người xin gia nhập KHÔNG thể gửi yêu cầu bằng giao diện. KỲ VỌNG: hộp thoại hiển thị từng câu hỏi (+ checkbox đồng ý nội quy) rồi gửi answers/acceptRules. Kế hoạch (cần làm FE).", pw="Có", st=PLAN)
    A(F, "NGHI VẤN UI: danh sách yêu cầu tham gia của admin chưa hiển thị câu trả lời của người xin", "Chức năng", "Trung bình", UI + " Có yêu cầu tham gia kèm answers được gửi bằng API.",
      ["Owner mở Cài đặt cộng đồng > Yêu cầu tham gia", "Tìm phần câu hỏi/câu trả lời"], "-", "HIỆN TẠI: BE trả answers [{question,answer}] nhưng không có mã FE nào hiển thị (grep answers ngoài wizard không có) -> approver chỉ thấy lời nhắn. KỲ VỌNG: hiển thị câu hỏi + trả lời để duyệt. Kế hoạch.", pw="Một phần", st=PLAN)
    A(F, "requireRulesAgreement CHƯA được ép ở checkout, dùng thử và tham gia miễn phí (chỉ ép ở join-requests)", "Chức năng", "Trung bình", API + " Cộng đồng công khai có phí (hoặc miễn phí) requireRulesAgreement=true và có nội quy.",
      ["Thành viên POST /communities/<id>/checkout hoặc /trial", "Thành viên POST /communities/<id>/enroll (miễn phí)"], "-", "HIỆN TẠI: thành công mà không cần acceptRules (docs mục 10). KỲ VỌNG: người vào không qua duyệt cũng phải đồng ý nội quy khi toggle bật. Kế hoạch.", pw="Không", st=PLAN)
    A(F, "autoApprovePaid=true: cộng đồng riêng tư CÓ PHÍ cho thanh toán/dùng thử trực tiếp, không cần duyệt; =false -> JOIN_REQUEST_REQUIRED", "Chức năng", "Cao", API + " Hai cộng đồng riêng tư $7/$48, một autoApprovePaid=true, một false.",
      ["member POST /communities/<A>/checkout {interval:'annual'} (autoApprovePaid=true)", "member POST /communities/<B>/checkout (false)", "Lặp với /trial"], "-", "A: 201 intent 4800¢ (annual); B: 403 JOIN_REQUEST_REQUIRED; /trial tương tự (A 201, B 403). Cộng đồng riêng tư MIỄN PHÍ vẫn cần duyệt dù bật.", pw="Không")

    # ------------------------------------------------------------------------------------------------ 16. LAUNCH CHECKLIST
    F = "API danh sách ra mắt + điều kiện Khám phá"
    A(F, "launch-checklist cộng đồng mới: 6 mục (created, identity, payout, first_lesson, welcome_post, invite_members) tính từ dữ liệu thật", "Chức năng", "Cao", API + " Owner đã publish cộng đồng có promise + cover (upload hợp lệ).",
      ["GET /communities/<id>/launch-checklist (owner)"], "-", "total 6; doneCount 2 (created, identity true; payout, first_lesson, welcome_post, invite_members false); invite_members.required 10; discovery.eligible false; conditions has_description_and_promise true, has_cover true, min_members false, recent_post false.", pw="Không")
    A(F, "Checklist cập nhật theo hành động thật: kết nối payout, đăng bài ghim chào mừng, thêm bài học, thêm thành viên", "Chức năng", "Trung bình", API + " " + MUTATE,
      ["PUT payout-account hợp lệ", "Owner đăng bài và ghim (hoặc tạo Post pinned bằng API)", "Owner thêm bài học vào khóa mặc định", "Thêm 3 thành viên (enroll)", "GET checklist"], "-", "payout true, welcome_post true (và recent_post true), first_lesson true, invite_members.current phản ánh số thành viên (/10); doneCount tăng tương ứng.", pw="Không")
    A(F, "Điều kiện Khám phá chỉ để hiển thị: cộng đồng chưa đủ 10 thành viên vẫn xuất hiện ở /communities và Khám phá", "Chức năng", "Cao", API + " " + DEC,
      ["Publish cộng đồng công khai mới (1 thành viên)", "GET /api/communities?sort=newest", "GET checklist -> discovery.eligible"], "-", "eligible=false nhưng cộng đồng vẫn có trong danh sách công khai (luồng cũ). KỲ VỌNG nghiệp vụ (A16): điều kiện lọc 'được đề xuất'. Chưa làm -> Kế hoạch.", pw="Không", st=PLAN)
    A(F, "Link mời dùng đường dẫn /communities/<slug>; không có route rút gọn sofinhub.com/<slug>", "Chức năng", "Thấp", UI,
      ["Sao chép link mời ở màn thành công", "Thử mở http://localhost:5173/<slug> (không có /communities/)"], "-", "HIỆN TẠI: link thật là ${origin}/communities/<slug> (mở được); /<slug> trần không có route (404/trang không tìm thấy). Mockup hiển thị 'sofinhub.com/<slug>' như link chia sẻ. Kế hoạch: route rút gọn/domain.", pw="Có", st=PLAN)
    A(F, "Nút 'Dùng mẫu' của mockup (bài chào mừng mẫu) chưa có: danh sách ra mắt chỉ có 'Viết bài' dẫn tới bảng tin", "Giao diện", "Thấp", UI,
      ["Ở danh sách ra mắt xem mục 'Viết bài chào mừng & ghim lên đầu'"], "-", "HIỆN TẠI: nút 'Viết bài' điều hướng tới /communities/<id>/community (không có mẫu bài viết/form nhanh; docs/features ghi nút 'Dùng mẫu' nhưng UI đang dùng 'Viết bài'). Kế hoạch.", pw="Có", st=PLAN)

    # ------------------------------------------------------------------------------------------------ 17. GLOBAL SETTINGS
    F = "Global Settings owner.* và hiệu lực"
    A(F, "Cài đặt chung (Admin) chưa có ô owner.* - chỉ chỉnh được qua API PATCH /admin/system/settings", "Giao diện", "Thấp", BASE + " Đăng nhập admin@sofinhub.test, mở /admin/system/settings.",
      ["Tìm ô 'Yêu cầu chọn gói', 'Dùng thử chủ cộng đồng', 'Giá gói Chuyên nghiệp'", "PATCH /api/admin/system/settings {\"owner\":{\"requirePlan\":true}} bằng token admin"], "-", "HIỆN TẠI: giao diện không có nhóm owner.* (và cũng không có payments.annualPeriodDays/trialReminderDays) nhưng API nhận và có hiệu lực ngay. Kế hoạch: thêm ô vào Cài đặt chung.", pw="Một phần", st=PLAN)
    A(F, "owner.* validate: trialDays 0 hoặc 366, giá âm, feePct 101, currency 'XXX' -> 400", "Chức năng", "Thấp", API + " " + tok("admin@sofinhub.test"),
      ["PATCH settings {owner:{trialDays:0}}", "{trialDays:366}", "{proMonthlyPrice:-1}", "{startFeePct:101}", "{currency:'XXX'}", "{foo:1}"], "-", "Mỗi lệnh 400 (trialDays 1..365, giá 0..1e9, fee 0..100, currency USD|VND|EUR, body strict).", pw="Không")
    A(F, "payments.annualPeriodDays=100 làm kỳ gói năm mới tạo dài 100 ngày; payments.trialReminderDays đổi cửa sổ nhắc", "Chức năng", "Trung bình", APIM + " " + GSRESET + " " + DEC,
      ["admin PATCH {\"payments\":{\"annualPeriodDays\":100}}", "Thành viên mua gói năm", "Đọc currentPeriodEnd - currentPeriodStart", "Reset"], "100 ngày", "Kỳ = 100 ngày (không còn 365); đặt lại thì 365. (trialReminderDays 0..30; 0 = không nhắc.)", pw="Không")
    A(F, "Hết dùng thử owner (owner.trialDays=1) và cộng đồng đang dùng thử không làm hỏng wizard (chỉ đổi chữ)", "Chức năng", "Thấp", APIM + " " + GSRESET,
      ["PATCH {\"owner\":{\"trialDays\":1}}", "Mở bước 2"], "1", "Tiêu đề 'Dùng thử 1 ngày, chưa trừ đồng nào'; trialEndsAt = +1 ngày; không lỗi layout.", pw="Một phần")

    # ------------------------------------------------------------------------------------------------ 18. BẢO MẬT
    F = "Bảo mật & phân quyền wizard"
    A(F, "Không có số thẻ/CVC nào rời trình duyệt: kiểm tra toàn bộ request khi nhập thẻ ở bước 2", "Bảo mật", "Cao", UI,
      ["Mở Network, bật 'Preserve log'", "Nhập thẻ 4242 4242 4242 4242 + CVC 123 ở bước 2, bấm 'Bắt đầu dùng thử'", "Tìm chuỗi 4242424242424242 và 123 trong mọi request/response"], "4242 4242 4242 4242 / 123",
      "Không có request nào chứa số thẻ đầy đủ hay CVC (chỉ token 'tok_mock_<hex>', brand, last4, hạn). Không có trong localStorage/sessionStorage/cookie (wizard không dùng localStorage). Số thẻ/CVC biến khỏi ô sau khi tokenise.")
    A(F, "Token thẻ mock ngẫu nhiên mỗi lần: hai lần lưu cùng một thẻ cho hai token khác nhau", "Bảo mật", "Thấp", UI, ["Lưu thẻ 4242 ở bước 2, ghi token", "Dùng thẻ khác rồi lại nhập 4242 và ghi token"], "-", "Token dạng tok_mock_ + 24 ký tự hex khác nhau (crypto.getRandomValues); không suy ra được số thẻ từ token.", pw="Một phần")
    A(F, "IDOR: người khác không đọc/sửa/xóa/publish nháp của mình bằng cách đoán id (slug)", "Bảo mật", "Cao", API + " A có nháp S; B là người khác.",
      ["B GET/PATCH/DELETE/publish /communities/S/draft...", "B GET /me/community-drafts"], "-", "Tất cả 404 hoặc danh sách rỗng; nháp của A không đổi (đã bao phủ từng endpoint ở nhóm API nháp).", pw="Không")
    A(F, "Mass assignment: gửi ownerId/moderationStatus/status trong body bước hoặc POST drafts bị 400 (strict)", "Bảo mật", "Cao", API,
      ["POST drafts {title,description,category, ownerId:'<id khác>', moderationStatus:'active'}", "PATCH basics {moderationStatus:'active'}", "PATCH members {ownerId:'x'}"], "-", "Mọi lệnh 400 (schema strictObject), nháp không đổi trạng thái; không thể tự 'active' bằng PATCH.", pw="Không")
    A(F, "XSS: tên/mô tả/lời hứa/lợi ích/câu hỏi chứa <script> được hiển thị như văn bản ở trang chi tiết, xem trước và hộp thoại", "Bảo mật", "Cao", UIM,
      ["Tạo cộng đồng với tên '<img src=x onerror=alert(1)>' (30 ký tự), lời hứa và lợi ích có <script>", "Mở xem trước, trang chi tiết, hộp thoại tham gia, danh sách Khám phá"], "<script>alert(1)</script>", "Không thực thi script ở mọi nơi; hiển thị nguyên văn (escape).")
    A(F, "Tài khoản bị khóa/đình chỉ không tạo được nháp (403)", "Bảo mật", "Trung bình", API + " Dùng người dùng ở trạng thái hạn chế theo seed (Admin đợt 1) hoặc đặt trạng thái qua Admin.",
      ["POST /communities/drafts bằng token người dùng restricted/suspended"], "-", "403 (hợp đồng: user bị khóa -> 403); suspended/banned không đăng nhập được.", pw="Không")
    A(F, "Rate limit: gọi PATCH step liên tục không làm hỏng dữ liệu; ghi nhận 429 nếu vượt giới hạn ghi toàn cục", "Hiệu năng", "Thấp", API, ["Gửi 100 PATCH basics liên tiếp trong 1 phút"], "100 req", "Mọi response hợp lệ (200) hoặc 429 có Retry-After khi vượt rate limit ghi; dữ liệu cuối cùng là lần ghi thành công gần nhất.", pw="Không")

    # ------------------------------------------------------------------------------------------------ 19. MỤC KẾ HOẠCH / LỆCH
    F = "Điểm chưa làm / lệch tài liệu-mockup-code"
    A(F, "Dọn nháp bị bỏ quên: chưa có job tự xóa nháp không hoạt động lâu ngày", "Chức năng", "Thấp", API + " SQL psql.",
      ["Đặt updatedAt của một nháp về 90 ngày trước: UPDATE \"Course\" SET \"updatedAt\"=now()-interval '90 days' WHERE id='<nháp>'", "Chờ các job nền chạy", "Kiểm tra nháp còn không"], "nháp cũ 90 ngày", "HIỆN TẠI: nháp vẫn còn (chiếm slug và 1/5 suất). KỲ VỌNG: job dọn nháp quá hạn (chưa có trong jobs.ts). Kế hoạch.", pw="Không", st=PLAN)
    A(F, "Xem trước chỉ có ở bước 1 (Trên Khám phá) và bước 3 (trang giới thiệu), không có ở bước 2/4", "Giao diện", "Thấp", UI,
      ["Đi qua 5 bước và quan sát cột phải"], "-", "HIỆN TẠI: cột xem trước chỉ hiện ở bước 1 và 3 (mockup/ghi chú code còn nhắc bước 2, 4). Hiển thị giá ('Giá đặt ở bước 4') chưa cập nhật theo bước 4 vì không có khung xem trước ở đó. Kế hoạch.", st=PLAN)
    A(F, "Biểu tượng kéo-thả sắp xếp lợi ích/câu hỏi chỉ là hình thức (không kéo được)", "Giao diện", "Thấp", UI, ["Thêm 3 lợi ích, thử kéo biểu tượng ⋮⋮ lên xuống", "Thử với câu hỏi gia nhập"], "-", "HIỆN TẠI: không đổi thứ tự được (thứ tự = thứ tự nhập). Kế hoạch (docs/features gap).", st=PLAN)
    A(F, "Danh mục: GET /categories trả 11 sau seed (8 cũ + Âm nhạc/Thể thao/Tâm linh); docs ghi 8; mockup/enum kỳ vọng 13 (thiếu Tiếp thị, Thiết kế)", "Chức năng", "Trung bình", UI,
      ["GET /api/categories", "Đọc danh mục ở bước 1", "Admin > Khám phá > Danh mục: bật thêm 'marketing' và 'design' rồi mở lại bước 1"], "8 / 11 / 13",
      "HIỆN TẠI: DB đã seed trả 11 mục (DB test chưa seed trả 8 - đúng như docs/features ghi 'hiện trả 8'); marketing/design chỉ hiện khi admin thêm (enum chấp nhận 13 giá trị). KỲ VỌNG: thống nhất số danh mục giữa mockup (13?), docs và UI. Lệch cần ghi nhận.", pw="Một phần", st=PLAN)
    A(F, "Nhãn mockup 'Để sau' (payout) khác UI 'Bỏ qua, làm sau'; mockup 'Hôm nay: 0đ' khác UI '0 ₫'", "Giao diện", "Thấp", UI, ["Đối chiếu bước 2 và bước 4 với mockup template.html"], "-", "HIỆN TẠI: UI dùng 'Bỏ qua, làm sau' và 'Hôm nay: 0 ₫.' (Intl vi-VN VND). Mockup: 'Để sau' và '0đ'. Lệch nhỏ cần chủ sản phẩm chọn.", st=PLAN)
    A(F, "Gói owner/dùng thử/nhắc 3 ngày: chưa có email nhắc và chưa trừ tiền thật cho GÓI HOSTING của owner (khác nhắc của thành viên)", "Chức năng", "Trung bình", API + " " + DEC,
      ["Lưu gói pro, đẩy trialEndsAt còn 2 ngày", "Chờ job nền, kiểm tra outbox GET /api/dev/outbox?to=<email owner> và /api/notifications"], "-", "HIỆN TẠI: không có email/thông báo 'sắp hết dùng thử' cho gói owner (remindDaysBefore chỉ hiển thị trong /owner-plans; job payments.trialReminders chỉ xử lý gói thành viên). Kế hoạch (phụ thuộc A16).", pw="Không", st=PLAN)
    A(F, "Điều kiện ra mắt 'Mời 10 thành viên' đếm cả owner hay không: current/required hiển thị nhất quán với số thành viên", "Chức năng", "Thấp", UIM, ["Ra mắt cộng đồng mới (chỉ owner)", "Đọc '· n/10' ở mục mời và 'Ít nhất 10 thành viên n/10'", "So với số thành viên ở trang chi tiết"], "-", "Hai chỗ hiển thị cùng giá trị current, khớp stats.members của trang chi tiết (ghi rõ có tính owner hay không khi chạy để thống nhất).", pw="Một phần")


# ====================================================================================================================
#                                                  MODULE ANN
# ====================================================================================================================
def load_ann(add):
    M, MN = "ANN", "Gói năm & dialog tham gia"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    DEMO = ("Cộng đồng 'annual-demo' (seed): 'Cộng đồng gói năm (demo)', công khai, owner@sofinhub.test làm chủ, $7/tháng + $48/năm (tiết kiệm 43%), dùng thử 7 ngày, "
            "màu #2563eb, promise 'Học đều mỗi tuần, tiết kiệm 43% khi trả theo năm', 2 lợi ích, 1 nội quy; 'paid-demo' chỉ có $19/tháng (không giá năm).")
    UIB = BASE + " " + DEMO + " Đăng nhập UI newbie@sofinhub.test / " + PW + " (chưa thuộc cộng đồng nào) hoặc người dùng mới đăng ký."
    UIM = UIB + " " + MUTATE
    NEWU = ("Người dùng MỚI (đăng ký ở /register hoặc POST /api/auth/register {firstName,lastName,email,password:'Passw0rd!x'}), dùng tài khoản mới cho mỗi case ghi dữ liệu.")
    COMM = ("Cộng đồng có phí do owner mới tạo: POST /api/communities {\"title\":\"Gói Năm <số ngẫu nhiên>\",\"description\":\"d\",\"category\":\"tech\",\"priceUsd\":7,\"priceAnnualUsd\":48,\"visibility\":\"public\"} -> id "
            "(muốn không có gói năm thì bỏ priceAnnualUsd; muốn tắt thử thì thêm memberTrialEnabled:false).")
    CARDJ = "paymentMethod = {\"type\":\"card\",\"token\":\"tok_mock_abcdef123456\",\"brand\":\"visa\",\"last4\":\"4242\",\"expMonth\":12,\"expYear\":<năm hiện tại + 3>}"
    SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (cột cộng đồng của mọi bảng tên \"courseId\"). Job nền: payments.subscriptions mỗi 5 phút, payments.trialReminders mỗi 15 phút."
    API = BASE + " " + NEWU + " " + COMM + " Mọi API có tiền tố /api; thành công { data }, lỗi { error: { code, message } }."
    APIM = API + " " + MUTATE
    JOB = APIM + " " + SQLH

    # ============================================================================================ 1. MỞ HỘP THOẠI + HEADER
    F = "Mở hộp thoại & phần đầu (header)"
    A(F, "Cộng đồng có phí: bấm 'Tham gia ngay' mở hộp thoại 'Chọn gói thành viên' (sau khi BE trả 402 PAYMENT_REQUIRED)", "Chức năng", "Cao", UIB,
      ["Mở /communities/annual-demo", "Bấm 'Tham gia ngay' (mở Network)"], "annual-demo",
      "POST /communities/annual-demo/enroll trả 402 PAYMENT_REQUIRED rồi hiện hộp thoại modal (role=dialog, aria-label 'Chọn gói thành viên', nền mờ); nền trang không cuộn; không có trang chuyển hướng.")
    A(F, "Header hộp thoại: logo (hoặc ô 'Logo' có 2 chữ cái đầu), tên cộng đồng, 'Cộng đồng <danh mục> · do <chủ> dẫn dắt'", "Giao diện", "Cao", UIB,
      ["Mở hộp thoại của annual-demo", "Đối chiếu với ảnh thiết kế 3.png"], "annual-demo",
      "Ô vuông xanh đậm bo góc (biểu tượng ảnh + 2 chữ cái đầu tên, ví dụ 'CỘ' vì chưa có logo), tiêu đề 'Cộng đồng gói năm (demo)', dòng phụ 'Cộng đồng sở thích · do Olivia Owner dẫn dắt' (danh mục viết thường). Nếu cộng đồng có logoUrl (tạo từ wizard) thì hiện ảnh logo.")
    A(F, "Chip thống kê lấy dữ liệu THẬT: 'N+ thành viên' (khi >= 10), 'số bài học' (chỉ khi > 0), 'điểm đánh giá' hoặc 'đang trực tuyến'", "Giao diện", "Cao", UIB,
      ["Mở hộp thoại ở cộng đồng có >= 10 thành viên, có bài học, có đánh giá (vd. photo - nhưng miễn phí nên dùng ai $7 'ai' catalogue)", "Mở ở annual-demo (ít thành viên, chưa bài học, chưa đánh giá)"], "ai / annual-demo",
      "Cộng đồng đông: '<N>+' (formatCompact) 'thành viên', '<n>' 'bài học', '<rating>' '<k> đánh giá'. annual-demo: số thành viên không có dấu '+' (dưới 10), KHÔNG có chip bài học (0 bài), chip thứ 3 là 'đang trực tuyến' (không có đánh giá).")
    A(F, "Chip không còn chữ marketing cứng của ảnh thiết kế ('Nội dung chất lượng', 'Học hỏi & phát triển')", "Giao diện", "Thấp", UIB,
      ["Mở hộp thoại và đọc toàn bộ chip"], "-", "Không có hai chip marketing này (đã thay bằng dữ liệu thật - docs/features/community-wizard.md mục Gaps). Ảnh thiết kế 3.png còn các chip đó nên đối chiếu thiết kế sẽ khác ở đúng phần này.")
    A(F, "Đóng hộp thoại: nút X, phím Esc, bấm nền mờ; bấm bên trong hộp không đóng", "Chức năng", "Trung bình", UIB,
      ["Mở hộp thoại, bấm nút X (aria-label 'Đóng')", "Mở lại, nhấn Esc", "Mở lại, bấm vùng nền mờ", "Bấm vào vùng trắng của hộp"], "-", "Ba cách đầu đóng hộp thoại, quay lại trang chi tiết; cách cuối không đóng. Không có dữ liệu nào bị gửi.")
    A(F, "Trạng thái tải bảng giá 'Đang tải bảng giá…' và lỗi 'Không tải được bảng giá, vui lòng thử lại'", "Chức năng", "Thấp", UIB,
      ["Throttle mạng chậm rồi mở hộp thoại", "Chặn request checkout-quote (hoặc tắt backend) rồi mở lại"], "-", "Lúc chờ chỉ có khối 'Đang tải bảng giá…' (chưa có thẻ gói/CTA); khi lỗi có khung đỏ role=alert kèm message BE (hoặc 'Không tải được bảng giá, vui lòng thử lại'), không có nút thanh toán.", pw="Một phần")
    A(F, "Khách chưa đăng nhập bấm 'Tham gia ngay' ở cộng đồng có phí: chuyển /login, không mở hộp thoại", "Chức năng", "Cao", BASE + " " + DEMO + " Chưa đăng nhập.",
      ["Mở /communities/annual-demo", "Bấm 'Tham gia ngay'"], "-", "Chuyển /login (state from=/communities/annual-demo); đăng nhập xong quay lại trang chi tiết (hộp thoại chưa tự mở).")
    A(F, "Thành viên đã tham gia thấy nút 'Đã tham gia' (không mở hộp thoại); nút ở cộng đồng riêng tư là 'Gửi yêu cầu tham gia'", "Chức năng", "Trung bình", BASE + " Đăng nhập owner@sofinhub.test (owner của annual-demo) và newbie@ ở private-demo.",
      ["owner mở /communities/annual-demo", "newbie mở /communities/private-demo"], "-", "Owner: nút 'Đã tham gia' (xanh), không mở dialog; private-demo: nút 'Gửi yêu cầu tham gia' mở hộp 'Cộng đồng riêng tư' (không phải hộp chọn gói).")
    A(F, "Cộng đồng miễn phí: 'Tham gia ngay' tham gia thẳng, không hiện hộp thoại chọn gói", "Chức năng", "Cao", UIM,
      ["Đăng nhập newbie@, mở /communities/photo (miễn phí, công khai)", "Bấm 'Tham gia ngay'"], "photo", "Tham gia thành công (chuyển vào cộng đồng), không có dialog. Hộp thoại chỉ dành cho cộng đồng có phí ('Miễn phí không qua dialog'). Dùng db:reset sau case.")
    A(F, "Trang /communities/:id/checkout dùng lại JoinCheckout: khách -> /login; có nút X về chi tiết; xong vào cộng đồng", "Chức năng", "Trung bình", UIM,
      ["Chưa đăng nhập mở /communities/annual-demo/checkout", "Đăng nhập newbie@ -> trang hiện nội dung giống hộp thoại (nền #faf8f6, rộng 560px)", "Bấm X", "Mở lại và hoàn tất thử (thẻ hợp lệ)"], "annual-demo",
      "Khách bị chuyển /login và quay lại đúng URL checkout; sau đó hiển thị cùng giao diện hộp thoại ở dạng trang; X -> /communities/annual-demo; hoàn tất -> /communities/annual-demo/community (replace, bấm Back không quay lại checkout); JOIN_REQUEST_REQUIRED -> về trang chi tiết.")
    A(F, "Màn hình hẹp 375px: hộp thoại cuộn dọc trong khung, hai thẻ gói xếp một cột, không tràn ngang", "Giao diện", "Thấp", UIB,
      ["Đặt viewport 375x812, mở hộp thoại annual-demo"], "375x812", "Hộp thoại rộng tối đa 560px nhưng co theo màn hình, cuộn được (overflow-y), hai thẻ gói xếp dọc (sm:grid-cols-2 chỉ từ 640px), form thẻ không tràn.")
    A(F, "Bố cục khớp ảnh thiết kế 3.png: gradient kem ở đầu, nhãn 'Tiết kiệm đến 43%' có biểu tượng thẻ giá, ghi chú khóa 'Thanh toán an toàn với Stripe', nút CTA gradient cam bo tròn", "Giao diện", "Thấp", UIB,
      ["Mở hộp thoại annual-demo (gói năm đang chọn)", "So sánh với 3.png ở độ phân giải 1280"], "3.png", "Giống thiết kế: tiêu đề 'Chọn gói thành viên' trái, nhãn xanh lá phải; hai thẻ bo 18px (thẻ đang chọn viền cam + nền kem); 'Phương thức thanh toán' + ổ khóa 'Thanh toán an toàn với Stripe'; khung nhập thẻ một hàng (biểu tượng, Số thẻ, MM / YY, CVC); khung quà bo tròn dưới cùng. Khác thiết kế: chip dữ liệu thật, màu logo placeholder #1e2a8a.")

    # ============================================================================================ 2. THẺ GÓI
    F = "Hai thẻ gói: Hàng tháng & Hàng năm"
    A(F, "Tiêu đề 'Chọn gói thành viên' + nhãn 'Tiết kiệm đến 43%' (lấy savings lớn nhất của các gói)", "Giao diện", "Cao", UIB,
      ["Mở hộp thoại annual-demo", "Mở hộp thoại 'paid-demo' ($19, chỉ gói tháng)"], "annual-demo / paid-demo", "annual-demo: nhãn xanh 'Tiết kiệm đến 43%'; paid-demo (không gói năm): KHÔNG có nhãn (maxSavings=0).")
    A(F, "annual-demo hiển thị 2 thẻ: 'Hàng tháng' ($7/tháng, '$7 thanh toán hàng tháng') và 'Hàng năm' ($4/tháng, '$48 thanh toán hàng năm')", "Giao diện", "Cao", UIB + " " + DEC,
      ["Mở hộp thoại annual-demo", "Đọc từng thẻ"], "$7 / $48",
      "Thẻ tháng: radio ○, tên 'Hàng tháng', giá lớn '$7' + '/tháng', dòng nhỏ '$7 thanh toán hàng tháng', huy hiệu cam 'Phổ biến nhất' ở mép trên. Thẻ năm: radio, 'Hàng năm', '$4/tháng' (perMonth = round(48/12)), '$48 thanh toán hàng năm', huy hiệu xanh 'Tiết kiệm 43%'. Giá hiển thị theo USD (mockup ghi USD). Giá trị $7/$48 là dữ liệu seed.")
    A(F, "Gói 'Hàng năm' được CHỌN sẵn khi cộng đồng có bán gói năm (như ảnh thiết kế)", "Chức năng", "Cao", UIB,
      ["Mở hộp thoại annual-demo", "Xem thẻ nào có radio ◉ và Network"], "annual-demo",
      "Thẻ 'Hàng năm' chọn sẵn (viền cam, giá cam); CTA 'Bắt đầu dùng thử miễn phí'. Network: có thể thấy hai lần GET /api/communities/annual-demo/checkout-quote - lần đầu interval=monthly (khi chưa biết có gói năm), sau đó interval=annual.")
    A(F, "Cộng đồng chỉ có gói tháng (paid-demo $19): chỉ 1 thẻ, không 'Phổ biến nhất' thừa/không nhãn tiết kiệm, mặc định chọn Hàng tháng", "Giao diện", "Trung bình", UIB,
      ["Mở /communities/paid-demo, bấm 'Tham gia ngay'"], "paid-demo $19", "Chỉ thẻ 'Hàng tháng' ($19/tháng, '$19 thanh toán hàng tháng') đã chọn; lưới một cột; không có thẻ năm; tổng '$19'.")
    A(F, "Đổi gói bằng cách bấm thẻ: radio đổi (aria-checked), giá tổng và ghi chú thay theo, quote gọi lại với interval mới", "Chức năng", "Cao", UIB,
      ["Mở hộp thoại annual-demo", "Bấm thẻ 'Hàng tháng'", "Bấm lại thẻ 'Hàng năm'", "Theo dõi Network"], "monthly <-> annual",
      "Mỗi lần bấm gọi GET checkout-quote?interval=<monthly|annual>; dòng tóm tắt đổi '$7/tháng · thanh toán hàng tháng' (tổng $7) <-> '$4/tháng · thanh toán $48 mỗi năm' (tổng $48); trong lúc đổi (quote cũ) nút CTA bị vô hiệu hóa tới khi quote mới về.")
    A(F, "Thẻ gói hỗ trợ bàn phím: Tab tới từng thẻ, Space/Enter chọn (role radio trong radiogroup 'Gói thành viên')", "Giao diện", "Thấp", UIB,
      ["Tab tới thẻ gói, nhấn Enter/Space"], "-", "Thẻ là button role=radio trong nhóm có nhãn 'Gói thành viên'; phím chọn được; focus nhìn thấy.")
    A(F, "Giá tháng quy đổi làm tròn 2 chữ số: gói năm $50 hiển thị '$4.17/tháng'; $48 hiển thị '$4/tháng' (không thừa .00)", "Chức năng", "Trung bình", UIM + " Cộng đồng thử giá 7/50: tạo như mục COMM nhưng priceAnnualUsd=50.",
      ["Tạo cộng đồng giá 7/50, mở hộp thoại", "Đọc thẻ năm và dòng tóm tắt"], "7/50", "perMonthUsd = round(50/12 x 100)/100 = 4.17 -> '$4.17/tháng · thanh toán $50 mỗi năm'; tiết kiệm round((1 - 50/84) x 100) = 40%. formatMoney bỏ '.00' khi số nguyên.", pw="Có")
    A(F, "Giá năm đúng bằng 12 x giá tháng ($7/$84): savings 0 -> không có nhãn 'Tiết kiệm' nào, nhưng vẫn hiển thị 2 thẻ", "Giao diện", "Thấp", UIM,
      ["Tạo cộng đồng 7/84, mở hộp thoại"], "7/84", "Không có nhãn 'Tiết kiệm đến X%' và không có huy hiệu 'Tiết kiệm' trên thẻ năm (savingsPct 0); thẻ năm '$7/tháng · $84 thanh toán hàng năm'.", pw="Có")
    A(F, "Thẻ gói đang chọn: viền cam 2px + nền gradient kem; thẻ không chọn viền xám nhạt (khớp thiết kế)", "Giao diện", "Thấp", UIB, ["Mở hộp thoại, chụp ảnh, so với 3.png"], "-", "Thẻ chọn: viền cam, giá cam, radio cam ◉; thẻ không chọn: nền #fdfbf9, giá đen, radio xám ○.")

    # ============================================================================================ 3. FORM THẺ
    F = "Form thẻ (số thẻ, MM / YY, CVC)"
    A(F, "Form thẻ một hàng: biểu tượng thẻ, 'Số thẻ', 'MM / YY', 'CVC' và ghi chú ổ khóa 'Thanh toán an toàn với Stripe'", "Giao diện", "Cao", UIB,
      ["Mở hộp thoại", "Đọc placeholder ba ô"], "-", "Placeholder 'Số thẻ' / 'MM / YY' / 'CVC'; biểu tượng thẻ xám (credit_card) khi chưa nhận diện hãng; tiêu đề 'Phương thức thanh toán'; ghi chú 'Thanh toán an toàn với Stripe' (provider từ quote).")
    cards = [("4242424242424242", "VISA (nền xanh #1a1f71)", "Visa"), ("5555555555554444", "MC (nền đỏ)", "Mastercard"), ("378282246310005", "AMEX (nền xanh dương)", "American Express"),
             ("6011111111111117", "DISC (nền cam)", "Discover"), ("3530111333300000", "JCB (nền xanh lá)", "JCB")]
    for num, icon, name in cards:
        A(F, f"Nhận diện hãng thẻ khi gõ {num[:4]}...: biểu tượng '{icon.split(' ')[0]}'", "Giao diện", "Trung bình", UIB,
          [f"Gõ dần số thẻ {num} vào ô 'Số thẻ'", "Quan sát biểu tượng bên trái"], num,
          f"Gõ chữ số đầu: biểu tượng chuyển từ thẻ xám sang nhãn {icon} ({name}); xóa số thì trở về biểu tượng thẻ xám. " + ("Amex nhóm 4-6-5: '3782 822463 10005'." if name == "American Express" else "Số được nhóm 4: " + " ".join(num[i:i + 4] for i in range(0, len(num), 4)) + "."))
    A(F, "Số thẻ tự định dạng khi gõ/dán: chỉ nhận chữ số, nhóm 4, tối đa 19 chữ số", "Chức năng", "Cao", UIB,
      ["Gõ '4242abcd4242 4242-4242'", "Dán '4242 4242 4242 4242 4242 99'"], "-", "Chữ cái/ký tự lạ bị bỏ; hiển thị '4242 4242 4242 4242'; chuỗi dài bị cắt ở 19 chữ số; con trỏ không nhảy lung tung khi gõ tiếp.")
    A(F, "Ngày hết hạn tự định dạng 'MM / YY': gõ 1225 -> '12 / 25'; gõ '2' tự thêm '0' -> '02'", "Chức năng", "Cao", UIB,
      ["Gõ 1225 vào ô MM / YY", "Xóa, gõ '2'", "Gõ '1' rồi '3'"], "1225, 2, 13", "'12 / 25'; '02'; '13' (giữ nguyên rồi báo lỗi khi kiểm tra); tối đa 7 ký tự hiển thị, chỉ nhận chữ số.")
    A(F, "CVC: chỉ chữ số, tối đa 3 (thẻ thường) hoặc 4 (Amex)", "Chức năng", "Trung bình", UIB,
      ["Số thẻ Visa: gõ CVC '12345'", "Đổi số thẻ thành Amex 3782...: gõ '12345'"], "-", "Visa: CVC cắt ở 3 ký tự '123'; Amex: cho tới 4 ký tự '1234'. Ký tự không phải số bị bỏ.")
    errs = [("Để trống cả 3 ô rồi bấm CTA", "'', '', ''", "'Vui lòng nhập số thẻ', 'Nhập ngày hết hạn', 'Nhập mã CVC'"),
            ("Số thẻ ngắn '4242 4242' (8 số)", "4242 4242", "'Số thẻ chưa đủ chữ số'"),
            ("Số thẻ sai Luhn '4242 4242 4242 4241'", "4242 4242 4242 4241", "'Số thẻ không hợp lệ'"),
            ("Hạn trong quá khứ '01 / 20'", "01 / 20", "'Thẻ đã hết hạn'"),
            ("Hạn tháng 13 '13 / 30'", "13 / 30", "'Ngày hết hạn không hợp lệ (MM / YY)'"),
            ("Hạn quá xa (năm hiện tại + 25)", "12 / <năm+25>", "'Ngày hết hạn không hợp lệ'"),
            ("CVC thiếu số '12' (Visa)", "12", "'CVC gồm 3 chữ số'"),
            ("CVC Amex chỉ 3 số '123'", "123 với 3782 822463 10005", "'CVC gồm 4 chữ số'")]
    for t, data, exp in errs:
        A(F, f"Kiểm tra thẻ: {t} -> lỗi hiển thị và chặn gửi", "Chức năng", "Cao", UIB,
          ["Chọn gói bất kỳ, nhập dữ liệu như bên", "Bấm nút CTA (xem Network)"], data,
          f"Dưới/viền ô tương ứng hiện {exp} (viền đỏ, aria-invalid); KHÔNG có request trial/checkout nào; sửa ô thì lỗi tự xóa.")
    A(F, "Thẻ hợp lệ 4242 4242 4242 4242, 12 / (năm+3), CVC 123 qua kiểm tra client và được gửi đi", "Chức năng", "Cao", UIM,
      ["Nhập thẻ hợp lệ như bên", "Bấm CTA (Network)"], "4242 4242 4242 4242 | 12/<năm+3> | 123", "Không có lỗi; request gửi đi với paymentMethod {type:'card', token:'tok_mock_<24 hex>', brand:'visa', last4:'4242', expMonth:12, expYear} - xem nhóm Luồng tham gia.")
    A(F, "Hạn của THÁNG HIỆN TẠI vẫn hợp lệ, tháng trước thì 'Thẻ đã hết hạn' (kiểm tra theo tháng)", "Chức năng", "Thấp", UIB,
      ["Nhập hạn = tháng/năm hiện tại, rồi tháng trước"], "tháng hiện tại / trước", "Tháng hiện tại: không lỗi hạn; tháng trước: 'Thẻ đã hết hạn'.")
    A(F, "Số thẻ test của các hãng đều qua Luhn: 5555 5555 5555 4444, 3782 822463 10005, 6011 1111 1111 1117, 3530 1113 3330 0000", "Chức năng", "Trung bình", UIB,
      ["Nhập lần lượt từng số kèm hạn/CVC hợp lệ (Amex CVC 4 số)", "Bấm CTA (có thể dừng ở bước kiểm tra hoặc hoàn tất thử)"], "4 số thẻ", "Không báo lỗi 'Số thẻ không hợp lệ'; brand gửi lên lần lượt mastercard, amex, discover, jcb; last4 đúng 4 số cuối.", pw="Một phần")
    A(F, "Lỗi thẻ biến mất khi sửa ô và các ô bị vô hiệu hóa khi đang xử lý", "Giao diện", "Thấp", UIB,
      ["Gây lỗi thẻ, sửa một ô", "Gửi hợp lệ và quan sát ô lúc 'Đang xử lý…'"], "-", "Sửa ô xóa toàn bộ lỗi thẻ; trong lúc busy ba ô nhập bị disabled.", pw="Một phần")
    A(F, "Số thẻ/CVC thô bị xóa khỏi ô sau khi tạo token (ngay cả khi gọi API lỗi)", "Bảo mật", "Cao", UIM,
      ["Nhập thẻ hợp lệ, bấm CTA khi backend tắt (gây lỗi mạng)", "Quan sát ba ô"], "-", "Sau khi bấm, ba ô rỗng (setCard(emptyCard)) dù lỗi - người dùng phải nhập lại thẻ (hành vi cố ý an toàn; ghi nhận trải nghiệm). Số thẻ không nằm trong localStorage/sessionStorage.", pw="Một phần")
    A(F, "Trình duyệt gợi ý tự điền thẻ đúng thuộc tính autocomplete (cc-number, cc-exp, cc-csc)", "Giao diện", "Thấp", UIB, ["Kiểm tra DOM ba ô thẻ"], "-", "name/autoComplete = cc-number, cc-exp, cc-csc; inputMode numeric.", pw="Có")

    # ============================================================================================ 4. TÓM TẮT, CTA, GHI CHÚ
    F = "Dòng tóm tắt, tổng, nút CTA, ghi chú dùng thử"
    A(F, "Dòng tóm tắt gói năm: '$4/tháng · thanh toán $48 mỗi năm' + tổng đậm '$48' ở bên phải", "Giao diện", "Cao", UIB,
      ["Chọn thẻ 'Hàng năm'", "Đọc dòng dưới form thẻ"], "annual-demo", "Hiện '$4/tháng · thanh toán $48 mỗi năm' bên trái và '$48' đậm bên phải (khớp 3.png).")
    A(F, "Dòng tóm tắt gói tháng: '$7/tháng · thanh toán hàng tháng' + tổng '$7'", "Giao diện", "Cao", UIB, ["Chọn thẻ 'Hàng tháng'"], "annual-demo", "Hiện '$7/tháng · thanh toán hàng tháng' và '$7'.")
    A(F, "CTA 'Bắt đầu dùng thử miễn phí' (biểu tượng vương miện) khi người dùng đủ điều kiện dùng thử (quote.trialEligible & trialDays > 0)", "Giao diện", "Cao", UIB,
      ["Mở hộp thoại annual-demo với newbie@ (chưa dùng thử)"], "annual-demo", "Nút gradient cam rộng 52px 'Bắt đầu dùng thử miễn phí' có biểu tượng vương miện và mũi tên (như 3.png).")
    A(F, "CTA 'Thanh toán' (biểu tượng ổ khóa) khi cộng đồng tắt thử hoặc người dùng đã dùng thử rồi", "Chức năng", "Cao", UIM + " " + COMM,
      ["Tạo cộng đồng có memberTrialEnabled:false (hoặc dùng người đã từng dùng thử)", "Mở hộp thoại"], "memberTrialEnabled=false", "CTA 'Thanh toán' (ổ khóa); khung quà đổi 'Thanh toán hôm nay $<giá>' (không còn câu dùng thử).")
    A(F, "Ghi chú dùng thử (annual-demo, gói năm): 'Dùng thử miễn phí 7 ngày' + 'Lần thanh toán đầu tiên của bạn sẽ diễn ra vào ngày <d/M> với giá $48. Chúng tôi sẽ gửi email nhắc bạn trước 3 ngày. Hủy bất cứ lúc nào chỉ với 1 lần bấm.'", "Giao diện", "Cao", UIB + " " + DEC,
      ["Mở hộp thoại, chọn gói năm", "Đọc khung quà dưới nút", "Đổi sang gói tháng"], "hôm nay + 7 ngày",
      "Ngày d/M = (hôm nay + 7 ngày) theo múi giờ trình duyệt, định dạng không đệm 0 (ví dụ chạy 1/10 -> '8/10' như 3.png); giá $48 (gói năm) / $7 (gói tháng, cùng ngày). Số ngày 7, nhắc 3 ngày, 'Hủy bất cứ lúc nào' lấy từ trialDays, remindDaysBefore, cancelAnytime của quote.")
    A(F, "Ghi chú không dùng thử: 'Thanh toán hôm nay $48' (dueTodayUsd) và câu hủy bất cứ lúc nào", "Giao diện", "Trung bình", UIM + " " + COMM,
      ["Cộng đồng tắt thử, chọn gói năm"], "-", "Tiêu đề 'Thanh toán hôm nay $48' (gói tháng: '$7'); không có ngày/nhắc email.")
    A(F, "Ngày thanh toán đầu tiên theo múi giờ trình duyệt có thể lệch 1 ngày so với UTC của BE (quanh nửa đêm)", "Giao diện", "Thấp", UIB + " Đặt múi giờ máy test là GMT+7 và chạy gần 00:00-07:00 giờ VN.",
      ["So firstChargeDate (ISO UTC) từ GET checkout-quote với ngày d/M hiển thị"], "-", "HIỆN TẠI: dayMonth dùng getDate() theo giờ địa phương nên ngày hiển thị = ngày địa phương của firstChargeDate (có thể khác ngày UTC); email nhắc của BE dùng giờ server. Ghi nhận để thống nhất múi giờ hiển thị.", pw="Không", st=PLAN)
    A(F, "Số ngày dùng thử/nhắc trong ghi chú đổi theo Global Settings (payments.trialDays=14, trialReminderDays=5)", "Chức năng", "Trung bình", UIM + " Đặt lại: POST /api/admin/system/settings/reset hoặc npm run db:reset. " + DEC,
      ["admin PATCH /api/admin/system/settings {\"payments\":{\"trialDays\":14,\"trialReminderDays\":5}}", "Mở hộp thoại annual-demo"], "14 / 5", "Ghi chú 'Dùng thử miễn phí 14 ngày', ngày đầu = hôm nay + 14, 'nhắc bạn trước 5 ngày'; reminderDays=0 thì câu nhắc email biến mất (chỉ còn 'Hủy bất cứ lúc nào...').", pw="Một phần")
    A(F, "CTA bị vô hiệu hóa khi đang tải/đổi quote (stale) hoặc đang xử lý, nhãn 'Đang xử lý…'", "Chức năng", "Trung bình", UIB,
      ["Mở hộp thoại, bấm thẻ khác và ngay lập tức bấm CTA", "Gửi hợp lệ và quan sát nhãn"], "-", "Khi quote chưa khớp interval đang chọn nút disabled (không gửi sai gói); khi gửi: nhãn 'Đang xử lý…', không bấm đúp được.", pw="Một phần")

    # ============================================================================================ 5. LUỒNG THAM GIA
    F = "Luồng tham gia từ giao diện"
    A(F, "Dùng thử có thẻ - gói năm: POST /trial {interval:'annual', paymentMethod} -> trialing, vào cộng đồng", "Tích hợp", "Cao", UIM,
      ["newbie@ mở hộp thoại annual-demo, giữ gói năm", "Nhập 4242 4242 4242 4242, 12 / (năm+3), 123", "Bấm 'Bắt đầu dùng thử miễn phí' (Network)"], "annual + Visa 4242",
      "POST /api/communities/annual-demo/trial body {interval:'annual', paymentMethod:{type,token,brand:'visa',last4:'4242',expMonth:12,expYear}} -> 201 SubscriptionView (status 'trialing', interval 'annual', nextChargeAmountCents 4800, currentPeriodEnd = +7 ngày); hộp thoại đóng và chuyển /communities/annual-demo/community; nút trang chi tiết thành 'Đã tham gia'.")
    A(F, "Dùng thử có thẻ - gói tháng: POST /trial {interval:'monthly'} nextChargeAmountCents 700", "Tích hợp", "Cao", UIM,
      ["Chọn thẻ 'Hàng tháng', nhập thẻ hợp lệ, bấm CTA"], "monthly", "201 trialing, interval 'monthly', nextChargeAmountCents 700.")
    A(F, "Trả tiền ngay (không đủ điều kiện thử): POST /checkout {method:'stripe', interval, paymentMethod} + Idempotency-Key, sau ~0,6s POST /payments/:id/confirm", "Tích hợp", "Cao", UIM + " " + COMM,
      ["Dùng cộng đồng memberTrialEnabled:false; mở hộp thoại với người dùng mới", "Chọn gói năm, nhập thẻ, bấm 'Thanh toán' (Network)"], "annual, không thử",
      "1) POST /communities/<id>/checkout 201 (amountCents 4800, interval 'annual') với header Idempotency-Key (uuid theo cộng đồng+kỳ hạn); 2) chờ ~600ms mô phỏng cổng; 3) POST /payments/<id>/confirm 200 (status 'succeeded', invoiceNumber INV-...); đóng hộp thoại, vào cộng đồng.")
    A(F, "Body gửi đi KHÔNG có số tiền, số thẻ hay CVC (số tiền do server quyết định)", "Bảo mật", "Cao", UIM,
      ["Thực hiện một lần tham gia, đọc body mọi request (trial/checkout/confirm)"], "-", "Body chỉ có interval, method/paymentMethod (token, brand, last4, expMonth, expYear); không có amount/amountCents/amountUsd; không có number/cvc; không có chuỗi 13-19 chữ số trong bất kỳ request/response nào.")
    A(F, "Lỗi từ BE (vd. 409 đã là thành viên) hiện khung đỏ trong hộp thoại, hộp thoại không đóng", "Chức năng", "Trung bình", UIM,
      ["Mở hộp thoại ở tab A và tab B cùng một người; hoàn tất ở tab A", "Ở tab B bấm CTA"], "-", "Tab B: khung đỏ role=alert với message của BE (ví dụ 'Bạn đã tham gia khóa học này rồi'), nút trở lại bình thường (không kẹt 'Đang xử lý…').", pw="Một phần")
    A(F, "Cộng đồng RIÊNG TƯ có phí chưa được duyệt: BE trả JOIN_REQUEST_REQUIRED -> đóng hộp chọn gói và mở hộp 'Cộng đồng riêng tư' gửi yêu cầu", "Chức năng", "Cao", BASE + " " + NEWU + " " + COMM + " Tạo cộng đồng riêng tư (visibility:'private', autoApprovePaid false) - " + MUTATE,
      ["Người dùng khác mở trang chi tiết cộng đồng riêng tư có phí", "Bấm nút tham gia -> (hộp xin yêu cầu)", "Nếu vào được hộp chọn gói, nhập thẻ và bấm CTA"], "private + paid", "Khi BE chặn bằng 403 JOIN_REQUEST_REQUIRED hộp chọn gói đóng, hộp 'Cộng đồng riêng tư' (Gửi yêu cầu) mở nếu chưa có yêu cầu đang chờ; không tạo giao dịch.", pw="Một phần")
    A(F, "Cộng đồng bị khóa (locked): lỗi 'Cộng đồng này đang bị khóa bởi quản trị nền tảng nên chưa thể tham gia.' trong hộp thoại", "Chức năng", "Trung bình", UIM + " Admin khóa một cộng đồng có phí (Admin > Cộng đồng > Khóa).",
      ["Người dùng mở hộp thoại ở cộng đồng bị khóa và bấm CTA"], "-", "Khung đỏ 'Cộng đồng này đang bị khóa bởi quản trị nền tảng nên chưa thể tham gia.'; không tạo giao dịch/gói.", pw="Một phần")
    A(F, "Bấm CTA hai lần nhanh chỉ tạo một gói/giao dịch", "Chức năng", "Cao", UIM,
      ["Hợp lệ hóa form, bấm CTA hai lần liên tiếp (double click)", "Kiểm tra bảng Subscription/Payment của người đó"], "-", "Chỉ 1 request (nút disabled khi busy); DB có đúng 1 Subscription sống (chỉ số duy nhất 1 gói sống/(user, cộng đồng)); không double-charge.", pw="Một phần")
    A(F, "Sau khi tham gia: nút trang chi tiết 'Đã tham gia'; /billing hiển thị gói và kỳ hiện tại; /me/communities có cộng đồng", "Chức năng", "Trung bình", UIM,
      ["Sau khi dùng thử/thanh toán thành công, quay lại /communities/annual-demo", "Mở /billing và /me/communities"], "-", "Nút 'Đã tham gia' xanh; /me/communities có 'Cộng đồng gói năm (demo)'; /billing có gói (xem case lệch hiển thị '/tháng' cho gói năm).")
    A(F, "Id giao dịch/Idempotency-Key theo (cộng đồng, kỳ hạn): đổi gói rồi bấm lại không nhận nhầm giao dịch cũ", "Chức năng", "Trung bình", UIM + " " + COMM,
      ["Cộng đồng tắt thử. Chọn gói năm, gây lỗi thẻ BE (hoặc đóng giữa chừng), đổi sang gói tháng, gửi", "So id intent ở hai lần checkout"], "annual -> monthly", "Hai checkout dùng hai khóa idempotency khác nhau (key theo cộng đồng+kỳ hạn) -> hai intent khác nhau, giá 4800 và 700; lần thanh toán tháng không bị 'trả về' intent năm.", pw="Một phần")
    A(F, "Gói đang dùng thử rồi quay lại hộp thoại: người dùng đã thành viên không thấy hộp thoại mà thấy 'Đã tham gia'", "Chức năng", "Thấp", UIM, ["Sau khi dùng thử, mở lại /communities/annual-demo/checkout"], "-", "Trang checkout vẫn render form (BE sẽ trả 409 nếu gửi); trang chi tiết hiển thị 'Đã tham gia' - không mời mua lại.", pw="Một phần")
    A(F, "Rời cộng đồng có phí (đang gói năm): hộp xác nhận nguyên văn cũ, hủy cuối kỳ, vào lại miễn phí trong kỳ đã trả", "Chức năng", "Cao", UIM,
      ["Thành viên gói năm bấm 'Đã tham gia' (rời)", "Đọc hộp xác nhận và OK", "Bấm 'Tham gia ngay' lại"], "gói năm",
      "Hộp xác nhận: 'Rời cộng đồng có phí này? Bạn sẽ mất quyền truy cập ngay, gói thành viên sẽ bị hủy vào cuối kỳ hiện tại (không bị tính phí kỳ sau) và khoản đã thanh toán cho kỳ này không được hoàn lại. Bạn có thể vào lại miễn phí trong kỳ đã trả.'; POST /enroll toggle -> enrolled false, subscription.cancelAtPeriodEnd true; bấm tham gia lại -> enrolled true (không mở hộp thoại, không thanh toán lại).")

    # ============================================================================================ 6. QUOTE API
    F = "API báo giá checkout-quote"
    A(F, "GET /communities/:id/checkout-quote?interval=annual: plans[], selected, trialDays 7, firstChargeDate = start + 7 ngày, remindAt = firstCharge - 3 ngày", "Tích hợp", "Cao", API + " " + DEC,
      ["GET /api/communities/<id>/checkout-quote?interval=annual (không token)"], "7/48",
      "200: currency 'USD', paid true, plans = [{interval:'monthly',label:'Hàng tháng',priceUsd:7,billedUsd:7,perMonthUsd:7,savingsPct:0,popular:true,periodDays:30}, {interval:'annual',label:'Hàng năm',priceUsd:48,billedUsd:48,perMonthUsd:4,savingsPct:43,popular:false,periodDays:365}], selected 'annual', trialDays 7, trialEligible (false khi chưa đăng nhập hoặc theo quyền), startsAt, firstChargeDate - startsAt = 7 ngày, firstChargeAmountUsd 48, firstChargeAmountCents 4800, dueTodayUsd 0, remindDaysBefore 3, remindAt = firstChargeDate - 3 ngày, cancelAnytime true, provider 'stripe'.", pw="Một phần")
    A(F, "interval=monthly (hoặc không truyền): selected 'monthly', firstChargeAmountCents 700", "Chức năng", "Cao", API, ["GET checkout-quote?interval=monthly", "GET checkout-quote (không interval)"], "-", "Cả hai selected 'monthly', firstChargeAmountUsd 7, firstChargeAmountCents 700; plans giống nhau.", pw="Không")
    A(F, "Cộng đồng không đặt giá năm: plans chỉ có monthly; interval=annual -> 400 INTERVAL_UNAVAILABLE", "Chức năng", "Cao", API + " Tạo cộng đồng KHÔNG có priceAnnualUsd.", ["GET checkout-quote", "GET checkout-quote?interval=annual"], "-", "Lệnh 1: plans.length 1 (monthly); lệnh 2: 400 error.code='INTERVAL_UNAVAILABLE'.", pw="Không")
    A(F, "interval không hợp lệ ('weekly') -> 400 VALIDATION_ERROR", "Chức năng", "Thấp", API, ["GET checkout-quote?interval=weekly"], "weekly", "400 VALIDATION_ERROR.", pw="Không")
    A(F, "Cộng đồng miễn phí (photo) -> 400 COMMUNITY_FREE; id lạ/nháp/đã xóa -> 404", "Chức năng", "Cao", API, ["GET /api/communities/photo/checkout-quote", "GET /api/communities/khong-co/checkout-quote", "GET /api/communities/<id nháp wizard>/checkout-quote"], "-", "photo: 400 COMMUNITY_FREE; hai lệnh sau: 404.", pw="Không")
    A(F, "memberTrialEnabled=false: trialDays 0, trialEligible false, dueTodayUsd = giá, remindAt null, firstChargeDate = startsAt", "Chức năng", "Cao", API + " Tạo cộng đồng có memberTrialEnabled:false.", ["GET checkout-quote?interval=annual"], "-", "trialDays 0; trialEligible false; dueTodayUsd 48; remindAt null; firstChargeDate bằng startsAt.", pw="Không")
    A(F, "Người đã từng dùng thử: quote tiếp theo trialDays 0 và dueTodayUsd = giá tháng ($7)", "Chức năng", "Cao", APIM,
      ["U (có token) GET quote -> trialDays 7", "U POST /trial {} rồi POST /subscription/cancel {atPeriodEnd:false}", "U GET quote lại"], "-", "Sau khi đã dùng thử: trialDays 0, dueTodayUsd 7 (mỗi người chỉ thử một lần mỗi cộng đồng).", pw="Không")
    A(F, "Quote tính lại ngay khi Global Settings payments.trialDays/trialReminderDays đổi", "Chức năng", "Trung bình", APIM + " Đặt lại: POST /api/admin/system/settings/reset. " + DEC,
      ["admin PATCH settings {\"payments\":{\"trialDays\":14,\"trialReminderDays\":5}}", "GET checkout-quote"], "14/5", "trialDays 14; remindDaysBefore 5; firstChargeDate = start + 14 ngày; remindAt = firstCharge - 5 ngày.", pw="Không")
    A(F, "firstChargeDate/remindAt: remindAt không bao giờ sớm hơn startsAt (max(now, firstCharge - n ngày))", "Chức năng", "Thấp", APIM + " Đặt payments.trialDays=2, trialReminderDays=5.", ["GET checkout-quote"], "trial 2 ngày, nhắc 5", "remindAt = startsAt (bị chặn dưới bởi thời điểm hiện tại), không nằm trong quá khứ.", pw="Không")
    A(F, "Quote không cần đăng nhập nhưng người đăng nhập thấy đúng quyền dùng thử (trialEligible)", "Chức năng", "Trung bình", API, ["GET quote không token", "GET quote với token người dùng mới", "GET quote với token owner của cộng đồng"], "-", "Người dùng mới: trialEligible true, trialDays 7. Khách: theo cấu hình cộng đồng. (Owner/đã thành viên: xem hành vi thực tế, ghi lại.)", pw="Không")
    A(F, "Quote gói năm số lẻ: giá $50 -> perMonthUsd 4.17, savingsPct 40", "Chức năng", "Thấp", API + " Tạo cộng đồng 7/50.", ["GET checkout-quote?interval=annual"], "7/50", "plans[1].perMonthUsd = 4.17, savingsPct = 40, billedUsd 50, firstChargeAmountCents 5000.", pw="Không")
    A(F, "Quote trả currency 'USD' và provider 'stripe' (hộp thoại ghi 'Thanh toán an toàn với Stripe')", "Giao diện", "Thấp", API + " " + DEC, ["GET checkout-quote"], "-", "currency 'USD', provider 'stripe', cancelAnytime true. Lưu ý: ảnh thiết kế dùng USD trong khi mockup wizard gói owner dùng VND (xem case tiền tệ lẫn lộn).", pw="Không")

    # ============================================================================================ 7. CHECKOUT API
    F = "API checkout tháng vs năm"
    A(F, "Checkout không truyền interval = monthly như cũ: amountCents 700, kỳ 30 ngày", "Tích hợp", "Cao", APIM + " " + SQLH + " " + DEC,
      ["U POST /communities/<id>/checkout {method:'stripe'}", "POST /payments/<paymentId>/confirm", "SELECT interval,\"priceCents\",\"currentPeriodStart\",\"currentPeriodEnd\" FROM \"Subscription\" WHERE \"userId\"='<U>'"], "monthly mặc định",
      "Intent: interval 'monthly', amountCents 700; confirm 200 status 'succeeded', invoiceNumber ^INV-; Subscription interval 'monthly', priceCents 700, kỳ = 30 ngày; user là thành viên.", pw="Không")
    A(F, "Checkout interval 'annual': số tiền lấy 4800 từ server (bỏ qua amountCents/amountUsd client gửi), kỳ 365 ngày", "Bảo mật", "Cao", APIM + " " + SQLH + " " + DEC,
      ["POST checkout {method:'stripe', interval:'annual', amountCents:1, amountUsd:0.01}", "confirm", "Kiểm tra Subscription"], "amount giả 1¢", "amountCents 4800 (số client bị bỏ qua; schema không nhận); sau confirm: Subscription interval 'annual', priceCents 4800, currentPeriodEnd - currentPeriodStart = 365 ngày; response periodEnd khớp.", pw="Không")
    A(F, "interval không hợp lệ ('biennial') -> 400; annual khi cộng đồng không có giá năm -> 400 INTERVAL_UNAVAILABLE", "Chức năng", "Cao", APIM, ["POST checkout {interval:'biennial'}", "POST checkout {interval:'annual'} ở cộng đồng không có giá năm"], "-", "Lệnh 1: 400 VALIDATION_ERROR; lệnh 2: 400 INTERVAL_UNAVAILABLE.", pw="Không")
    A(F, "method không hợp lệ ('bitcoin') -> 400; 'vnpay'/'momo' vẫn nhận (gateway mock), mặc định 'stripe'", "Chức năng", "Thấp", APIM, ["POST checkout {method:'bitcoin'}", "POST checkout {} (không method)"], "-", "Lệnh 1: 400; lệnh 2: 201 method 'stripe'.", pw="Không")
    A(F, "Kỳ gói năm lấy từ payments.annualPeriodDays (đặt 100 -> kỳ 100 ngày)", "Chức năng", "Trung bình", JOB + " Đặt lại: POST /api/admin/system/settings/reset. " + DEC,
      ["admin PATCH {\"payments\":{\"annualPeriodDays\":100}}", "U mua gói năm (checkout + confirm)", "Đọc kỳ", "Reset"], "100 ngày", "currentPeriodEnd - currentPeriodStart = 100 ngày.", pw="Không")
    A(F, "Tái dùng intent pending: cùng người, cùng interval + cùng số tiền (phiên còn hạn 15 phút) -> trả cùng intent; đổi interval -> intent mới", "Chức năng", "Cao", APIM,
      ["U POST checkout annual hai lần", "U POST checkout monthly"], "-", "Hai lần annual cùng id; monthly là id khác với amountCents 700.", pw="Không")
    A(F, "Pending không tái dùng khi giá thay đổi: owner đổi giá năm 48 -> 60 thì checkout annual mới tạo intent mới 6000¢", "Chức năng", "Trung bình", APIM + " " + DEC,
      ["U POST checkout annual (intent 4800)", "Owner PATCH /communities/<id> {priceAnnualUsd:60}", "U POST checkout annual lại"], "48 -> 60", "Intent thứ hai khác id, amountCents 6000 (findReusablePending khớp cả interval và amount).", pw="Không")
    A(F, "Idempotency-Key: cùng key + cùng cộng đồng trả lại đúng intent đã tạo (kể cả khi body interval khác - client phải tách key theo kỳ hạn)", "Chức năng", "Trung bình", APIM,
      ["U POST checkout {interval:'annual'} header Idempotency-Key: k1", "U POST checkout {interval:'monthly'} cùng k1", "U POST checkout annual với key k1 ở CỘNG ĐỒNG KHÁC"], "k1",
      "Lệnh 2 trả CÙNG intent annual của lệnh 1 (replay theo key, không tạo mới) - vì vậy FE dùng key riêng cho từng (cộng đồng, kỳ hạn); lệnh 3: 409 'Idempotency-Key này đã được dùng cho giao dịch khác'.", pw="Không")
    A(F, "Chống trừ tiền trùng: hai intent khác kỳ hạn cùng người - confirm cái đầu OK, cái sau 409 và cổng KHÔNG bị gọi", "Bảo mật", "Cao", APIM + " " + SQLH,
      ["U tạo intent annual (A) và monthly (M)", "Confirm A -> 200", "Confirm M -> ?", "SELECT status,\"gatewayChargeId\" FROM \"Payment\" WHERE id='<M>'"], "A rồi M",
      "Confirm M trả 409; chỉ 1 Subscription sống (active/trialing) của người đó, interval 'annual'; Payment M vẫn 'pending' và gatewayChargeId NULL (không bị trừ tiền); checkout mới khi đang có gói active -> 409.", pw="Không")
    A(F, "Checkout/confirm khi đã là thành viên (gói active hoặc đang thử đã được xử lý): 409; không có gói -> OK", "Chức năng", "Trung bình", APIM, ["U mua gói tháng thành công", "U POST checkout lần nữa"], "-", "409 (có gói còn hiệu lực - hãy vào lại cộng đồng).", pw="Không")
    A(F, "Cộng đồng riêng tư có phí: checkout -> 403 JOIN_REQUEST_REQUIRED; chủ bật autoApprovePaid -> 201 (annual 4800)", "Chức năng", "Cao", APIM,
      ["Tạo cộng đồng private 7/48 autoApprovePaid false; U POST checkout {interval:'annual'}", "Tạo cộng đồng private autoApprovePaid true; U POST checkout annual"], "-", "Lệnh 1: 403 JOIN_REQUEST_REQUIRED; lệnh 2: 201 amountCents 4800.", pw="Không")
    A(F, "Checkout bị chặn khi cộng đồng bị khóa (403 COMMUNITY_LOCKED), người bị ban, tài khoản bị hạn chế; không token 401; cộng đồng miễn phí 400", "Chức năng", "Trung bình", APIM + " Admin khóa cộng đồng.", ["POST checkout ở cộng đồng bị khóa", "Không token", "Ở photo (miễn phí)"], "-", "403 COMMUNITY_LOCKED, 401, 400 (miễn phí không cần thanh toán).", pw="Không")
    A(F, "paymentMethod trong checkout cũng STRICT: field cvc/number -> 400; hợp lệ -> lưu thẻ (paymentCardId trong intent)", "Bảo mật", "Cao", APIM, ["POST checkout {paymentMethod:{...thẻ hợp lệ, cvc:'123'}}", "POST checkout {paymentMethod: thẻ hợp lệ}"], CARDJ,
      "Lệnh 1: 400 (không tạo PaymentCard/Payment); lệnh 2: 201, intent có interval + paymentCardId (id nội bộ), KHÔNG nhúng object paymentMethod/token. GET /me/payment-methods có đúng 1 thẻ chỉ brand/last4/hạn.", pw="Không")
    A(F, "Hoàn tiền gói năm trong cửa sổ hoàn tiền: refund-request 201 'approved' 4800¢, thu hồi quyền, subscription canceled", "Chức năng", "Cao", APIM + " " + DEC,
      ["U mua gói năm", "POST /payments/<id>/refund-request {reason:'Đổi ý'}", "Kiểm tra quyền thành viên và Subscription"], "refund 4800", "201, status 'approved', amountCents 4800; U không còn là thành viên; Subscription 'canceled'; cổng giả lập ghi nhận hoàn 4800 (cửa sổ hoàn tiền 7 ngày là giá trị TẠM).", pw="Không")
    A(F, "Doanh thu owner: MRR gói năm = giá/12 (400¢) cộng gói tháng 700¢ = 1100¢; activePaidMembers 2; gross 5500¢", "Chức năng", "Cao", APIM + " " + DEC,
      ["Hai người mua: A gói năm, B gói tháng", "Owner GET /communities/<id>/revenue", "Hoàn tiền gói năm của A, GET lại"], "4800 + 700", "Trước hoàn: mrrCents 1100, activePaidMembers 2, grossCents 5500; sau hoàn: mrrCents 700, refundsCents 4800.", pw="Không")
    A(F, "Gia hạn gói năm: sau 31 ngày chưa gia hạn; sau 366 ngày trừ 4800¢ và gia hạn thêm 365 ngày, hóa đơn mới", "Chức năng", "Cao", JOB + " " + DEC,
      ["U mua gói năm", "Ép đến hạn sau 31 ngày: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()+interval '334 days' WHERE ... (giả lập mới qua 31 ngày) -> chờ job", "Ép quá hạn: SET \"currentPeriodEnd\"=now()-interval '1 minute' -> chờ job payments.subscriptions (~5 phút)", "SELECT kind,interval,\"amountCents\",\"invoiceNumber\" FROM \"Payment\" WHERE \"userId\"='<U>' ORDER BY \"createdAt\""], "annual",
      "Chưa đến hạn: không có Payment 'renewal'. Sau khi quá hạn: có Payment kind 'renewal', interval 'annual', amountCents 4800, invoiceNumber khác lần đầu; currentPeriodEnd tiến thêm đúng 365 ngày. (Test BE giả lập đồng hồ; QA thủ công dùng SQL.)", pw="Không")
    A(F, "Gia hạn gói năm thất bại (thẻ lỗi) -> gói 'expired', mất quyền", "Chức năng", "Trung bình", JOB, ["Cổng giả lập chỉ ép lỗi được bằng test BE (mockGateway.failFor): chạy tests/annual-subscription.test.ts mục 'gia hạn năm' hoặc dùng token tok_mock_declined ở gói dùng thử (xem nhóm Job)"], "-", "Subscription 'expired', người dùng không còn là thành viên. Không thể giả lập bằng UI.", pw="Không")
    A(F, "Rời cộng đồng khi đang gói năm: cancelAtPeriodEnd, vào lại được tới hết năm, hết kỳ thì 'canceled', không gia hạn", "Chức năng", "Cao", JOB + " " + DEC,
      ["U mua gói năm; POST /communities/<id>/enroll (rời)", "GET /communities/<id>/subscription -> cancelAtPeriodEnd", "POST enroll lại -> enrolled true", "SQL ép đến hạn sau 100 ngày/366 ngày, chờ job"], "-", "Sau rời: enrolled false, cancelAtPeriodEnd true; vào lại 200 enrolled true (không trừ thêm); còn trong năm: status 'active'; quá hạn: status 'canceled' và KHÔNG có Payment 'renewal'.", pw="Không")

    # ============================================================================================ 8. TRIAL API
    F = "API dùng thử (trial) có thẻ"
    A(F, "POST /trial không body: giống cũ - monthly, nextChargeAmountCents = giá kỳ đầu (priceCents, VND), không thẻ", "Chức năng", "Cao", APIM, ["U POST /communities/<id>/trial (không body)"], "-", "201 SubscriptionView: status 'trialing', interval 'monthly', nextChargeAmountCents = priceCents (giá kỳ đầu, VND; hết thử khách tự trả QR), paymentMethod null, kỳ 7 ngày.", pw="Không")
    A(F, "POST /trial {interval:'annual', paymentMethod}: trialing, nextChargeAmountCents 4800, paymentMethod chỉ brand/last4/hạn, token không lộ", "Bảo mật", "Cao", APIM + " " + SQLH,
      ["U POST /trial {interval:'annual', paymentMethod:{...token 'tok_mock_safe123456'}}", "Tìm chuỗi 'tok_mock_safe123456' trong response", "SELECT * FROM \"PaymentCard\" WHERE \"userId\"='<U>'"], "tok_mock_safe123456",
      "201: status 'trialing', interval 'annual', nextChargeAmountCents 4800; paymentMethod có đúng khóa brand, createdAt, expMonth, expYear, id, last4; response KHÔNG chứa token; PaymentCard 1 dòng last4 '4242', không có chuỗi 13-19 chữ số.", pw="Không")
    bad = [("thêm trường number", "{...CARD, number:'4242424242424242'}"), ("thêm trường cvc", "{...CARD, cvc:'123'}"), ("thẻ hết hạn (expYear năm ngoái)", "expYear: <năm-1>"),
           ("expMonth 13", "expMonth: 13"), ("token là số thẻ", "token:'4242424242424242'"), ("brand 'bitcoin'", "brand:'bitcoin'")]
    A(F, "POST /trial với paymentMethod sai (thêm number, cvc, hết hạn, tháng 13, token là số thẻ, brand lạ) -> 400, không lưu thẻ/gói", "Bảo mật", "Cao", APIM,
      ["Gọi POST /trial {interval:'annual', paymentMethod} với lần lượt 6 biến thể: " + "; ".join(b[0] for b in bad), "SELECT count(*) FROM \"PaymentCard\" / \"Subscription\" của U"], "6 biến thể", "Cả 6 trả 400 VALIDATION_ERROR (object strict); 0 PaymentCard, 0 Subscription của người dùng.", pw="Không")
    A(F, "POST /trial khi cộng đồng tắt thử -> 400 TRIAL_NOT_AVAILABLE; annual không có -> 400 INTERVAL_UNAVAILABLE", "Chức năng", "Cao", APIM, ["U POST /trial ở cộng đồng memberTrialEnabled:false", "POST /trial {interval:'annual'} ở cộng đồng không giá năm"], "-", "400 TRIAL_NOT_AVAILABLE; 400 INTERVAL_UNAVAILABLE.", pw="Không")
    A(F, "POST /trial lần hai (đã dùng thử/đã có gói/đã là thành viên) -> 409", "Chức năng", "Cao", APIM, ["U POST /trial hai lần", "U (đã mua) POST /trial"], "-", "Lần hai 409; không tạo gói thứ hai.", pw="Không")
    A(F, "Cộng đồng riêng tư: /trial -> 403 JOIN_REQUEST_REQUIRED trừ khi autoApprovePaid; bị khóa -> 403 COMMUNITY_LOCKED", "Chức năng", "Trung bình", APIM, ["U POST /trial ở private (autoApprovePaid false/true)", "ở cộng đồng bị khóa"], "-", "403 JOIN_REQUEST_REQUIRED / 201 / 403 COMMUNITY_LOCKED.", pw="Không")
    A(F, "GET /communities/:id/subscription và GET /me/payment-methods: chỉ brand/last4/hạn; chưa token -> 401", "Bảo mật", "Trung bình", APIM, ["U POST /trial {paymentMethod: mastercard 4444}", "GET /communities/<id>/subscription", "GET /me/payment-methods", "GET /me/payment-methods không token"], "mastercard 4444", "subscription.paymentMethod.last4 '4444', interval 'monthly'; danh sách 1 thẻ brand 'mastercard'; không token: 401. Không có gatewayToken ở đâu.", pw="Không")
    A(F, "Trial hết hạn không thẻ giữ hành vi cũ: hết thử là hết quyền, không trừ tiền", "Chức năng", "Cao", JOB,
      ["U POST /trial (không body)", "SQL: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute',\"trialEndsAt\"=now()-interval '1 minute' WHERE \"userId\"='<U>'", "Chờ job payments.subscriptions (~5 phút)", "Kiểm tra quyền + Payment"], "trial không thẻ", "U không còn là thành viên (isEnrolled false); gói 'expired'; KHÔNG có Payment.", pw="Không")

    # ============================================================================================ 9. JOB NỀN
    F = "Job nền: tự trừ cuối dùng thử, nhắc 3 ngày, gia hạn"
    A(F, "Hết dùng thử CÓ THẺ: job tự trừ 4800¢ (MockGateway), chuyển 'active', kỳ 365 ngày tính từ cuối thử, có hóa đơn, vẫn là thành viên", "Chức năng", "Cao", JOB + " " + DEC,
      ["U POST /trial {interval:'annual', paymentMethod hợp lệ}", "SQL ép hết thử: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()-interval '1 minute',\"trialEndsAt\"=now()-interval '1 minute' WHERE \"userId\"='<U>'", "Chờ job payments.subscriptions (~5 phút) hoặc khởi động lại BE", "SELECT status,interval,\"currentPeriodStart\",\"currentPeriodEnd\" FROM \"Subscription\"; SELECT kind,status,\"amountCents\",interval,\"invoiceNumber\",\"subscriptionId\" FROM \"Payment\" WHERE \"userId\"='<U>'"], "annual + Visa",
      "Subscription 'active' interval 'annual', currentPeriodStart = trialEnd cũ, kỳ = 365 ngày; đúng 1 Payment: kind 'initial', status 'succeeded', amountCents 4800, interval 'annual', có invoiceNumber, subscriptionId trỏ gói; U vẫn là thành viên.", pw="Không")
    A(F, "Job chạy lại sau khi đã trừ: không trừ lần hai (idempotent theo khóa '<sub>:trial-end')", "Chức năng", "Cao", JOB, ["Sau khi gói chuyển active ở case trước, chờ thêm 1-2 chu kỳ job", "Đếm Payment của U"], "-", "Vẫn đúng 1 Payment; Subscription không đổi.", pw="Không")
    A(F, "Sau khi tự trừ, người dùng vẫn xin hoàn tiền trong cửa sổ hoàn tiền được (approved)", "Chức năng", "Trung bình", JOB + " " + DEC, ["POST /payments/<id>/refund-request {reason:'Không dùng nữa'}"], "-", "201 status 'approved'; mất quyền.", pw="Không")
    A(F, "Thẻ bị từ chối lúc trừ cuối thử (token tok_mock_declined) -> 'expired', mất quyền, Payment 'failed' lý do card_declined", "Chức năng", "Cao", JOB,
      ["U POST /trial {interval:'annual', paymentMethod:{..., token:'tok_mock_declined'}} (chỉ gọi được bằng API; FE sinh token ngẫu nhiên)", "Ép hết thử bằng SQL như trên, chờ job", "Kiểm tra Subscription, quyền, Payment, thông báo"], "tok_mock_declined",
      "Subscription 'expired'; U không còn là thành viên; Payment duy nhất kind 'initial', status 'failed', failureReason 'card_declined'; có thông báo cho U (theo luồng gia hạn lỗi).", pw="Không")
    A(F, "Hủy trong lúc dùng thử: không bị trừ, gói hết thử thành 'expired' (KHÔNG phải 'canceled'), mất quyền", "Chức năng", "Cao", JOB + " " + DEC,
      ["U POST /trial {interval:'annual', paymentMethod hợp lệ}", "POST /communities/<id>/subscription/cancel {atPeriodEnd:true}", "SQL ép hết thử, chờ job", "Kiểm tra Payment/Subscription/quyền"], "cancel khi trial",
      "0 Payment của U; Subscription 'expired' (nhánh dùng thử sẵn có - docs mục 10: hết thử đã hủy chuyển 'expired' không phải 'canceled'); không còn là thành viên.", pw="Không")
    A(F, "Nhắc 3 ngày trước ngày trừ: chỉ khi trial có thẻ, không hủy, trong cửa sổ - email (outbox) + thông báo 'Dùng thử sắp kết thúc'", "Chức năng", "Cao", JOB + " Cần ENABLE_DEV_OUTBOX=1 (backend/.env). " + DEC,
      ["U POST /trial {interval:'annual', paymentMethod:{last4 4242}}", "Chờ ngay: GET /api/dev/outbox?to=<email U> -> chưa có thư (còn 7 ngày)", "SQL: UPDATE \"Subscription\" SET \"currentPeriodEnd\"=now()+interval '2.5 days',\"trialEndsAt\"=now()+interval '2.5 days' WHERE \"userId\"='<U>'", "Chờ job payments.trialReminders (<= 15 phút) rồi GET outbox và GET /api/notifications của U"], "còn 2,5 ngày",
      "Còn 5+ ngày: chưa gửi gì; còn 2,5 ngày (<= 3): đúng 1 thư có '48.00 USD' và '4242' trong nội dung + 1 thông báo in-app tiêu đề chứa 'Dùng thử sắp kết thúc'; Subscription.trialReminderSentAt có giá trị.", pw="Không")
    A(F, "Nhắc idempotent: chạy lại/hai instance song song vẫn chỉ 1 thư và 1 thông báo cho mỗi gói", "Chức năng", "Cao", JOB + " Hai instance BE (xem sheet Tài khoản & dữ liệu test, SETUP 16) hoặc chờ nhiều chu kỳ job.", ["Sau khi đã nhận nhắc, chờ thêm >= 2 chu kỳ job (hoặc chạy 2 instance cùng DB)", "Đếm thư trong outbox và thông báo"], "-", "Vẫn đúng 1 thư và 1 thông báo (cờ trialReminderSentAt được giành nguyên tử; chỉ một job thắng).", pw="Không")
    A(F, "Không nhắc cho: gói đã hủy, gói trial KHÔNG thẻ, gói còn > 3 ngày", "Chức năng", "Trung bình", JOB, ["Tạo 3 người: V (có thẻ + đã hủy), W (không thẻ), X (có thẻ, còn 7 ngày)", "Ép V,W còn 2,5 ngày", "Chờ job trialReminders"], "-", "V, W: trialReminderSentAt vẫn NULL và không có thư; X chưa nhắc.", pw="Không")
    A(F, "payments.trialReminderDays=0 tắt nhắc; đặt 5 thì nhắc sớm hơn (còn 4,5 ngày đã nhắc)", "Chức năng", "Thấp", JOB + " " + DEC, ["admin PATCH {\"payments\":{\"trialReminderDays\":5}}", "U có thẻ, ép còn 4,5 ngày", "Chờ job"], "5", "Có thư nhắc (cửa sổ 5 ngày); đặt 0: không có thư.", pw="Không")
    A(F, "Email nhắc chỉ ghi vào outbox dev, chưa gửi email thật (SES/SMTP)", "Chức năng", "Thấp", JOB, ["Kiểm tra outbox khi tắt ENABLE_DEV_OUTBOX và cấu hình mail"], "-", "HIỆN TẠI: mail chỉ là outbox bộ nhớ (như các email khác); 'nhận email thật' chưa làm. Kế hoạch (cùng nhóm 'Email thật' ở Nhật ký thay đổi).", pw="Không", st=PLAN)
    A(F, "Job nền đăng ký đúng: payments.trialReminders mỗi 15 phút, payments.subscriptions mỗi 5 phút", "Hiệu năng", "Thấp", BASE + " Xem log BE khi khởi động.", ["Đọc backend/src/jobs.ts hoặc log khởi động", "Đo khoảng cách hai lượt chạy"], "-", "payments.subscriptions 5 phút, payments.trialReminders 15 phút (leader election: chỉ 1 instance chạy mỗi lượt).", pw="Không")
    A(F, "Cổng thanh toán giả (MockGateway): luôn thành công trừ token tok_mock_declined hoặc người bị ép lỗi trong test", "Tích hợp", "Thấp", BASE, ["Dùng thẻ UI bất kỳ (token ngẫu nhiên) -> luôn thành công", "Dùng API với tok_mock_declined -> từ chối ở bước trừ tiền"], "-", "UI không thể giả lập thẻ bị từ chối (token do FE sinh ngẫu nhiên); chỉ API/test BE. Gateway thanh toán thật (Stripe/PayOS) chưa nối.", pw="Không")

    # ============================================================================================ 10. HỒI QUY / KẾ HOẠCH / LỆCH
    F = "Hồi quy, điểm chưa làm, lệch UI-docs-code"
    A(F, "/billing hiển thị gói năm sai kỳ: hiện '<giá>/tháng' cho gói $48/năm", "Giao diện", "Cao", UIM,
      ["Mua/dùng thử gói năm ở annual-demo", "Mở /billing"], "$48/năm",
      "HIỆN TẠI (đọc code BillingPage): hiển thị `${formatCents(priceCents)}/tháng · Kỳ hiện tại: ...` -> '$48/tháng' sai cho gói năm; chưa hiện chu kỳ hay thẻ. KỲ VỌNG: '$48/năm' (hoặc 'Hàng năm') và thẻ •••• 4242. Kế hoạch (cần sửa FE).", pw="Có", st=PLAN)
    A(F, "Admin > Thanh toán > Gói đăng ký: cột 'Chu kỳ' luôn 'Hàng tháng' kể cả gói năm", "Giao diện", "Trung bình", UIM + " Đăng nhập admin@sofinhub.test và có ít nhất một gói năm.",
      ["Mở /admin/payments/subscriptions, tìm gói của người vừa mua gói năm"], "gói năm", "HIỆN TẠI: BE trả billingCycle:'monthly' cố định (admin-payments.service.ts) nên gói năm hiển thị 'Hàng tháng' với số tiền 4800¢. KỲ VỌNG: 'Hàng năm'. Kế hoạch.", pw="Có", st=PLAN)
    A(F, "Đổi chu kỳ gói đang sống (tháng <-> năm) CHƯA hỗ trợ: checkout khác kỳ hạn khi đã active -> 409", "Chức năng", "Cao", JOB + " " + DEC,
      ["U mua gói tháng", "U POST checkout {interval:'annual'}", "Tìm chức năng 'Đổi sang gói năm' ở /billing hoặc trang cộng đồng"], "monthly -> annual", "HIỆN TẠI: 409 'đang có gói thành viên còn hiệu lực', không có nút/endpoint đổi chu kỳ, không tính chênh lệch (proration). KỲ VỌNG: nâng/hạ gói theo kỳ kế tiếp. Kế hoạch.", pw="Không", st=PLAN)
    A(F, "Chưa có giao diện quản lý thẻ đã lưu (xem/xóa/đổi thẻ); chỉ có GET /me/payment-methods", "Chức năng", "Trung bình", UIM, ["Tìm trong /billing hoặc Cài đặt mục thẻ thanh toán"], "-", "HIỆN TẠI: không có màn; thẻ chỉ được lưu khi nhập ở dialog/wizard và dùng cho tự trừ. Muốn đổi thẻ trước khi hết thử phải hủy rồi (không thể thử lần hai). Kế hoạch.", pw="Có", st=PLAN)
    A(F, "Tiền tệ lẫn lộn: hộp thoại gói thành viên theo USD ($7/$48) còn mockup/gói owner tính VND (mockup 3.png dùng $)", "Giao diện", "Trung bình", UIB + " " + DEC,
      ["Đọc giá ở hộp thoại ($) và ở bước 2 wizard (₫)", "Admin > Cài đặt chung: payments.currency"], "USD vs VND", "payments.currency chỉ lưu (USD mặc định) không đổi giao diện; hộp thoại luôn dùng quote.currency 'USD'. Cần chủ sở hữu chốt tiền tệ thống nhất (A16). Ghi nhận hiện trạng.", st=PLAN)
    A(F, "Hoa hồng 10%, phí cổng 2,9% + 30¢, cửa sổ hoàn tiền 7 ngày, dùng thử 7 ngày, nhắc 3 ngày, kỳ 365 ngày: giá trị tạm", "Chức năng", "Thấp", BASE + " " + DEC, ["Admin > Hệ thống > Cài đặt chung: đọc các giá trị", "Đối chiếu với kết quả quote/estimate/refund"], "-", "Các số khớp tài liệu (commissionPct 10, gatewayFeePct 2.9, gatewayFeeFixedCents 30, refundWindowDays 7, trialDays 7, trialReminderDays 3 - không có ô UI, annualPeriodDays 365 - không có ô UI). Mọi case phụ thuộc các số này gắn nhãn chờ chốt.", pw="Một phần")
    A(F, "Hồi quy: cộng đồng chỉ có gói tháng (paid-demo $19): dùng thử/thanh toán như trước, không có UI gói năm", "Chức năng", "Cao", UIM, ["newbie@ mở paid-demo, thử dùng thử hoặc thanh toán với thẻ hợp lệ"], "paid-demo", "Dialog một thẻ 'Hàng tháng'; dùng thử (7 ngày) hoặc thanh toán $19 thành công; kỳ 30 ngày.")
    A(F, "Hồi quy: dùng thử KHÔNG thẻ qua API cũ (POST /trial {}) vẫn tạo gói trialing 7 ngày như trước", "Chức năng", "Cao", APIM, ["POST /communities/paid-demo/trial (không body)"], "-", "201 trialing; hết thử là hết quyền (không tự trừ).", pw="Không")
    A(F, "Hồi quy: cộng đồng riêng tư MIỄN PHÍ vẫn dùng JoinRequestDialog và quy trình duyệt cũ (private-demo)", "Chức năng", "Trung bình", UIM, ["newbie@ mở private-demo -> 'Gửi yêu cầu tham gia' -> gửi lời nhắn"], "private-demo", "Hộp 'Cộng đồng riêng tư' (chỉ ô Lời nhắn nếu cộng đồng không có câu hỏi), gửi được; nút chuyển 'Đã gửi yêu cầu – chờ duyệt'.")
    A(F, "Hồi quy: nhận lời mời vào cộng đồng có phí (DEMO-PAID) vẫn 402 và dẫn tới hộp chọn gói", "Chức năng", "Thấp", UIM, ["newbie@ mở link mời DEMO-PAID của paid-demo", "Chấp nhận lời mời"], "DEMO-PAID", "Nhận lời mời vẫn trả 402 PAYMENT_REQUIRED (theo seed); sau đó vào được luồng thanh toán như thường.", pw="Một phần")
    A(F, "Hồi quy: PaymentIntent cũ của FE khác (amountUsd, trialDays) vẫn có mặt; thêm interval + paymentCardId", "Tích hợp", "Thấp", APIM, ["POST checkout, đọc response"], "-", "Có amountUsd, amountCents, trialDays, status, kind, interval, paymentCardId (không nhúng object paymentMethod - docs mục 10).", pw="Không")
    A(F, "Nhãn 'Phổ biến nhất' luôn gắn gói tháng (popular:true) kể cả khi gói năm tiết kiệm hơn - đúng thiết kế 3.png nhưng cứng trong BE", "Giao diện", "Thấp", UIB + " " + DEC, ["Đọc plans[].popular từ quote", "Mở hộp thoại"], "-", "plans[0].popular=true (monthly), plans[1].popular=false; hộp thoại gắn 'Phổ biến nhất' ở thẻ tháng. Chưa có cấu hình chọn gói nổi bật - cần chủ sản phẩm xác nhận.", st=PLAN)
    A(F, "Hộp thoại gói không thể chọn phương thức khác (vnpay/momo) - luôn 'stripe' dù API cho phép", "Chức năng", "Thấp", UIB, ["Tìm lựa chọn phương thức thanh toán trong hộp thoại"], "-", "HIỆN TẠI: chỉ form thẻ (method 'stripe'); vnpay/momo chỉ tồn tại ở API. Kế hoạch khi nối cổng thật.", st=PLAN)
    A(F, "Đổi gói/interval KHÔNG làm đổi giá thành viên cũ: owner đổi giá năm chỉ áp dụng cho giao dịch mới", "Chức năng", "Trung bình", JOB + " " + DEC, ["U mua gói năm 48", "Owner PATCH priceAnnualUsd 60", "U xem subscription/ gia hạn sau 366 ngày (ép SQL)"], "48 -> 60", "Subscription.priceCents của U giữ 4800 cho tới khi gia hạn; quyết định gia hạn dùng giá hiện tại hay giá cũ cần xác nhận (ghi lại kết quả thực tế vào ghi chú test).", pw="Không", st=PLAN)


# ====================================================================================================================
#                         BỔ SUNG (cuối từng module - giữ thứ tự để mã TC không đổi)
# ====================================================================================================================
def load_wiz_more(add):
    M, MN = "WIZ", "Tạo cộng đồng (wizard 5 bước)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    F = "Dữ liệu seed wizard"
    SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (bảng Prisma Community = \"Course\")."
    A(F, "Seed tạo đúng 3 nháp của owner (id draft-gom-cuoi-tuan, draft-chay-bo-5k, draft-viet-content) với completedSteps/giá/nội dung như mô tả", "Tích hợp", "Cao", BASE + " " + SQLH,
      ["SELECT id,title,category,\"moderationStatus\",\"draftSteps\",\"priceCents\",\"priceAnnualCents\",visibility FROM \"Course\" WHERE id LIKE 'draft-%'", "owner GET /api/me/community-drafts"], "3 nháp",
      "3 dòng moderationStatus 'draft', ownerId = owner: gom (hobby, ['basics']), chay-bo (sports, ['basics','plan','identity'], màu #16a34a), viet-content (content, 4 bước, 700¢/4800¢, private, 2 câu hỏi, 2 nội quy, requireRulesAgreement). Có 1 HostingPlan (chay-bo-5k: pro monthly trialing 14 ngày, thẻ visa 4242 token tok_mock_seed_owner) và 1 PayoutAccount (viet-content: connected, Vietcombank, last4 8812).", pw="Không")
    A(F, "Seed create-only: chạy lại npm run db:seed KHÔNG ghi đè tiến độ nháp mà người dùng đã sửa (update: {})", "Tích hợp", "Trung bình", BASE + " " + MUTATE,
      ["owner sửa tên nháp draft-gom-cuoi-tuan thành 'Gốm Mới' (PATCH basics)", "cd backend && npm run db:seed", "GET draft-gom-cuoi-tuan/draft"], "-", "Tên vẫn 'Gốm Mới' (upsert update rỗng); không nhân đôi nháp/gói/thẻ. Dùng db:reset để về seed gốc.", pw="Không")
    A(F, "Seed 3 danh mục mới (music 'Âm nhạc', sports 'Thể thao', spirituality 'Tâm linh') thêm sau 8 danh mục cũ; không bật lại mục admin đã tắt", "Tích hợp", "Trung bình", BASE + " " + MUTATE,
      ["Admin > Khám phá > Danh mục: kiểm tra 11 dòng, vị trí 9-11", "Tắt 'Âm nhạc', chạy npm run db:seed, kiểm tra lại GET /api/categories"], "music/sports/spirituality", "Đủ 11 danh mục; sau khi tắt 'Âm nhạc' và seed lại, mục vẫn tắt (seed bỏ qua key đã tồn tại) và biến khỏi chip ở bước 1.", pw="Một phần")
    A(F, "Nháp seed không hiện với người khác/khách và không có trong bộ đếm/danh sách admin", "Bảo mật", "Cao", BASE + " " + tok("admin@sofinhub.test"),
      ["Khách GET /api/communities/draft-gom-cuoi-tuan", "GET /api/communities?limit=50&q=gom và /api/search?q=Gốm", "admin GET /api/admin/communities (tìm 'Gốm'), dashboard, Khám phá"], "-", "404 / không có trong mọi danh sách; admin không thấy 3 nháp (lọc moderationStatus <> 'draft'); số cộng đồng ở dashboard không tăng 3.", pw="Không")
    A(F, "Chưa có giao diện sửa giá năm/dùng thử/câu hỏi/nội quy/nhận diện của cộng đồng ĐÃ ra mắt (chỉ PATCH API)", "Chức năng", "Trung bình", BASE + " Đăng nhập owner@sofinhub.test; cộng đồng đã ra mắt (vd. annual-demo).",
      ["Mở /communities/annual-demo/community/cai-dat", "Tìm ô giá năm, dùng thử, câu hỏi gia nhập, nội quy, màu, lời hứa"], "-", "HIỆN TẠI: Cài đặt cộng đồng không có các ô này (FE không dùng joinQuestions/priceAnnualUsd ngoài wizard); chỉ PATCH /communities/:id nhận. Kế hoạch: giao diện sửa sau ra mắt.", pw="Có", st=PLAN)


def load_ann_more(add):
    M, MN = "ANN", "Gói năm & dialog tham gia"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    NEWU = "Người dùng MỚI (đăng ký ở /register hoặc POST /api/auth/register)."
    UIB = BASE + " Đăng nhập UI newbie@sofinhub.test / " + PW + " hoặc người dùng mới."
    UIM = UIB + " " + MUTATE
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api. Cộng đồng có phí do owner mới tạo: POST /api/communities {title, description, category:'tech', priceUsd:7, priceAnnualUsd:48, visibility:'public'}."
    APIM = API + " " + MUTATE
    SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub."

    F = "Giá trong hộp thoại cho cộng đồng catalogue (chỉ gói tháng)"
    for cid, price in [("ai", 7), ("biz", 9), ("des", 10), ("write", 12), ("mkt", 15), ("py", 7), ("data", 5), ("yoga", 8), ("cook", 19)]:
        A(F, f"Cộng đồng '{cid}' (${price}): hộp thoại có 1 thẻ 'Hàng tháng ${price}/tháng', tổng ${price}, CTA dùng thử", "Giao diện", "Thấp", UIB + " Cộng đồng catalogue có phí công khai (xem sheet 'Tài khoản & dữ liệu test' mục A7).",
          [f"Mở /communities/{cid}, bấm 'Tham gia ngay'", "Đọc thẻ gói, dòng tóm tắt, khung quà"], f"{cid} ${price}",
          f"Một thẻ 'Hàng tháng' '${price}/tháng' + '${price} thanh toán hàng tháng'; tóm tắt '${price}/tháng · thanh toán hàng tháng' và tổng '${price}'; không nhãn 'Tiết kiệm'; CTA 'Bắt đầu dùng thử miễn phí' (dùng thử 7 ngày) và ghi chú lần thanh toán đầu = giá ${price}.", pw="Một phần")

    F = "Cộng đồng annual-demo & hiển thị giá năm ngoài hộp thoại"
    A(F, "annual-demo: GET /communities/annual-demo có priceAnnualUsd 48, annualSavingsPct 43, memberTrialEnabled true, brandColor, promise, benefits, rules", "Tích hợp", "Cao", BASE,
      ["GET /api/communities/annual-demo (không token)"], "annual-demo", "200: priceUsd 7, priceAnnualUsd 48, annualSavingsPct 43, memberTrialEnabled true, brandColor '#2563eb', promise 'Học đều mỗi tuần, tiết kiệm 43% khi trả theo năm', benefits 2 mục, rules 1 mục ('Tôn trọng lẫn nhau'), joinQuestions [], visibility 'public', pricing 'paid'.", pw="Không")
    A(F, "annual-demo hiển thị ở Khám phá/tìm kiếm với chủ 'Olivia Owner'; owner có vai trò owner", "Chức năng", "Trung bình", UIB,
      ["Tìm 'gói năm' ở Khám phá", "Mở thẻ", "Đăng nhập owner@ xem nút ở trang chi tiết"], "annual-demo", "Có trong danh sách (công khai, listed) và kết quả tìm kiếm; trang chi tiết có 'do Olivia Owner'; owner thấy 'Đã tham gia' (vai trò owner).", pw="Một phần")
    A(F, "Seed annual-demo create-only: sửa giá bằng PATCH rồi npm run db:seed không đưa về $7/$48", "Tích hợp", "Thấp", BASE + " " + MUTATE, ["owner PATCH /communities/annual-demo {priceAnnualUsd:60}", "cd backend && npm run db:seed", "GET lại"], "60", "priceAnnualUsd vẫn 60 (upsert update rỗng); dùng db:reset để về $48.", pw="Không")
    A(F, "Trang chi tiết và thẻ Khám phá CHƯA hiển thị giá năm/'tiết kiệm' (chỉ giá tháng)", "Giao diện", "Thấp", UIB, ["Mở /communities/annual-demo và trang Khám phá, tìm giá năm/tiết kiệm 43%"], "-", "HIỆN TẠI: chỉ hiện giá tháng; priceAnnualUsd/annualSavingsPct có trong dữ liệu nhưng chỉ được dùng trong wizard và hộp thoại (grep FE). Giá năm chỉ lộ ra khi mở hộp thoại. KỲ VỌNG (mockup): hiện 'hoặc $48/năm'. Kế hoạch.", st=PLAN)

    F = "Kịch bản bổ sung (an toàn, đồng thời, UX)"
    A(F, "Tiêu đề/chủ cộng đồng chứa <script> hiển thị như văn bản trong hộp thoại (escape)", "Bảo mật", "Cao", UIM + " Tạo cộng đồng có phí tên '<img src=x onerror=alert(1)>' (tối đa 80 ký tự bằng POST /communities).",
      ["Mở hộp thoại của cộng đồng đó"], "<img onerror>", "Tên hiển thị nguyên văn, không thực thi script, ô logo vẫn dùng 2 chữ cái đầu.")
    A(F, "Hai request /trial song song cùng người: một 201, một 409, đúng 1 gói sống", "Hiệu năng", "Cao", APIM + " " + SQLH, ["U gửi 2 POST /communities/<id>/trial cùng lúc (Promise.all)", "SELECT count(*) FROM \"Subscription\" WHERE \"userId\"='<U>' AND status IN ('trialing','active')"], "song song", "Một 201 + một 409; count = 1 (partial unique index 1 gói sống/(user, cộng đồng)).", pw="Không")
    A(F, "Hai confirm song song cùng một intent: cổng chỉ bị gọi 1 lần, chỉ 1 Payment succeeded", "Hiệu năng", "Cao", APIM + " " + SQLH, ["U POST checkout, rồi 2 POST /payments/<id>/confirm cùng lúc", "SELECT count(*) FROM \"Payment\" WHERE \"userId\"='<U>' AND status='succeeded'"], "song song", "Cả hai trả cùng kết quả succeeded; count = 1 (idempotent / chống double-confirm).", pw="Không")
    A(F, "Confirm lỗi rồi bấm lại: intent pending được TÁI DÙNG (không sinh intent mới) trong 15 phút", "Chức năng", "Trung bình", APIM, ["U POST checkout (annual) lấy id1", "Không confirm; U POST checkout (annual) lần nữa (key mới)"], "-", "id2 = id1 (pending cùng interval + amount); không có hai Payment pending cho cùng người/cộng đồng.", pw="Không")
    A(F, "Giá đổi khi hộp thoại đang mở: người dùng thấy $48 nhưng server tính theo giá hiện tại ($60)", "Chức năng", "Trung bình", UIM + " " + DEC,
      ["Người dùng mở hộp thoại annual-demo (đang thấy $48)", "Owner PATCH priceAnnualUsd 60", "Người dùng nhập thẻ và bấm CTA (không đóng hộp thoại)"], "48 -> 60",
      "HIỆN TẠI: BE tính theo giá mới (thanh toán 6000¢; nếu dùng thử thì lần trừ đầu 6000¢) trong khi giao diện vẫn hiển thị $48 - không có bước xác nhận lại giá. KỲ VỌNG: báo giá đã đổi/yêu cầu xác nhận. Kế hoạch.", pw="Một phần", st=PLAN)
    A(F, "Hủy dùng thử từ /billing: 'Hủy gói' (cuối kỳ/ngay); hết thử khi đã hủy -> không bị trừ", "Chức năng", "Cao", UIM, ["Dùng thử gói năm ở annual-demo", "Mở /billing, bấm 'Hủy gói', chọn 'Hủy vào cuối kỳ'", "Quan sát trạng thái"], "-", "Modal 'Hủy gói thành viên' với 2 lựa chọn ('Hủy vào cuối kỳ' / 'Hủy ngay'); trạng thái hiển thị đã hủy cuối kỳ; sau khi hết thử: không Payment (xem case job). Khung quà ở dialog hứa 'Hủy bất cứ lúc nào chỉ với 1 lần bấm' - cần 2 bước (mở modal + chọn) ở /billing: ghi nhận.", pw="Một phần")
    A(F, "Màn Doanh thu của owner (/communities/<id>/revenue-dashboard): MRR gói năm = giá/12 và 'x thành viên trả phí · y dùng thử'", "Chức năng", "Trung bình", UIM + " Đăng nhập owner@ sau khi có 1 người mua gói năm + 1 gói tháng ở cộng đồng của owner. " + DEC,
      ["Mở trang doanh thu của annual-demo"], "4800 + 700", "Thẻ MRR = $11 (400¢ + 700¢ = 1100¢, hiển thị theo formatCents), '2 thành viên trả phí · 0 dùng thử'; tổng doanh thu gồm cả 4800¢ gói năm.", pw="Một phần")
    A(F, "Thông báo in-app 'Dùng thử sắp kết thúc' hiển thị ở chuông thông báo và dẫn tới cộng đồng", "Chức năng", "Trung bình", UIM + " " + SQLH + " Job nền trialReminders (15 phút).", ["Dùng thử có thẻ, ép còn 2,5 ngày bằng SQL, chờ job", "Mở chuông thông báo trên Header"], "-", "Có thông báo 'Dùng thử sắp kết thúc' (kèm số tiền/ngày trừ) và bấm vào mở trang cộng đồng; đã đọc/chưa đọc hoạt động như thông báo khác.", pw="Một phần")
    A(F, "Mô phỏng thời gian xử lý: sau checkout đợi ~0,6s rồi confirm, người dùng thấy 'Đang xử lý…' liên tục", "Giao diện", "Thấp", UIM, ["Thanh toán (không thử) và quan sát nhãn nút qua 3 request (checkout, chờ, confirm)"], "-", "Nhãn 'Đang xử lý…' suốt quá trình; không nhấp nháy về 'Thanh toán' giữa hai request.", pw="Một phần")
