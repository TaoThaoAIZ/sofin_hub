import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const DAY = 86_400_000;
const card = (over: Record<string, unknown> = {}) => ({
  type: 'card',
  token: `tok_mock_${randomBytes(6).toString('hex')}`,
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: new Date().getUTCFullYear() + 2,
  ...over,
});

describe('wizard tạo cộng đồng: nháp, slug, publish, câu hỏi gia nhập, gói owner, payout', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let writeOverrides: typeof import('../src/modules/settings/settings.service.js').writeOverrides;
  let getOverrides: typeof import('../src/modules/settings/settings.service.js').getOverrides;
  let slugCounter = 0;
  const slug = (p = 'lop') => `${p}-w${Date.now().toString(36)}${slugCounter++}`;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ writeOverrides, getOverrides } = await import('../src/modules/settings/settings.service.js'));
  });
  after(() => server.close());

  const basics = (over: Record<string, unknown> = {}) => ({ title: 'Lớp Gốm Cuối Tuần', description: 'Học làm gốm từ con số 0.', category: 'hobby', slug: slug(), ...over });
  async function newDraft(user: { token: string }, over: Record<string, unknown> = {}) {
    const r = await c.call('POST', '/communities/drafts', { token: user.token, body: basics(over) });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data as { id: string };
  }
  const step = (user: { token: string }, id: string, s: string, body: unknown) => c.call('PATCH', `/communities/${id}/draft/steps/${s}`, { token: user.token, body });
  async function readyDraft(user: { token: string }, members: Record<string, unknown> = {}) {
    const d = await newDraft(user);
    const m = await step(user, d.id, 'members', { visibility: 'public', priceUsd: 0, ...members });
    assert.equal(m.status, 200, JSON.stringify(m.body));
    return d.id;
  }
  async function makeUpload(ownerId: string, purpose: 'avatar' | 'cover' | 'post_image', status: 'uploaded' | 'pending' = 'uploaded') {
    const key = `${randomBytes(16).toString('hex')}.png`;
    await db.prisma.upload.create({ data: { key, ownerId, filename: 'a.png', contentType: 'image/png', size: 100, purpose, status } });
    return `/api/files/${key}`;
  }

  describe('slug', () => {
    it('định dạng, ngắn/dài, reserved, trùng cộng đồng có sẵn, gợi ý, còn trống', async () => {
      const q = async (s: string, token?: string) => (await c.call('GET', `/communities/slug-available?slug=${encodeURIComponent(s)}`, { token })).body.data;
      assert.equal((await q('ab')).reason, 'too_short');
      assert.equal((await q('x'.repeat(41))).reason, 'too_long');
      assert.equal((await q('Có Dấu')).reason, 'invalid_format');
      assert.equal((await q('-abc')).reason, 'invalid_format');
      assert.equal((await q('a--b')).reason, 'invalid_format');
      assert.equal((await q('admin')).reason, 'reserved');
      assert.equal((await q('sofinhub')).reason, 'reserved');
      assert.equal((await q('drafts')).reason, 'reserved');
      const taken = await q('photo');
      assert.equal(taken.available, false);
      assert.equal(taken.reason, 'taken');
      assert.match(taken.suggestion, /^photo-\d+$/);
      const free = await q(slug());
      assert.deepEqual([free.available, free.reason], [true, null]);
    });

    it('nháp của người khác chiếm slug; nháp của chính mình thì "còn trống" với mình', async () => {
      const a = await c.registerUser('slugA');
      const b = await c.registerUser('slugB');
      const d = await newDraft(a);
      const check = async (token?: string) => (await c.call('GET', `/communities/slug-available?slug=${d.id}`, { token })).body.data;
      assert.equal((await check(b.token)).reason, 'taken');
      assert.equal((await check()).reason, 'taken');
      assert.equal((await check(a.token)).available, true);
      const dup = await c.call('POST', '/communities/drafts', { token: b.token, body: basics({ slug: d.id }) });
      assert.equal(dup.status, 409);
      assert.equal(dup.body.error.code, 'SLUG_TAKEN');
    });
  });

  describe('vòng đời nháp', () => {
    it('401, validate từng bước (tiếng Việt), tạo → đọc → liệt kê → xóa; nháp ẩn công khai', async () => {
      assert.equal((await c.call('POST', '/communities/drafts', { body: basics() })).status, 401);
      assert.equal((await c.call('GET', '/me/community-drafts')).status, 401);
      const u = await c.registerUser('draft');

      const bad = await c.call('POST', '/communities/drafts', { token: u.token, body: { title: 'ab', description: '', category: 'nope' } });
      assert.equal(bad.status, 400);
      assert.equal(bad.body.error.code, 'VALIDATION_ERROR');
      assert.ok(bad.body.error.details.fieldErrors.title[0].includes('3 ký tự'));
      assert.equal((await c.call('POST', '/communities/drafts', { token: u.token, body: basics({ description: 'x'.repeat(151) }) })).status, 400);
      assert.equal((await c.call('POST', '/communities/drafts', { token: u.token, body: basics({ title: 'x'.repeat(81) }) })).status, 400);
      assert.equal((await c.call('POST', '/communities/drafts', { token: u.token, body: basics({ slug: 'admin' }) })).body.error.code, 'SLUG_RESERVED');
      assert.equal((await c.call('POST', '/communities/drafts', { token: u.token, body: basics({ slug: 'Bad Slug' }) })).body.error.code, 'SLUG_INVALID');

      // slug mặc định = slugify(title)
      const auto = await c.call('POST', '/communities/drafts', { token: u.token, body: { title: `Gốm Đẹp ${Date.now().toString(36)}`, description: 'd', category: 'hobby' } });
      assert.equal(auto.status, 201, JSON.stringify(auto.body));
      assert.match(auto.body.data.slug, /^gom-dep-/);
      assert.equal(auto.body.data.status, 'draft');
      assert.deepEqual(auto.body.data.completedSteps, ['basics']);
      assert.equal(auto.body.data.nextStep, 'plan');

      const id = auto.body.data.id as string;
      // chỉ chủ thấy; công khai/khám phá/chi tiết đều 404
      const other = await c.registerUser('draftOther');
      assert.equal((await c.call('GET', `/communities/${id}/draft`, { token: other.token })).status, 404);
      assert.equal((await c.call('GET', `/communities/${id}`)).status, 404);
      const list = await c.call('GET', '/communities?limit=50&q=gom');
      assert.ok(!(list.body.data as Array<{ id: string }>).some((x) => x.id === id));
      assert.ok(!(await c.call('GET', '/communities?limit=50')).body.data.some((x: { id: string }) => x.id === id));
      assert.equal((await c.call('GET', `/search?q=${encodeURIComponent('Gốm Đẹp')}`)).body.data?.communities?.some?.((x: { id: string }) => x.id === id) ?? false, false);

      const mine = await c.call('GET', '/me/community-drafts', { token: u.token });
      assert.ok(mine.body.data.some((x: { id: string }) => x.id === id));
      assert.equal((await c.call('GET', '/me/community-drafts', { token: other.token })).body.data.length, 0);
      assert.equal((await c.call('GET', `/communities/${id}/draft`, { token: u.token })).status, 200);

      assert.equal((await c.call('DELETE', `/communities/${id}/draft`, { token: other.token })).status, 404);
      assert.equal((await c.call('DELETE', `/communities/${id}/draft`, { token: u.token })).status, 200);
      assert.equal((await c.call('GET', `/communities/${id}/draft`, { token: u.token })).status, 404);
      assert.equal((await c.call('GET', `/communities/slug-available?slug=${id}`, { token: other.token })).body.data.available, true);
    });

    it('PATCH bước: đổi slug đổi id, giữ dữ liệu; field lạ/rỗng 400; tối đa 5 nháp', async () => {
      const u = await c.registerUser('patch');
      const d = await newDraft(u);
      const ns = slug('moi');
      const r = await step(u, d.id, 'basics', { slug: ns, title: 'Tên Mới' });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.id, ns);
      assert.equal(r.body.data.basics.title, 'Tên Mới');
      assert.equal((await c.call('GET', `/communities/${d.id}/draft`, { token: u.token })).status, 404);
      assert.equal((await step(u, ns, 'basics', {})).status, 400);
      assert.equal((await step(u, ns, 'basics', { foo: 1 })).status, 400);
      assert.equal((await step(u, ns, 'nope', { x: 1 })).status, 400);
      assert.equal((await step(u, ns, 'basics', { slug: 'photo' })).body.error.code, 'SLUG_TAKEN');

      for (let i = 0; i < 4; i++) await newDraft(u);
      const sixth = await c.call('POST', '/communities/drafts', { token: u.token, body: basics() });
      assert.equal(sixth.status, 409);
      assert.equal(sixth.body.error.code, 'DRAFT_LIMIT');
    });

    it('bước identity: màu, lời hứa, lợi ích, video YouTube/Vimeo chuẩn hóa, upload phải của chính mình đúng purpose', async () => {
      const u = await c.registerUser('ident');
      const other = await c.registerUser('identO');
      const d = await newDraft(u);
      const ok = await step(u, d.id, 'identity', {
        brandColor: '#F26A1B',
        promise: 'Tự tay làm chiếc bát gốm đầu tiên',
        benefits: ['Buổi học trực tiếp', '', 'Thư viện video'],
        introVideoUrl: 'https://youtu.be/dQw4w9WgXcQ',
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(ok.body.data.identity.brandColor, '#f26a1b');
      assert.deepEqual(ok.body.data.identity.benefits, ['Buổi học trực tiếp', 'Thư viện video']);
      assert.equal(ok.body.data.identity.introVideoUrl, 'https://www.youtube.com/embed/dQw4w9WgXcQ');
      assert.ok(ok.body.data.completedSteps.includes('identity'));

      assert.equal((await step(u, d.id, 'identity', { brandColor: 'red' })).status, 400);
      assert.equal((await step(u, d.id, 'identity', { promise: 'x'.repeat(101) })).status, 400);
      assert.equal((await step(u, d.id, 'identity', { benefits: Array(7).fill('a') })).status, 400);
      assert.equal((await step(u, d.id, 'identity', { introVideoUrl: 'https://evil.example.com/v' })).status, 400);
      assert.equal((await step(u, d.id, 'identity', { introVideoUrl: null })).body.data.identity.introVideoUrl, null);

      const logo = await makeUpload(u.id, 'avatar');
      const cover = await makeUpload(u.id, 'cover');
      const set = await step(u, d.id, 'identity', { logoUrl: logo, coverUrl: cover });
      assert.equal(set.status, 200, JSON.stringify(set.body));
      assert.equal(set.body.data.identity.logoUrl, logo);
      // sai purpose / của người khác / chưa upload xong / URL ngoài
      assert.equal((await step(u, d.id, 'identity', { logoUrl: cover })).body.error.code, 'UPLOAD_INVALID');
      assert.equal((await step(u, d.id, 'identity', { logoUrl: await makeUpload(other.id, 'avatar') })).body.error.code, 'UPLOAD_INVALID');
      assert.equal((await step(u, d.id, 'identity', { logoUrl: await makeUpload(u.id, 'avatar', 'pending') })).body.error.code, 'UPLOAD_INVALID');
      assert.equal((await step(u, d.id, 'identity', { coverUrl: 'https://example.com/a.png' })).body.error.code, 'UPLOAD_INVALID');
      assert.equal((await step(u, d.id, 'identity', { logoUrl: null })).body.data.identity.logoUrl, null);
    });

    it('bước members: giá năm ≤ 12× giá tháng, savings %, về miễn phí bỏ giá năm, câu hỏi ≤3, nội quy', async () => {
      const u = await c.registerUser('mem');
      const d = await newDraft(u);
      const ok = await step(u, d.id, 'members', {
        visibility: 'private', priceUsd: 175_000, priceAnnualUsd: 1_200_000, memberTrialEnabled: true,
        joinQuestions: ['Bạn đã từng làm gốm chưa?', 'Bạn biết đến lớp từ đâu?'],
        rules: [{ title: 'Tôn trọng nhau', body: 'Góp ý văn minh' }, { title: 'Không spam' }],
        requireRulesAgreement: true, autoApprovePaid: false,
      });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      const m = ok.body.data.members;
      assert.equal(m.priceUsd, 175_000);
      assert.equal(m.priceAnnualUsd, 1_200_000);
      assert.equal(m.annualSavingsPct, 43);
      assert.equal(m.trialDays, 7);
      assert.equal(m.rules.length, 2);
      assert.equal(m.rules[1].body, '');
      assert.deepEqual(ok.body.data.completedSteps, ['basics', 'members']);

      const over = await step(u, d.id, 'members', { priceAnnualUsd: 2_125_000 });
      assert.equal(over.status, 400);
      assert.ok(over.body.error.details.fieldErrors.priceAnnualUsd[0].includes('12 lần'));
      assert.equal((await step(u, d.id, 'members', { priceUsd: 75_000 })).status, 400, 'hạ giá tháng khiến giá năm 1.200.000 > 12 × 75.000');
      assert.equal((await step(u, d.id, 'members', { priceAnnualUsd: 0 })).status, 400);
      assert.equal((await step(u, d.id, 'members', { priceUsd: -1 })).status, 400);
      assert.equal((await step(u, d.id, 'members', { joinQuestions: ['a?', 'b?', 'c?', 'd?'].map((x) => x.repeat(3)) })).status, 400);
      assert.equal((await step(u, d.id, 'members', { joinQuestions: ['ab'] })).status, 400);
      assert.equal((await step(u, d.id, 'members', { visibility: 'secret' })).status, 400);
      assert.equal((await step(u, d.id, 'members', { memberTrialEnabled: false })).body.data.members.trialDays, 0);
      const free = await step(u, d.id, 'members', { priceUsd: 0 });
      assert.equal(free.body.data.members.priceAnnualUsd, null);
      assert.equal((await step(u, d.id, 'members', { priceUsd: 0, priceAnnualUsd: 250_000 })).status, 400);
    });

    it('rules-template và revenue-estimate (net sau hoa hồng + phí cổng từ Global Settings)', async () => {
      const t = await c.call('GET', '/communities/rules-template');
      assert.equal(t.status, 200);
      assert.ok(t.body.data.rules.length >= 3);
      const e = await c.call('GET', '/communities/revenue-estimate?price=250000&members=10');
      assert.equal(e.status, 200);
      const x = e.body.data;
      assert.equal(x.grossCents, 2_500_000);
      assert.equal(x.platformFeeCents + x.gatewayFeeCents + x.netCents, x.grossCents);
      assert.equal(x.netPerMemberCents * 10, x.netCents);
      assert.ok(x.netCents > 0 && x.netCents < x.grossCents);
      assert.equal(x.commissionPct, 10);
      assert.equal((await c.call('GET', '/communities/revenue-estimate?price=abc')).status, 400);
      assert.equal((await c.call('GET', '/communities/revenue-estimate')).status, 400);
    });
  });

  describe('publish', () => {
    it('đủ điều kiện: chuyển active, owner + khóa học mặc định, hiện công khai; publish lần 2 → 409', async () => {
      const u = await c.registerUser('pub');
      const id = await readyDraft(u, { priceUsd: 125_000, priceAnnualUsd: 1_250_000 });
      const r = await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.id, id);
      assert.equal(r.body.data.viewerRole, 'owner');
      assert.ok(r.body.data.defaultCourseId);
      assert.equal(r.body.data.priceAnnualUsd, 1_250_000);
      assert.equal(r.body.data.annualSavingsPct, 17);
      assert.equal(r.body.data.pricing, 'paid');

      const pub = await c.call('GET', `/communities/${id}`);
      assert.equal(pub.status, 200);
      assert.equal(pub.body.data.title, 'Lớp Gốm Cuối Tuần');
      assert.ok((await c.call('GET', '/communities?limit=50&sort=newest')).body.data.some((x: { id: string }) => x.id === id));
      assert.equal((await c.call('GET', '/me/community-drafts', { token: u.token })).body.data.length, 0);
      assert.equal((await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } })).status, 409);
      assert.equal((await c.call('GET', `/communities/${id}/draft`, { token: u.token })).body.error.code, 'NOT_A_DRAFT');
      assert.equal((await step(u, id, 'basics', { title: 'Sau' })).body.error.code, 'NOT_A_DRAFT');
    });

    it('401/404/403-kiểu 404, thiếu điều khoản 400, thiếu bước members → DRAFT_INCOMPLETE', async () => {
      const u = await c.registerUser('pub2');
      const other = await c.registerUser('pub2o');
      const d = await newDraft(u);
      assert.equal((await c.call('POST', `/communities/${d.id}/publish`, { body: { acceptTerms: true } })).status, 401);
      assert.equal((await c.call('POST', `/communities/${d.id}/publish`, { token: other.token, body: { acceptTerms: true } })).status, 404);
      assert.equal((await c.call('POST', '/communities/khong-co/publish', { token: u.token, body: { acceptTerms: true } })).status, 404);
      assert.equal((await c.call('POST', `/communities/${d.id}/publish`, { token: u.token, body: {} })).status, 400);
      assert.equal((await c.call('POST', `/communities/${d.id}/publish`, { token: u.token, body: { acceptTerms: false } })).body.error.code, 'TERMS_NOT_ACCEPTED');
      const inc = await c.call('POST', `/communities/${d.id}/publish`, { token: u.token, body: { acceptTerms: true } });
      assert.equal(inc.status, 400);
      assert.equal(inc.body.error.code, 'DRAFT_INCOMPLETE');
      assert.equal(inc.body.error.details.missing[0].step, 'members');
      const view = await c.call('GET', `/communities/${d.id}/draft`, { token: u.token });
      assert.equal(view.body.data.readiness.canPublish, false);
      await step(u, d.id, 'members', { priceUsd: 0 });
      assert.equal((await c.call('GET', `/communities/${d.id}/draft`, { token: u.token })).body.data.readiness.canPublish, true);
    });

    it('gói owner: tùy chọn mặc định; bật owner.requirePlan thì chặn publish (PLAN_REQUIRED) tới khi chọn gói', async () => {
      const u = await c.registerUser('plan');
      const id = await readyDraft(u);
      assert.equal((await c.call('GET', '/owner-plans')).body.data.required, false);
      const prev = getOverrides();
      await writeOverrides({ ...prev, 'owner.requirePlan': true }, null);
      try {
        assert.equal((await c.call('GET', '/owner-plans')).body.data.required, true);
        assert.equal((await c.call('GET', `/communities/${id}/draft`, { token: u.token })).body.data.readiness.canPublish, false);
        const blocked = await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } });
        assert.equal(blocked.status, 400);
        assert.equal(blocked.body.error.code, 'PLAN_REQUIRED');
        assert.equal((await step(u, id, 'plan', { planKey: 'start' })).status, 200);
        assert.equal((await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } })).status, 201);
      } finally {
        await writeOverrides(prev, null);
      }
    });
  });

  describe('gói hosting của owner (mô phỏng)', () => {
    it('catalogue từ Global Settings; start miễn phí active; pro cần thẻ, trialing 14 ngày, không lưu PAN', async () => {
      const cat = (await c.call('GET', '/owner-plans')).body.data;
      assert.equal(cat.currency, 'VND');
      assert.equal(cat.trialDays, 14);
      assert.deepEqual(cat.plans.map((p: { key: string }) => p.key), ['start', 'pro']);
      assert.equal(cat.plans[1].priceMonthly, 299000);
      assert.equal(cat.plans[1].priceAnnual, 2990000);
      assert.equal(cat.cycles[1].savingsPct, 17);

      const u = await c.registerUser('hp');
      const other = await c.registerUser('hpo');
      const id = (await newDraft(u)).id;
      assert.equal((await c.call('GET', `/communities/${id}/hosting-plan`, { token: u.token })).body.data, null);
      assert.equal((await c.call('GET', `/communities/${id}/hosting-plan`, { token: other.token })).status, 404);

      const noCard = await step(u, id, 'plan', { planKey: 'pro' });
      assert.equal(noCard.status, 400);
      assert.equal(noCard.body.error.code, 'PAYMENT_METHOD_REQUIRED');
      const withPan = await step(u, id, 'plan', { planKey: 'pro', paymentMethod: { ...card(), number: '4242424242424242', cvc: '123' } });
      assert.equal(withPan.status, 400);
      assert.equal((await step(u, id, 'plan', { planKey: 'pro', paymentMethod: card({ expYear: 2020 }) })).status, 400);
      assert.equal((await step(u, id, 'plan', { planKey: 'pro', paymentMethod: card({ last4: '42' }) })).status, 400);
      assert.equal((await step(u, id, 'plan', { planKey: 'gold' })).status, 400);

      const pro = await step(u, id, 'plan', { planKey: 'pro', cycle: 'annual', paymentMethod: card() });
      assert.equal(pro.status, 200, JSON.stringify(pro.body));
      const plan = pro.body.data.plan;
      assert.equal(plan.status, 'trialing');
      assert.equal(plan.priceAmount, 2990000);
      assert.equal(plan.todayDue, 0);
      assert.equal(plan.mock, true);
      assert.equal(plan.paymentMethod.last4, '4242');
      const days = Math.round((new Date(plan.trialEndsAt).getTime() - new Date(plan.trialStartedAt).getTime()) / DAY);
      assert.equal(days, 14);
      assert.equal(plan.firstChargeDate, plan.trialEndsAt);
      assert.equal(JSON.stringify(plan).includes('tok_'), false);
      assert.ok(pro.body.data.completedSteps.includes('plan'));

      // đổi về start: active, không còn thẻ; quay lại pro KHÔNG khởi động lại đồng hồ dùng thử
      const start = await step(u, id, 'plan', { planKey: 'start' });
      assert.equal(start.body.data.plan.status, 'active');
      assert.equal(start.body.data.plan.priceAmount, 0);
      const back = await c.call('PUT', `/communities/${id}/hosting-plan`, { token: u.token, body: { planKey: 'pro', paymentMethod: card() } });
      assert.equal(back.body.data.trialStartedAt, plan.trialStartedAt);
      assert.equal(back.body.data.trialEndsAt, plan.trialEndsAt);
    });

    it('không có PAN/CVC/token nào trong DB: chỉ brand/last4/hạn + token cổng', async () => {
      const u = await c.registerUser('nopan');
      const id = (await newDraft(u)).id;
      await step(u, id, 'plan', { planKey: 'pro', paymentMethod: card({ token: 'tok_mock_abcdef123456' }) });
      const rows = await db.prisma.paymentCard.findMany({ where: { userId: u.id } });
      assert.equal(rows.length, 1);
      assert.deepEqual(Object.keys(rows[0]!).sort(), ['brand', 'createdAt', 'expMonth', 'expYear', 'gatewayToken', 'id', 'last4', 'userId']);
      assert.ok(!/\d{13,19}/.test(JSON.stringify(rows)));
      const mine = await c.call('GET', '/me/payment-methods', { token: u.token });
      assert.deepEqual(Object.keys(mine.body.data[0]).sort(), ['brand', 'createdAt', 'expMonth', 'expYear', 'id', 'isDefault', 'last4']);
    });
  });

  describe('tài khoản nhận tiền (mô phỏng) + guard rút tiền', () => {
    it('connect/skip/read, masked, người khác 404; publish khi skipped được; rút tiền bị chặn tới khi kết nối', async () => {
      const u = await c.registerUser('po');
      const other = await c.registerUser('poo');
      const id = await readyDraft(u);
      assert.equal((await c.call('GET', `/communities/${id}/payout-account`, { token: u.token })).body.data, null);
      assert.equal((await c.call('GET', `/communities/${id}/payout-account`, { token: other.token })).status, 404);
      assert.equal((await c.call('PUT', `/communities/${id}/payout-account`, { token: u.token, body: { bankName: 'VCB', accountHolder: 'A', accountNumber: '12ab' } })).status, 400);
      const sk = await c.call('POST', `/communities/${id}/payout-account/skip`, { token: u.token });
      assert.equal(sk.body.data.status, 'skipped');

      const pub = await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } });
      assert.equal(pub.status, 201, 'skipped vẫn publish được');

      const payoutBody = { amountCents: 2_000_000 };
      const blocked = await c.call('POST', `/communities/${id}/payouts`, { token: u.token, body: payoutBody });
      assert.equal(blocked.status, 400);
      assert.equal(blocked.body.error.code, 'PAYOUT_ACCOUNT_REQUIRED');
      // cả khi gửi method trong body vẫn bị chặn khi chưa kết nối
      const blocked2 = await c.call('POST', `/communities/${id}/payouts`, { token: u.token, body: { amountCents: 2_000_000, method: { type: 'bank', bankName: 'VCB', accountNumber: '123456789', accountHolder: 'A' } } });
      assert.equal(blocked2.body.error.code, 'PAYOUT_ACCOUNT_REQUIRED');

      const conn = await c.call('PUT', `/communities/${id}/payout-account`, { token: u.token, body: { bankName: 'Vietcombank', accountHolder: 'NGUYEN VAN A', accountNumber: '0123456788812' } });
      assert.equal(conn.status, 200, JSON.stringify(conn.body));
      assert.equal(conn.body.data.status, 'connected');
      assert.equal(conn.body.data.accountMasked, '****8812');
      assert.equal(JSON.stringify(conn.body).includes('0123456788812'), false);
      assert.equal((await c.call('POST', `/communities/${id}/payout-account/skip`, { token: u.token })).body.data.status, 'connected', 'skip không ghi đè tài khoản đã kết nối');
      // đã kết nối: qua guard (hết tiền nên báo vượt số dư chứ không phải ACCOUNT_REQUIRED); method tùy chọn
      const afterConn = await c.call('POST', `/communities/${id}/payouts`, { token: u.token, body: payoutBody });
      assert.equal(afterConn.status, 400);
      assert.equal(afterConn.body.error.code, 'PAYOUT_EXCEEDS_AVAILABLE');
    });

    it('publish không qua bước payout ⇒ mặc định skipped; cộng đồng tạo kiểu cũ giữ luồng cũ', async () => {
      const u = await c.registerUser('po2');
      const id = await readyDraft(u);
      await c.call('POST', `/communities/${id}/publish`, { token: u.token, body: { acceptTerms: true } });
      assert.equal((await c.call('GET', `/communities/${id}/payout-account`, { token: u.token })).body.data.status, 'skipped');

      const legacy = await c.call('POST', '/communities', { token: u.token, body: { title: 'Cũ Một Phát', description: 'd', category: 'tech', priceUsd: 125_000, visibility: 'public' } });
      assert.equal(legacy.status, 201);
      assert.equal((await c.call('GET', `/communities/${legacy.body.data.id}/payout-account`, { token: u.token })).body.data, null);
      const r = await c.call('POST', `/communities/${legacy.body.data.id}/payouts`, { token: u.token, body: { amountCents: 2_000_000, method: { type: 'bank', bankName: 'VCB', accountNumber: '123456789', accountHolder: 'A' } } });
      assert.equal(r.body.error.code, 'PAYOUT_EXCEEDS_AVAILABLE');
      assert.equal((await c.call('POST', `/communities/${legacy.body.data.id}/payouts`, { token: u.token, body: { amountCents: 2_000_000 } })).body.error.code, 'PAYOUT_ACCOUNT_REQUIRED');
    });
  });

  describe('POST /communities một phát vẫn tương thích + trường mới', () => {
    it('không gửi trường mới ⇒ mặc định; có giá năm hợp lệ ⇒ lưu; giá năm vượt ⇒ 400; PATCH sau publish', async () => {
      const u = await c.registerUser('legacy');
      const a = await c.call('POST', '/communities', { token: u.token, body: { title: 'Một Phát', description: 'd', category: 'tech', priceUsd: 0, visibility: 'public' } });
      assert.equal(a.status, 201);
      assert.equal(a.body.data.priceAnnualUsd, null);
      assert.equal(a.body.data.memberTrialEnabled, true);
      assert.deepEqual(a.body.data.joinQuestions, []);
      const b = await c.call('POST', '/communities', { token: u.token, body: { title: 'Có Năm', description: 'd', category: 'tech', priceUsd: 175_000, priceAnnualUsd: 1_200_000, visibility: 'public' } });
      assert.equal(b.status, 201);
      assert.equal(b.body.data.annualSavingsPct, 43);
      assert.equal((await c.call('POST', '/communities', { token: u.token, body: { title: 'Sai Năm', description: 'd', category: 'tech', priceUsd: 175_000, priceAnnualUsd: 2_475_000, visibility: 'public' } })).status, 400);

      const p = await c.call('PATCH', `/communities/${b.body.data.id}`, { token: u.token, body: { priceAnnualUsd: 1_500_000, promise: 'Lời hứa', brandColor: '#112233', joinQuestions: ['Bạn là ai vậy?'] } });
      assert.equal(p.status, 200, JSON.stringify(p.body));
      assert.equal(p.body.data.priceAnnualUsd, 1_500_000);
      assert.equal(p.body.data.promise, 'Lời hứa');
      assert.equal((await c.call('PATCH', `/communities/${b.body.data.id}`, { token: u.token, body: { priceAnnualUsd: 2_500_000 } })).status, 400);
      assert.equal((await c.call('PATCH', `/communities/${b.body.data.id}`, { token: u.token, body: { priceUsd: 0 } })).body.data.priceAnnualUsd, null);
    });
  });

  describe('câu hỏi gia nhập → yêu cầu tham gia', () => {
    async function privateCommunity(owner: { token: string; id: string }, members: Record<string, unknown> = {}) {
      const id = await readyDraft(owner, { visibility: 'private', joinQuestions: ['Bạn đã làm gốm chưa?', 'Biết đến lớp từ đâu?'], ...members });
      const r = await c.call('POST', `/communities/${id}/publish`, { token: owner.token, body: { acceptTerms: true } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      return id;
    }

    it('bắt buộc trả lời đủ, lưu bản chụp câu hỏi, admin thấy câu trả lời; cộng đồng không câu hỏi giữ luồng cũ', async () => {
      const owner = await c.registerUser('jq');
      const m = await c.registerUser('jqm');
      const id = await privateCommunity(owner);
      assert.deepEqual((await c.call('GET', `/communities/${id}`)).body.data.joinQuestions, ['Bạn đã làm gốm chưa?', 'Biết đến lớp từ đâu?']);

      const none = await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { message: 'Cho em vào' } });
      assert.equal(none.status, 400);
      assert.equal(none.body.error.code, 'JOIN_ANSWERS_REQUIRED');
      assert.equal((await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { answers: ['Chưa'] } })).body.error.code, 'JOIN_ANSWERS_REQUIRED');
      assert.equal((await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { answers: ['Chưa', '  '] } })).body.error.code, 'JOIN_ANSWERS_REQUIRED');

      const ok = await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { message: 'Cho em vào', answers: ['Chưa từng', 'Qua Facebook'] } });
      assert.equal(ok.status, 201, JSON.stringify(ok.body));
      assert.deepEqual(ok.body.data.answers, [{ question: 'Bạn đã làm gốm chưa?', answer: 'Chưa từng' }, { question: 'Biết đến lớp từ đâu?', answer: 'Qua Facebook' }]);

      // đổi câu hỏi sau đó: yêu cầu cũ vẫn giữ bản chụp
      await c.call('PATCH', `/communities/${id}`, { token: owner.token, body: { joinQuestions: ['Câu hỏi mới?'] } });
      const list = await c.call('GET', `/communities/${id}/join-requests?status=pending`, { token: owner.token });
      assert.equal(list.status, 200);
      assert.equal(list.body.data[0].answers[0].question, 'Bạn đã làm gốm chưa?');
      assert.equal(list.body.data[0].answers[1].answer, 'Qua Facebook');
      assert.equal((await c.call('GET', `/communities/${id}/join-requests`, { token: m.token })).status, 403);

      // cộng đồng riêng tư không câu hỏi: luồng cũ
      const plain = await privateCommunity(await c.registerUser('jq2'), { joinQuestions: [] });
      const m2 = await c.registerUser('jqm2');
      const r2 = await c.call('POST', `/communities/${plain}/join-requests`, { token: m2.token, body: { message: 'hi' } });
      assert.equal(r2.status, 201);
      assert.deepEqual(r2.body.data.answers, []);
    });

    it('requireRulesAgreement + có nội quy ⇒ phải acceptRules', async () => {
      const owner = await c.registerUser('jr');
      const id = await privateCommunity(owner, { joinQuestions: [], rules: [{ title: 'Tôn trọng' }], requireRulesAgreement: true });
      const m = await c.registerUser('jrm');
      assert.equal((await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { message: 'x' } })).body.error.code, 'RULES_NOT_ACCEPTED');
      const ok = await c.call('POST', `/communities/${id}/join-requests`, { token: m.token, body: { acceptRules: true } });
      assert.equal(ok.status, 201);
      assert.ok(ok.body.data.rulesAcceptedAt);
    });
  });

  describe('danh sách ra mắt + điều kiện Khám phá', () => {
    it('tính từ dữ liệu thật; chủ mới; chưa publish → 409; người khác 403', async () => {
      const u = await c.registerUser('lc');
      const other = await c.registerUser('lco');
      const d = await newDraft(u);
      assert.equal((await c.call('GET', `/communities/${d.id}/launch-checklist`, { token: u.token })).body.error.code, 'NOT_PUBLISHED');
      await step(u, d.id, 'members', { priceUsd: 0 });
      await step(u, d.id, 'identity', { promise: 'Lời hứa', coverUrl: await makeUpload(u.id, 'cover') });
      await c.call('POST', `/communities/${d.id}/publish`, { token: u.token, body: { acceptTerms: true } });
      assert.equal((await c.call('GET', `/communities/${d.id}/launch-checklist`, { token: other.token })).status, 403);

      const r = (await c.call('GET', `/communities/${d.id}/launch-checklist`, { token: u.token })).body.data;
      assert.equal(r.total, 6);
      const byKey = Object.fromEntries(r.items.map((i: { key: string; done: boolean }) => [i.key, i.done]));
      assert.deepEqual(byKey, { created: true, identity: true, payout: false, first_lesson: false, welcome_post: false, invite_members: false });
      assert.equal(r.doneCount, 2);
      assert.equal(r.discovery.eligible, false);
      const cond = Object.fromEntries(r.discovery.conditions.map((x: { key: string; met: boolean }) => [x.key, x.met]));
      assert.equal(cond.has_description_and_promise, true);
      assert.equal(cond.has_cover, true);
      assert.equal(cond.min_members, false);
      assert.equal(cond.recent_post, false);

      await c.call('POST', `/communities/${d.id}/payout-account/skip`, { token: u.token });
      await c.call('PUT', `/communities/${d.id}/payout-account`, { token: u.token, body: { bankName: 'VCB', accountHolder: 'A', accountNumber: '123456789' } });
      await db.prisma.post.create({ data: { communityId: d.id, authorId: u.id, content: 'Chào mừng', pinned: true } });
      const r2 = (await c.call('GET', `/communities/${d.id}/launch-checklist`, { token: u.token })).body.data;
      const k2 = Object.fromEntries(r2.items.map((i: { key: string; done: boolean }) => [i.key, i.done]));
      assert.equal(k2.payout, true);
      assert.equal(k2.welcome_post, true);
      assert.equal(r2.discovery.conditions.find((x: { key: string }) => x.key === 'recent_post').met, true);
    });
  });

  describe('Global Settings & alias', () => {
    it('route cố định /communities/* không bị alias nuốt; /courses/:id/draft cũng chạy', async () => {
      const u = await c.registerUser('al');
      const d = await newDraft(u);
      assert.equal((await c.call('GET', `/courses/${d.id}/draft`, { token: u.token })).status, 200);
      assert.equal((await c.call('GET', '/communities/slug-available?slug=zzz-free-slug')).status, 200);
    });
  });
});
