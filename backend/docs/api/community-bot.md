# Chatbot riêng của cộng đồng — API

> Kế hoạch & quyết định: `chatbot.md` (gốc repo). Bot hỗ trợ nền tảng "Tào": `docs/api/chatbot.md`. Mã: `src/modules/community-bot/*`,
> dùng chung lõi `src/modules/chatbot/*` (Codex, guardrail, khớp câu mẫu, khóa hội thoại, persona).

## Điều kiện & 2 mức thành viên

- **Bật bot:** chỉ chủ cộng đồng (hoặc Platform Admin), và chỉ khi cộng đồng ở gói **Pro**: `HostingPlan.planKey='pro'` với `status=active`, hoặc `trialing` còn hạn `trialEndsAt` (`communityIsPro`). Pro hết hạn ⇒ bot ngừng (`COMMUNITY_NOT_PRO`) dù vẫn đang bật.
- **Chat:** mọi thành viên của cộng đồng (`getRole` khác null, bị cấm = không). Người ngoài ⇒ `NOT_MEMBER`.

| | Thường (`free`) | VIP (`vip`) |
|---|---|---|
| Ai | Thành viên còn lại | Có gói trả phí còn hạn (`paymentsService.hasLiveSubscription`), hoặc mod trở lên |
| Nhân cách | Mặc định của chủ | Tự chọn trong `memberPersonaKeys` (`PUT my-persona`); hết VIP ⇒ về mặc định |
| Tin/ngày (24h trượt, theo cộng đồng) | `freeDailyMessages` (mặc định 10) | `vipDailyMessages` (mặc định 100) |
| Trích bài học đã mở | ~400 ký tự/bài | ~1.500 ký tự/bài |
| Lịch sử chat đưa vào prompt | 4 tin | 12 tin |

## Dữ liệu bot đọc (`community-bot.context.ts`)

Bot chỉ đọc dữ liệu của cộng đồng đó, theo quyền của chính người hỏi.

- **Giới thiệu**: title, description, promise, benefits, rules, giảng viên, giá.
- **Q&A và tài liệu riêng**: `ChatbotQA` / `ChatbotDocument` có `courseId` = cộng đồng (cột `communityId`).
  - Khớp câu mẫu (similarity ≥ `directThreshold` của cài đặt Tào) ⇒ trả nguyên câu, không gọi AI.
- **Bài học**:
  - Tìm toàn văn trên `ClassroomLesson.searchVector` (top 5).
  - Kết quả **lọc qua `classroomService.lessonAccess`**, tức chính `state()` của lớp học: khóa thứ tự, level, trả phí, chỉ định, học tuần tự, nháp/ẩn/gỡ.
  - Bài chưa mở chỉ có tên + `howToUnlock`, **không bao giờ có nội dung**.
  - `curriculum` = tên module + số bài + khóa/mở (trả lời câu hỏi kiểu "lộ trình").
- **Bài đăng**: tìm toàn văn, bỏ bài `hidden` / `removedAt`.
- **Sự kiện**: 5 sự kiện sắp tới + tìm toàn văn (`CommunityEvent.searchVector`), bỏ sự kiện đã gỡ.
- **Gói của chính người hỏi**: chỉ khi câu hỏi nhắc thanh toán (`isPaymentTopic`).
- **Lưu vết**: `ChatbotMessage.toolCalls` có `{name:'persona', key, tier}` và `{name:'sources', qaIds, chunkIds, lessonIds, lockedLessonIds, postIds, eventIds}`. Bật `CHATBOT_TRACE_CONTEXT` (chỉ test) thì có thêm `_trace` (nguyên văn prompt).

## Prompt (`community-bot.prompt.ts`)

**Thứ tự** (học từ taothaoclaw):
1. `[Bây giờ là HH:mm <thứ> dd/MM/yyyy (giờ Việt Nam)]`
2. Luật khung (khóa cứng)
3. Persona (`renderPersona`: xưng hô, giọng, emoji, cách hỏi lại, nói chuyện phiếm, bảng ví dụ Tốt / Quá lê thê / Quá cộc)
4. Hướng dẫn thêm của chủ
5. `<context>`
6. Lịch sử
7. Tin khách

**Luật chính:**
- Chỉ trong phạm vi cộng đồng.
- Không bịa; con số chép đúng từ `<context>`.
- **Không tiết lộ bài khóa.**
- Không đưa số tài khoản (chỉ VietQR).
- Đoán trước, hỏi sau (hỏi lại thì kèm `suggestions`).
- Dùng thời gian tuyệt đối.
- Văn bản thuần, không markdown đậm/nghiêng.
- `handoff=true` ⇒ đề nghị gửi câu hỏi cho chủ.

Persona mẫu (`chatbot.persona.ts` `PERSONA_PRESETS`): `mentor`, `buddy`, `coach`, `concise`, `polite` (Trợ lý lễ phép, em – anh/chị), `expert` (Chuyên gia chuẩn mực). Khóa cũ giữ nguyên, chỉ thêm mới. `custom` = `CommunityBot.customPersona` (validate `personaSchema`).

`personaSchema`: `label, identity, selfPronoun, userPronoun, tone, formality (casual|friendly|polite|formal), verbosity (short|medium|detailed), emoji (none|light|lively), particles, clarify, smallTalk, doList[≤8], avoidList[≤8], styleExamples[≤8]`. Trường mới đều có default => `customPersona` lưu từ bản cũ vẫn đọc được (GET `/settings` trả đủ trường). `renderPersona` dịch các nút chọn thành chỉ dẫn cụ thể (số câu, từ đệm, số emoji…), bảng ví dụ bỏ cột "tránh" khi không có.
Nhân cách tự viết được lọc bằng `moderate()` (như tin nhắn khách) khi lưu và khi xem trước ⇒ 400 `PERSONA_REJECTED` `details.field` (vd chứa "bỏ qua mọi quy tắc").

## Endpoint thành viên

Tất cả ở `/communities/:id/bot/*` (alias của `/courses/:id/bot/*`) và cần đăng nhập.

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/status` | `{available:false, reason}` hoặc `{available:true, botName, welcomeText, tier, persona:{key,label}, defaultPersonaKey, personas[], canChoosePersona, upgradeAvailable, quota:{tier,limit,used,remaining}, maxInputChars}` |
| GET | `/conversations/current` | Hội thoại đang mở (24h) với bot **của cộng đồng này** (tách khỏi Tào) |
| POST | `/conversations` | 201 |
| POST | `/conversations/:cid/messages` | `{text}`. `Accept: text/event-stream` ⇒ SSE `delta`/`done`/`error`, giống Tào. `done` = `{message, conversation, handoffOffer:{reason}\|null, suggestions[], quota}` |
| POST | `/conversations/:cid/handoff` | Thành viên bấm "Gửi câu hỏi cho chủ cộng đồng" (chi tiết bên dưới) |
| POST | `/messages/:mid/feedback` | `{value:-1\|0\|1}` |
| PUT | `/my-persona` | `{personaKey\|null}`. Thường ⇒ 402 `VIP_REQUIRED`; ngoài danh sách ⇒ 400; `null` hoặc khóa mặc định ⇒ về mặc định. Trả lại `status` |
| GET | `/chatbot/personas` | Danh sách nhân cách mẫu (không theo cộng đồng) |

**Chi tiết `/conversations/:cid/handoff`:**
- Mở Tin nhắn riêng thành viên ↔ chủ và gửi tóm tắt dưới tên thành viên: `[Hỏi qua trợ lý AI của cộng đồng "…"]` + 3 câu hỏi gần nhất, bỏ tin có thông tin cá nhân.
- Chủ tắt nhận tin riêng hoặc đã chặn ⇒ gửi thông báo `system` cho chủ.
- Trả `{via:'message'\|'notification', messageConversationId}`; hội thoại chuyển sang `handed_off`.

**Lỗi trước khi stream** (JSON):

| HTTP | Mã | Khi nào |
|---|---|---|
| 404 | — | Cộng đồng hoặc hội thoại không tồn tại |
| 403 | `COMMUNITY_LOCKED` | Cộng đồng bị khóa |
| 403 | `COMMUNITY_NOT_PRO` | Cộng đồng không còn gói Pro |
| 403 | `NOT_MEMBER` | Không phải thành viên, hoặc bị cấm |
| 503 | `BOT_DISABLED` | Bot đang tắt |
| 503 | `BOT_UNAVAILABLE` | Codex chưa đăng nhập. Tắt bot Tào ở admin **không** tắt bot cộng đồng |
| 409 | `CHATBOT_BUSY` | Đang trả lời tin trước (khóa theo hội thoại) |
| 429 | `DAILY_LIMIT` | Hết lượt hôm nay; `details:{tier, limit}` để widget hiện nhắc nâng cấp hoặc "quay lại mai" |

## Endpoint chủ / admin cộng đồng

Admin trở lên; bật/tắt bot chỉ chủ.

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/settings` | `{settings, isPro, canToggle, presets[], stats:{qa, documents, conversations7d, handoffs7d}}` |
| POST | `/persona-preview` | `{ personaKey, customPersona?, botName? }` ⇒ `{ text }` = khối "Giọng nói" bot sẽ nhận (không lưu). Admin trở lên; nội dung bị cấm ⇒ 400 `PERSONA_REJECTED` |
| PATCH | `/settings` | `enabled, botName, welcomeText, personaKey, customPersona, memberPersonaKeys, extraInstructions, freeDailyMessages, vipDailyMessages` (strict). `enabled` do người khác chủ gửi ⇒ 403; bật khi không Pro ⇒ 403 `COMMUNITY_NOT_PRO`; chọn `custom` khi chưa có `customPersona` ⇒ 400 |
| GET/POST | `/qa` | `?status=active\|candidate…`; POST `{question, answer, variants?}` ⇒ active |
| PATCH/DELETE | `/qa/:qid` | Sửa / duyệt (`status:'active'`) / từ chối (`'rejected'`) / lưu trữ; câu khác cộng đồng ⇒ 404 |
| GET/POST | `/docs`, GET/PATCH `/docs/:did` | Markdown cắt theo `##`. Slug nội bộ `c-<communityId>-<random>`; tối đa 50 tài liệu/cộng đồng |
| GET | `/conversations`, `/conversations/:cid/detail` | Chủ/admin xem hội thoại; tin có thông tin cá nhân được đánh dấu `redacted`. Widget ghi rõ "Chủ cộng đồng có thể xem…" |

## Học từ chat

Job `chatbot.learn` xử lý cả hội thoại của cộng đồng. Câu học được thành `candidate` có `communityId` của hội thoại, và chờ **chủ cộng đồng** duyệt ở tab "Trợ lý AI". Khử trùng chỉ trong kho của chính cộng đồng.

## Dữ liệu (migration `20261020100000_community_chatbot`)

- `ChatbotQA` / `ChatbotDocument` / `ChatbotConversation` thêm `courseId` (null = Tào). **Mọi truy vấn của Tào lọc `courseId IS NULL`.**
- Bảng mới:
  - `CommunityBot`: 1 hàng/cộng đồng.
  - `CommunityBotMemberPref`: nhân cách VIP tự chọn.
- Cột generated `searchVector` + GIN cho `ClassroomLesson` (title A + body B) và `CommunityEvent` (title A + description B).
- Dữ liệu demo (`prisma/seed/community-bot.ts`):
  - `paid-demo` (có phí, member1 VIP) và `photo` (miễn phí, member2 thường) được bật bot, gói Pro dùng thử.
  - `yt` không bật bot ⇒ trong trang cộng đồng `yt` vẫn hiện Tào.

## Giao diện

- `CommunityBotWidget` được gắn trong `CommunityPage`, chỉ thành viên thấy.
- Widget Tào **ẩn** trên trang cộng đồng khi bot của cộng đồng đó đang dùng được, để hai widget không chồng nhau.
- Hàng chờ gộp tin nhắn dùng chung: `features/chatbot/useMessageQueue.ts`.
- Tab "Trợ lý AI" trong Cài đặt cộng đồng: `features/community-bot/ChatbotSettingsTab.tsx`.

## Kiểm thử

| Loại | Phạm vi |
|---|---|
| `tests/community-bot.test.ts` (8, model giả) | Gói Pro/quyền bật; 2 mức (402, 429, đổi nhân cách, hết hạn gói ⇒ về thường, mod VIP); **không rò rỉ bài khóa / nháp / ẩn** (dò `_trace`); cô lập Q&A và hội thoại giữa cộng đồng ↔ cộng đồng ↔ Tào; chuyển chủ (DM / thông báo); nhân cách tự tạo, tài liệu riêng, học ⇒ chủ duyệt |
| `e2e/tests/06-community-bot.spec.ts` (4) | VIP đổi nhân cách + câu mẫu + gửi cho chủ; thành viên thường bị khóa nhân cách; cộng đồng không bật bot vẫn có Tào; tab cài đặt |

**Bài đăng trong ngữ cảnh** (`community-bot.context.ts` `relevantPostIds` + `postViews`, tối đa 8 bài, chỉ bài không ẩn / không bị gỡ):
gộp theo thứ tự ưu tiên — bài đăng đúng NGÀY được nhắc trong câu hỏi (`mentionedDays`: "13/10", "13/10/2026", giờ VN; ngày ở tương lai => năm trước) → bài có bình chọn (khi hỏi "vote / bình chọn / khảo sát…") → bài khớp chữ (full-text) → bài đang ghim → bài mới nhất.
Mỗi bài: `content` (≤600 ký tự), tác giả, thời gian, mục, `pinned`, like/bình luận, `link`; bài có bình chọn kèm `poll { question, options[{text, votes, percent}], voters, leading[], multiple, closesAt, closed }` (`leading` nhiều mục = đang hòa, [] = chưa ai bình chọn).

