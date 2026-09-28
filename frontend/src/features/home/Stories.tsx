import { useRef } from 'react';
import { PathIcon } from '../../components/ui/icons';
import { STORIES } from './storiesData';

/** Carousel "Câu chuyện từ cộng đồng": cuộn ngang, nút → nhảy 1 thẻ, hết thì quay về đầu. */
export function Stories() {
  const track = useRef<HTMLDivElement>(null);

  const next = () => {
    const el = track.current;
    if (!el) return;
    const step = el.firstElementChild instanceof HTMLElement ? el.firstElementChild.offsetWidth + 20 : 300;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    el.scrollLeft = atEnd ? 0 : el.scrollLeft + step;
  };

  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-12 pb-16 md:px-10">
      <div className="mb-[22px] flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[30px] font-extrabold tracking-[-0.5px]">Câu chuyện từ cộng đồng</h2>
          <p className="mt-1.5 mb-0 text-[15px] text-stone-600">
            Học viên, chuyên gia và doanh nghiệp đang tạo ra những thay đổi tích cực mỗi ngày.
          </p>
        </div>
        <a href="#" className="text-[15px] font-semibold whitespace-nowrap text-brand hover:text-brand-dark">
          Xem tất cả →
        </a>
      </div>

      <div className="relative">
        <div
          ref={track}
          className="no-scrollbar grid snap-x snap-mandatory auto-cols-[minmax(280px,calc((100%-60px)/4))] grid-flow-col gap-5 overflow-x-auto scroll-smooth px-0.5 pt-1.5 pb-[18px]"
        >
          {STORIES.map((s) => (
            <article
              key={s.id}
              className="flex snap-start flex-col gap-4 rounded-3xl border border-white/85 bg-white/55 p-[22px] shadow-[0_12px_30px_rgba(120,60,20,.1)] backdrop-blur-[22px] backdrop-saturate-[180%]"
            >
              <div className="flex items-center gap-3">
                <img src={s.avatar} alt="" loading="lazy" className="size-[52px] flex-none rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-bold">{s.name}</div>
                  <div className="text-[13px] text-stone-500">{s.role}</div>
                </div>
                <span
                  aria-hidden="true"
                  className="self-start pt-3.5 text-[44px] leading-[.5] font-extrabold text-[#fdba74]"
                >
                  “
                </span>
              </div>
              <p className="m-0 flex-1 text-[15px] leading-[1.65] text-stone-700 text-pretty">“{s.text}”</p>
              <div className="text-lg tracking-[2px] text-[#f59e0b]" aria-label="5 sao">
                ★★★★★
              </div>
            </article>
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Xem câu chuyện tiếp theo"
          className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-white/90 bg-white/80 shadow-[0_8px_20px_rgba(120,60,20,.14)] backdrop-blur-[16px] md:-right-[18px]"
        >
          <PathIcon d="M9 6l6 6-6 6" size={18} stroke="#1c1917" strokeWidth={2.4} />
        </button>
      </div>
    </section>
  );
}
