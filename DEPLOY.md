# Hướng dẫn deploy để tester test thử (Frontend + Backend)

> Kiến trúc khuyến nghị: **Frontend → Vercel**, **Backend → Render**. Lý do vì sao *không* để Backend trên Vercel ở mục "⚠️" ngay dưới đây — đọc trước khi làm.

## 🆕 CẬP NHẬT 30/09/2026 — Backend giờ CẦN PostgreSQL (đọc trước khi làm các phần bên dưới)

> Các phần bên dưới được viết lúc backend còn lưu dữ liệu trong bộ nhớ/`users.json`. **Nay backend dùng Postgres thật (Prisma)** nên deploy cần thêm database, nếu không `/health` trả `{"status":"db_unavailable"}` (HTTP 503) và mọi API cần dữ liệu đều lỗi. Đoạn cảnh báo "chưa có database" ở mục ⚠️ bên dưới đã lỗi thời (Vercel vẫn không phù hợp vì SSE/scheduler cần tiến trình chạy liên tục, nên vẫn dùng Render cho backend).

### Cách sửa lỗi `db_unavailable` trên Render
1. **Tạo database**: Render → **New +** → **PostgreSQL** (Free được, nhưng DB free của Render **tự hết hạn sau ~30 ngày**; dùng lâu thì chọn gói trả phí hoặc Neon/Supabase free). Chọn **cùng Region** với Web Service. Sau khi tạo xong, mở database → copy:
   - **Internal Database URL** (dùng cho Web Service — nhanh, không cần SSL),
   - **External Database URL** (dùng để chạy migration/seed từ máy bạn).
2. **Gắn vào Web Service** (tab Environment của service API), thêm:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | **Internal Database URL** vừa copy |
   | `PLATFORM_ADMIN_EMAILS` | email admin nền tảng (vd `admin@sofinhub.test` nếu nạp seed) |
   | `FRONTEND_URL` | URL frontend trên Vercel (dùng dựng link trong email) |
   | `CORS_ORIGIN` | URL frontend trên Vercel (không dấu `/` cuối) |
   | `UPLOAD_SIGNING_SECRET`, `PAYMENT_WEBHOOK_SECRET` | 2 chuỗi ngẫu nhiên khác nhau (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |

   (Giữ `NODE_ENV`, `PORT`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`… như Phần 1.) Bấm **Save** → Render tự deploy lại.
3. **Tạo bảng + nạp dữ liệu** (làm 1 lần, chạy trên MÁY BẠN nhưng trỏ tới DB Render bằng **External URL**; thêm `?sslmode=require` vào cuối URL vì kết nối từ ngoài vào bắt buộc SSL):

   ```powershell
   cd backend
   $env:DATABASE_URL = "<External Database URL>?sslmode=require"
   npm ci
   npm run db:deploy     # tạo 37 bảng (prisma migrate deploy)
   npm run db:seed       # (tùy chọn) nạp tài khoản/dữ liệu test, mật khẩu chung Passw0rd!x
   ```
   Không chạy `db:seed` nếu đây là môi trường thật có người dùng thật (seed tạo các tài khoản `@sofinhub.test` với mật khẩu công khai). Mỗi lần có migration mới, chạy lại `npm run db:deploy` với cùng `DATABASE_URL` **trước** khi deploy code mới.
4. **Kiểm tra**: mở `https://<url-render>/health` → phải là `{"status":"ok",...}`. Nếu vẫn `db_unavailable`, xem **Logs** của service: dòng `[health] kiểm tra DB thất bại: ...` cho biết lý do (sai URL, chưa mở kết nối, sai mật khẩu...).

### Lưu ý khi chạy trên Render
- **File upload** lưu ổ đĩa của container → bị mất mỗi lần deploy/restart trên gói free (chưa có S3). Ảnh/tệp đính kèm chỉ nên dùng để demo.
- **Thông báo/tin nhắn realtime (SSE), rate limit, job nhắc lịch/gia hạn** chạy trong 1 tiến trình: chỉ chạy đúng với **1 instance**. Gói free "ngủ" khi không có traffic nên job định kỳ sẽ không chạy trong lúc ngủ.
- **Email chưa gửi thật**: link đặt lại mật khẩu/xác thực email không tới hộp thư (chỉ ghi vào outbox dev, và endpoint `/api/dev/outbox` bị tắt khi `NODE_ENV=production`). Với môi trường test trên Render, đặt tạm `NODE_ENV=development` **hoặc** dùng tài khoản seed đã xác thực sẵn; nối AWS SES/SMTP khi lên thật (`setMailProvider()` trong `mail.service.ts`).
- **Thanh toán**: vẫn là cổng giả (`MockGateway`), chưa thu tiền thật.

---

## ⚠️ Vì sao Backend không nên deploy lên Vercel lúc này

Vercel chạy backend dưới dạng **serverless function**: mỗi request có thể được xử lý bởi một container khác nhau, container bị hủy sau vài phút không dùng, và ổ đĩa **không ghi được** (trừ thư mục `/tmp` tạm thời, cũng bị xóa liên tục).

Backend hiện tại đang lưu dữ liệu kiểu "tạm" (đúng như PLAN.md đã ghi, chưa có database thật):

- Tài khoản người dùng → ghi ra file `backend/data/users.json`
- Trạng thái tham gia khóa học → lưu trong 1 biến `Set` ở bộ nhớ RAM
- Refresh token còn hiệu lực → lưu trong 1 biến `Map` ở bộ nhớ RAM

Cả 3 thứ này **không sống sót qua serverless container** của Vercel. Nếu vẫn deploy Backend lên Vercel, tester sẽ gặp:
- Đăng ký xong, lát sau tài khoản "biến mất"
- Tự nhiên bị đăng xuất giữa chừng dù không thao tác gì (refresh token bị "quên")
- Trạng thái "Đã tham gia khóa học" tự động mất

→ Vercel Functions chỉ nên dùng cho backend này **sau khi** đã chuyển sang PostgreSQL/Prisma thật (việc bạn vừa yêu cầu tạm dừng). Trong lúc chờ, **Render** (hoặc Railway/Fly.io — làm y hệt) chạy backend như 1 tiến trình sống liên tục, giống hệt máy bạn đang chạy `npm run dev` — không cần sửa code gì thêm, và **Dockerfile đã có sẵn sẵn trong repo** (`backend/Dockerfile`), Render dùng thẳng được luôn.

---

## Phần 1 — Deploy Backend lên Render

1. Đẩy code lên GitHub (nếu repo chưa có remote, tạo 1 repo trên GitHub rồi `git push`).
2. Vào [render.com](https://render.com) → đăng nhập bằng GitHub (miễn phí).
3. **New +** → **Web Service** → chọn repo `sofin_hub`.
4. Cấu hình:
   - **Root Directory**: `backend`
   - **Runtime**: chọn **Docker** (Render tự nhận `backend/Dockerfile`) — cách này khỏi cần khai Build/Start Command.
     - Nếu muốn build không qua Docker: Runtime **Node**, Build Command `npm ci && npm run build`, Start Command `npm start`.
   - **Instance Type**: **Free** (đủ cho tester dùng thử — lưu ý free tier "ngủ" sau ~15 phút không có traffic, request đầu tiên sau đó sẽ chậm khoảng 30–60 giây để "thức dậy", đây là bình thường).
5. **Environment Variables** (tab Environment), thêm từng biến:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `CORS_ORIGIN` | *(để tạm `http://localhost:5173`, quay lại sửa ở Phần 3)* |
   | `JWT_ACCESS_SECRET` | chuỗi ngẫu nhiên — tạo bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `JWT_REFRESH_SECRET` | 1 chuỗi ngẫu nhiên **khác** (tạo lại lệnh trên lần nữa) |
   | `ACCESS_TOKEN_TTL_MIN` | `15` |
   | `REFRESH_TOKEN_TTL_DAYS` | `30` |

   ⚠️ Bắt buộc đặt `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` riêng — code sẽ **từ chối khởi động** nếu thấy `NODE_ENV=production` mà 2 giá trị này vẫn là mặc định `dev-...` (chặn sẵn trong `backend/src/config/env.ts`).

6. **Create Web Service** → chờ build xong (vài phút) → copy URL Render cấp (dạng `https://sofinhub-api.onrender.com`).
7. Kiểm tra nhanh: mở `https://<url-render>/health` trên trình duyệt → phải thấy `{"status":"ok",...}`.

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

1. Quay lại **Render** → project backend → **Environment** → sửa `CORS_ORIGIN` = đúng URL Frontend ở Phần 2 (có `https://`, **không** có dấu `/` ở cuối).
2. Lưu → Render tự động deploy lại (hoặc bấm **Manual Deploy** nếu không tự chạy).
3. Vercel có thể tạo thêm "Preview URL" khác nhau mỗi lần push — nếu muốn tester test cả bản preview, thêm URL đó vào `CORS_ORIGIN`, cách nhau dấu phẩy. Bình thường chỉ cần domain chính (Production) là đủ.

---

## Checklist kiểm tra sau khi deploy

- [ ] Mở URL Frontend → trang chủ hiện danh sách khóa học (xác nhận FE gọi được BE)
- [ ] Đăng ký tài khoản mới → không lỗi
- [ ] F5 lại trang → vẫn còn đăng nhập (xác nhận cookie cross-site hoạt động đúng)
- [ ] Vào 1 khóa học → bấm "Tham gia ngay" → chuyển thành "Đã tham gia"
- [ ] Đăng xuất → đăng nhập lại bằng đúng tài khoản vừa tạo
- [ ] (Tuỳ chọn) DevTools → Application → Cookies → domain Render → cookie `refresh_token` có cờ `Secure` + `SameSite=None`

## Sự cố thường gặp

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| Lỗi CORS trong Console (F12) | `CORS_ORIGIN` trên Render sai — thiếu `https://`, thừa dấu `/` cuối, hoặc chưa đổi sang đúng domain Vercel |
| Đăng nhập xong F5 bị out ngay | `NODE_ENV` trên Render chưa phải `production` (cookie chỉ bật `SameSite=None` khi production) |
| Trang trắng / 404 khi mở thẳng `/login` hoặc `/courses/xxx` | Thiếu `frontend/vercel.json` (đã tạo sẵn) hoặc Vercel không nhận Root Directory `frontend` |
| Tài khoản/tiến độ tự nhiên "biến mất" sau 1 lúc | Render free tier ngủ rồi khởi động container mới → mất dữ liệu tạm — xem mục ⚠️ đầu file, đây là hạn chế do chưa có database thật, không phải lỗi cấu hình |
| Request đầu tiên rất chậm (~30–60s) | Bình thường với Render free tier khi container vừa "thức dậy" sau khi ngủ |

## Nếu tester cần dữ liệu bền vững qua nhiều ngày

Hai lựa chọn, không lựa chọn nào cần làm ngay:
1. Nâng Render lên gói có phí + gắn Persistent Disk (dữ liệu file JSON sống sót qua các lần restart) — nhanh, không đổi code.
2. Làm việc migrate sang PostgreSQL/Prisma thật (đã ghi trong PLAN.md, việc bạn vừa tạm dừng) — đúng hướng lâu dài, cũng là điều kiện cần nếu sau này muốn chuyển Backend sang Vercel Functions.
