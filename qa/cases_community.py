# -*- coding: utf-8 -*-
"""Bổ sung testcase COMM (Cộng đồng) + MEMBER (Thành viên, Hồ sơ & Xếp hạng).
Nguồn: backend/docs/api/communities.md, docs/features/community-admin.md, backend/src/modules/{communities,community,
points,permissions,users,enrollments}, backend/prisma/seed/{communities-scenarios,demo-members,points}.ts, seed-accounts.ts.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
SEED = ("Đã chạy npm run db:seed (BE :4000, FE :5173); mật khẩu chung mọi tài khoản seed là Passw0rd!x; "
        "PLATFORM_ADMIN_EMAILS chứa admin@sofinhub.test; đăng nhập API: POST /api/auth/login rồi gửi header Authorization: Bearer <accessToken>")
FIX = ("Fixture X: owner@sofinhub.test tạo cộng đồng công khai miễn phí 'QA Fixture X' (POST /api/communities -> id qa-fixture-x); "
       "member1@ tham gia rồi được owner đặt Admin; member2@ được đặt Mod; member3@ là Member thường; newbie@ chưa tham gia")
E401 = "401 UNAUTHORIZED, message 'Vui lòng đăng nhập để tiếp tục'"
E403R = "403 FORBIDDEN, message 'Bạn không có quyền thực hiện thao tác này trong cộng đồng'"
E403M = "403 FORBIDDEN, message 'Bạn cần tham gia cộng đồng này trước'"
E403P = "403 FORBIDDEN, message 'Chỉ Platform Admin mới có quyền này'"
E404C = "404 NOT_FOUND, message 'Không tìm thấy khóa học'"
EVAL = "400 VALIDATION_ERROR, message 'Tham số không hợp lệ'"


def load(add):
    _comm(add)
    _member(add)


# =====================================================================================================
def _comm(add):
    M, MN = "COMM", "Cộng đồng"

    def c(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", status=DONE):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    # ---------------------------------------------------------------- 1. Tạo cộng đồng: validate, slug
    F = "Tạo cộng đồng (validate & slug)"
    c(F, "Slug cộng đồng sinh từ tên tiếng Việt có dấu (bỏ dấu, chữ đ -> d)", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@sofinhub.test; chưa có cộng đồng nào slug 'cong-dong-nhiep-anh-da-lat'",
      ["Vào /communities/new, bước 1 nhập tên, mô tả, chọn danh mục 'hobby', bước 2 chọn Công khai giá 0, bước 3 bấm 'Tạo cộng đồng'",
       "Ghi lại URL sau khi chuyển trang", "Gọi GET /api/communities/cong-dong-nhiep-anh-da-lat"],
      "title='Cộng đồng Nhiếp ảnh Đà Lạt', description='Nơi chia sẻ ảnh', category=hobby, priceUsd=0, visibility=public",
      "POST /api/communities trả 201, data.id='cong-dong-nhiep-anh-da-lat', viewerRole='owner'; FE chuyển sang /communities/cong-dong-nhiep-anh-da-lat/community; GET chi tiết trả 200")
    c(F, "Tạo hai cộng đồng trùng tên: slug tự thêm hậu tố -2, -3", "Chức năng", "Cao",
      SEED + ". Đăng nhập owner@; chưa có slug 'qa-trung-ten'",
      ["POST /api/communities lần 1 với title 'QA Trung Ten'", "Lặp lại lần 2 và lần 3 đúng payload cũ",
       "GET /api/communities/qa-trung-ten, /qa-trung-ten-2, /qa-trung-ten-3"],
      "title='QA Trung Ten', description='x', category=business, priceUsd=0, visibility=public",
      "Lần 1 id='qa-trung-ten', lần 2 id='qa-trung-ten-2', lần 3 id='qa-trung-ten-3' (đều 201); ba cộng đồng độc lập, không ghi đè nhau")
    c(F, "Tên chỉ gồm ký tự đặc biệt/emoji dùng slug dự phòng 'community'", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@; chưa có slug 'community'",
      ["POST /api/communities với title '!!!' (đủ 3 ký tự)", "POST lần nữa với title '🔥🔥🔥'"],
      "title='!!!' rồi '🔥🔥🔥'; các trường khác hợp lệ",
      "Cả hai trả 201 (qua kiểm tra độ dài 3-80); id lần 1='community', lần 2='community-2' (giá trị hành vi hiện tại; slug không mang nghĩa, cần quyết định có nên chặn tên toàn ký tự đặc biệt)")
    c(F, "Slug bị cắt tối đa 50 ký tự khi tên rất dài (80 ký tự)", "Chức năng", "Thấp",
      SEED + ". Đăng nhập newbie@",
      ["POST /api/communities với title gồm 80 ký tự chữ thường 'a' cách nhau dấu cách", "Đọc data.id trong response"],
      "title = 'abcdefghij ' lặp đến đúng 80 ký tự (không kết thúc bằng khoảng trắng)",
      "201; data.id dài <= 50 ký tự, không bắt đầu/kết thúc bằng '-', chỉ gồm [a-z0-9-]")
    c(F, "Biên độ dài tên: 3 ký tự hợp lệ, 2 ký tự bị từ chối", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@",
      ["POST /api/communities title='Abc'", "POST /api/communities title='Ab'"],
      "title='Abc' và 'Ab'; description='ok', category=tech, priceUsd=0, visibility=public",
      "'Abc' -> 201; 'Ab' -> 400 VALIDATION_ERROR, details.fieldErrors.title chứa 'Tên cộng đồng tối thiểu 3 ký tự'")
    c(F, "Biên độ dài tên: 80 ký tự hợp lệ, 81 ký tự bị từ chối", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST với title đúng 80 ký tự", "POST với title 81 ký tự"], "title 80 ký tự và 81 ký tự",
      "80 ký tự -> 201; 81 ký tự -> 400 VALIDATION_ERROR, fieldErrors.title chứa 'Tên cộng đồng tối đa 80 ký tự'")
    c(F, "Tên toàn khoảng trắng bị coi là rỗng (trim)", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@; FE /communities/new",
      ["POST /api/communities với title '        ' (8 dấu cách)", "Trên FE bước 1 nhập 8 dấu cách vào Tên rồi bấm Tiếp tục"],
      "title='        '", "API 400 VALIDATION_ERROR (fieldErrors.title 'Tên cộng đồng tối thiểu 3 ký tự'); FE chặn ở bước 1 với thông báo đỏ, không gọi API")
    c(F, "Mô tả rỗng/khoảng trắng bị từ chối, biên 2000 ký tự", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST với description '   '", "POST với description đúng 2000 ký tự", "POST với description 2001 ký tự"],
      "description: '   ' / 2000 'a' / 2001 'a'",
      "'   ' -> 400 fieldErrors.description 'Vui lòng nhập mô tả'; 2000 -> 201; 2001 -> 400 'Mô tả tối đa 2000 ký tự'")
    c(F, "Giá cộng đồng: 0 và 10000 hợp lệ, âm và > 10000 bị từ chối", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@",
      ["POST priceUsd=0", "POST priceUsd=10000", "POST priceUsd=-1", "POST priceUsd=10000.01"],
      "priceUsd: 0 / 10000 / -1 / 10000.01",
      "0 -> 201 (pricing 'free'); 10000 -> 201 (pricing 'paid'); -1 -> 400 fieldErrors.priceUsd 'Giá không được âm'; 10000.01 -> 400 (vượt max 10000)")
    c(F, "Giá là chuỗi hoặc null bị từ chối; giá thập phân 9.99 được chấp nhận", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST priceUsd='10' (chuỗi)", "POST priceUsd=null", "POST priceUsd=9.99"], "priceUsd: '10' / null / 9.99",
      "'10' và null -> 400 fieldErrors.priceUsd 'Giá không hợp lệ'; 9.99 -> 201, priceUsd=9.99 (schema không bắt buộc số nguyên; giá tạm/chưa chốt)")
    c(F, "Danh mục không nằm trong danh sách bị từ chối", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST category='crypto'", "POST category='' ", "Lần lượt thử từng giá trị hợp lệ: business, content, tech, finance, health, self, hobby, relationships"],
      "category sai: 'crypto', ''",
      "Hai giá trị sai -> 400 VALIDATION_ERROR (fieldErrors.category); 8 giá trị hợp lệ -> 201")
    c(F, "Chế độ hiển thị và ngôn ngữ: giá trị lạ bị từ chối, ngôn ngữ mặc định 'vi'", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST visibility='secret'", "POST không gửi language", "POST language='en'", "POST language='fr'"],
      "visibility='secret'; language: (bỏ trống)/'en'/'fr'",
      "visibility='secret' -> 400; bỏ trống language -> 201 language='vi'; 'en' -> 201; 'fr' -> 400 VALIDATION_ERROR")
    c(F, "Ảnh bìa: bỏ trống dùng ảnh mặc định, URL quá 500 ký tự bị từ chối", "Chức năng", "Thấp",
      SEED + ". Đăng nhập newbie@",
      ["POST không gửi thumbnail", "POST thumbnail là chuỗi 501 ký tự", "POST thumbnail='https://example.com/a.png'"],
      "thumbnail: (bỏ trống) / 'x'*501 / URL hợp lệ",
      "Bỏ trống -> 201 thumbnail='/images/courses/biz.webp'; 501 ký tự -> 400 VALIDATION_ERROR; URL hợp lệ -> 201 giữ nguyên URL")
    c(F, "Cộng đồng có phí: pricing 'paid', cộng đồng miễn phí: pricing 'free', tag 'new'", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@",
      ["POST priceUsd=10 visibility=public", "GET /api/communities/<id> vừa tạo", "POST priceUsd=0 visibility=private rồi GET"],
      "priceUsd 10 rồi 0",
      "Cộng đồng $10: pricing='paid', tag='new', priceUsd=10, rating=0, ratingCount=0; cộng đồng $0: pricing='free', visibility='private'")
    c(F, "Người tạo tự thành Owner và là thành viên duy nhất", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@",
      ["Tạo cộng đồng mới bằng POST /api/communities", "GET /api/communities/<id>/members", "Trên FE mở /communities/<id>/community"],
      "Cộng đồng mới của newbie@",
      "Response tạo có viewerRole='owner'; danh sách thành viên: meta.total=1, 1 dòng roleDetail='owner', role='admin'; thẻ thông tin ghi 'Vai trò của bạn: Chủ cộng đồng' và có nút 'Cài đặt'")
    c(F, "Không thể gán ownerId/locked/id khi tạo cộng đồng (mass assignment)", "Bảo mật", "Cao",
      SEED + ". Đăng nhập newbie@",
      ["POST /api/communities kèm thêm các trường ownerId='owner@...', locked=true, id='photo', students=999999, rating=5", "GET /api/communities/<id trả về>"],
      "Body hợp lệ + ownerId, locked, id, students, rating",
      "201; các trường thừa bị bỏ qua: id sinh từ tên (không đè 'photo'), người tạo là owner, locked=false, students không bị ghi đè 999999, rating=0/ratingCount=0")
    c(F, "Nội dung XSS trong tên/mô tả được lưu nguyên văn và hiển thị dạng văn bản", "Bảo mật", "Cao",
      SEED + ". Đăng nhập newbie@",
      ["Tạo cộng đồng với tên chứa thẻ script và mô tả chứa <img onerror>", "Mở trang chủ, /communities/<id>, /communities/<id>/community, Cài đặt"],
      "title='<script>alert(1)</script>Xss', description='<img src=x onerror=alert(2)>'",
      "API 201 lưu nguyên chuỗi (không kiểm duyệt nội dung, ghi trong docs là chưa làm); mọi trang FE hiển thị dạng chữ, không thực thi script, không hộp thoại alert")
    c(F, "Tạo cộng đồng khi chưa đăng nhập: API 401, FE chuyển /login rồi quay lại", "Chức năng", "Cao",
      SEED + ". Chưa đăng nhập",
      ["POST /api/communities không có token", "Mở /communities/new trên trình duyệt sạch, bấm nút 'Tạo cộng đồng' ở Header", "Đăng nhập newbie@ ở trang /login"],
      "Không có Authorization",
      "API " + E401 + "; FE chuyển sang /login; sau đăng nhập quay lại /communities/new")
    c(F, "Wizard tạo cộng đồng giữ dữ liệu khi Quay lại và cảnh báo ảnh bìa lỗi", "Giao diện", "Thấp",
      SEED + ". Đăng nhập newbie@, mở /communities/new",
      ["Bước 1 nhập tên/mô tả/danh mục, Tiếp tục sang bước 2", "Bấm Quay lại", "Sang bước 3 dán URL ảnh sai 'https://x.invalid/a.png'"],
      "URL ảnh: https://x.invalid/a.png",
      "Quay lại giữ nguyên tên/mô tả/danh mục đã nhập; khung xem trước báo không tải được ảnh nhưng vẫn cho bấm Tạo (ảnh lỗi khi hiển thị)", pw="Có")
    c(F, "Cộng đồng mới xuất hiện ở trang chủ sau các cộng đồng seed (sort trending)", "Chức năng", "Thấp",
      SEED + ". Đăng nhập newbie@ vừa tạo cộng đồng 'QA Moi Xuat Hien'",
      ["Mở trang chủ, sort mặc định trending", "Tìm 'QA Moi Xuat Hien' bằng ô tìm kiếm", "Đổi sort newest"],
      "-", "Cộng đồng mới nằm sau nhóm cộng đồng seed ở trending, lên đầu ở newest; thẻ có 1 thành viên, rating 0")

    # ---------------------------------------------------------------- 2. Sửa thông tin
    F = "Sửa thông tin cộng đồng"
    c(F, "Admin cộng đồng sửa tên và mô tả thành công (slug không đổi)", "Chức năng", "Cao",
      FIX + ". " + SEED, ["Đăng nhập member1@ (Admin của X)", "PATCH /api/communities/qa-fixture-x {title,description}", "GET /api/communities/qa-fixture-x"],
      "title='QA Fixture X (đã đổi)', description='Mô tả mới'",
      "200; data.title/description đã đổi, data.id vẫn 'qa-fixture-x', viewerRole='admin'; trang chi tiết phản ánh ngay")
    c(F, "PATCH body rỗng {} bị từ chối", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập owner@", "PATCH /api/communities/qa-fixture-x với body {}"], "{}",
      "400 VALIDATION_ERROR (formErrors chứa 'Không có trường nào để cập nhật'); FE nút Lưu báo 'Chưa có thay đổi' và không gọi API")
    c(F, "PATCH chỉ chứa trường lạ (ownerId, locked) bị coi là body rỗng", "Bảo mật", "Cao",
      FIX, ["Đăng nhập member1@ (Admin của X)", "PATCH {\"ownerId\":\"<id member1>\",\"locked\":true}", "PATCH {\"title\":\"Tên hợp lệ\",\"locked\":true,\"deletedAt\":\"2020-01-01T00:00:00Z\"}", "GET /api/communities/qa-fixture-x"],
      "Hai body ở trên",
      "Body 1 -> 400 (sau khi bỏ trường lạ không còn gì để cập nhật); body 2 -> 200 chỉ đổi title, locked vẫn false, deletedAt không đặt, ownerId vẫn là owner@")
    c(F, "Sửa tên ngắn 2 ký tự hoặc mô tả rỗng bị từ chối", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập owner@", "PATCH {title:'Ab'}", "PATCH {description:'  '}"], "title='Ab' / description='  '",
      "Cả hai 400 VALIDATION_ERROR; dữ liệu cộng đồng không đổi")
    c(F, "Mod, Member, người ngoài không sửa được thông tin cộng đồng", "Bảo mật", "Cao",
      FIX, ["Đăng nhập member2@ (Mod của X) rồi PATCH {title:'Hack'}", "Lặp lại với member3@ (Member)", "Lặp lại với newbie@ (chưa tham gia)"], "title='Hack'",
      "Cả ba nhận " + E403R + "; tên không đổi")
    c(F, "Admin cộng đồng không đổi được giá hoặc chế độ riêng tư (chỉ Owner)", "Bảo mật", "Cao",
      FIX, ["Đăng nhập member1@ (Admin của X)", "PATCH {priceUsd:20}", "PATCH {visibility:'private'}", "PATCH {title:'Ok', priceUsd:5} (kèm trường tiền)", "Vào Cài đặt trên FE, tab Thông tin chung"],
      "priceUsd=20 / visibility=private",
      "Ba PATCH đều " + E403R + " (body có priceUsd/visibility bị chặn toàn bộ, kể cả khi kèm title); FE Admin chỉ thấy giá và chế độ dạng chữ, không có ô sửa")
    c(F, "Owner đổi giá miễn phí sang có phí và ngược lại (pricing tự chuyển)", "Chức năng", "Cao",
      FIX, ["Đăng nhập owner@", "PATCH {priceUsd:15}", "GET chi tiết", "PATCH {priceUsd:0}", "GET chi tiết"], "priceUsd 15 rồi 0",
      "Sau 15: priceUsd=15, pricing='paid' và người mới bấm 'Tham gia ngay' nhận 402 PAYMENT_REQUIRED; sau 0: pricing='free', tham gia trực tiếp được lại. Thành viên cũ không bị đẩy ra (ảnh hưởng thuê bao hiện có: chưa chốt)")
    c(F, "Owner đổi cộng đồng công khai sang riêng tư: người mới phải xin duyệt", "Chức năng", "Cao",
      FIX, ["Đăng nhập owner@, PATCH {visibility:'private'}", "Đăng nhập newbie@, POST /api/communities/qa-fixture-x/enroll", "Đổi lại visibility='public'"], "visibility=private",
      "PATCH 200 visibility='private'; newbie nhận 403 JOIN_REQUEST_REQUIRED 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời'; thành viên hiện tại vẫn truy cập bình thường")
    c(F, "Sửa cộng đồng không tồn tại hoặc chưa đăng nhập", "Chức năng", "Thấp",
      SEED, ["PATCH /api/communities/khong-ton-tai-123 bằng token owner@ với {title:'Abc'}", "PATCH /api/communities/photo không kèm token"], "{title:'Abc'}",
      "Yêu cầu 1 -> " + E404C + "; yêu cầu 2 -> " + E401)
    c(F, "Sửa ngôn ngữ, danh mục, ảnh bìa qua PATCH từng phần", "Chức năng", "Thấp",
      FIX, ["Đăng nhập owner@", "PATCH {language:'en'}", "PATCH {category:'finance'}", "PATCH {thumbnail:'https://example.com/n.png'}", "PATCH {category:'xxx'}"], "Các giá trị ở trên",
      "Ba lần đầu 200, chỉ trường gửi lên thay đổi (các trường khác giữ nguyên); category 'xxx' -> 400 VALIDATION_ERROR")

    # ---------------------------------------------------------------- 3. Xóa cộng đồng
    F = "Xóa cộng đồng"
    c(F, "Owner xóa mềm cộng đồng do mình tạo: biến khỏi danh sách và trả 404", "Chức năng", "Cao",
      FIX + "; member3@ đã tham gia. " + SEED,
      ["Đăng nhập owner@, DELETE /api/communities/qa-fixture-x", "GET /api/communities/qa-fixture-x", "GET /api/communities (danh sách trang chủ)", "member3@ mở /communities/qa-fixture-x/community"],
      "-", "DELETE 200 {deleted:true}; GET chi tiết -> " + E404C + "; cộng đồng không còn trong danh sách; member3@ nhận 404 hoặc màn hình không tìm thấy (xóa mềm deletedAt)")
    c(F, "Xóa cộng đồng gửi thông báo hệ thống cho thành viên (trừ người xóa và thành viên minh họa)", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập owner@, DELETE cộng đồng X", "Đăng nhập member3@, GET /api/notifications"], "-",
      "member3@ có thông báo type 'system' tiêu đề 'Cộng đồng đã bị xóa', nội dung 'Cộng đồng \"QA Fixture X\" đã được xóa'; owner@ không nhận thông báo này")
    c(F, "FE bắt buộc gõ đúng tên cộng đồng mới bật nút Xóa", "Giao diện", "Cao",
      FIX, ["Đăng nhập owner@, vào /communities/qa-fixture-x/community/cai-dat, tab Vùng nguy hiểm", "Nhập sai tên 'qa fixture'", "Nhập đúng 'QA Fixture X'", "Bấm Xóa cộng đồng"], "Tên: QA Fixture X",
      "Nút Xóa bị vô hiệu khi tên sai (kể cả sai hoa/thường hoặc thừa khoảng trắng), bật khi khớp đúng; xóa xong chuyển về trang chủ, cộng đồng biến mất")
    c(F, "Admin, Mod, Member, người ngoài không xóa được cộng đồng", "Bảo mật", "Cao",
      FIX, ["Lần lượt đăng nhập member1@ (Admin), member2@ (Mod), member3@, newbie@", "DELETE /api/communities/qa-fixture-x", "Đăng nhập khách (không token) DELETE"], "-",
      "Bốn tài khoản nhận " + E403R + "; khách nhận " + E401 + "; cộng đồng vẫn tồn tại")
    c(F, "Xóa cộng đồng đã xóa hoặc không tồn tại trả 404", "Chức năng", "Thấp",
      FIX, ["Owner xóa X lần 1", "DELETE lần 2", "DELETE /api/communities/khong-co"], "-", "Lần 1 -> 200; lần 2 và id lạ -> " + E404C)
    c(F, "Cộng đồng seed không có chủ: chỉ Platform Admin xóa được, người khác bị 403", "Bảo mật", "Trung bình",
      SEED + ". Cộng đồng seed 'eng' (Tiếng Anh giao tiếp) không có Course.ownerId (photo, yt, fin thuộc owner@; ai/mkt/fit/des/biz đã có chủ persona từ seed admin đợt 1; eng, py, ps, ecom, data, lead, yoga, cook, ux, write, crypto, music, rel vẫn không chủ)",
      ["Đăng nhập owner@ (không thuộc cộng đồng 'eng'), DELETE /api/communities/eng", "Đăng nhập cadmin@ DELETE /api/communities/eng"], "-",
      "Cả hai 403 (không có vai trò trong cộng đồng). Lệch tài liệu: communities.md ghi 409 cho 'cộng đồng seed, người không phải Platform Admin' nhưng code chỉ trả 409 khi người gọi có vai trò Owner mà cộng đồng không có ownerId (gần như không xảy ra); khuyến nghị chốt lại tài liệu")

    # ---------------------------------------------------------------- 4. Khóa / mở khóa
    F = "Khóa / mở khóa cộng đồng (Platform Admin)"
    c(F, "Platform Admin khóa cộng đồng kèm lý do", "Chức năng", "Cao",
      FIX + ". " + SEED, ["Đăng nhập admin@sofinhub.test", "POST /api/admin/courses/qa-fixture-x/lock {reason:'Vi phạm điều khoản'}", "Đăng nhập owner@ GET /api/notifications"],
      "reason='Vi phạm điều khoản'",
      "200 {id:'qa-fixture-x', locked:true, reason:'Vi phạm điều khoản'}; owner@ nhận thông báo 'Cộng đồng bị khóa' với nội dung 'Cộng đồng \"QA Fixture X\" đã bị khóa. Lý do: Vi phạm điều khoản'")
    c(F, "Lý do khóa: rỗng, khoảng trắng, > 500 ký tự bị từ chối", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập admin@", "POST lock với reason ''", "reason '   '", "reason 501 ký tự", "reason đúng 500 ký tự"], "reason các biến thể",
      "Ba trường hợp đầu 400 VALIDATION_ERROR (fieldErrors.reason 'Vui lòng nhập lý do' cho rỗng); 500 ký tự -> 200")
    c(F, "Người không phải Platform Admin không khóa được (kể cả Owner)", "Bảo mật", "Cao",
      FIX, ["Đăng nhập owner@, POST lock X", "Đăng nhập member1@ (Admin cộng đồng) POST lock", "Không token POST lock"], "reason='x'",
      "Owner và Admin cộng đồng nhận " + E403P + "; khách nhận " + E401)
    c(F, "Cộng đồng bị khóa: thành viên thường bị chặn COMMUNITY_LOCKED", "Chức năng", "Cao",
      FIX + "; X đã bị khóa bởi admin@",
      ["Đăng nhập member3@ (Member)", "GET /api/communities/qa-fixture-x/members", "GET /api/communities/qa-fixture-x/posts", "Mở /communities/qa-fixture-x/community trên FE"], "-",
      "API trả 403 error.code='COMMUNITY_LOCKED', message 'Cộng đồng này đang bị khóa'; FE hiện dải đỏ 'đang bị khóa'; chi tiết GET /api/communities/qa-fixture-x vẫn 200. (Owner/Admin/Mod cũng bị chặn ở thao tác quản trị khi bị khóa - xem case 'Cộng đồng bị khóa: Owner/Admin/Mod bị chặn...')")
    c(F, "Cộng đồng bị khóa: người ngoài không tham gia được, thành viên vẫn rời được", "Chức năng", "Trung bình",
      FIX + "; X bị khóa",
      ["newbie@ POST /api/communities/qa-fixture-x/enroll", "newbie@ POST join-requests và POST /api/invites/<mã> /accept (nếu có)", "member3@ POST /enroll để rời"], "-",
      "newbie@ nhận 403 COMMUNITY_LOCKED 'Cộng đồng này đang bị khóa' ở /enroll (và ở accept lời mời/gửi yêu cầu); member3@ rời được: 200 {enrolled:false} (rời luôn được)")
    c(F, "Cộng đồng bị khóa ẩn khỏi danh sách; Platform Admin (kể cả chưa ghi danh) vẫn vào được", "Chức năng", "Trung bình",
      FIX + "; admin@ đã tham gia X trước khi khóa",
      ["Khóa X bằng admin@", "GET /api/communities (danh sách công khai)", "admin@ GET /api/communities/qa-fixture-x/members", "admin@ chưa tham gia cộng đồng khác bị khóa GET members"], "-",
      "X không có trong danh sách; admin@ (đã là thành viên) nhận 200; admin@ chưa là thành viên cũng nhận 200 (đã sửa: Platform Admin được bỏ qua cả kiểm tra khóa lẫn kiểm tra ghi danh; trước đây 403 'Bạn cần tham gia cộng đồng này trước')")
    c(F, "Mở khóa cộng đồng khôi phục truy cập và gửi thông báo cho chủ", "Chức năng", "Cao",
      FIX + "; X đang bị khóa",
      ["Đăng nhập admin@, POST /api/admin/courses/qa-fixture-x/unlock", "member3@ GET /api/communities/qa-fixture-x/members", "owner@ GET /api/notifications"], "-",
      "200 {id:'qa-fixture-x', locked:false}; member3@ vào được (200); cộng đồng quay lại danh sách; owner@ có thông báo 'Cộng đồng đã được mở khóa'")
    c(F, "Khóa/mở khóa cộng đồng không tồn tại hoặc đã xóa trả 404", "Chức năng", "Thấp",
      SEED, ["Đăng nhập admin@", "POST lock /api/admin/courses/khong-co", "POST unlock /api/admin/courses/khong-co", "Xóa mềm X rồi POST lock X"], "reason='x'",
      "Tất cả " + E404C)
    c(F, "Chủ cộng đồng bị khóa vẫn sửa được thông tin (không kiểm tra khóa ở PATCH)", "Chức năng", "Thấp",
      FIX + "; X bị khóa", ["Đăng nhập owner@", "PATCH /api/communities/qa-fixture-x {title:'Đổi khi khóa'}"], "title='Đổi khi khóa'",
      "200 (hành vi thực tế: PATCH không chặn khi khóa; chưa chốt có nên chặn Owner sửa khi cộng đồng đang bị khóa)")

    # ---------------------------------------------------------------- 5. Ba luồng tham gia
    F = "Ba luồng tham gia cộng đồng"
    c(F, "Cộng đồng công khai miễn phí: POST /enroll vào rồi bấm lần nữa để rời (toggle)", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@ (chưa ở cộng đồng nào); photo công khai miễn phí (priceUsd 0)",
      ["POST /api/communities/photo/enroll", "GET /api/communities/photo/members (kiểm tra có newbie)", "POST /api/communities/photo/enroll lần 2"], "-",
      "Lần 1 200 {enrolled:true}, newbie xuất hiện với roleDetail='member'; lần 2 200 {enrolled:false}, mất quyền truy cập (members -> " + E403M.replace("403 FORBIDDEN, ", "403, ") + ")")
    c(F, "Cộng đồng công khai có phí ($12 yt): 402 PAYMENT_REQUIRED kèm courseId", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@; yt là cộng đồng công khai có phí 12 USD (seed cho member1 là thành viên)",
      ["POST /api/communities/yt/enroll", "Kiểm tra body lỗi", "Trên FE /communities/yt bấm 'Tham gia ngay'"], "-",
      "402, error.code='PAYMENT_REQUIRED', message 'Cộng đồng có phí: vui lòng thanh toán để tham gia', details={communityId:'yt', courseId:'yt'} (courseId là alias deprecated của communityId); newbie chưa được ghi danh; FE hiện hộp thoại 'Khóa học có phí' -> Đi tới thanh toán /communities/yt/checkout")
    c(F, "Cộng đồng riêng tư có phí ($5 fin): riêng tư ưu tiên hơn phí -> 403 JOIN_REQUEST_REQUIRED", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@; fin là cộng đồng RIÊNG TƯ đồng thời có phí 5 USD",
      ["POST /api/communities/fin/enroll"], "-",
      "403 error.code='JOIN_REQUEST_REQUIRED', message 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời' (kiểm tra riêng tư trước kiểm tra giá, không phải 402)")
    c(F, "Cộng đồng riêng tư miễn phí (private-demo): 403 JOIN_REQUEST_REQUIRED, FE hiện nút xin tham gia", "Chức năng", "Cao",
      SEED + ". Đăng nhập member2@ (chưa ở private-demo, chưa có yêu cầu chờ)",
      ["POST /api/communities/private-demo/enroll", "Mở /communities/private-demo trên FE"], "-",
      "403 JOIN_REQUEST_REQUIRED; FE hiển thị nút 'Gửi yêu cầu tham gia' và ghi chú cần quản trị viên duyệt (không có nút 'Tham gia ngay')")
    c(F, "Tham gia cộng đồng không tồn tại hoặc đã xóa trả 404; chưa đăng nhập 401", "Chức năng", "Thấp",
      SEED, ["newbie@ POST /api/communities/khong-co/enroll", "Không token POST /api/communities/photo/enroll"], "-", "Yêu cầu 1 -> " + E404C + "; yêu cầu 2 -> " + E401)
    c(F, "Người bị cấm bấm tham gia: 403 'Bạn đã bị cấm khỏi cộng đồng này'", "Chức năng", "Cao",
      SEED + ". Đăng nhập banned@ (bị cấm khỏi photo, CommunityBan seed)",
      ["POST /api/communities/photo/enroll", "Trên FE mở /communities/photo và bấm 'Tham gia ngay'"], "-",
      "403 FORBIDDEN, message 'Bạn đã bị cấm khỏi cộng đồng này'; FE hiện thông báo đỏ dưới nút; banned@ không được ghi danh")
    c(F, "Nhấp đúp 'Tham gia ngay' không tạo hai bản ghi ghi danh", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập newbie@ (chưa ở photo)", ["Gửi song song 2 request POST /api/communities/photo/enroll bằng Promise.all", "GET /api/communities/photo/members?q=Newbie"], "-",
      "Không lỗi 500; kết quả cuối newbie xuất hiện đúng 1 lần trong danh sách; trạng thái phụ thuộc thứ tự toggle (chưa chốt nếu 2 request cùng thấy 'chưa tham gia' thì cả hai enrolled:true, vẫn 1 bản ghi nhờ upsert)", pw="Một phần")

    # ---------------------------------------------------------------- 6. Yêu cầu tham gia
    F = "Yêu cầu tham gia (cộng đồng riêng tư)"
    c(F, "Gửi yêu cầu tham gia private-demo thành công kèm lời nhắn", "Chức năng", "Cao",
      SEED + ". Đăng nhập member2@ (chưa có yêu cầu ở private-demo)",
      ["POST /api/communities/private-demo/join-requests {message}", "Đăng nhập owner@ GET /api/notifications", "owner@ GET /api/communities/private-demo/join-requests?status=pending"],
      "message='Xin vào nhóm ạ'",
      "201, data.status='pending', message đúng, userId=member2; owner@ nhận thông báo type 'system' 'Yêu cầu tham gia mới' ('<tên> xin tham gia cộng đồng \"Cộng đồng riêng tư (demo)\"'); danh sách pending có 3 yêu cầu (newbie, member1 seed + member2)")
    c(F, "Lời nhắn yêu cầu: bỏ trống mặc định '', trim khoảng trắng, > 500 ký tự bị từ chối", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập member3@ (chưa có yêu cầu ở private-demo)",
      ["POST join-requests với body {}", "Hủy yêu cầu vừa tạo, POST với message '  chào  '", "Hủy, POST message 501 ký tự", "Hủy, POST message đúng 500 ký tự"], "message: (bỏ trống) / '  chào  ' / 501 ký tự / 500 ký tự",
      "Body {} -> 201 message=''; '  chào  ' -> message='chào'; 501 ký tự -> 400 VALIDATION_ERROR; 500 ký tự -> 201")
    c(F, "Gửi yêu cầu trùng khi đã có yêu cầu chờ: 409", "Chức năng", "Cao",
      SEED + ". newbie@ đã có JoinRequest pending 'seed-jr-private-demo-newbie' ở private-demo",
      ["Đăng nhập newbie@", "POST /api/communities/private-demo/join-requests {}"], "-",
      "409 CONFLICT, message 'Bạn đã có một yêu cầu tham gia đang chờ duyệt'; danh sách pending không tăng")
    c(F, "Gửi yêu cầu đồng thời hai lần chỉ tạo một yêu cầu chờ", "Bảo mật", "Trung bình",
      SEED + ". Đăng nhập member3@ (chưa có yêu cầu ở private-demo)", ["Promise.all hai POST /api/communities/private-demo/join-requests", "Owner GET join-requests?status=pending"], "-",
      "Một request 201, một request 409 'Bạn đã có một yêu cầu tham gia đang chờ duyệt' (khóa cố vấn theo course+user); chỉ có 1 yêu cầu pending của member3@", pw="Có")
    c(F, "Xin tham gia cộng đồng công khai hoặc khi đã là thành viên: 409", "Chức năng", "Trung bình",
      SEED, ["newbie@ POST /api/communities/photo/join-requests (photo công khai)", "owner@ POST /api/communities/private-demo/join-requests (đã là Owner)"], "-",
      "Yêu cầu 1: 409 'Cộng đồng công khai, bạn có thể tham gia trực tiếp'; yêu cầu 2: 409 'Bạn đã là thành viên của cộng đồng này'")
    c(F, "Người bị cấm gửi yêu cầu tham gia: 403", "Chức năng", "Trung bình",
      FIX + "; chuyển X sang riêng tư; member3@ bị cấm khỏi X", ["Đăng nhập member3@", "POST /api/communities/qa-fixture-x/join-requests {}"], "-",
      "403 FORBIDDEN, message 'Bạn đã bị cấm khỏi cộng đồng này'")
    c(F, "Người xin hủy yêu cầu của chính mình", "Chức năng", "Cao",
      SEED + ". Đăng nhập member2@ với yêu cầu pending vừa gửi (lấy id từ response 201)", ["DELETE /api/join-requests/<id>", "GET join-requests?status=pending bằng owner@", "POST lại join-requests"], "-",
      "DELETE 200 {cancelled:true}; yêu cầu biến khỏi danh sách; gửi lại được (201)")
    c(F, "Không hủy được yêu cầu của người khác (IDOR): 404", "Bảo mật", "Cao",
      SEED, ["Đăng nhập member3@", "DELETE /api/join-requests/seed-jr-private-demo-newbie", "Đăng nhập owner@ (admin cộng đồng) DELETE cùng id"], "-",
      "Cả hai nhận 404 NOT_FOUND 'Không tìm thấy yêu cầu tham gia' (chỉ chính người xin hủy được, kể cả Owner cũng không); yêu cầu vẫn pending")
    c(F, "Hủy yêu cầu đã được xử lý: 409", "Chức năng", "Trung bình",
      SEED + ". Yêu cầu của member2@ đã bị owner@ từ chối", ["member2@ DELETE /api/join-requests/<id>"], "-",
      "409 CONFLICT, message 'Yêu cầu này đã được xử lý, không thể hủy'; FE báo đã xử lý và cho phép gửi lại")
    c(F, "Owner duyệt yêu cầu của newbie: thành viên mới, thông báo member_joined", "Chức năng", "Cao",
      SEED + ". Chưa reseed sau lần duyệt trước; newbie@ có yêu cầu pending 'seed-jr-private-demo-newbie'",
      ["Đăng nhập owner@", "POST /api/join-requests/seed-jr-private-demo-newbie/approve", "Đăng nhập newbie@ GET /api/communities/private-demo/members", "newbie@ GET /api/notifications"], "-",
      "200 status='approved'; newbie truy cập được private-demo (roleDetail 'member'); newbie có thông báo type 'member_joined' 'Yêu cầu tham gia được chấp nhận', link /courses/private-demo/community (BE vẫn phát link /courses/..., FE tự chuyển sang /communities/... nhờ LegacyCourseRedirect); owner@ có thông báo 'Thành viên mới'. Chỉ đúng cho cộng đồng MIỄN PHÍ như private-demo: cộng đồng riêng tư CÓ PHÍ thì duyệt KHÔNG cấp quyền (chỉ cho phép thanh toán/dùng thử, thông báo type 'system', link /courses/<id>) - kiểm ở nhóm MONEY. Ghi chú: thay đổi dữ liệu seed, cần db:seed lại")
    c(F, "Owner từ chối yêu cầu: không được ghi danh, có thông báo, gửi lại được", "Chức năng", "Cao",
      SEED + ". member1@ có yêu cầu pending 'seed-jr-private-demo-member1'",
      ["owner@ POST /api/join-requests/seed-jr-private-demo-member1/reject", "member1@ GET /api/communities/private-demo/members", "member1@ POST /join-requests lần nữa"], "-",
      "200 status='rejected'; member1@ vẫn 403 'Bạn cần tham gia cộng đồng này trước'; nhận thông báo type 'system' 'Yêu cầu tham gia bị từ chối'; gửi lại được 201")
    c(F, "Duyệt/từ chối yêu cầu đã xử lý: 409; id không tồn tại: 404", "Chức năng", "Trung bình",
      SEED + ". Yêu cầu seed-jr-private-demo-newbie đã được duyệt ở bước trước", ["owner@ POST approve lần 2", "owner@ POST reject cùng id", "owner@ POST /api/join-requests/khong-co/approve"], "-",
      "Hai yêu cầu đầu 409 'Yêu cầu này đã được xử lý'; id lạ 404 'Không tìm thấy yêu cầu tham gia'")
    c(F, "Chỉ Admin trở lên của đúng cộng đồng mới duyệt được (IDOR chéo cộng đồng)", "Bảo mật", "Cao",
      FIX + "; owner@ cũng là Owner private-demo; member1@ (Admin của X) không thuộc private-demo",
      ["Đăng nhập member1@ (Admin của X nhưng không thuộc private-demo)", "POST /api/join-requests/seed-jr-private-demo-newbie/approve", "Đăng nhập member3@ (Member X) thử cùng thao tác", "GET /api/communities/private-demo/join-requests bằng cả hai"], "-",
      "Approve và GET đều " + E403R + "; yêu cầu vẫn pending (quyền tính theo cộng đồng của yêu cầu, không theo cộng đồng khác)")
    c(F, "Danh sách yêu cầu: lọc theo trạng thái và trường user; status lạ bị từ chối", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập owner@; private-demo có 2 yêu cầu pending seed (newbie mới nhất, member1)",
      ["GET /api/communities/private-demo/join-requests", "?status=pending", "?status=approved", "?status=all"], "status: (bỏ trống)/pending/approved/all",
      "Mặc định và pending trả 2 dòng, mỗi dòng có user {id,name} (newbie 'Nam Newbie', member1 'Minh Member1') và message seed; approved trả mảng rỗng khi chưa duyệt; status=all -> 400 VALIDATION_ERROR")
    c(F, "Duyệt yêu cầu của người đã bị cấm: 409", "Chức năng", "Trung bình",
      FIX + "; X riêng tư; member3@ gửi yêu cầu rồi bị owner@ cấm trước khi duyệt", ["owner@ POST /api/join-requests/<id member3>/approve"], "-",
      "409 CONFLICT, message 'Người này đã bị cấm khỏi cộng đồng'; yêu cầu vẫn pending")
    c(F, "Nhận lời mời khi đang có yêu cầu chờ: yêu cầu tự chuyển sang approved", "Chức năng", "Trung bình",
      SEED + ". newbie@ có yêu cầu pending ở private-demo; DEMO-VALID còn hiệu lực", ["newbie@ POST /api/invites/DEMO-VALID/accept", "owner@ GET join-requests?status=pending và ?status=approved"], "-",
      "accept 200 {communityId:'private-demo', courseId:'private-demo', joined:true}; yêu cầu của newbie không còn pending mà thành approved (dọn yêu cầu chờ)")

    # ---------------------------------------------------------------- 7. Lời mời
    F = "Lời mời tham gia"
    c(F, "Admin tạo lời mời không giới hạn: mã 12 ký tự ngẫu nhiên", "Chức năng", "Cao",
      FIX, ["Đăng nhập member1@ (Admin X)", "POST /api/communities/qa-fixture-x/invites {}", "Tạo thêm 5 lời mời và so sánh mã"], "{}",
      "201 data.code dài 12 ký tự base64url (72 bit), maxUses=null, usedCount=0, expiresAt=null, revokedAt=null; 6 mã đều khác nhau")
    c(F, "Biên số lượt tối đa: 1 và 100000 hợp lệ; 0, 100001, 1.5, '5' bị từ chối", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập owner@", "POST invites lần lượt với maxUses 1, 100000, 0, 100001, 1.5, '5'"], "maxUses các giá trị",
      "1 và 100000 -> 201; 0, 100001, 1.5, '5' -> 400 VALIDATION_ERROR (fieldErrors.maxUses)")
    c(F, "Hạn dùng lời mời: tương lai hợp lệ; quá khứ, sai định dạng, thiếu múi giờ bị từ chối", "Chức năng", "Trung bình",
      FIX, ["Đăng nhập owner@", "POST expiresAt = hiện tại + 1 ngày (ISO có Z)", "expiresAt = hiện tại - 1 giờ", "expiresAt='abc'", "expiresAt='2035-01-01T00:00:00' (không offset)"], "expiresAt các giá trị",
      "Tương lai -> 201; quá khứ -> 400 'Hạn dùng phải ở tương lai'; 'abc' -> 400 'Hạn dùng không hợp lệ'; không offset -> 400")
    c(F, "Xem trước lời mời DEMO-VALID không cần đăng nhập", "Chức năng", "Cao",
      SEED + ". DEMO-VALID (private-demo, tối đa 5 lượt, hạn +30 ngày, chưa dùng). Không đăng nhập", ["GET /api/invites/DEMO-VALID"], "-",
      "200 data={code:'DEMO-VALID', course:{id:'private-demo', title:'Cộng đồng riêng tư (demo)', thumbnail, members, visibility:'private', priceUsd:0}, expiresAt (~+30 ngày), remainingUses:5}; không lộ createdBy hay danh sách thành viên")
    c(F, "DEMO-EXPIRED: xem trước và nhận đều 410 INVITE_EXPIRED", "Chức năng", "Cao",
      SEED + ". DEMO-EXPIRED (hết hạn 2 ngày trước)", ["GET /api/invites/DEMO-EXPIRED", "newbie@ POST /api/invites/DEMO-EXPIRED/accept", "Mở /invite/DEMO-EXPIRED trên FE"], "-",
      "Cả hai API 410, error.code='INVITE_EXPIRED', message 'Lời mời đã hết hạn'; FE hiện màn hình 'Lời mời đã hết hạn'; newbie chưa thành viên")
    c(F, "DEMO-REVOKED: 410 INVITE_REVOKED", "Chức năng", "Cao",
      SEED + ". DEMO-REVOKED", ["GET /api/invites/DEMO-REVOKED", "newbie@ POST accept", "Mở /invite/DEMO-REVOKED"], "-",
      "410, error.code='INVITE_REVOKED', message 'Lời mời đã bị thu hồi'; FE hiện 'Lời mời đã bị thu hồi'")
    c(F, "DEMO-USED (maxUses 1, usedCount 1): 410 INVITE_EXHAUSTED", "Chức năng", "Cao",
      SEED + ". DEMO-USED", ["GET /api/invites/DEMO-USED", "newbie@ POST accept", "Mở /invite/DEMO-USED"], "-",
      "410, error.code='INVITE_EXHAUSTED', message 'Lời mời đã hết lượt sử dụng'; FE hiện 'Lời mời đã hết lượt sử dụng'; usedCount vẫn 1")
    c(F, "Mã lời mời không tồn tại hoặc sai hoa/thường: 404", "Chức năng", "Trung bình",
      SEED, ["GET /api/invites/KHONG-CO", "GET /api/invites/demo-valid (viết thường)", "newbie@ POST /api/invites/demo-valid/accept"], "-",
      "Cả ba 404 NOT_FOUND 'Không tìm thấy lời mời' (mã phân biệt hoa/thường); FE /invite/KHONG-CO hiện 'Không tìm thấy lời mời'")
    c(F, "Nhận DEMO-VALID bỏ qua bước duyệt của cộng đồng riêng tư và trừ 1 lượt", "Chức năng", "Cao",
      SEED + ". newbie@ chưa ở private-demo; DEMO-VALID còn 5 lượt", ["Đăng nhập newbie@", "POST /api/invites/DEMO-VALID/accept", "GET /api/invites/DEMO-VALID", "newbie@ GET /api/communities/private-demo/members"], "-",
      "200 {communityId:'private-demo', courseId:'private-demo', joined:true}; preview có remainingUses=4; newbie vào được cộng đồng (roleDetail 'member'); owner@ nhận thông báo 'Thành viên mới'")
    c(F, "Nhận lời mời khi đã là thành viên: 409, không trừ lượt", "Chức năng", "Trung bình",
      SEED + ". owner@ là Owner private-demo", ["owner@ POST /api/invites/DEMO-VALID/accept", "GET preview kiểm tra remainingUses"], "-",
      "409 CONFLICT 'Bạn đã là thành viên của cộng đồng này'; remainingUses không đổi")
    c(F, "DEMO-PAID: xem trước được nhưng nhận vẫn 402 PAYMENT_REQUIRED", "Chức năng", "Cao",
      SEED + ". DEMO-PAID (paid-demo, $19/tháng)", ["GET /api/invites/DEMO-PAID", "newbie@ POST /api/invites/DEMO-PAID/accept", "Mở /invite/DEMO-PAID và bấm Tham gia"], "-",
      "Preview 200 với course.priceUsd=19, visibility='public'; accept 402 PAYMENT_REQUIRED, message 'Cộng đồng có phí: vui lòng thanh toán để tham gia', details={communityId:'paid-demo', courseId:'paid-demo'}; usedCount không tăng; FE hiện 'Cộng đồng này có phí…' và link 'Đi tới thanh toán'")
    c(F, "Người bị cấm dùng lời mời: 403 và lượt dùng không bị trừ", "Bảo mật", "Cao",
      FIX + "; member3@ bị cấm khỏi X; lời mời L (maxUses 3) của X", ["member3@ POST /api/invites/<L>/accept", "GET /api/invites/<L>"], "-",
      "403 FORBIDDEN 'Bạn đã bị cấm khỏi cộng đồng này'; remainingUses vẫn 3")
    c(F, "Lời mời 1 lượt bị nhiều người nhận đồng thời: chỉ một người thành công", "Bảo mật", "Cao",
      FIX + "; lời mời L maxUses=1; 3 tài khoản chưa ở X: newbie@, banned@, admin@ (hoặc 3 tài khoản đăng ký mới)", ["Gửi song song 3 POST /api/invites/<L>/accept bằng 3 token", "GET /api/invites/<L>"], "maxUses=1",
      "Đúng 1 request 200 joined:true; 2 request còn lại 410 INVITE_EXHAUSTED 'Lời mời đã hết lượt sử dụng'; usedCount=1 (không vượt maxUses)", pw="Có")
    c(F, "Admin thu hồi lời mời: preview chuyển 410 INVITE_REVOKED, thu hồi lại vẫn 200", "Chức năng", "Cao",
      FIX + "; lời mời L của X", ["member1@ (Admin) DELETE /api/invites/<L>", "GET /api/invites/<L>", "DELETE /api/invites/<L> lần 2", "GET /api/communities/qa-fixture-x/invites"], "-",
      "DELETE 200 {revoked:true} (cả lần 2, idempotent); preview 410 INVITE_REVOKED; danh sách lời mời hiển thị revokedAt khác null")
    c(F, "Chỉ Admin trở lên tạo/xem/thu hồi lời mời; Mod, Member bị 403", "Bảo mật", "Cao",
      FIX, ["member2@ (Mod) POST /communities/qa-fixture-x/invites", "member3@ GET /communities/qa-fixture-x/invites", "member3@ DELETE /api/invites/<L>", "DELETE /api/invites/KHONG-CO bằng owner@"], "-",
      "Ba yêu cầu đầu " + E403R + "; mã không tồn tại 404 'Không tìm thấy lời mời'")
    c(F, "Danh sách lời mời hiển thị đúng usedCount và trạng thái", "Giao diện", "Thấp",
      SEED + ". Đăng nhập owner@, private-demo có 4 lời mời seed", ["GET /api/communities/private-demo/invites", "Vào Cài đặt tab Lời mời trên FE"], "-",
      "API trả 4 mã (DEMO-VALID, DEMO-EXPIRED, DEMO-REVOKED, DEMO-USED); FE gán trạng thái: Đang hoạt động / Đã hết hạn / Đã thu hồi / Hết lượt; DEMO-USED hiển thị 1/1; có nút Sao chép link và Thu hồi (xác nhận)")
    c(F, "Lời mời của cộng đồng đã xóa mềm trả 404", "Chức năng", "Thấp",
      FIX + "; lời mời L đã tạo; owner@ xóa X", ["GET /api/invites/<L>"], "-", E404C + " (kiểm tra cộng đồng trước trạng thái lời mời)")

    # ---------------------------------------------------------------- 8. Vai trò
    F = "Vai trò trong cộng đồng"
    c(F, "Owner đặt Member thành Mod, người được đổi nhận thông báo role_changed", "Chức năng", "Cao",
      FIX, ["owner@ PATCH /api/communities/qa-fixture-x/members/<id member3>/role {role:'mod'}", "member3@ GET /api/notifications"], "role='mod'",
      "200 {userId, role:'mod'}; danh sách thành viên roleDetail='mod', role='admin' (FE quản trị); thông báo type 'role_changed' nội dung 'Bạn hiện là điều hành viên của \"QA Fixture X\"'")
    c(F, "Owner bỏ Mod về Member", "Chức năng", "Trung bình",
      FIX + "; member2@ là Mod", ["owner@ PATCH role {role:'member'} cho member2@"], "role='member'",
      "200 {role:'member'}; roleDetail='member'; thông báo 'Bạn hiện là thành viên của \"QA Fixture X\"'")
    c(F, "Đặt vai trò trùng vai trò hiện tại: 200 nhưng không gửi thông báo", "Chức năng", "Thấp",
      FIX + "; member2@ đang là Mod", ["owner@ PATCH role {role:'mod'} cho member2@", "member2@ đếm thông báo trước và sau"], "role='mod'",
      "200 {userId, role:'mod'}; số thông báo của member2@ không tăng")
    c(F, "Owner cấp quyền Admin, Admin cộng đồng mới có quyền quản trị", "Chức năng", "Cao",
      FIX, ["owner@ PATCH role {role:'admin'} cho member3@", "member3@ GET /api/communities/qa-fixture-x/join-requests", "member3@ PATCH title"], "role='admin'",
      "200; member3@ vào được danh sách yêu cầu (200) và sửa được tên (200) nhưng đổi giá vẫn 403")
    c(F, "Admin cộng đồng không đặt/bỏ được Admin, chỉ đặt/bỏ Mod", "Bảo mật", "Cao",
      FIX + "; member1@ Admin, member3@ Member", ["member1@ PATCH role {role:'admin'} cho member3@", "member1@ PATCH role {role:'mod'} cho member3@", "Owner đặt member2@ thành admin; member1@ PATCH role {role:'member'} cho member2@"], "-",
      "Yêu cầu 1 và 3: 403 FORBIDDEN 'Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên'; yêu cầu 2: 200 role='mod'")
    c(F, "Mod và Member không đổi được vai trò của ai", "Bảo mật", "Cao",
      FIX, ["member2@ (Mod) PATCH role {role:'mod'} cho member3@", "member3@ PATCH role cho chính mình", "newbie@ PATCH role cho member3@"], "-",
      "Cả ba " + E403R)
    c(F, "Không thể tự đổi vai trò của chính mình", "Chức năng", "Trung bình",
      FIX, ["owner@ PATCH role {role:'member'} cho chính owner@", "member1@ (Admin) PATCH role cho chính mình"], "-",
      "Cả hai 400 BAD_REQUEST 'Bạn không thể tự đổi vai trò của mình'")
    c(F, "Không thể đổi vai trò của Owner; không thể đặt role 'owner' qua endpoint này", "Bảo mật", "Cao",
      FIX, ["member1@ (Admin) PATCH role {role:'member'} cho owner@", "owner@ PATCH role {role:'owner'} cho member3@", "Platform Admin admin@ PATCH role cho owner@"], "-",
      "Yêu cầu 1 và 3: 403 'Không thể đổi vai trò của chủ cộng đồng'; yêu cầu 2: 400 VALIDATION_ERROR (role chỉ nhận member|mod|admin)")
    c(F, "Đổi vai trò người không phải thành viên hoặc bị cấm: 404", "Chức năng", "Thấp",
      FIX + "; newbie@ chưa ở X; member3@ bị cấm khỏi X", ["owner@ PATCH role cho newbie@", "owner@ PATCH role cho member3@ (đang bị cấm)", "PATCH role cho userId 'khong-co'"], "role='mod'",
      "Cả ba 404 NOT_FOUND 'Không tìm thấy thành viên'")
    c(F, "Thành viên minh họa (isDemo) không đổi được vai trò: 404", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập owner@ (Owner photo); demo-photo-3 là thành viên minh họa 'Linh Trần'", ["PATCH /api/communities/photo/members/demo-photo-3/role {role:'mod'}"], "role='mod'",
      "404 NOT_FOUND 'Không tìm thấy thành viên'; FE hiện toast đỏ 'Đây là thành viên minh họa…' không vỡ giao diện")
    c(F, "Platform Admin đặt Admin cho thành viên ở cộng đồng chưa tham gia", "Chức năng", "Trung bình",
      FIX + ". admin@ chưa tham gia X", ["admin@ PATCH role {role:'admin'} cho member3@"], "role='admin'",
      "200 {role:'admin'} (getRole = platform_admin, xếp trên Owner)")

    # ---------------------------------------------------------------- 9. Kick / ban
    F = "Kick, cấm và bỏ cấm thành viên"
    c(F, "Admin kick Mod và Member (bậc thấp hơn): thành viên bị gỡ và nhận thông báo", "Chức năng", "Cao",
      FIX, ["member1@ (Admin) DELETE /api/communities/qa-fixture-x/members/<id member2>", "DELETE cho member3@", "member3@ GET /api/notifications và members"], "-",
      "200 {removed:true} cả hai; member3@ nhận thông báo type 'removed_from_community' 'Bạn đã bị xóa khỏi cộng đồng' ('Bạn không còn là thành viên của \"QA Fixture X\"'); GET members -> 403 'Bạn cần tham gia cộng đồng này trước'; có thể tham gia lại (khác với bị cấm). Với cộng đồng CÓ PHÍ, kick kết thúc gói ngay và không trừ tiền kỳ sau (xem nhóm MONEY)")
    c(F, "Kick: Admin không kick được Admin ngang cấp, Mod không kick ai", "Bảo mật", "Cao",
      FIX + "; thêm member3@ làm Admin thứ hai", ["member1@ (Admin) DELETE members/<id member3 Admin>", "member2@ (Mod) DELETE members/<id newbie/member>", "member1@ DELETE members/<id owner>"], "-",
      "Yêu cầu 1: 403 'Bạn chỉ có thể tác động lên thành viên có vai trò thấp hơn mình'; yêu cầu 2: " + E403R + "; yêu cầu 3: 403 'Không thể tác động lên chủ cộng đồng'")
    c(F, "Không thể kick hoặc cấm chính mình: 400", "Chức năng", "Trung bình",
      FIX, ["owner@ DELETE members/<id owner>", "member1@ POST members/<id member1>/ban"], "-",
      "Cả hai 400 BAD_REQUEST 'Bạn không thể thực hiện thao tác này với chính mình'")
    c(F, "Kick người không phải thành viên hoặc thành viên minh họa: 404", "Chức năng", "Thấp",
      FIX + "; SEED photo có demo-photo-5", ["owner@ DELETE /api/communities/qa-fixture-x/members/<id newbie> (chưa tham gia)", "owner@ DELETE /api/communities/photo/members/demo-photo-5"], "-",
      "Cả hai 404 NOT_FOUND 'Không tìm thấy thành viên'")
    c(F, "Owner cấm Admin: bị gỡ khỏi cộng đồng, ghi vào danh sách cấm kèm lý do", "Chức năng", "Cao",
      FIX, ["owner@ POST /api/communities/qa-fixture-x/members/<id member1>/ban {reason:'Spam liên tục'}", "owner@ GET /api/communities/qa-fixture-x/bans", "member1@ GET /api/notifications"], "reason='Spam liên tục'",
      "200 {banned:true}; bans có {userId, reason:'Spam liên tục', bannedBy:<id owner>, bannedAt, user:{id,name}}; member1@ mất vai trò và nhận thông báo 'Bạn đã bị cấm khỏi cộng đồng' ('… Lý do: Spam liên tục')")
    c(F, "Cấm không lý do và lý do > 500 ký tự", "Chức năng", "Thấp",
      FIX, ["owner@ POST ban cho member3@ với body {}", "Bỏ cấm, POST ban với reason 501 ký tự"], "reason: (bỏ trống) / 501 ký tự",
      "Body {} -> 200, reason='' (thông báo không có đoạn 'Lý do'); 501 ký tự -> 400 VALIDATION_ERROR")
    c(F, "Cấm người chưa tham gia cộng đồng (cấm phòng ngừa) được chấp nhận", "Chức năng", "Trung bình",
      FIX + "; newbie@ chưa ở X", ["owner@ POST ban cho newbie@", "newbie@ POST /api/communities/qa-fixture-x/enroll"], "-",
      "Ban 200 {banned:true} (hành vi thực tế: không bắt buộc đã là thành viên); newbie@ bị 403 'Bạn đã bị cấm khỏi cộng đồng này' khi tham gia")
    c(F, "Người bị cấm thử tham gia lại (toggle, yêu cầu, lời mời) đều bị chặn", "Bảo mật", "Cao",
      SEED + ". banned@ bị cấm khỏi photo; private-demo có DEMO-VALID", ["banned@ POST /api/communities/photo/enroll", "banned@ POST /api/invites/<mã mời cộng đồng công khai>/accept (tạo mã cho photo bằng owner@)", "banned@ nhận lời mời DEMO-VALID để vào private-demo, owner@ cấm banned@ khỏi private-demo (ban chỉ áp dụng cho người ĐANG là thành viên), rồi banned@ POST join-requests"], "-",
      "Cả ba 403 FORBIDDEN 'Bạn đã bị cấm khỏi cộng đồng này'; banned@ không trở thành thành viên")
    c(F, "Người bị cấm không xem được nội dung dù còn dòng ghi danh trong DB", "Bảo mật", "Cao",
      SEED + ". banned@ bị cấm khỏi photo (Enrollment vẫn còn, có CommunityBan)", ["banned@ GET /api/communities/photo/members", "GET /api/communities/photo/posts", "GET /api/communities/photo/leaderboard", "Mở /communities/photo/community trên FE"], "-",
      "Tất cả 403 'Bạn cần tham gia cộng đồng này trước'; FE chuyển hướng/chặn; GET /api/communities/photo (chi tiết công khai) vẫn 200 viewerEnrolled=false")
    c(F, "Bỏ cấm: người dùng tham gia lại được, vai trò về Member", "Chức năng", "Cao",
      FIX + "; member1@ (Admin cũ) đã bị owner@ cấm", ["owner@ DELETE /api/communities/qa-fixture-x/members/<id member1>/ban", "GET /bans", "member1@ POST /enroll", "member1@ GET members"], "-",
      "Bỏ cấm 200 {banned:false}; bans không còn member1@; sau /enroll 200 {enrolled:true} với vai trò 'member' (mất quyền Admin cũ vì ban đã xóa ghi danh)")
    c(F, "Bỏ cấm người không nằm trong danh sách cấm: 404", "Chức năng", "Thấp",
      FIX, ["owner@ DELETE members/<id member3>/ban khi member3@ không bị cấm"], "-", "404 NOT_FOUND 'Người này không nằm trong danh sách cấm'")
    c(F, "Chỉ Admin trở lên xem danh sách cấm và bỏ cấm", "Bảo mật", "Trung bình",
      FIX + "; newbie@ đã tham gia X (POST /enroll) rồi bị owner@ cấm (cấm người chưa là thành viên trả 404)", ["member2@ (Mod) GET /bans", "member3@ DELETE members/<id newbie>/ban", "member1@ (Admin) GET /bans"], "-",
      "Yêu cầu 1 và 2: " + E403R + "; yêu cầu 3: 200 danh sách có newbie@")
    c(F, "Cấm thành viên minh họa: 404", "Chức năng", "Thấp",
      SEED + ". owner@ là Owner photo", ["POST /api/communities/photo/members/demo-photo-7/ban {reason:'x'}"], "-",
      "404 NOT_FOUND (thành viên minh họa isDemo không cấm được); không có bản ghi CommunityBan mới")

    # ---------------------------------------------------------------- 10. Chuyển quyền, rời cộng đồng
    F = "Chuyển quyền sở hữu & rời cộng đồng"
    c(F, "Owner chuyển quyền cho thành viên: chủ cũ thành Admin, ownerId cập nhật", "Chức năng", "Cao",
      FIX, ["owner@ POST /api/communities/qa-fixture-x/transfer-ownership {userId:<id member3>}", "GET members", "member3@ PATCH {priceUsd:9}", "owner@ PATCH {priceUsd:9}"], "userId=member3",
      "200 {ownerId:<id member3>}; owner@ roleDetail='admin', member3@ roleDetail='owner'; member3@ đổi giá 200, owner@ đổi giá 403; cả hai nhận thông báo role_changed ('Bạn đã trở thành chủ của …' / 'Bạn đã chuyển quyền chủ … và giờ là quản trị viên')")
    c(F, "Chuyển quyền cho chính mình hoặc người không phải thành viên: 400", "Chức năng", "Trung bình",
      FIX + "; newbie@ chưa ở X; member3@ đang bị cấm", ["owner@ transfer userId=<id owner>", "transfer userId=<id newbie>", "transfer userId=<id member3 bị cấm>", "transfer body {}"], "-",
      "Yêu cầu 1: 400 'Bạn đã là chủ cộng đồng'; 2 và 3: 400 'Người nhận phải là thành viên của cộng đồng'; 4: 400 VALIDATION_ERROR")
    c(F, "Admin, Mod, Member không chuyển quyền được", "Bảo mật", "Cao",
      FIX, ["member1@ (Admin) transfer userId=<id member1>", "member2@ (Mod) transfer userId=<id member2>", "member3@ transfer userId=<id member3>"], "-", "Cả ba " + E403R + "; owner không đổi")
    c(F, "Platform Admin chuyển quyền thay Owner", "Chức năng", "Thấp",
      FIX, ["admin@ transfer userId=<id member3>", "GET members"], "-", "200 {ownerId:<member3>}; owner@ cũ thành admin")
    c(F, "Chuyển quyền sang thành viên minh họa: hành vi thực tế và rủi ro", "Bảo mật", "Trung bình",
      SEED + ". Đăng nhập owner@; dùng cộng đồng của owner@ do bạn tạo (không dùng photo)", ["POST transfer-ownership {userId:'demo-<courseId>-0'} (thành viên minh họa, không đăng nhập được)"], "userId='demo-<courseId>-0'",
      "Hành vi thực tế của code: 200 vì service không kiểm tra isDemo (chưa chốt/nghi lỗi: cộng đồng có thể rơi vào tay tài khoản không đăng nhập được); FE đã ẩn thành viên minh họa khỏi danh sách chọn", status=DONE)
    c(F, "Thành viên tự rời cộng đồng công khai miễn phí (POST /enroll toggle)", "Chức năng", "Cao",
      FIX, ["member3@ POST /api/communities/qa-fixture-x/enroll", "member3@ GET members", "POST /enroll lần nữa"], "-",
      "Lần 1 200 {enrolled:false}, members -> 403; lần 2 200 {enrolled:true} và vai trò trở lại 'member'")
    c(F, "Mod rời rồi vào lại: mất vai trò Mod", "Chức năng", "Trung bình",
      FIX, ["member2@ (Mod) POST /enroll để rời", "member2@ POST /enroll để vào lại", "GET members xem roleDetail của member2@"], "-", "Sau khi vào lại roleDetail='member' (ghi danh bị xóa khi rời, tạo lại với vai trò mặc định)")
    c(F, "Owner không thể rời cộng đồng của mình: 409", "Chức năng", "Cao",
      SEED, ["owner@ POST /api/communities/photo/enroll (đang là Owner photo)", "FE bấm nút 'Đã tham gia' ở trang /communities/photo"], "-",
      "409 CONFLICT 'Chủ cộng đồng không thể rời cộng đồng của mình'; owner@ vẫn là Owner; FE hiện lỗi")

    # ---------------------------------------------------------------- 11. Đánh giá
    F = "Đánh giá cộng đồng (1-5 sao)"
    c(F, "Thành viên gửi đánh giá đầu tiên: 201, điểm cộng đồng mới tính đúng", "Chức năng", "Cao",
      FIX + "; X chưa có đánh giá (rating 0 / ratingCount 0)", ["member3@ POST /api/communities/qa-fixture-x/reviews {rating:5,text:'Rất tốt'}", "GET /api/communities/qa-fixture-x/reviews", "GET /api/communities/qa-fixture-x"], "rating=5, text='Rất tốt'",
      "201 data={id,userId,name,rating:5,text:'Rất tốt',createdAt,updatedAt}; danh sách meta.total=1, summary={rating:5,ratingCount:1}; chi tiết cộng đồng rating 5, ratingCount 1")
    c(F, "Gửi lại đánh giá là cập nhật (200), không tạo bản ghi thứ hai", "Chức năng", "Cao",
      FIX + "; member3@ đã đánh giá 5 sao", ["member3@ POST reviews {rating:2,text:'Đổi ý'}", "GET reviews"], "rating=2",
      "200 (không phải 201); meta.total vẫn 1; summary={rating:2,ratingCount:1}; FE nút đổi thành 'Cập nhật đánh giá'")
    c(F, "Trung bình sao tính lại theo nhiều đánh giá và khi xóa", "Chức năng", "Cao",
      FIX + "; X chưa có đánh giá", ["member3@ đánh giá 5", "member2@ đánh giá 4", "GET summary", "member3@ DELETE /api/communities/qa-fixture-x/reviews/mine", "GET summary"], "5 sao, 4 sao",
      "Sau 2 đánh giá summary={rating:4.5,ratingCount:2}; sau khi member3@ xóa: {rating:4,ratingCount:1}; xóa nốt: {rating:0,ratingCount:0}")
    c(F, "Điểm nền seed của photo cộng với đánh giá thật (4.7/131 + 3 đánh giá)", "Chức năng", "Trung bình",
      SEED + ". photo có nền 4.7 sao/131 lượt (courses.seed) và 3 đánh giá thật của member1..3 (5, 4, 3 sao)", ["GET /api/communities/photo/reviews", "GET /api/communities/photo"], "-",
      "meta.total=3; summary.ratingCount=134, summary.rating=4.7 (làm tròn 1 chữ số: (4.7×131+12)/134 ≈ 4.68); nội dung đánh giá seed: 5 sao 'Cộng đồng rất chất lượng…', 4 sao 'Nội dung tốt…', 3 sao 'Ổn, nhưng…'; số lượt (134) lớn hơn số đánh giá liệt kê (3)")
    c(F, "Điểm đánh giá không hợp lệ: 0, 6, 4.5, chuỗi, thiếu rating", "Chức năng", "Cao",
      FIX, ["member3@ POST reviews lần lượt rating 0, 6, 4.5, '5', (bỏ trống)"], "rating các giá trị",
      "Tất cả 400 VALIDATION_ERROR: 0 -> 'Điểm tối thiểu là 1'; 6 -> 'Điểm tối đa là 5'; 4.5 -> 'Điểm đánh giá phải là số nguyên'; đánh giá cũ không bị đổi")
    c(F, "Nội dung đánh giá: 1000 ký tự hợp lệ, 1001 bị từ chối, bỏ trống được", "Chức năng", "Trung bình",
      FIX, ["member3@ POST rating 4 text 1000 ký tự", "POST text 1001 ký tự", "POST chỉ {rating:3}"], "text 1000 / 1001 / (bỏ trống)",
      "1000 -> 2xx; 1001 -> 400 'Nội dung tối đa 1000 ký tự'; bỏ trống -> 2xx với text=''; chi tiết cộng đồng hiển thị 'Đã đánh giá 3 sao' cho đánh giá không lời")
    c(F, "Người chưa tham gia, người bị cấm, khách không đánh giá được", "Bảo mật", "Cao",
      SEED, ["newbie@ POST /api/communities/photo/reviews {rating:5}", "banned@ POST cùng payload", "Không token POST cùng payload"], "rating=5",
      "newbie@ và banned@ nhận " + E403M + "; khách nhận " + E401 + "; GET /api/communities/photo/reviews vẫn xem công khai (200)")
    c(F, "Mod xóa đánh giá của người khác; Member thường không xóa được", "Bảo mật", "Cao",
      SEED + ". Đăng nhập mod@ và member3@; đánh giá của member1@ ở photo (lấy id từ GET reviews)", ["member3@ DELETE /api/reviews/<id của member1>", "mod@ DELETE /api/reviews/<id của member1>", "GET reviews"], "-",
      "member3@ nhận 403 FORBIDDEN 'Bạn không có quyền thực hiện thao tác này'; mod@ 200 {deleted:true}; summary tính lại (ratingCount 133). Ghi chú: thay đổi seed, cần db:seed lại")
    c(F, "Tác giả xóa đánh giá của mình; không có đánh giá thì 404", "Chức năng", "Trung bình",
      FIX + "; member3@ đã đánh giá", ["member3@ DELETE /api/communities/qa-fixture-x/reviews/mine", "DELETE lần 2", "DELETE /api/reviews/khong-co"], "-",
      "Lần 1 200 {deleted:true}; lần 2 404 'Bạn chưa đánh giá cộng đồng này'; id lạ 404 'Không tìm thấy đánh giá'")
    c(F, "Danh sách đánh giá: phân trang, giới hạn và cộng đồng không tồn tại", "Chức năng", "Thấp",
      SEED, ["GET /api/communities/photo/reviews?page=1&limit=2", "?limit=51", "?page=0", "GET /api/communities/khong-co/reviews"], "-",
      "limit=2 -> data 2 dòng, meta {page:1,limit:2,total:3,totalPages:2}; limit=51 và page=0 -> 400 VALIDATION_ERROR; cộng đồng lạ -> " + E404C)
    c(F, "Nội dung đánh giá chứa HTML/script hiển thị an toàn", "Bảo mật", "Trung bình",
      FIX, ["member3@ POST rating 5 text '<script>alert(1)</script>'", "Mở /communities/qa-fixture-x, cuộn tới 'Đánh giá từ học viên'"], "text có thẻ script",
      "API lưu nguyên văn; FE hiển thị dạng chữ, không thực thi script")
    c(F, "FE đánh giá: khách chỉ đọc, thành viên chọn sao bắt buộc, Mod thấy thùng rác", "Giao diện", "Trung bình",
      FIX, ["Khách mở /communities/qa-fixture-x, xem phần đánh giá", "member3@ bấm Gửi đánh giá khi chưa chọn sao", "mod (member2@) xem đánh giá của member3@"], "-",
      "Khách thấy 'Tham gia cộng đồng để viết đánh giá của bạn'; không chọn sao báo 'Vui lòng chọn số sao'; Mod+ có icon thùng rác, Member thường không có")

    # ---------------------------------------------------------------- 12. Ma trận quyền
    _matrix(add, M, MN)

    # ---------------------------------------------------------------- 13. Bổ sung sau rà soát lỗi thời (thay thế TC-COMM-077 và TC-COMM-135)
    F = "Khóa / mở khóa cộng đồng (Platform Admin)"
    c(F, "Cộng đồng bị khóa: Owner/Admin/Mod bị chặn thao tác quản trị (COMMUNITY_LOCKED), Platform Admin vẫn quản trị được", "Bảo mật", "Cao",
      FIX + "; X đang bị khóa bởi admin@ (POST /api/admin/courses/qa-fixture-x/lock)",
      ["Đăng nhập owner@, PATCH /api/communities/qa-fixture-x {title:'Đổi khi khóa'}", "owner@ POST /api/communities/qa-fixture-x/invites {}", "owner@ DELETE /api/communities/qa-fixture-x",
       "member1@ (Admin) POST /api/communities/qa-fixture-x/members/<id member3>/ban {}", "member2@ (Mod) GET /api/communities/qa-fixture-x/join-requests",
       "admin@ (Platform Admin) PATCH /api/communities/qa-fixture-x {title:'Admin sửa khi khóa'}"], "title='Đổi khi khóa'",
      "Các thao tác của owner@/Admin/Mod đều 403 error.code='COMMUNITY_LOCKED', message 'Cộng đồng này đang bị khóa' (policy.requireRole chặn mọi vai trò cộng đồng khi Course.locked, kể cả đình chỉ kiểm duyệt; chỉ Platform Admin/nhân viên admin vượt được); tên cộng đồng không đổi. "
      "admin@ PATCH 200. Thay thế TC-COMM-077 (hành vi cũ 'owner vẫn sửa được khi khóa' đã bị loại bỏ có chủ đích).")
    F = "Chủ cộng đồng chặn thành viên (cấm)"
    c(F, "Cấm người chưa là thành viên bị từ chối 404, không tạo bản ghi cấm và không gửi thông báo", "Chức năng", "Trung bình",
      FIX + "; newbie@ chưa ở X",
      ["owner@ POST /api/communities/qa-fixture-x/members/<id newbie>/ban {reason:'Phòng ngừa'}", "owner@ GET /api/communities/qa-fixture-x/bans", "newbie@ GET /api/notifications",
       "owner@ POST ban với userId lạ 'khong-co'"], "-",
      "Cả hai ban trả 404 NOT_FOUND 'Không tìm thấy thành viên' (communities.service ban(): chỉ cấm được người ĐANG là thành viên; không là oracle dò userId); bans không có newbie@; newbie@ không có thông báo 'Bạn đã bị cấm...'; newbie@ vẫn /enroll được. "
      "Thay thế TC-COMM-135 (hành vi cũ 'cấm phòng ngừa' đã bị bỏ, docs/api/communities.md dòng POST ban).")


# =====================================================================================================
ROLE_LOGIN = {
    "guest": "không đăng nhập (không gửi Authorization)",
    "newbie": "newbie@sofinhub.test (chưa ở cộng đồng nào)",
    "member": "member1@sofinhub.test (Member photo)",
    "mod": "mod@sofinhub.test (Mod photo)",
    "cadmin": "cadmin@sofinhub.test (Admin photo)",
    "owner": "owner@sofinhub.test (Owner photo, private-demo, paid-demo)",
    "admin": "admin@sofinhub.test (Platform Admin, không ghi danh ở photo)",
    "banned": "banned@sofinhub.test (bị cấm khỏi photo)",
}


def _matrix(add, M, MN):
    """Ma trận hành động x vai trò. Mỗi ô là một case riêng có kết quả cụ thể."""
    F = "Ma trận phân quyền (hành động x vai trò)"

    def cell(title, ttype, prio, pre, action_step, data, exp, pw="Có"):
        for role, result in exp.items():
            if role == "guest" and not title.startswith(("Xem danh sách thành viên", "Sửa tên cộng đồng")):
                continue  # 401 giống hệt nhau ở mọi API: chỉ giữ ở hai hành động đại diện
            add(M, MN, F, "%s — vai trò %s" % (title, role_name(role)), ttype, prio, DONE,
                pre + ". Vai trò kiểm tra: " + ROLE_LOGIN[role],
                ["Đăng nhập bằng " + ROLE_LOGIN[role] if role != "guest" else "Không đăng nhập", action_step],
                data, result, pw=pw)

    def role_name(r):
        return {"guest": "Khách", "newbie": "Người chưa tham gia", "member": "Member", "mod": "Mod", "cadmin": "Admin cộng đồng",
                "owner": "Owner", "admin": "Platform Admin", "banned": "Người bị cấm"}[r]

    members = "GET /api/communities/photo/members"
    cell("Xem danh sách thành viên photo", "Bảo mật", "Cao", SEED + "; photo có 71 thành viên hợp lệ (11 tài khoản thật không kể banned: owner, cadmin, mod, member1-3 + 5 persona sarah/alex/daniel/liam/emma do seed admin đợt 1; + 60 minh họa). Đối chiếu SQL: SELECT count(*) FROM \"Enrollment\" WHERE \"courseId\"='photo' trừ CommunityBan (tài khoản QA tự tạo thêm sẽ làm lệch)",
         members, "-",
         {"guest": E401, "newbie": E403M, "member": "200, meta.total=71", "mod": "200, meta.total=71", "cadmin": "200, meta.total=71",
          "owner": "200, meta.total=71",
          "admin": "200, meta.total=71 (đã sửa: requireMembership cho qua Platform Admin chưa ghi danh, khớp mô tả 'ghi đè mọi cộng đồng'; trước đây 403)",
          "banned": E403M + " (dòng ghi danh còn nhưng bị CommunityBan)"})

    cell("Sửa tên cộng đồng photo (PATCH title)", "Bảo mật", "Cao", SEED + ". Sau test khôi phục tên gốc 'Nhiếp ảnh bằng điện thoại'",
         "PATCH /api/communities/photo {title:'Nhiếp ảnh (QA)'}", "title='Nhiếp ảnh (QA)'",
         {"guest": E401, "newbie": E403R, "member": E403R, "mod": E403R, "cadmin": "200, title đổi, viewerRole='admin'",
          "owner": "200, title đổi, viewerRole='owner'", "admin": "200, title đổi, viewerRole='platform_admin'", "banned": E403R})

    cell("Đổi giá cộng đồng photo (PATCH priceUsd)", "Bảo mật", "Cao", SEED + ". Dùng priceUsd=0 (giá hiện tại) để không làm hỏng seed",
         "PATCH /api/communities/photo {priceUsd:0}", "priceUsd=0",
         {"guest": E401, "newbie": E403R, "member": E403R, "mod": E403R, "cadmin": E403R + " (Admin không đổi được giá)",
          "owner": "200, priceUsd=0, pricing='free'", "admin": "200, priceUsd=0", "banned": E403R})

    cell("Tạo lời mời cho photo (POST invites)", "Bảo mật", "Cao", SEED + ". Mỗi lần thành công tạo thêm 1 mã (thu hồi sau test)",
         "POST /api/communities/photo/invites {maxUses:2}", "maxUses=2",
         {"guest": E401, "newbie": E403R, "member": E403R, "mod": E403R, "cadmin": "201, data.code 12 ký tự, maxUses=2",
          "owner": "201, data.code 12 ký tự, maxUses=2", "admin": "201, data.code 12 ký tự, maxUses=2", "banned": E403R})

    cell("Xem yêu cầu tham gia private-demo (GET join-requests)", "Bảo mật", "Cao", SEED + ". private-demo chỉ có owner@ là người thật; 2 yêu cầu pending seed",
         "GET /api/communities/private-demo/join-requests", "-",
         {"guest": E401, "newbie": E403R, "member": E403R + " (member1@ không thuộc private-demo, chỉ có yêu cầu chờ)", "mod": E403R + " (mod@ không thuộc private-demo)",
          "cadmin": E403R + " (Admin photo không có quyền ở cộng đồng khác)", "owner": "200, 2 yêu cầu pending (newbie, member1)",
          "admin": "200, 2 yêu cầu pending (getRole = platform_admin, không cần ghi danh)", "banned": E403R})

    cell("Khóa cộng đồng photo (POST /api/admin/courses/photo/lock)", "Bảo mật", "Cao", SEED + ". Sau test mở khóa lại bằng /unlock",
         "POST /api/admin/courses/photo/lock {reason:'QA ma trận'}", "reason='QA ma trận'",
         {"guest": E401, "newbie": E403P, "member": E403P, "mod": E403P, "cadmin": E403P, "owner": E403P + " (Owner cũng không khóa được)",
          "admin": "200 {id:'photo', locked:true, reason:'QA ma trận'}", "banned": E403P})

    cell("Xóa cộng đồng photo (DELETE /api/courses/photo)", "Bảo mật", "Cao",
         SEED + ". CHỈ chạy các vai trò bị từ chối; không chạy Owner/Platform Admin trên photo (xóa mềm phá seed) — kiểm thành công ở case tạo mới riêng",
         "DELETE /api/communities/photo", "-",
         {"guest": E401, "newbie": E403R, "member": E403R, "mod": E403R, "cadmin": E403R, "banned": E403R})

    cell("Đặt Admin cho member3@ ở photo (PATCH role admin)", "Bảo mật", "Cao", SEED + ". Sau test đặt lại role='member'",
         "PATCH /api/communities/photo/members/<id member3>/role {role:'admin'}", "role='admin'",
         {"guest": E401, "newbie": E403R, "member": E403R, "mod": E403R, "cadmin": "403 FORBIDDEN, message 'Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên'",
          "owner": "200 {userId, role:'admin'}", "admin": "200 {userId, role:'admin'}", "banned": E403R})

    cell("Gửi đánh giá cho photo (POST reviews)", "Bảo mật", "Trung bình", SEED + ". member1..3 đã có đánh giá seed, POST sẽ cập nhật",
         "POST /api/communities/photo/reviews {rating:4,text:'QA'}", "rating=4",
         {"guest": E401, "newbie": E403M, "member": "200 (cập nhật đánh giá cũ 5 -> 4)", "mod": "201 (đánh giá mới)", "cadmin": "201 (đánh giá mới)",
          "owner": "201 (đánh giá mới)", "admin": "201 (đánh giá mới; đã sửa: requireMembership cho qua Platform Admin chưa ghi danh, trước đây 403)", "banned": E403M})

    cell("Tham gia photo (POST /enroll, công khai miễn phí)", "Chức năng", "Cao", SEED + ". photo công khai miễn phí. Vai trò đã là thành viên sẽ RỜI (toggle) — nhớ vào lại",
         "POST /api/communities/photo/enroll", "-",
         {"guest": E401, "newbie": "200 {enrolled:true}", "member": "200 {enrolled:false} (toggle rời)", "banned": "403 FORBIDDEN 'Bạn đã bị cấm khỏi cộng đồng này'",
          "owner": "409 CONFLICT 'Chủ cộng đồng không thể rời cộng đồng của mình'"})

    cell("Tham gia private-demo (POST /enroll)", "Chức năng", "Cao", SEED + ". private-demo riêng tư miễn phí",
         "POST /api/communities/private-demo/enroll", "-",
         {"guest": E401, "newbie": "403 JOIN_REQUEST_REQUIRED, message 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời'",
          "member": "403 JOIN_REQUEST_REQUIRED (member1@ mới chỉ có yêu cầu chờ)", "owner": "409 CONFLICT 'Chủ cộng đồng không thể rời cộng đồng của mình'",
          "banned": "403 JOIN_REQUEST_REQUIRED (banned@ chỉ bị cấm ở photo, không phải private-demo)"})

    cell("Tham gia paid-demo (POST /enroll, $19/tháng)", "Chức năng", "Cao", SEED + ". paid-demo công khai có phí 19 USD",
         "POST /api/communities/paid-demo/enroll", "-",
         {"guest": E401, "newbie": "402 PAYMENT_REQUIRED, message 'Cộng đồng có phí: vui lòng thanh toán để tham gia', details={communityId:'paid-demo', courseId:'paid-demo'}",
          "member": "402 PAYMENT_REQUIRED (member1@ chưa mua)", "cadmin": "402 PAYMENT_REQUIRED (Admin photo vẫn phải trả phí ở cộng đồng khác)",
          "owner": "409 CONFLICT 'Chủ cộng đồng không thể rời cộng đồng của mình'", "banned": "402 PAYMENT_REQUIRED"})


# =====================================================================================================
def _member(add):
    M, MN = "MEMBER", "Thành viên, Hồ sơ & Xếp hạng"

    def c(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", status=DONE):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    LB = SEED + ". photo có 71 thành viên hợp lệ: 11 tài khoản thật (owner, cadmin, mod, member1-3 + 5 persona sarah/alex/daniel/liam/emma do seed admin đợt 1; banned bị loại) + 60 thành viên minh họa isDemo (đối chiếu SQL, tài khoản QA tự tạo thêm làm lệch số)"

    # ---------------------------------------------------------------- Danh sách thành viên
    F = "Danh sách thành viên"
    c(F, "Mặc định photo: tổng 66 thành viên, 7 trang, thống kê counts", "Chức năng", "Cao",
      LB + ". Đăng nhập member1@", ["GET /api/communities/photo/members", "Mở /communities/photo/community/thanh-vien"], "-",
      "200; meta={page:1,limit:10,total:66,totalPages:7}; data 10 dòng, mỗi dòng có {id,name,handle,role,roleDetail,enrolledAt,lastActiveAt,online}; counts.all=66, counts.admins=4 (owner, cadmin, mod, demo-photo-0 admin), counts.online >= 7 (7 thành viên minh họa đầu luôn online; có thể cộng thêm tài khoản thật vừa hoạt động trong 5 phút); banned@ không xuất hiện")
    c(F, "Trang cuối (page=7) chỉ còn 6 dòng; vượt trang trả mảng rỗng", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@", ["GET ?page=7", "GET ?page=8", "GET ?page=1&limit=50", "GET ?limit=25&page=3"], "-",
      "page=7: 6 dòng; page=8: data=[] với meta.total=66; limit=50 trang 1: 50 dòng, totalPages=2; limit=25 page=3: 16 dòng")
    c(F, "Tham số phân trang/lọc không hợp lệ bị từ chối", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@", ["GET ?page=0", "GET ?limit=51", "GET ?limit=abc", "GET ?filter=owner", "GET ?sort=name", "GET ?q=" + "a" * 101], "-",
      "Tất cả 400 VALIDATION_ERROR 'Tham số không hợp lệ' (page>=1, limit 1..50, filter all|online|admin, sort active|joined, q tối đa 100 ký tự)")
    c(F, "Tìm theo tên không phân biệt hoa thường: q=tom", "Chức năng", "Cao",
      LB + ". Đăng nhập member1@", ["GET ?q=tom", "GET ?q=TOM", "Trên FE gõ 'tom' vào ô tìm kiếm tab Thành viên"], "q='tom'",
      "Cả hai API trả cùng kết quả gồm 'Tom Be' (id demo-photo-0); meta.total khớp số dòng; FE hiển thị đúng dòng đó")
    c(F, "Tìm theo handle: q=tom-be-3538", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@; handle của demo-photo-0 (Tom Be) là 'tom-be-3538' (slug tên + 1000 + hash id % 9000)", ["GET ?q=tom-be-3538", "GET ?q=3538"], "q",
      "Cả hai trả về dòng 'Tom Be' với handle 'tom-be-3538' (tìm cả tên lẫn handle)")
    c(F, "Tìm không có kết quả: data rỗng, total 0, totalPages 1", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@", ["GET ?q=zzzzkhongco", "FE nhập từ khóa này"], "q='zzzzkhongco'",
      "200 data=[], meta={page:1,limit:10,total:0,totalPages:1}, counts vẫn như trang đầu (all=71…); FE hiện trạng thái rỗng, không lỗi")
    c(F, "Tìm có dấu tiếng Việt: khớp đúng dấu, không tự bỏ dấu", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@; thành viên minh họa 'Linh Trần' (demo-photo-3) và 'Tran Trong' (demo-photo-2)", ["GET ?q=Trần", "GET ?q=tran"], "q='Trần' / 'tran'",
      "q=Trần trả 'Linh Trần' (không trả 'Tran Trong'); q=tran trả 'Tran Trong' nhưng KHÔNG trả 'Linh Trần' (giá trị hiện tại: so khớp chuỗi thường, không chuẩn hóa dấu; nếu muốn tìm không dấu cần cải tiến)")
    c(F, "Lọc filter=admin gồm Owner, Admin, Mod (mod hiển thị role 'admin')", "Chức năng", "Cao",
      LB + ". Đăng nhập member1@", ["GET ?filter=admin&limit=50", "So sánh role và roleDetail từng dòng"], "-",
      "meta.total=4 gồm owner@ (roleDetail 'owner'), cadmin@ ('admin'), mod@ ('mod'), demo-photo-0 'Tom Be' ('admin'); mọi dòng có role='admin' (FE chỉ phân biệt admin/member); không có member1..3")
    c(F, "Lọc filter=online chỉ trả người hoạt động trong 5 phút gần nhất", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@ (vừa gọi API nên lastActiveAt = bây giờ)", ["GET ?filter=online&limit=50", "So sánh với counts.online"], "-",
      "meta.total = counts.online; gồm 7 thành viên minh họa đầu (Tom Be … Nguyen Nam, hoạt động 20s-170s trước) và member1@; mọi dòng online=true; thành viên minh họa từ vị trí 8 trở đi (>= 45 phút) không xuất hiện")
    c(F, "Sắp xếp sort=active và sort=joined", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@", ["GET ?sort=active&limit=5", "GET ?sort=joined&limit=5"], "-",
      "active: lastActiveAt giảm dần (người vừa gọi API ở đầu); joined: enrolledAt giảm dần (tài khoản seed vừa ghi danh ở đầu); hai danh sách khác nhau; hòa xếp theo userId tăng dần")
    c(F, "Kết hợp q + filter + phân trang", "Chức năng", "Thấp",
      LB + ". Đăng nhập member1@", ["GET ?q=a&filter=online&limit=3&page=1", "GET ?q=a&filter=online&limit=3&page=2"], "-",
      "meta.total là số khớp SAU khi lọc cả q và filter; hai trang không trùng dòng; totalPages = ceil(total/3)")
    c(F, "Danh sách thành viên yêu cầu đăng nhập và ghi danh", "Bảo mật", "Cao",
      LB, ["GET /api/communities/photo/members không token", "newbie@ GET cùng URL", "GET /api/communities/khong-co/members bằng member1@"], "-",
      "Khách " + E401 + "; newbie@ " + E403M + "; cộng đồng lạ " + E404C)
    c(F, "Thành viên bị cấm không hiện trong danh sách và không tính vào counts", "Bảo mật", "Cao",
      FIX + " (dùng cộng đồng fixture)", ["GET members ghi lại counts.all", "owner@ cấm member3@", "GET members lại", "Bỏ cấm"], "-",
      "Sau cấm counts.all giảm 1, member3@ biến khỏi data (kể cả q=Member3); sau bỏ cấm member3@ phải /enroll lại mới xuất hiện")
    c(F, "Kick thành viên: danh sách và counts.all giảm ngay", "Chức năng", "Trung bình",
      FIX, ["GET members lấy total", "member1@ (Admin) kick member3@", "GET members lại"], "-", "meta.total và counts.all giảm 1; member3@ không còn trong data")
    c(F, "Thành viên minh họa hiển thị chung với thành viên thật, không lộ email", "Bảo mật", "Trung bình",
      LB + ". Đăng nhập member1@", ["GET ?limit=50", "Kiểm tra toàn bộ khóa JSON của từng dòng"], "-",
      "Mỗi dòng chỉ có id,name,handle,role,roleDetail,enrolledAt,lastActiveAt,online (không có email/passwordHash/isDemo); id minh họa dạng 'demo-photo-<i>' với i=0..59; chỉ demo-photo-0 có roleDetail='admin', còn lại 'member'")
    c(F, "FE tab Thành viên: nhãn Owner/Admin/Mod và số liệu thẻ thông tin", "Giao diện", "Trung bình",
      LB + ". Đăng nhập member1@", ["Mở /communities/photo/community/thanh-vien", "Đối chiếu nhãn cạnh tên owner@, cadmin@, mod@ và thẻ thông tin bên phải"], "-",
      "owner@ nhãn 'Owner', cadmin@ 'Admin', mod@ 'Mod'; thẻ hiển thị số thành viên = 71 (hoặc đúng theo SQL), online khớp counts.online; Member không thấy nút Cài đặt")

    # ---------------------------------------------------------------- Chi tiết thành viên & hồ sơ
    F = "Hồ sơ & chi tiết thành viên"
    c(F, "Chi tiết thành viên trong cộng đồng: đủ trường, không lộ email", "Bảo mật", "Cao",
      SEED + ". Đăng nhập member1@", ["GET /api/communities/photo/members/<id member2>", "Kiểm tra khóa JSON"], "-",
      "200 data gồm id,name ('Mai Member2'),handle,role='member',roleDetail='member',enrolledAt,lastActiveAt,online; KHÔNG có email hay thông tin thanh toán")
    c(F, "Chi tiết thành viên: người không thuộc cộng đồng hoặc bị cấm trả 404", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập member1@", ["GET /api/communities/photo/members/<id newbie>", "GET /api/communities/photo/members/<id banned>", "GET /api/communities/photo/members/khong-co"], "-",
      "Cả ba 404 NOT_FOUND 'Không tìm thấy thành viên'")
    c(F, "Chi tiết thành viên yêu cầu là thành viên; xem được thành viên minh họa", "Chức năng", "Thấp",
      SEED, ["newbie@ GET /api/communities/photo/members/<id member1>", "member1@ GET /api/communities/photo/members/demo-photo-0"], "-",
      "Yêu cầu 1: " + E403M + "; yêu cầu 2: 200 name='Tom Be', handle='tom-be-3538', roleDetail='admin' (thành viên minh họa vẫn xem chi tiết được)")
    c(F, "Trường online của chi tiết thành viên theo cửa sổ 5 phút", "Chức năng", "Thấp",
      SEED + ". Đăng nhập member1@ (vừa gọi API)", ["GET members/demo-photo-0 (hoạt động ~20s trước)", "GET members/demo-photo-7 (hoạt động >= 45 phút trước)"], "-",
      "demo-photo-0: online=true; demo-photo-7 và các id >= 7: online=false; lastActiveAt là ISO 8601")
    c(F, "Hồ sơ công khai /api/users/:id không có email và chỉ liệt kê cộng đồng công khai", "Bảo mật", "Cao",
      SEED + ". Đăng nhập member2@; member1@ thuộc photo (công khai), yt (công khai) và fin (riêng tư)", ["GET /api/users/<id member1>", "Mở /users/<id member1> trên FE"], "-",
      "200 data={id,name:'Minh Member1',bio,location,website,avatarUrl,joinedAt,communities,totalPoints}; KHÔNG có email/phone; communities chỉ gồm các cộng đồng CÔNG KHAI photo, yt, paid-demo (seed payments) với role 'member'; fin (riêng tư) bị ẩn; totalPoints=110")
    c(F, "Hồ sơ công khai yêu cầu đăng nhập (khác với mô tả 'công khai')", "Bảo mật", "Trung bình",
      SEED, ["GET /api/users/<id member1> không token"], "-",
      E401 + " (route có requireAuth; thuật ngữ 'hồ sơ công khai' nghĩa là không lộ dữ liệu riêng, không phải xem không cần đăng nhập)")
    c(F, "Hồ sơ người dùng không tồn tại hoặc đã xóa: 404", "Chức năng", "Thấp",
      SEED, ["member1@ GET /api/users/khong-co", "Xóa tài khoản một user thử rồi GET /api/users/<id đó>"], "-", "404 NOT_FOUND 'Không tìm thấy người dùng'")
    c(F, "Hồ sơ của người bị cấm không liệt kê cộng đồng đã bị cấm", "Chức năng", "Thấp",
      SEED + ". banned@ bị cấm khỏi photo", ["member1@ GET /api/users/<id banned>"], "-",
      "200; communities không chứa photo (listByUser loại người bị cấm); totalPoints=0")
    c(F, "Hồ sơ thành viên minh họa xem được với tổng điểm khớp seed", "Chức năng", "Thấp",
      SEED + ". demo-photo-0 'Tom Be'", ["member1@ GET /api/users/demo-photo-0"], "-",
      "200 name='Tom Be'; totalPoints là tổng điểm PointEvent của demo-photo-0 trên MỌI cộng đồng (mỗi cộng đồng sinh điểm riêng; ở photo = 286); không có email")

    # ---------------------------------------------------------------- Bảng xếp hạng
    F = "Bảng xếp hạng"
    c(F, "Bảng xếp hạng 7 ngày: member1 đứng đầu với 35 điểm", "Chức năng", "Cao",
      LB + ". member1@ có 3 sự kiện điểm ở photo: 35 (post, 1 ngày trước), 30 (like_received, 12 ngày), 45 (lesson_complete, 50 ngày)", ["Đăng nhập member2@", "GET /api/communities/photo/leaderboard?window=7d"], "window=7d",
      "200 data tối đa 10 dòng {userId,name,points,rank}; rank 1 = 'Minh Member1' 35 điểm; rank 2 và 3 = 'Đoàn Thành', 'Nguyen Ba kien' (13 điểm, thành viên minh họa, xếp theo userId tăng dần); các hạng giảm dần; mọi điểm 7 ngày của minh họa tối đa 13")
    c(F, "Bảng xếp hạng 30 ngày: member1 65, member2 30 đứng hạng 1 và 2", "Chức năng", "Cao",
      LB, ["Đăng nhập member1@", "GET ?window=30d"], "window=30d",
      "rank 1 'Minh Member1' 65 điểm (35+30, sự kiện 50 ngày trước không tính); rank 2 'Mai Member2' 30 điểm (12+18); rank 3 trở đi là minh họa (tối đa 27: Đoàn Thành, Trí Xuân, Tai Do); member3@ (6 điểm) không nằm trong top 10")
    c(F, "Bảng xếp hạng mọi thời điểm: top 10 toàn thành viên minh họa", "Chức năng", "Cao",
      LB, ["Đăng nhập member1@", "GET ?window=all và GET (không tham số)"], "window=all (mặc định)",
      "Hai lời gọi giống nhau; đúng 10 dòng, thứ tự: Michial Kekv 305, Tom Be 286, Tai Do 238, Thuy Le 225, Linh Trần 223, Tran Trong 211, Le Hồng 167, Nguyen Nam 157, Anh Thanh Nien Tre 138, Nong giang Thuyen 125; member1@ (110) hạng 13 nên KHÔNG có trong top 10 (số điểm minh họa sinh xác định từ hash tên cộng đồng)")
    c(F, "window không hợp lệ bị từ chối", "Chức năng", "Thấp",
      LB, ["GET ?window=1d", "GET ?window=ALL"], "-", "Cả hai 400 VALIDATION_ERROR (chỉ nhận 7d, 30d, all)")
    c(F, "Chỉ tính người đang là thành viên, không bị cấm và có điểm > 0", "Chức năng", "Cao",
      LB + ". owner@, cadmin@, mod@ có 0 điểm ở photo; banned@ bị cấm", ["GET ?window=all"], "-",
      "Không có owner@, cadmin@, mod@ (0 điểm) và banned@ trong bảng; tổng số người có điểm > 0 là 63 (60 minh họa + 3 tài khoản member1-3)")
    c(F, "Người bị cấm biến khỏi bảng xếp hạng, bỏ cấm thì điểm cũ trở lại", "Bảo mật", "Cao",
      LB + ". Đăng nhập owner@", ["owner@ POST /api/communities/photo/members/<id member2>/ban", "GET ?window=30d (member2@ hạng 2)", "Bỏ cấm rồi member2@ /enroll", "GET lại"], "-",
      "Sau cấm: 'Mai Member2' không còn trong bảng và rank 2 chuyển cho người kế tiếp (Đoàn Thành 27); sau bỏ cấm và tham gia lại: điểm 30 (30d) quay lại (sổ PointEvent giữ nguyên; chú ý cấm cũng xóa ghi danh nên phải /enroll lại)")
    c(F, "Kick thành viên: rời bảng xếp hạng, tham gia lại thì điểm còn nguyên", "Chức năng", "Trung bình",
      LB, ["Admin kick member3@ ở photo", "GET leaderboard all (member3@ 6 điểm ở hạng 58, ngoài top 10) — kiểm tra bằng GET /levels", "member3@ /enroll lại", "GET /levels"], "-",
      "Sau kick member3@ không còn trong bảng và 403 khi gọi leaderboard; sau khi vào lại điểm vẫn 6 và rank 58")
    c(F, "Đồng điểm xếp theo userId tăng dần (tie-break cố định)", "Chức năng", "Thấp",
      LB, ["GET ?window=7d nhiều lần", "Tìm các dòng cùng điểm 13 (Đoàn Thành demo-photo-14, Nguyen Ba kien demo-photo-15)"], "-",
      "Hai dòng 13 điểm luôn theo thứ tự demo-photo-14 rồi demo-photo-15 ở mọi lần gọi (SQL ORDER BY points DESC, userId ASC); thứ tự ổn định, không ngẫu nhiên")
    c(F, "Bảng xếp hạng yêu cầu đăng nhập và ghi danh", "Bảo mật", "Cao",
      LB, ["GET leaderboard không token", "newbie@ GET leaderboard", "banned@ GET leaderboard"], "-", "Khách " + E401 + "; newbie@ và banned@ " + E403M)
    c(F, "Tên trong bảng xếp hạng lấy từ hồ sơ, không lộ email", "Bảo mật", "Thấp",
      LB, ["GET ?window=all", "Kiểm tra khóa từng dòng"], "-", "Mỗi dòng chỉ có userId,name,points,rank; rank 1..10 liên tục")
    c(F, "FE bảng xếp hạng: đổi 7 ngày / 30 ngày / Mọi thời điểm", "Giao diện", "Trung bình",
      LB, ["Đăng nhập member1@", "Vào tab bảng xếp hạng (Leaderboard) của /communities/photo/community", "Lần lượt chọn 7 ngày, 30 ngày, Mọi thời điểm"], "-",
      "Danh sách đổi theo từng khoảng đúng dữ liệu API ở các case trên; 7 ngày: 'Minh Member1' đứng đầu với 35; mọi thời điểm: 'Michial Kekv' đứng đầu với 305")
    c(F, "Điểm của tài khoản test ở photo: tổng và điểm của bản thân theo /api/me/points", "Chức năng", "Trung bình",
      SEED + ". member1@ có 3 sự kiện điểm ở photo (35+30+45)", ["Đăng nhập member1@", "GET /api/me/points"], "-",
      "200 data.total=110; byCourse=[{course:{id:'photo',…}, points:110}]; recent 3 sự kiện mới nhất trước: post 35 (1 ngày trước), like_received 30 (12 ngày), lesson_complete 45 (50 ngày)")

    # ---------------------------------------------------------------- Hệ thống điểm & cấp độ
    F = "Hệ thống điểm & cấp độ"
    c(F, "Ngưỡng cấp độ: 9 cấp với ngưỡng 0/20/60/120/200/300/450/650/900", "Chức năng", "Cao",
      SEED + ". Đăng nhập member1@", ["GET /api/communities/photo/levels", "Đọc data.levels"], "-",
      "200; data.levels có 9 phần tử {level,name,minPoints,memberPct}: cấp 1 'Tân Binh' 0, cấp 2 'Creator' 20, cấp 3 'YouTuber' 60, cấp 4 'Pro Creator' 120, cấp 5 'Master' 200, cấp 6 'Legend' 300, cấp 7 450, cấp 8 650, cấp 9 900 (cấp 7-9 có name rỗng: ngưỡng tạm/chưa chốt, BRD cần đặt tên)")
    c(F, "Tiến độ của member1@ (110 điểm): Cấp 3 YouTuber, còn 10 điểm lên cấp 4, hạng 13", "Chức năng", "Cao",
      SEED + ". Đăng nhập member1@", ["GET /api/communities/photo/levels", "Đọc data.me"], "-",
      "data.me={userId, name:'Minh Member1', points:110, rank:13, level:3, levelName:'YouTuber', pointsToNext:10, journeyPct:12} (journeyPct = round(110/900×100))")
    c(F, "Tiến độ của member2@ (30 điểm) và member3@ (6 điểm)", "Chức năng", "Trung bình",
      SEED, ["member2@ GET /levels", "member3@ GET /levels"], "-",
      "member2@: points 30, level 2 'Creator', pointsToNext 30, journeyPct 3, rank 28; member3@: points 6, level 1 'Tân Binh', pointsToNext 14, journeyPct 1, rank 58")
    c(F, "Người 0 điểm (owner@ ở photo): hạng null, cấp 1, còn 20 điểm", "Chức năng", "Trung bình",
      SEED, ["owner@ GET /api/communities/photo/levels"], "-", "data.me={points:0, rank:null, level:1, levelName:'Tân Binh', pointsToNext:20, journeyPct:0}")
    c(F, "Phân bố thành viên theo cấp (memberPct) của photo", "Chức năng", "Trung bình",
      SEED + ". Phân bố theo tổng điểm tất cả 71 thành viên hợp lệ (gồm người 0 điểm, kể cả 5 persona 0 điểm): cấp 1: 30, cấp 2: 22, cấp 3: 9, cấp 4: 4, cấp 5: 5, cấp 6: 1", ["member1@ GET /levels", "Đọc memberPct từng cấp"], "-",
      "memberPct: cấp1 42, cấp2 31, cấp3 13, cấp4 6, cấp5 7, cấp6 1, cấp7-9 0 (làm tròn từng cấp nên tổng có thể 101%); banned@ không được tính")
    c(F, "Cấp độ đổi đúng ở các mốc ngưỡng (19/20, 59/60, 119/120 …)", "Chức năng", "Cao",
      SEED + ". Cần chèn PointEvent trực tiếp vào DB cho tài khoản test (không có API cộng điểm tùy ý); Test 2 kiểm bằng SQL", ["Đặt tổng điểm member3@ ở photo lần lượt thành 19, 20, 59, 60, 119, 120, 199, 200, 299, 300, 449, 450, 649, 650, 899, 900", "Mỗi lần GET /levels bằng member3@"],
      "Tổng điểm: các mốc ở bước 1",
      "level: 19->1, 20->2, 59->2, 60->3, 119->3, 120->4, 199->4, 200->5, 299->5, 300->6, 449->6, 450->7, 649->7, 650->8, 899->8, 900->9; ở 900 pointsToNext=0 và journeyPct=100; vượt 900 journeyPct vẫn 100", pw="Không")
    c(F, "Giá trị điểm theo hoạt động: post +5, like_received +2, lesson_complete +3, event_rsvp +1", "Chức năng", "Cao",
      SEED + ". Đăng nhập newbie@ đã tham gia một cộng đồng công khai miễn phí mới", ["Ghi điểm ban đầu (GET /api/me/points)", "Đăng 1 bài", "Nhận 1 lượt thích từ tài khoản khác", "Hoàn thành 1 bài học", "RSVP 1 sự kiện", "GET /api/me/points sau mỗi bước"], "-",
      "Điểm tăng lần lượt +5, +2, +3, +1 và recent ghi reason 'post', 'like_received', 'lesson_complete', 'event_rsvp' (POINT_VALUES; giá trị tạm, chưa chốt); tổng sau 4 bước = 11", pw="Có")
    c(F, "Thành viên nhận điểm ở cộng đồng nào thì tính ở cộng đồng đó", "Chức năng", "Trung bình",
      SEED + ". member1@ thuộc photo, yt, fin", ["member1@ đăng bài ở yt", "GET /api/me/points", "GET /api/communities/yt/leaderboard?window=7d", "GET /api/communities/photo/levels"], "-",
      "byCourse có thêm {course yt, points:5}; total = 115; photo vẫn 110 (sổ điểm tách theo courseId); hồ sơ /api/users/<member1> totalPoints=115")
    c(F, "Chưa đăng nhập không đọc được điểm của mình", "Bảo mật", "Thấp",
      SEED, ["GET /api/me/points không token", "GET /api/communities/photo/levels không token"], "-", "Cả hai " + E401)
    c(F, "FE hành trình thăng cấp: thanh tiến độ và cấp hiện tại", "Giao diện", "Thấp",
      SEED + ". Đăng nhập member1@", ["Mở /communities/photo/community tab Xếp hạng/Cấp độ", "Đối chiếu số hiển thị với API /levels"], "-",
      "Hiển thị 'YouTuber' Cấp 3, 110 điểm, còn 10 điểm lên cấp 4, hạng 13; danh sách cấp có % thành viên mỗi cấp như API")

    # ---------------------------------------------------------------- Thành viên minh họa
    F = "Thành viên minh họa (isDemo)"
    c(F, "Thành viên minh họa không đăng nhập được", "Bảo mật", "Cao",
      SEED + ". demo-photo-0 có email seed-photo-0@demo.sofinhub.invalid, mật khẩu là chuỗi không phải hash", ["POST /api/auth/login {email:'seed-photo-0@demo.sofinhub.invalid', password:'Passw0rd!x'}", "Thử mật khẩu rỗng và '!demo-account-cannot-login'"], "email demo",
      "Mọi lần 401 UNAUTHORIZED, message 'Email hoặc mật khẩu không đúng' (giống sai mật khẩu, không lộ tài khoản demo); đăng ký lại cùng email demo bị chặn vì đã tồn tại (409 'Email này đã được đăng ký')")
    c(F, "Mỗi cộng đồng có đúng 60 thành viên minh họa với id demo-<courseId>-<i>", "Chức năng", "Trung bình",
      SEED, ["member1@ GET /api/communities/yt/members?limit=50&page=2", "Kiểm tra id các dòng minh họa", "owner@ (Owner paid-demo/private-demo) GET members của hai cộng đồng đó"], "-",
      "id có dạng demo-yt-<i>, i=0..59; demo-<courseId>-0 là admin, còn lại member; private-demo và paid-demo cũng có 60 thành viên minh họa cộng thêm owner@ (tổng 61)")
    c(F, "Thành viên minh họa không nhận thông báo và không bị tác động quản trị", "Chức năng", "Trung bình",
      SEED + ". Đăng nhập owner@ (Owner photo)", ["Thử kick, ban, đổi vai trò với demo-photo-4", "Xóa cộng đồng do owner@ tạo có thành viên minh họa rồi kiểm tra thông báo"], "-",
      "kick/đổi vai trò -> 404 'Không tìm thấy thành viên'; ban -> 404; thông báo 'Cộng đồng đã bị xóa' không tạo cho user isDemo")
    c(F, "Thành viên minh họa không nằm trong danh sách chọn khi chuyển quyền (FE)", "Giao diện", "Thấp",
      FIX, ["owner@ vào Cài đặt -> Vùng nguy hiểm -> Chuyển quyền chủ", "Tìm 'Tom Be'"], "-", "Không có thành viên minh họa và chính mình trong danh sách chọn; chỉ hiện thành viên thật")
    c(F, "Điểm thành viên minh họa: mỗi người 3 sự kiện tương ứng 7d / 8-30d / >30 ngày", "Chức năng", "Thấp",
      SEED + ". Ví dụ demo-photo-0 'Tom Be': 7d=2, 30d=4, all=286", ["member1@ GET leaderboard 7d/30d/all", "Kiểm tra điểm của Tom Be ở từng cửa sổ (nếu nằm trong top 10)"], "-",
      "all: Tom Be 286 (hạng 2); Tom Be không nằm top 10 của 7d/30d (điểm 2 và 4 thấp); tổng 7d ≤ 30d ≤ all với mọi thành viên minh họa")

    # ---------------------------------------------------------------- Ghi chú tính năng chưa làm
    F = "Hồ sơ & xếp hạng nâng cao"
    c(F, "Thưởng điểm tự động và huy hiệu theo cấp độ", "Chức năng", "Thấp",
      "Chưa làm: huy hiệu/phần thưởng khi lên cấp, thông báo lên cấp, điểm trừ khi bài bị báo cáo (BRD mục 5 còn mở). ĐÃ làm (audit bước 3): xóa bài/sự kiện thu hồi điểm bằng dòng PointEvent âm reason='revoked' (points.repository revokePointsInTx); cùng nguồn không cộng hai lần (chống farm đăng+xóa)", ["Đăng bài rồi xóa bài", "Kiểm tra điểm"], "-",
      "Cần chốt quy tắc với BA: có thu hồi điểm khi bỏ thích không (hiện CHỈ thu hồi khi xóa bài/sự kiện; bỏ thích không trừ vì khóa nghiệp vụ idempotent); chưa có thông báo lên cấp và huy hiệu", pw="Không", status=PLAN)

    # ---------------------------------------------------------------- Bổ sung sau rà soát lỗi thời (thay thế TC-MEMBER-013 và TC-MEMBER-014)
    F = "Danh sách thành viên"
    c(F, "Mặc định photo: tổng thành viên khớp SQL, phân trang 10/trang, thống kê counts", "Chức năng", "Cao",
      LB + ". Đăng nhập member1@", ["GET /api/communities/photo/members", "Mở /communities/photo/community/thanh-vien"], "-",
      "200; meta={page:1,limit:10,total:N,totalPages:ceil(N/10)} với N = số ghi danh không bị cấm của photo (seed hiện tại N=71 = 66 + 5 persona; đối chiếu SQL); data 10 dòng, mỗi dòng có {id,name,handle,role,roleDetail,enrolledAt,lastActiveAt,online}; "
      "counts.all=N, counts.admins=4 (owner, cadmin, mod, demo-photo-0 admin), counts.online >= 7 (7 thành viên minh họa đầu luôn online; có thể cộng thêm tài khoản thật vừa hoạt động trong 5 phút); banned@ không xuất hiện. "
      "Thay thế TC-MEMBER-013 (số 66/7 trang cũ lỗi thời vì seed admin đợt 1 thêm 5 persona vào photo).")
    c(F, "Trang cuối chỉ còn phần dư; vượt trang trả mảng rỗng", "Chức năng", "Trung bình",
      LB + ". Đăng nhập member1@; với N=71", ["GET ?page=8 (trang cuối)", "GET ?page=9", "GET ?page=1&limit=50", "GET ?limit=25&page=3"], "-",
      "page=8: 1 dòng (N mod 10); page=9: data=[] với meta.total=71; limit=50 trang 1: 50 dòng, totalPages=2; limit=25 page=3: 21 dòng. (N khác 71 thì tính lại theo ceil/mod.) Thay thế TC-MEMBER-014.")
