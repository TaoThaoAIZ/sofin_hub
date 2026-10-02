import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import { cfg } from '../settings/settings.service.js';
import { DAY, pctRound, startOfUtcDay } from './admin-b2.common.js';

/** Admin đợt 3 — Analytics: tính trực tiếp từ bảng thật (không có bảng tổng hợp). Cách tính/xấp xỉ: docs/api/admin-batch3.md (cuối file). */
export const analyticsQuery = z.object({ range: z.enum(['7', '30', '90']).default('30').transform((v) => Number(v) as 7 | 30 | 90) });

const num = (v: unknown) => Number(v ?? 0);
const round1 = (n: number) => Math.round(n * 10) / 10;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const changePct = (value: number, previous: number | null) => (previous === null || previous === 0 ? null : round1(((value - previous) / previous) * 100));
export const kpi = (value: number, previous: number | null) => ({ value, previous, changePct: changePct(value, previous) });

interface Win {
  range: 7 | 30 | 90;
  from: Date;
  to: Date; // loại trừ
  prevFrom: Date;
}
function windowOf(range: 7 | 30 | 90): Win {
  const to = new Date(startOfUtcDay().getTime() + DAY);
  const from = new Date(to.getTime() - range * DAY);
  return { range, from, to, prevFrom: new Date(from.getTime() - range * DAY) };
}
const head = (w: Win) => ({ range: w.range, from: w.from.toISOString(), to: new Date(w.to.getTime() - 1).toISOString() });

/** Mọi sự kiện "có hoạt động" của user (uid, ts). Dùng cho DAU/WAU/MAU, retention, churn. */
const ACTIVITY = Prisma.sql`(
  SELECT "authorId" AS uid, "createdAt" AS ts FROM "Post"
  UNION ALL SELECT "authorId", "createdAt" FROM "PostComment"
  UNION ALL SELECT "userId", "createdAt" FROM "PostLike"
  UNION ALL SELECT "senderId", "createdAt" FROM "Message"
  UNION ALL SELECT "userId", COALESCE("completedAt", "firstCompletedAt") FROM "LessonProgress"
  UNION ALL SELECT "userId", "createdAt" FROM "EventRsvp"
  UNION ALL SELECT "userId", "createdAt" FROM "PointEvent"
  UNION ALL SELECT "userId", "createdAt" FROM "Payment"
  UNION ALL SELECT "userId", "createdAt" FROM "Session"
  UNION ALL SELECT "userId", "lastUsedAt" FROM "Session"
)`;

type DayRow = { d: string } & Record<string, number | string>;

/** Điền 0 cho ngày trống: nhận các dòng {d: 'YYYY-MM-DD', ...} và trả mảng đủ `range` ngày theo thứ tự tăng dần. */
function fillDays(w: Win, rows: DayRow[], keys: string[]): Array<Record<string, number | string>> {
  const by = new Map(rows.map((r) => [r.d, r]));
  const out: Array<Record<string, number | string>> = [];
  for (let t = w.from.getTime(); t < w.to.getTime(); t += DAY) {
    const date = dayKey(new Date(t));
    const r = by.get(date);
    const rec: Record<string, number | string> = { date };
    for (const k of keys) rec[k] = r ? num(r[k]) : 0;
    out.push(rec);
  }
  return out;
}
const DAYS = (w: Win) => Prisma.sql`generate_series(${w.from}::timestamptz, ${new Date(w.to.getTime() - DAY)}::timestamptz, interval '1 day')`;
const D = Prisma.sql`to_char(d.day AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;

const countUsers = (before: Date) => prisma.user.count({ where: { deletedAt: null, createdAt: { lt: before } } });
async function activeDistinct(a: Date, b: Date): Promise<number> {
  const r = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT count(DISTINCT uid) AS n FROM ${ACTIVITY} a WHERE ts >= ${a} AND ts < ${b}`;
  return num(r[0]?.n);
}
const withPct = <T extends { count: number }>(rows: T[]) => {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return rows.map((r) => ({ ...r, pct: pctRound(r.count, total) }));
};
const dayMap = (rows: Array<{ d: string; n: bigint }>) => new Map(rows.map((r) => [r.d, num(r.n)]));

export const adminAnalyticsService = {
  /* ------------------------------------------------------------------ users */
  async users(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const newIn = (a: Date, b: Date) => prisma.user.count({ where: { deletedAt: null, createdAt: { gte: a, lt: b } } });
    const [total, totalPrev, nNew, nNewPrev, dau, dauP, wau, wauP, mau, mauP] = await Promise.all([
      countUsers(w.to),
      countUsers(w.from),
      newIn(w.from, w.to),
      newIn(w.prevFrom, w.from),
      activeDistinct(new Date(w.to.getTime() - DAY), w.to),
      activeDistinct(new Date(w.from.getTime() - DAY), w.from),
      activeDistinct(new Date(w.to.getTime() - 7 * DAY), w.to),
      activeDistinct(new Date(w.from.getTime() - 7 * DAY), w.from),
      activeDistinct(new Date(w.to.getTime() - 30 * DAY), w.to),
      activeDistinct(new Date(w.from.getTime() - 30 * DAY), w.from),
    ]);
    const [signups, active, seg, geo] = await Promise.all([
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, count(u.id) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "User" u ON u."deletedAt" IS NULL AND u."createdAt" >= d.day AND u."createdAt" < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, count(DISTINCT a.uid) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN ${ACTIVITY} a ON a.ts >= d.day AND a.ts < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ k: string; n: bigint }>>`
        SELECT CASE
          WHEN u.id IN (SELECT "userId" FROM "AdminAccount") OR lower(u.email) = ANY(${env.PLATFORM_ADMIN_EMAILS}::text[]) THEN 'staff'
          WHEN EXISTS (SELECT 1 FROM "Course" c WHERE c."ownerId" = u.id) THEN 'creators'
          WHEN EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u.id AND s.status::text IN ('active', 'trialing', 'past_due')) THEN 'paid_members'
          ELSE 'free_members' END AS k, count(*) AS n
        FROM "User" u WHERE u."deletedAt" IS NULL AND u."createdAt" < ${w.to} GROUP BY 1`,
      prisma.$queryRaw<Array<{ label: string; n: bigint }>>`
        SELECT btrim(location) AS label, count(*) AS n FROM "User" WHERE "deletedAt" IS NULL AND location IS NOT NULL AND btrim(location) <> ''
        GROUP BY 1 ORDER BY n DESC, label ASC LIMIT 5`,
    ]);
    const signupBy = dayMap(signups);
    const series = fillDays(w, active.map((r) => ({ d: r.d, activeUsers: num(r.n), newUsers: signupBy.get(r.d) ?? 0 })), ['newUsers', 'activeUsers']);
    const LABELS: Record<string, string> = { free_members: 'Free members', paid_members: 'Paid members', creators: 'Creators', staff: 'Admins & mods' };
    const segMap = new Map(seg.map((r) => [r.k, num(r.n)]));
    const segments = withPct(['free_members', 'paid_members', 'creators', 'staff'].map((key) => ({ key, label: LABELS[key]!, count: segMap.get(key) ?? 0 })));
    return {
      ...head(w),
      kpis: { totalUsers: kpi(total, totalPrev), dau: kpi(dau, dauP), wau: kpi(wau, wauP), mau: kpi(mau, mauP), newUsers: kpi(nNew, nNewPrev) },
      series,
      segments,
      geography: withPct(geo.map((g) => ({ label: g.label, count: num(g.n) }))),
    };
  },

  /* ------------------------------------------------------------------ communities */
  async communities(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const live = { moderationStatus: { notIn: ['deleted', 'draft'] as Array<'deleted' | 'draft'> } };
    const paidWhere = { ...live, pricing: 'paid' as const, priceCents: { gt: 0 } };
    const [total, totalPrev, created, createdPrev, paid, paidPrev, suspended, members, membersPrev] = await Promise.all([
      prisma.community.count({ where: { ...live, createdAt: { lt: w.to } } }),
      prisma.community.count({ where: { ...live, createdAt: { lt: w.from } } }),
      prisma.community.count({ where: { ...live, createdAt: { gte: w.from, lt: w.to } } }),
      prisma.community.count({ where: { ...live, createdAt: { gte: w.prevFrom, lt: w.from } } }),
      prisma.community.count({ where: { ...paidWhere, createdAt: { lt: w.to } } }),
      prisma.community.count({ where: { ...paidWhere, createdAt: { lt: w.from } } }),
      prisma.community.count({ where: { moderationStatus: 'suspended' } }),
      prisma.enrollment.count({ where: { enrolledAt: { lt: w.to } } }),
      prisma.enrollment.count({ where: { enrolledAt: { lt: w.from } } }),
    ]);
    const [createdS, activeS, cats, catNames, topRows] = await Promise.all([
      prisma.$queryRaw<Array<{ d: string; n: bigint; p: bigint }>>`
        SELECT ${D} AS d, count(c.id) AS n, count(c.id) FILTER (WHERE c.pricing::text = 'paid' AND c."priceCents" > 0) AS p FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "Course" c ON c."moderationStatus"::text NOT IN ('deleted', 'draft') AND c."createdAt" >= d.day AND c."createdAt" < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, count(DISTINCT x."courseId") AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN (SELECT "courseId", "createdAt" AS ts FROM "Post" UNION ALL SELECT "courseId", "enrolledAt" FROM "Enrollment") x
          ON x.ts >= d.day AND x.ts < d.day + interval '1 day' GROUP BY 1`,
      prisma.community.groupBy({ by: ['category'], where: { ...live, createdAt: { lt: w.to } }, _count: { _all: true } }),
      prisma.discoveryCategory.findMany({ select: { key: true, name: true } }),
      prisma.$queryRaw<Array<{ id: string; title: string; category: string; members: bigint; new_members: bigint; mrr: bigint }>>`
        SELECT c.id, c.title, c.category::text AS category,
          (SELECT count(*) FROM "Enrollment" e WHERE e."courseId" = c.id AND e."enrolledAt" < ${w.to}) AS members,
          (SELECT count(*) FROM "Enrollment" e WHERE e."courseId" = c.id AND e."enrolledAt" >= ${w.from} AND e."enrolledAt" < ${w.to}) AS new_members,
          COALESCE((SELECT sum(s."priceCents") FROM "Subscription" s WHERE s."courseId" = c.id AND s.status::text IN ('active', 'past_due')), 0) AS mrr
        FROM "Course" c WHERE c."moderationStatus"::text NOT IN ('deleted', 'draft') ORDER BY members DESC, c.title ASC LIMIT 10`,
    ]);
    const names = new Map(catNames.map((c) => [c.key as string, c.name]));
    const activeBy = dayMap(activeS);
    const series = fillDays(w, createdS.map((r) => ({ d: r.d, created: num(r.n), paidCreated: num(r.p), active: activeBy.get(r.d) ?? 0 })), ['created', 'active', 'paidCreated']);
    return {
      ...head(w),
      kpis: {
        total: kpi(total, totalPrev),
        created: kpi(created, createdPrev),
        paid: kpi(paid, paidPrev),
        avgMembers: kpi(total ? round1(members / total) : 0, totalPrev ? round1(membersPrev / totalPrev) : null),
        suspended: kpi(suspended, null),
      },
      series,
      byCategory: withPct(
        cats.map((c) => ({ key: c.category as string, label: names.get(c.category as string) ?? (c.category as string), count: c._count._all })).sort((a, b) => b.count - a.count),
      ),
      top: topRows.map((r) => {
        const m = num(r.members);
        const nm = num(r.new_members);
        return { id: r.id, name: r.title, category: r.category, members: m, newMembers: nm, growthPct: m - nm > 0 ? round1((nm / (m - nm)) * 100) : null, mrrCents: num(r.mrr) };
      }),
    };
  },

  /* ------------------------------------------------------------------ engagement */
  async engagement(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const cnt = (table: string, col: string, a: Date, b: Date, extra = '') =>
      prisma
        .$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${table}" WHERE "${col}" >= $1 AND "${col}" < $2 ${extra}`, a, b)
        .then((r) => num(r[0]?.n));
    const both = (table: string, col: string, extra = '') => Promise.all([cnt(table, col, w.from, w.to, extra), cnt(table, col, w.prevFrom, w.from, extra)]);
    const [[posts, postsP], [comments, commentsP], [likes, likesP], [comp, compP], [rsvps, rsvpsP]] = await Promise.all([
      both('Post', 'createdAt'),
      both('PostComment', 'createdAt'),
      both('PostLike', 'createdAt'),
      both('LessonProgress', 'completedAt', 'AND "completedAt" IS NOT NULL'),
      both('EventRsvp', 'createdAt'),
    ]);
    const completion = async (at: Date) => {
      const r = await prisma.$queryRaw<Array<{ done: bigint; started: bigint }>>`
        SELECT (SELECT count(*) FROM "Certificate" WHERE "issuedAt" < ${at}) AS done,
               (SELECT count(*) FROM (SELECT DISTINCT lp."userId", l."courseId" FROM "LessonProgress" lp JOIN "ClassroomLesson" l ON l.id = lp."lessonId" WHERE lp."firstCompletedAt" < ${at}) t) AS started`;
      return num(r[0]?.started) ? round1((num(r[0]?.done) / num(r[0]?.started)) * 100) : 0;
    };
    const [cNow, cPrev] = await Promise.all([completion(w.to), completion(w.from)]);
    const day = (table: string, col: string) =>
      prisma.$queryRawUnsafe<Array<{ d: string; n: bigint }>>(
        `SELECT to_char(d.day AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d, count(t."${col}") AS n FROM generate_series($1::timestamptz, $2::timestamptz, interval '1 day') AS d(day)
         LEFT JOIN "${table}" t ON t."${col}" >= d.day AND t."${col}" < d.day + interval '1 day' GROUP BY 1`,
        w.from,
        new Date(w.to.getTime() - DAY),
      );
    const [sp, sc, sl, sk, sr] = await Promise.all([day('Post', 'createdAt'), day('PostComment', 'createdAt'), day('PostLike', 'createdAt'), day('LessonProgress', 'completedAt'), day('EventRsvp', 'createdAt')]);
    const [mc, ml, mk, mr] = [dayMap(sc), dayMap(sl), dayMap(sk), dayMap(sr)];
    const series = fillDays(
      w,
      sp.map((r) => ({ d: r.d, posts: num(r.n), comments: mc.get(r.d) ?? 0, likes: ml.get(r.d) ?? 0, completions: mk.get(r.d) ?? 0, rsvps: mr.get(r.d) ?? 0 })),
      ['posts', 'comments', 'likes', 'completions', 'rsvps'],
    );
    return {
      ...head(w),
      kpis: {
        posts: kpi(posts, postsP),
        comments: kpi(comments, commentsP),
        likes: kpi(likes, likesP),
        lessonCompletions: kpi(comp, compP),
        eventParticipation: kpi(rsvps, rsvpsP),
        courseCompletionPct: kpi(cNow, cPrev),
      },
      series,
      mix: withPct([
        { key: 'likes', label: 'Likes', count: likes },
        { key: 'comments', label: 'Comments', count: comments },
        { key: 'completions', label: 'Lesson completions', count: comp },
        { key: 'posts', label: 'Posts', count: posts },
      ]),
    };
  },

  /* ------------------------------------------------------------------ retention */
  async retention(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const now = new Date();
    // Day N: user đăng ký sao cho cửa sổ [su+N, su+N+7) KẾT THÚC trong kỳ; "giữ chân" = có hoạt động trong cửa sổ đó.
    const dayN = async (n: number, a: Date, b: Date) => {
      const r = await prisma.$queryRaw<Array<{ total: bigint; kept: bigint }>>`
        SELECT count(*) AS total, count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM ${ACTIVITY} x WHERE x.uid = u.id AND x.ts >= u."createdAt" + make_interval(days => ${n}) AND x.ts < u."createdAt" + make_interval(days => ${n + 7}))) AS kept
        FROM "User" u WHERE u."deletedAt" IS NULL
          AND u."createdAt" + make_interval(days => ${n + 7}) >= ${a} AND u."createdAt" + make_interval(days => ${n + 7}) < ${b}
          AND u."createdAt" + make_interval(days => ${n + 7}) <= ${now}`;
      return num(r[0]?.total) ? round1((num(r[0]?.kept) / num(r[0]?.total)) * 100) : 0;
    };
    const churn = async (a: Date, b: Date, pa: Date) => {
      // Trong số user hoạt động ở kỳ liền trước [pa,a) -> % không hoạt động ở kỳ [a,b).
      const r = await prisma.$queryRaw<Array<{ prev: bigint; lost: bigint }>>`
        WITH p AS (SELECT DISTINCT uid FROM ${ACTIVITY} x WHERE ts >= ${pa} AND ts < ${a}),
             c AS (SELECT DISTINCT uid FROM ${ACTIVITY} x WHERE ts >= ${a} AND ts < ${b})
        SELECT (SELECT count(*) FROM p) AS prev, (SELECT count(*) FROM p WHERE uid NOT IN (SELECT uid FROM c)) AS lost`;
      return num(r[0]?.prev) ? round1((num(r[0]?.lost) / num(r[0]?.prev)) * 100) : 0;
    };
    const renewal = async (a: Date, b: Date) => {
      const [renewed, lapsed] = await Promise.all([
        prisma.payment.count({ where: { kind: 'renewal', status: { in: ['succeeded', 'refunded'] }, createdAt: { gte: a, lt: b } } }),
        prisma.subscription.count({ where: { status: { in: ['expired', 'canceled'] }, currentPeriodEnd: { gte: a, lt: b } } }),
      ]);
      return renewed + lapsed ? round1((renewed / (renewed + lapsed)) * 100) : 0;
    };
    const [d7, d7p, d30, d30p, ch, chp, rn, rnp] = await Promise.all([
      dayN(7, w.from, w.to),
      dayN(7, w.prevFrom, w.from),
      dayN(30, w.from, w.to),
      dayN(30, w.prevFrom, w.from),
      churn(w.from, w.to, w.prevFrom),
      churn(w.prevFrom, w.from, new Date(w.prevFrom.getTime() - w.range * DAY)),
      renewal(w.from, w.to),
      renewal(w.prevFrom, w.from),
    ]);
    // Cohort theo tháng đăng ký (6 tháng gần nhất): wN = % user (đã đủ N tuần) có hoạt động trong tuần N sau đăng ký.
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const rows = await prisma.$queryRaw<Array<{ cohort: string; n: number; matured: bigint; active: bigint; total: bigint }>>`
      WITH u AS (SELECT id, "createdAt" AS su, date_trunc('month', "createdAt" AT TIME ZONE 'UTC') AS m FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" >= ${monthStart}),
           wk(n) AS (VALUES (1), (2), (4), (8), (12))
      SELECT to_char(u.m, 'YYYY-MM') AS cohort, wk.n,
        count(*) FILTER (WHERE u.su + make_interval(days => wk.n * 7) <= ${now}) AS matured,
        count(*) FILTER (WHERE u.su + make_interval(days => wk.n * 7) <= ${now} AND EXISTS (
          SELECT 1 FROM ${ACTIVITY} x WHERE x.uid = u.id
            AND x.ts >= u.su + make_interval(days => (wk.n - 1) * 7 + CASE WHEN wk.n = 1 THEN 1 ELSE 0 END)
            AND x.ts < u.su + make_interval(days => wk.n * 7))) AS active,
        count(*) AS total
      FROM u CROSS JOIN wk GROUP BY 1, 2 ORDER BY 1, 2`;
    const cohorts = new Map<string, { users: number; weeks: Record<string, number | null> }>();
    for (let i = 0; i < 6; i++) {
      const dte = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + i, 1));
      cohorts.set(dte.toISOString().slice(0, 7), { users: 0, weeks: { w1: null, w2: null, w4: null, w8: null, w12: null } });
    }
    for (const r of rows) {
      const c = cohorts.get(r.cohort);
      if (!c) continue;
      // `total` đếm theo (cohort, tuần) nên mọi dòng cùng cohort cho cùng số user.
      c.users = num(r.total);
      c.weeks[`w${r.n}`] = num(r.matured) ? round1((num(r.active) / num(r.matured)) * 100) : null;
    }
    const act = await prisma.$queryRaw<Array<{ d: string; returning: bigint; fresh: bigint }>>`
      SELECT ${D} AS d,
        count(DISTINCT a.uid) FILTER (WHERE u."createdAt" < d.day) AS returning,
        count(DISTINCT a.uid) FILTER (WHERE u."createdAt" >= d.day) AS fresh
      FROM ${DAYS(w)} AS d(day)
      LEFT JOIN ${ACTIVITY} a ON a.ts >= d.day AND a.ts < d.day + interval '1 day'
      LEFT JOIN "User" u ON u.id = a.uid GROUP BY 1`;
    return {
      ...head(w),
      kpis: { day7: kpi(d7, d7p), day30: kpi(d30, d30p), churn: kpi(ch, chp), renewalRate: kpi(rn, rnp) },
      cohorts: [...cohorts.entries()].map(([cohort, c]) => ({
        cohort,
        label: new Date(`${cohort}-01T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        users: c.users,
        weeks: c.weeks,
      })),
      returning: fillDays(w, act.map((r) => ({ d: r.d, returning: num(r.returning), newActive: num(r.fresh) })), ['returning', 'newActive']),
    };
  },

  /* ------------------------------------------------------------------ revenue */
  async revenue(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const PAID = Prisma.sql`p.status::text IN ('succeeded', 'refunded')`;
    const period = async (a: Date, b: Date) => {
      const [g, rf] = await Promise.all([
        prisma.$queryRaw<Array<{ gross: bigint; payers: bigint }>>`
          SELECT COALESCE(sum(p."amountCents"), 0) AS gross, count(DISTINCT p."userId") AS payers FROM "Payment" p
          WHERE ${PAID} AND COALESCE(p."confirmedAt", p."createdAt") >= ${a} AND COALESCE(p."confirmedAt", p."createdAt") < ${b}`,
        prisma.refundRequest.aggregate({ _sum: { amountCents: true }, where: { status: 'approved', resolvedAt: { gte: a, lt: b } } }),
      ]);
      const gross = num(g[0]?.gross);
      const payers = num(g[0]?.payers);
      return { gross, refunds: rf._sum.amountCents ?? 0, arpu: payers ? Math.round(gross / payers) : 0 };
    };
    /** MRR hiện tại (gói active/past_due) và xấp xỉ MRR tại mốc `at` (gói đã tạo, hết trial, chưa hủy/hết hạn tại mốc đó). */
    const mrrNow = async () => num((await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COALESCE(sum("priceCents"), 0) AS n FROM "Subscription" WHERE status::text IN ('active', 'past_due')`)[0]?.n);
    const mrrAt = async (at: Date) =>
      num(
        (
          await prisma.$queryRaw<Array<{ n: bigint }>>`
            SELECT COALESCE(sum("priceCents"), 0) AS n FROM "Subscription"
            WHERE "createdAt" < ${at} AND ("trialEndsAt" IS NULL OR "trialEndsAt" < ${at})
              AND ("canceledAt" IS NULL OR "canceledAt" >= ${at}) AND (status::text <> 'expired' OR "currentPeriodEnd" >= ${at})`
        )[0]?.n,
      );
    const [cur, prev, mrr, mrrPrev] = await Promise.all([period(w.from, w.to), period(w.prevFrom, w.from), mrrNow(), mrrAt(w.from)]);
    const bp = Math.round(cfg().payments.commissionPct * 100);
    const fee = (g: number) => Math.round((g * bp) / 10_000);
    const [gs, rs, byCom, byKind] = await Promise.all([
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, COALESCE(sum(p."amountCents"), 0) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "Payment" p ON ${PAID} AND COALESCE(p."confirmedAt", p."createdAt") >= d.day AND COALESCE(p."confirmedAt", p."createdAt") < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, COALESCE(sum(r."amountCents"), 0) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "RefundRequest" r ON r.status::text = 'approved' AND r."resolvedAt" >= d.day AND r."resolvedAt" < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ id: string; title: string; n: bigint }>>`
        SELECT c.id, c.title, sum(p."amountCents") AS n FROM "Payment" p JOIN "Course" c ON c.id = p."courseId"
        WHERE ${PAID} AND COALESCE(p."confirmedAt", p."createdAt") >= ${w.from} AND COALESCE(p."confirmedAt", p."createdAt") < ${w.to}
        GROUP BY c.id, c.title HAVING sum(p."amountCents") > 0 ORDER BY n DESC, c.title ASC LIMIT 10`,
      prisma.$queryRaw<Array<{ k: string; n: bigint }>>`
        SELECT p.kind::text AS k, COALESCE(sum(p."amountCents"), 0) AS n FROM "Payment" p
        WHERE ${PAID} AND COALESCE(p."confirmedAt", p."createdAt") >= ${w.from} AND COALESCE(p."confirmedAt", p."createdAt") < ${w.to} GROUP BY 1`,
    ]);
    const rMap = dayMap(rs);
    const series = fillDays(w, gs.map((r) => ({ d: r.d, grossCents: num(r.n), refundsCents: rMap.get(r.d) ?? 0, netCents: num(r.n) - (rMap.get(r.d) ?? 0) })), ['grossCents', 'refundsCents', 'netCents']);
    const kinds = new Map(byKind.map((r) => [r.k, num(r.n)]));
    return {
      ...head(w),
      kpis: {
        mrrCents: kpi(mrr, mrrPrev),
        grossCents: kpi(cur.gross, prev.gross),
        platformFeesCents: kpi(fee(cur.gross), fee(prev.gross)),
        arpuCents: kpi(cur.arpu, prev.arpu),
        refundsCents: kpi(cur.refunds, prev.refunds),
      },
      series,
      byCommunity: byCom.map((r) => ({ id: r.id, name: r.title, grossCents: num(r.n), pct: pctRound(num(r.n), cur.gross) })),
      byPlan: [
        { key: 'new_subscription', label: 'New subscriptions', grossCents: kinds.get('initial') ?? 0 },
        { key: 'renewal', label: 'Renewals', grossCents: kinds.get('renewal') ?? 0 },
      ].map((p) => ({ ...p, pct: pctRound(p.grossCents, cur.gross) })),
    };
  },

  /* ------------------------------------------------------------------ conversion */
  async conversion(range: 7 | 30 | 90) {
    const w = windowOf(range);
    const funnel = async (a: Date, b: Date) => {
      const r = await prisma.$queryRaw<Array<{ signups: bigint; joined: bigint; trial: bigint; paid: bigint; gross: bigint }>>`
        WITH s AS (SELECT id FROM "User" WHERE "deletedAt" IS NULL AND "createdAt" >= ${a} AND "createdAt" < ${b})
        SELECT (SELECT count(*) FROM s) AS signups,
          (SELECT count(*) FROM s WHERE EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."userId" = s.id)) AS joined,
          (SELECT count(*) FROM s WHERE EXISTS (SELECT 1 FROM "Subscription" x WHERE x."userId" = s.id AND x."trialEndsAt" IS NOT NULL)) AS trial,
          (SELECT count(*) FROM s WHERE EXISTS (SELECT 1 FROM "Payment" p WHERE p."userId" = s.id AND p.status::text IN ('succeeded', 'refunded') AND p."amountCents" > 0)) AS paid,
          (SELECT COALESCE(sum(p."amountCents"), 0) FROM "Payment" p WHERE p.status::text IN ('succeeded', 'refunded') AND COALESCE(p."confirmedAt", p."createdAt") >= ${a} AND COALESCE(p."confirmedAt", p."createdAt") < ${b}) AS gross`;
      const t = await prisma.$queryRaw<Array<{ trials: bigint; converted: bigint }>>`
        SELECT count(*) AS trials, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Payment" p WHERE p."subscriptionId" = s.id AND p.status::text IN ('succeeded', 'refunded') AND p."amountCents" > 0)) AS converted
        FROM "Subscription" s WHERE s."trialEndsAt" IS NOT NULL AND s."createdAt" >= ${a} AND s."createdAt" < ${b}`;
      const x = r[0]!;
      return { signups: num(x.signups), joined: num(x.joined), trial: num(x.trial), paid: num(x.paid), gross: num(x.gross), trials: num(t[0]?.trials), converted: num(t[0]?.converted) };
    };
    const [cur, prev] = await Promise.all([funnel(w.from, w.to), funnel(w.prevFrom, w.from)]);
    const [su, tr, pc] = await Promise.all([
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, count(u.id) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "User" u ON u."deletedAt" IS NULL AND u."createdAt" >= d.day AND u."createdAt" < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        SELECT ${D} AS d, count(s.id) AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN "Subscription" s ON s."trialEndsAt" IS NOT NULL AND s."createdAt" >= d.day AND s."createdAt" < d.day + interval '1 day' GROUP BY 1`,
      prisma.$queryRaw<Array<{ d: string; n: bigint }>>`
        WITH first_paid AS (SELECT "userId", min(COALESCE("confirmedAt", "createdAt")) AS t FROM "Payment" WHERE status::text IN ('succeeded', 'refunded') AND "amountCents" > 0 GROUP BY 1)
        SELECT ${D} AS d, count(f."userId") AS n FROM ${DAYS(w)} AS d(day)
        LEFT JOIN first_paid f ON f.t >= d.day AND f.t < d.day + interval '1 day' GROUP BY 1`,
    ]);
    const [mt, mp] = [dayMap(tr), dayMap(pc)];
    const ratio = (a: number, b: number) => (b ? round1((a / b) * 100) : 0);
    return {
      ...head(w),
      kpis: {
        signupToJoinPct: kpi(ratio(cur.joined, cur.signups), ratio(prev.joined, prev.signups)),
        signupToPaidPct: kpi(ratio(cur.paid, cur.signups), ratio(prev.paid, prev.signups)),
        trialToPaidPct: kpi(ratio(cur.converted, cur.trials), ratio(prev.converted, prev.trials)),
        revenuePerSignupCents: kpi(cur.signups ? Math.round(cur.gross / cur.signups) : 0, prev.signups ? Math.round(prev.gross / prev.signups) : 0),
      },
      funnel: [
        { key: 'signup', label: 'Created account', count: cur.signups },
        { key: 'joined', label: 'Joined a community', count: cur.joined },
        { key: 'trial', label: 'Started trial', count: cur.trial },
        { key: 'paid', label: 'Became paid', count: cur.paid },
      ].map((s) => ({ ...s, pctOfFirst: ratio(s.count, cur.signups) })),
      series: fillDays(w, su.map((r) => ({ d: r.d, signups: num(r.n), trialsStarted: mt.get(r.d) ?? 0, paidConversions: mp.get(r.d) ?? 0 })), ['signups', 'trialsStarted', 'paidConversions']),
    };
  },
};
