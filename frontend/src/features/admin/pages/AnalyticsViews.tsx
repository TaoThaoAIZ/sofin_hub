import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatCents } from '../../../lib/datetime';
import { BarChartCard, CohortHeatmap, FunnelCard } from '../components/Batch3Parts';
import { BreakdownCard, ChartCard, KpiGrid, Row, type Kpi } from '../components/Cards';
import { DataTable, MainCell, NumCell } from '../components/DataTable';
import { DateRangeChips, PageHeader, type RangeDays } from '../components/PageHeader';
import { ErrorBlock, LoadingBlock, StatusBadge, fmtNum } from '../components/ui';
import { useAdminData } from '../queries.batch2';
import {
  FUNNEL_LABEL,
  MIX_LABEL,
  PLAN_LABEL,
  SEGMENT_LABEL,
  type AKpi,
  type AnalyticsCommunities,
  type AnalyticsConversion,
  type AnalyticsEngagement,
  type AnalyticsRetention,
  type AnalyticsRevenue,
  type AnalyticsUsers,
  type Share,
} from '../types.batch3';

/**
 * Phân tích (6 màn): mỗi màn gọi GET /admin/analytics/<tên>?range=7|30|90.
 * Không có dữ liệu "lượt truy cập chưa đăng nhập" và "nguồn đăng ký" -> các thẻ đó ẩn (ghi ở ADMIN_BACKEND_GAPS.md).
 */

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const money = (cents: number) => {
  const v = cents / 100;
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K` : `$${Math.round(v)}`;
};
/** Mức thay đổi so kỳ trước; số quá lớn (kỳ trước gần 0) rút gọn để không tràn thẻ. */
const fmtDelta = (p: number) => {
  const a = Math.abs(p);
  const body = a >= 1000 ? `${(a / 1000).toFixed(1).replace(/.0$/, '')}K` : a >= 100 ? a.toFixed(0) : a.toFixed(1);
  return `${p >= 0 ? '+' : '-'}${body}%`;
};
const delta = (k: AKpi) => (k.changePct == null ? null : fmtDelta(k.changePct));
const pct1 = (n: number) => `${n.toFixed(1).replace(/\.0$/, '')}%`;

const num = (icon: string, label: string, k: AKpi, bad?: boolean): Kpi => ({ icon, label, value: fmtNum(Math.round(k.value)), delta: delta(k), bad });
const cents = (icon: string, label: string, k: AKpi, bad?: boolean): Kpi => ({ icon, label, value: formatCents(Math.round(k.value)), delta: delta(k), bad });
const percent = (icon: string, label: string, k: AKpi, bad?: boolean): Kpi => ({ icon, label, value: pct1(k.value), delta: delta(k), bad });

const shares = (list: Share[], labels?: Record<string, string>) => list.map((s) => ({ label: (s.key && labels?.[s.key]) || s.label, value: `${pct1(s.pct)} · ${fmtNum(s.count)}`, pct: s.pct }));

/** Khung chung: tiêu đề + chip khoảng thời gian + tải/lỗi; `render` nhận dữ liệu đã tải. */
function AnalyticsPage<T>({ title, path, children }: { title: string; path: string; children: (d: T, range: RangeDays) => ReactNode }) {
  const { t } = useTranslation('admin-pages1');
  const [range, setRange] = useState<RangeDays>(30);
  const q = useAdminData<T>('analytics', path, { range });
  return (
    <>
      <PageHeader title={t('analytics.pageTitle', { title })} subtitle={t('analytics.subtitle')} actions={<DateRangeChips value={range} onChange={setRange} />} />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && children(q.data, range)}
    </>
  );
}

/* ------------------------------ Người dùng ------------------------------ */

export function AnalyticsUsersView() {
  const { t } = useTranslation('admin-pages1');
  return (
    <AnalyticsPage<AnalyticsUsers> title={t('analytics.users.title')} path="/analytics/users">
      {(d) => {
        const labels = d.series.map((p) => dayLabel(p.date));
        return (
          <>
            <KpiGrid
              min={160}
              items={[
                num('person', t('analytics.users.total'), d.kpis.totalUsers),
                num('today', t('analytics.users.dau'), d.kpis.dau),
                num('date_range', t('analytics.users.wau'), d.kpis.wau),
                num('calendar_month', t('analytics.users.mau'), d.kpis.mau),
                num('person_add', t('analytics.users.new'), d.kpis.newUsers),
              ]}
            />
            <Row cols="1fr 1fr">
              <ChartCard title={t('analytics.users.growth')} labels={labels} series={[{ name: t('analytics.users.new'), values: d.series.map((p) => p.newUsers) }]} />
              <ChartCard title={t('analytics.users.active')} labels={labels} series={[{ name: t('analytics.users.activeDay'), values: d.series.map((p) => p.activeUsers), color: '#2563eb' }]} />
            </Row>
            <Row cols={d.geography.length > 0 ? '1fr 1fr' : '1fr'}>
              <BreakdownCard title={t('analytics.users.segments')} items={shares(d.segments, SEGMENT_LABEL)} />
              {d.geography.length > 0 && <BreakdownCard title={t('analytics.users.geo')} sub={t('analytics.users.geoSub')} items={shares(d.geography)} />}
            </Row>
          </>
        );
      }}
    </AnalyticsPage>
  );
}

/* ------------------------------ Cộng đồng ------------------------------ */

export function AnalyticsCommunitiesView() {
  const { t } = useTranslation('admin-pages1');
  const navigate = useNavigate();
  return (
    <AnalyticsPage<AnalyticsCommunities> title={t('analytics.communities.title')} path="/analytics/communities">
      {(d) => {
        const catLabel = Object.fromEntries(d.byCategory.filter((c) => c.key).map((c) => [c.key!, c.label]));
        return (
        <>
          <KpiGrid
            min={160}
            items={[
              num('groups', t('analytics.communities.total'), d.kpis.total),
              num('add_business', t('analytics.communities.created'), d.kpis.created),
              num('paid', t('analytics.communities.paid'), d.kpis.paid),
              num('person', t('analytics.communities.avgMembers'), d.kpis.avgMembers),
              num('pause_circle', t('analytics.communities.suspended'), d.kpis.suspended, true),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title={t('analytics.communities.growth')}
              labels={d.series.map((p) => dayLabel(p.date))}
              series={[
                { name: t('analytics.communities.seriesCreated'), values: d.series.map((p) => p.created) },
                { name: t('analytics.communities.seriesActive'), values: d.series.map((p) => p.active) },
                { name: t('analytics.communities.seriesPaidNew'), values: d.series.map((p) => p.paidCreated) },
              ]}
            />
            <BreakdownCard title={t('analytics.communities.byCategory')} items={shares(d.byCategory)} />
          </Row>
          <DataTable<AnalyticsCommunities['top'][number]>
            title={t('analytics.communities.top')}
            sub={t('analytics.communities.topSub')}
            columns={[
              { key: 'name', label: t('analytics.communities.colCommunity'), w: 2, render: (m) => <MainCell name={m.name} sub={catLabel[m.category] ?? m.category} shape="square" seed={m.id} /> },
              { key: 'members', label: t('analytics.communities.colMembers'), render: (m) => <NumCell>{fmtNum(m.members)}</NumCell> },
              { key: 'new', label: t('analytics.communities.colNew'), render: (m) => <NumCell>{fmtNum(m.newMembers)}</NumCell> },
              { key: 'growth', label: t('analytics.communities.colGrowth'), render: (m) => (m.growthPct == null ? <span className="text-stone-400">—</span> : <StatusBadge tone={m.growthPct >= 0 ? 'g' : 'r'}>{fmtDelta(m.growthPct)}</StatusBadge>) },
              { key: 'mrr', label: t('analytics.communities.colMrr'), render: (m) => <NumCell>{formatCents(m.mrrCents)}</NumCell> },
            ]}
            rows={d.top}
            rowKey={(m) => m.id}
            onRow={(m) => navigate(`/admin/communities/${m.id}`)}
            emptyText={t('analytics.communities.empty')}
          />
        </>
        );
      }}
    </AnalyticsPage>
  );
}

/* ------------------------------ Tương tác ------------------------------ */

export function AnalyticsEngagementView() {
  const { t } = useTranslation('admin-pages1');
  return (
    <AnalyticsPage<AnalyticsEngagement> title={t('analytics.engagement.title')} path="/analytics/engagement">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              num('edit_note', t('analytics.engagement.posts'), d.kpis.posts),
              num('chat', t('analytics.engagement.comments'), d.kpis.comments),
              num('favorite', t('analytics.engagement.likes'), d.kpis.likes),
              num('school', t('analytics.engagement.lessons'), d.kpis.lessonCompletions),
              percent('task_alt', t('analytics.engagement.courseCompletion'), d.kpis.courseCompletionPct),
              num('event', t('analytics.engagement.events'), d.kpis.eventParticipation),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title={t('analytics.engagement.title')}
              labels={d.series.map((p) => dayLabel(p.date))}
              series={[
                { name: t('analytics.engagement.posts'), values: d.series.map((p) => p.posts) },
                { name: t('analytics.engagement.comments'), values: d.series.map((p) => p.comments) },
                { name: t('analytics.engagement.likes'), values: d.series.map((p) => p.likes) },
                { name: t('analytics.engagement.lessons'), values: d.series.map((p) => p.completions) },
                { name: t('analytics.engagement.events'), values: d.series.map((p) => p.rsvps) },
              ]}
            />
            <BreakdownCard title={t('analytics.engagement.mix')} items={shares(d.mix, MIX_LABEL)} />
          </Row>
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Giữ chân ------------------------------ */

export function AnalyticsRetentionView() {
  const { t } = useTranslation('admin-pages1');
  return (
    <AnalyticsPage<AnalyticsRetention> title={t('analytics.retention.title')} path="/analytics/retention">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              percent('event_repeat', t('analytics.retention.day7'), d.kpis.day7),
              percent('event_repeat', t('analytics.retention.day30'), d.kpis.day30),
              percent('logout', t('analytics.retention.churn'), d.kpis.churn, true),
              percent('loyalty', t('analytics.retention.renewal'), d.kpis.renewalRate),
            ]}
          />
          <CohortHeatmap
            title={t('analytics.retention.cohort')}
            sub={t('analytics.retention.cohortSub')}
            columns={[t('analytics.retention.week1'), t('analytics.retention.week2'), t('analytics.retention.week4'), t('analytics.retention.week8'), t('analytics.retention.week12')]}
            rows={d.cohorts.map((c) => ({ label: c.label, sub: t('analytics.retention.cohortRow'), size: c.users, values: [c.weeks.w1, c.weeks.w2, c.weeks.w4, c.weeks.w8, c.weeks.w12] }))}
          />
          <BarChartCard
            title={t('analytics.retention.returning')}
            sub={t('analytics.retention.returningSub')}
            labels={d.returning.map((p) => dayLabel(p.date))}
            series={[
              { name: t('analytics.retention.seriesReturning'), values: d.returning.map((p) => p.returning) },
              { name: t('analytics.retention.seriesNewActive'), values: d.returning.map((p) => p.newActive), color: '#2563eb' },
            ]}
          />
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Doanh thu ------------------------------ */

export function AnalyticsRevenueView() {
  const { t } = useTranslation('admin-pages1');
  return (
    <AnalyticsPage<AnalyticsRevenue> title={t('analytics.revenue.title')} path="/analytics/revenue">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              cents('payments', t('analytics.revenue.mrr'), d.kpis.mrrCents),
              cents('receipt_long', t('analytics.revenue.gross'), d.kpis.grossCents),
              cents('percent', t('analytics.revenue.fees'), d.kpis.platformFeesCents),
              cents('person', t('analytics.revenue.arpu'), d.kpis.arpuCents),
              cents('undo', t('analytics.revenue.refunds'), d.kpis.refundsCents, true),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title={t('analytics.revenue.title')}
              labels={d.series.map((p) => dayLabel(p.date))}
              fmt={(v) => money(v * 100)}
              series={[
                { name: t('analytics.revenue.gross'), values: d.series.map((p) => p.grossCents / 100) },
                { name: t('analytics.revenue.net'), values: d.series.map((p) => p.netCents / 100), color: '#16a34a' },
                { name: t('analytics.revenue.refunds'), values: d.series.map((p) => p.refundsCents / 100), color: '#dc2626' },
              ]}
            />
            <BreakdownCard title={t('analytics.revenue.byPlan')} items={d.byPlan.map((p) => ({ label: PLAN_LABEL[p.key] ?? p.label, value: `${pct1(p.pct)} · ${formatCents(p.grossCents)}`, pct: p.pct }))} />
          </Row>
          <BreakdownCard title={t('analytics.revenue.byCommunity')} sub={t('analytics.revenue.byCommunitySub')} items={d.byCommunity.map((c) => ({ label: c.name, value: `${pct1(c.pct)} · ${formatCents(c.grossCents)}`, pct: c.pct }))} />
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Chuyển đổi ------------------------------ */

export function AnalyticsConversionView() {
  const { t } = useTranslation('admin-pages1');
  return (
    <AnalyticsPage<AnalyticsConversion> title={t('analytics.conversion.title')} path="/analytics/conversion">
      {(d) => {
        const first = d.funnel[0]?.count ?? 0;
        return (
          <>
            <KpiGrid
              min={160}
              items={[
                percent('login', t('analytics.conversion.signupToJoin'), d.kpis.signupToJoinPct),
                percent('shopping_cart', t('analytics.conversion.signupToPaid'), d.kpis.signupToPaidPct),
                percent('science', t('analytics.conversion.trialToPaid'), d.kpis.trialToPaidPct),
                cents('paid', t('analytics.conversion.revenuePerSignup'), d.kpis.revenuePerSignupCents),
              ]}
            />
            <Row cols="1fr 1.6fr">
              <FunnelCard
                title={t('analytics.conversion.funnel')}
                sub={t('analytics.conversion.funnelSub')}
                steps={d.funnel.map((f, i) => ({
                  label: FUNNEL_LABEL[f.key] ?? f.label,
                  value: fmtNum(f.count),
                  pct: f.pctOfFirst,
                  note: i === 0 || first === 0 ? undefined : pct1(f.pctOfFirst),
                }))}
              />
              <BarChartCard
                title={t('analytics.conversion.daily')}
                labels={d.series.map((p) => dayLabel(p.date))}
                series={[
                  { name: t('analytics.conversion.newSignups'), values: d.series.map((p) => p.signups) },
                  { name: t('analytics.conversion.trialsStarted'), values: d.series.map((p) => p.trialsStarted), color: '#2563eb' },
                  { name: t('analytics.conversion.paidConversions'), values: d.series.map((p) => p.paidConversions), color: '#16a34a' },
                ]}
              />
            </Row>
          </>
        );
      }}
    </AnalyticsPage>
  );
}
