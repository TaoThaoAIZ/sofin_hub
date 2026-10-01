import { Router } from 'express';
import { HttpError } from '../../utils/http-error.js';
import { uploadService } from '../uploads/uploads.service.js';
import {
  adminContentService as content,
  archiveBody,
  bulkBody,
  cancelEventBody,
  commentsQuery,
  coursesQuery,
  eventPatchBody,
  eventsQuery,
  flagBody,
  lessonsQuery,
  mediaQuery,
  postsQuery,
  removeMediaBody,
  unpublishBody,
} from './admin-content.service.js';
import { hideBody, restoreNoteBody } from './admin-b2.common.js';
import {
  adminDiscoveryService as disc,
  addFeaturedBody,
  createCategoryBody,
  featureBody,
  listedQuery,
  moveCategoryBody,
  patchCategoryBody,
  patchFeaturedBody,
  publishWeightsBody,
  reorderCategoriesBody,
  reorderFeaturedBody,
  searchListQuery,
  searchVisibilityBody,
  setStatusBody,
  unfeatureBody,
  weightsBody,
} from './admin-discovery.service.js';
import { FEATURE_SECTIONS } from '../discovery/featured.js';
import { DEFAULT_WEIGHTS } from '../discovery/ranking.js';
import {
  adminPaymentsService as pay,
  approveRefundBody,
  cancelSubBody,
  cbQuery,
  createCbBody,
  creatorsQuery,
  evidenceBody,
  noteOnly,
  pauseBody,
  payoutReasonBody,
  payoutsQuery,
  rangeQuery,
  refundsQuery,
  rejectRefundBody,
  subsQuery,
  txQuery,
  txRefundBody,
} from './admin-payments.service.js';
import { adminOnly } from './admin.common.js';

/** Admin đợt 2: Content / Payments / Discovery. Mỗi route gắn `adminOnly`. Contract: docs/api/admin-batch2.md. */
export const adminBatch2Router = Router();
const p = (v: string | string[] | undefined) => String(v);
const body = (req: { body?: unknown }) => req.body ?? {};
const R = adminBatch2Router;

/* ================================================================ CONTENT */
R.get('/admin/content/posts/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.postsSummary() }));
R.get('/admin/content/posts', ...adminOnly, async (req, res) => res.json(await content.listPosts(postsQuery.parse(req.query))));
R.post('/admin/content/posts/bulk', ...adminOnly, async (req, res) => res.json({ data: await content.bulkPosts(req.userId!, bulkBody.parse(body(req))) }));
R.get('/admin/content/posts/:id', ...adminOnly, async (req, res) => res.json({ data: await content.postDetail(p(req.params.id)) }));
R.post('/admin/content/posts/:id/hide', ...adminOnly, async (req, res) => res.json({ data: await content.postAction(req.userId!, p(req.params.id), 'hide', hideBody.parse(body(req))) }));
R.post('/admin/content/posts/:id/remove', ...adminOnly, async (req, res) => res.json({ data: await content.postAction(req.userId!, p(req.params.id), 'remove', hideBody.parse(body(req))) }));
R.post('/admin/content/posts/:id/restore', ...adminOnly, async (req, res) => res.json({ data: await content.postAction(req.userId!, p(req.params.id), 'restore', restoreNoteBody.parse(body(req))) }));

R.get('/admin/content/comments/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.commentsSummary() }));
R.get('/admin/content/comments', ...adminOnly, async (req, res) => res.json(await content.listComments(commentsQuery.parse(req.query))));
R.post('/admin/content/comments/bulk', ...adminOnly, async (req, res) => res.json({ data: await content.bulkComments(req.userId!, bulkBody.parse(body(req))) }));
R.get('/admin/content/comments/:id', ...adminOnly, async (req, res) => res.json({ data: await content.commentDetail(p(req.params.id)) }));
R.post('/admin/content/comments/:id/hide', ...adminOnly, async (req, res) => res.json({ data: await content.commentAction(req.userId!, p(req.params.id), 'hide', hideBody.parse(body(req))) }));
R.post('/admin/content/comments/:id/remove', ...adminOnly, async (req, res) => res.json({ data: await content.commentAction(req.userId!, p(req.params.id), 'remove', hideBody.parse(body(req))) }));
R.post('/admin/content/comments/:id/restore', ...adminOnly, async (req, res) => res.json({ data: await content.commentAction(req.userId!, p(req.params.id), 'restore', restoreNoteBody.parse(body(req))) }));

R.get('/admin/content/courses/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.coursesSummary() }));
R.get('/admin/content/courses', ...adminOnly, async (req, res) => res.json(await content.listCourses(coursesQuery.parse(req.query))));
R.get('/admin/content/courses/:id', ...adminOnly, async (req, res) => res.json({ data: await content.courseDetail(p(req.params.id)) }));
R.post('/admin/content/courses/:id/publish', ...adminOnly, async (req, res) => res.json({ data: await content.courseAction(req.userId!, p(req.params.id), 'publish', restoreNoteBody.parse(body(req))) }));
R.post('/admin/content/courses/:id/unpublish', ...adminOnly, async (req, res) => res.json({ data: await content.courseAction(req.userId!, p(req.params.id), 'unpublish', unpublishBody.parse(body(req))) }));
R.post('/admin/content/courses/:id/archive', ...adminOnly, async (req, res) => res.json({ data: await content.courseAction(req.userId!, p(req.params.id), 'archive', archiveBody.parse(body(req))) }));
R.post('/admin/content/courses/:id/remove', ...adminOnly, async (req, res) => res.json({ data: await content.courseAction(req.userId!, p(req.params.id), 'remove', unpublishBody.parse(body(req))) }));
R.post('/admin/content/courses/:id/restore', ...adminOnly, async (req, res) => res.json({ data: await content.courseAction(req.userId!, p(req.params.id), 'restore', restoreNoteBody.parse(body(req))) }));

R.get('/admin/content/lessons/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.lessonsSummary() }));
R.get('/admin/content/lessons', ...adminOnly, async (req, res) => res.json(await content.listLessons(lessonsQuery.parse(req.query))));
R.get('/admin/content/lessons/:id', ...adminOnly, async (req, res) => res.json({ data: await content.lessonDetail(p(req.params.id)) }));
R.post('/admin/content/lessons/:id/hide', ...adminOnly, async (req, res) => res.json({ data: await content.lessonAction(req.userId!, p(req.params.id), 'hide', hideBody.parse(body(req))) }));
R.post('/admin/content/lessons/:id/remove', ...adminOnly, async (req, res) => res.json({ data: await content.lessonAction(req.userId!, p(req.params.id), 'remove', hideBody.parse(body(req))) }));
R.post('/admin/content/lessons/:id/restore', ...adminOnly, async (req, res) => res.json({ data: await content.lessonAction(req.userId!, p(req.params.id), 'restore', restoreNoteBody.parse(body(req))) }));

R.get('/admin/content/events/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.eventsSummary() }));
R.get('/admin/content/events', ...adminOnly, async (req, res) => res.json(await content.listEvents(eventsQuery.parse(req.query))));
R.get('/admin/content/events/:id', ...adminOnly, async (req, res) => res.json({ data: await content.eventDetail(p(req.params.id)) }));
R.patch('/admin/content/events/:id', ...adminOnly, async (req, res) => res.json({ data: await content.updateEvent(req.userId!, p(req.params.id), eventPatchBody.parse(body(req))) }));
R.post('/admin/content/events/:id/cancel', ...adminOnly, async (req, res) => res.json({ data: await content.eventAction(req.userId!, p(req.params.id), 'cancel', cancelEventBody.parse(body(req))) }));
R.post('/admin/content/events/:id/remove', ...adminOnly, async (req, res) => res.json({ data: await content.eventAction(req.userId!, p(req.params.id), 'remove', cancelEventBody.parse(body(req))) }));
R.post('/admin/content/events/:id/restore', ...adminOnly, async (req, res) => res.json({ data: await content.eventAction(req.userId!, p(req.params.id), 'restore', restoreNoteBody.parse(body(req))) }));

R.get('/admin/content/media/summary', ...adminOnly, async (_q, res) => res.json({ data: await content.mediaSummary() }));
R.get('/admin/content/media', ...adminOnly, async (req, res) => res.json(await content.listMedia(mediaQuery.parse(req.query))));
R.get('/admin/content/media/:key/download', ...adminOnly, async (req, res) => {
  const m = await content.mediaForDownload(p(req.params.key));
  const f = await uploadService.open(m.key, { includeRemoved: true });
  if (!f) throw HttpError.notFound('File không còn trong storage');
  res.setHeader('Content-Type', f.contentType);
  res.setHeader('Content-Length', String(f.size));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(m.filename)}`);
  f.stream.on('error', () => res.destroy());
  f.stream.pipe(res);
});
R.get('/admin/content/media/:key', ...adminOnly, async (req, res) => res.json({ data: await content.mediaDetail(p(req.params.key)) }));
R.post('/admin/content/media/:key/flag', ...adminOnly, async (req, res) => res.json({ data: await content.mediaAction(req.userId!, p(req.params.key), 'flag', flagBody.parse(body(req))) }));
R.post('/admin/content/media/:key/unflag', ...adminOnly, async (req, res) => res.json({ data: await content.mediaAction(req.userId!, p(req.params.key), 'unflag', restoreNoteBody.parse(body(req))) }));
R.post('/admin/content/media/:key/remove', ...adminOnly, async (req, res) => res.json({ data: await content.mediaAction(req.userId!, p(req.params.key), 'remove', removeMediaBody.parse(body(req))) }));
R.post('/admin/content/media/:key/restore', ...adminOnly, async (req, res) => res.json({ data: await content.mediaAction(req.userId!, p(req.params.key), 'restore', restoreNoteBody.parse(body(req))) }));

/* ================================================================ PAYMENTS */
R.get('/admin/payments/transactions/summary', ...adminOnly, async (req, res) => res.json({ data: await pay.txSummary(rangeQuery.parse(req.query)) }));
R.get('/admin/payments/transactions', ...adminOnly, async (req, res) => res.json(await pay.listTx(txQuery.parse(req.query))));
R.get('/admin/payments/transactions/:id', ...adminOnly, async (req, res) => res.json({ data: await pay.txDetail(p(req.params.id)) }));
R.post('/admin/payments/transactions/:id/refund', ...adminOnly, async (req, res) => res.json({ data: await pay.refundTx(req.userId!, p(req.params.id), txRefundBody.parse(body(req))) }));
R.post('/admin/payments/transactions/:id/retry', ...adminOnly, async (req, res) => res.json({ data: await pay.retryTx(req.userId!, p(req.params.id), noteOnly.parse(body(req))) }));

R.get('/admin/payments/subscriptions/summary', ...adminOnly, async (_q, res) => res.json({ data: await pay.subsSummary() }));
R.get('/admin/payments/subscriptions', ...adminOnly, async (req, res) => res.json(await pay.listSubs(subsQuery.parse(req.query))));
R.get('/admin/payments/subscriptions/:id', ...adminOnly, async (req, res) => res.json({ data: await pay.subDetail(p(req.params.id)) }));
R.post('/admin/payments/subscriptions/:id/pause', ...adminOnly, async (req, res) => res.json({ data: await pay.subAction(req.userId!, p(req.params.id), 'pause', pauseBody.parse(body(req))) }));
R.post('/admin/payments/subscriptions/:id/resume', ...adminOnly, async (req, res) => res.json({ data: await pay.subAction(req.userId!, p(req.params.id), 'resume', noteOnly.parse(body(req))) }));
R.post('/admin/payments/subscriptions/:id/cancel', ...adminOnly, async (req, res) => res.json({ data: await pay.subAction(req.userId!, p(req.params.id), 'cancel', cancelSubBody.parse(body(req))) }));

R.get('/admin/payments/refunds/summary', ...adminOnly, async (_q, res) => res.json({ data: await pay.refundsSummary() }));
R.get('/admin/payments/refunds', ...adminOnly, async (req, res) => res.json(await pay.listRefunds(refundsQuery.parse(req.query))));
R.get('/admin/payments/refunds/:id', ...adminOnly, async (req, res) => res.json({ data: await pay.refundDetail(p(req.params.id)) }));
R.post('/admin/payments/refunds/:id/approve', ...adminOnly, async (req, res) => res.json({ data: await pay.approveRefund(req.userId!, p(req.params.id), approveRefundBody.parse(body(req))) }));
R.post('/admin/payments/refunds/:id/reject', ...adminOnly, async (req, res) => res.json({ data: await pay.rejectRefund(req.userId!, p(req.params.id), rejectRefundBody.parse(body(req))) }));

R.get('/admin/payments/chargebacks/summary', ...adminOnly, async (_q, res) => res.json({ data: await pay.cbSummary() }));
R.get('/admin/payments/chargebacks', ...adminOnly, async (req, res) => res.json(await pay.listCb(cbQuery.parse(req.query))));
R.post('/admin/payments/chargebacks', ...adminOnly, async (req, res) => res.status(201).json({ data: await pay.createCb(req.userId!, createCbBody.parse(body(req))) }));
R.get('/admin/payments/chargebacks/:id', ...adminOnly, async (req, res) => res.json({ data: await pay.cbDetail(p(req.params.id)) }));
R.post('/admin/payments/chargebacks/:id/submit-evidence', ...adminOnly, async (req, res) => res.json({ data: await pay.cbAction(req.userId!, p(req.params.id), 'submit-evidence', evidenceBody.parse(body(req))) }));
R.post('/admin/payments/chargebacks/:id/accept', ...adminOnly, async (req, res) => res.json({ data: await pay.cbAction(req.userId!, p(req.params.id), 'accept', noteOnly.parse(body(req))) }));
R.post('/admin/payments/chargebacks/:id/mark-won', ...adminOnly, async (req, res) => res.json({ data: await pay.cbAction(req.userId!, p(req.params.id), 'mark-won', noteOnly.parse(body(req))) }));
R.post('/admin/payments/chargebacks/:id/mark-lost', ...adminOnly, async (req, res) => res.json({ data: await pay.cbAction(req.userId!, p(req.params.id), 'mark-lost', noteOnly.parse(body(req))) }));

R.get('/admin/payments/creators/summary', ...adminOnly, async (req, res) => res.json({ data: await pay.creatorsSummary(rangeQuery.parse(req.query)) }));
R.get('/admin/payments/creators', ...adminOnly, async (req, res) => res.json(await pay.listCreators(creatorsQuery.parse(req.query))));
R.get('/admin/payments/creators/:userId', ...adminOnly, async (req, res) => res.json({ data: await pay.creatorDetail(p(req.params.userId), rangeQuery.parse(req.query)) }));

R.get('/admin/payments/payouts/summary', ...adminOnly, async (_q, res) => res.json({ data: await pay.payoutsSummary() }));
R.get('/admin/payments/payouts', ...adminOnly, async (req, res) => res.json(await pay.listPayouts(payoutsQuery.parse(req.query))));
R.get('/admin/payments/payouts/:id', ...adminOnly, async (req, res) => res.json({ data: await pay.payoutDetail(p(req.params.id)) }));
for (const a of ['approve', 'mark-paid', 'release', 'retry'] as const) {
  R.post(`/admin/payments/payouts/:id/${a}`, ...adminOnly, async (req, res) => res.json({ data: await pay.payoutAction(req.userId!, p(req.params.id), a, noteOnly.parse(body(req))) }));
}
for (const a of ['reject', 'hold', 'mark-failed'] as const) {
  R.post(`/admin/payments/payouts/:id/${a}`, ...adminOnly, async (req, res) => res.json({ data: await pay.payoutAction(req.userId!, p(req.params.id), a, payoutReasonBody.parse(body(req))) }));
}

/* ================================================================ DISCOVERY */
R.get('/admin/discovery/communities/summary', ...adminOnly, async (_q, res) => res.json({ data: await disc.listedSummary() }));
R.get('/admin/discovery/communities', ...adminOnly, async (req, res) => res.json(await disc.listListed(listedQuery.parse(req.query))));
R.post('/admin/discovery/communities/:id/status', ...adminOnly, async (req, res) => res.json({ data: await disc.setStatus(req.userId!, p(req.params.id), setStatusBody.parse(body(req))) }));
R.post('/admin/discovery/communities/:id/feature', ...adminOnly, async (req, res) => res.json({ data: await disc.feature(req.userId!, p(req.params.id), featureBody.parse(body(req))) }));
R.post('/admin/discovery/communities/:id/unfeature', ...adminOnly, async (req, res) => res.json({ data: await disc.unfeature(req.userId!, p(req.params.id), unfeatureBody.parse(body(req))) }));
R.post('/admin/discovery/communities/:id/search-visibility', ...adminOnly, async (req, res) =>
  res.json({ data: await disc.setSearchVisibility(req.userId!, p(req.params.id), searchVisibilityBody.parse(body(req))) }),
);

R.get('/admin/discovery/categories', ...adminOnly, async (_q, res) => res.json({ data: await disc.listCategories() }));
R.post('/admin/discovery/categories', ...adminOnly, async (req, res) => res.status(201).json({ data: await disc.createCategory(req.userId!, createCategoryBody.parse(body(req))) }));
R.post('/admin/discovery/categories/reorder', ...adminOnly, async (req, res) => res.json({ data: await disc.reorderCategories(req.userId!, reorderCategoriesBody.parse(body(req)).keys) }));
R.patch('/admin/discovery/categories/:key', ...adminOnly, async (req, res) => res.json({ data: await disc.patchCategory(req.userId!, p(req.params.key), patchCategoryBody.parse(body(req))) }));
R.post('/admin/discovery/categories/:key/move', ...adminOnly, async (req, res) =>
  res.json({ data: await disc.moveCategory(req.userId!, p(req.params.key), moveCategoryBody.parse(body(req)).direction) }),
);

R.get('/admin/discovery/featured', ...adminOnly, async (_q, res) => res.json({ data: await disc.listFeatured() }));
R.post('/admin/discovery/featured', ...adminOnly, async (req, res) => {
  const e = await disc.addFeatured(req.userId!, addFeaturedBody.parse(body(req)));
  const item = (await disc.listFeatured()).sections.flatMap((s) => s.items).find((i) => i.id === e.id);
  res.status(201).json({ data: { section: e.section, ...item } });
});
R.post('/admin/discovery/featured/:section/reorder', ...adminOnly, async (req, res) => {
  const section = p(req.params.section);
  if (!(FEATURE_SECTIONS as readonly string[]).includes(section)) throw HttpError.notFound('Không có section này');
  res.json({ data: await disc.reorderFeatured(req.userId!, section as (typeof FEATURE_SECTIONS)[number], reorderFeaturedBody.parse(body(req)).entryIds) });
});
R.patch('/admin/discovery/featured/:entryId', ...adminOnly, async (req, res) => res.json({ data: await disc.patchFeatured(req.userId!, p(req.params.entryId), patchFeaturedBody.parse(body(req))) }));
R.delete('/admin/discovery/featured/:entryId', ...adminOnly, async (req, res) => res.json({ data: await disc.removeFeatured(req.userId!, p(req.params.entryId)) }));

R.get('/admin/discovery/rankings', ...adminOnly, async (_q, res) => res.json({ data: await disc.getRankings() }));
R.post('/admin/discovery/rankings/preview', ...adminOnly, async (req, res) => res.json({ data: await disc.previewRankings(weightsBody.parse(body(req)).weights) }));
R.post('/admin/discovery/rankings/reset', ...adminOnly, async (req, res) => res.json({ data: await disc.publishRankings(req.userId!, { ...DEFAULT_WEIGHTS }, undefined, true) }));
R.put('/admin/discovery/rankings', ...adminOnly, async (req, res) => {
  const b = publishWeightsBody.parse(body(req));
  res.json({ data: await disc.publishRankings(req.userId!, b.weights, b.note) });
});

R.get('/admin/discovery/search-visibility/summary', ...adminOnly, async (_q, res) => res.json({ data: await disc.searchSummary() }));
R.get('/admin/discovery/search-visibility', ...adminOnly, async (req, res) => res.json(await disc.listSearch(searchListQuery.parse(req.query))));
