import { HttpError } from '../../utils/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { classroomRepository } from '../classroom/classroom.repository.js';
import type { Course } from '../courses/course.types.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { pointsService } from '../points/points.service.js';

export interface CourseBrief {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  visibility: string;
}

const toBrief = (c: Course): CourseBrief => ({
  id: c.id,
  title: c.title,
  thumbnail: c.thumbnail,
  category: c.category,
  visibility: c.visibility,
});

async function findCourse(id: string): Promise<Course | undefined> {
  try {
    return await courseService.getById(id);
  } catch {
    return undefined;
  }
}

export const usersService = {
  /** Hồ sơ công khai: KHÔNG có email; chỉ liệt kê cộng đồng công khai. */
  async publicProfile(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user || user.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng');
    const memberships = await enrollmentService.listByUser(userId);
    const communities = [];
    for (const m of memberships) {
      const course = await findCourse(m.courseId);
      if (!course || course.visibility !== 'public') continue;
      communities.push({ course: toBrief(course), role: m.role, joinedAt: m.enrolledAt });
    }
    const points = await pointsService.summaryForUser(userId, 0);
    return {
      id: user.id,
      name: `${user.firstName} ${user.lastName}`,
      bio: user.bio ?? null,
      location: user.location ?? null,
      website: user.website ?? null,
      avatarUrl: user.avatarUrl ?? null,
      joinedAt: user.createdAt,
      communities,
      totalPoints: points.total,
    };
  },

  async myEnrollments(userId: string) {
    const memberships = await enrollmentService.listByUser(userId);
    const items = [];
    for (const m of memberships) {
      const course = await findCourse(m.courseId);
      if (!course) continue;
      // Tiến độ = bài đã hoàn thành / tổng bài trong lớp học (mỗi khóa 2 truy vấn).
      const modules = await classroomRepository.getModules(course.id);
      const total = modules.reduce((sum, mod) => sum + mod.lessonIds.length, 0);
      const done = (await classroomRepository.completedAtMap(userId, course.id)).size;
      items.push({
        course: toBrief(course),
        role: m.role,
        enrolledAt: m.enrolledAt,
        progressPct: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      });
    }
    return items;
  },

  async myPoints(userId: string) {
    const summary = await pointsService.summaryForUser(userId, 20);
    const byCourse = [];
    for (const row of summary.byCourse) {
      const course = await findCourse(row.courseId);
      byCourse.push({ course: course ? toBrief(course) : { id: row.courseId }, points: row.points });
    }
    return { total: summary.total, byCourse, recent: summary.recent };
  },
};
