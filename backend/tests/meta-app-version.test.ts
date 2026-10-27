import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, type TestServer } from './helpers.js';

describe('GET /meta/app-version', () => {
  let server: TestServer;
  let call: ReturnType<typeof makeClient>['call'];

  before(async () => {
    server = await startTestServer();
    ({ call } = makeClient(server.baseUrl));
  });
  after(() => server.close());

  it('công khai, chưa cấu hình thì không ép cập nhật (minVersion = null)', async () => {
    const r = await call('GET', '/meta/app-version?platform=android');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, { minVersion: null, latestVersion: null, storeUrl: null });
  });

  it('platform lạ vẫn trả 200, không có storeUrl', async () => {
    const r = await call('GET', '/meta/app-version?platform=windows');
    assert.equal(r.status, 200);
    assert.equal(r.body.data.storeUrl, null);
  });
});
