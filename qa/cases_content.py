# -*- coding: utf-8 -*-
"""Testcase bổ sung: FEED (Bảng tin & Tương tác cộng đồng) + EVENT (Lịch & Sự kiện).
Nguồn: backend/docs/api/content.md, docs/features/content.md, prisma/seed/{posts,events}.ts,
backend/src/modules/{posts,events,moderation,permissions,enrollments}. Chỉ chứa dữ liệu testcase, chạy qua add()."""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Mật khẩu chung Passw0rd!x"
SEED = ("DB vừa `npm run db:seed` sạch (cộng đồng photo). Bài seed photo: seed-post-photo-0 (ghim, Thông báo, 24 like, 3 bình luận), "
        "seed-post-photo-1 (Case study), seed-post-photo-2 (Hỏi đáp), seed-post-photo-3 (Thảo luận chung), "
        "seed-post-photo-m1-image (member1, có ảnh, 5 like, 2 bình luận), seed-post-photo-m1-poll (member1, poll 3 lựa chọn), "
        "seed-post-photo-m1-hidden (member1, ĐÃ ẨN), seed-post-photo-owner-pinned (owner, ghim).")
ACC = "Tài khoản seed @sofinhub.test / Passw0rd!x: owner, cadmin (admin photo), mod, member1, member2, member3 (member photo), newbie (chưa ở cộng đồng nào), banned (bị cấm khỏi photo), admin (Platform Admin, KHÔNG ghi danh photo)."
E403M = "403 FORBIDDEN, message \"Bạn cần tham gia cộng đồng này trước\""
E403R = "403 FORBIDDEN, message \"Bạn không có quyền thực hiện thao tác này trong cộng đồng\""
E401 = "401 UNAUTHORIZED, message \"Vui lòng đăng nhập để tiếp tục\""
E400V = "400 VALIDATION_ERROR, message \"Tham số không hợp lệ\" (chi tiết lỗi từng trường nằm trong error.details)"


def load(add):
    M, MN = "FEED", "Bảng tin & Tương tác cộng đồng"

    def F(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", status=DONE):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    def login(w):
        return f"Đăng nhập {w}@sofinhub.test (POST /api/auth/login, lấy accessToken, gắn header Authorization: Bearer)."

    # ------------------------------------------------------------------ TẠO BÀI
    F("Tạo bài viết", "Tạo bài chữ tối thiểu: category mặc định 'Thảo luận chung', tags rỗng, cộng 5 điểm",
      "Chức năng", "Cao", f"{SEED} {ACC} Ghi lại tổng điểm hiện tại của member2 ở photo (GET /api/me/points).",
      [login("member2"), "POST /api/courses/photo/posts với body chỉ có content", "Đọc lại response và GET /api/me/points"],
      'Body: {"content":"Bài kiểm thử tối thiểu"}',
      "201; data có id, authorId=id member2, content đúng, category=\"Thảo luận chung\", tags=[], pinned=false, likesCount=0, commentsCount=0, "
      "viewerLiked=false, shareUrl=/courses/photo/community?post=<id>, author.name=\"Mai Member2\", không có poll/imageUrl. Tổng điểm member2 tăng đúng +5 (lý do 'post').")
    F("Tạo bài viết", "Tạo bài đầy đủ: nội dung + category + 3 tags + imageUrl",
      "Chức năng", "Cao", f"{SEED} {ACC}",
      [login("member1"), "POST /api/courses/photo/posts với đủ trường", "GET /api/courses/photo/posts?limit=1 kiểm bài đứng đầu nhóm không ghim"],
      'Body: {"content":"Bộ ảnh mới","category":"Case study","tags":["#Street","Film","#35mm"],"imageUrl":"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1200"}',
      "201; category=\"Case study\", tags giữ NGUYÊN chuỗi gửi lên (kể cả dấu #, không tự chuẩn hóa khi lưu), imageUrl đúng. Bài xuất hiện ở đầu danh sách (sau 2 bài ghim).")
    F("Tạo bài viết", "UI: đăng bài chữ ở /courses/photo/community, toast và ô soạn được xóa",
      "Giao diện", "Cao", f"{SEED} {ACC}",
      [login("member2").replace("POST /api/auth/login, lấy accessToken, gắn header Authorization: Bearer", "giao diện /login"), "Mở /courses/photo/community",
       "Bấm ô \"Bạn muốn chia sẻ điều gì?\", gõ nội dung, chọn chuyên mục \"Hỏi đáp\"", "Bấm \"Đăng bài\""],
      "Nội dung: Có ai biết cách chỉnh cân bằng trắng khi chụp đèn neon không?",
      "Toast \"Đã đăng bài viết\"; bài mới hiện đầu bảng tin (dưới các bài ghim) với nhãn chuyên mục Hỏi đáp; ô soạn trống; nút \"Đăng bài\" lại bị khóa.")
    F("Tạo bài viết", "UI: nút Đăng bài bị khóa khi nội dung trống hoặc chỉ khoảng trắng",
      "Giao diện", "Trung bình", f"{ACC}",
      ["Đăng nhập member1 trên giao diện, mở /courses/photo/community", "Để ô soạn trống, quan sát nút \"Đăng bài\"", "Gõ 5 dấu cách rồi quan sát", "Gõ chữ \"a\" rồi quan sát"],
      "Nội dung: \"     \" (5 dấu cách)", "Nút \"Đăng bài\" disabled ở bước 2 và 3, enabled ở bước 4; không có request POST nào được gửi trong 2 bước đầu.")
    F("Tạo bài viết", "Nội dung trống hoặc toàn khoảng trắng bị API từ chối",
      "Chức năng", "Cao", ACC,
      [login("member1"), "POST /api/courses/photo/posts với content=\"\"", "Lặp lại với content=\"   \\n\\t \""],
      'Body: {"content":""} rồi {"content":"   \\n\\t "}',
      f"Cả hai lần: {E400V}; details.fieldErrors.content chứa \"Nội dung không được để trống\". Không tạo bản ghi, không cộng điểm.")
    F("Tạo bài viết", "Biên độ dài nội dung: đúng 4000 ký tự thành công, 4001 ký tự bị 400",
      "Chức năng", "Cao", ACC,
      [login("member1"), "POST bài content = 'a' * 4000", "POST bài content = 'a' * 4001", "Trên UI: dán 4001 ký tự vào ô soạn"],
      "content 4000 và 4001 ký tự 'a' (đếm theo đơn vị UTF-16, emoji tính 2 — giá trị tạm)",
      f"4000: 201. 4001: {E400V}. UI hiển thị chữ đỏ \"Nội dung quá dài\" và khóa nút \"Đăng bài\".")
    F("Tạo bài viết", "Nội dung được trim khoảng trắng đầu/cuối trước khi lưu",
      "Chức năng", "Thấp", ACC,
      [login("member1"), "POST /api/courses/photo/posts với content có khoảng trắng hai đầu", "Kiểm tra content trong response"],
      'Body: {"content":"   Xin chào photo   "}', "201; data.content = \"Xin chào photo\" (không còn khoảng trắng hai đầu).")
    F("Tạo bài viết", "Nội dung tiếng Việt có dấu, emoji và xuống dòng được lưu và hiển thị nguyên vẹn",
      "Chức năng", "Trung bình", ACC,
      [login("member3"), "POST bài với nội dung nhiều dòng có dấu + emoji", "Tải lại trang /courses/photo/community và xem bài"],
      'Body: {"content":"Hoàng hôn Đà Nẵng 🌅\\nDòng hai: “Bố cục” đẹp – ơ ư ă â"}',
      "201; content giữ nguyên ký tự và ký tự xuống dòng; UI hiển thị đúng dấu, emoji, ngắt dòng, không lỗi font.")
    F("Tạo bài viết", "Category không hợp lệ bị từ chối; đủ 4 giá trị hợp lệ đều nhận",
      "Chức năng", "Trung bình", ACC,
      [login("member1"), "POST bài với category=\"Quảng cáo\"", "POST lần lượt 4 bài với category: Thảo luận chung, Hỏi đáp, Case study, Thông báo"],
      'category: "Quảng cáo" | 4 giá trị hợp lệ',
      f"Bước 2: {E400V}. Bước 3: cả 4 lần 201 (lưu ý: member thường vẫn tạo được bài 'Thông báo' — hiện KHÔNG có ràng buộc vai trò theo category, chưa chốt).")
    F("Tạo bài viết", "Giới hạn thẻ: đúng 5 thẻ OK, thẻ thứ 6 bị 400, thẻ dài 31 ký tự bị 400, thẻ rỗng bị 400",
      "Chức năng", "Cao", ACC,
      [login("member1"), "POST với tags 5 phần tử", "POST với tags 6 phần tử", "POST với tags có 1 thẻ 31 ký tự", "POST với tags=[\"\"] và tags=[\"   \"]"],
      'tags: ["a","b","c","d","e"] | 6 thẻ | ["x"*31] | [""]',
      f"Bước 1: 201. Bước 2, 3, 4: {E400V} (details.fieldErrors.tags). Thẻ đúng 30 ký tự vẫn hợp lệ.")
    F("Tạo bài viết", "UI: composer giới hạn 5 thẻ và báo \"Tối đa 5 thẻ cho mỗi bài viết\"",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập member1, mở /courses/photo/community", "Bấm \"Gắn thẻ\", nhập thẻ #1..#5 mỗi thẻ bấm Enter", "Cố nhập thẻ thứ 6"],
      "Thẻ: t1, t2, t3, t4, t5, t6",
      "Sau thẻ thứ 5: ô nhập đổi placeholder \"Đã đủ thẻ\" và bị vô hiệu; nếu thêm được sẽ báo \"Tối đa 5 thẻ cho mỗi bài viết\". Đăng bài chỉ có 5 chip thẻ.")
    F("Tạo bài viết", "imageUrl sai định dạng bị từ chối",
      "Chức năng", "Trung bình", ACC,
      [login("member1"), "POST bài với imageUrl=\"khong-phai-url\"", "POST bài với imageUrl=\"/api/files/abc.png\" (đường dẫn tương đối)"],
      'imageUrl: "khong-phai-url" | "/api/files/abc.png"',
      f"Cả hai lần: {E400V} (BE yêu cầu URL tuyệt đối http/https; FE tự ghép origin cho tệp upload).")
    F("Tạo bài viết", "UI: đăng bài kèm ảnh upload (xem trước, bỏ ảnh, đăng)",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập member1, mở /courses/photo/community", "Bấm \"Ảnh\", chọn file JPG 1MB", "Kiểm tra ảnh xem trước; bấm ✕ rồi chọn lại", "Bấm \"Đăng bài\""],
      "File: anh-test.jpg (1MB)", "Có ảnh xem trước; sau khi đăng, bài hiển thị ảnh; PostView.imageUrl là URL tuyệt đối /api/files/... của tệp đã upload.")
    F("Tạo bài viết", "UI: chọn PDF hoặc ảnh > 5MB ở mục \"Ảnh\" bị chặn bằng lỗi tiếng Việt",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập member1, mở /courses/photo/community", "Bấm \"Ảnh\", chọn file .pdf", "Chọn file JPG 6MB"],
      "File: tai-lieu.pdf; anh-6mb.jpg", "Hiện lỗi tiếng Việt từ useUpload, không có ảnh xem trước, nút Đăng bài chỉ dùng được với nội dung chữ; không có bài nào được tạo.")
    F("Tạo bài viết", "Cộng đồng không tồn tại trả 404 khi đăng bài",
      "Chức năng", "Thấp", ACC,
      [login("member1"), "POST /api/courses/khong-ton-tai/posts với content hợp lệ"], 'Body: {"content":"x"}',
      "404 NOT_FOUND (không tìm thấy cộng đồng); không tạo bài.")
    F("Tạo bài viết", "Nội dung 2 bài giống hệt nhau vẫn được tạo (không chống trùng)",
      "Chức năng", "Thấp", ACC,
      [login("member2"), "POST cùng một body 2 lần liên tiếp", "GET danh sách"],
      'Body: {"content":"Bài lặp lại"}', "2 lần 201 với 2 id khác nhau; danh sách có 2 bài; member2 nhận +5 điểm mỗi bài (không giới hạn tốc độ đăng bài — cần cân nhắc, chưa chốt).")

    # ------------------------------------------------------------------ POLL KHI TẠO
    F("Bình chọn (poll)", "Tạo poll hợp lệ: 3 lựa chọn, 1 đáp án, có hạn đóng",
      "Chức năng", "Cao", ACC,
      [login("member2"), "POST bài kèm poll", "Kiểm tra data.poll"],
      'poll: {"question":"Ống kính nào?","options":["35mm","50mm","85mm"],"multiple":false,"closesAt":"<ISO 2 ngày sau, có Z>"}',
      "201; poll.options gồm 3 phần tử {id (UUID), text, count:0}, totalVoters=0, isClosed=false, viewerVotes=[], multiple=false, closesAt đúng.")
    F("Bình chọn (poll)", "Poll: số lựa chọn tối thiểu 2, tối đa 6",
      "Chức năng", "Cao", ACC,
      [login("member2"), "POST poll 1 lựa chọn", "POST poll 2 lựa chọn", "POST poll 6 lựa chọn", "POST poll 7 lựa chọn"],
      "options: [\"A\"] | [\"A\",\"B\"] | 6 phần tử | 7 phần tử",
      f"1 lựa chọn: {E400V} (details có \"Cần ít nhất 2 lựa chọn\"). 2 và 6: 201. 7: {E400V} (\"Tối đa 6 lựa chọn\").")
    F("Bình chọn (poll)", "Poll: lựa chọn trống/khoảng trắng hoặc quá 100 ký tự bị từ chối; câu hỏi quá 200 ký tự bị từ chối",
      "Chức năng", "Trung bình", ACC,
      [login("member2"), "POST poll options [\"A\",\"  \"]", "POST poll option dài 101 ký tự", "POST poll question dài 201 ký tự"],
      'options: ["A","  "] | ["x"*101,"B"] | question "q"*201',
      f"Cả ba lần: {E400V}; lần 1 có message \"Lựa chọn không được để trống\". Option đúng 100 ký tự và question đúng 200 ký tự vẫn hợp lệ.")
    F("Bình chọn (poll)", "Poll: closesAt ở quá khứ bị 400 với thông điệp riêng",
      "Chức năng", "Cao", ACC,
      [login("member2"), "POST bài kèm poll với closesAt = 1 giờ trước (ISO có Z)"],
      'closesAt: "<now - 1h>Z"', "400 BAD_REQUEST, message \"Thời gian đóng bình chọn phải ở tương lai\"; không tạo bài.")
    F("Bình chọn (poll)", "Poll: closesAt sai định dạng (không phải ISO 8601 đầy đủ) bị 400",
      "Chức năng", "Trung bình", ACC,
      [login("member2"), "POST poll với closesAt=\"2030-01-01\"", "POST poll với closesAt=\"ngày mai\""],
      'closesAt: "2030-01-01" | "ngày mai"', f"Cả hai: {E400V}; details cho closesAt: \"Thời gian đóng bình chọn không hợp lệ (ISO 8601)\".")
    F("Bình chọn (poll)", "UI: nút Đăng bị khóa khi poll chỉ có 1 lựa chọn, báo khi hạn đóng ở quá khứ",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập member2, mở /courses/photo/community", "Bấm \"Poll/Bình chọn\", chỉ điền 1 lựa chọn", "Điền lựa chọn 2, đặt \"Đóng lúc\" về quá khứ, bấm Đăng"],
      "Lựa chọn: \"Có\" ; Đóng lúc: hôm qua", "Bước 2: nút \"Đăng bài\" khóa và có ghi chú cần ≥ 2 lựa chọn. Bước 3: hiện lỗi \"Hạn đóng bình chọn phải ở tương lai\", không gửi bài.")
    F("Bình chọn (poll)", "UI: thêm/xóa lựa chọn poll trong khoảng 2-6",
      "Giao diện", "Thấp", ACC,
      ["Đăng nhập member2, mở composer, bấm \"Poll/Bình chọn\"", "Bấm \"Thêm lựa chọn\" cho tới khi không thêm được", "Xóa bằng biểu tượng thùng rác cho tới khi còn 2"],
      "-", "Tối đa 6 ô \"Lựa chọn 1..6\"; tới 6 nút \"Thêm lựa chọn\" biến mất/vô hiệu; không xóa được dưới 2 ô.")

    # ------------------------------------------------------------------ BÌNH CHỌN
    F("Bình chọn (poll)", "Seed: poll của member1 hiển thị đúng phiếu (o1=3, o2=1, o3=0, totalVoters=3) và viewerVotes của member2",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET /api/posts/seed-post-photo-m1-poll"], "-",
      "200; poll.question=\"Địa điểm chụp cuối tuần?\", options: seed-photo-poll-o1 \"Phố cổ Hà Nội\" count=3, o2 \"Bãi biển Mỹ Khê\" count=1, o3 \"Đồi chè Mộc Châu\" count=0; totalVoters=3; viewerVotes=[\"seed-photo-poll-o1\"]; isClosed=false; multiple=false. Response KHÔNG chứa danh sách người bầu.")
    F("Bình chọn (poll)", "Member chưa bình chọn: viewerVotes rỗng; bình chọn lần đầu tăng đúng 1 phiếu và totalVoters",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "GET /api/posts/seed-post-photo-m1-poll (viewerVotes=[])", "POST /api/posts/seed-post-photo-m1-poll/poll/vote", "Đọc poll trong response"],
      'Body: {"optionIds":["seed-photo-poll-o3"]}',
      "200; o3 count=1, tổng totalVoters=4, viewerVotes=[\"seed-photo-poll-o3\"]; các option khác giữ nguyên.")
    F("Bình chọn (poll)", "Đổi lựa chọn: phiếu cũ bị ghi đè, không cộng dồn",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "POST vote với optionIds [\"seed-photo-poll-o2\"] (member2 đang chọn o1)", "GET lại bài"],
      'Body: {"optionIds":["seed-photo-poll-o2"]}',
      "200; o1 giảm 3->2, o2 tăng 1->2, totalVoters vẫn 3, viewerVotes=[\"seed-photo-poll-o2\"]. UI: nút hiển thị \"Đổi lựa chọn\".")
    F("Bình chọn (poll)", "Poll một đáp án: gửi 2 lựa chọn bị 400",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "POST vote với 2 optionIds vào poll multiple=false"],
      'Body: {"optionIds":["seed-photo-poll-o1","seed-photo-poll-o2"]}', "400 BAD_REQUEST, message \"Bình chọn này chỉ được chọn 1 đáp án\"; phiếu không đổi.")
    F("Bình chọn (poll)", "Poll nhiều đáp án: chọn 2-3 lựa chọn thành công, đổi lại ghi đè toàn bộ",
      "Chức năng", "Cao", ACC,
      [login("member1"), "Tạo bài poll multiple=true 4 lựa chọn (A,B,C,D)", login("member2"), "Vote [A,C]", "Vote [B]", "GET bài"],
      'multiple:true; optionIds [A,C] rồi [B]', "Sau lần 1: A=1, C=1, totalVoters=1 (đếm người, không đếm phiếu). Sau lần 2: chỉ B=1, A=0, C=0, viewerVotes=[B].")
    F("Bình chọn (poll)", "Vote trùng optionId trong cùng request được khử trùng",
      "Chức năng", "Thấp", SEED + " " + ACC,
      [login("member3"), "POST vote với optionIds [o3,o3] vào poll một đáp án"], 'Body: {"optionIds":["seed-photo-poll-o3","seed-photo-poll-o3"]}',
      "200 (sau khử trùng còn 1 lựa chọn hợp lệ); o3 count tăng đúng 1.")
    F("Bình chọn (poll)", "optionId không thuộc poll bị 400; mảng rỗng và >6 phần tử bị 400",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member3"), "POST vote optionIds [\"khong-co\"]", "POST vote optionIds []", "POST vote với 7 optionIds"],
      'optionIds: ["khong-co"] | [] | 7 phần tử',
      f"Lần 1: 400 BAD_REQUEST \"Lựa chọn không hợp lệ\". Lần 2 và 3: {E400V} (\"Hãy chọn ít nhất 1 lựa chọn\" cho mảng rỗng). Phiếu không đổi.")
    F("Bình chọn (poll)", "Vote vào bài không có poll trả 400",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member3"), "POST /api/posts/seed-post-photo-owner-pinned/poll/vote"], 'Body: {"optionIds":["x"]}',
      "400 BAD_REQUEST, message \"Bài viết này không có bình chọn\".")
    F("Bình chọn (poll)", "Poll hết hạn: bình chọn/đổi lựa chọn trả 409 và poll hiển thị đã đóng",
      "Chức năng", "Cao", ACC,
      [login("member1"), "Tạo bài poll 2 lựa chọn với closesAt = now+3 giây", login("member2"), "Vote ngay lập tức (thành công)", "Đợi 4 giây", "Vote lại lựa chọn khác", "GET bài"],
      "closesAt = now + 3s", "Lần vote đầu: 200. Sau khi hết hạn: 409 CONFLICT \"Bình chọn đã đóng\"; GET bài có poll.isClosed=true, phiếu giữ nguyên. UI hiện nhãn \"Đã đóng\", các lựa chọn không bấm được, không có nút bình chọn.")
    F("Bình chọn (poll)", "UI: bình chọn poll seed, thanh phần trăm cập nhật và nút chuyển 'Bình chọn' -> 'Đổi lựa chọn'",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member3, mở /courses/photo/community", "Tìm bài \"Cuối tuần này cả nhóm đi chụp ở đâu?\"", "Chọn \"Đồi chè Mộc Châu\", bấm \"Bình chọn\"", "Chọn \"Bãi biển Mỹ Khê\", bấm \"Đổi lựa chọn\""],
      "-", "Sau bước 3: thanh Mộc Châu 1/4 phiếu (25%), nút đổi thành \"Đổi lựa chọn\". Sau bước 4: Mộc Châu 0, Mỹ Khê 2/4 (50%); tổng vẫn 4 người bầu.")
    F("Bình chọn (poll)", "Danh sách bài không lộ ai đã chọn gì (riêng tư phiếu)",
      "Bảo mật", "Trung bình", SEED + " " + ACC,
      [login("member3"), "GET /api/courses/photo/posts và GET /api/posts/seed-post-photo-m1-poll", "Tìm khóa voters/userId trong poll"], "-",
      "Trong poll chỉ có question, multiple, closesAt, isClosed, totalVoters, viewerVotes, options[{id,text,count}]; không có userId/tên người bầu; viewerVotes của member3 độc lập với người khác.")
    F("Bình chọn (poll)", "Poll không sửa được qua PATCH (chỉ content/category/tags)",
      "Chức năng", "Thấp", SEED + " " + ACC,
      [login("member1"), "PATCH /api/posts/seed-post-photo-m1-poll với body chỉ có poll", "PATCH cùng bài với content mới + trường poll"],
      'Body 1: {"poll":{"options":["x","y"]}} ; Body 2: {"content":"Nội dung mới","poll":{...}}',
      f"Body 1: {E400V} (message zod \"Không có gì để cập nhật\" vì trường lạ bị bỏ qua). Body 2: 200, chỉ content đổi, poll và phiếu KHÔNG đổi.")
    F("Bình chọn (poll)", "Vote đồng thời của cùng một user (2 request song song) vẫn nhất quán",
      "Tích hợp", "Trung bình", SEED + " " + ACC,
      [login("member3"), "Gửi song song 2 POST vote: [o1] và [o2] vào seed-post-photo-m1-poll", "GET bài"],
      "2 request cùng lúc", "Cả hai 200 hoặc một lỗi hệ thống được ghi nhận; sau cùng member3 có đúng 1 lựa chọn (viewerVotes độ dài 1), totalVoters tăng đúng 1 (không phiếu kép do deleteMany+createMany trong transaction).", pw="Một phần")

    # ------------------------------------------------------------------ SỬA BÀI
    F("Sửa bài viết", "Tác giả sửa nội dung, chuyên mục, thẻ: có editedAt và nhãn (đã chỉnh sửa)",
      "Chức năng", "Cao", ACC,
      [login("member2"), "Tạo bài mới rồi PATCH /api/posts/<id>", "Mở /courses/photo/community xem thẻ bài"],
      'Body: {"content":"Nội dung đã sửa","category":"Hỏi đáp","tags":["#Sửa"]}',
      "200; content, category, tags mới; editedAt là ISO hiện tại; createdAt không đổi. UI: hiện \"(đã chỉnh sửa)\" cạnh ngày, toast \"Đã lưu chỉnh sửa\".")
    F("Sửa bài viết", "PATCH từng trường riêng lẻ: chỉ content / chỉ category / chỉ tags",
      "Chức năng", "Trung bình", ACC,
      [login("member2"), "Tạo bài (content A, tags [x])", "PATCH chỉ {\"category\":\"Case study\"}", "PATCH chỉ {\"tags\":[]}"],
      "3 lần PATCH đơn trường", "Mỗi lần chỉ trường được gửi thay đổi, các trường còn lại giữ nguyên; tags:[] xóa hết thẻ; editedAt cập nhật mỗi lần.")
    F("Sửa bài viết", "PATCH body rỗng hoặc chỉ có trường không hỗ trợ bị 400",
      "Chức năng", "Trung bình", ACC,
      [login("member2"), "PATCH /api/posts/<bài của member2> với {}", "PATCH với {\"imageUrl\":\"https://a.b/c.png\"}", "PATCH với {\"content\":\"   \"}"],
      "{} | imageUrl | content khoảng trắng", f"Cả ba: {E400V}. Ảnh không sửa được sau khi đăng (BE bỏ qua trường lạ).")
    F("Sửa bài viết", "Member khác (member3) sửa bài của member1 bị 403 và bài không đổi",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("member3"), "PATCH /api/posts/seed-post-photo-m1-image với content khác", "GET lại bài"],
      'Body: {"content":"Bị sửa trộm"}', "403 FORBIDDEN, message \"Bạn chỉ được sửa bài viết của mình\"; content và editedAt của bài không đổi (IDOR bị chặn).")
    F("Sửa bài viết", "Mod sửa bài của member (hành vi hiện tại: mod+ được sửa)",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("mod"), "PATCH /api/posts/seed-post-photo-m1-image với content mới"], 'Body: {"content":"Nội dung đã được mod biên tập"}',
      "200; content đổi, editedAt có giá trị, authorId vẫn là member1. (Tài liệu ghi 'cần quyết định: cho mod sửa nội dung hay chỉ ẩn/xóa' — hành vi tạm, chưa chốt.)")
    F("Sửa bài viết", "Cadmin, owner sửa bài của member thành công; admin nền tảng chưa ghi danh cũng sửa được",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("cadmin"), "PATCH bài seed-post-photo-m1-poll thay category sang \"Thảo luận chung\" (200)", login("owner"), "PATCH cùng bài với tags mới (200)", login("admin"), "PATCH cùng bài (Platform Admin không ghi danh photo)"],
      "-", "cadmin, owner và admin: 200 (đã sửa: requireMembership cho qua Platform Admin chưa ghi danh, rồi bậc platform_admin >= mod nên được sửa nội dung người khác; trước đây admin bị 403).")
    F("Sửa bài viết", "Sửa bài không tồn tại trả 404",
      "Chức năng", "Thấp", ACC,
      [login("member1"), "PATCH /api/posts/khong-co-bai với content hợp lệ"], 'Body: {"content":"x"}', "404 NOT_FOUND, message \"Không tìm thấy bài viết\".")
    F("Sửa bài viết", "Sửa bài đang bị ẩn: tác giả sửa được, member khác nhận 403 (không phải 404)",
      "Bảo mật", "Thấp", SEED + " " + ACC,
      [login("member1"), "PATCH /api/posts/seed-post-photo-m1-hidden {\"content\":\"Đã chỉnh nội dung\"} (200)", login("member2"), "PATCH cùng bài, và GET /api/posts/seed-post-photo-m1-hidden"],
      "-", "member1: 200. member2: PATCH trả 403 \"Bạn chỉ được sửa bài viết của mình\" nhưng GET trả 404 \"Không tìm thấy bài viết\" — thông điệp lệch nhau làm lộ sự tồn tại của bài ẩn (ghi nhận, chưa chốt).")
    F("Sửa bài viết", "UI: menu \"…\" theo vai trò: member thường chỉ có Báo cáo, tác giả có Sửa/Xóa",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member3, mở menu \"…\" của bài seed-post-photo-m1-image", "Đăng nhập member1, mở menu \"…\" của cùng bài", "Đăng nhập mod, mở menu \"…\" của cùng bài"],
      "-", "member3: chỉ \"Báo cáo\" (không Sửa/Xóa/Ghim/Ẩn). member1 (tác giả): \"Sửa bài viết\", \"Xóa bài viết\", KHÔNG có Báo cáo/Ghim/Ẩn. mod: Sửa, Ghim bài, Ẩn bài viết, Xóa bài viết, Báo cáo.")

    # ------------------------------------------------------------------ XÓA BÀI
    F("Xóa bài viết", "Tác giả xóa bài của mình: xóa cả bình luận, like, phiếu (CASCADE)",
      "Chức năng", "Cao", ACC,
      [login("member2"), "Tạo bài có poll; member1 like, bình luận, vote", "member2 DELETE /api/posts/<id>", "GET /api/posts/<id>, GET /api/posts/<id>/comments"],
      "-", "DELETE 200 {deleted:true}; sau đó GET bài và bình luận đều 404 \"Không tìm thấy bài viết\"; bài không còn trong danh sách; tổng bài trong meta giảm 1.")
    F("Xóa bài viết", "Member khác xóa bài của người khác bị 403 (IDOR)",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("member2"), "DELETE /api/posts/seed-post-photo-m1-image", "GET lại bài"], "-",
      "403 FORBIDDEN, message \"Bạn chỉ được xóa bài viết của mình\"; bài, like, bình luận vẫn còn nguyên.")
    F("Xóa bài viết", "Mod, cadmin, owner xóa được bài của member",
      "Chức năng", "Cao", ACC,
      [login("member1"), "Tạo 3 bài", "Lần lượt mod, cadmin, owner mỗi người DELETE 1 bài"], "-", "Cả 3 DELETE trả 200 {deleted:true}; 3 bài biến mất.")
    F("Xóa bài viết", "Xóa hai lần: lần thứ hai trả 404",
      "Chức năng", "Thấp", ACC,
      [login("member1"), "Tạo bài, DELETE, DELETE lần nữa"], "-", "Lần 1: 200. Lần 2: 404 NOT_FOUND \"Không tìm thấy bài viết\".")
    F("Xóa bài viết", "UI: xóa bài có hộp thoại xác nhận, hủy thì bài còn nguyên",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập member2, tạo bài mới", "Menu \"…\" > \"Xóa bài viết\"", "Bấm hủy trong hộp thoại \"Xóa bài viết?\"", "Lặp lại và bấm \"Xóa bài viết\""],
      "-", "Hủy: bài còn. Xác nhận: toast \"Đã xóa bài viết\", bài biến mất khỏi bảng tin không cần tải lại.")
    F("Xóa bài viết", "Xóa bài đang ghim: bài ghim mất khỏi đầu danh sách, không ảnh hưởng bài ghim còn lại",
      "Chức năng", "Thấp", SEED + " " + ACC,
      [login("owner"), "Tạo bài mới rồi POST pin", "DELETE bài đó", "GET /api/courses/photo/posts?limit=3"], "-",
      "Sau xóa, đầu danh sách vẫn là seed-post-photo-0 rồi seed-post-photo-owner-pinned; tổng bài ghim về 2.")

    # ------------------------------------------------------------------ ẨN / HIỆN
    F("Ẩn/hiện bài viết", "Mod ẩn bài: member thường không thấy trong danh sách, tổng bài giảm",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/posts?limit=50 -> meta.total (7)", login("mod"), "POST /api/posts/seed-post-photo-m1-poll/hide", login("member2"), "GET danh sách lại"],
      "-", "hide trả {hidden:true}. member2 sau đó thấy meta.total=6 và không còn bài poll; GET /api/posts/seed-post-photo-m1-poll trả 404.")
    F("Ẩn/hiện bài viết", "Seed: bài m1-hidden hiển thị với tác giả và mod (hidden:true), ẩn với member khác",
      "Chức năng", "Cao", SEED + " " + ACC,
      ["GET /api/courses/photo/posts?limit=50 lần lượt bằng member1, mod, member2, member3", "Đếm meta.total và tìm seed-post-photo-m1-hidden"], "-",
      "member1 (tác giả) và mod: total=8, bài hidden:true có mặt. member2, member3: total=7, không thấy bài quảng cáo.")
    F("Ẩn/hiện bài viết", "Bài ẩn: người thường không like/bình luận/vote/báo cáo/chia sẻ được (404)",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("member2"), "POST /like, POST /comments, POST /poll/vote, GET /share, GET /comments, POST /posts/:id/report trên seed-post-photo-m1-hidden"],
      'Comment body {"content":"x"}, report {"reason":"spam"}', "Tất cả trả 404 NOT_FOUND \"Không tìm thấy bài viết\"; không tạo like/bình luận/báo cáo.")
    F("Ẩn/hiện bài viết", "Bỏ ẩn (unhide) khôi phục bài cho mọi người",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("mod"), "POST /api/posts/seed-post-photo-m1-hidden/unhide", login("member2"), "GET /api/posts/seed-post-photo-m1-hidden"], "-",
      "unhide 200 {hidden:false}; member2 GET được bài, danh sách total=8. Hành động ẩn/hiện idempotent (gọi hide 2 lần đều 200 {hidden:true}).")
    F("Ẩn/hiện bài viết", "Ma trận vai trò cho hide/unhide: member/newbie/banned/khách bị chặn; mod trở lên và Platform Admin được",
      "Bảo mật", "Cao", SEED + " " + ACC,
      ["Gọi POST /api/posts/seed-post-photo-1/hide lần lượt bằng: không token, member1, newbie, banned (bài không bị ẩn sau các lần này)", "Sau đó admin (Platform Admin chưa ghi danh), cadmin, owner, mod hide; unhide để khôi phục"], "-",
      f"Không token: {E401}. member1: {E403R}. newbie, banned: {E403M}. Bài chưa bị ẩn. admin (Platform Admin), cadmin, owner, mod: 200 {{hidden:true}} (đã sửa: admin nền tảng qua requireMembership, trước đây 403 {E403M}).")
    F("Ẩn/hiện bài viết", "UI: bài đã ẩn hiển thị mờ với nhãn \"Đã ẩn\" cho tác giả/mod, biến mất với member khác",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập mod, mở /courses/photo/community, tìm bài quảng cáo \"Mua ngay khóa học chụp ảnh giá rẻ\"", "Đăng nhập member2, tìm lại bài đó"], "-",
      "mod: thấy bài với nhãn \"Đã ẩn\" (tooltip \"Chỉ tác giả và quản trị viên thấy bài này\"), menu có \"Hiện bài viết\". member2: không thấy bài.")
    F("Ẩn/hiện bài viết", "Bình luận bị ẩn (qua xử lý báo cáo) chỉ tác giả và mod thấy",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member3"), "POST /api/comments/<id bình luận của member2 trên m1-image>/report {\"reason\":\"harassment\"}", login("mod"), "PATCH /api/reports/<id> {\"action\":\"hide_content\"}", login("member3"), "GET /api/posts/seed-post-photo-m1-image/comments", login("member2"), "GET cùng danh sách"],
      "Comment seed-comment-photo-m2-on-m1-image", "member3 không còn thấy bình luận đó; member2 (tác giả) và mod vẫn thấy với hidden:true. commentsCount trên bài không đổi (ẩn không giảm đếm — hành vi hiện tại).")

    # ------------------------------------------------------------------ GHIM
    F("Ghim bài viết", "Mod ghim bài: toggle {pinned}, bài lên đầu danh sách",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("mod"), "POST /api/posts/seed-post-photo-3/pin", "GET /api/courses/photo/posts?limit=5", "POST pin lần 2"], "-",
      "Lần 1: {pinned:true}, bài đứng cùng nhóm ghim (3 bài ghim trước các bài thường, sắp theo createdAt giảm dần trong nhóm). Lần 2: {pinned:false}, bài trở lại vị trí theo thời gian.")
    F("Ghim bài viết", "Sửa lỗi phân quyền: member thường ghim bài phải nhận 403",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("member1"), "POST /api/posts/seed-post-photo-3/pin", "GET /api/posts/seed-post-photo-3 kiểm tra pinned"], "-",
      f"403 FORBIDDEN, message \"Bạn không có quyền thực hiện thao tác này trong cộng đồng\"; pinned vẫn false. (Kiểm chứng đã khắc phục lỗi trước đây cho member ghim được; lặp lại với member2 và member3 cùng kết quả.)")
    F("Ghim bài viết", "Ma trận vai trò cho ghim: tác giả bài (member) cũng không tự ghim được",
      "Bảo mật", "Cao", SEED + " " + ACC,
      ["member1 (tác giả seed-post-photo-m1-image) POST /pin", "newbie POST /pin", "banned POST /pin", "không token POST /pin", "admin (Platform Admin chưa ghi danh), cadmin, owner, mod POST /pin lần lượt"], "-",
      f"member1: {E403R}. newbie, banned: {E403M}. Không token: {E401}. admin/cadmin/owner/mod: 200 với pinned đảo trạng thái mỗi lần (đã sửa: admin nền tảng qua requireMembership, trước đây {E403M}).")
    F("Ghim bài viết", "Ghim nhiều bài: các bài ghim đứng trước theo thời gian; sort=popular vẫn ghim trước",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("owner"), "Ghim thêm seed-post-photo-2", "GET ?sort=latest&limit=4", "GET ?sort=popular&limit=4"], "-",
      "Latest: seed-post-photo-0, seed-post-photo-2 (mới hơn), seed-post-photo-owner-pinned, rồi các bài thường. Popular: 3 bài ghim vẫn đứng trước, trong nhóm ghim sắp theo likesCount giảm dần (photo-0 24 like trước).")
    F("Ghim bài viết", "UI: mod thấy \"Ghim bài/Bỏ ghim\" và nhãn \"Đã ghim\"; member thường không thấy mục ghim",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập mod, mở menu \"…\" của seed-post-photo-3, bấm \"Ghim bài\"", "Đăng nhập member1 xem menu cùng bài"], "-",
      "mod: bài có nhãn \"Đã ghim\" và lên đầu; mục đổi thành \"Bỏ ghim\". member1: menu không có mục ghim.")
    F("Ghim bài viết", "Ghim bài đã bị ẩn: bài vẫn ghim nhưng người thường không thấy",
      "Chức năng", "Thấp", SEED + " " + ACC,
      [login("mod"), "POST pin seed-post-photo-m1-hidden", login("member2"), "GET danh sách"], "-", "pin 200 {pinned:true}; member2 vẫn không thấy bài ẩn dù đã ghim (ẩn ưu tiên hơn ghim).")

    # ------------------------------------------------------------------ BÌNH LUẬN
    F("Bình luận", "Thêm bình luận: 201, commentsCount +1, thông báo post_commented cho tác giả",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "POST /api/posts/seed-post-photo-m1-poll/comments", login("member1"), "GET /api/notifications và GET bài kiểm tra commentsCount"],
      'Body: {"content":"Mình chọn Mỹ Khê!"}',
      "201; CommentView có id, author.name=\"Mai Member2\", createdAt, content trim. commentsCount 0->1. member1 nhận thông báo type=post_commented, body bắt đầu \"Mai Member2 đã bình luận: Mình chọn Mỹ Khê!\", link /courses/photo/community?post=seed-post-photo-m1-poll.")
    F("Bình luận", "Tự bình luận bài của mình không tạo thông báo",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member1"), "Ghi số thông báo hiện tại", "POST bình luận vào bài của chính member1", "GET /api/notifications"], 'Body: {"content":"Cập nhật thêm"}', "201; số thông báo post_commented của member1 không tăng.")
    F("Bình luận", "Bình luận trống, chỉ khoảng trắng, hoặc dài 1001 ký tự bị từ chối; đúng 1000 ký tự thành công",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "POST comment content=\"\"", "POST content=\"  \"", "POST content 'a'*1000", "POST content 'a'*1001"],
      "0, 2 dấu cách, 1000, 1001 ký tự", f"Trống và khoảng trắng: {E400V} (\"Bình luận không được để trống\"). 1000: 201. 1001: {E400V}. UI: nút Gửi khóa khi trống, ô nhập maxLength 1000.")
    F("Bình luận", "Bình luận vào bài không tồn tại trả 404; danh sách bình luận sắp theo thời gian tăng dần",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "POST /api/posts/khong-co/comments", "GET /api/posts/seed-post-photo-m1-image/comments"], 'Body: {"content":"x"}',
      "Lần 1: 404 \"Không tìm thấy bài viết\". Lần 2: 200, 2 bình luận: của member2 (\"Bố cục đẹp quá, màu trời rất có hồn!\") trước, của thành viên minh họa (\"Cảm ơn bạn đã chia sẻ, rất hữu ích!\") sau.")
    F("Bình luận", "Trả lời lồng (reply): API hiện chưa hỗ trợ parentId — trường bị bỏ qua, bình luận phẳng",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member3"), "POST comment kèm parentId = id bình luận của member2", "GET danh sách bình luận"],
      'Body: {"content":"Đồng ý với bạn","parentId":"seed-comment-photo-m2-on-m1-image"}',
      "201; bình luận được tạo như bình luận cấp 1 (không có trường parentId/replies trong CommentView), xếp cuối danh sách. Ghi nhận: các testcase cũ mô tả 'lồng 1 cấp' nhưng BE/FE không có tính năng này.")
    F("Bình luận", "Trả lời lồng 1 cấp (thụt lề, thông báo cho người được trả lời)",
      "Chức năng", "Trung bình", "Chưa làm: bình luận trả lời lồng (parentId, hiển thị cây, thông báo cho chủ bình luận). " + ACC,
      ["Đăng nhập member3, mở bình luận của bài seed-post-photo-m1-image", "Bấm \"Trả lời\" ở bình luận của member2", "Gửi nội dung"], "Nội dung: Đồng ý với bạn",
      "(Dự kiến) Trả lời hiển thị thụt lề dưới bình luận gốc, member2 nhận thông báo; không cho lồng quá 1 cấp.", pw="Không", status=PLAN)
    F("Bình luận", "Sửa bình luận: tác giả sửa được, có editedAt; người khác 403; mod sửa được",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "PATCH /api/comments/seed-comment-photo-m2-on-m1-image {\"content\":\"Bố cục rất đẹp!\"}", login("member3"), "PATCH cùng bình luận", login("mod"), "PATCH cùng bình luận"],
      "-", "member2: 200 có editedAt, UI hiện \"(đã chỉnh sửa)\". member3: 403 \"Bạn chỉ được sửa bình luận của mình\". mod: 200 (mod+ được sửa nội dung người khác, hành vi tạm).")
    F("Bình luận", "Xóa bình luận: tác giả tự xóa giảm commentsCount; commentsCount không âm",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "POST comment vào seed-post-photo-m1-poll", "DELETE /api/comments/<id>", "GET bài", "DELETE lần 2"], "-",
      "Xóa lần 1: 200 {deleted:true}, commentsCount về giá trị trước. Lần 2: 404 \"Không tìm thấy bình luận\"; commentsCount không xuống dưới 0.")
    F("Bình luận", "Tác giả bài (member) không xóa được bình luận của người khác trên bài của mình",
      "Bảo mật", "Trung bình", SEED + " " + ACC,
      [login("member1"), "DELETE /api/comments/seed-comment-photo-m2-on-m1-image (member1 là chủ bài, member2 là chủ bình luận)"], "-",
      "403 FORBIDDEN, message \"Bạn chỉ được xóa bình luận của mình\"; bình luận còn nguyên.")
    F("Bình luận", "Mod/cadmin/owner xóa bình luận của member",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "Tạo 3 bình luận vào seed-post-photo-2", "Lần lượt mod, cadmin, owner DELETE mỗi bình luận"], "-", "Cả 3 trả 200; commentsCount giảm đúng 3; UI mod thấy nút \"Xóa\" trên bình luận của người khác, member thường không thấy.")
    F("Bình luận", "IDOR: người ngoài cộng đồng sửa/xóa bình luận qua id bình luận",
      "Bảo mật", "Cao", SEED + " " + ACC,
      ["newbie PATCH /api/comments/seed-comment-photo-m2-on-m1-image", "banned DELETE cùng bình luận", "admin (chưa ghi danh) DELETE cùng bình luận"], 'Body PATCH: {"content":"hack"}',
      f"Cả ba: {E403M}; bình luận không đổi. Không token: {E401}.")
    F("Bình luận", "UI: mở bình luận, gửi bình luận mới, Enter/nút Gửi, đếm cập nhật",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập member3, mở /courses/photo/community", "Bấm biểu tượng bình luận của bài seed-post-photo-m1-image", "Gõ vào ô \"Viết bình luận…\" và gửi"], "Nội dung: Ảnh rất có chiều sâu",
      "Bình luận mới hiện cuối danh sách, số đếm bình luận trên bài tăng từ 2 lên 3, ô nhập được xóa.")

    # ------------------------------------------------------------------ LIKE
    F("Thích (Like)", "Like lần đầu: liked=true, likesCount +1, tác giả +2 điểm và nhận thông báo post_liked",
      "Chức năng", "Cao", SEED + " " + ACC + " Ghi lại điểm của owner (GET /api/me/points).",
      [login("member3"), "POST /api/posts/seed-post-photo-owner-pinned/like", login("owner"), "GET /api/me/points và GET /api/notifications"], "-",
      "200 {liked:true, likesCount:3}. owner tăng +2 điểm (like_received) và có thông báo type=post_liked, body \"Manh Member3 đã thích bài viết của bạn\".")
    F("Thích (Like)", "Unlike rồi like lại: likesCount đúng, điểm/thông báo chỉ tính lần đầu (chống farm)",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "Like bài của owner (đã như trên), unlike, like lại 3 lần", "Đọc điểm và thông báo của owner"], "-",
      "likesCount sau mỗi bước: +1, -1, +1... khớp số PostLike. Owner chỉ nhận đúng +2 điểm và đúng 1 thông báo post_liked cho cặp (member3, bài).")
    F("Thích (Like)", "Tự like bài của mình: like được nhưng không cộng điểm, không thông báo",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member1"), "Ghi điểm, POST /like trên seed-post-photo-m1-poll", "Đọc điểm + thông báo"], "-", "200 {liked:true}; điểm và thông báo của member1 không đổi.")
    F("Thích (Like)", "Like bài của thành viên minh họa: được ghi like nhưng không cộng điểm/thông báo",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member3"), "POST /api/posts/seed-post-photo-1/like", "GET bài"], "-", "200 {liked:true, likesCount:16}; không tạo PointEvent hay Notification cho tác giả minh họa (isDemo).")
    F("Thích (Like)", "Like đồng thời: 10 request like/unlike song song, likesCount khớp số PostLike",
      "Tích hợp", "Trung bình", SEED + " " + ACC,
      [login("member2"), "Bắn 10 POST /like song song lên seed-post-photo-3", "GET bài rồi đối chiếu số bản ghi PostLike trong DB"], "10 request song song",
      "likesCount = 9 + (1 nếu số lần toggle lẻ) tương ứng đúng trạng thái like cuối; không âm, không lệch với COUNT(PostLike) (khóa hàng bài FOR UPDATE).", pw="Một phần")
    F("Thích (Like)", "Like bài không tồn tại 404; ngoài cộng đồng 403; không token 401",
      "Bảo mật", "Trung bình", SEED + " " + ACC,
      ["member1 POST /api/posts/khong-co/like", "newbie POST /api/posts/seed-post-photo-1/like", "banned POST like", "không token POST like"], "-",
      f"404 \"Không tìm thấy bài viết\"; newbie và banned: {E403M}; không token: {E401}.")
    F("Thích (Like)", "UI: nút tim đổi trạng thái và số đếm ngay, tải lại vẫn giữ (viewerLiked)",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member2, mở bài seed-post-photo-3 trong /courses/photo/community", "Bấm tim (like)", "Tải lại trang", "Bấm tim lần nữa (unlike)"], "-",
      "Số like 9 -> 10 với tim đặc/màu; tải lại vẫn ở trạng thái đã thích (viewerLiked=true); unlike về 9.")

    # ------------------------------------------------------------------ BÁO CÁO
    F("Báo cáo nội dung", "Báo cáo bài với lý do hợp lệ: 201, ReportView status=open",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "POST /api/posts/seed-post-photo-1/report", "Đăng nhập mod, GET /api/courses/photo/reports?status=open"], 'Body: {"reason":"misinformation","detail":"Thông tin sai lệch"}',
      "201; data.status=\"open\", targetType=\"post\", targetId=seed-post-photo-1, reason=\"misinformation\", targetExcerpt là trích đoạn nội dung; hàng đợi mod có thêm báo cáo này (cùng báo cáo seed-report-photo-open của member3).")
    F("Báo cáo nội dung", "Báo cáo bài với đủ 5 lý do: spam, harassment, inappropriate, misinformation, other",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      ["member1..member3, mod, cadmin lần lượt báo cáo cùng bài seed-post-photo-2 với 5 lý do khác nhau"], "reason: spam | harassment | inappropriate | misinformation | other",
      "Cả 5 lần 201, mỗi lần một Report riêng (mỗi người chỉ được báo cáo 1 lần).")
    F("Báo cáo nội dung", "Lý do không hợp lệ hoặc thiếu, chi tiết > 1000 ký tự bị 400",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "POST report với reason=\"ghét\"", "POST report thiếu reason", "POST report detail 1001 ký tự", "POST report detail đúng 1000 ký tự"], 'reason: "ghét" | thiếu | detail 1001/1000',
      f"3 lần đầu: {E400V} (\"Lý do báo cáo không hợp lệ\" cho reason). Detail 1000 ký tự: 201.")
    F("Báo cáo nội dung", "Báo cáo trùng cùng bài/cùng người: 409 \"Bạn đã báo cáo mục này rồi\"",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "POST /api/posts/seed-post-photo-m1-image/report (member3 đã báo cáo ở seed)"], 'Body: {"reason":"spam"}',
      "409 CONFLICT, message \"Bạn đã báo cáo mục này rồi\"; số báo cáo của bài không tăng.")
    F("Báo cáo nội dung", "Hai request báo cáo song song cùng (người, bài): đúng 1 thành công, 1 bị 409",
      "Tích hợp", "Trung bình", SEED + " " + ACC,
      [login("member2"), "Gửi song song 2 POST /api/posts/seed-post-photo-3/report cùng body"], 'Body: {"reason":"spam"}',
      "Một 201, một 409 \"Bạn đã báo cáo mục này rồi\" (unique index chặn ở DB); chỉ 1 bản ghi Report.", pw="Một phần")
    F("Báo cáo nội dung", "Tự báo cáo bài/bình luận của mình bị 400",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member1"), "POST /api/posts/seed-post-photo-m1-image/report", login("member2"), "POST /api/comments/seed-comment-photo-m2-on-m1-image/report"], 'Body: {"reason":"spam"}',
      "Cả hai: 400 BAD_REQUEST, message \"Bạn không thể báo cáo chính mình hoặc nội dung của mình\".")
    F("Báo cáo nội dung", "Báo cáo bình luận: 201 và người xử lý nhận đúng targetType=comment",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member3"), "POST /api/comments/seed-comment-photo-demo-on-m1-image/report {\"reason\":\"spam\"}", "mod GET /api/courses/photo/reports?status=open"], "-",
      "201; targetType=\"comment\", targetExcerpt=\"Cảm ơn bạn đã chia sẻ, rất hữu ích!\". Hàng đợi hiển thị báo cáo bình luận (không có link tới bài chứa — giới hạn đã biết).")
    F("Báo cáo nội dung", "Người ngoài cộng đồng, banned, khách không báo cáo được",
      "Bảo mật", "Cao", SEED + " " + ACC,
      ["newbie POST /api/posts/seed-post-photo-1/report", "banned POST cùng", "không token POST cùng"], 'Body: {"reason":"spam"}', f"newbie, banned: {E403M}. Không token: {E401}.")
    F("Báo cáo nội dung", "Báo cáo bài đã xóa hoặc không tồn tại trả 404",
      "Chức năng", "Thấp", ACC,
      [login("member2"), "POST /api/posts/khong-co/report", "POST /api/comments/khong-co/report"], 'Body: {"reason":"spam"}', "Bài: 404 \"Không tìm thấy bài viết\". Bình luận: 404 \"Không tìm thấy bình luận\".")
    F("Báo cáo nội dung", "UI: hộp thoại \"Báo cáo bài viết\" chọn lý do, gửi và toast; báo lần 2 hiện lỗi đỏ",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member2, mở menu \"…\" của seed-post-photo-2 > \"Báo cáo\"", "Chọn radio \"spam\" (nhãn tiếng Việt), nhập chi tiết, bấm gửi", "Lặp lại báo cáo cùng bài"], "Chi tiết: Nội dung quảng cáo",
      "Lần 1: toast \"Đã gửi báo cáo, quản trị viên sẽ xem xét\", hộp thoại đóng. Lần 2: chữ đỏ \"Bạn đã báo cáo mục này rồi\" trong hộp thoại, không đóng.")
    F("Báo cáo nội dung", "Xử lý báo cáo seed 'open' bằng ẩn nội dung: bài ẩn, người báo cáo nhận report_resolved",
      "Tích hợp", "Cao", SEED + " " + ACC,
      [login("mod"), "PATCH /api/reports/seed-report-photo-open {\"action\":\"hide_content\",\"note\":\"Đã xử lý\"}", login("member3"), "GET /api/notifications", login("member2"), "GET /api/posts/seed-post-photo-m1-image"], "-",
      "PATCH 200, status=\"resolved\", action=\"hide_content\". member3 nhận thông báo report_resolved \"Báo cáo của bạn được xác định là vi phạm, nội dung đã bị ẩn.\" member2 GET bài trả 404. Xử lý lần 2 -> 409 \"Báo cáo này đã được xử lý\".")

    # ------------------------------------------------------------------ CHIA SẺ
    F("Chia sẻ bài viết", "GET /share trả url, title, excerpt đúng định dạng",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "GET /api/posts/seed-post-photo-m1-image/share"], "-",
      "200; url=\"/courses/photo/community?post=seed-post-photo-m1-image\", title=\"Minh Member1 — Case study\", excerpt là toàn bộ nội dung (dưới 140 ký tự).")
    F("Chia sẻ bài viết", "Excerpt cắt tại 140 ký tự và thêm dấu … với bài dài",
      "Chức năng", "Thấp", ACC,
      [login("member2"), "Tạo bài 500 ký tự", "GET /share"], "content: 'x' * 500", "excerpt có 140 ký tự, ký tự cuối là \"…\" (139 ký tự đầu + …).")
    F("Chia sẻ bài viết", "Mở link chia sẻ bằng thành viên: cuộn tới bài, hiện khối \"Bài viết được chia sẻ với bạn\" nếu ngoài trang đầu",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member3, mở /courses/photo/community?post=seed-post-photo-3", "Tạo trước 12 bài mới bằng API để bài seed nằm ngoài trang đầu, tải lại link"], "-",
      "Trang cuộn tới bài và viền cam nổi bật; nếu không ở trang đầu, khối \"Bài viết được chia sẻ với bạn\" ở đầu (tải bằng GET /api/posts/:id) có nút \"Đóng\" bỏ tham số ?post.")
    F("Chia sẻ bài viết", "Link chia sẻ tới bài đã xóa/đã ẩn (với người thường): báo không mở được",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập member2, mở /courses/photo/community?post=seed-post-photo-m1-hidden", "Mở /courses/photo/community?post=khong-co"], "-", "Hiện thông báo \"Không mở được bài viết này…\"; API trả 404; không lộ nội dung bài ẩn.")
    F("Chia sẻ bài viết", "Người ngoài cộng đồng mở link chia sẻ: 403, không xem được nội dung",
      "Bảo mật", "Cao", SEED + " " + ACC,
      ["newbie GET /api/posts/seed-post-photo-1", "newbie GET /api/posts/seed-post-photo-1/share", "Khách (chưa đăng nhập) mở /courses/photo/community?post=seed-post-photo-1"], "-",
      f"API: {E403M} cho hai request đầu. Khách: chuyển tới đăng nhập/không thấy nội dung bài.")
    F("Chia sẻ bài viết", "UI: nút Chia sẻ sao chép liên kết và toast",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập member2, mở bài bất kỳ", "Bấm \"Chia sẻ\"", "Dán clipboard vào thanh địa chỉ tab mới"], "-", "Toast \"Đã sao chép liên kết bài viết\"; link dạng http://localhost:5173/courses/photo/community?post=<id> mở đúng bài.", pw="Một phần")

    # ------------------------------------------------------------------ LỌC / SẮP XẾP / PHÂN TRANG
    F("Lọc & sắp xếp", "Danh sách mặc định (latest): bài ghim trước, sau đó mới nhất; tổng 7 với member thường",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/posts"], "-",
      "200; meta {page:1, limit:10, total:7, totalPages:1}; thứ tự: seed-post-photo-0 (ghim), seed-post-photo-owner-pinned (ghim), m1-poll, m1-image, seed-post-photo-1, seed-post-photo-2, seed-post-photo-3.")
    F("Lọc & sắp xếp", "Sắp xếp popular: ghim trước rồi theo số like giảm dần",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/posts?sort=popular"], "-",
      "Thứ tự: photo-0 (24), owner-pinned (2) [nhóm ghim], photo-1 (15), photo-3 (9), photo-2 (6), m1-image (5), m1-poll (0).")
    F("Lọc & sắp xếp", "Lọc theo category: Hỏi đáp, Thông báo; category sai bị 400",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET ?category=Hỏi đáp (URL-encode)", "GET ?category=Thông báo", "GET ?category=Khac"], "-",
      f"Hỏi đáp: 1 bài (seed-post-photo-2), total=1. Thông báo: 2 bài (photo-0, owner-pinned). category=Khac: {E400V}.")
    F("Lọc & sắp xếp", "Lọc theo thẻ không phân biệt hoa/thường và bỏ dấu #",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET ?tag=Portrait", "GET ?tag=portrait", "GET ?tag=%23PORTRAIT", "GET ?tag=Networking"], "-",
      "Ba lần đầu cùng kết quả: đúng 1 bài seed-post-photo-m1-image. Networking: 2 bài (m1-poll, seed-post-photo-3) sắp mới nhất trước.")
    F("Lọc & sắp xếp", "Kết hợp tag + category + sort + phân trang",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "GET ?tag=ChiaSẻ&category=Case study&sort=popular&limit=1&page=1", "GET tương tự page=2"], "-",
      "total=2 (seed-post-photo-1 có #KếtQuả/#ChiaSẻ và m1-image có #ChiaSẻ; cả hai Case study), popular: photo-1 (15) rồi m1-image (5); page 1 chứa 1 bài, page 2 bài còn lại, totalPages=2.")
    F("Lọc & sắp xếp", "Tag không tồn tại / tag rỗng / tag dài 31 ký tự",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "GET ?tag=khongcoai", "GET ?tag=", "GET ?tag=<31 ký tự>"], "-",
      f"khongcoai: 200 data=[], meta.total=0, totalPages=1. tag rỗng: {E400V}. 31 ký tự: {E400V}.")
    F("Lọc & sắp xếp", "Bài ẩn không xuất hiện trong lọc thẻ của member thường nhưng có với tác giả/mod",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      ["member2 GET ?tag=QuảngCáo", "member1 (tác giả) GET ?tag=QuảngCáo", "mod GET ?tag=QuảngCáo"], "-", "member2: total=0. member1 và mod: total=1 (seed-post-photo-m1-hidden, hidden:true).")
    F("Lọc & sắp xếp", "Thẻ phổ biến GET /tags: chỉ tính bài không ẩn, mỗi bài 1 lần, sắp theo số bài giảm dần",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/tags"], "-",
      "200; ChiaSẻ và Networking đứng đầu (count 2 mỗi thẻ, sắp theo tên khi hòa), các thẻ còn lại count 1; không có #QuảngCáo (bài ẩn); tối đa 20 thẻ. Newbie gọi -> 403; không token -> 401.")
    F("Lọc & sắp xếp", "Thẻ lặp/khác hoa thường trong cùng bài chỉ tính 1 lần",
      "Chức năng", "Thấp", ACC,
      [login("member2"), "Tạo bài tags [\"#Lặp\",\"lặp\",\"LẶP\"]", "GET /tags"], "-", "Thẻ \"Lặp\" (dạng của bài mới nhất) có count=1 cho bài này.")
    F("Lọc & sắp xếp", "UI: chip lọc chuyên mục, \"Đang thịnh hành\" và chip lọc thẻ có nút bỏ lọc",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Đăng nhập member2, mở /courses/photo/community", "Bấm chip \"Hỏi đáp\", rồi \"Đang thịnh hành\", rồi \"Tất cả\"", "Bấm chip thẻ #Portrait trên bài m1-image", "Bấm ✕ \"Bỏ lọc thẻ\""], "-",
      "Hỏi đáp chỉ 1 bài. Thịnh hành: sắp popular. Chip thẻ: URL thêm ?tag=Portrait, chỉ 1 bài, có chip \"Đang lọc theo thẻ #Portrait\"; ✕ bỏ lọc trả toàn bộ.")
    F("Lọc & sắp xếp", "UI: trạng thái rỗng khi không có bài khớp",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập member2, mở /courses/photo/community?tag=khongcoai", "Trong cộng đồng mới (owner tạo cộng đồng mới), mở bảng tin khi chưa có bài"], "-",
      "Thẻ không có bài: \"Chưa có bài viết nào gắn thẻ #khongcoai.\". Cộng đồng chưa có bài: \"Chưa có bài viết nào. Hãy là người đăng đầu tiên!\".")
    F("Phân trang", "limit/page: page=2&limit=3, page vượt tổng, page=0, limit=51, limit=0",
      "Chức năng", "Cao", SEED + " " + ACC,
      [login("member2"), "GET ?limit=3&page=2", "GET ?limit=3&page=99", "GET ?page=0", "GET ?limit=51", "GET ?limit=0", "GET ?limit=50"], "-",
      f"page=2&limit=3: 3 bài (thứ 4-6), meta {{page:2, limit:3, total:7, totalPages:3}}. page=99: data=[], total=7. page=0, limit=51, limit=0: {E400V}. limit=50: 200.")
    F("Phân trang", "Phân trang ổn định: duyệt hết các trang không trùng, không sót bài",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member1"), "Tạo 25 bài", "Duyệt page=1..N với limit=10", "Gộp id và kiểm tra trùng"], "-", "Không id nào lặp; tổng số bài duyệt bằng meta.total (33 với member1 thấy cả bài ẩn của mình); totalPages = ceil(total/10).")
    F("Phân trang", "UI: nút \"Tải thêm bài viết (đã hiện/tổng)\" tải 10 bài mỗi lần và biến mất khi hết",
      "Giao diện", "Cao", SEED + " " + ACC,
      ["Dùng API tạo thêm 8 bài để tổng = 15", "Đăng nhập member2, mở /courses/photo/community", "Quan sát nút cuối trang, bấm nút", "Đổi chip chuyên mục"], "-",
      "Hiển thị 10 bài và nút \"Tải thêm bài viết (10/15)\". Bấm: hiện đủ 15, nút biến mất. Đổi chuyên mục: tải lại từ trang 1.")
    F("Phân trang", "Hiệu năng: GET danh sách 50 bài < 500ms (server local), số truy vấn không tăng theo số bài",
      "Hiệu năng", "Trung bình", "DB có ≥ 200 bài trong photo (tạo bằng script POST). " + ACC,
      [login("member2"), "Đo thời gian GET ?limit=50 (5 lần, lấy trung vị)"], "limit=50", "Trung vị < 500ms (giá trị tạm); thời gian với limit=10 và limit=50 không chênh tuyến tính (toViews gom truy vấn theo lô).", pw="Không")

    # ------------------------------------------------------------------ XSS
    F("Bảo mật nội dung", "XSS trong nội dung bài: script/onerror được hiển thị thành chữ, không thực thi",
      "Bảo mật", "Cao", ACC,
      [login("member2"), "Bắt sự kiện dialog của trình duyệt", "POST bài với payload XSS", "Mở /courses/photo/community và tải lại"],
      'content: "<script>alert(1)</script><img src=x onerror=alert(2)>"',
      "API lưu nguyên văn (201); trang hiển thị chuỗi thành văn bản thuần; không có hộp thoại alert; DOM không sinh thẻ <script>/<img onerror> từ nội dung.")
    F("Bảo mật nội dung", "XSS trong bình luận và trong thẻ (tag)",
      "Bảo mật", "Cao", ACC,
      [login("member2"), "POST bình luận '\"><svg onload=alert(1)>'", "POST bài với tags [\"<b>x</b>\"]", "Mở trang xem bình luận và chip thẻ"],
      'comment: "\\"><svg onload=alert(1)>" ; tag: "<b>x</b>"', "Bình luận và chip thẻ hiển thị dạng chữ (thấy nguyên ký tự < >); không thực thi script; không bị in đậm.")
    F("Bảo mật nội dung", "imageUrl dạng javascript: hoặc data: bị BE từ chối 400",
      "Bảo mật", "Cao", ACC,
      [login("member2"), "POST bài với imageUrl=\"javascript:alert(1)\" (và một lần data:text/html,...)", "Mở bảng tin"],
      'imageUrl: "javascript:alert(1)"', "Cả hai lần 400 VALIDATION_ERROR (đã sửa: schema chỉ nhận http/https, 'Liên kết ảnh phải là http/https'; trước đây 201). Không tạo bài; bảng tin không có <img> hay script chạy (FE vẫn dùng safeUrl như lớp phòng thủ thứ hai).")
    F("Bảo mật nội dung", "Payload SQL injection trong tag, content, tham số category/sort/tag không làm hỏng truy vấn",
      "Bảo mật", "Cao", ACC,
      [login("member2"), "GET ?tag=' OR 1=1 --", "GET ?sort=popular;DROP TABLE \"Post\"", "POST bài content \"'; DROP TABLE \"Post\"; --\" và tags [\"x' OR '1'='1\"]"], "-",
      f"tag lạ: 200 data=[] (dùng tham số hóa). sort lạ: {E400V}. POST: 201, nội dung lưu như chữ. Danh sách vẫn đọc bình thường sau đó.")
    F("Bảo mật nội dung", "Tên hiển thị tác giả có ký tự HTML vẫn được escape",
      "Bảo mật", "Trung bình", ACC,
      ["Đăng nhập member1, đổi tên hồ sơ thành <i>Minh</i> (PATCH /api/me nếu có)", "Xem bài và bình luận của member1 trong bảng tin"], "firstName: <i>Minh</i>", "Tên hiển thị thành chữ có ký tự < >, không in nghiêng; sau test khôi phục tên gốc \"Minh\".")

    # ------------------------------------------------------------------ TRUY CẬP / KHÓA
    F("Phân quyền truy cập", "Không token: mọi route bảng tin trả 401",
      "Bảo mật", "Cao", SEED,
      ["Không gửi Authorization, gọi lần lượt: GET /courses/photo/posts, POST /courses/photo/posts, GET /posts/seed-post-photo-1, PATCH, DELETE, POST like/pin/hide/poll/vote, GET/POST comments, GET /courses/photo/tags"], "-", f"Mọi request: {E401}; token sai/hết hạn cùng kết quả.")
    F("Phân quyền truy cập", "Newbie (chưa tham gia) không đọc/đăng/like được bảng tin photo",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("newbie"), "GET /api/courses/photo/posts", "POST /api/courses/photo/posts", "GET /api/posts/seed-post-photo-1", "GET /api/courses/photo/tags"], 'Body: {"content":"x"}', f"Cả bốn: {E403M}. Không có bản ghi mới.")
    F("Phân quyền truy cập", "Banned (bị cấm khỏi photo) bị chặn mọi hành động bảng tin",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("banned"), "GET /api/courses/photo/posts", "POST bài", "POST like", "POST comments"], 'Body: {"content":"x"}', f"Cả bốn: {E403M} (banned không tính là thành viên). Bài đã đăng trước khi bị cấm (nếu có) không hiện ở bảng xếp hạng.")
    F("Phân quyền truy cập", "Platform Admin (admin) chưa ghi danh photo vẫn đọc bảng tin và ghim bài được",
      "Bảo mật", "Trung bình", SEED + " " + ACC,
      [login("admin"), "GET /api/courses/photo/posts", "POST /api/posts/seed-post-photo-1/pin (gọi lần 2 để bỏ ghim)"], "-", "GET posts 200 {data,meta}; pin 200 {pinned:true} (đã sửa: requireMembership cho qua Platform Admin, trước đây 403 'Bạn cần tham gia cộng đồng này trước'). GET /api/admin/reports vẫn 200. Admin không bị thêm vào danh sách thành viên.")
    F("Phân quyền truy cập", "Member yt (khác cộng đồng) không thao tác được bài của photo (IDOR chéo cộng đồng)",
      "Bảo mật", "Cao", SEED + " " + ACC + " member1 thuộc photo+yt+fin; dùng owner tạo cộng đồng thứ hai hoặc tài khoản chỉ ở cộng đồng khác.",
      ["Dùng tài khoản chỉ thuộc cộng đồng yt (không thuộc photo) gọi PATCH/DELETE /api/posts/seed-post-photo-1", "Gọi POST /api/courses/photo/posts"], "-", f"{E403M}; bài không đổi.")
    F("Phân quyền truy cập", "Cộng đồng bị khóa: thành viên thường 403 COMMUNITY_LOCKED ở mọi route bài; Platform Admin vẫn xem được",
      "Bảo mật", "Cao", SEED + " " + ACC,
      [login("admin"), "POST /api/admin/courses/photo/lock {\"reason\":\"Kiểm thử khóa\"}", login("member1"), "GET /api/courses/photo/posts, POST bài, POST like", login("admin"), "GET /api/courses/photo/posts", "Mở khóa: POST /api/admin/courses/photo/unlock"],
      'reason: "Kiểm thử khóa"', "member1: 403 code=\"COMMUNITY_LOCKED\", message \"Cộng đồng này đang bị khóa\" cho mọi request. Platform Admin: không bị chặn bởi khóa và cũng không cần ghi danh (200). Sau mở khóa member1 dùng lại bình thường.")
    F("Phân quyền truy cập", "Thành viên vừa bị cấm/kicked: token cũ không truy cập lại được bảng tin",
      "Bảo mật", "Trung bình", SEED + " " + ACC,
      [login("member3"), "owner/cadmin cấm member3 khỏi photo (POST /api/courses/photo/members/<id member3>/ban hoặc qua xử lý báo cáo ban_member)", "Dùng token cũ của member3 GET /api/courses/photo/posts"], "-", f"{E403M}; khôi phục dữ liệu seed sau test (unban + ghi danh lại).", pw="Một phần")

    # ------------------------------------------------------------------ SEED / ĐIỂM / KHÁC
    F("Dữ liệu seed bảng tin", "Hiển thị bài seed m1-image: ảnh, 3 thẻ, 5 like, 2 bình luận, tác giả member1",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("member2"), "GET /api/posts/seed-post-photo-m1-image"], "-",
      "category=\"Case study\", tags [\"#HoàngHôn\",\"#Portrait\",\"#ChiaSẻ\"], imageUrl là URL unsplash trong seed, likesCount=5, commentsCount=2, viewerLiked=true (member2 đã like), author.name=\"Minh Member1\".")
    F("Dữ liệu seed bảng tin", "Bài ghim seed của owner và bài ghim demo hiển thị với nhãn \"Đã ghim\" cho mọi thành viên",
      "Giao diện", "Trung bình", SEED + " " + ACC,
      ["Đăng nhập member3, mở /courses/photo/community"], "-", "Hai bài đầu có nhãn \"Đã ghim\": chào mừng (Thông báo) và \"Nội quy cộng đồng Nhiếp ảnh…\" (owner). Không có nút Sửa/Xóa/Ghim cho member3.")
    F("Dữ liệu seed bảng tin", "Bài ẩn seed + báo cáo đã xử lý: mod xem hàng đợi 'Đã xử lý' và 'Đang chờ'",
      "Chức năng", "Trung bình", SEED + " " + ACC,
      [login("mod"), "GET /api/courses/photo/reports?status=resolved", "GET ?status=open"], "-",
      "resolved có seed-report-photo-resolved (reason spam, action hide_content, ghi chú \"Đã ẩn bài quảng cáo.\"). open có seed-report-photo-open (reason inappropriate, người báo cáo Manh Member3).")
    F("Dữ liệu seed bảng tin", "Bài của cộng đồng khác (yt, fin) độc lập: mỗi cộng đồng có 4 bài minh họa, không lẫn sang photo",
      "Chức năng", "Thấp", SEED + " " + ACC,
      [login("member1"), "GET /api/courses/yt/posts và /api/courses/fin/posts"], "-", "Mỗi cộng đồng có bài id dạng seed-post-<courseId>-0..3 (bài 0 ghim); bài photo-only (m1-image...) không xuất hiện ở yt/fin.")
    F("Điểm thưởng", "Đăng bài +5, nhận like đầu +2; xóa bài không thu hồi điểm (hành vi hiện tại)",
      "Chức năng", "Trung bình", ACC,
      [login("member2"), "Ghi điểm; tạo bài (+5)", login("member3"), "like bài đó", login("member2"), "Ghi điểm (+2); xóa bài; ghi điểm lại"], "-",
      "Điểm member2 tăng +5 rồi +2; sau khi xóa bài điểm KHÔNG giảm (chưa chốt: có thu hồi điểm khi xóa bài hay không). Bảng xếp hạng phản ánh cùng số.")
    F("Điểm thưởng", "Đăng nhiều bài không bị giới hạn tốc độ/điểm mỗi ngày (ghi nhận rủi ro farm điểm)",
      "Bảo mật", "Thấp", ACC,
      [login("member2"), "Tạo 20 bài liên tiếp với nội dung khác nhau", "Đọc điểm"], "-", "Điểm tăng 100 (20 x 5); không có 429 (giá trị tạm, hiện chưa có trần điểm/ngày hay rate limit đăng bài).")
    F("Tương tác thời gian thực", "Bài mới của một người có xuất hiện ở người khác sau khi tải lại/refetch",
      "Tích hợp", "Thấp", ACC,
      ["Mở /courses/photo/community bằng member3 ở tab A", "member2 đăng bài bằng tab B", "Ở tab A tải lại hoặc đổi chip chuyên mục"], "-", "Bảng tin không có realtime cho bài (chỉ thông báo qua SSE); bài mới xuất hiện sau refetch/tải lại, đứng đầu nhóm thường.", pw="Một phần")

    # ================================================================== EVENT
    M, MN = "EVENT", "Lịch & Sự kiện"

    def E(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", status=DONE):
        add(M, MN, feature, title, ttype, prio, status, pre, steps, data, exp, pw=pw)

    ESEED = ("DB vừa seed sạch. Sự kiện photo: seed-event-photo-limited (Workshop chụp chân dung ngoài trời, host mod, +7 ngày, sức chứa 3, RSVP: member2 + 1 thành viên minh họa => còn 1 chỗ), "
             "seed-event-photo-full (Photowalk phố cổ, host owner, +3 ngày, sức chứa 2, đã đủ 2/2), "
             "seed-event-photo-past (Livestream chấm ảnh tháng trước, đã qua 7 ngày, RSVP member1 + member2 + 1 minh họa), "
             "và mỗi cộng đồng có seed-event-<id>-qa (Zoom Q&A, +5 ngày, sức chứa 100, 12 RSVP) + seed-event-<id>-practice (đã qua 3 ngày).")
    ISO = "startAt phải là ISO 8601 đầy đủ (vd 2030-01-15T13:00:00.000Z)"

    # ---------------- Tạo sự kiện
    E("Tạo sự kiện", "Mod tạo sự kiện đầy đủ: 201, thông báo event_created cho thành viên trừ người tạo",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("mod"), "POST /api/courses/photo/events", login("member1"), "GET /api/notifications"],
      'Body: {"title":"Photo meetup tháng 10","description":"Gặp mặt offline","startAt":"<now+10 ngày ISO>","timezone":"Asia/Ho_Chi_Minh","meetingLink":"https://meet.example.com/meetup","capacity":20}',
      "201; data có id, hostId=id mod, title, capacity=20, meetingLink, timezone. member1, member2, member3, owner, cadmin nhận thông báo type=event_created \"Sự kiện mới\" body `Sự kiện \"Photo meetup tháng 10\" vừa được tạo`, link /courses/photo/community/lich (đã sửa, trước đây /calendar không có route FE). mod (người tạo) không nhận.")
    E("Tạo sự kiện", "Tạo sự kiện chỉ với trường bắt buộc: giá trị mặc định",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("owner"), "POST chỉ {title, startAt}", "GET /api/events/<id>"], 'Body: {"title":"Chỉ có tên","startAt":"<now+2 ngày ISO>"}',
      "201; description=\"\", timezone=\"Asia/Ho_Chi_Minh\", không có meetingLink/capacity (không giới hạn); rsvpCount=0, viewerRsvped=false, isPast=false.")
    E("Tạo sự kiện", "Sửa lỗi phân quyền: member thường tạo sự kiện phải nhận 403",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      [login("member1"), "POST /api/courses/photo/events với payload hợp lệ", "GET /api/courses/photo/events kiểm tra không có sự kiện mới"], 'Body: {"title":"Member tự tạo","startAt":"<now+2 ngày ISO>"}',
      f"{E403R}; không có sự kiện mới, không ai nhận thông báo event_created. Lặp lại với member2, member3: cùng kết quả.")
    E("Tạo sự kiện", "Ma trận vai trò khi tạo sự kiện: guest, newbie, banned bị chặn; mod/cadmin/owner và Platform Admin (chưa ghi danh) được",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      ["Không token POST /api/courses/photo/events", "newbie, banned POST", "mod, cadmin, owner, admin (Platform Admin chưa ghi danh) POST"], 'Body: {"title":"Ma trận","startAt":"<now+3 ngày ISO>"}',
      f"Không token: {E401}. newbie, banned: {E403M} (kiểm tra thành viên chạy trước kiểm tra vai trò). mod, cadmin, owner, admin: 201 (4 sự kiện; đã sửa: admin nền tảng qua requireMembership, trước đây {E403M}).")
    E("Tạo sự kiện", "Tên sự kiện: trống/khoảng trắng bị 400; 160 ký tự OK; 161 ký tự bị 400",
      "Chức năng", "Cao", ACC,
      [login("mod"), "POST title=\"\"", "POST title=\"   \"", "POST title 160 ký tự", "POST title 161 ký tự"], "title: '' | '   ' | 'a'*160 | 'a'*161",
      f"Trống/khoảng trắng: {E400V} (\"Vui lòng nhập tên sự kiện\"). 160: 201. 161: {E400V}.")
    E("Tạo sự kiện", "startAt sai định dạng (thiếu, chuỗi tự do, không có timezone) bị 400",
      "Chức năng", "Cao", ACC,
      [login("mod"), "POST thiếu startAt", "POST startAt=\"ngày mai\"", "POST startAt=\"2030-01-15\"", "POST startAt=\"2030-01-15T20:00:00\" (không Z/offset)"], "-",
      f"Cả bốn: {E400V}; details có \"Thời gian không hợp lệ (ISO 8601)\" (với chuỗi không có Z hoặc offset hiện bị từ chối theo zod datetime mặc định).")
    E("Tạo sự kiện", "startAt ở quá khứ: API vẫn tạo được (không validate) và sự kiện hiển thị isPast=true",
      "Chức năng", "Cao", ACC,
      [login("mod"), "POST startAt = 1 giờ trước", "GET /api/events/<id>", "member1 POST /api/events/<id>/rsvp"], 'startAt: "<now-1h>Z"',
      "201 (BE không chặn ngày quá khứ — khác kỳ vọng nghiệp vụ, ghi nhận/chưa chốt); isPast=true; RSVP trả 400 \"Sự kiện đã diễn ra, không thể đăng ký\".")
    E("Tạo sự kiện", "Sức chứa: 0, âm, thập phân, chữ bị 400; số chuỗi '10' được ép kiểu thành 10; bỏ trống = không giới hạn",
      "Chức năng", "Cao", ACC,
      [login("mod"), "POST capacity=0", "POST capacity=-5", "POST capacity=2.5", "POST capacity=\"abc\"", "POST capacity=\"10\"", "POST không có capacity"], "capacity: 0 | -5 | 2.5 | 'abc' | '10' | (không gửi)",
      f"Bốn lần đầu: {E400V}. capacity=\"10\": 201 với capacity=10 (z.coerce). Không gửi: 201, capacity không có (không giới hạn).")
    E("Tạo sự kiện", "meetingLink phải là URL hợp lệ; link http/https, javascript: và chuỗi rỗng",
      "Chức năng", "Trung bình", ACC,
      [login("mod"), "POST meetingLink=\"zoom-so-1\"", "POST meetingLink=\"https://zoom.us/j/123\"", "POST meetingLink=\"\"", "POST meetingLink=\"javascript:alert(1)\""], "-",
      f"\"zoom-so-1\": {E400V} (\"Liên kết không hợp lệ\"). https: 201. Chuỗi rỗng: {E400V} khi gửi qua API (FE tự bỏ trường khi trống). javascript:: {E400V} (đã sửa: schema chỉ nhận http/https, 'Liên kết phải là http/https'; trước đây 201); không tạo sự kiện.")
    E("Tạo sự kiện", "Timezone: mặc định, giá trị IANA hợp lệ, và giá trị vô nghĩa (BE không kiểm tra)",
      "Chức năng", "Trung bình", ACC,
      [login("mod"), "POST không gửi timezone", "POST timezone=\"America/New_York\"", "POST timezone=\"Mars/Olympus\"", "POST timezone=\"   \""], "-",
      "Mặc định Asia/Ho_Chi_Minh. \"America/New_York\": 201 lưu nguyên. \"Mars/Olympus\": 201 (BE chỉ nhận chuỗi, không kiểm IANA — chưa chốt). Chuỗi khoảng trắng: sau trim thành rỗng vẫn được nhận ở tạo mới (khác PATCH yêu cầu min 1) — ghi nhận.")
    E("Tạo sự kiện", "Mô tả: 2000 ký tự OK, 2001 ký tự bị 400, trim khoảng trắng",
      "Chức năng", "Thấp", ACC,
      [login("mod"), "POST description 2000 ký tự", "POST description 2001 ký tự", "POST description \"  abc  \""], "-", f"2000: 201. 2001: {E400V}. \"  abc  \": lưu \"abc\".")
    E("Tạo sự kiện", "Tiêu đề/mô tả có HTML: lưu như chữ, không thực thi ở lịch và hộp thoại chi tiết",
      "Bảo mật", "Cao", ACC,
      [login("mod"), "Bắt dialog trình duyệt", "POST title \"<img src=x onerror=alert(1)>\" description \"<script>alert(2)</script>\"", "Mở /courses/photo/community/lich và bấm sự kiện"], "-",
      "201; giao diện hiển thị nguyên chuỗi dạng chữ, không có alert; tên xuất hiện đúng trong chip lịch và trong tiêu đề hộp thoại.")
    E("Tạo sự kiện", "Tạo sự kiện với body không phải JSON hoặc trống trả 400",
      "Chức năng", "Thấp", ACC,
      [login("mod"), "POST /api/courses/photo/events với body rỗng", "POST với Content-Type text/plain", "POST với body JSON cụt `{\"title\": `"], "-", f"Rỗng: {E400V} (title, startAt thiếu). text/plain: {E400V}. JSON cụt: 400 BAD_REQUEST 'Nội dung gửi lên không phải JSON hợp lệ' (đã sửa, trước đây 500). Không tạo sự kiện.")
    E("Tạo sự kiện", "Cộng đồng không tồn tại 404",
      "Chức năng", "Thấp", ACC,
      [login("owner"), "POST /api/courses/khong-co/events hợp lệ"], "-", "404 NOT_FOUND; không tạo sự kiện.")
    E("Tạo sự kiện", "UI: nút \"Tạo sự kiện\" chỉ hiện với mod+; form tạo thành công",
      "Giao diện", "Cao", ESEED + " " + ACC,
      ["Đăng nhập member1, mở /courses/photo/community/lich, quan sát thanh công cụ", "Đăng nhập mod, mở cùng trang", "Bấm \"Tạo sự kiện\", điền tên, thời gian, link họp, sức chứa, mô tả, bấm \"Tạo sự kiện\""], "Tên: Photo meetup tháng 10; Sức chứa: 20",
      "member1: không có nút \"Tạo sự kiện\". mod: form hiện, sau khi tạo toast \"Đã tạo sự kiện\", form đóng, sự kiện xuất hiện trên lịch đúng ngày.")
    E("Tạo sự kiện", "UI: form tạo sự kiện - trường bắt buộc và lỗi từ API hiển thị dạng chữ đỏ",
      "Giao diện", "Trung bình", ACC,
      ["Đăng nhập mod, mở form tạo", "Để trống tên rồi bấm tạo", "Nhập Link họp \"khong-phai-url\" và bấm tạo", "Nhập Sức chứa 0"], "-",
      "Tên trống hoặc chưa chọn thời gian: trình duyệt chặn (required), không gửi request. Link sai: lỗi API hiện chữ đỏ dưới form. Sức chứa 0: ô number min=1 chặn.")
    E("Tạo sự kiện", "Danh sách 200+ thành viên: chỉ tối đa 200 người nhận event_created (trừ người tạo)",
      "Hiệu năng", "Thấp", "Cộng đồng có > 201 thành viên (dùng cộng đồng seed lớn hoặc tạo script). " + ACC,
      [login("owner"), "Tạo sự kiện", "Đếm thông báo event_created theo sự kiện trong DB"], "-", "Đúng 200 thông báo được tạo (hằng số EVENT_CREATED_NOTIFY_LIMIT); người tạo không nhận.", pw="Không")

    # ---------------- Xem / Danh sách
    E("Xem sự kiện", "Danh sách sự kiện photo: sắp theo startAt tăng dần, rsvpCount/viewerRsvped/isPast đúng",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/events"], "-",
      "Có ít nhất 5 sự kiện: practice(đã qua 3 ngày, isPast=true), past(-7 ngày ...) đứng đầu theo thời gian; limited (rsvpCount=2/3, viewerRsvped=true, isPast=false), full (rsvpCount=2, capacity=2, viewerRsvped=false), qa (12 RSVP, capacity 100). Các số RSVP là bản ghi thật.")
    E("Xem sự kiện", "GET /events/:id trả chi tiết; sự kiện không tồn tại 404",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("member1"), "GET /api/events/seed-event-photo-limited", "GET /api/events/khong-co"], "-",
      "200; title \"Workshop chụp chân dung ngoài trời\", capacity=3, meetingLink=\"https://meet.example.com/photo-workshop\", hostId là id mod, rsvpCount=2, viewerRsvped=false. Lần 2: 404 \"Không tìm thấy sự kiện\".")
    E("Xem sự kiện", "Người ngoài cộng đồng, banned, khách không xem được sự kiện photo",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      ["newbie GET /api/courses/photo/events và /api/events/seed-event-photo-limited", "banned GET cùng", "không token GET cùng"], "-", f"newbie, banned: {E403M}. Không token: {E401}. Không lộ tiêu đề/link họp.")
    E("Xem sự kiện", "Cộng đồng bị khóa: thành viên thường 403 COMMUNITY_LOCKED khi xem lịch",
      "Bảo mật", "Trung bình", ESEED + " " + ACC,
      [login("admin"), "Khóa photo (POST /api/admin/courses/photo/lock {reason})", login("member1"), "GET /api/courses/photo/events", "Mở khóa lại"], "-", "member1: 403 code=\"COMMUNITY_LOCKED\", message \"Cộng đồng này đang bị khóa\". Sau mở khóa xem bình thường.")
    E("Xem sự kiện", "UI: tab Lịch sự kiện /courses/photo/community/lich hiển thị lịch tháng, sự kiện seed và sự kiện đã qua mờ",
      "Giao diện", "Cao", ESEED + " " + ACC,
      ["Đăng nhập member2, mở /courses/photo/community/lich", "Dùng nút Trước/Sau để tới tháng chứa các sự kiện +3, +7 ngày và -7 ngày", "Chuyển sang Tuần, Ngày"], "-",
      "Banner \"Lịch sự kiện\", nhãn \"GMT+7 • Hồ Chí Minh\". Sự kiện xuất hiện đúng ngày; sự kiện đã qua hiển thị mờ. Chuyển Tháng/Tuần/Ngày không mất sự kiện.")
    E("Xem sự kiện", "UI: bộ lọc \"Lọc sự kiện\": Tất cả / Sắp diễn ra / Tôi đã đăng ký",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đăng nhập member2, mở lịch", "Bấm \"Lọc sự kiện\" > \"Sắp diễn ra\"", "Chọn \"Tôi đã đăng ký\"", "Chọn \"Tất cả sự kiện\""], "-",
      "Sắp diễn ra: ẩn sự kiện đã qua. Tôi đã đăng ký: hiện limited và past (member2 đã RSVP), ẩn full. Tất cả: hiển thị đủ. Nút lọc đổi màu khi đang lọc.")
    E("Xem sự kiện", "UI: trạng thái rỗng - cộng đồng chưa có sự kiện hoặc bộ lọc không khớp",
      "Giao diện", "Trung bình", "Cộng đồng do owner vừa tạo (chưa có sự kiện) hoặc lọc \"Tôi đã đăng ký\" với member3 (chưa RSVP gì). " + ACC,
      ["Đăng nhập member3, mở /courses/photo/community/lich", "Chọn lọc \"Tôi đã đăng ký\"", "Duyệt các tháng"], "-",
      "Lưới lịch vẫn hiển thị, không có chip sự kiện, không lỗi/crash và không hiện trạng thái loading vô hạn (hiện chưa có dòng chữ 'Chưa có sự kiện' riêng — ghi nhận UX).")
    E("Xem sự kiện", "UI: hộp thoại chi tiết sự kiện hiển thị đủ thông tin và liên kết họp",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đăng nhập member1, mở lịch, bấm sự kiện \"Workshop chụp chân dung ngoài trời\""], "-", "Hộp thoại (role dialog) có tiêu đề, thời gian, mô tả, host, link họp (chỉ là link khi http/https), số đăng ký/sức chứa (2/3), nút \"Đăng ký tham gia\", \"Thêm vào lịch (.ics)\"; không có Sửa/Xóa.")

    # ---------------- Sửa / xóa
    E("Sửa sự kiện", "Mod sửa từng trường: title, description, startAt, timezone, meetingLink, capacity",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("mod"), "Tạo sự kiện mới", "PATCH lần lượt từng trường", "GET sự kiện"], 'VD {"title":"Tên mới"} rồi {"capacity":30} rồi {"timezone":"Asia/Bangkok"}',
      "Mỗi PATCH 200 và chỉ trường được gửi đổi; updatedAt cập nhật; rsvpCount giữ nguyên.")
    E("Sửa sự kiện", "Xóa meetingLink và capacity bằng null",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("owner"), "PATCH /api/events/seed-event-photo-limited {\"meetingLink\":null,\"capacity\":null}", "GET sự kiện"], 'Body: {"meetingLink":null,"capacity":null}',
      "200; meetingLink không còn, capacity không còn (không giới hạn); sự kiện cho phép RSVP không giới hạn. UI: để trống ô trong form Sửa cũng xóa.")
    E("Sửa sự kiện", "Giảm sức chứa xuống dưới số người đã RSVP bị 409",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("mod"), "PATCH seed-event-photo-limited {\"capacity\":1} (đang 2 RSVP)", "PATCH {\"capacity\":2}"], 'capacity: 1 rồi 2',
      "Lần 1: 409 CONFLICT, message \"Sức chứa không được nhỏ hơn số người đã đăng ký\"; capacity vẫn 3. Lần 2 (bằng số đã đăng ký): 200.")
    E("Sửa sự kiện", "PATCH body rỗng hoặc trường sai bị 400",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("mod"), "PATCH {}", "PATCH {\"title\":\"\"}", "PATCH {\"capacity\":0}", "PATCH {\"startAt\":\"mai\"}", "PATCH {\"timezone\":\"\"}", "PATCH {\"meetingLink\":\"abc\"}"], "-",
      f"Tất cả: {E400V} ({{}} có thông điệp \"Không có gì để cập nhật\"). Sự kiện không đổi.")
    E("Sửa sự kiện", "Member sửa/xóa sự kiện bị 403 (IDOR)",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      [login("member2"), "PATCH /api/events/seed-event-photo-limited {\"title\":\"Hack\"}", "DELETE /api/events/seed-event-photo-limited", "GET lại sự kiện"], "-", f"PATCH, DELETE: {E403R}; sự kiện, RSVP không đổi. Lặp với member1, member3.")
    E("Sửa sự kiện", "Ma trận vai trò sửa/xóa: newbie, banned 403 thành viên; mod, cadmin, owner và Platform Admin được",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      ["newbie PATCH sự kiện seed-event-photo-past", "banned DELETE", "không token PATCH", "admin (Platform Admin chưa ghi danh), mod, cadmin, owner mỗi người PATCH thay description"], "-", f"newbie, banned: {E403M}. Không token: {E401}. admin/mod/cadmin/owner: 200 (đã sửa: admin nền tảng qua requireMembership, trước đây {E403M}).")
    E("Sửa sự kiện", "Sửa/xóa sự kiện không tồn tại trả 404",
      "Chức năng", "Thấp", ACC,
      [login("mod"), "PATCH /api/events/khong-co {\"title\":\"x\"}", "DELETE /api/events/khong-co"], "-", "Cả hai 404 \"Không tìm thấy sự kiện\".")
    E("Sửa sự kiện", "Đổi giờ bắt đầu sang giờ mới: RSVP giữ nguyên, người xem thấy giờ mới",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("mod"), "PATCH seed-event-photo-limited startAt = +8 ngày", login("member2"), "GET sự kiện"], 'startAt: "<now+8 ngày ISO>"', "200; member2 vẫn viewerRsvped=true, rsvpCount=2, startAt mới; sự kiện chuyển sang ngày mới trên lịch. (Hiện không gửi thông báo 'sự kiện đổi giờ' cho người đã RSVP — ghi nhận.)")
    E("Sửa sự kiện", "UI: mod sửa sự kiện qua form \"Sửa sự kiện\", toast và lỗi 409 hiện trong form",
      "Giao diện", "Cao", ESEED + " " + ACC,
      ["Đăng nhập mod, mở lịch, bấm sự kiện \"Workshop chụp chân dung ngoài trời\" > \"Sửa\"", "Đặt Sức chứa 1, bấm lưu", "Đặt Sức chứa 5, xóa Link họp (để trống), bấm lưu"], "-",
      "Bước 2: chữ đỏ \"Sức chứa không được nhỏ hơn số người đã đăng ký\" trong form (placeholder ghi đã có 2 đăng ký). Bước 3: toast \"Đã cập nhật sự kiện\", link họp biến mất.")
    E("Xóa sự kiện", "Xóa sự kiện: người đã RSVP nhận thông báo \"Sự kiện đã bị hủy\", RSVP bị xóa",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member1"), "member1 và member3 RSVP một sự kiện mới do mod tạo", login("mod"), "DELETE /api/events/<id>", login("member1"), "GET /api/notifications", "GET /api/events/<id>"], "-",
      "DELETE 200 {deleted:true}. member1, member3 nhận thông báo type=system, title \"Sự kiện đã bị hủy\", body `Sự kiện \"<tên>\" đã bị hủy`, link /courses/photo/community/lich (đã sửa, trước đây /calendar). member2 (không RSVP) không nhận. GET sự kiện -> 404.")
    E("Xóa sự kiện", "Xóa sự kiện xóa luôn RSVP (CASCADE); xóa lần 2 trả 404",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("owner"), "DELETE /api/events/seed-event-photo-full", "DELETE lần 2", "GET /api/courses/photo/events"], "-", "Lần 1: 200. Lần 2: 404. Danh sách không còn sự kiện; bản ghi EventRsvp của sự kiện đó bị xóa.")
    E("Xóa sự kiện", "UI: xóa sự kiện có hộp thoại xác nhận \"Xóa sự kiện?\" và toast",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đăng nhập mod, mở lịch, bấm sự kiện > \"Xóa\"", "Bấm hủy", "Xóa lại và bấm \"Xóa sự kiện\""], "-", "Hủy: sự kiện còn. Xác nhận: toast \"Đã xóa sự kiện\", chip biến khỏi lịch.")

    # ---------------- RSVP
    E("Đăng ký tham dự (RSVP)", "RSVP thành công: rsvped=true, rsvpCount +1, cộng 1 điểm event_rsvp",
      "Chức năng", "Cao", ESEED + " " + ACC + " Ghi điểm member1.",
      [login("member1"), "POST /api/events/seed-event-photo-limited/rsvp", "GET /api/me/points"], "-", "200 {rsvped:true, rsvpCount:3}; member1 +1 điểm (reason event_rsvp); sự kiện giờ đầy 3/3.")
    E("Đăng ký tham dự (RSVP)", "POST rsvp là toggle: gọi lần 2 sẽ hủy đăng ký",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member2"), "POST /api/events/seed-event-photo-limited/rsvp (member2 đã RSVP ở seed)"], "-", "200 {rsvped:false, rsvpCount:1}. Ghi nhận: tài liệu ghi 'toggle, giữ nguyên' nhưng hành vi thực tế là toggle hủy; nên dùng DELETE để hủy tường minh.")
    E("Đăng ký tham dự (RSVP)", "DELETE rsvp hủy tường minh và idempotent",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member2"), "DELETE /api/events/seed-event-photo-limited/rsvp", "DELETE lần 2", login("member3"), "DELETE khi chưa RSVP"], "-", "Lần 1: 200 {rsvped:false, rsvpCount:1}. Lần 2 và member3: vẫn 200 {rsvped:false} với rsvpCount không đổi (không lỗi).")
    E("Đăng ký tham dự (RSVP)", "Chỗ cuối: người thứ 3 vào được, người thứ 4 nhận 409",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member1"), "RSVP seed-event-photo-limited (chỗ cuối, 3/3)", login("member3"), "RSVP cùng sự kiện"], "-", "member1: 200 {rsvped:true, rsvpCount:3}. member3: 409 CONFLICT, message \"Sự kiện đã đủ số lượng đăng ký\"; rsvpCount vẫn 3.")
    E("Đăng ký tham dự (RSVP)", "Sự kiện đã đầy sẵn (seed full 2/2): member RSVP nhận 409",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member1"), "POST /api/events/seed-event-photo-full/rsvp", "GET sự kiện"], "-", "409 \"Sự kiện đã đủ số lượng đăng ký\"; rsvpCount=2, viewerRsvped=false.")
    E("Đăng ký tham dự (RSVP)", "Race: hai người RSVP đồng thời vào chỗ cuối, đúng 1 người thành công",
      "Tích hợp", "Cao", ESEED + " " + ACC,
      [login("member1") + " và " + login("member3") + " (2 token)", "Gửi song song POST /api/events/seed-event-photo-limited/rsvp bằng cả hai token", "GET sự kiện"], "2 request cùng lúc",
      "Một 200 {rsvped:true, rsvpCount:3}, một 409 \"Sự kiện đã đủ số lượng đăng ký\"; rsvpCount cuối = 3 (không vượt sức chứa) nhờ khóa hàng FOR UPDATE.", pw="Một phần")
    E("Đăng ký tham dự (RSVP)", "Race: sức chứa 3, 8 người RSVP cùng lúc, đúng 3 vào",
      "Tích hợp", "Trung bình", ESEED + " " + ACC + " Tạo sự kiện mới sức chứa 3 và 8 tài khoản (dùng đăng ký nhanh hoặc script).",
      ["8 token cùng gửi POST rsvp song song", "Đếm kết quả"], "8 request", "Đúng 3 phản hồi 200 rsvped:true và 5 phản hồi 409; rsvpCount=3.", pw="Không")
    E("Đăng ký tham dự (RSVP)", "Người đã RSVP hủy khi sự kiện đầy để nhường chỗ, người khác RSVP được ngay",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("member2"), "DELETE rsvp seed-event-photo-limited", login("member1"), "RSVP", login("member3"), "RSVP"], "-", "member1: 200 (chỗ trống nhờ member2 hủy). member3: 200 nếu còn chỗ, 409 nếu đủ 3. rsvpCount không vượt 3.")
    E("Đăng ký tham dự (RSVP)", "Sự kiện đã qua: RSVP bị 400 \"Sự kiện đã diễn ra, không thể đăng ký\"",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member3"), "POST /api/events/seed-event-photo-past/rsvp"], "-", "400 BAD_REQUEST, message \"Sự kiện đã diễn ra, không thể đăng ký\"; rsvpCount giữ 3; không cộng điểm. UI: nhãn \"Đã diễn ra\", nút đăng ký bị khóa.")
    E("Đăng ký tham dự (RSVP)", "Sự kiện đã qua: người đã RSVP vẫn gọi được DELETE rsvp, POST toggle bị chặn",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("member1"), "POST /api/events/seed-event-photo-past/rsvp (đang RSVP ở seed)", "DELETE /api/events/seed-event-photo-past/rsvp"], "-", "POST: 400 (hủy bằng toggle cũng bị chặn). DELETE: 200 {rsvped:false, rsvpCount:2} (hủy tường minh không kiểm ngày — ghi nhận).")
    E("Đăng ký tham dự (RSVP)", "RSVP sự kiện không tồn tại trả 404; DELETE rsvp không tồn tại cũng 404",
      "Chức năng", "Thấp", ACC,
      [login("member1"), "POST /api/events/khong-co/rsvp", "DELETE /api/events/khong-co/rsvp"], "-", "Cả hai 404 \"Không tìm thấy sự kiện\".")
    E("Đăng ký tham dự (RSVP)", "RSVP bởi người ngoài cộng đồng/banned/khách bị chặn; Platform Admin chưa ghi danh vẫn RSVP được",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      ["newbie POST /api/events/seed-event-photo-limited/rsvp", "banned POST", "không token POST", "admin POST (rồi POST lần 2 để hủy chỗ)"], "-", f"newbie, banned: {E403M}. Không token: {E401}. rsvpCount không đổi sau 3 lần trên. admin: 200 {{rsvped:true}} (đã sửa: requireMembership cho qua Platform Admin; trước đây {E403M}), lần 2 hủy chỗ.")
    E("Đăng ký tham dự (RSVP)", "RSVP + hủy nhiều lần cộng điểm mỗi lần đăng ký (ghi nhận rủi ro farm điểm)",
      "Bảo mật", "Thấp", ESEED + " " + ACC,
      [login("member3"), "Ghi điểm; RSVP rồi hủy (DELETE) 5 lần trên sự kiện sức chứa lớn (seed-event-photo-qa)", "Đọc điểm"], "-", "Điểm tăng +5 (1 điểm mỗi lần RSVP, không thu hồi khi hủy, không dedupe) — hành vi tạm, chưa chốt.")
    E("Đăng ký tham dự (RSVP)", "UI: hộp thoại chi tiết - đăng ký, đổi nhãn 'Đã đăng ký — bấm để hủy', hủy",
      "Giao diện", "Cao", ESEED + " " + ACC,
      ["Đăng nhập member3, mở lịch, bấm \"Workshop chụp chân dung ngoài trời\"", "Bấm \"Đăng ký tham dự\"", "Bấm lại nút \"Đã đăng ký — bấm để hủy\""], "-", "Sau bước 2: nút đổi nhãn, số đăng ký 3/3, nhãn \"Đã đầy chỗ\" xuất hiện cho người khác. Sau bước 3: quay lại 2/3 và \"Đăng ký tham dự\".")
    E("Đăng ký tham dự (RSVP)", "UI: sự kiện đầy chỗ khóa nút với nhãn \"Đã đầy chỗ\"; lỗi 409 hiện đỏ khi đầy giữa chừng",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đăng nhập member3, mở sự kiện \"Photowalk phố cổ (đã đủ người)\"", "Xác nhận nút; ở tab khác cho member1 RSVP chỗ cuối của Workshop rồi để member3 bấm đăng ký Workshop với dữ liệu cũ"], "-", "Photowalk: nhãn đỏ \"Đã đầy chỗ\", nút vô hiệu. Trường hợp đầy giữa chừng: chữ đỏ \"Sự kiện đã đủ số lượng đăng ký\" dưới nút.", pw="Một phần")

    # ---------------- ICS
    E("Xuất lịch (.ics)", "Tải .ics một sự kiện: header Content-Type, Content-Disposition và nội dung cơ bản",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member1"), "GET /api/events/seed-event-photo-limited/ics, xem response headers và body"], "-",
      "200; Content-Type: text/calendar; charset=utf-8; Content-Disposition: attachment; filename=\"event-seed-event-photo-limited.ics\". Body bắt đầu BEGIN:VCALENDAR, VERSION:2.0, PRODID:-//SofinHub//Community Events//VI, CALSCALE:GREGORIAN, METHOD:PUBLISH, X-WR-CALNAME có tên sự kiện; kết thúc END:VCALENDAR; dùng CRLF.")
    E("Xuất lịch (.ics)", "Nội dung VEVENT: UID ổn định, DTSTART/DTEND UTC (+1 giờ), SUMMARY, LOCATION, DESCRIPTION có host và múi giờ",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member1"), "GET /api/events/seed-event-photo-limited/ics", "Giải mã (unfold) các dòng"], "-",
      "UID:seed-event-photo-limited@sofinhub; DTSTART dạng YYYYMMDDTHHMMSSZ khớp startAt (UTC); DTEND = DTSTART + 1 giờ; SUMMARY:Workshop chụp chân dung ngoài trời; LOCATION là meetingLink; DESCRIPTION gồm mô tả, \"Người tổ chức: Mia Moderator\", \"Liên kết: ...\", \"Múi giờ gốc: Asia/Ho_Chi_Minh\" (xuống dòng thành \\n); có SEQUENCE.")
    E("Xuất lịch (.ics)", "Tiêu đề chứa ký tự đặc biệt được escape đúng RFC 5545 (dấu ; , \\ và xuống dòng)",
      "Chức năng", "Cao", ACC,
      [login("mod"), "POST sự kiện title \"Họp; nhóm, A\\B\" và description có 2 dòng", "GET /api/events/<id>/ics"], 'title: "Họp; nhóm, A\\B" ; description: "Dòng 1\\nDòng 2"',
      "SUMMARY:Họp\\; nhóm\\, A\\\\B ; DESCRIPTION chứa \"Dòng 1\\nDòng 2\" (xuống dòng thành ký tự \\n, không xuống dòng thật); import vào Google/Apple Calendar hiển thị đúng tiêu đề gốc.")
    E("Xuất lịch (.ics)", "Tiêu đề dài và tiếng Việt: gập dòng ≤ 75 octet, không cắt ngang ký tự UTF-8",
      "Chức năng", "Trung bình", ACC,
      [login("mod"), "Tạo sự kiện title dài 150 ký tự tiếng Việt có dấu (ví dụ lặp \"Đêm nhạc Hà Nội\")", "GET .ics", "Kiểm tra từng dòng"], "-",
      "Mỗi dòng ≤ 75 byte; dòng gập bắt đầu bằng 1 khoảng trắng; ghép lại không mất/vỡ dấu tiếng Việt; import không lỗi.")
    E("Xuất lịch (.ics)", "Tiêu đề chứa HTML/CRLF/ký tự điều khiển không chèn được dòng iCal mới (header injection)",
      "Bảo mật", "Cao", ACC,
      [login("mod"), "Tạo sự kiện title \"A\\r\\nATTENDEE:mailto:x@y\" (qua API, JSON \\r\\n)", "GET .ics"], "-", "Xuống dòng bị escape thành \\n bên trong SUMMARY; không xuất hiện dòng ATTENDEE độc lập trong file.")
    E("Xuất lịch (.ics)", ".ics cả cộng đồng: mọi sự kiện photo trong một VCALENDAR, tên tệp và tên lịch",
      "Chức năng", "Cao", ESEED + " " + ACC,
      [login("member2"), "GET /api/courses/photo/events.ics"], "-", "200; Content-Type text/calendar; charset=utf-8; Content-Disposition filename=\"photo-events.ics\"; X-WR-CALNAME chứa \"SofinHub — \" + tên khóa photo; số VEVENT bằng số sự kiện của GET /courses/photo/events, mỗi UID duy nhất.")
    E("Xuất lịch (.ics)", ".ics của cộng đồng chưa có sự kiện: lịch rỗng hợp lệ",
      "Chức năng", "Thấp", "Cộng đồng mới do owner tạo, chưa có sự kiện. " + ACC,
      [login("owner"), "GET /api/courses/<id>/events.ics"], "-", "200; file chỉ có BEGIN/END:VCALENDAR và header, 0 VEVENT; import không lỗi.")
    E("Xuất lịch (.ics)", ".ics: người ngoài cộng đồng, banned, khách và sự kiện không tồn tại",
      "Bảo mật", "Cao", ESEED + " " + ACC,
      ["newbie GET /api/events/seed-event-photo-limited/ics", "banned GET /api/courses/photo/events.ics", "không token GET .ics", "member1 GET /api/events/khong-co/ics"], "-", f"newbie, banned: {E403M}. Không token: {E401}. Sự kiện không có: 404 \"Không tìm thấy sự kiện\".")
    E("Xuất lịch (.ics)", "Đường dẫn events.ics không bị nuốt bởi route /events/:id (thứ tự route)",
      "Tích hợp", "Thấp", ESEED + " " + ACC,
      [login("member1"), "GET /api/courses/photo/events.ics", "GET /api/courses/photo/events"], "-", "events.ics trả text/calendar (không phải JSON lỗi 404); events trả JSON danh sách.")
    E("Xuất lịch (.ics)", "Sửa sự kiện rồi tải lại .ics: SEQUENCE/DTSTART cập nhật, UID giữ nguyên",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("mod"), "Tải .ics của sự kiện A", "PATCH title và startAt", "Tải .ics lại và so sánh"], "-", "UID không đổi; SUMMARY, DTSTART đổi; SEQUENCE tăng (dựa vào updatedAt) để ứng dụng lịch nhận biết bản cập nhật.")
    E("Xuất lịch (.ics)", "Xóa sự kiện không phát METHOD:CANCEL cho lịch đã nhập (giới hạn đã biết)",
      "Chức năng", "Thấp", ESEED + " " + ACC,
      [login("mod"), "Nhập .ics vào lịch ngoài", "Xóa sự kiện trên hệ thống", "Kiểm tra lịch ngoài"], "-", "Sự kiện vẫn còn trong lịch ngoài (tài liệu ghi rõ chưa hỗ trợ CANCEL); .ics cộng đồng tải lại thì không còn VEVENT đó.", pw="Không")
    E("Xuất lịch (.ics)", "UI: nút \"Thêm vào lịch (.ics)\" và \"Đăng ký lịch cả cộng đồng\" tải đúng tệp và toast",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đăng nhập member2, mở lịch", "Mở chi tiết sự kiện > \"Thêm vào lịch (.ics)\"", "Đóng, bấm \"Đăng ký lịch cả cộng đồng\""], "-", "Bước 2: tải tệp .ics, toast \"Đã tải file lịch (.ics)\". Bước 3: tải tệp lịch cả cộng đồng, toast \"Đã tải lịch cộng đồng (.ics)\". Không mở tab mới (token gửi qua header).")

    # ---------------- Nhắc lịch
    E("Nhắc lịch", "Nhắc lịch: người đã RSVP nhận event_reminder khi còn ≤ 60 phút",
      "Tích hợp", "Cao", "Backend dev đang chạy (bộ nhắc lịch chạy mỗi 60 giây, tắt khi NODE_ENV=test). " + ACC,
      [login("mod"), "Tạo sự kiện startAt = now + 30 phút", login("member1"), "RSVP sự kiện", "Đợi tối đa 70 giây", "GET /api/notifications"], "startAt = now + 30 phút",
      "member1 nhận thông báo type=event_reminder, title \"Sự kiện sắp diễn ra\", body `\"<tên>\" sẽ bắt đầu trong khoảng ~30 phút nữa` (số phút làm tròn), link /courses/photo/community/lich (đã sửa, trước đây /calendar).", pw="Một phần")
    E("Nhắc lịch", "Chống trùng: nhiều lần chạy bộ nhắc vẫn chỉ nhắc mỗi (sự kiện, user) một lần",
      "Tích hợp", "Cao", "Như trên. " + ACC,
      ["Sau khi member1 nhận nhắc, đợi thêm 3 chu kỳ (~3 phút)", "GET /api/notifications lọc type=event_reminder cho sự kiện đó"], "-", "Vẫn đúng 1 thông báo event_reminder cho member1 với sự kiện đó (cột remindedAt được ghi).", pw="Một phần")
    E("Nhắc lịch", "Chỉ người đã RSVP được nhắc; người không RSVP hoặc đã hủy không nhận",
      "Tích hợp", "Cao", "Như trên. " + ACC,
      ["Tạo sự kiện +30 phút; member1, member2 RSVP; member2 hủy trước chu kỳ nhắc", "Đợi chu kỳ", "Đọc thông báo của member1, member2, member3"], "-", "Chỉ member1 nhận event_reminder; member2 (đã hủy) và member3 (không RSVP) không nhận.", pw="Một phần")
    E("Nhắc lịch", "Sự kiện còn > 60 phút chưa nhắc; đã bắt đầu không nhắc",
      "Tích hợp", "Trung bình", "Như trên. " + ACC,
      ["Tạo sự kiện A (+90 phút) và B (+5 giây sau đó để qua thời điểm), có RSVP", "Đợi 2 chu kỳ", "Đọc thông báo"], "-", "A: chưa có nhắc. B (đã bắt đầu): không nhắc. Khi A chỉ còn ≤ 60 phút mới nhận nhắc.", pw="Một phần")
    E("Nhắc lịch", "Đổi giờ bắt đầu xóa dấu đã nhắc: nhắc lại theo giờ mới",
      "Tích hợp", "Trung bình", "Như trên. " + ACC,
      ["Sự kiện +30 phút, member1 RSVP, đợi nhận nhắc lần 1", "mod PATCH startAt = now + 40 phút", "Đợi chu kỳ tiếp theo"], "-", "member1 nhận thêm 1 nhắc mới (tổng 2 thông báo event_reminder cho sự kiện này) vì đổi startAt gọi clearReminded.", pw="Một phần")
    E("Nhắc lịch", "Hủy RSVP rồi RSVP lại sau khi đã nhắc: nhận nhắc lần nữa (ghi nhận điểm yếu chống trùng)",
      "Tích hợp", "Thấp", "Như trên. " + ACC,
      ["Sự kiện +30 phút, member1 RSVP, nhận nhắc", "member1 DELETE rsvp rồi POST rsvp lại", "Đợi chu kỳ"], "-", "Do bản ghi RSVP được tạo mới (remindedAt rỗng) nên member1 có thể nhận nhắc lần 2 — chưa chốt có cần chặn hay không.", pw="Một phần")
    E("Nhắc lịch", "Xóa sự kiện trước giờ nhắc: không có nhắc, chỉ có thông báo hủy",
      "Tích hợp", "Trung bình", "Như trên. " + ACC,
      ["Sự kiện +30 phút, member1 RSVP", "mod xóa sự kiện ngay", "Đợi chu kỳ"], "-", "member1 nhận thông báo \"Sự kiện đã bị hủy\" và không nhận event_reminder.", pw="Một phần")
    E("Nhắc lịch", "Thông báo hiển thị ở chuông và SSE realtime cho event_reminder",
      "Giao diện", "Trung bình", "Như trên. " + ACC,
      ["member1 mở giao diện bất kỳ đang đăng nhập (SSE mở)", "Chờ chu kỳ nhắc", "Quan sát chuông/danh sách thông báo"], "-", "Số chưa đọc tăng, thông báo \"Sự kiện sắp diễn ra\" xuất hiện không cần tải lại; bấm vào mở /courses/photo/community/lich (tab Lịch sự kiện).", pw="Một phần")
    E("Nhắc lịch", "Nhắc lịch qua email trước giờ sự kiện",
      "Tích hợp", "Thấp", "Chưa làm: gửi email nhắc lịch (chỉ có thông báo trong ứng dụng; email thật chưa tích hợp). " + ACC,
      ["RSVP một sự kiện", "Chờ tới trước giờ 1 giờ", "Kiểm tra hộp thư"], "-", "(Dự kiến) Người đã RSVP nhận email nhắc; hiện chỉ có event_reminder trong ứng dụng.", pw="Không", status=PLAN)
    E("Nhắc lịch", "Chạy nhiều instance backend không nhắc trùng (claimReminders atomic)",
      "Tích hợp", "Thấp", "Có thể chạy 2 tiến trình backend cùng DB. " + ACC,
      ["Chạy 2 backend, tạo sự kiện +30 phút, member1 RSVP", "Đợi 2 chu kỳ", "Đếm thông báo"], "-", "Đúng 1 thông báo event_reminder (UPDATE ... WHERE remindedAt IS NULL RETURNING).", pw="Không")

    # ---------------- Điểm thưởng & thông báo khác
    E("Thông báo sự kiện", "Thành viên nhận event_created, bấm thông báo mở tab lịch",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["mod tạo sự kiện mới", "member2 mở chuông thông báo", "Bấm thông báo \"Sự kiện mới\""], "-", "BE gắn link /courses/photo/community/lich (đã sửa; trước đây /courses/photo/calendar không có route FE nên ra 404). Kết quả mong đợi: bấm thông báo mở được tab Lịch sự kiện, không ra trang 404. Nếu ra 404/trống thì ghi lỗi hồi quy.", pw="Một phần")
    E("Thông báo sự kiện", "Thành viên tắt thông báo sự kiện trong tùy chọn: không nhận event_created",
      "Chức năng", "Thấp", ESEED + " " + ACC,
      [login("member2"), "PUT /api/notifications/preferences tắt event_created (nếu có trong danh mục)", login("mod"), "Tạo sự kiện", login("member2"), "GET /api/notifications"], "-", "member2 không nhận thông báo event_created; member1 (không tắt) vẫn nhận.", pw="Một phần")

    # ---------------- Múi giờ, seed, UI
    E("Múi giờ", "Giờ sự kiện hiển thị theo múi giờ trình duyệt của người xem (GMT+7 vs khác)",
      "Giao diện", "Trung bình", ESEED + " " + ACC,
      ["Đặt múi giờ trình duyệt/OS là Asia/Ho_Chi_Minh, mở lịch, ghi giờ sự kiện seed-event-photo-full (20:00)", "Đổi múi giờ sang America/New_York (Playwright timezoneId), tải lại"], "-", "startAt (UTC ISO) không đổi; giờ hiển thị đổi tương ứng (20:00 GMT+7 => 09:00 New York); vẫn ghi nhãn \"GMT+7 • Hồ Chí Minh\" cố định ở thanh công cụ (ghi nhận: nhãn không theo múi giờ người xem).")
    E("Múi giờ", "Sự kiện lưu timezone khác: .ics vẫn dùng UTC, múi giờ gốc trong DESCRIPTION",
      "Chức năng", "Trung bình", ACC,
      [login("mod"), "Tạo sự kiện startAt=2030-06-01T13:00:00.000Z timezone=\"America/New_York\"", "GET .ics"], "-", "DTSTART:20300601T130000Z; DESCRIPTION có \"Múi giờ gốc: America/New_York\"; không có VTIMEZONE (giới hạn đã biết).")
    E("Múi giờ", "Sự kiện lúc 00:00 và 23:59 giờ địa phương hiển thị đúng ngày trên lịch tháng",
      "Giao diện", "Thấp", ACC,
      ["mod tạo 2 sự kiện: 00:00 và 23:59 giờ Việt Nam cùng một ngày (UTC tương ứng)", "Mở lịch tháng và ngày"], "-", "Cả hai nằm đúng ngày dự kiến theo giờ địa phương của người xem, không nhảy sang ngày trước/sau.")
    E("Kịch bản seed sự kiện", "Seed: kịch bản 'chỗ cuối' cho seed-event-photo-limited: member1 vào, member3 bị từ chối",
      "Chức năng", "Cao", ESEED + " " + ACC,
      ["member1 RSVP seed-event-photo-limited (thành công, 3/3)", "member3 RSVP (409)", "member2 hủy RSVP", "member3 RSVP lại (thành công)"], "-", "Lần lượt 200, 409 \"Sự kiện đã đủ số lượng đăng ký\", 200 {rsvped:false}, 200 {rsvped:true}; sau cùng rsvpCount=3.")
    E("Kịch bản seed sự kiện", "Seed: sự kiện đầy (photo-full) - danh sách hiển thị đủ chỗ, host là owner",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("member2"), "GET /api/events/seed-event-photo-full"], "-", "title \"Photowalk phố cổ (đã đủ người)\", capacity=2, rsvpCount=2, viewerRsvped=false, isPast=false, meetingLink https://meet.example.com/photowalk.")
    E("Kịch bản seed sự kiện", "Seed: sự kiện đã qua (photo-past) - isPast=true, member1/member2 từng tham gia (viewerRsvped=true)",
      "Chức năng", "Trung bình", ESEED + " " + ACC,
      [login("member1"), "GET /api/events/seed-event-photo-past"], "-", "isPast=true, rsvpCount=3, viewerRsvped=true; title \"Livestream chấm ảnh tháng trước\".")
    E("Kịch bản seed sự kiện", "Seed: mọi cộng đồng khác có Zoom Q&A (+5 ngày, sức chứa 100) và buổi thực hành đã qua",
      "Chức năng", "Thấp", ESEED + " " + ACC,
      [login("member1"), "GET /api/courses/yt/events"], "-", "2 sự kiện: seed-event-yt-qa (capacity 100, rsvpCount 12) và seed-event-yt-practice (isPast=true, rsvpCount 8); host là thành viên minh họa số 0.")
    E("Kịch bản seed sự kiện", "Chạy lại seed không nhân đôi sự kiện/RSVP",
      "Tích hợp", "Thấp", ESEED,
      ["Đếm CommunityEvent, EventRsvp", "Chạy lại npm run db:seed", "Đếm lại"], "-", "Số bản ghi không đổi (id xác định + skipDuplicates); RSVP mới do người dùng thêm không bị ghi đè.", pw="Không")

    # ---------------- Tích hợp khác
    E("Tích hợp sự kiện", "Danh sách sự kiện photo gọi nhanh: N sự kiện không sinh N truy vấn (rsvpCounts gom lô)",
      "Hiệu năng", "Thấp", "Có ≥ 100 sự kiện trong photo. " + ACC,
      [login("member1"), "Đo thời gian GET /api/courses/photo/events"], "-", "Thời gian < 500ms (giá trị tạm); rsvpCount/viewerRsvped đúng cho từng sự kiện.", pw="Không")
    E("Tích hợp sự kiện", "Điều hướng từ Header/Sidebar tới tab Lịch sự kiện đúng route",
      "Giao diện", "Thấp", ACC,
      ["Đăng nhập member1, mở /courses/photo/community", "Bấm mục \"Lịch sự kiện\" trong sidebar cộng đồng"], "-", "URL đổi thành /courses/photo/community/lich, tab được đánh dấu đang chọn, lịch hiển thị.")
    E("Tích hợp sự kiện", "Khách chưa đăng nhập mở /courses/photo/community/lich",
      "Bảo mật", "Trung bình", ACC,
      ["Mở trình duyệt ẩn danh, vào /courses/photo/community/lich"], "-", "Bị chuyển tới trang đăng nhập/không thấy dữ liệu sự kiện; API events trả 401 nếu gọi thẳng.")
    E("Tích hợp sự kiện", "Nhắc-lỗi mạng: tạo sự kiện thất bại (mất mạng) hiển thị lỗi và không tạo trùng khi thử lại",
      "Giao diện", "Thấp", ACC,
      ["Đăng nhập mod, mở form tạo, điền dữ liệu", "Bật chế độ offline của DevTools, bấm tạo", "Tắt offline, bấm tạo lại"], "-", "Lần 1 báo lỗi chữ đỏ, form giữ nguyên dữ liệu; lần 2 chỉ tạo đúng 1 sự kiện.", pw="Một phần")
    E("Tích hợp sự kiện", "Người vừa bị cấm mất quyền: sự kiện đã RSVP không còn truy cập được",
      "Bảo mật", "Thấp", ESEED + " " + ACC,
      [login("member3"), "RSVP một sự kiện", "Cấm member3 khỏi photo (owner)", "member3 GET /api/events/<id> và DELETE rsvp"], "-", f"{E403M}; RSVP cũ không tự xóa (tùy chọn dọn dẹp — ghi nhận); khôi phục dữ liệu seed sau test.", pw="Một phần")
    E("Tích hợp sự kiện", "Điểm rsvp của thành viên bị cấm không tính vào bảng xếp hạng",
      "Chức năng", "Thấp", ESEED + " " + ACC,
      ["member3 RSVP (+1 điểm), sau đó bị cấm", "GET /api/courses/photo/leaderboard"], "-", "member3 không còn trong bảng xếp hạng photo (totalsByCourse loại người bị cấm).", pw="Một phần")
