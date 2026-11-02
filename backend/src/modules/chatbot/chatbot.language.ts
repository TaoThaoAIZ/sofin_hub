/**
 * Ngôn ngữ của câu hỏi (CB-13-14). Kho câu mẫu / tài liệu chỉ có tiếng Việt, nên câu hỏi tiếng Anh:
 *  - được thêm từ khóa tiếng Việt tương ứng trước khi tra cứu (retrievalText), để vẫn tìm đúng dữ liệu;
 *  - không trả thẳng câu mẫu (câu mẫu là tiếng Việt) mà để AI trả lời bằng tiếng Anh từ ngữ cảnh.
 */
export type ChatLanguage = 'vi' | 'en';

// Có dấu tiếng Việt => chắc chắn tiếng Việt.
const VI_MARKS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

// Từ tiếng Anh thông dụng, đã bỏ những từ trùng với tiếng Việt không dấu ("can" = cần, "to" = tờ/tổ, "an" = ăn...).
const EN_WORDS = new Set(
  ('how what where why when which who whom whose i my me mine the is are was were am do does did please want need should would could ' +
    'have has had your you it its this that these those with for of and or not cannot can\'t don\'t doesn\'t i\'m get got there here ' +
    'password account reset forgot refund help login log sign register buy pay payment subscription cancel course lesson community ' +
    'event support contact price cost email change delete join create invite referral settings profile security verify code hello hi thanks')
    .split(/\s+/),
);

export function detectLanguage(text: string): ChatLanguage {
  if (VI_MARKS.test(text)) return 'vi';
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (!words.length) return 'vi';
  const hits = new Set(words.filter((w) => EN_WORDS.has(w)));
  return hits.size >= 2 && hits.size / words.length >= 0.3 ? 'en' : 'vi';
}

// Từ khóa tiếng Anh => từ khóa tiếng Việt dùng trong kho câu mẫu / tài liệu.
const GLOSSARY: [RegExp, string][] = [
  [/\bpass ?words?\b/, 'mật khẩu'],
  [/\b(forg[eo]t|reset|recover)\b/, 'quên đặt lại'],
  [/\b(log ?in|sign ?in|logging in|signing in)\b/, 'đăng nhập'],
  [/\b(log ?out|sign ?out)\b/, 'đăng xuất'],
  [/\b(sign ?up|register|registration)\b/, 'đăng ký'],
  [/\baccounts?\b/, 'tài khoản'],
  [/\brefunds?\b/, 'hoàn tiền'],
  [/\b(pay|paying|payments?|checkout|transfer)\b/, 'thanh toán'],
  [/\b(subscriptions?|plans?|membership)\b/, 'gói thành viên'],
  [/\b(cancel|unsubscribe)\b/, 'hủy'],
  [/\b(invoices?|receipts?)\b/, 'hóa đơn'],
  [/\b(price|prices|cost|fee|fees|how much)\b/, 'giá phí'],
  [/\bcommunit(y|ies)\b/, 'cộng đồng'],
  [/\b(courses?|class|classes|classroom)\b/, 'khóa học lớp học'],
  [/\blessons?\b/, 'bài học'],
  [/\bevents?\b/, 'sự kiện'],
  [/\bcertificates?\b/, 'chứng chỉ'],
  [/\bjoin(ing)?\b/, 'tham gia'],
  [/\b(create|creating)\b/, 'tạo'],
  [/\b(leave|quit)\b/, 'rời'],
  [/\b(refer|referral|invite|affiliate|commission)\b/, 'giới thiệu hoa hồng'],
  [/\b(2fa|two[- ]factor|two[- ]step|authenticator)\b/, 'xác thực 2 lớp bảo mật'],
  [/\bsecurity\b/, 'bảo mật'],
  [/\b(verify|verification|confirm)\b/, 'xác minh'],
  [/\be-?mail\b/, 'email'],
  [/\b(support|help|agent|human|staff)\b/, 'hỗ trợ'],
  [/\bcontact\b/, 'liên hệ'],
  [/\b(messages?|chat|dm)\b/, 'tin nhắn'],
  [/\b(profile|avatar|name)\b/, 'hồ sơ'],
  [/\bsettings?\b/, 'cài đặt'],
  [/\b(delete|remove)\b/, 'xóa'],
  [/\b(change|update|edit)\b/, 'đổi'],
  [/\b(notifications?)\b/, 'thông báo'],
  [/\b(download|tools?)\b/, 'tool tải'],
  [/\b(credits?|coins?|tokens?)\b/, 'ngân lượng'],
  [/\b(error|bug|not working|broken|failed)\b/, 'lỗi'],
];

/** Câu dùng để tra cứu: tiếng Anh thì đặt từ khóa tiếng Việt tương ứng lên trước câu gốc (tsquery chỉ lấy 16 từ đầu). */
export function retrievalText(text: string, lang: ChatLanguage = detectLanguage(text)): string {
  if (lang !== 'en') return text;
  const low = text.toLowerCase();
  const vi = [...new Set(GLOSSARY.filter(([re]) => re.test(low)).map(([, v]) => v))];
  return vi.length ? `${vi.join(' ')} ${text}` : text;
}
