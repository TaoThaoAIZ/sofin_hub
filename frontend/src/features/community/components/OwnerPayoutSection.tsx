import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, apiDownload, apiGet, apiPost, resolveApiPath } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useMenu, useToast } from '../../admin/components/overlay';
import { useAuth } from '../../auth/AuthContext';
import { ModalActions, SettingsModal } from '../../settings/billing/Modal';
import { ConfirmDialog, errText } from './contentUi';

type RowStatus = 'due' | 'paid' | 'none';
interface PayoutRow {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  referredCount: number;
  rateBps: number;
  totalCents: number;
  dueCents: number;
  paidCents: number;
  status: RowStatus;
  /** Tài khoản nhận hoa hồng cộng tác viên đã nhập (chỉ chủ cộng đồng thấy) — null = chưa nhập. */
  account: { bankName: string; accountHolder: string; accountNumber: string } | null;
}
interface PayoutHistory {
  id: string;
  referrerId: string;
  name: string;
  avatarUrl: string | null;
  amountCents: number;
  commissionCount: number;
  note: string | null;
  paidAt: string;
}
interface Overview {
  range: { from: string; to: string };
  rateBps: number;
  kpis: {
    collaborators: { value: number; delta: number | null };
    referred: { value: number; delta: number | null };
    due: { cents: number; deltaPct: number | null };
    paid: { cents: number; deltaPct: number | null };
  };
  rows: PayoutRow[];
  meta: { total: number; page: number; pageSize: number };
  history: PayoutHistory[];
}
interface PayResult {
  results: { referrerId: string; paidCents: number; commissionCount: number; leftCents: number; reason: string }[];
  totals: { paidCents: number; paidPeople: number };
}
interface ReferrersData {
  referrers: { userId: string; name: string; referred: { userId: string; name: string; avatarUrl: string | null; joinedAt: string; status: 'paid' | 'joined' | 'none'; earnedCents: number }[] }[];
}

const PAGE_SIZE = 6;
const HISTORY_COLLAPSED = 5;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${new Date().toISOString().slice(0, 7)}-01`;
const pct = (bps: number) => `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
const deltaText = (v: number) => `${v > 0 ? '+' : ''}${v}%`;

const STATUS_STYLE: Record<RowStatus, { bg: string; fg: string }> = {
  due: { bg: '#ffedd5', fg: '#c2410c' },
  paid: { bg: '#dcfce7', fg: '#15803d' },
  none: { bg: '#f1efed', fg: '#78716c' },
};

function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const box = { width: size, height: size };
  return url ? (
    <img src={resolveApiPath(url)} alt="" style={box} className="flex-none rounded-full object-cover" />
  ) : (
    <span aria-hidden style={box} className="grid flex-none place-items-center rounded-full bg-[#fee2e2] text-[12px] font-bold text-[#b91c1c]">
      {initialsOf(name)}
    </span>
  );
}

/** Các trang hiển thị: 1 … 4 5 6 … N (gọn khi nhiều trang). */
function pageList(page: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const set = new Set([1, 2, last - 1, last, page - 1, page, page + 1].filter((n) => n >= 1 && n <= last));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
}

/** Người được một cộng tác viên mời (bấm "⋮" > Xem người được mời). */
function ReferredModal({ communityId, userId, name, onClose }: { communityId: string; userId: string; name: string; onClose: () => void }) {
  const { t } = useTranslation('community');
  const { accessToken } = useAuth();
  const q = useQuery({
    queryKey: ['community', communityId, 'referral-program', 'referrers'] as const,
    queryFn: ({ signal }) => apiGet<{ data: ReferrersData }>(`/communities/${communityId}/referral-program/referrers`, undefined, signal, { token: accessToken! }).then((r) => r.data),
  });
  const list = q.data?.referrers.find((r) => r.userId === userId)?.referred ?? [];
  const colors: Record<string, { bg: string; fg: string }> = { paid: { bg: '#dcfce7', fg: '#15803d' }, joined: { bg: '#e0f2fe', fg: '#0369a1' }, none: { bg: '#f1efed', fg: '#78716c' } };
  return (
    <SettingsModal title={t('referral.po.referredTitle', { name })} body={t('referral.po.referredBody')} onClose={onClose}>
      {q.isPending && <p className="py-3 text-center text-stone-400">{t('referral.loading')}</p>}
      {q.isError && <p role="alert" className="py-3 text-center text-[#dc2626]">{errText(q.error)}</p>}
      {q.data && list.length === 0 && <p className="rounded-xl bg-[#faf7f4] px-4 py-5 text-center text-sm text-stone-500">{t('referral.po.referredEmpty')}</p>}
      {list.length > 0 && (
        <ul className="m-0 flex max-h-[300px] list-none flex-col gap-2 overflow-y-auto p-0">
          {list.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 rounded-xl border border-[#f0ebe6] px-3.5 py-2.5 text-sm">
              <Avatar name={p.name} url={p.avatarUrl} size={34} />
              <span className="min-w-0 flex-1">
                <b className="block truncate">{p.name}</b>
                <span className="text-xs text-stone-500">{formatDate(p.joinedAt)}</span>
              </span>
              <span style={{ background: colors[p.status]!.bg, color: colors[p.status]!.fg }} className="rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap">
                {t(`referral.ol.status.${p.status}`)}
              </span>
              <b className="w-24 text-right">{p.earnedCents > 0 ? formatCents(p.earnedCents) : '—'}</b>
            </li>
          ))}
        </ul>
      )}
      <ModalActions cancelLabel={t('referral.po.close')} okLabel={t('referral.po.close')} onCancel={onClose} onOk={onClose} />
    </SettingsModal>
  );
}

/** Thông tin chuyển khoản của người sắp được chi trả (ngân hàng, số tài khoản, chủ tài khoản) để chủ cộng đồng chuyển đúng rồi mới bấm xác nhận. */
function PayeeList({ payees }: { payees: PayoutRow[] }) {
  const { t } = useTranslation('community');
  const toast = useToast();
  const copy = (text: string) => void navigator.clipboard?.writeText(text).then(() => toast.success(t('referral.po.copied')), () => undefined);
  return (
    <ul className="m-0 mt-3 flex max-h-[320px] list-none flex-col gap-2.5 overflow-y-auto p-0">
      {payees.map((r) => (
        <li key={r.userId} className="rounded-xl bg-[#faf7f4] px-4 py-3 text-[13.5px]">
          {payees.length > 1 && (
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <b className="min-w-0 truncate">{r.name}</b>
              <b className="flex-none text-brand">{formatCents(r.dueCents)}</b>
            </div>
          )}
          {r.account ? (
            <dl className="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
              <dt className="text-stone-500">{t('referral.po.payeeBank')}</dt>
              <dd className="m-0 text-right font-semibold">{r.account.bankName}</dd>
              <dt className="text-stone-500">{t('referral.po.payeeNumber')}</dt>
              <dd className="m-0 flex items-center justify-end gap-1.5 font-mono font-bold">
                {r.account.accountNumber}
                <button type="button" onClick={() => copy(r.account!.accountNumber)} aria-label={t('referral.po.copyNumber')} className="grid size-6 cursor-pointer place-items-center border-0 bg-transparent p-0 text-stone-500 hover:text-brand">
                  <MaterialIcon name="content_copy" size={16} color="currentColor" />
                </button>
              </dd>
              <dt className="text-stone-500">{t('referral.po.payeeHolder')}</dt>
              <dd className="m-0 text-right font-semibold">{r.account.accountHolder}</dd>
            </dl>
          ) : (
            <p className="m-0 flex items-start gap-2 text-[13px] text-[#b45309]">
              <MaterialIcon name="warning" size={18} filled color="currentColor" />
              <span>{t('referral.po.payeeNone', { name: r.name })}</span>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Chi trả hoa hồng cho cộng tác viên (chỉ CHỦ cộng đồng): chủ tự chuyển khoản rồi bấm "Chi trả" để ghi nhận.
 * Số liệu, bảng, lịch sử đều là dữ liệu thật; khoảng ngày lọc theo ngày phát sinh hoa hồng.
 */
export function OwnerPayoutSection({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community');
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { openMenu, menuEl } = useMenu();
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');
  const q = useDeferredValue(search.trim());
  const [status, setStatus] = useState<'all' | 'due' | 'paid'>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [histAll, setHistAll] = useState(false);
  const [confirm, setConfirm] = useState<{ payees: PayoutRow[]; amount: number } | null>(null);
  const [viewing, setViewing] = useState<{ userId: string; name: string } | null>(null);

  const rangeOk = !!from && !!to && from <= to;
  const params = { from, to, q, status, page, pageSize: PAGE_SIZE };
  const key = ['community', communityId, 'referral-payouts', params] as const;
  const query = useQuery<Overview>({
    queryKey: key,
    queryFn: ({ signal }) => apiGet<{ data: Overview }>(`/communities/${communityId}/referral-program/payouts`, params, signal, { token: accessToken! }).then((r) => r.data),
    enabled: !!accessToken && !!communityId && rangeOk,
    placeholderData: keepPreviousData,
  });
  const pay = useMutation({
    mutationFn: (ids: string[]) => apiPost<{ data: PayResult }>(`/communities/${communityId}/referral-program/payouts`, { referrerIds: ids, from, to }, { token: accessToken! }).then((r) => r.data),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['community', communityId, 'referral-payouts'] });
      void qc.invalidateQueries({ queryKey: ['community', communityId, 'referral-program'] });
      void qc.invalidateQueries({ queryKey: ['referral'] });
      setSelected(new Set());
      setConfirm(null);
      if (r.totals.paidCents > 0) toast.success(t('referral.po.paidToast', { amount: formatCents(r.totals.paidCents), n: r.totals.paidPeople }));
      else toast.error(t('referral.po.nothingToast'));
      const partial = r.results.filter((x) => x.paidCents > 0 && x.leftCents > 0).length;
      if (partial > 0) toast.error(t('referral.po.leftToast', { n: partial }));
    },
  });

  const o = query.data;
  const rows = o?.rows ?? [];
  const total = o?.meta.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const dueRows = rows.filter((r) => r.dueCents > 0);
  const allPageSelected = dueRows.length > 0 && dueRows.every((r) => selected.has(r.userId));
  const selectedDue = rows.filter((r) => selected.has(r.userId) && r.dueCents > 0);
  const selectedAmount = selectedDue.reduce((s, r) => s + r.dueCents, 0);
  // Xuất danh sách = những người còn khoản CẦN chi: chưa có ai thì không có gì để xuất (tránh file chỉ có dòng tiêu đề).
  const noDue = !o || o.kpis.due.cents <= 0;

  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const togglePage = () => setSelected((cur) => { const n = new Set(cur); if (allPageSelected) dueRows.forEach((r) => n.delete(r.userId)); else dueRows.forEach((r) => n.add(r.userId)); return n; });
  // Chọn người chỉ có nghĩa trong trang đang xem: đổi trang/bộ lọc thì bỏ chọn để số liệu "Chi trả hàng loạt" luôn khớp những dòng nhìn thấy.
  const goPage = (n: number) => {
    setPage(n);
    setSelected(new Set());
  };
  const resetPage = () => goPage(1);

  const exportCsv = async () => {
    try {
      const ids = selected.size > 0 ? `&ids=${[...selected].join(',')}` : '';
      await apiDownload(`/communities/${communityId}/referral-program/payouts/export.csv?from=${from}&to=${to}${ids}`, `thanh-toan-hoa-hong-${from}_${to}.csv`, { token: accessToken! });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('referral.po.exportFail'));
    }
  };

  const kpis = [
    { icon: 'groups', tint: 'bg-[#eaf3ff] dark:bg-[#17212d]', iconBg: '#dbeafe', iconFg: '#2563eb', label: t('referral.po.kpiCollab'), v: String(o?.kpis.collaborators.value ?? 0), delta: o?.kpis.collaborators.delta != null ? `+${o.kpis.collaborators.delta}` : '', note: t('referral.po.newInRange'), down: false },
    { icon: 'person_add', tint: 'bg-[#eafaf0] dark:bg-[#15261c]', iconBg: '#dcfce7', iconFg: '#16a34a', label: t('referral.po.kpiReferred'), v: (o?.kpis.referred.value ?? 0).toLocaleString('vi-VN'), delta: o?.kpis.referred.delta != null ? `+${o.kpis.referred.delta}` : '', note: t('referral.po.newInRange'), down: false },
    { icon: 'paid', tint: 'bg-[#fff1e6] dark:bg-[#2b1e14]', iconBg: '#ffedd5', iconFg: '#ea580c', label: t('referral.po.kpiDue'), v: formatCents(o?.kpis.due.cents ?? 0), delta: o?.kpis.due.deltaPct != null ? deltaText(o.kpis.due.deltaPct) : '', note: t('referral.po.vsPrev'), down: (o?.kpis.due.deltaPct ?? 0) < 0 },
    { icon: 'account_balance_wallet', tint: 'bg-[#f5eefe] dark:bg-[#231a2e]', iconBg: '#ede9fe', iconFg: '#7c3aed', label: t('referral.po.kpiPaid'), v: formatCents(o?.kpis.paid.cents ?? 0), delta: o?.kpis.paid.deltaPct != null ? deltaText(o.kpis.paid.deltaPct) : '', note: t('referral.po.vsPrev'), down: (o?.kpis.paid.deltaPct ?? 0) < 0 },
  ];

  const openRowMenu = (e: React.MouseEvent<HTMLElement>, r: PayoutRow) =>
    openMenu(e, [
      { icon: 'groups', label: t('referral.po.menuReferred'), onClick: () => setViewing({ userId: r.userId, name: r.name }) },
      ...(r.dueCents > 0 ? [{ icon: 'payments', label: t('referral.po.pay'), onClick: () => setConfirm({ payees: [r], amount: r.dueCents }) }] : []),
    ], undefined, 230);

  const history = o?.history ?? [];
  const shownHistory = histAll ? history : history.slice(0, HISTORY_COLLAPSED);

  return (
    <section className="glass rounded-3xl p-5 max-sm:p-4" aria-label={t('referral.po.title')}>
      <div className="flex flex-wrap items-center gap-3.5">
        <span className="grid size-12 flex-none place-items-center rounded-2xl bg-gradient-to-b from-[#ff8f45] to-[#ff570a]">
          <MaterialIcon name="account_balance_wallet" size={26} filled color="#fff" />
        </span>
        <div className="min-w-0 flex-1 basis-[260px]">
          <h2 className="m-0 text-[20px] font-extrabold tracking-tight">{t('referral.po.title')}</h2>
          <p className="m-0 mt-0.5 text-[13px] text-stone-600">{t('referral.po.sub')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e7e0da] bg-white px-3 py-2 text-[13.5px]">
          <MaterialIcon name="calendar_month" size={19} color="currentColor" />
          <input type="date" value={from} max={to} onChange={(e) => { setFrom(e.target.value); resetPage(); }} aria-label={t('referral.po.rangeFrom')} className="border-0 bg-transparent p-0 text-[13.5px] outline-0" />
          <span aria-hidden>–</span>
          <input type="date" value={to} min={from} onChange={(e) => { setTo(e.target.value); resetPage(); }} aria-label={t('referral.po.rangeTo')} className="border-0 bg-transparent p-0 text-[13.5px] outline-0" />
        </div>
      </div>
      {!rangeOk && <p role="alert" className="mt-3 mb-0 text-[13px] text-[#dc2626]">{t('referral.po.rangeErr')}</p>}

      <div className="mt-4 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
        {kpis.map((k) => (
          <div key={k.label} className={`flex min-w-0 gap-3 rounded-2xl px-4 py-4 ${k.tint}`}>
            <span style={{ background: k.iconBg }} className="grid size-11 flex-none place-items-center rounded-xl">
              <MaterialIcon name={k.icon} size={23} filled color={k.iconFg} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-stone-700">{k.label}</div>
              <div className="mt-1 truncate text-[24px] leading-tight font-extrabold tracking-[-.02em]">{k.v}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-stone-500">
                {k.delta && (
                  <span className={`flex items-center gap-0.5 font-bold ${k.down ? 'text-[#dc2626]' : 'text-[#15803d]'}`}>
                    <MaterialIcon name={k.down ? 'arrow_downward' : 'arrow_upward'} size={14} />
                    {k.delta}
                  </span>
                )}
                {k.note}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-2xl border border-[rgba(120,60,20,.1)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-xl bg-gradient-to-b from-[#ff8f45] to-[#ff570a]">
              <MaterialIcon name="receipt_long" size={21} filled color="#fff" />
            </span>
            <div className="min-w-0 flex-1 basis-[200px]">
              <h3 className="m-0 text-[16px] font-extrabold">{t('referral.po.listTitle')}</h3>
              <p className="m-0 text-[12.5px] text-stone-500">{t('referral.po.listSub')}</p>
            </div>
            <label className="flex h-10 min-w-[190px] flex-1 basis-[200px] items-center gap-2 rounded-xl border border-[#e7e0da] bg-white px-3">
              <MaterialIcon name="search" size={19} color="currentColor" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder={t('referral.po.search')} aria-label={t('referral.po.search')} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13.5px] outline-0" />
            </label>
            <label className="flex h-10 items-center gap-1.5 rounded-xl border border-[#e7e0da] bg-white px-2.5 text-[13px]">
              <MaterialIcon name="filter_list" size={19} color="currentColor" />
              <select value={status} onChange={(e) => { setStatus(e.target.value as 'all' | 'due' | 'paid'); resetPage(); }} aria-label={t('referral.po.filter')} className="border-0 bg-transparent p-0 text-[13px] outline-0">
                <option value="all">{t('referral.po.filterAll')}</option>
                <option value="due">{t('referral.po.filterDue')}</option>
                <option value="paid">{t('referral.po.filterPaid')}</option>
              </select>
            </label>
          </div>

          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="grid grid-cols-[28px_minmax(200px,2fr)_90px_80px_120px_120px_130px_130px] items-center gap-2.5 rounded-xl bg-[#f7f4f1] px-3 py-3 text-[12.5px] text-stone-600">
                <input type="checkbox" checked={allPageSelected} disabled={dueRows.length === 0} onChange={togglePage} aria-label={t('referral.po.selectAll')} className="size-4 accent-brand" />
                <span>{t('referral.po.colCollab')}</span>
                <span>{t('referral.po.colReferred')}</span>
                <span>{t('referral.po.colRate')}</span>
                <span>{t('referral.po.colTotal')}</span>
                <span>{t('referral.po.colDue')}</span>
                <span>{t('referral.po.colStatus')}</span>
                <span className="sticky right-0 -my-3 flex items-center self-stretch bg-[#f7f4f1] pl-2">{t('referral.po.colAction')}</span>
              </div>
              {query.isPending && rangeOk && <p className="py-8 text-center text-stone-400">{t('referral.loading')}</p>}
              {query.isError && <p role="alert" className="py-8 text-center text-[#dc2626]">{errText(query.error)}</p>}
              {o && rows.length === 0 && <p className="py-8 text-center text-sm text-stone-500">{search || status !== 'all' ? t('referral.po.emptyFilter') : t('referral.po.empty')}</p>}
              {rows.map((r) => {
                const st = STATUS_STYLE[r.status];
                return (
                  <div key={r.userId} className="grid grid-cols-[28px_minmax(200px,2fr)_90px_80px_120px_120px_130px_130px] items-center gap-2.5 border-b border-[rgba(120,60,20,.08)] px-3 py-3 text-[13.5px]">
                    <input type="checkbox" checked={selected.has(r.userId)} disabled={r.dueCents <= 0} onChange={() => toggle(r.userId)} aria-label={t('referral.po.selectRow', { name: r.name })} className="size-4 accent-brand" />
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.name} url={r.avatarUrl} />
                      <span className="min-w-0">
                        <b className="block truncate" title={r.name}>{r.name}</b>
                        <span className="block truncate text-[11.5px] text-stone-500" title={r.email}>{t('referral.po.joined', { date: formatDate(r.joinedAt) })}</span>
                      </span>
                    </span>
                    <span>{r.referredCount}</span>
                    <span>{pct(r.rateBps)}</span>
                    <span className="truncate font-semibold" title={formatCents(r.totalCents)}>{formatCents(r.totalCents)}</span>
                    <span className="truncate font-semibold" title={formatCents(r.dueCents)}>{r.dueCents > 0 ? formatCents(r.dueCents) : '—'}</span>
                    <span>
                      <span style={{ background: st.bg, color: st.fg }} className="inline-flex h-[26px] items-center rounded-full px-2.5 text-[12px] font-semibold whitespace-nowrap">
                        {t(`referral.po.status.${r.status}`)}
                      </span>
                    </span>
                    <span className="sticky right-0 -my-3 flex items-center gap-1.5 self-stretch bg-white pl-2">
                      <button
                        type="button"
                        disabled={r.dueCents <= 0 || pay.isPending}
                        onClick={() => setConfirm({ payees: [r], amount: r.dueCents })}
                        className="h-8 cursor-pointer rounded-lg border-0 bg-gradient-to-b from-[#ff8f45] to-[#ff570a] px-3.5 text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {t('referral.po.pay')}
                      </button>
                      <button type="button" aria-label={t('referral.po.rowOptions', { name: r.name })} onClick={(e) => openRowMenu(e, r)} className="grid size-8 cursor-pointer place-items-center border-0 bg-transparent p-0">
                        <MaterialIcon name="more_vert" size={20} color="currentColor" />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {total > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-stone-500">
              <span>{t('referral.po.showing', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}</span>
              <nav aria-label={t('referral.po.pagination')} className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => goPage(page - 1)} aria-label={t('referral.po.prev')} className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#e7e0da] bg-white disabled:opacity-40">
                  <MaterialIcon name="chevron_left" size={18} color="currentColor" />
                </button>
                {pageList(page, lastPage).map((n, i) =>
                  n === '…' ? (
                    <span key={`e${i}`} className="px-1">…</span>
                  ) : (
                    <button key={n} type="button" onClick={() => goPage(n)} aria-current={n === page ? 'page' : undefined} className={`grid size-8 cursor-pointer place-items-center rounded-lg border text-[13px] font-semibold ${n === page ? 'border-brand bg-brand text-white' : 'border-[#e7e0da] bg-white'}`}>
                      {n}
                    </button>
                  ),
                )}
                <button type="button" disabled={page >= lastPage} onClick={() => goPage(page + 1)} aria-label={t('referral.po.next')} className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[#e7e0da] bg-white disabled:opacity-40">
                  <MaterialIcon name="chevron_right" size={18} color="currentColor" />
                </button>
              </nav>
            </div>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-2xl border border-[#fde3cf] p-4 dark:border-[rgba(255,220,197,.15)]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 flex-none place-items-center rounded-xl bg-gradient-to-b from-[#ff8f45] to-[#ff570a]">
                <MaterialIcon name="payments" size={20} filled color="#fff" />
              </span>
              <h3 className="m-0 text-[16px] font-extrabold">{t('referral.po.payTitle')}</h3>
            </div>
            <p className="mt-2 mb-3 text-[12.5px] text-stone-600">{t('referral.po.payHint')}</p>
            <button
              type="button"
              disabled={selectedDue.length === 0 || pay.isPending}
              onClick={() => setConfirm({ payees: selectedDue, amount: selectedAmount })}
              className="h-11 w-full cursor-pointer rounded-xl border-0 bg-gradient-to-b from-[#ff8f45] to-[#ff570a] text-[14.5px] font-bold text-white shadow-[0_8px_20px_rgba(255,87,10,.25)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedDue.length > 0 ? t('referral.po.payBulkN', { n: selectedDue.length }) : t('referral.po.payBulk')}
            </button>
            <button type="button" onClick={() => void exportCsv()} disabled={!rangeOk || noDue} title={noDue ? t('referral.po.exportNone') : undefined} className="mt-2.5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#e7e0da] bg-white text-[14px] font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              <MaterialIcon name="download" size={19} color="currentColor" />
              {t('referral.po.export')}
            </button>
          </div>

          <div className="rounded-2xl border border-[rgba(120,60,20,.1)] p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 flex-none place-items-center rounded-xl bg-[#ffedd5]">
                <MaterialIcon name="history" size={20} filled color="#ea580c" />
              </span>
              <h3 className="m-0 min-w-0 flex-1 text-[15px] font-extrabold">{t('referral.po.histTitle')}</h3>
              {history.length > HISTORY_COLLAPSED && (
                <button type="button" onClick={() => setHistAll((v) => !v)} className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-bold text-brand underline">
                  {histAll ? t('referral.po.histLess') : t('referral.po.histAll')}
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-3 mb-0 text-center text-[13px] text-stone-500">{t('referral.po.histEmpty')}</p>
            ) : (
              <ul className="m-0 mt-3 flex max-h-[360px] list-none flex-col gap-2.5 overflow-y-auto p-0">
                {shownHistory.map((h) => (
                  <li key={h.id} className="flex items-center gap-2.5 text-[13px]">
                    <Avatar name={h.name} url={h.avatarUrl} size={34} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate" title={h.name}>{h.name}</b>
                      <span className="text-[11.5px] text-stone-500">{formatDate(h.paidAt)}</span>
                    </span>
                    <span className="flex flex-col items-end gap-0.5">
                      <b>{formatCents(h.amountCents)}</b>
                      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#15803d]">{t('referral.po.transferred')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 mb-0 flex items-start gap-2 rounded-xl bg-[#eef6ff] px-3 py-2.5 text-[12px] leading-snug text-[#1e40af] dark:bg-[#16202c] dark:text-[#93c5fd]">
              <MaterialIcon name="verified_user" size={17} filled color="currentColor" />
              <span>{t('referral.po.note')}</span>
            </p>
          </div>
        </aside>
      </div>

      {confirm && (
        <ConfirmDialog
          title={t('referral.po.confirmTitle')}
          message={confirm.payees.length === 1 ? t('referral.po.confirmOne', { amount: formatCents(confirm.amount), name: confirm.payees[0]!.name }) : t('referral.po.confirmMany', { amount: formatCents(confirm.amount), n: confirm.payees.length })}
          details={<PayeeList payees={confirm.payees} />}
          confirmLabel={t('referral.po.confirmBtn')}
          danger={false}
          pending={pay.isPending}
          error={pay.isError ? errText(pay.error) : null}
          onConfirm={() => pay.mutate(confirm.payees.map((r) => r.userId))}
          onClose={() => { pay.reset(); setConfirm(null); }}
        />
      )}
      {viewing && <ReferredModal communityId={communityId} userId={viewing.userId} name={viewing.name} onClose={() => setViewing(null)} />}
      {menuEl}
    </section>
  );
}
