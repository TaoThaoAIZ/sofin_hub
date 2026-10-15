import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { classroomService } from '../classroom/classroom.service.js';
import { quizStore, type StoredQuestion } from './quiz.store.js';

export const MAX_QUESTIONS = 50;
const MAX_ATTEMPTS_PER_DAY = 30;
const DAY_MS = 86_400_000;

const question = z.strictObject({
  text: z.string().trim().min(1, 'Nhập nội dung câu hỏi').max(500, 'Câu hỏi tối đa 500 ký tự'),
  options: z.array(z.string().trim().min(1, 'Lựa chọn không được để trống').max(200, 'Mỗi lựa chọn tối đa 200 ký tự')).min(2, 'Mỗi câu cần ít nhất 2 lựa chọn').max(6, 'Mỗi câu tối đa 6 lựa chọn'),
  correctIndex: z.number().int().min(0),
});

/** `questions` rỗng = xóa trắc nghiệm của bài. */
export const putQuizBody = z.strictObject({
  passPercent: z.number().int().min(1, 'Điểm đạt tối thiểu 1%').max(100, 'Điểm đạt tối đa 100%').default(70),
  questions: z.array(question).max(MAX_QUESTIONS, `Tối đa ${MAX_QUESTIONS} câu hỏi`),
});
export type PutQuizBody = z.infer<typeof putQuizBody>;

export const attemptBody = z.strictObject({
  /** Vị trí lựa chọn cho từng câu theo đúng thứ tự câu hỏi; null = bỏ trống (tính sai). */
  answers: z.array(z.number().int().min(0).nullable()).max(MAX_QUESTIONS),
});

const publicQuestion = (q: StoredQuestion) => ({ id: q.id, text: q.text, options: q.options });

export const quizService = {
  /**
   * Trắc nghiệm của bài cho người xem. Học viên: câu hỏi KHÔNG kèm đáp án; mod+: kèm `correctIndex` để chỉnh sửa.
   * Bài khóa / không truy cập được ⇒ lỗi khóa như xem bài.
   */
  async get(communityId: string, lessonId: string, userId: string) {
    const { staff } = await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const quiz = await quizStore.findByLesson(lessonId);
    if (!quiz || quiz.questions.length === 0) return { quiz: null, canEdit: staff };
    const st = await quizStore.stats(quiz.id, userId);
    return {
      canEdit: staff,
      quiz: {
        id: quiz.id,
        passPercent: quiz.passPercent,
        questionCount: quiz.questions.length,
        questions: quiz.questions.map((q) => (staff ? { ...publicQuestion(q), correctIndex: q.correctIndex } : publicQuestion(q))),
        attempts: st.attempts,
        bestPercent: st.bestPercent,
        passed: st.passed,
      },
    };
  },

  /** Mod+ thay toàn bộ trắc nghiệm của bài. Xóa các lượt làm cũ (yêu cầu đạt điểm tính lại). */
  async put(communityId: string, lessonId: string, body: PutQuizBody) {
    await classroomService.assertLessonInCommunity(communityId, lessonId);
    for (const [i, q] of body.questions.entries()) {
      if (q.correctIndex >= q.options.length) throw HttpError.badRequest(`Câu ${i + 1}: đáp án đúng nằm ngoài danh sách lựa chọn`);
      if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) throw HttpError.badRequest(`Câu ${i + 1}: các lựa chọn không được trùng nhau`);
    }
    if (body.questions.length === 0) {
      await prisma.lessonQuiz.deleteMany({ where: { lessonId } });
      return { quiz: null };
    }
    const questions: StoredQuestion[] = body.questions.map((q) => ({ id: randomUUID(), text: q.text, options: q.options, correctIndex: q.correctIndex }));
    const saved = await prisma.$transaction(async (tx) => {
      const quiz = await tx.lessonQuiz.upsert({
        where: { lessonId },
        create: { lessonId, passPercent: body.passPercent, questions },
        update: { passPercent: body.passPercent, questions },
      });
      await tx.quizAttempt.deleteMany({ where: { quizId: quiz.id } });
      return quiz;
    });
    return { quiz: { id: saved.id, passPercent: saved.passPercent, questionCount: questions.length } };
  },

  /**
   * Chấm bài ở SERVER. Trả điểm + đúng/sai từng câu; đáp án đúng chỉ lộ ra khi học viên đã ĐẠT
   * (để thử lại không thể đọc thẳng đáp án từ phản hồi).
   */
  async attempt(communityId: string, lessonId: string, userId: string, body: z.infer<typeof attemptBody>) {
    await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const quiz = await quizStore.findByLesson(lessonId);
    if (!quiz || quiz.questions.length === 0) throw HttpError.notFound('Bài học này chưa có trắc nghiệm');
    if (body.answers.length !== quiz.questions.length) throw HttpError.badRequest('Số câu trả lời không khớp số câu hỏi');
    const since = new Date(Date.now() - DAY_MS);
    if ((await prisma.quizAttempt.count({ where: { quizId: quiz.id, userId, createdAt: { gte: since } } })) >= MAX_ATTEMPTS_PER_DAY) {
      throw HttpError.coded(429, 'QUIZ_TOO_MANY_ATTEMPTS', 'Bạn đã làm bài quá nhiều lần hôm nay, hãy thử lại vào ngày mai');
    }
    const results = quiz.questions.map((q, i) => ({ questionId: q.id, correct: body.answers[i] === q.correctIndex }));
    const correctCount = results.filter((r) => r.correct).length;
    const scorePercent = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = scorePercent >= quiz.passPercent;
    await prisma.quizAttempt.create({ data: { quizId: quiz.id, userId, scorePercent, correctCount, total: quiz.questions.length, passed, answers: body.answers } });
    const everPassed = passed || (await quizStore.hasPassed(quiz.id, userId));
    return {
      scorePercent,
      correctCount,
      total: quiz.questions.length,
      passPercent: quiz.passPercent,
      passed,
      results: results.map((r, i) => ({ ...r, ...(everPassed ? { correctIndex: quiz.questions[i]!.correctIndex } : {}) })),
    };
  },
};
