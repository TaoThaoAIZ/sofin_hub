import { randomUUID } from 'node:crypto';
import { centsToUsd, usdToCents } from '../../db/enums.js';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { Community as CommunityRow } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { toEmbedUrl } from '../classroom/classroom.schema.js';
import { assertUserCan } from '../auth/user-status.js';
import { userBriefView } from '../auth/user-view.js';
import { asRules } from '../catalog/catalog.repository.js';
import { catalogService } from '../catalog/catalog.service.js';
import { annualSavingsPct } from '../catalog/community.types.js';
import { cfg } from '../settings/settings.service.js';
import { prismaUploadRepository } from '../uploads/uploads.repository.js';
import { FILE_URL_PREFIX, KEY_PATTERN } from '../uploads/uploads.types.js';
import {
  connectPayoutAccount,
  getHostingPlanView,
  getPayoutAccountView,
  ownerPlanCatalogue,
  readHostingPlan,
  readPayoutAccount,
  requireOwnerOf,
  selectHostingPlan,
  skipPayoutAccount,
} from './owner-plan.service.js';
import {
  MAX_DRAFTS,
  SLUG_MAX,
  SLUG_MIN,
  WIZARD_STEPS,
  priceError,
  type IdentityBody,
  type MembersBody,
  type PlanBody,
  type WizardStep,
} from './wizard.schema.js';

const DEFAULT_THUMBNAIL = '/images/courses/biz.webp';
const DAY_MS = 86_400_000;
const MIN_MEMBERS_FOR_DISCOVERY = 10;

/** Slug không được dùng (trùng route/thương hiệu/quản trị). Trùng cả với `TAKEN` của mockup (admin, sofinhub). */
export const RESERVED_SLUGS = new Set([
  'admin', 'administrator', 'sofinhub', 'sofin', 'api', 'communities', 'community', 'courses', 'course', 'drafts', 'draft', 'me', 'login', 'logout', 'register', 'signup',
  'signin', 'settings', 'discover', 'explore', 'pricing', 'help', 'support', 'about', 'terms', 'privacy', 'static', 'assets', 'files', 'uploads', 'invites', 'invite',
  'join', 'new', 'create', 'dashboard', 'messages', 'notifications', 'search', 'events', 'classroom', 'payments', 'auth', 'health', 'dev', 'featured', 'categories',
  'revenue-estimate', 'slug-available', 'rules-template', 'owner-plans', 'www', 'app', 'root', 'null', 'undefined',
]);

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd');
export const slugify = (s: string): string => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SLUG_MAX).replace(/-+$/g, '');

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Nội quy mẫu cho "Sửa nội quy mẫu". */
export const RULES_TEMPLATE = [
  { title: 'Tôn trọng lẫn nhau', body: 'Góp ý văn minh, không công kích cá nhân, không phân biệt đối xử.' },
  { title: 'Không spam, không quảng cáo', body: 'Không đăng liên kết bán hàng hoặc tự quảng cáo khi chưa được chủ cộng đồng cho phép.' },
  { title: 'Đăng đúng chủ đề', body: 'Chọn đúng danh mục khi đăng bài để mọi người dễ tìm và thảo luận.' },
  { title: 'Bảo vệ thông tin riêng tư', body: 'Không chia sẻ thông tin cá nhân của người khác khi chưa được đồng ý.' },
];

type SlugReason = null | 'invalid_format' | 'too_short' | 'too_long' | 'reserved' | 'taken';
const SLUG_MESSAGES: Record<Exclude<SlugReason, null>, string> = {
  invalid_format: 'Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang (không bắt đầu/kết thúc bằng gạch ngang)',
  too_short: `Đường dẫn cần ít nhất ${SLUG_MIN} ký tự`,
  too_long: `Đường dẫn tối đa ${SLUG_MAX} ký tự`,
  reserved: 'Đường dẫn này được hệ thống giữ lại, hãy chọn tên khác',
  taken: 'Đường dẫn đã có người dùng',
};

type DraftRow = CommunityRow;
const isP2002 = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

async function loadDraft(userId: string, id: string): Promise<DraftRow> {
  const row = await prisma.community.findFirst({ where: { id, deletedAt: null } });
  if (!row || row.ownerId !== userId) throw HttpError.notFound('Không tìm thấy bản nháp');
  if (row.moderationStatus !== 'draft') throw HttpError.coded(409, 'NOT_A_DRAFT', 'Cộng đồng này đã được tạo, không còn là bản nháp');
  return row;
}

/** Xác thực URL ảnh là file upload CỦA CHÍNH user với đúng mục đích (không cho nhúng URL ngoài tùy ý). */
async function assertOwnUpload(userId: string, url: string, purpose: 'avatar' | 'cover', label: string) {
  const key = url.startsWith(FILE_URL_PREFIX) ? url.slice(FILE_URL_PREFIX.length) : '';
  const rec = KEY_PATTERN.test(key) ? await prismaUploadRepository.get(key) : undefined;
  if (!rec || rec.ownerId !== userId || rec.purpose !== purpose || rec.status !== 'uploaded' || rec.removed) {
    throw HttpError.coded(400, 'UPLOAD_INVALID', `${label} không hợp lệ: hãy tải ảnh lên (purpose "${purpose}") rồi dùng fileUrl trả về`);
  }
}

export function estimateNet(priceCents: number) {
  const p = cfg().payments;
  // Cùng công thức làm tròn với báo cáo doanh thu (revenueTotals): (x * bp + 5000) / 10000.
  const commissionBp = Math.round(p.commissionPct * 100);
  const gatewayBp = Math.round(p.gatewayFeePct * 100);
  const platformFeeCents = Math.floor((priceCents * commissionBp + 5000) / 10000);
  const gatewayFeeCents = Math.floor((priceCents * gatewayBp + 5000) / 10000) + (priceCents > 0 ? p.gatewayFeeFixedCents : 0);
  return { platformFeeCents, gatewayFeeCents, netCents: Math.max(0, priceCents - platformFeeCents - gatewayFeeCents) };
}

function missingFor(row: DraftRow, hasPlan: boolean) {
  const missing: Array<{ step: WizardStep; field: string; message: string }> = [];
  if (!row.title || row.title.trim().length < 3) missing.push({ step: 'basics', field: 'title', message: 'Nhập tên cộng đồng' });
  if (!row.description.trim()) missing.push({ step: 'basics', field: 'description', message: 'Nhập mô tả ngắn' });
  if (!row.draftSteps.includes('members')) missing.push({ step: 'members', field: 'members', message: 'Hoàn thành bước "Thành viên & giá"' });
  if (row.priceCents > 0 && row.priceAnnualCents != null && row.priceAnnualCents > 12 * row.priceCents) {
    missing.push({ step: 'members', field: 'priceAnnualUsd', message: 'Giá năm không được vượt quá 12 lần giá tháng' });
  }
  if (cfg().owner.requirePlan && !hasPlan) missing.push({ step: 'plan', field: 'plan', message: 'Chọn gói và bắt đầu dùng thử' });
  return missing;
}

async function draftView(row: DraftRow) {
  const [plan, payout] = await Promise.all([getHostingPlanView(row.id), getPayoutAccountView(row.id)]);
  const done = WIZARD_STEPS.filter((s) => row.draftSteps.includes(s));
  const next = WIZARD_STEPS.find((s) => !done.includes(s)) ?? 'launch';
  const missing = missingFor(row, !!plan);
  const annual = row.priceAnnualCents == null ? null : centsToUsd(row.priceAnnualCents);
  return {
    id: row.id,
    slug: row.id,
    status: 'draft' as const,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedSteps: done,
    nextStep: next,
    basics: { title: row.title, slug: row.id, description: row.description, category: row.category },
    plan,
    identity: { logoUrl: row.logoUrl, coverUrl: row.coverUrl, brandColor: row.brandColor, promise: row.promise, benefits: row.benefits, introVideoUrl: row.introVideoUrl },
    members: {
      visibility: row.visibility,
      priceUsd: centsToUsd(row.priceCents),
      priceAnnualUsd: annual,
      annualSavingsPct: annualSavingsPct(centsToUsd(row.priceCents), annual),
      memberTrialEnabled: row.memberTrialEnabled,
      trialDays: row.memberTrialEnabled && row.priceCents > 0 ? cfg().payments.trialDays : 0,
      joinQuestions: row.joinQuestions,
      rules: asRules(row.rules),
      requireRulesAgreement: row.requireRulesAgreement,
      autoApprovePaid: row.autoApprovePaid,
    },
    payout,
    readiness: { canPublish: missing.length === 0, missing },
  };
}

export const wizardService = {
  // ------------------------------------------------------------------ slug
  async checkSlug(rawSlug: string, userId?: string) {
    const slug = rawSlug.trim().toLowerCase();
    const result = (reason: SlugReason, suggestion?: string) => ({
      slug,
      available: reason === null,
      reason,
      message: reason === null ? 'Còn trống' : SLUG_MESSAGES[reason],
      ...(suggestion ? { suggestion } : {}),
    });
    if (slug.length < SLUG_MIN) return result('too_short');
    if (slug.length > SLUG_MAX) return result('too_long');
    if (!SLUG_RE.test(slug)) return result('invalid_format');
    if (RESERVED_SLUGS.has(slug)) return result('reserved');
    const row = await prisma.community.findUnique({ where: { id: slug }, select: { id: true, ownerId: true, moderationStatus: true, deletedAt: true } });
    // Nháp CỦA CHÍNH mình thì coi là còn trống (đang giữ chỗ cho mình).
    if (row && !(userId && row.ownerId === userId && row.moderationStatus === 'draft' && !row.deletedAt)) {
      for (let n = 2; n <= 30; n++) {
        const alt = `${slug}-${n}`.slice(0, SLUG_MAX);
        if (!RESERVED_SLUGS.has(alt) && !(await prisma.community.findUnique({ where: { id: alt }, select: { id: true } }))) return result('taken', alt);
      }
      return result('taken');
    }
    return result(null);
  },

  /** Ném lỗi nghiệp vụ nếu slug không dùng được (dùng khi tạo/đổi slug của nháp). */
  async assertSlug(slug: string, userId: string) {
    const r = await wizardService.checkSlug(slug, userId);
    if (r.available) return;
    const code = r.reason === 'taken' ? 'SLUG_TAKEN' : r.reason === 'reserved' ? 'SLUG_RESERVED' : 'SLUG_INVALID';
    throw HttpError.coded(r.reason === 'taken' ? 409 : 400, code, r.message, r.suggestion ? { suggestion: r.suggestion } : undefined);
  },

  // ------------------------------------------------------------------ nháp
  async createDraft(userId: string, input: { title: string; slug?: string; description: string; category: DraftRow['category'] }) {
    await assertUserCan(userId, 'create_community');
    const slug = (input.slug ?? slugify(input.title)).trim();
    await wizardService.assertSlug(slug, userId);
    const drafts = await prisma.community.count({ where: { ownerId: userId, moderationStatus: 'draft', deletedAt: null } });
    if (drafts >= MAX_DRAFTS) throw HttpError.coded(409, 'DRAFT_LIMIT', `Bạn chỉ có thể giữ tối đa ${MAX_DRAFTS} bản nháp, hãy xóa bớt hoặc hoàn tất một bản nháp`);
    const owner = await userBriefView(userId);
    try {
      const row = await prisma.community.create({
        data: {
          id: slug,
          title: input.title,
          description: input.description,
          category: input.category,
          tag: 'new',
          thumbnail: DEFAULT_THUMBNAIL,
          instructorName: owner.name,
          instructorRole: 'Chủ cộng đồng',
          ownerId: userId,
          moderationStatus: 'draft',
          draftSteps: ['basics'],
        },
      });
      return draftView(row);
    } catch (e) {
      if (isP2002(e)) throw HttpError.coded(409, 'SLUG_TAKEN', SLUG_MESSAGES.taken); // có người lấy mất giữa lúc kiểm tra và ghi
      throw e;
    }
  },

  async listDrafts(userId: string) {
    const rows = await prisma.community.findMany({ where: { ownerId: userId, moderationStatus: 'draft', deletedAt: null }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], take: 50 });
    return Promise.all(rows.map(draftView));
  },

  async getDraft(userId: string, id: string) {
    return draftView(await loadDraft(userId, id));
  },

  async deleteDraft(userId: string, id: string) {
    const row = await loadDraft(userId, id);
    // Xóa cứng: nháp chưa có thành viên/bài viết; HostingPlan/PayoutAccount xóa theo (cascade).
    await prisma.community.deleteMany({ where: { id: row.id, ownerId: userId, moderationStatus: 'draft' } });
    return { deleted: true as const };
  },

  async patchStep(userId: string, id: string, step: WizardStep, body: unknown) {
    const row = await loadDraft(userId, id);
    const mark = (data: Prisma.CommunityUncheckedUpdateInput): Prisma.CommunityUncheckedUpdateInput => ({
      ...data,
      draftSteps: row.draftSteps.includes(step) ? undefined : { set: [...row.draftSteps, step] },
    });

    if (step === 'plan') {
      await selectHostingPlan(userId, id, body as PlanBody);
      await prisma.community.update({ where: { id }, data: mark({}) });
      return draftView(await loadDraft(userId, id));
    }

    if (step === 'basics') {
      const b = body as { title?: string; slug?: string; description?: string; category?: DraftRow['category'] };
      const data: Prisma.CommunityUncheckedUpdateInput = {};
      if (b.title !== undefined) data.title = b.title;
      if (b.description !== undefined) data.description = b.description;
      if (b.category !== undefined) data.category = b.category;
      let newId = id;
      if (b.slug !== undefined && b.slug !== id) {
        await wizardService.assertSlug(b.slug, userId);
        newId = b.slug;
        data.id = newId; // slug = id: đổi khóa chính (FK HostingPlan/PayoutAccount cascade theo)
      }
      try {
        const updated = await prisma.community.update({ where: { id }, data: mark(data) });
        return draftView(updated);
      } catch (e) {
        if (isP2002(e)) throw HttpError.coded(409, 'SLUG_TAKEN', SLUG_MESSAGES.taken);
        throw e;
      }
    }

    if (step === 'identity') {
      const b = body as IdentityBody;
      const data: Prisma.CommunityUncheckedUpdateInput = {};
      if (b.logoUrl !== undefined) {
        if (b.logoUrl) await assertOwnUpload(userId, b.logoUrl, 'avatar', 'Logo');
        data.logoUrl = b.logoUrl;
      }
      if (b.coverUrl !== undefined) {
        if (b.coverUrl) await assertOwnUpload(userId, b.coverUrl, 'cover', 'Ảnh bìa');
        data.coverUrl = b.coverUrl;
        data.thumbnail = b.coverUrl ?? DEFAULT_THUMBNAIL; // thẻ cộng đồng dùng ảnh bìa
      }
      if (b.brandColor !== undefined) data.brandColor = b.brandColor ? b.brandColor.toLowerCase() : null;
      if (b.promise !== undefined) data.promise = b.promise ? b.promise : null;
      if (b.benefits !== undefined) data.benefits = b.benefits.filter((x) => x.trim());
      if (b.introVideoUrl !== undefined) data.introVideoUrl = b.introVideoUrl ? toEmbedUrl(b.introVideoUrl) : null;
      return draftView(await prisma.community.update({ where: { id }, data: mark(data) }));
    }

    // members
    const b = body as MembersBody;
    const data: Prisma.CommunityUncheckedUpdateInput = {};
    const monthly = b.priceUsd ?? centsToUsd(row.priceCents);
    let annual = b.priceAnnualUsd !== undefined ? b.priceAnnualUsd : row.priceAnnualCents == null ? null : centsToUsd(row.priceAnnualCents);
    if (monthly <= 0 && b.priceAnnualUsd == null) annual = null; // chuyển về miễn phí: bỏ giá năm cũ thay vì báo lỗi
    const err = priceError(monthly, annual);
    if (err) throw HttpError.coded(400, 'VALIDATION_ERROR', err, { fieldErrors: { priceAnnualUsd: [err] } });
    if (b.priceUsd !== undefined) {
      data.priceCents = usdToCents(b.priceUsd);
      data.pricing = b.priceUsd > 0 ? 'paid' : 'free';
    }
    data.priceAnnualCents = annual == null ? null : usdToCents(annual);
    if (b.visibility !== undefined) data.visibility = b.visibility;
    if (b.memberTrialEnabled !== undefined) data.memberTrialEnabled = b.memberTrialEnabled;
    if (b.joinQuestions !== undefined) data.joinQuestions = b.joinQuestions.filter((q) => q.trim());
    if (b.rules !== undefined) data.rules = b.rules as unknown as Prisma.InputJsonValue;
    if (b.requireRulesAgreement !== undefined) data.requireRulesAgreement = b.requireRulesAgreement;
    if (b.autoApprovePaid !== undefined) data.autoApprovePaid = b.autoApprovePaid;
    return draftView(await prisma.community.update({ where: { id }, data: mark(data) }));
  },

  // ------------------------------------------------------------------ publish
  async publish(userId: string, id: string, acceptTerms: boolean) {
    const row = await loadDraft(userId, id);
    if (!acceptTerms) throw HttpError.coded(400, 'TERMS_NOT_ACCEPTED', 'Vui lòng đồng ý Điều khoản dành cho chủ cộng đồng để ra mắt');
    await assertUserCan(userId, 'create_community');
    const plan = await getHostingPlanView(id);
    if (cfg().owner.requirePlan && !plan) throw HttpError.coded(400, 'PLAN_REQUIRED', 'Hãy chọn gói và bắt đầu dùng thử trước khi ra mắt');
    const missing = missingFor(row, !!plan).filter((m) => m.field !== 'plan');
    if (missing.length) throw HttpError.coded(400, 'DRAFT_INCOMPLETE', 'Bản nháp chưa đủ thông tin để ra mắt', { missing });

    const defaultCourseId = await prisma.$transaction(async (tx) => {
      // draft -> active chỉ một lần (2 lần publish song song: bên thua nhận 409).
      const done = await tx.community.updateMany({
        where: { id, ownerId: userId, moderationStatus: 'draft', deletedAt: null },
        data: { moderationStatus: 'active', createdAt: new Date(), thumbnail: row.coverUrl ?? row.thumbnail },
      });
      if (done.count !== 1) throw HttpError.coded(409, 'NOT_A_DRAFT', 'Cộng đồng này đã được tạo');
      await tx.enrollment.create({ data: { userId, communityId: id, role: 'owner' } });
      const course = await tx.course.create({ data: { id: randomUUID(), communityId: id, title: row.title, description: row.description, position: 1, publishStatus: 'published' } });
      // Chưa từng chọn bước payout ⇒ coi là "bỏ qua" để chặn rút tiền tới khi kết nối (publish vẫn được).
      await tx.payoutAccount.upsert({ where: { communityId: id }, create: { communityId: id, ownerId: userId, status: 'skipped' }, update: {} });
      return course.id;
    });
    return { ...(await catalogService.getDetailById(id, true)), defaultCourseId };
  },

  // ------------------------------------------------------------------ bước 5: danh sách ra mắt + điều kiện Khám phá
  async launchChecklist(userId: string, id: string, now = new Date()) {
    const row = await requireOwnerOf(userId, id);
    if (row.moderationStatus === 'draft') throw HttpError.coded(409, 'NOT_PUBLISHED', 'Cộng đồng chưa được ra mắt');
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const [lessons, welcomePost, recentPost, members, payout] = await Promise.all([
      prisma.classroomLesson.count({ where: { communityId: id, removedAt: null, hidden: false } }),
      prisma.post.count({ where: { communityId: id, removedAt: null, hidden: false, OR: [{ pinned: true }, { category: 'announcement' }] } }),
      prisma.post.count({ where: { communityId: id, removedAt: null, hidden: false, createdAt: { gte: weekAgo } } }),
      prisma.enrollment.count({ where: { communityId: id, user: { isDemo: false } } }),
      prisma.payoutAccount.findUnique({ where: { communityId: id }, select: { status: true } }),
    ]);
    const hasIdentity = !!(row.logoUrl || row.coverUrl) && !!row.promise;
    const items = [
      { key: 'created', done: true },
      { key: 'identity', done: hasIdentity },
      { key: 'payout', done: payout?.status === 'connected' },
      { key: 'first_lesson', done: lessons > 0 },
      { key: 'welcome_post', done: welcomePost > 0 },
      { key: 'invite_members', done: members >= MIN_MEMBERS_FOR_DISCOVERY, current: members, required: MIN_MEMBERS_FOR_DISCOVERY },
    ];
    const conditions = [
      { key: 'has_description_and_promise', met: !!row.description.trim() && !!row.promise },
      { key: 'has_cover', met: !!row.coverUrl },
      { key: 'min_members', met: members >= MIN_MEMBERS_FOR_DISCOVERY, current: members, required: MIN_MEMBERS_FOR_DISCOVERY },
      { key: 'recent_post', met: recentPost > 0 },
    ];
    return {
      slug: row.id,
      doneCount: items.filter((i) => i.done).length,
      total: items.length,
      items,
      discovery: { eligible: conditions.every((c) => c.met), conditions, note: 'Chỉ để hiển thị: cộng đồng đã ra mắt vẫn lên Khám phá theo luồng hiện hành.' },
    };
  },

  // ------------------------------------------------------------------ ước tính doanh thu
  revenueEstimate(priceUsd: number, interval: 'monthly' | 'annual', members: number) {
    const priceCents = usdToCents(priceUsd);
    const per = estimateNet(priceCents);
    const p = cfg().payments;
    return {
      interval,
      priceUsd,
      members,
      grossCents: priceCents * members,
      platformFeeCents: per.platformFeeCents * members,
      gatewayFeeCents: per.gatewayFeeCents * members,
      netCents: per.netCents * members,
      netPerMemberCents: per.netCents,
      commissionPct: p.commissionPct,
      gatewayFeePct: p.gatewayFeePct,
      gatewayFeeFixedCents: p.gatewayFeeFixedCents,
      note: 'Ước tính theo phí nền tảng + phí cổng thanh toán hiện hành (Global Settings); chưa gồm hoàn tiền/thuế.',
    };
  },

  rulesTemplate: () => ({ rules: RULES_TEMPLATE }),
  ownerPlans: ownerPlanCatalogue,
  hostingPlan: { read: readHostingPlan, select: selectHostingPlan },
  payout: { read: readPayoutAccount, connect: connectPayoutAccount, skip: skipPayoutAccount },
};
