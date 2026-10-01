# Quy ước viết API backend (bắt buộc cho mọi module)

Backend: Express 5 + TypeScript (NodeNext, `strict`, import có đuôi `.js`), zod 4 để validate, dữ liệu **lưu trong bộ nhớ**
(hoặc file JSON) qua lớp repository — khi có Postgres/Prisma chỉ thay implementation repository. Xem `PLAN.md`.

> Database: Postgres + Prisma đã dựng nền (schema đầy đủ, seed, hạ tầng test) — xem `docs/DATABASE.md` trước khi chuyển repository sang DB.

## Cấu trúc 1 module (`src/modules/<tên>/`)
`<tên>.types.ts` · `<tên>.repository.ts` (interface + `inMemory...` implementation) · `<tên>.schema.ts` (zod) ·
`<tên>.service.ts` (nghiệp vụ, không đụng `req/res`) · `<tên>.routes.ts` (chỉ parse → gọi service → `res.json`).
Đăng ký router bằng **1 dòng** trong `src/routes.ts` (`apiRouter.use('/', xRouter)`); chỉ thêm dòng của mình, không sửa dòng người khác.

## Cộng đồng (Community) vs Khóa học (Course) — quy ước đặt tên (STEP 6 audit)
- **Community** = cộng đồng (Prisma `Community`, bảng `"Course"`, id = slug). Mọi tham số/biến chỉ cộng đồng đặt tên **`communityId`** (`permissions/policy.ts`, repository, service, route).
- **Course** = khóa học (Prisma `Course`, bảng `"LearningCourse"`) thuộc 1 cộng đồng, chứa module/bài. Biến chỉ khóa học: `courseId`/`learningCourseId`. Module/Chứng nhận có FK `learningCourseId`.
- Module catalog cộng đồng (liệt kê/chi tiết/khóa) là `src/modules/catalog/` (`catalogService`), KHÔNG còn `modules/catalog/`.
- **API tương thích**: route `/courses/:id/*` giữ nguyên và được mirror ở `/communities/:id/*` bằng `middlewares/community-alias.ts` (viết lại tiền tố; `POST /communities` và `/communities/:id/courses/*` — họ route khóa học mới — không bị viết lại). JSON cũ giữ `courseId` (= id cộng đồng, *deprecated*) và thêm `communityId`; domain type có `communityId` + `courseId?` (alias do repository điền). Tham số query/body `courseId` được nhận là `communityId`. Code mới chỉ dùng `communityId`.
- Raw SQL vẫn dùng tên cột cũ `"courseId"` (cột của `communityId`); khi SELECT ra DTO phải `AS "communityId"`.

## Quy tắc chung
- Response thành công: `{ data: ... }` (danh sách phân trang: `{ data: [...], meta: { page, limit, total, totalPages } }`). Tạo mới → 201.
- Lỗi: ném `HttpError.badRequest/unauthorized/forbidden/notFound/conflict/tooMany(...)` (`src/utils/http-error.ts`, chỉ được THÊM helper,
  không đổi cái cũ). Zod lỗi tự thành 400 `VALIDATION_ERROR`. Route là `async` — Express 5 tự bắt lỗi, không cần try/catch.
- Thông báo lỗi/validate bằng **tiếng Việt**, giống code hiện có.
- Xác thực: `requireAuth` / `optionalAuth` từ `src/middlewares/auth.ts` (`req.userId`).
- Thành viên cộng đồng: `catalogService.getById(communityId)` (404) → `enrollmentService.requireMembership(userId, communityId)` (403).
- **Phân quyền chỉ qua `src/modules/permissions/policy.ts`**: `requireRole(userId, communityId, 'mod'|'admin'|'owner')`,
  `getRole`, `canManageContent` (tác giả hoặc mod+), `requirePlatformAdmin`, `isPlatformAdmin`. KHÔNG tự so sánh role rải rác,
  KHÔNG tin dữ liệu role từ FE. Thứ bậc: member < mod < admin < owner < platform_admin (email trong env `PLATFORM_ADMIN_EMAILS`).
  Được phép THÊM hàm vào policy.ts, không đổi hàm cũ.
- Thông báo cho người dùng: `notify({...})` từ `src/modules/notifications/notifications.service.ts` (đã có; module thông báo sẽ đọc từ store đó).
- Điểm thưởng: `pointsService.award(userId, courseId, reason)` (`src/modules/points`).
- Ghi danh/vai trò: `enrollmentService` (`grant`, `remove`, `setRole`, `getMember`, `listMembers`, `listByUser`, `setBanned`, `isBanned`).
- Biến môi trường mới: chỉ THÊM vào `src/config/env.ts` (zod, có default an toàn cho dev) và `backend/.env.example` (kèm chú thích tiếng Việt).
- Không thêm dependency npm nặng nếu Node chuẩn làm được (dùng `node:crypto`, `node:fs`...). Nếu thật sự cần thì thêm vào package.json và nêu rõ trong báo cáo.
- Comment tiếng Việt ngắn, giải thích **vì sao** (theo phong cách file hiện có). Không comment thừa.

## State chia sẻ giữa các instance (AUDIT §6.5)
- KHÔNG tự giữ state "dùng chung giữa request/user" trong `Map` cấp module (vé 1 lần, nonce, rate limit, throttle, cache cần vô hiệu, danh sách listener fan-out...). Dùng `shared()` từ `src/infra/shared.ts`: `kv` (`get/set/setNx/getDel/del`, TTL ms), `pubsub` (`publish/subscribe`), `rateLimiter` (`hit(key,max,windowMs)`). Hai cài đặt cùng hợp đồng: Redis (khi có `REDIS_URL`) và in-memory (mặc định dev/test). Hợp đồng được test ở `tests/shared-state.test.ts` (chạy Redis khi đặt `REDIS_URL`).
- Vé dùng 1 lần = `kv.set(..., ttl)` + `kv.getDel` (atomic). Chống replay/dedupe = `kv.setNx`. Rate limit lỗi store => FAIL-OPEN; replay/nonce => FAIL-CLOSED.
- SSE chỉ là kênh best-effort: dữ liệu thật luôn ghi DB TRƯỚC, rồi mới phát (không thông báo ma). Đừng suy "người nhận online" từ số kết nối SSE (kết nối xác sống); xem `ACTIVE_VIEW_TTL_MS` trong `messages.service.ts`.
- Job nền KHÔNG tự `setInterval`: khai báo trong `src/jobs.ts`; chạy qua `infra/scheduler.ts` dưới leader election (Postgres advisory lock theo tên job) nên bật ở nhiều instance vẫn chỉ 1 instance chạy mỗi lượt. Job phải idempotent. Có thể tách web-only (`RUN_SCHEDULERS=0`) + `npm run start:worker`.
- `notify(input, { onWriteFailed })`: nếu bạn đặt cờ chống-trùng ở DB TRƯỚC khi notify, truyền `onWriteFailed` để nhả cờ khi ghi thất bại hẳn.
- Tắt êm: mọi luồng/tài nguyên mới phải được đóng trong `src/index.ts` (`gracefulShutdown`).

## Test tích hợp (bắt buộc)
Mỗi module có `backend/tests/<tên>.test.ts` dùng `node:test` + helper `tests/helpers.ts` (`startTestServer`, `makeClient` → `call`, `registerUser`).
Chạy: `cd backend && npm test`. Test phải phủ: happy path, 401 (thiếu token), 403 (thiếu quyền), 404, 400 (validate), và các ràng buộc nghiệp vụ.
Course có sẵn để thử: id `photo` (và các id khác trong `catalog.seed.ts`). Tạo người dùng bằng `registerUser`. Mỗi file test nên dùng
user mới, không phụ thuộc thứ tự chạy giữa các file. Quan trọng: `npm run typecheck` (tsc) phải sạch lỗi và `npm test` phải xanh trước khi báo hoàn thành.

## Môi trường, lint, coverage, CI
- `NODE_ENV` KHÔNG có default: `npm run dev|test|db:*` đã đặt sẵn bằng `cross-env`; test tự đặt `NODE_ENV=test` + `ENABLE_DEV_OUTBOX=1` trong `tests/helpers.ts` (helpers phải là import đầu tiên của file test).
- Secret/biến mới có default `dev-*` sẽ bị chặn tự động khi production (`config/env-guard.ts` quét mọi giá trị chuỗi) - chỉ cần giữ tiền tố `dev-`.
- Lỗi bảo mật cần test hồi quy trong `tests/security-hardening.test.ts` (kiểu "tiến trình con với env cho trước" cho test cấu hình khởi động).
- `npm run lint` (ESLint flat, config chung `../eslint.config.mjs`, toolchain cài ở package.json gốc: chạy `npm ci` ở gốc repo trước). Quy tắc nợ cũ để mức `warn`; **không để phát sinh `error`**. `npm run test:coverage` (c8) in tổng kết + `coverage/lcov`.
- CI (`.github/workflows/ci.yml`): typecheck + lint + test (Postgres 16) + build cho backend; `tsc -b` + lint + build cho frontend.

## Tài liệu (bắt buộc)
Mỗi nhóm việc viết `backend/docs/api/<nhóm>.md`: bảng endpoint (Method · Path · Auth/Role · Body/Query · Response · Lỗi có thể gặp),
các quyết định thiết kế, giới hạn còn lại (những gì đang là mô phỏng/in-memory), và mục "Chưa làm / cần quyết định". Tiếng Việt.
KHÔNG sửa `PLAN.md`, `README.md` (người điều phối sẽ tổng hợp). Không sửa frontend.

## Ranh giới file (tránh giẫm chân nhóm khác)
Chỉ sửa file trong phạm vi được giao. Nếu cần một hàm nhỏ ở module khác thì chỉ THÊM (không đổi chữ ký cũ) và nêu trong báo cáo.
Các file dùng chung chỉ được thêm: `src/routes.ts`, `src/config/env.ts`, `.env.example`, `src/utils/http-error.ts`,
`src/modules/permissions/policy.ts`, `package.json`.
