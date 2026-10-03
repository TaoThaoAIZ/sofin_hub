# -*- coding: utf-8 -*-
"""Testcase luồng 'Cài đặt hồ sơ' (Settings) - 6 module mới (08/10/2026):
SETP 'Cài đặt - Hồ sơ' (+ khung/điều hướng chung), SETS 'Cài đặt - Tài khoản & bảo mật', SETN 'Cài đặt - Thông báo',
SETC 'Cài đặt - Cộng đồng của tôi', SETB 'Cài đặt - Thanh toán', SETR 'Cài đặt - Giới thiệu'.

Nguồn sự thật: docs/features/{settings-profile-security,settings-notify-communities,settings-billing-referral}.md,
backend/docs/api/{settings-account,settings-notify-communities,referrals,payments,notifications}.md, docs/OPEN_DECISIONS.md (A16, A17),
backend/tests/{account-settings,notifications-settings,my-communities,payment-cards,referrals}.test.ts (hành vi + mã lỗi + giới hạn),
frontend/src/features/settings/** + features/referral/** (nhãn/ thông báo thật), mockup scratchpad/cdhs/template.html ('Cai dat ho so').
Thêm case mới = thêm `A(...)` CUỐI mỗi hàm load_* (giữ thứ tự để mã TC-SETx-nnn không đổi).

SỐ LIỆU CHÍNH XÁC (từ test BE / code):
- Handle ^[a-z0-9._]{3,24}$, không bắt đầu/kết thúc '.', không '..', tự hạ chữ thường; giữ chỗ: admin, sofinhub, support...; bio <= 150; location <= 120 (FE ô Thành phố maxLength 300);
  instagram ^@?[A-Za-z0-9._]{1,30}$ (lưu không @); website/youtube URL http/https; avatar upload tối đa 3MB (UPLOAD_MAX_AVATAR_MB) JPEG/PNG/WebP/GIF.
- 2FA TOTP RFC 6238: SHA1, 6 số, bước 30s, lệch +-1 bước, mỗi (user, bước) dùng 1 lần; tối đa 8 lần thử / 5 phút / user -> 429; vé đăng nhập bước 2 là JWT 5 phút typ '2fa'.
  Secret base32 32 ký tự (/^[A-Z2-7]{32}$/), otpauth://totp/SofinHub:<email>?secret=...; chỉ trả ra ở /auth/2fa/setup.
- Đổi email: POST /auth/change-email {newEmail,password} -> 202 {pendingEmail}; link {FRONTEND_URL}/verify-email?token= gửi tới email MỚI; rate limit IP 5/15 phút; cooldown gửi lại 60s (429).
- Thông báo mặc định: emailDigest 'off', quiet {enabled:false, from:'22:00', to:'07:00'}, dmAllowed/emailUnreadDm/notifyFollowedPosts = true, communityPrefs {}.
  Giờ im lặng [from,to), qua nửa đêm hợp lệ, from==to = rỗng (bật mà from==to -> 400), múi giờ lạ -> Asia/Ho_Chi_Minh. 16:00Z = 23:00 VN = 11:00 New York.
- Thanh toán: thẻ tối đa 10 (CARD_LIMIT), CARD_EXISTS, CARD_IN_USE; billing-summary: $7/tháng + $48/năm -> monthlyTotalCents 700 + 400 = 1100, activeCount 2, bỏ gói hủy cuối kỳ.
- Giới thiệu mặc định (TẠM, A17): creator 3000 bps (30%), member 1000 bps (10%), cửa sổ 60 ngày, chi trả ngày 5; $10 -> hoa hồng 100¢; $20 -> 200¢; memberRateBps 2500 -> 250¢ trên $10.
  /me/referral/users: all=false 4 dòng mới nhất, all=true tối đa 500; nhắc nâng cấp 1 lần/24h (429 REMINDER_COOLDOWN), người đã trả phí 409 NOT_TRIALING, người lạ 404.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"
DEC = "[PHỤ THUỘC QUYẾT ĐỊNH CHƯA CHỐT]"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev), frontend :5173; "
        "xem sheet 'Tài khoản & dữ liệu test' mục A10 (dữ liệu/ môi trường cho Cài đặt).")
MUTATE = ("Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset (db:seed là create-only, KHÔNG hoàn tác); "
          "hoặc chỉ dùng người dùng do chính case tạo ra.")
NEWU = ("Người dùng MỚI (đăng ký ở /register hoặc POST /api/auth/register {firstName,lastName,email,password:'Passw0rd!x'}) - dùng tài khoản mới mỗi lần chạy "
        "để không dính dữ liệu cũ (handle, 2FA, thẻ, giới hạn).")
SQL = "Có psql: docker exec -it sofinhub-postgres psql -U <user> -d <db> (xem DEPLOY.md) để ép dữ liệu/ thời gian."
MAIL = "Email dev đọc ở GET http://localhost:4000/api/dev/outbox?to=<email> (cần ENABLE_DEV_OUTBOX=1, mặc định bật ở dev)."
TOTP = ("Cần ứng dụng TOTP (Google Authenticator/Authy) hoặc công cụ tính TOTP SHA1 6 số 30 giây từ secret base32 (vd. 'oathtool --totp -b <secret>'); "
        "đồng hồ máy khớp thời gian thật.")
WEIRD = "Mockup template.html 'Cai dat ho so' mở song song để đối chiếu."


def tok(email=None):
    who = email or "<email>"
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{who}\",\"password\":\"{PW}\"}} -> data.accessToken, gửi header Authorization: Bearer <token>."


def load(add):
    load_setp(add)
    load_sets(add)
    load_setn(add)
    load_setc(add)
    load_setb(add)
    load_setr(add)
    load_setp_more(add)
    load_sets_more(add)
    load_setn_more(add)
    load_setc_more(add)
    load_setb_more(add)
    load_setr_more(add)


def _mk(add, code, name):
    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(code, name, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)
    return A


# ====================================================================================================================
#                                  MODULE SETP - Hồ sơ + khung Cài đặt dùng chung
# ====================================================================================================================
NAVS = [("/settings", "Hồ sơ", "person"), ("/settings/thong-bao", "Thông báo", "notifications"),
        ("/settings/bao-mat", "Tài khoản & bảo mật", "lock"), ("/settings/thanh-toan", "Thanh toán", "credit_card"),
        ("/settings/cong-dong", "Cộng đồng của tôi", "group"), ("/settings/gioi-thieu", "Chương trình giới thiệu", "redeem")]


def load_setp(add):
    A = _mk(add, "SETP", "Cài đặt - Hồ sơ")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + "."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó."
    UIM = UINEW + " " + MUTATE
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE

    # ------------------------------------------------------------------ 1. LỐI VÀO & KHUNG
    F = "Lối vào & điều hướng chung"
    A(F, "Menu avatar ở Header: mục 'Cài đặt hồ sơ' mở /settings (tab Hồ sơ)", "Chức năng", "Cao", UI,
      ["Ở trang chủ bấm avatar góc phải Header", "Bấm 'Cài đặt hồ sơ'"], "/settings",
      "Chuyển tới /settings, khung Cài đặt hiện (topbar 68px + sidebar 6 mục) và tab 'Hồ sơ' đang chọn; form 'Thông tin công khai' đã nạp họ/tên của tài khoản.")
    A(F, "Menu avatar ở Header: 'Gói & thanh toán' (link cũ /billing) vẫn chạy và đưa tới tab Thanh toán", "Chức năng", "Cao", UI,
      ["Bấm avatar ở Header", "Bấm 'Gói & thanh toán'"], "/billing -> /settings/thanh-toan",
      "Route /billing là <Navigate replace> sang /settings/thanh-toan: URL cuối là /settings/thanh-toan, tab 'Thanh toán' active, nút Back không quay lại /billing (replace).")
    A(F, "Menu avatar trong topbar Cài đặt: email, 'Về trang chủ', 'Hồ sơ & cài đặt', 'Tin nhắn', 'Đăng xuất' (+ 'Quản trị' chỉ với Platform Admin)", "Giao diện", "Trung bình", UI,
      ["Ở /settings bấm avatar góc phải", "Đối chiếu danh sách mục", "Đăng nhập lại bằng admin@sofinhub.test và mở lại menu"], "member1 vs admin",
      "member1: dòng email (mờ), Về trang chủ, Hồ sơ & cài đặt, Tin nhắn, Đăng xuất (KHÔNG có 'Quản trị'). admin@: có thêm 'Quản trị' -> /admin. Bấm ra ngoài menu thì đóng (useClickOutside); chọn mục thì đóng.")
    A(F, "Topbar: logo về '/', ô tìm kiếm 'Tìm cộng đồng, bài viết, khóa học...', nút Tin nhắn, chuông thông báo; ô tìm kiếm ẩn dưới 640px", "Giao diện", "Trung bình", UI,
      ["Ở /settings bấm logo SofinHub", "Quay lại /settings, gõ từ khóa vào ô tìm kiếm rồi Enter", "Thu hẹp cửa sổ < 640px"], "-",
      "Logo -> '/'. Tìm kiếm chuyển sang trang /search?q=... như Header chính. Dưới 640px ô tìm kiếm bị ẩn (max-sm:hidden), vẫn còn Tin nhắn/chuông/avatar. Chuông hiện số chưa đọc thật.")
    A(F, "Avatar topbar: có ảnh thì hiện ảnh tròn 42px, chưa có ảnh thì chip chữ cái đầu (Tên + Họ) nền xanh #2f4fa8", "Giao diện", "Thấp", UI,
      ["Đăng nhập tài khoản chưa có ảnh đại diện", "Quan sát avatar topbar", "Đặt ảnh ở tab Hồ sơ rồi Lưu"], "Nguyễn Văn An -> 'NV' hoặc theo (firstName[0]+lastName[0])",
      "Chip hiển thị chữ cái đầu của Tên rồi Họ (viết hoa). Sau khi lưu ảnh, topbar đổi sang ảnh ngay không cần F5.")
    A(F, "Đăng xuất từ menu topbar: gọi logout rồi về '/', mở lại /settings bị chuyển /login", "Chức năng", "Cao", UI,
      ["Ở /settings mở menu avatar, bấm 'Đăng xuất'", "Quan sát URL", "Mở lại http://localhost:5173/settings"], "-",
      "Phiên bị hủy, URL '/' , mở /settings sau đó chuyển /login (RequireAuth).")
    A(F, "Khách chưa đăng nhập mở từng route trong 6 route Cài đặt bị chuyển /login và sau đăng nhập quay lại ĐÚNG route đó", "Bảo mật", "Cao", BASE + " Chưa đăng nhập (xóa cookie/ localStorage).",
      ["Với mỗi route trong danh sách: mở http://localhost:5173<route>", "Quan sát URL (phải là /login)", "Đăng nhập member1@sofinhub.test / " + PW, "Quan sát URL sau đăng nhập"], "/settings, /settings/thong-bao, /settings/bao-mat, /settings/thanh-toan, /settings/cong-dong, /settings/gioi-thieu",
      "SettingsLayout bọc RequireAuth: mọi route chuyển /login, KHÔNG lộ form/ số liệu; đăng nhập xong quay lại đúng route đã mở và tab tương ứng hiển thị.")
    A(F, "Sidebar 'Cài đặt': đúng 6 mục theo thứ tự, nhãn và biểu tượng, có đường kẻ ngăn trước 'Cộng đồng của tôi'", "Giao diện", "Cao", UI + " " + WEIRD,
      ["Mở /settings", "Đọc sidebar từ trên xuống, đối chiếu mockup"], "6 mục",
      "Tiêu đề 'Cài đặt' (26px đậm), nav aria-label='Cài đặt' gồm: Hồ sơ (person), Thông báo (notifications), Tài khoản & bảo mật (lock), Thanh toán (credit_card), [đường kẻ], Cộng đồng của tôi (group), Chương trình giới thiệu (redeem). Mỗi mục là vòng tròn 38px chứa biểu tượng + nhãn 15.5px.")
    A(F, "Trạng thái active của mục sidebar theo route (6 route): nền gradient cam nhạt, chữ đậm cam, vòng tròn cam + biểu tượng trắng đặc; mục khác nền trắng", "Giao diện", "Trung bình", UI,
      ["Lần lượt mở /settings, /settings/thong-bao, /settings/bao-mat, /settings/thanh-toan, /settings/cong-dong, /settings/gioi-thieu", "Mỗi lần quan sát sidebar"], "6 route",
      "Mỗi route CHỈ MỘT mục active tương ứng (Hồ sơ person / Thông báo notifications / Tài khoản & bảo mật lock / Thanh toán credit_card / Cộng đồng của tôi group / Chương trình giới thiệu redeem): nền from-#ffe9da to-#fff3ea, chữ cam đậm, vòng tròn gradient #ff8f45->#f26a1b, biểu tượng filled màu trắng; 5 mục còn lại nền trắng viền #efe9e4, biểu tượng đen. '/settings' (Hồ sơ) không active khi ở tab con (NavLink end).")
    A(F, "Chuyển tab bằng sidebar là điều hướng SPA (không tải lại trang), nút Back/Forward đi đúng lịch sử các tab", "Chức năng", "Trung bình", UI,
      ["Mở /settings, lần lượt bấm Thông báo -> Tài khoản & bảo mật -> Thanh toán", "Bấm Back 2 lần, Forward 1 lần", "Ở /settings/bao-mat bấm F5"], "-",
      "Không có nháy trắng toàn trang (topbar/sidebar giữ nguyên, chỉ vùng nội dung đổi). Back/Forward đưa về đúng tab và sidebar active theo. F5 ở /settings/bao-mat giữ nguyên tab (deep link).", pw="Một phần")
    promos = [("/settings", "Nâng cấp tài khoản", "Mở khóa thêm nhiều tính năng để phát triển cộng đồng của bạn.", "Khám phá ngay", "/communities/new"),
              ("/settings/bao-mat", "Bảo vệ tài khoản", "Kích hoạt xác minh 2 bước để tăng cường bảo mật cho tài khoản của bạn.", "Tìm hiểu thêm", "/settings/bao-mat?2fa=1"),
              ("/settings/thanh-toan", "Quản lý thanh toán dễ dàng", "Theo dõi chi tiêu, hóa đơn và nâng cấp gói linh hoạt.", "Tìm hiểu thêm", "/settings/thanh-toan"),
              ("/settings/cong-dong", "Khám phá thêm nhiều cộng đồng", "Kết nối, học hỏi và phát triển cùng những người cùng chí hướng.", "Khám phá ngay", "/search"),
              ("/settings/gioi-thieu", "Mời bạn bè, nhận hoa hồng", "Cùng phát triển cộng đồng và nhận thu nhập thụ động.", "Tìm hiểu thêm", "/settings/gioi-thieu")]
    A(F, "Thẻ quảng bá cuối sidebar đổi theo tab (5 tab có thẻ riêng): tiêu đề, mô tả, nút CTA và đích đúng bảng", "Giao diện", "Thấp", UI,
      ["Lần lượt mở 5 route và đọc thẻ gradient cuối sidebar", "Bấm nút CTA ở từng thẻ (quay lại sau mỗi lần)"], "5 route",
      " | ".join(f"{path}: '{t}' - '{s}' - nút '{cta}' -> {to}" for path, t, s, cta, to in promos) + ". Mỗi thẻ có biểu tượng cam lớn, tiêu đề đậm, mô tả xám, nút trắng + mũi tên; thẻ Bảo mật tự mở modal 'Bật xác minh 2 bước' rồi xóa ?2fa khỏi URL.")
    A(F, "Tab Thông báo không có thẻ quảng bá riêng: dùng lại thẻ 'Nâng cấp tài khoản' (fallback PROMO['/settings'])", "Giao diện", "Thấp", UI,
      ["Mở /settings/thong-bao", "Đọc thẻ cuối sidebar"], "/settings/thong-bao",
      "HIỆN TẠI thẻ là 'Nâng cấp tài khoản' - 'Khám phá ngay' -> /communities/new (map PROMO không có khóa thong-bao). Mockup chỉ định nghĩa thẻ cho 5 tab còn lại; ghi nhận để PO chốt nội dung riêng cho tab Thông báo.", st=PLAN)
    A(F, "Bố cục lưới tab Hồ sơ >= 1240px: 3 cột (sidebar 280px | form | thẻ xem trước 380px sticky)", "Giao diện", "Cao", UI + " Cửa sổ rộng >= 1280px.",
      ["Mở /settings ở 1440x900", "Cuộn trang dài"], "1440x900",
      "3 cột grid-cols-[280px_minmax(0,1fr)_380px]; sidebar và thẻ xem trước đều sticky (top 88px); thẻ xem trước nằm CỘT PHẢI cùng hàng với form.")
    A(F, "Bố cục lưới 900-1239px: 2 cột (sidebar 250px | nội dung), thẻ xem trước chuyển xuống DƯỚI form", "Giao diện", "Cao", UI,
      ["Đặt viewport 1024x768", "Mở /settings và cuộn xuống cuối form"], "1024x768",
      "2 cột [250px_1fr]; sidebar sticky; 'Người khác thấy bạn như thế này' + Hủy/Lưu nằm dưới hai khối form (col-start-2 row-start-2), không bị cắt.")
    A(F, "Bố cục < 900px: 1 cột, sidebar xếp trên cùng (không sticky), padding 16px, không cuộn ngang", "Giao diện", "Cao", UI,
      ["Đặt viewport 375x812 rồi 768x1024", "Duyệt 6 tab"], "375x812 / 768x1024",
      "Một cột: sidebar ở trên, nội dung bên dưới; không có thanh cuộn ngang toàn trang ở bất kỳ tab nào (bảng rộng như lịch sử thanh toán/ giới thiệu/ theo cộng đồng tự cuộn ngang trong khung của nó); nút bấm đủ lớn.")
    A(F, "Các tab khác (không phải Hồ sơ) dùng lưới 2 cột ở >= 1240px (không có cột phải 380px)", "Giao diện", "Thấp", UI,
      ["Ở 1440x900 mở lần lượt 5 tab còn lại"], "1440x900",
      "Sidebar 280px + một vùng nội dung; không để cột trống 380px bên phải (chỉ riêng tab Hồ sơ có cột xem trước).")
    A(F, "Route /me/communities (cũ) chuyển về /settings/cong-dong", "Chức năng", "Cao", UI,
      ["Mở http://localhost:5173/me/communities", "Quan sát URL và tab active"], "/me/communities",
      "Navigate replace sang /settings/cong-dong; tab 'Cộng đồng của tôi' active; không còn trang MyCommunitiesPage riêng (nháp wizard và 'Điểm của tôi' nằm cuối tab).")
    A(F, "Đường dẫn con không tồn tại /settings/khong-co hiện trang 404 (không trắng trang)", "Chức năng", "Thấp", UI,
      ["Mở http://localhost:5173/settings/khong-co"], "/settings/khong-co", "Route '*' -> NotFoundPage (SettingsLayout không bọc). Không lỗi console nghiêm trọng.")
    A(F, "Dấu '/' cuối URL: /settings/ vẫn là tab Hồ sơ và thẻ quảng bá đúng", "Chức năng", "Thấp", UI,
      ["Mở http://localhost:5173/settings/"], "/settings/", "Tab Hồ sơ hiển thị, lưới 3 cột (isProfile bỏ qua '/' cuối), thẻ 'Nâng cấp tài khoản'.", pw="Một phần")
    A(F, "Các file/trang cũ đã gỡ không còn truy cập được qua UI (ProfileForm, PasswordForm, SessionsPanel, DeleteAccountPanel, VerifyBanner, BillingPage, SettingsPage cũ)", "Chức năng", "Trung bình", UI,
      ["Tìm trên Header/Footer/menu mọi link tới trang hồ sơ/ mật khẩu/ phiên đăng nhập/ xóa tài khoản/ hóa đơn cũ", "Mở /billing, /me/communities, /settings"], "-",
      "Mọi link cũ dẫn về một trong 6 tab mới; không còn banner 'Xác minh email' riêng ở nơi khác (nay nằm ở dòng Email của tab Bảo mật); không còn 404/ trang trắng.")

    # ------------------------------------------------------------------ 2. HỒ SƠ - GIAO DIỆN
    F = "Hồ sơ - Bố cục & nạp dữ liệu"
    A(F, "Tab Hồ sơ đối chiếu mockup: 'Thông tin công khai', 'Liên kết & vị trí', thẻ 'Người khác thấy bạn như thế này', nút Hủy / Lưu thay đổi", "Giao diện", "Cao", UI + " " + WEIRD,
      ["Mở /settings", "So sánh từng khối với template.html"], "-",
      "Khối 1 tiêu đề 'Thông tin công khai' + phụ đề 'Mọi thành viên ở các cộng đồng bạn tham gia đều thấy phần này.' gồm: ảnh đại diện 112px, hai ô Họ/Tên, 'Đường dẫn hồ sơ' (tiền tố sofinhub.com/@), 'Giới thiệu' + bộ đếm. Khối 2 'Liên kết & vị trí' (phụ đề 'Hiển dưới dạng biểu tượng trên hồ sơ của bạn.') với 4 ô Website/Instagram/YouTube/Thành phố + công tắc. Cột phải thẻ xem trước + Hủy (nhỏ) / Lưu thay đổi (cam, rộng hơn tỉ lệ 1:1.4).")
    A(F, "Nạp sẵn giá trị đã lưu của tài khoản (họ, tên, handle, giới thiệu, website, instagram '@…', youtube, thành phố, công tắc)", "Chức năng", "Cao", UI,
      ["Đăng nhập tài khoản đã có đủ thông tin (xem tiền điều kiện của case API PATCH) ", "Mở /settings", "Đối chiếu với GET /api/auth/me"], "-",
      "Họ = lastName, Tên = firstName (đảo thứ tự so với tên hiển thị); Instagram hiển thị '@tên' dù DB lưu không '@'; Thành phố = location; công tắc = showOnMap. Mọi ô khớp /auth/me.")
    A(F, "Khi chưa tải xong user hiển thị vùng trống (không lỗi), sau đó form xuất hiện", "Giao diện", "Thấp", UI,
      ["Throttle mạng Slow 3G, F5 ở /settings"], "mạng chậm", "Lúc đầu <main> rỗng, không crash/ không nhảy layout lớn; sau khi /auth/me trả về form xuất hiện với dữ liệu đúng.", pw="Một phần")

    F = "Hồ sơ - Ảnh đại diện"
    A(F, "Chưa có ảnh: chip chữ cái đầu 112px nền xanh + gợi ý 'Nhiều cộng đồng yêu cầu ảnh thật khi duyệt thành viên.'; nút 'Xóa ảnh' bị vô hiệu", "Giao diện", "Trung bình", UIM,
      ["Mở /settings với tài khoản mới (chưa có ảnh)"], "-",
      "Vòng tròn hiện chữ cái đầu (Tên + Họ), gợi ý như trên, nút 'Xóa ảnh' (đỏ) disabled (opacity 40%), nút camera nhỏ góc dưới phải và nút 'Đổi ảnh đại diện'.")
    A(F, "Đổi ảnh bằng nút 'Đổi ảnh đại diện': chọn JPEG/PNG/WebP/GIF -> xem trước ngay nhưng CHƯA lưu tới khi bấm 'Lưu thay đổi'", "Chức năng", "Cao", UIM,
      ["Bấm 'Đổi ảnh đại diện', chọn ảnh PNG 500KB", "Quan sát nút, vòng tròn và thẻ xem trước", "Không bấm Lưu, F5"], "PNG 500KB",
      "Nút đổi 'Đang tải ảnh…' (disabled) trong lúc upload (POST upload purpose=avatar); xong vòng tròn và thẻ xem trước hiện ảnh, gợi ý đổi thành 'Kéo thả ảnh vào khung tròn để thay ảnh.'. Topbar vẫn ảnh cũ. F5: ảnh trở lại bản đã lưu (thay đổi chưa lưu bị bỏ). Hộp chọn file chỉ cho phép image/jpeg,png,webp,gif.")
    A(F, "Đổi ảnh bằng nút camera nhỏ ở góc dưới phải (cùng luồng upload)", "Chức năng", "Trung bình", UIM,
      ["Bấm biểu tượng camera, chọn ảnh JPEG", "Bấm 'Lưu thay đổi'"], "JPEG",
      "Giống nút chính: ảnh hiện trong form/ preview; sau Lưu toast 'Đã lưu thay đổi', topbar đổi ảnh, PATCH /auth/me gửi avatarUrl dạng /api/files/<key>.<ext>.")
    A(F, "Kéo-thả ảnh vào khung tròn: viền sáng cam khi rê vào, thả thì upload", "Chức năng", "Trung bình", UIM,
      ["Kéo file ảnh từ máy vào vòng tròn avatar (không thả)", "Thả file", "Kéo ra ngoài không thả"], "PNG",
      "Khi kéo vào: vòng sáng ring-4 màu #fdba74; kéo ra thì tắt; thả file thì upload và xem trước như nút đổi ảnh.", pw="Một phần")
    A(F, "Ảnh vượt giới hạn 3MB (UPLOAD_MAX_AVATAR_MB) bị từ chối bằng toast lỗi, avatar không đổi", "Chức năng", "Trung bình", UIM,
      ["Chọn/ thả ảnh 4MB"], "4MB",
      "Toast đỏ với message của API upload (vượt dung lượng); form giữ ảnh cũ; không có PATCH. Nút 'Đổi ảnh đại diện' trở lại bình thường.")
    A(F, "Thả file không phải ảnh (PDF/ EXE) vào khung tròn bị từ chối với thông báo của server", "Bảo mật", "Trung bình", UIM,
      ["Kéo file .pdf vào vòng tròn avatar và thả"], "tai-lieu.pdf",
      "Upload purpose=avatar chỉ nhận JPEG/PNG/WebP/GIF -> toast lỗi 'Không tải được ảnh' hoặc message API; ảnh không đổi; không lưu file lạ.")
    A(F, "'Xóa ảnh' đặt ảnh rỗng ngay trong form + toast nhắc 'nhớ bấm Lưu thay đổi'; Lưu thì avatarUrl thành null", "Chức năng", "Trung bình", UIM,
      ["Đặt ảnh và Lưu", "Bấm 'Xóa ảnh'", "Bấm Lưu thay đổi", "F5"], "-",
      "Toast 'Đã xóa ảnh đại diện · nhớ bấm Lưu thay đổi'; vòng tròn về chip chữ cái; sau Lưu avatarUrl = null (GET /auth/me không còn avatarUrl), topbar về chip; nút 'Xóa ảnh' lại bị vô hiệu.")

    F = "Hồ sơ - Họ & Tên"
    A(F, "Họ = lastName, Tên = firstName; thẻ xem trước hiển thị 'Tên Họ'", "Chức năng", "Cao", UIM,
      ["Gõ Họ = 'Nguyễn', Tên = 'An'", "Quan sát thẻ xem trước", "Lưu rồi mở GET /api/auth/me"], "Nguyễn / An",
      "Thẻ xem trước 'An Nguyễn' (theo name BE trả cho người khác); /auth/me: lastName 'Nguyễn', firstName 'An'.")
    A(F, "Tên trống: toast 'Vui lòng nhập tên' (kiểm tra Tên trước Họ), không gọi API", "Chức năng", "Cao", UIM,
      ["Xóa trắng ô Tên", "Bấm 'Lưu thay đổi'", "Mở Network"], "Tên = ''",
      "Toast lỗi 'Vui lòng nhập tên'; KHÔNG có PATCH /auth/me. Trên thẻ xem trước nếu cả hai trống hiện 'Tên của bạn'.")
    A(F, "Họ trống (Tên có giá trị): toast 'Vui lòng nhập họ'", "Chức năng", "Cao", UIM,
      ["Xóa trắng ô Họ", "Bấm 'Lưu thay đổi'"], "Họ = ''", "Toast lỗi 'Vui lòng nhập họ'; không gọi API.")
    A(F, "Họ/Tên chỉ khoảng trắng bị coi là trống; khoảng trắng đầu/cuối được cắt khi lưu", "Chức năng", "Thấp", UIM,
      ["Gõ Tên '   ' (3 dấu cách) rồi Lưu", "Gõ Tên '  Lan  ' rồi Lưu"], "'   ' và '  Lan  '", "Trường hợp 1: 'Vui lòng nhập tên'. Trường hợp 2: lưu 'Lan' (trim), ô hiển thị 'Lan'.")
    A(F, "Họ/Tên giới hạn 80 ký tự (maxLength phía FE; BE cũng max 80)", "Chức năng", "Thấp", UIM,
      ["Dán chuỗi 100 ký tự vào ô Tên"], "100 ký tự", "Ô chỉ giữ 80 ký tự; lưu thành công với 80 ký tự.")

    F = "Hồ sơ - Đường dẫn hồ sơ (handle)"
    A(F, "Ô handle tự chuẩn hóa khi gõ: chữ hoa -> thường, bỏ ký tự ngoài a-z 0-9 . _ , tối đa 24 ký tự", "Chức năng", "Cao", UIM,
      ["Gõ vào ô đường dẫn: 'Minh.An_2026 !-'", "Dán chuỗi 40 ký tự"], "Minh.An_2026 !-",
      "Hiển thị 'minh.an_2026' (bỏ dấu cách, '!', '-'), tối đa 24 ký tự; không bao giờ giữ chữ hoa. Tiền tố 'sofinhub.com/@' cố định.")
    A(F, "Handle sai định dạng báo ngay ở FE (không gọi API kiểm tra): 'ab' -> 'Tối thiểu 3 ký tự'; '.abc', 'abc.', 'a..bc' -> 'Không hợp lệ'", "Chức năng", "Trung bình", UIM,
      ["Lần lượt gõ 'ab', '.abc', 'abc.', 'a..bc' vào ô đường dẫn", "Mở Network (lọc handle-available)", "Bấm Lưu"], "ab | .abc | abc. | a..bc",
      "Biểu tượng đỏ + chữ 'Tối thiểu 3 ký tự' (cho 'ab') hoặc 'Không hợp lệ' (3 giá trị còn lại) ở cuối ô; KHÔNG có request GET /users/handle-available; bấm Lưu: toast 'Đường dẫn hồ sơ chưa hợp lệ'.")
    A(F, "Handle mới còn trống: 'Đang kiểm tra…' (debounce 400ms) rồi biểu tượng tick xanh", "Chức năng", "Cao", UIM,
      ["Gõ handle mới chưa ai dùng (vd. han_<số ngẫu nhiên>)", "Quan sát cuối ô và Network"], "han_<số>",
      "Sau khi dừng gõ ~400ms mới gọi GET /api/users/handle-available?handle=...; trong lúc chờ hiện biểu tượng sync + 'Đang kiểm tra…' (xám); kết quả available -> check_circle xanh (không kèm chữ).")
    A(F, "Debounce handle: gõ liên tục 8 ký tự chỉ phát sinh 1 request cuối", "Hiệu năng", "Thấp", UIM,
      ["Lọc Network 'handle-available'", "Gõ nhanh 8 ký tự (<400ms mỗi phím)"], "8 ký tự", "Chỉ 1 (tối đa 2) request với giá trị cuối; ký tự trung gian không gửi.", pw="Một phần")
    A(F, "Handle đã có người dùng: 'Đã có người dùng' (đỏ)", "Chức năng", "Cao", UIM + " Có sẵn người dùng khác đã đặt handle (đặt bằng API cho tài khoản B).",
      ["Gõ handle của tài khoản B (đổi chữ hoa thành thường/ngược lại)"], "taken_<số>",
      "Hiện biểu tượng lỗi + 'Đã có người dùng' (không phân biệt hoa thường); bấm Lưu: toast 'Đường dẫn hồ sơ chưa hợp lệ'.")
    A(F, "Handle giữ chỗ (admin, sofinhub, support...): 'Tên được giữ chỗ'", "Chức năng", "Trung bình", UIM,
      ["Gõ lần lượt 'admin', 'sofinhub', 'support'"], "3 handle giữ chỗ", "Mỗi handle: 'Tên được giữ chỗ' (reason reserved); không lưu được.")
    A(F, "Gõ lại đúng handle của chính mình không báo 'Đã có người dùng' và không gọi API kiểm tra", "Chức năng", "Trung bình", UIM,
      ["Đặt và lưu handle X", "Xóa ô rồi gõ lại đúng X"], "X", "Tick/không báo lỗi; changed=false nên không có request handle-available; Lưu không phát sinh thay đổi ('Không có thay đổi nào').")
    A(F, "Xóa trống ô handle là hợp lệ: Lưu = xóa đường dẫn hồ sơ; thẻ xem trước hiện 'Chưa đặt đường dẫn'", "Chức năng", "Trung bình", UIM,
      ["Đặt handle và Lưu", "Xóa sạch ô handle", "Quan sát thẻ xem trước", "Lưu"], "''", "Không báo lỗi, không kiểm tra; PATCH handle: '' -> BE lưu null; GET /auth/me không còn handle; link /users/@handle cũ 404.")
    A(F, "Bấm Lưu khi kiểm tra handle chưa xong: toast 'Đang kiểm tra đường dẫn hồ sơ, vui lòng đợi giây lát'", "Chức năng", "Thấp", UIM,
      ["Throttle mạng chậm", "Gõ handle mới rồi bấm Lưu ngay"], "mạng chậm", "Toast lỗi nêu trên, không gửi PATCH; sau khi có kết quả bấm lại thì lưu được.", pw="Một phần")
    A(F, "Lưu handle đua nhau (race): handle bị người khác chiếm ngay trước khi bấm Lưu -> toast message 409 của BE", "Chức năng", "Trung bình", UIM,
      ["Ở tab A gõ handle H (còn trống, tick xanh)", "Dùng API để tài khoản B đặt H", "Ở tab A bấm Lưu"], "H",
      "PATCH trả 409 (message về handle đã có người dùng); toast hiển thị message API; form giữ nguyên để sửa; không lưu nửa vời các trường khác.", pw="Một phần")

    F = "Hồ sơ - Giới thiệu (bio)"
    A(F, "Bộ đếm n/150 theo thời gian thực, placeholder 'Vài dòng về bạn', textarea giữ tối đa 150 ký tự", "Chức năng", "Cao", UIM,
      ["Gõ 40 ký tự", "Dán 200 ký tự"], "40 / 200 ký tự", "Bộ đếm '40/150'; sau khi dán chỉ giữ 150 ký tự, đếm '150/150'. Lưu thành công.")
    A(F, "Bio nhiều dòng: thẻ xem trước giữ ngắt dòng; bio trống hiện 'Chưa có giới thiệu.'", "Giao diện", "Thấp", UIM,
      ["Gõ bio 'Dòng 1' Enter 'Dòng 2'", "Xóa bio"], "2 dòng", "Xem trước hiển thị 2 dòng (whitespace-pre-line); xóa hết thì 'Chưa có giới thiệu.'; Lưu bio rỗng -> BE null.")
    A(F, "Bio cũ > 150 ký tự (tới 500 ký tự trước đây) vẫn hiển thị nhưng Lưu bị chặn 'Giới thiệu tối đa 150 ký tự' tới khi rút gọn", "Chức năng", "Trung bình",
      UIM + " " + SQL + " Ép bio 300 ký tự: UPDATE \"User\" SET bio = repeat('a',300) WHERE email='<email>';",
      ["F5 /settings", "Quan sát bộ đếm", "Sửa tên rồi Lưu", "Rút bio còn 150 ký tự rồi Lưu"], "bio 300 ký tự",
      "Bộ đếm '300/150'; bấm Lưu: toast 'Giới thiệu tối đa 150 ký tự', không PATCH; sau khi rút gọn <= 150 thì lưu được. (Docs: bio cũ dài hơn đọc được nhưng lần sửa sau phải rút gọn.)", pw="Một phần")
    A(F, "Bio chứa HTML/script được hiển thị như văn bản (không thực thi) ở form, thẻ xem trước và trang /users/:id", "Bảo mật", "Cao", UIM,
      ["Gõ bio '<img src=x onerror=alert(1)><script>alert(2)</script>' và Lưu", "Xem thẻ xem trước", "Mở /users/<id> bằng tài khoản khác"], "XSS",
      "Không có alert; chuỗi hiện nguyên văn dưới dạng text (đã escape) ở cả 3 nơi.")

    F = "Hồ sơ - Liên kết & vị trí"
    for lab, val, norm in [("Website", "example.com/portfolio", "https://example.com/portfolio"), ("YouTube", "youtube.com/@minhan", "https://youtube.com/@minhan")]:
        A(F, f"{lab} thiếu scheme: FE tự thêm https:// khi lưu ('{val}' -> '{norm}')", "Chức năng", "Trung bình", UIM,
          [f"Gõ '{val}' vào ô {lab}", "Bấm Lưu thay đổi", "Mở GET /api/auth/me"], val, f"PATCH gửi {norm}; /auth/me trả đúng giá trị đã chuẩn hóa; thẻ xem trước hiện biểu tượng {lab}.")
    A(F, "Website / YouTube sai định dạng -> toast lỗi tương ứng, không gọi API", "Chức năng", "Trung bình", UIM,
      ["Gõ 'khong phai url' vào ô Website, bấm Lưu", "Sửa lại Website, gõ 'ht!tp://@@' vào ô YouTube, bấm Lưu"], "khong phai url | ht!tp://@@",
      "Lần 1: toast 'Website phải là URL hợp lệ'; lần 2: toast 'Liên kết YouTube phải là URL hợp lệ'; Network không có PATCH /auth/me.")
    A(F, "Instagram: nhận '@ten_tai.khoan' hoặc 'ten_tai.khoan' (<= 30 ký tự a-z A-Z 0-9 . _), lưu không '@', hiển thị lại có '@'", "Chức năng", "Trung bình", UIM,
      ["Gõ '@minhan.gom' Lưu", "F5", "Gõ 'minhan_2' Lưu"], "@minhan.gom", "/auth/me: instagram 'minhan.gom' (không @); ô hiển thị '@minhan.gom'; giá trị không có @ cũng được chấp nhận.")
    A(F, "Instagram không hợp lệ ('ten tai khoan', 31 ký tự, '@@abc', 'ten-tai-khoan') -> toast 'Tên Instagram không hợp lệ'", "Chức năng", "Thấp", UIM,
      ["Lần lượt gõ từng giá trị vào ô Instagram và bấm Lưu"], "ten tai khoan | 'a' x 31 | @@abc | ten-tai-khoan", "Mỗi giá trị: toast lỗi 'Tên Instagram không hợp lệ' (regex ^@?[A-Za-z0-9._]{1,30}$), không gọi API.")
    A(F, "Xóa trống các ô Website/Instagram/YouTube/Thành phố rồi Lưu: BE đặt null, biểu tượng biến khỏi thẻ xem trước", "Chức năng", "Trung bình", UIM,
      ["Điền 4 ô và Lưu", "Xóa sạch 4 ô và Lưu", "F5"], "-", "PATCH gửi chuỗi rỗng cho từng ô đã đổi; /auth/me không còn website/instagram/youtube/location; thẻ xem trước không còn hàng biểu tượng.")
    A(F, "Ô Thành phố: FE cho gõ tới 300 ký tự nhưng BE giới hạn 120 -> Lưu quá 120 báo lỗi từ BE", "Chức năng", "Thấp", UIM,
      ["Gõ 150 ký tự vào ô Thành phố", "Bấm Lưu"], "150 ký tự",
      "HIỆN TẠI: ô chỉ chặn ở 300 (maxLength) nên PATCH gửi lên và BE trả 400 'Địa điểm tối đa 120 ký tự' -> toast message API. KỲ VỌNG: FE chặn ở 120 giống BE để không lộ lỗi muộn.", st=PLAN)
    A(F, "Công tắc 'Hiện vị trí của tôi trên bản đồ thành viên' (showOnMap): mặc định bật; đổi và Lưu", "Chức năng", "Cao", UIM,
      ["Quan sát công tắc của tài khoản mới", "Tắt, nhập Thành phố 'Đà Nẵng', Lưu", "Mở thẻ xem trước"], "-",
      "Mặc định BẬT (showOnMap=true). Thẻ xem trước chỉ nối ' · Đà Nẵng' sau handle khi công tắc BẬT; tắt thì không hiện thành phố. /auth/me showOnMap=false sau khi Lưu.")

    F = "Hồ sơ - Thẻ xem trước 'Người khác thấy bạn như thế này'"
    A(F, "Thẻ xem trước cập nhật tức thì theo giá trị ĐANG NHẬP (tên, @handle, bio, biểu tượng liên kết, ảnh) khi chưa lưu", "Chức năng", "Cao", UIM,
      ["Gõ Tên/Họ, handle, bio, Website, Instagram, YouTube", "Quan sát thẻ (không bấm Lưu)"], "-",
      "Tên đầy đủ 'Tên Họ'; dòng '@handle' (hoặc 'Chưa đặt đường dẫn'); bio; tối đa 3 biểu tượng (language, photo_camera màu #e1306c, smart_display) chỉ cho ô có giá trị; không cần Lưu.")
    A(F, "Số liệu thật trong thẻ: Cấp độ, điểm, số cộng đồng, 'Tham gia từ tháng M/YYYY'", "Chức năng", "Cao", UI,
      ["Đăng nhập member1@ (đã có điểm và vài cộng đồng)", "Mở /settings", "Đối chiếu với GET /api/users/<id của mình>"], "member1",
      "Ô 1 'Cấp độ' = level (levelFor tổng điểm); ô 2 hiện số điểm + nhãn 'điểm'; ô 3 số cộng đồng + 'cộng đồng' (gồm cả cộng đồng riêng tư vì là chính chủ); 'Tham gia từ tháng M/YYYY' từ createdAt. Khi chưa tải xong hiển thị '–'.")
    A(F, "Ô giữa của thẻ hiển thị ĐIỂM thay cho 'theo dõi' của mockup (chưa có tính năng theo dõi)", "Giao diện", "Thấp", UI + " " + WEIRD,
      ["Đối chiếu ô giữa của thẻ xem trước với template.html"], "-",
      "HIỆN TẠI: mockup ghi '48 theo dõi', UI hiển thị tổng điểm + nhãn 'điểm' vì codebase chưa có follow (docs/features/settings-profile-security.md 'Quyết định đã chọn'). KỲ VỌNG khi có tính năng theo dõi: đổi lại thành số người theo dõi.", st=PLAN)
    A(F, "Ảnh bìa trong thẻ xem trước là gradient cố định, không upload được ảnh bìa hồ sơ", "Giao diện", "Thấp", UI,
      ["Tìm cách đổi ảnh bìa hồ sơ ở tab Hồ sơ"], "-",
      "HIỆN TẠI: khối bìa 128px gradient #ffe2cc->#ffc7a0, không có nút đổi bìa (không có cột/ API ảnh bìa người dùng). KỲ VỌNG theo mockup: có thể đổi bìa -> cần quyết định + backend.", st=PLAN)

    F = "Hồ sơ - Lưu & Hủy"
    A(F, "Bấm 'Lưu thay đổi' khi chưa sửa gì: toast 'Không có thay đổi nào', không gọi API", "Chức năng", "Trung bình", UI,
      ["Mở /settings", "Bấm 'Lưu thay đổi' ngay"], "-", "Toast thành công 'Không có thay đổi nào'; Network không có PATCH /auth/me.")
    A(F, "Lưu thành công: toast 'Đã lưu thay đổi', nút 'Đang lưu…' trong lúc gọi, chỉ gửi các trường ĐÃ ĐỔI", "Chức năng", "Cao", UIM,
      ["Chỉ đổi Tên và Thành phố", "Bấm Lưu và xem Network"], "-",
      "Nút đổi 'Đang lưu…' (disabled); PATCH /auth/me body chỉ có {firstName, location}; toast 'Đã lưu thay đổi'; form đồng bộ lại theo dữ liệu BE trả; topbar cập nhật chữ cái đầu.")
    A(F, "Dữ liệu đã lưu còn nguyên sau F5 và đăng nhập lại ở trình duyệt khác", "Chức năng", "Cao", UIM,
      ["Sửa vài trường và Lưu", "F5", "Đăng nhập cùng tài khoản ở cửa sổ ẩn danh, mở /settings"], "-", "Mọi trường hiển thị đúng giá trị mới ở cả hai phiên (dữ liệu nằm ở server, không phải localStorage).")
    A(F, "'Hủy' khôi phục bản đã lưu: toast 'Đã hủy các thay đổi'; nếu chưa sửa gì thì 'Không có thay đổi nào'", "Chức năng", "Trung bình", UIM,
      ["Sửa Tên, Bio, đổi ảnh (chưa Lưu)", "Bấm Hủy", "Bấm Hủy lần nữa"], "-", "Lần 1: toast 'Đã hủy các thay đổi', mọi ô và ảnh về giá trị đã lưu, thẻ xem trước theo. Lần 2: 'Không có thay đổi nào'.")
    A(F, "Lỗi từ BE khi lưu hiển thị message tiếng Việt của API; lỗi mạng hiển thị 'Không lưu được, vui lòng thử lại'", "Chức năng", "Trung bình", UIM,
      ["Tắt backend (hoặc offline trong DevTools) rồi bấm Lưu"], "offline", "Toast 'Không lưu được, vui lòng thử lại'; form giữ nguyên dữ liệu đang nhập để bấm lại.", pw="Một phần")
    A(F, "Rời tab Hồ sơ khi còn thay đổi chưa lưu: không có cảnh báo, thay đổi bị mất", "Chức năng", "Thấp", UIM,
      ["Sửa Tên (không Lưu)", "Bấm sang tab Thông báo rồi quay lại"], "-",
      "HIỆN TẠI: không hỏi xác nhận; khi quay lại form đã nạp lại bản đã lưu (state của ProfileTab bị hủy). Ghi nhận để PO quyết định có cần cảnh báo 'thay đổi chưa lưu'.", st=PLAN)

    # ------------------------------------------------------------------ 3. API HỒ SƠ
    F = "API - PATCH /auth/me & GET /auth/me (hồ sơ mở rộng)"
    A(F, "PATCH /auth/me không token -> 401", "Bảo mật", "Cao", API, ["PATCH /api/auth/me body {\"bio\":\"x\"} không header Authorization"], "-", "401 (UNAUTHORIZED).", pw="Không")
    A(F, "GET /auth/me của người dùng mới có mặc định đúng và KHÔNG lộ totpSecret", "Chức năng", "Cao", API,
      ["Đăng ký người dùng mới", "GET /api/auth/me với token"], "-",
      "data gồm handle/instagram/youtube vắng mặt; showOnMap=true, language='vi', timezone='Asia/Ho_Chi_Minh', theme='light', twoFactorEnabled=false, passwordChangedAt (chưa đổi), pendingEmail vắng. KHÔNG có khóa totpSecret.", pw="Không")
    A(F, "Đặt handle chữ hoa 'Minh.An_<số>' -> lưu chữ thường; instagram '@minhan.gom' -> 'minhan.gom'; youtube, showOnMap=false, bio", "Chức năng", "Cao", APIM,
      ["PATCH /api/auth/me {handle:'Minh.An_<số>', instagram:'@minhan.gom', youtube:'https://youtube.com/@minhan', showOnMap:false, bio:'Thiết kế đồ họa'}", "GET /api/auth/me"], "-",
      "200; data.handle là chữ thường, instagram 'minhan.gom', youtube nguyên URL, showOnMap=false; GET /auth/me trả cùng giá trị.", pw="Không")
    A(F, "Đặt lại đúng handle hiện tại của mình -> 200 (không 409)", "Chức năng", "Trung bình", APIM, ["PATCH handle=H (200)", "PATCH handle=H lần nữa"], "H", "Cả hai lần 200.", pw="Không")
    A(F, "Xóa handle/instagram/youtube bằng chuỗi rỗng '' -> trường biến mất khỏi response", "Chức năng", "Trung bình", APIM,
      ["Đặt handle, instagram", "PATCH {handle:'', instagram:'', youtube:''}"], "''", "200; data.handle và data.instagram là undefined (null phía DB); handle cũ được giải phóng cho người khác.", pw="Không")
    A(F, "PATCH handle sai định dạng (8 giá trị: 'ab', 25 ký tự, 'có dấu', 'a b c', '.abc', 'abc.', 'a..bc', 'ab-cd') -> 400", "Chức năng", "Trung bình", APIM,
      ["Với từng giá trị: PATCH /api/auth/me {handle:<giá trị>}"], "ab | 'a' x 25 | có dấu | a b c | .abc | abc. | a..bc | ab-cd",
      "Cả 8 lần 400 VALIDATION_ERROR 'Đường dẫn hồ sơ gồm 3-24 ký tự a-z, 0-9, dấu chấm hoặc gạch dưới'; handle không đổi.", pw="Không")
    A(F, "PATCH handle đã có người dùng (đổi chữ hoa/thường) -> 409", "Chức năng", "Cao", APIM,
      ["Tài khoản A đặt handle H", "Tài khoản B PATCH handle H.toUpperCase()"], "H", "409 với thông điệp tiếng Việt rõ (handle đã có người dùng); handle của A không đổi.", pw="Không")
    A(F, "PATCH handle giữ chỗ ('admin', 'SofinHub', 'support') -> 409", "Chức năng", "Trung bình", APIM,
      ["Với từng giá trị: PATCH /api/auth/me {handle:<giá trị>}"], "admin | SofinHub | support", "Cả 3 lần 409 (đường dẫn thuộc danh sách giữ chỗ auth/handle.ts, không phân biệt hoa thường).", pw="Không")
    A(F, "Hai người cùng đặt một handle đồng thời -> đúng một người 200, người kia 409 (bắt P2002)", "Tích hợp", "Trung bình", APIM,
      ["Tạo 2 người dùng", "Gửi 2 PATCH handle=H cùng lúc (Promise.all)"], "H", "Một 200 và một 409; DB chỉ một User có handle H (unique); không có 500.", pw="Không")
    A(F, "PATCH bio: 150 ký tự -> 200; 151 ký tự -> 400 'Giới thiệu tối đa 150 ký tự' (trước đây giới hạn 500)", "Chức năng", "Trung bình", APIM,
      ["PATCH {bio: 'a' x 150}", "PATCH {bio: 'a' x 151}"], "150 / 151 ký tự", "Lần 1: 200, bio lưu đủ; lần 2: 400 với message nêu trên.", pw="Không")
    A(F, "PATCH bio '' hoặc null -> xóa bio", "Chức năng", "Thấp", APIM, ["PATCH {bio:''}", "PATCH {bio:null}"], "-", "200 cả hai, bio vắng mặt.", pw="Không")
    A(F, "PATCH instagram sai (khoảng trắng, 31 ký tự) / youtube & website không phải http(s) (ftp://, javascript:, 'not a url') -> 400", "Bảo mật", "Trung bình", APIM,
      ["PATCH {instagram:'ten tai khoan'} và {instagram:'a' x 31}", "PATCH {youtube:'ftp://x.com/a'}, {youtube:'javascript:alert(1)'}", "PATCH {website:'not a url'}, {website:'javascript:alert(1)'}"], "6 giá trị",
      "Cả 6 lần 400 với message tiếng Việt ('Tên Instagram không hợp lệ' / 'Liên kết YouTube phải là URL http/https hợp lệ' / 'Website phải là URL http/https hợp lệ'); không lưu scheme nguy hiểm.", pw="Không")
    A(F, "PATCH showOnMap kiểu sai ('yes') -> 400; firstName/lastName rỗng -> 400 'Vui lòng nhập tên/họ'", "Chức năng", "Thấp", APIM,
      ["PATCH {showOnMap:'yes'}", "PATCH {firstName:''}", "PATCH {lastName:''}"], "-", "Cả ba 400.", pw="Không")
    A(F, "PATCH location > 120 ký tự -> 400 'Địa điểm tối đa 120 ký tự'", "Chức năng", "Thấp", APIM, ["PATCH {location: 'a' x 121}"], "121 ký tự", "400; 120 ký tự thì 200.", pw="Không")
    A(F, "PATCH avatarUrl: chấp nhận /api/files/<key>.<ext>, /files/..., http(s)://...; từ chối 'javascript:' và đường dẫn có '..'", "Bảo mật", "Trung bình", APIM,
      ["PATCH {avatarUrl:'/api/files/<key>.png'}", "PATCH {avatarUrl:'javascript:alert(1)'}", "PATCH {avatarUrl:'/files/../etc/passwd'}", "PATCH {avatarUrl:''}"], "-",
      "Lần 1 200; lần 2 và 3 400 'Ảnh đại diện phải là URL http/https hoặc đường dẫn /files/...'; lần 4 200 xóa ảnh (null).", pw="Không")
    A(F, "Mass-assignment: PATCH kèm email / role / emailVerified / totpSecret bị bỏ qua (schema không strict nên không báo 400)", "Bảo mật", "Cao", APIM,
      ["PATCH /api/auth/me {firstName:'Test', email:'hack@x.co', emailVerified:true, role:'admin', twoFactorEnabled:true, totpSecret:'AAAA'}", "GET /api/auth/me"], "-",
      "200; chỉ firstName đổi; email, emailVerified, 2FA, quyền KHÔNG đổi; không lộ totpSecret.", pw="Không")

    F = "API - GET /users/handle-available"
    A(F, "Không token -> 401; thiếu tham số handle -> 400", "Chức năng", "Trung bình", API, ["GET /api/users/handle-available?handle=abc không token", "GET ... không có handle (có token)"], "-", "401; 400.", pw="Không")
    A(F, "handle-available: handle mới / handle của chính mình / '@handle' -> {available:true}", "Chức năng", "Trung bình", API,
      ["GET ...?handle=han_<số ngẫu nhiên>", "Đặt handle H cho mình rồi GET ...?handle=H", "GET ...?handle=@han_<số>"], "-", "200 data = {available:true} cả 3 lần (bỏ '@' đầu; handle của chính mình coi là còn dùng được).", pw="Không")
    A(F, "handle-available: handle người khác (viết HOA) -> taken; 'admin' -> reserved; 'ab' -> invalid", "Chức năng", "Trung bình", API,
      ["GET ...?handle=<HANDLE NGƯỜI KHÁC VIẾT HOA>", "GET ...?handle=admin", "GET ...?handle=ab"], "-", "200: {available:false, reason:'taken'}; {available:false, reason:'reserved'}; {available:false, reason:'invalid'}.", pw="Không")
    F = "API - GET /users/:idOrHandle (hồ sơ công khai)"
    A(F, "Tra theo handle (có hoặc không '@') và theo id: có handle, instagram, youtube, communityCount, level", "Chức năng", "Cao", APIM,
      ["Người dùng T đặt handle H, instagram, youtube; tham gia cộng đồng photo và nhận 25 điểm", "GET /api/users/@H, /api/users/H, /api/users/<id> bằng token của V"], "25 điểm",
      "Cả 3 cách đều 200 cùng nội dung; level = 2 (ngưỡng 20 điểm), communityCount = 1; instagram không '@'.", pw="Không")
    A(F, "showOnMap=false: người khác thấy location=null, chính chủ vẫn thấy", "Bảo mật", "Cao", APIM,
      ["T đặt location='Đà Nẵng', showOnMap=false", "GET /api/users/<T> bằng token của V", "GET /api/users/<T> bằng token của T"], "-", "V: location null; T: 'Đà Nẵng'.", pw="Không")
    A(F, "communityCount của chính chủ gồm cả cộng đồng riêng tư; người khác xem không tính cộng đồng riêng tư", "Bảo mật", "Trung bình", APIM,
      ["T là thành viên của 1 cộng đồng công khai + 1 cộng đồng riêng tư", "GET /api/users/<T> bằng token T rồi bằng token V"], "-", "T thấy 2; V thấy 1 (không lộ việc T ở cộng đồng riêng tư).", pw="Không")
    A(F, "Không token -> 401; handle/ id không tồn tại -> 404", "Chức năng", "Trung bình", API, ["GET /api/users/@khong_co_ai_dung (có token)", "GET /api/users/<id> không token"], "-", "404; 401.", pw="Không")
    A(F, "Trang công khai /users/@handle trên FE hiển thị đúng thông tin vừa lưu ở Cài đặt", "Tích hợp", "Trung bình", UIM,
      ["Ở Cài đặt đặt handle, bio, liên kết, vị trí và Lưu", "Mở /users/<id> bằng tài khoản khác"], "-", "Trang hiển thị tên, bio, liên kết (biểu tượng), cấp độ; vị trí chỉ hiện nếu bật showOnMap.", pw="Một phần")


# ====================================================================================================================
#                                  MODULE SETS - Tài khoản & bảo mật
# ====================================================================================================================
def load_sets(add):
    A = _mk(add, "SETS", "Cài đặt - Tài khoản & bảo mật")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + " (mở /settings/bao-mat)."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó, mở /settings/bao-mat."
    UIM = UINEW + " " + MUTATE
    UI2FA = UIM + " " + TOTP

    # ------------------------------------------------------------------ EMAIL
    F = "Email - Hiển thị & xác minh"
    A(F, "Khối 'Đăng nhập': tiêu đề, dòng Email + nhãn xác minh + nút 'Đổi email', dòng Mật khẩu, dòng Xác minh 2 bước (đối chiếu mockup)", "Giao diện", "Cao", UI + " " + WEIRD,
      ["Mở /settings/bao-mat", "So sánh khối bên trái phía trên với template.html"], "-",
      "Thẻ 'Đăng nhập' (phụ đề 'Quản lý thông tin đăng nhập và bảo mật tài khoản.') có 3 dòng: Email (biểu tượng mail), Mật khẩu (lock), Xác minh 2 bước (shield, mô tả 'Thêm một lớp bảo mật để bảo vệ tài khoản của bạn khỏi truy cập trái phép.'). Cột trái còn 'Thiết bị đang đăng nhập'; cột phải 'Ngôn ngữ & khu vực', 'Giao diện', 'Xóa tài khoản' (>= 1180px hai cột 1.15fr/1fr; nhỏ hơn 1 cột).")
    A(F, "Email đã xác minh: nhãn xanh 'Đã xác minh', không có dòng nhắc gửi lại", "Giao diện", "Trung bình", UI,
      ["Tài khoản member1@ (đã xác minh)", "Quan sát dòng Email"], "member1@sofinhub.test", "Hiện email (break-all) + nhãn 'Đã xác minh' xanh; KHÔNG có dòng 'Email chưa xác minh.' hay link gửi.")
    A(F, "Email chưa xác minh: nhãn vàng 'Chưa xác minh' + 'Email chưa xác minh.' + link 'Gửi email xác minh'", "Giao diện", "Cao", UIM + " Đăng ký mới nhưng KHÔNG bấm link xác minh.",
      ["Mở /settings/bao-mat"], "-", "Nhãn amber 'Chưa xác minh'; bên dưới 'Email chưa xác minh.' + nút chữ gạch chân 'Gửi email xác minh'.")
    A(F, "Gửi email xác minh: toast 'Đã gửi email xác minh tới <email>', nút đếm ngược 'Gửi lại sau 60s' và bị vô hiệu", "Chức năng", "Cao", UIM + " " + MAIL,
      ["Bấm 'Gửi email xác minh'", "Quan sát nút trong 60 giây", "Mở outbox dev"], "-",
      "Toast thành công như trên; nút 'Đang gửi…' rồi 'Gửi lại sau 60s' giảm từng giây (disabled); outbox có 1 thư chứa link /verify-email?token=. Hết 60s nút trở lại 'Gửi email xác minh'.")
    A(F, "Bấm gửi lại khi còn cooldown phía server (F5 trong 60s): 429 -> toast 'Bạn vừa yêu cầu gửi email, vui lòng đợi rồi thử lại' và bắt đầu đếm 60s", "Chức năng", "Trung bình", UIM,
      ["Gửi email xác minh", "F5 trang trong vòng 60 giây", "Bấm 'Gửi email xác minh' lần nữa"], "-", "BE trả 429 'Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email xác thực'; FE hiển thị toast ở mô tả và đặt cooldown 60s.")
    A(F, "Gửi xác minh nhưng email đã được xác minh ở tab khác (409): nhãn tự chuyển thành 'Đã xác minh', không báo lỗi", "Chức năng", "Thấp", UIM + " " + MAIL,
      ["Tab A mở /settings/bao-mat (chưa xác minh)", "Tab B bấm link trong email để xác minh", "Tab A bấm 'Gửi email xác minh'"], "-", "BE 409 'Email đã được xác thực' -> FE cập nhật emailVerified=true: nhãn xanh, dòng nhắc biến mất, không toast lỗi.", pw="Một phần")
    A(F, "Bấm link xác minh trong thư (/verify-email?token=): email thành 'Đã xác minh' và token chỉ dùng được 1 lần", "Chức năng", "Cao", UIM + " " + MAIL,
      ["Gửi email xác minh, mở link trong outbox", "Quay lại /settings/bao-mat", "Mở lại cùng link lần 2"], "-",
      "Lần 1: trang xác minh báo thành công, Cài đặt hiện 'Đã xác minh'. Lần 2: báo token không hợp lệ/đã dùng (400).", pw="Một phần")

    F = "Email - Đổi email (modal)"
    A(F, "Mở modal 'Đổi email': tiêu đề, mô tả, 2 ô, CTA 'Gửi xác minh', đóng bằng Hủy / Esc / bấm nền", "Giao diện", "Trung bình", UI,
      ["Bấm 'Đổi email'", "Đọc modal", "Đóng bằng nút Hủy, rồi mở lại và bấm Esc, rồi mở lại và bấm nền tối"], "-",
      "Biểu tượng mail, tiêu đề 'Đổi email', mô tả 'Chúng tôi sẽ gửi link xác minh tới email mới.', ô 'Email mới' (placeholder ten@email.com), ô 'Mật khẩu hiện tại' (••••••••), CTA 'Gửi xác minh'. Cả 3 cách đều đóng modal (không đóng khi đang gửi).")
    A(F, "Đổi email: lỗi client trong modal - email trống 'Email chưa hợp lệ', sai định dạng 'Email không hợp lệ', mật khẩu trống 'Nhập mật khẩu hiện tại' (không gọi API)", "Chức năng", "Trung bình", UIM,
      ["Mở 'Đổi email'", "Để trống email + mật khẩu đúng, bấm 'Gửi xác minh'", "Nhập 'khong-phai-email', bấm lại", "Nhập 'moi@example.com' + mật khẩu trống, bấm lại"], "'' | khong-phai-email | mật khẩu trống",
      "Lần lượt dòng lỗi đỏ 'Email chưa hợp lệ' / 'Email không hợp lệ' / 'Nhập mật khẩu hiện tại' ngay trong modal, Network không có POST /auth/change-email. Gõ lại thì lỗi biến mất.")
    A(F, "Đổi email với mật khẩu hiện tại SAI -> lỗi message BE trong modal (400, không đăng xuất)", "Chức năng", "Cao", UIM,
      ["Nhập email mới hợp lệ, mật khẩu 'Sai1!xxxx'", "Bấm 'Gửi xác minh'"], "Sai1!xxxx", "400 với message tiếng Việt (mật khẩu không đúng) hiển thị trong modal; phiên không bị đăng xuất; không có thư gửi đi.")
    A(F, "Đổi email trùng email hiện tại -> 400; trùng email người khác (kể cả viết HOA) -> 409, lỗi hiển thị trong modal", "Chức năng", "Cao", UIM,
      ["Nhập lại chính email hiện tại + mật khẩu đúng", "Nhập 'MEMBER1@SOFINHUB.TEST' + mật khẩu đúng"], "-", "Lần 1: 400. Lần 2: 409 (không phân biệt hoa thường). Message BE hiển thị trong modal, modal không đóng.")
    A(F, "Đổi email thành công: toast 'Đã gửi link xác minh tới <email mới> · kiểm tra hộp thư', email hiện tại CHƯA đổi, dòng Email hiện 'Đang chờ xác nhận <email mới>'", "Chức năng", "Cao", UIM + " " + MAIL,
      ["Nhập email mới 'moi-<số>@test.local' + mật khẩu đúng", "Bấm 'Gửi xác minh'", "Quan sát dòng Email", "Mở outbox của email CŨ và email MỚI"], "moi-<số>@test.local",
      "Modal đóng + toast; dòng Email vẫn là email cũ; bên dưới 'Đang chờ xác nhận moi-<số>@test.local — kiểm tra hộp thư của email mới.' + link 'Gửi lại email xác nhận'. Thư chứa link /verify-email?token= chỉ có ở hộp thư email MỚI; email cũ KHÔNG nhận thư.")
    A(F, "Bấm link trong thư tới email mới: hoán đổi email, emailVerified=true, đăng nhập được bằng email mới, email cũ không còn đăng nhập được, phiên hiện tại giữ nguyên", "Chức năng", "Cao", UIM + " " + MAIL,
      ["Thực hiện đổi email (case trước)", "Mở link trong outbox email mới", "Quay lại /settings/bao-mat", "Đăng xuất rồi đăng nhập bằng email cũ, rồi bằng email mới"], "-",
      "Email trên Cài đặt là email mới + 'Đã xác minh', dòng 'Đang chờ' biến mất; đăng nhập bằng email cũ báo sai thông tin (401), bằng email mới thành công. Đổi email KHÔNG thu hồi phiên nào (docs).", pw="Một phần")
    A(F, "'Gửi lại email xác nhận' khi đang chờ đổi email: thư mới gửi tới email MỚI (kể cả khi email cũ đã xác minh), có cooldown 60s", "Chức năng", "Trung bình", UIM + " " + MAIL,
      ["Đổi email sang địa chỉ mới", "Chờ 60 giây rồi bấm 'Gửi lại email xác nhận'", "Bấm lần nữa ngay"], "-", "Lần 1: toast 'Đã gửi email xác minh tới <email mới>', outbox email mới có thêm thư; lần 2: 429, toast 'Bạn vừa yêu cầu gửi email, vui lòng đợi rồi thử lại', nút đếm 'Gửi lại sau 60s'.", pw="Một phần")
    A(F, "Nhập lại 'Đổi email' với địa chỉ khác khi đang chờ: ghi đè email chờ (chưa có nút hủy email chờ)", "Chức năng", "Thấp", UIM + " " + MAIL,
      ["Đổi email sang A", "Đổi email lần nữa sang B"], "A rồi B", "Dòng chờ hiện B. HIỆN TẠI chưa có nút 'Hủy email chờ xác nhận' (docs/features/settings-profile-security.md 'Chưa làm'); KỲ VỌNG: có nút hủy và link của A không còn hiệu lực.", st=PLAN)

    F = "Mật khẩu (modal)"
    A(F, "Phụ đề dòng Mật khẩu: 'Chưa đổi mật khẩu kể từ khi tạo tài khoản' rồi 'Đã cập nhật vừa xong / N phút trước' sau khi đổi", "Giao diện", "Trung bình", UIM,
      ["Mở /settings/bao-mat với tài khoản mới (chưa đổi mật khẩu)", "Đổi mật khẩu", "Quan sát phụ đề"], "-", "Trước: 'Chưa đổi mật khẩu kể từ khi tạo tài khoản'. Sau: 'Đã cập nhật vừa xong'; sau vài phút 'N phút trước' (phút/giờ/ngày/tháng/năm).")
    A(F, "Modal 'Đổi mật khẩu': 3 ô, mô tả quy tắc, CTA 'Cập nhật'", "Giao diện", "Trung bình", UI, ["Bấm 'Đổi mật khẩu'"], "-",
      "Tiêu đề 'Đổi mật khẩu', mô tả 'Tối thiểu 8 ký tự, gồm ít nhất 1 chữ in hoa và 1 ký tự đặc biệt.', ô 'Mật khẩu hiện tại', 'Mật khẩu mới', 'Nhập lại mật khẩu mới' (type=password), CTA 'Cập nhật'.")
    A(F, "Đổi mật khẩu: lỗi client theo thứ tự (mật khẩu hiện tại trống -> <8 ký tự -> thiếu chữ hoa -> thiếu ký tự đặc biệt -> nhập lại không khớp)", "Chức năng", "Trung bình", UIM,
      ["Mở modal; để trống 'Mật khẩu hiện tại'", "Nhập hiện tại đúng; mới 'Ab1!' ", "Mới 'matkhau1!'", "Mới 'Matkhau12'", "Mới 'Moi1!abcd' và nhập lại 'Moi1!abcX'"], "5 trường hợp",
      "Lỗi đỏ lần lượt: 'Nhập mật khẩu hiện tại' / 'Mật khẩu cần ít nhất 8 ký tự' / 'Mật khẩu cần ít nhất 1 chữ in hoa' / 'Mật khẩu cần ít nhất 1 ký tự đặc biệt' / 'Mật khẩu nhập lại không khớp'; không gọi API.")
    A(F, "Đổi mật khẩu với mật khẩu hiện tại sai -> 400 'Mật khẩu hiện tại không đúng' (KHÔNG tự đăng xuất)", "Chức năng", "Cao", UIM,
      ["Nhập mật khẩu hiện tại sai", "Bấm 'Cập nhật'"], "Sai1!xxxx", "Lỗi hiển thị trong modal; phiên còn nguyên (BE trả 400 chứ không phải 401).")
    A(F, "Đổi mật khẩu mới trùng mật khẩu hiện tại -> 400 'Mật khẩu mới không được trùng mật khẩu hiện tại'", "Chức năng", "Trung bình", UIM,
      ["Nhập mật khẩu mới = mật khẩu hiện tại (đạt quy tắc)", "Bấm 'Cập nhật'"], PW, "Lỗi trong modal như trên.")
    A(F, "Đổi mật khẩu thành công: toast 'Đã đổi mật khẩu', phụ đề cập nhật, các thiết bị KHÁC bị đăng xuất, thiết bị hiện tại giữ phiên", "Chức năng", "Cao", UIM,
      ["Đăng nhập cùng tài khoản ở cửa sổ ẩn danh (thiết bị 2)", "Ở thiết bị 1 đổi mật khẩu sang 'Moi1!abcd'", "Quan sát danh sách thiết bị ở thiết bị 1 và thao tác ở thiết bị 2"], "Moi1!abcd",
      "Thiết bị 1: toast 'Đã đổi mật khẩu', vẫn đăng nhập, danh sách thiết bị chỉ còn 1 (đã refetch). Thiết bị 2: request kế tiếp 401 (access token bị thu hồi). Đăng nhập lại bằng mật khẩu mới thành công, mật khẩu cũ 401.")

    F = "Xác minh 2 bước - giao diện"
    A(F, "Dòng 2FA khi tắt: nhãn vàng 'Đang tắt' + nút 'Bật ngay'; khi bật: nhãn xanh 'Đang bật' + nút 'Quản lý'", "Giao diện", "Trung bình", UI, ["Quan sát dòng Xác minh 2 bước ở tài khoản chưa bật", "Bật 2FA rồi quan sát lại"], "-", "Chưa bật: badge amber 'Đang tắt' (icon error) + 'Bật ngay'. Đã bật: badge xanh 'Đang bật' (check_circle) + 'Quản lý'.")
    A(F, "Modal bật 2FA: tự gọi setup khi mở, hiện QR 176px (alt 'Mã QR xác minh 2 bước') + khóa nhập tay nhóm 4 ký tự", "Chức năng", "Cao", UI2FA,
      ["Bấm 'Bật ngay'", "Quan sát modal và Network"], "-",
      "Tiêu đề 'Bật xác minh 2 bước', mô tả 'Quét mã QR bằng Google Authenticator rồi nhập mã 6 số.'; đúng 1 POST /auth/2fa/setup (kể cả React StrictMode); trong lúc chờ hiện khung xám nhấp nháy, CTA 'Bật xác minh' bị vô hiệu tới khi có secret; sau đó QR + dòng 'Không quét được? Nhập khóa này vào ứng dụng:' và khóa dạng 'ABCD EFGH …' (8 nhóm 4 ký tự), chọn-tất-cả được.", pw="Một phần")
    A(F, "Quét QR bằng ứng dụng TOTP: tài khoản hiển thị 'SofinHub: <email>' và mã đổi mỗi 30 giây", "Chức năng", "Cao", UI2FA, ["Quét QR bằng Google Authenticator", "Quan sát mục vừa thêm"], "-", "Mục tên 'SofinHub' + email; mã 6 số đổi mỗi 30s; nhập tay khóa base32 cho mã giống hệt.", pw="Không")
    for code, msg in [("123", "Nhập đủ 6 số"), ("000000", "mã sai (message BE: Mã xác minh không đúng...)")]:
        A(F, f"Bật 2FA với mã '{code}' -> {msg}", "Chức năng", "Trung bình", UI2FA, ["Bấm 'Bật ngay', chờ có QR", f"Nhập '{code}' vào ô mã", "Bấm 'Bật xác minh'"], code,
          ("Lỗi 'Nhập đủ 6 số', không gọi API." if code == "123" else "400 từ BE, lỗi đỏ trong modal ('Mã xác minh không đúng' hoặc message BE); 2FA vẫn tắt."), pw="Một phần")
    A(F, "Ô mã chỉ nhận chữ số và tối đa 6 ký tự (dán 'ab12 34 56' -> '123456'); autocomplete one-time-code", "Chức năng", "Thấp", UI2FA, ["Dán 'ab12 34 56' vào ô mã"], "ab12 34 56", "Ô giữ '123456' (loại ký tự không phải số, cắt 6). Bàn phím số trên mobile (inputMode numeric).")
    A(F, "Bật 2FA thành công với mã đúng: toast 'Đã bật xác minh 2 bước', dòng chuyển 'Đang bật' + 'Quản lý'", "Chức năng", "Cao", UI2FA, ["Mở modal bật, quét QR", "Nhập mã 6 số hiện tại", "Bấm 'Bật xác minh'"], "-", "Modal đóng, toast thành công, GET /auth/me twoFactorEnabled=true, không có secret trong response.", pw="Không")
    A(F, "Đóng modal bật 2FA giữa chừng (Hủy/Esc): 2FA vẫn TẮT; mở lại tạo secret MỚI (ghi đè bản dở)", "Chức năng", "Trung bình", UI2FA, ["Mở modal bật, ghi lại khóa K1", "Đóng modal", "Mở lại, ghi lại khóa K2"], "K1/K2", "K1 != K2; badge vẫn 'Đang tắt'; mã sinh từ K1 không bật được 2FA (400).", pw="Một phần")
    A(F, "Modal tắt 2FA: 'Tắt xác minh 2 bước?' + 'Tài khoản sẽ chỉ được bảo vệ bằng mật khẩu.' + ô 'Mã 6 số từ ứng dụng xác thực' + CTA đỏ 'Tắt xác minh'", "Giao diện", "Trung bình", UI2FA, ["Với tài khoản đã bật 2FA bấm 'Quản lý'"], "-", "Modal nguy hiểm (nút đỏ), KHÔNG gọi setup, không hiện QR/khóa.", pw="Một phần")
    A(F, "Tắt 2FA bằng mã đúng: toast 'Đã tắt xác minh 2 bước'; đăng nhập lại chỉ còn 1 bước", "Chức năng", "Cao", UI2FA,
      ["Bật 2FA", "Chờ sang bước 30 giây kế tiếp (mã bật đã dùng)", "Bấm 'Quản lý', nhập mã mới, 'Tắt xác minh'", "Đăng xuất rồi đăng nhập"], "-", "Toast 'Đã tắt xác minh 2 bước', badge 'Đang tắt'; đăng nhập trả thẳng phiên, không yêu cầu mã.", pw="Không")
    A(F, "Tắt 2FA ngay sau khi bật bằng cùng mã của bước 30s hiện tại bị từ chối (chống replay) - phải đợi mã kế tiếp", "Chức năng", "Trung bình", UI2FA,
      ["Bật 2FA với mã M1", "Ngay lập tức mở 'Quản lý' và nhập lại M1"], "M1", "400 báo mã không đúng (mã bước đó đã dùng); sau khi chuyển sang bước 30s kế tiếp, mã mới thì tắt được. Ghi nhận là hành vi chủ ý (mỗi (user, bước) dùng 1 lần) nhưng dễ gây khó hiểu cho người dùng vừa bật.", pw="Không")
    A(F, "?2fa=1 (từ thẻ quảng bá 'Bảo vệ tài khoản'): tự mở modal bật 2FA rồi xóa ?2fa khỏi URL; nếu đang bật chỉ toast 'Xác minh 2 bước đang bật'", "Chức năng", "Trung bình", UIM,
      ["Mở /settings/bao-mat?2fa=1", "Bật 2FA rồi mở lại URL trên"], "?2fa=1", "Lần 1: modal bật hiện, URL còn /settings/bao-mat (replace). Lần 2 (đã bật): không mở modal, toast 'Xác minh 2 bước đang bật'.", pw="Một phần")
    A(F, "Đăng nhập tài khoản đã bật 2FA: sau mật khẩu hiện bước nhập mã 'Mã 6 số' + nút 'Xác minh'", "Chức năng", "Cao", UI2FA,
      ["Bật 2FA rồi đăng xuất", "Đăng nhập email + mật khẩu", "Quan sát màn hình", "Nhập mã của bước KẾ TIẾP (mã bước hiện tại đã dùng khi bật)"], "-",
      "Sau bước 1 hiện 'Nhập mã 6 số từ ứng dụng xác thực (Google Authenticator, Authy...) để hoàn tất đăng nhập.' + ô 'Mã 6 số' + nút 'Xác minh' ('Đang xác minh…' khi gửi). Mã đúng -> vào trang chủ, đã đăng nhập. KHÔNG có cookie/ phiên trước bước 2.", pw="Không")
    A(F, "Màn nhập mã đăng nhập: mã thiếu số -> 'Nhập đủ mã 6 số'; mã sai -> lỗi BE; vé hết hạn (>5 phút) -> quay lại form đăng nhập", "Chức năng", "Trung bình", UI2FA,
      ["Ở bước 2 nhập '123' rồi Xác minh", "Nhập '000000'", "Chờ > 5 phút rồi nhập mã đúng"], "-",
      "Lần 1: 'Nhập đủ mã 6 số'. Lần 2: message BE (401). Lần 3: 401 'hết hạn, vui lòng đăng nhập lại' -> FE quay về form email/mật khẩu (ticket=null).", pw="Không")

    F = "Thiết bị đăng nhập"
    A(F, "Danh sách thiết bị: thiết bị này lên đầu với nhãn xanh 'Thiết bị này', còn lại mới hoạt động trước; tên '<Trình duyệt> • <HĐH>'", "Chức năng", "Cao", UIM,
      ["Đăng nhập cùng tài khoản bằng Chrome, rồi Firefox/ cửa sổ khác", "Mở /settings/bao-mat ở phiên Chrome"], "-",
      "Mỗi thẻ: biểu tượng (laptop_mac/desktop_windows/smartphone/tablet_mac/computer/devices), tên 'Chrome • Windows', dòng ✓ '<IP> • Đang dùng' hoặc '<IP> • N phút trước', dòng meta 'Chrome 123.0 • Windows 10'. Phiên hiện tại đầu tiên + nhãn 'Thiết bị này' (xanh); phiên khác có nút 'Đăng xuất'.", pw="Một phần")
    A(F, "Thiết bị không nhận diện được UA: 'Thiết bị không xác định' + 'Không có thông tin trình duyệt'; 'nơi' hiển thị là IP (chưa có geo-IP)", "Giao diện", "Thấp", UIM,
      ["Dùng curl/Postman đăng nhập với User-Agent 'TestAgent/3'", "Mở danh sách thiết bị"], "TestAgent/3", "Thẻ 'Thiết bị không xác định' (biểu tượng devices), meta 'Không có thông tin trình duyệt', dòng nơi là địa chỉ IP, không có thành phố/quốc gia.", pw="Một phần")
    A(F, "Đăng xuất một thiết bị khác: toast 'Đã đăng xuất <tên thiết bị>', thẻ biến mất, phiên đó bị 401 ở request kế tiếp", "Chức năng", "Cao", UIM,
      ["Tạo 2 phiên (Chrome + cửa sổ ẩn danh)", "Ở phiên 1 bấm 'Đăng xuất' ở thẻ phiên 2", "Ở phiên 2 thao tác bất kỳ"], "-", "Toast thành công; danh sách còn 1; phiên 2 nhận 401 và bị đưa về đăng nhập.")
    A(F, "Nút 'Đăng xuất mọi thiết bị' chỉ hiện khi có thiết bị khác; bấm: toast 'Đã đăng xuất mọi thiết bị khác' và GIỮ thiết bị này", "Chức năng", "Cao", UIM,
      ["Khi chỉ có 1 thiết bị: kiểm tra nút", "Tạo thêm 2 phiên, bấm 'Đăng xuất mọi thiết bị'"], "-", "Một thiết bị: không có nút. Nhiều thiết bị: sau khi bấm danh sách còn đúng 1 ('Thiết bị này'); phiên hiện tại vẫn dùng được (khác POST /auth/logout-all vốn thu hồi tất cả kể cả hiện tại).")
    A(F, "Trạng thái tải/ lỗi danh sách thiết bị: 'Đang tải danh sách thiết bị…' và 'Không tải được danh sách thiết bị.' + nút 'Thử lại'", "Giao diện", "Thấp", UI, ["Throttle mạng, F5", "Chặn request GET /auth/sessions (DevTools block) rồi F5", "Bấm 'Thử lại' sau khi bỏ chặn"], "-", "Hiện 'Đang tải…' rồi lỗi + 'Thử lại'; bấm Thử lại gọi lại và hiển thị danh sách.", pw="Một phần")

    F = "Ngôn ngữ, múi giờ, giao diện"
    A(F, "Chọn ngôn ngữ 'English'/'Tiếng Việt' tự lưu: toast 'Đã lưu ngôn ngữ'", "Chức năng", "Trung bình", UIM, ["Đổi ô 'Ngôn ngữ' sang English", "F5"], "English", "Toast 'Đã lưu ngôn ngữ'; sau F5 ô vẫn English (user.language='en'). KHÔNG cần nút Lưu.")
    A(F, "Ngôn ngữ/giao diện CHỈ được lưu: chọn 'English' hoặc 'Tối' chưa đổi gì trên giao diện (chưa có i18n, chưa có dark mode)", "Chức năng", "Trung bình", UIM,
      ["Chọn English", "Chọn giao diện 'Tối'", "Duyệt các trang"], "en / dark", "HIỆN TẠI toàn bộ UI vẫn tiếng Việt, nền sáng. KỲ VỌNG theo ý nghĩa nhãn: đổi ngôn ngữ và dark mode có hiệu lực (docs 'Chưa làm').", st=PLAN)
    A(F, "Chọn múi giờ (5 mục theo thiết kế) tự lưu: toast 'Đã lưu múi giờ'; múi giờ lạ đã lưu qua API hiển thị thêm một <option> riêng", "Chức năng", "Trung bình", UIM,
      ["Chọn '(UTC+08:00) Singapore'", "F5", "Đặt qua API timezone='Europe/Paris' rồi F5"], "Asia/Singapore, Europe/Paris",
      "Danh sách đúng 5 mục: (UTC+07:00) Hà Nội, TP. Hồ Chí Minh; (UTC+08:00) Singapore; (UTC+09:00) Seoul, Tokyo; (UTC+00:00) London; (UTC-08:00) Los Angeles. Lưu thành công; với 'Europe/Paris' ô hiện thêm lựa chọn 'Europe/Paris' (tzKnown=false).")
    A(F, "Chọn giao diện Sáng / Tối / Theo hệ thống (radiogroup): thẻ được chọn viền cam, toast 'Đã lưu giao diện'", "Chức năng", "Trung bình", UIM, ["Bấm lần lượt 3 thẻ giao diện", "F5"], "light/dark/system", "aria-checked đúng thẻ; viền 2px cam + nền #fff7f1; mặc định 'Sáng'; giữ sau F5.")
    A(F, "Múi giờ chưa được dùng để định dạng giờ ở nơi khác (chỉ ảnh hưởng 'Giờ im lặng')", "Chức năng", "Thấp", UIM,
      ["Đổi múi giờ sang Los Angeles", "Xem giờ hiển thị ở thông báo/ sự kiện/ lịch sử thanh toán"], "-", "HIỆN TẠI giờ ngày hiển thị vẫn theo trình duyệt/ locale vi-VN, không theo múi giờ đã lưu. KỲ VỌNG: áp dụng ở mọi nơi hiển thị thời gian.", st=PLAN)

    F = "Xóa tài khoản (giao diện)"
    A(F, "Thẻ đỏ 'Xóa tài khoản': mô tả mặc định + nút 'Xóa tài khoản vĩnh viễn'", "Giao diện", "Trung bình", UIM,
      ["Mở /settings/bao-mat với tài khoản mới (không chủ cộng đồng, không gói)"], "-", "Nền #fff5f5, viền đỏ; mô tả 'Hồ sơ của bạn sẽ bị xóa vĩnh viễn và không thể khôi phục. Bài viết và bình luận cũ được giữ lại dưới tên “Thành viên đã xóa”.'")
    A(F, "Tài khoản là chủ cộng đồng và/hoặc còn gói thành viên đang hoạt động: thẻ đỏ liệt kê điều kiện chặn thật", "Chức năng", "Cao", UI + " Đăng nhập owner@sofinhub.test (là chủ nhiều cộng đồng).",
      ["Mở /settings/bao-mat bằng owner@", "Đọc mô tả thẻ đỏ", "Đăng nhập member1@ (có gói) và đọc lại"], "owner@ / member1@",
      "owner@: 'Bạn đang là quản trị của N cộng đồng (tên1, tên2, …). Hãy chuyển quyền quản trị trước khi xóa.' (1 cộng đồng: 'là quản trị của cộng đồng <tên>'). Tài khoản có gói đang chạy: 'có K gói thành viên đang hoạt động ... hủy các gói'. Cả hai: nối 'và' + 'chuyển quyền quản trị và hủy các gói'. Gói đã đặt hủy cuối kỳ KHÔNG tính.")
    A(F, "Modal xóa khi đang bị chặn: hiện lý do màu đỏ và nút 'Xóa tài khoản' bị vô hiệu", "Chức năng", "Cao", UI + " Đăng nhập owner@sofinhub.test.", ["Bấm 'Xóa tài khoản vĩnh viễn'", "Thử gõ XÓA + mật khẩu"], "-", "Tiêu đề 'Xóa tài khoản vĩnh viễn?'; thân modal có câu chặn in đậm đỏ; CTA disabled nên không xóa được dù nhập đủ.")
    A(F, "Modal xóa: gõ đúng chữ 'XÓA' (hoa, có dấu) + mật khẩu; sai chữ -> 'Gõ đúng chữ XÓA để xác nhận'; thiếu mật khẩu -> 'Nhập mật khẩu để xác nhận'", "Chức năng", "Cao", UIM,
      ["Mở modal xóa", "Gõ 'xoa' + mật khẩu", "Gõ 'XÓA' + mật khẩu trống", "Gõ 'XÓA' + mật khẩu sai"], "xoa / XÓA", "Lần 1: 'Gõ đúng chữ XÓA để xác nhận'. Lần 2: 'Nhập mật khẩu để xác nhận'. Lần 3: BE 400 (mật khẩu sai) hiển thị trong modal; tài khoản còn nguyên.")
    A(F, "Xóa tài khoản thành công: đăng xuất, về '/', không đăng nhập lại được, handle được giải phóng", "Chức năng", "Cao", UIM,
      ["Đặt handle H cho tài khoản", "Gõ XÓA + mật khẩu đúng, bấm 'Xóa tài khoản'", "Thử đăng nhập lại", "Đặt handle H cho tài khoản khác"], "H", "Modal xóa -> logout -> URL '/'; đăng nhập lại 401; handle H dùng được cho tài khoản khác; bài/bình luận cũ hiển thị 'Thành viên đã xóa'.")

def load_sets_more(add):
    A = _mk(add, "SETS", "Cài đặt - Tài khoản & bảo mật")
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE
    API2 = APIM + " " + MAIL
    API2FA = APIM + " Mã TOTP tính từ secret trả về ở /auth/2fa/setup: " + TOTP

    # ------------------------------------------------------------------ API EMAIL
    F = "API - Đổi email / xác minh email"
    A(F, "POST /auth/change-email không token -> 401", "Bảo mật", "Cao", API, ["POST /api/auth/change-email {newEmail:'a@b.co',password:'x'} không header"], "-", "401.", pw="Không")
    A(F, "POST /auth/change-email sai mật khẩu / trùng email hiện tại / email sai định dạng / thiếu password -> 400", "Chức năng", "Trung bình", APIM,
      ["POST {newEmail:'n-<số>@test.local', password:'Sai1!xxxx'}", "POST {newEmail:<email hiện tại>, password:<đúng>}", "POST {newEmail:'khong-phai-email', password:<đúng>}", "POST {newEmail:'n-<số>@test.local'} (thiếu password)"], "4 trường hợp",
      "Cả 4 lần 400 (VALIDATION_ERROR/ thông điệp tiếng Việt); không tạo pendingEmail, không gửi thư.", pw="Không")
    A(F, "POST /auth/change-email trùng email người khác (viết HOA) -> 409", "Chức năng", "Cao", APIM, ["POST /api/auth/change-email {newEmail: other.email.toUpperCase(), password}"], "-", "409; /auth/me.pendingEmail vắng.", pw="Không")
    A(F, "POST /auth/change-email hợp lệ -> 202 {pendingEmail}; email chuẩn hóa chữ thường; /auth/me thêm pendingEmail nhưng email CHƯA đổi", "Chức năng", "Cao", API2,
      ["POST /api/auth/change-email {newEmail:'MOI-<số>@TEST.LOCAL', password}", "GET /api/auth/me", "GET /api/dev/outbox?to=<email cũ>", "GET /api/dev/outbox?to=<email mới>"], "-",
      "202 data.pendingEmail = 'moi-<số>@test.local'; /auth/me: email cũ + pendingEmail; hộp thư email CŨ không có thư verify-email; hộp thư email MỚI có link {FRONTEND_URL}/verify-email?token=.", pw="Không")
    A(F, "POST /auth/change-email lặp trong < 60s -> 429 (cooldown); quá 5 lần / 15 phút theo IP -> 429", "Bảo mật", "Trung bình", APIM,
      ["Gọi change-email hợp lệ 2 lần liên tiếp", "Gọi 6 lần (sai mật khẩu cũng tính) trong 15 phút"], "-", "Lần 2: 429 (cooldown 60s); lần thứ 6 trong 15 phút: 429 theo limiter IP 5/15 phút. Không có thư thừa.", pw="Không")
    A(F, "POST /auth/verify-email với token từ change-email: hoán đổi email + emailVerified=true; token dùng lần 2 -> 400; email cũ đăng nhập 401, email mới 200; phiên hiện tại còn sống", "Chức năng", "Cao", API2,
      ["Đổi email, lấy token từ outbox email mới", "POST /api/auth/verify-email {token}", "POST lại cùng token", "POST /api/auth/login bằng email cũ rồi email mới", "GET /api/auth/me bằng token cũ"], "-",
      "Lần 1: 200 AuthUser (email mới, emailVerified=true, pendingEmail vắng). Lần 2: 400. Đăng nhập email cũ 401, email mới 200. /auth/me bằng access token cũ vẫn 200 (đổi email không thu hồi phiên).", pw="Không")
    A(F, "POST /auth/verify-email khi email mới đã bị người khác chiếm trước -> 409", "Tích hợp", "Trung bình", API2,
      ["A yêu cầu đổi sang X", "B đăng ký bằng email X", "A mở link xác nhận"], "X", "409; email của A không đổi; pendingEmail còn (cần đổi sang địa chỉ khác).", pw="Không")
    A(F, "POST /auth/send-verification: 401 khi không token; 409 khi email đã xác minh và không có pendingEmail; có pendingEmail -> 202 gửi tới email MỚI", "Chức năng", "Trung bình", API2,
      ["Không token", "Tài khoản đã xác minh, không chờ đổi", "Tài khoản đã xác minh đang chờ đổi email (sau 60s)"], "-", "401; 409 'Email đã được xác thực'; 202 và thư tới email mới (không phải email cũ).", pw="Không")
    A(F, "Token verify-email hết hạn sau 24 giờ -> 400", "Chức năng", "Thấp", API2 + " " + SQL, ["Đổi email lấy token", "UPDATE \"OneTimeToken\" SET \"expiresAt\" = now() - interval '1 minute' WHERE purpose='verify-email' AND \"userId\"='<id>';", "POST /auth/verify-email {token}"], "-", "400 token hết hạn; email chưa đổi.", pw="Không")

    # ------------------------------------------------------------------ API 2FA
    F = "API - Xác minh 2 bước (TOTP)"
    A(F, "POST /auth/2fa/setup, /auth/2fa/enable, /auth/2fa/disable không token -> 401", "Bảo mật", "Cao", API, ["Gọi 3 endpoint không header Authorization (enable/disable body {code:'123456'})"], "-", "401 cả ba.", pw="Không")
    A(F, "POST /auth/2fa/setup: trả {secret base32 32 ký tự, otpauthUrl otpauth://totp/SofinHub:<email>?secret=...}, CHƯA bật, /auth/me không lộ secret", "Chức năng", "Cao", API2FA,
      ["POST /api/auth/2fa/setup", "GET /api/auth/me"], "-", "200; secret khớp /^[A-Z2-7]{32}$/; otpauthUrl bắt đầu 'otpauth://totp/SofinHub:' và chứa secret; /auth/me.twoFactorEnabled=false và JSON không chứa chuỗi secret.", pw="Không")
    A(F, "POST /auth/2fa/enable: chưa setup -> 400; mã sai '000000' -> 400; mã sai định dạng '12ab' -> 400; mã đúng -> 200 twoFactorEnabled=true", "Chức năng", "Cao", API2FA,
      ["enable khi chưa setup", "setup rồi enable '000000' và '12ab'", "enable bằng mã TOTP đúng"], "-", "400, 400, 400, rồi 200 (AuthUser twoFactorEnabled=true, response KHÔNG chứa secret).", pw="Không")
    A(F, "Khi 2FA đã bật: setup lại -> 409; enable lại -> 409", "Chức năng", "Trung bình", API2FA, ["Bật 2FA", "POST /auth/2fa/setup", "POST /auth/2fa/enable"], "-", "Cả hai 409 (không đổi secret đang dùng).", pw="Không")
    A(F, "POST /auth/2fa/disable: khi đang tắt -> 409; mã sai -> 400; có gửi password sai -> 400; mã đúng -> 200 và xóa secret; setup lại cho secret MỚI", "Chức năng", "Cao", API2FA,
      ["disable khi chưa bật", "Bật 2FA; disable '000000'", "disable {code đúng bước trước, password:'Sai1!xxxx'}", "disable {code đúng bước trước}", "setup lại"], "-",
      "409; 400; 400; 200 twoFactorEnabled=false; setup mới trả secret khác secret cũ. (password là tùy chọn - mặc định chỉ cần mã 6 số theo thiết kế.)", pw="Không")
    A(F, "TOTP chấp nhận lệch ±1 bước 30s; lệch ±2 bước (>= 60s) bị từ chối", "Chức năng", "Trung bình", API2FA, ["Tính mã tại thời điểm now-30s và now+30s", "Tính mã tại now-90s"], "-", "Mã bước trước/ sau liền kề được chấp nhận khi enable (mỗi mã dùng 1 lần); mã cách 2+ bước 400.", pw="Không")
    A(F, "Chống replay: một mã (user, bước 30s) chỉ dùng được một lần (enable, login/2fa, disable đều dùng chung)", "Bảo mật", "Cao", API2FA,
      ["Bật 2FA bằng mã M", "Dùng lại M ở /auth/login/2fa và /auth/2fa/disable"], "M", "Cả hai bị từ chối (401 ở login/2fa, 400 ở disable); dùng mã bước kế tiếp thì được.", pw="Không")
    A(F, "Giới hạn thử mã: > 8 lần sai / 5 phút / user -> 429 (enable, disable, login/2fa chung bộ đếm)", "Bảo mật", "Cao", API2FA,
      ["Setup rồi gọi enable với '000000' liên tiếp 10 lần"], "10 lần", "Các lần đầu 400, lần thứ 9 trở đi 429; lần thứ 10 chắc chắn 429. Sau 5 phút hoặc đổi người dùng thì hết bị chặn.", pw="Không")
    A(F, "Đăng nhập khi bật 2FA: POST /auth/login -> 200 {twoFactorRequired:true, ticket}, KHÔNG có accessToken và KHÔNG Set-Cookie refresh", "Chức năng", "Cao", API2FA,
      ["Bật 2FA", "POST /api/auth/login {email,password}"], "-", "200 data = {twoFactorRequired:true, ticket}; không accessToken; header Set-Cookie rỗng. Sai mật khẩu vẫn 401 như cũ (không lộ trạng thái 2FA).", pw="Không")
    A(F, "POST /auth/login/2fa: mã đúng -> 200 như login (user + accessToken + cookie refresh_token); thiếu code -> 400; mã sai / vé giả / access token dùng làm vé -> 401", "Chức năng", "Cao", API2FA,
      ["Lấy ticket từ login", "login/2fa {ticket, code:'000000'}", "{ticket:'rac', code đúng}", "{ticket: accessToken, code đúng}", "{ticket} (thiếu code)", "{ticket, code đúng bước kế tiếp}"], "-",
      "401, 401, 401, 400, rồi 200 (user.twoFactorEnabled=true, accessToken dùng được, cookie refresh_token=...). Dùng lại đúng mã đó lần nữa: 401.", pw="Không")
    A(F, "Vé 2FA là JWT 5 phút typ '2fa': hết hạn -> 401; không dùng được làm access token ở API khác", "Bảo mật", "Cao", API2FA,
      ["Dùng ticket làm Bearer gọi GET /api/auth/me", "Chờ > 5 phút rồi login/2fa với mã đúng"], "-", "Lần 1: 401 (thiếu sid/tv nên bị authenticateAccessToken từ chối). Lần 2: 401 'hết hạn, vui lòng đăng nhập lại'.", pw="Không")
    A(F, "Secret TOTP không bao giờ xuất hiện ngoài /auth/2fa/setup (kể cả /auth/me, login, enable, user công khai, log)", "Bảo mật", "Cao", API2FA,
      ["Setup, enable", "Tìm chuỗi secret trong response của /auth/me, /auth/login, /auth/login/2fa, /users/<id>, /auth/sessions"], "-", "Không response nào chứa secret hay khóa totpSecret.", pw="Không")
    A(F, "Unit: TOTP khớp vector RFC 6238 (SHA1, 6 số) và base32 round-trip; parseUserAgent nhận đúng desktop/mobile/tablet, Edge không nhầm Chrome", "Chức năng", "Trung bình",
      BASE + " Chạy trong backend: npm test -- tests/account-settings.test.ts", ["cd backend", "npm test -- tests/account-settings.test.ts (hoặc node --test tests/account-settings.test.ts theo script)"], "RFC 6238", "Các test 'unit: TOTP' và 'parseUserAgent' PASS.", pw="Không")

    # ------------------------------------------------------------------ API SESSIONS / PREFS / DELETE
    F = "API - Phiên đăng nhập & tùy chọn"
    A(F, "GET /auth/sessions kèm device {browser, browserVersion?, os, osVersion?, kind}: Chrome/macOS/desktop khi UA Chrome 123 trên Mac", "Chức năng", "Trung bình", APIM,
      ["Đăng nhập 3 lần với UA khác nhau (1 UA Chrome/Mac, 1 'TestAgent/3')", "GET /api/auth/sessions bằng token phiên Chrome"], "-", "3 phiên; phiên current có device.browser 'Chrome', os 'macOS', kind 'desktop'; UA lạ có kind 'unknown'.", pw="Không")
    A(F, "POST /auth/sessions/revoke-others: 401 không token; 204 và giữ phiên hiện tại, các token khác 401, danh sách còn 1", "Chức năng", "Cao", APIM,
      ["Tạo 3 phiên t1,t2,t3", "revoke-others bằng t2", "GET /auth/me với t1, t2, t3", "GET /auth/sessions"], "-", "204; t2 200; t1 và t3 401; sessions có 1 phần tử current=true.", pw="Không")
    A(F, "DELETE /auth/sessions/:id của người khác (IDOR) -> 404 và phiên đó vẫn sống", "Bảo mật", "Cao", APIM,
      ["A lấy id phiên của mình", "B gọi DELETE /api/auth/sessions/<id của A>", "A GET /auth/me"], "-", "404 'Không tìm thấy phiên đăng nhập'; token của A vẫn 200.", pw="Không")
    A(F, "DELETE /auth/sessions/:id không tồn tại -> 404; xóa phiên của chính mình (hiện tại) -> 204 và token đó 401", "Chức năng", "Thấp", APIM, ["DELETE sessions/khong-co", "DELETE sessions/<sid hiện tại>"], "-", "404; 204 rồi request kế tiếp 401.", pw="Không")
    F = "API - PATCH /auth/me/preferences"
    A(F, "PATCH /auth/me/preferences không token -> 401; body rỗng {} -> 400", "Chức năng", "Trung bình", API, ["Không token", "Có token, body {}"], "-", "401; 400 (cần ít nhất 1 trường).", pw="Không")
    A(F, "PATCH preferences giá trị sai ({language:'fr'}, {timezone:'Khong/Hop_Le'}, {theme:'blue'}, {language:'vi', theme:5}) -> 400", "Chức năng", "Trung bình", APIM,
      ["Gửi lần lượt 4 body trên"], "4 body", "Cả 4 lần 400 VALIDATION_ERROR; giá trị cũ không đổi.", pw="Không")
    A(F, "PATCH preferences hợp lệ lưu cả 3: language 'en', timezone 'America/Los_Angeles' (mọi mã IANA hợp lệ), theme 'dark'; trả AuthUser", "Chức năng", "Trung bình", APIM,
      ["PATCH {language:'en', timezone:'America/Los_Angeles', theme:'dark'}", "GET /auth/me"], "-", "200 AuthUser với 3 giá trị mới; GET /auth/me giống; cập nhật từng phần (chỉ theme) không đụng 2 giá trị còn lại.", pw="Không")
    F = "API - Xóa tài khoản"
    A(F, "GET /auth/me/delete-blockers: 401; người mới -> {ownedCommunities:[], activeSubscriptions:0}", "Chức năng", "Trung bình", API, ["Không token", "Người dùng mới"], "-", "401; 200 {ownedCommunities:[], activeSubscriptions:0}.", pw="Không")
    A(F, "delete-blockers liệt kê cộng đồng sở hữu {id,title} và gói active; KHÔNG tính gói đã đặt hủy cuối kỳ", "Chức năng", "Cao", APIM + " " + SQL,
      ["Cho người dùng làm owner của 1 cộng đồng (POST /communities)", "Cho 2 gói active: 1 bình thường, 1 cancelAtPeriodEnd=true", "GET /auth/me/delete-blockers"], "-", "ownedCommunities 1 phần tử {id,title}; activeSubscriptions = 1.", pw="Không")
    A(F, "DELETE /auth/me: sai mật khẩu -> 400 (kiểm tra TRƯỚC điều kiện chặn); còn điều kiện chặn -> 409 ACCOUNT_DELETE_BLOCKED + details", "Chức năng", "Cao", APIM,
      ["Người dùng là owner + có 1 gói active", "DELETE /api/auth/me {password sai}", "DELETE /api/auth/me {password đúng}"], "-",
      "400 (không lộ điều kiện chặn); 409 error.code='ACCOUNT_DELETE_BLOCKED', error.details = {ownedCommunities:[{id,title}], activeSubscriptions:1}; tài khoản còn (GET /auth/me 200).", pw="Không")
    A(F, "DELETE /auth/me thành công (204) sau khi hủy gói + chuyển quyền chủ; token cũ 401; ẩn danh hóa xóa handle/instagram/youtube/secret 2FA/email chờ", "Chức năng", "Cao", API2FA + " " + SQL,
      ["Người dùng đặt handle, instagram, bật 2FA", "DELETE /auth/me {password}", "SELECT handle,instagram,\"totpSecret\",\"twoFactorEnabled\" FROM \"User\" WHERE id='<id>'", "Tài khoản khác đặt cùng handle"], "-",
      "204; hàng User có handle=NULL, instagram=NULL, totpSecret=NULL, twoFactorEnabled=false; handle được người khác đặt được (200).", pw="Không")
    A(F, "Tài khoản bị chặn xóa vì là owner: sau khi chuyển quyền owner / xóa vai trò thì xóa được", "Chức năng", "Trung bình", APIM, ["Owner bị 409", "Chuyển quyền owner cho người khác", "DELETE /auth/me lại"], "-", "409 rồi 204.", pw="Không")

    # ------------------------------------------------------------------ BẢO MẬT / HỒI QUY / GAPS
    F = "Bảo mật & hồi quy"
    A(F, "Các thao tác nhạy cảm (đổi email, đổi mật khẩu, bật/tắt 2FA, xóa tài khoản) đều yêu cầu đăng nhập; token của người khác không thao tác được trên tài khoản mình", "Bảo mật", "Cao", APIM,
      ["Dùng token của B gọi lần lượt các endpoint trên cho tài khoản của B và quan sát dữ liệu của A"], "-", "Mọi thao tác chỉ tác động tới chủ token; không có tham số userId nào cho phép thao tác thay người khác.", pw="Không")
    A(F, "Quên mật khẩu / đặt lại mật khẩu vẫn hoạt động và ghi passwordChangedAt; phụ đề 'Đã cập nhật …' phản ánh", "Chức năng", "Trung bình", APIM + " " + MAIL,
      ["POST /auth/forgot-password", "Dùng link đặt lại", "Đăng nhập, mở /settings/bao-mat"], "-", "Phụ đề dòng Mật khẩu = 'Đã cập nhật vừa xong'; token reset dùng 1 lần.", pw="Một phần")
    A(F, "Hồi quy trang cũ: đăng xuất tất cả (POST /auth/logout-all) vẫn thu hồi CẢ phiên hiện tại; 'Đăng xuất mọi thiết bị' trên UI dùng revoke-others", "Chức năng", "Trung bình", APIM,
      ["Tạo 2 phiên", "POST /auth/logout-all bằng phiên 1", "GET /auth/me phiên 1 và 2"], "-", "Cả hai 401 (logout-all giữ nguyên hành vi cũ); khác với nút UI giữ lại thiết bị này.", pw="Không")
    A(F, "Chưa có mã khôi phục 2FA: mất thiết bị xác thực thì không đăng nhập được, phải liên hệ quản trị", "Chức năng", "Cao", BASE + " Tài khoản đã bật 2FA, mất ứng dụng xác thực.",
      ["Đăng nhập email + mật khẩu", "Ở bước nhập mã tìm tùy chọn 'dùng mã khôi phục'"], "-", "HIỆN TẠI: không có mã khôi phục, không có luồng 'mất thiết bị'; chỉ tắt được bằng mã TOTP hoặc admin can thiệp DB. KỲ VỌNG (ngoài phạm vi, docs 'Chưa làm'): mã khôi phục dùng 1 lần hoặc luồng xác minh qua email.", st=PLAN, pw="Không")
    A(F, "Secret TOTP lưu thô (không mã hóa at-rest) trong User.totpSecret", "Bảo mật", "Trung bình", BASE + " " + SQL,
      ["Bật 2FA cho 1 tài khoản", "SELECT \"totpSecret\" FROM \"User\" WHERE id='<id>'"], "-", "HIỆN TẠI: chuỗi base32 đọc được trực tiếp (theo yêu cầu thiết kế, docs 'Quyết định thiết kế'); rủi ro nếu lộ DB. KỲ VỌNG: mã hóa at-rest (cần khóa môi trường) trước khi production.", st=PLAN, pw="Không")
    A(F, "Tắt 2FA chỉ cần mã 6 số (không bắt mật khẩu) - ai chiếm được phiên đang mở và có mã thì tắt được", "Bảo mật", "Thấp", BASE + " " + NEWU,
      ["Bật 2FA", "POST /auth/2fa/disable {code đúng} không có password"], "-", "HIỆN TẠI 200 (đúng thiết kế; password chỉ kiểm khi được gửi). Ghi nhận để PO quyết định có bắt buộc nhập lại mật khẩu khi tắt 2FA.", st=PLAN, pw="Không")
    A(F, "Địa điểm thiết bị chỉ là IP, tên thiết bị suy từ User-Agent (không thể có 'iPhone 14 Pro' như mockup)", "Giao diện", "Thấp", BASE + " " + WEIRD,
      ["So sánh thẻ thiết bị với mockup"], "-", "HIỆN TẠI: 'Chrome • Windows' + IP. Mockup có ví dụ tên máy và thành phố. KỲ VỌNG: nếu muốn đúng mockup cần geo-IP và tên thiết bị do client gửi.", st=PLAN, pw="Không")
    A(F, "Đổi email không thu hồi phiên và không báo cho email cũ", "Bảo mật", "Thấp", BASE + " " + NEWU + " " + MAIL,
      ["Đổi email và xác nhận", "Kiểm tra hộp thư email cũ và các phiên khác"], "-", "HIỆN TẠI: không thư thông báo tới email cũ, phiên khác còn sống. Ghi nhận rủi ro chiếm tài khoản (kẻ có phiên + mật khẩu có thể đổi email âm thầm).", st=PLAN, pw="Không")

# ====================================================================================================================
#                                  MODULE SETN - Thông báo
# ====================================================================================================================
def load_setn(add):
    A = _mk(add, "SETN", "Cài đặt - Thông báo")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + " (mở /settings/thong-bao)."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó, tham gia cộng đồng 'photo' (nút Tham gia) rồi mở /settings/thong-bao."
    UIM = UINEW + " " + MUTATE

    F = "Bố cục & trạng thái tải"
    A(F, "Tab Thông báo đối chiếu mockup: tiêu đề 'Cài đặt', mô tả, thẻ 'Email tổng hợp' + 'Giờ im lặng', thẻ 'Tin nhắn & người theo dõi', bảng 'Theo từng cộng đồng', Hủy / Lưu thay đổi", "Giao diện", "Cao", UI + " " + WEIRD,
      ["Mở /settings/thong-bao", "So sánh với template.html"], "-",
      "H1 'Cài đặt' (mô tả 'Tùy chỉnh cách bạn nhận thông báo và quản lý hoạt động trong cộng đồng.'); 2 thẻ cạnh nhau (auto-fit min 340px, xếp dọc khi hẹp): 'Email tổng hợp' ('Gom mọi hoạt động thành một email thay vì nhiều email lẻ.') chứa luôn khối 'Giờ im lặng' ('Không gửi thông báo trong khoảng thời gian này.'); 'Tin nhắn & người theo dõi' ('Áp dụng cho mọi cộng đồng.'); thẻ rộng 'Theo từng cộng đồng' ('Tắt những gì bạn không cần ở từng nơi.') có nút 'Đặt lại mặc định'; hai nút cuối trang 'Hủy' và 'Lưu thay đổi' (mũi tên).")
    A(F, "Trạng thái đang tải 'Đang tải cài đặt thông báo…' và lỗi tải (role=alert) khi API lỗi", "Giao diện", "Thấp", UI, ["Throttle mạng rồi F5", "Chặn GET /notifications/preferences rồi F5"], "-", "Thẻ 'Đang tải cài đặt thông báo…' rồi form; khi lỗi hiện message API hoặc 'Không tải được cài đặt, vui lòng thử lại.' màu đỏ.", pw="Một phần")
    A(F, "Giá trị mặc định của tài khoản mới: Email 'Tắt', Giờ im lặng tắt, 3 công tắc tin nhắn BẬT, mọi ô cộng đồng BẬT; nút Hủy/Lưu mờ", "Chức năng", "Cao", UIM,
      ["Mở /settings/thong-bao với tài khoản mới"], "-", "Tab 'Tắt' của Email tổng hợp được chọn (aria-selected); công tắc Giờ im lặng tắt (chưa hiện ô giờ); 'Cho phép nhắn tin riêng', 'Email khi có tin nhắn chưa đọc', 'Báo khi người tôi theo dõi đăng bài' đều bật; ô cộng đồng 'photo' đều bật; Hủy và Lưu disabled (opacity 50%).")

    F = "Email tổng hợp"
    A(F, "4 lựa chọn đúng thứ tự: Ngay lập tức | Mỗi ngày | Mỗi tuần | Tắt; chọn một lựa chọn làm nút Lưu sáng lên", "Chức năng", "Cao", UIM, ["Bấm lần lượt từng lựa chọn", "Quan sát Hủy/Lưu"], "-", "role=tablist 4 tab; tab được chọn nền trắng viền cam #fdba74, chữ cam; đổi so với giá trị đã lưu thì Hủy/Lưu hết mờ; đổi về giá trị cũ thì mờ lại.")
    A(F, "Chọn 'Mỗi ngày' / 'Mỗi tuần': hiện ghi chú 'Lựa chọn này được lưu; email tổng hợp định kỳ chưa được gửi tự động…'", "Giao diện", "Trung bình", UIM, ["Chọn 'Mỗi ngày'", "Chọn 'Mỗi tuần'", "Chọn 'Ngay lập tức'"], "-", "Hai lựa chọn đầu hiện dòng ghi chú xám 12.5px: 'Lựa chọn này được lưu; email tổng hợp định kỳ chưa được gửi tự động. Chọn “Ngay lập tức” để nhận email mỗi khi có thông báo.'; 'Ngay lập tức'/'Tắt' không có ghi chú.")
    A(F, "Lưu thành công: toast 'Đã lưu cài đặt thông báo', nút 'Đang lưu…', giá trị giữ sau F5", "Chức năng", "Cao", UIM, ["Chọn 'Ngay lập tức'", "Bấm 'Lưu thay đổi'", "F5"], "instant", "Toast thành công; sau F5 tab 'Ngay lập tức' vẫn được chọn; PUT /notifications/preferences body chứa emailDigest='instant'.")
    A(F, "'Hủy' hoàn lại giá trị đã lưu (mọi phần của form) và làm nút mờ lại", "Chức năng", "Trung bình", UIM, ["Đổi digest, bật giờ im lặng, tắt một công tắc, tắt một ô cộng đồng", "Bấm 'Hủy'"], "-", "Tất cả quay về giá trị đã lưu; Hủy/Lưu disabled; không có request PUT.")
    A(F, "Lỗi khi lưu (API 400/ mạng): toast message BE hoặc 'Không lưu được, vui lòng thử lại.', form giữ nguyên giá trị đang sửa", "Chức năng", "Trung bình", UIM, ["Bật giờ im lặng và đặt Từ = Đến (vd. 08:00 - 08:00)", "Bấm Lưu"], "08:00-08:00", "BE 400 -> toast message lỗi; form không bị reset; Lưu vẫn sáng để sửa lại.", pw="Một phần")

    F = "Giờ im lặng (giao diện)"
    A(F, "Công tắc 'Giờ im lặng': bật hiện 2 ô giờ 'Từ giờ'/'Đến giờ' mặc định 22:00 - 07:00; tắt thì ẩn ô giờ nhưng vẫn nhớ giờ cũ", "Chức năng", "Cao", UIM, ["Bật công tắc", "Đổi giờ thành 23:00 - 06:30 rồi tắt công tắc, Lưu", "F5 và bật lại"], "22:00-07:00", "Lần bật đầu: 22:00 – 07:00. Sau khi tắt và Lưu, PUT quiet.enabled=false vẫn giữ from/to (23:00/06:30); bật lại hiện 23:00 – 06:30.")
    A(F, "Khoảng qua nửa đêm (22:00 -> 07:00) được chấp nhận khi Lưu (from > to hợp lệ)", "Chức năng", "Cao", UIM, ["Bật giờ im lặng, đặt 22:00 - 07:00", "Lưu"], "22:00-07:00", "Lưu thành công, không báo 'giờ bắt đầu phải nhỏ hơn giờ kết thúc'.")
    A(F, "Từ = Đến khi bật giờ im lặng: Lưu báo lỗi 400 (toast)", "Chức năng", "Trung bình", UIM, ["Bật giờ im lặng, đặt 08:00 - 08:00", "Lưu"], "08:00-08:00", "Toast lỗi từ BE (from == to khi bật bị từ chối); dữ liệu cũ không bị đổi.")
    A(F, "Ô giờ dùng định dạng 24 giờ HH:mm (input type=time); xóa trống ô giờ rồi Lưu bị từ chối", "Chức năng", "Thấp", UIM, ["Xóa ô 'Từ giờ' bằng bàn phím", "Lưu"], "''", "Lưu bị chặn bởi BE (giờ sai định dạng -> 400) và toast lỗi; hoặc trình duyệt giữ giá trị cũ. Không ghi dữ liệu sai.", pw="Một phần")

    F = "Tin nhắn & người theo dõi (giao diện)"
    A(F, "3 công tắc 'Tin nhắn & người theo dõi' (Cho phép nhắn tin riêng / Email khi có tin nhắn chưa đọc / Báo khi người tôi theo dõi đăng bài): đúng nhãn + phụ đề, tắt -> Lưu -> F5 vẫn tắt", "Chức năng", "Cao", UIM,
      ["Tắt lần lượt từng công tắc, bấm Lưu và F5 sau mỗi lần"], "dmAllowed | emailUnreadDm | notifyFollowedPosts",
      "Phụ đề: 'Tất cả thành viên có thể nhắn tin cho bạn.' / 'Nhận email khi có tin nhắn mới.' / 'Nhận thông báo khi có người bạn theo dõi đăng bài.'; sau Lưu và F5 công tắc vẫn tắt (GET /notifications/preferences trả false đúng khóa); aria-label của công tắc = tiêu đề dòng.")
    F = "Theo từng cộng đồng (giao diện)"
    A(F, "Bảng liệt kê đúng cộng đồng đã tham gia (không gồm bị cấm / đã rời / nháp) với logo, tên và vai trò thật", "Chức năng", "Cao", UIM,
      ["Tham gia 'photo' (member), tạo 1 cộng đồng riêng (owner)", "Mở bảng", "Rời 'photo' ở tab Cộng đồng của tôi rồi quay lại"], "-",
      "Hàng 'photo' có nhãn vai trò 'Thành viên', cộng đồng mình tạo có 'Chủ cộng đồng' (mod: 'Điều hành viên', admin: 'Quản trị viên'); sau khi rời, hàng 'photo' biến mất; cộng đồng bị cấm/ nháp wizard không xuất hiện.")
    A(F, "5 cột đúng nhãn: Thông báo từ quản trị | Nhắc sự kiện | Bài nổi bật | Bình luận bài tôi theo dõi | Yêu cầu gia nhập", "Giao diện", "Cao", UIM + " " + WEIRD, ["Đọc hàng tiêu đề của bảng"], "-", "Thứ tự cột như trên; mỗi ô là công tắc nhỏ, aria-label '<nhãn cột> · <tên cộng đồng>'; bảng cuộn ngang khi hẹp (min-width 760px).")
    A(F, "Thành viên thường: ô 'Yêu cầu gia nhập' hiện '–' (không áp dụng); owner/admin/mod thấy công tắc", "Chức năng", "Cao", UIM, ["Xem hàng cộng đồng mình là thành viên", "Xem hàng cộng đồng mình là chủ"], "-", "Thành viên thường: dấu '–' (aria-label 'Không áp dụng'); chủ: công tắc bật được. Các cột khác luôn là công tắc.")
    A(F, "Tắt 1 ô cộng đồng + Lưu: giữ sau F5, chỉ ảnh hưởng đúng cộng đồng/cột đó", "Chức năng", "Cao", UIM, ["Tắt 'Bình luận bài tôi theo dõi' ở 'photo'", "Lưu và F5"], "photo/comment", "Ô đó tắt, các ô khác bật; PUT gửi communityPrefs = { photo: { admin:true, event:true, featured:true, comment:false, joinRequest:true } } (chỉ các cộng đồng có cột bị tắt).")
    A(F, "'Đặt lại mặc định' bật lại mọi ô nhưng CHƯA lưu tới khi bấm Lưu (sau Lưu communityPrefs = {})", "Chức năng", "Trung bình", UIM, ["Tắt vài ô và Lưu", "Bấm 'Đặt lại mặc định'", "Quan sát Lưu", "Bấm Lưu"], "-", "Sau khi bấm: mọi ô bật, nút Lưu sáng (chưa gọi API); sau Lưu: PUT communityPrefs = {} và GET trả communityPrefs {}.")
    A(F, "Bạn chưa tham gia cộng đồng nào: bảng hiện 'Bạn chưa tham gia cộng đồng nào.'", "Giao diện", "Thấp", UIM + " (không tham gia cộng đồng nào, nếu tài khoản mới còn tự động tham gia thì rời hết).", ["Mở bảng khi không có cộng đồng"], "-", "Một dòng trống căn giữa 'Bạn chưa tham gia cộng đồng nào.'; vẫn có Hủy/Lưu.", pw="Một phần")
    A(F, "Màn hình hẹp: hai thẻ trên xếp dọc, bảng cộng đồng cuộn ngang trong khung, không tràn trang", "Giao diện", "Thấp", UIM, ["Đặt viewport 375x812", "Mở tab Thông báo"], "375x812", "Không có thanh cuộn ngang toàn trang; riêng bảng 'Theo từng cộng đồng' có thanh cuộn ngang riêng; nút Hủy/Lưu bấm được.")

def load_setn_more(add):
    A = _mk(add, "SETN", "Cài đặt - Thông báo")
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE
    API2 = APIM + " " + MAIL
    ENF = APIM + " Hai người dùng A (người nhận) và B (người gây thông báo) cùng tham gia 'photo' (POST /courses/photo/enroll)."
    UNIT = BASE + " Chạy trong thư mục backend (đã npm install)."

    # ------------------------------------------------------------------ API
    F = "API - GET/PUT /notifications/preferences"
    A(F, "GET/PUT không token -> 401", "Bảo mật", "Cao", API, ["GET /api/notifications/preferences không token", "PUT /api/notifications/preferences {dmAllowed:false} không token"], "-", "401 cả hai.", pw="Không")
    A(F, "GET mặc định: emailDigest 'off', quiet {enabled:false,from:'22:00',to:'07:00'}, dmAllowed/emailUnreadDm/notifyFollowedPosts true, communityPrefs {}, communities có hàng 'photo' (role member, prefs 5 cột true, applicable.joinRequest=false)", "Chức năng", "Cao", API,
      ["Đăng ký người dùng mới, POST /courses/photo/enroll", "GET /api/notifications/preferences"], "-", "200 đúng các giá trị nêu trên; applicable.comment=true.", pw="Không")
    A(F, "Chủ cộng đồng: communities[] hàng của cộng đồng mình có role 'owner' và applicable.joinRequest=true", "Chức năng", "Trung bình", APIM, ["POST /communities (tạo cộng đồng công khai)", "GET /notifications/preferences"], "-", "Hàng của cộng đồng vừa tạo: role 'owner', applicable.joinRequest=true.", pw="Không")
    bad_bodies = [{}, {"quiet": {"from": "25:00"}}, {"quiet": {"from": "7:00"}}, {"emailDigest": "hourly"}, {"dmAllowed": "yes"}, {"communityPrefs": {"photo": {"admin": "x"}}}, {"communityPrefs": {"photo": {"unknown": True}}}, {"unknownField": 1}]
    A(F, "PUT preferences body không hợp lệ -> 400 (body rỗng {}, quiet.from '25:00', quiet.from '7:00', emailDigest 'hourly', dmAllowed 'yes')", "Chức năng", "Trung bình", APIM,
      ["Gửi lần lượt từng body trên bằng PUT /api/notifications/preferences"], "5 body", "Cả 5 lần 400 VALIDATION_ERROR; preferences không đổi (GET lại giống cũ).", pw="Không")
    A(F, "PUT communityPrefs sai ({photo:{admin:'x'}}, {photo:{unknown:true}}) và khóa lạ ở gốc ({unknownField:1}) -> 400", "Chức năng", "Trung bình", APIM,
      ["Gửi lần lượt 3 body trên"], "3 body", "Cả 3 lần 400; không lưu một phần.", pw="Không")
    A(F, "PUT quiet {enabled:true, from:'08:00', to:'08:00'} -> 400 (from == to khi bật)", "Chức năng", "Trung bình", APIM, ["PUT {quiet:{enabled:true,from:'08:00',to:'08:00'}}"], "08:00-08:00", "400; PUT {quiet:{enabled:false,from:'08:00',to:'08:00'}} thì 200 (tắt thì không kiểm).", pw="Không")
    A(F, "PUT từng phần: gửi nhiều trường lưu đủ; cập nhật quiet.enabled=false giữ nguyên from/to và các trường khác", "Chức năng", "Cao", APIM,
      ["PUT {emailDigest:'instant', quiet:{enabled:true,from:'23:00',to:'06:30'}, dmAllowed:false, emailUnreadDm:false, notifyFollowedPosts:false}", "PUT {quiet:{enabled:false}}", "GET"], "-", "Lần 1: 200 đúng giá trị. Lần 2: quiet = {enabled:false, from:'23:00', to:'06:30'}, dmAllowed/emailUnreadDm/notifyFollowedPosts vẫn false.", pw="Không")
    A(F, "Loại thông báo quan trọng không tắt được: PUT {types:{payment_failed:false}} -> 400; tắt loại không bắt buộc (post_liked) -> 200 và thông báo loại đó không còn được lưu", "Chức năng", "Trung bình", APIM, ["PUT {types:{payment_failed:false}}", "PUT {types:{post_liked:false}}", "B thích bài của A"], "-", "400; 200; A không nhận thông báo 'thích bài'. Tương thích ngược với types/emailDigest cũ.", pw="Không")
    A(F, "communityPrefs THAY THẾ cả bảng: lưu ma trận, id cộng đồng lạ bị bỏ, {} = đặt lại mặc định", "Chức năng", "Cao", APIM,
      ["PUT {communityPrefs:{photo:{comment:false}, 'khong-co':{admin:false}}}", "GET", "PUT {communityPrefs:{}}", "GET"], "-", "Sau lần 1: communityPrefs chỉ có 'photo' (id lạ bị bỏ), communities['photo'].prefs.comment=false còn 4 cột khác true; sau lần 3: communityPrefs {} và comment=true.", pw="Không")
    A(F, "communityPrefs với id cộng đồng mình KHÔNG là thành viên bị bỏ (không lộ cộng đồng riêng/ không tạo rác)", "Bảo mật", "Trung bình", APIM, ["PUT {communityPrefs:{'private-demo':{admin:false}}} bằng người không phải thành viên", "GET"], "private-demo", "200 nhưng communityPrefs vẫn {}; không có hàng 'private-demo' trong communities[].", pw="Không")
    A(F, "Cô lập theo người dùng: PUT preferences của B không ảnh hưởng A (token quyết định chủ thể, không có tham số userId)", "Bảo mật", "Cao", APIM, ["A và B đăng ký", "B PUT {dmAllowed:false}", "A GET"], "-", "A vẫn dmAllowed=true.", pw="Không")

    # ------------------------------------------------------------------ THỰC THI: MUTE THEO CỘNG ĐỒNG
    F = "Thực thi - tắt cột theo cộng đồng"
    mapping = [("comment", "post_commented", "B bình luận bài của A trong 'photo'", True), ("event", "event_created", "mod/owner 'photo' tạo sự kiện", True),
               ("event", "event_reminder", "đến mốc nhắc sự kiện A đã RSVP (job nhắc)", True), ("event", "(hủy sự kiện)", "owner hủy sự kiện A đã RSVP", True),
               ("joinRequest", "(yêu cầu gia nhập mới / thành viên mới -> owner/admin)", "B gửi yêu cầu vào cộng đồng riêng của A (A là owner)", True),
               ("admin", "(kết quả duyệt yêu cầu gia nhập, nhãn category 'admin')", "owner duyệt/ từ chối yêu cầu của A", True)]
    A(F, "Tắt cột 'comment' ở cộng đồng X: thông báo post_commented của X KHÔNG được lưu; cộng đồng khác và người khác vẫn nhận", "Chức năng", "Cao", ENF + " Cần cả cộng đồng thứ hai Y để đối chứng.",
      ["A PUT communityPrefs {X:{comment:false}}", "B bình luận bài của A ở X rồi ở Y", "GET /api/notifications của A"], "comment=post_commented", "Ở X: không có thông báo mới cho A (không lưu, không SSE, không email); ở Y: có; người dùng C chưa tắt vẫn nhận ở X.", pw="Một phần")
    A(F, "Tắt cột 'event' ở X: event_created, event_reminder và thông báo hủy sự kiện của X không được lưu", "Chức năng", "Cao", ENF + " Cần cả cộng đồng thứ hai Y để đối chứng.",
      ["A PUT communityPrefs {X:{event:false}}", "Owner/mod tạo sự kiện ở X rồi ở Y (A đã RSVP)", "Chạy job nhắc sự kiện / hủy sự kiện"], "event", "Ở X không có 3 loại thông báo trên cho A; ở Y vẫn có.", pw="Không")
    A(F, "Tắt cột 'joinRequest' / 'admin' ở X: không nhận thông báo yêu cầu gia nhập mới / thành viên mới (owner/admin) và kết quả duyệt yêu cầu gia nhập (nhãn category 'admin')", "Chức năng", "Cao", ENF + " A là owner của cộng đồng riêng X và cũng gửi yêu cầu vào cộng đồng riêng Z của người khác.",
      ["A tắt joinRequest và admin ở X (và Z cho admin)", "B gửi yêu cầu vào X", "Owner Z duyệt/ từ chối yêu cầu của A"], "joinRequest, admin", "A không nhận 'yêu cầu gia nhập mới' ở X và không nhận kết quả duyệt ở Z; bật lại thì nhận.", pw="Không")
    A(F, "Thông báo loại khác và loại quan trọng không bị cột nào chặn: thích bài, thanh toán, đổi vai trò, 'system' không nhãn vẫn đến dù tắt mọi cột", "Chức năng", "Cao", ENF,
      ["A tắt cả 5 cột ở photo", "Gửi lần lượt post_liked, role_changed, system (không category), post_commented có communityId=null"], "-", "Thông báo post_liked/role_changed/system(không nhãn)/post_commented(không communityId) VẪN lưu; post_commented ở photo và system category 'admin' bị chặn. (Test notifications-settings: titles còn lại gồm cmt-khac, cmt-none, like-photo, role-photo, sys-photo.)", pw="Không")
    A(F, "Cột 'Bài nổi bật' (featured) chỉ LƯU, chưa có nguồn thông báo (ghim bài không báo ai)", "Chức năng", "Trung bình", ENF,
      ["A tắt cột 'Bài nổi bật' ở photo, lưu", "Mod ghim một bài", "Kiểm tra thông báo của A khi cột bật và khi cột tắt"], "featured", "HIỆN TẠI: cả hai trường hợp A đều KHÔNG nhận thông báo vì chưa có nơi phát 'bài nổi bật' nên công tắc không có tác dụng. KỲ VỌNG: ghim/nổi bật phát thông báo và cột này điều khiển nó.", st=PLAN, pw="Không")
    A(F, "'Báo khi người tôi theo dõi đăng bài' (notifyFollowedPosts) chỉ LƯU - chưa có tính năng theo dõi người dùng", "Chức năng", "Trung bình", ENF, ["Tắt/bật công tắc, Lưu", "Tìm nút 'Theo dõi' ở hồ sơ người khác"], "notifyFollowedPosts", "HIỆN TẠI cờ được lưu nhưng không nơi nào dùng; không có nút theo dõi. KỲ VỌNG: khi có follow thì cờ điều khiển thông báo bài mới.", st=PLAN, pw="Không")

    # ------------------------------------------------------------------ THỰC THI: EMAIL
    F = "Thực thi - email tổng hợp"
    A(F, "emailDigest='instant': mỗi thông báo gửi 1 email (tiêu đề = title, nội dung có body + link FRONTEND_URL + link)", "Chức năng", "Cao", ENF + " " + MAIL,
      ["A PUT {emailDigest:'instant'}", "B bình luận bài của A (hoặc notify system có link '/notifications')", "GET /api/dev/outbox?to=<email A>"], "instant", "Outbox có đúng 1 thư subject = tiêu đề thông báo, text chứa nội dung và đường dẫn; thông báo trong chuông cũng có.", pw="Một phần")
    A(F, "emailDigest 'off' / 'daily' / 'weekly': KHÔNG gửi email khi có thông báo (thông báo vẫn lưu trong chuông)", "Chức năng", "Cao", ENF + " " + MAIL,
      ["Với mỗi giá trị: A PUT {emailDigest:<giá trị>}", "Tạo một thông báo cho A", "Kiểm tra outbox của A và chuông"], "off | daily | weekly", "Mỗi giá trị: thông báo có ở chuông, outbox KHÔNG có thư mới. (Mặc định của tài khoản mới là 'off'.)", pw="Một phần")
    A(F, "Email 'Mỗi ngày'/'Mỗi tuần' chưa có job gom và gửi (cần cột 'lần gửi cuối' + job trong jobs.ts)", "Chức năng", "Trung bình", ENF + " " + MAIL,
      ["Chọn 'Mỗi ngày' và 'Mỗi tuần', Lưu", "Tạo vài thông báo", "Chờ qua mốc ngày/tuần (hoặc chạy các job nền)"], "daily/weekly", "HIỆN TẠI không có email tổng hợp nào được gửi (UI có ghi chú nhưng người dùng chọn rồi vẫn không nhận gì). KỲ VỌNG: email tổng hợp định kỳ.", st=PLAN, pw="Không")
    A(F, "Email bị chặn bởi giờ im lặng KHÔNG được gửi bù sau khi hết giờ im lặng (chưa chốt nghiệp vụ)", "Chức năng", "Thấp", ENF + " " + MAIL,
      ["Bật instant + giờ im lặng chứa 'bây giờ'", "Tạo thông báo", "Chờ hết khoảng im lặng"], "-", "HIỆN TẠI: email không bao giờ gửi (mất). KỲ VỌNG: PO quyết định gửi bù hay bỏ (docs 'cần quyết định').", st=PLAN, pw="Không")

    # ------------------------------------------------------------------ THỰC THI: GIỜ IM LẶNG
    F = "Thực thi - giờ im lặng (hàm isQuietNow)"
    qcmd = "npx tsx -e \"import('./src/modules/notifications/notifications.quiet.ts').then(m=>console.log(m.isQuietNow({enabled:true,from:'%s',to:'%s'},'%s',new Date('%s'))))\""
    cases_q = [("22:00", "07:00", "UTC", "2026-01-01T22:00:00Z", True, "đúng giờ bắt đầu (bao gồm)"), ("22:00", "07:00", "UTC", "2026-01-01T23:59:00Z", True, "trước nửa đêm"),
               ("22:00", "07:00", "UTC", "2026-01-02T00:00:00Z", True, "đúng nửa đêm"), ("22:00", "07:00", "UTC", "2026-01-02T06:59:00Z", True, "sát giờ kết thúc"),
               ("22:00", "07:00", "UTC", "2026-01-02T07:00:00Z", False, "đúng giờ kết thúc (loại trừ, [from,to))"), ("22:00", "07:00", "UTC", "2026-01-01T12:00:00Z", False, "giữa trưa"),
               ("22:00", "07:00", "UTC", "2026-01-01T21:59:00Z", False, "trước giờ bắt đầu 1 phút"),
               ("13:00", "15:00", "UTC", "2026-01-01T13:00:00Z", True, "khoảng thường: đầu khoảng"), ("13:00", "15:00", "UTC", "2026-01-01T14:59:00Z", True, "khoảng thường: cuối khoảng"),
               ("13:00", "15:00", "UTC", "2026-01-01T15:00:00Z", False, "khoảng thường: đúng giờ kết thúc"), ("13:00", "15:00", "UTC", "2026-01-01T12:59:00Z", False, "khoảng thường: trước đầu khoảng"),
               ("22:00", "07:00", "Asia/Ho_Chi_Minh", "2026-01-01T16:00:00Z", True, "múi giờ VN: 16:00Z = 23:00 -> im lặng"), ("22:00", "07:00", "America/New_York", "2026-01-01T16:00:00Z", False, "múi giờ New York: 16:00Z = 11:00 -> không im lặng"),
               ("22:00", "07:00", "Not/AZone", "2026-01-01T16:00:00Z", True, "múi giờ lạ rơi về Asia/Ho_Chi_Minh (23:00 VN)"), ("08:00", "08:00", "UTC", "2026-01-01T08:00:00Z", False, "from == to = rỗng, không bao giờ im lặng"),
               ("abc", "07:00", "UTC", "2026-01-01T03:00:00Z", False, "giờ sai định dạng không làm sập, trả false")]
    A(F, "isQuietNow khoảng qua nửa đêm 22:00-07:00 (UTC): true tại 22:00, 23:59, 00:00, 06:59; false tại 07:00 (loại trừ), 12:00, 21:59", "Chức năng", "Cao", UNIT,
      ["cd backend", qcmd % ("22:00", "07:00", "UTC", "<ISO>") + "  -- thay <ISO> lần lượt bằng 2026-01-01T22:00:00Z, 2026-01-01T23:59:00Z, 2026-01-02T00:00:00Z, 2026-01-02T06:59:00Z, 2026-01-02T07:00:00Z, 2026-01-01T12:00:00Z, 2026-01-01T21:59:00Z"], "22:00-07:00 UTC",
      "In ra true, true, true, true, false, false, false theo thứ tự trên (khoảng [from, to)). Cũng được test tự động ở tests/notifications-settings.test.ts.", pw="Không")
    A(F, "isQuietNow khoảng thường 13:00-15:00 (UTC): true tại 13:00 và 14:59; false tại 15:00 và 12:59", "Chức năng", "Trung bình", UNIT,
      ["cd backend", qcmd % ("13:00", "15:00", "UTC", "<ISO>") + "  -- thay <ISO> bằng 2026-01-01T13:00:00Z, 14:59:00Z, 15:00:00Z, 12:59:00Z"], "13:00-15:00 UTC", "In ra true, true, false, false.", pw="Không")
    A(F, "isQuietNow theo múi giờ người dùng: 22:00-07:00 tại 16:00Z -> true với Asia/Ho_Chi_Minh (23:00 VN), false với America/New_York (11:00), true với múi giờ lạ 'Not/AZone' (rơi về giờ VN)", "Chức năng", "Cao", UNIT,
      ["cd backend", qcmd % ("22:00", "07:00", "<TZ>", "2026-01-01T16:00:00Z") + "  -- thay <TZ> bằng Asia/Ho_Chi_Minh, America/New_York, Not/AZone"], "16:00Z", "In ra true, false, true.", pw="Không")
    A(F, "isQuietNow trường hợp biên: from == to (08:00-08:00) luôn false; giờ sai định dạng ('abc') không làm sập (false); enabled=false luôn false", "Chức năng", "Thấp", UNIT,
      ["cd backend", qcmd % ("08:00", "08:00", "UTC", "2026-01-01T08:00:00Z"), qcmd % ("abc", "07:00", "UTC", "2026-01-01T03:00:00Z"), qcmd.replace("enabled:true", "enabled:false") % ("22:00", "07:00", "Asia/Ho_Chi_Minh", "2026-01-01T16:00:00Z")], "biên", "In ra false cho cả ba lệnh; không có exception.", pw="Không")
    A(F, "Trong giờ im lặng: thông báo VẪN lưu (hiện trong chuông) nhưng không đẩy SSE/toast và không gửi email", "Chức năng", "Cao", ENF + " " + MAIL,
      ["A bật emailDigest 'instant' và giờ im lặng chứa giờ hiện tại theo múi giờ của A (vd. from = now-2h, to = now+2h)", "A mở trang bất kỳ và để mở chuông", "B bình luận bài của A", "Kiểm tra chuông, toast realtime, outbox"], "-",
      "Chuông (GET /notifications) CÓ thông báo; KHÔNG có toast/ cập nhật realtime ở trang đang mở; outbox KHÔNG có thư. SSE của kênh chat /messages/stream không bị ảnh hưởng (tin nhắn vẫn realtime).", pw="Một phần")
    A(F, "Ngoài giờ im lặng: thông báo có toast realtime và có email (instant)", "Chức năng", "Cao", ENF + " " + MAIL,
      ["A bật instant + giờ im lặng NẰM NGOÀI giờ hiện tại (from = now+2h, to = now+4h)", "B bình luận bài của A"], "-", "Chuông có thông báo, trang đang mở của A nhận toast realtime, outbox có 1 thư.", pw="Một phần")
    A(F, "Giờ im lặng qua nửa đêm theo múi giờ người dùng: đặt múi giờ Los Angeles và khoảng chứa giờ LA hiện tại", "Chức năng", "Trung bình", ENF + " " + MAIL,
      ["A đặt timezone America/Los_Angeles (Cài đặt > Tài khoản & bảo mật)", "Tính giờ LA hiện tại T; đặt khoảng im lặng [T-1h, T+1h] (nếu qua 00:00 thì vẫn hợp lệ)", "B bình luận bài của A"], "America/Los_Angeles", "Thông báo bị coi là trong giờ im lặng theo GIỜ LA (không theo giờ VN/ máy chủ): không toast, không email, vẫn lưu.", pw="Không")
    A(F, "Giờ im lặng đối với thông báo tin nhắn riêng: email 'chưa đọc' cũng bị chặn trong khoảng im lặng", "Chức năng", "Trung bình", ENF + " " + MAIL,
      ["A bật giờ im lặng chứa now; emailUnreadDm=true", "B nhắn tin cho A (A không mở hội thoại)"], "-", "Thông báo tin nhắn lưu ở chuông nhưng KHÔNG có email.", pw="Không")

    # ------------------------------------------------------------------ THỰC THI: DM
    F = "Thực thi - tin nhắn riêng (dmAllowed)"
    A(F, "dmAllowed=false: POST /conversations mở/bắt đầu hội thoại với người đó -> 403 DM_DISABLED 'Người dùng này đã tắt nhận tin nhắn riêng'", "Chức năng", "Cao", ENF,
      ["B PUT {dmAllowed:false}", "A POST /api/conversations {userId: B.id}"], "-", "403 error.code='DM_DISABLED', message chứa 'tắt nhận tin nhắn riêng'; không tạo hội thoại.", pw="Không")
    A(F, "dmAllowed=false: gửi thêm vào hội thoại đã có -> 403; người tắt vẫn nhắn đi được cho người khác và trả lời trong hội thoại cũ", "Chức năng", "Cao", ENF,
      ["A mở hội thoại với B (201)", "B tắt dmAllowed", "A POST /conversations/<id>/messages", "B POST cùng hội thoại (trả lời A)"], "-", "Bước 3: 403. Bước 4: 201 (A cho phép nhận). B vẫn mở được hội thoại mới tới người khác.", pw="Không")
    A(F, "Bật lại dmAllowed=true: nhắn tin lại được", "Chức năng", "Trung bình", ENF, ["B tắt rồi bật lại dmAllowed", "A gửi tin vào hội thoại"], "-", "201.", pw="Không")
    A(F, "UI chat hiển thị đúng thông báo 403 khi nhắn người đã tắt nhận DM", "Chức năng", "Cao", BASE + " " + NEWU + " Hai tài khoản A, B cùng tham gia 'photo'; B đã tắt 'Cho phép nhắn tin riêng' ở Cài đặt.",
      ["Đăng nhập A, mở hồ sơ B hoặc /messages và bấm nhắn tin tới B", "Gửi một tin"], "-", "Giao diện báo 'Người dùng này đã tắt nhận tin nhắn riêng' (toast/ thông báo trong khung chat); không gửi được; không mất tin đang gõ.")
    A(F, "Nút 'Gửi tin nhắn' ở bảng người được giới thiệu hiển thị lỗi của API tin nhắn khi người nhận tắt DM / không chung cộng đồng", "Chức năng", "Trung bình", BASE + " " + NEWU + " Người A có link giới thiệu, B đăng ký bằng link và tắt DM.", ["A mở /settings/gioi-thieu", "Menu ⋯ của B -> 'Gửi tin nhắn'"], "-", "Toast lỗi với message của API (403 DM_DISABLED hoặc chưa chung cộng đồng); không chuyển trang.", pw="Một phần")
    F = "Thực thi - email khi có tin nhắn chưa đọc (emailUnreadDm)"
    A(F, "emailUnreadDm=true (mặc định): B nhắn A (A không mở hội thoại) -> A nhận email 'Tên B đã gửi tin nhắn cho bạn' đúng 1 thư", "Chức năng", "Cao", ENF + " " + MAIL, ["B mở hội thoại với A và gửi 'xin chào'", "Kiểm tra outbox của A"], "-", "1 thư subject '<Tên B> đã gửi tin nhắn cho bạn'.", pw="Một phần")
    A(F, "emailUnreadDm=false: không có email nhưng thông báo trong chuông vẫn có", "Chức năng", "Cao", ENF + " " + MAIL, ["A tắt 'Email khi có tin nhắn chưa đọc', Lưu", "B nhắn A"], "-", "Outbox của A không có thư; GET /notifications của A có thông báo 'đã gửi tin nhắn cho bạn'.", pw="Một phần")
    A(F, "Tối đa 1 thông báo/hội thoại/5 phút: B nhắn liên tiếp 3 tin trong 5 phút -> A nhận 1 thông báo và 1 email", "Chức năng", "Trung bình", ENF + " " + MAIL, ["B gửi 3 tin liên tiếp cho A", "Đếm thông báo và thư của A"], "3 tin", "1 thông báo + 1 email (gộp); sau 5 phút tin mới tạo thông báo mới.", pw="Không")
    A(F, "Không gửi email/ thông báo khi người nhận đang xem hội thoại đó", "Chức năng", "Trung bình", ENF + " " + MAIL, ["A mở /messages/<id hội thoại>", "B gửi tin"], "-", "Không có thông báo/ email mới cho A (đang xem); tin hiện realtime trong khung chat.", pw="Một phần")
    A(F, "Với tin nhắn, email chỉ phụ thuộc emailUnreadDm - KHÔNG phụ thuộc emailDigest (off vẫn gửi nếu emailUnreadDm bật)", "Chức năng", "Trung bình", ENF + " " + MAIL, ["A đặt emailDigest 'off', emailUnreadDm true", "B nhắn A"], "-", "A vẫn nhận email tin nhắn (khác với thông báo thường khi digest off).", pw="Không")

# ====================================================================================================================
#                                  MODULE SETC - Cộng đồng của tôi
# ====================================================================================================================
def load_setc(add):
    A = _mk(add, "SETC", "Cài đặt - Cộng đồng của tôi")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + " (thành viên photo, yt, fin, paid-demo...) rồi mở /settings/cong-dong."
    UIO = BASE + " Đăng nhập UI owner@sofinhub.test / " + PW + " (chủ nhiều cộng đồng, có 3 nháp wizard) rồi mở /settings/cong-dong."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó, tham gia 2-3 cộng đồng seed (photo, yt, fin) rồi mở /settings/cong-dong."
    UIM = UINEW + " " + MUTATE

    F = "Bố cục & danh sách"
    A(F, "Tab đối chiếu mockup: thẻ 'Cộng đồng đã tham gia' + bộ lọc, cột phải 2 thẻ (Có điều muốn dạy? / Tìm thêm cộng đồng), khối 'Đang chờ', 'Bản nháp cộng đồng', 'Điểm của tôi'", "Giao diện", "Cao", UIO + " " + WEIRD,
      ["Mở /settings/cong-dong", "So sánh với template.html, cuộn xuống cuối"], "-",
      "Thẻ trái 'Cộng đồng đã tham gia' (phụ đề 'Kéo để sắp xếp thứ tự trên thanh bên trái.'), bộ lọc 3 tab 'Tất cả · N' / 'Tôi quản lý · N' / 'Thành viên · N'; cột phải (>= 1180px; hẹp hơn xếp dưới): thẻ gradient 'Có điều muốn dạy? Mở cộng đồng của riêng bạn.' + 'Dùng thử 14 ngày, thiết lập trong khoảng 10 phút.' + nút 'Tạo cộng đồng' -> /communities/new; thẻ 'Tìm thêm cộng đồng' ('Gợi ý dựa trên các chủ đề bạn đang quan tâm.') + nút 'Mở trang Khám phá' -> '/'. Dưới cùng toàn chiều rộng: 'Đang chờ', 'Bản nháp cộng đồng' (nếu có), 'Điểm của tôi'.")
    A(F, "Bộ đếm bộ lọc: 'Tất cả' = tổng, 'Tôi quản lý' = owner + admin + mod, 'Thành viên' = còn lại; lọc đúng hàng", "Chức năng", "Cao", UIO, ["Ghi số ở 3 tab", "Bấm từng tab và đếm hàng"], "owner@",
      "N(Tất cả) = N(Tôi quản lý) + N(Thành viên); mỗi tab chỉ hiện hàng tương ứng; không có hàng thì 'Chưa có cộng đồng nào trong mục này.'")
    A(F, "Hàng cộng đồng: tay kéo, logo 60px, tên, nhãn vai trò, mô tả dòng, nút hành động, công tắc thanh bên, nút ⋯", "Giao diện", "Trung bình", UI, ["Quan sát một hàng thành viên và một hàng owner (owner@)"], "-", "Thành viên: nhãn xanh lá 'Thành viên · Cấp N', nút 'Mở'. Owner: nhãn nền đen 'Chủ sở hữu', nút có biểu tượng bánh răng + chữ 'Cài đặt cộng đồng' (chữ ẩn dưới 1180px, vẫn còn tooltip title).")
    A(F, "Dòng mô tả của OWNER: '<N> thành viên · Công khai|Riêng tư' (+ ' · Dùng thử còn D ngày' khi gói hosting đang dùng thử); số có dấu chấm nghìn (vi-VN)", "Chức năng", "Trung bình", UIO + " Cộng đồng draft-chay-bo-5k đã ra mắt (nếu có) hoặc tạo owner có hosting trialing.", ["Đọc dòng mô tả của các cộng đồng owner@"], "-", "Ví dụ 'photo' hiển thị 'N thành viên · Công khai' với N khớp memberCount; cộng đồng riêng tư: 'Riêng tư'; hosting trialing: thêm 'Dùng thử còn D ngày' (D = làm tròn lên số ngày còn lại).", pw="Một phần")
    A(F, "Dòng mô tả của THÀNH VIÊN: 'Tham gia hôm nay|dd/mm/yyyy' + (Dùng thử còn N ngày | Gói năm | Gói tháng | Miễn phí)", "Chức năng", "Cao", UI + " member1@ có gói ở paid-demo; newbie@ chưa gói.", ["Đối chiếu dòng mô tả với GET /api/me/communities (enrolledAt, subscription, free)"], "-", "Cộng đồng miễn phí: '… · Miễn phí'; gói trialing: '… · Dùng thử còn N ngày'; gói active interval monthly: 'Gói tháng', annual: 'Gói năm' (cả past_due/paused); tham gia trong ngày: 'Tham gia hôm nay'.", pw="Một phần")
    A(F, "Nhãn vai trò theo vai trò thật: owner 'Chủ sở hữu'; admin 'Quản trị viên · Cấp N'; mod 'Điều hành viên · Cấp N'; member 'Thành viên · Cấp N'", "Chức năng", "Trung bình", BASE + " Đăng nhập cadmin/mod seed (xem sheet Tài khoản: cadmin, mod là admin/mod của photo).", ["Mở tab bằng tài khoản admin và mod của photo"], "photo", "Hàng 'photo' đúng nhãn vai trò + cấp độ (level từ điểm); cả hai nằm trong 'Tôi quản lý'.", pw="Một phần")
    A(F, "Thứ tự mặc định: ghim trước, rồi sortOrder, rồi ngày tham gia; cộng đồng bị cấm/ đã rời không xuất hiện", "Chức năng", "Trung bình", UIM, ["Tham gia photo, yt, fin lần lượt", "Quan sát thứ tự", "Ghim 'fin'"], "-", "Chưa sắp xếp thủ công: theo ngày tham gia; sau khi ghim 'fin' nó lên đầu có biểu tượng ghim cam.")
    A(F, "Trạng thái tải 'Đang tải…' và lỗi (role=alert) khi API /me/communities lỗi", "Giao diện", "Thấp", UI, ["Chặn GET /me/communities rồi F5"], "-", "Hiện 'Đang tải…' rồi message API hoặc 'Có lỗi xảy ra, vui lòng thử lại.' màu đỏ.", pw="Một phần")

    F = "Công tắc thanh bên, ghim, sắp xếp"
    A(F, "Công tắc 'Hiện <tên> trên thanh bên': đổi lưu ngay, toast 'Đã hiện|Đã ẩn <tên> trên thanh bên', giữ sau F5", "Chức năng", "Cao", UIM, ["Tắt công tắc của 'photo'", "F5", "Bật lại"], "photo", "Toast 'Đã ẩn <tên> trên thanh bên'; PATCH /me/communities/photo {sidebarVisible:false}; sau F5 vẫn tắt; mặc định mọi cộng đồng BẬT.")
    A(F, "Menu ⋯: 'Ghim lên đầu thanh bên' -> hàng lên đầu + biểu tượng ghim + toast 'Đã ghim <tên>'; 'Bỏ ghim' -> toast 'Đã bỏ ghim' và trả vị trí cũ", "Chức năng", "Cao", UIM, ["Bấm ⋯ ở 'fin' -> 'Ghim lên đầu thanh bên'", "Bấm lại ⋯ -> 'Bỏ ghim'"], "fin", "Sau ghim: 'fin' đứng đầu danh sách, hiện biểu tượng ghim cam cạnh nhãn; menu đổi thành 'Bỏ ghim'; sau bỏ ghim về vị trí theo sortOrder/ngày tham gia.")
    A(F, "Ghim nhiều cộng đồng được (không giới hạn 1) - ghim luôn đứng trên; mockup chỉ minh họa 1 mục ghim", "Chức năng", "Thấp", UIM, ["Ghim 'photo' rồi 'yt'", "Quan sát thứ tự"], "photo, yt", "HIỆN TẠI: cả hai được ghim, thứ tự theo sortOrder/ngày trong nhóm ghim. Mockup chỉ có một mục ghim; docs: 'Ghim cho phép nhiều cộng đồng'. Ghi nhận để PO chốt số ghim tối đa.", st=PLAN)
    A(F, "Kéo-thả đổi thứ tự bằng biểu tượng sáu chấm: toast 'Đã cập nhật thứ tự', giữ sau F5; thả lên chính nó không gọi API", "Chức năng", "Cao", UIM, ["Kéo 'fin' lên trên 'photo'", "F5", "Kéo 'photo' thả lên chính nó"], "-", "PUT /me/communities/order {ids:[...đầy đủ]}; thứ tự mới giữ sau F5; thả lên chính nó: không request, không toast.", pw="Một phần")
    A(F, "Kéo-thả khi đang lọc 'Thành viên'/'Tôi quản lý': thứ tự toàn cục vẫn đúng (tính trên toàn bộ danh sách)", "Chức năng", "Thấp", UIM, ["Lọc 'Thành viên'", "Kéo đổi thứ tự 2 hàng", "Chuyển 'Tất cả'"], "-", "Thứ tự ở 'Tất cả' phản ánh đúng thay đổi; cộng đồng không hiển thị theo lọc không bị lộn thứ tự.", pw="Một phần")
    A(F, "Ghim luôn đứng đầu bất kể kéo-thả (kéo không bỏ ghim)", "Chức năng", "Trung bình", UIM, ["Ghim 'photo'", "Kéo 'fin' lên trên 'photo'", "Quan sát"], "-", "Sau khi kéo 'photo' (ghim) vẫn đứng đầu; 'fin' ngay sau; không tự bỏ ghim.", pw="Một phần")
    A(F, "sidebarVisible/pinned/sortOrder chỉ ảnh hưởng thứ tự ở trang Cài đặt (app chưa có thanh bên liệt kê cộng đồng của user)", "Chức năng", "Trung bình", UIM, ["Ẩn 'photo' khỏi thanh bên và ghim 'fin'", "Duyệt toàn app tìm thanh bên cộng đồng của tôi"], "-", "HIỆN TẠI không có thanh bên nào đọc các cờ này (CommunitySidebar là menu của một cộng đồng) nên phụ đề 'trên thanh bên trái' chưa có tác dụng ngoài trang này. KỲ VỌNG: thanh bên toàn cục dùng các cờ đã lưu.", st=PLAN, pw="Không")

    F = "Hành động trên hàng"
    A(F, "Nút 'Cài đặt cộng đồng' của owner -> /communities/<id>/community/cai-dat; nút 'Mở' của thành viên -> /communities/<id>/community", "Chức năng", "Cao", UIO, ["Bấm 'Cài đặt cộng đồng' ở photo", "Quay lại, đăng nhập member1@ và bấm 'Mở' ở photo"], "photo", "Đúng hai URL trên; trang đích tải bình thường.")
    A(F, "Menu ⋯ -> 'Tùy chỉnh thông báo' mở /settings/thong-bao; 'Quản lý gói thành viên' mở /settings/thanh-toan", "Chức năng", "Trung bình", UI, ["Bấm ⋯ ở một hàng, chọn từng mục"], "-", "Điều hướng SPA đúng tab; menu đóng sau khi chọn; mục 'Rời cộng đồng' màu đỏ.")
    A(F, "Rời cộng đồng (thành viên): modal 'Rời <tên>?' + cảnh báo + CTA 'Rời cộng đồng'; xác nhận -> toast 'Đã rời <tên>', hàng biến mất", "Chức năng", "Cao", UIM, ["Bấm ⋯ -> 'Rời cộng đồng' ở 'yt'", "Đọc modal", "Bấm 'Rời cộng đồng'"], "yt", "Modal: 'Bạn sẽ mất quyền truy cập nội dung và cấp độ hiện tại. Gói trả phí vẫn dùng được tới ngày gia hạn.'; sau xác nhận toast 'Đã rời Y' (DELETE /me/communities/yt -> {left:true}); hàng biến mất, bộ đếm giảm.")
    A(F, "Rời cộng đồng có gói trả phí: gói đặt hủy cuối kỳ, vẫn dùng được tới ngày gia hạn", "Chức năng", "Cao", UIM + " Người dùng đã mua gói tháng ở một cộng đồng có phí (mua ở /communities/<id>/checkout).", ["Rời cộng đồng đó ở Cài đặt", "Mở tab Thanh toán"], "-", "Gói hiện 'Đã hủy' + 'Hết hạn <ngày>'; truy cập nội dung còn tới hết kỳ (rời = hủy cuối kỳ qua paymentsService.onMemberLeft); không bị trừ tiền kỳ sau.", pw="Một phần")
    A(F, "Chủ sở hữu bấm 'Rời cộng đồng': modal 'Bạn là chủ sở hữu. Hãy chuyển quyền trước khi rời.' chỉ có nút 'Đã hiểu' (không rời)", "Chức năng", "Cao", UIO, ["Bấm ⋯ -> 'Rời cộng đồng' ở cộng đồng owner@ sở hữu", "Bấm 'Đã hiểu'"], "photo", "Không gọi DELETE; modal đóng; cộng đồng còn nguyên. (BE cũng chặn 409 nếu gọi thẳng API.)")
    A(F, "Lỗi khi rời (API 4xx/5xx) hiển thị ngay trong modal, modal không đóng", "Chức năng", "Thấp", UIM, ["Rời cộng đồng khi backend tắt"], "offline", "Lỗi đỏ trong modal ('Có lỗi xảy ra, vui lòng thử lại.' hoặc message API).", pw="Một phần")

    F = "Đang chờ (yêu cầu gia nhập / lời mời)"
    A(F, "Gửi yêu cầu vào cộng đồng riêng tư -> xuất hiện ở 'Đang chờ': logo, tên (link), 'Bạn gửi yêu cầu vừa xong|N giờ trước|N ngày trước · đang chờ duyệt', nút 'Hủy yêu cầu'", "Chức năng", "Cao", UIM + " Cộng đồng riêng tư seed: private-demo.", ["Mở /communities/private-demo (hoặc cộng đồng riêng tư) và gửi yêu cầu tham gia", "Mở lại /settings/cong-dong"], "private-demo", "Một hàng cho cộng đồng đó, mô tả thời gian đúng khoảng (dưới 1 giờ: 'vừa xong'); tiêu đề là link tới cộng đồng.")
    A(F, "Hủy yêu cầu: toast 'Đã hủy yêu cầu gia nhập <tên>', hàng biến mất; cộng đồng riêng tư lại cho gửi yêu cầu mới", "Chức năng", "Cao", UIM, ["Bấm 'Hủy yêu cầu'", "Mở lại trang cộng đồng riêng tư"], "-", "DELETE /join-requests/<id> 200; danh sách 'Đang chờ' rỗng; trang cộng đồng cho gửi lại.")
    A(F, "Không có yêu cầu/ lời mời: hiện 'Không có yêu cầu hay lời mời nào đang chờ.'", "Giao diện", "Thấp", UIM, ["Mở tab với tài khoản chưa gửi yêu cầu"], "-", "Dòng căn giữa như trên.")
    A(F, "Lời mời (invites) luôn rỗng và mockup có nút 'Từ chối' / 'Tham gia' cho lời mời nhưng UI chưa có", "Chức năng", "Trung bình", UIM,
      ["Tạo lời mời (mã/ link) cho cộng đồng và đăng nhập bằng tài khoản được mời", "Mở khối 'Đang chờ'"], "-", "HIỆN TẠI: GET /me/join-requests trả invites:[] (Invite là mã/link chung, không có người nhận) nên không có hàng lời mời và không có nút 'Từ chối'/'Tham gia'. KỲ VỌNG theo mockup: hộp thư lời mời theo người nhận (cần bảng mời theo user/email).", st=PLAN, pw="Không")

    F = "Bản nháp cộng đồng & Điểm của tôi (chuyển từ trang cũ)"
    A(F, "Khối 'Bản nháp cộng đồng' chỉ hiện khi có nháp: tên (hoặc 'Chưa đặt tên'), 'Đã hoàn thành n/4 bước · sửa lần cuối <ngày>', nút 'Tiếp tục tạo' / 'Xóa nháp'", "Chức năng", "Cao", UIO, ["Mở tab bằng owner@ (3 nháp seed)", "Bấm 'Tiếp tục tạo' của 'Lớp Gốm Cuối Tuần'"], "draft-gom-cuoi-tuan", "3 hàng nháp: 'Lớp Gốm Cuối Tuần' (1/4), 'Chạy Bộ 5K Cho Người Mới' (3/4), 'Viết Content Ra Đơn' (4/4); 'Tiếp tục tạo' -> /communities/new?draft=<id> và wizard nhảy tới bước đúng. Tài khoản không có nháp: không có khối này.")
    A(F, "Xóa nháp: hộp xác nhận 'Xóa bản nháp này?' / 'Hành động này không thể hoàn tác.' / nút 'Xóa nháp'; xác nhận -> toast 'Đã xóa bản nháp'", "Chức năng", "Trung bình", UIM + " Tài khoản có ít nhất 1 nháp wizard (tạo ở /communities/new bước 1).", ["Bấm 'Xóa nháp'", "Hủy hộp thoại", "Bấm lại và xác nhận"], "-", "Hủy: không xóa. Xác nhận: DELETE nháp 200, hàng biến mất, slug được giải phóng.")
    A(F, "Khối 'Điểm của tôi': tổng điểm, điểm theo từng cộng đồng, 'Hoạt động điểm gần đây' (tối đa 8 dòng, '+N')", "Chức năng", "Trung bình", UI, ["Cuộn xuống 'Điểm của tôi'", "Đối chiếu với GET /api/me/points"], "member1", "Thẻ trái: tổng điểm lớn màu cam + 'Tổng điểm' + danh sách <cộng đồng> <điểm>; thẻ phải: tối đa 8 hoạt động (nhãn lý do tiếng Việt, '<cộng đồng> · <ngày giờ vi-VN>', '+N'); không có hoạt động: 'Chưa có hoạt động nào.'.")
    A(F, "Hồi quy: mọi năng lực của trang /me/communities cũ (danh sách, nháp, điểm, tạo cộng đồng) đều còn trong tab mới", "Chức năng", "Cao", UIO, ["Mở /me/communities", "Kiểm tra từng chức năng cũ: danh sách cộng đồng, nháp, điểm, nút tạo cộng đồng"], "-", "Redirect về /settings/cong-dong; có đủ danh sách + nháp + điểm + nút 'Tạo cộng đồng' (/communities/new); không mất chức năng nào.")
    A(F, "Màn hình hẹp (375px): hàng cộng đồng không tràn, nút ⋯/công tắc vẫn bấm được", "Giao diện", "Thấp", UI, ["Đặt viewport 375x812", "Duyệt danh sách"], "375x812", "Không có cuộn ngang toàn trang; hàng xuống dòng gọn; bộ lọc 3 tab không bị cắt (cuộn trong khung nếu cần).", pw="Một phần")

def load_setc_more(add):
    A = _mk(add, "SETC", "Cài đặt - Cộng đồng của tôi")
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE
    JOIN = " Người dùng tham gia 'photo' bằng POST /api/courses/photo/enroll."

    F = "API - /me/communities"
    A(F, "5 endpoint /me/communities* và /me/join-requests không token -> 401 (GET list, PUT order, PATCH :id, DELETE :id, GET join-requests)", "Bảo mật", "Cao", API, ["Gọi 5 endpoint không header Authorization"], "-", "401 cả năm.", pw="Không")
    A(F, "GET /me/communities: trường {id,title,logoUrl,thumbnail,visibility,free,role,enrolledAt,memberCount,points,level,sidebarVisible,pinned,sortOrder,subscription,hosting}; mặc định sidebarVisible=true, pinned=false, sortOrder=null", "Chức năng", "Cao", APIM,
      ["Người dùng O tạo cộng đồng riêng tư P; người dùng M gửi join-request", "GET /me/communities bằng O"], "-", "Hàng P: role 'owner', memberCount 1, visibility 'private', free true, sidebarVisible true, pinned false, sortOrder null, level >= 1, có khóa subscription và hosting (null nếu chưa có), enrolledAt có giá trị.", pw="Không")
    A(F, "Thứ tự trả về: ghim trước, rồi sortOrder (tăng), rồi ngày tham gia", "Chức năng", "Trung bình", APIM + JOIN, ["Tham gia photo + 2 cộng đồng khác", "PUT order, PATCH pinned", "GET lần lượt sau mỗi thao tác"], "-", "Thứ tự khớp quy tắc (xem các case order/pin); không trùng lặp id.", pw="Không")
    A(F, "PATCH /me/communities/photo body sai -> 400: {} (rỗng), {pinned:'x'} (sai kiểu), {role:'owner'} (trường lạ, cố leo thang vai trò)", "Bảo mật", "Trung bình", APIM + JOIN,
      ["PATCH lần lượt 3 body trên"], "3 body", "Cả 3 lần 400 VALIDATION_ERROR; vai trò/ghi danh không đổi.", pw="Không")
    A(F, "PATCH cộng đồng chưa tham gia -> 404; PATCH hợp lệ {sidebarVisible:false, pinned:true} -> 200 và chỉ ảnh hưởng chính mình", "Chức năng", "Cao", APIM + JOIN,
      ["PATCH /me/communities/cooking (chưa tham gia)", "PATCH /me/communities/photo {sidebarVisible:false,pinned:true}", "Người khác cùng tham gia photo GET /me/communities"], "-", "404; 200 hàng có sidebarVisible=false,pinned=true; người khác vẫn pinned=false.", pw="Không")
    A(F, "PUT /me/communities/order: 400 khi ids rỗng / trùng / có id không tham gia", "Chức năng", "Trung bình", APIM + JOIN, ["PUT {ids:[]}", "PUT {ids:['photo','photo']}", "PUT {ids:['photo','khong-co']}"], "-", "Cả ba 400.", pw="Không")
    A(F, "PUT order lưu thứ tự; chỉ gửi một phần thì phần còn lại xếp sau giữ thứ tự cũ; ghim luôn đứng đầu", "Chức năng", "Cao", APIM + JOIN + " Tham gia thêm 2 cộng đồng g1, g2.", ["PUT {ids:[g2,'photo',g1]} và GET", "PUT {ids:[g1]} và GET", "PATCH photo pinned=true và GET", "PATCH photo pinned=false và GET"], "-", "[g2,photo,g1] -> [g1,g2,photo] -> [photo,g1,g2] -> [g1,g2,photo]; response order trả {ids} đầy đủ.", pw="Không")
    A(F, "DELETE /me/communities/:id: thành viên -> 200 {left:true}; gọi lại -> 404; owner -> 409; sau khi rời không còn trong GET", "Chức năng", "Cao", APIM + " Owner O tạo cộng đồng C; thành viên M tham gia C.", ["M DELETE /me/communities/C", "M DELETE lần nữa", "O DELETE /me/communities/C", "GET /me/communities của O"], "-", "200 {left:true}; 404; 409 (owner không rời được); C vẫn có trong danh sách của O.", pw="Không")
    A(F, "DELETE /me/communities/:id KHÔNG bao giờ 'tham gia nhầm' như POST /courses/:id/enroll (gọi khi chưa tham gia -> 404, không tạo ghi danh)", "Bảo mật", "Trung bình", APIM, ["DELETE /me/communities/photo khi chưa tham gia", "GET /me/communities"], "-", "404; không có hàng photo mới.", pw="Không")
    A(F, "Rời cộng đồng có gói trả phí: paymentsService.onMemberLeft hủy cuối kỳ (cancelAtPeriodEnd=true), vẫn truy cập tới hết kỳ", "Chức năng", "Cao", APIM + " Cộng đồng có phí $7/tháng (tạo bằng POST /communities priceUsd=7) và người mua đã thanh toán.", ["DELETE /me/communities/<id>", "GET /me/subscriptions"], "-", "Gói còn 'active' với cancelAtPeriodEnd=true; GET /courses/<id> vẫn cho nội dung tới currentPeriodEnd.", pw="Không")
    A(F, "Người bị cấm không còn thấy / sửa được cộng đồng đó (PATCH/DELETE -> 404, không có trong GET)", "Bảo mật", "Trung bình", APIM, ["Owner ban thành viên M", "M GET /me/communities", "M PATCH /me/communities/<id> {pinned:true}"], "-", "Cộng đồng biến khỏi danh sách; PATCH 404.", pw="Không")
    A(F, "IDOR: PATCH/DELETE cộng đồng RIÊNG TƯ mình không là thành viên trả 404 giống cộng đồng không tồn tại (không lộ tồn tại)", "Bảo mật", "Cao", APIM, ["PATCH /me/communities/private-demo {pinned:true}", "PATCH /me/communities/khong-ton-tai {pinned:true}"], "-", "Cả hai 404 cùng body.", pw="Không")
    F = "API - /me/join-requests"
    A(F, "GET /me/join-requests: mặc định {requests:[], invites:[]}; sau khi gửi yêu cầu: requests[0] = {id,communityId,title,logoUrl,thumbnail,createdAt}", "Chức năng", "Cao", APIM + " Cộng đồng riêng tư P (do người khác tạo).", ["GET (rỗng)", "POST /courses/P/join-requests {message:'cho em vào'} (201)", "GET lại"], "-", "Lần 1: {requests:[],invites:[]}; lần 3: 1 phần tử với communityId=P và title đúng; invites luôn [].", pw="Không")
    A(F, "Người khác không thấy yêu cầu của mình; DELETE /join-requests/:id của người khác -> 404, của mình -> 200 rồi biến khỏi danh sách", "Bảo mật", "Cao", APIM, ["U gửi yêu cầu", "X GET /me/join-requests", "X DELETE /join-requests/<id của U>", "U DELETE /join-requests/<id>"], "-", "X thấy requests [], DELETE của X 404, DELETE của U 200; U GET lại rỗng.", pw="Không")

    F = "Điểm chưa làm / khác biệt UI-docs-code"
    A(F, "Nhãn vai trò chủ cộng đồng không nhất quán giữa các tab: 'Chủ sở hữu' (Cộng đồng của tôi) và 'Chủ cộng đồng' (Thông báo)", "Giao diện", "Thấp", BASE + " Đăng nhập owner@sofinhub.test.", ["So sánh nhãn vai trò owner ở /settings/cong-dong và bảng /settings/thong-bao"], "owner@", "HIỆN TẠI: tab Cộng đồng của tôi dùng roleText ('Chủ sở hữu'), tab Thông báo dùng ROLE_LABEL ('Chủ cộng đồng'). KỲ VỌNG: dùng một nhãn thống nhất (mockup: 'Chủ sở hữu').", st=PLAN, pw="Một phần")
    A(F, "Mod/Quản trị viên (không phải owner) nằm trong 'Tôi quản lý' nhưng chỉ có nút 'Mở', không có 'Cài đặt cộng đồng'", "Chức năng", "Thấp", BASE + " Đăng nhập cadmin@ (admin của photo).", ["Mở tab, xem hàng 'photo'"], "cadmin", "HIỆN TẠI: isManager gồm admin/mod nhưng nút bánh răng chỉ cho owner. Ghi nhận để PO chốt có cho admin vào 'Cài đặt cộng đồng' từ đây không.", st=PLAN, pw="Một phần")
    A(F, "Liên kết tiêu đề ở 'Đang chờ' trỏ /courses/<id> (đường cũ) rồi redirect sang /communities/<id>", "Chức năng", "Thấp", BASE + " " + NEWU, ["Gửi yêu cầu vào cộng đồng riêng tư", "Bấm tên cộng đồng ở 'Đang chờ'"], "-", "LegacyCourseRedirect chuyển /courses/<id> -> /communities/<id>; trang tải bình thường (không 404).", pw="Một phần")

# ====================================================================================================================
#                                  MODULE SETB - Thanh toán
# ====================================================================================================================
CARDS = [("4242 4242 4242 4242", "Visa", "VISA", "4242", "123"), ("5555 5555 5555 4444", "Mastercard", "MC", "4444", "123"), ("3782 822463 10005", "Amex", "AMEX", "0005", "1234"),
         ("6011 1111 1111 1117", "Discover", "DISC", "1117", "123"), ("3530 1113 3330 0000", "JCB", "JCB", "0000", "123")]


def load_setb(add):
    A = _mk(add, "SETB", "Cài đặt - Thanh toán")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + " (có gói thành viên ở paid-demo; xem sheet Tài khoản) rồi mở /settings/thanh-toan."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó, mở /settings/thanh-toan."
    UIM = UINEW + " " + MUTATE
    PAID = (" Cộng đồng có phí để mua gói: 'paid-demo' ($19/tháng) hoặc 'annual-demo' ($7/tháng + $48/năm, thử 7 ngày); mua ở /communities/<id>/checkout bằng thẻ test 4242 4242 4242 4242, hạn tương lai, CVC 123.")

    F = "Bố cục & trạng thái trống"
    A(F, "Tab Thanh toán đối chiếu mockup: thẻ 'Phương thức thanh toán' + thẻ tối 'Lần trừ tiền tiếp theo', 'Gói thành viên của tôi', 'Lịch sử thanh toán'", "Giao diện", "Cao", UI + " " + WEIRD,
      ["Mở /settings/thanh-toan", "So sánh 4 khối với template.html"], "-",
      "Hàng 1 (>= 1180px hai cột 1.15fr/1fr, hẹp hơn xếp dọc): 'Phương thức thanh toán' ('Quản lý thẻ thanh toán của bạn.') và thẻ tối gradient xanh rêu 'Lần trừ tiền tiếp theo' (số tiền 38px, ngày · tên cộng đồng, đường kẻ, 'Tổng mỗi tháng'). Hàng 2 'Gói thành viên của tôi' ('Danh sách các cộng đồng bạn đang tham gia.'). Hàng 3 'Lịch sử thanh toán' ('Xem lại các giao dịch thanh toán của bạn.') với nút 'Tải tất cả (CSV)'.")
    A(F, "Tài khoản mới (không thẻ/gói/giao dịch): ba trạng thái trống đúng chữ, thẻ tối $0.00", "Giao diện", "Cao", UIM, ["Mở /settings/thanh-toan"], "-",
      "Thẻ: 'Bạn chưa lưu thẻ nào. Thêm thẻ để gia hạn gói thành viên tự động.'; thẻ tối: '$0.00', 'Không có gói nào đang hoạt động', 'Tổng mỗi tháng' = $0.00; gói: 'Bạn chưa có gói thành viên trả phí hoặc dùng thử nào.'; lịch sử: 'Chưa có giao dịch nào.' (nút 'Cập nhật thẻ' xanh bị vô hiệu).")
    A(F, "Trạng thái 'Đang tải…' và lỗi (role=alert) ở từng khối khi API lỗi", "Giao diện", "Thấp", UI, ["Chặn lần lượt /me/payment-methods, /me/billing-summary, /me/subscriptions, /me/payments rồi F5"], "-", "Mỗi khối tự hiện lỗi riêng ('Đã có lỗi xảy ra, vui lòng thử lại' hoặc message API), các khối khác vẫn chạy.", pw="Một phần")

    F = "Thẻ thanh toán - danh sách & menu"
    A(F, "Hàng thẻ: ô thương hiệu 74x54, '•••• <4 số cuối>', 'Hết hạn MM/YY', nhãn xanh 'Mặc định' cho thẻ mặc định", "Giao diện", "Cao", UIM + " Đã thêm 2 thẻ (Visa 4242 rồi Mastercard 4444).", ["Quan sát danh sách thẻ"], "-", "Thẻ đầu tiên (Visa) là 'Mặc định' và đứng đầu; thẻ sau không đổi mặc định; ô thương hiệu hiển thị chữ nghiêng đậm (VISA/MC/AMEX/DISC/JCB/UP/DC, loại khác 'CARD').")
    A(F, "Thẻ đã hết hạn: dòng chữ đỏ đậm 'Đã hết hạn MM/YY'", "Giao diện", "Thấp", UIM + " " + SQL + " Ép hạn quá khứ: UPDATE \"PaymentCard\" SET \"expYear\"=2024 WHERE last4='4242' AND \"userId\"='<id>';", ["Mở tab sau khi ép hạn"], "exp 2024", "Hàng hiển thị 'Đã hết hạn 12/24' màu đỏ #dc2626 thay vì 'Hết hạn …'.", pw="Một phần")
    A(F, "Menu ⋯ (aria-label 'Tùy chọn thẻ <4 số>'): thẻ không mặc định có 'Đặt làm mặc định', 'Cập nhật thẻ', 'Xóa thẻ'; thẻ mặc định KHÔNG có 'Đặt làm mặc định'", "Chức năng", "Cao", UIM + " Đã có 2 thẻ.", ["Mở ⋯ của thẻ mặc định", "Mở ⋯ của thẻ còn lại"], "-", "Mặc định: 2 mục (Cập nhật thẻ, Xóa thẻ đỏ); thẻ khác: 3 mục. 'Xóa thẻ' luôn có (mockup ẩn khi chỉ còn 1 thẻ - xem case Kế hoạch).")
    A(F, "'Đặt làm mặc định': toast 'Đã đặt thẻ •••• <4 số> làm mặc định', thẻ đó lên đầu + nhãn 'Mặc định'; gói đang gia hạn chuyển sang thẻ này", "Chức năng", "Cao", UIM + PAID + " Đã có 2 thẻ và 1 gói đang chạy.", ["Chọn 'Đặt làm mặc định' ở thẻ thứ hai", "F5"], "-", "Toast thành công; thứ tự thẻ đảo; PATCH /me/payment-methods/<id>/default trả mảng đã sắp xếp; subscription.paymentCardId = thẻ mới (kiểm tra SQL hoặc API).", pw="Một phần")
    A(F, "Nút 'Cập nhật thẻ' (xanh, cạnh 'Thêm thẻ') mở modal cập nhật cho THẺ MẶC ĐỊNH", "Chức năng", "Trung bình", UIM + " Đã có 2 thẻ.", ["Bấm 'Cập nhật thẻ' ở dưới danh sách"], "-", "Modal 'Cập nhật thẻ mặc định'; menu ⋯ của thẻ khác mở 'Cập nhật thẻ •••• <4 số>'.")

    F = "Thẻ thanh toán - thêm / cập nhật (modal)"
    A(F, "Modal 'Thêm thẻ mới': tiêu đề, lời nhắn bảo mật, 3 ô và placeholder, CTA 'Thêm thẻ'", "Giao diện", "Cao", UIM, ["Bấm 'Thêm thẻ'"], "-", "Tiêu đề 'Thêm thẻ mới', mô tả 'Thông tin thẻ được mã hóa và lưu an toàn.', ô 'Số thẻ' (1234 1234 1234 1234, autofocus), 'Hết hạn' (MM/YY), 'CVC' (123), nút Hủy + 'Thêm thẻ'. Esc/nền/Hủy đóng modal.")
    for num, brand, tile, last4, cvc in [CARDS[0], CARDS[1], CARDS[2]]:
        A(F, f"Thêm thẻ {brand} {num} -> toast 'Đã thêm thẻ •••• {last4}', ô thương hiệu '{tile}'", "Chức năng", "Cao" if brand in ("Visa", "Mastercard") else "Trung bình", UIM, [f"Bấm 'Thêm thẻ'", f"Số thẻ {num}, hết hạn 12/29, CVC {cvc}", "Bấm 'Thêm thẻ'"], num,
          f"Số thẻ được tự nhóm ({'4-6-5' if brand == 'Amex' else '4-4-4-4'}); thành công: toast 'Đã thêm thẻ •••• {last4}', hàng mới '{tile}'; thẻ đầu tiên là Mặc định, thẻ sau không. Payload POST /me/payment-methods CHỈ có {{token:'tok_mock_<hex>', brand, last4, expMonth, expYear}} - KHÔNG có số thẻ/ CVC." + (" CVC Amex 4 số." if brand == "Amex" else ""))
    A(F, "Thêm thẻ Discover 6011 1111 1111 1117 và JCB 3530 1113 3330 0000 -> ô thương hiệu 'DISC' và 'JCB'", "Chức năng", "Thấp", UIM, ["Thêm lần lượt 2 thẻ, hạn 12/29, CVC 123"], "Discover | JCB", "Toast 'Đã thêm thẻ •••• 1117' / '•••• 0000'; ô thương hiệu 'DISC' (cam) và 'JCB' (xanh lá).")
    A(F, "Thêm thẻ: lỗi số thẻ ở client - trống 'Vui lòng nhập số thẻ', thiếu số '4242 4242 42' 'Số thẻ chưa đủ chữ số', sai Luhn '4242 4242 4242 4241' 'Số thẻ không hợp lệ'", "Chức năng", "Trung bình", UIM,
      ["Mở 'Thêm thẻ'", "Lần lượt nhập 3 số thẻ trên (hạn 12/29, CVC 123) và bấm 'Thêm thẻ'"], "'' | 4242 4242 42 | 4242 4242 4242 4241", "Lỗi đỏ tương ứng dưới ô, Network không có POST /me/payment-methods. Gõ lại thì lỗi xóa.")
    A(F, "Thêm thẻ: lỗi hạn ở client - trống 'Nhập ngày hết hạn', '13/29' 'Ngày hết hạn không hợp lệ (MM / YY)', '01/20' 'Thẻ đã hết hạn', '12/60' (> 20 năm) 'Ngày hết hạn không hợp lệ'", "Chức năng", "Trung bình", UIM,
      ["Nhập số thẻ 4242 4242 4242 4242, CVC 123", "Lần lượt nhập 4 hạn trên và bấm 'Thêm thẻ'"], "'' | 13/29 | 01/20 | 12/60", "Lỗi đỏ tương ứng; không gọi API.")
    A(F, "Thêm thẻ: CVC trống -> 'Nhập mã CVC'; ưu tiên hiển thị lỗi số thẻ -> hạn -> CVC khi nhiều lỗi", "Chức năng", "Thấp", UIM,
      ["Nhập số thẻ hợp lệ, hạn 12/29, CVC trống", "Xóa cả số thẻ và hạn rồi bấm lại"], "CVC ''", "Lần 1: 'Nhập mã CVC'; lần 2: chỉ báo lỗi đầu tiên theo thứ tự số thẻ -> hạn -> CVC ('Vui lòng nhập số thẻ').")
    A(F, "CVC Amex thiếu (3 số) / CVC thường 4 số -> lỗi CVC theo hãng (Amex 4 số, còn lại 3 số)", "Chức năng", "Thấp", UIM, ["Nhập Amex 3782 822463 10005, hạn tương lai, CVC 123", "Nhập Visa 4242…, CVC 1234"], "-", "Amex với 3 số: lỗi CVC; Visa với 4 số: lỗi CVC (hoặc ô giới hạn 3 số theo hãng). Không gọi API khi lỗi.", pw="Một phần")
    A(F, "Ô hạn tự thêm '/' khi gõ (1229 -> 12/29), ô CVC chỉ nhận số tối đa 4, ô số thẻ bỏ ký tự chữ", "Chức năng", "Thấp", UIM, ["Gõ '1229' vào Hết hạn", "Gõ 'ab12' vào CVC", "Gõ '4242abcd4242' vào Số thẻ"], "-", "Hạn '12/29'; CVC '12'; số thẻ '4242 4242 42'.")
    A(F, "Thêm lại đúng thẻ đã có (cùng brand + 4 số cuối + hạn): lỗi 409 CARD_EXISTS hiển thị trong modal, không tạo thẻ trùng", "Chức năng", "Cao", UIM, ["Thêm Visa 4242 hạn 12/29", "Thêm lại đúng thẻ đó"], "-", "Lỗi từ API trong modal (thẻ đã tồn tại); danh sách vẫn 1 thẻ. (Mỗi lần FE tạo token mock mới nên trùng được phát hiện theo brand+4 số+hạn.)")
    A(F, "Thẻ thứ 11: bị chặn bởi giới hạn 10 thẻ (400 CARD_LIMIT) với thông báo trong modal", "Chức năng", "Trung bình", UIM + " Đã thêm 10 thẻ khác nhau (đổi 4 số cuối/hạn).", ["Thêm thẻ thứ 11"], "11 thẻ", "Lỗi 400 CARD_LIMIT hiển thị trong modal; vẫn 10 thẻ.", pw="Một phần")
    A(F, "Cập nhật thẻ: giữ id, vị trí mặc định và gói đang gắn; toast 'Đã cập nhật thẻ'; hạn quá khứ bị từ chối", "Chức năng", "Cao", UIM + PAID, ["Mua gói bằng Visa 4242", "Cập nhật thẻ mặc định sang Amex 3782…0005 hạn 03/(năm+4)", "Cập nhật lại bằng hạn quá khứ"], "-", "Lần 1: toast 'Đã cập nhật thẻ', hàng đổi thành AMEX •••• 0005 vẫn 'Mặc định', gói vẫn trỏ cùng thẻ (id không đổi). Lần 2: 'Thẻ đã hết hạn' (client).", pw="Một phần")
    A(F, "Bảo mật dữ liệu thẻ: số thẻ + CVC chỉ nằm trong state modal; DevTools Network/Storage/log không chứa PAN/CVC", "Bảo mật", "Cao", UIM, ["Mở DevTools Network + Application", "Thêm thẻ 4242 4242 4242 4242 CVC 123", "Tìm chuỗi số thẻ/ CVC trong request body, localStorage, sessionStorage, console"], "4242…", "Chỉ token tok_mock_<hex> + brand + last4 + hạn được gửi; không PAN/CVC ở bất kỳ đâu; đóng modal xóa state.")

    F = "Thẻ thanh toán - xóa"
    A(F, "Xóa thẻ không dùng: modal 'Xóa thẻ •••• <4 số>?' + giải thích + CTA 'Xóa thẻ' (đỏ); toast 'Đã xóa thẻ •••• <4 số>'", "Chức năng", "Cao", UIM + " Đã có 2 thẻ, chưa gói.", ["Bấm ⋯ -> 'Xóa thẻ' ở thẻ không mặc định", "Đọc modal", "Xác nhận"], "-", "Body: 'Thẻ sẽ bị gỡ khỏi tài khoản. Gói đang dùng thẻ này (nếu có) sẽ chuyển sang thẻ mặc định còn lại; nếu đây là thẻ duy nhất của một gói đang chạy, bạn cần thêm thẻ khác trước.'; sau xác nhận thẻ biến mất + toast.")
    A(F, "Xóa thẻ MẶC ĐỊNH khi còn thẻ khác: thẻ còn lại thành mặc định, gói chuyển sang thẻ còn lại", "Chức năng", "Cao", UIM + PAID, ["Mua gói bằng Visa 4242", "Thêm Mastercard 4444", "Xóa Visa 4242"], "-", "Còn Mastercard với nhãn 'Mặc định'; subscription.paymentCardId = thẻ Mastercard; lịch sử thanh toán vẫn giữ nguyên.", pw="Một phần")
    A(F, "Xóa thẻ DUY NHẤT đang gắn gói đang chạy -> 409 CARD_IN_USE hiển thị trong modal, thẻ vẫn còn", "Chức năng", "Cao", UIM + PAID, ["Mua gói bằng một thẻ duy nhất", "Xóa thẻ đó"], "-", "Lỗi trong modal từ API (thẻ đang cần cho gói; thêm thẻ khác hoặc hủy gói trước); thẻ còn trong danh sách.")
    A(F, "Gói đã đặt 'hủy cuối kỳ' không cần thẻ: xóa được thẻ duy nhất", "Chức năng", "Trung bình", UIM + PAID, ["Mua gói, Quản lý -> Hủy gói", "Xóa thẻ duy nhất"], "-", "Xóa thành công, danh sách thẻ rỗng, gói vẫn 'Đã hủy' dùng được tới hết kỳ.", pw="Một phần")

    F = "Lần trừ tiền tiếp theo & tổng mỗi tháng"
    A(F, "1 gói tháng $7: thẻ tối hiện '$7.00', 'Ngày dd/MM/yyyy · <tên cộng đồng>', 'Tổng mỗi tháng $7.00'", "Chức năng", "Cao", UIM + PAID, ["Mua gói tháng $7/tháng", "Mở tab Thanh toán"], "$7", "Số tiền '$7.00' (formatCents USD, không đổi sang VND), ngày = currentPeriodEnd (dd/MM/yyyy), tổng '$7.00'. API GET /me/billing-summary khớp.")
    A(F, "Gói năm $48 tính /12 vào 'Tổng mỗi tháng': tháng $7 + năm $48 -> $11.00; 'Lần trừ tiếp theo' là gói đến hạn sớm nhất ($7.00)", "Chức năng", "Cao", UIM + PAID + " Mua 2 gói: tháng $7 và năm $48 (hai cộng đồng khác nhau).", ["Mua gói tháng và gói năm", "Mở tab Thanh toán"], "700 + 400", "'Tổng mỗi tháng' = $11.00 (700 + 48x100/12=400); thẻ tối: $7.00 vì kỳ tháng hết sớm hơn kỳ năm; billing-summary.activeCount = 2.")
    A(F, "Gói đang dùng thử: lần trừ đầu là lúc hết dùng thử, dòng có hậu tố ' (hết dùng thử)'", "Chức năng", "Trung bình", UIM + PAID, ["Bắt đầu dùng thử 7 ngày ở annual-demo (có thẻ)", "Mở tab Thanh toán"], "-", "Dòng 'Ngày <ngày hết thử> · <tên cộng đồng> (hết dùng thử)', số tiền bằng giá kỳ đầu; summary.next.trialing=true.", pw="Một phần")
    A(F, "Gói đã đặt hủy cuối kỳ bị loại khỏi 'Lần trừ tiếp theo' và 'Tổng mỗi tháng'", "Chức năng", "Trung bình", UIM + PAID, ["Mua gói, hủy cuối kỳ", "Mở tab"], "-", "Thẻ tối về '$0.00' + 'Không có gói nào đang hoạt động'; Tổng $0.00.", pw="Một phần")

    F = "Gói thành viên của tôi"
    A(F, "Hàng gói: logo, tên cộng đồng, dòng giá/ngày, nhãn trạng thái, nút 'Quản lý', mũi tên sang cộng đồng", "Giao diện", "Cao", UI, ["Quan sát danh sách gói của member1@"], "member1", "Gói đang hoạt động/dùng thử xếp trước; mỗi hàng có chip trạng thái; chevron (aria 'Mở cộng đồng <tên>') -> /communities/<id>/community với gói sống, /communities/<id> với gói đã kết thúc.")
    A(F, "Trạng thái gói & dòng mô tả: active 'Đang hoạt động' (xanh) '$7.00 / tháng · Gia hạn dd/MM/yyyy'; trialing 'Đang dùng thử' (vàng) 'Dùng thử · trừ $7.00 ngày dd/MM/yyyy'; hủy cuối kỳ 'Đã hủy' (xám) '… · Hết hạn dd/MM/yyyy'", "Chức năng", "Cao", UIM + PAID,
      ["Mua gói tháng; mở tab", "Bắt đầu dùng thử ở cộng đồng khác; mở tab", "Hủy cuối kỳ gói đầu; mở tab"], "3 trạng thái", "Chip và dòng đúng theo từng trạng thái; gói năm hiển thị '/ năm'; gói sống xếp trước gói đã kết thúc.", pw="Một phần")
    A(F, "Trạng thái gói kết thúc: canceled 'Đã hủy', expired 'Hết hạn' (xám), past_due 'Quá hạn' / paused 'Tạm dừng' (vàng); dòng '… · Kết thúc dd/MM/yyyy'", "Chức năng", "Trung bình", UIM + PAID + " " + SQL,
      ["Hủy ngay một gói (canceled)", "UPDATE \"Subscription\" SET status='expired' / 'past_due' / 'paused' cho 3 gói khác", "Mở tab"], "canceled | expired | past_due | paused", "Chip và màu đúng từng trạng thái; mô tả '$7.00 / tháng · Kết thúc <ngày>'.", pw="Không")
    A(F, "Modal 'Quản lý' gói đang hoạt động: mô tả 'Gói $X / tháng, gia hạn <ngày>…', checkbox 'Hủy ngay', nút 'Hủy gói' (đỏ)", "Chức năng", "Cao", UIM + PAID, ["Bấm 'Quản lý' ở gói active", "Đọc modal"], "-", "Tiêu đề = tên cộng đồng; body 'Gói $7.00 / tháng, gia hạn <dd/MM/yyyy>. Hủy gói thì bạn vẫn dùng được tới ngày gia hạn.'; hộp 'Hủy ngay' ('Mất quyền truy cập cộng đồng lập tức, thay vì tới hết kỳ.'); nút Đóng + 'Hủy gói'.")
    A(F, "Hủy gói cuối kỳ: toast 'Đã hủy gói · <tên>', chip 'Đã hủy' + 'Hết hạn <ngày>', vẫn truy cập cộng đồng tới ngày đó", "Chức năng", "Cao", UIM + PAID, ["Quản lý -> Hủy gói (không tích 'Hủy ngay')", "Mở cộng đồng"], "-", "POST /courses/<id>/subscription/cancel {atPeriodEnd:true}; chip xám 'Đã hủy'; vẫn vào được cộng đồng; không trừ kỳ sau.")
    A(F, "Hủy NGAY (tích 'Hủy ngay'): nút đổi 'Hủy gói ngay'; mất quyền truy cập lập tức", "Chức năng", "Cao", UIM + PAID, ["Quản lý -> tích 'Hủy ngay' -> 'Hủy gói ngay'", "Mở cộng đồng"], "-", "atPeriodEnd=false; gói 'canceled'; cộng đồng yêu cầu thanh toán lại / bị khóa nội dung.")
    A(F, "Kích hoạt lại gói đã hủy cuối kỳ: modal 'Gói đã hủy. Bạn vẫn dùng được tới <ngày>.' + nút 'Kích hoạt lại'; toast 'Đã kích hoạt lại · <tên>'", "Chức năng", "Cao", UIM + PAID, ["Hủy cuối kỳ", "Quản lý -> 'Kích hoạt lại'"], "-", "POST …/subscription/resume 200; chip về 'Đang hoạt động'; hết kỳ vẫn tự gia hạn.")
    A(F, "Gói đã kết thúc: modal 'Gói đã kết thúc… Hãy tham gia lại từ trang cộng đồng nếu muốn tiếp tục.' chỉ có nút 'Xong'", "Chức năng", "Thấp", UIM + PAID, ["Hủy ngay một gói", "Quản lý"], "-", "Không có nút hủy/kích hoạt; hết hạn do expired thêm 'do hết hạn'.", pw="Một phần")
    A(F, "Lỗi từ API khi hủy/ kích hoạt hiển thị trong modal; modal không đóng", "Chức năng", "Thấp", UIM + PAID, ["Tắt backend rồi bấm 'Hủy gói'"], "offline", "Lỗi 'Đã có lỗi xảy ra, vui lòng thử lại' hoặc message API trong modal.", pw="Một phần")

    F = "Lịch sử thanh toán, hóa đơn, CSV"
    A(F, "Bảng lịch sử: cột Ngày | Mô tả | Số tiền | Trạng thái | Hóa đơn; dòng '<cộng đồng> · Thanh toán đầu|Gia hạn[ · gói năm]'", "Chức năng", "Cao", UIM + PAID, ["Mua gói tháng, rồi gói năm", "Mở bảng"], "-", "Hai dòng: '<tên> · Thanh toán đầu' và '<tên> · Thanh toán đầu · gói năm'; ngày dd/MM/yyyy (confirmedAt); số tiền $7.00 / $48.00; trạng thái 'Đã thanh toán' (chấm xanh).")
    A(F, "Trạng thái giao dịch hiển thị đúng: succeeded 'Đã thanh toán' (xanh), pending 'Đang chờ' (vàng), failed 'Thất bại' (đỏ), refunded 'Đã hoàn tiền' (xám)", "Giao diện", "Thấp", UIM + PAID + " " + SQL,
      ["Tạo giao dịch ở 4 trạng thái (mua thành công; checkout không xác nhận; thẻ bị từ chối; hoàn tiền)", "Mở bảng lịch sử"], "4 trạng thái", "Mỗi dòng có chữ và chấm màu tương ứng.", pw="Một phần")
    A(F, "Giao dịch đã hoàn một phần/ toàn bộ: dòng nhỏ đỏ 'Đã hoàn $X' dưới số tiền", "Chức năng", "Trung bình", UIM + PAID, ["Yêu cầu hoàn tiền được duyệt", "Xem dòng giao dịch"], "-", "Dưới số tiền hiện 'Đã hoàn $7.00' (đỏ) và trạng thái 'Đã hoàn tiền'.", pw="Một phần")
    A(F, "Giao dịch có yêu cầu hoàn tiền chờ duyệt/ bị từ chối: ghi chú 'Hoàn tiền: chờ duyệt' / 'Hoàn tiền: bị từ chối' dưới trạng thái", "Chức năng", "Trung bình", UIM + PAID, ["Gửi yêu cầu hoàn tiền ngoài cửa sổ hoàn tiền (chờ admin)", "Admin từ chối ở /admin > Thanh toán > Hoàn tiền"], "-", "Dòng giao dịch hiện 'Hoàn tiền: chờ duyệt' rồi 'Hoàn tiền: bị từ chối' (lấy từ refundStatus của /me/payments, không còn localStorage).", pw="Không")
    A(F, "Cột 'Hóa đơn': link 'Hóa đơn' mở hộp thoại hóa đơn thật; giao dịch chưa có số hóa đơn hiển thị '—'", "Chức năng", "Cao", UIM + PAID, ["Bấm 'Hóa đơn' ở giao dịch thành công", "Quan sát giao dịch pending/failed"], "-", "Hộp thoại hóa đơn: số INV-2026-xxxxxx, ngày phát hành, người mua, cộng đồng, hạng mục, tạm tính, đã hoàn, tổng; giao dịch chưa có hóa đơn: '—'.")
    A(F, "Phân trang lịch sử: Pager hiển thị khi > 1 trang; chuyển trang giữ nguyên các khối khác", "Chức năng", "Thấp", UI + " Tài khoản có nhiều giao dịch (> 1 trang) hoặc dùng limit nhỏ.", ["Bấm trang 2 và quay lại"], "-", "Danh sách đổi theo trang (GET /me/payments?page=2), không cuộn nhảy; một trang thì không hiện Pager.", pw="Một phần")
    A(F, "'Tải tất cả (CSV)': file lich-su-thanh-toan.csv, BOM UTF-8, tiêu đề tiếng Việt, số tiền USD 2 chữ số, toast 'Đã tải lịch sử thanh toán'", "Chức năng", "Cao", UIM + PAID, ["Mua 2 gói", "Bấm 'Tải tất cả (CSV)'", "Mở file bằng Excel và trình soạn thảo"], "-", "Nút 'Đang tạo…' khi chạy; file có dòng đầu \"Ngày\",\"Mô tả\",\"Số tiền (USD)\",\"Đã hoàn (USD)\",\"Trạng thái\",\"Số hóa đơn\"; mỗi giao dịch 1 dòng (7.00, 48.00; Đã hoàn 0.00); tiếng Việt hiển thị đúng trong Excel (BOM); dấu \" trong mô tả được nhân đôi.")
    A(F, "CSV khi chưa có giao dịch: toast lỗi 'Chưa có giao dịch nào để tải' và không tải file", "Chức năng", "Thấp", UIM, ["Bấm 'Tải tất cả (CSV)' ở tài khoản chưa có giao dịch"], "-", "Toast lỗi nêu trên; không tạo file.")
    A(F, "CSV gom tối đa 20 trang x 100 = 2.000 giao dịch (tài khoản nhiều hơn bị cắt)", "Chức năng", "Thấp", UIM + " Tài khoản có > 2.000 giao dịch (tạo bằng script).", ["Bấm 'Tải tất cả (CSV)'"], "2.001 giao dịch", "HIỆN TẠI: file chỉ chứa 2.000 giao dịch mới nhất, không cảnh báo bị cắt. KỲ VỌNG: xuất đủ hoặc cảnh báo.", st=PLAN, pw="Không")

    F = "Hoàn tiền (chuyển từ trang /billing cũ)"
    A(F, "Quản lý gói -> 'Yêu cầu hoàn tiền' (giao dịch gần nhất còn hoàn được) mở modal: lý do tối thiểu 3 ký tự, tối đa 500, nút 'Gửi yêu cầu'", "Chức năng", "Cao", UIM + PAID, ["Mua gói", "Quản lý -> 'Yêu cầu hoàn tiền'", "Nhập 'ab' rồi 'abc'"], "-", "Dòng 'Giao dịch gần nhất $7.00' + link 'Yêu cầu hoàn tiền'; modal 'Yêu cầu hoàn tiền' có textarea 'Lý do hoàn tiền…'; 'Gửi yêu cầu' bị vô hiệu khi < 3 ký tự (trim).")
    A(F, "Hoàn tiền TRONG cửa sổ 7 ngày: tự duyệt - thông báo 'Yêu cầu đã được duyệt tự động (trong thời hạn hoàn tiền). Khoản tiền sẽ được hoàn lại.'; giao dịch 'Đã hoàn tiền'; quyền truy cập thu hồi", "Chức năng", "Cao", UIM + PAID + " " + DEC + " Cửa sổ hoàn tiền 7 ngày là giá trị TẠM (REFUND_WINDOW_DAYS).", ["Gửi yêu cầu hoàn tiền ngay sau khi mua với lý do 'đổi ý rồi'"], "đổi ý rồi", "201 RefundRequest status 'approved'; thông báo xanh như trên; giao dịch 'Đã hoàn tiền', 'Đã hoàn $7.00'; hoa hồng giới thiệu pending của giao dịch (nếu có) chuyển 'void'.", pw="Một phần")
    A(F, "Hoàn tiền NGOÀI cửa sổ: chờ admin duyệt - thông báo 'Yêu cầu đã được gửi và đang chờ quản trị viên nền tảng duyệt.'", "Chức năng", "Cao", UIM + PAID + " " + DEC + " " + SQL + " Lùi ngày thanh toán >7 ngày: UPDATE \"PaymentIntent\" SET \"confirmedAt\"=now()-interval '10 days', \"createdAt\"=now()-interval '10 days' WHERE id='<id>';", ["Gửi yêu cầu hoàn tiền sau khi lùi ngày"], "-", "status 'pending'; thông báo vàng như trên; ở Admin > Thanh toán > Hoàn tiền xuất hiện yêu cầu; sau khi lại mở Quản lý gói hiện 'Yêu cầu hoàn tiền đang chờ duyệt' (không còn link gửi lại).", pw="Không")
    A(F, "Mô tả trong modal hoàn tiền ghi cứng '7 ngày đầu kể từ lần thanh toán đầu của gói' dù cửa sổ có thể đổi", "Giao diện", "Thấp", UIM + PAID + " " + DEC, ["Đổi cài đặt hoàn tiền (nếu có ở Admin > Hệ thống > Cài đặt chung) sang 14 ngày", "Mở modal hoàn tiền"], "14 ngày", "HIỆN TẠI modal luôn nói '7 ngày đầu…' (chuỗi cứng trong RefundModal.tsx) trong khi BE đọc cửa sổ từ cấu hình. KỲ VỌNG: lấy số ngày từ server. Cửa sổ 7 ngày vẫn là giá trị tạm chờ chốt.", st=PLAN, pw="Không")
    A(F, "Hoàn tiền: không gửi lại được khi đã có yêu cầu (409) / giao dịch không phải của mình (403)", "Chức năng", "Trung bình", UIM + PAID, ["Gửi yêu cầu hoàn tiền lần 2 cho cùng giao dịch (API)", "Người khác gọi refund-request cho giao dịch của mình"], "-", "409 và 403 (xem API); UI chỉ hiện 'Yêu cầu hoàn tiền' khi chưa có refundStatus.", pw="Không")

    F = "Khác biệt so với mockup / điểm chưa làm"
    A(F, "Tiền tệ hiển thị USD ($7.00) trong khi mockup dùng VND (149.000đ) - chưa thống nhất 1 đơn vị tiền", "Giao diện", "Trung bình", UI + " " + DEC + " " + WEIRD, ["So sánh số tiền ở thẻ tối, gói, lịch sử với mockup"], "-", "HIỆN TẠI mọi số tiền gói thành viên theo USD (formatCents), gói hosting owner theo VND (A16); không quy đổi tỉ giá. KỲ VỌNG: PO chốt đơn vị (docs OPEN_DECISIONS A16).", st=PLAN, pw="Không")
    A(F, "Mockup ẩn 'Xóa thẻ' khi chỉ còn 1 thẻ; UI luôn hiển thị (server chặn bằng CARD_IN_USE khi thẻ còn cần)", "Giao diện", "Thấp", UIM + " Chỉ có 1 thẻ.", ["Mở ⋯ của thẻ duy nhất"], "1 thẻ", "HIỆN TẠI vẫn có 'Xóa thẻ'; nếu không có gói thì xóa được thẻ duy nhất. KỲ VỌNG theo mockup: ẩn khi chỉ còn 1 thẻ.", st=PLAN, pw="Một phần")
    A(F, "Ngày hiển thị dd/MM/yyyy (mockup ghi dd/MM); ô thương hiệu thẻ là chữ nghiêng, không logo ảnh", "Giao diện", "Thấp", UI + " " + WEIRD, ["Đối chiếu ngày và ô thương hiệu với mockup"], "-", "HIỆN TẠI: ngày đầy đủ năm, thương hiệu dạng chữ. KỲ VỌNG theo mockup: ngày ngắn và logo hãng. Ghi nhận để PO duyệt.", st=PLAN, pw="Không")
    A(F, "Hộp thoại Quản lý có thêm 'Hủy ngay' và 'Yêu cầu hoàn tiền' mà mockup không có (giữ năng lực của /billing cũ)", "Giao diện", "Thấp", UI + " " + WEIRD, ["Đối chiếu modal Quản lý với mockup"], "-", "Khác biệt chủ ý của thiết kế (docs 'Khác biệt so với mockup'); không phải lỗi.", pw="Không")

def load_setb_more(add):
    A = _mk(add, "SETB", "Cài đặt - Thanh toán")
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE
    CARD = "Body thẻ hợp lệ (PaymentMethodInput STRICT): {token:'tok_mock_<12 hex>', brand:'visa', last4:'4242', expMonth:12, expYear:<năm hiện tại + 3>}."
    PAID = " Cộng đồng có phí PC do owner khác tạo: POST /communities {title,description,category:'tech',priceUsd:7,priceAnnualUsd:48,visibility:'public'}; người mua checkout rồi confirm: POST /communities/PC/checkout {method:'stripe',paymentMethod:<thẻ>} -> POST /payments/<id>/confirm."

    F = "API - /me/payment-methods"
    A(F, "6 endpoint thẻ & tổng quan không token -> 401 (GET/POST/PUT/PATCH default/DELETE /me/payment-methods, GET /me/billing-summary)", "Bảo mật", "Cao", API, ["Gọi 6 endpoint không header Authorization"], "-", "401 cả sáu.", pw="Không")
    A(F, "POST thẻ đầu tiên -> 201 isDefault=true; thẻ thứ hai isDefault=false; response chỉ có {id,brand,last4,expMonth,expYear,createdAt,isDefault}, KHÔNG lộ token/PAN", "Chức năng", "Cao", APIM + " " + CARD,
      ["POST thẻ 4242 visa", "POST thẻ 1111 mastercard", "GET /me/payment-methods"], "-", "201 cả hai; keys đúng 7 khóa; list [[4242,true],[1111,false]]; chuỗi 'tok_' không xuất hiện trong response.", pw="Không")
    bad = [({"expYear": "<năm hiện tại - 1>"}, "thẻ hết hạn"), ({"number": "4242424242424242"}, "trường lạ 'number' (PAN)"), ({"cvc": "123"}, "trường lạ 'cvc'"), ({"token": "4242"}, "token sai định dạng"), ({"brand": "foo"}, "brand ngoài danh sách"), ({"last4": "42"}, "last4 không đủ 4 số"), ({"expMonth": 13}, "tháng 13")]
    A(F, "POST /me/payment-methods body sai -> 400: thẻ hết hạn (expYear năm trước), tháng 13, last4 'xx', token '4242', brand 'foo'", "Chức năng", "Trung bình", APIM + " " + CARD,
      ["Lấy body thẻ hợp lệ rồi đổi từng trường như trên, POST từng lần"], "5 body", "Cả 5 lần 400; GET danh sách vẫn rỗng.", pw="Không")
    A(F, "POST /me/payment-methods kèm trường lạ 'number' (PAN 4242424242424242) hoặc 'cvc' -> 400 (schema STRICT); server không bao giờ nhận số thẻ/CVC", "Bảo mật", "Cao", APIM + " " + CARD,
      ["Body thẻ hợp lệ + number:'4242424242424242'", "Body thẻ hợp lệ + cvc:'123'"], "number | cvc", "Cả 2 lần 400; không tạo thẻ; không log chứa PAN.", pw="Không")
    A(F, "POST trùng token HOẶC trùng brand+last4+hạn -> 409 CARD_EXISTS", "Chức năng", "Cao", APIM + " " + CARD, ["POST thẻ T", "POST lại với token T nhưng last4 khác", "POST cùng brand/last4/hạn nhưng token mới"], "-", "Cả hai 409 với error.code='CARD_EXISTS'.", pw="Không")
    A(F, "POST thẻ thứ 11 -> 400 CARD_LIMIT (tối đa 10 thẻ)", "Chức năng", "Trung bình", APIM + " " + CARD, ["POST 10 thẻ khác nhau (last4 2000..2009)", "POST thẻ thứ 11"], "11 thẻ", "10 lần 201; lần 11: 400 error.code='CARD_LIMIT'.", pw="Không")
    A(F, "PUT /me/payment-methods/:id thay thông tin thẻ: giữ id, vị trí mặc định và gói đang gắn; hạn quá khứ -> 400; id lạ -> 404; trùng thẻ khác -> 409", "Chức năng", "Cao", APIM + " " + CARD + PAID,
      ["Mua gói bằng thẻ 4242 (thẻ mặc định)", "PUT thẻ đó {brand:'amex', last4:'0005', expMonth:3, expYear:<năm+4>}", "PUT hạn quá khứ", "PUT id lạ", "PUT trùng thông tin thẻ khác"], "-", "200: cùng id, isDefault giữ nguyên, subscription.paymentCardId không đổi, last4 '0005', brand 'amex'; 400; 404; 409.", pw="Không")
    A(F, "PATCH /me/payment-methods/:id/default: trả mảng đã sắp xếp, đổi mặc định, gói đang sống chưa hủy chuyển sang thẻ mới; gọi lại idempotent", "Chức năng", "Cao", APIM + " " + CARD + PAID,
      ["Mua gói bằng thẻ 4242", "POST thẻ 5555 mastercard", "PATCH default thẻ 5555 (2 lần)"], "-", "Lần 1: [[5555,true],[4242,false]] và subscription.paymentCardId = id thẻ 5555; lần 2: vẫn 200 cùng kết quả.", pw="Không")
    A(F, "DELETE /me/payment-methods/:id: thẻ không dùng -> 200 trả danh sách còn lại; thẻ duy nhất đang gắn gói đang sống -> 409 CARD_IN_USE; có thẻ khác -> chuyển gói rồi xóa", "Chức năng", "Cao", APIM + " " + CARD + PAID,
      ["Mua gói bằng thẻ A (duy nhất)", "DELETE thẻ A", "POST thẻ B, DELETE thẻ A lần nữa", "GET /me/payments"], "-", "409 CARD_IN_USE (thẻ A còn); sau khi có thẻ B: 200 [[B,true]], subscription.paymentCardId = B; /me/payments vẫn giữ giao dịch cũ (FK SetNull, hóa đơn không mất).", pw="Không")
    A(F, "Gói đã đặt hủy cuối kỳ không cần thẻ: xóa thẻ duy nhất -> 200", "Chức năng", "Trung bình", APIM + " " + CARD + PAID, ["Mua gói", "POST /courses/PC/subscription/cancel {atPeriodEnd:true}", "DELETE thẻ"], "-", "200, danh sách thẻ rỗng.", pw="Không")
    A(F, "Gói hosting 'pro' đang chạy (owner) được tính là 'đang dùng thẻ' khi xóa thẻ", "Chức năng", "Thấp", APIM + " " + CARD + " Owner O chọn gói hosting Chuyên nghiệp: PUT /communities/<draft>/hosting-plan {planKey:'pro', cycle:'monthly', paymentMethod:<thẻ>} (mô phỏng, trialing).", ["O xóa thẻ duy nhất đang gắn gói hosting"], "-", "409 CARD_IN_USE nếu đó là thẻ cuối mà gói pro cần.", pw="Không")
    A(F, "IDOR: B gọi PATCH …/<id thẻ của A>/default, PUT …/<id>, DELETE …/<id> -> 404 và thẻ của A không đổi", "Bảo mật", "Cao", APIM + " " + CARD, ["A thêm thẻ", "B gọi lần lượt 3 request trên với id thẻ của A", "A GET /me/payment-methods"], "id thẻ của A", "Cả 3 lần 404 (không lộ tồn tại); thẻ của A còn nguyên và vẫn mặc định.", pw="Không")
    A(F, "Luhn chỉ kiểm được ở client: server nhận last4 bất kỳ (không thấy PAN) nên thẻ sai Luhn gửi thẳng qua API vẫn được lưu", "Chức năng", "Thấp", APIM + " " + CARD, ["POST thẻ last4:'4241' (số 4242…4241 sai Luhn) bằng API"], "last4=4241", "HIỆN TẠI 201 (server chỉ kiểm định dạng token/brand/last4/hạn); chỉ UI chặn Luhn. KỲ VỌNG theo thiết kế docs: chấp nhận vì server không thấy PAN; xác thực thật cần cổng thanh toán.", st=PLAN, pw="Không")
    A(F, "'Thẻ mặc định' = thẻ có createdAt MỚI NHẤT (chưa có cột isDefault): 'Đặt làm mặc định' nâng createdAt lên hiện tại; thẻ thêm sau ở Cài đặt bị lùi createdAt; thẻ nhập lúc thanh toán/dùng thử tự thành mặc định", "Chức năng", "Trung bình", APIM + " " + CARD + " " + SQL, ["Thêm thẻ A, thẻ B (B không mặc định)", "SELECT id,last4,\"createdAt\" FROM \"PaymentCard\" WHERE \"userId\"='<id>' ORDER BY \"createdAt\" DESC;", "Mua gói bằng thẻ C mới (paymentMethod trong checkout)"], "-", "HIỆN TẠI: thứ tự createdAt quyết định mặc định; sau khi mua bằng thẻ C thì C thành mặc định dù người dùng chưa chọn. Rủi ro: dữ liệu gián tiếp; KỲ VỌNG: cột isDefault tường minh (cần migration).", st=PLAN, pw="Không")

    F = "API - GET /me/billing-summary"
    A(F, "Chưa có gói: {currency:'USD', next:null, monthlyTotalCents:0, activeCount:0}", "Chức năng", "Cao", API, ["GET /me/billing-summary với người dùng mới"], "-", "200 data đúng 4 khóa như trên.", pw="Không")
    A(F, "Gộp gói tháng $7 + gói năm $48 -> monthlyTotalCents 1100, activeCount 2, next = gói hết kỳ sớm nhất ($7, trialing=false); gói hủy cuối kỳ bị bỏ", "Chức năng", "Cao", APIM + " " + CARD + PAID, ["Mua gói tháng ở C1, gói năm ở C2 (interval:'annual'), gói tháng ở C3 rồi hủy cuối kỳ C3", "GET /me/billing-summary"], "700 + 400", "monthlyTotalCents 1100 (= 700 + 4800/12); activeCount 2; next.communityId = C1, next.amountCents 700, next.trialing=false, có communityTitle và date.", pw="Không")
    A(F, "Quy gói năm về tháng = round(priceCents/12): 4800¢ -> 400¢, 5000¢ -> 417¢, 100¢ -> 8¢, 1¢ -> 0¢", "Chức năng", "Thấp", APIM + " " + SQL,
      ["Có 1 gói năm active với priceCents lần lượt 4800, 5000, 100, 1 (đặt bằng SQL hoặc cộng đồng giá phù hợp)", "GET /me/billing-summary sau mỗi lần"], "4 mức giá", "monthlyTotalCents lần lượt 400, 417, 8, 0 (làm tròn số nguyên gần nhất).", pw="Không")
    A(F, "Gói đang dùng thử: next.trialing=true, date = lúc hết thử, amountCents = giá kỳ đầu", "Chức năng", "Trung bình", APIM + " " + CARD + " Cộng đồng PC có thử 7 ngày.", ["POST /communities/PC/trial {paymentMethod:<thẻ>}", "GET /me/billing-summary"], "-", "next.trialing=true; date = trialEndsAt; activeCount 1.", pw="Không")
    F = "API - /me/payments, hoàn tiền, hóa đơn"
    A(F, "GET /me/payments: có refundStatus (null | pending | refunding | approved | rejected) theo yêu cầu hoàn tiền mới nhất", "Chức năng", "Cao", APIM + " " + CARD + PAID, ["Mua gói", "GET /me/payments (refundStatus null)", "POST /payments/<id>/refund-request {reason:'không cần nữa'}", "GET lại"], "-", "Trước: refundStatus null; sau (trong cửa sổ): 'approved' và status 'refunded'.", pw="Không")
    A(F, "POST /payments/:id/refund-request lý do < 3 ký tự ('ab'), > 500 ký tự, hoặc thiếu lý do -> 400 'Vui lòng nhập lý do (tối thiểu 3 ký tự)' / max 500", "Chức năng", "Trung bình", APIM + " " + CARD + PAID,
      ["POST body {reason:'ab'}", "POST body {reason:'a' x 501}", "POST body {}"], "3 body", "Cả 3 lần 400; không tạo RefundRequest.", pw="Không")
    A(F, "POST refund-request cho giao dịch của người khác -> 403; id không có -> 404; gửi lần 2 cho cùng giao dịch -> 409", "Bảo mật", "Cao", APIM + " " + CARD + PAID, ["B gọi refund-request trên giao dịch của A", "A gọi với id lạ", "A gọi 2 lần liên tiếp"], "-", "403; 404; lần 2 của A: 409.", pw="Không")
    A(F, "GET /payments/:id/invoice: chủ giao dịch / Owner cộng đồng / Platform Admin xem được; người khác 403; chưa có hóa đơn 409", "Bảo mật", "Cao", APIM + " " + CARD + PAID, ["A mua; B (người lạ) GET invoice; O (owner PC) GET; admin@ GET; giao dịch pending GET"], "-", "B: 403; A, O, admin: 200 {invoiceNumber, issuedAt, status, buyer, community, items[], subtotalCents, refundedCents, totalCents}; pending: 409.", pw="Không")

    F = "Hoa hồng giới thiệu & hoàn tiền (liên đới thanh toán)"
    A(F, "Hoàn tiền toàn bộ giao dịch làm hoa hồng giới thiệu 'pending' của giao dịch đó thành 'void' (xem SETR)", "Tích hợp", "Trung bình", APIM + " " + CARD + PAID + " Người mua đăng ký bằng mã giới thiệu của R.", ["Người mua thanh toán", "Người mua yêu cầu hoàn tiền trong cửa sổ", "R mở /settings/gioi-thieu -> Chi tiết hoa hồng"], "-", "Khoản hoa hồng hiện 'Đã hủy' (gạch ngang), KPI 'Hoa hồng tháng này' và 'Chờ chi trả' về 0.", pw="Một phần")

    F = "Bảo mật & hồi quy"
    A(F, "Không có PAN/CVC trong DB và log: bảng PaymentCard chỉ có brand,last4,expMonth,expYear,gatewayToken", "Bảo mật", "Cao", APIM + " " + SQL + " " + CARD, ["Thêm thẻ qua UI (số 4242…)", "SELECT * FROM \"PaymentCard\" WHERE \"userId\"='<id>';", "Tìm chuỗi 4242424242424242 trong log backend"], "-", "Hàng chỉ có 4 số cuối + token mock; log không chứa PAN/CVC.", pw="Không")
    A(F, "Link cũ /billing (Header, menu cộng đồng) và /communities/:id/checkout hoạt động cùng luồng thẻ mới", "Chức năng", "Cao", BASE + " Đăng nhập member1@.", ["Mở /billing", "Mở hộp thoại 'Chọn gói thành viên' và thanh toán bằng thẻ đã lưu"], "-", "Redirect về tab Thanh toán; thẻ vừa nhập ở checkout xuất hiện trong danh sách và tự thành mặc định (upsertCard).", pw="Một phần")
    A(F, "Năng lực trang /billing cũ vẫn còn: hủy cuối kỳ, hủy ngay, tiếp tục gói, yêu cầu hoàn tiền, xem hóa đơn", "Chức năng", "Cao", BASE + " " + NEWU + " " + MUTATE + PAID, ["Thực hiện lần lượt 5 thao tác trên ở tab Thanh toán"], "-", "Cả 5 thao tác chạy được (không còn trang riêng). Trạng thái hoàn tiền lấy từ refundStatus của server, không còn lưu localStorage.", pw="Một phần")

# ====================================================================================================================
#                                  MODULE SETR - Chương trình giới thiệu
# ====================================================================================================================
def load_setr(add):
    A = _mk(add, "SETR", "Cài đặt - Giới thiệu")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + " rồi mở /settings/gioi-thieu."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó, mở /settings/gioi-thieu."
    UIM = UINEW + " " + MUTATE
    REF = (" Người giới thiệu R (tài khoản mới) lấy link ở tab này; người được giới thiệu F đăng ký bằng link (cửa sổ ẩn danh) - xem case 'Ghi nhận khi đăng ký'. "
           "Cộng đồng có phí PC ($10/tháng) do owner khác tạo để F thanh toán (checkout rồi confirm bằng API hoặc UI).")
    TMP = " " + DEC + " Tỉ lệ 30%/10%, 60 ngày, chi trả ngày 5 là giá trị TẠM lấy từ mockup (OPEN_DECISIONS A17), chỉnh ở Admin > Hệ thống > Cài đặt chung."

    F = "Bố cục & hai chế độ"
    A(F, "Tab đối chiếu mockup: 2 tab con, 'Cài đặt nhận tiền', hero + link, 4 KPI, 3 bước, bảng 'Người bạn đã giới thiệu'", "Giao diện", "Cao", UI + " " + WEIRD, ["Mở /settings/gioi-thieu", "So sánh với template.html"], "-",
      "Dòng đầu: tab 'Giới thiệu người tạo cộng đồng' (đang chọn, có biểu tượng bánh răng cam) | 'Giới thiệu thành viên', bên phải link 'Cài đặt nhận tiền'; hero gradient 'Nhận 30% mỗi tháng từ người bạn giới thiệu mở cộng đồng' + hộp 'Link giới thiệu của bạn' + nút 'Sao chép'; 4 KPI (Người đã đăng ký, Đang trả phí, Hoa hồng tháng này, Chờ chi trả); 3 bước (Chia sẻ link → Họ mở cộng đồng → Bạn nhận hoa hồng); thẻ 'Người bạn đã giới thiệu' ('Danh sách những người đã đăng ký từ link giới thiệu của bạn.').")
    A(F, "Mặc định mở tab 'Giới thiệu người tạo cộng đồng' (creator); chuyển sang 'Giới thiệu thành viên' đổi hero/ KPI/ bảng/ đơn vị tiền", "Chức năng", "Cao", UIM, ["Quan sát tab mặc định", "Bấm 'Giới thiệu thành viên'", "Bấm lại tab đầu"], "-",
      "Creator: tỉ lệ 30%, tiền VND; headline 'Nhận 30% mỗi tháng từ người bạn giới thiệu mở cộng đồng', phụ đề 'Hoa hồng định kỳ, trả mỗi tháng người đó còn dùng gói trả phí.', bước 2 'Họ mở cộng đồng'. Member: 10%, tiền USD; 'Nhận 10% mỗi tháng từ thành viên bạn mời vào cộng đồng trả phí', phụ đề 'Áp dụng cho cộng đồng có bật chương trình giới thiệu thành viên.', bước 2 'Họ tham gia cộng đồng'. Link giới thiệu giống nhau ở cả hai tab." + TMP, pw="Một phần")
    A(F, "Đổi tab reset 'Xem tất cả' về thu gọn", "Chức năng", "Thấp", UIM + REF + " Đã có >= 5 người đăng ký.", ["Ở tab Member bấm 'Xem tất cả 5'", "Đổi sang tab Creator rồi quay lại"], "-", "Quay lại tab Member bảng chỉ còn 4 dòng (setAll(false)).", pw="Một phần")
    A(F, "Link 'Cài đặt nhận tiền' dẫn tới /settings/thanh-toan (tab thanh toán thẻ, chưa phải cấu hình nhận tiền)", "Chức năng", "Thấp", UIM, ["Bấm 'Cài đặt nhận tiền'"], "-", "HIỆN TẠI mở tab Thanh toán (quản lý thẻ để TRẢ tiền); chưa có nơi cấu hình tài khoản NHẬN hoa hồng. KỲ VỌNG: trang/ mục cấu hình nhận tiền (ngân hàng) cho hoa hồng; gắn với quyết định A17 (ngưỡng chi trả tối thiểu).", st=PLAN)
    A(F, "Trạng thái tải/ lỗi: link hiển thị '…' khi đang tải, 'Không tải được link' khi lỗi; bảng 'Đang tải…' / thông báo lỗi", "Giao diện", "Thấp", UI, ["Throttle mạng rồi F5", "Chặn GET /me/referral rồi F5"], "-", "Hộp link '…' rồi link; lỗi: 'Không tải được link', nút Sao chép bị vô hiệu.", pw="Một phần")

    F = "Link giới thiệu & mã"
    A(F, "Lần đầu mở tab tự tạo mã: link dạng <FRONTEND_URL>/gioi-thieu/<mã>, hiển thị không kèm http(s)://", "Chức năng", "Cao", UIM, ["Mở tab với tài khoản mới", "Đọc link", "F5 và mở lại"], "-", "Hộp hiển thị 'localhost:5173/gioi-thieu/<mã>' (đã bỏ scheme); mã ổn định giữa các lần mở; GET /me/referral trả code khớp /^[a-z0-9._]{3,32}$/ và link kết thúc /gioi-thieu/<code>.")
    A(F, "Sao chép: cả biểu tượng và nút 'Sao chép' ghi link ĐẦY ĐỦ (có https://) vào clipboard + toast 'Đã sao chép link giới thiệu'", "Chức năng", "Cao", UIM, ["Bấm biểu tượng sao chép", "Dán vào thanh địa chỉ", "Bấm nút 'Sao chép' rồi dán lại"], "-", "Clipboard = <FRONTEND_URL>/gioi-thieu/<mã> (không bị cắt scheme); toast thành công mỗi lần.", pw="Một phần")
    A(F, "Trình duyệt chặn Clipboard API (http thường, iframe): dùng cách dự phòng execCommand; thất bại hẳn thì toast 'Không sao chép được, hãy chọn và sao chép link thủ công'", "Chức năng", "Thấp", UIM, ["Mở bằng http://<IP LAN>:5173 (không phải localhost) hoặc chặn quyền clipboard", "Bấm 'Sao chép'"], "-", "Vẫn sao chép được qua fallback; nếu cả hai thất bại: toast lỗi như trên.", pw="Không")
    A(F, "Mã mặc định = handle của người dùng (chữ thường) nếu đã đặt và chưa bị mã người khác chiếm; ngược lại mã ngẫu nhiên", "Chức năng", "Trung bình", UIM, ["Đặt handle 'han_<số>' ở tab Hồ sơ", "Mở tab Giới thiệu LẦN ĐẦU", "Với tài khoản khác: đặt handle trùng với mã của người khác rồi mở tab"], "-", "Lần đầu có handle: code = handle; handle trùng mã người khác: sinh mã ngẫu nhiên 8 ký tự khác.")
    A(F, "Đổi handle SAU khi đã có mã: link đã chia sẻ KHÔNG đổi (nguồn sự thật là bảng ReferralCode)", "Chức năng", "Trung bình", UIM, ["Mở tab Giới thiệu để tạo mã", "Đặt handle mới ở tab Hồ sơ", "Mở lại tab Giới thiệu"], "-", "Mã và link giữ nguyên; vẫn dùng được cả mã cũ; (đăng ký bằng mã không có trong ReferralCode thì tra theo User.handle).")

    F = "KPI & bảng người được giới thiệu"
    A(F, "Tài khoản chưa ai đăng ký: KPI = 0, không có mũi tên delta, 'Chờ chi trả' 'Chi trả ngày 05/<tháng sau>/<năm>', bảng trống 'Chưa có ai đăng ký từ link của bạn'", "Chức năng", "Cao", UIM, ["Mở tab với tài khoản mới ở cả hai chế độ"], "-",
      "Người đã đăng ký 0, Đang trả phí 0, Hoa hồng tháng này $0.00 (member) / 0 ₫ (creator), Chờ chi trả 0; ghi chú 'so với tháng trước' nhưng KHÔNG có delta; bảng: biểu tượng + 'Chưa có ai đăng ký từ link của bạn' + 'Sao chép link giới thiệu ở trên và chia sẻ cho bạn bè để bắt đầu nhận hoa hồng.'" + TMP)
    A(F, "KPI 'Người đã đăng ký': giá trị = tổng người dùng đăng ký bằng link; mũi tên '+N' (xanh) = số người đăng ký thêm trong THÁNG NÀY, ẩn khi N=0", "Chức năng", "Cao", UIM + REF, ["F đăng ký bằng link của R", "R F5 tab Giới thiệu"], "1 người", "Giá trị 1, delta '+1' (xanh, mũi tên lên); bảng có 1 dòng.", pw="Một phần")
    A(F, "KPI 'Hoa hồng tháng này' hiện delta % so tháng trước chỉ khi tháng trước có số liệu; âm thì mũi tên đỏ xuống", "Chức năng", "Trung bình", UIM + REF + " " + SQL, ["F thanh toán $10 (hoa hồng 100¢ tháng này)", "INSERT một hoa hồng tháng trước 50¢ (ReferralCommission createdAt tháng trước)", "R mở tab Member", "Sau đó chỉnh hoa hồng tháng trước lên 400¢"], "100 vs 50", "Lần 1: '+100%' xanh (100-50)/50; lần 2: '-75%' đỏ mũi tên xuống; không có số liệu tháng trước thì không hiện delta.", pw="Không")
    A(F, "KPI 'Đang trả phí' và 'Chờ chi trả' (tổng hoa hồng pending); ngày chi trả = ngày 5 của tháng SAU", "Chức năng", "Cao", UIM + REF + TMP, ["F thanh toán $10 ở PC", "R mở tab Member"], "$10", "Đang trả phí 1; Hoa hồng tháng này $1.00 (10% x $10.00); Chờ chi trả $1.00, ghi chú 'Chi trả ngày 05/MM/yyyy' (tháng sau, đọc từ referral.payoutDay); không có job chuyển pending -> paid nên số này không tự giảm.", pw="Một phần")
    A(F, "Bảng người được giới thiệu: avatar chip (chữ cái đầu 2 từ) hoặc ảnh, tên, cộng đồng, ngày đăng ký (dd/MM/yyyy), chip trạng thái, hoa hồng đã nhận ('—' khi 0)", "Chức năng", "Cao", UIM + REF, ["Xem dòng của F ở tab Member sau khi F thanh toán và ở tab Creator"], "-", "Member: cộng đồng PC, chip 'Đang trả phí' xanh, hoa hồng $1.00. Creator: F chưa mở cộng đồng -> '—' ở cột cộng đồng, chip 'Chưa trả phí', hoa hồng '—'. Chip F chưa có gói ở tab Member: 'Chưa tham gia'.", pw="Một phần")
    A(F, "Chip trạng thái người được giới thiệu: paid 'Đang trả phí' (xanh), trial 'Đang dùng thử' (vàng), cancel 'Đã hủy' (xám), none 'Chưa tham gia' (member) / 'Chưa trả phí' (creator)", "Chức năng", "Trung bình", UIM + REF,
      ["Đưa F vào từng trạng thái (member: gói active / trialing / canceled / chưa có gói; creator: hosting pro active / trialing / canceled / không có)", "R mở tab tương ứng sau mỗi lần"], "4 trạng thái", "Chip đúng chữ và màu. Quy tắc member: gói 'tốt nhất' (đang trả phí > dùng thử > đã hủy); creator: gói hosting pro của cộng đồng đã publish mà F làm chủ.", pw="Một phần")
    A(F, "'Xem tất cả N' chỉ hiện khi N > 4: mặc định 4 dòng MỚI NHẤT; bấm xem đủ (tối đa 500), 'Thu gọn' quay lại 4 dòng", "Chức năng", "Trung bình", UIM + REF + " Có 6 người đăng ký bằng link của R.", ["Mở tab Member", "Bấm 'Xem tất cả 6'", "Bấm 'Thu gọn'"], "6 người", "Ban đầu 4 dòng (sắp xếp signedUpAt giảm dần), nút 'Xem tất cả 6'; sau đó 6 dòng và nút 'Thu gọn'; với <= 4 người không có nút.", pw="Một phần")
    A(F, "Menu ⋯ của dòng: 'Gửi tin nhắn' (mở /messages/<id>), 'Chi tiết hoa hồng', 'Nhắc nâng cấp gói' (CHỈ dòng 'Đang dùng thử')", "Chức năng", "Cao", UIM + REF, ["Bấm ⋯ ở dòng đang trả phí và dòng đang dùng thử"], "-", "Dòng thường: 2 mục; dòng trial: 3 mục. 'Gửi tin nhắn' mở hội thoại (hoặc toast lỗi nếu không chung cộng đồng/ người nhận tắt DM).", pw="Một phần")
    A(F, "'Chi tiết hoa hồng': tiêu đề, '<tên> · đã nhận <tiền>', từng khoản '<tiền>' + '<ngày> · <tỉ lệ>% của <gốc>' + trạng thái (Chờ chi trả / Đã chi trả / Đã hủy gạch ngang)", "Chức năng", "Cao", UIM + REF + TMP, ["Sau khi F thanh toán $10, bấm ⋯ -> Chi tiết hoa hồng"], "$10 -> 100¢", "Một dòng '$1.00', '<ngày> · 10% của $10.00', 'Chờ chi trả'; tổng 'đã nhận $1.00'. Chưa có khoản: 'Chưa có khoản hoa hồng nào từ người này.'", pw="Một phần")
    A(F, "'Nhắc nâng cấp gói' (dòng đang dùng thử): toast 'Đã gửi lời nhắc cho <tên>'; người nhận có thông báo 'Lời nhắc nâng cấp gói' trỏ /communities/<id>/checkout; gửi lại trong 24h -> toast lỗi cooldown", "Chức năng", "Cao", UIM + REF, ["F bắt đầu dùng thử ở PC", "R bấm ⋯ -> Nhắc nâng cấp gói", "R bấm lại ngay", "Đăng nhập F xem chuông"], "-", "Lần 1 thành công; lần 2 toast lỗi (429 REMINDER_COOLDOWN); F có thông báo 'Lời nhắc nâng cấp gói' link /communities/<id>/checkout.", pw="Một phần")
    A(F, "Tiền hiển thị theo đơn vị riêng: member USD (cent) qua formatCents, creator VND số nguyên (không phần thập phân)", "Giao diện", "Trung bình", UIM + REF + " " + DEC, ["So sánh định dạng tiền ở hai tab"], "-", "Member '$1.00'; creator ví dụ '89.700 ₫' (30% của 299.000 ₫); không quy đổi. Đơn vị chưa thống nhất (A16/A17).", st=PLAN, pw="Không")
    A(F, "Màn hình hẹp: hero xuống dòng, bảng cuộn ngang (min 820px), 3 bước xếp dọc dưới 1100px", "Giao diện", "Thấp", UI, ["Viewport 375x812 và 1024x768"], "-", "Không cuộn ngang toàn trang; bảng cuộn trong khung; mũi tên giữa các bước ẩn khi xếp dọc.", pw="Một phần")

    F = "Ghi nhận khi đăng ký (?ref= và /gioi-thieu/:code)"
    A(F, "/gioi-thieu/<mã>: lưu mã (chữ thường) vào localStorage 'sofin:referral' rồi chuyển sang /register (replace), hiển thị 'Đang chuyển hướng…' thoáng qua", "Chức năng", "Cao", BASE + " Chưa đăng nhập, mã R lấy từ tab Giới thiệu.", ["Mở http://localhost:5173/gioi-thieu/<MÃ viết HOA>", "Quan sát URL và localStorage"], "<MÃ>", "URL cuối /register (Back không quay lại trang chuyển hướng); localStorage 'sofin:referral' = {code:'<mã thường>', at:<ms>}.")
    A(F, "?ref=<mã> ở BẤT KỲ trang nào cũng được ghi nhớ (ví dụ /?ref=..., /search?ref=...)", "Chức năng", "Cao", BASE + " Chưa đăng nhập.", ["Mở /?ref=<mã>", "Mở /search?q=a&ref=<mã khác>", "Kiểm tra localStorage"], "ref", "Mã được lưu (lần sau ghi đè lần trước); trang vẫn hiển thị bình thường, không redirect.")
    A(F, "Đăng ký bằng giao diện sau khi có mã: POST /auth/register mang referralCode, sau khi đăng ký mã bị xóa khỏi localStorage", "Chức năng", "Cao", BASE + " Chưa đăng nhập, đã mở link giới thiệu của R.", ["Đăng ký tài khoản F ở /register", "Xem Network và localStorage"], "-", "Body POST có referralCode='<mã>'; sau thành công 'sofin:referral' bị xóa; trong DB có Referral{referrerId=R, referredUserId=F, expiresAt=now+60 ngày}; bảng của R có F.", pw="Một phần")
    A(F, "Mã lưu quá 60 ngày ở trình duyệt bị bỏ (storage tự xóa); cửa sổ hiệu lực thật do server tính từ lúc ĐĂNG KÝ", "Chức năng", "Thấp", BASE, ["Đặt localStorage 'sofin:referral' = {code:'<mã>', at: Date.now() - 61*86400000}", "Mở /register và đăng ký"], "61 ngày", "Request không mang referralCode (mã hết hạn bị xóa); không có Referral.", pw="Một phần")
    A(F, "Mã không tồn tại / để trống / trình duyệt chặn localStorage: đăng ký vẫn THÀNH CÔNG, không có Referral", "Chức năng", "Cao", BASE + " " + NEWU, ["Mở /gioi-thieu/khong-ton-tai-xyz và đăng ký", "Đăng ký không mã"], "khong-ton-tai-xyz", "Đăng ký thành công, không lỗi, không lộ mã nào tồn tại; bảng Referral không có dòng cho người này.", pw="Một phần")
    A(F, "Người dùng ĐÃ đăng nhập mở link giới thiệu: được chuyển /register theo thiết kế (mã chỉ có tác dụng khi đăng ký tài khoản mới)", "Chức năng", "Thấp", UI, ["Đang đăng nhập, mở /gioi-thieu/<mã của người khác>"], "-", "Mã được lưu và chuyển /register (RegisterPage có thể tự đưa về trang chủ khi đã đăng nhập); không tạo Referral cho tài khoản hiện có.", pw="Một phần")

    F = "Điểm chưa làm / lệch (giới thiệu)"
    A(F, "Hoa hồng người tạo cộng đồng (creator) luôn 0: chưa có luồng trừ tiền gói hosting (mô phỏng)", "Chức năng", "Cao", UIM + REF + TMP, ["F mở cộng đồng và chọn gói Chuyên nghiệp (dùng thử 14 ngày)", "Chờ/ ép hết dùng thử", "R xem tab Creator"], "-", "HIỆN TẠI: dòng của F hiện 'Đang dùng thử' rồi 'Đang trả phí' theo trạng thái gói nhưng 'Hoa hồng tháng này' = 0 vì onHostingCharge chưa có nơi gọi (gói hosting mô phỏng, A16). KỲ VỌNG: 30% x phí gói hằng tháng (vd. 89.700 ₫ từ 299.000 ₫).", st=PLAN, pw="Không")
    A(F, "Chưa có job chuyển hoa hồng pending -> paid (chi trả tự động); 'Chờ chi trả' chỉ là ngày dự kiến", "Chức năng", "Cao", UIM + REF + TMP, ["Sau khi có hoa hồng pending, chờ qua ngày chi trả (ngày 5 tháng sau)"], "-", "HIỆN TẠI: trạng thái giữ 'Chờ chi trả' mãi, không có 'Đã chi trả'. KỲ VỌNG: job chi trả theo ngày + ngưỡng tối thiểu (A17).", st=PLAN, pw="Không")
    A(F, "Mô tả tab thành viên nói 'Áp dụng cho cộng đồng có bật chương trình giới thiệu thành viên' nhưng KHÔNG có cài đặt bật/tắt theo cộng đồng", "Giao diện", "Thấp", UIM, ["Tìm cài đặt 'chương trình giới thiệu thành viên' ở Cài đặt cộng đồng"], "-", "HIỆN TẠI không có công tắc; hoa hồng member áp dụng cho MỌI thanh toán của người được giới thiệu (mọi cộng đồng). KỲ VỌNG: sửa câu chữ hoặc thêm công tắc theo cộng đồng.", st=PLAN, pw="Không")
    A(F, "Chống gian lận: cùng một người tạo nhiều tài khoản bằng link của chính mình để tự hưởng hoa hồng (chưa có kiểm tra thiết bị/ email/ IP)", "Bảo mật", "Trung bình", UIM + REF + TMP, ["R copy link, mở cửa sổ ẩn danh đăng ký F bằng email khác", "F thanh toán"], "-", "HIỆN TẠI hợp lệ (chỉ chặn 'tự giới thiệu' đúng tài khoản và 'đã có người giới thiệu'); R nhận hoa hồng từ chính mình. KỲ VỌNG: quy tắc chống gian lận do PO chốt (A17).", st=PLAN, pw="Không")

def load_setr_more(add):
    A = _mk(add, "SETR", "Cài đặt - Giới thiệu")
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."
    APIM = API + " " + MUTATE
    TMP = " " + DEC + " Tỉ lệ 30%/10%, 60 ngày, chi trả ngày 5 là giá trị TẠM (OPEN_DECISIONS A17); chỉnh ở Admin > Hệ thống > Cài đặt chung (nhóm referral) hoặc PATCH /api/admin/system/settings."
    PC = (" Cộng đồng có phí PC $10/tháng do người dùng O tạo: POST /communities {title,description,category:'tech',priceUsd:10,visibility:'public'}. "
          "Người giới thiệu R lấy mã: GET /me/referral -> data.code; người được giới thiệu F đăng ký: POST /auth/register {...,referralCode:<mã>}; "
          "F thanh toán: POST /communities/PC/checkout {method:'stripe'} rồi POST /payments/<id>/confirm.")
    APIT = APIM + PC + TMP
    GSET = "Admin chỉnh cài đặt: " + tok("admin@sofinhub.test") + " PATCH /api/admin/system/settings {\"referral\":{\"memberRateBps\":2500}}; đặt lại POST /api/admin/system/settings/reset {\"keys\":[\"referral.memberRateBps\"]} hoặc npm run db:reset."

    F = "API - GET /me/referral"
    A(F, "4 endpoint giới thiệu không token -> 401 (GET /me/referral, GET /me/referral/users, GET …/commissions, POST …/remind)", "Bảo mật", "Cao", API, ["Gọi 4 endpoint không header Authorization"], "-", "401 cả bốn.", pw="Không")
    A(F, "GET /me/referral (kind mặc định creator): {kind, code, link, currency, rates, kpis}; tạo mã lần đầu và ổn định", "Chức năng", "Cao", APIM + TMP, ["GET /me/referral?kind=member", "GET /me/referral?kind=creator", "GET lại lần 2"], "-",
      "member: currency 'USD', rates {creatorRateBps:3000, memberRateBps:1000, rateBps:1000, attributionDays:60, payoutDay:5}; creator: currency 'VND', rateBps 3000; kpis.registered {value:0, delta:null}, paying {value:0}, commissionThisMonth {cents:0, deltaPct:null}, pendingPayout.cents 0 với payoutOn khớp /-\\d{2}-05T00:00:00.000Z$/; code giống nhau ở mọi lần gọi; link kết thúc /gioi-thieu/<code>.", pw="Không")
    A(F, "GET /me/referral?kind=zzz -> 400", "Chức năng", "Trung bình", API, ["GET /api/me/referral?kind=zzz"], "zzz", "400 VALIDATION_ERROR.", pw="Không")
    A(F, "GET /me/referral/users: người dùng mới -> {data:[], meta:{total:0, shown:0, currency}} (creator: currency 'VND')", "Chức năng", "Trung bình", API, ["GET /me/referral/users?kind=creator"], "-", "200 đúng cấu trúc rỗng.", pw="Không")
    A(F, "GET /me/referral/users: all=false (mặc định) chỉ 4 dòng mới nhất; all=true tối đa 500; meta.total luôn là tổng; sắp xếp signedUpAt giảm dần", "Chức năng", "Cao", APIM + " Người giới thiệu R với 6 người đăng ký bằng mã của R.", ["GET /me/referral/users?kind=member", "GET /me/referral/users?kind=member&all=true"], "6 người", "Lần 1: data.length 4, meta.total 6, meta.shown 4; lần 2: 6 dòng; tất cả status 'none', communityName null (chưa tham gia cộng đồng); thời gian giảm dần.", pw="Không")
    A(F, "Row: {userId, name, avatarUrl, communityId, communityName, signedUpAt, status, earnedCents}; một người = một dòng ở cả hai kind", "Chức năng", "Trung bình", APIT, ["F thanh toán ở PC", "GET users?kind=member", "GET users?kind=creator"], "-", "member: status 'paid', communityId=PC, earnedCents 100; creator: status 'none', earnedCents 0, communityId null (F chưa mở cộng đồng).", pw="Không")
    A(F, "member: chọn gói 'tốt nhất' của người dùng (đang trả phí > dùng thử > đã hủy); chưa gói -> none", "Chức năng", "Trung bình", APIT + " Thêm cộng đồng có thử PC2.", ["F có gói active ở PC và gói trialing ở PC2", "GET users?kind=member", "F hủy gói PC (cancel ngay)"], "-", "Lần 1: status 'paid' (communityId PC); sau khi hủy: 'trial' (PC2) vì gói 'tốt nhất' còn lại; trial/active/canceled map paid/trial/cancel.", pw="Không")
    A(F, "creator: cộng đồng đã publish mà người đó làm chủ + gói hosting pro: active->paid, trialing->trial, canceled->cancel; Khởi đầu/ không gói/ chưa mở cộng đồng -> none", "Chức năng", "Trung bình", APIM + " " + SQL + " F tạo cộng đồng (POST /communities) rồi tạo HostingPlan.", ["Tạo HostingPlan pro trialing cho cộng đồng của F", "GET users?kind=creator", "Đổi status active rồi canceled"], "299.000 VND", "'trial' kèm communityId của cộng đồng F -> 'paid' -> 'cancel'.", pw="Không")
    A(F, "GET /me/referral/users/:userId/commissions: {currency, totalCents, data:[{id,createdAt,baseCents,rateBps,amountCents,status,communityId}]}; người không do mình giới thiệu -> 404", "Chức năng", "Cao", APIT, ["F thanh toán $20", "R GET commissions?kind=member", "Người lạ X GET cùng URL"], "$20", "200 totalCents 200, 1 khoản {baseCents:2000, rateBps:1000, amountCents:200, status:'pending'}; X: 404.", pw="Không")
    A(F, "POST /me/referral/users/:userId/remind: người dùng thử -> 200 {sent:true} + thông báo 'Lời nhắc nâng cấp gói' (link /communities/<id>/checkout); lần 2 trong 24h -> 429 REMINDER_COOLDOWN; người đã trả phí -> 409 NOT_TRIALING; người lạ -> 404", "Chức năng", "Cao", APIT + " Thêm F2 đăng ký bằng mã R và thanh toán.", ["F bắt đầu thử: POST /communities/PC/trial {}", "R remind F (kind=member)", "R remind F lần nữa", "R remind F2 (đã trả phí)", "Người lạ remind F"], "-", "200; 429; 409; 404. Chỉ 1 thông báo cho F trong chuông.", pw="Không")
    A(F, "Cô lập theo kind: hoa hồng member không lẫn vào tab creator và ngược lại", "Chức năng", "Trung bình", APIT, ["F thanh toán", "GET /me/referral?kind=creator và ?kind=member"], "-", "creator.kpis.commissionThisMonth.cents = 0; member = 100.", pw="Không")

    F = "Ghi nhận khi đăng ký (API)"
    A(F, "POST /auth/register {referralCode} hợp lệ (kể cả viết HOA) -> Referral {referrerId, referredUserId, code, expiresAt = now + 60 ngày}", "Chức năng", "Cao", APIM + TMP, ["R lấy mã", "Đăng ký F với referralCode = mã.toUpperCase()", "SELECT * FROM \"Referral\" WHERE \"referredUserId\"='<F>'", "R GET kpis"], "-", "Referral.code là chữ thường; expiresAt - now ~ 60.00 ngày (+-0.01); kpis.registered = {value:1, delta:1}.", pw="Không")
    A(F, "Mã lạ / rỗng / không có: đăng ký vẫn 201, KHÔNG có Referral, không lộ mã tồn tại", "Chức năng", "Cao", APIM, ["Đăng ký với referralCode 'khong-ton-tai-xyz'", "Với ''", "Không gửi trường"], "-", "Cả ba thành công; count Referral của người đó = 0.", pw="Không")
    A(F, "referralCode dài > 64 ký tự -> 400", "Chức năng", "Thấp", API, ["POST /auth/register với referralCode 'x' x 65"], "65 ký tự", "400 VALIDATION_ERROR (đăng ký không tạo tài khoản).", pw="Không")
    A(F, "Không tự giới thiệu và mỗi người chỉ được ghi nhận MỘT lần (referredUserId unique)", "Bảo mật", "Cao", APIM + " " + SQL, ["Gọi referralsService.attribute(R.id, mã của R) hoặc kiểm tra DB sau khi đăng ký", "Đăng ký F bằng mã R, sau đó cố gắn F với mã của R2"], "-", "Lần 1: không tạo Referral (tự giới thiệu); lần 2: Referral của F vẫn là R (không bị R2 ghi đè).", pw="Không")
    A(F, "Tra mã: ưu tiên bảng ReferralCode, nếu không có thì theo User.handle", "Chức năng", "Trung bình", APIM, ["Người H đặt handle 'han_x' nhưng CHƯA mở tab Giới thiệu (chưa có ReferralCode)", "Đăng ký F với referralCode 'han_x'"], "han_x", "Referral được ghi cho H (mã tra theo handle).", pw="Không")

    F = "Hoa hồng thành viên (member)"
    A(F, "Thanh toán đầu của người được giới thiệu: hoa hồng pending = 10% x số tiền ($10 -> 100¢), sourceRef 'payment:<id>', baseCents 1000, rateBps 1000, communityId=PC", "Chức năng", "Cao", APIT + " " + SQL, ["F thanh toán lần đầu $10", "SELECT kind,status,\"baseCents\",\"rateBps\",\"amountCents\",\"sourceRef\",\"communityId\" FROM \"ReferralCommission\" WHERE \"referrerId\"='<R>';"], "$10", "Đúng 1 hàng: kind 'member', status 'pending', baseCents 1000, rateBps 1000, amountCents 100, sourceRef 'payment:<paymentId>', communityId PC; R: paying 1, commissionThisMonth 100, pendingPayout 100.", pw="Không")
    A(F, "Idempotent: confirm lặp hoặc webhook lặp KHÔNG nhân đôi hoa hồng (sourceRef unique)", "Chức năng", "Cao", APIT, ["F thanh toán", "POST /payments/<id>/confirm lần 2", "Gửi lại webhook cùng id (nếu có)"], "-", "Vẫn đúng 1 hàng hoa hồng.", pw="Không")
    A(F, "Người dùng KHÔNG có người giới thiệu thanh toán -> không có hoa hồng nào", "Chức năng", "Cao", APIM + PC, ["Người mua không dùng mã thanh toán $5"], "-", "Số hàng ReferralCommission không đổi.", pw="Không")
    A(F, "Hết cửa sổ ghi nhận TRƯỚC lần thanh toán đầu -> không có hoa hồng", "Chức năng", "Cao", APIT + " " + SQL, ["Ép Referral.expiresAt = hôm qua: UPDATE \"Referral\" SET \"expiresAt\"=now()-interval '1 day' WHERE \"referredUserId\"='<F>';", "F thanh toán lần đầu"], "-", "Không có hoa hồng cho R.", pw="Không")
    A(F, "Hoa hồng ĐỊNH KỲ: đã có hoa hồng ở lần đầu thì các kỳ gia hạn sau vẫn được tính dù cửa sổ đã hết", "Chức năng", "Cao", APIT + " " + SQL, ["F thanh toán lần đầu (có hoa hồng)", "Ép expiresAt hôm qua", "Tạo kỳ gia hạn: gọi referralsService.onPaymentSucceeded({id:'renewal-x', userId:F, communityId:PC, amountCents:1000}) hoặc để job gia hạn chạy"], "-", "Tổng 2 hoa hồng của R (mỗi cái 100¢).", pw="Không")
    A(F, "Tỉ lệ đọc từ Global Settings và được CHỤP vào ReferralCommission.rateBps: memberRateBps 2500 -> $10 ra 250¢; đổi lại 1000 không đổi hoa hồng cũ", "Chức năng", "Cao", APIT + " " + GSET, ["Admin đặt memberRateBps = 2500", "F thanh toán $10", "Admin đặt lại 1000", "R GET /me/referral?kind=member"], "2500 bps", "Hoa hồng: rateBps 2500, amountCents 250; hàng cũ không đổi sau khi trả cài đặt về 1000; rates.memberRateBps phản ánh cài đặt hiện tại.", pw="Không")
    A(F, "Cửa sổ ghi nhận đọc từ referral.attributionDays: đặt 10 ngày -> Referral.expiresAt = now + 10 ngày; KPI payoutOn đọc referral.payoutDay (12 -> '-12T00:00:00.000Z')", "Chức năng", "Trung bình", APIM + TMP + " " + GSET, ["Admin đặt attributionDays=10 và payoutDay=12", "Đăng ký F bằng mã R", "R GET /me/referral"], "10 / 12", "expiresAt ~ now + 10 ngày; kpis.pendingPayout.payoutOn kết thúc '-12T00:00:00.000Z'.", pw="Không")
    A(F, "Global Settings referral.*: giá trị trong khoảng được chấp nhận - creatorRateBps/memberRateBps 0-10000 (10000 OK), attributionDays 1-3650 (3650 OK), payoutDay 1-28 (28 OK)", "Chức năng", "Thấp", APIM + " " + GSET,
      ["PATCH /admin/system/settings {referral:{creatorRateBps:10000, attributionDays:3650, payoutDay:28}}", "GET /admin/system/settings"], "biên trên", "Cả 3 giá trị được lưu và áp dụng (rates trả đúng).", pw="Không")
    A(F, "Global Settings referral.*: giá trị ngoài khoảng bị bỏ qua, dùng mặc định - creatorRateBps 10001, memberRateBps -1, attributionDays 0 và 3651, payoutDay 29 và 31", "Chức năng", "Thấp", APIM + " " + GSET,
      ["PATCH từng giá trị sai", "GET /me/referral để xem rates hiệu lực"], "6 giá trị sai", "Cấu hình hiệu lực vẫn là mặc định (3000/1000/60/5) - buildConfig bỏ qua giá trị sai (vd. payoutDay 31 -> 5).", pw="Không")
    A(F, "Mặc định referral.* = 3000 / 1000 / 60 / 5 (creatorRateBps / memberRateBps / attributionDays / payoutDay)", "Chức năng", "Trung bình", BASE + " Chạy trong thư mục backend.", ["cd backend && npx tsx -e \"import('./src/modules/settings/settings.service.ts').then(m=>console.log(JSON.stringify(m.cfg().referral)))\""], "-", "In {\"creatorRateBps\":3000,\"memberRateBps\":1000,\"attributionDays\":60,\"payoutDay\":5}." + TMP, pw="Không")
    A(F, "Giao diện Cài đặt chung (Admin > Hệ thống) có nhóm 'referral' để chỉnh 4 khóa", "Giao diện", "Thấp", BASE + " Đăng nhập admin@sofinhub.test, mở /admin/system.", ["Tìm nhóm cài đặt giới thiệu"], "-", "KỲ VỌNG: có ô cho 4 khóa referral.*. Nếu UI chưa có thì ghi nhận (chỉnh qua API) - theo docs chỉ nói cấu hình ở Admin > Hệ thống > Cài đặt chung.", pw="Một phần")

    F = "Hoàn tiền, chargeback, lỗi hook"
    A(F, "Hoàn tiền TOÀN BỘ giao dịch (trong cửa sổ, tự duyệt): hoa hồng pending của giao dịch đó thành 'void', KPI về 0", "Chức năng", "Cao", APIT, ["F thanh toán $10", "F POST /payments/<id>/refund-request {reason:'đổi ý rồi'} (201 approved)", "R GET /me/referral?kind=member và users"], "-", "Hàng hoa hồng status 'void'; commissionThisMonth.cents 0, pendingPayout.cents 0; row earnedCents 0; Chi tiết hoa hồng hiện 'Đã hủy'.", pw="Không")
    A(F, "Hoàn một phần KHÔNG hủy hoa hồng; hoa hồng đã 'paid' giữ nguyên (cần xử lý tay)", "Chức năng", "Trung bình", APIT + " " + SQL, ["Admin duyệt hoàn một phần", "Ép hoa hồng sang 'paid' bằng SQL rồi hoàn toàn bộ"], "-", "Hoàn một phần: hoa hồng vẫn 'pending'; hoàn toàn bộ với 'paid': vẫn 'paid' (không void). Ghi nhận thu hồi hoa hồng đã chi trả chưa có quy trình (A17).", st=PLAN, pw="Không")
    A(F, "Lỗi trong logic giới thiệu KHÔNG làm hỏng thanh toán; job referrals.reconcile (10 phút, nhìn lại 3 ngày) bù hoa hồng thiếu và không tạo trùng", "Chức năng", "Cao", APIT + " Chạy test tự động.", ["cd backend", "npm test -- tests/referrals.test.ts", "Đọc kết quả test 'lỗi trong logic giới thiệu KHÔNG làm hỏng thanh toán'"], "-", "Test PASS: thanh toán 201/200 dù hook ném lỗi; reconcileCommissions tạo >= 1 hoa hồng rồi lần hai tạo 0.", pw="Không")
    A(F, "Hoa hồng creator: onHostingCharge tạo 30% x phí gói (299.000 VND -> 89.700), sourceRef 'hosting:<chargeRef>' idempotent; chưa có nơi nào gọi trong luồng thật", "Chức năng", "Trung bình", APIM + " Chạy test tự động." + TMP, ["cd backend", "npm test -- tests/referrals.test.ts", "Đọc test 'onHostingCharge: 30% × phí gói (VND), idempotent theo chargeRef'"], "299.000 VND", "PASS: commissionThisMonth.cents = 89700, paying 1, currency 'VND', chỉ 1 hoa hồng creator dù gọi 2 lần; tab member không lẫn.", pw="Không")
    A(F, "Mặc định 'rate' trên UI lấy từ server: đổi referral.creatorRateBps sang 2500 thì hero hiển thị 'Nhận 25%' (định dạng vi-VN, 250 bps -> '2,5%')", "Giao diện", "Thấp", BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó. " + GSET, ["Admin đặt creatorRateBps=2500 (rồi 250)", "Mở tab Giới thiệu, F5"], "2500 / 250", "Hero 'Nhận 25%…' / 'Nhận 2,5%…'; bước 3 'Mỗi tháng họ thanh toán, bạn nhận 25%.'; bước 1 'trong N ngày' theo attributionDays.", pw="Một phần")

    F = "Bảo mật (giới thiệu)"
    A(F, "IDOR: xem commissions / remind của người dùng KHÔNG do mình giới thiệu -> 404 (không phân biệt người không tồn tại)", "Bảo mật", "Cao", APIT, ["X (không liên quan) GET /me/referral/users/<F>/commissions", "X POST /me/referral/users/<F>/remind", "R GET commissions của <id không tồn tại>"], "-", "Cả ba 404 cùng dạng lỗi.", pw="Không")
    A(F, "Người được giới thiệu không xem được danh sách/ hoa hồng của người giới thiệu; mỗi người chỉ thấy dữ liệu của mình", "Bảo mật", "Cao", APIT, ["F GET /me/referral/users?kind=member", "R GET lại"], "-", "F thấy danh sách rỗng (F chưa giới thiệu ai); R thấy F; không có tham số userId để xem thay người khác.", pw="Không")
    A(F, "Dữ liệu nhạy cảm: response chỉ có tên/ảnh/cộng đồng/ngày/số tiền - KHÔNG có email, số điện thoại hoặc id thanh toán của người được giới thiệu", "Bảo mật", "Trung bình", APIT, ["R GET /me/referral/users?kind=member&all=true và commissions"], "-", "Các trường khớp mô tả Row (không email/ paymentId; commissions chỉ có id nội bộ của hoa hồng).", pw="Không")
    A(F, "XSS: tên người được giới thiệu chứa <script> hiển thị dạng văn bản trong bảng và modal", "Bảo mật", "Trung bình", APIM + " Đăng nhập UI bằng R. Người F đăng ký với firstName '<img src=x onerror=alert(1)>' bằng mã R.", ["R mở bảng và 'Chi tiết hoa hồng'"], "-", "Không alert; chuỗi hiện nguyên văn (escape); chip chữ cái đầu tính từ 2 từ đầu không vỡ layout.", pw="Một phần")

def load_setp_more(add):
    A = _mk(add, "SETP", "Cài đặt - Hồ sơ")
    UI = BASE + " Đăng nhập UI member1@sofinhub.test / " + PW + "."
    UINEW = BASE + " " + NEWU + " Đăng nhập UI bằng tài khoản mới đó."
    UIM = UINEW + " " + MUTATE
    API = BASE + " " + NEWU + " Mọi API có tiền tố /api; thành công trả { data }, lỗi { error: { code, message, details } }."

    F = "Hồ sơ - Trợ năng, đồng thời, hiệu năng"
    A(F, "Bàn phím: Tab đi qua nút camera, 'Đổi ảnh đại diện', 'Xóa ảnh', Họ, Tên, handle, bio, 4 liên kết, công tắc, Hủy, Lưu theo thứ tự hợp lý; công tắc bật/tắt bằng Space", "Giao diện", "Thấp", UIM,
      ["Mở /settings, bấm Tab liên tục từ đầu form", "Dùng Space/Enter trên công tắc và nút"], "-", "Thứ tự focus từ trên xuống dưới, có viền focus nhìn thấy; công tắc 'Hiện vị trí trên bản đồ thành viên' đổi được bằng bàn phím; Enter ở ô nhập không gửi form ngoài ý muốn.", pw="Một phần")
    A(F, "Nhãn trợ năng: nút camera aria-label 'Đổi ảnh đại diện', ô handle 'Đường dẫn hồ sơ', textarea 'Giới thiệu', công tắc 'Hiện vị trí trên bản đồ thành viên'", "Giao diện", "Thấp", UIM, ["Kiểm tra cây trợ năng (DevTools Accessibility) của form"], "-", "Các phần tử có tên trợ năng như trên; ảnh đại diện có alt 'Ảnh đại diện'.", pw="Một phần")
    A(F, "Hai tab trình duyệt cùng tài khoản: lưu ở tab A, tab B sau khi F5 hiển thị bản mới; lưu ở tab B với bản cũ không làm mất trường A đã đổi nếu hai bên sửa trường khác nhau", "Tích hợp", "Trung bình", UIM,
      ["Mở /settings ở 2 tab", "Tab A đổi Tên và Lưu", "Tab B (chưa F5) đổi Thành phố và Lưu", "F5 cả hai"], "-", "Vì FE chỉ gửi trường ĐÃ ĐỔI nên cả Tên (từ A) và Thành phố (từ B) đều có trong bản cuối; không bị ghi đè trường không sửa.", pw="Một phần")
    A(F, "Rate limit toàn cục: gửi dồn dập > ngưỡng PATCH /auth/me -> 429 kèm Retry-After; UI báo lỗi, không crash", "Bảo mật", "Thấp", API + " (Rate limit đang bật ở dev; tắt bằng RATE_LIMIT_DISABLED=1).", ["Gọi PATCH /api/auth/me {bio:'x'} liên tục tới khi nhận 429"], "-", "429 + header Retry-After; UI Hồ sơ hiển thị toast lỗi khi bấm Lưu lúc bị giới hạn.", pw="Không")
    A(F, "Avatar upload qua mạng lỗi giữa chừng: toast 'Không tải được ảnh' (hoặc message), nút 'Đổi ảnh đại diện' trở lại bình thường, ảnh cũ giữ nguyên", "Chức năng", "Thấp", UIM, ["Chọn ảnh rồi chuyển Offline trong DevTools ngay khi upload"], "offline", "Toast lỗi; không kẹt ở 'Đang tải ảnh…'.", pw="Một phần")
    A(F, "Ảnh đại diện sau khi lưu hiển thị ở mọi nơi: topbar, Header, bình luận/ bài viết mới, danh sách thành viên, hồ sơ công khai", "Tích hợp", "Trung bình", UIM, ["Đổi ảnh và Lưu", "Đăng một bình luận ở cộng đồng, mở danh sách thành viên và /users/<id>"], "-", "Ảnh mới hiển thị ở tất cả vị trí (có thể cần F5 với dữ liệu cache cũ); ảnh phục vụ qua /api/files/<key> công khai (purpose avatar).", pw="Một phần")
    A(F, "Hồ sơ của người dùng đã xóa: /users/<id> hiện 'Thành viên đã xóa', không lộ handle/ liên kết cũ", "Bảo mật", "Trung bình", API + " " + MUTATE, ["Người dùng T đặt handle/ liên kết rồi xóa tài khoản", "GET /users/<id của T> bằng người khác"], "-", "Dữ liệu cá nhân (handle, instagram, youtube, bio...) đã ẩn danh hóa; tên hiển thị 'Thành viên đã xóa'.", pw="Không")
    A(F, "Tìm kiếm người dùng theo handle/tên sau khi cập nhật hồ sơ phản ánh dữ liệu mới", "Tích hợp", "Thấp", UIM, ["Đổi Tên và Lưu", "Tìm tên mới ở ô tìm kiếm (nếu hỗ trợ tìm thành viên)"], "-", "Kết quả hiển thị tên mới (cột searchVector cập nhật), không còn tên cũ.", pw="Một phần")
