import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { getRole } from '../permissions/policy.js';
import {
  banBody,
  createCommunityBody,
  createInviteBody,
  joinRequestBody,
  joinRequestsQuery,
  lockBody,
  reviewBody,
  reviewsQuery,
  roleBody,
  transferBody,
  updateCommunityBody,
} from './communities.schema.js';
import { communitiesService as svc } from './communities.service.js';
import { reviewsService } from './reviews.service.js';

export const communitiesRouter = Router();
const p = (v: string | string[] | undefined) => v as string;

// ---- tạo & quản trị cộng đồng ----
communitiesRouter.post('/communities', requireAuth, async (req, res) => {
  const detail = await svc.create(req.userId!, createCommunityBody.parse(req.body));
  res.status(201).json({ data: { ...detail, viewerRole: 'owner' } });
});

communitiesRouter.patch('/courses/:id', requireAuth, async (req, res) => {
  const id = p(req.params.id);
  const detail = await svc.update(req.userId!, id, updateCommunityBody.parse(req.body));
  res.json({ data: { ...detail, viewerRole: await getRole(req.userId!, id) } });
});

communitiesRouter.delete('/courses/:id', requireAuth, async (req, res) => {
  await svc.remove(req.userId!, p(req.params.id));
  res.json({ data: { deleted: true } });
});

communitiesRouter.post('/admin/courses/:id/lock', requireAuth, async (req, res) => {
  const { reason } = lockBody.parse(req.body);
  res.json({ data: await svc.lock(req.userId!, p(req.params.id), reason) });
});

communitiesRouter.post('/admin/courses/:id/unlock', requireAuth, async (req, res) => {
  res.json({ data: await svc.unlock(req.userId!, p(req.params.id)) });
});

// ---- yêu cầu tham gia ----
communitiesRouter.post('/courses/:id/join-requests', requireAuth, async (req, res) => {
  const { message, answers, acceptRules } = joinRequestBody.parse(req.body ?? {});
  res.status(201).json({ data: await svc.createJoinRequest(req.userId!, p(req.params.id), message, { answers, acceptRules }) });
});

communitiesRouter.get('/courses/:id/join-requests', requireAuth, async (req, res) => {
  const { status } = joinRequestsQuery.parse(req.query);
  res.json({ data: await svc.listJoinRequests(req.userId!, p(req.params.id), status) });
});

communitiesRouter.post('/join-requests/:id/approve', requireAuth, async (req, res) => {
  res.json({ data: await svc.decideJoinRequest(req.userId!, p(req.params.id), true) });
});

communitiesRouter.post('/join-requests/:id/reject', requireAuth, async (req, res) => {
  res.json({ data: await svc.decideJoinRequest(req.userId!, p(req.params.id), false) });
});

communitiesRouter.delete('/join-requests/:id', requireAuth, async (req, res) => {
  await svc.cancelJoinRequest(req.userId!, p(req.params.id));
  res.json({ data: { cancelled: true } });
});

// ---- lời mời ----
communitiesRouter.post('/courses/:id/invites', requireAuth, async (req, res) => {
  const invite = await svc.createInvite(req.userId!, p(req.params.id), createInviteBody.parse(req.body ?? {}));
  res.status(201).json({ data: invite });
});

communitiesRouter.get('/courses/:id/invites', requireAuth, async (req, res) => {
  res.json({ data: await svc.listInvites(req.userId!, p(req.params.id)) });
});

communitiesRouter.get('/invites/:code', async (req, res) => {
  res.json({ data: await svc.previewInvite(p(req.params.code)) });
});

communitiesRouter.post('/invites/:code/accept', requireAuth, async (req, res) => {
  res.json({ data: await svc.acceptInvite(req.userId!, p(req.params.code)) });
});

communitiesRouter.delete('/invites/:code', requireAuth, async (req, res) => {
  await svc.revokeInvite(req.userId!, p(req.params.code));
  res.json({ data: { revoked: true } });
});

// ---- vai trò & thành viên ----
communitiesRouter.get('/courses/:id/members/:userId', requireAuth, async (req, res) => {
  res.json({ data: await svc.memberDetail(req.userId!, p(req.params.id), p(req.params.userId)) });
});

communitiesRouter.patch('/courses/:id/members/:userId/role', requireAuth, async (req, res) => {
  const { role } = roleBody.parse(req.body);
  res.json({ data: await svc.changeRole(req.userId!, p(req.params.id), p(req.params.userId), role) });
});

communitiesRouter.delete('/courses/:id/members/:userId', requireAuth, async (req, res) => {
  await svc.kick(req.userId!, p(req.params.id), p(req.params.userId));
  res.json({ data: { removed: true } });
});

communitiesRouter.post('/courses/:id/members/:userId/ban', requireAuth, async (req, res) => {
  const { reason } = banBody.parse(req.body ?? {});
  await svc.ban(req.userId!, p(req.params.id), p(req.params.userId), reason);
  res.json({ data: { banned: true } });
});

communitiesRouter.delete('/courses/:id/members/:userId/ban', requireAuth, async (req, res) => {
  await svc.unban(req.userId!, p(req.params.id), p(req.params.userId));
  res.json({ data: { banned: false } });
});

communitiesRouter.get('/courses/:id/bans', requireAuth, async (req, res) => {
  res.json({ data: await svc.listBans(req.userId!, p(req.params.id)) });
});

communitiesRouter.post('/courses/:id/transfer-ownership', requireAuth, async (req, res) => {
  const { userId } = transferBody.parse(req.body);
  res.json({ data: await svc.transferOwnership(req.userId!, p(req.params.id), userId) });
});

// ---- đánh giá ----
communitiesRouter.get('/courses/:id/reviews', async (req, res) => {
  const { page, limit } = reviewsQuery.parse(req.query);
  res.json(await reviewsService.list(p(req.params.id), page, limit));
});

communitiesRouter.post('/courses/:id/reviews', requireAuth, async (req, res) => {
  const { review, created } = await reviewsService.upsert(req.userId!, p(req.params.id), reviewBody.parse(req.body));
  res.status(created ? 201 : 200).json({ data: review });
});

communitiesRouter.delete('/courses/:id/reviews/mine', requireAuth, async (req, res) => {
  await reviewsService.removeMine(req.userId!, p(req.params.id));
  res.json({ data: { deleted: true } });
});

communitiesRouter.delete('/reviews/:id', requireAuth, async (req, res) => {
  await reviewsService.removeById(req.userId!, p(req.params.id));
  res.json({ data: { deleted: true } });
});
