import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../../components/ui/Button';
import { ArrowRightIcon, StarIcon, UserIcon } from '../../../components/ui/icons';
import { formatCompact } from '../../../lib/format';
import { TAG_UI } from '../constants';
import type { Course } from '../types';
import type { ViewMode } from './FilterBar';

import { formatCents } from '../../../lib/datetime';
export function CourseCard({ course, view }: { course: Course; view: ViewMode }) {
  const { t } = useTranslation('course');
  const list = view === 'list';
  const tag = course.tag ? TAG_UI[course.tag] : null;

  return (
    <article
      className={`glass flex overflow-hidden rounded-3xl p-2 transition duration-200 hover:-translate-y-[3px] hover:shadow-card-hover ${
        list ? 'flex-row' : 'flex-col'
      }`}
    >
      <div
        className={`relative flex-none overflow-hidden rounded-[18px] ${list ? 'h-auto w-[38%]' : 'h-[170px] w-auto'}`}
      >
        <img src={course.thumbnail} alt={course.title} loading="lazy" className="size-full object-cover" />
        {tag && (
          <span
            className="absolute top-3 left-3.5 rounded-full border border-white/60 px-2.5 py-1 text-[13px] font-semibold"
            style={{ background: tag.bg, color: tag.fg }}
          >
            {t(tag.labelKey)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 px-2.5 pt-3.5 pb-1.5">
        <div className="min-w-0">
          <h3 title={course.title} className="m-0 truncate text-[17px] font-bold">
            {course.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-normal text-stone-600">{course.description}</p>
        </div>

        <div className="mt-auto flex flex-col items-stretch gap-2.5">
          <div className="flex">
            <span className="flex h-9 items-center rounded-full border border-[rgba(242,106,27,.18)] bg-brand/10 px-3.5 text-base font-bold whitespace-nowrap text-brand">
              {course.priceUsd === 0 ? (
                t('list.free')
              ) : (
                <>
                  {formatCents(course.priceUsd)}
                  <span className="text-[13px] font-medium">{t('list.perMonth')}</span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-between gap-2 whitespace-nowrap">
            <div className="flex items-center gap-4 text-sm text-stone-600">
              <span className="flex items-center gap-1.5">
                <UserIcon size={16} />
                {formatCompact(course.students)}
              </span>
              <span className="flex items-center gap-1.5">
                <StarIcon size={16} />
                {course.rating} ({course.ratingCount})
              </span>
            </div>
            <ButtonLink
              to={`/courses/${course.id}`}
              aria-label={t('list.view', { title: course.title })}
              className="size-[38px] rounded-full"
            >
              <ArrowRightIcon size={16} />
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
