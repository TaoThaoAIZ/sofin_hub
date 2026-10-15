# Kế hoạch: Chatbot riêng cho từng cộng đồng

> Trạng thái: **đã làm** (branch `feat/chatbot-ai`, chưa merge master). Cập nhật 2026-10-15. Tài liệu kỹ thuật: `backend/docs/api/community-bot.md`. Kết quả: mục 8.
> Báo cáo bot hỗ trợ nền tảng "Tào" (đã làm) xem bản trước của file này trong git: `git show cf54005:chatbot.md`.

## 1. Mục tiêu

Mỗi cộng đồng có trợ lý AI riêng, trả lời bằng **dữ liệu của chính cộng đồng đó**, nói bằng **persona của cộng đồng**. Cách cấu hình persona học từ `taothaoclaw`.

Hiện SofinHub chỉ có bot "Tào" dùng chung toàn site: các bảng `Chatbot*` chưa có `communityId`, persona chỉ là một ô văn bản.

## 2. Đã chốt

| Vấn đề | Chốt |
|---|---|
| Ai bật được bot | Chỉ cộng đồng mà **chủ ở gói Chuyên nghiệp (Pro)**, tức `HostingPlan.planKey='pro'` và `status` là trialing hoặc active. Chỉ **chủ** bật hay tắt được |
| Ai chat được | **Mọi thành viên** của cộng đồng, chia 2 mức (bảng bên dưới). Người ngoài cộng đồng không chat được |
| Nhân cách | Chủ đặt nhân cách mặc định (chọn mẫu có sẵn, hoặc tự viết theo khuôn taothaoclaw) và chọn những nhân cách thành viên VIP được đổi |
| Dữ liệu | Giới thiệu, nội quy, giá; bài học lớp học; bài đăng, sự kiện; Q&A và tài liệu riêng do chủ thêm |
| Không trả lời được | **Chuyển cho chủ cộng đồng** qua Tin nhắn có sẵn của SofinHub. Không dùng Zalo, không tạo ticket |

### Hai mức thành viên

| | Thành viên thường | Thành viên trả phí (VIP) |
|---|---|---|
| Xác định | Có trong cộng đồng | Gói còn hạn (`hasLiveSubscription`). Mod, admin, chủ luôn tính là VIP |
| Nhân cách | Chỉ nhân cách mặc định của chủ (menu chọn hiện khóa 🔒) | **Mở khóa chọn nhân cách** trong danh sách chủ cho phép, lưu riêng cho từng người |
| Số tin/ngày | Thấp, chủ đặt (mặc định 10) | Cao (mặc định 100) |
| Dữ liệu | Giới thiệu, nội quy, sự kiện, bài đăng, Q&A/tài liệu của chủ, bài học người đó đã mở | Như thường, cộng với trích bài học sâu hơn (~1.500 ký tự/bài thay vì ~400) và nhớ lịch sử chat dài hơn (12 lượt thay vì 4) |
| Chuyển cho chủ | Có | Có |
| Hết lượt trong ngày | Câu nhắc nâng cấp VIP | Câu "quay lại mai" |

- Khóa bài học của lớp học (trả phí theo module, theo level, học tuần tự) **luôn áp dụng theo từng người**. VIP không đọc được bài người đó chưa mua.
- Widget của thành viên thường hiện dải "Nâng cấp VIP để chọn nhân cách và chat nhiều hơn", dẫn tới trang thanh toán của cộng đồng.
- Cộng đồng miễn phí không có ai là VIP, nên mọi thành viên ở mức thường, trừ mod trở lên.
- Gói trả phí hết hạn thì thành viên về mức thường, nhân cách về mặc định.

## 3. Học từ taothaoclaw

`taothaoclaw` ("Bối Bối") là trợ lý thư ký cá nhân, không phải bot CSKH: không có RAG, câu mẫu, chuyển người hay bộ test. Phần áp dụng được:

- **Persona có cấu trúc**, tách khỏi luật khung (luật khóa cứng, persona chủ sửa được):
  - xưng hô
  - giọng, giới hạn kính ngữ ("đừng nhồi 4 từ kính ngữ")
  - chính sách emoji
  - khi sai: không xin lỗi suông, nhận sai rồi sửa
  - hỏi lại: chỉ 1 câu, luôn kèm lựa chọn
  - cách nói chuyện phiếm
- **Bảng ví dụ 3 cột: Tốt / Quá lê thê / Quá cộc** (`taothaoclaw/data/AGENTS.md`). Đây là cách dạy giọng hiệu quả nhất.
- **Thứ tự prompt:** thời gian hiện tại theo giờ VN → luật → persona → hướng dẫn thêm → dữ liệu → lịch sử → tin khách.
- **Luật:**
  - đoán mặc định hợp lý, chỉ hỏi khi không đoán được
  - tự hiểu "cái đó/nó" từ lịch sử
  - chỉ dùng thời gian tuyệt đối
  - không có dữ liệu thì nói thẳng
- **Không áp dụng:**
  - router 2 model: Codex 1 lượt là đủ
  - bộ nhớ dài hạn theo khách: rủi ro dữ liệu cá nhân
  - tool loop: server tự gom dữ liệu

Bot "Tào" cũng được thêm thời gian hiện tại và luật "đoán trước, hỏi sau". Lý do: bộ test Zalo cho thấy Tào đang hỏi lại hơi nhiều.

## 4. Thiết kế

### 4.1 Dữ liệu (migration mới)
- **Bảng có sẵn thêm `communityId`** (để trống = bot Tào): `ChatbotQA`, `ChatbotDocument`, `ChatbotConversation`. Mọi truy vấn hiện có của Tào phải lọc "không thuộc cộng đồng nào", nếu không widget Tào có thể mở nhầm hội thoại của bot cộng đồng.
- **Bảng mới `CommunityBot`**, mỗi cộng đồng 1 dòng:
  - bật/tắt, tên bot, lời chào
  - nhân cách mặc định (mẫu hoặc tự tạo), danh sách nhân cách VIP được đổi
  - hướng dẫn thêm
  - giới hạn tin/ngày cho thành viên thường và VIP
- **Bảng mới `CommunityBotMemberPref`:** nhân cách mỗi thành viên VIP đã chọn.
- **Thêm chỉ mục tìm kiếm toàn văn** cho bài học (tên + nội dung) và sự kiện, giống cách đã làm cho bài đăng.

### 4.2 Nhân cách mẫu (dùng chung cho cả 2 bot)

| Mẫu | Giọng |
|---|---|
| `mentor` | Thầy/cô tận tâm, giải thích từng bước |
| `buddy` | Bạn đồng hành vui vẻ, thân mật |
| `coach` | Huấn luyện viên thẳng thắn, thúc đẩy hành động |
| `concise` | Trợ lý ngắn gọn, vào thẳng ý |

Mỗi mẫu có đủ các mục: tên, xưng hô, giọng, emoji, cách hỏi lại, nói chuyện phiếm, và **bảng ví dụ Tốt / Lê thê / Cộc**. Chủ cũng có thể "Tự tạo" bằng form cùng các mục đó.

### 4.3 Phân quyền

Thứ tự kiểm tra:
1. Cộng đồng bị khóa → chặn.
2. Bot tắt → `BOT_DISABLED`.
3. Chủ không còn Pro → `COMMUNITY_NOT_PRO`.
4. Không phải thành viên hoặc bị cấm → `NOT_MEMBER`.
5. Còn lại: xác định mức thường hay VIP, nhân cách đang dùng và các giới hạn.

Ngoài ra:
- Thành viên thường đổi nhân cách → `VIP_REQUIRED`.
- Hết lượt trong ngày → `DAILY_LIMIT`, kèm mức thành viên để widget hiện đúng câu nhắc.
- Admin trở lên quản lý nội dung bot. Chỉ chủ bật/tắt được.

### 4.4 Bot đọc dữ liệu thế nào

Bot chỉ đọc dữ liệu **của cộng đồng đó**, theo **quyền của chính người hỏi**:
- **Giới thiệu:** mô tả, lợi ích, nội quy, giá, giảng viên. Ai trong cộng đồng cũng xem được.
- **Q&A và tài liệu riêng của chủ:** đã khớp câu mẫu thì trả lời ngay, không gọi AI (giống Tào).
- **Bài học:**
  - Tìm 5 bài liên quan, rồi **lọc qua đúng logic khóa của lớp học**, tách ra thành hàm dùng chung.
  - Không đọc thẳng từ DB, vì truy vấn thô không áp khóa trả phí/level.
  - Bài chưa mở: bot chỉ biết tên bài và lý do khóa ("cần level X", "cần mua module").
  - Bài đã mở: trích nội dung kèm link tới bài.
- **Bài đăng:** dùng tìm kiếm bài đăng có sẵn, đã tự bỏ bài ẩn hoặc đã xóa.
- **Sự kiện:** 5 sự kiện sắp tới, cộng với kết quả tìm theo câu hỏi.
- **Gói của chính người hỏi** trong cộng đồng này (trạng thái, ngày gia hạn): chỉ khi câu hỏi nói về thanh toán.
- Mỗi câu trả lời lưu vết ID nguồn đã dùng, giống Tào, để kiểm tra rò rỉ.

### 4.5 Luật của bot cộng đồng
- Chỉ hỗ trợ trong phạm vi cộng đồng đó: nội dung học, nội quy, sự kiện, cách dùng lớp học. Ngoài phạm vi thì từ chối.
- Không bịa. Con số chỉ lấy từ dữ liệu.
- **Không tiết lộ nội dung bài đang khóa**, chỉ nói cách mở.
- Không đưa số tài khoản. Thanh toán chỉ qua VietQR.
- Đoán trước, hỏi lại ít, hỏi thì kèm nút gợi ý. Tự hiểu "cái đó/nó". Dùng thời gian tuyệt đối.
- Cần người thật thì đề nghị **gửi câu hỏi cho chủ cộng đồng**.

### 4.6 Chuyển cho chủ cộng đồng
- Bot đề nghị, widget hiện nút "Gửi câu hỏi cho chủ cộng đồng".
- **Chỉ khi thành viên bấm** mới gửi. Hệ thống mở hội thoại Tin nhắn giữa thành viên và chủ, rồi gửi tóm tắt "[Hỏi qua trợ lý AI] …" dưới tên thành viên.
- Nếu chủ tắt nhận tin nhắn riêng, gửi thông báo hệ thống cho chủ.

### 4.7 Dùng lại từ bot Tào

Dùng lại nguyên các phần sau:
- khớp câu mẫu
- guardrail (số tài khoản, số tiền không nguồn)
- che thông tin cá nhân
- khóa theo hội thoại
- gộp tin nhắn liên tiếp
- gợi ý trả lời nhanh
- xử lý hết hạn mức ChatGPT
- job học từ chat: câu học được chờ **chủ cộng đồng** duyệt

Chỉ thay phần dữ liệu, prompt, giới hạn theo mức và cách chuyển người.

### 4.8 Giao diện

**Widget trong trang cộng đồng** (chỉ thành viên thấy):
- Đầu khung: tên bot, nhân cách đang dùng, số tin còn lại hôm nay.
- **VIP:** có menu đổi nhân cách.
- **Thành viên thường:** menu nhân cách khóa 🔒 và dải nâng cấp VIP. Cộng đồng miễn phí thì không hiện dải.
- Widget Tào **ẩn** trong trang cộng đồng để hai widget không chồng nhau.

**Tab "Trợ lý AI" trong Cài đặt cộng đồng:**
- Bật bot. Nếu chưa ở gói Pro thì hiện nhắc nâng cấp.
- Tên bot, lời chào.
- Chọn nhân cách mặc định: thẻ mẫu kèm xem trước câu ví dụ, hoặc "Tự tạo" bằng form có bảng ví dụ Tốt / Lê thê / Cộc.
- Chọn các nhân cách VIP được đổi.
- Hướng dẫn thêm, giới hạn tin/ngày cho thành viên thường và VIP.
- Kho Q&A, tài liệu, câu chờ duyệt, xem hội thoại.
- Nút **"Chat thử"**.

## 5. Thứ tự làm
1. Thêm `communityId` vào các bảng chatbot + bảng mới. Kiểm tra bot Tào vẫn chạy như cũ.
2. Nhân cách có cấu trúc + 4 mẫu. Thêm thời gian và luật "đoán trước" cho Tào.
3. Phân quyền 2 mức + đọc dữ liệu theo quyền + prompt bot cộng đồng.
4. Luồng chat của thành viên + chuyển cho chủ qua Tin nhắn.
5. Phần quản lý của chủ (cài đặt, Q&A, tài liệu, duyệt, xem hội thoại) + job học theo cộng đồng.
6. Giao diện: widget cộng đồng, tab cài đặt.
7. Tài liệu + dữ liệu demo (1 cộng đồng Pro có phí, có bot).

## 6. Kiểm thử

### Test tự động (model giả)

**Phân quyền:**
- Chủ không có Pro → chặn.
- Bot tắt → chặn.
- Người ngoài → chặn.
- Thành viên cộng đồng miễn phí → chat được, mức thường.
- Thành viên trả phí → VIP.
- Mod → VIP.
- Không phải chủ mà bật bot → chặn.

**Hai mức:**
- Thành viên thường: luôn dùng nhân cách mặc định, đổi nhân cách bị chặn, tin thứ 11 trong ngày bị chặn.
- VIP: đổi nhân cách thì prompt đổi giọng; chọn nhân cách ngoài danh sách bị chặn.
- Hết hạn gói → về mức thường.

**Không rò rỉ:**
- Module trả phí chưa mua: nội dung bài **không** có trong prompt gửi AI, chỉ có tên bài và lý do khóa.
- Đã mua: có nội dung.
- Bài nháp, ẩn, đã xóa: không bao giờ có.

**Cô lập:**
- Q&A và tài liệu của cộng đồng A không xuất hiện ở cộng đồng B, cũng không ở bot Tào.
- Hội thoại của Tào và bot cộng đồng tách nhau.

**Chuyển cho chủ:**
- Có tin nhắn tới chủ kèm tóm tắt.
- Chủ tắt nhận tin riêng → có thông báo.

**Toàn bộ test cũ** vẫn pass: bot Tào không đổi hành vi.

### E2E
1. Chủ bật bot và chọn nhân cách mẫu.
2. Thành viên trả phí chat, đổi nhân cách, gửi câu cho chủ.
3. Thành viên thường chat được, thấy nhân cách bị khóa và dải nâng cấp, bị chặn khi hết lượt.

### Model thật
Bộ đo nhỏ cho cộng đồng demo, gồm các tình huống:
- hỏi bài đã mở / đang khóa
- hỏi nội quy, sự kiện
- câu ngoài phạm vi
- đổi nhân cách thì giọng có khác thật không

## 7. Rủi ro & việc cần lưu ý
- **Hạn mức ChatGPT dùng chung:** mọi bot cộng đồng và Tào chạy trên cùng một tài khoản ChatGPT, nên nhiều cộng đồng hoạt động sẽ hết hạn mức nhanh. Giới hạn tin/ngày theo mức thành viên giúp kiểm soát, nhưng lâu dài nên chuyển sang API key hoặc nhiều tài khoản (OPEN_DECISIONS A18).
- **Gói Pro hiện là mô phỏng:** chưa thu tiền thật, hết dùng thử không tự hết hạn. Bot sẽ dựa đúng trạng thái gói hiện có, và tự đúng khi gói Pro được làm thật.
- **Cộng đồng miễn phí:** mọi thành viên ở mức thường và không ai đổi được nhân cách. Đây là hệ quả của định nghĩa VIP = thành viên trả phí.
- **Quyền riêng tư:** chủ cộng đồng xem được hội thoại của thành viên với bot. Cần ghi rõ trong widget ("Chủ cộng đồng có thể xem nội dung trò chuyện với trợ lý").
- **Video và file đính kèm bài học** chưa đọc được nội dung, bot chỉ dùng phần chữ của bài.

## 8. Kết quả triển khai (2026-10-15)

Làm đủ 7 bước của mục 5.

| Phần | Đã làm |
|---|---|
| Dữ liệu | Migration `20261020100000_community_chatbot`: thêm `communityId` cho Q&A / tài liệu / hội thoại (bot Tào lọc "không thuộc cộng đồng"); bảng `CommunityBot`, `CommunityBotMemberPref`; tìm kiếm toàn văn bài học + sự kiện |
| Nhân cách | `chatbot.persona.ts`: 4 mẫu (mentor, buddy, coach, concise) đủ bảng ví dụ Tốt / Lê thê / Cộc + nhân cách tự tạo; dòng thời gian VN đầu prompt. Bot Tào cũng có thêm thời gian + luật "đoán trước, hỏi sau" |
| Phân quyền 2 mức | Gói Pro (dùng thử còn hạn hoặc active) mới bật được; mọi thành viên chat; VIP = trả phí còn hạn (mod+ luôn VIP) |
| Không lộ bài khóa | Lớp học có hàm mới `lessonAccess` dùng **chính** logic khóa của lớp học; bài chưa mở chỉ có tên + cách mở |
| Chuyển cho chủ | Bot đề nghị → thành viên bấm → Tin nhắn riêng tới chủ (chủ tắt tin riêng → thông báo) |
| Quản lý | Tab "Trợ lý AI" trong Cài đặt cộng đồng: bật (chủ + Pro), tên, lời chào, chọn nhân cách (thẻ mẫu có câu xem trước / form tự tạo), nhân cách VIP được đổi, giới hạn tin/ngày, Q&A, tài liệu, câu học được chờ duyệt, xem hội thoại |
| Widget | Trong trang cộng đồng: tên bot, nhân cách (VIP đổi được / thường 🔒), số lượt còn lại, dải nâng cấp VIP (cộng đồng có phí), gợi ý trả lời nhanh, gộp tin nhắn liên tiếp. Tào tự ẩn khi cộng đồng có bot riêng |
| Demo | `paid-demo` (member1 VIP), `photo` (member2 thường) bật bot; `yt` không bật (vẫn có Tào) |

### Kiểm thử

| Loại | Kết quả |
|---|---|
| Test backend (`npm test`) | Toàn bộ pass, gồm 8 test mới `community-bot.test.ts`: phân quyền Pro, 2 mức, **không rò rỉ bài trả phí / nháp / ẩn** (dò nguyên văn prompt), cô lập dữ liệu giữa các cộng đồng và với Tào, chuyển chủ, nhân cách tự tạo, học → chủ duyệt |
| E2E | 12/12: 8 bot Tào + 4 bot cộng đồng (VIP đổi nhân cách + câu mẫu + gửi cho chủ; thường bị khóa nhân cách; cộng đồng không bật vẫn có Tào; tab cài đặt) |
| Model thật (4 câu, `paid-demo`) | Liệt kê đúng lộ trình, module khóa chỉ nói cách mở; từ chối câu ngoài phạm vi; thiếu nội quy → nói thẳng + đề nghị gửi chủ; hỏi số tài khoản → chỉ VietQR + đọc đúng ngày gia hạn gói của chính người hỏi |

### Việc còn lại / lưu ý
- Chưa có bộ đo chất lượng riêng cho bot cộng đồng với model thật; mới thử tay 4 câu.
- Các rủi ro ở mục 7 vẫn còn nguyên: hạn mức ChatGPT dùng chung, gói Pro đang là mô phỏng, quyền riêng tư, chưa đọc được video/file.

