import { Router } from 'express';
import { optionalAuth, requireAuth } from '../../middlewares/auth.js';
import { getRole } from '../permissions/policy.js';
import {
  basicsCreate,
  basicsPatch,
  estimateQuery,
  identityBody,
  membersBody,
  payoutAccountBody,
  planBody,
  publishBody,
  slugQuery,
  stepParam,
} from './wizard.schema.js';
import { wizardService as svc } from './wizard.service.js';

/**
 * Wizard "Tạo cộng đồng". Đường dẫn chuẩn `/communities/*`: các route CỐ ĐỊNH (slug-available, revenue-estimate, rules-template, drafts) được
 * `middlewares/community-alias.ts` để nguyên; các route theo `:id` được alias viết lại thành `/courses/:id/*` nên khai báo ở đó (cùng cách các module khác).
 */
export const communityWizardRouter = Router();
const p = (v: string | string[] | undefined) => v as string;

communityWizardRouter.get('/communities/slug-available', optionalAuth, async (req, res) => {
  const { slug } = slugQuery.parse(req.query);
  res.json({ data: await svc.checkSlug(slug, req.userId) });
});

communityWizardRouter.get('/communities/revenue-estimate', async (req, res) => {
  const q = estimateQuery.parse(req.query);
  res.json({ data: svc.revenueEstimate(q.price, q.interval, q.members) });
});

communityWizardRouter.get('/communities/rules-template', (_req, res) => {
  res.json({ data: svc.rulesTemplate() });
});

communityWizardRouter.get('/owner-plans', (_req, res) => {
  res.json({ data: svc.ownerPlans() });
});

// ---- nháp
communityWizardRouter.post('/communities/drafts', requireAuth, async (req, res) => {
  res.status(201).json({ data: await svc.createDraft(req.userId!, basicsCreate.parse(req.body)) });
});

communityWizardRouter.get('/me/community-drafts', requireAuth, async (req, res) => {
  res.json({ data: await svc.listDrafts(req.userId!) });
});

communityWizardRouter.get('/courses/:id/draft', requireAuth, async (req, res) => {
  res.json({ data: await svc.getDraft(req.userId!, p(req.params.id)) });
});

communityWizardRouter.delete('/courses/:id/draft', requireAuth, async (req, res) => {
  res.json({ data: await svc.deleteDraft(req.userId!, p(req.params.id)) });
});

communityWizardRouter.patch('/courses/:id/draft/steps/:step', requireAuth, async (req, res) => {
  const step = stepParam.parse(req.params.step);
  const schema = { basics: basicsPatch, plan: planBody, identity: identityBody, members: membersBody }[step];
  res.json({ data: await svc.patchStep(req.userId!, p(req.params.id), step, schema.parse(req.body ?? {})) });
});

communityWizardRouter.post('/courses/:id/publish', requireAuth, async (req, res) => {
  const { acceptTerms } = publishBody.parse(req.body ?? {});
  const id = p(req.params.id);
  const detail = await svc.publish(req.userId!, id, acceptTerms);
  res.status(201).json({ data: { ...detail, viewerRole: await getRole(req.userId!, id) } });
});

communityWizardRouter.get('/courses/:id/launch-checklist', requireAuth, async (req, res) => {
  res.json({ data: await svc.launchChecklist(req.userId!, p(req.params.id)) });
});

// ---- gói hosting của owner (MÔ PHỎNG)
communityWizardRouter.get('/courses/:id/hosting-plan', requireAuth, async (req, res) => {
  res.json({ data: await svc.hostingPlan.read(req.userId!, p(req.params.id)) });
});

communityWizardRouter.put('/courses/:id/hosting-plan', requireAuth, async (req, res) => {
  res.json({ data: await svc.hostingPlan.select(req.userId!, p(req.params.id), planBody.parse(req.body ?? {})) });
});

// ---- tài khoản nhận tiền (MÔ PHỎNG)
communityWizardRouter.get('/courses/:id/payout-account', requireAuth, async (req, res) => {
  res.json({ data: await svc.payout.read(req.userId!, p(req.params.id)) });
});

communityWizardRouter.put('/courses/:id/payout-account', requireAuth, async (req, res) => {
  res.json({ data: await svc.payout.connect(req.userId!, p(req.params.id), payoutAccountBody.parse(req.body ?? {})) });
});

communityWizardRouter.post('/courses/:id/payout-account/skip', requireAuth, async (req, res) => {
  res.json({ data: await svc.payout.skip(req.userId!, p(req.params.id)) });
});
