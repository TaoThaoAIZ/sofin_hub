import type { ReactNode } from 'react';

/** Tiêu đề mục có vạch cam bên trái (dùng ở Chi tiết khóa học, trang pháp lý...). */
export function SectionTitle({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
  const bar = size === 'md' ? 'h-6 w-1' : 'h-5 w-1';
  const text = size === 'md' ? 'text-2xl' : 'text-xl';
  return (
    <h2 className={`m-0 flex items-center gap-3 font-bold ${text}`}>
      <span className={`${bar} flex-none rounded bg-brand`} />
      {children}
    </h2>
  );
}
