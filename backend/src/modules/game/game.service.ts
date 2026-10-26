import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { classroomService } from '../classroom/classroom.service.js';
import { pointsService } from '../points/points.service.js';

export const MIN_GAME_PAIRS = 2;
export const MAX_GAME_PAIRS = 8;
/** Điểm thưởng cho mỗi sao (chơi xong lần đầu của bài; giá trị tạm, chỉnh ở đây). */
export const POINTS_PER_STAR = 2;

type StoredPair = { id: string; term: string; definition: string };

const pair = z.strictObject({
  /** Giữ id cũ khi sửa để không đổi cặp đã có. */
  id: z.string().trim().min(1).max(64).optional(),
  term: z.string().trim().min(1, 'Nhập thuật ngữ').max(80, 'Thuật ngữ tối đa 80 ký tự'),
  definition: z.string().trim().min(1, 'Nhập định nghĩa').max(160, 'Định nghĩa tối đa 160 ký tự'),
});

/** `pairs` rỗng = xóa trò chơi của bài. */
export const putGameBody = z.strictObject({ pairs: z.array(pair).max(MAX_GAME_PAIRS, `Tối đa ${MAX_GAME_PAIRS} cặp thẻ`) });
export type PutGameBody = z.infer<typeof putGameBody>;

export const resultBody = z.strictObject({
  moves: z.number().int().min(1).max(1000),
  seconds: z.number().int().min(0).max(86_400),
});
export type ResultBody = z.infer<typeof resultBody>;

const asPairs = (v: unknown): StoredPair[] => (Array.isArray(v) ? (v as StoredPair[]) : []);

/**
 * Số sao theo số lượt lật: lật hoàn hảo = đúng số cặp. Dư tối đa n/2 lượt => 3 sao, dư tối đa 2n lượt => 2 sao, còn lại 1 sao.
 * Số lượt do FE gửi lên và BE chỉ kiểm hợp lệ (>= số cặp); điểm thưởng nhỏ và chỉ cộng một lần mỗi bài nên không đáng gian lận.
 */
export function starsFor(moves: number, pairCount: number): 1 | 2 | 3 {
  const extra = moves - pairCount;
  if (extra <= Math.ceil(pairCount / 2)) return 3;
  if (extra <= pairCount * 2) return 2;
  return 1;
}

/** Người xem đã chơi ít nhất một ván của bài chưa (chỉ gọi khi bài có trò chơi; bài không có thì không tốn truy vấn nào). */
export async function hasPlayedGame(lessonId: string, userId: string): Promise<boolean> {
  return (await prisma.lessonGamePlay.count({ where: { userId, lessonId } })) > 0;
}

export const gameService = {
  /** Trò chơi của bài cho người xem (học viên và mod+ đều thấy các cặp thẻ), kèm kết quả tốt nhất của chính họ. */
  async get(communityId: string, lessonId: string, userId: string) {
    const { staff } = await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const game = await prisma.lessonGame.findUnique({ where: { lessonId } });
    const pairs = asPairs(game?.pairs);
    if (!game || pairs.length < MIN_GAME_PAIRS) return { game: null, canEdit: staff };
    const best = await prisma.lessonGamePlay.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    return {
      canEdit: staff,
      game: {
        id: game.id,
        pairs,
        pointsPerStar: POINTS_PER_STAR,
        best: best ? { stars: best.stars, moves: best.moves, seconds: best.seconds, plays: best.plays } : null,
      },
    };
  },

  /** Mod+ thay toàn bộ các cặp thẻ. */
  async put(communityId: string, lessonId: string, body: PutGameBody) {
    await classroomService.assertLessonInCommunity(communityId, lessonId);
    if (body.pairs.length === 0) {
      await prisma.lessonGame.deleteMany({ where: { lessonId } });
      return { game: null };
    }
    if (body.pairs.length < MIN_GAME_PAIRS) throw HttpError.badRequest(`Cần ít nhất ${MIN_GAME_PAIRS} cặp thẻ (hoặc xóa hết để tắt trò chơi)`);
    const norm = (s: string) => s.trim().toLowerCase();
    if (new Set(body.pairs.map((p) => norm(p.term))).size !== body.pairs.length) throw HttpError.badRequest('Các thuật ngữ không được trùng nhau');
    if (new Set(body.pairs.map((p) => norm(p.definition))).size !== body.pairs.length) throw HttpError.badRequest('Các định nghĩa không được trùng nhau');
    const existing = await prisma.lessonGame.findUnique({ where: { lessonId } });
    const known = new Set(asPairs(existing?.pairs).map((p) => p.id));
    const seen = new Set<string>();
    const pairs: StoredPair[] = body.pairs.map((p) => {
      const id = p.id && known.has(p.id) && !seen.has(p.id) ? p.id : randomUUID();
      seen.add(id);
      return { id, term: p.term, definition: p.definition };
    });
    const saved = await prisma.lessonGame.upsert({ where: { lessonId }, create: { lessonId, pairs }, update: { pairs } });
    return { game: { id: saved.id, pairCount: pairs.length } };
  },

  /**
   * Học viên nộp kết quả một ván: BE tính số sao, lưu kết quả tốt nhất và cộng điểm ở lần chơi ĐẦU của bài (idempotent theo khóa nghiệp vụ).
   * Phải hoàn thành bài trước mới được nhận điểm (không bỏ qua bài học để chơi game lấy điểm).
   */
  async submitResult(communityId: string, lessonId: string, userId: string, body: ResultBody) {
    await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const game = await prisma.lessonGame.findUnique({ where: { lessonId } });
    const pairs = asPairs(game?.pairs);
    if (!game || pairs.length < MIN_GAME_PAIRS) throw HttpError.notFound('Bài học này chưa có trò chơi');
    if (body.moves < pairs.length) throw HttpError.badRequest('Số lượt lật không hợp lệ');
    const stars = starsFor(body.moves, pairs.length);

    const prev = await prisma.lessonGamePlay.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    const better = !prev || stars > prev.stars || (stars === prev.stars && (body.moves < prev.moves || (body.moves === prev.moves && body.seconds < prev.seconds)));
    const best = better || !prev ? { stars, moves: body.moves, seconds: body.seconds } : { stars: prev.stars, moves: prev.moves, seconds: prev.seconds };
    await prisma.lessonGamePlay.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, ...best },
      update: { ...best, plays: { increment: 1 } },
    });

    let points = 0;
    const completed = (await prisma.lessonProgress.count({ where: { userId, lessonId, completedAt: { not: null } } })) > 0;
    if (completed) {
      const awarded = await pointsService.award(userId, communityId, 'game_play', { type: 'lesson_game', id: lessonId }, stars * POINTS_PER_STAR);
      points = awarded ? awarded.points : 0;
    }
    return { stars, points, best: { ...best, plays: (prev?.plays ?? 0) + 1 }, firstPlay: !prev };
  },
};
