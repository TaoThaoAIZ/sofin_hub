import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { SupportCategory, SupportMessageKind, SupportPriority, SupportTicketStatus } from '../../src/generated/prisma/client.js';
import { TEST_PASSWORD } from '../seed-accounts.js';
import { adminSeedUserId } from './admin.js';
import type { SeedContext } from './context.js';

/**
 * Dữ liệu cho Admin đợt 3 (Analytics / Support / System). Idempotent: id cố định `seed-admin3-*` (hoặc uuid suy từ tên),
 * chỉ create (update: {}) nên chạy lại không nhân đôi và không ghi đè thao tác thật. Chạy SAU seedAdmin / seedAdminBatch2.
 *  - Nhân viên: moderator@ / support@ / finance@ / tom@ / nina@(đã bị tạm khóa) + john@, mia@ (Moderator) — mật khẩu TEST_PASSWORD.
 *  - Ticket hỗ trợ đủ nhóm/trạng thái/ưu tiên/người xử lý; flag, tích hợp, mẫu email, broadcast mẫu; vài dòng audit của nhân viên.
 *  - Analytics: rải lại ngày đăng ký của thành viên demo trong 150 ngày + phiên "quay lại" để cohort/retention có hình dạng
 *    (chỉ chạm thành viên demo vừa được seed trong 3 ngày gần nhất nên chạy lại không đổi gì).
 * MÔ PHỎNG: cổng/tích hợp là dữ liệu giả; không có khóa bí mật thật.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);
const hex = (s: string) => createHash('md5').update(s).digest('hex');
const sid = (name: string) => {
  const h = hex(`seed-admin3-${name}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const adminSeed3UserId = (key: string) => `seed-admin3-user-${key}`;

const STAFF = [
  { key: 'moderator', first: 'Moderator', last: 'Test', role: 'moderator', tfa: true, seen: 2 },
  { key: 'support', first: 'Ryan', last: 'Cho', role: 'support', tfa: true, seen: 1 },
  { key: 'finance', first: 'Grace', last: 'Lee', role: 'finance', tfa: true, seen: 6 },
  { key: 'tom', first: 'Tom', last: 'Baker', role: 'support', tfa: false, seen: 30 },
  { key: 'nina', first: 'Nina', last: 'Ross', role: 'moderator', tfa: true, seen: 200, suspended: true },
] as const;

interface TicketSeed {
  cat: SupportCategory;
  subject: string;
  body: string;
  by: string;
  status: SupportTicketStatus;
  priority: SupportPriority;
  assignee?: 'support' | 'tom' | null;
  age: number; // giờ trước
  escalated?: boolean;
  frtMin?: number;
  replies?: number;
}
const T: TicketSeed[] = [
  { cat: 'user', subject: 'Cannot log in after password reset', body: 'I reset my password but the new one is still rejected on the login page.', by: 'sarah', status: 'open', priority: 'high', assignee: 'support', age: 3, frtMin: 18 },
  { cat: 'user', subject: 'Verification email not received', body: 'I signed up 2 hours ago and still have no verification email. Checked spam too.', by: 'alex', status: 'new', priority: 'medium', age: 1 },
  { cat: 'user', subject: 'Want to change account email', body: 'How can I change the email on my account? The old address is no longer active.', by: 'daniel', status: 'awaiting_reply', priority: 'low', assignee: 'tom', age: 30, frtMin: 55 },
  { cat: 'user', subject: 'Account locked by mistake', body: 'My account shows as restricted but I did not break any rule. Please review.', by: 'maya', status: 'open', priority: 'urgent', assignee: 'support', age: 7, escalated: true, frtMin: 12 },
  { cat: 'user', subject: 'Cannot upload my avatar', body: 'Avatar upload fails with an error for PNG files under 1 MB.', by: 'liam', status: 'resolved', priority: 'low', assignee: 'tom', age: 80, frtMin: 40 },
  { cat: 'user', subject: 'Delete my account and data', body: 'Please delete my account and all personal data as per privacy policy.', by: 'ethan', status: 'new', priority: 'medium', age: 5 },
  { cat: 'user', subject: 'Notifications keep repeating', body: 'I get the same notification email three times for each comment.', by: 'noah', status: 'closed', priority: 'low', assignee: 'support', age: 200, frtMin: 25 },
  { cat: 'creator', subject: 'Video upload stuck at 99%', body: 'My lesson video upload gets stuck at 99% for more than an hour.', by: 'emma', status: 'open', priority: 'high', assignee: 'support', age: 9, frtMin: 22 },
  { cat: 'creator', subject: 'How to change community URL', body: 'Can I change the slug of my community after it has been created?', by: 'sarah', status: 'awaiting_reply', priority: 'low', assignee: 'tom', age: 52, frtMin: 70 },
  { cat: 'creator', subject: 'Members cannot see my course', body: 'I published a new course but members still see a locked screen.', by: 'alex', status: 'open', priority: 'high', assignee: null, age: 4 },
  { cat: 'creator', subject: 'Question about platform fees', body: 'Is the platform fee charged on refunded payments as well?', by: 'liam', status: 'resolved', priority: 'medium', assignee: 'support', age: 110, frtMin: 35 },
  { cat: 'creator', subject: 'Request a featured spot in Discovery', body: 'Our community has grown a lot, can you consider it for the featured list?', by: 'olivia', status: 'new', priority: 'low', age: 2 },
  { cat: 'creator', subject: 'Event reminders are not sent', body: 'RSVPed members did not get a reminder for yesterday evening event.', by: 'noah', status: 'open', priority: 'medium', assignee: 'tom', age: 26, frtMin: 60 },
  { cat: 'payment', subject: 'Charged twice this month', body: 'I see two identical charges on my card for the same subscription.', by: 'sarah', status: 'open', priority: 'urgent', assignee: 'support', age: 6, escalated: true, frtMin: 9 },
  { cat: 'payment', subject: 'Card declined at checkout', body: 'My card is valid but checkout says it was declined three times.', by: 'daniel', status: 'new', priority: 'high', age: 2 },
  { cat: 'payment', subject: 'Payout has not arrived', body: 'My payout was approved 5 days ago and the money has not arrived yet.', by: 'emma', status: 'awaiting_reply', priority: 'high', assignee: 'support', age: 70, frtMin: 30 },
  { cat: 'payment', subject: 'Need an invoice for my company', body: 'Please send me a VAT invoice for the last 3 payments with our company name.', by: 'liam', status: 'resolved', priority: 'medium', assignee: 'tom', age: 150, frtMin: 85 },
  { cat: 'payment', subject: 'Refund for accidental purchase', body: 'I joined a paid community by mistake 10 minutes ago, can I get a refund?', by: 'alex', status: 'open', priority: 'medium', assignee: null, age: 1 },
  { cat: 'payment', subject: 'Trial converted without warning', body: 'My free trial ended and I was charged. I did not expect this.', by: 'maya', status: 'closed', priority: 'medium', assignee: 'support', age: 300, frtMin: 20 },
  { cat: 'payment', subject: 'Wrong currency on receipt', body: 'The receipt shows USD but I paid in VND.', by: 'ava', status: 'new', priority: 'low', age: 10 },
  { cat: 'user', subject: 'Two-factor code not working', body: 'The code I receive is always reported as invalid.', by: 'ava', status: 'awaiting_reply', priority: 'medium', assignee: 'tom', age: 40, frtMin: 45 },
  { cat: 'creator', subject: 'Bulk invite members by CSV', body: 'Is there a way to invite 300 members at once from a spreadsheet?', by: 'emma', status: 'resolved', priority: 'low', assignee: 'support', age: 220, frtMin: 50 },
];

const REPLIES = [
  'Thanks for reaching out. We are looking into this and will get back to you shortly.',
  'We have checked your account and applied a fix. Could you please try again and confirm?',
  'Following up: let us know if you still see the problem and we will escalate it to the engineering team.',
];
const FOLLOWUPS = ['Thank you, that works now.', 'I tried again and it still fails with the same error.'];

const FLAGS = [
  { key: 'dm_v2', name: 'Direct messages v2', description: '1:1 chat between members', stage: 'beta', enabled: true, pct: 50 },
  { key: 'premium_lock', name: 'Premium course locks', description: 'Lock modules by level or plan', stage: 'active', enabled: true, pct: 100 },
  { key: 'ai_moderation', name: 'AI moderation', description: 'Auto-flag spam and scams', stage: 'active', enabled: true, pct: 100 },
  { key: 'app_banner', name: 'Mobile app banner', description: 'Promote app downloads', stage: 'beta', enabled: false, pct: 100 },
  { key: 'native_live', name: 'Native livestream', description: 'Live events without Zoom', stage: 'draft', enabled: false, pct: 0 },
  { key: 'leaderboard_v2', name: 'Leaderboard v2', description: '30-day engagement scoring', stage: 'active', enabled: true, pct: 100 },
] as const;

const INTEGRATIONS = [
  { key: 'stripe', name: 'Stripe', initials: 'ST', color: '#635bff', description: 'Card payments and subscriptions.', category: 'payments', on: true, config: { accountId: 'acct_demo_1A2b3C', mode: 'test' }, mask: '••••9f2a' },
  { key: 'paypal', name: 'PayPal', initials: 'PP', color: '#003087', description: 'International payments and payouts.', category: 'payments', on: true, config: { merchantId: 'DEMO-MERCHANT', mode: 'sandbox' }, mask: '••••77c1' },
  { key: 'momo', name: 'MoMo', initials: 'MM', color: '#a50064', description: 'E-wallet for Vietnam.', category: 'payments', on: true, config: { partnerCode: 'MOMODEMO' }, mask: '••••0b3d' },
  { key: 'zoom', name: 'Zoom', initials: 'ZM', color: '#2d8cff', description: 'Meeting rooms for community events.', category: 'video', on: true, config: { accountEmail: 'events@sofinhub.com' }, mask: '••••e5aa' },
  { key: 'google_analytics', name: 'Google Analytics', initials: 'GA', color: '#e37400', description: 'Traffic and conversion tracking.', category: 'analytics', on: false, config: {}, mask: null },
  { key: 'mailgun', name: 'Mailgun', initials: 'MG', color: '#c02126', description: 'Transactional and notification email.', category: 'email', on: true, config: { domain: 'mg.sofinhub.com', region: 'us' }, mask: '••••41d8' },
  { key: 'slack', name: 'Slack', initials: 'SL', color: '#4a154b', description: 'Moderation alerts to internal channels.', category: 'chat', on: false, config: {}, mask: null },
  { key: 'cloudflare', name: 'Cloudflare', initials: 'CF', color: '#f38020', description: 'CDN and DDoS protection for media.', category: 'cdn', on: true, config: { zone: 'sofinhub.com' }, mask: '••••b290' },
] as const;

const TEMPLATES = [
  {
    key: 'welcome', name: 'Welcome member', status: 'active', variables: ['name', 'community'],
    subject: { en: 'Welcome to {{community}}', vi: 'Chào mừng bạn đến với {{community}}' },
    body: { en: 'Hi {{name}},\n\nWelcome to {{community}}! Introduce yourself in the feed and join the next event.\n\nSofinHub team', vi: 'Xin chào {{name}},\n\nChào mừng bạn đến với {{community}}! Hãy giới thiệu bản thân trong bảng tin và tham gia sự kiện sắp tới.\n\nĐội ngũ SofinHub' },
  },
  {
    key: 'verify_email', name: 'Verify email', status: 'active', variables: ['name', 'link'],
    subject: { en: 'Confirm your email address', vi: 'Xác thực email SofinHub' },
    body: { en: 'Hi {{name}},\n\nConfirm your email address using the link below (valid for 24 hours):\n{{link}}', vi: 'Xin chào {{name}},\n\nBấm vào liên kết sau để xác thực email (hiệu lực 24 giờ):\n{{link}}' },
  },
  {
    key: 'register_otp', name: 'Registration OTP', status: 'active', variables: ['name', 'code', 'minutes'],
    subject: { en: '{{code}} is your SofinHub verification code', vi: '{{code}} là mã xác thực SofinHub của bạn' },
    body: { en: 'Hi {{name}},\n\nYour SofinHub verification code is: {{code}}\nIt is valid for {{minutes}} minutes and can be used once. Do not share it with anyone.\n\nIf you did not sign up, ignore this email.', vi: 'Xin chào {{name}},\n\nMã xác thực email SofinHub của bạn là: {{code}}\nMã có hiệu lực {{minutes}} phút và chỉ dùng được một lần. Không chia sẻ mã này cho bất kỳ ai.\n\nNếu bạn không đăng ký tài khoản, hãy bỏ qua email này.' },
  },
  {
    key: 'reset_password', name: 'Reset password', status: 'active', variables: ['name', 'link'],
    subject: { en: 'Reset your SofinHub password', vi: 'Đặt lại mật khẩu SofinHub' },
    body: { en: 'Hi {{name}},\n\nUse the link below to reset your password (valid for 30 minutes):\n{{link}}\n\nIf you did not request this, ignore this email.', vi: 'Xin chào {{name}},\n\nBấm vào liên kết sau để đặt lại mật khẩu (hiệu lực 30 phút):\n{{link}}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.' },
  },
  {
    key: 'receipt', name: 'Payment receipt', status: 'active', variables: ['name', 'id', 'amount'],
    subject: { en: 'Your receipt #{{id}}', vi: 'Biên lai #{{id}} của bạn' },
    body: { en: 'Hi {{name}},\n\nThanks for your payment of {{amount}}. Receipt number: {{id}}.', vi: 'Xin chào {{name}},\n\nCảm ơn bạn đã thanh toán {{amount}}. Mã biên lai: {{id}}.' },
  },
  {
    key: 'warning', name: 'Violation warning', status: 'active', variables: ['name', 'reason'],
    subject: { en: 'Notice about community guidelines', vi: 'Thông báo về quy tắc cộng đồng' },
    body: { en: 'Hi {{name}},\n\nYour recent activity breaks our community guidelines: {{reason}}.', vi: 'Xin chào {{name}},\n\nHoạt động gần đây của bạn vi phạm quy tắc cộng đồng: {{reason}}.' },
  },
  {
    key: 'payout_sent', name: 'Payout sent', status: 'active', variables: ['name', 'amount'],
    subject: { en: 'You just received {{amount}}', vi: 'Bạn vừa nhận được {{amount}}' },
    body: { en: 'Hi {{name}},\n\nA payout of {{amount}} is on its way to your account.', vi: 'Xin chào {{name}},\n\nKhoản thanh toán {{amount}} đang được chuyển tới tài khoản của bạn.' },
  },
  {
    key: 'suspended', name: 'Account suspended', status: 'draft', variables: ['name', 'reason'],
    subject: { en: 'Your account has been suspended', vi: 'Tài khoản của bạn đã bị đình chỉ' },
    body: { en: 'Hi {{name}},\n\nYour account has been suspended. Reason: {{reason}}.', vi: 'Xin chào {{name}},\n\nTài khoản của bạn đã bị đình chỉ. Lý do: {{reason}}.' },
  },
] as const;

export async function seedAdminBatch3(ctx: SeedContext): Promise<void> {
  const { db } = ctx;
  const adminId = ctx.userIds.admin;
  if (!(await db.user.findUnique({ where: { id: adminSeedUserId('sarah') }, select: { id: true } }))) return;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

  // ------------------------------------------------------------------ vai trò tuỳ chỉnh (4 vai trò hệ thống đã có từ migration)
  await db.adminRole.upsert({
    where: { key: 'content_reviewer' },
    create: { key: 'content_reviewer', name: 'Content Reviewer', description: 'Chỉ xem người dùng và duyệt nội dung (vai trò tuỳ chỉnh mẫu).', permissions: ['dashboard.view', 'users.view', 'content.manage'], isSystem: false },
    update: {},
  });

  // ------------------------------------------------------------------ nhân viên
  const staffIds: Record<string, string> = {};
  for (const s of STAFF) {
    const email = `${s.key}@sofinhub.test`;
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    const id = existing?.id ?? adminSeed3UserId(s.key);
    if (!existing) {
      await db.user.create({ data: { id, email, firstName: s.first, lastName: s.last, passwordHash, emailVerified: true, createdAt: daysAgo(120), lastLoginAt: ago(s.seen) } });
    }
    staffIds[s.key] = id;
    await db.adminAccount.upsert({
      where: { userId: id },
      create: { userId: id, roleKey: s.role, twoFactorEnabled: s.tfa, status: 'suspended' in s && s.suspended ? 'suspended' : 'active', suspendedReason: 'suspended' in s && s.suspended ? 'Nghỉ việc, chờ thu hồi' : null, invitedById: adminId },
      update: {},
    });
  }
  // John Carter / Mia Lopez (đợt 1) làm Moderator.
  for (const key of ['john', 'mia']) {
    const u = await db.user.findUnique({ where: { id: adminSeedUserId(key) }, select: { id: true } });
    if (u) await db.adminAccount.upsert({ where: { userId: u.id }, create: { userId: u.id, roleKey: 'moderator', twoFactorEnabled: true, invitedById: adminId }, update: {} });
  }

  // ------------------------------------------------------------------ ticket hỗ trợ
  for (const [i, t] of T.entries()) {
    const id = sid(`ticket-${i}`);
    const requesterId = adminSeedUserId(t.by);
    const user = await db.user.findUnique({ where: { id: requesterId }, select: { firstName: true, lastName: true, email: true } });
    if (!user) continue;
    if (await db.supportTicket.findUnique({ where: { id }, select: { id: true } })) continue;
    const created = ago(t.age);
    const assigneeId = (t.assignee ? staffIds[t.assignee] : null) ?? null;
    const answered = t.status !== 'new' && t.status !== 'open' ? true : !!t.frtMin;
    const firstAt = answered && t.frtMin ? new Date(created.getTime() + t.frtMin * 60_000) : null;
    const resolvedAt = t.status === 'resolved' || t.status === 'closed' ? new Date(created.getTime() + Math.min(t.age * HOUR * 0.6, 2 * DAY)) : null;
    const last = resolvedAt ?? (firstAt ? new Date(Math.max(firstAt.getTime(), created.getTime() + (t.age * HOUR) / 3)) : created);
    const name = `${user.firstName} ${user.lastName}`.trim();
    const msgs: Array<{ kind: SupportMessageKind; authorId: string | null; authorName: string; body: string; at: Date }> = [{ kind: 'customer', authorId: requesterId, authorName: name, body: t.body, at: created }];
    if (firstAt && assigneeId) {
      const staffName = STAFF.find((s) => staffIds[s.key] === assigneeId)!;
      msgs.push({ kind: 'staff', authorId: assigneeId, authorName: `${staffName.first} ${staffName.last}`, body: REPLIES[i % REPLIES.length]!, at: firstAt });
      if (t.status === 'open' && i % 2 === 0) msgs.push({ kind: 'customer', authorId: requesterId, authorName: name, body: FOLLOWUPS[i % FOLLOWUPS.length]!, at: new Date(firstAt.getTime() + 30 * 60_000) });
      if (i % 3 === 0) msgs.push({ kind: 'internal_note', authorId: assigneeId, authorName: `${staffName.first} ${staffName.last}`, body: 'Checked the account logs: nothing abnormal on our side.', at: new Date(firstAt.getTime() + 5 * 60_000) });
    }
    if (t.escalated) msgs.push({ kind: 'system', authorId: assigneeId, authorName: 'System', body: 'Escalated (urgent): needs review by the payments/trust team.', at: new Date(created.getTime() + 20 * 60_000) });
    if (resolvedAt) msgs.push({ kind: 'system', authorId: assigneeId, authorName: 'System', body: t.status === 'closed' ? 'Đã đóng ticket' : 'Đã giải quyết ticket', at: resolvedAt });
    await db.supportTicket.create({
      data: {
        id,
        subject: t.subject,
        category: t.cat,
        priority: t.priority,
        status: t.status,
        requesterId,
        requesterName: name,
        requesterEmail: user.email,
        source: i % 4 === 0 ? 'contact_form' : 'user',
        assigneeId,
        escalated: !!t.escalated,
        escalatedAt: t.escalated ? new Date(created.getTime() + 20 * 60_000) : null,
        firstResponseAt: firstAt,
        resolvedAt,
        closedAt: t.status === 'closed' ? resolvedAt : null,
        lastActivityAt: last,
        createdAt: created,
        messages: { create: msgs.map((m, k) => ({ id: sid(`ticket-${i}-m${k}`), kind: m.kind, authorId: m.authorId, authorName: m.authorName, body: m.body, createdAt: m.at })) },
      },
    });
  }

  // ------------------------------------------------------------------ feature flags / tích hợp / mẫu email
  for (const [i, f] of FLAGS.entries()) {
    await db.featureFlag.upsert({
      where: { key: f.key },
      create: { key: f.key, name: f.name, description: f.description, stage: f.stage, enabled: f.enabled, rolloutPercent: f.pct, updatedById: adminId, createdAt: daysAgo(60 - i) },
      update: {},
    });
  }
  for (const [i, g] of INTEGRATIONS.entries()) {
    await db.integration.upsert({
      where: { key: g.key },
      create: { key: g.key, name: g.name, initials: g.initials, color: g.color, description: g.description, category: g.category, connected: g.on, config: g.config, secretMask: g.mask, connectedAt: g.on ? daysAgo(40 - i) : null, createdAt: daysAgo(90 - i) },
      update: {},
    });
  }
  for (const [i, t] of TEMPLATES.entries()) {
    await db.emailTemplate.upsert({
      where: { key: t.key },
      create: { key: t.key, name: t.name, description: '', status: t.status, isSystem: true, variables: [...t.variables], subject: t.subject, body: t.body, updatedById: adminId, createdAt: daysAgo(90 - i), updatedAt: daysAgo(i * 3) },
      update: {},
    });
  }

  // ------------------------------------------------------------------ broadcast mẫu (lịch sử, không phát lại thông báo)
  const broadcasts = [
    { n: 'maint', title: 'Bảo trì hệ thống đêm Chủ nhật', body: 'SofinHub sẽ bảo trì từ 01:00 đến 02:00 (GMT+7). Một số tính năng có thể tạm gián đoạn.', audience: { type: 'all' }, count: 2480, age: 9 },
    { n: 'creators', title: 'Chính sách phí mới cho Creator', body: 'Từ tháng sau, phí nền tảng được hiển thị minh bạch hơn trong trang doanh thu.', audience: { type: 'creators' }, count: 12, age: 3 },
  ];
  for (const b of broadcasts) {
    const id = sid(`broadcast-${b.n}`);
    await db.platformBroadcast.upsert({
      where: { id },
      create: { id, title: b.title, body: b.body, audience: b.audience, recipientCount: b.count, emailCount: 0, sentById: adminId, sentByName: 'Platform Admin', createdAt: daysAgo(b.age) },
      update: {},
    });
  }

  // ------------------------------------------------------------------ audit của nhân viên (có IP) để Audit Logs đa dạng actor/vai trò
  const audits: Array<{ n: string; actor: string; name: string; action: string; type: string; target: string; label: string; ip: string; h: number; reason?: string }> = [
    { n: 'a1', actor: 'support', name: 'Ryan Cho', action: 'support.ticket.reply', type: 'ticket', target: sid('ticket-0'), label: 'T-2002 · Cannot log in after password reset', ip: '113.161.24.10', h: 3 },
    { n: 'a2', actor: 'support', name: 'Ryan Cho', action: 'support.ticket.escalate', type: 'ticket', target: sid('ticket-3'), label: 'T-2004 · Account locked by mistake', ip: '113.161.24.10', h: 7, reason: 'Needs review by the trust team' },
    { n: 'a3', actor: 'finance', name: 'Grace Lee', action: 'refund.approve', type: 'refund', target: 'RF-demo-1', label: 'Refund $19.00', ip: '113.161.24.55', h: 20 },
    { n: 'a4', actor: 'moderator', name: 'Moderator Test', action: 'content.hide', type: 'content', target: 'post-demo-1', label: 'Post POST-3FA2B1C4', ip: '113.161.30.2', h: 30, reason: 'Spam' },
    { n: 'a5', actor: 'tom', name: 'Tom Baker', action: 'support.ticket.resolve', type: 'ticket', target: sid('ticket-4'), label: 'T-2005 · Cannot upload my avatar', ip: '14.232.8.77', h: 70 },
    { n: 'a6', actor: 'moderator', name: 'Moderator Test', action: 'user.warn', type: 'user', target: adminSeedUserId('maya'), label: 'Maya Chen', ip: '113.161.30.2', h: 96, reason: 'Repeated spam' },
  ];
  for (const a of audits) {
    const id = sid(`audit-${a.n}`);
    if (await db.adminAuditLog.findUnique({ where: { id }, select: { id: true } })) continue;
    await db.adminAuditLog.create({
      data: { id, actorId: staffIds[a.actor] ?? null, actorName: a.name, action: a.action, targetType: a.type, targetId: a.target, targetLabel: a.label, reason: a.reason ?? null, ip: a.ip, createdAt: ago(a.h) },
    });
  }

  // ------------------------------------------------------------------ Analytics: rải ngày đăng ký của thành viên demo + phiên quay lại
  await db.$executeRawUnsafe(`
    UPDATE "User" SET "createdAt" = now() - (abs(hashtext(id)) % 150) * interval '1 day' - (abs(hashtext(id || 'h')) % 24) * interval '1 hour'
    WHERE "isDemo" = true AND "createdAt" > now() - interval '3 days'`);
  await db.$executeRawUnsafe(`
    UPDATE "Enrollment" e SET "enrolledAt" = LEAST(now(), u."createdAt" + (abs(hashtext(e."userId" || e."courseId")) % 6) * interval '1 day')
    FROM "User" u WHERE u.id = e."userId" AND u."isDemo" = true AND e."enrolledAt" > now() - interval '3 days' AND u."createdAt" < now() - interval '3 days'`);
  // Phiên "quay lại" ở giữa tuần N sau đăng ký (ngày (N-1)*7+3) để cửa sổ retention tuần N đếm đúng. Bản cũ (đặt ở đầu tuần) bị xóa trước.
  await db.$executeRawUnsafe(`
    DELETE FROM "Session" s USING "User" u CROSS JOIN (VALUES (1), (2), (4), (8), (12)) AS w(n)
    WHERE u."isDemo" = true AND s."userId" = u.id AND s.id = md5(u.id || ':' || w.n::text)::uuid::text`);
  await db.$executeRawUnsafe(`
    INSERT INTO "Session" (id, "userId", "refreshTokenHash", "createdAt", "lastUsedAt", "revokedAt", "expiresAt")
    SELECT md5(u.id || ':s2:' || w.n::text)::uuid::text, u.id, NULL, u."createdAt" + ((w.n - 1) * 7 + 3) * interval '1 day', u."createdAt" + ((w.n - 1) * 7 + 3) * interval '1 day',
           u."createdAt" + ((w.n - 1) * 7 + 3) * interval '1 day', u."createdAt" + ((w.n - 1) * 7 + 3) * interval '1 day'
    FROM "User" u CROSS JOIN (VALUES (1, 62), (2, 48), (4, 38), (8, 30), (12, 24)) AS w(n, pct)
    WHERE u."isDemo" = true AND u."createdAt" + ((w.n - 1) * 7 + 4) * interval '1 day' < now() AND (abs(hashtext(u.id || ':' || w.n::text)) % 100) < w.pct
    ON CONFLICT (id) DO NOTHING`);
}
