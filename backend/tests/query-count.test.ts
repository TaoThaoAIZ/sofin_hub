import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import pg from 'pg';
import { ensureMainCourse, makeClient, startTestServer, useTestDb, type TestServer } from './helpers.js';

/**
 * Đo số truy vấn SQL thật gửi tới Postgres (patch pg.Client.query — mọi truy vấn của Prisma qua adapter-pg đều đi qua đây)
 * cho các điểm nóng ở STEP 8 / §6.4. Test vừa là số liệu để ghi vào docs vừa là hàng rào chống tái phát N+1:
 * các ngưỡng bên dưới chặt hơn nhiều so với bản cũ (xem backend/docs/DATABASE.md, mục "Số truy vấn trước/sau").
 */
let sink: string[] | null = null;
const original = pg.Client.prototype.query;
(pg.Client.prototype as { query: unknown }).query = function (this: unknown, ...args: unknown[]) {
  if (sink) {
    const a = args[0] as string | { text?: string } | undefined;
    sink.push(typeof a === 'string' ? a : (a?.text ?? ''));
  }
  return (original as (...x: unknown[]) => unknown).apply(this, args);
};

const NOISE = /^\s*(BEGIN|COMMIT|ROLLBACK|SET |SHOW )/i;
async function measure<T>(fn: () => Promise<T>): Promise<{ result: T; n: number; sqls: string[] }> {
  sink = [];
  try {
    const result = await fn();
    const sqls = sink.filter((s) => !NOISE.test(s));
    return { result, n: sqls.length, sqls };
  } finally {
    sink = null;
  }
}
/** QC_BASELINE=1: chỉ in số liệu, không ép ngưỡng. */
const atMost = (n: number, max: number, msg: string) => {
  if (!process.env.QC_BASELINE) assert.ok(n <= max, `${msg} dùng ${n} truy vấn (tối đa ${max})`);
};
const report = (label: string, n: number) => console.log(`[query-count] ${label}: ${n}`);

describe('số truy vấn SQL ở các điểm nóng', () => {
  let server: TestServer;
  let c: ReturnType<typeof makeClient>;
  let db: Awaited<ReturnType<typeof useTestDb>>;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
  });
  after(() => server.close());

  it('tìm kiếm: 3 cộng đồng x 20 thành viên x 120 bài', async () => {
    const me = await c.registerUser('qcs');
    const courses = ['qcs1', 'qcs2', 'qcs3'];
    for (const id of courses) {
      await db.prisma.community.create({ data: { id, title: `Nhom ${id}`, description: 'Mo ta', category: 'tech', thumbnail: 'x', instructorName: 'GV', instructorRole: 'M' } });
      await db.prisma.enrollment.create({ data: { userId: me.id, communityId: id } });
      await db.prisma.post.createMany({
        data: Array.from({ length: 120 }, (_, i) => ({ communityId: id, authorId: me.id, content: `bai ${i} ve nhiep anh khong gian ${i % 7 === 0 ? 'hello' : ''}`, createdAt: new Date(Date.now() - i * 1000) })),
      });
    }
    const extra = await Promise.all(Array.from({ length: 19 }, (_, i) => c.registerUser(`qcm${i}`)));
    for (const id of courses) await db.prisma.enrollment.createMany({ data: extra.map((u) => ({ userId: u.id, communityId: id })) });

    const { createSearchService } = await import('../src/modules/search/search.service.js');
    const fresh = createSearchService();
    const q = { q: 'hello', type: 'all' as const, page: 1, limit: 10 };
    const after = await measure(() => fresh.search(me.id, q));
    report('search (mới)', after.n);
    const sugg = await measure(() => fresh.suggest(me.id, 'hello'));
    report('suggest (mới)', sugg.n);
    atMost(after.n, 8, 'search');
    atMost(sugg.n, 6, 'suggest');
    assert.equal(after.result.counts.posts, 3 * 18);
  });

  it('GET /conversations với 20 hội thoại', async () => {
    const me = await c.registerUser('qcc');
    const others = await Promise.all(Array.from({ length: 20 }, (_, i) => c.registerUser(`qco${i}`)));
    for (const o of others) {
      const [a, b] = me.id < o.id ? [me.id, o.id] : [o.id, me.id];
      const conv = await db.prisma.conversation.create({ data: { userAId: a, userBId: b } });
      await db.prisma.message.createMany({ data: [1, 2, 3].map((i) => ({ conversationId: conv.id, senderId: o.id, content: `tin ${i}` })) });
    }
    const r = await measure(() => c.call('GET', '/conversations', { token: me.token }));
    report('GET /conversations (20 hội thoại)', r.n);
    assert.equal(r.result.status, 200);
    assert.equal(r.result.body.data.length, 20);
    assert.ok(r.result.body.data.every((x: any) => x.unreadCount === 3 && x.lastMessage?.content === 'tin 3'));
    atMost(r.n, 4, 'GET /conversations');
  });

  it('mở 1 bài học (400 bài x 5KB nội dung) và GET /me/enrollments (8 cộng đồng)', async () => {
    const me = await c.registerUser('qcl');
    const ids: string[] = [];
    for (let k = 0; k < 8; k++) {
      const id = `qcl${k}`;
      ids.push(id);
      await db.prisma.community.create({ data: { id, title: `Lop ${id}`, description: 'Mo ta', category: 'tech', thumbnail: 'x', instructorName: 'GV', instructorRole: 'M' } });
      await db.prisma.enrollment.create({ data: { userId: me.id, communityId: id } });
      for (let m = 1; m <= 4; m++) {
        const mod = await db.prisma.classroomModule.create({ data: { communityId: id, learningCourseId: await ensureMainCourse(db.prisma, id), index: m, title: `M${m}`, description: '' } });
        await db.prisma.classroomLesson.createMany({
          data: Array.from({ length: 12 }, (_, i) => ({ moduleId: mod.id, communityId: id, index: i + 1, title: `Bai ${m}.${i + 1}`, type: 'text' as const, durationMin: 5, body: 'x'.repeat(5000) })),
        });
      }
    }
    const first = await db.prisma.classroomLesson.findFirstOrThrow({ where: { communityId: 'qcl0', index: 1, module: { index: 1 } }, select: { id: true } });
    const r = await measure(() => c.call('GET', `/courses/qcl0/lessons/${first.id}`, { token: me.token }));
    report('GET /courses/:id/lessons/:lessonId', r.n);
    if (process.env.QC_SQL) console.log(r.sqls.map((q) => q.replace(/\s+/g, ' ').slice(0, 110)).join('\n'));
    assert.equal(r.result.status, 200);
    assert.equal(r.result.body.data.id, first.id);
    assert.equal(r.result.body.data.prevLessonId, null);
    assert.ok(typeof r.result.body.data.nextLessonId === 'string');
    atMost(r.n, 11, 'mở bài học');
    // Không còn nạp thân bài của cả khóa: không truy vấn nào lấy cột body của nhiều bài.
    const bodyLoads = r.sqls.filter((s) => /"ClassroomLesson"/.test(s) && /"body"/.test(s) && !/WHERE[\s\S]*"id"\s*=/.test(s) && !/LIMIT/i.test(s));
    if (!process.env.QC_BASELINE) assert.equal(bodyLoads.length, 0, 'không được SELECT body của cả khóa');
    else console.log(`[query-count] truy vấn nạp body cả khóa: ${bodyLoads.length}`);

    const e = await measure(() => c.call('GET', '/me/enrollments', { token: me.token }));
    report('GET /me/enrollments (8 cộng đồng)', e.n);
    assert.equal(e.result.status, 200);
    assert.equal(e.result.body.data.length, 8);
    atMost(e.n, 7, '/me/enrollments');
  });
});
