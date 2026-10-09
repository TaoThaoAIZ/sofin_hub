import { seedVnd } from '../../db/enums.js';
import type { Category, CategoryId, NewCommunity, CourseStatus, CourseTag, Language, Pricing, Visibility } from './community.types.js';

export const categories: Category[] = [
  { id: 'business', name: 'Kinh doanh' },
  { id: 'content', name: 'Sáng tạo nội dung' },
  { id: 'tech', name: 'Công nghệ' },
  { id: 'finance', name: 'Tài chính' },
  { id: 'health', name: 'Sức khỏe' },
  { id: 'self', name: 'Phát triển bản thân' },
  { id: 'hobby', name: 'Sở thích' },
  { id: 'relationships', name: 'Mối quan hệ' },
  { id: 'music', name: 'Âm nhạc' },
  { id: 'sports', name: 'Thể thao' },
  { id: 'spirituality', name: 'Tâm linh' },
];

type Row = {
  id: string;
  img: string;
  category: CategoryId;
  tag: CourseTag | null;
  title: string;
  description: string;
  instructor: [name: string, role: string];
  lessons: number;
  minutes: number;
  students: number;
  rating: [value: number, count: number];
  price: number;
  pricing?: Pricing;
  visibility?: Visibility;
  status?: CourseStatus;
  language?: Language;
};

const rows: Row[] = [
  { id: 'ai', img: 'ai', category: 'content', tag: 'hot', title: 'AI Video Mastery', description: 'Học cách tạo video AI từ ý tưởng đến thành phẩm với các công cụ hiện đại nhất.', instructor: ['Nguyễn Văn Nam', 'Creator & AI Expert'], lessons: 18, minutes: 380, students: 2400, rating: [4.9, 320], price: 7 },
  { id: 'yt', img: 'yt', category: 'content', tag: 'bestseller', title: 'Kiếm tiền với YouTube', description: 'Xây dựng kênh YouTube từ A–Z, tạo nội dung thu hút và kiếm tiền bền vững.', instructor: ['Trần Minh Tùng', 'YouTuber • 500K Subscribers'], lessons: 24, minutes: 495, students: 3100, rating: [4.8, 210], price: 12 },
  { id: 'biz', img: 'biz', category: 'business', tag: 'new', title: 'Xây dựng doanh nghiệp Online', description: 'Học cách xây dựng, vận hành và phát triển doanh nghiệp online hiệu quả.', instructor: ['Lê Thu Hà', 'Business Coach'], lessons: 22, minutes: 460, students: 1900, rating: [4.9, 186], price: 9 },
  { id: 'mkt', img: 'mkt', category: 'business', tag: 'hot', title: 'Marketing thực chiến', description: 'Lên chiến lược, chạy quảng cáo và đo lường hiệu quả cho sản phẩm của bạn.', instructor: ['Phạm Quốc Bảo', 'Growth Marketer'], lessons: 20, minutes: 410, students: 2800, rating: [4.8, 152], price: 15 },
  { id: 'fin', img: 'fin', category: 'finance', tag: 'bestseller', title: 'Đầu tư cho người mới', description: 'Nắm vững nền tảng tài chính cá nhân và bắt đầu đầu tư an toàn.', instructor: ['Hoàng Minh Anh', 'Chuyên gia tài chính'], lessons: 16, minutes: 330, students: 4200, rating: [4.9, 402], price: 5, visibility: 'private' },
  { id: 'des', img: 'des', category: 'tech', tag: 'new', title: 'Thiết kế với Figma', description: 'Từ wireframe đến prototype hoàn chỉnh, thiết kế giao diện chuyên nghiệp.', instructor: ['Đỗ Khánh Linh', 'Product Designer'], lessons: 19, minutes: 370, students: 1600, rating: [4.7, 98], price: 10 },
  { id: 'eng', img: 'eng', category: 'self', tag: 'bestseller', title: 'Tiếng Anh giao tiếp', description: 'Tự tin giao tiếp tiếng Anh trong công việc và cuộc sống hằng ngày.', instructor: ['Vũ Thanh Mai', 'IELTS 8.5 • Giảng viên'], lessons: 30, minutes: 605, students: 5300, rating: [4.9, 518], price: 8, language: 'en' },
  { id: 'fit', img: 'fit', category: 'health', tag: 'new', title: 'Sống khỏe mỗi ngày', description: 'Xây dựng thói quen vận động, dinh dưỡng và nghỉ ngơi khoa học.', instructor: ['Ngô Đức Huy', 'Huấn luyện viên sức khỏe'], lessons: 14, minutes: 285, students: 1200, rating: [4.8, 76], price: 0, pricing: 'free' },
  { id: 'py', img: 'ai', category: 'tech', tag: 'hot', title: 'Lập trình Python cơ bản', description: 'Viết chương trình đầu tiên và tự động hóa công việc với Python.', instructor: ['Trần Quang Khải', 'Kỹ sư phần mềm'], lessons: 26, minutes: 510, students: 3600, rating: [4.9, 274], price: 7 },
  { id: 'ps', img: 'yt', category: 'self', tag: 'new', title: 'Nói trước đám đông', description: 'Làm chủ giọng nói, ngôn ngữ cơ thể và tự tin thuyết trình.', instructor: ['Nguyễn Hải Yến', 'Diễn giả'], lessons: 15, minutes: 260, students: 1400, rating: [4.8, 88], price: 12, status: 'completed' },
  { id: 'ecom', img: 'biz', category: 'business', tag: 'bestseller', title: 'Bán hàng trên TikTok Shop', description: 'Xây dựng gian hàng, livestream và tối ưu doanh số trên TikTok.', instructor: ['Lý Gia Bảo', 'Nhà bán hàng top 1%'], lessons: 21, minutes: 425, students: 4800, rating: [4.8, 390], price: 9 },
  { id: 'photo', img: 'mkt', category: 'hobby', tag: 'new', title: 'Nhiếp ảnh bằng điện thoại', description: 'Chụp và chỉnh ảnh đẹp chỉ với chiếc điện thoại của bạn.', instructor: ['Mai Phương', 'Nhiếp ảnh gia'], lessons: 12, minutes: 220, students: 2100, rating: [4.7, 131], price: 0, pricing: 'free' },
  { id: 'data', img: 'fin', category: 'tech', tag: 'hot', title: 'Phân tích dữ liệu với Excel', description: 'Xử lý, trực quan hóa dữ liệu và ra quyết định nhanh hơn.', instructor: ['Đặng Tuấn Anh', 'Data Analyst'], lessons: 23, minutes: 470, students: 3900, rating: [4.9, 305], price: 5 },
  { id: 'lead', img: 'des', category: 'business', tag: 'bestseller', title: 'Kỹ năng lãnh đạo', description: 'Dẫn dắt đội nhóm, giao việc hiệu quả và tạo động lực.', instructor: ['Bùi Thanh Sơn', 'CEO & Mentor'], lessons: 18, minutes: 360, students: 2700, rating: [4.8, 164], price: 10, visibility: 'private' },
  { id: 'yoga', img: 'eng', category: 'health', tag: 'new', title: 'Yoga cho người bận rộn', description: 'Chuỗi bài tập 20 phút mỗi ngày giúp cơ thể dẻo dai.', instructor: ['Trịnh Ngọc Hân', 'Giáo viên Yoga'], lessons: 20, minutes: 310, students: 1800, rating: [4.9, 142], price: 8 },
  { id: 'cook', img: 'fit', category: 'hobby', tag: 'bestseller', title: 'Nấu ăn gia đình', description: 'Thực đơn đơn giản, ngon miệng và đủ dinh dưỡng mỗi ngày.', instructor: ['Phan Thu Trang', 'Đầu bếp'], lessons: 25, minutes: 405, students: 2300, rating: [4.8, 119], price: 19 },
  { id: 'ux', img: 'ai', category: 'tech', tag: 'hot', title: 'UX Research thực tế', description: 'Phỏng vấn người dùng, kiểm thử và biến insight thành sản phẩm.', instructor: ['Hồ Minh Châu', 'UX Researcher'], lessons: 17, minutes: 325, students: 1100, rating: [4.7, 64], price: 7, status: 'soon' },
  { id: 'write', img: 'yt', category: 'content', tag: 'new', title: 'Viết content bán hàng', description: 'Công thức viết bài thu hút, chuyển đổi cao cho mọi kênh.', instructor: ['Lâm Nhật Vy', 'Copywriter'], lessons: 16, minutes: 295, students: 2900, rating: [4.8, 201], price: 12 },
  { id: 'crypto', img: 'biz', category: 'finance', tag: 'bestseller', title: 'Hiểu về Blockchain', description: 'Kiến thức nền tảng về blockchain, ví và rủi ro khi đầu tư.', instructor: ['Chu Văn Long', 'Chuyên gia Web3'], lessons: 14, minutes: 250, students: 1500, rating: [4.6, 72], price: 9, status: 'soon' },
  { id: 'music', img: 'mkt', category: 'hobby', tag: 'new', title: 'Học guitar từ số 0', description: 'Hợp âm cơ bản, điệu đệm và chơi trọn bài hát yêu thích.', instructor: ['Tạ Quốc Việt', 'Nghệ sĩ guitar'], lessons: 22, minutes: 395, students: 2000, rating: [4.9, 158], price: 15 },
  { id: 'rel', img: 'fin', category: 'relationships', tag: 'new', title: 'Giao tiếp trong các mối quan hệ', description: 'Lắng nghe, đồng cảm và giải quyết xung đột trong gia đình, bạn bè và công việc.', instructor: ['Vương Bích Ngọc', 'Chuyên gia tâm lý'], lessons: 13, minutes: 240, students: 1300, rating: [4.8, 57], price: 6 },
];

const DAY = 24 * 60 * 60 * 1000;
const seedEpoch = Date.UTC(2026, 8, 1);

export const seedCommunities: NewCommunity[] = rows.map((r, i) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  tag: r.tag,
  thumbnail: `/images/courses/${r.img}.webp`,
  instructor: { name: r.instructor[0], role: r.instructor[1] },
  lessons: r.lessons,
  durationMinutes: r.minutes,
  students: r.students,
  rating: r.rating[0],
  ratingCount: r.rating[1],
  priceUsd: seedVnd(r.price),
  pricing: r.pricing ?? 'paid',
  visibility: r.visibility ?? 'public',
  status: r.status ?? 'open',
  language: r.language ?? 'vi',
  // Thứ tự khai báo = thứ tự "Đang nổi"; khóa khai báo trước được coi là mới hơn.
  createdAt: new Date(seedEpoch - i * 3 * DAY).toISOString(),
}));

/** Thứ tự khai báo dùng làm xếp hạng "Đang nổi" cho tới khi có số liệu thật. */
export const trendingRank: ReadonlyMap<string, number> = new Map(seedCommunities.map((c, i) => [c.id, i]));
