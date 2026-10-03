# Cài đặt > Thanh toán và Chương trình giới thiệu

Hợp đồng API: `backend/docs/api/payments.md` (mục "Quản lý thẻ & tổng quan thanh toán") và `backend/docs/api/referrals.md`. Tài liệu này mô tả phần frontend. Khung trang (`SettingsLayout`, nav, topbar, `ui.tsx`) thuộc phần Cài đặt chung.

## Route
| Route | Thành phần | Ghi chú |
|---|---|---|
| `/settings/thanh-toan` | `features/settings/tabs/BillingTab.tsx` | Thay cho trang `/billing` cũ. |
| `/billing` | `<Navigate to="/settings/thanh-toan" replace />` | Link cũ (Header, menu cộng đồng) vẫn chạy. `pages/BillingPage.tsx` đã xóa (không còn nơi nào import). |
| `/settings/gioi-thieu` | `features/settings/tabs/ReferralTab.tsx` | |
| `/gioi-thieu/:code` | `features/referral/ReferralLandingPage.tsx` | Lưu mã vào `localStorage` rồi chuyển `/register`. |
| mọi trang `?ref=<mã>` | `features/referral/ReferralCapture.tsx` | Cũng lưu mã. `RegisterPage` gửi `referralCode` rồi xóa. |

## Thanh toán (`BillingTab`)
| File | Vai trò |
|---|---|
| `tabs/BillingTab.tsx` | 3 khối + hộp thoại: thẻ (menu ⋯: Đặt làm mặc định / Cập nhật thẻ / Xóa thẻ), thẻ tối "Lần trừ tiền tiếp theo" + "Tổng mỗi tháng", danh sách gói ("Quản lý" + chevron sang cộng đồng), lịch sử giao dịch (Hóa đơn thật, "Tải tất cả (CSV)"). |
| `billing/api.ts`, `queries.ts` | Gọi `/me/payment-methods*`, `/me/billing-summary`; gom toàn bộ giao dịch (≤20 trang x 100) cho CSV và hoàn tiền. Dùng lại `features/payments` cho gói/giao dịch/hóa đơn/hoàn tiền. |
| `billing/CardModal.tsx` | Thêm/cập nhật thẻ. Số thẻ + CVC chỉ nằm trong state hộp thoại: kiểm Luhn/hạn/CVC và tokenize bằng `lib/card.ts`, chỉ gửi token + brand + 4 số cuối + hạn. |
| `billing/SubscriptionModal.tsx` | "Quản lý" gói: hủy cuối kỳ, **hủy ngay** (checkbox), kích hoạt lại (resume), **Yêu cầu hoàn tiền** (giao dịch gần nhất còn hoàn được). Giữ đủ năng lực của `/billing` cũ. |
| `billing/RefundModal.tsx` | Gửi `POST /payments/:id/refund-request`, hiện kết quả tự duyệt/chờ duyệt. Trạng thái hoàn tiền lấy từ `refundStatus` của `/me/payments` (không còn lưu localStorage). |
| `billing/csv.ts` | CSV có BOM, tiêu đề tiếng Việt: Ngày, Mô tả, Số tiền (USD), Đã hoàn (USD), Trạng thái, Số hóa đơn. Dựng ở client từ dữ liệu API. |
| `billing/Modal.tsx` | Hộp thoại đúng bản thiết kế (≤460px, bo 22px); dùng chung với tab giới thiệu. |

Hành vi: xóa thẻ có hộp thoại xác nhận; thẻ đang gia hạn cho gói mà không còn thẻ khác → thông báo lỗi của server (`CARD_IN_USE`). Gói đã hủy cuối kỳ hiện "Đã hủy" + "Hết hạn <ngày>" và vẫn dùng được tới ngày đó. Không gói/thẻ/giao dịch → có trạng thái trống.

## Giới thiệu (`ReferralTab`)
- 2 tab con (creator / member) đổi toàn bộ số liệu; hero lấy tỉ lệ và số ngày từ server (`rates`), "Sao chép" ghi vào clipboard thật (có fallback `execCommand`).
- 4 KPI thật; mũi tên delta chỉ hiện khi có số liệu kỳ trước (không có thì ẩn); trạng thái trống khi chưa ai đăng ký.
- Bảng "Người bạn đã giới thiệu": avatar chip, huy hiệu trạng thái, "Xem tất cả N / Thu gọn" (ẩn khi ≤4 người). Menu ⋯: **Gửi tin nhắn** (`useStartConversation` → `/messages/:id`; lỗi của API tin nhắn, vd. không chung cộng đồng, hiện bằng toast), **Chi tiết hoa hồng** (hộp thoại liệt kê từng khoản, tổng thật), **Nhắc nâng cấp gói** (chỉ dòng "Đang dùng thử"; gửi thông báo trong app thật, 1 lần/24h).
- Tiền: hoa hồng member theo USD (`formatCents`), creator theo VND (`formatMoney`).

## Khác biệt so với mockup
- **Tiền tệ**: mockup hiện "149.000đ"; gói thành viên lưu USD cent nên hiển thị `$7.00` bằng `formatCents` như các trang khác (A16 chưa thống nhất 1 đơn vị tiền). Không quy đổi tỉ giá. Gói năm quy `/12` ở server (`$48/năm` → `$4.00` trong "Tổng mỗi tháng").
- Ngày hiển thị `dd/MM/yyyy` (mockup có chỗ `15/10`).
- Menu thẻ luôn có "Xóa thẻ" (mockup ẩn khi chỉ còn 1 thẻ); server chặn khi thẻ còn cần cho gói.
- Thêm trạng thái "Đang dùng thử" (amber) cho gói thử và nhãn "Chưa trả phí / Chưa tham gia" cho người được giới thiệu chưa phát sinh gì.
- Ô thương hiệu thẻ: chữ nghiêng đậm theo brand (VISA/MC/AMEX/DISC/JCB/…), không dùng logo ảnh.
- Hộp thoại "Quản lý" có thêm "Hủy ngay" và "Yêu cầu hoàn tiền" (mockup chỉ có Hủy gói/Kích hoạt lại).
- Card tối: ngày trừ tiền kèm "(hết dùng thử)" khi gói đang thử.
- Thẻ "Nâng cấp"/promo ở sidebar thuộc `SettingsLayout`, không đụng tới.

## Còn thiếu / giả định
- Server không thể kiểm Luhn (không thấy số thẻ); thẻ mock không được cổng "xác thực" khi thêm — chỉ thất bại khi trừ tiền (token `tok_mock_declined`).
- "Thẻ mặc định" = thẻ có `createdAt` mới nhất (chưa có cột `isDefault`).
- Hoa hồng creator chưa phát sinh vì chưa có luồng trừ tiền gói hosting; chưa có chi trả tự động (`pending → paid`).
- Mã giới thiệu trong `localStorage` hết hạn sau 60 ngày phía client (hằng số), còn cửa sổ hiệu lực thật do server tính từ lúc đăng ký.
