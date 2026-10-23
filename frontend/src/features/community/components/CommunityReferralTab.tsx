import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, apiGet, apiPut, resolveApiPath } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useAuth } from '../../auth/AuthContext';
import { ToastProvider } from '../../admin/components/overlay';
import { ReferralTab as PlatformReferral } from '../../settings/tabs/ReferralTab';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';

interface Program {
  rateBps: number;
  enabled: boolean;
  maxRateBps: number;
  isOwner: boolean;
  isMember: boolean;
  owner: { referrers: number; referred: number; commissionCents: number } | null;
}

const key = (communityId: string) => ['community', communityId, 'referral-program'] as const;
/** 2000 -> "20", 250 -> "2.5" (nhập/hiển thị theo %). */
const bpsToPct = (bps: number) => String(bps / 100);
const fmtPct = (bps: number) => `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

/** Chủ cộng đồng đặt % hoa hồng giới thiệu (0 = tắt). Đặt LÊN ĐẦU trang vì quyết định phần còn lại (link, số liệu) có hiện hay không. */
function RateBox({ communityId, program: p }: { communityId: string; program: Program }) {
  const { t } = useTranslation('community');
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (rateBps: number) => apiPut<{ data: unknown }>(`/communities/${communityId}/referral-program`, { rateBps }, { token: accessToken! }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(communityId) });
      // Hero/link/số liệu bên dưới đọc % của cộng đồng: làm mới ngay.
      void qc.invalidateQueries({ queryKey: ['referral'] });
    },
  });
  const [rate, setRate] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const rateText = rate ?? bpsToPct(p.rateBps);
  const rateNum = Number(rateText);
  const rateBps = Math.round(rateNum * 100);
  const rateValid = rateText.trim() !== '' && Number.isFinite(rateNum) && rateBps >= 0 && rateBps <= p.maxRateBps;

  return (
    <section className="glass rounded-3xl p-5" aria-label={t('referral.ownerTitle')}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fff1e6]">
          <MaterialIcon name="percent" size={22} filled color="#ff570a" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-extrabold">{t('referral.ownerTitle')}</div>
          <p className="m-0 mt-0.5 text-[13px] text-stone-600">{p.enabled ? t('referral.subOn', { pct: fmtPct(p.rateBps) }) : t('referral.subOff')}</p>
          <p className="mt-1 mb-3 text-[12.5px] text-stone-500">{t('referral.ownerHint', { max: fmtPct(p.maxRateBps) })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              {t('referral.rateLabel')}
              <input
                type="number"
                min={0}
                max={p.maxRateBps / 100}
                step={0.5}
                value={rateText}
                onChange={(e) => {
                  setRate(e.target.value);
                  setSaved(false);
                }}
                aria-label={t('referral.rateLabel')}
                className="h-10 w-[96px] rounded-[10px] border-[1.5px] border-[#e7e0da] px-3 text-sm outline-0 focus:border-brand"
              />
              <span className="font-medium text-stone-500">%</span>
            </label>
            <button
              type="button"
              disabled={!rateValid || save.isPending}
              onClick={() => save.mutate(rateBps, { onSuccess: () => { setSaved(true); setRate(null); } })}
              className={primaryBtn}
            >
              {save.isPending ? t('referral.saving') : t('referral.save')}
            </button>
            {p.enabled && (
              <button type="button" disabled={save.isPending} onClick={() => save.mutate(0, { onSuccess: () => { setSaved(true); setRate(null); } })} className={ghostBtn}>
                {t('referral.turnOff')}
              </button>
            )}
            {saved && <span role="status" className="text-[12.5px] font-semibold text-emerald-600">{t('referral.saved')}</span>}
          </div>
          {!rateValid && <p role="alert" className="m-0 mt-2 text-[12.5px] text-red-600">{t('referral.rateErr', { max: fmtPct(p.maxRateBps) })}</p>}
          <ErrorNote message={save.isError ? errText(save.error) : null} />
          {p.owner && (
            <p className="mt-4 mb-0 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-stone-600">
              <span>{t('referral.ownerReferrers')}: <b className="text-stone-900">{p.owner.referrers}</b></span>
              <span>{t('referral.ownerReferred')}: <b className="text-stone-900">{p.owner.referred}</b></span>
              <span>{t('referral.ownerCommission')}: <b className="text-stone-900">{formatCents(p.owner.commissionCents)}</b></span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

interface OwnerReferred {
  userId: string;
  name: string;
  avatarUrl: string | null;
  joinedAt: string;
  status: 'paid' | 'joined' | 'none';
  earnedCents: number;
}
interface OwnerReferrer {
  userId: string;
  name: string;
  avatarUrl: string | null;
  referredCount: number;
  payingCount: number;
  commissionCents: number;
  pendingCents: number;
  referred: OwnerReferred[];
}
interface OwnerReferrers {
  referrers: OwnerReferrer[];
  totals: { referrers: number; referred: number; paying: number; commissionCents: number; pendingCents: number };
}

const REFERRER_COLLAPSED = 5;
const STATUS_STYLE: Record<OwnerReferred['status'], { bg: string; fg: string }> = {
  paid: { bg: '#dcfce7', fg: '#15803d' },
  joined: { bg: '#e0f2fe', fg: '#0369a1' },
  none: { bg: '#f1efed', fg: '#78716c' },
};
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    <img src={resolveApiPath(url)} alt="" className="size-9 flex-none rounded-full object-cover" />
  ) : (
    <span aria-hidden className="grid size-9 flex-none place-items-center rounded-full bg-[#fee2e2] text-[12px] font-bold text-[#b91c1c]">{initialsOf(name)}</span>
  );
}

/** Chủ cộng đồng (người trả % hoa hồng) xem TẤT CẢ người giới thiệu: số người đã mời, đang trả phí, hoa hồng phải trả; bấm một dòng để xem từng người được mời. */
function OwnerReferrersList({ communityId }: { communityId: string }) {
  const { t } = useTranslation('community');
  const { accessToken } = useAuth();
  const q = useQuery({
    queryKey: [...key(communityId), 'referrers'] as const,
    queryFn: ({ signal }) => apiGet<{ data: OwnerReferrers }>(`/communities/${communityId}/referral-program/referrers`, undefined, signal, { token: accessToken! }).then((r) => r.data),
    enabled: !!accessToken && !!communityId,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (q.isPending) return <p className="py-4 text-center text-stone-400">{t('referral.loading')}</p>;
  if (q.isError || !q.data) return <p role="alert" className="py-4 text-center text-red-600">{q.error instanceof ApiError ? q.error.message : t('referral.loadFail')}</p>;
  const { referrers, totals } = q.data;
  const shown = all ? referrers : referrers.slice(0, REFERRER_COLLAPSED);

  return (
    <section className="glass rounded-3xl p-5" aria-label={t('referral.ol.title')}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fff1e6]">
          <MaterialIcon name="groups" size={22} filled color="#ff570a" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-extrabold">{t('referral.ol.title')}</div>
          <p className="m-0 mt-0.5 text-[13px] text-stone-600">{t('referral.ol.sub')}</p>
        </div>
      </div>

      <p className="mt-4 mb-0 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-stone-600">
        <span>{t('referral.ol.totReferrers')}: <b className="text-stone-900">{totals.referrers}</b></span>
        <span>{t('referral.ol.totReferred')}: <b className="text-stone-900">{totals.referred}</b></span>
        <span>{t('referral.ol.totPaying')}: <b className="text-stone-900">{totals.paying}</b></span>
        <span>{t('referral.ol.totCommission')}: <b className="text-stone-900">{formatCents(totals.commissionCents)}</b></span>
        <span>{t('referral.ol.totPending')}: <b className="text-stone-900">{formatCents(totals.pendingCents)}</b></span>
      </p>

      {referrers.length === 0 ? (
        <p className="mt-4 mb-0 rounded-xl bg-[#faf7f4] px-4 py-5 text-center text-sm text-stone-500">{t('referral.ol.empty')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[minmax(180px,2fr)_90px_90px_130px_130px_28px] gap-3 rounded-xl bg-[#f7f4f1] px-4 py-3 text-[12.5px] text-stone-600">
              <span>{t('referral.ol.colReferrer')}</span>
              <span>{t('referral.ol.colReferred')}</span>
              <span>{t('referral.ol.colPaying')}</span>
              <span>{t('referral.ol.colCommission')}</span>
              <span>{t('referral.ol.colPending')}</span>
              <span />
            </div>
            {shown.map((r) => {
              const isOpen = open === r.userId;
              return (
                <div key={r.userId} className="border-b border-[rgba(120,60,20,.08)]">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : r.userId)}
                    aria-expanded={isOpen}
                    className="grid w-full cursor-pointer grid-cols-[minmax(180px,2fr)_90px_90px_130px_130px_28px] items-center gap-3 border-0 bg-transparent px-4 py-3 text-left text-[14px]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={r.name} url={r.avatarUrl} />
                      <span className="truncate font-semibold" title={r.name}>{r.name}</span>
                    </span>
                    <span>{r.referredCount}</span>
                    <span>{r.payingCount}</span>
                    <span className="truncate font-semibold">{formatCents(r.commissionCents)}</span>
                    <span className="truncate text-stone-600">{formatCents(r.pendingCents)}</span>
                    <MaterialIcon name={isOpen ? 'expand_less' : 'expand_more'} size={22} />
                  </button>
                  {isOpen && (
                    <ul className="m-0 mb-3 ml-12 flex list-none flex-col gap-1.5 p-0">
                      {r.referred.map((p) => (
                        <li key={p.userId} className="grid grid-cols-[minmax(160px,2fr)_100px_130px_110px] items-center gap-3 rounded-xl bg-[#faf7f4] px-3 py-2 text-[13px]">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Avatar name={p.name} url={p.avatarUrl} />
                            <span className="truncate" title={p.name}>{p.name}</span>
                          </span>
                          <span className="text-stone-600">{formatDate(p.joinedAt)}</span>
                          <span>
                            <span style={{ background: STATUS_STYLE[p.status].bg, color: STATUS_STYLE[p.status].fg }} className="inline-flex h-[26px] items-center rounded-full px-3 text-[12px] font-semibold whitespace-nowrap">
                              {t(`referral.ol.status.${p.status}`)}
                            </span>
                          </span>
                          <span className="truncate font-semibold">{p.earnedCents > 0 ? formatCents(p.earnedCents) : '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {referrers.length > REFERRER_COLLAPSED && (
        <div className="mt-3 text-center">
          <button type="button" onClick={() => setAll((v) => !v)} className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-bold text-brand underline">
            {all ? t('referral.ol.less') : t('referral.ol.more', { n: referrers.length - REFERRER_COLLAPSED })}
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Trang "Giới thiệu & hoa hồng" trong cộng đồng. Thứ tự: (chủ cộng đồng) khung đặt % hoa hồng ở TRÊN CÙNG → hero + link (chỉ khi đã bật %) →
 * số liệu → người đã giới thiệu + rút tiền. Mọi số liệu/tỉ lệ ở đây tính theo CỘNG ĐỒNG này.
 */
export function CommunityReferralTab() {
  const { id: communityId = '' } = useParams();
  const { accessToken } = useAuth();
  // Trang này không dùng ảnh nền đầu trang (xem body.no-page-bg ở index.css).
  useEffect(() => {
    document.body.classList.add('no-page-bg');
    return () => document.body.classList.remove('no-page-bg');
  }, []);
  const q = useQuery({
    queryKey: key(communityId),
    queryFn: ({ signal }) => apiGet<{ data: Program }>(`/communities/${communityId}/referral-program`, undefined, signal, { token: accessToken! }).then((r) => r.data),
    enabled: !!accessToken && !!communityId,
  });
  const program = q.data;
  return (
    <div className="flex flex-col gap-[18px]">
      {q.isError && <p role="alert" className="m-0 text-center text-red-600">{q.error instanceof ApiError ? q.error.message : errText(q.error)}</p>}
      {program?.isOwner && <RateBox communityId={communityId} program={program} />}
      {program?.isOwner && <OwnerReferrersList communityId={communityId} />}
      {/* Bố cục theo thiết kế: hero + link, 4 chỉ số, bảng người giới thiệu + rút tiền, quy trình rút tiền. */}
      <ToastProvider>
        <PlatformReferral kind="member" withdraw showPayoutLink={false} communityId={communityId} communityOwner={!!program?.isOwner} />
      </ToastProvider>
    </div>
  );
}
