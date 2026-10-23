# -*- coding: utf-8 -*-
"""Đợt 23/10/2026: link trong bài thông báo module mới bấm được; lớp học phân trang 12 khóa/trang.
Thêm case mới = thêm CUỐI file (giữ mã TC-xxx-nnn)."""
DONE = "Đã hoàn thiện"
BASE = "Tiền điều kiện chung: đã `db:seed`, BE :4000, FE :5173; mật khẩu mọi tài khoản seed = Passw0rd!x. "


def load(add):
    M, MN = "COURSE", "Khóa học / Lớp học"
    F = "Lớp học - Thông báo module mới & phân trang"

    def C(title, tt, pri, pre, steps, data, exp, pw="Có"):
        add(M, MN, F, title, tt, pri, DONE, pre, steps, data, exp, pw=pw)

    PRE = BASE + "Đăng nhập chủ/mod cộng đồng X; có một module ở trạng thái Nháp. "
    C("Xuất bản module kèm 'đăng bài thông báo': bài trên bảng tin có link ĐẦY ĐỦ bấm được", "Chức năng", "Cao", PRE,
      ["Mở module nháp > Xuất bản, bật 'Gửi thông báo' và 'Đăng bài thông báo'", "Mở Bảng tin cộng đồng, xem bài 'Module mới: ...'", "Bấm vào dòng 'Xem tại Lớp học: ...'"], "Module nháp",
      "Dòng cuối là link đầy đủ dạng https://<tên miền>/communities/<X>/community/lop-hoc?khoa=<id khóa học> (không chỉ là đường dẫn trần) và hiển thị dạng link (màu cam, gạch chân). Bấm vào: mở trang Lớp học của đúng khóa chứa module ngay trong app (không tải lại cả trang). Thông báo chuông vẫn dẫn tới /communities/<X>/community/lop-hoc.")
    C("Bài thông báo cũ chỉ có đường dẫn '/communities/...' vẫn bấm được", "Chức năng", "Trung bình", BASE + "Có bài thông báo module cũ có dòng 'Xem tại Lớp học: /communities/<X>/community/lop-hoc'.",
      ["Mở bảng tin, tìm bài thông báo cũ", "Bấm vào đường dẫn"], "Bài cũ",
      "Đường dẫn được hiển thị như link và bấm vào chuyển tới trang Lớp học của cộng đồng đó trong app.")
    C("Link ngoài trong bài viết mở tab mới, chỉ nhận http/https; dấu câu cuối câu không dính vào link", "Chức năng", "Trung bình", BASE + "Đăng nhập thành viên.",
      ["Đăng bài có nội dung: 'Xem https://example.com/a?x=1, và javascript:alert(1)'", "Bấm link"], "-",
      "https://example.com/a?x=1 là link bấm được, mở TAB MỚI (rel=noopener), dấu phẩy cuối KHÔNG nằm trong link; 'javascript:alert(1)' chỉ là chữ thường, không thành link. Link cùng tên miền của app mở bằng router, không tải lại trang.")
    C("Lớp học hiển thị 12 khóa mỗi trang", "Chức năng", "Trung bình", BASE + "Cộng đồng có 13+ khóa học/module (đủ 2 trang).",
      ["Mở /communities/<X>/community/lop-hoc", "Đếm số thẻ ở trang 1, xem dòng thông tin phân trang", "Sang trang 2"], "13+ khóa",
      "Trang 1 có đúng 12 thẻ (4 hàng x 3 cột), dòng 'Hiển thị 1-12 trên N'; trang 2 có phần còn lại; đổi trang vẫn giữ bộ lọc/tìm kiếm.", pw="Không")
    PRE2 = BASE + "Đăng nhập học viên (không phải chủ/mod); khóa học có tầng 1 chưa xong và tầng 5 bán riêng 299.000đ (chưa mua); các tầng học tuần tự theo thứ tự. "
    C("Module trả phí đang khóa vì chưa xong module trước: hiện cả 'Hoàn thành module trước' lẫn phí", "Chức năng", "Cao", PRE2,
      ["Mở trang Lớp học", "Xem thẻ tầng 5 (trả phí, các tầng trước chưa học)", "Rê chuột vào nút mũi tên khóa của thẻ"], "Tầng 5 trả phí 299.000đ",
      "Giữa ảnh bìa có lớp phủ tối với icon khóa và dòng 'Mua riêng 299.000 ₫' (giống thẻ trả phí bình thường), đồng thời góc dưới trái vẫn có nhãn 'Hoàn thành module trước'. Tooltip nút khóa ghi cả hai ý. Khi còn bị khóa theo thứ tự thì chưa có nút 'Mua để mở khóa' (chỉ hiện giá).")
    C("Phí chỉ hiện khi chưa mua: đã mua hoặc là chủ/mod thì không hiện", "Chức năng", "Trung bình", PRE2 + "Có tài khoản đã mua tầng 5 và tài khoản chủ/mod.",
      ["Đăng nhập học viên đã mua tầng 5 nhưng chưa xong tầng trước, mở Lớp học", "Đăng nhập chủ/mod, mở Lớp học"], "-",
      "Học viên đã mua: chỉ còn nhãn 'Hoàn thành module trước', không có lớp phủ giá. Chủ/mod: không bị khóa và không có lớp phủ giá. Module khóa vì cấp độ/được chọn thì không hiện phí.")
    C("Hộp thoại mua module / thanh toán chuyển khoản không bị vỡ layout", "Giao diện", "Cao", BASE + "Đăng nhập học viên; module trả phí đã mở khóa theo thứ tự.",
      ["Bấm mở khóa/Mua module để hiện hộp thoại chuyển khoản", "Quan sát ở 1440px và 390px", "Bấm Sao chép từng dòng"], "-",
      "QR nằm giữa, bên dưới là khung thông tin full chiều rộng: Ngân hàng, Số tài khoản, Chủ tài khoản, Số tiền, Nội dung đều đọc trọn trên 1 dòng (tên chủ tài khoản chỉ xuống dòng theo từ), nút Sao chép đúng hàng; không còn bị bóp thành từng chữ/ký tự. Áp dụng cho cả hộp thoại tham gia gói, thanh toán ngay và hóa đơn hosting.", pw="Không")
