import type { ReactNode } from 'react';
import { FieldError, FieldHint } from '../../../components/ui/FieldMessage';

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  type?: 'text' | 'url' | 'password' | 'email';
  autoComplete?: string;
  maxLength?: number;
  rows?: number;
}

const INPUT = 'w-full rounded-2xl border bg-white/80 px-4 py-3 text-[15px] outline-0 focus:border-brand';

/** Ô nhập có nhãn phía trên (dùng cho form Cài đặt / Liên hệ). */
export function Field({ label, value, onChange, error, hint, multiline, type = 'text', autoComplete, maxLength, rows = 4 }: Props) {
  const border = error ? 'border-red-400' : 'border-[rgba(120,60,20,.12)]';
  return (
    <label className="block">
      <span className="mb-1.5 ml-1 block text-[13px] font-semibold text-stone-700">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} ${border} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT} ${border}`}
        />
      )}
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </label>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const cls =
    kind === 'error' ? 'bg-red-50 text-red-600' : kind === 'success' ? 'bg-green-50 text-green-700' : 'bg-brand/10 text-brand-dark';
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-2.5 text-sm font-medium ${cls}`}>
      {children}
    </div>
  );
}
