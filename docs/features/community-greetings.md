# Lời chào thành viên mới & thông báo popup

Chủ / admin cộng đồng: **Cài đặt > Lời chào & thông báo**. API: `backend/docs/api/community-greetings.md`.

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | `owner` mở `/communities/photo/community/cai-dat?tab=greetings`, nhập lời chào có `{ten}`, `{cong_dong}`, danh sách "1. …", bật, Lưu | Xem trước hiện đúng tên + tên cộng đồng, danh sách đánh số |
| 2 | `newbie` tham gia `photo` rồi vào trang cộng đồng | Popup tin nhắn của Olivia Owner (nhãn "Chủ cộng đồng"), nút "Nhắn tin cho Olivia Owner" (mở Tin nhắn) và "Bắt đầu thôi" |
| 3 | `newbie` tải lại trang | Không hiện lời chào nữa |
| 4 | `newbie` rời cộng đồng rồi tham gia lại | Không hiện lời chào |
| 5 | `member1` (đã tham gia từ trước khi bật) vào trang cộng đồng | Không hiện lời chào |
| 6 | `owner` đăng 3 thông báo trong Cài đặt | Bảng tin có 3 bài mục "Thông báo" đã ghim; mục "Đã đăng" có 3 dòng "Đang ghim" |
| 7 | `member1` (tham gia từ trước) vào trang `photo` | Popup slide 1/3 → "Tiếp" → 2/3 → 3/3 "Đã hiểu"; "Xem chi tiết" mở bài trên Bảng tin |
| 8 | Xem tới slide 2 rồi bấm X; vào "Cộng đồng của tôi" rồi quay lại | Chỉ còn slide 3; xem xong, ra vào lại => không còn popup |
| 9 | Thành viên mới tham gia | Chỉ thấy lời chào, **không** thấy 3 thông báo cũ; chủ đăng / ghim thông báo mới sau đó => thấy thông báo đó |
| 10 | `owner` ghim một bài mục "Thông báo" ngay trên Bảng tin | Thành viên (tham gia trước lúc ghim) thấy popup bài đó; bỏ ghim => thôi hiện |
| 11 | `owner` bấm "Bỏ ghim" trong Cài đặt | Bài trên Bảng tin bỏ ghim; ai chưa xem cũng không còn thấy |
| 12 | `member1` gọi PUT `/greetings/welcome` | 403 |

Ghim bài: không giới hạn số bài ghim; popup chỉ lấy tối đa 10 thông báo chưa xem mới nhất mỗi lần.
