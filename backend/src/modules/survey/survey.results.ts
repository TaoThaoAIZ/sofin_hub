import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { MAX_PAGE } from '../../utils/pagination.js';
import { userBriefView } from '../auth/user-view.js';
import { classroomService } from '../classroom/classroom.service.js';

/**
 * Kết quả khảo sát cho chủ/mod. Thiết kế chịu được nhiều người trả lời:
 *  - thống kê (đếm theo lựa chọn) tính NGAY TRONG DATABASE, không tải câu trả lời về;
 *  - câu trả lời tự nhập và danh sách từng học viên phân trang (+ tìm + lọc theo đáp án);
 *  - xuất CSV đọc từng lô, không giữ cả bảng trong RAM.
 */

const pageQuery = {
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  q: z.string().trim().max(100).optional(),
};
/** Giờ Việt Nam (UTC+7) dạng `YYYY-MM-DD HH:mm` cho file CSV (giao diện cũng hiện giờ VN). */
const vnTime = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ');

export const textsQuery = z.object({ ...pageQuery, questionId: z.string().trim().min(1).max(64) });
export const responsesQuery = z.object({ ...pageQuery, questionId: z.string().trim().max(64).optional(), choice: z.string().max(200).optional() });
export type TextsQuery = z.infer<typeof textsQuery>;
export type ResponsesQuery = z.infer<typeof responsesQuery>;

type Q = { id: string; text: string; type: 'single' | 'multiple' | 'text'; options: string[]; required: boolean; allowText?: boolean };
type A = { questionId: string; choices: string[]; text?: string };
const asQuestions = (v: unknown): Q[] => (Array.isArray(v) ? (v as Q[]) : []);
const asAnswers = (v: unknown): A[] => (Array.isArray(v) ? (v as A[]) : []);
const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const meta = (page: number, limit: number, total: number) => ({ page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });

async function loadSurvey(communityId: string, lessonId: string) {
  await classroomService.assertLessonInCommunity(communityId, lessonId);
  const survey = await prisma.lessonSurvey.findUnique({ where: { lessonId }, include: { lesson: { select: { title: true, module: { select: { title: true } } } } } });
  if (!survey) return null;
  return { id: survey.id, lessonTitle: survey.lesson.title, moduleTitle: survey.lesson.module.title, questions: asQuestions(survey.questions) };
}

export const surveyResults = {
  /** Mọi khảo sát của cộng đồng: số người trả lời, tỷ lệ trên tổng thành viên, lần trả lời gần nhất. */
  async list(communityId: string) {
    const [surveys, members] = await Promise.all([
      prisma.lessonSurvey.findMany({
        where: { lesson: { communityId } },
        include: { lesson: { select: { id: true, title: true, index: true, hidden: true, removedAt: true, module: { select: { title: true, index: true, publishStatus: true, removedAt: true } } } }, _count: { select: { responses: true } } },
      }),
      prisma.enrollment.count({ where: { communityId } }),
    ]);
    const last = await prisma.surveyResponse.groupBy({ by: ['surveyId'], where: { surveyId: { in: surveys.map((s) => s.id) } }, _max: { updatedAt: true } });
    const lastBy = new Map(last.map((l) => [l.surveyId, l._max.updatedAt]));
    return {
      memberCount: members,
      surveys: surveys
        .map((s) => ({
          lessonId: s.lessonId,
          lessonTitle: s.lesson.title,
          moduleTitle: s.lesson.module.title,
          questionCount: asQuestions(s.questions).length,
          responseCount: s._count.responses,
          lastAnsweredAt: lastBy.get(s.id)?.toISOString() ?? null,
          /** Đang hoạt động = học viên đang thấy được khảo sát (bài không ẩn/gỡ, module đã xuất bản và chưa gỡ). */
          active: !s.lesson.hidden && !s.lesson.removedAt && s.lesson.module.publishStatus === 'published' && !s.lesson.module.removedAt,
          order: s.lesson.module.index * 10_000 + s.lesson.index,
        }))
        .filter((s) => s.questionCount > 0)
        .sort((a, b) => a.order - b.order)
        .map(({ order: _o, ...rest }) => rest),
    };
  },

  /** Tổng quan: đếm theo lựa chọn bằng SQL (jsonb), không tải từng câu trả lời. */
  async overview(communityId: string, lessonId: string) {
    const s = await loadSurvey(communityId, lessonId);
    if (!s || s.questions.length === 0) return null;
    const [responseCount, memberCount, counts, answered] = await Promise.all([
      prisma.surveyResponse.count({ where: { surveyId: s.id } }),
      prisma.enrollment.count({ where: { communityId } }),
      prisma.$queryRaw<{ qid: string; choice: string; n: bigint }[]>(Prisma.sql`
        SELECT e->>'questionId' AS qid, c AS choice, count(*) AS n
        FROM "SurveyResponse" r, jsonb_array_elements(r."answers") e, jsonb_array_elements_text(e->'choices') c
        WHERE r."surveyId" = ${s.id}
        GROUP BY 1, 2`),
      prisma.$queryRaw<{ qid: string; n: bigint }[]>(Prisma.sql`
        SELECT e->>'questionId' AS qid, count(*) AS n
        FROM "SurveyResponse" r, jsonb_array_elements(r."answers") e
        WHERE r."surveyId" = ${s.id}
        GROUP BY 1`),
    ]);
    const answeredBy = new Map(answered.map((a) => [a.qid, Number(a.n)]));
    return {
      lessonId,
      lessonTitle: s.lessonTitle,
      moduleTitle: s.moduleTitle,
      responseCount,
      memberCount,
      questions: s.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        required: q.required,
        allowText: q.type === 'text' || !!q.allowText,
        answered: answeredBy.get(q.id) ?? 0,
        options: q.options.map((o) => ({ text: o, count: Number(counts.find((c) => c.qid === q.id && c.choice === o)?.n ?? 0) })),
      })),
    };
  },

  /** Câu trả lời tự nhập của MỘT câu hỏi: phân trang, tìm theo từ khóa trong nội dung. */
  async texts(communityId: string, lessonId: string, query: TextsQuery) {
    const s = await loadSurvey(communityId, lessonId);
    if (!s) return { data: [], meta: meta(1, query.limit, 0) };
    const search = query.q ? Prisma.sql`AND e->>'text' ILIKE ${like(query.q)}` : Prisma.empty;
    const base = Prisma.sql`FROM "SurveyResponse" r, jsonb_array_elements(r."answers") e
      WHERE r."surveyId" = ${s.id} AND e->>'questionId' = ${query.questionId} AND coalesce(e->>'text', '') <> '' ${search}`;
    const [rows, total] = await Promise.all([
      prisma.$queryRaw<{ userId: string; text: string; updatedAt: Date }[]>(Prisma.sql`
        SELECT r."userId", e->>'text' AS text, r."updatedAt" ${base} ORDER BY r."updatedAt" DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS n ${base}`),
    ]);
    const users = new Map(await Promise.all([...new Set(rows.map((r) => r.userId))].map(async (id) => [id, await userBriefView(id)] as const)));
    return {
      data: rows.map((r) => ({ user: users.get(r.userId)!, text: r.text, answeredAt: r.updatedAt.toISOString() })),
      meta: meta(query.page, query.limit, Number(total[0]?.n ?? 0)),
    };
  },

  /** Từng học viên: phân trang, tìm theo tên, lọc "chọn đáp án X ở câu Y". */
  async responses(communityId: string, lessonId: string, query: ResponsesQuery) {
    const s = await loadSurvey(communityId, lessonId);
    if (!s) return { data: [], meta: meta(1, query.limit, 0) };
    const conds: Prisma.Sql[] = [Prisma.sql`r."surveyId" = ${s.id}`];
    if (query.q) conds.push(Prisma.sql`(u."firstName" || ' ' || u."lastName") ILIKE ${like(query.q)}`);
    if (query.questionId && query.choice) {
      conds.push(Prisma.sql`r."answers" @> ${JSON.stringify([{ questionId: query.questionId, choices: [query.choice] }])}::jsonb`);
    }
    const where = Prisma.join(conds, ' AND ');
    const [rows, total] = await Promise.all([
      prisma.$queryRaw<{ userId: string; answers: unknown; updatedAt: Date }[]>(Prisma.sql`
        SELECT r."userId", r."answers", r."updatedAt" FROM "SurveyResponse" r JOIN "User" u ON u."id" = r."userId"
        WHERE ${where} ORDER BY r."updatedAt" DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`SELECT count(*) AS n FROM "SurveyResponse" r JOIN "User" u ON u."id" = r."userId" WHERE ${where}`),
    ]);
    const users = new Map(await Promise.all([...new Set(rows.map((r) => r.userId))].map(async (id) => [id, await userBriefView(id)] as const)));
    return {
      data: rows.map((r) => ({ user: users.get(r.userId)!, answeredAt: r.updatedAt.toISOString(), answers: asAnswers(r.answers) })),
      meta: meta(query.page, query.limit, Number(total[0]?.n ?? 0)),
    };
  },

  /** CSV (UTF-8 có BOM để Excel đọc đúng tiếng Việt): mỗi hàng một học viên, mỗi cột một câu hỏi. Đọc theo lô 500. */
  async *exportCsv(communityId: string, lessonId: string): AsyncGenerator<string> {
    const s = await loadSurvey(communityId, lessonId);
    if (!s) return;
    const esc = (v: string) => {
      // Chống CSV injection: ô bắt đầu bằng = + - @ bị Excel hiểu là công thức.
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    yield `﻿${['Họ tên', 'Thời gian trả lời', ...s.questions.map((q) => q.text)].map(esc).join(',')}\r\n`;
    let cursorId: string | undefined;
    for (;;) {
      const rows = await prisma.surveyResponse.findMany({
        where: { surveyId: s.id },
        orderBy: { id: 'asc' },
        take: 500,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      if (rows.length === 0) return;
      for (const r of rows) {
        const name = (await userBriefView(r.userId)).name;
        const answers = asAnswers(r.answers);
        const cells = s.questions.map((q) => {
          const a = answers.find((x) => x.questionId === q.id);
          return a ? [...a.choices, ...(a.text ? [a.text] : [])].join('; ') : '';
        });
        yield `${[name, vnTime(r.updatedAt), ...cells].map(esc).join(',')}\r\n`;
      }
      cursorId = rows[rows.length - 1]!.id;
    }
  },
};
