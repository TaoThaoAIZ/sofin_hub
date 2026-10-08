import './helpers.js'; // NODE_ENV=test + DATABASE_URL (advisory lock chỉ cần kết nối DB, không cần schema)
import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { withAdvisoryLock } from '../src/infra/leader.js';
import { createScheduler, type Job } from '../src/infra/scheduler.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uniq = (p: string) => `${p}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`;
const quiet = { log: () => undefined };

describe('leader election bằng Postgres advisory lock', () => {
  it('withAdvisoryLock: 2 bên đua cùng tên => đúng 1 bên chạy; xong thì bên sau chạy được', async () => {
    const name = uniq('lock');
    let runs = 0;
    const work = async () => {
      runs++;
      await sleep(150);
      return 'done';
    };
    const [a, b] = await Promise.all([withAdvisoryLock(name, work), withAdvisoryLock(name, work)]);
    assert.equal(runs, 1);
    assert.deepEqual([a.ran, b.ran].sort(), [false, true]);
    const c = await withAdvisoryLock(name, work);
    assert.equal(c.ran, true, 'khóa đã được nhả sau lượt trước');
    assert.equal(runs, 2);
  });

  it('khóa khác tên không chặn nhau; job ném lỗi vẫn nhả khóa', async () => {
    const [n1, n2] = [uniq('a'), uniq('b')];
    const both = await Promise.all([
      withAdvisoryLock(n1, async () => {
        await sleep(80);
        return 1;
      }),
      withAdvisoryLock(n2, async () => {
        await sleep(80);
        return 2;
      }),
    ]);
    assert.deepEqual(both.map((r) => r.ran), [true, true]);
    await assert.rejects(
      withAdvisoryLock(n1, async () => {
        throw new Error('boom');
      }),
      /boom/,
    );
    assert.equal((await withAdvisoryLock(n1, async () => 3)).ran, true);
  });
});

describe('scheduler: nhiều instance, mỗi job chỉ chạy ở 1', () => {
  it('2 scheduler (2 instance) tick cùng lúc => job chạy đúng 1 lần, bên kia skipped-not-leader', async () => {
    const name = uniq('job.shared');
    let count = 0;
    const job: Job = {
      name,
      intervalMs: 60_000,
      run: async () => {
        count++;
        await sleep(150);
      },
    };
    const instA = createScheduler([job], quiet);
    const instB = createScheduler([job], quiet);
    const outcomes = await Promise.all([instA.tick(name), instB.tick(name)]);
    assert.equal(count, 1);
    assert.deepEqual([...outcomes].sort(), ['ran', 'skipped-not-leader']);
    // Lượt sau (đã nhả khóa) instance nào cũng chạy được.
    assert.equal(await instB.tick(name), 'ran');
    assert.equal(count, 2);
  });

  it('chống chồng lượt trong cùng process: skipped-busy', async () => {
    const name = uniq('job.busy');
    let count = 0;
    const s = createScheduler(
      [
        {
          name,
          intervalMs: 60_000,
          run: async () => {
            count++;
            await sleep(120);
          },
        },
      ],
      quiet,
    );
    const [x, y] = await Promise.all([s.tick(name), s.tick(name)]);
    assert.deepEqual([x, y], ['ran', 'skipped-busy']);
    assert.equal(count, 1);
  });

  it('job lỗi => failed, được log, không làm scheduler chết, khóa được nhả', async () => {
    const name = uniq('job.fail');
    const logs: string[] = [];
    let n = 0;
    const s = createScheduler(
      [
        {
          name,
          intervalMs: 60_000,
          run: async () => {
            if (n++ === 0) throw new Error('hỏng');
          },
        },
      ],
      { log: (m) => logs.push(m) },
    );
    assert.equal(await s.tick(name), 'failed');
    assert.equal(logs.length, 1);
    assert.equal(await s.tick(name), 'ran');
  });

  it('start() chạy theo chu kỳ và stop() chờ lượt đang chạy xong', async () => {
    const name = uniq('job.timer');
    let started = 0;
    let finished = 0;
    const s = createScheduler(
      [
        {
          name,
          intervalMs: 40,
          run: async () => {
            started++;
            await sleep(150);
            finished++;
          },
        },
      ],
      quiet,
    );
    s.start();
    await sleep(120);
    assert.ok(started >= 1);
    await s.stop();
    assert.equal(started, finished, 'stop() chỉ trả về khi mọi lượt đang chạy đã xong');
    const before = started;
    await sleep(120);
    assert.equal(started, before, 'sau stop() không lên lịch thêm');
  });

  it('allJobs() khai báo đủ job nền (gia hạn, đối soát, nhắc lịch, dọn tài khoản chưa xác thực) với tên duy nhất', async () => {
    const { allJobs } = await import('../src/jobs.js');
    const names = allJobs().map((j) => j.name);
    assert.deepEqual([...names].sort(), ['auth.purgeUnverified', 'events.reminders', 'payments.reconcile', 'payments.subscriptions', 'payments.trialReminders', 'referrals.reconcile']);
    assert.equal(new Set(names).size, names.length);
  });
});

after(async () => {
  const { disconnectPrisma } = await import('../src/db/prisma.js');
  await disconnectPrisma();
});
