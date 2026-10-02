import { useState } from 'react';
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
  trialDays,
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
  trialDays?: number;
  maxQuestions: number;
  payout?: PayoutInfo;
  onConnectPayout: (v: PayoutValues) => Promise<void>;
  onSkipPayout: () => void;
  payoutBusy: boolean;
  payoutError?: string;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const paid = form.billing !== 'free';
  const setQ = (i: number, v: string) => set({ questions: form.questions.map((q, k) => (k === i ? v : q)) }, [`question-${i}`]);
  const bump = (key: 'priceMonthly' | 'priceAnnual', d: number) => {
    const next = Math.max(0, (parseMoney(form[key]) || 0) + d);
    set({ [key]: String(next) } as Partial<typeof form>, [key]);
  };
  const unit = currency === 'VND' ? 10000 : 1;
  const m = parseMoney(form.priceMonthly);
  const a = parseMoney(form.priceAnnual);
  const savings = m > 0 && a > 0 && a < m * 12 ? Math.round((1 - a / (m * 12)) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <SectionCard icon="shield" title="Quyền riêng tư">
        <div role="radiogroup" aria-label="Quyền riêng tư" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {(
            [
              ['private', 'Riêng tư', 'lock', 'Chỉ thành viên thấy nội dung. Trang giới thiệu vẫn công khai.'],
              ['public', 'Công khai', 'public', 'Ai cũng xem được bài đăng, chỉ thành viên mới đăng bài.'],
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

      <SectionCard icon="database" title="Giá thành viên">
        <SegTabs
          value={form.billing}
          onChange={(billing) => set({ billing }, ['priceMonthly', 'priceAnnual'])}
          options={[
            { id: 'free', label: 'Miễn phí' },
            { id: 'month', label: 'Hàng tháng' },
            { id: 'year', label: 'Hàng năm', badge: annualDiscountPct ? `Tiết kiệm ${annualDiscountPct}%` : undefined },
          ]}
        />
        {paid && (
          <>
            <div className="mt-3.5 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              <PriceBox label="Giá hàng tháng" unit="/ tháng" value={form.priceMonthly} error={errors.priceMonthly} currency={currency} onChange={(v) => set({ priceMonthly: v }, ['priceMonthly'])} onStep={(d) => bump('priceMonthly', d * unit)} />
              {form.billing === 'year' && (
                <PriceBox label="Giá hàng năm" unit="/ năm" value={form.priceAnnual} error={errors.priceAnnual} currency={currency} onChange={(v) => set({ priceAnnual: v }, ['priceAnnual'])} onStep={(d) => bump('priceAnnual', d * unit * 10)} />
              )}
              {!!trialDays && trialDays > 0 && (
                <button type="button" role="checkbox" aria-checked={form.trialEnabled} onClick={() => set({ trialEnabled: !form.trialEnabled })} className="flex h-[58px] items-center gap-2.5 rounded-[14px] border-[1.5px] border-[#e7e0da] bg-white px-4 text-left text-[14.5px]">
                  <MaterialIcon name={form.trialEnabled ? 'check_box' : 'check_box_outline_blank'} size={24} filled={form.trialEnabled} color={form.trialEnabled ? '#f26a1b' : '#a8a29e'} />
                  Cho thành viên mới dùng thử {trialDays} ngày
                </button>
              )}
            </div>
            {form.billing === 'year' && savings > 0 && <p className="mt-2 mb-0 text-[13px] font-semibold text-green-700">Giá năm tiết kiệm {savings}% so với trả theo tháng.</p>}
            {net && (net.monthly || net.annual) ? (
              <div className="mt-2.5 flex items-center gap-1.5 text-[13px] text-stone-600">
                <span>
                  Bạn nhận về khoảng <b className="text-stone-900">{formatMoney(form.billing === 'year' ? (net.annual ?? 0) : (net.monthly ?? 0), currency)}</b> mỗi thành viên sau phí giao dịch.
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

      <SectionCard icon="chat" title="Câu hỏi khi xin gia nhập" right={<span className="text-sm text-stone-500">{form.questions.length} / {maxQuestions} câu</span>}>
        <div className="flex flex-col gap-2.5">
          {form.questions.map((q, i) => (
            <div key={i}>
              <div className="flex items-center gap-2.5">
                <MaterialIcon name="drag_indicator" size={20} color="#c7bfb8" />
                <input aria-label={`Câu hỏi ${i + 1}`} value={q} maxLength={200} onChange={(e) => setQ(i, e.target.value)} placeholder="Nhập câu hỏi..." aria-invalid={!!errors[`question-${i}`]} className={`${inputCls(errors[`question-${i}`])} h-11 min-w-0 flex-1 text-[14.5px]`} />
                <button type="button" aria-label="Xóa câu hỏi" onClick={() => set({ questions: form.questions.filter((_, k) => k !== i) })} className="grid size-9 flex-none place-items-center rounded-[10px] border border-[#ece5df] bg-white text-stone-500 hover:bg-red-50 hover:text-red-600">
                  <MaterialIcon name="delete" size={19} />
                </button>
              </div>
              {errors[`question-${i}`] && <FieldError indent>{errors[`question-${i}`]}</FieldError>}
            </div>
          ))}
          {form.questions.length < maxQuestions && (
            <button type="button" onClick={() => set({ questions: [...form.questions, ''] })} className="h-11 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fffaf6] text-sm font-bold text-brand">
              + Thêm câu hỏi
            </button>
          )}
          {errors.questions && <FieldError>{errors.questions}</FieldError>}
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[18px] border border-[#fdd5b8] bg-[linear-gradient(160deg,#fff7f0,#ffeede)] p-[22px]">
          <div className="flex items-center gap-3">
            <MaterialIcon name={payout?.status === 'connected' ? 'check_circle' : 'account_balance_wallet'} size={28} color="#f26a1b" filled />
            <span className="text-[16.5px] font-extrabold">Kết nối tài khoản nhận tiền</span>
          </div>
          <p className="mt-3 mb-0 text-sm leading-relaxed text-stone-600">
            {payout?.status === 'connected'
              ? `Đã kết nối tài khoản nhận tiền${payout.label ? ` ${payout.label}` : ''}.`
              : payout?.status === 'skipped'
                ? 'Bạn có thể kết nối sau trong Cài đặt cộng đồng. Cộng đồng trả phí cần tài khoản nhận tiền để rút doanh thu.'
                : 'Làm ngay hôm nay: lần chi trả đầu tiên cần xét duyệt danh tính và có thể mất vài ngày làm việc.'}
          </p>
          {payout?.status !== 'connected' && (
            <>
              <Button onClick={() => setPayoutOpen(true)} disabled={payoutBusy} className="mt-4 h-12 w-full gap-2 rounded-xl text-[15px] font-bold">
                {payoutBusy ? 'Đang kết nối…' : 'Kết nối ngay'}
                <MaterialIcon name="arrow_forward" size={19} color="#fff" />
              </Button>
              {payout?.status !== 'skipped' && (
                <button type="button" onClick={onSkipPayout} className="mt-3 w-full border-0 bg-transparent text-center text-[13.5px] font-semibold text-brand underline">
                  Bỏ qua, làm sau
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
        <SectionCard icon="description" title="Nội quy cộng đồng">
          <CheckRow checked={form.rulesRequireAgreement} onChange={(v) => set({ rulesRequireAgreement: v })}>
            Yêu cầu đồng ý nội quy
          </CheckRow>
          <CheckRow checked={form.rulesAutoApprovePaid} onChange={(v) => set({ rulesAutoApprovePaid: v })}>
            Tự duyệt người trả phí
          </CheckRow>
          {errors.rules && <FieldError>{errors.rules}</FieldError>}
          <button type="button" onClick={() => setRulesOpen(true)} className="mt-2.5 flex items-center gap-1.5 border-0 bg-transparent p-0 text-sm font-semibold text-brand underline">
            Sửa nội quy mẫu <MaterialIcon name="arrow_forward" size={18} />
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
  const [v, setV] = useState<PayoutValues>({ bankName: '', accountHolder: '', accountNumber: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!v.bankName.trim()) e.bankName = 'Nhập tên ngân hàng';
    if (!v.accountHolder.trim()) e.accountHolder = 'Nhập tên chủ tài khoản';
    if (!/^\d{6,20}$/.test(v.accountNumber)) e.accountNumber = 'Số tài khoản gồm 6–20 chữ số';
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
      title="Kết nối tài khoản nhận tiền"
      icon="account_balance_wallet"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton onClick={() => void submit()} disabled={busy}>
            {busy ? 'Đang kết nối…' : 'Kết nối'}
          </PrimaryButton>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {row('bankName', 'Ngân hàng', 'Ví dụ: Vietcombank')}
        {row('accountHolder', 'Chủ tài khoản', 'Họ và tên in trên tài khoản')}
        {row('accountNumber', 'Số tài khoản', '6–20 chữ số', { inputMode: 'numeric', maxLength: 20 })}
        <p className="m-0 text-xs text-stone-500">Chúng tôi chỉ lưu 4 số cuối của số tài khoản.</p>
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    </Modal>
  );
}

function RulesDialog({ rules, onClose, onSave }: { rules: WizardRule[]; onClose: () => void; onSave: (r: WizardRule[]) => void }) {
  const [list, setList] = useState<WizardRule[]>(rules.length ? rules : [{ title: '', body: '' }]);
  const upd = (i: number, patch: Partial<WizardRule>) => setList(list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  return (
    <Modal
      title="Sửa nội quy mẫu"
      icon="description"
      onClose={onClose}
      footer={
        <>
          <CancelButton onClick={onClose} />
          <PrimaryButton onClick={() => onSave(list.map((r) => ({ title: r.title.trim(), body: r.body.trim() })).filter((r) => r.title))}>Lưu nội quy</PrimaryButton>
        </>
      }
    >
      <p className="mt-0">Mỗi mục là một điều trong nội quy; thành viên mới sẽ thấy khi xin gia nhập.</p>
      <div className="flex flex-col gap-3">
        {list.map((r, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <input aria-label={`Tiêu đề điều ${i + 1}`} value={r.title} maxLength={80} onChange={(e) => upd(i, { title: e.target.value })} placeholder="Tiêu đề điều khoản" className={`${inputCls()} h-10 font-semibold`} />
              <textarea aria-label={`Nội dung điều ${i + 1}`} value={r.body} maxLength={500} rows={2} onChange={(e) => upd(i, { body: e.target.value })} placeholder="Mô tả ngắn (không bắt buộc)" className={`${inputCls()} resize-none py-2 text-sm`} />
            </div>
            <button type="button" aria-label="Xóa điều này" onClick={() => setList(list.filter((_, k) => k !== i))} className="grid size-9 flex-none place-items-center rounded-lg border-0 bg-transparent text-stone-500 hover:bg-red-50 hover:text-red-600">
              <MaterialIcon name="delete" size={19} />
            </button>
          </div>
        ))}
        {list.length < 20 && (
          <button type="button" onClick={() => setList([...list, { title: '', body: '' }])} className="h-10 rounded-xl border-[1.5px] border-dashed border-[#fdba74] bg-[#fffaf6] text-sm font-bold text-brand">
            + Thêm điều
          </button>
        )}
      </div>
    </Modal>
  );
}

function PriceBox({ label, unit, value, error, currency, onChange, onStep }: { label: string; unit: string; value: string; error?: string; currency: string; onChange: (v: string) => void; onStep: (dir: 1 | -1) => void }) {
  return (
    <div>
      <div className={`flex h-[58px] items-center rounded-[14px] border-[1.5px] pr-2.5 pl-4 focus-within:border-brand ${error ? 'border-red-400' : 'border-[#e7e0da]'}`}>
        {currency === 'USD' && <span className="mr-1 text-lg font-bold text-stone-500">$</span>}
        <input aria-label={label} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0" aria-invalid={!!error} className="w-0 min-w-0 flex-1 border-0 text-[26px] font-extrabold tracking-[-0.5px] outline-0" />
        <span className="mr-2 text-sm whitespace-nowrap text-stone-500">{currency === 'USD' ? unit : `${currency} ${unit}`}</span>
        <div className="flex flex-col">
          <button type="button" aria-label="Tăng giá" onClick={() => onStep(1)} className="border-0 bg-transparent p-0 leading-none text-stone-500">
            <MaterialIcon name="expand_less" size={20} />
          </button>
          <button type="button" aria-label="Giảm giá" onClick={() => onStep(-1)} className="border-0 bg-transparent p-0 leading-none text-stone-500">
            <MaterialIcon name="expand_more" size={20} />
          </button>
        </div>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
