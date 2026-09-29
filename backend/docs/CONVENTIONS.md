# Quy ước viết API backend (bắt buộc cho mọi module)

Backend: Express 5 + TypeScript (NodeNext, `strict`, import có đuôi `.js`), zod 4 để validate, dữ liệu **lưu trong bộ nhớ**
(hoặc file JSON) qua lớp repository — khi có Postgres/Prisma chỉ thay implementation repository. Xem `PLAN.md`.

> Database: Postgres + Prisma đã dựng nền (schema đầy đủ, seed, hạ tầng test) — xem `docs/DATABASE.md` trước khi chuyển repository sang DB.

## Cấu trúc 1 module (`src/modules/<tên>/`)
`<tên>.types.ts` · `<tên>.repository.ts` (interface + `inMemory...` implementation) · `<tên>.schema.ts` (zod) ·
`<tên>.service.ts` (nghiệp vụ, không đụng `req/res`) · `<tên>.routes.ts` (chỉ parse → gọi service → `res.json`).
Đăng ký router bằng **1 dòng** trong `src/routes.ts` (`apiRouter.use('/', xRouter)`); chỉ thêm dòng của mình, không sửa dòng người khác.

## Quy tắc chung
- Response thành công: `{ data: ... }` (danh sách phân trang: `{ data: [...], meta: { page, limit, total, totalPages } }`). Tạo mới → 201.
- Lỗi: ném `HttpError.badRequest/unauthorized/forbidden/notFound/conflict/tooMany(...)` (`src/utils/http-error.ts`, chỉ được THÊM helper,
  không đổi cái cũ). Zod lỗi tự thành 400 `VALIDATION_ERROR`. Route là `async` — Express 5 tự bắt lỗi, không cần try/catch.
- Thông báo lỗi/validate bằng **tiếng Việt**, giống code hiện có.
- Xác thực: `requireAuth` / `optionalAuth` từ `src/middlewares/auth.ts` (`req.userId`).
- Thành viên cộng đồng: `courseService.getById(courseId)` (404) → `enrollmentService.requireMembership(userId, courseId)` (403).
- **Phân quyền chỉ qua `src/modules/permissions/policy.ts`**: `requireRole(userId, courseId, 'mod'|'admin'|'owner')`,
  `getRole`, `canManageContent` (tác giả hoặc mod+), `requirePlatformAdmin`, `isPlatformAdmin`. KHÔNG tự so sánh role rải rác,
  KHÔNG tin dữ liệu role từ FE. Thứ bậc: member < mod < admin < owner < platform_admin (email trong env `PLATFORM_ADMIN_EMAILS`).
  Được phép THÊM hàm vào policy.ts, không đổi hàm cũ.
- Thông báo cho người dùng: `notify({...})` từ `src/modules/notifications/notifications.service.ts` (đã có; module thông báo sẽ đọc từ store đó).
- Điểm thưởng: `pointsService.award(userId, courseId, reason)` (`src/modules/points`).
- Ghi danh/vai trò: `enrollmentService` (`grant`, `remove`, `setRole`, `getMember`, `listMembers`, `listByUser`, `setBanned`, `isBanned`).
- Biến môi trường mới: chỉ THÊM vào `src/config/env.ts` (zod, có default an toàn cho dev) và `backend/.env.example` (kèm chú thích tiếng Việt).
- Không thêm dependency npm nặng nếu Node chuẩn làm được (dùng `node:crypto`, `node:fs`...). Nếu thật sự cần thì thêm vào package.json và nêu rõ trong báo cáo.
- Comment tiếng Việt ngắn, giải thích **vì sao** (theo phong cách file hiện có). Không comment thừa.

## Test tích hợp (bắt buộc)
Mỗi module có `backend/tests/<tên>.test.ts` dùng `node:test` + helper `tests/helpers.ts` (`startTestServer`, `makeClient` → `call`, `registerUser`).
Chạy: `cd backend && npm test`. Test phải phủ: happy path, 401 (thiếu token), 403 (thiếu quyền), 404, 400 (validate), và các ràng buộc nghiệp vụ.
Course có sẵn để thử: id `photo` (và các id khác trong `courses.seed.ts`). Tạo người dùng bằng `registerUser`. Mỗi file test nên dùng
user mới, không phụ thuộc thứ tự chạy giữa các file. Quan trọng: `npm run typecheck` (tsc) phải sạch lỗi và `npm test` phải xanh trước khi báo hoàn thành.

## Tài liệu (bắt buộc)
Mỗi nhóm việc viết `backend/docs/api/<nhóm>.md`: bảng endpoint (Method · Path · Auth/Role · Body/Query · Response · Lỗi có thể gặp),
các quyết định thiết kế, giới hạn còn lại (những gì đang là mô phỏng/in-memory), và mục "Chưa làm / cần quyết định". Tiếng Việt.
KHÔNG sửa `PLAN.md`, `README.md` (người điều phối sẽ tổng hợp). Không sửa frontend.

## Ranh giới file (tránh giẫm chân nhóm khác)
Chỉ sửa file trong phạm vi được giao. Nếu cần một hàm nhỏ ở module khác thì chỉ THÊM (không đổi chữ ký cũ) và nêu trong báo cáo.
Các file dùng chung chỉ được thêm: `src/routes.ts`, `src/config/env.ts`, `.env.example`, `src/utils/http-error.ts`,
`src/modules/permissions/policy.ts`, `package.json`.
