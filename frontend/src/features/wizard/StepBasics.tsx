import { useTranslation } from 'react-i18next';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { FieldError } from '../../components/ui/FieldMessage';
import type { Category } from '../courses/types';
import type { FieldErrors, WizardForm } from './form';
import { inputCls, WField } from './ui';

export interface StepProps {
  form: WizardForm;
  set: (patch: Partial<WizardForm>, clearErrors?: string[]) => void;
  errors: FieldErrors;
}

const CATEGORY_UI: Record<string, { icon: string; color: string }> = {
  business: { icon: 'work', color: '#f59e0b' },
  content: { icon: 'edit_note', color: '#ef4444' },
  tech: { icon: 'computer', color: '#2563eb' },
  finance: { icon: 'paid', color: '#eab308' },
  health: { icon: 'monitor_heart', color: '#e11d48' },
  self: { icon: 'person', color: '#8b5cf6' },
  hobby: { icon: 'favorite', color: '#ef4444' },
  relationships: { icon: 'diversity_3', color: '#4f46e5' },
};

export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export function StepBasics({
  form,
  set,
  errors,
  categories,
  slugStatus,
  slugReason,
  onSlugChange,
  onNameChange,
}: StepProps & {
  categories: Category[];
  slugStatus: SlugStatus;
  slugReason?: string;
  onSlugChange: (v: string) => void;
  onNameChange: (v: string) => void;
}) {
  const { t } = useTranslation('wizard');
  return (
    <div className="flex flex-col gap-[22px] rounded-[18px] border border-[#f0ebe6] bg-white p-[22px] shadow-[0_4px_16px_rgba(120,60,20,.04)]">
      <WField icon="auto_awesome" label={t('basics.name')} htmlFor="wz-name" error={errors.name} hint={t('basics.nameHint')} right={`${form.name.length}/30`}>
        <input
          id="wz-name"
          value={form.name}
          maxLength={30}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('basics.namePlaceholder')}
          aria-invalid={!!errors.name}
          className={`${inputCls(errors.name)} h-12`}
        />
      </WField>

      <WField icon="link" label={t('basics.slug')} htmlFor="wz-slug" error={errors.slug} hint={t('basics.slugHint')}>
        <div className={`flex h-12 overflow-hidden rounded-xl border-[1.5px] focus-within:border-brand ${errors.slug ? 'border-red-400' : 'border-[#e7e0da]'}`}>
          <span className="flex flex-none items-center border-r-[1.5px] border-[#e7e0da] bg-[#f5f2ef] px-4 text-[15px] font-semibold text-stone-600 max-sm:px-2.5 max-sm:text-[13px]">sofinhub.com/</span>
          <input
            id="wz-slug"
            value={form.slug}
            maxLength={40}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder={t('basics.slugPlaceholder')}
            aria-invalid={!!errors.slug}
            className="min-w-0 flex-1 border-0 px-3.5 text-[15px] font-medium outline-0"
          />
          <SlugBadge status={slugStatus} />
        </div>
        {(slugStatus === 'taken' || slugStatus === 'invalid') && !errors.slug && slugReason && <FieldError>{slugReason}</FieldError>}
      </WField>

      <WField icon="description" label={t('basics.description')} htmlFor="wz-desc" error={errors.description} hint={t('basics.descriptionHint')} right={`${form.description.length}/150`}>
        <textarea
          id="wz-desc"
          value={form.description}
          maxLength={150}
          onChange={(e) => set({ description: e.target.value }, ['description'])}
          placeholder={t('basics.descriptionPlaceholder')}
          aria-invalid={!!errors.description}
          className={`${inputCls(errors.description)} h-[84px] resize-none py-3 leading-[1.55]`}
        />
      </WField>

      <WField icon="sell" label={t('basics.category')} error={errors.category}>
        <div role="radiogroup" aria-label={t('basics.category')} className="flex flex-wrap gap-2.5">
          {categories.map((c) => {
            const on = form.category === c.id;
            const ui = CATEGORY_UI[c.id] ?? { icon: 'sell', color: '#f26a1b' };
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ category: c.id }, ['category'])}
                className={`flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${on ? 'bg-brand-gradient border-0 text-white shadow-[0_6px_14px_rgba(242,106,27,.28)]' : 'border-[1.5px] border-[#ece5df] bg-white text-stone-800'}`}
              >
                <MaterialIcon name={ui.icon} size={19} filled color={on ? '#fff' : ui.color} />
                {c.name}
              </button>
            );
          })}
        </div>
      </WField>
    </div>
  );
}

function SlugBadge({ status }: { status: SlugStatus }) {
  const { t } = useTranslation('wizard');
  if (status === 'idle') return null;
  const map = {
    checking: { icon: 'progress_activity', text: t('basics.slugChecking'), cls: 'text-stone-500' },
    available: { icon: 'check', text: t('basics.slugAvailable'), cls: 'text-green-700' },
    taken: { icon: 'close', text: t('basics.slugTaken'), cls: 'text-red-700' },
    invalid: { icon: 'close', text: t('basics.slugInvalid'), cls: 'text-red-700' },
  } as const;
  const m = map[status];
  return (
    <span role="status" className={`flex flex-none items-center gap-1 px-3.5 text-sm font-semibold max-sm:px-2 max-sm:text-xs ${m.cls}`}>
      <MaterialIcon name={m.icon} size={18} />
      {m.text}
    </span>
  );
}
