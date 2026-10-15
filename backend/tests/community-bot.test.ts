import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ensureMainCourse, makeClient, startTestServer, useTestDb, type TestDb, type TestServer } from './helpers.js';

const ADMIN_EMAIL = 'pa-community-bot@test.local';
process.env.PLATFORM_ADMIN_EMAILS = ADMIN_EMAIL;
// Model giả (không gọi ChatGPT) + lưu nguyên văn prompt vào toolCalls (`_trace`) để kiểm tra rò rỉ bài khóa.
process.env.CHATBOT_FAKE_MODEL = '1';
process.env.CHATBOT_TRACE_CONTEXT = '1';
process.env.CHATBOT_CODEX_HOME = (await import('node:path')).join((await import('node:os')).tmpdir(), `sofinhub-codex-cbot-${process.pid}`);

type U = { token: string; id: string; email: string };

/** Chatbot riêng của cộng đồng (chatbot.md): gói Pro, 2 mức thành viên, nhân cách, không rò rỉ bài khóa, cô lập dữ liệu, chuyển cho chủ. */
describe('chatbot cộng đồng', () => {
  let server: TestServer;
  let db: TestDb;
  let c: ReturnType<typeof makeClient>;
  let fake: typeof import('../src/modules/chatbot/chatbot.fake-model.js');
  let seq = 0;
  const uniq = (p: string) => `${p}${Date.now().toString(36)}${seq++}`;
  const DAY = 24 * 3600_000;

  const api = (u: U, method: string, communityId: string, path: string, body?: unknown) => c.call(method, `/communities/${communityId}/bot${path}`, { token: u.token, body });

  /** Cộng đồng + chủ (owner). `paid` => cộng đồng trả phí. `plan` => gói hosting của chủ. */
  async function community(owner: U, opts: { paid?: boolean; plan?: 'pro' | 'start' | 'pro-expired' | null } = {}) {
    const id = uniq('cb-');
    await db.prisma.community.create({
      data: {
        id, title: `Cộng đồng ${id}`, description: 'Cộng đồng học lập trình Python cho người mới bắt đầu.', category: 'tech' as never, thumbnail: '/x.webp',
        instructorName: 'Thầy A', instructorRole: 'Giảng viên', priceCents: opts.paid ? 199000 : 0, pricing: opts.paid ? 'paid' : 'free', ownerId: owner.id,
        rules: [{ title: 'Không quảng cáo', body: 'Không đăng quảng cáo trong cộng đồng' }],
      },
    });
    await db.prisma.enrollment.create({ data: { userId: owner.id, communityId: id, role: 'owner' } });
    const plan = opts.plan === undefined ? 'pro' : opts.plan;
    if (plan) {
      await db.prisma.hostingPlan.create({
        data: {
          communityId: id, ownerId: owner.id, planKey: plan === 'start' ? 'start' : 'pro', priceAmount: 299000, currency: 'VND',
          status: 'trialing', trialStartedAt: new Date(), trialEndsAt: new Date(Date.now() + (plan === 'pro-expired' ? -1 : 14) * DAY),
        },
      });
    }
    return id;
  }
  const join_ = (u: U, communityId: string, role: 'member' | 'mod' | 'admin' = 'member') =>
    db.prisma.enrollment.upsert({ where: { userId_communityId: { userId: u.id, communityId } }, create: { userId: u.id, communityId, role }, update: { role } });
  const subscribe = (u: U, communityId: string, end = new Date(Date.now() + 30 * DAY)) =>
    db.prisma.subscription.create({ data: { userId: u.id, communityId, status: 'active', priceCents: 199000, currentPeriodStart: new Date(), currentPeriodEnd: end } });
  const enable = async (owner: U, communityId: string, extra: Record<string, unknown> = {}) => {
    const r = await api(owner, 'PATCH', communityId, '/settings', { enabled: true, ...extra });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  };
  const start = async (u: U, communityId: string) => {
    const r = await api(u, 'POST', communityId, '/conversations');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.data.conversation.id as string;
  };
  const say = async (u: U, communityId: string, conv: string, text: string) => {
    const r = await api(u, 'POST', communityId, `/conversations/${conv}/messages`, { text });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data as { message: { id: string; content: string; answerSource: string }; handoffOffer: { reason: string } | null; quota: { tier: string; remaining: number } };
  };
  /** Prompt nguyên văn + nguồn đã đưa vào ngữ cảnh của tin bot gần nhất. */
  async function lastTrace(conv: string) {
    const m = await db.prisma.chatbotMessage.findFirstOrThrow({ where: { conversationId: conv, role: 'assistant' }, orderBy: { createdAt: 'desc' } });
    const calls = (m.toolCalls ?? []) as { name: string; prompt?: string; key?: string; tier?: string; lessonIds?: string[]; lockedLessonIds?: string[] }[];
    return { prompt: calls.find((x) => x.name === '_trace')?.prompt ?? '', persona: calls.find((x) => x.name === 'persona'), sources: calls.find((x) => x.name === 'sources') };
  }

  let owner: U;
  let admin: U;
  let member: U;
  let outsider: U;

  before(async () => {
    server = await startTestServer();
    db = await useTestDb();
    c = makeClient(server.baseUrl);
    fake = await import('../src/modules/chatbot/chatbot.fake-model.js');
    owner = await c.registerUser('cbowner');
    admin = await c.registerUser('cbadmin');
    member = await c.registerUser('cbmember');
    outsider = await c.registerUser('cbout');
  });
  after(() => server.close());
  beforeEach(() => fake.resetFake());

  describe('phân quyền + gói Pro', () => {
    it('chỉ chủ bật được và chỉ khi gói Pro còn hiệu lực; status trả lý do cho từng trường hợp', async () => {
      const noPro = await community(owner, { plan: 'start' });
      assert.equal((await api(owner, 'PATCH', noPro, '/settings', { enabled: true })).body.error.code, 'COMMUNITY_NOT_PRO');
      const expired = await community(owner, { plan: 'pro-expired' });
      assert.equal((await api(owner, 'PATCH', expired, '/settings', { enabled: true })).body.error.code, 'COMMUNITY_NOT_PRO');

      const id = await community(owner);
      await join_(admin, id, 'admin');
      await join_(member, id);
      assert.equal((await api(member, 'GET', id, '/status')).body.data.reason, 'BOT_DISABLED');
      assert.equal((await api(member, 'GET', id, '/settings')).status, 403, 'thành viên thường không xem cài đặt');
      assert.equal((await api(admin, 'PATCH', id, '/settings', { enabled: true })).status, 403, 'admin không phải chủ không bật được');
      assert.equal((await api(admin, 'PATCH', id, '/settings', { botName: 'Mèo Học' })).status, 200, 'admin sửa nội dung được');
      await enable(owner, id);
      assert.equal((await api(member, 'GET', id, '/status')).body.data.available, true);
      assert.equal((await api(outsider, 'GET', id, '/status')).body.data.reason, 'NOT_MEMBER');
      assert.equal((await api(outsider, 'POST', id, '/conversations')).status, 403);

      // Gói Pro hết hạn sau khi đã bật => bot ngừng.
      await db.prisma.hostingPlan.update({ where: { communityId: id }, data: { trialEndsAt: new Date(Date.now() - 1000) } });
      assert.equal((await api(member, 'GET', id, '/status')).body.data.reason, 'COMMUNITY_NOT_PRO');
    });
  });

  describe('2 mức thành viên', () => {
    it('thành viên thường: chat được, nhân cách mặc định, đổi nhân cách => 402 VIP_REQUIRED, hết lượt => 429 DAILY_LIMIT (tier free)', async () => {
      const id = await community(owner);
      await join_(member, id);
      await enable(owner, id, { personaKey: 'mentor', memberPersonaKeys: ['buddy'], freeDailyMessages: 2 });
      const st = (await api(member, 'GET', id, '/status')).body.data;
      assert.equal(st.tier, 'free');
      assert.equal(st.canChoosePersona, false);
      assert.equal(st.upgradeAvailable, false, 'cộng đồng miễn phí: không có dải nâng cấp');
      assert.equal((await api(member, 'PUT', id, '/my-persona', { personaKey: 'buddy' })).body.error.code, 'VIP_REQUIRED');

      const conv = await start(member, id);
      await say(member, id, conv, 'nội quy cộng đồng là gì');
      assert.equal((await lastTrace(conv)).persona?.key, 'mentor');
      assert.match((await lastTrace(conv)).prompt, /Thầy\/cô tận tâm/);
      const second = await say(member, id, conv, 'cho hỏi nội quy lần nữa');
      assert.equal(second.quota.remaining, 0);
      const third = await api(member, 'POST', id, `/conversations/${conv}/messages`, { text: 'hỏi tiếp' });
      assert.equal(third.status, 429);
      assert.equal(third.body.error.code, 'DAILY_LIMIT');
      assert.equal(third.body.error.details.tier, 'free');
    });

    it('VIP (trả phí còn hạn) đổi nhân cách trong danh sách cho phép => prompt đổi giọng; ngoài danh sách 400; hết hạn gói => về mức thường', async () => {
      const vip = await c.registerUser('cbvip');
      const id = await community(owner, { paid: true });
      await join_(vip, id);
      await subscribe(vip, id);
      await enable(owner, id, { personaKey: 'mentor', memberPersonaKeys: ['buddy', 'concise'] });
      let st = (await api(vip, 'GET', id, '/status')).body.data;
      assert.equal(st.tier, 'vip');
      assert.equal(st.canChoosePersona, true);
      assert.deepEqual(st.personas.map((p: { key: string }) => p.key).sort(), ['buddy', 'concise', 'mentor']);

      assert.equal((await api(vip, 'PUT', id, '/my-persona', { personaKey: 'coach' })).status, 400);
      st = (await api(vip, 'PUT', id, '/my-persona', { personaKey: 'buddy' })).body.data;
      assert.equal(st.persona.key, 'buddy');
      const conv = await start(vip, id);
      await say(vip, id, conv, 'nội quy cộng đồng là gì');
      const tr = await lastTrace(conv);
      assert.equal(tr.persona?.key, 'buddy');
      assert.equal(tr.persona?.tier, 'vip');
      assert.match(tr.prompt, /Bạn đồng hành vui vẻ/);
      assert.match(tr.prompt, /\[Bây giờ là \d{2}:\d{2} .+ \(giờ Việt Nam\)\]/, 'prompt có thời gian hiện tại');

      // Hết hạn gói trả phí => mức thường, nhân cách về mặc định (pref vẫn lưu nhưng bị bỏ qua).
      await db.prisma.subscription.updateMany({ where: { userId: vip.id, communityId: id }, data: { currentPeriodEnd: new Date(Date.now() - 1000) } });
      st = (await api(vip, 'GET', id, '/status')).body.data;
      assert.equal(st.tier, 'free');
      assert.equal(st.persona.key, 'mentor');
      assert.equal(st.upgradeAvailable, true, 'cộng đồng trả phí: thành viên thường thấy dải nâng cấp');
    });

    it('mod luôn là VIP', async () => {
      const mod = await c.registerUser('cbmod');
      const id = await community(owner);
      await join_(mod, id, 'mod');
      await enable(owner, id);
      assert.equal((await api(mod, 'GET', id, '/status')).body.data.tier, 'vip');
    });
  });

  describe('không rò rỉ bài học đang khóa', () => {
    it('module trả phí chưa mua: prompt chỉ có tên bài + cách mở, KHÔNG có nội dung; mua rồi thì có; bài nháp/ẩn không bao giờ có', async () => {
      const vip = await c.registerUser('cbleak');
      const id = await community(owner, { paid: true });
      await join_(vip, id);
      await subscribe(vip, id);
      await enable(owner, id);
      // Mỗi khóa học 1 module => không bị khóa thứ tự giữa các module.
      const free = await ensureMainCourse(db.prisma, id);
      const paidCourse = `${id}-paid`;
      const draftCourse = `${id}-draft`;
      await db.prisma.course.createMany({ data: [{ id: paidCourse, communityId: id, title: 'Nâng cao', position: 2 }, { id: draftCourse, communityId: id, title: 'Nháp', position: 3, publishStatus: 'draft' }] });
      await db.prisma.classroomModule.createMany({
        data: [
          { id: `${id}-m1`, communityId: id, learningCourseId: free, index: 1, title: 'Cơ bản', description: '' },
          { id: `${id}-m2`, communityId: id, learningCourseId: paidCourse, index: 1, title: 'Hàm Python nâng cao', description: '', accessMode: 'paid', priceCents: 99000 },
          { id: `${id}-m3`, communityId: id, learningCourseId: draftCourse, index: 1, title: 'Nháp', description: '' },
        ],
      });
      await db.prisma.classroomLesson.createMany({
        data: [
          { id: `${id}-l1`, moduleId: `${id}-m1`, communityId: id, index: 1, title: 'Biến trong Python', type: 'text', body: 'OPEN_CANARY biến lưu giá trị python' },
          { id: `${id}-l2`, moduleId: `${id}-m2`, communityId: id, index: 1, title: 'Hàm decorator Python', type: 'text', body: 'PAID_CANARY decorator bọc hàm python' },
          { id: `${id}-l3`, moduleId: `${id}-m3`, communityId: id, index: 1, title: 'Python nháp', type: 'text', body: 'DRAFT_CANARY python' },
          { id: `${id}-l4`, moduleId: `${id}-m1`, communityId: id, index: 2, title: 'Python ẩn', type: 'text', body: 'HIDDEN_CANARY python', hidden: true },
        ],
      });

      const conv = await start(vip, id);
      await say(vip, id, conv, 'bài học python decorator và biến');
      let tr = await lastTrace(conv);
      assert.match(tr.prompt, /OPEN_CANARY/, 'bài đã mở có nội dung');
      assert.doesNotMatch(tr.prompt, /PAID_CANARY/, 'bài module trả phí chưa mua KHÔNG có nội dung');
      assert.match(tr.prompt, /Hàm decorator Python/, 'nhưng có tên bài');
      assert.match(tr.prompt, /cần mua module \\?"Hàm Python nâng cao/);
      assert.ok(tr.sources?.lockedLessonIds?.includes(`${id}-l2`));
      for (const canary of ['DRAFT_CANARY', 'HIDDEN_CANARY', 'Python nháp', 'Python ẩn']) assert.doesNotMatch(tr.prompt, new RegExp(canary));

      await db.prisma.moduleAccess.create({ data: { moduleId: `${id}-m2`, userId: vip.id, source: 'purchase' } });
      await say(vip, id, conv, 'bài học python decorator');
      tr = await lastTrace(conv);
      assert.match(tr.prompt, /PAID_CANARY/, 'đã mua module => có nội dung');
      assert.doesNotMatch(tr.prompt, /DRAFT_CANARY|HIDDEN_CANARY/);
    });
  });

  describe('cô lập dữ liệu', () => {
    it('Q&A của cộng đồng A không dùng ở B hay bot Tào; hội thoại bot cộng đồng tách khỏi Tào', async () => {
      const a = await community(owner);
      const b = await community(owner);
      await join_(member, a);
      await join_(member, b);
      await enable(owner, a);
      await enable(owner, b);
      const qa = await api(owner, 'POST', a, '/qa', { question: 'Mật khẩu wifi lớp học là gì?', answer: 'WIFI_A_CANARY' });
      assert.equal(qa.status, 201, JSON.stringify(qa.body));

      const convA = await start(member, a);
      assert.equal((await say(member, a, convA, 'mật khẩu wifi lớp học là gì')).message.content, 'WIFI_A_CANARY');
      const convB = await start(member, b);
      const rb = await say(member, b, convB, 'mật khẩu wifi lớp học là gì');
      assert.notEqual(rb.message.answerSource, 'qa_direct');
      assert.doesNotMatch((await lastTrace(convB)).prompt, /WIFI_A_CANARY/);

      // Bot Tào (nền tảng) không thấy Q&A cộng đồng, và không mở nhầm hội thoại cộng đồng.
      const { chatbotRepository } = await import('../src/modules/chatbot/chatbot.repository.js');
      assert.equal((await chatbotRepository.matchQa('mật khẩu wifi lớp học là gì', { limit: 5 })).some((m) => m.answer === 'WIFI_A_CANARY'), false);
      const platformCurrent = await c.call('GET', '/chatbot/conversations/current', { token: member.token });
      assert.ok(!platformCurrent.body.data || ![convA, convB].includes(platformCurrent.body.data.conversation.id));
      assert.equal((await api(member, 'GET', a, '/conversations/current')).body.data.conversation.id, convA);
      // Không đọc chéo: hội thoại của A gửi qua đường dẫn của B => 404.
      assert.equal((await api(member, 'POST', b, `/conversations/${convA}/messages`, { text: 'xin chào' })).status, 404);
    });
  });

  describe('chuyển câu hỏi cho chủ cộng đồng', () => {
    it('bot đề nghị => thành viên bấm => Tin nhắn riêng tới chủ kèm câu hỏi; chủ tắt nhận tin riêng => thông báo hệ thống', async () => {
      const id = await community(owner);
      const asker = await c.registerUser('cbask');
      await join_(asker, id);
      await enable(owner, id);
      const conv = await start(asker, id);
      const d = await say(asker, id, conv, 'cho mình gặp chủ cộng đồng hỏi về lịch học riêng');
      assert.ok(d.handoffOffer, 'bot đề nghị gửi cho chủ');
      const h = await api(asker, 'POST', id, `/conversations/${conv}/handoff`);
      assert.equal(h.status, 200, JSON.stringify(h.body));
      assert.equal(h.body.data.via, 'message');
      const dm = await db.prisma.message.findFirstOrThrow({ where: { conversationId: h.body.data.messageConversationId, senderId: asker.id } });
      assert.match(dm.content, /Hỏi qua trợ lý AI/);
      assert.match(dm.content, /lịch học riêng/);

      const asker2 = await c.registerUser('cbask2');
      await join_(asker2, id);
      assert.equal((await c.call('PUT', '/notifications/preferences', { token: owner.token, body: { dmAllowed: false } })).status, 200);
      const conv2 = await start(asker2, id);
      await say(asker2, id, conv2, 'cho mình gặp chủ cộng đồng');
      const h2 = await api(asker2, 'POST', id, `/conversations/${conv2}/handoff`);
      assert.equal(h2.body.data.via, 'notification');
      await c.call('PUT', '/notifications/preferences', { token: owner.token, body: { dmAllowed: true } });
    });
  });

  describe('quản lý của chủ', () => {
    it('tự tạo nhân cách (custom) rồi dùng làm mặc định; tài liệu riêng vào ngữ cảnh; câu học được chờ chủ duyệt', async () => {
      const id = await community(owner);
      await join_(member, id);
      assert.equal((await api(owner, 'PATCH', id, '/settings', { personaKey: 'custom' })).status, 400, 'chưa có nhân cách tự tạo');
      const custom = { label: 'Cô giáo mầm non', selfPronoun: 'cô', userPronoun: 'con', tone: 'Nhẹ nhàng, dỗ dành', emoji: 'light', styleExamples: [{ situation: 'Chào', good: 'Cô chào con nha', tooVerbose: '', tooCurt: '' }] };
      await enable(owner, id, { customPersona: custom, personaKey: 'custom' });
      const doc = await api(owner, 'POST', id, '/docs', { title: 'Lịch học', contentMd: '# Lịch học\n\n## Giờ học\nHọc vào tối thứ 3 hằng tuần lúc 20:00 DOC_CANARY' });
      assert.equal(doc.status, 201, JSON.stringify(doc.body));
      const conv = await start(member, id);
      await say(member, id, conv, 'giờ học vào lúc nào');
      const tr = await lastTrace(conv);
      assert.match(tr.prompt, /Cô giáo mầm non/);
      assert.match(tr.prompt, /tự xưng "cô", gọi người hỏi là "con"/);
      assert.match(tr.prompt, /DOC_CANARY/, 'tài liệu riêng của cộng đồng vào ngữ cảnh');

      // Job học: câu học được từ hội thoại cộng đồng => candidate của CỘNG ĐỒNG, chủ duyệt.
      fake.setFakeLearn(() => ({ pairs: [{ question: 'Giờ học khi nào?', answer: 'Tối thứ 3 lúc 20:00', confidence: 0.9, generalizable: true }] }));
      const { learnFromConversations } = await import('../src/modules/chatbot/chatbot.learn.js');
      await learnFromConversations({ idleMs: 0 });
      const cand = await api(owner, 'GET', id, '/qa?status=candidate');
      const row = cand.body.data.find((q: { question: string }) => q.question === 'Giờ học khi nào?');
      assert.ok(row, JSON.stringify(cand.body));
      assert.equal((await api(owner, 'PATCH', id, `/qa/${row.id}`, { status: 'active' })).body.data.status, 'active');
      const { chatbotRepository } = await import('../src/modules/chatbot/chatbot.repository.js');
      assert.equal((await chatbotRepository.matchQa('Giờ học khi nào?', { limit: 5 })).some((m) => m.question === 'Giờ học khi nào?'), false, 'không lẫn sang kho Tào');

      const convs = await api(owner, 'GET', id, '/conversations');
      assert.ok(convs.body.data.some((x: { id: string }) => x.id === conv));
      assert.equal((await api(member, 'GET', id, '/conversations')).status, 403);
    });
  });
});
