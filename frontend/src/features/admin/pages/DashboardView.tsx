import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCents, formatRelative } from '../../../lib/datetime';
import { AttentionCard, ChartCard, KpiGrid, QuickCard, Row, TimelineCard, type Kpi } from '../components/Cards';
import { DateRangeChips, PageHeader, type RangeDays } from '../components/PageHeader';
import { ErrorBlock, LoadingBlock, fmtNum, type Tone } from '../components/ui';
import { useDashboard } from '../queries';
import type { DashboardData, KpiValue } from '../types';

const dayLabel = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};
const money = (cents: number) => {
  const v = cents / 100;
  return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K` : `$${Math.round(v)}`;
};
const pct = (k: KpiValue) => (k.deltaPct == null ? null : `${k.deltaPct >= 0 ? '+' : ''}${k.deltaPct.toFixed(1)}%`);
/** Backend trả câu mô tả hoạt động bằng tiếng Anh -> dịch các câu đã biết, câu lạ giữ nguyên. */
const ACTIVITY_TEXT: Record<string, string> = {
  'created a community': 'đã tạo một cộng đồng',
  'signed up': 'đã đăng ký tài khoản',
  'suspended user': 'đã tạm ngưng người dùng',
  'banned user': 'đã cấm người dùng',
  'restricted user': 'đã hạn chế người dùng',
  'warned user': 'đã cảnh cáo người dùng',
  'reinstated user': 'đã khôi phục người dùng',
  'approved community': 'đã duyệt cộng đồng',
  'rejected community': 'đã từ chối cộng đồng',
  'suspended community': 'đã tạm ngưng cộng đồng',
  'restored community': 'đã khôi phục cộng đồng',
  'deleted community': 'đã xóa cộng đồng',
  'removed content': 'đã gỡ nội dung',
  'dismissed case': 'đã bỏ qua vụ việc',
  'resolved case': 'đã đóng vụ việc',
};
const ACTIVITY_TONE: Record<string, Tone> = { audit: 'o', signup: 'g', community_created: 'b' };

function Charts({ data }: { data: DashboardData }) {
  const s = data.series;
  return (
    <>
      <Row cols="1fr 1fr">
        <ChartCard
          title="Tăng trưởng người dùng"
          labels={s.userGrowth.map((p) => dayLabel(p.date))}
          series={[
            { name: 'Người dùng mới', values: s.userGrowth.map((p) => p.newUsers) },
            { name: 'Người dùng hoạt động', values: s.userGrowth.map((p) => p.activeUsers) },
          ]}
        />
        <ChartCard
          title="Tăng trưởng cộng đồng"
          labels={s.communityGrowth.map((p) => dayLabel(p.date))}
          series={[
            { name: 'Tạo mới', values: s.communityGrowth.map((p) => p.created) },
            { name: 'Hoạt động', values: s.communityGrowth.map((p) => p.active) },
            { name: 'Trả phí', values: s.communityGrowth.map((p) => p.paid) },
            { name: 'Tạm ngưng', values: s.communityGrowth.map((p) => p.suspended), color: '#dc2626' },
          ]}
        />
      </Row>
      <Row cols="1fr 1fr">
        <ChartCard
          title="Doanh thu"
          labels={s.revenue.map((p) => dayLabel(p.date))}
          fmt={(v) => money(v * 100)}
          series={[
            { name: 'Doanh thu định kỳ (MRR)', values: s.revenue.map((p) => p.mrrCents / 100) },
            { name: 'Doanh thu gói đăng ký', values: s.revenue.map((p) => p.revenueCents / 100) },
            { name: 'Hoàn tiền', values: s.revenue.map((p) => p.refundsCents / 100), color: '#dc2626' },
          ]}
        />
        <ChartCard
          title="Tương tác"
          labels={s.engagement.map((p) => dayLabel(p.date))}
          series={[
            { name: 'Bài viết', values: s.engagement.map((p) => p.posts) },
            { name: 'Bình luận', values: s.engagement.map((p) => p.comments) },
            { name: 'Bài học hoàn thành', values: s.engagement.map((p) => p.lessonsCompleted) },
            { name: 'Tham gia sự kiện', values: s.engagement.map((p) => p.eventRsvps) },
          ]}
        />
      </Row>
    </>
  );
}

/** Tổng quan: KPI, 4 biểu đồ, "Cần xử lý", hoạt động gần đây, thao tác nhanh — toàn bộ từ GET /admin/dashboard. */
export function DashboardView() {
  const navigate = useNavigate();
  const [range, setRange] = useState<RangeDays>(30);
  const q = useDashboard(range);
  const d = q.data;
  const go = (to: string) => () => navigate(to);

  const kpis: Kpi[] = d
    ? [
        { icon: 'person', label: 'Tổng người dùng', value: fmtNum(d.kpis.totalUsers.value), delta: pct(d.kpis.totalUsers), onClick: go('/admin/users') },
        { icon: 'bolt', label: 'Người dùng hoạt động', value: fmtNum(d.kpis.activeUsers.value), delta: pct(d.kpis.activeUsers), note: !pct(d.kpis.activeUsers) ? `${range} ngày qua` : undefined },
        { icon: 'groups', label: 'Cộng đồng', value: fmtNum(d.kpis.communities.value), delta: pct(d.kpis.communities), onClick: go('/admin/communities') },
        { icon: 'payments', label: 'Doanh thu định kỳ (MRR)', value: formatCents(d.kpis.mrrCents.value ?? 0), delta: pct(d.kpis.mrrCents) },
        { icon: 'flag', label: 'Báo cáo chờ xử lý', value: fmtNum(d.kpis.pendingReports.value), note: `${fmtNum(d.kpis.pendingReports.critical ?? 0)} nghiêm trọng`, onClick: go('/admin/moderation'), bad: true },
        { icon: 'how_to_reg', label: 'Cộng đồng chờ duyệt', value: fmtNum(d.kpis.pendingReviewCommunities.value), onClick: go('/admin/communities/review'), bad: true },
      ]
    : [];

  const na = d?.needsAttention;
  return (
    <>
      <PageHeader title="Bảng điều khiển" subtitle="Theo dõi hiệu suất nền tảng, hoạt động cộng đồng và vận hành." actions={<DateRangeChips value={range} onChange={setRange} />} />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {d && na && (
        <>
          <KpiGrid items={kpis} min={160} />
          <Charts data={d} />
          <Row cols="1fr 1.15fr .85fr">
            <AttentionCard
              title="Cần xử lý"
              items={[
                { icon: 'how_to_reg', label: 'Cộng đồng chờ duyệt', sub: na.pendingReviewCommunities.oldestWaitingHours != null ? `Lâu nhất đã chờ ${na.pendingReviewCommunities.oldestWaitingHours} giờ` : 'Không có cộng đồng nào đang chờ', count: fmtNum(na.pendingReviewCommunities.count), tone: 'o', onClick: go('/admin/communities/review') },
                { icon: 'flag', label: 'Báo cáo nội dung', sub: `${na.openReports.critical} báo cáo nghiêm trọng`, count: fmtNum(na.openReports.count), tone: 'r', onClick: go('/admin/moderation') },
                { icon: 'person_alert', label: 'Tài khoản đáng ngờ', sub: 'Bị báo cáo nhiều lần', count: fmtNum(na.suspiciousUsers.count), tone: 'r', onClick: go('/admin/users?sort=reports') },
                { icon: 'account_balance', label: 'Chi trả chờ duyệt', sub: `${formatCents(na.pendingPayouts.amountCents)} đang chờ`, count: fmtNum(na.pendingPayouts.count), tone: 'o', onClick: go('/admin/payments/payouts') },
                { icon: 'undo', label: 'Hoàn tiền chờ duyệt', sub: `${formatCents(na.pendingRefunds.amountCents)} đang chờ`, count: fmtNum(na.pendingRefunds.count), tone: 'o', onClick: go('/admin/payments/refunds') },
              ]}
            />
            <TimelineCard
              title="Hoạt động gần đây"
              link="Nhật ký hoạt động"
              onLink={go('/admin/system/audit')}
              items={d.recentActivity.map((a) => ({ icon: a.icon, who: a.actor?.name ?? 'Hệ thống', text: `${ACTIVITY_TEXT[a.text.toLowerCase()] ?? a.text}${a.target ? ` · ${a.target}` : ''}`, time: formatRelative(a.createdAt), tone: ACTIVITY_TONE[a.type] ?? 'o' }))}
            />
            <QuickCard
              title="Thao tác nhanh"
              items={[
                { icon: 'flag', label: 'Duyệt báo cáo', onClick: go('/admin/moderation') },
                { icon: 'person_search', label: 'Tìm người dùng', onClick: go('/admin/users') },
                { icon: 'travel_explore', label: 'Tìm cộng đồng', onClick: go('/admin/communities') },
                { icon: 'payments', label: 'Duyệt hoàn tiền', onClick: go('/admin/payments/refunds') },
                { icon: 'how_to_reg', label: 'Xét duyệt cộng đồng', onClick: go('/admin/communities/review') },
                { icon: 'history', label: 'Xem nhật ký', onClick: go('/admin/system/audit') },
              ]}
            />
          </Row>
        </>
      )}
    </>
  );
}
