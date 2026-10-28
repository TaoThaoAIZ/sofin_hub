import { PAGE_X } from '../../lib/layout';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../ui/BrandLogo';
import { ThemedImg } from '../ui/ThemedImg';

const LEGAL = [
  { key: 'terms', to: '/terms' },
  { key: 'privacy', to: '/privacy' },
  { key: 'cookie', to: '/privacy' },
] as const;

const CONTACTS = [
  { icon: 'f_mail', text: 'support@sofinhub.com' },
  { icon: 'f_phone', text: '0335 456 789' },
  { icon: 'f_map', text: '216 - 218 Trần Hưng Đạo St., Da Nang' },
] as const;

/** Footer (Figma "Footer (Desktop)"): logo + 4 biểu tượng mạng xã hội, 3 thẻ liên hệ, dòng bản quyền; thêm liên kết pháp lý (điều khoản/bảo mật/cookie). */
export function Footer() {
  const { t } = useTranslation('layout');
  return (
    <footer className={`${PAGE_X} flex flex-col gap-6 py-4 max-md:hidden`}>
      <div className="flex items-center justify-between gap-4">
        <BrandLogo className="h-[clamp(40px,3.1vw,56px)]" />
        {/* Biểu tượng mạng xã hội theo thiết kế; chưa có đường dẫn thật nên chỉ hiển thị. */}
        <div className="flex items-start gap-2" aria-hidden="true">
          <span className="grid size-[38px] place-items-center overflow-clip rounded-full bg-white">
            <ThemedImg name="soc53" className="size-[38px] rounded-full object-cover" lazy />
          </span>
          <ThemedImg name="soc54" className="size-[38px] rounded-[23px] object-cover" lazy />
          <span className="grid size-[38px] place-items-center overflow-clip rounded-full bg-white">
            <ThemedImg name="soc56" className="size-[38px] object-cover" lazy />
          </span>
          <span className="grid size-[38px] place-items-center overflow-clip rounded-full bg-white">
            <ThemedImg name="soc57" className="size-[38px] object-cover" lazy />
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 md:gap-6">
        {CONTACTS.map((c) => (
          <div
            key={c.icon}
            className="flex items-center justify-center gap-3 rounded-2xl border border-[rgba(224,224,224,.7)] bg-white/5 p-[clamp(16px,1.33vw,24px)] backdrop-blur-[10px] dark:border-[rgba(224,224,224,.2)] dark:bg-transparent"
          >
            <ThemedImg name={c.icon} className="size-6 flex-none" lazy />
            <span className="text-[clamp(14px,1vw,18px)] leading-6 font-medium text-[#201e1c] dark:text-white">{c.text}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-0 py-3 text-sm md:px-[clamp(0px,4.4vw,80px)]">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {LEGAL.map((l) => (
            <Link key={l.key} to={l.to} className="text-[#201e1c]/70 hover:text-brand dark:text-white/70 dark:hover:text-brand">
              {t(`footer.${l.key}`)}
            </Link>
          ))}
        </div>
        <span className="font-light text-[#201e1c] dark:text-white">{t('footer.copyright')}</span>
      </div>
    </footer>
  );
}
