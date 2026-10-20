import { prisma } from '../../db/prisma.js';

type Q = { id: string; required?: boolean };
type A = { questionId: string; choices?: string[]; text?: string };

/** Truy vấn Prisma thuần (dùng chung giữa classroom.service và survey.service, tránh vòng phụ thuộc). */
export const surveyStore = {
  /** Bài có khảo sát (có ít nhất 1 câu hỏi) không? */
  async exists(lessonId: string): Promise<boolean> {
    const s = await prisma.lessonSurvey.findUnique({ where: { lessonId }, select: { questions: true } });
    return Array.isArray(s?.questions) && s.questions.length > 0;
  },

  /**
   * Người dùng còn câu hỏi BẮT BUỘC của khảo sát bài này mà chưa trả lời không? (bài không có khảo sát / không có câu bắt buộc => false)
   * Câu trả lời tính là có khi chọn ít nhất một đáp án hoặc có nhập chữ.
   */
  async hasUnansweredRequired(lessonId: string, userId: string): Promise<boolean> {
    const survey = await prisma.lessonSurvey.findUnique({ where: { lessonId } });
    const required = (Array.isArray(survey?.questions) ? (survey.questions as Q[]) : []).filter((q) => q.required);
    if (!survey || required.length === 0) return false;
    const mine = await prisma.surveyResponse.findUnique({ where: { surveyId_userId: { surveyId: survey.id, userId } } });
    const answers = Array.isArray(mine?.answers) ? (mine.answers as A[]) : [];
    return required.some((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return !a || !((a.choices?.length ?? 0) > 0 || a.text?.trim());
    });
  },
};
