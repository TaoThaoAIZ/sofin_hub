import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { GraduationCapIcon, PathIcon, SearchIcon } from '../../components/ui/icons';
import { usePlatformStats } from '../courses/queries';
import type { PlatformStats } from '../courses/types';

const STAT_ITEMS: {
  key: keyof PlatformStats;
  label: string;
  bg: string;
  fg: string;
  d: string;
  format: (n: number) => string;
}[] = [
  {
    key: 'learners',
    label: 'học viên đang học',
    bg: '#ffe7d4',
    fg: '#f26a1b',
    d: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
    format: (n) => `${Math.round(n / 1000)}K+`,
  },
  {
    key: 'courses',
    label: 'khóa học chất lượng',
    bg: '#ede9fe',
    fg: '#8b5cf6',
    d: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z',
    format: (n) => `${n.toLocaleString('vi-VN')}+`,
  },
  {
    key: 'instructors',
    label: 'chuyên gia, giảng viên',
    bg: '#dbeafe',
    fg: '#3b82f6',
    d: 'M12 4 2 9l10 5 10-5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6',
    format: (n) => `${n}+`,
  },
  {
    key: 'rating',
    label: 'đánh giá từ học viên',
    bg: '#dcfce7',
    fg: '#22c55e',
    d: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
    format: (n) => `${n}/5`,
  },
];

export function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  const [text, setText] = useState('');
  const { data: stats } = usePlatformStats();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(text.trim());
  };

  return (
    <section className="relative mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-8 px-4 pt-12 pb-12 md:px-10 md:pt-[72px] md:pb-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div>
        <div className="glass mb-[18px] inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-[0.5px] text-brand">
          <GraduationCapIcon size={16} />
          NỀN TẢNG HỌC TẬP TRỰC TUYẾN
        </div>

        <h1 className="m-0 text-[clamp(30px,3.2vw,50px)] leading-[1.1] font-extrabold tracking-[-2px] text-balance">
          Học kỹ năng mới.
          <br />
          <span className="text-brand sm:whitespace-nowrap">Phát triển cùng cộng đồng.</span>
        </h1>

        <p className="mt-[18px] max-w-[600px] text-lg leading-[1.6] text-stone-600 text-pretty">
          Hàng ngàn khóa học thực tế từ chuyên gia trong nhiều lĩnh vực. Học nhanh hơn, ứng dụng ngay và tạo giá trị
          cho bản thân.
        </p>

        <form
          onSubmit={submit}
          role="search"
          className="glass mt-7 flex max-w-[720px] items-center gap-3 rounded-[22px] py-1.5 pr-1.5 pl-5 [--glass-bg:rgba(255,255,255,.55)]"
        >
          <SearchIcon />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm kiếm khóa học, chủ đề, kỹ năng..."
            aria-label="Tìm kiếm khóa học"
            className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-0 placeholder:text-stone-400"
          />
          <Button type="submit" className="h-12 gap-2 rounded-2xl px-5 text-base font-semibold whitespace-nowrap sm:px-8">
            Tìm kiếm <span aria-hidden="true">→</span>
          </Button>
        </form>

        <div className="mt-7 flex flex-wrap gap-x-[clamp(12px,1.8vw,32px)] gap-y-4 whitespace-nowrap xl:flex-nowrap">
          {STAT_ITEMS.map((s) => (
            <div key={s.key} className="flex items-center gap-2.5">
              <div
                className="grid size-11 flex-none place-items-center rounded-full border border-white/80 shadow-[0_6px_16px_rgba(120,60,20,.08)]"
                style={{ background: s.bg }}
              >
                <PathIcon d={s.d} stroke={s.fg} />
              </div>
              <div>
                <div className="text-xl font-bold">{stats ? s.format(stats[s.key]) : '–'}</div>
                <div className="text-[13px] text-stone-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chừa chỗ cho phần ảnh người học ở hero-bg */}
      <div className="hidden h-[420px] lg:block" />
    </section>
  );
}
