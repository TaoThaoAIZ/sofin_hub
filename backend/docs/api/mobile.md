# API dành cho app mobile

Chỉ **thêm** hành vi cho client có header `X-Client: mobile`; web (không có header) giữ nguyên. Module: `src/modules/auth/auth.routes.ts`, `src/modules/meta/meta.routes.ts`. Test: `tests/auth-mobile.test.ts`, `tests/meta-app-version.test.ts`.

## Refresh token qua body (B1)

App không dùng cookie: refresh token được lưu ở SecureStore của thiết bị.

| Endpoint | Khi có `X-Client: mobile` |
|---|---|
| `POST /auth/login`, `POST /auth/login/2fa`, `POST /auth/register/verify` | Body `data` có thêm `refreshToken` (ngoài `user`, `accessToken`). Cookie vẫn được set như cũ. |
| `POST /auth/refresh` | Nhận `{ "refreshToken": "..." }` trong body khi không có cookie. Trả phiên mới **kèm refresh token mới** (xoay vòng; token cũ dùng lại → 401). |

Không có header `X-Client: mobile`: body không bao giờ chứa `refreshToken` và `/auth/refresh` bỏ qua body (chỉ đọc cookie).

## Cổng phiên bản (B5)

`GET /meta/app-version?platform=ios|android` (công khai) → `{ data: { minVersion, latestVersion, storeUrl } }`.
Cấu hình qua env: `MOBILE_MIN_VERSION`, `MOBILE_LATEST_VERSION`, `MOBILE_IOS_STORE_URL`, `MOBILE_ANDROID_STORE_URL`. Chưa đặt thì giá trị là `null` (app không ép cập nhật).

## Chưa làm (cần đầu vào từ chủ dự án)

- B2 đăng nhập Google/Apple native: cần OAuth client ID Android/iOS (Google Cloud), Apple Developer.
- B3 push: bảng thiết bị + gửi qua Expo Push API.
- B4 deep link: `assetlinks.json` cần SHA-256 chứng chỉ ký app; `apple-app-site-association` cần Apple Team ID; cả hai cần domain thật.

## Đăng nhập Google qua trình duyệt hệ thống (B2, phần Google)

Dùng lại OAuth ở server (`oauth.ts`, client ID **Web** hiện có) — không cần client ID Android/iOS. Module: `oauth-mobile.ts`, route trong `auth.routes.ts`. Test: `tests/auth-mobile-oauth.test.ts`.

1. App tạo `verifier` (≥32 ký tự ngẫu nhiên), mở bằng trình duyệt hệ thống:
   `GET /auth/oauth/google/start?client=mobile&challenge=<base64url(sha256(verifier))>` (thêm `&ref=` nếu có mã giới thiệu).
2. Server chạy OAuth như web. Xong chuyển về deep link `sofinhub://oauth#...`:
   - `#code=<mã>`: thành công. Mã dùng 1 lần, sống 60 giây, gắn với challenge.
   - `#ticket=<vé>`: tài khoản bật 2FA — gọi `POST /auth/login/2fa` như đăng nhập thường.
   - `#error=<mã>`: `not_configured`, `invalid_state`, `cancelled`, `oauth_no_email`, `email_conflict`, … (cùng bộ mã với web).
3. `POST /auth/oauth/mobile/exchange` `{ code, verifier }` + header `X-Client: mobile` → phiên (`user`, `accessToken`, `refreshToken`). Sai verifier/mã hết hạn/dùng lại → 401 (mã bị hủy ngay).

Lưu ý: mã đổi giữ trong bộ nhớ tiến trình (đủ cho 1 instance; nhiều instance cần chuyển sang Redis/DB). Dev trên emulator: đặt `EXPO_PUBLIC_API_URL=http://localhost:4000/api` + `adb reverse tcp:4000 tcp:4000` vì Google chỉ nhận redirect `localhost`/https.
