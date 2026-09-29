# -*- coding: utf-8 -*-
"""Testcase bổ sung: COURSE (phần Lớp học) và CERT (Chứng nhận). Nguồn: backend/docs/api/classroom.md,
docs/features/content.md (mục C), backend/prisma/seed/classroom.ts, backend/src/modules/classroom/*."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = "Tiền điều kiện chung: đã `db:seed`, BE :4000, FE :5173; mật khẩu mọi tài khoản seed = Passw0rd!x. "
L = "/courses/photo/community/lop-hoc"           # đường dẫn FE của tab Lớp học
VAL = "400 VALIDATION_ERROR ('Tham số không hợp lệ', details.fieldErrors)"
NOPERM = "403 FORBIDDEN 'Bạn không có quyền thực hiện thao tác này trong cộng đồng'"
LOCK = "403 MODULE_LOCKED 'Module này đang bị khóa. Hãy hoàn thành module trước đó hoặc đạt đủ cấp độ yêu cầu'"


def load(add):
    def C(mod, feature, title, tt, pri, pre, steps, data, exp, pw="Có", st=DONE):
        code, name = mod
        add(code, name, feature, title, tt, pri, st, pre, steps, data, exp, pw=pw)

    CO = ("COURSE", "Khóa học / Lớp học")
    CE = ("CERT", "Chứng nhận")

    # =====================================================================================
    # COURSE — A. Danh sách module & % tiến độ theo từng người
    # =====================================================================================
    F = "Lớp học - Danh sách module & tiến độ"
    C(CO, F, "member1 xem module photo: module 1 xong 100%, module 2 đã mở khóa", "Chức năng", "Cao",
      BASE + "Đăng nhập member1@sofinhub.test; cộng đồng photo có 2 module x 6 bài (seed): member1 đã xong toàn bộ module 1.",
      ["Đăng nhập member1, lấy token", "GET /api/courses/photo/modules", "Mở UI " + L + " và quan sát 2 thẻ module"],
      "courseId=photo; module id mod-photo-1, mod-photo-2",
      "200 { data: [m1, m2] }. m1: id mod-photo-1, index 1, title 'Chào mừng & Lộ trình', lessonsCount 6, completedCount 6, pct 100, locked false, lockReason null. m2: id mod-photo-2, index 2, title 'Tư duy & Nền tảng', lessonsCount 6, completedCount 0, pct 0, locked false, lockReason null (vì module trước đã xong). UI: hai thẻ, không có lớp phủ khóa.")
    C(CO, F, "member2 xem module photo: module 1 xong 33% (2/6), module 2 bị khóa 'previous_module'", "Chức năng", "Cao",
      BASE + "Đăng nhập member2@sofinhub.test; seed: member2 xong 2 bài đầu module 1 photo (les-photo-1-1, les-photo-1-2).",
      ["Đăng nhập member2", "GET /api/courses/photo/modules", "Mở UI " + L],
      "courseId=photo",
      "200. m1: completedCount 2, lessonsCount 6, pct 33 (làm tròn 2/6), locked false. m2: pct 0, locked true, lockReason 'previous_module'. UI: thẻ module 2 có lớp phủ 'Hoàn thành module trước', nút mở bị vô hiệu.")
    C(CO, F, "member3 chưa học gì: 0% mọi module, module 2 khóa", "Chức năng", "Trung bình",
      BASE + "Đăng nhập member3@sofinhub.test (photo, không có tiến độ seed).",
      ["Đăng nhập member3", "GET /api/courses/photo/modules"],
      "courseId=photo",
      "200. m1: completedCount 0, pct 0, locked false. m2: pct 0, locked true, lockReason 'previous_module'.")
    C(CO, F, "Tiến độ tổng của member1 ở photo: 50%, 6/12 bài, 1 module, nextLesson sang module 2", "Chức năng", "Cao",
      BASE + "Đăng nhập member1.",
      ["GET /api/courses/photo/progress", "Đối chiếu thanh 'Tiến độ khóa học' trên " + L],
      "courseId=photo",
      "200 { percent: 50, completedLessons: 6, totalLessons: 12, completedModules: 1, lastLessonId: 'les-photo-1-6' (bài hoàn thành gần nhất), nextLesson: { id: 'les-photo-2-1', title: 'Bài 1: Tư duy & Nền tảng (Phần 1/6)', moduleId: 'mod-photo-2' } }. UI hiển thị '6/12 bài · 1 module' và nút 'Tiếp tục học'.")
    C(CO, F, "Tiến độ tổng của member2: 17% (2/12), nextLesson là bài 3 module 1", "Chức năng", "Cao",
      BASE + "Đăng nhập member2.",
      ["GET /api/courses/photo/progress"],
      "courseId=photo",
      "200 { percent: 17 (làm tròn 2/12), completedLessons: 2, totalLessons: 12, completedModules: 0, lastLessonId: 'les-photo-1-2', nextLesson: { id: 'les-photo-1-3', moduleId: 'mod-photo-1' } }. Module 2 khóa nên nextLesson KHÔNG nhảy sang module 2.")
    C(CO, F, "Tiến độ của member3: 0%, lastLessonId null, nextLesson là bài đầu tiên", "Chức năng", "Trung bình",
      BASE + "Đăng nhập member3.",
      ["GET /api/courses/photo/progress"],
      "courseId=photo",
      "200 { percent: 0, completedLessons: 0, totalLessons: 12, completedModules: 0, lastLessonId: null, nextLesson: { id: 'les-photo-1-1' } }.")
    C(CO, F, "UI đầu trang lớp học: thanh tiến độ và nút 'Tiếp tục học' đi đúng bài", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member2.",
      ["Mở " + L, "Đọc dòng tiến độ và % thanh", "Bấm 'Tiếp tục học'"],
      "member2: 2/12 bài",
      "Hiển thị '2/12 bài · 0 module' và 17%. Bấm 'Tiếp tục học' chuyển tới " + L + "/les-photo-1-3 (nextLesson).")
    C(CO, F, "Module khóa hiển thị đúng lớp phủ và không mở được danh sách bài", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member3.",
      ["Mở " + L, "Quan sát thẻ 'Tư duy & Nền tảng'", "Thử bấm mũi tên 'Mở Tư duy & Nền tảng'"],
      "module 2 photo bị khóa",
      "Thẻ có lớp phủ 'Hoàn thành module trước'; nút mở bị vô hiệu, không gọi được GET .../modules/mod-photo-2/lessons (không phát sinh request 403).")
    C(CO, F, "Cấu trúc nội dung seed: photo 2x6, yt 5 module (5-5-5-5-4), fin 3 module (5-5-6)", "Chức năng", "Trung bình",
      BASE + "Dùng member1 (thuộc photo, yt, fin). Công thức seed: số module = clamp(round(số bài/5), 2..5), module cuối nhận phần dư.",
      ["GET /api/courses/photo/modules", "GET /api/courses/yt/modules", "GET /api/courses/fin/modules", "So sánh lessonsCount từng module và id (mod-<course>-<n>)"],
      "photo=12 bài, yt=24 bài, fin=16 bài",
      "photo: 2 module [6,6]. yt: 5 module [5,5,5,5,4]. fin: 3 module [5,5,6]. Tiêu đề module theo mẫu: 'Chào mừng & Lộ trình', 'Tư duy & Nền tảng', 'Kỹ năng thực chiến', 'Nâng cao & Mở rộng', 'Dự án tổng kết'. Bài thứ 4 mỗi module là type 'text', các bài còn lại 'video'.")
    C(CO, F, "Phân trang danh sách module trên UI (10 module/trang)", "Giao diện", "Thấp",
      BASE + "Đăng nhập mod@sofinhub.test (mod photo). Photo đang có 2 module; tạo thêm 9 module (tổng 11). Dọn sau test bằng DELETE.",
      ["Với mod: POST /api/courses/photo/modules 9 lần, body {title:'Trang N', description:'x'}", "Mở " + L, "Kiểm tra trang 1 hiển thị 10 thẻ, bấm 'Tiếp theo ›'", "Xóa 9 module vừa tạo"],
      "9 module 'Trang 1'..'Trang 9'",
      "Trang 1 hiện 10 module và chân trang '1–10 trên 11'; trang 2 hiện 1 thẻ; nút '‹ Trước' bị vô hiệu ở trang 1, 'Tiếp theo ›' bị vô hiệu ở trang cuối.")
    C(CO, F, "Lớp học chưa có nội dung: trạng thái rỗng cho học viên và cho mod", "Giao diện", "Thấp",
      BASE + "Dùng khóa thử của owner (hoặc photo rồi seed lại). Xóa hết module bằng DELETE /api/courses/photo/modules/:id. Lưu ý: chạy lại `npm run db:seed` sẽ dựng lại module khi khóa không còn module nào.",
      ["Đăng nhập owner, xóa mọi module của khóa", "Đăng nhập member -> mở " + L, "Đăng nhập mod -> mở " + L + " -> 'Chỉnh sửa lớp học'"],
      "0 module",
      "Học viên: 'Lớp học chưa có nội dung.'. Mod trong chế độ chỉnh sửa: 'Lớp học chưa có module nào. Hãy thêm module đầu tiên.'. GET /progress trả percent 0, totalLessons 0, nextLesson null (không chia cho 0).")
    C(CO, F, "Lỗi tải danh sách module hiển thị ErrorNote, không trắng trang", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member1. Playwright: route.fulfill 500 cho GET /api/courses/photo/modules.",
      ["Chặn request modules trả 500", "Mở " + L],
      "GET /api/courses/photo/modules -> 500",
      "Thấy thông báo lỗi 'Không tải được lớp học' (hoặc message từ API); trang không crash; các phần khác của cộng đồng (sidebar, topbar) vẫn hiển thị.")
    C(CO, F, "Trạng thái đang tải hiển thị 'Đang tải lớp học…'", "Giao diện", "Thấp",
      BASE + "Đăng nhập member1. Playwright: trì hoãn GET /api/courses/photo/modules 2 giây.",
      ["Trì hoãn response modules", "Mở " + L, "Chụp màn hình trong lúc chờ"],
      "delay 2000ms",
      "Trong lúc chờ hiển thị 'Đang tải lớp học…'; sau khi có dữ liệu thay bằng danh sách module.")

    # =====================================================================================
    # B. Player bài học
    # =====================================================================================
    F = "Lớp học - Trang học (player)"
    C(CO, F, "Chi tiết bài học đầu tiên: prev null, next là bài 2", "Chức năng", "Cao",
      BASE + "Đăng nhập member1.",
      ["GET /api/courses/photo/lessons/les-photo-1-1"],
      "lessonId=les-photo-1-1",
      "200. id les-photo-1-1, moduleId mod-photo-1, moduleTitle 'Chào mừng & Lộ trình', moduleIndex 1, type 'video', completed true (seed), prevLessonId null, nextLessonId 'les-photo-1-2', body 'Nội dung bài học minh họa — mod/admin có thể chỉnh sửa trong phần quản lý lớp học.', không lộ moduleId/courseId thừa ngoài các trường mô tả.")
    C(CO, F, "Bài cuối module 1 -> bài sau nhảy sang module 2 (thứ tự toàn khóa)", "Chức năng", "Cao",
      BASE + "Đăng nhập member1 (module 2 photo đã mở).",
      ["GET /api/courses/photo/lessons/les-photo-1-6", "GET /api/courses/photo/lessons/les-photo-2-1"],
      "les-photo-1-6, les-photo-2-1",
      "les-photo-1-6: nextLessonId 'les-photo-2-1'. les-photo-2-1: prevLessonId 'les-photo-1-6', moduleIndex 2, moduleTitle 'Tư duy & Nền tảng'.")
    C(CO, F, "Bài cuối cùng của khóa: nextLessonId null; UI hiện 'Về lớp học' thay nút Bài sau", "Chức năng", "Trung bình",
      BASE + "Đăng nhập member1.",
      ["GET /api/courses/photo/lessons/les-photo-2-6", "Mở UI " + L + "/les-photo-2-6"],
      "les-photo-2-6",
      "200 nextLessonId null, prevLessonId 'les-photo-2-5'. UI: có 'Bài trước', KHÔNG có nút 'Bài sau', có nút 'Về lớp học'.")
    C(CO, F, "Bài đầu tiên của khóa: UI không có 'Bài trước'", "Giao diện", "Thấp",
      BASE + "Đăng nhập member3.",
      ["Mở UI " + L + "/les-photo-1-1"],
      "les-photo-1-1",
      "Không hiển thị nút 'Bài trước'; hiển thị 'Bài sau' dẫn tới " + L + "/les-photo-1-2.")
    C(CO, F, "Bài dạng văn bản (bài 4) hiển thị nội dung, không có khung video", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member1. Bài les-photo-1-4 có type 'text'.",
      ["Mở UI " + L + "/les-photo-1-4"],
      "les-photo-1-4",
      "Nhãn '<N> phút · Bài đọc'; hiển thị nội dung body; không có iframe video.")
    C(CO, F, "Bài video seed chưa có link video: hiển thị thông báo thay vì iframe", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member1. Bài les-photo-1-1 type 'video' nhưng seed KHÔNG gán videoUrl.",
      ["Mở UI " + L + "/les-photo-1-1"],
      "les-photo-1-1",
      "Khung 16:9 hiển thị 'Bài học này chưa có video.'; nhãn '<N> phút · Video'; không lỗi console.")
    C(CO, F, "Bài có link YouTube: embed dựng lại từ ID, iframe có sandbox và referrerpolicy", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod, sửa bài les-photo-1-1: PATCH /api/courses/photo/lessons/les-photo-1-1 {videoUrl:'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s'}. Khôi phục sau test bằng {videoUrl:null}.",
      ["PATCH videoUrl như trên -> đọc response", "Đăng nhập member1, mở " + L + "/les-photo-1-1", "Kiểm tra thuộc tính iframe bằng DevTools"],
      "videoUrl=https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      "PATCH 200: videoUrl lưu bản trim, embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ' (bỏ tham số &t). UI có 1 iframe src=embedUrl, có thuộc tính sandbox và referrerpolicy; không có host lạ.")
    C(CO, F, "Chuẩn hóa nhiều dạng link video hợp lệ về URL nhúng (matrix)", "Chức năng", "Cao",
      BASE + "Đăng nhập mod. Dùng 1 module mới để tạo bài: POST /api/courses/photo/modules/{id}/lessons {title:'V', type:'video', durationMin:5, body:'x', videoUrl:<...>}.",
      ["Tạo lần lượt 6 bài với 6 link ở Dữ liệu test", "Đọc embedUrl của mỗi bài", "Xóa module thử"],
      "1) https://youtu.be/dQw4w9WgXcQ 2) https://www.youtube.com/shorts/dQw4w9WgXcQ 3) https://www.youtube.com/embed/dQw4w9WgXcQ 4) https://m.youtube.com/watch?v=dQw4w9WgXcQ 5) https://vimeo.com/76979871 6) https://player.vimeo.com/video/76979871",
      "Cả 6 trả 201. embedUrl bài 1-4 = 'https://www.youtube.com/embed/dQw4w9WgXcQ'; bài 5-6 = 'https://player.vimeo.com/video/76979871'.")
    C(CO, F, "Từ chối link video không hợp lệ (matrix bảo mật)", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod, có module thử để tạo bài.",
      ["POST tạo bài với từng videoUrl ở Dữ liệu test", "Kiểm tra response và không có bài nào được tạo"],
      "a) https://evil.example.com/watch?v=dQw4w9WgXcQ b) https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ c) javascript:alert(1) d) https://www.youtube.com/watch?v=short (ID 10 ký tự) e) https://vimeo.com/abc f) ftp://youtu.be/dQw4w9WgXcQ g) 'không phải url'",
      "Cả 7 trả " + VAL + " với thông điệp trường videoUrl 'Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ'; số bài của module không đổi.")
    C(CO, F, "Bài có tệp đính kèm: hiển thị danh sách link tải; link không hợp lệ bị đánh dấu", "Giao diện", "Trung bình",
      BASE + "Đăng nhập mod. Tạo bài có attachments:[{name:'Tài liệu.pdf', url:'https://example.com/a.pdf', size:1024}] và mở bằng member1.",
      ["POST tạo bài với attachments", "Mở " + L + "/{lessonId} bằng member1", "Bấm vào 'Tài liệu.pdf'"],
      "attachment name 'Tài liệu.pdf', url https://example.com/a.pdf",
      "Khối 'Tệp đính kèm' liệt kê 'Tài liệu.pdf' là liên kết mở tab mới tới URL; tệp có url không phải http(s) (nếu dữ liệu cũ) hiển thị '<tên> (liên kết không hợp lệ)' không click được.")
    C(CO, F, "Thanh điều hướng, tiến độ khóa và danh sách bài cùng module ở cột phải", "Giao diện", "Thấp",
      BASE + "Đăng nhập member2.",
      ["Mở UI " + L + "/les-photo-1-3", "Quan sát breadcrumb 'Lớp học', thanh 'Tiến độ khóa học', danh sách bài của module 1", "Bấm bài les-photo-1-5 ở cột phải"],
      "member2, les-photo-1-3",
      "Breadcrumb 'Lớp học' quay lại danh sách; tiến độ '2/12 bài · 17%'; cột phải liệt kê 6 bài của module 1, bài đang xem có aria-current='page'; bấm bài 5 chuyển sang " + L + "/les-photo-1-5.")
    C(CO, F, "Bài học không tồn tại: 404 và màn 'Không mở được bài học'", "Chức năng", "Trung bình",
      BASE + "Đăng nhập member1.",
      ["GET /api/courses/photo/lessons/les-photo-9-9", "Mở UI " + L + "/les-photo-9-9"],
      "lessonId=les-photo-9-9",
      "API: 404 NOT_FOUND 'Không tìm thấy bài học'. UI: tiêu đề 'Không mở được bài học', nội dung 'Bài học không tồn tại hoặc bạn không có quyền xem.' và nút 'Về danh sách lớp học'.")
    C(CO, F, "IDOR chéo khóa: dùng id bài của cộng đồng khác qua URL photo trả 404", "Bảo mật", "Cao",
      BASE + "Đăng nhập member1 (thuộc cả photo và yt). Bài les-yt-1-1 thuộc yt.",
      ["GET /api/courses/photo/lessons/les-yt-1-1", "POST /api/courses/photo/lessons/les-yt-1-1/complete", "GET /api/courses/photo/modules/mod-yt-1/lessons"],
      "les-yt-1-1, mod-yt-1 qua courseId=photo",
      "Cả 3 trả 404 NOT_FOUND ('Không tìm thấy bài học' / 'Không tìm thấy module'); không tạo LessonProgress cho yt qua URL photo.")

    # =====================================================================================
    # C. Hoàn thành / bỏ hoàn thành, điểm
    # =====================================================================================
    F = "Lớp học - Đánh dấu hoàn thành"
    C(CO, F, "member2 hoàn thành bài 3: completed true, module 1 lên 50%, tổng 25%", "Chức năng", "Cao",
      BASE + "Đăng nhập member2 (2/6 module 1). Khôi phục sau test: gọi lại POST complete để bỏ đánh dấu.",
      ["POST /api/courses/photo/lessons/les-photo-1-3/complete", "GET /api/courses/photo/modules", "GET /api/courses/photo/progress"],
      "lessonId=les-photo-1-3",
      "POST 200 { data: { completed: true } }. Module 1: completedCount 3, pct 50. Progress: completedLessons 3, percent 25, lastLessonId 'les-photo-1-3', nextLesson 'les-photo-1-4'.")
    C(CO, F, "Bấm lần 2 là bỏ hoàn thành (toggle) và % quay lại như cũ", "Chức năng", "Cao",
      BASE + "Tiếp nối case trước: member2 vừa hoàn thành les-photo-1-3.",
      ["POST complete les-photo-1-3 lần nữa", "GET /api/courses/photo/progress"],
      "lessonId=les-photo-1-3",
      "200 { completed: false }; completedLessons 2, percent 17; bài hiển thị completed=false trong GET .../lessons.")
    C(CO, F, "Hoàn thành bài lần đầu cộng +3 điểm lesson_complete cho cộng đồng photo", "Chức năng", "Cao",
      BASE + "Đăng nhập member3 (photo, tổng điểm seed 6, chưa hoàn thành bài nào). Điểm một bài = +3 (giá trị tạm, xem points.types).",
      ["Mở tab Xếp hạng (/courses/photo/community/xep-hang) ghi điểm all-time của member3, hoặc GET /api/courses/photo/leaderboard?window=all", "POST /api/courses/photo/lessons/les-photo-1-1/complete", "Đọc lại điểm"],
      "member3, les-photo-1-1",
      "Điểm all-time của member3 ở photo tăng đúng 3 (6 -> 9). Không ảnh hưởng điểm ở cộng đồng khác.")
    C(CO, F, "Bỏ hoàn thành rồi hoàn thành lại cùng một bài không cộng điểm lần 2", "Chức năng", "Cao",
      BASE + "Tiếp nối case trước: member3 đã hoàn thành les-photo-1-1 (đã nhận +3).",
      ["POST complete les-photo-1-1 (bỏ)", "POST complete les-photo-1-1 (hoàn thành lại)", "Đọc điểm all-time của member3"],
      "member3, les-photo-1-1 (3 lần toggle)",
      "Trạng thái cuối completed true nhưng điểm vẫn 9 (chỉ cộng 1 lần cho mỗi cặp user+bài; điểm KHÔNG bị trừ khi bỏ hoàn thành).")
    C(CO, F, "5 request hoàn thành song song cùng một bài chỉ cộng điểm 1 lần", "Bảo mật", "Cao",
      BASE + "Đăng nhập member3, chọn bài chưa từng làm (les-photo-1-2); ghi điểm trước.",
      ["Promise.all 5 x POST /api/courses/photo/lessons/les-photo-1-2/complete", "Đọc điểm all-time và trạng thái bài"],
      "5 request đồng thời",
      "Tất cả 200; điểm tăng đúng +3 (INSERT ... ON CONFLICT: chỉ một request nhận firstTime). Trạng thái cuối theo số lần toggle (5 lần -> completed true). Không có 500.")
    C(CO, F, "Bỏ hoàn thành bài của module 1 khiến module 2 khóa lại (tính lại ở server)", "Chức năng", "Cao",
      BASE + "Đăng nhập member1 (module 1 xong 100%, module 2 mở). Khôi phục bằng POST complete lần nữa.",
      ["POST complete les-photo-1-6 (bỏ hoàn thành)", "GET /api/courses/photo/modules", "GET /api/courses/photo/lessons/les-photo-2-1", "POST lại complete les-photo-1-6"],
      "lessonId=les-photo-1-6",
      "Sau khi bỏ: m1 pct 83 (5/6), m2 locked true lockReason 'previous_module'; GET les-photo-2-1 -> " + LOCK + ". Sau khi hoàn thành lại: m2 mở khóa trở lại và KHÔNG cộng thêm điểm.")
    C(CO, F, "Hoàn thành hết 6 bài module 1 sẽ mở khóa module 2", "Chức năng", "Cao",
      BASE + "Đăng nhập member2 (đang 2/6). Cần dọn lại tiến độ sau test.",
      ["POST complete lần lượt les-photo-1-3 .. les-photo-1-6", "GET /api/courses/photo/modules", "GET /api/courses/photo/modules/mod-photo-2/lessons"],
      "4 bài còn lại của module 1",
      "Module 1 pct 100 (6/6); module 2 locked false, lockReason null; GET lessons của mod-photo-2 trả 200 với 6 bài (completed false). Điểm tăng +12 (4 x 3) so với trước.")
    C(CO, F, "UI trang học: nút Hoàn thành / Bỏ hoàn thành, toast và thẻ xác nhận", "Giao diện", "Cao",
      BASE + "Đăng nhập member3 (chưa xong les-photo-1-3).",
      ["Mở UI " + L + "/les-photo-1-3", "Bấm 'Hoàn thành'", "Quan sát toast, khối 'Bạn đã hoàn thành bài này', thanh tiến độ", "Bấm 'Bỏ hoàn thành'"],
      "member3, les-photo-1-3",
      "Sau khi bấm: nút đổi thành 'Bỏ hoàn thành' (có trạng thái 'Đang lưu…' ngắn), toast 'Đã hoàn thành bài học', hiện 'Bạn đã hoàn thành bài này', thanh tiến độ tăng. Bấm lại: toast 'Đã bỏ đánh dấu hoàn thành' và khối xác nhận biến mất.")
    C(CO, F, "Đánh dấu nhanh ở danh sách bài của thẻ module (checkbox tròn)", "Giao diện", "Trung bình",
      BASE + "Đăng nhập member3.",
      ["Mở " + L + " và bấm mũi tên 'Mở Chào mừng & Lộ trình'", "Bấm nút 'Đánh dấu hoàn thành: <tiêu đề bài 1>'", "Bấm biểu tượng play 'Học bài <tiêu đề>'"],
      "module mod-photo-1",
      "Checkbox đổi sang trạng thái xong (aria-label 'Bỏ hoàn thành: ...'), % module cập nhật ngay; bấm play chuyển sang trang học của bài đó.")
    C(CO, F, "Hoàn thành bài không tồn tại trả 404, không tạo tiến độ", "Chức năng", "Thấp",
      BASE + "Đăng nhập member1.",
      ["POST /api/courses/photo/lessons/khong-co/complete"],
      "lessonId=khong-co",
      "404 NOT_FOUND 'Không tìm thấy bài học'.")

    # =====================================================================================
    # D. Khóa theo module & cấp độ
    # =====================================================================================
    F = "Lớp học - Khóa module & cấp độ"
    C(CO, F, "member3 mở danh sách bài của module 2 đang khóa -> MODULE_LOCKED", "Bảo mật", "Cao",
      BASE + "Đăng nhập member3 (module 1 chưa xong).",
      ["GET /api/courses/photo/modules/mod-photo-2/lessons"],
      "moduleId=mod-photo-2",
      "403 error.code MODULE_LOCKED, message 'Module này đang bị khóa. Hãy hoàn thành module trước đó hoặc đạt đủ cấp độ yêu cầu'.")
    C(CO, F, "member2 mở chi tiết bài của module khóa (dán URL) -> MODULE_LOCKED", "Bảo mật", "Cao",
      BASE + "Đăng nhập member2.",
      ["GET /api/courses/photo/lessons/les-photo-2-1", "Mở UI " + L + "/les-photo-2-1"],
      "lessonId=les-photo-2-1",
      "API: " + LOCK + ". UI: màn 'Module này đang bị khóa' + 'Hoàn thành module trước đó (hoặc đạt đủ cấp độ yêu cầu) để mở khóa bài học này.' + nút 'Về danh sách lớp học'.")
    C(CO, F, "Không đánh dấu hoàn thành được bài của module khóa (không tin FE)", "Bảo mật", "Cao",
      BASE + "Đăng nhập member3.",
      ["POST /api/courses/photo/lessons/les-photo-2-1/complete", "GET /api/courses/photo/progress"],
      "lessonId=les-photo-2-1",
      LOCK + "; completedLessons/điểm của member3 không đổi.")
    C(CO, F, "Khóa theo cấp độ ở yt: module 2 requiredLevel=2, lockReason 'level'", "Chức năng", "Cao",
      BASE + "Đăng nhập member1. Seed yt: member1 xong toàn bộ module 1 (5 bài); module 2 (mod-yt-2) requiredLevel 2 (cần >= 20 điểm ở yt); member1 chưa có điểm ở yt (giả định 0 điểm - kiểm tra trước).",
      ["GET /api/courses/yt/modules", "Mở UI /courses/yt/community/lop-hoc"],
      "courseId=yt",
      "m1: pct 100, locked false. m2 (mod-yt-2): locked true, requiredLevel 2, lockReason 'level' (module trước đã xong nên là khóa cấp độ). m3: locked true, lockReason 'previous_module'. UI thẻ module 2 hiện 'Cần đạt Cấp độ 2'.")
    C(CO, F, "Mở bài của module khóa theo cấp độ -> MODULE_LOCKED", "Bảo mật", "Cao",
      BASE + "Đăng nhập member1 (yt, 0 điểm).",
      ["GET /api/courses/yt/modules/mod-yt-2/lessons", "GET /api/courses/yt/lessons/les-yt-2-1", "POST /api/courses/yt/lessons/les-yt-2-1/complete"],
      "mod-yt-2 / les-yt-2-1",
      "Cả 3 trả " + LOCK + ". UI dán URL bài trả màn 'Module này đang bị khóa'.")
    C(CO, F, "Biên cấp độ: 15 điểm (3 bài đăng) vẫn khóa, đủ 20 điểm mở khóa module 2 yt", "Chức năng", "Cao",
      BASE + "Đăng nhập member1; điểm yt của member1 = 0 (kiểm tra). Ngưỡng cấp 2 = 20 điểm (giá trị tạm, points.levels), mỗi bài đăng +5.",
      ["Đăng 3 bài ở yt (POST /api/courses/yt/posts) -> 15 điểm; GET /api/courses/yt/modules", "Đăng bài thứ 4 -> 20 điểm; GET lại modules", "GET /api/courses/yt/modules/mod-yt-2/lessons"],
      "4 bài đăng, mỗi bài +5",
      "Sau 3 bài (15 điểm): m2 locked true lockReason 'level'. Sau bài thứ 4 (20 điểm = cấp 2): m2 locked false, lockReason null, GET lessons 200 với 5 bài; m3 vẫn locked 'previous_module' vì m2 chưa xong. Ghi chú: điểm đăng bài có thể bị giới hạn bởi quy tắc khác của FEED; nếu chưa đủ dùng bài viết/like khác.")
    C(CO, F, "Thứ tự ưu tiên lockReason khi vừa chưa xong module trước vừa thiếu cấp độ", "Chức năng", "Trung bình",
      BASE + "Mod tạo module 3 photo với requiredLevel 4 (cần >= 120 điểm) ngay sau module 2; member1 photo có 110 điểm (cấp 3) và module 2 chưa xong.",
      ["mod: POST /api/courses/photo/modules {title:'Cấp 4', description:'x', requiredLevel:4}", "member1: GET /api/courses/photo/modules", "Xóa module thử"],
      "requiredLevel=4",
      "Module 3: locked true, requiredLevel 4, lockReason 'previous_module' (ưu tiên khóa thứ tự hơn khóa cấp độ).")
    C(CO, F, "Mod/admin/owner/platform admin không bao giờ bị khóa module", "Chức năng", "Cao",
      BASE + "Đăng nhập lần lượt mod, cadmin, owner (photo). Module 2 photo đang khóa với member3.",
      ["Mỗi vai trò gọi GET /api/courses/photo/modules", "GET /api/courses/photo/modules/mod-photo-2/lessons", "GET /api/courses/photo/lessons/les-photo-2-1"],
      "mod, cadmin, owner",
      "Cả 3: module 2 locked false, lockReason null; GET lessons 200 (6 bài); chi tiết bài 200. Chuỗi khóa của member3 không đổi (vẫn locked).")
    C(CO, F, "Platform admin chưa tham gia photo: đọc và ghi lớp học đều được (requireMembership cho qua)", "Bảo mật", "Trung bình",
      BASE + "Đăng nhập admin@sofinhub.test (Platform Admin, không ghi danh ở photo).",
      ["GET /api/courses/photo/modules", "POST /api/courses/photo/modules {title:'PA', description:'x'}", "Xóa module vừa tạo nếu thành công"],
      "admin@sofinhub.test",
      "GET modules: 200 (đã sửa: requireMembership cho qua Platform Admin dù chưa ghi danh; trước đây 403 'Bạn cần tham gia cộng đồng này trước', lệch với ghi được). POST modules: 201 (requireRole coi platform_admin >= mod). Đọc và ghi nhất quán.")
    C(CO, F, "Mod hạ requiredLevel về null mở khóa cấp độ ngay lập tức", "Chức năng", "Trung bình",
      BASE + "Owner sửa mod-yt-2; member1 đang bị khóa cấp độ ở yt (0 điểm). Khôi phục requiredLevel=2 sau test.",
      ["owner: PATCH /api/courses/yt/modules/mod-yt-2 {requiredLevel:null}", "member1: GET /api/courses/yt/modules"],
      "requiredLevel=null",
      "PATCH 200 (module không còn requiredLevel). member1: mod-yt-2 locked false, lockReason null (vì module 1 đã xong), không còn trường requiredLevel.")

    # =====================================================================================
    # E. Trình soạn (mod+)
    # =====================================================================================
    F = "Lớp học - Trình soạn (mod+)"
    C(CO, F, "Mod tạo module mới: 201, index tự tăng, description bắt buộc", "Chức năng", "Cao",
      BASE + "Đăng nhập mod@sofinhub.test. Photo có 2 module.",
      ["POST /api/courses/photo/modules {title:'  Module thử  ', description:'Mô tả thử'}", "GET /api/courses/photo/modules"],
      "title có khoảng trắng hai đầu",
      "201 { data: { id, index: 3, title: 'Module thử' (đã trim), description: 'Mô tả thử' } }. Module mới nằm cuối danh sách, lessonsCount 0.")
    C(CO, F, "Tạo module với ảnh bìa và cấp độ yêu cầu hợp lệ", "Chức năng", "Trung bình",
      BASE + "Đăng nhập mod.",
      ["POST /api/courses/photo/modules {title:'Có bìa', description:'x', thumbnail:'https://example.com/a.jpg', requiredLevel:3}", "GET modules bằng member1"],
      "thumbnail https, requiredLevel=3",
      "201; GET trả thumbnail 'https://example.com/a.jpg' và requiredLevel 3 cho module mới.")
    C(CO, F, "Validate title module: rỗng, chỉ khoảng trắng, 201 ký tự, đúng 200 ký tự", "Chức năng", "Cao",
      BASE + "Đăng nhập mod.",
      ["POST modules với 4 giá trị title ở Dữ liệu test (description:'x')"],
      "title='' ; '     ' ; 'a' x 201 ; 'a' x 200",
      "3 giá trị đầu " + VAL + " (title: 'Vui lòng nhập tiêu đề' cho rỗng/khoảng trắng; 'Tiêu đề tối đa 200 ký tự' cho 201 ký tự); 200 ký tự trả 201.")
    C(CO, F, "Validate description module: thiếu trường và quá 1000 ký tự", "Chức năng", "Trung bình",
      BASE + "Đăng nhập mod.",
      ["POST modules {title:'A'} (thiếu description)", "POST modules {title:'A', description:'d' x 1001}", "POST modules {title:'A', description:''}"],
      "3 payload",
      "Payload 1 và 2: " + VAL + " ('Mô tả tối đa 1000 ký tự' cho 1001 ký tự). Payload 3 (chuỗi rỗng): 201 vì description chỉ cần là chuỗi.")
    C(CO, F, "Validate requiredLevel: 0, 10, 1.5, '3' không hợp lệ; 1 và 9 hợp lệ", "Chức năng", "Trung bình",
      BASE + "Đăng nhập mod.",
      ["POST modules với requiredLevel lần lượt 0, 10, 1.5, '3', 1, 9"],
      "title='L', description='x'",
      "0/10/'3'/1.5 trả " + VAL + " ('Cấp độ từ 1 đến 9' / 'Cấp độ phải là số nguyên'); 1 và 9 trả 201.")
    C(CO, F, "Chặn thumbnail javascript:/data:/ftp: (chống XSS)", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod.",
      ["POST modules với thumbnail lần lượt ở Dữ liệu test", "PATCH module hợp lệ với cùng giá trị"],
      "javascript:alert(1) ; data:text/html,<script>alert(1)</script> ; ftp://x.com/a.png ; https://x.com/ + 'a' x 1000",
      "Cả 4: " + VAL + " thông điệp 'Đường dẫn phải bắt đầu bằng http:// hoặc https://' (hoặc 'Đường dẫn quá dài' cho >1000 ký tự); không lưu.")
    C(CO, F, "Sửa module: đổi tiêu đề, xóa thumbnail và requiredLevel bằng null", "Chức năng", "Cao",
      BASE + "Module thử có thumbnail và requiredLevel 3 (case trước).",
      ["PATCH /api/courses/photo/modules/{id} {title:'Đã sửa'}", "PATCH {thumbnail:null, requiredLevel:null}", "GET modules"],
      "3 lần patch",
      "Lần 1: 200 title 'Đã sửa', thumbnail/requiredLevel giữ nguyên. Lần 2: 200, module không còn thumbnail và requiredLevel. Các module khác không đổi.")
    C(CO, F, "PATCH module với body rỗng {} bị từ chối", "Chức năng", "Thấp",
      BASE + "Đăng nhập mod.",
      ["PATCH /api/courses/photo/modules/mod-photo-1 {}"],
      "body {}",
      VAL + " với thông điệp 'Không có trường nào để cập nhật'.")
    C(CO, F, "Xóa module đã có tiến độ: xóa cả bài học và tiến độ, đánh lại index", "Chức năng", "Cao",
      BASE + "Đăng nhập mod, tạo module thử X (index 3) có 2 bài; member2 hoàn thành 1 bài trong X (+3 điểm).",
      ["mod: DELETE /api/courses/photo/modules/{X}", "member2: GET /api/courses/photo/progress", "GET lesson đã xóa", "GET /api/courses/photo/modules"],
      "module X có 2 bài, 1 bài đã hoàn thành",
      "DELETE 200 { data: { deleted: true } }. totalLessons trở lại 12 (photo), completedLessons của member2 không còn tính bài đã xóa (2), GET bài đã xóa -> 404 'Không tìm thấy bài học'. Điểm +3 đã nhận KHÔNG bị trừ lại (theo tài liệu). Các module còn lại giữ index 1, 2.")
    C(CO, F, "Xóa module đầu tiên: index đánh lại, module sau trở thành module đầu và không còn bị khóa", "Chức năng", "Trung bình",
      BASE + "Khóa thử của owner (KHÔNG dùng photo thật) có 3 module A, B, C; member3 chưa học. Chỉ chạy trên khóa thử vì xóa không hoàn tác được.",
      ["mod: tạo module thử; DELETE module có index thấp nhất của một khóa thử (không dùng photo thật)", "member: GET modules sau xóa"],
      "khóa thử của owner",
      "Index được đánh lại liên tục 1..n; module mới đứng đầu không bị khóa 'previous_module'; module ngay sau nó bị khóa nếu module đầu chưa xong.")
    C(CO, F, "Sắp xếp lại module: hoán vị hợp lệ trả danh sách mới với index đánh lại", "Chức năng", "Cao",
      BASE + "Đăng nhập mod; photo có mod-photo-1, mod-photo-2 và module thử X.",
      ["PUT /api/courses/photo/modules/order {ids:[X, mod-photo-1, mod-photo-2]}", "GET modules bằng member2", "Trả thứ tự về ban đầu"],
      "ids đủ 3 module",
      "200 { data: [X(index 1), mod-photo-1(index 2), mod-photo-2(index 3)] }. member2 thấy module X đầu tiên và chuỗi khóa tính lại theo thứ tự mới (mod-photo-1 bị khóa vì X chưa xong).")
    C(CO, F, "Sắp xếp module không hợp lệ: thiếu, trùng, lạ, rỗng, quá 500 phần tử", "Chức năng", "Cao",
      BASE + "Đăng nhập mod; photo có mod-photo-1, mod-photo-2.",
      ["PUT modules/order {ids:['mod-photo-1']}", "{ids:['mod-photo-1','mod-photo-1']}", "{ids:['mod-photo-1','mod-photo-2','mod-yt-1']}", "{ids:[]}", "{ids: 501 chuỗi}", "{} (thiếu ids)"],
      "6 payload",
      "Payload 1-4: 400 BAD_REQUEST 'Danh sách sắp xếp phải gồm đủ và đúng các mục hiện có, không trùng lặp'. Payload 5-6: " + VAL + ". Thứ tự module không đổi. (Lưu ý: PUT /modules/order không bị hiểu là moduleId='order'.)")
    C(CO, F, "Mod tạo bài học mới: append cuối module, chọn loại text/file, thời lượng biên", "Chức năng", "Cao",
      BASE + "Đăng nhập mod; module thử X (0 bài).",
      ["POST /api/courses/photo/modules/{X}/lessons {title:'Bài A', type:'text', durationMin:0, body:'Nội dung'}", "POST {title:'Bài B', type:'file', durationMin:1000, body:''}", "GET .../modules/{X}/lessons"],
      "durationMin 0 và 1000; body '' hợp lệ",
      "Cả 2 trả 201; index 1 và 2; type 'text' và 'file'; attachments [] mặc định; không có videoUrl/embedUrl.")
    C(CO, F, "Validate bài học: type sai, durationMin ngoài biên hoặc không nguyên, thiếu body", "Chức năng", "Cao",
      BASE + "Đăng nhập mod; module thử X.",
      ["POST lessons với từng payload ở Dữ liệu test"],
      "a) type:'audio' b) durationMin:-1 c) durationMin:1001 d) durationMin:1.5 e) thiếu body f) title:'' g) body 50001 ký tự",
      "Cả 7 " + VAL + " (durationMin: 'Thời lượng phải là số nguyên'; body: 'Nội dung tối đa 50.000 ký tự'; title: 'Vui lòng nhập tiêu đề'). Body đúng 50000 ký tự hợp lệ (201).")
    C(CO, F, "Tệp đính kèm bài học: tối đa 20, URL http(s), tên bắt buộc", "Chức năng", "Trung bình",
      BASE + "Đăng nhập mod; module thử X.",
      ["POST lesson attachments 20 mục hợp lệ", "POST attachments 21 mục", "POST attachment {name:'', url:'https://a.com/x'}", "POST attachment {name:'a', url:'ftp://a.com/x'}", "POST attachment {name:'a', url:'https://a.com/x', size:-1}"],
      "attachments các cấu hình trên",
      "20 mục: 201. 21 mục: " + VAL + " ('Tối đa 20 tệp đính kèm'). Tên rỗng: 'Tên tệp không được trống'. Url ftp: 'Đường dẫn phải bắt đầu bằng http:// hoặc https://'. size âm: lỗi validate.")
    C(CO, F, "Sửa bài học: đổi loại, xóa videoUrl bằng null, embedUrl bị xóa theo", "Chức năng", "Trung bình",
      BASE + "Bài thử có videoUrl YouTube hợp lệ.",
      ["PATCH /api/courses/photo/lessons/{id} {videoUrl:null}", "GET chi tiết bài bằng member", "PATCH {type:'text', title:'Đổi tên'}", "PATCH {} "],
      "videoUrl:null",
      "Lần 1: 200, bài không còn videoUrl/embedUrl. Lần 3: 200 type 'text'. Lần 4: " + VAL + " 'Không có trường nào để cập nhật'.")
    C(CO, F, "Thêm bài mới vào module đã hoàn thành làm tụt % và khóa lại module sau", "Chức năng", "Cao",
      BASE + "member1 xong module 1 photo (6/6) và module 2 đang mở. Mod thêm 1 bài vào mod-photo-1; dọn bằng DELETE bài đó.",
      ["mod: POST /api/courses/photo/modules/mod-photo-1/lessons {title:'Bài bổ sung', type:'text', durationMin:5, body:'x'}", "member1: GET /api/courses/photo/modules", "member1: GET /api/courses/photo/progress", "mod: DELETE bài vừa tạo; member1 kiểm tra lại"],
      "1 bài bổ sung",
      "Sau khi thêm: m1 completedCount 6, lessonsCount 7, pct 86; m2 locked true 'previous_module'; progress percent 46 (6/13), completedModules 0, nextLesson là bài bổ sung. Sau khi xóa bài: trở lại 100% và module 2 mở lại.")
    C(CO, F, "Xóa bài học: xóa tiến độ liên quan, đánh lại index, không hoàn điểm", "Chức năng", "Cao",
      BASE + "Module thử X có 3 bài; member2 hoàn thành bài 2 (nhận +3).",
      ["mod: DELETE /api/courses/photo/lessons/{bài 2}", "GET .../modules/{X}/lessons", "member2: GET progress và điểm"],
      "xóa bài index 2",
      "DELETE 200 { deleted: true }. Còn 2 bài với index 1, 2 (bài cũ số 3 thành index 2). Tiến độ của member2 không còn tính bài đã xóa; điểm giữ nguyên (không thu hồi).")
    C(CO, F, "Sắp xếp lại bài học trong module: hợp lệ và không hợp lệ", "Chức năng", "Cao",
      BASE + "Đăng nhập mod; module thử X có 3 bài a, b, c.",
      ["PUT /api/courses/photo/modules/{X}/lessons/order {ids:[c,a,b]}", "PUT {ids:[a,b]}", "PUT {ids:[a,b,les-photo-1-1]} (bài của module khác)", "GET danh sách bài"],
      "ids hoán vị",
      "Lần 1: 200 trả danh sách bài mới thứ tự c,a,b index 1..3. Lần 2 và 3: 400 BAD_REQUEST 'Danh sách sắp xếp phải gồm đủ và đúng các mục hiện có, không trùng lặp'. Prev/next của bài học đổi theo thứ tự mới.")
    C(CO, F, "Ma trận vai trò x thao tác soạn thảo: tạo module", "Bảo mật", "Cao",
      BASE + "Tài khoản: (khách), newbie (chưa ở photo), banned (bị ban photo), member2 (member), mod, cadmin, owner, admin (Platform Admin). Photo.",
      ["Mỗi vai trò gửi POST /api/courses/photo/modules {title:'Ma trận', description:'x'}", "Xóa module tạo được"],
      "8 vai trò",
      "Khách: 401 'Vui lòng đăng nhập để tiếp tục'. newbie, banned, member2: " + NOPERM + ". mod, cadmin, owner, admin: 201.")
    C(CO, F, "Member thường bị 403 ở cả 8 endpoint soạn thảo, dữ liệu không đổi", "Bảo mật", "Cao",
      BASE + "Đăng nhập member2. Ghi lại GET modules trước test.",
      ["POST /api/courses/photo/modules", "PATCH /modules/mod-photo-1 {title:'H'}", "DELETE /modules/mod-photo-1", "PUT /modules/order", "POST /modules/mod-photo-1/lessons", "PATCH /lessons/les-photo-1-1 {title:'H'}", "DELETE /lessons/les-photo-1-1", "PUT /modules/mod-photo-1/lessons/order", "So sánh GET modules"],
      "hợp lệ về mặt body",
      "Cả 8 trả " + NOPERM + " (kiểm tra quyền chạy trước validate/đọc dữ liệu). Nội dung lớp học không thay đổi.")
    C(CO, F, "Mod của photo không sửa được nội dung lớp học của yt (IDOR giữa cộng đồng)", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod@sofinhub.test (mod photo, KHÔNG là thành viên yt). Module mod-yt-1, bài les-yt-1-1 thuộc yt.",
      ["PATCH /api/courses/yt/modules/mod-yt-1 {title:'Hack'}", "DELETE /api/courses/yt/lessons/les-yt-1-1", "POST /api/courses/yt/modules {title:'H', description:'x'}", "PUT /api/courses/yt/modules/order {ids:[]}"],
      "courseId=yt",
      "Cả 4: " + NOPERM + " (vai trò được tính theo TỪNG cộng đồng). Dữ liệu yt không đổi.")
    C(CO, F, "Trộn id: mod photo dùng id module/bài của yt qua URL photo trả 404", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod (mod photo, có quyền ở photo).",
      ["PATCH /api/courses/photo/modules/mod-yt-1 {title:'H'}", "DELETE /api/courses/photo/modules/mod-yt-1", "POST /api/courses/photo/modules/mod-yt-1/lessons {...hợp lệ}", "PATCH /api/courses/photo/lessons/les-yt-1-1 {title:'H'}", "PUT /api/courses/photo/modules/mod-yt-1/lessons/order {ids:['les-yt-1-1']}"],
      "id thuộc yt qua courseId=photo",
      "Cả 5: 404 NOT_FOUND ('Không tìm thấy module' / 'Không tìm thấy bài học'); nội dung yt không đổi.")
    C(CO, F, "Khóa học không tồn tại khi soạn thảo trả 404", "Chức năng", "Thấp",
      BASE + "Đăng nhập owner.",
      ["POST /api/courses/khong-co/modules {title:'A', description:'x'}", "GET /api/courses/khong-co/modules"],
      "courseId=khong-co",
      "Cả 2: 404 NOT_FOUND 'Không tìm thấy khóa học'.")
    C(CO, F, "UI: Member không thấy nút 'Chỉnh sửa lớp học'; mod thấy", "Giao diện", "Cao",
      BASE + "Hai phiên: member2 và mod.",
      ["member2 mở " + L + " - tìm nút 'Chỉnh sửa lớp học'", "mod mở " + L, "mod bấm 'Chỉnh sửa lớp học'", "mod bấm 'Thoát chỉnh sửa'"],
      "member2 và mod",
      "member2: không có nút. mod: có nút, mở panel 'Chỉnh sửa lớp học' (danh sách module có nút lên/xuống/sửa/xóa, 'Thêm module', 'Thêm bài học') và dòng ghi chú 'Mod trở lên không bị khóa module khi xem để duyệt nội dung...'. Nút đổi thành 'Thoát chỉnh sửa'.")
    C(CO, F, "UI: thêm module qua hộp thoại 'Thêm module' và lỗi từ API hiển thị", "Giao diện", "Cao",
      BASE + "Đăng nhập mod, đang ở chế độ chỉnh sửa.",
      ["Bấm 'Thêm module'", "Bấm 'Lưu' khi tên rỗng", "Nhập tên 'UI thử', mô tả 'mô tả', chọn 'Cấp độ tối thiểu để mở khóa' = Cấp độ 2, ảnh bìa 'javascript:alert(1)' -> Lưu", "Sửa ảnh bìa thành https://example.com/a.jpg -> Lưu"],
      "tên 'UI thử'",
      "Tên rỗng hoặc ảnh bìa javascript: hiển thị lỗi từ API và không đóng hộp thoại. Lưu thành công: toast 'Đã tạo module', module xuất hiện cuối danh sách với chú thích 'Yêu cầu Cấp độ 2'.")
    C(CO, F, "UI: thêm bài học có kiểm tra thời lượng phía FE", "Giao diện", "Trung bình",
      BASE + "Đăng nhập mod, chế độ chỉnh sửa, mở module thử bằng mũi tên 'Mở danh sách bài học'.",
      ["Bấm 'Thêm bài học'", "Nhập tiêu đề, thời lượng 1001 -> Lưu", "Đổi thời lượng 45, loại 'Video', link 'https://evil.com/v' -> Lưu", "Đổi link 'https://youtu.be/dQw4w9WgXcQ' -> Lưu"],
      "thời lượng 1001 rồi 45",
      "Thời lượng 1001: hiện 'Thời lượng phải là số nguyên từ 0 đến 1000 phút', không gọi API. Link evil.com: lỗi từ API 'Chỉ chấp nhận link video YouTube hoặc Vimeo hợp lệ'. Link YouTube: toast 'Đã tạo bài học', bài xuất hiện với '45 phút'.")
    C(CO, F, "UI: xóa module/bài hiện hộp xác nhận nêu rõ hậu quả", "Giao diện", "Trung bình",
      BASE + "Đăng nhập mod, module thử có 2 bài.",
      ["Bấm 'Xóa module' -> đọc nội dung hộp thoại -> Hủy", "Bấm 'Xóa bài học' trên 1 bài -> đọc nội dung", "Xác nhận 'Xóa bài học', sau đó 'Xóa module'"],
      "module thử có 2 bài",
      "Hộp 'Xóa module?' nội dung 'Module \"<tên>\" cùng 2 bài học và tiến độ liên quan sẽ bị xóa vĩnh viễn.'; hộp 'Xóa bài học?' nội dung 'Bài học \"<tên>\" và tiến độ liên quan của học viên sẽ bị xóa.'. Hủy thì không xóa. Xác nhận: toast 'Đã xóa bài học' / 'Đã xóa module'.")
    C(CO, F, "UI: nút lên/xuống đổi thứ tự module và bài; nút đầu/cuối bị vô hiệu", "Giao diện", "Trung bình",
      BASE + "Đăng nhập mod, có ít nhất 3 module thử.",
      ["Bấm 'Đưa module xuống' ở module đầu", "Tải lại trang, kiểm tra thứ tự được giữ", "Kiểm tra 'Đưa module lên' của module đầu và 'Đưa module xuống' của module cuối", "Lặp lại với 'Đưa bài học lên/xuống'"],
      "3 module thử",
      "Thứ tự đổi ngay và giữ nguyên sau khi tải lại (đã lưu ở server, PUT order). Nút lên của phần tử đầu và nút xuống của phần tử cuối bị disabled. Không có kéo-thả (giới hạn hiện tại).")

    # =====================================================================================
    # F. Truy cập theo tư cách
    # =====================================================================================
    F = "Lớp học - Quyền truy cập"
    C(CO, F, "Khách chưa đăng nhập gọi mọi API học tập -> 401", "Bảo mật", "Cao",
      BASE + "Không gửi token.",
      ["GET /api/courses/photo/modules", "GET .../modules/mod-photo-1/lessons", "GET .../lessons/les-photo-1-1", "POST .../lessons/les-photo-1-1/complete", "GET .../progress", "GET .../classroom-settings"],
      "không có Authorization",
      "Cả 6: 401 UNAUTHORIZED 'Vui lòng đăng nhập để tiếp tục'.")
    C(CO, F, "newbie (chưa tham gia photo) bị 403 ở mọi API đọc/học", "Bảo mật", "Cao",
      BASE + "Đăng nhập newbie@sofinhub.test (chưa ở cộng đồng nào).",
      ["Gọi 6 API đọc/học như case khách (modules, lessons, lesson, complete, progress, classroom-settings) với photo"],
      "newbie",
      "Cả 6: 403 FORBIDDEN 'Bạn cần tham gia cộng đồng này trước'; không tạo LessonProgress.")
    C(CO, F, "banned bị 403 ở lớp học photo", "Bảo mật", "Cao",
      BASE + "Đăng nhập banned@sofinhub.test (bị ban khỏi photo).",
      ["GET /api/courses/photo/modules", "POST /api/courses/photo/lessons/les-photo-1-1/complete", "Mở UI " + L],
      "banned",
      "API: 403 FORBIDDEN 'Bạn cần tham gia cộng đồng này trước'. UI: không vào được lớp học (bị chặn/chuyển hướng như cộng đồng cấm).")
    C(CO, F, "member2 không xem được lớp học yt (chỉ thuộc photo)", "Bảo mật", "Trung bình",
      BASE + "Đăng nhập member2 (chỉ thuộc photo).",
      ["GET /api/courses/yt/modules", "GET /api/courses/yt/lessons/les-yt-1-1", "GET /api/courses/yt/progress"],
      "courseId=yt",
      "Cả 3: 403 FORBIDDEN 'Bạn cần tham gia cộng đồng này trước'.")
    C(CO, F, "Cộng đồng bị khóa: học viên bị COMMUNITY_LOCKED, Platform Admin vẫn qua", "Bảo mật", "Trung bình",
      BASE + "Platform Admin khóa cộng đồng photo qua chức năng khóa của Admin (xem ADMIN); member2 là thành viên photo. Mở khóa sau test.",
      ["admin khóa photo", "member2: GET /api/courses/photo/modules", "admin (chưa ghi danh): GET /api/courses/photo/modules", "admin mở khóa lại"],
      "photo bị khóa",
      "member2: 403 COMMUNITY_LOCKED 'Cộng đồng này đang bị khóa'. admin: 200 (Platform Admin qua cả kiểm khóa lẫn kiểm ghi danh). Sau khi mở khóa: 200 lại bình thường.")

    # =====================================================================================
    # G. XSS trong nội dung bài học
    # =====================================================================================
    F = "Lớp học - Bảo mật nội dung"
    C(CO, F, "XSS trong body bài học được hiển thị dạng văn bản thuần", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod, tạo bài text với body chứa mã độc; mở bằng member1 (bắt sự kiện dialog/console bằng Playwright).",
      ["POST lesson {title:'XSS', type:'text', durationMin:1, body:'<script>window.__x=1</script><img src=x onerror=\"window.__x=2\"><b>đậm</b>'}", "member1 mở " + L + "/{lessonId}", "Kiểm tra window.__x và DOM"],
      "body chứa <script>, <img onerror>, <b>",
      "API lưu nguyên chuỗi. UI hiển thị các thẻ dưới dạng văn bản (thấy chữ '<script>...'), KHÔNG chạy script, window.__x undefined, không có thẻ <img>/<b> thật trong vùng nội dung, không có hộp thoại.")
    C(CO, F, "XSS trong tiêu đề module/bài học và tên tệp đính kèm", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod tạo module title '<img src=x onerror=alert(1)>' và bài có title '\"><svg onload=alert(1)>', attachment name '<b>x</b>'.",
      ["Tạo module/bài/tệp với các chuỗi trên", "member1 mở " + L + ", mở module, mở bài", "Mod mở chế độ chỉnh sửa"],
      "3 chuỗi độc hại",
      "Ở danh sách, trang học, sidebar và trình soạn: hiển thị đúng dạng chữ, không thực thi, không bung hộp thoại alert; breadcrumb/aria-label không bị phá vỡ.")
    C(CO, F, "Link tải đính kèm javascript:/data: bị API chặn ngay từ đầu", "Bảo mật", "Cao",
      BASE + "Đăng nhập mod.",
      ["POST lesson attachments:[{name:'x', url:'javascript:alert(1)'}]", "POST attachments:[{name:'x', url:'data:text/html;base64,PHNjcmlwdD4='}]", "PATCH lesson với url tương tự"],
      "2 URL độc hại",
      "Cả 3: " + VAL + " ('Đường dẫn phải bắt đầu bằng http:// hoặc https://'); bài không được lưu/cập nhật.")
    C(CO, F, "Body bài học đúng 50000 ký tự hiển thị được, không vỡ layout", "Hiệu năng", "Thấp",
      BASE + "Đăng nhập mod tạo bài với body 'A ' lặp đến đúng 50000 ký tự; mở bằng member1.",
      ["POST lesson body 50000 ký tự", "member1 mở trang bài học", "Kéo cuộn và bấm 'Bài sau'"],
      "body 50000 ký tự",
      "201; trang tải trong thời gian hợp lý, không tràn ngang, các nút Hoàn thành/Bài trước/Bài sau vẫn dùng được.", pw="Một phần")

    # =====================================================================================
    # H. Responsive / phiên
    # =====================================================================================
    F = "Lớp học - Giao diện chung"
    C(CO, F, "Trang học hiển thị đúng ở màn hình điện thoại (375px)", "Giao diện", "Thấp",
      BASE + "Đăng nhập member1; viewport 375x812.",
      ["Mở " + L + "/les-photo-2-1", "Kiểm tra không có cuộn ngang, khung video giữ tỉ lệ 16:9, nút Hoàn thành/Bài trước/Bài sau bấm được", "Mở " + L + " kiểm tra thẻ module"],
      "viewport 375x812",
      "Không tràn ngang; khung video co theo chiều rộng; danh sách bài chuyển xuống dưới nội dung; thẻ module xếp 1 cột.", pw="Một phần")
    C(CO, F, "Hết hạn token giữa chừng khi hoàn thành bài: chuyển về đăng nhập", "Chức năng", "Thấp",
      BASE + "Đăng nhập member2, đang ở trang bài học; xóa/hủy hiệu lực token (đăng xuất ở tab khác).",
      ["Ở tab 1 mở " + L + "/les-photo-1-3", "Ở tab 2 đăng xuất mọi thiết bị", "Tab 1 bấm 'Hoàn thành'"],
      "token bị thu hồi",
      "API 401 UNAUTHORIZED; UI không báo hoàn thành giả, chuyển về trang đăng nhập hoặc báo phiên hết hạn; không có LessonProgress mới.", pw="Một phần")
    C(CO, F, "Ghi chú: dữ liệu lớp học nằm trong DB (tài liệu classroom.md còn ghi 'trong bộ nhớ')", "Tích hợp", "Thấp",
      BASE + "Có quyền chạy lại server (Test 2 - thủ công).",
      ["member2 hoàn thành 1 bài; mod tạo module thử", "Khởi động lại BE (npm run dev)", "Kiểm tra tiến độ và module còn nguyên"],
      "restart BE",
      "Tiến độ, module, cài đặt chứng nhận và chứng nhận còn nguyên sau restart vì repository là Prisma/Postgres (tài liệu backend/docs/api/classroom.md mục 'Giới hạn hiện tại' đã lỗi thời).", pw="Không")

    # =====================================================================================
    # CERT
    # =====================================================================================
    F = "Chứng nhận - Bật/tắt (admin+)"
    C(CE, F, "Trạng thái chứng nhận mặc định: photo & fin đã bật, yt tắt", "Chức năng", "Cao",
      BASE + "Đăng nhập member1 (photo, yt, fin).",
      ["GET /api/courses/photo/classroom-settings", "GET /api/courses/fin/classroom-settings", "GET /api/courses/yt/classroom-settings"],
      "3 cộng đồng",
      "200 { certificatesEnabled: true } cho photo và fin; yt: { certificatesEnabled: false } (chưa có bản ghi thì mặc định tắt).")
    C(CE, F, "Admin cộng đồng tắt chứng nhận: cả GET settings và UI học viên phản ánh", "Chức năng", "Cao",
      BASE + "cadmin@sofinhub.test (admin photo). Bật lại sau test.",
      ["PATCH /api/courses/photo/classroom-settings {certificatesEnabled:false}", "member1: GET classroom-settings", "cadmin: PATCH {certificatesEnabled:true}"],
      "certificatesEnabled false rồi true",
      "PATCH 200 { certificatesEnabled: false }; member1 đọc thấy false; sau khi bật lại thấy true.")
    C(CE, F, "Owner và Platform Admin cũng đổi được cài đặt chứng nhận", "Chức năng", "Trung bình",
      BASE + "owner@sofinhub.test và admin@sofinhub.test (Platform Admin, không ghi danh). Photo đang bật.",
      ["owner: PATCH /api/courses/photo/classroom-settings {certificatesEnabled:false}", "admin: PATCH {certificatesEnabled:true}"],
      "2 vai trò",
      "Cả 2: 200 (owner >= admin; platform_admin ghi đè). Trạng thái cuối = true.")
    C(CE, F, "Mod, member, khách, newbie, banned không đổi được cài đặt chứng nhận", "Bảo mật", "Cao",
      BASE + "Tài khoản mod, member2, (khách), newbie, banned.",
      ["Mỗi vai trò gửi PATCH /api/courses/photo/classroom-settings {certificatesEnabled:false}", "Kiểm tra lại GET settings"],
      "5 vai trò",
      "Khách: 401 'Vui lòng đăng nhập để tiếp tục'. mod, member2, newbie, banned: " + NOPERM + ". Cài đặt vẫn true.")
    C(CE, F, "Validate PATCH classroom-settings: kiểu dữ liệu sai", "Chức năng", "Trung bình",
      BASE + "Đăng nhập owner.",
      ["PATCH với body {}", "{certificatesEnabled:'yes'}", "{certificatesEnabled:1}", "{certificatesEnabled:null}"],
      "4 payload",
      "Cả 4: " + VAL + "; cài đặt không đổi.")
    C(CE, F, "Xem cài đặt chứng nhận cần là thành viên", "Bảo mật", "Trung bình",
      BASE + "Đăng nhập newbie và khách.",
      ["newbie: GET /api/courses/photo/classroom-settings", "khách: GET cùng URL"],
      "photo",
      "newbie: 403 'Bạn cần tham gia cộng đồng này trước'; khách: 401.")
    C(CE, F, "UI: ô 'Cấp chứng nhận khi hoàn thành 100%' chỉ admin trở lên nhìn thấy", "Giao diện", "Cao",
      BASE + "Hai phiên: mod (không thấy) và cadmin (thấy); trong chế độ 'Chỉnh sửa lớp học' của photo.",
      ["mod: mở " + L + " -> 'Chỉnh sửa lớp học' -> tìm hộp tích", "cadmin: cùng thao tác -> bỏ tích", "cadmin: tích lại"],
      "photo, mod vs cadmin",
      "mod: không có hộp tích. cadmin: có hộp tích; bỏ tích hiển thị toast 'Đã tắt chứng nhận hoàn thành', tích lại 'Đã bật chứng nhận hoàn thành'.")

    F = "Chứng nhận - Điều kiện cấp & nhận"
    C(CE, F, "Chưa đủ 100% -> không nhận được chứng nhận (403)", "Chức năng", "Cao",
      BASE + "Đăng nhập member1: photo mới 50% (6/12), cộng đồng đã bật chứng nhận.",
      ["GET /api/courses/photo/certificate"],
      "photo",
      "403 FORBIDDEN 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận'. Không tạo bản ghi chứng nhận.")
    C(CE, F, "Cộng đồng chưa bật chứng nhận: 403 dù đã học đủ", "Chức năng", "Cao",
      BASE + "Owner tắt chứng nhận ở fin; member1 đã xong 100% fin. Bật lại sau test.",
      ["owner: PATCH /api/courses/fin/classroom-settings {certificatesEnabled:false}", "member1: GET /api/courses/fin/certificate"],
      "fin",
      "403 FORBIDDEN 'Cộng đồng này chưa bật chứng nhận hoàn thành khóa học' (kiểm tra bật/tắt chạy trước kiểm tra tiến độ).")
    C(CE, F, "yt (mặc định tắt): GET certificate trả 403 thông điệp chưa bật", "Chức năng", "Trung bình",
      BASE + "Đăng nhập member1 (thành viên yt; chưa xong 100%).",
      ["GET /api/courses/yt/certificate"],
      "yt",
      "403 'Cộng đồng này chưa bật chứng nhận hoàn thành khóa học' (không phải thông điệp 100%).")
    C(CE, F, "UI: không hiện nút 'Nhận chứng nhận' khi chưa đủ 100% hoặc chưa bật", "Giao diện", "Cao",
      BASE + "Đăng nhập member1: photo (50%, bật), yt (chưa bật).",
      ["Mở " + L + " của photo và tìm 'Nhận chứng nhận'", "Mở /courses/yt/community/lop-hoc và tìm nút + ghi chú"],
      "photo 50%, yt tắt",
      "photo: không có nút 'Nhận chứng nhận'. yt: không có nút; hiển thị 'Cộng đồng chưa bật chứng nhận hoàn thành.' khi tiến độ đạt 100% (nếu chưa 100% chỉ ẩn nút).")
    C(CE, F, "Cấp chứng nhận cố định của member1 ở fin: mã FIN-DEMO-CERT-001", "Chức năng", "Cao",
      BASE + "Đăng nhập member1 (Minh Member1). fin: 16 bài, member1 xong 100% và đã có chứng nhận seed.",
      ["GET /api/courses/fin/certificate", "Gọi lại lần 2", "GET /api/courses/fin/progress"],
      "courseId=fin",
      "Cả 2 lần 200 { code: 'FIN-DEMO-CERT-001', holderName: 'Minh Member1', courseTitle: 'Đầu tư cho người mới', completedAt (thời điểm bài cuối), issuedAt } giống hệt nhau (cấp 1 lần). progress: percent 100, completedLessons 16, completedModules 3, nextLesson null.")
    C(CE, F, "Cấp mới lần đầu: sinh mã ngẫu nhiên 16 ký tự, lưu và gửi thông báo hệ thống", "Chức năng", "Cao",
      BASE + "Đăng nhập member3 (photo bật chứng nhận). Hoàn thành đủ 12 bài (module 1 rồi module 2). Thông báo loại 'system'. Dọn: chứng nhận đã cấp không xóa được qua API.",
      ["Lần lượt POST complete 12 bài", "GET /api/courses/photo/certificate", "GET /api/notifications", "Mở chuông thông báo trên UI"],
      "member3, 12 bài photo",
      "200 { code khớp /^[A-Za-z0-9_-]{16}$/ (12 byte base64url), holderName tên hiển thị của member3, courseTitle tiêu đề khóa photo, completedAt = thời điểm bài cuối được đánh dấu, issuedAt = lúc gọi }. Có thông báo type 'system' 'Bạn đã nhận được chứng nhận hoàn thành' với nội dung 'Chúc mừng! Bạn đã hoàn thành khóa \"<tên khóa>\" và được cấp chứng nhận.'.")
    C(CE, F, "Thông báo cấp chứng nhận có link đúng tới lớp học (đã sửa lệch đường dẫn)", "Tích hợp", "Trung bình",
      BASE + "Sau case cấp mới: member3 mở thông báo chứng nhận.",
      ["Đọc trường link của thông báo (GET /api/notifications)", "Bấm thông báo trên chuông"],
      "thông báo system chứng nhận",
      "link = '/courses/photo/community/lop-hoc' (đã sửa; trước đây '/courses/photo/classroom' không có route FE nên ra 404), khớp route FE. Bấm thông báo mở được trang lớp học; nếu ra 404 thì ghi lỗi hồi quy.", pw="Một phần")
    C(CE, F, "Gọi GET certificate đồng thời 6 lần chỉ cấp 1 bản", "Bảo mật", "Cao",
      BASE + "Học viên mới (đăng ký tài khoản mới, tham gia fin/photo, hoàn thành đủ bài) chưa gọi certificate lần nào; photo bật chứng nhận.",
      ["Promise.all 6 x GET /api/courses/photo/certificate", "Đếm bản ghi chứng nhận của user"],
      "6 request đồng thời",
      "Tất cả 200 và cùng một code; chỉ 1 bản ghi (unique user+course); chỉ 1 thông báo hệ thống được tạo.")
    C(CE, F, "Owner/mod không được miễn điều kiện 100% để nhận chứng nhận", "Chức năng", "Trung bình",
      BASE + "Đăng nhập owner (fin) rồi mod (photo); họ chưa hoàn thành mọi bài.",
      ["owner: GET /api/courses/fin/certificate", "mod: GET /api/courses/photo/certificate"],
      "owner, mod",
      "Cả 2: 403 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận' (staff không bị khóa module nhưng vẫn phải đánh dấu đủ bài).")
    C(CE, F, "Khóa học không có bài nào (0 bài) không cấp chứng nhận", "Chức năng", "Thấp",
      BASE + "Khóa thử của owner đã bật chứng nhận và xóa hết module/bài.",
      ["member: GET /api/courses/{id}/certificate"],
      "0 bài",
      "403 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận' (không cấp vì tổng bài = 0, tránh 0/0 = 100%).")
    C(CE, F, "UI: nhận chứng nhận, xem thẻ, sao chép link xác minh", "Giao diện", "Cao",
      BASE + "Đăng nhập member1; mở lớp học fin: /courses/fin/community/lop-hoc.",
      ["Kiểm tra thanh tiến độ 100%", "Bấm 'Nhận chứng nhận'", "Đọc thẻ trong hộp thoại 'Chứng nhận của bạn'", "Bấm 'Sao chép link xác minh'", "Đọc đường dẫn hiển thị cuối hộp thoại"],
      "member1, fin",
      "Thẻ 'Chứng nhận hoàn thành' hiển thị 'Chứng nhận rằng', tên 'Minh Member1', 'đã hoàn thành 100% khóa học', 'Đầu tư cho người mới', 'Cấp ngày <ngày>', 'Mã: FIN-DEMO-CERT-001'. Toast 'Đã sao chép đường dẫn xác minh'. Có câu 'Ai cũng có thể xác minh chứng nhận này (không cần đăng nhập) tại:' kèm URL /certificates/FIN-DEMO-CERT-001.")
    C(CE, F, "Nút 'In' gọi chức năng in của trình duyệt", "Giao diện", "Thấp",
      BASE + "Đã mở thẻ chứng nhận như case trước.",
      ["Bấm nút 'In' trong hộp thoại chứng nhận", "Xem trước bản in"],
      "window.print()",
      "Mở hộp thoại in của trình duyệt; bản in hiển thị thẻ chứng nhận đọc được. Đây không phải PDF do server sinh.", pw="Một phần")

    F = "Chứng nhận - Xác minh công khai"
    C(CE, F, "Xác minh mã FIN-DEMO-CERT-001 không cần đăng nhập", "Chức năng", "Cao",
      BASE + "Không gửi token (request context mới).",
      ["GET /api/certificates/FIN-DEMO-CERT-001"],
      "code=FIN-DEMO-CERT-001",
      "200 { data: { valid: true, holderName: 'Minh Member1', courseTitle: 'Đầu tư cho người mới', issuedAt: <ISO> } } — đúng 4 trường.")
    C(CE, F, "Dữ liệu công khai không lộ email, userId, courseId", "Bảo mật", "Cao",
      BASE + "Không đăng nhập.",
      ["GET /api/certificates/FIN-DEMO-CERT-001", "Tìm trong body chuỗi 'member1@sofinhub.test', '@', 'userId', 'courseId', 'completedAt', 'code'"],
      "response thô",
      "Body chỉ có valid, holderName, courseTitle, issuedAt; không chứa email, userId, courseId, completedAt hay mã nội bộ.")
    C(CE, F, "Token sai/hết hạn vẫn xác minh được (route công khai không requireAuth)", "Bảo mật", "Thấp",
      BASE + "Không cần phiên hợp lệ.",
      ["GET /api/certificates/FIN-DEMO-CERT-001 với Authorization: Bearer abc.def.ghi"],
      "token rác",
      "200 như khi không có token (không trả 401).")
    C(CE, F, "Mã không tồn tại trả 404", "Chức năng", "Cao",
      BASE + "Không đăng nhập.",
      ["GET /api/certificates/FIN-DEMO-CERT-999", "GET /api/certificates/khong-ton-tai"],
      "2 mã sai",
      "404 NOT_FOUND 'Không tìm thấy chứng nhận với mã này'.")
    C(CE, F, "Mã viết thường fin-demo-cert-001: tra cứu phân biệt hoa/thường -> 404", "Chức năng", "Trung bình",
      BASE + "Không đăng nhập.",
      ["GET /api/certificates/fin-demo-cert-001", "GET /api/certificates/Fin-Demo-Cert-001"],
      "biến thể hoa/thường",
      "404 'Không tìm thấy chứng nhận với mã này' (code lookup khớp chính xác). (giá trị tạm / chưa chốt: nếu sản phẩm muốn cho phép nhập không phân biệt hoa/thường thì cần đổi; hiện là hành vi thực tế.)")
    C(CE, F, "Mã chứa ký tự lạ/khoảng trắng/tấn công đều trả 404, không 500", "Bảo mật", "Cao",
      BASE + "Không đăng nhập (dùng request context để mã hóa URL đúng).",
      ["GET /api/certificates/ + từng giá trị ở Dữ liệu test (đã encode)"],
      "'FIN-DEMO-CERT-001 ' (dấu cách cuối); '%20'; \"' OR '1'='1\"; '../../etc/passwd'; '<script>alert(1)</script>'; '%00'; 'FIN%2FDEMO'; ký tự Unicode 'ＦＩＮ-DEMO-CERT-001'",
      "Tất cả trả 404 NOT_FOUND (hoặc 400 nếu tầng framework từ chối chuỗi lỗi mã hóa), KHÔNG 500, không lộ stack/SQL trong body.")
    C(CE, F, "Mã quá dài (5000 ký tự) không làm sập server", "Bảo mật", "Trung bình",
      BASE + "Không đăng nhập.",
      ["GET /api/certificates/ + 'A' x 5000", "Sau đó GET mã hợp lệ để chắc server còn hoạt động"],
      "chuỗi 5000 ký tự",
      "404 (hoặc 414/400 nếu có giới hạn URL), không 500; request hợp lệ sau đó vẫn 200.")
    C(CE, F, "Dò mã hàng loạt: 60 request mã sai liên tiếp", "Bảo mật", "Trung bình",
      BASE + "Không đăng nhập; đo bằng script.",
      ["Gửi 60 GET /api/certificates/<mã ngẫu nhiên 16 ký tự> trong 10 giây", "Đếm mã trạng thái"],
      "60 request",
      "Theo code hiện tại không có rate limit riêng cho route này: đa số trả 404 (nếu có giới hạn chung sẽ trả 429 TOO_MANY_REQUESTS 'Bạn thao tác quá nhanh, vui lòng thử lại sau'). Mã cấp mới có 96 bit ngẫu nhiên nên không dò được; mã seed FIN-DEMO-CERT-001 là dữ liệu demo đoán được (chỉ dùng môi trường thử). (chưa chốt: có nên thêm rate limit).", pw="Một phần")
    C(CE, F, "UI /certificates/FIN-DEMO-CERT-001 mở trong cửa sổ ẩn danh", "Giao diện", "Cao",
      BASE + "Phiên trình duyệt mới, chưa đăng nhập.",
      ["Mở /certificates/FIN-DEMO-CERT-001", "Đọc tiêu đề và thẻ", "Bấm 'Về trang chủ SofinHub'"],
      "URL công khai",
      "Tiêu đề 'Xác minh chứng nhận', huy hiệu 'Chứng nhận hợp lệ', thẻ có 'Minh Member1' và 'Đầu tư cho người mới'. Nút 'Về trang chủ SofinHub' về trang chủ. Không bị chuyển hướng sang đăng nhập.")
    C(CE, F, "UI mã sai: 'Không tìm thấy chứng nhận', mã được escape", "Giao diện", "Cao",
      BASE + "Không đăng nhập.",
      ["Mở /certificates/SAI-MA-123", "Mở /certificates/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E"],
      "2 URL",
      "Cả 2: tiêu đề 'Không tìm thấy chứng nhận', nội dung 'Mã \"<mã>\" không tồn tại hoặc không hợp lệ. Hãy kiểm tra lại đường dẫn.'; mã độc hiển thị nguyên dạng chữ, không chạy onerror/alert.")
    C(CE, F, "UI xác minh: trạng thái 'Đang xác minh…' và lỗi máy chủ", "Giao diện", "Thấp",
      BASE + "Playwright chặn route: trì hoãn 2 giây rồi trả 500 cho GET /api/certificates/*.",
      ["Mở /certificates/FIN-DEMO-CERT-001", "Chụp màn hình lúc chờ và lúc lỗi"],
      "route delay + 500",
      "Lúc chờ hiển thị 'Đang xác minh…'. Khi 500: tiêu đề 'Không xác minh được' cùng thông điệp lỗi (khác với trường hợp 404); không hiển thị 'Chứng nhận hợp lệ'.")

    F = "Chứng nhận - Vòng đời & phân quyền"
    C(CE, F, "IDOR: member không lấy được chứng nhận của người khác bằng tham số", "Bảo mật", "Cao",
      BASE + "Đăng nhập member2 (photo, 17%). Chứng nhận FIN-DEMO-CERT-001 thuộc member1 ở fin (member2 không ở fin).",
      ["GET /api/courses/fin/certificate", "GET /api/courses/photo/certificate?userId=<id của member1>", "GET /api/courses/photo/certificate/FIN-DEMO-CERT-001 (đường dẫn tự chế)"],
      "member2",
      "Lần 1: 403 'Bạn cần tham gia cộng đồng này trước'. Lần 2: userId trong query bị bỏ qua, kết quả theo chính member2 -> 403 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận'. Lần 3: 404 (không có route). Không bao giờ trả dữ liệu của member1.")
    C(CE, F, "Mod thêm bài mới sau khi đã cấp: cấp cũ vẫn xác minh được, nhận lại bị 403 (chưa chốt)", "Chức năng", "Cao",
      BASE + "member1 có FIN-DEMO-CERT-001 (fin, 100%). Owner (mod+) thêm 1 bài vào mod-fin-3. Dọn: xóa bài bổ sung. Chính sách thu hồi/giữ CHƯA CHỐT (classroom.md, 'Chưa làm').",
      ["owner: POST /api/courses/fin/modules/mod-fin-3/lessons {title:'Bài mới', type:'text', durationMin:5, body:'x'}", "member1: GET /api/courses/fin/certificate", "công khai: GET /api/certificates/FIN-DEMO-CERT-001", "owner: DELETE bài vừa thêm; member1: GET certificate lại"],
      "thêm 1 bài vào fin",
      "Sau khi thêm: GET certificate 403 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận'; xác minh công khai vẫn 200 valid:true (chứng nhận đã lưu, không bị thu hồi). Sau khi xóa bài: GET certificate 200 với cùng code FIN-DEMO-CERT-001. (giá trị tạm / chưa chốt: có thu hồi hay giữ chứng nhận cũ.)")
    C(CE, F, "UI: sau khi mod thêm bài mới, nút 'Nhận chứng nhận' biến mất và toast lỗi khi gọi", "Giao diện", "Trung bình",
      BASE + "Tiếp nối case trên; member1 đang mở lớp học fin.",
      ["Tải lại /courses/fin/community/lop-hoc sau khi có bài mới", "Kiểm tra thanh tiến độ và nút 'Nhận chứng nhận'"],
      "fin 16/17 bài",
      "Tiến độ 94% (16/17), không có nút 'Nhận chứng nhận'; có nút 'Tiếp tục học' tới bài mới. Nếu gọi thẳng API: toast lỗi 'Bạn cần hoàn thành 100% bài học để nhận chứng nhận' (chưa chốt).")
    C(CE, F, "Xóa bài chưa học khiến các bài còn lại đều xong -> đủ điều kiện nhận (điều kiện biên)", "Chức năng", "Trung bình",
      BASE + "Học viên thử H hoàn thành 15/16 bài fin và chưa từng gọi certificate; owner xóa bài H chưa làm.",
      ["H: GET /api/courses/fin/certificate -> 403", "owner: DELETE bài H chưa học", "H: GET certificate lại"],
      "15/16 -> 15/15",
      "Trước khi xóa: 403 '100%'. Sau khi xóa: 200 cấp chứng nhận (tổng bài giảm, mọi bài còn lại đều xong). Ghi nhận là hành vi hiện tại, cần chốt xem có cho phép hay không (chưa chốt).")
    C(CE, F, "Tắt chứng nhận sau khi đã cấp: xác minh công khai vẫn hợp lệ, nhận lại bị chặn", "Chức năng", "Cao",
      BASE + "member1 có FIN-DEMO-CERT-001. Owner tắt chứng nhận ở fin, bật lại ở cuối.",
      ["owner: PATCH /api/courses/fin/classroom-settings {certificatesEnabled:false}", "member1: GET /api/courses/fin/certificate", "công khai: GET /api/certificates/FIN-DEMO-CERT-001", "owner: bật lại; member1 GET certificate"],
      "tắt rồi bật",
      "Khi tắt: GET certificate 403 'Cộng đồng này chưa bật chứng nhận hoàn thành khóa học'; xác minh công khai VẪN 200 valid:true (chứng nhận đã cấp không bị thu hồi). Bật lại: 200 cùng code FIN-DEMO-CERT-001, không cấp bản mới. (chưa chốt: tắt có nên vô hiệu hóa xác minh không.)")
    C(CE, F, "Tên người nhận và tên khóa được lưu tại thời điểm cấp (snapshot)", "Chức năng", "Trung bình",
      BASE + "Học viên thử vừa nhận chứng nhận (photo); sau đó đổi tên hồ sơ (PATCH hồ sơ) sang 'Tên Mới' và owner đổi tên khóa photo.",
      ["GET /api/certificates/<code>", "GET /api/courses/photo/certificate"],
      "đổi tên hồ sơ và tên khóa",
      "Cả 2 vẫn trả tên người nhận và tên khóa cũ đã lưu lúc cấp (không tự đổi theo hồ sơ), mã và issuedAt không đổi.")
    C(CE, F, "Xóa module/bài không xóa chứng nhận đã cấp", "Chức năng", "Thấp",
      BASE + "Học viên thử đã có chứng nhận photo; mod xóa một bài của photo (dùng bài thử).",
      ["mod: DELETE bài", "GET /api/certificates/<code>"],
      "xóa bài sau khi cấp",
      "Xác minh công khai vẫn 200 valid:true với dữ liệu cũ (chứng nhận độc lập với nội dung lớp học).")
    C(CE, F, "Khách và người chưa tham gia không gọi được API nhận chứng nhận", "Bảo mật", "Trung bình",
      BASE + "Khách và newbie.",
      ["khách: GET /api/courses/fin/certificate", "newbie: GET /api/courses/fin/certificate", "khách mở /courses/fin/community/lop-hoc"],
      "khách, newbie",
      "API: khách 401; newbie 403 'Bạn cần tham gia cộng đồng này trước'. UI: khách bị chuyển tới đăng nhập, không thấy nút chứng nhận.")

    F = "Chứng nhận - Chưa làm (PLAN)"
    C(CE, F, "Xuất chứng nhận dạng PDF/ảnh từ máy chủ", "Chức năng", "Trung bình",
      "Chưa làm: chứng nhận chỉ là bản ghi JSON + thẻ trong UI; nút 'In' dùng in của trình duyệt (backend/docs/api/classroom.md, docs/features/content.md). " + BASE,
      ["Ở hộp thoại chứng nhận bấm 'Tải PDF' (dự kiến)", "Mở tệp PDF tải về", "Xác minh mã trong PDF khớp trang /certificates/:code"],
      "member1, fin, FIN-DEMO-CERT-001",
      "Dự kiến: tải PDF khổ A4 có tên, khóa học, ngày cấp, mã và mã QR trỏ tới /certificates/:code; tên tệp gợi ý 'chung-nhan-<mã>.pdf'.", pw="Không", st=PLAN)
    C(CE, F, "Danh sách 'Chứng nhận của tôi' qua nhiều cộng đồng", "Chức năng", "Thấp",
      "Chưa làm: chưa có endpoint liệt kê chứng nhận của tôi xuyên cộng đồng (classroom.md, 'Chưa làm'). " + BASE,
      ["Đăng nhập member1 (dự kiến có chứng nhận fin)", "Mở trang Hồ sơ > Chứng nhận (dự kiến)", "Bấm vào từng chứng nhận"],
      "member1",
      "Dự kiến: liệt kê mọi chứng nhận đã cấp (mã, khóa, ngày cấp) cho riêng người dùng; không lộ chứng nhận của người khác.", pw="Không", st=PLAN)
    C(CE, F, "Thu hồi chứng nhận (quản trị) và trạng thái 'valid:false'", "Chức năng", "Thấp",
      "Chưa làm / chưa chốt: chưa có cơ chế thu hồi; xác minh công khai hiện chỉ trả valid:true hoặc 404. " + BASE,
      ["Owner mở quản lý chứng nhận (dự kiến)", "Thu hồi chứng nhận FIN-DEMO-CERT-001", "Xác minh công khai lại"],
      "FIN-DEMO-CERT-001",
      "Dự kiến: trang xác minh báo chứng nhận đã bị thu hồi (ví dụ valid:false + lý do) thay vì 'hợp lệ'; cần chốt chính sách thu hồi khi mod thêm bài mới.", pw="Không", st=PLAN)
