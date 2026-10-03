import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { saveReferralCode } from './storage';

/** Gặp `?ref=<mã>` ở bất kỳ trang nào thì nhớ mã để dùng khi đăng ký. Không render gì. */
export function ReferralCapture() {
  const { search } = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(search).get('ref');
    if (ref) saveReferralCode(ref);
  }, [search]);
  return null;
}
