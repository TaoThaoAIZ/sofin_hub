import type { Course } from './course.types.js';

export interface CourseHighlight {
  title: string;
  desc: string;
  icon: string;
}

export interface CourseModule {
  index: number;
  title: string;
  meta: string;
}

export interface CourseFaq {
  question: string;
  answer: string;
}

export interface CourseReview {
  name: string;
  time: string;
  color: string;
  text: string;
}

export interface CourseFact {
  label: string;
  value: string;
  icon: string;
  bg: string;
  fg: string;
}

export interface CourseDetail extends Course {
  about: string;
  highlights: CourseHighlight[];
  gains: CourseHighlight[];
  priceNotes: string[];
  modules: CourseModule[];
  faqs: CourseFaq[];
  reviews: CourseReview[];
  facts: CourseFact[];
  stats: { members: number; online: number; admins: number };
  /** true/false nếu người xem đã đăng nhập, undefined nếu chưa đăng nhập. */
  viewerEnrolled?: boolean;
}

// Nội dung minh họa dùng chung cho mọi khóa học (chưa có hệ thống soạn nội dung khóa học riêng, xem PLAN.md Phase 4).
const HIGHLIGHTS: CourseHighlight[] = [
  { title: '1. Kiến thức nền tảng', desc: 'Khóa học nền tảng, bài viết và livestream chia sẻ.', icon: 'M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5' },
  { title: '2. Định hướng lộ trình', desc: 'Tư vấn 1:1, lộ trình phù hợp năng lực và mục tiêu.', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z' },
  { title: '3. Tài nguyên thực chiến', desc: 'Kho tài liệu, quy trình và công cụ dùng thật mỗi ngày.', icon: 'M3 7h18v13H3zM8 7V4h8v3M3 13h18' },
  { title: '4. Dự án thực tế', desc: 'Bài tập, review và phản hồi chi tiết từ đội ngũ.', icon: 'M6 2h9l5 5v15H6zM14 2v6h6M9 13h6M9 17h6' },
  { title: '5. Phát triển kỹ năng', desc: 'Kỹ năng mềm, công cụ và quản lý thời gian hiệu quả.', icon: 'M4 20V12M10 20V6M16 20v-9M22 20H2M16 4l4 3-4 3' },
  { title: '6. Networking', desc: 'Kết nối thành viên, chia sẻ cơ hội và hợp tác dài hạn.', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6' },
];

const GAINS: CourseHighlight[] = [
  { title: 'Nội dung chất lượng', desc: 'Bài học chọn lọc, cập nhật thường xuyên', icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01' },
  { title: 'Kiến thức thực chiến', desc: 'Q&A, webinar hàng tuần, case study thực tế', icon: 'M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z' },
  { title: 'Cộng đồng hỗ trợ', desc: 'Kết nối, chia sẻ và học hỏi từ thành viên', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6' },
  { title: 'Bộ công cụ làm việc', desc: 'Template, checklist, hướng dẫn chi tiết', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z' },
  { title: 'Cập nhật liên tục', desc: 'Xu hướng mới và thông tin hữu ích', icon: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5' },
];

const PRICE_NOTES = [
  'Miễn phí dùng thử 7 ngày',
  'Hủy bất kỳ lúc nào',
  'Một thẻ thanh toán dùng cho cả năm',
  'Bảo mật thanh toán, chỉ mất 1 lần',
];

const FAQS: CourseFaq[] = [
  { question: 'Tôi có thể hủy bất cứ lúc nào không?', answer: 'Có. Bạn có thể hủy gói tháng bất cứ lúc nào, không mất phí.' },
  { question: 'Người mới có theo được không?', answer: 'Lộ trình bắt đầu từ con số 0, có người hỗ trợ khi bạn gặp khó.' },
  { question: 'Học trên thiết bị nào?', answer: 'Web, điện thoại và máy tính bảng.' },
];

const REVIEW_POOL: CourseReview[] = [
  { name: 'Nguyễn Xuân', time: '8 giờ trước', color: '#fdba74', text: 'Nội dung rất thực tế, cộng đồng hỗ trợ nhiệt tình. Áp dụng được ngay sau 2 tuần!' },
  { name: 'Oanh Nguyễn', time: '12 giờ trước', color: '#93c5fd', text: 'Kiến thức chất lượng, dễ áp dụng. Mentor phản hồi rất nhanh.' },
  { name: 'Anh Văn', time: '16 giờ trước', color: '#86efac', text: 'Cộng đồng rất năng động, nhiều cơ hội để kết nối với mentor.' },
  { name: 'Minh Châu', time: '1 ngày trước', color: '#c4b5fd', text: 'Lộ trình rõ ràng, bài tập sát thực tế. Rất đáng tiền.' },
  { name: 'Quốc Bảo', time: '2 ngày trước', color: '#fde68a', text: 'Mình đã áp dụng được ngay phần lớn kiến thức vào công việc hằng ngày.' },
  { name: 'Thu Hà', time: '3 ngày trước', color: '#fca5a5', text: 'Mentor nhiệt tình, trả lời câu hỏi rất chi tiết.' },
  { name: 'Gia Huy', time: '5 ngày trước', color: '#a5f3fc', text: 'Tài liệu và quy trình cực kỳ hữu ích, dùng được ngay.' },
];

const MODULE_TITLES = [
  'Khởi động: tư duy nền tảng',
  'Kỹ năng và công cụ cốt lõi',
  'Thực hành trên tình huống thật',
  'Tối ưu & mở rộng kết quả',
  'Dự án thực chiến cuối khóa',
];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function buildModules(course: Course): CourseModule[] {
  const count = Math.min(MODULE_TITLES.length, Math.max(3, Math.round(course.lessons / 5)));
  const lessonsLeft = course.lessons;
  const perModule = Math.max(1, Math.round(course.lessons / count));
  const minutesPerLesson = course.durationMinutes / Math.max(1, course.lessons);
  return Array.from({ length: count }, (_, i) => {
    const lessons = i === count - 1 ? lessonsLeft - perModule * (count - 1) : perModule;
    const minutes = Math.max(5, Math.round(lessons * minutesPerLesson));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const duration = h > 0 ? `${h} giờ${m ? ` ${m} phút` : ''}` : `${m} phút`;
    return { index: i + 1, title: MODULE_TITLES[i]!, meta: `${Math.max(1, lessons)} bài học · ${duration}` };
  });
}

export function buildCourseDetail(course: Course, viewerEnrolled?: boolean): CourseDetail {
  const seed = hashSeed(course.id);
  const online = Math.min(course.students, Math.max(2, Math.round(course.students / 350) + (seed % 5)));
  const reviews = REVIEW_POOL.slice(0, Math.max(1, Math.min(REVIEW_POOL.length, Math.round(course.ratingCount / 20) + 3)));

  const facts: CourseFact[] = [
    { label: 'Thành viên', value: course.students.toLocaleString('vi-VN'), bg: '#ffe7d4', fg: '#f26a1b', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6' },
    { label: 'Bài học', value: String(course.lessons), bg: '#ede9fe', fg: '#7c3aed', icon: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z' },
    { label: 'Quản trị viên', value: '1', bg: '#dcfce7', fg: '#16a34a', icon: 'M4 5h16v11H9l-5 4zM8 10h.01M12 10h.01M16 10h.01' },
    { label: 'Chi phí tham gia', value: course.priceUsd === 0 ? 'Miễn phí' : `$${course.priceUsd}/tháng`, bg: '#ffe4e6', fg: '#e11d48', icon: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01' },
    { label: 'Cộng đồng', value: course.visibility === 'private' ? 'Riêng tư' : 'Công khai', bg: '#dbeafe', fg: '#2563eb', icon: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4' },
  ];

  return {
    ...course,
    about: `${course.description} Tại đây, bạn được cung cấp kiến thức thực chiến, tài nguyên chọn lọc và sự đồng hành từ đội ngũ có kinh nghiệm.`,
    highlights: HIGHLIGHTS,
    gains: GAINS.map((g, i) => (i === 1 ? { ...g, desc: `Tư vấn lộ trình cùng ${course.instructor.name}` } : g)),
    priceNotes: PRICE_NOTES,
    modules: buildModules(course),
    faqs: FAQS,
    reviews,
    facts,
    stats: { members: course.students, online, admins: 1 },
    viewerEnrolled,
  };
}
