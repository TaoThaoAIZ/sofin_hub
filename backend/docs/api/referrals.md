# API Chương trình giới thiệu (Cài đặt > Chương trình giới thiệu)

Code: `src/modules/referrals/*`. Test: `tests/referrals.test.ts`. Dữ liệu ở Postgres: `ReferralCode`, `Referral`, `ReferralCommission` (migration `20261008100000_settings_flow`).
Response thành công `{ data }` (danh sách: `{ data, meta }`); lỗi tiếng Việt `{ error: { code, message } }`. Tất cả endpoint cần đăng nhập.

> **Giá trị kinh doanh TẠM (lấy từ mockup, chờ chủ sở hữu chốt — OPEN_DECISIONS A17):** hoa hồng creator 30%, member 10%, cửa sổ ghi nhận 60 ngày, chi trả ngày 5 hằng tháng. Đều cấu hình ở Admin > Hệ thống > Cài đặt chung (nhóm `referral`).

## Endpoint

| Method | Path | Body / Query | Response | Lỗi |
|---|---|---|---|---|
| GET | `/me/referral` | `kind=creator\|member` (mặc định creator) | `{ kind, code, link, currency, rates, kpis }` (xem dưới). Lần đầu tự tạo mã | 400 kind sai, 401 |
| GET | `/me/referral/users` | `kind`, `all=true\|false` | `{ data: Row[], meta: { total, shown, currency } }`; `all=false` chỉ 4 dòng mới nhất, `all=true` tối đa 500 | 400, 401 |
| GET | `/me/referral/users/:userId/commissions` | `kind` | `{ data: { currency, totalCents, data: [{ id, createdAt, baseCents, rateBps, amountCents, status, communityId }] } }` | 404 người này không do bạn giới thiệu |
| POST | `/me/referral/users/:userId/remind` | `kind` | `{ data: { sent: true } }` — tạo thông báo trong app cho người đang dùng thử | 404, 409 `NOT_TRIALING`, 429 `REMINDER_COOLDOWN` (1 lần / 24h mỗi cặp) |
| POST | `/auth/register` | thêm `referralCode?` (≤64 ký tự, không phân biệt hoa thường) | như cũ | mã lạ/rỗng/tự giới thiệu/đã có người giới thiệu: bỏ qua êm, đăng ký vẫn thành công |

`GET /me/referral`:
- `link` = `<FRONTEND_URL>/gioi-thieu/<code>`. `code` mặc định = `User.handle` (nếu đã đặt và chưa bị mã khác chiếm), không thì 8 ký tự ngẫu nhiên. **Nguồn sự thật là bảng `ReferralCode`** — đổi handle sau đó không đổi link đã chia sẻ.
- `rates`: `{ creatorRateBps, memberRateBps, rateBps (của kind đang xem), attributionDays, payoutDay }`. FE hiển thị "Nhận 30%…" từ đây.
- `kpis`: `registered { value, delta }` (delta = số người đăng ký thêm trong tháng này, `null` nếu 0) · `paying { value }` · `commissionThisMonth { cents, deltaPct }` (`deltaPct` = `null` khi tháng trước không có hoa hồng) · `pendingPayout { cents, payoutOn }` (`payoutOn` = ngày `referral.payoutDay` của **tháng sau**).
- `currency`: `USD` (kind member, đơn vị cent) hoặc `owner.currency` (kind creator, mặc định `VND`, **đơn vị đồng, không có phần thập phân**). Các trường `*Cents` luôn là "đơn vị nhỏ nhất của `currency`".

`Row`: `{ userId, name, avatarUrl, communityId, communityName, signedUpAt, status, earnedCents }`. Một người được giới thiệu = một dòng (ở cả hai kind).
- `member`: lấy gói mới "tốt nhất" của người đó (ưu tiên đang trả phí > dùng thử > đã hủy): `active→paid`, `trialing→trial`, còn lại `cancel`; chưa có gói → `none`.
- `creator`: cộng đồng đã publish mà người đó làm chủ + gói hosting: `pro` đang `active→paid`, `trialing→trial`, `canceled→cancel`; gói Khởi đầu/không có gói/chưa mở cộng đồng → `none`.
- `earnedCents` = tổng hoa hồng không bị hủy của người này theo `kind`.

## Ghi nhận khi đăng ký
`POST /auth/register { …, referralCode }` → tạo `Referral { referrerId, referredUserId, code, expiresAt = now + referral.attributionDays }`. Mỗi người chỉ được ghi nhận **một lần** (`referredUserId` unique); mã lạ, tự giới thiệu, đã có người giới thiệu bị bỏ qua mà không báo lỗi (không lộ mã nào tồn tại, đăng ký không bao giờ hỏng vì việc này). Mã được tra theo `ReferralCode.code`, không có thì theo `User.handle`.

## Hoa hồng (`ReferralCommission`)
- **member**: hook `referralsService.onPaymentSucceeded` chạy **SAU commit** của `settle` (thanh toán đầu/xác nhận), `recordRenewal` (gia hạn, chuyển dùng thử → trả phí): `amountCents = round(amountCents × memberRateBps / 10000)`, `status = pending`, `payoutOn` = ngày chi trả kế tiếp, `sourceRef = payment:<paymentId>` (unique ⇒ idempotent, confirm/webhook lặp không nhân đôi). Lỗi trong hook bị nuốt + log (không bao giờ làm hỏng thanh toán); `reconcileCommissions` (job `referrals.reconcile` mỗi 10 phút, nhìn lại 3 ngày) bù hoa hồng còn thiếu.
- **Cửa sổ ghi nhận** được xét tại **lần thanh toán đầu** của người được giới thiệu (`confirmedAt <= Referral.expiresAt`). Đã có ít nhất một hoa hồng cùng loại thì các kỳ sau (gia hạn hằng tháng) vẫn được tính dù cửa sổ đã hết — đúng mô tả "hoa hồng định kỳ".
- **Hoàn tiền / chargeback toàn bộ** (`applyRefund`, sau commit): hoa hồng `pending` của giao dịch đó → `void`. Hoa hồng đã `paid` giữ nguyên (cần xử lý tay). Hoàn một phần không hủy.
- **creator**: `referralsService.onHostingCharge({ ownerId, communityId, chargeRef, amount })` tạo hoa hồng `creator` (sourceRef `hosting:<chargeRef>`), nhưng **chưa có luồng trừ tiền gói hosting** (A16 vẫn là mô phỏng) nên chưa có nơi nào gọi — tab "người tạo cộng đồng" hiện đúng trạng thái gói nhưng hoa hồng = 0 cho tới khi có thanh toán hosting thật.
- Chưa có job chuyển `pending → paid` (chi trả tự động); `payoutOn` chỉ là ngày dự kiến.

## Global Settings (`referral.*`, nhóm mới trong `PATCH /admin/system/settings`)
| Khóa | Mặc định | Ràng buộc | Ý nghĩa |
|---|---|---|---|
| `referral.creatorRateBps` | 3000 | 0–10000 | % hoa hồng người tạo cộng đồng (basis point) |
| `referral.memberRateBps` | 1000 | 0–10000 | % hoa hồng thành viên |
| `referral.attributionDays` | 60 | 1–3650 | số ngày hiệu lực kể từ lúc đăng ký |
| `referral.payoutDay` | 5 | 1–28 | ngày chi trả trong tháng |
Tỉ lệ được **chụp** vào `ReferralCommission.rateBps` lúc phát sinh — đổi cài đặt không ảnh hưởng hoa hồng cũ.

## FE
Link `/gioi-thieu/:code` (FE) lưu mã vào `localStorage` rồi chuyển `/register`; `?ref=<mã>` ở mọi trang cũng được lưu. `RegisterPage` gửi `referralCode` rồi xóa mã sau khi đăng ký.
