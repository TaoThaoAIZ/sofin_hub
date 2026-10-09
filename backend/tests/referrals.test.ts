import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const DAY = 86_400_000;

describe('chương trình giới thiệu: mã, ghi nhận, hoa hồng, KPI', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let referralsService: typeof import('../src/modules/referrals/referrals.service.js').referralsService;
  let referralsRepository: typeof import('../src/modules/referrals/referrals.repository.js').referralsRepository;
  let writeOverrides: typeof import('../src/modules/settings/settings.service.js').writeOverrides;
  let flushNotifications: typeof import('../src/modules/notifications/notifications.service.js').flushNotifications;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    ({ referralsService } = await import('../src/modules/referrals/referrals.service.js'));
    ({ referralsRepository } = await import('../src/modules/referrals/referrals.repository.js'));
    ({ writeOverrides } = await import('../src/modules/settings/settings.service.js'));
    ({ flushNotifications } = await import('../src/modules/notifications/notifications.service.js'));
  });
  after(() => server.close());

  let n = 0;
  /** Đăng ký user (tùy chọn kèm mã giới thiệu) qua API thật. */
  async function signup(prefix: string, referralCode?: string) {
    const email = `${prefix}-${Date.now()}-${n++}@test.local`;
    const r = await c.registerVerified({ email, password: 'Passw0rd!x', firstName: 'Ref', lastName: prefix, ...(referralCode !== undefined ? { referralCode } : {}) });
    assert.ok(r.status < 300, JSON.stringify(r.body));
    return { token: r.body.data.accessToken as string, id: r.body.data.user.id as string };
  }
  const overview = async (u: { token: string }, kind = 'member') => (await c.call('GET', `/me/referral?kind=${kind}`, { token: u.token })).body.data;
  const codeOf = async (u: { token: string }) => (await overview(u)).code as string;

  async function paidCommunity(priceVnd = 250_000) {
    const owner = await signup('own');
    const r = await c.call('POST', '/communities', { token: owner.token, body: { title: `Ref ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: priceVnd, visibility: 'public' } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { id: r.body.data.id as string, owner };
  }
  async function pay(user: { token: string }, communityId: string) {
    const co = await c.call('POST', `/communities/${communityId}/checkout`, { token: user.token, body: { method: 'stripe' } });
    assert.equal(co.status, 201, JSON.stringify(co.body));
    const cf = await c.payIntent(co.body.data.id, user.token);
    assert.equal(cf.status, 200, JSON.stringify(cf.body));
    return cf.body.data as { id: string; amountCents: number };
  }

  describe('GET /me/referral', () => {
    it('cần đăng nhập', async () => {
      assert.equal((await c.call('GET', '/me/referral')).status, 401);
      assert.equal((await c.call('GET', '/me/referral/users')).status, 401);
    });

    it('user mới: mã + link ổn định, tỉ lệ mặc định, KPI = 0 và không có delta', async () => {
      const u = await signup('fresh');
      const a = await overview(u);
      assert.match(a.code, /^[a-z0-9._]{3,32}$/);
      assert.ok(a.link.endsWith(`/gioi-thieu/${a.code}`), a.link);
      assert.deepEqual(a.rates, { creatorRateBps: 3000, memberRateBps: 1000, rateBps: 1000, attributionDays: 60, payoutDay: 5 });
      assert.equal(a.currency, 'VND');
      assert.deepEqual(a.kpis.registered, { value: 0, delta: null });
      assert.deepEqual(a.kpis.paying, { value: 0 });
      assert.deepEqual(a.kpis.commissionThisMonth, { cents: 0, deltaPct: null });
      assert.equal(a.kpis.pendingPayout.cents, 0);
      assert.match(a.kpis.pendingPayout.payoutOn, /-\d{2}-05T00:00:00\.000Z$/);
      assert.equal((await overview(u)).code, a.code); // ổn định giữa các lần gọi
      const cr = await overview(u, 'creator');
      assert.equal(cr.currency, 'VND');
      assert.equal(cr.rates.rateBps, 3000);
      const users = await c.call('GET', '/me/referral/users?kind=creator', { token: u.token });
      assert.deepEqual(users.body, { data: [], meta: { total: 0, shown: 0, currency: 'VND' } });
    });

    it('kind sai → 400', async () => {
      const u = await signup('badkind');
      assert.equal((await c.call('GET', '/me/referral?kind=zzz', { token: u.token })).status, 400);
    });

    it('mã mặc định = handle của user (nếu đã đặt), chữ thường', async () => {
      const u = await signup('hdl');
      const handle = `han_${randomBytes(3).toString('hex')}`;
      await db.prisma.user.update({ where: { id: u.id }, data: { handle } });
      assert.equal(await codeOf(u), handle);
    });

    it('handle đã bị mã của người khác chiếm → sinh mã ngẫu nhiên khác', async () => {
      const a = await signup('taken1');
      const b = await signup('taken2');
      const code = await codeOf(a);
      await db.prisma.user.update({ where: { id: b.id }, data: { handle: code } });
      const bCode = await codeOf(b);
      assert.notEqual(bCode, code);
    });
  });

  describe('ghi nhận khi đăng ký (POST /auth/register { referralCode })', () => {
    it('mã hợp lệ → tạo Referral với expiresAt = now + 60 ngày; không phân biệt hoa thường', async () => {
      const ref = await signup('ref');
      const code = await codeOf(ref);
      const before = Date.now();
      const friend = await signup('friend', code.toUpperCase());
      const row = await db.prisma.referral.findUnique({ where: { referredUserId: friend.id } });
      assert.equal(row?.referrerId, ref.id);
      assert.equal(row?.code, code);
      const days = (row!.expiresAt.getTime() - before) / DAY;
      assert.ok(days > 59.99 && days < 60.01, String(days));
      const o = await overview(ref);
      assert.equal(o.kpis.registered.value, 1);
      assert.equal(o.kpis.registered.delta, 1);
    });

    it('mã lạ / rỗng / không có → đăng ký vẫn thành công, không có Referral', async () => {
      for (const code of ['khong-ton-tai-xyz', '', undefined]) {
        const u = await signup('noref', code);
        assert.equal(await db.prisma.referral.count({ where: { referredUserId: u.id } }), 0);
      }
    });

    it('mã quá dài → 400', async () => {
      const r = await c.registerVerified({ email: `long-${Date.now()}@test.local`, password: 'Passw0rd!x', firstName: 'A', lastName: 'B', referralCode: 'x'.repeat(65) });
      assert.equal(r.status, 400);
    });

    it('không tự giới thiệu và không ghi nhận lần hai', async () => {
      const ref = await signup('self');
      const other = await signup('other');
      const code = await codeOf(ref);
      assert.equal(await referralsService.attribute(ref.id, code), false); // tự giới thiệu
      const friend = await signup('once', code);
      assert.equal(await referralsService.attribute(friend.id, await codeOf(other)), false); // đã có người giới thiệu
      const row = await db.prisma.referral.findUnique({ where: { referredUserId: friend.id } });
      assert.equal(row?.referrerId, ref.id);
    });

    it('cửa sổ ghi nhận đọc từ Global Settings (referral.attributionDays)', async () => {
      const ref = await signup('win');
      const code = await codeOf(ref);
      await writeOverrides({ 'referral.attributionDays': 10 }, null);
      try {
        const f = await signup('win-f', code);
        const row = await db.prisma.referral.findUnique({ where: { referredUserId: f.id } });
        assert.ok(Math.abs((row!.expiresAt.getTime() - Date.now()) / DAY - 10) < 0.01);
      } finally {
        await writeOverrides({}, null);
      }
    });
  });

  describe('hoa hồng thành viên (member) từ thanh toán thành công', () => {
    it('thanh toán đầu → hoa hồng pending = 10% × số tiền; confirm lặp không nhân đôi; KPI & bảng đúng', async () => {
      const { id: communityId } = await paidCommunity();
      const ref = await signup('mref');
      const friend = await signup('mfriend', await codeOf(ref));
      const p = await pay(friend, communityId);
      assert.equal(p.amountCents, 250_000);

      await c.payIntent(p.id, friend.token); // gọi lại: idempotent
      const rows = await db.prisma.referralCommission.findMany({ where: { referrerId: ref.id } });
      assert.equal(rows.length, 1);
      assert.deepEqual(
        { kind: rows[0]!.kind, status: rows[0]!.status, base: rows[0]!.baseCents, rate: rows[0]!.rateBps, amount: rows[0]!.amountCents, src: rows[0]!.sourceRef, community: rows[0]!.communityId },
        { kind: 'member', status: 'pending', base: 250_000, rate: 1000, amount: 25_000, src: `payment:${p.id}`, community: communityId },
      );

      const o = await overview(ref);
      assert.equal(o.kpis.paying.value, 1);
      assert.equal(o.kpis.commissionThisMonth.cents, 25_000);
      assert.equal(o.kpis.commissionThisMonth.deltaPct, null); // tháng trước chưa có số liệu
      assert.equal(o.kpis.pendingPayout.cents, 25_000);

      const users = (await c.call('GET', '/me/referral/users?kind=member', { token: ref.token })).body;
      assert.equal(users.meta.total, 1);
      assert.equal(users.data[0].userId, friend.id);
      assert.equal(users.data[0].status, 'paid');
      assert.equal(users.data[0].communityId, communityId);
      assert.equal(users.data[0].earnedCents, 25_000);

      // Tab creator của cùng người: người này chưa mở cộng đồng → không phát sinh gì.
      const cr = (await c.call('GET', '/me/referral/users?kind=creator', { token: ref.token })).body.data[0];
      assert.equal(cr.status, 'none');
      assert.equal(cr.earnedCents, 0);
      assert.equal((await overview(ref, 'creator')).kpis.commissionThisMonth.cents, 0);
    });

    it('người dùng không có người giới thiệu → không có hoa hồng', async () => {
      const { id } = await paidCommunity(125_000);
      const buyer = await signup('plain');
      const before = await db.prisma.referralCommission.count();
      await pay(buyer, id);
      assert.equal(await db.prisma.referralCommission.count(), before);
    });

    it('hết cửa sổ ghi nhận TRƯỚC lần thanh toán đầu → không có hoa hồng', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('exp');
      const friend = await signup('exp-f', await codeOf(ref));
      await db.prisma.referral.update({ where: { referredUserId: friend.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
      await pay(friend, id);
      assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: ref.id } }), 0);
    });

    it('đã có hoa hồng ở lần đầu → các kỳ sau vẫn tính dù cửa sổ đã hết (định kỳ)', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('rec');
      const friend = await signup('rec-f', await codeOf(ref));
      await pay(friend, id);
      await db.prisma.referral.update({ where: { referredUserId: friend.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
      await referralsService.onPaymentSucceeded({ id: `renewal-${randomBytes(4).toString('hex')}`, userId: friend.id, communityId: id, amountCents: 250_000 });
      assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: ref.id } }), 2);
    });

    it('tỉ lệ đọc từ Global Settings (referral.memberRateBps) và lưu lại tỉ lệ đã áp', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('rate');
      const friend = await signup('rate-f', await codeOf(ref));
      await writeOverrides({ 'referral.memberRateBps': 2500 }, null);
      try {
        await pay(friend, id);
        const row = await db.prisma.referralCommission.findFirst({ where: { referrerId: ref.id } });
        assert.equal(row?.rateBps, 2500);
        assert.equal(row?.amountCents, 62_500);
        assert.equal((await overview(ref)).rates.memberRateBps, 2500);
      } finally {
        await writeOverrides({}, null);
      }
    });

    it('hoàn tiền toàn bộ → hoa hồng pending bị hủy (void), KPI về 0', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('void');
      const friend = await signup('void-f', await codeOf(ref));
      const p = await pay(friend, id);
      const r = await c.call('POST', `/payments/${p.id}/refund-request`, { token: friend.token, body: { reason: 'đổi ý rồi' } });
      assert.equal(r.status, 201, JSON.stringify(r.body));
      assert.equal(r.body.data.status, 'approved'); // trong cửa sổ hoàn tiền → tự duyệt
      const row = await db.prisma.referralCommission.findFirst({ where: { referrerId: ref.id } });
      assert.equal(row?.status, 'void');
      const o = await overview(ref);
      assert.equal(o.kpis.commissionThisMonth.cents, 0);
      assert.equal(o.kpis.pendingPayout.cents, 0);
      const users = (await c.call('GET', '/me/referral/users?kind=member', { token: ref.token })).body.data;
      assert.equal(users[0].earnedCents, 0);
    });

    it('lỗi trong logic giới thiệu KHÔNG làm hỏng thanh toán', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('iso');
      const friend = await signup('iso-f', await codeOf(ref));
      const orig = referralsRepository.findReferralOf;
      const errLog = console.error;
      console.error = () => undefined;
      referralsRepository.findReferralOf = async () => {
        throw new Error('db sập giả lập');
      };
      try {
        const p = await pay(friend, id); // pay() tự assert 201 + 200
        assert.ok(p.id);
      } finally {
        referralsRepository.findReferralOf = orig;
        console.error = errLog;
      }
      assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: ref.id } }), 0);
      // Job đối soát bù hoa hồng còn thiếu.
      const r = await referralsService.reconcileCommissions();
      assert.ok(r.created >= 1);
      assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: ref.id } }), 1);
      assert.equal((await referralsService.reconcileCommissions()).created, 0); // lần hai không tạo thêm
    });

    it('delta % so với tháng trước chỉ hiện khi tháng trước có số liệu', async () => {
      const { id } = await paidCommunity();
      const ref = await signup('delta');
      const friend = await signup('delta-f', await codeOf(ref));
      await pay(friend, id); // 25.000đ trong tháng này
      const last = new Date();
      last.setUTCMonth(last.getUTCMonth() - 1, 15);
      await db.prisma.referralCommission.create({
        data: { referrerId: ref.id, referredUserId: friend.id, kind: 'member', sourceRef: `payment:old-${randomBytes(4).toString('hex')}`, baseCents: 125_000, rateBps: 1000, amountCents: 12_500, createdAt: last },
      });
      const o = await overview(ref);
      assert.equal(o.kpis.commissionThisMonth.cents, 25_000);
      assert.equal(o.kpis.commissionThisMonth.deltaPct, 100); // (25.000 - 12.500) / 12.500
    });
  });

  describe('hoa hồng người tạo cộng đồng (creator) + trạng thái theo gói hosting', () => {
    it('onHostingCharge: 30% × phí gói (VND), idempotent theo chargeRef; bảng creator hiện cộng đồng + trạng thái', async () => {
      const ref = await signup('cref');
      const friend = await signup('cfriend', await codeOf(ref));
      // friend mở cộng đồng + gói Chuyên nghiệp đang dùng thử
      const created = await c.call('POST', '/communities', { token: friend.token, body: { title: `Creator ${Date.now().toString(36)}${n++}`, description: 'd', category: 'tech', priceUsd: 0, visibility: 'public' } });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const communityId = created.body.data.id as string;
      await db.prisma.hostingPlan.create({ data: { communityId, ownerId: friend.id, planKey: 'pro', cycle: 'monthly', priceAmount: 299_000, currency: 'VND', status: 'trialing' } });

      const rowsTrial = (await c.call('GET', '/me/referral/users?kind=creator', { token: ref.token })).body.data;
      assert.equal(rowsTrial[0].status, 'trial');
      assert.equal(rowsTrial[0].communityId, communityId);

      await db.prisma.hostingPlan.update({ where: { communityId }, data: { status: 'active' } });
      await referralsService.onHostingCharge({ ownerId: friend.id, communityId, chargeRef: `h-${communityId}-1`, amount: 299_000 });
      await referralsService.onHostingCharge({ ownerId: friend.id, communityId, chargeRef: `h-${communityId}-1`, amount: 299_000 }); // lặp
      const o = await overview(ref, 'creator');
      assert.equal(o.kpis.commissionThisMonth.cents, 89_700); // 30% của 299.000
      assert.equal(o.kpis.paying.value, 1);
      assert.equal(o.currency, 'VND');
      assert.equal(await db.prisma.referralCommission.count({ where: { referrerId: ref.id, kind: 'creator' } }), 1);
      // Tab member của cùng người không bị lẫn hoa hồng creator.
      assert.equal((await overview(ref, 'member')).kpis.commissionThisMonth.cents, 0);
    });
  });

  describe('danh sách người được giới thiệu & hành động trên dòng', () => {
    it('?all=false chỉ 4 dòng đầu (mới nhất trước), ?all=true trả đủ; total luôn là tổng', async () => {
      const ref = await signup('many');
      const code = await codeOf(ref);
      for (let i = 0; i < 6; i++) await signup(`m${i}`, code);
      const short = (await c.call('GET', '/me/referral/users?kind=member', { token: ref.token })).body;
      assert.equal(short.data.length, 4);
      assert.equal(short.meta.total, 6);
      const full = (await c.call('GET', '/me/referral/users?kind=member&all=true', { token: ref.token })).body;
      assert.equal(full.data.length, 6);
      assert.ok(full.data.every((r: { status: string; communityName: string | null }) => r.status === 'none' && r.communityName === null));
      const times = full.data.map((r: { signedUpAt: string }) => r.signedUpAt);
      assert.deepEqual([...times].sort().reverse(), times);
    });

    it('người dùng thử: trạng thái trial + nhắc nâng cấp gửi thông báo thật, 1 lần / 24h; người đã trả phí thì 409', async () => {
      const { id: communityId } = await paidCommunity();
      const ref = await signup('rem');
      const code = await codeOf(ref);
      const trialer = await signup('rem-t', code);
      const payer = await signup('rem-p', code);
      const t = await c.call('POST', `/communities/${communityId}/trial`, { token: trialer.token, body: {} });
      assert.equal(t.status, 201, JSON.stringify(t.body));
      await pay(payer, communityId);

      const rows = (await c.call('GET', '/me/referral/users?kind=member&all=true', { token: ref.token })).body.data as { userId: string; status: string }[];
      assert.equal(rows.find((r) => r.userId === trialer.id)?.status, 'trial');
      assert.equal(rows.find((r) => r.userId === payer.id)?.status, 'paid');

      const ok = await c.call('POST', `/me/referral/users/${trialer.id}/remind?kind=member`, { token: ref.token });
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      await flushNotifications();
      const notes = await db.prisma.notification.findMany({ where: { userId: trialer.id, title: 'Lời nhắc nâng cấp gói' } });
      assert.equal(notes.length, 1);
      assert.equal(notes[0]!.link, `/communities/${communityId}/checkout`);
      assert.equal((await c.call('POST', `/me/referral/users/${trialer.id}/remind?kind=member`, { token: ref.token })).status, 429);
      assert.equal((await c.call('POST', `/me/referral/users/${payer.id}/remind?kind=member`, { token: ref.token })).status, 409);
      // Người không do mình giới thiệu → 404
      const stranger = await signup('stranger');
      assert.equal((await c.call('POST', `/me/referral/users/${trialer.id}/remind?kind=member`, { token: stranger.token })).status, 404);
    });

    it('chi tiết hoa hồng của 1 người: tổng + từng khoản; người lạ → 404', async () => {
      const { id } = await paidCommunity(500_000);
      const ref = await signup('det');
      const friend = await signup('det-f', await codeOf(ref));
      const p = await pay(friend, id);
      const d = await c.call('GET', `/me/referral/users/${friend.id}/commissions?kind=member`, { token: ref.token });
      assert.equal(d.status, 200, JSON.stringify(d.body));
      assert.equal(d.body.data.totalCents, 50_000);
      assert.equal(d.body.data.currency, 'VND');
      assert.equal(d.body.data.data.length, 1);
      assert.deepEqual({ base: d.body.data.data[0].baseCents, rate: d.body.data.data[0].rateBps, amount: d.body.data.data[0].amountCents, status: d.body.data.data[0].status }, { base: p.amountCents, rate: 1000, amount: 50_000, status: 'pending' });
      const stranger = await signup('det-x');
      assert.equal((await c.call('GET', `/me/referral/users/${friend.id}/commissions?kind=member`, { token: stranger.token })).status, 404);
    });
  });

  describe('Global Settings: khóa referral.*', () => {
    it('mặc định 3000/1000/60/5; admin ghi đè được và sai kiểu bị bỏ qua', async () => {
      const { cfg, buildConfig } = await import('../src/modules/settings/settings.service.js');
      assert.deepEqual(cfg().referral, { creatorRateBps: 3000, memberRateBps: 1000, attributionDays: 60, payoutDay: 5 });
      assert.equal(buildConfig({ 'referral.payoutDay': 31 }).referral.payoutDay, 5); // ngoài 1-28 → dùng mặc định
      assert.equal(buildConfig({ 'referral.payoutDay': 10 }).referral.payoutDay, 10);
    });

    it('ngày chi trả đọc từ referral.payoutDay', async () => {
      await writeOverrides({ 'referral.payoutDay': 12 }, null);
      try {
        const u = await signup('payday');
        assert.match((await overview(u)).kpis.pendingPayout.payoutOn, /-12T00:00:00\.000Z$/);
      } finally {
        await writeOverrides({}, null);
      }
    });
  });
});
