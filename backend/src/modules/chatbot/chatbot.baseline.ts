import { prisma } from '../../db/prisma.js';
import { BUNDLED_KB_DIR, importKnowledgeDir } from './chatbot.import.js';

/**
 * Dữ liệu nền của chatbot (câu mẫu + tài liệu đi kèm repo). KHÔNG tự nạp khi khởi động (chủ dự án chốt 2026-10-14: chỉ nạp bằng
 * lệnh riêng) — chạy `npm run chatbot:baseline` (production: `node dist/cli/chatbot-baseline.js` trong container, xem
 * src/cli/chatbot-baseline.ts). Backend chỉ ghi cảnh báo log + trang admin hiện nhắc khi chưa nạp bản hiện tại.
 * Mỗi CHATBOT_BASELINE_VERSION nạp một lần (lưu ở PlatformSetting `chatbot.baseline`; `--force` nạp lại):
 *  - câu mẫu: id xác định `seed-chatbot-qa-<key>` + createMany(skipDuplicates) — câu admin đã sửa không bị ghi đè; câu admin đã xóa
 *    chỉ quay lại khi tăng version;
 *  - tài liệu: chỉ tạo slug chưa có — tài liệu admin đã sửa không bị ghi đè.
 * Thêm/đổi dữ liệu nền => tăng CHATBOT_BASELINE_VERSION.
 */
export const CHATBOT_BASELINE_VERSION = 3;
export const CHATBOT_BASELINE_KEY = 'chatbot.baseline';

export interface BaselineQa {
  key: string;
  question: string;
  variants: string[];
  answer: string;
  tags: string[];
}

export const CHATBOT_FAQ: BaselineQa[] = [
  {
    key: 'account-register',
    question: 'Làm sao để đăng ký tài khoản?',
    variants: ['đăng ký tài khoản thế nào', 'tạo tài khoản ở đâu'],
    answer:
      'dạ bạn bấm "Đăng ký" (hoặc "Tham gia ngay" ở một cộng đồng), đọc hết Điều khoản và Chính sách bảo mật rồi tick đồng ý nha. Đăng ký xong hệ thống gửi email để bạn xác minh địa chỉ ạ',
    tags: ['tài khoản'],
  },
  {
    key: 'account-password-rules',
    question: 'Mật khẩu cần đáp ứng yêu cầu gì?',
    variants: ['mật khẩu phải có gì', 'yêu cầu mật khẩu'],
    answer: 'dạ mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ in hoa và 1 ký tự đặc biệt, ví dụ Matkhau@123 ạ',
    tags: ['tài khoản'],
  },
  {
    key: 'account-forgot-password',
    question: 'Tôi quên mật khẩu thì làm sao?',
    variants: ['quên mật khẩu', 'lấy lại mật khẩu thế nào', 'đặt lại mật khẩu'],
    answer:
      'dạ ở trang Đăng nhập bạn bấm "Quên mật khẩu" và nhập email, hệ thống gửi link đặt lại mật khẩu (link có hạn và chỉ dùng 1 lần) nha. Bạn cũng đổi được mật khẩu trong Cài đặt tài khoản ạ',
    tags: ['tài khoản'],
  },
  {
    key: 'account-manage',
    question: 'Làm sao để đăng xuất, hoặc quản lý thông tin cá nhân?',
    variants: ['đăng xuất ở đâu', 'sửa thông tin cá nhân'],
    answer:
      'dạ bạn bấm vào tên ở góc phải trên cùng, trong đó có Hồ sơ, Cài đặt tài khoản, Thông báo, Tin nhắn, Gói & thanh toán và nút "Đăng xuất" ạ',
    tags: ['tài khoản'],
  },
  {
    key: 'community-join',
    question: 'Làm sao để tham gia một cộng đồng?',
    variants: ['tham gia cộng đồng thế nào', 'vào cộng đồng sao'],
    answer:
      'dạ bạn vào trang cộng đồng và bấm "Tham gia ngay" nha. Cộng đồng có phí sẽ chuyển sang trang thanh toán, cộng đồng riêng tư thì cần quản trị viên duyệt yêu cầu ạ',
    tags: ['cộng đồng'],
  },
  {
    key: 'community-features',
    question: 'Trong một cộng đồng tôi làm được những gì?',
    variants: ['cộng đồng có những gì'],
    answer:
      'dạ trong cộng đồng bạn đăng bài, bình luận, học trong Lớp học (có theo dõi tiến độ), xem Lịch sự kiện, Thành viên, Bảng xếp hạng và để lại đánh giá ạ',
    tags: ['cộng đồng'],
  },
  {
    key: 'community-create',
    question: 'Tôi có thể tạo cộng đồng riêng của mình không?',
    variants: ['tạo cộng đồng thế nào', 'mở cộng đồng riêng'],
    answer:
      'dạ được ạ, bạn bấm "Tạo cộng đồng" ở thanh trên cùng, điền tên, mô tả, danh mục, công khai/riêng tư và giá. Bạn sẽ là chủ cộng đồng, tự soạn lớp học, sự kiện, mời quản trị viên và xem doanh thu nha',
    tags: ['cộng đồng'],
  },
  {
    key: 'community-leave',
    question: 'Làm sao để rời khỏi cộng đồng?',
    variants: ['rời cộng đồng', 'thoát khỏi cộng đồng'],
    answer:
      'dạ bạn vào trang cộng đồng và bấm "Đã tham gia" để rời nha. Với cộng đồng có phí, rời là mất truy cập ngay, gói tự hủy cuối kỳ và tiền kỳ đã trả không hoàn ạ',
    tags: ['cộng đồng'],
  },
  {
    key: 'community-report',
    question: 'Nội dung hoặc thành viên vi phạm thì báo cáo ở đâu?',
    variants: ['báo cáo vi phạm', 'tố cáo bài viết'],
    answer: 'dạ bạn bấm "Báo cáo" trên bài viết hoặc bình luận, quản trị viên cộng đồng và đội ngũ nền tảng sẽ xử lý ạ',
    tags: ['cộng đồng'],
  },
  {
    key: 'billing-how',
    question: 'Thanh toán cộng đồng có phí như thế nào?',
    variants: ['thanh toán thế nào', 'trả tiền cộng đồng sao'],
    answer:
      'dạ bạn thanh toán ở trang thanh toán của cộng đồng bằng mã VietQR, hệ thống tự xác nhận khi tiền về nha. Giao dịch và gói của bạn xem ở mục "Gói & thanh toán" ạ',
    tags: ['thanh toán'],
  },
  {
    key: 'billing-auto-charge',
    question: 'Tôi có bị tự động trừ tiền không?',
    variants: ['có tự gia hạn không', 'có bị trừ tiền tự động không'],
    answer: 'dạ không ạ, không có gì tự động gia hạn, bạn chỉ chuyển khoản khi chủ động tham gia hoặc gia hạn nha',
    tags: ['thanh toán'],
  },
  {
    key: 'billing-cancel',
    question: 'Tôi có thể hủy gói bất kỳ lúc nào không?',
    variants: ['hủy gói', 'hủy đăng ký'],
    answer: 'dạ được ạ, bạn hủy trong "Gói & thanh toán", vẫn dùng được tới hết chu kỳ đã trả và không bị trừ thêm nha',
    tags: ['thanh toán'],
  },
  {
    key: 'billing-refund',
    question: 'Có hoàn tiền không?',
    variants: ['hoàn tiền được không', 'muốn hoàn tiền'],
    answer:
      'dạ có ạ, trong thời hạn hoàn tiền của nền tảng. Bạn gửi yêu cầu kèm thông tin giao dịch, hóa đơn sẽ hiện "Đã hoàn tiền" khi xong nha',
    tags: ['thanh toán'],
  },
  {
    key: 'support-contact',
    question: 'Làm sao để liên hệ hỗ trợ?',
    variants: ['liên hệ hỗ trợ', 'gặp nhân viên hỗ trợ'],
    answer: 'dạ bạn hỏi Tào ngay tại đây, hoặc bấm "Nhắn Zalo hỗ trợ" để gặp người hỗ trợ nha. Bạn cũng gửi được biểu mẫu ở trang Liên hệ ạ',
    tags: ['hỗ trợ'],
  },
  {
    key: 'support-privacy',
    question: 'Dữ liệu cá nhân của tôi có được bảo mật không?',
    variants: ['bảo mật dữ liệu', 'thông tin cá nhân có an toàn không'],
    answer: 'dạ bạn xem chi tiết cách SofinHub thu thập, sử dụng và bảo vệ dữ liệu ở trang Chính sách bảo mật nha',
    tags: ['hỗ trợ'],
  },
  {
    key: 'tools-where',
    question: 'Tải tool ở đâu?',
    variants: ['mua tool ở đâu', 'có những tool nào', 'xem danh sách tool'],
    answer:
      'dạ bạn vào trang "Tải Tool" (/tools) nha, tool miễn phí tải ngay được, tool có phí bấm "Mua ngay" để lại thông tin là bên Tào liên hệ hướng dẫn ạ',
    tags: ['tool'],
  },
];

/**
 * Câu mẫu viết lại từ các chủ đề khách hỏi lặp lại nhiều nhất trên Zalo (crawl_zalo/output/analysis, 2026-10-14): KHÔNG chép nguyên văn
 * chat, không tên/SĐT khách, không con số giá. Nội dung chỉ lấy từ thông tin đã xác nhận (prisma/chatbot-kb, danh mục tool, luật thanh toán
 * VietQR/SePay). Lỗi kỹ thuật cụ thể của tool để AI trả lời từ tài liệu "Xử lý lỗi thường gặp" (cần hỏi lại khách đang dùng tool nào).
 */
export const CHATBOT_ZALO_TOPICS: BaselineQa[] = [
  {
    key: 'tools-price',
    question: 'Giá tool bao nhiêu?',
    variants: ['giá tool thế nào', 'chi phí dùng tool thế nào', 'báo giá tool giúp mình', 'giá sản phẩm thế nào', 'tool giá bao nhiêu tiền'],
    answer:
      'dạ giá từng tool bên Tào báo riêng theo nhu cầu ạ. Bạn bấm "Mua ngay" ở tool cần dùng trong trang Tải Tool (/tools) để lại thông tin, hoặc bấm "Nhắn Zalo hỗ trợ" để được báo giá nha',
    tags: ['tool', 'giá'],
  },
  {
    key: 'tools-billing-ngan-luong',
    question: 'Tool tính phí theo tháng hay thế nào?',
    variants: ['tool có tính theo tháng không', 'ngân lượng là gì', 'cách tính phí tool', 'có phải thuê bao tháng không'],
    answer:
      'dạ tool không thuê bao theo tháng mà tính theo Ngân Lượng (NL), khoảng 1 NL ≈ 1.000đ, dùng bao nhiêu trừ bấy nhiêu, hết thì nạp thêm, không giới hạn thời gian dùng phần mềm ạ. Một số gói hoặc khoá học riêng thì báo giá trọn gói nha',
    tags: ['tool', 'ngân lượng'],
  },
  {
    key: 'tools-credit',
    question: 'Tạo video, ảnh bằng tool có tốn Ngân Lượng không?',
    variants: ['tool phim có tốn credit không', 'tạo video có mất ngân lượng không', 'làm phim tốn credit nhiều không'],
    answer:
      'dạ có ạ, tạo video, ảnh, voice bằng AI sẽ trừ Ngân Lượng theo mức dùng, giống credit vậy. Mức trừ cụ thể của từng tool bạn nhắn Zalo hỗ trợ để Tào báo chính xác nha',
    tags: ['tool', 'ngân lượng'],
  },
  {
    key: 'tools-buy',
    question: 'Mua tool như thế nào?',
    variants: ['muốn mua tool thì làm sao', 'đăng ký mua tool', 'cách mua tool có phí'],
    answer:
      'dạ bạn vào trang Tải Tool (/tools), bấm "Mua ngay" ở tool cần mua rồi điền họ tên và số điện thoại ạ. Đội hỗ trợ liên hệ trong 24 giờ để hướng dẫn thanh toán và gửi link tải tool nha',
    tags: ['tool'],
  },
  {
    key: 'payment-bank-account',
    question: 'Chuyển khoản vào số tài khoản nào?',
    variants: ['cho xin số tài khoản', 'stk bên mình là gì', 'chuyển tiền vào đâu', 'gửi mình số tài khoản ngân hàng'],
    answer:
      'dạ thanh toán trên SofinHub dùng mã VietQR do hệ thống tạo ở trang thanh toán, tiền về là hệ thống tự xác nhận ạ. Tào không gửi số tài khoản qua tin nhắn, bạn đừng chuyển theo số tài khoản người lạ gửi nha',
    tags: ['thanh toán'],
  },
  {
    // Bộ Zalo zp06 (2026-10-14): hỏi MoMo thì AI trả đúng VietQR nhưng vẫn chuyển người (tạo ticket thừa).
    key: 'payment-methods',
    question: 'Thanh toán bằng MoMo, ví điện tử hay thẻ được không?',
    variants: ['thanh toán bằng momo được không', 'trả bằng thẻ visa được không', 'có thanh toán qua ví điện tử không', 'thanh toán zalopay được không'],
    answer:
      'dạ SofinHub chỉ nhận thanh toán bằng mã VietQR do hệ thống tạo ở trang thanh toán ạ. Bạn mở app ngân hàng (hoặc ví điện tử có hỗ trợ quét VietQR) để quét mã, tiền về là hệ thống tự xác nhận nha',
    tags: ['thanh toán'],
  },
  {
    key: 'payment-screenshot',
    question: 'Mình chuyển khoản rồi, gửi ảnh chụp màn hình được không?',
    variants: ['đã chuyển khoản rồi mà chưa thấy', 'gửi bill chuyển khoản', 'chuyển tiền rồi sao chưa xác nhận'],
    answer:
      'dạ ảnh chụp chuyển khoản không thay cho xác nhận của hệ thống ạ, trạng thái thật bạn xem ở mục "Gói & thanh toán". Nếu tiền đã trừ mà đơn vẫn chưa xác nhận, bạn bấm "Nhắn Zalo hỗ trợ" kèm mã đơn để Tào kiểm tra nha',
    tags: ['thanh toán'],
  },
  {
    key: 'tools-report-error',
    question: 'Tool bị lỗi thì báo thế nào?',
    variants: ['báo lỗi tool ở đâu', 'tool tạo toàn lỗi', 'kiểm tra giúp tool còn chạy không'],
    answer:
      'dạ bạn cho Tào biết đang dùng tool nào (Veo, Grok…) và dòng báo lỗi hiện ra nha. Lỗi chưa có trong hướng dẫn thì bạn bấm "Nhắn Zalo hỗ trợ" kèm ảnh lỗi để bên kỹ thuật kiểm tra ạ',
    tags: ['tool', 'lỗi'],
  },
  {
    key: 'tools-fix-eta',
    question: 'Lỗi tool bao giờ sửa xong?',
    variants: ['tool fix chưa', 'khi nào sửa xong lỗi', 'server sập bao giờ có lại'],
    answer:
      'dạ Tào chưa có thời gian chính xác ạ. Bạn bấm "Nhắn Zalo hỗ trợ" kèm tên tool đang lỗi để bên kỹ thuật báo tiến độ cho bạn nha',
    tags: ['tool', 'lỗi'],
  },
];

/**
 * Chủ đề khách hỏi nhiều nhưng CHƯA có thông tin xác nhận: nạp ở trạng thái CHỜ DUYỆT (bot không dùng) với phần trả lời để trống —
 * admin điền nội dung rồi mới duyệt.
 */
export const CHATBOT_NEEDS_ANSWER: BaselineQa[] = [
  {
    key: 'tools-trial',
    question: 'Tool có tài khoản hoặc bản dùng thử không?',
    variants: ['có cho dùng thử không', 'xin tài khoản dùng thử'],
    answer: '[CẦN ADMIN ĐIỀN: có/không có bản dùng thử, điều kiện]',
    tags: ['tool', 'cần điền'],
  },
  {
    key: 'tools-pc-requirements',
    question: 'Cấu hình máy tối thiểu để chạy tool là gì?',
    variants: ['máy yếu có chạy được tool không', 'cần cpu gpu ram bao nhiêu'],
    answer: '[CẦN ADMIN ĐIỀN: CPU / RAM / GPU / hệ điều hành tối thiểu]',
    tags: ['tool', 'cần điền'],
  },
  {
    key: 'tools-ai-accounts',
    question: 'Dùng tool có phải tự trả phí API hay tự nhập tài khoản AI không?',
    variants: ['tài nguyên api bên tool hay bên mình trả', 'có cần tài khoản veo grok riêng không'],
    answer: '[CẦN ADMIN ĐIỀN: model/tài khoản do tool cung cấp hay khách tự có, theo từng tool]',
    tags: ['tool', 'cần điền'],
  },
  {
    key: 'course-beginner',
    question: 'Người lớn tuổi hoặc mới bắt đầu có học làm phim AI được không?',
    variants: ['lớn tuổi học có chậm không', 'chưa biết gì có học được không'],
    answer: '[CẦN ADMIN ĐIỀN: lộ trình/hình thức kèm cặp dành cho người mới]',
    tags: ['khóa học', 'cần điền'],
  },
];

type Db = Pick<typeof prisma, 'chatbotQA'>;

/** Ghi câu mẫu nền (active) + chủ đề cần điền (candidate). Idempotent. */
export async function seedBaselineQa(db: Db = prisma): Promise<number> {
  const row = (q: BaselineQa, status: 'active' | 'candidate') => ({
    id: `seed-chatbot-qa-${q.key}`,
    question: q.question,
    variants: q.variants,
    answer: q.answer,
    tags: q.tags,
    status,
    source: 'admin' as const,
  });
  const { count } = await db.chatbotQA.createMany({
    data: [...CHATBOT_FAQ, ...CHATBOT_ZALO_TOPICS].map((q) => row(q, 'active')).concat(CHATBOT_NEEDS_ANSWER.map((q) => row(q, 'candidate'))),
    skipDuplicates: true,
  });
  return count;
}

/** Phiên bản dữ liệu nền đã nạp vào DB (null = chưa nạp lần nào). */
export async function chatbotBaselineVersion(): Promise<number | null> {
  const cur = await prisma.platformSetting.findUnique({ where: { key: CHATBOT_BASELINE_KEY } });
  const version = (cur?.value as { version?: unknown } | null)?.version;
  return typeof version === 'number' ? version : null;
}

/** Nạp dữ liệu nền nếu chưa nạp bản hiện tại (`force`: nạp lại dù đã nạp — vẫn không ghi đè bản admin đã sửa). Chỉ gọi từ lệnh riêng / seed / test. */
export async function ensureChatbotBaseline(opts: { force?: boolean } = {}): Promise<{ skipped: true } | { qa: number; documents: number }> {
  const version = await chatbotBaselineVersion();
  if (!opts.force && version !== null && version >= CHATBOT_BASELINE_VERSION) return { skipped: true };
  const qa = await seedBaselineQa();
  const docs = await importKnowledgeDir(BUNDLED_KB_DIR, null, { onlyMissing: true });
  const value = { version: CHATBOT_BASELINE_VERSION, at: new Date().toISOString() };
  await prisma.platformSetting.upsert({ where: { key: CHATBOT_BASELINE_KEY }, create: { key: CHATBOT_BASELINE_KEY, value }, update: { value } });
  const documents = docs.filter((d) => d.result === 'created').length;
  console.log(`[chatbot] dữ liệu nền v${CHATBOT_BASELINE_VERSION}: +${qa} câu mẫu, +${documents} tài liệu`);
  return { qa, documents };
}
