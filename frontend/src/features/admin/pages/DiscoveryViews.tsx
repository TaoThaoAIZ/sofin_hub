import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('admin-discovery');
  const navigate = useNavigate();
  const ts = useTableState({ category: '', sort: '' }, '');
  const summary = useAdminData<ListedSummary>('discovery', '/discovery/communities/summary');
  const cats = useAdminData<AdminCategory[]>('discovery', '/discovery/categories');
  const list = useAdminList<AdminListedCommunity>('discovery-listed', '/discovery/communities', { q: ts.q || undefined, status: ts.tab || undefined, category: ts.f.category || undefined, sort: ts.f.sort || undefined, page: ts.page, limit: LIMIT });
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
        reasons={status === 'listed' ? undefined : opts([t('common.lowQuality'), t('common.policyViolation'), t('listed.reasonOwnerRequest'), t('common.other')])}
        noteLabel={t('common.noteOptional')}
        successMessage={o.ok}
        run={(v) => act.mutateAsync({ path: `/discovery/communities/${c.id}/status`, body: { status, reason: [v.reason, v.note].filter(Boolean).join(' — ') || undefined } })}
        onClose={close}
      />
    ));
  const feature = (c: AdminListedCommunity) =>
    slot.show((close) => <ActionDialog icon="star" title={t('listed.featureTitle')} body={t('listed.featureBody', { name: c.name })} cta={t('listed.featureCta')} successMessage={t('listed.featured')} run={() => act.mutateAsync({ path: `/discovery/communities/${c.id}/feature`, body: { section: 'featured' } })} onClose={close} />);
  const unfeature = (c: AdminListedCommunity) =>
    slot.show((close) => <ActionDialog icon="star_border" title={t('listed.unfeatureTitle')} body={t('listed.unfeatureBody', { name: c.name })} cta={t('listed.unfeatureCta')} successMessage={t('listed.unfeatured')} run={() => act.mutateAsync({ path: `/discovery/communities/${c.id}/unfeature`, body: {} })} onClose={close} />);

  const columns: Column<AdminListedCommunity>[] = [
    { key: 'name', label: t('common.community'), w: 2, render: (c) => <MainCell name={c.name} sub={`/${c.slug}`} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'cat', label: t('common.category'), render: (c) => <TextCell>{c.categoryLabel}</TextCell> },
    { key: 'members', label: t('common.members'), render: (c) => <NumCell>{fmtNum(c.members)}</NumCell> },
    {
      key: 'growth',
      label: t('common.growth'),
      w: 0.8,
      render: (c) => <span className={`text-[13.5px] font-semibold tabular-nums ${c.growthPct < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]'}`}>{`${c.growthPct >= 0 ? '+' : ''}${c.growthPct}%`}</span>,
    },
    { key: 'eng', label: t('common.engagement'), w: 1.1, render: (c) => <BarCell pct={c.engagementPct} /> },
    { key: 'rating', label: t('common.rating'), w: 0.7, render: (c) => <NumCell>{c.ratingCount ? `${c.rating.toFixed(1)}★` : '—'}</NumCell> },
    { key: 'status', label: t('common.discoveryStatus'), w: 1.2, render: (c) => statusBadge(LISTED_STATUS, c.discoveryStatus) },
  ];
  const actions = (c: AdminListedCommunity): RowAction[] => {
    const a: RowAction[] = [];
    if (c.discoveryStatus === 'listed') a.push({ label: t('listed.featureCta'), icon: 'star', onClick: () => feature(c) });
    if (c.discoveryStatus === 'featured') a.push({ label: t('listed.unfeatureCta'), icon: 'star_border', onClick: () => unfeature(c) });
    if (c.discoveryStatus === 'hidden' || c.discoveryStatus === 'unlisted') a.push({ label: t('listed.showAgain'), icon: 'visibility', onClick: () => setStatus(c, 'listed', { icon: 'visibility', title: t('listed.showAgainTitle'), body: t('listed.showAgainBody'), cta: t('listed.showAgain'), ok: t('listed.shownAgain') }) });
    if (c.discoveryStatus === 'listed' || c.discoveryStatus === 'featured') a.push({ label: t('common.hide'), icon: 'visibility_off', onClick: () => setStatus(c, 'hidden', { icon: 'visibility_off', title: t('listed.hideTitle'), body: t('listed.hideBody'), cta: t('common.hide'), ok: t('listed.hiddenFromDiscover') }) });
    if (c.discoveryStatus !== 'unlisted') a.push({ label: t('listed.remove'), icon: 'remove_circle', danger: true, onClick: () => setStatus(c, 'unlisted', { icon: 'remove_circle', danger: true, title: t('listed.removeTitle'), body: t('listed.removeBody'), cta: t('listed.remove'), ok: t('listed.removed') }) });
    a.push({ label: t('common.viewDetails'), icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('listed.pageTitle')} subtitle={t('listed.pageSubtitle')} />
      <DataTable<AdminListedCommunity>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'listed', label: t('listed.tabVisible'), count: s?.listed },
          { key: 'featured', label: t('common.featured'), count: s?.featured },
          { key: 'hidden', label: t('common.hidden'), count: s?.hidden },
          { key: 'unlisted', label: t('listed.tabUnlisted'), count: s?.unlisted },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('listed.searchPlaceholder') }}
        filters={[
          { key: 'category', label: t('common.category'), value: ts.f.category, options: (cats.data ?? []).map((c) => ({ value: c.key, label: c.name })), onChange: ts.setFilter('category') },
          { key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'growth', label: t('common.growth') }, { value: 'engagement', label: t('common.engagement') }, { value: 'rating', label: t('common.rating') }, { value: 'newest', label: t('common.newest') }, { value: 'name', label: t('common.nameAZ') }], onChange: ts.setFilter('sort') },
        ]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}

/* ================================== Danh mục ================================== */

function AddCategoryDialog({ base, existing, onClose }: { base: string; existing: string[]; onClose: () => void }) {
  const { t } = useTranslation('admin-discovery');
  const act = useAdminAction();
  const free = Object.keys(CATEGORY_DEFAULT_NAME).filter((k) => !existing.includes(k));
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  return (
    <ActionDialog
      icon="add"
      title={t('categories.addTitle')}
      body={t('categories.addBody')}
      cta={t('categories.addTitle')}
      disabledExtra={!key || !name.trim()}
      successMessage={t('categories.added')}
      run={() => act.mutateAsync({ path: base, body: { key, name: name.trim(), description: desc.trim() || undefined } })}
      onClose={onClose}
    >
      {free.length === 0 ? (
        <div className="text-[13px] text-stone-500">{t('categories.allKeysUsed')}</div>
      ) : (
        <OptionChips
          label={t('categories.key')}
          options={free.map((k) => ({ value: k, label: k }))}
          value={key}
          onChange={(v) => {
            setKey(v as string);
            setName(CATEGORY_DEFAULT_NAME[v as string] ?? '');
          }}
        />
      )}
      <InputField label={t('categories.displayName')} value={name} onChange={setName} maxLength={60} />
      <TextAreaField label={t('categories.descriptionOptional')} value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

function EditCategoryDialog({ base, cat, onClose }: { base: string; cat: AdminCategory; onClose: () => void }) {
  const { t } = useTranslation('admin-discovery');
  const act = useAdminAction();
  const [name, setName] = useState(cat.name);
  const [desc, setDesc] = useState(cat.description ?? '');
  return (
    <ActionDialog
      icon="edit"
      title={t('categories.editTitle', { name: cat.name })}
      cta={t('common.save')}
      disabledExtra={!name.trim()}
      successMessage={t('categories.updated')}
      run={() => act.mutateAsync({ method: 'PATCH', path: `${base}/${cat.key}`, body: { name: name.trim(), description: desc.trim() } })}
      onClose={onClose}
    >
      <InputField label={t('categories.displayName')} value={name} onChange={setName} maxLength={60} />
      <TextAreaField label={t('common.description')} value={desc} onChange={setDesc} maxLength={300} />
    </ActionDialog>
  );
}

/** Dùng chung cho Khám phá và Hệ thống → Danh mục (`base` = tiền tố endpoint, cùng body/response). */
export function CategoriesView({ base = '/discovery/categories' }: { base?: string } = {}) {
  const { t } = useTranslation('admin-discovery');
  const toast = useToast();
  const q = useAdminData<AdminCategory[]>('discovery', base);
  const slot = useDialogSlot();
  const act = useAdminAction();
  const rows = q.data ?? [];

  const move = async (c: AdminCategory, direction: 'up' | 'down') => {
    try {
      await act.mutateAsync({ path: `${base}/${c.key}/move`, body: { direction } });
      toast.success(t('categories.orderUpdated'));
    } catch (e) {
      toast.error(errMessage(e));
    }
  };
  const setActive = (c: AdminCategory, status: 'active' | 'disabled') => {
    const run = () => act.mutateAsync({ method: 'PATCH', path: `${base}/${c.key}`, body: { status } });
    if (status === 'disabled')
      slot.show((close) => <ActionDialog icon="block" danger title={t('categories.disableTitle')} body={t('categories.disableBody', { name: c.name })} cta={t('common.disable')} successMessage={t('categories.disabled')} run={run} onClose={close} />);
    else
      void run().then(
        () => toast.success(t('categories.enabled')),
        (e) => toast.error(errMessage(e)),
      );
  };

  const columns: Column<AdminCategory>[] = [
    { key: 'name', label: t('common.category'), w: 2, render: (c) => <MainCell name={c.name} sub={c.description || t('categories.shownInDiscover')} shape="square" seed={c.key} /> },
    { key: 'slug', label: t('categories.path'), render: (c) => <MonoCell>/{c.slug}</MonoCell> },
    { key: 'comms', label: t('common.community'), render: (c) => <NumCell>{fmtNum(c.communities)}</NumCell> },
    { key: 'status', label: t('common.status'), render: (c) => statusBadge(CONTENT_STATUS, c.status) },
    { key: 'order', label: t('categories.order'), w: 0.6, render: (c) => <NumCell>{c.position}</NumCell> },
  ];
  const actions = (c: AdminCategory): RowAction[] => {
    const i = rows.findIndex((r) => r.key === c.key);
    return [
      { label: t('common.edit'), onClick: () => slot.show((close) => <EditCategoryDialog base={base} cat={c} onClose={close} />) },
      { label: t('categories.moveUp'), icon: 'arrow_upward', disabled: i <= 0, onClick: () => void move(c, 'up') },
      { label: t('categories.moveDown'), icon: 'arrow_downward', disabled: i === rows.length - 1, onClick: () => void move(c, 'down') },
      c.status === 'disabled' ? { label: t('common.enable'), icon: 'check_circle', onClick: () => setActive(c, 'active') } : { label: t('common.disable'), icon: 'block', danger: true, onClick: () => setActive(c, 'disabled') },
    ];
  };

  return (
    <>
      <PageHeader
        title={t('common.categoriesTitle2')}
        subtitle={t('categories.pageSubtitle')}
        actions={
          <AdminButton kind="primary" icon="add" disabled={q.isPending} onClick={() => slot.show((close) => <AddCategoryDialog base={base} existing={rows.map((r) => r.key)} onClose={close} />)}>
            {t('common.add')}
          </AdminButton>
        }
      />
      <DataTable<AdminCategory> columns={columns} rows={rows} rowKey={(c) => c.key} loading={q.isPending} error={q.isError ? q.error : null} onRetry={() => void q.refetch()} actions={actions} emptyText={t('categories.empty')} />
      {slot.el}
    </>
  );
}

/* ================================== Nổi bật ================================== */

function FeaturedSectionCard({ section, candidates }: { section: FeaturedSection; candidates: AdminListedCommunity[] }) {
  const { t } = useTranslation('admin-discovery');
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
    void run(() => act.mutateAsync({ path: `/discovery/featured/${section.key}/reorder`, body: { entryIds: ids } }), t('featured.rankingUpdated'));
  };

  const onAdd = (e: React.MouseEvent<HTMLElement>) => {
    const inSection = new Set(section.items.map((x) => x.community.id));
    const items: MenuItem[] = candidates
      .filter((c) => !inSection.has(c.id))
      .map((c) => ({
        label: c.name,
        sub: c.categoryLabel,
        onClick: () => void run(() => act.mutateAsync({ path: '/discovery/featured', body: { section: section.key, courseId: c.id } }), t('featured.added', { label })),
      }));
    if (items.length === 0) {
      toast.error(t('featured.noCandidates'));
      return;
    }
    openMenu(e, items, t('featured.menuTitle', { label: label.toUpperCase() }), 280);
  };

  // Ngày chọn được lưu theo UTC (đầu ngày / cuối ngày) để hiển thị lại đúng ngày đã chọn, không lệch múi giờ.
  const dateIso = (v: string, end?: boolean) => (v ? `${v}T${end ? '23:59:59' : '00:00:00'}.000Z` : null);

  return (
    <>
      <FeaturedCard
        title={label}
        sub={t('featured.subtitle', { n: section.items.length })}
        busy={busy}
        rows={section.items.map((x) => ({
          id: x.id,
          name: x.community.name,
          meta: t(x.active ? 'featured.meta' : 'featured.metaOutOfRange', { category: x.community.categoryLabel, members: fmtNum(x.community.members) }),
          start: toDateInput(x.startsAt),
          end: toDateInput(x.endsAt),
        }))}
        onMove={move}
        onRemove={(r) => void run(() => act.mutateAsync({ method: 'DELETE', path: `/discovery/featured/${r.id}` }), t('featured.removed', { label }))}
        onDates={(r, start, end) => void run(() => act.mutateAsync({ method: 'PATCH', path: `/discovery/featured/${r.id}`, body: { startsAt: dateIso(start), endsAt: dateIso(end, true) } }), t('featured.durationUpdated'))}
        onAdd={onAdd}
      />
      {menuEl}
    </>
  );
}

export function FeaturedView() {
  const { t } = useTranslation('admin-discovery');
  const q = useAdminData<{ sections: FeaturedSection[] }>('discovery', '/discovery/featured');
  const cands = useAdminList<AdminListedCommunity>('discovery-candidates', '/discovery/communities', { status: 'listed,featured', limit: 100 });
  const sections = q.data?.sections ?? [];
  const candidates = cands.data?.data ?? [];

  const pairs: FeaturedSection[][] = [];
  for (let i = 0; i < sections.length; i += 2) pairs.push(sections.slice(i, i + 2));

  return (
    <>
      <PageHeader title={t('common.featured')} subtitle={t('featured.pageSubtitle')} />
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
  const { t } = useTranslation('admin-discovery');
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
        title={t('rankings.applyTitle')}
        body={t('rankings.applyBody')}
        cta={t('rankings.apply')}
        noteLabel={t('common.noteOptional')}
        successMessage={t('rankings.applied')}
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
        title={t('rankings.resetTitle')}
        body={t('rankings.resetBody')}
        cta={t('rankings.resetCta')}
        successMessage={t('rankings.resetDone')}
        run={async () => {
          await act.mutateAsync({ path: '/discovery/rankings/reset' });
          setDraft(null);
        }}
        onClose={close}
      />
    ));

  const cols: Column<RankingRow>[] = [
    { key: 'rank', label: t('rankings.rank'), w: 0.5, render: (r) => <NumCell>{r.rank}</NumCell> },
    { key: 'name', label: t('common.community'), w: 2, render: (r) => <MainCell name={r.name} sub={r.id} shape="square" avatarSrc={r.thumbnail} seed={r.id} /> },
    { key: 'score', label: t('rankings.score'), render: (r) => <NumCell>{r.score.toFixed(1)}</NumCell> },
    { key: 'cat', label: t('common.category'), render: (r) => <TextCell>{r.categoryLabel}</TextCell> },
  ];

  return (
    <>
      <PageHeader
        title={t('rankings.pageTitle')}
        subtitle={t('rankings.pageSubtitle')}
        actions={
          <>
            <AdminButton icon="restart_alt" onClick={reset}>
              {t('rankings.resetButton')}
            </AdminButton>
            <AdminButton kind="primary" icon="publish" disabled={!changed} onClick={publish}>
              {t('rankings.apply')}
            </AdminButton>
          </>
        }
      />
      <Row cols="1fr 1.3fr">
        <FactorsCard
          title={t('rankings.factors')}
          sub={t('rankings.weightsTotal', { total }) + (d.updatedAt ? t('rankings.updatedAt', { date: formatDateTime(d.updatedAt) }) + (d.updatedBy ? t('rankings.updatedBy', { name: d.updatedBy.name }) : '') : '') + (changed ? t('rankings.notApplied') : '')}
          items={FACTOR_KEYS.map((k) => ({ key: k, label: FACTOR_LABEL[k], value: weights[k], penalty: k === 'reportPenalty' }))}
          onChange={(key, value) => setDraft({ ...weights, [key]: value })}
        />
        <DataTable<RankingRow>
          title={t('rankings.preview')}
          sub={draft ? (preview.isFetching ? t('rankings.calculating') : t('rankings.previewDraft')) : t('rankings.previewApplied')}
          columns={cols}
          rows={rows.slice(0, 50)}
          rowKey={(r) => r.id}
          error={draft && preview.isError ? preview.error : null}
          onRetry={() => void preview.refetch()}
          emptyText={t('rankings.emptyRank')}
          footerNote={rows.length > 50 ? t('rankings.showing', { total: rows.length }) : undefined}
        />
      </Row>
      {rows.length === 0 && !draft && <EmptyBlock>{t('rankings.noData')}</EmptyBlock>}
      {slot.el}
    </>
  );
}


/* ============================ Hiển thị tìm kiếm ============================ */

export function SearchVisibilityView() {
  const { t } = useTranslation('admin-discovery');
  const navigate = useNavigate();
  const ts = useTableState({ sort: '' }, '');
  const summary = useAdminData<SearchVisSummary>('discovery', '/discovery/search-visibility/summary');
  const list = useAdminList<AdminSearchVisibility>('discovery-seo', '/discovery/search-visibility', { q: ts.q || undefined, searchStatus: ts.tab || undefined, sort: ts.f.sort || undefined, page: ts.page, limit: LIMIT });
  const slot = useDialogSlot();
  const act = useAdminAction();
  const s = summary.data;

  const set = (c: AdminSearchVisibility, visibility: SearchVis) => {
    const o = {
      searchable: { icon: 'search', title: t('search.allowTitle'), body: t('search.allowBody'), cta: t('search.allowCta'), ok: t('search.allowed'), danger: false },
      reduced: { icon: 'trending_down', title: t('search.reduceTitle'), body: t('search.reduceBody'), cta: t('search.reduceCta'), ok: t('search.reduced'), danger: false },
      hidden: { icon: 'search_off', title: t('search.hideTitle'), body: t('search.hideBody'), cta: t('search.hideCta'), ok: t('search.hiddenDone'), danger: true },
    }[visibility];
    slot.show((close) => (
      <ActionDialog
        icon={o.icon}
        danger={o.danger}
        title={o.title}
        body={`${c.name}. ${o.body}`}
        cta={o.cta}
        reasons={visibility === 'searchable' ? undefined : opts([t('common.lowQuality'), t('common.policyViolation'), t('common.spam'), t('common.other')])}
        noteLabel={t('common.noteOptional')}
        successMessage={o.ok}
        run={(v) => act.mutateAsync({ path: `/discovery/communities/${c.id}/search-visibility`, body: { visibility, reason: [v.reason, v.note].filter(Boolean).join(' — ') || undefined } })}
        onClose={close}
      />
    ));
  };

  const columns: Column<AdminSearchVisibility>[] = [
    { key: 'name', label: t('common.community'), w: 2, render: (c) => <MainCell name={c.name} sub={c.id} shape="square" avatarSrc={c.thumbnail} seed={c.id} /> },
    { key: 'search', label: t('search.searchStatus'), w: 1.2, render: (c) => statusBadge(SEARCH_VIS, c.searchVisibility) },
    { key: 'disc', label: t('common.discoveryStatus'), w: 1.2, render: (c) => statusBadge(LISTED_STATUS, c.discoveryStatus) },
    { key: 'quality', label: t('search.qualityScore'), w: 1.2, render: (c) => <BarCell pct={c.qualityScore} /> },
    { key: 'viol', label: t('search.violations'), w: 0.7, render: (c) => <NumCell>{c.violations}</NumCell> },
    { key: 'members', label: t('common.members'), w: 0.8, render: (c) => <MutedCell>{fmtNum(c.members)}</MutedCell> },
  ];
  const actions = (c: AdminSearchVisibility): RowAction[] => {
    const a: RowAction[] = [];
    if (c.searchVisibility !== 'searchable') a.push({ label: t('search.allowAction'), icon: 'search', onClick: () => set(c, 'searchable') });
    if (c.searchVisibility !== 'reduced') a.push({ label: t('search.reduceCta'), icon: 'trending_down', onClick: () => set(c, 'reduced') });
    if (c.searchVisibility !== 'hidden') a.push({ label: t('search.hideCta'), icon: 'search_off', danger: true, onClick: () => set(c, 'hidden') });
    a.push({ label: t('common.viewDetails'), icon: 'open_in_new', onClick: () => navigate(`/admin/communities/${c.id}`) });
    return a;
  };

  return (
    <>
      <PageHeader title={t('search.pageTitle')} subtitle={t('search.pageSubtitle')} />
      {s && (
        <KpiGrid
          min={170}
          items={[
            { icon: 'travel_explore', label: t('search.totalCommunities'), value: fmtNum(s.total) },
            { icon: 'search', label: t('search.allowedKpi'), value: fmtNum(s.searchable) },
            { icon: 'trending_down', label: t('search.reducedKpi'), value: fmtNum(s.reduced), bad: true },
            { icon: 'search_off', label: t('common.hidden'), value: fmtNum(s.hidden), bad: true },
          ]}
        />
      )}
      <DataTable<AdminSearchVisibility>
        columns={columns}
        rows={list.data?.data ?? []}
        rowKey={(c) => c.id}
        tabs={[
          { key: '', label: t('common.all'), count: s?.total },
          { key: 'searchable', label: t('search.allowedKpi'), count: s?.searchable },
          { key: 'reduced', label: t('search.reducedKpi'), count: s?.reduced },
          { key: 'hidden', label: t('common.hidden'), count: s?.hidden },
        ]}
        tab={ts.tab}
        onTab={ts.onTab}
        search={{ value: ts.q, onChange: ts.onQ, placeholder: t('search.searchPlaceholder') }}
        filters={[{ key: 'sort', label: t('common.sortBy'), value: ts.f.sort, options: [{ value: 'quality', label: t('search.lowestQuality') }, { value: 'violations', label: t('search.mostViolations') }, { value: 'name', label: t('common.nameAZ') }], onChange: ts.setFilter('sort') }]}
        onClearFilters={ts.clear}
        loading={list.isPending}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        onRow={(c) => navigate(`/admin/communities/${c.id}`)}
        actions={actions}
        page={pageOf(list.data?.meta, ts.setPage)}
      />
      {slot.el}
    </>
  );
}
