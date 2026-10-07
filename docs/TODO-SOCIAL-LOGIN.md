# TODO: bật lại đăng nhập Google / Facebook

> Ghi chú 2026-10-07. Nút Google/Facebook đang **TẠM ẨN** ở trang đăng nhập và đăng ký. Code backend + frontend đã làm xong và có test, chỉ chưa có khoá OAuth.

## Đang ẩn thế nào
- Frontend: cờ `SOCIAL_LOGIN_ENABLED` trong `frontend/src/features/auth/SocialButtons.tsx` (= `VITE_SOCIAL_LOGIN === '1'`). Mặc định tắt: ẩn cả nút lẫn dòng "hoặc đăng nhập/đăng ký với".
- Backend: route `/api/auth/oauth/:provider/start|callback` vẫn mount; nhà cung cấp thiếu khoá thì tự trả `error=not_configured`.

## Để bật lại
1. Tạo OAuth app Google và Facebook (hướng dẫn từng bước đã trao đổi trong chat; redirect URI = `<OAUTH_REDIRECT_BASE>/api/auth/oauth/<provider>/callback`).
2. Điền vào `backend/.env` (và biến môi trường trên Render): `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_APP_ID/SECRET`, `OAUTH_REDIRECT_BASE` (URL công khai của BE).
3. Điền `VITE_SOCIAL_LOGIN=1` ở frontend (`frontend/.env` hoặc biến build trên Vercel), build lại FE.
4. Thử thật: đăng ký mới, đăng nhập lại, trùng email với tài khoản có sẵn, tài khoản bật 2FA.
5. Facebook: app mới ở chế độ Development chỉ cho tài khoản có vai trò; muốn người lạ dùng phải app review + bật Live. Tài khoản FB không có email xác nhận sẽ bị từ chối (`oauth_no_email`).

Thiết kế chi tiết: `backend/docs/api/identity.md`.
