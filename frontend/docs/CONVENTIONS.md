# Quy ước viết frontend (bắt buộc cho mọi agent/người làm FE)

Stack: React 19 + Vite + TypeScript (strict) + Tailwind v4 + TanStack Query v5 + React Router v7. Giao diện tiếng Việt.

## Cấu trúc
- Theo tính năng: `src/features/<tên>/{api.ts, queries.ts, types.ts, components/}`; trang đầy đủ ở `src/pages/*Page.tsx`; route khai báo trong `src/App.tsx`.
- Mọi lời gọi API đi qua `src/lib/api.ts` (`apiGet/apiPost/apiPatch...` — đọc file này trước; nó tự gắn access token, tự refresh khi 401, ném `ApiError` có `status` và `code`). Không dùng `fetch` trực tiếp trừ upload PUT tới URL ký sẵn hoặc SSE (`EventSource`). Nếu thiếu `apiPut/apiPatch/apiDelete` thì THÊM (không đổi hành vi cũ).
- Dữ liệu server = React Query (`useQuery/useMutation`); mutation phải `invalidateQueries` đúng key. Theo mẫu `features/community/queries.ts`.
- Kiểu dữ liệu FE khai báo trong `types.ts` của feature, khớp response thật ở `backend/docs/api/*.md` (đọc kỹ file tài liệu tương ứng; `backend/docs/API.md` là mục lục + bảng phân quyền + mã lỗi).
- Icon: `components/ui/MaterialIcon` (Material Symbols Rounded, tên icon như trong Google Fonts). Form: `FormField`, `FieldMessage`, `Button` trong `components/ui/`.

## Giao diện (Liquid Glass — giữ đồng nhất với các trang đã dựng)
- Màu thương hiệu cam `brand` (#f26a1b), `brand-soft`, `brand-dark`; tiện ích `glass`, `glass-chip` (xem `src/index.css`); bo góc lớn (rounded-2xl/3xl), chữ Plus Jakarta Sans.
- Xem `features/community/components/*Tab.tsx`, `pages/CourseDetailPage.tsx`, `pages/LoginPage.tsx` để bắt chước kiểu thẻ, nút, chip, bảng, hộp thoại, trạng thái loading/empty/lỗi.
- Trang MỚI chưa có mockup: dựng theo phong cách hiện có, gọn, đẹp, responsive (chạy được ở ≥360px). KHÔNG bịa dữ liệu — mọi số liệu/nội dung phải từ API thật.
- Mọi hành động phải có phản hồi: nút bị khóa khi đang gửi, hiện lỗi từ API (`ApiError.message`) bằng tiếng Việt, hiện trạng thái rỗng / đang tải. Validate ở FE chỉ để tiện — quyền hạn thật do BE quyết; ẩn/hiện nút theo `viewerRole` chỉ là UX.
- Không dùng `dangerouslySetInnerHTML` với nội dung người dùng (chỉ text; snippet tìm kiếm là mảng `{text, match}`).

## Quy tắc làm việc
- KHÔNG mở trình duyệt / Playwright để kiểm tra (người dùng tự test). Kiểm tra bằng `cd frontend && npx tsc -b` (phải sạch lỗi) và `npm run build` (phải build được).
- KHÔNG sửa backend (`backend/`). Nếu thiếu endpoint / response không đủ để làm UI → ghi vào mục "Thiếu ở BE" trong báo cáo cuối và làm phần còn lại; không bịa.
- Nhiều agent làm song song trong cùng repo: chỉ sửa file thuộc phạm vi được giao. Với file dùng chung (`src/App.tsx`, `src/lib/api.ts`, `components/layout/Header.tsx`, `features/community/components/CommunityTopbar.tsx`, `CommunitySidebar.tsx`, `pages/CommunityPage.tsx`) chỉ sửa khi được giao hoặc cần thêm 1-vài dòng nhỏ (thêm route, thêm hàm) — LUÔN đọc lại file ngay trước khi sửa vì người khác có thể vừa đổi, và dùng sửa cục bộ (Edit), không ghi đè cả file.
- Tool Bash trong môi trường này hay lỗi parse khi lệnh có heredoc dài/nhiều dấu nháy: tạo/sửa file bằng Write/Edit; Bash chỉ cho lệnh ngắn.

## Tài liệu (bắt buộc)
Mỗi nhóm viết `docs/features/<nhóm>.md` (thư mục `docs/` ở GỐC repo, tiếng Việt) cho người TEST THỦ CÔNG, gồm từng tính năng: đường dẫn/route hoặc vị trí nút, ai dùng được (vai trò), điều kiện cần (tài khoản/dữ liệu), các bước thao tác, kết quả mong đợi, và các trường hợp lỗi cần thử (không đủ quyền, dữ liệu sai...). Viết như kịch bản test để người test làm theo được ngay. Thêm mục "Chưa làm / giới hạn / Thiếu ở BE".
