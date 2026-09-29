# -*- coding: utf-8 -*-
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter

OUT = r"C:\Users\dev\Desktop\sofin_hub\SofinHub_TestCases.xlsx"

FONT_NAME = "Arial"

# ---------------------------------------------------------------------------
# DATA: (module_code, module_name, feature, title, test_type, priority,
#        feature_status, precondition, steps(list), test_data, expected)
# ---------------------------------------------------------------------------

rows = []

def add(module_code, module_name, feature, title, ttype, priority, status,
        precond, steps, data, expected, pw=None):
    """pw: ghi đè cột 'Phù hợp Playwright' ("Có"/"Một phần"/"Không"); None = tự phân loại theo từ khóa."""
    steps_txt = "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps))
    rows.append([module_code, module_name, feature, title, ttype, priority,
                 status, precond, steps_txt, data, expected, pw])

DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

# ============================= 1. TRANG CHỦ & KHÁM PHÁ =====================
M, MN = "HOME", "Trang chủ & Khám phá"
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm theo từ khóa trong tiêu đề khóa học",
    "Chức năng", "Cao", DONE, "Đã có dữ liệu khóa học mẫu trên trang khám phá",
    ["Vào trang khám phá khóa học", "Nhập từ khóa khớp tiêu đề 1 khóa học vào ô tìm kiếm",
     "Bấm Enter / nút tìm kiếm"],
    "Từ khóa: một phần tiêu đề khóa học có sẵn",
    "Danh sách kết quả chỉ hiển thị (các) khóa học có tiêu đề chứa từ khóa")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm theo từ khóa trong mô tả khóa học",
    "Chức năng", "Trung bình", DONE, "Đã có dữ liệu khóa học mẫu",
    ["Vào trang khám phá", "Nhập từ khóa chỉ xuất hiện trong phần mô tả (không có trong tiêu đề)",
     "Bấm tìm kiếm"], "Từ khóa xuất hiện trong mô tả khóa học",
    "Khóa học có từ khóa trong mô tả vẫn được trả về trong kết quả")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm theo tên giảng viên",
    "Chức năng", "Trung bình", DONE, "Đã có dữ liệu khóa học mẫu",
    ["Vào trang khám phá", "Nhập tên một giảng viên đang có khóa học", "Bấm tìm kiếm"],
    "Tên giảng viên có thật trong dữ liệu",
    "Trả về đúng các khóa học của giảng viên đó")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm với từ khóa không tồn tại",
    "Chức năng", "Trung bình", DONE, "Đã có dữ liệu khóa học mẫu",
    ["Vào trang khám phá", "Nhập từ khóa ngẫu nhiên không khớp bất kỳ khóa học nào",
     "Bấm tìm kiếm"], "VD: 'zzzxyz123'",
    "Hiển thị thông báo/khu vực 'Không tìm thấy kết quả', không lỗi trang trắng")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm với ô tìm kiếm để trống",
    "Chức năng", "Thấp", DONE, "Đã có dữ liệu khóa học mẫu",
    ["Vào trang khám phá", "Để trống ô tìm kiếm và bấm tìm kiếm (hoặc không nhập gì)"],
    "Không có input", "Hiển thị lại toàn bộ danh sách khóa học mặc định, không lỗi")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm chứa ký tự đặc biệt / script injection",
    "Bảo mật", "Cao", DONE, "Đã có dữ liệu khóa học mẫu",
    ["Vào trang khám phá", "Nhập chuỗi dạng <script>alert(1)</script> hoặc ' OR 1=1 -- vào ô tìm kiếm",
     "Bấm tìm kiếm"], "<script>alert(1)</script>",
    "Không thực thi script, không lỗi hệ thống, trả về danh sách rỗng hoặc không khớp")
add(M, MN, "Lọc theo danh mục", "Lọc danh sách theo 1 danh mục (VD: Công nghệ)",
    "Chức năng", "Cao", DONE, "Có khóa học thuộc nhiều danh mục khác nhau",
    ["Vào trang khám phá", "Chọn danh mục 'Công nghệ' trong bộ lọc"],
    "Danh mục: Công nghệ",
    "Chỉ hiển thị khóa học thuộc danh mục Công nghệ")
add(M, MN, "Lọc theo danh mục", "Lọc theo nhiều danh mục cùng lúc",
    "Chức năng", "Trung bình", DONE, "Có khóa học thuộc nhiều danh mục",
    ["Vào trang khám phá", "Chọn đồng thời 'Kinh doanh' và 'Tài chính'"],
    "Danh mục: Kinh doanh, Tài chính",
    "Hiển thị khóa học thuộc 1 trong 2 danh mục đã chọn (logic OR)")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo khoảng giá",
    "Chức năng", "Cao", DONE, "Có khóa học với nhiều mức giá khác nhau",
    ["Vào trang khám phá", "Mở bộ lọc nâng cao", "Chọn khoảng giá cụ thể (VD 0-500k)"],
    "Khoảng giá: 0 - 500,000đ",
    "Chỉ hiển thị khóa học có giá nằm trong khoảng đã chọn")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo loại công khai/riêng tư",
    "Chức năng", "Trung bình", DONE, "Có cả khóa học công khai và riêng tư trong dữ liệu",
    ["Vào trang khám phá", "Mở bộ lọc nâng cao", "Chọn loại 'Riêng tư'"],
    "Loại: Riêng tư", "Chỉ hiển thị khóa học/cộng đồng ở chế độ riêng tư")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo trạng thái khóa học",
    "Chức năng", "Thấp", DONE, "Dữ liệu có khóa học ở nhiều trạng thái",
    ["Vào trang khám phá", "Mở bộ lọc nâng cao", "Chọn 1 trạng thái cụ thể"],
    "Trạng thái: đang mở", "Kết quả chỉ gồm khóa học đúng trạng thái đã chọn")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo ngôn ngữ",
    "Chức năng", "Thấp", DONE, "Dữ liệu có khóa học đa ngôn ngữ",
    ["Vào trang khám phá", "Mở bộ lọc nâng cao", "Chọn ngôn ngữ 'Tiếng Việt'"],
    "Ngôn ngữ: Tiếng Việt", "Chỉ hiển thị khóa học có ngôn ngữ giảng dạy là Tiếng Việt")
add(M, MN, "Bộ lọc nâng cao", "Kết hợp nhiều bộ lọc cùng lúc (danh mục + giá + loại)",
    "Chức năng", "Cao", DONE, "Dữ liệu đa dạng danh mục/giá/loại",
    ["Vào trang khám phá", "Chọn danh mục, khoảng giá và loại công khai/riêng tư cùng lúc"],
    "Danh mục=Công nghệ; Giá=0-1tr; Loại=Công khai",
    "Kết quả thỏa mãn đồng thời tất cả điều kiện lọc (logic AND giữa các nhóm filter)")
add(M, MN, "Bộ lọc nâng cao", "Xóa/reset toàn bộ bộ lọc",
    "Chức năng", "Trung bình", DONE, "Đã áp dụng ít nhất 1 bộ lọc",
    ["Áp dụng vài bộ lọc", "Bấm nút 'Xóa bộ lọc' / 'Reset'"],
    "-", "Toàn bộ điều kiện lọc bị xóa, danh sách quay về mặc định")
add(M, MN, "Sắp xếp", "Sắp xếp theo 'Đang nổi'",
    "Chức năng", "Trung bình", DONE, "Có dữ liệu khóa học với chỉ số tương tác khác nhau",
    ["Vào trang khám phá", "Chọn sắp xếp 'Đang nổi'"], "-",
    "Danh sách được sắp xếp giảm dần theo mức độ nổi bật/tương tác")
add(M, MN, "Sắp xếp", "Sắp xếp theo 'Hàng đầu'",
    "Chức năng", "Trung bình", DONE, "Có dữ liệu đánh giá/rating khác nhau",
    ["Vào trang khám phá", "Chọn sắp xếp 'Hàng đầu'"], "-",
    "Danh sách sắp xếp theo tiêu chí đánh giá/điểm cao nhất trước")
add(M, MN, "Sắp xếp", "Sắp xếp theo 'Mới nhất'",
    "Chức năng", "Trung bình", DONE, "Có khóa học tạo ở nhiều thời điểm khác nhau",
    ["Vào trang khám phá", "Chọn sắp xếp 'Mới nhất'"], "-",
    "Khóa học tạo/xuất bản gần đây nhất hiển thị đầu danh sách")
add(M, MN, "Xem dạng lưới/danh sách", "Chuyển đổi qua lại giữa xem lưới và danh sách",
    "Giao diện", "Thấp", DONE, "Đang ở trang khám phá",
    ["Bấm icon 'Xem dạng danh sách'", "Quan sát layout", "Bấm icon 'Xem dạng lưới'"],
    "-", "Layout chuyển đổi đúng, dữ liệu/thứ tự kết quả không đổi khi đổi kiểu xem")
add(M, MN, "Phân trang", "Chuyển sang trang kết quả tiếp theo",
    "Chức năng", "Cao", DONE, "Số lượng khóa học vượt quá 1 trang",
    ["Vào trang khám phá", "Cuộn xuống cuối danh sách", "Bấm 'Trang sau' / số trang 2"],
    "-", "Hiển thị đúng tập dữ liệu của trang 2, không trùng lặp với trang 1")
add(M, MN, "Phân trang", "Quay lại trang trước đó",
    "Chức năng", "Trung bình", DONE, "Đang ở trang 2 trở đi",
    ["Từ trang 2, bấm 'Trang trước' / số trang 1"], "-",
    "Quay về đúng dữ liệu trang 1")
add(M, MN, "Số liệu nổi bật (hero)", "Kiểm tra số liệu tổng học viên/khóa học/đánh giá hiển thị đúng",
    "Chức năng", "Trung bình", DONE, "Có dữ liệu thống kê trên hệ thống",
    ["Vào trang chủ", "Đối chiếu số liệu hiển thị ở khu vực hero với dữ liệu thực tế trong hệ thống"],
    "-", "Số liệu hiển thị khớp với dữ liệu thực tế (hoặc dữ liệu mẫu đã khai báo)")
add(M, MN, "Câu chuyện cộng đồng", "Hiển thị đánh giá/phản hồi nổi bật trên trang chủ",
    "Giao diện", "Thấp", DONE, "Trang chủ đã tải xong", ["Vào trang chủ", "Cuộn tới khu vực câu chuyện cộng đồng"],
    "-", "Hiển thị đầy đủ nội dung, tên, avatar (dữ liệu minh họa) không bị vỡ layout")

add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm không phân biệt hoa/thường",
    "Chức năng", "Trung bình", DONE, "-",
    ["Vào trang khám phá", "Nhập từ khóa toàn chữ HOA trùng với tiêu đề khóa học viết thường", "Bấm tìm kiếm"],
    "VD: 'KHOA HOC JAVA' cho khóa học 'Khóa học Java'",
    "Trả về đúng kết quả bất kể hoa/thường")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm với khoảng trắng thừa ở đầu/cuối từ khóa",
    "Chức năng", "Thấp", DONE, "-",
    ["Nhập từ khóa có khoảng trắng thừa đầu/cuối", "Bấm tìm kiếm"], "'  java  '",
    "Hệ thống tự trim khoảng trắng, trả về kết quả đúng như không có khoảng trắng thừa")
add(M, MN, "Tìm kiếm khóa học", "Tìm kiếm không dấu vẫn ra kết quả có dấu tiếng Việt",
    "Chức năng", "Trung bình", DONE, "-",
    ["Nhập từ khóa không dấu (VD: 'ke toan')", "Bấm tìm kiếm"], "'ke toan' cho khóa học 'Kế toán'",
    "Trả về đúng khóa học có dấu tương ứng nếu hệ thống hỗ trợ tìm không dấu; nếu không hỗ trợ cần thống nhất hành vi mong đợi với BA")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo giá với giá trị Min > Max",
    "Chức năng", "Trung bình", DONE, "-",
    ["Mở bộ lọc nâng cao", "Nhập Giá từ = 1,000,000đ và Giá đến = 100,000đ", "Áp dụng"],
    "Min=1,000,000 / Max=100,000",
    "Hệ thống báo lỗi giá trị không hợp lệ hoặc tự động hoán đổi, không trả về kết quả sai")
add(M, MN, "Bộ lọc nâng cao", "Lọc theo giá với giá trị âm",
    "Chức năng", "Thấp", DONE, "-",
    ["Mở bộ lọc nâng cao", "Nhập giá trị âm vào ô Giá từ", "Áp dụng"], "Giá từ = -100000",
    "Hệ thống chặn nhập số âm hoặc validate báo lỗi, không crash")
add(M, MN, "Phân trang", "Truy cập trực tiếp URL với số trang vượt quá tổng số trang",
    "Chức năng", "Trung bình", DONE, "-",
    ["Sửa tham số trang trên URL thành số lớn hơn tổng số trang hiện có (VD ?page=999)", "Tải trang"],
    "page=999", "Hiển thị trang trống có thông báo phù hợp hoặc tự động về trang cuối, không lỗi 500")
add(M, MN, "Phân trang", "Truy cập URL với số trang = 0 hoặc số âm",
    "Chức năng", "Thấp", DONE, "-",
    ["Sửa tham số trang trên URL thành 0 hoặc số âm (VD ?page=-1)", "Tải trang"], "page=-1",
    "Hệ thống tự điều chỉnh về trang 1 hoặc báo lỗi hợp lý, không crash")
add(M, MN, "Kết hợp bộ lọc", "Giữ nguyên điều kiện tìm kiếm/lọc/sắp xếp khi chuyển trang",
    "Chức năng", "Cao", DONE, "-",
    ["Áp dụng tìm kiếm + lọc danh mục + sắp xếp 'Mới nhất'", "Chuyển sang trang kết quả tiếp theo"],
    "-", "Trang tiếp theo vẫn giữ đúng điều kiện tìm kiếm/lọc/sắp xếp đã chọn, không bị reset")
add(M, MN, "Phân quyền hiển thị", "Khách (Guest) xem được trang khám phá không cần đăng nhập",
    "Chức năng", "Trung bình", DONE, "Chưa đăng nhập",
    ["Mở trang khám phá ở chế độ ẩn danh (không đăng nhập)"], "-",
    "Xem được danh sách, tìm kiếm, lọc bình thường theo đúng quyền của vai trò Khách")
add(M, MN, "Phân quyền hiển thị", "Khách bấm 'Tham gia ngay' bị chuyển hướng sang trang Đăng ký/Đăng nhập",
    "Chức năng", "Cao", DONE, "Chưa đăng nhập",
    ["Mở trang chi tiết khóa học ở chế độ ẩn danh", "Bấm 'Tham gia ngay'"], "-",
    "Chuyển hướng sang trang Đăng ký (hoặc Đăng nhập), sau khi hoàn tất quay lại đúng khóa học ban đầu")

# ============================= 2. TÀI KHOẢN & XÁC THỰC ======================
M, MN = "AUTH", "Tài khoản & Xác thực"
add(M, MN, "Đăng ký", "Đăng ký tài khoản thành công với thông tin hợp lệ",
    "Chức năng", "Cao", DONE, "Email chưa từng đăng ký trên hệ thống",
    ["Vào trang Đăng ký", "Nhập họ tên, email hợp lệ, mật khẩu đạt yêu cầu (>=8 ký tự, có chữ hoa, ký tự đặc biệt)",
     "Cuộn đọc hết Điều khoản sử dụng và Chính sách bảo mật", "Tick đồng ý điều khoản", "Bấm Đăng ký"],
    "Email: test01@sofinhub.test / Mật khẩu: Test@1234",
    "Tài khoản được tạo thành công, tự động đăng nhập hoặc chuyển tới trang đăng nhập/trang trước đó")
add(M, MN, "Đăng ký", "Đăng ký với email đã tồn tại",
    "Chức năng", "Cao", DONE, "Email đã có tài khoản trên hệ thống",
    ["Vào trang Đăng ký", "Nhập email đã tồn tại", "Điền các trường còn lại hợp lệ", "Bấm Đăng ký"],
    "Email đã tồn tại trong hệ thống",
    "Hiển thị lỗi 'Email đã được sử dụng', không tạo tài khoản trùng")
add(M, MN, "Đăng ký", "Đăng ký với email sai định dạng",
    "Chức năng", "Trung bình", DONE, "-",
    ["Vào trang Đăng ký", "Nhập email sai định dạng (VD: abc@.com)", "Bấm Đăng ký"],
    "Email: abc@.com", "Hiển thị lỗi validate định dạng email, không cho submit")
add(M, MN, "Đăng ký", "Mật khẩu ít hơn 8 ký tự bị từ chối",
    "Chức năng", "Cao", DONE, "-",
    ["Vào trang Đăng ký", "Nhập mật khẩu 7 ký tự (VD: Ab@123)", "Bấm Đăng ký"],
    "Mật khẩu: Ab@12", "Hiển thị lỗi yêu cầu tối thiểu 8 ký tự, không tạo tài khoản")
add(M, MN, "Đăng ký", "Mật khẩu không có chữ hoa bị từ chối",
    "Chức năng", "Cao", DONE, "-",
    ["Vào trang Đăng ký", "Nhập mật khẩu toàn chữ thường + ký tự đặc biệt (VD: test@1234)", "Bấm Đăng ký"],
    "Mật khẩu: test@1234", "Hiển thị lỗi yêu cầu có ít nhất 1 chữ hoa")
add(M, MN, "Đăng ký", "Mật khẩu không có ký tự đặc biệt bị từ chối",
    "Chức năng", "Cao", DONE, "-",
    ["Vào trang Đăng ký", "Nhập mật khẩu chữ hoa+thường+số nhưng không có ký tự đặc biệt (VD: Test1234)", "Bấm Đăng ký"],
    "Mật khẩu: Test1234", "Hiển thị lỗi yêu cầu có ít nhất 1 ký tự đặc biệt")
add(M, MN, "Đăng ký", "Để trống trường họ tên",
    "Chức năng", "Trung bình", DONE, "-",
    ["Vào trang Đăng ký", "Để trống họ tên, điền các trường còn lại hợp lệ", "Bấm Đăng ký"],
    "Họ tên: (trống)", "Hiển thị lỗi bắt buộc nhập họ tên, không submit được")
add(M, MN, "Đồng ý điều khoản", "Không thể tick đồng ý khi chưa cuộn hết Điều khoản sử dụng",
    "Chức năng", "Cao", DONE, "Đang ở bước đọc điều khoản trong luồng đăng ký",
    ["Mở trang Điều khoản sử dụng trong luồng đăng ký", "Không cuộn tới cuối trang",
     "Thử tick vào ô đồng ý"],
    "-", "Ô tick đồng ý bị vô hiệu hóa (disabled) cho tới khi cuộn hết nội dung")
add(M, MN, "Đồng ý điều khoản", "Không thể tick đồng ý khi chưa cuộn hết Chính sách bảo mật",
    "Chức năng", "Cao", DONE, "Đang ở bước đọc chính sách trong luồng đăng ký",
    ["Mở trang Chính sách bảo mật", "Không cuộn tới cuối trang", "Thử tick vào ô đồng ý"],
    "-", "Ô tick đồng ý bị vô hiệu hóa cho tới khi cuộn hết nội dung")
add(M, MN, "Đồng ý điều khoản", "Không cho đăng ký khi chưa tick đồng ý điều khoản",
    "Chức năng", "Cao", DONE, "-",
    ["Điền đầy đủ thông tin đăng ký hợp lệ", "Không tick đồng ý điều khoản", "Bấm Đăng ký"],
    "-", "Hệ thống chặn submit / báo lỗi yêu cầu đồng ý điều khoản trước khi đăng ký")
add(M, MN, "Đăng ký", "Kiểm tra input chống XSS/SQL injection ở các trường đăng ký",
    "Bảo mật", "Cao", DONE, "-",
    ["Vào trang Đăng ký", "Nhập chuỗi <script>alert(1)</script> hoặc ' OR '1'='1 vào trường họ tên/email",
     "Bấm Đăng ký"], "<script>alert(1)</script>",
    "Không thực thi script, dữ liệu được escape/validate, không gây lỗi hệ thống hoặc rò rỉ dữ liệu")
add(M, MN, "Đăng nhập", "Đăng nhập thành công với email/mật khẩu đúng",
    "Chức năng", "Cao", DONE, "Tài khoản đã tồn tại và active",
    ["Vào trang Đăng nhập", "Nhập đúng email và mật khẩu đã đăng ký", "Bấm Đăng nhập"],
    "Email/mật khẩu hợp lệ đã đăng ký trước đó",
    "Đăng nhập thành công, chuyển hướng vào hệ thống với đúng phiên người dùng")
add(M, MN, "Đăng nhập", "Đăng nhập với mật khẩu sai",
    "Chức năng", "Cao", DONE, "Tài khoản đã tồn tại",
    ["Vào trang Đăng nhập", "Nhập đúng email, sai mật khẩu", "Bấm Đăng nhập"],
    "Email đúng / mật khẩu sai", "Hiển thị lỗi thông tin đăng nhập không đúng, không cho vào hệ thống")
add(M, MN, "Đăng nhập", "Đăng nhập với email không tồn tại",
    "Chức năng", "Trung bình", DONE, "-",
    ["Vào trang Đăng nhập", "Nhập email chưa từng đăng ký", "Bấm Đăng nhập"],
    "Email không tồn tại", "Hiển thị lỗi chung (không tiết lộ email có tồn tại hay không), không cho vào hệ thống")
add(M, MN, "Đăng nhập", "Giới hạn số lần đăng nhập sai liên tiếp (chống dò mật khẩu)",
    "Bảo mật", "Cao", DONE, "Tài khoản đã tồn tại",
    ["Vào trang Đăng nhập", "Nhập sai mật khẩu liên tục nhiều lần trong thời gian ngắn (VD 5-10 lần)"],
    "Mật khẩu sai lặp lại",
    "Sau ngưỡng quy định, hệ thống tạm khóa đăng nhập / yêu cầu xác minh thêm (captcha, chờ...), không cho brute-force vô hạn")
add(M, MN, "Phiên đăng nhập", "Phiên đăng nhập được giữ khi tải lại trang (F5)",
    "Chức năng", "Cao", DONE, "Đã đăng nhập thành công",
    ["Đăng nhập vào hệ thống", "Nhấn F5 để tải lại trang"], "-",
    "Người dùng vẫn ở trạng thái đã đăng nhập, không bị đẩy về trang chủ/đăng nhập")
add(M, MN, "Đăng xuất", "Đăng xuất khỏi hệ thống",
    "Chức năng", "Cao", DONE, "Đã đăng nhập",
    ["Đang đăng nhập, bấm nút Đăng xuất"], "-",
    "Phiên bị hủy, chuyển về trang chủ ở trạng thái khách (guest)")
add(M, MN, "Đăng xuất", "Sau khi đăng xuất, không thể truy cập lại trang yêu cầu đăng nhập bằng nút Back",
    "Bảo mật", "Trung bình", DONE, "Vừa đăng xuất",
    ["Đăng xuất khỏi hệ thống", "Bấm nút Back của trình duyệt để quay lại trang yêu cầu đăng nhập"],
    "-", "Hệ thống yêu cầu đăng nhập lại, không hiển thị lại nội dung đã cache của phiên cũ")
add(M, MN, "Đăng nhập mạng xã hội", "Đăng nhập bằng Google",
    "Chức năng", "Trung bình", PLAN, "Tính năng đang ở giai đoạn Kế hoạch — nút hiển thị nhưng chưa xử lý thật",
    ["Vào trang Đăng nhập", "Bấm nút Đăng nhập bằng Google", "Chọn tài khoản Google"],
    "Tài khoản Google hợp lệ", "Đăng nhập/tạo tài khoản thành công liên kết với Google")
add(M, MN, "Đăng nhập mạng xã hội", "Đăng nhập bằng Facebook",
    "Chức năng", "Trung bình", PLAN, "Tính năng đang ở giai đoạn Kế hoạch",
    ["Vào trang Đăng nhập", "Bấm nút Đăng nhập bằng Facebook", "Xác nhận quyền truy cập"],
    "Tài khoản Facebook hợp lệ", "Đăng nhập/tạo tài khoản thành công liên kết với Facebook")
add(M, MN, "Quên mật khẩu", "Gửi yêu cầu khôi phục mật khẩu qua email",
    "Chức năng", "Cao", PLAN, "Tính năng đang ở giai đoạn Kế hoạch",
    ["Vào trang Đăng nhập", "Bấm 'Quên mật khẩu'", "Nhập email đã đăng ký", "Bấm gửi yêu cầu"],
    "Email đã đăng ký", "Nhận được email chứa liên kết đặt lại mật khẩu, liên kết có thời hạn")
add(M, MN, "Quên mật khẩu", "Đặt lại mật khẩu mới qua liên kết trong email",
    "Chức năng", "Cao", PLAN, "Tính năng đang ở giai đoạn Kế hoạch",
    ["Mở liên kết đặt lại mật khẩu từ email", "Nhập mật khẩu mới hợp lệ", "Xác nhận"],
    "Mật khẩu mới: New@1234", "Mật khẩu được cập nhật, đăng nhập được bằng mật khẩu mới, liên kết cũ hết hiệu lực sau khi dùng")
add(M, MN, "Hồ sơ cá nhân", "Xem và cập nhật hồ sơ cá nhân (ảnh đại diện, tiểu sử)",
    "Chức năng", "Trung bình", PLAN, "Tính năng đang ở giai đoạn Kế hoạch",
    ["Vào trang Hồ sơ cá nhân", "Cập nhật ảnh đại diện và tiểu sử", "Lưu"],
    "-", "Thông tin được lưu và hiển thị đúng ở các nơi khác (bài viết, bình luận...)")
add(M, MN, "Xác thực 2 lớp (2FA)", "Bật 2FA cho tài khoản Owner/Admin",
    "Bảo mật", "Trung bình", PLAN, "Tính năng đang ở giai đoạn Kế hoạch",
    ["Vào Cài đặt bảo mật tài khoản", "Bật 2FA", "Quét mã QR bằng app xác thực", "Nhập mã xác nhận"],
    "-", "2FA được kích hoạt, lần đăng nhập tiếp theo yêu cầu nhập mã OTP")

add(M, MN, "Đăng ký", "Mật khẩu đúng đủ 8 ký tự (giá trị biên) được chấp nhận",
    "Chức năng", "Trung bình", DONE, "-",
    ["Nhập mật khẩu chính xác 8 ký tự thỏa quy tắc", "Hoàn tất các trường khác hợp lệ", "Bấm Đăng ký"],
    "Mật khẩu 8 ký tự: 'Aa1@bcde'", "Đăng ký thành công, không bị từ chối ở giá trị biên dưới")
add(M, MN, "Đăng ký", "Họ tên chứa ký tự tiếng Việt có dấu",
    "Chức năng", "Thấp", DONE, "-",
    ["Nhập họ tên có dấu tiếng Việt đầy đủ", "Hoàn tất đăng ký"], "Họ tên: Nguyễn Văn Ánh",
    "Đăng ký thành công, họ tên hiển thị đúng dấu ở mọi nơi (hồ sơ, bình luận...)")
add(M, MN, "Đăng ký", "Email chuẩn hóa chữ hoa/thường khi kiểm tra trùng lặp",
    "Chức năng", "Cao", DONE, "Email 'test01@sofinhub.test' đã đăng ký trước đó",
    ["Đăng ký lại với email viết hoa toàn bộ hoặc khác hoa/thường"], "TEST01@SofinHub.test",
    "Hệ thống nhận diện là email đã tồn tại, không cho tạo tài khoản trùng do khác biệt hoa/thường")
add(M, MN, "Đăng ký", "Mật khẩu chứa khoảng trắng ở giữa",
    "Chức năng", "Thấp", DONE, "-",
    ["Nhập mật khẩu có khoảng trắng ở giữa", "Bấm Đăng ký"], "'Ab@12 34'",
    "Hệ thống chấp nhận hoặc từ chối rõ ràng theo quy tắc đã định nghĩa, hành vi nhất quán giữa FE và BE")
add(M, MN, "Đăng nhập", "Tài khoản bị tạm khóa do đăng nhập sai nhiều lần vẫn từ chối dù nhập đúng mật khẩu",
    "Bảo mật", "Cao", DONE, "Tài khoản vừa bị khóa tạm thời do vượt ngưỡng đăng nhập sai",
    ["Đăng nhập sai đủ số lần để bị khóa tạm thời", "Ngay sau đó đăng nhập lại với email/mật khẩu ĐÚNG"],
    "-", "Vẫn bị từ chối đăng nhập với thông báo tài khoản đang tạm khóa, cho tới khi hết thời gian khóa")
add(M, MN, "Đăng nhập", "Đăng nhập đồng thời trên nhiều thiết bị khác nhau không bị đá nhau",
    "Chức năng", "Trung bình", DONE, "-",
    ["Đăng nhập tài khoản A trên trình duyệt 1", "Đăng nhập cùng tài khoản A trên trình duyệt 2",
     "Thao tác trên cả 2 trình duyệt"], "-",
    "Cả 2 phiên đều hoạt động bình thường song song (trừ khi có yêu cầu nghiệp vụ giới hạn 1 thiết bị)")
add(M, MN, "Phiên đăng nhập", "Access token bị chỉnh sửa (tamper) bị từ chối",
    "Bảo mật", "Cao", DONE, "Có access token hợp lệ",
    ["Lấy access token hợp lệ", "Sửa đổi 1 ký tự bất kỳ trong token", "Gọi API cần xác thực với token đã sửa"],
    "-", "API trả về lỗi xác thực thất bại (401), không xử lý request")
add(M, MN, "Phiên đăng nhập", "Refresh token hết hạn không dùng lại được",
    "Bảo mật", "Cao", DONE, "Có refresh token đã hết hạn theo cấu hình",
    ["Chờ refresh token hết hạn (hoặc dùng token test đã hết hạn)", "Gọi API làm mới access token bằng refresh token đó"],
    "-", "Bị từ chối, yêu cầu đăng nhập lại từ đầu")
add(M, MN, "Phiên đăng nhập", "Dùng token của tài khoản khác để giả mạo truy cập dữ liệu",
    "Bảo mật", "Cao", DONE, "Có 2 tài khoản test A và B, có access token hợp lệ của B",
    ["Đăng nhập tài khoản A trên trình duyệt", "Thay access token trong request bằng token của B (qua DevTools/Postman)",
     "Gọi API lấy dữ liệu cá nhân"], "-",
    "Nếu token của B hợp lệ, hệ thống trả đúng dữ liệu của B — xác nhận hệ thống xác thực theo token chứ không nhầm lẫn theo session cũ, không rò rỉ chéo dữ liệu")
add(M, MN, "Đăng nhập", "Giới hạn đăng nhập sai được tính theo tài khoản, không chặn nhầm người dùng khác cùng IP",
    "Bảo mật", "Trung bình", DONE, "Tài khoản B bị khóa tạm thời do đăng nhập sai nhiều lần",
    ["Từ cùng 1 thiết bị/IP đã làm khóa tạm tài khoản B", "Thử đăng nhập đúng thông tin tài khoản C (khác B) từ cùng thiết bị/IP"],
    "-", "Tài khoản C vẫn đăng nhập được bình thường, không bị ảnh hưởng bởi việc khóa tài khoản B (trừ khi có rate-limit theo IP ở tầng khác — cần xác nhận rõ quy tắc)")
add(M, MN, "Đăng ký", "Trường mật khẩu không hiển thị dạng plain text mặc định",
    "Giao diện", "Thấp", DONE, "-",
    ["Vào trang đăng ký", "Nhập mật khẩu", "Quan sát ô mật khẩu"], "-",
    "Mật khẩu hiển thị dạng ẩn (dấu chấm/sao) mặc định, có tùy chọn hiện rõ nếu có icon con mắt")
add(M, MN, "Đăng xuất", "API từ chối request dùng access token cũ ngay sau khi đăng xuất",
    "Bảo mật", "Cao", DONE, "Đã đăng nhập, có access token còn hiệu lực",
    ["Lấy access token hiện tại", "Đăng xuất", "Ngay lập tức gọi API cần xác thực bằng access token vừa lấy"],
    "-", "API từ chối truy cập ngay, không cần chờ tới khi access token tự hết hạn")

# ============================= 3. CỘNG ĐỒNG ==================================
M, MN = "COMM", "Cộng đồng"
add(M, MN, "Tạo cộng đồng", "Thành viên tạo cộng đồng mới thành công",
    "Chức năng", "Cao", PLAN, "Đã đăng nhập với vai trò Thành viên",
    ["Bấm 'Tạo cộng đồng'", "Nhập tên, mô tả, ảnh bìa", "Chọn chế độ công khai/riêng tư và mức giá",
     "Bấm Tạo"], "Tên cộng đồng hợp lệ",
    "Cộng đồng được tạo, người tạo được gán vai trò Owner ngay lập tức, không cần xét duyệt")
add(M, MN, "Tạo cộng đồng", "Không cho tạo cộng đồng khi để trống tên",
    "Chức năng", "Trung bình", PLAN, "Đã đăng nhập",
    ["Bấm 'Tạo cộng đồng'", "Để trống tên cộng đồng", "Bấm Tạo"], "-",
    "Hiển thị lỗi bắt buộc nhập tên, không tạo được cộng đồng")
add(M, MN, "Tạo cộng đồng", "Tạo cộng đồng ở chế độ Công khai + Miễn phí",
    "Chức năng", "Cao", PLAN, "Đã đăng nhập",
    ["Tạo cộng đồng mới", "Chọn Công khai", "Chọn Miễn phí", "Xuất bản"], "-",
    "Cộng đồng hiển thị công khai trên trang khám phá, thành viên tham gia không cần duyệt/thanh toán")
add(M, MN, "Tạo cộng đồng", "Tạo cộng đồng ở chế độ Công khai + Có phí theo tháng",
    "Chức năng", "Cao", PLAN, "Đã đăng nhập",
    ["Tạo cộng đồng mới", "Chọn Công khai", "Chọn Có phí, nhập mức giá/tháng", "Xuất bản"],
    "Giá: 99,000đ/tháng",
    "Cộng đồng hiển thị công khai, yêu cầu thanh toán trước khi truy cập nội dung đầy đủ")
add(M, MN, "Tạo cộng đồng", "Tạo cộng đồng ở chế độ Riêng tư",
    "Chức năng", "Cao", PLAN, "Đã đăng nhập",
    ["Tạo cộng đồng mới", "Chọn Riêng tư", "Xuất bản"], "-",
    "Cộng đồng không hiển thị công khai đầy đủ, người tham gia phải được duyệt hoặc mời")
add(M, MN, "Trang cộng đồng", "Tab Bảng tin hiển thị đúng nội dung",
    "Giao diện", "Trung bình", PLAN, "Đã tham gia 1 cộng đồng có bài viết",
    ["Vào trang cộng đồng", "Chọn tab Bảng tin"], "-",
    "Hiển thị danh sách bài viết của cộng đồng theo thứ tự thời gian")
add(M, MN, "Trang cộng đồng", "Tab Khóa học hiển thị đúng danh sách khóa học của cộng đồng",
    "Chức năng", "Trung bình", PLAN, "Cộng đồng có ít nhất 1 khóa học",
    ["Vào trang cộng đồng", "Chọn tab Khóa học"], "-",
    "Hiển thị đúng danh sách khóa học thuộc cộng đồng này (không lẫn khóa học cộng đồng khác)")
add(M, MN, "Trang cộng đồng", "Tab Lịch hiển thị sự kiện sắp diễn ra",
    "Chức năng", "Thấp", PLAN, "Cộng đồng có sự kiện đã tạo",
    ["Vào trang cộng đồng", "Chọn tab Lịch"], "-", "Hiển thị đúng danh sách/lịch các sự kiện của cộng đồng")
add(M, MN, "Trang cộng đồng", "Tab Thành viên hiển thị danh sách thành viên",
    "Chức năng", "Trung bình", PLAN, "Cộng đồng có nhiều thành viên",
    ["Vào trang cộng đồng", "Chọn tab Thành viên"], "-", "Hiển thị danh sách thành viên kèm vai trò trong cộng đồng")
add(M, MN, "Trang cộng đồng", "Tab Giới thiệu hiển thị đúng thông tin cộng đồng",
    "Giao diện", "Thấp", PLAN, "-",
    ["Vào trang cộng đồng", "Chọn tab Giới thiệu"], "-", "Hiển thị mô tả, quy tắc, thông tin Owner đúng như đã cấu hình")
add(M, MN, "Tham gia cộng đồng", "Tham gia cộng đồng Công khai + Miễn phí",
    "Chức năng", "Cao", PLAN, "Có cộng đồng công khai miễn phí, đã đăng nhập",
    ["Vào trang cộng đồng công khai miễn phí", "Bấm 'Tham gia ngay'"], "-",
    "Vào cộng đồng ngay lập tức, không cần duyệt, trạng thái thành viên được lưu ở server")
add(M, MN, "Tham gia cộng đồng", "Tham gia cộng đồng Công khai + Có phí",
    "Chức năng", "Cao", PLAN, "Có cộng đồng công khai có phí, đã đăng nhập",
    ["Vào trang cộng đồng có phí", "Bấm 'Tham gia ngay'", "Chuyển tới màn hình chọn gói/thanh toán"],
    "-", "Chỉ vào được nội dung đầy đủ sau khi thanh toán thành công (hoặc bắt đầu dùng thử nếu có)")
add(M, MN, "Tham gia cộng đồng", "Gửi yêu cầu tham gia cộng đồng Riêng tư",
    "Chức năng", "Cao", PLAN, "Có cộng đồng riêng tư, đã đăng nhập",
    ["Vào trang cộng đồng riêng tư", "Bấm 'Yêu cầu tham gia'"], "-",
    "Yêu cầu được gửi tới Owner/Admin, trạng thái 'Đang chờ duyệt', chưa được vào nội dung")
add(M, MN, "Tham gia cộng đồng", "Owner duyệt yêu cầu tham gia cộng đồng riêng tư",
    "Chức năng", "Cao", PLAN, "Có yêu cầu tham gia đang chờ duyệt",
    ["Owner vào danh sách yêu cầu tham gia", "Bấm Duyệt cho 1 yêu cầu"], "-",
    "Người dùng được thêm vào cộng đồng, có thể truy cập nội dung ngay")
add(M, MN, "Tham gia cộng đồng", "Owner từ chối yêu cầu tham gia",
    "Chức năng", "Trung bình", PLAN, "Có yêu cầu tham gia đang chờ duyệt",
    ["Owner vào danh sách yêu cầu tham gia", "Bấm Từ chối"], "-",
    "Yêu cầu bị từ chối, người gửi không được vào cộng đồng, nhận được thông báo phù hợp")
add(M, MN, "Tham gia cộng đồng", "Tham gia qua liên kết mời trực tiếp",
    "Chức năng", "Trung bình", PLAN, "Owner đã tạo liên kết mời cho cộng đồng riêng tư",
    ["Người dùng mở liên kết mời", "Bấm xác nhận tham gia"], "-",
    "Vào cộng đồng ngay không cần chờ duyệt")
add(M, MN, "Rời cộng đồng", "Thành viên tự rời cộng đồng",
    "Chức năng", "Trung bình", PLAN, "Đã là thành viên của 1 cộng đồng",
    ["Vào cài đặt cộng đồng", "Bấm 'Rời cộng đồng'", "Xác nhận"], "-",
    "Mất quyền truy cập nội dung cộng đồng, không còn trong danh sách thành viên")
add(M, MN, "Loại thành viên", "Owner/Admin loại bỏ thành viên vi phạm",
    "Chức năng", "Cao", PLAN, "Có thành viên vi phạm quy tắc trong cộng đồng",
    ["Owner/Admin vào danh sách thành viên", "Chọn thành viên vi phạm", "Bấm 'Loại khỏi cộng đồng'"],
    "-", "Thành viên bị loại, mất quyền truy cập ngay lập tức")
add(M, MN, "Phân quyền", "Owner cấp quyền Admin cho một thành viên",
    "Chức năng", "Cao", PLAN, "Có thành viên thường trong cộng đồng",
    ["Owner vào danh sách thành viên", "Chọn 1 thành viên", "Cấp quyền Admin/Mod"], "-",
    "Thành viên được nâng quyền, có thể tạo/sửa nội dung, kiểm duyệt trong cộng đồng đó")
add(M, MN, "Phân quyền", "Owner thu hồi quyền Admin",
    "Chức năng", "Trung bình", PLAN, "Có 1 Admin trong cộng đồng",
    ["Owner vào danh sách quản trị viên", "Thu hồi quyền của 1 Admin"], "-",
    "Người đó trở lại vai trò Thành viên thường, mất quyền quản trị ngay")
add(M, MN, "Phân quyền", "Admin mặc định không xem được doanh thu khi chưa được cấp thêm quyền",
    "Bảo mật", "Cao", PLAN, "Có tài khoản Admin chưa được cấp quyền xem doanh thu",
    ["Đăng nhập bằng tài khoản Admin", "Cố truy cập trang Doanh thu của cộng đồng"], "-",
    "Bị từ chối truy cập / không thấy mục doanh thu, đúng theo quy tắc phân quyền mặc định")
add(M, MN, "Khám phá cộng đồng", "Danh sách cộng đồng hiển thị đúng, hỗ trợ tìm kiếm/lọc",
    "Chức năng", "Trung bình", PLAN, "Có nhiều cộng đồng công khai",
    ["Vào trang khám phá cộng đồng", "Tìm kiếm/lọc theo danh mục hoặc từ khóa"], "-",
    "Trả về đúng danh sách cộng đồng công khai khớp điều kiện")

add(M, MN, "Quản lý cộng đồng", "Owner chỉnh sửa thông tin cộng đồng (tên, mô tả, ảnh bìa)",
    "Chức năng", "Trung bình", PLAN, "Owner có 1 cộng đồng đang hoạt động",
    ["Owner vào Cài đặt cộng đồng", "Sửa tên/mô tả/ảnh bìa", "Lưu"], "-",
    "Thông tin cập nhật thành công và hiển thị đúng ngay trên trang cộng đồng")
add(M, MN, "Quản lý cộng đồng", "Owner đổi mức giá cộng đồng từ Miễn phí sang Có phí",
    "Chức năng", "Cao", PLAN, "Cộng đồng đang ở chế độ Miễn phí, đã có thành viên",
    ["Owner vào Cài đặt cộng đồng", "Đổi sang chế độ Có phí, nhập giá", "Lưu"], "-",
    "Cần làm rõ & test theo chính sách đã chốt: thành viên hiện tại có bị yêu cầu trả phí ngay không, hay được giữ quyền truy cập miễn phí tới khi có thay đổi khác")
add(M, MN, "Quản lý cộng đồng", "Owner xóa cộng đồng",
    "Chức năng", "Cao", PLAN, "Owner có 1 cộng đồng, có xác nhận double-check trước khi xóa",
    ["Owner vào Cài đặt cộng đồng", "Bấm 'Xóa cộng đồng'", "Xác nhận theo bước double-check (VD nhập lại tên cộng đồng)"],
    "-", "Cộng đồng và toàn bộ dữ liệu liên quan bị vô hiệu hóa/xóa đúng theo chính sách, thành viên mất quyền truy cập")
add(M, MN, "Tham gia cộng đồng", "Thành viên từng bị loại khỏi cộng đồng riêng tư gửi lại yêu cầu tham gia",
    "Chức năng", "Trung bình", PLAN, "Thành viên đã từng bị Owner loại khỏi cộng đồng riêng tư",
    ["Thành viên đã bị loại trước đó vào lại trang cộng đồng riêng tư", "Gửi yêu cầu tham gia lại"], "-",
    "Yêu cầu được gửi tới Owner như bình thường (hoặc bị chặn nếu có chính sách cấm riêng — cần xác nhận với BA)")
add(M, MN, "Phân quyền", "Owner chuyển giao quyền sở hữu (Owner) cộng đồng cho thành viên khác",
    "Chức năng", "Cao", PLAN, "Owner có 1 cộng đồng, có 1 Admin đáng tin cậy",
    ["Owner vào quản lý thành viên", "Chọn 'Chuyển quyền sở hữu' cho 1 Admin", "Xác nhận"], "-",
    "Người được chuyển trở thành Owner mới, Owner cũ chuyển xuống vai trò thấp hơn theo đúng thiết kế")
add(M, MN, "Trang cộng đồng", "Người chưa tham gia cộng đồng riêng tư không xem được nội dung các tab",
    "Bảo mật", "Cao", PLAN, "Có cộng đồng riêng tư, tài khoản test chưa được duyệt tham gia",
    ["Đăng nhập tài khoản chưa tham gia", "Truy cập trực tiếp URL các tab nội dung của cộng đồng riêng tư đó"],
    "-", "Bị chặn truy cập, chỉ thấy trang giới thiệu sơ lược + nút yêu cầu tham gia")
add(M, MN, "Mời thành viên", "Liên kết mời hết hạn không sử dụng được",
    "Bảo mật", "Trung bình", PLAN, "Owner tạo liên kết mời có thời hạn (VD 7 ngày)",
    ["Owner tạo liên kết mời với thời hạn xác định", "Chờ/giả lập qua thời hạn đó", "Mở liên kết mời"], "-",
    "Hiển thị thông báo liên kết đã hết hạn, không cho tham gia cộng đồng")
add(M, MN, "Mời thành viên", "Liên kết mời dùng được đúng số lần theo cấu hình",
    "Chức năng", "Trung bình", PLAN, "Owner tạo liên kết mời giới hạn 1 lần sử dụng",
    ["Dùng liên kết mời để tham gia (lần 1)", "Dùng lại chính liên kết đó lần 2 bằng tài khoản khác"], "-",
    "Lần 1 thành công; lần 2 bị từ chối do liên kết đã được sử dụng (nếu cấu hình giới hạn 1 lần)")
add(M, MN, "Khám phá cộng đồng", "Cộng đồng riêng tư không hiển thị đầy đủ trên trang khám phá công khai",
    "Bảo mật", "Trung bình", PLAN, "Có cả cộng đồng công khai và riêng tư",
    ["Vào trang khám phá cộng đồng ở chế độ Khách/chưa tham gia"], "-",
    "Cộng đồng riêng tư không hiển thị đầy đủ chi tiết, tuân đúng quy tắc hiển thị theo chế độ Riêng tư")
add(M, MN, "Rời cộng đồng", "Owner không thể tự rời cộng đồng khi chưa chuyển giao quyền sở hữu",
    "Chức năng", "Trung bình", PLAN, "Owner đang sở hữu 1 cộng đồng, chưa chuyển giao",
    ["Owner vào cài đặt cộng đồng", "Thử bấm 'Rời cộng đồng'"], "-",
    "Hệ thống chặn hành động, yêu cầu chuyển giao quyền sở hữu hoặc xóa cộng đồng trước khi rời")

M, MN = "COMMVP", "Cộng đồng MVP (gắn theo khóa học — 2026-09-29)"
add(M, MN, "Bảng tin", "Đăng bài trong cộng đồng của khóa học đã tham gia",
    "Chức năng", "Cao", DONE, "Đã đăng nhập, đã tham gia (enroll) khóa học",
    ["Vào /courses/:id/community", "Nhập nội dung ở ô soạn bài", "Chọn danh mục", "Bấm Đăng bài"], "-",
    "Bài viết xuất hiện ngay đầu bảng tin, đúng tác giả/nội dung/danh mục; BE lưu thật (POST /api/courses/:id/posts)")
add(M, MN, "Bảng tin", "Không đăng bài được khi chưa tham gia khóa học (chặn ở server)",
    "Bảo mật", "Cao", DONE, "Đã đăng nhập, CHƯA tham gia khóa học",
    ["Gọi trực tiếp POST /api/courses/:id/posts bằng access token hợp lệ nhưng chưa enroll"], "-",
    "Trả về 403 (enrollmentService.requireMembership), không tạo được bài viết dù có token hợp lệ")
add(M, MN, "Bảng tin", "Thích bài viết — không tự cộng điểm khi tự thích bài của chính mình",
    "Chức năng", "Trung bình", DONE, "Có bài viết do chính người test tạo",
    ["Tự thích (like) bài viết của chính mình", "Kiểm tra bảng xếp hạng"], "-",
    "Số lượt thích tăng ngay; KHÔNG cộng điểm 'like_received' vì tác giả trùng người thích (đã verify bằng curl)")
add(M, MN, "Bảng tin", "Bình luận bài viết",
    "Chức năng", "Cao", DONE, "Có bài viết trong cộng đồng",
    ["Mở 1 bài viết", "Nhập bình luận", "Gửi"], "-", "Bình luận lưu thật, hiển thị đúng tác giả/thời gian, tăng commentsCount")
add(M, MN, "Bảng tin", "Ghim / bỏ ghim bài viết (chỉ mod trở lên)",
    "Chức năng", "Trung bình", DONE, "Đăng nhập mod@sofinhub.test (mod của photo), có bài viết trong photo",
    ["Vào /courses/photo/community", "Bấm 'Ghim' trên 1 bài viết", "Bấm lại để bỏ ghim"], "-",
    "Trạng thái pinned đảo đúng chiều. ĐÃ SỬA LỖI PHÂN QUYỀN (30/09/2026): chỉ mod trở lên ghim được; member thường không thấy nút và gọi API bị 403 FORBIDDEN (xem các case ma trận quyền ở FEED/ROLE)")
add(M, MN, "Bảng tin", "Lọc bài viết theo danh mục & sắp xếp Mới nhất/Phổ biến",
    "Chức năng", "Trung bình", DONE, "Có bài viết ở nhiều danh mục",
    ["Chọn 1 danh mục cụ thể", "Đổi sắp xếp giữa Mới nhất/Phổ biến"], "-", "Danh sách lọc/sắp xếp đúng, bài ghim luôn lên đầu")
add(M, MN, "Lớp học", "Xem danh sách module với % tiến độ thật theo từng người",
    "Chức năng", "Cao", DONE, "Đã tham gia khóa học",
    ["Vào tab Lớp học"], "-",
    "Module tự sinh từ course.lessons/durationMinutes (GET /api/courses/:id/modules), % tiến độ tính đúng theo bài học đã hoàn thành của riêng user đó")
add(M, MN, "Lớp học", "Module tự động khóa tới khi hoàn thành 100% module trước",
    "Chức năng", "Cao", DONE, "Module 1 chưa hoàn thành hết",
    ["Xem danh sách module khi module 1 chưa xong"], "-",
    "Module 2 trở đi có locked=true; đã verify bằng curl: hoàn thành hết bài học module 1 thì module 2 mới mở")
add(M, MN, "Lớp học", "Chặn ở server khi cố mở bài học của module đang khóa",
    "Bảo mật", "Cao", DONE, "Module 2 đang locked (module 1 chưa xong)",
    ["Gọi trực tiếp GET /api/courses/:id/modules/:moduleId/lessons cho module đang khóa"], "-",
    "Trả về 403 'Cần hoàn thành module trước đó để mở khóa module này', không tin riêng phía FE")
add(M, MN, "Lớp học", "Đánh dấu hoàn thành bài học, % tiến độ cập nhật ngay",
    "Chức năng", "Cao", DONE, "Đang xem 1 bài học chưa hoàn thành",
    ["Bấm hoàn thành 1 bài học"], "-", "completed=true ngay, % tiến độ module tăng đúng tỉ lệ 1/tổng số bài")
add(M, MN, "Lớp học", "Hoàn thành bài học được cộng điểm (+3)",
    "Chức năng", "Trung bình", DONE, "-",
    ["Hoàn thành 1 bài học", "Kiểm tra bảng xếp hạng"], "-", "Điểm tăng đúng +3 (POINT_VALUES.lesson_complete)")
add(M, MN, "Lịch sự kiện", "Tạo sự kiện mới (tên, thời gian, link họp, giới hạn số lượng)",
    "Chức năng", "Cao", DONE, "Đã tham gia khóa học",
    ["Vào tab Lịch sự kiện", "Bấm '+ Tạo sự kiện'", "Điền thông tin", "Tạo"], "-",
    "Sự kiện lưu thật (POST /api/courses/:id/events), hiển thị đúng trong danh sách Sắp diễn ra")
add(M, MN, "Lịch sự kiện", "Đăng ký / hủy đăng ký (RSVP) tham dự",
    "Chức năng", "Cao", DONE, "Có sự kiện sắp diễn ra",
    ["Bấm 'Đăng ký'", "Bấm lại để hủy"], "-", "rsvpCount tăng/giảm đúng, trạng thái nút đổi theo viewerRsvped")
add(M, MN, "Lịch sự kiện", "Từ chối RSVP khi sự kiện đã đủ số lượng giới hạn (capacity)",
    "Chức năng", "Cao", DONE, "Sự kiện có capacity=2, đã có 2 người đăng ký khác",
    ["Người thứ 3 bấm 'Đăng ký'"], "capacity=2, đã đủ", "Trả về 409 'Sự kiện đã đủ số lượng đăng ký' — đã verify capacity kiểm tra thật ở server")
add(M, MN, "Lịch sự kiện", "Không cho RSVP sự kiện đã diễn ra trong quá khứ",
    "Chức năng", "Trung bình", DONE, "Có sự kiện với startAt trong quá khứ",
    ["Gọi RSVP cho sự kiện đã qua"], "-", "Trả về 400 'Sự kiện đã diễn ra, không thể đăng ký'")
add(M, MN, "Thành viên", "Danh sách thành viên tìm kiếm theo tên",
    "Chức năng", "Trung bình", DONE, "Cộng đồng có nhiều thành viên",
    ["Vào tab Thành viên", "Nhập tên vào ô tìm kiếm"], "-", "Trả về đúng thành viên khớp tên (GET /api/courses/:id/members?q=)")
add(M, MN, "Thành viên", "Trạng thái 'Đang trực tuyến' dựa trên hoạt động gần nhất (lastActiveAt)",
    "Chức năng", "Thấp", DONE, "-",
    ["Vừa gọi 1 API bất kỳ trong cộng đồng (touchActivity)", "Xem tab Thành viên"], "Trong 5 phút gần nhất",
    "Hiển thị 'Đang trực tuyến' nếu lastActiveAt trong 5 phút gần nhất, ngược lại 'Không hoạt động'")
add(M, MN, "Bảng xếp hạng", "Tính điểm đúng theo cửa sổ thời gian 7 ngày / 30 ngày / mọi thời điểm",
    "Chức năng", "Cao", DONE, "Có hoạt động ghi nhận điểm",
    ["Xem bảng xếp hạng, đổi qua lại 3 tab thời gian"], "-", "Tổng điểm tính đúng theo đúng cửa sổ thời gian được chọn (GET /api/courses/:id/leaderboard?window=)")
add(M, MN, "Bảng xếp hạng", "Cộng điểm đúng cho từng loại hoạt động (đăng bài +5, nhận thích +2, RSVP +1)",
    "Chức năng", "Trung bình", DONE, "-",
    ["Thực hiện lần lượt: đăng bài, được người khác thích, RSVP sự kiện", "Kiểm tra tổng điểm"], "-",
    "Điểm cộng đúng theo POINT_VALUES: post=5, like_received=2, lesson_complete=3, event_rsvp=1")
add(M, MN, "Thanh toán", "Tạo giao dịch (checkout) cho khóa học có phí",
    "Chức năng", "Cao", DONE, "Khóa học có priceUsd > 0, chưa tham gia",
    ["Bấm 'Tham gia ngay' trên khóa có phí", "Xác nhận dialog", "Chọn phương thức thanh toán", "Bấm Thanh toán"], "-",
    "Tạo PaymentIntent status=pending (POST /api/courses/:id/checkout), đúng amountUsd theo giá khóa học")
add(M, MN, "Thanh toán", "Không cho checkout khóa học miễn phí",
    "Chức năng", "Trung bình", DONE, "Khóa học priceUsd = 0",
    ["Gọi POST /api/courses/:id/checkout cho khóa miễn phí"], "-", "Trả về 400 'Khóa học này miễn phí, không cần thanh toán'")
add(M, MN, "Thanh toán", "Chặn truy cập nội dung cộng đồng trước khi xác nhận thanh toán",
    "Bảo mật", "Cao", DONE, "Đã checkout (PaymentIntent pending) nhưng CHƯA confirm",
    ["Gọi GET /api/courses/:id/posts ngay sau khi checkout, trước khi confirm"], "-",
    "Trả về 403 — đã verify: nội dung chỉ mở sau khi confirm thành công, không tin trạng thái 'pending' là đã có quyền")
add(M, MN, "Thanh toán", "Xác nhận thanh toán cấp quyền truy cập thật ngay lập tức",
    "Chức năng", "Cao", DONE, "Có PaymentIntent đang pending",
    ["Gọi POST /api/payments/:id/confirm"], "-",
    "status chuyển succeeds, enrollmentService.grant() cấp quyền ngay — gọi lại GET .../posts sau đó trả 200")
add(M, MN, "Thanh toán", "Xác nhận lại giao dịch đã thành công không xử lý trùng (idempotent)",
    "Bảo mật", "Cao", DONE, "PaymentIntent đã ở trạng thái succeeded",
    ["Gọi POST /api/payments/:id/confirm lần thứ 2"], "-",
    "Trả về đúng thông tin giao dịch đã succeeded, không cấp quyền/ghi log trùng lần 2 — đã verify bằng curl")
add(M, MN, "Thanh toán", "Không cho checkout lại khi đã tham gia khóa học rồi",
    "Chức năng", "Trung bình", DONE, "Đã tham gia (enrolled) khóa học",
    ["Gọi lại POST /api/courses/:id/checkout cho khóa đã tham gia"], "-", "Trả về 409 'Bạn đã tham gia khóa học này rồi'")
add(M, MN, "Điều hướng", "Vào thẳng URL /courses/:id/community khi chưa tham gia sẽ bị chuyển hướng",
    "Chức năng", "Trung bình", DONE, "Chưa tham gia khóa học",
    ["Gõ thẳng URL /courses/:id/community khi chưa enroll"], "-",
    "FE tự redirect về /courses/:id (chặn UX sớm); quyền thật vẫn do từng API con tự xác thực lại ở server, không tin riêng cờ viewerEnrolled ở FE")
add(M, MN, "Điều hướng", "Bấm 'Tham gia ngay' trên khóa có phí hiện dialog xác nhận trước khi sang trang thanh toán",
    "Chức năng", "Cao", DONE, "Khóa học có phí, chưa tham gia, đã đăng nhập",
    ["Bấm 'Tham gia ngay'"], "-",
    "Hiện dialog thông báo giá + thông tin dùng thử, có nút 'Đi tới thanh toán' → điều hướng /courses/:id/checkout. Khóa miễn phí thì bỏ qua dialog, vào thẳng /courses/:id/community")

# ============================= 4. KHÓA HỌC / LỚP HỌC =========================
M, MN = "COURSE", "Khóa học / Lớp học"
add(M, MN, "Trang chi tiết khóa học", "Hiển thị đầy đủ thông tin khóa học (mô tả, giảng viên, đánh giá, nội dung, giá, FAQ)",
    "Giao diện", "Cao", DONE, "Khóa học đã tồn tại trong hệ thống",
    ["Vào trang khám phá", "Bấm vào 1 khóa học", "Kiểm tra đủ các khu vực: mô tả, giảng viên, đánh giá, nội dung, giá, FAQ"],
    "-", "Tất cả thông tin hiển thị đầy đủ, chính xác, không thiếu khu vực nào")
add(M, MN, "Trang chi tiết khóa học", "Xem trang chi tiết khóa học khi chưa đăng nhập (Khách)",
    "Chức năng", "Trung bình", DONE, "Chưa đăng nhập",
    ["Vào trang chi tiết 1 khóa học công khai khi chưa đăng nhập"], "-",
    "Xem được thông tin sơ lược công khai, không xem được nội dung chi tiết bên trong (theo vai trò Khách)")
add(M, MN, "Tham gia khóa học", "Tham gia khóa học thành công, lưu trạng thái ở server",
    "Chức năng", "Cao", DONE, "Đã đăng nhập, khóa học ở trạng thái có thể tham gia",
    ["Vào trang chi tiết khóa học", "Bấm 'Tham gia ngay'"], "-",
    "Trạng thái 'Đã tham gia' được ghi nhận, hiển thị đúng ngay sau khi bấm")
add(M, MN, "Tham gia khóa học", "Trạng thái tham gia khóa học không mất khi tải lại trang",
    "Chức năng", "Cao", DONE, "Đã tham gia 1 khóa học",
    ["Tham gia 1 khóa học", "Nhấn F5 tải lại trang", "Kiểm tra trạng thái tham gia"], "-",
    "Trạng thái 'Đã tham gia' vẫn được giữ nguyên (dữ liệu lấy từ server, không chỉ ở client)")
add(M, MN, "Tham gia khóa học", "Tham gia lại khóa học đã tham gia trước đó (idempotent)",
    "Chức năng", "Trung bình", DONE, "Đã tham gia 1 khóa học",
    ["Vào lại trang chi tiết khóa học đã tham gia", "Bấm nút tham gia (nếu còn hiển thị) hoặc F5 nhiều lần"],
    "-", "Không tạo bản ghi tham gia trùng lặp, trạng thái vẫn nhất quán")
add(M, MN, "Soạn thảo khóa học", "Owner tạo Module mới trong khóa học",
    "Chức năng", "Cao", PLAN, "Đăng nhập với vai trò Owner của cộng đồng",
    ["Vào trang quản trị khóa học", "Bấm 'Thêm Module'", "Nhập tên module", "Lưu"], "-",
    "Module mới được tạo và hiển thị đúng thứ tự trong khóa học")
add(M, MN, "Soạn thảo khóa học", "Owner thêm bài học dạng video vào module",
    "Chức năng", "Cao", PLAN, "Đã có ít nhất 1 module",
    ["Vào module", "Bấm 'Thêm bài học'", "Chọn loại Video", "Nhập link video và lưu"], "-",
    "Bài học video được thêm, phát được nội dung khi vào học")
add(M, MN, "Soạn thảo khóa học", "Owner thêm bài học dạng văn bản/tệp đính kèm",
    "Chức năng", "Trung bình", PLAN, "Đã có ít nhất 1 module",
    ["Vào module", "Bấm 'Thêm bài học'", "Chọn loại Văn bản, nhập nội dung hoặc đính kèm tệp", "Lưu"],
    "-", "Bài học được thêm, hiển thị đúng nội dung/tệp khi học viên mở")
add(M, MN, "Soạn thảo khóa học", "Sắp xếp lại thứ tự module/bài học",
    "Chức năng", "Trung bình", PLAN, "Khóa học có từ 2 module/bài học trở lên",
    ["Vào trang quản trị khóa học", "Kéo-thả đổi thứ tự module hoặc bài học", "Lưu"], "-",
    "Thứ tự hiển thị cho học viên thay đổi đúng theo thứ tự mới đã sắp xếp")
add(M, MN, "Học & tiến độ", "Đánh dấu hoàn thành một bài học",
    "Chức năng", "Cao", PLAN, "Đã tham gia khóa học, đang xem 1 bài học",
    ["Vào trang học", "Xem hết bài học", "Bấm 'Đánh dấu hoàn thành'"], "-",
    "Bài học chuyển trạng thái Hoàn thành, % tiến độ tổng của khóa học được cập nhật")
add(M, MN, "Học & tiến độ", "Hiển thị đúng % tiến độ tổng khóa học",
    "Chức năng", "Trung bình", PLAN, "Đã hoàn thành một số bài học trong khóa học",
    ["Hoàn thành N/tổng số M bài học", "Kiểm tra thanh tiến độ hiển thị"], "N=3, M=10",
    "% tiến độ hiển thị = (N/M)*100%, chính xác theo số liệu thực tế")
add(M, MN, "Khóa bài học theo gói", "Người chưa trả phí không xem được nội dung bài học đã khóa",
    "Bảo mật", "Cao", PLAN, "Khóa học có phần nội dung khóa cho người trả phí, tài khoản test chưa trả phí",
    ["Đăng nhập tài khoản chưa trả phí", "Vào khóa học có phần nội dung khóa", "Cố mở bài học đã khóa"],
    "-", "Không truy cập được nội dung, hiển thị thông báo cần nâng cấp/trả phí")
add(M, MN, "Khóa bài học theo gói", "Quyền truy cập nội dung được xác thực ở server (không chỉ chặn ở giao diện)",
    "Bảo mật", "Cao", PLAN, "Tài khoản chưa trả phí, biết được endpoint API lấy nội dung bài học",
    ["Đăng nhập tài khoản chưa trả phí", "Gọi trực tiếp API lấy nội dung bài học đã khóa (qua Postman/DevTools), bỏ qua giao diện"],
    "-", "API trả về lỗi từ chối truy cập (401/403), không trả về nội dung dù bypass giao diện")
add(M, MN, "Nhúng video bài giảng", "Nhúng và phát video từ YouTube",
    "Tích hợp", "Trung bình", PLAN, "Bài học có link YouTube hợp lệ",
    ["Vào bài học có video YouTube", "Bấm play"], "Link YouTube hợp lệ",
    "Video load và phát được ngay trong trang, không lỗi embed")
add(M, MN, "Nhúng video bài giảng", "Nhúng và phát video từ Vimeo",
    "Tích hợp", "Trung bình", PLAN, "Bài học có link Vimeo hợp lệ",
    ["Vào bài học có video Vimeo", "Bấm play"], "Link Vimeo hợp lệ",
    "Video load và phát được ngay trong trang, không lỗi embed")

add(M, MN, "Trang chi tiết khóa học", "Giao diện khác nhau giữa người đã tham gia và chưa tham gia khóa học",
    "Giao diện", "Trung bình", DONE, "Có 2 tài khoản: 1 đã tham gia, 1 chưa tham gia",
    ["Đăng nhập tài khoản đã tham gia, xem trang chi tiết khóa học", "Đăng nhập tài khoản chưa tham gia, xem cùng khóa học"],
    "-", "Tài khoản đã tham gia thấy nút/khu vực 'Vào học'; tài khoản chưa tham gia thấy nút 'Tham gia ngay', không lẫn lộn")
add(M, MN, "Trang chi tiết khóa học", "Khóa học chưa có đánh giá nào vẫn hiển thị đúng, không lỗi",
    "Chức năng", "Thấp", DONE, "Có khóa học mới chưa có review/rating",
    ["Mở trang chi tiết 1 khóa học chưa có đánh giá"], "-",
    "Khu vực đánh giá hiển thị trạng thái rỗng hợp lý, không lỗi giao diện/số liệu NaN")
add(M, MN, "Tham gia khóa học", "Bấm 'Tham gia ngay' nhiều lần liên tiếp (double click) không tạo bản ghi trùng",
    "Chức năng", "Cao", DONE, "Đã đăng nhập, khóa học chưa tham gia",
    ["Vào trang chi tiết khóa học", "Bấm rất nhanh 2-3 lần liên tiếp vào nút 'Tham gia ngay'"], "-",
    "Chỉ tạo đúng 1 bản ghi tham gia, không lỗi trùng lặp hoặc lỗi 500")
add(M, MN, "Khóa bài học theo gói", "Owner xem trước được toàn bộ nội dung khóa học của chính mình dù chưa trả phí",
    "Chức năng", "Trung bình", PLAN, "Đăng nhập với vai trò Owner của cộng đồng chứa khóa học có phí",
    ["Owner vào khóa học có phí do chính mình tạo", "Mở các bài học đã khóa cho người trả phí"], "-",
    "Owner xem được toàn bộ nội dung không cần thanh toán (quyền sở hữu nội dung)")
add(M, MN, "Soạn thảo khóa học", "Không cho phép Member thường truy cập trang soạn thảo khóa học",
    "Bảo mật", "Cao", PLAN, "Tài khoản chỉ là Member thường trong cộng đồng",
    ["Đăng nhập tài khoản Member thường", "Cố truy cập URL trang soạn thảo khóa học của cộng đồng đó"], "-",
    "Bị từ chối truy cập/chuyển hướng, không vào được trang quản trị nội dung")

# ============================= 5. BẢNG TIN & TƯƠNG TÁC =======================
M, MN = "FEED", "Bảng tin & Tương tác cộng đồng"
add(M, MN, "Đăng bài", "Đăng bài viết dạng văn bản",
    "Chức năng", "Cao", PLAN, "Là thành viên của cộng đồng",
    ["Vào Bảng tin cộng đồng", "Bấm 'Tạo bài viết'", "Nhập nội dung văn bản", "Đăng"], "-",
    "Bài viết xuất hiện ngay trên bảng tin với đúng nội dung, tác giả, thời gian")
add(M, MN, "Đăng bài", "Đăng bài viết kèm ảnh",
    "Chức năng", "Trung bình", PLAN, "Là thành viên của cộng đồng",
    ["Tạo bài viết mới", "Đính kèm 1 hoặc nhiều ảnh", "Đăng"], "Ảnh JPG/PNG hợp lệ",
    "Bài viết hiển thị kèm ảnh đúng, ảnh load được, không vỡ layout")
add(M, MN, "Đăng bài", "Đăng bài viết kèm video",
    "Chức năng", "Trung bình", PLAN, "Là thành viên của cộng đồng",
    ["Tạo bài viết mới", "Đính kèm video", "Đăng"], "Video hợp lệ",
    "Bài viết hiển thị kèm video, phát được trực tiếp trên bảng tin")
add(M, MN, "Đăng bài", "Gắn danh mục cho bài viết",
    "Chức năng", "Thấp", PLAN, "Là thành viên của cộng đồng",
    ["Tạo bài viết mới", "Chọn danh mục bài viết", "Đăng"], "-",
    "Bài viết được gắn đúng danh mục, lọc bảng tin theo danh mục hoạt động đúng")
add(M, MN, "Bình luận", "Bình luận vào một bài viết",
    "Chức năng", "Cao", PLAN, "Có bài viết trên bảng tin",
    ["Mở 1 bài viết", "Nhập nội dung bình luận", "Gửi"], "-",
    "Bình luận xuất hiện ngay dưới bài viết với đúng nội dung, tác giả, thời gian")
add(M, MN, "Bình luận", "Trả lời (reply) một bình luận — lồng 1 cấp",
    "Chức năng", "Trung bình", PLAN, "Bài viết đã có ít nhất 1 bình luận",
    ["Mở bài viết có bình luận", "Bấm 'Trả lời' trên 1 bình luận", "Nhập nội dung", "Gửi"], "-",
    "Trả lời hiển thị lồng bên dưới bình luận gốc (chỉ 1 cấp, không lồng thêm cấp con)")
add(M, MN, "Thích (Like)", "Thích một bài viết",
    "Chức năng", "Trung bình", PLAN, "Có bài viết trên bảng tin",
    ["Mở bảng tin", "Bấm icon Thích trên 1 bài viết"], "-",
    "Số lượt thích tăng ngay lập tức (tức thời), trạng thái thích được lưu cho đúng người dùng")
add(M, MN, "Thích (Like)", "Bỏ thích một bài viết đã thích",
    "Chức năng", "Thấp", PLAN, "Đã thích 1 bài viết trước đó",
    ["Bấm lại icon Thích trên bài viết đã thích"], "-",
    "Số lượt thích giảm, trạng thái thích của người dùng được gỡ")
add(M, MN, "Ghim bài viết", "Owner/Admin ghim bài viết thông báo quan trọng",
    "Chức năng", "Trung bình", PLAN, "Đăng nhập vai trò Owner/Admin, có bài viết trong cộng đồng",
    ["Mở bài viết cần ghim", "Bấm 'Ghim bài viết'"], "-",
    "Bài viết được đưa lên đầu bảng tin, có nhãn 'Đã ghim'")
add(M, MN, "Ghim bài viết", "Bỏ ghim bài viết",
    "Chức năng", "Thấp", PLAN, "Có bài viết đang được ghim",
    ["Mở bài viết đang ghim", "Bấm 'Bỏ ghim'"], "-",
    "Bài viết trở lại vị trí theo thứ tự thời gian bình thường")
add(M, MN, "Bảng tin cuộn vô hạn", "Tự động tải thêm bài viết khi cuộn xuống cuối trang",
    "Hiệu năng", "Trung bình", PLAN, "Cộng đồng có nhiều bài viết (vượt quá 1 trang tải ban đầu)",
    ["Vào bảng tin cộng đồng", "Cuộn chuột xuống cuối danh sách bài viết hiện có"], "-",
    "Hệ thống tự động tải thêm bài viết tiếp theo, không cần bấm nút, không load trùng bài đã có")

add(M, MN, "Đăng bài", "Chỉnh sửa bài viết đã đăng",
    "Chức năng", "Trung bình", PLAN, "Đã đăng 1 bài viết",
    ["Mở bài viết của mình", "Bấm 'Chỉnh sửa'", "Thay đổi nội dung", "Lưu"], "-",
    "Nội dung được cập nhật, có thể hiển thị nhãn 'Đã chỉnh sửa'")
add(M, MN, "Đăng bài", "Xóa bài viết của chính mình",
    "Chức năng", "Trung bình", PLAN, "Đã đăng 1 bài viết",
    ["Mở bài viết của mình", "Bấm 'Xóa'", "Xác nhận"], "-",
    "Bài viết biến mất khỏi bảng tin, các bình luận liên quan cũng bị xóa/ẩn theo")
add(M, MN, "Đăng bài", "Thành viên không thể chỉnh sửa/xóa bài viết của người khác",
    "Bảo mật", "Cao", PLAN, "Có bài viết của thành viên B, đăng nhập bằng thành viên A",
    ["Thành viên A mở bài viết của thành viên B", "Kiểm tra có nút Sửa/Xóa hay không, thử gọi API sửa/xóa trực tiếp nếu có"],
    "-", "Không thấy nút Sửa/Xóa trên giao diện; gọi API trực tiếp cũng bị từ chối (403)")
add(M, MN, "Đăng bài", "Giới hạn độ dài nội dung bài viết",
    "Chức năng", "Thấp", PLAN, "-",
    ["Nhập nội dung bài viết vượt quá giới hạn ký tự cho phép", "Bấm Đăng"], "Nội dung > giới hạn ký tự quy định",
    "Hệ thống báo lỗi vượt giới hạn hoặc tự cắt theo đúng thiết kế, không lỗi hệ thống")
add(M, MN, "Bình luận", "Thành viên báo cáo bình luận vi phạm (không chỉ bài viết)",
    "Chức năng", "Trung bình", PLAN, "Có bình luận trên 1 bài viết",
    ["Mở bài viết có bình luận", "Bấm 'Báo cáo' trên 1 bình luận cụ thể", "Chọn lý do và gửi"], "-",
    "Báo cáo được ghi nhận đúng đối tượng là bình luận, chuyển tới hàng đợi kiểm duyệt")
add(M, MN, "Bình luận", "Xóa bình luận của chính mình",
    "Chức năng", "Thấp", PLAN, "Đã bình luận 1 bài viết",
    ["Mở bình luận của mình", "Bấm 'Xóa'", "Xác nhận"], "-", "Bình luận bị xóa/ẩn khỏi bài viết")
add(M, MN, "Ghim bài viết", "Thành viên thường không thấy nút Ghim bài viết",
    "Bảo mật", "Trung bình", PLAN, "Đăng nhập vai trò Member thường",
    ["Member thường mở 1 bài viết bất kỳ trong cộng đồng", "Kiểm tra có nút 'Ghim bài viết' hay không"], "-",
    "Không hiển thị nút Ghim; gọi API ghim trực tiếp cũng bị từ chối nếu thử bypass giao diện")

# ============================= 6. THÀNH VIÊN, HỒ SƠ & XẾP HẠNG ===============
M, MN = "MEMBER", "Thành viên, Hồ sơ & Xếp hạng"
add(M, MN, "Danh sách thành viên", "Tìm kiếm thành viên theo tên trong cộng đồng",
    "Chức năng", "Trung bình", PLAN, "Cộng đồng có nhiều thành viên",
    ["Vào tab Thành viên", "Nhập tên vào ô tìm kiếm"], "Tên thành viên có thật",
    "Trả về đúng thành viên khớp tên tìm kiếm")
add(M, MN, "Danh sách thành viên", "Lọc danh sách thành viên theo vai trò (Owner/Admin/Member)",
    "Chức năng", "Trung bình", PLAN, "Cộng đồng có thành viên ở nhiều vai trò",
    ["Vào tab Thành viên", "Chọn lọc theo vai trò 'Admin'"], "-",
    "Chỉ hiển thị các thành viên có vai trò Admin trong cộng đồng đó")
add(M, MN, "Hệ thống điểm", "Cộng điểm khi thành viên đăng bài",
    "Chức năng", "Trung bình", PLAN, "Thành viên có điểm ban đầu xác định",
    ["Ghi nhận điểm hiện tại của thành viên", "Thành viên đăng 1 bài viết mới", "Kiểm tra lại điểm"],
    "-", "Điểm tăng đúng theo quy tắc cộng điểm khi đăng bài")
add(M, MN, "Hệ thống điểm", "Cộng điểm khi bài viết/bình luận của thành viên được thích",
    "Chức năng", "Trung bình", PLAN, "Thành viên có bài viết/bình luận",
    ["Người khác thích bài viết/bình luận của thành viên", "Kiểm tra điểm của thành viên đó"],
    "-", "Điểm tăng đúng theo quy tắc khi nhận được lượt thích")
add(M, MN, "Hệ thống điểm", "Cộng điểm khi hoàn thành bài học",
    "Chức năng", "Trung bình", PLAN, "Thành viên đang học 1 khóa học",
    ["Thành viên đánh dấu hoàn thành 1 bài học", "Kiểm tra điểm của thành viên"], "-",
    "Điểm tăng đúng theo quy tắc khi hoàn thành bài học")
add(M, MN, "Bảng xếp hạng", "Xem bảng xếp hạng theo 7 ngày",
    "Chức năng", "Thấp", PLAN, "Có hoạt động ghi nhận điểm trong 7 ngày gần nhất",
    ["Vào bảng xếp hạng", "Chọn khoảng thời gian '7 ngày'"], "-",
    "Xếp hạng đúng theo tổng điểm tích lũy trong 7 ngày gần nhất, sắp xếp giảm dần")
add(M, MN, "Bảng xếp hạng", "Xem bảng xếp hạng theo 30 ngày",
    "Chức năng", "Thấp", PLAN, "Có hoạt động ghi nhận điểm trong 30 ngày gần nhất",
    ["Vào bảng xếp hạng", "Chọn khoảng thời gian '30 ngày'"], "-",
    "Xếp hạng đúng theo tổng điểm tích lũy trong 30 ngày gần nhất")
add(M, MN, "Bảng xếp hạng", "Xem bảng xếp hạng mọi thời điểm",
    "Chức năng", "Thấp", PLAN, "Có dữ liệu điểm tích lũy",
    ["Vào bảng xếp hạng", "Chọn 'Mọi thời điểm'"], "-",
    "Xếp hạng đúng theo tổng điểm từ trước tới nay, sắp xếp giảm dần")

add(M, MN, "Hệ thống điểm", "Điểm không bị trừ khi bỏ thích (unlike) sau khi đã thích",
    "Chức năng", "Thấp", PLAN, "Thành viên đã nhận 1 lượt thích và được cộng điểm",
    ["Người thích bỏ thích (unlike) bài viết/bình luận đó", "Kiểm tra lại điểm của thành viên nhận thích"], "-",
    "Cần xác nhận quy tắc với BA: điểm có bị trừ lại khi unlike hay giữ nguyên — test theo đúng quy tắc đã chốt")
add(M, MN, "Bảng xếp hạng", "Xử lý đồng điểm (tie-break) trên bảng xếp hạng",
    "Chức năng", "Thấp", PLAN, "Có từ 2 thành viên cùng tổng điểm bằng nhau",
    ["Tạo dữ liệu 2 thành viên có điểm bằng nhau", "Xem bảng xếp hạng"], "2 thành viên cùng điểm",
    "Có quy tắc xếp hạng phụ rõ ràng (VD theo thời gian đạt điểm, alphabet...), không hiển thị ngẫu nhiên/không nhất quán")
add(M, MN, "Danh sách thành viên", "Thành viên bị cấm không hiển thị trong danh sách thành viên/bảng xếp hạng",
    "Bảo mật", "Trung bình", PLAN, "Có thành viên đã bị Platform Admin cấm",
    ["Platform Admin cấm 1 thành viên", "Kiểm tra danh sách thành viên và bảng xếp hạng của cộng đồng"], "-",
    "Thành viên bị cấm không còn xuất hiện trong danh sách/bảng xếp hạng công khai")
add(M, MN, "Hồ sơ thành viên", "Xem hồ sơ công khai của thành viên khác",
    "Chức năng", "Thấp", PLAN, "Có 2 thành viên trong cùng cộng đồng",
    ["Mở danh sách thành viên", "Bấm vào 1 thành viên để xem hồ sơ"], "-",
    "Hiển thị đúng thông tin công khai, không lộ thông tin riêng tư (email, lịch sử thanh toán...)")

# ============================= 7. LỊCH & SỰ KIỆN =============================
M, MN = "EVENT", "Lịch & Sự kiện"
add(M, MN, "Tạo sự kiện", "Owner/Admin tạo sự kiện mới đầy đủ thông tin",
    "Chức năng", "Cao", PLAN, "Đăng nhập vai trò Owner/Admin",
    ["Vào tab Lịch", "Bấm 'Tạo sự kiện'", "Nhập tên, thời gian, múi giờ, liên kết họp trực tuyến", "Lưu"],
    "-", "Sự kiện được tạo và hiển thị đúng thông tin trên lịch cộng đồng")
add(M, MN, "Tạo sự kiện", "Giới hạn số lượng người tham dự khi tạo sự kiện",
    "Chức năng", "Trung bình", PLAN, "-",
    ["Tạo sự kiện mới", "Đặt giới hạn số lượng tham dự (VD 50 người)", "Lưu"], "Giới hạn: 50",
    "Khi đủ 50 người đăng ký, hệ thống không cho đăng ký thêm (hiển thị 'Đã đầy'/danh sách chờ)")
add(M, MN, "RSVP", "Đăng ký tham dự sự kiện",
    "Chức năng", "Cao", PLAN, "Có sự kiện sắp diễn ra, đã đăng nhập",
    ["Mở trang sự kiện", "Bấm 'Đăng ký tham dự'"], "-",
    "Trạng thái tham dự được ghi nhận, số lượng đăng ký cập nhật đúng")
add(M, MN, "RSVP", "Hủy đăng ký tham dự sự kiện",
    "Chức năng", "Trung bình", PLAN, "Đã đăng ký tham dự 1 sự kiện",
    ["Mở trang sự kiện đã đăng ký", "Bấm 'Hủy tham dự'"], "-",
    "Trạng thái tham dự bị gỡ, chỗ trống được giải phóng nếu sự kiện có giới hạn số lượng")
add(M, MN, "Đồng bộ lịch", "Thêm sự kiện vào Google Calendar",
    "Tích hợp", "Thấp", PLAN, "Đã đăng ký tham dự sự kiện",
    ["Mở trang sự kiện", "Bấm 'Thêm vào Google Calendar'"], "-",
    "Mở đúng luồng thêm sự kiện vào Google Calendar với đầy đủ thông tin thời gian/liên kết")
add(M, MN, "Đồng bộ lịch", "Xuất file .ics của sự kiện",
    "Tích hợp", "Thấp", PLAN, "Đã đăng ký tham dự sự kiện",
    ["Mở trang sự kiện", "Bấm 'Tải file .ics'"], "-",
    "File .ics tải về hợp lệ, import được vào các ứng dụng lịch khác")
add(M, MN, "Nhắc lịch", "Nhận thông báo/email nhắc trước giờ sự kiện diễn ra",
    "Tích hợp", "Trung bình", PLAN, "Đã đăng ký tham dự, sự kiện sắp diễn ra",
    ["Chờ tới thời điểm nhắc trước sự kiện theo cấu hình (VD 30 phút/1 ngày trước)"], "-",
    "Nhận được thông báo trong hệ thống và/hoặc email nhắc đúng thời điểm cấu hình")

add(M, MN, "Tạo sự kiện", "Owner chỉnh sửa thông tin sự kiện đã tạo",
    "Chức năng", "Trung bình", PLAN, "Đã tạo 1 sự kiện sắp diễn ra",
    ["Owner mở sự kiện đã tạo", "Sửa thời gian/thông tin", "Lưu"], "-",
    "Thông tin cập nhật đúng, người đã đăng ký tham dự được thông báo về thay đổi")
add(M, MN, "Tạo sự kiện", "Owner hủy sự kiện, thông báo tới người đã đăng ký",
    "Chức năng", "Cao", PLAN, "Sự kiện có người đã đăng ký tham dự",
    ["Owner bấm 'Hủy sự kiện'", "Xác nhận"], "-",
    "Sự kiện chuyển trạng thái Đã hủy, toàn bộ người đã đăng ký nhận được thông báo/email hủy")
add(M, MN, "RSVP", "Không thể đăng ký tham dự sự kiện đã diễn ra trong quá khứ",
    "Chức năng", "Trung bình", PLAN, "Có sự kiện đã qua thời gian diễn ra",
    ["Mở trang 1 sự kiện đã diễn ra trong quá khứ", "Thử bấm 'Đăng ký tham dự'"], "-",
    "Nút đăng ký bị ẩn/vô hiệu hóa, không cho đăng ký sự kiện đã qua")
add(M, MN, "Múi giờ", "Hiển thị đúng giờ sự kiện theo múi giờ của từng người xem khác nhau",
    "Chức năng", "Trung bình", PLAN, "Sự kiện được tạo với múi giờ cụ thể (VD GMT+7)",
    ["Tạo sự kiện với múi giờ GMT+7, giờ cụ thể", "Xem trang sự kiện từ tài khoản đặt múi giờ khác (VD GMT+0)"],
    "Múi giờ tạo: GMT+7", "Giờ hiển thị được quy đổi đúng theo múi giờ người xem (hoặc hiển thị rõ múi giờ gốc nếu không tự quy đổi)")
add(M, MN, "Giới hạn số lượng tham dự", "Đăng ký tham dự khi sự kiện đã đủ số lượng tối đa",
    "Chức năng", "Cao", PLAN, "Sự kiện đã đạt giới hạn số lượng tham dự tối đa",
    ["Sự kiện đã đủ số lượng đăng ký tối đa", "Người dùng mới thử bấm 'Đăng ký tham dự'"], "Đã đủ giới hạn (VD 50/50)",
    "Hiển thị 'Đã đầy'/cho vào danh sách chờ theo đúng thiết kế, không cho vượt giới hạn")

# ============================= 8. THÔNG BÁO & NHẮN TIN ========================
M, MN = "NOTI", "Thông báo & Nhắn tin"
add(M, MN, "Chuông thông báo", "Nhận thông báo khi có người bình luận bài viết của mình",
    "Chức năng", "Trung bình", PLAN, "Có bài viết của người dùng A",
    ["Người dùng B bình luận vào bài viết của A", "Kiểm tra chuông thông báo của A"], "-",
    "A nhận được thông báo mới về bình luận, số đếm chuông thông báo tăng")
add(M, MN, "Chuông thông báo", "Nhận thông báo khi bài viết/bình luận được thích",
    "Chức năng", "Thấp", PLAN, "Có bài viết/bình luận của người dùng A",
    ["Người dùng B thích bài viết/bình luận của A", "Kiểm tra chuông thông báo của A"], "-",
    "A nhận được thông báo về lượt thích mới")
add(M, MN, "Chuông thông báo", "Nhận thông báo khi được mời vào cộng đồng",
    "Chức năng", "Trung bình", PLAN, "Owner gửi lời mời tới người dùng A",
    ["Owner mời A vào cộng đồng riêng tư", "Kiểm tra chuông thông báo của A"], "-",
    "A nhận được thông báo lời mời kèm hành động chấp nhận/từ chối")
add(M, MN, "Tin nhắn trực tiếp", "Gửi tin nhắn 1-1 tới thành viên khác",
    "Chức năng", "Trung bình", PLAN, "2 tài khoản cùng ở chung 1 cộng đồng",
    ["Mở hồ sơ 1 thành viên", "Bấm 'Nhắn tin'", "Nhập nội dung và gửi"], "-",
    "Tin nhắn được gửi và hiển thị đúng trong khung chat của cả 2 bên")
add(M, MN, "Tin nhắn trực tiếp", "Nhận tin nhắn trực tiếp theo thời gian thực",
    "Chức năng", "Trung bình", PLAN, "Đang mở cuộc trò chuyện 1-1",
    ["Người A gửi tin nhắn cho người B đang online", "Quan sát màn hình của B"], "-",
    "B nhận được tin nhắn ngay không cần tải lại trang (real-time)")
add(M, MN, "Email giao dịch", "Gửi email xác nhận khi đăng ký tài khoản/tham gia thành công",
    "Tích hợp", "Trung bình", PLAN, "Vừa đăng ký tài khoản hoặc tham gia gói trả phí",
    ["Hoàn tất đăng ký/tham gia", "Kiểm tra hộp thư email đã đăng ký"], "-",
    "Nhận được email xác nhận đúng nội dung, đúng thời gian hợp lý (vài phút)")
add(M, MN, "Email giao dịch", "Gửi email hóa đơn sau khi thanh toán thành công",
    "Tích hợp", "Trung bình", PLAN, "Vừa thanh toán thành công 1 gói",
    ["Thanh toán thành công", "Kiểm tra hộp thư email"], "-",
    "Nhận được email hóa đơn với đầy đủ thông tin giao dịch, số tiền, gói đã mua")
add(M, MN, "Email giao dịch", "Gửi email nhắc gia hạn trước ngày thu phí chu kỳ mới",
    "Tích hợp", "Trung bình", PLAN, "Có gói sắp tới chu kỳ gia hạn",
    ["Chờ tới thời điểm nhắc trước gia hạn theo cấu hình"], "-",
    "Nhận được email nhắc gia hạn trước ngày thu phí thực tế")

add(M, MN, "Chuông thông báo", "Đánh dấu đã đọc một thông báo",
    "Chức năng", "Thấp", PLAN, "Có thông báo chưa đọc",
    ["Mở chuông thông báo", "Bấm vào 1 thông báo chưa đọc"], "-",
    "Thông báo chuyển trạng thái đã đọc, số đếm chưa đọc giảm tương ứng")
add(M, MN, "Chuông thông báo", "Đánh dấu tất cả thông báo đã đọc",
    "Chức năng", "Thấp", PLAN, "Có nhiều thông báo chưa đọc",
    ["Mở chuông thông báo", "Bấm 'Đánh dấu tất cả đã đọc'"], "-",
    "Toàn bộ thông báo chuyển trạng thái đã đọc, số đếm về 0")
add(M, MN, "Tin nhắn trực tiếp", "Không thể nhắn tin cho người không cùng cộng đồng nào",
    "Bảo mật", "Trung bình", PLAN, "2 tài khoản không chung cộng đồng nào",
    ["Thử mở khung chat/nhắn tin tới 1 tài khoản không cùng cộng đồng nào với mình"], "-",
    "Bị chặn hoặc không có tùy chọn nhắn tin, tuân theo đúng quy tắc quyền riêng tư")
add(M, MN, "Email giao dịch", "Email giao dịch gửi đúng ngôn ngữ theo cài đặt tài khoản",
    "Tích hợp", "Thấp", PLAN, "Tài khoản đã chọn ngôn ngữ English",
    ["Đổi ngôn ngữ tài khoản sang English", "Kích hoạt 1 sự kiện gửi email giao dịch (VD đăng ký thành công)",
     "Kiểm tra nội dung email"], "-",
    "Email nhận được có nội dung bằng tiếng Anh, đúng theo cài đặt ngôn ngữ tài khoản")

# ============================= 9. THANH TOÁN & GÓI THÀNH VIÊN =================
M, MN = "PAY", "Thanh toán & Gói thành viên"
add(M, MN, "Chọn gói & thanh toán", "Thanh toán thành công qua cổng nội địa (PayOS/VNPay/MoMo)",
    "Tích hợp", "Cao", PLAN, "Cộng đồng/khóa học có phí, đã chọn gói",
    ["Chọn gói thành viên", "Chọn phương thức thanh toán nội địa", "Quét mã QR / nhập thông tin thẻ",
     "Hoàn tất thanh toán trên cổng"], "-",
    "Giao dịch thành công, hệ thống nhận webhook và cấp quyền truy cập ngay")
add(M, MN, "Chọn gói & thanh toán", "Thanh toán thành công qua Stripe (thẻ quốc tế)",
    "Tích hợp", "Cao", PLAN, "Cộng đồng/khóa học có phí, đã chọn gói",
    ["Chọn gói thành viên", "Chọn Stripe", "Nhập thông tin thẻ Visa/Mastercard hợp lệ", "Xác nhận thanh toán"],
    "Thẻ test Stripe hợp lệ", "Giao dịch thành công, quyền truy cập được cấp ngay sau xác nhận")
add(M, MN, "Thanh toán thất bại", "Thanh toán thất bại do thẻ hết hạn",
    "Chức năng", "Cao", PLAN, "-",
    ["Chọn gói thành viên", "Nhập thông tin thẻ đã hết hạn", "Xác nhận thanh toán"], "Thẻ hết hạn",
    "Giao dịch bị từ chối, hiển thị lỗi rõ ràng, không cấp quyền truy cập")
add(M, MN, "Thanh toán thất bại", "Thanh toán thất bại do không đủ số dư",
    "Chức năng", "Cao", PLAN, "-",
    ["Chọn gói thành viên", "Thanh toán bằng phương thức không đủ số dư"], "Tài khoản không đủ tiền",
    "Giao dịch bị từ chối, hiển thị lỗi, không cấp quyền truy cập")
add(M, MN, "Thử lại thanh toán", "Hệ thống tự động thử lại khi thanh toán định kỳ thất bại",
    "Chức năng", "Cao", PLAN, "Có gói đến hạn gia hạn nhưng phương thức thanh toán lỗi",
    ["Tới ngày gia hạn với phương thức thanh toán không hợp lệ", "Quan sát hệ thống trong các ngày tiếp theo"],
    "-", "Hệ thống thử lại theo lịch đã định, đồng thời gửi cảnh báo cho thành viên cập nhật phương thức thanh toán")
add(M, MN, "Khóa quyền truy cập", "Tạm khóa quyền truy cập sau X lần thanh toán thất bại liên tiếp",
    "Chức năng", "Cao", PLAN, "Thanh toán định kỳ thất bại liên tục đủ X lần theo cấu hình",
    ["Để thanh toán thất bại liên tục đủ số lần cấu hình (X lần)", "Kiểm tra quyền truy cập của thành viên"],
    "X lần thất bại liên tiếp", "Quyền truy cập nội dung có phí bị tạm khóa cho tới khi thanh toán thành công")
add(M, MN, "Dùng thử miễn phí", "Kích hoạt đúng số ngày dùng thử miễn phí (VD 7 ngày)",
    "Chức năng", "Cao", PLAN, "Gói có cấu hình dùng thử miễn phí 7 ngày",
    ["Đăng ký gói có dùng thử miễn phí", "Kiểm tra ngày bắt đầu tính phí hiển thị"], "Dùng thử: 7 ngày",
    "Không bị tính phí trong 7 ngày đầu, chỉ thu phí đúng vào ngày thứ 8 nếu không hủy")
add(M, MN, "Hủy trong thời gian dùng thử", "Hủy trong thời gian dùng thử không mất phí",
    "Chức năng", "Cao", PLAN, "Đang trong thời gian dùng thử miễn phí",
    ["Vào 'Gói của tôi'", "Bấm Hủy trong lúc còn hạn dùng thử"], "-",
    "Hủy thành công, không phát sinh bất kỳ khoản phí nào, không có giao dịch được tạo")
add(M, MN, "Hủy sau khi đã thanh toán", "Hủy gói sau khi đã thanh toán vẫn còn quyền truy cập tới hết chu kỳ",
    "Chức năng", "Cao", PLAN, "Đã thanh toán ít nhất 1 chu kỳ",
    ["Vào 'Gói của tôi'", "Bấm Hủy gói", "Xác nhận hủy"], "-",
    "Không bị thu phí chu kỳ tiếp theo, nhưng vẫn giữ quyền truy cập tới hết ngày cuối chu kỳ đã trả")
add(M, MN, "Gia hạn tự động", "Gia hạn tự động thu phí đúng vào ngày tới hạn",
    "Chức năng", "Cao", PLAN, "Gói đang active, chưa hủy, tới ngày gia hạn",
    ["Chờ tới đúng ngày gia hạn chu kỳ", "Kiểm tra giao dịch phát sinh và quyền truy cập"], "-",
    "Hệ thống tự động thu phí đúng ngày, quyền truy cập tiếp tục không gián đoạn nếu thanh toán thành công")
add(M, MN, "Thông báo trước gia hạn", "Gửi thông báo nhắc trước khi thu phí chu kỳ mới",
    "Tích hợp", "Trung bình", PLAN, "Gói sắp tới ngày gia hạn",
    ["Chờ tới thời điểm nhắc trước cấu hình (VD 3 ngày trước)"], "-",
    "Thành viên nhận được thông báo/email nhắc trước đúng thời điểm")
add(M, MN, "Quản lý gói của tôi", "Xem thông tin gói hiện tại (giá, chu kỳ, ngày gia hạn)",
    "Chức năng", "Trung bình", PLAN, "Đang có gói active",
    ["Vào 'Gói của tôi'"], "-", "Hiển thị chính xác gói đang dùng, giá, chu kỳ, ngày gia hạn tiếp theo")
add(M, MN, "Quản lý gói của tôi", "Đổi phương thức thanh toán",
    "Chức năng", "Trung bình", PLAN, "Đang có gói active",
    ["Vào 'Gói của tôi'", "Chọn 'Đổi phương thức thanh toán'", "Nhập phương thức mới", "Lưu"], "-",
    "Phương thức thanh toán mới được lưu, áp dụng cho lần thu phí tiếp theo")
add(M, MN, "Trang doanh thu Owner", "Trang 'Doanh thu của tôi' hiển thị đúng số dư, lịch sử giao dịch",
    "Chức năng", "Cao", PLAN, "Owner có giao dịch phát sinh từ cộng đồng",
    ["Đăng nhập với vai trò Owner", "Vào trang Doanh thu của tôi"], "-",
    "Số dư, lịch sử giao dịch, lịch rút tiền tiếp theo khớp đúng với dữ liệu giao dịch thực tế")
add(M, MN, "Rút tiền (Payout)", "Rút tiền thành công khi đủ ngưỡng tối thiểu",
    "Chức năng", "Cao", PLAN, "Số dư Owner >= ngưỡng rút tối thiểu",
    ["Vào trang Doanh thu của tôi", "Bấm 'Rút tiền'", "Nhập thông tin tài khoản nhận", "Xác nhận"],
    "Số dư >= ngưỡng tối thiểu", "Yêu cầu rút tiền được tạo, số dư trừ đúng số tiền rút, sau trừ hoa hồng nền tảng và phí cổng thanh toán")
add(M, MN, "Rút tiền (Payout)", "Không cho rút tiền khi chưa đủ ngưỡng tối thiểu",
    "Chức năng", "Trung bình", PLAN, "Số dư Owner < ngưỡng rút tối thiểu",
    ["Vào trang Doanh thu của tôi", "Bấm 'Rút tiền'"], "Số dư < ngưỡng tối thiểu",
    "Hệ thống chặn yêu cầu rút tiền, hiển thị rõ ngưỡng tối thiểu cần đạt")
add(M, MN, "Webhook thanh toán", "Xử lý webhook idempotent — không cấp quyền/tính phí 2 lần khi webhook gửi trùng",
    "Bảo mật", "Cao", PLAN, "Cổng thanh toán gửi trùng 1 webhook xác nhận thanh toán (retry)",
    ["Giả lập cổng thanh toán gửi 2 lần cùng 1 webhook xác nhận thành công cho cùng 1 giao dịch"],
    "Webhook trùng ID giao dịch", "Hệ thống chỉ xử lý đúng 1 lần, không cấp quyền truy cập/ghi nhận doanh thu 2 lần")
add(M, MN, "Webhook thanh toán", "Từ chối webhook có chữ ký không hợp lệ",
    "Bảo mật", "Cao", PLAN, "-",
    ["Gửi request giả tới endpoint webhook thanh toán với chữ ký (signature) sai/không có"], "-",
    "Hệ thống từ chối xử lý, không cấp quyền truy cập, ghi log cảnh báo bất thường")

add(M, MN, "Đổi gói", "Owner đổi giá cộng đồng — thành viên hiện tại được xử lý đúng theo chính sách đã chốt",
    "Chức năng", "Cao", PLAN, "Cộng đồng có thành viên đang trả phí ở mức giá cũ, Owner đổi sang giá mới",
    ["Owner đổi giá cộng đồng từ 99k lên 149k/tháng", "Kiểm tra chu kỳ gia hạn tiếp theo của thành viên đã tham gia trước đó"],
    "-", "Áp dụng đúng theo chính sách đã chốt với BA (giữ giá cũ tới khi hủy, hay áp giá mới ngay từ chu kỳ sau)")
add(M, MN, "Hoàn tiền", "Platform Admin thực hiện hoàn tiền cho trường hợp đặc biệt",
    "Chức năng", "Trung bình", PLAN, "Có giao dịch đã thanh toán, Platform Admin xét duyệt hoàn tiền",
    ["Platform Admin vào quản lý giao dịch", "Chọn 1 giao dịch, thực hiện hoàn tiền có ghi lý do"], "-",
    "Giao dịch chuyển trạng thái đã hoàn tiền, tiền được hoàn qua cổng thanh toán gốc, thành viên nhận thông báo")
add(M, MN, "Đơn vị tiền tệ", "Hiển thị đúng đơn vị tiền tệ theo thị trường (VNĐ nội địa, USD Stripe)",
    "Giao diện", "Trung bình", PLAN, "Cộng đồng cấu hình giá theo cả 2 loại cổng thanh toán",
    ["Xem trang chọn gói khi thanh toán qua cổng nội địa", "Xem trang chọn gói khi thanh toán qua Stripe"], "-",
    "Hiển thị đúng đơn vị tiền tệ và mức giá tương ứng cho từng cổng thanh toán")
add(M, MN, "Nhiều cộng đồng", "Thành viên tham gia trả phí nhiều cộng đồng cùng lúc, mỗi gói tính phí độc lập",
    "Chức năng", "Trung bình", PLAN, "Thành viên đã tham gia trả phí cộng đồng A",
    ["Thành viên tham gia trả phí thêm cộng đồng B", "Kiểm tra 'Gói của tôi'"], "-",
    "Hiển thị đúng 2 gói riêng biệt của cộng đồng A và B, thu phí/gia hạn độc lập nhau")
add(M, MN, "Thanh toán", "Chặn thanh toán trùng khi bấm nút 'Thanh toán' nhiều lần liên tiếp",
    "Chức năng", "Cao", PLAN, "Đang ở màn hình xác nhận thanh toán",
    ["Bấm rất nhanh nhiều lần liên tiếp vào nút 'Thanh toán'"], "-",
    "Chỉ tạo đúng 1 giao dịch/1 lần bị trừ tiền, nút bị vô hiệu hóa ngay sau lần bấm đầu tiên")
add(M, MN, "Dùng thử miễn phí", "Không cho dùng thử miễn phí lần 2 cho cùng 1 tài khoản trên cùng 1 gói",
    "Chức năng", "Cao", PLAN, "Tài khoản đã từng dùng thử miễn phí gói này và đã hủy/hết hạn",
    ["Tài khoản đã từng dùng thử gói X trước đó", "Đăng ký tham gia lại gói X"], "-",
    "Không được cấp thêm thời gian dùng thử miễn phí lần 2, vào thẳng thanh toán ngay (đúng chính sách chống lạm dụng)")
add(M, MN, "Trang doanh thu Owner", "Owner chỉ xem được doanh thu của cộng đồng mình sở hữu",
    "Bảo mật", "Cao", PLAN, "Owner A sở hữu cộng đồng A, có cộng đồng B của Owner khác",
    ["Đăng nhập Owner A", "Thử truy cập URL trang doanh thu của cộng đồng B (sửa ID trên URL)"], "-",
    "Bị từ chối truy cập (403), không xem được số liệu doanh thu của cộng đồng B")
add(M, MN, "Rút tiền (Payout)", "Không cho rút tiền vượt quá số dư khả dụng hiện tại",
    "Chức năng", "Cao", PLAN, "Owner có số dư khả dụng xác định",
    ["Owner vào trang Doanh thu", "Nhập số tiền rút lớn hơn số dư khả dụng", "Xác nhận"], "Số tiền rút > số dư",
    "Hệ thống từ chối yêu cầu, báo lỗi vượt quá số dư khả dụng")

# ============================= 10. QUẢN TRỊ & VẬN HÀNH ========================
M, MN = "ADMIN", "Quản trị & Vận hành hệ thống"
add(M, MN, "Kiểm duyệt nội dung", "Thành viên báo cáo bài viết vi phạm",
    "Chức năng", "Trung bình", PLAN, "Có bài viết trên bảng tin",
    ["Mở 1 bài viết", "Bấm 'Báo cáo'", "Chọn lý do và gửi"], "-",
    "Báo cáo được ghi nhận và chuyển tới hàng đợi kiểm duyệt của Platform Admin")
add(M, MN, "Kiểm duyệt nội dung", "Platform Admin ẩn/xóa nội dung vi phạm",
    "Chức năng", "Cao", PLAN, "Có nội dung bị báo cáo vi phạm",
    ["Đăng nhập Platform Admin", "Vào hàng đợi kiểm duyệt", "Chọn 1 nội dung vi phạm", "Ẩn/Xóa"], "-",
    "Nội dung bị ẩn/xóa khỏi hệ thống ngay, không còn hiển thị cho người dùng khác")
add(M, MN, "Kiểm duyệt nội dung", "Platform Admin cấm (ban) một thành viên vi phạm",
    "Chức năng", "Cao", PLAN, "Có thành viên vi phạm nghiêm trọng",
    ["Đăng nhập Platform Admin", "Tìm thành viên vi phạm", "Thực hiện cấm tài khoản"], "-",
    "Tài khoản bị cấm không thể đăng nhập/hoạt động trên toàn nền tảng")
add(M, MN, "Kiểm duyệt nội dung", "Platform Admin khóa/gỡ cộng đồng vi phạm, không phụ thuộc quyết định của Owner",
    "Bảo mật", "Cao", PLAN, "Có cộng đồng vi phạm chính sách nền tảng",
    ["Đăng nhập Platform Admin", "Tìm cộng đồng vi phạm", "Thực hiện khóa/gỡ cộng đồng"], "-",
    "Cộng đồng bị khóa/gỡ ngay lập tức dù Owner không đồng ý, đúng theo quy tắc quyền tối cao của Platform Admin")
add(M, MN, "Tìm kiếm toàn nền tảng", "Tìm kiếm đồng thời khóa học, cộng đồng, bài viết trong 1 ô tìm kiếm",
    "Chức năng", "Trung bình", PLAN, "Dữ liệu có đủ khóa học/cộng đồng/bài viết khớp từ khóa",
    ["Vào ô tìm kiếm toàn nền tảng (header)", "Nhập từ khóa khớp cả 3 loại dữ liệu"], "-",
    "Kết quả trả về gộp cả khóa học, cộng đồng, bài viết liên quan, phân nhóm rõ ràng")
add(M, MN, "Đa ngôn ngữ", "Chuyển đổi giao diện giữa Tiếng Việt và Tiếng Anh",
    "Chức năng", "Trung bình", PLAN, "Tính năng đang ở giai đoạn Kế hoạch — nút chọn đã có trên giao diện nhưng chưa hoạt động",
    ["Bấm nút chọn ngôn ngữ trên header", "Chọn English"], "-",
    "Toàn bộ giao diện chuyển sang tiếng Anh, không còn text tiếng Việt sót lại")
add(M, MN, "Trang quản trị nội bộ", "Platform Admin theo dõi tổng quan hoạt động toàn nền tảng",
    "Chức năng", "Trung bình", PLAN, "Đăng nhập Platform Admin",
    ["Vào trang quản trị nội bộ", "Kiểm tra các số liệu tổng quan (người dùng, cộng đồng, giao dịch, báo cáo)"],
    "-", "Số liệu hiển thị chính xác, cập nhật theo thời gian thực hoặc gần thực")

add(M, MN, "Kiểm duyệt nội dung", "Khôi phục lại nội dung đã ẩn/xóa nhầm (nếu có tính năng)",
    "Chức năng", "Thấp", PLAN, "Có nội dung đã bị Platform Admin ẩn/xóa",
    ["Platform Admin vào nhật ký kiểm duyệt", "Chọn nội dung đã ẩn/xóa", "Khôi phục"], "-",
    "Nội dung hiển thị trở lại bình thường cho người dùng")
add(M, MN, "Kiểm duyệt nội dung", "Ghi log đầy đủ hành động kiểm duyệt (audit trail)",
    "Bảo mật", "Trung bình", PLAN, "Platform Admin vừa thực hiện 1 hành động kiểm duyệt",
    ["Platform Admin ẩn/xóa 1 nội dung hoặc cấm 1 tài khoản", "Kiểm tra nhật ký/audit log hệ thống"], "-",
    "Log ghi nhận đầy đủ: người thực hiện, thời gian, đối tượng, hành động — phục vụ tra soát sau này")
add(M, MN, "Tìm kiếm toàn nền tảng", "Kết quả tìm kiếm tôn trọng quyền riêng tư của cộng đồng riêng tư",
    "Bảo mật", "Cao", PLAN, "Có nội dung thuộc cộng đồng riêng tư, người tìm kiếm chưa tham gia",
    ["Đăng nhập tài khoản chưa tham gia cộng đồng riêng tư", "Tìm kiếm từ khóa khớp với nội dung trong cộng đồng riêng tư đó"],
    "-", "Kết quả không hiển thị nội dung riêng tư mà người dùng chưa có quyền xem")
add(M, MN, "Trang quản trị nội bộ", "Chỉ Platform Admin mới truy cập được trang quản trị nội bộ",
    "Bảo mật", "Cao", PLAN, "Tài khoản Owner/Admin thường (không phải Platform Admin)",
    ["Đăng nhập tài khoản Owner (không phải Platform Admin)", "Truy cập trực tiếp URL trang quản trị nội bộ hệ thống"],
    "-", "Bị từ chối truy cập/chuyển hướng, không vào được trang quản trị nội bộ")
add(M, MN, "Đa ngôn ngữ", "Ngôn ngữ đã chọn được ghi nhớ giữa các lần truy cập",
    "Chức năng", "Thấp", PLAN, "-",
    ["Chọn ngôn ngữ English", "Đăng xuất rồi đăng nhập lại (hoặc đóng mở lại trình duyệt)"], "-",
    "Giao diện vẫn giữ ngôn ngữ English đã chọn trước đó, không tự reset về mặc định")

# ============================= 11. QUY TẮC NGHIỆP VỤ & PHI CHỨC NĂNG ==========
M, MN = "SEC", "Bảo mật & Yêu cầu phi chức năng"
add(M, MN, "Bảo mật mật khẩu", "Mật khẩu được mã hóa (hash), không ai xem được mật khẩu gốc kể cả Platform Admin",
    "Bảo mật", "Cao", DONE, "Có quyền truy cập cơ sở dữ liệu (môi trường test)",
    ["Đăng ký 1 tài khoản với mật khẩu biết trước", "Kiểm tra giá trị lưu trong cơ sở dữ liệu/qua trang quản trị nội bộ"],
    "-", "Chỉ thấy giá trị hash, không thể suy ra được mật khẩu gốc dưới bất kỳ hình thức nào")
add(M, MN, "Phiên đăng nhập", "Access token hết hiệu lực sau 15 phút",
    "Bảo mật", "Cao", DONE, "Đã đăng nhập, có access token",
    ["Đăng nhập lấy access token", "Chờ quá 15 phút không thao tác", "Gọi 1 API cần xác thực"], "-",
    "API trả về lỗi hết hạn (401), yêu cầu làm mới token qua refresh token")
add(M, MN, "Phiên đăng nhập", "Refresh token chỉ dùng được một lần",
    "Bảo mật", "Cao", DONE, "Đã có access token hết hạn và refresh token còn hiệu lực",
    ["Dùng refresh token để lấy access token mới (lần 1)", "Dùng lại chính refresh token đó lần 2"], "-",
    "Lần dùng đầu thành công; lần dùng lại thứ 2 bị từ chối (refresh token đã bị vô hiệu sau khi dùng)")
add(M, MN, "Phiên đăng nhập", "Đăng xuất vô hiệu hóa toàn bộ phiên của tài khoản (mọi thiết bị)",
    "Bảo mật", "Trung bình", DONE, "Đăng nhập cùng 1 tài khoản trên 2 thiết bị/trình duyệt",
    ["Đăng nhập tài khoản A trên trình duyệt 1 và trình duyệt 2", "Đăng xuất ở trình duyệt 1",
     "Thử thao tác cần xác thực ở trình duyệt 2"], "-",
    "Phiên ở trình duyệt 2 cũng bị vô hiệu hóa, yêu cầu đăng nhập lại")
add(M, MN, "Ràng buộc dữ liệu", "Một khóa học luôn thuộc đúng một cộng đồng",
    "Chức năng", "Trung bình", PLAN, "-",
    ["Kiểm tra dữ liệu/API tạo khóa học", "Thử tạo hoặc gán 1 khóa học không thuộc cộng đồng nào, hoặc thuộc 2 cộng đồng"],
    "-", "Hệ thống từ chối, mỗi khóa học bắt buộc gắn với đúng 1 cộng đồng duy nhất")
add(M, MN, "Phân quyền theo cộng đồng", "Một người là Owner ở cộng đồng A nhưng chỉ là Thành viên ở cộng đồng B",
    "Bảo mật", "Cao", PLAN, "Tài khoản là Owner của cộng đồng A, đồng thời là Member của cộng đồng B",
    ["Đăng nhập tài khoản đó", "Vào cộng đồng A, thực hiện thao tác quyền Owner (VD sửa khóa học)",
     "Vào cộng đồng B, thử thực hiện thao tác quyền Owner tương tự"], "-",
    "Thao tác thành công ở cộng đồng A, nhưng bị từ chối ở cộng đồng B (chỉ có quyền Thành viên thường)")
add(M, MN, "Kết nối an toàn", "Toàn bộ kết nối sử dụng HTTPS",
    "Bảo mật", "Cao", DONE, "-",
    ["Truy cập domain của hệ thống qua trình duyệt", "Kiểm tra giao thức và chứng chỉ SSL"], "-",
    "Kết nối bắt buộc qua HTTPS, HTTP tự động chuyển hướng sang HTTPS, chứng chỉ hợp lệ")
add(M, MN, "Hiệu năng", "Trang khám phá tải nhanh và ổn định với lượng dữ liệu lớn",
    "Hiệu năng", "Trung bình", DONE, "Dữ liệu khóa học đủ lớn (hoặc giả lập)",
    ["Vào trang khám phá với bộ dữ liệu lớn", "Đo thời gian tải trang và phân trang"], "-",
    "Thời gian tải trang ở mức chấp nhận được (VD < 3s), có phân trang/tải dần, không bị treo/lag nặng")
add(M, MN, "Đa thiết bị", "Giao diện responsive tốt trên điện thoại di động",
    "Giao diện", "Trung bình", DONE, "-",
    ["Mở website trên trình duyệt di động hoặc chế độ giả lập mobile", "Kiểm tra các trang chính (chủ, khám phá, chi tiết khóa học, đăng ký/đăng nhập)"],
    "-", "Layout hiển thị đúng, không vỡ giao diện, thao tác được đầy đủ chức năng trên màn hình nhỏ")
add(M, MN, "Đa thiết bị", "Giao diện responsive tốt trên máy tính bảng",
    "Giao diện", "Thấp", DONE, "-",
    ["Mở website ở độ phân giải máy tính bảng (VD 768px-1024px)", "Kiểm tra các trang chính"], "-",
    "Layout hiển thị hợp lý, không chồng chéo phần tử, thao tác bình thường")
add(M, MN, "SEO", "Trang công khai có thẻ meta/title phù hợp cho SEO",
    "Giao diện", "Thấp", DONE, "-",
    ["Vào trang khám phá và trang chi tiết khóa học", "Kiểm tra thẻ <title>, meta description qua View Source"],
    "-", "Có tiêu đề, mô tả rõ ràng, đúng nội dung từng trang, hỗ trợ tốt cho công cụ tìm kiếm")

# ============================= 12. MA TRẬN PHÂN QUYỀN & BẢO MẬT NÂNG CAO =====
M, MN = "ROLE", "Ma trận phân quyền & Bảo mật nâng cao"
add(M, MN, "Ma trận quyền", "Guest không thể đăng bài/bình luận/thích — bị chuyển hướng đăng nhập",
    "Bảo mật", "Cao", PLAN, "Chưa đăng nhập",
    ["Ở chế độ Khách, mở 1 bài viết công khai", "Thử bấm Thích hoặc nhập bình luận"], "-",
    "Bị chặn thao tác, chuyển hướng sang trang đăng nhập/đăng ký")
add(M, MN, "Ma trận quyền", "Member không truy cập được trang Cài đặt cộng đồng khi chỉ là thành viên thường",
    "Bảo mật", "Cao", PLAN, "Tài khoản là Member thường của 1 cộng đồng",
    ["Đăng nhập Member thường", "Truy cập trực tiếp URL trang Cài đặt cộng đồng"], "-",
    "Bị từ chối truy cập (403) hoặc không thấy menu Cài đặt")
add(M, MN, "Ma trận quyền", "Admin không có quyền xem/đổi giá cộng đồng khi chưa được Owner cấp quyền",
    "Bảo mật", "Cao", PLAN, "Admin chưa được cấp quyền quản lý giá",
    ["Đăng nhập Admin chưa được cấp quyền giá", "Truy cập trang cài đặt giá cộng đồng"], "-",
    "Bị từ chối truy cập/chỉnh sửa, đúng theo nguyên tắc phân quyền mặc định trong BRD mục 2")
add(M, MN, "Ma trận quyền", "Admin không thể xóa cộng đồng (quyền Owner-only)",
    "Bảo mật", "Cao", PLAN, "Đăng nhập Admin của 1 cộng đồng",
    ["Admin truy cập cài đặt cộng đồng", "Tìm/thử gọi API xóa cộng đồng"], "-",
    "Không có tùy chọn xóa cộng đồng trên giao diện; gọi API trực tiếp cũng bị từ chối")
add(M, MN, "Ma trận quyền", "Owner cộng đồng A không thể kiểm duyệt/quản lý cộng đồng B",
    "Bảo mật", "Cao", PLAN, "Owner A sở hữu cộng đồng A, có cộng đồng B của Owner khác",
    ["Đăng nhập Owner A", "Truy cập trực tiếp URL trang quản trị của cộng đồng B (sửa ID)"], "-",
    "Bị từ chối truy cập, không thấy hoặc không thao tác được với dữ liệu cộng đồng B")
add(M, MN, "Ma trận quyền", "Platform Admin truy cập được dữ liệu quản trị của mọi cộng đồng bất kể có phải thành viên",
    "Chức năng", "Cao", PLAN, "Platform Admin không phải thành viên của cộng đồng X",
    ["Đăng nhập Platform Admin", "Truy cập trang quản trị/kiểm duyệt của cộng đồng X"], "-",
    "Truy cập thành công, đúng theo quyền vận hành toàn nền tảng")
add(M, MN, "IDOR", "Người dùng A không xem được thông tin thanh toán/gói của người dùng B qua sửa ID trên URL",
    "Bảo mật", "Cao", PLAN, "2 tài khoản A, B đều có gói đang active",
    ["Đăng nhập A, vào trang 'Gói của tôi', ghi nhận định dạng URL/ID", "Sửa ID trên URL thành ID tương ứng của B",
     "Tải lại trang"], "-",
    "Bị từ chối truy cập (403) hoặc trả về lỗi, không hiển thị dữ liệu thanh toán của B")
add(M, MN, "IDOR", "Người dùng A không sửa được tiến độ học (progress) của người dùng B qua API",
    "Bảo mật", "Cao", PLAN, "B đang học 1 khóa học có tiến độ ghi nhận",
    ["Đăng nhập A", "Gọi API đánh dấu hoàn thành bài học nhưng truyền user_id/thông tin định danh của B"],
    "user_id=B trong request của A",
    "API từ chối hoặc chỉ áp dụng cho chính A (lấy user từ token xác thực, bỏ qua tham số user_id truyền vào), không sửa được dữ liệu của B")
add(M, MN, "IDOR", "Không xem được tin nhắn trực tiếp giữa 2 người khác qua sửa ID cuộc trò chuyện",
    "Bảo mật", "Cao", PLAN, "Có cuộc trò chuyện giữa B và C, đăng nhập bằng A",
    ["Đăng nhập A", "Sửa ID cuộc trò chuyện trên URL/API thành ID cuộc trò chuyện giữa B và C"], "-",
    "Bị từ chối truy cập, A không đọc được nội dung tin nhắn giữa B và C")
add(M, MN, "Privilege escalation", "Member không gọi được trực tiếp API dành riêng cho Admin/Owner",
    "Bảo mật", "Cao", PLAN, "Đăng nhập Member thường, biết endpoint API quản trị",
    ["Đăng nhập Member thường", "Dùng Postman/DevTools gọi trực tiếp API vốn chỉ hiện trên giao diện Admin"], "-",
    "API trả về lỗi từ chối quyền (403), không thực hiện hành động")
add(M, MN, "JWT/Token", "Sửa đổi claim vai trò (role) trong token không nâng được quyền thực tế",
    "Bảo mật", "Cao", PLAN, "Có access token hợp lệ của tài khoản Member",
    ["Giải mã token, sửa trường role từ 'member' thành 'admin'/'platform_admin'", "Dùng token đã sửa gọi API quản trị"],
    "-", "Token bị coi là không hợp lệ do sai chữ ký (signature), bị từ chối ngay — quyền được xác thực ở server, không dựa vào claim client gửi lên")
add(M, MN, "CSRF", "Các API thay đổi trạng thái (POST/PUT/DELETE) được bảo vệ chống CSRF",
    "Bảo mật", "Cao", PLAN, "Đã đăng nhập trên trình duyệt A",
    ["Dựng 1 trang HTML bên ngoài tự động submit POST tới API thay đổi trạng thái (VD đổi email) khi nạn nhân đang đăng nhập",
     "Cho nạn nhân mở trang đó"], "-",
    "Request bị từ chối do thiếu CSRF token hợp lệ/kiểm tra origin, không thực hiện được thay đổi ngoài ý muốn")
add(M, MN, "Rate limiting", "Giới hạn tần suất gọi API tìm kiếm/đăng ký để chống lạm dụng",
    "Bảo mật", "Trung bình", PLAN, "-",
    ["Gọi liên tục API tìm kiếm hoặc đăng ký tài khoản với tần suất rất cao trong thời gian ngắn (script tự động)"], "-",
    "Sau ngưỡng nhất định, hệ thống trả về lỗi 429 (Too Many Requests) hoặc yêu cầu captcha, chặn spam")
add(M, MN, "Upload file", "Từ chối upload file thực thi/nguy hiểm giả dạng ảnh (VD .exe/.php đổi tên .jpg)",
    "Bảo mật", "Cao", PLAN, "Có chức năng upload file (ảnh đại diện, tệp bài học...)",
    ["Chọn upload 1 file .exe/.php đổi tên thành .jpg", "Thực hiện upload"], "File giả mạo đuôi ảnh",
    "Hệ thống kiểm tra loại file thực tế (không chỉ theo đuôi tên file), từ chối file không hợp lệ")
add(M, MN, "Upload file", "Giới hạn dung lượng file upload tối đa",
    "Chức năng", "Trung bình", PLAN, "-",
    ["Upload 1 file vượt quá giới hạn dung lượng cho phép (VD > 10MB cho ảnh)"], "File > giới hạn quy định",
    "Hệ thống từ chối, báo lỗi rõ ràng về giới hạn dung lượng, không làm treo server")
add(M, MN, "Ma trận quyền", "Ma trận tổng hợp: mỗi vai trò chỉ thấy đúng menu/chức năng được phép trên giao diện",
    "Giao diện", "Trung bình", PLAN, "Có đủ 5 loại tài khoản test tương ứng 5 vai trò",
    ["Lần lượt đăng nhập bằng từng vai trò: Guest, Member, Owner, Admin, Platform Admin",
     "Đối chiếu menu/nút chức năng hiển thị với bảng quyền hạn ở BRD mục 2"], "-",
    "Mỗi vai trò chỉ thấy đúng menu/chức năng theo đúng bảng quyền hạn đã mô tả trong BRD, không thừa không thiếu")
add(M, MN, "Dữ liệu nhạy cảm", "API danh sách thành viên không trả về các trường nhạy cảm ra ngoài",
    "Bảo mật", "Cao", PLAN, "-",
    ["Gọi API lấy danh sách/chi tiết thành viên (qua DevTools Network)", "Kiểm tra toàn bộ response body"], "-",
    "Response không chứa mật khẩu (hash), token nội bộ hay dữ liệu nhạy cảm không cần thiết cho client")
add(M, MN, "Đăng xuất bảo mật", "Back trình duyệt trên thiết bị dùng chung không để lộ lại dữ liệu qua cache",
    "Bảo mật", "Trung bình", PLAN, "Đăng nhập trên máy tính dùng chung",
    ["Đăng nhập, xem 1 trang có dữ liệu cá nhân", "Đăng xuất", "Bấm nút Back của trình duyệt nhiều lần"], "-",
    "Không hiển thị lại dữ liệu cá nhân đã cache, yêu cầu đăng nhập lại nếu muốn xem")

# ============================= 13. API / TÍCH HỢP & CONCURRENCY ===============
M, MN = "INTEG", "API / Tích hợp & Concurrency"
add(M, MN, "Concurrency", "2 người thanh toán cùng lúc cho suất cuối cùng của sự kiện giới hạn số lượng",
    "Chức năng", "Cao", PLAN, "Sự kiện chỉ còn đúng 1 chỗ trống",
    ["2 tài khoản khác nhau bấm 'Đăng ký tham dự' gần như đồng thời khi chỉ còn 1 chỗ trống"], "Chỉ còn 1 chỗ trống",
    "Chỉ đúng 1 người đăng ký thành công, người còn lại nhận thông báo đã hết chỗ/vào danh sách chờ, không vượt giới hạn (race condition)")
add(M, MN, "Concurrency", "2 Owner/Admin cùng chỉnh sửa 1 module khóa học đồng thời",
    "Chức năng", "Trung bình", PLAN, "2 tài khoản có quyền soạn thảo cùng 1 khóa học",
    ["2 tài khoản mở cùng 1 module để sửa", "Cả 2 cùng lưu thay đổi gần như đồng thời với nội dung khác nhau"], "-",
    "Hệ thống xử lý nhất quán: last-write-wins có cảnh báo hoặc báo xung đột — không làm mất dữ liệu âm thầm khó hiểu")
add(M, MN, "Webhook", "Webhook thanh toán đến trước khi trình duyệt người dùng redirect quay lại",
    "Tích hợp", "Cao", PLAN, "Giả lập cổng thanh toán gửi webhook nhanh hơn thời gian redirect trình duyệt",
    ["Kích hoạt thanh toán", "Giả lập webhook xác nhận thành công tới hệ thống trước khi người dùng được redirect về trang kết quả"],
    "-", "Hệ thống vẫn cấp quyền truy cập đúng dựa trên webhook, trang kết quả khi người dùng quay lại hiển thị đúng trạng thái đã thành công")
add(M, MN, "Webhook", "Cổng thanh toán retry webhook do không nhận được phản hồi 200 kịp thời",
    "Tích hợp", "Trung bình", PLAN, "Endpoint webhook phản hồi chậm/timeout ở lần gọi đầu",
    ["Giả lập endpoint webhook xử lý chậm gây timeout ở request đầu tiên", "Quan sát cổng thanh toán gửi lại request retry"],
    "-", "Request retry được xử lý idempotent đúng như case webhook trùng lặp, không cấp quyền/tính phí thêm lần nữa")
add(M, MN, "Transaction rollback", "Thanh toán thành công nhưng cấp quyền truy cập thất bại — hệ thống xử lý nhất quán",
    "Chức năng", "Cao", PLAN, "Giả lập lỗi ở bước cấp quyền sau khi ghi nhận thanh toán thành công",
    ["Giả lập lỗi hệ thống ngay sau khi ghi nhận thanh toán thành công nhưng trước khi cấp quyền truy cập hoàn tất"], "-",
    "Có cơ chế retry/đối soát đảm bảo người dùng vẫn được cấp quyền đúng với số tiền đã thanh toán, hoặc cảnh báo cho vận hành xử lý thủ công — không để mất tiền mà không có quyền truy cập")
add(M, MN, "Idempotency", "Submit form tạo cộng đồng 2 lần do double-click không tạo 2 bản ghi",
    "Chức năng", "Cao", PLAN, "-",
    ["Điền form tạo cộng đồng", "Bấm nút Tạo 2 lần liên tiếp thật nhanh (double-click) hoặc submit lại sau khi mạng chập chờn"],
    "-", "Chỉ tạo đúng 1 cộng đồng, không tạo bản ghi trùng lặp")
add(M, MN, "Bên thứ 3 lỗi", "Cổng thanh toán gián đoạn — người dùng nhận lỗi rõ ràng, không bị trừ tiền mà không rõ trạng thái",
    "Tích hợp", "Cao", PLAN, "Giả lập cổng thanh toán trả lỗi/timeout",
    ["Kích hoạt thanh toán trong lúc giả lập cổng thanh toán không phản hồi/lỗi"], "-",
    "Hiển thị thông báo lỗi rõ ràng, giao dịch ở trạng thái thất bại/chưa xác định được xử lý minh bạch (không cấp quyền khi chưa có xác nhận thành công)")
add(M, MN, "Bên thứ 3 lỗi", "Dịch vụ gửi email lỗi không làm gián đoạn luồng nghiệp vụ chính",
    "Tích hợp", "Trung bình", PLAN, "Giả lập dịch vụ email tạm thời lỗi",
    ["Giả lập email service lỗi/timeout", "Thực hiện đăng ký tài khoản hoặc thanh toán thành công"], "-",
    "Đăng ký/thanh toán vẫn hoàn tất thành công, email được đưa vào hàng đợi thử gửi lại sau, không chặn luồng chính")
add(M, MN, "Real-time", "Tin nhắn/thông báo real-time tự kết nối lại sau khi mất mạng tạm thời",
    "Tích hợp", "Trung bình", PLAN, "Đang mở kết nối real-time (WebSocket) cho chat/thông báo",
    ["Đang trong phiên chat/nhận thông báo real-time", "Ngắt mạng trong vài giây rồi kết nối lại"], "-",
    "Kết nối tự động thiết lập lại, không mất tin nhắn/thông báo phát sinh trong lúc mất kết nối (đồng bộ lại khi online)")
add(M, MN, "Phân trang dưới tải", "Phân trang không trùng/thiếu dữ liệu khi có bản ghi mới thêm liên tục khi đang cuộn",
    "Chức năng", "Thấp", PLAN, "Bảng tin/danh sách đang có dữ liệu mới liên tục được thêm vào",
    ["Người dùng đang xem trang 1 danh sách", "Trong lúc đó có bài viết/khóa học mới được thêm vào hệ thống",
     "Chuyển sang trang 2"], "-",
    "Không hiển thị trùng lặp bản ghi giữa các trang, không bị nhảy/mất bản ghi một cách bất thường")
add(M, MN, "Refresh token race condition", "Nhiều request song song cùng dùng 1 refresh token không tạo lỗi/session thừa",
    "Bảo mật", "Trung bình", PLAN, "Access token vừa hết hạn, có nhiều tab/request gọi API gần như đồng thời",
    ["Mở nhiều tab cùng 1 tài khoản khi access token vừa hết hạn", "Cả nhiều tab cùng lúc gọi API refresh token gần như đồng thời"],
    "-", "Hệ thống xử lý nhất quán (chỉ 1 request refresh thành công, các request khác nhận lại access token mới hợp lệ hoặc lỗi rõ ràng để retry), không văng lỗi hàng loạt hay tạo token thừa không kiểm soát")
add(M, MN, "Hiệu năng tải cao", "Hệ thống ổn định khi nhiều người dùng tìm kiếm/khám phá đồng thời (load test cơ bản)",
    "Hiệu năng", "Trung bình", PLAN, "Môi trường test có công cụ load test",
    ["Dùng công cụ load test giả lập ~100-200 người dùng đồng thời gọi API tìm kiếm/trang khám phá trong vài phút"],
    "~100-200 concurrent users", "Thời gian phản hồi vẫn ở mức chấp nhận được, không có lỗi 5xx hàng loạt, hệ thống không sập")
add(M, MN, "Đối soát dữ liệu", "Số liệu doanh thu Owner khớp với tổng giao dịch thực tế ghi nhận ở cổng thanh toán",
    "Tích hợp", "Cao", PLAN, "Có nhiều giao dịch đã phát sinh trong kỳ",
    ["Lấy báo cáo giao dịch từ cổng thanh toán trong 1 khoảng thời gian", "Đối chiếu với số liệu hiển thị ở trang Doanh thu của Owner tương ứng"],
    "-", "Số liệu khớp nhau (sau khi trừ đúng hoa hồng/phí cổng thanh toán theo công thức đã định), không lệch số")

# ===========================================================================
# ĐỢT 2026-09-30 — backend Postgres thật + frontend đã nối
# ===========================================================================
import os
import sys
import importlib
from collections import OrderedDict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

OLD_TOTAL = len(rows)
OLD_BY_MODULE = OrderedDict()
for _r in rows:
    OLD_BY_MODULE[(_r[0], _r[1])] = OLD_BY_MODULE.get((_r[0], _r[1]), 0) + 1

# Case CŨ vẫn giữ "Kế hoạch" (khớp theo chuỗi con của tiêu đề) vì tính năng CHƯA làm hoặc chưa chốt nghiệp vụ.
STILL_PLAN_OLD = [
    ("AUTH", "Đăng nhập bằng Google"), ("AUTH", "Đăng nhập bằng Facebook"), ("AUTH", "Bật 2FA"),
    ("FEED", "Đăng bài viết kèm video"),                          # bài viết chỉ hỗ trợ ảnh (imageUrl)
    ("FEED", "Tự động tải thêm bài viết khi cuộn"),               # hiện là nút 'Tải thêm bài viết', chưa auto-scroll
    ("EVENT", "Thêm sự kiện vào Google Calendar"),                 # chỉ có .ics
    ("NOTI", "Gửi email xác nhận khi đăng ký"),                    # email chưa gửi thật (outbox dev)
    ("NOTI", "Gửi email hóa đơn"), ("NOTI", "Gửi email nhắc gia hạn"), ("NOTI", "Email giao dịch gửi đúng ngôn ngữ"),
    ("PAY", "Thanh toán thành công qua cổng nội địa"), ("PAY", "Thanh toán thành công qua Stripe"),
    ("PAY", "Thanh toán thất bại do thẻ hết hạn"), ("PAY", "Thanh toán thất bại do không đủ số dư"),
    ("PAY", "Hệ thống tự động thử lại khi thanh toán định kỳ"), ("PAY", "Tạm khóa quyền truy cập sau X lần"),
    ("PAY", "Đổi phương thức thanh toán"), ("PAY", "Hiển thị đúng đơn vị tiền tệ"),
    ("PAY", "Owner đổi giá cộng đồng — thành viên hiện tại"),     # chưa chốt chính sách
    ("COMM", "Owner đổi mức giá cộng đồng từ Miễn phí sang Có phí"),  # chưa chốt chính sách thành viên hiện tại
    ("ADMIN", "Chuyển đổi giao diện giữa Tiếng Việt và Tiếng Anh"), ("ADMIN", "Ngôn ngữ đã chọn được ghi nhớ"),
    ("ADMIN", "Ghi log đầy đủ hành động kiểm duyệt"),             # chưa có audit log riêng
    ("ROLE", "Các API thay đổi trạng thái (POST/PUT/DELETE) được bảo vệ chống CSRF"),  # dùng Bearer token, chưa có cơ chế CSRF riêng
    ("INTEG", "Thanh toán thành công nhưng cấp quyền truy cập thất bại"),
    ("INTEG", "Cổng thanh toán gián đoạn"), ("INTEG", "Dịch vụ gửi email lỗi"),
    ("INTEG", "Tin nhắn/thông báo real-time tự kết nối lại"), ("INTEG", "Hệ thống ổn định khi nhiều người dùng tìm kiếm"),
    ("INTEG", "Số liệu doanh thu Owner khớp với tổng giao dịch thực tế ghi nhận ở cổng"),
]
FLIPPED = 0
for _r in rows:
    if _r[6] == PLAN and not any(_r[0] == m and t in _r[3] for m, t in STILL_PLAN_OLD):
        _r[6] = DONE
        FLIPPED += 1
STILL_PLAN_OLD_COUNT = sum(1 for _r in rows if _r[6] == PLAN)

# Nạp testcase mới từ qa/cases_*.py (mỗi file có hàm load(add)).
CASE_MODULES = ["cases_auth", "cases_community", "cases_content", "cases_classroom",
                "cases_payments", "cases_comms", "cases_platform"]
for _m in CASE_MODULES:
    try:
        _mod = importlib.import_module(_m)
    except ModuleNotFoundError as _e:
        if _e.name == _m:
            print(f"[WARN] chưa có {_m}.py — bỏ qua")
            continue
        raise
    _before = len(rows)
    _mod.load(add)
    print(f"[cases] {_m}: +{len(rows) - _before}")

# Kiểm tra: trùng tiêu đề trong cùng module, giá trị enum hợp lệ.
_seen, _errs = set(), []
for _r in rows:
    k = (_r[0], _r[3].strip().lower())
    if k in _seen:
        _errs.append(f"TRÙNG tiêu đề: [{_r[0]}] {_r[3]}")
    _seen.add(k)
    if _r[4] not in ("Chức năng", "Giao diện", "Bảo mật", "Tích hợp", "Hiệu năng"):
        _errs.append(f"ttype lạ: [{_r[0]}] {_r[3]} -> {_r[4]}")
    if _r[5] not in ("Cao", "Trung bình", "Thấp"):
        _errs.append(f"priority lạ: [{_r[0]}] {_r[3]} -> {_r[5]}")
    if _r[6] not in (DONE, PLAN):
        _errs.append(f"status lạ: [{_r[0]}] {_r[3]} -> {_r[6]}")
    if _r[11] not in (None, "Có", "Một phần", "Không"):
        _errs.append(f"pw lạ: [{_r[0]}] {_r[3]} -> {_r[11]}")
    if not all(isinstance(_r[i], str) and _r[i].strip() for i in (2, 3, 7, 9, 10)):
        _errs.append(f"thiếu trường: [{_r[0]}] {_r[3]}")
if _errs:
    print("\n".join(_errs))
    raise SystemExit(f"{len(_errs)} lỗi dữ liệu testcase — dừng.")

print(f"TOTAL_ROWS={len(rows)} (cũ {OLD_TOTAL}, chuyển Kế hoạch->Đã hoàn thiện: {FLIPPED}, còn Kế hoạch: {sum(1 for _r in rows if _r[6] == PLAN)})")

# ---------------------------------------------------------------------------
# Phân loại mức độ phù hợp tự động hóa bằng Playwright Test
# ---------------------------------------------------------------------------
MANUAL_ONLY_KEYWORDS = [
    "gửi email", "kiểm tra email", "hộp thư", "email xác nhận", "email hóa đơn",
    "email nhắc", "email giao dịch", "email gửi đúng ngôn ngữ",
    "2fa", "otp", "google calendar", ".ics",
    "load test", "concurrent users", "đối soát", "audit log", "nhật ký",
    "cơ sở dữ liệu", "database", "vnpay", "momo", "payos", "stripe",
    "hash", "chữ ký (signature)", "chứng chỉ ssl", "https",
]
PARTIAL_KEYWORDS = [
    "webhook", "thanh toán", "cổng thanh toán", "real-time", "websocket",
    "reconnect", "múi giờ",
]

def classify_playwright(ttype, feature, title, expected):
    text = f"{feature} {title} {expected}".lower()
    if any(k in text for k in MANUAL_ONLY_KEYWORDS):
        return "Một phần" if "stripe" in text or "webhook" in text else "Không"
    if ttype == "Hiệu năng":
        return "Không" if ("concurrent" in text or "load" in text or "tải cao" in text) else "Có"
    if any(k in text for k in PARTIAL_KEYWORDS):
        return "Một phần"
    if ttype in ("Chức năng", "Giao diện", "Bảo mật"):
        return "Có"
    if ttype == "Tích hợp":
        return "Một phần"
    return "Một phần"

# ---------------------------------------------------------------------------
# BUILD WORKBOOK
# ---------------------------------------------------------------------------
wb = openpyxl.Workbook()

# ---- Sheet 1: Tong quan ----
ws0 = wb.active
ws0.title = "Tổng quan"

title_font = Font(name=FONT_NAME, size=16, bold=True, color="FFFFFF")
title_fill = PatternFill("solid", fgColor="1F4E78")
h2_font = Font(name=FONT_NAME, size=12, bold=True, color="1F4E78")
label_font = Font(name=FONT_NAME, size=10, bold=True)
normal_font = Font(name=FONT_NAME, size=10)

ws0.merge_cells("A1:E1")
ws0["A1"] = "BỘ TEST CASE — SOFINHUB"
ws0["A1"].font = title_font
ws0["A1"].fill = title_fill
ws0["A1"].alignment = Alignment(horizontal="center", vertical="center")
ws0.row_dimensions[1].height = 30

info = [
    ("Dự án", "SofinHub — Nền tảng Cộng đồng & Khóa học trực tuyến"),
    ("Nguồn tài liệu", "SofinHub-BRD.docx (BRD v1.0, 28/09/2026) + backend/docs/API.md, backend/docs/api/*.md, docs/features/*.md, backend/docs/DATABASE.md, backend/prisma/seed* (đợt 30/09/2026)"),
    ("Ngày tạo bộ test case", "29/09/2026 — cập nhật đợt backend Postgres + frontend 30/09/2026 (xem sheet 'Nhật ký thay đổi')"),
    ("Cách xem testcase", "MỖI MODULE MỘT SHEET (17 sheet, tên dạng 'MÃ - Tên': HOME, AUTH, COMM, COURSE, FEED, PAY, ROLE...). Bấm tên module ở bảng 'Thống kê theo Module' bên dưới để nhảy tới sheet; mỗi sheet có sẵn bộ lọc theo Chức năng/Loại test/Ưu tiên/Phù hợp Playwright và cột Mã TC + Chức năng được cố định khi cuộn ngang. Cột tiến độ Test 1/Test 2 (Pass/Fail/Chưa test) ở bảng thống kê tự cập nhật khi tester điền kết quả."),
    ("Sheet phụ", "'Tài khoản & dữ liệu test' (tài khoản/dữ liệu seed, cách dựng môi trường) · 'Nhật ký thay đổi' · 'Bằng chứng (ảnh)' (ảnh Playwright)"),
    ("Người soạn thảo", "QA/Tester"),
    ("Tổng số test case", len(rows)),
]
r = 3
for label, val in info:
    ws0[f"A{r}"] = label
    ws0[f"A{r}"].font = label_font
    ws0.merge_cells(f"B{r}:E{r}")
    ws0[f"B{r}"] = val
    ws0[f"B{r}"].font = normal_font
    r += 1

r += 1
ws0[f"A{r}"] = "Chú giải cột 'Trạng thái tính năng'"
ws0[f"A{r}"].font = h2_font
r += 1
legend = [
    ("Đã hoàn thiện", "Tính năng đã được xây dựng thật, có thể test/thực thi ngay bây giờ.", "C6EFCE"),
    ("Kế hoạch", "Tính năng đã đặc tả nghiệp vụ trong BRD nhưng chưa được xây dựng — test case chuẩn bị sẵn, thực thi khi tính năng hoàn thành.", "FFEB9C"),
]
for name, desc, color in legend:
    ws0[f"A{r}"] = name
    ws0[f"A{r}"].font = Font(name=FONT_NAME, size=10, bold=True)
    ws0[f"A{r}"].fill = PatternFill("solid", fgColor=color)
    ws0.merge_cells(f"B{r}:E{r}")
    ws0[f"B{r}"] = desc
    ws0[f"B{r}"].font = normal_font
    ws0[f"B{r}"].alignment = Alignment(wrap_text=True)
    r += 1

r += 1
ws0[f"A{r}"] = "Chú giải cột 'Trạng thái test' (điền khi thực thi)"
ws0[f"A{r}"].font = h2_font
r += 1
legend2 = [
    ("Chưa test", "D9D9D9"), ("Pass", "C6EFCE"), ("Fail", "FFC7CE"),
    ("Blocked", "FFEB9C"), ("N/A", "D9D9D9"),
]
for name, color in legend2:
    ws0[f"A{r}"] = name
    ws0[f"A{r}"].font = Font(name=FONT_NAME, size=10, bold=True)
    ws0[f"A{r}"].fill = PatternFill("solid", fgColor=color)
    r += 1

r += 1
ws0[f"A{r}"] = "Chú giải cột 'Phù hợp Playwright' & mô hình 2 người test"
ws0[f"A{r}"].font = h2_font
r += 1
legend3 = [
    ("Có", "Tự động hóa tốt bằng Playwright Test (UI flow, form, API request, kể cả nhiều case bảo mật như IDOR/JWT/CSRF/rate-limit qua APIRequestContext). Giao cho Người test 1.", "C6EFCE"),
    ("Một phần", "Automate được 1 phần (VD webhook giả lập, Stripe test mode, responsive/SEO) nhưng cần xác minh thêm thủ công song song.", "FFEB9C"),
    ("Không", "Nên test thủ công: cần đọc email/OTP thật, cổng thanh toán nội địa có xác thực ngân hàng (VNPay/MoMo/PayOS), load test (dùng k6/Artillery), đối soát dữ liệu/DB.", "FFC7CE"),
]
for name, desc, color in legend3:
    ws0[f"A{r}"] = name
    ws0[f"A{r}"].font = Font(name=FONT_NAME, size=10, bold=True)
    ws0[f"A{r}"].fill = PatternFill("solid", fgColor=color)
    ws0.merge_cells(f"B{r}:E{r}")
    ws0[f"B{r}"] = desc
    ws0[f"B{r}"].font = normal_font
    ws0[f"B{r}"].alignment = Alignment(wrap_text=True)
    r += 1
r += 1
ws0[f"A{r}"] = "Người test 1"
ws0[f"A{r}"].font = label_font
ws0.merge_cells(f"B{r}:E{r}")
ws0[f"B{r}"] = "Test bằng Playwright Test (có script tự động) — điền tên vào cột 'Người test 1', kết quả vào 'Trạng thái test 1', đường dẫn/link bằng chứng (trace viewer, video, screenshot report) vào cột 'Evidences'."
ws0[f"B{r}"].font = normal_font
ws0[f"B{r}"].alignment = Alignment(wrap_text=True)
r += 1
ws0[f"A{r}"] = "Người test 2"
ws0[f"A{r}"].font = label_font
ws0.merge_cells(f"B{r}:E{r}")
ws0[f"B{r}"] = "Test thủ công (manual) — điền tên vào cột 'Người test 2', kết quả vào 'Trạng thái test 2'. Bắt buộc với mọi case có Phù hợp Playwright = 'Không', khuyến khích chạy song song để đối chiếu với các case 'Có'/'Một phần'."
ws0[f"B{r}"].font = normal_font
ws0[f"B{r}"].alignment = Alignment(wrap_text=True)
r += 1

r += 1
ws0[f"A{r}"] = "Thống kê theo Module"
ws0[f"A{r}"].font = h2_font
r += 1
hdr_row = r
headers0 = ["Mã Module", "Tên Module", "Tổng số TC", "Đã hoàn thiện", "Kế hoạch",
            "Playwright: Có", "Playwright: Một phần/Không"]
for i, h in enumerate(headers0):
    c = ws0.cell(row=hdr_row, column=i+1, value=h)
    c.font = Font(name=FONT_NAME, size=10, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1F4E78")
    c.alignment = Alignment(horizontal="center")

seen_modules = []
for row in rows:
    code, name = row[0], row[1]
    if (code, name) not in seen_modules:
        seen_modules.append((code, name))

data_start = hdr_row + 1
for i, (code, name) in enumerate(seen_modules):
    rr = data_start + i
    ws0.cell(row=rr, column=1, value=code).font = normal_font
    ws0.cell(row=rr, column=2, value=name).font = normal_font
    # COUNTIFS formulas referencing the Test Cases sheet
    ws0.cell(row=rr, column=3,
        value=f'=COUNTIF(\'Test Cases\'!$A:$A,A{rr})').font = normal_font
    ws0.cell(row=rr, column=4,
        value=f'=COUNTIFS(\'Test Cases\'!$A:$A,A{rr},\'Test Cases\'!$G:$G,"Đã hoàn thiện")').font = normal_font
    ws0.cell(row=rr, column=5,
        value=f'=COUNTIFS(\'Test Cases\'!$A:$A,A{rr},\'Test Cases\'!$G:$G,"Kế hoạch")').font = normal_font
    ws0.cell(row=rr, column=6,
        value=f'=COUNTIFS(\'Test Cases\'!$B:$B,B{rr},\'Test Cases\'!$H:$H,"Có")').font = normal_font
    ws0.cell(row=rr, column=7, value=f"=C{rr}-F{rr}").font = normal_font

total_row = data_start + len(seen_modules)
ws0.cell(row=total_row, column=2, value="TỔNG CỘNG").font = Font(name=FONT_NAME, size=10, bold=True)
ws0.cell(row=total_row, column=3, value=f"=SUM(C{data_start}:C{total_row-1})").font = Font(name=FONT_NAME, size=10, bold=True)
ws0.cell(row=total_row, column=4, value=f"=SUM(D{data_start}:D{total_row-1})").font = Font(name=FONT_NAME, size=10, bold=True)
ws0.cell(row=total_row, column=5, value=f"=SUM(E{data_start}:E{total_row-1})").font = Font(name=FONT_NAME, size=10, bold=True)
ws0.cell(row=total_row, column=6, value=f"=SUM(F{data_start}:F{total_row-1})").font = Font(name=FONT_NAME, size=10, bold=True)
ws0.cell(row=total_row, column=7, value=f"=SUM(G{data_start}:G{total_row-1})").font = Font(name=FONT_NAME, size=10, bold=True)

# --- Thống kê thêm: theo trạng thái tính năng / loại test / ưu tiên / phù hợp Playwright (công thức COUNTIF -> tự cập nhật) ---
_r0 = total_row + 2
for _title, _col, _vals in [
    ("Thống kê theo Trạng thái tính năng", "G", [DONE, PLAN]),
    ("Thống kê theo Loại test", "E", ["Chức năng", "Giao diện", "Bảo mật", "Tích hợp", "Hiệu năng"]),
    ("Thống kê theo Mức ưu tiên", "F", ["Cao", "Trung bình", "Thấp"]),
    ("Thống kê theo Phù hợp Playwright (Test 1 tự động / Test 2 thủ công)", "H", ["Có", "Một phần", "Không"]),
]:
    ws0.cell(row=_r0, column=1, value=_title).font = h2_font
    _r0 += 1
    for _v in _vals:
        ws0.cell(row=_r0, column=1, value=_v).font = normal_font
        ws0.cell(row=_r0, column=3, value=f"=COUNTIF('Test Cases'!${_col}:${_col},A{_r0})").font = normal_font
        _r0 += 1
    _r0 += 1

col_widths0 = [14, 40, 12, 14, 12, 15, 20]
for i, w in enumerate(col_widths0):
    ws0.column_dimensions[get_column_letter(i+1)].width = w

# ---- Sheet 2: Test Cases ----
ws = wb.create_sheet("Test Cases")

headers = ["Mã Test Case", "Module", "Chức năng", "Tiêu đề Test Case", "Loại test",
           "Mức ưu tiên", "Trạng thái tính năng", "Phù hợp Playwright", "Tiền điều kiện",
           "Các bước thực hiện", "Dữ liệu test", "Kết quả mong đợi",
           "Người test 1 (Automation)", "Trạng thái test 1", "Evidences",
           "Người test 2 (Manual)", "Trạng thái test 2", "Ghi chú / Kết quả thực tế / Bug ref"]

header_fill = PatternFill("solid", fgColor="1F4E78")
header_font = Font(name=FONT_NAME, size=10, bold=True, color="FFFFFF")
thin = Side(style="thin", color="B7B7B7")
border = Border(left=thin, right=thin, top=thin, bottom=thin)

for i, h in enumerate(headers):
    c = ws.cell(row=1, column=i+1, value=h)
    c.font = header_font
    c.fill = header_fill
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = border
ws.row_dimensions[1].height = 32
ws.freeze_panes = "A2"

# id counters per module
id_counter = {}
priority_fill = {
    "Cao": PatternFill("solid", fgColor="FFC7CE"),
    "Trung bình": PatternFill("solid", fgColor="FFEB9C"),
    "Thấp": PatternFill("solid", fgColor="C6EFCE"),
}
status_fill = {
    DONE: PatternFill("solid", fgColor="C6EFCE"),
    PLAN: PatternFill("solid", fgColor="FFEB9C"),
}
pw_fill = {
    "Có": PatternFill("solid", fgColor="C6EFCE"),
    "Một phần": PatternFill("solid", fgColor="FFEB9C"),
    "Không": PatternFill("solid", fgColor="FFC7CE"),
}

for ridx, row in enumerate(rows, start=2):
    code, mname, feature, title, ttype, priority, status, precond, steps_txt, data, expected, pw_override = row
    id_counter[code] = id_counter.get(code, 0) + 1
    tc_id = f"TC-{code}-{id_counter[code]:03d}"
    pw_fit = pw_override or classify_playwright(ttype, feature, title, expected)

    values = [code, mname, feature, title, ttype, priority, status, pw_fit, precond,
              steps_txt, data, expected, "", "Chưa test", "", "", "Chưa test", ""]
    for cidx, v in enumerate(values, start=1):
        c = ws.cell(row=ridx, column=cidx, value=v)
        c.font = normal_font
        c.border = border
        c.alignment = Alignment(vertical="top", wrap_text=True)

    # overwrite column A with generated TC id (keep module code searchable in col? -> use col A for ID instead)
    ws.cell(row=ridx, column=1, value=tc_id)
    ws.cell(row=ridx, column=1).font = Font(name=FONT_NAME, size=10, bold=True)

    ws.cell(row=ridx, column=6).fill = priority_fill.get(priority, PatternFill())
    ws.cell(row=ridx, column=7).fill = status_fill.get(status, PatternFill())
    ws.cell(row=ridx, column=8).fill = pw_fill.get(pw_fit, PatternFill())
    ws.cell(row=ridx, column=14).fill = PatternFill("solid", fgColor="D9D9D9")
    ws.cell(row=ridx, column=17).fill = PatternFill("solid", fgColor="D9D9D9")

    # row height based on line count
    n_lines = max(steps_txt.count("\n") + 1, expected.count("\n") + 1, 2)
    ws.row_dimensions[ridx].height = max(15 * n_lines, 30)

# NOTE: overview sheet COUNTIF references column A (module code) but we replaced col A with TC-ID.
# Fix: overview should reference column B (Module name) grouping instead. Rebuild formulas using module code
# embedded in TC id prefix via LEFT/FIND is complex; instead use column B (module full name) matches.
for i, (code, name) in enumerate(seen_modules):
    rr = data_start + i
    ws0.cell(row=rr, column=3, value=f"=COUNTIF('Test Cases'!$B:$B,B{rr})")
    ws0.cell(row=rr, column=4, value=f'=COUNTIFS(\'Test Cases\'!$B:$B,B{rr},\'Test Cases\'!$G:$G,"Đã hoàn thiện")')
    ws0.cell(row=rr, column=5, value=f'=COUNTIFS(\'Test Cases\'!$B:$B,B{rr},\'Test Cases\'!$G:$G,"Kế hoạch")')

col_widths = [14, 20, 20, 32, 12, 12, 16, 14, 26, 42, 20, 32, 16, 13, 28, 16, 13, 24]
for i, w in enumerate(col_widths):
    ws.column_dimensions[get_column_letter(i+1)].width = w

ws.auto_filter.ref = f"A1:R{len(rows)+1}"

# Data validation dropdowns
dv_status1 = DataValidation(type="list", formula1='"Chưa test,Pass,Fail,Blocked,N/A"', allow_blank=True)
ws.add_data_validation(dv_status1)
dv_status1.add(f"N2:N{len(rows)+1}")

dv_status2 = DataValidation(type="list", formula1='"Chưa test,Pass,Fail,Blocked,N/A"', allow_blank=True)
ws.add_data_validation(dv_status2)
dv_status2.add(f"Q2:Q{len(rows)+1}")

dv_priority = DataValidation(type="list", formula1='"Cao,Trung bình,Thấp"', allow_blank=True)
ws.add_data_validation(dv_priority)
dv_priority.add(f"F2:F{len(rows)+1}")

dv_feat_status = DataValidation(type="list", formula1=f'"{DONE},{PLAN}"', allow_blank=True)
ws.add_data_validation(dv_feat_status)
dv_feat_status.add(f"G2:G{len(rows)+1}")

dv_pw = DataValidation(type="list", formula1='"Có,Một phần,Không"', allow_blank=True)
ws.add_data_validation(dv_pw)
dv_pw.add(f"H2:H{len(rows)+1}")

# ---------------------------------------------------------------------------
# KHÔI PHỤC kết quả test đã nhập (cột M..R) từ file xlsx cũ, khớp theo mã TC + tiêu đề
# (mã TC ổn định vì testcase mới luôn thêm CUỐI mỗi module).
# ---------------------------------------------------------------------------
_restored = _skipped = 0
if os.path.exists(OUT) and "--no-restore" not in sys.argv:
    try:
        _old = openpyxl.load_workbook(OUT)
        # File cũ có thể là 1 sheet "Test Cases" (bản trước) hoặc nhiều sheet theo module (bản hiện tại):
        # gom mọi sheet có A1 = "Mã Test Case" và B1 = "Module" (loại trừ sheet Bằng chứng) để khôi phục kết quả theo mã TC.
        _test_sheets = [_s for _s in _old.worksheets if _s.cell(row=1, column=1).value == "Mã Test Case" and _s.cell(row=1, column=2).value == "Module"]
        if _test_sheets:
            _oldmap = {}
            for _ows in _test_sheets:
                for _row in _ows.iter_rows(min_row=2):
                    if _row[0].value:
                        _oldmap[_row[0].value] = _row
            for _row in ws.iter_rows(min_row=2):
                _o = _oldmap.get(_row[0].value)
                if _o is None:
                    continue
                if (_o[3].value or "").strip() != (_row[3].value or "").strip():
                    _skipped += 1   # cùng mã nhưng tiêu đề đổi -> không khôi phục để tránh gán nhầm
                    continue
                for _ci in range(12, 18):  # M..R
                    _ov = _o[_ci]
                    if _ov.value in (None, ""):
                        continue
                    if _ci in (13, 16) and _ov.value == "Chưa test":
                        continue
                    _nc = _row[_ci]
                    _nc.value = _ov.value
                    if _ov.hyperlink:
                        _nc.hyperlink = _ov.hyperlink.target if hasattr(_ov.hyperlink, "target") else _ov.hyperlink
                        _nc.font = Font(name=FONT_NAME, size=10, color="0563C1", underline="single")
                _restored += 1
    except Exception as _e:  # file cũ hỏng/đang mở -> vẫn sinh mới
        print("[WARN] không đọc được xlsx cũ để khôi phục kết quả:", _e)
print(f"[restore] khôi phục kết quả cho {_restored} dòng; bỏ qua {_skipped} dòng đổi tiêu đề")

# ---- Tách "Test Cases" thành mỗi module 1 sheet (dễ nhìn hơn 1.7K dòng trong 1 sheet) ----
from split_sheets import split_test_cases
MODULE_SHEETS = split_test_cases(wb, ws, ws0, seen_modules, data_start, hdr_row, DONE, PLAN)
print(f"[split] {len(MODULE_SHEETS)} sheet module: " + ", ".join(t for _, _, t in MODULE_SHEETS))

# ---- Sheet phụ ----
from sheets_extra import build_accounts_sheet, build_changelog_sheet
_new_by_module = OrderedDict()
for _r in rows:
    _new_by_module[(_r[0], _r[1])] = _new_by_module.get((_r[0], _r[1]), 0) + 1
build_accounts_sheet(wb)
build_changelog_sheet(wb, {
    "old_total": OLD_TOTAL, "new_total": len(rows), "flipped": FLIPPED, "still_plan": STILL_PLAN_OLD_COUNT,
    "by_module": [(c, n, OLD_BY_MODULE.get((c, n), 0), v) for (c, n), v in _new_by_module.items()],
})

wb.save(OUT)
print("SAVED:", OUT)

# ---------------------------------------------------------------------------
# Ghi lại kết quả Playwright + nhúng ảnh bằng chứng (nếu đã có e2e/parsed_results.json).
# Bỏ qua bằng: python qa/gen_testcases.py --no-results
# ---------------------------------------------------------------------------
import subprocess

_here = os.path.dirname(os.path.abspath(__file__))
_results = os.path.join(os.path.dirname(_here), "e2e", "parsed_results.json")
if "--no-results" not in sys.argv and os.path.exists(_results):
    for _script in ("apply_playwright_results.py", "embed_evidence_images.py"):
        print(f"[post] chạy {_script}")
        _p = subprocess.run([sys.executable, os.path.join(_here, _script)], capture_output=True, text=True, encoding="utf-8")
        print(_p.stdout.strip())
        if _p.returncode != 0:
            print(_p.stderr.strip())
            print(f"[WARN] {_script} lỗi (mã {_p.returncode}) — xlsx vẫn còn nhưng chưa có ảnh/kết quả Playwright")
