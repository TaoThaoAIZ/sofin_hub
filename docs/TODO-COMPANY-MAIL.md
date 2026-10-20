# Chuyển gửi OTP sang mail công ty

**Trạng thái (2026-10-20):** ĐÃ chuyển server EC2 sang `hannah@sofingroup.com` (SMTP hoạt động, thư thử gửi OK). **CÒN LẠI: thêm SPF/DKIM/DMARC cho sofingroup.com ở Namecheap (hiện chưa có bản ghi nào), thu hồi mật khẩu ứng dụng cũ của tunsdev86@gmail.com, xóa file `/opt/app/.env.bak-smtp-*` trên server (chứa mật khẩu cũ).**

Ghi ngày 2026-10-20. Hiện đang gửi OTP bằng mail cá nhân (tundev...). Chuyển sang mail công ty để thư không vào spam và không phụ thuộc tài khoản cá nhân.

## 1. Tạo mật khẩu ứng dụng (khóa SMTP)

**Google Workspace** (giống Gmail):
1. Đăng nhập bằng mail công ty, bật Xác minh 2 bước: https://myaccount.google.com/security
2. Tạo mật khẩu ứng dụng: https://myaccount.google.com/apppasswords (đặt tên "SofinHub"; được 16 ký tự, bỏ dấu cách).
3. Nếu không thấy mục này: quản trị viên Workspace bật tại https://admin.google.com (Bảo mật > Xác thực > Xác minh 2 bước, cho phép mật khẩu ứng dụng).

**Microsoft 365:** `smtp.office365.com`, cổng 587, mật khẩu ứng dụng tại https://mysignins.microsoft.com/security-info; quản trị viên tenant bật "Authenticated SMTP" cho hộp thư.

**Tên miền riêng / nhà cung cấp khác:** hỏi host + cổng SMTP của nhà cung cấp.

## 2. Cấu hình biến môi trường (server EC2: `/opt/app/.env`)

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ten@congty.com
SMTP_PASS=<mật khẩu 16 ký tự>
MAIL_FROM=SofinHub <no-reply@congty.com>
```

- `MAIL_FROM` phải cùng tên miền với `SMTP_USER`.
- Sửa xong cần restart backend (docker compose restart backend trên server).
- Mẫu biến nằm ở `deploy/aws/.env.production.example`. KHÔNG commit mật khẩu thật vào git.

## 3. Chống vào spam (làm ở DNS của tên miền công ty)

- **SPF** (TXT): Google Workspace là `v=spf1 include:_spf.google.com ~all`. Nếu đã có SPF thì thêm `include:` vào bản ghi cũ, không tạo bản ghi thứ hai.
- **DKIM**: admin.google.com > Ứng dụng > Google Workspace > Gmail > Xác thực thư > tạo khóa, thêm bản ghi TXT vào DNS, bấm "Bắt đầu xác thực".
- **DMARC** (TXT, tên `_dmarc`): `v=DMARC1; p=none; rua=mailto:ten@congty.com`. Ổn định rồi mới nâng lên `quarantine`.
- Kiểm tra: gửi 1 thư OTP tới https://www.mail-tester.com (mục tiêu điểm 10/10) hoặc https://mxtoolbox.com/SuperTool.aspx.

## 4. Lưu ý

- Gmail giới hạn ~500 thư/ngày (Workspace ~2.000). Nếu lượng đăng ký lớn, chuyển sang Amazon SES / Brevo / Resend (code đã có đường Brevo qua `BREVO_API_KEY`).
- Tuần đầu gửi lượng nhỏ; nếu thư vào spam, nhờ vài người bấm "Không phải thư rác".
- Tiêu đề thư rõ ràng, tránh link rút gọn, ít ảnh.

## 5. Sau khi xong, kiểm tra

- [ ] Đăng ký tài khoản mới, nhận được mã OTP ở hộp thư chính (không phải spam)
- [ ] Thư hiển thị đúng tên người gửi "SofinHub <no-reply@congty.com>"
- [ ] Thử với Gmail, Outlook và 1 mail công ty khác
- [ ] mail-tester.com cho điểm cao
