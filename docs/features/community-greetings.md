# Lời chào thành viên mới & thông báo popup

Chủ / admin cộng đồng: **Cài đặt > Lời chào & thông báo**. API: `backend/docs/api/community-greetings.md`.

| # | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | `owner` mở `/communities/photo/community/cai-dat?tab=greetings`, nhập lời chào có `{ten}`, `{cong_dong}`, danh sách "1. …", bật, Lưu | Xem trước hiện đúng tên + tên cộng đồng, danh sách đánh số |
| 2 | `newbie` tham gia `photo` rồi vào trang cộng đồng | Popup tin nhắn của Olivia Owner (nhãn "Chủ cộng đồng"), nút "Nhắn tin cho Olivia Owner" (mở Tin nhắn) và "Bắt đầu thôi" |
| 3 | `newbie` tải lại trang | Không hiện lời chào nữa |
| 4 | `newbie` rời cộng đồng rồi tham gia lại | Không hiện lời chào |
| 5 | `member1` (đã tham gia từ trước khi bật) vào trang cộng đồng | Không hiện lời chào |
| 6 | `owner` đăng thông báo (tiêu đề, nội dung, link `/communities/photo/community/lich`) | Mục "Đã đăng" có bản mới "Đang hiện"; bản cũ chuyển "Đã gỡ" |
| 7 | `member1` vào trang `photo` | Popup thông báo (tiêu đề, nội dung, "Xem chi tiết" dẫn tới Lịch, "Đã hiểu"); tải lại => không hiện; trang cộng đồng khác => không hiện |
| 8 | Thành viên mới tham gia khi đang có thông báo | Thấy lời chào trước, bấm "Bắt đầu thôi" => thấy thông báo |
| 9 | `owner` bấm "Gỡ" | Ai chưa xem cũng không còn thấy; số "x/y thành viên đã xem" cập nhật |
| 10 | `member1` gọi PUT `/greetings/welcome` | 403 |
