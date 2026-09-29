import { HttpError } from '../../utils/http-error.js';
import { courseService } from '../courses/courses.service.js';
import { enrollmentRepository, type BanInfo, type EnrollmentRepository, type MemberRole } from './enrollments.repository.js';

export function createEnrollmentService(repo: EnrollmentRepository = enrollmentRepository) {
  /** `students` được tính khi đọc từ bảng Enrollment nên không còn cần đồng bộ; giữ điểm gọi để các luồng không đổi. */
  const syncStudents = async (_courseId: string) => {};

  return {
    isEnrolled: (userId: string, courseId: string) => repo.isEnrolled(userId, courseId),
    listMembers: (courseId: string) => repo.listMembers(courseId),
    listByUser: (userId: string) => repo.listByUser(userId),
    getMember: (userId: string, courseId: string) => repo.getMember(userId, courseId),
    setRole: (userId: string, courseId: string, role: MemberRole) => repo.setRole(userId, courseId, role),
    setBanned: (userId: string, courseId: string, banned: boolean, info?: BanInfo) => repo.setBanned(userId, courseId, banned, info),
    isBanned: (userId: string, courseId: string) => repo.isBanned(userId, courseId),
    touchActivity: (userId: string, courseId: string) => repo.touchActivity(userId, courseId),

    async toggle(userId: string, courseId: string) {
      const course = await courseService.getById(courseId); // 404 nếu khóa học không tồn tại
      if (await repo.isBanned(userId, courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      const current = await repo.isEnrolled(userId, courseId);
      const next = !current;
      // Chỉ "vào" mới bị chặn theo loại cộng đồng; rời đi luôn được (trừ owner, xử lý dưới).
      if (next) {
        if (course.locked) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
        if (course.visibility === 'private') {
          throw HttpError.coded(403, 'JOIN_REQUEST_REQUIRED', 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời');
        }
        if (course.priceUsd > 0) {
          throw HttpError.coded(402, 'PAYMENT_REQUIRED', 'Cộng đồng có phí: vui lòng thanh toán để tham gia', { courseId });
        }
      }
      // Owner không được "rời" cộng đồng của chính mình (phải chuyển quyền/xoá cộng đồng trước).
      if (current && (await repo.getMember(userId, courseId))?.role === 'owner') {
        throw HttpError.conflict('Chủ cộng đồng không thể rời cộng đồng của mình');
      }
      await repo.setEnrolled(userId, courseId, next);
      await syncStudents(courseId);
      return { enrolled: next };
    },

    /** Cấp quyền truy cập trực tiếp (không đảo trạng thái) — dùng sau khi xác nhận thanh toán thành công. */
    async grant(userId: string, courseId: string, role: MemberRole = 'member'): Promise<void> {
      if (await repo.isBanned(userId, courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      await repo.setEnrolled(userId, courseId, true, role);
      await syncStudents(courseId);
    },

    /** Xóa thành viên khỏi cộng đồng (kick) — khác với toggle: không kiểm tra người gọi là ai (policy làm ở tầng route). */
    remove: async (userId: string, courseId: string) => {
      await repo.setEnrolled(userId, courseId, false);
      await syncStudents(courseId);
    },

    /**
     * Chặn ở server (không tin riêng phía FE) cho mọi nội dung trong trang Cộng đồng
     * (bảng tin, lớp học, lịch, thành viên, xếp hạng): phải đã tham gia khóa học/cộng đồng này.
     * Cũng cập nhật "hoạt động gần nhất" cho tab Thành viên.
     */
    async requireMembership(userId: string, courseId: string): Promise<void> {
      // Cộng đồng bị khóa: chặn mọi người trừ Platform Admin (import động để tránh vòng phụ thuộc với policy).
      if ((await courseService.getById(courseId)).locked) {
        const { isPlatformAdmin } = await import('../permissions/policy.js');
        if (!(await isPlatformAdmin(userId))) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
      }
      const enrolled = await repo.isEnrolled(userId, courseId);
      if (!enrolled) {
        // Platform Admin ghi đè mọi cộng đồng (xem policy.ts) — không cần tham gia mới vào được để xử lý vi phạm.
        const { isPlatformAdmin } = await import('../permissions/policy.js');
        if (await isPlatformAdmin(userId)) return;
        throw HttpError.forbidden('Bạn cần tham gia cộng đồng này trước');
      }
      await repo.touchActivity(userId, courseId);
    },
  };
}

export const enrollmentService = createEnrollmentService();
