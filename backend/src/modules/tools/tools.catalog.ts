// Danh mục tool đang bán (trang /tools + chatbot dùng chung, xem chatbot.md mục 3.5).
// Nguồn gốc: https://taothaoai.com/tools (taothao_ai_training/src/lib/toolsCatalog.ts). Ảnh icon nằm ở frontend/public/images/tools/.
export type ToolCategory = 'Video AI' | 'Automation' | 'Voice AI' | 'VIP';

export interface DownloadTool {
  id: string;
  name: string;
  desc: string;
  /** Đường dẫn ảnh phía frontend (public/). */
  icon: string;
  category: ToolCategory;
  tags: string[];
  free: boolean;
  /** Chỉ tool miễn phí: link tải (mở tab mới). Tool có phí mua qua form "Mua ngay" (POST /api/tools/lead). */
  downloadUrl?: string;
  badge?: 'HOT' | 'MỚI';
}

export const TOOL_CATEGORIES: ToolCategory[] = ['Video AI', 'Automation', 'Voice AI', 'VIP'];

export const TOOLS: readonly DownloadTool[] = [
  {
    id: 'tool-microdrama-seedance-2',
    name: 'Tool MicroDrama – Seedance 2.0',
    desc: 'Hệ thống VIP dành cho lộ trình chuyển giao công nghệ, nhập toàn bộ câu chuyện, tự phân tích nhân vật, bối cảnh, số tập, chia từng cảnh, tính thời lượng, tạo hình nhân vật và dựng video theo workflow xuyên suốt. Có thể dùng Full Seedance, Full Grok hoặc kết hợp cả 2, hậu kỳ trước khi xuất phim hoàn chỉnh.',
    icon: '/images/tools/crystal-chang-03-duc-vu-khi.png',
    category: 'VIP',
    tags: ['Seedance 2.0', 'VIP', 'MicroDrama'],
    free: true,
    downloadUrl: 'https://taothaoai.com/microdrama',
    badge: 'HOT',
  },
  {
    id: 'tool-veo',
    name: 'Tool Veo',
    desc: 'Vận hành đầy đủ các tính năng của Veo hiện có, tạo hình ảnh và video AI theo prompt, chuyển từ kho ảnh sang kho video, chạy nhiều luồng cùng lúc, thêm và quản lý nhiều tài khoản Veo trên cùng một tool. Phù hợp với người cần sản xuất số lượng lớn.',
    icon: '/images/tools/crystal-daike-01.png',
    category: 'Video AI',
    tags: ['Veo', 'Multi-account', 'Đa luồng'],
    free: false,
  },
  {
    id: 'tool-youtube-automation-ai-2026',
    name: 'Tool YouTube Automation AI 2026 – AI Agent',
    desc: 'Hệ thống sản xuất nội dung toàn diện: Ý tưởng → Kịch bản → Voice không giới hạn ký tự → Tạo hình ảnh → Video AI bằng Grok hoặc Veo → Ghép CapCut → Video hoàn chỉnh. Được tặng custom riêng theo đúng ngách, từ khoá và kênh đối thủ khách đang làm, đồng thời bảo mật toàn bộ workflow, key ngách và dữ liệu dự án, không chia sẻ cho khách hàng khác.',
    icon: '/images/tools/tool-11-vision-ai.png',
    category: 'Automation',
    tags: ['YouTube', 'AI Agent', 'Automation'],
    free: false,
    badge: 'MỚI',
  },
  {
    id: 'tool-grok-automation',
    name: 'Tool Grok Automation',
    desc: 'Vận hành đầy đủ các tính năng của Grok, tạo ảnh, tạo video, xây nội dung theo prompt. Hỗ trợ thêm nhiều tài khoản Grok, chạy số lượng lớn và kết hợp hệ thống nuôi profile để quản lý, vận hành tự động hơn.',
    icon: '/images/tools/crystal-expert-cong-binh.png',
    category: 'Automation',
    tags: ['Grok', 'Automation', 'Multi-account'],
    free: false,
  },
  {
    id: 'tool-cloud-profile',
    name: 'Tool CloudProfile',
    desc: 'Hệ thống chuyên dùng để tạo, quản lý và nuôi nhiều profile, hỗ trợ phân chia tài khoản, môi trường đăng nhập và quy trình vận hành. Phù hợp với người đã có tool tạo nội dung nhưng cần quản lý hệ thống tài khoản ổn định hơn.',
    icon: '/images/tools/crystal-daike-02.png',
    category: 'Automation',
    tags: ['Profile', 'Cloud', 'Quản lý tài khoản'],
    free: false,
  },
  {
    id: 'tool-voice-ngoai-viet',
    name: 'Tool Voice ngoại và Voice Việt',
    desc: 'Hỗ trợ tạo giọng đọc với nhiều ngôn ngữ, chất giọng, độ tuổi và phong cách khác nhau. Dùng được cho video YouTube, phim AI, quảng cáo, kể chuyện và các dự án cần sản xuất voice số lượng lớn.',
    icon: '/images/tools/crystal-persona-muu-si.png',
    category: 'Voice AI',
    tags: ['Voice AI', 'Đa ngôn ngữ', 'Tiếng Việt'],
    free: false,
  },
  {
    id: 'tool-voice-giai-captcha',
    name: 'Tool Voice giải CAPTCHA',
    desc: 'Hỗ trợ triển khai quy trình từ ý tưởng, nội dung đến tạo giọng theo yêu cầu, phù hợp với các nguồn voice có bước xác minh CAPTCHA. Khách hàng chịu phần chi phí giải CAPTCHA phát sinh trong quá trình sử dụng.',
    icon: '/images/tools/tool-10-cam-bien.png',
    category: 'Voice AI',
    tags: ['Voice AI', 'CAPTCHA'],
    free: false,
  },
];
