# -*- coding: utf-8 -*-
"""Rà soát case lỗi thời sau khi BỎ DÙNG THỬ MIỄN PHÍ của thành viên (2026-10-14): cộng đồng chỉ có 2 loại - miễn phí hoặc trả phí.
Đã xóa POST /courses/:id/trial và POST /communities/:id/trial (404), checkout-quote luôn trialDays 0 / trialEligible false,
Community.memberTrialEnabled luôn false trong API, ghi chú giá không còn 'Miễn phí dùng thử N ngày'.
KHÔNG loại: dùng thử gói HOSTING của owner (14 ngày, wizard bước 2), gói trialing CŨ còn trong dữ liệu (seed member3, hết hạn/nhắc/chuyển active)
- thay bằng TC-BANK-050/051. Mã tính bằng cách nạp các cases_*.py (xem gen_testcases.py)."""

_R_ROUTE = 'Không còn dùng thử miễn phí của thành viên (bỏ 2026-10-14): POST /courses/:id/trial và POST /communities/:id/trial trả 404 nên các bước bắt đầu dùng thử / kết quả 201, 409, 400, 403 của đường này không còn đúng - thay bằng TC-BANK-050.'
_R_UI = 'Hộp thoại/trang chi tiết không còn CTA "Bắt đầu dùng thử miễn phí", ghi chú dùng thử hay "Miễn phí dùng thử N ngày" (quote.trialDays luôn 0, trialEligible false, CTA luôn "Thanh toán") - thay bằng TC-BANK-050/051.'
_R_QUOTE = 'checkout-quote luôn trả trialDays 0 / trialEligible false / firstChargeDate = startsAt / remindAt null / dueTodayUsd = giá kỳ (không còn phụ thuộc payments.trialDays hay người đã dùng thử) nên kết quả mong đợi (trialDays 7, ngày thu tiền lùi, nhắc trước) không còn đúng - thay bằng TC-BANK-050.'
_R_FLAG = 'Community.memberTrialEnabled luôn false trong API và bị bỏ qua khi tạo/sửa/wizard (schema vẫn nhận field nhưng không lưu); trialDays của bước thành viên luôn 0 nên kết quả mong đợi (memberTrialEnabled true, trialDays 7, tóm tắt "dùng thử 7 ngày") không còn đúng - thay bằng TC-BANK-050.'
_R_MATRIX = 'Ma trận có dòng "trial": đường /trial đã bỏ nên trả 404 thay vì 403/404 theo trạng thái cộng đồng/người dùng; các dòng khác (checkout, confirm, gia hạn...) vẫn đúng và được kiểm bằng test tự động tests/money-lifecycle.test.ts.'

RETIRED = {}
def _mark(reason, codes):
    for c in codes:
        RETIRED[c] = reason

_mark(_R_ROUTE, [
    'TC-PAY-058', 'TC-PAY-059', 'TC-PAY-060', 'TC-PAY-061', 'TC-PAY-062', 'TC-PAY-063', 'TC-PAY-064', 'TC-PAY-065', 'TC-PAY-079',
    'TC-INTEG-022',
    'TC-MONEY-012', 'TC-MONEY-025', 'TC-MONEY-085', 'TC-MONEY-091', 'TC-MONEY-092', 'TC-MONEY-142',
    'TC-ANN-055', 'TC-ANN-064', 'TC-ANN-096', 'TC-ANN-098', 'TC-ANN-099', 'TC-ANN-100', 'TC-ANN-101', 'TC-ANN-103', 'TC-ANN-108',
    'TC-ANN-110', 'TC-ANN-112', 'TC-ANN-123', 'TC-ANN-144', 'TC-ANN-148', 'TC-ANN-150',
    'TC-ADM3-384',
    'TC-BANK-037', 'TC-BANK-038', 'TC-BANK-049',
    'TC-SETB-029', 'TC-SETB-032', 'TC-SETB-075',
    'TC-SETR-020', 'TC-SETR-042',
])
_mark(_R_UI, [
    'TC-ANN-015', 'TC-ANN-047', 'TC-ANN-049',
    'TC-ANN-130', 'TC-ANN-131', 'TC-ANN-132', 'TC-ANN-133', 'TC-ANN-134', 'TC-ANN-135', 'TC-ANN-136', 'TC-ANN-137', 'TC-ANN-138',
    'TC-SPLIT-127', 'TC-SPLIT-142', 'TC-SPLIT-143', 'TC-COURSE-108',
    'TC-HOME-009',
])
_mark(_R_QUOTE, ['TC-ANN-052', 'TC-ANN-066', 'TC-ANN-072', 'TC-ANN-073', 'TC-ANN-074', 'TC-ANN-075'])
_mark(_R_FLAG, [
    'TC-ANN-139',
    'TC-WIZ-102', 'TC-WIZ-108', 'TC-WIZ-109', 'TC-WIZ-122', 'TC-WIZ-125', 'TC-WIZ-129', 'TC-WIZ-136', 'TC-WIZ-194', 'TC-WIZ-196', 'TC-WIZ-219',
])
_mark(_R_MATRIX, ['TC-MONEY-133', 'TC-MONEY-135', 'TC-MONEY-136', 'TC-MONEY-137'])
# Lý do riêng cho vài case cần nói rõ hơn.
RETIRED['TC-HOME-009'] = 'Bộ lọc giá không còn mục "Dùng thử miễn phí" (pricing=trial): cộng đồng chỉ có Miễn phí hoặc Có phí, dữ liệu pricing "trial" đã chuyển sang "paid" (migration 20261014110000_remove_member_trial) - thay bằng TC-BANK-051.'
RETIRED['TC-COURSE-108'] = 'Ghi chú giá của trang chi tiết cộng đồng chỉ còn "Hủy bất kỳ lúc nào" (không còn "Miễn phí dùng thử N ngày" lấy từ Cài đặt chung) - kết quả mong đợi của case này không còn đúng.'
