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
- [ ] Docker Compose Postgres local + Prisma schema: `User`, `Session/RefreshToken` (đang dùng file JSON `backend/data/users.json` tạm thời — xem "Câu hỏi cần chốt")
- [ ] Chuyển `CourseRepository` từ seed sang Prisma (giữ nguyên interface, seed bằng `prisma db seed`)
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
- [ ] Model `Enrollment` thật khi có DB (hiện lưu Set trong bộ nhớ, xem `modules/enrollments/enrollments.repository.ts`)
- [ ] Đánh giá học viên hiện là dữ liệu minh họa dùng chung cho mọi khóa học — cần model `Review` thật khi làm Phase 3

## Phase 2 — Cộng đồng (Community) (Ngày 3–4)

- [ ] Model `Community` (tên, slug, mô tả, ảnh bìa, giá, riêng tư/công khai), `Membership` (role: owner/admin/mod/member)
- [ ] API: tạo / sửa / xem cộng đồng, tham gia / rời, danh sách thành viên
- [ ] FE: luồng "Tạo cộng đồng" (wizard ngắn), trang Khám phá thay cho trang khóa học hiện tại (dùng lại lưới card + filter)
- [ ] Layout trang cộng đồng `/c/:slug` với tab: Cộng đồng · Khóa học · Lịch · Thành viên · Giới thiệu
- [ ] Phân quyền theo role ở BE (policy tập trung)
- [ ] Vai trò trong 1 cộng đồng (theo tài liệu `SofinHub-BRD.docx` mục 2):
  - **Khách** (chưa đăng nhập): chỉ xem tên/mô tả/giá cộng đồng công khai, không xem nội dung bên trong
  - **Member**: tham gia được (theo luồng bên dưới), học, đăng bài, bình luận
  - **Owner** (người bấm "Tạo cộng đồng"): toàn quyền — tạo/sửa khóa học, đặt giá, mời Admin/Mod, xem doanh thu
  - **Admin/Mod**: được Owner cấp quyền, tạo/sửa nội dung + kiểm duyệt; **mặc định KHÔNG** xem doanh thu/đổi giá trừ khi Owner cấp thêm
  - **Platform Admin** (đội SofinHub, không tự đăng ký): có quyền ghi đè quyết định của Owner để xử lý vi phạm (khoá/gỡ cộng đồng) — xem thêm Phase 9
- [ ] 3 luồng tham gia cộng đồng cần cài đủ (không gộp chung "tham gia" như hiện tại ở khóa học đơn lẻ):
  1. Công khai + miễn phí → bấm "Tham gia" vào ngay
  2. Công khai + có phí → phải thanh toán/dùng thử trước (phụ thuộc Phase 8); có thể cho xem trước 1 phần nội dung
  3. Riêng tư → gửi yêu cầu tham gia, chờ Owner/Admin duyệt, hoặc vào bằng link mời

**DoD**: tạo cộng đồng, người khác tham gia được, chủ cộng đồng thấy công cụ quản trị

## Phase 3 — Bảng tin (Feed / Posts) (Ngày 5–7)

- [ ] Model `Post`, `Comment`, `Like`, `PostCategory`; ghim bài
- [ ] API CRUD bài viết + bình luận lồng 1 cấp, like/unlike, phân trang cursor
- [ ] Upload ảnh/file: presigned URL S3 (local dùng MinIO hoặc thư mục tạm)
- [ ] FE: composer (soạn bài), feed vô hạn (`useInfiniteQuery`), card bài viết, bình luận, like optimistic
- [ ] Soạn thảo rich text nhẹ (đề xuất: TipTap) + embed link/video

**DoD**: đăng bài có ảnh, bình luận, like, ghim; feed cuộn mượt

## Phase 4 — Lớp học (Classroom) (Ngày 8–10)

- [ ] Model `Course` (thuộc cộng đồng) → `Module` → `Lesson` (video/văn bản/tệp), `Progress`
- [ ] API quản lý nội dung (owner/admin) + API học viên xem, đánh dấu hoàn thành
- [ ] Khóa bài theo cấp độ / theo gói (kiểm tra ở BE, không tin FE)
- [ ] FE: trang danh sách khóa, trang học (sidebar bài học + player + tiến độ %), trình soạn khóa cho admin
- [ ] Video: đề xuất nhúng YouTube/Vimeo trước, tự host (S3 + CloudFront / MediaConvert) để sau
- [ ] Chứng nhận hoàn thành khóa học (certificate) khi đạt 100% tiến độ — tuỳ chọn bật/tắt theo từng cộng đồng (đề xuất, chưa xác nhận)

**DoD**: tạo khóa → học viên học và thấy % tiến độ

## Phase 5 — Thành viên, Hồ sơ, Xếp hạng (Ngày 11)

- [ ] Trang hồ sơ cá nhân (ảnh, bio, cộng đồng đã tham gia, hoạt động)
- [ ] Hệ thống điểm: +điểm khi đăng bài / nhận like / hoàn thành bài; cấp độ
- [ ] Bảng xếp hạng (7 ngày / 30 ngày / mọi thời điểm)
- [ ] Trang danh sách thành viên có tìm kiếm + lọc role

## Phase 6 — Lịch & Sự kiện (Ngày 12)

- [ ] Model `Event` (thời gian, múi giờ, link họp, giới hạn), RSVP
- [ ] FE: lịch tháng/danh sách, chi tiết sự kiện, thêm vào Google Calendar (file .ics)
- [ ] Nhắc lịch (email/thông báo)

## Phase 7 — Thông báo & Chat (Ngày 13–14)

- [ ] Model `Notification`; API đọc/đánh dấu đã đọc; chuông thông báo trên Header
- [ ] Kênh realtime (đề xuất SSE cho thông báo, WebSocket cho chat)
- [ ] Tin nhắn trực tiếp 1-1: model `Conversation`/`Message`, giao diện chat
- [ ] Email giao dịch (đề xuất AWS SES)

## Phase 8 — Thanh toán & Gói thành viên (Ngày 15–16)

- [ ] Chốt cổng thanh toán (Stripe / PayOS / VNPay — xem câu hỏi cuối)
- [ ] Chốt mô hình doanh thu nền tảng trước khi thiết kế schema (xem câu hỏi cuối) — quyết định % hoa hồng hay phí cố định ảnh hưởng trực tiếp bảng `Transaction`/`Payout`
- [ ] Gói theo tháng cho cộng đồng có phí ("$x/tháng" đã có trên UI), dùng thử miễn phí
- [ ] Webhook xử lý thanh toán (idempotent), trạng thái `Subscription`, gia hạn/hủy
- [ ] Chính sách hủy & hoàn tiền cụ thể (đề xuất: hoàn 100% trong thời gian dùng thử; không hoàn sau khi đã thu phí trừ trường hợp Platform Admin duyệt đặc biệt — cần xác nhận)
- [ ] Trang thanh toán + quản lý gói của tôi
- [ ] Trang "Doanh thu của tôi" cho Owner: số dư, lịch sử giao dịch, lịch rút tiền tiếp theo
- [ ] Payout cho Owner: định kỳ (đề xuất hàng tháng), có ngưỡng rút tối thiểu, trừ hoa hồng nền tảng + phí cổng thanh toán trước khi chuyển khoản

## Phase 9 — Quản trị, Tìm kiếm, i18n, SEO (Ngày 17–18)

- [ ] Công cụ kiểm duyệt: báo cáo bài, ẩn/xóa, cấm thành viên — 2 cấp: Owner/Admin kiểm duyệt trong cộng đồng của mình, Platform Admin có quyền ghi đè để xử lý vi phạm toàn nền tảng (khoá/gỡ cộng đồng)
- [ ] Tìm kiếm toàn cục (đề xuất Postgres full-text trước; OpenSearch khi cần)
- [ ] i18n VI/EN (nút "VI" trên Header hiện chỉ là hình) — `react-i18next`
- [ ] SEO: meta/OG theo trang, sitemap, SSR/prerender trang công khai nếu cần (cân nhắc chuyển Next.js)
- [ ] Trang "Xem tất cả", 404/500 hoàn chỉnh, empty states

## Phase 10 — Chất lượng & Lên AWS (Ngày 19–21)

- [ ] Test: unit (Vitest) cho service quan trọng, integration API (Supertest), e2e golden path (Playwright)
- [ ] CI GitHub Actions: typecheck + test + build
- [ ] Dựng hạ tầng bằng skill `aws-provision` (ECR, ECS/EC2, RDS Postgres, S3, CloudFront, Route 53, ACM)
- [ ] CD: push `main` → build image → deploy; migrate DB an toàn
- [ ] Giám sát: CloudWatch logs/alarms, health check ALB, Sentry (đề xuất)
- [ ] Bảo mật: rà soát CORS, rate limit, validate input, secrets trong SSM/Secrets Manager
- [ ] Sao lưu RDS + kế hoạch rollback

---

## Nợ kỹ thuật / việc nhỏ đã biết (làm xen kẽ)

- [x] Nút mũi tên trên card trỏ `/courses/:id` → đã có trang chi tiết khóa học thật (xem Phase 1.5)
- [ ] Link nav trên Header đang là `#`; nút tìm kiếm trên Header chưa hoạt động
- [ ] Mục "Câu chuyện từ cộng đồng" đang là dữ liệu tĩnh (`features/home/storiesData.ts`) → làm API/model khi có Community
- [ ] Form "Nhận bản tin" ở Footer mới chỉ hiện lời cảm ơn, chưa gửi email đi đâu (làm cùng Phase 7 – email)
- [ ] Ảnh khóa học đang là file tĩnh trong `frontend/public/images` → chuyển S3 + trả URL đầy đủ
- [ ] Sắp xếp "Đang nổi" đang dùng thứ tự seed, cần số liệu thật
- [ ] Đồng bộ kiểu dữ liệu FE ↔ BE (đề xuất: xuất schema Zod dùng chung hoặc sinh type từ OpenAPI)
- [ ] Thêm lint/format (ESLint + Prettier) và pre-commit
- [ ] "Quên mật khẩu?" trên trang Đăng nhập đang là `href="#"`, chưa có luồng khôi phục mật khẩu (làm cùng Phase 7 khi có gửi email)
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
