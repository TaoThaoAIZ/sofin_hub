import { Navigate, useLocation } from 'react-router-dom';

/** Chuyển URL cũ `/courses/:id/...` sang `/communities/:id/...` (giữ nguyên phần đuôi, query, hash). */
export function LegacyCourseRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={pathname.replace(/^\/courses\//, '/communities/') + search + hash} replace />;
}
