import type { CSSProperties } from 'react';

/**
 * Icon lấy đúng từ font "Material Symbols Rounded" trong file thiết kế gốc
 * (SofinHub Community.html) — chỉ dùng trong khu vực Cộng đồng/Thanh toán, KHÔNG thay thế bộ icon
 * SVG hiện có ở icons.tsx (đang dùng cho Header, trang khám phá, chi tiết khóa học...).
 */
export function MaterialIcon({
  name,
  size = 20,
  filled = false,
  weight = 400,
  color,
  className = '',
}: {
  name: string;
  size?: number;
  filled?: boolean;
  weight?: number;
  color?: string;
  className?: string;
}) {
  const style: CSSProperties = {
    fontSize: size,
    color,
    fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' 24`,
  };
  return (
    <span className={`material-symbols-rounded ${className}`} style={style} aria-hidden="true">
      {name}
    </span>
  );
}
