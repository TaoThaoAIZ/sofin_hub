import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { patchMyCommunityBody, reorderBody } from './my-communities.schema.js';
import { myCommunitiesService } from './my-communities.service.js';

export const myCommunitiesRouter = Router();

myCommunitiesRouter.get('/me/communities', requireAuth, async (req, res) => {
  res.json({ data: await myCommunitiesService.list(req.userId!) });
});

// Đặt TRƯỚC `/:id` để "order" không bị hiểu là id.
myCommunitiesRouter.put('/me/communities/order', requireAuth, async (req, res) => {
  const { ids } = reorderBody.parse(req.body);
  res.json({ data: await myCommunitiesService.reorder(req.userId!, ids) });
});

myCommunitiesRouter.patch('/me/communities/:id', requireAuth, async (req, res) => {
  res.json({ data: await myCommunitiesService.patch(req.userId!, req.params.id as string, patchMyCommunityBody.parse(req.body)) });
});

myCommunitiesRouter.delete('/me/communities/:id', requireAuth, async (req, res) => {
  res.json({ data: await myCommunitiesService.leave(req.userId!, req.params.id as string) });
});

myCommunitiesRouter.get('/me/join-requests', requireAuth, async (req, res) => {
  res.json({ data: await myCommunitiesService.pending(req.userId!) });
});
