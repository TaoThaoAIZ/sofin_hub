import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Footer } from '../components/layout/Footer';
import { Header } from '../components/layout/Header';
import { ALL_CATEGORY, type DownloadTool } from '../features/tools/catalog';
import { useTools } from '../features/tools/queries';
import { ToolCard } from '../features/tools/ToolCard';
import { ToolLeadForm } from '../features/tools/ToolLeadForm';

/** Nội dung trang công cụ (bộ lọc + thẻ + form mua): dùng ở /tools và ở mục "Công cụ hỗ trợ" trong cộng đồng. */
export function ToolsContent() {
  const { t } = useTranslation('tools');
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [buying, setBuying] = useState<DownloadTool | null>(null);
  const catalog = useTools();

  const tools = catalog.data?.tools ?? [];
  const list = category === ALL_CATEGORY ? tools : tools.filter((x) => x.category === category);

  return (
    <>
      <div className="flex w-full min-w-0 flex-col gap-6">
        <section className="glass rounded-3xl p-6">
          <h1 className="m-0 text-[clamp(26px,3vw,36px)] font-extrabold tracking-[-1px] uppercase">{t('title')}</h1>
          <p className="mt-2 mb-0 text-stone-600">{t('subtitle')}</p>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-stone-500">{t('categoryLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {[ALL_CATEGORY, ...(catalog.data?.categories ?? [])].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={
                  category === c
                    ? 'bg-brand-gradient shadow-brand-chip rounded-xl px-4 py-2 text-sm font-semibold text-white'
                    : 'glass-chip rounded-xl px-4 py-2 text-sm font-semibold text-stone-600 hover:text-brand'
                }
              >
                {c === ALL_CATEGORY ? t('all') : c}
              </button>
            ))}
          </div>
        </div>

        {catalog.isPending ? (
          <div className="glass rounded-3xl p-10 text-center text-stone-500">{t('loading')}</div>
        ) : catalog.isError ? (
          <div role="alert" className="glass rounded-3xl p-10 text-center text-stone-500">
            {t('loadError')}{' '}
            <button type="button" onClick={() => void catalog.refetch()} className="font-semibold text-brand underline">
              {t('retry')}
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center text-stone-500">{t('empty')}</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((tool) => (
              <ToolCard key={tool.id} tool={tool} onBuy={setBuying} />
            ))}
          </div>
        )}
      </div>
      {buying && <ToolLeadForm tool={buying} onClose={() => setBuying(null)} />}
    </>
  );
}

export function ToolsPage() {
  return (
    <div className="min-h-screen">
      <Header active="tools" />
      <main className="mx-auto w-full max-w-[1320px] px-4 py-8 md:px-10 md:py-12">
        <ToolsContent />
      </main>
      <Footer />
    </div>
  );
}
