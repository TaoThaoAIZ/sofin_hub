import { useCallback, useState } from 'react';
import type { CourseFilters } from './types';

/** State bộ lọc + trang. Đổi bất kỳ bộ lọc nào sẽ đưa về trang 1. */
export function useCourseFilters() {
  const [filters, setFilters] = useState<CourseFilters>({});
  const [page, setPage] = useState(1);

  const setFilter = useCallback(<K extends keyof CourseFilters>(key: K, value: CourseFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  return { filters, page, setFilter, setPage, reset };
}
