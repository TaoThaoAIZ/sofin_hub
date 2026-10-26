import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Trò chơi lật thẻ cuối bài: chủ cộng đồng nhập cặp thẻ; học viên chơi xong được tính sao + cộng điểm MỘT lần mỗi bài. */
describe('lớp học: trò chơi lật thẻ theo bài học', () => {
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
  const put = (lessonId: string, body: unknown, token = mod.token) => call('PUT', `/lessons/${lessonId}/game`, token, body);
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

  it('validate: <2 cặp, >8 cặp, trùng thuật ngữ/định nghĩa, rỗng chữ; học viên và người ngoài không được sửa', async () => {
    const l = await newLesson();
    assert.equal((await put(l, { pairs: pairs(1) })).status, 400);
    assert.equal((await put(l, { pairs: pairs(9) })).status, 400);
    assert.equal((await put(l, { pairs: [{ term: 'A', definition: 'x' }, { term: 'a', definition: 'y' }] })).status, 400);
    assert.equal((await put(l, { pairs: [{ term: 'A', definition: 'x' }, { term: 'B', definition: 'X' }] })).status, 400);
    assert.equal((await put(l, { pairs: [{ term: '', definition: 'x' }, { term: 'B', definition: 'y' }] })).status, 400);
    assert.equal((await put(l, { pairs: pairs(3) }, a.token)).status, 403);
    assert.equal((await put(l, { pairs: pairs(3) }, stranger.token)).status >= 400, true);
  });

  it('mod lưu 3 cặp: học viên thấy trò chơi + hasGame trên bài; sửa giữ id cũ; gửi rỗng thì xóa', async () => {
    const l = await newLesson();
    assert.equal((await call('GET', `/lessons/${l}`, a.token)).body.data.hasGame, false);
    assert.equal((await call('GET', `/lessons/${l}/game`, a.token)).body.data.game, null);

    const saved = await put(l, { pairs: pairs(3) });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const view = (await call('GET', `/lessons/${l}/game`, a.token)).body.data;
    assert.equal(view.game.pairs.length, 3);
    assert.equal(view.canEdit, false);
    assert.equal(view.game.best, null);
    const detail = (await call('GET', `/lessons/${l}`, a.token)).body.data;
    assert.equal(detail.hasGame, true);
    assert.equal(detail.gamePlayed, false);

    const keep = view.game.pairs[0];
    await put(l, { pairs: [{ id: keep.id, term: keep.term, definition: 'Định nghĩa đã sửa' }, ...pairs(2).map((_p, i) => ({ term: `Mới ${i}`, definition: `Mới đ ${i}` }))] });
    const after2 = (await call('GET', `/lessons/${l}/game`, mod.token)).body.data;
    assert.equal(after2.game.pairs[0].id, keep.id);
    assert.equal(after2.canEdit, true);

    assert.equal((await put(l, { pairs: [] })).status, 200);
    assert.equal((await call('GET', `/lessons/${l}/game`, a.token)).body.data.game, null);
  });

  it('nộp kết quả: tính sao theo số lượt lật, lưu kết quả tốt nhất, chỉ cộng điểm MỘT lần và chỉ khi đã hoàn thành bài', async () => {
    const l = await newLesson();
    await put(l, { pairs: pairs(4) });
    const result = (moves: number, seconds = 30) => call('POST', `/lessons/${l}/game/result`, a.token, { moves, seconds });

    // Lật ít hơn số cặp là không thể; thiếu/sai kiểu dữ liệu bị từ chối.
    assert.equal((await result(3)).status, 400);
    assert.equal((await call('POST', `/lessons/${l}/game/result`, a.token, { moves: 'x' })).status, 400);

    // Chưa hoàn thành bài: có sao nhưng không có điểm.
    const before = await points(a.id);
    const first = await result(12); // dư 8 = 2n => 2 sao
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.data.stars, 2);
    assert.equal(first.body.data.points, 0);
    assert.equal(await points(a.id), before);

    // Hoàn thành bài rồi chơi lại: được cộng điểm đúng một lần.
    await c.call('POST', `${base}/lessons/${l}/complete`, { token: a.token });
    const second = await result(4, 20); // hoàn hảo => 3 sao
    assert.equal(second.body.data.stars, 3);
    assert.equal(second.body.data.points, 6);
    assert.equal(await points(a.id), before + 6 + 3); // 6 điểm game + 3 điểm hoàn thành bài
    assert.equal(second.body.data.best.stars, 3);

    // Chơi tệ hơn: kết quả tốt nhất giữ nguyên, không cộng thêm.
    const third = await result(30, 99);
    assert.equal(third.body.data.stars, 1);
    assert.equal(third.body.data.points, 0);
    assert.equal(third.body.data.best.stars, 3);
    assert.equal(third.body.data.best.moves, 4);
    assert.equal(third.body.data.best.plays, 3);
    assert.equal(await points(a.id), before + 9);

    const detail = (await call('GET', `/lessons/${l}`, a.token)).body.data;
    assert.equal(detail.gamePlayed, true);
    assert.equal((await call('GET', `/lessons/${l}/game`, a.token)).body.data.game.best.stars, 3);
  });

  it('bài chưa có trò chơi: nộp kết quả 404; người ngoài cộng đồng bị chặn', async () => {
    const l = await newLesson();
    assert.equal((await call('POST', `/lessons/${l}/game/result`, a.token, { moves: 4, seconds: 1 })).status, 404);
    await put(l, { pairs: pairs(3) });
    assert.equal((await call('GET', `/lessons/${l}/game`, stranger.token)).status >= 400, true);
    assert.equal((await call('POST', `/lessons/${l}/game/result`, stranger.token, { moves: 3, seconds: 1 })).status >= 400, true);
  });
});
