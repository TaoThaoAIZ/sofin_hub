# PLAN — Skool Clone (kế hoạch nhiều ngày)

> Cập nhật trạng thái bằng cách tick `[x]`. Mỗi phase = 1 nhánh việc độc lập, làm xong thì chạy được, demo được.
> Ước lượng theo "ngày làm việc" với 1 dev + Claude Code. Các mục ghi **(đề xuất)** là quyết định chưa chốt — xem mục "Câu hỏi cần chốt" ở cuối.

## Stack & quy ước

- **FE**: React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + React Router (`frontend/`)
- **BE**: Node.js + Express 5 + TypeScript + Zod (`backend/`), mỗi module = `routes → service → repository`
- **DB (đề xuất)**: PostgreSQL + Prisma (RDS khi lên AWS)
- **Deploy**: BE Docker → ECR → ECS/EC2 sau ALB; FE build → S3 + CloudFront. Hạ tầng dựng bằng skill `aws-provision`
- **Quy ước mỗi feature**: BE `modules/<tên>/` + FE `features/<tên>/` (types, api, queries, components) + trang trong `pages/`
- **Quy ước UI**: dùng lại token/utility trong `frontend/src/index.css` (`glass`, `glass-chip`, `bg-brand-gradient`, `shadow-brand`). Trang mới bám theo file UI HTML/Figma người dùng đưa; xong phải so ảnh chụp với bản gốc
- **Definition of Done mỗi phase**: typecheck sạch, build sạch, chạy thử bằng trình duyệt (golden path + lỗi), README/PLAN cập nhật

---

## Phase 0 — Nền tảng + Trang chủ ✅ (đã xong)

- [x] Khởi tạo monorepo `frontend/` + `backend/`, scripts chạy chung (`npm run dev`)
- [x] Trích design từ `Trang chu Liquid Glass (offline).html`: màu, icon SVG, font, logo, ảnh
- [x] Design tokens + utility kính mờ trong `index.css`
- [x] Trang chủ: Header, Hero + thống kê, tab danh mục, bộ lọc, lưới/danh sách khóa học, phân trang
- [x] API: `/health`, `/api/courses`, `/api/courses/:id`, `/api/categories`, `/api/stats` (dữ liệu seed)
- [x] Dockerfile backend, graceful shutdown, CORS/helmet/compression
- [x] README + so sánh trực quan với bản gốc

---

## Phase 1 — Database & Xác thực (Ngày 1–2) ✅ (đã xong, trừ Postgres/Prisma)

**BE**
- [x] Docker Compose Postgres local + Prisma schema: `User`, `Session/RefreshToken` (đang dùng file JSON `backend/data/users.json` tạm thời — xem "Câu hỏi cần chốt") — ✅ đã làm 2026-09-30 (schema 37 bảng, User+Session+OneTimeToken...); dữ liệu users.json cũ đã nhập bằng `npm run db:import-users`
- [x] Chuyển `CourseRepository` từ seed sang Prisma (giữ nguyên interface, seed bằng `prisma db seed`) — ✅ đã làm (mọi repository chuyển Prisma; seed bằng `npm run db:seed`, không dùng `prisma db seed`)
- [x] `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`
- [x] Hash mật khẩu (bcryptjs), access token JWT ngắn hạn + refresh token cookie httpOnly xoay vòng (rotation), rate limit đăng nhập (`express-rate-limit`)
- [x] Middleware `requireAuth` / `optionalAuth`, chuẩn hóa lỗi 401/403/409/429

**FE**
- [x] Trang Đăng nhập & Đăng ký (`/login`, `/register`, glass UI theo đúng file thiết kế), validate từng ô inline (không chỉ 1 banner lỗi chung), hiện lỗi từ API
- [x] Quy tắc mật khẩu khi đăng ký: tối thiểu 8 ký tự, có chữ in hoa và ký tự đặc biệt (đồng bộ giữa `auth.schema.ts` và `features/auth/validation.ts`)
- [x] Trang `/terms`, `/privacy`: không dùng Header/Footer trang chủ (thuộc flow đăng ký riêng, có nút "Quay lại đăng ký"). Trang Đăng ký bắt cuộn hết `/terms` + `/privacy` (theo dõi qua `features/auth/legalConsent.ts`, IntersectionObserver) mới mở khóa checkbox "Tôi đồng ý"; chưa tick thì nút Đăng ký bị khóa
- [x] `AuthProvider` (Context) + tự refresh token khi tải lại trang, route `/courses/:id` dùng phiên đăng nhập
- [x] Tự làm mới access token **giữa phiên** (không chỉ lúc tải trang): `lib/api.ts` bắt lỗi 401 do access token hết hạn (15 phút), tự gọi `/auth/refresh` rồi thử lại đúng request đó — không cần F5. Nếu refresh cũng fail (refresh token hết hạn/bị thu hồi) mới coi là hết phiên thật, đưa về trạng thái guest
- [x] Header: hiện avatar + menu người dùng (đăng xuất) khi đã đăng nhập; nút "Đăng nhập" điều hướng sang `/login`

**DoD**: đăng ký → đăng nhập → refresh trang vẫn còn phiên → đăng xuất — **đã kiểm thử bằng Playwright + curl**

## Phase 1.5 — Trang chi tiết khóa học (làm sớm hơn kế hoạch)

- [x] Trang `/courses/:id` theo file thiết kế `Chi tiet khoa hoc.dc.html`: hero, breadcrumb, facts, tab Tổng quan/Nội dung/Đánh giá/FAQ, sidebar giá + tham gia, đánh giá học viên
- [x] API `GET /api/courses/:id` trả thêm nội dung chi tiết (mô tả, lộ trình học, module, FAQ, đánh giá minh họa — xem `backend/src/modules/courses/course-detail.ts`)
- [x] API `POST /api/courses/:id/enroll` (yêu cầu đăng nhập) — toggle tham gia/rời khóa học, lưu trạng thái ở server (không phải state ảo trên FE)
- [x] Model `Enrollment` thật khi có DB (hiện lưu Set trong bộ nhớ, xem `modules/enrollments/enrollments.repository.ts`) — ✅ đã làm (bảng Enrollment + CommunityBan)
- [ ] Đánh giá học viên hiện là dữ liệu minh họa dùng chung cho mọi khóa học — cần model `Review` thật khi làm Phase 3

## Phase 2 — Cộng đồng (Community) (Ngày 3–4)

> ✅ **MVP rút gọn đã làm (2026-09-29)**: trang `/courses/:id/community` (bảng tin, lớp học, lịch,
> thành viên, xếp hạng, giới thiệu) dựng theo file thiết kế `SofinHub Community (1).html`, nhưng
> **"cộng đồng" tạm gắn 1-1 với `Course` hiện có** (chưa có model `Community`/`Membership`/role
> owner-admin-mod riêng — mọi người tham gia đều là "Member", không có Owner/Admin thật vì khóa học
> vẫn là dữ liệu mẫu tĩnh trong `courses.seed.ts`, không do user tạo). DoD gốc "chủ cộng đồng thấy
> công cụ quản trị" **chưa đạt** — cần làm lại đúng theo model dưới đây khi tách Course ra khỏi
> Community thật. Xem chi tiết từng phần ở Phase 3/4/5/6/8 bên dưới.

- [ ] Model `Community` (tên, slug, mô tả, ảnh bìa, giá, riêng tư/công khai), `Membership` (role: owner/admin/mod/member)
- [x] API: tạo / sửa / xem cộng đồng, tham gia / rời, danh sách thành viên — ✅ BE (`POST /communities`, `PATCH|DELETE /courses/:id`, khóa của Platform Admin); FE chưa
- [ ] FE: luồng "Tạo cộng đồng" (wizard ngắn), trang Khám phá thay cho trang khóa học hiện tại (dùng lại lưới card + filter)
- [ ] Layout trang cộng đồng `/c/:slug` với tab: Cộng đồng · Khóa học · Lịch · Thành viên · Giới thiệu
- [x] Phân quyền theo role ở BE (policy tập trung) — ✅ `permissions/policy.ts` (member<mod<admin<owner<platform_admin)
- [ ] Vai trò trong 1 cộng đồng (theo tài liệu `SofinHub-BRD.docx` mục 2):
  - **Khách** (chưa đăng nhập): chỉ xem tên/mô tả/giá cộng đồng công khai, không xem nội dung bên trong
  - **Member**: tham gia được (theo luồng bên dưới), học, đăng bài, bình luận
  - **Owner** (người bấm "Tạo cộng đồng"): toàn quyền — tạo/sửa khóa học, đặt giá, mời Admin/Mod, xem doanh thu
  - **Admin/Mod**: được Owner cấp quyền, tạo/sửa nội dung + kiểm duyệt; **mặc định KHÔNG** xem doanh thu/đổi giá trừ khi Owner cấp thêm
  - **Platform Admin** (đội SofinHub, không tự đăng ký): có quyền ghi đè quyết định của Owner để xử lý vi phạm (khoá/gỡ cộng đồng) — xem thêm Phase 9
- [x] 3 luồng tham gia cộng đồng cần cài đủ (không gộp chung "tham gia" như hiện tại ở khóa học đơn lẻ): — ✅ BE (402 `PAYMENT_REQUIRED` / 403 `JOIN_REQUEST_REQUIRED` + yêu cầu tham gia + lời mời); FE chưa
  1. Công khai + miễn phí → bấm "Tham gia" vào ngay
  2. Công khai + có phí → phải thanh toán/dùng thử trước (phụ thuộc Phase 8); có thể cho xem trước 1 phần nội dung
  3. Riêng tư → gửi yêu cầu tham gia, chờ Owner/Admin duyệt, hoặc vào bằng link mời

**DoD**: tạo cộng đồng, người khác tham gia được, chủ cộng đồng thấy công cụ quản trị

## Phase 3 — Bảng tin (Feed / Posts) (Ngày 5–7)

> ✅ **MVP rút gọn đã làm**: `backend/src/modules/posts/` — CRUD bài viết, bình luận (1 cấp),
> like/unlike, ghim (đã giới hạn mod trở lên từ 2026-09-30, xem mục "Đợt hoàn thiện API backend"), phân trang trang số (chưa phải cursor). Chưa làm: upload ảnh thật (chỉ nhận `imageUrl` có
> sẵn), rich text/embed, feed cuộn vô hạn (`useInfiniteQuery`).

- [ ] Model `Post`, `Comment`, `Like`, `PostCategory`; ghim bài
- [x] API CRUD bài viết + bình luận lồng 1 cấp, like/unlike, phân trang cursor — ✅ BE sửa/xóa/ẩn/chia sẻ/poll/thẻ (phân trang vẫn theo số trang, chưa cursor)
- [x] Upload ảnh/file: presigned URL S3 (local dùng MinIO hoặc thư mục tạm) — ✅ BE lưu ổ đĩa cục bộ qua `StorageProvider` (chưa S3/MinIO thật)
- [ ] FE: composer (soạn bài), feed vô hạn (`useInfiniteQuery`), card bài viết, bình luận, like optimistic
- [ ] Soạn thảo rich text nhẹ (đề xuất: TipTap) + embed link/video

**DoD**: đăng bài có ảnh, bình luận, like, ghim; feed cuộn mượt

## Phase 4 — Lớp học (Classroom) (Ngày 8–10)

> ✅ **MVP rút gọn đã làm**: `backend/src/modules/classroom/` — Module → Lesson **sinh tự động**
> từ `course.lessons`/`durationMinutes` có sẵn (chưa có trình soạn nội dung thật cho owner/admin),
> tiến độ % thật theo user, khóa module tuần tự (module sau chỉ mở khi module trước hoàn thành
> 100%). Chưa làm: soạn nội dung thật (video/văn bản/tệp do người dùng tạo), khóa theo "cấp độ"
> (level) như thiết kế gốc, chứng nhận hoàn thành, nhúng YouTube/Vimeo thật (lesson chỉ có `body`
> minh họa).

- [ ] Model `Course` (thuộc cộng đồng) → `Module` → `Lesson` (video/văn bản/tệp), `Progress`
- [x] API quản lý nội dung (owner/admin) + API học viên xem, đánh dấu hoàn thành — ✅ BE (mod+; CRUD module/bài học, sắp xếp, player, tiến độ)
- [x] Khóa bài theo cấp độ / theo gói (kiểm tra ở BE, không tin FE) — ✅ BE khóa theo module trước + cấp độ (`requiredLevel`); khóa theo gói chưa
- [ ] FE: trang danh sách khóa, trang học (sidebar bài học + player + tiến độ %), trình soạn khóa cho admin
- [ ] Video: đề xuất nhúng YouTube/Vimeo trước, tự host (S3 + CloudFront / MediaConvert) để sau
- [x] Chứng nhận hoàn thành khóa học (certificate) khi đạt 100% tiến độ — tuỳ chọn bật/tắt theo từng cộng đồng (đề xuất, chưa xác nhận) — ✅ BE (bật/tắt theo cộng đồng, xác minh công khai); chưa PDF

**DoD**: tạo khóa → học viên học và thấy % tiến độ

## Phase 5 — Thành viên, Hồ sơ, Xếp hạng (Ngày 11)

> ✅ **MVP rút gọn đã làm**: `backend/src/modules/points/` (sổ điểm: +5 đăng bài, +2 nhận like,
> +3 hoàn thành bài học, +1 RSVP sự kiện) + `communityService.leaderboard()` (7 ngày/30 ngày/mọi
> thời điểm), danh sách thành viên có tìm kiếm + trạng thái online (dựa trên `lastActiveAt`, không
> phải cấp độ thật như thiết kế gốc — bảng "Hành trình thăng cấp" chưa làm). Chưa làm: trang hồ sơ
> cá nhân riêng, hệ thống cấp độ (level 1-9 như thiết kế).

- [x] Trang hồ sơ cá nhân (ảnh, bio, cộng đồng đã tham gia, hoạt động) — ✅ BE (`GET /users/:id`, `PATCH /auth/me`, `/me/enrollments`, `/me/points`); FE chưa
- [x] Hệ thống điểm: +điểm khi đăng bài / nhận like / hoàn thành bài; cấp độ — ✅ BE + cấp độ (`points.levels.ts`, ngưỡng tạm)
- [x] Bảng xếp hạng (7 ngày / 30 ngày / mọi thời điểm) — ✅ BE + FE
- [x] Trang danh sách thành viên có tìm kiếm + lọc role — ✅ BE + FE (tab lọc, tìm, sắp xếp)

## Phase 6 — Lịch & Sự kiện (Ngày 12)

> ✅ **MVP rút gọn đã làm**: `backend/src/modules/events/` — tạo sự kiện, RSVP (kiểm tra `capacity`
> thật ở server), danh sách sắp diễn ra/đã diễn ra. FE hiện là **danh sách**, chưa phải lịch dạng
> tháng/tuần như thiết kế gốc (đơn giản hóa có chủ đích, xem "Khác bản gốc" trong báo cáo). Chưa
> làm: nhắc lịch, xuất `.ics`/Google Calendar.

- [x] Model `Event` (thời gian, múi giờ, link họp, giới hạn), RSVP — ✅ BE (CRUD, RSVP, giới hạn chỗ)
- [x] FE: lịch tháng/danh sách, chi tiết sự kiện, thêm vào Google Calendar (file .ics) — lịch tháng/tuần/ngày + chi tiết ✅ FE; BE `.ics` ✅, nút thêm vào lịch FE chưa
- [x] Nhắc lịch (email/thông báo) — ✅ BE thông báo trước 1 giờ (chưa email)

## Phase 7 — Thông báo & Chat (Ngày 13–14)

- [x] Model `Notification`; API đọc/đánh dấu đã đọc; chuông thông báo trên Header — ✅ BE (danh sách, chưa đọc, tuỳ chọn); chuông FE chưa
- [x] Kênh realtime (đề xuất SSE cho thông báo, WebSocket cho chat) — ✅ BE SSE cho thông báo + tin nhắn (vé một lần); WebSocket chưa cần
- [x] Tin nhắn trực tiếp 1-1: model `Conversation`/`Message`, giao diện chat — ✅ BE (chặn người dùng, throttle thông báo); giao diện chat chưa
- [ ] Email giao dịch (đề xuất AWS SES)

## Phase 8 — Thanh toán & Gói thành viên (Ngày 15–16)

> ✅ **MVP rút gọn đã làm**: `backend/src/modules/payments/` — luồng `checkout → confirm → cấp
> quyền` thật (PaymentIntent pending/succeeded, idempotent, chặn nội dung ở server tới khi thanh
> toán xong), FE `CheckoutPage` (dialog xác nhận ở trang khóa học có phí → chọn phương thức →
> thanh toán). **Cổng thanh toán vẫn CHƯA nối thật** (Stripe/VNPay/MoMo chưa chốt) — bước "confirm"
> hiện tự coi là thành công ngay khi gọi API, cần thay bằng webhook thật của cổng đã chọn khi triển
> khai. Chưa làm: webhook thật, `Subscription` gia hạn định kỳ/hủy, hoàn tiền, trang "Doanh thu của
> tôi" + Payout cho Owner (không có do chưa có Owner thật).

- [ ] Chốt cổng thanh toán (Stripe / PayOS / VNPay — xem câu hỏi cuối)
- [ ] Chốt mô hình doanh thu nền tảng trước khi thiết kế schema (xem câu hỏi cuối) — quyết định % hoa hồng hay phí cố định ảnh hưởng trực tiếp bảng `Transaction`/`Payout`
- [x] Gói theo tháng cho cộng đồng có phí ("$x/tháng" đã có trên UI), dùng thử miễn phí — ✅ BE (checkout, dùng thử, hủy/tiếp tục, gia hạn, `MockGateway`)
- [x] Webhook xử lý thanh toán (idempotent), trạng thái `Subscription`, gia hạn/hủy — ✅ BE (HMAC + chống replay + idempotent)
- [x] Chính sách hủy & hoàn tiền cụ thể (đề xuất: hoàn 100% trong thời gian dùng thử; không hoàn sau khi đã thu phí trừ trường hợp Platform Admin duyệt đặc biệt — cần xác nhận) — ⚠️ đã cài THEO ĐỀ XUẤT (7 ngày, cấu hình `REFUND_WINDOW_DAYS`), vẫn cần xác nhận
- [ ] Trang thanh toán + quản lý gói của tôi
- [x] Trang "Doanh thu của tôi" cho Owner: số dư, lịch sử giao dịch, lịch rút tiền tiếp theo — ✅ BE `GET /courses/:id/revenue`; FE chưa
- [x] Payout cho Owner: định kỳ (đề xuất hàng tháng), có ngưỡng rút tối thiểu, trừ hoa hồng nền tảng + phí cổng thanh toán trước khi chuyển khoản — ✅ BE (duyệt thủ công bởi Platform Admin; ngưỡng/chu kỳ tạm)

## Phase 9 — Quản trị, Tìm kiếm, i18n, SEO (Ngày 17–18)

- [x] Công cụ kiểm duyệt: báo cáo bài, ẩn/xóa, cấm thành viên — 2 cấp: Owner/Admin kiểm duyệt trong cộng đồng của mình, Platform Admin có quyền ghi đè để xử lý vi phạm toàn nền tảng (khoá/gỡ cộng đồng) — ✅ BE (báo cáo, ẩn nội dung, ban; 2 cấp Owner/Admin + Platform Admin); FE chưa
- [x] Tìm kiếm toàn cục (đề xuất Postgres full-text trước; OpenSearch khi cần) — ✅ BE lọc trong bộ nhớ (chưa Postgres full-text); ô tìm topbar mới chuyển sang tab Thành viên
- [ ] i18n VI/EN (nút "VI" trên Header hiện chỉ là hình) — `react-i18next`
- [ ] SEO: meta/OG theo trang, sitemap, SSR/prerender trang công khai nếu cần (cân nhắc chuyển Next.js)
- [ ] Trang "Xem tất cả", 404/500 hoàn chỉnh, empty states

## Phase 10 — Chất lượng & Lên AWS (Ngày 19–21)

- [x] Test: unit (Vitest) cho service quan trọng, integration API (Supertest), e2e golden path (Playwright) — BE: 145 test tích hợp `node:test` (`cd backend && npm test`); FE/e2e xem thư mục `e2e/`
- [ ] CI GitHub Actions: typecheck + test + build
- [ ] Dựng hạ tầng bằng skill `aws-provision` (ECR, ECS/EC2, RDS Postgres, S3, CloudFront, Route 53, ACM)
- [ ] CD: push `main` → build image → deploy; migrate DB an toàn
- [ ] Giám sát: CloudWatch logs/alarms, health check ALB, Sentry (đề xuất)
- [ ] Bảo mật: rà soát CORS, rate limit, validate input, secrets trong SSM/Secrets Manager
- [ ] Sao lưu RDS + kế hoạch rollback

## Đợt hoàn thiện API backend (2026-09-30)

> Sửa lỗi phân quyền + bổ sung ~120 endpoint còn thiếu (tổng ~150 route).
> **Tổng quan & bảng phân quyền: `backend/docs/API.md`; chi tiết từng nhóm: `backend/docs/api/*.md`; quy ước viết code: `backend/docs/CONVENTIONS.md`.**

- ✅ **Lỗi bảo mật đã sửa**: trước đây *mọi* thành viên đều ghim được bài và tạo được sự kiện. Nay chỉ mod trở lên (`requireRole`). FE ẩn nút theo `viewerRole` (trả trong `GET /courses/:id`).
- ✅ Vai trò thật cho thành viên (`member|mod|admin|owner`) + Platform Admin qua env `PLATFORM_ADMIN_EMAILS`.
- ✅ 7 nhóm API: danh tính (auth/hồ sơ/email), cộng đồng (tạo/tham gia/mời/vai trò/đánh giá), nội dung (bài viết/sự kiện), kiểm duyệt, lớp học, tìm kiếm + thông báo, tin nhắn + upload, thanh toán.
- ✅ **Database thật (Postgres 16 + Prisma 7)**: `docker-compose.yml` (cổng 5435), 37 bảng, migration, seed idempotent (`npm run db:up|db:deploy|db:seed`), toàn bộ 14 repository đã chuyển từ bộ nhớ sang Prisma; test tích hợp chạy trên DB thật, mỗi file một schema tạm (**224 test xanh**). Chi tiết: `backend/docs/DATABASE.md`, `backend/docs/DB-MIGRATION-2B.md`.
- ✅ **Dữ liệu test trong DB**: tài khoản cố định (admin/owner/cadmin/mod/member1..3/newbie/banned @sofinhub.test, mật khẩu `Passw0rd!x`), 23 cộng đồng, ~1.5K user (thành viên minh họa `isDemo`), bài viết/poll/báo cáo/sự kiện/lớp học/điểm/thanh toán/thông báo/tin nhắn, mã mời `DEMO-*`, chứng nhận `FIN-DEMO-CERT-001`. Danh sách kịch bản: `SofinHub_HuongDan_TestThuCong.docx`, sheet "Tài khoản & dữ liệu test" trong `SofinHub_TestCases.xlsx`.
- ✅ **Thu hồi access token tức thì**: JWT mang `sid`+`tv`, mọi request kiểm tra phiên + `tokenVersion` trong DB; đổi/đặt lại mật khẩu, xóa tài khoản, logout, logout-all, thu hồi phiên → token cũ 401 ngay (`tests/token-revocation.test.ts`). Xóa tài khoản = ẩn danh hóa (giữ nội dung).
- ✅ **Frontend đã nối toàn bộ API mới** (4 nhóm: tài khoản; quản trị cộng đồng; bảng tin/lịch/lớp học/kiểm duyệt; thông báo/chat/tìm kiếm/thanh toán/quản trị nền tảng). Kịch bản thao tác: `docs/features/*.md`. `tsc -b` và `npm run build` sạch; **chưa** chạy Playwright/duyệt trên trình duyệt (chờ người test).
- ✅ **Bộ test QA** `SofinHub_TestCases.xlsx` được bổ sung testcase cho các tính năng trên (xem sheet "Nhật ký thay đổi").
- ⏳ **Còn mô phỏng**: cổng thanh toán (`MockGateway`), email chỉ vào outbox dev, upload ổ đĩa cục bộ, SSE/rate-limit 1 instance (cần Redis khi scale).
- ❓ **Cần chốt** (giá trị tạm đang dùng): hoa hồng nền tảng 10%; hoàn tiền 100% trong 7 ngày đầu; rút tiền tối thiểu $50; chọn cổng thanh toán (Stripe vs PayOS/VNPay/MoMo); kick/ban thành viên trả phí có hoàn tiền không; xác thực realtime cuối cùng (vé ngắn hạn vs cookie). Tất cả ở `backend/docs/API.md` mục "Quyết định nghiệp vụ CHƯA CHỐT".

---

## Admin console — đợt 1 (backend ✅)

Dashboard, Communities (danh sách/chi tiết/hàng chờ duyệt/đình chỉ/thùng rác 30 ngày), Users (hạn chế/đình chỉ/cấm/khôi phục, chặn đăng nhập + thu hồi phiên), Moderation (hàng đợi case, giao việc, cảnh cáo, gỡ nội dung, đình chỉ/cấm, bỏ qua, leo thang) và Audit log. Mọi hành động admin ghi `AdminAuditLog`. API ở `/api/admin/*` (chỉ Platform Admin) — xem `backend/docs/api/admin.md`; schema/seed ở `backend/docs/DATABASE.md` (migration `admin_batch1`); test ở `backend/tests/admin.test.ts`.
Còn lại cho các đợt sau: Content, Payments, Discovery, Analytics, Support, System (quản lý đội admin/2FA). Cần chốt: có bắt duyệt cộng đồng mới trước khi hiển thị không (câu hỏi #7 — hiện vẫn tạo xong là `active`), chính sách tiền khi xóa/đình chỉ cộng đồng đang có thuê bao, tự gỡ đình chỉ khi hết hạn.

## Nợ kỹ thuật / việc nhỏ đã biết (làm xen kẽ)

- [x] Nút mũi tên trên card trỏ `/courses/:id` → đã có trang chi tiết khóa học thật (xem Phase 1.5)
- [ ] Link nav trên Header đang là `#`; nút tìm kiếm trên Header chưa hoạt động
- [ ] Mục "Câu chuyện từ cộng đồng" đang là dữ liệu tĩnh (`features/home/storiesData.ts`) → làm API/model khi có Community
- [x] Form "Nhận bản tin" ở Footer mới chỉ hiện lời cảm ơn, chưa gửi email đi đâu (làm cùng Phase 7 – email) — ✅ BE `POST /newsletter`; FE Footer chưa gọi
- [ ] Ảnh khóa học đang là file tĩnh trong `frontend/public/images` → chuyển S3 + trả URL đầy đủ
- [ ] Sắp xếp "Đang nổi" đang dùng thứ tự seed, cần số liệu thật
- [ ] Đồng bộ kiểu dữ liệu FE ↔ BE (đề xuất: xuất schema Zod dùng chung hoặc sinh type từ OpenAPI)
- [ ] Thêm lint/format (ESLint + Prettier) và pre-commit
- [x] "Quên mật khẩu?" trên trang Đăng nhập đang là `href="#"`, chưa có luồng khôi phục mật khẩu (làm cùng Phase 7 khi có gửi email) — ✅ BE (`/auth/forgot-password`, `/auth/reset-password`, email vào outbox dev); FE trang đặt lại mật khẩu chưa
- [ ] Đăng nhập Google/Facebook trên trang Đăng nhập/Đăng ký mới chỉ là UI ("Tính năng sắp ra mắt"), chưa nối OAuth thật
- [ ] Xác thực 2 lớp (2FA) chưa có trong roadmap — cần quyết định có làm ở MVP hay không (xem câu hỏi cuối)
- [x] Trang `/faq` (Câu hỏi thường gặp) đã có, nối từ Footer → "Hỗ trợ" → "Câu hỏi thường gặp"
- [ ] Các link còn lại ở Footer (Trung tâm trợ giúp, Liên hệ, Về chúng tôi, Khóa học/Cộng đồng/Sự kiện/Chuyên gia ở cột "Khám phá") vẫn là `href="#"`, chưa có trang riêng

## Câu hỏi cần chốt trước khi làm (ảnh hưởng nhiều phase)

1. Database: PostgreSQL + Prisma như đề xuất, hay dùng thứ khác (MySQL, DynamoDB)?
2. Thanh toán: thị trường mục tiêu là Việt Nam (PayOS/VNPay/MoMo) hay quốc tế (Stripe)?
3. Video khóa học: nhúng YouTube/Vimeo hay tự host?
4. SEO trang công khai có quan trọng không (nếu có nên cân nhắc Next.js sớm, vì đổi framework càng muộn càng tốn)?
5. Trang tiếp theo có file UI (HTML/Figma) chưa? Nếu có thì làm theo UI đó, nếu chưa thì dựng theo phong cách Liquid Glass hiện tại.
6. **Mô hình doanh thu nền tảng** (quan trọng, ảnh hưởng thiết kế Phase 8): SofinHub thu % hoa hồng trên mỗi giao dịch của cộng đồng có phí, hay thu phí sử dụng nền tảng cố định/tháng cho Owner (giữ 100% doanh thu), hay kết hợp cả hai? Tỉ lệ hoa hồng cụ thể là bao nhiêu nếu chọn phương án %?
7. Có yêu cầu duyệt hồ sơ trước khi cho phép một tài khoản tạo cộng đồng mới không, hay để hoàn toàn tự do (đề xuất: tự do như Skool, xử lý vi phạm hậu kiểm bằng kiểm duyệt — ảnh hưởng Phase 2)?
8. Chính sách hủy & hoàn tiền cụ thể: có hoàn tiền sau khi đã thanh toán không, trong trường hợp nào (ảnh hưởng Phase 8)?
9. Payout cho chủ cộng đồng: định kỳ rút tiền bao lâu 1 lần, ngưỡng tối thiểu, hình thức chuyển khoản (ảnh hưởng Phase 8)?
10. Xác thực 2 lớp (2FA) có cần ở MVP không, hay để sau khi có nhiều người dùng hơn?

> Chi tiết đầy đủ về vai trò, mô hình nghiệp vụ và luồng nghiệp vụ xem tài liệu `SofinHub-BRD.docx` ở thư mục gốc dự án.

## Admin console — đợt 2 (backend ✅)
Content (Posts/Comments/Courses/Lessons/Events/Media: danh sách toàn nền tảng, chi tiết, hide/remove/restore, unpublish/archive, hủy/gỡ sự kiện, gắn cờ/gỡ media — có tác động thật lên API công khai), Payments (Transactions: hoàn tiền trực tiếp/retry; Subscriptions: pause/resume/cancel; Refunds: duyệt một phần/từ chối; Chargebacks **mô phỏng** (nộp bằng chứng/accept/thắng/thua, không có cổng thật); Creator Revenue: tổng hợp theo chủ cộng đồng; Payouts: approve/hold/release/failed/retry/paid/reject), Discovery (trạng thái listed/hidden/unlisted, danh mục do admin quản lý, ghim 4 section có thời hạn, trọng số xếp hạng + `sort=ranked`, search visibility). API `/api/admin/{content,payments,discovery}/*` — xem `backend/docs/api/admin-batch2.md`; schema/seed ở `backend/docs/DATABASE.md` (migration `admin_batch2`); test ở `backend/tests/admin-batch2.test.ts`.
Chưa làm / cần chốt: cổng thanh toán thật (chargeback, retry, payout đều đang giả lập), chủ cộng đồng phản hồi hoàn tiền (`creatorResponse` luôn null), ghim bài viết/boost xếp hạng thủ công (mockup không có), export CSV, kiểm duyệt media tự động (hiện chỉ gắn cờ thủ công), các giá trị tạm: hoa hồng, phí cổng, cửa sổ hoàn tiền, ngưỡng rút tối thiểu.

## Admin console — đợt 3 (backend ✅)
Analytics (Users/Communities/Engagement/Retention/Revenue/Conversion với `range=7|30|90` + so sánh kỳ trước, tính từ bảng thật), Support (hệ thống ticket thật: form liên hệ + người dùng + admin tạo, gán, trả lời qua email/dev outbox + thông báo trong app, escalate, resolve/close/reopen, ghi chú nội bộ), System (Admin Accounts + Roles & Permissions với **vai trò nhân viên thật Super Admin/Moderator/Support/Finance + vai trò tuỳ chỉnh, quyền áp cho TOÀN BỘ `/api/admin/*`** qua middleware tập trung; Categories; Feature Flags + `GET /api/feature-flags` công khai (rollout theo %); Integrations (mô phỏng, khóa thật không lưu); Notifications (cài đặt cảnh báo + broadcast hệ thống tới all/creators/paid/community/users); Email Templates (biến `{{x}}`, preview, test-send vào dev outbox, `verify_email`/`reset_password` được dùng thật); Audit (IP, vai trò actor, bộ lọc, export CSV); **Global Settings** — các giá trị nghiệp vụ "tạm" (hoa hồng, phí cổng, cửa sổ hoàn tiền, ngưỡng rút, dùng thử, chu kỳ gói) chỉnh được không cần sửa code, env là mặc định; có chế độ bảo trì thật). API `/api/admin/{analytics,support,system}/*` — xem `backend/docs/api/admin-batch3.md`; schema/seed ở `backend/docs/DATABASE.md` (migration `admin_batch3`); test ở `backend/tests/admin-batch3.test.ts` (**307 test xanh toàn bộ**).
Chưa làm / cần chốt: 2FA thật (chỉ lưu cờ), thực thi `sessionTimeout`/`currency`/`autoPayouts`, job gửi cảnh báo và báo cáo định kỳ cho đội admin, tích hợp thật (Stripe/Mailgun/Slack... đang mô phỏng), backend tự chặn tính năng theo feature flag; các giá trị "tạm" nay chỉnh được ở Global Settings nhưng **vẫn cần chốt con số chính thức** (hoa hồng 10%, hoàn tiền 7 ngày, rút tối thiểu $50, cổng thanh toán, hoàn tiền khi kick, xác thực SSE).
