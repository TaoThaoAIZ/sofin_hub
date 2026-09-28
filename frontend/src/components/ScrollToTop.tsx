import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * React Router không tự cuộn về đầu trang khi chuyển route (khác với chuyển trang thường của trình duyệt).
 * Bỏ qua khi URL có hash (vd. /#courses) để không phá cơ chế cuộn tới anchor riêng của từng trang.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
