import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

/**
 * Xếp hạng cộng đồng cho Discovery (Admin đợt 2). Dùng chung giữa trang admin (preview/publish) và danh sách công khai (`sort=ranked`),
 * nên nằm ngoài modules/admin để courses.repository không phụ thuộc ngược vào admin.
 */
export const WEIGHT_KEYS = ['memberGrowth', 'engagement', 'retention', 'rating', 'revenue', 'reportPenalty'] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type RankingWeights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: RankingWeights = { memberGrowth: 25, engagement: 25, retention: 20, rating: 15, revenue: 10, reportPenalty: 5 };
const SETTING_KEY = 'discovery.rankingWeights';
const DAY = 86_400_000;
/** MRR tương ứng 100 điểm tín hiệu "revenue" (45.000 cent = $450, như mockup). */
const REVENUE_FULL_CENTS = 45_000;

export interface CommunitySignals {
  members: number;
  new30d: number;
  active30d: number;
  growthPct: number;
  engagementPct: number;
  retentionPct: number;
  rating: number;
  ratingCount: number;
  mrrCents: number;
  reports30d: number;
  violations: number;
  posts30d: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Số liệu thật của các cộng đồng (1 vòng truy vấn gộp, không N+1). */
export async function loadSignals(ids: string[]): Promise<Map<string, CommunitySignals>> {
  const out = new Map<string, CommunitySignals>();
  if (ids.length === 0) return out;
  const d30 = new Date(Date.now() - 30 * DAY);
  const d14 = new Date(Date.now() - 14 * DAY);
  const [mem, mrr, rep, vio, posts, courses] = await Promise.all([
    prisma.$queryRaw<{ id: string; members: number; new30: number; active30: number; old14: number; retained: number }[]>(Prisma.sql`
      SELECT e."courseId" AS id, COUNT(*)::int AS members,
        COUNT(*) FILTER (WHERE e."enrolledAt" >= ${d30})::int AS new30,
        COUNT(*) FILTER (WHERE e."lastActiveAt" >= ${d30})::int AS active30,
        COUNT(*) FILTER (WHERE e."enrolledAt" <= ${d14})::int AS old14,
        COUNT(*) FILTER (WHERE e."enrolledAt" <= ${d14} AND e."lastActiveAt" >= ${d30})::int AS retained
      FROM "Enrollment" e
      WHERE e."courseId" = ANY(${ids}::text[])
        AND NOT EXISTS (SELECT 1 FROM "CommunityBan" b WHERE b."courseId" = e."courseId" AND b."userId" = e."userId")
      GROUP BY e."courseId"`),
    prisma.$queryRaw<{ id: string; mrr: number }[]>(Prisma.sql`
      SELECT "courseId" AS id, COALESCE(SUM("priceCents"), 0)::int AS mrr FROM "Subscription"
      WHERE "courseId" = ANY(${ids}::text[]) AND "status" = 'active' GROUP BY "courseId"`),
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT "courseId" AS id, COUNT(*)::int AS n FROM "Report" WHERE "courseId" = ANY(${ids}::text[]) AND "createdAt" >= ${d30} GROUP BY "courseId"`),
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT "courseId" AS id, COUNT(*)::int AS n FROM "Report"
      WHERE "courseId" = ANY(${ids}::text[]) AND "status" = 'resolved' AND "action" IS NOT NULL AND "action" NOT IN ('none', 'dismiss') GROUP BY "courseId"`),
    prisma.$queryRaw<{ id: string; n: number }[]>(Prisma.sql`
      SELECT "courseId" AS id, COUNT(*)::int AS n FROM "Post" WHERE "courseId" = ANY(${ids}::text[]) AND "createdAt" >= ${d30} AND "removedAt" IS NULL GROUP BY "courseId"`),
    prisma.course.findMany({ where: { id: { in: ids } }, select: { id: true, rating: true, ratingCount: true } }),
  ]);
  const by = <T extends { id: string }>(rows: T[]) => new Map(rows.map((r) => [r.id, r]));
  const m = by(mem), mr = by(mrr), rp = by(rep), vi = by(vio), po = by(posts);
  for (const c of courses) {
    const x = m.get(c.id);
    const members = x?.members ?? 0;
    const new30d = x?.new30 ?? 0;
    const prior = Math.max(1, members - new30d);
    out.set(c.id, {
      members,
      new30d,
      active30d: x?.active30 ?? 0,
      growthPct: round1((new30d / prior) * 100),
      engagementPct: members ? Math.round(((x?.active30 ?? 0) / members) * 100) : 0,
      retentionPct: x && x.old14 ? Math.round((x.retained / x.old14) * 100) : 0,
      rating: c.rating,
      ratingCount: c.ratingCount,
      mrrCents: mr.get(c.id)?.mrr ?? 0,
      reports30d: rp.get(c.id)?.n ?? 0,
      violations: vi.get(c.id)?.n ?? 0,
      posts30d: po.get(c.id)?.n ?? 0,
    });
  }
  return out;
}

/** 5 tín hiệu chuẩn hóa 0–100 + hình phạt báo cáo (0–100). */
export function normalized(s: CommunitySignals): Record<WeightKey, number> {
  return {
    memberGrowth: Math.min(100, Math.round(s.growthPct)),
    engagement: s.engagementPct,
    retention: s.retentionPct,
    rating: Math.round((s.rating / 5) * 100),
    revenue: Math.min(100, Math.round((s.mrrCents / REVENUE_FULL_CENTS) * 100)),
    reportPenalty: Math.min(100, s.reports30d * 10),
  };
}

export function scoreOf(s: CommunitySignals, w: RankingWeights): { score: number; signals: Record<WeightKey, number> } {
  const n = normalized(s);
  const pos = n.memberGrowth * w.memberGrowth + n.engagement * w.engagement + n.retention * w.retention + n.rating * w.rating + n.revenue * w.revenue;
  return { score: round1(pos / 100 - (n.reportPenalty * w.reportPenalty) / 100), signals: n };
}

export function parseWeights(raw: unknown): RankingWeights {
  const out = { ...DEFAULT_WEIGHTS };
  if (raw && typeof raw === 'object') {
    for (const k of WEIGHT_KEYS) {
      const v = (raw as Record<string, unknown>)[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100) out[k] = v;
    }
  }
  return out;
}

export async function getPublishedWeights(): Promise<{ weights: RankingWeights; updatedAt: Date | null; updatedById: string | null }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  return { weights: parseWeights(row?.value), updatedAt: row?.updatedAt ?? null, updatedById: row?.updatedById ?? null };
}

export async function savePublishedWeights(weights: RankingWeights, adminId: string): Promise<void> {
  await prisma.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: weights as unknown as Prisma.InputJsonValue, updatedById: adminId },
    update: { value: weights as unknown as Prisma.InputJsonValue, updatedById: adminId },
  });
}

/** Điểm xếp hạng theo trọng số đã publish — dùng cho `GET /courses?sort=ranked`. */
export async function rankedScores(ids: string[]): Promise<Map<string, number>> {
  const [{ weights }, signals] = await Promise.all([getPublishedWeights(), loadSignals(ids)]);
  return new Map([...signals].map(([id, s]) => [id, scoreOf(s, weights).score]));
}
