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
    PRE3 = BASE + "Đăng nhập học viên (không phải chủ/mod); khóa học có tầng 1 (miễn phí), tầng 2 bán riêng 99.000đ (chưa mua), tầng 3 miễn phí; học tuần tự. "
    C("Soạn bài đầu tiên của module: KHÔNG tự bật 'Cho xem thử miễn phí'", "Chức năng", "Cao", BASE + "Đăng nhập chủ/mod; đang tạo module trả phí mới.",
      ["Tạo module trả phí, sang bước soạn bài đầu tiên", "Quan sát công tắc 'Cho xem thử miễn phí'"], "-",
      "Công tắc mặc định TẮT cho cả bài đầu tiên (trước đây bài đầu mặc định bật nên người chưa trả phí vẫn học được). Chủ cộng đồng muốn cho học thử thì tự bật.")
    C("Bài sau thuộc module trả phí chưa mua (không phải bài học thử): không mở được", "Bảo mật", "Cao", PRE3 + "Tầng 2 có 2 bài, KHÔNG bài nào bật xem thử.",
      ["Học và bấm Hoàn thành bài cuối của tầng 1", "Bấm 'Bài sau' / mở thẳng URL bài đầu của tầng 2", "Gọi API GET /lessons/<id bài tầng 2>"], "-",
      "Nút 'Bài sau' không dẫn vào bài tầng 2 (hiện 'Về lớp học'); mở thẳng URL hoặc gọi API đều bị 403 MODULE_LOCKED; thẻ tầng 2 hiện 'Mua riêng 99.000 ₫'. Mua xong mới mở.")
    C("Bài học thử của module trả phí: mở được nhưng có banner nhắc mua; xong bài thử vẫn không mở module sau", "Chức năng", "Cao", PRE3 + "Tầng 2 chỉ có 1 bài và đã bật 'Cho xem thử miễn phí'.",
      ["Hoàn thành tầng 1, mở bài thử của tầng 2", "Bấm Hoàn thành bài thử", "Quay lại Lớp học, xem thẻ tầng 3"], "-",
      "Bài thử mở được và có banner vàng 'Đây là bài học thử miễn phí của module chưa mở khóa...' + link 'Xem lớp học'. Hoàn thành bài thử được, nhưng tầng 2 chưa mua nên KHÔNG tính là đã học xong: thẻ tầng 3 vẫn 'Hoàn thành module trước' và không học được bài tầng 3. Mua tầng 2 xong thì tầng 3 mở.")
    PRE4 = BASE + "Đăng nhập CHỦ cộng đồng X; X có doanh thu nhưng giao dịch mới trong 14 ngày (7 ngày hoàn tiền + 7 ngày tranh chấp); không có nợ. "
    C("Doanh thu còn trong thời gian giữ: nút rút bị vô hiệu kèm giải thích rõ lý do và ngày rút được", "Chức năng", "Cao", PRE4,
      ["Mở Doanh thu & rút tiền", "Xem ô 'Số dư có thể rút', 'Đang giữ', 'Dự phòng'", "Xem khung 'Yêu cầu rút tiền'"], "Giao dịch mới",
      "Số có thể rút = 0đ, 'Đang giữ' = phần doanh thu mới. Trong khung 'Yêu cầu rút tiền' có ô vàng giải thích: '{số tiền} doanh thu đang trong thời gian giữ 14 ngày (hoàn tiền + tranh chấp). Khoản đầu tiên rút được từ dd/mm/yyyy', kèm 'Hệ thống luôn giữ lại 10% làm dự phòng' và 'Số tiền rút tối thiểu mỗi lần: ...'. Nút 'Gửi yêu cầu rút tiền' mờ (không bấm được).")
    C("Hết thời gian giữ: gửi yêu cầu rút tiền thành công, chờ admin duyệt", "Chức năng", "Cao", PRE4 + "Đã qua 14 ngày kể từ giao dịch (hoặc đặt payments.refundWindowDays/disputeWindowDays = 0 trong Cài đặt chung để thử).",
      ["Mở Doanh thu & rút tiền, thấy số có thể rút > 0", "Nhập số tiền <= số có thể rút và >= mức tối thiểu, ngân hàng, số tài khoản 6-20 chữ số, chủ tài khoản", "Bấm 'Gửi yêu cầu rút tiền'", "Admin nền tảng duyệt/đánh dấu đã chi"], "Số tiền hợp lệ",
      "Hiện 'Đã gửi yêu cầu rút tiền, chờ quản trị viên nền tảng duyệt'; dòng mới ở 'Lệnh rút tiền' trạng thái Đang chờ; số có thể rút giảm đúng số đã yêu cầu; nhập quá số có thể rút bị từ chối kèm lý do. Khi admin duyệt/chi xong, owner nhận thông báo.")
