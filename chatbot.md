# Chatbot hỗ trợ "Tào" — báo cáo triển khai

> Branch `feat/chatbot-ai` (chưa merge vào `master` — merge vào `master` sẽ tự deploy lên AWS qua workflow *Deploy to AWS*). Cập nhật 2026-10-14.
> Tài liệu kỹ thuật: `backend/docs/api/chatbot.md` · kịch bản test tay: `docs/features/chatbot.md` · regression bảo mật: `chatbot_qa_security_suite/README.md`.

## 1. Chatbot làm gì

- Widget chat nổi góc phải cho **người dùng đã đăng nhập** (ẩn ở `/admin`). Trả lời **chỉ** về nền tảng SofinHub và các tool đang bán ở `/tools`; câu ngoài phạm vi / cố lừa bot bị từ chối.
- Ưu tiên **câu hỏi mẫu do admin đặt**: khớp đủ gần ⇒ trả nguyên văn, không gọi AI.
- Còn lại: server gom ngữ cảnh (câu mẫu, tài liệu lỗi tool & Ngân Lượng, danh mục tool, cộng đồng kèm giá, giao dịch của **chính** khách khi câu hỏi nhắc tới đơn/thanh toán, số liệu nền tảng) rồi gọi **Codex SDK đăng nhập bằng tài khoản ChatGPT** (không dùng OpenAI API key) một lượt, nhận JSON.
- Luật cứng: không bịa; không tự báo giá tool; **không bao giờ đưa số tài khoản ngân hàng** (thanh toán chỉ VietQR/SePay); ảnh chụp chuyển khoản không phải bằng chứng; chỉ thấy dữ liệu của chính người hỏi.
- Không xử lý được ⇒ **chuyển người qua Zalo**: tạo ticket nội bộ kèm đoạn chat, đưa khách mã `T-…`. Chống spam: dùng lại ticket chatbot còn mở trong 24h, tối đa 3 ticket mới/khách/ngày.
- **Học từ chat** (job mỗi giờ): mọi câu học được đều vào hàng **chờ admin duyệt**, kể cả khi khách 👍 (có tag "khách 👍" để ưu tiên) — bot không tự bật câu nào.
- **Admin > Hỗ trợ > Chatbot**: kho câu mẫu, chờ duyệt, tài liệu, hội thoại, cài đặt (link Zalo, ngưỡng, giọng nói…), thẻ **Tài khoản ChatGPT** (Super Admin, đăng nhập bằng mã thiết bị — copy link + mã, không popup).
- Trang `/tools` và chatbot dùng chung danh mục tool (`GET /api/tools`).

## 2. Dữ liệu bot dùng để trả lời

Bot **chỉ** dùng câu mẫu đang bật + tài liệu đang bật; mọi thứ khác (học từ chat, nhập từ Zalo) nằm ở hàng chờ duyệt cho tới khi admin duyệt.

| Nguồn | Số lượng | Trạng thái | Nội dung |
|---|---|---|---|
| FAQ công khai | 16 câu | Đang dùng | Viết lại từ trang FAQ của web |
| Chủ đề Zalo viết lại | 8 câu | Đang dùng | Giá tool (báo riêng → Mua ngay/Zalo), Ngân Lượng, tốn NL khi tạo video, cách mua tool, hỏi số tài khoản (→ VietQR, không gửi STK), ảnh chuyển khoản, báo lỗi tool, hỏi khi nào sửa xong. **Không chép chat thật**, không tên/SĐT, không con số giá |
| Chủ đề chưa có thông tin | 4 câu | **Chờ admin điền** | Dùng thử, cấu hình máy, phí API/tài khoản AI, người mới/lớn tuổi học. Câu trả lời là `[CẦN ADMIN ĐIỀN…]` — hệ thống **không cho bật** khi chưa điền |
| Tài liệu tri thức | 2 tài liệu | Đang dùng | Xử lý lỗi thường gặp (9 mục), Ngân Lượng & báo giá (không có Techcombank) |
| Chat Zalo nhập nguyên văn (bản cũ) | 33 câu | **Đã từ chối** (DB dev) | Chất lượng thấp: hỏi–đáp lệch, văn nói, "gói 0", "lấy bên khác dùng"… |

- Production không chạy seed ⇒ backend **tự nạp dữ liệu nền khi khởi động** (một lần mỗi phiên bản, không ghi đè bản admin đã sửa).
- Script nhập Zalo có bộ lọc chặt (bỏ câu chào, giá, "gửi ultra", hỏi ngược, hứa giờ, văn nói, không phải câu hỏi) + `--dry-run` xem trước: 35 nhóm → còn 4.

### Bot hỏi lại khách (gợi ý trả lời nhanh)

Khi câu hỏi chưa đủ rõ (khóa học chủ đề nào, tool nào…), bot hỏi lại **một câu ngắn** và kèm 2–4 **nút gợi ý** dưới tin nhắn; khách bấm là gửi luôn. Ví dụ "có những khóa học nào" ⇒ "bạn quan tâm chủ đề nào ạ… xem toàn bộ ở **Khám phá khóa học**" + nút "Công nghệ", "Sáng tạo nội dung"… ⇒ bấm "Công nghệ" ⇒ bot giới thiệu các khóa học công nghệ kèm link. Đã kiểm với model thật (2/2 câu mới trong bộ đo) và E2E.

## 3. Kiến trúc & cô lập Codex

- `backend/src/modules/chatbot/*`, migration `20261016100000_chatbot` (5 bảng `Chatbot*`), cài đặt ở `PlatformSetting` khóa `chatbot.settings`.
- Codex chạy với **CODEX_HOME riêng** (`backend/data/codex-home`, đã vào `.gitignore`/`.dockerignore`), config do server ghi: tắt shell/exec, trình duyệt, computer-use, plugin, hook, ảnh, multi-agent; sandbox read-only, không mạng, thư mục làm việc rỗng; tiến trình con **không nhận secret** của backend; tối đa 3 lượt song song, timeout 90s; phiên Codex (chứa nội dung chat) bị xóa sau 1 giờ.
- Mỗi tin của bot ghi lại **ID nguồn** đã đưa vào ngữ cảnh (câu mẫu, đoạn tài liệu) để kiểm tra; `CHATBOT_TRACE_CONTEXT=1` (chỉ QA) lưu cả nguyên văn prompt.

## 4. Lỗi đã phát hiện & đã sửa

| # | Lỗi | Sửa |
|---|---|---|
| 1 | Hỏi "có những khóa học nào" ⇒ bot chuyển người (tìm kiếm theo nguyên câu không khớp cộng đồng nào) | Bot **hỏi lại chủ đề** kèm nút gợi ý trả lời nhanh + link "Khám phá khóa học" (không liệt kê khóa học kèm học phí); bấm chủ đề ⇒ khóa học của chủ đề đó |
| 2 | Chuyển người quá dễ ⇒ có thể spam ticket (6/26 test tạo ticket) | Dùng lại ticket còn mở trong 24h, tối đa 3 ticket mới/khách/ngày, Telegram chỉ báo ticket mới; prompt không chuyển người khi chỉ cần từ chối ⇒ còn 1–2/34 |
| 3 | Mọi câu hỏi đều gửi giao dịch của khách sang ChatGPT | Chỉ gửi khi câu hỏi (hoặc câu ngay trước) nhắc tới đơn/thanh toán/hoàn tiền/mã đơn |
| 4 | Hỏi về mã đơn của người khác ⇒ bot chuyển người | Prompt: "không tìm thấy đơn đó trong tài khoản đang đăng nhập", không xác nhận gì, không chuyển người |
| 5 | Hết hạn mức ChatGPT ⇒ lỗi chung chung, mỗi tin vẫn gọi Codex (~4s) | Nhận diện "usage limit": khách nhận "tạm quá tải + nhắn Zalo", **tạm ngừng gọi Codex 5 phút** (trả lời ~1s), job học dừng lượt, admin thấy dải đỏ (`summary.llm`) |
| 6 | Không triển khai được trên AWS: token ChatGPT của bot mất sau mỗi lần deploy | Volume bền `chatbot-codex` trong `deploy/aws/docker-compose.yml`; Dockerfile tạo sẵn thư mục cho user `node`; đã kiểm binary Codex chạy trong image Alpine |
| 7 | Tài liệu tri thức (`*.md`) bị `.dockerignore` loại khỏi image | Ngoại lệ `!prisma/chatbot-kb/*.md` |
| 8 | Đường dẫn trong câu trả lời hiện "/tools" | Hiện tên trang ("Tải Tool", "Gói & thanh toán"…) tô màu, bấm được |
| 9 | Backend dev chạy lại bản cũ dùng model giả (tiến trình node mồ côi) | Đã dọn; tài liệu ghi rõ cách chạy |
| 10 | Bộ regression có thể PASS giả (review bộ test) | Runner bản 3: kết quả bắt buộc liệt kê rõ, manifest ID bắt buộc, chụp **toàn bộ** DB (56 bảng), kiểm ngữ cảnh gửi model, dò rò rỉ chặt hơn, dọn dẹp trong `finally`, tự đăng nhập lại khi token hết hạn, lỗi một case không làm sập cả bộ, `selftest.py` 25 test |
| 11 | **Production không có dữ liệu chatbot** (prod không chạy seed ⇒ 0 câu mẫu, 0 tài liệu) | Tự nạp dữ liệu nền khi khởi động (`chatbot.baseline.ts`, version 2) |
| 12 | Dữ liệu Zalo nhập nguyên văn, chất lượng thấp | Từ chối 33 câu cũ; viết lại 8 chủ đề thành câu mẫu sạch + 4 câu chờ điền; lọc chặt + `--dry-run` cho lần nhập sau |
| 13 | Câu học được tự bật khi khách 👍 | Bỏ tự bật: **mọi** câu học được đều chờ admin duyệt (tag "khách 👍" để ưu tiên); bỏ 2 cài đặt ngưỡng/tự học |
| 14 | Giá "200.000đ/tháng" bị biến thành link "trang này" dẫn tới `/th` | Đường dẫn phải đứng riêng (không dính chữ có dấu); chỉ trang có thật mới thành link; link markdown `[Tên khóa học](/communities/...)` hiện đúng tên |

## 5. Kết quả kiểm thử

| Loại | Kết quả |
|---|---|
| Test backend (`npm test`) | **646/646 PASS** (32 test chatbot, thêm: hỏi lại + gợi ý trả lời nhanh, thêm: dữ liệu nền, chặn bật câu chưa điền, lọc Zalo, hỏi STK → câu mẫu VietQR; cùng các test cũ: luồng, guardrail, chuyển Zalo, học, phân quyền admin, tài khoản ChatGPT, ngữ cảnh RAG, chống spam ticket, hết hạn mức) |
| Typecheck BE/FE, build FE, lint | Sạch (lint chỉ còn cảnh báo cũ, không thuộc chatbot) |
| E2E Playwright (`e2e/tests/05-chatbot.spec.ts`, model giả) | **7/7 PASS** (widget, câu mẫu, thẻ tool + nhãn trang, từ chối, chuyển người, hỏi lại chủ đề + bấm gợi ý, trang admin) |
| Bộ câu hỏi thật từ Zalo — 92 case, 13 nhóm (`tests/chatbot-zalo.vi.json`) | Đã tạo + kiểm offline; **chưa chạy với model thật** (Docker/DB đang tắt) — lệnh: `npm run chatbot:eval -- --file=tests/chatbot-zalo.vi.json` |
| Bộ đo chất lượng 49 câu (model thật) | 46/47 lần chạy đầy đủ (câu trượt do điều kiện kiểm tra — đã sửa); 2 câu mới về khóa học (c01, c02): 2/2 |
| Regression bảo mật 34 case (model thật) | Lần chạy đầy đủ: **34/34 PASS** — rò rỉ câu trả lời 0, rò rỉ ngữ cảnh 0, DB đổi trái phép 0 |
| Selftest runner | **25/25 PASS** |
| Image Docker production | Build OK; `codex --version`, `codex exec`, `codex login --device-auth` chạy trong container |

**Chưa hoàn tất**: chạy lặp `--repeat 3 --parallel-ab 3` với model thật — cả hai tài khoản ChatGPT đã thử đều chạm *"You've hit your usage limit… try again at 1:41 PM"* giữa lượt chạy. Bot xử lý đúng (báo quá tải, không trả lời bừa; runner đánh FAIL đúng, không PASS giả). Cần chạy lại khi hạn mức hồi:

```powershell
# backend chế độ QA
cd backend; $env:RUN_SCHEDULERS="0"; $env:CHATBOT_TRACE_CONTEXT="1"; $env:PLATFORM_ADMIN_EMAILS="admin@sofinhub.test"; npm run dev
cd ../chatbot_qa_security_suite; python selftest.py; python runner.py --repeat 3 --parallel-ab 3
```

## 6. Triển khai

1. Merge `feat/chatbot-ai` vào `master` khi sẵn sàng ⇒ CI ⇒ tự deploy AWS (migration chạy khi `RUN_MIGRATIONS=1`).
2. Production **không** đặt `CHATBOT_FAKE_MODEL`, `CHATBOT_TRACE_CONTEXT` (app từ chối khởi động nếu có).
3. Sau deploy: Super Admin vào Admin > Hỗ trợ > Chatbot > Cài đặt > "Tài khoản ChatGPT của chatbot" ⇒ đăng nhập bằng mã thiết bị (tài khoản phải bật *Device code sign-in* trong ChatGPT > Settings > Security). Nhập link Zalo hỗ trợ ở cùng trang.
4. Câu mẫu + tài liệu nền tự nạp khi backend khởi động. Vào tab **Chờ duyệt**: điền 4 câu `[CẦN ADMIN ĐIỀN]` rồi duyệt; duyệt dần các câu bot học được.
5. (Tùy chọn) Nhập câu hỏi Zalo mới: chạy `npm run chatbot:import-candidates -- <file> --dry-run` xem trước, rồi bỏ `--dry-run`.

## 7. Rủi ro & việc còn mở

- **Tài khoản ChatGPT cá nhân làm backend cho chatbot công khai**: có thể vi phạm điều khoản OpenAI; hạn mức thấp (đã chạm 2 lần trong một buổi test) — nên dùng gói trả phí / cân nhắc chuyển sang API key khi lưu lượng tăng (OPEN_DECISIONS A18).
- Mỗi câu trả lời AI mất ~6–15 giây (Codex trả JSON nguyên khối, không stream từng chữ).
- Chạy lặp 3 lần + song song A/B của bộ regression chưa hoàn tất (xem mục 5).
- Bộ chụp DB chỉ thấy thay đổi còn tồn tại sau test (chưa có trigger audit ở DB test).
- Các giá trị tạm (ngưỡng khớp câu mẫu 0.6, 200 tin/ngày, 3 ticket/ngày) cần chốt sau khi chạy thật.
