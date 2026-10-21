import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

/** Trắc nghiệm theo bài: không bắt buộc có, nhưng đã có thì phải ĐẠT điểm mới hoàn thành bài (mod+ miễn). */
describe('lớp học: trắc nghiệm theo bài học', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const base = '/courses/photo';
  let mod: { token: string; id: string };
  let a: { token: string; id: string };
  let stranger: { token: string; id: string };

  const call = (method: string, path: string, token: string, body?: unknown) => c.call(method, base + path, { token, body });
  const newModule = async (body: Record<string, unknown> = {}) => (await call('POST', '/modules', mod.token, { title: 'M', description: 'd', ...body })).body.data.id as string;
  const newLesson = async (moduleId: string) => (await call('POST', `/modules/${moduleId}/lessons`, mod.token, { title: 'L', type: 'text', durationMin: 1, body: 'noi dung' })).body.data.id as string;
  const q = (text: string, correctIndex = 0, options = ['A', 'B', 'C']) => ({ text, options, correctIndex });
  const put = (lessonId: string, body: unknown, token = mod.token) => call('PUT', `/lessons/${lessonId}/quiz`, token, body);

  /** Module khóa theo thứ tự: dọn hết module cũ trước mỗi test để module mới luôn là module đầu (không bị khóa vì module trước chưa xong). */
  const reset = async () => {
    for (const m of (await call('GET', '/modules', mod.token)).body.data) await call('DELETE', `/modules/${m.id}`, mod.token);
  };

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
    const { enrollmentService } = await import('../src/modules/enrollments/enrollments.service.js');
    mod = await c.registerUser('qzmod');
    a = await c.registerUser('qza');
    stranger = await c.registerUser('qzstr');
    for (const u of [mod, a]) await enrollmentService.grant(u.id, 'photo');
    await enrollmentService.setRole(mod.id, 'photo', 'mod');
  });
  beforeEach(reset);
  after(() => server.close());

  it('validate: đáp án ngoài danh sách, <2 lựa chọn, lựa chọn trùng, điểm đạt ngoài 1..100; học viên không được sửa', async () => {
    const l = await newLesson(await newModule());
    assert.equal((await put(l, { passPercent: 70, questions: [q('x', 5)] })).status, 400);
    assert.equal((await put(l, { passPercent: 70, questions: [{ text: 'x', options: ['A'], correctIndex: 0 }] })).status, 400);
    assert.equal((await put(l, { passPercent: 70, questions: [q('x', 0, ['A', 'a'])] })).status, 400);
    assert.equal((await put(l, { passPercent: 0, questions: [q('x')] })).status, 400);
    assert.equal((await put(l, { passPercent: 101, questions: [q('x')] })).status, 400);
    assert.equal((await put(l, { passPercent: 70, questions: [q('x')] }, a.token)).status, 403);
    assert.equal((await put('khong-co', { passPercent: 70, questions: [q('x')] })).status, 404);
  });

  it('bài có trắc nghiệm: chưa đạt thì 409 QUIZ_REQUIRED; đạt thì hoàn thành được; bỏ đánh dấu không cần đạt', async () => {
    const l = await newLesson(await newModule());
    const saved = await put(l, { passPercent: 60, questions: [q('1+1?', 1, ['1', '2', '3']), q('2+2?', 2, ['3', '5', '4']), q('3+3?', 0, ['6', '7'])] });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.data.quiz.questionCount, 3);

    // Học viên chỉ thấy câu hỏi + lựa chọn, KHÔNG thấy đáp án đúng.
    const view = (await call('GET', `/lessons/${l}/quiz`, a.token)).body.data;
    assert.equal(view.canEdit, false);
    assert.equal(view.quiz.questions.length, 3);
    assert.equal(JSON.stringify(view).includes('correctIndex'), false);
    assert.equal(view.quiz.passed, false);

    const detail = (await call('GET', `/lessons/${l}`, a.token)).body.data;
    assert.deepEqual(detail.quiz, { questionCount: 3, passPercent: 60, passed: false, required: true });
    const blocked = await call('POST', `/lessons/${l}/complete`, a.token);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.error.code, 'QUIZ_REQUIRED');

    // Sai hết (0/3): không đạt, không lộ đáp án.
    const bad = await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [0, 0, 1] });
    assert.equal(bad.status, 200, JSON.stringify(bad.body));
    assert.equal(bad.body.data.scorePercent, 0);
    assert.equal(bad.body.data.passed, false);
    assert.equal(JSON.stringify(bad.body.data.results).includes('correctIndex'), false);
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).status, 409);

    // Đúng 2/3 = 67% >= 60%: đạt, lúc này mới lộ đáp án đúng.
    const ok = await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [1, 2, null] });
    assert.equal(ok.body.data.scorePercent, 67);
    assert.equal(ok.body.data.passed, true);
    assert.deepEqual(ok.body.data.results.map((r: { correctIndex: number }) => r.correctIndex), [1, 2, 0]);
    const done = await call('POST', `/lessons/${l}/complete`, a.token);
    assert.equal(done.status, 200, JSON.stringify(done.body));
    assert.equal(done.body.data.completed, true);
    assert.equal((await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz.passed, true);
    // Làm lại sai sau khi đã đạt không mất trạng thái đạt; bỏ đánh dấu hoàn thành không bị chặn.
    await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [0, 0, 1] });
    assert.equal((await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz.passed, true);
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).body.data.completed, false);
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).body.data.completed, true);
  });

  it('chấm từng câu: chỉ trả đúng/sai (không lộ đáp án), không ghi lượt làm; câu lạ = 404; người ngoài = 403', async () => {
    const l = await newLesson(await newModule());
    await put(l, { passPercent: 100, questions: [q('1+1?', 1, ['1', '2', '3'])] });
    const qid = (await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz.questions[0].id as string;
    const right = await call('POST', `/lessons/${l}/quiz/check`, a.token, { questionId: qid, answer: 1 });
    assert.equal(right.status, 200, JSON.stringify(right.body));
    assert.deepEqual(right.body.data, { questionId: qid, correct: true });
    const wrong = await call('POST', `/lessons/${l}/quiz/check`, a.token, { questionId: qid, answer: 0 });
    assert.deepEqual(wrong.body.data, { questionId: qid, correct: false });
    assert.equal(JSON.stringify(wrong.body).includes('correctIndex'), false);
    assert.equal((await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz.attempts, 0);
    assert.equal((await call('POST', `/lessons/${l}/quiz/check`, a.token, { questionId: 'khong-co', answer: 0 })).status, 404);
    assert.equal((await call('POST', `/lessons/${l}/quiz/check`, stranger.token, { questionId: qid, answer: 1 })).status, 403);
  });

  it('nộp sai số câu trả lời = 400; bài chưa có trắc nghiệm = 404; người ngoài cộng đồng = 403', async () => {
    const l = await newLesson(await newModule());
    assert.equal((await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [] })).status, 404);
    await put(l, { passPercent: 70, questions: [q('x'), q('y')] });
    assert.equal((await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [0] })).status, 400);
    assert.equal((await call('GET', `/lessons/${l}/quiz`, stranger.token)).status, 403);
    assert.equal((await call('POST', `/lessons/${l}/quiz/attempt`, stranger.token, { answers: [0, 0] })).status, 403);
  });

  it('mod+ thấy đáp án để sửa và cũng phải đạt điểm mới hoàn thành; sửa bộ câu hỏi xóa lượt làm cũ nhưng không hủy bài đã hoàn thành', async () => {
    const l = await newLesson(await newModule());
    await put(l, { passPercent: 100, questions: [q('x', 1)] });
    const staffView = (await call('GET', `/lessons/${l}/quiz`, mod.token)).body.data;
    assert.equal(staffView.canEdit, true);
    assert.equal(staffView.quiz.questions[0].correctIndex, 1);
    assert.equal((await call('GET', `/lessons/${l}`, mod.token)).body.data.quiz.required, true);
    assert.equal((await call('POST', `/lessons/${l}/complete`, mod.token)).status, 409);
    await call('POST', `/lessons/${l}/quiz/attempt`, mod.token, { answers: [1] });
    assert.equal((await call('POST', `/lessons/${l}/complete`, mod.token)).status, 200);

    await call('POST', `/lessons/${l}/quiz/attempt`, a.token, { answers: [1] });
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).status, 200);
    // Sửa câu hỏi: lượt cũ bị xóa (phải làm lại), nhưng bài đã hoàn thành vẫn giữ.
    await put(l, { passPercent: 100, questions: [q('x mới', 0), q('y', 0)] });
    assert.equal((await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz.passed, false);
    assert.equal((await call('GET', `/lessons/${l}`, a.token)).body.data.completed, true);
  });

  it('xóa trắc nghiệm (questions rỗng) thì bài hoàn thành bình thường; bài khóa không làm được trắc nghiệm', async () => {
    const l = await newLesson(await newModule());
    await put(l, { passPercent: 70, questions: [q('x')] });
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).status, 409);
    const del = await put(l, { passPercent: 70, questions: [] });
    assert.equal(del.status, 200);
    assert.equal(del.body.data.quiz, null);
    assert.equal((await call('GET', `/lessons/${l}/quiz`, a.token)).body.data.quiz, null);
    assert.equal((await call('GET', `/lessons/${l}`, a.token)).body.data.quiz, null);
    assert.equal((await call('POST', `/lessons/${l}/complete`, a.token)).status, 200);

    // Module trả phí chưa mua: khóa như xem bài.
    const paid = await newModule({ accessMode: 'paid', priceCents: 50_000 });
    const lp = await newLesson(paid);
    await put(lp, { passPercent: 70, questions: [q('x')] });
    assert.equal((await call('GET', `/lessons/${lp}/quiz`, a.token)).status, 403);
    assert.equal((await call('POST', `/lessons/${lp}/quiz/attempt`, a.token, { answers: [0] })).status, 403);
  });
});
