# Kế hoạch: Gửi OTP về email khi đăng ký

> Ghi chú ngày 2026-10-06. Mục tiêu: người dùng đăng ký xong phải nhập mã OTP gửi về email mới được vào hệ thống.

## 1. Hiện trạng (đã kiểm tra trong code)

| Hạng mục | Hiện tại | Ảnh hưởng |
|---|---|---|
| Đăng ký | `POST /auth/register` ([auth.service.ts](../backend/src/modules/auth/auth.service.ts)) tạo user + **cấp phiên ngay**. `emailVerified=false`, không có bước xác thực. | Phải đổi: đăng ký không cấp phiên nữa. |
| Xác thực email | Chỉ có link (`OneTimeToken`, `/verify-email`, `/auth/send-verification`) dùng cho **đổi email**. Không có OTP, không đếm số lần nhập sai. | Giữ nguyên cho đổi email; OTP làm bảng riêng. |
| Gửi mail | [mail.service.ts](../backend/src/modules/mail/mail.service.ts): dev = outbox trong RAM (xem qua `GET /dev/outbox`), **production = log-only, KHÔNG gửi thật**. | **Chặn lớn nhất: phải nối SMTP/SES thật.** |
| Mẫu mail | `mailTemplates.send(key, to, vars, fallback)` — mẫu sửa được trong Admin, có vi/en. | Thêm mẫu `register-otp`. |
| Rate limit | `forgotLimiter` đã có trong auth.routes. | Dùng lại/khai báo limiter riêng cho OTP. |
| FE | [RegisterPage.tsx](../frontend/src/pages/RegisterPage.tsx) gọi `register()` rồi `navigate('/')`. Đã có i18n vi/en. | Thêm trang/bước nhập OTP. |
| User cũ | Mọi user hiện có đều `emailVerified=false`. | **Phải backfill `true`** nếu không sẽ bị khóa khi bật chặn đăng nhập. |

## 2. Phương án đề xuất (B – tạo user chưa xác thực, chưa cấp phiên)

Luồng:
1. `POST /auth/register` → tạo user `emailVerified=false`, sinh OTP, gửi mail, trả `{ verificationRequired: true, email }` (**không** set cookie/token).
2. FE chuyển sang màn nhập OTP (6 ô).
3. `POST /auth/register/verify { email, code }` → đúng thì `emailVerified=true`, cấp phiên như login (cùng `issueSession`), trả `AuthSession`.
4. `POST /auth/register/resend { email }` → gửi lại (có cooldown).
5. `POST /auth/login` với user chưa xác thực (mật khẩu đúng) → `403 EMAIL_NOT_VERIFIED`; FE đưa sang màn OTP và tự gửi lại mã.

Vì sao chọn B:
- Thay đổi vừa phải, tận dụng `issueSession`, bảng user, mail template có sẵn.
- Phương án A (cấp phiên ngay, chặn tính năng đến khi xác thực) buộc phải gắn cổng ở rất nhiều API → dễ sót.
- Phương án C (chỉ tạo user sau khi nhập đúng OTP, lưu đăng ký tạm vào bảng riêng) sạch nhất nhưng phải lưu mật khẩu băm tạm + xử lý referral/trùng email phức tạp hơn. Có thể nâng cấp sau.

## 3. Thiết kế OTP

- Mã **6 chữ số**, sinh bằng `crypto.randomInt` (không dùng `Math.random`).
- Lưu **HMAC-SHA256(code, OTP_PEPPER)**, không lưu mã thô. 6 số rất dễ dò nên **bắt buộc giới hạn số lần thử**, không dựa vào băm.
- Hiệu lực **10 phút**; sai **tối đa 5 lần** → mã bị hủy, phải gửi lại.
- Gửi lại: cooldown **60 giây**, tối đa **5 lần/giờ/email**, thêm giới hạn theo IP.
- So sánh bằng `timingSafeEqual`. Gửi lại sinh mã mới và vô hiệu mã cũ.
- Dùng 1 lần: xác thực đúng thì xóa bản ghi.
- Đăng ký lại bằng email của tài khoản **chưa xác thực**: cho ghi đè họ tên/mật khẩu và gửi OTP mới (tránh việc đăng ký dở chiếm email). Email của tài khoản đã xác thực vẫn báo 409 như hiện nay.
- Chuyển ghi nhận người giới thiệu (`referralsService.attribute`) sang **sau khi xác thực thành công** để tránh referral ảo.

### Bảng mới `EmailOtp` (migration mới)
```
id, userId (FK cascade), purpose ('register'), codeHash,
expiresAt, attempts Int default 0,
lastSentAt, sendCount Int default 1, sendWindowStart,
@@unique([userId, purpose])
```
Migration cũng chạy `UPDATE "User" SET "emailVerified" = true` cho user hiện có (kể cả seed).

## 4. Việc cần làm

### Backend
1. Nối mail provider thật (xem mục 5) + biến môi trường, gọi `setMailProvider()` lúc khởi động.
2. Migration `EmailOtp` + backfill `emailVerified`.
3. `otp.service.ts` (issue / verify / resend, cooldown, đếm lần sai).
4. Sửa `authService.register` (không `issueSession`), thêm `verifyRegistration`, `resendRegistrationOtp`.
5. Route `POST /auth/register/verify`, `/auth/register/resend` + limiter; sửa `/auth/login` trả `EMAIL_NOT_VERIFIED`.
6. Mẫu mail `register-otp` (vi/en, biến `{{code}}`, `{{minutes}}`) + seed mặc định.
7. Job dọn user chưa xác thực quá 7 ngày (tận dụng `worker.ts`).
8. Test: sinh/hết hạn/sai quá 5 lần/gửi lại/cooldown/race/đăng ký lại email chưa xác thực/login chưa xác thực; cập nhật test auth cũ đang kỳ vọng đăng ký xong có phiên.
9. Cập nhật `docs/api` và `.env.example`.

### Frontend
1. `AuthContext.register()` không set phiên; thêm `verifyRegistration(email, code)` và `resendRegistrationOtp(email)`.
2. Màn nhập OTP (trang `/verify-otp?email=` hoặc bước 2 trong RegisterPage): 6 ô, dán nguyên mã, tự gửi khi đủ 6 số, đếm ngược nút "Gửi lại", nút "Đổi email".
3. LoginPage: bắt `EMAIL_NOT_VERIFIED` → chuyển sang màn OTP.
4. i18n vi/en (namespace `auth`), hiển thị đúng thông báo hết hạn/sai mã/quá số lần.
5. Dev: hiển thị gợi ý đọc mã ở `GET /dev/outbox` (không đưa vào bản production).

## 5. Quyết định cần chốt trước khi làm

1. **Nhà cung cấp email** (cần có trước khi test thật):
   - SMTP qua `nodemailer` (Gmail App Password / Brevo / Resend SMTP) — nhanh, ít cài đặt. *Đề xuất cho giai đoạn đầu.*
   - AWS SES — rẻ, tốt khi lên production, cần xác minh domain (SPF/DKIM).
2. Có chặn đăng nhập hoàn toàn với tài khoản chưa xác thực không? (đề xuất: **có**).
3. TTL 10 phút, 6 số, 5 lần sai, cooldown 60s — đồng ý hay đổi?
4. User hiện có: backfill `emailVerified=true` (đề xuất) hay bắt xác thực lại?
5. Domain gửi mail (`From`) và email hỗ trợ.

## 6. Rủi ro / lưu ý

- Mail chậm hoặc vào spam → cần SPF/DKIM/DMARC khi dùng domain riêng; nút gửi lại phải rõ ràng.
- `mailService.send` hiện **nuốt lỗi** gửi mail (cố ý cho forgot-password). Với OTP nên ghi log + metric, nếu provider hỏng thì người dùng không nhận được mã mà không có báo lỗi.
- Không log mã OTP ở production; outbox in-memory chỉ dành cho dev/test.
- Đăng ký trả 409 khi email tồn tại là lộ việc email đã đăng ký (đã có sẵn từ trước, không đổi trong task này).
- Test DB riêng (cổng 5435) hiện không chạy trên máy; chạy test cần `TEST_DATABASE_URL`.

## 7. Ước lượng

| Phần | Thời gian |
|---|---|
| Nối mail provider + cấu hình | 1–2 giờ (chưa tính xác minh domain) |
| Backend (migration, OTP service, route, test) | ~0,5 ngày |
| Frontend (màn OTP, i18n, xử lý login) | ~0,5 ngày |
| Test thủ công + chỉnh sửa | 2–3 giờ |

Tổng: khoảng 1–1,5 ngày làm.
