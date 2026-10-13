# -*- coding: utf-8 -*-
"""Module TOOLS - Trang 'Tải Tool' /tools (clone https://taothaoai.com/tools, 10/2026).

Nguồn: taothao_ai_training (src/lib/toolsCatalog.ts, src/features/tools-download/*) - danh mục 7 tool + bộ lọc + thẻ + form mua;
giao diện dựng lại bằng style SofinHub (glass, cam #f26a1b). Code: frontend/src/pages/ToolsPage.tsx, frontend/src/features/tools/*,
i18n namespace `tools`, mục menu 'Tải Tool' ở Header. Dữ liệu tool là tĩnh (frontend/src/features/tools/catalog.ts), KHÔNG gọi API.
Form 'Mua ngay' gửi qua POST /api/tools/lead {name, phone, email?, toolId, toolName} -> 202: tạo ticket 'Mua tool: <tên>' (Admin > Hỗ trợ) + thư tới SUPPORT_EMAIL + tin Telegram 'YÊU CẦU MUA TOOL MỚI' tới nhóm TELEGRAM_CHAT_ID (cùng nhóm với taothaoai). Email không bắt buộc.
Thêm case mới = thêm CUỐI file (giữ mã TC-TOOLS-nnn)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

BASE = "Frontend :5173 chạy (npm run dev ở frontend); backend :4000 chạy cho phần gửi form. Không cần đăng nhập."
FORM = BASE + " Đã bấm 'Mua ngay' ở một thẻ tool có phí (ví dụ 'Tool Veo') để mở popup."


def load(add):
    M, MN = "TOOLS", "Tải Tool (/tools)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ---------------------------------------------------------------- Trang & điều hướng
    A("Trang & điều hướng", "Mở /tools hiển thị tiêu đề, mô tả, bộ lọc danh mục và 7 thẻ tool", "Chức năng", "Cao", BASE,
      ["Mở http://localhost:5173/tools", "Quan sát khung tiêu đề, hàng 'Danh mục:' và lưới thẻ"], "-",
      "Header + Footer SofinHub; khung kính mờ tiêu đề 'TẢI TOOL' kèm mô tả; chip: Tất cả, Video AI, Automation, Voice AI, VIP ('Tất cả' đang chọn, nền cam); đúng 7 thẻ theo thứ tự: MicroDrama – Seedance 2.0, Veo, YouTube Automation AI 2026 – AI Agent, Grok Automation, CloudProfile, Voice ngoại và Voice Việt, Voice giải CAPTCHA.")
    A("Trang & điều hướng", "Mục 'Tải Tool' trên Header dẫn tới /tools và được tô cam khi đang ở trang", "Chức năng", "Trung bình", BASE,
      ["Vào trang chủ, trên Header (màn ≥ md) bấm 'Tải Tool'", "Quan sát mục menu"], "-",
      "Chuyển tới /tools không tải lại trang; mục 'Tải Tool' đậm + màu cam. Đăng nhập rồi: mục cũng có trong menu avatar trên mobile.")
    A("Trang & điều hướng", "Đổi ngôn ngữ VI/EN: tiêu đề, nhãn, nút của trang đổi theo; dữ liệu tool giữ nguyên tiếng Việt", "Chức năng", "Thấp", BASE,
      ["Ở /tools bấm nút ngôn ngữ trên Header sang EN", "Quan sát"], "-",
      "Tiêu đề 'DOWNLOAD TOOLS', 'Category:', 'All', 'CONTACT US', 'Buy now', 'Download free', badge 'NEW'; tên/mô tả/tag tool giữ nguyên (nguồn dữ liệu gốc tiếng Việt).")
    A("Trang & điều hướng", "Đường dẫn không đăng nhập vẫn vào được /tools", "Chức năng", "Trung bình", BASE,
      ["Mở /tools bằng cửa sổ ẩn danh"], "-", "Trang hiển thị bình thường, không bị chuyển sang /login.")

    # ---------------------------------------------------------------- Bộ lọc
    for cat, names in (
        ("Video AI", "chỉ 'Tool Veo'"),
        ("Automation", "3 thẻ: YouTube Automation AI 2026, Grok Automation, CloudProfile"),
        ("Voice AI", "2 thẻ: Voice ngoại và Voice Việt, Voice giải CAPTCHA"),
        ("VIP", "chỉ 'Tool MicroDrama – Seedance 2.0'"),
    ):
        A("Bộ lọc danh mục", f"Chọn chip '{cat}' chỉ hiện tool thuộc danh mục đó", "Chức năng", "Cao", BASE,
          [f"Ở /tools bấm chip '{cat}'", "Đếm các thẻ"], cat, f"Chip '{cat}' chuyển cam (aria-pressed=true), chip 'Tất cả' về trạng thái thường; lưới hiện {names}.")
    A("Bộ lọc danh mục", "Bấm lại 'Tất cả' hiện đủ 7 thẻ", "Chức năng", "Trung bình", BASE,
      ["Bấm 'VIP'", "Bấm 'Tất cả'"], "-", "Quay lại đủ 7 thẻ; chỉ một chip được chọn tại một thời điểm.")

    # ---------------------------------------------------------------- Thẻ tool
    A("Thẻ tool", "Thẻ 'Tool MicroDrama – Seedance 2.0': badge HOT, MIỄN PHÍ, nút 'Tải miễn phí' mở taothaoai.com/microdrama ở tab mới", "Chức năng", "Cao", BASE,
      ["Quan sát thẻ đầu tiên", "Bấm 'Tải miễn phí'"], "-",
      "Viền cam nhạt + badge 'HOT' góc phải; chip danh mục 'VIP' và tag Seedance 2.0 / VIP / MicroDrama; chữ 'MIỄN PHÍ' màu xanh lá; bấm nút mở https://taothaoai.com/microdrama trong tab mới (target=_blank, rel noopener).")
    A("Thẻ tool", "Thẻ 'Tool YouTube Automation AI 2026 – AI Agent' có badge MỚI", "Chức năng", "Thấp", BASE,
      ["Tìm thẻ thứ 3"], "-", "Badge 'MỚI' (vàng); giá hiển thị 'LIÊN HỆ' (cam) + nút 'Mua ngay'.")
    A("Thẻ tool", "Các tool có phí hiển thị 'LIÊN HỆ' và nút 'Mua ngay' (không có nút tải)", "Chức năng", "Cao", BASE,
      ["Quan sát 6 thẻ còn lại"], "-", "Mỗi thẻ có chữ 'LIÊN HỆ' + nút 'Mua ngay'; không có đường dẫn tải trực tiếp.")
    A("Thẻ tool", "Mỗi thẻ hiển thị icon, tên, chip danh mục, các tag và mô tả đầy đủ khớp trang gốc", "Giao diện", "Trung bình", BASE + " Mở song song https://taothaoai.com/tools.",
      ["So sánh từng thẻ với trang gốc: tên, tag, mô tả, icon"], "7 tool",
      "Nội dung chữ trùng khớp trang gốc; icon hiển thị (không vỡ ảnh) từ /images/tools/*.png; mô tả không bị cắt.")
    A("Thẻ tool", "Rê chuột lên thẻ: thẻ nâng nhẹ và đổ bóng", "Giao diện", "Thấp", BASE, ["Rê chuột lên một thẻ"], "-", "Thẻ dịch lên ~4px và có bóng đậm hơn; không giật layout.", pw="Một phần")
    A("Thẻ tool", "Bố cục lưới: 3 cột (≥1280px), 2 cột (≥768px), 1 cột (mobile), không tràn ngang", "Giao diện", "Trung bình", BASE,
      ["Đổi độ rộng cửa sổ 1440 / 900 / 390px"], "-", "3 / 2 / 1 cột; không thanh cuộn ngang; badge không chồng lên tên tool.")

    # ---------------------------------------------------------------- Form mua
    A("Form mua tool", "'Mua ngay' mở popup tiêu đề 'Mua <tên tool>' với 3 ô Họ và tên, Số điện thoại, Email", "Chức năng", "Cao", BASE,
      ["Bấm 'Mua ngay' ở 'Tool Veo'"], "-", "Popup nền mờ phủ trang, tiêu đề 'Mua Tool Veo', lời dẫn, 3 ô trống, nút 'Gửi thông tin →'.")
    A("Form mua tool", "Popup chỉ đóng bằng nút ×; bấm ra vùng nền tối bên ngoài KHÔNG đóng", "Chức năng", "Trung bình", FORM,
      ["Bấm vùng nền tối bên ngoài popup", "Bấm vào ô nhập trong popup", "Bấm nút ×"], "-", "Bấm nền ngoài và bấm trong popup: popup vẫn mở, dữ liệu đã nhập giữ nguyên; chỉ nút × đóng popup (sau khi gửi thành công còn có nút 'Đóng').")
    A("Form mua tool", "Gửi form trống: báo lỗi từng ô, không gọi API", "Chức năng", "Cao", FORM,
      ["Để trống cả 3 ô, bấm 'Gửi thông tin →'"], "-", "Hiện lỗi dưới ô Họ tên (bắt buộc) và Số điện thoại 'Số điện thoại không hợp lệ.'; Email không báo lỗi (không bắt buộc); Network không có POST /api/tools/lead.")
    for phone, ok in (("0912345678", True), ("+84912345678", True), ("0912 345 678", True), ("091234", False), ("abcdefghij", False)):
        A("Form mua tool", f"Số điện thoại '{phone}' → {'hợp lệ' if ok else 'báo lỗi'}", "Chức năng", "Trung bình", FORM,
          ["Nhập Họ tên 'Nguyễn Văn A', Email 'a@gmail.com', SĐT như dữ liệu", "Bấm gửi"], phone,
          "Được gửi đi (POST /api/tools/lead)" if ok else "Hiện 'Số điện thoại không hợp lệ.', không gửi")
    A("Form mua tool", "Email sai định dạng bị chặn", "Chức năng", "Trung bình", FORM,
      ["Nhập đủ Họ tên, SĐT hợp lệ, Email 'abc'", "Bấm gửi"], "abc", "Lỗi dưới ô Email, không gửi.")
    A("Form mua tool", "Gửi thành công: POST /api/tools/lead đúng nội dung, popup báo 'Đã nhận thông tin!'", "Chức năng", "Cao", FORM,
      ["Nhập Họ tên 'Nguyễn Văn A', SĐT '0912 345 678', Email 'a@gmail.com'", "Bấm 'Gửi thông tin →' và xem request"], "Tool Veo",
      "Nút đổi 'Đang gửi…' rồi popup thành công + nút 'Đóng'. Body: name, phone='0912345678' (đã bỏ khoảng trắng), email, toolId='tool-veo', toolName='Tool Veo'; response 202. Admin > Hỗ trợ có ticket 'Mua tool: Tool Veo' nội dung có tên tool, họ tên, SĐT.")
    A("Form mua tool", "Email để trống vẫn gửi được (không bắt buộc)", "Chức năng", "Cao", FORM,
      ["Nhập Họ tên và SĐT hợp lệ, để trống Email", "Bấm gửi"], "-", "Gửi thành công (202), body không có field email; ticket được tạo với email giữ chỗ khong-co-email@tool-lead.local.")
    A("Form mua tool", "Gửi thành công → nhóm Telegram nhận tin 'YÊU CẦU MUA TOOL MỚI'", "Chức năng", "Cao",
      FORM + " backend/.env có TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID (cùng nhóm taothaoai) - CẢNH BÁO: test sẽ bắn vào nhóm thật.",
      ["Gửi form với Tool Veo, tên 'QA Test', SĐT 0912345678, email a@gmail.com", "Mở nhóm Telegram"], "-",
      "Có tin: 🛠️ YÊU CẦU MUA TOOL MỚI / 🔧 Tool: Tool Veo / 👤 Họ và tên: QA Test / 📞 Số điện thoại: 0912345678 / 📧 Email: a@gmail.com / 🕐 giờ VN. Email trống -> 'Không cung cấp'. Tên chứa <b> được escape, không vỡ định dạng.", pw="Không")
    A("Form mua tool", "Telegram lỗi/chưa cấu hình không làm hỏng việc gửi form", "Chức năng", "Trung bình",
      FORM + " Xóa TELEGRAM_BOT_TOKEN khỏi backend/.env, restart backend.",
      ["Gửi form hợp lệ"], "-", "Vẫn 202 + popup thành công + có ticket; Telegram bị bỏ qua (không lỗi).", pw="Không")
    A("Form mua tool", "API /api/tools/lead validate: thiếu name/phone/toolId, SĐT sai → 400; giới hạn 5 lần/15 phút/IP → 429", "Bảo mật", "Trung bình", BASE,
      ["POST /api/tools/lead với body thiếu name", "Với phone '123'", "Gửi hợp lệ 6 lần liên tiếp"], "-", "400 với thông báo tiếng Việt cho 2 case đầu; lần thứ 6 trả 429.", pw="Không")
    A("Form mua tool", "Lỗi backend (tắt backend / 429) hiện thông báo, giữ nguyên dữ liệu đã nhập", "Chức năng", "Trung bình", FORM,
      ["Tắt backend, nhập hợp lệ, gửi", "Bật lại backend, gửi nhiều lần liên tiếp tới khi 429"], "-",
      "Lỗi mạng: 'Có lỗi xảy ra, vui lòng thử lại.'; 429: 'Bạn đã gửi quá nhiều yêu cầu...'; ô nhập không bị xóa, có thể gửi lại.", pw="Một phần")
    A("Form mua tool", "Thông tin form chống XSS: tên chứa <script> chỉ hiển thị dạng chữ", "Bảo mật", "Trung bình", FORM,
      ["Nhập Họ tên '<img src=x onerror=alert(1)>' + dữ liệu hợp lệ, gửi", "Xem ticket ở Admin > Hỗ trợ"], "-", "Không chạy script; nội dung hiển thị nguyên văn.", pw="Một phần")

    # ---------------------------------------------------------------- Chưa làm
    A("Điểm chưa làm", "Giá bán thật của từng tool (hiện chỉ 'LIÊN HỆ') và lưu thông tin khách vào bảng lead riêng", "Chức năng", "Thấp",
      "Trang gốc cũng chỉ hiển thị 'LIÊN HỆ'; lead lưu như ticket hỗ trợ + báo Telegram (không có bảng ToolLead riêng).",
      ["Xem schema backend"], "-", "Dự kiến: bảng ToolLead + trang admin quản lý lead, banner khuyến mãi/đồng hồ đếm ngược như trang gốc.", pw="Không", st=PLAN)
