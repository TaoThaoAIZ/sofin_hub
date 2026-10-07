# Bug từ test thủ công (đợt 1) — nguồn: SofinHub_TestCases.xlsx

Trạng thái: ✅ đã sửa code (chờ tester xác nhận lại) · ⏳ chưa sửa

| # | TC | Vấn đề | Cách sửa | Trạng thái |
|---|----|--------|----------|-----------|
| 1 | TC-HOME-023 | Tìm khóa học chỉ được theo title | `courseTextMatch` (search.repository.ts) chỉ khớp tiêu đề (LIKE không hoa/thường/dấu + gõ sai), bỏ mô tả & tên giảng viên | ✅ |
| 2 | HOME | Điểm đánh giá TB luôn 4/5 | `/meta/stats` tính trung bình có trọng số `Community.rating × ratingCount`; Hero hiển thị 1 số thập phân (4.8/5) | ✅ |
| 3 | HOME | Đổi badge | "Bán chạy"→"Được yêu thích", "Hot"→"Nổi bật" (vi + en) | ✅ |
| 4 | TC-AUTH-030 | Nhiều thiết bị đăng nhập bị "sai quá nhiều lần" | `loginLimiter` đếm theo IP + email (chỉ lần thất bại) thay vì chỉ IP | ✅ |
| 5 | TC-AUTH-041 | Tên >80 ký tự vẫn nhập được | FE `maxLength=80` + BE thông báo max 80 | ✅ |
| 6 | TC-AUTH-042 | Email >180 / mật khẩu >200 vẫn nhập được | FE `maxLength` 180/200 (đăng ký + đăng nhập), BE có message max | ✅ |
| 7 | TC-AUTH-045 | Mật khẩu 'abc' chưa đủ 3 lỗi | BE vốn đã trả đủ 3 (đã kiểm với zod); FE trước chỉ hiện lỗi đầu → nay hiện đủ 3 | ✅ |

Lưu ý: #7 nếu tester gọi thẳng API mà vẫn thiếu thì gửi lại request/response để kiểm.
