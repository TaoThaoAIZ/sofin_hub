import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import type { CourseReview } from '../courses/course-detail.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { canManageContent } from '../permissions/policy.js';
import { communitiesRepository, type CommunitiesRepository } from './communities.repository.js';
import type { Review } from './communities.types.js';

const COLORS = ['#fdba74', '#93c5fd', '#86efac', '#c4b5fd', '#fde68a', '#fca5a5', '#a5f3fc'];
const colorFor = (userId: string) => {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length]!;
};

/** "8 giờ trước"... cho trang chi tiết khóa học (cùng định dạng với đánh giá minh họa). */
function relativeTime(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  if (min < 60 * 24) return `${Math.floor(min / 60)} giờ trước`;
  return `${Math.floor(min / (60 * 24))} ngày trước`;
}

/**
 * Course.rating/ratingCount = điểm nền của seed + đánh giá thật; việc tính lại nằm trong repository, chạy atomically
 * trong cùng transaction với ghi/xóa Review (xem recalcCourseRating).
 */
export function createReviewsService(repo: CommunitiesRepository = communitiesRepository) {
  const view = async (r: Review) => ({
    id: r.id,
    userId: r.userId,
    name: (await userBriefView(r.userId)).name,
    rating: r.rating,
    text: r.text,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  });

  return {
    async list(courseId: string, page: number, limit: number) {
      const course = await courseService.getById(courseId);
      const [rows, total] = await Promise.all([
        repo.listReviews(courseId, { skip: (page - 1) * limit, take: limit }),
        repo.countReviews(courseId),
      ]);
      return {
        data: await Promise.all(rows.map(view)),
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        summary: { rating: course.rating, ratingCount: course.ratingCount },
      };
    },

    /** Đánh giá thật (mới nhất trước) ở định dạng của trang chi tiết khóa học. */
    async forDetail(courseId: string, max = 5): Promise<CourseReview[]> {
      const rows = await repo.listReviews(courseId, { take: max });
      return Promise.all(
        rows.map(async (r) => ({
          name: (await userBriefView(r.userId)).name,
          time: relativeTime(r.updatedAt),
          color: colorFor(r.userId),
          text: r.text || `Đã đánh giá ${r.rating} sao`,
          rating: r.rating,
        })),
      );
    },

    /** 1 review / user / cộng đồng: gọi lại thì cập nhật. */
    async upsert(userId: string, courseId: string, input: { rating: number; text: string }) {
      await courseService.getById(courseId);
      await enrollmentService.requireMembership(userId, courseId);
      const { review, created } = await repo.upsertReview(courseId, userId, input.rating, input.text);
      return { review: await view(review), created };
    },

    async removeMine(userId: string, courseId: string) {
      await courseService.getById(courseId);
      const existing = await repo.findReview(courseId, userId);
      if (!existing) throw HttpError.notFound('Bạn chưa đánh giá cộng đồng này');
      await repo.deleteReview(existing.id);
    },

    /** Tác giả, mod+ của cộng đồng hoặc Platform Admin được xóa. */
    async removeById(userId: string, reviewId: string) {
      const review = await repo.findReviewById(reviewId);
      if (!review) throw HttpError.notFound('Không tìm thấy đánh giá');
      if (!(await canManageContent(userId, review.courseId, review.userId, 'mod'))) throw HttpError.forbidden();
      await repo.deleteReview(reviewId);
    },
  };
}

export const reviewsService = createReviewsService();
