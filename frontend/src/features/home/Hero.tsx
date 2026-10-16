import { PAGE_X } from '../../lib/layout';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { ThemedImg } from '../../components/ui/ThemedImg';
import { usePlatformStats } from '../courses/queries';
import type { PlatformStats } from '../courses/types';

// Màu nền vòng tròn icon: sáng = pastel đặc, tối = màu icon ở độ mờ .16 (Figma "Learning statistic").
const STAT_ITEMS: {
  key: keyof PlatformStats;
  icon: string;
  bg: string;
  format: (n: number) => string;
}[] = [
  { key: 'learners', icon: 'stat_users', bg: 'bg-[#ffe8d6] dark:bg-[rgba(255,87,10,.16)]', format: (n) => n.toLocaleString(currentLocale()) },
  { key: 'courses', icon: 'stat_comm', bg: 'bg-[#ede7ff] dark:bg-[rgba(138,91,255,.16)]', format: (n) => n.toLocaleString(currentLocale()) },
  { key: 'instructors', icon: 'stat_cap', bg: 'bg-[#ddebff] dark:bg-[rgba(57,130,255,.16)]', format: (n) => n.toLocaleString(currentLocale()) },
  { key: 'rating', icon: 'stat_rating', bg: 'bg-[#dcfce8] dark:bg-[rgba(8,205,88,.16)]', format: (n) => `${n.toFixed(1)}/5` },
];

/** Nội dung hero (bản Figma "Trang chủ"): nhãn nền tảng, tiêu đề 2 dòng, mô tả, ô tìm kiếm, 4 số liệu. Kích thước co theo bề rộng (khung gốc 1800px). */
export function Hero({ onSearch }: { onSearch: (q: string) => void }) {
  const { t } = useTranslation('home');
  const [text, setText] = useState('');
  const { data: stats } = usePlatformStats();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(text.trim());
  };

  return (
    <section className={`${PAGE_X} relative flex flex-col items-start pt-[clamp(36px,5.5vw,100px)] pb-[clamp(36px,4.5vw,80px)] max-md:items-center max-md:pt-1 max-md:pb-3 max-md:text-center`}>
      <div className="flex h-[37px] items-center gap-2.5 rounded-full bg-white px-[19px] shadow-[0_8px_30px_rgba(159,126,103,0.06)] max-md:h-auto max-md:gap-1 max-md:bg-[rgba(124,124,124,.1)] max-md:px-2 max-md:py-0.5 dark:bg-[#333] dark:shadow-none">
        <ThemedImg name="cap_label" className="size-[19px] max-md:size-4" />
        <span className="text-[clamp(12px,0.89vw,16px)] leading-normal font-semibold max-md:leading-5 whitespace-nowrap text-brand">{t('hero.badge')}</span>
      </div>

      <h1 className="m-0 mt-6 text-[clamp(32px,3.17vw,57px)] leading-[1.175] max-md:mt-2.5 max-md:text-[26px] max-md:leading-8 font-extrabold tracking-[-0.5px] text-[#201e1c] dark:text-white">
        {t('hero.title1')}
        <br />
        <span className="text-brand">{t('hero.title2')}</span>
      </h1>

      <p className="mt-[22px] mb-0 max-w-[760px] text-[clamp(15px,1.22vw,22px)] leading-normal max-md:mt-2 max-md:text-sm max-md:leading-5 text-[#606060] text-pretty dark:text-[#bababa]">{t('hero.desc')}</p>

      <form
        onSubmit={submit}
        role="search"
        className="mt-[35px] flex h-[clamp(56px,4.1vw,74px)] w-full max-w-[800px] items-center gap-[18px] rounded-[28px] border border-white bg-white/85 pr-[9px] pl-[26px] max-md:mt-3 max-md:h-auto max-md:gap-2 max-md:rounded-[30px] max-md:border-[#cfcfcf] max-md:bg-white/60 max-md:py-1.5 max-md:pr-1.5 max-md:pl-3.5 shadow-[0_8px_30px_rgba(159,126,103,0.06)] dark:border-[rgba(161,161,161,.3)] dark:bg-[rgba(63,63,63,.3)]"
      >
        <ThemedImg name="search" className="size-6 flex-none max-md:size-5" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('hero.searchPlaceholder')}
          aria-label={t('hero.searchAria')}
          className="min-w-0 flex-1 border-0 bg-transparent text-[clamp(15px,1.11vw,20px)] max-md:text-sm text-[#201e1c] outline-0 placeholder:text-[#a6a19d] dark:text-white"
        />
        <button
          type="submit"
          className="h-[clamp(42px,3.33vw,60px)] w-[clamp(110px,10.6vw,191px)] flex-none rounded-[20px] bg-brand text-[clamp(14px,1.11vw,20px)] max-md:h-[38px] max-md:w-auto max-md:rounded-[34px] max-md:px-3 max-md:text-sm max-md:font-semibold font-medium whitespace-nowrap text-white shadow-[0_8px_30px_rgba(159,126,103,0.06)] hover:brightness-[1.06]"
        >
          {t('hero.searchButton')} →
        </button>
      </form>

      <div className="mt-[38px] flex flex-wrap gap-x-[clamp(20px,2vw,36px)] gap-y-5 max-md:hidden">
        {STAT_ITEMS.map((s) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`grid size-[clamp(44px,3vw,54px)] flex-none place-items-center rounded-full border border-white shadow-[0_8px_30px_rgba(159,126,103,0.06)] dark:border-transparent dark:shadow-none ${s.bg}`}>
              <ThemedImg name={s.icon} className="size-[clamp(20px,1.44vw,26px)]" />
            </div>
            <div className="whitespace-nowrap">
              <div className="text-[clamp(20px,1.55vw,28px)] leading-tight font-semibold text-[#201e1c] dark:text-white">
                {stats && stats[s.key] !== null ? s.format(stats[s.key] as number) : '–'}
              </div>
              <div className="text-[clamp(13px,0.94vw,17px)] leading-normal text-[#606060] dark:text-[#bababa]">{t(`hero.stats.${s.key}`)}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
