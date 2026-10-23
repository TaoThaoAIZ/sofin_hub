# -*- coding: utf-8 -*-
"""Màn chờ video linh vật trước khi làm trắc nghiệm (Figma node 193:4854) và linh vật nói chuyện trong bài trắc nghiệm (thêm 2026-10-23).
Thêm case mới = thêm CUỐI file (giữ mã TC-xxx-nnn)."""
DONE = "Đã hoàn thiện"
BASE = "Tiền điều kiện chung: đã `db:seed`, BE :4000, FE :5173; mật khẩu mọi tài khoản seed = Passw0rd!x. "


def load(add):
    CO = ("COURSE", "Khóa học / Lớp học")
    F = "Lớp học - Màn chờ video & linh vật trắc nghiệm"

    def C(title, tt, pri, pre, steps, data, exp, pw="Có"):
        add(CO[0], CO[1], F, title, tt, pri, DONE, pre, steps, data, exp, pw=pw)

    PRE = BASE + "Đăng nhập học viên; có bài học đã mở khóa, có bài trắc nghiệm (và đã xem hết video nếu bài bắt buộc xem). "
    C("Bấm 'Làm trắc nghiệm' phát video linh vật, chạy xong tự vào làm trắc nghiệm", "Chức năng", "Cao", PRE,
      ["Mở trang bài học", "Bấm 'Làm trắc nghiệm'", "Quan sát cho tới khi video kết thúc"], "Bài có trắc nghiệm",
      "Hiện thẻ trắng bo góc phát video linh vật (tự chạy, tắt tiếng, không có nút điều khiển) cùng 'Đang tải bài trắc nghiệm...' và dòng 'Đợi chút nhé, chúng tôi đang chuẩn bị nội dung cho bạn.'. Video chạy hết thì TỰ chuyển sang câu hỏi trắc nghiệm, không cần bấm gì.")
    C("Video chỉ phát một lần mỗi lần vào, không bị phát lại khi dữ liệu bài về", "Chức năng", "Trung bình", PRE,
      ["Mở thẳng URL trang trắc nghiệm (F5) với mạng chậm (Slow 3G)", "Quan sát video khi dữ liệu bài tải xong giữa chừng"], "URL /communities/:id/lessons/:lessonId/trac-nghiem",
      "Video phát liền mạch từ đầu tới cuối đúng một lần (không khựng/quay lại từ đầu khi dữ liệu về). Nếu video hết mà dữ liệu bài chưa về thì hiện dòng 'Đang tải' cho tới khi có dữ liệu rồi vào trắc nghiệm.")
    C("Không phát video khi bài bị khóa, không có trắc nghiệm hoặc lỗi tải", "Chức năng", "Trung bình", BASE + "Có bài bắt buộc xem video mà học viên chưa xem; bài không có trắc nghiệm; lessonId không tồn tại.",
      ["Mở trang trắc nghiệm của bài chưa xem hết video", "Mở trang trắc nghiệm của bài không có trắc nghiệm", "Mở URL trắc nghiệm của bài không tồn tại"], "-",
      "Bài bị khóa: hiện ngay thông báo khóa + nút 'Xem video'; bài không có trắc nghiệm: hiện ngay dòng 'chưa có trắc nghiệm'; bài không tồn tại: hiện ngay thông báo lỗi kèm nút quay lại. Cả ba đều không chờ video.")
    C("Video không tải/phát được thì vẫn vào được trắc nghiệm", "Chức năng", "Trung bình", PRE,
      ["Chặn tệp /images/lesson/quiz-loading-mascot.mp4 trong DevTools (Network > Block request URL)", "Bấm 'Làm trắc nghiệm'"], "-",
      "Không bị kẹt ở màn chờ: vào thẳng câu hỏi trắc nghiệm; Console có 1 dòng lỗi '[quiz-intro] không tải được video chờ ...'.", pw="Không")
    C("Giao diện màn chờ khớp Figma, responsive, dark mode", "Giao diện", "Thấp", PRE,
      ["Mở màn chờ ở 1440px, so với Figma node 193:4854", "Thu nhỏ còn 390px", "Bật dark mode"], "-",
      "Video 374px (16:9) mờ dần ở mép, tiêu đề đậm 28px, dòng phụ xám 20px, thẻ bo 20px đổ bóng nhẹ. 390px: chữ co lại, không tràn ngang. Dark mode: thẻ tối, chữ đọc được (video nền trắng có thể thành vầng sáng, cần xem lại).",
      pw="Không")
    C("Vào trắc nghiệm: linh vật nhún nhảy xuất hiện, bong bóng bật ra và chữ chạy từng ký tự", "Chức năng", "Cao", PRE,
      ["Sau video, quan sát phần đầu bài trắc nghiệm trong 2-3 giây đầu"], "Bài có trắc nghiệm",
      "Ảnh linh vật (quiz-mascot.png) trượt vào từ trái, nảy nhẹ rồi bồng bềnh liên tục; bong bóng thoại bật ra bên phải linh vật và câu 'Sẵn sàng chưa? Cùng làm bài trắc nghiệm nào!' chạy từng ký tự kèm con trỏ nhấp nháy; chiều cao bong bóng không nhảy khi chữ chạy.")
    C("Linh vật đổi lời thoại theo đáp án và theo câu", "Chức năng", "Trung bình", PRE + "Bài trắc nghiệm có >= 2 câu.",
      ["Ở câu 1 chọn đáp án SAI", "Chọn lại đáp án ĐÚNG", "Bấm sang câu 2"], "-",
      "Chọn sai: linh vật nhảy một nhịp, bong bóng chạy 'Chưa đúng rồi, thử chọn lại nhé!'; chọn đúng: 'Chính xác! Bạn giỏi quá!'; sang câu 2: 'Câu tiếp theo nè, cố lên nhé!' (chạy lại từ đầu).")
    C("Linh vật tôn trọng 'giảm chuyển động' và màn hình đọc được lời thoại", "Giao diện", "Thấp", PRE,
      ["Bật 'Reduce motion' của hệ điều hành rồi vào trắc nghiệm", "Dùng trình đọc màn hình"], "-",
      "Reduce motion: linh vật đứng yên, bong bóng hiện đủ chữ ngay (không chạy); trình đọc màn hình đọc đủ câu thoại một lần (không đọc từng ký tự).", pw="Không")
