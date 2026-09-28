# Skool Clone

Nền tảng cộng đồng & khóa học (lấy cảm hứng từ skool.com). Hiện đã có **Trang chủ (Liquid Glass)**.

```
skool-clone/
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

API hiện có:

| Method | Path | Mô tả |
|---|---|---|
| GET | `/health` | Health check (ALB/ECS) |
| GET | `/api/courses` | `q, category, pricing, visibility, status, language, sort(trending\|top\|newest), page, limit` |
| GET | `/api/courses/:id` | Chi tiết khóa học (kèm `viewerEnrolled` nếu có đăng nhập) |
| POST | `/api/courses/:id/enroll` | Tham gia/rời khóa học (yêu cầu đăng nhập) |
| GET | `/api/categories` | Danh mục + số khóa học |
| GET | `/api/stats` | Số liệu hero |
| POST | `/api/auth/register` | Đăng ký (trả `accessToken` + set cookie `refresh_token` httpOnly) |
| POST | `/api/auth/login` | Đăng nhập (có rate limit) |
| POST | `/api/auth/refresh` | Lấy access token mới từ refresh-token cookie (single-use, tự xoay vòng) |
| POST | `/api/auth/logout` | Đăng xuất, thu hồi refresh token |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại (yêu cầu `Authorization: Bearer <accessToken>`) |

Dữ liệu khóa học tạm đọc từ seed trong `modules/courses/courses.seed.ts` qua interface `CourseRepository`; người dùng lưu ở file `backend/data/users.json` qua interface `UserRepository`. Khi có database chỉ cần viết thêm implementation của các interface này.

## Deploy AWS (gợi ý)

- **Backend**: `backend/Dockerfile` (multi-stage, chạy user `node`, có HEALTHCHECK). Build → push ECR → chạy ECS Fargate / EC2 sau ALB, health check path `/health`. Đặt `CORS_ORIGIN` = domain frontend.
- **Frontend**: `npm --prefix frontend run build` → upload `frontend/dist` lên S3 + CloudFront. Đặt `VITE_API_URL` = URL API (hoặc route `/api/*` của CloudFront về ALB rồi giữ mặc định `/api`). Nhớ cấu hình fallback 404 → `/index.html` cho React Router.
- Ảnh khóa học hiện nằm trong `frontend/public/images`; sau này chuyển sang S3 và trả URL đầy đủ qua trường `thumbnail`.

## Biến môi trường

- `backend/.env`: `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ACCESS_TOKEN_TTL_MIN`, `REFRESH_TOKEN_TTL_DAYS` (xem `.env.example`). **Bắt buộc đặt riêng `JWT_*_SECRET`** khi `NODE_ENV=production` (server sẽ không khởi động nếu vẫn dùng giá trị mặc định).
- `frontend/.env`: `VITE_API_URL`
