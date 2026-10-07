import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { DeleteBlockers } from './api';

/** Hướng dẫn từng bước gỡ các điều kiện đang chặn xóa tài khoản (chuyển quyền chủ cộng đồng, hủy gói) kèm liên kết tới đúng màn hình. */
export function BlockersGuide({ blockers, onNavigate }: { blockers: DeleteBlockers | undefined; onNavigate?: () => void }) {
  const { t } = useTranslation('settings');
  if (!blockers || (blockers.ownedCommunities.length === 0 && blockers.activeSubscriptions === 0)) return null;
  const link = 'font-bold text-brand underline';
  return (
    <div className="mt-3 rounded-xl border border-[#fecaca] bg-white px-4 py-3 text-sm leading-[1.6] text-stone-700">
      {blockers.ownedCommunities.length > 0 && (
        <div>
          <div className="font-bold">{t('security.guide.ownerTitle')}</div>
          <ol className="m-0 mt-1 list-decimal pl-5">
            <li>{t('security.guide.ownerStep1')}</li>
            <li>{t('security.guide.ownerStep2')}</li>
            <li>{t('security.guide.ownerStep3')}</li>
          </ol>
          <ul className="m-0 mt-2 list-none p-0">
            {blockers.ownedCommunities.map((c) => (
              <li key={c.id}>
                <Link to={`/communities/${c.id}/community/cai-dat?tab=danger`} onClick={onNavigate} className={link}>
                  {t('security.guide.transferLink', { name: c.title })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {blockers.activeSubscriptions > 0 && (
        <div className={blockers.ownedCommunities.length > 0 ? 'mt-3' : ''}>
          <div className="font-bold">{t('security.guide.subsTitle')}</div>
          <Link to="/settings/thanh-toan" onClick={onNavigate} className={link}>
            {t('security.guide.subsLink')}
          </Link>
        </div>
      )}
    </div>
  );
}
