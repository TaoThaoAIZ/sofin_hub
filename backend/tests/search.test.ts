import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('tìm kiếm toàn cục', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  const COURSE = 'photo';

  before(async () => {
    server = await startTestServer();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  it('401 khi thiếu token; 400 khi q quá ngắn/dài/thiếu', async () => {
    assert.equal((await c.call('GET', '/search?q=abc')).status, 401);
    assert.equal((await c.call('GET', '/search/suggest?q=abc')).status, 401);
    const u = await c.registerUser('s0');
    assert.equal((await c.call('GET', '/search?q=a', { token: u.token })).status, 400);
    assert.equal((await c.call('GET', '/search', { token: u.token })).status, 400);
    assert.equal((await c.call('GET', `/search?q=${'x'.repeat(101)}`, { token: u.token })).status, 400);
    assert.equal((await c.call('GET', '/search?q=abc&type=foo', { token: u.token })).status, 400);
    assert.equal((await c.call('GET', '/search/suggest?q=a', { token: u.token })).status, 400);
  });

  it('khóa học: khớp không phân biệt dấu/hoa thường, snippet là segment (không HTML)', async () => {
    const u = await c.registerUser('s1');
    const all = await c.call('GET', '/courses?limit=50', { token: u.token });
    const target = all.body.data.find((x: any) => /[^\x00-\x7f]/.test(x.title)) ?? all.body.data[0];
    const word = target.title.split(' ').find((w: string) => w.length >= 3) as string;
    const plain = word.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();

    const r = await c.call('GET', `/search?type=courses&q=${encodeURIComponent(plain)}`, { token: u.token });
    assert.equal(r.status, 200);
    const hit = r.body.data.find((x: any) => x.id === target.id);
    assert.ok(hit, 'phải tìm thấy khóa học dù gõ không dấu / viết hoa');
    assert.equal(hit.type, 'course');
    assert.ok(hit.title.some((s: any) => s.match === true));
    assert.equal(hit.title.map((s: any) => s.text).join('').replace(/…/g, ''), target.title);
    assert.ok(!JSON.stringify(hit).includes('<mark'));
  });

  it('posts & members: không thấy nếu chưa tham gia; courseId không phải thành viên -> 403; courseId không có -> 404', async () => {
    const u = await c.registerUser('s2');
    const none = await c.call('GET', '/search?q=xin&type=posts', { token: u.token });
    assert.equal(none.status, 200);
    assert.equal(none.body.meta.total, 0);
    assert.equal((await c.call('GET', `/search?q=xin&courseId=${COURSE}`, { token: u.token })).status, 403);
    assert.equal((await c.call('GET', '/search?q=xin&courseId=khong-co', { token: u.token })).status, 404);
  });

  it('thành viên tìm thấy bài viết và thành viên trong cộng đồng của mình, có snippet đánh dấu', async () => {
    const a = await c.registerUser('poster');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: a.token });
    const marker = `Zebra${Date.now()}`;
    const p = await c.call('POST', `/courses/${COURSE}/posts`, { token: a.token, body: { content: `Chào cả nhà, mình mới thử ${marker} hôm nay` } });
    assert.equal(p.status, 201);

    const r = await c.call('GET', `/search?type=posts&courseId=${COURSE}&q=${marker.toLowerCase()}`, { token: a.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.meta.total, 1);
    const item = r.body.data[0];
    assert.equal(item.type, 'post');
    assert.equal(item.courseId, COURSE);
    assert.ok(item.snippet.some((s: any) => s.match && s.text.toLowerCase() === marker.toLowerCase()));

    // Người ngoài cộng đồng không thấy bài đó
    const outsider = await c.registerUser('outsider');
    const o = await c.call('GET', `/search?type=posts&q=${marker}`, { token: outsider.token });
    assert.equal(o.body.meta.total, 0);

    // Tìm thành viên theo tên (user đăng ký có lastName = tiền tố 'poster')
    const m = await c.call('GET', `/search?type=members&courseId=${COURSE}&q=poster`, { token: a.token });
    assert.equal(m.status, 200);
    assert.ok(m.body.data.some((x: any) => x.type === 'member' && x.id === a.id));
    assert.equal(m.body.counts.posts, 0);
  });

  it('suggest trả tối đa 5 mục gộp', async () => {
    const u = await c.registerUser('sg');
    await c.call('POST', `/courses/${COURSE}/enroll`, { token: u.token });
    const r = await c.call('GET', '/search/suggest?q=sg', { token: u.token });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length <= 5);
    const wide = await c.call('GET', '/search/suggest?q=an', { token: u.token });
    assert.ok(wide.body.data.length <= 5);
  });

  it('phân trang meta hợp lệ', async () => {
    const u = await c.registerUser('pg');
    const r = await c.call('GET', '/search?type=courses&q=ng&limit=2&page=1', { token: u.token });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.length <= 2);
    assert.equal(r.body.meta.limit, 2);
  });
});

describe('tiện ích tìm kiếm', () => {
  it('normalizeText + makeSnippet đánh dấu đúng đoạn có dấu', async () => {
    const { normalizeText, makeSnippet } = await import('../src/modules/search/search.text.js');
    assert.equal(normalizeText('Đường Việt'), 'duong viet');
    const segs = makeSnippet('Học Nhiếp Ảnh cơ bản', normalizeText('nhiep anh'));
    assert.deepEqual(segs.filter((s) => s.match).map((s) => s.text), ['Nhiếp Ảnh']);
    assert.equal(segs.map((s) => s.text).join(''), 'Học Nhiếp Ảnh cơ bản');
    const html = makeSnippet('<b>hi</b> script', 'hi');
    assert.ok(html.some((s) => s.text.includes('<b>')), 'HTML được giữ nguyên dạng text, FE tự escape');
  });

  it('rate limiter chặn khi vượt hạn mức và mở lại sau cửa sổ', async () => {
    const { createRateLimiter } = await import('../src/modules/search/search.ratelimit.js');
    let t = 0;
    const rl = createRateLimiter(2, 1000, () => t);
    assert.ok(rl.hit('k'));
    assert.ok(rl.hit('k'));
    assert.equal(rl.hit('k'), false);
    assert.ok(rl.hit('other'));
    t = 1001;
    assert.ok(rl.hit('k'));
  });
});
