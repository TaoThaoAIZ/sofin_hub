# -*- coding: utf-8 -*-
"""Đợt 19/10/2026: nâng giới hạn upload video/file lên 2GB, Gắn thẻ thành viên trong ô đăng bài, card Onboarding ở dark mode.
Thêm case mới = thêm CUỐI file (giữ mã TC-xxx-nnn)."""
DONE = "Đã hoàn thiện"
BASE = "Frontend :5173 + backend :4000 chạy; đăng nhập là thành viên một cộng đồng (xem sheet 'Tài khoản & dữ liệu test')."


def load(add):
    M, MN = "UPD19", "Cập nhật 19/10/2026 (upload 2GB, gắn thẻ thành viên)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Một phần"):
        add(M, MN, feature, title, ttype, prio, DONE, pre, steps, data, exp, pw=pw)

    A("Giới hạn upload", "Đính kèm bài viết nhận file/video lớn hơn 25MB (tối đa 2GB)", "Chức năng", "Cao", BASE,
      ["Trong ô đăng bài bấm 'File đính kèm' hoặc 'Video'", "Chọn file ~100MB (PDF/ZIP/MP4)", "Bấm Đăng bài"], "File 100MB",
      "Không báo 'quá lớn'; thanh tiến độ chạy; bài đăng có file đính kèm tải/phát được.")
    A("Giới hạn upload", "Đính kèm bài viết nhận ảnh, WEBM, MOV; loại ngoài danh sách bị từ chối rõ ràng", "Chức năng", "Trung bình", BASE,
      ["Bấm 'File đính kèm'", "Chọn ảnh PNG, rồi video WEBM, rồi file .exe"], "png / webm / exe",
      "PNG và WEBM tải lên được; .exe báo 'Loại tệp không được hỗ trợ' kèm danh sách loại cho phép.")
    A("Giới hạn upload", "Đính kèm tin nhắn và media giới thiệu cộng đồng: tới 2GB mỗi file", "Chức năng", "Trung bình", BASE,
      ["Mở Tin nhắn, đính kèm file 50MB", "Vào Cài đặt cộng đồng > media, tải video MP4 50MB"], "File 50MB",
      "Cả hai tải lên thành công; hint hiển thị 'tối đa 2GB'.")
    A("Giới hạn upload", "File vượt 2GB bị chặn sớm ở FE và BE", "Chức năng", "Trung bình", BASE,
      ["Chọn file lớn hơn 2048MB ở đính kèm bài viết"], "File >2GB",
      "FE báo 'Tệp quá lớn (tối đa 2048MB)'; nếu gọi thẳng API presign, BE trả 400 'File quá lớn'.", pw="Không")
    A("Gắn thẻ thành viên", "Gõ @ trong ô nội dung hiện gợi ý thành viên và lọc theo ký tự gõ sau @", "Chức năng", "Cao", BASE,
      ["Trong ô đăng bài gõ @", "Gõ tiếp vài ký tự của tên", "Bấm một kết quả (hoặc bấm nút 'Gắn thẻ' để tự chèn @)"], "-",
      "Chỉ hiện gợi ý khi có @ ngay trước con trỏ; danh sách tối đa 6 người, lọc theo ký tự, không có chính mình/người đã gắn; chọn xong chèn '@Tên ' vào nội dung; Esc đóng gợi ý; tối đa 10 người.")
    A("Gắn thẻ thành viên", "Đăng bài có gắn thẻ: bài hiển thị chip @Tên và người được gắn nhận thông báo", "Chức năng", "Cao", BASE,
      ["Gắn thẻ 1 thành viên, nhập nội dung, Đăng bài", "Đăng nhập tài khoản người được gắn, mở chuông thông báo"], "-",
      "Bài hiện dòng thẻ @Tên (không lộ chuỗi [[user:...]]); người được gắn có thông báo 'Bạn được gắn thẻ trong một bài viết' bấm vào mở đúng bài; tác giả không tự nhận thông báo.")
    A("Gắn thẻ thành viên", "Id gắn thẻ không thuộc cộng đồng bị bỏ qua, không làm hỏng việc đăng bài", "Bảo mật", "Trung bình", BASE,
      ["Gọi POST /communities/:id/posts với content chứa [[user:<id người ngoài cộng đồng>|X]]"], "id ngoài cộng đồng",
      "Bài vẫn đăng 201; người ngoài cộng đồng không nhận thông báo.", pw="Không")
    A("Onboarding dark mode", "Card 'Bắt đầu hành trình của bạn' ở giao diện tối: nút 'Tải lại' đọc được, danh sách bước full chiều ngang", "Giao diện", "Thấp", BASE,
      ["Bật giao diện tối", "Mở trang cộng đồng có card onboarding"], "-",
      "Nút 'Tải lại' nền/chữ tương phản rõ; các dòng bước giãn hết chiều ngang card (chừa chỗ cho hình tên lửa ở màn hình rộng); màn hình hẹp xếp dọc.")

    A("Lịch sự kiện", "Tải lịch cả cộng đồng dạng Word (.docx) mở được bằng Word/Google Docs", "Chức năng", "Cao", BASE,
      ["Vào tab Lịch của cộng đồng có sự kiện", "Bấm 'Tải lịch dạng Word'", "Mở file vừa tải"], "-",
      "Tải về file .docx mở được; có tiêu đề cộng đồng, mỗi sự kiện một bảng gồm thời gian (theo múi giờ sự kiện), người tổ chức, liên kết, mô tả; sắp theo thời gian.")
    A("Lịch sự kiện", "Tải từng sự kiện dạng Word; vẫn còn nút tải .ics để thêm vào ứng dụng lịch", "Chức năng", "Trung bình", BASE,
      ["Mở chi tiết một sự kiện", "Bấm 'Tải file Word (.docx)'", "Bấm 'Tải lịch xuống (.ics)'"], "-",
      "Cả hai file tải được; .docx mở xem được; .ics nhập được vào Google/Apple/Outlook Calendar.")
    A("Tin nhắn riêng", "Đính kèm file bất kỳ (video, json, rar, exe...) tới 2GB", "Chức năng", "Cao", BASE,
      ["Mở Tin nhắn, chọn cuộc trò chuyện", "Đính kèm lần lượt: .mp4, .json, .rar, .exe", "Gửi"], "mp4/json/rar/exe",
      "Cả bốn tải lên và gửi được (tối đa 5 tệp/tin); video phát ngay trong khung chat; file khác hiện dạng tải về với tên gốc; người nhận tải về đúng tên file.")
    A("Tin nhắn riêng", "File lạ (exe, html...) luôn phục vụ dạng tải về, không chạy/hiển thị trong trình duyệt", "Bảo mật", "Cao", BASE,
      ["Gửi file .html và .exe trong chat", "Mở URL file ký trong tab mới"], "html/exe",
      "Trình duyệt tải xuống (Content-Disposition: attachment, nosniff, CSP sandbox), không render HTML.", pw="Không")
    A("Khảo sát bài học", "Chủ/mod thêm khảo sát cho bài: chọn một, chọn nhiều, tự nhập; đặt bắt buộc từng câu", "Chức năng", "Cao", "Đăng nhập là mod/chủ cộng đồng; bài học đã lưu.",
      ["Sửa bài học > bước Nội dung > mục 'Khảo sát cho bài học'", "Thêm 3 câu: Chọn một, Chọn nhiều, Học viên tự nhập; tick 'Bắt buộc' cho 1 câu", "Bấm 'Lưu khảo sát'"], "-",
      "Lưu thành công; mở lại bài thấy đủ câu; lựa chọn trống/trùng báo lỗi đúng câu; câu 'tự nhập' không có ô lựa chọn; xóa hết câu rồi lưu = bỏ khảo sát.")
    A("Khảo sát bài học", "Học viên làm khảo sát ở trang bài học, được chọn bất kỳ đáp án và nộp lại để cập nhật", "Chức năng", "Cao", BASE,
      ["Mở bài học có khảo sát", "Chọn đáp án (nhiều đáp án ở câu 'chọn nhiều'), nhập câu tự do", "Bấm 'Gửi khảo sát'", "Tải lại trang, sửa đáp án, bấm 'Cập nhật câu trả lời'"], "-",
      "Câu bắt buộc chưa trả lời thì nút bị khóa; gửi xong hiện 'Đã lưu câu trả lời'; tải lại vẫn thấy đáp án đã chọn; nộp lại ghi đè, mỗi học viên chỉ có 1 bản; khảo sát KHÔNG chặn nút Hoàn thành bài.")
    A("Khảo sát bài học", "Phân quyền và dữ liệu: học viên không xem được kết quả; sửa khảo sát không mất câu trả lời cũ", "Bảo mật", "Cao", BASE,
      ["Học viên gọi GET /communities/:id/lessons/:lessonId/survey/results", "Gọi POST survey/response với lựa chọn không có trong câu hỏi", "Mod sửa nội dung câu hỏi (giữ nguyên câu) rồi lưu, xem lại kết quả"], "-",
      "Kết quả: 403 với học viên; lựa chọn lạ: 400; sau khi mod sửa, câu trả lời cũ của câu giữ nguyên vẫn còn trong kết quả.", pw="Không")
    A("Trang Khảo sát (chủ/mod)", "Menu 'Khảo sát' chỉ hiện với mod trở lên; trang liệt kê khảo sát từng bài kèm số người trả lời và tỷ lệ", "Chức năng", "Cao", "Cộng đồng có ít nhất 1 bài có khảo sát và vài học viên đã trả lời.",
      ["Đăng nhập chủ cộng đồng, nhìn menu trái", "Bấm 'Khảo sát'", "Đăng nhập học viên thường, kiểm tra menu và truy cập thẳng /communities/:id/community/khao-sat"], "-",
      "Chủ/mod thấy mục Khảo sát; danh sách có tên bài, module, số câu hỏi, số câu trả lời, thanh % trên tổng thành viên, lần trả lời gần nhất; học viên không thấy mục này và vào trực tiếp thấy thông báo chỉ dành cho quản trị.")
    A("Trang Khảo sát (chủ/mod)", "Chi tiết: tab Tổng quan thống kê từng câu, có thể sắp theo lựa chọn nhiều nhất", "Chức năng", "Cao", "Khảo sát đã có câu trả lời.",
      ["Bấm một khảo sát trong danh sách", "Xem tab 'Tổng quan'", "Tick 'Sắp theo lựa chọn nhiều người chọn nhất'"], "-",
      "Mỗi câu chọn một/nhiều hiện số người và % cho từng lựa chọn kèm thanh; câu tự nhập chỉ dẫn sang tab Câu trả lời tự nhập; số liệu khớp dữ liệu đã nhập.")
    A("Trang Khảo sát (chủ/mod)", "Tab 'Câu trả lời tự nhập' và 'Từng học viên' có phân trang, tìm kiếm và lọc theo đáp án", "Chức năng", "Cao", "Khảo sát có >20 người trả lời (dùng script nạp dữ liệu).",
      ["Tab 'Câu trả lời tự nhập': chọn câu hỏi, tìm theo từ khóa, chuyển trang", "Tab 'Từng học viên': tìm theo tên, lọc 'câu X = đáp án Y', mở rộng một học viên"], "-",
      "Mỗi trang 20 dòng, tổng số kết quả đúng; tìm/lọc đổi kết quả và quay về trang 1; mở rộng một dòng thấy đủ câu trả lời của người đó; số lượng lớn vẫn phản hồi nhanh (thống kê tính bằng SQL).")
    A("Trang Khảo sát (chủ/mod)", "Tải CSV kết quả khảo sát mở đúng tiếng Việt trong Excel, chống công thức độc hại", "Chức năng", "Trung bình", "Khảo sát đã có câu trả lời, có một câu trả lời bắt đầu bằng '=' .",
      ["Vào chi tiết khảo sát, bấm 'Tải CSV'", "Mở file bằng Excel"], "ô '=1+1'",
      "File .csv mở đúng tiếng Việt (có BOM); mỗi hàng một học viên, mỗi cột một câu hỏi; ô bắt đầu bằng = + - @ bị thêm dấu ' phía trước nên không chạy công thức.", pw="Không")
    A("Trang Khảo sát (chủ/mod)", "Chủ cộng đồng nhận thông báo khi khảo sát đạt mốc 10/50/100/500/1000 người trả lời", "Chức năng", "Thấp", "Khảo sát đang có 9 người trả lời.",
      ["Học viên thứ 10 (mới) nộp khảo sát", "Đăng nhập chủ cộng đồng xem chuông thông báo", "Học viên cũ nộp lại để cập nhật"], "-",
      "Chủ nhận 1 thông báo 'Khảo sát đạt mốc trả lời mới' (bấm mở trang kết quả); nộp lại/cập nhật không tạo thông báo hay tăng số lượng.", pw="Không")
    A("Avatar theo dữ liệu user", "Dãy avatar thành viên, bảng xếp hạng, danh sách thành viên, đánh giá và chủ cộng đồng hiển thị đúng ảnh/chữ cái của user (không còn màu cứng)", "Giao diện", "Trung bình", BASE,
      ["Mở trang cộng đồng: thẻ bên phải có dãy avatar", "Mở tab Thành viên, Bảng xếp hạng, Giới thiệu và phần Đánh giá của cộng đồng", "So sánh với ảnh đại diện đã đặt trong hồ sơ từng user"], "user có ảnh / chưa có ảnh",
      "User có ảnh: hiện đúng ảnh ở mọi nơi (kể cả avatar người đánh giá và chủ cộng đồng ở tab Giới thiệu); chưa có ảnh: hiện chữ cái đầu trên nền thương hiệu, không còn bảng màu pastel theo thứ tự; số thành viên và số avatar khớp nhau.")
