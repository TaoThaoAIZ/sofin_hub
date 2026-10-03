# API nhóm Cài đặt tài khoản: hồ sơ mở rộng, tùy chọn, đổi email, 2FA, thiết bị

Tất cả path nằm sau tiền tố `/api`, cần `Authorization: Bearer` trừ khi ghi khác. Thành công `{ data }`. Bổ sung cho `identity.md`. Test: `tests/account-settings.test.ts`.

## Endpoint

| Method | Path | Auth | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| PATCH | /auth/me | Bearer | như cũ + `handle` (`[a-z0-9._]{3,24}`, tự hạ chữ thường), `instagram` (`@tên` hoặc `tên`, lưu không @), `youtube` (URL http/https), `showOnMap` (bool); `bio` tối đa **150**; `""`/`null` = xóa (trừ tên, showOnMap) | `AuthUser` | 400, 401, 409 (handle đã có người dùng / giữ chỗ) |
| GET | /auth/me | Bearer | - | `AuthUser` nay có thêm `handle, instagram, youtube, showOnMap, language, timezone, theme, twoFactorEnabled, passwordChangedAt, pendingEmail` (KHÔNG BAO GIỜ có `totpSecret`) | 401 |
| GET | /users/handle-available?handle= | Bearer | `handle` (có thể kèm `@`) | `{available, reason?: 'invalid'\|'reserved'\|'taken'}`; handle của chính mình = `available` | 400 (thiếu `handle`), 401 |
| GET | /users/:idOrHandle | Bearer | id hoặc handle (có thể kèm `@`) | như cũ + `handle, instagram, youtube, communityCount, level`; `location` = null nếu chủ hồ sơ tắt `showOnMap` (chính chủ vẫn thấy). `communityCount` của chính chủ gồm cả cộng đồng riêng tư | 401, 404 |
| PATCH | /auth/me/preferences | Bearer | `language` (`vi`\|`en`), `timezone` (IANA hợp lệ), `theme` (`light`\|`dark`\|`system`); ít nhất 1 trường | `AuthUser` | 400, 401 |
| POST | /auth/change-email | Bearer, rate limit IP 5/15 phút | `{newEmail, password}` | 202 `{pendingEmail}`; gửi link `{FRONTEND_URL}/verify-email?token=` tới email MỚI | 400 (sai mật khẩu, trùng email hiện tại), 401, 409 (email đã dùng), 429 (cooldown 60s) |
| POST | /auth/verify-email | - | `{token}` | `AuthUser`. Nếu user có `pendingEmail` thì hoán đổi email + `emailVerified=true` | 400, 409 (email mới đã bị người khác chiếm) |
| POST | /auth/send-verification | Bearer | - | 202; nếu có `pendingEmail` thì gửi lại tới email MỚI (kể cả khi email cũ đã xác minh) | 401, 409, 429 |
| POST | /auth/2fa/setup | Bearer | - | `{secret (base32), otpauthUrl}`; ghi bí mật mới (ghi đè bản dở), CHƯA bật. Đây là lần DUY NHẤT bí mật được trả ra | 401, 409 (đã bật) |
| POST | /auth/2fa/enable | Bearer | `{code}` 6 số | `AuthUser` (`twoFactorEnabled=true`) | 400 (mã sai / chưa setup), 401, 409, 429 |
| POST | /auth/2fa/disable | Bearer | `{code, password?}` | `AuthUser` (`twoFactorEnabled=false`, xóa bí mật) | 400 (mã sai; `password` gửi mà sai), 401, 409 (đang tắt), 429 |
| POST | /auth/login | - | như cũ | Tài khoản không bật 2FA: như cũ. Bật 2FA: 200 `{twoFactorRequired:true, ticket}`, KHÔNG cấp phiên/cookie | như cũ |
| POST | /auth/login/2fa | - | `{ticket, code}` | như `/auth/login` (user + accessToken + cookie refresh) | 400, 401 (vé hết hạn/giả, mã sai/đã dùng), 429 |
| GET | /auth/sessions | Bearer | - | thêm `device: {browser, browserVersion?, os, osVersion?, kind: desktop\|mobile\|tablet\|unknown}` mỗi phiên | 401 |
| POST | /auth/sessions/revoke-others | Bearer | - | 204; thu hồi mọi phiên KHÁC, giữ phiên hiện tại | 401 |
| GET | /auth/me/delete-blockers | Bearer | - | `{ownedCommunities:[{id,title}], activeSubscriptions}` | 401 |
| DELETE | /auth/me | Bearer | `{password}` | 204 | 400, 401, 409 `ACCOUNT_DELETE_BLOCKED` với `error.details = {ownedCommunities, activeSubscriptions}` |

## Quyết định thiết kế

- **TOTP** (`auth/totp.ts`, node:crypto): HMAC-SHA1, 6 số, bước 30s, chấp nhận lệch ±1 bước, so sánh hằng thời gian; có test vector RFC 6238. Bí mật 160 bit, lưu thô ở `User.totpSecret` (không mã hóa at-rest, theo yêu cầu).
- **Chống brute-force/replay** (`auth/two-factor.ts`, dùng `shared()`): `rateLimiter` 8 lần/5 phút/user (lỗi store = fail-open), `kv.setNx` theo (user, counter) để một mã chỉ dùng được một lần (fail-closed).
- **Vé 2FA**: JWT ký `JWT_ACCESS_SECRET`, hạn 5 phút, claim `typ:'2fa'`, không có `sid/tv` nên `authenticateAccessToken` từ chối nếu dùng nhầm làm access token. Sai mật khẩu vẫn trả 401 như cũ (không lộ trạng thái 2FA).
- **Đổi email** dùng chung token `verify-email` (không thêm enum Prisma). Thư tới email cũ không được gửi.
- **passwordChangedAt** được ghi ở `change-password` và `reset-password`.
- **Handle**: unique ở DB (`User.handle`); service kiểm trước (409 có thông điệp rõ) và bắt P2002 khi đua. Danh sách giữ chỗ ở `auth/handle.ts`. Ẩn danh hóa xóa handle, instagram, youtube, bí mật 2FA, email chờ.
- **Xóa tài khoản**: kiểm mật khẩu trước (400) rồi mới kiểm điều kiện chặn (409). Gói đã đặt `cancelAtPeriodEnd` không chặn.
- `logout-all` giữ nguyên (thu hồi tất cả, kể cả phiên hiện tại); "đăng xuất mọi thiết bị khác" dùng `revoke-others`.

## Chưa làm / cần quyết định

- Mã khôi phục 2FA, mã hóa bí mật TOTP at-rest.
- `language/theme/timezone` chỉ lưu; chưa có i18n/dark mode phía FE.
- Chưa có endpoint hủy email chờ xác nhận (nhập lại `change-email` sẽ ghi đè).
- Không có geo-IP: thiết bị chỉ có IP.
