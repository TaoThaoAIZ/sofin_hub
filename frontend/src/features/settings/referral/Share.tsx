import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { SettingsModal } from '../billing/Modal';

const BTN = 'grid size-10 flex-none place-items-center rounded-full border-0 p-0 no-underline';

/** "Hoặc chia sẻ nhanh": Facebook, Telegram, X, sao chép link, mã QR. */
export function ShareButtons({ link, onCopy }: { link: string; onCopy: () => void }) {
  const { t } = useTranslation('settings');
  const [qr, setQr] = useState(false);
  const u = encodeURIComponent(link);
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560');
  return (
    <div className="mt-3.5">
      <div className="mb-2 text-[13px] text-stone-600">{t('referral.shareQuick')}</div>
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" aria-label={t('referral.shareFacebook')} onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${u}`)} className={`${BTN} bg-[#1877f2] text-[20px] font-extrabold text-white`}>
          f
        </button>
        <button type="button" aria-label={t('referral.shareTelegram')} onClick={() => open(`https://t.me/share/url?url=${u}`)} className={`${BTN} bg-[#229ed9]`}>
          <MaterialIcon name="send" size={19} filled color="#fff" />
        </button>
        <button type="button" aria-label={t('referral.shareX')} onClick={() => open(`https://twitter.com/intent/tweet?url=${u}`)} className={`${BTN} bg-black text-[16px] font-extrabold text-white`}>
          𝕏
        </button>
        <button type="button" aria-label={t('referral.shareCopy')} onClick={onCopy} className={`${BTN} border border-[#e7e0da] bg-white`}>
          <MaterialIcon name="link" size={20} color="currentColor" />
        </button>
        <button type="button" aria-label={t('referral.shareQr')} onClick={() => setQr(true)} className={`${BTN} border border-[#e7e0da] bg-white`}>
          <MaterialIcon name="qr_code_2" size={22} color="currentColor" />
        </button>
      </div>
      {qr && <QrModal link={link} onClose={() => setQr(false)} />}
    </div>
  );
}

function QrModal({ link, onClose }: { link: string; onClose: () => void }) {
  const { t } = useTranslation('settings');
  const [src, setSrc] = useState<string | null>(null);
  // Thư viện QR chỉ nạp khi mở hộp thoại (không làm nặng trang).
  useEffect(() => {
    let alive = true;
    void import('qrcode')
      .then((m) => m.toDataURL(link, { width: 280, margin: 1 }))
      .then((d) => alive && setSrc(d), () => alive && setSrc(''));
    return () => {
      alive = false;
    };
  }, [link]);
  return (
    <SettingsModal title={t('referral.qrTitle')} body={t('referral.qrBody')} onClose={onClose}>
      <div className="grid place-items-center py-2">{src ? <img src={src} alt={link} width={240} height={240} className="rounded-xl bg-white p-2" /> : <span className="text-sm text-stone-400">…</span>}</div>
      <div className="break-all text-center text-xs text-stone-500">{link}</div>
    </SettingsModal>
  );
}
