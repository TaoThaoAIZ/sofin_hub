import { Router } from 'express';
import { z } from 'zod';
import { userRepository } from '../auth/auth.repository.js';
import { userBriefView } from '../auth/user-view.js';
import { auditService } from './admin-audit.service.js';
import {
  adminCommunitiesService as com,
  approveBody,
  deleteCommunityBody,
  listCommunitiesQuery,
  membersQuery,
  rejectBody,
  requestChangesBody,
  restoreBody,
  suspendCommunityBody,
  trashQuery,
} from './admin-communities.service.js';
import { adminDashboardService, dashboardQuery } from './admin-dashboard.service.js';
import {
  adminModerationService as mod,
  assignBody,
  caseBanBody,
  caseRestrictBody,
  caseSuspendBody,
  caseWarnBody,
  decisionsQuery,
  listCasesQuery,
  noteBody,
  removeContentBody,
} from './admin-moderation.service.js';
import {
  activityQuery,
  adminUsersService as users,
  banBody,
  listUsersQuery,
  reinstateBody,
  restrictBody,
  suspendBody,
  warnBody,
} from './admin-users.service.js';
import { adminOnly, pageQuery } from './admin.common.js';

/** Admin đợt 1. Mỗi route gắn `adminOnly` (401 chưa đăng nhập / 403 không phải Platform Admin). Contract: docs/api/admin.md. */
export const adminRouter = Router();
const p = (v: string | string[] | undefined) => String(v);

adminRouter.get('/admin/me', ...adminOnly, async (req, res) => {
  const u = await userRepository.findById(req.userId!);
  const st = req.staff!;
  // `role` giữ nguyên 'platform_admin' cho mọi nhân viên (FE cũ); quyền thật nằm ở adminRole + permissions.
  res.json({
    data: {
      id: req.userId,
      name: (await userBriefView(req.userId!)).name,
      email: u?.email,
      role: 'platform_admin',
      adminRole: { key: st.roleKey, name: st.roleName },
      permissions: st.permissions,
      source: st.source,
    },
  });
});

adminRouter.get('/admin/dashboard', ...adminOnly, async (req, res) => {
  const { range } = dashboardQuery.parse(req.query);
  res.json({ data: await adminDashboardService.get(range as 7 | 30 | 90) });
});

/* ---------------------------------------------------------------- communities (đường dẫn tĩnh trước :id) */
adminRouter.get('/admin/communities/summary', ...adminOnly, async (_req, res) => res.json({ data: await com.summary() }));
adminRouter.get('/admin/communities/review-queue', ...adminOnly, async (req, res) => res.json(await com.reviewQueue(pageQuery.parse(req.query))));
adminRouter.get('/admin/communities/trash', ...adminOnly, async (req, res) => res.json(await com.trash(trashQuery.parse(req.query))));
adminRouter.get('/admin/communities', ...adminOnly, async (req, res) => res.json(await com.list(listCommunitiesQuery.parse(req.query))));
adminRouter.get('/admin/communities/:id', ...adminOnly, async (req, res) => res.json({ data: await com.detail(p(req.params.id)) }));
adminRouter.get('/admin/communities/:id/members', ...adminOnly, async (req, res) =>
  res.json(await com.members(p(req.params.id), membersQuery.parse(req.query))),
);
adminRouter.get('/admin/communities/:id/reports', ...adminOnly, async (req, res) => res.json(await com.reports(p(req.params.id), pageQuery.parse(req.query))));
adminRouter.post('/admin/communities/:id/approve', ...adminOnly, async (req, res) =>
  res.json({ data: await com.approve(req.userId!, p(req.params.id), approveBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/request-changes', ...adminOnly, async (req, res) =>
  res.json({ data: await com.requestChanges(req.userId!, p(req.params.id), requestChangesBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/reject', ...adminOnly, async (req, res) =>
  res.json({ data: await com.reject(req.userId!, p(req.params.id), rejectBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/suspend', ...adminOnly, async (req, res) =>
  res.json({ data: await com.suspend(req.userId!, p(req.params.id), suspendCommunityBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/restore', ...adminOnly, async (req, res) =>
  res.json({ data: await com.restore(req.userId!, p(req.params.id), restoreBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/delete', ...adminOnly, async (req, res) =>
  res.json({ data: await com.remove(req.userId!, p(req.params.id), deleteCommunityBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/communities/:id/undelete', ...adminOnly, async (req, res) =>
  res.json({ data: await com.undelete(req.userId!, p(req.params.id), restoreBody.parse(req.body ?? {})) }),
);

/* ---------------------------------------------------------------- users */
adminRouter.get('/admin/users/summary', ...adminOnly, async (_req, res) => res.json({ data: await users.summary() }));
adminRouter.get('/admin/users', ...adminOnly, async (req, res) => res.json(await users.list(listUsersQuery.parse(req.query))));
adminRouter.get('/admin/users/:id', ...adminOnly, async (req, res) => res.json({ data: await users.detail(p(req.params.id)) }));
adminRouter.get('/admin/users/:id/communities', ...adminOnly, async (req, res) =>
  res.json(await users.communities(p(req.params.id), pageQuery.parse(req.query))),
);
adminRouter.get('/admin/users/:id/activity', ...adminOnly, async (req, res) => res.json(await users.activity(p(req.params.id), activityQuery.parse(req.query))));
adminRouter.get('/admin/users/:id/purchases', ...adminOnly, async (req, res) => res.json(await users.purchases(p(req.params.id), pageQuery.parse(req.query))));
adminRouter.get('/admin/users/:id/reports', ...adminOnly, async (req, res) => res.json(await users.reports(p(req.params.id), pageQuery.parse(req.query))));
adminRouter.delete('/admin/users/:id/sessions/:sid', ...adminOnly, async (req, res) =>
  res.json({ data: await users.revokeSession(req.userId!, p(req.params.id), p(req.params.sid)) }),
);
adminRouter.post('/admin/users/:id/restrict', ...adminOnly, async (req, res) =>
  res.json({ data: await users.restrict(req.userId!, p(req.params.id), restrictBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/users/:id/suspend', ...adminOnly, async (req, res) =>
  res.json({ data: await users.suspend(req.userId!, p(req.params.id), suspendBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/users/:id/ban', ...adminOnly, async (req, res) =>
  res.json({ data: await users.ban(req.userId!, p(req.params.id), banBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/users/:id/reinstate', ...adminOnly, async (req, res) =>
  res.json({ data: await users.reinstate(req.userId!, p(req.params.id), reinstateBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/users/:id/warn', ...adminOnly, async (req, res) =>
  res.json({ data: await users.warn(req.userId!, p(req.params.id), warnBody.parse(req.body ?? {})) }),
);

/* ---------------------------------------------------------------- moderation */
adminRouter.get('/admin/moderation/summary', ...adminOnly, async (_req, res) => res.json({ data: await mod.summary() }));
adminRouter.get('/admin/moderation/assignees', ...adminOnly, async (_req, res) => res.json({ data: await mod.assignees() }));
adminRouter.get('/admin/moderation/decisions', ...adminOnly, async (req, res) => res.json(await mod.decisions(decisionsQuery.parse(req.query))));
adminRouter.get('/admin/moderation/cases', ...adminOnly, async (req, res) => res.json(await mod.list(req.userId!, listCasesQuery.parse(req.query))));
adminRouter.get('/admin/moderation/cases/:id', ...adminOnly, async (req, res) => res.json({ data: await mod.detail(p(req.params.id)) }));
adminRouter.post('/admin/moderation/cases/:id/assign', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.assign(req.userId!, p(req.params.id), assignBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/warn', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.warn(req.userId!, p(req.params.id), caseWarnBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/remove-content', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.removeContent(req.userId!, p(req.params.id), removeContentBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/restrict-user', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.restrictUser(req.userId!, p(req.params.id), caseRestrictBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/suspend-user', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.suspendUser(req.userId!, p(req.params.id), caseSuspendBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/ban-user', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.banUser(req.userId!, p(req.params.id), caseBanBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/dismiss', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.dismiss(req.userId!, p(req.params.id), noteBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/escalate', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.escalate(req.userId!, p(req.params.id), noteBody.parse(req.body ?? {})) }),
);
adminRouter.post('/admin/moderation/cases/:id/resolve', ...adminOnly, async (req, res) =>
  res.json({ data: await mod.resolve(req.userId!, p(req.params.id), noteBody.parse(req.body ?? {})) }),
);

/* ---------------------------------------------------------------- audit */
const auditQuery = pageQuery.extend({
  actor: z.string().optional(),
  action: z.string().max(80).optional(),
  targetType: z.string().max(40).optional(),
  targetId: z.string().max(200).optional(),
  q: z.string().trim().max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});
adminRouter.get('/admin/audit-logs', ...adminOnly, async (req, res) => res.json(await auditService.list(auditQuery.parse(req.query))));
