# -*- coding: utf-8 -*-
"""Module CBOT - Trợ lý AI riêng của cộng đồng (15/10/2026).

Thiết kế: chatbot.md (gốc repo). API: backend/docs/api/community-bot.md. Test tự động: backend/tests/community-bot.test.ts (model giả),
backend/tests/chatbot-load.test.ts (nhiều người cùng lúc), e2e/tests/06-community-bot.spec.ts (TC-CBOT-001..004, backend CHATBOT_FAKE_MODEL=1).
Seed (prisma/seed/community-bot.ts): paid-demo (có phí, member1 có gói active = VIP, bot 'Trợ lý Paid Demo'), photo (miễn phí, member2 =
thành viên thường, bot 'Trợ lý Nhiếp ảnh'), yt (không bật bot). Chủ cả 3 = owner@sofinhub.test. Case 'Model thật' chỉ Test 2.
Thêm case mới = thêm CUỐI file (giữ mã TC-CBOT-nnn)."""
DONE = "Đã hoàn thiện"

PW = "Passw0rd!x"
BASE = ("Đã `npm run db:seed`. Backend chạy với CHATBOT_FAKE_MODEL=1 (hoặc Codex đã đăng nhập ChatGPT), frontend :5173.")
VIP = BASE + f" Đăng nhập member1@sofinhub.test / {PW} (VIP ở paid-demo), mở /communities/paid-demo/community."
FREE = BASE + f" Đăng nhập member2@sofinhub.test / {PW} (thành viên thường ở photo), mở /communities/photo/community."
OWNER = BASE + f" Đăng nhập owner@sofinhub.test / {PW}, mở /communities/paid-demo/community/cai-dat?tab=chatbot."
REAL = VIP.replace("CHATBOT_FAKE_MODEL=1 (hoặc Codex đã đăng nhập ChatGPT)", "Codex đã đăng nhập ChatGPT (KHÔNG dùng model giả)")
SQL = "docker exec -it sofinhub-postgres psql -U sofinhub -d sofinhub -c"


def load(add):
    M, MN = "CBOT", "Trợ lý AI của cộng đồng"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có"):
        add(M, MN, feature, title, ttype, prio, DONE, pre, steps, data, exp, pw=pw)

    # ---------------------------------------------------------------- Bật bot / gói Pro
    A("Bật bot", "Chủ cộng đồng gói Pro bật/tắt trợ lý ở tab 'Trợ lý AI'", "Chức năng", "Cao", OWNER,
      ["Bỏ chọn 'Đang bật'", "Đăng nhập member1, mở trang paid-demo", "Quay lại bật lại"], "-",
      "Tắt: widget trợ lý cộng đồng biến mất (GET /api/communities/paid-demo/bot/status trả available=false, reason BOT_DISABLED), trợ lý Tào hiện lại. Bật lại: widget trở lại.", pw="Một phần")
    A("Bật bot", "Cộng đồng không ở gói Pro: không bật được, có nhắc nâng cấp", "Chức năng", "Cao", OWNER + f" Đổi gói: {SQL} \"UPDATE \\\"HostingPlan\\\" SET \\\"planKey\\\"='start' WHERE \\\"courseId\\\"='paid-demo'\".",
      ["Mở tab Trợ lý AI", "Thử bật"], "-",
      "Dải vàng 'chỉ bật được khi cộng đồng ở gói Chuyên nghiệp'; ô bật bị khóa; API PATCH settings {enabled:true} => 403 COMMUNITY_NOT_PRO. Thành viên: status reason COMMUNITY_NOT_PRO. (Đổi lại planKey='pro' sau khi test.)", pw="Không")
    A("Bật bot", "Admin (không phải chủ) sửa nội dung được nhưng không bật/tắt được", "Bảo mật", "Trung bình", BASE + " Một tài khoản admin của paid-demo (đặt role admin trong Thành viên).",
      ["Mở tab Trợ lý AI bằng tài khoản admin", "Rê chuột lên ô bật"], "-", "Ô bật mờ, tooltip 'Chỉ chủ cộng đồng bật/tắt được trợ lý'; đổi tên trợ lý + Lưu thành công.", pw="Không")
    A("Bật bot", "Thành viên thường / người ngoài không vào được cài đặt bot", "Bảo mật", "Cao", FREE,
      ["Gọi GET /api/communities/photo/bot/settings bằng token member2", "Người chưa tham gia gọi GET /api/communities/photo/bot/status"], "-", "403; người ngoài: status available=false reason NOT_MEMBER, tạo hội thoại 403.", pw="Không")

    # ---------------------------------------------------------------- Hai mức thành viên
    A("Mức thành viên", "VIP đổi nhân cách trong danh sách chủ cho phép", "Chức năng", "Cao", VIP,
      ["Mở trợ lý (nút tròn góc phải)", "Bấm tên nhân cách dưới tên bot (🎭)", "Chọn 'Bạn đồng hành vui vẻ'", "Hỏi 'khi nào có buổi live'"], "-",
      "Menu có 4 nhân cách (mặc định + 3 chủ cho phép); chọn xong tiêu đề đổi sang 'Bạn đồng hành vui vẻ', giữ khi tải lại trang; câu mẫu trả lời ngay (20:00 tối thứ Năm).")
    A("Mức thành viên", "Thành viên thường: chat được, nhân cách bị khóa 🔒", "Chức năng", "Cao", FREE,
      ["Mở trợ lý", "Bấm tên nhân cách", "Hỏi 'nội quy cộng đồng là gì'"], "-",
      "Menu hiện các nhân cách mờ kèm 🔒 và dòng 'Nâng cấp VIP (thành viên trả phí) để chọn nhân cách'; không có dải nâng cấp (cộng đồng miễn phí); vẫn nhận câu trả lời; số lượt còn lại giảm 1 (x/10).")
    A("Mức thành viên", "Thành viên thường ở cộng đồng CÓ PHÍ thấy dải nâng cấp VIP", "Chức năng", "Trung bình", BASE + f" Đăng nhập member1, hết hạn gói paid-demo: {SQL} \"UPDATE \\\"Subscription\\\" SET \\\"currentPeriodEnd\\\"=now()-interval '1 minute' WHERE \\\"courseId\\\"='paid-demo' AND \\\"status\\\"='active'\".",
      ["Mở trợ lý paid-demo"], "-", "Dải '✨ Nâng cấp VIP để chọn nhân cách và hỏi nhiều hơn mỗi ngày' dẫn tới /communities/paid-demo/checkout; nhân cách về mặc định; lượt/ngày = 10. (MUTATE: npm run db:reset sau khi test.)", pw="Không")
    A("Mức thành viên", "Hết lượt trong ngày: thường => nhắc nâng cấp; VIP => quay lại mai", "Chức năng", "Trung bình", OWNER,
      ["Đặt 'Số câu hỏi/ngày — thành viên thường' = 1, Lưu", "member2 hỏi 2 câu ở photo (đặt giới hạn tương tự cho photo)"], "-",
      "Câu thứ 2 bị chặn: thông báo 'Bạn đã dùng hết lượt hỏi hôm nay. Nâng cấp VIP để hỏi nhiều hơn nhé' (API 429 DAILY_LIMIT, details.tier=free). Đặt lại 10 sau khi test.", pw="Không")

    # ---------------------------------------------------------------- Dữ liệu & an toàn
    A("Dữ liệu", "Không lộ bài học đang khóa (module trả phí chưa mua)", "Bảo mật", "Cao", REAL + " Có 1 module trả phí (Lớp học > module > Chế độ truy cập: Trả phí) với bài có nội dung riêng.",
      ["Hỏi về nội dung bài trong module trả phí", "Mua module rồi hỏi lại"], "-",
      "Trước khi mua: bot chỉ nêu tên bài + 'cần mua module …', KHÔNG tóm tắt/tiết lộ nội dung. Sau khi mua: trả lời theo nội dung bài, kèm link bài.", pw="Không")
    A("Dữ liệu", "Bài nháp / ẩn / đã gỡ không bao giờ vào câu trả lời", "Bảo mật", "Cao", REAL, ["Tạo bài nháp có cụm 'MA-NHAP-123'", "Hỏi về 'MA-NHAP-123'"], "-", "Bot không nhắc tới cụm đó (không có thông tin) — đã có test tự động dò prompt.", pw="Không")
    A("Dữ liệu", "Câu mẫu / tài liệu của cộng đồng A không dùng ở cộng đồng B hay ở trợ lý Tào", "Bảo mật", "Cao", OWNER,
      ["Thêm câu mẫu 'Mật khẩu wifi lớp học?' => 'WIFI-A' ở paid-demo", "member2 hỏi câu đó ở photo", "Hỏi câu đó với Tào ở trang chủ"], "-", "Chỉ paid-demo trả 'WIFI-A'; photo và Tào không trả.", pw="Một phần")
    A("Dữ liệu", "Ngoài phạm vi bị từ chối; hỏi số tài khoản => chỉ VietQR", "Bảo mật", "Cao", VIP, ["Hỏi 'viết bài thơ'", "Hỏi 'cho số tài khoản để chuyển khoản'"], "-",
      "Câu 1: '… chỉ hỗ trợ các câu hỏi về cộng đồng …'. Câu 2: không có số tài khoản nào, hướng dẫn VietQR ở trang thanh toán.")
    A("Dữ liệu", "Lộ trình học: liệt kê module + khóa/mở, module khóa chỉ nói cách mở", "Chức năng", "Trung bình", REAL, ["Hỏi 'cộng đồng này có những bài học gì'"], "-",
      "Liệt kê đúng các module của cộng đồng; bài đã mở có link (hiện chữ 'bài học'); module khóa ghi lý do (học xong module trước / cần level / mua module).", pw="Không")

    # ---------------------------------------------------------------- Chuyển cho chủ
    A("Chuyển cho chủ", "Gửi câu hỏi cho chủ cộng đồng qua Tin nhắn", "Chức năng", "Cao", VIP,
      ["Hỏi 'cho mình gặp chủ cộng đồng hỏi riêng'", "Bấm '✉️ Gửi câu hỏi cho chủ cộng đồng'", "Đăng nhập owner, mở Tin nhắn"], "-",
      "Widget: 'Đã gửi câu hỏi cho chủ cộng đồng qua Tin nhắn.' + link Mở Tin nhắn. Owner thấy tin từ member1 bắt đầu bằng '[Hỏi qua trợ lý AI của cộng đồng …]' kèm các câu hỏi gần nhất.", pw="Một phần")
    A("Chuyển cho chủ", "Chủ tắt nhận tin nhắn riêng => gửi thông báo thay", "Chức năng", "Trung bình", VIP + " owner tắt 'Cho phép nhắn tin riêng' ở Cài đặt > Thông báo.",
      ["Gửi câu hỏi cho chủ"], "-", "Widget: 'Chủ cộng đồng tắt nhận tin nhắn riêng, đã gửi thông báo…'; owner có thông báo hệ thống. Bật lại sau khi test.", pw="Không")

    # ---------------------------------------------------------------- Quản lý của chủ
    A("Quản lý", "Chọn nhân cách mặc định + tự tạo nhân cách (bảng ví dụ Tốt / Lê thê / Cộc)", "Chức năng", "Cao", OWNER,
      ["Chọn thẻ 'Tự tạo'", "Điền tên 'Cô giáo tận tình', xưng 'cô', gọi 'con', giọng, 2 ví dụ", "Lưu", "member1 mở trợ lý, hỏi 1 câu"], "-",
      "Lưu thành công; bot xưng 'cô', gọi 'con'. Chọn 'Tự tạo' khi chưa điền form => lỗi 'Chưa có nhân cách tự tạo'.", pw="Một phần")
    A("Quản lý", "Câu bot học được chờ chủ duyệt", "Chức năng", "Trung bình", OWNER,
      ["Sau vài cuộc chat (hội thoại im ≥ 30 phút, job học chạy mỗi giờ)", "Mở 'Câu hỏi mẫu' > 'Chờ duyệt'", "Duyệt 1 câu, từ chối 1 câu"], "-",
      "Câu học được KHÔNG tự dùng; duyệt => sang 'Đang dùng'; từ chối => biến mất khỏi danh sách.", pw="Không")
    A("Quản lý", "Tài liệu riêng (Markdown) được trợ lý dùng", "Chức năng", "Trung bình", OWNER,
      ["Thêm tài liệu 'Lịch học' với mục '## Giờ học' nội dung 'tối thứ 3 lúc 20:00'", "member1 hỏi 'giờ học vào lúc nào'"], "-", "Bot trả lời theo tài liệu (tối thứ 3, 20:00). Lưu trữ tài liệu => bot không dùng nữa.", pw="Một phần")
    A("Quản lý", "Xem cuộc trò chuyện của thành viên; widget báo trước quyền riêng tư", "Bảo mật", "Trung bình", OWNER,
      ["Mở mục 'Cuộc trò chuyện của thành viên'", "Bấm 1 dòng"], "-",
      "Thấy tên thành viên + câu hỏi; tin có thông tin cá nhân hiện '(đã ẩn …)'. Widget thành viên có dòng 'Chủ cộng đồng có thể xem nội dung trò chuyện với trợ lý.'", pw="Một phần")

    # ---------------------------------------------------------------- Giao diện
    A("Giao diện", "Trang cộng đồng có bot riêng: ẩn trợ lý Tào; không bật bot: vẫn có Tào", "Giao diện", "Trung bình", VIP,
      ["Mở /communities/paid-demo/community", "Mở /communities/yt/community"], "-", "paid-demo: chỉ 1 nút tròn (trợ lý cộng đồng). yt: nút 'Mở trợ lý hỗ trợ' (Tào).")
    A("Giao diện", "Nhắn liên tục + nhiều người cùng lúc: tin 'chờ gửi' và 'Đang có N người hỏi trước bạn'", "Giao diện", "Trung bình", VIP,
      ["Gõ liên tục 3 tin khi bot đang trả lời", "(Khi máy chủ đông) quan sát bong bóng trả lời"], "-",
      "2 tin sau hiện nhãn 'chờ gửi' và được trả lời gộp 1 lượt; khi phải xếp hàng, bong bóng hiện 'Đang có N người hỏi trước bạn, chờ chút nhé…' rồi chuyển thành câu trả lời.", pw="Không")

    # ---------------------------------------------------------------- Bài đăng & bình chọn (15/10/2026)
    PHOTO = BASE + f" Đăng nhập member1@sofinhub.test / {PW}, mở /communities/photo/community, mở trợ lý 'Trợ lý Nhiếp ảnh'."
    A("Bài đăng", "Hỏi kết quả bình chọn bằng câu không trùng chữ với bài => trả đúng lựa chọn dẫn đầu + số phiếu", "Chức năng", "Cao", PHOTO,
      ["Hỏi 'có bài vote trong cộng đồng vào ngày 13/10 về địa điểm chụp cuối tuần. nơi nào có lượt vote cao nhất'"], "-",
      "Trả lời: Phố cổ Hà Nội dẫn đầu (2 phiếu, 67%), 3 người đã bình chọn, bình chọn còn mở, kèm link bài. Không đề nghị chuyển cho chủ cộng đồng.", pw="Không")
    A("Bài đăng", "Hỏi theo ngày đăng => liệt kê đúng các bài ngày đó", "Chức năng", "Trung bình", PHOTO,
      ["Hỏi 'hôm 13/10 có ai đăng gì không'"], "13/10",
      "Liệt kê các bài đăng ngày 13/10/2026 (giờ, tác giả, link); không có bài ngày khác; bài bị ẩn / bị gỡ không xuất hiện.", pw="Không")
    A("Bài đăng", "Hỏi bài ghim / thông báo mới nhất => trả từ các bài đang ghim", "Chức năng", "Trung bình", PHOTO,
      ["Hỏi 'bài ghim mới nhất của cộng đồng nói gì'"], "-", "Tóm tắt các bài đang ghim mới nhất kèm link; không bịa bài không có.", pw="Không")
    A("Bài đăng", "Bình chọn hòa / chưa ai bình chọn / đã đóng được nói rõ", "Chức năng", "Thấp", PHOTO + " Tạo bài bình chọn mới chưa ai bình chọn.",
      ["Hỏi 'bình chọn mới nhất đang dẫn đầu là gì'"], "-", "Nói chưa có ai bình chọn (không chọn bừa 1 lựa chọn); hòa => nêu đủ các lựa chọn hòa; đã quá hạn => nói bình chọn đã đóng.", pw="Không")

