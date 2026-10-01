# SofinHub

Nền tảng cộng đồng & khóa học (lấy cảm hứng từ skool.com). Hiện đã có **Trang chủ (Liquid Glass)**.

```
sofin_hub/
├─ frontend/   React 19 + Vite + TypeScript + Tailwind CSS v4 + TanStack Query
└─ backend/    Node.js + Express 5 + TypeScript + Zod (Docker-ready cho AWS)
```

## Chạy local

```bash
npm run install:all   # cài dependency cho cả 2 phần (chạy 1 lần)
npm install           # cài concurrently ở thư mục gốc (chạy 1 lần)
npm run dev           # backend :4000 + frontend :5173
```

Mở http://localhost:5173. Vite proxy `/api/*` sang backend nên không cần cấu hình CORS khi dev.

## Frontend (`frontend/src`)

| Thư mục | Vai trò |
|---|---|
| `pages/` | Trang (HomePage, LoginPage, RegisterPage, CourseDetailPage, NotFoundPage) |
| `features/auth/` | `AuthContext` (phiên đăng nhập, tự refresh token), gọi API đăng ký/đăng nhập/đăng xuất |
| `features/courses/` | Types, gọi API, React Query hooks (`queries.ts`), constants (icon/màu danh mục), components (CourseCard, FilterBar, CategoryTabs, Pagination...) |
| `features/home/` | Hero |
| `components/` | Header, icon SVG dùng chung |
| `lib/api.ts` | `apiGet` — wrapper fetch, base URL từ `VITE_API_URL` |
| `index.css` | Design tokens (`@theme`): màu cam `#f26a1b`, shadow, utility `glass`, `glass-chip`, `bg-brand-gradient` |

Thêm trang mới: tạo `pages/XxxPage.tsx`, khai báo route trong `App.tsx`; dữ liệu server luôn đi qua hook React Query trong `features/<tên>/queries.ts`.

## Backend (`backend/src`)

```
config/env.ts            đọc + validate biến môi trường (zod)
middlewares/             error handler, 404
modules/<tên>/           routes → service → repository (mỗi module 1 thư mục)
routes.ts, app.ts        gắn router, middleware (helmet, cors, compression, morgan)
index.ts                 khởi động + graceful shutdown (SIGTERM)
```

### Chạy backend với database thật (Postgres)

```bash
# 1) bật Docker Desktop, rồi trong backend/:
cd backend
cp .env.example .env            # lần đầu; thêm PLATFORM_ADMIN_EMAILS=admin@sofinhub.test để có tài khoản admin nền tảng
npm install
npm run db:up                   # Postgres 16 (docker compose, cổng 5435)
npm run db:deploy               # áp migration
npm run db:seed                 # nạp dữ liệu test (idempotent). Mật khẩu chung: Passw0rd!x
npm run dev                     # API :4000
# frontend (terminal khác): cd frontend && npm install && npm run dev   # :5173
```

Tài khoản test (`@sofinhub.test`): admin (Platform Admin), owner, cadmin, mod, member1..3, newbie, banned. Test tự động: `cd backend && npm test` (224 test trên DB thật, mỗi file một schema tạm). Tài liệu: `backend/docs/{API,DATABASE,CONVENTIONS}.md`, `docs/features/*.md`, `SofinHub_HuongDan_TestThuCong.docx` (hướng dẫn test thủ công).

API hiện có (bảng dưới là nhóm đầu tiên; **danh sách đầy đủ ~150 route, phân quyền, biến môi trường và các giới hạn xem `backend/docs/API.md`**, chi tiết từng nhóm ở `backend/docs/api/`). Chạy test: `cd backend && npm test`.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Health check (ALB/ECS) |
| GET | `/api/courses` | `q, category, pricing, visibility, status, language, sort(trending\|top\|newest), page, limit` |
| GET | `/api/courses/:id` | Chi tiết khóa học (kèm `viewerEnrolled` nếu có đăng nhập). Không có `modules` (module thật ở `/courses/:id/modules`); `highlights/gains/faqs/reviews` rỗng nếu chưa có dữ liệu thật; `priceNotes` suy ra từ giá + Global Settings `payments.trialDays`; `facts[Bài học]` = số bài học thật |
| POST | `/api/courses/:id/enroll` | Tham gia/rời khóa học (yêu cầu đăng nhập) |
| GET | `/api/categories` | Danh mục + số khóa học |
| GET | `/api/stats` | Số liệu hero, tính từ DB: `learners` = user thật (không demo) có ghi danh, `courses` = cộng đồng đang listed, `instructors` = chủ cộng đồng thật của chúng, `rating` = TB review thật (null nếu chưa có) |
| POST | `/api/auth/register` | Đăng ký (trả `accessToken` + set cookie `refresh_token` httpOnly) |
| POST | `/api/auth/login` | Đăng nhập (có rate limit) |
| POST | `/api/auth/refresh` | Lấy access token mới từ refresh-token cookie (single-use, tự xoay vòng) |
| POST | `/api/auth/logout` | Đăng xuất, thu hồi refresh token |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại (yêu cầu `Authorization: Bearer <accessToken>`) |

Dữ liệu khóa học tạm đọc từ seed trong `modules/catalog/catalog.seed.ts` qua interface `CourseRepository`; người dùng lưu ở file `backend/data/users.json` qua interface `UserRepository`. Khi có database chỉ cần viết thêm implementation của các interface này.

## Deploy AWS (gợi ý)

- **Backend**: `backend/Dockerfile` (multi-stage, chạy user `node`, có HEALTHCHECK). Build → push ECR → chạy ECS Fargate / EC2 sau ALB, health check path `/health`. Đặt `CORS_ORIGIN` = domain frontend.
- **Frontend**: `npm --prefix frontend run build` → upload `frontend/dist` lên S3 + CloudFront. Đặt `VITE_API_URL` = URL API (hoặc route `/api/*` của CloudFront về ALB rồi giữ mặc định `/api`). Nhớ cấu hình fallback 404 → `/index.html` cho React Router.
- Ảnh khóa học hiện nằm trong `frontend/public/images`; sau này chuyển sang S3 và trả URL đầy đủ qua trường `thumbnail`.

## Biến môi trường

- `backend/.env`: `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_MIN`, `REFRESH_TOKEN_TTL_DAYS` (xem `.env.example`). **`NODE_ENV` bắt buộc khai báo**; khi `NODE_ENV=production` phải có `DATABASE_URL` và mọi secret (`JWT_*`, `PAYMENT_WEBHOOK_SECRET`, `UPLOAD_SIGNING_SECRET`) khác `dev-*`, không bật `ENABLE_DEV_OUTBOX` (server sẽ không khởi động nếu vi phạm). Chi tiết: `DEPLOY.md`.
- `frontend/.env`: `VITE_API_URL`
