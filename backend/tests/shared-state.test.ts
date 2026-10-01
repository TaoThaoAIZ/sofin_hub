import './helpers.js'; // đặt NODE_ENV=test + DATABASE_URL trước khi nạp src/
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { createMemoryShared, createRedisShared, type Shared } from '../src/infra/shared-state.js';

/**
 * Hợp đồng hành vi của adapter state chia sẻ (kv / pubsub / rateLimiter). CHẠY CÙNG MỘT bộ test cho:
 *  - memory (luôn chạy)
 *  - redis  (chỉ khi đặt REDIS_URL, vd. `REDIS_URL=redis://localhost:6380 npm test`; không có thì bỏ qua)
 * Mỗi "instance" của redis là một `createRedisShared` riêng (kết nối riêng) dùng chung prefix — mô phỏng 2 instance app.
 */
const REDIS_URL = process.env.REDIS_URL;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (cond: () => boolean, ms = 2000) => {
  const t0 = Date.now();
  while (!cond() && Date.now() - t0 < ms) await sleep(10);
  return cond();
};

interface Backend {
  name: string;
  /** Trả n "instance" cùng nhìn vào MỘT kho dữ liệu. */
  make(n: number): Shared[];
}

const backends: Backend[] = [
  {
    name: 'memory',
    make(n) {
      const one = createMemoryShared();
      return Array.from({ length: n }, () => one);
    },
  },
];
if (REDIS_URL) {
  backends.push({
    name: 'redis',
    make(n) {
      const prefix = `test:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}:`;
      return Array.from({ length: n }, () => createRedisShared(REDIS_URL, { keyPrefix: prefix }));
    },
  });
}

for (const backend of backends) {
  describe(`state chia sẻ [${backend.name}]`, () => {
    const opened: Shared[] = [];
    const make = (n: number) => {
      const xs = backend.make(n);
      opened.push(...xs);
      return xs;
    };
    after(async () => {
      for (const s of opened) {
        await s.reset().catch(() => undefined);
        await s.close().catch(() => undefined);
      }
    });

    describe('kv', () => {
      it('set/get/del + giá trị chia sẻ giữa 2 instance', async () => {
        const [a, b] = make(2);
        assert.equal(await a!.kv.get('k1'), null);
        await a!.kv.set('k1', 'v1');
        assert.equal(await b!.kv.get('k1'), 'v1');
        await b!.kv.del('k1');
        assert.equal(await a!.kv.get('k1'), null);
      });

      it('TTL: hết hạn thì biến mất', async () => {
        const [a] = make(1);
        await a!.kv.set('t', 'x', 80);
        assert.equal(await a!.kv.get('t'), 'x');
        await sleep(160);
        assert.equal(await a!.kv.get('t'), null);
      });

      it('setNx: chỉ MỘT người thắng khi đua đồng thời giữa 2 instance; có TTL thì sau đó tạo lại được', async () => {
        const [a, b] = make(2);
        const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a! : b!).kv.setNx('lock', String(i), 120)));
        assert.equal(results.filter(Boolean).length, 1);
        assert.equal(await a!.kv.setNx('lock', 'again', 120), false);
        await sleep(200);
        assert.equal(await b!.kv.setNx('lock', 'later', 120), true);
      });

      it('setNx không ghi đè giá trị đang có', async () => {
        const [a] = make(1);
        assert.equal(await a!.kv.setNx('keep', 'first', 5000), true);
        assert.equal(await a!.kv.setNx('keep', 'second', 5000), false);
        assert.equal(await a!.kv.get('keep'), 'first');
      });

      it('getDel (vé dùng 1 lần): đua 10 request/2 instance chỉ MỘT nhận được giá trị; mint ở A redeem được ở B', async () => {
        const [a, b] = make(2);
        await a!.kv.set('ticket', 'user-1', 5000);
        const got = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a! : b!).kv.getDel('ticket')));
        assert.deepEqual(got.filter((v) => v !== null), ['user-1']);
        assert.equal(await a!.kv.getDel('ticket'), null);
      });

      it('getDel trên khóa hết hạn / không tồn tại => null', async () => {
        const [a] = make(1);
        assert.equal(await a!.kv.getDel('nope'), null);
        await a!.kv.set('short', 'x', 50);
        await sleep(120);
        assert.equal(await a!.kv.getDel('short'), null);
      });
    });

    describe('pubsub', () => {
      it('publish ở A tới subscriber ở B (và ở chính A); nhiều handler đều nhận', async () => {
        const [a, b] = make(2);
        const gotB: string[] = [];
        const gotB2: string[] = [];
        const gotA: string[] = [];
        const offB = await b!.pubsub.subscribe('ch', (m) => gotB.push(m));
        const offB2 = await b!.pubsub.subscribe('ch', (m) => gotB2.push(m));
        const offA = await a!.pubsub.subscribe('ch', (m) => gotA.push(m));
        await a!.pubsub.publish('ch', 'hello');
        assert.ok(await until(() => gotB.length === 1 && gotB2.length === 1 && gotA.length === 1), 'cả 3 handler phải nhận');
        assert.deepEqual([gotB[0], gotB2[0], gotA[0]], ['hello', 'hello', 'hello']);
        await offB();
        await offB2();
        await offA();
      });

      it('kênh độc lập; hủy đăng ký thì không nhận nữa; handler ném lỗi không chặn handler khác', async () => {
        const [a, b] = make(2);
        const x: string[] = [];
        const y: string[] = [];
        const bad = await b!.pubsub.subscribe('c1', () => {
          throw new Error('boom');
        });
        const offX = await b!.pubsub.subscribe('c1', (m) => x.push(m));
        const offY = await b!.pubsub.subscribe('c2', (m) => y.push(m));
        await a!.pubsub.publish('c1', 'one');
        assert.ok(await until(() => x.length === 1));
        await sleep(50);
        assert.deepEqual(y, [], 'kênh c2 không nhận tin của c1');
        await offX();
        await a!.pubsub.publish('c1', 'two');
        await sleep(100);
        assert.deepEqual(x, ['one'], 'đã hủy đăng ký thì không nhận thêm');
        await a!.pubsub.publish('c2', 'for-y');
        assert.ok(await until(() => y.length === 1));
        await bad();
        await offY();
      });

      it('publish khi không có subscriber không lỗi', async () => {
        const [a] = make(1);
        await a!.pubsub.publish('empty', 'x');
      });
    });

    describe('rateLimiter', () => {
      it('cho tới max rồi chặn; retryAfterSec >= 1; khóa khác độc lập', async () => {
        const [a] = make(1);
        const rs = [];
        for (let i = 0; i < 4; i++) rs.push(await a!.rateLimiter.hit('u1', 3, 5000));
        assert.deepEqual(rs.map((r) => r.ok), [true, true, true, false]);
        assert.deepEqual(rs.map((r) => r.count), [1, 2, 3, 4]);
        assert.ok(rs[3]!.retryAfterSec >= 1 && rs[3]!.retryAfterSec <= 5);
        assert.equal((await a!.rateLimiter.hit('u2', 3, 5000)).ok, true);
      });

      it('mở lại sau khi hết cửa sổ', async () => {
        const [a] = make(1);
        assert.equal((await a!.rateLimiter.hit('w', 1, 150)).ok, true);
        assert.equal((await a!.rateLimiter.hit('w', 1, 150)).ok, false);
        await sleep(250);
        assert.equal((await a!.rateLimiter.hit('w', 1, 150)).ok, true);
      });

      it('hạn mức CHUNG giữa 2 instance và chính xác khi đua đồng thời (đúng max lượt ok)', async () => {
        const [a, b] = make(2);
        const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? a! : b!).rateLimiter.hit('race', 7, 5000)));
        assert.equal(rs.filter((r) => r.ok).length, 7);
      });
    });
  });
}

describe('state chia sẻ: chỉ chạy Redis khi có REDIS_URL', () => {
  it(REDIS_URL ? `đang chạy cả adapter redis (${REDIS_URL.replace(/\/\/.*@/, '//***@')})` : 'bỏ qua adapter redis (không đặt REDIS_URL)', () => {
    assert.equal(backends.some((b) => b.name === 'redis'), !!REDIS_URL);
  });
});

describe('vé upload: chống replay bằng SET NX (nonce)', () => {
  it('consumeTicket: chỉ lần dùng đầu thành công, kể cả 2 PUT đua nhau', async () => {
    const { signUploadTicket, verifyUploadTicket, consumeTicket } = await import('../src/modules/uploads/uploads.ticket.js');
    const { token } = signUploadTicket({ key: 'k1', contentType: 'image/png', maxSize: 100, userId: 'u1' });
    const check = verifyUploadTicket(token);
    assert.ok(check.ok);
    if (!check.ok) return;
    const results = await Promise.all([consumeTicket(check.ticket), consumeTicket(check.ticket), consumeTicket(check.ticket)]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(await consumeTicket(check.ticket), false, 'dùng lại => bị chặn');
  });

  it('vé hết hạn / chữ ký sai vẫn bị verify từ chối (không đụng store)', async () => {
    const { signUploadTicket, verifyUploadTicket } = await import('../src/modules/uploads/uploads.ticket.js');
    const { token } = signUploadTicket({ key: 'k', contentType: 'image/png', maxSize: 1, userId: 'u', ttlSec: -1 });
    assert.deepEqual(verifyUploadTicket(token), { ok: false, reason: 'expired' });
    assert.deepEqual(verifyUploadTicket(`${token}x`), { ok: false, reason: 'invalid' });
  });
});

describe('vé SSE: mint ở instance này, redeem ở instance khác', () => {
  it('issueStreamTicket -> consumeStreamTicket một lần duy nhất (messages + notifications)', async () => {
    const { issueStreamTicket, consumeStreamTicket } = await import('../src/modules/messages/messages.stream.js');
    const { notificationsService } = await import('../src/modules/notifications/notifications.service.js');
    const t = await issueStreamTicket('u-1');
    assert.equal(await consumeStreamTicket(t.ticket), 'u-1');
    assert.equal(await consumeStreamTicket(t.ticket), null);
    assert.equal(await consumeStreamTicket('khong-co'), null);
    const n = await notificationsService.issueStreamTicket('u-2');
    const [x, y] = await Promise.all([notificationsService.consumeStreamTicket(n.ticket), notificationsService.consumeStreamTicket(n.ticket)]);
    assert.deepEqual([x, y].filter(Boolean), ['u-2']);
    // Vé của kênh này không redeem được ở kênh kia.
    const m = await issueStreamTicket('u-3');
    assert.equal(await notificationsService.consumeStreamTicket(m.ticket), undefined);
  });
});

describe('guard production: Redis', () => {
  it('cảnh báo (không thoát) khi nhiều instance mà thiếu REDIS_URL; 1 instance không Redis thì im lặng', async () => {
    const { productionEnvWarnings, productionEnvProblems } = await import('../src/config/env-guard.js');
    const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x', RUN_SCHEDULERS: true };
    assert.deepEqual(productionEnvWarnings(base, {}), []);
    assert.equal(productionEnvWarnings(base, { INSTANCE_COUNT: '3' }).length, 1);
    assert.equal(productionEnvWarnings(base, { WEB_CONCURRENCY: '2' }).length, 1);
    assert.deepEqual(productionEnvWarnings({ ...base, REDIS_URL: 'redis://r' }, { INSTANCE_COUNT: '3' }), []);
    assert.equal(productionEnvWarnings({ ...base, RUN_SCHEDULERS: false }, {}).length, 1, 'web-only không Redis: worker không đẩy được realtime');
    assert.deepEqual(productionEnvWarnings({ ...base, NODE_ENV: 'development' }, { INSTANCE_COUNT: '3' }), []);
    assert.deepEqual(productionEnvProblems(base), [], 'thiếu Redis KHÔNG phải lỗi chặn khởi động');
  });
});

after(async () => {
  const { closeShared } = await import('../src/infra/shared.js');
  await closeShared();
});
