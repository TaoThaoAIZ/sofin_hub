import { normalizeText } from '../search/search.text.js';

/**
 * Từ khóa có nghĩa của một câu hỏi (đã bỏ dấu, bỏ từ không mang nội dung) — dùng để tìm khóa học (chatbot.context) và để chặn trả
 * lời thẳng bằng câu mẫu khi câu mẫu thiếu từ khóa của khách ("rời cộng đồng" ≠ "tạo cộng đồng" dù giống nhau theo trigram).
 */
/** Từ không mang nội dung khi tìm khóa học ("hiện tại đang có khoá học nào liên quan đến … không", "bn tiền 1 tháng", "ai dạy khóa đó"). */
const CATALOG_STOPWORDS = new Set(
  ('hien tai dang co khoa hoc lop cong dong nao lien quan den toi minh em ban anh chi thay muon tim can hoi ve cho xin gia bao nhieu ' +
    'the a ah oi nhe nha khong co ko k vay sao la gi cua cac nhung mot va voi thi nay do kia o trong nen hay duoc it nhat duoc nay hien nao ' +
    'tu phi hoc phi tien dong ky dang ky tham gia hoi de ma con co the ' +
    // Lời chào / yêu cầu: "chào bạn, bên mình… hãy giới thiệu nội dung, thời hạn truy cập và cách đăng ký".
    'chao ben hay giup xem biet gioi thieu noi dung thoi han truy cap cach chi tiet thong tin cu tu van nhu gom moi ' +
    // Hỏi giá / người dạy / cách học: "bn tiền 1 tháng", "ai dạy", "làm … bằng …", "nữa", "khác".
    'bn bnhieu thang nam ngay tuan day ai lam bang nua khac so sanh re dat mac nhat voi tot online huong dan loi ich nhu the').split(' '),
);

/** Từ khóa của câu hỏi tìm khóa học (đã bỏ dấu, bỏ từ không mang nội dung), giữ thứ tự. */
export function catalogKeywords(text: string): string[] {
  const words = normalizeText(text).split(/[^\p{L}\p{N}]+/u);
  // Giữ tên môn dù trùng từ không mang nội dung: "tiếng anh" (anh), "AI" đứng cạnh video/chatgpt/tạo… ("ai" thường là "ai dạy").
  const keep = (w: string, i: number) =>
    (w === 'anh' && words[i - 1] === 'tieng') || (w === 'ai' && /^(video|tao|chatgpt|cong|nghe|tri|tue|marketing|art|agent)$/.test(words[i + 1] ?? words[i - 1] ?? ''));
  return [...new Set(words.filter((w, i) => w.length >= 2 && !/^\d+$/.test(w) && (!CATALOG_STOPWORDS.has(w) || keep(w, i))))].slice(0, 8);
}


const tokens = (s: string) => normalizeText(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Câu mẫu có chứa ĐỦ từ khóa của câu khách không (khớp đúng hoặc tiền tố ≥ 3 ký tự, tính trên câu hỏi + các cách hỏi khác).
 * Câu khách không có từ khóa nào (toàn từ chung chung) => true.
 */
export function qaCoversQuery(text: string, qa: { question: string; variants?: string[] }): boolean {
  const words = new Set([qa.question, ...(qa.variants ?? [])].flatMap(tokens));
  return catalogKeywords(text).every((k) => words.has(k) || [...words].some((w) => (k.length >= 3 && w.startsWith(k)) || (w.length >= 3 && k.startsWith(w))));
}
