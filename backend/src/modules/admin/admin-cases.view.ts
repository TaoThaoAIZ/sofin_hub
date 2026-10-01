import { prisma } from '../../db/prisma.js';
import type { Prisma, ReportRisk } from '../../generated/prisma/client.js';

/** Case kiểm duyệt = 1 dòng Report. File này chỉ dựng view `AdminCase` (không phụ thuộc service nào khác để tránh vòng import). */
export const caseInclude = {
  reporter: { select: { id: true, firstName: true, lastName: true } },
  targetUser: { select: { id: true, firstName: true, lastName: true } },
  course: { select: { id: true, title: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.ReportInclude;

export type CaseRow = Prisma.ReportGetPayload<{ include: typeof caseInclude }>;

const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim();
export const caseCode = (no: number) => `CASE-${String(no).padStart(5, '0')}`;

const RISK_RANK: Record<ReportRisk, number> = { low: 0, medium: 1, high: 2, critical: 3 };
export const RISKS = ['low', 'medium', 'high', 'critical'] as const;
export const nextRisk = (r: ReportRisk): ReportRisk => RISKS[Math.min(3, RISK_RANK[r] + 1)]!;

const REASON_BASE: Record<string, ReportRisk> = {
  spam: 'low',
  harassment: 'medium',
  inappropriate: 'low',
  misinformation: 'low',
  other: 'low',
  hate_speech: 'high',
  scam: 'high',
  copyright: 'medium',
  nsfw: 'medium',
};

/** Mức rủi ro tự tính: lý do nặng + số người cùng báo cáo 1 đối tượng. Không bao giờ hạ mức đã có. */
export function computeRisk(reason: string, reportCount: number): ReportRisk {
  const byCount: ReportRisk = reportCount >= 10 ? 'critical' : reportCount >= 5 ? 'high' : reportCount >= 3 ? 'medium' : 'low';
  const base = REASON_BASE[reason] ?? 'low';
  return RISK_RANK[base] >= RISK_RANK[byCount] ? base : byCount;
}

/** Gọi sau khi có báo cáo mới: nâng risk của mọi báo cáo còn mở trên cùng đối tượng. */
export async function bumpRiskForTarget(targetType: 'post' | 'comment' | 'member', targetId: string): Promise<void> {
  const rows = await prisma.report.findMany({ where: { targetType, targetId }, select: { id: true, reason: true, risk: true, status: true } });
  for (const r of rows) {
    if (r.status !== 'open' && r.status !== 'under_review') continue;
    const risk = computeRisk(r.reason, rows.length);
    if (RISK_RANK[risk] > RISK_RANK[r.risk]) await prisma.report.update({ where: { id: r.id }, data: { risk } });
  }
}

export async function toCaseViews(rows: CaseRow[]) {
  if (rows.length === 0) return [];
  const groups = await prisma.report.groupBy({
    by: ['targetType', 'targetId'],
    where: { OR: rows.map((r) => ({ targetType: r.targetType, targetId: r.targetId })) },
    _count: { _all: true },
  });
  const counts = new Map(groups.map((g) => [`${g.targetType}:${g.targetId}`, g._count._all]));
  return rows.map((r) => ({
    id: r.id,
    caseCode: caseCode(r.caseNo),
    targetType: r.targetType,
    content: {
      type: r.targetType,
      id: r.targetId,
      title: r.targetExcerpt ?? (r.targetType === 'member' ? name(r.targetUser) : ''),
      community: { id: r.course.id, name: r.course.title },
    },
    reportedUser: { id: r.targetUser.id, name: name(r.targetUser) },
    reporter: { id: r.reporter.id, name: name(r.reporter) },
    reason: r.reason,
    detail: r.detail,
    reportCount: counts.get(`${r.targetType}:${r.targetId}`) ?? 1,
    risk: r.risk,
    assignee: r.assignedTo ? { id: r.assignedTo.id, name: name(r.assignedTo) } : null,
    status: r.status,
    action: r.action,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));
}

export type AdminCaseView = Awaited<ReturnType<typeof toCaseViews>>[number];
