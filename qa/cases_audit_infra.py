# -*- coding: utf-8 -*-
"""Testcase module INFRA (Hạ tầng vận hành - audit backend 2026-10-01, BƯỚC 5 "lưới an toàn: CI/lint/coverage/DEPLOY.md" + BƯỚC 7 "state chia sẻ ra khỏi RAM", 05/10/2026).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 5.3, 6.3 (thông báo ghi nền), 6.5 (13 kho state trong RAM) + mục 10 bước 5 và 7; DEPLOY.md (mục 1.2-1.7, CI, checklist, sự cố thường gặp);
PLAN.md (Audit STEP 5, STEP 7); backend/docs/{API,CONVENTIONS}.md; backend/docs/api/{messages,notifications,uploads}.md;
.github/workflows/ci.yml, eslint.config.mjs, backend/package.json (scripts), backend/Dockerfile + docker-entrypoint.sh, docker-compose.yml (redis :6380),
backend/src/{index,worker,jobs,lifecycle}.ts, backend/src/infra/{shared-state,shared,leader,scheduler}.ts, backend/src/config/env-guard.ts,
backend/tests/{shared-state,scheduler,lifecycle,notifications-durability}.test.ts.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-INFRA-nnn không đổi).

MÔI TRƯỜNG: Redis local: docker compose up -d redis (cổng 6380) -> REDIS_URL=redis://localhost:6380 trong backend/.env. Hai instance trên 1 máy: mở 2 terminal trong backend/, đặt PORT=4000 và PORT=4001 (cùng DATABASE_URL, cùng REDIS_URL); frontend vẫn :5173 trỏ về :4000.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; Postgres :5435 (npm run db:up). backend :4000 (npm run dev), frontend :5173.")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset; hoặc chỉ dùng tài khoản do chính case tạo ra."
REDIS = "Redis chạy: docker compose up -d redis (cổng 6380); đặt REDIS_URL=redis://localhost:6380 trong backend/.env."
TWO = ("Hai instance: terminal 1 (backend/): $env:PORT=4000; npm run dev; terminal 2: $env:PORT=4001; npm run dev (cùng REDIS_URL nếu case ghi 'có Redis'; BỎ REDIS_URL nếu case ghi 'không Redis'). "
       "Gọi API thẳng tới từng cổng (http://localhost:4000/api, http://localhost:4001/api).")
CI = "Repo đã đẩy lên GitHub có Actions bật; xem tab Actions của workflow 'CI' (file .github/workflows/ci.yml)."


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}}."


def load(add):
    M, MN = "INFRA", "Hạ tầng vận hành (audit bước 5 + 7)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Không", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. CI + CÔNG CỤ (bước 5)
    F = "CI GitHub Actions + lint + coverage (audit bước 5)"
    A(F, "Workflow CI kích hoạt trên mọi push và pull request; hủy lượt cũ khi có push mới", "Tích hợp", "Cao", CI,
      ["Mở .github/workflows/ci.yml: phần 'on' và 'concurrency'", "Đẩy 2 commit liên tiếp lên 1 nhánh (hoặc mở PR rồi push thêm)", "Quan sát tab Actions"], "on: push + pull_request",
      "Mỗi push/PR chạy workflow 'CI' với 2 job: Backend (typecheck, lint, test) và Frontend (typecheck, lint, build). concurrency group 'ci-<ref>' + cancel-in-progress: lượt cũ bị hủy khi có push mới cùng nhánh.", pw="Không")
    A(F, "Job Backend: service container Postgres 16 (cổng 5435) và Redis 7 (cổng 6380) khỏe trước khi chạy bước", "Tích hợp", "Cao", CI,
      ["Mở log job Backend, bước 'Initialize containers'", "Đọc health-cmd của postgres và redis"], "services", "Postgres 16-alpine (user/db sofinhub, 5435->5432) và Redis 7-alpine (6380->6379) có health check (pg_isready / redis-cli ping) và 'healthy' trước khi chạy steps. TEST_DATABASE_URL trỏ sofinhub_test.", pw="Không")
    A(F, "Thứ tự bước backend: npm ci (gốc + backend) -> tạo DB sofinhub_test -> typecheck -> lint -> test -> test Redis -> build", "Tích hợp", "Cao", CI,
      ["Đọc danh sách bước trong log job Backend"], "steps", "Đúng thứ tự: Cài toolchain lint (gốc repo) ; Cài backend ; Tạo DB test (CREATE DATABASE sofinhub_test OWNER sofinhub) ; Typecheck ; Lint ; Test ; 'Test adapter state chia sẻ với Redis thật' ; Build. Node 22, cache npm theo package-lock.", pw="Không")
    A(F, "Bước 'Test adapter state chia sẻ với Redis thật' chạy 4 file test với REDIS_URL=redis://localhost:6380", "Tích hợp", "Cao", CI,
      ["Đọc lệnh trong ci.yml", "Xem log: số test của shared-state.test.ts khi có Redis"], "REDIS_URL",
      "Lệnh: npx cross-env NODE_ENV=test node --import tsx --test tests/shared-state.test.ts tests/messages.test.ts tests/notifications.test.ts tests/uploads.test.ts; log in 'đang chạy cả adapter redis (redis://localhost:6380)' và các describe 'state chia sẻ [redis]' pass.", pw="Không")
    A(F, "Job Frontend: tsc -b, lint, build; CI KHÔNG deploy", "Tích hợp", "Trung bình", CI,
      ["Đọc job frontend trong ci.yml và log", "Tìm bước deploy/publish trong workflow"], "frontend job", "Có npx tsc -b ; npm run lint ; npm run build; không có bước deploy/push image (deploy làm riêng theo DEPLOY.md).", pw="Không")
    A(F, "Typecheck backend + frontend sạch ở máy dev (npm run typecheck ở gốc)", "Chức năng", "Cao", BASE + " Đã npm ci ở gốc, backend, frontend.",
      ["Ở gốc repo: npm run typecheck", "Đọc kết quả hai phần (backend: tsc --noEmit && tsc -p tsconfig.tools.json; frontend: tsc)"], "typecheck", "Thoát mã 0 cả hai; không lỗi TypeScript. (backend typecheck gồm cả tsconfig.tools.json cho script/seed.)", pw="Không")
    A(F, "ESLint flat config dùng chung: npm run lint chạy ở backend và frontend, nợ cũ ở mức warn", "Chức năng", "Cao", BASE + " Đã npm ci ở gốc (typescript-eslint cần TypeScript 5.9 ở gốc).",
      ["Ở gốc: npm run lint", "Đếm số error và warning", "Mở eslint.config.mjs: các rule hạ xuống warn"], "lint",
      "Thoát mã 0 (không có error); có warning cho nợ cũ: no-explicit-any, no-control-regex, no-irregular-whitespace, no-useless-escape, prefer-const, no-unused-vars (bỏ qua tiền tố _), react-hooks/set-state-in-effect, react-hooks/refs. Ignore dist, node_modules, coverage, src/generated, data, public.", pw="Không")
    A(F, "Lint bắt lỗi mới: thêm biến dùng sai/hook sai làm 'error' hoặc warning theo luật", "Chức năng", "Trung bình", BASE,
      ["Thêm tạm vào 1 file backend: var x = 1; (var thay vì const) hoặc 1 lệnh gọi hook có điều kiện ở file .tsx", "Chạy npm run lint", "Hoàn tác"], "lỗi cố ý",
      "Lint báo đúng file/dòng (no-var là error theo js.configs.recommended; react-hooks/rules-of-hooks là error). CI sẽ đỏ nếu có error.", pw="Không")
    A(F, "Script test:coverage sinh báo cáo c8 (text-summary + lcov) cho src, bỏ generated/tests", "Chức năng", "Trung bình", BASE + " Postgres local chạy.",
      ["cd backend", "npm run test:coverage", "Mở backend/coverage/lcov-report/index.html"], "c8",
      "Chạy toàn bộ test với NODE_ENV=test; cuối log có khối Coverage summary (Statements/Branches/Functions/Lines %) cho toàn bộ src (--all); thư mục coverage/ tạo mới và nằm trong backend/.gitignore.", pw="Không")
    A(F, "npm test (backend) toàn bộ xanh trên Postgres thật, mỗi file một schema tạm", "Chức năng", "Cao", BASE,
      ["cd backend", "npm test", "Đọc tổng kết (pass/fail/skipped)"], "node --test tests/*.test.ts", "0 fail, 0 skipped (test Redis được ghi 'bỏ qua adapter redis' khi chưa đặt REDIS_URL - không tính skipped lỗi); tệp mới của đợt audit: security-hardening, money-lifecycle, points-policy, shared-state, scheduler, lifecycle, notifications-durability, perf-sql, query-count, communities-courses, search.", pw="Không")
    A(F, "Phá build có chủ đích: lỗi type -> typecheck đỏ ở CI", "Tích hợp", "Thấp", CI + " Nhánh thử riêng.",
      ["Tạo nhánh, đặt const a: number = 'x' ở 1 file backend, push", "Xem Actions"], "lỗi type", "Job Backend đỏ ở bước Typecheck (các bước sau không chạy); sửa xong push lại thì xanh.", pw="Không")
    A(F, "Phá test có chủ đích: 1 test fail -> bước Test đỏ", "Tích hợp", "Thấp", CI + " Nhánh thử riêng.",
      ["Đổi 1 assert trong tests/search.test.ts thành sai, push", "Xem Actions"], "test fail", "Bước Test đỏ, job Backend fail; CI không build image.", pw="Không")
    A(F, "Lệnh gốc repo: npm run build cài đủ + build cả backend lẫn frontend", "Chức năng", "Thấp", BASE,
      ["Ở gốc: npm run build (chạy install:all rồi build 2 phần)"], "root build", "Thoát 0; backend/dist và frontend/dist được tạo (frontend build = tsc && vite build).", pw="Không")
    A(F, "Cài đặt sạch từ đầu: clone mới + npm ci + db:up + db:reset + dev chạy được", "Chức năng", "Trung bình", "Máy sạch (hoặc thư mục clone mới) có Node 22, Docker.",
      ["git clone, npm run install:all", "npm run db:up, npm run db:reset (migrate + seed)", "npm run dev", "Mở http://localhost:5173 và GET http://localhost:4000/health"], "cài sạch",
      "Mọi bước không lỗi; /health 200 {status:'ok'}; đăng nhập member1@ / Passw0rd!x được. (Postinstall chạy prisma generate.)", pw="Không")

    # ============================================================ 2. DEPLOY.md (bước 5)
    F = "DEPLOY.md chính xác (audit 5.3)"
    A(F, "DEPLOY.md không còn mô tả backend 'tạm' (users.json/RAM): Phần 1 theo kiến trúc Postgres + Prisma", "Chức năng", "Cao", "Mở DEPLOY.md.",
      ["Tìm cụm 'users.json', 'chưa có database', 'Set RAM' trong file", "Đọc đoạn mở đầu và Phần 1"], "DEPLOY.md", "Không còn các cụm trên; Phần 1 hướng dẫn tạo PostgreSQL (Internal/External URL), Web Service Docker, env, migration, kiểm tra /health.", pw="Không")
    A(F, "Bảng env liệt kê đủ: NODE_ENV, DATABASE_URL, 4 secret, CORS_ORIGIN, FRONTEND_URL, PLATFORM_ADMIN_EMAILS, RUN_MIGRATIONS, ENABLE_DEV_OUTBOX", "Chức năng", "Cao", "Mở DEPLOY.md mục 1.2 và backend/src/config/env.ts.",
      ["Đối chiếu từng khóa trong schema zod của env.ts với bảng", "Kiểm tra cột 'Bắt buộc'"], "bảng env",
      "Có đủ DATABASE_URL, PAYMENT_WEBHOOK_SECRET, UPLOAD_SIGNING_SECRET, PLATFORM_ADMIN_EMAILS (4 biến audit nói thiếu) và NODE_ENV/ENABLE_DEV_OUTBOX/RUN_MIGRATIONS; ghi rõ biến nào bắt buộc/không bắt buộc, giá trị tạm của nghiệp vụ.", pw="Không")
    A(F, "Migration: 3 cách (A tự động RUN_MIGRATIONS=1, B release command, C chạy tay) đều ghi rõ và đúng lệnh", "Chức năng", "Cao", "Mở DEPLOY.md mục 1.3 và backend/package.json.",
      ["Đối chiếu 'npm run db:deploy' = prisma migrate deploy", "Đối chiếu docker-entrypoint.sh"], "1.3", "Cách A: docker-entrypoint.sh chạy npx prisma migrate deploy khi RUN_MIGRATIONS=1 rồi mới node dist/index.js; B: Pre-Deploy Command / ECS task riêng; C: set DATABASE_URL External + ?sslmode=require rồi npm run db:deploy. Cảnh báo KHÔNG chạy db:seed trên môi trường có người dùng thật.", pw="Không")
    A(F, "RUN_MIGRATIONS=1: container chạy migrate deploy trước khi start; migration lỗi -> container thoát", "Tích hợp", "Cao", "Docker; image: docker build -t sofinhub-api backend; Postgres trống (DB mới).",
      ["docker run --rm -p 4000:4000 -e RUN_MIGRATIONS=1 -e DATABASE_URL=... (bộ biến production hợp lệ) sofinhub-api", "Đọc log: '[entrypoint] prisma migrate deploy'", "Lặp với DATABASE_URL sai"], "RUN_MIGRATIONS=1",
      "DB trống: log liệt kê các migration được áp dụng (init ... community_course_split) rồi 'API listening on :4000 (production)'; /health 200. DATABASE_URL sai: lệnh migrate thất bại và container thoát mã != 0 (set -e) - bản cũ vẫn chạy ở nền tảng.", pw="Không")
    A(F, "Không có RUN_MIGRATIONS: DB trống -> /health 503? hoặc API lỗi 'relation does not exist' (mô tả đúng trong sự cố thường gặp)", "Tích hợp", "Trung bình", "Docker; Postgres trống; bộ biến production hợp lệ; không đặt RUN_MIGRATIONS.",
      ["Chạy container", "GET /health", "GET /api/courses"], "không migrate", "/health 200 (SELECT 1 thành công) nhưng GET /api/courses 500 'relation \"Course\" does not exist' - khớp dòng sự cố trong DEPLOY.md; sau khi chạy db:deploy thì hết.", pw="Không")
    A(F, "/health: 200 {status:'ok',uptime} khi DB tốt; 503 {status:'db_unavailable'} khi DB chết và log lý do", "Chức năng", "Cao", BASE,
      ["GET http://localhost:4000/health -> 200", "docker stop sofinhub-postgres; GET /health", "Đọc log backend; docker start sofinhub-postgres; GET lại"], "/health",
      "200 {status:'ok', uptime:<giây>}; khi DB dừng: 503 {status:'db_unavailable'} (không lộ chi tiết) và log có '[health] kiểm tra DB thất bại: ...'; bật lại DB -> 200. Docker HEALTHCHECK dùng cùng đường dẫn mỗi 30s.", pw="Có")
    A(F, "/health không kiểm S3/mail/cổng thanh toán (chỉ DB)", "Chức năng", "Thấp", "Đọc DEPLOY.md 1.4.",
      ["Đọc câu cuối mục 1.4", "Tắt/chặn Redis (nếu bật) rồi GET /health"], "health scope", "Vẫn 200 khi Redis/mail/cổng lỗi; chỉ DB ảnh hưởng. (Tài liệu ghi đúng.)", pw="Không")
    A(F, "Sự cố thường gặp: mỗi dòng ứng với một thông báo thật của app (NODE_ENV, secret dev-*, DATABASE_URL, ENABLE_DEV_OUTBOX)", "Chức năng", "Trung bình", "Mở DEPLOY.md mục 'Sự cố thường gặp'; chạy các case SECX về env.",
      ["Với từng dòng trong bảng, tái hiện bằng biến env tương ứng", "So sánh thông báo log với chuỗi trong tài liệu"], "bảng sự cố", "Các chuỗi 'Invalid environment variables ... NODE_ENV', 'Cấu hình production không an toàn: JWT_ACCESS_SECRET đang là giá trị mặc định dev-*', 'DATABASE_URL bắt buộc khi production', 'ENABLE_DEV_OUTBOX không được bật khi production' khớp output thật.", pw="Không")
    A(F, "Checklist sau deploy dùng được từng mục (health, outbox 404, FE gọi BE, đăng ký, F5 còn đăng nhập, cookie Secure)", "Tích hợp", "Cao", "Môi trường đã deploy (Render + Vercel) hoặc docker local + FE local.",
      ["Đi lần lượt 8 ô checklist trong DEPLOY.md"], "checklist", "Tất cả đạt; riêng /api/dev/outbox phải 404 và cookie refresh_token có Secure + SameSite=None.", pw="Không")
    A(F, "Kiểm tra nhanh với image production local (mục 1.6) chạy được theo lệnh trong tài liệu", "Tích hợp", "Trung bình", "Docker; Postgres local :5435.",
      ["Chạy đúng lệnh docker build + docker run ở DEPLOY.md 1.6 (thay secret ngẫu nhiên)", "GET /health và GET /api/courses"], "1.6", "Container lên, health 200, API có dữ liệu sau RUN_MIGRATIONS=1 (+db:seed nếu cần).", pw="Không")
    A(F, "HIỆN TẠI (tài liệu): mở đầu DEPLOY.md vẫn nói 'chạy ĐÚNG 1 instance' và state nằm trong bộ nhớ - lệch với mục 1.7 (Redis)", "Giao diện", "Thấp", "Mở DEPLOY.md đoạn 'Vì sao Backend không deploy lên Vercel' và mục 1.7.",
      ["Đọc dòng 10 và dòng 14", "Đọc mục 1.7 'Nhiều instance, Redis & worker'"], "DEPLOY.md", "HIỆN TẠI: dòng 10/14 còn ghi SSE/vé/rate limit nằm trong bộ nhớ tiến trình và 'chạy đúng 1 instance cho tới khi đưa state ra Redis' trong khi mục 1.7 (cập nhật bước 7) cho phép nhiều instance có Redis. Cần cập nhật đoạn mở đầu cho khớp.", pw="Không", st=PLAN)
    A(F, "HIỆN TẠI (tài liệu): docs/api/content.md mục 'Giới hạn' vẫn ghi 'dữ liệu in-memory, bộ nhắc lịch nhiều instance sẽ nhắc trùng'", "Giao diện", "Thấp", "Mở backend/docs/api/content.md cuối file.",
      ["Đọc mục 'Giới hạn / Chưa làm' dòng đầu", "Đối chiếu PLAN STEP 7 và events.reminders (claimReminders atomic + leader election)"], "content.md", "HIỆN TẠI: dòng đầu mục này lỗi thời (dữ liệu đã ở Postgres; nhắc lịch dùng claim atomic + advisory lock). Ghi nhận cập nhật tài liệu (audit phụ lục đã nêu 'in-memory' ở content.md:57).", pw="Không", st=PLAN)

    # ============================================================ 3. DOCKER / WORKER
    F = "Docker, worker, tách web/worker (audit bước 7)"
    A(F, "Dockerfile: multi-stage, NODE_ENV=production, user node, HEALTHCHECK 30s, CMD entrypoint", "Tích hợp", "Trung bình", "Docker.",
      ["docker build -t sofinhub-api backend", "docker inspect sofinhub-api (Config.User, Healthcheck, Cmd)"], "image", "Stage build (tsc + prisma generate) và stage runtime (npm ci --omit=dev); USER node; HEALTHCHECK --interval=30s wget /health; CMD ./docker-entrypoint.sh; EXPOSE 4000; có openssl.", pw="Không")
    A(F, "RUN_ROLE=worker: container chỉ chạy job nền, KHÔNG mở cổng HTTP", "Tích hợp", "Cao", "Docker; DB đã migrate; bộ biến production hợp lệ.",
      ["docker run -e RUN_ROLE=worker ... sofinhub-api", "Đọc log: '[worker] khởi động (production), state chia sẻ: ...'", "Thử kết nối cổng 4000"], "RUN_ROLE=worker",
      "Log '[worker] khởi động'; không có dòng 'API listening'; không có cổng nghe; process sống (keepAlive) cho tới SIGTERM.", pw="Không")
    A(F, "npm run start:worker (node dist/worker.js) chạy cục bộ không mở HTTP", "Chức năng", "Trung bình", BASE + " Đã npm run build.",
      ["cd backend; npm run dev:worker (hoặc npm run build && npm run start:worker)", "GET http://localhost:4000/health (nếu không có web khác chạy)"], "worker cục bộ", "In '[worker] khởi động (development), state chia sẻ: in-memory (chỉ DB, không realtime tới web)' hoặc 'redis' nếu có REDIS_URL; không listen cổng.", pw="Không")
    A(F, "RUN_SCHEDULERS=0: web-only không chạy job nền (log '[scheduler] tắt trong process này')", "Chức năng", "Cao", BASE + " Đặt RUN_SCHEDULERS=0 trong backend/.env.",
      ["npm run dev", "Đọc log khởi động", "Ép 1 gói đến hạn (xem MONEY) và chờ >5 phút"], "RUN_SCHEDULERS=0", "Log '[scheduler] tắt trong process này (RUN_SCHEDULERS=0, NODE_ENV=development)'; không có job gia hạn/đối soát/nhắc lịch chạy ở process này.", pw="Không")
    A(F, "Web (RUN_SCHEDULERS=0) + worker riêng: job vẫn chạy ở worker, thông báo lưu DB", "Tích hợp", "Cao", BASE + " Terminal 1: RUN_SCHEDULERS=0 npm run dev (web). Terminal 2: npm run dev:worker. " + "Có sự kiện photo sắp diễn ra (< 60 phút) và member đã RSVP.",
      ["Ép 1 gói đến hạn gia hạn (SQL xem MONEY) và chờ job", "Tạo sự kiện cách 30 phút, RSVP, chờ nhắc lịch (<=60s)", "Kiểm tra DB: Payment renewal; Notification event_reminder"], "web + worker", "Job chạy ở worker (log worker); Payment renewal xuất hiện; Notification event_reminder được tạo trong DB. Nếu KHÔNG có Redis: web không đẩy realtime thông báo do worker tạo (user thấy sau khi tải lại).", pw="Không")
    A(F, "docker-compose có service redis (cổng 6380, không persistence) khỏe", "Chức năng", "Thấp", "Docker.",
      ["docker compose up -d redis", "docker compose ps", "redis-cli -p 6380 ping"], "redis service", "Container sofinhub-redis healthy; ping -> PONG; command: redis-server --save '' --appendonly no.", pw="Không")

    # ============================================================ 4. ADAPTER STATE CHIA SẺ (bước 7)
    F = "Adapter state chia sẻ: memory vs Redis (audit 6.5)"
    A(F, "Hợp đồng adapter memory: bộ test shared-state pass (không cần Redis)", "Chức năng", "Cao", BASE,
      ["cd backend", "npx cross-env NODE_ENV=test node --import tsx --test tests/shared-state.test.ts", "Đọc dòng cuối 'bỏ qua adapter redis (không đặt REDIS_URL)'"], "memory",
      "Pass: kv (set/get/del/TTL/setNx/getDel), pubsub, rateLimiter; vé upload (nonce), vé SSE; guard Redis. Adapter redis được bỏ qua và test cuối khẳng định đúng điều đó.", pw="Không")
    A(F, "Hợp đồng adapter Redis: cùng bộ test pass với REDIS_URL (2 'instance' kết nối riêng chung prefix)", "Chức năng", "Cao", BASE + " " + REDIS,
      ["cd backend", "REDIS_URL=redis://localhost:6380 npx cross-env NODE_ENV=test node --import tsx --test tests/shared-state.test.ts", "Đọc kết quả describe 'state chia sẻ [redis]'"], "redis",
      "Pass toàn bộ cả hai backend [memory] và [redis]; log 'đang chạy cả adapter redis (redis://localhost:6380)'. Cùng bộ test = hai adapter có hành vi tương đương.", pw="Không")
    A(F, "kv.setNx: 20 lần đua giữa 2 instance chỉ MỘT thắng; có TTL thì sau đó tạo lại được", "Chức năng", "Cao", BASE + " " + REDIS,
      ["Chạy test 'setNx: chỉ MỘT người thắng khi đua đồng thời giữa 2 instance'"], "setNx race", "Pass: đúng 1 true trong 20; lần sau trong TTL false; sau 200ms (TTL 120ms) true.", pw="Không")
    A(F, "kv.getDel (vé dùng 1 lần): 10 request đua giữa 2 instance chỉ MỘT nhận được giá trị", "Chức năng", "Cao", BASE + " " + REDIS,
      ["Chạy test 'getDel (vé dùng 1 lần)'"], "getDel race", "Pass: đúng ['user-1'] một lần; lần sau null; khóa hết hạn/không tồn tại -> null.", pw="Không")
    A(F, "pub/sub: publish ở A tới subscriber ở B và A; hủy đăng ký thì ngừng nhận; handler lỗi không chặn handler khác", "Chức năng", "Cao", BASE + " " + REDIS,
      ["Chạy 3 test pubsub"], "pubsub", "Pass: 3 handler nhận 'hello'; kênh độc lập; off() ngừng nhận; handler ném lỗi không ảnh hưởng; publish không subscriber không lỗi.", pw="Không")
    A(F, "rateLimiter: hạn mức CHUNG giữa instance và chính xác khi đua (đúng max lượt ok)", "Chức năng", "Cao", BASE + " " + REDIS,
      ["Chạy test 'hạn mức CHUNG giữa 2 instance'"], "30 hit / max 7", "Pass: đúng 7 hit ok trong 30 cuộc gọi song song; retryAfterSec trong [1, cửa sổ]; mở lại sau cửa sổ; khóa khác độc lập.", pw="Không")
    A(F, "Hai instance THẬT, có Redis: vé SSE mint ở :4000 redeem được ở :4001 (đúng 1 lần)", "Tích hợp", "Cao", BASE + " " + REDIS + " " + TWO + " Có Redis. " + tok("member1@sofinhub.test"),
      ["POST http://localhost:4000/api/notifications/stream-ticket (Bearer) -> ticket", "GET http://localhost:4001/api/notifications/stream?ticket=<ticket> (instance KHÁC)", "GET lần 2 ở :4000"], "ticket cross-instance", "Lần 1 (ở :4001): 200 SSE; lần 2 (bất kỳ instance): 401. Không có Redis: lần 1 ở :4001 -> 401 (vé nằm RAM của :4000).", pw="Không")
    A(F, "Hai instance, KHÔNG Redis: vé mint ở A không redeem được ở B (hành vi 1 instance)", "Tích hợp", "Trung bình", BASE + " " + TWO + " KHÔNG đặt REDIS_URL. " + tok("member1@sofinhub.test"),
      ["POST :4000 /notifications/stream-ticket", "GET :4001 /notifications/stream?ticket=..."], "memory 2 instance", "401 (vé chỉ có ở RAM instance cấp). Xác nhận vì sao 'nhiều instance BẮT BUỘC có Redis'.", pw="Không")
    A(F, "Hai instance + Redis: tin nhắn gửi ở A tới người nhận đang cắm SSE ở B (fan-out pub/sub)", "Tích hợp", "Cao", BASE + " " + REDIS + " " + TWO + " Có Redis. member1@ và member2@ (cùng photo).",
      ["member2 mở SSE ở :4001: curl -N Bearer GET /api/messages/stream", "member1 POST /api/conversations/<id>/messages {content:'xin chào'} ở :4000", "Quan sát stream của member2"], "message cross-instance", "member2 nhận event 'message' (MessageView) gần như tức thì. Không có Redis: không nhận (chỉ socket cục bộ).", pw="Không")
    A(F, "Hai instance + Redis: thông báo (notify) ở A tới SSE thông báo ở B; chỉ ghi DB 1 lần", "Tích hợp", "Cao", BASE + " " + REDIS + " " + TWO + " Có Redis.",
      ["member2 mở SSE thông báo ở :4001", "member1 like bài của member2 ở :4000", "Quan sát SSE + SQL đếm Notification"], "notify cross-instance", "member2 nhận event 'notification' ở :4001; bảng Notification chỉ có 1 dòng mới.", pw="Không")
    A(F, "Hai instance + Redis: đổi preference thông báo ở A có hiệu lực ngay ở B (vô hiệu cache)", "Chức năng", "Trung bình", BASE + " " + REDIS + " " + TWO + " Có Redis. member2@.",
      ["Ở :4001: tạo hành động sinh thông báo post_liked cho member2 (đã nạp cache)", "Ở :4000: PUT /api/notifications/preferences {types:{post_liked:false}} (member2)", "Ngay sau đó ở :4001: like tiếp bài khác của member2"], "prefs cross-instance", "Thông báo thứ hai KHÔNG được tạo (cache prefs ở :4001 bị vô hiệu qua kênh notif:prefs, không chờ TTL 5s).", pw="Không")
    A(F, "Rate limit chung giữa 2 instance (Redis): 10 bài/phút tính tổng trên cả hai", "Tích hợp", "Cao", BASE + " " + REDIS + " " + TWO + " Có Redis. User thử đã tham gia photo.",
      ["Đăng 5 bài ở :4000 rồi 5 bài ở :4001 (cùng user), sau đó bài thứ 11 ở một trong hai"], "posts 10/phút", "Bài thứ 11 -> 429 + Retry-After ở cả hai instance (khóa w:posts:<user> dùng chung). Không Redis: mỗi instance đếm riêng (tổng có thể 20).", pw="Không")
    A(F, "Vé upload PUT: nonce SET NX - hai PUT đua nhau cùng vé chỉ một qua, kể cả giữa instance", "Bảo mật", "Cao", BASE + " " + REDIS + " " + TWO + " Có Redis. " + tok("member1@sofinhub.test"),
      ["POST /api/uploads/presign (avatar PNG nhỏ) -> uploadUrl", "Cùng lúc PUT uploadUrl tới :4000 và :4001 (vé giống nhau)", "Đếm kết quả"], "nonce race", "Một PUT 200, một PUT 401 (vé đã dùng). Không Redis: nonce in-memory (mất khi restart nhưng dòng Upload hết 'pending' vẫn chặn phát lại).", pw="Không")
    A(F, "Vé upload: unit consumeTicket chỉ lần đầu thành công kể cả 3 lần gọi song song", "Bảo mật", "Cao", BASE,
      ["Chạy test 'consumeTicket: chỉ lần dùng đầu thành công' trong shared-state.test.ts"], "consumeTicket", "Pass: 1 true / 3 lần; lần sau false; vé hết hạn -> reason 'expired'; vé sai chữ ký -> 'invalid'.", pw="Không")
    A(F, "Redis chết giữa chừng: rate limit FAIL-OPEN, vé/nonce upload từ chối, SSE rơi về giao cục bộ; API vẫn chạy", "Tích hợp", "Cao", BASE + " " + REDIS + " Backend đang chạy với REDIS_URL.",
      ["docker stop sofinhub-redis", "GET /api/courses; đăng bài (rate limit); POST /notifications/stream-ticket; presign + PUT upload", "docker start sofinhub-redis và thử lại"], "Redis down",
      "API không sập: GET /api/courses 200; đăng bài 201 (rate limit cho qua + log '[rate-limit] store lỗi, cho qua (fail-open)'); xin vé stream lỗi (5xx/401) thay vì cấp bừa; PUT upload bị từ chối (fail-closed); sau khi Redis lên lại mọi thứ phục hồi (ioredis tự nối lại).", pw="Không")
    A(F, "REDIS_KEY_PREFIX tách khóa giữa môi trường dùng chung một Redis", "Chức năng", "Thấp", BASE + " " + REDIS,
      ["Chạy backend A với REDIS_KEY_PREFIX=dev1:, backend B với dev2:", "Mint vé ở A rồi redeem ở B (trên cổng khác)", "redis-cli -p 6380 KEYS 'dev*'"], "prefix", "Vé của A KHÔNG dùng được ở B (khác prefix); KEYS thấy khóa dev1:* và dev2:* riêng biệt; mặc định 'sofinhub:'.", pw="Không")
    A(F, "Throttle thông báo tin nhắn + cache preference + rate limit gửi tin nằm ở state chia sẻ (Redis) - kiểm khóa", "Chức năng", "Thấp", BASE + " " + REDIS,
      ["Gửi tin nhắn giữa member1 -> member2", "redis-cli -p 6380 KEYS 'sofinhub:*'"], "khóa Redis", "Có khóa dạng dm:notified:<conversationId>:<userId> (TTL ≈ 5 phút) và khóa rate limit (w:..., g:...); không có dữ liệu bền (Redis chỉ giữ dữ liệu tạm).", pw="Không")
    A(F, "Mail outbox/provider vẫn in-memory (chỉ dev); production = log-only + cảnh báo khởi động", "Chức năng", "Thấp", "Đọc backend/src/modules/mail/mail.service.ts và PLAN STEP 7.",
      ["Khởi động ở production, đọc log cảnh báo mail"], "mail", "Production: provider log-only, có cảnh báo khi khởi động; outbox in-memory chỉ cho dev/test. Chưa nối SES/SMTP (setMailProvider).", pw="Không")
    A(F, "Guard cảnh báo: production nhiều instance mà thiếu REDIS_URL -> cảnh báo (không thoát); web-only không Redis -> cảnh báo", "Chức năng", "Trung bình", "Cài backend.",
      ["Chạy test 'cảnh báo (không thoát) khi nhiều instance mà thiếu REDIS_URL' trong shared-state.test.ts", "Thử thật: NODE_ENV=production + INSTANCE_COUNT=3 (không Redis) và RUN_SCHEDULERS=0"], "productionEnvWarnings", "Pass: 0 cảnh báo (1 instance không Redis); 1 cảnh báo với INSTANCE_COUNT=3 hoặc WEB_CONCURRENCY=2; 0 khi có REDIS_URL; 1 cảnh báo cho RUN_SCHEDULERS=0 không Redis; không cảnh báo khi development; productionEnvProblems vẫn rỗng (không chặn khởi động).", pw="Không")

    # ============================================================ 5. TÍN HIỆU ONLINE CỦA TIN NHẮN (6.5)
    F = "Tin nhắn: bỏ tín hiệu 'online' (push()===0) - luôn lưu thông báo (audit 6.5)"
    CHAT = "member1@ và member2@ cùng thuộc photo (cuộc trò chuyện seed-conv-member1-member2; GET /api/conversations lấy id)."
    A(F, "Người nhận không online: gửi tin -> luôn có Notification message_received (link /messages/<conversationId>)", "Chức năng", "Cao", BASE + " " + CHAT + " " + tok("member1@sofinhub.test"),
      ["member1 POST /api/conversations/<id>/messages {\"content\":\"kiểm tra thông báo\"}", "member2 GET /api/notifications", "GET /api/messages/unread-count của member2"], "người nhận offline",
      "member2 có thông báo type message_received với link /messages/<id>; unread-count tăng 1 (đếm ở DB theo readSeq).", pw="Có")
    A(F, "Người nhận có kết nối SSE mở nhưng KHÔNG xem cuộc trò chuyện: vẫn có Notification (SSE chỉ best-effort)", "Chức năng", "Cao", BASE + " " + CHAT,
      ["member2 mở SSE messages (curl -N) nhưng không gọi GET messages của cuộc trò chuyện", "member1 gửi tin", "GET /api/notifications của member2"], "SSE mở, không xem",
      "Vừa nhận event 'message' qua SSE vừa có Notification trong DB (khác bản cũ: push() > 0 bị coi là online nên KHÔNG tạo thông báo - lỗi 'tin nhắn biến mất khỏi mọi kênh' khi kết nối xác sống).", pw="Một phần")
    A(F, "Kết nối SSE 'xác sống' (client không đọc) không làm mất thông báo", "Chức năng", "Cao", BASE + " " + CHAT,
      ["member2 mở SSE rồi tạm dừng đọc (curl -N ... | rồi Ctrl+Z/ tạm dừng tiến trình) hoặc dùng client không đọc buffer", "member1 gửi 3 tin", "Kiểm tra Notification và unread-count của member2"], "zombie SSE",
      "member2 vẫn có thông báo (gộp tối đa 1/5 phút) và unread-count = số tin; không phụ thuộc kết nối.", pw="Không")
    A(F, "Đang xem cuộc trò chuyện (ack HTTP trong 30 giây): KHÔNG tạo thông báo mới", "Chức năng", "Cao", BASE + " " + CHAT,
      ["member2 GET /api/conversations/<id>/messages (ack)", "Trong 30 giây member1 gửi tin", "GET /api/notifications của member2 (xem số lượng)", "Đợi > 30 giây, member1 gửi tin khác"], "ACTIVE_VIEW_TTL_MS = 30s",
      "Tin gửi trong 30s sau ack: không tạo Notification mới (người nhận đang xem). Sau 30s: tạo thông báo (nếu chưa bị throttle 5 phút). Ack cũng đến từ POST /conversations/<id>/read hoặc chính người nhận gửi tin ở cuộc đó.", pw="Một phần")
    A(F, "Gộp thông báo: tối đa 1 thông báo / cuộc trò chuyện / người nhận / 5 phút", "Chức năng", "Cao", BASE + " " + CHAT,
      ["member1 gửi 5 tin liên tiếp (member2 không xem)", "Đếm Notification message_received của member2 cho cuộc đó"], "throttle 5 phút", "Chỉ 1 Notification (khóa dm:notified:<conv>:<user> SET NX PX 5 phút); unread-count = 5.", pw="Có")
    A(F, "Người nhận đọc cuộc trò chuyện (POST /read) thì khóa gộp bị xóa: tin kế tiếp được báo lại ngay", "Chức năng", "Trung bình", BASE + " " + CHAT,
      ["member1 gửi tin (thông báo #1)", "member2 POST /api/conversations/<id>/read", "Đợi > 30 giây (hết ack); member1 gửi tin mới", "Đếm Notification"], "read xóa throttle", "Có thông báo thứ hai ngay (không phải đợi 5 phút).", pw="Một phần")
    A(F, "Gộp thông báo cũng đúng khi gửi từ 2 instance (Redis SET NX)", "Chức năng", "Trung bình", BASE + " " + REDIS + " " + TWO + " Có Redis.",
      ["member1 gửi tin tới member2 ở :4000 rồi ngay sau đó ở :4001", "Đếm Notification"], "throttle cross-instance", "Chỉ 1 Notification (không Redis: 2 vì mỗi instance giữ throttle riêng).", pw="Không")
    A(F, "Rate limit gửi tin: MESSAGE_RATE_LIMIT_PER_MIN (mặc định 20)/user/phút -> 429; =0 tắt", "Bảo mật", "Trung bình", BASE + " " + CHAT,
      ["member1 gửi 21 tin trong 1 phút", "Đặt MESSAGE_RATE_LIMIT_PER_MIN=0 và restart rồi gửi 25 tin"], "20/phút", "Tin 21: 429; sau khi tắt (0): không giới hạn. NODE_ENV=test mặc định tắt.", pw="Có")
    A(F, "FE: chuông thông báo/badge tin nhắn hiển thị đúng khi người nhận đang ở trang khác", "Giao diện", "Cao", BASE + " " + CHAT + " Hai cửa sổ: member1@ và member2@ (member2 ở /notifications hoặc /search).",
      ["member1 gửi tin cho member2", "Quan sát chuông thông báo và badge tin nhắn của member2", "member2 mở cuộc trò chuyện"], "FE badge", "member2 thấy badge tin nhắn tăng và thông báo 'tin nhắn mới' (realtime qua SSE hoặc F5); mở cuộc trò chuyện -> badge về 0.", pw="Có")
    A(F, "FE: đang mở đúng cuộc trò chuyện: không có thông báo thừa, tin hiện realtime", "Giao diện", "Trung bình", BASE + " " + CHAT + " Hai cửa sổ.",
      ["member2 mở /messages/<id>", "member1 gửi 2 tin", "Xem chuông của member2"], "đang xem", "Tin hiện ngay trong khung chat; chuông KHÔNG tăng (đã ack bằng GET messages/POST read); unread = 0.", pw="Có")

    # ============================================================ 6. SCHEDULER + LEADER ELECTION (6.5)
    F = "Scheduler + leader election bằng Postgres advisory lock (audit 6.5)"
    A(F, "allJobs(): 3 job nền tên duy nhất (events.reminders, payments.reconcile, payments.subscriptions) với chu kỳ 60s/5 phút", "Chức năng", "Cao", BASE,
      ["Đọc backend/src/jobs.ts", "Chạy test 'allJobs() khai báo đủ job nền'"], "jobs", "Đúng 3 tên; payments.subscriptions 5 phút, payments.reconcile 5 phút, events.reminders 60 giây. Pass test.", pw="Không")
    A(F, "withAdvisoryLock: 2 bên đua cùng tên -> đúng 1 chạy; xong thì bên sau chạy được", "Chức năng", "Cao", BASE,
      ["Chạy test 'withAdvisoryLock: 2 bên đua cùng tên'"], "advisory lock", "Pass: runs=1, kết quả [ran:true, ran:false]; lượt sau ran:true (khóa nhả).", pw="Không")
    A(F, "Khóa khác tên không chặn nhau; job ném lỗi vẫn nhả khóa", "Chức năng", "Trung bình", BASE,
      ["Chạy test 'khóa khác tên không chặn nhau; job ném lỗi vẫn nhả khóa'"], "lock lỗi", "Pass: cả hai ran; sau lỗi 'boom' khóa nhả, lượt sau ran.", pw="Không")
    A(F, "2 scheduler tick cùng lúc -> job chạy đúng 1 lần, bên kia 'skipped-not-leader'", "Chức năng", "Cao", BASE,
      ["Chạy test '2 scheduler (2 instance) tick cùng lúc'"], "scheduler 2 instance", "Pass: count=1; outcomes ['ran','skipped-not-leader']; lượt sau instance nào cũng chạy được.", pw="Không")
    A(F, "Chống chồng lượt trong cùng process (skipped-busy); job lỗi -> 'failed' + log, scheduler không chết", "Chức năng", "Trung bình", BASE,
      ["Chạy test 'chống chồng lượt' và 'job lỗi => failed'"], "busy/failed", "Pass: ['ran','skipped-busy']; lỗi -> 'failed' 1 dòng log, lượt kế 'ran'.", pw="Không")
    A(F, "start() chạy theo chu kỳ; stop() chờ lượt đang chạy xong rồi không lên lịch thêm", "Chức năng", "Trung bình", BASE,
      ["Chạy test 'start() chạy theo chu kỳ và stop() chờ lượt đang chạy xong'"], "start/stop", "Pass: started = finished sau stop(); không có lượt mới sau stop().", pw="Không")
    A(F, "2 instance THẬT bật scheduler: mỗi gói chỉ gia hạn 1 lần mỗi kỳ", "Tích hợp", "Cao", BASE + " " + TWO + " " + tok("member1@sofinhub.test") + " Một user mới mua gói 'ai' ($7); SQL ép currentPeriodEnd về quá khứ.",
      ["Chạy 2 instance (RUN_SCHEDULERS mặc định = 1) cùng DB", "Ép gói đến hạn, chờ job (≤5-10 phút)", "SQL: count Payment kind='renewal' của user"], "2 scheduler", "Đúng 1 Payment renewal (advisory lock + FOR UPDATE SKIP LOCKED); log chỉ một instance báo chạy job.", pw="Không")
    A(F, "Instance giữ khóa job chết -> khóa tự nhả (khóa phiên Postgres), instance khác tiếp quản lượt sau", "Tích hợp", "Cao", BASE + " " + TWO,
      ["Hai instance chạy; kill -9 instance đang chạy job (hoặc dừng giữa lượt)", "Chờ lượt kế (≤5 phút)"], "kill leader", "Instance còn lại giành được khóa và chạy job ở lượt kế (không cần can thiệp). Không có job bị kẹt vĩnh viễn.", pw="Không")
    A(F, "Gói free 'ngủ': job không chạy khi không có process nào thức (ghi chú vận hành)", "Chức năng", "Thấp", "Đọc DEPLOY.md 1.7 dòng cuối phần job nền.",
      ["Đọc câu 'Gói free ngủ thì job không chạy'"], "Render free", "Tài liệu nêu rõ cần ít nhất 1 process luôn thức (worker/web trả phí) để gia hạn/nhắc lịch chạy đúng giờ.", pw="Không")
    A(F, "Nhắc lịch sự kiện: người RSVP nhận event_reminder 1 lần khi còn <= 60 phút", "Chức năng", "Cao", BASE + " " + tok("owner@sofinhub.test") + " Scheduler bật (RUN_SCHEDULERS=1).",
      ["owner@ POST /api/courses/photo/events {title:'Nhắc lịch thử', startAt:<now+30 phút>}", "member1 POST /api/events/<id>/rsvp", "Đợi tối đa ~60-120 giây", "GET /api/notifications của member1 (lọc event_reminder)"], "nhắc lịch",
      "member1 có đúng 1 thông báo event_reminder; chu kỳ tiếp theo không gửi lại (claimReminders atomic: remindedAt). Đổi startAt -> dấu nhắc bị xóa và nhắc lại theo giờ mới.", pw="Một phần")

    # ============================================================ 7. TẮT ÊM (6.5)
    F = "Tắt êm - graceful shutdown (audit 6.5)"
    A(F, "SIGTERM với nhiều SSE mở: đóng SSE -> flush -> cleanup theo thứ tự, xong < 2s (không chờ 10s)", "Chức năng", "Cao", BASE,
      ["Chạy test 'SIGTERM với nhiều SSE đang mở' trong tests/lifecycle.test.ts"], "gracefulShutdown", "Pass: order = ['streams','flush','cleanup']; took < 2000ms; request chậm đang bay vẫn được trả lời; mọi luồng SSE bị server đóng; server.listening=false; connectionCount()=0.", pw="Không")
    A(F, "Một bước kẹt bị bỏ qua sau stepTimeoutMs, các bước sau vẫn chạy", "Chức năng", "Trung bình", BASE,
      ["Chạy test 'một bước kẹt bị bỏ qua sau stepTimeoutMs'"], "stopWork treo", "Pass: order ['flush','cleanup']; tổng < 1.5s. (Thực tế mỗi bước tối đa 5s; watchdog 30s là lưới an toàn cuối.)", pw="Không")
    A(F, "Dừng backend thật bằng Ctrl+C/SIGTERM khi có SSE mở: thoát nhanh (< ~2s), log đóng, không treo 10s", "Chức năng", "Cao", BASE + " Chạy bản build để tín hiệu tới đúng process Node (không qua tsx watch): cd backend; npm run build; $env:NODE_ENV='development'; npm start. " + tok("member1@sofinhub.test"),
      ["Mở 2 SSE (notifications + messages) bằng curl -N", "Trong terminal backend bấm Ctrl+C (hoặc docker stop với image)", "Đo thời gian thoát và mã thoát"], "SIGINT/SIGTERM", "Log 'SIGINT received, shutting down' (hoặc SIGTERM) rồi thoát trong ~1-2 giây (không đợi 10s hard-kill), mã 0; curl nhận kết thúc luồng; log không báo lỗi Prisma/Redis 'connection closed'. Thứ tự: dừng scheduler -> đóng SSE -> server.close + chờ request -> flush thông báo -> đóng Prisma/Redis.", pw="Không")
    A(F, "docker stop: container dừng nhanh (không đạt giới hạn 10 giây SIGKILL)", "Tích hợp", "Trung bình", "Image production chạy với SSE mở.",
      ["time docker stop <container>", "docker inspect --format '{{.State.ExitCode}}' <container>"], "docker stop", "Thời gian < ~3 giây, ExitCode 0 (trước đây luôn rơi vào process.exit(1) sau 10s).", pw="Không")
    A(F, "Flush thông báo nền trước khi thoát: thông báo vừa tạo không mất khi deploy", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["member1 like bài của member2 (tạo thông báo), NGAY SAU ĐÓ Ctrl+C backend", "Khởi động lại; GET /api/notifications của member2"], "flush", "Thông báo post_liked có mặt (flushNotifications chạy trước khi đóng Prisma). Trường hợp process bị SIGKILL giữa chừng thì có thể mất (chấp nhận - notifications.md).", pw="Không")
    A(F, "streamHub.closeAll() và closeNotificationStreams(): EventSource ở FE tự nối lại sau khi server khởi động lại", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở FE, chuông thông báo hoạt động", "Dừng backend rồi chạy lại", "Gây thông báo mới (member2 like bài của member1)"], "reconnect", "FE tự nối lại bằng vé mới (retry 5000ms) và nhận thông báo realtime; không cần F5.", pw="Một phần")
    A(F, "Scheduler dừng trước (stopWork) - không còn lượt mới trong khi tắt; worker tắt êm", "Chức năng", "Trung bình", BASE + " Worker chạy (npm run dev:worker).",
      ["Ctrl+C worker lúc job đang chạy (job tick đang giữ advisory lock)", "Đọc log"], "worker shutdown", "scheduler.stop() chờ lượt đang chạy xong rồi flush thông báo, clearInterval keepAlive, đóng Prisma + Redis; thoát mã 0.", pw="Không")

    # ============================================================ 8. ĐỘ BỀN THÔNG BÁO (6.3)
    F = "Thông báo bền: retry, thư chết, nhả cờ chống trùng, không thông báo ma (audit 6.3)"
    A(F, "Lỗi ghi tạm thời được retry (backoff) và cuối cùng ghi được - không mất thông báo", "Chức năng", "Cao", BASE,
      ["Chạy test 'lỗi tạm thời được retry và cuối cùng ghi được'"], "failFirst=2", "Pass: rows=1, addCalls=3, deadLetters=0.", pw="Không")
    A(F, "Thất bại hẳn: không nuốt im lặng - vào thư chết (deadLetters) + gọi onWriteFailed", "Chức năng", "Cao", BASE,
      ["Chạy test 'thất bại hẳn: không nuốt im lặng'"], "failFirst=99", "Pass: onWriteFailed nhận id thông báo; deadLetters().length=1; không có hàng trong repo; lỗi được log (console.error).", pw="Không")
    A(F, "Không có thông báo ma: SSE chỉ phát SAU khi hàng đã commit; ghi hỏng thì không phát", "Chức năng", "Cao", BASE,
      ["Chạy test 'KHÔNG có thông báo ma'"], "onNew listener", "Pass: trước flush chưa phát; sau flush phát và hàng đã trong DB; repo hỏng -> emitted=0. Hết cảnh SSE đã hiện kèm id nhưng đánh dấu đã đọc 404 và F5 biến mất.", pw="Không")
    A(F, "Thông báo bị tắt theo preference thì không ghi, không phát; loại bắt buộc luôn gửi", "Chức năng", "Trung bình", BASE + " " + tok("member3@sofinhub.test") + " member3 seed đã tắt post_liked & member_joined.",
      ["Test 'thông báo bị tắt theo preference' ; thực tế: member2 like bài của member3", "GET /api/notifications của member3", "Gây thông báo bắt buộc (vd. gỡ cấm/đổi vai trò) cho member3"], "preferences", "Không có post_liked cho member3 (không ghi, không SSE); thông báo MANDATORY (payment_succeeded, payment_failed, role_changed, removed_from_community, report_resolved) vẫn gửi dù có tắt.", pw="Một phần")
    A(F, "Nhắc lịch: ghi thông báo hỏng hẳn -> cờ remindedAt được nhả; lượt sau nhắc lại đúng 1 lần (DB thật)", "Chức năng", "Cao", BASE,
      ["Chạy test 'nhắc lịch: ghi thông báo hỏng hẳn => cờ remindedAt được nhả'"], "repo.add hỏng", "Pass: remindedAt=null và 0 thông báo khi hỏng; sau khi sửa: 1 thông báo; chạy thêm lần nữa vẫn 1.", pw="Không")
    A(F, "Like: ghi thông báo hỏng hẳn -> PostLikeNotice được nhả, like lại thì tác giả vẫn được báo", "Chức năng", "Cao", BASE,
      ["Chạy test 'like: ghi thông báo hỏng hẳn => PostLikeNotice được nhả'"], "repo.add hỏng", "Pass: sau hỏng PostLikeNotice=0, post_liked=0; unlike+like lại -> post_liked=1.", pw="Không")
    A(F, "Thông báo từ worker: lưu DB nhưng chỉ đẩy realtime tới web khi có Redis (ghi chú vận hành)", "Tích hợp", "Trung bình", BASE + " " + REDIS + " Web (RUN_SCHEDULERS=0) + worker như nhóm Docker.",
      ["Có Redis: worker tạo event_reminder -> kiểm tra SSE của người nhận ở web", "Bỏ Redis: lặp lại"], "worker + redis", "Có Redis: người nhận thấy thông báo realtime ở web; không Redis: chỉ thấy sau khi tải lại (lưu DB vẫn đủ).", pw="Không")
    A(F, "Giới hạn đã biết: lastTs của thông báo theo process (thứ tự chỉ xấp xỉ giữa instance) và 7 sự kiện chưa có thông báo (@mention, đổi giờ sự kiện, ...)", "Chức năng", "Thấp", "Đọc PLAN.md Audit STEP 7 mục 'Còn lại'.",
      ["Đọc dòng 'Còn lại'"], "PLAN", "HIỆN TẠI: còn lại: rate limit express-rate-limit ở auth.routes vẫn theo instance; lastTs theo process; đủ 7 sự kiện thiếu thông báo (một phần đã làm: ẩn nội dung, cấm qua kiểm duyệt - xem GAME); fan-out sự kiện đã bỏ cắt 200 (xem PERF).", pw="Không", st=PLAN)

    # ============================================================ 9. BỔ SUNG: MIGRATION, SEED, KHỞI ĐỘNG
    F = "Migration, seed, khởi động"
    A(F, "Áp migration trên DB trống: db:deploy chạy đủ 10 migration không lỗi", "Chức năng", "Cao", "Postgres trống (docker compose down -v; npm run db:up).",
      ["cd backend; npm run db:deploy", "Đọc danh sách migration được áp"], "migrate deploy", "Áp theo thứ tự: 20260930085619_init ... 20261004100000_money_lifecycle_points, 20261005100000_search_fulltext, 20261005100100_fk_indexes, 20261006100000_community_course_split; không lỗi; /health 200.", pw="Không")
    A(F, "Schema không drift: prisma migrate diff báo 'No difference detected'", "Chức năng", "Trung bình", "DB đã áp migration.",
      ["npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code (hoặc lệnh tương đương theo prisma.config.ts)"], "drift", "Không có chênh lệch (lưu ý ghi chú search.md: cột generated có thể sinh lệch DROP DEFAULT cần loại bỏ).", pw="Không")
    A(F, "db:seed idempotent: chạy lại nhiều lần không nhân đôi dữ liệu", "Chức năng", "Trung bình", BASE + " " + MUTATE,
      ["Ghi số dòng các bảng chính (User, Course, LearningCourse, Post, Payment)", "npm run db:seed 2 lần", "So lại số dòng"], "seed x3", "Số dòng không đổi (seed chỉ tạo, update:{} / skipDuplicates); khóa học thêm và chứng nhận cố định không nhân đôi.", pw="Không")
    A(F, "Khởi động backend dev: log 'API listening on :4000 (development)'; scheduler bật; cấu hình Global Settings nạp", "Chức năng", "Thấp", BASE,
      ["npm run dev; đọc log khởi động"], "log", "Có 'API listening on :4000 (development)'; không có '[scheduler] tắt'; nếu nạp cấu hình lỗi: '[settings] không nạp được cấu hình' (dùng mặc định env).", pw="Không")
    A(F, "docker-compose Postgres có DB sofinhub_test cho test (init script)", "Chức năng", "Thấp", "Volume Postgres mới.",
      ["docker compose up -d --wait", "docker exec sofinhub-postgres psql -U sofinhub -c \"\\l\""], "init DB", "Có cả sofinhub và sofinhub_test (docker/postgres-init); test dùng schema tạm ngẫu nhiên trong sofinhub_test.", pw="Không")
    A(F, "Tắt Redis khi backend không cấu hình REDIS_URL: không có kết nối Redis và log 'in-memory'", "Chức năng", "Thấp", BASE,
      ["Bỏ REDIS_URL, npm run dev", "Quan sát log và kết nối cổng 6380"], "không Redis", "Không kết nối tới Redis; worker (nếu chạy) in 'state chia sẻ: in-memory (chỉ DB, không realtime tới web)'.", pw="Không")
    A(F, "Coverage: các module mới của đợt audit (infra, config, lifecycle) có phủ test", "Hiệu năng", "Thấp", BASE + " Đã chạy npm run test:coverage.",
      ["Mở backend/coverage/lcov-report", "Xem phần trăm của src/infra, src/config, src/lifecycle.ts, src/jobs.ts, modules/search, modules/payments"], "coverage", "Các file hạ tầng mới có phần trăm dòng/hàm đáng kể (đo bằng c8, --all); ghi nhận phần chưa phủ (vd worker.ts, index.ts là entrypoint).", pw="Không")

    # @@END@@
