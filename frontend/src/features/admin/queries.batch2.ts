import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import type { Paged } from './types';

/**
 * Hook chung cho Admin đợt 2 (hợp đồng backend/docs/api/admin-batch2.md).
 * Mọi query có khóa ['admin', ...] nên mọi thao tác ghi chỉ cần invalidate ['admin'].
 */

export type Q = Record<string, string | number | undefined>;

/** Danh sách có phân trang: GET /admin{path}. */
export const useAdminList = <T,>(key: string, path: string, q: Q, enabled = true) =>
  useQuery({
    queryKey: ['admin', key, 'list', q],
    queryFn: ({ signal }) => apiGet<Paged<T>>(`/admin${path}`, q, signal),
    placeholderData: keepPreviousData,
    enabled,
  });

/** Một đối tượng (summary / chi tiết / cấu hình): GET /admin{path} -> data. */
export const useAdminData = <T,>(key: string, path: string, q?: Q, enabled = true) =>
  useQuery({
    queryKey: ['admin', key, 'data', path, q],
    queryFn: ({ signal }) => apiGet<{ data: T }>(`/admin${path}`, q, signal).then((r) => r.data),
    enabled,
  });

export interface ActionVars {
  method?: 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  path: string;
  body?: unknown;
}

/** Thao tác ghi bất kỳ; xong thì làm mới toàn bộ cache ['admin']. Trả về `data` của phản hồi. */
export function useAdminAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ActionVars) => {
      const p = `/admin${v.path}`;
      const m = v.method ?? 'POST';
      const r = m === 'POST' ? await apiPost<{ data: unknown }>(p, v.body ?? {}) : m === 'PATCH' ? await apiPatch<{ data: unknown }>(p, v.body ?? {}) : m === 'PUT' ? await apiPut<{ data: unknown }>(p, v.body ?? {}) : await apiDelete<{ data: unknown }>(p);
      return r?.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Tiện ích: thoát khỏi `undefined` trong body trước khi gửi (JSON.stringify đã bỏ, nhưng giữ cho rõ). */
export const clean = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as Partial<T>;
