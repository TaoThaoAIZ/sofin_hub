/**
 * Lớp truy cập dữ liệu tham gia khóa học. Hiện lưu trong bộ nhớ (mất khi restart server);
 * khi có DB chỉ cần thay implementation này, service/controller giữ nguyên.
 */
export interface EnrollmentRepository {
  isEnrolled(userId: string, courseId: string): Promise<boolean>;
  setEnrolled(userId: string, courseId: string, enrolled: boolean): Promise<void>;
}

const key = (userId: string, courseId: string) => `${userId}:${courseId}`;
const enrollments = new Set<string>();

export const inMemoryEnrollmentRepository: EnrollmentRepository = {
  async isEnrolled(userId, courseId) {
    return enrollments.has(key(userId, courseId));
  },

  async setEnrolled(userId, courseId, enrolled) {
    if (enrolled) enrollments.add(key(userId, courseId));
    else enrollments.delete(key(userId, courseId));
  },
};
