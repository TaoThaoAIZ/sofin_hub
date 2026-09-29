import { randomBytes, randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { handleFor } from '../community/community.handle.js';
import type { Course } from '../courses/course.types.js';
import { courseService } from '../courses/courses.service.js';
import type { MemberRole } from '../enrollments/enrollments.repository.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { isPlatformAdmin, requirePlatformAdmin, requireRole, roleRank } from '../permissions/policy.js';
import { communitiesRepository, type CommunitiesRepository } from './communities.repository.js';
import type { CreateCommunityBody, UpdateCommunityBody } from './communities.schema.js';
import type { Invite, JoinRequestStatus } from './communities.types.js';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_THUMBNAIL = '/images/courses/biz.webp';

const linkOf = (courseId: string) => `/courses/${courseId}/community`;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

export function createCommunitiesService(repo: CommunitiesRepository = communitiesRepository) {
  async function uniqueSlug(title: string): Promise<string> {
    const base = normalize(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'community';
    let id = base;
    for (let n = 2; await courseService.idExists(id); n++) id = `${base}-${n}`;
    return id;
  }

  /** Cộng đồng chưa bị xóa; 404 nếu không có. Dùng cả cho cộng đồng đang bị khóa (chỉ chặn ở requireMembership). */
  const getCourse = (courseId: string) => courseService.getById(courseId);

  /** Chặn thao tác "vào" cộng đồng đang bị khóa. */
  function assertNotLocked(course: Course) {
    if (course.locked) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
  }

  async function notifyManagers(courseId: string, title: string, body: string) {
    const managers = (await enrollmentService.listMembers(courseId)).filter((m) => m.role === 'owner' || m.role === 'admin');
    const demo = await repo.demoUserIds(managers.map((m) => m.userId)); // quản trị viên minh họa không nhận thông báo
    for (const m of managers.filter((x) => !demo.has(x.userId))) notify({ userId: m.userId, type: 'system', title, body, link: linkOf(courseId), courseId });
  }

  /** Quy tắc thứ bậc kick/ban: actor (admin+) chỉ tác động được lên người có bậc THẤP HƠN; không bao giờ lên owner. */
  async function assertCanActOn(actorId: string, courseId: string, targetId: string) {
    if (actorId === targetId) throw HttpError.badRequest('Bạn không thể thực hiện thao tác này với chính mình');
    const actorRole = await requireRole(actorId, courseId, 'admin');
    // Thành viên minh họa (User.isDemo) không phải người thật: coi như không tồn tại (kick/ban trả 404).
    if ((await userRepository.findById(targetId))?.isDemo) return undefined;
    const target = await enrollmentService.getMember(targetId, courseId);
    if (target?.role === 'owner') throw HttpError.forbidden('Không thể tác động lên chủ cộng đồng');
    if (target && roleRank(actorRole) <= roleRank(target.role)) {
      throw HttpError.forbidden('Bạn chỉ có thể tác động lên thành viên có vai trò thấp hơn mình');
    }
    return target;
  }

  /** Cấp quyền vào cộng đồng, chặn người bị cấm/đã là thành viên; dọn yêu cầu tham gia đang chờ. */
  async function admit(userId: string, courseId: string) {
    if (await enrollmentService.isBanned(userId, courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
    await enrollmentService.grant(userId, courseId, 'member');
    const pending = await repo.findPendingJoinRequest(courseId, userId);
    if (pending) await repo.decideJoinRequest(pending.id, 'approved', undefined);
    const who = await userBriefView(userId);
    await notifyManagers(courseId, 'Thành viên mới', `${who.name} vừa tham gia cộng đồng`);
  }

  async function requireInvite(code: string): Promise<{ invite: Invite; course: Course }> {
    const invite = await repo.findInvite(code);
    if (!invite) throw HttpError.notFound('Không tìm thấy lời mời');
    const course = await getCourse(invite.courseId); // 404 nếu cộng đồng đã xóa
    if (invite.revokedAt) throw HttpError.coded(410, 'INVITE_REVOKED', 'Lời mời đã bị thu hồi');
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
      throw HttpError.coded(410, 'INVITE_EXPIRED', 'Lời mời đã hết hạn');
    }
    if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
      throw HttpError.coded(410, 'INVITE_EXHAUSTED', 'Lời mời đã hết lượt sử dụng');
    }
    return { invite, course };
  }

  return {
    // ---------- tạo & quản trị cộng đồng ----------
    async create(userId: string, input: CreateCommunityBody) {
      const id = await uniqueSlug(input.title);
      const owner = await userBriefView(userId);
      await courseService.create({
        id,
        title: input.title,
        description: input.description,
        category: input.category,
        tag: 'new',
        thumbnail: input.thumbnail ?? DEFAULT_THUMBNAIL,
        instructor: { name: owner.name, role: 'Chủ cộng đồng' },
        lessons: 0,
        durationMinutes: 0,
        students: 0,
        rating: 0,
        ratingCount: 0,
        priceUsd: input.priceUsd,
        pricing: input.priceUsd > 0 ? 'paid' : 'free',
        visibility: input.visibility,
        status: 'open',
        language: input.language,
        createdAt: new Date().toISOString(),
        ownerId: userId,
      });
      await enrollmentService.grant(userId, id, 'owner');
      return courseService.getDetailById(id, true);
    },

    async update(userId: string, courseId: string, input: UpdateCommunityBody) {
      const course = await getCourse(courseId);
      await requireRole(userId, courseId, 'admin');
      const touchesMoney = input.priceUsd !== undefined || input.visibility !== undefined;
      if (touchesMoney) await requireRole(userId, courseId, 'owner');

      const patch: Partial<Course> = { ...input };
      if (input.priceUsd !== undefined) {
        // free <-> paid theo giá; giữ nguyên 'trial' nếu vẫn có phí
        patch.pricing = input.priceUsd === 0 ? 'free' : course.pricing === 'free' ? 'paid' : course.pricing;
      }
      await courseService.update(courseId, patch);
      return courseService.getDetailById(courseId, await enrollmentService.isEnrolled(userId, courseId));
    },

    async remove(userId: string, courseId: string) {
      const course = await getCourse(courseId);
      await requireRole(userId, courseId, 'owner');
      if (!course.ownerId && !(await isPlatformAdmin(userId))) {
        throw HttpError.conflict('Cộng đồng mẫu của hệ thống chỉ Platform Admin mới xóa được');
      }
      const members = await enrollmentService.listMembers(courseId);
      const demo = await repo.demoUserIds(members.map((m) => m.userId));
      await courseService.update(courseId, { deletedAt: new Date().toISOString() });
      for (const m of members) {
        if (m.userId === userId || demo.has(m.userId)) continue;
        notify({
          userId: m.userId,
          type: 'system',
          title: 'Cộng đồng đã bị xóa',
          body: `Cộng đồng "${course.title}" đã được xóa`,
          courseId,
        });
      }
    },

    async lock(adminId: string, courseId: string, reason: string) {
      await requirePlatformAdmin(adminId);
      const course = await getCourse(courseId);
      await courseService.update(courseId, { locked: true, lockReason: reason });
      const ownerId = course.ownerId ?? (await enrollmentService.listMembers(courseId)).find((m) => m.role === 'owner')?.userId;
      if (ownerId) {
        notify({
          userId: ownerId,
          type: 'system',
          title: 'Cộng đồng bị khóa',
          body: `Cộng đồng "${course.title}" đã bị khóa. Lý do: ${reason}`,
          courseId,
        });
      }
      return { id: courseId, locked: true, reason };
    },

    async unlock(adminId: string, courseId: string) {
      await requirePlatformAdmin(adminId);
      const course = await getCourse(courseId);
      await courseService.update(courseId, { locked: false, lockReason: null });
      if (course.ownerId) {
        notify({
          userId: course.ownerId,
          type: 'system',
          title: 'Cộng đồng đã được mở khóa',
          body: `Cộng đồng "${course.title}" đã hoạt động trở lại`,
          courseId,
        });
      }
      return { id: courseId, locked: false };
    },

    // ---------- yêu cầu tham gia (cộng đồng riêng tư) ----------
    async createJoinRequest(userId: string, courseId: string, message: string) {
      const course = await getCourse(courseId);
      assertNotLocked(course);
      if (course.visibility !== 'private') throw HttpError.conflict('Cộng đồng công khai, bạn có thể tham gia trực tiếp');
      if (await enrollmentService.isBanned(userId, courseId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      if (await enrollmentService.isEnrolled(userId, courseId)) throw HttpError.conflict('Bạn đã là thành viên của cộng đồng này');
      // 1 yêu cầu pending / (course,user): kiểm tra + ghi trong transaction có khóa ở repository.
      const req = await repo.createPendingJoinRequest({
        id: randomUUID(),
        courseId,
        userId,
        message,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      if (!req) throw HttpError.conflict('Bạn đã có một yêu cầu tham gia đang chờ duyệt');
      const who = await userBriefView(userId);
      await notifyManagers(courseId, 'Yêu cầu tham gia mới', `${who.name} xin tham gia cộng đồng "${course.title}"`);
      return req;
    },

    async listJoinRequests(userId: string, courseId: string, status?: JoinRequestStatus) {
      await getCourse(courseId);
      await requireRole(userId, courseId, 'admin');
      const rows = await repo.listJoinRequests(courseId, status);
      return Promise.all(rows.map(async (r) => ({ ...r, user: await userBriefView(r.userId) })));
    },

    async decideJoinRequest(userId: string, requestId: string, approve: boolean) {
      const req = await repo.findJoinRequest(requestId);
      if (!req) throw HttpError.notFound('Không tìm thấy yêu cầu tham gia');
      const course = await getCourse(req.courseId);
      await requireRole(userId, req.courseId, 'admin');
      if (req.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý');
      if (approve) {
        assertNotLocked(course);
        if (await enrollmentService.isBanned(req.userId, req.courseId)) throw HttpError.conflict('Người này đã bị cấm khỏi cộng đồng');
        await enrollmentService.grant(req.userId, req.courseId, 'member');
      }
      const updated = await repo.decideJoinRequest(requestId, approve ? 'approved' : 'rejected', userId);
      if (!updated) throw HttpError.conflict('Yêu cầu này đã được xử lý');
      notify({
        userId: req.userId,
        type: approve ? 'member_joined' : 'system',
        title: approve ? 'Yêu cầu tham gia được chấp nhận' : 'Yêu cầu tham gia bị từ chối',
        body: approve ? `Bạn đã trở thành thành viên của "${course.title}"` : `Yêu cầu tham gia "${course.title}" chưa được chấp nhận`,
        link: approve ? linkOf(course.id) : undefined,
        courseId: course.id,
      });
      return updated;
    },

    async cancelJoinRequest(userId: string, requestId: string) {
      const req = await repo.findJoinRequest(requestId);
      if (!req || req.userId !== userId) throw HttpError.notFound('Không tìm thấy yêu cầu tham gia');
      if (req.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý, không thể hủy');
      await repo.deleteJoinRequest(requestId);
    },

    // ---------- lời mời ----------
    async createInvite(userId: string, courseId: string, input: { maxUses?: number; expiresAt?: string }) {
      await getCourse(courseId);
      await requireRole(userId, courseId, 'admin');
      return repo.createInvite({
        code: randomBytes(9).toString('base64url'), // 72 bit ngẫu nhiên: không đoán được
        courseId,
        createdBy: userId,
        maxUses: input.maxUses ?? null,
        usedCount: 0,
        expiresAt: input.expiresAt ?? null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      });
    },

    async listInvites(userId: string, courseId: string) {
      await getCourse(courseId);
      await requireRole(userId, courseId, 'admin');
      return repo.listInvites(courseId);
    },

    async revokeInvite(userId: string, code: string) {
      const invite = await repo.findInvite(code);
      if (!invite) throw HttpError.notFound('Không tìm thấy lời mời');
      await requireRole(userId, invite.courseId, 'admin');
      if (!invite.revokedAt) await repo.revokeInvite(code);
    },

    /** Xem trước công khai: chỉ thông tin hiển thị, không lộ người tạo, danh sách thành viên hay mã khác. */
    async previewInvite(code: string) {
      const { invite, course } = await requireInvite(code);
      return {
        code: invite.code,
        course: {
          id: course.id,
          title: course.title,
          thumbnail: course.thumbnail,
          members: course.students,
          visibility: course.visibility,
          priceUsd: course.priceUsd,
        },
        expiresAt: invite.expiresAt,
        remainingUses: invite.maxUses === null ? null : invite.maxUses - invite.usedCount,
      };
    },

    async acceptInvite(userId: string, code: string) {
      const { course } = await requireInvite(code);
      assertNotLocked(course);
      if (await enrollmentService.isBanned(userId, course.id)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      if (await enrollmentService.isEnrolled(userId, course.id)) throw HttpError.conflict('Bạn đã là thành viên của cộng đồng này');
      // Lời mời bỏ qua bước duyệt của cộng đồng riêng tư nhưng KHÔNG bỏ qua thanh toán.
      if (course.priceUsd > 0) {
        throw HttpError.coded(402, 'PAYMENT_REQUIRED', 'Cộng đồng có phí: vui lòng thanh toán để tham gia', { courseId: course.id });
      }
      // Giữ lượt dùng atomically (chống hai người cùng nhận lượt cuối); hoàn lại nếu vào cộng đồng thất bại.
      if (!(await repo.claimInviteUse(code))) throw HttpError.coded(410, 'INVITE_EXHAUSTED', 'Lời mời đã hết lượt sử dụng');
      try {
        await admit(userId, course.id);
      } catch (e) {
        await repo.releaseInviteUse(code);
        throw e;
      }
      return { courseId: course.id, joined: true };
    },

    // ---------- thành viên ----------
    async memberDetail(viewerId: string, courseId: string, targetId: string) {
      await getCourse(courseId);
      await enrollmentService.requireMembership(viewerId, courseId);
      const m = await enrollmentService.getMember(targetId, courseId);
      if (m && (await enrollmentService.isEnrolled(targetId, courseId))) {
        const u = await userBriefView(targetId);
        return {
          ...u,
          handle: handleFor(u.name, u.id),
          role: m.role === 'member' ? 'member' : 'admin',
          roleDetail: m.role,
          enrolledAt: m.enrolledAt,
          lastActiveAt: m.lastActiveAt,
          online: Date.now() - new Date(m.lastActiveAt).getTime() < ONLINE_WINDOW_MS,
        };
      }
      throw HttpError.notFound('Không tìm thấy thành viên');
    },

    async changeRole(actorId: string, courseId: string, targetId: string, role: Exclude<MemberRole, 'owner'>) {
      await getCourse(courseId);
      const actorRole = await requireRole(actorId, courseId, 'admin');
      if (actorId === targetId) throw HttpError.badRequest('Bạn không thể tự đổi vai trò của mình');
      // Thành viên minh họa (isDemo) không đổi vai trò được: coi như không tồn tại.
      if ((await userRepository.findById(targetId))?.isDemo) throw HttpError.notFound('Không tìm thấy thành viên');
      const target = await enrollmentService.getMember(targetId, courseId);
      if (!target || !(await enrollmentService.isEnrolled(targetId, courseId))) throw HttpError.notFound('Không tìm thấy thành viên');
      if (target.role === 'owner') throw HttpError.forbidden('Không thể đổi vai trò của chủ cộng đồng');
      // Đặt/bỏ admin chỉ owner (hoặc platform admin); admin chỉ đặt/bỏ mod.
      if ((role === 'admin' || target.role === 'admin') && roleRank(actorRole) < roleRank('owner')) {
        throw HttpError.forbidden('Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên');
      }
      if (target.role === role) return { userId: targetId, role };
      await enrollmentService.setRole(targetId, courseId, role);
      const course = await getCourse(courseId);
      notify({
        userId: targetId,
        type: 'role_changed',
        title: 'Vai trò của bạn đã thay đổi',
        body: `Bạn hiện là ${{ member: 'thành viên', mod: 'điều hành viên', admin: 'quản trị viên' }[role]} của "${course.title}"`,
        link: linkOf(courseId),
        courseId,
      });
      return { userId: targetId, role };
    },

    async kick(actorId: string, courseId: string, targetId: string) {
      const course = await getCourse(courseId);
      const target = await assertCanActOn(actorId, courseId, targetId);
      if (!target) throw HttpError.notFound('Không tìm thấy thành viên');
      await enrollmentService.remove(targetId, courseId);
      notify({
        userId: targetId,
        type: 'removed_from_community',
        title: 'Bạn đã bị xóa khỏi cộng đồng',
        body: `Bạn không còn là thành viên của "${course.title}"`,
        courseId,
      });
    },

    async ban(actorId: string, courseId: string, targetId: string, reason: string) {
      const course = await getCourse(courseId);
      await assertCanActOn(actorId, courseId, targetId);
      const targetUser = await userRepository.findById(targetId);
      if (!targetUser || targetUser.isDemo || targetUser.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng');
      await enrollmentService.remove(targetId, courseId);
      await enrollmentService.setBanned(targetId, courseId, true, { reason, bannedById: actorId });
      notify({
        userId: targetId,
        type: 'removed_from_community',
        title: 'Bạn đã bị cấm khỏi cộng đồng',
        body: `Bạn bị cấm khỏi "${course.title}"${reason ? `. Lý do: ${reason}` : ''}`,
        courseId,
      });
    },

    async unban(actorId: string, courseId: string, targetId: string) {
      await getCourse(courseId);
      await requireRole(actorId, courseId, 'admin');
      if (!(await enrollmentService.isBanned(targetId, courseId))) throw HttpError.notFound('Người này không nằm trong danh sách cấm');
      await enrollmentService.setBanned(targetId, courseId, false);
    },

    async listBans(actorId: string, courseId: string) {
      await getCourse(courseId);
      await requireRole(actorId, courseId, 'admin');
      const rows = await repo.listBans(courseId);
      return Promise.all(rows.map(async (b) => ({ ...b, user: await userBriefView(b.userId) })));
    },

    async transferOwnership(actorId: string, courseId: string, targetId: string) {
      const course = await getCourse(courseId);
      await requireRole(actorId, courseId, 'owner');
      if (actorId === targetId) throw HttpError.badRequest('Bạn đã là chủ cộng đồng');
      const target = await enrollmentService.getMember(targetId, courseId);
      if (!target || !(await enrollmentService.isEnrolled(targetId, courseId))) {
        throw HttpError.badRequest('Người nhận phải là thành viên của cộng đồng');
      }
      // Platform Admin có thể chuyển quyền thay owner (hoặc cộng đồng seed chưa có owner).
      const oldOwner = (await enrollmentService.listMembers(courseId)).find((m) => m.role === 'owner');
      if (oldOwner) await enrollmentService.setRole(oldOwner.userId, courseId, 'admin');
      await enrollmentService.setRole(targetId, courseId, 'owner');
      if (course.ownerId) await courseService.update(courseId, { ownerId: targetId });
      for (const [uid, body] of [
        [targetId, `Bạn đã trở thành chủ của "${course.title}"`],
        ...(oldOwner ? [[oldOwner.userId, `Bạn đã chuyển quyền chủ "${course.title}" và giờ là quản trị viên`] as const] : []),
      ] as const) {
        notify({ userId: uid, type: 'role_changed', title: 'Vai trò của bạn đã thay đổi', body, link: linkOf(courseId), courseId });
      }
      return { ownerId: targetId };
    },

  };
}

export const communitiesService = createCommunitiesService();
