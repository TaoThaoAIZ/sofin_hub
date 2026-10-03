import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHandleAvailability } from './api';

/** Giá trị trễ `ms` để không gọi API mỗi phím gõ. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Hỏi BE handle còn trống không (chỉ khi `enabled`: đã đổi so với bản lưu và đúng định dạng). */
export function useHandleAvailability(handle: string, enabled: boolean) {
  return useQuery({
    queryKey: ['settings', 'handle-available', handle],
    queryFn: ({ signal }) => fetchHandleAvailability(handle, signal),
    enabled,
    staleTime: 15_000,
    retry: false,
  });
}
