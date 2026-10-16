import { normalizeText } from '../search/search.text.js';

/**
 * Lọc NỘI DUNG BỊ CẤM ngay tại server, TRƯỚC khi gửi sang ChatGPT (chatbot.md — tránh vi phạm chính sách sử dụng của OpenAI/ChatGPT).
 * Bot chạy bằng MỘT tài khoản ChatGPT dùng chung cho mọi khách / mọi cộng đồng: chuyển tiếp yêu cầu bị cấm có thể khiến tài khoản bị
 * gắn cờ / khóa => mọi bot ngừng. Yêu cầu rõ ràng vi phạm được từ chối tại chỗ (không gọi model), ghi `toolCalls: [{name:'moderation'}]`.
 *
 * Bộ lọc bảo thủ theo cụm từ rõ ràng (đã gập dấu tiếng Việt + tiếng Anh): mục tiêu là chặn yêu cầu RÕ RÀNG vi phạm, không thay thế
 * hoàn toàn bộ lọc của model (model vẫn từ chối phần còn lại theo luật phạm vi trong prompt).
 */
export type ModerationCategory = 'self_harm' | 'minor_sexual' | 'sexual' | 'weapons' | 'drugs' | 'malware' | 'violence' | 'jailbreak';

const RULES: { category: ModerationCategory; re: RegExp }[] = [
  // Tự hại / tự tử — trả lời quan tâm + hướng tới trợ giúp, không gửi model.
  { category: 'self_harm', re: /\b(tu tu|tu sat|muon chet di cho xong|khong muon song nua|khong thiet song|chan song|khong muon song|ket lieu ban than|cat tay|tu hai|suicide|kill myself|self harm|end my life)\b/ },
  // Tình dục liên quan trẻ vị thành niên — luôn chặn.
  { category: 'minor_sexual', re: /\b(tre em|tre con|be gai|be trai|hoc sinh|vi thanh nien|under ?age|minor|child|loli|cp)\b.{0,40}\b(sex|khieu dam|kich duc|nude|khoa than|lam tinh|quan he)\b|\b(sex|khieu dam|kich duc|nude|khoa than|lam tinh)\b.{0,40}\b(tre em|tre con|be gai|be trai|hoc sinh|vi thanh nien|under ?age|minor|child|loli)\b/ },
  { category: 'sexual', re: /\b(phim sex|anh nong|clip nong|khieu dam|porn|nude|anh khoa than|lam tinh|truyen sex|sexting)\b/ },
  { category: 'weapons', re: /\b(che tao|lam|tu lam|cach lam|huong dan lam|how to make|build)\b.{0,30}\b(bom|thuoc no|min|sung|vu khi|bomb|explosive|gun|weapon|chat doc|nerve agent)\b/ },
  { category: 'drugs', re: /\b(che|nau|tong hop|cach lam|how to make|synthesi[sz]e|cook)\b.{0,30}\b(ma tuy|ma tuy da|thuoc lac|heroin|meth|cocaine|ketamine|fentanyl|can sa)\b|\b(mua ban|mua|ban)\s+(ma tuy|thuoc lac|heroin|meth|cocaine|can sa)\b/ },
  { category: 'malware', re: /\b(viet|tao|code|lam|write|create)\b.{0,30}\b(ma doc|virus|malware|ransomware|keylogger|trojan|botnet)\b|\b(hack|danh cap|chiem)\s+(tai khoan|facebook|zalo|mat khau|password|account)\b|\b(ddos|phishing|lua dao chiem doat)\b/ },
  { category: 'violence', re: /\b(giet|dam chet|danh chet|thanh toan|ha sat|kill|murder)\s+(no|han|ong ay|ba ay|thang|con|nguoi|him|her|someone|my)\b|\b(khung bo|terror(ist|ism)? attack)\b/ },
  // Jailbreak trắng trợn (đổi vai / gỡ giới hạn) — không gửi đi; câu lừa tinh vi hơn do luật injection trong prompt xử lý.
  { category: 'jailbreak', re: /\b(dan mode|do anything now|jailbreak|developer mode|bo qua (moi|tat ca) (quy tac|huong dan|gioi han)|ignore (all|previous|your) (rules|instructions)|khong co gioi han|no restrictions)\b/ },
];

export interface ModerationResult {
  blocked: boolean;
  category?: ModerationCategory;
}

/** Kiểm tra tin khách (đã gộp nhiều dòng). Không chặn => gửi model như thường. */
export function moderate(text: string): ModerationResult {
  const t = ` ${normalizeText(text).replace(/\s+/g, ' ')} `;
  for (const r of RULES) if (r.re.test(t)) return { blocked: true, category: r.category };
  return { blocked: false };
}

/** Câu trả lời tại chỗ cho tin bị chặn (`me`/`you` = xưng hô của bot). */
export function moderationReply(category: ModerationCategory, me = 'mình', you = 'bạn'): string {
  if (category === 'self_harm') {
    return `${cap(me)} rất tiếc khi ${you} đang thấy như vậy. ${cap(me)} không phải người có thể giúp ${you} lúc này, ${you} hãy nói chuyện ngay với người thân hoặc người ${you} tin tưởng; nếu đang gặp nguy hiểm, ${you} gọi cấp cứu 115 hoặc tới cơ sở y tế gần nhất nhé.`;
  }
  return `${cap(me)} không hỗ trợ nội dung này được. ${cap(you)} cần hỏi gì khác trong phạm vi hỗ trợ không?`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
