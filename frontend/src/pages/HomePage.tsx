import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { CategoryTabs } from '../features/courses/components/CategoryTabs';
import { CourseGrid } from '../features/courses/components/CourseGrid';
import { FilterBar, type ViewMode } from '../features/courses/components/FilterBar';
import { Pagination } from '../features/courses/components/Pagination';
import { PAGE_SIZE } from '../features/courses/constants';
import { useCategories, useCourses } from '../features/courses/queries';
import { useCourseFilters } from '../features/courses/useCourseFilters';
import { CommunityCta } from '../features/home/CommunityCta';
import { Hero } from '../features/home/Hero';

export function HomePage() {
  const { filters, page, setFilter, setPage, reset } = useCourseFilters();
  const [view, setView] = useState<ViewMode>('grid');

  const { data: categories = [] } = useCategories();
  const courses = useCourses({ ...filters, page, limit: PAGE_SIZE });

  const listTop = useRef<HTMLDivElement>(null);
  // Cuộn về đầu danh sách khi đổi trang / tìm kiếm (không cuộn ở lần render đầu)
  const prev = useRef({ page, q: filters.q });
  useEffect(() => {
    if (prev.current.page !== page || prev.current.q !== filters.q) {
      listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    prev.current = { page, q: filters.q };
  }, [page, filters.q]);

  // Bấm "Khóa học" trên Header (điều hướng tới /#courses) sẽ cuộn tới đúng khu vực này.
  const location = useLocation();
  useEffect(() => {
    if (location.hash === '#courses') {
      const t = setTimeout(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      return () => clearTimeout(t);
    }
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/hero-bg.webp" alt="" className="absolute inset-0 size-full object-cover" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_520px_at_22%_55%,rgba(255,255,255,.75)_0%,rgba(255,255,255,.5)_45%,rgba(255,255,255,0)_75%)]" />
        <Header />
        <Hero onSearch={(q) => setFilter('q', q || undefined)} />
      </div>

      <div
        id="courses"
        ref={listTop}
        className="mx-auto flex max-w-[1400px] scroll-mt-24 items-end justify-between gap-4 px-4 pt-8 md:px-10"
      >
        <h2 className="m-0 flex items-center gap-2.5 text-[26px] font-bold">Khóa học nổi bật</h2>
        <Link to="/search" className="text-[15px] font-medium whitespace-nowrap text-brand hover:text-brand-dark">
          Xem tất cả →
        </Link>
      </div>

      <CategoryTabs
        categories={categories}
        active={filters.category}
        onChange={(id) => setFilter('category', id)}
      />

      <FilterBar
        filters={filters}
        onFilterChange={setFilter}
        view={view}
        onViewChange={setView}
        total={courses.data?.meta.total}
      />

      <section className="mx-auto max-w-[1400px] px-4 pt-5 md:px-10">
        <CourseGrid
          courses={courses.data?.data}
          view={view}
          loading={courses.isPending}
          error={courses.error}
          fetching={courses.isFetching}
          onRetry={() => courses.refetch()}
          onReset={reset}
        />
      </section>

      <Pagination page={page} totalPages={courses.data?.meta.totalPages ?? 1} onChange={setPage} />

      <CommunityCta />
      <Footer />
    </div>
  );
}
