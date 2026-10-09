import bcrypt from 'bcryptjs';
import type { Prisma } from '../../src/generated/prisma/client.js';
import type { CommunityModeration, ReportAction, ReportReason, ReportRisk, ReportStatus, UserStatus } from '../../src/generated/prisma/enums.js';
import { seedVnd } from '../../src/db/enums.js';
import { TEST_PASSWORD } from '../seed-accounts.js';
import type { SeedContext } from './context.js';

/**
 * Dữ liệu cho Admin đợt 1 (idempotent: id cố định `seed-admin-*`, chỉ create — chạy lại không ghi đè thao tác thật của admin):
 *  - 12 người dùng thật (mật khẩu TEST_PASSWORD, email `<tên>@sofinhub.test`): có restricted / suspended / banned, rải ngày đăng ký 90 ngày.
 *  - Cộng đồng: chờ duyệt, yêu cầu chỉnh sửa, từ chối, bị đình chỉ, và 4 cái trong thùng rác.
 *  - Báo cáo (case) đủ risk/status/assignee + lịch sử xử lý + nhật ký audit để màn Moderation / Audit không trống.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR);
const daysAgo = (d: number) => new Date(Date.now() - d * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

const PEOPLE: { key: string; first: string; last: string; status: UserStatus; reason?: string; until?: Date | null; restrictions?: string[]; joined: number; seen: number }[] = [
  { key: 'sarah', first: 'Sarah', last: 'Kim', status: 'active', joined: 84, seen: 1 },
  { key: 'alex', first: 'Alex', last: 'Rivera', status: 'active', joined: 77, seen: 3 },
  { key: 'daniel', first: 'Daniel', last: 'Park', status: 'active', joined: 69, seen: 10 },
  { key: 'maya', first: 'Maya', last: 'Chen', status: 'restricted', reason: 'Spam', until: ahead(7), restrictions: ['post', 'comment'], joined: 61, seen: 30 },
  { key: 'liam', first: 'Liam', last: 'Nguyen', status: 'active', joined: 52, seen: 5 },
  { key: 'olivia', first: 'Olivia', last: 'Tran', status: 'suspended', reason: 'Harassment', until: ahead(14), joined: 45, seen: 90 },
  { key: 'ethan', first: 'Ethan', last: 'Brooks', status: 'restricted', reason: 'Scam', until: ahead(3), restrictions: ['dm', 'create_community'], joined: 38, seen: 48 },
  { key: 'sophia', first: 'Sophia', last: 'Patel', status: 'banned', reason: 'Scam', joined: 31, seen: 200 },
  { key: 'noah', first: 'Noah', last: 'Williams', status: 'active', joined: 22, seen: 8 },
  { key: 'emma', first: 'Emma', last: 'Garcia', status: 'active', joined: 14, seen: 2 },
  { key: 'lucas', first: 'Lucas', last: 'Silva', status: 'suspended', reason: 'Spam', until: null, joined: 9, seen: 120 },
  { key: 'ava', first: 'Ava', last: 'Johnson', status: 'active', joined: 3, seen: 1 },
];
const STAFF = [
  { key: 'john', first: 'John', last: 'Carter' },
  { key: 'mia', first: 'Mia', last: 'Lopez' },
];

export const adminSeedUserId = (key: string) => `seed-admin-user-${key}`;

export async function seedAdmin(ctx: SeedContext): Promise<void> {
  const { db, userIds } = ctx;
  const adminId = userIds.admin;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);
  const uid = adminSeedUserId;

  // ------------------------------------------------------------------ người dùng
  for (const p of PEOPLE) {
    const id = uid(p.key);
    await db.user.upsert({
      where: { id },
      create: {
        id, email: `${p.key}@sofinhub.test`, firstName: p.first, lastName: p.last, passwordHash, emailVerified: true,
        createdAt: daysAgo(p.joined), lastLoginAt: ago(p.seen), status: p.status, statusReason: p.reason ?? null, statusUntil: p.until ?? null,
        statusRestrictions: p.restrictions ?? [], statusChangedAt: p.status === 'active' ? null : daysAgo(2), statusChangedById: p.status === 'active' ? null : adminId,
      },
      update: {},
    });
    // Phiên gần nhất => "Last active" trong danh sách (bị đình chỉ/cấm thì phiên đã bị thu hồi).
    const blocked = p.status === 'suspended' || p.status === 'banned';
    await db.session.upsert({
      where: { id: `seed-admin-sess-${p.key}` },
      create: {
        id: `seed-admin-sess-${p.key}`, userId: id, ip: `113.161.24.${10 + PEOPLE.indexOf(p)}`, userAgent: 'Chrome · macOS', createdAt: ago(p.seen),
        lastUsedAt: ago(p.seen), revokedAt: blocked ? daysAgo(2) : null, expiresAt: ahead(30),
      },
      update: {},
    });
  }
  for (const s of STAFF) {
    await db.user.upsert({
      where: { id: uid(s.key) },
      create: { id: uid(s.key), email: `${s.key}.${s.last.toLowerCase()}@sofinhub.test`, firstName: s.first, lastName: s.last, passwordHash, emailVerified: true, createdAt: daysAgo(200) },
      update: {},
    });
  }

  // ------------------------------------------------------------------ cộng đồng
  const common = { thumbnail: '/images/courses/biz.webp', instructorRole: 'Chủ cộng đồng', language: 'vi' as const, status: 'open' as const };
  interface Com {
    id: string; title: string; owner: string; category: 'business' | 'tech' | 'self' | 'hobby' | 'health' | 'content'; priceUsd: number;
    mod: CommunityModeration; hoursAgo?: number; note?: string; reason?: string; locked?: boolean;
    deleted?: { daysAgo: number; byOwner: boolean; reason: string };
  }
  const coms: Com[] = [
    { id: 'design-circle', title: 'Design Circle', owner: 'noah', category: 'content', priceUsd: 29, mod: 'pending_review', hoursAgo: 6 },
    { id: 'creator-academy', title: 'Creator Academy', owner: 'emma', category: 'business', priceUsd: 59, mod: 'pending_review', hoursAgo: 15 },
    { id: 'no-code-nation', title: 'No-Code Nation', owner: 'ava', category: 'tech', priceUsd: 39, mod: 'pending_review', hoursAgo: 27 },
    { id: 'startup-grind', title: 'Startup Grind', owner: 'daniel', category: 'business', priceUsd: 0, mod: 'changes_requested', hoursAgo: 52, note: 'Vui lòng làm rõ mô tả và bổ sung ảnh bìa.' },
    { id: 'quick-rich-club', title: 'Quick Rich Club', owner: 'lucas', category: 'business', priceUsd: 199, mod: 'rejected', hoursAgo: 90, reason: 'Misleading claims' },
    { id: 'crypto-signals-pro', title: 'Crypto Signals Pro', owner: 'ethan', category: 'business', priceUsd: 199, mod: 'suspended', hoursAgo: 400, reason: 'Payment risk', locked: true },
    { id: 'side-hustle-squad', title: 'Side Hustle Squad', owner: 'daniel', category: 'business', priceUsd: 19, mod: 'deleted', hoursAgo: 900, deleted: { daysAgo: 3, byOwner: true, reason: 'Owner request' } },
    { id: 'photo-walks', title: 'Photo Walks', owner: 'ava', category: 'hobby', priceUsd: 0, mod: 'deleted', hoursAgo: 800, deleted: { daysAgo: 7, byOwner: false, reason: 'Fraud' } },
    { id: 'keto-kitchen', title: 'Keto Kitchen', owner: 'noah', category: 'health', priceUsd: 15, mod: 'deleted', hoursAgo: 700, deleted: { daysAgo: 11, byOwner: false, reason: 'Spam' } },
    { id: 'pixel-traders', title: 'Pixel Traders', owner: 'lucas', category: 'business', priceUsd: 99, mod: 'deleted', hoursAgo: 600, deleted: { daysAgo: 15, byOwner: true, reason: 'Owner request' } },
  ];
  for (const c of coms) {
    const o = PEOPLE.find((p) => p.key === c.owner)!;
    const data: Prisma.CommunityUncheckedCreateInput = {
      id: c.id, title: c.title, description: `Cộng đồng ${c.title} dành cho những ai muốn học hỏi, chia sẻ và cùng nhau phát triển.`,
      category: c.category, tag: 'new', ...common, instructorName: `${o.first} ${o.last}`, priceCents: seedVnd(c.priceUsd),
      pricing: c.priceUsd > 0 ? 'paid' : 'free', visibility: 'public', ownerId: uid(c.owner), createdAt: ago(c.hoursAgo ?? 100),
      moderationStatus: c.mod, moderationReason: c.reason ?? null, moderationNote: c.note ?? null, moderationUpdatedAt: c.mod === 'pending_review' ? null : daysAgo(1),
      moderatedById: c.mod === 'pending_review' ? null : adminId, locked: c.locked ?? false, lockReason: c.locked ? c.reason ?? null : null,
    };
    if (c.deleted) {
      Object.assign(data, {
        moderationStatus: 'deleted', preDeleteStatus: 'active', deletedAt: daysAgo(c.deleted.daysAgo), deleteReason: c.deleted.reason,
        deletedById: c.deleted.byOwner ? null : adminId,
      });
    }
    await db.community.upsert({ where: { id: c.id }, create: data, update: {} });
    await db.enrollment.upsert({
      where: { userId_communityId: { userId: uid(c.owner), communityId: c.id } },
      create: { userId: uid(c.owner), communityId: c.id, role: 'owner' },
      update: {},
    });
  }
  // Vài thành viên cho các cộng đồng mới + chủ cho cộng đồng seed mẫu chưa có chủ (chỉ khi còn trống) để danh sách admin có chủ sở hữu.
  const memberOf: Record<string, string[]> = {
    'design-circle': ['sarah', 'alex'], 'creator-academy': ['maya', 'liam', 'daniel'], 'no-code-nation': ['sarah'], 'startup-grind': ['alex'],
    'crypto-signals-pro': ['maya', 'lucas', 'olivia', 'noah'],
    photo: ['sarah', 'alex', 'daniel', 'liam', 'emma'], yt: ['sarah', 'maya', 'noah', 'ava'], fin: ['alex', 'ethan', 'sophia', 'lucas'],
    ai: ['sarah', 'alex', 'liam', 'noah', 'emma'], mkt: ['daniel', 'maya', 'olivia', 'ava'], fit: ['liam', 'emma'], des: ['sophia', 'ava'], biz: ['ethan', 'noah'],
  };
  const extraOwners: Record<string, string> = { ai: 'alex', mkt: 'daniel', fit: 'liam', des: 'sophia', biz: 'ethan' };
  for (const [communityId, key] of Object.entries(extraOwners)) {
    const o = PEOPLE.find((p) => p.key === key)!;
    await db.community.updateMany({ where: { id: communityId, ownerId: null }, data: { ownerId: uid(key), instructorName: `${o.first} ${o.last}` } });
    await db.enrollment.upsert({
      where: { userId_communityId: { userId: uid(key), communityId: communityId } },
      create: { userId: uid(key), communityId: communityId, role: 'owner' },
      update: {},
    });
  }
  for (const [communityId, keys] of Object.entries(memberOf)) {
    if (!(await db.community.findUnique({ where: { id: communityId }, select: { id: true } }))) continue;
    for (const k of keys) {
      await db.enrollment.upsert({
        where: { userId_communityId: { userId: uid(k), communityId: communityId } },
        create: { userId: uid(k), communityId: communityId, role: 'member', enrolledAt: daysAgo(5 + keys.indexOf(k) * 9), lastActiveAt: ago(2 + keys.indexOf(k) * 20) },
        update: {},
      });
    }
  }

  // ------------------------------------------------------------------ nội dung bị báo cáo
  const posts: { id: string; course: string; author: string; text: string; hoursAgo: number }[] = [
    { id: 'seed-admin-post-1', course: 'photo', author: 'lucas', text: 'Earn $5K/week with one click — DM me now. Limited spots left, pay the $49 deposit to lock your place!', hoursAgo: 30 },
    { id: 'seed-admin-post-2', course: 'yt', author: 'lucas', text: 'Cracked AI tools pack — free download link inside, no payment required.', hoursAgo: 52 },
    { id: 'seed-admin-post-3', course: 'photo', author: 'sarah', text: 'New Video: Claude Code is Starting To Get Dangerous — check it out!', hoursAgo: 20 },
    { id: 'seed-admin-post-4', course: 'fin', author: 'ethan', text: 'DM me for the system, only 3 spots left. Guaranteed 10x returns.', hoursAgo: 12 },
    { id: 'seed-admin-post-5', course: 'photo', author: 'maya', text: 'Join my Telegram for referral bonuses!!! Click my link in bio.', hoursAgo: 70 },
  ];
  for (const p of posts) {
    await db.post.upsert({
      where: { id: p.id },
      create: { id: p.id, communityId: p.course, authorId: uid(p.author), content: p.text, createdAt: ago(p.hoursAgo), likesCount: 3, commentsCount: 1 },
      update: {},
    });
  }
  const comments: { id: string; post: string; author: string; text: string; hoursAgo: number }[] = [
    { id: 'seed-admin-cmt-1', post: 'seed-admin-post-3', author: 'sophia', text: 'This course is a scam, get your money back', hoursAgo: 8 },
    { id: 'seed-admin-cmt-2', post: 'seed-admin-post-3', author: 'noah', text: 'Stop spamming the group with referral links', hoursAgo: 6 },
    { id: 'seed-admin-cmt-3', post: 'seed-admin-post-1', author: 'olivia', text: 'Nobody here wants your garbage, go away.', hoursAgo: 25 },
    { id: 'seed-admin-cmt-4', post: 'seed-admin-post-1', author: 'liam', text: 'This looks like the same scam from last week.', hoursAgo: 24 },
  ];
  for (const c of comments) {
    await db.postComment.upsert({
      where: { id: c.id },
      create: { id: c.id, postId: c.post, authorId: uid(c.author), content: c.text, createdAt: ago(c.hoursAgo) },
      update: {},
    });
  }

  // ------------------------------------------------------------------ báo cáo (case)
  interface Rep {
    n: number; course: string; type: 'post' | 'comment' | 'member'; target: string; targetUser: string; reporter: string; reason: ReportReason; risk: ReportRisk;
    status: ReportStatus; assignee?: string; hoursAgo: number; excerpt?: string; detail?: string; action?: ReportAction; resolvedBy?: string; note?: string;
  }
  const exc = (id: string) => posts.find((p) => p.id === id)?.text ?? comments.find((c) => c.id === id)?.text ?? '';
  const reps: Rep[] = [
    { n: 1, course: 'photo', type: 'post', target: 'seed-admin-post-1', targetUser: 'lucas', reporter: 'sarah', reason: 'scam', risk: 'critical', status: 'open', assignee: 'john', hoursAgo: 0.3, detail: 'Asks for a $49 deposit via DM.' },
    { n: 2, course: 'photo', type: 'post', target: 'seed-admin-post-1', targetUser: 'lucas', reporter: 'alex', reason: 'scam', risk: 'critical', status: 'open', assignee: 'john', hoursAgo: 0.6 },
    { n: 3, course: 'photo', type: 'post', target: 'seed-admin-post-1', targetUser: 'lucas', reporter: 'liam', reason: 'spam', risk: 'critical', status: 'open', hoursAgo: 1 },
    { n: 4, course: 'photo', type: 'comment', target: 'seed-admin-cmt-1', targetUser: 'sophia', reporter: 'sarah', reason: 'harassment', risk: 'high', status: 'under_review', assignee: 'mia', hoursAgo: 2 },
    { n: 5, course: 'yt', type: 'post', target: 'seed-admin-post-2', targetUser: 'lucas', reporter: 'maya', reason: 'copyright', risk: 'high', status: 'open', assignee: 'john', hoursAgo: 3 },
    { n: 6, course: 'photo', type: 'comment', target: 'seed-admin-cmt-2', targetUser: 'noah', reporter: 'emma', reason: 'harassment', risk: 'low', status: 'open', hoursAgo: 4 },
    { n: 7, course: 'photo', type: 'post', target: 'seed-admin-post-3', targetUser: 'sarah', reporter: 'noah', reason: 'spam', risk: 'low', status: 'dismissed', assignee: 'mia', hoursAgo: 40, action: 'dismiss', resolvedBy: 'mia', note: 'No violation: normal self-promotion allowed in this community.' },
    { n: 8, course: 'fin', type: 'post', target: 'seed-admin-post-4', targetUser: 'ethan', reporter: 'alex', reason: 'scam', risk: 'medium', status: 'open', hoursAgo: 5 },
    { n: 9, course: 'photo', type: 'comment', target: 'seed-admin-cmt-3', targetUser: 'olivia', reporter: 'liam', reason: 'hate_speech', risk: 'critical', status: 'open', assignee: 'john', hoursAgo: 6 },
    { n: 10, course: 'photo', type: 'member', target: uid('sophia'), targetUser: 'sophia', reporter: 'emma', reason: 'harassment', risk: 'high', status: 'under_review', assignee: 'mia', hoursAgo: 9 },
    { n: 11, course: 'yt', type: 'post', target: 'seed-admin-post-5', targetUser: 'maya', reporter: 'ava', reason: 'spam', risk: 'medium', status: 'resolved', assignee: 'john', hoursAgo: 60, action: 'warn_user', resolvedBy: 'john', note: 'Warned about referral spam.' },
    { n: 12, course: 'photo', type: 'comment', target: 'seed-admin-cmt-4', targetUser: 'liam', reporter: 'daniel', reason: 'other', risk: 'low', status: 'resolved', assignee: 'mia', hoursAgo: 80, action: 'none', resolvedBy: 'mia', note: 'Handled by community moderators.' },
  ];
  for (const r of reps) {
    const id = `seed-admin-report-${r.n}`;
    const staff = (k?: string) => (k ? uid(k) : null);
    await db.report.upsert({
      where: { id },
      create: {
        id, communityId: r.course, targetType: r.type, targetId: r.target, targetUserId: uid(r.targetUser), targetExcerpt: r.type === 'member' ? null : exc(r.target).slice(0, 120),
        reporterId: uid(r.reporter), reason: r.reason, detail: r.detail ?? null, status: r.status, risk: r.risk, assignedToId: staff(r.assignee), action: r.action ?? null,
        note: r.note ?? null, resolvedById: staff(r.resolvedBy), resolvedAt: r.action ? ago(r.hoursAgo - 1) : null, createdAt: ago(r.hoursAgo),
      },
      update: {},
    });
    if (r.assignee) {
      await db.reportEvent.upsert({
        where: { id: `seed-admin-evt-${r.n}-assign` },
        create: { id: `seed-admin-evt-${r.n}-assign`, reportId: id, actorId: adminId, type: 'assign', meta: { assigneeId: staff(r.assignee) }, createdAt: ago(Math.max(0, r.hoursAgo - 0.2)) },
        update: {},
      });
    }
    if (r.action) {
      await db.reportEvent.upsert({
        where: { id: `seed-admin-evt-${r.n}-decision` },
        create: { id: `seed-admin-evt-${r.n}-decision`, reportId: id, actorId: staff(r.resolvedBy), type: r.action === 'dismiss' ? 'dismiss' : r.action === 'none' ? 'resolve' : r.action, note: r.note ?? null, createdAt: ago(r.hoursAgo - 1) },
        update: {},
      });
    }
  }

  // ------------------------------------------------------------------ nhật ký audit mẫu
  const adminName = 'Platform Admin';
  const audits: { n: number; hours: number; action: string; type: string; target: string; label: string; reason?: string; evidence?: string; caseN?: number; meta?: Record<string, unknown> }[] = [
    { n: 1, hours: 48, action: 'user.ban', type: 'user', target: uid('sophia'), label: 'Sophia Patel', reason: 'Scam', evidence: 'Payment link, 11 reports', meta: { from: 'active', to: 'banned' } },
    { n: 2, hours: 47, action: 'user.suspend', type: 'user', target: uid('olivia'), label: 'Olivia Tran', reason: 'Harassment', meta: { from: 'active', to: 'suspended' } },
    { n: 3, hours: 46, action: 'user.restrict', type: 'user', target: uid('maya'), label: 'Maya Chen', reason: 'Spam', meta: { from: 'active', to: 'restricted' } },
    { n: 4, hours: 40, action: 'case.dismiss', type: 'case', target: 'seed-admin-report-7', label: 'CASE-00007', caseN: 7 },
    { n: 5, hours: 59, action: 'case.warn', type: 'user', target: uid('maya'), label: 'Maya Chen', reason: 'spam', evidence: 'Warned about referral spam.', caseN: 11 },
    { n: 6, hours: 79, action: 'case.resolve', type: 'case', target: 'seed-admin-report-12', label: 'CASE-00012', caseN: 12 },
    { n: 7, hours: 24, action: 'case.remove_content', type: 'content', target: 'seed-admin-post-5', label: 'Join my Telegram for referral bonuses!!!', reason: 'Spam', caseN: 11 },
    { n: 8, hours: 20, action: 'community.suspend', type: 'community', target: 'crypto-signals-pro', label: 'Crypto Signals Pro', reason: 'Payment risk' },
    { n: 9, hours: 72, action: 'community.delete', type: 'community', target: 'photo-walks', label: 'Photo Walks', reason: 'Fraud' },
    { n: 10, hours: 96, action: 'community.reject', type: 'community', target: 'quick-rich-club', label: 'Quick Rich Club', reason: 'Misleading claims' },
    { n: 11, hours: 30, action: 'community.request_changes', type: 'community', target: 'startup-grind', label: 'Startup Grind' },
  ];
  for (const a of audits) {
    await db.adminAuditLog.upsert({
      where: { id: `seed-admin-audit-${a.n}` },
      create: {
        id: `seed-admin-audit-${a.n}`, actorId: adminId, actorName: adminName, action: a.action, targetType: a.type, targetId: a.target, targetLabel: a.label,
        reason: a.reason ?? null, evidence: a.evidence ?? null, caseId: a.caseN ? `seed-admin-report-${a.caseN}` : null, metadata: a.meta as Prisma.InputJsonValue | undefined, createdAt: ago(a.hours),
      },
      update: {},
    });
  }
}
