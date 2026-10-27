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
