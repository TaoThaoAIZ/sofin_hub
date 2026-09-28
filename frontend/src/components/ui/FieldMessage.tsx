import type { ReactNode } from 'react';

/** Dòng thông báo lỗi đỏ dưới 1 ô nhập/checkbox. `indent` dùng cho ô có icon lệch vào (vd. checkbox). */
export function FieldError({ children, indent = false }: { children: ReactNode; indent?: boolean }) {
  return <p className={`mt-1.5 ${indent ? 'ml-7' : 'ml-1'} text-[13px] font-medium text-red-600`}>{children}</p>;
}

/** Dòng gợi ý trung tính (không phải lỗi) ở cùng vị trí. */
export function FieldHint({ children, indent = false }: { children: ReactNode; indent?: boolean }) {
  return <p className={`mt-1.5 ${indent ? 'ml-7' : 'ml-1'} text-[13px] text-stone-500`}>{children}</p>;
}
