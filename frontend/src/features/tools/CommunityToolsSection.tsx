import { useTranslation } from 'react-i18next';
import { useTools } from './queries';

const MAX_TOOLS = 6;

/** Giới thiệu các công cụ hỗ trợ có trong cộng đồng (danh mục công cụ dùng chung của SofinHub), ở trang giới thiệu chi tiết cộng đồng. */
export function CommunityToolsSection({ className, titleClassName }: { className: string; titleClassName: string }) {
  const { t } = useTranslation('course');
  const { t: tt } = useTranslation('tools');
  const catalog = useTools();
  const tools = catalog.data?.tools.slice(0, MAX_TOOLS) ?? [];
  if (tools.length === 0) return null;

  return (
    <section className={`${className} flex flex-col gap-4`}>
      <div>
        <h2 className={titleClassName}>{t('detail.toolsTitle')}</h2>
        <p className="mt-1.5 mb-0 text-base leading-6 text-[#5c5855] dark:text-[#bababa]">{t('detail.toolsSub')}</p>
      </div>
      <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 max-md:grid-cols-1">
        {tools.map((tool) => (
          <li key={tool.id} className="flex items-start gap-3 rounded-2xl border border-[rgba(120,60,20,.1)] p-3.5 dark:border-white/10">
            <img src={tool.icon} alt="" loading="lazy" className="size-11 flex-none rounded-xl border border-brand/20 bg-brand-soft object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[15px] leading-tight font-bold text-[#201e1c] dark:text-white">{tool.name}</span>
                <span className="rounded-md bg-brand/15 px-1.5 py-px text-[11.5px] font-semibold text-brand-dark">{tool.category}</span>
              </div>
              <p className="mt-1 mb-0 line-clamp-2 text-[13.5px] leading-[1.5] text-[#5c5855] dark:text-[#bababa]">{tool.desc}</p>
              <span className={`mt-1.5 inline-block text-[12.5px] font-bold ${tool.free ? 'text-green-600' : 'text-brand'}`}>{tool.free ? tt('free') : tt('contact')}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
