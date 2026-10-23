import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError, apiGet, apiPut } from '../../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { ToastProvider } from '../../admin/components/overlay';
import { ReferralTab as PlatformReferral } from '../../settings/tabs/ReferralTab';
import { errText, ErrorNote, ghostBtn, primaryBtn } from './contentUi';
import { OwnerPayoutSection } from './OwnerPayoutSection';

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
    <section className="glass rounded-3xl p-5 max-sm:p-4" aria-label={t('referral.ownerTitle')}>
      <h2 className="m-0 text-[16px] font-extrabold">{t('referral.ownerTitle')}</h2>
      <p className="mt-2 mb-0 text-[13px] leading-relaxed text-stone-600">{p.enabled ? t('referral.subOn', { pct: fmtPct(p.rateBps) }) : t('referral.subOff')}</p>
      <p className="mt-1 mb-3 text-[13px] leading-relaxed text-stone-600">{t('referral.ownerHint', { max: fmtPct(p.maxRateBps) })}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 w-[200px] items-center rounded-xl border-[1.5px] border-[#e7e0da] bg-white px-3 focus-within:border-brand">
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
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-0"
          />
          <span className="font-medium text-stone-500">%</span>
        </label>
        <button
          type="button"
          disabled={!rateValid || save.isPending}
          onClick={() => save.mutate(rateBps, { onSuccess: () => { setSaved(true); setRate(null); } })}
          className={`${primaryBtn} h-11 gap-1.5`}
        >
          <MaterialIcon name="save" size={18} color="#fff" />
          {save.isPending ? t('referral.saving') : t('referral.save')}
        </button>
        {p.enabled && (
          <button type="button" disabled={save.isPending} onClick={() => save.mutate(0, { onSuccess: () => { setSaved(true); setRate(null); } })} className={`${ghostBtn} h-11`}>
            {t('referral.turnOff')}
          </button>
        )}
        {saved && <span role="status" className="text-[12.5px] font-semibold text-emerald-600">{t('referral.saved')}</span>}
      </div>
      {!rateValid && <p role="alert" className="m-0 mt-2 text-[12.5px] text-red-600">{t('referral.rateErr', { max: fmtPct(p.maxRateBps) })}</p>}
      <ErrorNote message={save.isError ? errText(save.error) : null} />
    </section>
  );
}

/**
 * Trang "Giới thiệu & hoa hồng" trong cộng đồng. Thứ tự: (chủ cộng đồng) khung đặt % hoa hồng ở TRÊN CÙNG → hero + link (chỉ khi đã bật %) →
 * số liệu → người đã giới thiệu + rút tiền. Mọi số liệu/tỉ lệ ở đây tính theo CỘNG ĐỒNG này.
 */
export function CommunityReferralTab() {
  const { t } = useTranslation('community');
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
  // Chưa biết người xem có phải CHỦ cộng đồng không thì chưa dựng gì: nếu dựng sớm, chủ sẽ thấy thoáng giao diện của học viên (bảng "Người bạn đã giới thiệu", Rút tiền).
  if (q.isPending) return <p className="py-10 text-center text-stone-400">{t('referral.loading')}</p>;
  if (q.isError || !q.data) {
    return <p role="alert" className="py-10 text-center text-red-600">{q.error instanceof ApiError ? q.error.message : errText(q.error)}</p>;
  }
  const program = q.data;
  const owner = program.isOwner;
  return (
    <div className="flex flex-col gap-[18px]">
      {owner && <h1 className="m-0 text-[22px] font-extrabold tracking-tight">{t('referral.pageTitle')}</h1>}
      {owner && <RateBox communityId={communityId} program={program} />}
      {/* Bố cục theo thiết kế. Chủ cộng đồng: khung % → hero + link → chi trả cho cộng tác viên. Thành viên: hero + link, 4 chỉ số, người đã giới thiệu + rút tiền. */}
      <ToastProvider>
        <PlatformReferral kind="member" withdraw={!owner} heroOnly={owner} showPayoutLink={false} communityId={communityId} communityOwner={owner} />
        {owner && <OwnerPayoutSection communityId={communityId} />}
      </ToastProvider>
    </div>
  );
}
