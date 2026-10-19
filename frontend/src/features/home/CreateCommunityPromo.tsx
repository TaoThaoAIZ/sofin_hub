import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../components/ui/BrandLogo';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { useAuth } from '../auth/AuthContext';
import { useMyCommunities } from '../settings/communities/queries';

const SEEN_KEY = 'sofinhub.createCommunityPromoSeen';

const seen = () => {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Popup mời "Tạo cộng đồng của riêng bạn" (Figma mobile, khung Home có lớp phủ). Quy tắc hiển thị: chỉ trên mobile (< md), mỗi phiên trình duyệt
 * tối đa 1 lần, sau ~1 giây khi mở trang chủ, chỉ với khách hoặc người chưa tham gia cộng đồng nào; đóng bằng nút X / nền mờ / Esc.
 */
export function CreateCommunityPromo() {
  const { t } = useTranslation('community');
  const { status } = useAuth();
  const mine = useMyCommunities();
  const [open, setOpen] = useState(false);

  const eligible = status === 'guest' || (status === 'authenticated' && mine.isSuccess && (mine.data?.length ?? 0) === 0);

  useEffect(() => {
    if (!eligible || seen() || !window.matchMedia('(max-width: 767px)').matches) return;
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* bỏ qua: không ghi nhớ được thì lần sau có thể hiện lại */
      }
      setOpen(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [eligible]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-center p-6 md:hidden" role="dialog" aria-modal="true" aria-label={t('mobile.promo.title')}>
      <div aria-hidden className="absolute inset-0 bg-black/55" />
      <div className="relative w-full max-w-[340px] rounded-[32px] bg-gradient-to-b from-[#ffe9dc] to-white px-5 pt-6 pb-5 text-center shadow-[0_24px_60px_rgba(0,0,0,.35)] dark:from-[#2a1a10] dark:to-[#14181c]">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('mobile.close')}
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-[rgba(130,130,130,.25)] text-[#201e1c] dark:text-white"
        >
          <MaterialIcon name="close" size={18} color="currentColor" />
        </button>
        <div className="flex justify-center">
          <BrandLogo className="h-9" />
        </div>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand">
          <MaterialIcon name="groups" size={15} color="#ff570a" />
          {t('mobile.promo.badge')}
        </span>
        <h2 className="m-0 mt-1 text-[26px] leading-8 font-extrabold text-[#201e1c] dark:text-white">{t('mobile.promo.title')}</h2>
        <p className="mx-auto mt-2 mb-0 max-w-[260px] text-xs leading-[18px] text-[#696460] dark:text-[#bababa]">{t('mobile.promo.desc')}</p>
        <img src="/images/background_comunity.png" alt="" className="mx-auto mt-3 h-auto w-full max-w-[260px]" />
        <Link
          to="/communities/new"
          onClick={() => setOpen(false)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white no-underline shadow-[0_6px_16px_rgba(246,107,24,.25)]"
        >
          {t('mobile.promo.cta')}
          <MaterialIcon name="arrow_forward" size={20} color="#fff" />
        </Link>
        <div className="mt-2 text-[11px] text-[#837b76] dark:text-[#bababa]">{t('mobile.promo.note')}</div>
      </div>
    </div>,
    document.body,
  );
}
