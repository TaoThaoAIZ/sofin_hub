import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { saveCommunityRef } from './communityRef';
import { saveReferralCode } from './storage';

/** Gặp `?ref=<mã>` ở bất kỳ trang nào thì nhớ mã để dùng khi đăng ký. Không render gì. */
export function ReferralCapture() {
  const { search, pathname } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const ref = params.get('ref');
    if (ref) saveReferralCode(ref);
    // Link giới thiệu của MỘT cộng đồng: /communities/<id>?cref=<mã> — nhớ theo cộng đồng để gửi kèm khi thanh toán.
    const cref = params.get('cref');
    const cid = /^\/communities\/([^/]+)/.exec(pathname)?.[1];
    if (cref && cid) saveCommunityRef(decodeURIComponent(cid), cref);
  }, [search, pathname]);
  return null;
}
