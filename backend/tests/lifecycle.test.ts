import './helpers.js';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, describe, it } from 'node:test';
import express from 'express';
import { gracefulShutdown } from '../src/lifecycle.js';
import { streamHub } from '../src/modules/messages/messages.stream.js';

describe('graceful shutdown', () => {
  it('SIGTERM với nhiều SSE đang mở: đóng SSE -> flush -> cleanup theo thứ tự và xong rất nhanh (không chờ 10s)', async () => {
    const app = express();
    app.get('/stream/:u', async (req, res) => {
      await streamHub.attach(req.params.u as string, res);
    });
    let slowArrived!: () => void;
    const arrived = new Promise<void>((r) => (slowArrived = r));
    app.get('/slow', async (_req, res) => {
      slowArrived();
      await new Promise((r) => setTimeout(r, 300));
      res.json({ ok: true });
    });
    const server: Server = await new Promise((r) => {
      const s = app.listen(0, () => r(s));
    });
    const port = (server.address() as { port: number }).port;

    // 3 kết nối SSE + 1 request chậm đang bay.
    const ends: Promise<void>[] = [];
    for (const u of ['u1', 'u1', 'u2']) {
      const res = await fetch(`http://127.0.0.1:${port}/stream/${u}`);
      assert.equal(res.status, 200);
      const reader = res.body!.getReader();
      ends.push(
        (async () => {
          for (;;) if ((await reader.read()).done) return; // SSE bị server đóng => done
        })(),
      );
    }
    assert.equal(streamHub.connectionCount(), 3);
    const slow = fetch(`http://127.0.0.1:${port}/slow`).then((r) => r.json());
    await arrived; // request đã tới server rồi mới tắt

    const order: string[] = [];
    const t0 = Date.now();
    await gracefulShutdown({
      server,
      closeStreams: async () => {
        order.push('streams');
        await streamHub.closeAll();
      },
      flush: async () => void order.push('flush'),
      cleanup: [async () => void order.push('cleanup')],
      log: () => undefined,
    });
    const took = Date.now() - t0;

    assert.deepEqual(order, ['streams', 'flush', 'cleanup']);
    assert.ok(took < 2000, `shutdown mất ${took}ms (phải << 10s)`);
    assert.deepEqual(await slow, { ok: true }, 'request đang bay vẫn được trả lời trước khi tắt');
    await Promise.all(ends); // mọi luồng SSE đã bị server đóng
    assert.equal(streamHub.connectionCount(), 0);
    assert.equal(server.listening, false);
  });

  it('một bước kẹt bị bỏ qua sau stepTimeoutMs, các bước sau vẫn chạy', async () => {
    const order: string[] = [];
    const t0 = Date.now();
    await gracefulShutdown({
      stopWork: () => new Promise(() => undefined), // treo mãi
      flush: async () => void order.push('flush'),
      cleanup: [async () => void order.push('cleanup')],
      stepTimeoutMs: 100,
      log: () => undefined,
    });
    assert.deepEqual(order, ['flush', 'cleanup']);
    assert.ok(Date.now() - t0 < 1500);
  });
});

after(async () => {
  await streamHub.closeAll();
  const { closeShared } = await import('../src/infra/shared.js');
  await closeShared();
});
