import { prisma } from '../../db/prisma.js';

/** Một câu hỏi lưu trong LessonQuiz.questions. `correctIndex` KHÔNG bao giờ gửi cho học viên chưa đạt. */
export type StoredQuestion = {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
};

export interface QuizRow {
  id: string;
  lessonId: string;
  passPercent: number;
  questions: StoredQuestion[];
}

const toRow = (r: { id: string; lessonId: string; passPercent: number; questions: unknown }): QuizRow => ({
  id: r.id,
  lessonId: r.lessonId,
  passPercent: r.passPercent,
  questions: Array.isArray(r.questions) ? (r.questions as StoredQuestion[]) : [],
});

/** Truy vấn Prisma thuần cho trắc nghiệm (dùng chung giữa classroom.service và quiz.service, tránh vòng phụ thuộc). */
export const quizStore = {
  async findByLesson(lessonId: string): Promise<QuizRow | undefined> {
    const r = await prisma.lessonQuiz.findUnique({ where: { lessonId } });
    return r ? toRow(r) : undefined;
  },

  /** Bài có trắc nghiệm (>= 1 câu) trong danh sách bài, kèm điểm chuẩn. */
  async requiredByLesson(lessonIds: string[]): Promise<Map<string, number>> {
    if (lessonIds.length === 0) return new Map();
    const rows = await prisma.lessonQuiz.findMany({ where: { lessonId: { in: lessonIds } } });
    return new Map(rows.filter((r) => Array.isArray(r.questions) && r.questions.length > 0).map((r) => [r.lessonId, r.passPercent]));
  },

  async hasPassed(quizId: string, userId: string): Promise<boolean> {
    return (await prisma.quizAttempt.count({ where: { quizId, userId, passed: true } })) > 0;
  },

  async stats(quizId: string, userId: string) {
    const [attempts, best, passed] = await Promise.all([
      prisma.quizAttempt.count({ where: { quizId, userId } }),
      prisma.quizAttempt.aggregate({ where: { quizId, userId }, _max: { scorePercent: true } }),
      prisma.quizAttempt.count({ where: { quizId, userId, passed: true } }),
    ]);
    return { attempts, bestPercent: best._max.scorePercent ?? null, passed: passed > 0 };
  },
};
