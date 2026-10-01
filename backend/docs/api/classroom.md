# API Lớp học (classroom)

> **Tách Community/Khóa học (STEP 6):** mọi route `/courses/:id/...` dưới đây giữ nguyên và (a) cũng có ở `/communities/:id/...`; (b) route không chỉ định khóa (`modules`, `progress`, `certificate`, tạo/sắp xếp module) thao tác trên **khóa học mặc định** của cộng đồng. Muốn chọn khóa: dùng `/communities/:id/courses/:courseId/...` hoặc `learningCourseId` trong body tạo module. Chi tiết, DTO mới, CRUD khóa học, chứng nhận theo khóa: [communities-courses.md](./communities-courses.md). Khóa module tuần tự và `requiredLevel` tính trong phạm vi MỘT khóa học.

Module: `src/modules/classroom/`. Test: `tests/classroom.test.ts`. Mọi response thành công dạng `{ data: ... }`.
"Member" = đã tham gia cộng đồng (`requireMembership`, 403 nếu chưa). "mod+" / "admin+" qua `permissions/policy.ts` (`requireRole`).

## Endpoint

| Method | Path | Auth/Role | Body / Query | Response | Lỗi |
|---|---|---|---|---|---|
| GET | `/courses/:id/modules` | member | — | mảng module view: `id,index,title,description,lessonsCount,completedCount,pct,locked` + **mới**: `thumbnail?`, `requiredLevel?`, `lockReason` (`'previous_module'`\|`'level'`\|`null`) | 401, 403, 404 |
| GET | `/courses/:id/modules/:moduleId/lessons` | member | — | mảng lesson view: `id,index,title,type,durationMin,body,completed` + **mới**: `videoUrl?`, `embedUrl?`, `attachments[]` | 401, 403, 403 `MODULE_LOCKED`, 404 |
| GET | `/courses/:id/lessons/:lessonId` | member | — | lesson view + `moduleId,moduleTitle,moduleIndex,prevLessonId,nextLessonId` (prev/next theo thứ tự toàn khóa, có thể sang module khác) | 401, 403, 403 `MODULE_LOCKED`, 404 |
| POST | `/courses/:id/lessons/:lessonId/complete` | member | — | `{completed}` (toggle như cũ) | 401, 403, 403 `MODULE_LOCKED`, 404 |
| GET | `/courses/:id/progress` | member | — | `{percent, completedLessons, totalLessons, completedModules, lastLessonId, nextLesson:{id,title,moduleId}\|null}` | 401, 403, 404 |
| POST | `/courses/:id/modules` | mod+ | `{title, description, thumbnail?, requiredLevel?: 1..9}` | 201 module thô | 400, 401, 403, 404 |
| PATCH | `/courses/:id/modules/:moduleId` | mod+ | một phần của body trên; `thumbnail`/`requiredLevel` = `null` để xóa | module | 400, 403, 404 |
| DELETE | `/courses/:id/modules/:moduleId` | mod+ | — | `{deleted:true}`; xóa cả bài học + tiến độ | 403, 404 |
| PUT | `/courses/:id/modules/order` | mod+ | `{ids:[...]}` (hoán vị đủ các module) | danh sách module view mới, `index` tự đánh lại | 400, 403, 404 |
| POST | `/courses/:id/modules/:moduleId/lessons` | mod+ | `{title, type:'video'\|'text'\|'file', durationMin, body, videoUrl?, attachments?:[{name,url,size?}]}` | 201 lesson (có `embedUrl` nếu có `videoUrl`) | 400, 403, 404 |
| PATCH | `/courses/:id/lessons/:lessonId` | mod+ | một phần của body trên; `videoUrl:null` để xóa | lesson | 400, 403, 404 |
| DELETE | `/courses/:id/lessons/:lessonId` | mod+ | — | `{deleted:true}` (xóa tiến độ liên quan, đánh lại index) | 403, 404 |
| PUT | `/courses/:id/modules/:moduleId/lessons/order` | mod+ | `{ids:[...]}` | danh sách lesson view mới | 400, 403, 404 |
| GET | `/courses/:id/classroom-settings` | member | — | `{certificatesEnabled}` | 401, 403, 404 |
| PATCH | `/courses/:id/classroom-settings` | admin+ | `{certificatesEnabled: boolean}` | settings | 400, 403, 404 |
| GET | `/courses/:id/certificate` | member | — | `{code, holderName, courseTitle, completedAt, issuedAt}` | 403 (chưa bật / chưa 100%), 404 |
| GET | `/certificates/:code` | **công khai** | — | `{valid:true, holderName, courseTitle, issuedAt}` | 404 |

Lỗi khóa module: HTTP 403, `error.code = "MODULE_LOCKED"`.

## Quyết định thiết kế
- **Khóa module tính ở server** (`state()` trong service), dùng chung cho list/lessons/detail/complete. Module khóa nếu module liền trước chưa hoàn thành 100% (`previous_module`) HOẶC `levelFor(điểm all-time trong cộng đồng) < requiredLevel` (`level`). Nếu cả hai, `lockReason` ưu tiên `previous_module`. `locked` cũ vẫn đúng.
- **Mod+ (kể cả platform admin) không bao giờ bị khóa** để duyệt nội dung; chuỗi khóa của member không bị ảnh hưởng.
- **Điểm hoàn thành bài chỉ cộng 1 lần** cho mỗi (user, bài): repository giữ tập `everCompleted`, toggle vẫn đảo trạng thái như cũ.
- **videoUrl**: parse bằng `URL`, chỉ http(s), whitelist host YouTube/Vimeo; `embedUrl` được dựng lại từ ID đã kiểm tra (YouTube 11 ký tự, Vimeo số) nên không thể trỏ tới host khác. Link đính kèm và thumbnail chỉ nhận http(s) (chặn `javascript:`/`data:`).
- **Nội dung seed** vẫn sinh theo khóa ở lần mở đầu; mod+ sửa trực tiếp trên bản đó (xóa hết rồi dựng lại cũng được).
- **Chứng nhận**: mã `randomBytes(12)` base64url (96 bit), cấp 1 lần cho mỗi (user, khóa), lưu lại nên vẫn xác minh được nếu nội dung đổi sau đó. Cấp lười ở lần gọi `GET /certificate` đầu tiên (kèm `notify` loại `system`). `completedAt` = thời điểm bài cuối được hoàn thành. Xác minh công khai không trả userId/email.
- `nextLesson` = bài chưa xong đầu tiên nằm trong module đang mở khóa; `lastLessonId` = bài hoàn thành gần nhất còn đánh dấu.

## Giới hạn hiện tại
- Toàn bộ dữ liệu (nội dung, tiến độ, cài đặt, chứng nhận) nằm trong **Postgres** (`classroomRepository` Prisma); nội dung mẫu được nạp bằng seed (`prisma/seed/classroom.ts`). Xem `DATABASE.md`.
- Chưa có upload tệp: `attachments`/`thumbnail` chỉ là URL do client cung cấp.
- Chứng nhận chỉ là bản ghi JSON (không sinh PDF/ảnh).

## Chưa làm / cần quyết định
- Sau khi đã cấp chứng nhận mà mod thêm bài học mới (tiến độ < 100%), chứng nhận cũ vẫn hợp lệ nhưng `GET /certificate` sẽ 403 cho tới khi học xong lại — cần quyết định có thu hồi hay giữ.
- Chưa có endpoint liệt kê chứng nhận của tôi qua nhiều cộng đồng.
- Chưa cập nhật frontend (`ClassroomTab`) để dùng player, quản lý nội dung, chứng nhận.
- Mở rộng `PointReason`/thu hồi điểm khi xóa bài học: hiện điểm đã cộng không bị trừ lại.
