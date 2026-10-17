# Đăng nhập Google / Facebook

> Cập nhật 2026-10-17. **Google đã bật** (nút hiện mặc định, tắt bằng `VITE_SOCIAL_LOGIN=0` khi build). **Facebook vẫn ẩn** (cần `VITE_FACEBOOK_LOGIN=1` + app review).

## Google — cấu hình
1. Google Cloud Console > project `SofinHub` > Google Auth Platform: Branding, Audience = External và **Publish app** (nếu để *Testing* thì chỉ test user đăng nhập được), Data Access chỉ `openid email profile` (không cần xét duyệt).
2. Clients > OAuth client kiểu Web application. **Authorized redirect URIs** (khớp từng ký tự):
   - `https://hub.taothaoai.com/api/auth/oauth/google/callback`
   - `http://localhost:4000/api/auth/oauth/google/callback` (dev)
3. Biến môi trường backend (dev: `backend/.env`; production: `/opt/app/.env`, chmod 600; KHÔNG commit):
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_REDIRECT_BASE` (URL công khai của backend, production = `https://hub.taothaoai.com`), `FRONTEND_URL`.
4. Áp dụng trên server: `cd /opt/app && docker compose up -d --force-recreate backend`.
5. Thiếu khoá => backend trả `error=not_configured`. Lỗi `redirect_uri_mismatch` => URI ở bước 2 lệch `OAUTH_REDIRECT_BASE`.

## Facebook (chưa bật)
Tạo app Facebook, điền `FACEBOOK_APP_ID/SECRET`, `VITE_FACEBOOK_LOGIN=1`. App ở chế độ Development chỉ cho tài khoản có vai trò; muốn người lạ dùng phải app review + Live. Tài khoản không có email xác nhận bị từ chối (`oauth_no_email`).

Thiết kế chi tiết: `backend/docs/api/identity.md`.
