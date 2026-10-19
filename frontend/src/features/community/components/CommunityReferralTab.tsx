import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, apiGet, apiPut } from '../../../lib/api';
import { formatCents, formatDate } from '../../../lib/datetime';
import { useAuth } from '../../auth/AuthContext';
import { ToastProvider } from '../../admin/components/overlay';
import { ReferralTab as PlatformReferral } from '../../settings/tabs/ReferralTab';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';

interface ReferredRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  signedUpAt: string;
  status: 'paid' | 'none';
  earnedCents: number;
}
interface Program {
  rateBps: number;
  enabled: boolean;
  maxRateBps: number;
  isOwner: boolean;
  isMember: boolean;
  code: string | null;
  link: string | null;
  stats: { referred: number; paying: number; commissionCents: number; pendingCents: number; payoutOn: string } | null;
  referred: ReferredRow[];
  owner: { referrers: number; referred: number; commissionCents: number } | null;
}

const key = (communityId: string) => ['community', communityId, 'referral-program'] as const;
/** 2000 -> "20", 250 -> "2.5" (nhập/hiển thị theo %). */
const bpsToPct = (bps: number) => String(bps / 100);
const fmtPct = (bps: number) => `${(bps / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%`;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Chương trình giới thiệu của CỘNG ĐỒNG này: chủ đặt % hoa hồng; thành viên lấy link riêng, theo dõi người đã mời + hoa hồng. */
function CommunityProgram() {
  const { t } = useTranslation('community');
  const { id: communityId = '' } = useParams();
  const { accessToken } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: key(communityId),
    queryFn: ({ signal }) => apiGet<{ data: Program }>(`/communities/${communityId}/referral-program`, undefined, signal, { token: accessToken! }).then((r) => r.data),
    enabled: !!accessToken && !!communityId,
  });
  const save = useMutation({
    mutationFn: (rateBps: number) => apiPut<{ data: unknown }>(`/communities/${communityId}/referral-program`, { rateBps }, { token: accessToken! }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key(communityId) }),
  });
  const [rate, setRate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  if (q.isPending) return <p className="py-10 text-center text-stone-400">{t('referral.loading')}</p>;
  if (q.isError || !q.data) {
    return <p role="alert" className="py-10 text-center text-red-600">{q.error instanceof ApiError ? q.error.message : t('referral.loadFail')}</p>;
  }
  const p = q.data;
  // Cộng đồng chưa bật chương trình và mình không phải chủ: khỏi chiếm chỗ bằng thẻ "chưa bật" (trang gọn như thiết kế).
  if (!p.enabled && !p.isOwner) return null;
  const rateText = rate ?? bpsToPct(p.rateBps);
  const rateNum = Number(rateText);
  const rateBps = Math.round(rateNum * 100);
  const rateValid = rateText.trim() !== '' && Number.isFinite(rateNum) && rateBps >= 0 && rateBps <= p.maxRateBps;

  const copy = async () => {
    if (!p.link) return;
    if (await copyText(p.link)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 flex-none place-items-center rounded-full bg-[#fff1e6]">
            <MaterialIcon name="redeem" size={22} filled color="#ff570a" />
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-[22px] font-extrabold tracking-tight">{t('referral.title')}</h1>
            <p className="m-0 mt-0.5 text-[13.5px] text-stone-600">
              {p.enabled ? t('referral.subOn', { pct: fmtPct(p.rateBps) }) : t('referral.subOff')}
            </p>
          </div>
        </div>

        {p.isOwner && (
          <div className="mt-5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white/70 p-4">
            <div className="text-[14px] font-bold">{t('referral.ownerTitle')}</div>
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
        )}

        {p.enabled && p.link && (
          <div className="mt-5">
            <div className="mb-2 text-sm text-stone-700">{t('referral.yourLink')}</div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 basis-[280px] items-center gap-2 rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-4 py-3 text-[14px]">
                <span className="min-w-0 flex-1 truncate select-all">{p.link.replace(/^https?:\/\//, '')}</span>
              </div>
              <button type="button" onClick={() => void copy()} className={primaryBtn}>
                <MaterialIcon name={copied ? 'check' : 'content_copy'} size={18} color="#fff" />
                {copied ? t('referral.copied') : t('referral.copy')}
              </button>
            </div>
            <p className="mt-2 mb-0 text-[12.5px] text-stone-500">{t('referral.howItWorks', { pct: fmtPct(p.rateBps) })}</p>
            {p.stats && (
              <p className="mt-3 mb-0 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-stone-600">
                <span>{t('referral.kpiReferred')}: <b className="text-stone-900">{p.stats.referred}</b></span>
                <span>{t('referral.kpiPaying')}: <b className="text-stone-900">{p.stats.paying}</b></span>
                <span>{t('referral.kpiCommission')}: <b className="text-stone-900">{formatCents(p.stats.commissionCents)}</b></span>
                <span>{t('referral.kpiPending')}: <b className="text-stone-900">{formatCents(p.stats.pendingCents)}</b> · {t('referral.payoutOn', { date: formatDate(p.stats.payoutOn) })}</span>
              </p>
            )}
          </div>
        )}
        {!p.enabled && !p.isOwner && <p className="mt-4 mb-0 text-sm text-stone-600">{t('referral.disabledMember')}</p>}
      </section>

    </div>
  );
}

/** Trang "Giới thiệu & hoa hồng" trong cộng đồng: bố cục thiết kế (giới thiệu nền tảng + rút tiền) và một thẻ gọn cho chương trình của CỘNG ĐỒNG này. */
export function CommunityReferralTab() {
  // Trang này không dùng ảnh nền đầu trang (xem body.no-page-bg ở index.css).
  useEffect(() => {
    document.body.classList.add('no-page-bg');
    return () => document.body.classList.remove('no-page-bg');
  }, []);
  return (
    <div className="flex flex-col gap-[18px]">
      {/* Bố cục theo thiết kế: hero + link, 4 chỉ số, bảng người giới thiệu + rút tiền, quy trình rút tiền. */}
      <ToastProvider>
        <PlatformReferral kind="member" withdraw showPayoutLink={false} />
      </ToastProvider>
      <CommunityProgram />
    </div>
  );
}
