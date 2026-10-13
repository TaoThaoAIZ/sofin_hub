import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { ArrowRightIcon } from '../../components/ui/icons';
import type { DownloadTool } from './catalog';

interface Props {
  tool: DownloadTool;
  onBuy: (tool: DownloadTool) => void;
}

export function ToolCard({ tool, onBuy }: Props) {
  const { t } = useTranslation('tools');
  return (
    <article data-badge={!!tool.badge} className="glass tool-card flex cursor-default flex-col gap-4 rounded-3xl p-5">
      {tool.badge && (
        <span
          className={`absolute top-4 right-4 rounded-full px-2.5 py-1 text-[12px] font-bold ${
            tool.badge === 'HOT' ? 'bg-brand/15 text-brand' : 'bg-amber-400/20 text-amber-600'
          }`}
        >
          {tool.badge === 'HOT' ? t('badgeHot') : t('badgeNew')}
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className="size-12 flex-none overflow-hidden rounded-2xl border border-brand/20 bg-brand-soft">
          <img src={tool.icon} alt="" loading="lazy" className="size-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 pr-12">
          <h3 className="m-0 mb-1.5 text-[17px] leading-tight font-bold text-stone-900">{tool.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-brand/15 px-2 py-0.5 text-[12px] font-semibold text-brand-dark">
              {tool.category}
            </span>
            {tool.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-stone-900/5 px-2 py-0.5 text-[12px] text-stone-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="m-0 flex-1 text-[14px] leading-relaxed text-stone-600">{tool.desc}</p>

      <div className="flex items-center justify-between gap-3 border-t border-[rgba(120,60,20,.1)] pt-3">
        <span className={`text-[16px] font-bold ${tool.free ? 'text-green-600' : 'text-brand'}`}>
          {tool.free ? t('free') : t('contact')}
        </span>
        {tool.free && tool.downloadUrl ? (
          <a
            href={tool.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-gradient shadow-brand-chip inline-flex h-10 items-center gap-2 rounded-[14px] px-4 text-sm font-semibold text-white hover:brightness-[1.06]"
          >
            {t('downloadFree')} <ArrowRightIcon size={14} />
          </a>
        ) : (
          <Button variant="brand-chip" onClick={() => onBuy(tool)} className="h-10 gap-2 rounded-[14px] px-4 text-sm font-semibold">
            {t('buyNow')} <ArrowRightIcon size={14} />
          </Button>
        )}
      </div>
    </article>
  );
}
