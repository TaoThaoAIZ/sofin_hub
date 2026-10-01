import { Router } from 'express';
import { z } from 'zod';
import { adminAnalyticsService as analytics, analyticsQuery } from './admin-analytics.service.js';
import { auditService } from './admin-audit.service.js';
import { adminDiscoveryService as disc, createCategoryBody, moveCategoryBody, patchCategoryBody, reorderCategoriesBody } from './admin-discovery.service.js';
import {
  adminSupportService as support,
  assignTicketBody,
  createTicketBody,
  escalateBody,
  patchTicketBody,
  replyBody,
  ticketNoteBody,
  ticketsQuery,
  transitionBody,
} from './admin-support.service.js';
import {
  adminAccessService as access,
  adminsQuery,
  createAdminBody,
  createRoleBody,
  patchAdminBody,
  patchRoleBody,
  suspendAdminBody,
} from './admin-system-access.service.js';
import {
  adminSystemService as sys,
  alertSettingsBody,
  broadcastBody,
  connectBody,
  createFlagBody,
  createTemplateBody,
  flagsQuery,
  integrationsQuery,
  patchFlagBody,
  patchIntegrationBody,
  patchSettingsBody,
  patchTemplateBody,
  previewBody,
  previewTemplateBody,
  resetSettingsBody,
  templatesQuery,
  testSendBody,
  toggleFlagBody,
} from './admin-system.service.js';
import { adminOnly, pageQuery } from './admin.common.js';

/** Admin đợt 3: Analytics / Support / System. Mỗi route gắn `adminOnly` (quyền suy ra từ đường dẫn). Contract: docs/api/admin-batch3.md. */
export const adminBatch3Router = Router();
const R = adminBatch3Router;
const p = (v: string | string[] | undefined) => String(v);
const body = (req: { body?: unknown }) => req.body ?? {};

/* ================================================================ ANALYTICS */
for (const page of ['users', 'communities', 'engagement', 'retention', 'revenue', 'conversion'] as const) {
  R.get(`/admin/analytics/${page}`, ...adminOnly, async (req, res) => res.json({ data: await analytics[page](analyticsQuery.parse(req.query).range) }));
}

/* ================================================================ SUPPORT */
R.get('/admin/support/summary', ...adminOnly, async (_q, res) => res.json({ data: await support.summary() }));
R.get('/admin/support/assignees', ...adminOnly, async (_q, res) => res.json({ data: await support.assignees() }));
R.get('/admin/support/tickets', ...adminOnly, async (req, res) => res.json(await support.list(req.userId!, ticketsQuery.parse(req.query))));
R.post('/admin/support/tickets', ...adminOnly, async (req, res) => res.status(201).json({ data: await support.create(req.userId!, createTicketBody.parse(body(req))) }));
R.get('/admin/support/tickets/:id', ...adminOnly, async (req, res) => res.json({ data: await support.view(p(req.params.id)) }));
R.patch('/admin/support/tickets/:id', ...adminOnly, async (req, res) => res.json({ data: await support.update(req.userId!, p(req.params.id), patchTicketBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/assign', ...adminOnly, async (req, res) => res.json({ data: await support.assign(req.userId!, p(req.params.id), assignTicketBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/reply', ...adminOnly, async (req, res) => res.json({ data: await support.reply(req.userId!, p(req.params.id), replyBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/note', ...adminOnly, async (req, res) => res.json({ data: await support.note(req.userId!, p(req.params.id), ticketNoteBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/escalate', ...adminOnly, async (req, res) => res.json({ data: await support.escalate(req.userId!, p(req.params.id), escalateBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/resolve', ...adminOnly, async (req, res) => res.json({ data: await support.transition(req.userId!, p(req.params.id), 'resolved', transitionBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/close', ...adminOnly, async (req, res) => res.json({ data: await support.transition(req.userId!, p(req.params.id), 'closed', transitionBody.parse(body(req))) }));
R.post('/admin/support/tickets/:id/reopen', ...adminOnly, async (req, res) => res.json({ data: await support.transition(req.userId!, p(req.params.id), 'open', transitionBody.parse(body(req))) }));

/* ================================================================ SYSTEM: admins & roles */
R.get('/admin/system/admins', ...adminOnly, async (req, res) => res.json(await access.listAdmins(req.userId!, adminsQuery.parse(req.query))));
R.post('/admin/system/admins', ...adminOnly, async (req, res) => res.status(201).json({ data: await access.createAdmin(req.userId!, createAdminBody.parse(body(req))) }));
R.patch('/admin/system/admins/:id', ...adminOnly, async (req, res) => res.json({ data: await access.patchAdmin(req.userId!, p(req.params.id), patchAdminBody.parse(body(req))) }));
R.post('/admin/system/admins/:id/suspend', ...adminOnly, async (req, res) =>
  res.json({ data: await access.setStatus(req.userId!, p(req.params.id), 'suspended', suspendAdminBody.parse(body(req)).reason) }),
);
R.post('/admin/system/admins/:id/enable', ...adminOnly, async (req, res) => res.json({ data: await access.setStatus(req.userId!, p(req.params.id), 'active') }));
R.post('/admin/system/admins/:id/reset-2fa', ...adminOnly, async (req, res) => res.json({ data: await access.reset2fa(req.userId!, p(req.params.id)) }));
R.delete('/admin/system/admins/:id', ...adminOnly, async (req, res) => res.json({ data: await access.removeAdmin(req.userId!, p(req.params.id)) }));

R.get('/admin/system/roles', ...adminOnly, async (_q, res) => res.json({ data: await access.listRoles() }));
R.post('/admin/system/roles', ...adminOnly, async (req, res) => res.status(201).json({ data: await access.createRole(req.userId!, createRoleBody.parse(body(req))) }));
R.patch('/admin/system/roles/:key', ...adminOnly, async (req, res) => res.json({ data: await access.patchRole(req.userId!, p(req.params.key), patchRoleBody.parse(body(req))) }));
R.delete('/admin/system/roles/:key', ...adminOnly, async (req, res) => res.json({ data: await access.deleteRole(req.userId!, p(req.params.key)) }));

/* ================================================================ SYSTEM: categories (dùng lại DiscoveryCategory) */
R.get('/admin/system/categories', ...adminOnly, async (_q, res) => res.json({ data: await disc.listCategories() }));
R.post('/admin/system/categories', ...adminOnly, async (req, res) => res.status(201).json({ data: await disc.createCategory(req.userId!, createCategoryBody.parse(body(req))) }));
R.post('/admin/system/categories/reorder', ...adminOnly, async (req, res) => res.json({ data: await disc.reorderCategories(req.userId!, reorderCategoriesBody.parse(body(req)).keys) }));
R.patch('/admin/system/categories/:key', ...adminOnly, async (req, res) => res.json({ data: await disc.patchCategory(req.userId!, p(req.params.key), patchCategoryBody.parse(body(req))) }));
R.post('/admin/system/categories/:key/move', ...adminOnly, async (req, res) =>
  res.json({ data: await disc.moveCategory(req.userId!, p(req.params.key), moveCategoryBody.parse(body(req)).direction) }),
);

/* ================================================================ SYSTEM: feature flags */
R.get('/admin/system/flags', ...adminOnly, async (req, res) => res.json({ data: await sys.flags.list(flagsQuery.parse(req.query)) }));
R.post('/admin/system/flags', ...adminOnly, async (req, res) => res.status(201).json({ data: await sys.flags.create(req.userId!, createFlagBody.parse(body(req))) }));
R.patch('/admin/system/flags/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.flags.patch(req.userId!, p(req.params.key), patchFlagBody.parse(body(req))) }));
R.post('/admin/system/flags/:key/toggle', ...adminOnly, async (req, res) =>
  res.json({ data: await sys.flags.toggle(req.userId!, p(req.params.key), toggleFlagBody.parse(body(req)).enabled) }),
);
R.delete('/admin/system/flags/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.flags.remove(req.userId!, p(req.params.key)) }));

/* ================================================================ SYSTEM: integrations */
R.get('/admin/system/integrations', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.list(integrationsQuery.parse(req.query)) }));
R.get('/admin/system/integrations/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.one(p(req.params.key)) }));
R.post('/admin/system/integrations/:key/connect', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.connect(req.userId!, p(req.params.key), connectBody.parse(body(req))) }));
R.post('/admin/system/integrations/:key/disconnect', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.disconnect(req.userId!, p(req.params.key)) }));
R.patch('/admin/system/integrations/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.patch(req.userId!, p(req.params.key), patchIntegrationBody.parse(body(req))) }));
R.post('/admin/system/integrations/:key/test', ...adminOnly, async (req, res) => res.json({ data: await sys.integrations.test(p(req.params.key)) }));

/* ================================================================ SYSTEM: notifications */
R.get('/admin/system/notifications/settings', ...adminOnly, async (_q, res) => res.json({ data: await sys.notifications.getAlerts() }));
R.put('/admin/system/notifications/settings', ...adminOnly, async (req, res) => res.json({ data: await sys.notifications.putAlerts(req.userId!, alertSettingsBody.parse(body(req))) }));
R.post('/admin/system/notifications/preview', ...adminOnly, async (req, res) => res.json({ data: await sys.notifications.preview(previewBody.parse(body(req))) }));
R.post('/admin/system/notifications/broadcast', ...adminOnly, async (req, res) => res.status(201).json({ data: await sys.notifications.broadcast(req.userId!, broadcastBody.parse(body(req))) }));
R.get('/admin/system/notifications/broadcasts', ...adminOnly, async (req, res) => res.json(await sys.notifications.listBroadcasts(pageQuery.parse(req.query))));

/* ================================================================ SYSTEM: email templates */
R.get('/admin/system/email-templates', ...adminOnly, async (req, res) => res.json({ data: await sys.templates.list(templatesQuery.parse(req.query)) }));
R.post('/admin/system/email-templates', ...adminOnly, async (req, res) => res.status(201).json({ data: await sys.templates.create(req.userId!, createTemplateBody.parse(body(req))) }));
R.get('/admin/system/email-templates/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.templates.one(p(req.params.key)) }));
R.patch('/admin/system/email-templates/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.templates.patch(req.userId!, p(req.params.key), patchTemplateBody.parse(body(req))) }));
R.delete('/admin/system/email-templates/:key', ...adminOnly, async (req, res) => res.json({ data: await sys.templates.remove(req.userId!, p(req.params.key)) }));
R.post('/admin/system/email-templates/:key/preview', ...adminOnly, async (req, res) =>
  res.json({ data: await sys.templates.preview(p(req.params.key), previewTemplateBody.parse(body(req))) }),
);
R.post('/admin/system/email-templates/:key/test-send', ...adminOnly, async (req, res) =>
  res.json({ data: await sys.templates.testSend(req.userId!, p(req.params.key), testSendBody.parse(body(req))) }),
);

/* ================================================================ SYSTEM: global settings */
R.get('/admin/system/settings', ...adminOnly, async (_q, res) => res.json({ data: await sys.settings.get() }));
R.patch('/admin/system/settings', ...adminOnly, async (req, res) => res.json({ data: await sys.settings.patch(req.userId!, patchSettingsBody.parse(body(req))) }));
R.post('/admin/system/settings/reset', ...adminOnly, async (req, res) => res.json({ data: await sys.settings.reset(req.userId!, resetSettingsBody.parse(body(req))) }));

/* ================================================================ AUDIT (bổ sung cho /admin/audit-logs của đợt 1) */
const auditFilter = z.object({
  actor: z.string().optional(),
  action: z.string().max(80).optional(),
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(200).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
R.get('/admin/audit-logs/filters', ...adminOnly, async (_q, res) => res.json({ data: await auditService.filters() }));
R.get('/admin/audit-logs/export', ...adminOnly, async (req, res) => {
  const csv = await auditService.exportCsv(auditFilter.parse(req.query));
  await auditService.record(req.userId!, { action: 'audit.export', targetType: 'audit', targetId: 'csv', targetLabel: 'Audit log CSV' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});
