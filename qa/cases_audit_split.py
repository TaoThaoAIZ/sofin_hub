# -*- coding: utf-8 -*-
"""Testcase module SPLIT (Tách Community / Khóa học - audit backend 2026-10-01, BƯỚC 6, 06/10/2026) + nhóm con GỠ DỮ LIỆU GIẢ (BƯỚC 4).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 2.1, 2.2, 8 (dữ liệu giả ở FE), 10 bước 4 và 6; backend/docs/api/communities-courses.md (hợp đồng cuối, mục 7 'Sai khác'),
backend/docs/api/{classroom,communities}.md, backend/docs/DATABASE.md, docs/features/community-course-split.md, docs/OPEN_DECISIONS.md (E1), PLAN.md (STEP 4, STEP 6),
backend/prisma/migrations/20261006100000_community_course_split, backend/prisma/seed/{classroom,courses}.ts (khóa học thêm + chứng nhận cố định),
backend/src/modules/{catalog,classroom,communities,admin}/*, backend/src/modules/meta/meta.routes.ts, backend/tests/{communities-courses,courses}.test.ts,
frontend/src/{pages,features/community,features/home,components/layout}/*.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-SPLIT-nnn không đổi).

TỪ VỰNG: Community (cộng đồng, id slug, vd 'photo'; Prisma Community, BẢNG DB vẫn tên "Course") - Course (khóa học, id UUID/chuỗi 'course-photo-editing'; Prisma Course, BẢNG DB "LearningCourse"). Cột cộng đồng của mọi bảng vẫn tên "courseId".
Route mới chuẩn: /api/communities/:id/*; route cũ /api/courses/:id/* giữ nguyên (alias, cùng handler). JSON cũ giữ `courseId` (= id cộng đồng) và thêm `communityId`; khóa học tham chiếu bằng `learningCourseId`.

DỮ LIỆU SEED (db:reset): photo = 2 khóa: 'Nhiếp ảnh cơ bản' (course-photo-main, mặc định, 2 module x 6 bài = 12) + 'Chỉnh sửa ảnh nâng cao' (course-photo-editing, 2 module x 4 bài = 8); yt = 'YouTube từ con số 0' (course-yt-main, 4 module x 5 + 1 x 4 = 24 bài, module 2 requiredLevel=2)
+ 'Tối ưu kênh & tăng trưởng' (course-yt-growth, 2 x 3 = 6 bài, certificatesEnabled=true GHI ĐÈ trong khi yt cấp cộng đồng không bật); fin = 'Tài chính cá nhân cơ bản' (course-fin-main, 5+5+6 = 16 bài) + 'Quản lý danh mục đầu tư' (course-fin-invest, 2 x 3 = 6)
+ 'Quản trị rủi ro (bản nháp)' (course-fin-risk, DRAFT, 1 module x 2 bài); mọi cộng đồng còn lại có 1 khóa course-<id>-main (tên = tên cộng đồng). Id module/bài: mod-<key>-<n>, les-<key>-<n>-<m> (key = photo, photo-editing, yt-growth, fin-invest, fin-risk).
Chứng nhận cố định của member1: FIN-DEMO-CERT-001 (khóa 'Tài chính cá nhân cơ bản') và PHOTO-DEMO-CERT-002 (khóa 'Chỉnh sửa ảnh nâng cao'). Tiến độ member1: photo-main xong module 1 (6/12 = 50%), photo-editing xong 8/8 (100%), yt-main xong module 1,
fin-main 100%, fin-invest 3/6 (50%). Cài đặt chứng nhận cộng đồng: photo = bật, fin = bật, yt = tắt.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset, gồm migration community_course_split); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 (npm run dev), frontend :5173; xem sheet 'Tài khoản & dữ liệu test' mục khóa học/chứng nhận.")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset; hoặc chỉ dùng cộng đồng/khóa học do chính case tạo ra."
SQLH = "SQL: docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub (bảng Prisma Community = \"Course\", Course = \"LearningCourse\"; ClassroomModule/ClassroomLesson/Certificate có cột \"learningCourseId\")."
ADMIN = "Token admin: POST /api/auth/login admin@sofinhub.test / Passw0rd!x (Platform Admin, cần PLATFORM_ADMIN_EMAILS=admin@sofinhub.test)."
MULTI = ("Cộng đồng thử đa khóa học: Owner mới POST /api/communities {\"title\":\"Học Nhiều Khóa\",\"description\":\"Cộng đồng thử nghiệm đa khóa học\",\"category\":\"tech\",\"priceUsd\":0,\"visibility\":\"public\",\"language\":\"vi\"} -> id (slug 'hoc-nhieu-khoa'), "
         "defaultCourseId = khóa A; thêm 4 user: admin (A), mod (M), member (U), người ngoài (O) - đặt vai trò bằng POST /communities/<id>/enroll rồi PATCH /communities/<id>/members/<uid>/role {role} bởi Owner; mod tạo khóa B bằng POST /communities/<id>/courses {title:'Khóa B'}.")


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}}."


def load(add):
    M, MN = "SPLIT", "Cộng đồng & Khóa học (audit bước 6 + 4)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. ĐỔI TÊN + KHÓA MẶC ĐỊNH + BACKFILL
    F = "Đổi tên Community/Course + khóa mặc định + backfill (audit 2.1)"
    A(F, "DB: Prisma Community nằm ở bảng \"Course\", khóa học mới ở bảng \"LearningCourse\" (tên bảng cũ không đổi)", "Tích hợp", "Cao", BASE + " " + SQLH,
      ["\\dt \"Course\" ; \\dt \"LearningCourse\"", "\\d \"LearningCourse\" (cột communityId? -> kiểm tên cột thực: \"courseId\")", "SELECT count(*) FROM \"Course\"; SELECT count(*) FROM \"LearningCourse\""], "bảng",
      "Cả hai bảng tồn tại; \"Course\" vẫn là cộng đồng (id slug 'photo'...), \"LearningCourse\" có FK cột \"courseId\" trỏ tới cộng đồng; ClassroomModule/Certificate có thêm cột \"learningCourseId\". Dữ liệu cũ không mất.", pw="Không")
    A(F, "Backfill: mọi cộng đồng có >= 1 khóa học (0 cộng đồng không có khóa)", "Chức năng", "Cao", BASE + " " + SQLH,
      ["SELECT c.id FROM \"Course\" c WHERE NOT EXISTS (SELECT 1 FROM \"LearningCourse\" l WHERE l.\"courseId\"=c.id)", "SELECT \"courseId\", count(*) FROM \"LearningCourse\" GROUP BY 1 ORDER BY 2 DESC"], "backfill",
      "Truy vấn đầu 0 dòng; photo=2, yt=2, fin=3, các cộng đồng còn lại =1. Mỗi khóa mặc định giữ toàn bộ module/bài cũ (id mod-<community>-<n>).", pw="Không")
    A(F, "Seed đa khóa học: photo 2, yt 2 (có override chứng nhận), fin 3 (có 1 bản nháp) với tiêu đề + số bài đúng", "Chức năng", "Cao", BASE + " " + SQLH,
      ["SELECT id,\"courseId\",title,\"publishStatus\",\"certificatesEnabled\",position FROM \"LearningCourse\" WHERE \"courseId\" IN ('photo','yt','fin') ORDER BY 2,position", "Đếm bài: SELECT m.\"learningCourseId\", count(l.id) FROM \"ClassroomModule\" m JOIN \"ClassroomLesson\" l ON l.\"moduleId\"=m.id GROUP BY 1"], "seed",
      "photo: course-photo-main 'Nhiếp ảnh cơ bản' (12 bài), course-photo-editing 'Chỉnh sửa ảnh nâng cao' (8). yt: 'YouTube từ con số 0' (24), 'Tối ưu kênh & tăng trưởng' (6, certificatesEnabled=true). fin: 'Tài chính cá nhân cơ bản' (16), 'Quản lý danh mục đầu tư' (6), 'Quản trị rủi ro (bản nháp)' (2, draft). Position liên tục 1..n.", pw="Không")
    A(F, "Khóa mặc định = khóa published có position nhỏ nhất; không có published thì khóa chưa gỡ đầu tiên", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/fin (detail) -> defaultCourseId, coursesCount", "GET /api/communities/fin/courses", "Đối chiếu"], "fin có 1 draft",
      "defaultCourseId = 'course-fin-main'; coursesCount = 2 (chỉ khóa PUBLISHED: main + invest; bản nháp không tính); danh sách thành viên thường không có 'Quản trị rủi ro (bản nháp)'.", pw="Có")
    A(F, "defaultCourseId/coursesCount trong GET /courses/:id cho photo/yt/fin và cộng đồng 1 khóa", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo, /yt, /fin, /ai"], "4 cộng đồng", "photo: defaultCourseId='course-photo-main', coursesCount=2; yt: 'course-yt-main', 2; fin: 'course-fin-main', 2; ai: 'course-ai-main', 1. Có thêm communityId = id.", pw="Có")
    A(F, "Số bài `lessons` được TÍNH từ lớp học thật (khóa published), không còn hằng số seed", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo -> lessons và facts[label='Bài học']", "GET /api/courses?limit=50 -> phần tử photo", "Đối chiếu với SQL đếm bài trong khóa published"], "photo/yt/fin",
      "photo: 20 (12 + 8, trước đây hằng số 12); yt: 30 (24 + 6); fin: 22 (16 + 6, KHÔNG tính 2 bài của khóa nháp); danh sách và detail khớp nhau; facts 'Bài học' = cùng số.", pw="Có")
    A(F, "Lưu trữ/ẩn một khóa làm `lessons` của cộng đồng giảm đúng số bài của khóa đó", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test") + " " + MUTATE,
      ["owner@ POST /api/communities/photo/courses/course-photo-editing/archive", "GET /api/courses/photo -> lessons", "PATCH .../course-photo-editing {publishStatus:'published'} rồi GET lại"], "archive photo-editing",
      "Sau lưu trữ: lessons = 12 (20 - 8); khóa trả 404 cho thành viên thường; sau khi xuất bản lại: 20.", pw="Một phần")
    A(F, "Cộng đồng người dùng tạo có lessons=0 cho đến khi soạn bài thật (không còn module giả)", "Chức năng", "Cao", BASE + " " + MULTI,
      ["Ngay sau POST /communities: GET /api/courses/<id> -> lessons", "Owner thêm 1 module + 2 bài vào khóa A", "GET lại"], "cộng đồng mới", "Trước: lessons=0 và không có module giả; sau khi thêm 2 bài: lessons=2.", pw="Một phần")
    A(F, "Cột DB Course.lessons còn tồn tại nhưng không được đọc", "Chức năng", "Thấp", BASE + " " + SQLH,
      ["SELECT id, lessons FROM \"Course\" WHERE id='photo'", "GET /api/courses/photo"], "cột lessons", "Cột còn giá trị cũ (12) trong DB nhưng API trả số tính từ lớp học (20): cột marketplace rating/instructorName/students... giữ nguyên.", pw="Không")
    A(F, "Alias tham số: courseId (cũ) và communityId (mới) đều được nhận ở query và body (cấp 1)", "Chức năng", "Trung bình", BASE + " " + tok("owner@sofinhub.test"),
      ["GET /api/search?q=anh&type=posts&courseId=photo", "GET /api/search?q=anh&type=posts&communityId=photo", "POST /api/reports {communityId:'photo',...} và {courseId:'photo',...} (hoặc route tương đương dùng body)"], "alias", "Hai cách cho kết quả/giá trị giống hệt; schema nội bộ dùng communityId (middleware community-alias).", pw="Có")
    A(F, "JSON additive: bài viết/sự kiện/thông báo/thanh toán... có CẢ communityId và courseId (alias deprecated)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/posts (phần tử)", "GET /api/courses/photo/events", "GET /api/notifications", "GET /api/me/payments", "GET /api/me/points (byCourse[])"], "các DTO", "Mỗi đối tượng có courseId và communityId cùng giá trị (= id cộng đồng); /me/points.byCourse[] có communityId; kết quả /search (member/post) có communityId.", pw="Có")
    A(F, "Chứng nhận cũ map vào khóa mặc định, mã/verify không đổi sau migration", "Tích hợp", "Cao", BASE + " " + SQLH,
      ["GET /api/certificates/FIN-DEMO-CERT-001 (không cần đăng nhập)", "SQL: SELECT code,\"learningCourseId\",\"courseTitle\" FROM \"Certificate\""], "FIN-DEMO-CERT-001", "200 {valid:true, holderName:'Minh Member1', courseTitle:'Tài chính cá nhân cơ bản', issuedAt}; Certificate.learningCourseId = 'course-fin-main'.", pw="Có")

    # ============================================================ 2. ROUTE MIRROR + ALIAS + REDIRECT FE
    F = "Route /communities/* mirror + /courses/* tương đương"
    A(F, "GET /communities ≡ GET /courses (cùng JSON); /communities/featured ≡ /courses/featured", "Chức năng", "Cao", BASE,
      ["GET /api/communities?limit=50&sort=newest và GET /api/courses?limit=50&sort=newest", "So sánh JSON", "GET /api/communities/featured và /api/courses/featured"], "danh sách", "Hai cặp response giống hệt nhau (status + body). Có đủ trường communityId/courseId.", pw="Có")
    A(F, "GET /communities/:id ≡ /courses/:id (detail); id lạ -> 404", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/photo và /api/courses/photo", "GET /api/communities/khong-co"], "photo", "Body giống hệt (defaultCourseId, coursesCount, communityId); id lạ 404 NOT_FOUND.", pw="Có")
    A(F, "POST /communities (tạo) KHÔNG bị viết lại sang /courses; không token 401", "Chức năng", "Trung bình", BASE,
      ["POST /api/communities không Authorization, body {}"], "401", "401 UNAUTHORIZED (không 404/201).", pw="Có")
    FAMS = ["", "/modules", "/progress", "/classroom-settings", "/posts", "/events", "/reviews", "/leaderboard", "/members", "/levels"]
    for sub in FAMS:
        label = sub or "(detail cộng đồng)"
        A(F, f"Mirror {label}: GET /api/courses/photo{sub} ≡ GET /api/communities/photo{sub}", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test") + " member1 là thành viên photo.",
          [f"GET /api/courses/photo{sub} bằng member1", f"GET /api/communities/photo{sub} bằng member1", "So sánh status và body"], f"photo{sub}",
          "Cùng mã trạng thái (< 500) và JSON giống hệt từng byte (cùng handler); lỗi cũng giống nhau cho người ngoài.", pw="Có")
    A(F, "Ghi qua /communities, đọc qua /courses (bài viết): cùng dữ liệu, có communityId + courseId", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/communities/photo/posts {content:'Xin chào đa khóa học'} -> 201", "GET /api/courses/photo/posts (bài vừa tạo có mặt)"], "post mirror", "201 với data.communityId='photo' và data.courseId='photo'; bài hiện ở GET /courses/photo/posts.", pw="Có")
    A(F, "Người ngoài: /communities/:id/modules và /courses/:id/modules cùng 403", "Bảo mật", "Trung bình", BASE + " Người ngoài = user mới đăng ký.",
      ["GET /api/communities/photo/modules", "GET /api/courses/photo/modules"], "outsider", "Cả hai cùng mã (403, chưa tham gia).", pw="Có")
    A(F, "Khóa học (entity mới) chỉ có ở /communities: GET /courses/<id>/courses -> 404", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/courses", "GET /api/communities/photo/courses"], "namespace", "/courses/photo/courses: 404; /communities/photo/courses: 200 danh sách khóa học.", pw="Có")
    A(F, "Route cũ không chỉ định khóa (modules/progress/certificate/POST modules/PUT order) = KHÓA MẶC ĐỊNH", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/modules và GET /api/communities/photo/courses/course-photo-main/modules", "GET /api/courses/photo/progress và .../courses/course-photo-main/progress"], "photo default",
      "Body modules giống hệt; progress giống ({data:{...learningCourseId:'course-photo-main'...}}): route cũ chỉ thấy 2 module của 'Nhiếp ảnh cơ bản' (không gộp 'Chỉnh sửa ảnh').", pw="Có")
    A(F, "POST /courses/:id/modules chỉ ghi vào khóa mặc định; body learningCourseId chọn khóa khác; id sai 404", "Chức năng", "Cao", BASE + " " + MULTI,
      ["Mod POST /api/courses/<id>/modules {title:'A3 (route cũ)',description:''} -> learningCourseId", "Mod POST /api/communities/<id>/modules {title:'B3',description:'',learningCourseId:'<khóa B>'}", "POST ... learningCourseId:'khong-co'"], "tạo module",
      "Route cũ: learningCourseId = khóa A (mặc định); với learningCourseId=B: module vào B (201); id lạ: 404.", pw="Một phần")
    A(F, "Route theo id bài học hoạt động trên bài của MỌI khóa trong cộng đồng (id duy nhất toàn cục)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo/lessons/les-photo-1-1 (khóa main)", "GET /api/communities/photo/lessons/les-photo-editing-1-1 (khóa editing)", "GET /api/courses/yt/lessons/les-photo-1-1 (khác cộng đồng)"], "lesson id", "Hai bài đầu 200 với learningCourseId tương ứng ('course-photo-main', 'course-photo-editing') + communityId='photo'; bài của cộng đồng khác 404.", pw="Có")
    A(F, "Không có route bài học theo khóa: /communities/:id/courses/:courseId/lessons/:lessonId -> 404 (đã biết)", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/photo/courses/course-photo-main/lessons/les-photo-1-1"], "route không có", "HIỆN TẠI: 404; dùng /communities/:id/lessons/:lessonId (communities-courses.md mục 7.10).", pw="Có", st=PLAN)

    F = "Chuyển hướng FE /courses/* -> /communities/*"
    for old, new in (("/courses/photo", "/communities/photo"), ("/courses/photo/community/lop-hoc?khoa=course-photo-editing#top", "/communities/photo/community/lop-hoc?khoa=course-photo-editing#top"),
                     ("/courses/photo/checkout", "/communities/photo/checkout"), ("/courses/photo/community/lop-hoc/les-photo-1-1", "/communities/photo/community/lop-hoc/les-photo-1-1"),
                     ("/courses/paid-demo/revenue-dashboard", "/communities/paid-demo/revenue-dashboard"), ("/courses/photo/community/cai-dat", "/communities/photo/community/cai-dat")):
        A(F, f"Mở {old} -> chuyển (replace) sang {new}, giữ query + hash", "Giao diện", "Cao", BASE + " Đăng nhập member1@ (owner@ cho trang doanh thu/cài đặt) trên FE.",
          [f"Gõ http://localhost:5173{old}", "Quan sát thanh địa chỉ và lịch sử (nút Back)"], old,
          f"URL đổi thành {new} (Navigate replace nên Back không quay lại URL cũ); trang hiển thị đúng; không 404, không nháy trang trắng.", pw="Có")
    A(F, "Liên kết trong thông báo/email cũ trỏ /courses/... vẫn mở được nhờ redirect", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@ trên FE; có thông báo seed với link /courses/...",
      ["Mở /notifications", "Bấm thông báo có link /courses/<id>/community..."], "link cũ", "Chuyển sang /communities/<id>/community...; không lỗi.", pw="Có")
    A(F, "Mọi liên kết nội bộ FE dùng đường dẫn chuẩn /communities/... (tìm kiếm, thanh toán, admin 'Mở cộng đồng', mời, hồ sơ)", "Giao diện", "Trung bình", BASE + " Đăng nhập admin@ để thử admin; member1@ cho phần còn lại.",
      ["Tìm kiếm: bấm 1 kết quả", "/billing: bấm tên cộng đồng", "Admin > Cộng đồng > 'Mở cộng đồng'", "/me/communities, hồ sơ người khác: bấm cộng đồng"], "link nội bộ", "Thanh địa chỉ hiện /communities/... ngay (không đi vòng qua /courses/...).", pw="Có")
    A(F, "Đường dẫn /communities/new không bị nuốt bởi /communities/:id", "Giao diện", "Trung bình", BASE + " Đăng nhập trên FE.",
      ["Mở http://localhost:5173/communities/new"], "route tĩnh", "Hiển thị form tạo cộng đồng (không phải trang chi tiết cộng đồng id='new').", pw="Có")

    # ============================================================ 3. CRUD KHÓA HỌC + QUYỀN (MA TRẬN)
    F = "CRUD khóa học + quyền (ma trận vai trò)"
    ROLES = "Anonymous | Người ngoài (chưa tham gia) | Member | Mod | Admin | Owner | Platform Admin"
    MATRIX = [
        ("Liệt kê khóa học GET /communities/<id>/courses", ["Anonymous 401", "Người ngoài 403", "Member 200 (chỉ published)", "Mod 200 (cả draft/archived)", "Admin 200", "Owner 200"]),
        ("Xem 1 khóa published GET .../courses/<courseId>", ["Anonymous 401", "Người ngoài 403", "Member 200", "Mod 200", "Admin 200", "Owner 200"]),
        ("Xem khóa NHÁP/LƯU TRỮ GET .../courses/<draftId> và .../modules", ["Member 404", "Mod 200", "Admin 200", "Owner 200"]),
        ("Tạo khóa POST .../courses {title}", ["Member 403", "Mod 201", "Admin 201", "Owner 201", "Người ngoài 403", "Anonymous 401"]),
        ("Sửa tên/mô tả/ảnh PATCH .../courses/<id>", ["Member 403", "Mod 200", "Admin 200", "Owner 200"]),
        ("Đổi certificatesEnabled PATCH .../courses/<id> {certificatesEnabled}", ["Member 403", "Mod 403", "Admin 200", "Owner 200"]),
        ("Sắp xếp PUT .../courses/order {ids}", ["Member 403", "Mod 200", "Admin 200", "Owner 200"]),
        ("Lưu trữ POST .../courses/<id>/archive", ["Member 403", "Mod 200", "Admin 200", "Owner 200"]),
        ("Xóa DELETE .../courses/<id>", ["Member 403", "Mod 403", "Admin 200", "Owner 200"]),
    ]
    for action, outcomes in MATRIX:
        A(F, f"Quyền: {action}", "Bảo mật", "Cao", BASE + " " + MULTI,
          [f"Thực hiện '{action}' lần lượt bằng: {ROLES}", "Ghi mã trạng thái từng vai trò", "Kiểm tra dữ liệu không đổi với các lần bị từ chối"], action,
          "Kết quả theo vai trò: " + "; ".join(outcomes) + ". (Cộng đồng bị khóa -> 403 COMMUNITY_LOCKED cho Owner/Admin/Mod/Member; Platform Admin ghi đè ở route ghi.)", pw="Một phần")
    A(F, "Tạo khóa: mặc định published, position = cuối, certificatesEnabled=null, certificatesEffective theo cộng đồng", "Chức năng", "Cao", BASE + " " + MULTI,
      ["Mod POST /api/communities/<id>/courses {title:'Khóa B',description:'Mô tả B'}", "Đọc response"], "khóa B",
      "201 {data:{communityId, position:2, publishStatus:'published', isDefault:false, modulesCount:0, certificatesEnabled:null, certificatesEffective:false (kế thừa cộng đồng mặc định tắt), progress, createdAt, updatedAt}}.", pw="Có")
    A(F, "Validate tạo/sửa khóa: title rỗng/>200, thumbnailUrl không http(s) (javascript:), mô tả >1000, PATCH body rỗng -> 400", "Bảo mật", "Cao", BASE + " " + MULTI,
      ["POST courses {title:''}", "POST {title:'x',thumbnailUrl:'javascript:alert(1)'}", "POST {title:'x',description:'<1001 ký tự>'}", "PATCH .../courses/<A> {}"], "validate", "Cả 4: 400 VALIDATION_ERROR.", pw="Có")
    A(F, "Khóa nháp: thành viên không thấy trong danh sách, 404 khi gọi trực tiếp; mod+ thấy; lọc ?status= chỉ mod+", "Chức năng", "Cao", BASE + " " + MULTI,
      ["Mod tạo khóa D {title:'Khóa nháp',publishStatus:'draft'}", "Member GET .../courses (danh sách), GET .../courses/<D>, GET .../courses/<D>/modules", "Mod GET .../courses, ?status=draft, ?status=bogus"], "draft",
      "Member: danh sách [A,B], D -> 404 (cả modules); Mod: danh sách [A,B,D]; ?status=draft = [D]; ?status=bogus -> 400.", pw="Một phần")
    A(F, "Khóa của cộng đồng khác hoặc id không tồn tại -> 404", "Bảo mật", "Trung bình", BASE + " " + MULTI,
      ["Mod GET /api/communities/<id>/courses/khong-co", "Mod GET /api/communities/photo/courses/<khóa A> (mod không thuộc photo)"], "khóa lạ", "404 cho id lạ; 403 cho cộng đồng mà mod chưa tham gia.", pw="Có")
    A(F, "PATCH: đổi tên/mô tả/ảnh bìa (thumbnailUrl null để xóa); publishStatus draft <-> published", "Chức năng", "Trung bình", BASE + " " + MULTI,
      ["Mod PATCH khóa B {title:'Khóa B (đổi)',thumbnailUrl:'https://example.com/b.png'}", "PATCH {thumbnailUrl:null}", "PATCH {publishStatus:'draft'} rồi {publishStatus:'published'}"], "PATCH", "200 với giá trị mới; thumbnailUrl=null sau khi xóa; chuyển draft thì thành viên không thấy, published lại thấy.", pw="Có")
    A(F, "Sắp xếp khóa phải là hoán vị đủ các khóa chưa gỡ (thiếu/trùng/lạ -> 400); position đánh lại; khóa mặc định đổi theo thứ tự", "Chức năng", "Cao", BASE + " " + MULTI + " Có thêm khóa nháp D.",
      ["PUT .../courses/order {ids:[A]} (thiếu)", "{ids:[A,A,B]} (trùng)", "{ids:[D,B,A]}", "GET /api/courses/<id> -> defaultCourseId", "Khôi phục {ids:[A,B,D]}"], "reorder",
      "Hai lần đầu 400; lần 3: 200 position D=1,B=2,A=3 và khóa B thành isDefault (published đầu tiên theo vị trí; D là nháp nên bỏ qua); khôi phục lại A mặc định.", pw="Một phần")
    A(F, "Lưu trữ khóa: thành viên không còn thấy, mod+ vẫn thấy với nhãn 'Đã lưu trữ'", "Chức năng", "Trung bình", BASE + " " + MULTI,
      ["Mod POST .../courses/<D>/archive", "Member GET danh sách; Mod GET ?status=archived"], "archive", "publishStatus='archived'; Member không thấy; Mod thấy trong ?status=archived.", pw="Có")
    A(F, "Xóa khóa: mod 403, admin 200; xóa lần 2 -> 404; position đánh lại liên tục", "Chức năng", "Cao", BASE + " " + MULTI + " " + SQLH,
      ["Mod DELETE .../courses/<D>", "Admin DELETE .../courses/<D>", "Admin DELETE lần 2", "SQL: SELECT position FROM \"LearningCourse\" WHERE \"courseId\"='<id>' ORDER BY position"], "xóa D", "Mod 403; Admin 200 {deleted:true}; lần 2 404; positions = [1,2].", pw="Một phần")
    A(F, "Không xóa được khóa học CUỐI CÙNG của cộng đồng (400)", "Chức năng", "Cao", BASE + " Owner mới tạo cộng đồng (1 khóa mặc định).",
      ["Owner DELETE /api/communities/<id>/courses/<defaultCourseId>"], "khóa cuối", "400 (còn đúng 1 khóa); SQL đếm LearningCourse của cộng đồng vẫn 1.", pw="Có")
    A(F, "Xóa khóa: cascade module/bài/tiến độ/chứng nhận của khóa đó; khóa còn lại và dữ liệu cộng đồng giữ nguyên", "Chức năng", "Cao", BASE + " " + MULTI + " " + SQLH + " Khóa B có module, bài, tiến độ của member và 1 chứng nhận.",
      ["SQL đếm module/bài/Certificate của B và của A", "Admin DELETE khóa B", "Đếm lại; GET /api/certificates/<mã chứng nhận của B>"], "xóa B",
      "Module/bài/LessonProgress/Certificate của B = 0; của A giữ nguyên; Enrollment cộng đồng không đổi; mã chứng nhận của B giờ 404 khi xác minh (chứng nhận bị cascade - lưu ý rủi ro).", pw="Không")
    A(F, "Khóa bị Platform Admin gỡ (admin console 'remove') biến mất với MỌI người dùng kể cả mod", "Chức năng", "Cao", BASE + " " + MULTI + " " + ADMIN,
      ["Admin POST /api/admin/content/courses/<B>/remove {reason:'Vi phạm'}", "Mod GET .../courses và .../courses/<B>/modules", "Admin POST .../restore {}"], "remove/restore", "Sau gỡ: mod cũng không thấy B (danh sách [A], modules 404); restore -> published và hiện lại.", pw="Một phần")
    A(F, "Cộng đồng bị khóa: mọi thao tác khóa học 403 COMMUNITY_LOCKED (Platform Admin vẫn được)", "Bảo mật", "Trung bình", BASE + " " + MULTI + " " + ADMIN,
      ["Admin lock cộng đồng", "Mod/Admin/Owner tạo/sửa/xóa khóa", "Admin (platform) tạo/sửa khóa"], "locked", "Owner/Admin/Mod: 403 COMMUNITY_LOCKED; Platform Admin (admin@): các route ghi dùng requireRole nên được ghi đè và thực hiện được (ghi lại kết quả thực tế; route ĐỌC dùng requireMembership nên có thể vẫn 403 nếu admin@ chưa là thành viên).", pw="Một phần")

    # ============================================================ 4. MODULE / KHÓA TUẦN TỰ / TIẾN ĐỘ THEO KHÓA
    F = "Module, khóa tuần tự, tiến độ cô lập theo khóa"
    TWO = (MULTI + " Owner/mod tạo: khóa A có module A1, A2 (mỗi module 1 bài), khóa B có module B1, B2 (mỗi module 1 bài) bằng POST /communities/<id>/courses/<khóa>/modules và .../modules/<mid>/lessons {title,type:'text',durationMin:1,body:'nội dung'}.")
    A(F, "Chỉ số module (index) độc lập theo từng khóa kể cả khi tạo song song", "Chức năng", "Trung bình", BASE + " " + MULTI + " " + SQLH,
      ["Tạo song song 2 module vào A và 2 module vào B (4 request cùng lúc)", "SQL: SELECT \"learningCourseId\", index FROM \"ClassroomModule\" WHERE \"courseId\"='<id>' ORDER BY 1,2"], "tạo song song", "Mỗi khóa có index [1,2] riêng (không 1..4 chung, không trùng).", pw="Không")
    A(F, "DTO module: courseId (cũ = cộng đồng) giữ, thêm communityId và learningCourseId", "Chức năng", "Trung bình", TWO,
      ["GET /api/communities/<id>/courses/<A>/modules", "Đọc module đầu"], "DTO", "Mỗi module có courseId = id cộng đồng, communityId = id cộng đồng, learningCourseId = khóa A; lessonsCount/completedCount/pct/locked/lockReason như cũ.", pw="Có")
    A(F, "Khóa tuần tự chỉ trong phạm vi MỘT khóa: hoàn thành A1 mở A2, KHÔNG ảnh hưởng B", "Chức năng", "Cao", TWO,
      ["Member GET modules của A và B (A2, B2 locked='previous_module')", "Member POST /communities/<id>/lessons/<A1.lesson>/complete", "GET modules A và B lại"], "A1 xong", "Trước: A=[mở,khóa], B=[mở,khóa]. Sau: A=[mở,mở]; B vẫn [mở,khóa] (hoàn thành khóa A không mở khóa khóa B).", pw="Một phần")
    A(F, "Bài của module khóa trong khóa B: complete -> 403, GET lessons module -> 403 MODULE_LOCKED", "Bảo mật", "Cao", TWO,
      ["Member POST .../lessons/<B2.lesson>/complete", "GET .../courses/<B>/modules/<B2>/lessons"], "B2 khóa", "Cả hai 403 (MODULE_LOCKED); không ghi tiến độ.", pw="Có")
    A(F, "Module của khóa này không truy cập được qua :courseId của khóa kia (404)", "Bảo mật", "Cao", TWO,
      ["GET .../courses/<A>/modules/<B1>/lessons", "POST .../courses/<A>/modules/<B1>/lessons {lesson}", "PATCH .../courses/<A>/modules/<B1> {title:'x'}"], "chéo khóa", "Cả 3: 404.", pw="Có")
    A(F, "Tiến độ theo khóa: A {percent:50, completedLessons:1, totalLessons:2, completedModules:1}, B {0,0,2}", "Chức năng", "Cao", TWO,
      ["Sau khi xong A1: GET .../courses/<A>/progress và .../courses/<B>/progress", "GET .../courses (danh sách khóa với progress của người xem)"], "A1 xong", "A: percent=50, completedLessons=1, totalLessons=2, completedModules=1, learningCourseId=A; B: percent=0, totalLessons=2; danh sách khóa mang modulesCount/lessonsCount/progress.percent: [A:2,2,50],[B:2,2,0].", pw="Có")
    A(F, "Tiến độ seed của member1 theo từng khóa: photo-main 50%, photo-editing 100%, fin-invest 50%", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/photo/courses (progress)", "GET /api/communities/fin/courses"], "seed member1", "photo: 'Nhiếp ảnh cơ bản' 50% (6/12), 'Chỉnh sửa ảnh nâng cao' 100% (8/8); fin: 'Tài chính cá nhân cơ bản' 100% (16/16), 'Quản lý danh mục đầu tư' 50% (3/6); yt-main có module 1 xong, yt-growth 0%.", pw="Có")
    A(F, "GET /me/enrollments: progressPct cộng dồn các khóa published (photo của member1 = (6+8)/20 = 70%)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/me/enrollments", "Tìm phần tử course.id='photo' và 'fin'"], "seed member1", "photo.progressPct = 70 (14/20 bài hoàn thành trên các khóa published); fin: (16+3)/22 = 86 (làm tròn) - khóa nháp không tính. (Tính theo tổng bài các khóa published.)", pw="Có")
    A(F, "requiredLevel chỉ áp trong khóa chứa module; điểm/level vẫn tính theo cộng đồng", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/yt/courses/course-yt-main/modules (module 2 requiredLevel=2)", "GET /api/communities/yt/courses/course-yt-growth/modules", "GET /api/me/points (điểm yt)"], "yt", "Module 2 của khóa main khóa theo cấp độ khi điểm yt < 20; khóa growth không có requiredLevel; điểm yt dùng chung cho cả hai khóa.", pw="Có")
    A(F, "Sắp xếp module theo khóa: hoán vị phải đủ module CỦA KHÓA ĐÓ (module khóa khác -> 400)", "Chức năng", "Trung bình", TWO,
      ["PUT .../courses/<A>/modules/order {ids:[B1,B2]}", "PUT .../courses/<A>/modules/order {ids:[A2,A1]}"], "reorder module", "Lần 1: 400; lần 2: 200 và index đánh lại [A2:1, A1:2].", pw="Có")
    A(F, "Xóa module khóa A không ảnh hưởng tiến độ/khóa tuần tự của khóa B", "Chức năng", "Trung bình", TWO,
      ["Mod DELETE /api/communities/<id>/courses/<A>/modules/<A2>", "GET modules/progress của A và B"], "xóa A2", "A còn 1 module; tiến độ A tính lại; B không đổi.", pw="Một phần")
    A(F, "Chi tiết bài học có learningCourseId + communityId; prev/next theo thứ tự toàn khóa (có thể sang module khác)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/photo/lessons/les-photo-1-6", "GET /api/communities/photo/lessons/les-photo-editing-1-4"], "biên module", "les-photo-1-6: nextLessonId = les-photo-2-1 (sang module 2 của CÙNG khóa main), learningCourseId='course-photo-main'; les-photo-editing-1-4: next = bài đầu module 2 của editing.", pw="Có")
    A(F, "Cộng đồng chưa có khóa nào (dữ liệu cũ): đọc modules/progress rỗng/0; POST modules tự tạo khóa mặc định", "Chức năng", "Trung bình", BASE + " " + SQLH + " " + MUTATE,
      ["SQL tạo cộng đồng thiếu khóa: INSERT INTO \"Course\" (id,title,description,category,thumbnail,\"instructorName\",\"instructorRole\",\"ownerId\",\"updatedAt\") VALUES ('legacy-no-course','Legacy','x','tech','x','GV','M','<ownerId>',now()) + INSERT Enrollment owner", "Owner GET /api/courses/legacy-no-course/modules", "Owner POST /api/courses/legacy-no-course/modules {title:'M',description:''}", "SQL đếm LearningCourse"], "legacy-no-course",
      "GET modules = [] (không 500), progress.learningCourseId=null; POST modules 201 và tự tạo 1 khóa mặc định (tên = tên cộng đồng) - module có learningCourseId của khóa đó.", pw="Không")

    # ============================================================ 5. CHỨNG NHẬN THEO KHÓA
    F = "Chứng nhận theo khóa học"
    A(F, "Chứng nhận 1 / (user, khóa): hai khóa -> hai chứng nhận mã KHÁC; courseTitle = tên khóa", "Chức năng", "Cao", TWO + " Member xong 100% cả hai khóa (theo thứ tự mở khóa); Admin bật override B=true và cộng đồng=true.",
      ["Member GET .../courses/<A>/certificate", "Member GET .../courses/<B>/certificate", "Gọi lại mỗi cái lần 2"], "2 khóa", "Hai mã khác nhau; courseTitle lần lượt là tên khóa A, 'Khóa B (đổi)'; gọi lại trả cùng mã (cấp 1 lần); Certificate = 2 dòng cho (member, cộng đồng).", pw="Một phần")
    A(F, "Cấp khi certificatesEffective=true và 100% bài: mặc định cộng đồng tắt -> cả hai 403", "Chức năng", "Cao", TWO + " Member xong 100% cả hai khóa; cài đặt chứng nhận cộng đồng tắt (mặc định).",
      ["GET .../courses/<A>/certificate và .../courses/<B>/certificate", "GET /api/courses/<id>/certificate (route cũ)"], "cộng đồng tắt", "Cả ba 403 ('chưa bật chứng nhận'); route cũ = khóa mặc định A.", pw="Một phần")
    A(F, "Override theo khóa: B=true (Admin) -> chỉ B cấp được dù cộng đồng tắt", "Chức năng", "Cao", TWO + " Member xong 100% cả hai khóa.",
      ["Admin PATCH .../courses/<B> {certificatesEnabled:true}", "Member GET certificate A và B"], "override B", "A: 403; B: 200 {code, holderName, courseTitle, completedAt, issuedAt, learningCourseId:B, communityId}; B.certificatesEffective=true.", pw="Một phần")
    A(F, "Bật mặc định cộng đồng (PATCH classroom-settings admin) -> khóa kế thừa A cũng cấp được", "Chức năng", "Trung bình", TWO + " B đã override true.",
      ["Mod PATCH /api/courses/<id>/classroom-settings {certificatesEnabled:true} -> 403", "Admin PATCH cùng body -> 200", "Member GET certificate A"], "cộng đồng bật", "Mod 403 (cần admin); Admin 200; A cấp được; route cũ /courses/<id>/certificate trả đúng mã chứng nhận của khóa mặc định A.", pw="Một phần")
    A(F, "Override false thắng cài đặt cộng đồng true; certificatesEffective cập nhật; mã đã cấp vẫn xác minh được", "Chức năng", "Cao", TWO + " Cộng đồng bật; B đã có chứng nhận; 1 member khác (racer) xong 100% B nhưng chưa nhận.",
      ["Admin PATCH .../courses/<B> {certificatesEnabled:false}", "Danh sách khóa -> B.certificatesEffective", "Racer GET certificate B", "GET /api/certificates/<mã đã cấp của B>"], "override false", "B.certificatesEffective=false; racer 403; mã đã cấp vẫn 200 {valid:true,...}. Đặt lại null -> kế thừa cộng đồng.", pw="Một phần")
    A(F, "Cấp đồng thời: 5 request cùng lúc cho 1 (user, khóa) -> 1 chứng nhận duy nhất cùng mã", "Chức năng", "Cao", TWO + " Racer xong 100% B, B bật.",
      ["Bắn 5 GET .../courses/<B>/certificate cùng lúc bằng racer", "SQL: SELECT count(*) FROM \"Certificate\" WHERE \"userId\"='<racer>' AND \"learningCourseId\"='<B>'"], "5 request song song", "Cả 5 trả 200 cùng một code; đếm Certificate = 1 (unique userId+learningCourseId).", pw="Không")
    A(F, "Xác minh công khai GET /certificates/:code không đổi: chỉ {valid, holderName, courseTitle, issuedAt}", "Bảo mật", "Cao", BASE,
      ["GET /api/certificates/PHOTO-DEMO-CERT-002 (không đăng nhập)", "GET /api/certificates/FIN-DEMO-CERT-001", "GET /api/certificates/KHONG-CO"], "mã seed",
      "PHOTO-DEMO-CERT-002: {valid:true, holderName:'Minh Member1', courseTitle:'Chỉnh sửa ảnh nâng cao', issuedAt}; FIN-DEMO-CERT-001: courseTitle 'Tài chính cá nhân cơ bản'; không có userId/email/learningCourseId; mã lạ 404.", pw="Có")
    A(F, "member1 có 2 chứng nhận ở 2 khóa của photo/fin; khóa yt-growth override true nhưng chưa đủ 100% -> 403", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/communities/photo/courses/course-photo-editing/certificate", "GET /api/communities/photo/courses/course-photo-main/certificate", "GET /api/communities/yt/courses/course-yt-growth/certificate"], "seed", "photo-editing: 200 mã PHOTO-DEMO-CERT-002; photo-main: 403 (mới 50%); yt-growth: 403 ('cần hoàn thành 100%', dù override bật).", pw="Có")
    A(F, "Thành viên khác hoàn thành yt-growth (6 bài) cấp được chứng nhận dù cộng đồng yt không bật (override true)", "Chức năng", "Trung bình", BASE + " " + MUTATE + " User mới tham gia yt (có phí $12: dùng owner@/admin@ cấp quyền hoặc checkout+confirm).",
      ["User hoàn thành 6 bài của course-yt-growth", "GET /api/communities/yt/courses/course-yt-growth/certificate", "GET .../course-yt-main/certificate"], "override yt-growth", "yt-growth: 200 chứng nhận; yt-main: 403 (cộng đồng yt không bật).", pw="Không")
    A(F, "Thêm bài mới sau khi đã cấp chứng nhận: tiến độ < 100% nên GET certificate 403 nhưng mã cũ vẫn hợp lệ (chưa quyết)", "Chức năng", "Thấp", BASE + " " + MUTATE,
      ["Member có chứng nhận khóa X", "Mod thêm 1 bài vào X", "Member GET certificate X; GET /certificates/<mã>"], "bài mới sau cấp", "HIỆN TẠI: GET certificate 403 cho tới khi học xong; xác minh mã cũ vẫn 200. Chưa chốt có thu hồi hay giữ (classroom.md 'Chưa làm', docs/OPEN_DECISIONS mục khác).", pw="Một phần", st=PLAN)
    A(F, "HIỆN TẠI: chưa có GET /me/certificates (liệt kê chứng nhận của tôi qua nhiều khóa)", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/me/certificates"], "gap", "HIỆN TẠI: 404 (chưa làm). member1 phải gọi từng khóa. Kế hoạch (communities-courses.md 7.10).", pw="Có", st=PLAN)
    A(F, "Thông báo khi được cấp chứng nhận (type system) và dữ liệu lưu để vẫn xác minh nếu nội dung đổi", "Chức năng", "Thấp", TWO + " Member xong 100% khóa B và B bật chứng nhận.",
      ["GET .../courses/<B>/certificate lần đầu", "GET /api/notifications của member", "Đổi tên khóa B rồi GET /certificates/<mã>"], "cấp lần đầu", "Có thông báo 'system' khi cấp; courseTitle trên chứng nhận giữ tên LÚC CẤP (không đổi theo tên mới).", pw="Một phần")

    # ============================================================ 6. TẠO CỘNG ĐỒNG TRANSACTIONAL
    F = "Tạo cộng đồng: transaction + khóa mặc định + slug race"
    A(F, "POST /communities tạo cộng đồng + owner Enrollment + khóa mặc định published + cài đặt trong 1 transaction", "Chức năng", "Cao", BASE + " Người dùng mới (Owner). " + SQLH,
      ["POST /api/communities {title:'Học Nhiều Khóa',description:'Cộng đồng thử nghiệm đa khóa học',category:'tech',priceUsd:0,visibility:'public',language:'vi'}", "GET /api/courses/hoc-nhieu-khoa và /api/communities/hoc-nhieu-khoa", "SQL: Enrollment role 'owner', LearningCourse, ClassroomSettings của cộng đồng"], "tạo cộng đồng",
      "201 data.id='hoc-nhieu-khoa' (slug bỏ dấu), communityId=id, lessons=0, defaultCourseId = id khóa mặc định; SQL: 1 Enrollment role 'owner', 1 LearningCourse (title='Học Nhiều Khóa', publishStatus 'published'), 1 ClassroomSettings; detail coursesCount=1; route cũ và mới trả giống hệt.", pw="Có")
    A(F, "Tạo song song 2 cộng đồng cùng tên: không 500, slug khác nhau (-2, -3...)", "Chức năng", "Cao", BASE + " Người dùng mới.",
      ["Bắn 2 POST /api/communities cùng body {title:'Trùng Tên',...} cùng lúc", "So sánh id"], "slug race", "Cả hai 201; id khác nhau (vd 'trung-ten' và 'trung-ten-2'); không lỗi unique/500.", pw="Không")
    A(F, "Tạo cộng đồng lỗi giữa chừng -> rollback, không để cộng đồng mồ côi không owner (code review/unit)", "Chức năng", "Cao", "Đọc backend/src/modules/communities/communities.service.ts create() và test communities-courses.",
      ["Xác nhận create dùng 1 transaction cho community + enrollment owner + course + settings", "(Tùy chọn) ép lỗi ở bước grant"], "audit 6.1", "Mọi bước trong 1 transaction; lỗi ở bước sau làm rollback toàn bộ (không còn trạng thái 'có cộng đồng mà không ai là owner').", pw="Không")
    A(F, "Validate tạo cộng đồng: thiếu/sai trường -> 400; priceUsd < 0; visibility lạ", "Chức năng", "Trung bình", BASE,
      ["POST /api/communities {} ", "{...,priceUsd:-1}", "{...,visibility:'x'}"], "validate", "400 VALIDATION_ERROR; không tạo bản ghi.", pw="Có")
    A(F, "Cộng đồng mới có phí: priceUsd lưu đúng, người mua 'priceCents' đúng, owner vào doanh thu", "Chức năng", "Trung bình", BASE + " Owner mới.",
      ["POST /communities {priceUsd:10,...}", "GET /api/courses/<id> -> priceUsd, facts 'Chi phí tham gia'"], "$10", "priceUsd=10; facts 'Chi phí tham gia' = '$10/tháng'; checkout tạo amountCents=1000 (xem MONEY).", pw="Có")
    A(F, "Người tạo cộng đồng thấy ngay nút/tab quản trị và khóa mặc định trong Lớp học", "Giao diện", "Cao", BASE + " Đăng nhập user mới trên FE.",
      ["Tạo cộng đồng ở /communities/new", "Vào /communities/<id>/community/lop-hoc"], "owner mới", "Có hiển thị khóa mặc định (module 0, bài 0, 'Lớp học chưa có nội dung.'); nút 'Chỉnh sửa lớp học' có; tab Cài đặt 'Khóa học' hiện danh sách 1 khóa.", pw="Có")

    # ============================================================ 7. ADMIN CONSOLE: NỘI DUNG > KHÓA HỌC
    F = "Admin console: Nội dung > Khóa học trên entity Course"
    A(F, "Danh sách khóa học admin là entity Course (có cột Module), lọc communityId, sắp xếp oldest/newest/lessons/students", "Chức năng", "Cao", BASE + " " + ADMIN,
      ["GET /api/admin/content/courses?communityId=photo&sort=oldest", "GET /api/admin/content/courses?courseId=photo (legacy = id cộng đồng)", "?sort=lessons"], "photo",
      "photo trả 2 khóa [course-photo-main, course-photo-editing] theo cũ->mới; legacy courseId cho cùng tập; mỗi phần tử {id,title,thumbnail,community,creator,students,lessons,modules,completionPct,reports:0,status,...}; sort=lessons sắp theo SỐ MODULE của khóa (giới hạn đã biết), AdminCourse.lessons vẫn là số bài thật.", pw="Có")
    A(F, "Chi tiết khóa học admin: moduleList (id,title,lessons) và lessonList; /content/lessons lọc learningCourseId", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["GET /api/admin/content/courses/course-photo-editing", "GET /api/admin/content/lessons?learningCourseId=course-photo-editing"], "photo-editing", "moduleList có 2 module; lessonList có 8 bài; /content/lessons meta.total=8.", pw="Có")
    A(F, "Admin unpublish khóa mặc định -> thành viên thấy khóa kế làm mặc định; unpublish lần 2 -> 409; restore/publish trả lại", "Chức năng", "Cao", BASE + " " + MULTI + " " + ADMIN,
      ["Admin POST /api/admin/content/courses/<A>/unpublish {reason:'Kiểm duyệt'} -> status 'draft'", "Member GET .../courses và GET /courses/<id> (defaultCourseId) và /courses/<id>/modules", "unpublish lần 2", "Admin POST .../<A>/publish {}"], "unpublish A",
      "A -> 'draft'; Member: danh sách [B], defaultCourseId=B, route cũ modules = module của B; lần 2: 409; publish -> 'published' trở lại.", pw="Một phần")
    A(F, "Admin remove/restore khóa; summary; id lạ 404; người không phải nhân viên 403", "Chức năng", "Trung bình", BASE + " " + MULTI + " " + ADMIN,
      ["Admin POST .../courses/<B>/remove {reason:'Vi phạm'} -> status 'removed'", "restore -> 'published'", "GET /api/admin/content/courses/summary -> total", "POST .../khong-co/publish", "Member GET /api/admin/content/courses"], "remove/restore", "removed -> restore ok; summary.total >= 2; id lạ 404; member 403.", pw="Một phần")
    A(F, "Admin thấy khóa nháp 'Quản trị rủi ro (bản nháp)' của fin với status 'draft'", "Chức năng", "Thấp", BASE + " " + ADMIN,
      ["GET /api/admin/content/courses?communityId=fin", "Tìm phần tử course-fin-risk"], "seed fin draft", "3 phần tử (fin có 3 khóa); course-fin-risk có status 'draft', modules=1, lessons=2.", pw="Có")
    A(F, "Phân quyền nhân viên: Moderator có content.manage vào được; Finance/Support 403 route nội dung khóa học", "Bảo mật", "Trung bình", BASE + " " + tok("moderator@sofinhub.test") + " Tương tự finance@, support@.",
      ["moderator@ GET /api/admin/content/courses", "finance@ và support@ GET cùng route"], "staff", "Moderator 200; Finance/Support 403 (thiếu content.manage).", pw="Có")
    A(F, "FE admin: bảng Khóa học có cột Module, preview có danh sách module, lọc cộng đồng, 'Mới nhất', avatar thumbnail thật", "Giao diện", "Trung bình", BASE + " " + ADMIN + " Đăng nhập admin@ trên FE; /admin/content/courses.",
      ["Mở danh sách khóa học", "Mở preview 1 khóa", "Lọc theo cộng đồng photo, sắp xếp 'Mới nhất'"], "admin FE", "Cột 'Module' hiện số module; preview liệt kê module; lọc photo còn 2 khóa; khi BE trả thumbnailUrl avatar dùng ảnh thật (không chữ cái).", pw="Có")

    # ============================================================ 8. FE: LỚP HỌC ĐA KHÓA
    F = "Giao diện: Lớp học đa khóa học"
    A(F, "Tab Lớp học photo: 2 thẻ khóa (Nhiếp ảnh cơ bản mặc định, Chỉnh sửa ảnh nâng cao) kèm module/bài/tiến độ", "Giao diện", "Cao", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở /communities/photo/community/lop-hoc", "Đọc thanh 'Chọn khóa học'", "Đọc hero (Module/Bài học/Học viên) và khối tiến độ"], "photo",
      "Thấy 2 thẻ ngang: 'Nhiếp ảnh cơ bản' (2 module · 12 bài, 50%) đang chọn mặc định (viền cam, aria-current) và 'Chỉnh sửa ảnh nâng cao' (2 module · 8 bài, 100%). Khối tiến độ: 'Tiến độ: Nhiếp ảnh cơ bản' '6/12 bài · 1 module' 50%. Hero: Module 2, Bài học 12.", pw="Có")
    A(F, "Chọn khóa thứ hai: danh sách module, hero, tiến độ và URL (?khoa=) đổi theo", "Giao diện", "Cao", BASE + " Đăng nhập member1@.",
      ["Bấm thẻ 'Chỉnh sửa ảnh nâng cao'", "Quan sát URL, module, tiến độ", "Bấm 'Tiếp tục học' (nếu có)"], "chuyển khóa",
      "URL thành .../lop-hoc?khoa=course-photo-editing (replace); hero Module 2, Bài học 8; tiến độ 'Tiến độ: Chỉnh sửa ảnh nâng cao' '8/8 bài · 2 module' 100%; danh sách 2 module 'Lightroom từ A đến Z' và 'Retouch chân dung với Photoshop' đều mở khóa (đã xong); 100% nên không còn 'Tiếp tục học'.", pw="Có")
    A(F, "Deep link ?khoa=<id> chọn đúng khóa; khoa lạ rơi về khóa mặc định", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@.",
      ["Mở /communities/photo/community/lop-hoc?khoa=course-photo-editing", "Mở ?khoa=khong-co"], "query khoa", "Lần 1 chọn 'Chỉnh sửa ảnh nâng cao'; lần 2 chọn khóa mặc định 'Nhiếp ảnh cơ bản' (không lỗi).", pw="Có")
    A(F, "Cộng đồng chỉ 1 khóa: không hiện thanh chọn khóa, nhãn 'Tiến độ khóa học'", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@ (có paid-demo/ai?). Dùng cộng đồng 1 khóa mà member1 tham gia (vd paid-demo).",
      ["Mở /communities/paid-demo/community/lop-hoc"], "1 khóa", "Không có thanh 'Chọn khóa học'; khối tiến độ ghi 'Tiến độ khóa học' (không kèm tên khóa).", pw="Có")
    A(F, "Khóa nháp chỉ mod+ thấy: owner@ thấy 'Quản trị rủi ro (bản nháp)' nhãn 'Nháp'; member1 không thấy", "Giao diện", "Cao", BASE + " Hai phiên: owner@ (owner fin) và member1@ (thành viên fin).",
      ["owner@ mở /communities/fin/community/lop-hoc", "member1@ mở cùng trang"], "fin draft", "owner@: 3 thẻ, thẻ nháp có badge 'Nháp' (amber); member1@: 2 thẻ (main + invest).", pw="Có")
    A(F, "Hero + tiến độ + 'Tiếp tục học' theo khóa đang chọn", "Giao diện", "Trung bình", BASE + " Đăng nhập member2@ (xong 2 bài đầu photo-main).",
      ["Mở lớp học photo (khóa main)", "Bấm 'Tiếp tục học'"], "member2", "Tiến độ 2/12 bài (17%); nút 'Tiếp tục học' dẫn tới bài kế tiếp chưa xong của khóa main (les-photo-1-3), URL /communities/photo/community/lop-hoc/les-photo-1-3.", pw="Có")
    A(F, "Khóa hoàn thành + có chứng nhận: nút 'Nhận chứng nhận' và thẻ chứng nhận; khóa tắt chứng nhận: dòng 'Khóa học này chưa bật chứng nhận hoàn thành.'", "Giao diện", "Cao", BASE + " Đăng nhập member1@ (photo-editing 100%, fin 100%).",
      ["Mở lớp học photo, chọn 'Chỉnh sửa ảnh nâng cao', bấm 'Nhận chứng nhận'", "Mở /communities/fin, chọn khóa; thử khóa 100% mà cấu hình tắt (đặt override 'Luôn tắt' bằng admin) "], "chứng nhận",
      "photo-editing (kế thừa cộng đồng photo bật): hiện 'Nhận chứng nhận' -> hộp/thẻ chứng nhận mã PHOTO-DEMO-CERT-002 (khóa 'Chỉnh sửa ảnh nâng cao'); khóa 100% nhưng certificatesEffective=false: không có nút, hiện 'Khóa học này chưa bật chứng nhận hoàn thành.'", pw="Có")
    A(F, "Cộng đồng chưa có khóa hiển thị được: 'Chưa có khóa học nào' (thành viên) / gợi ý tạo khóa (mod+)", "Giao diện", "Trung bình", BASE + " " + MULTI + " Lưu trữ/gỡ mọi khóa của cộng đồng thử (admin console unpublish) hoặc dùng cộng đồng chỉ có khóa nháp.",
      ["Member mở lớp học", "Mod mở lớp học"], "không có khóa published", "Member: 'Chưa có khóa học nào' + 'Cộng đồng này chưa xuất bản khóa học nào. Hãy quay lại sau nhé.'; Mod+: cùng tiêu đề + 'Hãy tạo khóa học đầu tiên để bắt đầu thêm module và bài học.' kèm khối quản lý khóa.", pw="Một phần")
    A(F, "Lớp học không có module: 'Lớp học chưa có nội dung.'", "Giao diện", "Thấp", BASE + " " + MULTI,
      ["Mở lớp học của khóa A khi chưa có module (member)"], "khóa trống", "Hiện 'Lớp học chưa có nội dung.'; hero Module 0, Bài học 0.", pw="Có")
    A(F, "Chế độ chỉnh sửa (mod+): 'Chỉnh sửa lớp học' bật CourseManager + ClassroomEditor; 'Thoát chỉnh sửa' tắt", "Giao diện", "Cao", BASE + " Đăng nhập owner@ (photo).",
      ["Mở lớp học photo", "Bấm 'Chỉnh sửa lớp học'", "Đọc khối 'Khóa học trong cộng đồng'", "Bấm 'Thoát chỉnh sửa'"], "edit mode", "Hiện danh sách khóa với badge 'Đã xuất bản' và 'Mặc định' (khóa main), nút 'Thêm khóa học', các nút lên/xuống/sửa/lưu trữ/xóa; phía dưới là editor module/bài của khóa đang chọn. Member không thấy nút chỉnh sửa.", pw="Có")
    A(F, "CourseManager: 'Thêm khóa học' (tên, mô tả, ảnh bìa URL hoặc Tải ảnh, Trạng thái Xuất bản/Nháp)", "Giao diện", "Cao", BASE + " " + MULTI + " Đăng nhập Mod trên FE.",
      ["Bấm 'Thêm khóa học'", "Nhập 'Tên khóa học' + 'Mô tả khóa học'", "Chọn Trạng thái 'Nháp (chỉ quản trị thấy)'", "Lưu"], "tạo khóa",
      "Dialog 'Thêm khóa học' có ô 'Tên khóa học', 'Mô tả khóa học', 'Ảnh bìa (URL http/https) — hoặc tải ảnh lên', 'Tải ảnh', chọn 'Xuất bản (thành viên thấy)'/'Nháp (chỉ quản trị thấy)'; lưu -> khóa mới trong danh sách với badge 'Nháp'; thành viên không thấy; validate title rỗng báo lỗi.", pw="Có")
    A(F, "CourseManager: sửa khóa (dialog 'Sửa khóa học'); admin+ thấy thêm ô chứng nhận, mod không", "Giao diện", "Trung bình", BASE + " " + MULTI + " Hai phiên: Mod và Admin.",
      ["Mod mở 'Sửa khóa học' cho khóa B", "Admin mở cùng dialog"], "CertModeSelect", "Mod: không có ô 'Chứng nhận hoàn thành của khóa học'; Admin: có select 'Theo cộng đồng (đang bật/tắt)' | 'Luôn bật' | 'Luôn tắt'; chọn rồi lưu -> certificatesEffective đổi tương ứng.", pw="Có")
    A(F, "CourseManager: nút đưa khóa lên/xuống (disabled ở biên), khóa published đầu tiên tự thành 'Mặc định'", "Giao diện", "Trung bình", BASE + " " + MULTI + " Đăng nhập Mod; cộng đồng có khóa A, B (+ nháp).",
      ["Bấm 'Đưa khóa học xuống' ở khóa A", "Quan sát nhãn 'Mặc định'", "Bấm 'Đưa khóa học lên' ở khóa A để khôi phục"], "reorder UI", "Nút lên disabled ở dòng đầu, xuống disabled ở dòng cuối; sau khi A xuống dưới B: nhãn 'Mặc định' chuyển sang B; khôi phục thì về A.", pw="Có")
    A(F, "CourseManager: lưu trữ khóa (title 'Lưu trữ (ẩn với thành viên, giữ dữ liệu)')", "Giao diện", "Trung bình", BASE + " " + MULTI + " Đăng nhập Mod.",
      ["Bấm biểu tượng lưu trữ ở khóa B", "Xem badge", "Mở bằng tài khoản member"], "archive UI", "Khóa B có badge 'Đã lưu trữ'; thành viên không còn thấy B ở thanh chọn khóa.", pw="Có")
    A(F, "CourseManager: xóa khóa chỉ admin+; hộp xác nhận nêu số module/bài; toast 'Đã xóa khóa học'; khóa cuối báo lỗi", "Giao diện", "Cao", BASE + " " + MULTI + " Hai phiên: Mod (không thấy nút xóa) và Admin.",
      ["Admin bấm 'Xóa khóa học' ở khóa B", "Đọc hộp thoại", "Xác nhận", "Thử xóa khóa duy nhất còn lại"], "delete UI",
      "Hộp 'Xóa khóa học?': 'Khóa học \"<tên>\" cùng <n> module, <m> bài học, tiến độ và chứng nhận liên quan sẽ bị xóa vĩnh viễn. Không thể xóa khóa học cuối cùng của cộng đồng.' nút 'Xóa khóa học'; xác nhận -> toast 'Đã xóa khóa học' và khóa biến mất; xóa khóa cuối: lỗi 400 hiển thị trong hộp thoại.", pw="Có")
    A(F, "Cài đặt cộng đồng > tab 'Khóa học': mô tả + CourseManager (cùng chức năng)", "Giao diện", "Trung bình", BASE + " Đăng nhập owner@.",
      ["Mở /communities/photo/community/cai-dat", "Chọn tab 'Khóa học'"], "settings tab", "Hiển thị 'Khóa học trong cộng đồng' + 'Mỗi khóa học có module, bài học, tiến độ và chứng nhận riêng. Khóa học đầu tiên (\"Khóa học chính\") được tạo tự động khi tạo cộng đồng.' + danh sách 2 khóa photo.", pw="Có")
    A(F, "LessonPage: lấy khóa từ lesson.learningCourseId, tiến độ khóa, link bài trước/sau; bài khóa thứ hai mở được bằng link trực tiếp", "Giao diện", "Cao", BASE + " Đăng nhập member1@.",
      ["Mở /communities/photo/community/lop-hoc/les-photo-editing-1-1", "Đọc khối 'Tiến độ khóa học' và nút bài trước/sau", "Bấm bài sau"], "bài khóa editing", "Mở được bài của khóa 'Chỉnh sửa ảnh nâng cao'; tiến độ là của khóa editing (8/8); bài sau dẫn tới les-photo-editing-1-2 (không sang khóa khác).", pw="Có")
    A(F, "LessonPage: module khóa -> 'Module này đang bị khóa' + hướng dẫn mở khóa", "Giao diện", "Trung bình", BASE + " Đăng nhập member2@ (mới xong 2 bài).",
      ["Mở /communities/photo/community/lop-hoc/les-photo-2-1 (module 2 chưa mở)"], "module khóa", "Tiêu đề 'Module này đang bị khóa'; mô tả 'Hoàn thành module trước đó (hoặc đạt đủ cấp độ yêu cầu) để mở khóa bài học này.'; không lộ nội dung bài.", pw="Có")
    A(F, "Tạo cộng đồng (FE): bước xác nhận ghi chú hệ thống tự tạo 'Khóa học chính'", "Giao diện", "Thấp", BASE + " Đăng nhập trên FE.",
      ["Mở /communities/new, điền form tới bước xác nhận", "Đọc ghi chú"], "create step", "Có dòng 'Hệ thống sẽ tự tạo sẵn khóa học đầu tiên \"Khóa học chính\" trong cộng đồng. Bạn có thể thêm module, bài học hoặc tạo thêm khóa học khác sau trong tab L...' (Lớp học). Lưu ý: khóa mặc định thực tế đặt tên = tên cộng đồng.", pw="Có")
    A(F, "HIỆN TẠI: ghi chú FE nói khóa tên 'Khóa học chính' nhưng BE đặt tên khóa mặc định = tên cộng đồng", "Giao diện", "Thấp", BASE + " Owner mới tạo cộng đồng 'Học Nhiều Khóa'.",
      ["Sau khi tạo: GET /api/communities/<id>/courses", "Đối chiếu title khóa với ghi chú ở bước tạo cộng đồng và mô tả CourseManager"], "lệch nhãn", "HIỆN TẠI: title khóa = 'Học Nhiều Khóa' (communities-courses.md 0), trong khi giao diện gọi là 'Khóa học chính'. Lệch văn bản, không ảnh hưởng chức năng.", pw="Có", st=PLAN)
    A(F, "Upload tệp bài học vẫn gửi courseId = id cộng đồng (purpose lesson_attachment)", "Chức năng", "Trung bình", BASE + " Đăng nhập owner@ trên FE; mở editor bài học.",
      ["Thêm tệp đính kèm cho 1 bài học của khóa 'Chỉnh sửa ảnh nâng cao'", "DevTools: POST /api/uploads/presign body.courseId"], "upload bài học", "body.courseId='photo' (id cộng đồng, không phải id khóa); upload thành công; thành viên photo tải được tài liệu (xem SECX). Gap: chờ BE uploads nhận communityId (community-course-split.md).", pw="Có")
    A(F, "Thông báo/email cũ trỏ /courses/... tiếp tục chạy nhờ redirect (không gãy bookmark)", "Giao diện", "Thấp", BASE,
      ["Mở bookmark cũ /courses/photo/community/xep-hang"], "bookmark", "Chuyển tới /communities/photo/community/xep-hang hiển thị bảng xếp hạng.", pw="Có")

    # ============================================================ 9. GỠ DỮ LIỆU GIẢ (audit bước 4)
    F = "Gỡ dữ liệu giả: API chi tiết cộng đồng & /api/stats (audit bước 4)"
    A(F, "GET /courses/:id không còn đánh giá minh họa: reviews rỗng khi chưa có đánh giá thật", "Chức năng", "Cao", BASE + " Cộng đồng chưa có review thật (vd tạo mới).",
      ["Owner mới tạo cộng đồng", "GET /api/courses/<id> -> reviews, highlights, gains, faqs"], "cộng đồng mới", "reviews=[], highlights=[], gains=[], faqs=[] (trước đây: 7 review tiếng Việt bịa 'Nguyễn Xuân', 'Oanh Nguyễn'... trộn với review thật).", pw="Có")
    A(F, "reviews chỉ gồm review thật (có rating); thêm/sửa/xóa review cập nhật rating/ratingCount tính lại từ bảng Review", "Chức năng", "Cao", BASE + " Cộng đồng mới có Owner + 2 thành viên M1, M2.",
      ["M1 POST /api/courses/<id>/reviews {rating:5,text:'tốt'} -> 201", "M2 POST {rating:3,text:'ổn'}", "GET /api/courses/<id> -> reviews, rating, ratingCount", "M2 xóa review (DELETE /reviews/mine)"], "review thật",
      "reviews có đúng 2 phần tử kèm trường rating; rating=4, ratingCount=2 (cộng đồng mới nền 0/0); sau khi M2 xóa: rating=5, ratingCount=1. M1 sửa review lần 2 trả 200 (không tạo thêm).", pw="Có")
    A(F, "Chi tiết cộng đồng KHÔNG có trường `modules` (module thật ở /courses/:id/modules)", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["GET /api/courses/photo", "Tìm khóa 'modules' trong JSON", "GET /api/courses/photo/modules"], "photo", "Không có khóa 'modules' trong detail; modules thật = 2 module của khóa mặc định (trước đây detail quảng cáo 3 module giả trong khi lớp học có 2).", pw="Có")
    A(F, "Số người online là thật: min(students, online thật), không thổi phồng", "Chức năng", "Trung bình", BASE + " Cộng đồng mới 1 thành viên.",
      ["GET /api/courses/<id> -> stats.online, stats.members", "Đăng nhập thêm vài user rồi gọi lại"], "stats", "stats.online <= stats.members và phản ánh số thành viên hoạt động gần đây thật; stats.admins >= 1; không còn max(real, 'illustrativeOnline').", pw="Có")
    A(F, "priceNotes: cộng đồng có phí -> 'Miễn phí dùng thử N ngày' (N từ Cài đặt chung) + 'Hủy bất kỳ lúc nào'; miễn phí -> []", "Chức năng", "Cao", BASE + " " + ADMIN,
      ["GET /api/courses/ai -> priceNotes", "GET /api/courses/fit -> priceNotes", "Admin đổi Cài đặt chung trialDays=10, GET /api/courses/ai"], "priceNotes", "ai: ['Miễn phí dùng thử 7 ngày','Hủy bất kỳ lúc nào']; fit: []; sau đổi trialDays: 'Miễn phí dùng thử 10 ngày' (không còn hardcode 7).", pw="Có")
    A(F, "Không còn highlights/gains/FAQ cứng chung cho mọi cộng đồng (FE ẩn khối khi rỗng)", "Giao diện", "Trung bình", BASE + " Đăng nhập trên FE.",
      ["Mở /communities/ai và /communities/photo", "Tìm các khối 'Điểm nổi bật', 'Bạn nhận được', 'Câu hỏi thường gặp' của trang chi tiết"], "CourseDetailPage", "Các khối đó KHÔNG hiện (mảng rỗng); mục 'Đánh giá' hiện trạng thái rỗng nếu chưa có review thật.", pw="Có")
    A(F, "GET /api/stats tính từ DB: learners, courses, instructors, rating (null nếu chưa có đánh giá)", "Chức năng", "Cao", BASE + " " + SQLH,
      ["GET /api/stats (không cần đăng nhập)", "SQL learners: SELECT count(*) FROM \"User\" u WHERE NOT \"isDemo\" AND \"deletedAt\" IS NULL AND EXISTS (SELECT 1 FROM \"Enrollment\" e WHERE e.\"userId\"=u.id)", "SQL courses: SELECT count(*) FROM \"Course\" WHERE \"deletedAt\" IS NULL AND NOT locked AND \"moderationStatus\"='active' AND \"discoveryStatus\"='listed'", "SQL instructors: SELECT count(DISTINCT \"ownerId\") FROM (cùng điều kiện, ownerId not null)", "SQL rating: SELECT round(avg(r.rating)::numeric,1), count(*) FROM \"Review\" r JOIN \"User\" u ON u.id=r.\"userId\" WHERE NOT u.\"isDemo\""], "stats",
      "{data:{learners,courses,instructors,rating}} khớp 4 truy vấn SQL (rating làm tròn 1 chữ số thập phân). Trước đây hằng số {100.000, 1.000, 4.9}.", pw="Có")
    A(F, "rating = null khi chưa có đánh giá thật nào (FE hiện '–')", "Chức năng", "Cao", BASE + " " + SQLH + " " + MUTATE,
      ["SQL: DELETE FROM \"Review\"", "GET /api/stats", "Tải lại trang chủ, nhìn chỉ số 'điểm đánh giá trung bình' ở Hero"], "không review", "rating=null; Hero hiển thị '–' (không '4.9/5'); các chỉ số học viên/cộng đồng/chủ cộng đồng vẫn là số thật. (Khôi phục bằng db:reset.)", pw="Có")
    A(F, "Học viên tính người thật: thành viên minh họa (isDemo) và tài khoản đã xóa KHÔNG được đếm", "Chức năng", "Trung bình", BASE + " " + SQLH + " " + MUTATE,
      ["GET /api/stats -> learners (L0)", "Đăng ký user mới và tham gia 1 cộng đồng; GET lại", "Xóa tài khoản đó; GET lại"], "learners", "L0+1 sau khi tham gia; trở về L0 sau khi xóa; demo không bao giờ cộng vào.", pw="Có")
    A(F, "courses chỉ đếm cộng đồng được liệt kê công khai: locked/ẩn/riêng tư/đã xóa không tính", "Chức năng", "Trung bình", BASE + " " + ADMIN,
      ["GET /api/stats -> courses (C0)", "Admin lock 1 cộng đồng công khai; GET lại", "Đặt discoveryStatus unlisted; GET lại"], "courses", "Giảm 1 sau mỗi bước (điều kiện: deletedAt null, không locked, moderationStatus active, discoveryStatus listed); cộng đồng private (fin, lead) không tính.", pw="Một phần")

    F = "Gỡ dữ liệu giả: Frontend trang chủ, FAQ, điều hướng"
    A(F, "Trang chủ không còn 5 lời chứng thực bịa (Stories) hay widget doanh thu '+$12,500'", "Giao diện", "Cao", BASE,
      ["Mở http://localhost:5173 (chưa đăng nhập)", "Cuộn toàn trang; Ctrl+F: 'Nguyễn Xuân', '12,500', 'Câu chuyện', 'testimonial'", "Xem khối 'Tạo cộng đồng của riêng bạn'"], "HomePage",
      "Không có khối câu chuyện/lời chứng thực nào; khối CTA chỉ còn tiêu đề, mô tả, nút và thẻ '＋ Mời thành viên' (không thẻ doanh thu giả, không biểu đồ 4 cột).", pw="Có")
    A(F, "CTA 'Tạo cộng đồng ngay →' là liên kết thật tới /communities/new", "Giao diện", "Cao", BASE + " Chưa đăng nhập và đã đăng nhập.",
      ["Bấm 'Tạo cộng đồng ngay →' ở trang chủ", "Lặp khi chưa đăng nhập"], "CTA", "Chuyển tới /communities/new (chưa đăng nhập: trang yêu cầu đăng nhập/chuyển /login rồi quay lại). Trước đây nút không có onClick/link.", pw="Có")
    A(F, "Header: 3 mục nav (Khám phá '/', Khóa học '/#courses', Cộng đồng '/search') đều là liên kết thật", "Giao diện", "Trung bình", BASE,
      ["Bấm lần lượt từng mục trên Header (desktop) và trong menu mobile", "Kiểm tra DOM: không có href=\"#\""], "Header", "Khám phá -> '/'; Khóa học -> '/#courses' cuộn tới 'Khóa học nổi bật'; Cộng đồng -> /search. Không còn mục Sự kiện/Thành viên dẫn '#'.", pw="Có")
    A(F, "Footer: không còn 13 link chết và 4 icon social; chỉ liên kết thật (Khóa học, Cộng đồng, Tạo cộng đồng, Liên hệ, FAQ, Điều khoản, Chính sách bảo mật, Cookie)", "Giao diện", "Trung bình", BASE,
      ["Cuộn xuống Footer", "Bấm từng liên kết", "Tìm href=\"#\" trong toàn bộ trang (DevTools)"], "Footer", "Cột 'Khám phá': Khóa học (/#courses), Cộng đồng (/search), Tạo cộng đồng (/communities/new); cột 'Hỗ trợ': Liên hệ (/contact), Câu hỏi thường gặp (/faq); legal: Điều khoản (/terms), Chính sách bảo mật (/privacy), Cookie (/privacy). Không icon social.", pw="Có")
    A(F, "Toàn bộ FE không còn href=\"#\" (quét mã nguồn/DOM)", "Giao diện", "Thấp", BASE,
      ["grep -rn 'href=\"#\"' frontend/src", "Mở vài trang chính và quét DOM bằng document.querySelectorAll('a[href=\"#\"]')"], "href=#", "0 kết quả trong mã nguồn; 0 phần tử a[href='#'] trên các trang chính.", pw="Có")
    A(F, "Newsletter ở Footer: đăng ký email -> 'Cảm ơn bạn đã đăng ký!'; lỗi 429 báo 'Bạn thao tác quá nhanh...'", "Giao diện", "Thấp", BASE,
      ["Nhập email hợp lệ ở 'Nhận bản tin' -> Đăng ký", "Gửi lặp nhiều lần để chạm hạn mức"], "newsletter", "Thành công: 'Cảm ơn bạn đã đăng ký!' (idempotent); chạm hạn mức: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.'", pw="Có")
    A(F, "Hero: các chỉ số (học viên, cộng đồng, chủ cộng đồng, điểm đánh giá trung bình) lấy từ /api/stats", "Giao diện", "Cao", BASE + " " + SQLH,
      ["Mở trang chủ, đọc 4 chỉ số ở Hero", "So với GET /api/stats", "Với rating=null (xem case trước) kiểm tra '–'"], "Hero stats", "Giá trị khớp API (định dạng vi-VN cho số, 'X/5' cho rating); rating null -> '–'; chờ tải thì không hiện số bịa.", pw="Có")
    A(F, "FAQ viết lại đúng sản phẩm: không còn câu 'đang phát triển'; có nội dung quên mật khẩu, thanh toán, tạo cộng đồng, rời cộng đồng có phí, hoàn tiền", "Giao diện", "Cao", BASE,
      ["Mở /faq", "Ctrl+F 'đang phát triển'", "Đọc câu hỏi 'Tôi quên mật khẩu', 'Làm sao để rời khỏi cộng đồng?', 'Có hoàn tiền không?'"], "FaqPage", "0 lần xuất hiện 'đang phát triển'; câu quên mật khẩu mô tả liên kết đặt lại có thời hạn, dùng 1 lần; câu rời cộng đồng nêu 'mất truy cập ngay, gói tự động hủy vào cuối kỳ... trong kỳ đã trả vào lại miễn phí'; câu hoàn tiền nêu thời hạn hoàn tiền + trạng thái 'Đã hoàn tiền'.", pw="Có")
    A(F, "HIỆN TẠI: FAQ nói 'sau khi đăng ký hệ thống gửi email xác minh' nhưng register không gửi mail (phải bấm 'Gửi email xác minh')", "Chức năng", "Trung bình", BASE + " Outbox dev bật (ENABLE_DEV_OUTBOX=1).",
      ["Đăng ký user mới", "GET /api/dev/outbox?to=<email> ngay sau đăng ký", "Đọc FAQ 'Làm sao để đăng ký tài khoản?'"], "audit 6.3", "HIỆN TẠI: outbox rỗng (BE register không gửi verify email; email chỉ được gửi khi bấm VerifyBanner/POST /auth/send-verification). FAQ nói ngược lại - lệch tài liệu/UX. Cần sửa FAQ hoặc gửi mail lúc đăng ký.", pw="Có", st=PLAN)
    A(F, "CourseDetailPage: quyền lợi (perks) chỉ gồm điều thật: số bài học thật + cộng đồng + ghi chú giá/dùng thử từ API", "Giao diện", "Trung bình", BASE + " Đăng nhập trên FE.",
      ["Mở /communities/ai (có phí) và /communities/fit (miễn phí)", "Đọc khối thông tin bên phải"], "perks", "ai: hiện 'Miễn phí dùng thử 7 ngày' + 'Hủy bất kỳ lúc nào' (từ priceNotes); số bài học thật; fit: không có ghi chú dùng thử. Không còn SIDEBAR_PERKS hardcode 'Miễn phí dùng thử 7 ngày' cho mọi cộng đồng.", pw="Có")
    A(F, "Nút 'Bắt đầu dùng thử' chỉ hiện khi priceNotes có 'Miễn phí dùng thử ...' và nêu đúng số ngày cấu hình", "Giao diện", "Thấp", BASE + " " + ADMIN,
      ["Đổi Cài đặt chung trialDays=10", "Mở /communities/yoga"], "trialNote", "Nội dung dùng thử hiển thị '10 ngày' (lấy từ priceNotes), không phải 7 cố định.", pw="Một phần")

    # ============================================================ 10. ĐÃ BIẾT / KẾ HOẠCH
    F = "Điểm đã biết / chưa làm của tách Community-Course"
    A(F, "HIỆN TẠI: chưa chuyển được module giữa các khóa học", "Chức năng", "Trung bình", BASE + " " + MULTI,
      ["Mod PATCH /api/communities/<id>/courses/<A>/modules/<A1> {learningCourseId:'<B>'}", "Kiểm tra UI có thao tác 'Chuyển sang khóa khác'"], "move module", "HIỆN TẠI: field bị bỏ qua/400 (schema không có); phải xóa và tạo lại (mất tiến độ). Ngoài phạm vi (communities-courses.md 7.10).", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: chưa có mở khóa liên khóa (khóa B yêu cầu hoàn thành khóa A) hoặc requiredLevel override theo khóa", "Chức năng", "Thấp", BASE,
      ["Tìm cấu hình khóa tiên quyết ở CourseFormDialog/API"], "prerequisite", "HIỆN TẠI: không có; hoàn thành khóa A không mở khóa khóa B (đã được khẳng định theo thiết kế). Kế hoạch.", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: chưa có trang marketplace/tìm kiếm/thống kê theo từng khóa học (chỉ theo cộng đồng)", "Giao diện", "Thấp", BASE,
      ["Tìm trang /communities/<id>/courses/<courseId> trên FE", "Tìm kiếm khóa học theo tên khóa con"], "per-course page", "HIỆN TẠI: không có route FE cho từng khóa; tìm kiếm trả cộng đồng, không trả khóa con. Kế hoạch (community-course-split.md 'Gap').", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: sắp xếp khóa/module bằng nút lên/xuống, chưa có kéo-thả", "Giao diện", "Thấp", BASE + " Đăng nhập Mod.",
      ["Thử kéo-thả một khóa trong CourseManager"], "drag-drop", "HIỆN TẠI: không kéo-thả được; chỉ có nút 'Đưa khóa học lên/xuống'. Kế hoạch.", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: FE chưa dùng defaultCourseId/coursesCount của GET /courses/:id", "Giao diện", "Thấp", BASE + " Đăng nhập trên FE.",
      ["Mở /communities/photo", "Tìm chỗ hiển thị 'số khóa học' hoặc dùng defaultCourseId trên trang chi tiết (grep frontend/src)"], "BE trả, FE bỏ qua", "HIỆN TẠI: BE trả defaultCourseId=course-photo-main, coursesCount=2 nhưng FE không đọc (grep không thấy); trang chi tiết marketplace không nói cộng đồng có 2 khóa. Kế hoạch.", pw="Có", st=PLAN)
    A(F, "HIỆN TẠI: ghi danh cộng đồng = vào mọi khóa (chưa có ghi danh theo khóa học riêng)", "Chức năng", "Thấp", BASE + " " + MULTI,
      ["Member tham gia cộng đồng", "GET .../courses (thấy mọi khóa published)", "Tìm cách chỉ ghi danh 1 khóa"], "Enrollment theo cộng đồng", "HIỆN TẠI: Enrollment/thanh toán/điểm vẫn theo cộng đồng; không có ghi danh theo khóa (Enrollment @@id([userId, communityId])). Kế hoạch nếu bán khóa lẻ.", pw="Có", st=PLAN)
    A(F, "Tài liệu: OPEN_DECISIONS E1 và BRD 5.2/6 khớp với code (một cộng đồng có nhiều khóa học)", "Giao diện", "Thấp", "Mở docs/OPEN_DECISIONS.md mục E1 và PLAN.md dòng Model Community.",
      ["Đối chiếu mô tả với schema và API"], "tài liệu", "Khớp: Prisma Course->Community (bảng cũ giữ), entity Course mới (LearningCourse); API cũ + /communities. Việc còn lại ghi rõ: FE chuyển dần sang /communities + communityId; bỏ alias courseId khi FE đã đổi.", pw="Không")

    # @@END@@
