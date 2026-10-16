# Xử lý lỗi thường gặp

## Dùng VPN bị Google chặn khi tạo video (Veo/Grok)

Bật VPN khi tạo video khiến Google phát hiện IP bất thường và báo "unusual activity", chặn không tạo được.
Cách xử lý: tắt VPN và dùng IP mạng thật của máy — sang ngày mới thường không cần bật VPN nữa. VPN chỉ nên dùng
làm phương án cứu khi bị chặn tạm thời, không nên bật liên tục.

## Cookie/phiên đăng nhập Veo, Whisk hết hạn

Khi tool báo lỗi liên quan đến cookie hoặc không đăng nhập được vào Veo/Whisk, cookie đã hết hạn — khách cần lấy
cookie mới từ tài khoản đang đăng nhập trên trình duyệt. Đây là việc phải làm định kỳ, không phải lỗi tool.

## Dán prompt/nội dung vào tool bị lỗi

Nếu dán (paste) nội dung vào tool mà bị lỗi hiển thị, xoá hết nội dung đã dán rồi dán lại từ đầu thay vì sửa
trên nội dung lỗi sẵn có.

## Lỗi HTTP 429 — "Quota exceeded" / vượt hạn mức model

Lỗi `PUBLIC_ERROR_PER_MODEL_DAILY_QUOTA_REACHED` nghĩa là đã dùng hết hạn mức gọi model AI trong ngày ở phía nhà
cung cấp (không phải lỗi từ phía khách). Khách cần liên hệ gửi thông tin tài khoản để nhân viên kiểm tra và xử lý.

## Tài khoản Google (Veo/Grok) bị khoá/die hàng loạt

Từng có đợt Google quét và khoá hàng loạt tài khoản Veo/Grok đang dùng chung — đây là rủi ro chung của loại tài
khoản chia sẻ, không phải lỗi riêng của một khách. Trong đợt quét, thị trường có thể tạm thời khan hiếm tài khoản
thay thế; khách cần chờ nhân viên cấp lại khi có hàng.

## Chỉ đăng nhập được 1 máy tại một thời điểm

Tài khoản có thể đăng nhập ở nhiều máy khác nhau, nhưng chỉ dùng được ở một máy tại một thời điểm. Khi đổi sang
máy khác, cần báo nhân viên gỡ thiết bị cũ trước khi đăng nhập máy mới, nếu không sẽ báo lỗi đăng nhập.

## Tool chạy chậm / phải để máy treo qua đêm

Với các lệnh render dài (ví dụ dán prompt rồi nhấn render), tool cần được mở treo máy liên tục để chạy — nếu tắt
máy hoặc gập máy giữa chừng, lệnh sẽ không tiếp tục chạy. Khách cần để máy mở xuyên suốt tới khi xong, có thể bật
auto-download để file tự tải về khi hoàn tất.

## Đăng nhập lỗi trên Cốc Cốc/Edge

Nếu đăng nhập bị lỗi (login failed) trên một trình duyệt, thử đổi sang trình duyệt khác (ví dụ Chrome) — một số
trình duyệt (Cốc Cốc, Edge) đôi lúc không gửi được token đăng nhập qua extension, tắt mở lại trình duyệt hoặc đổi
trình duyệt thường khắc phục được.

## Tải file/video bị lỗi hoặc không tải được

Phần lớn trường hợp báo lỗi tải file (đuôi file, tên file dài, tải hàng loạt bị lỗi) thực tế vẫn tải được bình
thường — nên thử kiểm tra lại hoặc thử tải với số lượng nhỏ hơn (ví dụ khoảng 20 thay vì 100 prompt cùng lúc)
trước khi báo lỗi. Nếu vẫn không được, có thể do file bị ảnh hưởng bởi captcha lúc tạo — thử lại với cookie mới.
