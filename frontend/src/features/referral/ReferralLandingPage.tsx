import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { saveCommunityRef } from './communityRef';
import { isCommunityId, saveReferralCode, saveReferralCommunity } from './storage';

/**
 * /gioi-thieu/:code[?c=<id cộng đồng>] — link giới thiệu lấy từ trang "Giới thiệu & hoa hồng" của một cộng đồng.
 * - Đã đăng nhập: vào thẳng cộng đồng đó (kèm `?cref=` để chương trình giới thiệu của cộng đồng ghi nhận khi tham gia/thanh toán); không có `c` thì về trang chủ.
 *   Không đăng ký lại: mã giới thiệu nền tảng chỉ ghi nhận cho tài khoản MỚI.
 * - Chưa đăng nhập: lưu mã (và cộng đồng) rồi sang đăng ký; đăng ký xong sẽ được đưa vào đúng cộng đồng.
 */
export function ReferralLandingPage() {
  const { t } = useTranslation('referral');
  const { code = '' } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { status } = useAuth();
  const communityId = search.get('c');
  useEffect(() => {
    if (status === 'loading') return; // chờ biết đã đăng nhập hay chưa rồi mới chuyển trang
    const cid = isCommunityId(communityId) ? communityId : null;
    if (status === 'authenticated') {
      navigate(cid ? `/communities/${cid}?cref=${encodeURIComponent(code.trim().toLowerCase())}` : '/', { replace: true });
      return;
    }
    saveReferralCode(code);
    if (cid) {
      saveReferralCommunity(cid);
      saveCommunityRef(cid, code);
    }
    navigate('/register', { replace: true });
  }, [code, communityId, navigate, status]);
  return <div role="status" className="grid min-h-screen place-items-center text-stone-400">{t('redirecting')}</div>;
}
