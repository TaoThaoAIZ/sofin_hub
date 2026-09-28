import { courseService } from '../courses/courses.service.js';
import { inMemoryEnrollmentRepository, type EnrollmentRepository } from './enrollments.repository.js';

export function createEnrollmentService(repo: EnrollmentRepository = inMemoryEnrollmentRepository) {
  return {
    isEnrolled: (userId: string, courseId: string) => repo.isEnrolled(userId, courseId),

    async toggle(userId: string, courseId: string) {
      await courseService.getById(courseId); // 404 nếu khóa học không tồn tại
      const current = await repo.isEnrolled(userId, courseId);
      const next = !current;
      await repo.setEnrolled(userId, courseId, next);
      return { enrolled: next };
    },
  };
}

export const enrollmentService = createEnrollmentService();
