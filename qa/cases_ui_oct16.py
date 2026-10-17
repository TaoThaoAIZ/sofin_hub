# -*- coding: utf-8 -*-
"""Hai module đợt 16/10/2026.

THEME - Giao diện sáng/tối + trang chủ (Khám phá) dựng lại theo Figma "Microdrama AI Studio":
  * Khung sáng node 1521:8432, khung tối node 1597:4471. Nền tối #0c1013, mặt thẻ/chip rgba(63,63,63,.3), chữ trắng, chữ phụ #bababa, cam #ff570a.
  * Font toàn app: Plus Jakarta Sans (hỗ trợ tiếng Việt, thay Manrope). Màu thương hiệu #ff570a (trước là #f26a1b).
  * Code: frontend/src/features/theme/ThemeProvider.tsx (class `dark` trên <html>, khóa localStorage `sofinhub.theme`, đồng bộ `user.theme`
    qua PATCH /auth/me/preferences), nút đổi sáng/tối ở Header, frontend/src/index.css (khối "GIAO DIỆN TỐI" đảo bảng màu cho mọi trang),
    features/home/* (Hero, WhyChoose, CommunityCta), components/layout/{Header,Footer}.tsx, components/ui/{ThemedImg,BrandLogo}.tsx,
    ảnh/icon ở public/images/home/{light,dark}/.
UPD16 - Các thay đổi nhỏ trong ngày 16/10/2026 (xóa module, thêm/sửa/xóa bài học ngay trong trang bài học, thẻ khóa học bấm cả thẻ,
  ô 'Công cụ hỗ trợ', SSE một kết nối cho mọi tab, upload S3 qua đĩa tạm, cảnh báo chuyển khoản không lặp, dropdown thông báo không bị cắt).
Thêm case mới = thêm CUỐI file (giữ mã TC-xxx-nnn)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

BASE = "Frontend :5173 + backend :4000 chạy; có tài khoản đăng nhập được (xem sheet 'Tài khoản & dữ liệu test'). Trình duyệt Chrome mới nhất."
GUEST = "Frontend :5173 chạy; chưa đăng nhập (cửa sổ ẩn danh)."


def load(add):
    # ======================================================================= THEME
    M, MN = "THEME", "Giao diện sáng/tối & Trang chủ mới"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ---- Nút đổi giao diện & lưu lựa chọn
    A("Đổi giao diện", "Header có nút đổi sáng/tối (icon mặt trăng ở giao diện sáng, mặt trời ở giao diện tối)", "Chức năng", "Cao", GUEST,
      ["Mở /", "Quan sát cụm nút bên phải Header, giữa nút ngôn ngữ và tài khoản/Đăng nhập"], "-",
      "Có nút tròn; tooltip 'Chuyển sang giao diện tối' (VI) / 'Switch to dark mode' (EN); icon dark_mode ở giao diện sáng.")
    A("Đổi giao diện", "Bấm nút: toàn trang chuyển sang tối ngay, không tải lại, icon đổi thành mặt trời", "Chức năng", "Cao", GUEST,
      ["Ở / bấm nút đổi giao diện", "Quan sát nền, chữ, thẻ, Footer"], "-",
      "Nền trang #0c1013; chữ trắng; thẻ/chip xám mờ; ảnh hero, logo, icon, ảnh CTA chuyển sang bản tối; icon nút thành light_mode; tooltip 'Chuyển sang giao diện sáng'.")
    A("Đổi giao diện", "Khách: lựa chọn được nhớ sau khi tải lại trang (localStorage 'sofinhub.theme'), không chớp sáng khi tải", "Chức năng", "Cao", GUEST,
      ["Chuyển sang tối", "Nhấn F5 vài lần", "Mở DevTools > Application > Local Storage"], "-",
      "Trang vẫn tối; không thấy khoảnh khắc nền trắng (script trong index.html áp class 'dark' trước khi vẽ); khóa 'sofinhub.theme' = 'dark'.", pw="Một phần")
    A("Đổi giao diện", "Đã đăng nhập: bấm nút lưu vào tài khoản (PATCH /api/auth/me/preferences {theme})", "Chức năng", "Cao", BASE,
      ["Đăng nhập", "Mở DevTools > Network", "Bấm nút đổi giao diện"], "-",
      "Giao diện đổi ngay (không chờ mạng); có request PATCH /auth/me/preferences body {\"theme\":\"dark\"} trả 200; user.theme = dark.")
    A("Đổi giao diện", "Đã đăng nhập: đăng nhập trên trình duyệt/thiết bị khác tự theo giao diện đã lưu ở tài khoản", "Chức năng", "Cao", BASE + " Đã đặt giao diện tối ở một trình duyệt.",
      ["Mở trình duyệt khác (hoặc xóa localStorage)", "Đăng nhập cùng tài khoản"], "-", "Sau khi đăng nhập thành công, trang chuyển sang tối theo tài khoản (không cần bấm nút).", pw="Một phần")
    A("Đổi giao diện", "Cài đặt > Tài khoản & bảo mật > Giao diện: chọn Sáng/Tối/Theo hệ thống áp dụng thật", "Chức năng", "Cao", BASE,
      ["Vào /settings (tab Tài khoản & bảo mật)", "Mục 'Giao diện' chọn Tối", "Chọn Sáng", "Chọn 'Theo hệ thống' và đổi chế độ màu của hệ điều hành"], "-",
      "Chọn Tối: toàn app tối; Sáng: sáng; 'Theo hệ thống': đổi theo prefers-color-scheme của OS ngay khi OS đổi; mỗi lần chọn có thông báo lưu thành công; nút ở Header đồng bộ.")
    A("Đổi giao diện", "Nút đổi nhanh từ chế độ 'Theo hệ thống': chuyển sang chế độ ngược với giao diện đang hiển thị", "Chức năng", "Trung bình", BASE + " Đang chọn 'Theo hệ thống', OS ở chế độ sáng.",
      ["Bấm nút ở Header"], "-", "Chuyển sang Tối (và lưu 'dark', không còn 'system').", pw="Một phần")
    A("Đổi giao diện", "Đăng xuất rồi vào lại: giao diện theo localStorage của trình duyệt (không lấy của tài khoản cũ)", "Chức năng", "Thấp", BASE,
      ["Đặt tối, đăng xuất, tải lại /"], "-", "Trang vẫn tối nếu localStorage còn 'dark'; không báo lỗi.", pw="Một phần")
    A("Đổi giao diện", "localStorage bị chặn (cửa sổ riêng tư nghiêm ngặt): trang vẫn chạy, mặc định sáng, nút vẫn đổi được trong phiên", "Chức năng", "Thấp", GUEST,
      ["Chặn dữ liệu trang web trong cài đặt trình duyệt", "Mở / và bấm nút đổi giao diện"], "-", "Không lỗi console; đổi được trong phiên, tải lại về sáng.", pw="Không")

    # ---- Trang chủ giao diện sáng (bố cục mới theo Figma 1521:8432)
    A("Trang chủ - sáng", "Header dạng viên 72px bo 28 nền trắng mờ, logo trái, 3 mục điều hướng giữa, cụm nút phải", "Giao diện", "Cao", BASE + " Cửa sổ rộng 1800px.",
      ["Mở /", "So sánh Header với Figma 1521:8438"], "-",
      "Chiều cao 72px; 'Khám phá' đậm màu cam #ff570a, 'Khóa học'/'Cộng đồng của tôi' chữ thường #201e1c cỡ 18px; nút Tin nhắn + Thông báo tròn 50px nền trắng .72 viền trắng; ngôn ngữ 'VI' kèm icon; ô tài khoản (avatar 35px + tên) bo 20; nút 'Tạo cộng đồng' cam bo 20 cao 50.")
    A("Trang chủ - sáng", "Hero: nhãn nền tảng, tiêu đề 2 dòng (dòng 2 cam), mô tả, ô tìm kiếm, 4 số liệu", "Giao diện", "Cao", GUEST + " Cửa sổ rộng 1800px.",
      ["Mở /", "Đo/đối chiếu với Figma 1521:8462"], "-",
      "Nhãn 'NỀN TẢNG HỌC TẬP TRỰC TUYẾN' cao 37 nền trắng; tiêu đề ~57px ExtraBold 'Học kỹ năng mới.' + 'Phát triển cùng cộng đồng.' (cam); mô tả 22px màu #606060 rộng ≤760; ô tìm kiếm cao 74 bo 28 + nút cam 'Tìm kiếm →' 191x60; 4 vòng tròn 54px: pastel cam/tím/xanh dương/xanh lá, số 28px, nhãn 17px.")
    A("Trang chủ - sáng", "Ảnh nền hero có mặt nạ mờ dần (mask) và không che chữ; Header nằm trên ảnh", "Giao diện", "Trung bình", GUEST,
      ["Mở /", "Quan sát vùng 800px đầu trang"], "-", "Người học ở bên phải, mờ dần về phía dưới-trái; chữ hero đọc rõ; không có thanh cuộn ngang.", pw="Một phần")
    A("Trang chủ - sáng", "Tìm kiếm ở hero lọc danh sách khóa học (giữ nguyên logic cũ)", "Chức năng", "Cao", GUEST,
      ["Gõ một từ khóa (vd. 'Design') vào ô tìm kiếm", "Bấm 'Tìm kiếm →' hoặc Enter"], "Design",
      "Danh sách bên dưới cuộn tới và chỉ còn khóa khớp; chip đếm 'Tìm thấy N khóa học' đổi theo; xóa ô tìm kiếm + Enter trả lại toàn bộ.")
    A("Trang chủ - sáng", "Tiêu đề 'Khóa học nổi bật' 36px bold + hàng chip danh mục cao 60 (Tất cả cam, còn lại trắng bóng mềm)", "Giao diện", "Cao", GUEST + " Cửa sổ 1800px.",
      ["Cuộn tới 'Khóa học nổi bật'", "So sánh với Figma 1584:3020"], "-",
      "'Tất cả' nền cam chữ trắng đậm; vạch chia 1x34 #eee5de; 8 chip trắng bo 20 shadow mềm, icon 24 + chữ 18px; mép phải mờ dần khi tràn (kéo ngang/lăn chuột được).")
    A("Trang chủ - sáng", "Bấm chip danh mục lọc khóa học; chip đang chọn chuyển cam với icon trắng; 'Tất cả' bỏ lọc", "Chức năng", "Cao", GUEST,
      ["Bấm 'Công nghệ'", "Quan sát chip và danh sách", "Bấm 'Tất cả'"], "-",
      "Chip 'Công nghệ' cam + icon trắng, 'Tất cả' về chip trắng (icon cam); danh sách chỉ khóa thuộc Công nghệ; bấm 'Tất cả' trả đủ.")
    A("Trang chủ - sáng", "Hàng bộ lọc: 5 dropdown (Giá, Loại, Trạng thái, Ngôn ngữ, Sắp xếp) cao 50 bo 18; công tắc lưới/danh sách; 'Tìm thấy N khóa học'", "Giao diện", "Cao", GUEST + " Cửa sổ 1800px.",
      ["Quan sát hàng bộ lọc", "Mở từng dropdown", "Chọn một giá trị"], "-",
      "Dropdown trắng bóng mềm, chữ 18px + mũi tên 20px; mở ra danh sách tùy chọn có dấu ✓ ở mục đang chọn; chọn xong dropdown chuyển nền cam nhạt + viền cam; công tắc: ô lưới cam icon trắng; 'Tìm thấy N khóa học' với N cam đậm.")
    A("Trang chủ - sáng", "Thẻ cộng đồng: ảnh 1672:941 bo 20, tiêu đề, mô tả 2 dòng, chip học phí, thành viên/đánh giá, nút tròn mũi tên", "Giao diện", "Cao", GUEST + " Cửa sổ 1800px (4 cột, khoảng cách 24px).",
      ["Quan sát một thẻ có phí và một thẻ miễn phí", "So sánh với Figma 1521:8569"], "-",
      "Thẻ trắng bo 28; nhãn 'Mới' nền #cdffd3 chữ #009b40 góc trái ảnh (hoặc 'Nổi bật' đỏ...); tiêu đề 20px bold 1 dòng cắt '…'; mô tả 16px #62635f tối đa 2 dòng; chip học phí viền cam: '10.000 đ/tháng' hoặc 'Miễn phí'; hàng dưới: icon thành viên + số, sao + 'rating (số đánh giá)', nút tròn #f87b23 mũi tên trắng.")
    A("Trang chủ - sáng", "Bấm vào bất kỳ chỗ nào trên thẻ đều mở trang chi tiết (nút mũi tên chỉ là hình, không phải link riêng)", "Chức năng", "Cao", GUEST,
      ["Bấm vào ảnh thẻ", "Quay lại, bấm vào mô tả", "Quay lại, bấm vào nút mũi tên", "Dùng phím Tab"], "-",
      "Cả 3 lần đều mở /courses/<id>; Tab dừng ở tiêu đề thẻ (liên kết thật) và Enter mở được; nút mũi tên không nhận Tab riêng.")
    A("Trang chủ - sáng", "Chế độ danh sách (nút thứ 2): thẻ ảnh trái, nội dung phải, 2 cột; thẻ vẫn bấm được cả khối", "Chức năng", "Trung bình", GUEST,
      ["Bấm nút danh sách ở bộ lọc", "Quan sát và bấm một thẻ"], "-", "Thẻ nằm ngang (ảnh ~38%), 2 cột trên màn rộng; bấm thẻ vào chi tiết.")
    A("Trang chủ - sáng", "Phân trang: nút tròn 42px, trang hiện tại nền cam, mũi tên Trước/Tiếp", "Giao diện", "Trung bình", GUEST + " Có từ 2 trang khóa học trở lên.",
      ["Kéo xuống cuối lưới", "Bấm trang 2, rồi Trước"], "-", "Nút tròn trắng bóng mềm, trang hiện tại cam; bấm đổi trang và tự cuộn về đầu danh sách; ở trang 1 nút Trước mờ/không bấm được.")
    A("Trang chủ - sáng", "Khối 'Vì sao nên chọn SofinHub?' mới: tiêu đề giữa, mô tả, 4 thẻ lợi ích, họa tiết chấm/vầng sáng", "Giao diện", "Cao", GUEST + " Cửa sổ 1800px.",
      ["Cuộn tới khối sau phân trang", "So sánh với Figma 1521:8890"], "-",
      "Tiêu đề 36px ExtraBold, chữ 'SofinHub' cam; mô tả 20px #7b7f95; 4 thẻ trắng bo 28 padding 30: icon trong vòng tròn pastel (cam/tím/xanh dương/xanh lá), tiêu đề 20px bold, mô tả 16px; họa tiết chấm hai bên (ẩn ở màn nhỏ).")
    A("Trang chủ - sáng", "Banner 'Tạo cộng đồng của riêng bạn' (ảnh nền bo 32) + nút 'Tạo cộng đồng ngay →' dẫn tới /communities/new", "Chức năng", "Cao", GUEST,
      ["Cuộn tới banner", "Bấm 'Tạo cộng đồng ngay'"], "-",
      "Banner cao ~348 (co theo màn), nhãn 'Dành cho chuyên gia, creator, doanh nghiệp', tiêu đề 38px, mô tả 2 dòng; nút cam 52px; khách bấm nút được chuyển sang /login (hoặc /communities/new nếu đã đăng nhập).")
    A("Trang chủ - sáng", "Footer: logo + 4 biểu tượng mạng xã hội, 3 thẻ liên hệ (email, điện thoại, địa chỉ), liên kết pháp lý, bản quyền", "Giao diện", "Trung bình", GUEST,
      ["Cuộn xuống cuối trang", "Bấm 'Điều khoản sử dụng', 'Chính sách bảo mật'"], "-",
      "3 thẻ viền xám nhạt bo 16: hello@sofilm.com, 0335 456 789, 216 - 218 Trần Hưng Đạo St., Da Nang; dòng '© 2026 SofinHub …' bên phải; liên kết pháp lý vào /terms, /privacy. Biểu tượng mạng xã hội chỉ hiển thị (chưa có link thật).")
    A("Trang chủ - sáng", "Responsive: 1440 / 1024 / 768 / 390px không tràn ngang, lưới 4→2→1 cột, chữ co theo màn", "Giao diện", "Trung bình", GUEST,
      ["Đổi độ rộng cửa sổ lần lượt 1440, 1024, 768, 390", "Quan sát Header, hero, lưới, Why, CTA, Footer"], "-",
      "Không thanh cuộn ngang; lưới thẻ 4 cột (≥1440) → 2 cột → 1 cột; tiêu đề hero co dần (~46px ở 1440); Header gọn (mobile ẩn nút tạo/tin nhắn, vào menu avatar); Why 4→2→1 cột; Footer thẻ liên hệ xếp dọc.", pw="Một phần")

    # ---- Giao diện tối (khung Figma 1597:4471)
    A("Trang chủ - tối", "Nền #0c1013, Header kính đen mờ viền trắng .1, logo bản chữ trắng, chữ điều hướng trắng", "Giao diện", "Cao", GUEST + " Đang ở giao diện tối.",
      ["Mở /", "So sánh với Figma 1597:4471 (Navigation 1628:8951)"], "-",
      "Header nền đen .3 + viền rgba(255,255,255,.1); 'Khám phá' cam đậm, 2 mục kia trắng; logo 'Sofin' chữ trắng hiển thị rõ (không chữ đen mất trên nền tối); nút tròn xám .3 viền xám.")
    A("Trang chủ - tối", "Hero tối: nhãn #333, tiêu đề trắng + dòng 2 cam, mô tả #bababa, ô tìm kiếm kính tối, vòng tròn số liệu màu .16", "Giao diện", "Cao", GUEST + " Giao diện tối, cửa sổ 1800px.",
      ["Quan sát hero", "Đối chiếu màu với Figma 1597:4501"], "-",
      "Ô tìm kiếm nền rgba(63,63,63,.3) viền rgba(161,161,161,.3), placeholder #a6a19d; số liệu trắng, nhãn #bababa; vòng tròn: cam/tím/xanh dương/xanh lá ở độ mờ .16; ảnh nền hero là bản tối (thành phố đêm).")
    A("Trang chủ - tối", "Thẻ khóa học, chip danh mục, dropdown, công tắc lưới, phân trang đều dùng nền xám mờ .3, chữ trắng/#bababa", "Giao diện", "Cao", GUEST + " Giao diện tối.",
      ["Quan sát lưới khóa học, hàng chip, bộ lọc, phân trang"], "-",
      "Thẻ rgba(63,63,63,.3) bo 28, tiêu đề trắng, mô tả/thống kê #bababa, chip học phí cam giữ nguyên; chip danh mục xám mờ, 'Tất cả' cam; dropdown xám mờ; panel dropdown mở ra nền #1b1f22 đọc rõ; trang hiện tại cam.")
    A("Trang chủ - tối", "Khối 'Vì sao nên chọn' + banner CTA + Footer ở giao diện tối", "Giao diện", "Trung bình", GUEST + " Giao diện tối.",
      ["Cuộn xuống cuối trang"], "-",
      "4 thẻ lợi ích xám mờ, tiêu đề trắng, mô tả #bababa, icon pastel đổi sang màu .16; banner dùng ảnh tối, nhãn viền mờ chữ cam; Footer: thẻ liên hệ viền rgba(224,224,224,.2), chữ trắng.")

    # ---- Áp dụng cho mọi trang khác
    for page, path, note in (
        ("Trang chi tiết khóa học", "/courses/<id>", "tiêu đề, tab, thẻ giá, thống kê"),
        ("Trang cộng đồng - Bảng tin", "/communities/<slug>/community", "sidebar, bài viết, ô soạn bài, thẻ onboarding"),
        ("Lớp học", "/communities/<slug>/community/lop-hoc", "thẻ module, thanh tiến độ, popup thêm/sửa bài học"),
        ("Trang bài học", "/communities/<slug>/community/lop-hoc/<lessonId>", "danh sách bài bên phải, video, tệp đính kèm"),
        ("Thành viên / Xếp hạng / Lịch", "/communities/<slug>/community/thanh-vien", "bảng thành viên, bộ lọc, lịch"),
        ("Cài đặt hồ sơ", "/settings", "6 tab cài đặt, thẻ, ô nhập, nút"),
        ("Cộng đồng của tôi", "/me/communities", "thẻ cộng đồng, tab Đang chờ, nháp"),
        ("Tin nhắn", "/messages", "danh sách hội thoại, khung chat"),
        ("Thông báo", "/notifications", "danh sách thông báo"),
        ("Đăng nhập / Đăng ký", "/login, /register", "form, logo, nền"),
        ("Tạo cộng đồng (wizard)", "/communities/new", "5 bước, thẻ, ô nhập"),
        ("Trang pháp lý / FAQ / Liên hệ", "/terms, /faq, /contact", "bố cục chữ dài, logo"),
        ("Admin Console", "/admin", "sidebar, bảng, dialog xác nhận"),
        ("Tải Tool", "/tools", "thẻ tool, bộ lọc, popup 'Mua ngay'"),
    ):
        A("Áp dụng giao diện tối", f"{page}: giao diện tối đọc rõ, không còn khối nền trắng/chữ đen lạc tông", "Giao diện", "Trung bình", BASE + " Đang ở giao diện tối.",
          [f"Mở {path}", f"Quan sát: {note}", "Mở một menu/popup/dialog nếu có"], "-",
          "Nền tối, chữ trắng/xám sáng đạt độ tương phản; không còn mảng trắng chói hay chữ đen trên nền tối; viền/đường kẻ dùng trắng mờ; popup/dropdown nền #171b1f; chữ trạng thái (đỏ/xanh/cam) sáng hơn để đọc được. Ghi lại màn nào còn lệch.", pw="Một phần")
    A("Áp dụng giao diện tối", "Nút/thẻ cam và overlay giữ chữ trắng ở giao diện tối (không bị đảo thành đen)", "Giao diện", "Cao", BASE + " Giao diện tối.",
      ["Xem các nút cam (Tạo cộng đồng, Tìm kiếm, Đăng bài, Thêm bài học)", "Xem lớp phủ khóa trên module trả phí"], "-", "Chữ vẫn trắng trên nền cam; lớp phủ khóa tối với chữ trắng.", pw="Một phần")
    A("Áp dụng giao diện tối", "Form nhập (input, textarea, select) và placeholder đọc rõ ở giao diện tối", "Giao diện", "Trung bình", BASE + " Giao diện tối.",
      ["Mở /settings tab Hồ sơ", "Nhập vào các ô; xem placeholder và gợi ý tự điền của trình duyệt"], "-", "Chữ nhập màu sáng, placeholder #7d858e, thanh cuộn/ô chọn theo color-scheme tối.", pw="Một phần")
    A("Áp dụng giao diện tối", "Thương hiệu: màu cam toàn app là #ff570a (không còn #f26a1b) và font Plus Jakarta Sans hiển thị đúng dấu tiếng Việt", "Giao diện", "Trung bình", GUEST,
      ["Mở /, /login, /courses/<id>", "Gõ thử 'Khóa Học YouTube AI – Xây Kênh & Kiếm Tiền' trong ô tìm kiếm", "Kiểm tra trên Chrome, Edge, Firefox"], "-",
      "Mọi nút/chữ cam cùng một tông; chữ có đủ dấu (ọ, ế, ề, ố...) cùng một font trên cả 3 trình duyệt, không rơi về font serif.", pw="Một phần")

    # ---- Chi tiết khóa học (Figma 1533:10616; giao diện tối theo token chung)
    A("Chi tiết khóa học", "Bố cục 2 cột: trái (gallery, tiêu đề, 5 ô thông tin, tab, nội dung, đánh giá) + phải 401px (gói thành viên, quyền lợi, hỗ trợ), căn thẳng hàng với Header", "Giao diện", "Cao", GUEST + " Cửa sổ 1800px.",
      ["Mở /courses/<id>", "So sánh với Figma 1533:10616"], "-",
      "Breadcrumb (nhà › danh mục › tên) 14px; khung ảnh lớn bo 24 cao ~600 kèm nhãn 'Mới' (nền #dcffe9) góc trái; dải ảnh nhỏ 188x100 bo 16; tiêu đề 46px ExtraBold; hàng sao + 'Bởi <tên>' 18px; mô tả 20px; cột phải sticky.")
    A("Chi tiết khóa học", "5 ô thông tin (Thành viên, Bài học, Quản trị viên, Công cụ hỗ trợ, Công khai/Riêng tư): thẻ trắng bo 26, icon nền pastel", "Giao diện", "Trung bình", GUEST,
      ["Quan sát hàng ô thông tin dưới mô tả"], "-", "Mỗi ô: icon 24 trong ô 50x50 bo 16 (nền = màu icon độ mờ .16), số 20px bold, nhãn 14px xám; giá trị lấy từ dữ liệu thật.")
    A("Chi tiết khóa học", "Thanh tab: 'Tổng quan' dạng viên gradient cam, các tab khác chữ thường; 'Đánh giá' cuộn tới khối đánh giá", "Chức năng", "Cao", GUEST,
      ["Bấm lần lượt Tổng quan, Nội dung, Đánh giá, Câu hỏi"], "-",
      "Tab đang chọn: viên cam gradient + bóng, chữ trắng đậm; 'Nội dung' hiện thẻ nội dung; 'Đánh giá' cuộn mượt tới khối 'Đánh giá từ học viên' (nằm trong cột trái, sau nội dung); tab 'Câu hỏi' chỉ có khi cộng đồng có FAQ.")
    A("Chi tiết khóa học", "Khối Tổng quan / Bạn nhận được gì?: thẻ trắng bo 25, tiêu đề 22px bold; chỉ hiện khi có dữ liệu thật", "Giao diện", "Trung bình", GUEST,
      ["Mở tab Tổng quan"], "-", "Thẻ 'Tổng quan' hiện mô tả (about); thẻ 'Bạn nhận được gì?' (check xanh) chỉ hiện khi cộng đồng có mục 'gains'; không còn khối 'Chi phí tham gia' lặp lại (giá đã ở thẻ bên phải).")
    A("Chi tiết khóa học", "Khối Đánh giá từ học viên: vạch cam 3px + tiêu đề, điểm 46px, ô viết đánh giá viền #e4e4e4, nút Cập nhật cam / Xóa viền đỏ", "Giao diện", "Trung bình", BASE + " Đã tham gia cộng đồng.",
      ["Mở trang chi tiết cộng đồng đã tham gia", "Chọn sao, nhập nhận xét, bấm gửi/cập nhật", "Bấm xóa đánh giá"], "-", "Form gửi/cập nhật/xóa đánh giá hoạt động như cũ (POST/DELETE reviews); danh sách đánh giá hiển thị tên, sao, ngày; người chưa tham gia thấy thông báo cần tham gia.")
    A("Chi tiết khóa học", "Thẻ gói bên phải: ảnh 200, giá 42px cam + 'đ/tháng', 3 số liệu, nút 'Tham gia ngay' 65px, 4 lợi ích gói thành viên", "Giao diện", "Cao", GUEST + " Cộng đồng có phí.",
      ["Quan sát thẻ bên phải", "Bấm 'Tham gia ngay' khi chưa đăng nhập"], "-",
      "Giá '1.000.000 đ/tháng' (đ gạch chân) hoặc 'Miễn phí'; 3 số liệu cách nhau vạch #f0e4dc; nút cam bo 20 + mũi tên; 4 dòng lợi ích (Truy cập ngay lập tức, Học mọi lúc mọi nơi, Cập nhật nội dung liên tục, Hỗ trợ từ cộng đồng) với icon nền pastel; bấm nút khi chưa đăng nhập chuyển /login.")
    A("Chi tiết khóa học", "Luồng tham gia/rời/chờ duyệt/xin tham gia riêng tư vẫn đúng sau khi đổi giao diện (giữ nguyên logic)", "Chức năng", "Cao", BASE,
      ["Tham gia cộng đồng miễn phí", "Thử với cộng đồng có phí (mở hộp thoại chọn gói)", "Thử cộng đồng riêng tư (gửi yêu cầu, hủy yêu cầu)", "Rời cộng đồng"], "-",
      "Các nút/hộp thoại/toast như trước: vào cộng đồng sau khi tham gia; hộp thoại thanh toán cho cộng đồng có phí; 'Gửi yêu cầu tham gia' và 'Hủy yêu cầu' cho riêng tư; nút 'Rời cộng đồng' đỏ cho thành viên (không phải chủ).")
    A("Chi tiết khóa học", "Thẻ 'Bạn sẽ nhận được' (check cam) và 'Cần hỗ trợ?' (nút viền cam dẫn /contact)", "Giao diện", "Thấp", GUEST,
      ["Quan sát 2 thẻ cuối cột phải", "Bấm 'Gửi tin nhắn'"], "-", "Check tròn cam 33px; thẻ hỗ trợ có icon tai nghe, tiêu đề 22px, nút viền cam 48px; bấm nút mở /contact.")
    A("Chi tiết khóa học", "Giao diện tối của trang chi tiết: thẻ xám mờ, chữ trắng/#bababa, không còn mảng trắng", "Giao diện", "Trung bình", GUEST + " Giao diện tối.",
      ["Mở /courses/<id> ở giao diện tối"], "-", "Nền #0c1013 + dải gradient cam-nâu mờ ở đầu trang; thẻ rgba(63,63,63,.3); tiêu đề trắng; mô tả/nhãn #bababa; nút cam giữ nguyên; popup tham gia đọc rõ.", pw="Một phần")

    # ---- Cộng đồng của tôi khi chưa đăng nhập (Figma 1521:10246 sáng, 1693:741 tối)
    A("Cộng đồng của tôi (khách)", "Chưa đăng nhập vào /me/communities: hình minh họa, tiêu đề 'Cộng đồng của bạn ở đây', mô tả, 2 nút, dòng đăng ký", "Giao diện", "Cao", GUEST,
      ["Mở /me/communities", "So sánh với Figma 1521:10246"], "-",
      "Hình minh họa 482x290; tiêu đề ~44px ExtraBold, 'của bạn' màu cam; mô tả 16px/26px màu #696460; nút 'Đăng nhập' cam 47px + 'Khám phá cộng đồng' trắng viền #eee1d9; dòng 'Chưa có tài khoản? Đăng ký miễn phí →' 13px; dải gradient cam nhạt ở đầu trang; Footer 3 thẻ liên hệ.")
    A("Cộng đồng của tôi (khách)", "Nút 'Đăng nhập' về /login (nhớ trang), 'Khám phá cộng đồng' về /, 'Đăng ký miễn phí' về /register", "Chức năng", "Cao", GUEST,
      ["Bấm lần lượt từng nút/liên kết"], "-", "Đăng nhập xong quay lại /me/communities; Khám phá mở trang chủ; Đăng ký mở /register.")
    A("Cộng đồng của tôi (khách)", "Giao diện tối của trang khách: nền #0c1013 + dải swoosh cam-nâu, nút phụ xám sáng .16, chữ trắng/#bababa", "Giao diện", "Trung bình", GUEST + " Giao diện tối.",
      ["Mở /me/communities ở giao diện tối", "So sánh với Figma 1693:741"], "-", "Hình minh họa bản tối; tiêu đề trắng + 'của bạn' cam; mô tả #bababa; nút 'Khám phá cộng đồng' nền rgba(232,232,232,.16) chữ #e8e8e8; Footer thẻ viền mờ.", pw="Một phần")
    A("Cộng đồng của tôi (khách)", "Đã đăng nhập nhưng chưa tham gia cộng đồng nào: cùng bố cục, tiêu đề 'Bạn chưa tham gia cộng đồng nào' + nút 'Khám phá cộng đồng'", "Chức năng", "Trung bình", BASE + " Tài khoản chưa tham gia cộng đồng nào (vd. newbie@sofinhub.test).",
      ["Đăng nhập, mở /me/communities"], "-", "Hiện trạng thái rỗng cùng kiểu với trang khách, có 1 nút cam dẫn về /; có Footer.")

    # ---- Đăng nhập tối (Figma 1628:9422)
    A("Đăng nhập tối", "Trang /login ở giao diện tối dùng ảnh nền riêng (nhóm bạn học bên trái, tối bên phải) và thẻ đăng nhập kính tối", "Giao diện", "Cao", GUEST + " Giao diện tối.",
      ["Mở /login", "So sánh nền với Figma 1628:9422"], "-",
      "Nền là ảnh 'Học tập cộng tác trong không gian số' (bản tối); thẻ đăng nhập nền đen .4 viền trắng .1, chữ trắng, ô nhập đọc rõ; logo bản chữ trắng; nút cam; bản sáng giữ ảnh nền cũ.")
    A("Đăng nhập tối", "Form đăng nhập/2FA hoạt động bình thường ở giao diện tối (không đổi logic); /register dùng cùng nền", "Chức năng", "Cao", GUEST + " Giao diện tối.",
      ["Đăng nhập đúng/sai mật khẩu", "Mở /register và quên mật khẩu /forgot-password"], "-", "Thông báo lỗi đỏ đọc rõ; chuyển trang đúng; /register có nền tối giống /login; /forgot-password dùng nền trang tối (không còn gradient kem).", pw="Một phần")

    # ---- Trang cộng đồng (Bảng tin) giao diện tối (Figma 1620:6882)
    A("Cộng đồng - giao diện tối", "Bảng tin cộng đồng ở giao diện tối: sidebar, ô soạn bài, thẻ 'Bắt đầu hành trình', chip chủ đề, bài viết, cột phải", "Giao diện", "Cao", BASE + " Đang ở giao diện tối, tài khoản đã tham gia cộng đồng.",
      ["Mở /communities/<slug>/community", "So sánh với Figma 1620:6882"], "-",
      "Mọi thẻ nền rgba(63,63,63,.3) bo 21-29 với quầng sáng trắng .08; mục sidebar đang chọn nền trắng .1 + chữ cam; ô soạn bài viền trắng .1, nút 'Đăng bài' cam; thẻ 'Bắt đầu hành trình' gradient xám->nâu + vòng tiến độ; chip chủ đề trắng .1 ('Tất cả' cam); nút Thích/Bình luận/Chia sẻ nền trắng .1; cột phải: thông tin, đề xuất (nút '+ Tham gia' cam .16), Premium.", pw="Một phần")
    A("Cộng đồng - giao diện tối", "Các trang con của cộng đồng (Lớp học, Lịch, Thành viên, Xếp hạng, Giới thiệu, Kiểm duyệt, Doanh thu, Cài đặt) đọc rõ ở giao diện tối", "Giao diện", "Trung bình", BASE + " Giao diện tối, tài khoản chủ cộng đồng.",
      ["Lần lượt mở từng mục ở sidebar"], "-", "Không còn nền trắng/chữ đen lạc tông; popup thêm/sửa bài học, module, sự kiện, hộp xác nhận có nền tối đọc rõ; bảng/hàng danh sách có viền trắng mờ.", pw="Một phần")
    A("Cộng đồng - giao diện tối", "Sidebar cộng đồng không còn thẻ quảng cáo 'Xây dựng cộng đồng của riêng bạn' (khác Figma, theo yêu cầu bỏ ngày 16/10)", "Giao diện", "Thấp", BASE,
      ["Mở trang cộng đồng ở cả hai giao diện"], "-", "Sidebar chỉ có tên cộng đồng + menu; Figma khung tối có thẻ này nhưng đã quyết định bỏ.")

    # ======================================================================= UPD16
    M, MN = "UPD16", "Cập nhật 16/10/2026"

    def B(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    OWNER = "Đăng nhập chủ cộng đồng hoặc quản trị viên (mod trở lên) của một cộng đồng có Lớp học."
    B("Lớp học", "Sidebar cộng đồng không còn khối quảng cáo 'Xây dựng cộng đồng riêng của bạn'", "Giao diện", "Trung bình", OWNER,
      ["Mở trang bất kỳ trong cộng đồng (Bảng tin, Lớp học...)", "Quan sát cuối sidebar bên trái"], "-", "Sidebar chỉ còn tên cộng đồng + menu điều hướng; không có thẻ quảng cáo, không có nút 'Bắt đầu'.")
    B("Lớp học", "Thẻ module có nút xóa (thùng rác) cạnh nút 'Sửa' với mod trở lên; người học thường không thấy", "Chức năng", "Cao", OWNER,
      ["Mở Lớp học", "Quan sát góc phải trên mỗi thẻ module", "Đăng nhập thành viên thường và xem lại"], "-",
      "Mod+: có nút 'Sửa' và icon thùng rác (hover đỏ). Thành viên thường: không có cả hai nút.")
    B("Lớp học", "Xóa module: hộp xác nhận nêu tên + số bài học; xác nhận xóa module cùng các bài bên trong", "Chức năng", "Cao", OWNER + " Có module test chứa 1 bài.",
      ["Bấm thùng rác ở một module", "Đọc hộp thoại", "Bấm 'Hủy', rồi bấm lại và xác nhận xóa"], "-",
      "Hộp thoại ghi tên module và số bài sẽ bị xóa; Hủy không đổi gì; xác nhận: toast đã xóa, thẻ biến mất, số 'Module/Bài học' ở đầu trang giảm, tiến độ khóa tính lại; gọi DELETE /api/communities/<id>/courses/<courseId>/modules/<moduleId> trả 200.")
    B("Lớp học", "Xóa module lỗi (mạng/quyền): hộp thoại hiện lỗi, module còn nguyên", "Chức năng", "Trung bình", OWNER,
      ["Tắt backend hoặc dùng token hết hạn", "Bấm xóa module và xác nhận"], "-", "Hộp thoại hiển thị thông báo lỗi, không đóng; sau khi sửa lỗi bấm lại xóa được.", pw="Một phần")
    B("Trang bài học", "Danh sách bài bên phải có nút '+' (thêm bài) cạnh tiêu đề module, và icon sửa/xóa mỗi bài — chỉ mod trở lên", "Chức năng", "Cao", OWNER,
      ["Mở một bài học", "Quan sát khung bên phải", "Xem lại bằng thành viên thường"], "-",
      "Mod+: nút '+' ở đầu khung, mỗi bài có icon bút và thùng rác; thành viên thường chỉ thấy danh sách + vòng tròn hoàn thành.")
    B("Trang bài học", "Thêm bài học nhỏ ngay trong trang bài học (nút '+')", "Chức năng", "Cao", OWNER,
      ["Bấm '+' ở khung bên phải", "Nhập tên bài (>=1 ký tự), chọn loại, nhập thời lượng", "Bấm 'Thêm bài học'"], "Tên: 'Bài mới 16/10'",
      "Mở form 'Thêm bài học' đúng module hiện tại; lưu xong popup đóng, toast 'đã tạo', bài mới xuất hiện cuối danh sách bên phải ngay (không tải lại).")
    B("Trang bài học", "Sửa bài học ngay trong trang bài học (icon bút)", "Chức năng", "Cao", OWNER,
      ["Bấm icon bút ở một bài", "Đổi tên, lưu"], "Tên: 'Tên đã sửa'", "Form điền sẵn dữ liệu bài; lưu xong tiêu đề ở danh sách bên phải và (nếu là bài đang xem) tiêu đề chính cập nhật.")
    B("Trang bài học", "Xóa bài học khác bài đang xem: hộp xác nhận, xóa xong ở lại trang hiện tại", "Chức năng", "Cao", OWNER,
      ["Bấm thùng rác ở bài KHÁC bài đang xem", "Xác nhận"], "-", "Bài biến mất khỏi danh sách; trang bài đang xem giữ nguyên; tổng số bài trong tiến độ giảm 1.")
    B("Trang bài học", "Xóa đúng bài đang xem: tự chuyển sang bài kế tiếp (hoặc bài trước), hết bài thì về Lớp học", "Chức năng", "Cao", OWNER + " Module có ≥2 bài.",
      ["Mở bài ở giữa", "Bấm thùng rác ở chính bài đó và xác nhận", "Lặp lại cho tới khi hết bài của module"], "-",
      "Chuyển (replace, không để lại URL cũ trong lịch sử) sang bài kế tiếp; nếu là bài cuối thì sang bài trước; xóa bài cuối cùng của module thì về trang Lớp học.")
    B("Thẻ khóa học", "Thẻ khóa học ở /courses bấm cả thẻ mở chi tiết; không còn nút mũi tên riêng", "Chức năng", "Cao", GUEST,
      ["Bấm vào ảnh, tiêu đề, mô tả của thẻ"], "-", "Luôn mở /courses/<id>. (Từ bản Figma mới, nút mũi tên tròn chỉ còn là hình trang trí, xem THEME.)")
    B("Trang chi tiết", "Ô thông tin thứ 4 của khóa học là 'Công cụ hỗ trợ' kèm số tool (icon cờ lê) thay cho 'Chi phí tham gia'", "Chức năng", "Trung bình", GUEST,
      ["Mở /courses/<id>", "Xem hàng 5 ô thông tin dưới mô tả"], "-",
      "Các ô: Thành viên, Bài học, Quản trị viên, Công cụ hỗ trợ (số = số tool trả về từ GET /api/tools, '–' khi đang tải), Công khai/Riêng tư. Chi phí tham gia vẫn xem được ở thẻ giá bên phải.")
    B("Hiệu năng", "Mở 4-5 tab cùng lúc: chỉ có 2 kết nối SSE (tin nhắn + thông báo) cho cả trình duyệt", "Chức năng", "Cao", BASE + " Server chạy HTTP/2 hoặc HTTP/1.1.",
      ["Đăng nhập, mở 5 tab cùng domain", "Ở DevTools > Network lọc 'stream' cho từng tab"], "-",
      "Chỉ một tab (leader) giữ 2 kết nối /messages/stream và /notifications/stream; các tab còn lại không mở kết nối; các request API khác không còn pending/canceled.", pw="Một phần")
    B("Hiệu năng", "Thông báo/tin nhắn mới vẫn tới mọi tab dù chỉ một tab giữ SSE; đóng tab leader thì tab khác tiếp quản", "Chức năng", "Cao", BASE + " 2 tab đăng nhập cùng tài khoản + tài khoản thứ hai để gửi tin.",
      ["Từ tài khoản khác gửi tin nhắn", "Quan sát cả 2 tab", "Đóng tab đang giữ SSE", "Gửi thêm tin nhắn"], "-",
      "Cả 2 tab đều cập nhật badge/danh sách; sau khi đóng tab leader, tab còn lại tự mở SSE (vài giây) và vẫn nhận tin, tự tải lại để bù tin bị lỡ.", pw="Không")
    B("Hiệu năng", "Server bật HTTP/2 (nginx 'http2 on;'), curl -I trả HTTP/2", "Chức năng", "Trung bình", "Quyền truy cập server hoặc dùng curl từ máy ngoài.",
      ["curl -sI --http2 https://<host>/health", "Xem DevTools > Network > cột Protocol"], "-", "Protocol 'h2'; các request cùng domain dùng chung một kết nối.", pw="Không")
    B("Upload", "Upload video/slide lớn qua backend lên S3: không treo ở % giữa chừng khi mạng chậm (hứng đĩa tạm rồi mới đẩy S3)", "Chức năng", "Cao", OWNER + " Server dùng S3 (S3_BUCKET). Có file video ~100MB.",
      ["Thêm bài học > tab Video > tải video từ máy", "Giới hạn mạng 'Slow 4G' ở DevTools", "Quan sát tiến độ tới 100%"], "video ~100MB",
      "Thanh tiến độ chạy tới 100% rồi form trả URL; request PUT /api/uploads/<key> kết thúc 200 (không pending vô hạn); lỗi giữa chừng (ngắt mạng) trả lỗi rõ ràng, không để lại file dở trên S3.", pw="Không")
    B("Upload", "Hủy upload giữa chừng: không tạo object dở dang trên S3, dung lượng tạm trên server được dọn", "Chức năng", "Trung bình", OWNER,
      ["Bắt đầu upload video lớn", "Bấm 'Hủy' khi ~30%"], "-", "Request bị hủy; trên S3 không có object mới của key đó; thư mục tạm của server không còn file upload-*.part.", pw="Không")
    B("Thông báo", "Dropdown thông báo ở trang chủ hiển thị đủ, không bị cắt ở mép dưới khối hero", "Giao diện", "Trung bình", BASE + " Có ≥ 8 thông báo.",
      ["Mở /", "Bấm chuông thông báo", "Cuộn danh sách trong dropdown"], "-", "Dropdown cao tối đa 70% màn hình, hiện đầy đủ, cuộn được; không bị cắt cụt ở ranh giới hero.")
    B("Thông báo", "Cảnh báo tiền chuyển khoản (vượt trần, chuyển trùng, phiên hết hạn, chưa cấp được) chỉ gửi MỘT lần cho mỗi giao dịch", "Chức năng", "Cao", "Có SePay token hoặc dùng test bank-transfer; admin/nhân viên có quyền payment.view đăng nhập.",
      ["Tạo giao dịch vượt trần (hoặc chuyển trùng)", "Chờ vòng quét đối soát chạy ≥ 3 lần (mỗi phút)", "Xem chuông thông báo + log backend"], "-",
      "Chuông của admin chỉ có 1 thông báo 'Cần xử lý tiền chuyển khoản' cho giao dịch đó; log [ALERT][payments] không lặp mỗi phút. Giao dịch mới khác vẫn báo bình thường. (Test tự động: backend/tests/bank-transfer.test.ts)")
    B("Thông báo", "Thông báo tiền gửi cho Super Admin + nhân viên có quyền payment.view/manage (theo thiết kế), không gửi cho user thường", "Chức năng", "Trung bình", "Có 1 Super Admin, 1 nhân viên Finance, 1 user thường.",
      ["Sinh một cảnh báo tiền", "Xem chuông của 3 tài khoản"], "-", "Super Admin và nhân viên Finance nhận thông báo giống nhau; user thường không nhận.", pw="Một phần")
    B("Chatbot", "Widget chatbot 'Tào' chỉ hiện khi Admin bật VÀ đã đăng nhập ChatGPT (Codex) hoặc dev bật CHATBOT_FAKE_MODEL=1", "Chức năng", "Trung bình", "Quyền Super Admin.",
      ["Chưa đăng nhập ChatGPT: mở / khi đã đăng nhập", "Admin > Hỗ trợ > Chatbot > Cài đặt > đăng nhập ChatGPT theo hướng dẫn", "Tải lại trang người dùng"], "-",
      "Chưa đăng nhập ChatGPT: không có nút chat (GET /api/chatbot/status trả available=false); sau khi đăng nhập + bật: nút chat tròn cam ở góc phải dưới. Trang cộng đồng có bot riêng thì Tào ẩn.", pw="Không")

    # ======================================================================= MOB
    M, MN = "MOB", "Giao diện mobile (Figma Sofin-HUB)"

    def Mo(feature, title, ttype, prio, pre, steps, data, exp, pw="Một phần", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    MB = "Chrome DevTools > chế độ thiết bị 390x844 (iPhone 14) hoặc điện thoại thật; Frontend :5173 + backend :4000 chạy."
    Mo("Khung mobile", "< 768px: Header desktop ẩn, hiện thanh trên: nút menu trái, logo giữa (hoặc tiêu đề trang), nút tìm kiếm + chuông phải", "Giao diện", "Cao", MB,
      ["Mở /", "Mở /me/communities", "Mở một trang trong cộng đồng (vd. Lớp học)"], "-",
      "Thanh cao 60px nền trong suốt; 3 nút tròn 36px nền xám .2; trang chủ/chi tiết/Cộng đồng của tôi hiện logo; trang trong cộng đồng hiện tiêu đề (Cộng đồng, Lớp học, Lịch sự kiện, Thành viên, Giới thiệu, Giới thiệu hoa hồng...); chuông có số chưa đọc (chấm cam 16px) dẫn /notifications; khách thấy icon người dẫn /login.")
    Mo("Khung mobile", "Từ 768px trở lên: giao diện desktop giữ nguyên, không có thanh trên/thanh tab mobile", "Giao diện", "Cao", "Cửa sổ rộng ≥ 768px.",
      ["Mở /, /courses/<id>, trang cộng đồng"], "-", "Chỉ có Header dạng viên và sidebar như cũ; không thấy thanh tab dưới.", pw="Có")
    Mo("Khung mobile", "Ngăn kéo menu: mở bằng nút menu, đóng bằng nền mờ / nút X / Esc / đổi trang; khóa cuộn nền khi mở", "Chức năng", "Cao", MB + " Đã đăng nhập.",
      ["Bấm nút menu trái", "Bấm vùng mờ bên ngoài", "Mở lại, bấm một mục", "Mở lại, bấm nút X"], "-",
      "Ngăn kéo trượt từ trái rộng ≤ 320px; có khối người dùng (avatar, tên, email -> /settings), điều hướng chung (Khám phá, Khóa học, Cộng đồng của tôi, Tạo cộng đồng, Cài đặt hồ sơ, Quản trị nếu là admin), đổi giao diện sáng/tối, đổi ngôn ngữ, Đăng xuất, liên kết Điều khoản/Bảo mật/FAQ; đóng được bằng cả 4 cách; trang nền không cuộn khi ngăn kéo mở.")
    Mo("Khung mobile", "Trong một cộng đồng, ngăn kéo có thêm menu cộng đồng (Cộng đồng, Lớp học, Lịch sự kiện, Thành viên, Xếp hạng, Giới thiệu, ...) theo quyền", "Chức năng", "Cao", MB + " Đã tham gia một cộng đồng; thử thêm bằng tài khoản mod/chủ.",
      ["Vào trang cộng đồng", "Mở ngăn kéo", "Bấm 'Lớp học'"], "-", "Hiện tên cộng đồng + danh sách mục như sidebar desktop (mod+: Kiểm duyệt; chủ: Doanh thu; admin+: Cài đặt); bấm mục chuyển trang đúng và đóng ngăn kéo; mục đang ở được tô cam.")
    Mo("Khung mobile", "Thanh tab dưới cố định: Trang chủ · Cộng đồng · Chat · Cá nhân; tab đang ở có quầng cam + chữ trắng", "Giao diện", "Cao", MB,
      ["Lần lượt bấm 4 tab", "Quan sát tab đang chọn khi ở /, /me/communities, trang trong cộng đồng, /messages, /settings"], "-",
      "Thanh kính tối bo 20 cao 70, 4 tab 60px; tab đúng trang có quầng cam mờ; Chat có chấm số tin chưa đọc; 'Cá nhân' dẫn /settings (khách: /login); nội dung trang không bị che (có khoảng trống cuối trang).")
    Mo("Khung mobile", "Thanh tab ẩn ở trang đăng nhập/đăng ký/quên mật khẩu, admin, tạo cộng đồng, thanh toán, khung chat đang mở", "Giao diện", "Trung bình", MB,
      ["Mở /login, /register, /communities/new, /messages/<id>, /admin"], "-", "Không có thanh tab ở các trang này; các trang khác có.")
    Mo("Khung mobile", "Nút chatbot nổi nằm trên thanh tab (không bị che) ở mobile", "Giao diện", "Thấp", MB + " Chatbot đã bật.",
      ["Mở trang chủ khi đã đăng nhập"], "-", "Nút chat tròn cam cách đáy ~100px, không chồng lên thanh tab; desktop vẫn ở góc dưới phải như cũ.")
    Mo("Trang chủ mobile", "Hero gọn: nhãn nền tảng, tiêu đề 26px 2 dòng căn giữa, mô tả 14px, ô tìm kiếm bo tròn + nút 'Tìm kiếm →'; ẩn ảnh hero và 4 số liệu", "Giao diện", "Cao", MB,
      ["Mở /", "So sánh với Figma khung Home (1:189)"], "-", "Nền gradient cam nhạt đầu trang (dải nền chung); nhãn nền xám .1; tìm kiếm nền trắng .6 viền #cfcfcf, nút cam cao 38; không có hàng số liệu; tìm kiếm vẫn lọc danh sách.")
    Mo("Trang chủ mobile", "Chip danh mục nhỏ (14px) cuộn ngang + nút tròn bộ lọc; bấm nút mở/ đóng hàng Giá/Loại/Trạng thái/Ngôn ngữ/Sắp xếp", "Chức năng", "Cao", MB,
      ["Bấm một chip danh mục", "Bấm nút tròn bộ lọc ở cuối hàng", "Chọn một bộ lọc"], "-", "Chip nền xám .1, đang chọn nền cam; nút bộ lọc tô cam khi đang mở; hàng bộ lọc ẩn mặc định, hiện khi bấm; lọc đúng như desktop.")
    Mo("Trang chủ mobile", "Thẻ khóa học 1 cột: ảnh cao 192, tiêu đề 20px, mô tả 14px, chip học phí + thống kê cùng một hàng; bấm cả thẻ vào chi tiết", "Giao diện", "Cao", MB,
      ["Cuộn danh sách thẻ", "Bấm vào thẻ"], "-", "Thẻ bo 20 padding 8; chip học phí nền #ffeae1 bên trái, thành viên + sao bên phải; mở /courses/<id>.")
    Mo("Trang chủ mobile", "Mobile kết thúc ở danh sách + phân trang: ẩn khối 'Vì sao nên chọn', banner CTA và Footer", "Giao diện", "Trung bình", MB,
      ["Cuộn xuống cuối trang chủ"], "-", "Không có 3 khối trên (desktop vẫn có); liên kết Điều khoản/Bảo mật nằm trong ngăn kéo menu.")
    Mo("Chi tiết mobile", "Chi tiết khóa học: nút 'Tham gia ngay' (48px) nằm ngay dưới mô tả; ẩn thẻ gói + 'Bạn sẽ nhận được' bên phải; vẫn còn 'Cần hỗ trợ?'", "Giao diện", "Cao", MB,
      ["Mở /communities/<id>", "Bấm 'Tham gia ngay' (khách / chưa tham gia)"], "-", "Luồng tham gia/chờ duyệt/riêng tư/thanh toán hoạt động như desktop; thành viên đã tham gia thấy nút 'Vào cộng đồng' + 'Rời cộng đồng'.")
    Mo("Cộng đồng của tôi mobile", "Khách: nút Đăng nhập + Khám phá cộng đồng full-width xếp dọc; đã đăng nhập: nút 'Tạo cộng đồng' to ở đầu danh sách, không có Footer", "Giao diện", "Trung bình", MB,
      ["Mở /me/communities khi chưa đăng nhập", "Đăng nhập và mở lại"], "-", "Khách: hình minh họa, tiêu đề, 2 nút rộng hết khung, dòng đăng ký; có tài khoản: nút cam 'Tạo cộng đồng' + danh sách thẻ 1 cột.")
    Mo("Chế độ tối mobile", "Khung mobile ở giao diện tối: thanh trên, ngăn kéo, thanh tab, chip, thẻ đọc rõ", "Giao diện", "Trung bình", MB + " Giao diện tối.",
      ["Mở /, trang cộng đồng, ngăn kéo menu"], "-", "Ngăn kéo nền #14181c chữ trắng; nút tròn trên cùng chữ trắng; chip xám mờ; thẻ rgba(63,63,63,.3).")

    # ---- Bổ sung đợt 2 (màn trong cộng đồng + popup + sửa giao diện tối)
    Mo("Cộng đồng mobile", "Bảng tin: ô soạn bài gọn (thanh công cụ cuộn ngang, nút đăng chỉ còn icon), chip chủ đề cuộn ngang 1 hàng, bài viết chữ trái + ảnh thu nhỏ phải, ẩn cột phải", "Giao diện", "Cao", MB + " Đã tham gia một cộng đồng có bài viết kèm ảnh.",
      ["Mở /communities/<slug>/community", "Cuộn chip chủ đề", "Xem một bài có ảnh", "Bấm Thích / Bình luận / Chia sẻ / menu '...'"], "-",
      "Không còn cột thông tin/đề xuất/Premium bên phải; chip 1 hàng cuộn được; ảnh bài viết ~125x80 bên phải nội dung (desktop vẫn ảnh dưới chữ); các nút tương tác và menu hoạt động như cũ; đăng bài mới vẫn được.")
    Mo("Cộng đồng mobile", "Lịch sự kiện: mô tả căn giữa, nút 'Tạo sự kiện' full-width trên cùng, bộ chuyển Tháng/Tuần/Ngày full-width, lưới lịch gọn (ô thấp, nhãn sự kiện nhỏ)", "Giao diện", "Trung bình", MB,
      ["Mở /communities/<slug>/community/lich", "Chuyển Tháng/Tuần/Ngày", "Bấm một sự kiện", "Bấm 'Tạo sự kiện' (mod+)"], "-", "Lịch vừa 390px không tràn ngang; hôm nay là chấm tròn cam; tạo/xem sự kiện hoạt động như desktop; có dòng mô tả 'Quản lý và tham gia các sự kiện trong cộng đồng'.")
    Mo("Cộng đồng mobile", "Thành viên: chip lọc bo tròn, ô tìm kiếm full-width, dòng thành viên gọn (avatar, tên, @handle, nút chat/menu); ẩn thẻ thông tin cộng đồng", "Giao diện", "Trung bình", MB,
      ["Mở /communities/<slug>/community/thanh-vien", "Lọc 'Đang trực tuyến', tìm tên, bấm nút chat"], "-", "Các cột trạng thái/ngày tham gia ẩn trên mobile; tìm kiếm + lọc + chat 1-1 hoạt động; không có thẻ thông tin bên dưới.")
    Mo("Cộng đồng mobile", "Giới thiệu: thẻ mô tả nền trắng gọn, ẩn thẻ thông tin bên phải; Lớp học: mô tả căn giữa, nút 'Thêm bài học' full-width, nút Sửa chỉ icon, ẩn 3 số liệu", "Giao diện", "Trung bình", MB + " Tài khoản mod+.",
      ["Mở trang Giới thiệu và Lớp học"], "-", "Layout 1 cột gọn như Figma; thêm/sửa/xóa module và bài học vẫn hoạt động (nút icon có tooltip).")
    Mo("Chi tiết mobile", "Khối 'Cần hỗ trợ?' nằm TRƯỚC khối 'Đánh giá từ học viên' ở mobile (desktop vẫn cuối cột phải)", "Giao diện", "Thấp", MB,
      ["Mở /communities/<id>, cuộn tới cuối"], "-", "Thứ tự: Tổng quan -> Bạn nhận được gì? -> Cần hỗ trợ? -> Đánh giá; nút 'Gửi tin nhắn' mở /contact.")
    Mo("Popup mobile", "Popup 'Tạo cộng đồng của riêng bạn' hiện 1 lần/phiên, sau ~1 giây, chỉ trên mobile ở trang chủ cho khách hoặc người chưa tham gia cộng đồng nào", "Chức năng", "Cao", MB + " Xóa sessionStorage hoặc mở cửa sổ ẩn danh mới.",
      ["Mở / ở 390px khi chưa đăng nhập", "Đóng popup rồi tải lại trang", "Đăng nhập tài khoản đã có cộng đồng", "Mở ở desktop"], "-",
      "Lần đầu: popup có logo, nhãn, tiêu đề 26px, mô tả, hình minh họa, nút 'Tạo cộng đồng ngay →' (dẫn /communities/new), dòng 'Có thể tạo miễn phí · Chỉ mất 1 phút'; đóng bằng X/nền mờ/Esc; tải lại cùng phiên không hiện lại; tài khoản đã có cộng đồng và desktop không hiện.")
    Mo("Chế độ tối", "Hover dòng thông báo/menu ở giao diện tối không còn chói trắng (nền cam mờ, chữ đọc rõ); banner 'Nhận X% mỗi tháng' ở Giới thiệu & hoa hồng đúng nền tối", "Giao diện", "Trung bình", "Giao diện tối, desktop.",
      ["Mở chuông thông báo, rê chuột qua từng dòng", "Mở Cộng đồng > Giới thiệu & hoa hồng"], "-", "Dòng hover nền cam mờ; banner nền xám->nâu mờ, tiêu đề trắng + số % cam, ô link nền tối.")
    Mo("Hạ tầng dev", "Backend local không chạy gây 502 mọi API qua proxy Vite: khởi động lại backend :4000 thì hết lỗi", "Chức năng", "Thấp", "Máy dev; backend đã dừng.",
      ["Mở http://localhost:5173 khi backend tắt (thấy 502)", "Chạy npm run dev (hoặc npm --prefix backend run dev)"], "-", "API trả dữ liệu lại bình thường; /health trả 200.", pw="Không")
    Mo("Hạ tầng upload", "Phát/tua video hoặc ảnh rồi ngắt giữa chừng không làm rò socket S3: sau đó upload/complete vẫn chạy bình thường", "Chức năng", "Cao", "Môi trường dùng S3 (production/staging), tài khoản mod+ của cộng đồng có bài học video.",
      ["Mở bài học có video, tua qua lại / đóng tab giữa lúc đang tải khoảng 50 lần (có thể lặp bằng script Range request rồi hủy)", "Vào 'Thêm bài học' và tải lên 1 video > 32MB", "Quan sát request presign và complete"], "Video > 32MB (multipart)",
      "Presign trả 201 trong vài giây, upload chạy đến 100%, complete trả 200; log backend KHÔNG có cảnh báo 'socket usage at capacity=50 ... requests are enqueued'; không cần khởi động lại backend.", pw="Một phần")
