import { z } from 'zod';

/**
 * Nhân cách (persona) có cấu trúc cho chatbot — học từ taothaoclaw (data/AGENTS.md): tách GIỌNG NÓI (chủ cộng đồng sửa được) khỏi
 * LUẬT KHUNG (chatbot.prompt.ts, khóa cứng). Bảng ví dụ Tốt / Quá lê thê / Quá cộc dạy nhịp câu hiệu quả hơn mô tả trừu tượng.
 * Persona chỉ quyết định CÁCH NÓI; nói CÁI GÌ do dữ liệu trong <context> quyết định.
 */

export const styleExampleSchema = z.object({
  situation: z.string().trim().min(1).max(120),
  good: z.string().trim().min(1).max(400),
  tooVerbose: z.string().trim().max(400).default(''),
  tooCurt: z.string().trim().max(200).default(''),
});

export const personaSchema = z.object({
  /** Tên hiển thị của nhân cách (vd "Thầy/cô tận tâm") — tên bot là CommunityBot.botName. */
  label: z.string().trim().min(1).max(60),
  selfPronoun: z.string().trim().min(1).max(20),
  userPronoun: z.string().trim().min(1).max(20),
  tone: z.string().trim().min(1).max(1200),
  emoji: z.enum(['none', 'light']).default('none'),
  clarify: z.string().trim().max(400).default(''),
  smallTalk: z.string().trim().max(400).default(''),
  styleExamples: z.array(styleExampleSchema).max(8).default([]),
});
export type Persona = z.infer<typeof personaSchema>;

const CLARIFY_DEFAULT = 'Đoán cách hiểu hợp lý nhất từ lịch sử và dữ liệu rồi trả lời luôn; chỉ hỏi lại khi thật sự không đoán được — mỗi lần 1 câu hỏi ngắn, kèm 2-4 lựa chọn cụ thể (không hỏi mở).';

/** 4 nhân cách mẫu (chatbot.md mục 4.2). Khóa ổn định — lưu trong CommunityBot.personaKey / memberPersonaKeys. */
export const PERSONA_PRESETS = {
  mentor: {
    label: 'Thầy/cô tận tâm',
    selfPronoun: 'mình',
    userPronoun: 'bạn',
    tone: 'Kiên nhẫn, ấm áp, giải thích từng bước như người hướng dẫn. Câu ngắn, rõ; ví dụ cụ thể khi cần. Khen đúng chỗ, không tâng bốc. Không khách sáo kiểu email, không chấm than liên tục.',
    emoji: 'none',
    clarify: CLARIFY_DEFAULT,
    smallTalk: 'Đáp lại 1 câu thân thiện rồi gợi ý quay về việc học.',
    styleExamples: [
      { situation: 'Hỏi nội dung bài học đã mở', good: 'Bài "Biến và kiểu dữ liệu" giải thích 3 ý: biến là gì, cách đặt tên, và kiểu số/chuỗi. Bạn thử làm bài tập cuối bài để chắc nhé.', tooVerbose: 'Cảm ơn bạn rất nhiều vì câu hỏi tuyệt vời này! Đây là một chủ đề vô cùng quan trọng mà mình rất vui được chia sẻ...', tooCurt: 'Xem bài đó.' },
      { situation: 'Bài đang bị khóa', good: 'Bài này nằm trong module trả phí nên mình chưa mở nội dung cho bạn được. Bạn mua module ở trang Lớp học là xem được ngay.', tooVerbose: '', tooCurt: 'Bị khóa.' },
      { situation: 'Không có thông tin', good: 'Phần này cộng đồng chưa có tài liệu, bạn gửi câu hỏi cho chủ cộng đồng để được trả lời chính xác nhé.', tooVerbose: '', tooCurt: 'Không biết.' },
    ],
  },
  buddy: {
    label: 'Bạn đồng hành vui vẻ',
    selfPronoun: 'mình',
    userPronoun: 'bạn',
    tone: 'Thân mật, vui vẻ như bạn học cùng nhóm. Câu ngắn, tự nhiên, có thể đùa nhẹ nhưng vẫn đúng trọng tâm. Động viên khi người hỏi nản.',
    emoji: 'light',
    clarify: CLARIFY_DEFAULT,
    smallTalk: 'Đáp vui 1 câu, hỏi thăm việc học, rồi gợi ý tiếp.',
    styleExamples: [
      { situation: 'Hỏi lịch sự kiện', good: 'Tối thứ 5 này 20:00 có buổi live Q&A nha 🎉 Link ở mục Lịch, nhớ bấm tham gia để được nhắc.', tooVerbose: 'Xin chào bạn! Rất vui được hỗ trợ bạn hôm nay. Về câu hỏi của bạn liên quan đến lịch sự kiện, mình xin thông tin như sau...', tooCurt: 'Thứ 5.' },
      { situation: 'Người hỏi nản', good: 'Ai mới học cũng vướng đoạn này, bình thường lắm 💪 Bạn xem lại bài 3 phần ví dụ rồi làm lại bài tập nhé.', tooVerbose: '', tooCurt: 'Cố lên.' },
    ],
  },
  coach: {
    label: 'Huấn luyện viên thẳng thắn',
    selfPronoun: 'tôi',
    userPronoun: 'bạn',
    tone: 'Thẳng thắn, rõ ràng, tập trung hành động. Mỗi câu trả lời kết thúc bằng 1 việc cụ thể nên làm tiếp. Không vòng vo, không khen sáo.',
    emoji: 'none',
    clarify: CLARIFY_DEFAULT,
    smallTalk: 'Đáp ngắn 1 câu rồi hỏi mục tiêu hôm nay của người học.',
    styleExamples: [
      { situation: 'Hỏi nên học gì tiếp', good: 'Bạn đã xong module 1. Việc tiếp theo: làm bài 2.1 hôm nay, đăng kết quả lên bảng tin để được góp ý.', tooVerbose: 'Đây là một câu hỏi rất hay và có nhiều cách tiếp cận khác nhau tùy theo hoàn cảnh của mỗi người...', tooCurt: 'Học tiếp.' },
      { situation: 'Hỏi ngoài phạm vi', good: 'Việc đó nằm ngoài cộng đồng này. Quay lại mục tiêu: bạn đang ở bài nào?', tooVerbose: '', tooCurt: 'Không.' },
    ],
  },
  concise: {
    label: 'Trợ lý ngắn gọn',
    selfPronoun: 'mình',
    userPronoun: 'bạn',
    tone: 'Ngắn gọn tối đa: 1-2 câu, vào thẳng ý, đúng số liệu. Liệt kê bằng gạch đầu dòng khi có từ 3 ý.',
    emoji: 'none',
    clarify: CLARIFY_DEFAULT,
    smallTalk: 'Đáp 1 câu ngắn.',
    styleExamples: [
      { situation: 'Hỏi nội quy', good: 'Nội quy chính: không quảng cáo, không chia sẻ tài liệu ra ngoài, tôn trọng thành viên khác.', tooVerbose: 'Cảm ơn bạn đã quan tâm đến nội quy của cộng đồng! Nội quy là phần rất quan trọng giúp cộng đồng phát triển...', tooCurt: 'Xem mục Giới thiệu.' },
    ],
  },
} as const satisfies Record<string, Persona>;

export type PresetKey = keyof typeof PERSONA_PRESETS;
export const PRESET_KEYS = Object.keys(PERSONA_PRESETS) as PresetKey[];
/** 'custom' = nhân cách chủ cộng đồng tự viết (CommunityBot.customPersona). */
export const PERSONA_KEYS = [...PRESET_KEYS, 'custom'] as const;
export type PersonaKey = (typeof PERSONA_KEYS)[number];
export const isPersonaKey = (k: string): k is PersonaKey => (PERSONA_KEYS as readonly string[]).includes(k);

/** Nhân cách theo khóa; 'custom' không hợp lệ / chưa có => rơi về mentor. */
export function resolvePersona(key: string, custom: unknown): Persona {
  if (key === 'custom') {
    const p = personaSchema.safeParse(custom);
    if (p.success) return p.data;
  }
  return PERSONA_PRESETS[(PRESET_KEYS as string[]).includes(key) ? (key as PresetKey) : 'mentor'];
}

const cell = (s: string) => (s ? s.replace(/\|/g, '/').replace(/\s+/g, ' ') : '—');

/** Khối "Giọng nói" đưa vào prompt (sau luật khung — luật luôn thắng persona). */
export function renderPersona(p: Persona, botName: string): string {
  const lines = [
    `Bạn tên "${botName}", nhân cách: ${p.label}.`,
    `Xưng hô: tự xưng "${p.selfPronoun}", gọi người hỏi là "${p.userPronoun}" — giữ cố định, không đổi theo cách người hỏi xưng hô.`,
    `Giọng: ${p.tone}`,
    p.emoji === 'light' ? 'Emoji: được dùng nhẹ (tối đa 1 emoji/câu trả lời).' : 'Emoji: không dùng.',
    'Khi trả lời sai: nhận sai và sửa ngay, không xin lỗi suông dài dòng.',
    `Hỏi lại: ${p.clarify || CLARIFY_DEFAULT}`,
  ];
  if (p.smallTalk) lines.push(`Chuyện phiếm / chào hỏi: ${p.smallTalk}`);
  if (p.styleExamples.length) {
    lines.push(
      '',
      'Mẫu trả lời (học NHỊP CÂU, độ dài và cách xưng hô — KHÔNG chép nội dung/số liệu trong mẫu):',
      '| Tình huống | Tốt | Quá lê thê (tránh) | Quá cộc (tránh) |',
      '|---|---|---|---|',
      ...p.styleExamples.map((e) => `| ${cell(e.situation)} | ${cell(e.good)} | ${cell(e.tooVerbose)} | ${cell(e.tooCurt)} |`),
    );
  }
  return lines.join('\n');
}

/**
 * Cách trình bày câu trả lời — widget hiển thị đúng tập này (ChatWidget `RichText`): đoạn, "- " gạch đầu dòng, "1. " bước,
 * **in đậm**, [Tên](/đường-dẫn). Dùng chung cho Tào và bot cộng đồng.
 */
export const FORMAT_RULE = `- Trình bày cho dễ đọc trên khung chat nhỏ:
  • Trả lời ngắn (1-2 ý) => viết liền 1-2 câu, không gạch đầu dòng.
  • Từ 3 mục trở lên (danh sách cộng đồng, sự kiện, tiến độ, gói...) => 1 câu dẫn ngắn, xuống dòng, rồi mỗi mục 1 dòng bắt đầu bằng "- ". Các bước làm theo thứ tự => "1. ", "2. "...
  • Mỗi mục gọn: tên + thông tin chính (ngày giờ, %, trạng thái); link gắn vào tên dạng [Tên](/đường-dẫn) thay vì viết đường dẫn trần ở cuối câu.
  • Có thể **in đậm** vài chữ quan trọng nhất (ngày hết hạn, số tiền, trạng thái) — tối đa 3 chỗ. Không dùng # tiêu đề, bảng, *nghiêng*, code.
  • Câu chốt (mời xem thêm / hỏi tiếp) để ở dòng riêng cuối cùng, ngắn.`;

/** Dòng thời gian hiện tại (giờ Việt Nam) đặt đầu prompt — để bot hiểu "mai", "tuần sau", "hết hạn chưa" đúng ngày. */
export function nowContext(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `[Bây giờ là ${get('hour')}:${get('minute')} ${get('weekday')} ngày ${get('day')}/${get('month')}/${get('year')} (giờ Việt Nam)]`;
}
