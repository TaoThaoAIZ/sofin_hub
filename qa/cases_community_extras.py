# -*- coding: utf-8 -*-
"""Module CXT - Bổ sung 10/2026: Đăng nhập/đăng ký (đồng ý điều khoản, Google, email công ty), Công cụ hỗ trợ trong cộng đồng,
Trắc nghiệm theo bài học, Giới thiệu theo cộng đồng (chủ đặt %), thẻ onboarding 'Bắt đầu hành trình của bạn'.

Bám: frontend/src/pages/{LoginPage,RegisterPage}.tsx, features/auth/SocialButtons.tsx, features/community/components/{OnboardingCard,QuizPanel,QuizEditor,CommunityReferralTab}.tsx,
backend/src/modules/{quiz,referrals/community-referral.*,onboarding}; test backend/tests/{lesson-quiz,community-referral,community-onboarding}.test.ts.
Tiền VND nguyên. Hoa hồng giới thiệu cộng đồng trừ vào phần creator nhận (nền tảng vẫn giữ phí 10%).
Thêm case mới = thêm CUỐI file (giữ mã TC-CXT-nnn)."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

ENV = "Môi trường: backend + frontend chạy, đã chạy migration mới nhất (npm run db:deploy). Mật khẩu chung Passw0rd!x."
GOOGLE = "Google cần cấu hình backend/.env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_REDIRECT_BASE và redirect URI <OAUTH_REDIRECT_BASE>/api/auth/oauth/google/callback trong Google Cloud Console."


def load(add):
    M, MN = "CXT", "Bổ sung: đăng nhập, công cụ, trắc nghiệm, giới thiệu CĐ, onboarding"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ---------------------------------------------------------------- Đăng nhập / đăng ký
    A("Đăng nhập & đăng ký", "Ô đồng ý điều khoản tick được ngay, không cần mở từng trang đọc", "Chức năng", "Cao", ENV,
      ["Mở /register", "Quan sát ô 'Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật'", "Tick vào ô (không bấm link nào)"], "-",
      "Ô KHÔNG bị mờ/khóa và không có dòng nhắc 'mở và đọc hết hai trang'; tick được ngay; nút 'Tạo tài khoản' bật. Link 'Điều khoản sử dụng' và 'Chính sách bảo mật' vẫn mở được (dấu ✓ chỉ hiện nếu đã đọc).")
    A("Đăng nhập & đăng ký", "Không tick điều khoản thì không đăng ký được", "Chức năng", "Cao", ENV,
      ["Mở /register, điền đủ thông tin hợp lệ", "Để trống ô đồng ý rồi cố bấm 'Tạo tài khoản'"], "-",
      "Nút bị khóa; nếu gửi form ép thì hiện lỗi 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách bảo mật để đăng ký'.")
    A("Đăng nhập & đăng ký", "Nút Google hiện ở /login và /register (Facebook vẫn ẩn)", "Chức năng", "Cao", ENV,
      ["Mở /login rồi /register", "Quan sát dưới dòng 'hoặc đăng nhập/đăng ký với'"], "-",
      "Có đúng 1 nút 'Google' (rộng toàn hàng), KHÔNG có nút Facebook (trừ khi build với VITE_FACEBOOK_LOGIN=1); tắt hẳn bằng VITE_SOCIAL_LOGIN=0.")
    A("Đăng nhập & đăng ký", "Đăng ký/đăng nhập bằng Google thành công", "Chức năng", "Cao", ENV + " " + GOOGLE,
      ["Mở /register, bấm 'Google'", "Chọn tài khoản Google chưa có trong hệ thống", "Quay lại /oauth/callback", "Đăng xuất rồi đăng nhập lại bằng Google"], "tài khoản Google thật",
      "Tạo tài khoản mới (email đã xác thực), vào được app; lần sau đăng nhập lại cùng tài khoản. Đăng ký qua link giới thiệu thì mã được ghi nhận. Backend thiếu khoá Google => /oauth/callback báo lỗi 'chưa cấu hình' (không treo).", pw="Một phần")
    A("Đăng nhập & đăng ký", "Hiện email công ty Contact@sofin.ai ở trang đăng nhập và đăng ký", "Chức năng", "Trung bình", ENV,
      ["Mở /login", "Mở /register", "Bấm vào email"], "-",
      "Cuối form có dòng 'Liên hệ công ty: Contact@sofin.ai' (EN: 'Contact us:'); bấm mở trình soạn thư tới Contact@sofin.ai.")

    # ---------------------------------------------------------------- Công cụ hỗ trợ
    A("Công cụ hỗ trợ", "Menu cộng đồng có mục 'Công cụ hỗ trợ'; header không còn 'Tải Tool'", "Chức năng", "Cao", ENV + " Đăng nhập thành viên của một cộng đồng.",
      ["Nhìn thanh header trên cùng", "Vào cộng đồng, nhìn sidebar trái", "Bấm 'Công cụ hỗ trợ'"], "-",
      "Header chỉ còn Khám phá / Khóa học / Cộng đồng của tôi (không có 'Tải Tool'); sidebar có 'Công cụ hỗ trợ' (icon dụng cụ) mở /communities/<id>/community/cong-cu với bộ lọc danh mục + các thẻ tool y như trang /tools, vẫn nằm trong khung cộng đồng.")
    A("Công cụ hỗ trợ", "Form 'Mua ngay' trong cộng đồng gửi được yêu cầu", "Chức năng", "Trung bình", ENV, ["Vào Công cụ hỗ trợ trong cộng đồng", "Bấm 'Mua ngay' ở tool có phí, điền tên + SĐT, gửi"], "-",
      "Thông báo gửi thành công; admin có ticket 'Mua tool: <tên>' (như trang /tools).")

    # ---------------------------------------------------------------- Trắc nghiệm
    A("Trắc nghiệm", "Mod/owner thêm trắc nghiệm cho bài đã lưu (không bắt buộc), đặt điểm đạt", "Chức năng", "Cao", ENV + " Đăng nhập owner/mod; có 1 bài học.",
      ["Lớp học > sửa bài học", "Cuộn xuống khung 'Trắc nghiệm cho bài học'", "Thêm 2 câu (mỗi câu 3 lựa chọn, chọn đáp án đúng), điểm đạt 60%", "Bấm 'Lưu trắc nghiệm'"], "60%",
      "Hiện 'Đã lưu trắc nghiệm'; mở lại bài thấy đủ câu và đáp án đúng đã chọn. Bài MỚI (chưa lưu) chỉ hiện gợi ý 'Lưu bài học trước, rồi mở lại để thêm trắc nghiệm'.")
    A("Trắc nghiệm", "Validate khi soạn: câu rỗng, lựa chọn rỗng/trùng, điểm đạt ngoài 1..100", "Chức năng", "Trung bình", ENV, ["Để trống nội dung 1 câu rồi lưu", "Để trống 1 lựa chọn", "Hai lựa chọn giống nhau", "Điểm đạt 0 hoặc 101"], "-",
      "Mỗi trường hợp báo lỗi rõ ràng 'Câu n: ...' / 'Điểm đạt phải là số nguyên từ 1 đến 100' và KHÔNG lưu.")
    A("Trắc nghiệm", "Học viên làm bài: chọn đáp án, nộp, xem điểm; chưa đạt không lộ đáp án đúng", "Chức năng", "Cao", ENV + " Bài có trắc nghiệm 3 câu, điểm đạt 60%.",
      ["Đăng nhập học viên, mở bài", "Chọn sai hết, bấm 'Nộp bài'", "Quan sát kết quả"], "-",
      "Hiện 'Điểm: 0% (0/3 câu đúng) · Chưa đạt (cần tối thiểu 60%)', mỗi câu báo Sai nhưng KHÔNG đánh dấu đáp án đúng; nút 'Làm lại' xóa lựa chọn.")
    A("Trắc nghiệm", "Phải đạt điểm mới hoàn thành được bài; đạt rồi thì hoàn thành và đáp án đúng hiện ra", "Chức năng", "Cao", ENV + " Bài có trắc nghiệm.",
      ["Mở bài, quan sát nút 'Hoàn thành' khi chưa đạt", "Trả lời đúng >= 60% rồi nộp", "Bấm 'Hoàn thành'"], "-",
      "Chưa đạt: nút 'Hoàn thành' bị mờ, tooltip/gợi ý 'Cần đạt tối thiểu 60%...'; gọi API ép sẽ 409 QUIZ_REQUIRED. Đạt: hiện 'Đạt', đáp án đúng được tô xanh, nút bật và bấm hoàn thành được; bỏ đánh dấu không cần đạt lại.")
    A("Trắc nghiệm", "Mod/owner không bị bắt buộc đạt điểm; sửa câu hỏi xóa lượt làm cũ nhưng không hủy bài đã hoàn thành", "Chức năng", "Trung bình", ENV,
      ["Mod mở bài có trắc nghiệm và bấm 'Hoàn thành' ngay", "Học viên đã đạt + hoàn thành bài", "Mod sửa bộ câu hỏi rồi lưu", "Học viên mở lại bài"], "-",
      "Mod hoàn thành được không cần làm bài; sau khi sửa, học viên phải làm lại (trạng thái đạt về chưa đạt) nhưng bài vẫn ở trạng thái đã hoàn thành.", pw="Một phần")
    A("Trắc nghiệm", "Xóa hết câu hỏi rồi lưu = bỏ trắc nghiệm; bài khóa/chưa mua không làm được", "Chức năng", "Trung bình", ENV,
      ["Mod xóa hết câu hỏi rồi lưu", "Học viên mở bài", "Với module trả phí chưa mua: gọi GET .../lessons/<id>/quiz"], "-",
      "Bài trở lại không có trắc nghiệm, hoàn thành bình thường; module bị khóa trả 403 (như xem bài).", pw="Một phần")
    A("Trắc nghiệm", "Giới hạn: nộp sai số câu = 400; tối đa 30 lượt/ngày/bài = 429; người ngoài cộng đồng = 403", "Bảo mật", "Trung bình", ENV,
      ["POST .../quiz/attempt với mảng answers sai độ dài", "Nộp liên tiếp > 30 lần trong ngày", "Gọi bằng tài khoản không thuộc cộng đồng"], "-", "400; 429 QUIZ_TOO_MANY_ATTEMPTS; 403.", pw="Không")

    # ---------------------------------------------------------------- Giới thiệu theo cộng đồng
    A("Giới thiệu theo cộng đồng", "Sidebar có 'Giới thiệu & hoa hồng'; owner đặt % (0-50%), lưu và tắt được", "Chức năng", "Cao", ENV + " Đăng nhập owner cộng đồng có phí.",
      ["Vào cộng đồng > 'Giới thiệu & hoa hồng'", "Nhập 20 rồi 'Lưu'", "Nhập 60 (vượt trần)", "Bấm 'Tắt chương trình'"], "20% / 60%",
      "Lưu 20% thành công ('Đã lưu', phụ đề nêu 20%); 60% báo 'Nhập phần trăm từ 0 đến 50%' và KHÔNG gửi; 'Tắt chương trình' đặt về 0% — thành viên thấy 'Chủ cộng đồng chưa bật chương trình giới thiệu'. Thành viên thường gọi PUT => 403.")
    A("Giới thiệu theo cộng đồng", "Thành viên có link riêng ...?cref=<mã>, sao chép được; người ngoài cộng đồng không xem được", "Chức năng", "Cao", ENV + " Chương trình đang bật.",
      ["Đăng nhập thành viên, mở trang giới thiệu của cộng đồng", "Bấm 'Sao chép'", "Dùng tài khoản không thuộc cộng đồng gọi GET /api/communities/<id>/referral-program"], "-",
      "Link dạng <domain>/communities/<id>?cref=<mã>, nút đổi 'Đã chép'; tài khoản ngoài cộng đồng nhận 403.")
    A("Giới thiệu theo cộng đồng", "Người được mời thanh toán gói: người mời nhận đúng % trên số tiền thanh toán", "Chức năng", "Cao", ENV + " Owner đặt 20%, gói 250.000đ. A là thành viên, B chưa tham gia.",
      ["B mở link của A (có ?cref=)", "B đăng ký/đăng nhập, vào cộng đồng, thanh toán gói 250.000đ (chuyển khoản)", "Đăng nhập A, mở 'Giới thiệu & hoa hồng'"], "20% x 250.000 = 50.000đ",
      "A thấy 'Người đã mời' = 1, 'Đã thanh toán' = 1, Hoa hồng = 50.000đ, Chờ chi trả = 50.000đ (ngày chi trả mùng 5 tháng sau); B hiện trong danh sách với trạng thái 'Đã thanh toán'. Cả các kỳ gia hạn sau cũng được tính.", pw="Một phần")
    A("Giới thiệu theo cộng đồng", "Hoa hồng được trừ vào phần creator nhận (số dư/doanh thu của owner giảm tương ứng)", "Chức năng", "Cao", ENV + " Sau case thanh toán ở trên.",
      ["Đăng nhập owner, mở Doanh thu & rút tiền", "Admin > Thanh toán > Doanh thu creator"], "-",
      "Doanh thu thuần/số dư rút được của cộng đồng = giá trừ phí nền tảng 10% trừ hoa hồng giới thiệu (VD 2 giao dịch 250.000đ, 1 hoa hồng 50.000đ => net 2x250.000 - 2x25.000 - 50.000 = 400.000đ); trang admin khớp. Owner thấy tổng 'Hoa hồng đã phát sinh' và số người giới thiệu.", pw="Một phần")
    A("Giới thiệu theo cộng đồng", "Quy tắc ghi nhận: người đầu tiên thắng; tự mời, mã lạ, người mời không còn là thành viên, chương trình tắt => bỏ qua", "Chức năng", "Cao", ENV,
      ["B dùng link của A rồi dùng link của A2 trước khi thanh toán", "A mở link của chính mình", "B thanh toán với mã không tồn tại", "Đặt 0% rồi B thanh toán qua link"], "-",
      "Hoa hồng thuộc về A (người đầu tiên); các trường hợp còn lại không tạo hoa hồng nhưng thanh toán vẫn thành công bình thường.", pw="Không")
    A("Giới thiệu theo cộng đồng", "Đổi % chỉ áp cho thanh toán sau đó; hoàn tiền toàn bộ hủy hoa hồng chưa chi trả", "Chức năng", "Trung bình", ENV,
      ["Owner đổi 10% -> 30% sau khi B đã thanh toán", "Hoàn tiền toàn bộ giao dịch của B (admin)"], "-",
      "Hoa hồng đã ghi giữ tỉ lệ 10%; thanh toán mới tính 30%. Sau hoàn tiền hoa hồng pending chuyển 'Đã hủy' và số dư creator không còn bị trừ.", pw="Không")
    A("Giới thiệu theo cộng đồng", "Admin > Giao dịch giới thiệu hiện loại 'Giới thiệu trong cộng đồng', lọc được", "Chức năng", "Trung bình", "Đăng nhập Super Admin; đã có hoa hồng cộng đồng.",
      ["Admin > Thanh toán > Giao dịch giới thiệu", "Tab 'Hoa hồng', lọc Loại = 'Giới thiệu trong cộng đồng'"], "-",
      "Dòng hoa hồng hiện đúng người giới thiệu/được giới thiệu/cộng đồng/tỷ lệ/số tiền, nguồn cpayment:<mã>.")

    # ---------------------------------------------------------------- Onboarding
    A("Onboarding", "Bảng tin cộng đồng hiện thẻ 'Bắt đầu hành trình của bạn' với vòng tiến độ n/3", "Chức năng", "Cao",
      ENV + " Cộng đồng có video giới thiệu; thành viên mới chưa làm bước nào.", ["Vào bảng tin (tab 'Cộng đồng')", "Quan sát thẻ trên cùng"], "-",
      "Thẻ gồm tiêu đề, dòng 'Chỉ còn 3 bước nữa...', vòng tròn '0/3 Đã hoàn thành' và 3 dòng: 'Xem video giới thiệu' (Xem ngay) · 'Tìm một bài viết bạn thích và để lại bình luận' (Khám phá) · 'Tải ứng dụng SofinHub' (Tải ngay); minh họa tên lửa bên phải (ẩn trên màn hẹp).")
    A("Onboarding", "Bước video: mở video giới thiệu, đánh dấu xong, nút đổi thành 'Xem lại'; cộng đồng không có video thì chỉ còn 2 bước", "Chức năng", "Cao", ENV,
      ["Bấm 'Xem ngay' ở bước video", "Đóng hộp video, tải lại trang", "Với cộng đồng KHÔNG có video giới thiệu: mở bảng tin"], "-",
      "Hộp thoại phát video YouTube/Vimeo; bước hiện dấu tích, vòng 1/3, nút 'Xem lại' (xám) và vẫn giữ sau khi tải lại; cộng đồng không có video chỉ có 2 bước (n/2).", pw="Một phần")
    A("Onboarding", "Bước bình luận tính từ bình luận thật; 'Khám phá' dẫn tới bài viết thịnh hành", "Chức năng", "Cao", ENV,
      ["Bấm 'Khám phá' ở bước 2", "Bình luận vào một bài viết bất kỳ của cộng đồng", "Quay lại bảng tin"], "-",
      "'Khám phá' chuyển bộ lọc sang 'Đang thịnh hành' và cuộn tới danh sách; sau khi bình luận thật, bước 2 tự có dấu tích (không thể đánh dấu tay qua API: POST .../onboarding/comment => 400).")
    A("Onboarding", "Bước tải ứng dụng: bấm 'Tải ngay' mở link tải và đánh dấu xong", "Chức năng", "Trung bình", ENV + " (Link tải: VITE_APP_DOWNLOAD_URL, mặc định trang /tools.)",
      ["Bấm 'Tải ngay'", "Quay lại bảng tin"], "-", "Mở tab mới tới link tải; bước 3 có dấu tích và nút thành 'Tải lại'.", pw="Một phần")
    A("Onboarding", "Hoàn thành đủ bước: thẻ biến mất, bảng tin trở lại banner 'Chào mừng bạn trở lại'; tiến độ riêng từng thành viên", "Chức năng", "Trung bình", ENV,
      ["Hoàn thành cả 3 bước bằng một tài khoản", "Tải lại bảng tin", "Đăng nhập thành viên khác của cùng cộng đồng"], "-",
      "Tài khoản đã xong thấy banner chào thay cho thẻ; thành viên khác vẫn bắt đầu từ 0/3.")

    # ---------------------------------------------------------------- Video dài / Slide / Tài liệu
    A("Video, slide, tài liệu bài học", "Tải video dài từ máy (tới 2GB): có thanh tiến độ %, nút Hủy, xong hiện 'Đã tải video lên'", "Chức năng", "Cao",
      ENV + " Đăng nhập owner/mod. Nginx của server đã đặt client_max_body_size >= 2100m cho /api/uploads/ (xem docs/api/uploads.md).",
      ["Lớp học > Thêm bài học > loại Video", "Bấm 'Tải video từ máy lên (mp4, webm, mov)' và chọn video 300MB+", "Quan sát thanh tiến độ", "Thử bấm 'Hủy' ở một lần tải khác", "Lưu bài học"], "video mp4 ~300MB",
      "Hiện thanh tiến độ tăng dần kèm %; xong có 'Đã tải video lên'; 'Hủy' dừng tải và báo 'Đã hủy tải lên' (không lưu file); bài lưu thành công và học viên phát được video, tua tới giữa video được (Range 206).", pw="Một phần")
    A("Video, slide, tài liệu bài học", "Giới hạn và định dạng video: mp4/webm/mov nhận; avi/mkv từ chối; > 2GB từ chối", "Chức năng", "Cao", ENV,
      ["Chọn file .avi", "Chọn file .mp4 lớn hơn 2GB (hoặc gọi POST /api/uploads/presign size > 2147483648)"], "-",
      "Báo 'Loại tệp không được hỗ trợ. Chỉ nhận: video MP4, WEBM hoặc MOV' và 'Tệp quá lớn (tối đa 2048MB)'; không tạo yêu cầu upload.")
    A("Video, slide, tài liệu bài học", "Học viên xem video dài: tua được, phát tiếp sau >5 phút không bị 401", "Chức năng", "Cao", ENV + " Bài có video tải lên.",
      ["Đăng nhập học viên, mở bài và phát video", "Tua tới giữa/cuối video", "Để phát hơn 5 phút rồi tua lại"], "-",
      "Tua hoạt động (phản hồi 206 Partial Content); URL ký của video sống 4 giờ nên phát/tua tiếp sau vài phút vẫn được; người ngoài cộng đồng/ẩn danh nhận 403/401.", pw="Một phần")
    A("Video, slide, tài liệu bài học", "Tải nhầm/giả mạo: sai nội dung (đổi đuôi), thiếu Content-Length, gửi nhiều hơn khai báo bị chặn và không để lại file", "Bảo mật", "Trung bình", ENV,
      ["Đổi đuôi một file HTML thành .mp4 rồi tải lên", "Gọi PUT uploadUrl không có Content-Length (chunked)", "Gọi PUT với body lớn hơn size đã khai báo"], "-",
      "400 'Nội dung file không khớp với loại file khai báo'; 411 LENGTH_REQUIRED; 413. Sau lỗi GET /api/files/<key> trả 404; vé upload dùng một lần.", pw="Không")
    A("Video, slide, tài liệu bài học", "Mục 'Tải slide bài giảng' trong form bài học: PDF/PPT/PPTX/PPSX tới 200MB", "Chức năng", "Cao", ENV + " Đăng nhập owner/mod.",
      ["Mở Thêm/Sửa bài học", "Bấm 'Tải slide bài giảng', chọn file .pptx", "Tải thêm một file .pdf", "Bỏ một slide bằng nút X", "Lưu"], "slide.pptx, slide.pdf",
      "Mỗi slide hiện một dòng có tên + nút X; có thanh tiến độ khi tải; chọn .zip/.mp4 bị từ chối với 'Chỉ nhận: PDF, PPT, PPTX hoặc PPSX'; lưu thành công.")
    A("Video, slide, tài liệu bài học", "Học viên thấy mục 'Slide bài giảng' riêng, tách khỏi 'Tệp đính kèm', tải xuống được", "Chức năng", "Cao", ENV + " Bài có 1 slide + 1 tài liệu.",
      ["Đăng nhập học viên, mở bài", "Bấm tên slide"], "-",
      "Có hai mục: 'Slide bài giảng' (icon slideshow) và 'Tệp đính kèm'; bấm slide tải về đúng file; bài đang khóa không lộ slide/tệp.")
    A("Video, slide, tài liệu bài học", "Tài liệu đính kèm nhận thêm DOC, XLS, PPT, PPSX, CSV (trước đây báo 'Loại tệp không được hỗ trợ')", "Chức năng", "Cao", ENV,
      ["Mở Thêm bài học, 'Tải tài liệu cho bài học'", "Lần lượt chọn file .doc, .xls, .ppt, .ppsx, .csv", "Thử file .exe"], "-",
      "Các định dạng trên tải lên thành công (tối đa 25MB mỗi tệp); .exe bị từ chối với danh sách định dạng được hỗ trợ. Trình duyệt trả type rỗng cho .csv/.ppsx/.mov vẫn nhận nhờ suy từ đuôi tệp.")
    A("Video, slide, tài liệu bài học", "Quyền: chỉ mod/owner tải video/slide; mỗi bài tối đa 30 tệp (gồm slide)", "Bảo mật", "Trung bình", ENV,
      ["Học viên gọi POST /api/uploads/presign purpose=lesson_video hoặc lesson_slide", "Mod lưu bài có 31 tệp"], "-", "403 cho học viên; lưu 31 tệp báo 'Tối đa 30 tệp (gồm cả slide)'.", pw="Không")
    A("Video, slide, tài liệu bài học", "Xem thử video ngay trong form sau khi tải lên; bấm tên slide/tài liệu để mở xem", "Chức năng", "Cao", ENV + " Đăng nhập owner/mod.",
      ["Thêm bài học, tải video từ máy lên", "Quan sát khung dưới nút tải", "Dán link YouTube/Vimeo vào ô link", "Tải một slide và một tài liệu, bấm vào tên của chúng"], "-",
      "Video tải lên hiện khung phát 16:9 (có điều khiển, tua được) kèm dòng 'Xem thử'; link YouTube/Vimeo hiện khung nhúng; bấm tên slide/tài liệu mở file trong tab mới (URL ký, không bị 401). Mở thẳng link /api/files/... trên thanh địa chỉ không có đăng nhập sẽ báo cần đăng nhập — đúng thiết kế vì file riêng tư.", pw="Một phần")

