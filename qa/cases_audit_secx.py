# -*- coding: utf-8 -*-
"""Testcase module SECX (Bảo mật hardening - audit backend 2026-10-01, BƯỚC 1: "bịt 4 đường vào không cần mật khẩu", 04/10/2026).
Nguồn sự thật: AUDIT-BACKEND-2026-10-01.md mục 4.1-4.4 + backend/docs/api/{uploads,notifications,identity,messages}.md, backend/docs/API.md (mục "Biến môi trường mới"),
DEPLOY.md (mục 1.2 bảng env, 1.4 /health, checklist), backend/src/config/{env,env-guard}.ts, middlewares/{error-handler,request-logger}.ts, modules/uploads/*,
modules/notifications/*, modules/messages/*, frontend/src/lib/files.ts + ChatPanel/LessonPage/ContentViews (xem file qua URL ký), backend/tests/security-hardening.test.ts.
Thêm case mới = thêm `A(...)` CUỐI file (giữ thứ tự để mã TC-SECX-nnn không đổi).

Cách tạo file thử (dùng cho mọi case /files): POST /api/uploads/presign {filename, contentType, size, purpose[, courseId]} (Bearer) -> PUT <uploadUrl> với header Content-Type đúng và body là file có magic bytes hợp lệ
(PNG thật cho ảnh, '%PDF-1.4 ...' cho pdf) -> dùng fileUrl dạng /api/files/<key 32 hex>.<đuôi>.
"""
DONE = "Đã hoàn thiện"
PLAN = "Kế hoạch"

PW = "Passw0rd!x"
BASE = ("DB dev đã nạp seed (npm run db:reset); mật khẩu mọi tài khoản seed Passw0rd!x; backend :4000 chạy bằng npm run dev (NODE_ENV=development, ENABLE_DEV_OUTBOX=1 theo backend/.env.example), "
        "frontend :5173; xem sheet 'Tài khoản & dữ liệu test'.")
MUTATE = "Case làm thay đổi dữ liệu (MUTATE) - khôi phục bằng npm run db:reset, hoặc chỉ dùng tài khoản/file do chính case tạo ra."
NOENV = ("Chạy từ thư mục backend, KHÔNG kế thừa .env của máy dev: đặt DOTENV_CONFIG_PATH trỏ tới file không tồn tại (PowerShell: $env:DOTENV_CONFIG_PATH='khong-co.env'); "
         "xóa các biến NODE_ENV/ENABLE_DEV_OUTBOX/*_SECRET khỏi phiên shell trước khi thử (Remove-Item Env:NODE_ENV).")
PROD_OK = ("Bộ biến production hợp lệ dùng cho các case env: NODE_ENV=production, DATABASE_URL=postgresql://u:p@db.example.com:5432/sofinhub, JWT_ACCESS_SECRET=<48 ký tự a>, "
           "JWT_REFRESH_SECRET=<48 ký tự b>, PAYMENT_WEBHOOK_SECRET=<48 ký tự c>, UPLOAD_SIGNING_SECRET=<48 ký tự d> (không có tiền tố dev-).")
UPL = ("Tạo file thử: POST /api/uploads/presign {filename,contentType,size,purpose[,courseId]} (Bearer) -> PUT <uploadUrl> (header Content-Type đúng, body PNG/PDF thật) -> fileUrl = /api/files/<key>. "
       "Người ngoài = tài khoản MỚI đăng ký bằng POST /api/auth/register (chưa tham gia cộng đồng nào).")
CHAT = ("member1@ và member2@ cùng là thành viên photo nên có cuộc trò chuyện seed seed-conv-member1-member2; lấy conversationId bằng GET /api/conversations. "
        "Gửi tin kèm file: POST /api/conversations/<id>/messages {content, attachments:[{url:<fileUrl>,name,contentType,size}]} (file phải của CHÍNH người gửi, purpose message_attachment).")


def tok(email):
    return f"Lấy token: POST /api/auth/login {{\"email\":\"{email}\",\"password\":\"{PW}\"}} -> accessToken, gửi header Authorization: Bearer <token>."


def load(add):
    M, MN = "SECX", "Bảo mật hardening (audit bước 1)"

    def A(feature, title, ttype, prio, pre, steps, data, exp, pw="Có", st=DONE):
        add(M, MN, feature, title, ttype, prio, st, pre, steps, data, exp, pw=pw)

    # ============================================================ 1. NODE_ENV BẮT BUỘC
    F = "NODE_ENV bắt buộc (audit 4.1)"
    A(F, "Thiếu NODE_ENV: app từ chối khởi động, không rơi về development", "Bảo mật", "Cao", NOENV,
      ["cd backend", "Chạy: npx tsx src/index.ts (không đặt NODE_ENV)", "Đọc console và mã thoát (echo $LASTEXITCODE / echo $?)"], "NODE_ENV = (không đặt)",
      "Process thoát ngay với mã != 0; stderr có 'Invalid environment variables' và 'NODE_ENV bắt buộc là development | test | production (không có giá trị mặc định)'. Không có dòng 'API listening'. Cổng 4000 không được mở.", pw="Không")
    A(F, "NODE_ENV rỗng hoặc sai giá trị (staging, prod, Production) bị từ chối", "Bảo mật", "Cao", NOENV,
      ["Chạy lần lượt (mỗi lần 1 giá trị): NODE_ENV=staging; NODE_ENV=prod; NODE_ENV=Production; NODE_ENV= (chuỗi rỗng)  rồi npx tsx src/index.ts",
       "Ghi mã thoát + thông báo lỗi từng lần"], "staging | prod | Production | ''",
      "Cả 4 lần thoát mã != 0 với thông báo NODE_ENV bắt buộc là development | test | production. Enum phân biệt hoa thường nên 'Production' cũng bị từ chối.", pw="Không")
    A(F, "NODE_ENV=development và NODE_ENV=test nạp cấu hình thành công", "Chức năng", "Cao", NOENV + " Có Postgres local chạy (npm run db:up).",
      ["Chạy: node --import tsx --input-type=module -e \"await import('./src/config/env.ts'); console.log('LOADED')\" với NODE_ENV=development",
       "Lặp lại với NODE_ENV=test"], "development / test",
      "Cả hai in 'LOADED' và thoát mã 0; không có cảnh báo/lỗi. (Production cần đủ secret - xem nhóm 'Guard secret production'.)", pw="Không")
    A(F, "Bộ biến production hợp lệ nạp thành công (không exit)", "Chức năng", "Cao", NOENV + " " + PROD_OK,
      ["Đặt đủ biến production hợp lệ như tiền điều kiện (KHÔNG đặt ENABLE_DEV_OUTBOX)", "Chạy lệnh nạp env.ts như case trước"], "NODE_ENV=production + 4 secret ngẫu nhiên + DATABASE_URL",
      "In 'LOADED', mã thoát 0. Với INSTANCE_COUNT/WEB_CONCURRENCY không đặt thì không có cảnh báo Redis.", pw="Không")
    A(F, "Script npm dev/test/db:* đã đặt sẵn NODE_ENV bằng cross-env (dev không cần tự khai)", "Chức năng", "Trung bình", BASE,
      ["Mở backend/package.json mục scripts", "Chạy npm run dev rồi đọc dòng đầu console", "Chạy npm run db:seed (idempotent) và npm test -- --test-name-pattern=\"NODE_ENV\" nếu muốn"], "scripts dev/test/db:seed/db:reset/dev:worker",
      "dev, dev:worker, db:seed, db:import-users, db:reset dùng cross-env NODE_ENV=development; test/test:coverage dùng NODE_ENV=test. Console dev in 'API listening on :4000 (development)'. start/start:worker KHÔNG đặt NODE_ENV (production phải tự khai).", pw="Không")
    A(F, "Image Docker đặt sẵn NODE_ENV=production", "Tích hợp", "Trung bình", "Docker đã cài; build image: docker build -t sofinhub-api backend.",
      ["docker run --rm --entrypoint printenv sofinhub-api NODE_ENV", "Đọc Dockerfile dòng ENV"], "image sofinhub-api",
      "In 'production'. Dockerfile có comment 'NODE_ENV là BẮT BUỘC (app từ chối khởi động nếu thiếu); image này luôn là production'.", pw="Không")
    A(F, "Sự cố DEPLOY.md 'NODE_ENV trên Render chưa phải production' nay được chặn thay vì chạy như dev", "Bảo mật", "Cao", "Giả lập Render: chạy container không đặt NODE_ENV (docker run --rm --entrypoint node -e DATABASE_URL=... sofinhub-api dist/index.js).",
      ["Chạy container không có NODE_ENV (ghi đè ENV của image bằng -e NODE_ENV=)", "Đọc log container", "So sánh với DEPLOY.md mục 'Sự cố thường gặp' dòng đầu"], "NODE_ENV rỗng",
      "Container thoát với log 'Invalid environment variables ... NODE_ENV'; KHÔNG mount /api/dev/outbox, không chấp nhận secret dev-*. Khớp bảng sự cố trong DEPLOY.md.", pw="Không")
    A(F, "backend/.env.example khai báo NODE_ENV và ghi rõ ENABLE_DEV_OUTBOX chỉ cho dev", "Giao diện", "Thấp", "Mở backend/.env.example.",
      ["Đọc dòng đầu file", "Đọc comment cạnh ENABLE_DEV_OUTBOX"], ".env.example",
      "Có 'NODE_ENV=development' (comment: bắt buộc khai báo) và 'ENABLE_DEV_OUTBOX=1' kèm cảnh báo KHÔNG BAO GIỜ bật ở production (app từ chối khởi động).", pw="Không")

    # ============================================================ 2. ENABLE_DEV_OUTBOX
    F = "Hộp thư dev opt-in (audit 4.1)"
    A(F, "Không có ENABLE_DEV_OUTBOX: /api/dev/outbox KHÔNG được mount, kể cả NODE_ENV=development", "Bảo mật", "Cao", NOENV + " Có Postgres local.",
      ["Chạy backend: $env:NODE_ENV='development'; npx tsx src/index.ts (không đặt ENABLE_DEV_OUTBOX)", "GET http://localhost:4000/api/dev/outbox?to=owner@sofinhub.test"], "ENABLE_DEV_OUTBOX=(không đặt)",
      "404 NOT_FOUND ('Không tìm thấy GET /dev/outbox'); không có route. Hộp thư không còn phụ thuộc NODE_ENV.", pw="Một phần")
    A(F, "ENABLE_DEV_OUTBOX=0 hoặc giá trị khác '1' (true, yes) cũng không mount", "Bảo mật", "Cao", NOENV + " Có Postgres local.",
      ["Lần lượt chạy backend với ENABLE_DEV_OUTBOX=0, =true, =yes, =01", "Mỗi lần GET /api/dev/outbox"], "0 / true / yes / 01",
      "Cả 4 lần đều 404. Chỉ đúng chuỗi '1' mới bật (transform v === '1').", pw="Một phần")
    A(F, "ENABLE_DEV_OUTBOX=1 ở môi trường dev: mount và trả thư gửi đi (không cần đăng nhập)", "Chức năng", "Cao", BASE,
      ["POST /api/auth/forgot-password {\"email\":\"member1@sofinhub.test\"}", "GET /api/dev/outbox?to=member1@sofinhub.test"], "member1@sofinhub.test",
      "forgot-password 200 (thông báo luôn giống nhau). outbox 200 trả mảng [{id,to,subject,text,html,sentAt}] có thư đặt lại mật khẩu kèm link {FRONTEND_URL}/reset-password?token=...; tối đa 200 thư trong bộ nhớ.", pw="Có")
    A(F, "Chuỗi tấn công chiếm tài khoản (forgot-password -> outbox -> reset) bị chặn khi outbox tắt", "Bảo mật", "Cao", "Backend chạy KHÔNG có ENABLE_DEV_OUTBOX (xóa dòng trong backend/.env rồi khởi động lại). Nạn nhân: member2@sofinhub.test.",
      ["POST /api/auth/forgot-password {\"email\":\"member2@sofinhub.test\"}", "GET /api/dev/outbox?to=member2@sofinhub.test", "Thử đoán token: POST /api/auth/reset-password {\"token\":\"abc\",\"password\":\"Newpass@123\"}"], "member2@sofinhub.test",
      "Bước 2 trả 404 nên kẻ tấn công không lấy được token; bước 3 trả 400 (token sai/hết hạn). Mật khẩu member2 không đổi (đăng nhập Passw0rd!x vẫn 200).", pw="Một phần")
    A(F, "production + ENABLE_DEV_OUTBOX=1 -> app từ chối khởi động", "Bảo mật", "Cao", NOENV + " " + PROD_OK,
      ["Đặt bộ production hợp lệ + ENABLE_DEV_OUTBOX=1", "Nạp env.ts / chạy src/index.ts"], "ENABLE_DEV_OUTBOX=1 + NODE_ENV=production",
      "Thoát mã != 0; stderr 'Cấu hình production không an toàn:' kèm dòng '- ENABLE_DEV_OUTBOX không được bật khi production (lộ token đặt lại mật khẩu)'.", pw="Không")
    A(F, "Checklist sau deploy: /api/dev/outbox trên production trả 404", "Bảo mật", "Cao", "Có URL backend đã deploy (Render) hoặc image chạy local với bộ biến production.",
      ["GET https://<backend>/api/dev/outbox", "GET https://<backend>/api/dev/outbox?to=admin@sofinhub.test"], "backend production",
      "Cả hai 404 (khớp mục 'Checklist kiểm tra sau khi deploy' của DEPLOY.md). Không lộ nội dung email.", pw="Không")
    A(F, "Email production là log-only: không lưu nội dung thư (vì chứa token)", "Bảo mật", "Trung bình", "Image production chạy local (NODE_ENV=production, RUN_MIGRATIONS=1).",
      ["POST /api/auth/forgot-password {email của tài khoản có thật}", "docker logs <container> | tìm '[mail]'"], "forgot-password",
      "Log có dòng '[mail] -> <người nhận> | <tiêu đề>' và KHÔNG có link/token trong log. Không có endpoint nào đọc được nội dung thư. Hệ quả đã biết: người dùng thật không nhận được email cho tới khi nối SES/SMTP (DEPLOY 1.5).", pw="Không")

    # ============================================================ 3. GUARD SECRET PRODUCTION
    F = "Guard secret production (audit 4.2)"
    for key in ("JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "PAYMENT_WEBHOOK_SECRET", "UPLOAD_SIGNING_SECRET"):
        A(F, f"production + {key}=dev-... -> thoát mã != 0 và nêu đúng tên biến", "Bảo mật", "Cao", NOENV + " " + PROD_OK,
          [f"Đặt bộ production hợp lệ rồi ghi đè {key}=dev-whatever-change-me", "Nạp env.ts", "Đọc stderr"], f"{key}=dev-whatever-change-me",
          f"Thoát mã != 0; stderr 'Cấu hình production không an toàn:' có dòng '- {key} đang là giá trị mặc định dev-* — phải đặt giá trị bí mật riêng'. Chỉ 1 vấn đề được liệt kê (các biến khác hợp lệ).", pw="Không")
    A(F, "production không đặt secret nào (rơi về default dev-*) -> liệt kê đủ cả 4 secret", "Bảo mật", "Cao", NOENV,
      ["Đặt chỉ NODE_ENV=production và DATABASE_URL=postgresql://u:p@db.example.com:5432/sofinhub", "Nạp env.ts"], "chỉ NODE_ENV + DATABASE_URL",
      "Thoát mã != 0; stderr liệt kê JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PAYMENT_WEBHOOK_SECRET, UPLOAD_SIGNING_SECRET (đặc biệt 2 khóa mà trước đây guard bỏ lọt: webhook + upload).", pw="Không")
    A(F, "production thiếu DATABASE_URL -> từ chối (không rơi về localhost:5435)", "Bảo mật", "Cao", NOENV + " " + PROD_OK,
      ["Đặt bộ production hợp lệ nhưng xóa DATABASE_URL", "Nạp env.ts"], "DATABASE_URL=(không đặt)",
      "Thoát mã != 0; stderr '- DATABASE_URL bắt buộc khi production (không có giá trị mặc định)'. Ngoài production vẫn rơi về postgresql://sofinhub:sofinhub@localhost:5435/sofinhub.", pw="Không")
    A(F, "Môi trường development vẫn chấp nhận secret dev-* (không bị guard chặn)", "Chức năng", "Trung bình", BASE,
      ["Mở backend/.env: JWT_ACCESS_SECRET=dev-access-secret-change-me", "npm run dev", "POST /api/auth/login bằng member1@"], "NODE_ENV=development + secret dev-*",
      "Server khởi động bình thường, đăng nhập 200. Guard chỉ chạy khi NODE_ENV=production.", pw="Có")
    A(F, "Xoay PAYMENT_WEBHOOK_SECRET: webhook ký bằng khóa mặc định cũ bị 400", "Bảo mật", "Cao", BASE + " " + MUTATE + " Cần đọc/đổi backend/.env và khởi động lại backend.",
      ["Đặt PAYMENT_WEBHOOK_SECRET=<chuỗi ngẫu nhiên mới> trong backend/.env, restart backend", "Tạo giao dịch pending: member1 không dùng được; dùng tài khoản mới đăng ký: POST /api/courses/ai/checkout {\"method\":\"stripe\"} -> paymentId",
       "Ký webhook bằng khóa CŨ 'dev-webhook-secret-change-me': header x-sofin-signature: t=<unix giây>,v1=HMAC-SHA256(\"t.rawBody\")", "POST /api/payments/webhook {\"id\":\"evt_forge_1\",\"type\":\"payment.succeeded\",\"data\":{\"paymentId\":\"<paymentId>\"}}"], "khóa cũ dev-webhook-secret-change-me",
      "400 (chữ ký sai, thông báo chung không nêu chi tiết); Payment vẫn pending, không có Subscription/Enrollment/hóa đơn. Ký bằng khóa MỚI thì 200 {received:true}.", pw="Không")
    A(F, "Xoay UPLOAD_SIGNING_SECRET: vé PUT và URL ký cũ mất hiệu lực", "Bảo mật", "Cao", BASE + " " + MUTATE + " Cần đổi backend/.env và khởi động lại backend. " + UPL,
      ["Đăng nhập member1, POST /api/uploads/presign -> uploadUrl (có ?token=)", "Đổi UPLOAD_SIGNING_SECRET trong backend/.env, restart backend", "PUT uploadUrl cũ với body PNG", "Với file private đã có: POST /api/files/<key>/url (trước khi đổi) rồi GET URL ký đó sau khi đổi"], "đổi UPLOAD_SIGNING_SECRET",
      "PUT với vé cũ -> 401 (chữ ký sai); URL ký cũ -> 401. Vé/URL phát hành sau khi xoay hoạt động bình thường.", pw="Không")
    A(F, "Xoay JWT_ACCESS_SECRET: access token cũ bị 401 ngay", "Bảo mật", "Trung bình", BASE + " " + MUTATE + " " + tok("member1@sofinhub.test"),
      ["Lưu access token cũ", "Đổi JWT_ACCESS_SECRET, restart backend", "GET /api/auth/me bằng token cũ"], "token cũ",
      "401 UNAUTHORIZED. POST /api/auth/refresh bằng cookie refresh cũ cũng 401 nếu JWT_REFRESH_SECRET cũng đổi.", pw="Không")
    A(F, "Guard quét MỌI biến chuỗi bắt đầu bằng dev-: REDIS_KEY_PREFIX=dev-x làm production không khởi động", "Bảo mật", "Thấp", NOENV + " " + PROD_OK,
      ["Thêm REDIS_KEY_PREFIX=dev-env vào bộ production hợp lệ", "Nạp env.ts"], "REDIS_KEY_PREFIX=dev-env",
      "HIỆN TẠI: thoát mã != 0 với '- REDIS_KEY_PREFIX đang là giá trị mặc định dev-*' (productionEnvProblems duyệt Object.entries của cấu hình, không giới hạn 4 secret). KỲ VỌNG đề xuất: chỉ kiểm danh sách secret hoặc thông báo rõ - ghi nhận là tác dụng phụ ngoài ý muốn.", pw="Không", st=PLAN)
    A(F, "Guard chỉ chặn tiền tố dev-, KHÔNG kiểm độ dài/độ mạnh secret", "Bảo mật", "Trung bình", NOENV + " " + PROD_OK,
      ["Đặt JWT_ACCESS_SECRET=abc (3 ký tự) trong bộ production hợp lệ", "Nạp env.ts"], "JWT_ACCESS_SECRET=abc",
      "HIỆN TẠI: nạp thành công ('LOADED') - secret yếu được chấp nhận. KỲ VỌNG đề xuất: từ chối secret < 32 ký tự. (Điểm chưa làm; DEPLOY.md chỉ khuyến nghị randomBytes(32).)", pw="Không", st=PLAN)
    A(F, "Hàm productionEnvProblems/productionEnvWarnings: bộ test hợp đồng pass", "Chức năng", "Trung bình", "Cài backend (npm ci); Postgres local chạy.",
      ["cd backend", "npx cross-env NODE_ENV=test node --import tsx --test tests/security-hardening.test.ts", "Đọc kết quả các describe 4.1, 4.2, 4.4, 4.3"], "tests/security-hardening.test.ts",
      "Toàn bộ test pass (NODE_ENV bắt buộc, outbox opt-in, guard secret dev-*, SSE không access_token, redactUrl, files public/private). Không test nào bị skip.", pw="Không")
    A(F, "Cảnh báo Redis khi production chạy nhiều instance (không thoát)", "Chức năng", "Trung bình", NOENV + " " + PROD_OK,
      ["Đặt thêm INSTANCE_COUNT=3 (hoặc WEB_CONCURRENCY=2), không đặt REDIS_URL", "Nạp env.ts", "Đặt REDIS_URL=redis://localhost:6380 và nạp lại"], "INSTANCE_COUNT=3",
      "Lần 1: 'LOADED' kèm stderr '[config] CẢNH BÁO: Phát hiện 3 instance nhưng REDIS_URL chưa đặt ...' (không exit). Lần 2: không còn cảnh báo. (Chi tiết Redis ở module INFRA.)", pw="Không")

    # ============================================================ 4. ERROR HANDLER + COOKIE
    F = "Error handler & cookie (audit 4.1)"
    A(F, "Lỗi 500 ngoài development không lộ err.message (chỉ 'Lỗi hệ thống')", "Bảo mật", "Cao", "Backend chạy NODE_ENV=test hoặc production (vd. npm test hoặc image Docker), Postgres tắt: docker stop sofinhub-postgres.",
      ["GET /api/courses (cần chạm DB)", "Đọc body JSON"], "DB dừng",
      "500 {error:{code:'INTERNAL_ERROR',message:'Lỗi hệ thống'}}; không có chuỗi SQL/connection string/stack. Chi tiết chỉ nằm trong log server.", pw="Không")
    A(F, "NODE_ENV=development: err.message thật được trả về để debug", "Chức năng", "Thấp", BASE + " Postgres tắt (docker stop sofinhub-postgres).",
      ["GET /api/courses", "Bật lại DB: docker start sofinhub-postgres"], "DB dừng, dev",
      "500 INTERNAL_ERROR với message là nội dung lỗi thật của Prisma/pg (chỉ ở development). Sau khi bật lại DB, request kế tiếp 200.", pw="Không")
    A(F, "Hàm errorHandler (unit): Error('SELECT secret ...') -> status 500, message 'Lỗi hệ thống'", "Bảo mật", "Cao", "tests/security-hardening.test.ts (describe 4.1).",
      ["Chạy npx cross-env NODE_ENV=test node --import tsx --test tests/security-hardening.test.ts --test-name-pattern=\"error handler\""], "Error('SELECT secret FROM users - postgres://x')",
      "Pass: payload.error.message === 'Lỗi hệ thống' (không chứa 'SELECT secret' hay 'postgres://').", pw="Không")
    A(F, "JSON sai cú pháp -> 400 BAD_REQUEST; body > 1MB -> 413 PAYLOAD_TOO_LARGE (không 500)", "Chức năng", "Trung bình", BASE,
      ["POST /api/auth/login với body '{bad json' (Content-Type: application/json)", "POST /api/auth/login với body JSON dài ~2MB"], "body lỗi",
      "Lần 1: 400 {code:'BAD_REQUEST', message:'Nội dung gửi lên không phải JSON hợp lệ'}. Lần 2: 413 {code:'PAYLOAD_TOO_LARGE', message:'Nội dung gửi lên quá lớn'}.", pw="Có")
    A(F, "Route không tồn tại -> 404 NOT_FOUND dạng 'Không tìm thấy <METHOD> <path>'", "Chức năng", "Thấp", BASE,
      ["GET /api/khong-co", "POST /api/courses/ai/khong-co"], "-", "Cả hai 404 {error:{code:'NOT_FOUND', message:'Không tìm thấy GET /khong-co'...}} theo error envelope chung.", pw="Có")
    A(F, "Cookie refresh_token: HttpOnly, path /api/auth; Secure bật khi NODE_ENV != development", "Bảo mật", "Cao", "Image Docker/backend NODE_ENV=production hoặc test; HTTP client xem được header Set-Cookie (curl -i).",
      ["POST /api/auth/register với email mới", "Đọc header Set-Cookie", "Lặp lại với backend NODE_ENV=development (npm run dev)"], "register",
      "production/test: Set-Cookie refresh_token=...; Path=/api/auth; HttpOnly; Secure; (production: SameSite=None, ngoài production: SameSite=Lax). development: KHÔNG có cờ Secure (để chạy http://localhost).", pw="Không")
    A(F, "Unit: cookie refresh có cờ Secure khi không phải development", "Bảo mật", "Trung bình", "tests/security-hardening.test.ts.",
      ["Chạy npx cross-env NODE_ENV=test node --import tsx --test tests/security-hardening.test.ts --test-name-pattern=\"cookie\""], "NODE_ENV=test",
      "Pass: header set-cookie khớp /;\\s*Secure/i.", pw="Không")
    A(F, "Đăng nhập ở môi trường deploy: F5 vẫn còn phiên (cookie cross-site SameSite=None; Secure)", "Tích hợp", "Cao", "Frontend Vercel + backend Render đã deploy HTTPS, CORS_ORIGIN đúng.",
      ["Mở FE, đăng nhập", "F5", "DevTools > Application > Cookies (domain backend)"], "https",
      "Vẫn đăng nhập sau F5; cookie refresh_token có Secure + SameSite=None + HttpOnly (khớp DEPLOY.md sự cố 'F5 bị out').", pw="Không")

    # ============================================================ 5. SSE KHÔNG access_token
    F = "SSE: bỏ ?access_token (audit 4.4)"
    A(F, "GET /notifications/stream?access_token=<JWT hợp lệ> -> 401", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["curl -i \"http://localhost:4000/api/notifications/stream?access_token=<token>\""], "access_token trên query",
      "401 UNAUTHORIZED (nhánh query access_token đã bị xóa khỏi streamAuth/streamQuery), KHÔNG có Content-Type text/event-stream.", pw="Có")
    A(F, "GET /messages/stream?access_token=<JWT hợp lệ> -> 401", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["curl -i \"http://localhost:4000/api/messages/stream?access_token=<token>\""], "access_token trên query", "401 UNAUTHORIZED.", pw="Có")
    A(F, "SSE bằng Bearer header vẫn chạy (text/event-stream, retry: 5000)", "Chức năng", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["curl -N -i -H \"Authorization: Bearer <token>\" http://localhost:4000/api/notifications/stream", "Đọc header + vài dòng đầu, chờ >= 25 giây", "Ctrl+C"], "Bearer",
      "200; Content-Type: text/event-stream; Cache-Control: no-cache, no-transform; X-Accel-Buffering: no; có dòng 'retry: 5000'; sau ~25s có comment ': heartbeat'.", pw="Một phần")
    A(F, "Vé stream: POST /notifications/stream-ticket -> dùng 1 lần, TTL 30s", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/notifications/stream-ticket (Bearer) -> {ticket, expiresInSec}", "GET /api/notifications/stream?ticket=<ticket> (lần 1)", "Đóng kết nối, GET lại cùng ticket (lần 2)"], "ticket",
      "Bước 1: 201 {data:{ticket, expiresInSec:30}}. Lần 1: 200 SSE. Lần 2: 401 (vé đã dùng - GETDEL atomic).", pw="Một phần")
    A(F, "Vé stream hết hạn sau 30 giây", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Lấy ticket mới", "Đợi 35 giây", "GET /api/notifications/stream?ticket=<ticket>"], "ticket quá 30s", "401 UNAUTHORIZED.", pw="Một phần")
    A(F, "Vé messages: POST /messages/stream-ticket {ticket, expiresAt}; dùng 1 lần", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/messages/stream-ticket", "GET /api/messages/stream?ticket=<ticket>", "GET lại lần 2"], "ticket messages",
      "Bước 1: 200/201 {data:{ticket, expiresAt}} (TTL 30s). Lần 1: 200 SSE có event 'ready'. Lần 2: 401.", pw="Một phần")
    A(F, "Vé của kênh này không dùng được cho kênh kia (notifications vs messages)", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Lấy ticket từ /messages/stream-ticket", "GET /api/notifications/stream?ticket=<ticket đó>", "Lấy ticket từ /notifications/stream-ticket và GET /api/messages/stream?ticket=..."], "chéo kênh",
      "Cả hai 401: vé gắn với namespace riêng (messages vs notifications) nên không redeem chéo.", pw="Một phần")
    A(F, "Access token đã bị thu hồi (đổi mật khẩu / logout-all) -> SSE Bearer 401 ngay", "Bảo mật", "Trung bình", BASE + " " + MUTATE + " Dùng tài khoản mới đăng ký.",
      ["Đăng ký user mới, lưu token A", "POST /api/auth/logout-all bằng token A", "GET /api/notifications/stream với Bearer token A"], "token đã thu hồi",
      "401 (SSE dùng chung authenticateAccessToken: kiểm sid + tokenVersion mỗi request).", pw="Có")
    A(F, "FE mở SSE bằng ?ticket=, không có access_token trong URL (DevTools Network)", "Bảo mật", "Cao", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở http://localhost:5173, đăng nhập", "DevTools > Network, lọc 'stream'", "Xem URL của request notifications/stream và messages/stream", "Tìm POST stream-ticket đứng trước"], "FE",
      "Có POST /api/notifications/stream-ticket và /messages/stream-ticket (Bearer) trước; request stream chỉ mang ?ticket=...; KHÔNG request nào có access_token trong URL.", pw="Có")
    A(F, "FE tự xin vé mới khi SSE bị ngắt (vé cũ đã dùng)", "Chức năng", "Trung bình", BASE + " Đăng nhập member1@ trên FE.",
      ["Mở trang có chuông thông báo", "Tắt backend 10 giây rồi bật lại", "Quan sát Network"], "mất kết nối",
      "Sau khi backend lên lại, FE gọi POST stream-ticket mới rồi mở lại stream (vé cũ không tái dùng); chuông thông báo vẫn nhận realtime.", pw="Một phần")
    A(F, "Heartbeat SSE: notifications ': heartbeat' mỗi 25s; messages ': ping' mỗi 25s", "Chức năng", "Thấp", BASE + " " + tok("member1@sofinhub.test"),
      ["curl -N Bearer vào /api/notifications/stream, đếm thời gian giữa comment", "Lặp với /api/messages/stream"], "-",
      "Notifications: dòng ': heartbeat' ~25s. Messages: event 'ready' lúc nối + ': ping' ~25s.", pw="Không")

    # ============================================================ 6. LOG MORGAN
    F = "Log che token (audit 4.4)"
    A(F, "Dev log: query access_token/ticket/token/sig hiện [redacted]", "Bảo mật", "Cao", BASE + " Quan sát console đang chạy npm run dev.",
      ["GET /api/courses?q=photo&access_token=LEAKME123&ticket=LEAKTICKET&token=LEAKTOK&sig=LEAKSIG", "Đọc dòng log morgan tương ứng"], "4 tham số nhạy cảm + q thường",
      "Dòng log dạng 'GET /api/courses?q=photo&access_token=[redacted]&ticket=[redacted]&token=[redacted]&sig=[redacted] 200 ...'; không còn LEAK*; tham số thường q=photo được giữ nguyên.", pw="Không")
    A(F, "Log combined (production): URL VÀ Referer đều được che", "Bảo mật", "Cao", "Chạy backend với NODE_ENV=production (image Docker hoặc bộ biến production) để dùng định dạng combined; xem docker logs.",
      ["curl -H \"Referer: http://a.test/p?access_token=LEAKREF\" \"http://localhost:4000/health?access_token=LEAKME123&ticket=LEAKTICKET\"", "docker logs <container> | tìm dòng /health"], "Referer + URL",
      "Dòng log có 'access_token=[redacted]' ở cả URL lẫn phần Referer; tìm LEAKME123/LEAKTICKET/LEAKREF trong toàn log -> 0 kết quả.", pw="Không")
    A(F, "Unit redactUrl: access_token/token/ticket/sig/refresh_token/signature/code/password bị che, tham số thường giữ nguyên", "Bảo mật", "Trung bình", "tests/security-hardening.test.ts.",
      ["Chạy test 'redactUrl che access_token/token/ticket/sig nhưng giữ tham số thường'"], "redactUrl('/api/x?access_token=abc.def&page=2')",
      "Pass: '/api/x?access_token=[redacted]&page=2'; '/api/notifications/stream?ticket=[redacted]'; '/api/uploads/k.png?token=[redacted]'; '/api/files/k.pdf?u=1&exp=2&sig=[redacted]'; '/api/courses?q=photo' không đổi.", pw="Không")
    A(F, "URL ký file (sig=...) và vé upload (token=...) không lọt vào log", "Bảo mật", "Cao", BASE + " " + UPL,
      ["Tạo file message_attachment, POST /files/<key>/url -> GET URL ký", "Presign + PUT uploadUrl (có ?token=...)", "Đọc console backend"], "sig / token upload",
      "Các dòng log GET /api/files/<key>?u=<id>&exp=<n>&sig=[redacted] và PUT /api/uploads/<key>?token=[redacted]; chữ ký/vé thật không xuất hiện trong log.", pw="Không")

    # ============================================================ 7. /api/files PUBLIC vs PRIVATE
    F = "Tải file: ảnh công khai vs riêng tư (audit 4.3)"
    for purpose in ("avatar", "cover", "post_image"):
        A(F, f"Ảnh công khai purpose={purpose}: người chưa đăng nhập xem được, cache công khai 1 năm", "Bảo mật", "Cao", BASE + " " + UPL,
          [f"Đăng nhập member1, upload PNG với purpose={purpose}", "GET <fileUrl> KHÔNG gửi Authorization (curl -i hoặc tab ẩn danh)", "Đọc header"], purpose,
          "200 trả đúng byte PNG; Cache-Control: public, max-age=31536000, immutable; X-Content-Type-Options: nosniff; Content-Security-Policy: default-src 'none'; sandbox; Cross-Origin-Resource-Policy: cross-origin.", pw="Có")
    for purpose, who in (("message_attachment", "member1"), ("lesson_attachment", "owner (mod+ của photo, gửi courseId=photo)"), ("post_file", "member1")):
        A(F, f"File riêng tư purpose={purpose}: người chưa đăng nhập bị 401", "Bảo mật", "Cao", BASE + " " + UPL,
          [f"{who} upload file purpose={purpose}", "GET <fileUrl> không Authorization", "GET <fileUrl> với Authorization sai (Bearer abc)"], purpose,
          "Cả hai 401 UNAUTHORIZED; không có byte file; không có header Cache-Control public.", pw="Có")
    A(F, "message_attachment: chỉ 2 người trong cuộc trò chuyện xem được (200, private/no-store); người ngoài 403", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["member1 upload PNG purpose=message_attachment, gửi cho member2 trong cuộc trò chuyện", "GET <fileUrl> bằng token member1 và token member2", "GET <fileUrl> bằng token người ngoài"], "file ảnh chat",
      "member1, member2: 200, đúng byte, Cache-Control: private, no-store. Người ngoài: 403 FORBIDDEN. Anonymous: 401.", pw="Có")
    A(F, "message_attachment: cuộc trò chuyện KHÁC (cùng cộng đồng) cũng không xem được file", "Bảo mật", "Cao", BASE + " " + UPL,
      ["member1 gửi file cho member2 (cuộc A)", "member3@ (cũng thuộc photo, KHÔNG thuộc cuộc A) GET <fileUrl> với token member3"], "member3 là bên thứ ba",
      "403 FORBIDDEN: quyền theo cuộc trò chuyện chứa tin nhắn CÒN SỐNG, không theo việc cùng cộng đồng.", pw="Có")
    A(F, "message_attachment: file chưa gắn vào tin nhắn nào chỉ chủ file xem được", "Bảo mật", "Trung bình", BASE + " " + UPL,
      ["member1 upload PNG message_attachment nhưng KHÔNG gửi tin", "GET <fileUrl> bằng member1, member2, admin@"], "file mồ côi chưa gắn tin",
      "member1 (chủ file): 200. member2: 403. admin@ (Platform Admin): 200.", pw="Có")
    A(F, "lesson_attachment: thành viên khóa học + chủ file xem được, người ngoài 403, tải xuống dạng attachment", "Bảo mật", "Cao", BASE + " " + UPL,
      ["owner@ upload PDF purpose=lesson_attachment, courseId=photo", "GET <fileUrl> bằng owner@ (chủ), member1@ (thành viên photo), người ngoài", "Đọc header"], "courseId=photo",
      "owner 200, member1 200 (Cache-Control: private, no-store; Content-Disposition: attachment...), người ngoài 403. Anonymous 401.", pw="Có")
    A(F, "lesson_attachment: thành viên bị kick mất quyền xem NGAY (kể cả URL ký còn hạn)", "Bảo mật", "Cao", BASE + " " + UPL + " " + MUTATE,
      ["Đăng ký user X, X tham gia photo (POST /api/courses/photo/enroll)", "owner@ upload PDF lesson_attachment courseId=photo", "X POST /api/files/<key>/url -> URL ký", "owner@ kick X: DELETE /api/courses/photo/members/<X.id>", "X GET URL ký đã lấy + GET <fileUrl> với token X"], "kick giữa chừng",
      "Trước kick: 200. Sau kick: cả URL ký lẫn Bearer đều 403 (quyền được kiểm lại ở MỖI lần GET, không chỉ lúc cấp URL).", pw="Một phần")
    A(F, "lesson_attachment không gửi courseId: chỉ chủ file xem được", "Bảo mật", "Trung bình", BASE + " " + UPL,
      ["owner@ presign purpose=lesson_attachment KHÔNG có courseId (cho phép theo yêu cầu 'courseId tùy chọn') rồi PUT", "GET <fileUrl> bằng member1@ và owner@"], "không courseId",
      "owner@ 200; member1@ 403 (không có courseId để xác định khóa học nên chỉ chủ file).", pw="Có")
    A(F, "lesson_attachment + courseId: người không phải mod+ presign bị 403", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/uploads/presign {\"filename\":\"a.pdf\",\"contentType\":\"application/pdf\",\"size\":100,\"purpose\":\"lesson_attachment\",\"courseId\":\"photo\"} bằng member1@ (member thường)"], "member thường",
      "403 FORBIDDEN (cần mod+ khi gửi courseId). courseId không tồn tại -> 404.", pw="Có")
    A(F, "post_file: người chung ít nhất một cộng đồng với chủ file xem được; người không chung thì 403", "Bảo mật", "Cao", BASE + " " + UPL,
      ["member1@ upload PDF purpose=post_file", "GET <fileUrl> bằng owner@ (chung photo với member1)", "GET <fileUrl> bằng người ngoài (không chung cộng đồng)"], "post_file",
      "owner@ 200; người ngoài 403; anonymous 401. Headers: private, no-store; Content-Disposition: attachment.", pw="Có")
    A(F, "post_file: chủ file rời hết cộng đồng chung -> người kia không còn xem được", "Bảo mật", "Trung bình", BASE + " " + UPL + " " + MUTATE,
      ["Hai user mới U1,U2 cùng tham gia 'fit' (miễn phí) ", "U1 upload post_file", "U2 GET -> 200", "U1 POST /api/courses/fit/enroll (rời)", "U2 GET lại"], "rời cộng đồng chung",
      "Lần 1: 200. Sau khi U1 rời (không còn cộng đồng chung): 403.", pw="Có")
    A(F, "Platform Admin (admin@) xem được mọi file riêng tư; chủ file luôn xem được file của mình", "Bảo mật", "Trung bình", BASE + " " + UPL,
      ["member1 upload 3 file riêng tư (message/lesson?/post_file)", "GET từng file bằng token admin@", "Cho member1 rời cộng đồng rồi vẫn GET file post_file của mình"], "admin@ + chủ file",
      "admin@ 200 cả 3 (Platform Admin ghi đè); chủ file vẫn 200 dù đã rời cộng đồng.", pw="Có")
    A(F, "File chỉ có trên đĩa, KHÔNG có bản ghi Upload -> 404 (kể cả đã đăng nhập, kể cả ảnh)", "Bảo mật", "Cao", BASE + " Có quyền ghi vào backend/data/uploads (UPLOAD_DIR).",
      ["Copy 1 PNG vào backend/data/uploads/a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png (tên 32 hex + .png)", "GET /api/files/a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png không đăng nhập", "GET lại với token member1@"], "file mồ côi",
      "Cả hai 404 NOT_FOUND (trước đây phục vụ bất kỳ file nào có trên đĩa).", pw="Không")
    A(F, "Upload đang pending (đã presign, chưa PUT) -> 404 kể cả với chủ file; POST /files/:key/url cũng 404", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/uploads/presign purpose=avatar -> key", "KHÔNG PUT. GET /api/files/<key> (anonymous và Bearer)", "POST /api/files/<key>/url bằng Bearer member1"], "pending",
      "GET: 404 cả hai; POST /files/<key>/url: 404. Chỉ status 'uploaded' mới được phục vụ.", pw="Có")
    A(F, "File bị Platform Admin gỡ (Admin > Nội dung > Media > Gỡ) -> 404 với mọi người", "Bảo mật", "Cao", BASE + " " + UPL + " " + MUTATE + " " + "Đăng nhập admin@sofinhub.test cho phần gỡ.",
      ["member1 upload ảnh post_image, GET anonymous -> 200", "admin@: POST /api/admin/content/media/<key>/remove {\"reason\":\"Vi phạm\"}", "GET <fileUrl> anonymous, Bearer member1, Bearer admin@"], "media bị gỡ",
      "Sau khi gỡ: cả 3 đều 404 (kể cả file còn trên đĩa). Restore (POST .../restore) thì phục vụ lại được.", pw="Một phần")
    A(F, "Thu hồi tin nhắn xóa luôn file đính kèm: mọi URL (kể cả URL ký còn hạn) 404", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT + " " + MUTATE,
      ["member1 gửi ảnh cho member2; member2 POST /files/<key>/url -> URL ký, GET -> 200", "member1 DELETE /api/messages/<messageId>", "GET URL ký; GET <fileUrl> bằng member1 và member2", "Kiểm tra file biến khỏi backend/data/uploads"], "thu hồi tin có ảnh",
      "Sau thu hồi: URL ký 404; cả hai Bearer 404 (kể cả chính người gửi); file trên đĩa và bản ghi Upload bị xóa. MessageView: deleted=true, content='Tin nhắn đã bị thu hồi', attachments=[].", pw="Một phần")
    A(F, "Cùng 1 file đính kèm vào 2 tin nhắn: thu hồi 1 tin KHÔNG xóa file; thu hồi tin còn lại mới xóa", "Bảo mật", "Trung bình", BASE + " " + UPL + " " + CHAT + " " + MUTATE,
      ["member1 gửi cùng 1 fileUrl trong 2 tin nhắn khác nhau (M1, M2)", "Thu hồi M1; GET file bằng member2", "Thu hồi M2; GET lại"], "file dùng lại",
      "Sau thu hồi M1: file vẫn 200 (còn tin sống M2 tham chiếu). Sau thu hồi M2: 404 và file bị xóa.", pw="Không")
    A(F, "Đính kèm file của người khác vào tin nhắn bị 400 (không 'mượn' file riêng tư)", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["member2 upload ảnh message_attachment (fileUrl2)", "member1 gửi tin trong cuộc với member2 kèm attachments[{url:fileUrl2,...}]"], "file của member2",
      "400 (file phải là file đã upload xong của CHÍNH người gửi); contentType/size trong response lấy từ server chứ không tin client.", pw="Có")
    A(F, "DELETE /uploads/:key: chủ file hoặc Platform Admin được xóa; người khác 403", "Bảo mật", "Trung bình", BASE + " " + UPL,
      ["member1 upload ảnh", "member2 DELETE /api/uploads/<key> -> ?", "member1 DELETE; sau đó GET /api/files/<key>"], "xóa upload",
      "member2: 403; member1: 200 {deleted:true}; GET sau xóa: 404; admin@ cũng xóa được file của người khác.", pw="Có")
    A(F, "Khóa file sai định dạng/path traversal luôn 404", "Bảo mật", "Cao", BASE,
      ["GET /api/files/..%2F..%2Fpackage.json", "GET /api/files/abc.png", "GET /api/files/%2e%2e/.env", "GET /api/files/<32 hex>.exe"], "key lạ",
      "Tất cả 404 (KEY_PATTERN ^[a-f0-9]{32}\\.[a-z0-9]{2,5}$ ở cả service lẫn storage); không lộ nội dung file hệ thống.", pw="Có")
    A(F, "/api/files không bị global rate limit (để tải ảnh trang)", "Chức năng", "Thấp", BASE + " Rate limit bật (mặc định ở dev).",
      ["Tải cùng 1 ảnh công khai 30 lần liên tiếp (vòng lặp curl)"], "30 request", "Không có 429; globalRateLimit bỏ qua đường dẫn bắt đầu bằng /files/ và /payments/webhook.", pw="Không")

    # ---------------------------------------------------------------- URL ký
    F = "URL ký POST /files/:key/url (audit 4.3)"
    A(F, "POST /files/:key/url với file riêng tư: 200 {url, expiresAt}, hạn 300 giây, định dạng ?u&exp&sig", "Chức năng", "Cao", BASE + " " + UPL + " " + CHAT,
      ["member2 POST /api/files/<key>/url (Bearer) cho file chat của member1", "Ghi thời điểm gọi và expiresAt", "Đọc cấu trúc url"], "file chat",
      "200 {data:{url:'/api/files/<key>?u=<userId>&exp=<epoch giây>&sig=<43 ký tự base64url>', expiresAt:'<ISO>'}}; expiresAt - thời điểm gọi ≈ 300s (±2s); u = id của member2.", pw="Có")
    A(F, "URL ký dùng được cho <img>/<a> không cần header Authorization; trả private, no-store", "Chức năng", "Cao", BASE + " " + UPL + " " + CHAT,
      ["Lấy URL ký của file ảnh chat", "Mở URL ký trong tab ẩn danh (không cookie/không header)", "Đọc header"], "URL ký",
      "200 hiển thị ảnh; Cache-Control: private, no-store (không cache ở CDN/trình duyệt chia sẻ).", pw="Có")
    A(F, "POST /files/:key/url với ảnh công khai trả URL thường, expiresAt null", "Chức năng", "Trung bình", BASE + " " + UPL,
      ["member1 upload avatar", "POST /api/files/<key>/url bằng member1"], "avatar", "200 {data:{url:'/api/files/<key>', expiresAt:null}} (đúng bằng fileUrl).", pw="Có")
    A(F, "POST /files/:key/url: anonymous 401; người không có quyền 403; không có bản ghi/pending 404", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["POST không Authorization", "POST bằng người ngoài", "POST với key không tồn tại (32 hex lạ)"], "3 trường hợp", "401, 403, 404 theo thứ tự.", pw="Có")
    A(F, "URL ký bị sửa chữ ký (sig) -> 401", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["Lấy URL ký", "Đổi sig thành 43 ký tự 'x'", "GET (không Authorization)"], "sig giả", "401 UNAUTHORIZED.", pw="Có")
    A(F, "URL ký đã hết hạn (exp trong quá khứ) -> 401", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["Lấy URL ký", "Đổi exp thành epoch của 10 giây trước", "GET"], "exp quá khứ", "401 (kể cả khi sig hợp lệ với exp gốc vì exp nằm trong chuỗi ký).", pw="Có")
    A(F, "URL ký không dùng cho file khác (đổi key) hoặc user khác (đổi u) hoặc kéo dài exp", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
      ["Có 2 file chat F1,F2; lấy URL ký của F1", "Thay đường dẫn sang /api/files/<key F2> giữ nguyên u/exp/sig", "Thay u=<id người khác>", "Thay exp = +1 ngày"], "chữ ký HMAC(file|key|userId|exp)",
      "Cả 3 lần 401: chữ ký ràng buộc 'file|key|userId|exp'.", pw="Có")
    A(F, "URL ký tự hết hạn sau 300 giây", "Bảo mật", "Trung bình", BASE + " " + UPL + " " + CHAT,
      ["Lấy URL ký, GET ngay -> 200", "Đợi 5 phút 5 giây", "GET lại"], "TTL 300s", "Lần 2: 401.", pw="Một phần")
    A(F, "HIỆN TẠI: URL ký còn hạn là 'bearer' - ai có URL (người đã được cấp) đều đọc được trong ≤300s", "Bảo mật", "Thấp", BASE + " " + UPL + " " + CHAT,
      ["member2 lấy URL ký", "Gửi URL cho người ngoài; người ngoài GET trong 300s (không token)"], "URL ký bị chia sẻ lại",
      "HIỆN TẠI: 200 (URL ký là chứng cứ cấp quyền, không ràng buộc IP/thiết bị) - rủi ro được chấp nhận vì TTL ngắn và kiểm quyền lại ở mỗi GET (kick/thu hồi có hiệu lực ngay). Ghi nhận để chủ dự án cân nhắc; không phải lỗi.", pw="Không", st=PLAN)
    A(F, "Ảnh riêng tư (message ảnh) hiển thị inline; file không phải ảnh là attachment", "Chức năng", "Trung bình", BASE + " " + UPL,
      ["Gửi 1 ảnh PNG và 1 PDF trong chat/lesson", "GET URL ký từng file, đọc Content-Disposition"], "png + pdf",
      "PNG: inline (không Content-Disposition attachment); PDF: Content-Disposition: attachment; cả hai: private, no-store + nosniff + CSP sandbox.", pw="Có")

    # ---------------------------------------------------------------- FE
    F = "Giao diện: mở file qua URL ký"
    A(F, "Chat: ảnh đính kèm hiển thị (FE gọi POST /files/:key/url rồi tải URL ký)", "Giao diện", "Cao", BASE + " Đăng nhập member1@ trên FE. " + UPL,
      ["Mở /messages, chọn cuộc trò chuyện với member2", "Gửi ảnh PNG (nút đính kèm)", "DevTools Network: tìm POST /api/files/<key>/url rồi GET /api/files/<key>?u=...&exp=...&sig=..."], "ảnh chat",
      "Ảnh hiển thị (khung placeholder xám lúc xin URL rồi ảnh); thứ tự request đúng; click ảnh mở tab mới bằng URL ký; không có request GET /api/files/<key> trần cho file riêng tư.", pw="Có")
    A(F, "Chat: tệp không phải ảnh hiện dạng liên kết kèm tên + dung lượng, tải được", "Giao diện", "Trung bình", BASE + " Đăng nhập member1@. " + UPL,
      ["Gửi 1 PDF", "Bấm vào ô tệp", "Kiểm tra tên tệp tải về"], "PDF", "Ô tệp có biểu tượng kẹp giấy, tên, dung lượng (KB/MB); bấm tải được file đúng tên (download=<tên>).", pw="Có")
    A(F, "Chat: không có quyền xem tệp -> chữ 'Không tải được tệp đính kèm'", "Giao diện", "Thấp", BASE + " Mô phỏng: chặn/ép POST /files/<key>/url trả 403 bằng DevTools (Network request blocking).",
      ["Mở cuộc trò chuyện có tệp đính kèm", "Chặn request POST /files/*/url", "Tải lại trang"], "403 từ BE", "Hiện 'Không tải được tệp đính kèm' thay cho ảnh/tệp; không treo, không lỗi console chưa bắt.", pw="Một phần")
    A(F, "Chat: thu hồi tin nhắn có tệp -> tệp biến mất khỏi giao diện cả hai bên", "Giao diện", "Cao", BASE + " " + MUTATE + " Mở 2 trình duyệt: member1@ và member2@.",
      ["member1 gửi ảnh cho member2", "member1 bấm thu hồi", "Cả hai bên quan sát bong bóng tin nhắn", "Mở lại URL ký cũ (nếu còn) trong tab mới"], "thu hồi tin có ảnh",
      "Bong bóng đổi thành 'Tin nhắn đã bị thu hồi' (không còn ảnh) ở cả hai bên (SSE message_deleted); URL ký cũ 404.", pw="Một phần")
    A(F, "Bài học: tài liệu đính kèm mở qua URL ký; link ngoài giữ nguyên; link không hợp lệ báo rõ", "Giao diện", "Cao", BASE + " Đăng nhập owner@ để thêm tài liệu, rồi member1@ để xem. " + UPL,
      ["owner@ ở Lớp học > sửa bài học > đính kèm 1 PDF (upload) + 1 link https://example.com/tai-lieu.pdf", "member1@ mở bài đó (Lớp học > chọn bài)", "Bấm từng tài liệu", "Quan sát Network"], "tài liệu bài học",
      "PDF: ban đầu '(đang tải…)' rồi liên kết; bấm -> tải qua URL ký (POST /files/<key>/url trước). Link ngoài: mở thẳng. Link javascript:/data: hiện '(liên kết không hợp lệ)' (không click được).", pw="Có")
    A(F, "Bài học: người đã bị kick không còn tải được tài liệu", "Bảo mật", "Trung bình", BASE + " " + MUTATE,
      ["owner@ kick user X khỏi photo (sau khi X mở bài có tài liệu)", "X giữ tab bài học cũ, bấm tải tài liệu"], "kick", "Không tải được (403/404, hiện lỗi hoặc liên kết không hoạt động); không lộ nội dung.", pw="Một phần")
    A(F, "Admin > Nội dung > Media: 'Xem trước' mở tệp qua URL ký; media seed chỉ có metadata báo lỗi", "Giao diện", "Trung bình", BASE + " Đăng nhập admin@sofinhub.test; /admin/content/media.",
      ["Mở /admin/content/media", "Bấm 'Xem trước' ở 1 file thật (đã upload) và ở 1 media seed", "Quan sát toast"], "media",
      "File thật: mở tab mới hiển thị (URL ký, Platform Admin được phép). Media seed (chỉ metadata, không có file): toast 'Không mở được tệp' (404) - đã biết (OPEN_DECISIONS B9).", pw="Có")
    A(F, "FE cache URL ký và tự xin lại khi còn < 20 giây", "Giao diện", "Thấp", BASE + " Đăng nhập member1@.",
      ["Mở chat có ảnh, xem 1 POST /files/<key>/url", "Chuyển cuộc trò chuyện rồi quay lại trong 4 phút", "Đợi tới gần 5 phút rồi quay lại"], "cache signed",
      "Trong 4 phút: không POST mới (dùng cache). Khi URL còn < 20s hết hạn: FE POST lại để lấy URL mới; ảnh không bị 401.", pw="Một phần")
    A(F, "Ảnh công khai (avatar/cover/ảnh bài viết) hiển thị bằng URL thường, không gọi xin URL ký lặp lại", "Giao diện", "Thấp", BASE + " Đăng nhập member1@.",
      ["Mở trang cộng đồng photo (có avatar, ảnh bài viết)", "Network: lọc 'files'"], "ảnh công khai",
      "Ảnh tải qua GET /api/files/<key> (cache công khai); FE gọi POST /files/<key>/url một lần (trả URL thường, expiresAt null) nếu dùng hook; không có 401.", pw="Có")
    A(F, "Post_file: link trong nội dung bài viết là văn bản, chưa bấm trực tiếp được", "Chức năng", "Thấp", BASE,
      ["Mở uploads.md mục 'Giới hạn' và FE bài viết", "Thử đăng bài chứa đường dẫn /api/files/<key> của post_file"], "post_file",
      "HIỆN TẠI: đường dẫn hiển thị dạng văn bản (cần trường tệp đính kèm cho bài viết - chưa làm, đã ghi trong uploads.md). Người đọc dán đường dẫn vào thanh địa chỉ sẽ nhận 401 (trình duyệt không tự gửi Bearer).", pw="Không", st=PLAN)

    # ---------------------------------------------------------------- MA TRẬN QUYỀN THEO PURPOSE (sinh bằng vòng lặp)
    F = "Ma trận quyền đọc file theo purpose"
    MATRIX = [
        ("avatar", "ảnh công khai", [("Anonymous", "200"), ("Chủ file", "200"), ("Thành viên khác", "200"), ("Người ngoài", "200"), ("Platform Admin", "200")], "public, max-age=31536000, immutable"),
        ("cover", "ảnh công khai", [("Anonymous", "200"), ("Chủ file", "200"), ("Thành viên khác", "200"), ("Người ngoài", "200"), ("Platform Admin", "200")], "public, max-age=31536000, immutable"),
        ("post_image", "ảnh công khai", [("Anonymous", "200"), ("Chủ file", "200"), ("Thành viên khác", "200"), ("Người ngoài", "200"), ("Platform Admin", "200")], "public, max-age=31536000, immutable"),
        ("message_attachment", "riêng tư theo cuộc trò chuyện", [("Anonymous", "401"), ("Chủ file (người gửi)", "200"), ("Người nhận trong cuộc", "200"), ("Thành viên cùng cộng đồng nhưng ngoài cuộc", "403"), ("Người ngoài", "403"), ("Platform Admin", "200")], "private, no-store"),
        ("lesson_attachment", "riêng tư theo khóa học (Upload.courseId)", [("Anonymous", "401"), ("Chủ file (mod+)", "200"), ("Thành viên khóa học", "200"), ("Thành viên cộng đồng KHÁC", "403"), ("Người ngoài", "403"), ("Platform Admin", "200")], "private, no-store"),
        ("post_file", "riêng tư theo cộng đồng chung với chủ file", [("Anonymous", "401"), ("Chủ file", "200"), ("Người chung ít nhất 1 cộng đồng với chủ file", "200"), ("Người không chung cộng đồng nào", "403"), ("Platform Admin", "200")], "private, no-store"),
    ]
    for purpose, label, actors, cache in MATRIX:
        A(F, f"Ma trận GET /api/files/<key> cho purpose={purpose} ({label})", "Bảo mật", "Cao", BASE + " " + UPL + " " + CHAT,
          [f"Tạo file purpose={purpose} đúng điều kiện (gắn tin nhắn / courseId / bài viết tùy loại)", "Lần lượt GET /api/files/<key> với từng tác nhân bên cạnh (anonymous = không Authorization)", "Ghi mã trạng thái và header Cache-Control"],
          "; ".join(a for a, _ in actors),
          "Kết quả theo tác nhân: " + "; ".join(f"{a} -> {code}" for a, code in actors) + f". Cache-Control (khi 200): {cache}.", pw="Có")

    # ---------------------------------------------------------------- PUT VÉ UPLOAD
    F = "Vé upload PUT (nonce một lần, liên quan audit 4.2/4.3)"
    A(F, "Vé PUT chỉ dùng được 1 lần: PUT lần hai với cùng vé -> 401", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/uploads/presign (avatar, PNG 40 byte) -> uploadUrl", "PUT uploadUrl với Content-Type: image/png, body PNG -> 200", "PUT lại đúng yêu cầu đó"], "vé dùng lại",
      "Lần 1: 200 {data:{key,fileUrl,size,contentType}}. Lần 2: 401 (vé đã dùng; nonce đánh dấu bằng SET NX).", pw="Có")
    A(F, "PUT với Content-Type lệch KHÔNG tiêu hao vé (sửa đúng rồi PUT lại được)", "Chức năng", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign contentType image/png", "PUT với Content-Type: image/jpeg -> ?", "PUT lại với image/png"], "header lệch",
      "Lần 1: 400 (Content-Type lệch loại đã presign). Lần 2: 200 (nonce chỉ bị tiêu khi mọi ràng buộc header đã đạt).", pw="Có")
    A(F, "Vé không khớp key -> 403; vé giả/hết hạn -> 401", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign 2 lần lấy 2 vé T1 (key K1), T2 (key K2)", "PUT /api/uploads/<K2>?token=<T1>", "PUT với token=abc", "Đợi vé hết hạn (UPLOAD_TICKET_TTL_SEC=600) hoặc đặt biến nhỏ rồi PUT"], "vé sai",
      "Vé T1 trên key K2 -> 403; token rác -> 401; vé hết hạn -> 401.", pw="Một phần")
    A(F, "PUT vượt maxSize khai báo lúc presign -> 413 trước khi ghi file; magic bytes sai -> 400 và hủy yêu cầu", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign size=100, PUT body 5000 byte -> ?", "Presign png nhưng PUT nội dung văn bản (không có magic bytes PNG) -> ?", "GET /api/me/uploads"], "size/magic",
      "Lần 1: 413 (không có file trên đĩa). Lần 2: 400 và bản ghi upload bị hủy (không còn trong /me/uploads, không phục vụ). SVG/HTML không có trong whitelist -> presign 400.", pw="Có")
    A(F, "GET /me/uploads chỉ liệt kê file của mình và dùng fileUrl /api/files/<key>", "Chức năng", "Thấp", BASE + " " + UPL,
      ["member1 upload 2 file; member2 upload 1 file", "GET /api/me/uploads bằng member1 và member2"], "danh sách",
      "member1 thấy đúng 2 mục [{key,url,filename,contentType,size,purpose,createdAt}]; member2 thấy 1. Không có file người khác.", pw="Có")

    # ---------------------------------------------------------------- KHÁC
    F = "Rò rỉ token qua giao diện / điều hướng"
    A(F, "Thanh địa chỉ và liên kết FE không chứa access_token/ticket/sig", "Bảo mật", "Cao", BASE + " Đăng nhập member1@ trên FE.",
      ["Duyệt các trang: /, /me/communities, /messages, /notifications, /communities/photo/community/lop-hoc", "Quan sát thanh địa chỉ và DevTools > Network > Referer của request tới domain khác (ảnh ngoài, link ngoài)"], "FE điều hướng",
      "Không URL nào của FE chứa access_token/refresh_token/ticket/sig; Referer gửi đi domain khác không có token.", pw="Có")
    A(F, "Quên mật khẩu: token đặt lại nằm ở ?token= nhưng chỉ dùng 1 lần, TTL 30 phút", "Bảo mật", "Trung bình", BASE + " Outbox bật (dev).",
      ["Forgot-password cho member3@", "Lấy link từ /api/dev/outbox?to=member3@sofinhub.test", "Mở link, đặt mật khẩu mới -> thành công", "Mở lại cùng link, đặt lại"], "reset-password?token",
      "Lần 1 thành công; lần 2: 400 (token đã dùng). Tham số token trong URL được che khi ghi log (redactUrl). (Nhớ db:reset sau khi test: mật khẩu member3 đã đổi.)", pw="Có")
    A(F, "Đổi mật khẩu không hủy token reset đang treo (điểm đã biết của audit 6.6)", "Bảo mật", "Thấp", BASE + " Outbox bật.",
      ["Forgot-password cho user mới U (không dùng link)", "U đăng nhập, đổi mật khẩu (change-password)", "Dùng link reset cũ để đặt mật khẩu"], "reset token treo",
      "HIỆN TẠI: link reset cũ vẫn dùng được trong 30 phút (changePassword không purge one-time token). KỲ VỌNG: vô hiệu hóa token. Ngoài phạm vi bước 1; ghi nhận để theo dõi.", pw="Một phần", st=PLAN)
    A(F, "POST /auth/logout dùng requireAuth: access token hết hạn thì logout 401 và không xóa cookie (điểm đã biết)", "Bảo mật", "Thấp", BASE,
      ["Đăng nhập, đợi/giả lập access token hết hạn (đổi ACCESS_TOKEN_TTL_MIN=1)", "POST /api/auth/logout bằng token hết hạn"], "token hết hạn",
      "HIỆN TẠI: 401 và cookie refresh_token vẫn còn (khác change-password dùng peekSessionId). Audit mục 6.6 chưa xử lý trong bước 1; ghi nhận.", pw="Một phần", st=PLAN)

    # ---------------------------------------------------------------- CHECKLIST DEPLOY
    F = "Checklist cấu hình khi deploy (liên kết DEPLOY.md)"
    A(F, "DEPLOY.md: bảng env liệt kê đủ NODE_ENV, DATABASE_URL, 4 secret, CORS_ORIGIN, FRONTEND_URL, ENABLE_DEV_OUTBOX", "Giao diện", "Trung bình", "Mở DEPLOY.md mục 1.2.",
      ["Đối chiếu bảng 'Environment Variables' với backend/src/config/env.ts và env-guard.ts"], "DEPLOY.md 1.2",
      "Có đủ: NODE_ENV (bắt buộc), DATABASE_URL (bắt buộc production), JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PAYMENT_WEBHOOK_SECRET, UPLOAD_SIGNING_SECRET (đều không dev-), CORS_ORIGIN, FRONTEND_URL, PLATFORM_ADMIN_EMAILS, ENABLE_DEV_OUTBOX (PHẢI để trống), RUN_MIGRATIONS... Nội dung khớp guard thật.", pw="Không")
    A(F, "DEPLOY.md: UPLOAD_SIGNING_SECRET được mô tả là khóa ký vé upload VÀ URL ký tải file riêng tư", "Giao diện", "Thấp", "Mở DEPLOY.md mục 1.2.",
      ["Đọc dòng UPLOAD_SIGNING_SECRET"], "DEPLOY.md", "Có cụm 'Khóa ký vé upload và URL ký tải file riêng tư'. (Lộ khóa này = giả mạo URL ký file riêng tư.)", pw="Không")
    A(F, "DEPLOY.md mục 1.5: file riêng tư chỉ tải được khi đăng nhập có quyền hoặc qua URL ký 5 phút", "Giao diện", "Thấp", "Mở DEPLOY.md mục 1.5.",
      ["Đọc dòng 'File upload'"], "DEPLOY.md 1.5", "Mô tả khớp hành vi thực: ảnh avatar/cover/post_image công khai; tin nhắn/tài liệu bài học/post_file riêng tư.", pw="Không")
    A(F, "Mất file khi redeploy (đĩa container) vẫn trả 404 an toàn thay vì lỗi 500", "Chức năng", "Thấp", "Image Docker không gắn volume.",
      ["Upload ảnh, GET -> 200", "Restart container (mất ổ đĩa), GET lại cùng URL"], "mất đĩa", "Bản ghi Upload còn nhưng file mất: phản hồi lỗi có kiểm soát (404), không lộ stack; sau khi gắn Persistent Disk/S3 sẽ hết. (Hạn chế đã biết DEPLOY 1.5.)", pw="Không")

    # ---------------------------------------------------------------- BỔ SUNG: HEADER, COOKIE, UPLOAD AN TOÀN
    F = "Header bảo mật & cookie"
    A(F, "Header bảo mật helmet có mặt ở API; x-powered-by bị tắt", "Bảo mật", "Trung bình", BASE,
      ["curl -i http://localhost:4000/health", "curl -i http://localhost:4000/api/courses", "Đọc header"], "helmet",
      "Có X-Content-Type-Options: nosniff, Referrer-Policy (helmet mặc định), Strict-Transport-Security, X-Frame-Options/CSP theo helmet mặc định; KHÔNG có X-Powered-By. (Riêng /api/files/* thêm CSP sandbox + CORP cross-origin.)", pw="Có")
    A(F, "Cookie refresh_token: HttpOnly, Path=/api/auth; logout xóa cookie đúng path", "Bảo mật", "Cao", BASE,
      ["POST /api/auth/login -> đọc Set-Cookie", "DevTools > Application > Cookies: thử đọc bằng document.cookie", "POST /api/auth/logout (Bearer) -> Set-Cookie xóa cookie"], "refresh cookie",
      "Set-Cookie: refresh_token=...; Path=/api/auth; HttpOnly; SameSite=Lax (development; không Secure); document.cookie KHÔNG thấy refresh_token; logout trả cookie hết hạn cùng Path=/api/auth. SameSite=None; Secure chỉ khi NODE_ENV=production.", pw="Có")
    A(F, "CORS: chỉ origin trong CORS_ORIGIN được phép kèm credentials", "Bảo mật", "Trung bình", BASE,
      ["curl -i -H 'Origin: http://localhost:5173' http://localhost:4000/api/courses", "curl -i -H 'Origin: http://evil.example' http://localhost:4000/api/courses", "OPTIONS preflight với origin lạ"], "CORS_ORIGIN",
      "Origin 5173: Access-Control-Allow-Origin: http://localhost:5173 + Allow-Credentials: true; origin lạ: không có Access-Control-Allow-Origin (trình duyệt chặn).", pw="Một phần")
    A(F, "Log không ghi body (mật khẩu) của request đăng nhập/đặt lại mật khẩu", "Bảo mật", "Cao", BASE + " Quan sát console backend.",
      ["POST /api/auth/login {email, password:'Passw0rd!x'} và POST /api/auth/reset-password {token:'abc',password:'Matkhau@123'}", "Tìm 'Passw0rd' và 'Matkhau' trong log"], "body nhạy cảm", "Log morgan chỉ có method/URL/status/thời gian; KHÔNG có body; token ở query bị che.", pw="Không")
    A(F, "Health không lộ thông tin nội bộ (chỉ status, uptime)", "Bảo mật", "Thấp", BASE,
      ["GET /health khi DB tốt và khi DB dừng"], "/health", "Body chỉ {status:'ok',uptime} hoặc {status:'db_unavailable'}; không chuỗi kết nối, không phiên bản, không stack.", pw="Có")
    F = "Upload an toàn (liên quan audit 4.3)"
    A(F, "Presign từ chối SVG/HTML/loại ngoài whitelist (400)", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["POST /api/uploads/presign {filename:'a.svg',contentType:'image/svg+xml',size:100,purpose:'post_image'}", "contentType 'text/html' purpose post_file", "contentType 'application/x-msdownload'"], "loại cấm", "Cả ba 400 (SVG/HTML không có trong whitelist để chống XSS).", pw="Có")
    A(F, "Tên file người dùng chỉ là metadata: khóa lưu là 32 hex ngẫu nhiên + đuôi whitelist; ký tự điều khiển, / và \\ bị bỏ", "Bảo mật", "Cao", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign filename '../../etc/passwd\\r\\n.png' contentType image/png", "Xem key và filename trong GET /api/me/uploads"], "tên độc hại", "key dạng <32 hex>.png; filename được làm sạch (không '/', '\\', CR/LF); không có đường dẫn trên đĩa chứa tên người dùng.", pw="Có")
    A(F, "Content-Type phục vụ suy từ đuôi key, không từ metadata; có nosniff; non-image là attachment", "Bảo mật", "Trung bình", BASE + " " + UPL,
      ["Upload PDF hợp lệ (pdf) và ảnh PNG", "GET file, đọc Content-Type/Content-Disposition/X-Content-Type-Options"], "serve headers", "PNG: image/png inline + cache public (nếu ảnh công khai); PDF: application/pdf + Content-Disposition: attachment + private, max-age/no-store theo purpose; mọi file có X-Content-Type-Options: nosniff + CSP sandbox.", pw="Có")
    A(F, "Hạn mức dung lượng người dùng (200MB, gồm cả pending còn hạn) -> 413 QUOTA_EXCEEDED", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign nhiều file 25MB cho tới khi tổng (uploaded + pending còn hạn) vượt 200MB", "Presign thêm 1 file"], "UPLOAD_USER_QUOTA_MB=200", "Yêu cầu vượt hạn mức: 413 với mã QUOTA_EXCEEDED; không lách được bằng presign hàng loạt (SUM trong DB gồm pending).", pw="Một phần")
    A(F, "Tin nhắn tối đa 5 tệp đính kèm; tệp thứ 6 -> 400", "Chức năng", "Thấp", BASE + " " + UPL + " " + CHAT,
      ["member1 gửi tin với attachments gồm 6 phần tử (6 file đã upload của chính mình)"], "6 attachments", "400 VALIDATION_ERROR (tối đa 5); với 5 file: 201.", pw="Có")
    A(F, "Sai magic bytes: PDF khai báo nhưng nội dung văn bản -> 400 và bản ghi bị hủy", "Bảo mật", "Trung bình", BASE + " " + tok("member1@sofinhub.test"),
      ["Presign pdf; PUT body 'hello' với Content-Type application/pdf", "GET /api/me/uploads; GET /api/files/<key>"], "magic bytes", "PUT 400 'Nội dung file không khớp với loại file khai báo'; không còn trong /me/uploads; GET file 404.", pw="Có")
    A(F, "Quy trình khôi phục sau case MUTATE: db:reset và dọn backend/data/uploads", "Chức năng", "Thấp", BASE,
      ["Sau khi test SECX: npm run db:reset", "Xóa file thử trong backend/data/uploads (thư mục nằm trong .gitignore)", "Khôi phục .env (NODE_ENV, ENABLE_DEV_OUTBOX, secret) về giá trị dev"], "dọn dẹp", "DB về seed; không còn file mồ côi; .env dev đúng (ENABLE_DEV_OUTBOX=1, secret dev-*).", pw="Không")
    A(F, "Webhook ký bằng khóa mặc định dev- được chấp nhận ở DEV (đây là lý do production bắt buộc đổi khóa)", "Bảo mật", "Cao", BASE + " Môi trường dev với PAYMENT_WEBHOOK_SECRET mặc định. " + MUTATE,
      ["Tài khoản mới checkout 'ai' (pending)", "Ký webhook payment.succeeded bằng 'dev-webhook-secret-change-me' và gửi", "Kiểm tra Payment/Subscription"], "khóa mặc định", "Ở dev: 200 và Payment succeeded + gói + thành viên (khóa ai cũng biết = miễn phí trọn đời nếu lên production không đổi). Production không khởi động với khóa này (xem nhóm Guard).", pw="Không")
    A(F, "Dev/production: JWT access token TTL 15 phút, refresh 30 ngày (cấu hình) - không đổi do hardening", "Chức năng", "Thấp", BASE,
      ["Đọc ACCESS_TOKEN_TTL_MIN, REFRESH_TOKEN_TTL_DAYS trong env.ts/.env.example", "Giải mã access token (jwt.io) xem exp - iat"], "TTL", "exp - iat = 900 giây (15 phút); refresh cookie Max-Age ≈ 30 ngày; có sid + tv trong payload.", pw="Không")

    # @@END@@
