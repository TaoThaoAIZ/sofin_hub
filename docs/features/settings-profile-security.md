# Cài đặt: tab "Hồ sơ" và "Tài khoản & bảo mật"

Thiết kế nguồn: "Cai dat ho so" (template x-dc). Route `/settings` (Hồ sơ) và `/settings/bao-mat` (Bảo mật), khung ở `frontend/src/features/settings/`.

## Đã làm

**Hồ sơ** (`tabs/ProfileTab.tsx`, `settings/profile/`)
- Ảnh đại diện: "Đổi ảnh đại diện" / kéo-thả / nút camera upload thật qua `useUpload` (purpose `avatar`) rồi lưu `avatarUrl` khi bấm "Lưu thay đổi"; "Xóa ảnh" = đặt `avatarUrl` rỗng (BE lưu null).
- Họ/Tên, đường dẫn hồ sơ `sofinhub.com/@handle` (kiểm tra trống/đã dùng/giữ chỗ trực tiếp qua `GET /users/handle-available`, debounce 400ms), giới thiệu (tối đa 150 ký tự, FE + zod), Website/Instagram/YouTube/Thành phố (= `location`), công tắc "Hiện vị trí trên bản đồ" (= `showOnMap`).
- Thẻ "Người khác thấy bạn như thế này" dựng theo giá trị đang nhập; số liệu thật từ `GET /users/:id` của chính mình: Cấp độ (`levelFor(tổng điểm)`), điểm, số cộng đồng (gồm cả cộng đồng riêng tư vì là chính chủ), "Tham gia từ tháng M/YYYY" từ `createdAt`.
- Hủy = khôi phục bản đã lưu.

**Bảo mật** (`tabs/SecurityTab.tsx`, `settings/security/`)
- Email: hiện email + nhãn "Đã xác minh/Chưa xác minh"; nút gửi lại email xác minh (thay VerifyBanner cũ, cooldown 60s); "Đổi email" (modal) -> email chờ `pendingEmail`, link xác nhận gửi tới email MỚI.
- Mật khẩu: phụ đề từ `passwordChangedAt`; modal 3 ô theo chính sách thật (>= 8 ký tự, 1 chữ hoa, 1 ký tự đặc biệt - `auth/validation.ts` = `auth.schema.ts`).
- Xác minh 2 bước (TOTP RFC 6238): modal bật (QR + khóa nhập tay + mã 6 số), tắt (mã 6 số). Badge "Đang bật/Đang tắt", nút "Quản lý/Bật ngay". `?2fa=1` (từ sidebar) mở modal bật. Đăng nhập: `LoginPage` có bước nhập mã khi BE trả `twoFactorRequired`.
- Thiết bị: danh sách phiên đăng nhập (icon/tên/meta suy từ User-Agent, "nơi" = IP vì chưa có geo-IP), "Thiết bị này", đăng xuất từng thiết bị, "Đăng xuất mọi thiết bị" (chỉ hiện khi có thiết bị khác; GIỮ thiết bị này - khác `POST /auth/logout-all` thu hồi tất cả).
- Ngôn ngữ / múi giờ / giao diện: lưu theo user (tự lưu khi chọn).
- Xóa tài khoản: thẻ đỏ hiện điều kiện chặn thật; modal gõ XÓA + mật khẩu.
- Gỡ file cũ không còn ai import: `features/account/components/{ProfileForm,PasswordForm,SessionsPanel,DeleteAccountPanel,VerifyBanner}.tsx`.

## Endpoint mới / đổi

Xem `backend/docs/api/settings-account.md`.

## Quyết định đã chọn

- **Họ/Tên**: Họ = `lastName`, Tên = `firstName`; tên hiển thị trong thẻ xem trước là `Tên Họ` (đúng với `name` mà BE trả cho người khác).
- **"theo dõi"**: codebase chưa có tính năng theo dõi người dùng. Ô giữa của thẻ xem trước hiển thị **điểm** (tổng điểm thật) thay cho "theo dõi".
- **Ảnh bìa hồ sơ**: không có cột/ API ảnh bìa người dùng -> thẻ xem trước dùng nền gradient của thiết kế (không upload được).
- **Đổi email dùng lại token `verify-email`** (enum OneTimeTokenPurpose không thêm giá trị mới vì không sửa schema): nếu user có `pendingEmail` thì token xác nhận email MỚI (hoán đổi email, `emailVerified = true`), ngược lại xác minh email hiện tại. Đổi email không thu hồi phiên nào.
- **Tắt 2FA chỉ cần mã 6 số** (đúng thiết kế); API nhận thêm `password` tùy chọn (nếu gửi thì phải đúng).
- **Chống replay TOTP**: mỗi (user, bước 30s) dùng 1 lần (kv `setNx`), tối đa 8 lần thử / 5 phút / user (429). Vé đăng nhập bước 2 là JWT 5 phút `typ: '2fa'` (không dùng được làm access token).
- **Xóa tài khoản bị chặn** khi: là owner của cộng đồng (enrollment role owner) hoặc còn gói thành viên `trialing/active` chưa đặt "hủy cuối kỳ". Gói đã đặt hủy cuối kỳ không chặn.
- **Bio tối đa 150 ký tự** (trước là 500). Bio cũ dài hơn vẫn đọc được nhưng lần sửa sau phải rút gọn.
- Handle: `^[a-z0-9._]{3,24}$`, không bắt đầu/kết thúc bằng dấu chấm, không `..`, lưu chữ thường (nhập hoa tự hạ), danh sách giữ chỗ ở `auth/handle.ts`. Ẩn danh hóa tài khoản giải phóng handle.
- Instagram lưu không kèm `@`; website/YouTube thiếu scheme thì FE thêm `https://`.

## Chưa làm / giới hạn

- Ngôn ngữ và giao diện **chỉ được lưu**: app chưa có i18n và chưa có dark mode nên chọn "English"/"Tối" chưa đổi gì trên giao diện. Múi giờ chưa được dùng để định dạng giờ ở nơi khác.
- Chưa có mã khôi phục 2FA (ngoài phạm vi). Mất thiết bị xác thực = liên hệ quản trị.
- Địa điểm thiết bị chỉ là IP (không geo-IP); tên thiết bị suy từ User-Agent nên "iPhone 14 Pro" không thể có.
- Chưa có nút hủy email chờ xác nhận: nhập lại "Đổi email" sẽ ghi đè.
- Danh sách múi giờ chỉ 5 mục theo thiết kế (BE nhận mọi mã IANA hợp lệ).
- Chưa thêm test case vào `SofinHub_TestCases.xlsx` (xem báo cáo giao việc).
