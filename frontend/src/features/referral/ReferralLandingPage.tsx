import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { saveReferralCode } from './storage';

/** /gioi-thieu/:code — lưu mã giới thiệu rồi chuyển sang trang đăng ký. */
export function ReferralLandingPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    saveReferralCode(code);
    navigate('/register', { replace: true });
  }, [code, navigate]);
  return <div role="status" className="grid min-h-screen place-items-center text-stone-400">Đang chuyển hướng…</div>;
}
