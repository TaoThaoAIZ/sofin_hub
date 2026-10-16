import { PAGE_X } from '../lib/layout';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
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
import { WhyChoose } from '../features/home/WhyChoose';
import { ThemedImg } from '../components/ui/ThemedImg';
import { Hero } from '../features/home/Hero';
import { CreateCommunityPromo } from '../features/home/CreateCommunityPromo';

export function HomePage() {
  const { t } = useTranslation('home');
  const { filters, page, setFilter, setPage, reset } = useCourseFilters();
  const [view, setView] = useState<ViewMode>('grid');
  // Mobile: hàng bộ lọc (Giá/Loại/...) ẩn mặc định, bật bằng nút bộ lọc cạnh danh mục.
  const [showFilters, setShowFilters] = useState(false);

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
    <div className="flow-root min-h-screen bg-white dark:bg-[#0c1013]">
      <CreateCommunityPromo />
      {/* Header nằm TRỰC TIẾP trong trang (không trong khối hero) để sticky bám theo cả trang, không mất sau khi cuộn hết banner. */}
      <Header />
      {/* Hero (Figma 1800x800): ảnh nền có mặt nạ mờ dần, kéo lên sau Header (-mt = chiều cao Header 72 + lề 18). Không dùng overflow-hidden để khỏi cắt dropdown của Header. */}
      <div className="relative -mt-[90px] pt-[90px] max-md:mt-0 max-md:pt-0">
        <div
          className="pointer-events-none absolute inset-0 max-md:hidden [mask-image:url(/images/home/light/hero_mask.svg)] [mask-mode:alpha] [mask-repeat:no-repeat] [mask-size:100%_100%] dark:[mask-image:url(/images/home/dark/hero_mask.svg)]"
          aria-hidden="true"
        >
          <ThemedImg name="hero_bg" className="absolute inset-0 size-full object-cover object-[50%_76%] dark:object-center" />
        </div>
        <Hero onSearch={(q) => setFilter('q', q || undefined)} />
      </div>

      <section id="courses" ref={listTop} className={`${PAGE_X} scroll-mt-24 pt-[clamp(32px,3.33vw,60px)]`}>
        <h2 className="m-0 text-[clamp(26px,2vw,36px)] leading-[1.33] font-bold text-[#1c2433] max-md:hidden dark:text-white">{t('featured')}</h2>

        <CategoryTabs categories={categories} active={filters.category} onChange={(id) => setFilter('category', id)} onToggleFilters={() => setShowFilters((v) => !v)} filtersOpen={showFilters} />

        <div className={showFilters ? '' : 'max-md:hidden'}>
        <FilterBar
          filters={filters}
          onFilterChange={setFilter}
          view={view}
          onViewChange={setView}
          total={courses.data?.meta.total}
        />
        </div>

        <div className="pt-[clamp(20px,1.33vw,24px)]">
          <CourseGrid
            courses={courses.data?.data}
            view={view}
            loading={courses.isPending}
            error={courses.error}
            fetching={courses.isFetching}
            onRetry={() => courses.refetch()}
            onReset={reset}
          />
        </div>

        <Pagination page={page} totalPages={courses.data?.meta.totalPages ?? 1} onChange={setPage} />
      </section>

      {/* Bản mobile (Figma) kết thúc ở danh sách khóa học: ẩn các khối giới thiệu + Footer (liên kết pháp lý nằm trong ngăn kéo menu). */}
      <div className="max-md:hidden">
        <WhyChoose />
        <CommunityCta />
        <Footer />
      </div>
    </div>
  );
}
