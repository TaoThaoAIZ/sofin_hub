import { createHash } from 'node:crypto';
import type { Prisma } from '../../src/generated/prisma/client.js';
import type { PaymentMethod, PayoutStatus, SubscriptionStatus } from '../../src/generated/prisma/enums.js';
import { seedVnd } from '../../src/db/enums.js';
import { adminSeedUserId as uid } from './admin.js';
import type { SeedContext } from './context.js';
import { ensureDefaultCourse } from './courses.js';

/**
 * Dữ liệu cho Admin đợt 2 (Content / Payments / Discovery). Idempotent: id cố định sid(`*`), chỉ create (update: {}),
 * chạy lại không nhân đôi và không ghi đè thao tác thật của admin. Chạy SAU seedAdmin (dùng người dùng `seed-admin-user-*`).
 *
 * MÔ PHỎNG: chargeback / cổng thanh toán đều là dữ liệu giả; file Upload chỉ có metadata (không có file thật trong storage).
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR);
const ahead = (days: number) => new Date(Date.now() + days * DAY);
const hex = (s: string) => createHash('md5').update(s).digest('hex');
/** Id cố định dạng UUID (suy từ tên) để mã hiển thị (TXN-xxxxxxxx...) khác nhau giữa các dòng seed; chạy lại cho cùng id. */
const sid = (name: string) => {
  const h = hex(`seed-admin2-${name}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const MEMBERS = ['sarah', 'alex', 'daniel', 'maya', 'liam', 'olivia', 'ethan', 'sophia', 'noah', 'emma', 'lucas', 'ava'] as const;
type Key = (typeof MEMBERS)[number];

interface Com { id: string; title: string; owner: Key; cat: 'business' | 'tech' | 'health' | 'finance' | 'content'; price: number; discovery?: 'listed' | 'hidden' | 'unlisted'; search?: 'searchable' | 'reduced' | 'hidden'; desc?: string; ago: number }
const COMS: Com[] = [
  { id: 'growth-lab', title: 'Growth Lab', owner: 'sarah', cat: 'business', price: 49, ago: 120, desc: 'Phòng thí nghiệm tăng trưởng: chia sẻ case study, mẫu quy trình và phản hồi trực tiếp cho người làm sản phẩm.' },
  { id: 'code-camp', title: 'Code Camp', owner: 'alex', cat: 'tech', price: 29, ago: 100, desc: 'Trại lập trình hằng tuần: dự án thực tế, review code và định hướng nghề nghiệp cho lập trình viên mới.' },
  { id: 'fit-forever', title: 'Fit Forever', owner: 'noah', cat: 'health', price: 79, ago: 90, desc: 'Chương trình thể hình dài hạn với kế hoạch ăn uống, lịch tập và theo dõi tiến độ cùng huấn luyện viên.' },
  { id: 'mindful-money', title: 'Mindful Money', owner: 'liam', cat: 'finance', price: 19, ago: 75, desc: 'Quản lý tài chính cá nhân có chánh niệm: ngân sách, tiết kiệm và đầu tư dài hạn cho người đi làm.' },
  { id: 'pixel-pro', title: 'Pixel Pro', owner: 'emma', cat: 'content', price: 99, ago: 60, desc: 'Khóa nâng cao về thiết kế sản phẩm và hình ảnh: critique hằng tuần, thư viện tài nguyên và cố vấn 1-1.' },
  { id: 'spam-hub', title: 'Spam Hub', owner: 'lucas', cat: 'business', price: 0, discovery: 'unlisted', search: 'hidden', ago: 20, desc: 'Kiếm tiền nhanh.' },
];
const PAID = COMS.filter((c) => c.price > 0);
const comOf = (id: string) => COMS.find((c) => c.id === id)!;

export async function seedAdminBatch2(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const adminId = ctx.userIds.admin;
  // Cần người dùng của đợt 1; thiếu thì bỏ qua cả phần này.
  if (!(await db.user.findUnique({ where: { id: uid('sarah') }, select: { id: true } }))) return;

  // ------------------------------------------------------------------ cộng đồng mới (có phí) + thành viên
  for (const c of COMS) {
    await db.community.upsert({
      where: { id: c.id },
      create: {
        id: c.id, title: c.title, description: c.desc ?? c.title, category: c.cat, tag: 'new', thumbnail: c.id === 'spam-hub' ? '' : '/images/courses/biz.webp',
        instructorName: c.owner, instructorRole: 'Chủ cộng đồng', priceCents: seedVnd(c.price), pricing: c.price ? 'paid' : 'free', visibility: 'public', status: 'open',
        language: 'vi', ownerId: uid(c.owner), createdAt: ago(c.ago), discoveryStatus: c.discovery ?? 'listed', searchVisibility: c.search ?? 'searchable',
        discoveryReason: c.discovery && c.discovery !== 'listed' ? 'Low quality / spam signals' : null, discoveryUpdatedAt: c.discovery ? ago(2) : null, discoveryUpdatedById: c.discovery ? adminId : null,
      },
      update: {},
    });
    await db.enrollment.upsert({
      where: { userId_communityId: { userId: uid(c.owner), communityId: c.id } },
      create: { userId: uid(c.owner), communityId: c.id, role: 'owner', enrolledAt: ago(c.ago) },
      update: {},
    });
  }
  // Trạng thái Discovery cho cộng đồng seed sẵn có (chỉ áp lần đầu: discoveryUpdatedAt còn null => admin chưa động vào).
  await db.community.updateMany({ where: { id: 'biz', discoveryUpdatedAt: null }, data: { discoveryStatus: 'hidden', searchVisibility: 'reduced', discoveryReason: 'Under quality review', discoveryUpdatedAt: ago(3), discoveryUpdatedById: adminId } });
  await db.community.updateMany({ where: { id: 'fit', discoveryUpdatedAt: null }, data: { discoveryStatus: 'unlisted', discoveryReason: 'Owner request', discoveryUpdatedAt: ago(5), discoveryUpdatedById: adminId } });

  // ------------------------------------------------------------------ gói thành viên + giao dịch
  const STATUS_CYCLE: SubscriptionStatus[] = ['active', 'active', 'active', 'past_due', 'paused', 'canceled', 'expired', 'trialing', 'active'];
  const METHODS: PaymentMethod[] = ['bank_transfer'];
  interface Pay { id: string; userKey: Key; comId: string; status: string; amount: number; sub?: string }
  const pays: Pay[] = [];
  let payN = 0;
  let invN = 0;
  const addPay = async (p: { userKey: Key; com: Com; status: 'succeeded' | 'failed' | 'pending' | 'refunded'; kind?: 'initial' | 'renewal'; daysAgo: number; sub?: string; refunded?: number; reason?: string; method?: PaymentMethod; periodDays?: number }) => {
    const n = ++payN;
    const id = sid(`pay-${n}`);
    const at = ago(p.daysAgo);
    const ok = p.status === 'succeeded' || p.status === 'refunded';
    const amount = seedVnd(p.com.price);
    await db.payment.upsert({
      where: { id },
      create: {
        id, communityId: p.com.id, userId: uid(p.userKey), method: p.method ?? METHODS[n % METHODS.length]!, amountCents: amount, status: p.status, kind: p.kind ?? 'initial', subscriptionId: p.sub ?? null,
        invoiceNumber: ok ? `INV-2026-9${String(++invN).padStart(5, '0')}` : null, gatewayChargeId: ok ? `mock_ch_seed_${n}` : null,
        refundedCents: p.status === 'refunded' ? (p.refunded ?? amount) : 0, failureReason: p.status === 'failed' ? p.reason ?? 'card_declined' : null,
        periodStart: ok ? at : null, periodEnd: ok ? new Date(at.getTime() + (p.periodDays ?? 30) * DAY) : null, confirmedAt: ok ? at : null, createdAt: at,
      },
      update: {},
    });
    pays.push({ id, userKey: p.userKey, comId: p.com.id, status: p.status, amount, sub: p.sub });
    return id;
  };

  let subN = 0;
  for (let j = 0; j < PAID.length; j++) {
    const com = PAID[j]!;
    for (let i = 0; i < MEMBERS.length; i++) {
      const key = MEMBERS[i]!;
      if (key === com.owner || (i * 3 + j * 5) % 4 === 0) continue;
      const status = STATUS_CYCLE[(i + j) % STATUS_CYCLE.length]!;
      const subId = sid(`sub-${++subN}`);
      const startDaysAgo = 35 + ((i * 7 + j * 11) % 50);
      const lastPaid = status === 'active' ? 3 + ((i + j * 4) % 24) : 28;
      const cancelEnd = status === 'active' && (i + j) % 7 === 0;
      await db.subscription.upsert({
        where: { id: subId },
        create: {
          id: subId, userId: uid(key), communityId: com.id, status, priceCents: seedVnd(com.price), cancelAtPeriodEnd: cancelEnd,
          currentPeriodStart: ago(status === 'active' ? lastPaid : 31), currentPeriodEnd: status === 'active' ? ahead(30 - lastPaid) : status === 'trialing' ? ahead(4) : ago(status === 'past_due' ? 2 : 10),
          trialEndsAt: status === 'trialing' ? ahead(4) : null, canceledAt: status === 'canceled' || cancelEnd ? ago(6) : null, createdAt: ago(startDaysAgo),
        },
        update: {},
      });
      if (status === 'trialing') {
        await db.enrollment.upsert({ where: { userId_communityId: { userId: uid(key), communityId: com.id } }, create: { userId: uid(key), communityId: com.id, role: 'member', enrolledAt: ago(3), lastActiveAt: hoursAgo(5) }, update: {} });
        continue;
      }
      if (status === 'active' || status === 'past_due') {
        await db.enrollment.upsert({ where: { userId_communityId: { userId: uid(key), communityId: com.id } }, create: { userId: uid(key), communityId: com.id, role: 'member', enrolledAt: ago(startDaysAgo), lastActiveAt: hoursAgo(3 + ((i * 13 + j) % 400)) }, update: {} });
      }
      await addPay({ userKey: key, com, status: 'succeeded', daysAgo: startDaysAgo, sub: subId });
      if (status === 'active') await addPay({ userKey: key, com, status: 'succeeded', kind: 'renewal', daysAgo: lastPaid, sub: subId });
      if (status === 'past_due') await addPay({ userKey: key, com, status: 'failed', kind: 'renewal', daysAgo: 2, sub: subId, reason: 'insufficient_funds' });
      if (status === 'expired') await addPay({ userKey: key, com, status: 'succeeded', kind: 'renewal', daysAgo: startDaysAgo - 30 > 0 ? startDaysAgo - 30 : 12, sub: subId });
    }
  }
  // Giao dịch rời (không gói): thất bại, đang chờ, đã hoàn (đầy đủ / một phần).
  const loose: Array<Parameters<typeof addPay>[0]> = [
    { userKey: 'sophia', com: comOf('pixel-pro'), status: 'failed', daysAgo: 1, reason: 'card_declined' },
    { userKey: 'ethan', com: comOf('fit-forever'), status: 'failed', daysAgo: 3, reason: 'expired_card', method: 'vnpay' },
    { userKey: 'maya', com: comOf('code-camp'), status: 'failed', daysAgo: 0.2, reason: 'processing_error' },
    { userKey: 'ava', com: comOf('growth-lab'), status: 'pending', daysAgo: 0.1, method: 'momo' },
    { userKey: 'lucas', com: comOf('mindful-money'), status: 'pending', daysAgo: 0.3, method: 'vnpay' },
    { userKey: 'olivia', com: comOf('pixel-pro'), status: 'refunded', daysAgo: 9 },
    { userKey: 'daniel', com: comOf('fit-forever'), status: 'refunded', daysAgo: 14, refunded: 987_500 },
    { userKey: 'noah', com: comOf('growth-lab'), status: 'refunded', daysAgo: 20 },
    { userKey: 'ava', com: comOf('pixel-pro'), status: 'succeeded', daysAgo: 4 },
    { userKey: 'emma', com: comOf('code-camp'), status: 'succeeded', daysAgo: 6 },
    { userKey: 'sarah', com: comOf('fit-forever'), status: 'succeeded', daysAgo: 8 },
    { userKey: 'liam', com: comOf('pixel-pro'), status: 'succeeded', daysAgo: 11 },
    { userKey: 'maya', com: comOf('growth-lab'), status: 'succeeded', daysAgo: 13 },
    { userKey: 'sophia', com: comOf('mindful-money'), status: 'succeeded', daysAgo: 16 },
    { userKey: 'ethan', com: comOf('pixel-pro'), status: 'succeeded', daysAgo: 18 },
    { userKey: 'ava', com: comOf('code-camp'), status: 'succeeded', daysAgo: 22 },
  ];
  for (const l of loose) await addPay(l);
  const byStatus = (s: string) => pays.filter((p) => p.status === s);
  const refundedPays = byStatus('refunded');
  const okPays = byStatus('succeeded').filter((p) => !p.sub);

  // ------------------------------------------------------------------ hoàn tiền
  const REASONS = ['Charged twice', 'Did not use the product', 'Content not as described', 'Accidental purchase', 'Cancelled but charged', 'Technical issue', 'Changed mind', 'Duplicate account'];
  let rfN = 0;
  const addRefund = async (pay: Pay, status: 'pending' | 'approved' | 'rejected', daysAgo: number, extra: { note?: string; auto?: boolean; amount?: number } = {}) => {
    const id = sid(`refund-${++rfN}`);
    await db.refundRequest.upsert({
      where: { id },
      create: {
        id, paymentId: pay.id, communityId: pay.comId, userId: uid(pay.userKey), amountCents: extra.amount ?? pay.amount, reason: REASONS[rfN % REASONS.length]!, status, auto: extra.auto ?? false,
        note: extra.note ?? null, resolvedById: status === 'pending' ? null : adminId, resolvedAt: status === 'pending' ? null : ago(daysAgo - 0.5), createdAt: ago(daysAgo),
      },
      update: {},
    });
  };
  await addRefund(refundedPays[0]!, 'approved', 9, { note: 'Approved: billing error' });
  await addRefund(refundedPays[1]!, 'approved', 14, { amount: 987_500, note: 'Partial refund (50%) as goodwill' });
  await addRefund(refundedPays[2]!, 'approved', 20, { auto: true });
  const pendingTargets = okPays.slice(0, 4);
  for (let k = 0; k < pendingTargets.length; k++) await addRefund(pendingTargets[k]!, 'pending', 1 + k * 2);
  await addRefund(okPays[4]!, 'rejected', 7, { note: 'Outside refund window; content was accessed' });
  await addRefund(okPays[5]!, 'rejected', 12, { note: 'Usage exceeds policy limits' });

  // ------------------------------------------------------------------ chargebacks (MÔ PHỎNG)
  // Chargeback: 'lost' trỏ vào giao dịch đã hoàn (tiền đã bị lấy lại); còn lại là giao dịch succeeded chưa dính hoàn tiền.
  const used = new Set(okPays.slice(0, 6).map((p) => p.id));
  const free = byStatus('succeeded').filter((p) => !used.has(p.id));
  const cbTargets = [free[0]!, free[1]!, free[2]!, free[3]!, free[4]!, refundedPays[2]!, free[5]!];
  interface Cb { reason: Prisma.ChargebackUncheckedCreateInput['reason']; status: 'open' | 'under_review' | 'won' | 'lost'; open: number; deadline: number; evidence?: boolean }
  const CBS: Cb[] = [
    { reason: 'fraudulent', status: 'open', open: 3, deadline: 4 },
    { reason: 'product_not_received', status: 'under_review', open: 6, deadline: 3, evidence: true },
    { reason: 'duplicate', status: 'open', open: 2, deadline: 2 },
    { reason: 'subscription_cancelled', status: 'open', open: 5, deadline: 5 },
    { reason: 'unrecognized', status: 'won', open: 30, deadline: -20, evidence: true },
    { reason: 'fraudulent', status: 'lost', open: 40, deadline: -30 },
    { reason: 'product_not_as_described', status: 'won', open: 25, deadline: -15, evidence: true },
  ];
  for (let k = 0; k < CBS.length && k < cbTargets.length; k++) {
    const c = CBS[k]!;
    const pay = cbTargets[k]!;
    await db.chargeback.upsert({
      where: { id: sid(`cb-${k + 1}`) },
      create: {
        id: sid(`cb-${k + 1}`), paymentId: pay.id, communityId: pay.comId, userId: uid(pay.userKey), amountCents: pay.amount, reason: c.reason, status: c.status,
        deadlineAt: ahead(c.deadline), evidenceNote: c.evidence ? 'Access logs, lesson completion history and signed ToS acceptance attached.' : null, evidenceUrls: c.evidence ? ['https://example.com/evidence/logs.pdf'] : [],
        evidenceSubmittedAt: c.evidence ? ago(c.open - 1) : null, gatewayDisputeId: `mock_dp_seed_${k + 1}`, openedAt: ago(c.open),
        resolvedAt: c.status === 'won' || c.status === 'lost' ? ago(c.open - 8) : null, resolvedById: c.status === 'won' || c.status === 'lost' ? adminId : null,
        resolutionNote: c.status === 'lost' ? 'Accepted: customer proved fraud' : c.status === 'won' ? 'Evidence accepted by issuer' : null,
      },
      update: {},
    });
  }

  // ------------------------------------------------------------------ payouts
  const PAYOUTS: Array<{ com: string; amount: number; status: PayoutStatus; days: number; bank: string; last4: string; note?: string; fail?: string; heldFrom?: PayoutStatus }> = [
    { com: 'growth-lab', amount: 180, status: 'requested', days: 1, bank: 'Chase', last4: '1203' },
    { com: 'code-camp', amount: 120, status: 'requested', days: 2, bank: 'Vietcombank', last4: '8812' },
    { com: 'pixel-pro', amount: 250, status: 'approved', days: 4, bank: 'Chase', last4: '4412' },
    { com: 'fit-forever', amount: 99, status: 'approved', days: 6, bank: 'Techcombank', last4: '7731' },
    { com: 'mindful-money', amount: 61, status: 'paid', days: 18, bank: 'Vietcombank', last4: '3300' },
    { com: 'growth-lab', amount: 210, status: 'paid', days: 33, bank: 'Chase', last4: '1203' },
    { com: 'code-camp', amount: 88, status: 'paid', days: 40, bank: 'Vietcombank', last4: '8812' },
    { com: 'pixel-pro', amount: 75, status: 'failed', days: 9, bank: 'Wells Fargo', last4: '9020', fail: 'Bank account closed' },
    { com: 'fit-forever', amount: 52, status: 'on_hold', days: 7, bank: 'Techcombank', last4: '7731', heldFrom: 'requested', note: 'Held pending identity re-verification' },
    { com: 'mindful-money', amount: 50, status: 'rejected', days: 25, bank: 'ACB', last4: '5566', note: 'Account holder name mismatch' },
  ];
  for (let k = 0; k < PAYOUTS.length; k++) {
    const p = PAYOUTS[k]!;
    const com = comOf(p.com);
    await db.payout.upsert({
      where: { id: sid(`payout-${k + 1}`) },
      create: {
        id: sid(`payout-${k + 1}`), communityId: com.id, ownerId: uid(com.owner), amountCents: seedVnd(p.amount), bankName: p.bank, accountHolder: `${com.owner} account`, accountLast4: p.last4,
        status: p.status, note: p.note ?? null, failureReason: p.fail ?? null, heldFromStatus: p.heldFrom ?? null, createdAt: ago(p.days), updatedAt: ago(Math.max(0, p.days - 1)),
      },
      update: {},
    });
  }

  // ------------------------------------------------------------------ bài viết / bình luận (nội dung toàn nền tảng)
  const POSTS: Array<{ n: number; com: string; author: Key; text: string; age: number; likes: number; comments: number; state?: 'hidden' | 'removed'; pinned?: boolean; reason?: string; image?: string }> = [
    { n: 1, com: 'growth-lab', author: 'sarah', text: 'Welcome to Growth Lab! Introduce yourself and share the one metric you are trying to move this quarter.', age: 40, likes: 24, comments: 9, pinned: true },
    { n: 2, com: 'growth-lab', author: 'alex', text: 'Case study: how we doubled activation by removing two onboarding steps. Full write-up and numbers below.', age: 12, likes: 31, comments: 12 },
    { n: 3, com: 'code-camp', author: 'noah', text: 'Weekly challenge: build a rate limiter in under 50 lines. Post your solution and we will review the best ones live.', age: 6, likes: 18, comments: 7 },
    { n: 4, com: 'code-camp', author: 'daniel', text: 'Anyone else struggling with async stack traces in Node? Sharing my debugging checklist.', age: 3, likes: 9, comments: 4 },
    { n: 5, com: 'fit-forever', author: 'noah', text: 'Week 6 check-in: sleep is the biggest lever. Track it for 7 days before changing anything else.', age: 5, likes: 15, comments: 3 },
    { n: 6, com: 'mindful-money', author: 'liam', text: 'Budget template v2 is out. Duplicate the sheet and fill in the green cells only.', age: 8, likes: 22, comments: 6, image: '/api/files/' + hex(sid('media-1')) + '.png' },
    { n: 7, com: 'pixel-pro', author: 'emma', text: 'This week critique theme: typography hierarchy. Drop your screens and I will annotate three of them.', age: 2, likes: 12, comments: 5 },
    { n: 8, com: 'spam-hub', author: 'lucas', text: 'MAKE $10,000 A DAY!!! Click my link in bio, limited spots, send me a DM now to join the VIP signal group.', age: 1, likes: 0, comments: 2, state: 'hidden', reason: 'Spam' },
    { n: 9, com: 'spam-hub', author: 'lucas', text: 'Free crypto giveaway — send 0.1 ETH to receive 1 ETH back. 100% guaranteed, trust me.', age: 4, likes: 1, comments: 0, state: 'removed', reason: 'Scam' },
    { n: 10, com: 'growth-lab', author: 'maya', text: 'Join my Telegram for referral bonuses!!! Everyone who signs up through my code gets a free template pack.', age: 7, likes: 0, comments: 1, state: 'hidden', reason: 'Self-promotion' },
    { n: 11, com: 'code-camp', author: 'ava', text: 'Looking for a study partner for the algorithms track. Timezone UTC+7, evenings.', age: 0.5, likes: 3, comments: 1 },
    { n: 12, com: 'pixel-pro', author: 'sophia', text: 'Stop buying this course, the instructor deletes every negative comment and the content is copied from YouTube.', age: 0.8, likes: 2, comments: 3 },
    { n: 13, com: 'fit-forever', author: 'olivia', text: 'Here is the leaked paid meal plan PDF, download for free, no signup needed.', age: 0.3, likes: 4, comments: 0 },
    { n: 14, com: 'mindful-money', author: 'ethan', text: 'Guaranteed 20% monthly returns — DM me for the private fund details.', age: 9, likes: 0, comments: 2, state: 'removed', reason: 'Financial scam' },
  ];
  for (const p of POSTS) {
    const id = sid(`post-${p.n}`);
    await db.post.upsert({
      where: { id },
      create: {
        id, communityId: p.com, authorId: uid(p.author), content: p.text, imageUrl: p.image ?? null, pinned: p.pinned ?? false, likesCount: p.likes, commentsCount: p.comments, createdAt: ago(p.age),
        hidden: !!p.state, removedAt: p.state === 'removed' ? ago(p.age - 0.5 > 0 ? p.age - 0.5 : 0.1) : null, modReason: p.reason ?? null, modAt: p.state ? ago(Math.max(0.05, p.age - 0.5)) : null, modById: p.state ? adminId : null,
      },
      update: {},
    });
  }
  const CMTS: Array<{ n: number; post: number; author: Key; text: string; age: number; state?: 'hidden' | 'removed'; reason?: string }> = [
    { n: 1, post: 1, author: 'alex', text: 'Hi everyone! I am working on trial-to-paid conversion this quarter.', age: 39 },
    { n: 2, post: 1, author: 'daniel', text: 'Activation rate for us. Looking forward to the case studies.', age: 38 },
    { n: 3, post: 2, author: 'liam', text: 'Great write-up, did you A/B test the removal or ship it to everyone?', age: 11 },
    { n: 4, post: 2, author: 'maya', text: 'DM me for a better growth hack, I made $5K last week!!!', age: 10, state: 'removed', reason: 'Spam' },
    { n: 5, post: 3, author: 'ava', text: 'Token bucket in 38 lines, will post it tonight.', age: 5 },
    { n: 6, post: 7, author: 'sophia', text: 'You are a fraud and this community is a scam.', age: 1.5, state: 'hidden', reason: 'Harassment' },
    { n: 7, post: 12, author: 'noah', text: 'This is false, the instructor replied to every question I asked.', age: 0.5 },
    { n: 8, post: 12, author: 'emma', text: 'Please keep it respectful, we can discuss this privately.', age: 0.4 },
    { n: 9, post: 6, author: 'sarah', text: 'Thanks for sharing the template!', age: 7 },
    { n: 10, post: 5, author: 'ava', text: 'Check out my new site: cheap-pills.example — best prices guaranteed.', age: 4, state: 'removed', reason: 'Spam' },
  ];
  for (const c of CMTS) {
    const id = sid(`cmt-${c.n}`);
    await db.postComment.upsert({
      where: { id },
      create: {
        id, postId: sid(`post-${c.post}`), authorId: uid(c.author), content: c.text, createdAt: ago(c.age), hidden: !!c.state, removedAt: c.state === 'removed' ? ago(Math.max(0.05, c.age - 0.3)) : null,
        modReason: c.reason ?? null, modAt: c.state ? ago(Math.max(0.05, c.age - 0.3)) : null, modById: c.state ? adminId : null,
      },
      update: {},
    });
  }
  // Báo cáo mở trên vài nội dung để tab "Under Review"/"Reported" có dữ liệu.
  const REPORTS: Array<{ n: number; type: 'post' | 'comment'; target: string; targetUser: Key; reporter: Key; reason: 'spam' | 'harassment' | 'scam' | 'copyright'; com: string; age: number }> = [
    { n: 1, type: 'post', target: sid('post-12'), targetUser: 'sophia', reporter: 'emma', reason: 'harassment', com: 'pixel-pro', age: 0.7 },
    { n: 2, type: 'post', target: sid('post-12'), targetUser: 'sophia', reporter: 'noah', reason: 'harassment', com: 'pixel-pro', age: 0.6 },
    { n: 3, type: 'post', target: sid('post-13'), targetUser: 'olivia', reporter: 'noah', reason: 'copyright', com: 'fit-forever', age: 0.2 },
    { n: 4, type: 'post', target: sid('post-11'), targetUser: 'ava', reporter: 'daniel', reason: 'spam', com: 'code-camp', age: 0.4 },
    { n: 5, type: 'comment', target: sid('cmt-7'), targetUser: 'noah', reporter: 'sophia', reason: 'harassment', com: 'pixel-pro', age: 0.3 },
  ];
  for (const r of REPORTS) {
    const id = sid(`report-${r.n}`);
    const excerpt = (r.type === 'post' ? POSTS.find((p) => sid(`post-${p.n}`) === r.target)?.text : CMTS.find((c) => sid(`cmt-${c.n}`) === r.target)?.text) ?? '';
    await db.report.upsert({
      where: { id },
      create: { id, communityId: r.com, targetType: r.type, targetId: r.target, targetUserId: uid(r.targetUser), targetExcerpt: excerpt.slice(0, 120), reporterId: uid(r.reporter), reason: r.reason, status: 'open', risk: 'low', createdAt: ago(r.age) },
      update: {},
    });
  }

  // ------------------------------------------------------------------ khóa học / bài học (lớp học) + tiến độ
  const MODS: Array<{ n: number; com: string; title: string; status: 'published' | 'draft' | 'archived'; removed?: boolean; reason?: string; age: number }> = [
    { n: 1, com: 'growth-lab', title: 'Growth Foundations', status: 'published', age: 100 },
    { n: 2, com: 'growth-lab', title: 'Experimentation Playbook', status: 'published', age: 80 },
    { n: 3, com: 'code-camp', title: 'Node.js from Zero', status: 'published', age: 90 },
    { n: 4, com: 'code-camp', title: 'System Design Drafts', status: 'draft', age: 20 },
    { n: 5, com: 'fit-forever', title: '12-Week Strength Program', status: 'published', age: 70 },
    { n: 6, com: 'mindful-money', title: 'Budgeting 101 (old edition)', status: 'archived', age: 60 },
    { n: 7, com: 'pixel-pro', title: 'Typography Masterclass', status: 'published', age: 50 },
    { n: 8, com: 'spam-hub', title: 'Get Rich Quick Secrets', status: 'published', removed: true, reason: 'Misleading claims', age: 15 },
  ];
  for (const m of MODS) {
    // "Khóa học" của admin = entity Course (LearningCourse): mỗi mục MODS là 1 khóa học (ngoài khóa mặc định của cộng đồng) chứa 1 module + 4 bài.
    await ensureDefaultCourse(db, m.com);
    const courseId = sid(`course-${m.n}`);
    const position = ((await db.course.aggregate({ where: { communityId: m.com }, _max: { position: true } }))._max.position ?? 0) + 1;
    await db.course.upsert({
      where: { id: courseId },
      create: {
        id: courseId, communityId: m.com, title: m.title, description: `${m.title} — bài giảng theo từng bước.`, position, publishStatus: m.status,
        removedAt: m.removed ? ago(2) : null, modReason: m.reason ?? null, modAt: m.removed ? ago(2) : null, modById: m.removed ? adminId : null, createdAt: ago(m.age),
      },
      update: {},
    });
    const id = sid(`mod-${m.n}`);
    await db.classroomModule.upsert({
      where: { id },
      create: { id, communityId: m.com, learningCourseId: courseId, index: 1, title: m.title, description: `${m.title} — bài giảng theo từng bước.`, createdAt: ago(m.age) },
      update: {},
    });
  }
  const LTYPES = ['video', 'video', 'text', 'file', 'video'] as const;
  let lsnN = 0;
  for (const m of MODS) {
    for (let k = 0; k < 4; k++) {
      const n = ++lsnN;
      const id = sid(`lsn-${n}`);
      const hidden = n === 7 || n === 19;
      const removed = n === 12 || m.n === 8;
      await db.classroomLesson.upsert({
        where: { id },
        create: {
          id, moduleId: sid(`mod-${m.n}`), communityId: m.com, index: k + 1, title: ['Welcome & how to use this course', 'Setting up your workspace', 'The core framework', 'Templates & checklists', 'Q&A recording', 'Case study walkthrough'][(n + k) % 6]! + ` ${k + 1}`,
          type: LTYPES[(n + k) % LTYPES.length]!, durationMin: 6 + ((n * 7) % 25), body: 'Nội dung bài học minh họa.', hidden: hidden || removed, removedAt: removed ? ago(1) : null,
          modReason: hidden ? 'Outdated content' : removed ? 'Policy violation' : null, modAt: hidden || removed ? ago(1) : null, modById: hidden || removed ? adminId : null, createdAt: ago(m.age - 1),
        },
        update: {},
      });
      // Tiến độ: vài thành viên đã hoàn thành.
      for (let u = 0; u < 5; u++) {
        if ((n + u) % 3 === 0) continue;
        const uId = uid(MEMBERS[(n + u * 2) % MEMBERS.length]!);
        await db.lessonProgress.upsert({ where: { userId_lessonId: { userId: uId, lessonId: id } }, create: { userId: uId, lessonId: id, completedAt: ago(1 + ((n + u) % 20)) }, update: {} });
      }
    }
  }

  // ------------------------------------------------------------------ sự kiện
  const EVENTS: Array<{ n: number; com: string; host: Key; title: string; startAt: Date; cap?: number; cancelled?: string; removed?: string; link?: boolean; rsvp: Key[] }> = [
    { n: 1, com: 'growth-lab', host: 'sarah', title: 'Growth AMA with the founders', startAt: ahead(3), link: true, rsvp: ['alex', 'daniel', 'liam', 'ava'] },
    { n: 2, com: 'code-camp', host: 'alex', title: 'Live coding: build a CLI in Node', startAt: ahead(7), cap: 30, link: true, rsvp: ['noah', 'emma', 'ava'] },
    { n: 3, com: 'pixel-pro', host: 'emma', title: 'Portfolio review night', startAt: ahead(1.5), link: true, rsvp: ['sophia', 'liam'] },
    { n: 4, com: 'fit-forever', host: 'noah', title: 'Mobility workshop (live now)', startAt: hoursAgo(0.5), link: true, rsvp: ['sarah', 'olivia', 'daniel'] },
    { n: 5, com: 'mindful-money', host: 'liam', title: 'Quarterly budget reset', startAt: ago(6), link: true, rsvp: ['sarah', 'noah', 'emma', 'alex', 'maya'] },
    { n: 6, com: 'growth-lab', host: 'sarah', title: 'Retention teardown session', startAt: ago(15), link: true, rsvp: ['liam', 'ava'] },
    { n: 7, com: 'code-camp', host: 'alex', title: 'Hack night (cancelled: host unavailable)', startAt: ahead(5), cancelled: 'Host unavailable', link: true, rsvp: ['daniel', 'ethan'] },
    { n: 8, com: 'spam-hub', host: 'lucas', title: 'Secret wealth webinar', startAt: ahead(2), removed: 'Misleading promotion', link: true, rsvp: ['ava'] },
  ];
  for (const e of EVENTS) {
    const id = sid(`event-${e.n}`);
    await db.communityEvent.upsert({
      where: { id },
      create: {
        id, communityId: e.com, hostId: uid(e.host), title: e.title, description: 'Sự kiện minh họa cho trang admin.', startAt: e.startAt, timezone: 'Asia/Ho_Chi_Minh',
        meetingLink: e.link ? `https://meet.example.com/${id}` : null, capacity: e.cap ?? null, cancelledAt: e.cancelled ? ago(1) : null, cancelReason: e.cancelled ?? null,
        removedAt: e.removed ? ago(1) : null, modReason: e.removed ?? null, modAt: e.removed ? ago(1) : null, modById: e.removed ? adminId : null, createdAt: ago(20),
      },
      update: {},
    });
    for (const r of e.rsvp) {
      await db.eventRsvp.upsert({ where: { eventId_userId: { eventId: id, userId: uid(r) } }, create: { eventId: id, userId: uid(r) }, update: {} });
    }
  }

  // ------------------------------------------------------------------ media (chỉ metadata)
  const MEDIA: Array<{ n: number; name: string; ext: string; type: string; size: number; owner: Key; com?: string; purpose: 'post_image' | 'post_file' | 'cover' | 'lesson_attachment' | 'avatar'; flagged?: string; removed?: string; age: number }> = [
    { n: 1, name: 'budget-preview.png', ext: 'png', type: 'image/png', size: 1_258_291, owner: 'liam', com: 'mindful-money', purpose: 'post_image', age: 8 },
    { n: 2, name: 'cover-growth-lab.webp', ext: 'webp', type: 'image/webp', size: 640_000, owner: 'sarah', com: 'growth-lab', purpose: 'cover', age: 60 },
    { n: 3, name: 'lesson-01-welcome.mp4', ext: 'mp4', type: 'video/mp4', size: 248_000_000, owner: 'alex', com: 'code-camp', purpose: 'lesson_attachment', age: 40 },
    { n: 4, name: 'notion-template.pdf', ext: 'pdf', type: 'application/pdf', size: 4_800_000, owner: 'sarah', com: 'growth-lab', purpose: 'post_file', age: 35, flagged: 'Possible copyrighted material' },
    { n: 5, name: 'workshop-recording.mp4', ext: 'mp4', type: 'video/mp4', size: 1_100_000_000, owner: 'noah', com: 'fit-forever', purpose: 'lesson_attachment', age: 20 },
    { n: 6, name: 'checklist.docx', ext: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 220_000, owner: 'emma', com: 'pixel-pro', purpose: 'post_file', age: 14 },
    { n: 7, name: 'leaked-meal-plan.pdf', ext: 'pdf', type: 'application/pdf', size: 6_100_000, owner: 'olivia', com: 'fit-forever', purpose: 'post_file', age: 0.3, flagged: 'Reported as leaked paid content' },
    { n: 8, name: 'avatar-sophia.jpg', ext: 'jpg', type: 'image/jpeg', size: 96_000, owner: 'sophia', purpose: 'avatar', age: 30 },
    { n: 9, name: 'banner-q4.jpg', ext: 'jpg', type: 'image/jpeg', size: 2_100_000, owner: 'emma', com: 'pixel-pro', purpose: 'cover', age: 12 },
    { n: 10, name: 'signals-pack.zip', ext: 'zip', type: 'application/zip', size: 12_400_000, owner: 'lucas', com: 'spam-hub', purpose: 'post_file', age: 3, removed: 'Malware risk' },
    { n: 11, name: 'notes.txt', ext: 'txt', type: 'text/plain', size: 4_096, owner: 'daniel', com: 'code-camp', purpose: 'post_file', age: 5 },
    { n: 12, name: 'typography-sheet.png', ext: 'png', type: 'image/png', size: 3_300_000, owner: 'emma', com: 'pixel-pro', purpose: 'post_image', age: 2 },
  ];
  for (const m of MEDIA) {
    const key = `${hex(sid(`media-${m.n}`))}.${m.ext}`;
    await db.upload.upsert({
      where: { key },
      create: {
        key, ownerId: uid(m.owner), filename: m.name, contentType: m.type, size: m.size, purpose: m.purpose, communityId: m.com ?? null, status: 'uploaded', createdAt: ago(m.age),
        flagged: !!m.flagged, flagReason: m.flagged ?? null, removedAt: m.removed ? ago(1) : null, modReason: m.removed ?? null, modAt: m.removed ? ago(1) : null, modById: m.removed ? adminId : null,
      },
      update: {},
    });
  }

  // ------------------------------------------------------------------ Discovery: ghim + trọng số mặc định
  const FEATURED: Array<{ section: string; items: Array<{ com: string; start?: number; end?: number }> }> = [
    { section: 'featured', items: [{ com: 'photo', start: -8, end: 22 }, { com: 'yt', start: -8, end: 22 }, { com: 'growth-lab', start: -2, end: 28 }] },
    { section: 'trending', items: [{ com: 'ai' }, { com: 'code-camp' }] },
    { section: 'editors_picks', items: [{ com: 'pixel-pro', start: -5, end: 25 }, { com: 'mindful-money', start: -5, end: 25 }] },
    { section: 'new_noteworthy', items: [{ com: 'fit-forever', start: -20, end: -3 }, { com: 'des' }] },
  ];
  for (const s of FEATURED) {
    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i]!;
      if (!(await db.community.findUnique({ where: { id: it.com }, select: { id: true } }))) continue;
      const id = sid(`feat-${s.section}-${i + 1}`);
      await db.discoveryFeature.upsert({
        where: { id },
        create: { id, section: s.section, communityId: it.com, position: i + 1, startsAt: it.start != null ? ago(-it.start) : null, endsAt: it.end != null ? ahead(it.end) : null, createdById: adminId },
        update: {},
      });
    }
  }
  await db.platformSetting.upsert({
    where: { key: 'discovery.rankingWeights' },
    create: { key: 'discovery.rankingWeights', value: { memberGrowth: 25, engagement: 25, retention: 20, rating: 15, revenue: 10, reportPenalty: 5 }, updatedById: adminId },
    update: {},
  });

  // ------------------------------------------------------------------ nhật ký audit mẫu cho đợt 2
  const audits: Array<{ n: number; hours: number; action: string; type: string; target: string; label: string; reason?: string; meta?: Prisma.InputJsonValue }> = [
    { n: 1, hours: 50, action: 'post.hide', type: 'post', target: sid('post-8'), label: 'MAKE $10,000 A DAY!!!', reason: 'Spam' },
    { n: 2, hours: 100, action: 'post.remove', type: 'post', target: sid('post-9'), label: 'Free crypto giveaway', reason: 'Scam' },
    { n: 3, hours: 40, action: 'course.remove', type: 'course', target: sid('mod-8'), label: 'Get Rich Quick Secrets', reason: 'Misleading claims' },
    { n: 4, hours: 30, action: 'media.remove', type: 'media', target: `${hex(sid('media-10'))}.zip`, label: 'signals-pack.zip', reason: 'Malware risk' },
    { n: 5, hours: 24, action: 'event.remove', type: 'event', target: sid('event-8'), label: 'Secret wealth webinar', reason: 'Misleading promotion' },
    { n: 6, hours: 22, action: 'event.cancel', type: 'event', target: sid('event-7'), label: 'Hack night', reason: 'Host unavailable' },
    { n: 7, hours: 120, action: 'refund.approve', type: 'refund', target: sid('refund-1'), label: 'RF-REFUND1', meta: { requestedCents: 1_225_000 } },
    { n: 8, hours: 72, action: 'payout.hold', type: 'payout', target: sid('payout-9'), label: 'PO · Noah', reason: 'Identity re-verification' },
    { n: 9, hours: 60, action: 'payout.mark_failed', type: 'payout', target: sid('payout-8'), label: 'PO · Emma', reason: 'Bank account closed' },
    { n: 10, hours: 48, action: 'discovery.status', type: 'community', target: 'spam-hub', label: 'Spam Hub', reason: 'Low quality / spam signals', meta: { from: 'listed', to: 'unlisted' } },
    { n: 11, hours: 47, action: 'discovery.search_visibility', type: 'community', target: 'spam-hub', label: 'Spam Hub', meta: { from: 'searchable', to: 'hidden' } },
    { n: 12, hours: 36, action: 'discovery.feature', type: 'community', target: 'growth-lab', label: 'Growth Lab', meta: { section: 'featured' } },
    { n: 13, hours: 80, action: 'chargeback.create', type: 'chargeback', target: sid('cb-1'), label: 'CB-SEED1', reason: 'fraudulent', meta: { simulated: true } },
  ];
  for (const a of audits) {
    await db.adminAuditLog.upsert({
      where: { id: sid(`audit-${a.n}`) },
      create: { id: sid(`audit-${a.n}`), actorId: adminId, actorName: 'Platform Admin', action: a.action, targetType: a.type, targetId: a.target, targetLabel: a.label, reason: a.reason ?? null, metadata: a.meta, createdAt: hoursAgo(a.hours) },
      update: {},
    });
  }
}
