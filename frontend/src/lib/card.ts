// Tiện ích thẻ thanh toán chạy hoàn toàn ở trình duyệt: định dạng khi gõ, kiểm tra Luhn/hạn/CVC,
// và "tokenise" giả cho cổng thanh toán mock. KHÔNG bao giờ gửi/lưu số thẻ hay CVC thô đi đâu cả —
// chỉ token + thương hiệu + 4 số cuối + hạn được gửi lên server.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'jcb' | 'unknown';

export const digitsOnly = (s: string) => s.replace(/\D/g, '');

export function detectBrand(number: string): CardBrand {
  const n = digitsOnly(number);
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^(6011|65|64[4-9])/.test(n)) return 'discover';
  if (/^35/.test(n)) return 'jcb';
  return 'unknown';
}

export const BRAND_LABEL: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  unknown: 'Thẻ',
};

/** Định dạng số thẻ theo nhóm 4 (Amex: 4-6-5). */
export function formatCardNumber(input: string): string {
  const d = digitsOnly(input);
  if (detectBrand(d) === 'amex') {
    const x = d.slice(0, 15);
    return [x.slice(0, 4), x.slice(4, 10), x.slice(10, 15)].filter(Boolean).join(' ');
  }
  return d.slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1225" -> "12 / 25"; tự thêm số 0 đầu khi gõ tháng 2..9. */
export function formatExpiry(input: string): string {
  let d = digitsOnly(input).slice(0, 4);
  if (d.length === 1 && Number(d) > 1) d = `0${d}`;
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

export function luhn(number: string): boolean {
  const d = digitsOnly(number);
  if (d.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function parseExpiry(exp: string): { month: number; year: number } | null {
  const d = digitsOnly(exp);
  if (d.length !== 4) return null;
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return null;
  return { month, year };
}

export interface CardForm {
  number: string;
  expiry: string;
  cvc: string;
}
export type CardErrors = Partial<Record<keyof CardForm, string>>;

export function validateCard(card: CardForm, now = new Date()): CardErrors {
  const errors: CardErrors = {};
  const digits = digitsOnly(card.number);
  const brand = detectBrand(digits);
  const len = brand === 'amex' ? 15 : 16;
  if (!digits) errors.number = 'Vui lòng nhập số thẻ';
  else if (digits.length < 13 || (brand !== 'unknown' && digits.length !== len && digits.length < len)) errors.number = 'Số thẻ chưa đủ chữ số';
  else if (!luhn(digits)) errors.number = 'Số thẻ không hợp lệ';

  const exp = parseExpiry(card.expiry);
  if (!digitsOnly(card.expiry)) errors.expiry = 'Nhập ngày hết hạn';
  else if (!exp) errors.expiry = 'Ngày hết hạn không hợp lệ (MM / YY)';
  else if (exp.year < now.getFullYear() || (exp.year === now.getFullYear() && exp.month < now.getMonth() + 1)) errors.expiry = 'Thẻ đã hết hạn';
  else if (exp.year > now.getFullYear() + 20) errors.expiry = 'Ngày hết hạn không hợp lệ';

  const cvcLen = brand === 'amex' ? 4 : 3;
  const cvc = digitsOnly(card.cvc);
  if (!cvc) errors.cvc = 'Nhập mã CVC';
  else if (cvc.length !== cvcLen) errors.cvc = `CVC gồm ${cvcLen} chữ số`;
  return errors;
}

export interface MockPaymentMethod {
  token: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** Dạng gửi lên BE (`PaymentMethodInput`): CHỈ token + brand/last4/hạn — tuyệt đối không có số thẻ hay CVC. */
export interface PaymentMethodInput {
  type: 'card';
  token: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
}

/** Tokenise giả (cổng thanh toán mock): chỉ giữ token ngẫu nhiên + thương hiệu + 4 số cuối + hạn. */
export function tokenizeCard(card: CardForm): MockPaymentMethod {
  const digits = digitsOnly(card.number);
  const exp = parseExpiry(card.expiry);
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return {
    token: `tok_mock_${rand}`,
    brand: detectBrand(digits),
    last4: digits.slice(-4),
    expMonth: exp?.month ?? 0,
    expYear: exp?.year ?? 0,
  };
}

export const toPaymentMethodInput = (m: MockPaymentMethod): PaymentMethodInput => ({
  type: 'card',
  token: m.token,
  brand: m.brand,
  last4: m.last4,
  expMonth: m.expMonth,
  expYear: m.expYear,
});
