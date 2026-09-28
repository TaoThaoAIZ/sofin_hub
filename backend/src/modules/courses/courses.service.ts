import { HttpError } from '../../utils/http-error.js';
import { buildCourseDetail, type CourseDetail } from './course-detail.js';
import type { Course } from './course.types.js';
import { inMemoryCourseRepository, type CourseRepository } from './courses.repository.js';
import type { ListCoursesQuery } from './courses.schema.js';

export function createCourseService(repo: CourseRepository = inMemoryCourseRepository) {
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

    async getDetailById(id: string, viewerEnrolled?: boolean): Promise<CourseDetail> {
      const course = await this.getById(id);
      return buildCourseDetail(course, viewerEnrolled);
    },
  };
}

export const courseService = createCourseService();
