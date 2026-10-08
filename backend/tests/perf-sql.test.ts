import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ensureMainCourse, makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/** STEP 8 / §6.4: FK index, N+1, keyset pagination, tổng hợp trong SQL, rải thông báo theo lô. */
describe('hiệu năng SQL (§6.4)', () => {
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
    const id = uniq('p');
    await db.prisma.community.create({
      data: { id, title: `Khóa ${id}`, description: 'Mô tả', category: 'tech', thumbnail: 'x', instructorName: 'GV', instructorRole: 'M', ...over } as never,
    });
    return id;
  }
  const join = (userId: string, communityId: string, role: 'member' | 'mod' | 'admin' | 'owner' = 'member') => db.prisma.enrollment.create({ data: { userId, communityId, role } });

  it('mọi khóa ngoại đều có index dẫn đầu bằng cột FK (không còn FK trần)', async () => {
    const rows = await db.prisma.$queryRaw<{ tbl: string; cols: string[] }[]>`
      SELECT c.conrelid::regclass::text AS tbl, array_agg(a.attname::text ORDER BY a.attnum) AS cols
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      WHERE c.contype = 'f' AND c.connamespace = current_schema()::regnamespace
        AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey)
      GROUP BY c.oid, c.conrelid`;
    assert.deepEqual(rows, [], `FK chưa có index: ${JSON.stringify(rows)}`);
  });

  it('cột searchVector là GENERATED (ghi bằng Prisma không cần biết tới) và index GIN/trigram tồn tại', async () => {
    const idx = await db.prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`;
    const names = new Set(idx.map((r) => r.indexname));
    for (const need of ['Course_searchVector_idx', 'Post_searchVector_idx', 'User_searchVector_idx', 'Course_title_trgm_idx', 'User_name_trgm_idx', 'Post_tagsnorm_gin_idx', 'Post_courseId_pinned_likesCount_createdAt_idx']) {
      assert.ok(names.has(need), `thiếu index ${need}`);
    }
    const id = await mkCourse({ title: 'Đổi tên được' });
    await db.prisma.community.update({ where: { id }, data: { title: 'Tên khác hẳn' } });
    const [r] = await db.prisma.$queryRaw<{ ok: boolean }[]>`SELECT ("searchVector" @@ to_tsquery('simple', 'khac:*')) AS ok FROM "Course" WHERE id = ${id}`;
    assert.equal(r!.ok, true, 'searchVector tự cập nhật khi đổi title');
  });

  describe('GET /conversations', () => {
    it('một truy vấn: chưa đọc, tin cuối, người đã xóa, chặn; keyset limit/cursor; cursor sai -> 400', async () => {
      const me = await c.registerUser('cv');
      const others = await Promise.all([0, 1, 2, 3, 4].map((i) => c.registerUser(`cvo${i}`)));
      const convs: string[] = [];
      for (const [i, o] of others.entries()) {
        const [a, b] = me.id < o.id ? [me.id, o.id] : [o.id, me.id];
        const conv = await db.prisma.conversation.create({ data: { userAId: a, userBId: b, lastMessageAt: new Date(Date.now() - (5 - i) * 60_000) } });
        convs.push(conv.id);
        await db.prisma.message.createMany({ data: [{ conversationId: conv.id, senderId: o.id, content: `a${i}` }, { conversationId: conv.id, senderId: o.id, content: `b${i}` }] });
      }
      // other[4] mới nhất; xóa tài khoản other[0]; chặn other[1]; thu hồi tin cuối của other[2]; me đã đọc other[3]
      await db.prisma.user.update({ where: { id: others[0]!.id }, data: { deletedAt: new Date() } });
      await db.prisma.userBlock.create({ data: { blockerId: me.id, targetId: others[1]!.id } });
      await db.prisma.message.updateMany({ where: { conversationId: convs[2], content: 'b2' }, data: { deletedAt: new Date(), content: '' } });
      const last3 = await db.prisma.message.findFirstOrThrow({ where: { conversationId: convs[3] }, orderBy: { seq: 'desc' } });
      await db.prisma.$executeRaw`UPDATE "Conversation" SET "readSeqA" = ${last3.seq}, "readSeqB" = ${last3.seq} WHERE id = ${convs[3]}`;

      const all = await c.call('GET', '/conversations', { token: me.token });
      assert.equal(all.status, 200);
      assert.deepEqual(all.body.data.map((x: any) => x.id), [...convs].reverse(), 'mới hoạt động trước');
      assert.deepEqual(all.body.meta, { hasMore: false, nextCursor: null });
      const byId = new Map<string, any>(all.body.data.map((x: any) => [x.id, x]));
      assert.equal(byId.get(convs[0]!).other.name, 'Thành viên đã xóa');
      assert.equal(byId.get(convs[1]!).blockedByMe, true);
      assert.equal(byId.get(convs[4]!).blockedByMe, false);
      assert.equal(byId.get(convs[2]!).lastMessage.deleted, true);
      assert.equal(byId.get(convs[2]!).unreadCount, 1, 'tin đã thu hồi không tính chưa đọc');
      assert.equal(byId.get(convs[3]!).unreadCount, 0);
      assert.equal(byId.get(convs[4]!).unreadCount, 2);
      assert.equal(byId.get(convs[4]!).lastMessage.content, 'b4');
      assert.deepEqual(Object.keys(byId.get(convs[4]!)).sort(), ['blockedByMe', 'id', 'lastMessageAt', 'lastMessage', 'other', 'unreadCount'].sort());

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i++) {
        const r: any = await c.call('GET', `/conversations?limit=2${cursor ? `&cursor=${cursor}` : ''}`, { token: me.token });
        assert.equal(r.status, 200);
        seen.push(...r.body.data.map((x: any) => x.id));
        cursor = r.body.meta.nextCursor;
        if (!cursor) break;
      }
      assert.deepEqual(seen, [...convs].reverse(), 'cursor duyệt đủ, không trùng/sót');
      assert.equal((await c.call('GET', '/conversations?cursor=garbage', { token: me.token })).status, 400);
      assert.equal((await c.call('GET', '/conversations?limit=0', { token: me.token })).status, 400);
    });
  });

  describe('feed: keyset cursor', () => {
    it('không trùng/sót khi có bài mới chen vào đầu; page cũ vẫn hoạt động; ghim lên đầu', async () => {
      const u = await c.registerUser('fd');
      const course = await mkCourse();
      await join(u.id, course);
      const base = Date.now() - 1_000_000;
      const mk = async (i: number, extra: Record<string, unknown> = {}) =>
        (await db.prisma.post.create({ data: { communityId: course, authorId: u.id, content: `p${i}`, createdAt: new Date(base + i * 1000), ...extra } })).id;
      const ids: string[] = [];
      for (let i = 0; i < 12; i++) ids.push(await mk(i));
      const pinned = await mk(100, { pinned: true, createdAt: new Date(base - 99_999) });

      const first = await c.call('GET', `/courses/${course}/posts?limit=5`, { token: u.token });
      assert.equal(first.status, 200);
      assert.deepEqual(first.body.data.map((x: any) => x.id), [pinned, ...ids.slice(7).reverse()].slice(0, 5));
      assert.equal(first.body.meta.total, 13);
      assert.equal(first.body.meta.hasMore, true);
      assert.ok(first.body.meta.nextCursor);
      // bài mới chen vào đầu giữa 2 lần tải (offset sẽ lặp bài)
      const fresh = await mk(500, { createdAt: new Date(base + 500_000) });
      const second = await c.call('GET', `/courses/${course}/posts?limit=5&cursor=${first.body.meta.nextCursor}`, { token: u.token });
      const third = await c.call('GET', `/courses/${course}/posts?limit=5&cursor=${second.body.meta.nextCursor}`, { token: u.token });
      const walked = [...first.body.data, ...second.body.data, ...third.body.data].map((x: any) => x.id);
      assert.equal(new Set(walked).size, walked.length, 'không trùng');
      assert.deepEqual(walked, [pinned, ...ids.slice().reverse()], 'đủ 13 bài cũ, không sót; bài mới chen vào không làm lệch');
      assert.ok(!walked.includes(fresh));
      assert.equal(third.body.meta.hasMore, false);
      assert.equal(third.body.meta.nextCursor, null);

      const page2 = await c.call('GET', `/courses/${course}/posts?limit=5&page=2`, { token: u.token });
      assert.equal(page2.status, 200);
      assert.equal(page2.body.meta.page, 2);
      assert.equal(page2.body.data.length, 5);
      assert.equal((await c.call('GET', `/courses/${course}/posts?cursor=bad`, { token: u.token })).status, 400);
      // cursor của sort khác bị từ chối
      assert.equal((await c.call('GET', `/courses/${course}/posts?sort=popular&cursor=${first.body.meta.nextCursor}`, { token: u.token })).status, 400);
    });

    it('sort=popular + category + tag dùng cùng đường keyset', async () => {
      const u = await c.registerUser('fp');
      const course = await mkCourse();
      await join(u.id, course);
      const base = Date.now() - 1_000_000;
      const ids: string[] = [];
      for (let i = 0; i < 9; i++) {
        ids.push((await db.prisma.post.create({
          data: { communityId: course, authorId: u.id, content: `q${i}`, likesCount: i % 3, createdAt: new Date(base + i * 1000), tags: i % 2 ? ['#Alpha ', 'x'] : ['beta'], category: i < 4 ? 'qa' : 'general' },
        })).id);
      }
      const walk = async (qs: string) => {
        const out: string[] = [];
        let cursor: string | null = null;
        for (let i = 0; i < 10; i++) {
          const r: any = await c.call('GET', `/courses/${course}/posts?limit=2${qs}${cursor ? `&cursor=${cursor}` : ''}`, { token: u.token });
          assert.equal(r.status, 200, JSON.stringify(r.body));
          out.push(...r.body.data.map((x: any) => x.id));
          cursor = r.body.meta.nextCursor;
          if (!cursor) break;
        }
        return out;
      };
      const popular = await walk('&sort=popular');
      const rows = await db.prisma.post.findMany({ where: { communityId: course } });
      const want = rows.sort((a, b) => b.likesCount - a.likesCount || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id)).map((r) => r.id);
      assert.deepEqual(popular, want);
      const tagged = await walk('&tag=alpha');
      assert.deepEqual(tagged.sort(), ids.filter((_, i) => i % 2).sort(), 'tag chuẩn hóa (bỏ #, trim, chữ thường)');
      const qa = await walk('&category=H%E1%BB%8Fi%20%C4%91%C3%A1p');
      assert.deepEqual(qa.sort(), ids.slice(0, 4).sort());
    });
  });

  describe('bình luận: limit/cursor', () => {
    it('mặc định trả hết (<=100) với meta; phân trang cũ → mới; ẩn chỉ mod/tác giả thấy', async () => {
      const author = await c.registerUser('ca');
      const other = await c.registerUser('co');
      const mod = await c.registerUser('cm');
      const course = await mkCourse();
      await join(author.id, course);
      await join(other.id, course);
      await join(mod.id, course, 'mod');
      const post = await db.prisma.post.create({ data: { communityId: course, authorId: author.id, content: 'bài' } });
      const base = Date.now() - 100_000;
      const cm: string[] = [];
      for (let i = 0; i < 7; i++) {
        cm.push((await db.prisma.postComment.create({ data: { postId: post.id, authorId: i === 3 ? other.id : author.id, content: `c${i}`, createdAt: new Date(base + i * 1000), hidden: i === 3 || i === 5 } })).id);
      }
      const asOther = await c.call('GET', `/posts/${post.id}/comments`, { token: other.token });
      assert.equal(asOther.status, 200);
      assert.deepEqual(asOther.body.data.map((x: any) => x.id), [cm[0], cm[1], cm[2], cm[3], cm[4], cm[6]], 'người xem thấy bình luận ẩn của chính mình, không thấy của người khác');
      assert.deepEqual(asOther.body.meta, { limit: 100, hasMore: false, nextCursor: null });
      assert.equal(asOther.body.data[0].author.name, 'Test ca');
      const asMod = await c.call('GET', `/posts/${post.id}/comments`, { token: mod.token });
      assert.equal(asMod.body.data.length, 7);

      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 6; i++) {
        const r: any = await c.call('GET', `/posts/${post.id}/comments?limit=3${cursor ? `&cursor=${cursor}` : ''}`, { token: mod.token });
        seen.push(...r.body.data.map((x: any) => x.id));
        cursor = r.body.meta.nextCursor;
        if (!cursor) break;
      }
      assert.deepEqual(seen, cm);
      assert.equal((await c.call('GET', `/posts/${post.id}/comments?cursor=zzz`, { token: mod.token })).status, 400);
      assert.equal((await c.call('GET', `/posts/${post.id}/comments?limit=500`, { token: mod.token })).status, 400);
    });
  });

  describe('bình chọn: gộp trong SQL', () => {
    it('đếm theo lựa chọn, số người bầu, lựa chọn của viewer; multiple; đổi phiếu', async () => {
      const [a, b, d] = await Promise.all([c.registerUser('v1'), c.registerUser('v2'), c.registerUser('v3')]);
      const course = await mkCourse();
      for (const u of [a, b, d]) await join(u.id, course);
      const created = await c.call('POST', `/courses/${course}/posts`, { token: a.token, body: { content: 'poll', poll: { question: 'Q?', options: ['x', 'y', 'z'], multiple: true } } });
      assert.equal(created.status, 201);
      const [ox, oy, oz] = created.body.data.poll.options.map((o: any) => o.id);
      const post = created.body.data.id;
      const vote = (t: string, ids: string[]) => c.call('POST', `/posts/${post}/poll/vote`, { token: t, body: { optionIds: ids } });
      await vote(a.token, [ox, oy]);
      await vote(b.token, [oy]);
      const r = await vote(d.token, [oz, oy]);
      assert.equal(r.status, 200);
      const p = r.body.data.poll;
      assert.deepEqual(p.options.map((o: any) => o.count), [1, 3, 1]);
      assert.equal(p.totalVoters, 3);
      assert.deepEqual(p.viewerVotes, [oy, oz], 'theo thứ tự lựa chọn của poll');
      await vote(b.token, [ox]);
      const feed = await c.call('GET', `/courses/${course}/posts`, { token: b.token });
      const fp = feed.body.data.find((x: any) => x.id === post).poll;
      assert.deepEqual(fp.options.map((o: any) => o.count), [2, 2, 1]);
      assert.deepEqual(fp.viewerVotes, [ox]);
      assert.equal(fp.totalVoters, 3);
    });
  });

  describe('lớp học: không nạp cả khóa', () => {
    it('prev/next đúng, module khóa vẫn 403, tiến độ trả bài kế tiếp, bài của khóa khác 404', async () => {
      const u = await c.registerUser('cl');
      const course = await mkCourse();
      const other = await mkCourse();
      await join(u.id, course);
      await join(u.id, other);
      const mods: string[] = [];
      for (let m = 1; m <= 2; m++) {
        const mod = await db.prisma.classroomModule.create({ data: { communityId: course, learningCourseId: await ensureMainCourse(db.prisma, course), index: m, title: `M${m}`, description: '' } });
        mods.push(mod.id);
        await db.prisma.classroomLesson.createMany({ data: [1, 2].map((i) => ({ moduleId: mod.id, communityId: course, index: i, title: `L${m}.${i}`, type: 'text' as const, durationMin: 1, body: `body ${m}.${i}` })) });
      }
      const lessons = await db.prisma.classroomLesson.findMany({ where: { communityId: course }, orderBy: [{ module: { index: 'asc' } }, { index: 'asc' }] });
      const get = (id: string, courseId = course) => c.call('GET', `/courses/${courseId}/lessons/${id}`, { token: u.token });
      const l11 = await get(lessons[0]!.id);
      assert.equal(l11.status, 200);
      assert.equal(l11.body.data.body, 'body 1.1');
      assert.equal(l11.body.data.prevLessonId, null);
      assert.equal(l11.body.data.nextLessonId, lessons[1]!.id);
      assert.equal(l11.body.data.moduleTitle, 'M1');
      assert.equal((await get(lessons[2]!.id)).status, 403, 'module 2 khóa tới khi xong module 1');
      assert.equal((await get(lessons[0]!.id, other)).status, 404, 'bài thuộc khóa khác');
      const prog = await c.call('GET', `/courses/${course}/progress`, { token: u.token });
      assert.deepEqual(prog.body.data.nextLesson, { id: lessons[0]!.id, title: 'L1.1', moduleId: mods[0] });
      assert.equal(prog.body.data.totalLessons, 4);
      for (const l of lessons.slice(0, 2)) assert.equal((await c.call('POST', `/courses/${course}/lessons/${l.id}/complete`, { token: u.token })).status, 200);
      const l21 = await get(lessons[2]!.id);
      assert.equal(l21.status, 200);
      assert.equal(l21.body.data.prevLessonId, lessons[1]!.id);
      assert.equal(l21.body.data.nextLessonId, lessons[3]!.id);
      const prog2 = await c.call('GET', `/courses/${course}/progress`, { token: u.token });
      assert.equal(prog2.body.data.nextLesson.id, lessons[2]!.id);
      assert.equal(prog2.body.data.percent, 50);
    });

    it('/me/enrollments gộp: progressPct đúng, bỏ cộng đồng đã xóa, role/enrolledAt giữ nguyên', async () => {
      const u = await c.registerUser('me');
      const a = await mkCourse();
      const b = await mkCourse();
      const gone = await mkCourse({ deletedAt: new Date() });
      for (const id of [a, b, gone]) await join(u.id, id, id === a ? 'mod' : 'member');
      const mod = await db.prisma.classroomModule.create({ data: { communityId: a, learningCourseId: await ensureMainCourse(db.prisma, a), index: 1, title: 'M', description: '' } });
      await db.prisma.classroomLesson.createMany({ data: [1, 2, 3, 4].map((i) => ({ moduleId: mod.id, communityId: a, index: i, title: `l${i}`, type: 'text' as const, durationMin: 1, body: '' })) });
      const ls = await db.prisma.classroomLesson.findMany({ where: { communityId: a }, orderBy: { index: 'asc' } });
      await db.prisma.lessonProgress.createMany({ data: [{ userId: u.id, lessonId: ls[0]!.id, completedAt: new Date() }, { userId: u.id, lessonId: ls[1]!.id, completedAt: null }] });
      const r = await c.call('GET', '/me/enrollments', { token: u.token });
      assert.equal(r.status, 200);
      const items = r.body.data as any[];
      assert.deepEqual(items.map((x) => x.course.id).sort(), [a, b].sort());
      const ia = items.find((x) => x.course.id === a);
      assert.equal(ia.progressPct, 25);
      assert.equal(ia.role, 'mod');
      assert.deepEqual(Object.keys(ia).sort(), ['course', 'enrolledAt', 'progressPct', 'role']);
      assert.equal(items.find((x) => x.course.id === b).progressPct, 0);
    });
  });

  describe('thông báo theo lô (không còn cắt 200 người / nạp cả cộng đồng)', () => {
    it('sự kiện mới: MỌI thành viên (450) đều nhận, trừ người tạo và người bị cấm', async () => {
      const host = await c.registerUser('eh');
      const course = await mkCourse();
      await join(host.id, course, 'owner');
      const people = Array.from({ length: 450 }, (_, i) => ({ id: `evm-${n}-${i}`, email: `evm-${n}-${i}@bulk.test`, firstName: 'B', lastName: `m${i}`, passwordHash: 'x' }));
      await db.prisma.user.createMany({ data: people });
      await db.prisma.enrollment.createMany({ data: people.map((p) => ({ userId: p.id, communityId: course })) });
      await db.prisma.communityBan.create({ data: { communityId: course, userId: people[0]!.id } });
      const startAt = new Date(Date.now() + 86_400_000).toISOString();
      const r = await c.call('POST', `/courses/${course}/events`, { token: host.token, body: { title: 'Họp lớn', startAt } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      const { flushNotifications } = await import('../src/modules/notifications/notifications.service.js');
      let count = 0;
      for (let i = 0; i < 50; i++) {
        await flushNotifications();
        count = await db.prisma.notification.count({ where: { communityId: course, type: 'event_created' } });
        if (count >= 449) break;
        await new Promise((res) => setTimeout(res, 100));
      }
      assert.equal(count, 449, '450 thành viên - 1 người bị cấm (host không nhận)');
      assert.equal(await db.prisma.notification.count({ where: { communityId: course, type: 'event_created', userId: host.id } }), 0);
    });

    it('xin vào cộng đồng riêng tư: chỉ owner/admin THẬT được báo (lọc trong SQL)', async () => {
      const owner = await c.registerUser('jo');
      const admin = await c.registerUser('ja');
      const mod = await c.registerUser('jm');
      const asker = await c.registerUser('jr');
      const course = await mkCourse({ visibility: 'private', ownerId: owner.id });
      await join(owner.id, course, 'owner');
      await join(admin.id, course, 'admin');
      await join(mod.id, course, 'mod');
      await db.prisma.user.create({ data: { id: `demo-${n}`, email: `demo-${n}@x.test`, firstName: 'D', lastName: 'Demo', passwordHash: 'x', isDemo: true } });
      await join(`demo-${n}`, course, 'admin');
      const r = await c.call('POST', `/courses/${course}/join-requests`, { token: asker.token, body: { message: 'cho em vào' } });
      assert.ok(r.status < 300, JSON.stringify(r.body));
      const { flushNotifications } = await import('../src/modules/notifications/notifications.service.js');
      await flushNotifications();
      const got = await db.prisma.notification.findMany({ where: { communityId: course }, select: { userId: true } });
      assert.deepEqual(got.map((x) => x.userId).sort(), [owner.id, admin.id].sort());
    });
  });

  describe('GET /courses?q chạy trong SQL', () => {
    it('không phân biệt dấu/hoa thường, CHỈ theo tiêu đề (không mô tả/tên giảng viên); hidden bị loại; không q vẫn như cũ', async () => {
      const u = await c.registerUser('cq');
      const w = uniq('zorb');
      const a = await mkCourse({ title: `Nhiếp ảnh ${w}` });
      const b = await mkCourse({ title: 'Khác', description: `mô tả có ${w}` });
      const d = await mkCourse({ title: 'Khác nữa', instructorName: `Thầy ${w}` });
      const hidden = await mkCourse({ title: `Ẩn ${w}`, searchVisibility: 'hidden' });
      const r = await c.call('GET', `/courses?q=${encodeURIComponent(`NHIẾP ${w}`)}&limit=50`, { token: u.token });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body.data.map((x: any) => x.id), [a]);
      const all = await c.call('GET', `/courses?q=${w}&limit=50`, { token: u.token });
      // Chỉ khớp tiêu đề: khóa chỉ có từ khóa ở mô tả (b) hoặc tên giảng viên (d) KHÔNG xuất hiện.
      assert.deepEqual(all.body.data.map((x: any) => x.id), [a]);
      assert.ok(!all.body.data.some((x: any) => x.id === hidden || x.id === b || x.id === d));
      assert.equal(all.body.meta.total, 1);
      assert.equal((await c.call('GET', '/courses?limit=3', { token: u.token })).body.data.length, 3);
    });
  });
});
