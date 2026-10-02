import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../../utils/http-error.js';
import { CATEGORY_IDS } from '../catalog/community.types.js';
import { DEFAULT_WEIGHTS, WEIGHT_KEYS, getPublishedWeights, loadSignals, savePublishedWeights, scoreOf, type CommunitySignals, type RankingWeights } from '../discovery/ranking.js';
import { FEATURE_SECTIONS, SECTION_LABELS, activeWindow, publiclyListable, type FeatureSection } from '../discovery/featured.js';
import { notify } from '../notifications/notifications.service.js';
import { auditService } from './admin-audit.service.js';
import { nameMap, person, personSelect } from './admin-b2.common.js';
import { enumList, iso, noteField, pageMeta, pageQuery } from './admin.common.js';

/** Admin đợt 2 — Discovery. Contract: docs/api/admin-batch2.md (mục C). */

const tell = (userId: string | null | undefined, title: string, body: string, communityId?: string) => {
  if (userId) notify({ userId, type: 'system', title, body, ...(communityId ? { communityId } : {}) });
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* -------------------------------------------------------------------------------- schemas */
type Eff = 'listed' | 'featured' | 'hidden' | 'unlisted';
const EFF: readonly Eff[] = ['listed', 'featured', 'hidden', 'unlisted'];
export const listedQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  status: z.string().optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  sort: z.enum(['members', 'growth', 'engagement', 'rating', 'newest', 'name']).default('members'),
});
export const setStatusBody = z.object({ status: z.enum(['listed', 'hidden', 'unlisted']), reason: z.string().trim().max(500).optional() });
const dateField = z.string().datetime({ offset: true });
export const featureBody = z.object({ section: z.enum(FEATURE_SECTIONS).default('featured'), startsAt: dateField.nullable().optional(), endsAt: dateField.nullable().optional() });
export const unfeatureBody = z.object({ section: z.enum(FEATURE_SECTIONS).optional() });
export const addFeaturedBody = z.object({ section: z.enum(FEATURE_SECTIONS), communityId: z.string().min(1).max(100), startsAt: dateField.nullable().optional(), endsAt: dateField.nullable().optional() });
export const patchFeaturedBody = z.object({ startsAt: dateField.nullable().optional(), endsAt: dateField.nullable().optional() });
export const reorderFeaturedBody = z.object({ entryIds: z.array(z.string().min(1)).max(100) });
export const createCategoryBody = z.object({ key: z.enum(CATEGORY_IDS), name: z.string().trim().min(1).max(60), description: z.string().trim().max(300).optional() });
export const patchCategoryBody = z
  .object({ name: z.string().trim().min(1).max(60).optional(), description: z.string().trim().max(300).nullable().optional(), status: z.enum(['active', 'disabled']).optional() })
  .refine((b) => Object.keys(b).length > 0, { message: 'Không có gì để cập nhật' });
export const reorderCategoriesBody = z.object({ keys: z.array(z.enum(CATEGORY_IDS)).min(1) });
export const moveCategoryBody = z.object({ direction: z.enum(['up', 'down']) });
const weight = z.number().min(0).max(100);
export const weightsBody = z.object({ weights: z.object(Object.fromEntries(WEIGHT_KEYS.map((k) => [k, weight])) as Record<(typeof WEIGHT_KEYS)[number], typeof weight>) });
export const publishWeightsBody = weightsBody.extend({ note: noteField });
export const searchListQuery = pageQuery.extend({
  q: z.string().trim().max(100).optional(),
  searchStatus: z.string().optional(),
  discoveryStatus: z.string().optional(),
  sort: z.enum(['quality', 'violations', 'name']).default('quality'),
});
export const searchVisibilityBody = z.object({ visibility: z.enum(['searchable', 'reduced', 'hidden']), reason: z.string().trim().max(500).optional() });

/* -------------------------------------------------------------------------------- dữ liệu cộng đồng */
const courseSelect = {
  id: true, title: true, description: true, thumbnail: true, category: true, rating: true, ratingCount: true, visibility: true, moderationStatus: true,
  locked: true, deletedAt: true, discoveryStatus: true, searchVisibility: true, discoveryReason: true, createdAt: true,
  owner: { select: personSelect },
} satisfies Prisma.CommunitySelect;
type CourseRow = Prisma.CommunityGetPayload<{ select: typeof courseSelect }>;

/** Trạng thái hiển thị Discovery (xem docs): không `active`/đã khóa/xóa => unlisted; private => hidden; còn lại theo cột + featured. */
export function effectiveDiscovery(c: Pick<CourseRow, 'deletedAt' | 'moderationStatus' | 'locked' | 'visibility' | 'discoveryStatus'>, featured: boolean): Eff {
  if (c.deletedAt || c.moderationStatus !== 'active' || c.locked) return 'unlisted';
  if (c.visibility === 'private') return 'hidden';
  return c.discoveryStatus === 'listed' ? (featured ? 'featured' : 'listed') : c.discoveryStatus;
}

async function categoryNames(): Promise<Map<string, string>> {
  const rows = await prisma.discoveryCategory.findMany();
  return new Map(rows.map((r) => [r.key, r.name]));
}

/** Mục ghim đang hiệu lực -> communityId -> các section. */
async function activeSections(): Promise<Map<string, FeatureSection[]>> {
  const rows = await prisma.discoveryFeature.findMany({ where: activeWindow(), select: { communityId: true, section: true } });
  const m = new Map<string, FeatureSection[]>();
  for (const r of rows) m.set(r.communityId, [...(m.get(r.communityId) ?? []), r.section as FeatureSection]);
  return m;
}

async function loadCourses(where: Prisma.CommunityWhereInput = {}) {
  return prisma.community.findMany({ where: { deletedAt: null, AND: [{ moderationStatus: { not: 'draft' } }], ...where }, select: courseSelect });
}

const ZERO: CommunitySignals = { members: 0, new30d: 0, active30d: 0, growthPct: 0, engagementPct: 0, retentionPct: 0, rating: 0, ratingCount: 0, mrrCents: 0, reports30d: 0, violations: 0, posts30d: 0 };

function quality(c: CourseRow, s: CommunitySignals): number {
  const q = 40 * (c.rating / 5) + 25 * (s.engagementPct / 100) + (c.description.length >= 80 ? 15 : 0) + (c.thumbnail ? 10 : 0) + (s.posts30d > 0 ? 10 : 0) - 8 * s.violations;
  return Math.round(clamp(q, 0, 100));
}

function listedItem(c: CourseRow, s: CommunitySignals, sections: FeatureSection[], names: Map<string, string>) {
  const featured = sections.includes('featured');
  return {
    id: c.id,
    name: c.title,
    slug: c.id,
    thumbnail: c.thumbnail,
    category: c.category,
    categoryLabel: names.get(c.category) ?? c.category,
    owner: person(c.owner),
    members: s.members,
    growthPct: s.growthPct,
    engagementPct: s.engagementPct,
    rating: c.rating,
    ratingCount: c.ratingCount,
    discoveryStatus: effectiveDiscovery(c, featured),
    listedStatus: c.discoveryStatus,
    searchVisibility: c.searchVisibility,
    featuredSections: sections,
    visibility: c.visibility,
    moderationStatus: c.moderationStatus,
    discoveryReason: c.discoveryReason,
    createdAt: c.createdAt.toISOString(),
  };
}

function searchItem(c: CourseRow, s: CommunitySignals, sections: FeatureSection[]) {
  return {
    id: c.id, name: c.title, thumbnail: c.thumbnail, category: c.category, searchVisibility: c.searchVisibility,
    discoveryStatus: effectiveDiscovery(c, sections.includes('featured')), qualityScore: quality(c, s), violations: s.violations, members: s.members,
  };
}

async function itemFor(id: string) {
  const [c] = await loadCourses({ id });
  if (!c) throw HttpError.notFound('Không tìm thấy cộng đồng');
  const [sig, sec, names] = await Promise.all([loadSignals([id]), activeSections(), categoryNames()]);
  return listedItem(c, sig.get(id) ?? ZERO, sec.get(id) ?? [], names);
}

const orderedEntries = (section: string) => prisma.discoveryFeature.findMany({ where: { section }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });

async function repack(section: string) {
  const rows = await orderedEntries(section);
  for (let i = 0; i < rows.length; i++) if (rows[i]!.position !== i + 1) await prisma.discoveryFeature.update({ where: { id: rows[i]!.id }, data: { position: i + 1 } });
}

function checkWindow(startsAt?: string | null, endsAt?: string | null) {
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) throw HttpError.badRequest('`startsAt` phải trước `endsAt`');
}

/* ================================================================================ service */
export const adminDiscoveryService = {
  /* ---------------------------------------------------------------- listed communities */
  async listedSummary() {
    const [courses, sec] = await Promise.all([loadCourses(), activeSections()]);
    const out = { total: courses.length, listed: 0, featured: 0, hidden: 0, unlisted: 0 };
    for (const c of courses) out[effectiveDiscovery(c, (sec.get(c.id) ?? []).includes('featured'))]++;
    return out;
  },

  async listListed(q: z.infer<typeof listedQuery>) {
    const statuses = enumList(q.status, EFF, 'status');
    const where: Prisma.CommunityWhereInput = {
      ...(q.category ? { category: q.category } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { id: { contains: q.q, mode: 'insensitive' } }, { owner: { OR: [{ firstName: { contains: q.q, mode: 'insensitive' } }, { lastName: { contains: q.q, mode: 'insensitive' } }] } }] } : {}),
    };
    const [courses, sec, names] = await Promise.all([loadCourses(where), activeSections(), categoryNames()]);
    let rows = courses.filter((c) => !statuses.length || statuses.includes(effectiveDiscovery(c, (sec.get(c.id) ?? []).includes('featured'))));
    const signals = await loadSignals(rows.map((r) => r.id));
    const sig = (id: string) => signals.get(id) ?? ZERO;
    rows = [...rows].sort((a, b) => {
      switch (q.sort) {
        case 'growth': return sig(b.id).growthPct - sig(a.id).growthPct;
        case 'engagement': return sig(b.id).engagementPct - sig(a.id).engagementPct;
        case 'rating': return b.rating - a.rating || b.ratingCount - a.ratingCount;
        case 'newest': return b.createdAt.getTime() - a.createdAt.getTime();
        case 'name': return a.title.localeCompare(b.title);
        default: return sig(b.id).members - sig(a.id).members || a.title.localeCompare(b.title);
      }
    });
    const page = rows.slice((q.page - 1) * q.limit, q.page * q.limit);
    return { data: page.map((c) => listedItem(c, sig(c.id), sec.get(c.id) ?? [], names)), meta: pageMeta(q.page, q.limit, rows.length) };
  },

  async setStatus(adminId: string, id: string, body: z.infer<typeof setStatusBody>) {
    const c = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, discoveryStatus: true, ownerId: true } });
    if (!c) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (c.discoveryStatus === body.status) throw HttpError.conflict(`Cộng đồng đã ở trạng thái ${body.status}`);
    await prisma.community.update({
      where: { id },
      data: { discoveryStatus: body.status, discoveryReason: body.status === 'listed' ? null : body.reason ?? null, discoveryUpdatedAt: new Date(), discoveryUpdatedById: adminId },
    });
    await auditService.record(adminId, {
      action: 'discovery.status', targetType: 'community', targetId: id, targetLabel: c.title, reason: body.reason, metadata: { from: c.discoveryStatus, to: body.status },
    });
    if (body.status !== 'listed') {
      tell(c.ownerId, 'Cộng đồng đã bị gỡ khỏi Discovery', `"${c.title}" không còn hiển thị ở Khám phá${body.reason ? ` (${body.reason})` : ''}.`, id);
    }
    return itemFor(id);
  },

  async feature(adminId: string, id: string, body: z.infer<typeof featureBody>) {
    await this.addFeatured(adminId, { section: body.section, communityId: id, startsAt: body.startsAt, endsAt: body.endsAt });
    return itemFor(id);
  },

  async unfeature(adminId: string, id: string, body: z.infer<typeof unfeatureBody>) {
    const c = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true } });
    if (!c) throw HttpError.notFound('Không tìm thấy cộng đồng');
    const entries = await prisma.discoveryFeature.findMany({ where: { communityId: id, ...(body.section ? { section: body.section } : {}) } });
    if (!entries.length) throw HttpError.conflict('Cộng đồng này không nằm trong mục ghim nào');
    await prisma.discoveryFeature.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
    for (const s of new Set(entries.map((e) => e.section))) await repack(s);
    await auditService.record(adminId, { action: 'discovery.unfeature', targetType: 'community', targetId: id, targetLabel: c.title, metadata: { sections: entries.map((e) => e.section) } });
    return itemFor(id);
  },

  /* ---------------------------------------------------------------- categories */
  async listCategories() {
    const [rows, groups] = await Promise.all([
      prisma.discoveryCategory.findMany({ orderBy: [{ position: 'asc' }, { key: 'asc' }] }),
      prisma.community.groupBy({ by: ['category'], where: publiclyListable, _count: { _all: true } }),
    ]);
    const cnt = new Map(groups.map((g) => [g.category as string, g._count._all]));
    return rows.map((r) => ({
      key: r.key, slug: r.key, name: r.name, description: r.description, status: r.status, position: r.position, communities: cnt.get(r.key) ?? 0, createdAt: r.createdAt.toISOString(),
    }));
  },

  async createCategory(adminId: string, body: z.infer<typeof createCategoryBody>) {
    if (await prisma.discoveryCategory.findUnique({ where: { key: body.key } })) throw HttpError.conflict('Danh mục này đã tồn tại');
    const max = await prisma.discoveryCategory.aggregate({ _max: { position: true } });
    await prisma.discoveryCategory.create({ data: { key: body.key, name: body.name, description: body.description ?? null, position: (max._max.position ?? 0) + 1 } });
    await auditService.record(adminId, { action: 'category.create', targetType: 'category', targetId: body.key, targetLabel: body.name });
    return (await this.listCategories()).find((c) => c.key === body.key)!;
  },

  async patchCategory(adminId: string, key: string, body: z.infer<typeof patchCategoryBody>) {
    if (!(CATEGORY_IDS as readonly string[]).includes(key)) throw HttpError.notFound('Không tìm thấy danh mục');
    const cur = await prisma.discoveryCategory.findUnique({ where: { key: key as never } });
    if (!cur) throw HttpError.notFound('Không tìm thấy danh mục');
    await prisma.discoveryCategory.update({
      where: { key: key as never },
      data: { ...(body.name !== undefined ? { name: body.name } : {}), ...(body.description !== undefined ? { description: body.description } : {}), ...(body.status !== undefined ? { status: body.status } : {}) },
    });
    const action = body.status && body.status !== cur.status ? (body.status === 'disabled' ? 'category.disable' : 'category.enable') : 'category.update';
    await auditService.record(adminId, { action, targetType: 'category', targetId: key, targetLabel: body.name ?? cur.name, metadata: { changes: body } });
    return (await this.listCategories()).find((c) => c.key === key)!;
  },

  async reorderCategories(adminId: string, keys: string[]) {
    const rows = await prisma.discoveryCategory.findMany();
    const have = new Set(rows.map((r) => r.key as string));
    if (keys.length !== have.size || new Set(keys).size !== keys.length || keys.some((k) => !have.has(k))) throw HttpError.badRequest('`keys` phải là hoán vị đủ của các danh mục hiện có');
    await prisma.$transaction(keys.map((k, i) => prisma.discoveryCategory.update({ where: { key: k as never }, data: { position: i + 1 } })));
    await auditService.record(adminId, { action: 'category.reorder', targetType: 'category', targetId: 'all', targetLabel: 'Categories', metadata: { keys } });
    return this.listCategories();
  },

  async moveCategory(adminId: string, key: string, direction: 'up' | 'down') {
    const list = await this.listCategories();
    const i = list.findIndex((c) => c.key === key);
    if (i < 0) throw HttpError.notFound('Không tìm thấy danh mục');
    const j = direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= list.length) throw HttpError.conflict(direction === 'up' ? 'Danh mục đã ở đầu danh sách' : 'Danh mục đã ở cuối danh sách');
    const keys = list.map((c) => c.key);
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    return this.reorderCategories(adminId, keys);
  },

  /* ---------------------------------------------------------------- featured */
  async listFeatured() {
    const entries = await prisma.discoveryFeature.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], include: { community: { select: { id: true, title: true, thumbnail: true, category: true } } } });
    const [signals, names] = await Promise.all([loadSignals([...new Set(entries.map((e) => e.communityId))]), categoryNames()]);
    const now = Date.now();
    return {
      sections: FEATURE_SECTIONS.map((key) => ({
        key,
        label: SECTION_LABELS[key],
        items: entries.filter((e) => e.section === key).map((e) => ({
          id: e.id,
          position: e.position,
          startsAt: iso(e.startsAt),
          endsAt: iso(e.endsAt),
          active: (!e.startsAt || e.startsAt.getTime() <= now) && (!e.endsAt || e.endsAt.getTime() >= now),
          community: { id: e.community.id, name: e.community.title, thumbnail: e.community.thumbnail, category: e.community.category, categoryLabel: names.get(e.community.category) ?? e.community.category, members: signals.get(e.communityId)?.members ?? 0 },
        })),
      })),
    };
  },

  async addFeatured(adminId: string, body: z.infer<typeof addFeaturedBody>) {
    checkWindow(body.startsAt, body.endsAt);
    const c = await prisma.community.findFirst({ where: { id: body.communityId, deletedAt: null }, select: { id: true, title: true, visibility: true, moderationStatus: true, locked: true, discoveryStatus: true } });
    if (!c) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (c.moderationStatus !== 'active' || c.locked || c.visibility !== 'public' || c.discoveryStatus !== 'listed') {
      throw HttpError.badRequest('Chỉ ghim được cộng đồng đang hoạt động, công khai và ở trạng thái listed');
    }
    if (await prisma.discoveryFeature.findUnique({ where: { section_communityId: { section: body.section, communityId: body.communityId } } })) throw HttpError.conflict('Cộng đồng đã có trong mục này');
    const max = await prisma.discoveryFeature.aggregate({ where: { section: body.section }, _max: { position: true } });
    const e = await prisma.discoveryFeature.create({
      data: { section: body.section, communityId: body.communityId, position: (max._max.position ?? 0) + 1, startsAt: body.startsAt ? new Date(body.startsAt) : null, endsAt: body.endsAt ? new Date(body.endsAt) : null, createdById: adminId },
    });
    await auditService.record(adminId, { action: 'discovery.feature', targetType: 'community', targetId: c.id, targetLabel: c.title, metadata: { section: body.section, entryId: e.id, startsAt: body.startsAt ?? null, endsAt: body.endsAt ?? null } });
    return e;
  },

  async patchFeatured(adminId: string, entryId: string, body: z.infer<typeof patchFeaturedBody>) {
    const e = await prisma.discoveryFeature.findUnique({ where: { id: entryId }, include: { community: { select: { title: true } } } });
    if (!e) throw HttpError.notFound('Không tìm thấy mục ghim');
    const startsAt = body.startsAt === undefined ? e.startsAt : body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt === undefined ? e.endsAt : body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && endsAt && startsAt >= endsAt) throw HttpError.badRequest('`startsAt` phải trước `endsAt`');
    await prisma.discoveryFeature.update({ where: { id: entryId }, data: { startsAt, endsAt } });
    await auditService.record(adminId, { action: 'discovery.feature_update', targetType: 'community', targetId: e.communityId, targetLabel: e.community.title, metadata: { section: e.section, startsAt: iso(startsAt), endsAt: iso(endsAt) } });
    return (await this.listFeatured()).sections.flatMap((s) => s.items).find((i) => i.id === entryId)!;
  },

  async removeFeatured(adminId: string, entryId: string) {
    const e = await prisma.discoveryFeature.findUnique({ where: { id: entryId }, include: { community: { select: { title: true } } } });
    if (!e) throw HttpError.notFound('Không tìm thấy mục ghim');
    await prisma.discoveryFeature.delete({ where: { id: entryId } });
    await repack(e.section);
    await auditService.record(adminId, { action: 'discovery.unfeature', targetType: 'community', targetId: e.communityId, targetLabel: e.community.title, metadata: { section: e.section } });
    return { removed: true };
  },

  async reorderFeatured(adminId: string, section: FeatureSection, ids: string[]) {
    const rows = await orderedEntries(section);
    const have = new Set(rows.map((r) => r.id));
    if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((i) => !have.has(i))) throw HttpError.badRequest('`entryIds` phải là hoán vị đủ của các mục trong section');
    await prisma.$transaction(ids.map((id, i) => prisma.discoveryFeature.update({ where: { id }, data: { position: i + 1 } })));
    await auditService.record(adminId, { action: 'discovery.reorder', targetType: 'discovery', targetId: section, targetLabel: SECTION_LABELS[section], metadata: { entryIds: ids } });
    return (await this.listFeatured()).sections.find((s) => s.key === section)!;
  },

  /* ---------------------------------------------------------------- rankings */
  async rankingPreview(weights: RankingWeights) {
    const courses = await loadCourses(publiclyListable);
    const [signals, names] = await Promise.all([loadSignals(courses.map((c) => c.id)), categoryNames()]);
    const rows = courses.map((c) => {
      const r = scoreOf(signals.get(c.id) ?? ZERO, weights);
      return { id: c.id, name: c.title, thumbnail: c.thumbnail, category: c.category, categoryLabel: names.get(c.category) ?? c.category, score: r.score, signals: r.signals };
    });
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  },

  async getRankings() {
    const pub = await getPublishedWeights();
    const by = pub.updatedById ? (await nameMap([pub.updatedById])).get(pub.updatedById) ?? null : null;
    return { weights: pub.weights, defaults: DEFAULT_WEIGHTS, updatedAt: iso(pub.updatedAt), updatedBy: by, preview: await this.rankingPreview(pub.weights) };
  },

  async previewRankings(weights: RankingWeights) {
    return { weights, preview: await this.rankingPreview(weights) };
  },

  async publishRankings(adminId: string, weights: RankingWeights, note?: string, reset = false) {
    const before = (await getPublishedWeights()).weights;
    await savePublishedWeights(weights, adminId);
    await auditService.record(adminId, { action: reset ? 'discovery.ranking_reset' : 'discovery.ranking_publish', targetType: 'discovery', targetId: 'rankings', targetLabel: 'Ranking weights', note, metadata: { before, weights } });
    return this.getRankings();
  },

  /* ---------------------------------------------------------------- search visibility */
  async searchSummary() {
    const g = await prisma.community.groupBy({ by: ['searchVisibility'], where: { deletedAt: null }, _count: { _all: true } });
    const n = (s: string) => g.find((x) => x.searchVisibility === s)?._count._all ?? 0;
    return { total: g.reduce((a, x) => a + x._count._all, 0), searchable: n('searchable'), reduced: n('reduced'), hidden: n('hidden') };
  },

  async listSearch(q: z.infer<typeof searchListQuery>) {
    const sv = enumList(q.searchStatus, ['searchable', 'reduced', 'hidden'] as const, 'searchStatus');
    const ds = enumList(q.discoveryStatus, EFF, 'discoveryStatus');
    const where: Prisma.CommunityWhereInput = {
      ...(sv.length ? { searchVisibility: { in: sv } } : {}),
      ...(q.q ? { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { id: { contains: q.q, mode: 'insensitive' } }] } : {}),
    };
    const [courses, sec] = await Promise.all([loadCourses(where), activeSections()]);
    const rows = courses.filter((c) => !ds.length || ds.includes(effectiveDiscovery(c, (sec.get(c.id) ?? []).includes('featured'))));
    const signals = await loadSignals(rows.map((r) => r.id));
    const items = rows.map((c) => searchItem(c, signals.get(c.id) ?? ZERO, sec.get(c.id) ?? []));
    items.sort((a, b) => (q.sort === 'name' ? a.name.localeCompare(b.name) : q.sort === 'violations' ? b.violations - a.violations || a.qualityScore - b.qualityScore : b.qualityScore - a.qualityScore || a.name.localeCompare(b.name)));
    return { data: items.slice((q.page - 1) * q.limit, q.page * q.limit), meta: pageMeta(q.page, q.limit, items.length) };
  },

  async setSearchVisibility(adminId: string, id: string, body: z.infer<typeof searchVisibilityBody>) {
    const c = await prisma.community.findFirst({ where: { id, deletedAt: null }, select: { id: true, title: true, searchVisibility: true } });
    if (!c) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (c.searchVisibility === body.visibility) throw HttpError.conflict(`Cộng đồng đã ở trạng thái ${body.visibility}`);
    await prisma.community.update({ where: { id }, data: { searchVisibility: body.visibility, discoveryUpdatedAt: new Date(), discoveryUpdatedById: adminId } });
    await auditService.record(adminId, {
      action: 'discovery.search_visibility', targetType: 'community', targetId: id, targetLabel: c.title, reason: body.reason, metadata: { from: c.searchVisibility, to: body.visibility },
    });
    const [row] = await loadCourses({ id });
    const [sig, sec] = await Promise.all([loadSignals([id]), activeSections()]);
    return searchItem(row!, sig.get(id) ?? ZERO, sec.get(id) ?? []);
  },
};
