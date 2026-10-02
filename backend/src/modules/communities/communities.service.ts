import { randomBytes, randomUUID } from 'node:crypto';
import { HttpError } from '../../utils/http-error.js';
import { assertUserCan } from '../auth/user-status.js';
import { auditService } from '../admin/admin-audit.service.js';
import { clearModerationSuspension } from '../admin/admin-communities.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { toEmbedUrl } from '../classroom/classroom.schema.js';
import { priceError } from '../community-wizard/wizard.schema.js';
import { handleFor } from '../community/community.handle.js';
import type { Community } from '../catalog/community.types.js';
import { catalogService } from '../catalog/catalog.service.js';
import type { MemberRole } from '../enrollments/enrollments.repository.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { isPlatformAdmin, requirePlatformAdmin, requireRole, roleRank } from '../permissions/policy.js';
import { communitiesRepository, type CommunitiesRepository } from './communities.repository.js';
import type { CreateCommunityBody, UpdateCommunityBody } from './communities.schema.js';
import type { Invite, JoinRequestStatus } from './communities.types.js';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_THUMBNAIL = '/images/courses/biz.webp';

const linkOf = (communityId: string) => `/courses/${communityId}/community`;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');

export function createCommunitiesService(repo: CommunitiesRepository = communitiesRepository) {
  const slugBase = (title: string): string =>
    normalize(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'community';

  /** Cộng đồng chưa bị xóa; 404 nếu không có. Dùng cả cho cộng đồng đang bị khóa (chỉ chặn ở requireMembership). */
  const getCourse = (communityId: string) => catalogService.getById(communityId);

  /** Chặn thao tác "vào" cộng đồng đang bị khóa. */
  function assertNotLocked(course: Community) {
    if (course.locked) throw HttpError.coded(403, 'COMMUNITY_LOCKED', 'Cộng đồng này đang bị khóa');
  }

  async function notifyManagers(communityId: string, title: string, body: string) {
    // Chỉ owner/admin thật (loại minh họa) — lọc ngay trong SQL, không nạp toàn bộ thành viên (cộng đồng 50k người vẫn là 1 truy vấn nhỏ).
    const managers = await enrollmentService.memberIdsPage(communityId, { roles: ['owner', 'admin'], excludeDemo: true, limit: 1000 });
    for (const userId of managers) notify({ userId, type: 'system', title, body, link: linkOf(communityId), communityId });
  }

  /** Quy tắc thứ bậc kick/ban: actor (admin+) chỉ tác động được lên người có bậc THẤP HƠN; không bao giờ lên owner. */
  async function assertCanActOn(actorId: string, communityId: string, targetId: string) {
    if (actorId === targetId) throw HttpError.badRequest('Bạn không thể thực hiện thao tác này với chính mình');
    const actorRole = await requireRole(actorId, communityId, 'admin');
    // Thành viên minh họa (User.isDemo) không phải người thật: coi như không tồn tại (kick/ban trả 404).
    if ((await userRepository.findById(targetId))?.isDemo) return undefined;
    const target = await enrollmentService.getMember(targetId, communityId);
    if (target?.role === 'owner') throw HttpError.forbidden('Không thể tác động lên chủ cộng đồng');
    if (target && roleRank(actorRole) <= roleRank(target.role)) {
      throw HttpError.forbidden('Bạn chỉ có thể tác động lên thành viên có vai trò thấp hơn mình');
    }
    return target;
  }

  /** Cấp quyền vào cộng đồng, chặn người bị cấm/đã là thành viên; dọn yêu cầu tham gia đang chờ. */
  async function admit(userId: string, communityId: string) {
    if (await enrollmentService.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
    await enrollmentService.grant(userId, communityId, 'member');
    const pending = await repo.findPendingJoinRequest(communityId, userId);
    if (pending) await repo.decideJoinRequest(pending.id, 'approved', undefined);
    const who = await userBriefView(userId);
    await notifyManagers(communityId, 'Thành viên mới', `${who.name} vừa tham gia cộng đồng`);
  }

  async function requireInvite(code: string): Promise<{ invite: Invite; course: Community }> {
    const invite = await repo.findInvite(code);
    if (!invite) throw HttpError.notFound('Không tìm thấy lời mời');
    const course = await getCourse(invite.communityId); // 404 nếu cộng đồng đã xóa
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
      await assertUserCan(userId, 'create_community');
      const baseSlug = slugBase(input.title);
      const owner = await userBriefView(userId);
      // Cộng đồng + ghi danh Owner + khóa học mặc định + slug: MỘT transaction (đua slug thử slug kế tiếp, lỗi giữa chừng không để lại cộng đồng mồ côi).
      const { community, defaultCourseId } = await catalogService.createWithOwner(
        {
          title: input.title,
          description: input.description,
          category: input.category,
          tag: 'new',
          thumbnail: input.thumbnail ?? DEFAULT_THUMBNAIL,
          instructor: { name: owner.name, role: 'Chủ cộng đồng' },
          lessons: 0, // cột marketplace (không dùng): số bài học thật được TÍNH từ lớp học khi đọc
          durationMinutes: 0,
          students: 0,
          rating: 0,
          ratingCount: 0,
          priceUsd: input.priceUsd,
          priceAnnualUsd: input.priceUsd > 0 ? (input.priceAnnualUsd ?? null) : null,
          memberTrialEnabled: input.memberTrialEnabled,
          joinQuestions: input.joinQuestions,
          rules: input.rules,
          requireRulesAgreement: input.requireRulesAgreement,
          autoApprovePaid: input.autoApprovePaid,
          pricing: input.priceUsd > 0 ? 'paid' : 'free',
          visibility: input.visibility,
          status: 'open',
          language: input.language,
          createdAt: new Date().toISOString(),
          ownerId: userId,
        },
        baseSlug,
        userId,
      );
      return { ...(await catalogService.getDetailById(community.id, true)), defaultCourseId };
    },

    async update(userId: string, communityId: string, input: UpdateCommunityBody) {
      const course = await getCourse(communityId);
      await requireRole(userId, communityId, 'admin');
      const touchesMoney = input.priceUsd !== undefined || input.priceAnnualUsd !== undefined || input.visibility !== undefined || input.autoApprovePaid !== undefined || input.memberTrialEnabled !== undefined;
      if (touchesMoney) await requireRole(userId, communityId, 'owner');

      const patch: Partial<Community> = { ...input };
      if (input.priceUsd !== undefined || input.priceAnnualUsd !== undefined) {
        // Giá tháng/năm phải hợp lệ cùng nhau (sau khi gộp với giá hiện tại); về miễn phí thì bỏ giá năm.
        const monthly = input.priceUsd ?? course.priceUsd;
        const annual = monthly <= 0 && input.priceAnnualUsd == null ? null : input.priceAnnualUsd !== undefined ? input.priceAnnualUsd : course.priceAnnualUsd;
        const err = priceError(monthly, annual);
        if (err) throw HttpError.coded(400, 'VALIDATION_ERROR', err, { fieldErrors: { priceAnnualUsd: [err] } });
        patch.priceAnnualUsd = annual;
      }
      if (input.introVideoUrl !== undefined) patch.introVideoUrl = input.introVideoUrl ? toEmbedUrl(input.introVideoUrl) : null;
      if (input.benefits !== undefined) patch.benefits = input.benefits.filter((b) => b.trim());
      if (input.priceUsd !== undefined) {
        // free <-> paid theo giá; giữ nguyên 'trial' nếu vẫn có phí
        patch.pricing = input.priceUsd === 0 ? 'free' : course.pricing === 'free' ? 'paid' : course.pricing;
      }
      await catalogService.update(communityId, patch);
      return catalogService.getDetailById(communityId, await enrollmentService.isEnrolled(userId, communityId));
    },

    async remove(userId: string, communityId: string) {
      const course = await getCourse(communityId);
      await requireRole(userId, communityId, 'owner');
      if (!course.ownerId && !(await isPlatformAdmin(userId))) {
        throw HttpError.conflict('Cộng đồng mẫu của hệ thống chỉ Platform Admin mới xóa được');
      }
      await catalogService.update(communityId, { deletedAt: new Date().toISOString() });
      // Cộng đồng đã xóa: kết thúc mọi gói ngay (không trừ tiền cộng đồng không còn tồn tại) kèm thông báo cho từng người.
      await paymentsService.endAllForCommunity(communityId, 'end_now', `Cộng đồng "${course.title}" đã bị xóa nên gói thành viên của bạn đã được hủy và sẽ không bị tính phí thêm.`);
      // Rải thông báo theo lô (không nạp cả cộng đồng); người dùng đã thấy `deletedAt` nên thứ tự "xóa rồi báo" giữ nguyên như cũ.
      await enrollmentService.forEachMemberBatch(communityId, { excludeDemo: true, excludeUserId: userId }, (ids) => {
        for (const id of ids) {
          notify({ userId: id, type: 'system', title: 'Cộng đồng đã bị xóa', body: `Cộng đồng "${course.title}" đã được xóa`, communityId });
        }
      });
    },

    async lock(adminId: string, communityId: string, reason: string) {
      await requirePlatformAdmin(adminId);
      const course = await getCourse(communityId);
      await catalogService.update(communityId, { locked: true, lockReason: reason });
      // Cộng đồng bị khóa: dừng gia hạn mọi gói (hủy cuối kỳ) + thông báo; checkout/trial/confirm mới đã bị chặn ở payments.
      await paymentsService.endAllForCommunity(communityId, 'cancel_at_period_end', `Cộng đồng "${course.title}" đang bị khóa nên gói thành viên của bạn sẽ không được gia hạn.`);
      const ownerId = course.ownerId ?? (await enrollmentService.findOwnerId(communityId));
      if (ownerId) {
        notify({
          userId: ownerId,
          type: 'system',
          title: 'Cộng đồng bị khóa',
          body: `Cộng đồng "${course.title}" đã bị khóa. Lý do: ${reason}`,
          communityId,
        });
      }
      await auditService.record(adminId, { action: 'community.lock', targetType: 'community', targetId: communityId, targetLabel: course.title, reason });
      return { id: communityId, locked: true, reason };
    },

    async unlock(adminId: string, communityId: string) {
      await requirePlatformAdmin(adminId);
      const course = await getCourse(communityId);
      await catalogService.update(communityId, { locked: false, lockReason: null });
      if (course.ownerId) {
        notify({
          userId: course.ownerId,
          type: 'system',
          title: 'Cộng đồng đã được mở khóa',
          body: `Cộng đồng "${course.title}" đã hoạt động trở lại`,
          communityId,
        });
      }
      await clearModerationSuspension(communityId);
      await auditService.record(adminId, { action: 'community.unlock', targetType: 'community', targetId: communityId, targetLabel: course.title });
      return { id: communityId, locked: false };
    },

    // ---------- yêu cầu tham gia (cộng đồng riêng tư) ----------
    async createJoinRequest(userId: string, communityId: string, message: string, extra: { answers?: string[]; acceptRules?: boolean } = {}) {
      const course = await getCourse(communityId);
      assertNotLocked(course);
      if (course.visibility !== 'private') throw HttpError.conflict('Cộng đồng công khai, bạn có thể tham gia trực tiếp');
      if (await enrollmentService.isBanned(userId, communityId)) throw HttpError.forbidden('Bạn đã bị cấm khỏi cộng đồng này');
      if (await enrollmentService.isEnrolled(userId, communityId)) throw HttpError.conflict('Bạn đã là thành viên của cộng đồng này');
      // Câu hỏi gia nhập: có câu hỏi thì BẮT BUỘC trả lời đủ; lưu bản chụp [{question, answer}] để người duyệt thấy đúng câu hỏi lúc gửi.
      const questions = course.joinQuestions;
      const given = (extra.answers ?? []).map((a) => a.trim());
      if (questions.length > 0 && (given.length !== questions.length || given.some((a) => !a))) {
        throw HttpError.coded(400, 'JOIN_ANSWERS_REQUIRED', `Vui lòng trả lời đủ ${questions.length} câu hỏi gia nhập`, { questions });
      }
      if (course.requireRulesAgreement && course.rules.length > 0 && extra.acceptRules !== true) {
        throw HttpError.coded(400, 'RULES_NOT_ACCEPTED', 'Vui lòng đồng ý với nội quy cộng đồng để gửi yêu cầu');
      }
      // 1 yêu cầu pending / (course,user): kiểm tra + ghi trong transaction có khóa ở repository.
      const req = await repo.createPendingJoinRequest({
        id: randomUUID(),
        communityId,
        userId,
        message,
        answers: questions.map((question, i) => ({ question, answer: given[i]! })),
        rulesAcceptedAt: course.requireRulesAgreement && course.rules.length > 0 ? new Date().toISOString() : undefined,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      if (!req) throw HttpError.conflict('Bạn đã có một yêu cầu tham gia đang chờ duyệt');
      const who = await userBriefView(userId);
      await notifyManagers(communityId, 'Yêu cầu tham gia mới', `${who.name} xin tham gia cộng đồng "${course.title}"`);
      return req;
    },

    async listJoinRequests(userId: string, communityId: string, status?: JoinRequestStatus) {
      await getCourse(communityId);
      await requireRole(userId, communityId, 'admin');
      const rows = await repo.listJoinRequests(communityId, status);
      return Promise.all(rows.map(async (r) => ({ ...r, user: await userBriefView(r.userId) })));
    },

    async decideJoinRequest(userId: string, requestId: string, approve: boolean) {
      const req = await repo.findJoinRequest(requestId);
      if (!req) throw HttpError.notFound('Không tìm thấy yêu cầu tham gia');
      const course = await getCourse(req.communityId);
      await requireRole(userId, req.communityId, 'admin');
      if (req.status !== 'pending') throw HttpError.conflict('Yêu cầu này đã được xử lý');
      if (approve) {
        assertNotLocked(course);
        if (await enrollmentService.isBanned(req.userId, req.communityId)) throw HttpError.conflict('Người này đã bị cấm khỏi cộng đồng');
      }
      // Cộng đồng CÓ PHÍ: duyệt chỉ cho phép người này thanh toán/dùng thử — KHÔNG cấp quyền miễn phí.
      const paid = course.priceUsd > 0;
      // Chốt quyết định TRƯỚC (atomic) và chỉ cấp quyền trong cùng transaction khi vừa chốt "approved".
      const updated = await repo.decideJoinRequestAndGrant(requestId, approve ? 'approved' : 'rejected', userId, approve && !paid);
      if (!updated) throw HttpError.conflict('Yêu cầu này đã được xử lý');
      const joined = approve && !paid;
      notify({
        userId: req.userId,
        type: joined ? 'member_joined' : 'system',
        title: approve ? 'Yêu cầu tham gia được chấp nhận' : 'Yêu cầu tham gia bị từ chối',
        body: joined
          ? `Bạn đã trở thành thành viên của "${course.title}"`
          : approve
            ? `Yêu cầu tham gia "${course.title}" đã được duyệt. Hãy thanh toán hoặc dùng thử để hoàn tất tham gia.`
            : `Yêu cầu tham gia "${course.title}" chưa được chấp nhận`,
        link: approve ? (joined ? linkOf(course.id) : `/courses/${course.id}`) : undefined,
        communityId: course.id,
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
    async createInvite(userId: string, communityId: string, input: { maxUses?: number; expiresAt?: string }) {
      await getCourse(communityId);
      await requireRole(userId, communityId, 'admin');
      return repo.createInvite({
        code: randomBytes(9).toString('base64url'), // 72 bit ngẫu nhiên: không đoán được
        communityId,
        createdBy: userId,
        maxUses: input.maxUses ?? null,
        usedCount: 0,
        expiresAt: input.expiresAt ?? null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
      });
    },

    async listInvites(userId: string, communityId: string) {
      await getCourse(communityId);
      await requireRole(userId, communityId, 'admin');
      return repo.listInvites(communityId);
    },

    async revokeInvite(userId: string, code: string) {
      const invite = await repo.findInvite(code);
      if (!invite) throw HttpError.notFound('Không tìm thấy lời mời');
      await requireRole(userId, invite.communityId, 'admin');
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
        // Cộng đồng riêng tư có phí: lời mời thay cho bước duyệt ⇒ ghi 1 yêu cầu đã duyệt (và dùng 1 lượt) để người nhận được phép thanh toán.
        if (course.visibility === 'private' && !(await repo.hasApprovedJoinRequest(course.id, userId))) {
          if (!(await repo.claimInviteUse(code))) throw HttpError.coded(410, 'INVITE_EXHAUSTED', 'Lời mời đã hết lượt sử dụng');
          await repo.createApprovedJoinRequest(course.id, userId, (await repo.findInvite(code))?.createdBy ?? userId);
        }
        throw HttpError.coded(402, 'PAYMENT_REQUIRED', 'Cộng đồng có phí: vui lòng thanh toán để tham gia', { communityId: course.id, courseId: course.id });
      }
      // Giữ lượt dùng atomically (chống hai người cùng nhận lượt cuối); hoàn lại nếu vào cộng đồng thất bại.
      if (!(await repo.claimInviteUse(code))) throw HttpError.coded(410, 'INVITE_EXHAUSTED', 'Lời mời đã hết lượt sử dụng');
      try {
        await admit(userId, course.id);
      } catch (e) {
        await repo.releaseInviteUse(code);
        throw e;
      }
      return { communityId: course.id, courseId: course.id, joined: true };
    },

    // ---------- thành viên ----------
    async memberDetail(viewerId: string, communityId: string, targetId: string) {
      await getCourse(communityId);
      await enrollmentService.requireMembership(viewerId, communityId);
      const m = await enrollmentService.getMember(targetId, communityId);
      if (m && (await enrollmentService.isEnrolled(targetId, communityId))) {
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

    async changeRole(actorId: string, communityId: string, targetId: string, role: Exclude<MemberRole, 'owner'>) {
      await getCourse(communityId);
      const actorRole = await requireRole(actorId, communityId, 'admin');
      if (actorId === targetId) throw HttpError.badRequest('Bạn không thể tự đổi vai trò của mình');
      // Thành viên minh họa (isDemo) không đổi vai trò được: coi như không tồn tại.
      if ((await userRepository.findById(targetId))?.isDemo) throw HttpError.notFound('Không tìm thấy thành viên');
      const target = await enrollmentService.getMember(targetId, communityId);
      if (!target || !(await enrollmentService.isEnrolled(targetId, communityId))) throw HttpError.notFound('Không tìm thấy thành viên');
      if (target.role === 'owner') throw HttpError.forbidden('Không thể đổi vai trò của chủ cộng đồng');
      // Đặt/bỏ admin chỉ owner (hoặc platform admin); admin chỉ đặt/bỏ mod.
      if ((role === 'admin' || target.role === 'admin') && roleRank(actorRole) < roleRank('owner')) {
        throw HttpError.forbidden('Chỉ chủ cộng đồng mới đặt hoặc bỏ quản trị viên');
      }
      if (target.role === role) return { userId: targetId, role };
      await enrollmentService.setRole(targetId, communityId, role);
      const course = await getCourse(communityId);
      notify({
        userId: targetId,
        type: 'role_changed',
        title: 'Vai trò của bạn đã thay đổi',
        body: `Bạn hiện là ${{ member: 'thành viên', mod: 'điều hành viên', admin: 'quản trị viên' }[role]} của "${course.title}"`,
        link: linkOf(communityId),
        communityId,
      });
      return { userId: targetId, role };
    },

    async kick(actorId: string, communityId: string, targetId: string) {
      const course = await getCourse(communityId);
      const target = await assertCanActOn(actorId, communityId, targetId);
      if (!target) throw HttpError.notFound('Không tìm thấy thành viên');
      await enrollmentService.remove(targetId, communityId);
      // Bị đuổi khỏi cộng đồng có phí: kết thúc gói ngay (không trừ tiền tiếp) + cổng duyệt cũ hết hiệu lực.
      await repo.revokeApprovedJoinRequests(communityId, targetId);
      await paymentsService.endMembership(targetId, communityId, `Bạn đã bị xóa khỏi "${course.title}" nên gói thành viên đã được hủy và sẽ không bị tính phí thêm.`);
      notify({
        userId: targetId,
        type: 'removed_from_community',
        title: 'Bạn đã bị xóa khỏi cộng đồng',
        body: `Bạn không còn là thành viên của "${course.title}"`,
        communityId,
      });
    },

    async ban(actorId: string, communityId: string, targetId: string, reason: string) {
      const course = await getCourse(communityId);
      const target = await assertCanActOn(actorId, communityId, targetId);
      // Chỉ cấm được người đang là thành viên (không phải oracle dò userId, không gửi thông báo "bị cấm" cho người chưa từng ở nhóm).
      if (!target) throw HttpError.notFound('Không tìm thấy thành viên');
      const targetUser = await userRepository.findById(targetId);
      if (!targetUser || targetUser.isDemo || targetUser.deletedAt) throw HttpError.notFound('Không tìm thấy người dùng');
      // Ghi lệnh cấm TRƯỚC rồi mới gỡ ghi danh (thứ tự an toàn: lỗi giữa chừng không để lại Enrollment ma hồi sinh khi gỡ cấm).
      await enrollmentService.setBanned(targetId, communityId, true, { reason, bannedById: actorId });
      await enrollmentService.remove(targetId, communityId);
      await repo.revokeApprovedJoinRequests(communityId, targetId);
      // Bị cấm: dừng gia hạn (không trừ tiền); gói còn hạn được khôi phục quyền nếu gỡ cấm trong kỳ.
      await paymentsService.stopRenewals(targetId, communityId, `Bạn bị cấm khỏi "${course.title}" nên gói thành viên sẽ không được gia hạn.`);
      notify({
        userId: targetId,
        type: 'removed_from_community',
        title: 'Bạn đã bị cấm khỏi cộng đồng',
        body: `Bạn bị cấm khỏi "${course.title}"${reason ? `. Lý do: ${reason}` : ''}`,
        communityId,
      });
    },

    async unban(actorId: string, communityId: string, targetId: string) {
      await getCourse(communityId);
      await requireRole(actorId, communityId, 'admin');
      if (!(await enrollmentService.isBanned(targetId, communityId))) throw HttpError.notFound('Người này không nằm trong danh sách cấm');
      await enrollmentService.setBanned(targetId, communityId, false);
      // Gói còn hiệu lực ⇒ trả lại quyền (không trừ tiền lần hai, không đổi kỳ).
      await paymentsService.restoreAccessIfSubscribed(targetId, communityId);
    },

    async listBans(actorId: string, communityId: string) {
      await getCourse(communityId);
      await requireRole(actorId, communityId, 'admin');
      const rows = await repo.listBans(communityId);
      return Promise.all(rows.map(async (b) => ({ ...b, user: await userBriefView(b.userId) })));
    },

    async transferOwnership(actorId: string, communityId: string, targetId: string) {
      const course = await getCourse(communityId);
      await requireRole(actorId, communityId, 'owner');
      if (actorId === targetId) throw HttpError.badRequest('Bạn đã là chủ cộng đồng');
      const target = await enrollmentService.getMember(targetId, communityId);
      if (!target || !(await enrollmentService.isEnrolled(targetId, communityId))) {
        throw HttpError.badRequest('Người nhận phải là thành viên của cộng đồng');
      }
      // Platform Admin có thể chuyển quyền thay owner (hoặc cộng đồng seed chưa có owner).
      const oldOwnerId = await enrollmentService.findOwnerId(communityId);
      const oldOwner = oldOwnerId ? { userId: oldOwnerId } : undefined;
      if (oldOwner) await enrollmentService.setRole(oldOwner.userId, communityId, 'admin');
      await enrollmentService.setRole(targetId, communityId, 'owner');
      if (course.ownerId) await catalogService.update(communityId, { ownerId: targetId });
      for (const [uid, body] of [
        [targetId, `Bạn đã trở thành chủ của "${course.title}"`],
        ...(oldOwner ? [[oldOwner.userId, `Bạn đã chuyển quyền chủ "${course.title}" và giờ là quản trị viên`] as const] : []),
      ] as const) {
        notify({ userId: uid, type: 'role_changed', title: 'Vai trò của bạn đã thay đổi', body, link: linkOf(communityId), communityId });
      }
      return { ownerId: targetId };
    },

  };
}

export const communitiesService = createCommunitiesService();
