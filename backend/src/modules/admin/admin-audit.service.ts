import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../db/prisma.js';
import { userBriefView } from '../auth/user-view.js';
import { adminRequestContext } from './admin-staff.service.js';
import { pageMeta, type PageQuery } from './admin.common.js';

export interface AuditEntry {
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  reason?: string | null;
  note?: string | null;
  evidence?: string | null;
  caseId?: string | null;
  metadata?: Record<string, unknown>;
}

type AuditRow = Prisma.AdminAuditLogGetPayload<{ include: { actor: { select: { id: true; firstName: true; lastName: true; email: true } } } }>;

export type ActorRoles = Map<string, { key: string; name: string }>;

export const toAuditItem = (r: AuditRow, roles?: ActorRoles) => ({
  id: r.id,
  actor: { id: r.actorId, name: r.actorName, email: r.actor?.email ?? null, role: (r.actorId && roles?.get(r.actorId)) || null },
  ip: r.ip,
  action: r.action,
  targetType: r.targetType,
  targetId: r.targetId,
  targetLabel: r.targetLabel,
  reason: r.reason,
  note: r.note,
  evidence: r.evidence,
  caseId: r.caseId,
  metadata: r.metadata,
  createdAt: r.createdAt.toISOString(),
});

export interface AuditListQuery extends PageQuery {
  actor?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  q?: string;
  from?: string;
  to?: string;
}

const include = { actor: { select: { id: true, firstName: true, lastName: true, email: true } } } as const;

export const auditService = {
  /** Ghi 1 dòng nhật ký cho hành động của admin. Gọi SAU khi thao tác thành công (một dòng cho mỗi thao tác). */
  async record(actorId: string, e: AuditEntry): Promise<void> {
    await prisma.adminAuditLog.create({
      data: {
        actorId,
        actorName: (await userBriefView(actorId)).name,
        action: e.action,
        targetType: e.targetType,
        targetId: e.targetId,
        targetLabel: e.targetLabel ?? '',
        reason: e.reason ?? null,
        note: e.note ?? null,
        evidence: e.evidence ?? null,
        caseId: e.caseId ?? null,
        metadata: (e.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: adminRequestContext.getStore()?.ip ?? null,
      },
    });
  },

  /** Dòng audit của 1 đối tượng (mới nhất trước) — dùng cho phần lịch sử ở trang chi tiết. */
  async forTarget(targetType: string, targetId: string, take = 10) {
    const rows = await prisma.adminAuditLog.findMany({ where: { targetType, targetId }, orderBy: { createdAt: 'desc' }, take, include });
    return rows.map((r) => toAuditItem(r));
  },

  /** Vai trò hiện tại của các actor (Super Admin env hoặc AdminAccount) cho cột "Admin" của Audit Logs. */
  async actorRoles(rows: AuditRow[]): Promise<ActorRoles> {
    const ids = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
    const out: ActorRoles = new Map();
    if (!ids.length) return out;
    const accounts = await prisma.adminAccount.findMany({ where: { userId: { in: ids } }, select: { userId: true, role: { select: { key: true, name: true } } } });
    for (const a of accounts) out.set(a.userId, a.role);
    for (const r of rows) if (r.actorId && r.actor && env.PLATFORM_ADMIN_EMAILS.includes(r.actor.email.toLowerCase())) out.set(r.actorId, { key: 'super_admin', name: 'Super Admin' });
    return out;
  },

  where(q: Omit<AuditListQuery, 'page' | 'limit'>): Prisma.AdminAuditLogWhereInput {
    return {
      ...(q.actor ? { actorId: q.actor } : {}),
      ...(q.action ? (q.action.endsWith('.') ? { action: { startsWith: q.action } } : { action: q.action }) : {}),
      ...(q.targetType ? { targetType: q.targetType } : {}),
      ...(q.targetId ? { targetId: q.targetId } : {}),
      ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } } : {}),
      ...(q.q
        ? {
            OR: [
              { targetLabel: { contains: q.q, mode: 'insensitive' } },
              { actorName: { contains: q.q, mode: 'insensitive' } },
              { reason: { contains: q.q, mode: 'insensitive' } },
              { action: { contains: q.q, mode: 'insensitive' } },
              { caseId: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  },

  async list(q: AuditListQuery) {
    const where = this.where(q);
    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit, include }),
      prisma.adminAuditLog.count({ where }),
    ]);
    const roles = await this.actorRoles(rows);
    return { data: rows.map((r) => toAuditItem(r, roles)), meta: pageMeta(q.page, q.limit, total) };
  },

  /** Giá trị cho dropdown lọc (Admin / Action / Target type). */
  async filters() {
    const [actors, actions, targets] = await Promise.all([
      prisma.adminAuditLog.groupBy({ by: ['actorId', 'actorName'], where: { actorId: { not: null } }, _max: { createdAt: true } }),
      prisma.adminAuditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      prisma.adminAuditLog.findMany({ distinct: ['targetType'], select: { targetType: true }, orderBy: { targetType: 'asc' } }),
    ]);
    const byId = new Map<string, string>();
    for (const a of actors.sort((x, y) => (y._max.createdAt?.getTime() ?? 0) - (x._max.createdAt?.getTime() ?? 0))) if (a.actorId && !byId.has(a.actorId)) byId.set(a.actorId, a.actorName);
    return {
      actors: [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      actions: actions.map((a) => a.action),
      targetTypes: targets.map((t) => t.targetType),
    };
  },

  /** CSV (UTF-8 + BOM để Excel đọc tiếng Việt), tối đa 5000 dòng mới nhất theo bộ lọc. */
  async exportCsv(q: Omit<AuditListQuery, 'page' | 'limit'>): Promise<string> {
    const rows = await prisma.adminAuditLog.findMany({ where: this.where(q), orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 5000, include });
    const cell = (v: unknown) => {
      let t = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; // chặn CSV/formula injection khi mở bằng Excel
      return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const lines = [['time', 'admin', 'action', 'targetType', 'targetId', 'target', 'case', 'reason', 'ip'].join(',')];
    for (const r of rows) lines.push([r.createdAt.toISOString(), r.actorName, r.action, r.targetType, r.targetId, r.targetLabel, r.caseId, r.reason, r.ip].map(cell).join(','));
    return `﻿${lines.join('\r\n')}\r\n`;
  },
};
