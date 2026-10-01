import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../../lib/api';
import { formatDateTime } from '../../../lib/datetime';
import { ActionDialog, BarCell, FactorsCard, FeaturedCard, opts, toDateInput, useDialogSlot, useTableState } from '../components/Batch2Parts';
import { KpiGrid, Row } from '../components/Cards';
import { DataTable, MainCell, MonoCell, MutedCell, NumCell, TextCell, type Column, type RowAction } from '../components/DataTable';
import { InputField, OptionChips, TextAreaField, useMenu, useToast, type MenuItem } from '../components/overlay';
import { PageHeader } from '../components/PageHeader';
import { AdminButton, EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge, errMessage, fmtNum } from '../components/ui';
import { useAdminAction, useAdminData, useAdminList } from '../queries.batch2';
import {
  CATEGORY_DEFAULT_NAME,
  CONTENT_STATUS,
  FACTOR_LABEL,
  FEATURED_LABEL,
  LISTED_STATUS,
  SEARCH_VIS,
  type AdminCategory,
  type AdminListedCommunity,
  type AdminSearchVisibility,
  type FeaturedSection,
  type ListedSummary,
  type RankingRow,
  type RankingWeights,
  type RankingsData,
  type SearchVis,
  type SearchVisSummary,
} from '../types.batch2';

const LIMIT = 20;
const pageOf = (m: { page: number; totalPages: number; total: number } | undefined, onPage: (p: number) => void) => (m ? { page: m.page, totalPages: m.totalPages, total: m.total, limit: LIMIT, onPage } : undefined);
const statusBadge = (map: Record<string, { label: string; tone: 'g' | 'o' | 'r' | 'x' | 'b' }>, k: string) => {
  const m = map[k] ?? { label: k, tone: 'x' as const };
  return <StatusBadge tone={m.tone}>{m.label}</StatusBadge>;
};

/* ============================ Cộng đồng hiển thị ============================ */

export function ListedView() {
  const navigate = useNavigate();
  const t = useTableState({ category: '', sort: '' }, '');
  const summary = useAdminData<ListedSummary>('discovery', '/discovery/communities/summary');
  const cats = useAdminData<AdminCategory[]>('discovery', '/discovery/categories');
  const list = useAdminList<AdminListedCommunity>('discovery-listed', '/discovery/communities', { q: t.q || undefined, status: t.tab || undefined, category: t.f.category || undefined, sort: t.f.sort || undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;

  const setStatus = (c: AdminListedCommunity, status: 'listed' | 'hidden' | 'unlisted', o: { icon: string; title: string; body: string; cta: string; ok: string; danger?: boolean }) =>
    slot.show((close) => (
      <ActionDialog
        icon={o.icon}
        danger={o.danger}
        title={o.title}
        body={`${c.name}. ${o.body}`}
        cta={o.cta}
        reasons={status === 'listed' ? undefined : opts(['Chất lượng thấp', 'Vi phạm chính sách', 'Theo yêu cầu chủ sở hữu', 'Khác'])}
        noteLabel="Ghi chú (tùy chọn)"
        successMessage={o.ok}
        run={(v) => act.mutateAsync({ path: `/discovery/communities/${c.id}/status`, body: { status, reason: [v.reason, v.note].filter(Boolean).join(' — ') || undefined } })}
        onClose={close}
      />
    ));
  const feature = (c: AdminListedCommunity) =>
    slot.show((close) => <ActionDialog icon="star" title="Đưa lên nổi bật?" body={`${c.name} sẽ được thêm vào mục "Cộng đồng nổi bật". Có thể chỉnh thời hạn ở trang Nổi bật.`} cta="Đưa lên nổi bật" successMessage="Đã đưa lên nổi bật" run={() => act.mutateAsync({ path: `/discovery/communities/${c.id}/feature`, body: { section: 'featured' } })} onClose={close} />);
  const unfeature = (c: AdminListedCommunity) =>
    slot.show((close) => <ActionDialog icon="star_border" title="Bỏ nổi bật?" body={`${c.name} sẽ được gỡ khỏi mọi mục nổi bật.`} cta="Bỏ nổi bật" successMessage="Đã bỏ nổi bật" run={() => act.mutateAsync({ path: `/discovery/communities/${c.id}/unfeature`, body: {} })} onClose={close} />);

  const columns: Column<AdminListedCommunity>[] = [
    { key: 'name', label: 'Cộng đồng', w: 2, render: (c) => <MainCell name={c.name} sub={`/${c.slug}`} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'cat', label: 'Danh mục', render: (c) => <TextCell>{c.categoryLabel}</TextCell> },
    { key: 'members', label: 'Thành viên', render: (c) => <NumCell>{fmtNum(c.members)}</NumCell> },
    {
      key: 'growth',
      label: 'Tăng trưởng',
      w: 0.8,
      render: (c) => <span className={`text-[13.5px] font-semibold tabular-nums ${c.growthPct < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]'}`}>{`${c.growthPct >= 0 ? '+' : ''}${c.growthPct}%`}</span>,
    },
    { key: 'eng', label: 'Tương tác', w: 1.1, render: (c) => <BarCell pct={c.engagementPct} /> },
    { key: 'rating', label: 'Đánh giá', w: 0.7, render: (c) => <NumCell>{c.ratingCount ? `${c.rating.toFixed(1)}★` : '—'}</NumCell> },
    { key: 'status', label: 'Trạng thái khám phá', w: 1.2, render: (c) => statusBadge(LISTED_STATUS, c.discoveryStatus) },
  ];
  const actions = (c: AdminListedCommunity): RowAction[] => {
    const a: RowAction[] = [];
    if (c.discoveryStatus === 'listed') a.push({ label: 'Đưa lên nổi bật', icon: 'star', onClick: () => feature(c) });
    if (c.discoveryStatus === 'featured') a.push({ label: 'Bỏ nổi bật', icon: 'star_border', onClick: () => unfeature(c) });
    if (c.discoveryStatus === 'hidden' || c.discoveryStatus === 'unlisted') a.push({ label: 'Hiển thị lại', icon: 'visibility', onClick: () => setStatus(c, 'listed', { icon: 'visibility', title: 'Hiển thị lại trong Khám phá?', body: 'Cộng đồng sẽ xuất hiện trở lại ở trang Khám phá.', cta: 'Hiển thị lại', ok: 'Đã hiển thị lại' }) });
    if (c.discoveryStatus === 'listed' || c.discoveryStatus === 'featured') a.push({ label: 'Ẩn', icon: 'visibility_off', onClick: () => setStatus(c, 'hidden', { icon: 'visibility_off', title: 'Ẩn khỏi Khám phá?', body: 'Vẫn truy cập được bằng liên kết trực tiếp.', cta: 'Ẩn', ok: 'Đã ẩn khỏi Khám phá' }) });
    if (c.discoveryStatus !== 'unlisted') a.push({ label: 'Gỡ khỏi Khám phá', icon: 'remove_circle', danger: true, onClick: () => setStatus(c, 'unlisted', { icon: 'remove_circle', danger: true, title: 'Gỡ khỏi Khám phá?', body: 'Cộng đồng sẽ bị gỡ khỏi trang Khám phá và các mục nổi bật.', cta: 'Gỡ khỏi Khám phá', ok: 'Đã gỡ khỏi Khám phá' }) });
    a.push({ label: 'Xem chi tiết', icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title="Cộng đồng hiển thị" subtitle="Cộng đồng hiển thị trong trang Khám phá." />
      <DataTable<AdminListedCommunity>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'listed', label: 'Đang hiển thị', count: s?.listed },
          { key: 'featured', label: 'Nổi bật', count: s?.featured },
          { key: 'hidden', label: 'Đã ẩn', count: s?.hidden },
          { key: 'unlisted', label: 'Gỡ khỏi khám phá', count: s?.unlisted },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm cộng đồng đang hiển thị...' }}
        filters={[
          { key: 'category', label: 'Danh mục', value: t.f.category, options: (cats.data ?? []).map((c) => ({ value: c.key, label: c.name })), onChange: t.setFilter('category') },
          { key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'growth', label: 'Tăng trưởng' }, { value: 'engagement', label: 'Tương tác' }, { value: 'rating', label: 'Đánh giá' }, { value: 'newest', label: 'Mới nhất' }, { value: 'name', label: 'Tên A–Z' }], onChange: t.setFilter('sort') },
        ]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Danh mục ================================== */

function AddCategoryDialog({ base, existing, onClose }: { base: string; existing: string[]; onClose: () => void }) {
  const act = useAdminAction();
  const free = Object.keys(CATEGORY_DEFAULT_NAME).filter((k) => !existing.includes(k));
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <ActionDialog
      icon="add"
      title="Thêm danh mục"
      body="Danh mục sẽ xuất hiện trong bộ lọc ở trang Khám phá."
      cta="Thêm danh mục"
      disabledExtra={!key || !name.trim()}
      successMessage="Đã thêm danh mục"
      run={() => act.mutateAsync({ path: base, body: { key, name: name.trim(), description: desc.trim() || undefined } })}
      onClose={onClose}
    >
      {free.length === 0 ? (
        <div className="text-[13px] text-stone-500">Đã dùng hết các khóa danh mục có thể thêm.</div>
      ) : (
        <OptionChips
          label="Khóa danh mục"
          options={free.map((k) => ({ value: k, label: k }))}
          value={key}
          onChange={(v) => {
            setKey(v as string);
            setName(CATEGORY_DEFAULT_NAME[v as string] ?? '');
          }}
        />
      )}
      <InputField label="Tên hiển thị" value={name} onChange={setName} maxLength={60} />
      <TextAreaField label="Mô tả (tùy chọn)" value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

function EditCategoryDialog({ base, cat, onClose }: { base: string; cat: AdminCategory; onClose: () => void }) {
  const act = useAdminAction();
  const [name, setName] = useState(cat.name);
  const [desc, setDesc] = useState(cat.description ?? '');
  return (
    <ActionDialog
      icon="edit"
      title={`Sửa danh mục · ${cat.name}`}
      cta="Lưu"
      disabledExtra={!name.trim()}
      successMessage="Đã cập nhật danh mục"
      run={() => act.mutateAsync({ method: 'PATCH', path: `${base}/${cat.key}`, body: { name: name.trim(), description: desc.trim() } })}
      onClose={onClose}
    >
      <InputField label="Tên hiển thị" value={name} onChange={setName} maxLength={60} />
      <TextAreaField label="Mô tả" value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

/** Dùng chung cho Khám phá và Hệ thống → Danh mục (`base` = tiền tố endpoint, cùng body/response). */
export function CategoriesView({ base = '/discovery/categories' }: { base?: string } = {}) {
  const toast = useToast();
  const q = useAdminData<AdminCategory[]>('discovery', base);
  const slot = useDialogSlot();
  const act = useAdminAction();
  const rows = q.data ?? [];

  const move = async (c: AdminCategory, direction: 'up' | 'down') => {
    try {
      await act.mutateAsync({ path: `${base}/${c.key}/move`, body: { direction } });
      toast.success('Đã cập nhật thứ tự');
    } catch (e) {
      toast.error(errMessage(e));
    }
  };
  const setActive = (c: AdminCategory, status: 'active' | 'disabled') => {
    const run = () => act.mutateAsync({ method: 'PATCH', path: `${base}/${c.key}`, body: { status } });
    if (status === 'disabled')
      slot.show((close) => <ActionDialog icon="block" danger title="Tắt danh mục?" body={`${c.name} sẽ biến mất khỏi bộ lọc ở trang Khám phá. Các cộng đồng hiện có không bị ảnh hưởng.`} cta="Tắt" successMessage="Đã tắt danh mục" run={run} onClose={close} />);
    else
      void run().then(
        () => toast.success('Đã bật danh mục'),
        (e) => toast.error(errMessage(e)),
      );
  };

  const columns: Column<AdminCategory>[] = [
    { key: 'name', label: 'Danh mục', w: 2, render: (c) => <MainCell name={c.name} sub={c.description || 'Hiển thị trong Khám phá'} shape="square" seed={c.key} /> },
    { key: 'slug', label: 'Đường dẫn', render: (c) => <MonoCell>/{c.slug}</MonoCell> },
    { key: 'comms', label: 'Cộng đồng', render: (c) => <NumCell>{fmtNum(c.communities)}</NumCell> },
    { key: 'status', label: 'Trạng thái', render: (c) => statusBadge(CONTENT_STATUS, c.status) },
    { key: 'order', label: 'Thứ tự', w: 0.6, render: (c) => <NumCell>{c.position}</NumCell> },
  ];
  const actions = (c: AdminCategory): RowAction[] => {
    const i = rows.findIndex((r) => r.key === c.key);
    return [
      { label: 'Sửa', onClick: () => slot.show((close) => <EditCategoryDialog base={base} cat={c} onClose={close} />) },
      { label: 'Chuyển lên', icon: 'arrow_upward', disabled: i <= 0, onClick: () => void move(c, 'up') },
      { label: 'Chuyển xuống', icon: 'arrow_downward', disabled: i === rows.length - 1, onClick: () => void move(c, 'down') },
      c.status === 'disabled' ? { label: 'Bật', icon: 'check_circle', onClick: () => setActive(c, 'active') } : { label: 'Tắt', icon: 'block', danger: true, onClick: () => setActive(c, 'disabled') },
    ];
  };

  return (
    <>
      <PageHeader
        title="Danh mục"
        subtitle="Danh mục dùng để sắp xếp cộng đồng trong Khám phá."
        actions={
          <AdminButton kind="primary" icon="add" disabled={q.isPending} onClick={() => slot.show((close) => <AddCategoryDialog base={base} existing={rows.map((r) => r.key)} onClose={close} />)}>
            Thêm
          </AdminButton>
        }
      />
      <DataTable<AdminCategory> columns={columns} rows={rows} rowKey={(c) => c.key} loading={q.isPending} error={q.isError ? q.error : null} onRetry={() => void q.refetch()} actions={actions} emptyText="Chưa có danh mục nào." />
      {slot.el}
    </>
  );
}

/* ================================== Nổi bật ================================== */

function FeaturedSectionCard({ section, candidates }: { section: FeaturedSection; candidates: AdminListedCommunity[] }) {
  const toast = useToast();
  const act = useAdminAction();
  const { openMenu, menuEl } = useMenu();
  const [busy, setBusy] = useState(false);
  const label = FEATURED_LABEL[section.key] ?? section.label;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const ids = section.items.map((x) => x.id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    void run(() => act.mutateAsync({ path: `/discovery/featured/${section.key}/reorder`, body: { entryIds: ids } }), 'Đã cập nhật thứ hạng');
  };

  const onAdd = (e: React.MouseEvent<HTMLElement>) => {
    const inSection = new Set(section.items.map((x) => x.community.id));
    const items: MenuItem[] = candidates
      .filter((c) => !inSection.has(c.id))
      .map((c) => ({
        label: c.name,
        sub: c.categoryLabel,
        onClick: () => void run(() => act.mutateAsync({ path: '/discovery/featured', body: { section: section.key, courseId: c.id } }), `Đã thêm vào ${label}`),
      }));
    if (items.length === 0) {
      toast.error('Không còn cộng đồng nào đủ điều kiện để thêm.');
      return;
    }
    openMenu(e, items, `THÊM VÀO ${label.toUpperCase()}`, 280);
  };

  // Ngày chọn được lưu theo UTC (đầu ngày / cuối ngày) để hiển thị lại đúng ngày đã chọn, không lệch múi giờ.
  const dateIso = (v: string, end?: boolean) => (v ? `${v}T${end ? '23:59:59' : '00:00:00'}.000Z` : null);

  return (
    <>
      <FeaturedCard
        title={label}
        sub={`${section.items.length} cộng đồng · dùng mũi tên để xếp hạng`}
        busy={busy}
        rows={section.items.map((x) => ({
          id: x.id,
          name: x.community.name,
          meta: `${x.community.categoryLabel} · ${fmtNum(x.community.members)} thành viên${x.active ? '' : ' · Ngoài thời hạn'}`,
          start: toDateInput(x.startsAt),
          end: toDateInput(x.endsAt),
        }))}
        onMove={move}
        onRemove={(r) => void run(() => act.mutateAsync({ method: 'DELETE', path: `/discovery/featured/${r.id}` }), `Đã gỡ khỏi ${label}`)}
        onDates={(r, start, end) => void run(() => act.mutateAsync({ method: 'PATCH', path: `/discovery/featured/${r.id}`, body: { startsAt: dateIso(start), endsAt: dateIso(end, true) } }), 'Đã cập nhật thời hạn')}
        onAdd={onAdd}
      />
      {menuEl}
    </>
  );
}

export function FeaturedView() {
  const q = useAdminData<{ sections: FeaturedSection[] }>('discovery', '/discovery/featured');
  const cands = useAdminList<AdminListedCommunity>('discovery-candidates', '/discovery/communities', { status: 'listed,featured', limit: 100 });
  const sections = q.data?.sections ?? [];
  const candidates = cands.data?.data ?? [];

  const pairs: FeaturedSection[][] = [];
  for (let i = 0; i < sections.length; i += 2) pairs.push(sections.slice(i, i + 2));

  return (
    <>
      <PageHeader title="Nổi bật" subtitle="Chọn những gì thành viên thấy đầu tiên ở trang Khám phá." />
      {q.isPending && <LoadingBlock />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {pairs.map((pair, i) => (
        <Row key={i} cols="1fr 1fr">
          {pair.map((s) => (
            <FeaturedSectionCard key={s.key} section={s} candidates={candidates} />
          ))}
        </Row>
      ))}
    </>
  );
}

/* ================================== Xếp hạng ================================== */

const FACTOR_KEYS: (keyof RankingWeights)[] = ['memberGrowth', 'engagement', 'retention', 'rating', 'revenue', 'reportPenalty'];

export function RankingsView() {
  const slot = useDialogSlot();
  const act = useAdminAction();
  const q = useAdminData<RankingsData>('discovery', '/discovery/rankings');
  const [draft, setDraft] = useState<RankingWeights | null>(null);
  const d = q.data;
  const weights = draft ?? d?.weights;

  const preview = useQuery({
    queryKey: ['admin', 'discovery-rank-preview', draft],
    queryFn: () => apiPost<{ data: { preview: RankingRow[] } }>('/admin/discovery/rankings/preview', { weights: draft }).then((r) => r.data.preview),
    enabled: !!draft,
    placeholderData: keepPreviousData,
  });
  const rows = draft ? (preview.data ?? d?.preview ?? []) : (d?.preview ?? []);

  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !d || !weights) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const total = FACTOR_KEYS.reduce((a, k) => a + weights[k], 0);
  const changed = !!draft && FACTOR_KEYS.some((k) => draft[k] !== d.weights[k]);

  const publish = () =>
    slot.show((close) => (
      <ActionDialog
        icon="publish"
        title="Áp dụng xếp hạng?"
        body="Trọng số mới được lưu và dùng ngay cho thứ tự cộng đồng trong Khám phá."
        cta="Áp dụng xếp hạng"
        noteLabel="Ghi chú (tùy chọn)"
        successMessage="Đã áp dụng xếp hạng"
        run={async (v) => {
          await act.mutateAsync({ method: 'PUT', path: '/discovery/rankings', body: { weights: draft, note: v.note || undefined } });
          setDraft(null);
        }}
        onClose={close}
      />
    ));
  const reset = () =>
    slot.show((close) => (
      <ActionDialog
        icon="restart_alt"
        title="Đặt lại trọng số?"
        body="Trọng số quay về mặc định và được áp dụng ngay."
        cta="Đặt lại"
        successMessage="Đã đặt lại trọng số"
        run={async () => {
          await act.mutateAsync({ path: '/discovery/rankings/reset' });
          setDraft(null);
        }}
        onClose={close}
      />
    ));

  const cols: Column<RankingRow>[] = [
    { key: 'rank', label: 'Hạng', w: 0.5, render: (r) => <NumCell>{r.rank}</NumCell> },
    { key: 'name', label: 'Cộng đồng', w: 2, render: (r) => <MainCell name={r.name} sub={r.id} shape="square" avatarSrc={r.thumbnail} seed={r.id} /> },
    { key: 'score', label: 'Điểm', render: (r) => <NumCell>{r.score.toFixed(1)}</NumCell> },
    { key: 'cat', label: 'Danh mục', render: (r) => <TextCell>{r.categoryLabel}</TextCell> },
  ];

  return (
    <>
      <PageHeader
        title="Xếp hạng"
        subtitle="Cấu hình cách thuật toán xếp hạng cộng đồng trong Khám phá."
        actions={
          <>
            <AdminButton icon="restart_alt" onClick={reset}>
              Đặt lại trọng số
            </AdminButton>
            <AdminButton kind="primary" icon="publish" disabled={!changed} onClick={publish}>
              Áp dụng xếp hạng
            </AdminButton>
          </>
        }
      />
      <Row cols="1fr 1.3fr">
        <FactorsCard
          title="Yếu tố xếp hạng"
          sub={`Trọng số · tổng ${total}%${d.updatedAt ? ` · cập nhật ${formatDateTime(d.updatedAt)}${d.updatedBy ? ` bởi ${d.updatedBy.name}` : ''}` : ''}${changed ? ' · chưa áp dụng' : ''}`}
          items={FACTOR_KEYS.map((k) => ({ key: k, label: FACTOR_LABEL[k], value: weights[k], penalty: k === 'reportPenalty' }))}
          onChange={(key, value) => setDraft({ ...weights, [key]: value })}
        />
        <DataTable<RankingRow>
          title="Xem trước xếp hạng"
          sub={draft ? (preview.isFetching ? 'Đang tính theo trọng số mới…' : 'Kết quả theo trọng số đang chỉnh (chưa áp dụng)') : 'Kết quả theo trọng số đã áp dụng'}
          columns={cols}
          rows={rows.slice(0, 50)}
          rowKey={(r) => r.id}
          error={draft && preview.isError ? preview.error : null}
          onRetry={() => void preview.refetch()}
          emptyText="Chưa có cộng đồng nào để xếp hạng."
          footerNote={rows.length > 50 ? `Hiển thị 50 / ${rows.length} cộng đồng` : undefined}
        />
      </Row>
      {rows.length === 0 && !draft && <EmptyBlock>Chưa có dữ liệu xếp hạng.</EmptyBlock>}
      {slot.el}
    </>
  );
}


/* ============================ Hiển thị tìm kiếm ============================ */

export function SearchVisibilityView() {
  const navigate = useNavigate();
  const t = useTableState({ sort: '' }, '');
  const summary = useAdminData<SearchVisSummary>('discovery', '/discovery/search-visibility/summary');
  const list = useAdminList<AdminSearchVisibility>('discovery-seo', '/discovery/search-visibility', { q: t.q || undefined, searchStatus: t.tab || undefined, sort: t.f.sort || undefined, page: t.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;

  const set = (c: AdminSearchVisibility, visibility: SearchVis) => {
    const o = {
      searchable: { icon: 'search', title: 'Cho phép tìm kiếm?', body: 'Cộng đồng hiển thị bình thường trong kết quả tìm kiếm.', cta: 'Cho phép', ok: 'Đã cho phép tìm kiếm', danger: false },
      reduced: { icon: 'trending_down', title: 'Giảm hiển thị?', body: 'Cộng đồng xếp sau các kết quả bình thường.', cta: 'Giảm hiển thị', ok: 'Đã giảm hiển thị', danger: false },
      hidden: { icon: 'search_off', title: 'Ẩn khỏi tìm kiếm?', body: 'Cộng đồng bị loại khỏi kết quả tìm kiếm trên nền tảng.', cta: 'Ẩn khỏi tìm kiếm', ok: 'Đã ẩn khỏi tìm kiếm', danger: true },
    }[visibility];
    slot.show((close) => (
      <ActionDialog
        icon={o.icon}
        danger={o.danger}
        title={o.title}
        body={`${c.name}. ${o.body}`}
        cta={o.cta}
        reasons={visibility === 'searchable' ? undefined : opts(['Chất lượng thấp', 'Vi phạm chính sách', 'Spam', 'Khác'])}
        noteLabel="Ghi chú (tùy chọn)"
        successMessage={o.ok}
        run={(v) => act.mutateAsync({ path: `/discovery/communities/${c.id}/search-visibility`, body: { visibility, reason: [v.reason, v.note].filter(Boolean).join(' — ') || undefined } })}
        onClose={close}
      />
    ));
  };

  const columns: Column<AdminSearchVisibility>[] = [
    { key: 'name', label: 'Cộng đồng', w: 2, render: (c) => <MainCell name={c.name} sub={c.id} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'search', label: 'Trạng thái tìm kiếm', w: 1.2, render: (c) => statusBadge(SEARCH_VIS, c.searchVisibility) },
    { key: 'disc', label: 'Trạng thái khám phá', w: 1.2, render: (c) => statusBadge(LISTED_STATUS, c.discoveryStatus) },
    { key: 'quality', label: 'Điểm chất lượng', w: 1.2, render: (c) => <BarCell pct={c.qualityScore} /> },
    { key: 'viol', label: 'Vi phạm', w: 0.7, render: (c) => <NumCell>{c.violations}</NumCell> },
    { key: 'members', label: 'Thành viên', w: 0.8, render: (c) => <MutedCell>{fmtNum(c.members)}</MutedCell> },
  ];
  const actions = (c: AdminSearchVisibility): RowAction[] => {
    const a: RowAction[] = [];
    if (c.searchVisibility !== 'searchable') a.push({ label: 'Cho phép tìm kiếm', icon: 'search', onClick: () => set(c, 'searchable') });
    if (c.searchVisibility !== 'reduced') a.push({ label: 'Giảm hiển thị', icon: 'trending_down', onClick: () => set(c, 'reduced') });
    if (c.searchVisibility !== 'hidden') a.push({ label: 'Ẩn khỏi tìm kiếm', icon: 'search_off', danger: true, onClick: () => set(c, 'hidden') });
    a.push({ label: 'Xem chi tiết', icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title="Hiển thị tìm kiếm" subtitle="Điều chỉnh cách cộng đồng hiển thị trong tìm kiếm." />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'travel_explore', label: 'Tổng cộng đồng', value: fmtNum(s.total) },
            { icon: 'search', label: 'Cho phép tìm kiếm', value: fmtNum(s.searchable) },
            { icon: 'trending_down', label: 'Giảm hiển thị', value: fmtNum(s.reduced), bad: true },
            { icon: 'search_off', label: 'Đã ẩn', value: fmtNum(s.hidden), bad: true },
          ]}
        />
      )}
      <DataTable<AdminSearchVisibility>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: 'Tất cả', count: s?.total },
          { key: 'searchable', label: 'Cho phép tìm kiếm', count: s?.searchable },
          { key: 'reduced', label: 'Giảm hiển thị', count: s?.reduced },
          { key: 'hidden', label: 'Đã ẩn', count: s?.hidden },
        ]}
        tab={t.tab}
        onTab={t.onTab}
        search={{ value: t.q, onChange: t.onQ, placeholder: 'Tìm cộng đồng...' }}
        filters={[{ key: 'sort', label: 'Sắp xếp', value: t.f.sort, options: [{ value: 'quality', label: 'Điểm chất lượng thấp nhất' }, { value: 'violations', label: 'Nhiều vi phạm nhất' }, { value: 'name', label: 'Tên A–Z' }], onChange: t.setFilter('sort') }]}
        onClearFilters={t.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={actions}
        page={pageOf(list.data?.meta, t.setPage)}
      />
      {slot.el}
    </>
  );
}
