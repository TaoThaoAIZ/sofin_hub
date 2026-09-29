import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';
import { ApiError } from '../../../lib/api';
import { useClickOutside } from '../../../lib/useClickOutside';
import { useSuggest } from '../queries';
import { Highlight, RESULT_ICON, resultHref, resultTitle } from '../utils';
import type { SearchResult } from '../types';

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function subtitle(r: SearchResult) {
  if (r.type === 'course') return 'Khóa học';
  if (r.type === 'member') return `Thành viên · ${r.courseTitle}`;
  return `Bài viết · ${r.courseTitle}`;
}

/** Ô tìm kiếm có gợi ý (debounce 250ms, điều hướng bàn phím, ⌘K / Ctrl+K để focus). Enter -> /search?q=. */
export function SearchBox({ placeholder = 'Tìm kiếm bài viết, thành viên, chủ đề...' }: { placeholder?: string }) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  useClickOutside(wrapRef, () => setOpen(false));
  const debounced = useDebounced(q.trim(), 250);
  const suggest = useSuggest(debounced);
  const items = debounced.length >= 2 && debounced === q.trim() ? (suggest.data ?? []) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goSearch = () => {
    const term = q.trim();
    setOpen(false);
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  };

  const err = suggest.error instanceof ApiError ? suggest.error : null;
  const showPanel = open && q.trim().length >= 2;

  return (
    <form
      ref={wrapRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const chosen = items[active];
        if (chosen) {
          setOpen(false);
          navigate(resultHref(chosen));
        } else goSearch();
      }}
      className="relative ml-4 flex h-10 w-full max-w-[630px] items-center gap-2.5 rounded-xl border border-[rgba(120,60,20,.1)] bg-[#f7f4f2] px-3.5 max-md:ml-0"
    >
      <MaterialIcon name="search" size={19} color="#57534e" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(items.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        className="min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-0"
      />
      <kbd className="rounded-md bg-stone-900/8 px-1.5 py-0.5 text-[11px] text-stone-500 max-md:hidden">⌘K</kbd>

      {showPanel && (
        <div className="absolute top-[calc(100%+6px)] right-0 left-0 z-40 overflow-hidden rounded-2xl border border-[rgba(120,60,20,.12)] bg-white shadow-xl">
          {suggest.isFetching && items.length === 0 && <p className="px-4 py-3 text-[13px] text-stone-400">Đang tìm…</p>}
          {err && (
            <p className="px-4 py-3 text-[13px] text-red-600">
              {err.status === 429 ? 'Bạn tìm kiếm quá nhanh, vui lòng thử lại sau ít giây.' : err.message}
            </p>
          )}
          {!err && !suggest.isFetching && items.length === 0 && debounced === q.trim() && (
            <p className="px-4 py-3 text-[13px] text-stone-500">Không có gợi ý phù hợp.</p>
          )}
          {items.map((r, i) => (
            <button
              key={`${r.type}:${r.id}`}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                setOpen(false);
                navigate(resultHref(r));
              }}
              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${i === active ? 'bg-brand/10' : 'hover:bg-[#fff7f0]'}`}
            >
              <MaterialIcon name={RESULT_ICON[r.type]} size={19} color="#78716c" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">
                  {r.type === 'course' ? <Highlight segments={r.title} /> : r.type === 'member' ? <Highlight segments={r.name} /> : <Highlight segments={r.snippet} />}
                  {r.type === 'post' && <span className="sr-only">{resultTitle(r)}</span>}
                </span>
                <span className="block truncate text-[11.5px] text-stone-500">{subtitle(r)}</span>
              </span>
            </button>
          ))}
          <button type="button" onClick={goSearch} className="flex w-full items-center gap-2 border-t border-[rgba(120,60,20,.08)] px-4 py-2.5 text-left text-[13px] font-semibold text-brand hover:bg-brand/5">
            <MaterialIcon name="search" size={17} color="#f26a1b" />
            Xem tất cả kết quả cho "{q.trim()}"
          </button>
        </div>
      )}
    </form>
  );
}
