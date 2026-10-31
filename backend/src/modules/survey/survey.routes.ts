import { Router, type Request } from 'express';
import { requireAuth } from '../../middlewares/auth.js';
import { catalogService } from '../catalog/catalog.service.js';
import { enrollmentService } from '../enrollments/enrollments.service.js';
import { requireRole } from '../permissions/policy.js';
import { responsesQuery, surveyResults, textsQuery } from './survey.results.js';
import { putSurveyBody, submitSurveyBody, surveyService } from './survey.service.js';

/** Khảo sát theo bài học. `/communities/:id/...` ≡ `/courses/:id/...` (communityAlias). */
export const surveyRouter = Router();

const communityOf = (req: Request) => req.params.id as string;
const lessonOf = (req: Request) => req.params.lessonId as string;

surveyRouter.get('/courses/:id/lessons/:lessonId/survey', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await surveyService.get(communityId, lessonOf(req), req.userId!) });
});

surveyRouter.post('/courses/:id/lessons/:lessonId/survey/response', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await enrollmentService.requireMembership(req.userId!, communityId);
  res.json({ data: await surveyService.submit(communityId, lessonOf(req), req.userId!, submitSurveyBody.parse(req.body)) });
});

surveyRouter.put('/courses/:id/lessons/:lessonId/survey', requireAuth, async (req, res) => {
  const communityId = communityOf(req);
  await catalogService.requireLockState(communityId);
  await requireRole(req.userId!, communityId, 'mod');
  res.json({ data: await surveyService.put(communityId, lessonOf(req), putSurveyBody.parse(req.body)) });
});

// ---- Kết quả (mod+) ----
const staffOnly = async (req: Request) => {
  await catalogService.getById(communityOf(req));
  await requireRole(req.userId!, communityOf(req), 'mod');
};

surveyRouter.get('/courses/:id/surveys', requireAuth, async (req, res) => {
  await staffOnly(req);
  res.json({ data: await surveyResults.list(communityOf(req)) });
});

surveyRouter.get('/courses/:id/lessons/:lessonId/survey/results', requireAuth, async (req, res) => {
  await staffOnly(req);
  res.json({ data: await surveyResults.overview(communityOf(req), lessonOf(req)) });
});

surveyRouter.get('/courses/:id/lessons/:lessonId/survey/texts', requireAuth, async (req, res) => {
  await staffOnly(req);
  res.json(await surveyResults.texts(communityOf(req), lessonOf(req), textsQuery.parse(req.query)));
});

surveyRouter.get('/courses/:id/lessons/:lessonId/survey/responses', requireAuth, async (req, res) => {
  await staffOnly(req);
  res.json(await surveyResults.responses(communityOf(req), lessonOf(req), responsesQuery.parse(req.query)));
});

surveyRouter.get('/courses/:id/lessons/:lessonId/survey/export.csv', requireAuth, async (req, res) => {
  await staffOnly(req);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="khao-sat-${lessonOf(req)}.csv"`);
  for await (const chunk of surveyResults.exportCsv(communityOf(req), lessonOf(req))) {
    if (!res.write(chunk)) await new Promise<void>((r) => res.once('drain', r));
  }
  res.end();
});
