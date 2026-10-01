# Cập nhật UI vòng đời tiền

- Owner `RevenuePage`: "Có thể rút ngay" (availableBalanceCents), "Đang giữ" (heldCents), "Quỹ dự phòng" (reserveCents), cảnh báo nợ (debtCents>0 -> khóa form rút), đoạn chính sách từ `payoutPolicy`; kiểm tra số tiền <= withdrawable phía client; map mã lỗi `PAYOUT_BLOCKED`, `COMMUNITY_LOCKED`; nhãn `failed`/`on_hold` cho lệnh rút. Mức rút tối thiểu vẫn do server kiểm.
- Admin (`PaymentsViews.tsx`, `types.batch2.ts`): Doanh thu creator (KPI + cột Có thể rút/Đang giữ/Dự phòng/Nợ, cả trang chi tiết), chi tiết Chi trả (khối số dư creator), Hoàn tiền thêm trạng thái/tab `refunding` "Đang hoàn tiền".
- Billing: nhãn "Sẽ kết thúc vào <ngày>" khi `cancelAtPeriodEnd` (active/trialing, ngày = accessUntil ?? currentPeriodEnd). Rời cộng đồng có phí (CourseDetailPage) có xác nhận nêu rõ hủy cuối kỳ; FAQ cập nhật.
- Hoàn tiền của user vẫn lưu localStorage `sofin:refund:<id>`: backend chưa có `GET /me/refunds` (đã grep).
