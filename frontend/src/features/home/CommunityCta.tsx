import { PAGE_X } from '../../lib/layout';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThemedImg } from '../../components/ui/ThemedImg';

/** Banner "Tạo cộng đồng của riêng bạn" (Figma 1560x348, bo 32): ảnh minh họa phủ cả khung, chữ bên trái. */
export function CommunityCta() {
  const { t } = useTranslation('home');
  return (
    <section className={`${PAGE_X} pb-[clamp(36px,3.3vw,60px)]`}>
      <div className="relative flex min-h-[clamp(280px,19.3vw,348px)] items-center overflow-clip rounded-[32px] shadow-[1px_6px_15px_rgba(121,81,54,0.08)] dark:shadow-none">
        <ThemedImg name="cta_img" className="pointer-events-none absolute inset-0 size-full object-cover object-right" />

        <div className="relative z-[1] flex w-full max-w-[560px] flex-col items-start gap-6 px-6 py-10 md:ml-[3%] md:px-0">
          <div className="flex flex-col items-start gap-1.5">
            <span className="flex h-[35px] items-center gap-2 rounded-[30px] border border-[#e9e9e9] bg-white/30 px-3.5 text-[13px] font-medium whitespace-nowrap text-[#af3e0b] dark:border-[rgba(233,233,233,.2)] dark:bg-white/[.08] dark:text-brand">
              <ThemedImg name="cta_star" className="h-3 w-2.5" />
              {t('cta.badge')}
            </span>
            <h2 className="m-0 text-[clamp(26px,2.11vw,38px)] leading-[1.5] font-extrabold text-[#211d19] dark:text-white">{t('cta.title')}</h2>
            <p className="m-0 max-w-[530px] text-[clamp(14px,0.89vw,16px)] leading-[27px] text-[#68615b] dark:text-[#bababa]">{t('cta.desc')}</p>
          </div>
          <Link
            to="/communities/new"
            className="flex h-[52px] items-center gap-2.5 rounded-[17px] bg-brand px-[27px] text-base font-bold whitespace-nowrap text-white shadow-[0_6px_12px_rgba(244,121,48,0.19)] hover:brightness-[1.06]"
          >
            {t('cta.button')}
            <ThemedImg name="cta_arrow" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
