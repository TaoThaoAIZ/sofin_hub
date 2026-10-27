import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Trò chơi cuối bài (lật thẻ/nối cặp/đúng-sai/xếp từ): một bài gắn được nhiều trò chơi; học viên chơi xong được tính sao + cộng điểm MỘT lần mỗi trò chơi. */
describe('lớp học: trò chơi theo bài học', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const base = '/courses/photo';
  let mod: { token: string; id: string };
  let a: { token: string; id: string };
  let stranger: { token: string; id: string };

  const call = (method: string, path: string, token: string, body?: unknown) => c.call(method, base + path, { token, body });
  const newLesson = async () => {
    for (const m of (await call('GET', '/modules', mod.token)).body.data) await call('DELETE', `/modules/${m.id}`, mod.token);
    const moduleId = (await call('POST', '/modules', mod.token, { title: 'M', description: 'd' })).body.data.id as string;
    return (await call('POST', `/modules/${moduleId}/lessons`, mod.token, { title: 'L', type: 'text', durationMin: 1, body: 'noi dung bai hoc du dai de luu duoc' })).body.data.id as string;
  };
  const pairs = (n: number) => Array.from({ length: n }, (_, i) => ({ term: `Thuật ngữ ${i + 1}`, definition: `Định nghĩa số ${i + 1}` }));
  const game = (n: number, kind = 'memory') => ({ kind, pairs: pairs(n) });
  const put = (lessonId: string, games: unknown[], token = mod.token) => call('PUT', `/lessons/${lessonId}/games`, token, { games });
  const points = async (userId: string) => {
    const { pointsService } = await import('../src/modules/points/points.service.js');
    return pointsService.totalFor('photo', userId, 'all');
  };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    mod = await c.registerUser('gmmod');
    a = await c.registerUser('gma');
    stranger = await c.registerUser('gmstr');
    for (const u of [mod, a]) await enrollmentService.grant(u.id, 'photo');
    await enrollmentService.setRole(mod.id, 'photo', 'mod');
  });
  beforeEach(() => undefined);
  after(() => server.close());

  it('validate: <2 cặp, >8 cặp, >6 trò chơi, trùng thuật ngữ/định nghĩa, từ xếp không xáo được; học viên và người ngoài không được sửa', async () => {
    const l = await newLesson();
    assert.equal((await put(l, [game(1)])).status, 400);
    assert.equal((await put(l, [game(9)])).status, 400);
    assert.equal((await put(l, Array.from({ length: 7 }, () => game(2)))).status, 400);
    assert.equal((await put(l, [{ kind: 'nope', pairs: pairs(2) }])).status, 400);
    assert.equal((await put(l, [{ kind: 'memory', pairs: [{ term: 'A', definition: 'x' }, { term: 'a', definition: 'y' }] }])).status, 400);
    assert.equal((await put(l, [{ kind: 'memory', pairs: [{ term: 'A', definition: 'x' }, { term: 'B', definition: 'X' }] }])).status, 400);
    assert.equal((await put(l, [{ kind: 'memory', pairs: [{ term: '', definition: 'x' }, { term: 'B', definition: 'y' }] }])).status, 400);
    // Đúng/Sai và Xếp từ cho phép trùng định nghĩa (không có thẻ nào bị lẫn); Xếp từ cần từ xáo được.
    assert.equal((await put(l, [{ kind: 'swipe', pairs: [{ term: 'A', definition: 'x' }, { term: 'B', definition: 'x' }] }])).status, 200);
    assert.equal((await put(l, [{ kind: 'scramble', pairs: [{ term: 'aaa', definition: 'x' }, { term: 'Hà Nội', definition: 'y' }] }])).status, 400);
    assert.equal((await put(l, [{ kind: 'scramble', pairs: [{ term: 'mèo', definition: 'x' }, { term: 'Hà Nội', definition: 'y' }] }])).status, 200);
    assert.equal((await put(l, [game(3)], a.token)).status, 403);
    assert.equal((await put(l, [game(3)], stranger.token)).status >= 400, true);
  });

  it('mod lưu nhiều trò chơi: học viên thấy đủ + hasGame; sửa giữ id (cùng loại); gửi rỗng thì xóa', async () => {
    const l = await newLesson();
    assert.equal((await call('GET', `/lessons/${l}`, a.token)).body.data.hasGame, false);
    assert.equal((await call('GET', `/lessons/${l}/games`, a.token)).body.data.games.length, 0);

    const saved = await put(l, [game(3, 'memory'), game(4, 'match'), game(2, 'swipe'), game(3, 'scramble')]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const view = (await call('GET', `/lessons/${l}/games`, a.token)).body.data;
    assert.deepEqual(view.games.map((g: { kind: string }) => g.kind), ['memory', 'match', 'swipe', 'scramble']);
    assert.equal(view.games[1].pairs.length, 4);
    assert.equal(view.canEdit, false);
    assert.equal(view.games[0].best, null);
    const detail = (await call('GET', `/lessons/${l}`, a.token)).body.data;
    assert.equal(detail.hasGame, true);
    assert.equal(detail.gamePlayed, false);

    // Sửa: đổi thứ tự, giữ id game + id cặp; đổi loại thì game mới (id mới); bỏ game thì mất.
    const [g0, g1, g2] = view.games;
    const keep = g1.pairs[0];
    await put(l, [
      { id: g1.id, kind: 'match', pairs: [{ id: keep.id, term: keep.term, definition: 'Định nghĩa đã sửa' }, ...pairs(2).map((_p, i) => ({ term: `Mới ${i}`, definition: `Mới đ ${i}` }))] },
      { id: g0.id, kind: 'swipe', pairs: pairs(3) },
    ]);
    const after2 = (await call('GET', `/lessons/${l}/games`, mod.token)).body.data;
    assert.equal(after2.canEdit, true);
    assert.equal(after2.games.length, 2);
    assert.equal(after2.games[0].id, g1.id);
    assert.equal(after2.games[0].pairs[0].id, keep.id);
    assert.notEqual(after2.games[1].id, g0.id);
    assert.equal(after2.games.some((g: { id: string }) => g.id === g2.id), false);

    assert.equal((await put(l, [])).status, 200);
    assert.equal((await call('GET', `/lessons/${l}/games`, a.token)).body.data.games.length, 0);
    assert.equal((await call('GET', `/lessons/${l}`, a.token)).body.data.hasGame, false);
  });

  it('nộp kết quả: tính sao theo số lượt, lưu tốt nhất từng trò chơi, chỉ cộng điểm MỘT lần mỗi trò chơi và chỉ khi đã hoàn thành bài', async () => {
    const l = await newLesson();
    await put(l, [game(4, 'memory'), game(4, 'match')]);
    const [g1, g2] = (await call('GET', `/lessons/${l}/games`, a.token)).body.data.games as { id: string }[];
    const result = (gameId: string, moves: number, seconds = 30) => call('POST', `/lessons/${l}/games/${gameId}/result`, a.token, { moves, seconds });

    // Ít lượt hơn số cặp là không thể; thiếu/sai kiểu dữ liệu bị từ chối.
    assert.equal((await result(g1!.id, 3)).status, 400);
    assert.equal((await call('POST', `/lessons/${l}/games/${g1!.id}/result`, a.token, { moves: 'x' })).status, 400);

    // Chưa hoàn thành bài: có sao nhưng không có điểm.
    const before = await points(a.id);
    const first = await result(g1!.id, 12); // dư 8 = 2n => 2 sao
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.stars, 2);
    assert.equal(first.body.data.points, 0);
    assert.equal(await points(a.id), before);

    // Hoàn thành bài rồi chơi lại: được cộng điểm đúng một lần.
    await c.call('POST', `${base}/lessons/${l}/complete`, { token: a.token });
    const second = await result(g1!.id, 4, 20); // hoàn hảo => 3 sao
    assert.equal(second.body.data.stars, 3);
    assert.equal(second.body.data.points, 6);
    assert.equal(await points(a.id), before + 6 + 3); // 6 điểm game + 3 điểm hoàn thành bài
    assert.equal(second.body.data.best.stars, 3);

    // Chơi tệ hơn: kết quả tốt nhất giữ nguyên, không cộng thêm.
    const third = await result(g1!.id, 30, 99);
    assert.equal(third.body.data.stars, 1);
    assert.equal(third.body.data.points, 0);
    assert.equal(third.body.data.best.stars, 3);
    assert.equal(third.body.data.best.moves, 4);
    assert.equal(third.body.data.best.plays, 3);
    assert.equal(await points(a.id), before + 9);

    // Trò chơi thứ hai tính điểm riêng.
    const other = await result(g2!.id, 5); // dư 1 <= n/2 => 3 sao
    assert.equal(other.body.data.stars, 3);
    assert.equal(other.body.data.points, 6);
    assert.equal(other.body.data.firstPlay, true);
    assert.equal(await points(a.id), before + 15);

    const detail = (await call('GET', `/lessons/${l}`, a.token)).body.data;
    assert.equal(detail.gamePlayed, true);
    const games = (await call('GET', `/lessons/${l}/games`, a.token)).body.data.games;
    assert.equal(games[0].best.stars, 3);
    assert.equal(games[1].best.moves, 5);
  });

  it('bài/trò chơi không tồn tại: nộp kết quả 404; người ngoài cộng đồng bị chặn', async () => {
    const l = await newLesson();
    assert.equal((await call('POST', `/lessons/${l}/games/khong-co/result`, a.token, { moves: 4, seconds: 1 })).status, 404);
    await put(l, [game(3)]);
    const gid = (await call('GET', `/lessons/${l}/games`, a.token)).body.data.games[0].id as string;
    assert.equal((await call('GET', `/lessons/${l}/games`, stranger.token)).status >= 400, true);
    assert.equal((await call('POST', `/lessons/${l}/games/${gid}/result`, stranger.token, { moves: 3, seconds: 1 })).status >= 400, true);
    // Trò chơi của bài khác không nộp được qua bài này.
    const l2 = await newLesson();
    assert.equal((await call('POST', `/lessons/${l2}/games/${gid}/result`, a.token, { moves: 4, seconds: 1 })).status, 404);
  });
});
