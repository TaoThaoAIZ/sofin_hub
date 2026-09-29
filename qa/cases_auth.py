# -*- coding: utf-8 -*-
"""Testcase bổ sung cho module AUTH (Tài khoản & Xác thực) và SEC (Bảo mật & phi chức năng).

Nguồn: backend/docs/api/identity.md, docs/features/account.md, backend/tests/{token-revocation,auth-extra}.test.ts,
backend/src/modules/auth/*, support/*, users/*. Hành vi lấy theo CODE thật (mã lỗi / thông điệp).
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
LIMIT_NOTE = ("Lưu ý: /auth/login giới hạn 10 lần đăng nhập THẤT BẠI / 15 phút / IP (đăng nhập đúng không bị đếm, skipSuccessfulRequests) - "
              "khởi động lại BE trước khi chạy nhóm case đăng nhập SAI hàng loạt.")


def load(add):
    M, MN = "AUTH", "Tài khoản & Xác thực"

    def a(feature, title, ttype, prio, status, pre, steps, data, exp, pw="Có"):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    # ------------------------------------------------------------------ ĐĂNG KÝ
    a("Đăng ký", "API đăng ký trả 200 kèm phiên, cookie refresh và user không lộ trường nội bộ",
      "Chức năng", "Cao", DONE, "Email chưa tồn tại, ví dụ qa.reg01@sofinhub.test",
      ["POST /api/auth/register với payload bên dưới",
       "Kiểm tra status, body và header Set-Cookie",
       "Gọi GET /api/auth/me với accessToken vừa nhận"],
      '{"firstName":"Lan","lastName":"Tran","email":"qa.reg01@sofinhub.test","password":"Matkhau@123"}',
      "HTTP 200 (không phải 201). Body {data:{user,accessToken}}; user có id, email, firstName='Lan', lastName='Tran', emailVerified=false, createdAt; "
      "KHÔNG có passwordHash, tokenVersion, isDemo, deletedAt. Set-Cookie refresh_token; HttpOnly; Path=/api/auth; SameSite=Lax; Max-Age=2592000 (30 ngày). "
      "GET /api/auth/me bằng accessToken trả 200 cùng user.")
    a("Đăng ký", "Đăng ký trùng email seed khác hoa/thường và có khoảng trắng hai đầu",
      "Chức năng", "Cao", DONE, "Tài khoản seed member1@sofinhub.test đã tồn tại",
      ["POST /api/auth/register với email viết hoa lẫn khoảng trắng đầu/cuối",
       "Đăng nhập lại member1@sofinhub.test / Passw0rd!x để chắc chắn tài khoản cũ không bị đổi"],
      '{"firstName":"Giả","lastName":"Mạo","email":"  MEMBER1@SofinHub.Test ","password":"Matkhau@123"}',
      "HTTP 409, error.code=CONFLICT, message 'Email này đã được đăng ký' (schema trim + lowercase email trước khi kiểm tra trùng). Không tạo tài khoản mới; "
      "đăng nhập member1 vẫn thành công.")
    a("Đăng ký", "Đăng ký thiếu toàn bộ trường trả lỗi validate theo từng trường",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/register với body {}"], "{}",
      "HTTP 400, error.code=VALIDATION_ERROR, message 'Tham số không hợp lệ', error.details.fieldErrors có đủ 4 khóa firstName, lastName, email, password.")
    a("Đăng ký", "Tên/họ chỉ gồm khoảng trắng bị từ chối với thông điệp riêng từng trường",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/register với firstName và lastName chỉ là khoảng trắng"],
      '{"firstName":"   ","lastName":"   ","email":"qa.reg02@sofinhub.test","password":"Matkhau@123"}',
      "HTTP 400 VALIDATION_ERROR; fieldErrors.firstName chứa 'Vui lòng nhập tên', fieldErrors.lastName chứa 'Vui lòng nhập họ' (trim trước khi kiểm min 1). Không tạo user.")
    a("Đăng ký", "Biên độ dài tên: 80 ký tự được chấp nhận, 81 ký tự bị từ chối",
      "Chức năng", "Thấp", DONE, "-",
      ["POST /api/auth/register với firstName = 'A' lặp 80 lần, email qa.reg03a@sofinhub.test",
       "POST /api/auth/register với firstName = 'A' lặp 81 lần, email qa.reg03b@sofinhub.test"],
      "firstName 80 và 81 ký tự; lastName='Bien'; password='Matkhau@123'",
      "Lần 1: HTTP 200, tên lưu nguyên 80 ký tự. Lần 2: HTTP 400 VALIDATION_ERROR (fieldErrors.firstName), email qa.reg03b chưa được tạo.")
    a("Đăng ký", "Biên độ dài email 180 ký tự và mật khẩu 200 ký tự",
      "Chức năng", "Thấp", DONE, "-",
      ["Đăng ký với email dài 181 ký tự (local-part 'a' lặp 160 + '@sofinhub.test' cho tổng > 180)",
       "Đăng ký với mật khẩu 201 ký tự: 'Aa@' + 'x' lặp 198"],
      "email >180 ký tự; password 201 ký tự",
      "Cả hai HTTP 400 VALIDATION_ERROR (email tối đa 180, mật khẩu tối đa 200). Mật khẩu đúng 200 ký tự thì được chấp nhận (200).")
    a("Đăng ký", "Chữ hoa không phải ASCII (Đ, Ư) không thỏa quy tắc 'chữ in hoa'",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/register với mật khẩu chỉ có chữ hoa Unicode và ký tự đặc biệt"],
      '{"email":"qa.reg04@sofinhub.test","password":"đặng@khoa1Đ"}, firstName/lastName hợp lệ',
      "HTTP 400 VALIDATION_ERROR; fieldErrors.password chứa 'Mật khẩu cần ít nhất 1 chữ in hoa' (regex /[A-Z]/ chỉ khớp A-Z).")
    a("Đăng ký", "Mật khẩu không có chữ số vẫn hợp lệ (quy tắc chỉ cần >=8, 1 hoa, 1 ký tự đặc biệt)",
      "Chức năng", "Trung bình", DONE, "Đối chiếu với cụm từ 'chữ hoa, thường, số' trong tài liệu cũ; code chỉ có 3 quy tắc",
      ["POST /api/auth/register với mật khẩu 'Abcdefg@' (không có số)"],
      '{"email":"qa.reg05@sofinhub.test","password":"Abcdefg@"}',
      "HTTP 200: mật khẩu được chấp nhận vì passwordRule không yêu cầu chữ số (cần xác nhận với sản phẩm nếu muốn siết - giá trị chưa chốt).")
    a("Đăng ký", "Mật khẩu 'abc' trả đủ 3 thông điệp lỗi trong fieldErrors",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/register với password='abc'"],
      '{"password":"abc", các trường khác hợp lệ}',
      "HTTP 400 VALIDATION_ERROR; fieldErrors.password gồm 'Mật khẩu cần ít nhất 8 ký tự', 'Mật khẩu cần ít nhất 1 chữ in hoa', 'Mật khẩu cần ít nhất 1 ký tự đặc biệt'.")
    a("Đăng ký", "Mật khẩu có khoảng trắng ở giữa/đầu/cuối được giữ nguyên (không trim) khi đăng nhập",
      "Chức năng", "Thấp", DONE, "-",
      ["Đăng ký với mật khẩu ' Ab c@123 ' (có space đầu và cuối)",
       "Đăng nhập bằng đúng chuỗi ' Ab c@123 '", "Đăng nhập bằng 'Ab c@123' (đã cắt space)"],
      "password=' Ab c@123 '",
      "Đăng ký HTTP 200. Đăng nhập chuỗi đầy đủ: 200. Đăng nhập chuỗi đã cắt space: 401 'Email hoặc mật khẩu không đúng' (mật khẩu không bị trim).")
    a("Đăng ký", "Hai request đăng ký song song cùng email: đúng 1 thành công",
      "Chức năng", "Cao", DONE, "Email qa.race01@sofinhub.test chưa tồn tại",
      ["Dùng Promise.all bắn 2 POST /api/auth/register cùng payload"],
      "Cùng email qa.race01@sofinhub.test, password 'Matkhau@123'",
      "Một request HTTP 200, request còn lại HTTP 409 CONFLICT 'Email này đã được đăng ký' (unique index chặn, P2002 được map về 409, không có 500). DB chỉ có 1 user với email đó.")
    a("Đăng ký", "UI /register: đăng ký xong tự đăng nhập, Header hiện tên người dùng",
      "Chức năng", "Cao", DONE, "Email qa.ui01@sofinhub.test chưa tồn tại; FE :5173",
      ["Mở /register", "Nhập Tên 'Lan', Họ 'Tran', email, mật khẩu 'Matkhau@123'",
       "Mở và cuộn hết Điều khoản + Chính sách bảo mật, tick đồng ý", "Bấm nút đăng ký", "Mở menu avatar ở Header"],
      "qa.ui01@sofinhub.test / Matkhau@123",
      "Đăng ký thành công, chuyển khỏi /register, Header hiện menu avatar (Hồ sơ của tôi, Cộng đồng của tôi, Cài đặt tài khoản, Đăng xuất); /settings hiện banner 'Email chưa xác thực'.")
    a("Đăng ký", "UI /register: email đã tồn tại hiển thị thông điệp lỗi từ BE, không mất dữ liệu đã nhập",
      "Giao diện", "Trung bình", DONE, "Tài khoản seed member1@sofinhub.test đã tồn tại",
      ["Mở /register, điền form hợp lệ với email member1@sofinhub.test", "Tick đồng ý điều khoản, bấm đăng ký"],
      "member1@sofinhub.test / Matkhau@123",
      "Hiện lỗi 'Email này đã được đăng ký' (thông điệp BE 409); vẫn ở /register, các ô đã nhập được giữ, nút đăng ký bật lại.")

    # ------------------------------------------------------------------ ĐĂNG NHẬP
    seeds = [
        ("admin", "Platform", "Admin", "Platform Admin, không thuộc cộng đồng nào; GET /api/me/enrollments trả []"),
        ("owner", "Olivia", "Owner", "owner của photo, yt, fin (và private-demo, paid-demo theo seed); /api/me/enrollments có role='owner'"),
        ("cadmin", "Adam", "CommunityAdmin", "admin của photo; /api/me/enrollments có photo với role='admin'"),
        ("mod", "Mia", "Moderator", "mod của photo; /api/me/enrollments có photo với role='mod'"),
        ("member1", "Minh", "Member1", "member của photo, yt, fin; /api/me/enrollments có 3 mục role='member'"),
        ("member2", "Mai", "Member2", "member của photo; /api/me/enrollments có đúng 1 mục photo"),
        ("member3", "Manh", "Member3", "member của photo; /api/me/enrollments có đúng 1 mục photo"),
        ("newbie", "Nam", "Newbie", "chưa ở cộng đồng nào; /api/me/enrollments trả []"),
    ]
    for key, fn, ln, note in seeds:
        a("Đăng nhập tài khoản seed", f"Đăng nhập bằng tài khoản seed {key}@sofinhub.test",
          "Chức năng", "Cao", DONE, f"Đã chạy db:seed. {LIMIT_NOTE}",
          [f"POST /api/auth/login với email {key}@sofinhub.test và mật khẩu {PW}",
           "GET /api/auth/me bằng accessToken", "GET /api/me/enrollments"],
          f"{key}@sofinhub.test / {PW}",
          f"HTTP 200; user.firstName='{fn}', lastName='{ln}', emailVerified=true (seed). Vai trò: {note}.")
    a("Đăng nhập tài khoản seed", "Đăng nhập bằng tài khoản banned@sofinhub.test thành công (ban chỉ áp dụng ở cấp cộng đồng photo)",
      "Chức năng", "Cao", DONE, f"banned@sofinhub.test bị cấm khỏi photo (CommunityBan). {LIMIT_NOTE}",
      [f"POST /api/auth/login với banned@sofinhub.test / {PW}", "GET /api/me/enrollments",
       "POST /api/courses/photo/enroll bằng accessToken"],
      f"banned@sofinhub.test / {PW}",
      "Login HTTP 200 (tài khoản không bị khóa toàn hệ thống). /api/me/enrollments KHÔNG chứa photo (người bị ban không được coi là thành viên). "
      "POST /api/courses/photo/enroll trả 403 FORBIDDEN 'Bạn đã bị cấm khỏi cộng đồng này'.")
    a("Đăng nhập", "Đăng nhập chuẩn hóa email: viết hoa và khoảng trắng hai đầu vẫn vào được",
      "Chức năng", "Trung bình", DONE, f"Tài khoản member1 tồn tại. {LIMIT_NOTE}",
      ["POST /api/auth/login với email '  MEMBER1@SofinHub.Test ' và mật khẩu đúng"],
      f"email='  MEMBER1@SofinHub.Test ', password='{PW}'",
      "HTTP 200, user.email = 'member1@sofinhub.test' (đã lowercase + trim).")
    a("Đăng nhập", "Đăng nhập thiếu/sai định dạng trường trả lỗi validate riêng, không phải 401",
      "Chức năng", "Trung bình", DONE, LIMIT_NOTE,
      ["POST /api/auth/login với email='abc', password='x'", "POST /api/auth/login với email hợp lệ, password=''"],
      "(1) email='abc'; (2) password=''",
      "(1) HTTP 400 VALIDATION_ERROR, fieldErrors.email chứa 'Email không hợp lệ'. (2) HTTP 400, fieldErrors.password chứa 'Vui lòng nhập mật khẩu'. Không phải 401.")
    a("Đăng nhập", "Thông điệp lỗi đăng nhập giống hệt nhau cho email không tồn tại và mật khẩu sai",
      "Bảo mật", "Cao", DONE, f"member1 tồn tại, ghost.user@sofinhub.test không tồn tại. {LIMIT_NOTE}",
      ["POST /api/auth/login: member1@sofinhub.test + mật khẩu sai 'Sai@12345'",
       "POST /api/auth/login: ghost.user@sofinhub.test + 'Passw0rd!x'", "So sánh status và body hai response"],
      "Hai cặp thông tin như trên",
      "Cả hai HTTP 401, body giống hệt: error.code=UNAUTHORIZED, message 'Email hoặc mật khẩu không đúng' (không lộ email có tồn tại).")
    a("Đăng nhập", "Thành viên minh họa (isDemo) không đăng nhập được dù dùng mật khẩu chung",
      "Bảo mật", "Trung bình", DONE, "Seed có thành viên minh họa email seed-photo-0@demo.sofinhub.invalid (id demo-photo-0)",
      [f"POST /api/auth/login với seed-photo-0@demo.sofinhub.invalid / {PW}"],
      f"seed-photo-0@demo.sofinhub.invalid / {PW}",
      "HTTP 401 'Email hoặc mật khẩu không đúng' (cờ isDemo chặn login), không có accessToken, không tạo Session.")
    a("Rate limit", "Đăng nhập SAI vượt 10 lần/15 phút/IP trả 429",
      "Bảo mật", "Cao", DONE, "BE vừa khởi động lại (bộ đếm rate limit trong bộ nhớ); NODE_ENV không phải test (limit=10)",
      ["Gửi 10 POST /api/auth/login sai mật khẩu liên tiếp với member2@sofinhub.test", "Gửi request thứ 11 (lần này dùng ĐÚNG mật khẩu)",
       "Xem header phản hồi"],
      "member2@sofinhub.test, 10 lần 'Sai@12345' rồi 1 lần 'Passw0rd!x'",
      "10 request sai đầu 401. Request thứ 11 (sai) HTTP 429, error.code=TOO_MANY_REQUESTS, message 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút'; khi IP đã bị chặn thì kể cả mật khẩu đúng cũng 429 cho đến hết cửa sổ. "
      "Có header RateLimit-* (standardHeaders). Ghi chú lệch tài liệu QA cũ: hệ thống KHÔNG khóa theo tài khoản, chỉ giới hạn theo IP (giá trị tạm / chưa chốt).")
    a("Rate limit", "Bộ đếm đăng nhập chỉ tính lần thất bại: đăng nhập đúng liên tiếp không bị 429",
      "Bảo mật", "Trung bình", DONE, "BE vừa khởi động lại; loginLimiter dùng skipSuccessfulRequests (đã sửa, trước đây đếm cả lần thành công)",
      ["Đăng nhập ĐÚNG member3@sofinhub.test 11 lần liên tiếp", "Sau đó đăng nhập SAI 10 lần rồi lần sai thứ 11"],
      f"member3@sofinhub.test / {PW} x11, rồi 11 lần mật khẩu sai",
      "11 lần đúng đều HTTP 200, không 429 (lần thành công không được đếm). Chỉ ở lần SAI thứ 11 mới HTTP 429 'Đăng nhập sai quá nhiều lần, vui lòng thử lại sau ít phút'.")
    a("Rate limit", "Sau khi bị 429 đăng nhập, đăng ký và quên mật khẩu vẫn dùng được (bộ đếm tách riêng)",
      "Chức năng", "Thấp", DONE, "IP hiện tại đã bị 429 ở /auth/login",
      ["POST /api/auth/register với email mới", "POST /api/auth/forgot-password với email bất kỳ hợp lệ"],
      "qa.rl01@sofinhub.test",
      "Register HTTP 200; forgot-password HTTP 200 (mỗi route có instance limiter riêng).")
    a("Đăng nhập", "UI /login: sai mật khẩu hiện thông điệp BE, nút đăng nhập bật lại",
      "Giao diện", "Cao", DONE, "Chưa đăng nhập",
      ["Mở /login", "Nhập member1@sofinhub.test và mật khẩu sai 'Sai@12345'", "Bấm 'Đăng nhập'"],
      "member1@sofinhub.test / Sai@12345",
      "Hiện 'Email hoặc mật khẩu không đúng'; vẫn ở /login; nút quay lại 'Đăng nhập' sau trạng thái 'Đang đăng nhập…'; không có accessToken trong bộ nhớ.")
    a("Đăng nhập", "UI /login: validate phía FE trước khi gọi API",
      "Giao diện", "Trung bình", DONE, "Chưa đăng nhập",
      ["Mở /login, để trống cả hai ô, bấm 'Đăng nhập'", "Nhập email 'abc' và mật khẩu bất kỳ, bấm lại"],
      "email trống / 'abc'",
      "Hiện lỗi tại ô (email trống/không hợp lệ, mật khẩu trống) và KHÔNG có request POST /api/auth/login nào được gửi (kiểm tra tab Network).")
    a("Đăng nhập", "Đăng nhập xong quay lại đúng trang đã bị chuyển hướng",
      "Chức năng", "Cao", DONE, "Chưa đăng nhập",
      ["Truy cập trực tiếp /settings", "Được chuyển sang /login", f"Đăng nhập bằng member1@sofinhub.test / {PW}"],
      "member1@sofinhub.test",
      "Sau đăng nhập trình duyệt ở /settings (state.from), không về trang chủ. Làm tương tự với /me/communities và /users/<id> đều quay về đúng trang.")
    a("Đăng nhập mạng xã hội", "Nút Google/Facebook ở /login chỉ hiện 'Tính năng sắp ra mắt' và không gọi API",
      "Giao diện", "Thấp", DONE, "Chưa đăng nhập",
      ["Mở /login", "Bấm nút 'Google'", "Bấm nút 'Facebook'", "Xem tab Network"], "-",
      "Dưới mỗi nút hiện dòng 'Tính năng sắp ra mắt'; không điều hướng, không có request nào tới /api/auth; người dùng vẫn là khách.")
    a("Đăng nhập mạng xã hội", "Liên kết tài khoản khi email Google/Facebook trùng tài khoản đã đăng ký",
      "Chức năng", "Trung bình", PLAN, "Chưa làm: OAuth Google/Facebook, chưa có bảng liên kết nhà cung cấp",
      ["Có tài khoản email/mật khẩu member1@sofinhub.test", "Đăng nhập bằng Google có cùng email"], "-",
      "Hệ thống nhận diện trùng email, yêu cầu xác nhận hoặc liên kết vào tài khoản hiện có, không tạo tài khoản thứ hai.", pw="Không")
    a("Xác thực 2 lớp (2FA)", "Đăng nhập tài khoản đã bật 2FA phải nhập mã OTP, sai mã bị từ chối",
      "Bảo mật", "Trung bình", PLAN, "Chưa làm: 2FA (TOTP), mã khôi phục",
      ["Bật 2FA cho owner@sofinhub.test", "Đăng xuất, đăng nhập lại bằng mật khẩu", "Nhập mã OTP sai rồi mã đúng"], "-",
      "Sau mật khẩu đúng chưa cấp phiên mà yêu cầu OTP; mã sai bị từ chối, mã đúng cấp phiên; có giới hạn số lần thử.", pw="Không")
    a("Đổi email", "Đổi email cần xác thực lại email mới, email cũ vẫn dùng đến khi xác nhận",
      "Chức năng", "Trung bình", PLAN, "Chưa làm: đổi email (identity.md mục 'Chưa làm')",
      ["Vào /settings, đổi email sang địa chỉ mới", "Mở liên kết xác thực gửi tới email mới"], "-",
      "Email chỉ đổi sau khi xác thực email mới, các phiên cũ được xử lý theo chính sách; email cũ nhận thông báo.", pw="Không")
    a("Đổi email", "Hiện tại PATCH /auth/me bỏ qua trường email (không đổi được email qua API hồ sơ)",
      "Bảo mật", "Trung bình", DONE, "Đăng nhập bằng newbie@sofinhub.test (chỉ đọc, không phá seed)",
      ["PATCH /api/auth/me với body {\"email\":\"hacker@evil.test\",\"firstName\":\"Nam\"}", "GET /api/auth/me"],
      '{"email":"hacker@evil.test","firstName":"Nam"}',
      "HTTP 200 nhưng email trong response vẫn 'newbie@sofinhub.test' (schema zod loại khóa lạ); đăng nhập bằng newbie@sofinhub.test vẫn được, hacker@evil.test không đăng nhập được.")

    # ------------------------------------------------------------------ HỒ SƠ
    a("Hồ sơ cá nhân", "GET /auth/me của member1 trả đủ trường hồ sơ và emailVerified=true",
      "Chức năng", "Trung bình", DONE, "Đăng nhập member1@sofinhub.test",
      ["GET /api/auth/me"], "-",
      "HTTP 200; data gồm id, email='member1@sofinhub.test', firstName='Minh', lastName='Member1', createdAt, emailVerified=true; không có passwordHash/tokenVersion/isDemo/deletedAt.")
    a("Hồ sơ cá nhân", "GET /auth/me với header Authorization sai dạng đều trả 401",
      "Bảo mật", "Trung bình", DONE, "Có access token hợp lệ của member1",
      ["GET /api/auth/me không có Authorization", "Dùng 'Authorization: Basic <token>'", "Dùng 'Authorization: bearer <token>' (chữ thường)",
       "Dùng 'Authorization: Bearer ' (rỗng)"],
      "token hợp lệ nhưng sai scheme",
      "Cả 4 request HTTP 401, error.code=UNAUTHORIZED, message 'Vui lòng đăng nhập để tiếp tục' (middleware so sánh chính xác tiền tố 'Bearer ').")
    a("Hồ sơ cá nhân", "UI /settings tab Hồ sơ: sửa đủ trường, lưu và giữ sau F5",
      "Chức năng", "Cao", DONE, "Đăng nhập bằng tài khoản mới đăng ký qa.prof01@sofinhub.test",
      ["Mở /settings, tab 'Hồ sơ'", "Sửa Tên 'An', Họ 'Nguyễn', Giới thiệu, Vị trí 'Hà Nội', Website 'https://example.com'",
       "Bấm 'Lưu thay đổi'", "Nhấn F5", "Mở 'Hồ sơ của tôi' từ menu avatar"],
      "bio='Xin chào SofinHub', location='Hà Nội', website='https://example.com'",
      "Hiện 'Đã lưu hồ sơ.'; Header đổi tên ngay thành 'An Nguyễn'; sau F5 giá trị vẫn giữ; trang /users/<id> hiển thị tên, bio, vị trí, website (mở tab mới, rel=noopener).")
    a("Hồ sơ cá nhân", "Biên độ dài bio: 500 ký tự lưu được, 501 ký tự bị từ chối",
      "Chức năng", "Trung bình", DONE, "Đăng nhập bằng user mới đăng ký",
      ["PATCH /api/auth/me với bio = 'x' lặp 500", "PATCH /api/auth/me với bio = 'x' lặp 501"],
      "bio 500 và 501 ký tự",
      "Lần 1 HTTP 200 (bio dài 500). Lần 2 HTTP 400 VALIDATION_ERROR, fieldErrors.bio chứa 'Giới thiệu tối đa 500 ký tự'; bio cũ không đổi.")
    a("Hồ sơ cá nhân", "Biên độ dài vị trí: 120 ký tự OK, 121 ký tự bị từ chối",
      "Chức năng", "Thấp", DONE, "Đăng nhập bằng user mới đăng ký",
      ["PATCH /api/auth/me với location 120 ký tự", "PATCH /api/auth/me với location 121 ký tự"], "location 120/121 ký tự",
      "Lần 1 HTTP 200; lần 2 HTTP 400 với 'Địa điểm tối đa 120 ký tự'.")
    a("Hồ sơ cá nhân", "Website chỉ nhận URL http/https hợp lệ",
      "Chức năng", "Trung bình", DONE, "Đăng nhập bằng user mới đăng ký",
      ["PATCH /api/auth/me lần lượt với website: 'ftp://example.com', 'example.com', 'javascript:alert(1)', 'http://example.com'"],
      "4 giá trị website như trên",
      "3 giá trị đầu HTTP 400, fieldErrors.website chứa 'Website phải là URL http/https hợp lệ'; 'http://example.com' HTTP 200 và được lưu.")
    a("Hồ sơ cá nhân", "avatarUrl chặn các scheme nguy hiểm và đường dẫn thoát thư mục",
      "Bảo mật", "Cao", DONE, "Đăng nhập bằng user mới đăng ký",
      ["PATCH /api/auth/me lần lượt avatarUrl: 'javascript:alert(1)', 'data:image/png;base64,AAAA', '//evil.test/a.png', '/files/../secret', 'Javascript:alert(1)'"],
      "5 giá trị avatarUrl như trên",
      "Cả 5 HTTP 400, thông điệp 'Ảnh đại diện phải là URL http/https hoặc đường dẫn /files/...'; avatarUrl hiện tại không đổi.")
    a("Hồ sơ cá nhân", "avatarUrl chấp nhận đường dẫn /files/... và URL https",
      "Chức năng", "Trung bình", DONE, "Đăng nhập bằng user mới đăng ký",
      ["PATCH /api/auth/me avatarUrl='/files/avatars/a.png'", "PATCH /api/auth/me avatarUrl='https://cdn.example.com/a.png'"],
      "2 giá trị hợp lệ",
      "Cả hai HTTP 200; GET /api/auth/me và GET /api/users/<id> trả đúng avatarUrl vừa lưu.")
    a("Hồ sơ cá nhân", "Đường dẫn ảnh upload /api/files/<key> được PATCH avatarUrl chấp nhận (đã sửa lệch giữa module upload và hồ sơ)",
      "Tích hợp", "Trung bình", DONE, "Đăng nhập bằng user mới; có ảnh PNG hợp lệ < 3MB",
      ["POST /api/uploads/presign với purpose='avatar', contentType 'image/png', size hợp lệ", "Tải ảnh lên uploadUrl trả về",
       "PATCH /api/auth/me với avatarUrl = fileUrl trả về (dạng '/api/files/<key>')"],
      "fileUrl = '/api/files/<key>'",
      "HTTP 200 (đã sửa: schema nhận tiền tố '/files/' và '/api/files/' cùng http(s), khớp FILE_URL_PREFIX = '/api/files/'; trước đây 400 dù upload thành công); GET /api/auth/me trả đúng avatarUrl và avatar hiển thị. "
      "Vẫn chặn: đường dẫn chứa '..' và 'javascript:' -> 400 'Ảnh đại diện phải là URL http/https hoặc đường dẫn /files/...'.")
    a("Hồ sơ cá nhân", "Chuỗi rỗng hoặc null xóa trường hồ sơ; tên không xóa được",
      "Chức năng", "Trung bình", DONE, "User có bio, location, website đã lưu",
      ["PATCH /api/auth/me {\"bio\":\"\",\"website\":null}", "GET /api/auth/me", "PATCH /api/auth/me {\"firstName\":\"\"}"],
      '{"bio":"","website":null} rồi {"firstName":""}',
      "Lần 1 HTTP 200, response không còn bio và website (location giữ nguyên). Lần 3 HTTP 400 với 'Vui lòng nhập tên' và tên cũ không đổi.")
    a("Hồ sơ cá nhân", "PATCH body rỗng {} giữ nguyên hồ sơ",
      "Chức năng", "Thấp", DONE, "User có hồ sơ đã điền",
      ["PATCH /api/auth/me với body {}", "So sánh với GET /api/auth/me trước đó"], "{}",
      "HTTP 200, dữ liệu trả về y hệt trước khi gọi; không trường nào bị xóa.")
    a("Hồ sơ cá nhân", "Bio chỉ gồm khoảng trắng: hành vi thực tế sau khi trim",
      "Chức năng", "Thấp", DONE, "Đăng nhập bằng user mới; bio đang có giá trị",
      ["PATCH /api/auth/me với bio = '   ' (3 dấu cách)", "GET /api/auth/me và mở /users/<id>"], "bio='   '",
      "HTTP 200 (không phải 400). Schema trim thành chuỗi rỗng nhưng CHỈ chuỗi '' nguyên gốc mới được đổi thành null nên bio có thể lưu là '' thay vì bị xóa - "
      "trên trang hồ sơ công khai không hiện đoạn bio nào. Ghi nhận giá trị thực tế (tài liệu chưa nêu, giá trị tạm / chưa chốt).")
    a("Hồ sơ cá nhân", "Bio chứa HTML/script được lưu nguyên và hiển thị dạng văn bản, không thực thi",
      "Bảo mật", "Cao", DONE, "Đăng nhập bằng user mới đăng ký; member1 để xem hồ sơ",
      ["PATCH /api/auth/me bio='<img src=x onerror=alert(1)><script>alert(2)</script>'", "Đăng nhập member1, mở /users/<id của user trên>"],
      "bio chứa thẻ img onerror và script",
      "PATCH HTTP 200. Trang /users/<id> hiển thị đúng chuỗi thẻ dưới dạng chữ; không có dialog alert, không có phần tử img/script được chèn vào DOM.")
    a("Hồ sơ cá nhân", "Đổi tên hiển thị được phản ánh ở bài viết cũ của chính user",
      "Tích hợp", "Trung bình", DONE, "User mới đã tham gia photo (POST /api/courses/photo/enroll) và đăng 1 bài",
      ["PATCH /api/auth/me firstName='Đổi'", "GET /api/posts/<id bài đã đăng> bằng token của member1"],
      "firstName='Đổi'", "post.author.name bắt đầu bằng 'Đổi' (tên lấy động từ bảng User, không lưu cứng vào bài).")
    a("Hồ sơ cá nhân", "UI tab Hồ sơ: xóa trống Tên/Họ hoặc nhập website/avatar sai báo lỗi tại ô",
      "Giao diện", "Trung bình", DONE, "Đăng nhập, mở /settings",
      ["Xóa trống ô Tên, bấm 'Lưu thay đổi'", "Nhập Website 'abc', lưu", "Nhập URL ảnh đại diện 'javascript:alert(1)', lưu"],
      "Tên trống; website='abc'; avatar='javascript:alert(1)'",
      "Mỗi trường báo lỗi ngay dưới ô (website: phải bắt đầu bằng http://; avatar: phải là http(s) hoặc /files/...), hồ sơ không được lưu, không hiện 'Đã lưu hồ sơ.'.")

    # ---------------------------------------------------- HỒ SƠ CÔNG KHAI / CỘNG ĐỒNG CỦA TÔI / ĐIỂM
    a("Hồ sơ công khai", "GET /users/:id không có email và chỉ liệt kê cộng đồng công khai (owner)",
      "Chức năng", "Cao", DONE, "Đăng nhập member1; biết id của owner@sofinhub.test (lấy từ GET /api/courses/photo hoặc danh sách thành viên)",
      ["GET /api/users/<ownerId>", "Rà soát toàn bộ JSON"], "id của owner@sofinhub.test",
      "HTTP 200; data có id, name='Olivia Owner', bio, location, website, avatarUrl, joinedAt, communities[], totalPoints; KHÔNG có email/passwordHash. "
      "communities có photo, yt, fin, paid-demo (role='owner') nhưng KHÔNG có private-demo (visibility riêng tư bị ẩn).")
    a("Hồ sơ công khai", "Người bị ban khỏi photo không thấy photo trong hồ sơ công khai của họ",
      "Chức năng", "Trung bình", DONE, "Đăng nhập member1; biết id của banned@sofinhub.test",
      ["GET /api/users/<bannedId>"], "id của banned@sofinhub.test",
      "HTTP 200, name='Bao Banned', communities KHÔNG chứa photo (listByUser loại người bị ban).")
    a("Hồ sơ công khai", "Hồ sơ công khai yêu cầu đăng nhập; id lạ trả 404",
      "Chức năng", "Trung bình", DONE, "Có id hợp lệ của owner",
      ["GET /api/users/<ownerId> không có Authorization", "Đăng nhập member1, GET /api/users/khong-ton-tai"], "id='khong-ton-tai'",
      "Lần 1 HTTP 401 UNAUTHORIZED. Lần 2 HTTP 404 NOT_FOUND, message 'Không tìm thấy người dùng'.")
    a("Hồ sơ công khai", "UI /users/:id: khách bị đưa về /login; id lạ hiện trang 404 thân thiện",
      "Giao diện", "Trung bình", DONE, "Có id hợp lệ",
      ["Chưa đăng nhập, mở /users/<ownerId>", "Đăng nhập member1 rồi mở /users/khong-ton-tai"], "-",
      "Lần 1 chuyển về /login, đăng nhập xong quay lại hồ sơ. Lần 2 hiện NotFound với nút về trang chủ.")
    a("Hồ sơ công khai", "Nút 'Chỉnh sửa hồ sơ' chỉ có ở hồ sơ của chính mình",
      "Giao diện", "Thấp", DONE, "Đăng nhập member1",
      ["Menu avatar > 'Hồ sơ của tôi'", "Mở hồ sơ của owner (bấm tên owner ở bảng tin/thành viên)"], "-",
      "Hồ sơ của mình có nút 'Chỉnh sửa hồ sơ' dẫn tới /settings; hồ sơ owner không có nút.")
    a("Hồ sơ công khai", "totalPoints của hồ sơ công khai khớp tổng điểm ở /me/points",
      "Chức năng", "Trung bình", DONE, "Đăng nhập member1 (có điểm từ seed)",
      ["GET /api/me/points", "GET /api/users/<id member1>"], "-",
      "data.total của /me/points bằng totalPoints của hồ sơ công khai; total = tổng points của byCourse.")
    a("Cộng đồng của tôi", "GET /me/enrollments của member1: 3 cộng đồng, vai trò member, progressPct nguyên 0-100",
      "Chức năng", "Cao", DONE, "Đăng nhập member1@sofinhub.test",
      ["GET /api/me/enrollments"], "-",
      "HTTP 200, mảng chứa photo, yt, fin; mỗi phần tử có course{id,title,thumbnail,category,visibility}, role='member', enrolledAt, progressPct là số nguyên 0..100 (làm tròn bài hoàn thành / tổng bài classroom).")
    a("Cộng đồng của tôi", "Tài khoản chưa tham gia cộng đồng: API trả mảng rỗng, UI hiện trạng thái rỗng",
      "Giao diện", "Trung bình", DONE, "Đăng nhập newbie@sofinhub.test",
      ["GET /api/me/enrollments", "Mở /me/communities"], "-",
      "API HTTP 200 data=[]. Trang hiện trạng thái rỗng và nút 'Khám phá cộng đồng' dẫn về trang chủ.")
    a("Cộng đồng của tôi", "UI /me/communities hiển thị thẻ cộng đồng với vai trò, ngày tham gia và tiến độ",
      "Giao diện", "Trung bình", DONE, "Đăng nhập member1@sofinhub.test",
      ["Mở /me/communities", "Bấm 'Vào cộng đồng' ở thẻ photo"], "-",
      "3 thẻ photo, yt, fin, mỗi thẻ có ảnh, tên, vai trò 'member', ngày tham gia, thanh % tiến độ khớp progressPct của API; nút dẫn tới /courses/photo/community.")
    a("Cộng đồng của tôi", "Chủ cộng đồng thấy role='owner' ở mọi cộng đồng sở hữu",
      "Chức năng", "Trung bình", DONE, "Đăng nhập owner@sofinhub.test",
      ["GET /api/me/enrollments"], "-",
      "Có các mục photo, yt, fin, private-demo, paid-demo với role='owner' (theo seed).")
    a("Điểm của tôi", "GET /me/points trả cấu trúc tổng, theo cộng đồng và tối đa 20 hoạt động gần nhất",
      "Chức năng", "Trung bình", DONE, "Đăng nhập member1 (có PointEvent từ seed photo)",
      ["GET /api/me/points", "Kiểm tra cấu trúc và độ dài mảng recent"], "-",
      "HTTP 200 {total, byCourse:[{course:{id,...}, points}], recent}. recent có tối đa 20 phần tử sắp mới -> cũ; total bằng tổng byCourse[].points.")
    a("Điểm của tôi", "Tài khoản chưa có điểm trả total=0 và mảng rỗng",
      "Chức năng", "Thấp", DONE, "Đăng nhập newbie@sofinhub.test (chưa có PointEvent)",
      ["GET /api/me/points"], "-", "HTTP 200 {total:0, byCourse:[], recent:[]}.")
    a("Điểm của tôi", "Đăng bài trong cộng đồng cộng 5 điểm và hiện ở khối 'Điểm của tôi'",
      "Tích hợp", "Trung bình", DONE, "Đăng nhập member2@sofinhub.test (thành viên photo). Ghi lại total trước khi thao tác",
      ["GET /api/me/points lấy total_trước", "POST /api/courses/photo/posts {\"content\":\"Bài QA điểm\"}", "GET /api/me/points lần nữa",
       "Mở /me/communities và xem khối 'Điểm của tôi'"],
      "content='Bài QA điểm'",
      "total tăng đúng 5 (đăng bài +5), byCourse của photo tăng 5, recent[0] là sự kiện mới nhất; UI hiển thị số điểm mới sau khi tải lại.")

    # ------------------------------------------------------------------ QUÊN / ĐẶT LẠI MẬT KHẨU
    a("Quên mật khẩu", "Gửi yêu cầu quên mật khẩu: thư vào outbox với link 30 phút và token không lộ trong response",
      "Chức năng", "Cao", DONE, "Tài khoản mới đăng ký qa.fp01@sofinhub.test; NODE_ENV != production",
      ["POST /api/auth/forgot-password {\"email\":\"qa.fp01@sofinhub.test\"}",
       "GET /api/dev/outbox?to=qa.fp01@sofinhub.test"],
      "email=qa.fp01@sofinhub.test",
      "Response HTTP 200 {data:{message:'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.'}}, không chứa 'token'. "
      "Outbox có thư subject 'Đặt lại mật khẩu SofinHub', text chứa 'hiệu lực 30 phút' và link dạng {FRONTEND_URL}/reset-password?token=<43 ký tự base64url>.")
    a("Quên mật khẩu", "Email không tồn tại trả đúng cùng response và không sinh thư",
      "Bảo mật", "Cao", DONE, "ghost.fp@sofinhub.test chưa đăng ký",
      ["POST /api/auth/forgot-password với email tồn tại (member2@sofinhub.test)", "POST với ghost.fp@sofinhub.test",
       "So sánh hai body", "GET /api/dev/outbox?to=ghost.fp@sofinhub.test"], "2 email như trên",
      "Hai response cùng HTTP 200 và body giống hệt; outbox của ghost.fp@sofinhub.test rỗng (không lộ tài khoản có tồn tại).")
    a("Quên mật khẩu", "Email sai định dạng hoặc rỗng trả 400",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/forgot-password {\"email\":\"abc\"}", "POST với {\"email\":\"\"}", "POST với {}"], "abc / '' / thiếu",
      "Cả ba HTTP 400 VALIDATION_ERROR (fieldErrors.email); không có thư nào được gửi.")
    a("Quên mật khẩu", "Email nhập chữ hoa vẫn gửi thư tới địa chỉ chuẩn hóa",
      "Chức năng", "Thấp", DONE, "Seed member3@sofinhub.test",
      ["POST /api/auth/forgot-password {\"email\":\" MEMBER3@SOFINHUB.TEST \"}", "GET /api/dev/outbox?to=member3@sofinhub.test"],
      "email=' MEMBER3@SOFINHUB.TEST '", "Outbox của member3@sofinhub.test có thêm 1 thư 'Đặt lại mật khẩu SofinHub' (email đã trim + lowercase).")
    a("Quên mật khẩu", "Yêu cầu lần 2 làm vô hiệu link đã gửi lần 1",
      "Bảo mật", "Cao", DONE, "Tài khoản mới qa.fp02@sofinhub.test",
      ["Gửi forgot-password 2 lần cho qa.fp02@sofinhub.test, lấy token1 (thư đầu) và token2 (thư sau) từ outbox",
       "POST /api/auth/reset-password với token1 và mật khẩu mới 'NewPass1!'", "POST /api/auth/reset-password với token2"],
      "token1, token2, password 'NewPass1!'",
      "token1: HTTP 400 BAD_REQUEST 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' (upsert unique (userId,purpose) ghi đè). token2: HTTP 200.")
    a("Rate limit", "Quên mật khẩu vượt 5 request/15 phút/IP trả 429",
      "Bảo mật", "Cao", DONE, "BE vừa khởi động lại; NODE_ENV != test",
      ["Gửi 5 POST /api/auth/forgot-password (bất kỳ email hợp lệ, có thể khác nhau)", "Gửi request thứ 6"],
      "5 email khác nhau rồi 1 email thứ 6",
      "5 request đầu HTTP 200; request thứ 6 HTTP 429 TOO_MANY_REQUESTS, message 'Bạn yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút'. Bộ đếm theo IP, không theo email.")
    a("Đặt lại mật khẩu", "Đặt lại thành công: đăng nhập mật khẩu mới được, mật khẩu cũ bị từ chối, cookie refresh bị xóa",
      "Chức năng", "Cao", DONE, "Tài khoản qa.rp01@sofinhub.test (mật khẩu 'Matkhau@123') đã yêu cầu forgot-password, có token",
      ["POST /api/auth/reset-password {token, password:'Reset1234!'}", "Xem header Set-Cookie", "Đăng nhập bằng mật khẩu cũ", "Đăng nhập bằng mật khẩu mới"],
      "password mới 'Reset1234!'",
      "Reset HTTP 200 message 'Đặt lại mật khẩu thành công, vui lòng đăng nhập lại' và Set-Cookie xóa refresh_token. Đăng nhập mật khẩu cũ 401; mật khẩu mới 200.")
    a("Đặt lại mật khẩu", "Token đã dùng rồi không dùng lại được",
      "Bảo mật", "Cao", DONE, "Đã reset thành công bằng token T ở case trước",
      ["POST /api/auth/reset-password lần 2 với cùng token T và mật khẩu khác 'Another1!'"], "token T đã dùng",
      "HTTP 400 BAD_REQUEST 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'; mật khẩu vẫn là 'Reset1234!'.")
    a("Đặt lại mật khẩu", "Token giả, rỗng hoặc quá dài bị từ chối với mã lỗi khác nhau",
      "Bảo mật", "Trung bình", DONE, "-",
      ["POST /api/auth/reset-password token='fake'", "POST với token=''", "POST với token là chuỗi 201 ký tự"],
      "fake / '' / 'a'*201, password 'Reset1234!'",
      "'fake': HTTP 400 BAD_REQUEST 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'. '': HTTP 400 VALIDATION_ERROR (Thiếu mã đặt lại mật khẩu). 201 ký tự: HTTP 400 VALIDATION_ERROR (max 200).")
    a("Đặt lại mật khẩu", "Mật khẩu yếu bị từ chối và KHÔNG làm cháy token; dùng lại token với mật khẩu mạnh thành công",
      "Chức năng", "Cao", DONE, "Tài khoản qa.rp02@sofinhub.test có token reset còn hạn",
      ["POST /api/auth/reset-password token + password='yeu'", "POST lại cùng token + password='Manh@1234'"],
      "'yeu' rồi 'Manh@1234'",
      "Lần 1 HTTP 400 VALIDATION_ERROR (validate trước khi tiêu thụ token). Lần 2 HTTP 200.")
    a("Đặt lại mật khẩu", "Token xác thực email dùng nhầm ở /reset-password bị từ chối và bị tiêu hủy",
      "Bảo mật", "Trung bình", DONE, "Tài khoản mới qa.rp03@sofinhub.test đã POST /auth/send-verification, có token verify V trong outbox",
      ["POST /api/auth/reset-password token=V, password 'Reset1234!'", "POST /api/auth/verify-email token=V"],
      "token verify-email V",
      "Bước 1 HTTP 400 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn' (sai purpose). Bước 2 cũng HTTP 400 vì consumeOneTimeToken đã xóa hàng token trước khi kiểm purpose "
      "(hành vi thực tế: dùng nhầm loại sẽ đốt token, người dùng phải gửi lại email xác thực). Mật khẩu không bị đổi.")
    a("Đặt lại mật khẩu", "Token reset hết hạn sau 30 phút bị từ chối",
      "Bảo mật", "Cao", DONE, "Có token reset; quyền sửa DB test hoặc chỉnh đồng hồ máy chủ",
      ["Yêu cầu forgot-password cho qa.rp04@sofinhub.test", "UPDATE \"OneTimeToken\" SET \"expiresAt\" = now() - interval '1 minute' WHERE purpose = reset của user đó (hoặc chờ >30 phút)",
       "POST /api/auth/reset-password với token"],
      "TTL reset = 30 phút", "HTTP 400 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn'; mật khẩu cũ vẫn dùng được. Token hết hạn cũng bị xóa khỏi bảng.", pw="Không")
    a("Đặt lại mật khẩu", "UI /reset-password: mật khẩu yếu/không khớp báo lỗi, thành công thì token dùng lại ra trang 'Liên kết không hợp lệ'",
      "Giao diện", "Cao", DONE, "Có link reset lấy từ /api/dev/outbox?to=qa.rp05@sofinhub.test",
      ["Mở link reset", "Nhập mật khẩu yếu 'abc', rồi nhập mật khẩu mạnh nhưng ô xác nhận khác", "Nhập 'Matkhau@123' + xác nhận đúng, bấm gửi",
       "Mở lại đúng link cũ"],
      "Matkhau@123",
      "Lỗi hiện tại ô cho hai trường hợp đầu; thành công hiện 'Đã đặt lại mật khẩu' + nút Đăng nhập. Mở lại link: trang 'Liên kết không hợp lệ' với nút 'Yêu cầu liên kết mới'. "
      "/reset-password không có token hoặc token bậy cũng ra trang này.")
    a("Quên mật khẩu", "UI /forgot-password: validate email và thông điệp thành công",
      "Giao diện", "Trung bình", DONE, "Chưa đăng nhập",
      ["Từ /login bấm 'Quên mật khẩu?'", "Bấm gửi khi để trống", "Nhập 'abc' rồi gửi", "Nhập member2@sofinhub.test rồi gửi",
       "Lặp lại với email không tồn tại"],
      "trống / abc / member2@sofinhub.test / ghost@sofinhub.test",
      "Trống: 'Vui lòng nhập email'. 'abc': 'Email không hợp lệ'. Hai trường hợp email hợp lệ hiện cùng một thông điệp thành công.")

    # ------------------------------------------------------------------ ĐỔI MẬT KHẨU
    a("Đổi mật khẩu", "Đổi mật khẩu cần đăng nhập: thiếu token trả 401",
      "Bảo mật", "Trung bình", DONE, "-",
      ["POST /api/auth/change-password không có Authorization"], '{"currentPassword":"a","newPassword":"NewPass1!"}',
      "HTTP 401 UNAUTHORIZED 'Vui lòng đăng nhập để tiếp tục'.")
    a("Đổi mật khẩu", "Sai mật khẩu hiện tại trả 400 (không phải 401) và phiên vẫn còn hiệu lực",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.cp01@sofinhub.test (dùng user tự đăng ký, KHÔNG dùng seed vì làm đổi mật khẩu chung)",
      ["POST /api/auth/change-password {currentPassword:'Sai@12345', newPassword:'NewPass1!'}", "GET /api/auth/me bằng cùng token"],
      "currentPassword sai",
      "HTTP 400 BAD_REQUEST 'Mật khẩu hiện tại không đúng'; GET /auth/me vẫn 200 (không bị hiểu nhầm là hết phiên).")
    a("Đổi mật khẩu", "Mật khẩu mới trùng mật khẩu cũ hoặc yếu bị từ chối",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.cp02@sofinhub.test, mật khẩu hiện tại 'Matkhau@123'",
      ["POST change-password newPassword='Matkhau@123'", "POST change-password newPassword='weak'"],
      "newPassword trùng cũ / 'weak'",
      "Lần 1: HTTP 400 'Mật khẩu mới không được trùng mật khẩu hiện tại'. Lần 2: HTTP 400 VALIDATION_ERROR (3 thông điệp quy tắc mật khẩu). Mật khẩu không đổi.")
    a("Đổi mật khẩu", "Đổi mật khẩu thành công: message, đăng nhập mật khẩu mới, mật khẩu cũ hết hiệu lực",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.cp03@sofinhub.test, mật khẩu 'Matkhau@123'",
      ["POST change-password {currentPassword:'Matkhau@123', newPassword:'NewPass1!'}", "Đăng nhập bằng 'NewPass1!'", "Đăng nhập bằng 'Matkhau@123'"],
      "NewPass1!", "HTTP 200 message 'Đổi mật khẩu thành công'. Đăng nhập mật khẩu mới 200, mật khẩu cũ 401.")
    a("Đổi mật khẩu", "UI tab Mật khẩu: lỗi sai mật khẩu hiện tại hiện dưới ô, thành công báo các thiết bị khác bị đăng xuất",
      "Giao diện", "Cao", DONE, "Đăng nhập bằng user mới qa.cp04@sofinhub.test ở 2 trình duyệt",
      ["Trình duyệt 1: /settings > 'Mật khẩu', nhập sai mật khẩu hiện tại", "Nhập đúng, mật khẩu mới 'NewPass1!' + xác nhận khớp, gửi",
       "Trình duyệt 2: F5 hoặc thao tác cần đăng nhập"],
      "NewPass1!",
      "Sai mật khẩu hiện tại: lỗi ngay dưới ô 'Mật khẩu hiện tại', không bị đăng xuất. Đúng: 'Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.'; trình duyệt 1 vẫn đăng nhập; trình duyệt 2 bị đưa về trạng thái khách.",
      pw="Một phần")

    # ------------------------------------------------------------------ XÁC THỰC EMAIL
    a("Xác thực email", "Tài khoản seed đã xác thực: gửi xác thực trả 409 và không hiện banner",
      "Chức năng", "Trung bình", DONE, "Đăng nhập member1@sofinhub.test (emailVerified=true trong seed)",
      ["POST /api/auth/send-verification", "Mở /settings"], "-",
      "HTTP 409 CONFLICT 'Email đã được xác thực'; không có thư mới trong outbox; /settings không hiện banner 'Email chưa xác thực'.")
    a("Xác thực email", "Gửi thư xác thực: 202, thư trong outbox có link 24 giờ, response không chứa token",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.ve01@sofinhub.test (emailVerified=false)",
      ["POST /api/auth/send-verification bằng token của user", "GET /api/dev/outbox?to=qa.ve01@sofinhub.test"], "-",
      "HTTP 202 {data:{message:'Đã gửi email xác thực'}}, body không chứa 'token='. Outbox có thư subject 'Xác thực email SofinHub', text 'hiệu lực 24 giờ' và link {FRONTEND_URL}/verify-email?token=...")
    a("Xác thực email", "Không có token thì gửi xác thực trả 401",
      "Bảo mật", "Thấp", DONE, "-", ["POST /api/auth/send-verification không Authorization"], "-", "HTTP 401 UNAUTHORIZED.")
    a("Xác thực email", "Cooldown 60 giây khi gửi lại; sau 60 giây gửi được và link cũ bị vô hiệu",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.ve02@sofinhub.test đã gửi 1 lần (token1)",
      ["POST /api/auth/send-verification ngay lần 2", "Chờ 61 giây, gửi lần 3 (token2)", "POST /api/auth/verify-email với token1", "POST với token2"],
      "TTL cooldown 60s",
      "Lần 2: HTTP 429 TOO_MANY_REQUESTS 'Vui lòng đợi 60 giây trước khi yêu cầu gửi lại email xác thực'. Lần 3: 202. token1: 400 'Liên kết xác thực không hợp lệ hoặc đã hết hạn' (bị ghi đè); token2: 200.")
    a("Xác thực email", "Xác thực thành công: emailVerified=true, dùng lại token bị từ chối",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.ve03@sofinhub.test có token verify V",
      ["POST /api/auth/verify-email {token:V}", "GET /api/auth/me", "POST verify-email lần 2 với V", "POST /api/auth/send-verification"],
      "token V",
      "Lần 1: HTTP 200, data là AuthUser với emailVerified=true; /auth/me cũng true. Lần 2: HTTP 400 'Liên kết xác thực không hợp lệ hoặc đã hết hạn'. send-verification: 409 'Email đã được xác thực'.")
    a("Xác thực email", "Token verify sai, thiếu hoặc quá dài",
      "Bảo mật", "Trung bình", DONE, "-",
      ["POST /api/auth/verify-email {token:'abc'}", "POST với {}", "POST với token 201 ký tự"], "abc / thiếu / 'a'*201",
      "'abc': HTTP 400 BAD_REQUEST 'Liên kết xác thực không hợp lệ hoặc đã hết hạn'. Thiếu và 201 ký tự: HTTP 400 VALIDATION_ERROR.")
    a("Xác thực email", "Mở link xác thực của A khi đang đăng nhập B: A được xác thực, B không bị đổi",
      "Bảo mật", "Trung bình", DONE, "Hai user mới A (qa.ve04a@...) và B (qa.ve04b@...); A đã gửi thư xác thực",
      ["Đăng nhập B trên trình duyệt", "Mở /verify-email?token=<token của A>", "GET /api/auth/me của B", "Đăng nhập A, GET /api/auth/me"],
      "token của A",
      "Trang báo xác thực thành công; /auth/me của B vẫn emailVerified=false và thông tin B không đổi; của A emailVerified=true (verify-email không phụ thuộc phiên đăng nhập).")
    a("Xác thực email", "Token verify hết hạn sau 24 giờ bị từ chối",
      "Bảo mật", "Trung bình", DONE, "Có token verify; quyền sửa DB test",
      ["Gửi thư xác thực cho qa.ve05@sofinhub.test", "Đặt OneTimeToken.expiresAt của purpose verify-email về quá khứ", "POST /api/auth/verify-email"],
      "TTL 24 giờ", "HTTP 400 'Liên kết xác thực không hợp lệ hoặc đã hết hạn'; emailVerified vẫn false.", pw="Không")
    a("Xác thực email", "UI banner 'Email chưa xác thực': gửi, đếm ngược 60s, xác thực xong banner biến mất",
      "Giao diện", "Cao", DONE, "Đăng nhập user mới qa.ve06@sofinhub.test",
      ["Mở /settings, thấy banner vàng", "Bấm 'Gửi email xác thực'", "Lấy link từ /api/dev/outbox và mở /verify-email?token=...", "Quay lại /settings (F5 nếu cần)"],
      "-",
      "Sau khi gửi nút thành 'Gửi lại sau 60s' đếm ngược; trang verify hiện 'Email của bạn đã được xác thực'; /settings không còn banner. "
      "Mở /verify-email không token: báo thiếu mã; mở lại link cũ: báo lỗi kèm nút mở Cài đặt.")
    a("Xác thực email", "Bắt buộc email đã xác thực trước một số thao tác (đăng bài, thanh toán)",
      "Chức năng", "Trung bình", PLAN, "Chưa làm: chính sách bắt buộc emailVerified là quyết định sản phẩm (identity.md 'Chưa làm')",
      ["Đăng ký user mới chưa xác thực", "Thử đăng bài / thanh toán"], "-",
      "Theo chính sách được chốt: bị chặn với mã lỗi riêng và hướng dẫn xác thực email; hiện tại chưa chặn.", pw="Không")

    # ------------------------------------------------------------------ PHIÊN / LOGOUT
    a("Phiên đăng nhập", "Danh sách phiên: đúng trường, đúng 1 phiên current, không lộ thông tin refresh token",
      "Chức năng", "Cao", DONE, "Tài khoản mới qa.se01@sofinhub.test, đăng nhập thêm 1 lần với User-Agent 'QA-Agent/2'",
      ["GET /api/auth/sessions bằng token phiên thứ 2", "Kiểm tra từng phần tử"], "User-Agent 'QA-Agent/2'",
      "HTTP 200, 2 phần tử sắp theo createdAt tăng dần, mỗi phần tử {id, createdAt, lastUsedAt, ip?, userAgent?, current}. Đúng 1 phần tử current=true (phiên 2) có userAgent='QA-Agent/2'. "
      "Không có refreshTokenHash/jti/revokedAt trong JSON.")
    a("Phiên đăng nhập", "Thu hồi phiên khác: 204, lần 2 trả 404",
      "Chức năng", "Cao", DONE, "Tài khoản mới có 2 phiên (S1, S2)",
      ["Dùng token S2: DELETE /api/auth/sessions/<id S1>", "DELETE lại đúng id đó", "GET /api/auth/sessions"], "id phiên S1",
      "Lần 1 HTTP 204; lần 2 HTTP 404 NOT_FOUND 'Không tìm thấy phiên đăng nhập'; danh sách còn 1 phiên (S2).")
    a("Phiên đăng nhập", "Không thu hồi được phiên của người khác (IDOR): 404 và phiên nạn nhân còn sống",
      "Bảo mật", "Cao", DONE, "Hai user mới A và B; lấy id phiên của B qua GET /auth/sessions bằng token B",
      ["Dùng token A: DELETE /api/auth/sessions/<id phiên của B>", "Dùng token B: GET /api/auth/me"], "id phiên của B",
      "Bước 1 HTTP 404 'Không tìm thấy phiên đăng nhập' (không lộ phiên có tồn tại); bước 2 HTTP 200 - phiên B không bị ảnh hưởng.")
    a("Phiên đăng nhập", "DELETE /auth/sessions/:id với id không hợp lệ trả 404, không phải 500",
      "Chức năng", "Thấp", DONE, "Đăng nhập user bất kỳ",
      ["DELETE /api/auth/sessions/abc", "DELETE /api/auth/sessions/00000000-0000-0000-0000-000000000000"], "id rác",
      "Cả hai HTTP 404 'Không tìm thấy phiên đăng nhập' (cột id kiểu chuỗi nên không lỗi cast).")
    a("Phiên đăng nhập", "Gọi API tự thu hồi phiên hiện tại: 204 và token chết ngay (FE ẩn nút này)",
      "Chức năng", "Thấp", DONE, "Đăng nhập user mới",
      ["GET /api/auth/sessions lấy id phiên current", "DELETE /api/auth/sessions/<id current>", "GET /api/auth/me bằng cùng token"], "-",
      "DELETE HTTP 204 (API không chặn thu hồi phiên hiện tại); GET /auth/me sau đó HTTP 401. UI tab 'Phiên đăng nhập' không hiện nút 'Thu hồi' cho phiên hiện tại.")
    a("Phiên đăng nhập", "UI tab Phiên đăng nhập: thu hồi phiên ở trình duyệt khác",
      "Giao diện", "Cao", DONE, "Đăng nhập cùng user mới ở 2 trình duyệt/context (Chrome và một context khác)",
      ["Trình duyệt 1: /settings > 'Phiên đăng nhập'", "Kiểm tra nhãn phiên hiện tại và thông tin thiết bị/IP/thời gian", "Bấm 'Thu hồi' ở phiên kia",
       "Trình duyệt 2: thao tác gọi API (F5 hoặc mở /settings)"], "-",
      "Phiên hiện tại có nhãn và không có nút 'Thu hồi'; phiên kia biến mất khỏi danh sách; trình duyệt 2 bị coi là khách ngay ở request kế tiếp (access token bị thu hồi tức thì, refresh cũng 401).",
      pw="Một phần")
    a("Đăng xuất", "UI 'Đăng xuất mọi thiết bị': hộp xác nhận, về /login, mọi trình duyệt bị đăng xuất",
      "Chức năng", "Cao", DONE, "Đăng nhập cùng user mới ở 2 trình duyệt",
      ["/settings > 'Phiên đăng nhập' > 'Đăng xuất mọi thiết bị'", "Bấm Hủy ở hộp thoại rồi bấm lại và OK", "Kiểm tra trình duyệt 2"], "-",
      "Hộp thoại 'Đăng xuất khỏi tất cả thiết bị, kể cả thiết bị này?'; Hủy thì không đổi gì; OK thì về /login và trình duyệt 2 cũng mất phiên.",
      pw="Một phần")
    a("Đăng xuất", "POST /auth/logout thiếu access token trả 401 và không xóa cookie",
      "Bảo mật", "Thấp", DONE, "Có cookie refresh_token hợp lệ nhưng không gửi Bearer",
      ["POST /api/auth/logout chỉ kèm Cookie, không Authorization", "POST /api/auth/refresh kèm cookie đó"], "-",
      "Logout HTTP 401 (requireAuth), response không có Set-Cookie xóa cookie; refresh sau đó vẫn 200 - ghi nhận: FE phải xử lý logout khi access token đã hết hạn.")
    a("Đăng xuất", "Logout thành công xóa cookie refresh và trả 204",
      "Chức năng", "Trung bình", DONE, "Đăng nhập user mới",
      ["POST /api/auth/logout với Bearer", "Xem header Set-Cookie", "POST /api/auth/refresh với cookie cũ"], "-",
      "HTTP 204 không body; Set-Cookie refresh_token có giá trị rỗng/hết hạn, Path=/api/auth; refresh bằng cookie cũ HTTP 401.")
    a("Làm mới phiên", "POST /auth/refresh không có cookie trả 401 'Chưa đăng nhập'",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/auth/refresh không kèm cookie"], "-", "HTTP 401 UNAUTHORIZED, message 'Chưa đăng nhập'.")
    a("Làm mới phiên", "Refresh xoay token nhưng giữ nguyên id phiên và số lượng phiên",
      "Chức năng", "Cao", DONE, "Đăng nhập user mới, có cookie C1 và id phiên S",
      ["POST /api/auth/refresh với C1", "GET /api/auth/sessions bằng accessToken mới"], "-",
      "HTTP 200 kèm accessToken mới và Set-Cookie refresh_token mới (khác C1); danh sách phiên vẫn 1 phần tử và id = S (sid ổn định), lastUsedAt được cập nhật.")

    # ------------------------------------------------------------------ XÓA TÀI KHOẢN
    a("Xóa tài khoản", "Xóa tài khoản: thiếu token 401, thiếu mật khẩu 400, sai mật khẩu 400",
      "Chức năng", "Cao", DONE, "User mới qa.del01@sofinhub.test",
      ["DELETE /api/auth/me không token", "DELETE /api/auth/me với body {}", "DELETE với password='Sai@12345'", "Đăng nhập lại bằng mật khẩu đúng"], "-",
      "401 UNAUTHORIZED; 400 VALIDATION_ERROR (thiếu password); 400 BAD_REQUEST 'Mật khẩu không đúng'; tài khoản vẫn còn, đăng nhập lại thành công.")
    a("Xóa tài khoản", "Owner cộng đồng không xóa được tài khoản: 409 kèm hướng dẫn chuyển quyền",
      "Chức năng", "Cao", DONE, f"Đăng nhập owner@sofinhub.test (owner photo, yt, fin, ...). Case này không phá seed",
      ["DELETE /api/auth/me {\"password\":\"Passw0rd!x\"}", "Đăng nhập lại owner@sofinhub.test"], f"password={PW}",
      "HTTP 409 CONFLICT 'Bạn đang là chủ của một cộng đồng, hãy chuyển quyền sở hữu trước khi xóa tài khoản'; đăng nhập lại vẫn thành công, quyền owner giữ nguyên. "
      "(Chưa có API chuyển quyền owner nên người dùng chưa gỡ được điều kiện này - giá trị chưa chốt.)")
    a("Xóa tài khoản", "Xóa thành công: 204, ẩn danh hóa hàng User, không đăng nhập lại được",
      "Chức năng", "Cao", DONE, "User mới qa.del02@sofinhub.test đã đăng nhập ở 2 phiên",
      ["DELETE /api/auth/me {\"password\":\"Matkhau@123\"}", "Đăng nhập lại bằng email/mật khẩu cũ", "Kiểm tra bảng User trong DB"], "Matkhau@123",
      "HTTP 204. Login lại 401 'Email hoặc mật khẩu không đúng'. DB: email='deleted-<id>@deleted.invalid', firstName='Thành viên', lastName='đã xóa', bio/website=null, deletedAt có giá trị, không còn Session chưa thu hồi.",
      pw="Một phần")
    a("Xóa tài khoản", "Sau xóa, bài viết và bình luận cũ được giữ và hiển thị 'Thành viên đã xóa'",
      "Chức năng", "Cao", DONE, "User X mới đã tham gia photo, đăng 1 bài và 1 bình luận; member1 dùng để xem",
      ["X xóa tài khoản", "member1: GET /api/posts/<id bài của X>", "member1: GET /api/posts/<id>/comments"], "-",
      "post.author.name = 'Thành viên đã xóa' và comment.author.name = 'Thành viên đã xóa'; nội dung bài/bình luận còn nguyên.")
    a("Xóa tài khoản", "Sau xóa, X bị rút khỏi cộng đồng, thông báo bị xóa, hồ sơ công khai 404",
      "Chức năng", "Trung bình", DONE, "User X mới đã tham gia photo",
      ["Ghi số thành viên photo", "X xóa tài khoản", "member1: GET /api/users/<id X>", "Xem lại số thành viên photo"], "-",
      "HTTP 404 'Không tìm thấy người dùng' cho hồ sơ; số thành viên photo giảm đúng 1; X không còn trong danh sách thành viên.")
    a("Xóa tài khoản", "Sau xóa, điểm và thanh toán của user vẫn được giữ trong DB",
      "Chức năng", "Trung bình", DONE, "User Y mới có PointEvent (đăng bài) và 1 giao dịch thanh toán (paid-demo, MockGateway)",
      ["Đếm PointEvent và Payment của Y", "Y xóa tài khoản", "Đếm lại"], "-",
      "Số PointEvent và Payment không đổi (identity.md: giữ có chủ đích); user chỉ bị ẩn danh hóa.", pw="Không")
    a("Xóa tài khoản", "Email cũ đăng ký lại được và tài khoản mới không dính dữ liệu cũ",
      "Chức năng", "Trung bình", DONE, "User Z (qa.del03@sofinhub.test) đã xóa tài khoản",
      ["POST /api/auth/register với cùng email qa.del03@sofinhub.test", "GET /api/me/points và /api/me/enrollments bằng token mới"], "Matkhau@123",
      "Đăng ký HTTP 200, id mới khác id cũ; /me/points total=0, /me/enrollments=[]; không có bài viết cũ gắn vào tài khoản mới.")
    a("Xóa tài khoản", "UI tab 'Xóa tài khoản': xác nhận, hủy, thành công về trang chủ dạng khách",
      "Giao diện", "Cao", DONE, "Đăng nhập user mới qa.del04@sofinhub.test",
      ["/settings > 'Xóa tài khoản'", "Bấm 'Xóa tài khoản vĩnh viễn' khi bỏ trống mật khẩu", "Nhập sai mật khẩu", "Nhập đúng, bấm nút, Hủy hộp thoại confirm",
       "Bấm lại và OK"], "Matkhau@123",
      "Trống/sai: lỗi ngay ô mật khẩu. Hủy confirm ('Xóa vĩnh viễn tài khoản? Hành động này không thể hoàn tác.') thì không xóa. OK: về trang chủ ở trạng thái khách; đăng nhập lại thất bại.")

    # ------------------------------------------------------------------ NEWSLETTER / LIÊN HỆ
    a("Bản tin", "Đăng ký bản tin lần đầu: 200 và thư chào trong outbox",
      "Chức năng", "Trung bình", DONE, "Email qa.news01@sofinhub.test chưa đăng ký bản tin",
      ["POST /api/newsletter {\"email\":\"qa.news01@sofinhub.test\"}", "GET /api/dev/outbox?to=qa.news01@sofinhub.test"], "-",
      "HTTP 200 {data:{subscribed:true}}; outbox có thư subject 'Chào mừng bạn đến với bản tin SofinHub'.")
    a("Bản tin", "Đăng ký lại cùng email (kể cả khác hoa/thường): vẫn 200 nhưng không gửi thêm thư",
      "Chức năng", "Trung bình", DONE, "qa.news01@sofinhub.test đã đăng ký ở case trước",
      ["POST /api/newsletter với ' QA.News01@SofinHub.test '", "GET /api/dev/outbox?to=qa.news01@sofinhub.test"], "-",
      "HTTP 200 {subscribed:true} (idempotent); outbox vẫn chỉ 1 thư chào.")
    a("Bản tin", "Email sai định dạng bị từ chối",
      "Chức năng", "Thấp", DONE, "-",
      ["POST /api/newsletter với 'abc'", "POST /api/newsletter với {}"], "abc / thiếu", "Cả hai HTTP 400 VALIDATION_ERROR (fieldErrors.email); không tạo đăng ký.")
    a("Bản tin", "Hủy đăng ký bản tin idempotent, kể cả email chưa từng đăng ký",
      "Chức năng", "Thấp", DONE, "-",
      ["POST /api/newsletter/unsubscribe với qa.news01@sofinhub.test", "POST lại lần 2", "POST với ghost.news@sofinhub.test chưa từng đăng ký"], "-",
      "Cả ba HTTP 200 {unsubscribed:true}.")
    a("Bản tin", "Hủy bản tin không cần xác thực chủ sở hữu email (hạn chế đã biết)",
      "Bảo mật", "Trung bình", PLAN, "Chưa làm: link hủy có token ký trong email (identity.md 'Chưa làm')",
      ["Người lạ gọi POST /api/newsletter/unsubscribe với email của người khác"], "email nạn nhân",
      "Sau khi làm: chỉ hủy được khi có token hợp lệ từ thư; hiện tại bất kỳ ai biết email đều hủy được.", pw="Không")
    a("Rate limit", "Bản tin vượt 10 request/15 phút/IP trả 429",
      "Bảo mật", "Trung bình", DONE, "BE vừa khởi động lại; NODE_ENV != test",
      ["Gửi 10 POST /api/newsletter với 10 email khác nhau", "Gửi request thứ 11"], "qa.news10..@sofinhub.test",
      "10 request đầu 200; thứ 11 HTTP 429 TOO_MANY_REQUESTS 'Bạn thao tác quá nhiều lần, vui lòng thử lại sau ít phút'.")
    a("Bản tin", "UI Footer 'Nhận bản tin': thành công, gửi lại vẫn thành công, nút khóa khi đang gửi",
      "Giao diện", "Thấp", DONE, "Ở trang chủ /",
      ["Cuộn xuống Footer", "Nhập email hợp lệ và bấm gửi", "Gửi lại cùng email", "Nhập email sai định dạng"], "qa.news02@sofinhub.test / abc",
      "Hiện 'Cảm ơn bạn đã đăng ký!' cả hai lần; email sai hiện lỗi của trình duyệt/BE và không có thông báo thành công.")
    a("Liên hệ", "Gửi liên hệ hợp lệ: 202, thư tới hộp hỗ trợ có tiêu đề '[Liên hệ] ...'",
      "Chức năng", "Trung bình", DONE, "SUPPORT_EMAIL mặc định support@sofinhub.local",
      ["POST /api/contact với payload bên dưới", "GET /api/dev/outbox?to=support@sofinhub.local"],
      '{"name":"Nguyễn Văn A","email":"a@example.com","subject":"Hỏi về gói","message":"Xin chào"}',
      "HTTP 202 {data:{message:'Chúng tôi đã nhận được tin nhắn và sẽ phản hồi sớm.'}}; outbox có thư subject '[Liên hệ] Hỏi về gói', text bắt đầu 'Từ: Nguyễn Văn A <a@example.com>'.")
    a("Liên hệ", "Từng trường bắt buộc: bỏ trống hoặc chỉ khoảng trắng trả 400 đúng thông điệp",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/contact lần lượt với name='   ', subject='', message=' ', email='abc'"], "4 lần gọi, mỗi lần 1 trường sai",
      "Đều HTTP 400 VALIDATION_ERROR với thông điệp: 'Vui lòng nhập họ tên' / 'Vui lòng nhập tiêu đề' / 'Vui lòng nhập nội dung' / 'Email không hợp lệ'; không có thư trong outbox.")
    a("Liên hệ", "Biên độ dài nội dung: 5000 ký tự OK, 5001 ký tự bị từ chối",
      "Chức năng", "Trung bình", DONE, "-",
      ["POST /api/contact với message = 'a' lặp 5000", "POST với message = 'a' lặp 5001"], "5000 / 5001 ký tự",
      "Lần 1 HTTP 202; lần 2 HTTP 400 với 'Nội dung tối đa 5000 ký tự'. Với name 121 ký tự hoặc subject 201 ký tự cũng 400.")
    a("Liên hệ", "Tiêu đề chứa xuống dòng/HTML không phá cấu trúc thư và không thực thi",
      "Bảo mật", "Trung bình", DONE, "-",
      ["POST /api/contact với subject 'Test\\r\\nBcc: victim@example.com' và message '<script>alert(1)</script>'", "GET /api/dev/outbox?to=support@sofinhub.local"],
      "subject chứa CRLF, message chứa script",
      "HTTP 202 hoặc 400 (nếu bị chặn); nếu 202 thì thư trong outbox không tạo thêm người nhận (không có Bcc/to thứ hai) và nội dung là text thuần. Ghi nhận thực tế vào báo cáo.", pw="Một phần")
    a("Rate limit", "Liên hệ vượt 5 request/15 phút/IP trả 429",
      "Bảo mật", "Cao", DONE, "BE vừa khởi động lại; NODE_ENV != test",
      ["Gửi 5 POST /api/contact hợp lệ", "Gửi lần thứ 6"], "payload hợp lệ bất kỳ",
      "5 lần đầu 202; lần 6 HTTP 429 TOO_MANY_REQUESTS 'Bạn thao tác quá nhiều lần, vui lòng thử lại sau ít phút'. UI /contact hiện thông điệp 'quá nhiều yêu cầu' từ BE.")
    a("Liên hệ", "UI /contact: bỏ trống báo lỗi tại ô, gửi thành công làm trống form",
      "Giao diện", "Trung bình", DONE, "Mở /contact từ link 'Liên hệ' ở Footer",
      ["Bấm gửi khi bỏ trống", "Điền đủ Họ tên, Email, Tiêu đề, Nội dung và gửi"], "-",
      "Trống: lỗi tại từng ô. Đủ: thông báo thành công (BE 202) và các ô được làm trống.")

    # ==================================================================== SEC
    M, MN = "SEC", "Bảo mật & Yêu cầu phi chức năng"

    def s(feature, title, ttype, prio, status, pre, steps, data, exp, pw="Có"):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    T = "Dùng 2 user mới đăng ký (không dùng seed): S1 là access token lúc đăng ký, S2 là token từ lần đăng nhập thứ hai."

    s("Thu hồi token tức thì", "Đổi mật khẩu: token của phiên KHÁC chết ngay, token phiên hiện tại vẫn dùng được",
      "Bảo mật", "Cao", DONE, T,
      ["GET /api/auth/me bằng S1 và S2 đều 200", "POST /api/auth/change-password bằng S2 {currentPassword:'Matkhau@123', newPassword:'NewPass1!'}",
       "GET /api/auth/me bằng S1", "GET /api/auth/me bằng S2", "Đọc User.tokenVersion trong DB"], "-",
      "Đổi mật khẩu HTTP 200. S1 -> 401 ngay (không chờ 15 phút); S2 -> 200. tokenVersion vẫn 0 (đổi mật khẩu không tăng tv vì sẽ giết cả phiên hiện tại). Trả lời câu hỏi 'phiên khác có sống không': KHÔNG, chỉ phiên hiện tại được giữ.",
      pw="Có")
    s("Thu hồi token tức thì", "Sau đổi mật khẩu, refresh cookie của phiên hiện tại vẫn refresh được, của phiên khác thì không",
      "Bảo mật", "Cao", DONE, T + " Giữ cookie C1 (phiên 1) và C2 (phiên 2).",
      ["Đổi mật khẩu bằng S2", "POST /api/auth/refresh với C2", "POST /api/auth/refresh với C1"], "-",
      "C2 -> HTTP 200 (phiên hiện tại còn); C1 -> HTTP 401 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'.")
    s("Thu hồi token tức thì", "Đặt lại mật khẩu: mọi access token và refresh token cũ chết ngay, tokenVersion tăng lên 1",
      "Bảo mật", "Cao", DONE, T + " Có token reset lấy từ /api/dev/outbox.",
      ["POST /api/auth/reset-password {token, password:'Reset1234!'}", "GET /api/auth/me bằng S1 và S2", "POST /api/auth/refresh với cookie hai phiên",
       "Đăng nhập lại bằng mật khẩu mới rồi GET /api/auth/me", "Đọc User.tokenVersion"], "-",
      "S1, S2 -> 401; cả hai refresh -> 401; token mới sau đăng nhập -> 200; DB User.tokenVersion = 1 (claim 'tv' cũ = 0 không còn khớp).")
    s("Thu hồi token tức thì", "Xóa tài khoản: mọi token chết ngay và không đăng nhập lại được",
      "Bảo mật", "Cao", DONE, T,
      ["DELETE /api/auth/me bằng S2 với mật khẩu đúng", "GET /api/auth/me bằng S1 và S2", "POST /api/auth/login bằng thông tin cũ"], "-",
      "DELETE 204; S1, S2 đều 401; login 401 'Email hoặc mật khẩu không đúng'.")
    s("Thu hồi token tức thì", "Logout thu hồi mọi phiên của user (không chỉ phiên hiện tại)",
      "Bảo mật", "Cao", DONE, T + " Giữ cookie C2 của phiên 2.",
      ["POST /api/auth/logout bằng S1", "GET /api/auth/me bằng S1 và S2", "POST /api/auth/refresh với C2"], "-",
      "Logout 204. S1 và S2 đều 401 ngay; refresh với C2 401 (hành vi vốn có: logout = thu hồi toàn bộ phiên).")
    s("Thu hồi token tức thì", "Logout-all: mọi access token chết ngay và tokenVersion tăng",
      "Bảo mật", "Cao", DONE, T,
      ["POST /api/auth/logout-all bằng S2", "GET /api/auth/me bằng S1 và S2", "POST /api/auth/refresh với cookie phiên 2", "Đọc User.tokenVersion"], "-",
      "204; S1, S2 -> 401; refresh -> 401; User.tokenVersion = 1. Không có Bearer thì logout-all 401.")
    s("Thu hồi token tức thì", "Thu hồi 1 phiên: chỉ phiên đó chết, refresh cookie phiên đó cũng chết",
      "Bảo mật", "Cao", DONE, T + " Giữ cookie C1 của phiên 1.",
      ["Bằng S2: DELETE /api/auth/sessions/<id phiên 1>", "GET /api/auth/me bằng S1", "GET /api/auth/me bằng S2", "POST /api/auth/refresh với C1"], "-",
      "DELETE 204; S1 401; S2 200; refresh C1 401. tokenVersion vẫn 0.")
    s("Thu hồi token tức thì", "Xóa user hoặc hết hạn phiên trực tiếp trong DB cũng làm token 401 ngay (không cache)",
      "Bảo mật", "Trung bình", DONE, "3 user mới A, B, C có token còn hạn; quyền ghi DB test",
      ["Xóa hàng User của A trong DB", "Đặt Session.expiresAt của B về quá khứ", "User.tokenVersion của C += 1", "GET /api/auth/me bằng token cả ba"], "-",
      "Cả ba GET /auth/me -> 401 ngay (mỗi request truy vấn PK Session + User.tokenVersion, không cache).", pw="Không")
    s("JWT", "Token sai chữ ký, thuật toán none hoặc không phải JWT bị từ chối",
      "Bảo mật", "Cao", DONE, "Có access token hợp lệ của member1; ký giả bằng công cụ (jwt.io hoặc script) với secret sai",
      ["Ký lại cùng payload {sub,sid,tv} bằng secret 'sai-bi-mat'", "Tạo token alg=none (header.payload. không chữ ký)", "Gửi chuỗi 'khong.phai.jwt' và chuỗi rỗng",
       "GET /api/auth/me với từng token"], "-",
      "Tất cả HTTP 401 UNAUTHORIZED 'Vui lòng đăng nhập để tiếp tục'. Đối chứng: token ký đúng JWT_ACCESS_SECRET với payload hợp lệ vẫn 200.")
    s("JWT", "Claim sai: tv lệch, sid lạ, sid của người khác, thiếu sid/tv (token kiểu cũ) đều 401",
      "Bảo mật", "Cao", DONE, "Có JWT_ACCESS_SECRET dev; user A và B mới, token của A có payload {sub:A, sid:sA, tv:0}",
      ["Ký {sub:A, sid:sA, tv:1}", "Ký {sub:A, sid:'00000000-0000-0000-0000-000000000000', tv:0}", "Ký {sub:A, sid:sB, tv:0}", "Ký {sub:A} (không sid/tv)",
       "GET /api/auth/me với từng token"], "-",
      "Cả 4 HTTP 401. Đặc biệt {sub:A, sid:sB} phải 401 vì Session.userId != sub (không mượn phiên người khác).")
    s("JWT", "Access token hết hạn (exp) bị từ chối; TTL mặc định 15 phút",
      "Bảo mật", "Cao", DONE, "Có JWT_ACCESS_SECRET dev",
      ["Ký {sub,sid,tv} với expiresIn = -10 giây", "GET /api/auth/me", "Giải mã access token vừa cấp, so exp - iat"], "-",
      "Token hết hạn HTTP 401; exp - iat = 900 giây (ACCESS_TOKEN_TTL_MIN=15). FE gặp 401 sẽ tự gọi /auth/refresh.")
    s("JWT", "Không thay đổi được vai trò bằng sửa claim: quyền lấy từ DB",
      "Bảo mật", "Cao", DONE, "Access token của member2 (JWT_ACCESS_SECRET biết để ký thử)",
      ["Ký token {sub:member2, sid, tv, role:'admin', platformAdmin:true}", "GET /api/auth/me", "GET /api/admin/reports (chỉ Platform Admin)"], "claim role giả",
      "Token vẫn chỉ xác định user (sub); claim thừa bị bỏ qua; API quản trị trả 403 FORBIDDEN cho member2 (vai trò tính từ DB/PLATFORM_ADMIN_EMAILS, không từ token).")
    s("JWT", "Header Authorization: token đặt trong query hoặc scheme khác không được dùng cho API thường",
      "Bảo mật", "Trung bình", DONE, "Có access token hợp lệ",
      ["GET /api/auth/me?access_token=<token> không Authorization", "GET /api/auth/me với Cookie: access_token=<token>"], "-",
      "Cả hai 401 (chỉ header 'Authorization: Bearer' được đọc; access_token trên query chỉ dành cho SSE).")
    s("Refresh token", "Refresh token dùng lại (replay) bị từ chối, token mới vẫn dùng bình thường",
      "Bảo mật", "Cao", DONE, "Đăng nhập user mới, có cookie C1",
      ["POST /api/auth/refresh với C1 -> nhận cookie C2", "POST /api/auth/refresh lại với C1", "POST /api/auth/refresh với C2"], "-",
      "Lần 1 200; replay C1 -> 401 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại'; C2 vẫn 200. Ghi nhận thực tế: replay không thu hồi cả họ token/phiên (không có cơ chế phát hiện đánh cắp reuse-detection - chưa chốt).")
    s("Refresh token", "Hai request refresh song song cùng cookie: chỉ 1 thắng",
      "Bảo mật", "Cao", DONE, "Đăng nhập user mới, có cookie C1",
      ["Promise.all bắn 2 POST /api/auth/refresh với cùng C1"], "-",
      "Đúng 1 response 200 và 1 response 401 (updateMany có điều kiện là atomic); phiên vẫn còn đúng 1 hàng và không có 500.")
    s("Refresh token", "Refresh token giả, ký bằng secret khác hoặc dùng access token làm cookie đều 401",
      "Bảo mật", "Cao", DONE, "Có access token hợp lệ",
      ["POST /api/auth/refresh với Cookie: refresh_token=<access token>", "Với Cookie: refresh_token=abc.def.ghi", "Với refresh token ký bằng secret sai"], "-",
      "Cả ba HTTP 401 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' (secret refresh và access khác nhau).")
    s("Refresh token", "Refresh không thu hồi access token cũ cùng phiên (TTL 15 phút) - ghi nhận hành vi",
      "Bảo mật", "Thấp", DONE, "Đăng nhập user mới: A1 (access), C1 (cookie)",
      ["POST /api/auth/refresh với C1 nhận A2", "GET /api/auth/me bằng A1", "GET /api/auth/me bằng A2"], "-",
      "Cả A1 và A2 đều 200 vì cùng sid và tv; A1 chỉ mất hiệu lực khi hết 15 phút hoặc phiên bị thu hồi (không phải lỗi, ghi nhận để thống nhất).")
    s("Cookie", "Cookie refresh_token có HttpOnly, Path=/api/auth, Max-Age 30 ngày, SameSite=Lax (dev)",
      "Bảo mật", "Cao", DONE, "Môi trường dev (NODE_ENV != production)",
      ["POST /api/auth/login", "Xem chi tiết header Set-Cookie"], "-",
      "Set-Cookie: refresh_token=...; Max-Age=2592000; Path=/api/auth; HttpOnly; SameSite=Lax (không Secure). Production (NODE_ENV=production) phải là Secure + SameSite=None.")
    s("Cookie", "JavaScript trong trang không đọc được refresh_token và cookie không đi kèm request ngoài /api/auth",
      "Bảo mật", "Cao", DONE, "Đăng nhập trong trình duyệt tại :5173",
      ["Trong DevTools chạy document.cookie", "Xem header Cookie của GET /api/courses", "Xem header Cookie của POST /api/auth/refresh"], "-",
      "document.cookie không chứa refresh_token; request /api/courses không mang cookie này; chỉ request dưới /api/auth mới mang refresh_token.")
    s("Cookie", "Cookie refresh bị trình duyệt chặn khi POST /auth/refresh từ origin khác (SameSite=Lax)",
      "Bảo mật", "Trung bình", DONE, "Đăng nhập tại :5173; một trang tĩnh ở origin khác (ví dụ http://localhost:9999) chứa form/fetch POST tới http://localhost:4000/api/auth/refresh",
      ["Mở trang tĩnh ở origin khác", "Bấm nút submit form POST hoặc fetch có credentials"], "-",
      "Request không mang cookie refresh_token => HTTP 401 'Chưa đăng nhập'; kẻ tấn công không lấy được accessToken.", pw="Một phần")
    s("Dữ liệu nhạy cảm", "Response đăng ký/đăng nhập/me/PATCH me không chứa passwordHash, tokenVersion, isDemo, deletedAt",
      "Bảo mật", "Cao", DONE, "Tài khoản mới",
      ["Gọi register, login, GET /auth/me, PATCH /auth/me", "Tìm chuỗi passwordHash, tokenVersion, isDemo, deletedAt, $2 (bcrypt) trong toàn bộ body"], "-",
      "Không có bất kỳ trường/giá trị nào trong danh sách trên ở cả 4 response.")
    s("Dữ liệu nhạy cảm", "Hồ sơ công khai và bảng tin không lộ email người dùng",
      "Bảo mật", "Cao", DONE, "Đăng nhập member1",
      ["GET /api/users/<id owner>", "GET /api/courses/photo/posts (bảng tin)", "Tìm chuỗi '@sofinhub.test' trong body"], "-",
      "Không tìm thấy email trong hồ sơ công khai và author của bài viết (chỉ id, name). GET /api/auth/me chỉ trả email của chính mình.")
    s("Dữ liệu nhạy cảm", "Token một lần chỉ được lưu dạng băm sha256, không có token thô trong response API",
      "Bảo mật", "Cao", DONE, "Có token reset T lấy từ outbox; quyền đọc DB test",
      ["Đọc bảng OneTimeToken của user", "So sánh tokenHash với T", "Tính sha256(T)"], "T (43 ký tự base64url)",
      "tokenHash là 64 ký tự hex = sha256(T), khác T; T chỉ xuất hiện trong thư (outbox) và không xuất hiện ở bất kỳ response API nào.", pw="Không")
    s("Bảo mật mật khẩu", "Mật khẩu lưu bằng bcrypt cost 10",
      "Bảo mật", "Trung bình", DONE, "Tài khoản mới đăng ký; quyền đọc DB test",
      ["Đọc cột passwordHash của user vừa đăng ký", "Kiểm tra tiền tố"], "-",
      "passwordHash bắt đầu bằng '$2a$10$' hoặc '$2b$10$' (SALT_ROUNDS=10), độ dài 60; hai user cùng mật khẩu có hash khác nhau (salt riêng).", pw="Không")
    s("Chống dò tài khoản", "Quên mật khẩu và đăng nhập không lộ email tồn tại; đăng ký thì có (đánh đổi đã biết)",
      "Bảo mật", "Trung bình", DONE, "member1@sofinhub.test tồn tại, ghost.sec@sofinhub.test không tồn tại",
      ["So sánh forgot-password cho hai email", "So sánh login sai mật khẩu cho hai email", "POST /api/auth/register với member1@sofinhub.test"], "-",
      "forgot-password: hai response giống hệt (200). login: hai response 401 giống hệt. Riêng register trả 409 'Email này đã được đăng ký' nên lộ email tồn tại - ghi nhận rủi ro liệt kê tài khoản (chưa chốt cách xử lý).")
    s("Đường truyền", "SSE thông báo/tin nhắn: token đã thu hồi bị 401, vé (ticket) dùng một lần",
      "Bảo mật", "Cao", DONE, "User mới có access token S1",
      ["POST /api/notifications/stream-ticket lấy ticket, mở GET /api/notifications/stream?ticket=... (200)", "POST /api/auth/logout bằng S1",
       "GET /api/notifications/stream?access_token=S1", "GET /api/notifications/stream với Bearer S1", "POST /api/notifications/stream-ticket với S1"], "-",
      "Trước logout ticket và access_token đều mở được stream (200). Sau logout: cả ba lệnh cuối HTTP 401. Tương tự cho /api/messages/stream.", pw="Một phần")
    s("Thu hồi token tức thì", "API dùng optionalAuth coi token đã thu hồi như khách (200, không 401)",
      "Chức năng", "Trung bình", DONE, "User mới chưa tham gia photo",
      ["GET /api/courses/photo bằng token -> viewerEnrolled=false", "POST /api/auth/logout", "GET /api/courses/photo bằng token đã thu hồi"], "-",
      "Trước: 200 và viewerEnrolled=false. Sau: HTTP 200 (không phải 401) và viewerEnrolled không có trong response (coi như khách).")
    s("Giới hạn tần suất", "Không có khóa tạm theo tài khoản: chỉ giới hạn theo IP ở login/forgot/contact/newsletter",
      "Bảo mật", "Trung bình", PLAN, "Chưa làm: khóa tạm tài khoản sau N lần sai, captcha, rate limit theo tài khoản (đối lập với các case cũ mô tả 'tạm khóa')",
      ["Từ 2 IP khác nhau lần lượt đăng nhập sai member1 nhiều lần"], "-",
      "Sau khi làm: đăng nhập sai liên tiếp theo tài khoản bị khóa tạm kể cả đổi IP; hiện tại chỉ có giới hạn 10 request/15 phút/IP.", pw="Không")
    s("Giới hạn tần suất", "Xác minh mật khẩu ở change-password và DELETE /auth/me chưa có rate limit (dò mật khẩu bằng token hợp lệ)",
      "Bảo mật", "Trung bình", PLAN, "Chưa làm: rate limit riêng cho các endpoint xác minh mật khẩu",
      ["Dùng token hợp lệ của user mới, gọi POST /api/auth/change-password sai mật khẩu hiện tại 30 lần liên tiếp"], "30 lần sai",
      "Hiện tại mọi lần trả 400 'Mật khẩu hiện tại không đúng' và không bao giờ 429 (khoảng hở). Sau khi làm: trả 429 sau ngưỡng.", pw="Không")
