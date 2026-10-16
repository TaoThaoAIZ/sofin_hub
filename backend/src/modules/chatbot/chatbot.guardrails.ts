import { looksLikeBankAccount } from './chatbot.pii.js';

/**
 * Guardrail đầu ra, chạy bằng regex (không gọi AI). Phân loại lạc đề / prompt injection nằm ngay trong lượt trả lời của Codex
 * (trường onTopic/injection của answerSchema).
 *  - bank_account: có dấu hiệu đưa số tài khoản ngân hàng;
 *  - unsourced_amount: số tiền không xuất hiện trong ngữ cảnh đã gom hay trong tin của khách (chống bịa giá). Được phép thêm: tổng / hiệu
 *    / ×12 của các số tiền CÓ NGUỒN mà CHÍNH câu trả lời cũng nêu ("Python 175.000đ, Excel 125.000đ — chênh 50.000đ"). Không suy từ mọi
 *    số trong nguồn: ngữ cảnh có rất nhiều mức giá nên tổng/hiệu bất kỳ sẽ phủ gần hết các số => mất tác dụng chống bịa.
 */
export type OutputViolation = 'bank_account' | 'unsourced_amount';

// Không dùng \b: trong JS \b chỉ hiểu ký tự ASCII nên "1.500.000đ " sẽ không khớp.
const MONEY = /(\d[\d.,\s]*\d|\d)\s*(?:đồng|đ|vnđ|vnd|k|nghìn|ngàn|triệu|tr|usd|\$)(?![\p{L}\p{N}])/giu;
const digitsOf = (s: string) => s.replace(/\D/g, '');
/** Bội số theo đơn vị viết tắt ("50k" = 50.000, "1,5 triệu" = 1.500.000). */
const UNIT = /(k|nghìn|ngàn)$/i;
const MILLION = /(triệu|tr)$/i;

export function checkOutput(text: string, sources: string[]): OutputViolation | null {
  if (looksLikeBankAccount(text)) return 'bank_account';
  const haystack = digitsIndex(sources);
  const sourced = (d: string) => haystack.has(d) || haystack.has(d.replace(/0+$/, ''));
  const amounts = [...text.matchAll(MONEY)].map((m) => ({ d: digitsOf(m[1] ?? ''), value: moneyValue(m[0]) })).filter((a) => a.d && a.d !== '0');
  const unsourced = amounts.filter((a) => !sourced(a.d));
  if (!unsourced.length) return null;
  const derived = derivedAmounts(amounts.filter((a) => sourced(a.d)).map((a) => a.value));
  return unsourced.every((a) => derived.has(a.value)) ? null : 'unsourced_amount';
}

/** Giá trị số của 1 cụm tiền ("175.000đ" = 175000, "50k" = 50000, "1,5 triệu" = 1500000). */
function moneyValue(match: string): number {
  const unit = match.trim().replace(/^[\d.,\s]+/, '');
  const raw = match.replace(/[^\d.,]/g, '');
  if (MILLION.test(unit)) return Math.round(Number(raw.replace(/\./g, '').replace(',', '.')) * 1_000_000);
  const n = Number(digitsOf(raw));
  return UNIT.test(unit) ? n * 1000 : n;
}

/** Tổng / hiệu từng cặp + ×12 của các số tiền có nguồn mà câu trả lời đã nêu (≥ 1.000). */
function derivedAmounts(values: number[]): Set<number> {
  const vals = [...new Set(values.filter((v) => v >= 1000))].slice(0, 20);
  const out = new Set<number>();
  for (const a of vals) {
    out.add(a * 12);
    for (const b of vals) {
      out.add(a + b);
      if (a > b) out.add(a - b);
    }
  }
  return out;
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
