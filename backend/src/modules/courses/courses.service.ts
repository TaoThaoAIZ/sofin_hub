import { HttpError } from '../../utils/http-error.js';
import { buildCourseDetail, type CourseDetail, type CourseReview } from './course-detail.js';
import type { Course, CoursePatch } from './course.types.js';
import { courseRepository, type CourseRepository } from './courses.repository.js';
import type { ListCoursesQuery } from './courses.schema.js';

export function createCourseService(repo: CourseRepository = courseRepository) {
  return {
    async list(query: ListCoursesQuery) {
      const { items, total } = await repo.findMany(query);
      return {
        data: items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) },
      };
    },

    async getById(id: string): Promise<Course> {
      const course = await repo.findById(id);
      if (!course) throw HttpError.notFound('Không tìm thấy khóa học');
      return course;
    },

    async getDetailById(id: string, viewerEnrolled?: boolean, realReviews: CourseReview[] = []): Promise<CourseDetail> {
      const course = await this.getById(id);
      // Số liệu "Thành viên / Quản trị viên / Online" lấy từ Enrollment thật; nội dung minh họa (highlights, faqs...) vẫn sinh khi đọc.
      const { online, admins } = await repo.memberStats(id);
      return buildCourseDetail(course, viewerEnrolled, realReviews, { online, admins });
    },

    create: (course: Course) => repo.create(course),
    idExists: (id: string) => repo.idExists(id),

    async update(id: string, patch: CoursePatch): Promise<Course> {
      const updated = await repo.update(id, patch);
      if (!updated) throw HttpError.notFound('Không tìm thấy khóa học');
      return updated;
    },

    /** Lý do bị khóa (Course.lockReason) — undefined nếu cộng đồng không bị khóa. */
    getLockReason: (id: string) => repo.getLockReason(id),

    /**
     * Giữ chữ ký cũ cho enrollmentService: `students` giờ được TÍNH khi đọc (số nền của seed + thành viên thật
     * từ bảng Enrollment) nên không cần đồng bộ nữa.
     */
    async syncStudents(_id: string, _memberCount: number): Promise<void> {},
  };
}

export const courseService = createCourseService();
