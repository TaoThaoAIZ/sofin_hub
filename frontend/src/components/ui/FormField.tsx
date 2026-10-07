import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeIcon, LockIcon, MailIcon, UserGlyphIcon } from './icons';
import { FieldError, FieldHint } from './FieldMessage';

type FieldType = 'text' | 'email' | 'password';

const DEFAULT_ICON: Record<FieldType, ReactNode> = {
  text: <UserGlyphIcon />,
  email: <MailIcon />,
  password: <LockIcon />,
};

interface FormFieldProps {
  type: FieldType;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  hint?: string;
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
  icon?: ReactNode;
}

/** Ô nhập kiểu "pill" có icon đầu dòng, viền đỏ + thông báo lỗi khi có `error`; mật khẩu tự có nút hiện/ẩn. */
export function FormField({ type, value, onChange, placeholder, error, hint, autoComplete, minLength, maxLength, icon }: FormFieldProps) {
  const { t } = useTranslation('layout');
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label
        className={`flex h-[58px] items-center gap-3.5 rounded-2xl border bg-white/80 px-4.5 focus-within:border-brand ${
          error ? 'border-red-400' : 'border-[rgba(120,60,20,.12)]'
        }`}
      >
        {icon ?? DEFAULT_ICON[type]}
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-base outline-0"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? t('formField.hidePassword') : t('formField.showPassword')}
            className="grid place-items-center border-0 bg-transparent p-1"
          >
            <EyeIcon open={showPassword} />
          </button>
        )}
      </label>
      {error ? <FieldError>{error}</FieldError> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </div>
  );
}
