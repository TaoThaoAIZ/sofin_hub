/**
 * Lọc thông tin cá nhân / tài chính khỏi văn bản trước khi lưu thành tri thức (Q&A học được, dữ liệu nhập từ Zalo) và để guardrail
 * đầu ra chặn bot lộ số tài khoản. Dùng regex bảo thủ: thà che nhầm còn hơn lọt.
 */
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[a-z]{2,}/giu;
/** SĐT Việt Nam: 0xxxxxxxxx / +84xxxxxxxxx, cho phép dấu cách/chấm/gạch giữa các nhóm số. */
const PHONE = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/g;
/** Dãy số dài (số tài khoản, số thẻ, mã đơn, CCCD): từ 8 chữ số trở lên, cho phép dấu cách/chấm/gạch. */
const LONG_NUMBER = /(?<!\d)\d(?:[\s.-]?\d){7,}(?!\d)/g;
const URL_WITH_TOKEN = /https?:\/\/\S*(?:token|key|sig|code|password)=\S+/gi;

/** Cụm từ cho thấy văn bản đang đưa/nhắc thông tin tài khoản ngân hàng. */
const BANK_HINT = /\b(stk|so tai khoan|số tài khoản|chủ tài khoản|chu tai khoan|techcombank|vietcombank|mb ?bank|vpbank|acb|tpbank|agribank|bidv|vietinbank)\b/iu;

export interface Redacted {
  text: string;
  /** true nếu có ít nhất một chỗ bị che. */
  changed: boolean;
}

export function redactPii(input: string): Redacted {
  let changed = false;
  const sub = (re: RegExp, label: string) => (s: string) =>
    s.replace(re, () => {
      changed = true;
      return label;
    });
  const text = [sub(URL_WITH_TOKEN, '[link]'), sub(EMAIL, '[email]'), sub(PHONE, '[sđt]'), sub(LONG_NUMBER, '[số]')].reduce((s, f) => f(s), input);
  return { text, changed };
}

/** Văn bản chứa thông tin cá nhân/tài chính (dùng để đánh dấu tin nhắn `redacted`, không học từ đó). */
export const containsPii = (s: string) => redactPii(s).changed;

/**
 * Câu trả lời của bot có dấu hiệu đưa số tài khoản ngân hàng: nhắc ngân hàng/STK kèm một dãy số dài. Mã nội dung chuyển khoản
 * (SFH...) và số tiền có dấu chấm ngăn cách hàng nghìn không bị tính.
 */
export function looksLikeBankAccount(s: string): boolean {
  const digits = s.replace(/\b\d{1,3}(?:[.,]\d{3})+(?:đ|d|vnđ|vnd)?\b/giu, ' ');
  return BANK_HINT.test(s) && /(?<!\d)\d(?:[\s.-]?\d){5,}(?!\d)/.test(digits);
}
