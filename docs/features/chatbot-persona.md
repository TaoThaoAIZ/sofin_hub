# Nhân cách (persona) của trợ lý AI cộng đồng

Code: `backend/src/modules/chatbot/chatbot.persona.ts`. Chủ cấu hình: **Cài đặt > Trợ lý AI**.

## Nguyên tắc thiết kế (từ nghiên cứu / hướng dẫn)

| Nguyên tắc | Áp dụng |
|---|---|
| Persona chủ yếu đổi **giọng / đặc điểm câu trả lời**, không làm model giỏi hơn; vai chuyên gia tăng độ sâu nhưng giảm độ rõ ([arXiv 2605.29420](https://arxiv.org/pdf/2605.29420)) | Persona chỉ quyết định cách nói; dữ liệu trả lời lấy từ ngữ cảnh. Dặn thêm "rõ ràng quan trọng hơn văn hoa". |
| Chi tiết persona **không liên quan** tới nhiệm vụ có thể làm kết quả giảm gần 30 điểm ([Principled Personas, EMNLP 2025](https://preview.aclanthology.org/setup/2025.emnlp-main.1364)) | Không có tuổi/sở thích/tiểu sử. `bestFor` (hợp với cộng đồng nào) chỉ hiện cho chủ, **không** vào prompt. |
| 4-6 nét tính cách cốt lõi; kiểm tra "persona này sẽ nói gì trong tình huống X" ([Google conversation design](https://developers.google.com/assistant/conversation-design/create-a-persona)) — nhiều trait làm giọng thiếu ổn định | `traits` tối đa 5; mỗi mẫu 3-4 trait. |
| Quy tắc hành vi rõ ràng (làm gì, từ chối gì, xử lý người dùng bực) giúp nhất quán; thử với câu khó và người dùng bực ([livechatai](https://livechatai.com/blog/chatbot-persona)) | `playbook`: 9 tình huống (giải thích, bài tập, làm sai, nản/bực, làm tốt, bài khóa, không có thông tin, ngoài phạm vi, kết thúc). |
| Dạy kiểu gợi mở (Socratic) giúp hiểu sâu hơn nhưng người học thấy kém hiệu quả; LLM mặc định thiên về đưa đáp án ([arXiv 2512.03501](https://arxiv.org/pdf/2512.03501), [arXiv 2607.03303](https://arxiv.org/pdf/2607.03303)) | `teaching`: đưa lời giải / gợi ý trước / hỏi gợi mở — **chỉ áp cho bài tập**; câu tra cứu luôn trả lời thẳng; gợi mở tối đa 2 lượt rồi đưa lời giải. |
| Đặt vai trò trong system prompt; vai trò hợp nhiệm vụ giúp tập trung ([Anthropic: Give Claude a role](https://docs.anthropic.com/claude/docs/give-claude-a-role)) | Thứ tự prompt: thời gian VN → luật khung → persona → hướng dẫn của chủ → ngữ cảnh. |

## Cấu trúc một nhân cách

`label`, `bestFor` (chỉ cho chủ), `identity`, `traits[≤5]`, xưng hô (`selfPronoun`, `userPronoun`), `tone`, `formality`, `verbosity`, `emoji`, `teaching`, `particles`, `clarify`, `smallTalk`, `playbook{9 tình huống}`, `doList[≤8]`, `avoidList[≤8]`, `styleExamples[≤8]` (Tốt / Quá lê thê / Quá cộc). Trường mới đều có default — nhân cách tự tạo lưu từ bản cũ vẫn dùng được.

## 6 nhân cách mẫu

| Khóa | Tên | Hợp với | Cách dạy |
|---|---|---|---|
| `mentor` | Thầy/cô tận tâm | Khóa kỹ năng/kiến thức cần giải thích kỹ, người mới | Gợi ý trước |
| `buddy` | Bạn đồng hành vui vẻ | Cộng đồng sở thích, thử thách, người học trẻ | Gợi ý trước |
| `coach` | Huấn luyện viên thẳng thắn | Lộ trình / thử thách có mục tiêu | Hỏi gợi mở |
| `concise` | Trợ lý ngắn gọn | Cộng đồng đông, chủ yếu hỏi tra cứu | Đưa lời giải |
| `polite` | Trợ lý lễ phép | Khóa trả phí, học viên đa độ tuổi | Đưa lời giải |
| `expert` | Chuyên gia chuẩn mực | Lĩnh vực cần chính xác (đầu tư, kỹ thuật…) | Đưa lời giải |

## Chi phí

Khối nhân cách mẫu dài khoảng 2.700-4.300 ký tự (~0,9-1,4 nghìn token), gửi kèm mọi câu hỏi. "Xem trợ lý được dặn gì" trong Cài đặt hiện đúng khối này.

## Kiểm thử

- `backend/tests/community-bot.test.ts`: 6 mẫu đủ trait/playbook/bestFor; xem trước có tính cách, tình huống, phạm vi cách dạy; `bestFor` không vào prompt; nhân cách tự viết có nội dung cấm => 400 `PERSONA_REJECTED`; JSON cũ đọc được.
- Thử thật (paid-demo, mentor): người học nản => ghi nhận + 1 bước nhỏ kèm link bài; hỏi lịch => trả lời thẳng có ngày giờ; ngoài phạm vi => từ chối 1 câu.
