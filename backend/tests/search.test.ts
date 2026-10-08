import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

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
    assert.ok(await rl.hit('k'));
    assert.ok(await rl.hit('k'));
    assert.equal(await rl.hit('k'), false);
    assert.ok(await rl.hit('other'));
    t = 1001;
    assert.ok(await rl.hit('k'));
  });
});

/* ------------------------------------------------------------------------------------------------
 * STEP 8: tìm kiếm chạy hoàn toàn trong Postgres (tsvector GENERATED + GIN + pg_trgm).
 * ---------------------------------------------------------------------------------------------- */
describe('tìm kiếm Postgres: toàn văn + trigram', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let db: Awaited<ReturnType<typeof useTestDb>>;
  let n = 0;
  const uniq = (p: string) => `${p}${Date.now().toString(36)}${n++}`.replace(/[^a-z0-9]/g, '');

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  async function mkCourse(over: Record<string, unknown> = {}) {
    const id = uniq('c');
    await db.prisma.community.create({
      data: {
        id,
        title: `Khóa ${id}`,
        description: 'Mô tả',
        category: 'tech',
        thumbnail: 'x',
        instructorName: 'GV',
        instructorRole: 'Mentor',
        ...over,
      } as never,
    });
    return id;
  }
  const join = (userId: string, courseId: string, role: 'member' | 'mod' | 'admin' | 'owner' = 'member') =>
    db.prisma.enrollment.create({ data: { userId, communityId: courseId, role } });
  const search = (token: string, qs: string) => c.call('GET', `/search?${qs}`, { token });
  const ids = (r: { body: { data: Array<{ id: string }> } }) => r.body.data.map((x) => x.id);

  it('sf_fold trong SQL khớp normalizeText của JS (Đ/đ, dấu tổ hợp, chữ hoa)', async () => {
    const { normalizeText } = await import('../src/modules/search/search.text.js');
    for (const s of ['Đường Việt Nhiếp Ảnh', 'ĐẸP Ơ Ư', 'Nhiếp ảnh', 'Crème Brûlée Ñandú']) {
      const [r] = await db.prisma.$queryRaw<{ f: string }[]>`SELECT sf_fold(${s}) AS f`;
      assert.equal(r!.f, normalizeText(s), s);
    }
  });

  it('không phân biệt dấu ở cả hai chiều (khóa học + bài viết)', async () => {
    const u = await c.registerUser('acc');
    const tag = uniq('zz');
    const course = await mkCourse({ title: `Nhiếp ảnh Đường phố ${tag}`, description: 'Học chụp ảnh đường phố' });
    await join(u.id, course);
    await db.prisma.post.create({ data: { communityId: course, authorId: u.id, content: `Mình vừa chụp bức ảnh Hoàng hôn ${tag}` } });

    for (const q of [`nhiep anh duong pho ${tag}`, `NHIẾP ẢNH ĐƯỜNG PHỐ ${tag}`, `Nhiếp ảnh ${tag}`]) {
      assert.ok(ids(await search(u.token, `type=courses&q=${encodeURIComponent(q)}`)).includes(course), q);
    }
    for (const q of [`hoang hon ${tag}`, `HOÀNG HÔN ${tag}`]) {
      const r = await search(u.token, `type=posts&courseId=${course}&q=${encodeURIComponent(q)}`);
      assert.equal(r.body.meta.total, 1, q);
      assert.ok(r.body.data[0].snippet.some((s: any) => s.match));
    }
    // Khớp theo từ không cần liền nhau (khác bản cũ: chỉ khớp cả cụm liền)
    const r = await search(u.token, `type=posts&courseId=${course}&q=${encodeURIComponent(`${tag} chup anh`)}`);
    assert.equal(r.body.meta.total, 1);
    assert.ok(r.body.data[0].snippet.some((s: any) => s.match), 'tô đậm theo từ đơn khi cụm không liền nhau');
  });

  it('chịu gõ sai (pg_trgm) cho tên khóa học và tên thành viên; từ quá ngắn thì không nới lỏng', async () => {
    const u = await c.registerUser('typo');
    const tag = uniq('qq');
    const course = await mkCourse({ title: `Photography Masterclass ${tag}` });
    await join(u.id, course);
    await db.prisma.user.update({ where: { id: u.id }, data: { firstName: 'Nguyễn', lastName: `Hoàng Trường ${tag}` } });

    for (const q of ['fotography', 'photograpy', 'photogrphy', 'Photografy']) {
      assert.ok(ids(await search(u.token, `type=courses&q=${q}`)).includes(course), `typo ${q}`);
    }
    assert.ok(!ids(await search(u.token, 'type=courses&q=zzzxxqqwwkk')).includes(course));
    const m = await search(u.token, `type=members&q=${encodeURIComponent('hoang trueng')}`);
    assert.ok(m.body.data.some((x: any) => x.id === u.id && x.courseId === course), 'gõ sai tên thành viên');
    // 3 ký tự: chỉ khớp chuỗi con/tiền tố, không fuzzy
    assert.ok(!ids(await search(u.token, 'type=courses&q=phx')).includes(course));
  });

  it('xếp hạng: chỉ khóa có từ khóa trong TÊN được tìm thấy (mô tả không tính); reduced luôn xếp sau', async () => {
    const u = await c.registerUser('rank');
    const w = uniq('quokka');
    const inDesc = await mkCourse({ title: 'Khóa A', description: `Có nhắc tới ${w} một lần`, createdAt: new Date('2030-01-01') });
    const inTitle = await mkCourse({ title: `Học ${w} cơ bản`, description: 'Mô tả khác', createdAt: new Date('2020-01-01') });
    const reducedTitle = await mkCourse({ title: `${w} ${w} ${w}`, searchVisibility: 'reduced' });
    const r = await search(u.token, `type=courses&q=${w}`);
    assert.deepEqual(ids(r), [inTitle, reducedTitle]);
    assert.ok(!ids(r).includes(inDesc), 'khóa chỉ có từ khóa ở mô tả không được trả');
    assert.equal(r.body.counts.courses, 2);
  });

  it('phân trang vượt giới hạn 1.000 bài cũ: bài rất cũ vẫn tìm được, trang cuối chính xác', async () => {
    const u = await c.registerUser('big');
    const course = await mkCourse();
    await join(u.id, course);
    const w = uniq('filler');
    const old = uniq('ancient');
    const now = Date.now();
    await db.prisma.post.createMany({
      data: Array.from({ length: 1100 }, (_, i) => ({ communityId: course, authorId: u.id, content: `bài số ${i} ${w}`, createdAt: new Date(now - i * 1000) })),
    });
    await db.prisma.post.create({ data: { communityId: course, authorId: u.id, content: `bài cổ ${old} ${w}`, createdAt: new Date('2001-01-01') } });

    const hit = await search(u.token, `type=posts&courseId=${course}&q=${old}`);
    assert.equal(hit.body.meta.total, 1);
    const p22 = await search(u.token, `type=posts&courseId=${course}&q=${w}&limit=50&page=22`);
    assert.equal(p22.body.meta.total, 1101);
    assert.equal(p22.body.meta.totalPages, 23);
    assert.equal(p22.body.data.length, 50);
    const p23 = await search(u.token, `type=posts&courseId=${course}&q=${w}&limit=50&page=23`);
    assert.equal(p23.body.data.length, 1);
    const seen = new Set([...ids(p22), ...ids(p23)]);
    assert.equal(seen.size, 51, 'không trùng giữa các trang');
    assert.ok((await search(u.token, `type=posts&courseId=${course}&q=${w}&limit=50&page=24`)).body.data.length === 0);
  });

  it('bài ẩn: chỉ mod+ thấy (tác giả thường không thấy trong tìm kiếm); bài bị gỡ: không ai thấy; tìm theo thẻ và tên tác giả', async () => {
    const author = await c.registerUser('auth');
    const mod = await c.registerUser('modx');
    const other = await c.registerUser('oth');
    const course = await mkCourse();
    await join(author.id, course);
    await join(mod.id, course, 'mod');
    await join(other.id, course);
    const w = uniq('vis');
    const mk = (extra: Record<string, unknown>) => db.prisma.post.create({ data: { communityId: course, authorId: author.id, content: `nội dung ${w}`, ...extra } });
    const shown = await mk({});
    const hidden = await mk({ hidden: true });
    const removed = await mk({ hidden: true, removedAt: new Date() });
    const w2 = uniq('tg');
    const tagged = await mk({ content: 'không có từ khóa', tags: [`#${w2}`] });

    assert.deepEqual(ids(await search(other.token, `type=posts&q=${w}`)).sort(), [shown.id].sort());
    assert.deepEqual(ids(await search(author.token, `type=posts&q=${w}`)), [shown.id]);
    assert.deepEqual(ids(await search(mod.token, `type=posts&q=${w}`)).sort(), [shown.id, hidden.id].sort());
    assert.ok(!ids(await search(mod.token, `type=posts&q=${w}`)).includes(removed.id));
    assert.deepEqual(ids(await search(other.token, `type=posts&q=${w2}`)), [tagged.id]);
    // tên tác giả (user có lastName = 'auth')
    const byAuthor = await search(other.token, `type=posts&courseId=${course}&q=auth`);
    assert.ok(ids(byAuthor).includes(shown.id));
    assert.equal(byAuthor.body.data[0].author, 'Test auth');
  });

  it('phạm vi: cộng đồng riêng tư/bị cấm/bị khóa/đã xóa; courses chỉ công khai + active + không hidden', async () => {
    const me = await c.registerUser('scope');
    const w = uniq('scp');
    const mkPost = (communityId: string, authorId = me.id) => db.prisma.post.create({ data: { communityId, authorId, content: `bài ${w}` } });

    const priv = await mkCourse({ title: `Riêng ${w}`, visibility: 'private' });
    const banned = await mkCourse({ title: `Bị cấm ${w}` });
    const locked = await mkCourse({ title: `Khóa ${w}`, locked: true });
    const deleted = await mkCourse({ title: `Xóa ${w}`, deletedAt: new Date() });
    const unlisted = await mkCourse({ title: `Unlisted ${w}`, discoveryStatus: 'unlisted' });
    const hiddenSearch = await mkCourse({ title: `Hidden ${w}`, searchVisibility: 'hidden' });
    const suspended = await mkCourse({ title: `Suspended ${w}`, moderationStatus: 'suspended' });
    const pub = await mkCourse({ title: `Công khai ${w}` });
    for (const id of [priv, banned, locked, deleted, pub]) await join(me.id, id);
    await db.prisma.communityBan.create({ data: { communityId: banned, userId: me.id } });
    const stranger = await c.registerUser('strg');
    for (const id of [priv, pub, banned]) await mkPost(id);
    await join(stranger.id, pub);
    await mkPost(locked);
    await mkPost(deleted);

    const posts = await search(me.token, `type=posts&q=${w}`);
    assert.deepEqual([...new Set(posts.body.data.map((x: any) => x.courseId))].sort(), [priv, pub].sort(), 'chỉ cộng đồng đang là thành viên, chưa bị cấm/khóa/xóa');
    const courses = ids(await search(stranger.token, `type=courses&q=${w}`));
    assert.deepEqual([...courses].sort(), [pub, unlisted, banned].sort(), 'private/locked/deleted/hidden/suspended không có trong tìm khóa học (khóa công khai mà user bị cấm vẫn hiện)');
    assert.ok(![hiddenSearch, suspended].some((x) => courses.includes(x)));
    // người lạ không thấy bài ở cộng đồng riêng tư
    assert.equal((await search(stranger.token, `type=posts&q=${w}`)).body.data.every((x: any) => x.courseId === pub), true);
    // thành viên bị cấm không còn xuất hiện trong tìm thành viên
    const mem = await search(stranger.token, `type=members&courseId=${pub}&q=scope`);
    assert.ok(mem.body.data.some((x: any) => x.id === me.id));
    await db.prisma.communityBan.create({ data: { communityId: pub, userId: me.id } });
    assert.ok(!(await search(stranger.token, `type=members&courseId=${pub}&q=scope`)).body.data.some((x: any) => x.id === me.id));
    // courseId chỉ định: 403 nếu bị cấm
    assert.equal((await search(me.token, `type=posts&courseId=${pub}&q=${w}`)).status, 403);
  });

  it('thành viên: role admin/member, handle, link và tìm theo handle (phần tên)', async () => {
    const me = await c.registerUser('mem');
    const adm = await c.registerUser('boss');
    const course = await mkCourse();
    await join(me.id, course);
    await join(adm.id, course, 'owner');
    const r = await search(me.token, `type=members&courseId=${course}&q=boss`);
    const item = r.body.data.find((x: any) => x.id === adm.id);
    assert.equal(item.role, 'admin');
    assert.equal(item.courseId, course);
    assert.match(item.handle, /^test-boss-\d{4}$/);
    assert.equal(item.link, `/courses/${course}/community?tab=members`);
    const byHandle = await search(me.token, `type=members&courseId=${course}&q=test-boss`);
    assert.ok(ids(byHandle).includes(adm.id));
  });

  it('ký tự đặc biệt của LIKE (% _ \\) được xem là chữ thường; q chỉ toàn dấu câu không gây lỗi', async () => {
    const u = await c.registerUser('lk');
    const w = uniq('pct');
    const a = await mkCourse({ title: `Giảm ${w} 5%% ngay` });
    const b = await mkCourse({ title: `Giảm ${w} 5xx ngay` });
    assert.deepEqual(ids(await search(u.token, `type=courses&q=${encodeURIComponent('%%')}`)).filter((x) => [a, b].includes(x)), [a], '% không phải ký tự đại diện');
    assert.deepEqual(ids(await search(u.token, `type=courses&q=${encodeURIComponent('__')}`)).filter((x) => [a, b].includes(x)), [], '_ không phải ký tự đại diện');
    assert.equal((await search(u.token, `type=courses&q=${encodeURIComponent('--')}`)).status, 200);
    assert.equal((await search(u.token, `type=courses&q=${encodeURIComponent("o'brien & (x)")}`)).status, 200);
    assert.equal((await search(u.token, `type=courses&q=${encodeURIComponent('a\\b_c')}`)).status, 200);
  });

  it('suggest: truy vấn LIMIT 5 riêng, xen kẽ courses → members → posts', async () => {
    const u = await c.registerUser('sgx');
    const w = uniq('sug');
    for (let i = 0; i < 4; i++) await mkCourse({ title: `Gợi ý ${w} ${i}` });
    const course = await mkCourse({ title: `Cộng đồng ${w}` });
    await join(u.id, course);
    await db.prisma.user.update({ where: { id: u.id }, data: { firstName: `Ten${w}` } });
    for (let i = 0; i < 3; i++) await db.prisma.post.create({ data: { communityId: course, authorId: u.id, content: `bài ${i} ${w}` } });
    const r = await c.call('GET', `/search/suggest?q=${w}`, { token: u.token });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.length, 5);
    assert.deepEqual(r.body.data.slice(0, 3).map((x: any) => x.type), ['course', 'member', 'post']);
    assert.equal(r.body.data[3].type, 'course');
    assert.equal(r.body.data[4].type, 'post');
  });

  it('ghép trang trải qua nhiều nhóm: courses → members → posts, counts khớp, không trùng/sót', async () => {
    const u = await c.registerUser('mix');
    const w = uniq('mixed');
    const course = await mkCourse({ title: `Nhóm ${w}` });
    await join(u.id, course);
    await db.prisma.user.update({ where: { id: u.id }, data: { firstName: w } });
    await mkCourse({ title: `Khác ${w}` });
    for (let i = 0; i < 3; i++) await db.prisma.post.create({ data: { communityId: course, authorId: u.id, content: `p${i} ${w}` } });
    const all: Array<{ type: string; id: string }> = [];
    for (let page = 1; page <= 4; page++) {
      const r = await search(u.token, `q=${w}&limit=2&page=${page}`);
      assert.deepEqual(r.body.counts, { courses: 2, members: 1, posts: 3 });
      assert.equal(r.body.meta.total, 6);
      assert.equal(r.body.meta.totalPages, 3);
      all.push(...r.body.data);
    }
    assert.deepEqual(all.map((x) => x.type), ['course', 'course', 'member', 'post', 'post', 'post']);
  });
});
