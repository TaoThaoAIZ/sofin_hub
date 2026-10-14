import { BUNDLED_KB_DIR, importKnowledgeDir } from '../../src/modules/chatbot/chatbot.import.js';
import type { SeedContext } from './context.js';

/**
 * Chatbot: kho câu hỏi mẫu ban đầu = FAQ công khai (frontend/src/i18n/locales/vi/legal.json, khóa `faq.*`), viết lại theo giọng
 * của bot (Tào/bạn, ngắn) + tài liệu tri thức đi kèm repo (prisma/chatbot-kb: lỗi tool, Ngân Lượng/báo giá).
 *
 * Idempotent: id xác định `seed-chatbot-qa-<key>` + createMany(skipDuplicates) — admin sửa nội dung rồi seed lại không bị ghi đè.
 */
interface SeedQa {
  key: string;
  question: string;
  variants: string[];
  answer: string;
  tags: string[];
}

export const CHATBOT_FAQ: SeedQa[] = [
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

export async function seedChatbot({ db }: SeedContext): Promise<void> {
  await db.chatbotQA.createMany({
    data: CHATBOT_FAQ.map((q) => ({
      id: `seed-chatbot-qa-${q.key}`,
      question: q.question,
      variants: q.variants,
      answer: q.answer,
      tags: q.tags,
      status: 'active' as const,
      source: 'admin' as const,
    })),
    skipDuplicates: true,
  });
  await importKnowledgeDir(BUNDLED_KB_DIR);
}
