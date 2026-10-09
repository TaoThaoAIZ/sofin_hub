import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { FieldError } from '../../components/ui/FieldMessage';
import { MaterialIcon } from '../../components/ui/MaterialIcon';
import { formatMoney } from '../../lib/format';
import { Modal, CancelButton, ErrorLine, errorText, PrimaryButton } from '../communities/components/Modal';
import { parseMoney, type WizardRule } from './form';
import type { StepProps } from './StepBasics';
import type { PayoutInfo } from './types';
import { CheckRow, inputCls, SectionCard, SegTabs } from './ui';

export function StepMembers({
  form,
  set,
  errors,
  currency,
  annualDiscountPct,
  net,
  feeNote,
  maxQuestions,
  payout,
  onConnectPayout,
  onSkipPayout,
  payoutBusy,
  payoutError,
}: StepProps & {
  currency: string;
  annualDiscountPct?: number;
  /** Số tiền chủ nhận về mỗi thành viên sau phí (BE tính). */
  net?: { monthly?: number; annual?: number };
  feeNote?: string;
  maxQuestions: number;
  payout?: PayoutInfo;
  onConnectPayout: (v: PayoutValues) => Promise<void>;
  onSkipPayout: () => void;
  payoutBusy: boolean;
  payoutError?: string;
}) {
  const { t } = useTranslation('wizard');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const paid = form.billing !== 'free';
  const setQ = (i: number, v: string) => set({ questions: form.questions.map((q, k) => (k === i ? v : q)) }, [`question-${i}`]);
  const bump = (key: 'priceMonthly' | 'priceAnnual', d: number) => {
    const next = Math.max(0, (parseMoney(form[key]) || 0) + d);
    set({ [key]: String(next) } as Partial<typeof form>, [key]);
  };
  const unit = currency === 'VND' ? 1000 : 1;
  const m = parseMoney(form.priceMonthly);
  const a = parseMoney(form.priceAnnual);
  const savings = m > 0 && a > 0 && a < m * 12 ? Math.round((1 - a / (m * 12)) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard icon="shield" title={t('members.privacy')}>
        <div role="radiogroup" aria-label={t('members.privacy')} className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {(
            [
              ['private', t('members.private'), 'lock', t('members.privateSub')],
              ['public', t('members.public'), 'public', t('members.publicSub')],
            ] as const
          ).map(([id, label, icon, sub]) => {
            const on = form.visibility === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => set({ visibility: id })} className={`flex gap-3 rounded-[14px] p-[18px] text-left ${on ? 'border-2 border-brand bg-[#fff7f1]' : 'border-[1.5px] border-[#ece5df] bg-white'}`}>
                <MaterialIcon name={on ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} color={on ? '#f26a1b' : '#c7bfb8'} />
                <span>
                  <span className="flex items-center gap-2 text-[15.5px] font-bold">
                    <MaterialIcon name={icon} size={22} color="#f26a1b" filled />
                    {label}
                  </span>
                  <span className="mt-1.5 block text-[13.5px] leading-[1.55] text-stone-600">{sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon="language" title={t('members.language')}>
        <select aria-label={t('members.language')} value={form.language} onChange={(e) => set({ language: e.target.value as 'vi' | 'en' })} className={`${inputCls()} h-12 w-full max-w-[320px] bg-white`}>
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </SectionCard>

      <SectionCard icon="database" title={t('members.price')}>
        <SegTabs
          value={form.billing}
          onChange={(billing) => set({ billing }, ['priceMonthly', 'priceAnnual'])}
          options={[
            { id: 'free', label: t('members.free') },
            { id: 'month', label: t('members.monthly') },
            { id: 'year', label: t('members.yearly'), badge: annualDiscountPct ? t('members.save', { pct: annualDiscountPct }) : undefined },
          ]}
        />
        {paid && (
          <>
            <div className="mt-3.5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              <PriceBox label={t('members.priceMonthly')} unit={t('members.perMonth')} value={form.priceMonthly} error={errors.priceMonthly} currency={currency} onChange={(v) => set({ priceMonthly: v }, ['priceMonthly'])} onStep={(d) => bump('priceMonthly', d * unit)} />
              {form.billing === 'year' && (
                <PriceBox label={t('members.priceYearly')} unit={t('members.perYear')} value={form.priceAnnual} error={errors.priceAnnual} currency={currency} onChange={(v) => set({ priceAnnual: v }, ['priceAnnual'])} onStep={(d) => bump('priceAnnual', d * unit * 10)} />
              )}
            </div>
            {form.billing === 'year' && savings > 0 && <p className="mt-2 mb-0 text-[13px] font-semibold text-green-700">{t('members.yearSavings', { pct: savings })}</p>}
            {net && (net.monthly || net.annual) ? (
              <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-stone-600">
                <span>
                  <Trans
                    ns="wizard"
                    i18nKey="members.netLine"
                    values={{ amount: formatMoney(form.billing === 'year' ? (net.annual ?? 0) : (net.monthly ?? 0), currency) }}
                    components={{ b: <b className="text-stone-900" /> }}
                  />
                </span>
                {feeNote && (
                  <span title={feeNote} className="inline-flex">
                    <MaterialIcon name="info" size={17} color="#a8a29e" />
                  </span>
                )}
              </div>
            ) : null}
          </>
        )}
      </SectionCard>

      <SectionCard icon="chat" title={t('members.questionsTitle')} right={<span className="text-sm text-stone-500">{t('members.questionsCount', { count: form.questions.length, max: maxQuestions })}</span>}>
        <div className="flex flex-col gap-2.5">
          {form.questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="drag_indicator" size={20} color="#c7bfb8" />
                <input aria-label={t('members.questionAria', { n: i + 1 })} value={q} maxLength={200} onChange={(e) => setQ(i, e.target.value)} placeholder={t('members.questionPlaceholder')} aria-invalid={!!errors[`question-${i}`]} className={`${inputCls(errors[`question-${i}`])} h-11 min-w-0 flex-1 text-[14.5px]`} />
                <button type="button" aria-label={t('members.removeQuestion')} onClick={() => set({ questions: form.questions.filter((_, k) => k !== i) })} className="grid size-9 flex-none place-items-center rounded-[10px] border border-[#ece5df] bg-white text-stone-500 hover:bg-red-50 hover:text-red-600">
                  <MaterialIcon name="delete" size={19} />
                </button>
              </div>
              {errors[`question-${i}`] && <FieldError indent>{errors[`question-${i}`]}</FieldError>}
            </div>
          ))}
          {form.questions.length < maxQuestions && (
            <button type="button" onClick={() => set({ questions: [...form.questions, ''] })} className="h-11 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fffaf6] text-sm font-bold text-brand">
              {t('members.addQuestion')}
            </button>
          )}
          {errors.questions && <FieldError>{errors.questions}</FieldError>}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[18px] border border-[#fdd5b8] bg-[linear-gradient(160deg,#fff7f0,#ffeede)] p-[22px]">
          <div className="flex items-center gap-3">
            <MaterialIcon name={payout?.status === 'connected' ? 'check_circle' : 'account_balance_wallet'} size={28} color="#f26a1b" filled />
            <span className="text-[16.5px] font-extrabold">{t('members.payoutTitle')}</span>
          </div>
          <p className="mt-3 mb-0 text-sm leading-relaxed text-stone-600">
            {payout?.status === 'connected'
              ? `${t('members.payoutConnected')}${payout.label ? ` ${payout.label}` : ''}.`
              : payout?.status === 'skipped'
                ? t('members.payoutSkipped')
                : t('members.payoutPrompt')}
          </p>
          {payout?.status !== 'connected' && (
            <>
              <Button onClick={() => setPayoutOpen(true)} disabled={payoutBusy} className="mt-4 h-12 w-full gap-2 rounded-xl text-[15px] font-bold">
                {payoutBusy ? t('members.connecting') : t('members.connectNow')}
                <MaterialIcon name="arrow_forward" size={19} color="#fff" />
              </Button>
              {payout?.status !== 'skipped' && (
                <button type="button" onClick={onSkipPayout} className="mt-3 w-full border-0 bg-transparent text-center text-[13.5px] font-semibold text-brand underline">
                  {t('members.skip')}
                </button>
              )}
            </>
          )}
          {payoutError && (
            <p role="alert" className="mt-2 mb-0 text-[13px] font-medium text-red-600">
              {payoutError}
            </p>
          )}
        </div>
        <SectionCard icon="description" title={t('members.rulesTitle')}>
          <CheckRow checked={form.rulesRequireAgreement} onChange={(v) => set({ rulesRequireAgreement: v })}>
            {t('members.requireRules')}
          </CheckRow>
          <CheckRow checked={form.rulesAutoApprovePaid} onChange={(v) => set({ rulesAutoApprovePaid: v })}>
            {t('members.autoApprovePaid')}
          </CheckRow>
          {errors.rules && <FieldError>{errors.rules}</FieldError>}
          <button type="button" onClick={() => setRulesOpen(true)} className="mt-2.5 flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-brand underline">
            {t('members.editRules')} <MaterialIcon name="arrow_forward" size={18} />
          </button>
        </SectionCard>
      </div>

      {payoutOpen && <PayoutDialog onClose={() => setPayoutOpen(false)} onSubmit={async (v) => { await onConnectPayout(v); setPayoutOpen(false); }} />}
      {rulesOpen && <RulesDialog rules={form.rules} onClose={() => setRulesOpen(false)} onSave={(rules) => { set({ rules }); setRulesOpen(false); }} />}
    </div>
  );
}

export interface PayoutValues {
  bankName: string;
  accountHolder: string;
  accountNumber: string;
}

function PayoutDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (v: PayoutValues) => Promise<void> }) {
  const { t } = useTranslation('wizard');
  const [v, setV] = useState<PayoutValues>({ bankName: '', accountHolder: '', accountNumber: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!v.bankName.trim()) e.bankName = t('members.payoutDialog.errBank');
    if (!v.accountHolder.trim()) e.accountHolder = t('members.payoutDialog.errHolder');
    if (!/^\d{6,20}$/.test(v.accountNumber)) e.accountNumber = t('members.payoutDialog.errNumber');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ bankName: v.bankName.trim(), accountHolder: v.accountHolder.trim(), accountNumber: v.accountNumber });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  const row = (key: keyof PayoutValues, label: string, placeholder: string, extra?: { inputMode?: 'numeric'; maxLength?: number }) => (
    <label className="block text-[13px] font-semibold text-stone-700">
      {label}
      <input
        value={v[key]}
        onChange={(e) => {
          setV({ ...v, [key]: extra?.inputMode ? e.target.value.replace(/\D/g, '') : e.target.value });
          setErrors({ ...errors, [key]: '' });
        }}
        placeholder={placeholder}
        inputMode={extra?.inputMode}
        maxLength={extra?.maxLength ?? 100}
        aria-invalid={!!errors[key]}
        className={`${inputCls(errors[key])} mt-1.5 h-11 font-normal`}
      />
      {errors[key] && <FieldError>{errors[key]}</FieldError>}
    </label>
  );
  return (
    <Modal
      title={t('members.payoutTitle')}
      icon="account_balance_wallet"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton onClick={() => void submit()} disabled={busy}>
            {busy ? t('members.connecting') : t('members.payoutDialog.connect')}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {row('bankName', t('members.payoutDialog.bank'), t('members.payoutDialog.bankPlaceholder'))}
        {row('accountHolder', t('members.payoutDialog.holder'), t('members.payoutDialog.holderPlaceholder'))}
        {row('accountNumber', t('members.payoutDialog.number'), t('members.payoutDialog.numberPlaceholder'), { inputMode: 'numeric', maxLength: 20 })}
        <p className="m-0 text-xs text-stone-500">{t('members.payoutDialog.note')}</p>
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    </Modal>
  );
}

function RulesDialog({ rules, onClose, onSave }: { rules: WizardRule[]; onClose: () => void; onSave: (r: WizardRule[]) => void }) {
  const { t } = useTranslation('wizard');
  const [list, setList] = useState<WizardRule[]>(rules.length ? rules : [{ title: '', body: '' }]);
  const upd = (i: number, patch: Partial<WizardRule>) => setList(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <Modal
      title={t('members.rulesDialog.title')}
      icon="description"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton onClick={() => onSave(list.map((r) => ({ title: r.title.trim(), body: r.body.trim() })).filter((r) => r.title))}>{t('members.rulesDialog.save')}</PrimaryButton>
        </>
      }
    >
      <p className="mt-0">{t('members.rulesDialog.intro')}</p>
      <div className="flex flex-col gap-3">
        {list.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input aria-label={t('members.rulesDialog.titleAria', { n: i + 1 })} value={r.title} maxLength={80} onChange={(e) => upd(i, { title: e.target.value })} placeholder={t('members.rulesDialog.titlePlaceholder')} className={`${inputCls()} h-10 font-semibold`} />
              <textarea aria-label={t('members.rulesDialog.bodyAria', { n: i + 1 })} value={r.body} maxLength={500} rows={2} onChange={(e) => upd(i, { body: e.target.value })} placeholder={t('members.rulesDialog.bodyPlaceholder')} className={`${inputCls()} resize-none py-2 text-sm`} />
            </div>
            <button type="button" aria-label={t('members.rulesDialog.remove')} onClick={() => setList(list.filter((_, k) => k !== i))} className="grid size-9 flex-none place-items-center rounded-lg border-0 bg-transparent text-stone-500 hover:bg-red-50 hover:text-red-600">
              <MaterialIcon name="delete" size={19} />
            </button>
          </div>
        ))}
        {list.length < 20 && (
          <button type="button" onClick={() => setList([...list, { title: '', body: '' }])} className="h-10 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fffaf6] text-sm font-bold text-brand">
            {t('members.rulesDialog.add')}
          </button>
        )}
      </div>
    </Modal>
  );
}

function PriceBox({ label, unit, value, error, currency, onChange, onStep }: { label: string; unit: string; value: string; error?: string; currency: string; onChange: (v: string) => void; onStep: (dir: 1 | -1) => void }) {
  const { t } = useTranslation('wizard');
  return (
    <div>
      <div className={`flex h-[58px] items-center rounded-[14px] border-[1.5px] pr-2.5 pl-4 focus-within:border-brand ${error ? 'border-red-400' : 'border-[#e7e0da]'}`}>
        {currency === 'USD' && <span className="mr-1 text-lg font-bold text-stone-500">$</span>}
        <input aria-label={label} inputMode={currency === 'VND' ? 'numeric' : 'decimal'} value={value} onChange={(e) => onChange(e.target.value.replace(currency === 'VND' ? /[^\d]/g : /[^\d.,]/g, ''))} placeholder={currency === 'VND' ? '199000' : '0'} aria-invalid={!!error} className="w-0 min-w-0 flex-1 border-0 text-[26px] font-extrabold tracking-[-0.5px] outline-0" />
        <span className="mr-2 text-sm whitespace-nowrap text-stone-500">{currency === 'USD' ? unit : `${currency} ${unit}`}</span>
        <div className="flex flex-col">
          <button type="button" aria-label={t('members.increase')} onClick={() => onStep(1)} className="border-0 bg-transparent p-0 leading-none text-stone-500">
            <MaterialIcon name="expand_less" size={20} />
          </button>
          <button type="button" aria-label={t('members.decrease')} onClick={() => onStep(-1)} className="border-0 bg-transparent p-0 leading-none text-stone-500">
            <MaterialIcon name="expand_more" size={20} />
          </button>
        </div>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
