import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../../components/ui/Button';

/** Box "Tạo cộng đồng của riêng bạn" — nền ảnh cta-mockup + 2 thẻ kính nổi bên phải. */
export function CommunityCta() {
  const { t } = useTranslation('home');
  return (
    <section className="mx-auto max-w-[1400px] px-4 pt-12 pb-12 md:px-10">
      <div className="relative grid min-h-[340px] items-center gap-8 overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#fff7f0_0%,#ffe9d9_100%)] px-6 py-10 shadow-[0_24px_50px_rgba(242,106,27,.12)] md:grid-cols-2 md:px-12 md:py-11">
        <img src="/images/cta-mockup.webp" alt="" className="absolute inset-0 z-0 size-full object-cover" />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(255,248,242,.96)_0%,rgba(255,248,242,.85)_38%,rgba(255,248,242,.25)_62%,rgba(255,248,242,0)_75%)]" />

        <div className="relative z-[1] text-stone-900">
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(242,106,27,.25)] bg-white/70 px-3.5 py-[7px] text-[13px] font-medium text-[#9a3d0a] backdrop-blur-[12px]">
            <span className="text-brand" aria-hidden="true">
              ✦
            </span>
            {t('cta.badge')}
          </span>
          <h2 className="mt-[18px] mb-0 text-[clamp(28px,2.8vw,40px)] leading-[1.15] font-extrabold tracking-[-1px]">
            {t('cta.title')}
          </h2>
          <p className="mt-3.5 mb-0 max-w-[520px] text-base leading-[1.65] text-stone-600 text-pretty">
            {t('cta.desc')}
          </p>
          <ButtonLink to="/communities/new" className="mt-[26px] h-[52px] gap-2.5 rounded-2xl px-7 text-base font-semibold">
            {t('cta.button')} <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>

        <div className="pointer-events-none relative z-[1] hidden h-[260px] md:block" aria-hidden="true">
        </div>
      </div>
    </section>
  );
}
