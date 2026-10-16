import type { ReactNode } from 'react';

/** Tiêu đề mục có vạch cam bên trái (dùng ở Chi tiết khóa học, trang pháp lý...). */
export function SectionTitle({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
  const bar = size === 'md' ? 'h-[22px] w-[3px]' : 'h-5 w-[3px]';
  const text = size === 'md' ? 'text-[22px] leading-[30px]' : 'text-xl';
  return (
    <h2 className={`m-0 flex items-center gap-[11px] font-bold ${text}`}>
      <span className={`${bar} flex-none rounded bg-brand`} />
      {children}
    </h2>
  );
}
