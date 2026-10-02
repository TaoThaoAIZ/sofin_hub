import { useId } from 'react';
import { BRAND_LABEL, detectBrand, formatCardNumber, formatExpiry, digitsOnly, type CardBrand, type CardErrors, type CardForm } from '../../lib/card';
import { MaterialIcon } from './MaterialIcon';
import { FieldError } from './FieldMessage';

const BRAND_STYLE: Record<CardBrand, { bg: string; fg: string; text: string }> = {
  visa: { bg: '#1a1f71', fg: '#fff', text: 'VISA' },
  mastercard: { bg: '#eb001b', fg: '#fff', text: 'MC' },
  amex: { bg: '#2e77bc', fg: '#fff', text: 'AMEX' },
  discover: { bg: '#f58220', fg: '#fff', text: 'DISC' },
  jcb: { bg: '#0b7a3b', fg: '#fff', text: 'JCB' },
  unknown: { bg: '', fg: '', text: '' },
};

export function CardBrandIcon({ brand, size = 24 }: { brand: CardBrand; size?: number }) {
  const s = BRAND_STYLE[brand];
  if (brand === 'unknown') return <MaterialIcon name="credit_card" size={size} filled color="#78716c" />;
  return (
    <span
      title={BRAND_LABEL[brand]}
      className="inline-grid h-5 min-w-[34px] place-items-center rounded px-1 text-[10px] font-extrabold tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.text}
    </span>
  );
}

/**
 * Ô nhập thẻ (số thẻ, MM / YY, CVC): tự định dạng khi gõ, chỉ nhận chữ số. Giá trị thô CHỈ nằm trong state của
 * component cha và bị bỏ ngay sau khi tokenise — không bao giờ gửi đi hay lưu.
 *  - `inline`: một khung bo tròn gồm 3 ô (như hộp thoại thanh toán).
 *  - `stacked`: 3 ô có nhãn riêng (như bước chọn gói của chủ cộng đồng).
 */
export function CardFields({
  value,
  onChange,
  errors = {},
  variant = 'inline',
  disabled,
}: {
  value: CardForm;
  onChange: (v: CardForm) => void;
  errors?: CardErrors;
  variant?: 'inline' | 'stacked';
  disabled?: boolean;
}) {
  const id = useId();
  const brand = detectBrand(value.number);
  const cvcMax = brand === 'amex' ? 4 : 3;
  const set = (patch: Partial<CardForm>) => onChange({ ...value, ...patch });

  const numberInput = (
    <input
      id={`${id}-number`}
      name="cc-number"
      autoComplete="cc-number"
      inputMode="numeric"
      value={value.number}
      disabled={disabled}
      onChange={(e) => set({ number: formatCardNumber(e.target.value) })}
      placeholder={variant === 'inline' ? 'Số thẻ' : '1234 1234 1234 1234'}
      aria-label="Số thẻ"
      aria-invalid={!!errors.number}
      className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium outline-0"
    />
  );
  const expInput = (
    <input
      id={`${id}-exp`}
      name="cc-exp"
      autoComplete="cc-exp"
      inputMode="numeric"
      value={value.expiry}
      disabled={disabled}
      onChange={(e) => set({ expiry: formatExpiry(e.target.value) })}
      placeholder="MM / YY"
      maxLength={7}
      aria-label="Ngày hết hạn (MM / YY)"
      aria-invalid={!!errors.expiry}
      className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium outline-0"
    />
  );
  const cvcInput = (
    <input
      id={`${id}-cvc`}
      name="cc-csc"
      autoComplete="cc-csc"
      inputMode="numeric"
      value={value.cvc}
      disabled={disabled}
      onChange={(e) => set({ cvc: digitsOnly(e.target.value).slice(0, cvcMax) })}
      placeholder="CVC"
      maxLength={cvcMax}
      aria-label="Mã CVC"
      aria-invalid={!!errors.cvc}
      className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium outline-0"
    />
  );
  const firstError = errors.number ?? errors.expiry ?? errors.cvc;

  if (variant === 'inline') {
    const hasErr = !!firstError;
    return (
      <div>
        <div className={`flex h-[50px] items-center rounded-xl border-[1.5px] bg-white px-3.5 focus-within:border-brand ${hasErr ? 'border-red-400' : 'border-[#e7e0da]'}`}>
          <span className="mr-3 flex-none">
            <CardBrandIcon brand={brand} />
          </span>
          {numberInput}
          <span className="mx-2 h-6 w-px flex-none bg-[#e7e0da]" />
          <span className="flex w-[84px] flex-none">{expInput}</span>
          <span className="mx-2 h-6 w-px flex-none bg-[#e7e0da]" />
          <span className="flex w-[52px] flex-none">{cvcInput}</span>
        </div>
        {firstError && <FieldError>{firstError}</FieldError>}
      </div>
    );
  }

  const box = (err?: string) => `flex h-[50px] items-center rounded-xl border-[1.5px] bg-white px-3.5 focus-within:border-brand ${err ? 'border-red-400' : 'border-[#e7e0da]'}`;
  return (
    <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
      <div className="min-w-[200px] [grid-column:span_2]">
        <label htmlFor={`${id}-number`} className="mb-2.5 flex items-center gap-2.5 text-[15px] font-bold">
          <span className="grid size-8 place-items-center rounded-full bg-[#fff1e6]">
            <MaterialIcon name="credit_card" size={18} color="#f26a1b" />
          </span>
          Thông tin thanh toán
        </label>
        <div className={box(errors.number)}>
          {numberInput}
          <CardBrandIcon brand={brand} size={22} />
        </div>
        {errors.number && <FieldError>{errors.number}</FieldError>}
      </div>
      <div>
        <label htmlFor={`${id}-exp`} className="mb-2.5 block text-[15px] font-bold">Hết hạn</label>
        <div className={box(errors.expiry)}>
          {expInput}
          <MaterialIcon name="calendar_today" size={20} color="#78716c" />
        </div>
        {errors.expiry && <FieldError>{errors.expiry}</FieldError>}
      </div>
      <div>
        <label htmlFor={`${id}-cvc`} className="mb-2.5 block text-[15px] font-bold">CVC</label>
        <div className={box(errors.cvc)}>
          {cvcInput}
          <MaterialIcon name="lock" size={20} color="#78716c" />
        </div>
        {errors.cvc && <FieldError>{errors.cvc}</FieldError>}
      </div>
    </div>
  );
}
