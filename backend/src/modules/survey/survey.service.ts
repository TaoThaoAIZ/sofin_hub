import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { catalogService } from '../catalog/catalog.service.js';
import { notify } from '../notifications/notifications.service.js';
import { classroomService } from '../classroom/classroom.service.js';

export const MAX_SURVEY_QUESTIONS = 30;
export const MAX_SURVEY_OPTIONS = 10;
const MAX_TEXT_ANSWER = 1000;
/** Mốc số người trả lời: đạt mốc thì báo chủ cộng đồng một lần. */
const MILESTONES = new Set([10, 50, 100, 500, 1000]);

export const QUESTION_TYPES = ['single', 'multiple', 'text'] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

type StoredQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  required: boolean;
  /** Câu chọn đáp án có thêm ô học viên tự nhập ý kiến khác (bên dưới các lựa chọn). Câu kiểu 'text' luôn là true. */
  allowText?: boolean;
};
type StoredAnswer = {
  questionId: string;
  choices: string[];
  text?: string;
};

const question = z.strictObject({
  /** Giữ id cũ khi sửa khảo sát để câu trả lời đã thu vẫn khớp câu hỏi. */
  id: z.string().trim().min(1).max(64).optional(),
  text: z.string().trim().min(1, 'Nhập nội dung câu hỏi').max(500, 'Câu hỏi tối đa 500 ký tự'),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string().trim().min(1, 'Lựa chọn không được để trống').max(200, 'Mỗi lựa chọn tối đa 200 ký tự')).max(MAX_SURVEY_OPTIONS, `Mỗi câu tối đa ${MAX_SURVEY_OPTIONS} lựa chọn`).default([]),
  required: z.boolean().default(false),
  allowText: z.boolean().default(false),
});

/** `questions` rỗng = xóa khảo sát của bài. */
export const putSurveyBody = z.strictObject({ questions: z.array(question).max(MAX_SURVEY_QUESTIONS, `Tối đa ${MAX_SURVEY_QUESTIONS} câu hỏi`) });
export type PutSurveyBody = z.infer<typeof putSurveyBody>;

export const submitSurveyBody = z.strictObject({
  answers: z
    .array(
      z.strictObject({
        questionId: z.string().trim().min(1).max(64),
        choices: z.array(z.string().max(200)).max(MAX_SURVEY_OPTIONS).default([]),
        text: z.string().trim().max(MAX_TEXT_ANSWER, `Câu trả lời tối đa ${MAX_TEXT_ANSWER} ký tự`).optional(),
      }),
    )
    .max(MAX_SURVEY_QUESTIONS),
});
export type SubmitSurveyBody = z.infer<typeof submitSurveyBody>;

const asQuestions = (v: unknown): StoredQuestion[] => (Array.isArray(v) ? (v as StoredQuestion[]) : []);
const asAnswers = (v: unknown): StoredAnswer[] => (Array.isArray(v) ? (v as StoredAnswer[]) : []);

export const surveyService = {
  /** Khảo sát của bài cho người xem (học viên và mod+ đều thấy câu hỏi); kèm câu trả lời trước đó của chính họ. */
  async get(communityId: string, lessonId: string, userId: string) {
    const { staff } = await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const survey = await prisma.lessonSurvey.findUnique({ where: { lessonId } });
    const questions = survey ? asQuestions(survey.questions) : [];
    if (!survey || questions.length === 0) return { survey: null, canEdit: staff };
    const mine = await prisma.surveyResponse.findUnique({ where: { surveyId_userId: { surveyId: survey.id, userId } } });
    return {
      canEdit: staff,
      survey: {
        id: survey.id,
        questions,
        myAnswers: mine ? asAnswers(mine.answers) : null,
        answeredAt: mine?.updatedAt.toISOString() ?? null,
      },
    };
  },

  /** Mod+ thay toàn bộ câu hỏi. KHÔNG xóa câu trả lời đã thu (câu hỏi giữ id thì kết quả vẫn khớp). */
  async put(communityId: string, lessonId: string, body: PutSurveyBody) {
    await classroomService.assertLessonInCommunity(communityId, lessonId);
    if (body.questions.length === 0) {
      await prisma.lessonSurvey.deleteMany({ where: { lessonId } });
      return { survey: null };
    }
    const existing = await prisma.lessonSurvey.findUnique({ where: { lessonId } });
    const knownIds = new Set(asQuestions(existing?.questions).map((q) => q.id));
    const seen = new Set<string>();
    const questions: StoredQuestion[] = body.questions.map((q, i) => {
      if (q.type !== 'text') {
        if (q.options.length < 2) throw HttpError.badRequest(`Câu ${i + 1}: cần ít nhất 2 lựa chọn`);
        if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) throw HttpError.badRequest(`Câu ${i + 1}: các lựa chọn không được trùng nhau`);
      }
      const id = q.id && knownIds.has(q.id) && !seen.has(q.id) ? q.id : randomUUID();
      seen.add(id);
      return { id, text: q.text, type: q.type, options: q.type === 'text' ? [] : q.options, required: q.required, allowText: q.type === 'text' ? true : q.allowText };
    });
    const saved = await prisma.lessonSurvey.upsert({ where: { lessonId }, create: { lessonId, questions }, update: { questions } });
    return { survey: { id: saved.id, questionCount: questions.length } };
  },

  /** Học viên nộp (hoặc nộp lại, ghi đè) câu trả lời. Chỉ nhận lựa chọn có trong câu hỏi; câu bắt buộc phải có trả lời. */
  async submit(communityId: string, lessonId: string, userId: string, body: SubmitSurveyBody) {
    await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const survey = await prisma.lessonSurvey.findUnique({ where: { lessonId } });
    const questions = survey ? asQuestions(survey.questions) : [];
    if (!survey || questions.length === 0) throw HttpError.notFound('Bài học này chưa có khảo sát');
    const byId = new Map(body.answers.map((a) => [a.questionId, a]));
    const answers: StoredAnswer[] = [];
    for (const [i, q] of questions.entries()) {
      const a = byId.get(q.id);
      let choices: string[] = [];
      let text: string | undefined;
      if (q.type === 'text' || q.allowText) text = a?.text?.trim() || undefined;
      if (q.type !== 'text') {
        choices = [...new Set(a?.choices ?? [])];
        if (choices.some((c) => !q.options.includes(c))) throw HttpError.badRequest(`Câu ${i + 1}: lựa chọn không hợp lệ`);
        if (q.type === 'single' && choices.length > 1) throw HttpError.badRequest(`Câu ${i + 1}: chỉ được chọn một đáp án`);
      }
      if (q.required && choices.length === 0 && !text) throw HttpError.badRequest(`Câu ${i + 1} là bắt buộc`);
      if (choices.length || text) answers.push({ questionId: q.id, choices, ...(text ? { text } : {}) });
    }
    if (answers.length === 0) throw HttpError.badRequest('Hãy trả lời ít nhất một câu hỏi');
    const isNew = !(await prisma.surveyResponse.findUnique({ where: { surveyId_userId: { surveyId: survey.id, userId } }, select: { id: true } }));
    await prisma.surveyResponse.upsert({
      where: { surveyId_userId: { surveyId: survey.id, userId } },
      create: { surveyId: survey.id, userId, answers },
      update: { answers },
    });
    if (isNew) void this.notifyMilestone(communityId, lessonId, survey.id).catch(() => undefined);
    return { saved: true };
  },

  /** Đủ số người trả lời theo mốc thì báo chủ cộng đồng (link tới trang kết quả). */
  async notifyMilestone(communityId: string, lessonId: string, surveyId: string) {
    const total = await prisma.surveyResponse.count({ where: { surveyId } });
    if (!MILESTONES.has(total)) return;
    const [community, lesson] = await Promise.all([catalogService.getById(communityId), prisma.classroomLesson.findUnique({ where: { id: lessonId }, select: { title: true } })]);
    if (!community.ownerId) return;
    notify({
      userId: community.ownerId,
      type: 'system',
      title: 'Khảo sát đạt mốc trả lời mới',
      body: `Khảo sát bài "${lesson?.title ?? ''}" đã có ${total} học viên trả lời`,
      link: `/communities/${communityId}/community/khao-sat/${lessonId}`,
      communityId,
    });
  },
};
