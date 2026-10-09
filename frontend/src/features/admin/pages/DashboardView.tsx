import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../../i18n';
import { formatCents, formatRelative, formatVndCompact } from '../../../lib/datetime';
import { AttentionCard, ChartCard, KpiGrid, QuickCard, Row, TimelineCard, type Kpi } from '../components/Cards';
import { DateRangeChips, PageHeader, type RangeDays } from '../components/PageHeader';
import { ErrorBlock, LoadingBlock, fmtNum, type Tone } from '../components/ui';
import { useDashboard } from '../queries';
import type { DashboardData, KpiValue } from '../types';

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const money = (vnd: number) => formatVndCompact(vnd);
const pct = (k: KpiValue) => (k.deltaPct == null ? null : `${k.deltaPct >= 0 ? '+' : ''}${k.deltaPct.toFixed(1)}%`);
/** Backend trả câu mô tả hoạt động bằng tiếng Anh -> dịch các câu đã biết, câu lạ giữ nguyên. */
const ACTIVITY_KEY: Record<string, string> = {
  'created a community': 'createdCommunity',
  'signed up': 'signedUp',
  'suspended user': 'suspendedUser',
  'banned user': 'bannedUser',
  'restricted user': 'restrictedUser',
  'warned user': 'warnedUser',
  'reinstated user': 'reinstatedUser',
  'approved community': 'approvedCommunity',
  'rejected community': 'rejectedCommunity',
  'suspended community': 'suspendedCommunity',
  'restored community': 'restoredCommunity',
  'deleted community': 'deletedCommunity',
  'removed content': 'removedContent',
  'dismissed case': 'dismissedCase',
  'resolved case': 'resolvedCase',
};
const activityText = (text: string) => {
  const key = ACTIVITY_KEY[text.toLowerCase()];
  return key ? i18n.t(`dashboard.activity.${key}`, { ns: 'admin-pages1' }) : text;
};
const ACTIVITY_TONE: Record<string, Tone> = { audit: 'o', signup: 'g', community_created: 'b' };

function Charts({ data }: { data: DashboardData }) {
  const { t } = useTranslation('admin-pages1');
  const s = data.series;
  return (
    <>
      <Row cols="1fr 1fr">
        <ChartCard
          title={t('dashboard.userGrowth')}
          labels={s.userGrowth.map((p) => dayLabel(p.date))}
          series={[
            { name: t('dashboard.newUsers'), values: s.userGrowth.map((p) => p.newUsers) },
            { name: t('dashboard.activeUsers'), values: s.userGrowth.map((p) => p.activeUsers) },
          ]}
        />
        <ChartCard
          title={t('dashboard.communityGrowth')}
          labels={s.communityGrowth.map((p) => dayLabel(p.date))}
          series={[
            { name: t('dashboard.created'), values: s.communityGrowth.map((p) => p.created) },
            { name: t('dashboard.active'), values: s.communityGrowth.map((p) => p.active) },
            { name: t('dashboard.paid'), values: s.communityGrowth.map((p) => p.paid) },
            { name: t('dashboard.suspended'), values: s.communityGrowth.map((p) => p.suspended), color: '#dc2626' },
          ]}
        />
      </Row>
      <Row cols="1fr 1fr">
        <ChartCard
          title={t('dashboard.revenue')}
          labels={s.revenue.map((p) => dayLabel(p.date))}
          fmt={(v) => money(v)}
          series={[
            { name: t('dashboard.mrrSeries'), values: s.revenue.map((p) => p.mrrCents) },
            { name: t('dashboard.subRevenue'), values: s.revenue.map((p) => p.revenueCents) },
            { name: t('dashboard.refunds'), values: s.revenue.map((p) => p.refundsCents), color: '#dc2626' },
          ]}
        />
        <ChartCard
          title={t('dashboard.engagement')}
          labels={s.engagement.map((p) => dayLabel(p.date))}
          series={[
            { name: t('dashboard.posts'), values: s.engagement.map((p) => p.posts) },
            { name: t('dashboard.comments'), values: s.engagement.map((p) => p.comments) },
            { name: t('dashboard.lessonsCompleted'), values: s.engagement.map((p) => p.lessonsCompleted) },
            { name: t('dashboard.eventRsvps'), values: s.engagement.map((p) => p.eventRsvps) },
          ]}
        />
      </Row>
    </>
  );
}

/** Tổng quan: KPI, 4 biểu đồ, "Cần xử lý", hoạt động gần đây, thao tác nhanh — toàn bộ từ GET /admin/dashboard. */
export function DashboardView() {
  const { t } = useTranslation('admin-pages1');
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeDays>(30);
  const q = useDashboard(range);
  const d = q.data;
  const go = (to: string) => () => navigate(to);

  const kpis: Kpi[] = d
    ? [
        { icon: 'person', label: t('dashboard.kpiTotalUsers'), value: fmtNum(d.kpis.totalUsers.value), delta: pct(d.kpis.totalUsers), onClick: go('/admin/users') },
        { icon: 'bolt', label: t('dashboard.kpiActiveUsers'), value: fmtNum(d.kpis.activeUsers.value), delta: pct(d.kpis.activeUsers), note: !pct(d.kpis.activeUsers) ? t('dashboard.lastDays', { n: range }) : undefined },
        { icon: 'groups', label: t('dashboard.kpiCommunities'), value: fmtNum(d.kpis.communities.value), delta: pct(d.kpis.communities), onClick: go('/admin/communities') },
        { icon: 'payments', label: t('dashboard.kpiMrr'), value: formatCents(d.kpis.mrrCents.value ?? 0), delta: pct(d.kpis.mrrCents) },
        { icon: 'flag', label: t('dashboard.kpiPendingReports'), value: fmtNum(d.kpis.pendingReports.value), note: t('dashboard.critical', { n: fmtNum(d.kpis.pendingReports.critical ?? 0) }), onClick: go('/admin/moderation'), bad: true },
        { icon: 'how_to_reg', label: t('dashboard.kpiPendingCommunities'), value: fmtNum(d.kpis.pendingReviewCommunities.value), onClick: go('/admin/communities/review'), bad: true },
      ]
    : [];

  const na = d?.needsAttention;
  return (
    <>
      <PageHeader title={t('dashboard.title')} subtitle={t('dashboard.subtitle')} actions={<DateRangeChips value={range} onChange={setRange} />} />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {d && na && (
        <>
          <KpiGrid items={kpis} min={160} />
          <Charts data={d} />
          <Row cols="1fr 1.15fr .85fr">
            <AttentionCard
              title={t('dashboard.attention')}
              items={[
                { icon: 'how_to_reg', label: t('dashboard.attPending'), sub: na.pendingReviewCommunities.count > 0 && na.pendingReviewCommunities.oldestWaitingHours ?  t('dashboard.oldestWaiting', { hours: na.pendingReviewCommunities.oldestWaitingHours }) : t('dashboard.noneWaiting'), count: fmtNum(na.pendingReviewCommunities.count), tone: 'o', onClick: go('/admin/communities/review') },
                { icon: 'flag', label: t('dashboard.attReports'), sub: t('dashboard.criticalReports', { n: na.openReports.critical }), count: fmtNum(na.openReports.count), tone: 'r', onClick: go('/admin/moderation') },
                { icon: 'person_alert', label: t('dashboard.attSuspicious'), sub: t('dashboard.suspiciousSub'), count: fmtNum(na.suspiciousUsers.count), tone: 'r', onClick: go('/admin/users?sort=reports') },
                { icon: 'account_balance', label: t('dashboard.attPayouts'), sub: t('dashboard.amountWaiting', { amount: formatCents(na.pendingPayouts.amountCents) }), count: fmtNum(na.pendingPayouts.count), tone: 'o', onClick: go('/admin/payments/payouts') },
                { icon: 'undo', label: t('dashboard.attRefunds'), sub: t('dashboard.amountWaiting', { amount: formatCents(na.pendingRefunds.amountCents) }), count: fmtNum(na.pendingRefunds.count), tone: 'o', onClick: go('/admin/payments/refunds') },
              ]}
            />
            <TimelineCard
              title={t('dashboard.recent')}
              link={t('dashboard.auditLink')}
              onLink={go('/admin/system/audit')}
              items={d.recentActivity.map((a) => ({ icon: a.icon, who: a.actor?.name ?? t('dashboard.system'), text: `${activityText(a.text)}${a.target ? ` · ${a.target}` : ''}`, time: formatRelative(a.createdAt), tone: ACTIVITY_TONE[a.type] ?? 'o' }))}
            />
            <QuickCard
              title={t('dashboard.quick')}
              items={[
                { icon: 'flag', label: t('dashboard.qReports'), onClick: go('/admin/moderation') },
                { icon: 'person_search', label: t('dashboard.qFindUser'), onClick: go('/admin/users') },
                { icon: 'travel_explore', label: t('dashboard.qFindCommunity'), onClick: go('/admin/communities') },
                { icon: 'payments', label: t('dashboard.qRefunds'), onClick: go('/admin/payments/refunds') },
                { icon: 'how_to_reg', label: t('dashboard.qReview'), onClick: go('/admin/communities/review') },
                { icon: 'history', label: t('dashboard.qAudit'), onClick: go('/admin/system/audit') },
              ]}
            />
          </Row>
        </>
      )}
    </>
  );
}
