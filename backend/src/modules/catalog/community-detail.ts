import type { Community } from './community.types.js';

export interface CourseHighlight {
  title: string;
  desc: string;
  icon: string;
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
  /** Chỉ có ở đánh giá thật (do thành viên viết). */
  rating?: number;
}

export interface CourseFact {
  label: string;
  value: string;
  icon: string;
  bg: string;
  fg: string;
}

export interface CommunityDetail extends Community {
  /** = id (tách Community/Course; `id` vẫn là slug cộng đồng). */
  communityId: string;
  /** Khóa học mặc định (published đầu tiên) — route cũ `/courses/:id/modules|progress|certificate` thao tác trên khóa này. */
  defaultCourseId: string | null;
  coursesCount: number;
  about: string;
  highlights: CourseHighlight[];
  gains: CourseHighlight[];
  priceNotes: string[];
  faqs: CourseFaq[];
  reviews: CourseReview[];
  facts: CourseFact[];
  stats: { members: number; online: number; admins: number };
  /** true/false nếu người xem đã đăng nhập, undefined nếu chưa đăng nhập. */
  viewerEnrolled?: boolean;
}

/** Số liệu thật từ DB cho khối stats/facts/priceNotes. */
export interface RealStats {
  online: number;
  admins: number;
  /** Số bài học thật (đã xuất bản, chưa gỡ) trong lớp học. */
  lessons?: number;
  /** Số ngày dùng thử cấu hình thật (Global Settings payments.trialDays); chỉ dùng khi cộng đồng có phí. */
  trialDays?: number;
  /** Số khóa học đang xuất bản + id khóa mặc định (tách Community/Course). */
  coursesCount?: number;
  defaultCourseId?: string | null;
}

export function buildCommunityDetail(
  course: Community,
  viewerEnrolled?: boolean,
  realReviews: CourseReview[] = [],
  real?: RealStats,
): CommunityDetail {
  // Chỉ số liệu thật: không thổi phồng online, không có đánh giá minh họa.
  const online = real ? Math.min(course.students, real.online) : 0;
  const admins = real ? Math.max(1, real.admins) : 1;
  const lessons = real?.lessons ?? course.lessons;
  const reviews = realReviews;

  const facts: CourseFact[] = [
    { label: 'Thành viên', value: course.students.toLocaleString('vi-VN'), bg: '#ffe7d4', fg: '#f26a1b', icon: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6' },
    { label: 'Bài học', value: String(lessons), bg: '#ede9fe', fg: '#7c3aed', icon: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z' },
    { label: 'Quản trị viên', value: String(admins), bg: '#dcfce7', fg: '#16a34a', icon: 'M4 5h16v11H9l-5 4zM8 10h.01M12 10h.01M16 10h.01' },
    { label: 'Chi phí tham gia', value: course.priceUsd === 0 ? 'Miễn phí' : `${course.priceUsd.toLocaleString('vi-VN')}đ/tháng`, bg: '#ffe4e6', fg: '#e11d48', icon: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01' },
    { label: 'Cộng đồng', value: course.visibility === 'private' ? 'Riêng tư' : 'Công khai', bg: '#dbeafe', fg: '#2563eb', icon: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4' },
  ];

  // Ghi chú giá chỉ gồm điều thật: có phí => có dùng thử (theo cấu hình) và có thể hủy gói bất kỳ lúc nào.
  const priceNotes: string[] = [];
  if (course.priceUsd > 0) {
    if (real?.trialDays) priceNotes.push(`Miễn phí dùng thử ${real.trialDays} ngày`);
    priceNotes.push('Hủy bất kỳ lúc nào');
  }

  return {
    ...course,
    communityId: course.id,
    defaultCourseId: real?.defaultCourseId ?? null,
    coursesCount: real?.coursesCount ?? 0,
    about: course.description,
    // Chưa có hệ thống soạn "điểm nổi bật / bạn nhận được / FAQ" riêng cho từng cộng đồng => trả rỗng, FE ẩn khối.
    highlights: [],
    gains: [],
    priceNotes,
    faqs: [],
    reviews,
    facts,
    stats: { members: course.students, online, admins },
    viewerEnrolled,
  };
}
