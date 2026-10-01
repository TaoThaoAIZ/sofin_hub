# Rà soát phần 5: ADM, ADM2, ADM3, SECX, MONEY, GAME, INFRA, PERF, SPLIT

Cách làm: đối chiếu từng case với `backend/src` (admin-staff.permissions.ts, admin-content.service.ts, admin-moderation.service.ts, communities.service.ts, community-alias.ts, routes.ts, jobs.ts, settings), `frontend/src` (App.tsx, features/admin/*), `docs/features/*`, `backend/docs/api/*`. Case RETIRED nằm ở `qa/retired_part_5.py` (không xóa dòng nguồn). Case UPDATE sửa tại chỗ (giữ nguyên tiêu đề). 1 case mới thêm cuối ADM3 (TC-ADM3-419).

## Tổng hợp theo module

| Module | Tổng (sau thêm) | Loại (RETIRE) | Sửa tại chỗ | Giữ nguyên |
|---|---|---|---|---|
| ADM | 290 | 25 | 7 | 258 |
| ADM2 | 337 | 34 | 12 | 291 |
| ADM3 | 419 | 61 | 0 | 358 |
| SECX | 130 | 19 | 0 | 111 |
| MONEY | 163 | 10 | 0 | 153 |
| GAME | 92 | 2 | 0 | 90 |
| INFRA | 93 | 9 | 0 | 84 |
| PERF | 90 | 5 | 0 | 85 |
| SPLIT | 150 | 17 | 0 | 133 |
| **Cộng** | 1764 | 182 | 19 | 1563 |

Ghi chú: ADM3 = 418 gốc + 1 case thay thế mới (TC-ADM3-419, đã tính vào cột Tổng). Hai hằng tiền điều kiện (SEED của ADM, SEED_CRS/SEED_LSN của ADM2) cũng được sửa nên ảnh hưởng chữ ở nhiều case nhưng không tính vào cột 'Sửa'.

## Mẫu lỗi thời chính

- Admin > Nội dung > Khóa học từng là ClassroomModule (ADM2): sau tách Community/Course là entity Course -> số đếm, id, thumbnail, route lớp học đổi (ADM2-070..084).
- Mục 'Sắp có' và các 'Kế hoạch' đã làm xong (Moderator/Finance/Support, nhóm Nội dung/Thanh toán..., lọc audit theo admin, hủy gói khi xóa/đình chỉ cộng đồng) - ADM-025..030, 138, 277, 278, 287, 290; ADM2-326, 337.
- Số dư owner: availableBalanceCents đổi nghĩa 'có thể rút ngay' (holding 14 ngày + dự phòng 10% + nợ); admin có thêm cột số dư; hoàn tiền có trạng thái refunding.
- POST /api/courses không còn là route tạo cộng đồng (chỉ POST /api/communities); /courses/:id/* chỉ còn là bí danh API và FE redirect, không còn trang /courses.
- Ma trận phân quyền ADM3 sinh 2 chiều (role x đợt = 15 case và route x vai trò = 41 case) + 11 case 'quyền X cho Y' lặp cùng thông tin: giữ chiều theo route, loại phần còn lại.
- Case 'mở trực tiếp trang X' sinh hàng loạt (ADM2 16 + ADM3 18) cùng cơ chế lazy route: giữ 1 đại diện mỗi đợt.

## Bảng UPDATE (sửa tại chỗ)

| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-ADM-112 | UPDATE | Bước dùng /courses (khám phá) và POST... -> trang chủ + GET /api/communities; FE không còn trang /courses (App.tsx:54-58, /courses/:id chỉ là LegacyCourseRedirect) |
| TC-ADM-113 | UPDATE | Như TC-ADM-112 (kiểm tra danh sách công khai sau khi duyệt) |
| TC-ADM-137 | UPDATE | Tạo cộng đồng test bằng POST /api/communities (catalog.routes.ts/communities.routes.ts:24 chỉ có POST /communities; POST /courses không còn là route tạo) |
| TC-ADM-181 | UPDATE | Bước tạo cộng đồng: POST /api/courses -> POST /api/communities (cùng lý do TC-ADM-137) |
| TC-ADM-183 | UPDATE | Bước tạo cộng đồng của ethan: POST /api/courses -> POST /api/communities |
| TC-ADM-218 | UPDATE | assignees: ngoài Platform Admin còn mọi nhân viên có report.resolve; john/mia là Moderator nên canBeAssigned=true (admin-moderation.service.ts:136-145) |
| TC-ADM-276 | UPDATE | [Kế hoạch] Bước tạo cộng đồng dùng POST /api/communities; danh sách công khai = GET /api/communities |
| (hằng SEED của ADM) | UPDATE | Tiền điều kiện chung của ADM: john.carter/mia.lopez nay là nhân viên Moderator (README 'Admin đợt 3'), không còn là 'không có quyền admin' |
| TC-ADM2-070 | UPDATE | Khóa học admin = entity Course (admin-content.service.ts:207-262): bỏ số đếm cứng 124/121/1/1/1 và phụ đề cũ; phụ đề FE: 'Khóa học nằm trong các cộng đồng...' (ContentViews.tsx:520); id là id khóa học |
| TC-ADM2-071 | UPDATE | Kết quả tìm: khóa của Code Camp/Growth Lab thay cho '4 mô-đun' |
| TC-ADM2-072 | UPDATE | Tab Nháp có 2 dòng (System Design Drafts + 'Quản trị rủi ro (bản nháp)' của fin từ seed tách Community/Course) |
| TC-ADM2-080 | UPDATE | Id Node.js from Zero là id khóa học (không còn uuid mô-đun 8da8a3b9); thumbnail = thumbnailUrl; thêm modules/moduleList (admin-batch2.md A3) |
| TC-ADM2-082 | UPDATE | Route kiểm tra: /communities/:id/courses[/:courseId/modules] thay cho /courses/growth-lab/modules (chỉ là khóa mặc định - communities-courses.md mục 0.4; classroom.routes.ts:61-111) |
| TC-ADM2-085 | UPDATE | Bỏ số '≈473' bài (seed tách khóa học thêm bài photo/yt/fin) -> khớp /content/lessons/summary |
| TC-ADM2-175 | UPDATE | Thêm tab 'Đang hoàn tiền' (refunding): 4 tab, đếm 5/0/4/2 (PaymentsViews.tsx:463-466) |
| TC-ADM2-186 | UPDATE | summary thêm trường refunding (audit bước 2, payments.md/admin-batch2.md) |
| TC-ADM2-205 | UPDATE | Thêm 4 KPI/cột mới Có thể rút/Đang giữ/Dự phòng/Nợ (PaymentsViews.tsx:738-742, 756-760; money-ui-update.md) |
| TC-ADM2-210 | UPDATE | Chi tiết creator có KPI/cột số dư mới (PaymentsViews.tsx:811-815, 837-841) |
| TC-ADM2-214 | UPDATE | pendingBalanceCents KHÔNG còn bằng availableBalanceCents của owner (availableBalanceCents đổi nghĩa 'có thể rút ngay' - TC-MONEY-080; admin-payments.service.ts:629) |
| TC-ADM2-220 | UPDATE | Khối 'Số dư creator' ở chi tiết Chi trả: thêm Net-đã yêu cầu/Có thể rút ngay/Đang giữ/Dự phòng/Nợ (PaymentsViews.tsx:897-900) |
| (hằng SEED_CRS, SEED_LSN của ADM2) | UPDATE | Mô tả seed khóa học/bài học theo entity Course, số đếm tương đối |
| TC-ADM3-419 (mới) | APPEND | Thay TC-ADM3-238: /contact có form gửi POST /api/contact (App.tsx:78, frontend/src/features/support/api.ts:14); còn thiếu màn 'Ticket của tôi' |

## Bảng RETIRE

| TC | Quyết định | Lý do / bằng chứng |
|---|---|---|
| TC-ADM-012 | RETIRE | Trùng UI: chặn non-staff dùng cùng guard AdminLayout.tsx:387 như TC-ADM-011; phần API owner/cadmin đã có TC-ADM-004/005 |
| TC-ADM-013 | RETIRE | Trùng UI: chặn non-staff dùng cùng guard AdminLayout.tsx:387 như TC-ADM-011; phần API owner/cadmin đã có TC-ADM-004/005 |
| TC-ADM-025 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-026 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-027 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-028 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-029 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-030 | RETIRE | Lỗi thời: mục 'Sắp có' đã xóa (docs/features/admin-batch3.md 'Không còn Sắp có'; AdminRoutes không còn ComingSoon); TC-ADM2-001/TC-ADM3-019 đã kiểm tra |
| TC-ADM-138 | RETIRE | Lỗi thời: xóa/đình chỉ cộng đồng nay kết thúc/ngừng gia hạn gói (admin-communities.service.ts:413,440 endAllForCommunity; TC-MONEY-019/022) |
| TC-ADM-249 | RETIRE | Thay bởi TC-ADM3-350: trang audit nay có cột vai trò/IP/Vụ việc, seed >11 dòng sau đợt 2/3 |
| TC-ADM-250 | RETIRE | Trùng TC-ADM3-351/352 (bộ lọc Quản trị viên/Nhóm/Hành động/ngày + tìm kiếm) |
| TC-ADM-251 | RETIRE | Trùng TC-ADM3-357 (API audit-logs lọc actor/action/tiền tố/targetType/targetId/q/from/to) |
| TC-ADM-252 | RETIRE | Trùng TC-ADM3-357 (API audit-logs lọc actor/action/tiền tố/targetType/targetId/q/from/to) |
| TC-ADM-261 | RETIRE | Trùng TC-ADM3-394 (hiệu năng audit/support/admin < 1s) |
| TC-ADM-262 | RETIRE | Trùng TC-ADM2-175..188 và TC-ADM2-221/226 (hoàn tiền/chi trả trong khung admin); dùng id seed cũ 'demo-paid-demo-2/seed-pay-pendref' |
| TC-ADM-263 | RETIRE | Trùng TC-ADM2-175..188 và TC-ADM2-221/226 (hoàn tiền/chi trả trong khung admin); dùng id seed cũ 'demo-paid-demo-2/seed-pay-pendref' |
| TC-ADM-264 | RETIRE | Trùng TC-ADM2-175..188 và TC-ADM2-221/226 (hoàn tiền/chi trả trong khung admin); dùng id seed cũ 'demo-paid-demo-2/seed-pay-pendref' |
| TC-ADM-265 | RETIRE | Trùng TC-ADM2-175..188 và TC-ADM2-221/226 (hoàn tiền/chi trả trong khung admin); dùng id seed cũ 'demo-paid-demo-2/seed-pay-pendref' |
| TC-ADM-266 | RETIRE | Trùng TC-ADM-011 và TC-ADM2-020 (member bị chặn trang admin) |
| TC-ADM-268 | RETIRE | Trùng TC-ADM-015 (/admin/reports chuyển hướng); 'AdminPage cũ không còn' là chi tiết cài đặt, không phải hành vi kiểm thử |
| TC-ADM-277 | RETIRE | Đã làm: TC-MONEY-019/021/022 phủ (admin-communities.service.ts:413,440; communities.service.ts:145,159) |
| TC-ADM-278 | RETIRE | Đã làm: vai trò Moderator/Support/Finance + quyền theo route (admin-staff.permissions.ts); phủ bởi ADM3 ma trận quyền |
| TC-ADM-279 | RETIRE | Trùng TC-ADM3-395/396 (2FA/require2fa chưa thật) |
| TC-ADM-287 | RETIRE | Đã làm: AuditView có bộ lọc Quản trị viên/Hành động/ngày (TC-ADM3-351) |
| TC-ADM-290 | RETIRE | Đã làm: nhóm Nội dung/Thanh toán/Khám phá/Phân tích/Hỗ trợ/Hệ thống đã có (admin-batch2/3.md, nav.ts) |
| TC-ADM2-003 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-004 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-005 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-006 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-007 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-008 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-009 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-010 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-011 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-012 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-013 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-014 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-015 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-016 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-017 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-018 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 16 lần cùng cơ chế lazy route (AdminRoutes.tsx); giữ TC-ADM2-002 đại diện, từng trang đã có case riêng |
| TC-ADM2-021 | RETIRE | Trùng UI guard: cùng đường chặn non-staff như TC-ADM2-020 / TC-ADM-011 (AdminLayout.tsx:387) |
| TC-ADM2-022 | RETIRE | Trùng UI guard: cùng đường chặn non-staff như TC-ADM2-020 / TC-ADM-011 (AdminLayout.tsx:387) |
| TC-ADM2-023 | RETIRE | Trùng UI guard: cùng đường chặn non-staff như TC-ADM2-020 / TC-ADM-011 (AdminLayout.tsx:387) |
| TC-ADM2-025 | RETIRE | Trùng TC-ADM2-024 (46 route 401/403) và ma trận TC-ADM3-054..094 |
| TC-ADM2-083 | RETIRE | Lỗi thời: 'mô-đun' (ClassroomModule) nay là Khóa học (Course) - admin-content.service.ts:207; /courses/:id/modules chỉ là khóa mặc định (communities-courses.md mục 0.4); thay bởi TC-SPLIT-044/053/061/096 |
| TC-ADM2-084 | RETIRE | Lỗi thời: Khóa học admin không còn là ClassroomModule; thumbnail = thumbnailUrl (admin-content.service.ts:248); thay bởi TC-SPLIT-094 |
| TC-ADM2-119 | RETIRE | Trùng: trạng thái tải/lỗi dùng chung DataTable, đã có TC-ADM2-038 |
| TC-ADM2-124 | RETIRE | Thay bởi TC-SECX-094: nút Xem trước Media nay mở qua URL ký (POST /files/:key/url) |
| TC-ADM2-140 | RETIRE | Trùng: trạng thái rỗng/tải/lỗi dùng chung DataTable, đã có TC-ADM2-038 |
| TC-ADM2-158 | RETIRE | Trùng TC-MONEY-059 (hoàn tiền giao dịch kỳ hiện tại hủy gói + thu hồi quyền) |
| TC-ADM2-190 | RETIRE | Trùng TC-MONEY-050/056/151 (cửa sổ hoàn tiền 7 ngày tự duyệt/chờ admin, biên) |
| TC-ADM2-249 | RETIRE | Trùng: trạng thái tải/lỗi/rỗng DataTable, đã có TC-ADM2-038 |
| TC-ADM2-305 | RETIRE | Lỗi thời: nhãn audit đã Việt hóa bằng auditLabel (frontend/src/features/admin/types.batch3.ts:449, Batch2Parts.tsx:365); phần còn mã thô: TC-ADM3-354 |
| TC-ADM2-311 | RETIRE | Trùng TC-ADM2-310: cùng pageQuery dùng chung (admin-b2.common.ts) |
| TC-ADM2-312 | RETIRE | Trùng TC-ADM2-310: cùng pageQuery dùng chung (admin-b2.common.ts) |
| TC-ADM2-326 | RETIRE | Lỗi thời: trạng thái 'Đang hoàn tiền' (refunding) đã có (PaymentsViews.tsx:464); xem TC-MONEY-064/065 |
| TC-ADM2-336 | RETIRE | Trùng TC-ADM3-418; các giá trị tạm nay chỉnh được ở Cài đặt chung |
| TC-ADM2-337 | RETIRE | Đã làm: kick/ban/xóa/khóa kết thúc gói (TC-MONEY-017/018/019/021/022) |
| TC-ADM3-007 | RETIRE | Trùng TC-ADM3-006 (cùng GuardedOutlet AdminLayout.tsx:313 + requiredPerm); từng vai trò đã có case sidebar 002..005 |
| TC-ADM3-008 | RETIRE | Trùng TC-ADM3-006 (cùng GuardedOutlet AdminLayout.tsx:313 + requiredPerm); từng vai trò đã có case sidebar 002..005 |
| TC-ADM3-009 | RETIRE | Trùng TC-ADM3-006 (cùng GuardedOutlet AdminLayout.tsx:313 + requiredPerm); từng vai trò đã có case sidebar 002..005 |
| TC-ADM3-021 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-022 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-023 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-024 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-025 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-026 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-027 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-028 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-029 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-030 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-031 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-032 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-033 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-034 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-035 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-036 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-037 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-038 | RETIRE | Trùng: smoke 'mở trực tiếp trang' lặp 18 lần cùng cơ chế lazy route; giữ TC-ADM3-020 đại diện, mỗi trang có case riêng |
| TC-ADM3-039 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-040 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-041 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-042 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-043 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-044 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-045 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-046 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-047 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-048 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-049 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-050 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-051 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-052 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-053 | RETIRE | Trùng ma trận: chiều role x đợt lặp lại thông tin của 41 case theo route TC-ADM3-054..094 (cùng bảng PERMS/admin-staff.permissions.ts) |
| TC-ADM3-096 | RETIRE | Trùng TC-ADM3-097 và 054..094 (401/403 non-staff) |
| TC-ADM3-103 | RETIRE | Trùng ma trận route (TC-ADM3-058/059/068/074); khoảng trống nút theo quyền đã nằm ở TC-ADM3-408 |
| TC-ADM3-104 | RETIRE | Trùng ma trận route (TC-ADM3-058/059/068/074); khoảng trống nút theo quyền đã nằm ở TC-ADM3-408 |
| TC-ADM3-119 | RETIRE | Trùng: chip 7/30/90 lặp cho 6 trang Phân tích cùng DateRangeChips; giữ TC-ADM3-115 |
| TC-ADM3-121 | RETIRE | Trùng: trạng thái lỗi/tải lặp cho 6 trang Phân tích cùng khối; giữ TC-ADM3-117 |
| TC-ADM3-123 | RETIRE | Trùng: chip 7/30/90 lặp cho 6 trang Phân tích cùng DateRangeChips; giữ TC-ADM3-115 |
| TC-ADM3-125 | RETIRE | Trùng: trạng thái lỗi/tải lặp cho 6 trang Phân tích cùng khối; giữ TC-ADM3-117 |
| TC-ADM3-127 | RETIRE | Trùng: chip 7/30/90 lặp cho 6 trang Phân tích cùng DateRangeChips; giữ TC-ADM3-115 |
| TC-ADM3-129 | RETIRE | Trùng: trạng thái lỗi/tải lặp cho 6 trang Phân tích cùng khối; giữ TC-ADM3-117 |
| TC-ADM3-131 | RETIRE | Trùng: chip 7/30/90 lặp cho 6 trang Phân tích cùng DateRangeChips; giữ TC-ADM3-115 |
| TC-ADM3-133 | RETIRE | Trùng: trạng thái lỗi/tải lặp cho 6 trang Phân tích cùng khối; giữ TC-ADM3-117 |
| TC-ADM3-135 | RETIRE | Trùng: chip 7/30/90 lặp cho 6 trang Phân tích cùng DateRangeChips; giữ TC-ADM3-115 |
| TC-ADM3-137 | RETIRE | Trùng: trạng thái lỗi/tải lặp cho 6 trang Phân tích cùng khối; giữ TC-ADM3-117 |
| TC-ADM3-162 | RETIRE | Trùng ma trận TC-ADM3-081/082 (analytics.view) |
| TC-ADM3-205 | RETIRE | Trùng TC-ADM3-003/004/005/007 + 083/084 (support.manage, UI guard) |
| TC-ADM3-224 | RETIRE | Trùng TC-ADM3-083/084 (support.manage) |
| TC-ADM3-238 | RETIRE | Lỗi thời: đã có trang /contact gửi POST /api/contact (App.tsx:78, frontend/src/features/support/api.ts:14); thay bằng case mới cuối module |
| TC-ADM3-264 | RETIRE | Trùng TC-ADM3-087/088 (admin.manage) |
| TC-ADM3-283 | RETIRE | Trùng TC-ADM3-085 (community.manage cho categories) |
| TC-ADM3-298 | RETIRE | Trùng TC-ADM3-086 (system.flags) |
| TC-ADM3-309 | RETIRE | Trùng TC-ADM3-089 (system.settings tích hợp) |
| TC-ADM3-326 | RETIRE | Trùng TC-ADM3-090 (system.settings thông báo) |
| TC-ADM3-349 | RETIRE | Trùng TC-ADM3-091 (system.settings mẫu email) |
| TC-ADM3-362 | RETIRE | Trùng TC-ADM3-062/093 (audit.view) |
| TC-ADM3-378 | RETIRE | Trùng TC-ADM3-092 (system.settings) |
| TC-GAME-037 | RETIRE | Kịch bản lặp lại TC-GAME-021/022/028/033 (locked: sửa/xóa/chuyển quyền/rút tiền) |
| TC-GAME-038 | RETIRE | Kịch bản lặp lại TC-GAME-021/022/028/033 (locked: sửa/xóa/chuyển quyền/rút tiền) |
| TC-INFRA-006 | RETIRE | Trùng TC-INFRA-003 (bước typecheck CI) |
| TC-INFRA-008 | RETIRE | Không phải kiểm thử sản phẩm (cố ý phá lint/build/test để thử CI) - thuộc nhóm dev |
| TC-INFRA-010 | RETIRE | Trùng TC-INFRA-003/TC-MONEY-163 (npm test xanh) |
| TC-INFRA-011 | RETIRE | Không phải kiểm thử sản phẩm (cố ý phá lint/build/test để thử CI) - thuộc nhóm dev |
| TC-INFRA-012 | RETIRE | Không phải kiểm thử sản phẩm (cố ý phá lint/build/test để thử CI) - thuộc nhóm dev |
| TC-INFRA-046 | RETIRE | Biến thể unit trùng TC-INFRA-045/TC-SECX-104 |
| TC-INFRA-050 | RETIRE | Trùng TC-SECX-015 (email production log-only) |
| TC-INFRA-070 | RETIRE | Không phải kiểm thử (ghi chú vận hành gói free) |
| TC-INFRA-093 | RETIRE | Trùng TC-INFRA-009 (script coverage) |
| TC-MONEY-020 | RETIRE | Tập con của ma trận TC-MONEY-133/134/135/137 (checkout/trial/confirm khi khóa/tạm ngưng/xóa/cấm) |
| TC-MONEY-022 | RETIRE | Tập con của ma trận TC-MONEY-133/134/135/137 (checkout/trial/confirm khi khóa/tạm ngưng/xóa/cấm) |
| TC-MONEY-031 | RETIRE | Tập con của ma trận TC-MONEY-133/134/135/137 (checkout/trial/confirm khi khóa/tạm ngưng/xóa/cấm) |
| TC-MONEY-127 | RETIRE | Trùng sau cập nhật TC-ADM2-205/210/220 (UI Admin Doanh thu creator + chi tiết payout có cột Có thể rút/Đang giữ/Dự phòng/Nợ) |
| TC-MONEY-128 | RETIRE | Trùng sau cập nhật TC-ADM2-205/210/220 (UI Admin Doanh thu creator + chi tiết payout có cột Có thể rút/Đang giữ/Dự phòng/Nợ) |
| TC-MONEY-129 | RETIRE | Trùng sau cập nhật TC-ADM2-205/210/220 (UI Admin Doanh thu creator + chi tiết payout có cột Có thể rút/Đang giữ/Dự phòng/Nợ) |
| TC-MONEY-130 | RETIRE | Trùng TC-ADM2-232 và TC-ADM3-079/080 (route cũ /admin/payouts) |
| TC-MONEY-132 | RETIRE | Trùng TC-ADM3-418 (giá trị nghiệp vụ tạm) |
| TC-MONEY-146 | RETIRE | Trùng TC-ADM-260/TC-ADM2-188 (audit hoàn tiền/chi trả) |
| TC-MONEY-150 | RETIRE | Không phải kiểm thử (nhắc quy trình reset); đã có ở tiền điều kiện MUTATE |
| TC-PERF-026 | RETIRE | Trùng TC-GAME-079 (trần page tìm kiếm) |
| TC-PERF-053 | RETIRE | Trùng TC-PERF-050 (0 truy vấn SELECT body khi mở bài học) |
| TC-PERF-057 | RETIRE | Tập con TC-PERF-056 (mọi FK có index) |
| TC-PERF-073 | RETIRE | Trùng TC-GAME-077 (feed ?page > 1000) |
| TC-PERF-081 | RETIRE | Trùng TC-GAME-056 (thông báo xin vào chỉ tới owner/admin thật) |
| TC-SECX-006 | RETIRE | Trùng TC-INFRA-027 (Dockerfile NODE_ENV=production) |
| TC-SECX-007 | RETIRE | Trùng TC-SECX-001 (thiếu NODE_ENV bị chặn) |
| TC-SECX-014 | RETIRE | Trùng TC-SECX-009 và TC-INFRA-023 (checklist outbox 404) |
| TC-SECX-017 | RETIRE | Trùng TC-SECX-016/018/020: cùng vòng quét biến dev- trong productionEnvProblems (env.ts) |
| TC-SECX-019 | RETIRE | Trùng TC-SECX-016/018/020: cùng vòng quét biến dev- trong productionEnvProblems (env.ts) |
| TC-SECX-029 | RETIRE | Trùng TC-INFRA-051 (cảnh báo Redis khi nhiều instance) |
| TC-SECX-032 | RETIRE | Biến thể unit của TC-SECX-030 |
| TC-SECX-036 | RETIRE | Biến thể unit của TC-SECX-035 |
| TC-SECX-053 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-054 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-055 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-056 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-057 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-058 | RETIRE | Trùng ma trận TC-SECX-098..103 (cùng purpose, chạy đủ vai trò anonymous/chủ/ngoài/admin) |
| TC-SECX-113 | RETIRE | Trùng TC-INFRA-016 (bảng env DEPLOY.md) |
| TC-SECX-118 | RETIRE | Trùng TC-SECX-035 (cookie HttpOnly/Path) |
| TC-SECX-128 | RETIRE | Không phải kiểm thử (quy trình khôi phục sau MUTATE) - đã ghi ở tiền điều kiện từng case |
| TC-SECX-129 | RETIRE | Trùng TC-SECX-023 (webhook khóa mặc định dev-) |
| TC-SECX-130 | RETIRE | Không phải kiểm thử (khẳng định không đổi TTL) |
| TC-SPLIT-016 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-018 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-019 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-021 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-022 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-023 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-024 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-025 | RETIRE | Mirror /communities ≡ /courses lặp: cùng communityAlias (backend/src/middlewares/community-alias.ts); giữ 013/014/017/020/026 đại diện |
| TC-SPLIT-035 | RETIRE | Redirect FE lặp: cùng LegacyCourseRedirect.tsx (App.tsx:57-58); giữ 033/034 |
| TC-SPLIT-036 | RETIRE | Redirect FE lặp: cùng LegacyCourseRedirect.tsx (App.tsx:57-58); giữ 033/034 |
| TC-SPLIT-037 | RETIRE | Redirect FE lặp: cùng LegacyCourseRedirect.tsx (App.tsx:57-58); giữ 033/034 |
| TC-SPLIT-038 | RETIRE | Redirect FE lặp: cùng LegacyCourseRedirect.tsx (App.tsx:57-58); giữ 033/034 |
| TC-SPLIT-097 | RETIRE | Trùng TC-ADM2-081 và 080 (chuyển trạng thái course admin, summary, 404/409/403) |
| TC-SPLIT-098 | RETIRE | Trùng TC-ADM2-072 (tab Nháp liệt kê khóa nháp; sau cập nhật gồm 'Quản trị rủi ro (bản nháp)') |
| TC-SPLIT-099 | RETIRE | Trùng ma trận TC-ADM3-063/064 (/admin/content/* = content.manage, admin-staff.permissions.ts) |
| TC-SPLIT-122 | RETIRE | Trùng TC-SPLIT-039 (liên kết thông báo/email cũ qua redirect) |
| TC-SPLIT-137 | RETIRE | Trùng TC-SPLIT-134/135/136 (quét liên kết chết); kiểm bằng mã nguồn, không phải thao tác QA |

## Bug sản phẩm / dữ liệu seed phát hiện (KHÔNG retire, cần dev xử lý)
- `backend/prisma/seed/admin-batch2.ts:441` - audit seed `course.remove` có `targetType:'course'` nhưng `target: sid('mod-8')` (id MÔ-ĐUN); sau tách Community/Course id khóa học là `sid('course-8')`, nên 'Lịch sử quản trị' của khóa 'Get Rich Quick Secrets' (ADM2-075/079) sẽ trống và bản ghi audit trỏ sai đối tượng.
- `frontend/ADMIN_BACKEND_GAPS.md` (mục Admin đợt 2, dòng 'Hợp đồng vs thực tế') và `backend/docs/api/admin-batch2.md` mục 'Khác biệt' 11 vẫn nói Khóa học là ClassroomModule/`thumbnail` luôn null (tài liệu lỗi thời; code đã là entity Course).
- `DEPLOY.md:14` và `backend/docs/api/content.md:64` vẫn nói chạy 1 instance/dữ liệu in-memory (TC-INFRA-025/026 đã ghi nhận).
- ADM3-191/288/339/367 (các 'giao diện cho phép nhưng API 400') vẫn là lệch FE/BE chưa sửa.

## Flag cho lead (case ở module CŨ - KHÔNG sửa trong phần này)
- **NOTI (cases_comms.py)**: dòng 193-196 'Chốt cách xác thực SSE... bỏ ?access_token' (Kế hoạch, ghi 'hiện vẫn 200') và dòng 211-213 'Fallback ?access_token= hợp lệ mở được stream' (kỳ vọng 200) đều LỖI THỜI: ?access_token đã bỏ, trả 401 (SECX-038/039; notifications.md). Nên retire cả hai.
- **EVENT/MEMBER (cases_content.py:782-784)**: 'RSVP + hủy nhiều lần cộng điểm mỗi lần... Điểm tăng +5' sai sau audit: điểm RSVP chỉ +1 một lần cho mỗi (user, sự kiện), hủy thì thu hồi (points.types.ts:10, GAME-013/014).
- **COMM/COURSE (cases_community.py, cases_classroom.py)**: nhiều bước dùng `GET /api/courses/photo/modules` - vẫn chạy nhờ alias nhưng chỉ phản ánh khóa MẶC ĐỊNH (communities-courses.md mục 0.4); các case về 'lessons' hằng số/module giả cần rà với SPLIT-006/008/125. Trang FE '/courses' không còn (chỉ redirect).
- **ADMIN (gen_testcases.py ~953-990)** các case 'Platform Admin hoàn tiền/ẩn nội dung' cũ ('Kế hoạch') đã được ADM2/ADM3 phủ - trùng.
- **ROLE/SEC**: kiểm tra các dòng 'chỉ Platform Admin' vì nay còn nhân viên theo quyền (Moderator/Support/Finance) - ma trận chuẩn nằm ở sheet 'Phân quyền' + ADM3-054..094.
- **SEC/UPLOAD (cases_platform.py ~645)**: DELETE /uploads/:key và GET /api/files/<key> -> 404 vẫn đúng, nhưng quyền đọc file đã đổi theo purpose (SECX-098..103; file riêng tư cần đăng nhập/URL ký).
- **SEARCH (old)** vs **PERF-001..046**: PERF viết lại tìm kiếm toàn văn (không dấu, trigram, ts_rank, xếp hạng reduced) - các case SEARCH cũ về 'tìm LIKE'/độ ưu tiên cần đối chiếu và có thể trùng.
- **HOME**: SPLIT-123..143 ('Gỡ dữ liệu giả': hero stats, footer, FAQ, newsletter) trùng nội dung với các case HOME/FOOTER cũ - nên gộp.
- **INTEG/NOTI**: INFRA-052..061 (thông báo tin nhắn, gộp 5 phút, ack 30s) trùng một phần với case NOTI/INTEG về tin nhắn/SSE.

