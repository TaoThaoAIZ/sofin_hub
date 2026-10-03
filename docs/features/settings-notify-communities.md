# Cài đặt: Thông báo & Cộng đồng của tôi - kịch bản test thủ công

Đường dẫn: `/settings/thong-bao` và `/settings/cong-dong` (đã đăng nhập). `/me/communities` chuyển hướng sang `/settings/cong-dong`.
Email dev nằm ở `http://localhost:4000/api/dev/outbox?to=<email>`. Cần ít nhất 2 tài khoản A, B cùng tham gia 1 cộng đồng.

## Thông báo
1. Mở tab: thấy "Email tổng hợp" (4 lựa chọn), "Giờ im lặng", "Tin nhắn & người theo dõi", bảng "Theo từng cộng đồng" (hàng = cộng đồng đã tham gia, vai trò thật). Nút Hủy/Lưu mờ khi chưa đổi gì.
2. Đổi bất kỳ thứ gì -> nút sáng lên. "Hủy" trả về giá trị đã lưu. "Lưu thay đổi" -> toast "Đã lưu cài đặt thông báo"; F5 vẫn giữ.
3. Email: chọn "Ngay lập tức", lưu; B bình luận bài của A -> A nhận email trong outbox. Chọn "Tắt" -> không có email mới. "Mỗi ngày/Mỗi tuần": lưu được nhưng chưa gửi tự động (có dòng ghi chú).
4. Giờ im lặng: bật, đặt khoảng chứa giờ hiện tại (khoảng qua nửa đêm cũng được), lưu. B bình luận bài A -> thông báo vẫn nằm trong chuông của A nhưng không có toast/realtime và không có email. Đặt khoảng không chứa giờ hiện tại -> có toast + email. Từ = Đến khi bật -> lưu báo lỗi.
5. "Cho phép nhắn tin riêng" tắt, lưu: B mở/nhắn A -> báo "Người dùng này đã tắt nhận tin nhắn riêng". Bật lại -> nhắn được.
6. "Email khi có tin nhắn chưa đọc": bật, B nhắn A (A không mở hội thoại) -> A có email; tắt -> không email. (Tối đa 1 thông báo/hội thoại/5 phút.)
7. "Báo khi người tôi theo dõi đăng bài": chỉ lưu (chưa có tính năng theo dõi).
8. Bảng cộng đồng: tắt "Bình luận bài tôi theo dõi" ở cộng đồng X, lưu; B bình luận bài A ở X -> A không có thông báo; ở cộng đồng khác vẫn có. "Yêu cầu gia nhập" chỉ có công tắc ở cộng đồng bạn quản lý, thành viên thường hiện "–". "Đặt lại mặc định" bật lại mọi ô (cần Lưu để áp dụng).

## Cộng đồng của tôi
1. Danh sách cộng đồng đã tham gia: chủ sở hữu thấy "Cài đặt cộng đồng", người khác thấy "Mở"; dòng mô tả đúng (số thành viên, riêng tư/công khai, ngày tham gia, gói tháng/năm, dùng thử còn N ngày, miễn phí).
2. Lọc "Tất cả / Tôi quản lý / Thành viên" đếm đúng. Công tắc "thanh bên" lưu ngay (F5 vẫn giữ).
3. Kéo biểu tượng sáu chấm để đổi thứ tự -> toast "Đã cập nhật thứ tự", F5 giữ thứ tự. Menu "..." -> "Ghim lên đầu thanh bên" đưa lên đầu và hiện biểu tượng ghim; "Bỏ ghim" trả lại.
4. Menu: "Tùy chỉnh thông báo" -> `/settings/thong-bao`; "Quản lý gói thành viên" -> `/settings/thanh-toan`.
5. "Rời cộng đồng": chủ sở hữu thấy "Hãy chuyển quyền trước khi rời" (nút Đã hiểu, không rời); thành viên xác nhận -> biến khỏi danh sách; gói trả phí hủy cuối kỳ.
6. "Đang chờ": gửi yêu cầu vào cộng đồng riêng tư -> hiện ở đây; "Hủy yêu cầu" xóa. Không có gì: "Không có yêu cầu hay lời mời nào đang chờ." (Lời mời là link chung nên không hiện ở đây.)
7. Cuối trang: "Bản nháp cộng đồng" (nếu có nháp wizard: Tiếp tục tạo / Xóa nháp) và "Điểm của tôi".
