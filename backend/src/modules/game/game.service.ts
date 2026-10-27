import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import { classroomService } from '../classroom/classroom.service.js';
import { pointsService } from '../points/points.service.js';

export const MIN_GAME_PAIRS = 2;
export const MAX_GAME_PAIRS = 8;
/** Số trò chơi tối đa gắn vào một bài. */
export const MAX_GAMES_PER_LESSON = 6;
/** Điểm thưởng cho mỗi sao (chơi xong lần đầu của từng trò chơi; giá trị tạm, chỉnh ở đây). */
export const POINTS_PER_STAR = 2;

/** memory = lật thẻ · match = nối cặp · swipe = đúng/sai · scramble = xếp từ (term = từ cần xếp, definition = gợi ý). */
export const GAME_KINDS = ['memory', 'match', 'swipe', 'scramble'] as const;
export type GameKind = (typeof GAME_KINDS)[number];

type StoredPair = { id: string; term: string; definition: string };

const pair = z.strictObject({
  /** Giữ id cũ khi sửa để không đổi cặp đã có. */
  id: z.string().trim().min(1).max(64).optional(),
  term: z.string().trim().min(1, 'Nhập thuật ngữ').max(80, 'Thuật ngữ tối đa 80 ký tự'),
  definition: z.string().trim().min(1, 'Nhập định nghĩa').max(160, 'Định nghĩa tối đa 160 ký tự'),
});

const gameInput = z.strictObject({
  /** Giữ id cũ (cùng loại) để không mất kết quả của học viên. */
  id: z.string().trim().min(1).max(64).optional(),
  kind: z.enum(GAME_KINDS),
  pairs: z.array(pair).max(MAX_GAME_PAIRS, `Tối đa ${MAX_GAME_PAIRS} cặp mỗi trò chơi`),
});

/** Thay toàn bộ trò chơi của bài; `games` rỗng = bài không có trò chơi. */
export const putGamesBody = z.strictObject({ games: z.array(gameInput).max(MAX_GAMES_PER_LESSON, `Tối đa ${MAX_GAMES_PER_LESSON} trò chơi mỗi bài`) });
export type PutGamesBody = z.infer<typeof putGamesBody>;

export const resultBody = z.strictObject({
  moves: z.number().int().min(1).max(1000),
  seconds: z.number().int().min(0).max(86_400),
});
export type ResultBody = z.infer<typeof resultBody>;

/** Xếp từ cần ít nhất 2 mảnh khác nhau để xáo trộn được: nhiều từ => các từ; một từ => các chữ cái. */
export function scrambleable(term: string): boolean {
  const words = term.trim().split(/\s+/);
  const tiles = words.length > 1 ? words : [...words[0]!];
  return new Set(tiles.map((t) => t.toLowerCase())).size >= 2;
}

const asPairs = (v: unknown): StoredPair[] => (Array.isArray(v) ? (v as StoredPair[]) : []);

/**
 * Số sao theo số lượt (lật/nối/trả lời/kiểm tra): hoàn hảo = đúng số cặp. Dư tối đa n/2 lượt => 3 sao, dư tối đa 2n lượt => 2 sao, còn lại 1 sao.
 * Số lượt do FE gửi lên và BE chỉ kiểm hợp lệ (>= số cặp); điểm thưởng nhỏ và chỉ cộng một lần mỗi bài nên không đáng gian lận.
 */
export function starsFor(moves: number, pairCount: number): 1 | 2 | 3 {
  const extra = moves - pairCount;
  if (extra <= Math.ceil(pairCount / 2)) return 3;
  if (extra <= pairCount * 2) return 2;
  return 1;
}

/** Người xem đã chơi ít nhất một trò chơi của bài chưa (chỉ gọi khi bài có trò chơi; bài không có thì không tốn truy vấn nào). */
export async function hasPlayedGame(lessonId: string, userId: string): Promise<boolean> {
  return (await prisma.lessonGamePlay.count({ where: { userId, lessonId } })) > 0;
}

const playable = (g: { pairs: unknown }) => asPairs(g.pairs).length >= MIN_GAME_PAIRS;

export const gameService = {
  /** Các trò chơi của bài cho người xem (học viên và mod+ đều thấy nội dung), kèm kết quả tốt nhất của chính họ ở từng trò chơi. */
  async list(communityId: string, lessonId: string, userId: string) {
    const { staff } = await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const games = (await prisma.lessonGame.findMany({ where: { lessonId }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })).filter(playable);
    if (games.length === 0) return { games: [], canEdit: staff };
    const plays = await prisma.lessonGamePlay.findMany({ where: { userId, lessonId } });
    const bestOf = new Map(plays.map((p) => [p.gameId, p]));
    return {
      canEdit: staff,
      games: games.map((g) => {
        const best = bestOf.get(g.id);
        return {
          id: g.id,
          kind: g.kind as GameKind,
          pairs: asPairs(g.pairs),
          pointsPerStar: POINTS_PER_STAR,
          best: best ? { stars: best.stars, moves: best.moves, seconds: best.seconds, plays: best.plays } : null,
        };
      }),
    };
  },

  /** Mod+ thay toàn bộ trò chơi của bài (thứ tự mảng = thứ tự hiển thị). Trò chơi không còn trong danh sách bị xóa cùng kết quả của nó. */
  async put(communityId: string, lessonId: string, body: PutGamesBody) {
    await classroomService.assertLessonInCommunity(communityId, lessonId);
    const norm = (s: string) => s.trim().toLowerCase();
    body.games.forEach((g, i) => {
      const label = `Trò chơi ${i + 1}`;
      if (g.pairs.length < MIN_GAME_PAIRS) throw HttpError.badRequest(`${label}: cần ít nhất ${MIN_GAME_PAIRS} cặp`);
      if (new Set(g.pairs.map((p) => norm(p.term))).size !== g.pairs.length) throw HttpError.badRequest(`${label}: các thuật ngữ không được trùng nhau`);
      // Lật thẻ/nối cặp: hai thẻ có cùng chữ sẽ không phân biệt được nên định nghĩa phải khác nhau.
      if ((g.kind === 'memory' || g.kind === 'match') && new Set(g.pairs.map((p) => norm(p.definition))).size !== g.pairs.length) throw HttpError.badRequest(`${label}: các định nghĩa không được trùng nhau`);
      if (g.kind === 'scramble' && g.pairs.some((p) => !scrambleable(p.term))) throw HttpError.badRequest(`${label}: từ cần xếp phải có ít nhất 2 chữ cái (hoặc 2 từ) khác nhau`);
    });

    const existing = await prisma.lessonGame.findMany({ where: { lessonId } });
    const byId = new Map(existing.map((g) => [g.id, g]));
    const seenGame = new Set<string>();
    const rows = body.games.map((g, position) => {
      const old = g.id ? byId.get(g.id) : undefined;
      const keep = !!old && old.kind === g.kind && !seenGame.has(old.id);
      const id = keep ? old.id : randomUUID();
      seenGame.add(id);
      const known = new Set(keep ? asPairs(old.pairs).map((p) => p.id) : []);
      const seenPair = new Set<string>();
      const pairs: StoredPair[] = g.pairs.map((p) => {
        const pid = p.id && known.has(p.id) && !seenPair.has(p.id) ? p.id : randomUUID();
        seenPair.add(pid);
        return { id: pid, term: p.term, definition: p.definition };
      });
      return { id, kind: g.kind, position, pairs };
    });
    await prisma.$transaction([
      prisma.lessonGame.deleteMany({ where: { lessonId, id: { notIn: rows.map((r) => r.id) } } }),
      ...rows.map((r) =>
        prisma.lessonGame.upsert({ where: { id: r.id }, create: { lessonId, ...r }, update: { kind: r.kind, position: r.position, pairs: r.pairs } }),
      ),
    ]);
    return { games: rows.map((r) => ({ id: r.id, kind: r.kind, pairCount: r.pairs.length })) };
  },

  /**
   * Học viên nộp kết quả một ván của MỘT trò chơi: BE tính số sao, lưu kết quả tốt nhất và cộng điểm ở lần chơi ĐẦU của trò chơi đó (idempotent theo khóa nghiệp vụ).
   * Phải hoàn thành bài trước mới được nhận điểm (không bỏ qua bài học để chơi game lấy điểm).
   */
  async submitResult(communityId: string, lessonId: string, gameId: string, userId: string, body: ResultBody) {
    await classroomService.assertLessonAccessible(communityId, lessonId, userId);
    const game = await prisma.lessonGame.findFirst({ where: { id: gameId, lessonId } });
    const pairs = asPairs(game?.pairs);
    if (!game || pairs.length < MIN_GAME_PAIRS) throw HttpError.notFound('Trò chơi không tồn tại');
    if (body.moves < pairs.length) throw HttpError.badRequest('Số lượt không hợp lệ');
    const stars = starsFor(body.moves, pairs.length);

    const key = { userId_gameId: { userId, gameId } };
    const prev = await prisma.lessonGamePlay.findUnique({ where: key });
    const better = !prev || stars > prev.stars || (stars === prev.stars && (body.moves < prev.moves || (body.moves === prev.moves && body.seconds < prev.seconds)));
    const best = better || !prev ? { stars, moves: body.moves, seconds: body.seconds } : { stars: prev.stars, moves: prev.moves, seconds: prev.seconds };
    await prisma.lessonGamePlay.upsert({
      where: key,
      create: { userId, gameId, lessonId, ...best },
      update: { ...best, plays: { increment: 1 } },
    });

    let points = 0;
    const completed = (await prisma.lessonProgress.count({ where: { userId, lessonId, completedAt: { not: null } } })) > 0;
    if (completed) {
      const awarded = await pointsService.award(userId, communityId, 'game_play', { type: 'lesson_game', id: gameId }, stars * POINTS_PER_STAR);
      points = awarded ? awarded.points : 0;
    }
    return { stars, points, best: { ...best, plays: (prev?.plays ?? 0) + 1 }, firstPlay: !prev };
  },
};
