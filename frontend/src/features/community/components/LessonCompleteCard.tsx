import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialIcon } from '../../../components/ui/MaterialIcon';

interface Props {
  /** Số thứ tự module vừa hoàn thành (khớp "#N" ở breadcrumb). */
  number: number;
  /** Đích của nút "Tiếp tục": bài đầu của module kế, hoặc null nếu hết khóa / module kế đang khóa. */
  nextTo: string | null;
  /** Về trang lớp học khi không còn bài kế. */
  classroomTo: string;
  onReview: () => void;
}

const btn = 'inline-flex h-12 w-[200px] items-center justify-center gap-2.5 rounded-[15px] border text-[15px] font-bold no-underline';

/** Màn chúc mừng hiện sau khi hoàn thành một bài học (Figma node 153:3758). */
export function LessonCompleteCard({ number, nextTo, classroomTo, onReview }: Props) {
  const { t } = useTranslation('course');
  return (
    <section
      aria-live="polite"
      className="relative flex min-h-[420px] flex-col items-center justify-center gap-[13px] overflow-hidden rounded-[20px] bg-cover bg-center px-6 pt-6 pb-16 text-center shadow-[1px_6px_15px_rgba(121,81,54,0.08)]"
      style={{ backgroundImage: 'url(/images/lesson/complete-bg.png)' }}
    >
      <div className="relative h-[249px] w-[409px] max-w-full overflow-hidden">
        <img
          src="/images/lesson/complete-trophy.png"
          alt=""
          className="absolute top-[-29.72%] left-[-0.37%] h-[164.26%] w-full max-w-none"
        />
      </div>
      <h2 className="m-0 text-[clamp(24px,4vw,38px)] leading-[1.42] font-bold text-black">{t('lesson.celebrate.title', { n: number })}</h2>
      <p className="m-0 max-w-[520px] text-[18px] leading-[26px] text-[#626262]">{t('lesson.celebrate.desc')}</p>
      <div className="flex flex-wrap items-center justify-center gap-[13px] pt-1.5">
        <button type="button" onClick={onReview} className={`${btn} cursor-pointer border-[#eee1d9] bg-white text-[#1e1c1a] dark:bg-white dark:text-[#1e1c1a]`}>
          <MaterialIcon name="play_arrow" size={20} />
          {t('lesson.celebrate.review')}
        </button>
        <Link
          to={nextTo ?? classroomTo}
          className={`${btn} border-[#ff6717] bg-[#ff6717] text-white shadow-[0_4px_10px_rgba(229,120,41,0.15)]`}
        >
          {nextTo ? t('lesson.celebrate.continue', { n: number + 1 }) : t('lesson.toClassroom')}
          <MaterialIcon name="arrow_forward" size={20} color="#fff" />
        </Link>
      </div>
    </section>
  );
}
