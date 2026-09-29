import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { RequireLogin } from '../components/layout/RequireLogin';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { Pager } from '../components/ui/Pager';
import { ApiError } from '../lib/api';
import { formatRelative } from '../lib/datetime';
import { useMyCommunities, useSearch } from '../features/search/queries';
import type { SearchResult, SearchType } from '../features/search/types';
import { Highlight, RESULT_ICON, resultHref } from '../features/search/utils';

const TABS: { key: SearchType; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'courses', label: 'Khóa học' },
  { key: 'posts', label: 'Bài viết' },
  { key: 'members', label: 'Thành viên' },
];

function ResultRow({ r }: { r: SearchResult }) {
  return (
    <Link to={resultHref(r)} className="flex items-start gap-3 border-b border-[rgba(120,60,20,.06)] px-4 py-3.5 hover:bg-[#fff7f0]">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-brand/10">
        <MaterialIcon name={RESULT_ICON[r.type]} size={20} color="#f26a1b" />
      </span>
      <span className="min-w-0 flex-1">
        {r.type === 'course' && (
          <>
            <span className="block text-[14.5px] font-bold">
              <Highlight segments={r.title} />
            </span>
            <span className="block text-[13px] text-stone-600">
              <Highlight segments={r.snippet} />
            </span>
            <span className="text-[11.5px] text-stone-400">Khóa học</span>
          </>
        )}
        {r.type === 'member' && (
          <>
            <span className="block text-[14.5px] font-bold">
              <Highlight segments={r.name} /> <span className="text-[12.5px] font-normal text-stone-500">@{r.handle}</span>
            </span>
            <span className="text-[12px] text-stone-500">
              Thành viên · {r.role} · {r.courseTitle}
            </span>
          </>
        )}
        {r.type === 'post' && (
          <>
            <span className="block text-[13.5px] text-stone-800">
              <Highlight segments={r.snippet} />
            </span>
            <span className="text-[12px] text-stone-500">
              Bài viết của {r.author} · {r.courseTitle} · {formatRelative(r.createdAt)}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function SearchInner() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = (TABS.find((t) => t.key === params.get('type'))?.key ?? 'all') as SearchType;
  const courseId = params.get('courseId') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [input, setInput] = useState(q);
  useEffect(() => setInput(q), [q]);
  const communities = useMyCommunities();
  const tooShort = q.trim().length < 2;
  const result = useSearch({ q: q.trim(), type, courseId: courseId || undefined, page });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next);
  };

  const counts = result.data?.counts;
  const total = counts ? counts.courses + counts.members + counts.posts : undefined;
  const countOf: Record<SearchType, number | undefined> = { all: total, courses: counts?.courses, posts: counts?.posts, members: counts?.members };
  const err = result.error instanceof ApiError ? result.error : null;

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="mx-auto max-w-[820px] px-4 py-8 md:px-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: input.trim() || null, page: null });
          }}
          className="flex h-12 items-center gap-2.5 rounded-2xl border border-[rgba(120,60,20,.12)] bg-white px-4 focus-within:border-brand"
        >
          <MaterialIcon name="search" size={21} color="#57534e" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tìm khóa học, bài viết, thành viên..."
            maxLength={100}
            autoFocus
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-0"
          />
          <button type="submit" className="h-8 rounded-xl bg-brand px-4 text-[13px] font-bold text-white">
            Tìm
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => update({ type: t.key === 'all' ? null : t.key, page: null })}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-[13px] ${
                type === t.key ? 'border-transparent bg-brand font-bold text-white' : 'border-[rgba(120,60,20,.12)] bg-white font-medium'
              }`}
            >
              {t.label}
              {countOf[t.key] !== undefined && <span className="text-[11.5px] opacity-80">{countOf[t.key]}</span>}
            </button>
          ))}
          <select
            value={courseId}
            onChange={(e) => update({ courseId: e.target.value || null, page: null })}
            aria-label="Lọc theo cộng đồng"
            className="ml-auto h-9 max-w-[220px] rounded-xl border border-[rgba(120,60,20,.12)] bg-white px-3 text-[13px]"
          >
            <option value="">Mọi cộng đồng</option>
            {communities.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="glass mt-4 overflow-hidden rounded-3xl">
          {tooShort && <p className="py-12 text-center text-stone-500">Nhập ít nhất 2 ký tự để tìm kiếm.</p>}
          {!tooShort && result.isPending && <p className="py-12 text-center text-stone-400">Đang tìm…</p>}
          {err && (
            <p className="px-4 py-12 text-center text-red-600">
              {err.status === 429
                ? 'Bạn tìm kiếm quá nhiều lần, vui lòng thử lại sau ít phút.'
                : err.status === 403
                  ? 'Bạn không phải thành viên của cộng đồng đã chọn nên không thể tìm trong đó.'
                  : err.message}
            </p>
          )}
          {result.data?.data.length === 0 && <p className="py-12 text-center text-stone-500">Không có kết quả cho "{q}".</p>}
          {result.data?.data.map((r) => <ResultRow key={`${r.type}:${r.id}:${r.type === 'member' ? r.courseId : ''}`} r={r} />)}
        </div>
        <Pager page={page} totalPages={result.data?.meta.totalPages ?? 1} onChange={(p) => update({ page: p > 1 ? String(p) : null })} />
      </div>
    </div>
  );
}

export function SearchPage() {
  return (
    <RequireLogin>
      <SearchInner />
    </RequireLogin>
  );
}
