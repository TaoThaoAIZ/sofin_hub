import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { getRole, isPlatformAdmin, ROLES, type Role } from '../permissions/policy.js';
import { postsService } from '../posts/posts.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { bumpRiskForTarget } from '../admin/admin-cases.view.js';
import { moderationRepository, type ModerationRepository } from './moderation.repository.js';
import type { CreateReportBody, ListReportsQuery, ResolveReportBody } from './moderation.schema.js';
import type { Report, ReportStatus, ReportTargetType, ReportView } from './moderation.types.js';

const rank = (r: Role | null) => (r === null ? -1 : ROLES.indexOf(r));
const excerpt = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function createModerationService(repo: ModerationRepository = moderationRepository) {
  async function toView(r: Report): Promise<ReportView> {
    return {
      ...r,
      reporterName: (await userBriefView(r.reporterId)).name,
      targetUserName: (await userBriefView(r.targetUserId)).name,
    };
  }

  async function paginate(filter: { communityId?: string; status?: ReportStatus }, query: ListReportsQuery) {
    const { items, total } = await repo.list({ ...filter, page: query.page, limit: query.limit });
    const data = await Promise.all(items.map(toView));
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  return {
    /** Tạo báo cáo. Caller đã kiểm reporter là thành viên của `communityId`. */
    async report(
      reporterId: string,
      communityId: string,
      targetType: ReportTargetType,
      targetId: string,
      targetUserId: string,
      body: CreateReportBody,
      targetExcerpt?: string,
    ): Promise<ReportView> {
      if (targetUserId === reporterId) throw HttpError.badRequest('Bạn không thể báo cáo chính mình hoặc nội dung của mình');
      if (await repo.findByReporterAndTarget(reporterId, targetType, targetId)) throw HttpError.conflict('Bạn đã báo cáo mục này rồi');
      let report: Report;
      try {
        report = await repo.create({
          communityId,
          targetType,
          targetId,
          targetUserId,
          targetExcerpt: targetExcerpt ? excerpt(targetExcerpt) : undefined,
          reporterId,
          reason: body.reason,
          detail: body.detail,
        });
      } catch (e) {
        // Hai báo cáo song song cùng (reporter, đối tượng): unique index chặn ở DB.
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Bạn đã báo cáo mục này rồi');
        throw e;
      }
      // Tự nâng mức rủi ro theo lý do + số báo cáo trên cùng đối tượng (hàng đợi admin sắp theo risk). Lỗi ở đây không được làm hỏng báo cáo.
      await bumpRiskForTarget(targetType, targetId).catch(() => undefined);
      return toView((await repo.findById(report.id)) ?? report);
    },

    async reportPost(reporterId: string, postId: string, body: CreateReportBody) {
      const post = await postsService.getVisibleOrThrow(postId, reporterId);
      await enrollmentService.requireMembership(reporterId, post.communityId);
      return this.report(reporterId, post.communityId, 'post', post.id, post.authorId, body, post.content);
    },

    async reportComment(reporterId: string, commentId: string, body: CreateReportBody) {
      const { comment, post } = await postsService.getCommentOrThrow(commentId);
      await enrollmentService.requireMembership(reporterId, post.communityId);
      return this.report(reporterId, post.communityId, 'comment', comment.id, comment.authorId, body, comment.content);
    },

    async reportMember(reporterId: string, communityId: string, userId: string, body: CreateReportBody) {
      await enrollmentService.requireMembership(reporterId, communityId);
      if (!(await enrollmentService.isEnrolled(userId, communityId))) throw HttpError.notFound('Không tìm thấy thành viên');
      return this.report(reporterId, communityId, 'member', userId, userId, body);
    },

    listForCourse: (communityId: string, query: ListReportsQuery) => paginate({ communityId, status: query.status }, query),
    listAll: (query: ListReportsQuery) => paginate({ status: query.status }, query),

    async getOrThrow(id: string) {
      const r = await repo.findById(id);
      if (!r) throw HttpError.notFound('Không tìm thấy báo cáo');
      return r;
    },

    /**
     * Xử lý báo cáo. Caller đã kiểm actor là mod+ của cộng đồng (hoặc Platform Admin).
     * THỨ TỰ: (0) kiểm hợp lệ không tác dụng phụ → (1) CHỐT TICKET trước (nhận "vé" độc quyền, nguyên tử) → (2) chỉ bên thắng mới ẩn/cấm.
     * Hai mod xử lý song song với hành động khác nhau không còn cho ra "hồ sơ nói dismiss nhưng bài vẫn bị ẩn". Thi hành lỗi ⇒ mở lại ticket.
     */
    async resolve(reportId: string, actorId: string, body: ResolveReportBody): Promise<ReportView> {
      const report = await this.getOrThrow(reportId);
      if (report.status !== 'open' && report.status !== 'under_review') throw HttpError.conflict('Báo cáo này đã được xử lý');
      const previous: 'open' | 'under_review' = report.status;

      if (body.action === 'hide_content' && report.targetType !== 'post' && report.targetType !== 'comment') throw HttpError.badRequest('Chỉ ẩn được bài viết hoặc bình luận');
      if (body.action === 'ban_member') await this.assertCanBan(report, actorId);

      const resolved = await repo.resolve(report.id, {
        status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
        action: body.action,
        note: body.note,
        resolvedBy: actorId,
      });
      if (!resolved) throw HttpError.conflict('Báo cáo này đã được xử lý');

      try {
        if (body.action === 'hide_content') {
          if (report.targetType === 'post') await postsService.setHidden(report.targetId, true);
          else await postsService.setCommentHidden(report.targetId, true);
          const course = await catalogService.getById(report.communityId).catch(() => undefined);
          notify({
            userId: report.targetUserId,
            type: 'system',
            title: 'Nội dung của bạn đã bị ẩn',
            body: `${report.targetType === 'post' ? 'Bài viết' : 'Bình luận'} của bạn${course ? ` trong "${course.title}"` : ''} đã bị điều hành viên ẩn vì vi phạm nội quy.`,
            link: `/courses/${report.communityId}/community`,
            communityId: report.communityId,
          });
        } else if (body.action === 'ban_member') {
          await this.banTarget(report, actorId);
        }
      } catch (e) {
        await repo.reopen(report.id, previous); // thi hành thất bại: trả ticket về trạng thái cũ để xử lý lại
        // Hai người xử lý song song cùng báo cáo: người đến sau va unique của CommunityBan -> coi như đã được xử lý.
        if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Báo cáo này đã được xử lý');
        throw e;
      }

      const outcome =
        body.action === 'dismiss' ? 'không vi phạm và đã được bỏ qua' : body.action === 'hide_content' ? 'vi phạm, nội dung đã bị ẩn' : 'vi phạm, thành viên đã bị cấm';
      notify({
        userId: report.reporterId,
        type: 'report_resolved',
        title: 'Báo cáo của bạn đã được xử lý',
        body: `Báo cáo của bạn được xác định là ${outcome}.`,
        communityId: report.communityId,
      });
      return toView(resolved);
    },

    /** Kiểm quyền cấm chủ của đối tượng bị báo cáo (không tác dụng phụ): không cấm owner / Platform Admin / người có vai trò >= người xử lý. */
    async assertCanBan(report: Report, actorId: string) {
      const userId = report.targetUserId;
      if ((await userRepository.findById(userId))?.isDemo) throw HttpError.badRequest('Không thể cấm nội dung minh họa');
      if (await isPlatformAdmin(userId)) throw HttpError.forbidden('Không thể cấm Platform Admin');
      const targetMember = await enrollmentService.getMember(userId, report.communityId);
      if (targetMember?.role === 'owner') throw HttpError.forbidden('Không thể cấm chủ cộng đồng');
      const actorRole = await getRole(actorId, report.communityId);
      if (rank(actorRole) <= rank(targetMember?.role ?? null)) throw HttpError.forbidden('Bạn không thể cấm người có vai trò ngang hoặc cao hơn mình');
    },

    /** Cấm chủ của đối tượng bị báo cáo: ghi lệnh cấm TRƯỚC rồi gỡ ghi danh, dừng gia hạn gói, báo cho người bị cấm. */
    async banTarget(report: Report, actorId: string) {
      await this.assertCanBan(report, actorId);
      const userId = report.targetUserId;
      await enrollmentService.setBanned(userId, report.communityId, true, { reason: `Bị báo cáo (${report.reason})`, bannedById: actorId });
      await enrollmentService.remove(userId, report.communityId);
      const course = await catalogService.getById(report.communityId).catch(() => undefined);
      const title = course ? `"${course.title}"` : 'cộng đồng';
      await paymentsService.stopRenewals(userId, report.communityId, `Bạn bị cấm khỏi ${title} nên gói thành viên sẽ không được gia hạn.`);
      notify({
        userId,
        type: 'removed_from_community',
        title: 'Bạn đã bị cấm khỏi cộng đồng',
        body: `Bạn bị cấm khỏi ${title} do vi phạm nội quy (${report.reason}).`,
        communityId: report.communityId,
      });
    },
  };
}

export const moderationService = createModerationService();
