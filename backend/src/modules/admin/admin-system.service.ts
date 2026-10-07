import { createHash } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { mailService } from '../mail/mail.service.js';
import { renderTemplate, templateVariables } from '../mail/mail-templates.service.js';
import { notify } from '../notifications/notifications.service.js';
import {
  SETTING_DEFS,
  SETTING_KEYS,
  buildConfig,
  cfg,
  getOverrides,
  refreshConfig,
  writeOverrides,
  type Overrides,
  type SettingKey,
} from '../settings/settings.service.js';
import { auditService } from './admin-audit.service.js';
import { likeEscape, pageMeta, pageQuery } from './admin.common.js';

/** System: Feature Flags · Integrations · Notifications · Email Templates · Global Settings. Contract: docs/api/admin-batch3.md (C4..C9). */

const keyField = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{1,59}$/, 'Khóa chỉ gồm a-z, 0-9, _ (2-60 ký tự, bắt đầu bằng chữ)');
const updaterOf = async (ids: Array<string | null | undefined>) => {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  const out = new Map<string, { id: string; name: string }>();
  for (const id of uniq) out.set(id, { id, name: (await userBriefView(id)).name });
  return out;
};

/* ================================================================== FEATURE FLAGS */
const STAGES = ['draft', 'beta', 'active'] as const;
export const flagsQuery = z.object({ q: z.string().trim().max(60).optional(), stage: z.enum(STAGES).optional(), enabled: z.enum(['true', 'false']).optional() });
export const createFlagBody = z.object({
  key: keyField,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  stage: z.enum(STAGES).default('draft'),
  enabled: z.boolean().default(false),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
});
export const patchFlagBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    stage: z.enum(STAGES).optional(),
    enabled: z.boolean().optional(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const toggleFlagBody = z.object({ enabled: z.boolean().optional() });

type FlagRow = Prisma.FeatureFlagGetPayload<object>;
const flagView = (f: FlagRow, by: Map<string, { id: string; name: string }>) => ({
  key: f.key,
  name: f.name,
  description: f.description,
  stage: f.stage,
  enabled: f.enabled,
  rolloutPercent: f.rolloutPercent,
  updatedAt: f.updatedAt.toISOString(),
  updatedBy: (f.updatedById && by.get(f.updatedById)) || null,
});

/** Băm ổn định (flag, user) -> 0..99, để cùng 1 user luôn vào/ra nhóm rollout theo cùng cách. */
export const bucketOf = (flag: string, userId: string) => parseInt(createHash('sha256').update(`${flag}:${userId}`).digest('hex').slice(0, 8), 16) % 100;
export const flagOn = (f: Pick<FlagRow, 'key' | 'enabled' | 'rolloutPercent'>, userId?: string) =>
  f.enabled && (f.rolloutPercent >= 100 || (!!userId && f.rolloutPercent > 0 && bucketOf(f.key, userId) < f.rolloutPercent));

export async function publicFlags(userId?: string) {
  const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return Object.fromEntries(rows.map((f) => [f.key, flagOn(f, userId)]));
}

const flagService = {
  async list(q: z.infer<typeof flagsQuery>) {
    const rows = await prisma.featureFlag.findMany({
      where: {
        ...(q.stage ? { stage: q.stage } : {}),
        ...(q.enabled ? { enabled: q.enabled === 'true' } : {}),
        ...(q.q ? { OR: [{ key: { contains: likeEscape(q.q), mode: 'insensitive' } }, { name: { contains: likeEscape(q.q), mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
    });
    const by = await updaterOf(rows.map((r) => r.updatedById));
    return rows.map((r) => flagView(r, by));
  },
  async one(key: string) {
    const f = await prisma.featureFlag.findUnique({ where: { key } });
    if (!f) throw HttpError.notFound('Không tìm thấy feature flag');
    return flagView(f, await updaterOf([f.updatedById]));
  },
  async create(actorId: string, b: z.infer<typeof createFlagBody>) {
    if (await prisma.featureFlag.findUnique({ where: { key: b.key } })) throw HttpError.conflict('Feature flag đã tồn tại');
    await prisma.featureFlag.create({ data: { ...b, updatedById: actorId } });
    await auditService.record(actorId, { action: 'flag.create', targetType: 'flag', targetId: b.key, targetLabel: b.name, metadata: { enabled: b.enabled, stage: b.stage } });
    return this.one(b.key);
  },
  async patch(actorId: string, key: string, b: z.infer<typeof patchFlagBody>) {
    const cur = await prisma.featureFlag.findUnique({ where: { key } });
    if (!cur) throw HttpError.notFound('Không tìm thấy feature flag');
    await prisma.featureFlag.update({ where: { key }, data: { ...b, updatedById: actorId } });
    const action = b.enabled !== undefined && b.enabled !== cur.enabled ? (b.enabled ? 'flag.enable' : 'flag.disable') : 'flag.update';
    await auditService.record(actorId, { action, targetType: 'flag', targetId: key, targetLabel: b.name ?? cur.name, metadata: { changes: b } });
    return this.one(key);
  },
  async toggle(actorId: string, key: string, enabled?: boolean) {
    const cur = await prisma.featureFlag.findUnique({ where: { key } });
    if (!cur) throw HttpError.notFound('Không tìm thấy feature flag');
    return this.patch(actorId, key, { enabled: enabled ?? !cur.enabled });
  },
  async remove(actorId: string, key: string) {
    const cur = await prisma.featureFlag.findUnique({ where: { key } });
    if (!cur) throw HttpError.notFound('Không tìm thấy feature flag');
    await prisma.featureFlag.delete({ where: { key } });
    await auditService.record(actorId, { action: 'flag.delete', targetType: 'flag', targetId: key, targetLabel: cur.name });
    return { deleted: true };
  },
};

/* ================================================================== INTEGRATIONS */
export const integrationsQuery = z.object({ category: z.string().trim().max(30).optional() });
export const connectBody = z.object({ config: z.record(z.string().max(60), z.union([z.string().max(300), z.number(), z.boolean()])).optional(), apiKey: z.string().trim().min(1).max(500).optional() });
export const patchIntegrationBody = connectBody.refine((b) => b.config !== undefined || b.apiKey !== undefined, { message: 'Không có gì để cập nhật' });

type IntRow = Prisma.IntegrationGetPayload<object>;
const integrationView = (r: IntRow) => ({
  key: r.key,
  name: r.name,
  initials: r.initials,
  color: r.color,
  description: r.description,
  category: r.category,
  connected: r.connected,
  config: r.config,
  secretMask: r.secretMask,
  connectedAt: r.connectedAt?.toISOString() ?? null,
  updatedAt: r.updatedAt.toISOString(),
});
/** Khóa thật KHÔNG được lưu: chỉ giữ mask 4 ký tự cuối để hiển thị. */
const maskOf = (k: string) => `••••${k.slice(-4)}`;

const integrationService = {
  async list(q: z.infer<typeof integrationsQuery>) {
    const rows = await prisma.integration.findMany({ where: q.category ? { category: q.category } : {}, orderBy: [{ createdAt: 'asc' }, { key: 'asc' }] });
    return rows.map(integrationView);
  },
  async get(key: string) {
    const r = await prisma.integration.findUnique({ where: { key } });
    if (!r) throw HttpError.notFound('Không tìm thấy tích hợp');
    return r;
  },
  async one(key: string) {
    return integrationView(await this.get(key));
  },
  async connect(actorId: string, key: string, b: z.infer<typeof connectBody>) {
    const cur = await this.get(key);
    if (cur.connected) throw HttpError.conflict('Tích hợp đã được kết nối');
    await prisma.integration.update({
      where: { key },
      data: {
        connected: true,
        connectedAt: new Date(),
        updatedById: actorId,
        ...(b.config ? { config: b.config as Prisma.InputJsonValue } : {}),
        ...(b.apiKey ? { secretMask: maskOf(b.apiKey) } : {}),
      },
    });
    await auditService.record(actorId, { action: 'integration.connect', targetType: 'integration', targetId: key, targetLabel: cur.name });
    return this.one(key);
  },
  async disconnect(actorId: string, key: string) {
    const cur = await this.get(key);
    if (!cur.connected) throw HttpError.conflict('Tích hợp chưa được kết nối');
    await prisma.integration.update({ where: { key }, data: { connected: false, connectedAt: null, secretMask: null, updatedById: actorId } });
    await auditService.record(actorId, { action: 'integration.disconnect', targetType: 'integration', targetId: key, targetLabel: cur.name });
    return this.one(key);
  },
  async patch(actorId: string, key: string, b: z.infer<typeof patchIntegrationBody>) {
    const cur = await this.get(key);
    await prisma.integration.update({
      where: { key },
      data: { updatedById: actorId, ...(b.config ? { config: b.config as Prisma.InputJsonValue } : {}), ...(b.apiKey ? { secretMask: maskOf(b.apiKey) } : {}) },
    });
    // Không ghi giá trị khóa vào audit, chỉ ghi tên trường đã đổi.
    await auditService.record(actorId, { action: 'integration.update', targetType: 'integration', targetId: key, targetLabel: cur.name, metadata: { fields: Object.keys(b) } });
    return this.one(key);
  },
  async test(key: string) {
    const r = await this.get(key);
    const latencyMs = 40 + (createHash('md5').update(key).digest()[0]! % 120);
    return r.connected
      ? { ok: true, message: `Kết nối tới ${r.name} hoạt động bình thường (mô phỏng)`, latencyMs }
      : { ok: false, message: `${r.name} chưa được kết nối`, latencyMs: 0 };
  },
};

/* ================================================================== NOTIFICATIONS */
const ALERTS_KEY = 'admin.alerts';
const alertGroups = {
  moderation: z.object({ criticalReports: z.boolean(), pendingCommunities: z.boolean(), aiFlagged: z.boolean() }).partial().strict(),
  payments: z.object({ newChargeback: z.boolean(), failedPayout: z.boolean(), refundOver500: z.boolean() }).partial().strict(),
  reports: z.object({ weeklySummary: z.boolean(), monthlyBoardReport: z.boolean(), sendTo: z.string().trim().email().max(180).or(z.literal('')) }).partial().strict(),
};
export const alertSettingsBody = z.object(alertGroups).partial().strict();
const ALERT_DEFAULTS = {
  moderation: { criticalReports: true, pendingCommunities: true, aiFlagged: false },
  payments: { newChargeback: true, failedPayout: true, refundOver500: true },
  reports: { weeklySummary: true, monthlyBoardReport: false, sendTo: 'ops@sofinhub.com' },
};

const audienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('all') }),
  z.object({ type: z.literal('creators') }),
  z.object({ type: z.literal('paid_members') }),
  z.object({ type: z.literal('community'), communityId: z.string().min(1).max(100) }),
  z.object({ type: z.literal('users'), userIds: z.array(z.string().min(1).max(100)).min(1).max(500) }),
]);
export type Audience = z.infer<typeof audienceSchema>;
export const previewBody = z.object({ audience: audienceSchema });
export const broadcastBody = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(120),
  body: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(1000),
  link: z.string().trim().max(300).regex(/^\//, 'Liên kết phải là đường dẫn nội bộ bắt đầu bằng /').optional(),
  audience: audienceSchema,
  sendEmail: z.boolean().default(false),
});
const MAX_NOTIFY_FANOUT = 500;

async function audienceUserIds(a: Audience): Promise<string[]> {
  const live: Prisma.UserWhereInput = { deletedAt: null, status: { not: 'banned' } };
  let where: Prisma.UserWhereInput;
  switch (a.type) {
    case 'all':
      where = { ...live, isDemo: false };
      break;
    case 'creators':
      where = { ...live, ownedCommunities: { some: {} } };
      break;
    case 'paid_members':
      where = { ...live, subscriptions: { some: { status: { in: ['active', 'trialing', 'past_due'] } } } };
      break;
    case 'community':
      if (!(await prisma.community.findUnique({ where: { id: a.communityId }, select: { id: true } }))) throw HttpError.notFound('Không tìm thấy cộng đồng');
      where = { ...live, enrollments: { some: { communityId: a.communityId } } };
      break;
    case 'users':
      where = { ...live, id: { in: a.userIds } };
      break;
  }
  return (await prisma.user.findMany({ where, select: { id: true } })).map((u) => u.id);
}

const notificationService = {
  async getAlerts() {
    const row = await prisma.platformSetting.findUnique({ where: { key: ALERTS_KEY } });
    const saved = (row?.value ?? {}) as Partial<typeof ALERT_DEFAULTS>;
    return {
      moderation: { ...ALERT_DEFAULTS.moderation, ...saved.moderation },
      payments: { ...ALERT_DEFAULTS.payments, ...saved.payments },
      reports: { ...ALERT_DEFAULTS.reports, ...saved.reports },
    };
  },
  async putAlerts(actorId: string, b: z.infer<typeof alertSettingsBody>) {
    const cur = await this.getAlerts();
    const next = { moderation: { ...cur.moderation, ...b.moderation }, payments: { ...cur.payments, ...b.payments }, reports: { ...cur.reports, ...b.reports } };
    await prisma.platformSetting.upsert({
      where: { key: ALERTS_KEY },
      create: { key: ALERTS_KEY, value: next, updatedById: actorId },
      update: { value: next, updatedById: actorId },
    });
    await auditService.record(actorId, { action: 'notification.settings_update', targetType: 'notification', targetId: ALERTS_KEY, targetLabel: 'Alert settings', metadata: { changes: b } });
    return next;
  },
  async preview(b: z.infer<typeof previewBody>) {
    return { recipientCount: (await audienceUserIds(b.audience)).length };
  },
  async broadcast(actorId: string, b: z.infer<typeof broadcastBody>) {
    const ids = await audienceUserIds(b.audience);
    if (!ids.length) throw HttpError.badRequest('Không có người nhận phù hợp với đối tượng đã chọn');
    if (b.sendEmail && ids.length > MAX_NOTIFY_FANOUT) throw HttpError.badRequest(`Chỉ gửi kèm email khi có tối đa ${MAX_NOTIFY_FANOUT} người nhận`);
    const link = b.link;
    if (ids.length <= MAX_NOTIFY_FANOUT) {
      for (const userId of ids) notify({ userId, type: 'system', title: b.title, body: b.body, ...(link ? { link } : {}) });
    } else {
      // Số lượng lớn: ghi thẳng DB theo lô (không đẩy realtime SSE, người dùng thấy ở lần tải kế tiếp).
      for (let i = 0; i < ids.length; i += 1000) {
        await prisma.notification.createMany({ data: ids.slice(i, i + 1000).map((userId) => ({ userId, type: 'system' as const, title: b.title, body: b.body, link: link ?? null })) });
      }
    }
    let emailCount = 0;
    if (b.sendEmail) {
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
      for (const u of users) {
        await mailService.send({ to: u.email, subject: b.title, text: `${b.body}${link ? `\n\n${env.FRONTEND_URL}${link}` : ''}` });
        emailCount++;
      }
    }
    const actor = await userBriefView(actorId);
    const row = await prisma.platformBroadcast.create({
      data: { title: b.title, body: b.body, link: link ?? null, audience: b.audience as Prisma.InputJsonValue, recipientCount: ids.length, emailCount, sentById: actorId, sentByName: actor.name },
    });
    await auditService.record(actorId, {
      action: 'notification.broadcast',
      targetType: 'broadcast',
      targetId: row.id,
      targetLabel: b.title,
      metadata: { audience: b.audience, recipientCount: ids.length, emailCount },
    });
    return broadcastView(row);
  },
  async listBroadcasts(q: z.infer<typeof pageQuery>) {
    const [rows, total] = await Promise.all([
      prisma.platformBroadcast.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: (q.page - 1) * q.limit, take: q.limit }),
      prisma.platformBroadcast.count(),
    ]);
    return { data: rows.map(broadcastView), meta: pageMeta(q.page, q.limit, total) };
  },
};
const broadcastView = (r: Prisma.PlatformBroadcastGetPayload<object>) => ({
  id: r.id,
  title: r.title,
  body: r.body,
  link: r.link,
  audience: r.audience,
  recipientCount: r.recipientCount,
  emailCount: r.emailCount,
  sentBy: { id: r.sentById, name: r.sentByName },
  createdAt: r.createdAt.toISOString(),
});

/* ================================================================== EMAIL TEMPLATES */
const langMap = z.object({ en: z.string().trim().min(1).max(5000), vi: z.string().trim().min(1).max(5000).optional() });
const langMapPartial = z.object({ en: z.string().trim().min(1).max(5000).optional(), vi: z.string().trim().min(1).max(5000).optional() }).refine((m) => Object.keys(m).length > 0, { message: 'Không có nội dung' });
const TPL_STATUS = ['active', 'draft', 'disabled'] as const;
export const templatesQuery = z.object({ q: z.string().trim().max(60).optional(), status: z.enum(TPL_STATUS).optional() });
export const createTemplateBody = z.object({
  key: keyField,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(''),
  variables: z.array(z.string().regex(/^[a-zA-Z0-9_]{1,40}$/)).max(30).optional(),
  subject: langMap,
  body: langMap,
  status: z.enum(TPL_STATUS).default('draft'),
});
export const patchTemplateBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(300).optional(),
    variables: z.array(z.string().regex(/^[a-zA-Z0-9_]{1,40}$/)).max(30).optional(),
    subject: langMapPartial.optional(),
    body: langMapPartial.optional(),
    status: z.enum(TPL_STATUS).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const previewTemplateBody = z.object({ language: z.enum(['en', 'vi']).default('en'), variables: z.record(z.string().max(60), z.string().max(500)).default({}) });
export const testSendBody = previewTemplateBody.extend({ to: z.string().trim().toLowerCase().email().max(180).optional() });

type TplRow = Prisma.EmailTemplateGetPayload<object>;
const tplLangs = (r: TplRow) => (['en', 'vi'] as const).filter((l) => !!(r.subject as Record<string, string>)[l] || !!(r.body as Record<string, string>)[l]);
const tplView = (r: TplRow, by: Map<string, { id: string; name: string }>, detail = false) => ({
  key: r.key,
  name: r.name,
  description: r.description,
  status: r.status,
  isSystem: r.isSystem,
  variables: r.variables,
  languages: tplLangs(r),
  subject: r.subject,
  ...(detail ? { body: r.body } : {}),
  updatedAt: r.updatedAt.toISOString(),
  updatedBy: (r.updatedById && by.get(r.updatedById)) || null,
});

const templateService = {
  async list(q: z.infer<typeof templatesQuery>) {
    const rows = await prisma.emailTemplate.findMany({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(q.q ? { OR: [{ key: { contains: likeEscape(q.q), mode: 'insensitive' } }, { name: { contains: likeEscape(q.q), mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { key: 'asc' }],
    });
    const by = await updaterOf(rows.map((r) => r.updatedById));
    return rows.map((r) => tplView(r, by));
  },
  async get(key: string) {
    const r = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!r) throw HttpError.notFound('Không tìm thấy mẫu email');
    return r;
  },
  async one(key: string) {
    const r = await this.get(key);
    return tplView(r, await updaterOf([r.updatedById]), true);
  },
  async create(actorId: string, b: z.infer<typeof createTemplateBody>) {
    if (await prisma.emailTemplate.findUnique({ where: { key: b.key } })) throw HttpError.conflict('Khóa mẫu email đã tồn tại');
    const variables = b.variables ?? templateVariables(...Object.values(b.subject), ...Object.values(b.body).filter((x): x is string => !!x));
    await prisma.emailTemplate.create({
      data: { key: b.key, name: b.name, description: b.description, status: b.status, variables, subject: b.subject, body: b.body, isSystem: false, updatedById: actorId },
    });
    await auditService.record(actorId, { action: 'email_template.create', targetType: 'email_template', targetId: b.key, targetLabel: b.name });
    return this.one(b.key);
  },
  async patch(actorId: string, key: string, b: z.infer<typeof patchTemplateBody>) {
    const cur = await this.get(key);
    const subject = b.subject ? { ...(cur.subject as object), ...b.subject } : undefined;
    const body = b.body ? { ...(cur.body as object), ...b.body } : undefined;
    const variables = b.variables ?? (subject || body ? templateVariables(...Object.values((subject ?? cur.subject) as Record<string, string>), ...Object.values((body ?? cur.body) as Record<string, string>)) : undefined);
    await prisma.emailTemplate.update({
      where: { key },
      data: {
        ...(b.name ? { name: b.name } : {}),
        ...(b.description !== undefined ? { description: b.description } : {}),
        ...(b.status ? { status: b.status } : {}),
        ...(subject ? { subject } : {}),
        ...(body ? { body } : {}),
        ...(variables ? { variables } : {}),
        updatedById: actorId,
      },
    });
    const action = b.status && b.status !== cur.status ? `email_template.${b.status === 'active' ? 'enable' : b.status === 'disabled' ? 'disable' : 'update'}` : 'email_template.update';
    await auditService.record(actorId, { action, targetType: 'email_template', targetId: key, targetLabel: b.name ?? cur.name, metadata: { fields: Object.keys(b) } });
    return this.one(key);
  },
  async remove(actorId: string, key: string) {
    const cur = await this.get(key);
    if (cur.isSystem) throw HttpError.conflict('Không thể xóa mẫu email hệ thống (hãy đặt trạng thái disabled)');
    await prisma.emailTemplate.delete({ where: { key } });
    await auditService.record(actorId, { action: 'email_template.delete', targetType: 'email_template', targetId: key, targetLabel: cur.name });
    return { deleted: true };
  },
  async preview(key: string, b: z.infer<typeof previewTemplateBody>) {
    // Preview: biến để trống/chỉ khoảng trắng coi như CHƯA điền (liệt kê trong missingVariables); gửi thật không đổi.
    const vars = Object.fromEntries(Object.entries(b.variables).filter(([, v]) => v.trim() !== ''));
    const r = renderTemplate(await this.get(key), b.language, vars);
    return { subject: r.subject, text: r.text, html: r.html, missingVariables: r.missing };
  },
  async testSend(actorId: string, key: string, b: z.infer<typeof testSendBody>) {
    const tpl = await this.get(key);
    const actor = await userRepository.findById(actorId);
    const to = b.to ?? actor?.email;
    if (!to) throw HttpError.badRequest('Thiếu địa chỉ nhận');
    const r = renderTemplate(tpl, b.language, b.variables);
    await mailService.send({ to, subject: `[TEST] ${r.subject}`, text: r.text, html: r.html });
    await auditService.record(actorId, { action: 'email_template.test_send', targetType: 'email_template', targetId: key, targetLabel: tpl.name, metadata: { to } });
    return { sent: true, to };
  },
};

/* ================================================================== GLOBAL SETTINGS */
const settingsShape = (() => {
  const groups: Record<string, Record<string, z.ZodType>> = {};
  for (const k of SETTING_KEYS) {
    const [g, n] = k.split('.') as [string, string];
    (groups[g] ??= {})[n] = SETTING_DEFS[k].schema;
  }
  return z
    .object(Object.fromEntries(Object.entries(groups).map(([g, fields]) => [g, z.object(fields).partial().strict()])))
    .partial()
    .strict();
})();
export const patchSettingsBody = settingsShape.refine((b) => Object.values(b).some((g) => g && Object.keys(g).length), { message: 'Không có gì để cập nhật' });
export const resetSettingsBody = z.object({ keys: z.array(z.string().max(80)).max(40).optional() });

async function settingsView() {
  await refreshConfig();
  const cur = cfg();
  const ov = getOverrides();
  const overrides: Record<string, { default: unknown; overridden: true }> = {};
  for (const k of SETTING_KEYS) if (k in ov) overrides[k] = { default: SETTING_DEFS[k].default(), overridden: true };
  const row = await prisma.platformSetting.findUnique({ where: { key: 'global.settings' } });
  return { ...cur, overrides, updatedAt: row?.updatedAt.toISOString() ?? null };
}

const settingsService = {
  get: settingsView,
  async patch(actorId: string, b: z.infer<typeof patchSettingsBody>) {
    const before = buildConfig(getOverrides());
    const next: Overrides = { ...getOverrides() };
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const [g, fields] of Object.entries(b)) {
      for (const [n, v] of Object.entries(fields ?? {})) {
        const key = `${g}.${n}` as SettingKey;
        next[key] = v;
        changes[key] = { from: (before as unknown as Record<string, Record<string, unknown>>)[g]![n], to: v };
      }
    }
    await writeOverrides(next, actorId);
    await auditService.record(actorId, { action: 'settings.update', targetType: 'settings', targetId: 'global', targetLabel: 'Global Settings', metadata: { changes } });
    return settingsView();
  },
  async reset(actorId: string, b: z.infer<typeof resetSettingsBody>) {
    const bad = (b.keys ?? []).find((k) => !(SETTING_KEYS as string[]).includes(k));
    if (bad) throw HttpError.validation(`Khóa cấu hình "${bad}" không hợp lệ`);
    const next: Overrides = { ...getOverrides() };
    const keys = b.keys?.length ? (b.keys as SettingKey[]) : (Object.keys(next) as SettingKey[]);
    for (const k of keys) delete next[k];
    await writeOverrides(next, actorId);
    await auditService.record(actorId, { action: 'settings.reset', targetType: 'settings', targetId: 'global', targetLabel: 'Global Settings', metadata: { keys } });
    return settingsView();
  },
};

export const adminSystemService = { flags: flagService, integrations: integrationService, notifications: notificationService, templates: templateService, settings: settingsService };
