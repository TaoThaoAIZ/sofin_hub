import { PAGE_X } from '../../lib/layout';
import { useTranslation } from 'react-i18next';
import { ThemedImg } from '../../components/ui/ThemedImg';

const BENEFITS = [
  { key: 'experts', icon: 'why_g0', bg: 'bg-[rgba(255,87,10,.16)]' },
  { key: 'ai', icon: 'why_g1', bg: 'bg-[#efe7fd] dark:bg-[rgba(133,55,254,.16)]' },
  { key: 'community', icon: 'why_g2', bg: 'bg-[#e5effd] dark:bg-[rgba(7,99,253,.16)]' },
  { key: 'career', icon: 'why_g3', bg: 'bg-[#ddf8e8] dark:bg-[rgba(8,196,111,.16)]' },
] as const;

/** Khối "Vì sao nên chọn SofinHub?" (Figma 1800x530): tiêu đề giữa, 4 thẻ lợi ích, họa tiết chấm/vầng sáng trang trí. */
export function WhyChoose() {
  const { t } = useTranslation('home');
  return (
    <section className="relative overflow-hidden bg-white pt-[clamp(40px,3.9vw,70px)] pb-[clamp(40px,4.4vw,80px)] dark:bg-transparent">
      {/* Trang trí (vị trí tính theo khung 1800px) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
        <ThemedImg name="why_glow" className="absolute top-[87px] left-[-120px] size-[505px] max-w-none" lazy />
        <ThemedImg name="why_circle" className="absolute top-[130px] right-[2%] size-[88px]" lazy />
        <ThemedImg name="why_dot1" className="absolute top-[175px] right-[8%] size-3.5" lazy />
        <ThemedImg name="why_dot2" className="absolute top-[183px] left-[22px] size-[9px]" lazy />
        <ThemedImg name="why_pat1" className="absolute top-[174px] left-[50px] h-[50px] w-[99px]" lazy />
        <ThemedImg name="why_pat2" className="absolute right-[5px] bottom-[-7px] h-[50px] w-[99px]" lazy />
      </div>

      <div className={`${PAGE_X} relative`}>
        <div className="relative text-center">
          <h2 className="m-0 text-[clamp(26px,2vw,36px)] font-extrabold text-[#201e1c] dark:text-white">
            {t('why.title1')} <span className="text-[#ff5109]">SofinHub</span>
            {t('why.title2')}
          </h2>
          <p className="mx-auto mt-3 mb-0 max-w-[900px] text-[clamp(15px,1.11vw,20px)] leading-[1.5] text-[#7b7f95] dark:text-[#bababa]">{t('why.subtitle')}</p>
          <ThemedImg name="why_accent" className="pointer-events-none absolute top-[5px] right-[17%] hidden h-[41px] w-9 lg:block" lazy />
        </div>

        <div className="mt-[clamp(28px,2.2vw,40px)] grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((b) => (
            <div key={b.key} className="flex flex-col gap-[11px] rounded-[28px] bg-white p-[30px] shadow-soft-lg dark:bg-[rgba(63,63,63,.3)]">
              <div className={`flex w-fit items-center rounded-[70px] p-4 ${b.bg}`}>
                <div className="grid size-[60px] place-items-center overflow-clip">
                  <ThemedImg name={b.icon} className="size-full object-contain" lazy />
                </div>
              </div>
              <div className="flex flex-col gap-[13px]">
                <h3 className="m-0 text-[clamp(17px,1.11vw,20px)] leading-7 font-bold text-[#201e1c] dark:text-white">{t(`why.items.${b.key}.title`)}</h3>
                <p className="m-0 text-base leading-6 text-[#7b7f95] dark:text-[#bababa]">{t(`why.items.${b.key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
