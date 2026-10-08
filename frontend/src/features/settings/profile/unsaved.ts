import { useEffect } from 'react';

/** Trạng thái "đang có thay đổi chưa lưu" của tab Hồ sơ — dùng chung để thanh điều hướng Cài đặt hỏi trước khi rời. */
let dirty = false;
export const hasUnsavedProfile = () => dirty;

/** Đăng ký trạng thái chưa lưu; đồng thời cảnh báo khi tải lại/đóng tab trình duyệt. */
export function useUnsavedGuard(isDirty: boolean) {
  useEffect(() => {
    dirty = isDirty;
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);
  useEffect(() => () => void (dirty = false), []);
}
