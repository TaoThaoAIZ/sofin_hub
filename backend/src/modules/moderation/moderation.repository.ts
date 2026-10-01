import { prisma } from '../../db/prisma.js';
import type { Report as DbReport } from '../../generated/prisma/client.js';
import type { Report, ReportAction, ReportStatus, ReportTargetType } from './moderation.types.js';

/** Báo cáo vi phạm (Postgres qua Prisma: bảng Report; unique (reporterId, targetType, targetId) chống báo cáo trùng). */
export interface ModerationRepository {
  /** Ném lỗi Prisma P2002 nếu (reporter, targetType, targetId) đã có báo cáo — service đổi thành 409. */
  create(input: Omit<Report, 'id' | 'createdAt' | 'status'>): Promise<Report>;
  findById(id: string): Promise<Report | undefined>;
  findByReporterAndTarget(reporterId: string, targetType: ReportTargetType, targetId: string): Promise<Report | undefined>;
  /** courseId bỏ trống = mọi cộng đồng (Platform Admin). Mới nhất trước; phân trang ở DB. */
  list(filter: { courseId?: string; status?: ReportStatus; page: number; limit: number }): Promise<{ items: Report[]; total: number }>;
  /**
   * Chuyển báo cáo từ open sang trạng thái xử lý — atomic (`updateMany ... WHERE status = 'open'`).
   * Trả báo cáo mới, hoặc undefined nếu nó không còn open (đã có người xử lý trước).
   */
  resolve(id: string, patch: { status: 'resolved' | 'dismissed'; action: ReportAction; note?: string; resolvedBy: string }): Promise<Report | undefined>;
}

const toReport = (r: DbReport): Report => ({
  id: r.id,
  courseId: r.courseId,
  targetType: r.targetType,
  targetId: r.targetId,
  targetUserId: r.targetUserId,
  targetExcerpt: r.targetExcerpt ?? undefined,
  reporterId: r.reporterId,
  reason: r.reason,
  detail: r.detail ?? undefined,
  status: r.status,
  action: r.action ?? undefined,
  note: r.note ?? undefined,
  resolvedBy: r.resolvedById ?? undefined,
  resolvedAt: r.resolvedAt?.toISOString(),
  createdAt: r.createdAt.toISOString(),
});

export const moderationRepository: ModerationRepository = {
  async create(input) {
    const r = await prisma.report.create({
      data: {
        courseId: input.courseId,
        targetType: input.targetType,
        targetId: input.targetId,
        targetUserId: input.targetUserId,
        targetExcerpt: input.targetExcerpt,
        reporterId: input.reporterId,
        reason: input.reason,
        detail: input.detail,
      },
    });
    return toReport(r);
  },

  async findById(id) {
    const r = await prisma.report.findUnique({ where: { id } });
    return r ? toReport(r) : undefined;
  },

  async findByReporterAndTarget(reporterId, targetType, targetId) {
    const r = await prisma.report.findUnique({ where: { reporterId_targetType_targetId: { reporterId, targetType, targetId } } });
    return r ? toReport(r) : undefined;
  },

  async list({ courseId, status, page, limit }) {
    const where = { ...(courseId ? { courseId } : {}), ...(status ? { status } : {}) };
    const [rows, total] = await Promise.all([
      prisma.report.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit }),
      prisma.report.count({ where }),
    ]);
    return { items: rows.map(toReport), total };
  },

  async resolve(id, patch) {
    const r = await prisma.report.updateMany({
      where: { id, status: { in: ['open', 'under_review'] } },
      data: { status: patch.status, action: patch.action, note: patch.note, resolvedById: patch.resolvedBy, resolvedAt: new Date() },
    });
    if (r.count === 0) return undefined;
    return this.findById(id);
  },
};

/** @deprecated Tên cũ; dùng `moderationRepository`. */
export const inMemoryModerationRepository: ModerationRepository = moderationRepository;
