import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import pg from 'pg';
import { useTestDb, type TestDb } from './helpers.js';

/**
 * Kiểm tra hạ tầng DB: kết nối, migration áp vào schema tạm, CRUD qua Prisma, ràng buộc unique/FK, và schema bị DROP sau test.
 * Cần Postgres đang chạy: `npm run db:up` ở gốc repo.
 */
let db: TestDb;
const started = Date.now();

const user = (email: string) => ({ email, firstName: 'A', lastName: 'B', passwordHash: 'x' });
const course = (id: string) => ({
  id,
  title: 'T',
  description: 'D',
  category: 'hobby' as const,
  thumbnail: '/t.webp',
  instructorName: 'I',
  instructorRole: 'R',
});

before(async () => {
  db = await useTestDb();
});

after(async () => {
  await db.drop();
});

beforeEach(async () => {
  await db.reset();
});

describe('hạ tầng DB', () => {
  it('kết nối được và schema tạm được áp migration nhanh', async () => {
    const [row] = await db.prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    assert.equal(row?.ok, 1);
    assert.match(db.schema, /^test_[a-z0-9]+_[a-z0-9]+$/);
    assert.ok(Date.now() - started < 20000, `provision quá chậm: ${Date.now() - started}ms`);
    const [cnt] = await db.prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_tables WHERE schemaname = ${db.schema}`;
    assert.ok(Number(cnt?.n) >= 35, `chỉ có ${cnt?.n} bảng`);
  });

  it('tạo/đọc User + Course + Enrollment, giá trị mặc định đúng', async () => {
    const u = await db.prisma.user.create({ data: user('a@test.local') });
    assert.equal(u.tokenVersion, 0);
    assert.equal(u.isDemo, false);
    assert.equal(u.emailVerified, false);
    assert.match(u.id, /^[0-9a-f-]{36}$/);

    await db.prisma.course.create({ data: course('photo') });
    await db.prisma.enrollment.create({ data: { userId: u.id, courseId: 'photo', role: 'owner' } });

    const found = await db.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: u.id, courseId: 'photo' } },
      include: { user: true, course: true },
    });
    assert.equal(found?.role, 'owner');
    assert.equal(found?.course.id, 'photo');
    assert.equal(found?.course.pricing, 'paid');
    assert.equal(found?.user.email, 'a@test.local');
  });

  it('ràng buộc unique: email trùng, ghi danh trùng, 1 review / (user, course)', async () => {
    const u = await db.prisma.user.create({ data: user('dup@test.local') });
    await assert.rejects(db.prisma.user.create({ data: user('dup@test.local') }), { code: 'P2002' });

    await db.prisma.course.create({ data: course('c1') });
    const key = { userId: u.id, courseId: 'c1' };
    await db.prisma.enrollment.create({ data: key });
    await assert.rejects(db.prisma.enrollment.create({ data: key }), { code: 'P2002' });

    await db.prisma.review.create({ data: { ...key, rating: 5 } });
    await assert.rejects(db.prisma.review.create({ data: { ...key, rating: 4 } }), { code: 'P2002' });
  });

  it('ràng buộc FK: không ghi danh user/khóa không tồn tại; xóa user cascade', async () => {
    await db.prisma.course.create({ data: course('c2') });
    await assert.rejects(db.prisma.enrollment.create({ data: { userId: 'khong-ton-tai', courseId: 'c2' } }), { code: 'P2003' });

    const u = await db.prisma.user.create({ data: user('fk@test.local') });
    await assert.rejects(db.prisma.enrollment.create({ data: { userId: u.id, courseId: 'khong-co' } }), { code: 'P2003' });

    await db.prisma.enrollment.create({ data: { userId: u.id, courseId: 'c2' } });
    await db.prisma.session.create({ data: { userId: u.id, expiresAt: new Date(Date.now() + 1000) } });
    await db.prisma.user.delete({ where: { id: u.id } });
    assert.equal(await db.prisma.enrollment.count(), 0);
    assert.equal(await db.prisma.session.count(), 0);
    assert.equal(await db.prisma.course.count(), 1);
  });

  it('CHECK của Conversation (userAId < userBId) và Message.seq tự tăng', async () => {
    const a = await db.prisma.user.create({ data: user('a1@test.local') });
    const b = await db.prisma.user.create({ data: user('b1@test.local') });
    const [lo, hi] = [a.id, b.id].sort() as [string, string];
    await assert.rejects(db.prisma.conversation.create({ data: { userAId: hi, userBId: lo } }));
    const conv = await db.prisma.conversation.create({ data: { userAId: lo, userBId: hi } });
    const m1 = await db.prisma.message.create({ data: { conversationId: conv.id, senderId: a.id, content: '1' } });
    const m2 = await db.prisma.message.create({ data: { conversationId: conv.id, senderId: b.id, content: '2' } });
    assert.equal(m2.seq, m1.seq + 1);
  });

  it('tiền lưu Int cent, enum PostCategory map sang tiếng Việt trong DB', async () => {
    const u = await db.prisma.user.create({ data: user('p@test.local') });
    await db.prisma.course.create({ data: { ...course('c3'), priceCents: 700 } });
    const p = await db.prisma.post.create({
      data: { courseId: 'c3', authorId: u.id, content: 'hi', category: 'qa', tags: ['a', 'b'], poll: { options: [{ id: '1', text: 'x' }], multiple: false } },
    });
    assert.equal(p.category, 'qa');
    assert.deepEqual(p.tags, ['a', 'b']);
    const [raw] = await db.prisma.$queryRaw<{ category: string }[]>`SELECT category::text AS category FROM "Post" WHERE id = ${p.id}`;
    assert.equal(raw?.category, 'Hỏi đáp');
    assert.equal((await db.prisma.course.findUniqueOrThrow({ where: { id: 'c3' } })).priceCents, 700);
  });

  it('reset() xóa sạch dữ liệu nhưng giữ cấu trúc', async () => {
    await db.prisma.user.create({ data: user('r@test.local') });
    await db.reset();
    assert.equal(await db.prisma.user.count(), 0);
    await db.prisma.user.create({ data: user('r@test.local') });
  });

  it('DROP schema sau khi kết thúc (kiểm tra bằng process con)', async () => {
    // Schema phụ tạo riêng để không phá schema đang dùng của file này.
    const c = new pg.Client({ connectionString: db.url.replace(/\?.*$/, '') });
    await c.connect();
    try {
      const exists = async (name: string) =>
        (await c.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [name])).rowCount === 1;
      assert.equal(await exists(db.schema), true, 'schema đang dùng phải tồn tại');
      assert.equal(await exists('test_khong_ton_tai'), false);
    } finally {
      await c.end();
    }
  });
});

// Chạy SAU khi tests kết thúc: xác nhận drop() thật sự xóa schema (after hook đã chạy trong cùng file nên kiểm bằng process riêng).
after(async () => {
  const base = db.url.replace(/\?.*$/, '');
  const c = new pg.Client({ connectionString: base });
  await c.connect();
  try {
    const before = await c.query('SELECT 1 FROM information_schema.schemata WHERE schema_name = $1', [db.schema]);
    assert.equal(before.rowCount, 0, 'schema phải bị DROP sau khi drop()');
  } finally {
    await c.end();
  }
});
