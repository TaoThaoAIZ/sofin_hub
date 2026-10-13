# Trang Tải Tool (`/tools`)

Clone từ https://taothaoai.com/tools (nguồn tham chiếu: `taothao_ai_training` — `src/lib/toolsCatalog.ts`, `src/features/tools-download/*`), giao diện dùng style SofinHub (kính mờ, cam `#f26a1b`).

- Trang: `frontend/src/pages/ToolsPage.tsx` (route `/tools`, công khai); mục menu "Tải Tool" ở `Header`.
- Dữ liệu: `frontend/src/features/tools/catalog.ts` — 7 tool, danh mục Video AI / Automation / Voice AI / VIP. Tĩnh, không gọi API. Icon ở `frontend/public/images/tools/`.
- Thẻ: `ToolCard.tsx` — badge HOT/MỚI, tool miễn phí mở `https://taothaoai.com/microdrama` (tab mới), tool có phí mở popup.
- Popup mua: `ToolLeadForm.tsx` — họ tên, SĐT (VN), email; gửi `POST /api/tools/lead` (email không bắt buộc) → tạo ticket Admin > Hỗ trợ + thư tới `SUPPORT_EMAIL` + tin Telegram "YÊU CẦU MUA TOOL MỚI" tới nhóm `TELEGRAM_CHAT_ID` (cùng nhóm taothaoai). Code: `backend/src/modules/support/` (`toolLead`).
- i18n: namespace `tools` (vi/en).
- Chưa làm: bảng lead riêng, banner khuyến mãi/đếm ngược của trang gốc, giá bán cụ thể.
- Test case: module `TOOLS` (`qa/cases_tools.py`).
