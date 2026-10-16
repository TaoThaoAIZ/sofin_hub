import { looksLikeBankAccount } from './chatbot.pii.js';

/**
 * Guardrail đầu ra, chạy bằng regex (không gọi AI). Phân loại lạc đề / prompt injection nằm ngay trong lượt trả lời của Codex
 * (trường onTopic/injection của answerSchema).
 *  - bank_account: có dấu hiệu đưa số tài khoản ngân hàng;
 *  - unsourced_amount: số tiền không xuất hiện trong ngữ cảnh đã gom hay trong tin của khách (chống bịa giá).
 */
export type OutputViolation = 'bank_account' | 'unsourced_amount';

// Không dùng \b: trong JS \b chỉ hiểu ký tự ASCII nên "1.500.000đ " sẽ không khớp.
const MONEY = /(\d[\d.,\s]*\d|\d)\s*(?:đồng|đ|vnđ|vnd|k|nghìn|ngàn|triệu|tr|usd|\$)(?![\p{L}\p{N}])/giu;
const digitsOf = (s: string) => s.replace(/\D/g, '');

export function checkOutput(text: string, sources: string[]): OutputViolation | null {
  if (looksLikeBankAccount(text)) return 'bank_account';
  const haystack = digitsIndex(sources);
  for (const m of text.matchAll(MONEY)) {
    const d = digitsOf(m[1] ?? '');
    if (!d || d === '0') continue;
    if (!haystack.has(d) && !haystack.has(d.replace(/0+$/, ''))) return 'unsourced_amount';
  }
  return null;
}

/** Tập các dãy chữ số (bỏ dấu ngăn cách) xuất hiện trong nguồn, kèm dạng bỏ số 0 cuối (1.000.000đ ~ "1 triệu" ~ "1tr"). */
function digitsIndex(sources: string[]): Set<string> {
  const set = new Set<string>();
  for (const s of sources) {
    for (const m of s.matchAll(/\d[\d.,]*/g)) {
      const d = digitsOf(m[0]);
      if (!d) continue;
      set.add(d);
      set.add(d.replace(/0+$/, ''));
    }
  }
  return set;
}
