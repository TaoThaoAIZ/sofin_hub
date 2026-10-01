import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [range, setRange] = useState<RangeDays>(30);
  const q = useAdminData<T>('analytics', path, { range });
  return (
    <>
      <PageHeader title={`Phân tích · ${title}`} subtitle="Chỉ số tăng trưởng và hiệu suất của nền tảng." actions={<DateRangeChips value={range} onChange={setRange} />} />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && children(q.data, range)}
    </>
  );
}

/* ------------------------------ Người dùng ------------------------------ */

export function AnalyticsUsersView() {
  return (
    <AnalyticsPage<AnalyticsUsers> title="Người dùng" path="/analytics/users">
      {(d) => {
        const labels = d.series.map((p) => dayLabel(p.date));
        return (
          <>
            <KpiGrid
              min={160}
              items={[
                num('person', 'Tổng người dùng', d.kpis.totalUsers),
                num('today', 'DAU (hoạt động/ngày)', d.kpis.dau),
                num('date_range', 'WAU (hoạt động/tuần)', d.kpis.wau),
                num('calendar_month', 'MAU (hoạt động/tháng)', d.kpis.mau),
                num('person_add', 'Người dùng mới', d.kpis.newUsers),
              ]}
            />
            <Row cols="1fr 1fr">
              <ChartCard title="Tăng trưởng người dùng" labels={labels} series={[{ name: 'Người dùng mới', values: d.series.map((p) => p.newUsers) }]} />
              <ChartCard title="Người dùng hoạt động" labels={labels} series={[{ name: 'Hoạt động trong ngày', values: d.series.map((p) => p.activeUsers), color: '#2563eb' }]} />
            </Row>
            <Row cols={d.geography.length > 0 ? '1fr 1fr' : '1fr'}>
              <BreakdownCard title="Phân khúc người dùng" items={shares(d.segments, SEGMENT_LABEL)} />
              {d.geography.length > 0 && <BreakdownCard title="Phân bố địa lý" sub="Theo vị trí người dùng tự khai" items={shares(d.geography)} />}
            </Row>
          </>
        );
      }}
    </AnalyticsPage>
  );
}

/* ------------------------------ Cộng đồng ------------------------------ */

export function AnalyticsCommunitiesView() {
  const navigate = useNavigate();
  return (
    <AnalyticsPage<AnalyticsCommunities> title="Cộng đồng" path="/analytics/communities">
      {(d) => {
        const catLabel = Object.fromEntries(d.byCategory.filter((c) => c.key).map((c) => [c.key!, c.label]));
        return (
        <>
          <KpiGrid
            min={160}
            items={[
              num('groups', 'Cộng đồng', d.kpis.total),
              num('add_business', 'Tạo mới trong kỳ', d.kpis.created),
              num('paid', 'Trả phí', d.kpis.paid),
              num('person', 'TB thành viên', d.kpis.avgMembers),
              num('pause_circle', 'Tạm ngưng', d.kpis.suspended, true),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title="Tăng trưởng cộng đồng"
              labels={d.series.map((p) => dayLabel(p.date))}
              series={[
                { name: 'Tạo mới', values: d.series.map((p) => p.created) },
                { name: 'Đang hoạt động', values: d.series.map((p) => p.active) },
                { name: 'Trả phí mới', values: d.series.map((p) => p.paidCreated) },
              ]}
            />
            <BreakdownCard title="Theo danh mục" items={shares(d.byCategory)} />
          </Row>
          <DataTable<AnalyticsCommunities['top'][number]>
            title="Cộng đồng hàng đầu"
            sub="Theo số thành viên"
            columns={[
              { key: 'name', label: 'Cộng đồng', w: 2, render: (m) => <MainCell name={m.name} sub={catLabel[m.category] ?? m.category} shape="square" seed={m.id} /> },
              { key: 'members', label: 'Thành viên', render: (m) => <NumCell>{fmtNum(m.members)}</NumCell> },
              { key: 'new', label: 'Thành viên mới', render: (m) => <NumCell>{fmtNum(m.newMembers)}</NumCell> },
              { key: 'growth', label: 'Tăng trưởng', render: (m) => (m.growthPct == null ? <span className="text-stone-400">—</span> : <StatusBadge tone={m.growthPct >= 0 ? 'g' : 'r'}>{fmtDelta(m.growthPct)}</StatusBadge>) },
              { key: 'mrr', label: 'MRR', render: (m) => <NumCell>{formatCents(m.mrrCents)}</NumCell> },
            ]}
            rows={d.top}
            rowKey={(m) => m.id}
            onRow={(m) => navigate(`/admin/communities/${m.id}`)}
            emptyText="Chưa có cộng đồng nào."
          />
        </>
        );
      }}
    </AnalyticsPage>
  );
}

/* ------------------------------ Tương tác ------------------------------ */

export function AnalyticsEngagementView() {
  return (
    <AnalyticsPage<AnalyticsEngagement> title="Tương tác" path="/analytics/engagement">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              num('edit_note', 'Bài viết', d.kpis.posts),
              num('chat', 'Bình luận', d.kpis.comments),
              num('favorite', 'Lượt thích', d.kpis.likes),
              num('school', 'Bài học hoàn thành', d.kpis.lessonCompletions),
              percent('task_alt', 'Hoàn thành khóa học', d.kpis.courseCompletionPct),
              num('event', 'Tham gia sự kiện', d.kpis.eventParticipation),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title="Tương tác"
              labels={d.series.map((p) => dayLabel(p.date))}
              series={[
                { name: 'Bài viết', values: d.series.map((p) => p.posts) },
                { name: 'Bình luận', values: d.series.map((p) => p.comments) },
                { name: 'Lượt thích', values: d.series.map((p) => p.likes) },
                { name: 'Bài học hoàn thành', values: d.series.map((p) => p.completions) },
                { name: 'Tham gia sự kiện', values: d.series.map((p) => p.rsvps) },
              ]}
            />
            <BreakdownCard title="Cơ cấu tương tác" items={shares(d.mix, MIX_LABEL)} />
          </Row>
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Giữ chân ------------------------------ */

export function AnalyticsRetentionView() {
  return (
    <AnalyticsPage<AnalyticsRetention> title="Giữ chân" path="/analytics/retention">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              percent('event_repeat', 'Giữ chân ngày 7', d.kpis.day7),
              percent('event_repeat', 'Giữ chân ngày 30', d.kpis.day30),
              percent('logout', 'Tỷ lệ rời bỏ', d.kpis.churn, true),
              percent('loyalty', 'Tỷ lệ gia hạn', d.kpis.renewalRate),
            ]}
          />
          <CohortHeatmap
            title="Giữ chân theo nhóm"
            sub="Tỷ lệ mỗi nhóm đăng ký (theo tháng) còn hoạt động sau N tuần. Ô trống = chưa đủ thời gian."
            columns={['Tuần 1', 'Tuần 2', 'Tuần 4', 'Tuần 8', 'Tuần 12']}
            rows={d.cohorts.map((c) => ({ label: c.label, sub: 'Nhóm đăng ký', size: c.users, values: [c.weeks.w1, c.weeks.w2, c.weeks.w4, c.weeks.w8, c.weeks.w12] }))}
          />
          <BarChartCard
            title="Người dùng quay lại"
            sub="Người dùng đã đăng ký từ trước vẫn hoạt động trong ngày, so với người dùng mới hoạt động"
            labels={d.returning.map((p) => dayLabel(p.date))}
            series={[
              { name: 'Quay lại', values: d.returning.map((p) => p.returning) },
              { name: 'Mới hoạt động', values: d.returning.map((p) => p.newActive), color: '#2563eb' },
            ]}
          />
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Doanh thu ------------------------------ */

export function AnalyticsRevenueView() {
  return (
    <AnalyticsPage<AnalyticsRevenue> title="Doanh thu" path="/analytics/revenue">
      {(d) => (
        <>
          <KpiGrid
            min={160}
            items={[
              cents('payments', 'MRR', d.kpis.mrrCents),
              cents('receipt_long', 'Doanh thu gộp', d.kpis.grossCents),
              cents('percent', 'Phí nền tảng', d.kpis.platformFeesCents),
              cents('person', 'ARPU', d.kpis.arpuCents),
              cents('undo', 'Hoàn tiền', d.kpis.refundsCents, true),
            ]}
          />
          <Row cols="1.6fr 1fr">
            <ChartCard
              title="Doanh thu"
              labels={d.series.map((p) => dayLabel(p.date))}
              fmt={(v) => money(v * 100)}
              series={[
                { name: 'Doanh thu gộp', values: d.series.map((p) => p.grossCents / 100) },
                { name: 'Doanh thu ròng', values: d.series.map((p) => p.netCents / 100), color: '#16a34a' },
                { name: 'Hoàn tiền', values: d.series.map((p) => p.refundsCents / 100), color: '#dc2626' },
              ]}
            />
            <BreakdownCard title="Theo loại thanh toán" items={d.byPlan.map((p) => ({ label: PLAN_LABEL[p.key] ?? p.label, value: `${pct1(p.pct)} · ${formatCents(p.grossCents)}`, pct: p.pct }))} />
          </Row>
          <BreakdownCard title="Theo cộng đồng" sub="Doanh thu gộp trong kỳ" items={d.byCommunity.map((c) => ({ label: c.name, value: `${pct1(c.pct)} · ${formatCents(c.grossCents)}`, pct: c.pct }))} />
        </>
      )}
    </AnalyticsPage>
  );
}

/* ------------------------------ Chuyển đổi ------------------------------ */

export function AnalyticsConversionView() {
  return (
    <AnalyticsPage<AnalyticsConversion> title="Chuyển đổi" path="/analytics/conversion">
      {(d) => {
        const first = d.funnel[0]?.count ?? 0;
        return (
          <>
            <KpiGrid
              min={160}
              items={[
                percent('login', 'Đăng ký → Tham gia', d.kpis.signupToJoinPct),
                percent('shopping_cart', 'Đăng ký → Trả phí', d.kpis.signupToPaidPct),
                percent('science', 'Dùng thử → Trả phí', d.kpis.trialToPaidPct),
                cents('paid', 'Doanh thu / lượt đăng ký', d.kpis.revenuePerSignupCents),
              ]}
            />
            <Row cols="1fr 1.6fr">
              <FunnelCard
                title="Phễu chuyển đổi"
                sub="Người đăng ký trong kỳ đi tiếp qua từng bước"
                steps={d.funnel.map((f, i) => ({
                  label: FUNNEL_LABEL[f.key] ?? f.label,
                  value: fmtNum(f.count),
                  pct: f.pctOfFirst,
                  note: i === 0 || first === 0 ? undefined : pct1(f.pctOfFirst),
                }))}
              />
              <BarChartCard
                title="Chuyển đổi theo ngày"
                labels={d.series.map((p) => dayLabel(p.date))}
                series={[
                  { name: 'Đăng ký mới', values: d.series.map((p) => p.signups) },
                  { name: 'Bắt đầu dùng thử', values: d.series.map((p) => p.trialsStarted), color: '#2563eb' },
                  { name: 'Chuyển sang trả phí', values: d.series.map((p) => p.paidConversions), color: '#16a34a' },
                ]}
              />
            </Row>
          </>
        );
      }}
    </AnalyticsPage>
  );
}
