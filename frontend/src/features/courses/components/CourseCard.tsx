import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThemedImg } from '../../../components/ui/ThemedImg';
import { formatCompact } from '../../../lib/format';
import { TAG_UI } from '../constants';
import type { Course } from '../types';
import type { ViewMode } from './FilterBar';

/**
 * Thẻ cộng đồng (Figma "Thẻ cộng đồng" 372x428): ảnh 1672:941 bo 20, tiêu đề 20/28 bold, mô tả 2 dòng 16/24, chip học phí, thống kê, nút tròn mũi tên.
 * Cả thẻ bấm được (stretched link ở tiêu đề); nút mũi tên chỉ là dấu hiệu hình ảnh nên không phải link riêng.
 */
export function CourseCard({ course, view }: { course: Course; view: ViewMode }) {
  const { t } = useTranslation('course');
  const list = view === 'list';
  const tag = course.tag ? TAG_UI[course.tag] : null;

  return (
    <article
      className={`relative flex cursor-pointer overflow-hidden rounded-[28px] bg-white px-2.5 pt-2.5 pb-4 shadow-[1px_6px_15px_rgba(121,81,54,0.08)] transition duration-200 hover:-translate-y-[3px] hover:shadow-card-hover dark:bg-[rgba(63,63,63,.3)] dark:shadow-[1px_6px_30px_rgba(255,255,255,0.08)] ${
        list ? 'flex-row gap-3' : 'flex-col'
      }`}
    >
      <div className={`relative flex-none overflow-hidden rounded-[20px] ${list ? 'w-[38%] self-start' : 'w-full'}`}>
        <img src={course.thumbnail} alt={course.title} loading="lazy" className="aspect-[1672/941] w-full object-cover" />
        {tag && (
          <span
            className="absolute top-[clamp(10px,1vw,18px)] left-[clamp(10px,1vw,18px)] flex h-[34px] items-center rounded-full px-3.5 text-sm font-semibold"
            style={{ background: tag.bg, color: tag.fg }}
          >
            {t(tag.labelKey)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-[116px] min-w-0 flex-col gap-1 py-4 pr-1.5 pl-3">
          <h3 title={course.title} className="m-0 truncate text-[clamp(17px,1.11vw,20px)] leading-7 font-bold text-[#201e1c] dark:text-white">
            {/* Stretched link: ::after phủ cả thẻ (thẻ là phần tử `relative`) nên bấm bất kỳ đâu trên thẻ đều vào trang chi tiết; vẫn là liên kết thật cho bàn phím/trình đọc màn hình. */}
            <Link to={`/courses/${course.id}`} className="after:absolute after:inset-0 after:z-10 after:rounded-[28px] after:content-['']">
              {course.title}
            </Link>
          </h3>
          <p className="m-0 line-clamp-2 text-[clamp(14px,0.89vw,16px)] leading-6 text-[#62635f] dark:text-[#bababa]">{course.description}</p>
        </div>

        <div className="mt-auto flex flex-col items-stretch gap-2 px-3">
          <div className="flex">
            <span className="flex h-10 items-center rounded-full border border-[rgba(255,87,10,.3)] bg-[rgba(255,87,10,.12)] px-4 font-bold whitespace-nowrap text-[#f87b23]">
              {course.priceUsd === 0 ? (
                <span className="text-[clamp(16px,1.11vw,20px)] leading-[26px]">{t('list.free')}</span>
              ) : (
                <>
                  <span className="text-[clamp(16px,1.11vw,20px)] leading-[26px]">{Math.round(course.priceUsd).toLocaleString('vi-VN')}</span>
                  <span className="text-base leading-[26px] font-medium underline">&nbsp;đ</span>
                  <span className="text-base leading-[26px] font-medium">{t('list.perMonth')}</span>
                </>
              )}
            </span>
          </div>

          <div className="flex h-11 items-center justify-between gap-2 whitespace-nowrap">
            <div className="flex items-center gap-[18px] text-base text-[#62635f] dark:text-[#bababa]">
              <span className="flex items-center gap-1.5">
                <ThemedImg name="card_members" className="size-[17px]" />
                {formatCompact(course.students)}
              </span>
              <span className="flex items-center gap-[7px]">
                <ThemedImg name="card_star" className="size-4" />
                {course.rating} ({course.ratingCount})
              </span>
            </div>
         </div>
        </div>
      </div>
    </article>
  );
}
