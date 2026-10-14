import { useQuery } from '@tanstack/react-query';
import { fetchTools } from './api';

export const toolKeys = { catalog: ['tools', 'catalog'] as const };

/** Danh mục tool (tĩnh phía server) — cache lâu. */
export const useTools = () =>
  useQuery({
    queryKey: toolKeys.catalog,
    queryFn: ({ signal }) => fetchTools(signal),
    staleTime: 10 * 60_000,
  });
