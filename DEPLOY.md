# Hướng dẫn deploy để tester test thử (Frontend + Backend)

> Kiến trúc: **Frontend → Vercel**, **Backend (Docker) → Render**, **Database → PostgreSQL** (Render Postgres, Neon, Supabase, RDS...).
> Cập nhật 01/10/2026: viết lại Phần 1 theo kiến trúc thật (Postgres + Prisma, không còn `users.json`/RAM) và theo các chốt chặn bảo mật bắt buộc (xem "Cấu hình bắt buộc khi production").

## Vì sao Backend không deploy lên Vercel (serverless)

Backend là **một tiến trình chạy liên tục**, không phù hợp serverless (mỗi request có thể rơi vào container khác, container bị hủy sau vài phút):

- Thông báo/tin nhắn realtime (**SSE**), vé stream, vé upload, rate limit, giãn cách thông báo đều nằm trong **bộ nhớ tiến trình**.
- Có **job định kỳ** (nhắc lịch sự kiện, gia hạn gói trả phí) chạy trong chính tiến trình API.
- File upload ghi ra **ổ đĩa** của container (`UPLOAD_DIR`).

→ Dùng **Render** (hoặc Railway/Fly.io/ECS — làm tương tự) với `backend/Dockerfile` có sẵn, chạy **đúng 1 instance** cho tới khi đưa các state trên ra Redis (xem PLAN/audit mục 6.5).
Dữ liệu nghiệp vụ (tài khoản, khóa học, ghi danh, phiên đăng nhập, thanh toán...) nằm hết trong **Postgres** nên sống sót qua mọi lần restart/deploy.

---

## Phần 1 — Deploy Backend (Render) + PostgreSQL

### 1.1 Tạo database

1. Render → **New +** → **PostgreSQL** (gói Free của Render **tự hết hạn sau ~30 ngày**; dùng lâu thì chọn gói trả phí hoặc Neon/Supabase). Chọn **cùng Region** với Web Service.
2. Mở database, copy:
   - **Internal Database URL** — dùng cho Web Service (nhanh, trong mạng nội bộ Render).
   - **External Database URL** — chỉ dùng khi chạy lệnh từ máy bạn; thêm `?sslmode=require` vào cuối URL (kết nối từ ngoài bắt buộc SSL).

### 1.2 Tạo Web Service

1. Đẩy code lên GitHub (nếu repo chưa có remote, tạo repo rồi `git push`).
2. [render.com](https://render.com) → đăng nhập GitHub → **New +** → **Web Service** → chọn repo `sofin_hub`.
3. Cấu hình:
   - **Root Directory**: `backend`
   - **Runtime**: **Docker** (Render tự nhận `backend/Dockerfile`; image đã set `NODE_ENV=production`).
     - Không dùng Docker: Runtime **Node**, Build Command `npm ci && npm run build`, Start Command `npm start`, **Pre-Deploy Command** `npm run db:deploy` (gói trả phí).
   - **Health Check Path**: `/health`
   - **Instance Type**: Free đủ cho tester (free tier "ngủ" sau ~15 phút không có traffic; request đầu sau đó chậm 30–60 giây — bình thường; job định kỳ không chạy khi ngủ).
4. **Environment Variables** — bảng đầy đủ:

   | Key | Bắt buộc | Giá trị / ghi chú |
   |---|---|---|
   | `NODE_ENV` | **Có** (không có mặc định; thiếu hoặc sai → app **không khởi động**) | `production`. Image Docker đã set sẵn; vẫn nên khai báo rõ. Chỉ nhận `development` / `test` / `production`. |
   | `DATABASE_URL` | **Có** khi production (không có mặc định) | **Internal Database URL** của Postgres. Thiếu → app thoát ngay. |
   | `JWT_ACCESS_SECRET` | **Có** | Chuỗi ngẫu nhiên: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Không được bắt đầu bằng `dev-`. |
   | `JWT_REFRESH_SECRET` | **Có** | Chuỗi ngẫu nhiên **khác** cái trên. Không được bắt đầu bằng `dev-`. |
   | `PAYMENT_WEBHOOK_SECRET` | **Có** | Khóa ký HMAC cho webhook thanh toán. Lộ khóa này = ai cũng giả được "đã thanh toán" → khóa học miễn phí + doanh thu ảo. Ngẫu nhiên riêng, không `dev-`. |
   | `UPLOAD_SIGNING_SECRET` | **Có** | Khóa ký vé upload **và URL ký tải file riêng tư**. Ngẫu nhiên riêng, không `dev-`. |
   | `CORS_ORIGIN` | **Có** | URL frontend (có `https://`, không dấu `/` cuối); nhiều origin cách nhau dấu phẩy. Mặc định `http://localhost:5173` là sai khi production. |
   | `FRONTEND_URL` | **Có** | URL frontend — dùng dựng link trong email (đặt lại mật khẩu, xác thực email). |
   | `PLATFORM_ADMIN_EMAILS` | Nên | Email Platform Admin, cách nhau dấu phẩy (vd `admin@sofinhub.test` nếu nạp seed). Họ có quyền ghi đè Owner ở mọi cộng đồng. |
   | `PORT` | Không | Mặc định `4000` (Render tự cấp `PORT`, app đọc được). |
   | `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | Không | `15` / `30`. |
   | `UPLOAD_DIR` | Không | Mặc định `data/uploads` (ổ đĩa container — mất khi redeploy trên gói free, xem 1.5). |
   | `SUPPORT_EMAIL` | Không | Hộp thư nhận form liên hệ. |
   | `TRIAL_DAYS`, `SUBSCRIPTION_PERIOD_DAYS`, `REFUND_WINDOW_DAYS`, `PLATFORM_COMMISSION_PCT`, `GATEWAY_FEE_PCT`, `GATEWAY_FEE_FIXED_CENTS`, `PAYOUT_MIN_USD` | Không | Giá trị nghiệp vụ TẠM (chờ chốt) — nay chỉnh ở Admin > System > Global Settings, env chỉ là mặc định. |
   | `RUN_MIGRATIONS` | Tùy chọn | `1` = container tự chạy `prisma migrate deploy` trước khi start (xem 1.3). |
   | `ENABLE_DEV_OUTBOX` | **PHẢI ĐỂ TRỐNG khi production** | Mở `GET /api/dev/outbox` (không cần đăng nhập, lộ nguyên văn mọi email gồm link đặt lại mật khẩu). Bật khi production → app **từ chối khởi động**. Chỉ dùng ở máy dev (`backend/.env`) và test. |

   **Chốt chặn khi `NODE_ENV=production`** (`backend/src/config/env-guard.ts`): app thoát ngay nếu (1) bất kỳ secret nào còn giá trị mặc định `dev-*`, (2) thiếu `DATABASE_URL`, (3) `ENABLE_DEV_OUTBOX` được bật. Ngoài production: cookie refresh vẫn `Secure` trừ khi `NODE_ENV=development`; lỗi 500 chỉ lộ chi tiết khi `NODE_ENV=development`.

5. **Create Web Service** → chờ build → copy URL Render cấp (dạng `https://sofinhub-api.onrender.com`).

### 1.3 Migration (tạo bảng) — làm TRƯỚC khi code mới chạy

Schema do Prisma quản lý (`backend/prisma/migrations`, lệnh `npm run db:deploy` = `prisma migrate deploy`). Không có bước này thì DB trống: `/health` trả 503 và mọi API cần dữ liệu lỗi. Chọn một cách:

- **A. Tự động trong container (khuyến nghị cho Render free):** đặt env `RUN_MIGRATIONS=1`. `docker-entrypoint.sh` chạy `prisma migrate deploy` rồi mới `node dist/index.js`. Migration lỗi → container thoát, bản cũ vẫn chạy (không có nửa vời). An toàn khi nhiều instance (Prisma dùng advisory lock).
- **B. Release / Pre-Deploy command của nền tảng:** Render (trả phí) *Pre-Deploy Command* `npx prisma migrate deploy`; ECS: task riêng chạy `npx prisma migrate deploy` trước khi cập nhật service.
- **C. Chạy tay từ máy bạn** (lần đầu hoặc khi cần kiểm soát), trỏ vào **External URL**:

  ```powershell
  cd backend
  $env:DATABASE_URL = "<External Database URL>?sslmode=require"
  npm ci
  npm run db:deploy     # tạo toàn bộ bảng (prisma migrate deploy)
  npm run db:seed       # (tùy chọn, CHỈ để test) nạp tài khoản/dữ liệu mẫu, mật khẩu chung Passw0rd!x
  ```

  **Không chạy `db:seed` trên môi trường có người dùng thật** (tạo các tài khoản `@sofinhub.test` với mật khẩu công khai). Mỗi lần có migration mới, chạy lại `db:deploy` **trước** khi deploy code mới (cách A/B làm việc này tự động).

### 1.3a Extension `pg_trgm` + migration tìm kiếm (audit STEP 8)

Migration `20261005100000_search_fulltext` cần extension **`pg_trgm`** (khớp chuỗi con / gõ sai khi tìm kiếm) và tự chạy `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public`.
- Render/Neon/Supabase/RDS (PG13+): `pg_trgm` là *trusted extension* — user chủ database tạo được, không cần superuser. Nếu nền tảng của bạn cấm, chạy một lần bằng quyền cao hơn rồi mới `db:deploy`: `CREATE EXTENSION pg_trgm;` (nếu cài ở schema khác `public` cũng được — code tra schema lúc chạy).
- Không cần extension `unaccent` (đã có hàm SQL `sf_fold` thay thế).
- Migration thêm cột `GENERATED ... STORED` cho `Course`, `Post`, `User` => viết lại 3 bảng với khóa ghi trong lúc chạy: nên chạy lúc ít người dùng nếu `Post` đã lớn (vài trăm nghìn dòng trở lên). Tìm kiếm trả lỗi 500 nếu code mới chạy trước khi migration xong — dùng cách A/B ở 1.3 để migration chạy trước khi nhận traffic.

### 1.4 Kiểm tra sau deploy — ý nghĩa của `/health`

Mở `https://<url-render>/health`:

| Phản hồi | Nghĩa |
|---|---|
| `200 {"status":"ok","uptime":...}` | Tiến trình chạy **và** truy vấn `SELECT 1` tới DB thành công. |
| `503 {"status":"db_unavailable"}` | Tiến trình sống nhưng DB không dùng được (sai `DATABASE_URL`, DB ngủ/hết hạn, chưa mở kết nối, sai mật khẩu). Lý do chi tiết nằm ở **Logs**: dòng `[health] kiểm tra DB thất bại: ...` (response không lộ chi tiết). |
| Không phản hồi / container thoát liên tục | Cấu hình sai chặn khởi động — xem Logs (`Invalid environment variables` hoặc `Cấu hình production không an toàn`). |

Endpoint này là cả liveness lẫn readiness: ALB/ECS/Render dùng nó để loại instance khi DB chết; Docker `HEALTHCHECK` trong `Dockerfile` gọi cùng đường dẫn mỗi 30 giây. `/health` **không** kiểm tra S3/mail/cổng thanh toán.

### 1.5 Hạn chế cần biết khi chạy trên Render

- **File upload** lưu ổ đĩa container → mất khi deploy/restart trên gói free (chưa có S3). Ảnh/tệp đính kèm chỉ nên dùng để demo. File riêng tư (tin nhắn, tài liệu bài học) chỉ tải được khi đăng nhập có quyền hoặc qua URL ký 5 phút; chỉ ảnh avatar/cover/ảnh bài viết là công khai.
- **Realtime (SSE), rate limit, job nhắc lịch/gia hạn**: mặc định chạy trong 1 tiến trình (đúng với **1 instance**); gói free "ngủ" thì job không chạy. Muốn chạy nhiều instance xem mục **1.7** bên dưới.
- **Email**: provider mặc định ở production là **log-only** — chỉ ghi dòng `[mail] -> <người nhận> | <tiêu đề>` vào log, **không gửi thật và không lưu nội dung** (nội dung chứa token). Hậu quả: quên mật khẩu / xác thực email không tới hộp thư. **Không** hạ `NODE_ENV` xuống `development` hay bật `ENABLE_DEV_OUTBOX` để "xem thư" — đó là lỗ chiếm tài khoản. Với môi trường tester dùng tài khoản seed đã xác thực sẵn; khi lên thật nối AWS SES/SMTP bằng `setMailProvider()` trong `backend/src/modules/mail/mail.service.ts`.
- **Thanh toán** vẫn là cổng giả (`MockGateway`), chưa thu tiền thật.

### 1.6 Kiểm tra nhanh trên máy với image production

```powershell
docker build -t sofinhub-api backend
docker run --rm -p 4000:4000 -e DATABASE_URL=postgresql://sofinhub:sofinhub@host.docker.internal:5435/sofinhub `
  -e JWT_ACCESS_SECRET=$(node -p "require('crypto').randomBytes(32).toString('hex')") -e JWT_REFRESH_SECRET=... `
  -e PAYMENT_WEBHOOK_SECRET=... -e UPLOAD_SIGNING_SECRET=... -e CORS_ORIGIN=http://localhost:5173 -e FRONTEND_URL=http://localhost:5173 `
  -e RUN_MIGRATIONS=1 sofinhub-api
```

### 1.7 Nhiều instance, Redis & worker

**Quy tắc ngắn:** 1 instance không Redis là ổn. **Nhiều instance BẮT BUỘC có Redis** (`REDIS_URL`).

| State | Không Redis (in-memory) | Có `REDIS_URL` |
|---|---|---|
| Fan-out SSE tin nhắn/thông báo | chỉ tới người cắm SSE cùng instance | pub/sub — gửi ở A, nhận ở B |
| Vé stream (messages/notifications) | mint ở A, redeem ở B => 401 | dùng chung, 1 lần (GETDEL) |
| Nonce vé upload (chống replay) | mất khi restart | `SET NX` bền, đúng giữa instance |
| Rate limit toàn cục/ghi/tìm kiếm/gửi tin | tính riêng từng instance | hạn mức chung |
| Throttle thông báo tin nhắn, cache preference | lệch giữa instance | chung / vô hiệu tức thì |

- Đặt `REDIS_URL=redis://[:mật-khẩu@]host:6379` (managed Redis: Upstash/ElastiCache/Render Redis; dùng `rediss://` nếu có TLS). `REDIS_KEY_PREFIX` (mặc định `sofinhub:`) để nhiều môi trường dùng chung 1 Redis. Redis chỉ giữ dữ liệu tạm (không cần persistence). Redis chết: rate limit **fail-open** (cho qua), SSE rơi về giao cục bộ, vé/nonce upload từ chối (an toàn); API vẫn chạy.
- Production khởi động mà phát hiện nhiều instance (`INSTANCE_COUNT`/`WEB_CONCURRENCY` > 1) nhưng thiếu `REDIS_URL` thì **chỉ cảnh báo** trong log (không thoát).
- Không cần sticky session khi đã có Redis. Giữ timeout ALB/nginx cho SSE đủ dài (heartbeat 25s); `X-Accel-Buffering: no` đã gửi sẵn.
- **Job nền** (`src/jobs.ts`: gia hạn + đối soát tiền mỗi 5 phút, nhắc lịch mỗi 60s) chạy dưới **leader election bằng Postgres advisory lock** theo tên job: bật ở mọi instance vẫn chỉ 1 instance chạy mỗi lượt, không cần Redis; instance chết thì khóa tự nhả. Hai cách chạy:
  1. Mọi instance đều chạy job (mặc định `RUN_SCHEDULERS=1`) — đơn giản nhất.
  2. Tách: web đặt `RUN_SCHEDULERS=0`; chạy 1+ worker bằng `npm run start:worker` (`node dist/worker.js`; image Docker: đặt `RUN_ROLE=worker`). Worker không mở cổng HTTP. Thông báo do worker tạo vẫn lưu DB nhưng chỉ đẩy realtime tới web khi có `REDIS_URL`.
  Gói free "ngủ" thì job không chạy — cần ít nhất 1 process luôn thức (worker hoặc web trả phí).
- **Email production**: provider mặc định là log-only (thư bị bỏ, KHÔNG lưu nội dung; có cảnh báo lúc khởi động). Outbox in-memory chỉ dành cho dev/test. Nối SES/SMTP bằng `setMailProvider()` trước khi mở cho người dùng thật.
- **Tắt êm** (SIGTERM khi deploy): dừng scheduler, đóng SSE (EventSource tự nối lại với vé mới), ngừng nhận kết nối + chờ request đang xử lý, flush thông báo nền, đóng DB/Redis rồi thoát — thường dưới 1 giây dù còn SSE mở. Bước nào kẹt quá 5s thì bị bỏ qua; watchdog 30s chỉ là lưới an toàn cuối.
- Redis local: `docker compose up -d redis` (cổng 6380), `REDIS_URL=redis://localhost:6380`. Test adapter với Redis thật: `REDIS_URL=redis://localhost:6380 npm test` (CI có service Redis và chạy các test liên quan).

---

## Phần 2 — Deploy Frontend lên Vercel

1. Vào [vercel.com](https://vercel.com) → đăng nhập GitHub → **Add New** → **Project** → chọn repo `sofin_hub`.
2. Cấu hình:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vercel tự nhận ra **Vite** — giữ mặc định (Build Command `npm run build`, Output Directory `dist`).
   - File `frontend/vercel.json` đã có sẵn trong repo, giúp các route như `/login`, `/courses/:id` không bị lỗi 404 khi F5/mở link trực tiếp.
3. **Environment Variables**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://<url-render-ở-bước-1>/api` |

4. **Deploy** → chờ xong → copy URL Vercel cấp (dạng `https://sofin-hub.vercel.app`).

---

## Phần 3 — Nối 2 bên lại với nhau

1. Quay lại **Render** → Web Service → **Environment** → đặt `CORS_ORIGIN` và `FRONTEND_URL` = đúng URL Frontend ở Phần 2 (có `https://`, **không** dấu `/` cuối).
2. Lưu → Render tự deploy lại (hoặc **Manual Deploy**).
3. Vercel tạo thêm "Preview URL" mỗi lần push — muốn test cả bản preview thì thêm URL đó vào `CORS_ORIGIN`, cách nhau dấu phẩy. Bình thường chỉ cần domain Production.

---

## CI (GitHub Actions)

`.github/workflows/ci.yml` chạy trên mỗi push/PR: backend `typecheck` + `lint` + `npm test` (service container Postgres 16, DB `sofinhub_test`) + test adapter với Redis 7 thật + `build`; frontend `tsc -b` + `lint` + `build`. CI **không** deploy. Chạy coverage cục bộ: `cd backend && npm run test:coverage`.

---

## Checklist kiểm tra sau khi deploy

- [ ] `https://<url-render>/health` → `{"status":"ok",...}` (200)
- [ ] `https://<url-render>/api/dev/outbox` → **404** (hộp thư dev phải KHÔNG tồn tại)
- [ ] Mở URL Frontend → trang chủ hiện danh sách khóa học (FE gọi được BE)
- [ ] Đăng ký tài khoản mới → không lỗi
- [ ] F5 lại trang → vẫn còn đăng nhập (cookie cross-site hoạt động đúng)
- [ ] Vào 1 khóa học → bấm "Tham gia ngay" → chuyển thành "Đã tham gia"
- [ ] Đăng xuất → đăng nhập lại bằng đúng tài khoản vừa tạo
- [ ] (Tuỳ chọn) DevTools → Application → Cookies → domain Render → cookie `refresh_token` có cờ `Secure` + `SameSite=None`

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Container thoát ngay, log `Invalid environment variables ... NODE_ENV` | Chưa khai báo `NODE_ENV` (không còn mặc định). Đặt `production`. |
| Log `Cấu hình production không an toàn: JWT_ACCESS_SECRET đang là giá trị mặc định dev-*` (hoặc `PAYMENT_WEBHOOK_SECRET`, `UPLOAD_SIGNING_SECRET`...) | Chưa đặt secret riêng — tạo chuỗi ngẫu nhiên cho từng biến. |
| Log `DATABASE_URL bắt buộc khi production` | Chưa gắn `DATABASE_URL`. |
| Log `ENABLE_DEV_OUTBOX không được bật khi production` | Gỡ biến `ENABLE_DEV_OUTBOX` khỏi môi trường production. |
| `/health` trả 503 `db_unavailable` | `DATABASE_URL` sai/chưa mở kết nối/DB hết hạn (Render free ~30 ngày) — xem dòng `[health]` trong Logs. |
| `/health` 200 nhưng API lỗi "relation ... does not exist" | DB còn trống: chưa chạy migration (`RUN_MIGRATIONS=1` hoặc `npm run db:deploy`). |
| Lỗi CORS trong Console (F12) | `CORS_ORIGIN` sai — thiếu `https://`, thừa dấu `/` cuối, hoặc chưa đổi sang đúng domain Vercel. |
| Đăng nhập xong F5 bị out ngay | `NODE_ENV` chưa phải `production` (cookie chỉ bật `SameSite=None; Secure` khi production) hoặc `CORS_ORIGIN` sai. |
| Trang trắng / 404 khi mở thẳng `/login` hoặc `/courses/xxx` | Thiếu `frontend/vercel.json` hoặc Vercel không nhận Root Directory `frontend`. |
| Ảnh/tệp upload "biến mất" sau deploy | Upload ghi ổ đĩa container (gói free không bền) — chờ S3 hoặc gắn Persistent Disk. |
| Không nhận được email đặt lại mật khẩu | Provider mail production là log-only (xem 1.5) — nối SES/SMTP; không bật outbox dev. |
| Request đầu tiên rất chậm (~30–60s) | Bình thường với Render free tier khi container vừa "thức dậy". |

## Nếu tester cần dữ liệu bền vững qua nhiều ngày

Dữ liệu nghiệp vụ đã nằm ở Postgres nên bền miễn là DB còn sống (lưu ý DB free của Render hết hạn ~30 ngày → dùng gói trả phí/Neon/Supabase). Riêng **file upload** cần Persistent Disk (gói Render trả phí) hoặc chuyển sang S3 (`StorageProvider` đã tách sẵn, xem `backend/docs/api/uploads.md`).
