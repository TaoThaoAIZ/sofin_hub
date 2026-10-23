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
