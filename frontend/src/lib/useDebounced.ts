import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` mili-giây sau lần đổi cuối (dùng cho kiểm tra slug / ước tính doanh thu khi đang gõ). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
