import { Button } from '../../../components/ui/Button';
import { CourseCard } from './CourseCard';
import type { ViewMode } from './FilterBar';
import type { Course } from '../types';

interface Props {
  courses: Course[] | undefined;
  view: ViewMode;
  loading: boolean;
  error: Error | null;
  fetching: boolean;
  onRetry: () => void;
  onReset: () => void;
}

function Skeleton({ view }: { view: ViewMode }) {
  const list = view === 'list';
  return (
    <div className={`glass flex animate-pulse rounded-3xl p-2 ${list ? 'flex-row' : 'flex-col'}`}>
      <div className={`rounded-[18px] bg-stone-200/70 ${list ? 'h-[170px] w-[38%]' : 'h-[170px]'}`} />
      <div className="flex flex-1 flex-col gap-3 px-2.5 pt-4 pb-2">
        <div className="h-4 w-2/3 rounded bg-stone-200/70" />
        <div className="h-3 w-full rounded bg-stone-200/70" />
        <div className="h-3 w-4/5 rounded bg-stone-200/70" />
        <div className="mt-3 h-9 w-24 rounded-full bg-stone-200/70" />
      </div>
    </div>
  );
}

function Message({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
      <p className="text-base font-semibold text-stone-700">{title}</p>
      <Button onClick={onAction} className="h-10 rounded-[14px] px-[18px] text-sm font-semibold">
        {action}
      </Button>
    </div>
  );
}

export function CourseGrid({ courses, view, loading, error, fetching, onRetry, onReset }: Props) {
  if (error && !courses) return <Message title={error.message} action="Thử lại" onAction={onRetry} />;

  if (loading) {
    return (
      <div className="course-grid" data-view={view} aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} view={view} />
        ))}
      </div>
    );
  }

  if (!courses?.length) {
    return <Message title="Không tìm thấy khóa học phù hợp." action="Xóa bộ lọc" onAction={onReset} />;
  }

  return (
    <div
      className={`course-grid transition-opacity ${fetching ? 'opacity-60' : ''}`}
      data-view={view}
      aria-busy={fetching}
    >
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} view={view} />
      ))}
    </div>
  );
}
