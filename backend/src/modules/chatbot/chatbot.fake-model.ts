import { normalizeText } from '../search/search.text.js';
import type { CommunityContext } from '../community-bot/community-bot.context.js';
import type { KnowledgeContext } from './chatbot.context.js';
import type { ChatLlm, LlmRequest, LlmUsage } from './chatbot.llm.js';
import type { AnswerOutput } from './chatbot.prompt.js';

/**
 * Model GIẢ cho test / E2E / dev chưa đăng nhập ChatGPT (bật bằng CHATBOT_FAKE_MODEL=1; production bị env-guard chặn).
 * Không gọi mạng, không chạy codex. Dựng câu trả lời xác định từ ngữ cảnh có cấu trúc (`hint`) theo từ khóa:
 *  - lạc đề nếu tin có "thơ|code|toán|bài tập|poem"; injection nếu "bỏ qua|ignore|system prompt";
 *  - chuyển người nếu "gặp nhân viên|zalo|hoàn tiền|khiếu nại";
 *  - còn lại lấy từ thanh toán / số liệu nền tảng / tool / tài liệu / câu mẫu / cộng đồng.
 * Test ép câu trả lời bằng setFakeReply(), ép kết quả học bằng setFakeLearn().
 */
let replyOverride: ((userText: string) => string) | null = null;
let learnOverride: ((transcript: string) => unknown) | null = null;
/** Độ trễ giả lập mỗi lượt trả lời (test khách gửi liên tục khi bot đang xử lý). */
let answerDelayMs = 0;
export const fakeCalls: { kind: 'answer' | 'learn'; input: string }[] = [];

export function setFakeReply(fn: ((userText: string) => string) | null) {
  replyOverride = fn;
}
export function setFakeLearn(fn: ((transcript: string) => unknown) | null) {
  learnOverride = fn;
}
export function setFakeDelay(ms: number) {
  answerDelayMs = ms;
}
export function resetFake() {
  answerDelayMs = 0;
  replyOverride = null;
  learnOverride = null;
  fakeCalls.length = 0;
}

const USAGE: LlmUsage = { tokensIn: 10, tokensOut: 20 };

function answer(message: string, c: KnowledgeContext): AnswerOutput {
  const t = normalizeText(message);
  const base: AnswerOutput = { onTopic: true, injection: false, reply: '', handoff: false, handoffCategory: 'user', handoffReason: '', toolIds: [], usedSampleId: '', suggestions: [] };
  if (/\b(tho|code|toan|bai tap|poem)\b/.test(t)) return { ...base, onTopic: false, reply: 'dạ Tào chỉ hỗ trợ về SofinHub thôi ạ' };
  if (/bo qua|ignore|system prompt/.test(t)) return { ...base, injection: true, reply: 'dạ Tào chỉ hỗ trợ về SofinHub thôi ạ' };
  if (replyOverride) return { ...base, reply: replyOverride(message) };
  if (/gap nhan vien|gap nguoi|zalo|hoan tien|khieu nai/.test(t)) {
    return { ...base, handoff: true, handoffCategory: /hoan tien/.test(t) ? 'payment' : 'user', handoffReason: message.slice(0, 200), reply: 'dạ để Tào chuyển người hỗ trợ cho bạn nha' };
  }
  if (/don cua toi|thanh toan cua toi|nhan tien chua|giao dich cua toi/.test(t)) {
    const p = c.myPayments?.[0];
    return { ...base, reply: p ? `dạ giao dịch ${p.amount} cho ${p.community} ${p.status} ạ` : 'dạ bạn chưa có giao dịch nào ạ' };
  }
  if (/thoi han hoan|phi nen tang|hoa hong|chu ky/.test(t)) return { ...base, reply: `dạ thời hạn hoàn tiền là ${String(c.platformFacts.refundWindowDays)} ngày ạ` };
  if (/\btool\b/.test(t)) {
    const hit = c.tools.find((x) => normalizeText(x.name).split(/\W+/).some((w) => w.length > 3 && w !== 'tool' && t.includes(w))) ?? c.tools[0];
    if (hit) return { ...base, reply: `dạ ${hit.name}: ${hit.description.split('.')[0]} ạ, bạn xem ở trang /tools nha`, toolIds: [hit.id] };
  }
  // Hỏi chung về khóa học => hỏi lại chủ đề + gợi ý (giống luật trong prompt).
  if (c.categories.length && !c.communities.length) {
    return { ...base, reply: 'dạ bạn quan tâm chủ đề nào ạ, Tào gợi ý khóa học phù hợp nha. Bạn cũng xem toàn bộ ở trang /explore ạ', suggestions: c.categories.slice(0, 4).map((x) => x.name) };
  }
  if (/loi|bi chan|unusual|cookie|vpn|ngan luong|429|credit/.test(t) && c.documents[0]) return { ...base, reply: `dạ ${c.documents[0].content.split('\n')[0]}` };
  // Khách bấm gợi ý chủ đề (tin ngắn) => giới thiệu khóa học của chủ đề đó.
  if (c.communities[0] && t.split(/\s+/).length <= 4) return { ...base, reply: `dạ bạn xem khóa học ${c.communities[0].title} ở ${c.communities[0].link} nha` };
  if (c.sampleAnswers[0]) return { ...base, reply: c.sampleAnswers[0].answer, usedSampleId: c.sampleAnswers[0].id };
  if (c.communities[0]) return { ...base, reply: `dạ bạn xem cộng đồng ${c.communities[0].title} ở ${c.communities[0].link} nha` };
  return { ...base, reply: 'dạ Tào chưa có thông tin chính xác ạ, bạn nhắn Zalo hỗ trợ để được giúp nha', handoff: false };
}

/** Bot cộng đồng (community-bot): trả lời từ ngữ cảnh cộng đồng — bài mở (trích nội dung), bài khóa (chỉ cách mở), sự kiện, nội quy. */
function communityAnswer(message: string, c: CommunityContext): AnswerOutput {
  const t = normalizeText(message);
  const base: AnswerOutput = { onTopic: true, injection: false, reply: '', handoff: false, handoffCategory: 'user', handoffReason: '', toolIds: [], usedSampleId: '', suggestions: [] };
  if (/\b(tho|code|toan|bai tap ve nha|poem|thoi tiet)\b/.test(t)) return { ...base, onTopic: false, reply: 'ngoài phạm vi' };
  if (/bo qua|ignore|system prompt/.test(t)) return { ...base, injection: true, reply: 'ngoài phạm vi' };
  if (replyOverride) return { ...base, reply: replyOverride(message) };
  if (/gap chu|hoi chu|gap nguoi|hoan tien|khieu nai/.test(t)) return { ...base, handoff: true, handoffReason: message.slice(0, 200), reply: 'Để mình gửi câu hỏi này cho chủ cộng đồng nhé.' };
  const open = c.lessons.find((l) => l.status === 'open');
  const locked = c.lessons.find((l) => l.status === 'locked');
  if (/bai|hoc|lesson/.test(t) && (open || locked)) {
    if (open) return { ...base, reply: `Bài "${open.title}": ${(open.content ?? '').slice(0, 120)} (${open.link})` };
    return { ...base, reply: `Bài "${locked!.title}" đang khóa, ${locked!.howToUnlock}.` };
  }
  if (/su kien|lich|event|live/.test(t) && c.events[0]) return { ...base, reply: `Sự kiện "${c.events[0].title}" lúc ${c.events[0].startAt}.` };
  if (/noi quy|quy dinh|rule/.test(t) && c.community.rules[0]) return { ...base, reply: `Nội quy: ${c.community.rules.map((r) => r.title).join(', ')}.` };
  if (c.sampleAnswers[0]) return { ...base, reply: c.sampleAnswers[0].answer, usedSampleId: c.sampleAnswers[0].id };
  return { ...base, reply: `Mình chưa có thông tin về việc này trong cộng đồng ${c.community.name}.` };
}

export class FakeChatModel implements ChatLlm {
  async complete<T>(req: LlmRequest<T>): Promise<{ output: T; usage: LlmUsage }> {
    if (answerDelayMs && req.kind === 'answer') await new Promise((r) => setTimeout(r, answerDelayMs));
    if (req.kind === 'learn') {
      const transcript = String(req.hint ?? '');
      fakeCalls.push({ kind: 'learn', input: transcript });
      const raw = learnOverride
        ? learnOverride(transcript)
        : (() => {
            const q = /Khách: (.+)/.exec(transcript)?.[1];
            const a = /Bot: (.+)/.exec(transcript)?.[1];
            return { pairs: q && a ? [{ question: q, answer: a.replace(/ \[khách [^\]]+\]$/, ''), confidence: 0.9, generalizable: true }] : [] };
          })();
      return { output: req.schema.parse(raw), usage: USAGE };
    }
    const h = req.hint as { message: string; context: KnowledgeContext; community?: CommunityContext };
    fakeCalls.push({ kind: 'answer', input: h.message });
    return { output: req.schema.parse(h.community ? communityAnswer(h.message, h.community) : answer(h.message, h.context)), usage: USAGE };
  }
}
