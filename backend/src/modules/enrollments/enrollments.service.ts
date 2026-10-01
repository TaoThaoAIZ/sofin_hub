import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentRepository, type BanInfo, type EnrollmentRepository, type MemberRole } from './enrollments.repository.js';

export function createEnrollmentService(repo: EnrollmentRepository = enrollmentRepository) {
  /** `students` được tính khi đọc từ bảng Enrollment nên không còn cần đồng bộ; giữ điểm gọi để các luồng không đổi. */
  const syncStudents = async (_communityId: string) => {};

  return {
    isEnrolled: (userId: string, communityId: string) => repo.isEnrolled(userId, communityId),
    listMembers: (communityId: string) => repo.listMembers(communityId),
    listByUser: (userId: string) => repo.listByUser(userId),
    getMember: (userId: string, communityId: string) => repo.getMember(userId, communityId),
    setRole: (userId: string, communityId: string, role: MemberRole) => repo.setRole(userId, communityId, role),
    setBanned: (userId: string, communityId: string, banned: boolean, info?: BanInfo) => repo.setBanned(userId, communityId, banned, info),
    isBanned: (userId: string, communityId: string) => repo.isBanned(userId, communityId),
    touchActivity: (userId: string, communityId: string) => repo.touchActivity(userId, communityId),
    memberIdsPage: (communityId: string, opts: Parameters<EnrollmentRepository['memberIdsPage']>[1]) => repo.memberIdsPage(communityId, opts),
    findOwnerId: (communityId: string) => repo.findOwnerId(communityId),
    /**
     * Duyệt MỌI thành viên (không bị cấm) theo lô `batchSize`, không nạp cả cộng đồng vào RAM.
     * `onBatch` được gọi tuần tự cho từng lô userId.
     */
    async forEachMemberBatch(
      communityId: string,
      opts: { batchSize?: number; roles?: MemberRole[]; excludeDemo?: boolean; excludeUserId?: string },
      onBatch: (userIds: string[]) => Promise<void> | void,
    ): Promise<number> {
      const limit = opts.batchSize ?? 500;
      let after: string | undefined;
      let total = 0;
      for (;;) {
        const ids = await repo.memberIdsPage(communityId, { ...opts, afterUserId: after, limit });
        if (ids.length === 0) return total;
        total += ids.length;
        await onBatch(ids);
        if (ids.length < limit) return total;
        after = ids[ids.length - 1];
      }
    },
    /** Vai trò nếu đang là thành viên (không bị cấm), không thì undefined — 1 truy vấn. */
    getActiveRole: (userId: string, communityId: string) => repo.getActiveRole(userId, communityId),

    async toggle(userId: string, communityId: string) {
      const course = await catalogService.getById(communityId); // 404 nếu khóa học không tồn tại
      if (await repo.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      const current = await repo.isEnrolled(userId, communityId);
      const next = !current;
      // Import động: payments.service phụ thuộc enrollments.service (tránh vòng phụ thuộc).
      const { paymentsService } = await import('../payments/payments.service.js');
      // Chỉ "vào" mới bị chặn theo loại cộng đồng; rời đi luôn được (trừ owner, xử lý dưới).
      if (next) {
        if (course.locked) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
        // Gói còn hiệu lực (vd. đã "rời" nhưng chưa hết kỳ đã trả, hoặc vừa được gỡ cấm): vào lại KHÔNG phải trả tiền/duyệt lại.
        if (!(await paymentsService.hasLiveSubscription(userId, communityId))) {
          if (course.visibility === 'private') {
            throw HttpError.coded(403, 'JOIN_REQUEST_REQUIRED', 'Cộng đồng riêng tư: hãy gửi yêu cầu tham gia hoặc dùng lời mời');
          }
          if (course.priceUsd > 0) {
            throw HttpError.coded(402, 'PAYMENT_REQUIRED', 'Cộng đồng có phí: vui lòng thanh toán để tham gia', { communityId, courseId: communityId });
          }
        }
      }
      // Owner không được "rời" cộng đồng của chính mình (phải chuyển quyền/xoá cộng đồng trước).
      if (current && (await repo.getMember(userId, communityId))?.role === 'owner') {
        throw HttpError.conflict('Chủ cộng đồng không thể rời cộng đồng của mình');
      }
      await repo.setEnrolled(userId, communityId, next);
      await syncStudents(communityId);
      // Rời cộng đồng có phí = hủy gói CUỐI KỲ (không bị trừ tiền kỳ sau; vẫn vào lại được tới hết kỳ đã trả).
      if (!next) await paymentsService.onMemberLeft(userId, communityId).catch((err) => console.error('onMemberLeft lỗi:', err));
      return { enrolled: next };
    },

    /** Cấp quyền truy cập trực tiếp (không đảo trạng thái) — dùng sau khi xác nhận thanh toán thành công. */
    async grant(userId: string, communityId: string, role: MemberRole = 'member'): Promise<void> {
      if (await repo.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      await repo.setEnrolled(userId, communityId, true, role);
      await syncStudents(communityId);
    },

    /** Xóa thành viên khỏi cộng đồng (kick) — khác với toggle: không kiểm tra người gọi là ai (policy làm ở tầng route). */
    remove: async (userId: string, communityId: string) => {
      await repo.setEnrolled(userId, communityId, false);
      await syncStudents(communityId);
    },

    /**
     * Chặn ở server (không tin riêng phía FE) cho mọi nội dung trong trang Cộng đồng
     * (bảng tin, lớp học, lịch, thành viên, xếp hạng): phải đã tham gia khóa học/cộng đồng này.
     * Cũng cập nhật "hoạt động gần nhất" cho tab Thành viên.
     */
    async requireMembership(userId: string, communityId: string): Promise<void> {
      // Cộng đồng bị khóa: chặn mọi người trừ Platform Admin (import động để tránh vòng phụ thuộc với policy).
      if ((await catalogService.requireLockState(communityId)).locked) {
        const { isPlatformAdmin } = await import('../permissions/policy.js');
        if (!(await isPlatformAdmin(userId))) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
      }
      // 1 truy vấn: vừa kiểm tra là thành viên (không bị cấm) vừa cập nhật "hoạt động gần nhất".
      if (!(await repo.touchIfMember(userId, communityId))) {
        // Platform Admin ghi đè mọi cộng đồng (xem policy.ts) — không cần tham gia mới vào được để xử lý vi phạm.
        const { isPlatformAdmin } = await import('../permissions/policy.js');
        if (await isPlatformAdmin(userId)) return;
        throw HttpError.forbidden('Bạn cần tham gia cộng đồng này trước');
      }
    },
  };
}

export const enrollmentService = createEnrollmentService();
