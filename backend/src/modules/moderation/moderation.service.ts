import { HttpError } from '../../utils/http-error.js';
import { userBriefView } from '../auth/user-view.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { notify } from '../notifications/notifications.service.js';
import { getRole, isPlatformAdmin, ROLES, type Role } from '../permissions/policy.js';
import { postsService } from '../posts/posts.service.js';
import { userRepository } from '../auth/auth.repository.js';
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

  async function paginate(filter: { courseId?: string; status?: ReportStatus }, query: ListReportsQuery) {
    const { items, total } = await repo.list({ ...filter, page: query.page, limit: query.limit });
    const data = await Promise.all(items.map(toView));
    return { data, meta: { page: query.page, limit: query.limit, total, totalPages: Math.max(1, Math.ceil(total / query.limit)) } };
  }

  return {
    /** Tạo báo cáo. Caller đã kiểm reporter là thành viên của `courseId`. */
    async report(
      reporterId: string,
      courseId: string,
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
          courseId,
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
      return toView(report);
    },

    async reportPost(reporterId: string, postId: string, body: CreateReportBody) {
      const post = await postsService.getVisibleOrThrow(postId, reporterId);
      await enrollmentService.requireMembership(reporterId, post.courseId);
      return this.report(reporterId, post.courseId, 'post', post.id, post.authorId, body, post.content);
    },

    async reportComment(reporterId: string, commentId: string, body: CreateReportBody) {
      const { comment, post } = await postsService.getCommentOrThrow(commentId);
      await enrollmentService.requireMembership(reporterId, post.courseId);
      return this.report(reporterId, post.courseId, 'comment', comment.id, comment.authorId, body, comment.content);
    },

    async reportMember(reporterId: string, courseId: string, userId: string, body: CreateReportBody) {
      await enrollmentService.requireMembership(reporterId, courseId);
      if (!(await enrollmentService.isEnrolled(userId, courseId))) throw HttpError.notFound('Không tìm thấy thành viên');
      return this.report(reporterId, courseId, 'member', userId, userId, body);
    },

    listForCourse: (courseId: string, query: ListReportsQuery) => paginate({ courseId, status: query.status }, query),
    listAll: (query: ListReportsQuery) => paginate({ status: query.status }, query),

    async getOrThrow(id: string) {
      const r = await repo.findById(id);
      if (!r) throw HttpError.notFound('Không tìm thấy báo cáo');
      return r;
    },

    /** Xử lý báo cáo. Caller đã kiểm actor là mod+ của cộng đồng (hoặc Platform Admin). */
    async resolve(reportId: string, actorId: string, body: ResolveReportBody): Promise<ReportView> {
      const report = await this.getOrThrow(reportId);
      if (report.status !== 'open') throw HttpError.conflict('Báo cáo này đã được xử lý');

      if (body.action === 'hide_content') {
        if (report.targetType === 'post') await postsService.setHidden(report.targetId, true);
        else if (report.targetType === 'comment') await postsService.setCommentHidden(report.targetId, true);
        else throw HttpError.badRequest('Chỉ ẩn được bài viết hoặc bình luận');
      } else if (body.action === 'ban_member') {
        try {
          await this.banTarget(report, actorId);
        } catch (e) {
          // Hai người xử lý song song cùng báo cáo: người đến sau va unique của CommunityBan -> coi như đã được xử lý.
          if ((e as { code?: string }).code === 'P2002') throw HttpError.conflict('Báo cáo này đã được xử lý');
          throw e;
        }
      }

      // Chốt trạng thái atomically: nếu người khác vừa xử lý xong thì 409.
      const resolved = await repo.resolve(report.id, {
        status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
        action: body.action,
        note: body.note,
        resolvedBy: actorId,
      });
      if (!resolved) throw HttpError.conflict('Báo cáo này đã được xử lý');

      const outcome =
        body.action === 'dismiss' ? 'không vi phạm và đã được bỏ qua' : body.action === 'hide_content' ? 'vi phạm, nội dung đã bị ẩn' : 'vi phạm, thành viên đã bị cấm';
      notify({
        userId: report.reporterId,
        type: 'report_resolved',
        title: 'Báo cáo của bạn đã được xử lý',
        body: `Báo cáo của bạn được xác định là ${outcome}.`,
        courseId: report.courseId,
      });
      return toView(resolved);
    },

    /** Cấm chủ của đối tượng bị báo cáo: không cấm owner / Platform Admin / người có vai trò >= vai trò của người xử lý. */
    async banTarget(report: Report, actorId: string) {
      const userId = report.targetUserId;
      if ((await userRepository.findById(userId))?.isDemo) throw HttpError.badRequest('Không thể cấm nội dung minh họa');
      if (await isPlatformAdmin(userId)) throw HttpError.forbidden('Không thể cấm Platform Admin');
      const targetMember = await enrollmentService.getMember(userId, report.courseId);
      if (targetMember?.role === 'owner') throw HttpError.forbidden('Không thể cấm chủ cộng đồng');
      const actorRole = await getRole(actorId, report.courseId);
      if (rank(actorRole) <= rank(targetMember?.role ?? null)) throw HttpError.forbidden('Bạn không thể cấm người có vai trò ngang hoặc cao hơn mình');
      await enrollmentService.setBanned(userId, report.courseId, true, { reason: `Bị báo cáo (${report.reason})`, bannedById: actorId });
      await enrollmentService.remove(userId, report.courseId);
    },
  };
}

export const moderationService = createModerationService();
