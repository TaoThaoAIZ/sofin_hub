# -*- coding: utf-8 -*-
"""Testcase module PERF (Tìm kiếm Postgres full-text & hiệu năng SQL - audit backend 2026-10-01, BƯỚC 8, 05/10/2026).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 6.4 + mục 10 bước 8; backend/docs/api/search.md (mục "Cách hoạt động", "Quy tắc hiển thị", "Yêu cầu hạ tầng"), backend/docs/DATABASE.md
(mục "Số truy vấn trước/sau", index FK + Post), backend/docs/api/{messages,content}.md (keyset conversations/feed/comments), DEPLOY.md mục 1.3a (pg_trgm), PLAN.md Audit STEP 8,
backend/prisma/migrations/20261005100000_search_fulltext + 20261005100100_fk_indexes, backend/src/modules/search/*, backend/tests/{search,perf-sql,query-count}.test.ts.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-PERF-nnn không đổi).

QUY ƯỚC: 'bản cũ' = tìm kiếm quét bộ nhớ (tối đa 1.000 bài + 1.000 thành viên mỗi cộng đồng, khớp chuỗi liền nhau, bài xếp mới nhất trước, không tolerant). Các điểm thay đổi hành vi so với bản cũ được đánh dấu 'THAY ĐỔI SO VỚI BẢN CŨ'.
Số đo query-count lấy từ tests/query-count.test.ts (dữ liệu thử cố định) và backend/docs/DATABASE.md; các ngưỡng thời gian (ms) ghi 'ngưỡng đề xuất QA' là do bộ test này đặt, CHƯA có trong tài liệu dự án.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset, gồm migration search_fulltext + fk_indexes; extension pg_trgm); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev), frontend :5173. "
        "Rate limit tìm kiếm 40 yêu cầu/phút/user nên khi chạy nhiều lần liên tiếp hãy giãn thời gian.")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset; hoặc chỉ dùng dữ liệu do chính case tạo ra."
SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (bảng Prisma 'Course' = cộng đồng, cột cộng đồng của mọi bảng là \"courseId\"; 'LearningCourse' = khóa học)."
USER = "Người dùng thử = tài khoản MỚI đăng ký (POST /api/auth/register) rồi tham gia cộng đồng cần thiết bằng POST /api/courses/<id>/enroll."
ADMIN = "Token admin: POST /api/auth/login admin@sofinhub.test / Passw0rd!x."
BIGPOST = ("Tạo 1.100 bài bằng SQL cho cộng đồng 'photo' (đổi <uid> thành id người dùng thử): INSERT INTO \"Post\"(id,\"courseId\",\"authorId\",content,\"createdAt\",\"updatedAt\") "
           "SELECT gen_random_uuid(),'photo','<uid>','bài số '||g||' fillerabc', now()-g*interval '1 second', now() FROM generate_series(1,1100) g; "
           "rồi thêm 1 bài rất cũ: INSERT ... content='bài cổ ancientxyz fillerabc', \"createdAt\"='2001-01-01'. (Nếu báo thiếu cột NOT NULL, bổ sung theo \\d \"Post\".) Cột searchVector là GENERATED nên tự có.")


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}}."


def load(add):
    M, MN = "PERF", "Tìm kiếm & hiệu năng (audit bước 8)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. TÌM KIẾM: HỢP ĐỒNG CƠ BẢN
    F = "Tìm kiếm toàn văn: hợp đồng API"
    A(F, "GET /search: 401 khi thiếu token; 400 khi q thiếu/<2/>100 ký tự hoặc type lạ", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?q=abc không token", "GET /api/search (thiếu q), ?q=a, ?q=<101 ký tự>, ?q=abc&type=foo", "GET /api/search/suggest?q=a và suggest không token"], "q 2..100, type all|posts|members|courses",
      "Không token 401 UNAUTHORIZED; thiếu q / q=1 ký tự / 101 ký tự / type lạ: 400 VALIDATION_ERROR; suggest cũng 401/400 tương ứng.", pw="Có")
    A(F, "Hình dạng phản hồi: {data:[Result], meta, counts:{courses,members,posts}} với Segment[] (không HTML)", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?q=anh&type=all&limit=10", "Đọc từng loại kết quả", "Tìm ký tự '<mark' trong JSON"], "q=anh",
      "course: {id,title:Segment[],snippet:Segment[],link}; member: {id,courseId,courseTitle,name,handle,role,link}; post: {id,courseId,courseTitle,author,snippet,createdAt,link}; Segment={text,match}. KHÔNG có thẻ HTML/<mark>; counts đủ 3 khóa.", pw="Có")
    A(F, "type=all xếp khóa học -> thành viên -> bài viết rồi phân trang chung; counts đúng; không trùng/sót qua các trang", "Chức năng", "Cao", BASE + " " + USER + " Dữ liệu: cộng đồng tự tạo 'Nhóm mixedkw' (POST /communities), 1 khóa khác cũng chứa 'mixedkw', người dùng đặt firstName='mixedkw' (PATCH /api/auth/me), 3 bài chứa mixedkw.",
      ["GET /api/search?q=mixedkw&limit=2&page=1", "Lặp page=2,3,4", "Gộp danh sách type theo thứ tự"], "mixedkw: 2 khóa + 1 thành viên + 3 bài",
      "Mỗi trang counts = {courses:2,members:1,posts:3}; meta.total=6, totalPages=3; thứ tự type gộp: course, course, member, post, post, post; không trùng/không sót.", pw="Có")
    A(F, "limit tối đa 50 (mặc định 10); meta.page/limit/total/totalPages đúng", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?q=anh&limit=2&page=1", "GET ...&limit=51", "GET ...&limit=0"], "limit", "limit=2: tối đa 2 phần tử, meta.limit=2; limit=51 hoặc 0: 400.", pw="Có")
    A(F, "courseId chỉ định: thành viên -> chỉ trong cộng đồng đó; không phải thành viên 403; không tồn tại 404", "Chức năng", "Cao", BASE + " " + USER,
      ["GET /api/search?q=xin&courseId=photo bằng người ngoài", "GET /api/search?q=xin&courseId=khong-co", "member1 GET ...&courseId=photo", "Dùng communityId=photo thay courseId"], "courseId/communityId",
      "Người ngoài 403; không tồn tại 404; member1 200 giới hạn photo; communityId (tên mới) cho kết quả y hệt courseId (alias).", pw="Có")
    A(F, "Người ngoài không thấy bài/thành viên của cộng đồng chưa tham gia", "Bảo mật", "Cao", BASE + " " + USER,
      ["member1 đăng bài chứa 'zebra20261005xyz' ở photo", "Người ngoài GET /api/search?q=zebra20261005xyz&type=posts"], "bài ở photo", "meta.total=0 cho người ngoài; member1 (thành viên) thấy 1.", pw="Có")
    A(F, "Khớp theo từ KHÔNG cần liền nhau/đúng thứ tự (bài viết)", "Chức năng", "Cao", BASE + " " + USER + " U tham gia photo, đăng bài 'Mình vừa chụp bức ảnh Hoàng hôn kwdemo1'.",
      ["GET /api/search?type=posts&courseId=photo&q=kwdemo1 chup anh", "GET ...&q=anh chup kwdemo1"], "3 từ rời", "Cả hai tìm thấy 1 bài; snippet có đoạn match (tô từ đơn dài nhất khi cụm không liền nhau). THAY ĐỔI SO VỚI BẢN CŨ: trước chỉ khớp cả cụm liền.", pw="Có")

    # ============================================================ 2. DẤU, TIỀN TỐ, CHUỖI CON, GÕ SAI
    F = "Tìm kiếm: bỏ dấu 2 chiều, tiền tố, chuỗi con, gõ sai"
    A(F, "Không phân biệt dấu: gõ KHÔNG dấu tìm ra tên có dấu ('nhiep anh' -> 'Nhiếp ảnh bằng điện thoại')", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=courses&q=nhiep anh", "GET ...&q=NHIEP ANH", "GET ...&q=Nhiep Anh"], "photo = 'Nhiếp ảnh bằng điện thoại'",
      "Cả 3 trả khóa photo (title Segment có match). Hoa/thường không phân biệt.", pw="Có")
    A(F, "Không phân biệt dấu chiều ngược: gõ CÓ dấu tìm ra nội dung không dấu", "Chức năng", "Cao", BASE + " " + USER,
      ["U đăng bài 'chup anh duong pho voi dien thoai kwdemo2' (không dấu) ở photo", "GET /api/search?type=posts&courseId=photo&q=chụp ảnh đường phố kwdemo2", "GET ...&q=CHỤP ẢNH"], "nội dung không dấu, q có dấu", "Bài được tìm thấy (sf_fold gập dấu cả hai phía).", pw="Có")
    A(F, "Chữ đ/Đ được gập thành d ('Đường' = 'duong' = 'DUONG')", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U đăng bài 'Đường Việt kwdemo3'", "Tìm q=duong viet kwdemo3, q=ĐƯỜNG, q=Duong"], "đ/Đ", "Cả 3 tìm thấy bài; snippet tô 'Đường Việt'.", pw="Có")
    A(F, "sf_fold trong SQL khớp normalizeText của JS (Đ/đ, dấu tổ hợp, chữ hoa)", "Chức năng", "Trung bình", BASE + " " + SQLH,
      ["SELECT sf_fold('Đường Việt Nhiếp Ảnh'), sf_fold('ĐẸP Ơ Ư'), sf_fold('Nhiếp ảnh'), sf_fold('Crème Brûlée Ñandú')"], "sf_fold",
      "Kết quả: 'duong viet nhiep anh', 'dep o u', 'nhiep anh', 'creme brulee nandu' (hạ chữ thường, bỏ dấu tổ hợp, đ->d, không phụ thuộc locale DB). Khớp với normalizeText.", pw="Không")
    A(F, "Tiền tố từng từ: gõ dở từ vẫn ra ('nhiep an' khớp 'Nhiếp ảnh')", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=courses&q=nhiep an", "GET ...&q=dien tho", "GET ...&q=nh"], "tiền tố", "Khóa photo xuất hiện cho 'nhiep an' và 'dien tho'; q='nh' (2 ký tự) trả các khóa có từ bắt đầu bằng 'nh'. THAY ĐỔI SO VỚI BẢN CŨ: tiền tố từng từ thay vì chỉ chuỗi con liền nhau.", pw="Có")
    A(F, "Chuỗi con ở giữa từ cho TÊN khóa học và tên người (LIKE + trigram)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=courses&q=iep anh", "GET /api/search?type=members&q=ember1"], "iep anh / ember1", "Khóa photo khớp 'iep anh' (chuỗi con của 'Nhiếp ảnh'); thành viên 'Minh Member1' khớp 'ember1'. Nội dung bài/mô tả chỉ có tiền tố từ (không khớp giữa từ) - giới hạn đã biết.", pw="Có")
    A(F, "Chịu gõ sai (pg_trgm word_similarity >= 0,6) tên khóa học: 'markting' -> 'Marketing thực chiến'", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=courses&q=markting", "GET ...&q=marketng", "GET ...&q=zzzxxqqwwkk"], "typo", "Hai truy vấn gõ sai trả khóa mkt (Marketing thực chiến); chuỗi rác không trả khóa nào. Kết quả typo KHÔNG có đoạn tô đậm (match=false toàn bộ). THAY ĐỔI SO VỚI BẢN CŨ: trước gõ sai là mất kết quả.", pw="Có")
    A(F, "Chịu gõ sai tên thành viên (cùng cộng đồng)", "Chức năng", "Trung bình", BASE + " " + USER + " U tham gia photo; owner@ là chủ photo (Olivia Owner).",
      ["GET /api/search?type=members&q=oliva ouner", "GET /api/search?type=members&q=olivia"], "typo tên", "Cả hai trả thành viên 'Olivia Owner' ở photo (courseId photo, link .../community?tab=members).", pw="Có")
    A(F, "Từ quá ngắn (<4 ký tự) KHÔNG nới lỏng mờ: 'phx' không khớp 'Photo...'", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=courses&q=phx", "GET ...&q=pho"], "3 ký tự", "'phx' không có kết quả (chỉ tiền tố/chuỗi con, không fuzzy); 'pho' khớp tiền tố (nếu có từ bắt đầu bằng pho).", pw="Có")
    A(F, "Ký tự đặc biệt LIKE (% _ \\) là chữ thường; q chỉ toàn dấu câu không gây lỗi", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test") + " Có 2 cộng đồng tự tạo: 'Giảm kwpct 5%% ngay' và 'Giảm kwpct 5xx ngay'.",
      ["GET /api/search?type=courses&q=%25%25 (tức '%%')", "GET ...&q=__", "GET ...&q=--", "GET ...&q=o'brien & (x)", "GET ...&q=a\\b_c"], "ký tự đặc biệt", "'%%' chỉ khớp tên chứa đúng '%%'; '__' không khớp mọi thứ; '--', \"o'brien & (x)\", 'a\\b_c' trả 200 (không 500, không SQL injection).", pw="Có")
    A(F, "Tìm kiếm không bị chèn SQL: q chứa dấu nháy/; DROP", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?q=x'; DROP TABLE \"Post\"; --", "GET /api/search?q=1 OR 1=1"], "SQLi", "200 với kết quả rỗng hoặc khớp văn bản; bảng Post nguyên vẹn (truy vấn tham số hóa).", pw="Có")
    A(F, "Tìm theo thẻ (#tag) và theo tên tác giả cho bài viết", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U đăng bài với tags ['#kwtag9'] và nội dung không chứa từ đó", "GET /api/search?type=posts&q=kwtag9", "GET /api/search?type=posts&courseId=photo&q=<tên U>"], "tag + author", "Bài được tìm theo thẻ; tìm theo tên tác giả trả bài của người đó (author = 'Test <tên>').", pw="Có")
    A(F, "Tìm thành viên theo handle (phần slug) khi q có dấu '-'", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["Lấy handle thành viên: GET /api/courses/photo/members (handle dạng slug-NNNN)", "GET /api/search?type=members&courseId=photo&q=<phần slug có dấu ->"], "handle", "Khớp phần slug; phần số đuôi (-NNNN) không tra được trong SQL (handle tính khi đọc). Kết quả có handle, role ('admin'|'member'), link '/courses/photo/community?tab=members'.", pw="Có")
    A(F, "Tài khoản đã xóa hiện 'Thành viên đã xóa' trong kết quả", "Chức năng", "Thấp", BASE + " " + USER + " " + MUTATE,
      ["U đăng bài kwdemo4 ở photo", "U xóa tài khoản (DELETE /api/auth/me {password})", "member1 tìm kwdemo4"], "xóa tài khoản", "Bài còn (giữ nội dung) với author 'Thành viên đã xóa'; không tìm theo tên cũ.", pw="Có")

    # ============================================================ 3. XẾP HẠNG + PHÂN TRANG
    F = "Tìm kiếm: xếp hạng và phân trang trong SQL"
    A(F, "Xếp hạng khóa học: tên chứa từ khóa > chỉ mô tả; 'reduced' luôn xếp sau cùng", "Chức năng", "Cao", BASE + " " + USER + " " + ADMIN,
      ["Tạo 3 cộng đồng: A title 'Khóa A' + mô tả chứa 'kwquokka'; B title 'Học kwquokka cơ bản'; C title 'kwquokka kwquokka kwquokka'", "Admin > Khám phá > Hiển thị tìm kiếm: đặt C = Giảm hiển thị (reduced)", "GET /api/search?type=courses&q=kwquokka"], "3 cộng đồng",
      "Thứ tự: B (title) -> A (mô tả) -> C (reduced, dù lặp từ nhiều nhất). counts.courses=3. THAY ĐỔI SO VỚI BẢN CŨ: có xếp hạng ts_rank + 1 nếu chứa nguyên cụm + 0,5 x trigram, rồi mới nhất.", pw="Một phần")
    A(F, "Xếp hạng bài viết: ts_rank (độ liên quan) rồi mới nhất", "Chức năng", "Trung bình", BASE + " " + USER,
      ["U đăng 3 bài: P1 'kwrank' ; P2 'kwrank kwrank kwrank nội dung'; P3 mới nhất chứa 'kwrank' trong câu dài", "GET /api/search?type=posts&courseId=photo&q=kwrank"], "3 bài", "Bài có tần suất/độ liên quan cao hơn (ts_rank, chuẩn hóa độ dài) đứng trước; ngang điểm thì bài mới hơn trước. THAY ĐỔI SO VỚI BẢN CŨ: trước chỉ 'mới nhất trước'.", pw="Một phần")
    A(F, "Bài cũ hơn 1.000 bài gần nhất vẫn tìm được (không còn trần 1.000)", "Chức năng", "Cao", BASE + " " + USER + " " + SQLH + " " + BIGPOST + " " + MUTATE,
      ["Tạo dữ liệu như tiền điều kiện", "GET /api/search?type=posts&courseId=photo&q=ancientxyz", "GET ...&q=fillerabc&limit=50&page=22 và page=23 và page=24"], "1.101 bài",
      "ancientxyz: meta.total=1, tìm thấy bài năm 2001. fillerabc: total=1101, totalPages=23; page 22 có 50 phần tử, page 23 có 1, page 24 rỗng; không trùng giữa các trang (51 id khác nhau).", pw="Không")
    A(F, "Phân trang trải qua nhiều nhóm (courses -> members -> posts) đúng LIMIT/OFFSET giao với trang", "Chức năng", "Trung bình", BASE + " " + USER,
      ["Dữ liệu 'mixedkw' như case trước", "Lấy từng trang limit=4 và so sánh với tổng"], "limit 4", "Mỗi trang chỉ truy vấn đoạn cần thiết của từng nhóm (đếm 1 truy vấn/nhóm + <=3 truy vấn trang); tổng các trang = meta.total, không trùng/sót.", pw="Một phần")
    A(F, "page tối đa MAX_PAGE=1000 cho tìm kiếm (1001 -> 400)", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?q=anh&page=1000", "GET /api/search?q=anh&page=1001"], "page cap", "page=1000: 200 (rỗng); 1001: 400.", pw="Có")
    A(F, "Rate limit tìm kiếm 40 yêu cầu/phút/user (429); suggest dùng cùng hạn mức", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Gọi GET /api/search?q=anh 41 lần trong 60 giây", "Gọi /api/search/suggest?q=an thêm vài lần"], "40/phút", "Lần 41: 429 TOO_MANY_REQUESTS; sau cửa sổ 60s mở lại. (NODE_ENV=test nới gần vô hạn.) Có Redis: hạn mức chung giữa instance; lỗi store -> cho qua.", pw="Một phần")

    # ============================================================ 4. QUY TẮC HIỂN THỊ (SQL WHERE)
    F = "Tìm kiếm: quy tắc hiển thị (hidden/removed/private/banned/locked/deleted...)"
    VIS = BASE + " Quyền xem do user đăng nhập (member1@ / người ngoài / mod). " + SQLH
    A(F, "Khóa học: chỉ công khai + chưa xóa + không locked + active + searchVisibility<>hidden", "Bảo mật", "Cao", VIS + " " + ADMIN,
      ["Tạo 8 cộng đồng cùng chứa kwscope: public, private, locked (admin lock), deleted (DELETE), unlisted (Admin > Khám phá bỏ khỏi danh sách), search-hidden, suspended (Admin tạm ngưng), reduced", "Người ngoài GET /api/search?type=courses&q=kwscope"], "kwscope",
      "Có mặt: public, unlisted (tìm được dù không có ở Khám phá), reduced (xếp cuối). KHÔNG có: private, locked, deleted, search-hidden, suspended. (Cộng đồng công khai mà user bị cấm vẫn hiện.)", pw="Một phần")
    A(F, "Bài viết: chỉ trong cộng đồng user đang là thành viên (chưa bị cấm/khóa/xóa)", "Bảo mật", "Cao", VIS,
      ["member1 là thành viên photo; người ngoài không", "Đăng bài kwscope2 ở photo", "So kết quả type=posts của hai người"], "kwscope2", "Chỉ member1 thấy; người ngoài 0.", pw="Có")
    A(F, "Bài bị ẩn (hidden): chỉ mod+ thấy; tác giả thường KHÔNG tự thấy trong tìm kiếm (khác feed)", "Bảo mật", "Cao", VIS + " Tác giả A, người khác O, mod M ở photo.",
      ["A đăng 1 bài 'kwhid' rồi mod ẩn (POST /api/posts/<id>/hide)", "A, O, M lần lượt GET /api/search?type=posts&q=kwhid"], "bài hidden", "M thấy; A và O không thấy. THAY ĐỔI/ĐIỂM LƯU Ý: ở feed tác giả vẫn thấy bài ẩn của mình, ở tìm kiếm thì không (docs/search.md).", pw="Một phần")
    A(F, "Bài bị gỡ (removedAt do Platform Admin): không ai thấy", "Bảo mật", "Cao", VIS + " " + ADMIN,
      ["Admin > Nội dung > Bài viết > Gỡ bài 'kwrem'", "Mod/admin/người khác tìm kwrem"], "removed", "Không ai (kể cả mod) thấy.", pw="Một phần")
    A(F, "Cộng đồng riêng tư: thành viên tìm thấy bài, người lạ không", "Bảo mật", "Cao", VIS,
      ["Dùng private-demo/fin: thành viên (owner@) đăng bài 'kwpriv'", "Người ngoài tìm kwpriv type=posts và type=courses"], "private", "Bài chỉ thành viên thấy; khóa học riêng tư không có trong kết quả type=courses của người ngoài.", pw="Một phần")
    A(F, "User bị cấm khỏi cộng đồng: không tìm được bài/thành viên ở đó; courseId chỉ định -> 403", "Bảo mật", "Cao", VIS + " " + tok("banned@sofinhub.test"),
      ["banned@ GET /api/search?type=posts&q=<từ có ở photo>", "GET ...&courseId=photo", "Ban 1 user vừa tham gia rồi tìm thành viên đó từ người khác"], "bị cấm", "Không có kết quả từ cộng đồng đã bị cấm; courseId đó -> 403; thành viên bị cấm biến khỏi kết quả type=members của người khác.", pw="Một phần")
    A(F, "Cộng đồng bị khóa/đã xóa: bài viết không tìm được nữa", "Bảo mật", "Trung bình", VIS + " " + ADMIN,
      ["Tạo cộng đồng + bài 'kwlock'", "Admin khóa -> tìm; xóa -> tìm"], "locked/deleted", "Sau khi khóa hoặc xóa: bài không còn trong type=posts của thành viên.", pw="Một phần")
    A(F, "Thành viên minh họa (isDemo) vẫn tìm được như thành viên thường", "Chức năng", "Thấp", VIS + " " + tok("member1@sofinhub.test"),
      ["GET /api/search?type=members&courseId=paid-demo&q=demo"], "demo members", "Có kết quả thành viên minh họa trong cộng đồng đã tham gia (nếu member1 là thành viên paid-demo).", pw="Có")
    A(F, "Tìm kiếm chưa phủ: bình luận, sự kiện, bài học lớp học (đã biết)", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["Tìm cụm chỉ có trong 1 bình luận/tiêu đề bài học/sự kiện"], "search.md 'Chưa làm'", "HIỆN TẠI: không có kết quả (chỉ khóa học, thành viên, bài viết). Kế hoạch: thêm vector cho ClassroomLesson, bình luận.", pw="Có", st=PLAN)
    A(F, "Tô đậm (Segment) cho đúng các dòng của trang: nguyên cụm; từ rời -> từ đơn dài nhất; typo không tô", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Tìm cụm liền 'nhiep anh' -> kiểm tra Segment", "Tìm 'anh chup' (rời)", "Tìm typo 'markting'"], "Segment", "Cụm liền: Segment match bọc đúng 'Nhiếp ảnh'. Từ rời: tô từ đơn dài nhất có mặt. Typo: không đoạn nào match=true.", pw="Có")
    A(F, "Nội dung có HTML được trả nguyên dạng text, FE tự escape (không XSS)", "Bảo mật", "Cao", BASE + " " + USER,
      ["U đăng bài \"<img src=x onerror=alert(1)> kwxss\"", "Tìm kwxss ở FE /search"], "XSS", "API trả Segment text chứa '<img ...>' nguyên văn; FE hiển thị như chữ, không chạy script, không có cửa sổ alert.", pw="Có")

    # ============================================================ 5. SUGGEST + GET /courses?q
    F = "Gợi ý và danh sách khóa học (q trong SQL)"
    A(F, "/search/suggest trả tối đa 5, xen kẽ course -> member -> post (3 truy vấn LIMIT 5)", "Chức năng", "Cao", BASE + " " + USER + " Dữ liệu 'kwsug': 4 khóa chứa kwsug + 1 cộng đồng + U có firstName 'Tenkwsug' + 3 bài.",
      ["GET /api/search/suggest?q=kwsug"], "kwsug", "Đúng 5 mục; 3 mục đầu theo type ['course','member','post'], mục 4 'course', mục 5 'post'. Không chạy lại toàn bộ phép quét (xem số truy vấn).", pw="Có")
    A(F, "suggest: <5 kết quả khi ít dữ liệu; q 2-100 ký tự; 429 theo hạn mức", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/search/suggest?q=zzqq", "GET ...?q=an"], "suggest", "q hiếm: data=[]; q chung: <=5 phần tử.", pw="Có")
    A(F, "GET /courses?q= chọn id bằng SQL: không dấu, theo từ/tiền tố, mô tả, tên giảng viên; hidden bị loại", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test") + " " + ADMIN,
      ["Tạo 4 cộng đồng chứa kwcq: title 'Nhiếp ảnh kwcq', mô tả có kwcq, instructor có kwcq (SQL), search-hidden", "GET /api/courses?q=NHIẾP kwcq&limit=50", "GET /api/courses?q=kwcq&limit=50", "GET /api/courses?q=kwcq&sort=top&limit=2&page=2"], "kwcq",
      "q='NHIẾP kwcq': chỉ khóa có cả hai từ (title); q=kwcq: 3 khóa (title/mô tả/giảng viên) và KHÔNG có search-hidden; meta.total=3; sort=top page 2 có 1 phần tử. Không có q: hành vi cũ (limit=3 -> 3 phần tử).", pw="Một phần")
    A(F, "GET /courses?q không đọc cả bảng Course (số truy vấn không tăng theo số cộng đồng)", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Có >=100 cộng đồng (tạo bằng SQL generate_series).",
      ["Bật log SQL: ALTER DATABASE sofinhub SET log_statement='all' (kết nối mới)", "GET /api/courses?q=nhiep", "docker logs sofinhub-postgres --tail 50 | tìm SELECT trên \"Course\""], "q trong SQL", "Có 1 truy vấn chọn id khớp (WHERE searchVector/LIKE) rồi nạp đúng các khóa đó; KHÔNG có SELECT * FROM \"Course\" không điều kiện. Nhớ ALTER DATABASE ... RESET log_statement.", pw="Không")
    A(F, "FE: trang /search - ô tìm, tab Tất cả/Khóa học/Bài viết/Thành viên, 'Không có kết quả cho \"q\"'", "Giao diện", "Cao", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở http://localhost:5173/search", "Gõ 'nhiep anh' (không dấu) và Enter", "Chuyển 3 tab", "Gõ 'zzzxxqq'"], "FE search",
      "Kết quả khóa 'Nhiếp ảnh bằng điện thoại' với phần khớp được tô (<mark> do FE render từ Segment); tab lọc đúng theo type; không kết quả: 'Không có kết quả cho \"zzzxxqq\".'; không có lỗi console.", pw="Có")
    A(F, "FE: phân trang kết quả tìm kiếm và liên kết kết quả dẫn đúng trang", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@; từ khóa trả > 10 kết quả (vd 'anh').",
      ["Mở /search?q=anh", "Chuyển trang 2", "Bấm một kết quả thành viên/bài viết/khóa học"], "FE pagination", "Trang 2 hiển thị phần còn lại, không lặp kết quả trang 1; bấm kết quả mở /communities/<id>/... (liên kết cũ /courses/... được chuyển hướng).", pw="Có")
    A(F, "FE: ô tìm kiếm Hero trang chủ lọc khóa học bằng q (GET /courses?q)", "Giao diện", "Trung bình", BASE,
      ["Mở trang chủ", "Gõ 'marketing' vào ô tìm kiếm ở Hero rồi Enter", "Gõ 'MARKETING' và 'markting'"], "Hero search", "Danh sách 'Khóa học nổi bật' còn khóa Marketing thực chiến; không phân biệt hoa thường; 'markting' (gõ sai) vẫn ra nếu logic /courses dùng cùng bộ khớp (ghi lại nếu không).", pw="Có")
    A(F, "Thay đổi hành vi so với bản cũ cần thông báo: bốn điểm (prefix từng từ, ts_rank rồi mới nhất, typo không highlight, tác giả không thấy bài ẩn)", "Chức năng", "Trung bình", "Đọc backend/docs/api/search.md và so với test cũ (search.test.ts bản trước).",
      ["Đối chiếu từng gạch đầu dòng 'Cách hoạt động' với hành vi cũ"], "regression note", "Ghi nhận cho tester: (1) khớp theo từ/tiền tố thay vì cụm liền; (2) xếp theo độ liên quan thay vì chỉ mới nhất; (3) kết quả gõ sai không có đoạn tô; (4) bài ẩn của chính mình không hiện trong tìm kiếm. Không phải lỗi.", pw="Không")

    # ============================================================ 6. SỐ TRUY VẤN (tests/query-count.test.ts)
    F = "Số truy vấn SQL trước/sau (query-count)"
    QC = ("Chạy: cd backend; npx cross-env NODE_ENV=test node --import tsx --test tests/query-count.test.ts (log in dòng '[query-count] <nhãn>: <n>'). Đặt QC_BASELINE=1 để chỉ in số, không ép ngưỡng; QC_SQL=1 in từng câu SQL. "
          "Số đếm = câu SQL thật gửi Postgres (bỏ BEGIN/COMMIT); lần gọi qua HTTP đã gồm ~2 truy vấn của middleware xác thực.")
    for label, data_, before, after, thr, extra in (
        ("GET /search (type=all)", "3 cộng đồng x 20 thành viên x 120 bài (gọi service)", "125 (tăng tuyến tính; ~55 truy vấn/trang x tối đa 20 trang x mỗi cộng đồng = ~11.000 ở quy mô audit)", "7 (cố định: phạm vi + 3 đếm + <=3 trang; ở quy mô audit ~8)", "<= 8", "counts.posts = 3 x 18 = 54 (mỗi cộng đồng 18 bài chứa 'hello')"),
        ("GET /search/suggest", "như trên", "125 (chạy cả phép quét rồi cắt 5)", "5 (3 truy vấn LIMIT 5 + phạm vi)", "<= 6", "kết quả <= 5 mục xen kẽ"),
        ("GET /conversations", "20 hội thoại x 3 tin chưa đọc", "45 (~2/hội thoại; audit: 4/hội thoại x 300 hội thoại ≈ 1.200)", "3 (1 truy vấn dữ liệu + 2 xác thực), bất kể số hội thoại", "<= 4", "mỗi hội thoại unreadCount=3, lastMessage.content='tin 3'"),
        ("GET /courses/:id/lessons/:lessonId", "khóa 4 module x 12 bài, thân bài 5KB", "21 (gồm 1 truy vấn nạp thân bài của MỌI bài ~20MB ở quy mô audit)", "10, không nạp thân bài nào ngoài bài đang mở", "<= 11 và 0 truy vấn SELECT body của cả khóa", "prevLessonId=null, nextLessonId là chuỗi"),
        ("GET /me/enrollments", "8 cộng đồng, mỗi khóa 4 module", "44 (~5/cộng đồng, tuần tự; audit 30 cộng đồng ~150)", "6 (ghi danh 2 + thông tin khóa 1 + tiến độ gộp 1 + auth 2), bất kể số cộng đồng", "<= 7", "8 phần tử"),
    ):
        A(F, f"Số truy vấn {label}: trước {before.split(' ')[0]} -> sau {after.split(' ')[0]} (ngưỡng {thr})", "Hiệu năng", "Cao", "Cài backend; Postgres local chạy. " + QC,
          [f"Chạy tests/query-count.test.ts", f"Tìm dòng '[query-count] ...' tương ứng {label}", "Đối chiếu số đo với bảng 'Số truy vấn trước/sau' trong backend/docs/DATABASE.md"], data_,
          f"Đo được đúng/gần đúng: sau = {after}; ngưỡng ép trong test: {thr}. Trước: {before}. Kiểm tra thêm: {extra}.", pw="Không")
    A(F, "Số truy vấn không tăng theo dữ liệu: nhân đôi số cộng đồng/hội thoại, số truy vấn giữ nguyên", "Hiệu năng", "Cao", BASE + " " + SQLH + " " + QC,
      ["Đo /me/enrollments với 8 cộng đồng, rồi cho người dùng tham gia thêm 8 cộng đồng nữa và đo lại", "Đo /conversations với 20 rồi 40 hội thoại (INSERT SQL)", "Dùng log_statement='all' (ALTER DATABASE sofinhub SET log_statement='all') và đếm dòng trong docker logs"], "tăng gấp đôi",
      "Số truy vấn của /me/enrollments và /conversations không đổi (6 và 3 kể cả auth); trước đây tăng tuyến tính (N+1).", pw="Không")
    A(F, "Mở 1 bài học: không có truy vấn nào nạp body của nhiều bài (đo bằng log SQL)", "Hiệu năng", "Cao", BASE + " " + SQLH + " " + tok("member1@sofinhub.test"),
      ["ALTER DATABASE sofinhub SET log_statement='all'; kết nối lại", "GET /api/courses/photo/lessons/les-photo-1-1 (Bearer member1)", "docker logs sofinhub-postgres | tìm SELECT trên \"ClassroomLesson\"", "ALTER DATABASE sofinhub RESET log_statement"], "photo bài 1.1",
      "Chỉ 1 truy vấn lấy cột body (WHERE id = ...); các truy vấn khác (module, prev/next, tiến độ) không lấy cột body. Tổng truy vấn nghiệp vụ ≈ 8 (+2 auth).", pw="Không")
    A(F, "Bỏ tải Course thừa: route lớp học/bảng tin dùng lockState nhẹ + touchIfMember 1 câu UPDATE...RETURNING", "Hiệu năng", "Thấp", BASE + " " + SQLH,
      ["Bật log SQL, gọi GET /api/courses/photo/modules và GET /api/courses/photo/posts", "Đếm truy vấn tới bảng \"Course\""], "route lớp học/feed", "Mỗi request chỉ chạm \"Course\" đúng 1 lần (lockState) thay vì 3 lần; getRole còn 1 truy vấn thay vì 2 (DATABASE.md 'Thay đổi khác cùng đợt').", pw="Không")
    A(F, "Ngưỡng thời gian đề xuất QA: /search và /suggest < 300 ms với 100k bài (p95)", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Ngưỡng 'đề xuất QA' (chưa có trong tài liệu). Chèn 100.000 bài bằng generate_series vào 3 cộng đồng mà user tham gia.",
      ["Đo 30 lần GET /api/search?q=<từ phổ biến>&limit=10 (curl -w %{time_total})", "Đo 30 lần suggest", "EXPLAIN ANALYZE truy vấn trang bài"], "100k bài", "p95 < 300ms (đề xuất); EXPLAIN dùng Post_searchVector_idx (GIN) thay vì Seq Scan toàn bảng. Nếu vượt: ghi nhận để tối ưu (không phải lỗi chức năng).", pw="Không")

    # ============================================================ 7. INDEX + SCHEMA
    F = "Index khóa ngoại + index Post + extension pg_trgm"
    A(F, "Mọi khóa ngoại đều có index dẫn đầu bằng cột FK (không còn FK trần)", "Hiệu năng", "Cao", BASE + " " + SQLH,
      ["Chạy: SELECT c.conrelid::regclass::text AS tbl, array_agg(a.attname::text ORDER BY a.attnum) AS cols FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey) WHERE c.contype='f' AND c.connamespace=current_schema()::regnamespace AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid=c.conrelid AND (i.indkey::int2[])[0:array_length(c.conkey,1)-1]=c.conkey) GROUP BY c.oid,c.conrelid"], "pg_constraint x pg_index",
      "0 dòng (mọi FK có index). Test tương đương: perf-sql.test.ts 'mọi khóa ngoại đều có index'.", pw="Không")
    A(F, "15 cột FK audit nêu đều có index: Certificate.courseId, CommunityBan.userId/bannedById, CommunityEvent.hostId, Invite.createdById, JoinRequest.decidedById, Notification.courseId, PollVote.userId, PostLikeNotice.userId, RefundRequest.userId/resolvedById, Report.targetUserId/resolvedById, Review.userId, Upload.courseId", "Hiệu năng", "Cao", BASE + " " + SQLH,
      ["Với mỗi bảng: \\d \"<Bảng>\" hoặc SELECT indexdef FROM pg_indexes WHERE tablename='<Bảng>'", "Kiểm tra index chứa cột FK ở vị trí đầu (migration 20261005100100_fk_indexes)"], "15 FK",
      "Tất cả có index; DELETE trên User/Course không còn seq-scan từng bảng để cascade. (docs: 18 index FK + index Post.)", pw="Không")
    A(F, "Index tìm kiếm tồn tại: Course_searchVector_idx, Post_searchVector_idx, User_searchVector_idx (GIN) và Course_title_trgm_idx, User_name_trgm_idx", "Hiệu năng", "Cao", BASE + " " + SQLH,
      ["SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname IN ('Course_searchVector_idx','Post_searchVector_idx','User_searchVector_idx','Course_title_trgm_idx','User_name_trgm_idx','Post_tagsnorm_gin_idx','Post_courseId_pinned_likesCount_createdAt_idx')"], "7 index",
      "Trả đủ 7 tên (3 GIN tsvector, 2 trigram, GIN thẻ sf_tagnorm, và index (courseId, pinned, likesCount, createdAt) cho sort=popular). Có thêm index (courseId, category, createdAt) cho lọc category.", pw="Không")
    A(F, "Cột searchVector là GENERATED STORED: đổi title tự cập nhật vector", "Chức năng", "Cao", BASE + " " + SQLH + " " + MUTATE,
      ["Tạo cộng đồng 'Đổi tên được' (POST /communities)", "SQL: UPDATE \"Course\" SET title='Tên khác hẳn' WHERE id='<id>'", "SELECT (\"searchVector\" @@ to_tsquery('simple','khac:*')) FROM \"Course\" WHERE id='<id>'", "SQL: thử UPDATE ... SET \"searchVector\"=NULL"], "generated column",
      "Truy vấn trả true (vector tự cập nhật, không code ứng dụng); cố ghi searchVector bị lỗi (cột sinh sẵn). Course.searchVector = title (trọng số A) + description (B); Post = content (A) + tags (B); User = họ tên.", pw="Không")
    A(F, "Extension pg_trgm có mặt; không cần unaccent (đã có sf_fold)", "Tích hợp", "Cao", BASE + " " + SQLH,
      ["SELECT extname, extnamespace::regnamespace FROM pg_extension WHERE extname IN ('pg_trgm','unaccent')", "SELECT sf_fold('Nhiếp Ảnh')"], "pg_trgm", "Có pg_trgm (schema public hoặc schema khác - code tra schema lúc chạy); không có unaccent; sf_fold dùng được (hàm SQL IMMUTABLE).", pw="Không")
    A(F, "Migration search_fulltext thất bại có chủ đích nếu KHÔNG cài được pg_trgm", "Tích hợp", "Trung bình", "DB trống mà user không có quyền tạo extension (mô phỏng: REVOKE hoặc dùng role không phải chủ DB trên PG<13).",
      ["npm run db:deploy"], "thiếu quyền", "Migration báo lỗi rõ ('permission denied to create extension pg_trgm') và dừng - không để schema nửa vời; chạy CREATE EXTENSION pg_trgm bằng quyền cao hơn rồi db:deploy lại thì xong (DEPLOY.md 1.3a).", pw="Không")
    A(F, "DEPLOY.md 1.3a nêu đúng rủi ro: ADD COLUMN GENERATED STORED viết lại 3 bảng (Course, Post, User)", "Giao diện", "Thấp", "Mở DEPLOY.md mục 1.3a và migration 20261005100000_search_fulltext.",
      ["Đối chiếu số bảng bị viết lại", "Đọc khuyến nghị chạy lúc ít người dùng nếu Post lớn"], "1.3a", "Khớp migration: 3 bảng; cảnh báo ACCESS EXCLUSIVE; cách A/B ở 1.3 để migration chạy trước khi nhận traffic (nếu không, tìm kiếm trả 500).", pw="Không")
    A(F, "prisma migrate dev sinh lệch 'ALTER COLUMN searchVector DROP DEFAULT': tài liệu yêu cầu xóa dòng đó", "Chức năng", "Thấp", "Đọc backend/docs/api/search.md mục 'Yêu cầu hạ tầng'.",
      ["Đọc ghi chú", "(Tùy chọn) chạy npx prisma migrate dev --create-only để thấy lệch và xóa dòng DROP DEFAULT"], "drift", "Ghi chú đúng: cột sinh sẵn không DROP DEFAULT được; dev phải xóa dòng khỏi migration được sinh, nếu không migrate lỗi.", pw="Không")
    A(F, "EXPLAIN: truy vấn tìm bài dùng GIN searchVector; lọc tag dùng Post_tagsnorm_gin_idx; sort=popular dùng index (courseId,pinned,likesCount,createdAt)", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Dữ liệu lớn (BIGPOST) để planner chọn index; SET enable_seqscan=off nếu bảng nhỏ.",
      ["EXPLAIN SELECT id FROM \"Post\" WHERE \"courseId\"='photo' AND \"searchVector\" @@ to_tsquery('simple','fillerabc:*')", "EXPLAIN SELECT id FROM \"Post\" WHERE sf_tagnorm(tags) @> ARRAY['alpha']", "EXPLAIN SELECT id FROM \"Post\" WHERE \"courseId\"='photo' ORDER BY pinned DESC, \"likesCount\" DESC, \"createdAt\" DESC LIMIT 20"], "planner",
      "Kế hoạch dùng Bitmap Index Scan trên Post_searchVector_idx; Post_tagsnorm_gin_idx; và Index Scan trên Post_courseId_pinned_likesCount_createdAt_idx (quét ngược). Không Seq Scan toàn bảng khi bật enable_seqscan=off.", pw="Không")

    # ============================================================ 8. KEYSET + PHÂN TRANG
    F = "Phân trang keyset: hội thoại, bảng tin, bình luận"
    CONV = BASE + " " + USER + " Người dùng me + 5 người khác; tạo 5 hội thoại bằng SQL/API (me gửi tin cho từng người cùng cộng đồng). " + SQLH
    A(F, "GET /conversations: 1 truy vấn; sắp theo lastMessageAt giảm dần; dữ liệu người kia/tin cuối/chưa đọc/chặn đủ", "Chức năng", "Cao", CONV,
      ["Tạo 5 hội thoại với thời gian lastMessageAt khác nhau (UPDATE \"Conversation\" SET \"lastMessageAt\" ...)", "GET /api/conversations", "Đối chiếu từng phần tử"], "5 hội thoại",
      "Danh sách theo mới hoạt động trước; meta={hasMore:false,nextCursor:null}; mỗi phần tử có đúng khóa [blockedByMe,id,lastMessage,lastMessageAt,other,unreadCount]; other.name='Thành viên đã xóa' nếu người kia xóa tài khoản; blockedByMe=true nếu me chặn.", pw="Có")
    A(F, "Hội thoại: tin cuối bị thu hồi -> lastMessage.deleted=true và không tính chưa đọc", "Chức năng", "Trung bình", CONV,
      ["Người kia gửi 2 tin rồi thu hồi tin cuối", "GET /api/conversations"], "thu hồi", "lastMessage.deleted=true (content 'Tin nhắn đã bị thu hồi'); unreadCount=1 (chỉ tin còn sống); hội thoại me đã đọc hết: unreadCount=0.", pw="Có")
    A(F, "Hội thoại: keyset ?limit=2&cursor= duyệt đủ 5 hội thoại, không trùng/sót", "Chức năng", "Cao", CONV,
      ["GET /api/conversations?limit=2", "GET /api/conversations?limit=2&cursor=<meta.nextCursor>", "Lặp tới khi nextCursor=null"], "limit=2", "3 trang (2,2,1); hasMore true,true,false; tập id = danh sách đầy đủ theo thứ tự; không trùng.", pw="Có")
    A(F, "Hội thoại: cursor rác -> 400; limit=0 hoặc >100 -> 400; mặc định limit 50", "Chức năng", "Trung bình", CONV,
      ["GET /api/conversations?cursor=garbage", "GET /api/conversations?limit=0", "GET /api/conversations?limit=101"], "tham số sai", "Cả ba 400; không có limit: tối đa 50 phần tử.", pw="Có")
    FEED = BASE + " " + USER + " U tham gia 'photo' (hoặc cộng đồng tự tạo) với 12 bài + 1 bài ghim. " + SQLH
    A(F, "Feed cursor: ghim lên đầu, rồi mới nhất; meta {total,hasMore,nextCursor}", "Chức năng", "Cao", FEED,
      ["GET /api/courses/<id>/posts?limit=5", "Đọc 5 bài đầu và meta"], "limit=5", "Bài ghim đứng đầu rồi 4 bài mới nhất; meta.total=13, hasMore=true, nextCursor có giá trị; cursor gắn với sort.", pw="Có")
    A(F, "Feed cursor: bài mới chen vào đầu giữa 2 lần tải KHÔNG gây trùng/sót (khác offset)", "Chức năng", "Cao", FEED,
      ["Trang 1 (limit=5) lấy nextCursor", "Đăng 1 bài MỚI", "Trang 2, 3 bằng cursor", "So sánh tập id với 13 bài ban đầu"], "bài chen vào", "Duyệt đủ 13 bài cũ đúng thứ tự (ghim rồi mới->cũ), không trùng, không sót, KHÔNG chứa bài mới chen; trang cuối hasMore=false,nextCursor=null.", pw="Có")
    A(F, "Feed: ?page=2 (offset cũ) vẫn dùng được; cursor sai -> 400; cursor của sort khác -> 400", "Chức năng", "Trung bình", FEED,
      ["GET ...posts?limit=5&page=2", "GET ...posts?cursor=bad", "GET ...posts?sort=popular&cursor=<cursor của sort latest>"], "tương thích", "page=2: 200 với meta.page=2 và 5 phần tử; cursor=bad: 400; cursor khác sort: 400.", pw="Có")
    A(F, "Feed sort=popular + category + tag cùng đường keyset; tag chuẩn hóa (bỏ #, trim, chữ thường)", "Chức năng", "Trung bình", FEED + " 9 bài với likesCount, category (Hỏi đáp/Thảo luận chung), tags ['#Alpha ','x'] hoặc ['beta'].",
      ["Duyệt ?sort=popular&limit=2 bằng cursor", "?tag=alpha", "?category=Hỏi đáp (URL-encode)"], "popular/tag/category", "popular: theo likesCount giảm dần, tie theo createdAt rồi id; tag=alpha khớp '#Alpha ' (chuẩn hóa) đúng các bài chẵn/lẻ tương ứng; category lọc đúng.", pw="Có")
    A(F, "Feed: ?page vượt 1000 -> 400 (không quét offset khổng lồ)", "Bảo mật", "Trung bình", FEED,
      ["GET ...posts?page=1000000", "GET ...posts?page=1000"], "page cap", "1000000: 400; 1000: 200.", pw="Có")
    CMT = BASE + " " + USER + " Bài P có 7 bình luận c0..c6 (c3, c5 bị ẩn; c3 của người khác O). Mod M, người xem O. " + SQLH
    A(F, "Bình luận: mặc định trả hết (<=100) kèm meta {limit:100,hasMore:false,nextCursor:null}, cũ -> mới", "Chức năng", "Cao", CMT,
      ["O GET /api/posts/<P>/comments", "M GET như trên"], "7 bình luận", "O thấy c0,c1,c2,c3(của chính mình),c4,c6 (không thấy c5 ẩn của người khác); M thấy cả 7; meta đúng; author.name đúng.", pw="Có")
    A(F, "Bình luận: ?limit=3&cursor= phân trang đủ 7; limit>200 hoặc cursor rác -> 400; tối đa 200", "Chức năng", "Trung bình", CMT,
      ["GET ...comments?limit=3 rồi theo nextCursor tới hết", "GET ...comments?limit=500", "GET ...comments?cursor=zzz", "GET ...comments?limit=200"], "limit/cursor", "3 trang (3,3,1) khớp thứ tự; limit=500: 400; cursor=zzz: 400; limit=200: 200.", pw="Có")
    A(F, "Bình luận: bài 5.000 bình luận không trả cả 5.000 (mặc định 100) và không N+1 tác giả", "Hiệu năng", "Trung bình", CMT + " Chèn 5.000 bình luận bằng SQL (generate_series).",
      ["GET /api/posts/<P>/comments (không limit)", "Đếm phần tử + đo thời gian", "Bật log SQL đếm truy vấn"], "5.000 bình luận", "Trả 100 phần tử + hasMore=true + nextCursor; số truy vấn không tăng theo số bình luận (không gọi userBriefView từng id).", pw="Không")
    A(F, "Bình chọn: kết quả gộp bằng GROUP BY (poll nhiều phiếu), số người bầu, lựa chọn của viewer, đổi phiếu", "Chức năng", "Cao", BASE + " " + USER + " 3 user V1,V2,V3 cùng cộng đồng.",
      ["V1 đăng bài poll {question:'Q?',options:['x','y','z'],multiple:true}", "V1 vote [x,y]; V2 vote [y]; V3 vote [z,y]", "Xem PostView.poll từ V3", "V2 đổi vote [x]; GET feed bằng V2"], "poll multiple",
      "Sau 3 vote: options.count = [1,3,1], totalVoters=3, viewerVotes(V3)=[y,z] theo thứ tự lựa chọn của poll. Sau V2 đổi: counts [2,2,1], viewerVotes(V2)=[x], totalVoters=3. API không bao giờ trả ai chọn gì.", pw="Có")
    A(F, "Poll 20.000 phiếu: feed không tải 20.000 dòng vào RAM", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Chèn 20.000 PollVote bằng SQL cho 1 bài poll.",
      ["GET /api/courses/<id>/posts (feed chứa poll)", "Bật log SQL: tìm truy vấn trên \"PollVote\""], "20.000 phiếu", "Một truy vấn GROUP BY trả vài dòng (không SELECT * toàn bộ phiếu); thời gian phản hồi không tăng theo số phiếu.", pw="Không")

    # ============================================================ 9. THÔNG BÁO THEO LÔ, LỚP HỌC, ENROLLMENTS
    F = "Thông báo theo lô, lớp học, /me/enrollments"
    A(F, "Sự kiện mới: MỌI thành viên (450) đều nhận event_created, trừ người tạo và người bị cấm (449)", "Chức năng", "Cao", BASE + " " + SQLH + " Cộng đồng C do Owner mới tạo; chèn 450 user + 450 Enrollment bằng SQL; ban 1 người; Owner là host. " + MUTATE,
      ["Owner POST /api/courses/<C>/events {title:'Họp lớn', startAt:<+1 ngày>}", "Đợi vài giây", "SQL: SELECT count(*) FROM \"Notification\" WHERE \"courseId\"='<C>' AND type='event_created'", "Đếm thông báo của host và của người bị cấm"], "450 thành viên",
      "count = 449 (450 - 1 người bị cấm; host không nhận); host 0; người bị cấm 0. Trước đây: cắt cứng 200 người, không log (cộng đồng 5.000 người thì 4.800 không biết). Lô đầu 500 xử lý trong request, các lô sau chạy nền.", pw="Không")
    A(F, "Sự kiện mới ở cộng đồng > 500 thành viên: các lô sau chạy nền và đủ số lượng", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Cộng đồng C với 1.200 thành viên (SQL).",
      ["Tạo sự kiện", "Đo thời gian phản hồi POST (phải nhanh)", "Đếm Notification sau 10-30 giây"], "1.200 thành viên", "POST trả 201 nhanh (không chờ cả 1.200); sau vài giây đủ ~1.199 thông báo; không tải toàn bộ thành viên vào RAM (duyệt theo lô trong SQL).", pw="Không")
    A(F, "Xin vào cộng đồng riêng tư: chỉ owner/admin THẬT được báo (lọc trong SQL; mod/thành viên/admin demo thì không)", "Chức năng", "Cao", BASE + " " + USER + " Cộng đồng private do Owner mới tạo; thêm admin thật, mod, 1 admin minh họa (isDemo) bằng SQL.",
      ["User xin vào: POST /api/courses/<id>/join-requests {message:'cho em vào'}", "Đợi flush; SQL: SELECT \"userId\" FROM \"Notification\" WHERE \"courseId\"='<id>'"], "private", "Chỉ owner và admin thật có thông báo (không mod, không demo). Không nạp toàn bộ thành viên (nhóm 50k thành viên không kéo 50k dòng).", pw="Một phần")
    A(F, "Lớp học: bài kế/trước, module khóa vẫn 403, tiến độ trả nextLesson, bài của cộng đồng khác 404", "Chức năng", "Cao", BASE + " " + USER + " Cộng đồng tự tạo có 2 module x 2 bài (tạo bằng API classroom); U là thành viên; ghi danh cả cộng đồng khác.",
      ["GET .../lessons/<L1.1> -> prev/next", "GET .../lessons/<L2.1> khi chưa xong module 1", "GET .../progress", "Hoàn thành L1.1 và L1.2; GET L2.1; GET lessons/<L1.1> qua cộng đồng khác"], "2 module", "L1.1: prevLessonId=null, nextLessonId=L1.2, moduleTitle='M1'; L2.1 lúc đầu 403 MODULE_LOCKED; progress.nextLesson={id:L1.1,title,moduleId}, totalLessons=4; sau xong module 1: L2.1 200 (prev=L1.2,next=L2.2), percent=50; bài thuộc cộng đồng khác 404.", pw="Một phần")
    A(F, "GET /me/enrollments gộp: progressPct đúng, bỏ cộng đồng đã xóa, role/enrolledAt giữ nguyên, đúng 4 khóa", "Chức năng", "Cao", BASE + " " + USER + " U tham gia 3 cộng đồng: A (role mod, 4 bài, xong 1, 1 bài dở), B (không có lớp học), C (đã xóa mềm). " + SQLH,
      ["GET /api/me/enrollments", "Đối chiếu từng phần tử"], "3 cộng đồng", "Chỉ A và B (C đã xóa bị bỏ); A: role 'mod', progressPct=25 (1/4 hoàn thành); B: progressPct=0; mỗi phần tử có đúng khóa [course, enrolledAt, progressPct, role].", pw="Có")
    A(F, "Hồ sơ công khai /users/:id và /me/points cũng gộp truy vấn (không N+1)", "Hiệu năng", "Thấp", BASE + " " + SQLH + " " + tok("member1@sofinhub.test"),
      ["Bật log SQL", "GET /api/users/<member1.id> và GET /api/me/points", "Đếm truy vấn"], "profile/points", "Số truy vấn cố định, không tăng theo số cộng đồng của người dùng (PLAN STEP 8).", pw="Không")
    A(F, "FE: trang /me/communities và Hồ sơ hiển thị tiến độ đúng sau tối ưu", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở /me/communities", "Mở hồ sơ /users/<member1.id>"], "tiến độ", "Danh sách cộng đồng với phần trăm tiến độ khớp API (photo xong module 1 = 50%; fin 100%); không đổi giao diện so với trước.", pw="Có")
    A(F, "Tải thành viên: join request/xóa/khóa cộng đồng không nạp toàn bộ danh sách thành viên (code review)", "Hiệu năng", "Thấp", "Đọc backend/docs/DATABASE.md đoạn 'Thay đổi khác cùng đợt'.",
      ["So sánh communities.service (join request, remove, lock) trước/sau"], "audit 6.4", "Lọc/duyệt theo lô trong SQL (owner/admin thật; thành viên theo lô 500); events.service không còn slice(0,200) sau khi tải hết.", pw="Không")

    # ============================================================ 10. HIỆU NĂNG TỔNG (NGƯỠNG ĐỀ XUẤT)
    F = "Hiệu năng tổng thể (ngưỡng đề xuất QA)"
    A(F, "Tìm kiếm với từ khóa phổ biến trả < 500 ms ở dữ liệu seed (cảm nhận người dùng)", "Hiệu năng", "Thấp", BASE + " Ngưỡng đề xuất QA, chưa có trong tài liệu.",
      ["Đăng nhập member1 trên FE, gõ từ khóa phổ biến vào /search", "DevTools Network: thời gian GET /api/search"], "seed", "Thời gian phản hồi < 500ms (cục bộ); không có spinner kéo dài.", pw="Có")
    A(F, "GET /conversations với 300 hội thoại < 500 ms và 1 truy vấn", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Ngưỡng đề xuất QA. Tạo 300 hội thoại bằng SQL cho 1 user.",
      ["curl -w %{time_total} GET /api/conversations?limit=100 (Bearer)", "Đếm truy vấn bằng log SQL"], "300 hội thoại", "< 500ms; số truy vấn nghiệp vụ = 1 (+2 auth); trước đây ≈ 1.200 truy vấn (audit).", pw="Không")
    A(F, "Mở một bài học khóa 400 bài x 50KB không nạp 20MB (kích thước phản hồi và bộ nhớ)", "Hiệu năng", "Trung bình", BASE + " " + SQLH + " Cộng đồng có 400 bài 50KB mỗi bài (SQL).",
      ["GET /api/courses/<id>/lessons/<lessonId>", "Đo kích thước phản hồi và bộ nhớ process"], "400 bài", "Phản hồi ≈ 50KB (chỉ bài đang mở); bộ nhớ không tăng ~20MB mỗi lần mở bài.", pw="Không")
    A(F, "Tải đồng thời 50 người dùng vào feed 1 cộng đồng: không lỗi 5xx, p95 < 1s (ngưỡng đề xuất)", "Hiệu năng", "Thấp", BASE + " Ngưỡng đề xuất QA; dùng k6/Artillery; tắt rate limit (RATE_LIMIT_DISABLED=1) để đo đúng DB.",
      ["50 VU, mỗi VU GET /api/courses/photo/posts?limit=20 trong 60 giây"], "50 VU", "0 lỗi 5xx; p95 < 1000ms; số kết nối DB không cạn pool.", pw="Không")

    # @@END@@
